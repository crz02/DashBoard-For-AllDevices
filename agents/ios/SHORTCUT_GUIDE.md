# iOS (iPhone & iPad) Setup Guide

Track your iPhone or iPad battery percentage effortlessly on your Dashboard using Apple's native **Shortcuts** app. No third-party apps or jailbreaks are required!

---

## ⚡ Method 1: 60-Second Setup via Apple Shortcuts App

### Step 1: Create the Shortcut
1. Open the **Shortcuts** app on your iPhone or iPad.
2. Tap the **`+`** icon at the top right to create a new shortcut.
3. Tap **Add Action** and search for **"Get Battery Level"**.
4. Tap **Add Action** again and search for **"Get Details of Device"** (select **Device Name**).
5. Tap **Add Action** and search for **"Dictionary"**. Add the following keys:
   - `device_id`: `iphone` (or any unique ID you choose)
   - `name`: Select the variable **Device Name** from step 4
   - `platform`: `ios`
   - `battery_level`: Select the variable **Battery Level** from step 3
   - `is_charging`: `false` (or set up separate automations for charging)
6. Tap **Add Action** and search for **"Get Contents of URL"**:
   - Tap on the URL field and enter: `http://YOUR_DASHBOARD_IP:8080/api/report`
   - Tap the dropdown / arrow to expand options:
     - **Method**: `POST`
     - **Headers**: Add `Content-Type`: `application/json`
     - **Request Body**: Select `Dictionary` (the dictionary from step 5)
7. Name the shortcut **"Report Battery"** and tap **Done**.

---

## 🔄 Step 2: Automate Background Updates (Set-and-Forget)

In the **Shortcuts** app, switch to the **Automation** tab at the bottom:

### 1. Charger Connected / Disconnected (Instant Battery & Charge State)
1. Tap **New Automation** -> **Charger**.
2. Select **Is Connected** (and also create a second one for **Is Disconnected**).
3. Select **Run Immediately** (toggle off *Notify When Run* for silent execution).
4. Under *Actions*, choose your **"Report Battery"** shortcut.

### 2. Periodic Updates (Time of Day or Battery Changes)
1. In Automations, tap **Battery Level**.
2. Select **Falls Below 20%** or **Rises Above 50%**.
3. Select **Run Immediately** and link to **"Report Battery"**.
4. *(Optional)* Add a daily or morning schedule under **Time of Day** to wake and ping the dashboard!

---

## 🧪 Testing From iPhone
Tap the **Report Battery** shortcut once. Check your dashboard—your iPhone card will instantly appear with live battery percentage!
