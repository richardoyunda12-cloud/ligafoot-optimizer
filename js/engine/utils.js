/**
 * LigaFoot Optimizer Web Engine — utils.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * helper matematika, konversi tanggal, PAYROLL_REF (#19856), teamLevelOf (#21518),
 * countryGroup/hasAffinity (#21513/#21517), parser tuple statement (#21866),
 * & pembacaan static_db v2 (compact array [name, short, country, level, rep]).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;

  function safeNum(val, fallback = 0.0) {
    if (val === null || val === undefined || typeof val === 'boolean' || val === '') {
      return fallback;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeInt(val, fallback = 0) {
    if (val === null || val === undefined || typeof val === 'boolean' || val === '') {
      return fallback;
    }
    const n = Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function roundTo(val, digits = 2) {
    const f = Math.pow(10, digits);
    return Math.round(val * f) / f;
  }

  function fmtMoney(v) {
    const n = Number(v) || 0;
    const sg = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (a >= 1e6) return sg + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return sg + Math.round(a / 1e3) + 'K';
    return sg + Math.round(a);
  }

  function posCategory(posCode) {
    return C.POS_CATEGORY[posCode] !== undefined ? C.POS_CATEGORY[posCode] : 2;
  }

  function posEn(posCode) {
    if (!posCode) return '-';
    return C.POS_PT_TO_EN[posCode] || posCode;
  }

  function skillEn(skillCode) {
    if (!skillCode) return '';
    return (C.SKILL_PT_TO_EN[skillCode] || skillCode).trim();
  }

  function getDeclineAge(posCode) {
    const cat = posCategory(posCode);
    return C.DECLINE_AGE_BY_CAT[cat] !== undefined ? C.DECLINE_AGE_BY_CAT[cat] : 33;
  }

  function getSellWarnAge(posCode) {
    const cat = posCategory(posCode);
    return C.SELL_WARN_AGE_BY_CAT[cat] !== undefined ? C.SELL_WARN_AGE_BY_CAT[cat] : 31;
  }

  // Bytecode #19854 reputationLevel: <20->0, <35->1, <50->2, <68->3, <82->4, >=82->5
  function reputationLevel(rep) {
    const r = safeNum(rep, 50);
    if (r < 20) return 0;
    if (r < 35) return 1;
    if (r < 50) return 2;
    if (r < 68) return 3;
    if (r < 82) return 4;
    return 5;
  }

  // Bytecode #19856 payrollRef (TAHUNAN / ANNUAL)
  function payrollRef(country = 'OTHER', division = 1, repLvl = 0) {
    const c = String(country || '').toUpperCase();
    const div = safeInt(division, 1);
    const rLv = safeInt(repLvl, 0);
    if (div === 1 && rLv >= 4) {
      const bigTbl = C.PAYROLL_REF_BIG[c] || C.PAYROLL_REF_BIG.OTHER;
      const bigVal = bigTbl[Math.min(5, rLv)];
      if (bigVal) return bigVal;
    }
    const tbl = C.PAYROLL_REF[c] || C.PAYROLL_REF.OTHER;
    if (div === 0) return Math.round((tbl[4] || 5900000) * 0.5);
    return tbl[div] || tbl[2] || 18700000;
  }

  // Legacy wrapper agar pemanggil lama tetap mendapatkan nilai PAYROLL_REF tahunan eksak
  function estimatePayrollRef(division = 1, _currentPayroll = 0, country = 'OTHER', repLvl = 0) {
    return payrollRef(country, division, repLvl);
  }

  // Bytecode #21513 countryGroup
  function countryGroup(code) {
    const c = String(code || '').toUpperCase();
    const groups = C.COUNTRY_GROUPS || {};
    for (const [gId, list] of Object.entries(groups)) {
      if (Array.isArray(list) && list.includes(c)) return Number(gId);
    }
    return 5;
  }

  // Bytecode #21515 sameCountry (UK_CODES diperlakukan satu negara)
  function sameCountry(a, b) {
    const ca = String(a || '').toUpperCase();
    const cb = String(b || '').toUpperCase();
    if (!ca || !cb) return false;
    if (ca === cb) return true;
    const uk = C.UK_CODES || [];
    return uk.includes(ca) && uk.includes(cb);
  }

  // Bytecode #21517 hasAffinity
  function hasAffinity(a, b) {
    const ca = String(a || '').toUpperCase();
    const cb = String(b || '').toUpperCase();
    if (!ca || !cb) return false;
    if (sameCountry(ca, cb)) return true;
    for (const cl of (C.AFFINITY_CLUSTERS || [])) {
      if (cl.includes(ca) && cl.includes(cb)) return true;
    }
    return false;
  }

  // Bytecode #21510 clubLevelFromReputation + #21571 baseTeamLevelOf + #21572 teamLevelOf
  function teamLevelOf(team, division = 1, staticLevel = null) {
    const rawBonus = Number(team && team.levelBonus);
    const levelBonus = Number.isFinite(rawBonus) ? Math.max(0, Math.round(rawBonus)) : 0;

    const rawTeamLv = Number(team && team.level);
    const rawStatLv = Number(staticLevel);
    let base = 0;
    if (Number.isFinite(rawTeamLv) && rawTeamLv > 0) {
      base = Math.min(25, rawTeamLv);
    } else if (Number.isFinite(rawStatLv) && rawStatLv > 0) {
      base = Math.min(25, rawStatLv);
    } else {
      const rawRep = safeNum(team && (team.reputation !== undefined ? team.reputation : team.rep), 50);
      base = Math.max(1, Math.round(clamp(rawRep, 0, 100) * 0.23));
    }
    return Math.min(25, base + levelBonus);
  }

  // Bytecode #21490 getForeignLimit
  function getForeignLimit(country) {
    const c = String(country || '').toUpperCase();
    const lims = C.FOREIGN_LIMITS || {};
    return lims[c] || lims.DEFAULT || { max: 9, field: 7 };
  }

  // Bytecode #19789 terminationFeeRate (sisa hari <= 0 -> 0; maks 30%)
  function terminationFeeRate(daysLeft) {
    const d = safeInt(daysLeft, 0);
    if (d <= 0) return 0;
    for (const t of (C.TERMINATION_FEE_TIERS || [])) {
      if (d <= t.maxDays) return t.rate;
    }
    return 0.30;
  }

  // Bytecode #24161 renewalMinimumSalary: persentase perubahan gaji minimum saat perpanjang.
  // termIdx: 0=6bln, 1=1th, 2=2th, 3=3th. Negatif = diskon, positif = kenaikan.
  function renewalSalaryDelta(contractDays, termIdx = 3) {
    const d = safeInt(contractDays, 0);
    const i = Math.max(0, Math.min(3, safeInt(termIdx, 3)));
    if (d <= 10) return C.RENEWAL_RAISE_LAST[i];
    if (d < C.RENEWAL_DISCOUNT_FROM_DAYS) return C.RENEWAL_RAISE_MID[i];
    return C.RENEWAL_DISCOUNT[i];
  }

  // Bytecode #24160 salaryFloorFactor + #24162 salaryCutMinimum
  // Mengembalikan pengali gaji terendah yang masih bisa dipotong (1 = tidak bisa dipotong lagi).
  function salaryCutFloorMul(isReserve, age, salaryCuts, renewRefusals) {
    const S = C.SALARY_CUT;
    if (safeInt(salaryCuts, 0) >= S.maxCuts) return 1.0;
    const factor = Math.max(0.5, 1
      + (isReserve ? S.reserve : 0)
      + (safeInt(age, 25) >= S.veteranAge ? S.veteran : 0)
      + safeInt(salaryCuts, 0) * S.perCut
      + safeInt(renewRefusals, 0) * S.perRefusal);
    return Math.min(1.0, S.cutBase * factor);
  }

  // Bytecode #20971 & #20972 injuryTier & injurySaleFactor (#3724 L806140)
  // <=10d: minor (0.70), <=30d: moderate (0.55), <=60d: major (0.40), >60d: severe (0.25)
  function injuryTier(days) {
    const d = safeInt(days, 0);
    if (d <= 0) return 'none';
    const cfg = C.INJURED_SALE || { minorMaxDays: 10, moderateMaxDays: 30, majorMaxDays: 60 };
    if (d <= (cfg.minorMaxDays || 10)) return 'minor';
    if (d <= (cfg.moderateMaxDays || 30)) return 'moderate';
    if (d <= (cfg.majorMaxDays || 60)) return 'major';
    return 'severe';
  }

  function injurySaleFactor(days) {
    const tier = injuryTier(days);
    const cfg = C.INJURED_SALE || { minorFactor: 0.70, moderateFactor: 0.55, majorFactor: 0.40, severeFactor: 0.25 };
    if (tier === 'none') return 1.0;
    if (tier === 'minor') return cfg.minorFactor || 0.70;
    if (tier === 'moderate') return cfg.moderateFactor || 0.55;
    if (tier === 'major') return cfg.majorFactor || 0.40;
    return cfg.severeFactor || 0.25;
  }

  // Bytecode #21374 retirementChance (diverifikasi): TIDAK memakai force.
  //   eff = age - (worldTop ? 3 : 0) - ((craque||worldTop) ? 1 : 0) - (GK ? 3 : 0)
  //   Asumsi pemetaan: p.top -> worldTop, p.star -> craque.
  function retirementChance(age, pos, force, opts = {}) {
    const top = Boolean(opts && opts.top);
    const star = Boolean(opts && opts.star);
    const eff = safeInt(age, 25) - (top ? 3 : 0) - ((star || top) ? 1 : 0) - (pos === 'G' ? 3 : 0);
    if (eff < 32) return 0;
    if (eff === 32) return 0.01;
    if (eff <= 34) return 0.10;
    if (eff === 35) return 0.45;
    if (eff === 36) return 0.70;
    if (eff <= 38) return 0.85;
    if (eff === 39) return 0.95;
    if (eff === 40) return 0.97;
    if (eff <= 42) return 0.98;
    if (eff <= 48) return 0.99;
    return 1.0;
  }

  // Bytecode #20408 loanBuyDecisionChance (#3730 LOAN_OPTION L806200)
  // games = max(seasonGames, round(seasonMinutes/70)); jika games < 5 -> 0
  // chance = 0.15 + min(1, games/20)*0.35 + min(0.25, goals*0.02) + (age<=23 ? 0.15 : 0) + (!injured ? 0.15 : 0), cap 0.85
  function loanBuyDecisionChance(p) {
    if (!p || !p.loanedFrom || safeNum(p.loanBuyFee, 0) <= 0) return 0;
    const cfg = C.LOAN_OPTION || {
      baseChance: 0.15, minGames: 5, gamesTarget: 20, gamesBonus: 0.35,
      goalsBonusPerGoal: 0.02, goalsBonusMax: 0.25, youngAge: 23, youngBonus: 0.15, fitBonus: 0.15, maxChance: 0.85,
    };
    const mins = safeNum(p.seasonMinutes, 0);
    const games = Math.max(safeInt(p.seasonGames ?? p.gamesPlayed, 0), Math.round(mins / 70.0));
    if (games < (cfg.minGames || 5)) return 0;
    let chance = cfg.baseChance || 0.15;
    chance += Math.min(1.0, games / (cfg.gamesTarget || 20)) * (cfg.gamesBonus || 0.35);
    chance += Math.min(cfg.goalsBonusMax || 0.25, safeInt(p.seasonGoals, 0) * (cfg.goalsBonusPerGoal || 0.02));
    if (safeInt(p.age, 25) <= (cfg.youngAge || 23)) chance += (cfg.youngBonus || 0.15);
    if (!p.injured) chance += (cfg.fitBonus || 0.15);
    return clamp(roundTo(chance, 2), 0, cfg.maxChance || 0.85);
  }

  // Bytecode #19869 fixedSponsorParcel
  function fixedSponsorParcel(fs) {
    if (!fs || typeof fs !== 'object') return 0;
    const paid = safeInt(fs.paid, 0);
    const total = safeNum(fs.total, 0);
    if (paid >= 12 || total <= 0) return 0;
    const cumNext = Math.round((total * (paid + 1)) / 12);
    const cumPrev = Math.round((total * paid) / 12);
    return Math.max(0, cumNext - cumPrev);
  }

  // Bytecode #21866 statement row parser (mendukung tuple [date, cat, amt, ...meta] & object fallback)
  const EXPENSE_CATEGORIES = new Set([
    'salaries', 'purchases', 'stadium', 'ct', 'termination', 'loans', 'loanInterest', 'interest', 'youthCoach', 'misc',
  ]);
  const CAPEX_CATEGORIES = new Set([
    'purchases', 'termination', 'sales', 'misc',
  ]);

  const STMT_CAT_LABELS = {
    tickets: 'Tiket Kandang',
    sponsors: 'Sponsor & TV',
    prize: 'Hadiah Kompetisi',
    sales: 'Penjualan Pemain',
    shop: 'Club Shop (Jersey)',
    members: 'Iuran Member (Sócio)',
    naming: 'Naming Rights Stadion',
    fines: 'Denda Pemain',
    salaries: 'Gaji Skuad',
    purchases: 'Pembelian Pemain',
    stadium: 'Stadion (Ops / Konstruksi)',
    ct: 'Training Center (CT)',
    termination: 'Pesangon / Pemutusan',
    loans: 'Cicilan Pinjaman Bank',
    loanInterest: 'Bunga Pinjaman Bank',
    interest: 'Bunga & Cicilan Bank',
    youthCoach: 'Pelatih Akademi',
    misc: 'Biaya Lain-lain (Olheiro / Akademi)',
  };

  function parseStatementRow(row) {
    if (!row) return null;
    if (Array.isArray(row) && row.length >= 3) {
      const date = String(row[0] || '').slice(0, 10);
      const cat = String(row[1] || 'other');
      const rawAmt = Math.abs(safeNum(row[2], 0));
      const isExpense = EXPENSE_CATEGORIES.has(cat);
      const signedAmt = isExpense ? -rawAmt : rawAmt;
      const dayStr = date.slice(8, 10);
      const isCapEx = CAPEX_CATEGORIES.has(cat)
        || ((cat === 'stadium' || cat === 'ct') && dayStr !== '02' && rawAmt > 200000);
      const baseLabel = STMT_CAT_LABELS[cat] || cat;
      const extraMeta = row[3] && typeof row[3] === 'string' ? ` (${row[3]})` : '';
      return {
        date,
        category: cat,
        label: baseLabel + extraMeta,
        rawAmount: rawAmt,
        amount: signedAmt,
        isExpense,
        isCapEx,
      };
    }
    if (typeof row === 'object') {
      const date = String(row.date || row.d || '').slice(0, 10);
      const cat = String(row.category || row.type || row.k || row.label || row.desc || '-');
      const amt = safeNum(('amount' in row) ? row.amount : row.v, 0);
      const isExpense = amt < 0 || EXPENSE_CATEGORIES.has(cat);
      const rawAmt = Math.abs(amt);
      const signedAmt = isExpense && amt > 0 ? -rawAmt : amt;
      const dayStr = date.slice(8, 10);
      const isCapEx = CAPEX_CATEGORIES.has(cat)
        || ((cat === 'stadium' || cat === 'ct') && dayStr !== '02' && rawAmt > 200000);
      return {
        date,
        category: cat,
        label: STMT_CAT_LABELS[cat] || String(row.label || row.desc || cat),
        rawAmount: rawAmt,
        amount: signedAmt,
        isExpense,
        isCapEx,
      };
    }
    return null;
  }

  function parseIsoDateUtc(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const s = dateStr.trim().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(ms) ? ms : null;
  }

  function daysBetweenDates(d1Str, d2Str) {
    const ms1 = parseIsoDateUtc(d1Str);
    const ms2 = parseIsoDateUtc(d2Str);
    if (ms1 === null || ms2 === null) return 9999;
    return Math.abs(Math.round((ms2 - ms1) / 86400000));
  }

  function daysBetweenIso(d1Str, d2Str) {
    const ms1 = parseIsoDateUtc(d1Str);
    const ms2 = parseIsoDateUtc(d2Str);
    if (ms1 === null || ms2 === null) return 0;
    return Math.round((ms2 - ms1) / 86400000);
  }

  /**
   * Port 1:1 Hermes v1.2.0 (`#18782 weeklyGrowthRate`, `#21716 ctGrowthBonus`, `#21720 trainGrowthBonus`):
   * Menghitung estimasi laju pertumbuhan mingguan (Force/pekan).
   */
  function estimateWeeklyGrowthRate(p, opts = {}) {
    const pl = (p && typeof p === 'object') ? p : {};
    const o = (opts && typeof opts === 'object') ? opts : {};
    const age = safeInt(pl.age, 25);
    const f = Math.max(1, Math.round(safeNum(pl.force, 25)));
    const lv = safeInt(o.clubLevel, 15);
    const ct = clamp(safeInt(o.ctLevel, 1), 1, 10);
    const played = o.played !== undefined
      ? Boolean(o.played)
      : ((safeNum(pl.seasonMinutes, 0) > 0) || (safeInt(pl.gamesPlayed, 0) > 0));
    const inTrain = Boolean(o.inTrain);
    const unhappy = o.unhappy !== undefined
      ? Boolean(o.unhappy)
      : (pl.mood === 'unhappy' || Boolean(pl.roleSore));

    let rate = 0.02;
    if (lv >= 19) rate = age < 20 ? 0.16 : (age <= 22 ? 0.12 : (age <= 28 ? 0.10 : 0.08));
    else if (lv >= 15) rate = age < 18 ? 0.12 : (age <= 20 ? 0.10 : (age <= 28 ? 0.08 : 0.06));
    else if (lv >= 11) rate = age < 18 ? 0.10 : (age <= 20 ? 0.08 : (age <= 28 ? 0.06 : 0.04));
    else rate = age < 18 ? 0.08 : (age <= 20 ? 0.06 : (age <= 28 ? 0.04 : 0.02));

    if (played) rate += 0.04;
    if (f > 70) rate -= 0.05;
    else if (f > 50) rate -= 0.04;
    else if (f > 40) rate -= 0.03;
    else if (f >= 30) rate -= 0.02;

    const dev = safeNum(pl.development, 0);
    const hashVal = safeInt(pl.hash, 0);
    if (dev > 0) {
      if (dev < 50) rate -= 0.05;
      else if (dev < 70) rate -= 0.02;
      if (hashVal >= 9) rate += 0.04;
      else if (hashVal >= 7) rate += 0.02;
    }

    if (pl.top) rate += 0.02;
    else if (pl.star) rate += 0.01;

    const c = String(o.country || '').toUpperCase();
    if (['EN', 'GB', 'ES', 'IT', 'DE', 'FR'].includes(c)) {
      rate += 0.01;
    } else if (['PT', 'NL', 'BE'].includes(c)) {
      if (rate > 0.06) rate -= 0.01;
    } else if (!['BR', 'AR', 'MX'].includes(c)) {
      if (rate > 0.06) rate -= 0.02;
    }

    if (ct >= 4) rate += 0.01;
    if (ct >= 2 && age <= 23) rate += 0.015;
    if (inTrain) rate += 0.015 + (ct - 1) * 0.0015;
    if (unhappy) rate *= 0.4;

    return roundTo(Math.max(0.01, rate), 4);
  }

  function calcGrowthProjection(p, opts = {}) {
    const pl = (p && typeof p === 'object') ? p : {};
    const curForce = safeInt(pl.force, 20);
    const curGf = safeNum(pl.growthFrac, 0);
    const curEff = roundTo(
      pl.effForce !== undefined && pl.effForce !== null
        ? safeNum(pl.effForce, curForce + curGf)
        : (curForce + curGf),
      2
    );
    const rawCap = pl.potCap !== undefined && pl.potCap !== null
      ? pl.potCap
      : (pl.estPotCap !== undefined && pl.estPotCap !== null ? pl.estPotCap : curForce);
    const cap = Math.max(curForce, safeInt(rawCap, curForce));
    const weeklyRate = estimateWeeklyGrowthRate(pl, opts);
    const rateIfTrained = estimateWeeklyGrowthRate(pl, { ...(opts || {}), inTrain: true });

    const gapToNext = Math.max(0.01, (curForce + 1) - curEff);
    const weeksToNext = curForce >= cap ? 0 : Math.max(1, Math.ceil(gapToNext / weeklyRate));
    const remToCap = Math.max(0, cap - curEff);
    const weeksToCap = remToCap <= 0 ? 0 : Math.max(1, Math.ceil(remToCap / weeklyRate));
    const etaMonthsToCap = remToCap <= 0 ? 0 : roundTo(weeksToCap / 4.33, 1);

    const projectedCurve = [0, 3, 6, 12].map((m, idx) => ({
      label: idx === 0 ? 'Kini' : `+${m} Bln`,
      months: m,
      eff: roundTo(Math.min(cap, curEff + weeklyRate * (m * 4.33)), 2),
    }));

    return {
      weeklyRate,
      rateIfTrained,
      weeksToNext,
      weeksToCap,
      etaMonthsToCap,
      projectedCurve,
    };
  }

  function estimateDivisionFromLeague(leagueId, worldComps = null) {
    if (!leagueId) return 1;
    const lid = String(leagueId);
    if (worldComps && typeof worldComps === 'object' && worldComps[lid]) {
      const comp = worldComps[lid];
      if (comp && typeof comp === 'object') {
        const div = safeInt(comp.division !== undefined ? comp.division : comp.tier, 0);
        if (div >= 1 && div <= 4) return div;
      }
    }
    const low = lid.toLowerCase();
    for (const d of [1, 2, 3, 4]) {
      if (
        low.endsWith(`:${d}`) ||
        low.endsWith(`_${d}`) ||
        low.endsWith(`-${d}`) ||
        low.includes(`div${d}`) ||
        low.includes(`serie_${['a', 'b', 'c', 'd'][d - 1]}`)
      ) {
        return d;
      }
    }
    return 1;
  }

  function normalizeTicketMul(rawMul) {
    const def = { geral: 1.0, arquibancada: 1.0, cadeiras: 1.0, camarotes: 1.0 };
    if (typeof rawMul === 'number') {
      const v = clamp(safeNum(rawMul, 1.0), 0.5, 2.0);
      return { geral: v, arquibancada: v, cadeiras: v, camarotes: v };
    }
    if (rawMul && typeof rawMul === 'object' && !Array.isArray(rawMul)) {
      return {
        geral: clamp(safeNum(rawMul.geral, 1.0), 0.5, 2.0),
        arquibancada: clamp(safeNum(rawMul.arquibancada, 1.0), 0.5, 2.0),
        cadeiras: clamp(safeNum(rawMul.cadeiras, 1.0), 0.5, 2.0),
        camarotes: clamp(safeNum(rawMul.camarotes, 1.0), 0.5, 2.0),
      };
    }
    return def;
  }

  function formatMatchDay(rawVal, seasonStartDate = null, currentDate = null, matchYear = null) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '-';
    if (typeof rawVal === 'string') {
      const s = rawVal.trim();
      if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
      if (/^\d+$/.test(s)) rawVal = Number(s);
      else return s;
    }
    if (typeof rawVal === 'number') {
      const dayInt = Math.trunc(rawVal);
      if (matchYear !== null && matchYear !== undefined && matchYear !== '') {
        const yr = Number(matchYear);
        if (Number.isFinite(yr) && yr >= 1990 && yr <= 2200) {
          const ms = Date.UTC(Math.trunc(yr), 0, 1);
          const dt = new Date(ms + dayInt * 86400000);
          return dt.toISOString().slice(0, 10);
        }
      }
      if (seasonStartDate) {
        const ms = parseIsoDateUtc(seasonStartDate);
        if (ms !== null) {
          const dt = new Date(ms + dayInt * 86400000);
          return dt.toISOString().slice(0, 10);
        }
      }
      if (currentDate && String(currentDate).length >= 4) {
        const yr = Number(String(currentDate).slice(0, 4));
        if (Number.isFinite(yr)) {
          const ms = Date.UTC(yr, 0, 1);
          const dt = new Date(ms + dayInt * 86400000);
          return dt.toISOString().slice(0, 10);
        }
      }
      return `Hari ke-${dayInt}`;
    }
    return String(rawVal);
  }

  function translatePhaseName(phaseStr) {
    if (!phaseStr) return '-';
    const p = String(phaseStr).trim().toLowerCase();
    const mapping = {
      regular: 'Musim Reguler',
      preseason: 'Pra-Musim',
      pre_season: 'Pra-Musim',
      offseason: 'Akhir Musim',
      off_season: 'Akhir Musim',
      knockout: 'Fase Gugur',
      playoffs: 'Play-off',
      finals: 'Final',
      group: 'Fase Grup',
      groups: 'Fase Grup',
    };
    return mapping[p] || String(phaseStr);
  }

  function translateCompName(compStr, compId = '') {
    const raw = String(compStr || compId || '').trim();
    if (!raw) return 'Kompetisi';
    const low = raw.toLowerCase();

    if (low.startsWith('league:')) {
      const parts = raw.split(':');
      const iso = parts[1] ? parts[1].toUpperCase() : '';
      const div = parts[2] || '1';
      return `Liga ${iso} Divisi ${div}`;
    }
    if (low.startsWith('cup:')) {
      const parts = raw.split(':');
      const iso = parts[1] ? parts[1].toUpperCase() : '';
      return `Piala Domestik ${iso}`;
    }
    if (low.startsWith('supercup:')) {
      const parts = raw.split(':');
      const iso = parts[1] ? parts[1].toUpperCase() : '';
      return `Piala Super ${iso}`;
    }
    if (low.startsWith('cont:')) {
      return raw.split(':').slice(1).join(' ').toUpperCase() || 'Piala Kontinental';
    }

    let out = raw;
    const ptIdMap = [
      ['Super League da Indonésia', 'Super League Indonesia'],
      ['Liga dos Campeões da AFC Elite', 'AFC Champions League Elite'],
      ['Liga dos Campeões da AFC 2', 'AFC Champions League Two'],
      ['Liga dos Campeões da UEFA', 'UEFA Champions League'],
      ['Liga Europa da UEFA', 'UEFA Europa League'],
      ['Liga Conferência', 'UEFA Conference League'],
      ['Liga das Nações', 'UEFA Nations League'],
      ['Eliminatórias da Eurocopa', 'Kualifikasi Euro'],
      ['Eliminatórias da Copa', 'Kualifikasi Piala Dunia'],
      ['Copa do Mundo', 'Piala Dunia'],
      ['Eurocopa', 'Piala Eropa (Euro)'],
      ['Campeonato', 'Liga'],
      ['Copa Nacional', 'Piala Nasional'],
      ['Copa (', 'Piala ('],
      ['Copa ', 'Piala '],
      ['Supercopa', 'Piala Super'],
      ['Taça', 'Piala'],
      ['Divisão', 'Divisi'],
      ['Série A', 'Serie A'],
      ['Série B', 'Serie B'],
      ['Série C', 'Serie C'],
      ['Série D', 'Serie D'],
      ['Amistoso', 'Laga Persahabatan'],
      [' da Indonésia', ' Indonesia'],
      ['Indonésia', 'Indonesia'],
    ];
    for (const [pt, idn] of ptIdMap) {
      if (out.includes(pt)) out = out.split(pt).join(idn);
    }
    return out;
  }

  function translateRoundName(rStr) {
    if (!rStr) return '';
    let s = String(rStr).trim();
    s = s.replace(/\(ida\)/gi, '(Leg 1)').replace(/\(volta\)/gi, '(Leg 2)');
    const low = s.toLowerCase();
    const exactMap = {
      'oitavas': '16 Besar (R16)',
      'oitavas de final': '16 Besar (R16)',
      'oitavas de final (leg 1)': '16 Besar (Leg 1)',
      'oitavas de final (leg 2)': '16 Besar (Leg 2)',
      'round of 16': '16 Besar (R16)',
      'r16': '16 Besar (R16)',
      'quartas': 'Perempat Final (QF)',
      'quartas de final': 'Perempat Final (QF)',
      'quartas de final (leg 1)': 'Perempat Final (Leg 1)',
      'quartas de final (leg 2)': 'Perempat Final (Leg 2)',
      'quarter-finals': 'Perempat Final (QF)',
      'quarterfinals': 'Perempat Final (QF)',
      'qf': 'Perempat Final (QF)',
      'semi': 'Semifinal (SF)',
      'semifinal': 'Semifinal (SF)',
      'semifinal (leg 1)': 'Semifinal (Leg 1)',
      'semifinal (leg 2)': 'Semifinal (Leg 2)',
      'semi-final': 'Semifinal (SF)',
      'semifinais': 'Semifinal (SF)',
      'sf': 'Semifinal (SF)',
      'final': 'Final',
      'finais': 'Final',
      'fase de grupos': 'Fase Grup',
      'group stage': 'Fase Grup',
      '3º lugar': 'Perebutan Juara 3',
      'terceiro lugar': 'Perebutan Juara 3',
    };
    if (exactMap[low]) return exactMap[low];
    const ordMatch = /^(\d+)[ªº]?\s*(?:rodada|round|jornada|ronde)(.*)$/i.exec(s);
    if (ordMatch) return `Pekan ${ordMatch[1]}${ordMatch[2] || ''}`.trim();
    if (low.startsWith('rodada ')) return 'Pekan ' + s.slice(7);
    if (low.startsWith('round ')) return 'Pekan ' + s.slice(6);
    if (low.startsWith('jornada ')) return 'Pekan ' + s.slice(8);
    if (low.startsWith('ronde ')) return 'Pekan ' + s.slice(6);
    return s;
  }

  /**
   * Parser referensi teruji untuk playerDynamic (user = object, AI = array[6..7]).
   */
  function parseDynamicRow(row) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return [row.id || row.playerId || null, { ...row }];
    }
    if (Array.isArray(row) && row.length >= 6) {
      const extra = (row.length > 6 && row[6] && typeof row[6] === 'object' && !Array.isArray(row[6]))
        ? row[6]
        : {};
      const d = {
        ...extra,
        id: row[0],
        age: row[1],
        force: row[2],
        contractYears: row[3],
        salary: row[4],
        marketValue: row[5],
      };
      return [row[0], d];
    }
    return [null, null];
  }

  /**
   * Parser referensi teruji untuk extraRows (regen/transfer: object atau array[14..16]).
   */
  function parseExtraRow(row) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const d = { ...row, _source: 'regen' };
      return [d.id || d.playerId || null, d];
    }
    if (Array.isArray(row) && row.length >= 14) {
      const extra = (row.length > 15 && row[15] && typeof row[15] === 'object' && !Array.isArray(row[15]))
        ? row[15]
        : {};
      const d = {
        id: row[0],
        name: row[1],
        position: row[2],
        age: row[3],
        nationality: row[4],
        foot: row[5],
        force: row[6],
        potential: row[7],
        skill1: row[8],
        skill2: row[9],
        star: row[10],
        salary: row[11],
        marketValue: row[12],
        contractYears: row[13],
        photo: row.length > 14 ? row[14] : '',
        _source: 'regen',
        ...extra,
      };
      return [d.id || null, d];
    }
    return [null, null];
  }

  /**
   * Adapter universal Static DB: mendukung baik objek JSON asli ligafoot_static_db.json
   * MAUPUN format array kompak static_db.min.json.gz:
   *   Player: ["Name", "Pos", "S1", "S2", "Nat", "Foot", age, force, starInt, hashInt]
   */
  function getStaticPlayer(staticPlayers, pid) {
    if (!staticPlayers || !pid) return {};
    const entry = staticPlayers[pid];
    if (!entry) return {};
    if (Array.isArray(entry)) {
      return {
        id: pid,
        name: entry[0] || pid,
        pos: entry[1] || '',
        s1: entry[2] || '',
        s2: entry[3] || '',
        nationality: entry[4] || '',
        foot: entry[5] || 'D',
        age: entry[6],
        force: entry[7],
        star: Boolean(entry[8]),
        hash: entry[9] || 0,
      };
    }
    return entry;
  }

  /**
   * Normalisasi record klub dari static_db (v1 & v2):
   * Mendukung format compact array `[name, shortName, country, level, rep]` maupun object penuh.
   */
  function getStaticClub(clubsMeta, cid) {
    if (!clubsMeta || !cid) return {};
    const rec = clubsMeta[cid];
    if (!rec) return {};
    if (Array.isArray(rec)) {
      return {
        id: cid,
        name: rec[0] || cid,
        short: rec[1] || '',
        shortName: rec[1] || '',
        country: rec[2] || '',
        level: safeInt(rec[3], 0),
        rep: safeInt(rec[4], 0),
      };
    }
    return rec;
  }

  LF.utils = {
    safeNum,
    safeInt,
    clamp,
    roundTo,
    fmtMoney,
    posCategory,
    posEn,
    skillEn,
    getDeclineAge,
    getSellWarnAge,
    reputationLevel,
    payrollRef,
    estimatePayrollRef,
    countryGroup,
    sameCountry,
    hasAffinity,
    teamLevelOf,
    getForeignLimit,
    terminationFeeRate,
  renewalSalaryDelta,
  salaryCutFloorMul,
    injuryTier,
    injurySaleFactor,
    retirementChance,
    loanBuyDecisionChance,
    fixedSponsorParcel,
    parseStatementRow,
    daysBetweenDates,
    daysBetweenIso,
    estimateWeeklyGrowthRate,
    calcGrowthProjection,
    estimateDivisionFromLeague,
    normalizeTicketMul,
    formatMatchDay,
    translatePhaseName,
    translateCompName,
    translateRoundName,
    parseDynamicRow,
    parseExtraRow,
    getStaticPlayer,
    getStaticClub,
  };
})(typeof window !== 'undefined' ? window : globalThis);
