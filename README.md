# Statuser

Statuser is a self-hosted dashboard that tracks the battery level, CPU, RAM, and temperature of all your devices across macOS, Windows, Linux, iOS, and Android.

![Statuser Dashboard Screenshot](docs/screenshot.png) <!-- Update with actual screenshot later -->

## 🚀 Native Applications

Statuser provides native installable applications for all major platforms. The apps monitor your device in the background and report telemetry to your dashboard.

### 📱 Statuser Mobile (iOS & Android)

Built with React Native (Expo). Features a mini-dashboard and background sync.

- **iOS**: Uses Background Fetch (Note: iOS may throttle background execution. For guaranteed exact-minute updates, see the [Shortcuts Automation Guide](agents/ios/README.md)).
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

---

## 🛠️ Getting Started (The Dashboard Server)

To use the apps, you need to run the Statuser Dashboard Server.

### 1. Start the Server

```bash
# Clone the repository
git clone https://github.com/yourusername/Statuser.git
cd Statuser

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

## 🖥️ Headless Agents (Alternative for Servers)

If you want to monitor a headless Linux server or prefer not to install a GUI app, we provide lightweight shell script agents.

- [Linux Agent Guide](agents/linux/README.md) (systemd/cron)
- [macOS Agent Guide](agents/macos/README.md) (LaunchAgent)
- [Windows Agent Guide](agents/windows/README.md) (Scheduled Task)
- [Android Termux Guide](agents/android/README.md) (cron)

---

## 🔒 Multi-User Support

Statuser supports multiple users on a single dashboard instance. 
In your App Settings, configure a **User ID**. Only devices sharing the same User ID will see each other in the dashboard.

---

## License

MIT
