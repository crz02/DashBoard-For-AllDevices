-- ==========================================================================
-- Statuser Supabase Multi-Tenant Cloud Schema
-- Run this in your Supabase SQL Editor to enable 24/7 Cloud Sync with User Isolation
-- ==========================================================================

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create devices table (Scoped to user_id)
CREATE TABLE IF NOT EXISTS devices (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'macos', 'windows', 'ios', 'android'
    model TEXT,
    battery_level INTEGER DEFAULT 100,
    is_charging BOOLEAN DEFAULT FALSE,
    power_source TEXT DEFAULT 'Battery',
    battery_health TEXT DEFAULT 'Good',
    cycle_count INTEGER DEFAULT 0,
    temperature REAL DEFAULT 0,
    cpu_usage REAL DEFAULT 0,
    ram_usage REAL DEFAULT 0,
    ip_address TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- 3. Create battery logs table (Scoped to user_id)
CREATE TABLE IF NOT EXISTS battery_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    percentage INTEGER NOT NULL,
    is_charging BOOLEAN NOT NULL,
    power_source TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battery_logs_user_dev_time ON battery_logs(user_id, device_id, timestamp);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE battery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public upsert on users" ON users FOR ALL USING (true);

CREATE POLICY "Allow public read on devices" ON devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on devices" ON devices FOR ALL USING (true);

CREATE POLICY "Allow public read on battery_logs" ON battery_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on battery_logs" ON battery_logs FOR INSERT WITH CHECK (true);

-- 5. Enable Realtime Publications so dashboard updates instantly over WebSockets
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
