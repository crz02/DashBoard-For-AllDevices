#!/usr/bin/env python3
import os
import sys
import json
import time
import queue
import secrets
import mimetypes
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import (
    init_db,
    prune_old_logs,
    upsert_user,
    get_user,
    get_all_users,
    upsert_device_telemetry,
    get_all_devices,
    get_device_history,
    delete_device,
    get_demo_devices,
)

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT_DIR, ".env")

def load_dotenv_file():
    """Load environment variables from .env file if present."""
    if os.path.isfile(ENV_FILE):
        try:
            with open(ENV_FILE, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    # Strip surrounding quotes from value
                    v = v.strip().strip("'\"")
                    if k:
                        os.environ[k] = v
        except Exception as e:
            print(f"Warning: Failed to load .env file: {e}")

load_dotenv_file()

# ------------------------------------------------------------------
# FIX 2: API Key authentication for /api/report
# Set REPORT_API_KEY in .env to enable. Leave blank to disable (open).
# ------------------------------------------------------------------
REPORT_API_KEY = os.environ.get("REPORT_API_KEY", "").strip()

def verify_report_auth(headers):
    """
    If REPORT_API_KEY is set, incoming /api/report requests must supply:
      Authorization: Bearer <REPORT_API_KEY>
    OR
      X-Api-Key: <REPORT_API_KEY>
    Returns True if auth passes (or if auth is disabled).
    """
    if not REPORT_API_KEY:
        return True  # Auth disabled — open access (backward compatible)

    # Check Authorization: Bearer <key>
    auth_header = headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if secrets.compare_digest(token, REPORT_API_KEY):
            return True

    # Check X-Api-Key header
    api_key_header = headers.get("X-Api-Key", "").strip()
    if api_key_header and secrets.compare_digest(api_key_header, REPORT_API_KEY):
        return True

    return False

# Thread-safe user-scoped event broadcaster for Server-Sent Events (SSE)
class EventBroadcaster:
    def __init__(self):
        self.clients = {}  # queue -> user_id
        self.lock = threading.Lock()

    def subscribe(self, user_id="default"):
        q = queue.Queue(maxsize=100)
        with self.lock:
            self.clients[q] = user_id
        return q

    def unsubscribe(self, q):
        with self.lock:
            self.clients.pop(q, None)

    def broadcast_user(self, user_id, event_name, data):
        payload = f"event: {event_name}\ndata: {json.dumps(data)}\n\n".encode("utf-8")
        with self.lock:
            for q, uid in list(self.clients.items()):
                if uid == user_id or uid == "all":
                    try:
                        q.put_nowait(payload)
                    except queue.Full:
                        pass

    def broadcast_all(self, event_name, data):
        payload = f"event: {event_name}\ndata: {json.dumps(data)}\n\n".encode("utf-8")
        with self.lock:
            for q in list(self.clients.keys()):
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass

broadcaster = EventBroadcaster()

# ------------------------------------------------------------------
# FIX 4: Simulator isolation — only modifies is_demo=1 devices.
# Creates its own demo fleet if none exist; never touches real devices.
# ------------------------------------------------------------------

# Demo device templates used to seed the simulator fleet
DEMO_DEVICE_TEMPLATES = [
    {"id": "sim-macbook-pro", "name": "Demo MacBook Pro", "platform": "macos", "model": "MacBook Pro 16\"",  "battery_level": 78, "is_charging": False, "temperature": 38.5},
    {"id": "sim-iphone-15",   "name": "Demo iPhone 15",   "platform": "ios",   "model": "iPhone 15 Pro",    "battery_level": 54, "is_charging": True,  "temperature": 36.0},
    {"id": "sim-windows-pc",  "name": "Demo Windows PC",  "platform": "windows","model": "Dell XPS 15",    "battery_level": 42, "is_charging": False, "temperature": 45.2},
    {"id": "sim-pixel-8",     "name": "Demo Pixel 8",     "platform": "android","model": "Pixel 8 Pro",    "battery_level": 91, "is_charging": True,  "temperature": 34.8},
]

simulator_stop_event = threading.Event()
simulator_stop_event.set()  # Start in stopped state
simulator_thread = None

# In-memory state for simulator devices (per user)
_sim_state = {}  # user_id -> {device_id -> {battery_level, is_charging, temperature, cpu_usage, ram_usage}}
_sim_lock = threading.Lock()

def _get_or_init_sim_state(user_id, existing_devices):
    """Initialize simulator state from existing demo devices or defaults."""
    with _sim_lock:
        if user_id not in _sim_state:
            _sim_state[user_id] = {}
            for d in existing_devices:
                _sim_state[user_id][d["id"]] = {
                    "battery_level": d["battery_level"],
                    "is_charging": bool(d["is_charging"]),
                    "temperature": d["temperature"] or 36.0,
                    "cpu_usage": d["cpu_usage"] or 15.0,
                    "ram_usage": d["ram_usage"] or 40.0,
                }
        return _sim_state[user_id]

def _ensure_demo_devices_exist(user_id):
    """Seed demo devices for this user if they don't have any."""
    existing = get_demo_devices(user_id)
    if existing:
        return existing

    seeded = []
    for tmpl in DEMO_DEVICE_TEMPLATES:
        upsert_device_telemetry(
            device_id=tmpl["id"],
            name=tmpl["name"],
            platform=tmpl["platform"],
            model=tmpl["model"],
            battery_level=tmpl["battery_level"],
            is_charging=tmpl["is_charging"],
            power_source="AC Power" if tmpl["is_charging"] else "Battery",
            battery_health="Good",
            cycle_count=42,
            temperature=tmpl["temperature"],
            cpu_usage=15.0,
            ram_usage=40.0,
            user_id=user_id,
            is_demo=True,
        )
        seeded.append(tmpl)
    return get_demo_devices(user_id)

def run_simulator_loop():
    import random
    while not simulator_stop_event.is_set():
        if simulator_stop_event.wait(timeout=4):
            break

        users = get_all_users()
        for u in users:
            uid = u["id"]

            # Ensure demo fleet exists for this user
            demo_devices = _ensure_demo_devices_exist(uid)
            if not demo_devices:
                continue

            state = _get_or_init_sim_state(uid, demo_devices)

            for d in demo_devices:
                dev_id = d["id"]
                if dev_id not in state:
                    state[dev_id] = {
                        "battery_level": d["battery_level"],
                        "is_charging": bool(d["is_charging"]),
                        "temperature": d["temperature"] or 36.0,
                        "cpu_usage": 15.0,
                        "ram_usage": 40.0,
                    }

                s = state[dev_id]

                # Animate battery
                if s["is_charging"]:
                    s["battery_level"] = min(100, s["battery_level"] + 1)
                    if s["battery_level"] >= 100:
                        s["is_charging"] = False
                else:
                    s["battery_level"] = max(5, s["battery_level"] - 1)
                    if s["battery_level"] <= 5:
                        s["is_charging"] = True

                # Animate temperature ± 0.3
                delta = random.uniform(-0.3, 0.3)
                s["temperature"] = round(max(28.0, min(60.0, s["temperature"] + delta)), 1)

                # Animate CPU ± 3%
                s["cpu_usage"] = round(max(2.0, min(95.0, s["cpu_usage"] + random.uniform(-3, 3))), 1)

                # Animate RAM ± 1%
                s["ram_usage"] = round(max(10.0, min(95.0, s["ram_usage"] + random.uniform(-1, 1))), 1)

                upsert_device_telemetry(
                    device_id=dev_id,
                    name=d["name"],
                    platform=d["platform"],
                    model=d["model"],
                    battery_level=s["battery_level"],
                    is_charging=s["is_charging"],
                    power_source="AC Power" if s["is_charging"] else "Battery",
                    battery_health=d.get("battery_health", "Good"),
                    cycle_count=d.get("cycle_count", 0),
                    temperature=s["temperature"],
                    cpu_usage=s["cpu_usage"],
                    ram_usage=s["ram_usage"],
                    ip_address=d.get("ip_address"),
                    user_id=uid,
                    is_demo=True,
                )

            # Broadcast only demo + real devices (all under this user)
            broadcaster.broadcast_user(uid, "devices_updated", get_all_devices(user_id=uid))

def extract_user_id(headers, query=None, body=None):
    """Extract authenticated user context from headers, query parameters, or JSON payload.
    
    FIX 3: Authorization Bearer header is NEVER used as user_id (it was a security
    anti-pattern — the bearer token had no relation to user identity). user_id must
    come from X-User-Id header, ?user_id= query param, or JSON body only.
    """
    # 1. Header X-User-Id
    user_id = headers.get("X-User-Id")
    if user_id and user_id.strip():
        return user_id.strip()

    # 2. Query parameter ?user_id=...
    if query and "user_id" in query:
        val = query["user_id"][0].strip()
        if val:
            return val

    # 3. JSON body user_id
    if body and isinstance(body, dict) and body.get("user_id"):
        val = str(body["user_id"]).strip()
        if val:
            return val

    # Default fallback user
    return "default"

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet standard output
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Api-Key")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Api-Key")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        user_id = extract_user_id(self.headers, query=query)

        # SSE Stream (Scoped to requesting user)
        if path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            q = broadcaster.subscribe(user_id=user_id)
            try:
                # Send initial user-scoped state immediately
                init_event = f"event: devices_updated\ndata: {json.dumps(get_all_devices(user_id=user_id))}\n\n".encode("utf-8")
                self.wfile.write(init_event)
                self.wfile.flush()

                while True:
                    try:
                        msg = q.get(timeout=15.0)
                        self.wfile.write(msg)
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                broadcaster.unsubscribe(q)
            return

        # API: List all devices for the authenticated user
        if path == "/api/devices":
            devices = get_all_devices(user_id=user_id)
            self.send_json({"status": "success", "user_id": user_id, "devices": devices})
            return

        # API: Device History (Scoped to authenticated user)
        if path.startswith("/api/devices/") and path.endswith("/history"):
            parts = path.strip("/").split("/")
            device_id = parts[2] if len(parts) >= 3 else None
            hours = int(query.get("hours", [24])[0])
            history = get_device_history(user_id=user_id, device_id=device_id, hours=hours)
            self.send_json({"status": "success", "user_id": user_id, "history": history})
            return

        # API: Global History for this user
        if path == "/api/history":
            hours = int(query.get("hours", [24])[0])
            history = get_device_history(user_id=user_id, device_id=None, hours=hours)
            self.send_json({"status": "success", "user_id": user_id, "history": history})
            return

        # API: List registered users (for switching / multi-user preview)
        if path == "/api/users":
            users = get_all_users()
            self.send_json({"status": "success", "current_user_id": user_id, "users": users})
            return

        # API: Current user profile
        if path == "/api/users/current":
            user = get_user(user_id) or upsert_user(user_id=user_id, name=user_id.title())
            self.send_json({"status": "success", "user": user})
            return

        # API: Simulator Status
        if path == "/api/simulator/status":
            self.send_json({"status": "success", "running": not simulator_stop_event.is_set()})
            return

        # API: Public Tunnel URL
        if path == "/api/tunnel":
            tunnel_file = os.path.join(PUBLIC_DIR, "tunnel_url.json")
            url = None
            if os.path.isfile(tunnel_file):
                try:
                    with open(tunnel_file, "r") as f:
                        url_data = json.load(f)
                        url = url_data.get("url")
                except Exception:
                    pass
            self.send_json({"status": "success", "url": url})
            return

        # API: Public Config (Clerk publishable key, etc.)
        if path == "/api/config":
            candidates = [
                os.environ.get("CLERK_PUBLISHABLE_KEY", ""),
                os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", ""),
            ]
            clerk_key = ""
            for c in candidates:
                c = c.strip()
                if c.startswith("pk_test_") or c.startswith("pk_live_"):
                    clerk_key = c
                    break
            # Also expose whether API key auth is enabled (but NOT the key itself)
            self.send_json({
                "status": "success",
                "clerk_publishable_key": clerk_key,
                "report_auth_enabled": bool(REPORT_API_KEY)
            })
            return

        # Serve static files from public/
        req_path = path.lstrip("/")
        if not req_path or req_path == "index.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
        elif req_path in ("signin", "sign-in", "login"):
            file_path = os.path.join(PUBLIC_DIR, "signin.html")
        else:
            file_path = os.path.join(PUBLIC_DIR, req_path)

        if os.path.isfile(file_path):
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
            return

        # 404
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"404 Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(length) if length > 0 else b""

        data = {}
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            try:
                data = json.loads(post_body.decode("utf-8"))
            except Exception:
                data = {}
        elif "application/x-www-form-urlencoded" in content_type:
            form = parse_qs(post_body.decode("utf-8"))
            for k, v in form.items():
                data[k] = v[0] if v else ""

        user_id = extract_user_id(self.headers, query=parse_qs(parsed.query), body=data)

        # Save / Update Clerk keys endpoint
        if path == "/api/config/clerk":
            publishable_key = (data.get("clerk_publishable_key") or data.get("publishable_key") or "").strip()
            secret_key = (data.get("clerk_secret_key") or data.get("secret_key") or "").strip()
            if not publishable_key:
                self.send_json({"error": "Missing clerk_publishable_key parameter"}, status=400)
                return

            os.environ["CLERK_PUBLISHABLE_KEY"] = publishable_key
            if secret_key:
                os.environ["CLERK_SECRET_KEY"] = secret_key

            try:
                env_lines = []
                if os.path.isfile(ENV_FILE):
                    with open(ENV_FILE, "r") as f:
                        for line in f:
                            if line.startswith("CLERK_PUBLISHABLE_KEY=") or (secret_key and line.startswith("CLERK_SECRET_KEY=")):
                                continue
                            env_lines.append(line)
                env_lines.append(f"CLERK_PUBLISHABLE_KEY={publishable_key}\n")
                if secret_key:
                    env_lines.append(f"CLERK_SECRET_KEY={secret_key}\n")
                with open(ENV_FILE, "w") as f:
                    f.writelines(env_lines)
            except Exception as e:
                print(f"Warning: Failed to persist Clerk keys to .env: {e}")

            self.send_json({
                "status": "success",
                "message": "Clerk keys saved successfully",
                "clerk_publishable_key": publishable_key
            })
            return

        # Sync/Register User endpoint (from Clerk or client session)
        if path == "/api/users/sync":
            target_uid = data.get("user_id") or data.get("id") or user_id
            email = data.get("email")
            name = data.get("name")
            avatar_url = data.get("avatar_url")
            user = upsert_user(user_id=target_uid, email=email, name=name, avatar_url=avatar_url)
            self.send_json({"status": "success", "user": user})
            return

        # ------------------------------------------------------------------
        # FIX 2: Report telemetry endpoint — now checks API key if configured
        # ------------------------------------------------------------------
        if path == "/api/report":
            if not verify_report_auth(self.headers):
                self.send_json({"error": "Unauthorized. Supply a valid API key."}, status=401)
                return

            device_id = data.get("device_id") or data.get("id")
            if not device_id:
                self.send_json({"error": "Missing device_id parameter"}, status=400)
                return

            name = data.get("name")
            platform = (data.get("platform") or "unknown").lower()
            model = data.get("model")
            battery_level = data.get("battery_level") or data.get("battery") or data.get("percentage") or 100
            
            # Charging flag parsing
            is_charging_raw = data.get("is_charging")
            if isinstance(is_charging_raw, str):
                is_charging = is_charging_raw.lower() in ("true", "1", "yes", "charging")
            else:
                is_charging = bool(is_charging_raw)

            power_source = data.get("power_source") or ("AC Power" if is_charging else "Battery")
            battery_health = data.get("battery_health") or data.get("health")
            cycle_count = data.get("cycle_count") or data.get("cycles")
            temperature = data.get("temperature") or data.get("temp")
            cpu_usage = data.get("cpu_usage") or data.get("cpu")
            ram_usage = data.get("ram_usage") or data.get("ram")
            ip_address = data.get("ip_address") or self.client_address[0]
            token = data.get("token")

            # Disk usage (from desktop agent)
            disk_info = data.get("disk_usage") or {}
            disk_total = disk_info.get("total") if isinstance(disk_info, dict) else None
            disk_used = disk_info.get("used") if isinstance(disk_info, dict) else None
            disk_free = disk_info.get("free") if isinstance(disk_info, dict) else None
            disk_percent = disk_info.get("percent") if isinstance(disk_info, dict) else None

            upsert_device_telemetry(
                device_id=device_id,
                name=name,
                platform=platform,
                battery_level=battery_level,
                is_charging=is_charging,
                power_source=power_source,
                battery_health=battery_health,
                cycle_count=cycle_count,
                temperature=temperature,
                cpu_usage=cpu_usage,
                ram_usage=ram_usage,
                ip_address=ip_address,
                model=model,
                token=token,
                user_id=user_id,
                disk_total=disk_total,
                disk_used=disk_used,
                disk_free=disk_free,
                disk_percent=disk_percent,
                is_demo=False,
            )

            # Broadcast only to the owning user's active dashboard SSE streams
            broadcaster.broadcast_user(user_id, "devices_updated", get_all_devices(user_id=user_id))
            # FIX 8: Only broadcast device_ping for critical events (low battery or newly charging)
            if not is_charging and int(battery_level) <= 20:
                broadcaster.broadcast_user(user_id, "device_ping", {
                    "user_id": user_id,
                    "device_id": device_id,
                    "battery": battery_level,
                    "is_charging": is_charging,
                    "alert": "low_battery"
                })

            self.send_json({
                "status": "success",
                "user_id": user_id,
                "device_id": device_id,
                "battery_level": battery_level,
                "is_charging": is_charging
            })
            return

        # Simulator toggle endpoint
        if path == "/api/simulator/toggle":
            global simulator_thread
            enable = data.get("enable")
            currently_running = not simulator_stop_event.is_set()

            if enable is None:
                target_state = not currently_running
            else:
                target_state = bool(enable)

            if target_state:
                simulator_stop_event.clear()  # Allow loop to run
                if simulator_thread is None or not simulator_thread.is_alive():
                    simulator_thread = threading.Thread(target=run_simulator_loop, daemon=True)
                    simulator_thread.start()
            else:
                simulator_stop_event.set()  # Signal loop to stop

            self.send_json({"status": "success", "running": not simulator_stop_event.is_set()})
            return

        # Delete device endpoint (scoped to user)
        if path == "/api/devices/delete":
            device_id = data.get("device_id")
            if device_id:
                delete_device(user_id=user_id, device_id=device_id)
                broadcaster.broadcast_user(user_id, "devices_updated", get_all_devices(user_id=user_id))
                self.send_json({"status": "success", "deleted": device_id, "user_id": user_id})
                return
            self.send_json({"error": "Missing device_id"}, status=400)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

def _schedule_daily_prune():
    """FIX 2: Run log pruning once every 24 hours in the background."""
    import time as _time
    while True:
        _time.sleep(24 * 3600)  # Sleep 24 hours
        try:
            prune_old_logs(max_days=30)
        except Exception as e:
            print(f"Warning: Scheduled prune failed: {e}")

def main():
    init_db()

    # FIX 1: Prune old battery logs on every startup
    prune_old_logs(max_days=30)

    # FIX 2: Schedule daily pruning in a background thread
    prune_thread = threading.Thread(target=_schedule_daily_prune, daemon=True)
    prune_thread.start()

    port = int(os.environ.get("PORT", 8080))

    if REPORT_API_KEY:
        print(f"🔒 API key auth is ENABLED for /api/report")
    else:
        print(f"⚠️  API key auth is DISABLED (set REPORT_API_KEY in .env to enable)")

    server = ThreadedHTTPServer(("0.0.0.0", port), DashboardHandler)
    print(f"🚀 Statuser Multi-User Telemetry Server running at http://localhost:{port}")
    print(f"📡 API Ingestion Webhook: http://localhost:{port}/api/report")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    main()
