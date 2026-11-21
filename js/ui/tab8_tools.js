// ==================== RENDER TAB 6 (LIGA, KALKULATOR & TIMNAS — v8.0) ====================
function setFinePct(pct) {
  const el = document.getElementById('c-fine-pct');
  if (el) { el.value = pct; calcAll(); }
}

function calcAll() {
  const raw = parseFloat(document.getElementById('c-offer').value) || 0;
  const u = document.getElementById('c-offer-u').value;
  const fmtU = v => u === 'M' ? v.toFixed(2) + ' M' : Math.round(v).toLocaleString('id-ID') + ' K';
  document.getElementById('c-offer-out').innerHTML = `
    <div>Angka Counter Optimal (<b>+40% / 1.40x</b>): <b class="mono c-green" style="font-size:16px">${fmtU(raw * 1.40)}</b> <span class="badge b-good">0% Risiko Batal</span></div>
    <div class="c-muted" style="margin-top:4px">Proyeksi Kas Realistis (<b>1.25x</b>): <b class="mono">${fmtU(raw * 1.25)}</b> (Rentang bayar AI: ${fmtU(raw * 1.10)} – ${fmtU(raw * 1.40)})</div>
    <div class="c-muted">Batas jurang batal AI (1.43x): ${fmtU(raw * 1.43)} — jangan melebihi 1.40x!</div>`;

  const days = parseInt(document.getElementById('c-days').value, 10);
  const sal = parseFloat(document.getElementById('c-sal').value) || 0;
  let muls, msg, cls, extraNote = '';
  if (!isNaN(days) && days >= 11 && days <= 59) {
    muls = [0.99, 0.97, 0.95, 0.88]; msg = '✅ GOLDEN WINDOW — RENEW 3 TAHUN (-12% GAJI GRATIS!)'; cls = 'c-green';
  } else if (!isNaN(days) && days <= 10) {
    muls = [1.25, 1.30, 1.35, 1.20]; msg = '🚨 ZONA JEBAKAN (<=10 hari) — Manual naik +20% s.d. +35%!'; cls = 'c-red';
    extraNote = `<div class="c-sky" style="margin-top:4px">💎 <b>Loophole Auto-Renew 0% (#37498):</b> Nyalakan Auto-Renew sementara (tandai <code>noAutoRenew</code> di cadangan) → saat 0 hari otomatis diperpanjang <b>+180 hari dengan gaji lama (${sal.toFixed(1)}K, 0% naik)</b>!</div>`;
  } else {
    muls = [1.10, 1.12, 1.15, 1.05]; msg = '⏳ TUNGGU DULU (>=60 hari) — Renew sekarang menaikkan gaji.'; cls = 'c-amber';
  }
  document.getElementById('c-renew-out').innerHTML = `
    <div class="${cls}" style="font-weight:800;margin-bottom:4px">${msg}</div>
    <div class="mono">6 Bln: ${(sal*muls[0]).toFixed(1)}K • 1 Thn: ${(sal*muls[1]).toFixed(1)}K • 2 Thn: ${(sal*muls[2]).toFixed(1)}K • <b class="c-green">3 Thn: ${(sal*muls[3]).toFixed(1)}K</b></div>
    ${extraNote}`;

  const spBase = parseFloat(document.getElementById('c-sp-base').value) || 0;
  const tier = parseInt(document.getElementById('c-sp-tier').value, 10) || 3;
  const maxLo = tier === 3 ? 0.07 : (tier === 2 ? 0.06 : 0.05);
  const safeAsk = maxLo * 1.3 + 0.03;
  const safePct = Math.floor(safeAsk * 100);
  document.getElementById('c-sp-out').innerHTML = `
    <div>Percobaan ke-1 — Minta Maks Aman: <b class="mono c-green">+${safePct}% (${Math.round(spBase * (1 + safePct / 100))}K)</b> <span class="badge b-good">0% Risiko Annoyed</span></div>
    <div class="c-muted" style="margin-top:4px">Jika sponsor membalas angka baru (<i>counter</i>), langsung <b>TERIMA</b> di percobaan ke-2.</div>`;

  const mSh = parseFloat(document.getElementById('c-pf-shop').value) || 1.0;
  const mMb = parseFloat(document.getElementById('c-pf-mem').value) || 1.05;
  const dMb = Math.max(0, Math.min(6, parseInt(document.getElementById('c-pf-disc').value, 10) || 0));
  const pfSh = priceFactorJS(mSh, 1.0, 1.3, 0.8);
  const idxSh = mSh * pfSh;
  const pfMb = priceFactorJS(mMb, 0.9, 1.2, 0.8);
  const shAnnual = Math.min(0.55, 0.045 * dMb);
  const demMb = pfMb * (1 + 0.0036 * dMb);
  const idxMb = mMb * (1 - shAnnual * (dMb / 100)) * demMb;
  document.getElementById('c-pf-out').innerHTML = `
    <div><b>Club Shop (${mSh.toFixed(2)}x):</b> Demand <b class="mono">${(pfSh*100).toFixed(2)}%</b> → Indeks <b class="mono ${Math.abs(mSh - 1.0) < 0.01 ? 'c-green' : 'c-amber'}">${(idxSh*100).toFixed(2)}%</b> (Puncak = 100.00% di 1.00x)</div>
    <div style="margin-top:4px"><b>Member Plan (${mMb.toFixed(2)}x / ${dMb}%):</b> Eff Demand <b class="mono">${(demMb*100).toFixed(2)}%</b> → Indeks <b class="mono ${idxMb >= 1.007 ? 'c-green' : 'c-sky'}">${(idxMb*100).toFixed(2)}%</b> (Puncak = 100.79% di 1.05x / 4%)</div>`;

  const fineOut = document.getElementById('c-fine-out');
  if (fineOut) {
    const fSal = parseFloat(document.getElementById('c-fine-sal').value) || 0;
    const fPct = Math.max(0, Math.min(100, parseFloat(document.getElementById('c-fine-pct').value) || 0));
    const safePctLim = (CFG.FINE_SAFE_PCT || 20);
    const cashGain = fSal * (fPct / 100);
    const slumpProb = fPct <= safePctLim ? 0 : +(0.50 * fPct).toFixed(1);
    const verdict = fPct <= safePctLim
      ? `<span class="badge b-good">✅ 0% RISIKO SLUMP — UANG GRATIS!</span>`
      : `<span class="badge ${slumpProb >= 40 ? 'b-crit' : 'b-warn'}">⚠ PELUANG SLUMP ${slumpProb}% (-3% performa × 30 hari)</span>`;
    fineOut.innerHTML = `
      <div>Uang Masuk ke Kas: <b class="mono c-green" style="font-size:16px">+${cashGain.toFixed(1)}K</b> ${verdict}</div>
      <div class="c-muted" style="margin-top:4px">Batas aman = <b>${safePctLim}%</b> (0% risiko). Di atas ${safePctLim}%, peluang slump = <code>0.50 × pct%</code>.</div>`;
  }
}

