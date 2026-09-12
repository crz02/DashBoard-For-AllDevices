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
    seed_sample_data_if_empty,
    upsert_device_telemetry,
    get_all_devices,
    get_device_history,
    delete_device
)

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

# Thread-safe event broadcaster for Server-Sent Events (SSE)
class EventBroadcaster:
    def __init__(self):
        self.clients = set()
        self.lock = threading.Lock()

    def subscribe(self):
        q = queue.Queue(maxsize=50)
        with self.lock:
            self.clients.add(q)
        return q

    def unsubscribe(self, q):
        with self.lock:
            self.clients.discard(q)

    def broadcast(self, event_name, data):
        payload = f"event: {event_name}\ndata: {json.dumps(data)}\n\n".encode("utf-8")
        with self.lock:
            for q in list(self.clients):
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass

broadcaster = EventBroadcaster()

# Background simulator thread state
simulator_running = False
simulator_thread = None

def run_simulator_loop():
    global simulator_running
    while simulator_running:
        time.sleep(4)
        devices = get_all_devices()
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
                ip_address=d["ip_address"]
            )
        # Broadcast update
        broadcaster.broadcast("devices_updated", get_all_devices())

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Concise logging to stdout
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # SSE Stream
        if path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            q = broadcaster.subscribe()
            try:
                # Send initial full state immediately
                init_event = f"event: devices_updated\ndata: {json.dumps(get_all_devices())}\n\n".encode("utf-8")
                self.wfile.write(init_event)
                self.wfile.flush()

                while True:
                    try:
                        msg = q.get(timeout=15.0)
                        self.wfile.write(msg)
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat comment
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                broadcaster.unsubscribe(q)
            return

        # API: List all devices
        if path == "/api/devices":
            devices = get_all_devices()
            self.send_json({"status": "success", "devices": devices})
            return

        # API: Device History
        if path.startswith("/api/devices/") and path.endswith("/history"):
            parts = path.strip("/").split("/")
            device_id = parts[2] if len(parts) >= 3 else None
            hours = int(query.get("hours", [24])[0])
            history = get_device_history(device_id=device_id, hours=hours)
            self.send_json({"status": "success", "history": history})
            return

        # API: Global History
        if path == "/api/history":
            hours = int(query.get("hours", [24])[0])
            history = get_device_history(device_id=None, hours=hours)
            self.send_json({"status": "success", "history": history})
            return

        # API: Simulator Status
        if path == "/api/simulator/status":
            global simulator_running
            self.send_json({"status": "success", "running": simulator_running})
            return

        # Serve static files from public/
        req_path = path.lstrip("/")
        if not req_path or req_path == "index.html":
            file_path = os.path.join(PUBLIC_DIR, "index.html")
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

        # Report endpoint
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
            battery_health = data.get("battery_health")
            cycle_count = data.get("cycle_count")
            temperature = data.get("temperature")
            cpu_usage = data.get("cpu_usage")
            ram_usage = data.get("ram_usage")
            
            # Client IP
            client_ip = self.headers.get("X-Forwarded-For") or self.client_address[0]

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
                ip_address=client_ip,
                model=model
            )

            # Broadcast update to active browser clients
            devices = get_all_devices()
            broadcaster.broadcast("devices_updated", devices)
            broadcaster.broadcast("device_ping", {"device_id": device_id, "battery": battery_level})

            self.send_json({"status": "success", "message": f"Updated {device_id}"})
            return

        # Simulator toggle endpoint
        if path == "/api/simulator/toggle":
            global simulator_running, simulator_thread
            simulator_running = not simulator_running
            if simulator_running:
                if simulator_thread is None or not simulator_thread.is_alive():
                    simulator_thread = threading.Thread(target=run_simulator_loop, daemon=True)
                    simulator_thread.start()
            self.send_json({"status": "success", "running": simulator_running})
            return

        # Delete device endpoint
        if path == "/api/devices/delete":
            device_id = data.get("device_id")
            if device_id:
                delete_device(device_id)
                broadcaster.broadcast("devices_updated", get_all_devices())
                self.send_json({"status": "success", "deleted": device_id})
                return
            self.send_json({"error": "Missing device_id"}, status=400)
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

def main():
    init_db()
    seed_sample_data_if_empty()

    port = int(os.environ.get("PORT", 8080))
    server = ThreadedHTTPServer(("0.0.0.0", port), DashboardHandler)
    print(f"🚀 Multi-Device Battery Dashboard running at http://localhost:{port}")
    print(f"📡 API Ingestion Webhook: http://localhost:{port}/api/report")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    main()
