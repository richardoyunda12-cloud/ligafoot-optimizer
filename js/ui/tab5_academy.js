// ==================== RENDER TAB 3D: AKADEMI (v8.2.2) ====================
let acadFilter = 'ALL'; // ALL | PROMO | HOLE | STAR6 | AGE20
let acadSort = { col: 'pipeScore', dir: -1 };

function setAcadFilter(f) {
  acadFilter = f;
  renderTab5();
}

function sortAcad(col) {
  if (acadSort.col === col) acadSort.dir *= -1;
  else { acadSort.col = col; acadSort.dir = -1; }
  renderTab5();
}

function matchAcadFilter(y, flt) {
  if (flt === 'PROMO') return String(y.action || '').includes('PROMO');
  if (flt === 'HOLE') return Boolean(y.fillsHole);
  if (flt === 'STAR6') return (y.hash || 0) >= 6;
  if (flt === 'AGE20') return (y.age || 0) >= 20;
  return true;
}

function acadTh(col, label, extraCls = '') {
  const act = acadSort.col === col ? 'sort-active' : '';
  const arr = acadSort.col === col ? (acadSort.dir === -1 ? ' ▼' : ' ▲') : '';
  return `<th class="${act} ${extraCls}" onclick="sortAcad('${col}')">${label}${arr}</th>`;
}

function renderTab5() {
  const youth = D.youth || [];
  const promoCnt = youth.filter(y => matchAcadFilter(y, 'PROMO')).length;
  const holeCnt = youth.filter(y => y.fillsHole).length;
  const age20Cnt = youth.filter(y => (y.age || 0) >= 20).length;
  const star6Cnt = youth.filter(y => (y.hash || 0) >= 6).length;

  // 4 Mini KPI Akademi (2x2 di HP)
  const kpiEl = document.getElementById('t5-kpis');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="t3-mini-strip">
        <div class="t3-mini-card"><div class="kpi-lbl">Total Prospek</div><div class="kpi-val mono c-sky">${youth.length}</div><div class="kpi-sub">★6+: ${star6Cnt} pemain</div></div>
        <div class="t3-mini-card"><div class="kpi-lbl">Siap Promosi</div><div class="kpi-val mono c-green">${promoCnt}</div><div class="kpi-sub">Dev ≥90 atau 20th</div></div>
        <div class="t3-mini-card"><div class="kpi-lbl">Tambal Lubang</div><div class="kpi-val mono c-purple">${holeCnt}</div><div class="kpi-sub">Cocok lubang senior</div></div>
        <div class="t3-mini-card"><div class="kpi-lbl">Mentok Usia 20</div><div class="kpi-val mono ${age20Cnt ? 'c-amber' : 'c-muted'}">${age20Cnt}</div><div class="kpi-sub">Berhenti tumbuh di 20th</div></div>
      </div>`;
  }

  document.getElementById('t5-holes').innerHTML = (D.holes && D.holes.length)
    ? `<b>Lubang Skuad Senior Aktif:</b> ` + D.holes.map(h => `<span class="badge b-warn">${esc(fmtPos(h.pos))}: ${esc(h.desc)}</span>`).join(' ')
    : '<span class="c-green">Tidak ada lubang posisi kritis di skuad senior.</span>';

  // Quick Filter Pills Akademi
  const chipEl = document.getElementById('t5-quick-chips');
  if (chipEl) {
    const defs = [
      ['ALL', 'Semua', youth.length],
      ['PROMO', '🚀 Promosikan', promoCnt],
      ['HOLE', '✓ Tambal Lubang', holeCnt],
      ['STAR6', '★6+ Elite', star6Cnt],
      ['AGE20', '⚠ Usia 20', age20Cnt],
    ];
    chipEl.innerHTML = defs.map(([val, lbl, cnt]) =>
      `<button type="button" class="qchip ${acadFilter === val ? 'active' : ''} ${cnt === 0 ? 'is-empty' : ''}" onclick="setAcadFilter('${val}')">${lbl} <span class="mono">(${cnt})</span></button>`
    ).join('');
  }

  const rows = youth
    .filter(y => matchAcadFilter(y, acadFilter))
    .sort((a, b) => {
      const va = a[acadSort.col], vb = b[acadSort.col];
      if (typeof va === 'string') return va.localeCompare(vb) * acadSort.dir;
      return ((va || 0) - (vb || 0)) * acadSort.dir;
    });

  document.getElementById('t5-tbl').innerHTML = `<thead><tr>
    ${acadTh('name', 'Prospek & Aksi')}
    ${acadTh('pos', 'Pos')}
    ${acadTh('hash', 'Bintang')}
    ${acadTh('development', 'Dev')}
    ${acadTh('age', 'Usia')}
    ${acadTh('force', 'F')}
    <th>Plafon +</th>
    <th>Skill Stack</th>
    ${acadTh('pipeScore', 'Skor')}
    <th class="col-desk-only">Aksi</th>
  </tr></thead><tbody>` + (rows.length ? rows.map(y => {
    const devPct = Math.min(100, Math.max(0, Math.round(y.development || 0)));
    const devCol = devPct >= 90 ? 'var(--green)' : (devPct >= 60 ? 'var(--sky)' : 'var(--amber)');
    const actCls = y.action.includes('PROMO') ? 'b-good' : (y.action.includes('TAHAN') ? 'b-info' : 'b-muted');
    const age20Badge = (y.age || 0) >= 20 ? '<span class="badge b-warn">⚠ MENTOK 20th</span>' : '';
    return `<tr>
      <td>
        <div><a class="clickable-name" onclick="openPlayerDrawer('youth','${escJs(y.id)}')"><b>${esc(y.name)}</b></a></div>
        <div class="inline-sticky-meta">
          <span class="badge ${actCls}">${esc(y.action)}</span>
          ${y.fillsHole ? '<span class="badge b-good">✓ TAMBAL</span>' : ''}
          ${age20Badge}
        </div>
      </td>
      <td><b>${fmtPos(y.pos)}</b> <span class="c-muted" style="font-size:10px">${fmtFoot(y.foot)}</span></td>
      <td class="mono c-amber"><b>★${y.hash}</b></td>
      <td><div class="mini-bar-wrap"><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${devPct}%;background:${devCol}"></div></div><span class="mono" style="font-size:11px;min-width:28px;text-align:right">${devPct}%</span></div></td>
      <td class="mono ${y.age >= 20 ? 'c-amber' : ''}"><b>${y.age}</b></td>
      <td class="mono">${y.force}</td>
      <td class="mono c-green">${y.ceilBonus ? '+' + y.ceilBonus : '-'}</td>
      <td><span class="badge ${y.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(y.s1, y.s2)} (+${y.stackPct}%)</span></td>
      <td class="mono"><b>${y.pipeScore}</b></td>
      <td class="col-desk-only"><span class="badge ${actCls}">${esc(y.action)}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10" class="c-muted">Tidak ada prospek akademi yang cocok dengan filter ini.</td></tr>') + `</tbody>`;
}
