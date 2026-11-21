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
  if (dEl) dEl.value = '4';
  calcAll();
  showToast('Diisi ke puncak optimal v1.2.0 (1.00x / 1.05x·4%)');
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
  // 1. Counter-Offer (+40% aman vs 1.43x batal, realisasi 1.25x + Jackpot Arab 2.5-3.0x)
  const raw = parseFloat((document.getElementById('c-offer') || {}).value) || 0;
  const u = (document.getElementById('c-offer-u') || {}).value || 'K';
  const fmtU = v => u === 'M' ? v.toFixed(2) + ' M' : Math.round(v).toLocaleString('id-ID') + ' K';
  const arabRef = calcSelectedOfferPlayer ? (calcSelectedOfferPlayer.marketValue / (u === 'M' ? 1e6 : 1e3)) : raw;
  const arabNote = calcSelectedOfferPlayer
    ? (calcSelectedOfferPlayer.isTop5Arab
        ? `💎 <b>Jackpot Arab Aktif (Top-5 ≥26th):</b> Tawaran awal Arab ~<b class="mono c-purple">${fmtU(arabRef * 2.5)} – ${fmtU(arabRef * 3.0)}</b> (sebelum counter +40%!)`
        : `<span class="c-muted">Info Arab (2.5x–3x MV): hanya aktif untuk Top-5 skuad usia ≥26th (~${fmtU(arabRef * 2.5)}–${fmtU(arabRef * 3.0)}).</span>`)
    : `<span class="c-muted">💎 <b>Jackpot Arab (2.5–3x MV):</b> ${fmtU(raw * 2.5)} – ${fmtU(raw * 3.0)} untuk Top-5 skuad ≥26th.</span>`;

  document.getElementById('c-offer-out').innerHTML = `
    <div>Counter Optimal (<b>+40% / 1.40x</b>): <b class="mono c-green" style="font-size:16px">${fmtU(raw * 1.40)}</b> <span class="badge b-good">0% Batal</span></div>
    <div class="c-muted" style="margin-top:4px">Realisasi Realistis (<b>1.25x</b>): <b class="mono">${fmtU(raw * 1.25)}</b> (AI bayar ${fmtU(raw * 1.10)} – ${fmtU(raw * 1.40)})</div>
    <div class="c-muted">Jurang batal AI (1.43x): ${fmtU(raw * 1.43)} — jangan lewati 1.40x!</div>
    <div style="margin-top:5px;padding-top:5px;border-top:1px solid var(--border);font-size:11px">${arabNote}</div>`;

  // 2. Golden Window Renew + Loophole Auto-Renew 0% + Trik Bangku Cadangan (-12% Ekstra!)
  const days = parseInt((document.getElementById('c-days') || {}).value, 10);
  const sal = parseFloat((document.getElementById('c-sal') || {}).value) || 0;
  let muls, msg, cls, extraNote = '';
  if (!isNaN(days) && days >= 11 && days <= 59) {
    muls = [0.99, 0.97, 0.95, 0.88]; msg = '✅ GOLDEN WINDOW — RENEW 3 TAHUN (-12% GAJI GRATIS!)'; cls = 'c-green';
  } else if (!isNaN(days) && days <= 10) {
    muls = [1.25, 1.30, 1.35, 1.20]; msg = '🚨 ZONA JEBAKAN (<=10 hari) — Manual naik +20% s.d. +35%!'; cls = 'c-red';
    extraNote = `<div class="c-sky" style="margin-top:4px">💎 <b>Loophole Auto-Renew 0% (#37498):</b> Nyalakan Auto-Renew sementara (tandai <code>noAutoRenew</code> di cadangan) → saat 0 hari otomatis diperpanjang <b>+180 hari dengan gaji lama (${sal.toFixed(1)}K, 0% naik)</b>!</div>`;
  } else {
    muls = [1.10, 1.12, 1.15, 1.05]; msg = '⏳ TUNGGU DULU (>=60 hari) — Renew sekarang menaikkan gaji.'; cls = 'c-amber';
  }
  const benchSal3y = sal * muls[3] * 0.88;
  const isStarterSel = !calcSelectedRenewPlayer || calcSelectedRenewPlayer.squadRank <= 11;
  const benchNote = isStarterSel
    ? `<div class="c-sky" style="margin-top:4px;font-size:11px">🪑 <b>Trik Bangku Cadangan (#20882):</b> Geser starter ke indeks ≥11 sebelum renew 3th → ekstra <b>-12%</b> (estimasi <b class="mono c-green">${benchSal3y.toFixed(1)}K/bln</b>)!</div>`
    : `<div class="c-muted" style="margin-top:4px;font-size:11px">Pemain ini sudah di luar Top-11 (floor bangku sudah aktif).</div>`;

  document.getElementById('c-renew-out').innerHTML = `
    <div class="${cls}" style="font-weight:800;margin-bottom:4px">${msg}</div>
    <div class="mono">6B: ${(sal * muls[0]).toFixed(1)}K · 1Th: ${(sal * muls[1]).toFixed(1)}K · 2Th: ${(sal * muls[2]).toFixed(1)}K · <b class="c-green">3Th: ${(sal * muls[3]).toFixed(1)}K</b></div>
    ${extraNote}${benchNote}`;

  // 3. Sponsor Negotiation (0% Annoyed) + Naming Rights 1th vs 3th vs 5th Comparison
  const spBase = parseFloat((document.getElementById('c-sp-base') || {}).value) || 0;
  const tier = parseInt((document.getElementById('c-sp-tier') || {}).value, 10) || 3;
  const maxLo = tier === 3 ? 0.07 : (tier === 2 ? 0.06 : 0.05);
  const safeAsk = maxLo * 1.3 + 0.03;
  const safePct = Math.floor(safeAsk * 100);
  const nmYearly = (D.naming && D.naming.yearly) ? Number(D.naming.yearly) : 750000;
  const nmBase = nmYearly / 1.15;
  const loss5y = Math.round((nmBase * 1.15 - nmBase * 0.88));
  document.getElementById('c-sp-out').innerHTML = `
    <div>Percobaan ke-1 — Minta Maks Aman: <b class="mono c-green">+${safePct}% (${Math.round(spBase * (1 + safePct / 100))}K)</b> <span class="badge b-good">0% Annoyed</span></div>
    <div class="c-muted" style="margin-top:3px">Jika sponsor membalas angka baru (<i>counter</i>), langsung <b>TERIMA</b> di percobaan ke-2.</div>
    <div class="calc-naming-grid mono">
      <div class="calc-naming-box best"><b class="c-green">1 Thn ★</b><div>1.15x</div><div class="c-green" style="font-size:10px">+30.7% vs 5th</div></div>
      <div class="calc-naming-box"><b>3 Thn</b><div>1.00x</div><div class="c-muted" style="font-size:10px">Standar</div></div>
      <div class="calc-naming-box"><b class="c-red">5 Thn</b><div>0.88x</div><div class="c-red" style="font-size:10px">Rugi ~${fmtM(loss5y)}/thn</div></div>
    </div>`;

  // 4. priceFactor Tester (v1.2.0 #21338)
  const mSh = parseFloat((document.getElementById('c-pf-shop') || {}).value) || 1.0;
  const mMb = parseFloat((document.getElementById('c-pf-mem') || {}).value) || 1.05;
  const dMb = Math.max(0, Math.min(6, parseInt((document.getElementById('c-pf-disc') || {}).value, 10) || 0));
  const pfSh = priceFactorJS(mSh, 1.0, 1.3, 0.8);
  const idxSh = mSh * pfSh;
  const pfMb = priceFactorJS(mMb, 0.9, 1.2, 0.8);
  const shAnnual = Math.min(0.55, 0.045 * dMb);
  const demMb = pfMb * (1 + 0.0036 * dMb);
  const idxMb = mMb * (1 - shAnnual * (dMb / 100)) * demMb;
  document.getElementById('c-pf-out').innerHTML = `
    <div><b>Club Shop (${mSh.toFixed(2)}x):</b> Demand <b class="mono">${(pfSh * 100).toFixed(2)}%</b> → Indeks <b class="mono ${Math.abs(mSh - 1.0) < 0.01 ? 'c-green' : 'c-amber'}">${(idxSh * 100).toFixed(2)}%</b> (Puncak = 100.00% di 1.00x)</div>
    <div style="margin-top:4px"><b>Member Plan (${mMb.toFixed(2)}x / ${dMb}%):</b> Eff Demand <b class="mono">${(demMb * 100).toFixed(2)}%</b> → Indeks <b class="mono ${idxMb >= 1.007 ? 'c-green' : 'c-sky'}">${(idxMb * 100).toFixed(2)}%</b> (Puncak = 100.79% di 1.05x / 4%)</div>`;

  // 5. Denda Kartu Merah (#3753 & #24491)
  const fineOut = document.getElementById('c-fine-out');
  if (fineOut) {
    const fSal = parseFloat((document.getElementById('c-fine-sal') || {}).value) || 0;
    const fPct = Math.max(0, Math.min(100, parseFloat((document.getElementById('c-fine-pct') || {}).value) || 0));
    const safePctLim = (CFG.FINE_SAFE_PCT || 20);
    const cashGain = fSal * (fPct / 100);
    const slumpProb = fPct <= safePctLim ? 0 : +(0.50 * fPct).toFixed(1);
    const verdict = fPct <= safePctLim
      ? `<span class="badge b-good">✅ 0% RISIKO SLUMP — UANG GRATIS!</span>`
      : `<span class="badge ${slumpProb >= 40 ? 'b-crit' : 'b-warn'}">⚠ PELUANG SLUMP ${slumpProb}% (-3% performa × 30d)</span>`;
    fineOut.innerHTML = `
      <div>Uang Masuk ke Kas: <b class="mono c-green" style="font-size:16px">+${cashGain.toFixed(1)}K</b> ${verdict}</div>
      <div class="c-muted" style="margin-top:4px">Batas aman = <b>${safePctLim}%</b> (0% risiko). Di atas ${safePctLim}%, peluang slump = <code>0.50 × pct%</code>.</div>`;
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
  const verTxt = (D.meta && D.meta.version) || 'v8.2.5 PWA';

  el.innerHTML = `
    <div class="pwa-kv-grid mono">
      <div class="pwa-kv-box"><span class="c-muted">Versi &amp; Mode Offline</span><b class="${swActive ? 'c-green' : 'c-amber'}">${swActive ? '✓ PWA Offline Siap' : 'Online Browser'}</b><span class="c-muted" style="font-size:10px">${esc(verTxt)}</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Cache Static DB HP</span><b class="c-sky">${dbPlayers ? dbPlayers.toLocaleString('id-ID') + ' pemain' : 'Belum di-cache'}</b><span class="c-muted" style="font-size:10px">${dbClubs.toLocaleString('id-ID')} klub</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Snapshot Delta Tracker</span><b class="c-green">${snapCount} tanggal</b><span class="c-muted" style="font-size:10px">Tersimpan di IndexedDB</span></div>
      <div class="pwa-kv-box"><span class="c-muted">Shortlist Favorit</span><b class="c-purple">${shortCnt} target</b><span class="c-muted" style="font-size:10px">Persisten antar-save</span></div>
    </div>
    <div class="pill-row" style="margin-bottom:0">
      <button type="button" class="btn btn-sm btn-green" onclick="exportPwaBackupJson()">⬇ Export Backup Data</button>
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
      const curH = await window.LFStorage.getHistory();
      await window.LFStorage.saveHistory({ ...(curH || {}), ...obj.history });
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

  // 4. Sub-Tab 6C: Pra-Kontrak + Preview Top 5 Bosman Gratis (≤180d)
  const bosmanTop5 = (D.scoutPool || [])
    .filter(r => (String(r[18] || '').includes('BOSMAN') || Number(r[15]) <= 180) && !String(r[18] || '').includes('FREE') && !String(r[18] || '').includes('TRAP'))
    .sort((a, b) => (b[7] - a[7]) || (b[5] - a[5]))
    .slice(0, 5);

  const pcHtml = (D.preContracts && D.preContracts.length)
    ? D.preContracts.map(pc => `<div class="bosman-mini-row"><div><b>${esc(pc.playerName)}</b> <span class="c-muted">(dari ${esc(pc.fromTeam)})</span></div><div class="mono c-green">${esc(pc.arriveDate)} · ${fmtM(pc.salary)}/bln</div></div>`).join('')
    : '<div class="c-muted mb-8">Belum ada pra-kontrak aktif. Rekrut bintang kontrak ≤180 hari secara <b>GRATIS (0€)</b>!</div>';

  const bosPreviewHtml = bosmanTop5.length
    ? `<div class="mt-12"><div class="flex-between mb-8"><b>🆓 Top 5 Target Bosman Gratis (≤180d)</b><button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">Lihat Semua →</button></div>`
      + bosmanTop5.map(r => `<div class="bosman-mini-row">
          <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a>
            <span class="c-muted" style="font-size:10.5px">(${fmtPos(r[1])} ${r[2]}th · ${esc(r[16])})</span>
          </div>
          <div class="mono" style="flex-shrink:0"><b>${r[5]}→<span class="c-green">${r[7]}</span></b> <span class="badge b-good">${r[15]}d</span></div>
        </div>`).join('') + `</div>`
    : `<div class="mt-12"><button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">🔎 Cari Target Bosman (≤180d) →</button></div>`;

  document.getElementById('t8-precontracts').innerHTML = `<h3>📜 Pra-Kontrak / Bosman Aktif (${(D.preContracts || []).length})</h3>` + pcHtml + bosPreviewHtml;

  // 5. Sub-Tab 6C: Status Timnas + Taktik + Pemain Klub Senegara
  let natHtml = '<h3>🌍 Status Tim Nasional</h3>';
  if (D.nation && D.nation.iso) {
    const iso = String(D.nation.iso).toUpperCase();
    const tac = D.nation.tactics || {};
    const tacParts = [];
    if (tac.formation) tacParts.push(`Formasi: <b>${esc(fmtForm(tac.formation))}</b>`);
    if (tac.playStyle) tacParts.push(`Gaya: <b>${esc(tac.playStyle)}</b>`);
    if (tac.marking) tacParts.push(`Marking: <b>${esc(tac.marking)}</b>`);
    if (tac.attackFocus) tacParts.push(`Fokus: <b>${esc(tac.attackFocus)}</b>`);
    const clubCompatriots = (D.roster || []).filter(p => String(p.nationality || '').toUpperCase() === iso);

    natHtml += `
      <div class="mb-8">Melatih Timnas: <span class="badge b-good">${esc(iso)}</span> · Skuad dipanggil: <b class="mono">${D.nation.squadCount || 0}</b> pemain</div>
      ${tacParts.length ? `<div class="c-muted mb-8" style="font-size:11.5px">Taktik Timnas: ${tacParts.join(' · ')}</div>` : ''}
      <div style="border-top:1px solid var(--border);padding-top:8px">
        <b>Pemain Klubmu Berpaspor ${esc(iso)} (${clubCompatriots.length}):</b>
        <div class="pill-row mt-12" style="margin-bottom:0">${clubCompatriots.length
          ? clubCompatriots.map(p => `<span class="badge b-info delta-chip" onclick="openPlayerDrawer('roster','${escJs(p.id)}')">${esc(p.name)} (${fmtPos(p.pos)} F${p.force})</span>`).join(' ')
          : '<span class="c-muted">Belum ada pemain dari klubmu yang berpaspor ' + esc(iso) + '.</span>'}</div>
      </div>`;
  } else {
    natHtml += '<div class="c-muted">Saat ini tidak sedang melatih tim nasional.</div>';
  }
  document.getElementById('t8-nation').innerHTML = natHtml;

  // 6. Sub-Tab 6C: PWA Storage & Backup Manager
  renderPwaManager();
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

// ==================== INIT DASHBOARD (ERROR ISOLATED PER TAB) ====================
window.LFInitDashboard = function () {
  if (typeof window.LFResetUIState === 'function') window.LFResetUIState();
  calcSelectedRenewPlayer = null;
  calcSelectedOfferPlayer = null;

  document.title = `${D.meta.teamName} — LigaFoot Optimizer v8.2.5`;
  document.getElementById('hdr-title').innerHTML = `${esc(D.meta.teamName)} <span class="hdr-app-suffix">— LigaFoot Optimizer v8.2.5</span>`;
  document.getElementById('hdr-sub').innerHTML =
    `<span class="hdr-sub-mob">${esc(D.meta.currentDate)} • M${D.meta.season} P${D.meta.week}</span>` +
    `<span class="hdr-sub-desk">${esc(D.meta.currentDate)} • Musim ${D.meta.season} Pekan ${D.meta.week} • Div ${D.meta.division} (${esc(D.meta.country)}) • ${esc(D.meta.version)}</span>`;
  document.getElementById('hdr-badge').textContent = `v8.2.5 • ${D.meta.parseSec}s • ${D.meta.scoutPoolCount} Scout`;

  const _steps = [
    ['Tab1', renderTab1],
    ['Tab2', renderTab2],
    ['Tab3', initTab3],
    ['Tab4', renderRosterTable],
    ['Tab5', renderTab5],
    ['Tab6', renderTab6],
    ['Tab7', renderTab7All],
    ['Tab8', renderTab8Extras],
    ['Calc', calcAll],
  ];
  for (const [nm, fn] of _steps) {
    try { fn(); } catch (err) { console.error('[LFInitDashboard] Gagal render ' + nm, err); }
  }
  restoreLastView();
};
