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
  const GD = window.LFGDrive;

  let cachedStaticDb = null;
  let cachedLastDashboard = null;
  let isBusy = false;
  let deferredInstallPrompt = null;
  let gdSettingsOpen = false;
  let gdBannerDismissed = false;
  let gdFolderModalToken = '';

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
      const srcTag = cachedLastDashboard.source === 'gdrive' ? '☁️ Drive: ' : 'File: ';
      info.innerHTML =
        `<b>${m.teamName || 'Klub'}</b> (${m.currentDate || '-'}) • ` +
        `Kas <b>${Engine.utils.fmtMoney(m.budget)}</b> • ` +
        `${srcTag}<span class="mono">${cachedLastDashboard.fileName || 'save.ligafoot'}</span>`;
    }
  }

  function renderGDriveUi() {
    if (!GD) return;
    const cfg = GD.loadConfig();
    const configured = GD.isConfigured(cfg);
    const hasTok = Boolean(GD.loadToken());

    const badge = $('gd-status-badge');
    const summary = $('gd-summary-txt');
    const pullBtn = $('btn-gd-pull');
    const shareMini = $('btn-gd-share-mini');
    const topBtn = $('btn-topbar-gdrive');
    const originHint = $('gd-origin-hint');

    if (originHint && window.location && window.location.origin) {
      originHint.textContent = window.location.origin;
    }

    if (badge) {
      if (!configured) {
        badge.className = 'badge b-warn';
        badge.textContent = 'PERLU SETUP 1x';
      } else if (hasTok) {
        badge.className = 'badge b-good';
        badge.textContent = '✓ TERHUBUNG';
      } else {
        badge.className = 'badge b-info';
        badge.textContent = '☁️ SIAP SYNC';
      }
    }

    if (summary) {
      if (!configured) {
        summary.innerHTML = 'Atur <b>Client ID</b> + <b>Folder Google Drive</b> 1x saja agar semua HP bisa menarik save terbaru dengan nama yang sama.';
      } else {
        const fLbl = cfg.folderName ? `<b>${cfg.folderName}</b>` : `<span class="mono">${cfg.folderId}</span>`;
        const nLbl = cfg.fileName ? `<span class="mono">${cfg.fileName}</span>` : '<i>file terbaru apa saja</i>';
        const syncNote = cfg.lastSyncedAt
          ? ` · Terakhir tarik: <b>${GD.fmtRelativeTime(cfg.lastSyncedAt)}</b>`
          : '';
        summary.innerHTML = `Folder: ${fLbl} · Target: ${nLbl}${syncNote}`;
      }
    }

    if (pullBtn) {
      pullBtn.disabled = !configured;
      pullBtn.textContent = configured
        ? (cfg.fileName ? `☁️ Tarik "${cfg.fileName}" Terbaru` : '☁️ Tarik Save Terbaru dari Drive')
        : '☁️ Atur Pengaturan Drive Dulu (klik Setup)';
      if (!configured) {
        pullBtn.onclick = () => LFApp.toggleGDriveSettings(true);
      } else {
        pullBtn.onclick = () => LFApp.syncGoogleDrive(true);
      }
    }

    if (shareMini) shareMini.classList.toggle('app-hidden', !configured);
    if (topBtn) topBtn.classList.toggle('app-hidden', !configured);

    const cidEl = $('gd-client-id');
    const fidEl = $('gd-folder-input');
    const fnEl = $('gd-file-name');
    const autoEl = $('gd-auto-sync');
    const pickedEl = $('gd-folder-picked-lbl');
    if (cidEl && document.activeElement !== cidEl) cidEl.value = cfg.clientId || '';
    if (fidEl && document.activeElement !== fidEl) fidEl.value = cfg.folderId || '';
    if (fnEl && document.activeElement !== fnEl) fnEl.value = cfg.fileName || '';
    if (autoEl) autoEl.checked = cfg.autoSync !== false;
    if (pickedEl) {
      pickedEl.textContent = cfg.folderId
        ? `Folder aktif: ${cfg.folderName || '(tanpa label)'} [ID: ${cfg.folderId}]`
        : 'Belum ada folder dipilih.';
    }

    const panel = $('gd-settings-panel');
    const togBtn = $('gd-toggle-btn');
    if (panel) panel.classList.toggle('app-hidden', !gdSettingsOpen);
    if (togBtn) togBtn.textContent = gdSettingsOpen ? '▲ Tutup Setup' : '⚙️ Setup';

    // Sinkronkan juga info Drive di Tab 6C jika sudah ter-render
    if (typeof window.renderPwaManager === 'function') {
      try { window.renderPwaManager(); } catch (_) {}
    }
  }

  function renderDashDriveBanner(mode, customMsg) {
    const el = $('gd-dash-banner');
    if (!el) return;
    if (gdBannerDismissed || !GD || !GD.isConfigured()) {
      el.classList.add('app-hidden');
      el.innerHTML = '';
      return;
    }
    if (!mode) {
      el.classList.add('app-hidden');
      el.innerHTML = '';
      return;
    }
    const cfg = GD.loadConfig();
    const targetLbl = cfg.fileName || 'Save Terbaru';
    let textHtml = customMsg || '';
    if (mode === 'needs-auth') {
      textHtml = `☁️ <b>Google Drive Sync siap</b> (${cfg.folderName || 'Folder Drive'} / <span class="mono">${targetLbl}</span>) — ketuk untuk cek save terbaru dari HP lain.`;
    } else if (mode === 'checking') {
      textHtml = `⏳ Memeriksa save terbaru di Google Drive (<span class="mono">${targetLbl}</span>)...`;
    }
    el.classList.remove('app-hidden');
    el.innerHTML = `
      <div style="font-size:12px;line-height:1.35">${textHtml}</div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        ${mode === 'checking' ? '' : '<button type="button" class="btn btn-sm btn-green" onclick="LFApp.syncGoogleDrive(true, { force: true })">☁️ Tarik Save Terbaru</button>'}
        <button type="button" class="btn btn-sm" onclick="LFApp.dismissDriveBanner()" title="Sembunyikan">✕</button>
      </div>`;
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

  async function handleSaveFile(file, metaOpts = {}) {
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
      const source = metaOpts.source || 'local';
      const gdriveMeta = metaOpts.gdriveMeta || null;
      await ST.saveLastDashboard(data, { fileName: file.name, source, gdriveMeta });
      cachedLastDashboard = {
        data,
        fileName: file.name,
        source,
        gdriveMeta,
        savedAt: new Date().toISOString(),
      };
      if (GD && source === 'gdrive' && gdriveMeta) {
        GD.saveConfig({
          lastFileId: gdriveMeta.id || '',
          lastModifiedTime: gdriveMeta.modifiedTime || '',
          lastFileName: gdriveMeta.name || file.name,
          lastSyncedAt: new Date().toISOString(),
        });
        gdBannerDismissed = true;
        renderDashDriveBanner(null);
      } else if (GD && source === 'local') {
        GD.saveConfig({ lastFileId: '', lastModifiedTime: '' });
      }
      renderResumeCard();
      renderGDriveUi();

      setProgress(100, `Berhasil dianalisis dalam ${data.meta.parseSec} detik!`);
      await yieldFrame();
      setProgress(null);
      mountDashboard(data);
      if (typeof showToast === 'function') {
        const prefix = source === 'gdrive' ? '☁️ ' : '';
        showToast(`${prefix}Save ${data.meta.teamName} (${data.meta.currentDate}) siap! (${data.meta.parseSec}s)`);
      }
    } catch (err) {
      console.error('[LigaFoot WebApp Error]', err);
      setProgress(null);
      const msg = err && err.message ? err.message : 'Gagal memproses file save .ligafoot.';
      showError(msg);
      if (typeof showToast === 'function' && !$('webapp-dashboard-shell').classList.contains('app-hidden')) {
        showToast('⚠️ ' + msg);
      }
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

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const gm = $('gdrive-folder-modal');
        if (gm && gm.classList.contains('open')) gm.classList.remove('open');
      }
    });
  }

  function readGDriveFormPatch() {
    const cidEl = $('gd-client-id');
    const fidEl = $('gd-folder-input');
    const fnEl = $('gd-file-name');
    const autoEl = $('gd-auto-sync');
    const patch = {};
    if (cidEl) patch.clientId = cidEl.value.trim();
    if (fidEl) {
      const parsedId = GD.parseFolderId(fidEl.value);
      const prev = GD.loadConfig();
      patch.folderId = parsedId;
      if (parsedId !== prev.folderId) {
        patch.folderName = parsedId === 'root' ? 'My Drive (Root)' : '';
      }
    }
    if (fnEl) patch.fileName = fnEl.value.trim();
    if (autoEl) patch.autoSync = Boolean(autoEl.checked);
    return patch;
  }

  async function renderFolderPickerList(searchTerm = '') {
    const listEl = $('gd-folder-list');
    if (!listEl || !GD) return;
    listEl.innerHTML = '<div class="c-muted">⏳ Memuat daftar folder dari Google Drive...</div>';
    try {
      const folders = await GD.listFolders(gdFolderModalToken, searchTerm);
      if (!folders.length) {
        listEl.innerHTML = '<div class="c-muted">Tidak ada folder yang cocok. Coba kata kunci lain atau pilih Root.</div>';
        return;
      }
      listEl.innerHTML = folders.map((f) => {
        const mod = GD.fmtRelativeTime(f.modifiedTime);
        const safeId = String(f.id || '').replace(/'/g, "\\'");
        const safeName = String(f.name || 'Folder').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escName = String(f.name || 'Folder').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        return `<button type="button" class="gd-folder-item" onclick="LFApp.pickGDriveFolder('${safeId}','${safeName}')">
          <span>📁 <b>${escName}</b></span>
          <span class="mono c-muted" style="font-size:11px">${mod}</span>
        </button>`;
      }).join('');
    } catch (err) {
      if (err && err.code === 401) {
        gdFolderModalToken = await GD.requestAccessToken(GD.loadConfig().clientId, { forceRefresh: true, prompt: 'consent' });
        return renderFolderPickerList(searchTerm);
      }
      listEl.innerHTML = `<div class="c-red">⚠️ ${err && err.message ? err.message : 'Gagal membaca daftar folder Drive.'}</div>`;
    }
  }

  async function autoCheckDriveOnBoot() {
    if (!GD || !GD.isConfigured()) return;
    const cfg = GD.loadConfig();
    if (cfg.autoSync === false) return;

    const cachedTok = GD.loadToken();
    const inDashboard = !$('webapp-dashboard-shell').classList.contains('app-hidden');

    if (!cachedTok) {
      if (inDashboard) {
        renderDashDriveBanner('needs-auth');
      }
      return;
    }

    if (inDashboard) renderDashDriveBanner('checking');
    try {
      const res = await GD.fetchNewestSave({ interactive: false, skipIfSame: true });
      if (res && !res.upToDate && res.file) {
        renderDashDriveBanner(null);
        await handleSaveFile(res.file, { source: 'gdrive', gdriveMeta: res.meta });
      } else {
        renderDashDriveBanner(null);
      }
    } catch (_) {
      if (inDashboard) renderDashDriveBanner('needs-auth');
    }
  }

  // API publik untuk tombol UI
  window.LFApp = {
    openSavePicker() {
      showError('');
      setProgress(null);
      renderResumeCard();
      renderGDriveUi();
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
    toggleGDriveSettings(forceState) {
      gdSettingsOpen = typeof forceState === 'boolean' ? forceState : !gdSettingsOpen;
      renderGDriveUi();
    },
    saveGDriveForm(showNotify = true) {
      if (!GD) return null;
      const patch = readGDriveFormPatch();
      const cfg = GD.saveConfig(patch);
      renderGDriveUi();
      if (showNotify && typeof showToast === 'function') {
        showToast('💾 Pengaturan Google Drive Sync disimpan!');
      }
      return cfg;
    },
    async openGDriveFolderPicker() {
      if (!GD) return;
      if (gdSettingsOpen) this.saveGDriveForm(false);
      const cfg = GD.loadConfig();
      if (!cfg.clientId) {
        showError('Isi dulu Google OAuth Client ID sebelum memilih folder Drive.');
        gdSettingsOpen = true;
        renderGDriveUi();
        return;
      }
      showError('');
      try {
        gdFolderModalToken = await GD.requestAccessToken(cfg.clientId, { prompt: '' });
      } catch (err) {
        showError(err && err.message ? err.message : 'Login Google gagal.');
        return;
      }
      const modal = $('gdrive-folder-modal');
      if (modal) modal.classList.add('open');
      const inp = $('gd-folder-search');
      if (inp) inp.value = '';
      await renderFolderPickerList('');
    },
    closeGDriveFolderPicker() {
      const modal = $('gdrive-folder-modal');
      if (modal) modal.classList.remove('open');
    },
    async searchGDriveFolders() {
      const inp = $('gd-folder-search');
      await renderFolderPickerList(inp ? inp.value : '');
    },
    pickGDriveFolder(id, name) {
      if (!GD) return;
      GD.saveConfig({ folderId: id, folderName: name });
      this.closeGDriveFolderPicker();
      renderGDriveUi();
      if (typeof showToast === 'function') showToast(`📁 Folder dipilih: ${name}`);
    },
    async copyGDriveShareUrl() {
      if (!GD) return;
      if (gdSettingsOpen) this.saveGDriveForm(false);
      const cfg = GD.loadConfig();
      if (!GD.isConfigured(cfg)) {
        const msg = 'Lengkapi Client ID dan Folder Drive dulu sebelum menyalin link HP lain.';
        showError(msg);
        if (typeof showToast === 'function') showToast('⚠️ ' + msg);
        return;
      }
      const url = GD.buildShareUrl(cfg);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          if (typeof showToast === 'function') showToast('🔗 Link Setup disalin! Buka link ini di browser HP lain.');
          return;
        }
      } catch (_) {}
      window.prompt('Salin link di bawah ini lalu buka di HP lain:', url);
    },
    logoutGoogleDrive() {
      if (!GD) return;
      GD.clearToken();
      renderGDriveUi();
      if (typeof showToast === 'function') showToast('Sesi akun Google Drive direset. Klik Tarik Save untuk login ulang.');
    },
    dismissDriveBanner() {
      gdBannerDismissed = true;
      renderDashDriveBanner(null);
    },
    async syncGoogleDrive(interactive = true, opts = {}) {
      if (!GD || isBusy) return;
      if (gdSettingsOpen) this.saveGDriveForm(false);
      const cfg = GD.loadConfig();
      if (!GD.isConfigured(cfg)) {
        gdSettingsOpen = true;
        renderGDriveUi();
        const msg = 'Isi dulu Google OAuth Client ID dan Folder Drive di bagian Setup.';
        showError(msg);
        if (typeof showToast === 'function') showToast('⚠️ ' + msg);
        return;
      }

      const inDashboard = !$('webapp-dashboard-shell').classList.contains('app-hidden');
      const onLoader = !$('webapp-loader-screen').classList.contains('app-hidden');
      const skipIfSame = opts.skipIfSame !== undefined
        ? Boolean(opts.skipIfSame)
        : (inDashboard && !opts.force && cachedLastDashboard && cachedLastDashboard.source === 'gdrive');

      showError('');
      if (onLoader) setProgress(6, 'Menghubungkan ke Google Drive...');
      else if (typeof showToast === 'function') showToast('☁️ Mengecek save terbaru di Google Drive...');

      try {
        const res = await GD.fetchNewestSave({
          interactive,
          skipIfSame,
        });
        renderGDriveUi();

        if (res.upToDate) {
          gdBannerDismissed = true;
          renderDashDriveBanner(null);
          if (typeof showToast === 'function') {
            showToast(`✅ Save sudah paling baru (${res.meta.name} · ${GD.fmtRelativeTime(res.meta.modifiedTime)})`);
          }
          return;
        }

        await handleSaveFile(res.file, { source: 'gdrive', gdriveMeta: res.meta });
      } catch (err) {
        if (onLoader) setProgress(null);
        const msg = err && err.message ? err.message : 'Gagal mengambil save dari Google Drive.';
        showError(msg);
        if (typeof showToast === 'function') showToast('⚠️ ' + msg);
      }
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

    // Impor konfigurasi Google Drive otomatis jika dibuka lewat link #gd=... dari HP lain
    let importedFromUrl = null;
    if (GD) {
      importedFromUrl = GD.importConfigFromUrl();
      if (!GD.isConfigured()) gdSettingsOpen = true;
    }

    // Cek save terakhir di IndexedDB supaya buka ulang PWA langsung instan!
    try {
      cachedLastDashboard = await ST.getLastDashboard();
      renderResumeCard();
    } catch (_) {
      cachedLastDashboard = null;
    }

    renderGDriveUi();

    // Jalankan inisialisasi Static DB paralel di latar belakang
    const dbTask = initStaticDb(false);

    if (cachedLastDashboard && cachedLastDashboard.data && cachedLastDashboard.data.meta && !importedFromUrl) {
      mountDashboard(cachedLastDashboard.data);
    } else {
      showLoaderScreen(true);
    }

    if (importedFromUrl && typeof showToast === 'function') {
      showToast('🔗 Pengaturan Google Drive untuk HP ini otomatis aktif! Ketuk Tarik Save.');
    }

    await dbTask;
    await autoCheckDriveOnBoot();
  });
})();
