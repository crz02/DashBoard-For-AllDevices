# Statuser — iOS Agent (iPhone & iPad)

Track your iPhone or iPad battery on the Statuser dashboard using Apple's native **Shortcuts** app. No third-party apps, profiles, or jailbreaks required.

---

## ⚠️ HTTPS Required for iOS

Apple iOS enforces **App Transport Security (ATS)** — background network requests to insecure `http://` addresses are blocked. You need one of these:

1. **Cloudflare Tunnel** (free): Run `./scripts/start_public_tunnel.sh` on the server machine to get a public `https://` URL
2. **Tailscale** (free): Install on both devices — use the Tailscale IP
3. **Cloud Deployment**: Deploy to Vercel for a permanent `https://` URL (see `cloud/CLOUD_DEPLOY_GUIDE.md`)

> **For local testing only**: If your server is on the same Wi-Fi, iOS Shortcuts can sometimes use `http://` when triggered manually (not in background automations).

---

## 📲 Step 1: Create the Shortcut (~60 seconds)

1. Open the **Shortcuts** app on your iPhone or iPad
2. Tap the **`+`** icon to create a new shortcut
3. Add these actions in order:

### Action 1: Get Battery Level
- Search for **"Get Battery Level"** → tap to add

### Action 2: Get Device Name
- Search for **"Get Details of Device"** → select **Device Name**

### Action 3: Create Dictionary
- Search for **"Dictionary"** → add these keys:

| Key | Type | Value |
|---|---|---|
| `device_id` | Text | `iphone` (or any ID you want) |
| `name` | Variable | Select **Device Name** from Step 2 |
| `platform` | Text | `ios` |
| `battery_level` | Variable | Select **Battery Level** from Step 1 |
| `is_charging` | Boolean | `false` |

### Action 4: Send to Dashboard
- Search for **"Get Contents of URL"**
- **URL**: `https://YOUR_DASHBOARD_URL/api/report`
- Tap the arrow to expand options:
  - **Method**: `POST`
  - **Headers**: Add `Content-Type` = `application/json`
  - **Request Body**: Choose **Dictionary** (from Step 3)

4. Name the shortcut **"Report Battery"** → tap **Done**

---

## 🔄 Step 2: Automate Background Updates

In the Shortcuts app, switch to the **Automation** tab:

### Charger Connected / Disconnected (Recommended)
1. Tap **New Automation** → select **Charger**
2. Check both **Is Connected** and **Is Disconnected**
3. Choose **Run Immediately** (turn off *Notify When Run* for silent operation)
4. Under actions, select your **"Report Battery"** shortcut

### Battery Level Drop Warning (Optional)
1. Tap **New Automation** → **Battery Level**
2. Select **Falls Below 20%**
3. Choose **Run Immediately** → link to **"Report Battery"**

### Time of Day (Optional)
1. Tap **New Automation** → **Time of Day**
2. Set to run at e.g. 9:00 AM and 6:00 PM
3. Link to **"Report Battery"**

> With Charger automation, your dashboard updates every time you plug or unplug your phone.

---

## 🧪 Testing

1. Open the **Shortcuts** app
2. Tap your **"Report Battery"** shortcut once
3. Open your Statuser dashboard
4. Your iPhone/iPad should appear immediately with live battery data

---

## 🔧 Multi-User Mode

To associate your device with a specific user account, add a query parameter to the URL in Step 4:

```
https://YOUR_DASHBOARD_URL/api/report?user_id=YOUR_USER_ID
```

Or add an `X-User-Id` header in the **Get Contents of URL** action.

---

## 📡 What Gets Reported

| Field | Value |
|---|---|
| Battery Level | From `Get Battery Level` action |
| Device Name | From `Get Details of Device` |
| Platform | `ios` |
| Charging Status | Set manually or use `Get Battery State` |

> **Note**: iOS Shortcuts has limited access to system metrics. Battery level and charging state are the primary data points. CPU/RAM are not available through Shortcuts.

---

## ❓ Troubleshooting

| Issue | Solution |
|---|---|
| "Could not connect to server" | Make sure you're using an `https://` URL, not `http://` |
| Automation doesn't run silently | Make sure "Notify When Run" is turned OFF |
| Shortcut works manually but not in automation | iOS requires HTTPS for background network requests |
| Battery level not updating | Check that the Charger automation is enabled |
