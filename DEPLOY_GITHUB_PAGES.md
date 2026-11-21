# Panduan Deploy Gratis ke GitHub Pages & Install di HP

Folder `D:\Liga\ligafoot-web\` sekarang sudah 100% siap *online* gratis selamanya di **GitHub Pages**.

---

## Cara 1 — Upload Lewat Git di PowerShell PC (Paling Cepat & Mudah Update)

1. Buka [https://github.com/new](https://github.com/new) di browser PC.
2. Isi **Repository name**: `ligafoot-optimizer` (pilih **Public** agar GitHub Pages gratis aktif, **jangan** centang README/gitignore). Klik **Create repository**.
3. Jalankan perintah berikut di PowerShell (ganti `<USERNAME>` dengan username GitHub kamu):

```powershell
cd D:\Liga\ligafoot-web
git init
git add .
git commit -m "Deploy LigaFoot Optimizer v8.0 Web PWA"
git branch -M main
git remote add origin https://github.com/<USERNAME>/ligafoot-optimizer.git
git push -u origin main
```

4. Aktifkan **GitHub Pages**:
   - Buka repository `ligafoot-optimizer` di GitHub $\rightarrow$ klik tab **Settings** $\rightarrow$ menu **Pages** (di sisi kiri).
   - Pada bagian **Build and deployment**:
     - **Source:** `Deploy from a branch`
     - **Branch:** pilih `main` dan folder `/ (root)` $\rightarrow$ klik **Save**.
5. Tunggu **1–2 menit**, lalu *refresh* halaman Settings $\rightarrow$ Pages. Link aplikasimu akan muncul:
   `https://<USERNAME>.github.io/ligafoot-optimizer/`

---

## Cara 2 — Jika Belum Pernah Pakai Git (Lewat GitHub Desktop / Upload Web)

- **Via GitHub Desktop (Disarankan jika tidak pakai CLI):**
  1. Instal GitHub Desktop $\rightarrow$ *Add Local Repository* $\rightarrow$ pilih `D:\Liga\ligafoot-web`.
  2. Klik **Publish repository** (hapus centang *Keep this code private* agar gratis di GitHub Pages).
  3. Aktifkan **Settings $\rightarrow$ Pages $\rightarrow$ Branch `main` / `/ (root)`**.

---

## Cara Install Sebagai Aplikasi (PWA) di HP Android

1. Buka `https://<USERNAME>.github.io/ligafoot-optimizer/` di **Google Chrome** HP.
2. Tunggu 2–3 detik sampai status **Database Pemain Statis** berubah menjadi **`✓ DB SIAP OFFLINE`** (~2 MB, hanya diunduh 1x seumur hidup!).
3. Ketuk tombol **`📲 Install App`** di pojok kanan atas layar (atau menu titik tiga Chrome `⋮` $\rightarrow$ **Tambahkan ke layar utama / Install app**).
4. Ikon **LigaFoot Opt** akan muncul di *Home Screen* HP kamu dan bisa dibuka **tanpa internet (Mode Pesawat)**!

---

## Cara Update Web App di Masa Depan (Jika Ada Patch LigaFoot Baru)

Cukup jalankan ulang skrip update di PC, lalu dorong perubahan ke GitHub:

```powershell
cd D:\Liga\ligafoot-web
git add .
git commit -m "Update engine"
git push
```
