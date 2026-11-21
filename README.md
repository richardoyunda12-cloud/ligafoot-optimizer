# LigaFoot Optimizer v8.0 — Web App & PWA

Optimizer 360° untuk **LigaFoot Manager** (terkalibrasi penuh dengan Engine `v1.2.0 / economyV=9`) yang berjalan **100% lokal di browser HP/PC tanpa backend server** dan mendukung mode **offline (PWA)**.

## Fitur Utama
- **Privasi & Kecepatan Penuh:** File save `.ligafoot` (~13,5 MB) dibaca langsung di memori browser (< 1,5 detik) tanpa pernah diunggah ke server.
- **Offline-First & Cache Pintar:** Database statis (`static_db.min.json.gz`, ~2 MB) diunduh 1 kali saja lalu disimpan di **IndexedDB** HP bersama *dashboard* terakhir & **Delta Tracker**.
- **6 Ruang Kerja Fokus + Mobile Bottom Navigation:**
  1. **Beranda:** Hero laga berikutnya, 4 KPI utama, Auto-Settings Guard, Action Queue, & Mini Klasemen.
  2. **War Room:** Fokus 1 laga per klik, duel sektor H2H visual 15 formasi resmi `#3492`, prediksi `chooseAITactics`, tiket bulat, & 3 sub.
  3. **Skuad & Taktik:** Pitch Visual v2, Dual XI (Best vs Rotation Diff), Audit Skuad, Kalender Kontrak, Special Training, Ruang Ganti, & Akademi.
  4. **Transfer & Scout:** Rencana Belanja Pintar (Upgrade / Flip ROI / Bosman / Unhappy), Shortlist persisten, & Sticky Cart Bar.
  5. **Keuangan & Klub:** Arus kas rutin + Member/TV, Simulator Tiket Pareto (`Fill >= 70.5%`) 6 fase, Grafik 12 Bulan Club Shop & Top 8 Jersey.
  6. **Liga & Alat:** Klasemen + Magic Number Juara, 5 Kalkulator Engine (`+40% Counter`, `Renew -12%`, `Sponsor`, `priceFactor`, `Denda 20%`), Pra-Kontrak, & Timnas.

## Cara Pakai di HP Android
1. Buka URL GitHub Pages aplikasi ini di **Google Chrome** HP.
2. Ketuk menu titik tiga (`⋮`) $\rightarrow$ **Tambahkan ke layar utama / Install app**.
3. Di game LigaFoot, klik **Export Save** (file `.ligafoot` tersimpan di folder `Download`).
4. Buka aplikasi **LigaFoot Opt** di layar utama HP $\rightarrow$ pilih file `.ligafoot` $\rightarrow$ selesai!
