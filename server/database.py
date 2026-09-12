import sqlite3
import os
import json
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Devices table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform TEXT NOT NULL, -- 'macos', 'windows', 'ios', 'android'
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
        ip_address TEXT,
        last_seen INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )
    """)
    
    # Battery historical logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS battery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        percentage INTEGER NOT NULL,
        is_charging INTEGER NOT NULL,
        power_source TEXT,
        battery_health TEXT,
        cycle_count INTEGER,
        temperature REAL,
        cpu_usage REAL,
        ram_usage REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
    )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_battery_logs_dev_time ON battery_logs(device_id, timestamp)")
    conn.commit()
    conn.close()

def upsert_device_telemetry(device_id, name, platform, battery_level, is_charging=False,
                            power_source="Battery", battery_health=None, cycle_count=None,
                            temperature=None, cpu_usage=None, ram_usage=None, ip_address=None,
                            model=None, token=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = int(time.time())
    
    # Ensure battery level is constrained 0-100
    try:
        battery_level = max(0, min(100, int(battery_level)))
    except (TypeError, ValueError):
        battery_level = 0
        
    is_charging_val = 1 if is_charging else 0
    
    # Check if device exists
    cursor.execute("SELECT id, name, platform, model, battery_health, cycle_count FROM devices WHERE id = ?", (device_id,))
    existing = cursor.fetchone()
    
    if existing:
        # Keep existing fields if not provided
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
            ip_address = COALESCE(?, ip_address),
            last_seen = ?
        WHERE id = ?
        """, (
            eff_name, eff_platform, eff_model, battery_level, is_charging_val,
            power_source, eff_health, eff_cycles, temperature, cpu_usage, ram_usage,
            ip_address, now, device_id
        ))
    else:
        cursor.execute("""
        INSERT INTO devices (
            id, name, platform, model, token, battery_level, is_charging,
            power_source, battery_health, cycle_count, temperature, cpu_usage,
            ram_usage, ip_address, last_seen, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device_id, name or device_id, platform or "unknown", model or "",
            token or "", battery_level, is_charging_val, power_source,
            battery_health or "Good", cycle_count or 0, temperature or 0,
            cpu_usage or 0, ram_usage or 0, ip_address or "", now, now
        ))
        
    # Also record in battery_logs
    cursor.execute("""
    INSERT INTO battery_logs (
        device_id, percentage, is_charging, power_source, battery_health,
        cycle_count, temperature, cpu_usage, ram_usage, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        device_id, battery_level, is_charging_val, power_source,
        battery_health, cycle_count, temperature, cpu_usage, ram_usage, now
    ))
    
    conn.commit()
    conn.close()

def get_all_devices(offline_threshold_sec=300):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices ORDER BY last_seen DESC")
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

def get_device_history(device_id=None, hours=24, max_points=200):
    conn = get_db_connection()
    cursor = conn.cursor()
    since = int(time.time()) - (hours * 3600)
    
    if device_id:
        cursor.execute("""
        SELECT device_id, percentage, is_charging, power_source, timestamp
        FROM battery_logs
        WHERE device_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
        """, (device_id, since))
    else:
        cursor.execute("""
        SELECT device_id, percentage, is_charging, power_source, timestamp
        FROM battery_logs
        WHERE timestamp >= ?
        ORDER BY timestamp ASC
        """, (since,))
        
    rows = cursor.fetchall()
    conn.close()
    
    # Downsample if too many points to keep graphs lightning-fast
    total = len(rows)
    if total <= max_points:
        return [dict(r) for r in rows]
        
    step = max(1, total // max_points)
    sampled = [dict(rows[i]) for i in range(0, total, step)]
    if rows and sampled[-1]["timestamp"] != rows[-1]["timestamp"]:
        sampled.append(dict(rows[-1]))
    return sampled

def delete_device(device_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM battery_logs WHERE device_id = ?", (device_id,))
    cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
    conn.commit()
    conn.close()

def seed_sample_data_if_empty():
    """Seed initial realistic data so the dashboard is immediately impressive and usable."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM devices")
    row = cursor.fetchone()
    if row["count"] > 0:
        conn.close()
        return

    now = int(time.time())
    # Create sample devices: MacBook Pro, Windows PC, iPhone 16 Pro, Galaxy S24
    samples = [
        {
            "id": "macbook-pro",
            "name": "MacBook Pro 16\"",
            "platform": "macos",
            "model": "Apple M3 Pro",
            "battery_level": 80,
            "is_charging": 0,
            "power_source": "AC Power",
            "battery_health": "93% (Normal)",
            "cycle_count": 208,
            "temperature": 32.5,
            "cpu_usage": 14.2,
            "ram_usage": 58.4,
            "ip_address": "192.168.1.45",
            "history": [88, 86, 84, 83, 82, 81, 80]
        },
        {
            "id": "windows-pc",
            "name": "Dell XPS 15",
            "platform": "windows",
            "model": "Intel Core i7-13700H",
            "battery_level": 64,
            "is_charging": 1,
            "power_source": "AC Power",
            "battery_health": "89% (Good)",
            "cycle_count": 312,
            "temperature": 41.0,
            "cpu_usage": 28.5,
            "ram_usage": 67.1,
            "ip_address": "192.168.1.112",
            "history": [45, 49, 53, 58, 61, 64]
        },
        {
            "id": "iphone-16",
            "name": "iPhone 16 Pro",
            "platform": "ios",
            "model": "iOS 18.2",
            "battery_level": 42,
            "is_charging": 0,
            "power_source": "Battery",
            "battery_health": "98% (Normal)",
            "cycle_count": 84,
            "temperature": 28.0,
            "cpu_usage": 8.0,
            "ram_usage": 45.0,
            "ip_address": "192.168.1.78",
            "history": [65, 61, 56, 50, 46, 42]
        },
        {
            "id": "galaxy-s24",
            "name": "Samsung Galaxy S24 Ultra",
            "platform": "android",
            "model": "Android 15 (One UI 7)",
            "battery_level": 19,
            "is_charging": 0,
            "power_source": "Battery",
            "battery_health": "Good",
            "cycle_count": 142,
            "temperature": 34.2,
            "cpu_usage": 11.5,
            "ram_usage": 52.0,
            "ip_address": "192.168.1.92",
            "history": [45, 38, 32, 26, 22, 19]
        }
    ]

    for s in samples:
        cursor.execute("""
        INSERT INTO devices (
            id, name, platform, model, token, battery_level, is_charging,
            power_source, battery_health, cycle_count, temperature, cpu_usage,
            ram_usage, ip_address, last_seen, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["name"], s["platform"], s["model"], "secret-token",
            s["battery_level"], s["is_charging"], s["power_source"],
            s["battery_health"], s["cycle_count"], s["temperature"],
            s["cpu_usage"], s["ram_usage"], s["ip_address"], now, now - 86400
        ))
        
        # Populate realistic history for charts
        hist = s["history"]
        count = len(hist)
        for i, pct in enumerate(hist):
            t = now - ((count - 1 - i) * 1800) # every 30 mins
            cursor.execute("""
            INSERT INTO battery_logs (
                device_id, percentage, is_charging, power_source, battery_health,
                cycle_count, temperature, cpu_usage, ram_usage, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                s["id"], pct, s["is_charging"], s["power_source"],
                s["battery_health"], s["cycle_count"], s["temperature"],
                s["cpu_usage"], s["ram_usage"], t
            ))

    conn.commit()
    conn.close()
