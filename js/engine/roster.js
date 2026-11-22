/**
 * LigaFoot Optimizer Web Engine — roster.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * - Ekstraksi `playerDynamic`, `extraRows`, `youthPlayers`, & `freePlayers`
 * - Chemistry (`ent[0]` integration & `rx` rhythm bitmask #21995)
 * - Salary Cut Lock (`salaryCuts >= 2` #3541), Termination Fee Tiers (#21000)
 * - Injured Sale Discount (#3542), Youth Scout Olheiro da Base (#23984), & Loan Buy-Option (#20496)
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const T = LF.tactics;

  function calcNetSaleProceeds(grossFee) {
    const tax = grossFee >= C.SELL_TAX_THRESHOLD ? C.SELL_TAX_HIGH : C.SELL_TAX_LOW;
    return Math.round(grossFee * (1.0 - tax));
  }

  function buildPlayerRecord(dynRaw, staticPlayers, isUserTeam = false, teamId = '', teamName = '', teamCountry = '', userDiv = 1) {
    const dyn = (dynRaw && typeof dynRaw === 'object') ? dynRaw : {};
    const pid = String(dyn.id || dyn.playerId || '');
    const stat = U.getStaticPlayer(staticPlayers, pid);

    const name = dyn.name || stat.name || pid || 'Unknown';
    let pos = String(dyn.position || dyn.pos || stat.pos || 'MC').toUpperCase();
    if (C.EXACT_CAT && !(pos in C.EXACT_CAT)) pos = 'MC';
    const foot = String(dyn.foot || stat.foot || 'D').toUpperCase();
    const nationality = String(dyn.nationality || stat.nationality || teamCountry || '').toUpperCase();
    const s1 = String(dyn.skill1 || dyn.s1 || stat.s1 || '').toUpperCase();
    const s2 = String(dyn.skill2 || dyn.s2 || stat.s2 || '').toUpperCase();

    const age = U.safeInt((dyn.age !== undefined && dyn.age !== null) ? dyn.age : stat.age, 22);
    const force = U.safeInt(dyn.force, U.safeInt(stat.force, 20));
    const potential = U.safeInt(dyn.potential, Math.max(force, U.safeInt(dyn.potCap, force)));
    const potCap = U.safeInt(dyn.potCap, potential);
    const hashVal = U.safeInt(('hash' in dyn && dyn.hash !== null && dyn.hash !== undefined) ? dyn.hash : stat.hash, Math.max(1, Math.min(10, Math.round(potCap / 10))));
    const growthFrac = U.roundTo(U.safeNum(dyn.growthFrac, 0.0), 3);
    const effForce = U.roundTo(force + growthFrac, 2);

    const salary = Math.round(U.safeNum(dyn.salary, 0));
    const marketValue = Math.round(U.safeNum(dyn.marketValue, 0));
    const contractYears = U.safeInt(dyn.contractYears, 1);
    const contractDays = (dyn.contractDays !== undefined && dyn.contractDays !== null)
      ? U.safeInt(dyn.contractDays, contractYears * 365)
      : (contractYears * 365);
    const energy = U.safeInt(dyn.energy, 100);

    const injured = Boolean(dyn.injured);
    const injuryDays = U.safeInt(dyn.injuryDays, U.safeInt(dyn.injuryWeeks, 0) * 7);
    const injTier = U.injuryTier(injuryDays);
    const injurySaleMul = injured ? U.injurySaleFactor(injuryDays) : 1.0;

    const suspended = Boolean(dyn.suspended);
    const starAwarded = Boolean(dyn.starAwarded);
    const star = Boolean((('star' in dyn) ? dyn.star : stat.star) || starAwarded);
    const top = Boolean(dyn.top);
    const forSale = Boolean(dyn.forSale);
    const loanable = Boolean(dyn.loanable);
    const loanedFrom = dyn.loanedFrom || null;
    const loanDays = U.safeInt(dyn.loanDays, 0);
    const loanBuyFee = Math.round(U.safeNum(dyn.loanBuyFee, 0));
    const squadRole = String(dyn.squadRole || 'auto');
    const noAutoRenew = Boolean(dyn.noAutoRenew);

    const salaryCuts = U.safeInt(dyn.salaryCuts, 0);
    const renewRefusals = U.safeInt(dyn.renewRefusals, 0);
    const salaryCutLocked = Boolean(salaryCuts >= C.SALARY_CUT.maxCuts); // #24159: hanya salaryCuts, bukan renewRefusals

    const ent = Array.isArray(dyn.ent) ? dyn.ent : null;
    const integration = T.integrationOf(dyn);
    const rx = (dyn.rx !== undefined && dyn.rx !== null) ? U.safeInt(dyn.rx, 7) : 7;
    const rhythm = U.roundTo(T.rhythmOf(dyn), 2);

    const seasonGoals = U.safeInt(dyn.seasonGoals !== undefined ? dyn.seasonGoals : dyn.goals, 0);
    const seasonAssists = U.safeInt(dyn.seasonAssists !== undefined ? dyn.seasonAssists : dyn.assists, 0);
    const careerGoals = U.safeInt(dyn.careerGoals, 0);
    const careerGames = U.safeInt(dyn.careerGames, 0);
    const seasonMinutes = Math.round(U.safeNum(dyn.seasonMinutes, 0));
    const seasonInjuryDays = U.safeInt(dyn.seasonInjuryDays, 0);

    const rawSlump = U.safeNum(dyn.fineSlump, 0.0);
    const fineSlumpPct = rawSlump > 0 ? U.roundTo(rawSlump <= 1.0 ? rawSlump * 100.0 : rawSlump, 1) : 0.0;
    const fineSlumpDays = U.safeInt(dyn.fineSlumpDays, 0);

    const boughtPrice = Math.round(U.safeNum(dyn.boughtPrice, 0));
    const boughtDate = dyn.boughtDate || null;
    const cardsByComp = (dyn.cardsByComp && typeof dyn.cardsByComp === 'object' && !Array.isArray(dyn.cardsByComp))
      ? dyn.cardsByComp
      : {};
    const matchRatings = Array.isArray(dyn.matchRatings) ? dyn.matchRatings : [];

    const stackInfo = T.evalSkillStacking(pos, s1, s2);
    const cat = U.posCategory(pos);
    const declineAge = (C.DECLINE_START_AGE && C.DECLINE_START_AGE[pos]) || U.getDeclineAge(pos);
    const sellWarnAge = declineAge - 1;
    const isDeclining = (age >= declineAge) || (growthFrac <= -0.15);

    const potGap = potCap - force;
    const isTrap = (potential - potCap) >= 4;
    const isGem = (potCap - potential) >= 4 || (age <= 22 && potGap >= 8) || (age <= 23 && potGap >= 6 && !stackInfo.nonStack);

    // Arbitrase Jual Counter +39% & +40% & Arab (2.5x–3.0x MV × 1.39x) + Jual Langsung v9 (INJURED_SALE + Pajak)
    const gross39 = Math.round(marketValue * C.COUNTER_AVG_REALIZED * injurySaleMul);
    const gross40 = Math.round(marketValue * C.COUNTER_MAX_NORMAL * injurySaleMul);
    const arabLowGross = Math.round(marketValue * (C.ARAB_OFFER_MIN_MUL || 2.50) * C.COUNTER_AVG_REALIZED * injurySaleMul);
    const arabHighGross = Math.round(marketValue * (C.ARAB_OFFER_MAX_MUL || 3.00) * C.COUNTER_AVG_REALIZED * injurySaleMul);
    const estCounter39 = calcNetSaleProceeds(gross39);
    const estCounter40 = calcNetSaleProceeds(gross40);
    const estArabLow = calcNetSaleProceeds(arabLowGross);
    const estArabHigh = calcNetSaleProceeds(arabHighGross);
    const estArabNet = estArabLow;

    const directSaleTaxRate = marketValue >= C.SELL_TAX_THRESHOLD ? C.SELL_TAX_HIGH : C.SELL_TAX_LOW;
    const estDirectSaleNet = Math.round(marketValue * injurySaleMul * (1.0 - directSaleTaxRate));

    // Pesangon Pemutusan Kontrak (#19789 terminationFeeRate)
    const termFeeRate = U.terminationFeeRate(contractDays);
    const estTerminationCost = Math.round(salary * (Math.max(0, contractDays) / 30.0) * termFeeRate);

    // Perpanjang 3 th (#24161): sisa >= 60 hari = -12% gaji; < 60 hari justru minta NAIK (+5% s.d. +20%)
    const renew3yrDelta = U.renewalSalaryDelta(contractDays, 3);
    const renew3yrSaveMonth = Math.round(salary * -renew3yrDelta); // negatif = tambahan biaya
    const doubleDipSaveYear = Math.round(salary * (1.0 - 0.88 * 0.88) * 12);

    // Youth Scout (Olheiro da Base #24197): age <= 21, raw (potential - force) >= 10, harga 2.0x MV
    const youthScoutGap = potential - force;
    const youthScoutEligible = Boolean(!isUserTeam && age <= C.YOUTH_SCOUT.maxAge && youthScoutGap >= C.YOUTH_SCOUT.minGrowthMargin && !forSale);
    const youthScoutPrice = Math.round(Math.max(10000, marketValue) * C.YOUTH_SCOUT.priceFactor);

    const retChance = U.retirementChance(age, pos, force, { top: Boolean(dyn.top), star: Boolean(dyn.star || stat.star || starAwarded) });
    const gamesPlayed = U.safeInt(dyn.gamesPlayed, Math.max(0, Math.round(seasonMinutes / 90.0)));
    const loanBuyChance = U.loanBuyDecisionChance({
      loanedFrom,
      loanBuyFee,
      seasonMinutes,
      seasonGames: gamesPlayed,
      seasonGoals,
      age,
      injured,
      marketValue,
    });
    const rawAvgR = U.safeNum(dyn.avgRating, 0.0);
    const avgRating = rawAvgR > 0
      ? U.roundTo(rawAvgR, 2)
      : (matchRatings.length
        ? U.roundTo(matchRatings.reduce((s, x) => s + U.safeNum(Array.isArray(x) ? x[0] : (x && x.rating), 6.5), 0) / matchRatings.length, 2)
        : 0.0);
    const salPerForce = Math.round(salary / Math.max(1, force));
    const clubHistory = Array.isArray(dyn.clubHistory) ? dyn.clubHistory : [];
    const honors = Array.isArray(dyn.honors) ? dyn.honors : [];
    const moodFrom = dyn.moodFrom || null;
    const nearDrop = growthFrac <= -0.75;
    const stackNote = stackInfo.nonStack
      ? 'Skill duplikat (tidak menumpuk di Match Engine v1.2.0)'
      : `Kombinasi skill memberi +${stackInfo.stackPct}% kontribusi sektor (Grade ${stackInfo.grade})`;

    return {
      id: pid,
      name,
      pos,
      cat,
      foot,
      nationality,
      age,
      force,
      effForce,
      growthFrac,
      nearDrop,
      potential,
      potCap,
      potGap,
      hash: hashVal,
      s1,
      s2,
      stackPct: stackInfo.stackPct,
      nonStack: stackInfo.nonStack,
      stackGrade: stackInfo.grade,
      stackNote,
      salary,
      salPerForce,
      marketValue,
      contractDays,
      contractYears,
      energy,
      injured,
      injuryDays,
      injuryTier: injTier,
      injurySaleMul,
      suspended,
      star,
      starAwarded,
      top,
      forSale,
      loanable,
      loanedFrom,
      loanDays,
      loanBuyFee,
      loanBuyChance,
      squadRole,
      noAutoRenew,
      salaryCuts,
      renewRefusals,
      salaryCutLocked,
      ent,
      integration,
      rx,
      rhythm,
      seasonGoals,
      seasonAssists,
      goals: seasonGoals,
      assists: seasonAssists,
      gamesPlayed,
      avgRating,
      careerGoals,
      careerGames,
      seasonMinutes,
      seasonInjuryDays,
      fineSlump: rawSlump,
      fineSlumpPct,
      fineSlumpDays,
      boughtPrice,
      boughtDate,
      cardsByComp,
      clubHistory,
      honors,
      moodFrom,
      declineAge,
      sellWarnAge,
      isDeclining,
      isTrap,
      isGem,
      estInitBid: marketValue,
      estRealSale: estCounter39,
      estCounter39,
      estCounter40,
      estArabNet,
      estArabLow,
      estArabHigh,
      directSaleTaxRate,
      estDirectSaleNet,
      termFeeRate,
      estTerminationCost,
      renew3yrSaveMonth,
      doubleDipSaveYear,
      youthScoutGap,
      youthScoutEligible,
      youthScoutPrice,
      retirementChance: retChance,
      teamId,
      teamName,
      teamCountry,
    };
  }

  function classifyUserAction(p, rankIdx, isTop5Arab, moodsMap) {
    const moodInfo = (moodsMap && moodsMap[p.id]) || {};
    const mood = moodInfo.mood || 'ok';

    if (p.injured && p.forSale) {
      return { action: 'TARIK DARI JUAL (PENALTI CEDERA!)', cls: 'b-red' };
    }

    if (p.contractDays >= C.RENEW_GOLDEN_MIN && p.contractDays <= C.RENEW_GOLDEN_MAX) {
      if (rankIdx < 16 || p.isGem || p.force >= 38) {
        return { action: 'RENEW 3TH SEKARANG (-12% GAJI, sisa ≥60h)', cls: 'b-gold' };
      }
      return { action: 'LEPAS GRATIS (HEMAT GAJI)', cls: 'b-muted' };
    }

    if (p.contractDays > 10 && p.contractDays < C.RENEWAL_DISCOUNT_FROM_DAYS) {
      if ((rankIdx < 14 || p.isGem || p.force >= 40) && !p.loanedFrom) {
        return { action: 'JANGAN RENEW (minta +5–15%) — tunggu ≤10h loophole', cls: 'b-amber' };
      }
      return { action: 'BIARKAN HABIS (JANGAN RENEW)', cls: 'b-muted' };
    }

    if (p.contractDays <= 10) {
      if ((rankIdx < 14 || p.isGem || p.force >= 40) && !p.loanedFrom) {
        if (p.noAutoRenew) {
          return { action: 'MATIKAN noAutoRenew → LOOPHOLE 0%', cls: 'b-red' };
        }
        return { action: 'LOOPHOLE AUTO-RENEW 0% (+180d)', cls: 'b-red' };
      }
      return { action: 'BIARKAN HABIS (JANGAN RENEW)', cls: 'b-muted' };
    }

    if (isTop5Arab && p.age >= p.sellWarnAge) {
      return { action: 'JUAL ARAB 1.4x + COUNTER +40%', cls: 'b-gold' };
    }
    if (p.isDeclining && rankIdx >= 11) {
      return { action: 'JUAL SEGERA (FASE REGRESI)', cls: 'b-red' };
    }
    if (p.isTrap && rankIdx >= 14) {
      return { action: 'JUAL FLIP (TRAP POTCAP)', cls: 'b-amber' };
    }
    if (mood === 'unhappy' && rankIdx >= 11) {
      return { action: 'SET ROLE RESERVE / ROTASI', cls: 'b-amber' };
    }
    if (p.isGem && (p.potCap - p.force) >= 6) {
      return { action: 'SLOT SPECIAL TRAINING', cls: 'b-cyan' };
    }
    if (rankIdx < 11) {
      return { action: 'INTI (STARTER XI)', cls: 'b-green' };
    }
    if (rankIdx < 18) {
      return { action: 'ROTASI / SUPERSUB', cls: 'b-blue' };
    }
    return { action: 'CADANGAN (SET RESERVE)', cls: 'b-muted' };
  }

  function extractTeamRoster(teamObj, staticPlayers, isUserTeam = false, teamId = '', teamName = '', teamCountry = '', userDiv = 1) {
    const tobj = (teamObj && typeof teamObj === 'object') ? teamObj : {};
    const seenIds = new Set();
    const roster = [];

    // Buat peta dynamic override dari playerDynamic (baik array maupun object)
    const dynMap = new Map();
    const rawDyn = tobj.playerDynamic;
    if (Array.isArray(rawDyn)) {
      for (const row of rawDyn) {
        const [pid, d] = U.parseDynamicRow(row);
        if (pid && d) dynMap.set(pid, d);
      }
    } else if (rawDyn && typeof rawDyn === 'object') {
      for (const [pid, dObj] of Object.entries(rawDyn)) {
        if (dObj && typeof dObj === 'object') {
          dynMap.set(pid, { ...dObj, id: dObj.id || pid });
        }
      }
    }

    // #22553 & #22557: Iterasi tobj.playerIds terlebih dahulu (menggabungkan staticPlayers[pid] + dynMap.get(pid))
    // Penting untuk klub AI di compactTeams yang pemainnya tidak mengalami perubahan dinamis!
    if (Array.isArray(tobj.playerIds)) {
      for (const rawPid of tobj.playerIds) {
        const pid = String(rawPid || '').trim();
        if (!pid || seenIds.has(pid)) continue;
        const dObj = dynMap.get(pid) || { id: pid };
        seenIds.add(pid);
        roster.push(buildPlayerRecord(dObj, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    // Tambahkan entri playerDynamic yang mungkin belum ada di playerIds
    for (const [pid, dObj] of dynMap.entries()) {
      if (!seenIds.has(pid)) {
        seenIds.add(pid);
        roster.push(buildPlayerRecord(dObj, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    // Tambahkan extraRows (pemain regens / promosi akademi / transfer tambahan)
    for (const row of (Array.isArray(tobj.extraRows) ? tobj.extraRows : [])) {
      const [pid, d] = U.parseExtraRow(row);
      if (pid && !seenIds.has(pid)) {
        seenIds.add(pid);
        roster.push(buildPlayerRecord(d, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    const youth = [];
    for (const yRow of (Array.isArray(tobj.youthPlayers) ? tobj.youthPlayers : [])) {
      if (!yRow || typeof yRow !== 'object') continue;
      const yRec = buildPlayerRecord({ ...yRow, isYouth: true }, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv);
      yRec.development = U.safeInt(yRow.development, 50);
      yRec.isYouth = true;
      youth.push(yRec);
    }

    roster.sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));
    return { roster, youth };
  }

  LF.roster = {
    calcNetSaleProceeds,
    buildPlayerRecord,
    classifyUserAction,
    extractTeamRoster,
  };
})(typeof window !== 'undefined' ? window : globalThis);
