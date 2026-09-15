# Statuser Setup Guide

This guide covers how to set up your Statuser Dashboard Server and connect your devices securely.

---

## 1. Local Network Setup (Quickest)

If you only want to monitor devices while they are connected to your home Wi-Fi network, this is the easiest method.

### Step 1: Start the Dashboard Server
Run this on a computer that stays on at home (like a Mac, PC, or Raspberry Pi).

```bash
git clone https://github.com/yourusername/Statuser.git
cd Statuser
./start_server.sh
```

### Step 2: Find Your Local IP Address
On the computer running the server, find its local network IP address (e.g., `192.168.1.50`).
- **macOS/Linux**: Run `ifconfig` or `ip a`
- **Windows**: Run `ipconfig`

### Step 3: Configure Your Apps
1. Open the Statuser Mobile or Desktop app on your other devices.
2. Go to **Settings**.
3. Set the Dashboard URL to: `http://YOUR_LOCAL_IP:8080` (e.g., `http://192.168.1.50:8080`)
4. Your devices will now report to the dashboard as long as they are on the same Wi-Fi.

---

## 2. Public Access Setup (Recommended)

If you want your mobile devices to report their battery even when you leave your house (using cellular data), your dashboard needs a public URL.

We recommend using **Cloudflare Tunnels**. It is free, secure, provides an `https://` URL, and doesn't require opening ports on your home router.

### Step 1: Start the Public Tunnel

While your server (`./start_server.sh`) is running in one terminal window, open a second terminal window and run:

```bash
./scripts/start_public_tunnel.sh
```

This script will download Cloudflare (`cloudflared`) and generate a unique, public URL for you (e.g., `https://your-random-words.trycloudflare.com`).

### Step 2: Configure Your Apps

1. Copy the `https://` URL provided by the tunnel script.
2. Open the Statuser App on your devices.
3. Go to **Settings**.
4. Set the Dashboard URL to your new public URL.
5. Your devices can now report their battery from anywhere in the world!

> **Note**: Cloudflare Quick Tunnels (the free version without an account) expire when you stop the script. If you want a permanent URL, you need to sign up for a free Cloudflare account and configure a permanent tunnel with your own domain name.

---

## 3. Alternative: Tailscale (VPN)

If you use [Tailscale](https://tailscale.com/) to connect your devices, you can simply use the Tailscale IP address of your server.

1. Install Tailscale on the server and on your mobile/desktop devices.
2. In the Statuser App settings, set the Dashboard URL to `http://YOUR_TAILSCALE_IP:8080`.
3. This provides secure, anywhere access without exposing your server to the public internet.

---

## Troubleshooting

**My device isn't showing up on the dashboard:**
1. Check that the Dashboard URL in the app settings does *not* have a trailing slash or `/api/report` at the end. It should just be the base URL (e.g., `http://192.168.1.50:8080`).
2. Make sure you entered the same **User ID** in the app settings that you are using to view the dashboard. If you left it blank in the app, it defaults to the `default` user.

**The mobile app background sync isn't working (iOS):**
iOS restricts how often third-party apps can run in the background to save battery. The app will sync immediately when you open it.
