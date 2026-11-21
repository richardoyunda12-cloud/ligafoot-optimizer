/**
 * LigaFoot Optimizer Web Engine — economy.js
 * Port eksak 1:1 dari optimizer/engine_economy.py (v1.2.0 / economyV = 9):
 * - priceFactor (#21338) untuk Club Shop (1.00x) & Member Plans (1.05x / 4%, fix 0.04).
 * - Simulasi & Pareto Optimizer harga tiket bulat (menjaga crowdFull >= 70.5%).
 * - Preset siap salin 6 fase ticketMulBy (normal, runin, r16, qf, sf, final).
 * - Cashflow 3 bulan + estimasi rutin musim ini (termasuk Member & TV).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;

  function priceFactor(mul, elastCfg) {
    const m = U.safeNum(mul, 1.0);
    const dx = m - 1.0;
    const k = dx >= 0 ? elastCfg.up : elastCfg.down;
    const val = Math.exp(-elastCfg.lin * dx - k * dx * dx);
    return U.clamp(val, C.PRICE_FACTOR_MIN, C.PRICE_FACTOR_MAX);
  }

  function demandWord(pf) {
    if (pf >= 1.05) return 'up';
    if (pf <= 0.95) return 'down';
    return 'flat';
  }

  /**
   * Audit Member Plans (#21319-#21326) memakai priceFactor eksak.
   * Mendukung nilai diskon tersimpan sebagai desimal (0.04 -> 4%) maupun bulat (4).
   */
  function evalMemberPlan(memberPlan, membersObj, fanConf) {
    const mp = (memberPlan && typeof memberPlan === 'object') ? memberPlan : {};
    const curM = U.clamp(Math.round(U.safeNum(mp.m, 1.0) * 20) / 20.0, 0.5, 1.5);

    let rawD = U.safeNum(('d' in mp) ? mp.d : mp.disc, 0.0);
    if (rawD > 0.0 && rawD < 1.0) {
      rawD *= 100.0;
    }
    const curD = Math.trunc(U.clamp(Math.round(rawD), 0, C.MEMBER_DISC_MAX));

    const mem = (membersObj && typeof membersObj === 'object') ? membersObj : {};
    const nMembers = U.safeInt(mem.n, 0);
    const gRatio = U.safeNum(mem.g, 0.5);

    function revIndex(m, d) {
      const pf = priceFactor(m, C.MEMBER_ELAST);
      const annualShare = Math.min(C.MEMBER_ANNUAL_SHARE_MAX, C.MEMBER_ANNUAL_PER_DISC * d);
      const retainBoost = 1.0 + C.MEMBER_ANNUAL_RETAIN_PER_DISC * d;
      let effDemand = pf * retainBoost;
      if (gRatio >= 0.995) {
        effDemand = Math.min(1.0, effDemand);
      }
      const avgPriceMul = m * (1.0 - annualShare * (d / 100.0));
      return { idx: avgPriceMul * effDemand, pf, effDemand, annualShare };
    }

    const cur = revIndex(curM, curD);
    let best = { idx: 0.0, m: 1.05, d: 4 };

    for (let mi = 10; mi <= 30; mi++) {
      const mTry = Math.round(mi * 5) / 100;
      for (let dTry = 0; dTry <= C.MEMBER_DISC_MAX; dTry++) {
        const res = revIndex(mTry, dTry);
        if (res.idx > best.idx) {
          best = { idx: res.idx, m: mTry, d: dTry };
        }
      }
    }

    const gainPct = cur.idx > 0 ? ((best.idx / cur.idx) - 1.0) * 100.0 : 0.0;
    const isOptimal = Math.abs(curM - best.m) < 0.01 && curD === best.d;

    return {
      n: nMembers,
      g: U.roundTo(gRatio, 4),
      cur_m: curM,
      cur_d: curD,
      cur_pf: U.roundTo(cur.pf, 4),
      cur_word: demandWord(cur.pf),
      cur_idx: U.roundTo(cur.idx, 4),
      opt_m: best.m,
      opt_d: best.d,
      opt_idx: U.roundTo(best.idx, 4),
      gain_pct: U.roundTo(gainPct, 2),
      is_optimal: isOptimal,
      fan_growth_active: U.safeNum(fanConf, 50) > 60,
    };
  }

  /**
   * Audit Club Shop (#21341-#21360) memakai priceFactor eksak (puncak mutlak 1.00x).
   */
  function evalClubShop(shopPrice, shopLog, roster, currentDateStr, fanConf, payrollRef) {
    const curM = U.clamp(Math.round(U.safeNum(shopPrice, 1.0) * 20) / 20.0, 0.5, 1.5);
    const curPf = priceFactor(curM, C.SHOP_ELAST);
    const curIdx = curM * curPf;
    const optM = 1.00;
    const optIdx = 1.00;
    const gainPct = curIdx > 0 ? ((optIdx / curIdx) - 1.0) * 100.0 : 0.0;

    const bigSignings = [];
    const megaSignings = [];
    let starCnt = 0;
    let topCnt = 0;

    for (const p of (roster || [])) {
      const isTop = Boolean(p.top);
      const isStar = Boolean(p.star) || isTop;
      if (isTop) topCnt++;
      else if (isStar) starCnt++;

      const ch = p.clubHistory;
      if (Array.isArray(ch) && ch.length > 0 && currentDateStr) {
        const latest = (ch[0] && typeof ch[0] === 'object') ? ch[0] : {};
        const daysSince = U.daysBetweenIso(latest.date, currentDateStr);
        if (daysSince !== null) {
          const fee = U.safeNum(latest.fee, 0);
          const isLoan = Boolean(latest.loan) || Boolean(p.loanedFrom);
          if (!isLoan && daysSince >= 0 && daysSince <= C.SHOP_MEGA_DAYS) {
            if (isTop || fee >= payrollRef * C.SHOP_MEGA_FEE_SHARE) {
              megaSignings.push({
                name: p.name,
                daysLeft: C.SHOP_MEGA_DAYS - daysSince,
                fee,
              });
            }
          }
          if (daysSince >= 0 && daysSince <= C.SHOP_SIGNING_DAYS) {
            if (isStar || fee >= payrollRef * C.SHOP_SIGNING_FEE_SHARE) {
              bigSignings.push({
                name: p.name,
                daysLeft: C.SHOP_SIGNING_DAYS - daysSince,
                fee,
              });
            }
          }
        }
      }
    }

    const history = [];
    if (shopLog && typeof shopLog === 'object' && !Array.isArray(shopLog)) {
      for (const ym of Object.keys(shopLog).sort()) {
        const entry = shopLog[ym];
        if (entry && typeof entry === 'object') {
          history.push({
            ym,
            shirts: U.safeInt(entry.s, 0),
            revenue: U.safeNum(entry.r, 0),
            top: entry.t || [],
          });
        }
      }
    }

    const hypeBonus = megaSignings.length
      ? C.SHOP_MEGA_BONUS
      : (bigSignings.length ? C.SHOP_SIGNING_BONUS : 0.0);
    const starBonus = Math.min(0.30, starCnt * 0.04 + topCnt * 0.08);
    const last12 = history.slice(-12);

    return {
      cur_m: curM,
      cur_pf: U.roundTo(curPf, 4),
      cur_word: demandWord(curPf),
      cur_idx: U.roundTo(curIdx, 4),
      opt_m: optM,
      opt_idx: optIdx,
      gain_pct: U.roundTo(gainPct, 2),
      is_optimal: Math.abs(curM - optM) < 0.01,
      star_cnt: starCnt,
      top_cnt: topCnt,
      star_bonus_pct: U.roundTo(starBonus * 100, 1),
      hype_bonus_pct: U.roundTo(hypeBonus * 100, 1),
      mega_signings: megaSignings,
      big_signings: bigSignings,
      history: last12,
      last_rev: last12.length ? last12[last12.length - 1].revenue : 0,
      last_shirts: last12.length ? last12[last12.length - 1].shirts : 0,
    };
  }

  function ticketDemandV9(mul, bigMatch = false) {
    const m = U.clamp(mul, 0.5, 2.0);
    const slope = bigMatch ? 0.2 : 0.7;
    if (m < 1.0) return 1.0 + 0.4 * (1.0 - m);
    return Math.max(0.25, 1.0 - slope * (m - 1.0));
  }

  function simulateStadiumV9(sections, muls, fanConf = 80, division = 1, knockout = false, bigMatch = false, repDiff = 0) {
    const basePrices = C.TICKETS_BASE[division] || C.TICKETS_BASE[1];
    const secs = sections || {};
    const mObj = muls || {};
    const sectorKeys = ['geral', 'arquibancada', 'cadeiras', 'camarotes'];

    let totalCap = 0;
    for (const s of sectorKeys) totalCap += U.safeInt(secs[s], 0);
    totalCap = Math.max(1, totalCap);

    const fanFactor = 0.62 + 0.48 * U.clamp(fanConf / 100.0, 0.0, 1.0);
    const matchBonus = (bigMatch ? 0.20 : 0.0) + (knockout ? 0.15 : 0.0);
    const repAdj = U.clamp(repDiff * 0.004, -0.20, 0.25);
    const baseFill = U.clamp(fanFactor + matchBonus + repAdj, 0.35, 1.55);

    const secMultDemand = { geral: 0.92, arquibancada: 1.08, cadeiras: 2.40, camarotes: 4.20 };

    let totalAtt = 0;
    let totalRev = 0.0;
    const perSector = {};

    for (const sec of sectorKeys) {
      const baseP = basePrices[sec];
      const cap = U.safeInt(secs[sec], 0);
      const mul = U.clamp(U.safeNum(mObj[sec], 1.0), 0.5, 2.0);
      const price = Math.max(1, Math.round(baseP * mul));
      const effMul = price / baseP;
      const dem = ticketDemandV9(effMul, bigMatch);
      const fill = U.clamp(baseFill * secMultDemand[sec] * dem, 0.0, 1.0);
      const att = Math.round(cap * fill);
      const rev = att * price;
      totalAtt += att;
      totalRev += rev;
      perSector[sec] = {
        cap,
        basePrice: baseP,
        price,
        mul: U.roundTo(effMul, 3),
        att,
        fillPct: U.roundTo(fill * 100.0, 1),
        rev,
      };
    }

    const fillPct = (totalAtt / totalCap) * 100.0;
    return {
      totalCap,
      totalAtt,
      fillPct: U.roundTo(fillPct, 1),
      crowdFull: fillPct >= 70.0,
      totalRev: Math.round(totalRev),
      sectors: perSector,
    };
  }

  /**
   * Pareto optimizer harga tiket bulat yang WAJIB menjaga total keterisian >= 70.5%.
   */
  function optimizeTicketPricesV9(sections, fanConf = 80, division = 1, knockout = false, bigMatch = false, repDiff = 0) {
    const basePrices = C.TICKETS_BASE[division] || C.TICKETS_BASE[1];
    const secs = sections || {};
    const sectorKeys = ['geral', 'arquibancada', 'cadeiras', 'camarotes'];

    let totalCap = 0;
    for (const s of sectorKeys) totalCap += U.safeInt(secs[s], 0);
    totalCap = Math.max(1, totalCap);
    const minAttTarget = Math.ceil(totalCap * 0.705);

    const secOpts = {};
    for (const sec of sectorKeys) {
      const bp = basePrices[sec];
      const loP = Math.max(1, Math.round(bp * 0.5));
      const hiP = Math.max(loP, Math.round(bp * 2.0));
      const step = bp >= 50 ? 5 : 1;
      const opts = [];

      for (let p = loP; p <= hiP; p += step) {
        const sd = simulateStadiumV9(secs, { [sec]: p / bp }, fanConf, division, knockout, bigMatch, repDiff).sectors[sec];
        opts.push([p, sd.att, sd.rev]);
      }
      if (!opts.length || opts[opts.length - 1][0] !== hiP) {
        const sd = simulateStadiumV9(secs, { [sec]: hiP / bp }, fanConf, division, knockout, bigMatch, repDiff).sectors[sec];
        opts.push([hiP, sd.att, sd.rev]);
      }

      opts.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]));
      const pareto = [];
      let bestR = -1;
      for (const o of opts) {
        if (o[2] > bestR) {
          pareto.push(o);
          bestR = o[2];
        }
      }
      secOpts[sec] = pareto;
    }

    let bestFeas = null;
    let bestAny = null;
    for (const [gp, ga, gr] of secOpts.geral) {
      for (const [ap, aa, ar] of secOpts.arquibancada) {
        for (const [cp, ca, cr] of secOpts.cadeiras) {
          for (const [vp, va, vr] of secOpts.camarotes) {
            const totA = ga + aa + ca + va;
            const totR = gr + ar + cr + vr;
            const cand = { rev: totR, att: totA, prices: { geral: gp, arquibancada: ap, cadeiras: cp, camarotes: vp } };
            if (!bestAny || totR > bestAny.rev) bestAny = cand;
            if (totA >= minAttTarget && (!bestFeas || totR > bestFeas.rev)) {
              bestFeas = cand;
            }
          }
        }
      }
    }

    const chosen = bestFeas || bestAny;
    const prices = chosen.prices;
    const muls = {};
    for (const s of sectorKeys) {
      muls[s] = U.roundTo(prices[s] / basePrices[s], 4);
    }
    const sim = simulateStadiumV9(secs, muls, fanConf, division, knockout, bigMatch, repDiff);
    return { prices, muls, sim };
  }

  function computeAllTicketPhases(sections, fanConf = 80, division = 1, ticketMulBy = null, curMul = null) {
    const basePrices = C.TICKETS_BASE[division] || C.TICKETS_BASE[1];
    const tmb = (ticketMulBy && typeof ticketMulBy === 'object') ? ticketMulBy : {};
    const fallbackM = U.normalizeTicketMul(curMul);
    const sectorKeys = ['geral', 'arquibancada', 'cadeiras', 'camarotes'];

    const phaseSpecs = [
      ['normal', 'Liga Normal',              false, false,  0],
      ['runin',  'Akhir Musim (Run-in)',     false, true,   5],
      ['r16',    '16 Besar (R16 · Normal)',  true,  false,  5],
      ['qf',     'Perempat Final (QF)',      true,  true,   8],
      ['sf',     'Semifinal (SF)',           true,  true,  10],
      ['final',  'Final (Big Match)',        true,  true,  15],
    ];

    return phaseSpecs.map(([key, label, isKo, isBig, repD]) => {
      const opt = optimizeTicketPricesV9(sections, fanConf, division, isKo, isBig, repD);
      const hasCustom = Object.prototype.hasOwnProperty.call(tmb, key);
      const cm = hasCustom ? U.normalizeTicketMul(tmb[key]) : fallbackM;
      const curPrices = {};
      for (const s of sectorKeys) {
        curPrices[s] = Math.max(1, Math.round(basePrices[s] * cm[s]));
      }
      const curSim = simulateStadiumV9(sections, cm, fanConf, division, isKo, isBig, repD);
      return {
        phase: key,
        label,
        isCustom: hasCustom,
        curPrices,
        optPrices: opt.prices,
        optMuls: opt.muls,
        fillPct: opt.sim.fillPct,
        estRev: opt.sim.totalRev,
        revGain: Math.round(opt.sim.totalRev - curSim.totalRev),
      };
    });
  }

  function computeCashflow3m(teamObj, ledger, lastLedger, payrollEst = 0, stadiumOps = 0) {
    const led = (ledger && typeof ledger === 'object') ? ledger : {};
    const lled = (lastLedger && typeof lastLedger === 'object') ? lastLedger : {};

    const opIncKeys = [
      'tickets', 'gate', 'bilheteria',
      'sponsors', 'sponsor', 'patrocinio',
      'tv', 'members', 'socios', 'shop', 'loja', 'naming',
    ];
    const opExpKeys = [
      'payroll', 'salary', 'salaries', 'wages', 'salarios', 'folha',
      'stadium', 'stadiumOps', 'estadio',
      'ct', 'ctUpkeep', 'youthCoach', 'base',
      'loans', 'loanInterest', 'juros',
    ];

    function sumKeys(d, keys) {
      let tot = 0;
      for (const k of keys) {
        if (k in d) tot += Math.abs(U.safeNum(d[k], 0));
      }
      return tot;
    }

    const lInc = sumKeys(lled, opIncKeys);
    const lExp = sumKeys(lled, opExpKeys);
    const cInc = sumKeys(led, opIncKeys);
    const cExp = sumKeys(led, opExpKeys);

    const baseExpFloor = Math.max(0.0, U.safeNum(payrollEst, 0) + U.safeNum(stadiumOps, 0));
    let monthlyInc = 0, monthlyExp = 0, srcNote = '';

    if (lInc > 0 || lExp > 0) {
      monthlyInc = lInc;
      monthlyExp = lExp;
      srcNote = 'Bulan penuh terakhir (lastLedger)';
      if ((baseExpFloor > 0 && lInc > Math.max(12000000, baseExpFloor * 5.0)) ||
          (baseExpFloor > 0 && lExp > baseExpFloor * 4.5)) {
        monthlyInc = lInc / 12.0;
        monthlyExp = lExp / 12.0;
        srcNote = 'Rata-rata Musim Lalu (lastLedger ÷ 12, non-hadiah)';
      }
    } else {
      monthlyInc = cInc;
      monthlyExp = cExp;
      srcNote = 'Bulan berjalan (ledger)';
      if (baseExpFloor > 0 && cInc > Math.max(12000000, baseExpFloor * 5.0)) {
        monthlyInc = cInc / 12.0;
        monthlyExp = cExp / 12.0;
        srcNote = 'Rata-rata bulanan (ledger ÷ 12)';
      }
    }

    if (baseExpFloor > 0 && monthlyExp < baseExpFloor * 0.70) {
      monthlyExp = baseExpFloor;
      srcNote += ' + gaji & ops stadion';
    }

    const stmt = (teamObj && Array.isArray(teamObj.statement)) ? teamObj.statement : [];
    const capexKeywords = ['stad', 'ct', 'buy', 'sell', 'transf', 'obra', 'constru', 'reform', 'venda', 'compra'];
    if (stmt.length) {
      const byMonth = {};
      for (const row of stmt) {
        if (!row || typeof row !== 'object') continue;
        const dt = String(row.date || row.d || '').slice(0, 7);
        if (dt.length !== 7) continue;
        const desc = String(row.label || row.type || row.cat || row.k || '').toLowerCase();
        if (capexKeywords.some(ck => desc.includes(ck))) continue;
        const amt = U.safeNum(('amount' in row) ? row.amount : row.v, 0);
        if (!byMonth[dt]) byMonth[dt] = [0.0, 0.0];
        if (amt >= 0) byMonth[dt][0] += amt;
        else byMonth[dt][1] += Math.abs(amt);
      }
      const fullMonths = Object.keys(byMonth).sort().slice(0, -1);
      if (fullMonths.length) {
        const recent = fullMonths.slice(-3);
        const avgI = recent.reduce((s, m) => s + byMonth[m][0], 0) / recent.length;
        const avgE = recent.reduce((s, m) => s + byMonth[m][1], 0) / recent.length;
        if (avgI > 0 || avgE > 0) {
          monthlyInc = avgI;
          monthlyExp = avgE;
          srcNote = `Rata-rata ${recent.length} bulan penuh (bebas CapEx)`;
        }
      }
    }

    return {
      monthlyIncome: Math.round(monthlyInc),
      monthlyExpense: Math.round(monthlyExp),
      monthlyNet: Math.round(monthlyInc - monthlyExp),
      sourceNote: srcNote,
    };
  }

  function buildCashflowPayload(
    cashflowMeta, uTeam, curSim, spContracts, shopAudit, memberAudit,
    totalPayroll, stadiumOps, userDiv
  ) {
    const led = (uTeam && uTeam.ledger && typeof uTeam.ledger === 'object') ? uTeam.ledger : {};
    const lled = (uTeam && uTeam.lastLedger && typeof uTeam.lastLedger === 'object') ? uTeam.lastLedger : {};
    const isLledAnnual = String(cashflowMeta.sourceNote || '').includes('÷ 12');
    const lDiv = isLledAnnual ? 12.0 : 1.0;

    const estTickets = Math.round(U.safeNum(curSim && curSim.totalRev, 0) * 2.0);
    const estSponsors = Math.round((spContracts || []).reduce((sum, s) => {
      const mo = U.safeNum(s.monthly, 0);
      const luv = U.safeNum(s.luvas, 0) / Math.max(1.0, U.safeNum(s.months, 12));
      return sum + (mo || luv);
    }, 0));
    const estNaming = Math.round(U.safeNum(uTeam && uTeam.naming && uTeam.naming.yearly, 0) / 12.0);
    const estShop = Math.round(U.safeNum(shopAudit && shopAudit.last_rev, 0));

    const memFromLed = U.safeNum(('members' in led) ? led.members : led.socios, 0);
    const memFromLled = U.safeNum(('members' in lled) ? lled.members : lled.socios, 0) / lDiv;
    let estMembers = 0;
    if (memFromLed > 0) {
      estMembers = Math.round(memFromLed);
    } else if (memFromLled > 0) {
      estMembers = Math.round(memFromLled);
    } else {
      const nMem = U.safeInt(memberAudit && memberAudit.n, 0);
      const curM = U.safeNum(memberAudit && memberAudit.cur_m, 1.0);
      const curD = U.safeInt(memberAudit && memberAudit.cur_d, 0);
      const baseFee = { 1: 4.0, 2: 2.5, 3: 1.5, 4: 1.0 }[userDiv] || 3.5;
      const discEff = 1.0 - Math.min(0.55, 0.045 * curD) * (curD / 100.0);
      estMembers = Math.round(nMem * baseFee * curM * discEff);
    }

    const tvFromLed = U.safeNum(led.tv, 0);
    const tvFromLled = U.safeNum(lled.tv, 0) / lDiv;
    const estTv = Math.round(tvFromLed > 0 ? tvFromLed : tvFromLled);

    const estIn = estTickets + estSponsors + estNaming + estShop + estMembers + estTv;
    const estOut = Math.round(U.safeNum(totalPayroll, 0) + U.safeNum(stadiumOps, 0));
    const estNet = estIn - estOut;

    return {
      ...cashflowMeta,
      estCurrentIncome: estIn,
      estCurrentExpense: estOut,
      estCurrentNet: estNet,
      estBreakdown: {
        tickets: estTickets,
        sponsors: estSponsors,
        naming: estNaming,
        members: estMembers,
        tv: estTv,
        shop: estShop,
        payroll: Math.round(U.safeNum(totalPayroll, 0)),
        stadiumOps: Math.round(U.safeNum(stadiumOps, 0)),
      },
    };
  }

  LF.economy = {
    priceFactor,
    demandWord,
    evalMemberPlan,
    evalClubShop,
    ticketDemandV9,
    simulateStadiumV9,
    optimizeTicketPricesV9,
    computeAllTicketPhases,
    computeCashflow3m,
    buildCashflowPayload,
  };
})(typeof window !== 'undefined' ? window : globalThis);
