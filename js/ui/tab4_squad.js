// ==================== RENDER TAB 3B & 3C: AUDIT SKUAD, KONTRAK & TRAINING (v8.2.2) ====================
function sortRoster(col) {
  if (rosterSort.col === col) rosterSort.dir *= -1;
  else { rosterSort.col = col; rosterSort.dir = -1; }
  renderRosterTable();
}

function setRosterQuickFilter(val) {
  const sel = document.getElementById('t4-filter');
  if (sel) sel.value = val;
  renderRosterTable();
}

function matchRosterFilter(p, flt) {
  if (flt === 'GOLDEN') return p.contractDays >= 60 && p.contractDays <= 120;
  if (flt === 'DECLINE') return p.isDeclining || p.age >= p.sellWarnAge;
  if (flt === 'NONSTACK') return p.nonStack;
  if (flt === 'TRAP') return p.isTrap;
  if (flt === 'GEM') return p.isGem;
  if (flt === 'INJURED') return Boolean(p.injured);
  if (flt === 'UNHAPPY') return p.mood === 'unhappy' || p.roleSore;
  if (flt === 'SLUMP') return (p.fineSlump || 0) > 0;
  if (flt === 'LOOPHOLE') return !!p.autoRenewLoophole;
  return true;
}

function getFilteredRoster() {
  const q = ((document.getElementById('t4-search') || {}).value || '').toLowerCase();
  const flt = ((document.getElementById('t4-filter') || {}).value) || 'ALL';
  return (D.roster || []).filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q) || fmtPos(p.pos).toLowerCase().includes(q))) return false;
    return matchRosterFilter(p, flt);
  }).sort((a, b) => {
    const va = a[rosterSort.col], vb = b[rosterSort.col];
    if (typeof va === 'string') return va.localeCompare(vb) * rosterSort.dir;
    return ((va || 0) - (vb || 0)) * rosterSort.dir;
  });
}

function renderContractTimeline() {
  const el = document.getElementById('t4-contract-timeline');
  if (!el) return;
  const roster = D.roster || [];
  const bTrap = roster.filter(p => p.contractDays <= 10).sort((a, b) => a.contractDays - b.contractDays);
  const bSoon = roster.filter(p => p.contractDays >= 11 && p.contractDays <= 59).sort((a, b) => a.contractDays - b.contractDays);
  const bGold = roster.filter(p => p.contractDays >= 60 && p.contractDays <= 120).sort((a, b) => a.contractDays - b.contractDays);
  const bMid  = roster.filter(p => p.contractDays >= 121 && p.contractDays <= 180).sort((a, b) => a.contractDays - b.contractDays);

  const pills = (arr, extraFn) => arr.length
    ? arr.map(p => `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b> <span class="mono c-muted">${p.contractDays}d${extraFn ? extraFn(p) : ''}</span></span>`).join('')
    : '<span class="c-muted" style="font-size:11px">Tidak ada</span>';

  // Auto-collapse di layar HP (<=768px) agar tabel skuad langsung terlihat di layar pertama!
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const openAttr = (!isMobile && (bTrap.length || bGold.length || bSoon.length)) ? 'open' : '';

  el.innerHTML = `
    <details class="glossary-inline" ${openAttr} style="padding:8px 11px;margin-bottom:6px">
      <summary>📅 Kontrak 6 Bln: 🚨 ${bTrap.length} Jebakan · ⚠ ${bSoon.length} Naik +5–15% · ✅ ${bGold.length} Golden (-12%)</summary>
      <div class="timeline-grid mt-12">
        <div class="tl-bucket ${bTrap.length ? 'crit' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bTrap.length ? 'c-red' : 'c-muted'}">🚨 Zona Jebakan ≤10d (${bTrap.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Pakai Loophole Auto-Renew 0% / Lepas Gratis</div>
          <div>${pills(bTrap)}</div>
        </div>
        <div class="tl-bucket ${bSoon.length ? 'warn' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bSoon.length ? 'c-amber' : 'c-muted'}">⚠ Zona Minta Naik 11–59d (${bSoon.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Jangan renew (+5–15%)! Tunggu ≤10d Loophole 0%</div>
          <div>${pills(bSoon)}</div>
        </div>
        <div class="tl-bucket ${bGold.length ? 'good' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bGold.length ? 'c-green' : 'c-muted'}">✅ Golden Window 60–120d (${bGold.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Renew 3 Tahun = Potong Gaji -12% Gratis (#24161)!</div>
          <div>${pills(bGold, p => ` (${p.contractDays - 59}d lg)`)}</div>
        </div>
        <div class="tl-bucket">
          <div style="font-size:11px;font-weight:800" class="c-sky">📆 Diskon Aktif 121–180d (${bMid.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Sudah bisa renew 3Th (-12%) atau pantau</div>
          <div>${pills(bMid)}</div>
        </div>
      </div>
    </details>`;
}

function renderRosterQuickChips() {
  const el = document.getElementById('t4-quick-chips');
  if (!el) return;
  const roster = D.roster || [];
  const curFlt = ((document.getElementById('t4-filter') || {}).value) || 'ALL';
  const defs = [
    ['ALL', 'Semua'],
    ['GOLDEN', '✅ Golden'],
    ['DECLINE', '📉 Regresi'],
    ['GEM', '💎 Gem'],
    ['INJURED', '🏥 Cedera'],
    ['NONSTACK', '⚠ Non-Stack'],
    ['TRAP', '🚨 Trap'],
    ['UNHAPPY', '😠 Unhappy'],
    ['SLUMP', '🟥 Slump'],
    ['LOOPHOLE', '🔄 Loop 0%'],
  ];
  el.innerHTML = defs.map(([val, lbl]) => {
    const cnt = val === 'ALL' ? roster.length : roster.filter(p => matchRosterFilter(p, val)).length;
    if (val !== 'ALL' && val !== curFlt && cnt === 0 && ['SLUMP', 'LOOPHOLE', 'UNHAPPY'].includes(val)) return '';
    return `<button type="button" class="qchip ${curFlt === val ? 'active' : ''} ${cnt === 0 ? 'is-empty' : ''}" onclick="setRosterQuickFilter('${val}')">${lbl} <span class="mono">(${cnt})</span></button>`;
  }).join('');
}

function sortArrow(col) {
  if (rosterSort.col !== col) return '';
  return rosterSort.dir === -1 ? ' ▼' : ' ▲';
}

