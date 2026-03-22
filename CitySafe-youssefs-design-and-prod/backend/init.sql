-- CitySafe Initial Schema setup for Supabase (PostgreSQL)

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'moderator')),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    image_ref VARCHAR(255),
    status VARCHAR(50) DEFAULT 'under_review' CHECK (status IN ('under_review', 'verified', 'resolved', 'rejected', 'cancelled')),
    location GEOMETRY(Point, 4326) NOT NULL, -- Storing coords as Point(lon, lat) using SRID 4326 (WGS 84)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast spatial queries on reports
CREATE INDEX IF NOT EXISTS reports_location_idx ON reports USING GIST (location);

-- SOS Requests Table
CREATE TABLE IF NOT EXISTS sos_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    urgency VARCHAR(50) NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'cancelled')),
    location GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sos_location_idx ON sos_requests USING GIST (location);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    location GEOMETRY(Point, 4326) NOT NULL,
    radius_km INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS alerts_location_idx ON alerts USING GIST (location);

-- Points Ledger Table
CREATE TABLE IF NOT EXISTS points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    sponsor VARCHAR(255) NOT NULL,
    description TEXT,
    cost INTEGER NOT NULL,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Vouchers
INSERT INTO vouchers (code, sponsor, description, cost) VALUES
    ('COFFEE-BN', 'Beanery Cafe', 'Free standard coffee', 500),
    ('METRO-DXB', 'Dubai Metro', '1-Day Commuter Pass', 1000),
    ('LUNCH-15', 'Fresh Bites', '15 AED Off Any Meal', 250)
ON CONFLICT (code) DO NOTHING;

-- User Vouchers Mapping (Redemptions)
CREATE TABLE IF NOT EXISTS user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to safely update points and record in ledger
CREATE OR REPLACE FUNCTION award_points(p_user_id UUID, p_amount INTEGER, p_reason TEXT)
RETURNS void AS $$
BEGIN
    UPDATE users SET points = points + p_amount WHERE id = p_user_id;
    INSERT INTO points_ledger (user_id, amount, reason) VALUES (p_user_id, p_amount, p_reason);
END;
$$ LANGUAGE plpgsql;
