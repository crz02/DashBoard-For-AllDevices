# OmniPulse — Multi-Device Battery & Telemetry Dashboard

A clean, distraction-free dashboard to monitor real-time battery levels, charging status, and system telemetry across all your personal devices:
- 🍎 **MacBook (macOS)**
- 🪟 **Windows PC & Laptops**
- 📱 **iOS (iPhone & iPad)**
- 🤖 **Android Phones & Tablets**

![Platform Support](https://img.shields.io/badge/Platforms-macOS%20%7C%20Windows%20%7C%20iOS%20%7C%20Android-06B6D4?style=for-the-badge)
![Cloud Ready](https://img.shields.io/badge/Cloud-HTTPS%20%7C%20Everywhere-10B981?style=for-the-badge)
![Realtime](https://img.shields.io/badge/Sync-SSE%20Realtime-6366F1?style=for-the-badge)

> 📖 **Guides & Documentation**:
> - **[SETUP_GUIDE.md](SETUP_GUIDE.md)**: Step-by-step device connection instructions for iPhone, Android, Windows, and Mac.
> - **[cloud/CLOUD_DEPLOY_GUIDE.md](cloud/CLOUD_DEPLOY_GUIDE.md)**: 24/7 permanent cloud deployment on Vercel + Supabase.

---

## 🌟 Key Features

- **🌐 Cloud & Public HTTPS Enabled**: Works over cellular (5G/4G) and any Wi-Fi. No local IP hassle or router port forwarding.
- **⚡ Real-Time Live Sync (SSE)**: Instant UI updates whenever any device reports battery or state changes.
- **🧼 Clean, High-Usability UI**: Fast, readable, minimalist design focused on quick scanning without visual bloat.
- **📈 Fleet Battery Analytics**: 24-hour battery history chart (powered by Chart.js) with single-device or fleet views.
- **🛡️ Native Zero-Bloat Clients**:
  - **macOS**: Built-in shell script reading `pmset -g batt` & `system_profiler SPPowerDataType` (reports cycles & capacity).
  - **Windows**: Built-in PowerShell script querying `Win32_Battery` via WMI/CIM.
  - **iOS**: Apple Shortcuts automation (`Get Battery Level` + `POST` to public HTTPS webhook).
  - **Android**: Termux script or MacroDroid/Tasker automation.
- **🎮 Built-In Live Simulator**: One-click simulator to preview live charging and battery drain across all device cards.

---

## 🚀 Quick Start

### 1. Start the Local Server
```bash
python3 server/app.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser!

### 2. Enable Public HTTPS Tunnel (For iOS & Remote Devices)
In another terminal, start the instant public Cloudflare tunnel:
```bash
./scripts/start_public_tunnel.sh
```
This prints your public HTTPS URL (e.g. `https://your-tunnel.trycloudflare.com`). Now any iPhone, Android phone, or laptop can connect to your dashboard and webhook from anywhere!

---

## 📲 Device Setup Summary

| Platform | Reporting Method | Setup Command / Guide |
|---|---|---|
| **🍎 MacBook** | Native bash (`pmset`) | `./agents/macos/report_battery.sh <URL> macbook` |
| **🪟 Windows** | PowerShell (`Win32_Battery`) | `powershell.exe -File .\agents\windows\report_battery.ps1 -DashboardUrl <URL>` |
| **📱 iOS** | Apple Shortcuts app | See [agents/ios/SHORTCUT_GUIDE.md](agents/ios/SHORTCUT_GUIDE.md) |
| **🤖 Android** | MacroDroid / Tasker / Termux | See [agents/android/ANDROID_GUIDE.md](agents/android/ANDROID_GUIDE.md) |

*Full step-by-step instructions available in **[SETUP_GUIDE.md](SETUP_GUIDE.md)**.*

---

## 🛠️ REST API Specification

### Report Device Status
`POST /api/report`
```json
{
  "device_id": "iphone",
  "name": "Irfan's iPhone",
  "platform": "ios",
  "battery_level": 88,
  "is_charging": true,
  "power_source": "AC Power"
}
```

### Endpoints
- `GET /api/devices`: List all registered devices and latest battery states.
- `GET /api/devices/{id}/history?hours=24`: Historical battery drain data for charting.
- `GET /api/events`: Server-Sent Events (SSE) real-time stream.
- `GET /api/tunnel`: Active public HTTPS tunnel address.

---

## 📁 Repository Structure
```
├── agents/
│   ├── macos/
│   │   ├── report_battery.sh
│   │   └── com.dashboard.battery.plist
│   ├── windows/
│   │   └── report_battery.ps1
│   ├── ios/
│   │   └── SHORTCUT_GUIDE.md
│   └── android/
│       ├── report_battery_termux.sh
│       └── ANDROID_GUIDE.md
├── cloud/
│   ├── CLOUD_DEPLOY_GUIDE.md  # 24/7 Vercel + Supabase setup
│   └── supabase_schema.sql    # Supabase PostgreSQL schema
├── public/
│   ├── index.html             # Clean, responsive dashboard HTML
│   ├── styles.css             # Minimalist, high-usability CSS
│   └── app.js                 # Realtime SSE client & Chart.js
├── scripts/
│   └── start_public_tunnel.sh # Instant Cloudflare public HTTPS tunnel
├── server/
│   ├── app.py                 # Threaded server, REST API & SSE
│   ├── database.py            # SQLite schema & persistence
│   └── dashboard.db           # SQLite database file
├── SETUP_GUIDE.md             # Comprehensive multi-device setup guide
└── README.md
```