function thSort(col, label, extraCls = '') {
  const act = rosterSort.col === col ? 'sort-active' : '';
  return `<th class="${act} ${extraCls}" onclick="sortRoster('${col}')">${label}${sortArrow(col)}</th>`;
}

function renderRosterActionRadar() {
  const tl = document.getElementById('t4-contract-timeline');
  if (!tl || !tl.parentNode) return;
  let box = document.getElementById('t4-action-radar');
  if (!box) {
    box = document.createElement('div');
    box.id = 't4-action-radar';
    tl.parentNode.insertBefore(box, tl.nextSibling);
  }
  const roster = D.roster || [];
  // 1. Radar Panen / Jual Puncak Harga
  const harvest = roster
    .map(p => {
      let tag = '';
      let prio = 0;
      if (p.isTop5Arab) { tag = '💎 ARAB 2.5–3x'; prio = 4; }
      else if (p.squadRank <= 5 && p.age === 25 && p.force >= 42) { tag = '⏳ TAHAN @26TH ARAB'; prio = 3; }
      else if (p.isDeclining || p.age >= p.sellWarnAge) { tag = '📉 FASE REGRESI'; prio = 2; }
      else if (p.force >= p.potCap && p.age >= 23 && p.squadRank >= 12) { tag = '🔒 MENTOK POTCAP'; prio = 1; }
      return prio > 0 ? { p, tag, prio } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.prio - a.prio) || (b.p.estCounter40 - a.p.estCounter40))
    .slice(0, 5);

  // 2. Prioritas Potong Gaji (salaryCuts < 1 & kontrak >= 60d)
  const cutList = roster
    .filter(p => !p.salaryCutLocked && p.contractDays >= 60 && p.salary > 0)
    .map(p => {
      const saveMo = Math.round(p.salary * Math.max(0, 1 - (p.salaryFloorFactor || 0.90)));
      return { p, saveMo, floorPct: Math.round((p.salaryFloorFactor || 0.90) * 100) };
    })
    .filter(x => x.saveMo > 0)
    .sort((a, b) => b.saveMo - a.saveMo)
    .slice(0, 5);

  const bt = D.bTeamInfo || null;
  const btCands = (bt && Array.isArray(bt.candidates)) ? bt.candidates : [];

  if (!harvest.length && !cutList.length && !btCands.length) {
    box.innerHTML = '';
    return;
  }

  const btHtml = btCands.length ? `
    <div style="margin-top:8px;background:var(--bg2);border:1px solid rgba(168,85,247,.35);border-radius:8px;padding:8px 10px;font-size:11px">
      <div class="flex-between" style="gap:6px;flex-wrap:wrap;margin-bottom:4px">
        <b class="c-purple">🅱️ Routing Tim B: Jam Terbang Muda &amp; Legakan Kuota Asing</b>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="badge ${bt.excessForeign > 0 ? 'b-warn' : 'b-info'} mono">
            ${bt.hasBTeam ? `${esc(bt.bTeamName || 'Tim B')} Aktif ✓${bt.bTeamSquadCount ? ` (${bt.bTeamSquadCount} pemain)` : ''}` : `Buat Tim B: ${fmtM(bt.creationCost)}`} · Asing ${bt.curForeign}/${bt.foreignCap}
          </span>
          ${bt.hasBTeam ? `<button type="button" class="btn btn-sm btn-accent" onclick="goToView('t3','t3-bteam')">Buka Audit Tim B →</button>` : ''}
        </div>
      </div>
      <div class="c-muted" style="font-size:10.5px;margin-bottom:4px">
        ${bt.excessForeign > 0
          ? `Kuota asing berlebih <b>+${bt.excessForeign}</b>! Memindahkan pemain asing muda (gap ≥10) ke Tim B <b>gratis</b> &amp; keluar dari kuota aktif Tim Utama.`
          : 'Pindah Tim Utama ↔ Tim B gratis tanpa biaya transfer; cocok untuk pemain muda pot tinggi yang belum masuk starter.'}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${btCands.map(c =>
        `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(c.id)}')"><b>${esc(c.name)}</b> <span class="mono">${fmtPos(c.pos)} ${c.age}th · F${c.force}→${c.potCap}</span>${c.isForeign ? ' <b class="c-amber">ASING</b>' : ''}</span>`
      ).join('')}</div>
    </div>` : '';

  const radarOpen = typeof window === 'undefined' || window.innerWidth > 768;
  box.innerHTML = `<details class="glossary-inline" style="margin:6px 0 8px" ${radarOpen ? 'open' : ''}>
    <summary>🎯 <b>Radar Keputusan Cepat:</b> Panen Jual (${harvest.length}) · Potong Gaji (${cutList.length}) · Routing Tim B (${btCands.length})</summary>
    <div class="grid g2" style="gap:8px;margin-top:6px">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11px">
        <div style="font-weight:800;margin-bottom:5px" class="c-gold">🌾 Radar Panen / Jual di Puncak Harga</div>
        ${harvest.length ? harvest.map(x => {
          const p = x.p;
          const inS = typeof cartOut !== 'undefined' && cartOut[p.id];
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">
            <div style="min-width:0">
              <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>
              <span class="c-muted mono">(${p.age}th · F${p.force}/${p.potCap})</span>
              <div><span class="badge b-warn">${esc(x.tag)}</span> <span class="mono c-green">Ctr +40%: ${fmtM(p.estCounter40)}</span></div>
            </div>
            <button type="button" class="btn btn-sm ${inS ? 'btn-amber' : ''}" onclick="toggleCartOut('${escJs(p.id)}');renderRosterActionRadar()">${inS ? '✓ Cart' : '+Jual'}</button>
          </div>`;
        }).join('') : '<div class="c-muted">Belum ada pemain di fase panen/regresi.</div>'}
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11px">
        <div style="font-weight:800;margin-bottom:5px" class="c-sky">✂️ Prioritas Potong Gaji (Kuota 0/1 · Sebelum Renew 3Th)</div>
        ${cutList.length ? cutList.map(x => {
          const p = x.p;
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">
            <div style="min-width:0">
              <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>
              <span class="c-muted mono">(${p.contractDays}d · ${p.squadRank > 11 ? 'Cadangan' : 'Inti'})</span>
              <div class="mono c-muted">Gaji ${fmtM(p.salary)} → Lantai ${x.floorPct}%</div>
            </div>
            <span class="badge b-good mono">Hemat -${fmtM(x.saveMo)}/b</span>
          </div>`;
        }).join('') : '<div class="c-muted">Semua pemain bergaji besar sudah dipakai kuota potong gajinya.</div>'}
      </div>
    </div>
    ${btHtml}
  </details>`;
}

function renderRosterTable() {
  renderContractTimeline();
  renderRosterActionRadar();
  renderRosterQuickChips();
  const rows = getFilteredRoster();

  document.getElementById('t4-tbl').innerHTML = `<thead><tr>
    ${thSort('name', 'Pemain & Aksi')}
    ${thSort('pos', 'Pos')}
    ${thSort('force', 'F→Cap')}
    ${thSort('contractDays', 'Kontrak')}
    ${thSort('salary', 'Gaji/Bln')}
    ${thSort('energy', 'Energi', 'col-hide-mob')}
    ${thSort('age', 'Usia', 'col-hide-mob')}
    ${thSort('growthFrac', 'Growth', 'col-hide-mob')}
    ${thSort('stackPct', 'Skill Stack', 'col-hide-mob')}
    ${thSort('marketValue', 'Nilai (Jual)', 'col-hide-mob')}
    <th class="col-desk-only">Rekomendasi Aksi</th>
  </tr></thead><tbody>` + (rows.length ? rows.map(p => {
    const stB = p.nonStack ? 'b-crit' : (p.stackGrade === 'GOD' ? 'b-good' : 'b-muted');
    const cB = p.contractDays <= 10 ? 'b-crit' : (p.contractDays < 60 ? 'b-warn' : (p.contractDays <= 120 ? 'b-good' : 'b-muted'));
    const actB = { crit: 'b-crit', warn: 'b-warn', good: 'b-good', accent: 'b-accent', info: 'b-info', muted: 'b-muted' }[p.actionCls] || 'b-muted';
    const slumpBadge = (p.fineSlump > 0) ? ` <span class="badge b-crit" title="${esc(tipFor('SLUMP'))}">SLUMP -${p.fineSlumpPct}%</span>` : '';
    const narTag = p.noAutoRenew ? '<div class="c-muted" style="font-size:10px">noAutoRenew ✓</div>' : '';
    const loopTag = p.autoRenewLoophole ? `<div class="c-sky" style="font-size:10px" title="${esc(tipFor('LOOPHOLE'))}">💎 Auto-Renew 0%</div>` : '';
    return `<tr>
      <td>
        <div><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> ${p.top ? '👑' : (p.star ? '⭐' : '')} ${p.injured ? `<span class="badge b-crit">🏥${p.injuryDays}d</span>` : ''}${slumpBadge}</div>
        <div class="inline-sticky-meta">
          <span class="badge ${actB}">${esc(p.action)}</span>
          ${p.isTrap ? `<span class="badge b-crit" title="${esc(tipFor('TRAP'))}">TRAP</span>` : (p.isGem ? `<span class="badge b-good" title="${esc(tipFor('GEM'))}">GEM</span>` : '')}
        </div>
      </td>
      <td><b>${fmtPos(p.pos)}</b> <span class="c-muted" style="font-size:10px">${fmtFoot(p.foot)}</span></td>
      <td class="mono"><b>${p.force}</b>→<b class="c-green">${p.potCap}</b><div class="c-muted" style="font-size:10px">UI ${p.potential}</div></td>
      <td><span class="badge ${cB} mono">${p.contractDays}d</span>${loopTag}${p.benchCutSave ? `<div class="c-sky" style="font-size:10px">Bangku -${fmtM(p.benchCutSave)}</div>` : ''}${narTag}</td>
      <td class="mono">${fmtM(p.salary)}</td>
      <td class="col-hide-mob">${energyPillHtml(p.energy)}</td>
      <td class="mono col-hide-mob ${p.age >= p.sellWarnAge ? 'c-amber' : ''}">${p.age} <span class="c-muted">(@${p.declineAge})</span></td>
      <td class="col-hide-mob">${growthBarHtml(p.growthFrac, p.nearDrop)}</td>
      <td class="col-hide-mob"><span class="badge ${stB}" title="${esc(p.stackNote || (p.nonStack ? tipFor('NONSTACK') : ''))}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct}%)</span></td>
      <td class="mono col-hide-mob">${fmtM(p.marketValue)} <div class="c-muted" style="font-size:10px">Real ~${fmtM(p.estRealSale)}</div></td>
      <td class="col-desk-only"><span class="badge ${actB}">${esc(p.action)}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="11" class="c-muted">Tidak ada pemain yang cocok dengan filter ini.</td></tr>') + `</tbody>`;

  renderTrainingAudit();
}

