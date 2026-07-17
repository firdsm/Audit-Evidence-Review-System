-- Migration: 20260717060000_alter_value_categories_kode_makna.sql
-- Split kolom `label` menjadi dua kolom terpisah: `kode` dan `makna`

-- Hapus data percobaan (1 baris: "Pelayanan Prima" tanpa field kode)
TRUNCATE TABLE value_categories;

-- Drop kolom label lama
ALTER TABLE value_categories DROP COLUMN label;

-- Tambah dua kolom baru dengan DEFAULT sementara agar NOT NULL bisa dibuat
ALTER TABLE value_categories ADD COLUMN kode TEXT NOT NULL DEFAULT '';
ALTER TABLE value_categories ADD COLUMN makna TEXT NOT NULL DEFAULT '';

-- Lepas DEFAULT placeholder setelah kolom berhasil dibuat
ALTER TABLE value_categories ALTER COLUMN kode DROP DEFAULT;
ALTER TABLE value_categories ALTER COLUMN makna DROP DEFAULT;
