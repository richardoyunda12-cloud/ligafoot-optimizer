/**
 * LigaFoot Optimizer Web Engine — economy.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * - priceFactor(m, e) (#21317) dengan clamp [0.10, 1.35]
 * - Member Plan v9 (#21325–#21339, #3525): puncak eksak 1.05x + Diskon Tahunan 6%
 * - Club Shop v9 (#21319–#21324): puncak 1.00x + Hype Signings berbasis PAYROLL_REF tahunan (#19856)
 * - Stadium Attendance & Ticket Demand v9 (#19903, #19904, #19907, #19915, #34244)
 * - Arus Kas Bulanan & Proyeksi (#21866, #19866 tvQuotaMonthly, #19869 fixedSponsorParcel, #21495 ctUpkeep)
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;

  const SECTORS = ['geral', 'arquibancada', 'cadeiras', 'camarotes'];

  // Bytecode #21255 priceFactor(m, e) -> clamp(Math.exp(-lin*d - quad*d*d), 0.1, 1.35)
  function priceFactorV9(m, elast) {
    const d = U.safeNum(m, 1.0) - 1.0;
    const quad = d >= 0 ? elast.up : elast.down;
    const raw = Math.exp(-elast.lin * d - quad * (d * d));
    const pMin = C.PRICE_FACTOR_MIN !== undefined ? C.PRICE_FACTOR_MIN : 0.1;
    const pMax = C.PRICE_FACTOR_MAX !== undefined ? C.PRICE_FACTOR_MAX : 1.35;
    return U.clamp(raw, pMin, pMax);
  }

  // Bytecode #21322–#21339 & #3525: Member Plan v9
  function evalMemberPlan(memberPlanObj, membersCount, fanConf = 70, country = 'OTHER', division = 1, repLvl = 3) {
    const mp = (memberPlanObj && typeof memberPlanObj === 'object') ? memberPlanObj : {};
    const curM = U.clamp(U.safeNum(mp.priceMul !== undefined ? mp.priceMul : mp.m, 1.0), C.MEMBER_PRICE_MIN, C.MEMBER_PRICE_MAX);
    let curD = U.safeNum(mp.discount !== undefined ? mp.discount : mp.d, 0.0);
    if (curD > 0 && curD < 1.0) {
      curD = Math.round(curD * 100);
    }
    curD = U.clamp(U.safeInt(curD, 0), 0, C.MEMBER_DISC_MAX);
    const rawN = (membersCount && typeof membersCount === 'object')
      ? (membersCount.n !== undefined ? membersCount.n : membersCount.count)
      : membersCount;
    const growthRate = (membersCount && typeof membersCount === 'object')
      ? U.roundTo(U.safeNum(membersCount.g, 0), 4)
      : 0;
    const nMembers = Math.max(0, U.safeInt(rawN, 0));

    const div = U.safeInt(division, 1);
    const rLv = U.clamp(U.safeInt(repLvl, 3), 0, 5);
    const baseDiv = ({ 0: 2, 1: 5, 2: 4, 3: 3, 4: 2.5 }[div] || 4);
    const refRatio = U.clamp(U.payrollRef(country, div, 0) / U.payrollRef('BR', div, 0), 0.6, 1.4);
    const baseFee = baseDiv * refRatio;

    const capBase = ({ 0: 600, 1: 40000, 2: 12000, 3: 4000, 4: 1500 }[div] || 12000);
    const repMul = ([0.35, 0.6, 1.0, 1.5, 2.2, 3.0][rLv] || 1.0);
    const memberCap = Math.round(capBase * repMul);

    function annualShare(dPct) {
      const dFrac = U.clamp(dPct, 0, C.MEMBER_DISC_MAX) / 100.0;
      return Math.min(C.MEMBER_ANNUAL_SHARE_MAX, dFrac * 3.0);
    }

    function memberDemand(mVal, dPct) {
      const pf = priceFactorV9(mVal, C.MEMBER_ELAST);
      const aShare = annualShare(dPct);
      return pf * (1.0 + C.MEMBER_LOYAL * aShare);
    }

    function memberNet(mVal, dPct) {
      const dFrac = U.clamp(dPct, 0, C.MEMBER_DISC_MAX) / 100.0;
      const aShare = annualShare(dPct);
      return baseFee * mVal * (1.0 - dFrac * aShare);
    }

    function membersPaying(mVal, dPct) {
      if (Math.abs(mVal - 1.0) < 1e-6 && dPct === 0) return nMembers;
      const dem = memberDemand(mVal, dPct);
      return Math.max(0, Math.round(Math.min(nMembers * dem, Math.max(nMembers, memberCap))));
    }

    function membersParcel(mVal, dPct) {
      return Math.round(membersPaying(mVal, dPct) * memberNet(mVal, dPct));
    }

    // Yield Index (1.00x, 0% = 100.00)
    function yieldIndex(mVal, dPct) {
      const dFrac = U.clamp(dPct, 0, C.MEMBER_DISC_MAX) / 100.0;
      const aShare = annualShare(dPct);
      const dem = memberDemand(mVal, dPct);
      return dem * mVal * (1.0 - dFrac * aShare) * 100.0;
    }

    const curYield = yieldIndex(curM, curD);
    const curPaying = membersPaying(curM, curD);
    const curParcel = membersParcel(curM, curD);

    let bestM = C.MEMBER_OPTIMAL_MUL;
    let bestD = C.MEMBER_OPTIMAL_DISC;
    let bestYield = -1.0;
    const gridRows = [];

    for (let mi = 50; mi <= 200; mi += 5) {
      const mVal = U.roundTo(mi / 100.0, 2);
      for (let dVal = 0; dVal <= C.MEMBER_DISC_MAX; dVal++) {
        const y = yieldIndex(mVal, dVal);
        if (y > bestYield) {
          bestYield = y;
          bestM = mVal;
          bestD = dVal;
        }
        if ([0.85, 0.95, 1.00, 1.05, 1.10, 1.20].includes(mVal) && [0, 3, 4, 6, 8, 10, 15].includes(dVal)) {
          gridRows.push({
            m: mVal,
            d: dVal,
            yieldIdx: U.roundTo(y, 2),
            annualSharePct: U.roundTo(annualShare(dVal) * 100, 1),
            estParcel: membersParcel(mVal, dVal),
          });
        }
      }
    }

    const optPaying = membersPaying(bestM, bestD);
    const optParcel = membersParcel(bestM, bestD);
    const gainPct = curYield > 0 ? ((bestYield - curYield) / curYield) * 100.0 : 0.0;
    const isOptimal = Math.abs(curM - bestM) <= 0.01 && Math.abs(curD - bestD) <= 1;

    return {
      n: nMembers,
      g: growthRate,
      cap: memberCap,
      base_fee: U.roundTo(baseFee, 2),
      cur_m: U.roundTo(curM, 2),
      cur_d: curD,
      cur_yield: U.roundTo(curYield, 2),
      cur_idx: U.roundTo(curYield / 100.0, 4),
      cur_paying: curPaying,
      cur_parcel: curParcel,
      opt_m: bestM,
      opt_d: bestD,
      opt_yield: U.roundTo(bestYield, 2),
      opt_idx: U.roundTo(bestYield / 100.0, 4),
      opt_paying: optPaying,
      opt_parcel: optParcel,
      parcel_gain: Math.max(0, optParcel - curParcel),
      gain_pct: U.roundTo(Math.max(0.0, gainPct), 2),
      is_optimal: isOptimal,
      fan_conf: fanConf,
      grid_sample: gridRows,
    };
  }

  // Bytecode #21319–#21324: Club Shop v9 (dengan PAYROLL_REF tahunan #19856)
  function evalClubShop(shopPrice, shopLog, roster, currentDate, fanConf = 70, payrollRef = 28500000) {
    const curM = U.clamp(U.safeNum(shopPrice, 1.0), 0.5, 2.0);
    const curPf = priceFactorV9(curM, C.SHOP_ELAST);
    const curYield = curPf * curM * 100.0;

    let bestM = 1.00;
    let bestYield = -1.0;
    const curve = [];

    for (let mi = 60; mi <= 160; mi += 5) {
      const mVal = U.roundTo(mi / 100.0, 2);
      const pf = priceFactorV9(mVal, C.SHOP_ELAST);
      const y = pf * mVal * 100.0;
      if (y > bestYield) {
        bestYield = y;
        bestM = mVal;
      }
      if ([0.70, 0.80, 0.90, 0.95, 1.00, 1.05, 1.10, 1.20, 1.30, 1.50].includes(mVal)) {
        curve.push({ m: mVal, demandFactor: U.roundTo(pf, 3), revIdx: U.roundTo(y, 2) });
      }
    }

    const gainPct = curYield > 0 ? ((bestYield - curYield) / curYield) * 100.0 : 0.0;

    // Launch Hype Boost (#21265–#21268): Mega Signing (365d, +30%: top || fee >= 30% PayrollRef, non-loan),
    // Big/Star Signing (90d, +8%: isPlayerStar || fee >= 8% PayrollRef, non-loan; only applies if no active Mega)
    const annualRef = Math.max(5900000, U.safeNum(payrollRef, 28500000));
    const megaThreshold = annualRef * 0.30;
    const bigThreshold = annualRef * 0.08;
    const megaDaysLim = C.SHOP_MEGA_DAYS || 365;
    const signDaysLim = C.SHOP_SIGNING_DAYS || 90;
    const hypeEvents = [];
    let hasMegaActive = false;
    let hasBigActive = false;

    for (const p of (roster || [])) {
      if (p.loanedFrom) continue;
      const bdate = p.boughtDate;
      if (!bdate) continue;
      const days = U.daysBetweenDates(bdate, currentDate);
      const fee = U.safeNum(p.boughtPrice, 0);
      const isStar = Boolean(p.star || p.top || p.starAwarded);
      if (days <= megaDaysLim && (p.top || fee >= megaThreshold)) {
        const daysLeft = Math.max(0, megaDaysLim - days);
        hypeEvents.push({
          name: p.name,
          kind: 'Mega Signing (👑 Top / >=30% PayrollRef, 365d)',
          boostPct: 30.0,
          daysLeft,
          fee,
        });
        hasMegaActive = true;
      } else if (days <= signDaysLim && (isStar || fee >= bigThreshold)) {
        const daysLeft = Math.max(0, signDaysLim - days);
        hypeEvents.push({
          name: p.name,
          kind: isStar ? 'Star Signing (⭐ Star, 90d)' : 'Big Signing (>=8% PayrollRef, 90d)',
          boostPct: 8.0,
          daysLeft,
          fee,
        });
        hasBigActive = true;
      }
    }
    const activeBoostPct = hasMegaActive ? 30.0 : (hasBigActive ? 8.0 : 0.0);

    const recentLog = [];
    let topJerseys = [];
    if (Array.isArray(shopLog)) {
      for (const row of shopLog.slice(-12)) {
        if (row && typeof row === 'object') {
          const mk = String(row.month || row.ym || row.m || row.date || '-');
          const uVal = U.safeInt(row.units !== undefined ? row.units : (row.shirts !== undefined ? row.shirts : (row.sold !== undefined ? row.sold : (row.s !== undefined ? row.s : row.u))), 0);
          const rVal = U.safeNum(row.revenue !== undefined ? row.revenue : (row.net !== undefined ? row.net : row.r), 0);
          const topArr = Array.isArray(row.t) ? row.t : (Array.isArray(row.top) ? row.top : []);
          recentLog.push({
            month: mk,
            ym: mk,
            units: uVal,
            shirts: uVal,
            rev: rVal,
            revenue: rVal,
            priceMul: U.safeNum(row.priceMul !== undefined ? row.priceMul : curM, curM),
            top: topArr,
          });
          if (topArr.length) {
            topJerseys = topArr.slice(0, 8).map(t => ({ id: t.i || t.id || '', name: t.n || t.name || '-', sold: U.safeInt(t.s ?? t.shirts, 0), s: U.safeInt(t.s ?? t.shirts, 0) }));
          }
        }
      }
    } else if (shopLog && typeof shopLog === 'object') {
      const mKeys = Object.keys(shopLog).sort().slice(-12);
      for (const mk of mKeys) {
        const row = shopLog[mk];
        if (row && typeof row === 'object') {
          const uVal = U.safeInt(row.s !== undefined ? row.s : (row.units !== undefined ? row.units : (row.shirts !== undefined ? row.shirts : row.u)), 0);
          const rVal = U.safeNum(row.r !== undefined ? row.r : (row.revenue !== undefined ? row.revenue : row.net), 0);
          const topArr = Array.isArray(row.t) ? row.t : (Array.isArray(row.top) ? row.top : []);
          recentLog.push({
            month: mk,
            ym: mk,
            units: uVal,
            shirts: uVal,
            rev: rVal,
            revenue: rVal,
            priceMul: U.safeNum(row.priceMul !== undefined ? row.priceMul : curM, curM),
            top: topArr,
          });
          if (topArr.length) {
            topJerseys = topArr.slice(0, 8).map(t => ({ id: t.i || t.id || '', name: t.n || t.name || '-', sold: U.safeInt(t.s ?? t.shirts, 0), s: U.safeInt(t.s ?? t.shirts, 0) }));
          }
        }
      }
    }

    const lastRev = recentLog.length ? recentLog[recentLog.length - 1].rev : 0;
    const lastUnits = recentLog.length ? recentLog[recentLog.length - 1].units : 0;
    const topCnt = (roster || []).filter(p => p.top).length;
    const starCnt = (roster || []).filter(p => !p.top && (p.star || p.starAwarded)).length;
    // #21265: +8% per p.top, else +4% per isPlayerStar(p), capped at 30% (SHOP_STAR_MAX = 0.30)
    const starBonusPct = Math.min(30, topCnt * 8 + starCnt * 4);
    const megaSignings = hypeEvents.filter(e => e.boostPct >= 25);
    const bigSignings = hypeEvents.filter(e => e.boostPct < 25);
    const curWord = Math.abs(curM - 1.0) <= 0.01 ? 'optimal' : (curM > 1.0 ? 'mahal' : 'diskon');

    return {
      cur_m: U.roundTo(curM, 2),
      cur_pf: U.roundTo(curPf, 4),
      cur_word: curWord,
      cur_yield: U.roundTo(curYield, 2),
      opt_m: bestM,
      opt_yield: U.roundTo(bestYield, 2),
      gain_pct: U.roundTo(Math.max(0.0, gainPct), 2),
      is_optimal: Math.abs(curM - bestM) <= 0.01,
      active_boost_pct: activeBoostPct,
      hype_bonus_pct: activeBoostPct,
      star_cnt: starCnt,
      top_cnt: topCnt,
      star_bonus_pct: starBonusPct,
      mega_threshold: Math.round(megaThreshold),
      big_threshold: Math.round(bigThreshold),
      hype_events: hypeEvents,
      mega_signings: megaSignings,
      big_signings: bigSignings,
      top_jerseys: topJerseys,
      last_rev: Math.round(lastRev),
      last_units: lastUnits,
      last_shirts: lastUnits,
      history: recentLog,
      curve,
      fan_conf: fanConf,
    };
  }

  // Bytecode #19815 ticketPrices (match #19903 baseTicketsFor)
  function getBaseTicketPrices(division = 1, kind = 'league', homeRepLvl = 3, country = 'OTHER', region = null) {
    const k = String(kind || 'league').toLowerCase();
    const isEu = (region !== null && region !== undefined)
      ? (Number(region) === 0)
      : (U.countryGroup(country) === 0);
    const rLv = U.clamp(U.safeInt(homeRepLvl, 3), 0, 5);
    let arr;
    if (k === 'continental1') {
      arr = isEu ? C.TICKETS_CONT1.eu : C.TICKETS_CONT1.other;
    } else if (k === 'continental2' || k === 'supercup') {
      arr = isEu ? C.TICKETS_CONT2.eu : C.TICKETS_CONT2.other;
    } else if (k === 'cup') {
      arr = rLv >= 4 ? C.TICKETS_CUP.high : (rLv === 3 ? C.TICKETS_CUP.mid : C.TICKETS_CUP.low);
    } else if (k === 'state') {
      arr = rLv >= 4 ? [10, 15, 25, 70] : (rLv === 3 ? [5, 12, 20, 50] : (rLv === 0 ? [3, 5, 12, 20] : [3, 12, 15, 30]));
    } else if (k === 'friendly' || k === 'other' || k === 'continental3') {
      arr = [10, 25, 35, 50];
    } else {
      const div = U.clamp(U.safeInt(division, 1), 0, 4);
      arr = (C.TICKETS_LEAGUE && C.TICKETS_LEAGUE[div]) || [10, 15, 25, 80];
    }
    return {
      geral: arr[0],
      arquibancada: arr[1],
      cadeiras: arr[2],
      camarotes: arr[3],
    };
  }

  // Bytecode #19904 ticketDemand(mul, big)
  function ticketDemandV9(mul, isBigMatch = false) {
    const m = U.clamp(U.safeNum(mul, 1.0), 0.5, 2.0);
    if (m < 1.0) {
      return 1.0 + 0.40 * (1.0 - m);
    }
    const slope = isBigMatch ? 0.20 : 0.70;
    return Math.max(0.25, 1.0 - slope * (m - 1.0));
  }

  /**
   * Bytecode #19915 & #34244: Simulasi Stadion & Tiket berbasis harga bulat per sektor.
   * Mendukung opts opsional: `{ homeRepLvl, kind, koStage, isClassic, country }`.
   */
  function simulateStadiumByPricesV9(
    sections, prices, fanConf = 70, division = 1,
    isKnockout = false, isBigMatch = false, repDiff = 0, opts = null
  ) {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const div = U.clamp(U.safeInt(division, 1), 0, 4);
    const homeRepLvl = U.clamp(U.safeInt(o.homeRepLvl !== undefined ? o.homeRepLvl : 3, 3), 0, 5);
    const kind = String(o.kind || 'league').toLowerCase();
    const koStage = o.koStage || null;
    const isClassic = Boolean(o.isClassic);
    const country = o.country || 'OTHER';
    const region = (o.region !== undefined && o.region !== null) ? o.region : null;

    const basePrices = getBaseTicketPrices(div, kind, homeRepLvl, country, region);
    const baseAttArr = (C.BASE_ATTENDANCE && C.BASE_ATTENDANCE[homeRepLvl]) || [4000, 20000, 2500, 300];
    const extraArr = (C.EXTRA_DRAW && C.EXTRA_DRAW[div]) || [100, 500, 200, 10];

    const kindScale = kind === 'state'
      ? 0.70
      : (kind === 'friendly'
        ? 0.40
        : (kind === 'continental1'
          ? 1.35
          : ((kind === 'continental2' || kind === 'supercup') ? 1.15 : (kind === 'cup' ? 1.10 : 1.0))));

    const fillBonus = (isKnockout ? 0.45 : 0.30)
      + (kind === 'continental1' ? 0.30 : ((kind === 'continental2' || kind === 'supercup') ? 0.15 : 0.0))
      + ((isBigMatch || isClassic) ? 0.20 : 0.0);

    let rd = U.safeNum(repDiff, 0);
    if (Math.abs(rd) > 5) {
      rd = U.clamp(Math.round(rd / 15.0), -5, 5);
    } else {
      rd = U.clamp(Math.round(rd), -5, 5);
    }
    const fanMul = U.clamp(U.safeNum(fanConf, 70) / 100.0, 0.0, 1.0);

    const koKey = isClassic ? 'classic' : (koStage && C.KO_FILL_RANGES && C.KO_FILL_RANGES[koStage] ? koStage : null);
    const koTargetFill = koKey ? C.KO_FILL_RANGES[koKey].mid : null;
    const bigForDemand = Boolean(isBigMatch || isClassic);

    let totalCap = 0;
    let totalAtt = 0;
    let totalRev = 0;
    const bySector = {};

    for (let i = 0; i < SECTORS.length; i++) {
      const s = SECTORS[i];
      const cap = Math.max(0, U.safeInt(sections && sections[s], 0));
      const bp = U.safeNum(basePrices[s], 10);
      const price = Math.max(1, U.safeInt(prices && prices[s], bp));
      const effMul = bp > 0 ? (price / bp) : 1.0;
      const dem = ticketDemandV9(effMul, bigForDemand);

      let demandRaw = 0;
      let att = 0;

      if (koTargetFill !== null) {
        const koAtt = Math.round(cap * koTargetFill);
        demandRaw = Math.round(koAtt * dem);
        att = Math.min(cap, Math.max(0, demandRaw));
      } else {
        let a = Math.round(baseAttArr[i] * kindScale) + Math.round(cap * fillBonus);
        if (rd !== 0) {
          const adj = (C.REP_DIFF_ADJ && C.REP_DIFF_ADJ[Math.abs(rd)]) || 0;
          a += (rd > 0 ? 1 : -1) * Math.round(a * adj);
        }
        a = Math.round(a * fanMul);
        const extraMid = cap > 0 ? Math.floor((extraArr[i] - 1) / 2) : 0;
        demandRaw = Math.round(a * dem) + extraMid;
        att = U.clamp(demandRaw, 0, cap);
      }

      const rev = att * price;
      const fillS = cap > 0 ? (att / cap) * 100.0 : 0.0;

      totalCap += cap;
      totalAtt += att;
      totalRev += rev;

      bySector[s] = {
        cap,
        att,
        demandRaw,
        unmetDemand: Math.max(0, demandRaw - cap),
        price,
        basePrice: bp,
        mul: U.roundTo(effMul, 2),
        fillPct: U.roundTo(fillS, 1),
        rev,
      };
    }

    const fillPct = totalCap > 0 ? (totalAtt / totalCap) * 100.0 : 0.0;
    const homeMidBonus = fillPct > 70.0;

    return {
      totalCap,
      totalAtt,
      totalRev,
      fillPct: U.roundTo(fillPct, 1),
      homeMidBonus,
      bySector,
    };
  }

  function simulateStadiumV9(
    sections, ticketMul, fanConf = 70, division = 1,
    isKnockout = false, isBigMatch = false, repDiff = 0, opts = null
  ) {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const div = U.clamp(U.safeInt(division, 1), 0, 4);
    const homeRepLvl = U.clamp(U.safeInt(o.homeRepLvl !== undefined ? o.homeRepLvl : 3, 3), 0, 5);
    const kind = String(o.kind || 'league').toLowerCase();
    const country = o.country || 'OTHER';
    const region = (o.region !== undefined && o.region !== null) ? o.region : null;
    const basePrices = getBaseTicketPrices(div, kind, homeRepLvl, country, region);
    const muls = U.normalizeTicketMul(ticketMul);
    const prices = {};
    for (const s of SECTORS) {
      const bp = U.safeNum(basePrices[s], 10);
      prices[s] = Math.max(1, Math.round(bp * U.safeNum(muls[s], 1.0)));
    }
    return simulateStadiumByPricesV9(sections, prices, fanConf, division, isKnockout, isBigMatch, repDiff, opts);
  }

  /**
   * Optimasi Harga Tiket Bulat per Sektor (#19915/#34244):
   * Memaksimalkan pendapatan tiap sektor secara independen pada kisi harga bulat [0.5x..2.0x]
   * sambil menjaga total fillPct >= 70.5% (agar bonus +2% MID kandang selalu aktif).
   */
  function optimizeTicketPricesV9(
    sections, fanConf = 70, division = 1,
    isKnockout = false, isBigMatch = false, repDiff = 0, minTotalFill = 70.5, opts = null
  ) {
    const o = (opts && typeof opts === 'object') ? opts : {};
    const div = U.clamp(U.safeInt(division, 1), 0, 4);
    const homeRepLvl = U.clamp(U.safeInt(o.homeRepLvl !== undefined ? o.homeRepLvl : 3, 3), 0, 5);
    const kind = String(o.kind || 'league').toLowerCase();
    const country = o.country || 'OTHER';
    const region = (o.region !== undefined && o.region !== null) ? o.region : null;
    const basePrices = getBaseTicketPrices(div, kind, homeRepLvl, country, region);

    // Evaluasi tiap sektor untuk setiap kandidat harga bulat di [0.5x .. 2.0x]
    const sectorCandidates = {};
    for (const s of SECTORS) {
      const bp = U.safeNum(basePrices[s], 10);
      const pLo = Math.max(1, Math.round(bp * 0.5));
      const pHi = Math.max(pLo, Math.round(bp * 2.0));
      const list = [];
      for (let p = pLo; p <= pHi; p++) {
        const testPrices = {
          geral: basePrices.geral,
          arquibancada: basePrices.arquibancada,
          cadeiras: basePrices.cadeiras,
          camarotes: basePrices.camarotes,
          [s]: p,
        };
        const simS = simulateStadiumByPricesV9(sections, testPrices, fanConf, division, isKnockout, isBigMatch, repDiff, opts);
        const secRes = simS.bySector[s];
        list.push({
          price: p,
          att: secRes.att,
          rev: secRes.rev,
          cap: secRes.cap,
        });
      }
      sectorCandidates[s] = list;
    }

    // Pilih harga dengan revenue tertinggi per sektor (jika seri revenue, pilih harga lebih rendah agar penonton lebih ramai)
    const bestPrices = {};
    for (const s of SECTORS) {
      let bestP = basePrices[s];
      let bestRev = -1;
      let bestAtt = -1;
      for (const c of sectorCandidates[s]) {
        if (c.rev > bestRev || (c.rev === bestRev && c.att > bestAtt)) {
          bestRev = c.rev;
          bestAtt = c.att;
          bestP = c.price;
        }
      }
      bestPrices[s] = bestP;
    }

    let bestSim = simulateStadiumByPricesV9(sections, bestPrices, fanConf, division, isKnockout, isBigMatch, repDiff, opts);

    // Jika total fillPct < minTotalFill, turunkan sektor secara bertahap dengan kehilangan revenue terkecil per tambahan penonton
    while (bestSim.totalCap > 0 && bestSim.fillPct < minTotalFill) {
      let bestStepSector = null;
      let bestRatio = Infinity;
      let nextPriceForSec = null;

      for (const s of SECTORS) {
        const curP = bestPrices[s];
        const curC = sectorCandidates[s].find(x => x.price === curP);
        const lowerC = sectorCandidates[s].filter(x => x.price < curP && x.att > (curC ? curC.att : 0));
        if (!lowerC.length) continue;
        // Ambil langkah turun 1 harga yang menambah penonton
        const cand = lowerC[lowerC.length - 1];
        const dAtt = cand.att - curC.att;
        const dRev = Math.max(0, curC.rev - cand.rev);
        const ratio = dRev / Math.max(1, dAtt);
        if (ratio < bestRatio) {
          bestRatio = ratio;
          bestStepSector = s;
          nextPriceForSec = cand.price;
        }
      }

      if (!bestStepSector || nextPriceForSec === null) break;
      bestPrices[bestStepSector] = nextPriceForSec;
      bestSim = simulateStadiumByPricesV9(sections, bestPrices, fanConf, division, isKnockout, isBigMatch, repDiff, opts);
    }

    const bestMuls = {};
    for (const s of SECTORS) {
      bestMuls[s] = U.roundTo(bestPrices[s] / basePrices[s], 2);
    }

    return {
      prices: bestPrices,
      muls: bestMuls,
      sim: bestSim,
    };
  }

  /**
   * Matriks Harga Tiket Optimal untuk 6 Fase Kompetisi (`ticketMulBy[occasion]` #19827 & #24024).
   * Catatan bytecode #24024: R16 ('Oitavas') & QF ('Quartas') termasuk `lateKnockout` -> `isBigMatch = true`!
   */
  function computeAllTicketPhases(sections, fanConf, division, savedTicketMulBy = null, defaultTicketMul = null, opts = null) {
    const baseOpts = (opts && typeof opts === 'object') ? opts : {};
    const div = U.clamp(U.safeInt(division, 1), 0, 4);
    const homeRepLvl = U.clamp(U.safeInt(baseOpts.homeRepLvl !== undefined ? baseOpts.homeRepLvl : 3, 3), 0, 5);
    const country = baseOpts.country || 'OTHER';
    const kind = String(baseOpts.kind || 'league').toLowerCase();
    const region = (baseOpts.region !== undefined && baseOpts.region !== null) ? baseOpts.region : null;
    const basePrices = getBaseTicketPrices(div, kind, homeRepLvl, country, region);
    const defMul = U.normalizeTicketMul(defaultTicketMul);
    const tmb = (savedTicketMulBy && typeof savedTicketMulBy === 'object') ? savedTicketMulBy : {};

    const phaseSpecs = [
      { key: 'normal', label: 'Normal / Grup',          isKo: false, isBig: false, repDiff: 0, koStage: null },
      { key: 'runin',  label: 'Run-in (<=5 Laga)',      isKo: false, isBig: true,  repDiff: 1, koStage: null },
      { key: 'r16',    label: '16 Besar (R16)',         isKo: true,  isBig: true,  repDiff: 0, koStage: 'r16' },
      { key: 'qf',     label: 'Perempat Final (QF)',    isKo: true,  isBig: true,  repDiff: 1, koStage: 'qf' },
      { key: 'sf',     label: 'Semifinal (SF)',         isKo: true,  isBig: true,  repDiff: 1, koStage: 'sf' },
      { key: 'final',  label: 'Final / Derby Classic',  isKo: true,  isBig: true,  repDiff: 2, koStage: 'final' },
    ];

    const results = [];
    for (const sp of phaseSpecs) {
      const phaseOpts = {
        ...baseOpts,
        homeRepLvl,
        country,
        region,
        kind,
        koStage: sp.koStage,
        isClassic: sp.key === 'final',
      };
      const hasSaved = Boolean(tmb[sp.key] && typeof tmb[sp.key] === 'object');
      const curMuls = hasSaved ? U.normalizeTicketMul(tmb[sp.key]) : defMul;
      const curPrices = {};
      for (const s of SECTORS) {
        curPrices[s] = Math.max(1, Math.round(basePrices[s] * curMuls[s]));
      }
      const curSim = simulateStadiumByPricesV9(sections, curPrices, fanConf, div, sp.isKo, sp.isBig, sp.repDiff, phaseOpts);
      const opt = optimizeTicketPricesV9(sections, fanConf, div, sp.isKo, sp.isBig, sp.repDiff, 70.5, phaseOpts);
      const revGain = Math.max(0, opt.sim.totalRev - curSim.totalRev);

      results.push({
        key: sp.key,
        phase: sp.key,
        label: sp.label,
        kind,
        basePrices,
        isKnockout: sp.isKo,
        isBig: sp.isBig,
        koStage: sp.koStage,
        hasSaved,
        isCustom: hasSaved,
        curMuls,
        curPrices,
        curRev: curSim.totalRev,
        curFillPct: curSim.fillPct,
        optPrices: opt.prices,
        optMuls: opt.muls,
        optRev: opt.sim.totalRev,
        estRev: opt.sim.totalRev,
        optFillPct: opt.sim.fillPct,
        fillPct: opt.sim.fillPct,
        optAtt: opt.sim.totalAtt,
        revGain,
      });
    }
    return results;
  }

  // Bytecode #19797 seatPrice & #19798 expansionCost & #19807 startConstruction
  function calcExpansionCost(sector, currentSeats, addSeats, division = 1, includeFixedWorkCost = false) {
    if (addSeats <= 0) return 0;
    const tiers = C.STADIUM_SEAT_TIERS[sector] || [[999999, 500]];
    const seatMul = C.SEAT_COST_MUL || 3;
    const divMulMap = C.STADIUM_COST_DIV_MUL || { 0: 0.25, 1: 1.0, 2: 0.6, 3: 0.3, 4: 0.25 };
    const divMul = divMulMap[U.clamp(U.safeInt(division, 1), 0, 4)] || 1.0;
    let cost = 0;
    let cur = Math.max(0, U.safeInt(currentSeats, 0));
    const target = cur + U.safeInt(addSeats, 0);

    for (const [capLimit, unitBaseCost] of tiers) {
      if (cur >= target) break;
      if (cur < capLimit) {
        const chunk = Math.min(target, capLimit) - cur;
        const unitPrice = Math.round(unitBaseCost * seatMul * divMul);
        cost += chunk * unitPrice;
        cur += chunk;
      }
    }
    if (includeFixedWorkCost && cost > 0) {
      cost += Math.round((C.STADIUM_WORK_FIXED_COST || 300000) * divMul);
    }
    return cost;
  }

  function calcStadiumRoi(sections, addBySector, fanConf = 70, division = 1, homeMatchesPerSeason = 19, opts = null) {
    const curTotal = SECTORS.reduce((acc, s) => acc + U.safeInt(sections[s], 0), 0);
    const newSections = {};
    let totalBuildCost = 0;
    let hasAdded = false;

    for (const s of SECTORS) {
      const cSeats = U.safeInt(sections[s], 0);
      const aSeats = Math.max(0, U.safeInt(addBySector && addBySector[s], 0));
      newSections[s] = cSeats + aSeats;
      if (aSeats > 0) hasAdded = true;
      totalBuildCost += calcExpansionCost(s, cSeats, aSeats, division, false);
    }
    if (hasAdded) {
      const divMulMap = C.STADIUM_COST_DIV_MUL || { 0: 0.25, 1: 1.0, 2: 0.6, 3: 0.3, 4: 0.25 };
      const divMul = divMulMap[U.clamp(U.safeInt(division, 1), 0, 4)] || 1.0;
      totalBuildCost += Math.round((C.STADIUM_WORK_FIXED_COST || 300000) * divMul);
    }

    const newTotal = SECTORS.reduce((acc, s) => acc + newSections[s], 0);
    const curOpsMonth = Math.max(0, curTotal - C.STADIUM_FREE_SEATS) * C.STADIUM_OPS_PER_SEAT;
    const newOpsMonth = Math.max(0, newTotal - C.STADIUM_FREE_SEATS) * C.STADIUM_OPS_PER_SEAT;
    const deltaOpsMonth = newOpsMonth - curOpsMonth;

    const curOpt = optimizeTicketPricesV9(sections, fanConf, division, false, false, 0, 70.5, opts);
    const newOpt = optimizeTicketPricesV9(newSections, fanConf, division, false, false, 0, 70.5, opts);

    const deltaRevPerMatch = newOpt.sim.totalRev - curOpt.sim.totalRev;
    const matchesPerMonth = homeMatchesPerSeason / 10.0;
    const netMonthlyGain = deltaRevPerMatch * matchesPerMonth - deltaOpsMonth;

    const paybackMonths = (netMonthlyGain > 0 && totalBuildCost > 0)
      ? U.roundTo(totalBuildCost / netMonthlyGain, 1)
      : 999.0;

    return {
      curSeats: curTotal,
      newSeats: newTotal,
      addedSeats: newTotal - curTotal,
      buildCost: totalBuildCost,
      deltaOpsMonth,
      deltaRevPerMatch,
      netMonthlyGain: Math.round(netMonthlyGain),
      paybackMonths,
      newOptPrices: newOpt.prices,
      newFillPct: newOpt.sim.fillPct,
    };
  }

  // Bytecode #19761 & #34226 tvQuotaMonthly(country, div, repLvl, monthlyTotalPayroll, reputation)
  function tvQuotaMonthly(country = 'OTHER', division = 1, repLvl = 3, monthlyTotalPayroll = 0, reputation = null) {
    const div = U.clamp(U.safeInt(division, 1), 0, 5);
    const rIdx = (reputation !== null && reputation !== undefined)
      ? U.clamp(Math.round(U.safeNum(reputation, 60) / 20.0), 0, 5)
      : U.clamp(U.safeInt(repLvl, 3), 0, 5);
    const share = div === 1
      ? ((C.TV_SHARE_DIV1 && C.TV_SHARE_DIV1[rIdx]) !== undefined ? C.TV_SHARE_DIV1[rIdx] : 0.111)
      : ((C.TV_SHARE_OTHER && C.TV_SHARE_OTHER[div]) !== undefined ? C.TV_SHARE_OTHER[div] : 0.144);
    const idleArr = C.TV_IDLE_BY_REP || [0.5, 0.167, 0.167, 0.5, 0.417, 0.417];
    const idle = idleArr[div] !== undefined ? idleArr[div] : 0.167;
    const ref = U.payrollRef(country, div, rIdx);
    const annualPayroll = Math.max(0, U.safeNum(monthlyTotalPayroll, 0)) * 12.0;
    return Math.round(((ref * share + idle * Math.min(annualPayroll, ref)) / 12.0) / 1000.0) * 1000;
  }

  // Bytecode #21418 ctUpkeepMonthly (0 jika ctMaintOff || budget < 0)
  function ctUpkeepMonthly(country = 'OTHER', division = 1, ctLevel = 1, ctMaintOff = false, budget = 0) {
    if (ctMaintOff || U.safeNum(budget, 0) < 0) return 0;
    const ref = U.payrollRef(country, division, 0);
    const lv = U.clamp(U.safeInt(ctLevel, 1), 1, 10);
    const share = (C.CT_UPKEEP_SHARE && C.CT_UPKEEP_SHARE[lv]) || 0;
    return Math.round(((ref * share) / 12.0) / 100.0) * 100;
  }

  // Pelatih Akademi bulanan (#21707: level 0..3, default 0)
  function youthCoachMonthly(country = 'OTHER', division = 1, youthCoachLevel = 0) {
    const lv = U.clamp(U.safeInt(youthCoachLevel, 0), 0, 3);
    if (lv <= 0) return 0;
    const ref = U.payrollRef(country, division, 0);
    const share = (C.YOUTH_COACH_SALARY_SHARE && C.YOUTH_COACH_SALARY_SHARE[lv]) || 0;
    return Math.round(((ref * share) / 12.0) / 100.0) * 100;
  }

  // Bytecode #21733 & #21734 monthlyLoanPayment(uTeam) & #19773 loanLimit
  function computeMonthlyLoanDue(uTeam) {
    if (!uTeam || typeof uTeam !== 'object') return 0;
    if (Array.isArray(uTeam.loans) && uTeam.loans.length > 0) {
      let totalDue = 0;
      for (const ln of uTeam.loans) {
        if (!ln || typeof ln !== 'object') continue;
        const bal = U.safeNum(ln.balance, 0);
        if (bal <= 0) continue;
        const rate = U.safeNum(ln.rate, 0.03);
        const interest = Math.floor(bal * rate);
        const inst = U.safeNum(ln.installment, 0);
        const mLeft = U.safeInt(ln.monthsLeft, 0);
        if (inst > 0 && mLeft > 0) {
          totalDue += (mLeft <= 1) ? (bal + interest) : Math.min(inst, bal + interest);
        } else {
          totalDue += interest;
        }
      }
      return Math.round(totalDue);
    }
    const legacyParcel = U.safeNum(uTeam.bankLoanParcel, 0);
    if (legacyParcel > 0) return Math.round(legacyParcel);
    const legacyBal = U.safeNum(uTeam.bankLoan, 0);
    return legacyBal > 0 ? Math.floor(legacyBal * 0.03) : 0;
  }

  /**
   * Simulasi rencana cicilan transfer resmi (OTA TRANSFER_INSTALLMENTS):
   * DP 25% + bunga { 6 bln: 3%, 12 bln: 8%, 24 bln: 18% }.
   */
  function computeInstallmentPlan(price, months = 24) {
    const p = Math.max(0, Math.round(U.safeNum(price, 0)));
    const m = [6, 12, 24].includes(Number(months)) ? Number(months) : 24;
    const rates = { 6: 0.03, 12: 0.08, 24: 0.18 };
    const rate = rates[m] ?? 0.18;
    const dp = Math.round(p * 0.25);
    const principal = Math.max(0, p - dp);
    const totalFinanced = Math.round(principal * (1 + rate));
    const interestCost = totalFinanced - principal;
    const monthly = m > 0 ? Math.ceil(totalFinanced / m) : totalFinanced;
    return { months: m, rate, dp, principal, interestCost, totalFinanced, monthly, totalPay: dp + totalFinanced };
  }

  function computeLoanLimit(country = 'OTHER', division = 1, repLvl = 3) {
    const ref = U.payrollRef(country, division, repLvl);
    return Math.max(250000, Math.floor((ref * 0.25) / 250000) * 250000);
  }

  /**
   * Arus Kas Bulanan Rata-rata 3 Bulan Penuh Terakhir (#21866):
   * Membaca format tuple `uTeam.statement` `[isoDate, category, positiveAmount, ...meta]`
   * dan menyaring transaksi CapEx/transfer satu kali.
   */
  function computeCashflow3m(teamObj, ledger, lastLedger, totalPayroll, stadiumOps) {
    const statement = Array.isArray(teamObj && teamObj.statement) ? teamObj.statement : [];
    const monthlyBuckets = {};
    const monthlyTickets = {};

    for (const row of statement) {
      const parsed = U.parseStatementRow(row);
      if (!parsed || parsed.date.length < 7) continue;
      const ym = parsed.date.slice(0, 7);
      if (!(ym in monthlyBuckets)) monthlyBuckets[ym] = 0.0;
      if (!(ym in monthlyTickets)) monthlyTickets[ym] = 0.0;

      if (parsed.category === 'tickets' && !parsed.isExpense) {
        monthlyTickets[ym] += parsed.rawAmount;
      }
      if (!parsed.isCapEx) {
        monthlyBuckets[ym] += parsed.amount;
      }
    }

    const allMonths = Object.keys(monthlyBuckets).sort();
    let fullMonths = [];
    if (allMonths.length >= 2) {
      fullMonths = allMonths.slice(0, -1).slice(-3);
    } else if (allMonths.length === 1) {
      fullMonths = allMonths;
    }

    let avgOpNet = null;
    if (fullMonths.length) {
      const sumNet = fullMonths.reduce((acc, m) => acc + monthlyBuckets[m], 0);
      avgOpNet = Math.round(sumNet / fullMonths.length);
    }

    let avgTickets3m = null;
    if (fullMonths.length) {
      const sumT = fullMonths.reduce((acc, m) => acc + (monthlyTickets[m] || 0), 0);
      if (sumT > 0) avgTickets3m = Math.round(sumT / fullMonths.length);
    }
    if (avgTickets3m === null && ledger && typeof ledger === 'object' && U.safeNum(ledger.tickets, 0) > 0) {
      const denom = Math.max(1, allMonths.length || 10);
      avgTickets3m = Math.round(U.safeNum(ledger.tickets, 0) / denom);
    }

    function summarizeLedger(lg) {
      if (!lg || typeof lg !== 'object') return { rev: 0, exp: 0, net: 0, raw: {} };
      const revKeys = ['tickets', 'gate', 'sponsors', 'sponsor', 'tv', 'shop', 'members', 'member', 'naming', 'prizes', 'prize', 'fines'];
      const expKeys = ['salaries', 'wages', 'payroll', 'stadium', 'ct', 'maintenance', 'interest', 'loan', 'loans', 'loanInterest', 'youth', 'youthCoach'];
      const rev = revKeys.reduce((acc, k) => acc + U.safeNum(lg[k], 0), 0);
      const exp = expKeys.reduce((acc, k) => acc + Math.abs(U.safeNum(lg[k], 0)), 0);
      return { rev: Math.round(rev), exp: Math.round(exp), net: Math.round(rev - exp), raw: lg };
    }

    const curL = summarizeLedger(ledger);
    const lastL = summarizeLedger(lastLedger);
    const fixedMonthlyBurn = Math.round(totalPayroll + stadiumOps);

    return {
      avgOpNet3m: avgOpNet,
      avgTickets3m,
      monthsUsed: fullMonths,
      curLedger: curL,
      lastLedger: lastL,
      fixedMonthlyBurn,
    };
  }

  /**
   * Proyeksi Arus Kas Bulanan Rutin (#21866 monthlyOutlook).
   */
  function buildCashflowPayload(
    cashflowMeta, uTeam, curSim, spContracts, shopAudit, memberAudit,
    totalPayroll, stadiumOps, userDiv, extra = null
  ) {
    const ex = (extra && typeof extra === 'object') ? extra : {};
    const country = ex.country || uTeam.country || 'OTHER';
    const repLvl = ex.repLvl !== undefined ? ex.repLvl : U.reputationLevel(uTeam.reputation);
    const youthPayroll = U.safeNum(ex.youthPayroll, 0);
    const loanOutPay = U.safeNum(uTeam && uTeam.loanOutPay, 0);
    const combinedPayroll = totalPayroll + youthPayroll + loanOutPay;

    const estTickets = (cashflowMeta && cashflowMeta.avgTickets3m)
      ? cashflowMeta.avgTickets3m
      : Math.round(U.safeNum(curSim && curSim.totalRev, 0) * 1.7);

    const estTvQuota = tvQuotaMonthly(country, userDiv, repLvl, combinedPayroll, uTeam && uTeam.reputation);
    const estFixedSponsor = U.fixedSponsorParcel(uTeam && uTeam.fixedSponsor);

    // Sponsor variabel: hanya kontrak yang BUKAN upfront (luvas sudah dibayar di awal musim)
    let estVarSponsor = 0;
    for (const c of (spContracts || [])) {
      if (!c || typeof c !== 'object' || c.upfront) continue;
      estVarSponsor += U.safeNum(c.monthly ?? c.value ?? c.amount, 0) + U.safeNum(c.bonus, 0) * 0.5;
    }
    estVarSponsor = Math.round(estVarSponsor);

    const estSponsors = estTvQuota + estFixedSponsor + estVarSponsor;

    let estNaming = 0;
    const nm = uTeam && uTeam.naming;
    if (nm && typeof nm === 'object') {
      if (nm.monthly !== undefined) estNaming = U.safeNum(nm.monthly, 0);
      else if (nm.yearly !== undefined) estNaming = U.safeNum(nm.yearly, 0) / 12.0;
      else if (nm.annualValue !== undefined) estNaming = U.safeNum(nm.annualValue, 0) / 12.0;
      else if (nm.value !== undefined) estNaming = U.safeNum(nm.value, 0) / 12.0;
    }
    estNaming = Math.round(estNaming);

    const estShop = Math.round(
      U.safeNum(shopAudit && shopAudit.last_rev, 0)
      || ( ({ 1: 95000, 2: 45000, 3: 20000, 4: 8000 }[userDiv] || 45000) * (U.safeNum(shopAudit && shopAudit.cur_yield, 100) / 100.0) )
    );

    const estMember = (memberAudit && memberAudit.cur_parcel !== undefined)
      ? memberAudit.cur_parcel
      : Math.round(U.safeInt(memberAudit && memberAudit.n, 0) * 3.5);

    const ctLv = Math.max(1, U.safeInt(uTeam && uTeam.ctLevel, 1));
    const ctMaintOff = Boolean(uTeam && uTeam.ctMaintOff);
    const curBudget = U.safeNum(uTeam && uTeam.budget, 0);
    const ctCost = ctUpkeepMonthly(country, userDiv, ctLv, ctMaintOff, curBudget);

    const ycLv = U.clamp(U.safeInt(uTeam && uTeam.youthCoach, 0), 0, 3);
    const youthCost = youthCoachMonthly(country, userDiv, ycLv);

    const bankLoanParcel = computeMonthlyLoanDue(uTeam);
    const transferDebtItems = [];
    let transferDebtParcel = 0;
    let transferDebtTotal = 0;
    if (Array.isArray(uTeam && uTeam.transferDebt)) {
      for (const d of uTeam.transferDebt) {
        if (!d || typeof d !== 'object') continue;
        const left = U.safeInt(d.left, 0);
        if (left <= 0) continue;
        const parcel = U.safeNum(d.parcel, 0);
        const rest = d.rest !== undefined ? U.safeNum(d.rest, parcel * left) : parcel * left;
        if (rest <= 0) continue;
        const due = Math.round(Math.min(parcel, rest));
        transferDebtParcel += due;
        transferDebtTotal += Math.round(rest);
        transferDebtItems.push({
          who: String(d.who || d.name || 'Pemain'),
          parcel: Math.round(parcel),
          rest: Math.round(rest),
          left,
        });
      }
    }

    const estMonthlyRev = Math.round(estTickets + estSponsors + estNaming + estShop + estMember);
    const estMonthlyExp = Math.round(combinedPayroll + stadiumOps + ctCost + youthCost + bankLoanParcel + transferDebtParcel);
    const estProjectedNet = estMonthlyRev - estMonthlyExp;

    let avgNet = cashflowMeta ? cashflowMeta.avgOpNet3m : null;
    if (avgNet === null || avgNet === undefined) {
      avgNet = estProjectedNet;
    }

    const sponsorOnly = estFixedSponsor + estVarSponsor;

    const netMarginPct = estMonthlyRev > 0 ? U.roundTo((estProjectedNet / estMonthlyRev) * 100, 1) : 0.0;

    return {
      ...cashflowMeta,
      avgOpNet3m: avgNet,
      estTickets,
      estSponsors,
      estTvQuota,
      estFixedSponsor,
      estVarSponsor,
      estNaming,
      estShop,
      estMember,
      seniorPayroll: Math.round(totalPayroll),
      youthPayroll: Math.round(youthPayroll),
      totalPayrollAll: Math.round(combinedPayroll),
      ctCost,
      youthCost,
      bankLoanParcel,
      transferDebtParcel,
      transferDebtTotal,
      transferDebtCount: transferDebtItems.length,
      transferDebtItems,
      estMonthlyRev,
      estMonthlyExp,
      estProjectedNet,
      estCurrentIncome: estMonthlyRev,
      estCurrentExpense: estMonthlyExp,
      estCurrentNet: estProjectedNet,
      monthlyIncome: estMonthlyRev,
      monthlyExpense: estMonthlyExp,
      monthlyNet: estProjectedNet,
      netMarginPct,
      estBreakdown: {
        tickets: estTickets,
        sponsors: sponsorOnly,
        fixedSponsor: estFixedSponsor,
        varSponsor: estVarSponsor,
        naming: estNaming,
        members: estMember,
        tv: estTvQuota,
        shop: estShop,
        payroll: Math.round(combinedPayroll),
        seniorPayroll: Math.round(totalPayroll),
        youthPayroll: Math.round(youthPayroll),
        stadiumOps: Math.round(stadiumOps),
        ctCost,
        youthCost,
        bankLoanParcel,
        transferDebtParcel,
      },
    };
  }

  /**
   * Audit `save.ticketPresets` & `uTeam.ticketMulBy.runin` (#19915 / #24024):
   * Membandingkan preset tersimpan vs harga optimal Liga Normal & Big Match/KO.
   */
  function auditTicketPresets(
    rawPresets, activePresetId, sections, fanConf, division, repLevel, country,
    optLiga, optBig, ticketMul, ticketMulBy, upcomingHomeFx = null
  ) {
    const list = Array.isArray(rawPresets) ? rawPresets.filter(p => p && typeof p === 'object') : [];
    const stadOpts = { homeRepLvl: repLevel, country: country || 'OTHER', kind: 'league' };
    const bigOpts = { ...stadOpts, koStage: 'final', isClassic: true };
    const optLigaRev = optLiga && optLiga.sim ? optLiga.sim.totalRev : 0;
    const optBigRev = optBig && optBig.sim ? optBig.sim.totalRev : 0;

    const presets = list.map(p => {
      const m = U.normalizeTicketMul(p.mul);
      const ligaSim = simulateStadiumV9(sections, m, fanConf, division, false, false, 0, stadOpts);
      const bigSim = simulateStadiumV9(sections, m, fanConf, division, true, true, 1, bigOpts);
      const ligaLoss = Math.max(0, Math.round(optLigaRev - ligaSim.totalRev));
      const bigLoss = Math.max(0, Math.round(optBigRev - bigSim.totalRev));
      const isActive = Boolean(activePresetId && p.id === activePresetId);
      const mulSummary = `${Number(m.geral).toFixed(2)}·${Number(m.arquibancada).toFixed(2)}·${Number(m.cadeiras).toFixed(2)}·${Number(m.camarotes).toFixed(2)}x`;

      let bestUse = 'LIGA';
      let badgeCls = 'b-info';
      let verdict = `Kurang optimal (-${Math.round(ligaLoss / 1000)}K Liga)`;
      if (ligaSim.fillPct < 70 && bigSim.fillPct < 70) {
        bestUse = 'OVERPRICED';
        badgeCls = 'b-crit';
        verdict = 'Fill <70% di semua laga (-2% MID hilang!)';
      } else if (ligaLoss <= 15000 && ligaSim.fillPct >= 70) {
        bestUse = 'LIGA';
        badgeCls = 'b-good';
        verdict = '✓ Optimal Liga Normal';
      } else if (bigLoss <= 20000 && bigSim.fillPct >= 70) {
        bestUse = 'BIG';
        badgeCls = 'b-good';
        verdict = '✓ Optimal Big Match / KO';
      } else if (ligaSim.fillPct < 70) {
        bestUse = 'BIG';
        badgeCls = 'b-warn';
        verdict = `Hanya untuk Big Match (Fill Liga ${ligaSim.fillPct}% <70%)`;
      }

      return {
        id: p.id || '',
        name: String(p.name || 'Preset'),
        mul: m,
        mulSummary,
        isActive,
        ligaRev: Math.round(ligaSim.totalRev),
        ligaFillPct: ligaSim.fillPct,
        ligaLoss,
        bigRev: Math.round(bigSim.totalRev),
        bigFillPct: bigSim.fillPct,
        bigLoss,
        bestUse,
        badgeCls,
        verdict,
      };
    });

    const activeObj = presets.find(x => x.isActive) || null;
    const bestLigaPreset = presets
      .filter(x => x.ligaFillPct >= 70)
      .sort((a, b) => a.ligaLoss - b.ligaLoss || b.ligaFillPct - a.ligaFillPct)[0] || null;

    let summaryAlert = null;
    const nextIsBigOrKo = Boolean(upcomingHomeFx && upcomingHomeFx.ticketRec && (upcomingHomeFx.ticketRec.isBig || upcomingHomeFx.ticketRec.isKnockout));
    if (activeObj && (activeObj.ligaFillPct < 70 || (!nextIsBigOrKo && activeObj.ligaLoss >= 100000))) {
      const sug = bestLigaPreset && bestLigaPreset.id !== activeObj.id
        ? `Pakai "${bestLigaPreset.name}" (Fill ${bestLigaPreset.ligaFillPct}%) untuk laga Liga Biasa`
        : 'Terapkan harga optimal Liga Tab 5B';
      const lossK = Math.round(activeObj.ligaLoss / 1000);
      summaryAlert = nextIsBigOrKo
        ? `Preset aktif "${activeObj.name}" (${activeObj.mulSummary}) hanya untuk Big Match/KO: pada Liga Biasa Fill turun ke ${activeObj.ligaFillPct}% (-2% MID & rugi -${lossK}K). ${sug}.`
        : `Preset aktif "${activeObj.name}" (${activeObj.mulSummary}) menghasilkan Fill Liga ${activeObj.ligaFillPct}% (${activeObj.ligaFillPct < 70 ? '-2% MID hilang & ' : ''}rugi -${lossK}K/laga)! ${sug}.`;
    }

    let runinAlert = null;
    const tmb = (ticketMulBy && typeof ticketMulBy === 'object') ? ticketMulBy : {};
    if (tmb.runin && typeof tmb.runin === 'object') {
      const rMul = U.normalizeTicketMul(tmb.runin);
      const rSim = simulateStadiumV9(sections, rMul, fanConf, division, false, true, 1, stadOpts);
      const rOpt = optimizeTicketPricesV9(sections, fanConf, division, false, true, 1, 70.5, stadOpts);
      const rLoss = Math.max(0, Math.round(rOpt.sim.totalRev - rSim.totalRev));
      if (rLoss >= 100000 || rSim.fillPct < 70) {
        const pStr = `${rOpt.prices.geral}·${rOpt.prices.arquibancada}·${rOpt.prices.cadeiras}·${rOpt.prices.camarotes}`;
        runinAlert = `Preset fase Run-in (${Number(rMul.geral).toFixed(2)}·${Number(rMul.arquibancada).toFixed(2)}·${Number(rMul.cadeiras).toFixed(2)}·${Number(rMul.camarotes).toFixed(2)}x) kurang optimal: Fill ${rSim.fillPct}%, rugi -${Math.round(rLoss / 1000)}K/laga vs optimal (${pStr}).`;
      }
    }

    return {
      activePresetId: activePresetId || null,
      activePresetName: activeObj ? activeObj.name : null,
      presets,
      bestLigaPresetName: bestLigaPreset ? bestLigaPreset.name : null,
      summaryAlert,
      runinAlert,
    };
  }

  /**
   * Kalender Proyeksi Kas, Sponsor, Naming Rights & Antrean Kontrak 12 Bulan (#24161/#37498).
   */
  function buildCashflowCalendar12m(currentDate, budget, cashflow, sponsors, naming, uTeam, userRoster, bTeamRoster) {
    const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dStr = /^\d{4}-\d{2}/.test(String(currentDate || '')) ? String(currentDate).slice(0, 7) : '2026-01';
    const startYear = parseInt(dStr.slice(0, 4), 10) || 2026;
    const startMonth0 = Math.max(0, Math.min(11, (parseInt(dStr.slice(5, 7), 10) || 1) - 1));
    const monthlyNet = Math.round(U.safeNum(cashflow && cashflow.estCurrentNet, 0));
    const startBudget = Math.round(U.safeNum(budget, 0));

    let runCash = startBudget;
    const months = [];
    const ymToIdx = new Map();
    for (let i = 0; i < 12; i++) {
      const mAbs = startMonth0 + i;
      const y = startYear + Math.floor(mAbs / 12);
      const m0 = mAbs % 12;
      const ym = `${y}-${String(m0 + 1).padStart(2, '0')}`;
      const label = `${MONTHS_ID[m0]} '${String(y).slice(-2)}`;
      runCash += monthlyNet;
      ymToIdx.set(ym, i);
      months.push({
        offset: i,
        ym,
        label,
        netMonthly: monthlyNet,
        projBudget: runCash,
        events: [],
        goldenPlayers: [],
        trapPlayers: [],
      });
    }

    let commercialEventsCount = 0;
    for (const c of (Array.isArray(sponsors) ? sponsors : [])) {
      if (!c || typeof c !== 'object') continue;
      const rem = c.paymentsLeft !== undefined ? U.safeInt(c.paymentsLeft, 99) : U.safeInt(c.monthsLeft, 99);
      if (rem >= 1 && rem <= 12) {
        commercialEventsCount++;
        const mBucket = months[Math.min(11, rem - 1)];
        const luvK = Math.round(U.safeNum(c.luvas, 0) / 1000);
        const moK = Math.round(U.safeNum(c.monthly, 0) / 1000);
        mBucket.events.push({
          type: 'SPONSOR',
          sev: rem <= 2 ? 'HIGH' : 'INFO',
          title: `Sponsor ${c.company || c.slot || ''} Habis`,
          detail: `Slot ${c.slot || '-'} · ${luvK > 0 ? `Luvas ${luvK}K` : `${moK}K/bln`} — negosiasi Tier 3 (+7..12%)!`,
        });
      }
    }

    if (naming && typeof naming === 'object') {
      const nRem = U.safeInt(naming.monthsLeft, 99);
      if (nRem >= 1 && nRem <= 12) {
        commercialEventsCount++;
        const nBucket = months[Math.min(11, nRem - 1)];
        const nK = Math.round(U.safeNum(naming.yearly, 0) / 1000);
        nBucket.events.push({
          type: 'NAMING',
          sev: nRem <= 3 ? 'CRITICAL' : 'WARN',
          title: `Naming Rights ${naming.company || naming.name || ''} Habis`,
          detail: `${nK}K/thn — WAJIB pilih kontrak 1 Tahun (1.15x, +30.7% vs 5th)!`,
        });
      }
    }

    const ut = (uTeam && typeof uTeam === 'object') ? uTeam : {};
    if (ut.ctWork && ut.ctWork.endDate) {
      const idx = ymToIdx.get(String(ut.ctWork.endDate).slice(0, 7));
      if (idx !== undefined) {
        months[idx].events.push({
          type: 'FACILITY',
          sev: 'INFO',
          title: `CT Upgrade Lv ${ut.ctWork.to || '?'} Selesai`,
          detail: 'Slot & bonus pertumbuhan aktif otomatis di tanggal ini.',
        });
      }
    }
    const stWork = ut.stadiumConstruction || null;
    if (stWork && (stWork.endDate || stWork.end)) {
      const idx = ymToIdx.get(String(stWork.endDate || stWork.end).slice(0, 7));
      if (idx !== undefined) {
        months[idx].events.push({
          type: 'FACILITY',
          sev: 'INFO',
          title: 'Konstruksi Stadion Selesai',
          detail: 'Penutupan sementara 12% kursi berakhir.',
        });
      }
    }

    let goldenQueueCount = 0;
    let trapQueueCount = 0;
    const scanRoster = (list, kind) => {
      for (const p of (Array.isArray(list) ? list : [])) {
        if (!p || p.loanedFrom) continue;
        const cd = U.safeInt(p.contractDays, 999);
        const item = {
          id: p.id,
          name: p.name,
          pos: p.pos,
          force: p.force,
          contractDays: cd,
          salary: p.salary || 0,
          kind,
        };
        if (cd >= 60 && cd <= 480) {
          const gIdx = cd <= 120 ? 0 : Math.min(11, Math.floor((cd - 120) / 30));
          months[gIdx].goldenPlayers.push(item);
          goldenQueueCount++;
        }
        if (cd <= 360) {
          const tIdx = cd <= 10 ? 0 : Math.min(11, Math.floor((cd - 10) / 30));
          months[tIdx].trapPlayers.push(item);
          trapQueueCount++;
        }
      }
    };
    scanRoster(userRoster, 'roster');
    scanRoster(bTeamRoster, 'bteam');

    for (const m of months) {
      m.goldenPlayers.sort((a, b) => (a.contractDays - b.contractDays) || (b.force - a.force));
      m.trapPlayers.sort((a, b) => (a.contractDays - b.contractDays) || (b.force - a.force));
      if (m.goldenPlayers.length) {
        m.events.push({
          type: 'GOLDEN',
          sev: m.offset === 0 ? 'GOOD' : 'INFO',
          title: `${m.goldenPlayers.length} Kontrak di Golden Window (-12%)`,
          detail: `Diskon 3 Tahun (-12% gaji): ${m.goldenPlayers.slice(0, 3).map(x => `${x.name} (${x.contractDays}d)`).join(', ')}`,
        });
      }
      if (m.trapPlayers.length) {
        m.events.push({
          type: 'TRAP',
          sev: m.offset === 0 ? 'CRITICAL' : 'WARN',
          title: `${m.trapPlayers.length} Kontrak Masuk Zona <=10d`,
          detail: `Gunakan Loophole Auto-Renew 0% / lepas cadangan: ${m.trapPlayers.slice(0, 3).map(x => `${x.name} (${x.contractDays}d)`).join(', ')}`,
        });
      }
    }

    const endBudget12m = months.length ? months[months.length - 1].projBudget : startBudget;
    return {
      startYm: months[0] ? months[0].ym : dStr,
      endYm: months.length ? months[months.length - 1].ym : dStr,
      startBudget,
      endBudget12m,
      totalNet12m: endBudget12m - startBudget,
      commercialEventsCount,
      goldenQueueCount,
      trapQueueCount,
      months,
    };
  }

  LF.economy = {
    priceFactorV9,
    evalMemberPlan,
    evalClubShop,
    getBaseTicketPrices,
    ticketDemandV9,
    simulateStadiumByPricesV9,
    simulateStadiumV9,
    optimizeTicketPricesV9,
    computeAllTicketPhases,
    calcExpansionCost,
    calcStadiumRoi,
    tvQuotaMonthly,
    ctUpkeepMonthly,
    youthCoachMonthly,
    computeMonthlyLoanDue,
    computeInstallmentPlan,
    computeLoanLimit,
    computeCashflow3m,
    buildCashflowPayload,
    auditTicketPresets,
    buildCashflowCalendar12m,
  };
})(typeof window !== 'undefined' ? window : globalThis);
