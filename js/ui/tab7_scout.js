// ==================== RENDER TAB 4: TRANSFER, SHORTLIST & AUTO-SCOUT (v8.2.3) ====================
let scoutPageLimit = 30;
let cartBenchOppId = 'AUTO_NEXT';
let bpShowAll = false;

function toggleBpShowAll() {
  bpShowAll = !bpShowAll;
  renderScoutBlueprint();
}

function setCartBenchOpp(val) {
  cartBenchOppId = val || 'AUTO_NEXT';
  if (D) D._benchImpactCache = null;
  renderCart();
}

function bTeamPlayerToSimPlayer(p) {
  const pos = p.pos || 'MC';
  return {
    id: p.id,
    name: p.name,
    pos,
    cat: EXACT_CAT[pos] ?? 3,
    age: p.age || 21,
    foot: p.foot || 'D',
    nationality: p.nationality || '',
    force: p.force || 25,
    effForce: p.effForce || p.force || 25,
    potential: p.potential || p.potCap || p.force || 25,
    potCap: p.potCap || p.force || 25,
    s1: p.s1 || '',
    s2: p.s2 || '',
    stackPct: p.stackPct || 0,
    nonStack: Boolean(p.nonStack),
    salary: p.salary || 0,
    marketValue: p.marketValue || 0,
    energy: p.energy ?? 100,
    injured: Boolean(p.injured),
    suspended: Boolean(p.suspended),
    star: Boolean(p.star),
    top: Boolean(p.top),
    starAwarded: false,
    integration: p.integration ?? 95,
    rx: p.rx ?? 7,
    mood: 'ok',
    fineSlump: 0,
  };
}

function toggleCartBIn(pid) {
  if (!pid) return;
  const list = (D.bTeamInfo && Array.isArray(D.bTeamInfo.roster)) ? D.bTeamInfo.roster : [];
  if (cartBIn[pid]) {
    const nm = cartBIn[pid].name || 'Pemain Tim B';
    delete cartBIn[pid];
    showToast(`Dilepas dari Simulasi Cart: ${nm}`);
  } else {
    const found = list.find(x => x.id === pid);
    if (found) {
      cartBIn[pid] = found;
      showToast(`🅱️ ${found.name} masuk Simulasi Cart (Promosi 0€)!`);
    }
  }
  renderTab7All();
  if (typeof renderBTeamPanel === 'function') renderBTeamPanel();
}

function addBTeamSelectToCart() {
  const sel = document.getElementById('t7-bteam-pick');
  if (!sel || !sel.value) return;
  toggleCartBIn(sel.value);
}

function isRecommendedSell(p) {
  if (p.injured) return false;
  return Boolean(
    p.forSale
    || p.isDeclining
    || p.age >= p.sellWarnAge
    || (p.squadRank >= 15 && p.age >= 24 && !p.isGem)
    || (p.action && p.action.includes('JUAL'))
  );
}

function isBosmanTarget(r) {
  if (!r) return false;
  const fl = String(r[18] || '');
  return fl.includes('BOSMAN');
}

function isBlockedTransfer(r) {
  if (!r) return false;
  const fl = String(r[18] || '');
  return fl.includes('REFUSE_DIST') || fl.includes('REFUSE_LVL') || fl.includes('KEY_LOCK') || fl.includes('PERSUADE') || fl.includes('REFUSE');
}

function getEffectiveBuyCost(r) {
  if (!r) return 0;
  const pid = r[19];
  if (cartInBosman && cartInBosman[pid] && isBosmanTarget(r)) return 0;
  return Number(r[14]) || 0;
}

function scoutRowToSimPlayer(r) {
  const pos = r[1] || 'MC';
  return {
    id: r[19],
    name: r[0],
    pos,
    cat: EXACT_CAT[pos] ?? 3,
    age: r[2] || 22,
    foot: r[3] || 'D',
    nationality: r[4] || '',
    force: r[5] || 20,
    effForce: r[5] || 20,
    potential: r[6] || r[5] || 20,
    potCap: r[7] || r[6] || r[5] || 20,
    s1: r[8] || '',
    s2: r[9] || '',
    stackPct: r[10] || 0,
    nonStack: Boolean(r[11]),
    salary: Math.round((r[12] || 0) * 0.95),
    marketValue: r[13] || 0,
    energy: 100,
    injured: false,
    suspended: false,
    star: r[20] === 1,
    top: r[20] === 2,
    starAwarded: false,
    integration: 90,
    rx: 7,
    mood: 'ok',
    fineSlump: 0,
  };
}

function getBenchmarkMatchContext() {
  const Eng = window.LFEngine;
  if (!Eng || !Eng.tactics || typeof Eng.tactics.evaluateSquadImpact !== 'function') return null;
  const fx0 = (D.upcoming && D.upcoming[0]) || null;
  const simList = Array.isArray(D.simOpponents) ? D.simOpponents : [];
  const strongestOpp = [...simList].sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))[0] || null;

  const buildOppPow = oppObj => {
    const xiArr = (Array.isArray(oppObj.xiLite) && oppObj.xiLite.length)
      ? oppObj.xiLite.map(row => ({ player: { pos: row[0] || 'MC', s1: row[1] || '', s2: row[2] || '', force: row[3] || 38 } }))
      : (oppObj.stars || []).map(s => ({ player: { pos: s.pos || 'MC', s1: s.s1 || '', s2: s.s2 || '', force: s.force || 38 } }));
    const oppXi = {
      formation: oppObj.formation || '4-4-2',
      avgScore: Number(oppObj.avgScore || 38),
      sectors: oppObj.sectors || { GK: 38, DEF: 38, MID: 38, ATK: 38 },
      xi: xiArr,
    };
    return Eng.tactics.computeEngineSectorPower(oppXi, oppXi.formation, {
      isHome: false, crowdOver70: true, style: 'Balanced', marking: 'Heavy',
    });
  };

  let oppName = fx0 ? fx0.oppName : 'Rival Setara';
  let isHome = fx0 ? Boolean(fx0.isHome) : true;
  let neutral = fx0 ? Boolean(fx0.neutral) : false;
  let oppStyle = (fx0 && fx0.aiStyle) || 'Balanced';
  let oppFocus = (fx0 && fx0.aiFocus) || 'Center';
  let oppPow = fx0 && fx0.matchup && fx0.matchup.oppPow;

  if (cartBenchOppId === 'STRONGEST_RIVAL' && strongestOpp) {
    oppName = strongestOpp.name;
    isHome = false;
    neutral = false;
    oppStyle = 'Balanced';
    oppFocus = 'Center';
    oppPow = buildOppPow(strongestOpp);
  } else if (cartBenchOppId !== 'AUTO_NEXT') {
    const picked = simList.find(o => o.id === cartBenchOppId);
    if (picked) {
      oppName = picked.name;
      isHome = true;
      neutral = false;
      oppStyle = 'Balanced';
      oppFocus = 'Center';
      oppPow = buildOppPow(picked);
    }
  }

  const cacheKey = `${(D.meta && D.meta.currentDate) || ''}_${cartBenchOppId}_${oppName}_${(D.roster || []).length}`;
  if (D._benchImpactCache && D._benchImpactCache.key === cacheKey) {
    return D._benchImpactCache.ctx;
  }

  if (!oppPow) {
    const avg = Number((D.bestXi && D.bestXi.avgScore) || 35);
    oppPow = { GK: avg, DEF: avg * 0.75, MID: avg * 0.85, ATK: avg * 0.75, atkCenter: avg * 0.77, atkWings: avg * 0.75, shooterVal: avg };
  }
  const opts = {
    isHome,
    neutral,
    oppStyle,
    oppFocus,
    foreignCap: (D.meta && D.meta.foreignCap) || 7,
    userCountry: (D.meta && D.meta.country) || '',
    repLevel: (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3,
    activeFormationRaw: (D.meta && D.meta.activeFormationRaw) || null,
  };
  const base = Eng.tactics.evaluateSquadImpact(D.roster || [], oppPow, opts);

  let topRival = null;
  if (strongestOpp && strongestOpp.name !== oppName) {
    const rPow = buildOppPow(strongestOpp);
    const rOpts = { ...opts, isHome: false, oppStyle: 'Balanced', oppFocus: 'Center' };
    const rBase = Eng.tactics.evaluateSquadImpact(D.roster || [], rPow, rOpts);
    if (rBase) {
      topRival = { name: strongestOpp.name, oppPow: rPow, opts: rOpts, base: rBase };
    }
  }

  const ctx = { oppName, isHome, neutral, oppPow, opts, base, fx: fx0, topRival };
  D._benchImpactCache = { key: cacheKey, ctx };
  return ctx;
}

function getScoutWinImpact(it, ctx, fastForms) {
  if (!ctx || !ctx.base || !it || !it.r) return null;
  const Eng = window.LFEngine;
  if (!Eng || !Eng.tactics || typeof Eng.tactics.evaluateSquadImpact !== 'function') return null;
  const pid = it.r[19];
  const dropId = it.swap ? it.swap.p.id : '';
  const cKey = `${ctx.oppName}|${(D.meta && D.meta.currentDate) || ''}|${pid}|${dropId}`;
  if (!D._scoutWinCache) D._scoutWinCache = new Map();
  if (D._scoutWinCache.has(cKey)) return D._scoutWinCache.get(cKey);

  const simR = (D.roster || []).filter(p => !cartOut[p.id] && p.id !== dropId);
  simR.push(scoutRowToSimPlayer(it.r));
  const aft = Eng.tactics.evaluateSquadImpact(simR, ctx.oppPow, { ...ctx.opts, formations: fastForms });
  if (!aft) {
    D._scoutWinCache.set(cKey, null);
    return null;
  }
  const dWin = +(aft.winPct - ctx.base.winPct).toFixed(1);
  const dXPts = +(aft.xPts - ctx.base.xPts).toFixed(3);
  const effCost = it.isBosman ? 0 : Math.max(0, it.netCostIfSwap);
  const winPerM = effCost > 0 ? +(dWin / (effCost / 1e6)).toFixed(2) : (dWin > 0 ? 999 : 0);
  const res = { dWin, dXPts, effCost, winPerM, form: aft.formation, winPct: aft.winPct };
  D._scoutWinCache.set(cKey, res);
  return res;
}

function getCartMetrics() {
  let cashIn = 0, cashOut = 0, salDelta = 0, fDelta = 0;
  const hc = D.meta.country;
  D.roster.forEach(p => {
    const sel = cartOut[p.id];
    if (!sel) return;
    cashIn += sel.arab ? p.estArabLow : p.estRealSale;
    salDelta -= p.salary;
    if (hc && p.nationality && p.nationality !== hc) fDelta -= 1;
  });
  const inList = Object.values(cartIn || {});
  inList.forEach(r => {
    cashOut += getEffectiveBuyCost(r);
    salDelta += Math.round(r[12] * 0.95);
    if (hc && r[4] && r[4] !== hc) fDelta += 1;
  });
  const bInList = Object.values(cartBIn || {});
  bInList.forEach(p => {
    salDelta += (p.salary || 0);
    if (hc && p.nationality && p.nationality !== hc) fDelta += 1;
  });
  const curForeign = D.roster.filter(p => hc && p.nationality && p.nationality !== hc).length;
  const projForeign = curForeign + fDelta;
  const projBudget = D.meta.budget + cashIn - cashOut;
  const buyingPower = D.meta.budget + cashIn;
  const outCount = Object.keys(cartOut).length;
  const inCount = inList.length + bInList.length;
  return {
    cashIn, cashOut, salDelta, fDelta, curForeign, projForeign, projBudget, buyingPower,
    inList, bInList, outCount, inCount, scoutInCount: inList.length, bInCount: bInList.length,
  };
}

let _rosterCacheRef = null;
let _rosterByPosCache = null;
let _rosterByCatCache = null;

function ensureRosterIndex() {
  if (_rosterCacheRef === D.roster && _rosterByPosCache) return;
  _rosterCacheRef = D.roster;
  _rosterByPosCache = {};
  _rosterByCatCache = {};
  (D.roster || []).forEach(p => {
    (_rosterByPosCache[p.pos] = _rosterByPosCache[p.pos] || []).push(p);
    const c = EXACT_CAT[p.pos] ?? 3;
    (_rosterByCatCache[c] = _rosterByCatCache[c] || []).push(p);
  });
}

