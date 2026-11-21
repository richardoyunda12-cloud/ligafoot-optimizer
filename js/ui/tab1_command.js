// ==================== RENDER TAB 1: BERANDA (v8.2 — AUDIT FIX COMPLETE) ====================
let guardExpanded = false;
let aqFilter = 'ALL'; // 'ALL' | 'CRIT'

function getCheckKey() {
  return 'lf_opt_v8_chk_' + (D.meta && D.meta.userId ? D.meta.userId : 'u') + '_' + (D.meta && D.meta.currentDate ? D.meta.currentDate : 'd');
}
function loadChk() {
  try { return JSON.parse(localStorage.getItem(getCheckKey()) || '{}'); } catch { return {}; }
}
function saveChk(o) {
  try { localStorage.setItem(getCheckKey(), JSON.stringify(o)); } catch {}
}

/**
 * Kunci stabil berbasis cat + title (BUKAN index array) agar status centang
 * tidak pernah bergeser ketika 1 alert selesai atau bertambah!
 */
function stableAlertId(a) {
  const raw = `${a.cat || ''}|${a.title || ''}`.toLowerCase().replace(/\d+/g, '#').trim();
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'aq_' + ((h >>> 0).toString(36));
}

function formatMatchCountdown(fx) {
  if (!fx || fx.day === null || fx.day === undefined || fx.day === '') return '';
  const dRaw = fx.day;
  let diff = null;
  if (typeof dRaw === 'string' && dRaw.includes('-')) {
    const a = Date.parse(String(D.meta.currentDate || '').slice(0, 10) + 'T00:00:00Z');
    const b = Date.parse(dRaw.slice(0, 10) + 'T00:00:00Z');
    if (Number.isFinite(a) && Number.isFinite(b)) diff = Math.round((b - a) / 86400000);
  } else {
    const fxDay = Number(dRaw);
    const todayNum = Number(D.meta && D.meta.todayNum);
    if (Number.isFinite(fxDay) && Number.isFinite(todayNum) && todayNum >= 0) {
      diff = Math.round(fxDay - todayNum);
      if (diff < -180) diff += 365;
    }
  }
  if (diff === null || diff < 0 || diff > 120) return '';
  if (diff === 0) return 'Hari Ini';
  if (diff === 1) return 'Besok';
  return `${diff} hari lagi`;
}

function getAlertActionSpec(a) {
  const c = String(a.cat || '').toLowerCase();
  const t = String(a.title || '').toLowerCase();

  if (c.includes('auto-guard')) {
    if (t.includes('training')) return { lbl: 'Atur Training →', act: "goToView('t3','t3-train')" };
    return { lbl: 'Cek Auto-Guard ↑', act: 'expandAutoGuardAndScroll()' };
  }
  if (c.includes('training') || c.includes('ruang ganti') || c.includes('mood')) {
    return { lbl: 'Buka Ruang Ganti →', act: "goToView('t3','t3-train')" };
  }
  if (c.includes('akademi')) {
    return { lbl: 'Buka Akademi →', act: "goToView('t3','t3-acad')" };
  }
  if (c.includes('kontrak -12%') || t.includes('golden window')) {
    return { lbl: 'Filter Golden →', act: "openSquadWithFilter('GOLDEN')" };
  }
  if (c.includes('loophole')) {
    return { lbl: 'Filter Loophole →', act: "openSquadWithFilter('LOOPHOLE')" };
  }
  if (c.includes('slump')) {
    return { lbl: 'Filter Slump →', act: "openSquadWithFilter('SLUMP')" };
  }
  if (c.includes('regresi')) {
    return { lbl: 'Filter Regresi →', act: "openSquadWithFilter('DECLINE')" };
  }
  if (c.includes('transfer v9') && t.includes('cedera')) {
    return { lbl: 'Cek di Skuad →', act: "openSquadWithFilter('ALL')" };
  }
  if (c.includes('kontrak')) {
    return { lbl: 'Cek Kontrak →', act: "openSquadWithFilter('ALL')" };
  }
  if (c.includes('lubang') || c.includes('transfer')) {
    return { lbl: 'Buka Belanja →', act: "goToView('t4','t4-bp')" };
  }
  if (c.includes('tiket')) {
    return { lbl: 'Atur Tiket →', act: "goToView('t5','t5-tkt')" };
  }
  if (c.includes('shop')) {
    return { lbl: 'Atur Shop →', act: "goToView('t5','t5-ov')" };
  }
  if (c.includes('member') || c.includes('naming') || c.includes('sponsor')) {
    return { lbl: 'Buka Keuangan →', act: "goToView('t5','t5-ov')" };
  }
  if (c.includes('kartu') || c.includes('set-piece')) {
    return { lbl: 'Buka War Room →', act: 'openWarRoomOfficial(0)' };
  }
  return { lbl: 'Lihat Taktik →', act: "goToView('t3','t3-xi')" };
}

