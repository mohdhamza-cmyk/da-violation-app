-- ============================================================
-- 005 — Default training_sessions.assigned_at
-- ============================================================
-- The mobile app parses training_sessions.assigned_at as a NON-NULL DateTime
-- (TrainingSessionModel.assignedAt). The "Ready for Training" insert does not
-- set assigned_at, so without a default it is NULL and the client throws when
-- the session is fetched. Default it to now() and backfill existing nulls.

ALTER TABLE public.training_sessions
  ALTER COLUMN assigned_at SET DEFAULT now();

UPDATE public.training_sessions
SET assigned_at = COALESCE(assigned_at, created_at, now())
WHERE assigned_at IS NULL;
