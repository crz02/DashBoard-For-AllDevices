# Android Setup Guide

Connect your Android phone or tablet to the Dashboard with real-time battery percentage, charging state, and temperature.

---

## 🚀 Option 1: MacroDroid / Tasker / HTTP Shortcuts (No coding required)

1. Install **MacroDroid** or **Tasker** or **HTTP Shortcuts** from Google Play or F-Droid.
2. Create a new trigger:
   - **Trigger**: Power Connected / Disconnected OR Battery Level Drops Below 20% OR Periodic (every 15 mins).
3. Create an **Action**: **HTTP Request**:
   - **Method**: `POST`
   - **URL**: `http://YOUR_SERVER_IP:8080/api/report`
   - **Content-Type**: `application/json`
   - **Body (JSON)**:
     ```json
     {
       "device_id": "my-android",
       "name": "Samsung Galaxy",
       "platform": "android",
       "battery_level": {battery_level},
       "is_charging": {power_connected},
       "power_source": "{power_source}"
     }
     ```
4. Save and turn on the macro.

---

## 💻 Option 2: Termux with Termux:API

1. Install **Termux** and **Termux:API** from F-Droid.
2. In Termux, install dependencies:
   ```bash
   pkg update && pkg install termux-api jq curl
   ```
3. Copy or curl the reporting script:
   ```bash
   curl -sSL http://YOUR_SERVER_IP:8080/agents/android/report_battery_termux.sh -o report.sh
   chmod +x report.sh
   ./report.sh http://YOUR_SERVER_IP:8080 my-android "My Galaxy Phone"
   ```
4. Schedule in crontab (`pkg install cronie` -> `crontab -e`):
   ```cron
   */5 * * * * /data/data/com.termux/files/home/report.sh http://YOUR_SERVER_IP:8080 my-android >/dev/null 2>&1
   ```
