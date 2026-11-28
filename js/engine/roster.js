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

  // Bytecode #25088 saleFeeRate = terminationFeeRate(contractDays) (Fixed/Auction/SellNow/PurchaseOffers),
  // sementara unsolicited incoming offer (#25025, termasuk Arab) memiliki noTerminationFee: true (0% fee).
  function calcNetSaleProceeds(grossFee, contractDays = 0, isIncomingOffer = false) {
    const feeRate = isIncomingOffer ? 0.0 : U.terminationFeeRate(contractDays);
    return Math.round(grossFee * (1.0 - feeRate));
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

    const rawSalary = Math.round(U.safeNum(dyn.salary, 0));
    const loanShare = (typeof dyn.loanShare === 'number' && Number.isFinite(dyn.loanShare)) ? dyn.loanShare : 1.0;
    const salary = Math.round(rawSalary * loanShare);
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
    const forSalePrice = Math.round(U.safeNum(dyn.forSalePrice, 0));
    const freeSigned = Boolean(dyn.freeSigned);
    const loanable = Boolean(dyn.loanable);
    const loanedFrom = dyn.loanedFrom || null;
    const loanDays = U.safeInt(dyn.loanDaysLeft !== undefined ? dyn.loanDaysLeft : dyn.loanDays, 0);
    const loanBuyFee = Math.round(U.safeNum(dyn.loanBuyPrice !== undefined ? dyn.loanBuyPrice : dyn.loanBuyFee, 0));
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
    const paidIn = (dyn.paidIn && typeof dyn.paidIn === 'object') ? dyn.paidIn : null;
    const cardsByComp = (dyn.cardsByComp && typeof dyn.cardsByComp === 'object' && !Array.isArray(dyn.cardsByComp))
      ? dyn.cardsByComp
      : {};

    const stackInfo = T.evalSkillStacking(pos, s1, s2);
    const cat = U.posCategory(pos);
    const isRealScale = Boolean(C && C._activeRealScale);
    const declineAge = U.getDeclineAge(pos, isRealScale);
    const sellWarnAge = declineAge - 1;
    const isDeclining = (age >= declineAge) || (growthFrac <= -0.15);

    const potGap = potCap - force;
    const isTrap = (potential - potCap) >= 4;
    const isGem = (potCap - potential) >= 4 || (age <= 22 && potGap >= 8) || (age <= 23 && potGap >= 6 && !stackInfo.nonStack);
    const isSuperGem = Boolean(
      isGem && !isTrap && !stackInfo.nonStack && (
        (potCap >= 70 && age <= 22 && potGap >= 15)
        || (potCap - potential >= 25 && age <= 21 && potGap >= 20)
      )
    );

    // #25088 saleFeeRate (terminationFeeRate kontrak untuk jual manual) vs #25025/#25089/#25091 (incoming & Arab 0% fee!)
    let termFeeRate = 0, directSaleTaxRate = 0, estDirectSaleNet = 0, estFixedMaxNet = 0;
    let estAuctionLowNet = 0, estAuctionHighNet = 0, estIncomingBase = 0;
    let estCounter25 = 0, estCounter40 = 0, estArabLow = 0, estArabHigh = 0, estArabNet = 0;
    let estTerminationCost = 0, renew3yrSaveMonth = 0, doubleDipSaveYear = 0;
    if (isUserTeam) {
      termFeeRate = U.terminationFeeRate(contractDays);
      const effMV = Math.round(marketValue * injurySaleMul);
      const aiOfferMap = C.AI_OFFER_MUL || { young: 1.50, mid: 1.35, old: 1.30 };
      const aiOfferMul = age < 20 ? aiOfferMap.young : (age <= 24 ? aiOfferMap.mid : aiOfferMap.old);
      const gross25 = Math.round(effMV * C.COUNTER_AVG_REALIZED);
      const gross40 = Math.round(effMV * C.COUNTER_MAX_NORMAL);
      const arabLowGross = Math.round(effMV * (C.ARAB_OFFER_MIN_MUL || 2.50));
      const arabHighGross = Math.round(effMV * (C.ARAB_OFFER_MAX_MUL || 3.00));
      // Incoming offer (normal & Arab) memiliki noTerminationFee: true (0% potongan); Arab negotiated: true (tidak bisa di-counter!)
      estCounter25 = calcNetSaleProceeds(gross25, contractDays, true);
      estCounter40 = calcNetSaleProceeds(gross40, contractDays, true);
      estArabLow = calcNetSaleProceeds(arabLowGross, contractDays, true);
      estArabHigh = calcNetSaleProceeds(arabHighGross, contractDays, true);
      estArabNet = estArabLow;

      // Jual langsung / Purchase Offers / Fixed / Auction dikenai saleFeeRate = terminationFeeRate(contractDays)
      directSaleTaxRate = termFeeRate;
      estDirectSaleNet = calcNetSaleProceeds(effMV, contractDays, false);
      estFixedMaxNet = calcNetSaleProceeds(Math.round(effMV * (C.PURCHASE_OFFER_MAX_ASK_MUL || 1.10)), contractDays, false);
      estAuctionLowNet = calcNetSaleProceeds(Math.round(effMV * 0.85), contractDays, false);
      estAuctionHighNet = calcNetSaleProceeds(Math.round(effMV * (C.AUCTION_MAX_MUL || 1.20)), contractDays, false);
      estIncomingBase = Math.round(effMV * aiOfferMul);

      // Pesangon Pemutusan Kontrak (#20274 terminationFeeRate)
      estTerminationCost = Math.round(salary * (Math.max(0, contractDays) / 30.0) * termFeeRate);

      // Perpanjang 3 th (#24161): sisa >= 60 hari = -12% gaji; < 60 hari justru minta NAIK (+5% s.d. +20%)
      const renew3yrDelta = U.renewalSalaryDelta(contractDays, 3);
      renew3yrSaveMonth = Math.round(salary * -renew3yrDelta); // negatif = tambahan biaya
      doubleDipSaveYear = Math.round(salary * (1.0 - 0.88 * 0.88) * 12);
    }

    // Valuasi Olheiro da Base U-21 (#25091: incoming AI scout offer max(potentialMV * 0.6, MV * 2))
    const youthScoutGap = potential - force;
    const youthScoutEligible = Boolean(!isUserTeam && age <= C.YOUTH_SCOUT.maxAge && youthScoutGap >= C.YOUTH_SCOUT.minGrowthMargin && !forSale);
    const youthScoutPrice = youthScoutEligible ? Math.round(Math.max(10000, marketValue) * C.YOUTH_SCOUT.priceFactor) : 0;

    const retChance = isUserTeam ? U.retirementChance(age, pos, force, { top: Boolean(dyn.top), star: Boolean(dyn.star || stat.star || starAwarded) }) : 0;
    const gamesPlayed = U.safeInt(dyn.gamesPlayed, Math.max(0, Math.round(seasonMinutes / 90.0)));
    const matchRatings = (isUserTeam && Array.isArray(dyn.matchRatings)) ? dyn.matchRatings : [];
    const rawAvgR = U.safeNum(dyn.avgRating, 0.0);
    const avgRating = rawAvgR > 0
      ? U.roundTo(rawAvgR, 2)
      : (matchRatings.length
        ? U.roundTo(matchRatings.reduce((s, x) => s + U.safeNum(Array.isArray(x) ? x[0] : (x && x.rating), 6.5), 0) / matchRatings.length, 2)
        : 0.0);
    const loanBuyChance = (isUserTeam || loanedFrom)
      ? U.loanBuyDecisionChance({
          loanedFrom,
          loanBuyPrice: loanBuyFee,
          loanBuyFee,
          seasonGames: gamesPlayed,
          avgRating,
          forceTo: force,
          forceFrom: U.safeNum(dyn.loanForceFrom ?? dyn.forceFrom, force),
          marketValue,
        })
      : 0;
    const salPerForce = Math.round(salary / Math.max(1, force));
    const clubHistory = isUserTeam && Array.isArray(dyn.clubHistory) ? dyn.clubHistory : [];
    const honors = isUserTeam && Array.isArray(dyn.honors) ? dyn.honors : [];
    const moodFrom = isUserTeam ? (dyn.moodFrom || null) : null;
    const roleSore = Boolean(dyn.roleSore);
    const raiseSore = Boolean(dyn.raiseSore);
    const nearDrop = growthFrac <= -0.75;
    const stackNote = isUserTeam
      ? (stackInfo.nonStack
        ? 'Skill duplikat (tidak menumpuk di Match Engine v1.2.0)'
        : `Kombinasi skill memberi +${stackInfo.stackPct}% kontribusi sektor (Grade ${stackInfo.grade})`)
      : '';

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
      paidIn,
      nonStack: stackInfo.nonStack,
      stackGrade: stackInfo.grade,
      stackNote,
      salary,
      rawSalary,
      loanShare,
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
      forSalePrice,
      freeSigned,
      loanable,
      loanedFrom,
      loanDays,
      loanDaysLeft: loanDays,
      loanBuyFee,
      loanBuyPrice: loanBuyFee,
      loanBuyChance,
      squadRole,
      roleSore,
      raiseSore,
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
      isSuperGem,
      estInitBid: marketValue,
      estIncomingBase,
      estRealSale: estCounter25,
      estCounter25,
      estCounter39: estCounter25,
      estCounter40,
      estFixedMaxNet,
      estAuctionLowNet,
      estAuctionHighNet,
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
      return { action: 'ARAB WATCH (2.5–3.0x MV, 0% FEE)', cls: 'b-gold' };
    }
    if (rankIdx < 5 && p.age === 25 && p.force >= 42) {
      return { action: 'TAHAN S.D. 26TH (BUKA ARAB 2.5–3x)', cls: 'b-gold' };
    }
    if (p.isDeclining && rankIdx >= 11) {
      return { action: 'JUAL SEGERA (FASE REGRESI)', cls: 'b-red' };
    }
    if (p.isTrap && rankIdx >= 14) {
      return { action: 'JUAL FLIP (TRAP POTCAP)', cls: 'b-amber' };
    }
    if (p.force >= p.potCap && p.age >= 24 && rankIdx >= 11 && !p.isGem) {
      return { action: 'MENTOK POTCAP — JUAL (+40% CTR)', cls: 'b-amber' };
    }
    if (mood === 'unhappy' && rankIdx >= 11) {
      return { action: 'SET ROLE RESERVE / ROTASI', cls: 'b-amber' };
    }
    if ((p.isGem && (p.potCap - p.force) >= 6) || ((p.potCap - p.force) >= 6 && p.age <= 22)) {
      return { action: `SLOT TRAINING (+${p.potCap - p.force}F RUANG)`, cls: 'b-cyan' };
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

    // Buat peta extraRows (pemain regens / promosi akademi / transfer tambahan) SEBELUM iterasi playerIds
    const extraMap = new Map();
    for (const row of (Array.isArray(tobj.extraRows) ? tobj.extraRows : [])) {
      const [pid, d] = U.parseExtraRow(row);
      if (pid && d) extraMap.set(pid, d);
    }

    // #22553 & #22557: Iterasi tobj.playerIds terlebih dahulu (menggabungkan extraRows + playerDynamic + staticPlayers[pid])
    // Penting untuk klub AI di compactTeams yang pemainnya tidak mengalami perubahan dinamis,
    // sekaligus menjaga atribut pemain regen/akademi yang tersimpan di extraRows!
    if (Array.isArray(tobj.playerIds)) {
      for (const rawPid of tobj.playerIds) {
        const pid = String(rawPid || '').trim();
        if (!pid || seenIds.has(pid)) continue;
        const ex = extraMap.get(pid);
        const dy = dynMap.get(pid);
        const dObj = (ex && dy) ? { ...ex, ...dy, id: pid } : (dy || ex || { id: pid });
        seenIds.add(pid);
        roster.push(buildPlayerRecord(dObj, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    // Tambahkan entri playerDynamic atau extraRows yang mungkin belum ada di playerIds
    for (const [pid, dObj] of dynMap.entries()) {
      if (!seenIds.has(pid)) {
        const ex = extraMap.get(pid);
        seenIds.add(pid);
        roster.push(buildPlayerRecord(ex ? { ...ex, ...dObj, id: pid } : dObj, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    for (const [pid, dObj] of extraMap.entries()) {
      if (!seenIds.has(pid)) {
        seenIds.add(pid);
        roster.push(buildPlayerRecord(dObj, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv));
      }
    }

    const YOUTH_PEAK_RANGES = [
      [25, 30], [27, 33], [30, 36], [33, 39], [36, 43],
      [40, 48], [45, 53], [51, 60], [58, 68], [66, 78],
    ];
    const youth = [];
    for (const yRow of (Array.isArray(tobj.youthPlayers) ? tobj.youthPlayers : [])) {
      if (!yRow || typeof yRow !== 'object') continue;
      const yRec = buildPlayerRecord({ ...yRow, isYouth: true }, staticPlayers, isUserTeam, teamId, teamName, teamCountry, userDiv);
      yRec.development = U.safeInt(yRow.development, 50);
      yRec.isYouth = true;
      // Bytecode #22569 youthPeakEstimate (range 1..100 skala v9, sudah dinormalisasi)
      const rawStar = U.safeInt(yRow.shownPotential !== undefined && yRow.shownPotential !== null ? yRow.shownPotential : yRec.hash, 1);
      const potStar = U.clamp(yRec.star ? Math.max(8, rawStar) : rawStar, 1, 10);
      const rng = YOUTH_PEAK_RANGES[potStar - 1] || [25, 30];
      const starBump = yRec.star ? 4 : 0;
      const basePeak = Math.round(((rng[0] + rng[1]) / 2) / 5) * 5;
      const estPeak = Math.min(86, Math.round((basePeak + starBump) / 5) * 5);
      yRec.estPotRange = [Math.min(86, rng[0] + starBump), Math.min(86, rng[1] + starBump)];
      yRec.estPotCap = Math.max(yRec.force, estPeak);
      if (yRow.potential === undefined || yRow.potential === null) {
        yRec.potential = Math.max(yRec.force, Math.round((rng[0] + rng[1]) / 2));
      }
      if (yRow.potCap === undefined || yRow.potCap === null) {
        yRec.potCap = yRec.estPotCap;
        yRec.potGap = yRec.potCap - yRec.force;
      }
      youth.push(yRec);
    }

    roster.sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));
    return { roster, youth };
  }

  /**
   * Simulasi ETA mencapai PotCap berdasarkan #22061 weeklyGrowthRate & trainGrowthBonus.
   */
  function estimatePeakEta(age, force, potCap, growthFrac = 0, clubLevel = 12, ctLevel = 1, declineAge = 32, opts = {}) {
    const a0 = U.safeInt(age, 20);
    const f0 = U.safeInt(force, 20);
    const cap = U.safeInt(potCap, f0);
    if (f0 >= cap || a0 >= declineAge) return null;

    const o = (opts && typeof opts === 'object') ? opts : {};
    const lv = U.clamp(U.safeInt(clubLevel, 12), 1, 25);
    const ct = U.clamp(U.safeInt(ctLevel, 1), 1, 10);

    function runSim(played, trained) {
      let curAge = a0;
      let curF = f0;
      let gf = U.clamp(U.safeNum(growthFrac, 0), -0.99, 0.99);
      let weeks = 0;
      const maxWeeks = Math.max(1, (declineAge - curAge) * 52);
      while (curF < cap && weeks < maxWeeks) {
        const rate = U.estimateWeeklyGrowthRate(
          {
            age: curAge,
            force: curF,
            top: Boolean(o.top),
            star: Boolean(o.star),
            development: o.development || 0,
            hash: o.hash || 0,
          },
          { clubLevel: lv, ctLevel: ct, played, inTrain: trained, unhappy: Boolean(o.unhappy), country: o.country || '' }
        );
        gf += rate;
        while (gf >= 1.0 && curF < cap) {
          gf -= 1.0;
          curF++;
        }
        weeks++;
        if (weeks % 52 === 0) curAge++;
      }
      return {
        reached: curF >= cap,
        endForce: curF,
        peakAge: U.roundTo(a0 + weeks / 52, 1),
        years: U.roundTo(weeks / 52, 1),
        weeks,
      };
    }

    return {
      train: runSim(true, true),
      normal: runSim(true, false),
    };
  }

  LF.roster = {
    calcNetSaleProceeds,
    buildPlayerRecord,
    classifyUserAction,
    extractTeamRoster,
    estimatePeakEta,
  };
})(typeof window !== 'undefined' ? window : globalThis);