function renderTab8Extras() {
  const titleSt = computeTitleStatus();
  const ttEl = document.getElementById('t8-title-tracker');
  if (ttEl) {
    ttEl.innerHTML = titleSt
      ? `<div class="hero-match" style="margin-bottom:0;padding:11px 14px"><div style="font-size:13px;font-weight:800">${esc(titleSt.text)}</div><span class="badge ${titleSt.clinched ? 'b-good' : 'b-info'}">Total ${titleSt.totalRounds} Pekan</span></div>`
      : '';
  }

  document.getElementById('t8-standings-tbl').innerHTML = `<thead><tr><th>#</th><th>Klub</th><th>Main</th><th>M-S-K</th><th>SG</th><th>Poin</th></tr></thead><tbody>` +
    (D.standings.length ? D.standings.map(s => `<tr class="${s.isUser ? 'hl-user' : ''}">
      <td class="mono">${s.pos}</td><td>${esc(s.name)}</td><td class="mono">${s.p}</td>
      <td class="mono">${s.w}-${s.d}-${s.l}</td><td class="mono ${s.gd >= 0 ? 'c-green' : 'c-red'}">${s.gd >= 0 ? '+' : ''}${s.gd}</td><td class="mono"><b>${s.pts}</b></td>
    </tr>`).join('') : '<tr><td colspan="6" class="c-muted">Data klasemen tidak tersedia.</td></tr>') + `</tbody>`;

  document.getElementById('t8-precontracts').innerHTML = `<h3>📜 Pra-Kontrak / Bosman Aktif (${D.preContracts.length})</h3>` +
    (D.preContracts.length ? D.preContracts.map(pc => `<div>• <b>${esc(pc.playerName)}</b> (dari ${esc(pc.fromTeam)}) — tiba ${pc.arriveDate}, gaji ${fmtM(pc.salary)}/bln</div>`).join('')
    : '<div class="c-muted">Belum ada pra-kontrak aktif. Cek preset <b>Bosman (≤180d)</b> di Tab 4 Transfer &amp; Scout!</div>');

  document.getElementById('t8-nation').innerHTML = `<h3>🌍 Status Tim Nasional</h3>` +
    (D.nation ? `<div>Melatih Timnas: <span class="badge b-good">${esc(D.nation.iso)}</span> • Pemain dipanggil: <b>${D.nation.squadCount}</b></div>`
    : '<div class="c-muted">Saat ini tidak sedang melatih tim nasional.</div>');
}

