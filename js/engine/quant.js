/**
 * LigaFoot Optimizer Web Engine — quant.js (v8.12.0 Wave 2)
 * Pure-JS Quantitative Solver & Monte Carlo Engine (100% offline, jalan di Web Worker & Node.js):
 *  - runLeagueMonteCarlo: simulasi sisa musim (N=3.000–10.000) -> xPts, P10/Median/P90, Juara%, Top4%, Degr%
 *  - runGroupTournamentMonteCarlo: simulasi turnamen grup (FIFA CWC / AFC Elite / Piala) + What-If +5%
 *  - runWonderkidFarmSim: simulasi ROI Smart Wonderkid Farming (% trofi vs kenaikan Market Value)
 *  - runTransferPortfolioOpt: Stage-1 filter + Stage-2 bundle search kombinasi Jual + Beli optimal
 *  - root.LFQuantRunner: client bridge Web Worker dengan auto-fallback sinkron
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const T = LF.tactics;

  function makeRng(seed) {
    let s = (seed >>> 0) || 20330629;
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function scaleSectorPow(pow, factor) {
    if (!pow || factor === 1) return pow;
    return {
      ...pow,
      ATK: pow.ATK * factor,
      MID: pow.MID * factor,
      DEF: pow.DEF * factor,
      atkCenter: (pow.atkCenter !== undefined ? pow.atkCenter : pow.ATK) * factor,
      atkWings: (pow.atkWings !== undefined ? pow.atkWings : pow.ATK) * factor,
    };
  }

  function runLeagueMonteCarlo(leagueInput, opts = {}) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const inp = (leagueInput && typeof leagueInput === 'object') ? leagueInput : {};
    const teams = Array.isArray(inp.teams) ? inp.teams : [];
    const unplayedRaw = Array.isArray(inp.unplayed) ? inp.unplayed : [];
    const M = teams.length;
    if (M < 2) {
      return { compId: inp.compId || '', compName: inp.compName || '', iterations: 0, unplayedCount: 0, farmMatchesCount: 0, elapsedMs: 0, table: [], userSummary: null };
    }

    const iterations = U.clamp(U.safeInt(opts.iterations, 5000), 100, 25000);
    const userPowerShift = U.safeNum(opts.userPowerShift, 0);
    const farmRule = String(opts.farmRule || 'NONE').toUpperCase();
    const weakXiCutoff = U.safeNum(opts.weakXiCutoff, 45);
    const userFarmPowH = opts.userFarmPowH || null;
    const userFarmPowA = opts.userFarmPowA || null;
    const advanceTop = U.clamp(U.safeInt(opts.advanceTop, 4), 1, M);
    const relegCount = U.clamp(U.safeInt(opts.relegCount, M >= 10 ? 3 : 0), 0, Math.max(0, M - 1));
    const userIdx = teams.findIndex(t => Boolean(t && t.isUser));

    let farmMatchesCount = 0;
    const matchProbs = [];
    for (let k = 0; k < unplayedRaw.length; k++) {
      const m = unplayedRaw[k];
      if (!m) continue;
      const hi = m.h;
      const ai = m.a;
      if (hi < 0 || hi >= M || ai < 0 || ai >= M) continue;
      const neutral = Boolean(m.neutral);
      const isUserH = hi === userIdx;
      const isUserA = ai === userIdx;
      let hPow = neutral && teams[hi].powA ? teams[hi].powA : teams[hi].powH;
      let aPow = teams[ai].powA || teams[ai].powH;

      if ((isUserH || isUserA) && farmRule !== 'NONE' && userFarmPowH && userFarmPowA) {
        const oppXi = isUserH ? U.safeNum(teams[ai].xi, 45) : U.safeNum(teams[hi].xi, 45);
        const useFarm = (farmRule === 'ALL')
          || (farmRule === 'HOME' && isUserH && !neutral)
          || (farmRule === 'HOME_OR_WEAK' && ((isUserH && !neutral) || oppXi < weakXiCutoff));
        if (useFarm) {
          farmMatchesCount++;
          if (isUserH) hPow = userFarmPowH;
          else aPow = userFarmPowA;
        }
      } else if (userPowerShift !== 0) {
        if (isUserH) hPow = scaleSectorPow(hPow, 1 + userPowerShift);
        if (isUserA) aPow = scaleSectorPow(aPow, 1 + userPowerShift);
      }

      const sim = T.simulateMatchExpectation(hPow, aPow, { isHome: !neutral, neutral });
      const pW = U.clamp(U.safeNum(sim.winPct, 33.3) / 100, 0, 1);
      const pD = U.clamp(U.safeNum(sim.drawPct, 33.3) / 100, 0, Math.max(0, 1 - pW));
      matchProbs.push({ hi, ai, pW, pD, xGF: U.safeNum(sim.xGF, 1.2), xGA: U.safeNum(sim.xGA, 1.0) });
    }

    const ptsSum = new Float64Array(M);
    const gdSum = new Float64Array(M);
    const posSum = new Float64Array(M);
    const titleCnt = new Int32Array(M);
    const top2Cnt = new Int32Array(M);
    const advCnt = new Int32Array(M);
    const relegCnt = new Int32Array(M);
    const posHist = new Int32Array(M);
    const userPtsArr = userIdx >= 0 ? new Int16Array(iterations) : null;

    const pts = new Int16Array(M);
    const gd = new Float32Array(M);
    const wins = new Int16Array(M);
    const basePts = teams.map(t => U.safeInt(t.pts, 0));
    const baseGd = teams.map(t => U.safeInt(t.gf, 0) - U.safeInt(t.ga, 0));
    const baseW = teams.map(t => U.safeInt(t.w, 0));
    const order = Array.from({ length: M }, (_, i) => i);
    const rnd = makeRng(opts.seed || 20330629);
    const relegCut = M - relegCount;

    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < M; i++) {
        pts[i] = basePts[i];
        gd[i] = baseGd[i];
        wins[i] = baseW[i];
      }
      for (let k = 0; k < matchProbs.length; k++) {
        const mp = matchProbs[k];
        const r = rnd();
        if (r < mp.pW) {
          pts[mp.hi] += 3;
          wins[mp.hi]++;
          const margin = Math.max(1, Math.round(1 + Math.max(0, mp.xGF - mp.xGA) + (rnd() - 0.5)));
          gd[mp.hi] += margin;
          gd[mp.ai] -= margin;
        } else if (r < mp.pW + mp.pD) {
          pts[mp.hi]++;
          pts[mp.ai]++;
        } else {
          pts[mp.ai] += 3;
          wins[mp.ai]++;
          const margin = Math.max(1, Math.round(1 + Math.max(0, mp.xGA - mp.xGF) + (rnd() - 0.5)));
          gd[mp.ai] += margin;
          gd[mp.hi] -= margin;
        }
      }
      order.sort((a, b) => (pts[b] - pts[a]) || (wins[b] - wins[a]) || (gd[b] - gd[a]));
      for (let pos = 0; pos < M; pos++) {
        const ti = order[pos];
        ptsSum[ti] += pts[ti];
        gdSum[ti] += gd[ti];
        posSum[ti] += (pos + 1);
        if (pos === 0) titleCnt[ti]++;
        if (pos < 2) top2Cnt[ti]++;
        if (pos < advanceTop) advCnt[ti]++;
        if (relegCount > 0 && pos >= relegCut) relegCnt[ti]++;
        if (ti === userIdx) {
          posHist[pos]++;
          userPtsArr[it] = pts[ti];
        }
      }
    }

    const table = teams.map((t, i) => ({
      id: t.id,
      name: t.name,
      isUser: Boolean(t.isUser),
      xi: U.roundTo(U.safeNum(t.xi, 0), 2),
      played: U.safeInt(t.played, 0),
      curPts: basePts[i],
      expPts: U.roundTo(ptsSum[i] / iterations, 1),
      expGD: U.roundTo(gdSum[i] / iterations, 1),
      expPos: U.roundTo(posSum[i] / iterations, 2),
      titlePct: U.roundTo((titleCnt[i] * 100) / iterations, 1),
      top2Pct: U.roundTo((top2Cnt[i] * 100) / iterations, 1),
      advancePct: U.roundTo((advCnt[i] * 100) / iterations, 1),
      top4Pct: U.roundTo((advCnt[i] * 100) / iterations, 1),
      relegPct: U.roundTo((relegCnt[i] * 100) / iterations, 1),
    })).sort((a, b) => (b.expPts - a.expPts) || (b.expGD - a.expGD));

    let userSummary = null;
    if (userIdx >= 0 && userPtsArr) {
      userPtsArr.sort();
      const rowU = table.find(r => r.isUser);
      userSummary = {
        ...rowU,
        p10: userPtsArr[Math.floor(iterations * 0.10)],
        p50: userPtsArr[Math.floor(iterations * 0.50)],
        p90: userPtsArr[Math.floor(iterations * 0.90)],
        posHist: Array.from(posHist).slice(0, Math.min(8, M)).map(c => U.roundTo((c * 100) / iterations, 1)),
      };
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return {
      compId: inp.compId || '',
      compName: inp.compName || '',
      iterations,
      unplayedCount: matchProbs.length,
      farmMatchesCount,
      elapsedMs: Math.round(t1 - t0),
      table,
      userSummary,
    };
  }

  function runGroupTournamentMonteCarlo(tourneyInput, opts = {}) {
    const ti = (tourneyInput && typeof tourneyInput === 'object') ? tourneyInput : {};
    const iters = U.clamp(U.safeInt(opts.iterations, 5000), 200, 15000);
    const adv = U.safeInt(ti.advance, 2);
    const baseline = runLeagueMonteCarlo(ti, {
      iterations: iters,
      advanceTop: adv,
      relegCount: 0,
      userPowerShift: 0,
    });
    const boost5 = runLeagueMonteCarlo(ti, {
      iterations: Math.min(3000, iters),
      advanceTop: adv,
      relegCount: 0,
      userPowerShift: 0.05,
    });
    return {
      id: ti.id || '',
      name: ti.name || '',
      kind: ti.kind || '',
      groupLabel: ti.groupLabel || '',
      advance: adv,
      baseline,
      boost5,
    };
  }

  function runWonderkidFarmSim(leagueInput, userRoster = [], bTeamRoster = [], meta = {}, opts = {}) {
    const numGems = U.clamp(U.safeInt(opts.numGems, 4), 1, 5);
    const weakXiCutoff = U.safeNum(opts.weakXiCutoff, 45);
    const iterations = U.clamp(U.safeInt(opts.iterations, 3000), 200, 10000);
    const fk = (meta && meta.activeFormation) || '4-3-3';
    const fCap = U.safeInt(meta && meta.foreignCap, 7);
    const country = (meta && meta.country) || '';
    const fullXi = T.solveBestXi(userRoster, fk, fCap, country);

    const eligibleFilter = p => p && !p.isTrap && !p.injured && U.safeInt(p.age, 25) <= 22 && (U.safeInt(p.potCap, 0) - U.safeInt(p.force, 0)) >= 10;
    const scoreGem = (a, b) => ((b.isSuperGem ? 1 : 0) - (a.isSuperGem ? 1 : 0))
      || (U.safeInt(b.potCap, 0) - U.safeInt(a.potCap, 0))
      || (U.safeInt(b.force, 0) - U.safeInt(a.force, 0));

    const bGems = (Array.isArray(bTeamRoster) ? bTeamRoster : []).filter(eligibleFilter).sort(scoreGem);
    const starterIds = new Set((fullXi.xi || []).map(s => s.player && s.player.id).filter(Boolean));
    const seniorBenchGems = (Array.isArray(userRoster) ? userRoster : [])
      .filter(p => !starterIds.has(p.id) && eligibleFilter(p))
      .sort(scoreGem);

    const pickedPool = [...bGems, ...seniorBenchGems];
    const seenGemIds = new Set();
    const selectedGems = [];
    const farmSlots = (fullXi.xi || []).map(s => ({ ...s }));
    const replacedSlotIdx = new Set();

    for (let i = 0; i < pickedPool.length && selectedGems.length < numGems; i++) {
      const gem = pickedPool[i];
      if (!gem || seenGemIds.has(gem.id)) continue;
      let bestIdx = -1;
      let bestScore = Infinity;
      for (let si = 0; si < farmSlots.length; si++) {
        if (replacedSlotIdx.has(si)) continue;
        const slot = farmSlots[si];
        const compat = T.slotCompatFactor(gem.pos, slot.slot);
        if (compat >= 0.85 && slot.player && slot.player.force < bestScore) {
          bestScore = slot.player.force;
          bestIdx = si;
        }
      }
      if (bestIdx >= 0) {
        seenGemIds.add(gem.id);
        replacedSlotIdx.add(bestIdx);
        const slot = farmSlots[bestIdx];
        const compat = T.slotCompatFactor(gem.pos, slot.slot);
        const effScore = U.roundTo(U.safeNum(gem.force, 20) * compat, 2);
        farmSlots[bestIdx] = { ...slot, player: gem, score: effScore };
        selectedGems.push(gem);
      }
    }

    const farmXiObj = {
      ...fullXi,
      xi: farmSlots,
      avgScore: farmSlots.length ? U.roundTo(farmSlots.reduce((s, x) => s + U.safeNum(x.score, 0), 0) / farmSlots.length, 2) : fullXi.avgScore,
    };
    const farmPowH = T.computeEngineSectorPower(farmXiObj, farmXiObj.formation, { isHome: true, crowdOver70: true });
    const farmPowA = T.computeEngineSectorPower(farmXiObj, farmXiObj.formation, { isHome: false, crowdOver70: true });

    const clubCtx = {
      level: U.safeInt(meta && meta.userTeamLevel, 8),
      country,
      europeTop5: U.countryGroup(country) === 0 && U.safeInt(meta && meta.userTeamLevel, 1) >= 21,
    };
    let totalMvNow = 0;
    let totalMvNext = 0;
    const gemsSummary = selectedGems.map(g => {
      const mvNow = g.marketValue > 0 ? g.marketValue : U.computeMarketValue({ ...g, isYouth: false }, clubCtx);
      const gainF = Math.min(Math.max(0, U.safeInt(g.potCap, g.force) - g.force), g.age <= 19 ? 6 : 5);
      const mvNext = U.computeMarketValue({ ...g, force: g.force + gainF, age: g.age + 1, isYouth: false }, clubCtx);
      const scaleMv = (g.marketValue > 0 && U.computeMarketValue({ ...g, isYouth: false }, clubCtx) > 0)
        ? Math.round(mvNow * (mvNext / U.computeMarketValue({ ...g, isYouth: false }, clubCtx)))
        : mvNext;
      const finalNext = Math.max(mvNext, scaleMv);
      totalMvNow += mvNow;
      totalMvNext += finalNext;
      return {
        id: g.id,
        name: g.name,
        pos: g.pos,
        age: g.age,
        force: g.force,
        potCap: g.potCap,
        gainF,
        isSuperGem: Boolean(g.isSuperGem),
        stackGrade: g.stackGrade || 'STD',
        source: bGems.some(b => b.id === g.id) ? 'bteam' : 'roster',
        mvNow,
        mvNext: finalNext,
        mvGain: Math.max(0, finalNext - mvNow),
      };
    });

    const defs = [
      { key: 'NONE', label: 'A. Best XI Penuh (0 Rotasi)' },
      { key: 'HOME', label: 'B. Farm Kandang Saja (Sweet-Spot)' },
      { key: 'HOME_OR_WEAK', label: `C. Smart Farm (Kandang / Rival XI <${weakXiCutoff})` },
      { key: 'ALL', label: 'D. Farm Semua Laga Liga' },
    ];
    const policies = defs.map(d => {
      const sim = runLeagueMonteCarlo(leagueInput, {
        iterations,
        farmRule: d.key,
        weakXiCutoff,
        userFarmPowH: farmPowH,
        userFarmPowA: farmPowA,
      });
      const u = sim.userSummary || {};
      return {
        key: d.key,
        label: d.label,
        farmMatches: sim.farmMatchesCount,
        unplayed: sim.unplayedCount,
        expPts: u.expPts || 0,
        titlePct: u.titlePct || 0,
        top4Pct: u.top4Pct || 0,
        relegPct: u.relegPct || 0,
      };
    });

    return {
      fullXiAvg: fullXi.avgScore,
      farmXiAvg: farmXiObj.avgScore,
      gems: gemsSummary,
      totalMvNow,
      totalMvNext,
      totalMvGain: Math.max(0, totalMvNext - totalMvNow),
      policies,
    };
  }

  function runTransferPortfolioOpt(input, opts = {}) {
    const inp = (input && typeof input === 'object') ? input : {};
    const roster = Array.isArray(inp.roster) ? inp.roster : [];
    const scoutPool = Array.isArray(inp.scoutPool) ? inp.scoutPool : [];
    const meta = (inp.meta && typeof inp.meta === 'object') ? inp.meta : {};
    const holeSet = new Set(Array.isArray(inp.holePositions) ? inp.holePositions : []);
    const mode = String(opts.mode || 'WIN').toUpperCase() === 'FLIP' ? 'FLIP' : 'WIN';
    const maxSells = U.clamp(U.safeInt(opts.maxSells, 2), 0, 2);
    const includeInstallments = Boolean(opts.includeInstallments);

    const fk = meta.activeFormation || '4-3-3';
    const fCap = U.safeInt(meta.foreignCap, 7);
    const fMax = U.safeInt(meta.foreignMax, 9);
    const hc = String(meta.country || '').toUpperCase();
    const budget = U.safeNum(meta.budget, 0);
    const debtRoom = U.safeNum(meta.transferDebtRoom, 0);
    const banned = Boolean(meta.transferBanned);

    if (!roster.length || !scoutPool.length) return [];

    const baseXi = T.solveBestXi(roster, fk, fCap, hc);
    const starterIds = new Set((baseXi.xi || []).map(s => s.player && s.player.id).filter(Boolean));
    const curForeign = roster.filter(p => Boolean(hc && p.nationality && String(p.nationality).toUpperCase() !== hc)).length;
    const gkCount = roster.filter(p => p.pos === 'G').length;

    // Stage 1: Kandidat Jual (tidak terkunci & tidak cedera — selalu sertakan kandidat asing jika kuota penuh)
    const rawSells = roster
      .filter(p => p && !p.freeSigned && !p.loanedFrom && !p.lastInPositionLock && !p.injured && !(p.pos === 'G' && gkCount <= 1))
      .map(p => {
        const inXi = starterIds.has(p.id);
        const gap = Math.max(0, U.safeInt(p.potCap, p.force) - U.safeInt(p.force, 0));
        const isF = Boolean(hc && p.nationality && String(p.nationality).toUpperCase() !== hc);
        const saleVal = Math.max(0, U.safeNum(p.estRealSale, U.safeNum(p.marketValue, 0)));
        let sellScore = (inXi ? -15 : 25) + (p.isDeclining ? 20 : 0) + (p.isTrap ? 18 : 0) + (isF && curForeign >= fCap ? 22 : 0) + (gap <= 2 ? 8 : 0) + (saleVal / 5e6);
        return { p, saleVal, isF, sellScore };
      })
      .sort((a, b) => b.sellScore - a.sellScore);
    const sellPool = [];
    const seenSellIds = new Set();
    for (const s of rawSells.slice(0, 7).concat(rawSells.filter(x => x.isF).slice(0, 4))) {
      if (!seenSellIds.has(s.p.id)) { seenSellIds.add(s.p.id); sellPool.push(s); }
    }

    // Stage 1: Kandidat Beli dari 32k scoutPool -> top 24 terbaik sesuai mode
    const rawBuys = [];
    for (let i = 0; i < scoutPool.length; i++) {
      const r = scoutPool[i];
      if (!r || !r[19]) continue;
      const fl = String(r[18] || '');
      if (fl.includes('REFUSE') || fl.includes('LAST_POS') || fl.includes('KEY_LOCK') || fl.includes('TRAP') || fl.includes('INJ')) continue;
      const isBosman = fl.includes('BOSMAN') || U.safeInt(r[15], 999) <= 180;
      const isFree = fl.includes('FREE');
      const effBuy = (isBosman || isFree) ? 0 : Math.max(0, U.safeNum(r[14], 0));
      const canInst = includeInstallments && !banned && !isBosman && !isFree && effBuy > 0 && U.safeInt(r[15], 999) > 180;
      const dpCost = canInst ? Math.round(effBuy * 0.25) : effBuy;
      const debtAdd = canInst ? (effBuy - dpCost) : 0;
      if (debtAdd > debtRoom) continue;

      const age = U.safeInt(r[2], 24);
      const force = U.safeInt(r[5], 20);
      const potCap = U.safeInt(r[7], force);
      const estResale = Math.max(0, U.safeNum(r[21], 0));
      const estProfit = estResale - effBuy;
      const isF = Boolean(hc && r[4] && String(r[4]).toUpperCase() !== hc);
      const sal3y = Math.round(U.safeNum(r[12], 0) * 0.95);

      if (mode === 'WIN') {
        if (force < Math.max(30, baseXi.avgScore - 6) && !holeSet.has(r[1])) continue;
      } else {
        if (age > 22 || r[11] === 1 || estProfit < 1500000) continue;
      }

      const roiPct = effBuy > 0 ? Math.round((estProfit * 100) / effBuy) : (estProfit > 0 ? 999 : 0);
      const preScore = mode === 'WIN'
        ? (force * 2.2 + (potCap - force) * 0.35 + (holeSet.has(r[1]) ? 12 : 0) + (isF ? -5 : 4) - (dpCost / 8e6))
        : ((estProfit / 1e6) * 2.4 + Math.min(300, roiPct) * 0.05 + (fl.includes('SGEM') ? 8 : 0) + (potCap - force) * 0.5 - (dpCost / 1e7));

      rawBuys.push({
        id: r[19], name: r[0], pos: r[1], age, foot: r[3], nat: r[4], force, potCap,
        s1: r[8], s2: r[9], stackPct: r[10] || 0, nonStack: Boolean(r[11]),
        salary: sal3y, marketValue: r[13] || 0, estBuy: r[14] || 0, isBosman: isBosman || isFree,
        effBuy, dpCost, debtAdd, estResale, estProfit, roiPct, isForeign: isF, club: r[16] || '', flags: fl, preScore,
        simPlayer: {
          id: r[19], name: r[0], pos: r[1], age, foot: r[3], nationality: r[4], force,
          s1: r[8], s2: r[9], stackPct: r[10] || 0, nonStack: Boolean(r[11]),
          energy: 100, integration: isF ? 60 : 80, rhythm: 1.0, star: r[20] === 1, top: r[20] === 2, injured: false, suspended: false,
        },
      });
    }
    rawBuys.sort((a, b) => b.preScore - a.preScore);
    const buyPool = [];
    const seenBuyCand = new Set();
    for (const b of rawBuys.slice(0, 18).concat(rawBuys.filter(x => !x.isForeign).slice(0, 8))) {
      if (!seenBuyCand.has(b.id)) { seenBuyCand.add(b.id); buyPool.push(b); }
    }
    if (!buyPool.length) return [];

    // Sell combinations (0, 1, or up to 2 sells capped to 25 combinations)
    const sellCombos = [[]];
    if (maxSells >= 1) {
      for (let i = 0; i < Math.min(8, sellPool.length); i++) sellCombos.push([sellPool[i]]);
    }
    if (maxSells >= 2) {
      let addedPairs = 0;
      for (let i = 0; i < Math.min(6, sellPool.length) && addedPairs < 16; i++) {
        for (let j = i + 1; j < Math.min(6, sellPool.length) && addedPairs < 16; j++) {
          if (sellPool[i].p.pos === 'G' && sellPool[j].p.pos === 'G' && gkCount <= 2) continue;
          sellCombos.push([sellPool[i], sellPool[j]]);
          addedPairs++;
        }
      }
    }

    // Buy combinations (singles from top 20 + pairs from top 10)
    const buyCombos = [];
    for (let i = 0; i < Math.min(20, buyPool.length); i++) buyCombos.push([buyPool[i]]);
    for (let i = 0; i < Math.min(10, buyPool.length); i++) {
      for (let j = i + 1; j < Math.min(10, buyPool.length); j++) {
        if (buyPool[i].pos === buyPool[j].pos && buyCombos.length > 55) continue;
        buyCombos.push([buyPool[i], buyPool[j]]);
      }
    }

    const rosterClean = roster.filter(Boolean);
    const foreignLimit = curForeign > fCap ? Math.min(curForeign, fMax) : fCap;
    const rankedBundles = [];

    for (let bi = 0; bi < buyCombos.length; bi++) {
      const buys = buyCombos[bi];
      const cashOut = buys.reduce((s, b) => s + b.dpCost, 0);
      const totalDebtAdd = buys.reduce((s, b) => s + b.debtAdd, 0);
      const buyF = buys.reduce((s, b) => s + (b.isForeign ? 1 : 0), 0);
      const buySal = buys.reduce((s, b) => s + b.salary, 0);
      const estFlipProfit = buys.reduce((s, b) => s + b.estProfit, 0);
      const totalEffBuy = buys.reduce((s, b) => s + b.effBuy, 0);
      if (totalDebtAdd > debtRoom) continue;

      for (let si = 0; si < sellCombos.length; si++) {
        const sells = sellCombos[si];
        const cashIn = sells.reduce((s, x) => s + x.saleVal, 0);
        const projBudget = budget + cashIn - cashOut;
        if (projBudget < 0) continue;

        const sellF = sells.reduce((s, x) => s + (x.isForeign ? 1 : 0), 0);
        const projForeign = curForeign - sellF + buyF;
        if (projForeign > foreignLimit) continue;

        const projSquad = rosterClean.length - sells.length + buys.length;
        if (projSquad < 16) continue;

        const sellIds = new Set(sells.map(x => x.p.id));
        const trialRoster = rosterClean.filter(p => !sellIds.has(p.id)).concat(buys.map(b => b.simPlayer));
        const newXi = T.solveBestXi(trialRoster, fk, fCap, hc);
        const deltaXi = U.roundTo(newXi.avgScore - baseXi.avgScore, 2);

        if (mode === 'WIN' && deltaXi <= 0.05 && !buys.some(b => holeSet.has(b.pos))) continue;
        if (mode === 'FLIP' && estFlipProfit <= 0) continue;

        const netCash = cashOut - cashIn;
        const sellSal = sells.reduce((s, x) => s + U.safeNum(x.p.salary, 0), 0);
        const salDelta = buySal - sellSal;
        const score = mode === 'WIN'
          ? (deltaXi * 100 + Math.min(25, estFlipProfit / 1e6) - Math.max(0, netCash) / 2e7 - sells.length * 1.5)
          : ((estFlipProfit / 1e6) + (deltaXi >= -0.35 ? 3 : -12) - Math.max(0, netCash) / 1.5e7 - sells.length * 0.5);

        rankedBundles.push({
          score,
          mode,
          sellPlayers: sells.map(s => ({
            id: s.p.id, name: s.p.name, pos: s.p.pos, age: s.p.age, force: s.p.force, estRealSale: s.saleVal, salary: s.p.salary,
          })),
          buyPlayers: buys.map(b => ({
            id: b.id, name: b.name, pos: b.pos, age: b.age, nat: b.nat, force: b.force, potCap: b.potCap,
            estBuy: b.estBuy, isBosman: b.isBosman, effBuy: b.effBuy, dpCost: b.dpCost, debtAdd: b.debtAdd,
            estResale: b.estResale, estProfit: b.estProfit, roiPct: b.roiPct, salary: b.salary, club: b.club, flags: b.flags,
          })),
          cashIn,
          cashOut,
          netCash,
          totalDebtAdd,
          salDelta,
          projBudget,
          projForeign,
          foreignCap: fCap,
          baseXiAvg: baseXi.avgScore,
          newXiAvg: newXi.avgScore,
          deltaXi,
          estFlipProfit,
          roiPct: totalEffBuy > 0 ? Math.round((estFlipProfit * 100) / totalEffBuy) : (estFlipProfit > 0 ? 999 : 0),
        });
      }
    }

    rankedBundles.sort((a, b) => b.score - a.score);
    const out = [];
    const seenBuyKeys = new Set();
    for (let i = 0; i < rankedBundles.length && out.length < 3; i++) {
      const b = rankedBundles[i];
      const bKey = b.buyPlayers.map(x => x.id).sort().join('|');
      if (seenBuyKeys.has(bKey)) continue;
      seenBuyKeys.add(bKey);
      out.push(b);
    }
    return out;
  }

  LF.quant = {
    makeRng,
    scaleSectorPow,
    runLeagueMonteCarlo,
    runGroupTournamentMonteCarlo,
    runWonderkidFarmSim,
    runTransferPortfolioOpt,
  };

  if (typeof window !== 'undefined') {
    let _worker = null;
    let _workerFailed = false;
    let _nextReq = 1;
    const _pending = new Map();

    function getWorker() {
      if (_workerFailed || typeof Worker === 'undefined' || (typeof location !== 'undefined' && location.protocol === 'file:')) return null;
      if (!_worker) {
        try {
          _worker = new Worker('./js/worker/quant_worker.js');
          _worker.onmessage = (ev) => {
            const msg = ev && ev.data;
            if (!msg || !msg.reqId) return;
            const entry = _pending.get(msg.reqId);
            if (!entry) return;
            _pending.delete(msg.reqId);
            if (msg.ok) entry.resolve(msg.result);
            else entry.reject(new Error(msg.error || 'Worker quant error'));
          };
          _worker.onerror = () => {
            _workerFailed = true;
            _worker = null;
            for (const [id, entry] of _pending.entries()) {
              _pending.delete(id);
              entry.fallback();
            }
          };
        } catch (_) {
          _workerFailed = true;
          return null;
        }
      }
      return _worker;
    }

    function execSync(cmd, payload) {
      const args = Array.isArray(payload) ? payload : [payload];
      if (typeof LF.quant[cmd] !== 'function') throw new Error('Unknown quant cmd: ' + cmd);
      return LF.quant[cmd](...args);
    }

    root.LFQuantRunner = {
      isWorkerSupported() {
        return typeof Worker !== 'undefined' && typeof location !== 'undefined' && location.protocol !== 'file:';
      },
      run(cmd, ...args) {
        const w = getWorker();
        if (!w) {
          return Promise.resolve().then(() => execSync(cmd, args));
        }
        return new Promise((resolve, reject) => {
          const reqId = _nextReq++;
          const timer = setTimeout(() => {
            if (_pending.has(reqId)) {
              _pending.delete(reqId);
              try { resolve(execSync(cmd, args)); } catch (err) { reject(err); }
            }
          }, 12000);
          _pending.set(reqId, {
            resolve: (res) => { clearTimeout(timer); resolve(res); },
            reject: (err) => { clearTimeout(timer); reject(err); },
            fallback: () => {
              clearTimeout(timer);
              try { resolve(execSync(cmd, args)); } catch (err) { reject(err); }
            },
          });
          try {
            w.postMessage({ reqId, cmd, args });
          } catch (_) {
            clearTimeout(timer);
            _pending.delete(reqId);
            try { resolve(execSync(cmd, args)); } catch (err) { reject(err); }
          }
        });
      },
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