function expandAutoGuardAndScroll() {
  guardExpanded = true;
  renderAutoGuard();
  const el = document.getElementById('t1-autoguard-wrap');
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function setAqFilter(mode) {
  aqFilter = mode;
  renderActionQueue();
}

function findRosterIdByName(name) {
  const n = String(name || '').toLowerCase();
  const hit = (D.roster || []).find(p => String(p.name || '').toLowerCase() === n);
  return hit ? hit.id : '';
}

function renderTab1() {
  const m = D.meta || {};
  const cf = D.cashflow || {};
  const dl = D.deltas || {};
  const titleSt = computeTitleStatus();

  // 1. HERO BANNER LAGA BERIKUTNYA (3 Lapis Bersih + Hitung Mundur + Reset warSimMode)
  const heroEl = document.getElementById('t1-hero');
  const nextFx = (D.upcoming || [])[0];
  if (nextFx) {
    const recForm = nextFx.matchup ? fmtForm(nextFx.matchup.recommended.formation) : fmtForm(m.activeFormation);
    const cdTxt = formatMatchCountdown(nextFx);
    const edgeCls = nextFx.edge >= 2 ? 'b-good' : (nextFx.edge <= -2 ? 'b-crit' : 'b-warn');
    const tkt = nextFx.ticketRec;
    const tktChip = tkt
      ? `<span class="badge ${tkt.diffs && tkt.diffs.length ? 'b-warn' : 'b-good'}">🎟️ ${tkt.diffs && tkt.diffs.length ? 'Ubah Tiket' : 'Tiket ✓'} (${tkt.prices.geral}·${tkt.prices.arquibancada}·${tkt.prices.cadeiras}·${tkt.prices.camarotes})</span>`
      : `<span class="badge b-muted">✈️ Laga Tandang</span>`;
    const yChip = (nextFx.yellowRisks && nextFx.yellowRisks.length)
      ? `<span class="badge b-crit">🟨 ${nextFx.yellowRisks.length} Kuning</span>` : '';

    heroEl.innerHTML = `
      <div class="hero-match-v2">
        <div class="hero-meta-row">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="badge b-good">🔥 LAGA BERIKUTNYA</span>
            <span class="c-muted">${esc(nextFx.compName)}${nextFx.roundName ? ' · ' + esc(nextFx.roundName) : ''}</span>
          </div>
          ${cdTxt ? `<span class="badge b-info mono">📅 ${esc(cdTxt)}</span>` : ''}
        </div>
        <div class="hero-main-row">
          <div class="hero-opp-title">${nextFx.isHome ? '🏠' : '✈️'} vs ${esc(nextFx.oppName)}</div>
          <span class="badge ${edgeCls} mono" style="font-size:11px;padding:3px 8px">Edge ${nextFx.edge >= 0 ? '+' : ''}${nextFx.edge} (Avg ${nextFx.oppAvg})</span>
        </div>
        <div class="hero-chips">
          <span class="badge b-info">⚽ ${esc(recForm)}</span>
          <span class="badge ${nextFx.safeRotate ? 'b-accent' : 'b-warn'}">${nextFx.safeRotate ? '🔄 Aman Rotasi' : '⚡ Full Best XI'}</span>
          ${tktChip}
          ${yChip}
        </div>
        <div class="hero-cta-row">
          <button type="button" class="btn btn-green" style="width:100%" onclick="openWarRoomOfficial(0)">⚔️ Buka Contekan War Room →</button>
        </div>
      </div>`;
  } else {
    heroEl.innerHTML = `
      <div class="hero-match-v2">
        <div class="hero-meta-row">
          <span class="badge b-accent">🏁 JEDA MUSIM / PRAMUSIM</span>
          <span class="c-muted mono">Musim ${m.season || '-'} • ${esc(m.currentDate || '-')}</span>
        </div>
        <div class="hero-opp-title" style="font-size:15px">Jadwal resmi selesai — waktu terbaik belanja Bosman &amp; renew kontrak!</div>
        <div class="hero-cta-row">
          <button type="button" class="btn btn-green" onclick="goToView('t4','t4-exp');applyScoutPreset('BOSMAN')">🔎 Buru Bosman</button>
          <button type="button" class="btn" onclick="openSquadWithFilter('GOLDEN')">🧾 Cek Kontrak</button>
          <button type="button" class="btn" onclick="openWarSimMode();goToView('t2')">🧪 Simulasi Taktik</button>
        </div>
      </div>`;
  }

  // 2. 4 KPI INTERAKTIF (DRILL-DOWN + SUBTEKS RINGKAS 2 BARIS)
  const estNet = cf.estCurrentNet !== undefined ? cf.estCurrentNet : (cf.monthlyNet || 0);
  const estIn = cf.estCurrentIncome !== undefined ? cf.estCurrentIncome : (cf.monthlyIncome || 0);
  const estOut = cf.estCurrentExpense !== undefined ? cf.estCurrentExpense : (cf.monthlyExpense || 0);
  const userPos = titleSt ? `#${titleSt.userPos} Liga` : `Div ${m.division || 1}`;
  const posSub = titleSt
    ? (titleSt.clinched ? '🏆 JUARA LIGA!' : `Sisa ${titleSt.remUser} laga • ${titleSt.lead >= 0 ? '+' + titleSt.lead : titleSt.lead} pts`)
    : `Divisi ${m.division || 1} (${m.country || '-'})`;

  const kpis = [
    {
      l: 'Kas Klub', v: fmtM(m.budget), cls: (m.budget || 0) >= 0 ? 'c-green' : 'c-red',
      s: dl.prevDate ? `${dl.budgetDelta >= 0 ? '+' : ''}${fmtM(dl.budgetDelta)} vs ${dl.prevDate.slice(5)}` : `Skuad ${fmtM(m.squadValue)} • Hutang ${fmtM(m.bankLoan)}`,
      act: "goToView('t5','t5-ov')",
    },
    {
      l: 'Arus Kas / Bln', v: (estNet >= 0 ? '+' : '') + fmtM(estNet), cls: estNet >= 0 ? 'c-green' : 'c-amber',
      s: `Masuk +${fmtM(estIn)} · Keluar -${fmtM(estOut)}`,
      act: "goToView('t5','t5-ov')",
    },
    {
      l: 'Best XI', v: (D.bestXi && D.bestXi.avgScore) || 0, cls: 'c-sky',
      s: `${fmtForm(m.activeFormation)} · Asing ${(D.bestXi && D.bestXi.foreignCount) || 0}/${m.foreignCap || 7}`,
      act: "goToView('t3','t3-xi')",
    },
    {
      l: 'Klasemen', v: userPos, cls: (titleSt && titleSt.userPos === 1) ? 'c-green' : 'c-purple',
      s: posSub,
      act: "goToView('t6','t6-lg')",
    },
  ];
  document.getElementById('t1-kpis').innerHTML = kpis.map(k => `
    <div class="card kpi-card-link" role="button" tabindex="0" onclick="${k.act}">
      <div class="kpi-card-head">
        <span class="kpi-lbl">${k.l}</span>
        <span class="kpi-chevron">›</span>
      </div>
      <div class="kpi-val mono ${k.cls}">${k.v}</div>
      <div class="kpi-sub">${k.s}</div>
    </div>`).join('');

  // 2B. STRIP STATUS KLUB MINI (Board · Fans · Rep · CT · Bursa Transfer)
  let stripEl = document.getElementById('t1-club-strip');
  if (!stripEl) {
    const kpiGrid = document.getElementById('t1-kpis');
    if (kpiGrid && kpiGrid.parentNode) {
      stripEl = document.createElement('div');
      stripEl.id = 't1-club-strip';
      kpiGrid.parentNode.insertBefore(stripEl, kpiGrid.nextSibling);
    }
  }
  if (stripEl) {
    const tw = m.transferWindow;
    const twOpen = (tw === true || tw === 1 || String(tw || '').toLowerCase() === 'open');
    const twBadge = tw === undefined || tw === null
      ? ''
      : `<span class="badge ${twOpen ? 'b-good' : 'b-muted'}">${twOpen ? '🟢 Bursa BUKA' : '🔒 Bursa TUTUP'}</span>`;
    stripEl.innerHTML = `
      <div class="club-status-strip">
        <div class="club-status-items mono">
          <span>Board <b>${m.boardConf ?? '-'}%</b></span>·
          <span>Fans <b>${m.fanConf ?? '-'}%</b></span>·
          <span>Rep <b>${m.reputation ?? '-'}</b></span>·
          <span>CT <b>Lv ${m.ctLevel ?? 1}</b></span>·
          <span>Unhappy <b class="${(m.unhappyCount || 0) >= 4 ? 'c-red' : 'c-green'}">${m.unhappyCount || 0}</b></span>
        </div>
        ${twBadge}
      </div>`;
  }

  // 3. AUTO-GUARD RINGKAS (Benar-benar 1 baris bila 6/6 aman!)
  renderAutoGuard();

  // 4. ACTION QUEUE TERPADU (Urutan Mobile Rapi + Filter + Stable ID + Smart Deep-Link)
  renderActionQueue();

  // 5. KLASEMEN RINGKAS (Konteks Rival Sekitar + Anti-Scroll Horizontal 360px)
  const mt = document.getElementById('t1-mini-title');
  if (mt) {
    mt.innerHTML = titleSt
      ? `<div class="badge ${titleSt.clinched ? 'b-good' : 'b-info'}" style="white-space:normal;line-height:1.4;padding:5px 8px">${esc(titleSt.text)}</div>`
      : '';
  }
  const allSt = D.standings || [];
  const userRow = allSt.find(s => s.isUser);
  let miniRowsHtml = '';
  if (!allSt.length) {
    miniRowsHtml = '<tr><td colspan="5" class="c-muted">Klasemen tidak tersedia.</td></tr>';
  } else {
    const renderStRow = (s) => `<tr class="${s.isUser ? 'hl-user' : ''}">
      <td class="mono">${s.pos}</td>
      <td class="mini-club-cell" title="${esc(s.name)}">${esc(s.name)}</td>
      <td class="mono">${s.p}</td>
      <td class="mono ${s.gd >= 0 ? 'c-green' : 'c-red'}">${s.gd >= 0 ? '+' : ''}${s.gd}</td>
      <td class="mono"><b>${s.pts}</b></td>
    </tr>`;

    if (!userRow || userRow.pos <= 5) {
      miniRowsHtml = allSt.slice(0, 5).map(renderStRow).join('');
    } else {
      const top3 = allSt.slice(0, 3);
      const around = allSt.filter(s => s.pos >= userRow.pos - 1 && s.pos <= userRow.pos + 1 && s.pos > 3);
      miniRowsHtml = top3.map(renderStRow).join('')
        + `<tr class="mini-sep-row"><td colspan="5">⋯</td></tr>`
        + around.map(renderStRow).join('');
    }
  }
  document.getElementById('t1-mini-standings').innerHTML =
    `<thead><tr><th>#</th><th>Klub</th><th>Main</th><th>SG</th><th>Poin</th></tr></thead><tbody>${miniRowsHtml}</tbody>`;

  // 6. TARGET PRESIDEN (Dengan Badge Status ON TRACK) & DELTA TRACKER (Tanpa F+0 + Klik Drawer!)
  const pg = (D.presGoals && typeof D.presGoals === 'object' && !Array.isArray(D.presGoals)) ? D.presGoals : null;
  let pgHtml = '';
  if (pg) {
    const list = [];
    if (pg.league) {
      const tgt = Number(pg.league.target) || 4;
      let statusB = '';
      if (userRow) {
        const onTrack = userRow.pos <= tgt;
        const doneSeason = titleSt && titleSt.remUser === 0;
        statusB = onTrack
          ? ` <span class="badge b-good">${doneSeason ? '🏆 TERCAPAI' : '✓ ON TRACK'} (#${userRow.pos})</span>`
          : ` <span class="badge b-warn">⚠ KEJAR (#${userRow.pos})</span>`;
      }
      list.push(`• <b>${esc(pg.league.name || 'Liga')}:</b> ${formatPresTarget('league', tgt)}${statusB}`);
    }
    if (pg.cup) list.push(`• <b>${esc(pg.cup.name || 'Piala')}:</b> ${formatPresTarget('cup', pg.cup.target)}`);
    if (pg.cont) list.push(`• <b>${esc(pg.cont.name || 'Kontinental')}:</b> ${formatPresTarget('cont', pg.cont.target)}`);
    if (pg.last && pg.last.bonus) list.push(`<span class="c-green">🏆 Bonus Musim Lalu: <b class="mono">+${fmtM(pg.last.bonus)}</b></span>`);
    pgHtml = list.join('<br/>');
  }
  document.getElementById('t1-pres-goals').innerHTML = pgHtml || '<span class="c-muted">Tidak ada target presiden aktif.</span>';

  const dEl = document.getElementById('t1-deltas');
  if (!dl.prevDate) {
    dEl.innerHTML = `<div class="c-muted" style="border-top:1px solid var(--border);padding-top:8px">Snapshot awal tersimpan (<b>${esc(m.currentDate || '-')}</b>). Delta otomatis tampil di save berikutnya.</div>`;
  } else {
    const chg = (dl.playerChanges || []).slice(0, 8).map(c => {
      const fd = Number(c.forceDelta) || 0;
      const mvd = Number(c.mvDelta) || 0;
      const parts = [];
      if (fd !== 0) parts.push(`F${fd > 0 ? '+' : ''}${fd}`);
      if (Math.abs(mvd) >= 50000) parts.push(`MV ${mvd > 0 ? '+' : ''}${fmtM(mvd)}`);
      const metricTxt = parts.join(' · ') || 'Update';
      const isUp = fd > 0 || (fd === 0 && mvd > 0);
      const isDown = fd < 0 || (fd === 0 && mvd < 0);
      const bCls = isUp ? 'b-good' : (isDown ? 'b-crit' : 'b-info');
      const pid = c.id || findRosterIdByName(c.name);
      const clickAttr = pid ? `onclick="openPlayerDrawer('roster','${escJs(pid)}')"` : '';
      return `<span class="badge ${bCls} delta-chip" ${clickAttr} title="Klik buka profil ${esc(c.name)}">${esc(c.name)} <b>${metricTxt}</b></span>`;
    }).join(' ');

    dEl.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:8px">
      <div class="mb-8"><b>Delta vs ${esc(dl.prevDate)}:</b> Kas <b class="mono">${dl.budgetDelta >= 0 ? '+' : ''}${fmtM(dl.budgetDelta)}</b> • Gaji <b class="mono">${dl.payrollDelta >= 0 ? '+' : ''}${fmtM(dl.payrollDelta)}</b> • Member <b class="mono">${dl.membersDelta >= 0 ? '+' : ''}${dl.membersDelta}</b></div>
      <div class="pill-row" style="margin:0">${chg || '<span class="c-muted">Belum ada perubahan Force / MV signifikan.</span>'}</div>
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

  const hasIssue = (ag.issueCount || 0) > 0;
  const open = hasIssue || guardExpanded;
  const totalItems = (ag.items || []).length || 6;
  const okItems = totalItems - (ag.issueCount || 0);
  const stBadge = s => s === 'crit' ? 'b-crit' : (s === 'warn' ? 'b-warn' : 'b-good');

  const slumpHtml = (D.fineSlumpPlayers && D.fineSlumpPlayers.length)
    ? `<div class="alert-item CRITICAL mt-12" style="margin-bottom:0">
         <span class="badge b-crit">RADAR SLUMP</span>
         <div style="font-size:11px"><b>Penalti denda aktif:</b> ${D.fineSlumpPlayers.map(s => {
           const pid = s.id || findRosterIdByName(s.name);
           const nm = pid ? `<a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(pid)}')"><b>${esc(s.name)}</b></a>` : `<b>${esc(s.name)}</b>`;
           return `${nm} (-${s.slumpPct}%, ${s.days}d)`;
         }).join(' · ')}</div>
       </div>`
    : '';

  const detailsGrid = open ? `
    <div class="grid g3 mt-12" style="gap:8px">
      ${(ag.items || []).map(it => `
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
      <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">
        <span class="badge ${hasIssue ? 'b-crit' : 'b-good'}">${hasIssue ? `⚠️ ${ag.issueCount} SETELAN PERLU DIUBAH` : `🛡️ AUTO-GUARD ${okItems}/${totalItems} AMAN`}</span>
        ${hasIssue ? '<span class="c-muted" style="font-size:11px">Cek kotak merah/kuning di bawah</span>' : ''}
      </div>
      <button type="button" class="btn btn-sm" style="flex-shrink:0" onclick="toggleGuardExpand()">${open ? 'Ringkas ▲' : 'Rincian ▼'}</button>
    </div>
    ${detailsGrid}`;
}

function renderActionQueue() {
  const chk = loadChk();
  const raw = D.alerts || [];
  const allItems = raw.map(a => {
    const id = stableAlertId(a);
    const spec = getAlertActionSpec(a);
    return { ...a, id, done: !!chk[id], btnLbl: spec.lbl, btnAct: spec.act };
  });

  const totalN = allItems.length;
  const doneN = allItems.filter(x => x.done).length;
  const remCnt = totalN - doneN;
  const critN = allItems.filter(x => x.sev === 'CRITICAL' || x.sev === 'HIGH').length;

  const cntBadge = document.getElementById('t1-alert-cnt');
  if (cntBadge) {
    cntBadge.textContent = remCnt ? `${remCnt} Aksi Tersisa` : '✓ Semua Beres';
    cntBadge.className = 'badge ' + (remCnt ? (allItems.some(x => !x.done && x.sev === 'CRITICAL') ? 'b-crit' : 'b-warn') : 'b-good');
  }

  const el = document.getElementById('t1-action-queue');
  if (!totalN) {
    el.innerHTML = '<div class="c-green" style="font-size:12px">🎉 Tidak ada alarm atau aksi mendesak hari ini! Langsung lanjut ke War Room &amp; bertanding.</div>';
    return;
  }

  const visible = (aqFilter === 'CRIT')
    ? allItems.filter(x => x.sev === 'CRITICAL' || x.sev === 'HIGH')
    : allItems;
  visible.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

  const toolbarHtml = totalN >= 3 ? `
    <div class="aq-toolbar">
      <div class="aq-filter-pills">
        <button type="button" class="btn btn-sm ${aqFilter === 'ALL' ? 'btn-green' : ''}" onclick="setAqFilter('ALL')">Semua (${totalN})</button>
        <button type="button" class="btn btn-sm ${aqFilter === 'CRIT' ? 'btn-amber' : ''}" onclick="setAqFilter('CRIT')">Penting (${critN})</button>
      </div>
      <span class="mono c-muted" style="font-size:11px">${doneN}/${totalN} selesai</span>
    </div>` : '';

  const listHtml = visible.length ? visible.map(it => {
    const sevCls = it.sev === 'CRITICAL' ? 'b-crit' : (it.sev === 'HIGH' ? 'b-warn' : 'b-info');
    return `<div class="aq-item-v2 ${it.sev} ${it.done ? 'done' : ''}">
      <input type="checkbox" style="margin-top:2px;cursor:pointer;accent-color:#10b981;width:18px;height:18px;flex-shrink:0" ${it.done ? 'checked' : ''} onchange="toggleChk('${escJs(it.id)}')" />
      <div class="aq-body">
        <div class="aq-head">
          <span class="badge ${sevCls}">${esc(it.cat)}</span>
          <span class="aq-title">${esc(it.title)}</span>
        </div>
        <div class="aq-desc">${esc(it.action)}</div>
        <div class="aq-footer">
          <button type="button" class="btn btn-sm" onclick="${it.btnAct}">${esc(it.btnLbl)}</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="c-green" style="font-size:12px">Tidak ada alarm kategori Penting (CRITICAL/HIGH).</div>';

  el.innerHTML = toolbarHtml + listHtml;
}

function toggleChk(id) {
  const c = loadChk();
  c[id] = !c[id];
  saveChk(c);
  renderActionQueue();
}
function resetChecklist() {
  saveChk({});
  renderActionQueue();
  showToast('Centang Action Queue direset');
}