// ==================== QUICK SEARCH (Ctrl+K) & CSV ====================
function openSearch() {
  document.getElementById('search-modal').classList.add('open');
  const inp = document.getElementById('qs-input');
  inp.value = ''; inp.focus();
  runQuickSearch();
}
function closeSearch() { document.getElementById('search-modal').classList.remove('open'); }
function runQuickSearch() {
  const q = (document.getElementById('qs-input').value || '').trim().toLowerCase();
  const out = document.getElementById('qs-results');
  if (!q) { out.innerHTML = '<div class="c-muted">Ketik minimal 2 huruf untuk mencari di Skuad Senior, Akademi, dan Global Scout...</div>'; return; }
  const hits = [];
  D.roster.forEach(p => { if (p.name.toLowerCase().includes(q)) hits.push({ tab: 't3', sub: 't3-squad', kind: 'roster', id: p.id, tag: 'SKUAD', title: `${p.name} (${fmtPos(p.pos)} ${p.age}th • F${p.force}/${p.potCap})`, subTxt: `${p.action} • Gaji ${fmtM(p.salary)}` }); });
  D.youth.forEach(y => { if (y.name.toLowerCase().includes(q)) hits.push({ tab: 't3', sub: 't3-acad', kind: 'youth', id: y.id, tag: 'AKADEMI', title: `${y.name} (${fmtPos(y.pos)} ${y.age}th • ★${y.hash})`, subTxt: `${y.action} • Dev ${y.development}` }); });
  D.scoutPool.forEach(r => { if (hits.length < 24 && (r[0].toLowerCase().includes(q) || r[16].toLowerCase().includes(q))) hits.push({ tab: 't4', sub: 't4-exp', kind: 'scout', id: r[19], tag: 'SCOUT', title: `${r[0]} (${fmtPos(r[1])} ${r[2]}th • F${r[5]}/${r[7]})`, subTxt: `${r[16]} • Est. Beli ${fmtM(r[14])} • Flip ${r[17]}` }); });

  out.innerHTML = hits.length ? hits.slice(0, 20).map(h => `
    <div class="alert-item" style="cursor:pointer" onclick="closeSearch();goToView('${h.tab}','${h.sub}');openPlayerDrawer('${h.kind}','${escJs(h.id)}')">
      <span class="badge ${h.tag === 'SKUAD' ? 'b-good' : (h.tag === 'AKADEMI' ? 'b-accent' : 'b-info')}">${h.tag}</span>
      <div><b>${esc(h.title)}</b><div class="c-muted" style="font-size:11px">${esc(h.subTxt)}</div></div>
    </div>`).join('') : '<div class="c-muted">Tidak ditemukan kecocokan.</div>';
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); closeGlossary(); closePlayerDrawer(); }
});

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Berhasil export ' + filename);
}

// ==================== INIT ====================
window.LFInitDashboard = function () {
  if (typeof window.LFResetUIState === 'function') window.LFResetUIState();

  document.title = `${D.meta.teamName} — LigaFoot Optimizer v8.1`;
  document.getElementById('hdr-title').textContent = `${D.meta.teamName} — LigaFoot Optimizer v8.1`;
  document.getElementById('hdr-sub').textContent =
    `${D.meta.currentDate} • Musim ${D.meta.season} Pekan ${D.meta.week} • Div ${D.meta.division} (${D.meta.country}) • ${D.meta.version}`;
  document.getElementById('hdr-badge').textContent = `v8.1 • ${D.meta.parseSec}s • ${D.meta.scoutPoolCount} Scout`;

  renderTab1();
  renderTab2();
  initTab3();
  renderRosterTable();
  renderTab5();
  renderTab6();
  renderTab7All();
  calcAll();
  renderTab8Extras();
  restoreLastView();
};
