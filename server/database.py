import sqlite3
import os
import json
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for better concurrent read/write performance
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        created_at INTEGER NOT NULL,
        last_active INTEGER NOT NULL
    )
    """)

    # 2. Check and migrate devices table for user_id + is_demo support
    cursor.execute("PRAGMA table_info(devices)")
    dev_cols = [c[1] for c in cursor.fetchall()]
    
    if not dev_cols:
        cursor.execute("""
        CREATE TABLE devices (
            user_id TEXT NOT NULL DEFAULT 'default',
            id TEXT NOT NULL,
            name TEXT NOT NULL,
            platform TEXT NOT NULL, -- 'macos', 'windows', 'ios', 'android', 'linux'
            model TEXT,
            token TEXT,
            battery_level INTEGER DEFAULT 100,
            is_charging INTEGER DEFAULT 0,
            power_source TEXT DEFAULT 'Battery',
            battery_health TEXT DEFAULT 'Good',
            cycle_count INTEGER DEFAULT 0,
            temperature REAL DEFAULT 0,
            cpu_usage REAL DEFAULT 0,
            ram_usage REAL DEFAULT 0,
            disk_total TEXT,
            disk_used TEXT,
            disk_free TEXT,
            disk_percent REAL DEFAULT 0,
            ip_address TEXT,
            is_demo INTEGER DEFAULT 0,
            last_seen INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, id)
        )
        """)
    else:
        # Incremental migration: add missing columns
        if "user_id" not in dev_cols:
            cursor.execute("ALTER TABLE devices RENAME TO old_devices")
            cursor.execute("""
            CREATE TABLE devices (
                user_id TEXT NOT NULL DEFAULT 'default',
                id TEXT NOT NULL,
                name TEXT NOT NULL,
                platform TEXT NOT NULL,
                model TEXT,
                token TEXT,
                battery_level INTEGER DEFAULT 100,
                is_charging INTEGER DEFAULT 0,
                power_source TEXT DEFAULT 'Battery',
                battery_health TEXT DEFAULT 'Good',
                cycle_count INTEGER DEFAULT 0,
                temperature REAL DEFAULT 0,
                cpu_usage REAL DEFAULT 0,
                ram_usage REAL DEFAULT 0,
                disk_total TEXT,
                disk_used TEXT,
                disk_free TEXT,
                disk_percent REAL DEFAULT 0,
                ip_address TEXT,
                is_demo INTEGER DEFAULT 0,
                last_seen INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, id)
            )
            """)
            cursor.execute("""
            INSERT INTO devices (
                user_id, id, name, platform, model, token, battery_level,
                is_charging, power_source, battery_health, cycle_count,
                temperature, cpu_usage, ram_usage, ip_address, is_demo, last_seen, created_at
            )
            SELECT
                'default', id, name, platform, model, token, battery_level,
                is_charging, power_source, battery_health, cycle_count,
                temperature, cpu_usage, ram_usage, ip_address, 0, last_seen, created_at
            FROM old_devices
            """)
            cursor.execute("DROP TABLE old_devices")
        else:
            # Add individual missing columns safely
            for col, definition in [
                ("is_demo", "INTEGER DEFAULT 0"),
                ("disk_total", "TEXT"),
                ("disk_used", "TEXT"),
                ("disk_free", "TEXT"),
                ("disk_percent", "REAL DEFAULT 0"),
            ]:
                if col not in dev_cols:
                    try:
                        cursor.execute(f"ALTER TABLE devices ADD COLUMN {col} {definition}")
                    except Exception:
                        pass

    # 3. Check and migrate battery_logs table for user_id support
    cursor.execute("PRAGMA table_info(battery_logs)")
    log_cols = [c[1] for c in cursor.fetchall()]
    
    if not log_cols:
        cursor.execute("""
        CREATE TABLE battery_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'default',
            device_id TEXT NOT NULL,
            percentage INTEGER NOT NULL,
            is_charging INTEGER NOT NULL,
            power_source TEXT,
            battery_health TEXT,
            cycle_count INTEGER,
            temperature REAL,
            cpu_usage REAL,
            ram_usage REAL,
            timestamp INTEGER NOT NULL
        )
        """)
    elif "user_id" not in log_cols:
        cursor.execute("ALTER TABLE battery_logs RENAME TO old_battery_logs")
        cursor.execute("""
        CREATE TABLE battery_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'default',
            device_id TEXT NOT NULL,
            percentage INTEGER NOT NULL,
            is_charging INTEGER NOT NULL,
            power_source TEXT,
            battery_health TEXT,
            cycle_count INTEGER,
            temperature REAL,
            cpu_usage REAL,
            ram_usage REAL,
            timestamp INTEGER NOT NULL
        )
        """)
        cursor.execute("""
        INSERT INTO battery_logs (
            id, user_id, device_id, percentage, is_charging, power_source,
            battery_health, cycle_count, temperature, cpu_usage, ram_usage, timestamp
        )
        SELECT
            id, 'default', device_id, percentage, is_charging, power_source,
            battery_health, cycle_count, temperature, cpu_usage, ram_usage, timestamp
        FROM old_battery_logs
        """)
        cursor.execute("DROP TABLE old_battery_logs")

    # 4. Indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_battery_logs_user_dev_time ON battery_logs(user_id, device_id, timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)")

    conn.commit()
    conn.close()

# ------------------------------------------------------------------
# FIX 1: Battery log pruning — prevents unbounded database growth
# ------------------------------------------------------------------

def prune_old_logs(max_days=30):
    """Delete battery_logs older than max_days. Call on startup and periodically."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff = int(time.time()) - (max_days * 86400)
    cursor.execute("DELETE FROM battery_logs WHERE timestamp < ?", (cutoff,))
    deleted = cursor.rowcount
    # Also remove orphaned logs for deleted devices
    cursor.execute("""
        DELETE FROM battery_logs
        WHERE id NOT IN (
            SELECT bl.id FROM battery_logs bl
            INNER JOIN devices d ON d.user_id = bl.user_id AND d.id = bl.device_id
        )
        AND user_id != 'default'
    """)
    conn.commit()
    conn.close()
    if deleted > 0:
        print(f"🧹 Pruned {deleted} old battery log entries (>{max_days}d old)")
    return deleted

