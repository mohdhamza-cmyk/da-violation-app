-- ============================================================
-- STORAGE BUCKETS & POLICIES
-- Migration: 003_storage
-- ============================================================

-- Create the POD photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-photos',
  'pod-photos',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── STORAGE RLS POLICIES ────────────────────────────────────

-- Riders can upload their own POD photos
-- Path structure: {store_id}/{rider_id}/{order_id}/{type}.jpg

CREATE POLICY "pod_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pod-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Riders can view their own photos; staff can view all
CREATE POLICY "pod_read_own_or_staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (
      auth.uid()::text = (string_to_array(name, '/'))[2]
      OR get_my_role() IN ('admin', 'logistics_associate')
    )
  );

-- Only admins can delete photos
CREATE POLICY "pod_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND is_admin()
  );
