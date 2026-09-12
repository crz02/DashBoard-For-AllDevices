# OmniPulse — Multi-Device Battery & Telemetry Dashboard

A modern, real-time dashboard to monitor battery levels, charging status, battery health, and system telemetry across all your devices:
- 🍎 **MacBook (macOS)**
- 🪟 **Windows PC & Laptops**
- 📱 **iOS (iPhone & iPad)**
- 🤖 **Android Phones & Tablets**

![Dashboard Preview](https://img.shields.io/badge/OmniPulse-Multi--Device-6366F1?style=for-the-badge&logo=apple)
![Platform Support](https://img.shields.io/badge/Platforms-macOS%20%7C%20Windows%20%7C%20iOS%20%7C%20Android-06B6D4?style=for-the-badge)
![Realtime](https://img.shields.io/badge/Sync-SSE%20Realtime-10B981?style=for-the-badge)

> 📖 **Full Device Connection Guide**: Check out the **[SETUP_GUIDE.md](file:///Users/irfan/Documents/GitHub/DashBoard/SETUP_GUIDE.md)** for step-by-step instructions with examples for MacBook, Windows, iPhone, and Android.

---

## 🌟 Key Features

- **⚡ Real-Time Live Sync (SSE)**: Instant UI updates whenever a device reports battery or state changes.
- **🎨 Modern Dark Theme & Glassmorphism**: Translucent cards, liquid battery fill animations, glowing charging indicators, and dynamic state colors (Emerald Green >50%, Amber 20-50%, Crimson <20%, Cyan Charging).
- **📈 Fleet Battery Analytics**: 24-hour battery history chart (powered by Chart.js) with single-device or combined views.
- **🛡️ Native Zero-Bloat Clients**:
  - **macOS**: Built-in shell script reading `pmset -g batt` & `system_profiler SPPowerDataType` (reports cycles & capacity).
  - **Windows**: Built-in PowerShell script querying `Win32_Battery` via WMI/CIM.
  - **iOS**: Apple Shortcuts automation (`Get Battery Level` + `POST` to webhook).
  - **Android**: Termux script or MacroDroid/Tasker automation.
- **🎮 Built-In Live Simulator**: 1-click test simulator to preview live charging and battery drain animations before configuring physical devices.

---

## 🚀 Quick Start

### 1. Start the Dashboard Server
Run the lightweight Python server (zero external pip packages required):
```bash
python3 server/app.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser!

---

## 📲 Connecting Your Devices

### 1. 🍎 MacBook (macOS)
Run this command in Terminal to test reporting immediately:
```bash
./agents/macos/report_battery.sh http://YOUR_SERVER_IP:8080 macbook
```

**Auto-Sync Background Service (every 5 minutes):**
```bash
cp agents/macos/com.dashboard.battery.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.dashboard.battery.plist
```

---

### 2. 🪟 Windows PC
In Windows PowerShell (Run as Administrator or standard):
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\agents\windows\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER_IP:8080" -DeviceId "windows-laptop"
```

---

### 3. 📱 iOS (iPhone & iPad)
1. Open the **Shortcuts** app on your iPhone.
2. Create a new shortcut with actions:
   - **Get Battery Level**
   - **Get Details of Device** (Device Name)
   - **Get Contents of URL** &rarr; `POST http://YOUR_SERVER_IP:8080/api/report`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "device_id": "my-iphone",
       "name": "iPhone",
       "platform": "ios",
       "battery_level": 85
     }
     ```
3. Under **Automations**, trigger it when **Charger is Connected/Disconnected** or at scheduled intervals.
*See [SHORTCUT_GUIDE.md](agents/ios/SHORTCUT_GUIDE.md) for step-by-step instructions.*

---

### 4. 🤖 Android
- **MacroDroid / Tasker / HTTP Shortcuts**: Send an HTTP POST request to `http://YOUR_SERVER_IP:8080/api/report` on battery status change.
- **Termux**: Run `./agents/android/report_battery_termux.sh` with `termux-battery-status`.
*See [ANDROID_GUIDE.md](agents/android/ANDROID_GUIDE.md) for full instructions.*

---

## 🛠️ REST API Specification

### Report Battery Status
`POST /api/report`
```json
{
  "device_id": "macbook-pro",
  "name": "MacBook Pro 16\"",
  "platform": "macos",
  "model": "Apple M3 Pro",
  "battery_level": 85,
  "is_charging": false,
  "power_source": "Battery",
  "battery_health": "93% (Normal)",
  "cycle_count": 208,
  "cpu_usage": 14.2,
  "ram_usage": 58.4
}
```

### List Devices
`GET /api/devices`

### Device History
`GET /api/devices/{id}/history?hours=24`

### Live Event Stream
`GET /api/events` (Server-Sent Events)

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
├── public/
│   ├── index.html       # Modern semantic dashboard markup
│   ├── styles.css       # Dark theme, glassmorphism & glowing battery bars
│   └── app.js           # Realtime SSE client & Chart.js integration
├── server/
│   ├── app.py           # Threaded HTTP server, REST API & SSE streaming
│   ├── database.py      # SQLite schema and telemetry persistence
│   └── dashboard.db     # Local SQLite database
└── README.md
```