function findBestReplacement(r, cm) {
  if (!D.roster || !D.roster.length) return null;
  ensureRosterIndex();
  const tPos = r[1], tFoot = r[3], tNat = r[4];
  const tCat = EXACT_CAT[tPos] ?? 3;
  const tEff = r[5] * (1 + (r[10] || 0) / 100);
  const hc = D.meta.country;
  const tIsForeign = Boolean(hc && tNat && tNat !== hc);
  const foreignTight = cm.projForeign >= D.meta.foreignCap;
  const prefFoot = SLOT_FOOT_PREF[tPos];

  let pool = _rosterByPosCache[tPos] || [];
  let matchKind = 'EXACT';
  if (!pool.length) {
    pool = _rosterByCatCache[tCat] || [];
    matchKind = 'CAT';
  }
  if (!pool.length) return null;

  let best = null;
  pool.forEach(p => {
    const pEff = (p.force || 0) * (1 + (p.stackPct || 0) / 100);
    const pWrongFoot = Boolean(prefFoot && p.foot && p.foot !== prefFoot && (p.foot === 'D' || p.foot === 'E'));
    const pIsForeign = Boolean(hc && p.nationality && p.nationality !== hc);
    const effGain = tEff - (pWrongFoot ? pEff * 0.95 : pEff);

    let replaceScore = effGain * 3.0;
    if (p.age >= p.sellWarnAge || p.isDeclining) replaceScore += 12;
    if (pWrongFoot && (!prefFoot || tFoot === prefFoot)) replaceScore += 10;
    if (p.nonStack && r[11] === 0) replaceScore += 6;
    if (p.forSale && !p.injured) replaceScore += 10;
    if (p.squadRank >= 15 && p.age >= 24) replaceScore += 5;
    if (tIsForeign && foreignTight && pIsForeign) replaceScore += 14;
    if (p.isGem && p.age <= 20) replaceScore -= 12;
    if (p.injured) replaceScore -= 4;

    if (!best || replaceScore > best.replaceScore) {
      const repSale = p.injured ? 0 : p.estRealSale;
      const sal3y = Math.round(r[12] * 0.95);
      const reasons = [];
      if (matchKind === 'CAT' && D.holePositions.includes(tPos)) reasons.push(`Tambal lubang ${fmtPos(tPos)}`);
      if (pWrongFoot && (!prefFoot || tFoot === prefFoot)) reasons.push('Hapus penalti salah kaki -5%');
      if (p.age >= p.sellWarnAge || p.isDeclining) reasons.push(`Regenerasi veteran (${p.age}th)`);
      if (effGain >= 2.0) reasons.push(`Upgrade +${effGain.toFixed(1)} Eff`);
      if (sal3y < p.salary) reasons.push(`Hemat gaji -${fmtM(p.salary - sal3y)}/bln`);
      if (tIsForeign && pIsForeign) reasons.push('Tukar slot asing 1-for-1');
      if (p.injured) reasons.push('⚠ Sedang cedera (tunggu sembuh baru jual)');
      best = {
        p, matchKind, replaceScore,
        deltaForce: r[5] - p.force,
        deltaEff: +effGain.toFixed(1),
        deltaCap: r[7] - p.potCap,
        repSale,
        netCost: r[14] - repSale,
        deltaSal: sal3y - p.salary,
        reason: reasons.slice(0, 2).join(' · ') || 'Peremajaan / kedalaman skuad',
      };
    }
  });
  return best;
}

function enrichScoutRow(r, cm) {
  const flags = r[18] || '';
  const isBosman = isBosmanTarget(r);
  const estBuy = r[14];
  const sal3y = Math.round(r[12] * 0.95);
  const estResale = r[21] || Math.round(r[13] * 1.25);
  const projGain = r[22] || 0;
  const estProfit = estResale - estBuy;
  const costBasis = Math.max(estBuy, sal3y * 12, 120000);
  const roiPct = Math.round((estProfit / costBasis) * 100);
  const fillsHole = (D.holePositions || []).includes(r[1]);
  const hc = D.meta.country;
  const isForeign = Boolean(hc && r[4] && r[4] !== hc);
  const swap = findBestReplacement(r, cm);

  const remCash = cm.projBudget;
  const netCostIfSwap = swap ? swap.netCost : estBuy;
  const dp25 = isBosman ? 0 : Math.round(estBuy * 0.25);
  const ecoPlanFn = (window.LFEngine && window.LFEngine.economy && window.LFEngine.economy.computeInstallmentPlan);
  const inst12 = isBosman ? 0 : (ecoPlanFn ? ecoPlanFn(estBuy, 12).monthly : Math.round((estBuy - dp25) * 1.08 / 12));
  const inst24 = isBosman ? 0 : (ecoPlanFn ? ecoPlanFn(estBuy, 24).monthly : Math.round((estBuy - dp25) * 1.18 / 24));
  const instCap = Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 0.30));

  let affordCode = 'EXP';
  // Target BOSMAN selalu bisa direkrut 0€ lewat Pra-Kontrak!
  if (isBosman) affordCode = 'BOSMAN';
  else if (estBuy <= remCash) affordCode = 'CASH';
  else if (swap && !swap.p.injured && !cartOut[swap.p.id] && netCostIfSwap <= remCash) affordCode = 'SWAP';
  else if (dp25 <= remCash && inst24 <= instCap) affordCode = 'INST';

  const dEff = swap ? swap.deltaEff : (r[5] - D.bestXi.avgScore);
  const effCostForScore = isBosman ? 0 : Math.max(0, netCostIfSwap);
  const costPen = effCostForScore / 2_500_000;
  let upgradeScore = dEff * 5.0 + (fillsHole ? 16 : 0) + r[10] * 1.2 + Math.min(12, (r[7] - r[5]) * 1.1) - costPen * 2.5;
  if (r[11] === 1) upgradeScore -= 8;
  if (flags.includes('TRAP')) upgradeScore -= 14;
  if (flags.includes('INJ')) upgradeScore -= 12;
  if (flags.includes('SCARCE')) upgradeScore -= 4;
  if (isForeign && cm.projForeign >= D.meta.foreignCap && !(swap && hc && swap.p.nationality !== hc)) upgradeScore -= 10;
  if (affordCode === 'EXP') upgradeScore -= 18;

  const smartScore = +(upgradeScore * 0.65 + Math.min(45, Math.max(-20, roiPct * 0.12)) + r[17] * 0.35).toFixed(1);

  return {
    r, flags, isBosman, estBuy, sal3y, estResale, projGain, estProfit, roiPct,
    fillsHole, isForeign, swap, affordCode, netCostIfSwap, dp25, inst12, inst24, instCap,
    upgradeScore: +upgradeScore.toFixed(1),
    smartScore,
  };
}

function renderCompactScoutBadges(flagsStr, fillsHole) {
  const all = flagsStr ? flagsStr.split(',').filter(Boolean) : [];
  const primaryOrder = ['FREE', 'BOSMAN', 'UNH', 'PERSUADE', 'YSCOUT', 'REFUSE_DIST', 'REFUSE_LVL', 'KEY_LOCK', 'CEIL_2X', 'SCARCE', 'TRAP', 'GEM', 'INJ', 'INJ_DISC'];
  const primary = [];
  if (fillsHole) primary.push({ k: 'LUBANG', cls: 'b-warn', tip: 'Mengisi lubang posisi di skuad senior' });
  primaryOrder.forEach(k => {
    if (all.includes(k) && primary.length < 3) {
      let cls = 'b-good';
      if (['SCARCE', 'TRAP', 'INJ', 'REFUSE_DIST', 'REFUSE_LVL', 'KEY_LOCK', 'REFUSE'].includes(k)) cls = 'b-crit';
      else if (['PERSUADE', 'CEIL_2X'].includes(k)) cls = 'b-warn';
      else if (['YSCOUT', 'INJ_DISC'].includes(k)) cls = 'b-info';
      primary.push({ k, cls, tip: tipFor(k) });
    }
  });
  const used = new Set(primary.map(x => x.k));
  const secondary = all.filter(k => !used.has(k));

  const primHtml = primary.map(x => `<span class="badge ${x.cls}" title="${esc(x.tip)}">${x.k}</span>`).join(' ');
  const secHtml = secondary.length
    ? `<span class="micro-tags">${secondary.map(k => `<span class="micro-tag" title="${esc(tipFor(k))}">${k}</span>`).join('')}</span>`
    : '';
  return primHtml + secHtml;
}

