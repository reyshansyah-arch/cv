SISTEM PRESENSI WAJAH - CLOUDFLARE WORKERS + D1

ISI:
- public/index.html : aplikasi HTML yang sudah diarahkan ke API Worker
- index.js          : Cloudflare Worker API
- wrangler.jsonc    : konfigurasi Worker, assets, dan binding D1
- schema.sql        : tabel users, attendance, settings

PENTING:
1. Periksa database_id di wrangler.jsonc. Nilai yang dipasang berasal dari screenshot sebelumnya.
2. Jalankan schema.sql pada database D1 bernama presensi_db (Console > D1 > presensi_db > Execute).
3. Upload/salin isi folder public ke folder public di root repository GitHub.
4. Letakkan index.js dan wrangler.jsonc di root repository, sejajar dengan folder public.
5. Pastikan project Cloudflare Pages/Workers yang terhubung ke GitHub memakai root directory kosong (repository root) dan deploy command:
   npx wrangler deploy
   Build command boleh dikosongkan.
6. Pastikan binding D1 bernama DB menunjuk ke presensi_db.
7. Setelah deployment, buka /api/health. Hasil yang diharapkan:
   {"success":true,"database":"connected"}

CATATAN:
- Aplikasi ini menyimpan face landmark vector, bukan foto/video wajah.
- Data biometrik adalah data sensitif. Batasi akses aplikasi dan tambahkan autentikasi/otorisasi sebelum dipakai untuk penggunaan nyata.
- API contoh ini belum memiliki login/admin authentication; jangan dipublikasikan untuk data orang sungguhan sampai autentikasi dan kebijakan privasi diterapkan.
- Face vector landmark 150 angka yang digunakan mengikuti ekstraksi pada HTML sumber.
