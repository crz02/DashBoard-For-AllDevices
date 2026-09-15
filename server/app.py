#!/usr/bin/env python3
import os
import sys
import json
import time
import queue
import mimetypes
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import (
    init_db,
    upsert_user,
    get_user,
    get_all_users,
    upsert_device_telemetry,
    get_all_devices,
    get_device_history,
    delete_device
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
                    v = v.strip().strip("'\"")
                    if k:
                        os.environ[k] = v
        except Exception as e:
            print(f"Warning: Failed to load .env file: {e}")

load_dotenv_file()

# Thread-safe user-scoped event broadcaster for Server-Sent Events (SSE)
class EventBroadcaster:
    def __init__(self):
        self.clients = {}  # queue -> user_id
        self.lock = threading.Lock()

    def subscribe(self, user_id="default"):
        q = queue.Queue(maxsize=50)
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

# Background simulator thread state (thread-safe)
simulator_stop_event = threading.Event()
simulator_stop_event.set()  # Start in stopped state
simulator_thread = None

def run_simulator_loop():
    while not simulator_stop_event.is_set():
        # Wait with timeout allows clean shutdown via Event
        if simulator_stop_event.wait(timeout=4):
            break
        users = get_all_users()
        for u in users:
            uid = u["id"]
            devices = get_all_devices(user_id=uid)
            for d in devices:
                level = d["battery_level"]
                is_charging = bool(d["is_charging"])
                
                if is_charging:
                    level += 1
                    if level >= 100:
                        level = 100
                        is_charging = False
                else:
                    level -= 1
                    if level <= 5:
                        level = 5
                        is_charging = True
                        
                upsert_device_telemetry(
                    device_id=d["id"],
                    name=d["name"],
                    platform=d["platform"],
                    model=d["model"],
                    battery_level=level,
                    is_charging=is_charging,
                    power_source="AC Power" if is_charging else "Battery",
                    battery_health=d["battery_health"],
                    cycle_count=d["cycle_count"],
                    temperature=round(d["temperature"] + (0.2 if is_charging else -0.1), 1),
                    cpu_usage=d["cpu_usage"],
                    ram_usage=d["ram_usage"],
                    ip_address=d["ip_address"],
                    user_id=uid
                )
            # Broadcast user-scoped update
            broadcaster.broadcast_user(uid, "devices_updated", get_all_devices(user_id=uid))

def extract_user_id(headers, query=None, body=None):
    """Extract authenticated user context from headers, query parameters, or JSON payload."""
    # 1. Header X-User-Id
    user_id = headers.get("X-User-Id")
    if user_id and user_id.strip():
        return user_id.strip()

    # 2. Header Authorization: Bearer <user_id>
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        if token:
            return token

    # 3. Query parameter ?user_id=...
    if query and "user_id" in query:
        val = query["user_id"][0].strip()
        if val:
            return val

    # 4. JSON body user_id
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
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id")
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
            # Prefer any key starting with pk_test_ or pk_live_ (safe to expose)
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
            self.send_json({"status": "success", "clerk_publishable_key": clerk_key})
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

        # Report telemetry endpoint
        if path == "/api/report":
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
                user_id=user_id
            )

            # Broadcast only to the owning user's active dashboard SSE streams
            broadcaster.broadcast_user(user_id, "devices_updated", get_all_devices(user_id=user_id))
            broadcaster.broadcast_user(user_id, "device_ping", {
                "user_id": user_id,
                "device_id": device_id,
                "battery": battery_level,
                "is_charging": is_charging
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

def main():
    init_db()

    port = int(os.environ.get("PORT", 8080))
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
