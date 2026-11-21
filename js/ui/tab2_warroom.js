// ==================== RENDER TAB 2: WAR ROOM FOKUS + SIMULASI LAWAN (v8.1.2) ====================
let warSimMode = false;
let warSimOppId = '';
let warSimIsHome = true;

function setWarCond(kind, val) {
  if (kind === 'ref') warRef = val;
  if (kind === 'weather') warWeather = val;
  ['strict', 'normal', 'lenient'].forEach(r => {
    const el = document.getElementById('wr-ref-' + r);
    if (el) el.className = (warRef === r) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  ['clear', 'rain', 'heat'].forEach(w => {
    const el = document.getElementById('wr-w-' + w);
    if (el) el.className = (warWeather === w) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  renderTab2();
}

function selectWarMatch(idx) {
  warSimMode = false;
  activeMatchIdx = idx;
  renderTab2();
}

function openWarSimMode(oppId) {
  warSimMode = true;
  if (oppId) warSimOppId = oppId;
  renderTab2();
}

function setWarSimOpp(oppId) {
  warSimOppId = oppId;
  warSimMode = true;
  renderTab2();
}

function setWarSimHome(isHm) {
  warSimIsHome = Boolean(isHm);
  warSimMode = true;
  renderTab2();
}

function openFormInTab3(formKey, useRot) {
  const sel = document.getElementById('t3-form-select');
  if (sel) sel.value = formKey;
  setXiMode(useRot ? 'rot' : 'best');
  goToView('t3', 't3-xi');
  showToast(`Menampilkan ${useRot ? 'Rotation XI' : 'Best XI'} formasi ${fmtForm(formKey)}`);
}

function fmtDelta(v) {
  const n = Number(v) || 0;
  const cls = n >= 1 ? 'c-green' : (n <= -1 ? 'c-red' : 'c-amber');
  return `<b class="mono ${cls}">${n >= 0 ? '+' : ''}${n.toFixed(1)}</b>`;
}

function renderH2HBars(userPow, oppPow) {
  const rows = [
    { lbl: 'GK',  u: Number(userPow.GK || 0),  o: Number(oppPow.GK || 0) },
    { lbl: 'DEF', u: Number(userPow.DEF || 0), o: Number(oppPow.DEF || 0) },
    { lbl: 'MID', u: Number(userPow.MID || 0), o: Number(oppPow.MID || 0) },
    { lbl: 'ATK', u: Number(userPow.ATK || 0), o: Number(oppPow.ATK || 0) },
  ];
  return rows.map(r => {
    const diff = +(r.u - r.o).toFixed(1);
    const mag = Math.min(48, Math.abs(diff) * 2.8);
    const barStyle = diff >= 0
      ? `left:50%;width:${mag.toFixed(1)}%;background:var(--green)`
      : `right:50%;width:${mag.toFixed(1)}%;background:var(--red)`;
    const dCls = diff >= 1 ? 'c-green' : (diff <= -1 ? 'c-red' : 'c-amber');
    return `<div class="h2h-row mono">
      <b>${r.lbl}</b>
      <span class="c-sky" style="text-align:right"><b>${r.u.toFixed(1)}</b></span>
      <div class="h2h-track"><div class="h2h-mid"></div><div class="h2h-fill" style="${barStyle}"></div></div>
      <span class="${dCls}" style="text-align:center"><b>${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</b></span>
      <span class="c-muted">${r.o.toFixed(1)}</span>
    </div>`;
  }).join('');
}

/**
 * Bangun daftar lawan simulasi dari D.simOpponents (atau fallback dari standings)
 * agar War Room TIDAK PERNAH KOSONG bahkan saat jeda musim!
 */
function getSimOpponentsList() {
  if (Array.isArray(D.simOpponents) && D.simOpponents.length) return D.simOpponents;
  const fallbackAvg = Math.max(30, Number((D.bestXi && D.bestXi.avgScore) || 40) - 2);
  const st = (D.standings || []).filter(s => !s.isUser).slice(0, 12);
  if (st.length) {
    return st.map((s, i) => {
      const estAvg = +(Math.max(26, fallbackAvg - i * 0.8)).toFixed(1);
      return {
        id: s.teamId || ('sim_' + i),
        name: s.name || ('Lawan #' + (i + 1)),
        rep: Math.max(35, (D.meta.reputation || 55) - i * 2),
        formation: '4-3-3',
        avgScore: estAvg,
        sectors: { GK: estAvg, DEF: estAvg, MID: estAvg, ATK: estAvg },
        stars: [],
        injured: [],
        cabCount: 2,
      };
    });
  }
  return [{
    id: 'sim_benchmark',
    name: 'Rival Setara (Simulasi)',
    rep: D.meta.reputation || 55,
    formation: '4-3-3',
    avgScore: fallbackAvg,
    sectors: { GK: fallbackAvg, DEF: fallbackAvg, MID: fallbackAvg, ATK: fallbackAvg },
    stars: [],
    injured: [],
    cabCount: 2,
  }];
}

/**
 * Hitung paket Matchup War Room penuh secara real-time di browser untuk lawan simulasi!
 */
function buildSimulatedFixture(opp, isHome) {
  const Eng = window.LFEngine;
  const userRoster = D.roster || [];
  const fkActive = (D.meta && D.meta.activeFormation) || '4-3-3';
  const fCap = (D.meta && D.meta.foreignCap) || 7;
  const uCountry = (D.meta && D.meta.country) || '';
  const repLv = (D.meta && D.meta.repLevel) || 3;

  const oppXi = {
    formation: opp.formation || '4-4-2',
    avgScore: Number(opp.avgScore || 38),
    sectors: opp.sectors || { GK: 38, DEF: 38, MID: 38, ATK: 38 },
    xi: (opp.stars || []).map(s => ({ player: { pos: s.pos || 'MC', s1: s.s1 || '', s2: s.s2 || '', force: s.force || 38 } })),
  };

  const uAvg = Number((D.bestXi && D.bestXi.avgScore) || 40);
  const edge = +(uAvg - oppXi.avgScore).toFixed(1);
  const isBig = Number(opp.rep || 50) >= Number(D.meta.reputation || 50) + 5;
  const safeRotate = edge >= 4.0 && !isBig;

  let matchup = null;
  if (Eng && Eng.tactics && typeof Eng.tactics.recommendMatchupForOpponent === 'function') {
    matchup = Eng.tactics.recommendMatchupForOpponent(
      userRoster, oppXi, isHome, false, isBig,
      fCap, uCountry, fkActive, null, safeRotate, repLv
    );
  }

  let ticketRec = null;
  if (isHome && Eng && Eng.economy && D.stadium && D.stadium.sections) {
    const bp = D.stadium.basePrices || { geral: 10, arquibancada: 15, cadeiras: 25, camarotes: 80 };
    const curM = D.stadium.curMul || { geral: 1, arquibancada: 1, cadeiras: 1, camarotes: 1 };
    const curP = {
      geral: Math.max(1, Math.round(bp.geral * curM.geral)),
      arquibancada: Math.max(1, Math.round(bp.arquibancada * curM.arquibancada)),
      cadeiras: Math.max(1, Math.round(bp.cadeiras * curM.cadeiras)),
      camarotes: Math.max(1, Math.round(bp.camarotes * curM.camarotes)),
    };
    const repDiff = Number(opp.rep || 50) - Number(D.meta.reputation || 50);
    const opt = Eng.economy.optimizeTicketPricesV9(D.stadium.sections, D.meta.fanConf || 80, D.meta.division || 1, false, isBig, repDiff);
    const curSim = Eng.economy.simulateStadiumV9(D.stadium.sections, curM, D.meta.fanConf || 80, D.meta.division || 1, false, isBig, repDiff);
    const diffs = [];
    const secNames = { geral: 'General', arquibancada: 'Stands', cadeiras: 'Seats', camarotes: 'Boxes' };
    ['geral', 'arquibancada', 'cadeiras', 'camarotes'].forEach(s => {
      if (Math.abs(opt.prices[s] - curP[s]) >= 1) diffs.push(`${secNames[s]} ${curP[s]}→${opt.prices[s]}`);
    });
    ticketRec = {
      occasion: 'simulasi',
      isBig,
      isKnockout: false,
      prices: opt.prices,
      muls: opt.muls,
      curPrices: curP,
      diffs,
      revGain: Math.round(opt.sim.totalRev - curSim.totalRev),
      fillPct: opt.sim.fillPct,
      estRev: opt.sim.totalRev,
    };
  }

  const benchPool = (matchup && matchup.recommended && matchup.recommended.bench) || (D.bestXi && D.bestXi.bench) || [];
  const subPlan = benchPool.filter(p => p.pos !== 'G').slice(0, 3).map(p => `${p.name} (${fmtPos(p.pos)} ${p.force}) — Segar (${p.energy ?? 100}%)`);

  return {
    isSim: true,
    isHome,
    compName: 'Simulasi Matchup',
    roundName: 'Uji Formasi & Taktik',
    oppName: opp.name,
    oppRep: Math.round(opp.rep || 50),
    oppFormation: oppXi.formation,
    oppAvg: oppXi.avgScore,
    edge,
    aiStyle: (matchup && matchup.aiInfo && matchup.aiInfo.aiStyle) || 'Balanced',
    aiFocus: (matchup && matchup.aiInfo && matchup.aiInfo.aiFocus) || 'Mixed',
    matchup,
    safeRotate,
    ticketRec,
    oppStars: opp.stars || [],
    oppInjured: opp.injured || [],
    yellowRisks: [],
    subPlan: subPlan.length ? subPlan : ['Siapkan 3 pergantian menit 60–70 sesuai stamina'],
  };
}

function renderWarRoomMatchCard(fx, isFirstOfficial) {
  const m = fx.matchup;
  const rec = m ? m.recommended : null;
  const refObj = m ? (m.refereePlan[warRef] || m.refereePlan.normal) : null;
  const wObj = m ? (m.weatherPlan[warWeather] || m.weatherPlan.clear) : null;
  const aiFocus = fx.aiFocus || (m && m.aiInfo ? m.aiInfo.aiFocus : 'Mixed');

  const h2hBlock = (m && rec) ? `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;margin-bottom:10px">
      <div class="flex-between mb-8">
        <span class="kpi-lbl">⚔️ Duel Sektor Visual (${esc(D.meta.teamName)} ${esc(fmtForm(rec.formation))} vs ${esc(fx.oppName)} ${esc(fmtForm(fx.oppFormation))})</span>
        <span class="mono c-muted" style="font-size:11px">Kita <b class="c-sky">${rec.avgScore}</b> vs Lawan <b>${fx.oppAvg}</b></span>
      </div>
      ${renderH2HBars(rec.enginePow, m.oppPow)}
    </div>` : '';

  const formBlock = (m && rec) ? `
    <div style="background:var(--bg2);border:1px solid ${m.keepActive ? 'rgba(16,185,129,.45)' : 'rgba(56,189,248,.55)'};border-radius:11px;padding:11px">
      <div class="flex-between mb-8">
        <div>
          <span class="kpi-lbl">1. Formasi Rekomendasi</span>
          <div style="margin-top:3px;display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <span style="font-size:20px;font-weight:900" class="mono c-green">${esc(fmtForm(rec.formation))}</span>
            <span class="badge ${m.keepActive ? 'b-good' : 'b-info'}">${m.keepActive ? '✓ PERTAHANKAN' : `🔄 GANTI (+${m.scoreGain} H2H)`}</span>
            <span class="badge b-muted mono">A${fmtMod(rec.enginePow.atkMod)}/D${fmtMod(rec.enginePow.defMod)}</span>
            ${rec.falseNine ? '<span class="badge b-accent">⚡ FALSE NINE</span>' : ''}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-green" onclick="openFormInTab3('${escJs(rec.formation)}', ${fx.safeRotate ? 'true' : 'false'})">⚽ Lihat XI</button>
      </div>
      <div style="font-size:11px;margin-bottom:8px">${(m.reasons || []).map(r => `<div>• ${esc(r)}</div>`).join('')}</div>
      <div class="tbl-wrap"><table><thead><tr><th>Top 3 Formasi</th><th>Mod A/D</th><th>MID</th><th>ATK</th><th>DEF</th><th>FB Salah Kaki</th><th>Skor</th></tr></thead><tbody>
        ${(m.top3 || []).map((tf, ti) => `<tr style="cursor:pointer" class="${tf.formation === rec.formation ? 'hl-user' : ''}" onclick="openFormInTab3('${escJs(tf.formation)}', ${fx.safeRotate ? 'true' : 'false'})">
          <td><b>#${ti + 1} ${esc(fmtForm(tf.formation))}</b></td>
          <td class="mono">${fmtMod(tf.atkMod)}/${fmtMod(tf.defMod)}</td>
          <td>${fmtDelta(tf.dMid)}</td><td>${fmtDelta(tf.dAtk)}</td><td>${fmtDelta(tf.dDef)}</td>
          <td class="mono ${tf.wrongFootCount ? 'c-amber' : 'c-green'}">${tf.wrongFootCount}</td>
          <td class="mono c-green"><b>${tf.matchupScore >= 0 ? '+' : ''}${tf.matchupScore}</b></td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>` : '';

  const tacticBlock = (m && refObj && wObj) ? `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">2. Contekan Taktik, Wasit &amp; Cuaca</div>
      <div class="mb-8" style="background:var(--card);padding:6px 8px;border-radius:7px">
        <b>🤖 Prediksi AI Lawan:</b> <span class="badge b-warn">${esc(fx.aiStyle)}</span>
        <span class="badge b-accent">Fokus: ${esc(aiFocus)}</span>
      </div>
      <div class="mb-8"><b>Gaya Main:</b> <span class="badge b-good">${esc(m.playStyle)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(m.playReason)}</div>
      </div>
      <div class="mb-8"><b>Fokus Serang:</b> <span class="badge b-info">${esc(m.attackFocus)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(m.focusReason)}</div>
      </div>
      <div class="mb-8"><b>Marking (Wasit ${warRef.toUpperCase()}):</b> <span class="badge ${refObj.badge}">${esc(refObj.marking)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(refObj.note)}</div>
      </div>
      <div><b>Cuaca (${esc(wObj.label)}):</b> <span class="c-muted">${esc(wObj.note)}</span></div>
    </div>` : '';

  const tkt = fx.ticketRec;
  const tktCopyStr = tkt ? `${tkt.prices.geral} · ${tkt.prices.arquibancada} · ${tkt.prices.cadeiras} · ${tkt.prices.camarotes}` : '';
  const ticketBlock = tkt ? `
    <div style="background:var(--bg2);border:1px solid rgba(16,185,129,.45);border-radius:11px;padding:11px;font-size:11px">
      <div class="flex-between mb-8">
        <span class="kpi-lbl">3. Harga Tiket Kandang (${String(tkt.occasion || 'normal').toUpperCase()}${tkt.isBig ? ' • BIG MATCH' : ''}${tkt.isKnockout ? ' • GUGUR' : ''})</span>
        <div style="display:flex;gap:5px;align-items:center">
          <span class="badge ${tkt.diffs && tkt.diffs.length ? 'b-warn' : 'b-good'}">${tkt.diffs && tkt.diffs.length ? 'UBAH HARGA!' : '✓ SUDAH PAS'}</span>
          <button type="button" class="btn btn-sm" onclick="copyText('${tktCopyStr}','Harga Tiket')">📋 Salin</button>
        </div>
      </div>
      <div class="grid g4 ticket-4grid" style="gap:6px;margin-bottom:8px;text-align:center">
        <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">General</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.geral}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.geral}</div></div>
        <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Stands</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.arquibancada}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.arquibancada}</div></div>
        <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Seats</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.cadeiras}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.cadeiras}</div></div>
        <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Boxes (VIP)</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.camarotes}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.camarotes}</div></div>
      </div>
      <div>Est. Fill: <b class="mono ${tkt.fillPct >= 70 ? 'c-green' : 'c-red'}">${tkt.fillPct}%</b> (bonus +2% MID ≥70%) • Est. Gate: <b class="mono c-green">${fmtM(tkt.estRev)}</b>
      ${tkt.diffs && tkt.diffs.length ? `<div class="c-amber" style="margin-top:3px"><b>Ubah di layar Tickets:</b> ${tkt.diffs.join(' · ')} ${tkt.revGain > 0 ? `(+${fmtM(tkt.revGain)}/laga)` : ''}</div>` : ''}</div>
    </div>` : `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">3. Tiket Pertandingan</div>
      <div class="c-muted">✈️ Laga Tandang / Netral — tidak mengatur harga tiket kandang. Fokus curi poin &amp; jaga stamina!</div>
    </div>`;

  const sp = (rec && rec.setPieces) || (D.bestXi && D.bestXi.setPieces) || { penalty: '-', corner: '-', freeKick: '-', captain: '-' };
  const yWarn = (fx.yellowRisks && fx.yellowRisks.length)
    ? `<div class="mb-8"><span class="badge b-crit">🟨 RAWAN SKORSING (2 Kuning): ${fx.yellowRisks.map(y => esc(y.name)).join(', ')}</span></div>` : '';
  const spAndSubBlock = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">4. Set Pieces, 3 Sub (Menit ${warWeather === 'heat' ? '55–62' : '60–70'}) &amp; Intel Lawan</div>
      ${yWarn}
      <div class="grid g2" style="gap:6px;margin-bottom:8px">
        <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Penalti:</span> <b class="c-green">${esc(sp.penalty)}</b></div>
        <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Corner:</span> <b class="c-sky">${esc(sp.corner)}</b></div>
        <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Free Kick:</span> <b class="c-purple">${esc(sp.freeKick)}</b></div>
        <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Kapten:</span> <b class="c-amber">${esc(sp.captain)}</b></div>
      </div>
      <div class="mb-8"><b>🪑 3 Pergantian Prioritas:</b><div class="c-muted">${(fx.subPlan || []).map(s => '• ' + esc(s)).join('<br/>')}</div></div>
      <div><b>⚠️ Bintang Lawan:</b> <span class="c-muted">${(fx.oppStars || []).map(s => `${esc(s.name)} (${fmtPos(s.pos)} ${s.force})`).join(', ') || '-'}</span></div>
      ${(fx.oppInjured && fx.oppInjured.length) ? `<div class="c-amber"><b>🏥 Lawan Cedera:</b> ${fx.oppInjured.map(s => `${esc(s.name)} (${s.days}d)`).join(', ')}</div>` : ''}
    </div>`;

  return `
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div class="flex-between mb-8">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="badge ${fx.isSim ? 'b-accent' : (isFirstOfficial ? 'b-good' : 'b-info')}">${fx.isSim ? '🧪 SIMULASI' : (fx.isHome ? '🏠 KANDANG' : '✈️ TANDANG')}</span>
          <span class="badge b-muted">${esc(fx.compName)}${fx.roundName ? ' • ' + esc(fx.roundName) : ''}</span>
          <strong style="font-size:16px">vs ${esc(fx.oppName)}</strong>
          <span class="mono c-muted" style="font-size:11px">(Rep ${fx.oppRep} • ${fmtForm(fx.oppFormation)})</span>
        </div>
        <span class="badge ${fx.safeRotate ? 'b-accent' : 'b-warn'}">${fx.safeRotate ? '🔄 AMAN ROTASI XI' : '⚡ FULL BEST XI'}</span>
      </div>
      ${h2hBlock}
      <div class="grid g2" style="gap:10px">
        ${formBlock}
        ${tacticBlock}
        ${ticketBlock}
        ${spAndSubBlock}
      </div>
    </div>`;
}

