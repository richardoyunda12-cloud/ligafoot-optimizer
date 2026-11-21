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

  // Bytecode #21518 teamLevelOf
  function teamLevelOf(team, division = 1, staticLevel = null) {
    const lv = safeInt(team && team.level, safeInt(staticLevel, 0));
    if (lv > 0) {
      const divBonus = (safeInt(division, 1) === 1) ? 1 : 0;
      return clamp(lv + divBonus, 1, 22);
    }
    const rep = safeNum(team && team.reputation, 50);
    return clamp(Math.round(rep / 5), 1, 20);
  }

  // Bytecode #21490 getForeignLimit
  function getForeignLimit(country) {
    const c = String(country || '').toUpperCase();
    const lims = C.FOREIGN_LIMITS || {};
    return lims[c] || lims.DEFAULT || { max: 9, field: 7 };
  }

  // Bytecode #21000 terminationFeeRate
  function terminationFeeRate(daysLeft) {
    const d = Math.max(0, safeInt(daysLeft, 0));
    for (const t of (C.TERMINATION_FEE_TIERS || [])) {
      if (d <= t.maxDays) return t.rate;
    }
    return 0.70;
  }

  // Bytecode #20892/#20893 injuryTier & injurySaleFactor
  function injuryTier(days) {
    const d = safeInt(days, 0);
    if (d <= 0) return 'none';
    const cfg = C.INJURED_SALE || { minorMaxDays: 14, moderateMaxDays: 45 };
    if (d <= cfg.minorMaxDays) return 'minor';
    if (d <= cfg.moderateMaxDays) return 'moderate';
    return 'severe';
  }

  function injurySaleFactor(days) {
    const tier = injuryTier(days);
    const cfg = C.INJURED_SALE || { minorFactor: 0.90, moderateFactor: 0.72, severeFactor: 0.50 };
    if (tier === 'none') return 1.0;
    if (tier === 'minor') return cfg.minorFactor;
    if (tier === 'moderate') return cfg.moderateFactor;
    return cfg.severeFactor;
  }

  // Bytecode #20901 retirementChance
  function retirementChance(age, pos, force) {
    const a = safeInt(age, 25);
    const f = safeInt(force, 50);
    const startAge = (pos === 'G') ? 37 : 35;
    if (a < startAge) return 0;
    const yearsOver = a - startAge;
    let chance = 0.15 + yearsOver * 0.18;
    if (f < 25) chance += 0.20;
    else if (f < 40) chance += 0.10;
    return Math.min(0.95, roundTo(chance, 2));
  }

  // Bytecode #20496 loanBuyDecisionChance (probabilitas AI menebus pemain pinjaman di akhir musim)
  function loanBuyDecisionChance(p) {
    if (!p || !p.loanedFrom || safeNum(p.loanBuyFee, 0) <= 0) return 0;
    const cfg = C.LOAN_OPTION || { baseChance: 0.35, playedBonus: 0.25, goalsBonus: 0.20, ratingBonus: 0.15, highFeePenalty: 0.25 };
    let chance = cfg.baseChance;
    const mins = safeNum(p.seasonMinutes, 0);
    if (mins >= 900) chance += cfg.playedBonus;
    else if (mins >= 450) chance += cfg.playedBonus * 0.5;
    const goals = safeInt(p.seasonGoals, 0);
    if (goals >= 8) chance += cfg.goalsBonus;
    else if (goals >= 4) chance += cfg.goalsBonus * 0.5;
    const ratings = Array.isArray(p.matchRatings) ? p.matchRatings : [];
    if (ratings.length > 0) {
      const avgR = ratings.reduce((s, x) => s + safeNum(x, 6.0), 0) / ratings.length;
      if (avgR >= 7.0) chance += cfg.ratingBonus;
    }
    const mv = Math.max(1, safeNum(p.marketValue, 1));
    if (safeNum(p.loanBuyFee, 0) > mv * 1.3) chance -= cfg.highFeePenalty;
    return clamp(roundTo(chance, 2), 0.05, 0.90);
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
    'salaries', 'purchases', 'stadium', 'ct', 'termination', 'loans', 'loanInterest', 'youthCoach',
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
    youthCoach: 'Pelatih Akademi',
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
      const isCapEx = (cat === 'purchases' || cat === 'termination' || cat === 'sales')
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
      const isCapEx = (cat === 'purchases' || cat === 'termination' || cat === 'sales')
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

  function formatMatchDay(rawVal, seasonStartDate = null, currentDate = null) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '-';
    if (typeof rawVal === 'string') {
      const s = rawVal.trim();
      if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
      if (/^\d+$/.test(s)) rawVal = Number(s);
      else return s;
    }
    if (typeof rawVal === 'number') {
      const dayInt = Math.trunc(rawVal);
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
      ['Campeonato', 'Liga'],
      ['Copa Nacional', 'Piala Nasional'],
      ['Copa ', 'Piala '],
      ['Supercopa', 'Piala Super'],
      ['Taça', 'Piala'],
      ['Divisão', 'Divisi'],
      ['Série A', 'Serie A'],
      ['Série B', 'Serie B'],
      ['Série C', 'Serie C'],
      ['Série D', 'Serie D'],
      ['Amistoso', 'Laga Persahabatan'],
    ];
    for (const [pt, idn] of ptIdMap) {
      if (out.includes(pt)) out = out.split(pt).join(idn);
    }
    return out;
  }

  function translateRoundName(rStr) {
    if (!rStr) return '';
    const s = String(rStr).trim();
    const low = s.toLowerCase();
    const exactMap = {
      'oitavas': '16 Besar (R16)',
      'oitavas de final': '16 Besar (R16)',
      'round of 16': '16 Besar (R16)',
      'r16': '16 Besar (R16)',
      'quartas': 'Perempat Final (QF)',
      'quartas de final': 'Perempat Final (QF)',
      'quarter-finals': 'Perempat Final (QF)',
      'quarterfinals': 'Perempat Final (QF)',
      'qf': 'Perempat Final (QF)',
      'semi': 'Semifinal (SF)',
      'semifinal': 'Semifinal (SF)',
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
    if (low.startsWith('rodada ')) return 'Pekan ' + s.slice(7);
    if (low.startsWith('round ')) return 'Pekan ' + s.slice(6);
    if (low.startsWith('jornada ')) return 'Pekan ' + s.slice(8);
    if (low.startsWith('ronde ')) return 'Pekan ' + s.slice(6);
    return s;
  }

  /**
   * Normalisasi record pemain dari static_db:
   * Mendukung format compact array `[name, pos, foot, nat, s1, s2]` maupun object penuh.
   */
  function getStaticPlayer(staticPlayers, pid) {
    if (!staticPlayers || !pid) return {};
    const rec = staticPlayers[pid];
    if (!rec) return {};
    if (Array.isArray(rec)) {
      return {
        name: rec[0] || '',
        pos: rec[1] || 'MC',
        foot: rec[2] || 'D',
        nationality: rec[3] || '',
        s1: rec[4] || '',
        s2: rec[5] || '',
      };
    }
    return rec;
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
        name: rec[0] || '',
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
    injuryTier,
    injurySaleFactor,
    retirementChance,
    loanBuyDecisionChance,
    fixedSponsorParcel,
    parseStatementRow,
    daysBetweenDates,
    estimateDivisionFromLeague,
    normalizeTicketMul,
    formatMatchDay,
    translatePhaseName,
    translateCompName,
    translateRoundName,
    getStaticPlayer,
    getStaticClub,
  };
})(typeof window !== 'undefined' ? window : globalThis);
