// ==================== RENDER TAB 1: BERANDA (v8.0) ====================
let guardExpanded = false;

function getCheckKey() { return 'lf_opt_v8_chk_' + D.meta.userId + '_' + D.meta.currentDate; }
function loadChk() { try { return JSON.parse(localStorage.getItem(getCheckKey()) || '{}'); } catch { return {}; } }
function saveChk(o) { try { localStorage.setItem(getCheckKey(), JSON.stringify(o)); } catch {} }

function routeAlertTarget(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('training')) return ['t3', 't3-train', 'Buka Training →'];
  if (c.includes('ruang ganti') || c.includes('mood')) return ['t3', 't3-train', 'Buka Ruang Ganti →'];
  if (c.includes('akademi')) return ['t3', 't3-acad', 'Buka Akademi →'];
  if (c.includes('kontrak') || c.includes('regresi') || c.includes('slump') || c.includes('loophole')) return ['t3', 't3-squad', 'Buka Skuad →'];
  if (c.includes('lubang') || c.includes('transfer')) return ['t4', 't4-bp', 'Buka Transfer →'];
  if (c.includes('tiket')) return ['t5', 't5-tkt', 'Buka Tiket →'];
  if (c.includes('shop') || c.includes('member') || c.includes('naming') || c.includes('sponsor')) return ['t5', 't5-ov', 'Buka Keuangan →'];
  if (c.includes('kartu') || c.includes('set-piece')) return ['t2', null, 'Buka War Room →'];
  return ['t3', 't3-xi', 'Lihat Taktik →'];
}

