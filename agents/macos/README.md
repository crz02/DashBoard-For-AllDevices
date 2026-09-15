# Statuser — macOS Agent

Report battery level, health, cycle count, CPU, and RAM from your Mac to the Statuser dashboard.

Works on **MacBook Air, MacBook Pro, iMac, Mac Mini, and Mac Pro** (desktops report as always-plugged-in).

---

## ⚡ Quick Start

### 1. Run Once (Test)

```bash
./agents/macos/report_battery.sh http://localhost:8080
```

Open your dashboard — your Mac appears immediately with live battery, health, and system stats.

### 2. Custom Device ID

```bash
./agents/macos/report_battery.sh http://localhost:8080 my-macbook
```

### 3. Multi-User Mode

If you use Statuser with authentication, pass your user ID:

```bash
./agents/macos/report_battery.sh http://localhost:8080 macbook --user-id user_abc123
```

---

## 🔄 Auto-Install (Background Reporting)

Install a macOS LaunchAgent that reports every 5 minutes automatically — no terminal window needed:

```bash
./agents/macos/report_battery.sh --install http://YOUR_DASHBOARD_URL
```

With a custom device ID and user:

```bash
./agents/macos/report_battery.sh --install http://localhost:8080 macbook-pro --user-id user_abc123
```

The installer:
- Creates a LaunchAgent at `~/Library/LaunchAgents/com.statuser.battery.plist`
- Starts immediately and runs every 5 minutes
- Survives reboots
- Logs to `/tmp/statuser_battery.log`

---

## 🗑️ Uninstall

```bash
./agents/macos/report_battery.sh --uninstall
```

This stops the background reporter and removes the LaunchAgent.

---

## 📡 What Gets Reported

| Field | Source | Example |
|---|---|---|
| Battery Level | `pmset -g batt` | `72%` |
| Charging Status | `pmset -g batt` | `true` / `false` |
| Power Source | `pmset -g batt` | `AC Power` / `Battery` |
| Battery Health | `system_profiler SPPowerDataType` | `87% (Normal)` |
| Cycle Count | `system_profiler SPPowerDataType` | `342` |
| CPU Usage | `top -l 1` | `12.5%` |
| RAM Usage | `vm_stat` | `67.2%` |
| Model | `sysctl hw.model` | `MacBookPro18,1` |

---

## 🖥️ Desktop Macs (No Battery)

If your Mac has no internal battery (iMac, Mac Mini, Mac Pro, Mac Studio), the agent reports:
- Battery Level: `100%`
- Charging: `true`
- Power Source: `AC Power (Desktop)`

CPU and RAM metrics are still reported normally.

---

## 🛠️ Requirements

- **macOS 10.15+** (Catalina or newer)
- `bash`, `curl`, `pmset`, `system_profiler` — all pre-installed on macOS
- No `pip install`, no `brew install`, no third-party dependencies

---

## 📋 Manual LaunchAgent Setup

If you prefer to set up the LaunchAgent manually instead of using `--install`:

1. Edit `com.dashboard.battery.plist` in this folder
2. Replace the script path and dashboard URL
3. Copy and load:

```bash
cp agents/macos/com.dashboard.battery.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.dashboard.battery.plist
```

To stop:
```bash
launchctl unload ~/Library/LaunchAgents/com.dashboard.battery.plist
```
