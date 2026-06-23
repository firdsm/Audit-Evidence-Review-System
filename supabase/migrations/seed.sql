-- Seed aspects
INSERT INTO aspects (id, name, order_number) VALUES
('e9df07f8-fb1c-43df-973f-85f00e998db1', 'Kebijakan Pelayanan', 1),
('e9df07f8-fb1c-43df-973f-85f00e998db2', 'Profesionalisme SDM', 2),
('e9df07f8-fb1c-43df-973f-85f00e998db3', 'Sarana Prasarana', 3),
('e9df07f8-fb1c-43df-973f-85f00e998db4', 'Sistem Informasi Pelayanan Publik (SIPP)', 4),
('e9df07f8-fb1c-43df-973f-85f00e998db5', 'Konsultasi dan Pengaduan', 5),
('e9df07f8-fb1c-43df-973f-85f00e998db6', 'Inovasi', 6),
('e9df07f8-fb1c-43df-973f-85f00e998db7', 'Sistem Antrian', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  order_number = EXCLUDED.order_number;

-- Seed indicators
INSERT INTO indicators (id, aspect_id, code, name, order_number) VALUES
-- Kebijakan Pelayanan (aspect 1)
('e9df07f8-fb1c-43df-973f-85f00e998dc1', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-01', 'Tersedianya Standar Pelayanan', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dc2', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-02', 'Proses Penyusunan dan Perubahan SP', 2),
('e9df07f8-fb1c-43df-973f-85f00e998dc3', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-03', 'Media Publikasi', 3),
('e9df07f8-fb1c-43df-973f-85f00e998dc4', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-04', 'Peninjauan Ulang', 4),
('e9df07f8-fb1c-43df-973f-85f00e998dc5', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-05', 'Maklumat Pelayanan', 5),
('e9df07f8-fb1c-43df-973f-85f00e998dc6', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-06', 'SKM', 6),
('e9df07f8-fb1c-43df-973f-85f00e998dc7', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-07', 'Publikasi SKM', 7),
('e9df07f8-fb1c-43df-973f-85f00e998dc8', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-08', 'Tindak Lanjut SKM', 8),
('e9df07f8-fb1c-43df-973f-85f00e998dc9', 'e9df07f8-fb1c-43df-973f-85f00e998db1', 'IND-09', 'Kecepatan Tindak Lanjut SKM', 9),

-- Profesionalisme SDM (aspect 2)
('e9df07f8-fb1c-43df-973f-85f00e998dca', 'e9df07f8-fb1c-43df-973f-85f00e998db2', 'IND-10', 'Waktu Pelayanan', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dcb', 'e9df07f8-fb1c-43df-973f-85f00e998db2', 'IND-11', 'Kode Etik', 2),
('e9df07f8-fb1c-43df-973f-85f00e998dcc', 'e9df07f8-fb1c-43df-973f-85f00e998db2', 'IND-12', 'Reward and Punishment', 3),
('e9df07f8-fb1c-43df-973f-85f00e998dcd', 'e9df07f8-fb1c-43df-973f-85f00e998db2', 'IND-13', 'Kriteria Penghargaan', 4),
('e9df07f8-fb1c-43df-973f-85f00e998dce', 'e9df07f8-fb1c-43df-973f-85f00e998db2', 'IND-14', 'Budaya Pelayanan', 5),

-- Sarana Prasarana (aspect 3)
('e9df07f8-fb1c-43df-973f-85f00e998dcf', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-15', 'Tersedia Tempat Parkir', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dd0', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-16', 'Ruang Tunggu', 2),
('e9df07f8-fb1c-43df-973f-85f00e998dd1', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-17', 'Toilet Pengguna Layanan', 3),
('e9df07f8-fb1c-43df-973f-85f00e998dd2', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-18', 'Sarpras Kelompok Rentan', 4),
('e9df07f8-fb1c-43df-973f-85f00e998dd3', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-19', 'Sarana Prasarana Penunjang', 5),
('e9df07f8-fb1c-43df-973f-85f00e998dd4', 'e9df07f8-fb1c-43df-973f-85f00e998db3', 'IND-20', 'Sarana Front Office', 6),

-- SIPP (aspect 4)
('e9df07f8-fb1c-43df-973f-85f00e998dd5', 'e9df07f8-fb1c-43df-973f-85f00e998db4', 'IND-21', 'SIPP', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dd6', 'e9df07f8-fb1c-43df-973f-85f00e998db4', 'IND-22', 'SIPP Pendukung Operasional Layanan', 2),
('e9df07f8-fb1c-43df-973f-85f00e998dd7', 'e9df07f8-fb1c-43df-973f-85f00e998db4', 'IND-23', 'SIPP Elektronik', 3),
('e9df07f8-fb1c-43df-973f-85f00e998dd8', 'e9df07f8-fb1c-43df-973f-85f00e998db4', 'IND-24', 'Pembaharuan', 4),

-- Konsultasi dan Pengaduan (aspect 5)
('e9df07f8-fb1c-43df-973f-85f00e998dd9', 'e9df07f8-fb1c-43df-973f-85f00e998db5', 'IND-25', 'Fasilitas Pengaduan', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dda', 'e9df07f8-fb1c-43df-973f-85f00e998db5', 'IND-26', 'Sarana Konsultasi', 2),
('e9df07f8-fb1c-43df-973f-85f00e998ddb', 'e9df07f8-fb1c-43df-973f-85f00e998db5', 'IND-27', 'Hasil Konsultasi Pengaduan', 3),
('e9df07f8-fb1c-43df-973f-85f00e998ddc', 'e9df07f8-fb1c-43df-973f-85f00e998db5', 'IND-28', 'Rekap Pengaduan', 4),

-- Inovasi (aspect 6)
('e9df07f8-fb1c-43df-973f-85f00e998ddd', 'e9df07f8-fb1c-43df-973f-85f00e998db6', 'IND-29', 'Inovasi Pelayanan Publik', 1),
('e9df07f8-fb1c-43df-973f-85f00e998dde', 'e9df07f8-fb1c-43df-973f-85f00e998db6', 'IND-30', 'SDM Inovasi', 2)
ON CONFLICT (id) DO UPDATE SET
  aspect_id = EXCLUDED.aspect_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  order_number = EXCLUDED.order_number;
