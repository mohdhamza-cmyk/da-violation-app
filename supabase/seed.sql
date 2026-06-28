-- ============================================================
-- SEED DATA - Development/Demo environment
-- ============================================================

-- ─── STORES ──────────────────────────────────────────────────

INSERT INTO stores (id, store_code, name, latitude, longitude, address, city, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'DS-001', 'Al Barsha Dark Store', 25.1124, 55.1975, 'Al Barsha 1', 'Dubai', true),
  ('22222222-2222-2222-2222-222222222222', 'DS-002', 'Downtown Dark Store', 25.1972, 55.2744, 'Downtown Dubai', 'Dubai', true),
  ('33333333-3333-3333-3333-333333333333', 'DS-003', 'Deira Dark Store', 25.2697, 55.3095, 'Deira, Naif', 'Dubai', true),
  ('44444444-4444-4444-4444-444444444444', 'DS-004', 'Jumeirah Dark Store', 25.2084, 55.2452, 'Jumeirah 1', 'Dubai', true),
  ('55555555-5555-5555-5555-555555555555', 'DS-005', 'Sharjah Central Store', 25.3371, 55.3789, 'Al Qasimia', 'Sharjah', true)
ON CONFLICT (id) DO NOTHING;

-- ─── TRAINING LOCATIONS ───────────────────────────────────────

INSERT INTO training_locations (name, latitude, longitude, landmark, notes, difficulty, expected_duration_minutes, store_id) VALUES
  -- Al Barsha store locations
  ('Mall of Emirates Tower B', 25.1181, 55.2005, 'Near Carrefour entrance', 'Large building, main entrance faces Sheikh Zayed Road', 'easy', 8, '11111111-1111-1111-1111-111111111111'),
  ('Al Barsha 2 Residential Cluster', 25.1089, 55.1902, 'Opposite Al Barsha Park', 'Multiple towers, target is Tower 3', 'medium', 12, '11111111-1111-1111-1111-111111111111'),
  ('Dubai Internet City Metro', 25.1014, 55.1748, 'Under the metro bridge', 'Building has a blue glass facade', 'hard', 18, '11111111-1111-1111-1111-111111111111'),
  -- Downtown store locations
  ('Burj Khalifa Podium', 25.1972, 55.2744, 'Level 1 entrance near Dubai Fountain', 'Approach from Financial Centre Road', 'medium', 10, '22222222-2222-2222-2222-222222222222'),
  ('DIFC Gate Village', 25.2122, 55.2803, 'Gate Village Building 3', 'Use DIFC Gate 2 entrance', 'hard', 15, '22222222-2222-2222-2222-222222222222'),
  -- Deira store locations
  ('Al Rigga Residential Tower', 25.2633, 55.3248, 'Next to LuLu Hypermarket Al Rigga', 'Tower entrance on Al Rigga Road', 'easy', 7, '33333333-3333-3333-3333-333333333333'),
  ('Gold Souk Area Building', 25.2682, 55.3025, 'Sikkat Al Khail Road', 'Old building with yellow facade', 'hard', 20, '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;
