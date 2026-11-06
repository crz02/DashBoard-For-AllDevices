# Statuser

**Your devices. One clear view.** Statuser is a self-hosted dashboard for monitoring battery and system health across your devices. It brings battery level, charging state, CPU, memory, temperature, and device history together in one place.

The dashboard runs on a server you control. Connect desktop and mobile apps over your local network, or use a secure tunnel when you need access away from home.

**Landing page:** [crz02.github.io/Statuser](https://crz02.github.io/Statuser/)

## Download Statuser 2.0

The latest installers are available on the [Statuser 2.0.0 release page](https://github.com/crz02/DashBoard-For-AllDevices/releases/tag/v2.0.0).

| Platform | Installer |
| --- | --- |
| macOS (Apple Silicon) | [DMG](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-2.0.0-mac-arm64.dmg) · [ZIP](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-2.0.0-mac-arm64.zip) |
| Windows (x64) | [Setup](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-Setup-2.0.0.exe) · [Portable](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-Portable-2.0.0.exe) · [ZIP](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-2.0.0-win.zip) |
| Linux (x64) | [AppImage](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-2.0.0-linux-x86_64.AppImage) |
| Android | [APK](https://github.com/crz02/DashBoard-For-AllDevices/releases/download/v2.0.0/Statuser-2.0.0-android.apk) |

The desktop app is available for macOS, Windows, and Linux. The Android APK can be sideloaded. The iOS app is available to run or build from source with Expo; an iOS App Store installer is not currently published.

Windows packages are unsigned and may show a publisher warning. The macOS package is built for Apple Silicon and is not signed or notarized.

## Quick start

### 1. Start the dashboard server

The server requires Python 3. Clone the repository and start it on a computer that can stay online:

```bash
git clone https://github.com/crz02/DashBoard-For-AllDevices.git
cd DashBoard-For-AllDevices
./start_server.sh
```

Open the **landing page** at [http://localhost:8080](http://localhost:8080) or the **dashboard** at [http://localhost:8080/dashboard](http://localhost:8080/dashboard).

### 2. Connect your devices

1. Install and open the Statuser app on each device.
2. In **Settings**, enter the server address, such as `http://192.168.1.50:8080`.
3. Use the same **User ID** on devices you want to see together.
4. Open `/dashboard` on the server to view the connected devices.

For access outside your local network, follow the [setup guide](SETUP_GUIDE.md) for Cloudflare Tunnels or Tailscale.

## Features

- One view of connected devices, their battery level, charging state, CPU, memory, and temperature.
- Device and metric history with live dashboard updates.
- Native desktop apps for macOS, Windows, and Linux, plus a React Native mobile app for iOS and Android.
- Self-hosted server using Python and SQLite.
- Optional multi-user views, with devices grouped by User ID.

## Build from source

### Desktop

```bash
cd apps/desktop
npm ci
npm run dev
```

Package for the current platform with `npm run package`, or use `npm run package:mac`, `npm run package:win`, or `npm run package:linux`.

### Mobile

```bash
cd apps/mobile
npm ci
npx expo start
```

See the [setup guide](SETUP_GUIDE.md) for server networking, public access, and troubleshooting.

## License

MIT
