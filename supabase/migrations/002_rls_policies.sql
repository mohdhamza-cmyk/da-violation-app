-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Migration: 002_rls_policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── HELPER: get current user role ────────────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_logistics_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'logistics_associate');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── STORES POLICIES ──────────────────────────────────────────

CREATE POLICY "stores_read_authenticated"
  ON stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "stores_write_admin"
  ON stores FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── PROFILES POLICIES ────────────────────────────────────────

CREATE POLICY "profiles_read_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_self"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── RIDER STORE ASSIGNMENTS POLICIES ────────────────────────

CREATE POLICY "assignments_read_all"
  ON rider_store_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "assignments_write_logistics_admin"
  ON rider_store_assignments FOR ALL
  TO authenticated
  USING (is_logistics_or_admin())
  WITH CHECK (is_logistics_or_admin());

-- ─── TRAINING LOCATIONS POLICIES ─────────────────────────────

CREATE POLICY "locations_read_authenticated"
  ON training_locations FOR SELECT
  TO authenticated
  USING (is_active = true OR is_logistics_or_admin());

CREATE POLICY "locations_write_admin"
  ON training_locations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── TRAINING SESSIONS POLICIES ───────────────────────────────

CREATE POLICY "sessions_read_own_or_staff"
  ON training_sessions FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid() OR is_logistics_or_admin());

CREATE POLICY "sessions_insert_rider"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (rider_id = auth.uid() OR is_logistics_or_admin());

CREATE POLICY "sessions_update_own_or_staff"
  ON training_sessions FOR UPDATE
  TO authenticated
  USING (rider_id = auth.uid() OR is_logistics_or_admin());

-- ─── TRAINING ORDERS POLICIES ─────────────────────────────────

CREATE POLICY "orders_read_own_or_staff"
  ON training_orders FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid() OR is_logistics_or_admin());

CREATE POLICY "orders_insert_logistics_admin"
  ON training_orders FOR INSERT
  TO authenticated
  WITH CHECK (is_logistics_or_admin());

CREATE POLICY "orders_update_own_rider"
  ON training_orders FOR UPDATE
  TO authenticated
  USING (
    (rider_id = auth.uid() AND status NOT IN ('completed','cancelled'))
    OR is_logistics_or_admin()
  );

-- ─── PERFORMANCE SCORES POLICIES ──────────────────────────────

CREATE POLICY "scores_read_own_or_staff"
  ON performance_scores FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid() OR is_logistics_or_admin());

CREATE POLICY "scores_insert_system"
  ON performance_scores FOR INSERT
  TO authenticated
  WITH CHECK (is_logistics_or_admin());

CREATE POLICY "scores_update_system"
  ON performance_scores FOR UPDATE
  TO authenticated
  USING (is_logistics_or_admin());

-- ─── EVALUATIONS POLICIES ─────────────────────────────────────

CREATE POLICY "evaluations_read_own_or_staff"
  ON evaluations FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid() OR is_logistics_or_admin());

CREATE POLICY "evaluations_insert_logistics_admin"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (is_logistics_or_admin() AND evaluator_id = auth.uid());

CREATE POLICY "evaluations_update_own_evaluator"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid() OR is_admin());

-- ─── AUDIT LOGS POLICIES ──────────────────────────────────────

CREATE POLICY "audit_read_admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "audit_insert_authenticated"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── NOTIFICATIONS POLICIES ───────────────────────────────────

CREATE POLICY "notifications_read_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_system"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_logistics_or_admin());
