/**
 * LigaFoot Optimizer Web App — app_loader.js
 * Mengelola seluruh siklus hidup aplikasi di browser HP / PC:
 *   1. Registrasi Service Worker PWA (sw.js) untuk mode offline.
 *   2. Auto-load & cache Static DB (`data/static_db.min.json.gz`) ke IndexedDB.
 *   3. Auto-restore dashboard terakhir dari IndexedDB saat dibuka ulang.
 *   4. File Picker & Drag-and-Drop `.ligafoot` + progress bar lokal (<1,5 dtk).
 */
(function () {
  'use strict';

  const ST = window.LFStorage;
  const Engine = window.LFEngine;

  let cachedStaticDb = null;
  let cachedLastDashboard = null;
  let isBusy = false;
  let deferredInstallPrompt = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showError(msg) {
    const el = $('loader-err');
    if (!el) return;
    if (!msg) {
      el.classList.add('app-hidden');
      el.textContent = '';
    } else {
      el.textContent = '⚠️ ' + msg;
      el.classList.remove('app-hidden');
    }
  }

  function setProgress(pct, msg) {
    const wrap = $('loader-prog-wrap');
    const bar = $('loader-prog-bar');
    const txt = $('loader-prog-txt');
    const pctEl = $('loader-prog-pct');
    if (!wrap) return;
    if (pct === null) {
      wrap.classList.add('app-hidden');
      return;
    }
    wrap.classList.remove('app-hidden');
    if (bar) bar.style.width = Math.max(2, Math.min(100, pct)) + '%';
    if (txt) txt.textContent = msg || 'Memproses...';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  }

  function updateDbBadge(status, detail) {
    const b = $('db-status-badge');
    const d = $('db-status-detail');
    if (b) {
      b.className = 'badge ' + (status === 'ready' ? 'b-good' : (status === 'loading' ? 'b-info' : 'b-warn'));
      b.textContent = status === 'ready' ? '✓ DB SIAP OFFLINE' : (status === 'loading' ? '⏳ MEMUAT DB...' : '⚠ DB BELUM ADA');
    }
    if (d && detail) d.textContent = detail;
  }

  function showLoaderScreen(show) {
    const loader = $('webapp-loader-screen');
    const shell = $('webapp-dashboard-shell');
    if (loader) loader.classList.toggle('app-hidden', !show);
    if (shell) shell.classList.toggle('app-hidden', show);
    const backBtn = $('btn-back-dashboard');
    if (backBtn) backBtn.classList.toggle('app-hidden', !cachedLastDashboard);
  }

  function renderResumeCard() {
    const box = $('loader-resume-box');
    if (!box) return;
    if (!cachedLastDashboard || !cachedLastDashboard.data || !cachedLastDashboard.data.meta) {
      box.classList.add('app-hidden');
      return;
    }
    const m = cachedLastDashboard.data.meta;
    box.classList.remove('app-hidden');
    const info = $('loader-resume-info');
    if (info) {
      info.innerHTML =
        `<b>${m.teamName || 'Klub'}</b> (${m.currentDate || '-'}) • ` +
        `Kas <b>${Engine.utils.fmtMoney(m.budget)}</b> • ` +
        `File: <span class="mono">${cachedLastDashboard.fileName || 'save.ligafoot'}</span>`;
    }
  }


  function syncMobileFilters() {
    const isMob = window.innerWidth <= 768;
    document.querySelectorAll('.mobile-filter-box').forEach((el) => {
      if (isMob) el.removeAttribute('open');
      else el.setAttribute('open', '');
    });
  }

  function mountDashboard(dataObj) {
    window.D = dataObj;
    // Pastikan konstanta client selalu sinkron dari Engine
    if (!window.D.cfg && Engine && Engine.config) {
      window.D.cfg = Engine.config.getClientConfig();
    }
    showLoaderScreen(false);
    if (typeof window.LFInitDashboard === 'function') {
      window.LFInitDashboard();
    }
    syncMobileFilters();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Beri jeda 1 frame animasi agar browser HP sempat menggambar progress bar
  function yieldFrame() {
    return new Promise((resolve) => setTimeout(resolve, 25));
  }

  async function initStaticDb(forceRefresh = false) {
    try {
      updateDbBadge('loading', 'Memeriksa cache database statis di IndexedDB...');
      const res = await ST.ensureStaticDb('data/static_db.min.json.gz', (msg) => {
        updateDbBadge('loading', msg);
      }, forceRefresh);
      cachedStaticDb = res.db;
      const pCnt = (res.meta && res.meta.playersCount) || Object.keys(res.db.players || {}).length;
      const cCnt = (res.meta && res.meta.clubsCount) || Object.keys(res.db.clubs || {}).length;
      updateDbBadge(
        'ready',
        `${pCnt.toLocaleString('id-ID')} pemain & ${cCnt.toLocaleString('id-ID')} klub tersimpan di HP (${res.fromCache ? 'cache offline' : 'baru diunduh'}).`
      );
      return cachedStaticDb;
    } catch (err) {
      updateDbBadge(
        'missing',
        'Static DB belum ditemukan di server (akan dibuat di Tahap 4). Kamu tetap bisa muat .ligafoot atau pilih ligafoot_static_db.json manual di bawah.'
      );
      return null;
    }
  }

  async function handleSaveFile(file) {
    if (!file || isBusy) return;
    isBusy = true;
    showError('');
    setProgress(5, `Membaca ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

    try {
      await yieldFrame();
      const saveObj = await ST.readSaveFile(file, (msg) => setProgress(18, msg));

      // Pastikan Static DB terambil dari cache IndexedDB jika sudah ada
      if (!cachedStaticDb) {
        cachedStaticDb = await ST.getStaticDb();
      }

      setProgress(28, 'Memuat Delta Tracker dari penyimpanan HP...');
      const historyStore = await ST.getHistory();
      await yieldFrame();

      const { data, updatedHistory } = Engine.club.analyzeSave(
        saveObj,
        cachedStaticDb,
        historyStore,
        (pct, msg) => {
          const scaled = 30 + Math.round(pct * 0.62);
          setProgress(scaled, msg);
        }
      );

      setProgress(95, 'Menyimpan dashboard & snapshot ke IndexedDB HP...');
      await yieldFrame();
      await ST.saveHistory(updatedHistory);
      await ST.saveLastDashboard(data, { fileName: file.name });
      cachedLastDashboard = { data, fileName: file.name, savedAt: new Date().toISOString() };
      renderResumeCard();

      setProgress(100, `Berhasil dianalisis dalam ${data.meta.parseSec} detik!`);
      await yieldFrame();
      setProgress(null);
      mountDashboard(data);
      if (typeof showToast === 'function') {
        showToast(`Save ${data.meta.teamName} (${data.meta.currentDate}) siap! (${data.meta.parseSec}s)`);
      }
    } catch (err) {
      console.error('[LigaFoot WebApp Error]', err);
      setProgress(null);
      showError(err && err.message ? err.message : 'Gagal memproses file save .ligafoot.');
    } finally {
      isBusy = false;
      const inp = $('lf-file-input');
      if (inp) inp.value = '';
    }
  }

  async function handleManualStaticDbFile(file) {
    if (!file || isBusy) return;
    isBusy = true;
    showError('');
    try {
      updateDbBadge('loading', `Membaca ${file.name}...`);
      const res = await ST.loadStaticDbFromFile(file, (msg) => updateDbBadge('loading', msg));
      cachedStaticDb = res.db;
      updateDbBadge(
        'ready',
        `${res.meta.playersCount.toLocaleString('id-ID')} pemain & ${res.meta.clubsCount.toLocaleString('id-ID')} klub disimpan offline di HP!`
      );
      if (typeof showToast === 'function') showToast('Database statis berhasil disimpan ke HP!');
    } catch (err) {
      updateDbBadge('missing', 'Gagal memuat file database statis.');
      showError(err && err.message ? err.message : 'File Static DB tidak valid.');
    } finally {
      isBusy = false;
      const inp = $('lf-db-file-input');
      if (inp) inp.value = '';
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function wireEvents() {
    const fileInput = $('lf-file-input');
    const dbInput = $('lf-db-file-input');
    const dropZone = $('lf-drop-zone');

    if (fileInput) {
      fileInput.addEventListener('change', (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (f) handleSaveFile(f);
      });
    }
    if (dbInput) {
      dbInput.addEventListener('change', (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (f) handleManualStaticDbFile(f);
      });
    }
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', (ev) => {
        ev.preventDefault();
        dropZone.classList.remove('dragover');
        const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (f) handleSaveFile(f);
      });
    }

    // Tangkap event Install PWA Chrome Android
    window.addEventListener('beforeinstallprompt', (ev) => {
      ev.preventDefault();
      deferredInstallPrompt = ev;
      const btn = $('btn-install-pwa');
      if (btn) btn.classList.remove('app-hidden');
    });
  }

  // API publik untuk tombol UI
  window.LFApp = {
    openSavePicker() {
      showError('');
      setProgress(null);
      renderResumeCard();
      showLoaderScreen(true);
    },
    resumeLastDashboard() {
      if (cachedLastDashboard && cachedLastDashboard.data) {
        mountDashboard(cachedLastDashboard.data);
      }
    },
    triggerQuickSaveInput() {
      const inp = $('lf-file-input');
      if (inp) inp.click();
    },
    triggerDbUpload() {
      const inp = $('lf-db-file-input');
      if (inp) inp.click();
    },
    refreshStaticDb() {
      initStaticDb(true);
    },
    async installPwa() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (_) {}
      deferredInstallPrompt = null;
      const btn = $('btn-install-pwa');
      if (btn) btn.classList.add('app-hidden');
    },
  };

  window.addEventListener('DOMContentLoaded', async () => {
    registerServiceWorker();
    wireEvents();
    if (window.innerWidth <= 768) {
      const sf = $('scout-filter-details');
      if (sf) sf.removeAttribute('open');
    }

    // Cek save terakhir di IndexedDB supaya buka ulang PWA langsung instan!
    try {
      cachedLastDashboard = await ST.getLastDashboard();
      renderResumeCard();
    } catch (_) {
      cachedLastDashboard = null;
    }

    // Jalankan inisialisasi Static DB paralel di latar belakang
    const dbTask = initStaticDb(false);

    if (cachedLastDashboard && cachedLastDashboard.data && cachedLastDashboard.data.meta) {
      mountDashboard(cachedLastDashboard.data);
    } else {
      showLoaderScreen(true);
    }

    await dbTask;
  });
})();
