// ==================== RENDER TAB 4: AUDIT SKUAD, TIMELINE KONTRAK & TRAINING (v8.0) ====================
function sortRoster(col) {
  if (rosterSort.col === col) rosterSort.dir *= -1;
  else { rosterSort.col = col; rosterSort.dir = -1; }
  renderRosterTable();
}

function getFilteredRoster() {
  const q = (document.getElementById('t4-search').value || '').toLowerCase();
  const flt = document.getElementById('t4-filter').value;
  return D.roster.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q) || fmtPos(p.pos).toLowerCase().includes(q))) return false;
    if (flt === 'GOLDEN') return p.contractDays >= 11 && p.contractDays <= 59;
    if (flt === 'DECLINE') return p.isDeclining || p.age >= p.sellWarnAge;
    if (flt === 'NONSTACK') return p.nonStack;
    if (flt === 'TRAP') return p.isTrap;
    if (flt === 'GEM') return p.isGem;
    if (flt === 'UNHAPPY') return p.mood === 'unhappy' || p.roleSore;
    if (flt === 'SLUMP') return (p.fineSlump || 0) > 0;
    if (flt === 'LOOPHOLE') return !!p.autoRenewLoophole;
    return true;
  }).sort((a, b) => {
    const va = a[rosterSort.col], vb = b[rosterSort.col];
    if (typeof va === 'string') return va.localeCompare(vb) * rosterSort.dir;
    return ((va || 0) - (vb || 0)) * rosterSort.dir;
  });
}