function renderTrainingAudit() {
  const tr = D.trainAudit;
  const el = document.getElementById('t4-training');
  if (!el || !tr) return;

  const byId = Object.fromEntries((D.roster || []).map(p => [p.id, p]));
  const wastedSet = new Set(tr.wastedNames || []);
  const curIds = tr.currentIds || [];
  const totalSlots = Math.max(Number(tr.slots) || 2, curIds.length);

  const curCards = curIds.length
    ? curIds.map((id, idx) => {
        const p = byId[id];
        if (!p) return '';
        const isW = wastedSet.has(p.name) || (p.force >= p.potCap);
        const gap = Math.max(0, p.potCap - p.force);
        return `<div class="alert-item ${isW ? 'CRITICAL' : ''}" style="cursor:pointer;margin-bottom:6px" onclick="openPlayerDrawer('roster','${escJs(p.id)}')">
          <span class="badge ${isW ? 'b-crit' : 'b-good'}">${isW ? 'MENTOK!' : 'SLOT #' + (idx + 1)}</span>
          <div style="flex:1;min-width:0">
            <b>${esc(p.name)}</b> <span class="c-muted">(${fmtPos(p.pos)} ${p.age}th)</span> · <span class="mono c-green">${p.force}→${p.potCap} (+${gap})</span>
            <div class="c-muted" style="font-size:11px;margin-top:2px">
              ${isW ? 'Slot terbuang — ganti dengan kandidat Prioritas di kanan!' : `Growth ${p.growthFrac >= 0 ? '+' : ''}${p.growthFrac} · ${fmtSkills(p.s1, p.s2)} (${p.stackGrade})`}
            </div>
          </div>
        </div>`;
      }).join('')
    : '<div class="c-muted">Belum ada slot manual terbaca (mode otomatis).</div>';

  // Gunakan x.id langsung (100% bebas bug nama kembar!) + tampilkan Top slots + Alternatif
  const idealCards = (tr.ideal || []).map((x, idx) => {
    const pid = x.id || '';
    const pObj = pid ? byId[pid] : (D.roster || []).find(r => r.name === x.name && r.pos === x.pos);
    const resolvedId = pObj ? pObj.id : pid;
    const isAct = Boolean(resolvedId && curIds.includes(resolvedId));
    const isTopSlot = idx < totalSlots;
    const badgeCls = isAct ? 'b-good' : (isTopSlot ? 'b-info' : 'b-muted');
    const badgeTxt = isAct ? '✓ SUDAH MASUK' : (isTopSlot ? `PRIORITAS #${idx + 1}` : `ALT #${idx + 1}`);
    const gf = (x.growthFrac !== undefined) ? x.growthFrac : (pObj ? pObj.growthFrac : 0);
    const stGrade = x.stackGrade || (pObj ? pObj.stackGrade : '');
    const isNonSt = x.nonStack !== undefined ? x.nonStack : (pObj ? pObj.nonStack : false);
    const stTag = isNonSt ? '<span class="badge b-crit">NON-STACK</span>' : (stGrade === 'GOD' ? '<span class="badge b-good">GOD</span>' : '');

    return `<div class="alert-item" style="cursor:pointer;margin-bottom:6px;border-color:${isAct ? 'rgba(16,185,129,.45)' : (isTopSlot ? 'rgba(56,189,248,.45)' : 'var(--border)')}" ${resolvedId ? `onclick="openPlayerDrawer('roster','${escJs(resolvedId)}')"` : ''}>
      <span class="badge ${badgeCls}">${badgeTxt}</span>
      <div style="flex:1;min-width:0">
        <b>${esc(x.name)}</b> <span class="c-muted">(${fmtPos(x.pos)} ${x.age}th)</span> · <span class="mono c-green"><b>${x.force}→${x.potCap} (+${x.gap})</b></span> ${stTag}
        <div class="c-muted" style="font-size:11px;margin-top:2px">Growth <b class="mono">${gf >= 0 ? '+' : ''}${Number(gf).toFixed(2)}</b>${gf >= 0.75 ? ' 🔥 sebentar lagi +1F!' : ''}</div>
      </div>
    </div>`;
  }).join('');

  const autoWarn = tr.mode === 'auto'
    ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">AUTO AKTIF</span><div><b>Mode AUTO Special Training aktif!</b> Di bytecode #34840, mode auto 100% buta potCap (cuma pilih usia termuda). Wajib ubah ke <b>MANUAL</b>!</div></div>`
    : '';
  el.innerHTML = `
    <div class="mb-8">Mode: <b class="${tr.mode === 'auto' ? 'c-red' : 'c-green'}">${tr.mode.toUpperCase()}</b> | Kapasitas CT Lv ${D.meta.ctLevel}: <b class="c-sky">${totalSlots} slot</b></div>
    ${autoWarn}
    <div class="grid g2">
      <div><h3>📌 Slot Aktif Saat Ini (${curIds.length}/${totalSlots})</h3>${curCards}</div>
      <div><h3>✨ Rekomendasi Terbaik (Top ${totalSlots} + Alternatif)</h3>${idealCards || '<div class="c-muted">Tidak ada kandidat muda dengan gap > 0.</div>'}</div>
    </div>`;
}

