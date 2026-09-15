# Statuser — Android Agent

> [!TIP]
> **Prefer a visual app?** Statuser now has a full native mobile app for Android. Check out [Statuser Mobile](../../README.md#mobile). This Termux script remains available as a lightweight, headless alternative.

Report battery level, temperature, and health to your Statuser dashboard using Termux.

## Prerequisites

1. Install [Termux](https://f-droid.org/en/packages/com.termux/) from F-Droid (Do not use the Google Play Store version).
2. Install [Termux:API](https://f-droid.org/en/packages/com.termux.api/) from F-Droid.
3. Open Termux and run:
   ```bash
   pkg update && pkg install termux-api jq curl cronie
   ```

## Quick Start

```bash
./agents/android/report_battery_termux.sh http://YOUR_SERVER_IP:8080 my-android "My Phone"
```

## Auto-Install (Background Cron)

```bash
./agents/android/report_battery_termux.sh --install http://YOUR_SERVER_IP:8080 my-android "My Phone"
```

This installs a cron job that reports your battery every 5 minutes automatically in the background.

## Uninstall

```bash
./agents/android/report_battery_termux.sh --uninstall
```