def upsert_user(user_id, email=None, name=None, avatar_url=None, role="user", conn=None):
    """Register or update a user profile."""
    if not user_id:
        return None
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
    cursor = conn.cursor()
    now = int(time.time())

    cursor.execute("SELECT id, email, name, avatar_url, role FROM users WHERE id = ?", (user_id,))
    existing = cursor.fetchone()

    if existing:
        eff_email = email if email is not None else existing["email"]
        eff_name = name if name is not None else existing["name"]
        eff_avatar = avatar_url if avatar_url is not None else existing["avatar_url"]
        cursor.execute("""
        UPDATE users SET
            email = ?,
            name = ?,
            avatar_url = ?,
            last_active = ?
        WHERE id = ?
        """, (eff_email, eff_name, eff_avatar, now, user_id))
    else:
        cursor.execute("""
        INSERT INTO users (id, email, name, avatar_url, role, created_at, last_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, email or "", name or user_id, avatar_url or "", role, now, now))

    if should_close:
        conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    user = dict(row) if row else None
    if should_close:
        conn.close()
    return user

def get_user(user_id):
    """Fetch single user profile."""
    if not user_id:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_users():
    """List all registered users."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, avatar_url, role, last_active FROM users ORDER BY last_active DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def upsert_device_telemetry(device_id, name, platform, battery_level, is_charging=False,
                            power_source="Battery", battery_health=None, cycle_count=None,
                            temperature=None, cpu_usage=None, ram_usage=None, ip_address=None,
                            model=None, token=None, user_id="default",
                            disk_total=None, disk_used=None, disk_free=None, disk_percent=None,
                            is_demo=False):
    """Upsert telemetry scoped strictly to user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())
    
    # Ensure user exists (reusing current DB connection)
    upsert_user(user_id=user_id, name=user_id.replace("_", " ").title(), conn=conn)

    # Ensure battery level is constrained 0-100
    try:
        battery_level = max(0, min(100, int(battery_level)))
    except (TypeError, ValueError):
        battery_level = 0
        
    is_charging_val = 1 if is_charging else 0
    is_demo_val = 1 if is_demo else 0
    
    # Check if device exists under this user
    cursor.execute("SELECT id, name, platform, model, battery_health, cycle_count FROM devices WHERE user_id = ? AND id = ?", (user_id, device_id))
    existing = cursor.fetchone()
    
    if existing:
        eff_name = name or existing["name"]
        eff_platform = platform or existing["platform"]
        eff_model = model or existing["model"]
        eff_health = battery_health if battery_health is not None else existing["battery_health"]
        eff_cycles = cycle_count if cycle_count is not None else existing["cycle_count"]
        
        cursor.execute("""
        UPDATE devices SET
            name = ?,
            platform = ?,
            model = ?,
            battery_level = ?,
            is_charging = ?,
            power_source = ?,
            battery_health = ?,
            cycle_count = ?,
            temperature = COALESCE(?, temperature),
            cpu_usage = COALESCE(?, cpu_usage),
            ram_usage = COALESCE(?, ram_usage),
            disk_total = COALESCE(?, disk_total),
            disk_used = COALESCE(?, disk_used),
            disk_free = COALESCE(?, disk_free),
            disk_percent = COALESCE(?, disk_percent),
            ip_address = COALESCE(?, ip_address),
            last_seen = ?
        WHERE user_id = ? AND id = ?
        """, (
            eff_name, eff_platform, eff_model, battery_level, is_charging_val,
            power_source, eff_health, eff_cycles, temperature, cpu_usage, ram_usage,
            disk_total, disk_used, disk_free, disk_percent,
            ip_address, now, user_id, device_id
        ))
    else:
        cursor.execute("""
        INSERT INTO devices (
            user_id, id, name, platform, model, token, battery_level, is_charging,
            power_source, battery_health, cycle_count, temperature, cpu_usage,
            ram_usage, disk_total, disk_used, disk_free, disk_percent,
            ip_address, is_demo, last_seen, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, device_id, name or device_id, platform or "unknown", model or "",
            token or "", battery_level, is_charging_val, power_source,
            battery_health or "N/A", cycle_count or 0, temperature or 0,
            cpu_usage or 0, ram_usage or 0,
            disk_total, disk_used, disk_free, disk_percent or 0,
            ip_address or "", is_demo_val, now, now
        ))
        
    # Record in battery_logs (skip demo devices to keep history clean)
    if not is_demo:
        cursor.execute("""
        INSERT INTO battery_logs (
            user_id, device_id, percentage, is_charging, power_source, battery_health,
            cycle_count, temperature, cpu_usage, ram_usage, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, device_id, battery_level, is_charging_val, power_source,
            battery_health, cycle_count, temperature, cpu_usage, ram_usage, now
        ))
    
    conn.commit()
    conn.close()

def get_all_devices(user_id="default", offline_threshold_sec=300):
    """Retrieve only devices belonging to user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen DESC", (user_id,))
    rows = cursor.fetchall()
    now = int(time.time())
    
    devices = []
    for r in rows:
        d = dict(r)
        d["is_online"] = (now - d["last_seen"]) <= offline_threshold_sec
        d["seconds_since_update"] = now - d["last_seen"]
        devices.append(d)
        
    conn.close()
    return devices

def get_device_history(user_id="default", device_id=None, hours=24, max_points=200):
    """Retrieve history points strictly for user_id (excludes demo devices).
    
    FIX 1: Replaced nested sub-query with a pre-fetched exclude list to avoid
    positional bind-param count mismatch (was raising sqlite3.ProgrammingError).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    since = int(time.time()) - (hours * 3600)

    # Pre-fetch demo device IDs so we avoid nested ? parameter count issues
    cursor.execute(
        "SELECT id FROM devices WHERE user_id = ? AND is_demo = 1", (user_id,)
    )
    demo_ids = tuple(r[0] for r in cursor.fetchall())

    # Build the exclusion fragment only when there are demo devices
    if demo_ids:
        placeholders = ",".join("?" * len(demo_ids))
        exclude_clause = f" AND device_id NOT IN ({placeholders})"
    else:
        exclude_clause = ""
        demo_ids = ()

    if device_id and device_id != "all":
        params = (user_id, device_id, since) + demo_ids
        cursor.execute(f"""
        SELECT device_id, percentage, cpu_usage, ram_usage, is_charging, power_source, timestamp
        FROM battery_logs
        WHERE user_id = ? AND device_id = ? AND timestamp >= ?
        {exclude_clause}
        ORDER BY timestamp ASC
        """, params)
    else:
        params = (user_id, since) + demo_ids
        cursor.execute(f"""
        SELECT device_id, percentage, cpu_usage, ram_usage, is_charging, power_source, timestamp
        FROM battery_logs
        WHERE user_id = ? AND timestamp >= ?
        {exclude_clause}
        ORDER BY timestamp ASC
        """, params)

    rows = cursor.fetchall()
    conn.close()

    total = len(rows)
    if total <= max_points:
        return [dict(r) for r in rows]

    step = max(1, total // max_points)
    sampled = [dict(rows[i]) for i in range(0, total, step)]
    if rows and sampled[-1]["timestamp"] != rows[-1]["timestamp"]:
        sampled.append(dict(rows[-1]))
    return sampled

def delete_device(user_id, device_id):
    """Delete a device scoped strictly to user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM battery_logs WHERE user_id = ? AND device_id = ?", (user_id, device_id))
    cursor.execute("DELETE FROM devices WHERE user_id = ? AND id = ?", (user_id, device_id))
    conn.commit()
    conn.close()

def get_demo_devices(user_id):
    """Get only the demo/simulator devices for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices WHERE user_id = ? AND is_demo = 1 ORDER BY id ASC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def seed_sample_data_if_empty():
    """Fresh database initialization for real telemetry."""
    pass
