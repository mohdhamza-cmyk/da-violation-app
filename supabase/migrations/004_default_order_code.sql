-- ============================================================
-- 004 — Auto-generate training_sessions.order_code
-- ============================================================
-- training_sessions.order_code is NOT NULL, but the mobile app does not
-- supply it when a rider taps "Ready for Training" (enters the waiting
-- queue). Without a default this raises:
--   null value in column "order_code" violates not-null constraint
-- Give the column a default sourced from a sequence so the insert succeeds.

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

ALTER TABLE public.training_sessions
  ALTER COLUMN order_code SET DEFAULT ('TRN-' || lpad(nextval('public.order_number_seq')::text, 5, '0'));
