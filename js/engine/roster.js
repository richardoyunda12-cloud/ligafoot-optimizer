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

  function buildPlayerRecord(dyn, staticPlayers, isUserTeam = false, teamId = '', teamName = '', teamCountry = '', userDiv = 1) {
    const pid = String(dyn.id || dyn.playerId || '');
    const stat = U.getStaticPlayer(staticPlayers, pid);

    const name = dyn.name || stat.name || pid || 'Unknown';
    const pos = dyn.pos || stat.pos || 'MC';
    const foot = (dyn.foot || stat.foot || 'D').toUpperCase();
    const nationality = (dyn.nationality || stat.nationality || teamCountry || '').toUpperCase();
    const s1 = (dyn.s1 || stat.s1 || '').toUpperCase();
    const s2 = (dyn.s2 || stat.s2 || '').toUpperCase();

    const age = U.safeInt(dyn.age, 22);
    const force = U.safeInt(dyn.force, 20);
    const potential = U.safeInt(dyn.potential, force);
    const potCap = U.safeInt(dyn.potCap, potential);
    const hashVal = U.safeInt(dyn.hash, Math.max(1, Math.min(10, Math.round(potCap / 10))));
    const growthFrac = U.roundTo(U.safeNum(dyn.growthFrac, 0.0), 3);
    const effForce = U.roundTo(force + growthFrac, 2);

    const salary = Math.round(U.safeNum(dyn.salary, 0));
    const marketValue = Math.round(U.safeNum(dyn.marketValue, 0));
    const contractDays = U.safeInt(dyn.contractDays, 365);
    const contractYears = U.safeInt(dyn.contractYears, Math.max(1, Math.round(contractDays / 365)));
    const energy = U.safeInt(dyn.energy, 100);

    const injured = Boolean(dyn.injured);
    const injuryDays = U.safeInt(dyn.injuryDays, 0);
    const injTier = U.injuryTier(injuryDays);
    const injurySaleMul = injured ? U.injurySaleFactor(injuryDays) : 1.0;

    const suspended = Boolean(dyn.suspended);
    const starAwarded = Boolean(dyn.starAwarded);
    const star = Boolean(dyn.star || stat.star || starAwarded);
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
    const salaryCutLocked = Boolean(salaryCuts >= 2 || renewRefusals >= 2);

    const ent = Array.isArray(dyn.ent) ? dyn.ent : null;
    const integration = T.integrationOf(dyn);
    const rx = (dyn.rx !== undefined && dyn.rx !== null) ? U.safeInt(dyn.rx, 7) : 7;
    const rhythm = U.roundTo(T.rhythmOf(dyn), 2);

    const seasonGoals = U.safeInt(dyn.seasonGoals, 0);
    const seasonAssists = U.safeInt(dyn.seasonAssists, 0);
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
    const declineAge = U.getDeclineAge(pos);
    const sellWarnAge = U.getSellWarnAge(pos);
    const isDeclining = age >= declineAge;

    const potGap = potCap - force;
    const isTrap = (potential - potCap >= 4) && (potGap <= 2) && (age <= 24);
    const isGem = (potGap >= 6) && (age <= 23) && !stackInfo.nonStack;

    // Arbitrase Jual Counter +39% & +40% & Arab 1.4x + Jual Langsung v9 (INJURED_SALE + Pajak)
    const gross39 = Math.round(marketValue * C.COUNTER_AVG_REALIZED * injurySaleMul);
    const gross40 = Math.round(marketValue * C.COUNTER_MAX_NORMAL * injurySaleMul);
    const grossArab = Math.round(marketValue * C.COUNTER_ARAB_BONUS * C.COUNTER_AVG_REALIZED * injurySaleMul);
    const estCounter39 = calcNetSaleProceeds(gross39);
    const estCounter40 = calcNetSaleProceeds(gross40);
    const estArabNet = calcNetSaleProceeds(grossArab);

    const directSaleTaxRate = marketValue >= C.SELL_TAX_THRESHOLD ? C.SELL_TAX_HIGH : C.SELL_TAX_LOW;
    const estDirectSaleNet = Math.round(marketValue * injurySaleMul * (1.0 - directSaleTaxRate));

    // Pesangon Pemutusan Kontrak (#21000 terminationFeeRate)
    const termFeeRate = U.terminationFeeRate(contractDays);
    const estTerminationCost = Math.round(salary * (Math.max(0, contractDays) / 30.0) * termFeeRate);

    // Golden Window (11-59 hari): Renew 3 Tahun = -12% gaji
    const renew3yrSaveMonth = Math.round(salary * C.RENEW_DISCOUNT_3YR);
    const doubleDipSaveYear = Math.round(salary * (1.0 - 0.88 * 0.88) * 12);

    // Youth Scout (Olheiro da Base #23984): age <= 21, (potential - force) + max(0, hash - 6)*2 >= 10
    const youthScoutGap = (potential - force) + Math.max(0, hashVal - 6) * 2;
    const youthScoutEligible = Boolean(!isUserTeam && age <= C.YOUTH_SCOUT.maxAge && youthScoutGap >= C.YOUTH_SCOUT.minGrowthMargin && !forSale);
    const youthScoutPrice = Math.round(Math.max(10000, marketValue) * C.YOUTH_SCOUT.priceFactor);

    const retChance = U.retirementChance(age, pos, force);
    const loanBuyChance = U.loanBuyDecisionChance({
      loanedFrom,
      loanBuyFee,
      seasonMinutes,
      seasonGoals,
      matchRatings,
      marketValue,
    });

    const gamesPlayed = Math.max(0, Math.round(seasonMinutes / 90.0));
    const avgRating = matchRatings.length
      ? U.roundTo(matchRatings.reduce((s, x) => s + U.safeNum(x, 6.5), 0) / matchRatings.length, 2)
      : '-';
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
      estArabLow: estArabNet,
      estArabHigh: Math.round(estArabNet * 1.15),
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
        return { action: 'RENEW 3TH (-12% GAJI)', cls: 'b-gold' };
      }
      return { action: 'LEPAS GRATIS (HEMAT GAJI)', cls: 'b-muted' };
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
    const rawDyn = (teamObj && teamObj.playerDynamic && typeof teamObj.playerDynamic === 'object')
      ? teamObj.playerDynamic
      : {};
    const extraRows = Array.isArray(teamObj && teamObj.extraRows) ? teamObj.extraRows : [];
    const seenIds = new Set();
    const roster = [];

    for (const [pid, dObj] of Object.entries(rawDyn)) {
      if (!dObj || typeof dObj !== 'object') continue;
      const merged = { ...dObj, id: dObj.id || pid };
      const rec = buildPlayerRecord(merged, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv);
      seenIds.add(rec.id);
      roster.push(rec);
    }

    for (const row of extraRows) {
      if (!row || typeof row !== 'object') continue;
      const rid = String(row.id || row.playerId || '');
      if (rid && seenIds.has(rid)) continue;
      const rec = buildPlayerRecord(row, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv);
      seenIds.add(rec.id);
      roster.push(rec);
    }

    const youth = [];
    for (const yRow of (Array.isArray(teamObj && teamObj.youthPlayers) ? teamObj.youthPlayers : [])) {
      if (!yRow || typeof yRow !== 'object') continue;
      const yRec = buildPlayerRecord(yRow, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv);
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
