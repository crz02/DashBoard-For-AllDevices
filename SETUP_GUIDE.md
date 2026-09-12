# Device Setup & Installation Guide

This guide walks you through downloading, setting up, and connecting all your devices (**MacBook**, **Windows PC**, **iPhone / iPad**, and **Android**) to your central Battery Dashboard.

---

## 🧭 How It Works

1. **The Server**: Hosts your dashboard and a secure, public HTTPS reporting webhook.
2. **Public HTTPS Everywhere**: We use a Cloudflare public HTTPS endpoint so your devices do **NOT** need to be on the same Wi-Fi and do **NOT** need local IP addresses.
   - **Active Public URL**: `https://bee-adaptive-legend-poor.trycloudflare.com`
   - **Local Web UI**: `http://localhost:8080`
   - *(For permanent 24/7 cloud hosting without running your computer, see [cloud/CLOUD_DEPLOY_GUIDE.md](file:///Users/irfan/Documents/GitHub/DashBoard/cloud/CLOUD_DEPLOY_GUIDE.md)).*

---

## Part 1: Start the Dashboard Server

### 1. Download / Clone the Project
```bash
git clone https://github.com/crz02/DashBoard.git
cd DashBoard
```

### 2. Start the Server
Python 3 is already built into macOS and Linux, and standard on Windows. No extra pip packages are required:
```bash
python3 server/app.py
```
Your dashboard is now running at:
- **Local machine**: [http://localhost:8080](http://localhost:8080)
- **Other devices on your Wi-Fi**: `http://YOUR_LOCAL_IP:8080` (Find your IP: run `ipconfig getifaddr en0` on Mac or `ipconfig` on Windows).

*(To keep the server running permanently in the background on Mac, see Appendix below).*

---

## Part 2: Connect Your Devices

---

### 🍎 1. MacBook (macOS)

#### Step 1: Run a Test
In your Mac Terminal, run:
```bash
./agents/macos/report_battery.sh http://localhost:8080 macbook
```
Open [http://localhost:8080](http://localhost:8080) — your MacBook will appear immediately with live battery %, cycles, health, and CPU/RAM!

#### Step 2: Auto-Sync in the Background (Every 5 minutes)
To make your MacBook report automatically in the background without keeping a terminal window open:

1. Open `agents/macos/com.dashboard.battery.plist` in a text editor.
2. Replace `/Users/YOUR_USERNAME/DashBoard/agents/macos/report_battery.sh` with the full path to your script (run `pwd` inside the DashBoard folder to see your path).
3. Copy the file into your LaunchAgents folder and start it:
   ```bash
   cp agents/macos/com.dashboard.battery.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.dashboard.battery.plist
   ```
*Your Mac will now silently update the dashboard every 5 minutes.*

---

### 🪟 2. Windows PC / Laptop

#### Step 1: Copy the Script to Windows
Copy the file `agents/windows/report_battery.ps1` to your Windows PC (e.g., to `C:\Scripts\report_battery.ps1`).

#### Step 2: Test via PowerShell
Open PowerShell on your Windows PC and run:
```powershell
powershell.exe -ExecutionPolicy Bypass -File C:\Scripts\report_battery.ps1 -DashboardUrl "https://bee-adaptive-legend-poor.trycloudflare.com" -DeviceId "windows-pc"
```

#### Step 3: Run Automatically via Windows Task Scheduler
To schedule it to run every 5 minutes silently:
1. Open PowerShell as Administrator and run:
   ```powershell
   $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Scripts\report_battery.ps1 -DashboardUrl https://bee-adaptive-legend-poor.trycloudflare.com -DeviceId windows-pc"
   $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
   Register-ScheduledTask -TaskName "DashboardBatteryReport" -Action $action -Trigger $trigger -Description "Reports battery to dashboard"
   ```

---

### 📱 3. iOS (iPhone & iPad)

No apps or downloads needed! iOS has built-in webhook capability through Apple's native **Shortcuts** app.

#### Step 1: Create the Shortcut (Takes 60 seconds)
1. Open the **Shortcuts** app on your iPhone or iPad.
2. Tap the **`+`** icon at the top right to create a new shortcut.
3. Tap **Add Action** &rarr; search for **"Get Battery Level"**.
4. Tap **Add Action** &rarr; search for **"Get Details of Device"** &rarr; select **Device Name**.
5. Tap **Add Action** &rarr; search for **"Dictionary"** and add these keys:
   - `device_id` (Text) &rarr; `iphone`
   - `name` &rarr; Select the variable **Device Name**
   - `platform` (Text) &rarr; `ios`
   - `battery_level` &rarr; Select the variable **Battery Level**
   - `is_charging` (Boolean) &rarr; `false`
6. Tap **Add Action** &rarr; search for **"Get Contents of URL"**:
   - URL: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`
   - Tap the arrow next to URL to expand options:
     - **Method**: `POST`
     - **Headers**: Add `Content-Type` with value `application/json`
     - **Request Body**: Select `Dictionary` (the dictionary created in Step 5)
7. Name the shortcut **"Report Battery"** and tap **Done**.

#### Step 2: Set Up Automated Background Updates
In the Shortcuts app, tap the **Automation** tab at the bottom:
1. Tap **New Automation** &rarr; select **Charger**.
2. Check **Is Connected** and **Is Disconnected**.
3. Choose **Run Immediately** (turn off *Notify When Run* so it runs silently).
4. Under actions, select your **Report Battery** shortcut.
5. *(Optional)* Add a second automation for **Battery Level** (e.g. *When battery falls below 20%*).

Whenever you plug or unplug your phone, your dashboard updates in real time!

---

### 🤖 4. Android (Phone & Tablet)

You have two easy options on Android:

#### Option A: MacroDroid / Tasker (Visual, No Coding)
1. Install **MacroDroid** (Free from Google Play Store).
2. Tap **Add Macro**:
   - **Triggers**:
     - Power Connected / Disconnected
     - OR Battery Level Change (e.g. every 10% or below 20%)
     - OR Regular Interval (e.g. every 15 minutes)
   - **Actions**:
     - Add action &rarr; **Connectivity** &rarr; **HTTP Request**
     - Method: `POST`
     - URL: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`
     - Content-Type: `application/json`
     - Body:
       ```json
       {
         "device_id": "my-android",
         "name": "Galaxy Phone",
         "platform": "android",
         "battery_level": {battery_level},
         "is_charging": {power_connected}
       }
       ```
3. Save the macro and toggle it ON.

#### Option B: Termux (CLI / Scripting)
1. Install **Termux** and **Termux:API** from F-Droid.
2. In Termux, run:
   ```bash
   pkg install termux-api jq curl
   ```
3. Run the script:
   ```bash
   curl -sSL https://raw.githubusercontent.com/crz02/DashBoard/main/agents/android/report_battery_termux.sh -o report.sh
   chmod +x report.sh
   ./report.sh https://bee-adaptive-legend-poor.trycloudflare.com my-android "Samsung Galaxy"
   ```

---

## 🌐 Tracking While Away from Home Wi-Fi

If you want your phone or laptop to report battery levels when you are away from home:

1. **Tailscale (Recommended & Free)**:
   - Install Tailscale on your host machine and mobile devices.
   - Use the Tailscale 100.x.x.x IP address in your scripts and shortcuts instead of `192.168.x.x`. It works securely from anywhere in the world!
2. **Cloudflare Tunnel (Free)**:
   - Run `cloudflared tunnel` on your computer to get a free secure HTTPS URL (e.g., `https://battery.yourdomain.com`).
   - Use that HTTPS URL in all your devices.

---

## 🛠️ Appendix: Running Server in Background on Mac

To keep the Python server running permanently in the background even if you close the terminal:
```bash
nohup python3 server/app.py > /tmp/dashboard_server.log 2>&1 &
```
To stop it later:
```bash
pkill -f "python3 server/app.py"
```
