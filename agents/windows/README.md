# Statuser — Windows Agent

Report battery level, CPU, and RAM from your Windows PC or laptop to the Statuser dashboard.

Works on **Windows 10/11** laptops and desktops. Desktops without batteries report as always-plugged-in.

---

## ⚡ Quick Start

### 1. Run Once (Test)

Open **PowerShell** and run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\agents\windows\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER_IP:8080"
```

Open your dashboard — your Windows device appears immediately.

### 2. Custom Device ID

```powershell
.\agents\windows\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER_IP:8080" -DeviceId "work-laptop"
```

### 3. Multi-User Mode

```powershell
.\agents\windows\report_battery.ps1 -DashboardUrl "http://YOUR_SERVER_IP:8080" -UserId "user_abc123"
```

---

## 🔄 Auto-Install (Scheduled Task)

Install a Windows Scheduled Task that reports every 5 minutes automatically:

```powershell
.\agents\windows\report_battery.ps1 -DashboardUrl "http://YOUR_DASHBOARD_URL" -Install
```

With a custom device ID and user:

```powershell
.\agents\windows\report_battery.ps1 -DashboardUrl "http://localhost:8080" -DeviceId "gaming-pc" -UserId "user_abc123" -Install
```

The installer:
- Creates a scheduled task named `StatuserBatteryReport`
- Runs every 5 minutes in the background (hidden window)
- Continues on battery power
- Survives reboots

> **Note**: You may need to run PowerShell as **Administrator** to create the scheduled task.

---

## 🗑️ Uninstall

```powershell
.\agents\windows\report_battery.ps1 -Uninstall
```

This removes the scheduled task and stops background reporting.

---

## 📡 What Gets Reported

| Field | Source | Example |
|---|---|---|
| Battery Level | `Win32_Battery` (CIM) | `72%` |
| Charging Status | `Win32_Battery.BatteryStatus` | `true` / `false` |
| Power Source | Derived from status | `AC Power` / `Battery` |
| Battery Health | Default | `Good` |
| CPU Usage | `Win32_Processor.LoadPercentage` | `18.5%` |
| RAM Usage | `Win32_OperatingSystem` | `61.3%` |
| Model | `Win32_ComputerSystem` | `Dell XPS 15 9520` |

---

## 🖥️ Desktop PCs (No Battery)

Desktop PCs without a battery report:
- Battery Level: `100%`
- Charging: `true`
- Power Source: `AC Power (Desktop)`

CPU and RAM metrics are still reported normally.

---

## 🛠️ Requirements

- **Windows 10 or 11**
- **PowerShell 5.1+** (pre-installed on Windows 10/11)
- No additional software or packages needed

---

## 📋 Manual Scheduled Task Setup

If you prefer using Task Scheduler GUI:

1. Open **Task Scheduler** (`taskschd.msc`)
2. Click **Create Basic Task**
3. Name: `StatuserBatteryReport`
4. Trigger: **Daily**, repeat every **5 minutes**
5. Action: **Start a Program**
   - Program: `powershell.exe`
   - Arguments: `-WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\path\to\report_battery.ps1" -DashboardUrl "http://YOUR_SERVER:8080"`
6. Check **Run whether user is logged on or not**
