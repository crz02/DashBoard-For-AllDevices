# Cloud Architecture & Remote Sync Guide

Statuser supports two cloud-first approaches to eliminate local IP restrictions and allow your **iPhone**, **Android**, **Windows**, and **MacBook** to report battery data from anywhere in the world over cellular 5G/4G or Wi-Fi.

---

## ⚡ Option 1: Instant Public HTTPS Tunnel (Ready & Active Now)

Your computer is equipped with a free **Cloudflare Tunnel** that generates a public, secure `https://...` address.

- **Active Public URL**: `https://bee-adaptive-legend-poor.trycloudflare.com`
- **Dashboard Web UI**: Open `https://bee-adaptive-legend-poor.trycloudflare.com` in Safari on your iPhone!
- **Ingestion Webhook**: `https://bee-adaptive-legend-poor.trycloudflare.com/api/report`

### Why this fixes iOS & mobile devices:
1. **Solves Apple ATS**: iOS requires secure HTTPS for background webhook automations. Plain local `http://` is blocked by Apple security policies.
2. **Works on Cellular 5G/4G**: Your phone does not need to be on the same Wi-Fi.
3. **No Router Port Forwarding**: Traffic is encrypted and proxied securely through Cloudflare's edge network.

### To restart the tunnel anytime:
```bash
./scripts/start_public_tunnel.sh
```

---

## ☁️ Option 2: 24/7 Free Serverless Backend (Vercel + Supabase)

If you want the dashboard to keep collecting data even when your MacBook is closed or turned off, you can deploy the backend to **Vercel** with a free **Supabase** database.

### Step 1: Create a Free Database on Supabase
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** and name it `device-dashboard`.
3. Open the **SQL Editor** in the left sidebar.
4. Copy and paste the contents of `cloud/supabase_schema.sql` into the editor and click **Run**.
5. Go to **Project Settings &rarr; API** and copy:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **anon / public key**

### Step 2: Deploy Frontend & API to Vercel
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) &rarr; **Add New Project** &rarr; Select your `DashBoard` repository.
3. In **Environment Variables**, add:
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_ANON_KEY`: Your Supabase Anon Key
4. Click **Deploy**.

Within 30 seconds, Vercel gives you a permanent, free URL like `https://my-dashboard.vercel.app` that runs 24/7 in the cloud!
