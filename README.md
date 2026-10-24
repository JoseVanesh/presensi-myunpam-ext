# UNPAM Presensi

Ekstensi Chrome/Edge (Manifest V3) untuk melihat persentase kehadiran kuliah di portal [my.unpam.ac.id](https://my.unpam.ac.id) tanpa membuka menu presensi satu per satu.

> Proyek tidak resmi dan tidak berafiliasi dengan Universitas Pamulang.

## Fitur

- Tombol bulat berlogo absen di bagian bawah sidebar portal.
- Ringkasan persentase kehadiran per mata kuliah, diurutkan dari yang terendah.
- Peringatan merah jika kehadiran di bawah **70%**.
- Rincian jumlah hadir (H), alpha (A), sakit (S), izin (I), dan pertemuan yang belum diabsen.
- Persentase dihitung dari **jumlah hadir ÷ total pertemuan** mata kuliah.
- Data disimpan lokal di browser; tidak ada server dan tidak ada data yang dikirim ke pihak ketiga.

## Cara pakai

1. Clone repositori ini, lalu jalankan:

   ```bash
   npm install
   npm run zip
   ```

2. Buka `chrome://extensions` (Chrome) atau `edge://extensions` (Edge).
3. Aktifkan **Developer mode**.
4. Klik **Load unpacked** dan pilih folder `.output/chrome-mv3`.
5. Login ke portal, lalu klik tombol absen di bawah sidebar.

## Pengembangan

```bash
npm install
npm run dev      # mode pengembangan dengan hot reload
npm run compile  # cek TypeScript
npm test         # jalankan unit test
npm run build    # build produksi
npm run zip      # buat ZIP rilis
```

## Cara kerja singkat

- Content script di world `MAIN` memakai instance Vue dan `$axios` milik portal untuk memanggil endpoint presensi, sehingga sesi login yang sedang aktif ikut terpakai.
- Data semester, daftar mata kuliah, dan detail pertemuan dinormalisasi lalu dihitung per mata kuliah.
- Hasil disimpan di `browser.storage.local` dan ditampilkan lewat panel di halaman portal.
- Popup toolbar tetap tersedia sebagai cadangan.

## Tech stack

- [WXT](https://wxt.dev) 0.21
- React 19
- TypeScript
- Tailwind CSS v4
- Zod 4
- Vitest
