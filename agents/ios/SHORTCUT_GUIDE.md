# iOS (iPhone & iPad) Setup Guide

Track your iPhone or iPad battery percentage effortlessly on your Dashboard using Apple's native **Shortcuts** app. No third-party apps, profiles, or jailbreaks required!

---

## ⚡ Important: Why Public HTTPS is Required for iOS
Apple iOS enforces **App Transport Security (ATS)**. iOS blocks background network requests sent to insecure local `http://192.168.x.x` addresses.
Therefore, you must use a secure **HTTPS** URL.

- **Current Active HTTPS URL**: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`
- *(Or your permanent Vercel URL, e.g. `https://your-dashboard.vercel.app/api/report`)*

---

## 📲 Step 1: Create the Shortcut (60 Seconds)

1. Open the **Shortcuts** app on your iPhone or iPad.
2. Tap the **`+`** icon at the top right to create a new shortcut.
3. Tap **Add Action** &rarr; search for **"Get Battery Level"**.
4. Tap **Add Action** &rarr; search for **"Get Details of Device"** (select **Device Name**).
5. Tap **Add Action** &rarr; search for **"Dictionary"**. Add the following keys:
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
     - **Request Body**: Select `Dictionary` (the dictionary from step 5)
7. Name the shortcut **"Report Battery"** and tap **Done**.

---

## 🔄 Step 2: Automate Background Updates (Set-and-Forget)

In the **Shortcuts** app, switch to the **Automation** tab at the bottom:

### 1. Charger Connected / Disconnected (Real-Time Battery & State)
1. Tap **New Automation** &rarr; select **Charger**.
2. Check **Is Connected** and **Is Disconnected**.
3. Select **Run Immediately** (toggle OFF *Notify When Run* so it runs completely silently).
4. Under *Actions*, choose your **"Report Battery"** shortcut.

### 2. Battery Level Drop Warning
1. In Automations, tap **Battery Level**.
2. Select **Falls Below 20%**.
3. Select **Run Immediately** and link to **"Report Battery"**.

---

## 🧪 Testing From iPhone
1. Tap the **Report Battery** shortcut once in the Shortcuts app.
2. Open your dashboard at **[https://bee-adaptive-legend-poor.trycloudflare.com](https://bee-adaptive-legend-poor.trycloudflare.com)** or on your Mac at `http://localhost:8080`.
3. Your iPhone card will instantly appear with live battery percentage and status!