// ==================== PELACAK PROGRESI WONDERKID & MULTI-SAVE (TIER 3) ====================
let t3TrainScope = 'ALL'; // ALL | CT | WK | MOOD
let wkTrackerFilter = 'ALL'; // ALL | TRAIN | SENIOR | BTEAM | YOUTH
let wkTrackerSelectedId = null;

function setT3TrainScope(sc) {
  t3TrainScope = sc || 'ALL';
  const showAll = t3TrainScope === 'ALL';
  const ctCard = document.getElementById('t3-ct-card');
  const wkCard = document.getElementById('t3-growth-card');
  const moodCard = document.getElementById('t3-mood-card');
  if (ctCard) ctCard.style.display = (showAll || t3TrainScope === 'CT') ? '' : 'none';
  if (wkCard) wkCard.style.display = (showAll || t3TrainScope === 'WK') ? '' : 'none';
  if (moodCard) moodCard.style.display = (showAll || t3TrainScope === 'MOOD') ? '' : 'none';
  if (t3TrainScope === 'MOOD') {
    const md = document.getElementById('t3-mood-details');
    if (md) md.setAttribute('open', '');
  }
  document.querySelectorAll('#t3-train-tabs [data-t3scope]').forEach(b => {
    b.classList.toggle('active', b.dataset.t3scope === t3TrainScope);
  });
}

function setWkTrackerFilter(f) {
  wkTrackerFilter = f || 'ALL';
  renderWonderkidTracker();
}

function selectWkTracker(id) {
  wkTrackerSelectedId = id || null;
  renderWonderkidTracker();
}