function renderContractTimeline() {
  const el = document.getElementById('t4-contract-timeline');
  if (!el) return;
  const bTrap = D.roster.filter(p => p.contractDays <= 10).sort((a, b) => a.contractDays - b.contractDays);
  const bGold = D.roster.filter(p => p.contractDays >= 11 && p.contractDays <= 59).sort((a, b) => a.contractDays - b.contractDays);
  const bSoon = D.roster.filter(p => p.contractDays >= 60 && p.contractDays <= 120).sort((a, b) => a.contractDays - b.contractDays);
  const bMid  = D.roster.filter(p => p.contractDays >= 121 && p.contractDays <= 180).sort((a, b) => a.contractDays - b.contractDays);

  const pills = (arr, extraFn) => arr.length
    ? arr.map(p => `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b> <span class="mono c-muted">${p.contractDays}d${extraFn ? extraFn(p) : ''}</span></span>`).join('')
    : '<span class="c-muted" style="font-size:11px">Tidak ada</span>';

  el.innerHTML = `
    <details class="glossary-inline" ${bTrap.length || bGold.length || bSoon.length ? 'open' : ''} style="padding:10px 12px">
      <summary>📅 Kalender Kontrak 6 Bulan (Klik nama pemain untuk buka profil &amp; rencana renew)</summary>
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

function renderRosterTable() {
  renderContractTimeline();
  const rows = getFilteredRoster();
  document.getElementById('t4-tbl').innerHTML = `<thead><tr>
    <th onclick="sortRoster('name')">Pemain (Klik Profil)</th><th onclick="sortRoster('pos')">Pos</th>
    <th onclick="sortRoster('age')">Usia</th><th onclick="sortRoster('energy')">Energi</th>
    <th onclick="sortRoster('force')">Force</th><th onclick="sortRoster('potCap')">Pot / Cap</th>
    <th onclick="sortRoster('growthFrac')">Growth Bar</th><th onclick="sortRoster('stackPct')">Skill Stack</th>
    <th onclick="sortRoster('contractDays')">Kontrak</th><th onclick="sortRoster('salary')">Gaji/Bln</th>
    <th onclick="sortRoster('marketValue')">Nilai (Est. Jual)</th><th>Rekomendasi Aksi</th>
  </tr></thead><tbody>` + rows.map(p => {
    const stB = p.nonStack ? 'b-crit' : (p.stackGrade === 'GOD' ? 'b-good' : 'b-muted');
    const cB = p.contractDays <= 10 ? 'b-crit' : (p.contractDays <= 59 ? 'b-good' : 'b-muted');
    const actB = { crit: 'b-crit', warn: 'b-warn', good: 'b-good', accent: 'b-accent', info: 'b-info', muted: 'b-muted' }[p.actionCls] || 'b-muted';
    const slumpBadge = (p.fineSlump > 0) ? ` <span class="badge b-crit" title="${esc(tipFor('SLUMP'))}">SLUMP -${p.fineSlumpPct}%</span>` : '';
    const narTag = p.noAutoRenew ? '<div class="c-muted" style="font-size:10px">noAutoRenew ✓</div>' : '';
    const loopTag = p.autoRenewLoophole ? `<div class="c-sky" style="font-size:10px" title="${esc(tipFor('LOOPHOLE'))}">💎 Auto-Renew 0% (+180d)</div>` : '';
    return `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> ${p.top ? '👑' : (p.star ? '⭐' : '')} ${p.injured ? `<span class="badge b-crit">🏥${p.injuryDays}d</span>` : ''}${slumpBadge}</td>
      <td><b>${fmtPos(p.pos)}</b> <span class="c-muted" style="font-size:10px">${fmtFoot(p.foot)}</span></td>
      <td class="mono ${p.age >= p.sellWarnAge ? 'c-amber' : ''}">${p.age} <span class="c-muted">(@${p.declineAge})</span></td>
      <td>${energyPillHtml(p.energy)}</td>
      <td class="mono"><b>${p.force}</b></td>
      <td class="mono">${p.potential} / <b>${p.potCap}</b> ${p.isTrap ? `<span class="badge b-crit" title="${esc(tipFor('TRAP'))}">TRAP</span>` : (p.isGem ? `<span class="badge b-good" title="${esc(tipFor('GEM'))}">GEM</span>` : '')}</td>
      <td>${growthBarHtml(p.growthFrac, p.nearDrop)}</td>
      <td><span class="badge ${stB}" title="${esc(p.stackNote || (p.nonStack ? tipFor('NONSTACK') : ''))}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct}%)</span></td>
      <td><span class="badge ${cB} mono">${p.contractDays}d</span>${loopTag}${p.benchCutSave ? `<div class="c-sky" style="font-size:10px">Trik Bangku -${fmtM(p.benchCutSave)}</div>` : ''}${narTag}</td>
      <td class="mono">${fmtM(p.salary)}</td>
      <td class="mono">${fmtM(p.marketValue)} <div class="c-muted" style="font-size:10px">Real ~${fmtM(p.estRealSale)}</div></td>
      <td><span class="badge ${actB}">${esc(p.action)}</span></td>
    </tr>`;
  }).join('') + `</tbody>`;

  // Optimizer Special Training (Perbandingan Slot Aktif vs Rekomendasi Terbaik)
  const tr = D.trainAudit;
  const byId = Object.fromEntries((D.roster || []).map(p => [p.id, p]));
  const wastedSet = new Set(tr.wastedNames || []);
  const curCards = (tr.currentIds && tr.currentIds.length)
    ? tr.currentIds.map(id => {
        const p = byId[id];
        if (!p) return '';
        const isW = wastedSet.has(p.name) || (p.force >= p.potCap);
        const gap = Math.max(0, p.potCap - p.force);
        return `<div class="alert-item ${isW ? 'CRITICAL' : ''}" style="cursor:pointer;margin-bottom:6px" onclick="openPlayerDrawer('roster','${escJs(p.id)}')">
          <span class="badge ${isW ? 'b-crit' : 'b-good'}">${isW ? 'MENTOK!' : 'AKTIF ✓'}</span>
          <div><b>${esc(p.name)}</b> (${fmtPos(p.pos)} ${p.age}th • <span class="mono">${p.force}→${p.potCap}, gap +${gap}</span>)
          <div class="c-muted" style="font-size:11px">${isW ? 'Slot terbuang — segera ganti dengan rekomendasi di kanan!' : `Growth ${p.growthFrac >= 0 ? '+' : ''}${p.growthFrac} · ${fmtSkills(p.s1, p.s2)}`}</div></div>
        </div>`;
      }).join('')
    : '<div class="c-muted">Belum ada slot manual terbaca.</div>';

  const idealCards = (tr.ideal || []).map(x => {
    const p = (D.roster || []).find(r => r.name === x.name);
    const pid = p ? p.id : '';
    const isAct = pid && (tr.currentIds || []).includes(pid);
    return `<div class="alert-item" style="cursor:pointer;margin-bottom:6px;border-color:${isAct ? 'rgba(16,185,129,.45)' : 'rgba(56,189,248,.45)'}" ${pid ? `onclick="openPlayerDrawer('roster','${escJs(pid)}')"` : ''}>
      <span class="badge ${isAct ? 'b-good' : 'b-info'}">${isAct ? 'SUDAH MASUK' : 'MASUKKAN!'}</span>
      <div><b>${esc(x.name)}</b> (${fmtPos(x.pos)} ${x.age}th • <span class="mono c-green">${x.force}→${x.potCap}, gap +${x.gap}</span>)</div>
    </div>`;
  }).join('');

  const autoWarn = tr.mode === 'auto'
    ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">AUTO AKTIF</span><div><b>Mode AUTO Special Training aktif!</b> Di bytecode #34840, mode auto 100% buta potCap (cuma pilih usia termuda). Wajib ubah ke <b>MANUAL</b>!</div></div>`
    : '';
  document.getElementById('t4-training').innerHTML = `
    <div class="mb-8">Mode: <b class="${tr.mode === 'auto' ? 'c-red' : 'c-green'}">${tr.mode.toUpperCase()}</b> | Kapasitas CT Lv ${D.meta.ctLevel}: <b>${tr.slots} slot</b></div>
    ${autoWarn}
    <div class="grid g2">
      <div><h3>📌 Slot Aktif Saat Ini (${(tr.currentIds || []).length}/${tr.slots})</h3>${curCards}</div>
      <div><h3>✨ Rekomendasi ${tr.slots} Slot Terbaik (Gap PotCap Terbesar)</h3>${idealCards}</div>
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
