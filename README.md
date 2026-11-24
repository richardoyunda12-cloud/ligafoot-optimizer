# LigaFoot Optimizer v8.9.0 — Web App & PWA

Optimizer 360° untuk **LigaFoot Manager** (terkalibrasi penuh dengan Engine `v1.2.0 / economyV=9` / Bytecode v9 Verified) yang berjalan **100% lokal di browser HP/PC tanpa backend server** dan mendukung mode **offline (PWA)**.

## Fitur Utama
- **Privasi & Kecepatan Penuh:** File save `.ligafoot` (~15 MB) dibaca langsung di memori browser (< 1,5 detik) tanpa pernah diunggah ke server.
- **Offline-First & Google Drive Sync:** Database statis (`static_db.min.json.gz`) diunduh 1 kali ke **IndexedDB** bersama *dashboard* terakhir & **Multi-Save Delta History**.
- **6 Ruang Kerja Fokus + Mobile Bottom Navigation:**
  1. **Beranda:** Hero laga berikutnya, kartu **"Apa yang Berubah?"** antar-save, Auto-Settings Guard, Playbook Eksekusi, Action Queue, & Mini Klasemen.
  2. **War Room:** Duel sektor H2H visual 15 formasi resmi `#3492` + formasi kustom (`~`), simulasi `autoCond` (cuaca, wasit, altitude, VAR) langsung ke `Win%` & `xG`, diff `lastLineup`, serta *live coaching*.
  3. **Skuad & Taktik:** Pitch Visual v2, Dual XI (Best vs Rotation), Audit Skuad Senior, **Pelacak Progresi Wonderkid** (laju target `#18782` vs aktual antar-save + grafik SVG), Radar Ruang Ganti, Akademi, & **Deep Audit Tim B**.
  4. **Transfer & Scout:** Rencana Belanja Pintar, Pasar Global, Shortlist persisten, & **What-If Squad Cart Simulator** (uji beli, jual, Bosman, & promosi Tim B `0€` sebelum bertindak).
  5. **Keuangan & Klub:** Kalender Cashflow **12 Bulan**, Audit **Preset Tiket** + Simulator 6 Fase Pareto, Grafik 12 Bulan Club Shop & Top 8 Jersey, serta ROI Ekspansi Stadion.
  6. **Liga & Alat:** Klasemen & Magic Number Juara, **Forensik MatchLog** (menit gol, formasi & rating), 5 Kalkulator Engine, Backup/Restore Riwayat JSON, & **Interactive Timnas War Room + Call-Up Optimizer**.

## Verifikasi Regresi Otomatis (`Tier 3`)
Setiap pembaruan engine, OTA LigaFoot, atau tampilan dapat langsung diuji dalam 1 perintah:
```bash
node scripts/verify_e2e.js path/to/ligafoot_slot1.ligafoot
```
*(Gunakan `--skip-ui` untuk menjalankan tes syntax + engine Node saja tanpa Playwright Chromium.)*
