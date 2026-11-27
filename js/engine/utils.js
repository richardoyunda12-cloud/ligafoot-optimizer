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

  function getDeclineAge(posCode, realScale = false) {
    if (realScale) {
      const s100 = C.DECLINE_START_AGE_SCALE100 || { G: 35, default: 33 };
      return String(posCode || '').toUpperCase() === 'G' ? s100.G : s100.default;
    }
    const p = String(posCode || '').toUpperCase();
    if (C.DECLINE_START_AGE && C.DECLINE_START_AGE[p] !== undefined) return C.DECLINE_START_AGE[p];
    const cat = posCategory(posCode);
    return C.DECLINE_AGE_BY_CAT[cat] !== undefined ? C.DECLINE_AGE_BY_CAT[cat] : 33;
  }

  function getSellWarnAge(posCode, realScale = false) {
    if (realScale) return getDeclineAge(posCode, true) - 1;
    const cat = posCategory(posCode);
    return C.SELL_WARN_AGE_BY_CAT[cat] !== undefined ? C.SELL_WARN_AGE_BY_CAT[cat] : 31;
  }

  // OTA 2.1.0 (#3611 & #24952 releaseClauseOf): Brasil 1.5x, Eropa 3.0x, Lainnya 2.0x
  const EXTRA_EU_CODES = new Set(['WL', 'NIR', 'IE', 'HU', 'BG', 'SK', 'SI', 'FI', 'IS', 'CY', 'IL', 'BA', 'ME', 'MK', 'AL', 'EE', 'LV', 'LT', 'BY', 'MD', 'GE', 'AM', 'AZ', 'LU', 'MT', 'FO', 'LI', 'AD', 'SM', 'GI', 'XK']);
  const COUNTRY_GROUP_MAP = new Map();
  if (C.COUNTRY_GROUPS && typeof C.COUNTRY_GROUPS === 'object') {
    for (const [gId, list] of Object.entries(C.COUNTRY_GROUPS)) {
      const gNum = Number(gId);
      if (!Array.isArray(list)) continue;
      for (let i = 0; i < list.length; i++) COUNTRY_GROUP_MAP.set(list[i], gNum);
    }
  }
  const EU_COUNTRY_SET = new Set([
    ...((C.COUNTRY_GROUPS && Array.isArray(C.COUNTRY_GROUPS[0])) ? C.COUNTRY_GROUPS[0] : []),
    ...EXTRA_EU_CODES,
  ]);

  function releaseClauseMul(countryCode) {
    const c = String(countryCode || '').trim().toUpperCase();
    const rc = C.RELEASE_CLAUSE || { europe: 3.0, brazil: 1.5, other: 2.0 };
    if (c === 'BR' || c === 'BRA' || c === 'BRASIL') return { mult: rc.brazil, region: 'BR', label: 'Brasil 1.5x' };
    if (EU_COUNTRY_SET.has(c)) return { mult: rc.europe, region: 'EU', label: 'Eropa 3.0x' };
    return { mult: rc.other, region: 'OTHER', label: 'Standar 2.0x' };
  }

  function releaseClauseOf(marketValue, countryCode, paidInPrice = 0) {
    const mv = Math.max(0, Math.round(safeNum(marketValue, 0)));
    const info = releaseClauseMul(countryCode);
    const byMv = Math.round(mv * info.mult);
    const floorPaid = Math.max(0, Math.round(safeNum(paidInPrice, 0)));
    return {
      ...info,
      amount: Math.max(byMv, floorPaid),
      hasPaidFloor: floorPaid > byMv,
    };
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

  // Bytecode #21513/#21904 countryGroup (6 grup resmi 0..5, default -1 jika tidak ditemukan)
  function countryGroup(code) {
    const c = String(code || '').trim().toUpperCase();
    const g = COUNTRY_GROUP_MAP.get(c);
    return g !== undefined ? g : -1;
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

  // Bytecode #21517 / #24936 hasAffinity (satu negara, satu COUNTRY_GROUP >= 0, atau AFFINITY_CLUSTERS)
  function hasAffinity(a, b) {
    const ca = String(a || '').toUpperCase();
    const cb = String(b || '').toUpperCase();
    if (!ca || !cb) return false;
    if (sameCountry(ca, cb)) return true;
    const ga = countryGroup(ca);
    const gb = countryGroup(cb);
    if (ga >= 0 && ga === gb) return true;
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

  // Bytecode #23498 / #20971 & #20972 injuryTier & injurySaleFactor (OTA 2.1.0)
  // <=10d: minor (0.70), <=28d: moderate (0.55), <=70d: major (0.40), >70d: severe (0.25)
  function injuryTier(days) {
    const d = safeInt(days, 0);
    if (d <= 0) return 'none';
    const cfg = C.INJURED_SALE || { minorMaxDays: 10, moderateMaxDays: 28, majorMaxDays: 70 };
    if (d <= (cfg.minorMaxDays || 10)) return 'minor';
    if (d <= (cfg.moderateMaxDays || 28)) return 'moderate';
    if (d <= (cfg.majorMaxDays || 70)) return 'major';
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

  // Bytecode #21089 loanBuyDecisionChance(buyFee, marketValue, stats, buyerBudget)
  function loanBuyDecisionChance(p, buyerBudget = null) {
    if (!p || !p.loanedFrom) return 0;
    const buyFee = safeNum(p.loanBuyPrice ?? p.loanBuyFee, 0);
    if (buyFee <= 0) return 0;
    if (buyerBudget !== null && buyerBudget !== undefined && Number.isFinite(Number(buyerBudget)) && Number(buyerBudget) < buyFee) {
      return 0;
    }
    const mv = Math.max(1, safeNum(p.marketValue, 1));
    const r = buyFee / mv;
    let chance = r <= 0.9 ? 0.75 : (r <= 1.1 ? 0.55 : (r <= 1.3 ? 0.35 : 0.20));
    const games = safeInt(p.seasonGames ?? p.gamesPlayed, 0);
    const rating = safeNum(p.avgRating ?? p.rating, 0);
    if (games < 5) chance *= 0.4;
    else if (rating >= 7) chance *= 1.3;
    else if (rating > 0 && rating < 6) chance *= 0.5;
    const forceTo = safeNum(p.forceTo ?? p.force, 0);
    const forceFrom = safeNum(p.forceFrom ?? p.loanForceFrom ?? p.force, 0);
    if (forceTo > forceFrom) chance *= 1.15;
    const maxCap = (C.LOAN_OPTION && C.LOAN_OPTION.maxChance) || 0.95;
    return clamp(roundTo(chance, 2), 0, maxCap);
  }

  // Bytecode #24721 windowsOf + #24722 windowOpenOn (realTransferWindows per negara)
  function isWindowOpenOn(country, dateStr) {
    const mmdd = String(dateStr || '').slice(5, 10);
    if (mmdd.length < 5) return true;
    const code = String(country || 'BR').toUpperCase();
    const wins = (C.TRANSFER_WINDOWS && C.TRANSFER_WINDOWS[code])
      || C.TRANSFER_WINDOW_DEFAULT
      || [['01-01', '02-02'], ['06-15', '09-01']];
    return wins.some(([start, end]) => mmdd >= start && mmdd <= end);
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
      : (pl.mood === 'unhappy' || Boolean(pl.roleSore) || Boolean(pl.raiseSore));

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

    if (pl.top) rate += 0.03;
    else if (pl.star) rate += 0.01;

    const c = String(o.country || '').toUpperCase();
    const cg = countryGroup(c);
    if (cg === 0) {
      if (['EN', 'GB', 'ES', 'IT', 'DE', 'FR'].includes(c)) rate += 0.01;
      else if (['PT', 'NL', 'BE'].includes(c)) {
        if (rate > 0.06) rate -= 0.01;
      } else if (rate > 0.06) rate -= 0.02;
    } else if (cg === 1 || cg === 2 || cg === 3) {
      if (rate > 0.06) rate -= 0.02;
    } else if (cg === 4) {
      if (c !== 'MX' && rate > 0.06) rate -= 0.03;
    } else if (cg === 5) {
      if (rate > 0.06) rate -= 0.04;
    } else if (c && !['MX'].includes(c)) {
      if (rate > 0.06) rate -= 0.02;
    }

    if (ct >= 4) rate += 0.01;
    if (ct >= 2 && age <= 23) rate += 0.015;
    if (inTrain) rate += 0.015 + (ct - 1) * 0.0015;
    if (unhappy) rate *= (C.UNHAPPY_GROWTH || 0.5);

    return roundTo(Math.max(0.01, rate), 4);
  }

  function interpTable(tbl, x, fallback = 1.0) {
    if (!Array.isArray(tbl) || !tbl.length) return fallback;
    if (x <= tbl[0][0]) return tbl[0][1];
    for (let i = 1; i < tbl.length; i++) {
      const [x0, y0] = tbl[i - 1];
      const [x1, y1] = tbl[i];
      if (x <= x1) {
        const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t;
      }
    }
    return tbl[tbl.length - 1][1];
  }

  // Bytecode #21911 computeMarketValue (formula kuadratik 4 * force^2 * K_adj * lowLevelMul)
  function computeMarketValue(p, clubCtx = {}) {
    const pl = (p && typeof p === 'object') ? p : {};
    const ctx = (clubCtx && typeof clubCtx === 'object') ? clubCtx : {};
    const f = Math.max(1, Math.round(safeNum(pl.force, 20)));
    const pot = Math.max(f, safeNum(pl.potCap !== undefined ? pl.potCap : pl.potential, f));
    const age = Math.max(16, safeInt(pl.age, 22));
    const lv = clamp(safeInt(ctx.level !== undefined ? ctx.level : pl.clubLevel, 15), 1, 25);
    const cgClub = countryGroup(ctx.country || pl.clubCountry || '');
    const cgNat = countryGroup(pl.nationality || '');
    const isStar = Boolean(pl.star || pl.starAwarded);

    const kRows = C.VALUE_K_BY_LEVEL || [[21, 750], [20, 600], [18, 500], [12, 400], [0, 366]];
    const foundK = kRows.find(row => lv >= row[0]);
    let k = foundK ? foundK[1] : kRows[kRows.length - 1][1];

    const craque = C.VALUE_CRAQUE_MUL || { europeElite: 3, europeBig: 2, default: 1.7 };
    if (isStar) {
      if (cgNat === 0 && lv >= 22) k = k * (craque.europeElite || 3);
      else if (cgNat === 0 && lv >= 21) k = k * (craque.europeBig || 2);
      else k = Math.round(k * (craque.default || 1.7));
    } else if (pl.top) {
      k = Math.round(k * (C.VALUE_WORLDTOP_MUL || 1.6));
    }

    const pos = String(pl.pos || pl.position || '').toUpperCase();
    if (['ATA', 'PD', 'PE', 'SA', 'ST', 'SS', 'RW', 'LW'].includes(pos)) {
      k = Math.round(k * (C.VALUE_ATTACKER_MUL || 1.3));
    }
    if (!pl.isYouth && (pl.highlight === true || pl.status === 1)) {
      k = Math.round(k * (C.VALUE_HIGHLIGHT_MUL || 1.2));
    }

    const ageTerms = C.VALUE_AGE_TERMS || [[19, 32, 27], [25, 32, 22], [31, 32, 15], [33, 34, 10]];
    const foundAge = ageTerms.find(r => age <= r[0]);
    const ageAdj = foundAge ? (foundAge[1] - age) * foundAge[2] : -(age - 34) * (C.VALUE_AGE_OLD_CUT || 50);
    k = Math.max(C.VALUE_K_MIN || 60, k + ageAdj);

    const lowMul = interpTable(C.VALUE_LOW_LEVEL_MUL || [[0, 0.08], [12, 1]], lv, 1.0);
    const base = 4 * f * f * k * lowMul;

    const oldRows = C.VALUE_OLD_MUL || [];
    const foundOld = oldRows.find(r => age >= r[0]);
    let ageMul = 1.0;
    if (foundOld) {
      ageMul = foundOld[1];
    } else {
      const yb = C.VALUE_YOUNG_BONUS || { perPoint: 0.018, max: 0.4, weights: [[19, 1], [21, 0.8], [23, 0.55], [25, 0.3]] };
      const wRow = (yb.weights || []).find(r => age <= r[0]);
      if (wRow) {
        const bonus = Math.min(yb.max || 0.4, Math.max(0, pot - f) * (yb.perPoint || 0.018) * wRow[1]);
        ageMul = 1 + bonus;
      }
    }
    const euroBonus = (ctx.europeTop5 && lv >= (C.EURO_TOP_MIN_LEVEL || 21) && !pl.isYouth && (isStar || pl.top))
      ? (C.EURO_TOP_BONUS || 1.4)
      : 1.0;
    const clubCountryFactor = (cgClub >= 0 && cgClub !== 0 && lv >= 12) ? 1.0 : 1.0;
    return Math.max(50000, Math.round(base * ageMul * euroBonus * clubCountryFactor));
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
    releaseClauseMul,
    releaseClauseOf,
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
    isWindowOpenOn,
    fixedSponsorParcel,
    parseStatementRow,
    daysBetweenDates,
    daysBetweenIso,
    estimateWeeklyGrowthRate,
    calcGrowthProjection,
    computeMarketValue,
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
