# Statuser

Statuser is a self-hosted dashboard that tracks the battery level, CPU, RAM, and temperature of all your devices across macOS, Windows, Linux, iOS, and Android.

![Statuser Dashboard Screenshot](docs/screenshot.png) <!-- Update with actual screenshot later -->

## 🚀 Native Applications

Statuser provides native installable applications for all major platforms. The apps monitor your device in the background and report telemetry to your dashboard.

### 📱 Statuser Mobile (iOS & Android)

Built with React Native (Expo). Features a mini-dashboard and background sync.

- **iOS**: Uses Background Fetch (Note: iOS may throttle background execution for third party apps).
- **Android**: Full background sync and hardware monitoring.

**How to build/run:**
```bash
cd apps/mobile
npm install
npx expo start
```

### 💻 Statuser Desktop (macOS, Windows, Linux)

Built with Electron. Runs silently in your system tray/menu bar and monitors deep hardware metrics (Battery Health, CPU Usage, RAM Usage, Temperature).

**How to build/run:**
```bash
cd apps/desktop
npm install
npm run dev

# Package for your platform
npm run package
```

### Download Statuser 2.0

Installers are published on the [GitHub Releases page](https://github.com/crz02/DashBoard-For-AllDevices/releases):

- **macOS**: `.dmg` installer and `.zip` archive
- **Windows**: NSIS `.exe` installer, portable `.exe`, and `.zip`
- **Linux**: `.AppImage` (runs on common Linux distributions without a package manager)
- **Android**: signed `.apk` for sideloading

To publish the `v2.0.0` release, configure these repository Actions secrets with
the Android upload keystore used for signing the APK: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
Then push the `v2.0.0` tag. Keep the keystore and passwords safe; the same key
must be retained to sign future Android updates.

Windows packages are unsigned unless `WINDOWS_CSC_LINK` and
`WINDOWS_CSC_KEY_PASSWORD` are configured as Actions secrets, so Windows may
show a publisher warning.
For signed and notarized macOS installers, configure `MACOS_CSC_LINK`,
`MACOS_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and
`APPLE_TEAM_ID` as Actions secrets.
Only use newly issued signing certificates in these secrets. The old checked-in
certificate files have been removed from the current source; earlier Git
history may still contain copies, so revoke/rotate those certificates before
signing a release. Do not commit certificate or keystore files.

---

## 🛠️ Getting Started (The Dashboard Server)

To use the apps, you need to run the Statuser Dashboard Server.
The desktop installer also includes the server and dashboard files, but Python 3
must be installed on the computer to start the local server from the desktop app.

### 1. Start the Server

```bash
# Clone the repository
git clone https://github.com/crz02/DashBoard-For-AllDevices.git
cd DashBoard-For-AllDevices

# Start the server (Requires Python 3)
./start_server.sh
```

The dashboard will be available at `http://localhost:8080`.

### 2. Connect Your Devices

1. Open the Statuser App on your device (Desktop or Mobile).
2. Go to **Settings**.
3. Enter your Dashboard URL (e.g., `http://192.168.1.50:8080` for local network).
4. The device will instantly appear on your dashboard!

---

## 🌍 Accessing Over the Internet

If you want to track your devices while away from home (e.g., tracking your phone while on cellular data), your dashboard server needs a public URL.

We provide built-in support for **Cloudflare Tunnels** (Free, Secure, No Port Forwarding required).

See the [Setup Guide](SETUP_GUIDE.md) for full instructions on making your dashboard public.

---

## 🔒 Multi-User Support

Statuser supports multiple users on a single dashboard instance. 
In your App Settings, configure a **User ID**. Only devices sharing the same User ID will see each other in the dashboard.

---

## License

MIT
