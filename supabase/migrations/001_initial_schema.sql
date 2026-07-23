-- ============================================================
-- RIDER TRAINING SANDBOX PLATFORM - INITIAL SCHEMA
-- Migration: 001_initial_schema
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('rider', 'logistics_associate', 'admin');

CREATE TYPE order_status AS ENUM (
  'assigned',
  'accepted',
  'pickup_complete',
  'in_transit',
  'arrived',
  'delivered',
  'returning',
  'completed',
  'cancelled'
);

CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

CREATE TYPE session_status AS ENUM ('waiting', 'active', 'completed', 'cancelled');

-- ─── STORES (Dark Stores) ─────────────────────────────────────

CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code    TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  latitude      DECIMAL(10, 8) NOT NULL,
  longitude     DECIMAL(11, 8) NOT NULL,
  address       TEXT,
  city          TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PROFILES (Users) ─────────────────────────────────────────

CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id       TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  role              user_role NOT NULL DEFAULT 'rider',
  phone             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RIDER STORE ASSIGNMENTS ──────────────────────────────────

CREATE TABLE rider_store_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  assigned_by   UUID REFERENCES profiles(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (rider_id, store_id, is_current)
);

-- ─── TRAINING LOCATIONS (Delivery Destinations) ───────────────

CREATE TABLE training_locations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  latitude                  DECIMAL(10, 8) NOT NULL,
  longitude                 DECIMAL(11, 8) NOT NULL,
  landmark                  TEXT,
  notes                     TEXT,
  difficulty                difficulty_level NOT NULL DEFAULT 'easy',
  expected_duration_minutes INTEGER NOT NULL DEFAULT 10,
  store_id                  UUID REFERENCES stores(id) ON DELETE SET NULL,
  geofence_radius_meters    INTEGER NOT NULL DEFAULT 50,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID REFERENCES profiles(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── TRAINING SESSIONS ────────────────────────────────────────

CREATE TABLE training_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES stores(id),
  status          session_status NOT NULL DEFAULT 'waiting',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── TRAINING ORDERS ──────────────────────────────────────────

CREATE TABLE training_orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number              TEXT NOT NULL UNIQUE,
  session_id                UUID REFERENCES training_sessions(id),
  rider_id                  UUID NOT NULL REFERENCES profiles(id),
  store_id                  UUID NOT NULL REFERENCES stores(id),
  location_id               UUID NOT NULL REFERENCES training_locations(id),
  assigned_by               UUID REFERENCES profiles(id),
  status                    order_status NOT NULL DEFAULT 'assigned',
  difficulty                difficulty_level NOT NULL,
  expected_travel_time_min  INTEGER NOT NULL,

  -- Timestamps
  assigned_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at               TIMESTAMPTZ,
  pickup_at                 TIMESTAMPTZ,
  departed_at               TIMESTAMPTZ,
  arrived_at                TIMESTAMPTZ,
  delivered_at              TIMESTAMPTZ,
  return_started_at         TIMESTAMPTZ,
  return_completed_at       TIMESTAMPTZ,

  -- GPS Coordinates at each step
  pickup_lat                DECIMAL(10, 8),
  pickup_lng                DECIMAL(11, 8),
  arrival_lat               DECIMAL(10, 8),
  arrival_lng               DECIMAL(11, 8),
  delivery_lat              DECIMAL(10, 8),
  delivery_lng              DECIMAL(11, 8),
  return_lat                DECIMAL(10, 8),
  return_lng                DECIMAL(11, 8),

  -- POD Photos
  pickup_pod_url            TEXT,
  delivery_pod_url          TEXT,

  -- Geofence compliance flags
  delivery_geofence_passed  BOOLEAN,
  return_geofence_passed    BOOLEAN,

  -- Computed durations (seconds)
  acceptance_delay_seconds  INTEGER,
  pickup_duration_seconds   INTEGER,
  travel_duration_seconds   INTEGER,
  return_duration_seconds   INTEGER,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PERFORMANCE SCORES ───────────────────────────────────────

CREATE TABLE performance_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID NOT NULL UNIQUE REFERENCES training_orders(id) ON DELETE CASCADE,
  rider_id                  UUID NOT NULL REFERENCES profiles(id),

  -- Component scores (0-100 each)
  acceptance_time_score     DECIMAL(5,2) NOT NULL DEFAULT 0,
  pickup_time_score         DECIMAL(5,2) NOT NULL DEFAULT 0,
  travel_time_score         DECIMAL(5,2) NOT NULL DEFAULT 0,
  return_time_score         DECIMAL(5,2) NOT NULL DEFAULT 0,
  pod_compliance_score      DECIMAL(5,2) NOT NULL DEFAULT 0,
  geofence_compliance_score DECIMAL(5,2) NOT NULL DEFAULT 0,

  -- Weighted total (0-100)
  total_score               DECIMAL(5,2) NOT NULL DEFAULT 0,
  passed                    BOOLEAN NOT NULL DEFAULT false,

  calculated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── EVALUATIONS (Trainer Notes) ─────────────────────────────

CREATE TABLE evaluations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES training_orders(id) ON DELETE CASCADE,
  rider_id      UUID NOT NULL REFERENCES profiles(id),
  evaluator_id  UUID NOT NULL REFERENCES profiles(id),
  notes         TEXT NOT NULL,
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUDIT LOGS ───────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  metadata      JSONB DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info',
  is_read     BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_employee_id ON profiles(employee_id);
CREATE INDEX idx_training_orders_rider ON training_orders(rider_id);
CREATE INDEX idx_training_orders_store ON training_orders(store_id);
CREATE INDEX idx_training_orders_status ON training_orders(status);
CREATE INDEX idx_training_orders_assigned_at ON training_orders(assigned_at);
CREATE INDEX idx_training_sessions_rider ON training_sessions(rider_id);
CREATE INDEX idx_training_sessions_status ON training_sessions(status);
CREATE INDEX idx_performance_scores_rider ON performance_scores(rider_id);
CREATE INDEX idx_performance_scores_order ON performance_scores(order_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_rider_store_current ON rider_store_assignments(rider_id) WHERE is_current = true;

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_training_locations_updated_at
  BEFORE UPDATE ON training_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_training_orders_updated_at
  BEFORE UPDATE ON training_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, employee_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'employee_id', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'rider')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── ORDER NUMBER GENERATOR ───────────────────────────────────

CREATE SEQUENCE order_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'TRN-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_orders_order_number
  BEFORE INSERT ON training_orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ─── COMPUTE SCORE FUNCTION ───────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_order_score(p_order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_order training_orders%ROWTYPE;
  v_loc   training_locations%ROWTYPE;
  v_acceptance_score  DECIMAL := 0;
  v_pickup_score      DECIMAL := 0;
  v_travel_score      DECIMAL := 0;
  v_return_score      DECIMAL := 0;
  v_pod_score         DECIMAL := 0;
  v_geofence_score    DECIMAL := 0;
  v_total             DECIMAL := 0;
  v_passed            BOOLEAN := false;
BEGIN
  SELECT * INTO v_order FROM training_orders WHERE id = p_order_id;
  SELECT * INTO v_loc FROM training_locations WHERE id = v_order.location_id;

  -- Acceptance Time Score (15%) — seconds from assigned to accepted
  IF v_order.acceptance_delay_seconds IS NOT NULL THEN
    IF v_order.acceptance_delay_seconds <= 30 THEN v_acceptance_score := 100;
    ELSIF v_order.acceptance_delay_seconds <= 60 THEN v_acceptance_score := 80;
    ELSIF v_order.acceptance_delay_seconds <= 120 THEN v_acceptance_score := 60;
    ELSE v_acceptance_score := 40;
    END IF;
  END IF;

  -- Pickup Time Score (15%) — seconds from accepted to pickup_complete
  IF v_order.pickup_duration_seconds IS NOT NULL THEN
    IF v_order.pickup_duration_seconds <= 120 THEN v_pickup_score := 100;
    ELSIF v_order.pickup_duration_seconds <= 180 THEN v_pickup_score := 80;
    ELSIF v_order.pickup_duration_seconds <= 300 THEN v_pickup_score := 60;
    ELSE v_pickup_score := 40;
    END IF;
  END IF;

  -- Travel Time Score (30%) — vs expected duration
  IF v_order.travel_duration_seconds IS NOT NULL AND v_loc.expected_duration_minutes > 0 THEN
    DECLARE
      expected_secs INTEGER := v_loc.expected_duration_minutes * 60;
      ratio DECIMAL := v_order.travel_duration_seconds::DECIMAL / expected_secs;
    BEGIN
      IF ratio <= 1.0 THEN v_travel_score := 100;
      ELSIF ratio <= 1.1 THEN v_travel_score := 85;
      ELSIF ratio <= 1.25 THEN v_travel_score := 70;
      ELSIF ratio <= 1.5 THEN v_travel_score := 50;
      ELSE v_travel_score := 20;
      END IF;
    END;
  END IF;

  -- Return Time Score (20%) — seconds from delivery to return complete
  IF v_order.return_duration_seconds IS NOT NULL THEN
    IF v_order.return_duration_seconds <= 900 THEN v_return_score := 100;
    ELSIF v_order.return_duration_seconds <= 1500 THEN v_return_score := 80;
    ELSIF v_order.return_duration_seconds <= 2100 THEN v_return_score := 60;
    ELSE v_return_score := 40;
    END IF;
  END IF;

  -- POD Compliance Score (15%)
  IF v_order.pickup_pod_url IS NOT NULL AND v_order.delivery_pod_url IS NOT NULL THEN
    v_pod_score := 100;
  ELSIF v_order.pickup_pod_url IS NOT NULL OR v_order.delivery_pod_url IS NOT NULL THEN
    v_pod_score := 50;
  ELSE
    v_pod_score := 0;
  END IF;

  -- Geofence Compliance Score (5%)
  IF v_order.delivery_geofence_passed = true AND v_order.return_geofence_passed = true THEN
    v_geofence_score := 100;
  ELSIF v_order.delivery_geofence_passed = true OR v_order.return_geofence_passed = true THEN
    v_geofence_score := 50;
  END IF;

  -- Weighted Total
  v_total := (v_acceptance_score * 0.15)
           + (v_pickup_score * 0.15)
           + (v_travel_score * 0.30)
           + (v_return_score * 0.20)
           + (v_pod_score * 0.15)
           + (v_geofence_score * 0.05);

  v_passed := v_total >= 70;

  -- Upsert into performance_scores
  INSERT INTO performance_scores (
    order_id, rider_id,
    acceptance_time_score, pickup_time_score, travel_time_score,
    return_time_score, pod_compliance_score, geofence_compliance_score,
    total_score, passed
  ) VALUES (
    p_order_id, v_order.rider_id,
    v_acceptance_score, v_pickup_score, v_travel_score,
    v_return_score, v_pod_score, v_geofence_score,
    v_total, v_passed
  )
  ON CONFLICT (order_id) DO UPDATE SET
    acceptance_time_score = EXCLUDED.acceptance_time_score,
    pickup_time_score = EXCLUDED.pickup_time_score,
    travel_time_score = EXCLUDED.travel_time_score,
    return_time_score = EXCLUDED.return_time_score,
    pod_compliance_score = EXCLUDED.pod_compliance_score,
    geofence_compliance_score = EXCLUDED.geofence_compliance_score,
    total_score = EXCLUDED.total_score,
    passed = EXCLUDED.passed,
    calculated_at = now();

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── AUDIT LOG HELPER ────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_audit(
  p_user_id    UUID,
  p_action     TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id  UUID DEFAULT NULL,
  p_metadata   JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── NOTIFY HELPER ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id   UUID,
  p_title     TEXT,
  p_message   TEXT,
  p_type      TEXT DEFAULT 'info',
  p_metadata  JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RIDER STATS VIEW ────────────────────────────────────────

CREATE OR REPLACE VIEW rider_stats AS
SELECT
  p.id AS rider_id,
  p.full_name,
  p.employee_id,
  p.is_active,
  COUNT(DISTINCT o.id)                            AS total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') AS completed_orders,
  ROUND(AVG(s.total_score)::DECIMAL, 2)           AS avg_score,
  COUNT(DISTINCT o.id) FILTER (WHERE s.passed = true) AS passed_orders,
  ROUND(AVG(o.travel_duration_seconds)::DECIMAL / 60, 1) AS avg_travel_minutes,
  ROUND(AVG(o.acceptance_delay_seconds)::DECIMAL, 0) AS avg_acceptance_seconds,
  MAX(o.completed_at)                             AS last_order_at
FROM profiles p
LEFT JOIN training_orders o ON o.rider_id = p.id AND o.status = 'completed'
LEFT JOIN performance_scores s ON s.order_id = o.id
WHERE p.role = 'rider'
GROUP BY p.id, p.full_name, p.employee_id, p.is_active;

-- ─── STORE STATS VIEW ────────────────────────────────────────

CREATE OR REPLACE VIEW store_stats AS
SELECT
  st.id AS store_id,
  st.name AS store_name,
  st.store_code,
  st.is_active,
  COUNT(DISTINCT rsa.rider_id)                    AS total_riders,
  COUNT(DISTINCT o.id)                            AS total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') AS completed_orders,
  ROUND(AVG(s.total_score)::DECIMAL, 2)           AS avg_score,
  COUNT(DISTINCT o.id) FILTER (WHERE s.passed = true) AS passed_orders
FROM stores st
LEFT JOIN rider_store_assignments rsa ON rsa.store_id = st.id AND rsa.is_current = true
LEFT JOIN training_orders o ON o.store_id = st.id
LEFT JOIN performance_scores s ON s.order_id = o.id
GROUP BY st.id, st.name, st.store_code, st.is_active;

-- ─── ACTIVE ORDERS VIEW ──────────────────────────────────────

CREATE OR REPLACE VIEW active_orders AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.difficulty,
  o.assigned_at,
  o.accepted_at,
  o.pickup_at,
  o.arrived_at,
  o.delivered_at,
  o.return_started_at,
  p.full_name AS rider_name,
  p.employee_id,
  st.name AS store_name,
  st.store_code,
  l.name AS location_name,
  l.landmark,
  l.expected_duration_minutes,
  EXTRACT(EPOCH FROM (now() - o.assigned_at))::INTEGER AS elapsed_seconds
FROM training_orders o
JOIN profiles p ON p.id = o.rider_id
JOIN stores st ON st.id = o.store_id
JOIN training_locations l ON l.id = o.location_id
WHERE o.status NOT IN ('completed', 'cancelled');
