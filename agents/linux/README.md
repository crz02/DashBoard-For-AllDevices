# Statuser — Linux Agent

Report battery level, health, CPU, RAM, and temperature from your Linux machine to the Statuser dashboard.

Works on **Ubuntu, Fedora, Debian, Arch Linux, Pop!_OS, Mint**, and any Linux distribution with `/sys/class/power_supply/`. Desktops and servers without batteries report as always-plugged-in.

---

## ⚡ Quick Start

### 1. Run Once (Test)

```bash
./agents/linux/report_battery.sh http://localhost:8080
```

Open your dashboard — your Linux device appears with battery, CPU, and RAM stats.

### 2. Custom Device ID

```bash
./agents/linux/report_battery.sh http://localhost:8080 my-thinkpad
```

### 3. Multi-User Mode

```bash
./agents/linux/report_battery.sh http://localhost:8080 linux-laptop --user-id user_abc123
```

---

## 🔄 Auto-Install (systemd Timer)

Install a systemd user timer that reports every 5 minutes automatically:

```bash
./agents/linux/report_battery.sh --install http://YOUR_DASHBOARD_URL
```

With a custom device ID and user:

```bash
./agents/linux/report_battery.sh --install http://localhost:8080 thinkpad-x1 --user-id user_abc123
```

The installer:
- Creates `~/.config/systemd/user/statuser-battery.service` and `.timer`
- Starts 30 seconds after boot, then every 5 minutes
- Runs as your user (no root needed)
- Survives reboots

### Check Status

```bash
systemctl --user status statuser-battery.timer
```

### View Logs

```bash
journalctl --user -u statuser-battery.service -f
```

---

## 🗑️ Uninstall

```bash
./agents/linux/report_battery.sh --uninstall
```

This stops and removes the systemd timer and service.

---

## 📡 What Gets Reported

| Field | Source | Example |
|---|---|---|
| Battery Level | `/sys/class/power_supply/BAT0/capacity` | `72%` |
| Charging Status | `/sys/class/power_supply/BAT0/status` | `Charging` / `Discharging` |
| Power Source | Derived from status | `AC Power` / `Battery` |
| Battery Health | `energy_full` / `energy_full_design` | `87%` |
| CPU Usage | `/proc/stat` (sampled) | `15.3%` |
| RAM Usage | `/proc/meminfo` | `62.1%` |
| Temperature | Battery temp or `sensors` | `38.5°C` |
| Model | `/etc/os-release` | `Ubuntu 24.04 LTS` |

---

## 🖥️ Desktops & Servers (No Battery)

Machines without a battery in `/sys/class/power_supply/BAT*` report:
- Battery Level: `100%`
- Charging: `true`
- Power Source: `AC Power (Desktop)`

CPU, RAM, and temperature are still reported normally.

---

## 🛠️ Requirements

- **Linux** with `/proc` and `/sys` filesystems (virtually all distros)
- `bash`, `curl`, `bc`, `awk`, `grep` — standard on most Linux systems
- If `bc` is missing: `sudo apt install bc` or `sudo dnf install bc`
- No Python, no pip, no Node.js

---

## 📋 Alternative: Cron Setup

If you prefer cron over systemd:

```bash
# Edit crontab
crontab -e

# Add this line (reports every 5 minutes):
*/5 * * * * /path/to/agents/linux/report_battery.sh http://YOUR_DASHBOARD_URL linux-laptop >/dev/null 2>&1
```

---

## 📋 Manual systemd Setup

Template files are provided in this folder:
- `statuser-battery.service` — service unit
- `statuser-battery.timer` — timer unit

Copy to `~/.config/systemd/user/`, edit the `ExecStart` path, then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now statuser-battery.timer
```
