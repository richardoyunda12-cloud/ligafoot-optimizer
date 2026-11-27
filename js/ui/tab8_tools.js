// ==================== RENDER TAB 6: LIGA, KALKULATOR, PWA & QUICK SEARCH (v8.2.5) ====================
let calcSelectedRenewPlayer = null;
let calcSelectedOfferPlayer = null;

function setFinePct(pct) {
  const el = document.getElementById('c-fine-pct');
  if (el) { el.value = pct; calcAll(); }
}

function fillPfFromSave() {
  const sEl = document.getElementById('c-pf-shop');
  const mEl = document.getElementById('c-pf-mem');
  const dEl = document.getElementById('c-pf-disc');
  if (sEl && D.shop) sEl.value = (D.shop.cur_m || 1.0).toFixed(2);
  if (mEl && D.member) mEl.value = (D.member.cur_m || 1.0).toFixed(2);
  if (dEl && D.member) dEl.value = D.member.cur_d ?? 0;
  calcAll();
  showToast('Diisi dari setelan Save saat ini');
}

function fillPfOptimal() {
  const sEl = document.getElementById('c-pf-shop');
  const mEl = document.getElementById('c-pf-mem');
  const dEl = document.getElementById('c-pf-disc');
  if (sEl) sEl.value = '1.00';
  if (mEl) mEl.value = '1.05';
  if (dEl) dEl.value = '6';
  calcAll();
  showToast('Diisi ke puncak optimal v1.2.0 (#21255: Shop 1.00x / Member 1.05x · Diskon 6%)');
}

function fillCalcFromPlayer(kind, pid) {
  const p = (D.roster || []).find(x => x.id === pid) || null;
  if (kind === 'offer') {
    calcSelectedOfferPlayer = p;
    if (p) {
      const inp = document.getElementById('c-offer');
      const unit = document.getElementById('c-offer-u');
      if (unit) unit.value = 'K';
      if (inp) inp.value = Math.round((p.estInitBid || p.marketValue || 0) / 1000);
    }
  } else if (kind === 'renew') {
    calcSelectedRenewPlayer = p;
    if (p) {
      const dEl = document.getElementById('c-days');
      const sEl = document.getElementById('c-sal');
      if (dEl) dEl.value = p.contractDays;
      if (sEl) sEl.value = +(p.salary / 1000).toFixed(1);
    }
  } else if (kind === 'fine') {
    if (p) {
      const fEl = document.getElementById('c-fine-sal');
      if (fEl) fEl.value = +(p.salary / 1000).toFixed(1);
    }
  }
  calcAll();
}

function populateCalcSquadSelects() {
  const roster = [...(D.roster || [])].sort((a, b) => b.force - a.force);
  const fillSel = (id, placeholder, fmtOpt) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      roster.map(p => `<option value="${esc(p.id)}">${esc(fmtOpt(p))}</option>`).join('');
  };
  fillSel('c-offer-player', '⚡ Isi otomatis dari Pemain Skuad...', p => `${p.name} (${fmtPos(p.pos)} ${p.age}th · MV ${fmtM(p.marketValue)}${p.isTop5Arab ? ' · ARAB' : ''})`);
  fillSel('c-renew-player', '⚡ Isi otomatis dari Pemain Skuad...', p => `${p.name} (${p.contractDays}d · Gaji ${fmtM(p.salary)}${p.squadRank <= 11 ? ' · Inti' : ''})`);
  fillSel('c-fine-player', '⚡ Isi gaji otomatis dari Pemain Skuad...', p => `${p.name} (${fmtPos(p.pos)} · Gaji ${fmtM(p.salary)}/bln)`);
}