function renderTab2() {
  const selEl = document.getElementById('t2-selector');
  const mainEl = document.getElementById('t2-active-match');
  if (!selEl || !mainEl) return;

  const list = Array.isArray(D.upcoming) ? D.upcoming : [];
  const simOpps = getSimOpponentsList();

  // Jika jadwal resmi habis (jeda musim), otomatis masuk Mode Simulasi Lawan agar War Room TIDAK PERNAH KOSONG!
  if (!list.length) {
    warSimMode = true;
  }
  if (!warSimOppId || !simOpps.some(o => o.id === warSimOppId)) {
    warSimOppId = simOpps[0].id;
  }

  // 1. Bar Pemilih Laga Resmi + Tombol Mode Simulasi Lawan Bebas
  const officialPills = list.map((fx, idx) => {
    const isAct = (!warSimMode && idx === activeMatchIdx);
    const tktNeed = fx.ticketRec && fx.ticketRec.diffs && fx.ticketRec.diffs.length;
    const edgeCls = fx.edge >= 2 ? 'c-green' : (fx.edge <= -2 ? 'c-red' : 'c-amber');
    return `<button type="button" class="match-pill ${isAct ? 'active' : ''}" onclick="selectWarMatch(${idx})">
      <div class="flex-between" style="font-size:10px;margin-bottom:3px">
        <span class="badge ${idx === 0 ? 'b-good' : 'b-muted'}">${idx === 0 ? 'BERIKUTNYA' : 'LAGA #' + (idx + 1)} • ${fx.isHome ? '🏠' : '✈️'}</span>
        <span class="mono ${edgeCls}"><b>${fx.edge >= 0 ? '+' : ''}${fx.edge}</b></span>
      </div>
      <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ${esc(fx.oppName)}</div>
      <div class="c-muted" style="font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${esc(fx.compName)}${fx.roundName ? ' · ' + esc(fx.roundName) : ''}
        ${tktNeed ? ' <b class="c-amber">• 🎟️</b>' : ''}
        ${fx.yellowRisks && fx.yellowRisks.length ? ' <b class="c-red">• 🟨</b>' : ''}
      </div>
    </button>`;
  }).join('');

  const simPill = `<button type="button" class="match-pill ${warSimMode ? 'active' : ''}" onclick="openWarSimMode()">
    <div class="flex-between" style="font-size:10px;margin-bottom:3px">
      <span class="badge b-accent">🧪 SIMULASI</span>
      <span class="mono c-sky">${simOpps.length} klub</span>
    </div>
    <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Uji Lawan Bebas</div>
    <div class="c-muted" style="font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
      ${list.length ? 'Tes formasi vs rival liga' : 'Jeda musim — aktif otomatis'}
    </div>
  </button>`;

  selEl.innerHTML = officialPills + simPill;

  // 2. Render Konten Utama War Room
  let activeFx = null;
  let simControlsHtml = '';

  if (warSimMode) {
    const chosenOpp = simOpps.find(o => o.id === warSimOppId) || simOpps[0];
    activeFx = buildSimulatedFixture(chosenOpp, warSimIsHome);
    simControlsHtml = `
      <div class="alert-item" style="margin-bottom:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div style="font-size:12px">
          <span class="badge b-accent">MODE SIMULASI LAWAN</span>
          ${!list.length ? '<span class="c-muted" style="margin-left:6px">Jadwal resmi musim ini sudah selesai — pakai simulator untuk persiapan musim depan!</span>' : '<span class="c-muted" style="margin-left:6px">Pilih klub rival untuk menguji 15 formasi &amp; duel H2H secara real-time.</span>'}
        </div>
        <div class="pill-row" style="margin:0">
          <select id="wr-sim-opp" onchange="setWarSimOpp(this.value)">
            ${simOpps.map(o => `<option value="${esc(o.id)}" ${o.id === chosenOpp.id ? 'selected' : ''}>${esc(o.name)} (Avg ${o.avgScore} • ${fmtForm(o.formation)})</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm ${warSimIsHome ? 'btn-green' : ''}" onclick="setWarSimHome(true)">🏠 Kandang</button>
          <button type="button" class="btn btn-sm ${!warSimIsHome ? 'btn-green' : ''}" onclick="setWarSimHome(false)">✈️ Tandang</button>
        </div>
      </div>`;
  } else {
    if (activeMatchIdx >= list.length) activeMatchIdx = 0;
    activeFx = list[activeMatchIdx];
  }

  mainEl.innerHTML = simControlsHtml + renderWarRoomMatchCard(activeFx, !warSimMode && activeMatchIdx === 0);

  // 3. Render Halftime Talk & Live Coaching sekali di laci bawah
  const htEl = document.getElementById('t2-halftime');
  const htPlan = (activeFx && activeFx.matchup && activeFx.matchup.halftimePlan) || {
    win: "Unggul di HT: Pilih 'Focus / Don't Get Complacent' (jaga konsentrasi).",
    draw: "Seri di HT: Pilih 'Encourage / Demand More' (dorong intensitas babak 2).",
    lose: "Tertinggal di HT: Pilih 'Fire Up / Passion' + masukkan supersub PAC/FIN menit 58.",
  };
  if (htEl) {
    htEl.innerHTML = `
      <div class="alert-item">
        <span class="badge b-accent">HALFTIME</span>
        <div>• ${esc(htPlan.win)}<br/>• ${esc(htPlan.draw)}<br/>• ${esc(htPlan.lose)}</div>
      </div>`;
  }

  const lc = D.liveCoach || { shouts: [], orders: [] };
  const shEl = document.getElementById('t2-shouts');
  if (shEl) {
    shEl.innerHTML = (lc.shouts || []).map(s => `
      <div class="alert-item">
        <span class="badge b-good">SHOUT</span>
        <div><b>${esc(s.name)}</b> <span class="c-muted">(${esc(s.when)})</span><div class="c-muted" style="font-size:11px">${esc(s.effect)}</div></div>
      </div>`).join('');
  }
  const orEl = document.getElementById('t2-orders');
  if (orEl) {
    orEl.innerHTML = (lc.orders || []).map(o => `
      <div class="alert-item">
        <span class="badge b-info">ORDER</span>
        <div><b>${esc(o.cond)}</b> → <span class="c-green">${esc(o.order)}</span><div class="c-muted" style="font-size:11px">${esc(o.note)}</div></div>
      </div>`).join('');
  }
}
