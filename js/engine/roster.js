/**
 * LigaFoot Optimizer Web Engine — roster.js
 * Port eksak 1:1 dari optimizer/analyzer_roster.py (v7.0 / v8.0):
 * - Merge data dinamis save dengan metadata statis (kompak array / objek JSON).
 * - Membaca fineSlump, fineSlumpDays, noAutoRenew, & deteksi Loophole 0%.
 * - Klasifikasi aksi otomatis untuk setiap pemain senior user.
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const T = LF.tactics;

  function buildPlayerRecord(rawP, staticPlayers, isUser = false, teamId = '', teamName = '', teamCountry = '', div = 1) {
    const rp = (rawP && typeof rawP === 'object') ? rawP : {};
    const pid = String(rp.id || '');
    const st = U.getStaticPlayer(staticPlayers, pid);

    const name = rp.name || st.name || pid;
    let pos = String(rp.position || rp.pos || st.pos || 'MC').toUpperCase();
    if (!(pos in C.EXACT_CAT)) pos = 'MC';

    const age = U.safeInt((rp.age !== undefined && rp.age !== null) ? rp.age : st.age, 24);
    const force = U.safeInt(rp.force, U.safeInt(st.force, 30));
    const effForce = U.safeInt(rp.effectiveForce, force);
    const potential = U.safeInt(rp.potential, Math.max(force, U.safeInt(rp.potCap, force)));
    const potCap = U.safeInt(rp.potCap, potential);

    const s1 = String(rp.skill1 || rp.s1 || st.s1 || '').toUpperCase();
    const s2 = String(rp.skill2 || rp.s2 || st.s2 || '').toUpperCase();
    const foot = String(rp.foot || st.foot || 'D').toUpperCase();
    const nat = String(rp.nationality || st.nationality || teamCountry || '').toUpperCase();
    const star = Boolean(('star' in rp) ? rp.star : (st.star || false));
    const top = Boolean(rp.top || false);

    const salary = U.safeNum(rp.salary, 0);
    const mv = U.safeNum(rp.marketValue, 0);
    const cYears = U.safeInt(rp.contractYears, 1);
    const cDays = (rp.contractDays !== undefined && rp.contractDays !== null)
      ? U.safeInt(rp.contractDays, cYears * 365)
      : (cYears * 365);

    const growthFrac = U.safeNum(rp.growthFrac, 0.0);
    const energy = U.safeNum(rp.energy, 100.0);
    const injured = Boolean(rp.injured);
    const injDays = U.safeInt(rp.injuryDays, U.safeInt(rp.injuryWeeks, 0) * 7);
    const suspended = Boolean(rp.suspended);
    const avgRating = U.safeNum(rp.avgRating, 0.0);
    const gamesPlayed = U.safeInt(rp.gamesPlayed, 0);
    const seasonMins = U.safeNum(rp.seasonMinutes, 0.0);
    const goals = U.safeInt(rp.goals, 0);
    const assists = U.safeInt(rp.assists, 0);
    const cardsByComp = (rp.cardsByComp && typeof rp.cardsByComp === 'object' && !Array.isArray(rp.cardsByComp))
      ? rp.cardsByComp
      : {};

    const fineSlump = U.clamp(U.safeNum(rp.fineSlump, 0.0), 0.0, C.FINE_SLUMP_CAP);
    const fineSlumpDays = U.safeInt(rp.fineSlumpDays, 0);
    const noAutoRenew = Boolean(rp.noAutoRenew);

    const stEval = T.evalSkillStacking(pos, s1, s2);
    const declineAge = C.DECLINE_START_AGE[pos] || 32;
    const sellWarnAge = declineAge - 1;
    const isDeclining = (age >= declineAge) || (growthFrac <= -0.15);
    const nearDrop = (growthFrac <= -0.75);

    const isTrap = (potential - potCap) >= 4;
    const isGem = (potCap - potential) >= 4 || (age <= 22 && (potCap - force) >= 8);

    const ageBidMul = age < 20 ? 1.50 : (age <= 24 ? 1.35 : 1.30);
    const estInitBid = U.pyRound(mv * ageBidMul);
    const estCounter40 = U.pyRound(estInitBid * C.COUNTER_SAFE_MUL);
    const estRealSale = U.pyRound(estInitBid * C.COUNTER_AVG_REALIZED);

    return {
      id: pid,
      name,
      pos,
      cat: (pos in C.EXACT_CAT) ? C.EXACT_CAT[pos] : 3,
      age,
      foot,
      nationality: nat,
      force,
      effForce,
      potential,
      potCap,
      s1,
      s2,
      stackPct: stEval.pct,
      stackGrade: stEval.grade,
      nonStack: stEval.nonStack,
      stackNote: stEval.note,
      star,
      top,
      salary: Math.round(salary),
      marketValue: Math.round(mv),
      salPerForce: Math.round(salary / Math.max(1, force)),
      contractYears: cYears,
      contractDays: cDays,
      growthFrac: U.roundTo(growthFrac, 3),
      declineAge,
      sellWarnAge,
      isDeclining,
      nearDrop,
      isTrap,
      isGem,
      energy: Math.round(energy),
      injured,
      injuryDays: injDays,
      suspended,
      avgRating: U.roundTo(avgRating, 2),
      gamesPlayed,
      seasonMinutes: Math.round(seasonMins),
      goals,
      assists,
      cardsByComp,
      fineSlump: U.roundTo(fineSlump, 3),
      fineSlumpPct: U.roundTo(fineSlump * 100.0, 1),
      fineSlumpDays,
      noAutoRenew,
      forSale: Boolean(rp.forSale),
      loanable: Boolean(rp.loanable),
      loanedFrom: rp.loanedFrom || null,
      freeSigned: Boolean(rp.freeSigned),
      squadRole: String(rp.squadRole || ''),
      roleSore: Boolean(rp.roleSore),
      moodFrom: rp.moodFrom || null,
      seasonInjuryDays: U.safeNum(rp.seasonInjuryDays, 0),
      development: U.safeNum(rp.development, 0),
      hash: U.safeInt(('hash' in rp) ? rp.hash : st.hash, 0),
      isYouth: Boolean(rp.isYouth),
      clubHistory: Array.isArray(rp.clubHistory) ? rp.clubHistory : [],
      honors: Array.isArray(rp.honors) ? rp.honors : [],
      teamId,
      teamName,
      teamCountry,
      estInitBid,
      estCounter40,
      estRealSale,
      estArabLow: Math.round(mv * 2.5),
      estArabHigh: Math.round(mv * 3.0),
    };
  }

  function extractTeamRoster(teamObj, staticPlayers, isUser = false, teamId = '', teamName = '', teamCountry = '', div = 1) {
    const tobj = (teamObj && typeof teamObj === 'object') ? teamObj : {};
    const roster = [];
    const seen = new Set();

    for (const row of (tobj.playerDynamic || [])) {
      const [pid, d] = U.parseDynamicRow(row);
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        roster.push(buildPlayerRecord(d, staticPlayers, isUser, teamId, teamName, teamCountry, div));
      }
    }

    for (const row of (tobj.extraRows || [])) {
      const [pid, d] = U.parseExtraRow(row);
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        roster.push(buildPlayerRecord(d, staticPlayers, isUser, teamId, teamName, teamCountry, div));
      }
    }

    const youth = [];
    if (isUser) {
      for (const yp of (tobj.youthPlayers || [])) {
        if (yp && typeof yp === 'object') {
          youth.push(buildPlayerRecord({ ...yp, isYouth: true }, staticPlayers, true, teamId, teamName, teamCountry, div));
        }
      }
    }

    return { roster, youth };
  }

  function classifyUserAction(p, rankIdx, isTop5Arab, moodsMap) {
    const cd = p.contractDays;
    const moodInfo = (moodsMap && moodsMap[p.id]) || {};
    const isUnh = moodInfo.mood === 'unhappy';

    if (p.injured && p.forSale) {
      return { action: 'TARIK DR BURSA! (Cedera)', cls: 'crit' };
    }
    if (cd <= 10) {
      if ((p.force >= 40 || p.isGem || rankIdx < 14) && !p.loanedFrom) {
        return { action: '💎 TRIK AUTO-RENEW 0% (+180d)', cls: 'crit' };
      }
      return { action: 'LEPAS GRATIS', cls: 'muted' };
    }
    if (cd >= C.RENEW_GOLDEN_MIN && cd <= C.RENEW_GOLDEN_MAX) {
      if (p.isDeclining || (rankIdx >= 17 && p.age >= 25 && !p.isGem)) {
        return { action: 'LEPAS GRATIS (Hemat Gaji)', cls: 'warn' };
      }
      return { action: 'RENEW 3TH (-12% GAJI!)', cls: 'good' };
    }
    if ((p.fineSlump || 0) > 0) {
      return { action: `SLUMP -${Math.round(p.fineSlumpPct)}% (${p.fineSlumpDays}d)`, cls: 'crit' };
    }
    if (p.isDeclining || p.age >= p.sellWarnAge) {
      if (p.injured) return { action: 'TUNGGU SEMBUH -> JUAL', cls: 'warn' };
      if (isTop5Arab) return { action: 'ARAB WATCH / JUAL +40%', cls: 'accent' };
      return { action: `JUAL +40% (Regresi ${p.declineAge}th)`, cls: 'warn' };
    }
    if (isTop5Arab) {
      return { action: 'INTI + ARAB WATCH (2.5-3x)', cls: 'accent' };
    }
    if (isUnh || p.roleSore) {
      return { action: 'BERI MENIT / SET RESERVE', cls: 'warn' };
    }
    if (rankIdx >= 15 && p.age >= 24 && !p.isGem) {
      if (p.injured) return { action: 'TUNGGU SEMBUH -> JUAL', cls: 'muted' };
      return { action: 'JUAL +40% (Hemat Gaji)', cls: 'muted' };
    }
    if (p.isGem || (p.age <= 21 && (p.potCap - p.force) >= 4)) {
      return { action: 'LATIH / ASET FLIP', cls: 'good' };
    }
    if (rankIdx < 11) {
      return { action: 'INTI', cls: 'info' };
    }
    return { action: 'PELAPIS / ROTASI', cls: 'muted' };
  }

  LF.roster = {
    buildPlayerRecord,
    extractTeamRoster,
    classifyUserAction,
  };
})(typeof window !== 'undefined' ? window : globalThis);
