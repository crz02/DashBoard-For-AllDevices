-- ==========================================================================
-- OmniPulse Supabase Cloud Schema
-- Run this in your Supabase SQL Editor to enable 24/7 Cloud Sync
-- ==========================================================================

-- 1. Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create battery logs table for charts
CREATE TABLE IF NOT EXISTS battery_logs (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
    percentage INTEGER NOT NULL,
    is_charging BOOLEAN NOT NULL,
    power_source TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) and allow anonymous insert/read for device telemetry
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE battery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on devices" 
    ON devices FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update on devices" 
    ON devices FOR ALL USING (true);

CREATE POLICY "Allow public read on battery_logs" 
    ON battery_logs FOR SELECT USING (true);

CREATE POLICY "Allow public insert on battery_logs" 
    ON battery_logs FOR INSERT WITH CHECK (true);

-- 4. Enable Realtime Publications so dashboard updates instantly over WebSockets
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
