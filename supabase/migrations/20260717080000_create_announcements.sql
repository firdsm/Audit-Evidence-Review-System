-- Migration: 20260717080000_create_announcements.sql
-- Tabel untuk menyimpan pengumuman yang ditampilkan di halaman aplikasi

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message      TEXT        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  -- target_pages: array identifiers. Nilai valid: 'all', 'dashboard', 'audit', 'hasil_penilaian'
  target_pages TEXT[]      NOT NULL DEFAULT ARRAY['all'],
  created_by   UUID        REFERENCES auditors(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger supaya updated_at selalu diperbarui otomatis
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Hanya buat trigger kalau belum ada (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_announcements_updated_at'
  ) THEN
    CREATE TRIGGER set_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- RLS: enable row level security
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policy: semua user terautentikasi bisa SELECT (filter is_active dilakukan di query level)
CREATE POLICY "announcements_select_authenticated"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

-- Policy: hanya superadmin yang bisa insert/update/delete
-- (enforcement dilakukan di aplikasi level via requireSuperAdminApi)
CREATE POLICY "announcements_all_superadmin"
  ON announcements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
