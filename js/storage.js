/**
 * LigaFoot Optimizer Web App — storage.js
 * Penyimpanan lokal persisten di browser HP/PC (IndexedDB + fallback memori):
 *   1. Cache `static_db` (unduh static_db.min.json.gz 1x saja -> offline selamanya!)
 *   2. Simpan hasil dashboard terakhir (`last_dashboard`) agar buka ulang instan.
 *   3. Simpan `history_snapshots` untuk Delta Tracker antar-save di HP.
 *   4. Helper baca file `.ligafoot` & ekstrak `.gz` memakai DecompressionStream native.
 */
(function (root) {
  'use strict';

  const DB_NAME = 'LigaFootOptimizerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'kv';

  const KEYS = {
    STATIC_DB: 'static_db_v14',
    STATIC_DB_META: 'static_db_meta_v14',
    LAST_DASHBOARD: 'last_dashboard_v18',
    HISTORY: 'history_snapshots_v1',
  };

  // Fallback memori apabila IndexedDB diblokir (mode private ketat / Node.js)
  const memStore = new Map();
  let dbPromise = null;

  function hasIndexedDB() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (_) {
      return false;
    }
  }

  function openDb() {
    if (!hasIndexedDB()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function idbGet(key) {
    const db = await openDb();
    if (!db) return memStore.has(key) ? memStore.get(key) : null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(memStore.has(key) ? memStore.get(key) : null);
      } catch (_) {
        resolve(memStore.has(key) ? memStore.get(key) : null);
      }
    });
  }

  async function idbSet(key, val) {
    memStore.set(key, val);
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(val, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function idbDel(key) {
    memStore.delete(key);
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  /**
   * Ekstrak ArrayBuffer Gzip menjadi objek JSON menggunakan API native browser
   * (`DecompressionStream('gzip')`) tanpa library eksternal.
   */
  async function decompressGzipToJson(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzip) {
      const text = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(text);
    }
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser tidak mendukung DecompressionStream(gzip). Gunakan Chrome/Edge/Safari versi terbaru.');
    }
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  async function saveStaticDb(dbObj, meta = {}) {
    const playersCnt = dbObj && dbObj.players ? Object.keys(dbObj.players).length : 0;
    const clubsCnt = dbObj && dbObj.clubs ? Object.keys(dbObj.clubs).length : 0;
    const metaPayload = {
      playersCount: playersCnt,
      clubsCount: clubsCnt,
      savedAt: new Date().toISOString(),
      source: meta.source || 'network',
      version: meta.version || 'v1',
    };
    await idbSet(KEYS.STATIC_DB, dbObj);
    await idbSet(KEYS.STATIC_DB_META, metaPayload);
    return metaPayload;
  }

  async function getStaticDb() {
    return idbGet(KEYS.STATIC_DB);
  }

  async function getStaticDbMeta() {
    return idbGet(KEYS.STATIC_DB_META);
  }

  /**
   * Muat Static DB: cek cache IndexedDB dulu; jika belum ada, unduh dari
   * `data/static_db.min.json.gz` lalu simpan ke IndexedDB agar selanjutnya offline 0 MB!
   */
  async function ensureStaticDb(url = 'data/static_db.min.json.gz', onProgress = null, forceRefresh = false) {
    const prog = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };
    if (!forceRefresh) {
      const cached = await getStaticDb();
      if (cached && cached.players && Object.keys(cached.players).length > 0) {
        const meta = await getStaticDbMeta();
        prog(`Database statis siap dari cache lokal (${(meta && meta.playersCount) || Object.keys(cached.players).length} pemain).`);
        return { db: cached, meta, fromCache: true };
      }
    }

    prog('Mengunduh database statis (sekali saja, ~2–3 MB)...');
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} saat mengunduh ${url}`);
    }
    const buf = await resp.arrayBuffer();
    prog('Mengekstrak database statis di browser...');
    const dbObj = await decompressGzipToJson(buf);
    prog('Menyimpan cache database ke IndexedDB HP...');
    const meta = await saveStaticDb(dbObj, { source: url });
    return { db: dbObj, meta, fromCache: false };
  }

  async function loadStaticDbFromFile(file, onProgress = null) {
    const prog = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };
    if (!file) throw new Error('File database statis belum dipilih.');
    prog(`Membaca ${file.name}...`);
    const buf = await file.arrayBuffer();
    const dbObj = await decompressGzipToJson(buf);
    if (!dbObj || !dbObj.players) {
      throw new Error('Format database statis tidak valid (key "players" tidak ditemukan).');
    }
    const meta = await saveStaticDb(dbObj, { source: `file:${file.name}` });
    return { db: dbObj, meta };
  }

  async function readSaveFile(file, onProgress = null) {
    const prog = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };
    if (!file) throw new Error('File save .ligafoot belum dipilih.');
    prog(`Membaca ${(file.size / (1024 * 1024)).toFixed(2)} MB (${file.name})...`);
    let parsed;
    try {
      if (typeof file.arrayBuffer === 'function') {
        const buf = await file.arrayBuffer();
        prog('Mem-parse JSON save LigaFoot...');
        parsed = await decompressGzipToJson(buf);
      } else {
        const text = await file.text();
        prog('Mem-parse JSON save LigaFoot...');
        parsed = JSON.parse(text);
      }
    } catch (err) {
      throw new Error(`File bukan JSON LigaFoot yang valid (${err.message}). Pastikan memilih file .ligafoot hasil Export Save.`);
    }
    if (!parsed || !parsed.userTeamId || !parsed.compactTeams) {
      throw new Error('Struktur save LigaFoot tidak lengkap (userTeamId / compactTeams tidak ditemukan).');
    }
    return parsed;
  }

  async function saveLastDashboard(dataObj, fileMeta = {}) {
    return idbSet(KEYS.LAST_DASHBOARD, {
      data: dataObj,
      fileName: fileMeta.fileName || 'ligafoot_slot1.ligafoot',
      source: fileMeta.source || 'local',
      gdriveMeta: fileMeta.gdriveMeta || null,
      savedAt: new Date().toISOString(),
    });
  }

  async function getLastDashboard() {
    return idbGet(KEYS.LAST_DASHBOARD);
  }

  async function clearLastDashboard() {
    return idbDel(KEYS.LAST_DASHBOARD);
  }

  async function getHistory() {
    const h = await idbGet(KEYS.HISTORY);
    if (h && typeof h === 'object') return h;
    try {
      const ls = typeof localStorage !== 'undefined' && localStorage.getItem(KEYS.HISTORY);
      if (ls) return JSON.parse(ls);
    } catch (_) {}
    return {};
  }

  async function saveHistory(histObj) {
    const ok = await idbSet(KEYS.HISTORY, histObj);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(KEYS.HISTORY, JSON.stringify(histObj));
      }
    } catch (_) {}
    return ok;
  }

  async function clearAllCache() {
    await idbDel(KEYS.STATIC_DB);
    await idbDel(KEYS.STATIC_DB_META);
    await idbDel(KEYS.LAST_DASHBOARD);
    await idbDel('static_db_v14');
    await idbDel('static_db_meta_v14');
    await idbDel('last_dashboard_v18');
  }

  root.LFStorage = {
    KEYS,
    hasIndexedDB,
    decompressGzipToJson,
    saveStaticDb,
    getStaticDb,
    getStaticDbMeta,
    ensureStaticDb,
    loadStaticDbFromFile,
    readSaveFile,
    saveLastDashboard,
    getLastDashboard,
    clearLastDashboard,
    getHistory,
    saveHistory,
    clearAllCache,
  };
})(typeof window !== 'undefined' ? window : globalThis);
