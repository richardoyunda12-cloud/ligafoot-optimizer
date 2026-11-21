/**
 * LigaFoot Optimizer Web App — gdrive.js
 * Integrasi Google Drive REST API v3 + Google Identity Services (GIS) untuk Opsi C:
 *   - Sinkronisasi save terbaru (modifiedTime desc) dengan nama tetap dari folder tertentu di My Drive.
 *   - Lintas HP/Browser via Link Pengaturan (#gd=...) sehingga buka di HP mana pun langsung siap.
 *   - 100% Client-Side (tanpa backend). Token akses read-only (drive.readonly) hanya di browser pengguna.
 */
(function (root) {
  'use strict';

  const STORAGE_CFG_KEY = 'lf_gdrive_cfg_v1';
  const STORAGE_TOK_KEY = 'lf_gdrive_tok_v1';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const GSI_SRC = 'https://accounts.google.com/gsi/client';

  const OLD_ORG_CLIENT_ID = '838675130193-1fdugv6f859tv7euqqgtv092b3m71ae6.apps.googleusercontent.com';

  // Client ID OAuth Web & lokasi default (root = My Drive di luar folder mana pun)
  const DEFAULT_CFG = {
    clientId: '573515773660-mcqctuj51c2rlhe99b3tvqsdcp7sjea8.apps.googleusercontent.com',
    folderId: 'root',
    folderName: 'My Drive (Di Luar Folder)',
    fileName: 'ligafoot_slot1.ligafoot',
    autoSync: true,
    lastFileId: '',
    lastModifiedTime: '',
    lastFileName: '',
    lastSyncedAt: '',
  };

  let gsiLoadPromise = null;
  let tokenClient = null;
  let tokenClientForId = '';
  let pendingTokenResolve = null;
  let pendingTokenReject = null;

  function loadConfig() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_CFG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) || {};
        const merged = Object.assign({}, DEFAULT_CFG, parsed);
        if (!merged.clientId || merged.clientId === OLD_ORG_CLIENT_ID) {
          merged.clientId = DEFAULT_CFG.clientId;
          clearToken();
        }
        if (!merged.folderId && DEFAULT_CFG.folderId) {
          merged.folderId = DEFAULT_CFG.folderId;
          merged.folderName = merged.folderName || DEFAULT_CFG.folderName;
        }
        return merged;
      }
    } catch (_) {}
    return Object.assign({}, DEFAULT_CFG);
  }

  function saveConfig(patch) {
    const cur = loadConfig();
    const next = Object.assign({}, cur, patch || {});
    next.clientId = String(next.clientId || '').trim();
    next.folderId = parseFolderId(next.folderId || '');
    next.folderName = String(next.folderName || '').trim();
    next.fileName = String(next.fileName || '').trim();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_CFG_KEY, JSON.stringify(next));
      }
    } catch (_) {}
    return next;
  }

  function parseFolderId(input) {
    const raw = String(input || '').trim();
    if (!raw) return 'root';
    const low = raw.toLowerCase();
    if (low === 'root' || low === 'mydrive' || low === 'my drive') return 'root';
    if (low === 'all' || low === 'semua' || low === '*') return 'all';
    // Cocokkan URL Google Drive folder:
    // https://drive.google.com/drive/folders/<ID>?usp=...
    // https://drive.google.com/drive/u/0/folders/<ID>
    // https://drive.google.com/open?id=<ID>
    const mFolder = raw.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
    if (mFolder) return mFolder[1];
    const mId = raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (mId) return mId[1];
    return raw;
  }

  function isConfigured(cfg) {
    const c = cfg || loadConfig();
    return Boolean(c.clientId && (c.folderId || c.fileName));
  }

  function loadToken() {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_TOK_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.accessToken) return null;
      // Beri margin aman 90 detik sebelum kedaluwarsa (token Google berlaku 3600 dtk)
      if (!obj.expiresAt || Date.now() > obj.expiresAt - 90000) return null;
      return obj;
    } catch (_) {
      return null;
    }
  }

  function saveToken(accessToken, expiresInSec, clientId) {
    const payload = {
      accessToken: String(accessToken || ''),
      expiresAt: Date.now() + Math.max(60, Number(expiresInSec) || 3500) * 1000,
      clientId: clientId || '',
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_TOK_KEY, JSON.stringify(payload));
      }
    } catch (_) {}
    return payload;
  }

  function clearToken() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_TOK_KEY);
      }
    } catch (_) {}
  }

  function encodeB64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeB64Url(b64) {
    const norm = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm + '==='.slice((norm.length + 3) % 4);
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function buildShareUrl(cfg) {
    const c = cfg || loadConfig();
    const payload = {
      c: c.clientId || '',
      f: c.folderId || '',
      fn: c.folderName || '',
      n: c.fileName || '',
      a: c.autoSync !== false ? 1 : 0,
    };
    const encoded = encodeB64Url(JSON.stringify(payload));
    const base = window.location.origin + window.location.pathname;
    return `${base}#gd=${encoded}`;
  }

  function importConfigFromUrl() {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      let rawToken = '';
      const hm = hash.match(/(?:^#|&)gd=([^&]+)/);
      if (hm) rawToken = hm[1];
      if (!rawToken) {
        const sm = search.match(/(?:^\?|&)gd=([^&]+)/);
        if (sm) rawToken = sm[1];
      }
      if (!rawToken) return null;

      const parsed = JSON.parse(decodeURIComponent(decodeB64Url(rawToken)));
      if (!parsed || (!parsed.c && !parsed.clientId)) return null;

      const next = saveConfig({
        clientId: parsed.c || parsed.clientId || '',
        folderId: parsed.f || parsed.folderId || '',
        folderName: parsed.fn || parsed.folderName || '',
        fileName: parsed.n !== undefined ? parsed.n : (parsed.fileName || ''),
        autoSync: parsed.a !== undefined ? Boolean(parsed.a) : true,
      });

      // Bersihkan parameter #gd= dari URL bar agar tidak mengimpor ulang terus, tapi tetap aman di-bookmark sebelumnya
      if (window.history && typeof window.history.replaceState === 'function') {
        const cleanUrl = window.location.pathname + (search.replace(/([?&])gd=[^&]+&?/, '$1').replace(/[?&]$/, ''));
        window.history.replaceState(null, '', cleanUrl);
      }
      return next;
    } catch (err) {
      console.warn('[LFGDrive] Gagal mengimpor konfigurasi #gd dari URL:', err);
      return null;
    }
  }

  function ensureGsiLoaded() {
    if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (gsiLoadPromise) return gsiLoadPromise;

    gsiLoadPromise = new Promise((resolve, reject) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        gsiLoadPromise = null;
        reject(new Error('Sedang offline — koneksi internet diperlukan untuk mengambil save dari Google Drive.'));
        return;
      }
      const existing = document.querySelector('script[data-lf-gsi="1"]');
      if (existing) {
        const waitTimer = setInterval(() => {
          if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            clearInterval(waitTimer);
            resolve();
          }
        }, 80);
        setTimeout(() => {
          clearInterval(waitTimer);
          if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) {
            gsiLoadPromise = null;
            reject(new Error('Gagal memuat Google Sign-In (timeout). Pastikan koneksi internet stabil.'));
          }
        }, 12000);
        return;
      }

      const sc = document.createElement('script');
      sc.src = GSI_SRC;
      sc.async = true;
      sc.defer = true;
      sc.dataset.lfGsi = '1';
      const timeoutId = setTimeout(() => {
        gsiLoadPromise = null;
        reject(new Error('Timeout memuat layanan Google Identity Services. Cek koneksi internet atau ad-blocker.'));
      }, 12000);

      sc.onload = () => {
        clearTimeout(timeoutId);
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve();
        } else {
          gsiLoadPromise = null;
          reject(new Error('Script Google Identity termuat tetapi API OAuth2 tidak tersedia.'));
        }
      };
      sc.onerror = () => {
        clearTimeout(timeoutId);
        gsiLoadPromise = null;
        reject(new Error('Gagal mengunduh script Google Sign-In. Cek koneksi internet atau matikan pemblokir tracker.'));
      };
      document.head.appendChild(sc);
    });

    return gsiLoadPromise;
  }

  async function requestAccessToken(clientId, options = {}) {
    const cid = String(clientId || loadConfig().clientId || '').trim();
    if (!cid) {
      throw new Error('Google OAuth Client ID belum diisi di Pengaturan Google Drive Sync.');
    }

    if (!options.forceRefresh) {
      const cached = loadToken();
      if (cached && cached.clientId === cid && cached.accessToken) {
        return cached.accessToken;
      }
    }

    await ensureGsiLoaded();

    return new Promise((resolve, reject) => {
      if (!tokenClient || tokenClientForId !== cid) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: DRIVE_SCOPE,
          callback: (resp) => {
            const resFn = pendingTokenResolve;
            const rejFn = pendingTokenReject;
            pendingTokenResolve = null;
            pendingTokenReject = null;
            if (!resFn || !rejFn) return;
            if (resp && resp.error) {
              rejFn(new Error(`Login Google dibatalkan/gagal: ${resp.error_description || resp.error}`));
              return;
            }
            if (!resp || !resp.access_token) {
              rejFn(new Error('Google tidak mengembalikan access token.'));
              return;
            }
            saveToken(resp.access_token, resp.expires_in, cid);
            resFn(resp.access_token);
          },
          error_callback: (err) => {
            const rejFn = pendingTokenReject;
            pendingTokenResolve = null;
            pendingTokenReject = null;
            if (!rejFn) return;
            const msg = (err && (err.message || err.type)) || 'Popup login ditutup atau diblokir browser.';
            rejFn(new Error(`Izin Google Drive gagal: ${msg}`));
          },
        });
        tokenClientForId = cid;
      }

      pendingTokenResolve = resolve;
      pendingTokenReject = reject;

      try {
        // prompt: '' mencoba refresh diam-diam jika akun Google sudah pernah memberi izin,
        // prompt: 'consent' memaksa layar pilih akun / izin baru.
        tokenClient.requestAccessToken({ prompt: options.prompt !== undefined ? options.prompt : '' });
      } catch (err) {
        pendingTokenResolve = null;
        pendingTokenReject = null;
        reject(err);
      }
    });
  }

  function escapeDriveQueryStr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  async function driveFetchJson(url, token) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (resp.status === 401) {
      clearToken();
      const err = new Error('Sesi token Google Drive kedaluwarsa (HTTP 401). Silakan klik Sync ulang.');
      err.code = 401;
      throw err;
    }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const j = await resp.json();
        if (j && j.error && j.error.message) detail = j.error.message;
      } catch (_) {}
      throw new Error(`Google Drive API error: ${detail}`);
    }
    return resp.json();
  }

  async function listFolders(token, searchQuery = '') {
    const parts = [
      "mimeType = 'application/vnd.google-apps.folder'",
      'trashed = false',
    ];
    if (searchQuery && searchQuery.trim()) {
      parts.push(`name contains '${escapeDriveQueryStr(searchQuery.trim())}'`);
    }
    const params = new URLSearchParams({
      q: parts.join(' and '),
      orderBy: 'modifiedTime desc',
      pageSize: '30',
      fields: 'files(id,name,modifiedTime,parents)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    const data = await driveFetchJson(`${DRIVE_API}/files?${params.toString()}`, token);
    return (data && Array.isArray(data.files)) ? data.files : [];
  }

  async function listSavesInFolder(token, folderId, fileName = '') {
    const fid = parseFolderId(folderId || 'root');
    const targetName = String(fileName || '').trim();
    const parts = [
      'trashed = false',
      "mimeType != 'application/vnd.google-apps.folder'",
    ];
    if (fid && fid !== 'all') {
      parts.unshift(`'${escapeDriveQueryStr(fid)}' in parents`);
    }
    if (targetName) {
      parts.push(`name = '${escapeDriveQueryStr(targetName)}'`);
    } else if (fid === 'all') {
      // Saat cari di seluruh Drive tanpa nama spesifik, batasi ke file .ligafoot agar tidak mengambil file non-save
      parts.push("(name contains '.ligafoot' or name contains 'ligafoot_')");
    }
    const params = new URLSearchParams({
      q: parts.join(' and '),
      orderBy: 'modifiedTime desc',
      pageSize: '15',
      fields: 'files(id,name,mimeType,size,modifiedTime,md5Checksum,parents)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    const data = await driveFetchJson(`${DRIVE_API}/files?${params.toString()}`, token);
    return (data && Array.isArray(data.files)) ? data.files : [];
  }

  async function downloadDriveFile(token, fileMeta) {
    if (!fileMeta || !fileMeta.id) throw new Error('Metadata file Google Drive tidak valid.');
    const url = `${DRIVE_API}/files/${encodeURIComponent(fileMeta.id)}?alt=media&supportsAllDrives=true`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (resp.status === 401) {
      clearToken();
      const err = new Error('Sesi token Google Drive kedaluwarsa (HTTP 401).');
      err.code = 401;
      throw err;
    }
    if (!resp.ok) {
      throw new Error(`Gagal mengunduh file dari Drive (HTTP ${resp.status}).`);
    }
    const buf = await resp.arrayBuffer();
    const fname = fileMeta.name || 'ligafoot_slot1.ligafoot';
    const modMs = fileMeta.modifiedTime ? Date.parse(fileMeta.modifiedTime) : Date.now();
    return {
      name: fname,
      size: buf.byteLength,
      lastModified: modMs,
      gdriveMeta: fileMeta,
      arrayBuffer: async () => buf,
      text: async () => new TextDecoder('utf-8').decode(buf),
    };
  }

  /**
   * Alur lengkap 1-klik:
   *   1. Pastikan akses token Google Drive tersedia (retry jika 401).
   *   2. Cari file terbaru (orderBy=modifiedTime desc) sesuai nama & folder.
   *   3. Unduh konten save paling baru tersebut sebagai pseudo-File siap parse.
   */
  async function fetchNewestSave(options = {}) {
    const cfg = loadConfig();
    if (!cfg.clientId) {
      throw new Error('Client ID Google OAuth belum diatur. Buka Pengaturan Google Drive Sync terlebih dahulu.');
    }
    const targetFolder = cfg.folderId || 'root';

    let token = await requestAccessToken(cfg.clientId, {
      prompt: options.interactive ? (options.prompt || '') : '',
      forceRefresh: Boolean(options.forceAuth),
    });

    let files;
    try {
      files = await listSavesInFolder(token, targetFolder, cfg.fileName);
    } catch (err) {
      if (err && err.code === 401) {
        token = await requestAccessToken(cfg.clientId, {
          forceRefresh: true,
          prompt: options.interactive ? 'consent' : '',
        });
        files = await listSavesInFolder(token, targetFolder, cfg.fileName);
      } else {
        throw err;
      }
    }

    if (!files || !files.length) {
      const folderLbl = cfg.folderName ? `"${cfg.folderName}"` : cfg.folderId;
      if (cfg.fileName) {
        throw new Error(
          `File "${cfg.fileName}" tidak ditemukan di folder Drive ${folderLbl}. ` +
          'Pastikan nama file persis sama (termasuk ekstensi) atau kosongkan kolom Nama File untuk ambil file terbaru apa saja.'
        );
      }
      throw new Error(`Folder Google Drive ${folderLbl} belum berisi file save.`);
    }

    const newest = files[0]; // Sudah terurut modifiedTime desc
    const isSameAsLast = Boolean(
      cfg.lastFileId &&
      cfg.lastFileId === newest.id &&
      cfg.lastModifiedTime &&
      cfg.lastModifiedTime === newest.modifiedTime
    );

    if (options.skipIfSame && isSameAsLast) {
      return { upToDate: true, meta: newest, candidatesCount: files.length };
    }

    const fileObj = await downloadDriveFile(token, newest);
    return {
      upToDate: false,
      isSameAsLast,
      meta: newest,
      candidatesCount: files.length,
      file: fileObj,
    };
  }

  function fmtRelativeTime(isoStr) {
    if (!isoStr) return '-';
    const ts = Date.parse(isoStr);
    if (isNaN(ts)) return isoStr;
    const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (diffSec < 60) return `${diffSec} dtk lalu`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  root.LFGDrive = {
    STORAGE_CFG_KEY,
    DRIVE_SCOPE,
    loadConfig,
    saveConfig,
    parseFolderId,
    isConfigured,
    loadToken,
    clearToken,
    buildShareUrl,
    importConfigFromUrl,
    ensureGsiLoaded,
    requestAccessToken,
    listFolders,
    listSavesInFolder,
    downloadDriveFile,
    fetchNewestSave,
    fmtRelativeTime,
  };
})(typeof window !== 'undefined' ? window : globalThis);
