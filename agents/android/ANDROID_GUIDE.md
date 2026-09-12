# Android Setup Guide

Connect your Android phone or tablet to the Dashboard with real-time battery percentage, charging state, and temperature over cellular 5G/4G or Wi-Fi.

---

## 🌐 Endpoint URLs

- **Public HTTPS Webhook**: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`
- *(Or local address when on the same Wi-Fi: `http://192.168.29.20:8080/api/report`)*

---

## 🚀 Option 1: MacroDroid / Tasker (No Coding, Recommended)

1. Install **MacroDroid** (Free from Google Play Store).
2. Tap **Add Macro**:
   - **Triggers**:
     - *Battery / Power* &rarr; **Power Connected / Disconnected**
     - *(Optional)* *Battery / Power* &rarr; **Battery Level** (e.g. Falls below 20%)
   - **Actions**:
     - *Connectivity* &rarr; **HTTP Request**:
       - **Method**: `POST`
       - **URL**: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`
       - **Content-Type**: `application/json`
       - **Request Body (JSON)**:
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
3. Save the macro and toggle it **ON**.

---

## 💻 Option 2: Termux with Termux:API

1. Install **Termux** and **Termux:API** from F-Droid.
2. In Termux, install dependencies:
   ```bash
   pkg update && pkg install termux-api jq curl
   ```
3. Download the reporting script:
   ```bash
   curl -sSL https://raw.githubusercontent.com/crz02/DashBoard/main/agents/android/report_battery_termux.sh -o report.sh
   chmod +x report.sh
   ./report.sh https://bee-adaptive-legend-poor.trycloudflare.com my-android "Galaxy Phone"
   ```
4. Schedule in crontab (`pkg install cronie` &rarr; `crontab -e`):
   ```cron
   */5 * * * * /data/data/com.termux/files/home/report.sh https://bee-adaptive-legend-poor.trycloudflare.com my-android >/dev/null 2>&1
   ```