function renderWonderkidTracker() {
  const el = document.getElementById('t3-growth-tracker');
  if (!el) return;
  const progData = D.progression || {};
  const allWk = Array.isArray(progData.wonderkids) ? progData.wonderkids : [];
  const snapCount = progData.snapshotCount || 1;
  const timeline = Array.isArray(progData.clubTimeline) ? progData.clubTimeline : [];

  const filterMatch = (w) => {
    if (wkTrackerFilter === 'TRAIN') return Boolean(w.inTrain);
    if (wkTrackerFilter === 'SENIOR') return w.src === 'roster';
    if (wkTrackerFilter === 'BTEAM') return w.src === 'bteam';
    if (wkTrackerFilter === 'YOUTH') return w.src === 'youth';
    return true;
  };
  const filtered = allWk.filter(filterMatch);
  const poolForSel = filtered.length ? filtered : allWk;
  let sel = poolForSel.find(w => w.id === wkTrackerSelectedId) || poolForSel[0] || null;
  if (sel) wkTrackerSelectedId = sel.id;

  const snapBadgeTxt = snapCount >= 2
    ? `📸 ${snapCount} Snapshot (${progData.oldestDate} → ${progData.latestDate})`
    : `📸 Snapshot #1 (Baseline + Proyeksi)`;

  const chips = [
    ['ALL', 'Semua', allWk.length],
    ['TRAIN', '🏋️ Slot CT', allWk.filter(w => w.inTrain).length],
    ['SENIOR', 'Senior', allWk.filter(w => w.src === 'roster').length],
    ['BTEAM', '🅱️ Tim B', allWk.filter(w => w.src === 'bteam').length],
    ['YOUTH', '🌱 Akademi', allWk.filter(w => w.src === 'youth').length],
  ];
  const chipBarHtml = `<div class="quick-chips-bar" style="margin-bottom:8px">${chips.map(([k, lbl, cnt]) =>
    `<button type="button" class="qchip ${wkTrackerFilter === k ? 'active' : ''} ${cnt === 0 ? 'is-empty' : ''}" onclick="setWkTrackerFilter('${k}')">${lbl} <span class="mono">(${cnt})</span></button>`
  ).join('')}</div>`;

  let chartHtml = '<div class="c-muted">Belum ada prospek muda yang memenuhi kriteria tracker.</div>';
  if (sel) {
    const obsPts = Array.isArray(sel.obsPoints) && sel.obsPoints.length
      ? sel.obsPoints
      : [{ date: (D.meta && D.meta.currentDate) || '-', force: sel.force, effForce: sel.effForce, gf: sel.growthFrac }];
    const projPts = Array.isArray(sel.projectedCurve) ? sel.projectedCurve : [];
    const lastObs = obsPts[obsPts.length - 1];
    const allPts = [
      ...obsPts.map((pt, i) => ({
        kind: 'obs',
        lbl: i === 0 && obsPts.length >= 2 ? String(pt.date || '').slice(5) : (i === obsPts.length - 1 ? 'Kini' : String(pt.date || '').slice(5)),
        val: Number(pt.effForce ?? pt.force) || 0,
      })),
      ...projPts.slice(1).map(pt => ({
        kind: 'proj',
        lbl: pt.label.replace(' Bln', 'B'),
        val: Number(pt.eff) || 0,
      })),
    ];

    const W = 620, H = 195, padL = 42, padR = 26, padT = 24, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const vals = allPts.map(x => x.val).concat([sel.potCap]);
    const yMin = Math.max(0, Math.floor(Math.min(...vals) - 2));
    const yMax = Math.max(yMin + 5, Math.ceil(Math.max(...vals) + 2));
    const xOf = (idx) => allPts.length <= 1 ? padL + plotW / 2 : (padL + (idx / (allPts.length - 1)) * plotW);
    const yOf = (v) => padT + plotH - ((v - yMin) / Math.max(1, yMax - yMin)) * plotH;

    const obsCount = obsPts.length;
    const obsCoords = allPts.slice(0, obsCount).map((p, i) => [xOf(i), yOf(p.val), p]);
    const projCoords = obsCount >= 1
      ? [[xOf(obsCount - 1), yOf(allPts[obsCount - 1].val), allPts[obsCount - 1]], ...allPts.slice(obsCount).map((p, i) => [xOf(obsCount + i), yOf(p.val), p])]
      : [];

    const capY = yOf(sel.potCap);
    const obsLine = obsCoords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const projLine = projCoords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const showXIdx = new Set([0, Math.max(0, obsCount - 1), allPts.length - 1]);

    const svgStr = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:100%;height:auto;display:block;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">
        <line x1="${padL}" y1="${capY.toFixed(1)}" x2="${W - padR}" y2="${capY.toFixed(1)}" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="5,4" />
        <text x="${W - padR}" y="${Math.max(12, capY - 5).toFixed(1)}" text-anchor="end" fill="#fcd34d" font-size="10.5" font-weight="700">PotCap ${sel.potCap}</text>
        <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#243449" stroke-width="1" />
        <text x="6" y="${padT + 9}" fill="#8ea3bc" font-size="10.5">${yMax}</text>
        <text x="6" y="${padT + plotH}" fill="#8ea3bc" font-size="10.5">${yMin}</text>
        ${projCoords.length >= 2 ? `<polyline fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-dasharray="5,4" points="${projLine}" />` : ''}
        ${obsCoords.length >= 2 ? `<polyline fill="none" stroke="#10b981" stroke-width="2.8" points="${obsLine}" />` : ''}
        ${projCoords.slice(1).map(c => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.6" fill="#38bdf8" /><text x="${c[0].toFixed(1)}" y="${Math.max(14, c[1] - 7).toFixed(1)}" text-anchor="middle" fill="#7dd3fc" font-size="9.5">${c[2].val}</text>`).join('')}
        ${obsCoords.map(c => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4.2" fill="#10b981" stroke="#07131c" stroke-width="1.2" /><text x="${c[0].toFixed(1)}" y="${Math.max(14, c[1] - 8).toFixed(1)}" text-anchor="middle" fill="#6ee7b7" font-size="10" font-weight="700">${c[2].val}</text>`).join('')}
        ${allPts.map((pt, idx) => (showXIdx.has(idx) || allPts.length <= 6)
          ? `<text x="${xOf(idx).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="${pt.kind === 'obs' ? '#a7f3d0' : '#8ea3bc'}" font-size="10">${esc(pt.lbl)}</text>`
          : '').join('')}
      </svg>`;

    const paceMap = {
      AHEAD: { cls: 'b-good', lbl: '🚀 Unggul' },
      ON_TRACK: { cls: 'b-info', lbl: '✓ On Track' },
      BEHIND: { cls: 'b-warn', lbl: '⚠ Lambat' },
      BASELINE: { cls: 'b-muted', lbl: '📌 Baseline' },
    };
    const pBadge = paceMap[sel.paceStatus] || paceMap.BASELINE;
    const rateMob = `+${(sel.estWeeklyRate * 4.33).toFixed(2)}/bln`;
    const actualTxt = sel.obsWeeklyRate !== null ? `+${sel.obsWeeklyRate.toFixed(3)}/pkn` : 'Belum cukup data';
    const ctTip = (!sel.inTrain && sel.src === 'roster')
      ? `<span class="c-sky">Jika masuk Slot CT: +${sel.rateIfTrained.toFixed(3)}/pkn</span>`
      : (sel.inTrain ? '<span class="c-green">🏋️ Sedang di Slot CT Aktif</span>' : `<span class="c-muted">${sel.src === 'youth' ? `Akademi Dev ${sel.dev || 0}%` : 'Skuat Tim B'}</span>`);

    chartHtml = `
      <div id="t3-wk-chart">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <select id="t3-wk-select" style="flex:1 1 200px;min-width:0;max-width:100%" onchange="selectWkTracker(this.value)">
            ${poolForSel.map(w => {
              const sLbl = w.src === 'bteam' ? '[Tim B] ' : (w.src === 'youth' ? '[Akademi] ' : (w.inTrain ? '[CT] ' : ''));
              return `<option value="${esc(w.id)}" ${w.id === sel.id ? 'selected' : ''}>${esc(sLbl + w.name)} (${fmtPos(w.pos)} ${w.age}th · F${w.effForce}→${w.potCap})</option>`;
            }).join('')}
          </select>
          <button type="button" class="btn btn-sm" onclick="openPlayerDrawer('${escJs(sel.src)}','${escJs(sel.id)}')">👤 Profil</button>
        </div>
        <div style="min-width:0;overflow:hidden;margin-bottom:8px">${svgStr}</div>
        <div class="t3-mini-strip">
          <div class="t3-mini-card">
            <div class="kpi-lbl">Force → PotCap</div>
            <div class="kpi-val mono c-green">${sel.effForce} → ${sel.potCap}</div>
            <div class="kpi-sub">Sisa gap +${sel.gap} (${sel.age}th)</div>
          </div>
          <div class="t3-mini-card">
            <div class="kpi-lbl">Laju Target Engine</div>
            <div class="kpi-val mono c-sky">+${sel.estWeeklyRate.toFixed(3)}</div>
            <div class="kpi-sub">F/pekan (${rateMob})</div>
          </div>
          <div class="t3-mini-card">
            <div class="kpi-lbl">Laju Aktual (${obsCount} ttk)</div>
            <div class="kpi-val mono" style="font-size:15px">${sel.obsWeeklyRate !== null ? '+' + sel.obsWeeklyRate.toFixed(3) : 'Baseline'}</div>
            <div class="kpi-sub"><span class="badge ${pBadge.cls}">${pBadge.lbl}</span></div>
          </div>
          <div class="t3-mini-card">
            <div class="kpi-lbl">ETA +1F &amp; PotCap</div>
            <div class="kpi-val mono c-amber">~${sel.weeksToNext} pkn</div>
            <div class="kpi-sub">Cap ~${sel.etaMonthsToCap} bln · ${ctTip}</div>
          </div>
        </div>
        <div class="c-muted" style="font-size:11px;margin-bottom:10px">${esc(sel.paceNote)} <span class="mono">(Hijau = Aktual, Biru Putus = Proyeksi +12 Bln, Kuning = PotCap)</span></div>
      </div>`;
  }

  const tblRowsHtml = filtered.length ? filtered.map(w => {
    const isSel = sel && w.id === sel.id;
    const srcTag = w.inTrain ? '<span class="badge b-good">CT</span>' : (w.src === 'bteam' ? '<span class="badge b-accent">TIM B</span>' : (w.src === 'youth' ? '<span class="badge b-info">AKAD</span>' : ''));
    const pBar = Math.min(100, Math.max(8, Math.round((w.effForce / Math.max(1, w.potCap)) * 100)));
    const obsCol = w.obsWeeklyRate !== null ? `<b class="mono ${w.paceStatus === 'BEHIND' ? 'c-amber' : 'c-green'}">+${w.obsWeeklyRate.toFixed(3)}</b>` : '<span class="c-muted">-</span>';
    return `<tr style="cursor:pointer;${isSel ? 'background:rgba(16,185,129,.12)' : ''}" onclick="selectWkTracker('${escJs(w.id)}')">
      <td><b>${esc(w.name)}</b> ${srcTag} <span class="c-muted" style="font-size:10.5px">(${fmtPos(w.pos)} ${w.age}th)</span></td>
      <td class="mono"><b>${w.effForce}</b>→<b class="c-green">${w.potCap}</b></td>
      <td class="mono c-sky">+${w.estWeeklyRate.toFixed(3)}</td>
      <td>${obsCol}</td>
      <td class="mono col-hide-mob">~${w.etaMonthsToCap} bln</td>
      <td class="col-hide-mob"><div class="mini-bar-wrap"><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${pBar}%;background:var(--green)"></div></div><span class="mono" style="font-size:10.5px">${pBar}%</span></div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="c-muted">Tidak ada prospek di kategori ini.</td></tr>';

  const timelineHtml = timeline.length >= 2 ? `
    <details class="glossary-inline mt-12">
      <summary style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span>📅 Linimasa Klub Antar-Save (${timeline.length} Snapshot)</span>
        <button type="button" class="btn btn-sm" onclick="event.preventDefault();goToView('t6','t6-ext')">💾 Backup / Import →</button>
      </summary>
      <div class="tbl-wrap mt-8" style="max-height:220px;overflow-y:auto">
        <table>
          <thead><tr><th>Tanggal</th><th>Kas</th><th>Best XI</th><th>Klasemen</th><th>Member</th></tr></thead>
          <tbody>${timeline.slice().reverse().map(t => `<tr>
            <td class="mono"><b>${esc(t.date)}</b></td>
            <td class="mono c-green">${fmtM(t.budget)}</td>
            <td class="mono">${t.bestXiAvg ?? '-'}</td>
            <td class="mono">${t.leaguePos ? '#' + t.leaguePos : '-'}</td>
            <td class="mono">${(t.members || 0).toLocaleString('id-ID')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </details>` : `<div class="flex-between mt-8" style="gap:8px;flex-wrap:wrap;font-size:11px">
      <span class="c-muted">💡 Muat save berikutnya atau impor backup riwayat lama untuk membandingkan kurva aktual vs target engine.</span>
      <button type="button" class="btn btn-sm" onclick="goToView('t6','t6-ext')">💾 Backup / Import History →</button>
    </div>`;

  el.innerHTML = `
    <div class="flex-between mb-8" style="gap:8px;flex-wrap:wrap">
      <h2 style="margin:0">📈 Pelacak Progresi Wonderkid &amp; Multi-Save</h2>
      <span class="badge ${snapCount >= 2 ? 'b-good' : 'b-info'} mono">${esc(snapBadgeTxt)}</span>
    </div>
    ${chipBarHtml}
    ${chartHtml}
    <div class="tbl-wrap tbl-sticky" style="max-height:250px;overflow-y:auto">
      <table>
        <thead><tr><th>Prospek</th><th>F → Cap</th><th>Target/pkn</th><th>Aktual/pkn</th><th class="col-hide-mob">ETA Cap</th><th class="col-hide-mob">Progres</th></tr></thead>
        <tbody>${tblRowsHtml}</tbody>
      </table>
    </div>
    ${timelineHtml}`;
}

function exportRosterCsv() {
  const rows = getFilteredRoster();
  const hdr = ['Name','Pos','Age','DeclineAge','Foot','Energy','Force','Pot','PotCap','S1','S2','StackPct','ContractDays','FineSlumpPct','Salary','MarketValue','EstRealSale','Action'];
  const lines = [hdr.join(',')].concat(rows.map(p => [
    `"${p.name.replace(/"/g,'""')}"`, fmtPos(p.pos), p.age, p.declineAge, fmtFoot(p.foot), p.energy, p.force, p.potential, p.potCap,
    fmtSkill(p.s1), fmtSkill(p.s2), p.stackPct, p.contractDays, p.fineSlumpPct || 0, p.salary, p.marketValue, p.estRealSale, `"${p.action}"`
  ].join(',')));
  downloadCsv('ligafoot_skuad.csv', lines.join('\n'));
}

// ==================== SUB-TAB 3E: DEEP AUDIT & PIPELINE TIM B ====================
let bTeamFilter = 'ALL';

function setBTeamFilter(f) {
  bTeamFilter = f || 'ALL';
  renderBTeamPanel();
}

function getFilteredBTeamRoster() {
  const bt = D.bTeamInfo || {};
  const list = Array.isArray(bt.roster) ? bt.roster : [];
  if (bTeamFilter === 'PROMOTE') return list.filter(p => p.bAction === 'SIAP PROMOSI');
  if (bTeamFilter === 'LEAK') return list.filter(p => p.zeroMin);
  if (bTeamFilter === 'CONTRACT') return list.filter(p => (p.contractDays <= 30 || (p.contractDays >= 60 && p.contractDays <= 120)) && !p.loanedFrom);
  if (bTeamFilter === 'FOREIGN') return list.filter(p => p.isForeign);
  if (bTeamFilter === 'HIGHPOT') return list.filter(p => (p.gap || 0) >= 12);
  return list;
}

function renderBTeamPanel() {
  const bt = D.bTeamInfo || null;
  const titleEl = document.getElementById('t3b-title');
  const kpiEl = document.getElementById('t3b-kpis');
  const routeEl = document.getElementById('t3b-routing');
  const barEl = document.getElementById('t3b-filter-bar');
  const tblEl = document.getElementById('t3b-tbl');
  if (!kpiEl || !routeEl || !barEl || !tblEl) return;

  if (!bt || !bt.hasBTeam) {
    if (titleEl) titleEl.textContent = '🅱️ Pipeline & Pembuatan Tim B';
    kpiEl.innerHTML = `<div class="alert-item INFO mb-8">
      <span class="badge b-info">BELUM PUNYA TIM B</span>
      <div>
        Klub belum memiliki Tim B aktif. Biaya pembuatan Tim B (#24615): <b class="mono">${fmtM((bt && bt.creationCost) || 600000)}</b>.
        Kuota pemain asing Tim Utama saat ini: <b class="mono">${(bt && bt.curForeign) || 0}/${(bt && bt.foreignCap) || 7}</b>.
      </div>
    </div>`;
    const cands = (bt && Array.isArray(bt.candidates)) ? bt.candidates : [];
    routeEl.innerHTML = cands.length ? `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:11.5px">
        <div style="font-weight:800;margin-bottom:5px" class="c-purple">📤 Kandidat Terbaik Tim Utama → Tim B (${cands.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${cands.map(c =>
          `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(c.id)}')"><b>${esc(c.name)}</b> <span class="mono">${fmtPos(c.pos)} ${c.age}th · F${c.force}→${c.potCap}</span>${c.isForeign ? ' <b class="c-amber">ASING</b>' : ''}</span>`
        ).join('')}</div>
      </div>` : '';
    barEl.innerHTML = '';
    tblEl.innerHTML = '<tbody><tr><td class="c-muted">Buat Tim B di menu Klub dalam game untuk membuka audit 19+ pemain cadangan secara penuh.</td></tr></tbody>';
    return;
  }

  const list = Array.isArray(bt.roster) ? bt.roster : [];
  const filtered = getFilteredBTeamRoster();
  if (titleEl) {
    titleEl.innerHTML = `🅱️ Audit Skuad ${esc(bt.bTeamName || 'Tim B')} <span class="c-muted mono" style="font-size:11px;font-weight:500">(${list.length} pemain${bt.bTeamLeague ? ' · ' + esc(bt.bTeamLeague) : ''})</span>`;
  }

  kpiEl.innerHTML = `
    <div class="grid g4 mb-8">
      <div class="kpi">
        <span class="kpi-lbl">Skuad &amp; Rata2 Tim B</span>
        <span class="kpi-val c-sky mono">${list.length} pem</span>
        <span class="kpi-sub mono">Avg F${bt.avgForce || 0} · Usia ${bt.avgAge || 0}th · Asing ${bt.foreignCount || 0}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Kas &amp; Payroll Tim B</span>
        <span class="kpi-val c-green mono">${fmtM(bt.budget || 0)}</span>
        <span class="kpi-sub mono">Gaji ${fmtM(bt.totalPayroll || 0)}/bln · Rep ${bt.reputation || 0}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Gaji Bocor (0 Menit)</span>
        <span class="kpi-val ${(bt.zeroMinLeakCount || 0) > 0 ? 'c-red' : 'c-green'} mono">${bt.zeroMinLeakCount || 0} pem</span>
        <span class="kpi-sub mono">${fmtM(bt.zeroMinPayrollLeak || 0)}/bln belum main</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Promosi &amp; Kontrak</span>
        <span class="kpi-val ${(bt.readyPromoteCount || 0) > 0 ? 'c-green' : 'c-amber'} mono">${bt.readyPromoteCount || 0} promosi</span>
        <span class="kpi-sub mono">${bt.contractAlertCount || 0} alert kontrak · Asing Utama ${bt.curForeign}/${bt.foreignCap}</span>
      </div>
    </div>`;

  const topPromoteCands = list.filter(p => p.bAction === 'SIAP PROMOSI' || (p.gap >= 15 && p.force >= 30)).slice(0, 6);
  const candsOut = Array.isArray(bt.candidates) ? bt.candidates : [];
  routeEl.innerHTML = `
    <div class="grid g2" style="gap:8px">
      <div style="background:var(--bg2);border:1px solid rgba(16,185,129,.35);border-radius:8px;padding:8px 10px;font-size:11px">
        <div style="font-weight:800;margin-bottom:4px" class="c-green">📥 Pipeline Tim B → Tim Utama (Gratis)</div>
        ${topPromoteCands.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${topPromoteCands.map(p =>
          `<span class="tl-pill" onclick="openPlayerDrawer('bteam','${escJs(p.id)}')"><b>${esc(p.name)}</b> <span class="mono">${fmtPos(p.pos)} ${p.age}th · F${p.force}→${p.potCap}</span>${p.fillsHole ? ' <b class="c-green">LUBANG</b>' : ''}</span>`
        ).join('')}</div>` : '<div class="c-muted">Belum ada pemain Tim B mencapai ambang starter Tim Utama.</div>'}
      </div>
      <div style="background:var(--bg2);border:1px solid rgba(168,85,247,.35);border-radius:8px;padding:8px 10px;font-size:11px">
        <div style="font-weight:800;margin-bottom:4px" class="c-purple">📤 Kirim Jam Terbang: Tim Utama → Tim B (Gratis)</div>
        ${candsOut.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${candsOut.map(c =>
          `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(c.id)}')"><b>${esc(c.name)}</b> <span class="mono">${fmtPos(c.pos)} ${c.age}th · F${c.force}→${c.potCap}</span>${c.isForeign ? ' <b class="c-amber">ASING</b>' : ''}</span>`
        ).join('')}</div>` : '<div class="c-muted">Semua prospek U-22 Tim Utama sudah masuk rotasi inti.</div>'}
      </div>
    </div>`;

  const counts = {
    ALL: list.length,
    PROMOTE: list.filter(p => p.bAction === 'SIAP PROMOSI').length,
    LEAK: list.filter(p => p.zeroMin).length,
    CONTRACT: list.filter(p => (p.contractDays <= 30 || (p.contractDays >= 60 && p.contractDays <= 120)) && !p.loanedFrom).length,
    FOREIGN: list.filter(p => p.isForeign).length,
    HIGHPOT: list.filter(p => (p.gap || 0) >= 12).length,
  };
  const chipDefs = [
    ['ALL', `Semua (${counts.ALL})`],
    ['PROMOTE', `⬆ Siap Promosi (${counts.PROMOTE})`],
    ['LEAK', `💸 0 Menit (${counts.LEAK})`],
    ['CONTRACT', `⏳ Kontrak (${counts.CONTRACT})`],
    ['HIGHPOT', `🚀 Gap ≥12 (${counts.HIGHPOT})`],
    ['FOREIGN', `🌐 Asing (${counts.FOREIGN})`],
  ];
  barEl.innerHTML = chipDefs.map(([k, lbl]) =>
    `<button type="button" class="qchip ${bTeamFilter === k ? 'active' : ''}" onclick="setBTeamFilter('${k}')">${esc(lbl)}</button>`
  ).join('');

  tblEl.innerHTML = `<thead><tr>
    <th>Pemain Tim B</th>
    <th>Pos</th>
    <th>F→Cap</th>
    <th class="col-hide-mob">Usia</th>
    <th class="col-hide-mob">Laga/Mnt</th>
    <th>Gaji</th>
    <th class="col-hide-mob">Kontrak</th>
    <th>Status &amp; Aksi</th>
  </tr></thead><tbody>` + (filtered.length ? filtered.map(p => {
    const gap = Math.max(0, (p.potCap || p.force) - p.force);
    const cB = p.contractDays <= 10 ? 'b-crit' : (p.contractDays < 60 ? 'b-warn' : (p.contractDays <= 120 ? 'b-good' : 'b-muted'));
    const inBCart = Boolean(typeof cartBIn !== 'undefined' && cartBIn[p.id]);
    return `<tr>
      <td>
        <a class="clickable-name" onclick="openPlayerDrawer('bteam','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>
        ${p.isForeign ? '<span class="badge b-warn" style="font-size:9px">ASING</span>' : ''}
        ${p.fillsHole ? '<span class="badge b-good" style="font-size:9px">LUBANG</span>' : ''}
        ${p.injured ? `<span class="badge b-crit" style="font-size:9px">🏥${p.injuryDays}d</span>` : ''}
      </td>
      <td><b>${fmtPos(p.pos)}</b></td>
      <td class="mono"><b>${p.force}</b>→<span class="c-green">${p.potCap}</span> <span class="c-muted">(+${gap})</span></td>
      <td class="mono col-hide-mob">${p.age}th</td>
      <td class="mono col-hide-mob">${p.gamesPlayed || 0}g <span class="c-muted">(${p.seasonMinutes || 0}m · ${p.avgRating || '-'})</span></td>
      <td class="mono">${fmtM(p.salary)}</td>
      <td class="col-hide-mob"><span class="badge ${cB} mono">${p.contractDays}d</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span class="badge ${esc(p.bCls || 'b-info')}">${esc(p.bAction || 'TAHAN')}</span>
          <button type="button" class="btn btn-sm ${inBCart ? 'btn-amber' : ''}" onclick="if(typeof toggleCartBIn==='function'){toggleCartBIn('${escJs(p.id)}');}" title="Uji promosi 0€ ke Simulasi Cart Tab 4D">${inBCart ? '✓Cart' : '+Cart'}</button>
        </div>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="c-muted">Tidak ada pemain Tim B pada filter ini.</td></tr>') + `</tbody>`;
}

function exportBTeamCsv() {
  const rows = getFilteredBTeamRoster();
  const hdr = ['Name','Pos','Age','Force','PotCap','Gap','Games','Minutes','AvgRating','Salary','ContractDays','Foreign','Action'];
  const lines = [hdr.join(',')].concat(rows.map(p => [
    `"${String(p.name || '').replace(/"/g,'""')}"`, fmtPos(p.pos), p.age, p.force, p.potCap, p.gap || 0,
    p.gamesPlayed || 0, p.seasonMinutes || 0, p.avgRating || 0, p.salary || 0, p.contractDays || 0,
    p.isForeign ? 'YES' : 'NO', `"${p.bAction || ''}"`
  ].join(',')));
  downloadCsv('ligafoot_tim_b.csv', lines.join('\n'));
}