function setBlueprintTab(tab) {
  scoutBlueprintTab = tab;
  ['UPGRADE', 'ROI', 'BARGAIN', 'SELL'].forEach(t => {
    const btn = document.getElementById('bp-tab-' + t);
    if (btn) btn.className = (scoutBlueprintTab === t) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  renderScoutBlueprint();
}

function renderDealCard(it, badgeTitle, badgeCls) {
  const r = it.r;
  const sw = it.swap;
  const pid = r[19];
  const inC = !!cartIn[pid];
  const isBosFree = Boolean(inC && cartInBosman[pid]);
  const pinned = isShortlisted(pid);

  let affordBadge = '<span class="badge b-crit">✗ BUTUH JUAL</span>';
  if (inC) affordBadge = `<span class="badge b-good">${isBosFree ? '✓ BOSMAN 0€' : '✓ DI CART BELI'}</span>`;
  else if (it.affordCode === 'BOSMAN') affordBadge = '<span class="badge b-good">🆓 0€ PRA-KONTRAK</span>';
  else if (it.affordCode === 'CASH') affordBadge = '<span class="badge b-good">✓ KAS CUKUP</span>';
  else if (it.affordCode === 'SWAP') affordBadge = '<span class="badge b-info">⇄ CUKUP + SWAP</span>';

  const swHtml = sw ? `
    <div class="deal-swap-box">
      <div class="flex-between">
        <span>⇄ <b>Gantikan:</b> <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(sw.p.id)}')">${esc(sw.p.name)}</a> <span class="c-muted">(${fmtPos(sw.p.pos)} ${sw.p.age}th • F${sw.p.force})</span></span>
        <span class="mono ${sw.deltaEff >= 0 ? 'c-green' : 'c-amber'}"><b>${sw.deltaEff >= 0 ? '+' : ''}${sw.deltaEff} Eff</b></span>
      </div>
      <div class="c-muted" style="margin-top:2px">${esc(sw.reason)} • Jual: <b class="mono">${sw.repSale ? fmtM(sw.repSale) : '0 (Cedera)'}</b> • ΔGaji: <b class="mono ${sw.deltaSal <= 0 ? 'c-green' : 'c-amber'}">${sw.deltaSal >= 0 ? '+' : ''}${fmtM(sw.deltaSal)}</b></div>
    </div>` : `<div class="deal-swap-box c-muted">Tambahan kedalaman skuad (belum ada pemain seposisi untuk diganti).</div>`;

  const pidJs = escJs(pid);
  const repIdJs = sw ? escJs(sw.p.id) : '';
  const buyDisplay = it.isBosman
    ? `<span class="c-green">0€*</span> <span class="c-muted" style="font-size:10px">(tebus ${fmtM(it.estBuy)})</span>`
    : `<span class="c-amber">${fmtM(it.estBuy)}</span>`;

  return `<div class="deal-card ${it.affordCode !== 'EXP' ? 'afford' : ''} ${inC ? 'in-cart' : ''}">
    <div>
      <div class="flex-between mb-8">
        <span class="badge ${badgeCls}">${esc(badgeTitle)}</span>
        <div style="display:flex;gap:5px;align-items:center">
          ${affordBadge}
          <button type="button" class="star-btn ${pinned ? 'pinned' : ''}" title="${pinned ? 'Hapus dari Shortlist' : 'Simpan ke Shortlist'}" onclick="toggleShortlist('${pidJs}')">${pinned ? '★' : '☆'}</button>
        </div>
      </div>
      <div style="font-size:14px;font-weight:800"><a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')">${esc(r[0])}</a> ${r[20] === 2 ? '👑' : (r[20] === 1 ? '⭐' : '')} <span class="c-muted" style="font-size:11px">(${r[4]} • ${esc(r[16])})</span></div>
      <div class="mono" style="font-size:11px;margin:4px 0">
        <b>${fmtPos(r[1])}</b> • ${r[2]}th • Kaki <b>${fmtFoot(r[3])}</b> • Force <b>${r[5]}→<span class="c-green">${r[7]}</span></b> • Skill <span class="${r[11] ? 'c-red' : 'c-sky'}">${fmtSkills(r[8], r[9])} (+${r[10]}%)</span>
      </div>
      <div class="pill-row" style="margin-bottom:6px">${renderCompactScoutBadges(it.flags, it.fillsHole)}</div>
      ${swHtml}
    </div>
    <div>
      <div class="deal-metrics">
        <div><div class="c-muted" style="font-size:10px">${it.isBosman ? 'Bosman / Tebus' : 'Est. Beli'}</div><div class="mono"><b>${buyDisplay}</b></div></div>
        <div><div class="c-muted" style="font-size:10px">Net Kas (Swap)</div><div class="mono ${it.netCostIfSwap <= 0 ? 'c-green' : 'c-sky'}"><b>${it.netCostIfSwap <= 0 ? '+' + fmtM(-it.netCostIfSwap) : '-' + fmtM(it.netCostIfSwap)}</b></div></div>
        <div><div class="c-muted" style="font-size:10px">Flip ROI (1–2M)</div><div class="mono ${it.estProfit > 0 ? 'c-green' : 'c-muted'}"><b>${it.estProfit >= 0 ? '+' : ''}${fmtM(it.estProfit)} (${it.roiPct}%)</b></div></div>
      </div>
      <div class="flex-between" style="margin-top:8px">
        ${it.isBosman
          ? `<button type="button" class="btn btn-sm ${isBosFree ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartIn('${pidJs}', true)">${isBosFree ? '✓ Bosman 0€ (Batal)' : '🆓 + Bosman (0€)'}</button>`
          : `<button type="button" class="btn btn-sm ${inC ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartIn('${pidJs}', false)">${inC ? '✓ Di Cart (Batal)' : '+ Beli Saja'}</button>`}
        ${sw ? `<button type="button" class="btn btn-sm" style="flex:1;border-color:rgba(56,189,248,.6)" onclick="swapToCart('${pidJs}','${repIdJs}', ${it.isBosman ? 'true' : 'false'})">⇄ Pasang Swap</button>` : ''}
      </div>
    </div>
  </div>`;
}

let bargainOriginFilter = 'ALL'; // 'ALL' | 'LOCAL' | 'FOREIGN'

function setBargainOrigin(mode) {
  bargainOriginFilter = (mode === 'LOCAL' || mode === 'FOREIGN') ? mode : 'ALL';
  renderScoutBlueprint();
}

function renderScoutBlueprint() {
  const cm = getCartMetrics();
  const sellable = D.roster.filter(isRecommendedSell);
  const potentialSellCash = sellable.reduce((s, p) => s + p.estRealSale, 0);

  const cf = D.cashflow || {};
  const ecoRoomFn = window.LFEngine && window.LFEngine.economy && window.LFEngine.economy.computeTransferDebtRoom;
  const fallbackRoom = ecoRoomFn
    ? ecoRoomFn((D.meta && D.meta.payroll) || 0, cf.transferDebtTotal || 0)
    : { cap: Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 12 * 0.30)), used: cf.transferDebtTotal || 0, room: Math.max(0, Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 12 * 0.30)) - (cf.transferDebtTotal || 0)), maxBuy24: 0 };
  const debtCap = cf.transferDebtCap ?? fallbackRoom.cap;
  const debtUsed = cf.transferDebtTotal ?? fallbackRoom.used;
  const debtRoom = cf.transferDebtRoom ?? fallbackRoom.room;
  const debtMaxBuy24 = cf.transferDebtMaxBuy24 ?? fallbackRoom.maxBuy24;
  const debtBanned = Boolean(cf.transferBanned || (D.meta && D.meta.transferBanned));
  const debtCls = debtBanned ? 'c-red' : (debtRoom <= 0 ? 'c-red' : (debtRoom < debtCap * 0.3 ? 'c-amber' : 'c-green'));

  const cartBadge = document.getElementById('t4-cart-cnt');
  if (cartBadge) cartBadge.textContent = String(cm.outCount + cm.inCount);

  document.getElementById('t7-budget-strip').innerHTML = `
    <div class="bstrip-desk">
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:12px">
        <div><span class="kpi-lbl">Kas Awal</span><div class="mono" style="font-size:16px;font-weight:800">${fmtM(D.meta.budget)}</div></div>
        <div><span class="kpi-lbl">Cart Jual</span><div class="mono c-green" style="font-size:16px;font-weight:800">+${fmtM(cm.cashIn)}</div></div>
        <div><span class="kpi-lbl">Cart Beli</span><div class="mono c-amber" style="font-size:16px;font-weight:800">-${fmtM(cm.cashOut)}</div></div>
        <div><span class="kpi-lbl">Sisa Daya Beli</span><div class="mono ${cm.projBudget >= 0 ? 'c-green' : 'c-red'}" style="font-size:18px;font-weight:900">${fmtM(cm.projBudget)}</div></div>
        <div><span class="kpi-lbl">Kuota Asing</span><div class="mono ${cm.projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky'}" style="font-size:16px;font-weight:800">${cm.projForeign}/${D.meta.foreignCap}</div></div>
        <div id="t7-debt-room-badge" title="Plafon Utang Cicilan OTA (#21652/#21653): max(500K, 30% gaji tahunan). Terpakai ${fmtM(debtUsed)} dari ${fmtM(debtCap)}. Maks harga beli cicil 24b: ${fmtM(debtMaxBuy24)}.">
          <span class="kpi-lbl">Sisa Plafon Cicilan</span>
          <div class="mono ${debtCls}" style="font-size:16px;font-weight:800">${debtBanned ? '⛔ BAN' : fmtM(debtRoom)} <span class="c-muted" style="font-size:11px;font-weight:600">/ ${fmtM(debtCap)}</span></div>
        </div>
      </div>
      <div class="pill-row" style="margin:0">
        <button type="button" class="btn btn-sm btn-amber" onclick="selectAllRecommendedSells()">⚡ Pilih ${sellable.length} Layak Jual (+${fmtM(potentialSellCash)})</button>
        <button type="button" class="btn btn-sm" onclick="clearCart()">🔄 Reset</button>
      </div>
    </div>
    <div class="bstrip-mob">
      <div class="mono" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        💰 <b class="${cm.projBudget >= 0 ? 'c-green' : 'c-red'}" style="font-size:13px">${fmtM(cm.projBudget)}</b>
        <span class="c-muted"> · Asing <b class="${cm.projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky'}">${cm.projForeign}/${D.meta.foreignCap}</b> · 💳 <b class="${debtCls}">${debtBanned ? 'BAN' : fmtM(debtRoom)}</b></span>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        <button type="button" class="btn btn-sm btn-amber" onclick="selectAllRecommendedSells()">⚡ Jual (${sellable.length})</button>
        <button type="button" class="btn btn-sm" onclick="clearCart()" title="Reset Keranjang">🔄</button>
      </div>
    </div>`;

  const box = document.getElementById('t7-blueprint');
  if (scoutBlueprintTab === 'SELL') {
    const rows = sellable.sort((a, b) => b.estRealSale - a.estRealSale);
    const injuredSale = D.roster.filter(p => p.injured && p.forSale);
    box.innerHTML = `
      ${injuredSale.length ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">INJURED_SALE</span><div><b>Tarik dari bursa jual:</b> ${injuredSale.map(p => esc(p.name)).join(', ')} — sedang cedera, jual sekarang kena potongan valuasi!</div></div>` : ''}
      <div class="kpi-sub mb-8">Pemain sehat yang direkomendasikan dijual. Lihat kolom <b>Peminat</b> (estimasi klub AI mampu beli) atau klik nama untuk kalkulator Counter +40%!</div>
      <div class="tbl-wrap tbl-sticky"><table><thead><tr><th>Pemain &amp; Alasan</th><th>Peminat</th><th>Jual</th><th>Arab 2.5x</th><th>Est. Cair (1.25x)</th><th>Pos/Usia</th><th>F/Cap</th><th>Gaji/Bln</th></tr></thead><tbody>` +
      (rows.length ? rows.map(p => {
        const sel = cartOut[p.id];
        const pidJs = escJs(p.id);
        const demBadge = typeof buyerDemandBadgeHtml === 'function' ? buyerDemandBadgeHtml(p, true) : '';
        return `<tr>
          <td>
            <div><a class="clickable-name" onclick="openPlayerDrawer('roster','${pidJs}')"><b>${esc(p.name)}</b></a></div>
            <div class="inline-sticky-meta">
              <span class="badge b-warn">${esc(p.action)}</span>
              ${demBadge}
              <span class="mono c-green" style="font-size:10px"><b>+${fmtM(sel && sel.arab ? p.estArabLow : p.estRealSale)}</b></span>
            </div>
          </td>
          <td>${typeof buyerDemandBadgeHtml === 'function' ? buyerDemandBadgeHtml(p, false) : '-'}</td>
          <td><input type="checkbox" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer" ${sel ? 'checked' : ''} onchange="toggleCartOut('${pidJs}')" /></td>
          <td>${p.isTop5Arab ? `<button type="button" class="btn btn-sm ${sel && sel.arab ? 'btn-amber' : ''}" onclick="toggleCartArab('${pidJs}')">${fmtM(p.estArabLow)}</button>` : '<span class="c-muted">-</span>'}</td>
          <td class="mono c-green"><b>+${fmtM(p.estRealSale)}</b> <span class="c-muted" style="font-size:10px">(Ctr ${fmtM(p.estCounter40)})</span></td>
          <td class="mono">${fmtPos(p.pos)} • ${p.age}th (@${p.declineAge})</td>
          <td class="mono">${p.force}/${p.potCap}</td>
          <td class="mono">${fmtM(p.salary)}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="8" class="c-green">Skuad sangat ramping — tidak ada deadwood mendesak untuk dijual!</td></tr>') + `</tbody></table></div>`;
    return;
  }

  // v8.3: Saring target yang menolak pindah (#23840 refusesDistance / #23919 KEY_LOCK) dari Belanja Pintar!
  const cleanPool = D.scoutPool
    .filter(r => !(r[18] || '').includes('TRAP') && !(r[18] || '').includes('INJ') && !isBlockedTransfer(r))
    .map(r => enrichScoutRow(r, cm));

  let picks = [];
  let moneyballHtml = '';
  if (scoutBlueprintTab === 'UPGRADE') {
    // Moneyball Upgrade Finder (#21822 + #48031): cari sektor terlemah & ukur Win% gain per Euro!
    const ctx = getBenchmarkMatchContext();
    if (ctx && ctx.base) {
      const bPow = ctx.base.uPow;
      const oPow = ctx.oppPow;
      const secMargins = [
        { sec: 'ATK', label: 'Serang (ATK)', diff: +(bPow.ATK - oPow.ATK).toFixed(1), poses: new Set(['ATA', 'A', 'SA', 'PD', 'PE']) },
        { sec: 'MID', label: 'Tengah (MID)', diff: +(bPow.MID - oPow.MID).toFixed(1), poses: new Set(['VOL', 'V', 'MC', 'MD', 'ME', 'MA', 'MO', 'MEI']) },
        { sec: 'DEF', label: 'Belakang (DEF)', diff: +(bPow.DEF - oPow.DEF).toFixed(1), poses: new Set(['LD', 'LE', 'LAT', 'ZD', 'ZE', 'ZAG', 'Z']) },
        { sec: 'GK',  label: 'Kiper (GK)',   diff: +(bPow.GK - oPow.GK).toFixed(1),   poses: new Set(['G']) },
      ].sort((a, b) => a.diff - b.diff);

      const weakest = secMargins[0];
      const weakPosSet = new Set([
        ...secMargins[0].poses,
        ...(secMargins[1].diff < 2 ? secMargins[1].poses : []),
      ]);
      const hc = D.meta.country;
      const foreignFull = cm.projForeign >= D.meta.foreignCap;
      const mbPool = cleanPool
        .filter(x => {
          if (x.affordCode === 'EXP' && !cartIn[x.r[19]]) return false;
          if (!weakPosSet.has(x.r[1])) return false;
          if (x.isForeign && foreignFull && !(x.swap && hc && x.swap.p.nationality !== hc)) return false;
          return x.fillsHole || (x.swap && x.swap.deltaEff >= 0.5);
        })
        .sort((a, b) => b.upgradeScore - a.upgradeScore)
        .slice(0, 15);

      const fastForms = Array.from(new Set([ctx.base.formation, '3-5-2', '4-2-3-1', '4-3-3', '4-4-2']))
        .filter(fk => D.formations && (fk in D.formations));
      const mbResults = [];
      const Eng = window.LFEngine;
      for (const cand of mbPool) {
        const dropId = cand.swap ? cand.swap.p.id : null;
        const simR = (D.roster || []).filter(p => !cartOut[p.id] && p.id !== dropId);
        simR.push(scoutRowToSimPlayer(cand.r));
        const aft = Eng.tactics.evaluateSquadImpact(simR, ctx.oppPow, { ...ctx.opts, formations: fastForms });
        if (!aft) continue;
        const dWin = +(aft.winPct - ctx.base.winPct).toFixed(1);
        const dXPts = +(aft.xPts - ctx.base.xPts).toFixed(3);
        const effCost = cand.isBosman ? 0 : Math.max(0, cand.netCostIfSwap);
        const winPerM = effCost > 0 ? +(dWin / (effCost / 1e6)).toFixed(2) : (dWin > 0 ? 999 : 0);
        if (dXPts > 0.002) {
          mbResults.push({ cand, aft, dWin, dXPts, effCost, winPerM });
        }
      }
      mbResults.sort((a, b) => (b.dXPts - a.dXPts) || (b.winPerM - a.winPerM));
      const top3Mb = mbResults.slice(0, 3);
      if (top3Mb.length) {
        const mbCards = top3Mb.map(m => {
          const effTag = m.effCost === 0 ? '0€ BOSMAN' : (m.winPerM > 0 ? `+${m.winPerM}%/M` : fmtM(m.effCost));
          return renderDealCard(m.cand, `💎 +${m.dWin}% WIN (${effTag})`, 'b-accent');
        }).join('');
        moneyballHtml = `
          <div style="margin-bottom:14px;padding:10px 11px;background:var(--bg2);border:1px solid rgba(168,85,247,.4);border-radius:11px">
            <div class="flex-between mb-8" style="gap:8px;flex-wrap:wrap">
              <div>
                <span class="badge b-accent">💎 MONEYBALL UPGRADE FINDER</span>
                <b style="margin-left:6px">Sektor Terlemah vs ${esc(ctx.oppName)}: <span class="c-amber">${esc(weakest.label)} (${weakest.diff >= 0 ? '+' : ''}${weakest.diff})</span></b>
              </div>
              <span class="c-muted mono" style="font-size:10.5px">Baseline ${fmtForm(ctx.base.formation)} · ${ctx.base.winPct}% Win · xPts ${ctx.base.xPts}</span>
            </div>
            <div class="deal-grid">${mbCards}</div>
          </div>`;
      }
    }

    const ranked = cleanPool
      .filter(x => (x.affordCode !== 'EXP' || cartIn[x.r[19]]) && (x.fillsHole || (x.swap && x.swap.deltaEff >= 1.0)))
      .sort((a, b) => b.upgradeScore - a.upgradeScore);
    const posCnt = {};
    for (const x of ranked) {
      if ((posCnt[x.r[1]] || 0) >= 2) continue;
      posCnt[x.r[1]] = (posCnt[x.r[1]] || 0) + 1;
      picks.push({ it: x, lbl: x.fillsHole ? `TAMBAL LUBANG ${fmtPos(x.r[1])}` : `UPGRADE ${fmtPos(x.r[1])}`, cls: x.fillsHole ? 'b-warn' : 'b-good' });
      if (picks.length >= 6) break;
    }
  } else if (scoutBlueprintTab === 'ROI') {
    const ranked = cleanPool
      .filter(x => (x.affordCode !== 'EXP' || cartIn[x.r[19]]) && x.r[2] <= 21 && x.r[11] === 0 && x.estProfit > 0)
      .sort((a, b) => (b.roiPct * 0.6 + (b.estProfit / 100000) * 1.8) - (a.roiPct * 0.6 + (a.estProfit / 100000) * 1.8));
    for (const x of ranked.slice(0, 6)) {
      picks.push({ it: x, lbl: `FLIP ROI +${x.roiPct}%`, cls: 'b-accent' });
    }
  } else if (scoutBlueprintTab === 'BARGAIN') {
    const bargainAll = cleanPool
      .filter(x => (x.affordCode !== 'EXP' || cartIn[x.r[19]]) && (x.flags.includes('FREE') || x.isBosman || x.flags.includes('UNH')))
      .sort((a, b) => b.smartScore - a.smartScore);
    const locCnt = bargainAll.filter(x => !x.isForeign).length;
    const forCnt = bargainAll.filter(x => x.isForeign).length;
    moneyballHtml = `
      <div id="t7-bargain-origin-bar" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <button type="button" class="btn btn-sm ${bargainOriginFilter === 'ALL' ? 'btn-green' : ''}" onclick="setBargainOrigin('ALL')">Semua (${bargainAll.length})</button>
        <button type="button" class="btn btn-sm ${bargainOriginFilter === 'LOCAL' ? 'btn-green' : ''}" onclick="setBargainOrigin('LOCAL')">🏠 Lokal Bebas Kuota (${locCnt})</button>
        <button type="button" class="btn btn-sm ${bargainOriginFilter === 'FOREIGN' ? 'btn-amber' : ''}" onclick="setBargainOrigin('FOREIGN')">🌐 Asing (${forCnt})</button>
        <span class="c-muted" style="font-size:11px">Target yang menolak pindah otomatis disembunyikan.</span>
      </div>`;
    const ranked = bargainAll.filter(x =>
      bargainOriginFilter === 'LOCAL' ? !x.isForeign : (bargainOriginFilter === 'FOREIGN' ? x.isForeign : true)
    );
    for (const x of ranked.slice(0, 8)) {
      const tag = x.flags.includes('FREE') ? 'FREE AGENT (0€)' : (x.isBosman ? 'BOSMAN 0€ ≤180D' : 'UNHAPPY (-15%)');
      picks.push({ it: x, lbl: tag, cls: 'b-info' });
    }
  }

  // 1) Downgrade Cerdas / Cetak Kas Tanpa Turun Win% + 2) Swap Pemain Non-Stack (0% -> Stack)
  let extraSmartHtml = '';
  if (scoutBlueprintTab === 'UPGRADE') {
    const ctx = getBenchmarkMatchContext();
    const Eng = window.LFEngine;
    const cashPairs = [];
    const sellHigh = (D.roster || [])
      .filter(p => !p.injured && !cartOut[p.id] && p.age >= 25 && (p.estCounter40 || 0) >= 3000000)
      .sort((a, b) => (b.estCounter40 || 0) - (a.estCounter40 || 0))
      .slice(0, 6);
    for (const sp of sellHigh) {
      const sellNet = sp.estCounter40 || sp.marketValue || 0;
      const cands = cleanPool
        .filter(x => x.r[1] === sp.pos && x.r[11] === 0 && x.r[5] >= sp.force - 3 && (x.isBosman ? 0 : x.estBuy) <= sellNet * 0.6)
        .sort((a, b) => (b.r[5] - a.r[5]) || (a.estBuy - b.estBuy))
        .slice(0, 3);
      for (const c of cands) {
        const buyCost = c.isBosman ? 0 : c.estBuy;
        const netCash = sellNet - buyCost;
        if (netCash < 2000000) continue;
        let dWin = 0;
        if (ctx && ctx.base && Eng && Eng.tactics) {
          const simR = (D.roster || []).filter(x => !cartOut[x.id] && x.id !== sp.id).concat([scoutRowToSimPlayer(c.r)]);
          if (simR.length >= 11) {
            const aft = Eng.tactics.evaluateSquadImpact(simR, ctx.oppPow, ctx.opts);
            if (aft) dWin = +(aft.winPct - ctx.base.winPct).toFixed(1);
          }
        }
        if (dWin < -1.0) continue;
        cashPairs.push({ sp, c, netCash, dWin });
      }
    }
    cashPairs.sort((a, b) => (b.dWin - a.dWin) || (b.netCash - a.netCash));
    const topCash = [];
    const usedSell = new Set();
    for (const cp of cashPairs) {
      if (usedSell.has(cp.sp.id)) continue;
      usedSell.add(cp.sp.id);
      topCash.push(cp);
      if (topCash.length >= 3) break;
    }

    const nsPairs = [];
    const nsList = (D.roster || []).filter(p => p.nonStack && !p.injured && !cartOut[p.id]);
    for (const np of nsList) {
      const bestRep = cleanPool
        .filter(x => x.r[1] === np.pos && x.r[11] === 0 && x.r[10] >= 5 && x.r[5] >= np.force - 1 && x.affordCode !== 'EXP')
        .sort((a, b) => (b.r[10] - a.r[10]) || (b.r[5] - a.r[5]) || (a.estBuy - b.estBuy))[0];
      if (bestRep) {
        const net = (np.estDirectSaleNet || np.marketValue || 0) - (bestRep.isBosman ? 0 : bestRep.estBuy);
        nsPairs.push({ np, c: bestRep, net });
      }
    }

    if (topCash.length) {
      const dgOpen = typeof window === 'undefined' || window.innerWidth > 768;
      extraSmartHtml += `<details class="glossary-inline mt-12" ${dgOpen ? 'open' : ''} style="border-color:rgba(16,185,129,.35)">
        <summary style="font-weight:800" class="c-green">💸 Downgrade Cerdas (${topCash.length}): Cetak Kas Besar Tanpa Turun Win%</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-top:8px;font-size:11.5px">
          ${topCash.map(cp => {
            const r = cp.c.r;
            return `<div style="padding:8px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:8px">
              <div class="flex-between" style="gap:6px">
                <div>Jual <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(cp.sp.id)}')"><b>${esc(cp.sp.name)}</b></a> <span class="mono c-muted">(${cp.sp.age}th·F${cp.sp.force})</span></div>
                <span class="badge b-good mono">Net +${fmtM(cp.netCash)}</span>
              </div>
              <div style="margin:4px 0">Beli <a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a> <span class="mono">(${r[2]}th·F${r[5]}→${r[7]}·+${r[10]}%)</span></div>
              <div class="flex-between" style="gap:6px">
                <span class="badge ${cp.dWin >= 0 ? 'b-good' : 'b-warn'} mono">Win ${cp.dWin >= 0 ? '+' : ''}${cp.dWin}%</span>
                <button type="button" class="btn btn-sm btn-green" onclick="swapToCart('${escJs(r[19])}','${escJs(cp.sp.id)}',${cp.c.isBosman ? 'true' : 'false'})">⇄ Eksekusi ke Cart</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </details>`;
    }

    if (nsPairs.length) {
      extraSmartHtml += `<div style="margin-top:10px;padding:10px 11px;background:var(--bg2);border:1px solid rgba(245,158,11,.35);border-radius:11px;font-size:11.5px">
        <div style="font-weight:800;margin-bottom:6px" class="c-amber">⚡ Perbaiki Pemain Non-Stack (0% Bonus → Stack Optimal)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px">
          ${nsPairs.slice(0, 4).map(x => {
            const r = x.c.r;
            return `<div style="padding:8px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:8px">
              <div class="flex-between" style="gap:6px">
                <div>Buang <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(x.np.id)}')"><b>${esc(x.np.name)}</b></a> <span class="badge b-crit">0%</span></div>
                <span class="badge b-good mono">+${r[10]}% Stack</span>
              </div>
              <div style="margin:4px 0">Ganti <a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a> <span class="mono">(F${r[5]}→${r[7]}·${fmtSkills(r[8], r[9])})</span></div>
              <div class="flex-between" style="gap:6px">
                <span class="mono c-muted">Net: <b>${x.net >= 0 ? '+' + fmtM(x.net) : '-' + fmtM(-x.net)}</b></span>
                <button type="button" class="btn btn-sm btn-green" onclick="swapToCart('${escJs(r[19])}','${escJs(x.np.id)}',${x.c.isBosman ? 'true' : 'false'})">⇄ Swap ke Cart</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // 3) Swap & Sell Strategy Planner (Jual mentok/asing kalah pot -> Ganti ke Pot >=60 !REFUSE_DIST)
    const hcSwap = (D.meta && D.meta.country) || '';
    const gkCount = (D.roster || []).filter(p => p.pos === 'G').length;
    const fExcess = Math.max(0, (cm.curForeign || 0) - ((D.meta && D.meta.foreignCap) || 7));
    const sellPlanCands = (D.roster || [])
      .filter(p => !p.injured && !p.loanedFrom && !cartOut[p.id])
      .map(p => {
        const isF = Boolean(hcSwap && p.nationality && p.nationality !== hcSwap);
        const gap = (p.potCap || p.force) - (p.force || 0);
        let prio = 0;
        if (fExcess > 0 && isF && p.potCap < 58) prio += 30 + (58 - p.potCap);
        if (gap <= 3 && (p.marketValue >= 3000000 || p.age >= (p.sellWarnAge || 27))) prio += 20 + (p.marketValue / 2000000);
        if (p.age >= (p.sellWarnAge || 28)) prio += 10;
        if (gap >= 12) prio -= 25;
        return { p, isF, gap, prio };
      })
      .filter(x => x.prio > 12)
      .sort((a, b) => b.prio - a.prio)
      .slice(0, 4);

    const highPotReplacements = cleanPool
      .filter(x => x.r[2] <= 23 && x.r[7] >= 60 && (x.affordCode !== 'EXP' || x.isBosman || fExcess >= 0))
      .sort((a, b) => (b.r[20] === 1 ? 1 : 0) - (a.r[20] === 1 ? 1 : 0) || (b.r[7] - a.r[7]) || (a.estBuy - b.estBuy));

    const usedRepIds = new Set();
    const swapPlanRows = [];
    for (const spItem of sellPlanCands) {
      const p = spItem.p;
      const samePos = highPotReplacements.filter(x => !usedRepIds.has(x.r[19]) && x.r[1] === p.pos).slice(0, 2);
      const reps = samePos.length
        ? samePos
        : highPotReplacements.filter(x => !usedRepIds.has(x.r[19])).slice(0, 2);
      if (!reps.length) continue;
      usedRepIds.add(reps[0].r[19]);
      const mv = Number(p.marketValue) || 0;
      const lockedFree = Boolean(p.freeSigned);
      const lockedGk = p.pos === 'G' && gkCount <= 1;
      let sellAdvice = `Auction <b>${fmtM(mv * 0.55)}–${fmtM(mv * 0.70)}</b> · Fixed <b>${fmtM(mv * 0.70)}</b> <span class="c-muted">(Hindari Sell Now 10–15%)</span>`;
      if (lockedFree) sellAdvice = '<span class="c-amber">⚠ Terkunci freeNoSale (baru rekrut gratis — tunggu masa tunggu)</span>';
      else if (lockedGk) sellAdvice = '<span class="c-amber">⚠ Terkunci squadMinGk (beli kiper cadangan dulu sebelum jual)</span>';
      swapPlanRows.push({ spItem, reps, sellAdvice, locked: lockedFree || lockedGk });
    }

    if (swapPlanRows.length) {
      extraSmartHtml += `<div style="margin-top:10px;padding:10px 11px;background:var(--bg2);border:1px solid rgba(56,189,248,.35);border-radius:11px;font-size:11.5px">
        <div style="font-weight:800;margin-bottom:4px" class="c-sky">🔄 Swap &amp; Sell Strategy Planner (Jual Mentok/Asing → Rekrut Pot ≥60)</div>
        <div class="c-muted" style="font-size:10.5px;margin-bottom:8px">Jual pemain mentok/kelebihan asing via Auction 55–70% atau Fixed 70% MV, lalu tukar 1-klik ke wonderkid bebas Refuse.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:8px">
          ${swapPlanRows.map(({ spItem, reps, sellAdvice, locked }) => {
            const p = spItem.p;
            const topR = reps[0];
            return `<div style="padding:8px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:8px">
              <div class="flex-between" style="gap:6px">
                <div>Jual <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> <span class="mono c-muted">(${fmtPos(p.pos)}·${p.age}th·F${p.force}/${p.potCap})</span>${spItem.isF ? ' <span class="badge b-warn">ASING</span>' : ''}</div>
                <span class="mono c-amber">MV ${fmtM(p.marketValue)}</span>
              </div>
              <div style="font-size:10.5px;margin:3px 0 6px">${sellAdvice}</div>
              ${reps.map(cr => {
                const r = cr.r;
                return `<div class="flex-between" style="gap:5px;padding-top:4px;border-top:1px dashed rgba(255,255,255,.07);margin-top:4px">
                  <div style="min-width:0">
                    <a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a> ${r[20] === 1 ? '⭐' : ''}
                    <span class="mono c-green">(${fmtPos(r[1])}·${r[2]}th·F${r[5]}→<b>Pot ${r[7]}</b>)</span>
                    <div class="c-muted mono" style="font-size:10px">${cr.isBosman ? '🆓 Bosman 0€' : fmtM(cr.estBuy)} · ${esc(r[16])}</div>
                  </div>
                  <button type="button" class="btn btn-sm ${locked ? '' : 'btn-green'}" onclick="swapToCart('${escJs(r[19])}','${escJs(p.id)}',${cr.isBosman ? 'true' : 'false'})">${topR === cr ? '⇄ Swap' : '+Pilih'}</button>
                </div>`;
              }).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
  }

  if (!picks.length && !moneyballHtml && !extraSmartHtml) {
    box.innerHTML = `<div class="alert-item"><span class="badge b-warn">KAS KETAT</span><div>Belum ada rekomendasi yang muat di <b>Sisa Daya Beli (${fmtM(cm.projBudget)})</b>. Klik tombol <b>⚡ Jual</b> di atas untuk menambah modal, atau cek tab <b>🆓 Gratis/Diskon</b>!</div></div>`;
    return;
  }
  const shownPicks = (picks.length > 4 && !bpShowAll) ? picks.slice(0, 4) : picks;
  const picksMoreBtn = picks.length > 4
    ? `<div style="margin:8px 0"><button type="button" class="btn btn-sm" style="width:100%" onclick="toggleBpShowAll()">${bpShowAll ? '⬆️ Ringkas ke Top 4 Rekomendasi' : `⬇️ Tampilkan ${picks.length - 4} Rekomendasi Lainnya (${picks.length} total)`}</button></div>`
    : '';
  box.innerHTML = moneyballHtml + (shownPicks.length ? `<div class="deal-grid">${shownPicks.map(p => renderDealCard(p.it, p.lbl, p.cls)).join('')}</div>${picksMoreBtn}` : '') + extraSmartHtml;
}

function addAllShortlistToCart() {
  const ids = Object.keys(shortlistMap || {});
  const poolById = new Map((D.scoutPool || []).map(r => [r[19], r]));
  let added = 0;
  ids.forEach(pid => {
    const r = poolById.get(pid);
    if (r && !cartIn[pid]) {
      cartIn[pid] = r;
      if (isBosmanTarget(r)) cartInBosman[pid] = true;
      added++;
    }
  });
  renderTab7All();
  showToast(added ? `${added} target Shortlist masuk ke Cart!` : 'Semua target Shortlist sudah ada di Cart');
}

function renderShortlistTab() {
  const ids = Object.keys(shortlistMap || {});
  const cntBadge = document.getElementById('t4-short-cnt');
  if (cntBadge) cntBadge.textContent = String(ids.length);
  const el = document.getElementById('t7-shortlist');
  const sumEl = document.getElementById('t7-short-summary');
  if (!el) return;

  if (!ids.length) {
    if (sumEl) sumEl.innerHTML = '';
    el.innerHTML = `<div class="alert-item"><span class="badge b-accent">SHORTLIST KOSONG</span><div style="flex:1">Klik ikon bintang <b>☆</b> pada pemain mana saja di <b>Belanja Pintar</b>, <b>Pasar Global</b>, atau <b>Player Drawer</b> untuk menyimpannya permanen antar-save!</div><button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-exp')">🔎 Pasar Global →</button></div>`;
    return;
  }

  const cm = getCartMetrics();
  const poolById = new Map((D.scoutPool || []).map(r => [r[19], r]));
  const rosterById = new Map((D.roster || []).map(p => [p.id, p]));
  const activeCards = [];
  const archivedRows = [];
  let totCashBuy = 0, totSal3y = 0, bosmanCnt = 0, activeCnt = 0;

  ids.forEach(pid => {
    const saved = shortlistMap[pid];
    if (rosterById.has(pid)) {
      const p = rosterById.get(pid);
      archivedRows.push(`<div class="alert-item"><span class="badge b-good">SUDAH DIREKRUT ✓</span><div style="flex:1"><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> (${fmtPos(p.pos)} • F${p.force}) sudah masuk skuadmu!</div><button type="button" class="btn btn-sm" onclick="toggleShortlist('${escJs(pid)}')">Hapus</button></div>`);
    } else if (poolById.has(pid)) {
      activeCnt++;
      const r = poolById.get(pid);
      const it = enrichScoutRow(r, cm);
      totSal3y += it.sal3y;
      if (it.isBosman) bosmanCnt++;
      else totCashBuy += it.estBuy;

      const diffP = (saved && saved.savedPrice) ? (it.estBuy - saved.savedPrice) : 0;
      const diffF = (saved && saved.savedForce) ? (r[5] - saved.savedForce) : 0;
      const newBos = Boolean(saved && saved.wasBosman === false && it.isBosman);
      const newUnh = Boolean(saved && saved.wasUnh === false && it.flags.includes('UNH'));

      let lbl = '⭐ TARGET SHORTLIST';
      let cls = 'b-accent';
      if (newBos) { lbl = '🆕 BARU JADI BOSMAN 0€!'; cls = 'b-good'; }
      else if (newUnh) { lbl = '🆕 BARU UNHAPPY -15%!'; cls = 'b-good'; }
      else if (diffP < -20000) { lbl = `⭐ TURUN ${fmtM(-diffP)}!`; cls = 'b-good'; }
      else if (diffF > 0) { lbl = `⭐ FORCE NAIK +${diffF}!`; cls = 'b-info'; }
      else if (it.isBosman) { lbl = '⭐ BOSMAN 0€'; cls = 'b-good'; }
      activeCards.push(renderDealCard(it, lbl, cls));
    } else {
      archivedRows.push(`<div class="alert-item"><span class="badge b-muted">TIDAK DI POOL</span><div style="flex:1"><b>${esc(saved.name || pid)}</b> (${esc(fmtPos(saved.pos))} • ${esc(saved.club || '-')}) — tidak muncul di top scout pool save ini (disimpan ${esc(saved.savedAt || '-')}).</div><button type="button" class="btn btn-sm" onclick="toggleShortlist('${escJs(pid)}')">Hapus</button></div>`);
    }
  });

  if (sumEl) {
    sumEl.innerHTML = activeCnt ? `
      <div class="shortlist-summary-bar">
        <div class="mono">
          <b>${activeCnt} Target</b> · Est. Tebus Tunai: <b class="c-amber">${fmtM(totCashBuy)}</b>
          ${bosmanCnt ? ` · <b class="c-green">Bosman 0€: ${bosmanCnt}</b>` : ''}
          · Total Gaji 3Th: <b class="c-sky">${fmtM(totSal3y)}/bln</b>
        </div>
        <button type="button" class="btn btn-sm btn-green" onclick="addAllShortlistToCart()">🛒 Masukkan Semua ke Cart</button>
      </div>` : '';
  }

  el.innerHTML = (activeCards.length ? `<div class="deal-grid mb-8">${activeCards.join('')}</div>` : '') + archivedRows.join('');
}

// ==================== SINKRONISASI 2 ARAH FILTER MOBILE <-> DESKTOP ====================
let scoutPosSet = new Set();

function renderScoutPosChips() {
  const el = document.getElementById('s-pos-chips');
  if (!el) return;
  const defs = [
    ['', 'Semua Pos'], ['G', 'GK'], ['LD', 'RB'], ['LE', 'LB'],
    ['ZD', 'RCB'], ['ZE', 'LCB'], ['VOL', 'CDM'], ['MC', 'CM'],
    ['MD', 'RM'], ['ME', 'LM'], ['MA', 'CAM'], ['PD', 'RW'],
    ['PE', 'LW'], ['SA', 'SS'], ['ATA', 'ST'],
  ];
  el.innerHTML = defs.map(([k, lbl]) => {
    const act = k === '' ? scoutPosSet.size === 0 : scoutPosSet.has(k);
    return `<button type="button" class="qchip ${act ? 'active' : ''}" onclick="toggleScoutPos('${k}')">${lbl}</button>`;
  }).join('');
}

function toggleScoutPos(code) {
  if (!code) scoutPosSet.clear();
  else if (scoutPosSet.has(code)) scoutPosSet.delete(code);
  else scoutPosSet.add(code);
  const single = scoutPosSet.size === 1 ? Array.from(scoutPosSet)[0] : '';
  const sp = document.getElementById('s-pos');
  const spm = document.getElementById('s-pos-mob');
  if (sp) sp.value = single;
  if (spm) spm.value = single;
  scoutPageLimit = 30;
  renderScout();
}

function onScoutPosSelectChange(val) {
  scoutPosSet.clear();
  if (val) scoutPosSet.add(val);
  syncScoutDesktopToMob();
  resetScoutLimitAndRender();
}

function syncScoutQuick(kind, val) {
  if (kind === 'q') {
    const el = document.getElementById('s-q');
    if (el) el.value = val;
  } else if (kind === 'pos') {
    scoutPosSet.clear();
    if (val) scoutPosSet.add(val);
    const el = document.getElementById('s-pos');
    if (el) el.value = val;
  } else if (kind === 'sort') {
    const el = document.getElementById('s-sort');
    if (el) el.value = val;
  }
  scoutPageLimit = 30;
  renderScout();
}

function syncScoutDesktopToMob() {
  const sq = document.getElementById('s-q'), sqm = document.getElementById('s-q-mob');
  if (sq && sqm && sqm.value !== sq.value) sqm.value = sq.value;
  const sp = document.getElementById('s-pos'), spm = document.getElementById('s-pos-mob');
  if (sp && spm && spm.value !== sp.value) spm.value = sp.value;
  const ss = document.getElementById('s-sort'), ssm = document.getElementById('s-sort-mob');
  if (ss && ssm && ssm.value !== ss.value) ssm.value = ss.value;
}

function resetScoutLimitAndRender() {
  scoutPageLimit = 30;
  renderScout();
}

function loadMoreScout() {
  scoutPageLimit += 30;
  renderScout();
}

function toggleScoutReachQuick() {
  const el = document.getElementById('s-only-reach');
  if (el) el.checked = !el.checked;
  resetScoutLimitAndRender();
}

function renderScoutPresetChips() {
  const el = document.getElementById('t4-preset-chips');
  if (!el) return;
  const reachOn = Boolean((document.getElementById('s-only-reach') || { checked: true }).checked);
  const defs = [
    ['ALL', 'Semua'],
    ['STAR', '⭐ Emas (Star)'],
    ['POT60', '🚀 Muda Pot ≥60'],
    ['MONEYBALL', '💎 +Win%'],
    ['HOLES', '🎯 Lubang'],
    ['BOSMAN', '🆓 Bosman ≤180d'],
    ['UNH', '🔥 Unhappy -15%'],
    ['FLIP', '💸 Flip ≤21th'],
    ['GEM', '💎 Gems'],
    ['FREE', 'Free Agent'],
    ['LOCAL', '🇮🇩 Lokal'],
    ['SHORTLIST', '⭐ Shortlist'],
  ];
  const chipsHtml = defs.map(([k, lbl]) =>
    `<button type="button" class="qchip ${scoutPreset === k ? 'active' : ''}" onclick="applyScoutPreset('${k}')">${lbl}</button>`
  ).join('');
  const reachChip = `<button type="button" class="qchip ${reachOn ? 'active' : ''}" onclick="toggleScoutReachQuick()" title="Sembunyikan pemain yang menolak pindah (REFUSE_DIST/REFUSE_LVL)">${reachOn ? '✓ Mau Gabung' : '🌐 +Refuse'}</button>`;
  el.innerHTML = chipsHtml + reachChip;
}

function updateScoutFilterSummary() {
  const sum = document.getElementById('t4b-filter-summary');
  if (!sum) return;
  const tags = [];
  if (scoutPreset !== 'ALL') tags.push(scoutPreset);
  if (scoutPosSet.size > 0) tags.push('Pos ' + Array.from(scoutPosSet).map(fmtPos).join('+'));
  const foot = (document.getElementById('s-foot') || {}).value;
  if (foot) tags.push('Kaki ' + fmtFoot(foot));
  const ma = (document.getElementById('s-max-age') || {}).value;
  if (ma) tags.push('≤' + ma + 'th');
  const mf = (document.getElementById('s-min-f') || {}).value;
  if (mf) tags.push('F≥' + mf);
  const mp = (document.getElementById('s-max-price') || {}).value;
  if (mp) tags.push('Maks ' + mp);
  const os = (document.getElementById('s-only-stack') || {}).checked;
  if (os) tags.push('Stack OK');
  const af = (document.getElementById('s-afford') || {}).checked;
  if (!af) tags.push('Semua Harga');
  const reachEl = document.getElementById('s-only-reach');
  if (reachEl && !reachEl.checked) tags.push('Termasuk Refuse');
  const badgeHtml = tags.length
    ? ` <span class="badge b-good" style="margin-left:4px">${esc(tags.join(' · '))}</span>`
    : '';
  sum.innerHTML = `<span>🎛️ Filter Lanjutan${badgeHtml}</span><span>▼</span>`;
}

function applyScoutPreset(preset) {
  scoutPreset = preset;
  scoutPageLimit = 30;
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  const setChk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = v; };
  setVal('s-q', '');
  setVal('s-pos', '');
  scoutPosSet.clear();
  setVal('s-foot', '');
  setVal('s-max-age', preset === 'FLIP' ? '21' : (preset === 'POT60' ? '23' : ''));
  setVal('s-min-f', '');
  setVal('s-max-price', '');
  setChk('s-only-stack', preset === 'FLIP');
  setChk('s-hide-trap', true);
  if (preset === 'STAR' || preset === 'POT60') setChk('s-only-reach', true);
  setVal('s-sort', preset === 'MONEYBALL' ? 'WINPCT' : (preset === 'FLIP' ? 'ROI' : (preset === 'POT60' ? 'POT' : (preset === 'HOLES' ? 'UPGRADE' : 'SMART'))));
  syncScoutDesktopToMob();
  renderScout();
  showToast('Preset Scout: ' + preset);
}

function getFilteredScout() {
  const cm = getCartMetrics();
  const q = ((document.getElementById('s-q') || {}).value || '').toLowerCase();
  const pos = (document.getElementById('s-pos') || {}).value || '';
  const foot = (document.getElementById('s-foot') || {}).value || '';
  const maxAge = parseInt((document.getElementById('s-max-age') || {}).value, 10);
  const minF = parseInt((document.getElementById('s-min-f') || {}).value, 10);
  const maxPRaw = parseFloat((document.getElementById('s-max-price') || {}).value);
  const pUnit = parseFloat((document.getElementById('s-price-unit') || {}).value) || 1;
  const maxP = isNaN(maxPRaw) ? Infinity : maxPRaw * pUnit;
  const onlyReachEl = document.getElementById('s-only-reach');
  const onlyReach = onlyReachEl ? Boolean(onlyReachEl.checked) : true;
  const onlyAfford = Boolean((document.getElementById('s-afford') || {}).checked);
  const onlyStack = Boolean((document.getElementById('s-only-stack') || {}).checked);
  const hideTrap = Boolean((document.getElementById('s-hide-trap') || {}).checked);
  const hideInj = Boolean((document.getElementById('s-hide-inj') || {}).checked);
  const sortBy = (document.getElementById('s-sort') || {}).value || 'SMART';
  const holesSet = new Set(D.holePositions || []);

  const filtered = [];
  for (const r of D.scoutPool) {
    const flags = r[18] || '';
    if (q && !(r[0].toLowerCase().includes(q) || r[16].toLowerCase().includes(q))) continue;
    if (onlyReach && isBlockedTransfer(r) && scoutPreset !== 'SHORTLIST') continue;
    if (scoutPosSet.size > 0 && !scoutPosSet.has(r[1])) continue;
    else if (scoutPosSet.size === 0 && pos && r[1] !== pos) continue;
    if (foot && r[3] !== foot) continue;
    if (!isNaN(maxAge) && r[2] > maxAge) continue;
    if (!isNaN(minF) && r[5] < minF) continue;
    const effPriceFilter = isBosmanTarget(r) ? 0 : r[14];
    if (effPriceFilter > maxP) continue;
    if (onlyStack && (r[11] === 1 || r[10] < 3.0)) continue;
    if (hideTrap && flags.includes('TRAP')) continue;
    if (hideInj && flags.includes('INJ')) continue;

    if (scoutPreset === 'STAR' && r[20] !== 1) continue;
    if (scoutPreset === 'POT60' && (r[7] < 60 || r[2] > 23)) continue;
    if (scoutPreset === 'HOLES' && !holesSet.has(r[1])) continue;
    if (scoutPreset === 'FLIP' && (r[2] > 21 || r[17] < 30)) continue;
    if (scoutPreset === 'BOSMAN' && !isBosmanTarget(r)) continue;
    if (scoutPreset === 'UNH' && !flags.includes('UNH')) continue;
    if (scoutPreset === 'GEM' && !flags.includes('GEM')) continue;
    if (scoutPreset === 'FREE' && !flags.includes('FREE')) continue;
    if (scoutPreset === 'LOCAL' && !flags.includes('LOCAL')) continue;
    if (scoutPreset === 'SHORTLIST' && !isShortlisted(r[19])) continue;

    const item = enrichScoutRow(r, cm);
    if (onlyAfford && item.affordCode === 'EXP' && scoutPreset !== 'SHORTLIST') continue;
    filtered.push(item);
  }

  if (sortBy === 'WINPCT' || sortBy === 'WINPERM') {
    const ctx = getBenchmarkMatchContext();
    if (ctx && ctx.base) {
      const fastForms = Array.from(new Set([ctx.base.formation, '3-5-2', '4-2-3-1', '4-3-3']))
        .filter(fk => D.formations && (fk in D.formations));
      // Evaluasi Top 45 kandidat terbaik (atau seluruh hasil filter jika <=45) di Match Engine
      filtered.sort((a, b) => b.upgradeScore - a.upgradeScore);
      for (const it of filtered.slice(0, 45)) {
        it.winImpact = getScoutWinImpact(it, ctx, fastForms);
      }
    }
    filtered.sort((a, b) => {
      const wa = a.winImpact ? (sortBy === 'WINPERM' ? a.winImpact.winPerM : a.winImpact.dXPts) : -999;
      const wb = b.winImpact ? (sortBy === 'WINPERM' ? b.winImpact.winPerM : b.winImpact.dXPts) : -999;
      return (wb - wa) || (b.upgradeScore - a.upgradeScore);
    });
    return filtered;
  }

  filtered.sort((a, b) => {
    if (sortBy === 'UPGRADE') return b.upgradeScore - a.upgradeScore;
    if (sortBy === 'ROI') return b.roiPct - a.roiPct || b.estProfit - a.estProfit;
    if (sortBy === 'PROFIT') return b.estProfit - a.estProfit;
    if (sortBy === 'CHEAP') return (a.isBosman ? 0 : a.estBuy) - (b.isBosman ? 0 : b.estBuy) || b.r[5] - a.r[5];
    if (sortBy === 'FORCE') return b.r[5] - a.r[5] || b.r[7] - a.r[7];
    if (sortBy === 'POTCAP') return b.r[7] - a.r[7] || b.r[5] - a.r[5];
    return b.smartScore - a.smartScore;
  });
  return filtered;
}

function renderScout() {
  syncScoutDesktopToMob();
  renderScoutPresetChips();
  renderScoutPosChips();
  updateScoutFilterSummary();

  const items = getFilteredScout();
  document.getElementById('t7-cnt').textContent = items.length + ' target';
  const show = items.slice(0, scoutPageLimit);

  const ctx = getBenchmarkMatchContext();
  const fastForms = (ctx && ctx.base)
    ? Array.from(new Set([ctx.base.formation, '3-5-2', '4-2-3-1', '4-3-3'])).filter(fk => D.formations && (fk in D.formations))
    : [];
  if (ctx && ctx.base) {
    for (const it of show.slice(0, 40)) {
      if (!it.winImpact) it.winImpact = getScoutWinImpact(it, ctx, fastForms);
    }
  }

  document.getElementById('t7-scout-tbl').innerHTML = `<thead><tr>
    <th>Pemain &amp; Aksi Cepat</th><th>Pos / Usia</th><th>F → Cap &amp; Skill</th>
    <th>Est. Beli &amp; Fit</th><th class="col-hide-mob">Saran Swap</th><th class="col-hide-mob">Flip &amp; ROI</th><th class="col-desk-only">Aksi</th>
  </tr></thead><tbody>` + (show.length ? show.map(it => {
    const r = it.r;
    const sw = it.swap;
    const pid = r[19];
    const inC = !!cartIn[pid];
    const isBosFree = Boolean(inC && cartInBosman[pid]);
    const pinned = isShortlisted(pid);
    const stIcon = r[20] === 2 ? '👑' : (r[20] === 1 ? '⭐' : '');

    let fitBadge = '<span class="badge b-muted">✗ MAHAL</span>';
    if (it.affordCode === 'BOSMAN') fitBadge = '<span class="badge b-good">🆓 0€</span>';
    else if (it.affordCode === 'CASH') fitBadge = '<span class="badge b-good">✓ KAS</span>';
    else if (it.affordCode === 'SWAP') fitBadge = '<span class="badge b-info">⇄ SWAP</span>';
    else if (it.affordCode === 'INST') fitBadge = '<span class="badge b-info" title="Cicilan 24 bln (OTA TRANSFER_INSTALLMENTS): DP 25%">💳 DP 25%</span>';

    const wi = it.winImpact;
    const winTagHtml = wi
      ? `<span class="badge ${wi.dWin > 0 ? 'b-good' : (wi.dWin < 0 ? 'b-crit' : 'b-muted')} mono" title="Simulasi Match Engine vs ${esc(ctx ? ctx.oppName : '')} (${fmtForm(wi.form)} · ${wi.winPct}% Win)">${wi.dWin >= 0 ? '+' : ''}${wi.dWin}% Win</span>`
      : '';
    const swCell = sw
      ? `<div><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(sw.p.id)}')"><b>${esc(sw.p.name)}</b></a> <span class="mono ${sw.deltaEff >= 0 ? 'c-green' : 'c-amber'}">(${sw.deltaEff >= 0 ? '+' : ''}${sw.deltaEff} Eff)</span></div>
         <div class="c-muted" style="font-size:10px">Net: <b class="mono">${it.netCostIfSwap <= 0 ? '+' + fmtM(-it.netCostIfSwap) : '-' + fmtM(it.netCostIfSwap)}</b> • ΔGaji ${sw.deltaSal >= 0 ? '+' : ''}${fmtM(sw.deltaSal)} ${winTagHtml}</div>`
      : (winTagHtml ? `<div>${winTagHtml}</div>` : '<span class="c-muted">-</span>');

    const pidJs = escJs(pid);
    const repIdJs = sw ? escJs(sw.p.id) : '';
    const buyBtnLbl = inC ? (isBosFree ? '✓ 0€' : '✓') : (it.isBosman ? '+0€' : '+Beli');
    const buyBtnsHtml = `
      <button type="button" class="star-btn ${pinned ? 'pinned' : ''}" title="${pinned ? 'Hapus Shortlist' : 'Pin Shortlist'}" onclick="toggleShortlist('${pidJs}')">${pinned ? '★' : '☆'}</button>
      <button type="button" class="btn btn-sm ${inC ? 'btn-amber' : 'btn-green'}" onclick="toggleCartIn('${pidJs}', ${it.isBosman ? 'true' : 'false'})">${buyBtnLbl}</button>
      ${sw ? `<button type="button" class="btn btn-sm" title="Swap dgn ${esc(sw.p.name)}" onclick="swapToCart('${pidJs}','${repIdJs}', ${it.isBosman ? 'true' : 'false'})">⇄</button>` : ''}`;

    return `<tr>
      <td>
        <div><a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')"><b>${esc(r[0])}</b></a> ${stIcon} <span class="c-muted" style="font-size:10px">(${r[4]}·${esc(r[16])})</span></div>
        <div style="margin-top:2px">${renderCompactScoutBadges(r[18], it.fillsHole)}</div>
        <div class="sticky-inline-acts">${buyBtnsHtml}</div>
      </td>
      <td class="mono"><b>${fmtPos(r[1])}</b> • ${r[2]}th • <b>${fmtFoot(r[3])}</b><div class="c-muted" style="font-size:10px">Kontrak ${r[15]}d</div></td>
      <td class="mono">
        <b>${r[5]}</b> → <b class="c-green">${r[7]}</b>
        ${(() => {
          const decAge = (window.LFEngine && LFEngine.config && LFEngine.config.DECLINE_AGE_BY_CAT) ? (LFEngine.config.DECLINE_AGE_BY_CAT[EXACT_CAT[r[1]] ?? 3] || 32) : 32;
          const eta = (window.LFEngine && LFEngine.roster && LFEngine.roster.estimatePeakEta && r[7] > r[5] && r[2] < decAge)
            ? LFEngine.roster.estimatePeakEta(r[2], r[5], r[7], 0, D.meta && D.meta.userTeamLevel, D.meta && D.meta.ctLevel, decAge)
            : null;
          if (!eta) return '';
          return eta.train.reached
            ? `<div class="c-muted" style="font-size:10px" title="Slot Latihan + Main Rutin: ${eta.train.peakAge}th (${eta.train.years} msm) · Tanpa Slot: ${eta.normal.reached ? eta.normal.peakAge + 'th' : 'F' + eta.normal.endForce}">⏱ Cap ~${eta.train.peakAge}th (${eta.train.years} msm)</div>`
            : `<div class="c-muted" style="font-size:10px" title="Maks sebelum usia turun @${decAge}th">⏱ Max F${eta.train.endForce} @${decAge}th</div>`;
        })()}
        <div><span class="badge ${r[11] ? 'b-crit' : 'b-muted'}">${fmtSkills(r[8], r[9])} (+${r[10]}%)</span></div>
      </td>
      <td class="mono">
        <b>${it.isBosman ? '<span class="c-green">0€*</span>' : fmtM(it.estBuy)}</b> ${fitBadge}
        <div class="c-muted" style="font-size:10px">${it.isBosman ? 'Tebus ' + fmtM(it.estBuy) + ' · ' : (it.affordCode === 'INST' ? `DP ${fmtM(it.dp25)} (${fmtM(it.inst24)}/b) · ` : '')}Gaji ${fmtM(it.sal3y)}</div>
      </td>
      <td class="col-hide-mob">${swCell}</td>
      <td class="mono col-hide-mob">
        <b class="${it.estProfit > 0 ? 'c-green' : 'c-muted'}">${it.estProfit >= 0 ? '+' : ''}${fmtM(it.estProfit)} (${it.roiPct}%)</b>
        <div class="c-muted" style="font-size:10px">Jual ~${fmtM(it.estResale)} (+${it.projGain}F)</div>
      </td>
      <td class="col-desk-only"><div style="display:flex;gap:4px;align-items:center">${buyBtnsHtml}</div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="c-muted">Tidak ada target sesuai filter (coba lepas centang "Masuk Daya Beli" atau pilih pemain dijual dulu).</td></tr>') + `</tbody>`;

  // Pagination bertahap (+30 lagi)
  const moreEl = document.getElementById('t7-scout-more');
  if (moreEl) {
    if (!items.length) {
      moreEl.innerHTML = '';
    } else if (show.length < items.length) {
      const rem = items.length - show.length;
      moreEl.innerHTML = `
        <span class="c-muted mono">Menampilkan <b>${show.length}</b> dari <b>${items.length}</b> target</span>
        <button type="button" class="btn btn-sm btn-green" onclick="loadMoreScout()">Muat +${Math.min(30, rem)} Lagi (${rem} tersisa)</button>`;
    } else {
      moreEl.innerHTML = `<span class="c-muted mono">Menampilkan seluruh <b>${items.length}</b> target sesuai filter.</span>`;
    }
  }
}

function exportScoutCsv() {
  const items = getFilteredScout().slice(0, 500);
  const hdr = ['Name','Pos','Age','Foot','Nat','Force','Pot','PotCap','S1','S2','StackPct','Sal3Y','MV','EstBuy','BosmanFree','EstResale','EstProfit','RoiPct','SuggestedReplace','DeltaEff','NetSwapCost','ContractDays','Club','Flags','Shortlisted'];
  const lines = [hdr.join(',')].concat(items.map(it => {
    const r = it.r, sw = it.swap;
    return [
      `"${r[0].replace(/"/g,'""')}"`, fmtPos(r[1]), r[2], fmtFoot(r[3]), r[4], r[5], r[6], r[7],
      fmtSkill(r[8]), fmtSkill(r[9]), r[10], it.sal3y, r[13], it.estBuy, it.isBosman ? 'YES' : 'NO', it.estResale, it.estProfit, it.roiPct,
      sw ? `"${sw.p.name.replace(/"/g,'""')}"` : '""', sw ? sw.deltaEff : 0, it.netCostIfSwap,
      r[15], `"${r[16].replace(/"/g,'""')}"`, `"${r[18]}"`, isShortlisted(r[19]) ? 'YES' : 'NO'
    ].join(',');
  }));
  downloadCsv('ligafoot_scout.csv', lines.join('\n'));
}

function renderTab7All() {
  renderCart();
  renderScoutBlueprint();
  renderShortlistTab();
  renderScout();
  if (typeof renderStickyCartBar === 'function') renderStickyCartBar();
  if (typeof renderShopAnalytics === 'function') renderShopAnalytics();
}

function selectAllRecommendedSells() {
  let added = 0;
  D.roster.forEach(p => {
    if (isRecommendedSell(p) && !cartOut[p.id]) {
      cartOut[p.id] = { arab: false };
      added++;
    }
  });
  renderTab7All();
  showToast(added ? `${added} pemain layak jual masuk ke Cart!` : 'Semua pemain layak jual sudah ada di Cart');
}

function swapToCart(targetId, replaceId, asBosmanFree) {
  const found = D.scoutPool.find(r => r[19] === targetId);
  if (found) {
    cartIn[targetId] = found;
    if (asBosmanFree && isBosmanTarget(found)) cartInBosman[targetId] = true;
    else delete cartInBosman[targetId];
  }
  const rep = D.roster.find(p => p.id === replaceId);
  if (rep) {
    if (rep.injured) {
      showToast(`${found ? found[0] : 'Target'} masuk Beli! (${rep.name} sedang cedera, jangan dijual dulu)`);
    } else {
      cartOut[replaceId] = cartOut[replaceId] || { arab: false };
      showToast(`Swap dipasang: Beli ${found ? found[0] : ''} ⇄ Jual ${rep.name}`);
    }
  }
  renderTab7All();
}

function toggleCartOut(pid) {
  if (cartOut[pid]) delete cartOut[pid];
  else cartOut[pid] = { arab: false };
  renderTab7All();
}

function toggleCartArab(pid) {
  if (!cartOut[pid]) cartOut[pid] = { arab: true };
  else cartOut[pid].arab = !cartOut[pid].arab;
  renderTab7All();
}

function toggleCartIn(pid, asBosmanFree) {
  if (cartIn[pid]) {
    delete cartIn[pid];
    delete cartInBosman[pid];
  } else {
    const found = D.scoutPool.find(r => r[19] === pid);
    if (found) {
      cartIn[pid] = found;
      if (asBosmanFree && isBosmanTarget(found)) cartInBosman[pid] = true;
    }
  }
  renderTab7All();
}

function toggleCartInBosman(pid) {
  if (!cartIn[pid]) return;
  if (cartInBosman[pid]) delete cartInBosman[pid];
  else cartInBosman[pid] = true;
  renderTab7All();
}

function clearCart() {
  cartOut = {};
  cartIn = {};
  cartInBosman = {};
  cartBIn = {};
  renderTab7All();
  if (typeof renderBTeamPanel === 'function') renderBTeamPanel();
  showToast('Keranjang transfer dikosongkan');
}

function renderCart() {
  const cm = getCartMetrics();
  const { cashIn, cashOut, salDelta, projBudget, projForeign, inList, bInList, outCount, inCount, scoutInCount, bInCount } = cm;

  document.getElementById('t7-cart-kpis').innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px">
      <div class="kpi-lbl">Dana Masuk (1.25x)</div>
      <div class="kpi-val mono c-green">+${fmtM(cashIn)}</div>
      <div class="kpi-sub">${outCount} pemain dijual</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px">
      <div class="kpi-lbl">Belanja Masuk</div>
      <div class="kpi-val mono c-amber">-${fmtM(cashOut)}</div>
      <div class="kpi-sub">${scoutInCount} scout${bInCount ? ` + ${bInCount} Tim B (0€)` : ''}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px">
      <div class="kpi-lbl">Sisa Kas</div>
      <div class="kpi-val mono ${projBudget >= 0 ? 'c-green' : 'c-red'}">${fmtM(projBudget)}</div>
      <div class="kpi-sub">ΔGaji: <b class="mono">${salDelta >= 0 ? '+' : ''}${fmtM(salDelta)}</b></div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px">
      <div class="kpi-lbl">Kuota Asing</div>
      <div class="mono kpi-val ${projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky'}">${projForeign}/${D.meta.foreignCap}</div>
      <div class="kpi-sub">${projForeign > D.meta.foreignCap ? '⚠ Melebihi batas XI!' : '✓ Aman masuk XI'}</div>
    </div>`;

  // Strip Proyeksi Dampak Skuad + What-If Transfer & Squad Simulator (Tier 2 #7)
  const impEl = document.getElementById('t7-cart-impact');
  if (impEl) {
    const curSq = (D.roster || []).length;
    const projSq = curSq - outCount + inCount;
    const extraForeignWarn = (projForeign > D.meta.foreignCap)
      ? `<span class="badge b-warn">⚠ Kelebihan ${projForeign - D.meta.foreignCap} asing — pertimbangkan jual/rotasi ke Tim B</span>`
      : `<span class="badge b-good">✓ Komposisi Asing &amp; Kas Sehat</span>`;
    const ecoPlan = (window.LFEngine && window.LFEngine.economy && window.LFEngine.economy.computeInstallmentPlan);
    const p6 = ecoPlan ? ecoPlan(cashOut, 6) : { dp: Math.round(cashOut * 0.25), totalFinanced: Math.round(cashOut * 0.75 * 1.03), monthly: Math.ceil(cashOut * 0.75 * 1.03 / 6) };
    const p12 = ecoPlan ? ecoPlan(cashOut, 12) : { dp: Math.round(cashOut * 0.25), totalFinanced: Math.round(cashOut * 0.75 * 1.08), monthly: Math.ceil(cashOut * 0.75 * 1.08 / 12) };
    const p24 = ecoPlan ? ecoPlan(cashOut, 24) : { dp: Math.round(cashOut * 0.25), totalFinanced: Math.round(cashOut * 0.75 * 1.18), monthly: Math.ceil(cashOut * 0.75 * 1.18 / 24) };
    const cfCart = D.cashflow || {};
    const debtCap = cfCart.transferDebtCap ?? Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 12 * 0.30));
    const debtUsed = Number(cfCart.transferDebtTotal) || 0;
    const debtRoom = cfCart.transferDebtRoom ?? Math.max(0, debtCap - debtUsed);
    const debtMaxBuy24 = cfCart.transferDebtMaxBuy24 ?? Math.floor(debtRoom / (0.75 * 1.18));
    const debtBanned = Boolean(cfCart.transferBanned || (D.meta && D.meta.transferBanned));
    const estSurplus = (typeof cfCart.estProjectedNet === 'number') ? cfCart.estProjectedNet : null;
    const ok24 = !debtBanned && p24.totalFinanced <= debtRoom;
    const ok6 = !debtBanned && p6.totalFinanced <= debtRoom;
    const remAfter24 = debtRoom - p24.totalFinanced;
    const instHtml = cashOut > 0
      ? `<span id="t7-cart-debt-badge" class="badge ${ok24 ? 'b-info' : (ok6 ? 'b-warn' : 'b-crit')} mono" title="OTA 01a20f1b (#21652/#21653): total cicilan harus <= Sisa Plafon (${fmtM(debtRoom)} / ${fmtM(debtCap)}). DP 25% + bunga 6b +3% / 12b +8% / 24b +18%.">💳 Cicil DP 25% (${fmtM(p24.dp)}): 6b ${fmtM(p6.monthly)} · 12b ${fmtM(p12.monthly)} · 24b ${fmtM(p24.monthly)}/bln · Plafon 24b: ${debtBanned ? '⛔ BAN' : (ok24 ? `✓ Sisa ${fmtM(remAfter24)}` : `⛔ Kurang ${fmtM(-remAfter24)}`)}${estSurplus !== null ? ` (Net/bln: ${fmtM(estSurplus - p24.monthly - salDelta)})` : ''}</span>`
      : `<span id="t7-cart-debt-badge" class="badge ${debtBanned ? 'b-crit' : (debtRoom > 0 ? 'b-info' : 'b-warn')} mono" title="OTA 01a20f1b (#21652/#21653): Plafon utang cicilan = max(500K, 30% gaji tahunan) - sisa utang berjalan">💳 Plafon Cicilan: ${debtBanned ? '⛔ TRANSFER BAN' : `Sisa ${fmtM(debtRoom)} / ${fmtM(debtCap)}`} · Maks Beli 24b: ${fmtM(debtMaxBuy24)}</span>`;

    const simList = Array.isArray(D.simOpponents) ? D.simOpponents : [];
    const strongestOpp = [...simList].sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))[0] || null;
    const fx0Name = (D.upcoming && D.upcoming[0]) ? D.upcoming[0].oppName : 'Laga Berikutnya';
    const bList = (D.bTeamInfo && D.bTeamInfo.hasBTeam && Array.isArray(D.bTeamInfo.roster)) ? D.bTeamInfo.roster : [];

    const whatIfCtrlBar = `
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:7px 10px;font-size:11px">
        <span class="c-muted">🎯 Benchmark Lawan:</span>
        <select id="t7-bench-select" style="width:auto;max-width:240px;padding:4px 7px;font-size:11px" onchange="setCartBenchOpp(this.value)">
          <option value="AUTO_NEXT" ${cartBenchOppId === 'AUTO_NEXT' ? 'selected' : ''}>Berikutnya: ${esc(fx0Name)}</option>
          ${strongestOpp ? `<option value="STRONGEST_RIVAL" ${cartBenchOppId === 'STRONGEST_RIVAL' ? 'selected' : ''}>⭐ Rival Terkuat: ${esc(strongestOpp.name)} (Avg ${strongestOpp.avgScore})</option>` : ''}
          ${simList.slice(0, 8).map(o => `<option value="${esc(o.id)}" ${cartBenchOppId === o.id ? 'selected' : ''}>${esc(o.name)} (Avg ${o.avgScore})</option>`).join('')}
        </select>
        ${bList.length ? `
          <span class="c-muted" style="margin-left:auto">🅱️ Promosi ${esc(D.bTeamInfo.bTeamName || 'Tim B')}:</span>
          <select id="t7-bteam-pick" style="width:auto;max-width:210px;padding:4px 7px;font-size:11px">
            ${bList.map(bp => `<option value="${esc(bp.id)}" ${cartBIn[bp.id] ? 'disabled' : ''}>${esc(bp.name)} (${fmtPos(bp.pos)} F${bp.force}→${bp.potCap}${bp.isForeign ? ' · ASING' : ''})</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm btn-accent" onclick="addBTeamSelectToCart()">+ Promosi Tim B (0€)</button>
        ` : ''}
      </div>`;

    let matchImpactHtml = '';
    if (outCount > 0 || inCount > 0) {
      const ctx = getBenchmarkMatchContext();
      const Eng = window.LFEngine;
      if (ctx && ctx.base && Eng && Eng.tactics) {
        const simRoster = (D.roster || [])
          .filter(p => !cartOut[p.id])
          .concat(inList.map(scoutRowToSimPlayer))
          .concat(bInList.map(bTeamPlayerToSimPlayer));
        const aft = simRoster.length >= 11
          ? Eng.tactics.evaluateSquadImpact(simRoster, ctx.oppPow, ctx.opts)
          : null;
        if (aft) {
          const b = ctx.base;
          const dAvg = +(aft.avgScore - b.avgScore).toFixed(2);
          const dWin = +(aft.winPct - b.winPct).toFixed(1);
          const dXPts = +(aft.xPts - b.xPts).toFixed(3);
          const dPoss = +(aft.possPct - b.possPct).toFixed(1);
          const dGk = +(aft.uPow.GK - b.uPow.GK).toFixed(1);
          const dDef = +(aft.uPow.DEF - b.uPow.DEF).toFixed(1);
          const dMid = +(aft.uPow.MID - b.uPow.MID).toFixed(1);
          const dAtk = +(aft.uPow.ATK - b.uPow.ATK).toFixed(1);
          const dChem = (aft.chemistry ?? 100) - (b.chemistry ?? 100);
          const dWf = (aft.wrongFootCount ?? 0) - (b.wrongFootCount ?? 0);
          const fmtD = (v, suf = '') => `<span class="${v > 0 ? 'c-green' : (v < 0 ? 'c-red' : 'c-muted')}">(${v >= 0 ? '+' : ''}${v}${suf})</span>`;
          const netSpend = cashOut - cashIn;
          const effBadge = (dWin > 0 && cashOut > 0)
            ? `<span class="badge b-info mono">+${(dWin / (cashOut / 1e6)).toFixed(2)}% Win / 1M</span>`
            : (dWin > 0 && netSpend <= 0 ? '<span class="badge b-good">🆓 Gratis / Surplus Kas!</span>' : '');

          let rivalLine = '';
          if (ctx.topRival) {
            const aftR = Eng.tactics.evaluateSquadImpact(simRoster, ctx.topRival.oppPow, ctx.topRival.opts);
            if (aftR) {
              const bR = ctx.topRival.base;
              const dWR = +(aftR.winPct - bR.winPct).toFixed(1);
              rivalLine = ` · vs ${esc(ctx.topRival.name)}: <b>${bR.winPct}% → ${aftR.winPct}%</b> ${fmtD(dWR, '%')}`;
            }
          }

          const baseIds = new Set(Array.isArray(b.xiIds) ? b.xiIds : []);
          const aftSummary = Array.isArray(aft.xiSummary) ? aft.xiSummary : [];
          const aftIds = new Set(Array.isArray(aft.xiIds) ? aft.xiIds : []);
          const xiAdded = aftSummary.filter(x => !baseIds.has(x.id));
          const xiDropped = (Array.isArray(b.xiSummary) ? b.xiSummary : []).filter(x => !aftIds.has(x.id));
          const xiDiffLine = (xiAdded.length || xiDropped.length) ? `
            <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);font-size:10.5px">
              ${xiAdded.length ? `<span class="c-green"><b>⬆ Masuk Starter XI:</b> ${xiAdded.map(x => `${esc(x.name)} (${fmtPos(x.slot)} F${x.force})`).join(', ')}</span>` : ''}
              ${xiDropped.length ? ` <span class="c-amber">· <b>⬇ Tergeser:</b> ${xiDropped.map(x => `${esc(x.name)} (${fmtPos(x.slot)} F${x.force})`).join(', ')}</span>` : ''}
            </div>` : '';

          matchImpactHtml = `
            <div id="t7-whatif-sim" style="margin-top:8px;padding:10px 12px;background:var(--bg2);border:1px solid ${dXPts >= 0 ? 'rgba(16,185,129,.45)' : 'rgba(239,68,68,.45)'};border-radius:10px;font-size:11.5px">
              <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
                <div><b>🧪 What-If Simulator (Before → After) vs ${esc(ctx.oppName)}</b> <span class="c-muted">(${ctx.isHome ? 'Kandang' : 'Tandang'})</span></div>
                <div style="display:flex;gap:5px;flex-wrap:wrap">
                  <span class="badge ${dWin >= 0 ? 'b-good' : 'b-crit'} mono">Win ${b.winPct}% → ${aft.winPct}% ${dWin >= 0 ? '+' : ''}${dWin}%</span>
                  ${effBadge}
                </div>
              </div>
              <div class="mono" style="display:flex;flex-wrap:wrap;gap:12px;font-size:11px">
                <span>Best XI Avg: <b>${b.avgScore} → ${aft.avgScore}</b> ${fmtD(dAvg)}</span>
                <span>Formasi: <b>${esc(fmtForm(b.formation))} → ${esc(fmtForm(aft.formation))}</b></span>
                <span>xPts: <b>${b.xPts} → ${aft.xPts}</b> ${fmtD(dXPts)}</span>
                <span>xG: <b>${b.xGF}–${b.xGA} → ${aft.xGF}–${aft.xGA}</b></span>
                <span>Ball: <b>${b.possPct}% → ${aft.possPct}%</b> ${fmtD(dPoss, '%')}${rivalLine}</span>
              </div>
              <div class="mono c-muted" style="margin-top:5px;font-size:10.5px">
                Sektor: GK <b>${b.uPow.GK}→${aft.uPow.GK}</b> ${fmtD(dGk)} · DEF <b>${b.uPow.DEF}→${aft.uPow.DEF}</b> ${fmtD(dDef)} · MID <b>${b.uPow.MID}→${aft.uPow.MID}</b> ${fmtD(dMid)} · ATK <b>${b.uPow.ATK}→${aft.uPow.ATK}</b> ${fmtD(dAtk)} · Chem <b>${b.chemistry ?? 100}%→${aft.chemistry ?? 100}%</b> ${dChem !== 0 ? fmtD(dChem, '%') : ''} · WF <b>${b.wrongFootCount ?? 0}→${aft.wrongFootCount ?? 0}</b>${dWf !== 0 ? ` ${fmtD(dWf)}` : ''}
                ${aft.falseNineTarget ? ` · <span class="c-sky">⚡ F9 Aktif: ${esc(aft.falseNineTarget.name)}</span>` : ''}
              </div>
              ${xiDiffLine}
            </div>`;
        } else {
          matchImpactHtml = `<div class="alert-item CRITICAL mt-8"><span class="badge b-crit">SKUAD &lt;11</span><div>Sisa pemain di Cart kurang dari 11 — tambahkan target masuk sebelum menjual!</div></div>`;
        }
      }
    }

    impEl.innerHTML = `
      <div class="cart-impact-strip">
        <div class="mono">
          📊 Proyeksi Skuad: <b>${curSq} → ${projSq} pemain</b> ·
          Asing: <b>${cm.curForeign} → ${projForeign}/${D.meta.foreignCap}</b> ·
          Gaji/Bln: <b>${fmtM(D.meta.payroll + salDelta)}</b>
        </div>
        ${extraForeignWarn}
        ${instHtml}
      </div>${whatIfCtrlBar}${matchImpactHtml}`;
  }

  // Tabel Pemain Keluar dengan pencarian cepat
  const outQ = ((document.getElementById('t7-out-search') || {}).value || '').toLowerCase();
  const sortedOut = [...D.roster]
    .filter(p => !outQ || p.name.toLowerCase().includes(outQ) || fmtPos(p.pos).toLowerCase().includes(outQ))
    .sort((a, b) => (cartOut[b.id] ? 1 : 0) - (cartOut[a.id] ? 1 : 0) || (isRecommendedSell(b) ? 1 : 0) - (isRecommendedSell(a) ? 1 : 0) || b.estRealSale - a.estRealSale);

  document.getElementById('t7-out-tbl').innerHTML = `<thead><tr><th>Pemain</th><th>Jual</th><th>Real 1.25x</th><th>Arab 2.5x</th></tr></thead><tbody>` +
    (sortedOut.length ? sortedOut.map(p => {
      const sel = cartOut[p.id];
      const recSell = isRecommendedSell(p);
      const injWarn = p.injured ? ' <span class="badge b-crit">🏥INJ</span>' : (recSell ? ' <span class="badge b-warn">LAYAK</span>' : '');
      const pidJs = escJs(p.id);
      return `<tr>
        <td>
          <a class="clickable-name" onclick="openPlayerDrawer('roster','${pidJs}')"><b>${esc(p.name)}</b></a>
          <div class="c-muted" style="font-size:10px">${fmtPos(p.pos)} ${p.age}th · F${p.force}${injWarn}</div>
        </td>
        <td><input type="checkbox" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer" ${sel ? 'checked' : ''} onchange="toggleCartOut('${pidJs}')" /></td>
        <td class="mono">${fmtM(p.estRealSale)}<div class="c-muted" style="font-size:10px">Ctr ${fmtM(p.estCounter40)}</div></td>
        <td>${p.isTop5Arab ? `<button type="button" class="btn btn-sm ${sel && sel.arab ? 'btn-amber' : ''}" onclick="toggleCartArab('${pidJs}')">${fmtM(p.estArabLow)}</button>` : '<span class="c-muted">-</span>'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="c-muted">Pemain tidak ditemukan.</td></tr>') + `</tbody>`;

  // Tabel Target Masuk (Scout + Promosi Tim B 0€)
  const scoutRowsHtml = inList.map(r => {
    const pid = r[19];
    const pidJs = escJs(pid);
    const canBos = isBosmanTarget(r);
    const isBosOn = Boolean(canBos && cartInBosman[pid]);
    const effCost = getEffectiveBuyCost(r);
    return `<tr>
      <td>
        <a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')"><b>${esc(r[0])}</b></a>
        <div class="c-muted mono" style="font-size:10px">${fmtPos(r[1])} · ${r[5]}→${r[7]} · ${r[15]}d</div>
      </td>
      <td class="mono ${isBosOn ? 'c-green' : 'c-amber'}"><b>${isBosOn ? '0€ (Gratis)' : fmtM(effCost)}</b></td>
      <td class="col-hide-mob">${canBos
        ? `<button type="button" class="btn btn-sm ${isBosOn ? 'btn-green' : ''}" onclick="toggleCartInBosman('${pidJs}')">${isBosOn ? '🆓 0€ ON' : '0€ Off'}</button>`
        : '<span class="c-muted">-</span>'}</td>
      <td class="mono">${fmtM(Math.round(r[12] * 0.95))}</td>
      <td><button type="button" class="btn btn-sm" onclick="toggleCartIn('${pidJs}')">✕</button></td>
    </tr>`;
  }).join('');

  const bRowsHtml = bInList.map(bp => {
    const pidJs = escJs(bp.id);
    return `<tr>
      <td>
        <a class="clickable-name" onclick="openPlayerDrawer('bteam','${pidJs}')"><b>${esc(bp.name)}</b></a> <span class="badge b-accent">TIM B</span>
        <div class="c-muted mono" style="font-size:10px">${fmtPos(bp.pos)} · ${bp.force}→${bp.potCap} · ${bp.age}th</div>
      </td>
      <td class="mono c-green"><b>0€ (Promosi)</b></td>
      <td class="col-hide-mob"><span class="badge b-good">GRATIS</span></td>
      <td class="mono">${fmtM(bp.salary || 0)}</td>
      <td><button type="button" class="btn btn-sm" onclick="toggleCartBIn('${pidJs}')">✕</button></td>
    </tr>`;
  }).join('');

  const allInRows = scoutRowsHtml + bRowsHtml;
  document.getElementById('t7-in-tbl').innerHTML = `<thead><tr><th>Target</th><th>Biaya Beli</th><th class="col-hide-mob">Bosman 0€</th><th>Gaji 3Th</th><th>Hapus</th></tr></thead><tbody>` +
    (allInRows || `<tr><td colspan="5" class="c-muted">Belum ada target. Klik "+ Beli" atau <button type="button" class="btn btn-sm btn-green" onclick="goToView('t4','t4-bp')">🧠 Buka Belanja Pintar →</button></td></tr>`) + `</tbody>`;
}