function calcAll() {
  const CFG = (D.cfg && typeof D.cfg === 'object') ? D.cfg : ((window.LFEngine && LFEngine.config) || {});
  const ctrMax = Number(CFG.COUNTER_MAX_NORMAL || 1.40);
  const ctrAvg = Number(CFG.COUNTER_AVG_REALIZED || 1.25);
  const arabLo = Number(CFG.ARAB_OFFER_MIN_MUL || 2.5);
  const arabHi = Number(CFG.ARAB_OFFER_MAX_MUL || 3.0);
  const renewDiscDays = Number(CFG.RENEWAL_DISCOUNT_FROM_DAYS || 60);

  // 1. Counter-Offer (SSOT dari LFEngine.config)
  const raw = parseFloat((document.getElementById('c-offer') || {}).value) || 0;
  const u = (document.getElementById('c-offer-u') || {}).value || 'K';
  const fmtU = v => u === 'M' ? v.toFixed(2) + ' M' : Math.round(v).toLocaleString('id-ID') + ' K';
  const arabRef = calcSelectedOfferPlayer ? (calcSelectedOfferPlayer.marketValue / (u === 'M' ? 1e6 : 1e3)) : raw;
  const arabNote = calcSelectedOfferPlayer
    ? (calcSelectedOfferPlayer.isTop5Arab
        ? `💎 <b>Jackpot Arab Aktif (Top-5 ≥26th):</b> Tawaran Arab ~<b class="mono c-purple">${fmtU(arabRef * arabLo)} – ${fmtU(arabRef * arabHi)}</b> (cair utuh 0% fee, tapi tawaran Arab tidak bisa di-counter!)`
        : `<span class="c-muted">Info Arab (${arabLo}x–${arabHi}x MV, 0% fee, no counter): hanya aktif untuk Top-5 skuad usia ≥26th (~${fmtU(arabRef * arabLo)}–${fmtU(arabRef * arabHi)}).</span>`)
    : `<span class="c-muted">💎 <b>Jackpot Arab (${arabLo}–${arabHi}x MV):</b> ${fmtU(raw * arabLo)} – ${fmtU(raw * arabHi)} untuk Top-5 skuad ≥26th (0% fee, tidak bisa di-counter).</span>`;

  document.getElementById('c-offer-out').innerHTML = `
    <div>Counter Optimal (<b>+${Math.round((ctrMax - 1) * 100)}% / ${ctrMax.toFixed(2)}x</b>): <b class="mono c-green" style="font-size:16px">${fmtU(raw * ctrMax)}</b> <span class="badge b-good">0% Batal</span></div>
    <div class="c-muted" style="margin-top:4px">Realisasi Realistis (<b>${ctrAvg.toFixed(2)}x</b>): <b class="mono">${fmtU(raw * ctrAvg)}</b> (AI bayar ${fmtU(raw * 1.10)} – ${fmtU(raw * ctrMax)})</div>
    <div class="c-muted">Jurang batal AI (1.43x): ${fmtU(raw * 1.43)} — jangan lewati ${ctrMax.toFixed(2)}x!</div>
    <div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--border);font-size:11px">${arabNote}</div>`;

  // 2. Golden Window Renew (#24161 >=60d = -12%) + Loophole Auto-Renew 0% + Trik Bangku Cadangan (#24160)
  const days = parseInt((document.getElementById('c-days') || {}).value, 10);
  const sal = parseFloat((document.getElementById('c-sal') || {}).value) || 0;
  let muls, msg, cls, extraNote = '';
  if (!isNaN(days) && days >= renewDiscDays) {
    muls = (CFG.RENEWAL_DISCOUNT || [-0.01, -0.03, -0.05, -0.12]).map(d => 1 + d);
    msg = `✅ DISKON KONTRAK AKTIF (>=${renewDiscDays} hari, #24161) — RENEW 3 TAHUN (${Math.round((CFG.RENEWAL_DISCOUNT ? CFG.RENEWAL_DISCOUNT[3] : -0.12) * 100)}% GAJI GRATIS!)`;
    cls = 'c-green';
  } else if (!isNaN(days) && days <= 10) {
    muls = (CFG.RENEWAL_RAISE_LAST || [0.25, 0.30, 0.35, 0.20]).map(d => 1 + d);
    msg = '🚨 ZONA JEBAKAN (<=10 hari) — Manual naik +20% s.d. +35%!';
    cls = 'c-red';
    extraNote = `<div class="c-sky" style="margin-top:4px">💎 <b>Loophole Auto-Renew 0% (#37498):</b> Nyalakan Auto-Renew sementara (tandai <code>noAutoRenew</code> di cadangan) → saat 0 hari otomatis diperpanjang <b>+180 hari dengan gaji lama (${sal.toFixed(1)}K, 0% naik)</b>!</div>`;
  } else {
    muls = (CFG.RENEWAL_RAISE_MID || [0.10, 0.12, 0.15, 0.05]).map(d => 1 + d);
    msg = `⚠ ZONA MINTA NAIK (11–${renewDiscDays - 1} hari, #24161) — Renew manual sekarang menaikkan gaji +5% s.d. +15%! Tunggu <=10 hari (Loophole 0%).`;
    cls = 'c-amber';
  }
  const pAge = calcSelectedRenewPlayer ? calcSelectedRenewPlayer.age : 25;
  const pCuts = calcSelectedRenewPlayer ? calcSelectedRenewPlayer.salaryCuts : 0;
  const pRefs = calcSelectedRenewPlayer ? calcSelectedRenewPlayer.renewRefusals : 0;
  const stFloor = (window.LFEngine && LFEngine.utils && LFEngine.utils.salaryCutFloorMul)
    ? LFEngine.utils.salaryCutFloorMul(false, pAge, pCuts, pRefs) : 0.90;
  const resFloor = (window.LFEngine && LFEngine.utils && LFEngine.utils.salaryCutFloorMul)
    ? LFEngine.utils.salaryCutFloorMul(true, pAge, pCuts, pRefs) : 0.792;
  const benchSalCut = sal * resFloor;
  const isStarterSel = !calcSelectedRenewPlayer || calcSelectedRenewPlayer.squadRank <= 11;
  const benchNote = isStarterSel
    ? `<div class="c-sky" style="margin-top:4px;font-size:11px">🪑 <b>Trik Potong Gaji Cadangan (#24160):</b> Geser starter ke cadangan sebelum negosiasi potong gaji → lantai turun dari <b>${Math.round(stFloor * 100)}%</b> ke <b>${(resFloor * 100).toFixed(1)}%</b> (estimasi <b class="mono c-green">${benchSalCut.toFixed(1)}K/bln</b>, maks 1x potong)!</div>`
    : `<div class="c-muted" style="margin-top:4px;font-size:11px">Pemain ini sudah di luar Top-11 (lantai potong gaji cadangan ${(resFloor * 100).toFixed(1)}% aktif).</div>`;

  document.getElementById('c-renew-out').innerHTML = `
    <div class="${cls}" style="font-weight:800;margin-bottom:4px">${msg}</div>
    <div class="mono">6B: ${(sal * muls[0]).toFixed(1)}K · 1Th: ${(sal * muls[1]).toFixed(1)}K · 2Th: ${(sal * muls[2]).toFixed(1)}K · <b class="c-green">3Th: ${(sal * muls[3]).toFixed(1)}K</b></div>
    ${extraNote}${benchNote}`;

  // 3. Sponsor Negotiation (#20720, #20730, #20732: maxAsk = 0.02 + rng*0.06 + 0.07*perf + (tier===3?0.02:0), annoyed > maxAsk*1.3 + 0.03)
  const spBase = parseFloat((document.getElementById('c-sp-base') || {}).value) || 0;
  const tier = parseInt((document.getElementById('c-sp-tier') || {}).value, 10) || 3;
  const fanConf = (D.meta && D.meta.fanConf) !== undefined ? Number(D.meta.fanConf) : 70;
  const stRows = D.standings || [];
  const uSt = stRows.find(s => s.isUser);
  const posScore = (uSt && stRows.length > 1) ? Math.max(0, Math.min(1, 1 - (uSt.pos - 1) / (stRows.length - 1))) : 0.5;
  const fanScore = Math.max(0, Math.min(1, fanConf / 100));
  const perfScore = 0.6 * posScore + 0.4 * fanScore;
  const minMaxAsk = 0.02 + 0.07 * perfScore + (tier === 3 ? 0.02 : 0);
  const avgMaxAsk = minMaxAsk + 0.03;
  const safeAnnoyFloor = minMaxAsk * 1.3 + 0.03;
  const safePct = Math.floor(safeAnnoyFloor * 100);
  const avgGrantPct = Math.round(avgMaxAsk * 100);
  const nmYearly = (D.naming && D.naming.yearly) ? Number(D.naming.yearly) : 750000;
  const nmBase = nmYearly / 1.15;
  const loss5y = Math.round((nmBase * 1.15 - nmBase * 0.88));
  document.getElementById('c-sp-out').innerHTML = `
    <div>Percobaan ke-1 — Minta Maks 0% Batal (#20732): <b class="mono c-green">+${safePct}% (${Math.round(spBase * (1 + safePct / 100))}K)</b> <span class="badge b-good">0% Annoyed</span></div>
    <div class="c-muted" style="margin-top:3px">Rata-rata plafon sponsor di performa klubmu (Perf ${(perfScore * 100).toFixed(0)}%): <b>+${avgGrantPct}%</b> (${Math.round(spBase * (1 + avgGrantPct / 100))}K). Jika sponsor membalas angka baru (<i>counter</i>), langsung <b>TERIMA</b> di percobaan ke-2.</div>
    <div class="calc-naming-grid mono">
      <div class="calc-naming-box best"><b class="c-green">1 Thn ★</b><div>1.15x</div><div class="c-green" style="font-size:10px">+30.7% vs 5th</div></div>
      <div class="calc-naming-box"><b>3 Thn</b><div>1.00x</div><div class="c-muted" style="font-size:10px">Standar</div></div>
      <div class="calc-naming-box"><b class="c-red">5 Thn</b><div>0.88x</div><div class="c-red" style="font-size:10px">Rugi ~${fmtM(loss5y)}/thn</div></div>
    </div>`;

  // 4. priceFactor Tester (v1.2.0 #21255 Math.exp & #21260–#21277)
  const mSh = parseFloat((document.getElementById('c-pf-shop') || {}).value) || 1.0;
  const mMb = parseFloat((document.getElementById('c-pf-mem') || {}).value) || 1.05;
  const dMb = Math.max(0, Math.min(30, parseInt((document.getElementById('c-pf-disc') || {}).value, 10) || 0));
  const pfSh = priceFactorJS(mSh, 1.0, 1.3, 0.8);
  const idxSh = mSh * pfSh;
  const pfMb = priceFactorJS(mMb, 0.9, 1.2, 0.8);
  const shAnnual = Math.min(0.80, 0.03 * dMb);
  const demMb = pfMb * (1 + 0.12 * shAnnual);
  const idxMb = mMb * (1 - shAnnual * (dMb / 100)) * demMb;
  document.getElementById('c-pf-out').innerHTML = `
    <div><b>Club Shop (${mSh.toFixed(2)}x):</b> Demand <b class="mono">${(pfSh * 100).toFixed(2)}%</b> → Indeks <b class="mono ${Math.abs(mSh - 1.0) < 0.01 ? 'c-green' : 'c-amber'}">${(idxSh * 100).toFixed(2)}%</b> (Puncak = 100.00% di 1.00x)</div>
    <div style="margin-top:4px"><b>Member Plan (${mMb.toFixed(2)}x / ${dMb}%):</b> Eff Demand <b class="mono">${(demMb * 100).toFixed(2)}%</b> (Tahunan ${Math.round(shAnnual * 100)}%) → Indeks <b class="mono ${idxMb >= 1.011 ? 'c-green' : 'c-sky'}">${(idxMb * 100).toFixed(2)}%</b> (Puncak = 101.14% di 1.05x / 6% · 101.06% di 1.00x / 6%)</div>`;

  // 5. Denda Kartu Merah (#3753 & #24491)
  const fineOut = document.getElementById('c-fine-out');
  if (fineOut) {
    const fSal = parseFloat((document.getElementById('c-fine-sal') || {}).value) || 0;
    const fPct = Math.max(0, Math.min(100, parseFloat((document.getElementById('c-fine-pct') || {}).value) || 0));
    const safePctLim = (CFG.FINE_SAFE_PCT || 20);
    const cashGain = fSal * (fPct / 100);
    const slumpProb = fPct <= safePctLim ? 0 : +(0.50 * fPct).toFixed(1);
    const fineSlumpPct = fPct <= safePctLim ? 0 : +(3 + 0.05 * fPct).toFixed(1);
    const verdict = fPct <= safePctLim
      ? `<span class="badge b-good">✅ 0% RISIKO SLUMP — UANG GRATIS!</span>`
      : `<span class="badge ${slumpProb >= 40 ? 'b-crit' : 'b-warn'}">⚠ PELUANG SLUMP ${slumpProb}% (-${fineSlumpPct}% performa × 30d)</span>`;
    fineOut.innerHTML = `
      <div>Uang Masuk ke Kas: <b class="mono c-green" style="font-size:16px">+${cashGain.toFixed(1)}K</b> ${verdict}</div>
      <div class="c-muted" style="margin-top:4px">Batas aman = <b>${safePctLim}%</b> (0% risiko). Di atas ${safePctLim}%, peluang slump = <code>0.50 × pct%</code> dengan penalti <code>-(3 + 0.05 × pct)%</code> (cap -20%).</div>`;
  }
}

function openStandingRivalInWarRoom(teamId, teamName) {
  if (typeof openWarSimMode === 'function') {
    // Jika rival belum ada di simOpponents, tetap arahkan ke Simulasi War Room (cocokkan by id/name)
    const simList = (typeof getSimOpponentsList === 'function') ? getSimOpponentsList() : [];
    const hit = simList.find(o => o.id === teamId || String(o.name || '').toLowerCase() === String(teamName || '').toLowerCase());
    openWarSimMode(hit ? hit.id : undefined);
    goToView('t2');
    showToast(`🧪 Membuka War Room Simulasi vs ${hit ? hit.name : teamName}`);
  }
}

