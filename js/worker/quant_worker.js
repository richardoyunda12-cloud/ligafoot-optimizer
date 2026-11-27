/**
 * LigaFoot Optimizer PWA — Background Quantitative Web Worker (v8.12.0)
 * Menjalankan Monte Carlo Musim, Farming ROI, & Combinatorial Bundle Solver di thread terpisah.
 */
'use strict';

importScripts(
  '../engine/config.js',
  '../engine/utils.js',
  '../engine/conditions.js',
  '../engine/economy.js',
  '../engine/tactics.js',
  '../engine/quant.js'
);

self.onmessage = function (ev) {
  const msg = (ev && ev.data) || {};
  const reqId = msg.reqId;
  const cmd = msg.cmd;
  const args = Array.isArray(msg.args) ? msg.args : [];
  if (!reqId) return;

  try {
    const q = self.LFEngine && self.LFEngine.quant;
    if (!q || typeof q[cmd] !== 'function') {
      throw new Error('Fungsi quant tidak ditemukan: ' + String(cmd));
    }
    const result = q[cmd](...args);
    self.postMessage({ reqId, ok: true, result });
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: (err && err.message) ? err.message : String(err) });
  }
};
