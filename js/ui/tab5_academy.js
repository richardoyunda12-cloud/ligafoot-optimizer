// ==================== RENDER TAB 3D: AKADEMI (v8.2.2) ====================
let acadFilter = 'ALL'; // ALL | PROMO | HOLE | STAR6 | AGE20
let acadSort = { col: 'pipeScore', dir: -1 };
let yScoutTab = 'LOCAL'; // LOCAL | FOREIGN

function setYScoutTab(t) {
  yScoutTab = t === 'FOREIGN' ? 'FOREIGN' : 'LOCAL';
  renderTab5();
}

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
  const arr = acadSort.col === col ? (acadSort.dir === -1 ? '▼' : '▲') : '⇅';
  return `<th class="th-sort ${act} ${extraCls}" data-sort-col="${col}" title="Klik untuk urutkan berdasarkan ${esc(label)}" onclick="sortAcad('${col}')">${label}<span class="sort-ico">${arr}</span></th>`;
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
        <div class="t3-mini-card"><div class="kpi-lbl">Siap Promosi</div><div class="kpi-val mono c-green">${promoCnt}</div><div class="kpi-sub">Dev ≥90 atau 20th+</div></div>
        <div class="t3-mini-card"><div class="kpi-lbl">Tambal Lubang</div><div class="kpi-val mono c-purple">${holeCnt}</div><div class="kpi-sub">Cocok lubang senior</div></div>
        <div class="t3-mini-card"><div class="kpi-lbl">Usia 20+ (Puncak)</div><div class="kpi-val mono ${age20Cnt ? 'c-amber' : 'c-muted'}">${age20Cnt}</div><div class="kpi-sub">Rate 0.35 @20, stop @21+</div></div>
      </div>
      <div class="c-muted" style="font-size:11px;margin-top:6px">💡 <b>Alur Akademi → Tim B:</b> Matangkan di Akademi sampai Dev ≥90% (maks usia 20, stop tumbuh @21+) → Promosi → Jika Force masih jauh di bawah XI atau berlebih kuota asing, kirim gratis ke <b>Tim B</b>.</div>`;
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
      if (acadSort.col === 'estPotCap') {
        const pa = Number(a.estPotCap || a.potCap || a.force) || 0;
        const pb = Number(b.estPotCap || b.potCap || b.force) || 0;
        if (pa !== pb) return (pa - pb) * acadSort.dir;
        return ((b.force || 0) - (a.force || 0)) || String(a.name || '').localeCompare(String(b.name || ''));
      }
      const va = a[acadSort.col], vb = b[acadSort.col];
      if (typeof va === 'string') return va.localeCompare(vb) * acadSort.dir;
      const df = ((va || 0) - (vb || 0)) * acadSort.dir;
      return df !== 0 ? df : ((b.force || 0) - (a.force || 0));
    });

  document.getElementById('t5-tbl').innerHTML = `<thead><tr>
    ${acadTh('name', 'Prospek & Aksi')}
    ${acadTh('pos', 'Pos')}
    ${acadTh('hash', 'Bintang')}
    ${acadTh('development', 'Dev')}
    ${acadTh('age', 'Usia', 'col-hide-mob')}
    ${acadTh('force', 'Force')}
    ${acadTh('estPotCap', 'Est. PotCap')}
    ${acadTh('stackPct', 'Skill Stack')}
    ${acadTh('pipeScore', 'Skor', 'col-hide-mob')}
    <th class="col-desk-only">Aksi</th>
  </tr></thead><tbody>` + (rows.length ? rows.map(y => {
    const devPct = Math.min(100, Math.max(0, Math.round(y.development || 0)));
    const devCol = devPct >= 90 ? 'var(--green)' : (devPct >= 60 ? 'var(--sky)' : 'var(--amber)');
    const actCls = y.action.includes('PROMO') ? 'b-good' : (y.action.includes('TAHAN') ? 'b-info' : 'b-muted');
    const age20Badge = (y.age || 0) > 20 ? '<span class="badge b-crit">⚠ STALLED 21+</span>' : ((y.age || 0) === 20 ? '<span class="badge b-warn">⏳ LAMBAT 20th</span>' : '');
    const stackCell = typeof skillStackCellHtml === 'function' ? skillStackCellHtml(y) : `<span class="badge ${y.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(y.s1, y.s2)} (+${y.stackPct}%)</span>`;
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
      <td class="mono col-hide-mob ${y.age >= 20 ? 'c-amber' : ''}"><b>${y.age}</b></td>
      <td class="mono"><b>${y.force}</b></td>
      <td class="mono"><b class="c-green">${y.estPotCap || y.potCap || y.force}</b>${Array.isArray(y.estPotRange) ? `<div class="c-muted" style="font-size:10px">Est ${y.estPotRange[0]}–${y.estPotRange[1]}</div>` : ''}</td>
      <td>${stackCell}</td>
      <td class="mono col-hide-mob"><b>${y.pipeScore}</b></td>
      <td class="col-desk-only"><span class="badge ${actCls}">${esc(y.action)}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10" class="c-muted">Tidak ada prospek akademi yang cocok dengan filter ini.</td></tr>') + `</tbody>`;
  if (typeof syncTableAllColsClass === 'function') syncTableAllColsClass('t5-tbl');

  // Panel Olheiro da Base Rival Junior (#25334–#25338)
  let ysBox = document.getElementById('t5-yscout-box');
  if (!ysBox) {
    const tblWrap = document.getElementById('t5-tbl') && document.getElementById('t5-tbl').parentNode;
    if (tblWrap && tblWrap.parentNode) {
      ysBox = document.createElement('div');
      ysBox.id = 't5-yscout-box';
      ysBox.className = 'mt-12';
      tblWrap.parentNode.appendChild(ysBox);
    }
  }
  if (ysBox) {
    const rawRival = (D.rivalYouthTargets && D.rivalYouthTargets.length) ? D.rivalYouthTargets : (D.youthScoutTargets || []);
    const isRivalAcad = Boolean(D.rivalYouthTargets && D.rivalYouthTargets.length);
    const ysLocAll = rawRival.filter(x => x.isLocal);
    const ysFrgAll = rawRival.filter(x => !x.isLocal);
    const ysActive = (yScoutTab === 'FOREIGN' ? ysFrgAll : ysLocAll).slice(0, 10);
    const debtRoom = Number((D.meta && D.meta.transferDebtRoom) || 0);
    const isBanned = Boolean(D.meta && D.meta.transferBanned);
    const instBadge = isBanned
      ? `<span class="badge b-crit">⛔ Transfer Ban (Wajib Tunai)</span>`
      : `<span class="badge b-info mono" title="Bajak junior rival bisa dicicil DP 25% + 6/12/24 bln">💳 Bisa Cicil DP 25% · Plafon ${fmtM(debtRoom)}</span>`;
    const renderYsRows = (arr) => arr.length ? arr.map(t => {
      const priceVal = t.price || t.scoutPrice || 0;
      const dp25 = t.dp25 || Math.round(priceVal * 0.25);
      const nameHtml = isRivalAcad
        ? `<b>${esc(t.name)}</b>`
        : `<a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(t.id)}')"><b>${esc(t.name)}</b></a>`;
      const extraCol = isRivalAcad
        ? `<td class="mono c-sky col-hide-mob"><b>${t.development || 50}%</b></td>`
        : `<td class="mono c-sky col-hide-mob"><b>+${t.youthScoutGap}</b></td>`;
      return `<tr>
      <td>${nameHtml}</td>
      <td class="mono"><b>${fmtPos(t.pos)}</b> · ${t.age}th · ${fmtFoot(t.foot)}</td>
      <td class="mono"><b>${t.force}</b>→<b class="c-green">${t.potCap}</b> <span class="c-muted">(★${t.hash})</span></td>
      ${extraCol}
      <td class="col-hide-mob"><span class="badge b-good">${fmtSkills(t.s1, t.s2)} (+${t.stackPct}%)</span></td>
      <td class="mono"><b class="c-amber">${fmtM(priceVal)}</b><div class="c-sky" style="font-size:10.5px">DP 25%: ${fmtM(dp25)}</div></td>
      <td class="col-hide-mob">${esc(t.teamName)} <span class="c-muted">(${esc(t.teamCountry)})</span></td>
    </tr>`;
    }).join('') : '<tr><td colspan="7" class="c-muted">Tidak ada kandidat.</td></tr>';

    const hdrTitle = isRivalAcad
      ? '🎓 Radar Olheiro da Base — Bajak Akademi Junior Rival (#25335)'
      : '🎓 Radar Prospek U-21 Rival (#25091)';
    const hdrSub = isRivalAcad
      ? `Pemain akademi <code>youthPlayers</code> klub rival ★≥6 (harga 3.5x–8.0x MV + floor divisi/bintang; bisa DP 25% + cicilan 6/12/24 bln; tanpa kuota musim &amp; tanpa diskon CT). ${instBadge}`
      : `Pemain senior U-21 klub AI dengan margin tumbuh ≥10 (valuasi Olheiro ~2.0x MV; bisa tunai/cicil DP 25%). ${instBadge}`;

    ysBox.innerHTML = rawRival.length ? `
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div class="flex-between mb-8" style="gap:8px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">${hdrTitle}</h3>
            <div class="kpi-sub">${hdrSub}</div>
          </div>
          <div class="quick-chips-bar" style="margin:0">
            <button type="button" class="qchip ${yScoutTab === 'LOCAL' ? 'active' : ''}" onclick="setYScoutTab('LOCAL')">🇮🇩 Lokal (${ysLocAll.length})</button>
            <button type="button" class="qchip ${yScoutTab === 'FOREIGN' ? 'active' : ''}" onclick="setYScoutTab('FOREIGN')">🌍 Asing (${ysFrgAll.length})</button>
          </div>
        </div>
        <div class="tbl-wrap tbl-sticky"><table>
          <thead><tr><th>Target Junior</th><th>Pos / Usia</th><th>F → PotCap</th><th class="col-hide-mob">${isRivalAcad ? 'Dev' : 'Gap'}</th><th class="col-hide-mob">Skill Stack</th><th>Harga / DP 25%</th><th class="col-hide-mob">Klub Asal</th></tr></thead>
          <tbody>${renderYsRows(ysActive)}</tbody>
        </table></div>
      </div>` : '';
  }
}
