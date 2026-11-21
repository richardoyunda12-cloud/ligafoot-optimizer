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
  if (flt === 'GOLDEN') return p.contractDays >= 11 && p.contractDays <= 59;
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
  const bGold = roster.filter(p => p.contractDays >= 11 && p.contractDays <= 59).sort((a, b) => a.contractDays - b.contractDays);
  const bSoon = roster.filter(p => p.contractDays >= 60 && p.contractDays <= 120).sort((a, b) => a.contractDays - b.contractDays);
  const bMid  = roster.filter(p => p.contractDays >= 121 && p.contractDays <= 180).sort((a, b) => a.contractDays - b.contractDays);

  const pills = (arr, extraFn) => arr.length
    ? arr.map(p => `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b> <span class="mono c-muted">${p.contractDays}d${extraFn ? extraFn(p) : ''}</span></span>`).join('')
    : '<span class="c-muted" style="font-size:11px">Tidak ada</span>';

  // Auto-collapse di layar HP (<=768px) agar tabel skuad langsung terlihat di layar pertama!
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const openAttr = (!isMobile && (bTrap.length || bGold.length || bSoon.length)) ? 'open' : '';

  el.innerHTML = `
    <details class="glossary-inline" ${openAttr} style="padding:8px 11px;margin-bottom:6px">
      <summary>📅 Kontrak 6 Bln: 🚨 ${bTrap.length} Jebakan · ✅ ${bGold.length} Golden · ⏳ ${bSoon.length} Segera</summary>
      <div class="timeline-grid mt-12">
        <div class="tl-bucket ${bTrap.length ? 'crit' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bTrap.length ? 'c-red' : 'c-muted'}">🚨 Zona Jebakan ≤10d (${bTrap.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Pakai Loophole Auto-Renew 0% / Lepas Gratis</div>
          <div>${pills(bTrap)}</div>
        </div>
        <div class="tl-bucket ${bGold.length ? 'good' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bGold.length ? 'c-green' : 'c-muted'}">✅ Golden Window SEKARANG 11–59d (${bGold.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Renew 3 Tahun = Potong Gaji -12% Gratis!</div>
          <div>${pills(bGold)}</div>
        </div>
        <div class="tl-bucket ${bSoon.length ? 'warn' : ''}">
          <div style="font-size:11px;font-weight:800" class="${bSoon.length ? 'c-amber' : 'c-muted'}">⏳ Segera Masuk Golden 60–120d (${bSoon.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Tunggu sampai sisa ≤59 hari</div>
          <div>${pills(bSoon, p => ` → GW ${p.contractDays - 59}d`)}</div>
        </div>
        <div class="tl-bucket">
          <div style="font-size:11px;font-weight:800" class="c-sky">📆 Pantau 121–180d (${bMid.length})</div>
          <div class="c-muted" style="font-size:10px;margin-bottom:4px">Siapkan rencana perpanjangan / jual</div>
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

function renderRosterTable() {
  renderContractTimeline();
  renderRosterQuickChips();
  const rows = getFilteredRoster();

  document.getElementById('t4-tbl').innerHTML = `<thead><tr>
    ${thSort('name', 'Pemain & Aksi')}
    ${thSort('pos', 'Pos')}
    ${thSort('force', 'F→Cap')}
    ${thSort('contractDays', 'Kontrak')}
    ${thSort('salary', 'Gaji/Bln')}
    ${thSort('energy', 'Energi')}
    ${thSort('age', 'Usia')}
    ${thSort('growthFrac', 'Growth')}
    ${thSort('stackPct', 'Skill Stack')}
    ${thSort('marketValue', 'Nilai (Jual)')}
    <th class="col-desk-only">Rekomendasi Aksi</th>
  </tr></thead><tbody>` + (rows.length ? rows.map(p => {
    const stB = p.nonStack ? 'b-crit' : (p.stackGrade === 'GOD' ? 'b-good' : 'b-muted');
    const cB = p.contractDays <= 10 ? 'b-crit' : (p.contractDays <= 59 ? 'b-good' : 'b-muted');
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
      <td>${energyPillHtml(p.energy)}</td>
      <td class="mono ${p.age >= p.sellWarnAge ? 'c-amber' : ''}">${p.age} <span class="c-muted">(@${p.declineAge})</span></td>
      <td>${growthBarHtml(p.growthFrac, p.nearDrop)}</td>
      <td><span class="badge ${stB}" title="${esc(p.stackNote || (p.nonStack ? tipFor('NONSTACK') : ''))}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct}%)</span></td>
      <td class="mono">${fmtM(p.marketValue)} <div class="c-muted" style="font-size:10px">Real ~${fmtM(p.estRealSale)}</div></td>
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

function exportRosterCsv() {
  const rows = getFilteredRoster();
  const hdr = ['Name','Pos','Age','DeclineAge','Foot','Energy','Force','Pot','PotCap','S1','S2','StackPct','ContractDays','FineSlumpPct','Salary','MarketValue','EstRealSale','Action'];
  const lines = [hdr.join(',')].concat(rows.map(p => [
    `"${p.name.replace(/"/g,'""')}"`, fmtPos(p.pos), p.age, p.declineAge, fmtFoot(p.foot), p.energy, p.force, p.potential, p.potCap,
    fmtSkill(p.s1), fmtSkill(p.s2), p.stackPct, p.contractDays, p.fineSlumpPct || 0, p.salary, p.marketValue, p.estRealSale, `"${p.action}"`
  ].join(',')));
  downloadCsv('ligafoot_skuad.csv', lines.join('\n'));
}
