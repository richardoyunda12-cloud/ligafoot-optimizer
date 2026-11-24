// ==================== RENDER TAB 2: WAR ROOM FOKUS + SIMULASI (v8.2.1) ====================
let warSimMode = false;
let warSimOppId = '';
let warSimIsHome = true;
let warSimIsKo = false;
let warSimCompKind = 'league';
let warShoutUsed = {};
let warCondManual = {};
let warCondSaveSig = '';

const WAR_REF_META = {
  strict: { ico: '🟥', lbl: 'Ketat' },
  normal: { ico: '⚖️', lbl: 'Normal' },
  lenient: { ico: '🟩', lbl: 'Longgar' },
  home: { ico: '🏠', lbl: 'Pro-Kandang' },
};
const WAR_WEATHER_META = {
  clear: { ico: '☀️', lbl: 'Cerah' },
  cloudy: { ico: '⛅', lbl: 'Berawan' },
  rain: { ico: '🌧️', lbl: 'Hujan' },
  heat: { ico: '🔥', lbl: 'Panas' },
  snow: { ico: '❄️', lbl: 'Salju' },
};

function getActiveWarCondKey() {
  return warSimMode ? 'sim' : ('fx_' + activeMatchIdx);
}

function resetWarCondToAuto() {
  const key = getActiveWarCondKey();
  delete warCondManual[key];
  showToast('Kondisi Cuaca & Wasit dikembalikan ke Auto-Engine');
  renderTab2();
}