function renderRecentMatchesWithStreak() {
  const list = D.recentMatches || [];
  const stEl = document.getElementById('t6-form-streak');
  if (stEl) {
    const scored = list.filter(m => m.gf !== null && m.gf !== undefined && m.ga !== null && m.ga !== undefined);
    if (scored.length) {
      let w = 0, d = 0, l = 0, totGf = 0, totGa = 0;
      const pills = scored.slice(0, 10).map(m => {
        totGf += m.gf; totGa += m.ga;
        if (m.gf > m.ga) { w++; return `<span class="streak-pill streak-W" title="${esc(m.opp)} (${m.gf}-${m.ga})">M</span>`; }
        if (m.gf < m.ga) { l++; return `<span class="streak-pill streak-L" title="${esc(m.opp)} (${m.gf}-${m.ga})">K</span>`; }
        d++; return `<span class="streak-pill streak-D" title="${esc(m.opp)} (${m.gf}-${m.ga})">S</span>`;
      }).join('');
      stEl.innerHTML = `
        <div class="form-streak-bar">
          <div class="streak-pills">${pills}</div>
          <div class="mono"><b>${w}M·${d}S·${l}K</b> <span class="c-muted">(Gol ${totGf}–${totGa})</span></div>
        </div>`;
    } else {
      stEl.innerHTML = '';
    }
  }

  const tbl = document.getElementById('t3-recent-tbl');
  if (tbl) {
    tbl.innerHTML = `<thead><tr><th>Lawan &amp; Tgl</th><th>Skor</th><th>Venue</th></tr></thead><tbody>` +
      (list.length ? list.map(m => {
        const hasScore = (m.gf !== null && m.gf !== undefined && m.ga !== null && m.ga !== undefined);
        const cls = !hasScore ? 'b-muted' : (m.gf > m.ga ? 'b-good' : (m.gf < m.ga ? 'b-crit' : 'b-warn'));
        const scTxt = hasScore ? `${m.gf} - ${m.ga}` : (m.rev > 0 ? fmtM(m.rev) : (m.att ? m.att.toLocaleString('id-ID') + ' org' : '-'));
        return `<tr>
          <td><b>${esc(m.opp)}</b><div class="c-muted mono" style="font-size:10px">${esc(m.date)} · ${esc(m.comp)}</div></td>
          <td><span class="badge ${cls} mono">${scTxt}</span></td>
          <td>${m.home ? '🏠 Kandang' : '✈️ Tandang'}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="3" class="c-muted">Belum ada catatan laga.</td></tr>') + `</tbody>`;
  }
}

// ==================== PWA STORAGE & BACKUP MANAGER (SUB-TAB 6C) ====================
async function renderPwaManager() {
  const el = document.getElementById('t8-pwa-card');
  if (!el) return;
  const hasSw = ('serviceWorker' in navigator);
  let swActive = false;
  if (hasSw) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      swActive = Boolean(reg && reg.active);
    } catch (_) {}
  }
  let dbPlayers = 0, dbClubs = 0, snapCount = 0;
  try {
    if (window.LFStorage) {
      const meta = await window.LFStorage.getStaticDbMeta();
      if (meta) { dbPlayers = meta.playersCount || 0; dbClubs = meta.clubsCount || 0; }
      const hist = await window.LFStorage.getHistory();
      if (hist && typeof hist === 'object') {
        Object.values(hist).forEach(ch => { if (ch && typeof ch === 'object') snapCount += Object.keys(ch).length; });
      }
    }
  } catch (_) {}

  const shortCnt = (typeof shortlistMap === 'object' && shortlistMap) ? Object.keys(shortlistMap).length : 0;
  const verTxt = (D.meta && D.meta.version) || 'v8.11.0 PWA';
  const gd = window.LFGDrive;
  const gdCfg = gd ? gd.loadConfig() : null;
  const gdReady = Boolean(gd && gd.isConfigured(gdCfg));
  const gdLabel = gdReady
    ? `${gdCfg.folderName || gdCfg.folderId} · ${gdCfg.fileName || '(terbaru)'}`
    : 'Belum diatur (klik Setup di Ganti Save)';

  el.innerHTML = `
    <div class="pwa-kv-grid mono">
      <div class="pwa-kv-box"><span class="c-muted">Versi &amp; Mode Offline</span><b class="${swActive ? 'c-green' : 'c-amber'}">${swActive ? '✓ PWA Offline Siap' : 'Online Browser'}</b><span class="c-muted" style="font-size:10px">${esc(verTxt)}</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Cache Static DB HP</span><b class="c-sky">${dbPlayers ? dbPlayers.toLocaleString('id-ID') + ' pemain' : 'Belum di-cache'}</b><span class="c-muted" style="font-size:10px">${dbClubs.toLocaleString('id-ID')} klub</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Snapshot Delta Tracker</span><b class="c-green">${snapCount} tanggal</b><span class="c-muted" style="font-size:10px">Tersimpan di IndexedDB</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Google Drive Sync (Opsi C)</span><b class="${gdReady ? 'c-sky' : 'c-amber'}">${gdReady ? '☁️ Aktif Lintas HP' : '⚠ Belum Diatur'}</b><span class="c-muted" style="font-size:10px">${esc(gdLabel)}</span></div>
    </div>
    <div class="pill-row" style="margin-bottom:0">
      <button type="button" class="btn btn-sm btn-sky" onclick="if(window.LFApp)LFApp.syncGoogleDrive(true,{force:true})">☁️ Sync Drive</button>
      <button type="button" class="btn btn-sm" onclick="if(window.LFApp)LFApp.copyGDriveShareUrl()">🔗 Link Setup HP Lain</button>
      <button type="button" class="btn btn-sm btn-green" onclick="exportPwaBackupJson()">⬇ Export Backup (${shortCnt})</button>
      <button type="button" class="btn btn-sm" onclick="document.getElementById('pwa-import-file').click()">⬆ Import Backup</button>
      <button type="button" class="btn btn-sm" onclick="if(window.LFApp)LFApp.refreshStaticDb();showToast('Menyinkronkan Static DB...')">↻ Sync DB</button>
      <button type="button" class="btn btn-sm" onclick="clearPwaCacheConfirm()">🗑️ Bersihkan Cache</button>
    </div>`;
}

async function exportPwaBackupJson() {
  try {
    const hist = window.LFStorage ? await window.LFStorage.getHistory() : {};
    const payload = {
      app: 'LigaFoot Optimizer PWA',
      exportedAt: new Date().toISOString(),
      userId: D.meta ? D.meta.userId : '',
      shortlist: (typeof shortlistMap === 'object' && shortlistMap) ? shortlistMap : {},
      history: hist || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ligafoot_backup_${(D.meta && D.meta.currentDate) || 'data'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('Backup Shortlist & Delta History diunduh!');
  } catch (err) {
    showToast('Gagal export backup: ' + (err.message || err));
  }
}

async function importPwaBackupFile(file) {
  if (!file) return;
  try {
    const txt = await file.text();
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object') throw new Error('Format JSON tidak valid');
    if (obj.shortlist && typeof obj.shortlist === 'object') {
      shortlistMap = { ...(shortlistMap || {}), ...obj.shortlist };
      if (typeof saveShortlist === 'function') saveShortlist();
      if (typeof renderTab7All === 'function') renderTab7All();
    }
    if (obj.history && typeof obj.history === 'object' && window.LFStorage) {
      const curH = (await window.LFStorage.getHistory()) || {};
      const merged = { ...curH };
      for (const [tid, clubHist] of Object.entries(obj.history)) {
        if (!clubHist || typeof clubHist !== 'object' || Array.isArray(clubHist)) continue;
        const combined = { ...(merged[tid] && typeof merged[tid] === 'object' ? merged[tid] : {}), ...clubHist };
        const dates = Object.keys(combined).sort();
        if (dates.length > 40) {
          for (const oldD of dates.slice(0, dates.length - 40)) delete combined[oldD];
        }
        merged[tid] = combined;
      }
      await window.LFStorage.saveHistory(merged);
    }
    renderPwaManager();
    showToast('Backup Shortlist & Delta History berhasil dipulihkan!');
  } catch (err) {
    showToast('Gagal import backup: ' + (err.message || err));
  } finally {
    const inp = document.getElementById('pwa-import-file');
    if (inp) inp.value = '';
  }
}

let pwaClearArmed = false;
async function clearPwaCacheConfirm() {
  if (!pwaClearArmed) {
    pwaClearArmed = true;
    showToast('Ketuk lagi "Bersihkan Cache" dalam 5 detik untuk konfirmasi');
    setTimeout(() => { pwaClearArmed = false; }, 5000);
    return;
  }
  pwaClearArmed = false;
  if (window.LFStorage && typeof window.LFStorage.clearAllCache === 'function') {
    await window.LFStorage.clearAllCache();
    renderPwaManager();
    showToast('Cache Static DB & Save terakhir dibersihkan (Shortlist aman)');
  }
}

function renderTab8Extras() {
  // 1. Title Tracker & Klasemen 6A (Pas 360px + Warna Zona + Klik Rival -> War Room)
  const titleSt = computeTitleStatus();
  const ttEl = document.getElementById('t8-title-tracker');
  if (ttEl) {
    ttEl.innerHTML = titleSt
      ? `<div class="hero-match" style="margin-bottom:0;padding:11px 14px"><div style="font-size:13px;font-weight:800">${esc(titleSt.text)}</div><span class="badge ${titleSt.clinched ? 'b-good' : 'b-info'}">Total ${titleSt.totalRounds} Pekan</span></div>`
      : '';
  }

  const stRows = D.standings || [];
  const totalTeams = stRows.length;
  const relCut = totalTeams >= 12 ? (totalTeams - 2) : (totalTeams >= 8 ? totalTeams - 1 : 99);
  const pgTarget = (D.presGoals && D.presGoals.league && Number(D.presGoals.league.target)) || 4;

  document.getElementById('t8-standings-tbl').innerHTML = `<thead><tr><th>#</th><th>Klub</th><th>M</th><th>M-S-K</th><th>SG</th><th>Pts</th></tr></thead><tbody>` +
    (stRows.length ? stRows.map(s => {
      const zCls = s.pos === 1 ? 'zone-champ' : (s.pos <= pgTarget ? 'zone-top' : (s.pos >= relCut ? 'zone-rel' : 'zone-mid'));
      const clickAttr = s.isUser ? '' : `onclick="openStandingRivalInWarRoom('${escJs(s.teamId)}','${escJs(s.name)}')" title="Klik untuk simulasi War Room vs ${esc(s.name)}"`;
      return `<tr class="${s.isUser ? 'hl-user' : 'st-rival-row'}" ${clickAttr}>
        <td class="mono ${zCls}">${s.pos}</td>
        <td class="st-club-cell">${esc(s.name)}${s.isUser ? ' ★' : ''}</td>
        <td class="mono">${s.p}</td>
        <td class="mono">${s.w}-${s.d}-${s.l}</td>
        <td class="mono ${s.gd >= 0 ? 'c-green' : 'c-red'}">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
        <td class="mono"><b>${s.pts}</b></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="c-muted">Data klasemen tidak tersedia.</td></tr>') + `</tbody>`;

  // 2. Histori 10 Laga + Form Streak Strip
  renderRecentMatchesWithStreak();

  // 3. Populate dropdown Pemain Skuad di 5 Kalkulator
  populateCalcSquadSelects();

  // 4. Sub-Tab 6C: Pra-Kontrak + Preview Top 5 Bosman Gratis (≤180d & Reachable #23840/#23919)
  const bosmanTop5 = (D.scoutPool || [])
    .filter(r => String(r[18] || '').includes('BOSMAN') && !String(r[18] || '').includes('FREE') && !String(r[18] || '').includes('TRAP'))
    .sort((a, b) => (b[7] - a[7]) || (b[5] - a[5]))
    .slice(0, 5);

  const pcCnt = (D.preContracts || []).length;
  const pcHtml = pcCnt
    ? D.preContracts.map(pc => `<div class="bosman-mini-row"><div><b>${esc(pc.playerName)}</b> <span class="c-muted">(dari ${esc(pc.fromTeam)})</span></div><div class="mono c-green">${esc(pc.arriveDate)} · ${fmtM(pc.salary)}/bln</div></div>`).join('')
    : '<div class="c-muted mb-8">Belum ada pra-kontrak aktif. Rekrut bintang kontrak ≤180 hari secara <b>GRATIS (0€)</b>!</div>';

  const bosListHtml = bosmanTop5.map(r => `<div class="bosman-mini-row">
      <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        <a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a>
        <span class="c-muted" style="font-size:10.5px">(${fmtPos(r[1])} ${r[2]}th · ${esc(r[16])})</span>
      </div>
      <div class="mono" style="flex-shrink:0"><b>${r[5]}→<span class="c-green">${r[7]}</span></b> <span class="badge b-good">${r[15]}d</span></div>
    </div>`).join('');

  let bosPreviewHtml = '';
  if (bosmanTop5.length) {
    bosPreviewHtml = pcCnt > 0
      ? `<div class="mt-12"><div class="flex-between mb-8"><b>🆓 Top 5 Target Bosman Gratis (≤180d)</b><button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">Lihat Semua →</button></div>${bosListHtml}</div>`
      : `<details class="glossary-inline" style="margin-top:6px"><summary style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>🆓 Intip Top 5 Target Bosman Gratis (0€ ≤180d) ▼</span><button type="button" class="btn btn-sm btn-green" onclick="event.preventDefault();event.stopPropagation();goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">Lihat Semua →</button></summary><div style="margin-top:8px">${bosListHtml}</div></details>`;
  } else {
    bosPreviewHtml = `<div class="mt-8"><button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">🔎 Cari Target Bosman (≤180d) →</button></div>`;
  }

  document.getElementById('t8-precontracts').innerHTML = `<h3>📜 Pra-Kontrak / Bosman Aktif (${pcCnt})</h3>` + pcHtml + bosPreviewHtml;

  // 5. Sub-Tab 6C: Status Timnas + Interactive War Room + Call-Up Optimizer
  renderNationSection();

  // 6. Sub-Tab 6C: PWA Storage & Backup Manager
  renderPwaManager();
}

// ==================== SUB-TAB 6T: FORENSIK MATCHLOG (TIER 2 #5) ====================
let telScope = 'all';

function setTelScope(sc) {
  telScope = sc === 'season' ? 'season' : 'all';
  renderMatchTelemetry();
}

function renderMatchTelemetry() {
  const wrap = document.getElementById('t6-tel-wrap');
  if (!wrap) return;
  const mt = D.matchTelemetry || null;
  if (!mt || !mt.all || !mt.all.games) {
    wrap.innerHTML = `<div class="card"><div class="c-muted">Belum ada catatan <code>matchLog</code> yang terhubung dengan klub ini.</div></div>`;
    return;
  }

  const sc = (telScope === 'season' && mt.season && mt.season.games > 0) ? mt.season : mt.all;
  const hasSeason = Boolean(mt.season && mt.season.games > 0);
  const maxB = Math.max(1, ...((sc.minuteBuckets || []).map(b => Math.max(b.gf, b.ga))));
  const ph = sc.phases || { h1: { gf: 0, ga: 0 }, mid2: { gf: 0, ga: 0 }, orderZone: { gf: 0, ga: 0 }, lateShareGf: 0, lateShareGa: 0 };

  const formRows = (sc.byFormation || []).map(f => {
    const canOpen = (D.formations && f.formation in D.formations) || String(f.formation || '').includes('~');
    const attr = canOpen ? `style="cursor:pointer" onclick="openFormInTab3('${escJs(f.formation)}',false)" title="Klik → Buka di Lapangan Tab 3"` : '';
    const wCls = f.winPct >= 65 ? 'c-green' : (f.winPct >= 45 ? 'c-amber' : 'c-red');
    return `<tr ${attr}>
      <td><b>${esc(fmtForm(f.formation))}</b>${String(f.formation).includes('~') ? ' <span class="badge b-accent">CUSTOM</span>' : ''}</td>
      <td class="mono">${f.games}</td>
      <td class="mono">${f.w}-${f.d}-${f.l}</td>
      <td class="mono ${wCls}"><b>${f.winPct}%</b></td>
      <td class="mono col-hide-mob">${f.ppg}</td>
      <td class="mono col-hide-mob">${f.avgPos}%</td>
      <td class="mono">${f.gfPg}–${f.gaPg}</td>
    </tr>`;
  }).join('');

  const oppRows = (sc.vsOppFormation || []).map(f => {
    const wCls = f.winPct >= 65 ? 'c-green' : (f.winPct >= 45 ? 'c-amber' : 'c-red');
    return `<tr>
      <td><b>${esc(fmtForm(f.oppForm))}</b></td>
      <td class="mono">${f.games}</td>
      <td class="mono">${f.w}-${f.d}-${f.l}</td>
      <td class="mono ${wCls}"><b>${f.winPct}%</b></td>
      <td class="mono col-hide-mob">${f.ppg}</td>
      <td class="mono">${f.gfPg}–${f.gaPg}</td>
    </tr>`;
  }).join('');

  const pt = sc.playerTelemetry || { teamAvgRating: 6.5, overperformers: [], supersubs: [], underperformers: [] };
  const pRowHtml = (p, metricHtml) => `<div class="bosman-mini-row">
    <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      ${p.id ? `<a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>` : `<b>${esc(p.name)}</b>`}
      <span class="c-muted mono" style="font-size:10.5px">(${fmtPos(p.pos)}${p.force ? ' F' + p.force : ''} · ${p.apps}g)</span>
    </div>
    <div class="mono" style="flex-shrink:0">${metricHtml}</div>
  </div>`;

  wrap.innerHTML = `
    <div class="card mb-8">
      <div class="flex-between mb-8" style="gap:8px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">📊 Forensik &amp; Telemetri Pasca-Laga (<code>matchLog</code>)</h2>
          <div class="kpi-sub">Audit efektivitas formasi nyata, x-minute Match Orders, &amp; konversi peluang dari histori ${mt.all.games} pertandingan.</div>
        </div>
        <div class="t3-seg-2">
          <button type="button" class="btn btn-sm ${telScope === 'all' ? 'btn-green' : ''}" onclick="setTelScope('all')">Semua (${mt.all.games} Laga)</button>
          <button type="button" class="btn btn-sm ${telScope === 'season' ? 'btn-green' : ''}" ${hasSeason ? '' : 'disabled'} onclick="setTelScope('season')">Musim M${mt.currentSeason} (${mt.season ? mt.season.games : 0})</button>
        </div>
      </div>

      <div class="grid g4 mb-8">
        <div class="kpi">
          <span class="kpi-lbl">Rekor &amp; Poin/Laga</span>
          <span class="kpi-val c-green mono">${sc.winPct}% Win</span>
          <span class="kpi-sub mono">${sc.wins}M-${sc.draws}S-${sc.losses}K · <b>${sc.ppg} PPG</b> · SG ${sc.gd >= 0 ? '+' : ''}${sc.gd}</span>
        </div>
        <div class="kpi">
          <span class="kpi-lbl">Dominasi &amp; Akurasi</span>
          <span class="kpi-val c-sky mono">${sc.avgPos}% Pos</span>
          <span class="kpi-sub mono">Tembakan ${sc.avgShotsFor} vs ${sc.avgShotsAg} · Pass ${sc.avgPassFor}%</span>
        </div>
        <div class="kpi">
          <span class="kpi-lbl">Konversi Peluang</span>
          <span class="kpi-val c-green mono">${sc.convOtPct}% Gol/OT</span>
          <span class="kpi-sub mono">${sc.shotAccPct}% OT · ${sc.convShotPct}%/Shot · CS ${sc.cleanSheets}x</span>
        </div>
        <div class="kpi">
          <span class="kpi-lbl">Zona Order (66–90+')</span>
          <span class="kpi-val ${ph.orderZone.gf >= ph.orderZone.ga ? 'c-green' : 'c-red'} mono">${ph.orderZone.gf}–${ph.orderZone.ga}</span>
          <span class="kpi-sub mono">Gol ${ph.lateShareGf}% · Kebobolan ${ph.lateShareGa}% · K${sc.yellows}/M${sc.reds}</span>
        </div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
          <b>⏱️ Timeline Menit Gol vs Kebobolan &amp; Audit Match Orders</b>
          <div class="mono" style="font-size:11px;display:flex;gap:8px;flex-wrap:wrap">
            <span>B1 (0–45'): <b class="c-green">${ph.h1.gf}</b>–<b class="c-red">${ph.h1.ga}</b></span>
            <span>B2 Awal (46–65'): <b class="c-green">${ph.mid2.gf}</b>–<b class="c-red">${ph.mid2.ga}</b></span>
            <span>Order Zone (66–90+'): <b class="c-green">${ph.orderZone.gf}</b>–<b class="c-red">${ph.orderZone.ga}</b></span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
          ${(sc.minuteBuckets || []).map(b => {
            const wF = Math.round((b.gf / maxB) * 100);
            const wA = Math.round((b.ga / maxB) * 100);
            return `<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-size:11px">
              <div class="flex-between mono mb-8" style="margin-bottom:4px">
                <b>${esc(b.label)}</b>
                <span><b class="c-green">${b.gf}</b>:<b class="c-red">${b.ga}</b></span>
              </div>
              <div class="mini-bar-bg" style="height:6px;margin-bottom:4px"><div class="mini-bar-fill" style="width:${wF}%;background:var(--green)"></div></div>
              <div class="mini-bar-bg" style="height:6px"><div class="mini-bar-fill" style="width:${wA}%;background:var(--red)"></div></div>
            </div>`;
          }).join('')}
        </div>
        <div class="c-muted" style="font-size:11.5px;margin-top:8px">💡 <b>Evaluasi Match Orders:</b> ${esc(sc.orderVerdict)}</div>
      </div>

      <div class="grid g2 mb-8">
        <div>
          <h3>⚔️ Efektivitas Formasi Sendiri (Klik → Lapangan)</h3>
          <div class="tbl-wrap tbl-sticky" style="max-height:310px;overflow-y:auto">
            <table>
              <thead><tr><th>Formasi</th><th>M</th><th>M-S-K</th><th>Win%</th><th class="col-hide-mob">PPG</th><th class="col-hide-mob">Pos%</th><th>Gol/Kbl</th></tr></thead>
              <tbody>${formRows || '<tr><td colspan="7" class="c-muted">Belum ada data.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>🛡️ Rekor Melawan Formasi Lawan</h3>
          <div class="tbl-wrap tbl-sticky" style="max-height:310px;overflow-y:auto">
            <table>
              <thead><tr><th>Formasi Lawan</th><th>M</th><th>M-S-K</th><th>Win%</th><th class="col-hide-mob">PPG</th><th>Gol/Kbl</th></tr></thead>
              <tbody>${oppRows || '<tr><td colspan="6" class="c-muted">Belum ada data.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid g3">
        <div style="background:var(--bg2);border:1px solid rgba(16,185,129,.35);border-radius:10px;padding:9px 11px">
          <h3 class="c-green" style="margin-top:0">🔥 Overperformers (Avg Tim ${pt.teamAvgRating})</h3>
          ${pt.overperformers.length ? pt.overperformers.map(p => pRowHtml(p, `<span class="badge b-good">${p.avgRating}</span> · ${p.goals}G`)).join('') : '<div class="c-muted">Belum cukup laga.</div>'}
        </div>
        <div style="background:var(--bg2);border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:9px 11px">
          <h3 class="c-sky" style="margin-top:0">⚡ Top Supersubs (Rating Sub)</h3>
          ${pt.supersubs.length ? pt.supersubs.map(p => pRowHtml(p, `<span class="badge b-info">${p.subAvgRating}</span> · ${p.ratedSubs ?? p.subs} sub`)).join('') : '<div class="c-muted">Belum ada catatan supersub.</div>'}
        </div>
        <div style="background:var(--bg2);border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:9px 11px">
          <h3 class="c-amber" style="margin-top:0">⚠️ Performa Di Bawah Rata2 Tim</h3>
          ${pt.underperformers.length ? pt.underperformers.map(p => pRowHtml(p, `<span class="badge b-warn">${p.avgRating}</span>${p.cards ? ` · ${p.cards}K` : ''}`)).join('') : '<div class="c-muted">Semua pemain inti tampil di atas rata-rata ✓</div>'}
        </div>
      </div>
      <div class="c-muted" style="font-size:10.5px;margin-top:8px">ℹ️ Pemain pengganti menit 82+ dengan rating <code>null</code> dari engine tidak dihitung sebagai 0 sehingga rata-rata tetap akurat.</div>
    </div>`;
}

// ==================== SUB-TAB 6C: TIMNAS CALL-UP OPTIMIZER & WAR ROOM INTERAKTIF ====================
let natWarState = {
  matchIdx: 0,
  squadMode: 'called',
  formation: 'AUTO',
  style: 'AUTO',
  focus: 'AUTO',
  marking: 'Heavy',
  weather: 'AUTO',
  ref: 'AUTO',
  poolFilter: 'ALL',
};

function setNatWarOpt(key, val) {
  if (key === 'matchIdx') {
    natWarState.matchIdx = Number(val) || 0;
    natWarState.formation = 'AUTO';
    natWarState.style = 'AUTO';
    natWarState.focus = 'AUTO';
    natWarState.weather = 'AUTO';
    natWarState.ref = 'AUTO';
  } else {
    natWarState[key] = val;
  }
  renderNationSection();
}

function resetNatWarCond() {
  natWarState.weather = 'AUTO';
  natWarState.ref = 'AUTO';
  natWarState.formation = 'AUTO';
  natWarState.style = 'AUTO';
  natWarState.focus = 'AUTO';
  renderNationSection();
}

function renderNationSection() {
  const container = document.getElementById('t8-nation');
  if (!container) return;
  if (!D.nation || !D.nation.iso) {
    container.innerHTML = '<h3>🌍 Status Tim Nasional</h3><div class="c-muted">Saat ini tidak sedang melatih tim nasional.</div>';
    return;
  }

  const iso = String(D.nation.iso).toUpperCase();
  const tac = D.nation.tactics || {};
  const tacParts = [];
  if (tac.formation) tacParts.push(`Formasi: <b>${esc(fmtForm(tac.formation))}</b>`);
  if (tac.playStyle) tacParts.push(`Gaya: <b>${esc(tac.playStyle)}</b>`);
  if (tac.marking) tacParts.push(`Marking: <b>${esc(tac.marking)}</b>`);
  if (tac.attackFocus) tacParts.push(`Fokus: <b>${esc(tac.attackFocus)}</b>`);

  const natPoolAll = Array.isArray(D.nation.natPool) ? D.nation.natPool : [];
  const audit = D.nation.callupAudit || null;
  const swaps = (audit && Array.isArray(audit.swaps)) ? audit.swaps : [];
  const bugBanner = (audit && audit.hasBug343)
    ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">BUG 3-4-3 (#34992)</span><div><b>Formasi Timnas aktif 3-4-3 membuang slot penyerang ke-11 ke sektor 'X' (-33% ATK)!</b> Segera ganti formasi Timnas di game ke <b>${esc(fmtForm(audit.optForm || '3-5-2'))}</b> atau <b>4-3-3</b>!</div></div>`
    : '';

  const natMatches = Array.isArray(D.nation.upcomingMatches) ? D.nation.upcomingMatches : [];
  const natPreviews = Array.isArray(D.nation.matchPreviews) ? D.nation.matchPreviews : [];
  const natMo = D.nation.matchOrdersAudit || null;
  const natMoHtml = natMo ? `<div style="margin-bottom:8px;font-size:11px">Match Orders Timnas: <span class="badge ${natMo.issues && natMo.issues.length ? 'b-warn' : (natMo.activeCount > 0 ? 'b-good' : 'b-info')}">${natMo.activeCount}/${natMo.count} Aktif</span>${natMo.hasTiredSub ? ' <span class="badge b-good">Sub Lelah ✓</span>' : ''}${natMo.issues && natMo.issues.length ? ' ' + natMo.issues.map(it => `<span class="badge b-warn">${esc(it.title)}</span>`).join(' ') : ' <span class="c-muted">Aman tanpa bentrok ✓</span>'}</div>` : '';

  // 1) Interactive Timnas War Room Simulation
  let warRoomHtml = '';
  const Tac = (window.LFEngine && LFEngine.tactics) ? LFEngine.tactics : null;
  if (natPreviews.length && Tac) {
    if (natWarState.matchIdx >= natPreviews.length) natWarState.matchIdx = 0;
    const mp = natPreviews[natWarState.matchIdx];
    const acN = mp.autoCond || {};
    const effWeather = natWarState.weather === 'AUTO' ? (acN.weather || 'clear') : natWarState.weather;
    const effRef = natWarState.ref === 'AUTO' ? (acN.refStyle || 'normal') : natWarState.ref;
    const condF = Tac.resolveMatchCondFactors
      ? Tac.resolveMatchCondFactors({ weather: effWeather, refStyle: effRef, alt: acN.alt || 0, altHit: acN.altHit || 0, varOn: acN.varOn }, mp.isHome, Boolean(mp.neutral))
      : { weather: effWeather, refStyle: effRef, altHit: 0, missMul: 1, userEnergyMul: 1, oppEnergyMul: 1, userCardMul: 1, oppCardMul: 1 };

    const calledOnly = natPoolAll.filter(p => p.called && !p.injured && !p.suspended);
    const outSwapIds = new Set(swaps.map(s => s.out.id));
    const optimalSquad = natPoolAll.filter(p => p.called && !outSwapIds.has(p.id)).concat(swaps.map(s => s.in));
    const simPool = (natWarState.squadMode === 'optimal' && optimalSquad.length >= 11)
      ? optimalSquad
      : (calledOnly.length >= 11 ? calledOnly : natPoolAll);

    const validForms = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '4-1-2-1-2', '3-4-2-1']
      .filter(f => D.formations && (f in D.formations));
    const oppPool = (Array.isArray(mp.oppPoolSlim) && mp.oppPoolSlim.length >= 11) ? mp.oppPoolSlim : [];
    const oppXi = oppPool.length >= 11 ? Tac.solveBestXi(oppPool, mp.oForm || '4-3-3', 99, '', null, false, 3, false) : null;
    const oPowLive = oppXi
      ? Tac.computeEngineSectorPower(oppXi, mp.oForm || '4-3-3', {
          isHome: !mp.isHome, neutral: Boolean(mp.neutral), style: 'Balanced', marking: 'Heavy',
          altHit: condF.altHit, energyMul: condF.oppEnergyMul, cardMul: condF.oppCardMul,
        })
      : mp.oPow;

    const tryForms = natWarState.formation === 'AUTO' ? validForms : [natWarState.formation];
    const tryStyles = natWarState.style === 'AUTO' ? ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive'] : [natWarState.style];
    const tryFocuses = natWarState.focus === 'AUTO' ? ['Center', 'Wings'] : [natWarState.focus];
    const effMark = natWarState.marking || 'Heavy';

    let bestNatSim = null;
    for (const fk of tryForms) {
      const xi = Tac.solveBestXi(simPool, fk, 99, '');
      for (const stTry of tryStyles) {
        const uPow = Tac.computeEngineSectorPower(xi, fk, {
          isHome: mp.isHome, neutral: Boolean(mp.neutral), style: stTry, marking: effMark,
          altHit: condF.altHit, energyMul: condF.userEnergyMul, cardMul: condF.userCardMul,
        });
        for (const fcTry of tryFocuses) {
          const sim = Tac.simulateMatchExpectation(uPow, oPowLive, {
            isHome: mp.isHome, neutral: Boolean(mp.neutral), style: stTry, focus: fcTry,
            oppStyle: 'Balanced', oppFocus: 'Center', missMul: condF.missMul,
          });
          if (!bestNatSim || sim.xPts > bestNatSim.sim.xPts) {
            bestNatSim = { fk, xi, stTry, fcTry, uPow: { ...uPow, ATK: sim.effAtkUser }, sim };
          }
        }
      }
    }

    const nWIco = { clear: '☀️ Cerah', cloudy: '⛅ Berawan', rain: '🌧️ Hujan', heat: '🔥 Panas', snow: '❄️ Salju' };
    const nRIco = { strict: '🟥 Ketat', normal: '⚖️ Normal', lenient: '🟩 Longgar', home: '🏠 Pro-Home' };
    const cleanUPow = bestNatSim ? Tac.computeEngineSectorPower(bestNatSim.xi, bestNatSim.fk, { isHome: mp.isHome, neutral: Boolean(mp.neutral), style: bestNatSim.stTry, marking: effMark }) : null;
    const cleanOPow = oppXi ? Tac.computeEngineSectorPower(oppXi, mp.oForm || '4-3-3', { isHome: !mp.isHome, neutral: Boolean(mp.neutral), style: 'Balanced', marking: 'Heavy' }) : mp.oPow;
    const cleanSim = (cleanUPow && bestNatSim)
      ? Tac.simulateMatchExpectation(cleanUPow, cleanOPow, { isHome: mp.isHome, neutral: Boolean(mp.neutral), style: bestNatSim.stTry, focus: bestNatSim.fcTry, oppStyle: 'Balanced', oppFocus: 'Center', missMul: 1.0 })
      : null;
    const dCondWin = (bestNatSim && cleanSim) ? +(bestNatSim.sim.winPct - cleanSim.winPct).toFixed(1) : 0;

    warRoomHtml = bestNatSim ? `
      <div id="nat-warroom-box" style="margin-bottom:12px;padding:10px 12px;background:var(--bg2);border:1px solid rgba(168,85,247,.45);border-radius:10px">
        <div class="flex-between mb-8" style="gap:8px;flex-wrap:wrap">
          <div>
            <b>⚔️ War Room Timnas ${esc(iso)} Interaktif</b>
            <span class="c-muted" style="font-size:10.5px">(Simulasi Live vs ${esc(mp.oppIso)})</span>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${natPreviews.map((mItem, idx) => `<button type="button" class="btn btn-sm ${natWarState.matchIdx === idx ? 'btn-green' : ''}" onclick="setNatWarOpt('matchIdx',${idx})">${esc(mItem.home)} vs ${esc(mItem.away)}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center">
          <div class="t3-seg-2">
            <button type="button" class="btn btn-sm ${natWarState.squadMode === 'called' ? 'btn-green' : ''}" onclick="setNatWarOpt('squadMode','called')">25 Dipanggil</button>
            <button type="button" class="btn btn-sm ${natWarState.squadMode === 'optimal' ? 'btn-green' : ''}" onclick="setNatWarOpt('squadMode','optimal')">✨ Optimal Call-Up</button>
          </div>
          <select id="nat-wr-form" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('formation',this.value)">
            <option value="AUTO" ${natWarState.formation === 'AUTO' ? 'selected' : ''}>Formasi: AUTO</option>
            ${validForms.map(fk => `<option value="${fk}" ${natWarState.formation === fk ? 'selected' : ''}>${fmtForm(fk)}</option>`).join('')}
          </select>
          <select id="nat-wr-style" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('style',this.value)">
            <option value="AUTO" ${natWarState.style === 'AUTO' ? 'selected' : ''}>Gaya: AUTO</option>
            ${['Balanced', 'Offensive', 'Counter-Attack', 'Defensive'].map(st => `<option value="${st}" ${natWarState.style === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
          <select id="nat-wr-focus" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('focus',this.value)">
            <option value="AUTO" ${natWarState.focus === 'AUTO' ? 'selected' : ''}>Fokus: AUTO</option>
            <option value="Center" ${natWarState.focus === 'Center' ? 'selected' : ''}>Center</option>
            <option value="Wings" ${natWarState.focus === 'Wings' ? 'selected' : ''}>Wings</option>
          </select>
          <select id="nat-wr-mark" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('marking',this.value)">
            <option value="Light" ${natWarState.marking === 'Light' ? 'selected' : ''}>Mark: Light</option>
            <option value="Heavy" ${natWarState.marking === 'Heavy' ? 'selected' : ''}>Mark: Heavy</option>
            <option value="Very Heavy" ${natWarState.marking === 'Very Heavy' ? 'selected' : ''}>Mark: Very Heavy</option>
          </select>
          <select id="nat-wr-weather" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('weather',this.value)">
            <option value="AUTO" ${natWarState.weather === 'AUTO' ? 'selected' : ''}>Cuaca: Auto (${nWIco[acN.weather] || acN.weather || 'Cerah'})</option>
            ${Object.entries(nWIco).map(([k, lbl]) => `<option value="${k}" ${natWarState.weather === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
          <select id="nat-wr-ref" style="width:auto;padding:4px 7px;font-size:11px" onchange="setNatWarOpt('ref',this.value)">
            <option value="AUTO" ${natWarState.ref === 'AUTO' ? 'selected' : ''}>Wasit: Auto (${nRIco[acN.refStyle] || acN.refStyle || 'Normal'})</option>
            ${Object.entries(nRIco).map(([k, lbl]) => `<option value="${k}" ${natWarState.ref === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm" onclick="resetNatWarCond()">↺ Reset</button>
        </div>

        <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
          <div style="font-size:12px">
            <b>${esc(mp.home)} vs ${esc(mp.away)}</b> · <span class="c-muted">${esc(mp.compName)}${mp.roundName ? ' · ' + esc(mp.roundName) : ''} (Hari ${mp.day})</span>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <span class="badge b-good mono">${esc(fmtForm(bestNatSim.fk))} · Avg ${bestNatSim.xi.avgScore}</span>
            <span id="nat-wr-win-badge" class="badge ${bestNatSim.sim.winPct >= bestNatSim.sim.lossPct ? 'b-good' : 'b-warn'} mono">${bestNatSim.sim.winPct}% Win · ${bestNatSim.sim.drawPct}% D · ${bestNatSim.sim.lossPct}% L</span>
            <span class="badge b-info mono">${esc(bestNatSim.stTry)} · ${esc(bestNatSim.fcTry)} · ${esc(effMark)}</span>
          </div>
        </div>

        ${typeof renderH2HBars === 'function' ? renderH2HBars(bestNatSim.uPow, oPowLive) : ''}

        <div style="margin-top:6px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:11px">
          <span class="mono">xG <b class="c-green">${bestNatSim.sim.xGF}</b>–<b class="c-red">${bestNatSim.sim.xGA}</b> · Ball <b>${bestNatSim.sim.possPct}%</b> · xPts <b>${bestNatSim.sim.xPts}</b></span>
          <span class="mono c-muted">${nWIco[effWeather] || effWeather} · ${nRIco[effRef] || effRef}${acN.alt >= 2000 ? ` · ⛰️ ${acN.alt}m` : ''}${acN.varOn ? ' · VAR ON' : ''}${Math.abs(dCondWin) >= 0.1 ? ` · Kondisi ${dCondWin >= 0 ? '+' : ''}${dCondWin}% W` : ''}</span>
        </div>

        <details class="wr-xi-peek mt-8">
          <summary>👥 11 Starter Timnas (${esc(fmtForm(bestNatSim.fk))} · ${natWarState.squadMode === 'optimal' ? 'Optimal Call-Up' : '25 Dipanggil'})</summary>
          <div class="wr-xi-grid">${bestNatSim.xi.xi.map(a => {
            const p = a.player;
            const srcAttr = p.src ? `onclick="openPlayerDrawer('${p.src}','${escJs(p.id)}')"` : '';
            return `<div class="wr-xi-chip" ${srcAttr}><span><b class="mono c-sky">${fmtPos(a.slot)}</b> ${esc(p.name)}</span><b class="mono c-green">${p.force}</b></div>`;
          }).join('')}</div>
        </details>
      </div>` : '';
  }

  // 2) Call-Up Optimizer Section
  let callupHtml = '';
  if (audit) {
    callupHtml = `
      <div id="nat-callup-audit" style="margin-bottom:12px;padding:10px 12px;background:var(--bg2);border:1px solid rgba(16,185,129,.4);border-radius:10px">
        <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
          <div>
            <b>📣 Call-Up Optimizer Timnas ${esc(iso)}</b>
            <span class="c-muted" style="font-size:10.5px">(Bandingkan 25 dipanggil vs ${audit.poolCount || natPoolAll.length} pemain berpaspor ${esc(iso)})</span>
          </div>
          <div class="mono" style="font-size:11px">
            Best XI Dipanggil: <b>${audit.currentXiAvg}</b> (${esc(audit.curForm)}) → Optimal: <b class="c-green">${audit.optimalXiAvg}</b> (${esc(audit.optForm)}${audit.xiAvgGain > 0 ? `, +${audit.xiAvgGain}` : ''})
          </div>
        </div>
        ${swaps.length ? `
          <div class="tbl-wrap tbl-sticky" style="max-height:240px;overflow-y:auto">
            <table>
              <thead><tr><th>Sektor</th><th>⬇ Coret dari 25</th><th>⬆ Panggil Pengganti</th><th>ΔForce</th><th class="col-hide-mob">Alasan</th></tr></thead>
              <tbody>${swaps.map(sw => `<tr>
                <td><span class="badge b-accent">${esc(sw.sector)}</span></td>
                <td>${sw.out.src ? `<a class="clickable-name" onclick="openPlayerDrawer('${sw.out.src}','${escJs(sw.out.id)}')"><b>${esc(sw.out.name)}</b></a>` : `<b>${esc(sw.out.name)}</b>`} <span class="mono c-muted">(${fmtPos(sw.out.pos)} F${sw.out.force})</span></td>
                <td>${sw.in.src ? `<a class="clickable-name" onclick="openPlayerDrawer('${sw.in.src}','${escJs(sw.in.id)}')"><b>${esc(sw.in.name)}</b></a>` : `<b>${esc(sw.in.name)}</b>`} <span class="mono c-green">(${fmtPos(sw.in.pos)} <b>F${sw.in.force}</b> · ${esc(sw.in.clubName)})</span></td>
                <td class="mono c-green"><b>${sw.forceGain >= 0 ? '+' : ''}${sw.forceGain}</b></td>
                <td class="c-muted col-hide-mob">${esc(sw.reason)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>` : '<div class="c-good" style="font-size:11.5px">✓ 25 pemain yang dipanggil saat ini sudah mencakup seluruh pemain terkuat di posisinya!</div>'}
      </div>`;
  }

  // 3) Full Pool Table with Filter Chips
  const fMode = natWarState.poolFilter || 'ALL';
  const filteredPool = natPoolAll.filter(p => fMode === 'CALLED' ? p.called : (fMode === 'UNCALLED' ? !p.called : true));

  container.innerHTML = `
    <h3>🌍 Markas Tim Nasional ${esc(iso)}</h3>
    ${bugBanner}
    <div class="mb-8">Melatih Timnas: <span class="badge b-good">${esc(iso)}</span> · Skuad dipanggil: <b class="mono">${D.nation.squadCount || 0}</b> · Pool terdeteksi: <b class="mono">${(audit && audit.poolCount) || natPoolAll.length}</b> pemain</div>
    ${tacParts.length ? `<div class="c-muted mb-8" style="font-size:11.5px">Taktik aktif di save: ${tacParts.join(' · ')}</div>` : ''}
    ${natMoHtml}
    ${warRoomHtml}
    ${callupHtml}
    <div>
      <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
        <b>Daftar Pemain Berpaspor ${esc(iso)} (${filteredPool.length})</b>
        <div class="quick-chips-bar" style="margin:0">
          <button type="button" class="qchip ${fMode === 'ALL' ? 'active' : ''}" onclick="setNatWarOpt('poolFilter','ALL')">Semua (${natPoolAll.length})</button>
          <button type="button" class="qchip ${fMode === 'CALLED' ? 'active' : ''}" onclick="setNatWarOpt('poolFilter','CALLED')">✓ Dipanggil (${natPoolAll.filter(p => p.called).length})</button>
          <button type="button" class="qchip ${fMode === 'UNCALLED' ? 'active' : ''}" onclick="setNatWarOpt('poolFilter','UNCALLED')">🆓 Belum Dipanggil (${natPoolAll.filter(p => !p.called).length})</button>
        </div>
      </div>
      <div class="tbl-wrap tbl-sticky" style="max-height:330px;overflow-y:auto"><table>
        <thead><tr><th>Pemain</th><th>Pos</th><th class="col-hide-mob">Usia</th><th>Force</th><th class="col-hide-mob">Skill Stack</th><th>Klub</th></tr></thead>
        <tbody>${filteredPool.map(p => `<tr>
          <td>${p.src ? `<a class="clickable-name" onclick="openPlayerDrawer('${p.src}','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>` : `<b>${esc(p.name)}</b>`}${p.called ? ' <span class="badge b-info">DIPANGGIL</span>' : ''}${p.src === 'roster' ? ' <span class="badge b-good">KLUBMU</span>' : ''}</td>
          <td class="mono"><b>${fmtPos(p.pos)}</b></td>
          <td class="mono col-hide-mob">${p.age}</td>
          <td class="mono"><b class="c-green">${p.force}</b></td>
          <td class="col-hide-mob"><span class="badge ${p.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct || 0}%)</span></td>
          <td class="c-muted">${esc(p.clubName || '-')}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="c-muted">Tidak ada pemain berpaspor ' + esc(iso) + ' pada filter ini.</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

// ==================== QUICK SEARCH (Ctrl+K — Nama, Klub, Posisi & Tag) ====================
function openSearch() {
  document.getElementById('search-modal').classList.add('open');
  const inp = document.getElementById('qs-input');
  inp.value = '';
  inp.focus();
  runQuickSearch();
}
function closeSearch() { document.getElementById('search-modal').classList.remove('open'); }

function clearQuickSearch() {
  const inp = document.getElementById('qs-input');
  if (inp) { inp.value = ''; inp.focus(); }
  runQuickSearch();
}

function setQuickSearchQuery(qStr) {
  const inp = document.getElementById('qs-input');
  if (inp) { inp.value = qStr; inp.focus(); }
  runQuickSearch();
}

function runQuickSearch() {
  const raw = ((document.getElementById('qs-input') || {}).value || '').trim();
  const q = raw.toLowerCase();
  const qUp = raw.toUpperCase();
  const out = document.getElementById('qs-results');
  if (!q) {
    out.innerHTML = '<div class="c-muted">Ketik nama pemain, nama klub, kode posisi (<code>ST</code>, <code>LB</code>, <code>GK</code>), atau tag (<code>BOSMAN</code>, <code>UNH</code>, <code>GEM</code>)...</div>';
    return;
  }

  const knownPos = new Set(['GK', 'RB', 'LB', 'RCB', 'LCB', 'CB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'SS', 'ST', 'G', 'LD', 'LE', 'ZD', 'ZE', 'VOL', 'MC', 'MA', 'PD', 'PE', 'SA', 'ATA']);
  const knownFlags = new Set(['BOSMAN', 'UNH', 'GEM', 'FREE', 'LOCAL', 'GOD', 'TRAP', 'SALE', 'LOAN']);
  const isPosQuery = knownPos.has(qUp);
  const isFlagQuery = knownFlags.has(qUp);

  const hits = [];
  (D.roster || []).forEach(p => {
    const posStr = fmtPos(p.pos).toUpperCase();
    const hit = p.name.toLowerCase().includes(q)
      || (isPosQuery && (posStr === qUp || p.pos === qUp))
      || (qUp === 'GEM' && p.isGem)
      || (qUp === 'TRAP' && p.isTrap)
      || (qUp === 'UNH' && p.mood === 'unhappy');
    if (hit) {
      hits.push({ tab: 't3', sub: 't3-squad', kind: 'roster', id: p.id, tag: 'SKUAD', title: `${p.name} (${fmtPos(p.pos)} ${p.age}th • F${p.force}/${p.potCap})`, subTxt: `${p.action} • Gaji ${fmtM(p.salary)}` });
    }
  });
  (D.youth || []).forEach(y => {
    const posStr = fmtPos(y.pos).toUpperCase();
    if (y.name.toLowerCase().includes(q) || (isPosQuery && (posStr === qUp || y.pos === qUp))) {
      hits.push({ tab: 't3', sub: 't3-acad', kind: 'youth', id: y.id, tag: 'AKADEMI', title: `${y.name} (${fmtPos(y.pos)} ${y.age}th • ★${y.hash})`, subTxt: `${y.action} • Dev ${y.development}` });
    }
  });
  (D.scoutPool || []).forEach(r => {
    if (hits.length >= 28) return;
    const posStr = fmtPos(r[1]).toUpperCase();
    const flStr = String(r[18] || '').toUpperCase();
    const hit = r[0].toLowerCase().includes(q)
      || String(r[16] || '').toLowerCase().includes(q)
      || (isPosQuery && (posStr === qUp || r[1] === qUp))
      || (isFlagQuery && (flStr.includes(qUp) || (qUp === 'BOSMAN' && Number(r[15]) <= 180)));
    if (hit) {
      hits.push({ tab: 't4', sub: 't4-exp', kind: 'scout', id: r[19], tag: 'SCOUT', title: `${r[0]} (${fmtPos(r[1])} ${r[2]}th • F${r[5]}/${r[7]})`, subTxt: `${r[16]} • Beli ${r[15] <= 180 ? '0€ Bosman' : fmtM(r[14])} • Flip ${r[17]}` });
    }
  });

  out.innerHTML = hits.length ? hits.slice(0, 22).map(h => `
    <div class="alert-item" style="cursor:pointer" onclick="closeSearch();goToView('${h.tab}','${h.sub}');openPlayerDrawer('${h.kind}','${escJs(h.id)}')">
      <span class="badge ${h.tag === 'SKUAD' ? 'b-good' : (h.tag === 'AKADEMI' ? 'b-accent' : 'b-info')}">${h.tag}</span>
      <div><b>${esc(h.title)}</b><div class="c-muted" style="font-size:11px">${esc(h.subTxt)}</div></div>
    </div>`).join('') : '<div class="c-muted">Tidak ditemukan kecocokan.</div>';
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') {
    closeSearch();
    closeGlossary();
    if (typeof closeCompareModal === 'function') closeCompareModal();
    closePlayerDrawer();
  }
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

// ==================== INIT DASHBOARD (ERROR ISOLATED PER TAB) ====================
window.LFInitDashboard = function () {
  if (typeof window.LFResetUIState === 'function') window.LFResetUIState();
  calcSelectedRenewPlayer = null;
  calcSelectedOfferPlayer = null;

  document.title = `${D.meta.teamName} — LigaFoot Optimizer v8.11.0`;
  document.getElementById('hdr-title').innerHTML = `${esc(D.meta.teamName)} <span class="hdr-app-suffix">— LigaFoot Optimizer v8.11.0</span>`;
  const rsTag = D.meta.realScale ? ' • 📏 Real 0–100' : '';
  document.getElementById('hdr-sub').innerHTML =
    `<span class="hdr-sub-mob">${esc(D.meta.currentDate)} • M${D.meta.season} P${D.meta.week}${rsTag}</span>` +
    `<span class="hdr-sub-desk">${esc(D.meta.currentDate)} • Musim ${D.meta.season} Pekan ${D.meta.week} • Div ${D.meta.division} (${esc(D.meta.country)})${rsTag} • ${esc(D.meta.version)}</span>`;
  document.getElementById('hdr-badge').textContent = `v8.11.0 • ${D.meta.parseSec}s • ${D.meta.scoutPoolCount} Scout`;

  const _steps = [
    ['Tab1', renderTab1],
    ['Tab2', renderTab2],
    ['Tab3', initTab3],
    ['Tab4', renderRosterTable],
    ['Tab3Train', renderTrainingAudit],
    ['Tab3Growth', renderWonderkidTracker],
    ['Tab3BTeam', renderBTeamPanel],
    ['Tab5', renderTab5],
    ['Tab6', renderTab6],
    ['Tab7', () => renderTab7All(true)],
    ['Tab8', renderTab8Extras],
    ['Tab6Tel', renderMatchTelemetry],
    ['Calc', calcAll],
  ];
  for (const [nm, fn] of _steps) {
    try { fn(); } catch (err) { console.error('[LFInitDashboard] Gagal render ' + nm, err); }
  }
  restoreLastView();
};