function renderTab1() {
  const m = D.meta, cf = D.cashflow, dl = D.deltas;
  const titleSt = computeTitleStatus();

  // 1. Hero Banner Laga Berikutnya (1-klik ke War Room)
  const heroEl = document.getElementById('t1-hero');
  const nextFx = (D.upcoming || [])[0];
  if (nextFx) {
    const recForm = nextFx.matchup ? fmtForm(nextFx.matchup.recommended.formation) : fmtForm(m.activeFormation);
    const tkt = nextFx.ticketRec;
    const tktBadge = tkt
      ? `<span class="badge ${tkt.diffs.length ? 'b-warn' : 'b-good'}">🎟️ ${tkt.diffs.length ? 'Ubah Tiket!' : 'Tiket Pas ✓'} (${tkt.prices.geral}·${tkt.prices.arquibancada}·${tkt.prices.cadeiras}·${tkt.prices.camarotes})</span>`
      : `<span class="badge b-muted">✈️ Tandang</span>`;
    const yBadge = (nextFx.yellowRisks && nextFx.yellowRisks.length)
      ? `<span class="badge b-crit">🟨 ${nextFx.yellowRisks.length} Rawan Skorsing</span>` : '';
    heroEl.innerHTML = `
      <div class="hero-match">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
            <span class="badge b-good">🔥 LAGA BERIKUTNYA</span>
            <span class="badge b-muted">${esc(nextFx.compName)}${nextFx.roundName ? ' • ' + esc(nextFx.roundName) : ''}</span>
            <span class="badge ${nextFx.safeRotate ? 'b-accent' : 'b-warn'}">${nextFx.safeRotate ? '🔄 Aman Rotasi' : '⚡ Full Best XI'}</span>
            ${tktBadge} ${yBadge}
          </div>
          <div style="font-size:16px;font-weight:900">
            ${nextFx.isHome ? '🏠' : '✈️'} vs ${esc(nextFx.oppName)}
            <span class="mono c-muted" style="font-size:12px;font-weight:600">(Lawan Avg ${nextFx.oppAvg} • Edge ${nextFx.edge >= 0 ? '+' : ''}${nextFx.edge} • Formasi: <b class="c-green">${esc(recForm)}</b>)</span>
          </div>
        </div>
        <button class="btn btn-green" onclick="activeMatchIdx=0;renderTab2();goToView('t2')">⚔️ Buka War Room →</button>
      </div>`;
  } else {
    heroEl.innerHTML = '';
  }

  // 2. 4 KPI Utama (Hierarki bersih, bukan 8 kotak seragam)
  const estNet = cf.estCurrentNet !== undefined ? cf.estCurrentNet : cf.monthlyNet;
  const userPos = titleSt ? `#${titleSt.userPos} Liga` : `Div ${m.division}`;
  const posSub = titleSt
    ? (titleSt.clinched ? '🏆 JUARA MATEMATIS!' : `Sisa ${titleSt.remUser} pekan • ${titleSt.lead >= 0 ? '+' + titleSt.lead : titleSt.lead} pts`)
    : `Board ${m.boardConf}% • Fans ${m.fanConf}%`;

  const kpis = [
    { l: 'Kas Klub', v: fmtM(m.budget), cls: m.budget >= 0 ? 'c-green' : 'c-red',
      s: dl.prevDate ? `Delta ${dl.budgetDelta >= 0 ? '+' : ''}${fmtM(dl.budgetDelta)} (vs ${dl.prevDate})` : `Hutang: ${fmtM(m.bankLoan)} • Nilai Skuad ${fmtM(m.squadValue)}` },
    { l: 'Est. Arus Kas Rutin / Bln', v: (estNet >= 0 ? '+' : '') + fmtM(estNet), cls: estNet >= 0 ? 'c-green' : 'c-amber',
      s: `Gaji ${fmtM(m.payroll)} • Ops ${fmtM(D.stadium.opsMonthly)} • Musim Lalu ${cf.monthlyNet >= 0 ? '+' : ''}${fmtM(cf.monthlyNet)}` },
    { l: 'Kekuatan Best XI', v: D.bestXi.avgScore, cls: 'c-sky',
      s: `${fmtForm(m.activeFormation)} • Asing ${D.bestXi.foreignCount}/${m.foreignCap} • ${m.unhappyCount} Unhappy • CT Lv ${m.ctLevel}` },
    { l: 'Posisi Klasemen', v: userPos, cls: (titleSt && titleSt.userPos === 1) ? 'c-green' : 'c-purple',
      s: posSub },
  ];
  document.getElementById('t1-kpis').innerHTML = kpis.map(k => `
    <div class="card">
      <div class="kpi-lbl">${k.l}</div>
      <div class="kpi-val mono ${k.cls}">${k.v}</div>
      <div class="kpi-sub">${k.s}</div>
    </div>`).join('');

  // 3. Auto-Guard Ringkas (1 baris hijau bila 6/6 aman; otomatis melebar jika ada isu)
  renderAutoGuard();

  // 4. Action Queue Terpadu (Alarm + Checklist + Tombol Lompat)
  renderActionQueue();

  // 5. Mini Top 5 Klasemen
  const mt = document.getElementById('t1-mini-title');
  if (mt) {
    mt.innerHTML = titleSt
      ? `<div class="badge ${titleSt.clinched ? 'b-good' : 'b-info'}" style="white-space:normal;line-height:1.4;padding:5px 8px">${esc(titleSt.text)}</div>`
      : '';
  }
  const top5 = (D.standings || []).slice(0, 5);
  const userRow = (D.standings || []).find(s => s.isUser);
  if (userRow && userRow.pos > 5) top5.push(userRow);
  document.getElementById('t1-mini-standings').innerHTML = `<thead><tr><th>#</th><th>Klub</th><th>Main</th><th>SG</th><th>Poin</th></tr></thead><tbody>` +
    (top5.length ? top5.map(s => `<tr class="${s.isUser ? 'hl-user' : ''}">
      <td class="mono">${s.pos}</td><td>${esc(s.name)}</td><td class="mono">${s.p}</td>
      <td class="mono ${s.gd >= 0 ? 'c-green' : 'c-red'}">${s.gd >= 0 ? '+' : ''}${s.gd}</td><td class="mono"><b>${s.pts}</b></td>
    </tr>`).join('') : '<tr><td colspan="5" class="c-muted">Klasemen tidak tersedia.</td></tr>') + `</tbody>`;

  // 6. Target Presiden + Delta Tracker
  const pg = (D.presGoals && typeof D.presGoals === 'object' && !Array.isArray(D.presGoals)) ? D.presGoals : null;
  let pgHtml = '';
  if (pg) {
    const list = [];
    if (pg.league) list.push(`• <b>${esc(pg.league.name || 'Liga')}:</b> ${formatPresTarget('league', pg.league.target)}`);
    if (pg.cup) list.push(`• <b>${esc(pg.cup.name || 'Piala')}:</b> ${formatPresTarget('cup', pg.cup.target)}`);
    if (pg.cont) list.push(`• <b>${esc(pg.cont.name || 'Kontinental')}:</b> ${formatPresTarget('cont', pg.cont.target)}`);
    if (pg.last && pg.last.bonus) list.push(`<span class="c-green">🏆 Bonus Musim Lalu: <b class="mono">+${fmtM(pg.last.bonus)}</b></span>`);
    pgHtml = list.join('<br/>');
  }
  document.getElementById('t1-pres-goals').innerHTML = pgHtml || '<span class="c-muted">Tidak ada target presiden aktif.</span>';

  const dEl = document.getElementById('t1-deltas');
  if (!dl.prevDate) {
    dEl.innerHTML = `<div class="c-muted" style="border-top:1px solid var(--border);padding-top:8px">Snapshot awal tersimpan (<b>${m.currentDate}</b>). Delta otomatis tampil di save berikutnya.</div>`;
  } else {
    const chg = dl.playerChanges.slice(0, 6).map(c =>
      `<span class="badge ${c.forceDelta > 0 ? 'b-good' : (c.forceDelta < 0 ? 'b-crit' : 'b-info')}">${esc(c.name)} F${c.forceDelta >= 0 ? '+' : ''}${c.forceDelta}</span>`
    ).join(' ');
    dEl.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:8px">
      <div class="mb-8"><b>Delta vs ${dl.prevDate}:</b> Kas <b class="mono">${dl.budgetDelta >= 0 ? '+' : ''}${fmtM(dl.budgetDelta)}</b> • Gaji <b class="mono">${dl.payrollDelta >= 0 ? '+' : ''}${fmtM(dl.payrollDelta)}</b> • Member <b class="mono">${dl.membersDelta >= 0 ? '+' : ''}${dl.membersDelta}</b></div>
      <div class="pill-row" style="margin:0">${chg || '<span class="c-muted">Belum ada perubahan Force.</span>'}</div>
    </div>`;
  }
}

function toggleGuardExpand() {
  guardExpanded = !guardExpanded;
  renderAutoGuard();
}

function renderAutoGuard() {
  const wrap = document.getElementById('t1-autoguard-wrap');
  const ag = D.autoGuard;
  if (!wrap || !ag) return;
  const hasIssue = ag.issueCount > 0;
  const open = hasIssue || guardExpanded;
  const stBadge = s => s === 'crit' ? 'b-crit' : (s === 'warn' ? 'b-warn' : 'b-good');
  const slumpHtml = (D.fineSlumpPlayers && D.fineSlumpPlayers.length)
    ? `<div class="alert-item CRITICAL mt-12" style="margin-bottom:0"><span class="badge b-crit">RADAR SLUMP</span><div><b>Penalti denda aktif:</b> ${D.fineSlumpPlayers.map(s => `${esc(s.name)} (-${s.slumpPct}%, ${s.days}d)`).join(' · ')}</div></div>`
    : '';

  const detailsGrid = open ? `
    <div class="grid g3 mt-12" style="gap:9px">
      ${ag.items.map(it => `
        <div style="background:var(--bg2);border:1px solid ${it.status === 'crit' ? 'rgba(239,68,68,.5)' : (it.status === 'warn' ? 'rgba(245,158,11,.45)' : 'var(--border)')};border-radius:10px;padding:8px 10px">
          <div class="flex-between">
            <strong style="font-size:12px">${esc(it.label)}</strong>
            <span class="badge ${stBadge(it.status)} mono">${esc(it.val)}</span>
          </div>
          <div class="c-muted" style="font-size:11px;margin-top:3px">${esc(it.advice)}</div>
        </div>`).join('')}
    </div>${slumpHtml}` : slumpHtml;

  wrap.innerHTML = `
    <div class="guard-strip ${hasIssue ? 'has-issue' : ''}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px">
        <span class="badge ${hasIssue ? 'b-crit' : 'b-good'}">${hasIssue ? '⚠️ ' + ag.issueCount + ' PENGATURAN PERLU DIUBAH' : '🛡️ AUTO-GUARD 6/6 HIJAU'}</span>
        <span class="c-muted">${hasIssue ? 'Perbaiki setelan merah/kuning di bawah agar tidak merugikan klub.' : `Training ${ag.trainMode.toUpperCase()} · FineAuto OFF · Lineup Manual · CT Maint ON · Shop ${D.shop.cur_m.toFixed(2)}x · Member ${D.member.cur_m.toFixed(2)}x/${D.member.cur_d}%`}</span>
      </div>
      <button class="btn btn-sm" onclick="toggleGuardExpand()">${open ? 'Ringkas ▲' : 'Rincian ▼'}</button>
    </div>
    ${detailsGrid}`;
}

function renderActionQueue() {
  const chk = loadChk();
  const raw = D.alerts || [];
  const items = raw.map((a, idx) => {
    const id = 'aq_' + idx + '_' + (a.cat || '').replace(/\W/g, '');
    const [tab, sub, btnLbl] = routeAlertTarget(a.cat);
    return { ...a, id, done: !!chk[id], tab, sub, btnLbl };
  });

  // Belum selesai di atas, yang sudah dicentang turun ke bawah
  items.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  const remCnt = items.filter(x => !x.done).length;
  const cntBadge = document.getElementById('t1-alert-cnt');
  cntBadge.textContent = remCnt ? `${remCnt} Aksi Tersisa` : '✓ Semua Beres';
  cntBadge.className = 'badge ' + (remCnt ? (items.some(x => !x.done && x.sev === 'CRITICAL') ? 'b-crit' : 'b-warn') : 'b-good');

  const el = document.getElementById('t1-action-queue');
  if (!items.length) {
    el.innerHTML = '<div class="c-green" style="font-size:12px">🎉 Tidak ada alarm atau aksi mendesak hari ini! Langsung lanjut ke War Room &amp; bertanding.</div>';
    return;
  }
  el.innerHTML = items.map(it => {
    const sevCls = it.sev === 'CRITICAL' ? 'b-crit' : (it.sev === 'HIGH' ? 'b-warn' : 'b-info');
    const subArg = it.sub ? `'${it.sub}'` : 'null';
    return `<div class="aq-item ${it.sev} ${it.done ? 'done' : ''}">
      <input type="checkbox" style="margin-top:3px;cursor:pointer;accent-color:#10b981;width:16px;height:16px;flex-shrink:0" ${it.done ? 'checked' : ''} onchange="toggleChk('${escJs(it.id)}')" />
      <div style="flex:1;min-width:0">
        <div class="flex-between">
          <div class="aq-title" style="font-size:12px;font-weight:700">
            <span class="badge ${sevCls}" style="margin-right:4px">${esc(it.cat)}</span>${esc(it.title)}
          </div>
          <button class="btn btn-sm" onclick="goToView('${it.tab}', ${subArg})">${esc(it.btnLbl)}</button>
        </div>
        <div class="c-muted" style="font-size:11px;margin-top:3px">${esc(it.action)}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleChk(id) { const c = loadChk(); c[id] = !c[id]; saveChk(c); renderActionQueue(); }
function resetChecklist() { saveChk({}); renderActionQueue(); showToast('Centang Action Queue direset'); }