function syncWarCondButtons(activeFx) {
  ['strict', 'normal', 'lenient', 'home'].forEach(r => {
    const el = document.getElementById('wr-ref-' + r);
    if (el) el.className = (warRef === r) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  ['clear', 'cloudy', 'rain', 'heat', 'snow'].forEach(w => {
    const el = document.getElementById('wr-w-' + w);
    if (el) el.className = (warWeather === w) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  const autoEl = document.getElementById('wr-cond-auto');
  if (autoEl) {
    const key = getActiveWarCondKey();
    const ov = warCondManual[key] || {};
    const hasAuto = Boolean(!warSimMode && activeFx && activeFx.autoCond);
    if (hasAuto) {
      const isOv = Boolean(ov.ref || ov.weather);
      autoEl.textContent = isOv ? '↩️ Manual · Kembali Auto' : '⚡ Auto-Engine';
      autoEl.className = isOv ? 'badge b-warn' : 'badge b-good';
      autoEl.disabled = false;
    } else {
      autoEl.textContent = '🧪 Simulasi (Manual)';
      autoEl.className = 'badge b-accent';
      autoEl.disabled = true;
    }
  }
}

function setWarCond(kind, val) {
  const key = getActiveWarCondKey();
  if (!warCondManual[key]) warCondManual[key] = {};
  if (kind === 'ref') {
    warRef = val;
    warCondManual[key].ref = val;
  }
  if (kind === 'weather') {
    warWeather = val;
    warCondManual[key].weather = val;
  }
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

function setWarSimKo(isKo) {
  warSimIsKo = Boolean(isKo);
  warSimMode = true;
  renderTab2();
}

function setWarSimComp(compKind) {
  warSimCompKind = compKind || 'league';
  warSimMode = true;
  renderTab2();
}

function jumpWarSection(secId) {
  if (secId === 't2-live-drawer') {
    const det = document.getElementById('t2-live-drawer');
    if (det) {
      det.setAttribute('open', '');
      det.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  const el = document.getElementById(secId);
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleWarShout(idx) {
  const k = `${warSimMode ? 'sim_' + warSimOppId : 'fx_' + activeMatchIdx}_${idx}`;
  warShoutUsed[k] = !warShoutUsed[k];
  renderWarLiveShouts();
}

function resetWarShouts() {
  const pref = `${warSimMode ? 'sim_' + warSimOppId : 'fx_' + activeMatchIdx}_`;
  Object.keys(warShoutUsed).forEach(k => { if (k.startsWith(pref)) delete warShoutUsed[k]; });
  renderWarLiveShouts();
  showToast('Pelacak 3 Shout direset untuk laga baru');
}

function openFormInTab3(formKey, useRot) {
  if (typeof ensureFormSelectOption === 'function') ensureFormSelectOption(formKey);
  const sel = document.getElementById('t3-form-select');
  if (sel) sel.value = formKey;
  setXiMode(useRot ? 'rot' : 'best');
  goToView('t3', 't3-xi');
  showToast(`Menampilkan ${useRot ? 'Rotation XI' : 'Best XI'} formasi ${fmtForm(formKey)}`);
}

function testWarTicketInSim(g, a, c, v, isBig, kind) {
  if (kind && typeof simCompKind !== 'undefined') {
    simCompKind = String(kind);
    const sel = document.getElementById('sim-comp-kind');
    if (sel) sel.value = simCompKind;
  }
  if (typeof simPrices === 'object' && simPrices) {
    simPrices = { geral: Number(g), arquibancada: Number(a), cadeiras: Number(c), camarotes: Number(v) };
  }
  if (typeof setSimMode === 'function') {
    setSimMode(isBig ? 'big' : 'normal');
  }
  goToView('t5', 't5-tkt');
  showToast('Harga tiket War Room dimuat ke Simulator Tiket!');
}

function fmtDelta(v) {
  const n = Number(v) || 0;
  const cls = n >= 1 ? 'c-green' : (n <= -1 ? 'c-red' : 'c-amber');
  return `<b class="mono ${cls}">${n >= 0 ? '+' : ''}${n.toFixed(1)}</b>`;
}

function findOppStanding(oppId, oppName) {
  const st = D.standings || [];
  if (!st.length) return null;
  let hit = oppId ? st.find(s => s.teamId === oppId) : null;
  if (!hit && oppName) {
    const low = String(oppName).toLowerCase();
    hit = st.find(s => String(s.name || '').toLowerCase() === low);
  }
  return hit || null;
}

function findRosterPlayerByName(name) {
  const low = String(name || '').trim().toLowerCase();
  return (D.roster || []).find(p => String(p.name || '').toLowerCase() === low) || null;
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
        xiLite: [],
        stars: [],
        injured: [],
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
    xiLite: [],
    stars: [],
    injured: [],
  }];
}

/**
 * Generator subPlan penuh (identik dengan laga resmi di scout.js):
 * Prioritaskan pelapis #11–#17 yang butuh kuota menit (<12%), lalu Supersub PAC/FIN.
 */
function buildUnifiedSubPlan(benchPool) {
  const pool = (benchPool || []).filter(p => p && p.pos !== 'G');
  const needMin = pool.filter(p => p.moodTier === 1 && Number(p.minPct ?? 100) < 12.0).slice(0, 2);
  const needIds = new Set(needMin.map(x => x.id));
  const rest = pool.filter(p => !needIds.has(p.id)).sort((a, b) => {
    const sa = (a.s1 === 'VEL' || a.s2 === 'VEL' || a.s1 === 'FIN' || a.s2 === 'FIN') ? 1 : 0;
    const sb = (b.s1 === 'VEL' || b.s2 === 'VEL' || b.s1 === 'FIN' || b.s2 === 'FIN') ? 1 : 0;
    return (sb - sa) || ((b.force || 0) - (a.force || 0));
  });

  const out = [];
  needMin.forEach(p => {
    out.push(`${p.name} (${fmtPos(p.pos)} ${p.force}) — kuota menit ${p.minPct || 0}%/8%`);
  });
  const needMore = Math.max(1, 3 - out.length);
  rest.slice(0, needMore).forEach(p => {
    const cat = EXACT_CAT[p.pos] ?? 3;
    const isAttMid = cat >= 3;
    const hasPf = (p.s1 === 'VEL' || p.s2 === 'VEL' || p.s1 === 'FIN' || p.s2 === 'FIN');
    let tag = 'Gelandang/Penyerang Segar';
    if (isAttMid && hasPf) tag = 'Supersub PAC/FIN';
    else if (!isAttMid) tag = (p.s1 === 'VEL' || p.s2 === 'VEL') ? 'Bek Segar (PAC)' : 'Bek Segar';
    out.push(`${p.name} (${fmtPos(p.pos)} ${p.force}) — ${tag}`);
  });
  return out.slice(0, 3);
}

/**
 * Hitung paket Matchup War Room penuh secara real-time untuk lawan simulasi!
 * v8.2.1: Pakai `opp.xiLite` (seluruh 11 starter lawan) + toggle Liga vs Gugur (`isKo`)!
 */
function buildSimulatedFixture(opp, isHome, isKo, compKind = warSimCompKind) {
  const Eng = window.LFEngine;
  const userRoster = D.roster || [];
  const fkActive = (D.meta && (D.meta.activeFormationRaw || D.meta.activeFormation)) || '4-3-3';
  const fCap = (D.meta && D.meta.foreignCap) || 7;
  const uCountry = (D.meta && D.meta.country) || '';
  const repLv = (D.meta && D.meta.repLevel) || 3;
  const k = compKind || 'league';
  const classicMeta = (typeof CFG.getClassicInfo === 'function') ? CFG.getClassicInfo(D.meta && D.meta.userId, opp.id) : null;
  const isClassic = Boolean(classicMeta);
  const liveCond = {
    weather: warWeather || 'clear',
    refStyle: warRef || 'normal',
    alt: 0,
    altHit: 0,
    varOn: false,
  };

  // Pakai seluruh 11 starter (`xiLite`) jika tersedia agar prediksi AI #23795 & duel udara HDG 100% akurat!
  const xiArr = (Array.isArray(opp.xiLite) && opp.xiLite.length)
    ? opp.xiLite.map(row => ({ player: { pos: row[0] || 'MC', s1: row[1] || '', s2: row[2] || '', force: row[3] || 38 } }))
    : (opp.stars || []).map(s => ({ player: { pos: s.pos || 'MC', s1: s.s1 || '', s2: s.s2 || '', force: s.force || 38 } }));

  const oppXi = {
    formation: opp.formation || '4-4-2',
    avgScore: Number(opp.avgScore || 38),
    sectors: opp.sectors || { GK: 38, DEF: 38, MID: 38, ATK: 38 },
    xi: xiArr,
  };

  const uAvg = Number((D.bestXi && D.bestXi.avgScore) || 40);
  const fullEdge = +(uAvg - oppXi.avgScore).toFixed(1);
  const isBig = Boolean(isKo || isClassic) || Number(opp.rep || 50) >= Number(D.meta.reputation || 50) + 10;
  const safeRotate = fullEdge >= 4.0 && !isKo && !isBig;

  let matchup = null;
  if (Eng && Eng.tactics && typeof Eng.tactics.recommendMatchupForOpponent === 'function') {
    matchup = Eng.tactics.recommendMatchupForOpponent(
      userRoster, oppXi, isHome, Boolean(isKo), isBig,
      fCap, uCountry, fkActive, null, safeRotate, repLv,
      liveCond, fkActive
    );
  }

  let ticketRec = null;
  if (isHome && Eng && Eng.economy && D.stadium && D.stadium.sections) {
    const euSet = (CFG && CFG.COUNTRY_GROUPS && CFG.COUNTRY_GROUPS[0]) || [];
    const region = euSet.includes(String(uCountry).toUpperCase()) ? 0 : 1;
    const bp = Eng.economy.getBaseTicketPrices(D.meta.division || 1, k, repLv, uCountry, region);
    const occ = isKo ? 'sf' : 'normal';
    const tmb = D.stadium.ticketMulBy || {};
    const usingPhase = Boolean(tmb[occ]);
    const curM = usingPhase ? tmb[occ] : (D.stadium.curMul || { geral: 1, arquibancada: 1, cadeiras: 1, camarotes: 1 });
    const curP = {
      geral: Math.max(1, Math.round(bp.geral * curM.geral)),
      arquibancada: Math.max(1, Math.round(bp.arquibancada * curM.arquibancada)),
      cadeiras: Math.max(1, Math.round(bp.cadeiras * curM.cadeiras)),
      camarotes: Math.max(1, Math.round(bp.camarotes * curM.camarotes)),
    };
    const repDiff = Number(opp.rep || 50) - Number(D.meta.reputation || 50);
    const simOpts = {
      homeRepLvl: repLv,
      country: uCountry,
      region,
      kind: k,
      koStage: isKo ? 'sf' : null,
      isClassic,
    };
    const opt = Eng.economy.optimizeTicketPricesV9(D.stadium.sections, D.meta.fanConf || 80, D.meta.division || 1, Boolean(isKo), isBig, repDiff, 70.5, simOpts);
    const curSim = Eng.economy.simulateStadiumByPricesV9(D.stadium.sections, curP, D.meta.fanConf || 80, D.meta.division || 1, Boolean(isKo), isBig, repDiff, simOpts);
    const diffs = [];
    const secNames = { geral: 'General', arquibancada: 'Stands', cadeiras: 'Seats', camarotes: 'Boxes' };
    ['geral', 'arquibancada', 'cadeiras', 'camarotes'].forEach(s => {
      if (Math.abs(opt.prices[s] - curP[s]) >= 1) diffs.push(`${secNames[s]} ${curP[s]}→${opt.prices[s]}`);
    });
    const kLbls = { league: 'Liga', cup: 'Piala / Copa', continental2: 'Kontinental 2 (AFC2 / UEL)', continental1: 'Kontinental 1 (AFC Elite / UCL)' };
    ticketRec = {
      occasion: occ,
      kind: k,
      kindLabel: kLbls[k] || k,
      region,
      basePrices: bp,
      isBig,
      isClassic,
      classicLabel: classicMeta ? classicMeta.label : '',
      isKnockout: Boolean(isKo),
      usingPhasePreset: usingPhase,
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
  const subPlan = buildUnifiedSubPlan(benchPool);

  const simCompNames = { league: 'Simulasi Liga', cup: 'Simulasi Piala (Copa)', continental2: 'Simulasi Kontinental 2 (AFC2/UEL)', continental1: 'Simulasi Kontinental 1 (AFC/UCL)' };
  return {
    isSim: true,
    autoCond: liveCond,
    oppId: opp.id,
    isHome,
    compName: simCompNames[k] || 'Simulasi',
    roundName: isKo ? 'Semifinal (Gugur)' : (isClassic ? (classicMeta.label || 'Derby Classic') : 'Laga Biasa / Grup'),
    oppName: opp.name,
    oppRep: Math.round(opp.rep || 50),
    oppFormation: oppXi.formation,
    oppAvg: oppXi.avgScore,
    edge: fullEdge,
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

function getEffectiveMatchEdge(fx) {
  const recAvg = fx && fx.matchup && fx.matchup.recommended ? Number(fx.matchup.recommended.avgScore) : null;
  if (recAvg !== null && Number.isFinite(recAvg)) {
    return +(recAvg - Number(fx.oppAvg || 0)).toFixed(1);
  }
  return Number(fx.edge || 0);
}

function renderSubLineClickable(line) {
  const idxParen = String(line || '').indexOf(' (');
  if (idxParen > 0) {
    const nm = line.slice(0, idxParen).trim();
    const rest = line.slice(idxParen);
    const pl = findRosterPlayerByName(nm);
    if (pl) {
      return `• <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(pl.id)}')"><b>${esc(nm)}</b></a>${esc(rest)}`;
    }
  }
  return '• ' + esc(line);
}

function renderXiPeekHtml(rec, fx) {
  const sum = (rec && Array.isArray(rec.xiSummary)) ? rec.xiSummary : [];
  if (!sum.length) return '';
  const ySet = new Set((fx.yellowRisks || []).map(y => String(y.name || '').toLowerCase()));
  const bestIds = new Set(((D.bestXi && D.bestXi.xi) || []).map(a => a.id));

  const chips = sum.map(entry => {
    const sep = entry.indexOf(':');
    const slot = sep > 0 ? entry.slice(0, sep) : '';
    const nm = sep > 0 ? entry.slice(sep + 1) : entry;
    const pl = findRosterPlayerByName(nm);
    const isY = ySet.has(nm.toLowerCase());
    const isRot = Boolean(fx.safeRotate && pl && !bestIds.has(pl.id));
    const cls = isY ? 'is-y' : (isRot ? 'is-rot' : '');
    const clickAttr = pl ? `onclick="openPlayerDrawer('roster','${escJs(pl.id)}')"` : '';
    const badges = (isY ? '🟨' : '') + (isRot ? '🔄' : '');
    return `<div class="wr-xi-chip ${cls}" ${clickAttr} title="Klik buka profil ${esc(nm)}">
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        <b class="mono c-sky">${esc(fmtPos(slot))}</b> ${esc(nm)} ${badges}
      </span>
      ${pl ? `<b class="mono c-green" style="flex-shrink:0">${pl.force}</b>` : ''}
    </div>`;
  }).join('');

  return `<details class="wr-xi-peek">
    <summary>👥 Intip 11 Starter Rekomendasi (${esc(fmtForm(rec.formation))}) — Klik nama → Profil</summary>
    <div class="wr-xi-grid">${chips}</div>
  </details>`;
}

/**
 * Hitung ulang Win% / xG / Style Compare secara live ketika manajer meng-override
 * Cuaca atau Wasit pada laga resmi War Room (#21365/#21366/#21367/#22073).
 */
function computeLiveWarSim(fx, rec, m, activeWeather, activeRef) {
  const Eng = window.LFEngine;
  if (!Eng || !Eng.tactics || !rec || !m || !m.oppPow) return null;
  const Tac = Eng.tactics;
  if (typeof Tac.resolveMatchCondFactors !== 'function' || typeof Tac.simulateMatchExpectation !== 'function') return null;

  const baseAc = fx.autoCond || {};
  const baseCondF = Tac.resolveMatchCondFactors(baseAc, fx.isHome, Boolean(fx.neutral));
  const simCond = {
    weather: activeWeather || baseAc.weather || 'clear',
    refStyle: activeRef || baseAc.refStyle || 'normal',
    alt: baseAc.alt || 0,
    altHit: baseAc.altHit || 0,
    varOn: Boolean(baseAc.varOn),
  };
  const newCondF = Tac.resolveMatchCondFactors(simCond, fx.isHome, Boolean(fx.neutral));

  const redMulHeavy = (cMul) => 1.0 - Math.min(0.35, 0.045 * 1.25 * Math.max(0.5, Number(cMul) || 1.0)) * 0.14;
  const fatMul = (eMul) => (Number(eMul) > 1.0 ? Math.max(0.95, 1.0 - 0.001 * ((Number(eMul) - 1.0) * 14.0)) : 1.0);
  const scalePow = (pObj, r) => ({
    ...pObj,
    DEF: +((Number(pObj.DEF) || 0) * r).toFixed(1),
    MID: +((Number(pObj.MID) || 0) * r).toFixed(1),
    ATK: +((Number(pObj.ATK) || 0) * r).toFixed(1),
    rawATK: +((Number(pObj.rawATK || pObj.ATK) || 0) * r).toFixed(1),
    atkCenter: +((Number(pObj.atkCenter || pObj.ATK) || 0) * r).toFixed(1),
    atkWings: +((Number(pObj.atkWings || pObj.ATK) || 0) * r).toFixed(1),
  });

  const oppRatio = (redMulHeavy(newCondF.oppCardMul) / redMulHeavy(baseCondF.oppCardMul))
    * (fatMul(newCondF.oppEnergyMul) / fatMul(baseCondF.oppEnergyMul));
  const oPowLive = Math.abs(oppRatio - 1.0) > 1e-5 ? scalePow(m.oppPow, oppRatio) : m.oppPow;

  const exIds = (fx.safeRotate && Array.isArray(fx.yellowRisks) && fx.yellowRisks.length)
    ? new Set(fx.yellowRisks.map(y => (findRosterPlayerByName(y.name) || {}).id).filter(Boolean))
    : null;
  const uXiObj = Tac.solveBestXi(
    D.roster || [],
    rec.formation,
    (D.meta && D.meta.foreignCap) || 7,
    (D.meta && D.meta.country) || '',
    exIds,
    Boolean(fx.safeRotate),
    (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3
  );

  const liveMarking = (m.refereePlan && m.refereePlan[activeRef] && m.refereePlan[activeRef].marking) || m.marking || 'Heavy';
  const oppFocus = (m.aiInfo && m.aiInfo.aiFocus) || fx.aiFocus || 'Center';
  const oppStyle = (m.aiInfo && m.aiInfo.aiStyle) || fx.aiStyle || 'Balanced';
  const recFocus = m.attackFocus || rec.optFocus || 'Center';
  const f9Id = (m.falseNine && m.falseNineTarget) ? m.falseNineTarget.id : null;
  const uCondOpts = { altHit: newCondF.altHit, energyMul: newCondF.userEnergyMul, cardMul: newCondF.userCardMul };

  const styleSims = {};
  for (const stTry of ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive']) {
    const pTry = Tac.computeEngineSectorPower(uXiObj, rec.formation, {
      isHome: fx.isHome, crowdOver70: true, style: stTry, marking: liveMarking, ...uCondOpts,
    });
    styleSims[stTry] = Tac.simulateMatchExpectation(pTry, oPowLive, {
      isHome: fx.isHome, neutral: Boolean(fx.neutral), focus: recFocus, oppFocus, style: stTry, oppStyle, missMul: newCondF.missMul,
    });
  }

  let liveStyle = 'Balanced';
  let bestPts = styleSims.Balanced.xPts;
  for (const stOpt of ['Offensive', 'Counter-Attack', 'Defensive']) {
    if (styleSims[stOpt].xPts >= bestPts + 0.012) {
      liveStyle = stOpt;
      bestPts = styleSims[stOpt].xPts;
    }
  }

  const finalPowRaw = Tac.computeEngineSectorPower(uXiObj, rec.formation, {
    isHome: fx.isHome, crowdOver70: true, style: liveStyle, marking: liveMarking, falseNineId: f9Id, ...uCondOpts,
  });
  const finalSim = f9Id
    ? Tac.simulateMatchExpectation(finalPowRaw, oPowLive, {
        isHome: fx.isHome, neutral: Boolean(fx.neutral), focus: recFocus, oppFocus, style: liveStyle, oppStyle, missMul: newCondF.missMul,
      })
    : styleSims[liveStyle];

  const enginePow = { ...finalPowRaw, ATK: finalSim.effAtkUser, atkMod: rec.atkMod || 0, defMod: rec.defMod || 0 };
  const styleCompare = ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive'].map(stName => ({
    ...styleSims[stName],
    style: stName,
    isRec: stName === liveStyle,
  }));

  const oCleanRatio = (redMulHeavy(1.0) / redMulHeavy(baseCondF.oppCardMul))
    * (fatMul(1.0) / fatMul(baseCondF.oppEnergyMul));
  const oPowClean = scalePow(m.oppPow, oCleanRatio);
  const uPowClean = Tac.computeEngineSectorPower(uXiObj, rec.formation, {
    isHome: fx.isHome, crowdOver70: true, style: liveStyle, marking: liveMarking, falseNineId: f9Id,
  });
  const cleanSim = Tac.simulateMatchExpectation(uPowClean, oPowClean, {
    isHome: fx.isHome, neutral: Boolean(fx.neutral), focus: recFocus, oppFocus, style: liveStyle, oppStyle, missMul: 1.0,
  });

  return {
    winPct: finalSim.winPct,
    drawPct: finalSim.drawPct,
    lossPct: finalSim.lossPct,
    xPts: finalSim.xPts,
    xGF: finalSim.xGF,
    xGA: finalSim.xGA,
    possPct: finalSim.possPct,
    uShots: finalSim.uShots,
    oShots: finalSim.oShots,
    playStyle: liveStyle,
    styleCompare,
    enginePow,
    oppPow: oPowLive,
    condDelta: {
      deltaWin: +(finalSim.winPct - cleanSim.winPct).toFixed(1),
      deltaPts: +(finalSim.xPts - cleanSim.xPts).toFixed(3),
      missMul: newCondF.missMul,
      userEnergyMul: newCondF.userEnergyMul,
      userCardMul: newCondF.userCardMul,
    },
  };
}

/**
 * Checklist Diff Pra-Laga (#save.lastLineup vs Rencana War Room):
 * Menampilkan perbedaan konkrit sebelum menekan Kickoff di game.
 */
function renderPreMatchDiffChecklist(fx, m, rec, refObj, isFirstOfficial, activeStyle) {
  if (!fx || fx.isSim || !D.lastLineup || !m || !rec) return '';
  const ll = D.lastLineup;

  const normStyle = s => {
    const k = String(s || '').toLowerCase();
    if (k.includes('off')) return 'offensive';
    if (k.includes('def')) return 'defensive';
    if (k.includes('counter')) return 'counter';
    return 'balanced';
  };
  const normFocus = s => (String(s || '').toLowerCase().includes('wing') ? 'wings' : 'center');
  const normMark = s => {
    const k = String(s || '').toLowerCase();
    if (k.includes('very')) return 'very';
    if (k.includes('heavy')) return 'heavy';
    return 'light';
  };
  const stripParen = s => String(s || '').replace(/\s*\([^)]*\)\s*/g, '').replace(/\s*\[[^\]]*\]\s*/g, '').trim();

  const items = [];
  const recForm = String(rec.formation || '');
  const curForm = String(ll.formationRaw || '');
  if (recForm && curForm !== recForm) {
    items.push({ lbl: 'Formasi', cur: fmtForm(curForm), target: fmtForm(recForm), diff: true });
  } else {
    items.push({ lbl: 'Formasi', cur: fmtForm(curForm), target: fmtForm(recForm), diff: false });
  }

  const curStyle = ll.playStyle || '-';
  const recSt = activeStyle || m.playStyle || 'Balanced';
  items.push({
    lbl: 'Gaya Main',
    cur: curStyle,
    target: recSt,
    diff: normStyle(curStyle) !== normStyle(recSt),
  });

  const curFocus = ll.attackFocus || '-';
  const recFc = m.attackFocus || 'Center';
  items.push({
    lbl: 'Fokus Serang',
    cur: curFocus,
    target: recFc,
    diff: normFocus(curFocus) !== normFocus(recFc),
  });

  const curMark = ll.marking || '-';
  const recMk = refObj ? String(refObj.marking || '').split(' (')[0] : (m.marking || 'Heavy').split(' (')[0];
  items.push({
    lbl: 'Marking',
    cur: curMark,
    target: recMk,
    diff: normMark(curMark) !== normMark(recMk),
  });

  if (Boolean(ll.falseNine) !== Boolean(m.falseNine)) {
    items.push({
      lbl: 'False Nine',
      cur: ll.falseNine ? 'ON' : 'OFF',
      target: m.falseNine && m.falseNineTarget ? `ON (${m.falseNineTarget.name})` : 'OFF',
      diff: true,
    });
  }

  const sp = (rec && rec.setPieces) || (D.bestXi && D.bestXi.setPieces) || {};
  const spChecks = [
    ['Kapten', ll.captainName, stripParen(sp.captain)],
    ['Penalti', ll.penaltyName, stripParen(sp.penalty)],
    ['Corner', ll.cornerName, stripParen(sp.corner)],
    ['Free Kick', ll.freeKickName, stripParen(sp.freeKick)],
  ];
  const spDiffs = spChecks.filter(([, a, b]) => b && b !== '-' && String(a || '').toLowerCase() !== String(b || '').toLowerCase());

  const lastIds = new Set((ll.starterIds || []).filter(Boolean));
  const recXiList = Array.isArray(rec.xi) ? rec.xi : [];
  const recIds = new Set(recXiList.map(x => x.id));
  const xiOut = (ll.starters || []).filter(s => !recIds.has(s.id));
  const xiIn = recXiList.filter(x => !lastIds.has(x.id));

  const changeCount = items.filter(x => x.diff).length + (xiIn.length > 0 || xiOut.length > 0 ? 1 : 0) + (spDiffs.length > 0 ? 1 : 0);
  const xiDiffHtml = (xiOut.length || xiIn.length) ? `
    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);font-size:11px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px">
      <div>
        <b class="c-red">⬇ Keluar XI (${xiOut.length}):</b>
        <div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:4px">${xiOut.map(s => {
          const tag = s.suspended ? ' 🟥SKORS' : (s.injured ? ' 🏥CED' : (fx.safeRotate ? ' 🔄ROT' : ''));
          return `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(s.id)}')"><b>${esc(s.name)}</b> <span class="mono">${fmtPos(s.pos)} F${s.force}</span>${tag ? `<b class="c-red">${tag}</b>` : ''}</span>`;
        }).join('') || '<span class="c-muted">-</span>'}</div>
      </div>
      <div>
        <b class="c-green">⬆ Masuk XI (${xiIn.length}):</b>
        <div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:4px">${xiIn.map(x =>
          `<span class="tl-pill" onclick="openPlayerDrawer('roster','${escJs(x.id)}')"><b>${esc(x.name)}</b> <span class="mono">${fmtPos(x.slot || x.pos)} F${x.force}</span></span>`
        ).join('') || '<span class="c-muted">-</span>'}</div>
      </div>
    </div>` : '';

  const spDiffHtml = spDiffs.length ? `
    <div style="margin-top:6px;font-size:11px;color:var(--amber)">
      <b>🎯 Set-Piece Berubah:</b> ${spDiffs.map(([lbl, curV, tgtV]) => `${lbl}: <span class="c-muted">${esc(curV || '-')}</span> → <b class="c-green">${esc(tgtV)}</b>`).join(' · ')}
    </div>` : '';

  return `
    <details id="wr-prematch-diff" class="glossary-inline mb-8" ${isFirstOfficial ? 'open' : ''}>
      <summary style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <span>✅ <b>Checklist Pre-Match Diff</b> <span class="c-muted">(Lineup Terakhir vs War Room)</span></span>
        <span class="badge ${changeCount === 0 ? 'b-good' : 'b-warn'}">${changeCount === 0 ? '✓ Siap Kickoff (0 beda)' : `⚠ ${changeCount} Penyesuaian Sebelum Kickoff`}</span>
      </summary>
      <div style="margin-top:8px">
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px">
          ${items.map(it => it.diff
            ? `<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:7px;padding:4px 8px">
                 <span class="c-amber"><b>${esc(it.lbl)}:</b></span> <span class="c-muted">${esc(it.cur)}</span> → <b class="c-green">${esc(it.target)}</b>
               </div>`
            : `<div style="background:var(--card);border:1px solid var(--border);border-radius:7px;padding:4px 8px">
                 <span class="c-muted">${esc(it.lbl)}:</span> <b class="c-green">${esc(it.target)} ✓</b>
               </div>`).join('')}
        </div>
        ${xiDiffHtml}
        ${spDiffHtml}
      </div>
    </details>`;
}

function renderWarRoomMatchCard(fx, isFirstOfficial) {
  const m = fx.matchup;
  const rec = m ? m.recommended : null;
  const refObj = m ? (m.refereePlan[warRef] || m.refereePlan.normal) : null;
  const wObj = m ? (m.weatherPlan[warWeather] || m.weatherPlan.clear) : null;
  const ac = (!fx.isSim && fx.autoCond) ? fx.autoCond : null;
  const condKey = fx.isSim ? 'sim' : ('fx_' + activeMatchIdx);
  const ov = warCondManual[condKey] || {};
  const isManualRef = Boolean(ov.ref && ac && ov.ref !== ac.refStyle);
  const isManualWeather = Boolean(ov.weather && ac && ov.weather !== ac.weather);
  const wMeta = WAR_WEATHER_META[warWeather] || WAR_WEATHER_META.clear;
  const rMeta = WAR_REF_META[warRef] || WAR_REF_META.normal;
  const refTitle = `${rMeta.ico} ${rMeta.lbl}${(!isManualRef && ac) ? ` (${ac.refCountry}${ac.refName ? ' · ' + ac.refName : ''})` : ''}`;
  const ourCardMul = warRef === 'strict' ? 1.2 : (warRef === 'lenient' ? 0.82 : (warRef === 'home' ? (fx.isHome ? 0.85 : 1.2) : 1.0));
  const altExtraPct = ac && ac.altHit > 0 ? Math.round(35 * ac.altHit) : 0;

  const liveSim = (!fx.isSim && (isManualRef || isManualWeather))
    ? computeLiveWarSim(fx, rec, m, warWeather, warRef)
    : null;
  const viewWin = liveSim ? liveSim.winPct : (rec ? rec.winPct : undefined);
  const viewDraw = liveSim ? liveSim.drawPct : (rec ? rec.drawPct : undefined);
  const viewLoss = liveSim ? liveSim.lossPct : (rec ? rec.lossPct : undefined);
  const viewXGF = liveSim ? liveSim.xGF : (rec ? rec.xGF : undefined);
  const viewXGA = liveSim ? liveSim.xGA : (rec ? rec.xGA : undefined);
  const viewPoss = liveSim ? liveSim.possPct : (rec ? rec.possPct : undefined);
  const viewUShots = liveSim ? liveSim.uShots : (rec ? rec.uShots : undefined);
  const viewOShots = liveSim ? liveSim.oShots : (rec ? rec.oShots : undefined);
  const viewStyle = liveSim ? liveSim.playStyle : (m ? m.playStyle : '-');
  const viewStyleCompare = liveSim ? liveSim.styleCompare : (m ? m.styleCompare : []);
  const viewEnginePow = liveSim ? liveSim.enginePow : (rec ? rec.enginePow : null);
  const viewOppPow = liveSim ? liveSim.oppPow : (m ? m.oppPow : null);

  const aiFocus = fx.aiFocus || (m && m.aiInfo ? m.aiInfo.aiFocus : 'Mixed');
  const oppSt = findOppStanding(fx.oppId, fx.oppName);
  const oppRankBadge = oppSt
    ? `<span class="badge b-info mono">#${oppSt.pos} Liga • ${oppSt.pts}p</span>`
    : '';
  const effEdge = getEffectiveMatchEdge(fx);

  // 0. STRIP CONTEKAN 5 DETIK + QUICK JUMP PILLS
  const tkt = fx.ticketRec;
  const tktCompact = tkt ? `${tkt.prices.geral}·${tkt.prices.arquibancada}·${tkt.prices.cadeiras}·${tkt.prices.camarotes}` : '';
  const shortStyle = String(viewStyle || '').split(' (')[0] || '-';
  const shortMark = refObj ? String(refObj.marking || '').split(' (')[0] : '-';
  const cheatStrip = `
    <div class="wr-cheat-strip">
      <div class="wr-cheat-top">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="badge ${fx.isSim ? 'b-accent' : (isFirstOfficial ? 'b-good' : 'b-info')}">${fx.isSim ? '🧪 SIMULASI' : (fx.isHome ? '🏠 KANDANG' : '✈️ TANDANG')}</span>
          <strong style="font-size:15px">vs ${esc(fx.oppName)}</strong>
          ${oppRankBadge}
        </div>
        <span class="badge ${fx.safeRotate ? 'b-accent' : 'b-warn'}">${fx.safeRotate ? '🔄 ROTASI XI' : '⚡ FULL XI'}</span>
      </div>
      <div class="wr-cheat-chips">
        ${rec ? `<span class="badge b-good mono" style="font-size:11px">⚽ ${esc(fmtForm(rec.formation))}</span>` : ''}
        ${viewWin !== undefined ? `<span id="wr-cheat-win" class="badge ${viewWin >= viewLoss ? 'b-good' : 'b-warn'} mono" style="font-size:11px">📊 ${viewWin}% W · ${viewDraw}% D · ${viewLoss}% L</span>` : ''}
        <span class="badge b-info" style="font-size:11px">${esc(shortStyle)}</span>
        <span class="badge ${refObj ? refObj.badge : 'b-muted'}" style="font-size:11px">Marking: ${esc(shortMark)}</span>
        <span class="badge ${isManualWeather ? 'b-warn' : 'b-info'}" style="font-size:11px">${wMeta.ico} ${wMeta.lbl}</span>
        <span class="badge ${isManualRef ? 'b-warn' : 'b-info'}" style="font-size:11px">${esc(refTitle)}</span>
        ${ac && ac.ko ? `<span class="badge b-muted mono" style="font-size:11px">🕒 ${esc(ac.ko)}</span>` : ''}
        ${ac ? `<span class="badge ${ac.varOn ? 'b-good' : 'b-muted'}" style="font-size:11px">📺 ${ac.varOn ? 'VAR ON' : 'VAR OFF'}</span>` : ''}
        ${ac && ac.alt >= 2000 ? `<span class="badge b-warn mono" style="font-size:11px">⛰️ ${ac.alt}m${altExtraPct ? ` (+${altExtraPct}% A)` : ''}</span>` : ''}
        ${tkt ? `<span class="badge ${tkt.diffs && tkt.diffs.length ? 'b-warn' : 'b-good'} mono" style="font-size:11px">🎟️ ${tktCompact}</span>` : '<span class="badge b-muted" style="font-size:11px">✈️ Tanpa Tiket</span>'}
        <span class="badge ${effEdge >= 1 ? 'b-good' : (effEdge <= -1 ? 'b-crit' : 'b-warn')} mono" style="font-size:11px">Edge ${effEdge >= 0 ? '+' : ''}${effEdge}</span>
      </div>
      <div class="wr-jump-bar">
        <button type="button" class="wr-jump-btn" onclick="jumpWarSection('wr-sec-tactic')">⚔️ Taktik</button>
        <button type="button" class="wr-jump-btn" onclick="jumpWarSection('wr-sec-ticket')">🎟️ Tiket</button>
        <button type="button" class="wr-jump-btn" onclick="jumpWarSection('wr-sec-sp')">🎯 Set-Piece</button>
        <button type="button" class="wr-jump-btn" onclick="jumpWarSection('t2-live-drawer')">📣 Live</button>
      </div>
    </div>`;

  const preMatchDiffHtml = renderPreMatchDiffChecklist(fx, m, rec, refObj, isFirstOfficial, viewStyle);

  // H2H Visual Bar + Peluang Menang (#48031)
  const simBar = (rec && viewWin !== undefined) ? `
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
      <div class="flex-between" style="font-size:10.5px;margin-bottom:4px;gap:6px;flex-wrap:wrap">
        <span><b>📊 Peluang Hasil (#48031)</b> · <span class="c-muted">Ball ${viewPoss}% · Shot ${viewUShots} vs ${viewOShots} · xG ${viewXGF}–${viewXGA}</span></span>
        <span class="mono"><b class="c-green">${viewWin}%</b> / <b class="c-amber">${viewDraw}%</b> / <b class="c-red">${viewLoss}%</b></span>
      </div>
      <div style="display:flex;height:7px;border-radius:99px;overflow:hidden;background:var(--card)">
        <div style="width:${viewWin}%;background:var(--green)"></div>
        <div style="width:${viewDraw}%;background:var(--amber)"></div>
        <div style="width:${viewLoss}%;background:var(--red)"></div>
      </div>
    </div>` : '';

  const h2hBlock = (m && rec && viewEnginePow && viewOppPow) ? `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:10px 11px;margin-bottom:10px">
      <div class="flex-between mb-8">
        <span class="kpi-lbl">⚔️ Duel H2H (${esc(fmtForm(rec.formation))} vs ${esc(fmtForm(fx.oppFormation))})</span>
        <span class="mono c-muted" style="font-size:11px">Kita <b class="c-sky">${rec.avgScore}</b> vs Lawan <b>${fx.oppAvg}</b> (${effEdge >= 0 ? '+' : ''}${effEdge})</span>
      </div>
      ${renderH2HBars(viewEnginePow, viewOppPow)}
      ${simBar}
    </div>` : '';

  const customRecHtml = (m && m.customRec) ? (() => {
    const cr = m.customRec;
    const isAlready = Boolean(cr.alreadyActive || cr.customKey === rec.formation);
    const badge = cr.alreadyActive
      ? '<span class="badge b-good">✓ SUDAH AKTIF DI SAVE</span>'
      : `<span class="badge b-accent">✨ UPGRADE +${cr.deltaWin}% Win · +${cr.deltaPts} xPts</span>`;
    return `<div style="background:var(--card);border:1px solid rgba(168,85,247,.38);border-radius:8px;padding:7px 9px;margin-bottom:8px;font-size:11px">
      <div class="flex-between" style="gap:6px;flex-wrap:wrap;margin-bottom:3px">
        <div>
          <b>🔧 Custom Slot Optimizer:</b> <span class="mono c-purple"><b>${esc(cr.customKey)}</b></span>
          ${badge}
        </div>
        <button type="button" class="btn btn-sm" onclick="openFormInTab3('${escJs(cr.customKey)}', ${fx.safeRotate ? 'true' : 'false'})">${isAlready ? '⚽ Cek Custom XI' : '✨ Pakai Custom XI'}</button>
      </div>
      <div class="c-muted mono">Slot: <b>${esc(cr.label)}</b> · FB-WF: <b class="${cr.wrongFootCount ? 'c-amber' : 'c-green'}">${cr.wrongFootCount}</b>${cr.wfSaved > 0 ? ` (hemat -${cr.wfSaved})` : ''} · Win <b class="c-green">${cr.winPct}%</b> (A${fmtMod(cr.atkMod)}/D${fmtMod(cr.defMod)})</div>
    </div>`;
  })() : '';

  // Kartu 1: Formasi Rekomendasi + Intip 11 XI + Top 3 (5 kolom pas 360px + tombol XI)
  const formBlock = (m && rec) ? `
    <div id="wr-sec-form" style="background:var(--bg2);border:1px solid ${m.keepActive ? 'rgba(16,185,129,.45)' : 'rgba(56,189,248,.55)'};border-radius:11px;padding:11px">
      <div class="flex-between mb-8">
        <div>
          <span class="kpi-lbl">1. Formasi Rekomendasi</span>
          <div style="margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:19px;font-weight:900" class="mono c-green">${esc(fmtForm(rec.formation))}</span>
            <span class="badge ${m.keepActive ? 'b-good' : 'b-info'}">${m.keepActive ? '✓ PERTAHANKAN' : `🔄 GANTI (+${m.scoreGain}% W)`}</span>
            ${viewWin !== undefined ? `<span class="badge b-good mono">${viewWin}% Win</span>` : ''}
            ${m.falseNine && m.falseNineTarget ? `<span class="badge b-accent">⚡ F9: ${esc(m.falseNineTarget.name)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-green" onclick="openFormInTab3('${escJs(rec.formation)}', ${fx.safeRotate ? 'true' : 'false'})">⚽ Lihat XI</button>
      </div>
      <div style="font-size:11px;margin-bottom:8px">${(m.reasons || []).map(r => `<div>• ${esc(r)}</div>`).join('')}</div>
      ${customRecHtml}
      ${renderXiPeekHtml(rec, fx)}
      <div class="tbl-wrap"><table class="wr-top3-tbl"><thead><tr>
        <th>Top 3</th><th class="col-hide-mob">Fokus</th><th>MID</th><th>ATK</th><th>DEF</th><th class="col-hide-mob">FB-WF</th><th>Win%</th><th>XI</th>
      </tr></thead><tbody>
        ${(m.top3 || []).map((tf, ti) => `<tr class="${tf.formation === rec.formation ? 'hl-user' : ''}">
          <td>
            <b>#${ti + 1} ${esc(fmtForm(tf.formation))}</b>
            <span class="wr-form-mod-sub mono">${esc(tf.optFocus || rec.optFocus || 'Center')} · xG ${tf.xGF ?? '-'}${tf.wrongFootCount ? ' · ⚠FB' : ''}</span>
          </td>
          <td class="mono col-hide-mob">${esc(tf.optFocus || '-')}</td>
          <td>${fmtDelta(tf.dMid)}</td><td>${fmtDelta(tf.dAtk)}</td><td>${fmtDelta(tf.dDef)}</td>
          <td class="mono col-hide-mob ${tf.wrongFootCount ? 'c-amber' : 'c-green'}">${tf.wrongFootCount}</td>
          <td class="mono ${tf.winPct >= tf.lossPct ? 'c-green' : 'c-amber'}"><b>${tf.winPct !== undefined ? tf.winPct + '%' : (tf.matchupScore >= 0 ? '+' : '') + tf.matchupScore}</b></td>
          <td><button type="button" class="btn btn-sm" onclick="openFormInTab3('${escJs(tf.formation)}', ${fx.safeRotate ? 'true' : 'false'})">XI</button></td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>` : '';

  const styleCmpRows = (Array.isArray(viewStyleCompare) && viewStyleCompare.length) ? `
    <div class="tbl-wrap" style="margin-top:5px;margin-bottom:6px">
      <table style="font-size:10px">
        <thead><tr><th>Gaya (#48031)</th><th>W / D / L</th><th>xPts</th><th>xG (Ball)</th></tr></thead>
        <tbody>${viewStyleCompare.map(sc => `<tr class="${sc.isRec ? 'hl-user' : ''}">
          <td><b>${esc(sc.style === 'Counter-Attack' ? 'Counter' : sc.style)}</b>${sc.isRec ? ' <span class="badge b-good">✓</span>' : ''}</td>
          <td class="mono"><b class="c-green">${sc.winPct}</b>/<span class="c-amber">${sc.drawPct}</span>/<span class="c-red">${sc.lossPct}%</span></td>
          <td class="mono"><b>${sc.xPts}</b></td>
          <td class="mono">${sc.xGF}–${sc.xGA} <span class="c-muted">(${sc.possPct}%)</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  // Kartu 2: Taktik, Intel AI #23795, Wasit & Cuaca
  const condDeltaObj = (liveSim && liveSim.condDelta) || (m && m.condBaseline) || null;
  const condImpactHtml = (condDeltaObj && (Math.abs(condDeltaObj.deltaWin) >= 0.1 || Math.abs(condDeltaObj.deltaPts) >= 0.002))
    ? `<div style="margin-top:3px">Dampak Kondisi vs Normal: <b class="mono ${condDeltaObj.deltaWin >= 0 ? 'c-green' : 'c-amber'}">${condDeltaObj.deltaWin >= 0 ? '+' : ''}${condDeltaObj.deltaWin}% Win · ${condDeltaObj.deltaPts >= 0 ? '+' : ''}${condDeltaObj.deltaPts} xPts</b>${condDeltaObj.missMul > 1.0 ? ` <span class="c-muted">(miss ×${condDeltaObj.missMul})</span>` : ''}${condDeltaObj.userEnergyMul > 1.0 ? ` <span class="c-muted">(stamina ×${condDeltaObj.userEnergyMul})</span>` : ''}</div>`
    : '';

  const autoCondBanner = ac ? `
    <div class="mb-8" style="background:var(--card);border:1px solid ${(isManualRef || isManualWeather) ? 'rgba(245,158,11,.45)' : 'rgba(16,185,129,.4)'};padding:7px 9px;border-radius:8px;font-size:11px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:3px">
        <span><b>⚡ Kondisi Laga Engine (v1.2.0)</b> <span class="mono c-muted">${esc(ac.dateStr)} · 🕒 ${esc(ac.ko || '-')}</span></span>
        <span class="badge ${(isManualRef || isManualWeather) ? 'b-warn' : 'b-good'}">${(isManualRef || isManualWeather) ? '✏️ Live Simulasi Override' : '⚡ Auto-Engine'}</span>
      </div>
      <div class="mono" style="line-height:1.5">
        Cuaca: <b>${wMeta.ico} ${wMeta.lbl}</b> · Wasit: <b>${esc(rMeta.ico + ' ' + rMeta.lbl)}</b> [${esc(ac.refCountry)}${ac.refName ? ' · ' + esc(ac.refName) : ''}, kartu kita <b>${ourCardMul.toFixed(2)}x</b>] · VAR: <b class="${ac.varOn ? 'c-green' : 'c-muted'}">${ac.varOn ? 'ON' : 'OFF'}</b>${ac.alt >= 2000 ? ` · ⛰️ Alt <b>${ac.alt}m</b>${altExtraPct ? ` (+${altExtraPct}% stamina tandang)` : ''}` : ''}
      </div>
      ${condImpactHtml}
    </div>` : '';

  const tacticBlock = (m && refObj && wObj) ? `
    <div id="wr-sec-tactic" style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">2. Contekan Taktik, Intel AI (#24016), Wasit &amp; Cuaca</div>
      ${autoCondBanner}
      <div class="mb-8" style="background:var(--card);padding:6px 8px;border-radius:7px">
        <b>🤖 Prediksi AI Lawan:</b> <span class="badge b-warn">${esc(fx.aiStyle)}</span>
        <span class="badge b-accent">Fokus: ${esc(aiFocus)}</span>
      </div>
      <div class="mb-8"><b>Gaya Main:</b> <span class="badge b-good">${esc(viewStyle)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(liveSim ? `Live simulasi kondisi ${wMeta.lbl} & wasit ${rMeta.lbl} menghasilkan xPts tertinggi pada ${viewStyle}.` : m.playReason)}</div>
        ${styleCmpRows}
      </div>
      <div class="mb-8"><b>Fokus Serang:</b> <span class="badge b-info">${esc(m.attackFocus)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(m.focusReason)}</div>
      </div>
      <div class="mb-8"><b>False Nine (#21822):</b> <span class="badge ${m.falseNine ? 'b-accent' : 'b-muted'}">${m.falseNine && m.falseNineTarget ? `ON: ${esc(m.falseNineTarget.name)}` : 'OFF (Tidak Dipakai)'}</span>
        <div class="c-muted" style="margin-top:2px">${esc(m.falseNineWhy || 'OFF — Mempertahankan 100% bobot lini depan.')}</div>
      </div>
      <div class="mb-8"><b>Marking (Wasit ${esc(rMeta.lbl)} · ${ourCardMul.toFixed(2)}x):</b> <span class="badge ${refObj.badge}">${esc(refObj.marking)}</span>
        <div class="c-muted" style="margin-top:2px">${esc(refObj.note)}</div>
      </div>
      <div><b>Cuaca (${esc(wObj.label)}):</b> <span class="c-muted">${esc(wObj.note)}</span></div>
    </div>` : '';

  // Kartu 3: Harga Tiket Kandang (+ Badge Preset Fase + Highlight Sektor Berubah + Tombol Tes Simulator)
  const tktCopyStr = tkt ? `${tkt.prices.geral} · ${tkt.prices.arquibancada} · ${tkt.prices.cadeiras} · ${tkt.prices.camarotes}` : '';
  const tktBox = (lbl, optV, curV, mulV) => {
    const chg = Math.abs(optV - curV) >= 1;
    const mulTxt = mulV !== undefined ? ` (${Number(mulV).toFixed(2)}x)` : '';
    return `<div class="tkt-box ${chg ? 'changed' : ''}">
      <div class="c-muted" style="font-size:10px">${lbl}${mulTxt}</div>
      <div class="mono ${chg ? 'c-amber' : 'c-green'}" style="font-size:18px;font-weight:900">${optV}</div>
      <div class="mono c-muted" style="font-size:10px">${chg ? `kini ${curV} → ${optV}` : `✓ pas (${curV})`}</div>
    </div>`;
  };

  const tktBpStr = (tkt && tkt.basePrices) ? `Base ${tkt.basePrices.geral}·${tkt.basePrices.arquibancada}·${tkt.basePrices.cadeiras}·${tkt.basePrices.camarotes}` : '';
  const ticketBlock = tkt ? `
    <div id="wr-sec-ticket" style="background:var(--bg2);border:1px solid rgba(16,185,129,.45);border-radius:11px;padding:11px;font-size:11px">
      <div class="flex-between mb-8">
        <div>
          <span class="kpi-lbl">3. Harga Tiket Kandang (${String(tkt.occasion || 'normal').toUpperCase()}${tkt.isBig ? ' • BIG MATCH' : ''}${tkt.isKnockout ? ' • GUGUR' : ''})</span>
          <div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap">
            <span class="badge ${tkt.diffs && tkt.diffs.length ? 'b-warn' : 'b-good'}">${tkt.diffs && tkt.diffs.length ? 'UBAH HARGA!' : '✓ SUDAH PAS'}</span>
            ${tkt.kindLabel ? `<span class="badge b-accent">${esc(tkt.kindLabel)}</span>` : ''}
            ${tkt.isClassic ? `<span class="badge b-warn">🔥 ${esc(tkt.classicLabel || 'DERBY')}</span>` : ''}
            <span class="badge ${tkt.usingPhasePreset ? 'b-info' : 'b-muted'}">${tkt.usingPhasePreset ? 'Preset Fase Aktif' : 'Tarif Dasar'}</span>
            ${tktBpStr ? `<span class="c-muted mono" style="font-size:10px;align-self:center">${tktBpStr}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:5px">
          <button type="button" class="btn btn-sm" onclick="copyText('${tktCopyStr}','Harga Tiket')">📋 Salin</button>
          <button type="button" class="btn btn-sm" onclick="testWarTicketInSim(${tkt.prices.geral},${tkt.prices.arquibancada},${tkt.prices.cadeiras},${tkt.prices.camarotes},${tkt.isBig || tkt.isKnockout ? 'true' : 'false'},'${escJs(tkt.kind || 'league')}')">🎟️ Tes →</button>
        </div>
      </div>
      <div class="grid g4 ticket-4grid" style="gap:6px;margin-bottom:8px;text-align:center">
        ${tktBox('General', tkt.prices.geral, tkt.curPrices.geral, tkt.muls && tkt.muls.geral)}
        ${tktBox('Stands', tkt.prices.arquibancada, tkt.curPrices.arquibancada, tkt.muls && tkt.muls.arquibancada)}
        ${tktBox('Seats', tkt.prices.cadeiras, tkt.curPrices.cadeiras, tkt.muls && tkt.muls.cadeiras)}
        ${tktBox('Boxes', tkt.prices.camarotes, tkt.curPrices.camarotes, tkt.muls && tkt.muls.camarotes)}
      </div>
      <div>Est. Fill: <b class="mono ${tkt.fillPct >= 70 ? 'c-green' : 'c-red'}">${tkt.fillPct}%</b> (bonus +2% MID ≥70%) • Est. Gate: <b class="mono c-green">${fmtM(tkt.estRev)}</b>
      ${tkt.diffs && tkt.diffs.length ? `<div class="c-amber" style="margin-top:3px"><b>Ubah di layar Tickets:</b> ${tkt.diffs.join(' · ')} ${tkt.revGain > 0 ? `(+${fmtM(tkt.revGain)}/laga)` : ''}</div>` : ''}</div>
    </div>` : `
    <div id="wr-sec-ticket" style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">3. Tiket Pertandingan</div>
      <div class="c-muted">✈️ Laga Tandang / Netral — tidak mengatur harga tiket kandang. Fokus curi poin &amp; jaga stamina!</div>
    </div>`;

  // Kartu 4: Set Pieces 2x2 + REGRESI DIKEMBALIKAN (`m.setPieceNotes`!) + 3 Sub Klik->Drawer + 2 Kuning Klik->Drawer
  const sp = (rec && rec.setPieces) || (D.bestXi && D.bestXi.setPieces) || { penalty: '-', corner: '-', freeKick: '-', captain: '-' };
  const spNotesHtml = (m && Array.isArray(m.setPieceNotes) && m.setPieceNotes.length)
    ? `<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:7px 9px;margin-bottom:8px">
         <div class="kpi-lbl" style="margin-bottom:3px;font-size:10px">Intel Bola Mati &amp; Auto Blind Spot</div>
         ${m.setPieceNotes.map(n => {
           const isWarn = n.includes('Auto game') || n.includes('Perhatian') || n.includes('Waspada');
           return `<div class="${isWarn ? 'c-amber' : 'c-muted'}" style="margin-top:2px">• ${esc(n)}</div>`;
         }).join('')}
       </div>`
    : '';

  const yWarn = (fx.yellowRisks && fx.yellowRisks.length)
    ? `<div class="mb-8" style="background:var(--red-bg);border:1px solid rgba(239,68,68,.4);border-radius:8px;padding:6px 8px">
         <b class="c-red">🟨 RAWAN SKORSING (2 Kuning):</b> ${fx.yellowRisks.map(y => {
           const pl = findRosterPlayerByName(y.name);
           return pl
             ? `<a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(pl.id)}')"><b>${esc(y.name)}</b></a>`
             : `<b>${esc(y.name)}</b>`;
         }).join(', ')}
       </div>` : '';

  const spAndSubBlock = `
    <div id="wr-sec-sp" style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
      <div class="kpi-lbl mb-8">4. Set Pieces, 3 Sub (Menit ${warWeather === 'heat' ? '55–62' : '60–70'}) &amp; Intel Lawan</div>
      ${yWarn}
      <div class="sp-2grid">
        <div class="sp-box"><span class="c-muted">Penalti:</span><b class="c-green">${esc(sp.penalty)}</b></div>
        <div class="sp-box"><span class="c-muted">Corner:</span><b class="c-sky">${esc(sp.corner)}</b></div>
        <div class="sp-box"><span class="c-muted">Free Kick:</span><b class="c-purple">${esc(sp.freeKick)}</b></div>
        <div class="sp-box"><span class="c-muted">Kapten:</span><b class="c-amber">${esc(sp.captain)}</b></div>
      </div>
      ${spNotesHtml}
      <div class="mb-8"><b>🪑 3 Pergantian Prioritas (Klik nama → Profil):</b>
        <div class="c-muted" style="margin-top:2px">${(fx.subPlan || []).map(renderSubLineClickable).join('<br/>')}</div>
      </div>
      <div><b>⚠️ Bintang Lawan:</b> <span class="c-muted">${(fx.oppStars || []).map(s => `${esc(s.name)} (${fmtPos(s.pos)} ${s.force})`).join(', ') || '-'}</span></div>
      ${(fx.oppInjured && fx.oppInjured.length) ? `<div class="c-amber" style="margin-top:3px"><b>🏥 Lawan Cedera:</b> ${fx.oppInjured.map(s => `${esc(s.name)} (${s.days}d)`).join(', ')}</div>` : ''}
    </div>`;

  return `
    ${cheatStrip}
    ${preMatchDiffHtml}
    ${h2hBlock}
    <div class="grid g2" style="gap:10px">
      ${formBlock}
      ${tacticBlock}
      ${ticketBlock}
      ${spAndSubBlock}
    </div>`;
}

function renderWarLiveShouts(activeFx = null) {
  const lc = D.liveCoach || { shouts: [], orders: [] };
  const shEl = document.getElementById('t2-shouts');
  const pref = `${warSimMode ? 'sim_' + warSimOppId : 'fx_' + activeMatchIdx}_`;
  if (shEl) {
    shEl.innerHTML = (lc.shouts || []).map((s, idx) => {
      const used = Boolean(warShoutUsed[pref + idx]);
      return `<label class="shout-item ${used ? 'used' : ''}">
        <input type="checkbox" ${used ? 'checked' : ''} onchange="toggleWarShout(${idx})" style="margin-top:2px;width:18px;height:18px;accent-color:#10b981;flex-shrink:0" />
        <div style="flex:1;min-width:0">
          <div class="flex-between">
            <b class="shout-name">${esc(s.name)}</b>
            <span class="badge ${used ? 'b-muted' : 'b-good'}">${used ? 'SUDAH DIPAKAI ✓' : '100% SIAP'}</span>
          </div>
          <div class="c-muted" style="font-size:11px;margin-top:2px"><b>Waktu:</b> ${esc(s.when)} — ${esc(s.effect)}</div>
        </div>
      </label>`;
    }).join('');
  }
  const orEl = document.getElementById('t2-orders');
  if (orEl) {
    const mo = D.matchOrdersAudit || { count: 0, activeCount: 0, hasTiredSub: false, issues: [] };
    const subMin = warWeather === 'heat' ? 56 : 62;
    const recFocus = (activeFx && activeFx.matchup && activeFx.matchup.attackFocus) || 'Center';
    const presets = [
      {
        name: '1. Segarkan Skuad',
        when: `Min ${subMin} · Babak 2 · Any score`,
        does: 'Sub: The most tired (Any ≠ GK) → Best sub (Same slot)',
        why: 'Jaga effectiveForce tetap segar di babak kedua tanpa rawan gagal.',
      },
      {
        name: '2. Kunci Skor',
        when: 'Min 70 · Babak 2 · Winning (1+)',
        does: 'Style: Defensive (+8% DEF) · Marking: Light · Sub tired → Same slot',
        why: 'Amankan keunggulan sambil menekan risiko kartu merah menit akhir.',
      },
      {
        name: '3. Kejar Gol',
        when: 'Min 65 · Babak 2 · Losing (1+)',
        does: `Style: Offensive (+8% ATK) · Focus: ${recFocus} · Sub tired → Forwards/Mid`,
        why: 'Dorong gol balasan dengan fokus terkuat skuad vs lawan ini.',
      },
      {
        name: '4. Darurat Kartu Merah Kita',
        when: 'Min 1 · Any · I have a player sent off',
        does: 'Style: Counter-attack (+7% konversi) · Marking: Light',
        why: '⚠ Jangan isi ganti Formasi (otomatis diblokir aturan formationBlocked).',
      },
      {
        name: '5. Hajar Lawan 10 Pemain',
        when: 'Min 1 · Any · Opponent sent off',
        does: 'Style: Offensive (+8% ATK)',
        why: 'Manfaatkan keunggulan jumlah pemain sejak kartu merah keluar.',
      },
    ];
    const auditStrip = `
      <div class="alert-item ${mo.issues.length ? 'WARN' : ''}" style="margin-bottom:6px">
        <span class="badge ${mo.issues.length ? 'b-warn' : (mo.activeCount > 0 ? 'b-good' : 'b-info')}">
          ${mo.activeCount > 0 ? `OTA ORDERS: ${mo.activeCount} AKTIF` : 'BELUM ADA ORDER DI SAVE'}
        </span>
        <div>
          ${mo.issues.length
            ? mo.issues.map(iss => `<div><b>${esc(iss.title)}</b> — <span class="c-muted">${esc(iss.detail)}</span></div>`).join('')
            : (mo.activeCount > 0
                ? 'Semua Match Orders di save bersih & siap jalan 1x/laga!'
                : 'Game baru merilis fitur <b>Match Orders</b> (OTA 01a20a9f). Pasang 5 preset di bawah agar taktik & pergantian berjalan otomatis saat main/Quick Play.')}
        </div>
      </div>`;
    const presetsHtml = `
      <div style="margin-bottom:8px;padding:8px 10px;background:var(--bg2);border:1px solid rgba(56,189,248,.35);border-radius:9px;font-size:11px">
        <div style="font-weight:800;margin-bottom:5px" class="c-sky">🤖 5 Preset Match Orders Siap Pasang di Game (Disimpan per Klub)</div>
        ${presets.map(pr => `<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
          <div><b>${esc(pr.name)}</b> <span class="badge b-info">${esc(pr.when)}</span></div>
          <div class="c-green mono" style="font-size:10.5px;margin-top:2px">→ ${esc(pr.does)}</div>
          <div class="c-muted" style="font-size:10.5px">${esc(pr.why)}</div>
        </div>`).join('')}
      </div>`;
    orEl.innerHTML = auditStrip + presetsHtml + (lc.orders || []).map(o => `
      <div class="alert-item">
        <span class="badge b-info">LIVE RULE</span>
        <div><b>${esc(o.cond)}</b> → <span class="c-green">${esc(o.order)}</span><div class="c-muted" style="font-size:11px">${esc(o.note)}</div></div>
      </div>`).join('');
  }
}

function renderTab2() {
  const selEl = document.getElementById('t2-selector');
  const mainEl = document.getElementById('t2-active-match');
  if (!selEl || !mainEl) return;

  const list = Array.isArray(D.upcoming) ? D.upcoming : [];
  const simOpps = getSimOpponentsList();

  const curSig = `${(D.meta && D.meta.currentDate) || ''}|${(D.meta && D.meta.userId) || ''}|${list.length}`;
  if (curSig !== warCondSaveSig) {
    warCondManual = {};
    warCondSaveSig = curSig;
  }

  if (!list.length) warSimMode = true;
  if (!warSimOppId || !simOpps.some(o => o.id === warSimOppId)) {
    warSimOppId = simOpps[0].id;
  }

  // 1. Bar Pemilih 5 Laga + Tombol Simulasi (Angka Edge diselaraskan dengan isi kartu!)
  const officialPills = list.map((fx, idx) => {
    const isAct = (!warSimMode && idx === activeMatchIdx);
    const tktNeed = fx.ticketRec && fx.ticketRec.diffs && fx.ticketRec.diffs.length;
    const effEdge = getEffectiveMatchEdge(fx);
    const edgeCls = effEdge >= 2 ? 'c-green' : (effEdge <= -2 ? 'c-red' : 'c-amber');
    const oppSt = findOppStanding(fx.oppId, fx.oppName);
    const acP = fx.autoCond;
    const wIcoP = acP && WAR_WEATHER_META[acP.weather] ? WAR_WEATHER_META[acP.weather].ico : '';
    const rIcoP = acP && WAR_REF_META[acP.refStyle] ? WAR_REF_META[acP.refStyle].ico : '';
    return `<button type="button" class="match-pill ${isAct ? 'active' : ''}" onclick="selectWarMatch(${idx})">
      <div class="flex-between" style="font-size:10px;margin-bottom:3px">
        <span class="badge ${idx === 0 ? 'b-good' : 'b-muted'}">${idx === 0 ? 'NEXT' : '#' + (idx + 1)} • ${fx.isHome ? '🏠' : '✈️'}${wIcoP || rIcoP ? ' ' + wIcoP + rIcoP : ''}</span>
        <span class="mono ${edgeCls}"><b>${fx.safeRotate ? 'Rot ' : ''}${effEdge >= 0 ? '+' : ''}${effEdge}</b></span>
      </div>
      <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ${esc(fx.oppName)}${oppSt ? ` <span class="c-muted mono" style="font-size:10px">#${oppSt.pos}</span>` : ''}</div>
      <div class="c-muted" style="font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${esc(fx.compName)}${fx.roundName ? ' · ' + esc(fx.roundName) : ''}
        ${acP && acP.varOn ? ' <b class="c-green">• VAR</b>' : ''}
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
      ${list.length ? 'Tes 15 formasi vs rival' : 'Jeda musim — aktif'}
    </div>
  </button>`;

  selEl.innerHTML = officialPills + simPill;

  // 2. Render Konten Utama War Room (+ Sinkronisasi Kondisi Otomatis)
  let activeFx = null;
  let simControlsHtml = '';

  if (warSimMode) {
    const chosenOpp = simOpps.find(o => o.id === warSimOppId) || simOpps[0];
    const ovSim = warCondManual.sim || {};
    warRef = ovSim.ref || warRef || 'normal';
    warWeather = ovSim.weather || warWeather || 'clear';
    activeFx = buildSimulatedFixture(chosenOpp, warSimIsHome, warSimIsKo, warSimCompKind);
    simControlsHtml = `
      <div class="wr-sim-bar">
        <div style="font-size:12px">
          <span class="badge b-accent">MODE SIMULASI LAWAN</span>
          <span class="c-muted" style="margin-left:5px">${!list.length ? 'Jadwal resmi selesai — uji persiapan musim depan!' : 'Uji 15 formasi & taktik melawan klub mana pun (11 starter penuh).'}</span>
        </div>
        <select id="wr-sim-opp" onchange="setWarSimOpp(this.value)">
          ${simOpps.map(o => {
            const ost = findOppStanding(o.id, o.name);
            return `<option value="${esc(o.id)}" ${o.id === chosenOpp.id ? 'selected' : ''}>${ost ? '#' + ost.pos + ' ' : ''}${esc(o.name)} (Avg ${o.avgScore} • ${fmtForm(o.formation)})</option>`;
          }).join('')}
        </select>
        <div class="wr-sim-toggles" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn btn-sm ${warSimIsHome ? 'btn-green' : ''}" onclick="setWarSimHome(true)">🏠 Kandang</button>
          <button type="button" class="btn btn-sm ${!warSimIsHome ? 'btn-green' : ''}" onclick="setWarSimHome(false)">✈️ Tandang</button>
          <select id="wr-sim-comp" onchange="setWarSimComp(this.value)" style="width:auto;padding:4px 8px;font-size:12px">
            <option value="league" ${warSimCompKind === 'league' ? 'selected' : ''}>🏟️ Liga</option>
            <option value="continental2" ${warSimCompKind === 'continental2' ? 'selected' : ''}>🌏 AFC2 / UEL</option>
            <option value="continental1" ${warSimCompKind === 'continental1' ? 'selected' : ''}>⭐ AFC Elite / UCL</option>
            <option value="cup" ${warSimCompKind === 'cup' ? 'selected' : ''}>🏆 Piala (Copa)</option>
          </select>
          <button type="button" class="btn btn-sm ${!warSimIsKo ? 'btn-green' : ''}" onclick="setWarSimKo(false)">Grup / Biasa</button>
          <button type="button" class="btn btn-sm ${warSimIsKo ? 'btn-amber' : ''}" onclick="setWarSimKo(true)">🏆 Gugur / SF</button>
        </div>
      </div>`;
  } else {
    if (activeMatchIdx >= list.length) activeMatchIdx = 0;
    activeFx = list[activeMatchIdx];
    const ov = warCondManual['fx_' + activeMatchIdx] || {};
    if (activeFx && activeFx.autoCond) {
      warRef = ov.ref || activeFx.autoCond.refStyle || 'normal';
      warWeather = ov.weather || activeFx.autoCond.weather || 'clear';
    } else {
      warRef = ov.ref || 'normal';
      warWeather = ov.weather || 'clear';
    }
  }

  syncWarCondButtons(activeFx);
  mainEl.innerHTML = simControlsHtml + renderWarRoomMatchCard(activeFx, !warSimMode && activeMatchIdx === 0);

  // 3. Render Halftime Talk & Pelacak 3 Shout
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
  renderWarLiveShouts(activeFx);
}
