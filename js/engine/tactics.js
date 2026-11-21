/**
 * LigaFoot Optimizer Web Engine — tactics.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * - Skill Stacking Matrix (#35011, #21893)
 * - RULE_SLOTS 15 Formasi (#3575, #3576), Wildcard slots 10 & 17, & Bug 3-4-3 (#34992)
 * - Fixed Sector Denominators DEF/5, MID/5, ATK/3 (#21891)
 * - isPlayerStar (#20906/#21882) & Continuous energyFactor (#21876/#35011)
 * - Team Chemistry (#21995–#22002): integration ent[0] & rhythm bitmask rx
 * - Squad Moods (#21546, #3544): starter 40%, minGames 6, injDiv 4
 * - Transfer Policy & Refusal Matrix (#23839–#23850, #23919, #24474)
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;

  // Bytecode #19854 reputationLevel: <20->0, <35->1, <50->2, <68->3, <82->4, >=82->5
  function repToLevel(rep) {
    return U.reputationLevel(rep);
  }

  /**
   * Bytecode #35011 & #21893: Evaluasi bonus skill di Match Engine v1.2.0.
   * - DES/MAR (+2%) hanya dihitung di DEF (cat===1), TIDAK di MID.
   * - GK SAI: +3% di s1, +1% di s2.
   */
  function evalSkillStacking(posCode, s1, s2) {
    const cat = U.posCategory(posCode);
    const sk1 = (s1 || '').trim().toUpperCase();
    const sk2 = (s2 || '').trim().toUpperCase();

    function singleBonus(sk, slotIdx) {
      if (!sk) return 0.0;
      const w = slotIdx === 1 ? 1.0 : 0.55;
      if (cat === 0) { // GK
        if (sk === 'REF') return slotIdx === 1 ? 4.0 : 2.2;
        if (sk === 'SAI') return slotIdx === 1 ? 3.0 : 1.0; // #35011: s1=+3%, s2=+1%
        if (sk === 'PEN') return slotIdx === 1 ? 2.5 : 1.5;
        if (sk === 'LID' || sk === 'PAS' || sk === 'RES') return 1.0 * w;
        return 0.0;
      }
      if (cat === 1) { // DEF (Z, LD, LE)
        if (posCode === 'Z') {
          if (sk === 'DES' || sk === 'MAR' || sk === 'CAB' || sk === 'FOR') return 3.2 * w;
          if (sk === 'VEL' || sk === 'PAS' || sk === 'LID' || sk === 'RES') return 2.0 * w;
        } else { // Fullbacks LD/LE
          if (sk === 'VEL' || sk === 'CRU' || sk === 'DES' || sk === 'MAR') return 3.2 * w;
          if (sk === 'PAS' || sk === 'RES' || sk === 'DRI' || sk === 'FOR') return 2.0 * w;
        }
        return 0.5 * w;
      }
      if (cat === 2) { // MID (V, MC, MD, ME) — #35011: DES/MAR tidak memberi +2% sector power di MID
        if (posCode === 'V') {
          if (sk === 'PAS' || sk === 'FOR' || sk === 'RES') return 3.2 * w;
          if (sk === 'CAB' || sk === 'VEL' || sk === 'LID') return 2.0 * w;
          if (sk === 'DES' || sk === 'MAR') return 1.0 * w;
        } else if (posCode === 'MD' || posCode === 'ME') {
          if (sk === 'VEL' || sk === 'CRU' || sk === 'PAS' || sk === 'DRI') return 3.2 * w;
          if (sk === 'RES' || sk === 'FIN') return 2.0 * w;
        } else { // MC
          if (sk === 'PAS' || sk === 'RES') return 3.2 * w;
          if (sk === 'DRI' || sk === 'VEL' || sk === 'FIN' || sk === 'FOR' || sk === 'LID') return 2.2 * w;
        }
        return 0.6 * w;
      }
      if (cat === 3) { // AM (MO)
        if (sk === 'PAS' || sk === 'DRI' || sk === 'FIN') return 3.4 * w;
        if (sk === 'VEL' || sk === 'CRU' || sk === 'RES') return 2.2 * w;
        return 0.6 * w;
      }
      if (cat === 4) { // ATK (PD, PE, SA, A)
        if (posCode === 'PD' || posCode === 'PE') {
          if (sk === 'VEL' || sk === 'DRI' || sk === 'CRU' || sk === 'FIN') return 3.5 * w;
          if (sk === 'PAS' || sk === 'RES') return 2.0 * w;
        } else { // SA, A
          if (sk === 'FIN' || sk === 'VEL' || sk === 'CAB' || sk === 'DRI' || sk === 'FOR') return 3.5 * w;
          if (sk === 'PAS' || sk === 'PEN') return 2.0 * w;
        }
        return 0.5 * w;
      }
      return 0.0;
    }

    const b1 = singleBonus(sk1, 1);
    const b2 = singleBonus(sk2, 2);
    const nonStack = Boolean(sk1 && sk2 && sk1 === sk2);
    const totalPct = nonStack ? b1 : (b1 + b2);

    let grade = 'C';
    if (nonStack) grade = 'DUP!';
    else if (totalPct >= 5.0) grade = 'GOD';
    else if (totalPct >= 3.8) grade = 'A';
    else if (totalPct >= 2.2) grade = 'B';

    return {
      stackPct: U.roundTo(totalPct, 2),
      nonStack,
      grade,
    };
  }

  // Bytecode #21995–#22002: Team Chemistry (integration ent[0] & rhythm bitmask rx)
  function integrationOf(p) {
    if (p && Array.isArray(p.ent) && p.ent.length >= 1) {
      return U.clamp(U.safeNum(p.ent[0], 100), 0, 100);
    }
    if (p && typeof p.integration === 'number') {
      return U.clamp(p.integration, 0, 100);
    }
    return 100;
  }

  function rhythmOf(p) {
    const rawRx = (p && p.rx !== undefined && p.rx !== null) ? U.safeInt(p.rx, 7) : 7;
    const m = rawRx & 7;
    return ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1)) / 3.0;
  }

  function teamChemistry(xiPlayers) {
    const list = Array.isArray(xiPlayers) ? xiPlayers : [];
    if (!list.length) return 100;
    let sumInt = 0;
    let sumRhy = 0;
    for (const item of list) {
      const p = (item && item.player) ? item.player : item;
      sumInt += integrationOf(p);
      sumRhy += rhythmOf(p);
    }
    const avgInt = sumInt / list.length;
    const avgRhy = sumRhy / list.length;
    return Math.max(0, Math.round(avgInt - 10.0 * (1.0 - avgRhy)));
  }

  function chemistryMul(chem) {
    return 1.0 - 0.06 * (1.0 - U.clamp(U.safeNum(chem, 100), 0, 100) / 100.0);
  }

  function arriveAtClubInit(ctLevel = 1, sameNationality = false) {
    const ctFrac = (U.clamp(U.safeInt(ctLevel, 1), 1, 10) - 1) / 9.0;
    return Math.round(Math.min(95, 50 + 25 * ctFrac + (sameNationality ? 10 : 0)));
  }

  /**
   * Bytecode #21546 & #3544: Simulasi `squadMoods` v1.2.0:
   * - Peringkat natural hanya dari pemain yang TIDAK cedera/skorsing, tie-break String(id)
   * - Kuota menit: Starter / roleSore = 40% (0.40), Mid #12-#18 = 25% (0.25), U-19 = 8% (0.08)
   * - role === 'starter' atau roleSore menimpa pemain U-19 menjadi 40%!
   * - injGames = Math.floor(seasonInjuryDays / 4), syarat minimum: teamGames >= 6 && effGames >= 6
   */
  function computeSquadMoodsV9(roster, isAiTeam = false, explicitTeamGames = null) {
    if (!roster || !roster.length) {
      return { moods: {}, unhappyCount: 0, lockerHit: 0.0, teamGames: 0 };
    }

    const availSorted = roster
      .filter(p => !p.injured && !p.suspended)
      .sort((a, b) => (b.force - a.force) || String(a.id).localeCompare(String(b.id)));
    const availRankMap = new Map();
    availSorted.forEach((p, idx) => availRankMap.set(p.id, idx));

    const allSorted = [...roster].sort((a, b) => (b.force - a.force) || String(a.id).localeCompare(String(b.id)));
    const allRankMap = new Map();
    allSorted.forEach((p, idx) => allRankMap.set(p.id, idx));

    const maxMins = Math.max(...roster.map(p => U.safeNum(p.seasonMinutes, 0)), 0);
    const teamGames = explicitTeamGames !== null && explicitTeamGames !== undefined
      ? Math.max(0, U.safeInt(explicitTeamGames, 0))
      : (maxMins > 0 ? Math.max(1, Math.ceil(maxMins / 90.0)) : 0);

    const moods = {};
    let unhappyCount = 0;

    for (const p of roster) {
      const pid = p.id;
      const availIdx = availRankMap.has(pid) ? availRankMap.get(pid) : allRankMap.get(pid);
      const naturalStarter = availRankMap.has(pid) && availIdx < 11;
      const naturalMid = availRankMap.has(pid) && availIdx >= 11 && availIdx < 18;

      let tier = 0;
      if (naturalStarter) tier = 3;
      else if (naturalMid) tier = 2;
      else if (p.age <= 19) tier = 1;

      const role = String(p.squadRole || 'auto').toLowerCase();
      const minsNow = Math.round(U.safeNum(p.seasonMinutes, 0));
      const injDays = U.safeInt(p.seasonInjuryDays, 0);
      const injGames = Math.floor(injDays / 4); // #3544 injuryDaysPerGame = 4
      const effGames = Math.max(0, teamGames - injGames);
      const minRatio = effGames > 0 ? (minsNow / (effGames * 90.0)) : 1.0;

      const roleSore = Boolean(!isAiTeam && role === 'reserve' && naturalStarter);
      let reqRatio = 0.0;
      let immune = false;
      let reason = 'Aman';

      if (p.injured || p.suspended) {
        immune = true;
        reason = p.injured ? 'Cedera (kebal sementara)' : 'Skorsing';
      } else if (role === 'reserve' && !roleSore) {
        immune = true;
        reqRatio = 0.0;
        reason = 'Role Reserve (Kebal Unhappy)';
      } else if (roleSore || role === 'starter') {
        reqRatio = 0.40; // #21546: 40%, menimpa U-19!
        if (roleSore) reason = 'Natural Top-11 diset Reserve (tetap wajib 40%!)';
      } else if (role === 'youth') {
        reqRatio = p.age <= 19 ? 0.08 : 0.0;
        if (reqRatio === 0.0) immune = true;
      } else {
        if (tier === 3) reqRatio = 0.40;
        else if (tier === 2) reqRatio = 0.25;
        else if (tier === 1) reqRatio = 0.08;
        else {
          reqRatio = 0.0;
          immune = true;
        }
      }

      const minsReq = Math.ceil(reqRatio * effGames * 90);
      const minsDeficit = Math.max(0, minsReq - minsNow);
      const gamesDeficit = Math.ceil(minsDeficit / 90.0);

      let mood = 'ok';
      if (!immune && teamGames >= 6 && effGames >= 6 && reqRatio > 0 && minRatio < reqRatio) {
        mood = 'unhappy';
        unhappyCount++;
        reason = `Menit kurang (${Math.round(minRatio * 100)}% < ${Math.round(reqRatio * 100)}%, kurang ${minsDeficit} mnt / ~${gamesDeficit} laga)`;
      } else if (!immune && teamGames >= 6 && effGames >= 6 && reqRatio > 0 && minRatio < reqRatio + 0.05) {
        mood = 'warn';
        reason = `Ambang batas menit (${Math.round(minRatio * 100)}% / target ${Math.round(reqRatio * 100)}%)`;
      }

      moods[pid] = {
        mood,
        tier,
        minPct: U.roundTo(minRatio * 100.0, 1),
        reqPct: U.roundTo(reqRatio * 100.0, 1),
        immune,
        roleSore,
        effGames,
        minsNow,
        minsReq,
        minsDeficit,
        gamesDeficit,
        reason,
      };
    }

    let lockerHit = 0.0;
    if (unhappyCount >= C.LOCKER_UNHAPPY_MIN) {
      lockerHit = Math.min(C.LOCKER_HIT_CAP, unhappyCount * C.LOCKER_HIT_PER_PLAYER);
    }

    return {
      moods,
      unhappyCount,
      lockerHit: U.roundTo(lockerHit, 4),
      teamGames,
    };
  }

  // Bytecode #3575: slotCompatFactor dengan dukungan RULE_SLOT_INFO & Wildcard slots 10/17
  function slotCompatFactor(playerPos, targetSlot, ruleId = null) {
    if (targetSlot === 'G' || playerPos === 'G') {
      return playerPos === targetSlot ? 1.00 : 0.25;
    }
    if (ruleId !== null && ruleId !== undefined && C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleId]) {
      const ri = C.RULE_SLOT_INFO[ruleId];
      if (ri.wildcard) {
        return 1.00; // #3575: Slot 10 & 17 wildcard menerima semua non-GK tanpa penalti outOfPosition
      }
      if (Array.isArray(ri.exact) && ri.exact.includes(playerPos)) {
        return 1.00;
      }
    }
    const row = C.POS_COMPAT_MATRIX[playerPos] || {};
    return row[targetSlot] !== undefined ? row[targetSlot] : 0.78;
  }

  function isPlayerStar(p) {
    return Boolean(p && (p.star || p.top || p.starAwarded));
  }

  /**
   * Bytecode #21876, #21882, #35011, #3575: Evaluasi kontribusi efektif pemain pada slot formasi.
   */
  function evalPlayerForSlot(p, targetSlot, includeEnergy = true, repLevel = 3, ruleId = null) {
    const compat = slotCompatFactor(p.pos, targetSlot, ruleId);

    // #21882: wrongFoot (-5%) dicek pada slot dengan category===1 & side 'D' atau 'E'
    // Mencakup LD (rule 1), LE (rule 5), serta Wildcard Wingback MD (rule 10, side D) & ME (rule 17, side E)!
    let wrongFoot = false;
    const foot = (p.foot || 'D').toUpperCase();
    let checkSide = null;
    if (ruleId !== null && ruleId !== undefined && C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleId]) {
      const ri = C.RULE_SLOT_INFO[ruleId];
      if (ri.cat === 1 && ri.side) checkSide = ri.side;
    } else if (targetSlot === 'LD') {
      checkSide = 'D';
    } else if (targetSlot === 'LE') {
      checkSide = 'E';
    }
    if (checkSide === 'D' && foot !== 'D' && foot !== 'A') wrongFoot = true;
    else if (checkSide === 'E' && foot !== 'E' && foot !== 'A') wrongFoot = true;
    const footMul = wrongFoot ? 0.95 : 1.00;

    let stackBonus = 0.0;
    if (compat >= 0.95) {
      stackBonus = p.stackPct || 0.0;
    } else if (compat >= 0.90) {
      stackBonus = (p.stackPct || 0.0) * 0.6;
    }

    // #21882 & #20906: isPlayerStar(p) (star || top || starAwarded) -> repLvl > 3 ? 1.05 : 1.02
    const starMul = isPlayerStar(p) ? (repLevel > 3 ? 1.05 : 1.02) : 1.00;

    const slumpVal = U.safeNum(p.fineSlump, 0.0);
    const slumpMul = slumpVal > 0 ? Math.max(0.75, 1.0 - (slumpVal <= 1.0 ? slumpVal : slumpVal / 100.0)) : 1.00;

    // #21876 & #35011: Continuous energyFactor = max(0.92, 1 - 0.001 * deficit), RES memotong deficit 40%
    let energyMul = 1.00;
    if (includeEnergy) {
      const en = U.clamp(U.safeNum(p.energy, 100), 0, 100);
      const hasRes = (p.s1 === 'RES' || p.s2 === 'RES');
      const deficit = (100.0 - en) * (hasRes ? 0.6 : 1.0);
      energyMul = Math.max(0.92, 1.0 - 0.001 * deficit);
    }

    const baseF = U.safeNum(p.effForce !== undefined ? p.effForce : p.force, 10.0);
    const score = baseF * compat * footMul * (1.0 + stackBonus / 100.0) * starMul * slumpMul * energyMul;

    return {
      score,
      wrongFoot,
      compat,
    };
  }

  /**
   * Audit Set-Piece & Kapten (#17450 vs Manual Terbaik).
   * Mengembalikan objek terstruktur `{ id, name, pos, force, s1, s2, score, reason }` untuk UI v8.3
   * sekaligus string ringkasan agar kompatibel penuh.
   */
  function auditSetPieces(xiPlayers) {
    if (!xiPlayers || !xiPlayers.length) {
      return { captain: [], freeKick: [], corner: [], penalty: [], warnings: [], autoSame: {} };
    }

    const capRanked = [...xiPlayers].sort((a, b) => {
      const lidA = (a.s1 === 'LID' || a.s2 === 'LID') ? 1 : 0;
      const lidB = (b.s1 === 'LID' || b.s2 === 'LID') ? 1 : 0;
      return (lidB - lidA) || (b.force - a.force) || (b.age - a.age);
    });

    const fkRanked = [...xiPlayers].sort((a, b) => {
      const score = p => p.force + (p.s1 === 'PAS' ? 6 : (p.s2 === 'PAS' ? 4 : 0)) + ((p.s1 === 'FIN' || p.s2 === 'FIN') ? 3 : 0);
      return score(b) - score(a);
    });

    const ckRanked = [...xiPlayers].sort((a, b) => {
      const score = p => p.force + (p.s1 === 'CRU' ? 7 : (p.s2 === 'CRU' ? 4.5 : 0)) + ((p.s1 === 'PAS' || p.s2 === 'PAS') ? 3 : 0);
      return score(b) - score(a);
    });

    const pkRanked = [...xiPlayers].sort((a, b) => {
      const score = p => p.force
        + (p.s1 === 'PEN' ? 10 : (p.s2 === 'PEN' ? 7 : 0))
        + (p.s1 === 'FIN' ? 6 : (p.s2 === 'FIN' ? 4.5 : 0));
      return score(b) - score(a);
    });

    const autoPk = [...xiPlayers].sort((a, b) => {
      const score = p => p.force + ((p.s1 === 'PEN' || p.s2 === 'PEN') ? 9 : 0) + (p.s1 === 'FIN' ? 5 : 0);
      return score(b) - score(a);
    });

    const autoFk = [...xiPlayers].sort((a, b) => {
      const score = p => p.force + (p.s1 === 'PAS' ? 5 : 0);
      return score(b) - score(a);
    });

    const autoCk = [...xiPlayers].sort((a, b) => {
      const score = p => p.force + (p.s1 === 'CRU' ? 5 : 0);
      return score(b) - score(a);
    });

    const warnings = [];
    if (pkRanked[0].id !== autoPk[0].id) {
      warnings.push(
        `Penalti: Auto memilih ${autoPk[0].name} (${autoPk[0].force}), padahal ${pkRanked[0].name} (${pkRanked[0].force}, ${pkRanked[0].s1}/${pkRanked[0].s2}) lebih tajam (Auto buta FIN di slot 2!).`
      );
    }
    if (fkRanked[0].id !== autoFk[0].id) {
      warnings.push(
        `Freekick: Set manual ke ${fkRanked[0].name} (${fkRanked[0].s1}/${fkRanked[0].s2}) — Auto melewatkan kombinasi PAS+FIN.`
      );
    }
    if (ckRanked[0].id !== autoCk[0].id) {
      warnings.push(
        `Corner: Set manual ke ${ckRanked[0].name} (${ckRanked[0].s1}/${ckRanked[0].s2}) — Auto buta CRU di slot 2.`
      );
    }

    const fmtTaker = (p, roleType) => {
      const sk = [U.skillEn(p.s1), U.skillEn(p.s2)].filter(Boolean).join('/');
      let reason = `F:${p.force}`;
      if (roleType === 'cap' && (p.s1 === 'LID' || p.s2 === 'LID')) reason = 'LEA +1.5% Tim';
      else if (roleType === 'pk' && (p.s1 === 'PEN' || p.s2 === 'PEN')) reason = 'Spesialis PEN';
      else if (roleType === 'pk' && p.s2 === 'FIN') reason = 'FIN Slot 2 (Lewat di Auto)';
      else if (roleType === 'pk' && p.s1 === 'FIN') reason = 'FIN Slot 1';
      else if (roleType === 'fk' && (p.s1 === 'PAS' || p.s2 === 'PAS')) reason = 'Akurasi PAS+FIN';
      else if (roleType === 'ck' && (p.s1 === 'CRU' || p.s2 === 'CRU')) reason = 'Umpan Silang CRO';
      return {
        id: p.id,
        name: p.name,
        pos: U.posEn(p.pos),
        force: p.force,
        s1: U.skillEn(p.s1),
        s2: U.skillEn(p.s2),
        skills: sk,
        reason,
        label: `${p.name} (${U.posEn(p.pos)} ${p.force}${sk ? ' · ' + sk : ''})`,
      };
    };

    const capList = capRanked.slice(0, 2).map(p => fmtTaker(p, 'cap'));
    const fkList = fkRanked.slice(0, 2).map(p => fmtTaker(p, 'fk'));
    const ckList = ckRanked.slice(0, 2).map(p => fmtTaker(p, 'ck'));
    const pkList = pkRanked.slice(0, 2).map(p => fmtTaker(p, 'pk'));

    return {
      captain: capList[0] ? capList[0].label : '-',
      freeKick: fkList[0] ? fkList[0].label : '-',
      corner: ckList[0] ? ckList[0].label : '-',
      penalty: pkList[0] ? pkList[0].label : '-',
      takers: {
        captain: capList,
        freeKick: fkList,
        corner: ckList,
        penalty: pkList,
      },
      autoPick: {
        freeKick: fmtTaker(autoFk[0], 'fk'),
        corner: fmtTaker(autoCk[0], 'ck'),
        penalty: fmtTaker(autoPk[0], 'pk'),
      },
      autoSame: {
        fk: fkRanked[0].id === autoFk[0].id,
        ck: ckRanked[0].id === autoCk[0].id,
        pk: pkRanked[0].id === autoPk[0].id,
      },
      warnings,
    };
  }

  /**
   * Solver Best XI / Rotation XI untuk formasi tertentu dengan RULE_SLOTS bytecode (#3575/#3576),
   * kuota pemain asing lapangan, filter skorsing/cedera, dan perhitungan Team Chemistry (#21998).
   */
  function solveBestXi(
    roster, formationKey = '4-3-3', foreignCap = 7, userCountry = '',
    excludeIds = null, rotationMode = false, repLevel = 3
  ) {
    const fk = (formationKey in C.FORMATIONS) ? formationKey : '4-3-3';
    const slots = C.FORMATIONS[fk];
    const ruleSlots = (C.FORMATION_RULE_SLOTS && C.FORMATION_RULE_SLOTS[fk]) || [0, 1, 2, 3, 5, 6, 8, 12, 15, 16, 15];
    const exSet = excludeIds ? new Set(excludeIds) : new Set();

    let avail = (roster || []).filter(p => !p.injured && !p.suspended && !exSet.has(p.id));
    if (avail.length < 11) {
      avail = (roster || []).filter(p => !exSet.has(p.id));
    }

    const slotOrder = slots.map((s, idx) => [idx, s, ruleSlots[idx]]);
    function slotRarity([, s, rId]) {
      if (s === 'G' || rId === 0) return 0;
      if (s === 'LD' || s === 'LE' || rId === 1 || rId === 5) return 1;
      if (s === 'A' || s === 'Z' || rId === 16 || (rId >= 2 && rId <= 4)) return 2;
      if (rId === 10 || rId === 17) return 4; // Wildcard paling fleksibel, isi belakangan
      return 3;
    }
    slotOrder.sort((a, b) => slotRarity(a) - slotRarity(b));

    const usedIds = new Set();
    let foreignUsed = 0;
    const assigned = new Array(slots.length).fill(null);

    for (const [sIdx, sCode, ruleId] of slotOrder) {
      let bestP = null;
      let bestScore = -1e9;
      let bestWf = false;
      let bestCompat = 1.0;

      for (const p of avail) {
        if (usedIds.has(p.id)) continue;
        if (sCode === 'G' && p.pos !== 'G') continue;
        if (sCode !== 'G' && p.pos === 'G') continue;

        const isForeign = Boolean(userCountry && p.nationality && p.nationality !== userCountry);
        if (isForeign && foreignUsed >= foreignCap) continue;

        const ev = evalPlayerForSlot(p, sCode, true, repLevel, ruleId);
        let sc = ev.score;
        if (rotationMode) {
          sc += (U.safeNum(p.energy, 100) - 80) * 0.35;
          if (p.moodTier === 1 && U.safeNum(p.minPct, 100) < 12.0) {
            sc += 4.5;
          } else if (p.mood === 'unhappy' || p.mood === 'warn') {
            sc += 3.0;
          }
          if ((p.potCap - p.force) >= 6 && p.age <= 22) {
            sc += 2.0;
          }
        }

        if (sc > bestScore) {
          bestScore = sc;
          bestP = p;
          bestWf = ev.wrongFoot;
          bestCompat = ev.compat;
        }
      }

      if (bestP === null) {
        for (const p of avail) {
          if (!usedIds.has(p.id)) {
            bestP = p;
            const ev = evalPlayerForSlot(p, sCode, true, repLevel, ruleId);
            bestScore = ev.score;
            bestWf = ev.wrongFoot;
            bestCompat = ev.compat;
            break;
          }
        }
      }

      if (bestP !== null) {
        usedIds.add(bestP.id);
        if (userCountry && bestP.nationality && bestP.nationality !== userCountry) {
          foreignUsed++;
        }
        const ri = (C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleId]) || null;
        assigned[sIdx] = {
          slotIdx: sIdx,
          slot: sCode,
          ruleId,
          sectorCode: ri ? ri.sec : 'M',
          wildcard: Boolean(ri && ri.wildcard),
          droppedByBug: Boolean(ri && ri.sec === 'X'),
          player: bestP,
          score: U.roundTo(bestScore, 2),
          wrongFoot: bestWf,
          compat: bestCompat,
        };
      }
    }

    const xiClean = assigned.filter(Boolean);
    const gkScores = [];
    const defScores = [];
    const midScores = [];
    const atkScores = [];
    let hasDedicatedStriker = false;

    for (const item of xiClean) {
      const p = item.player;
      const sec = item.sectorCode;
      if (sec === 'G') gkScores.push(item.score);
      else if (sec === 'D') defScores.push(item.score);
      else if (sec === 'M') midScores.push(item.score);
      else if (sec === 'A') atkScores.push(item.score);
      // Catatan: sec === 'X' (slot ke-11 pada 3-4-3, rule 18) diabaikan oleh #34992 slotSector!
      if (p.pos === 'A' || p.pos === 'SA') {
        hasDedicatedStriker = true;
      }
    }

    const falseNinePen = hasDedicatedStriker ? 1.00 : 0.90;
    const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0.0);

    // Rata-rata per pemain di tiap lini
    const gkAvg = avg(gkScores);
    const defAvg = avg(defScores);
    const midAvg = avg(midScores);
    const atkAvg = avg(atkScores) * falseNinePen;

    // Power Sektor Engine #21891 (denominator tetap DEF/5, MID/5, ATK/3)
    const engineDef = defScores.reduce((a, b) => a + b, 0) / 5.0;
    const engineMid = midScores.reduce((a, b) => a + b, 0) / 5.0;
    const engineAtk = (atkScores.reduce((a, b) => a + b, 0) / 3.0) * falseNinePen;

    const totalScore = xiClean.reduce((acc, x) => acc + x.score, 0) * (hasDedicatedStriker ? 1.0 : 0.97);
    const avgScore = xiClean.length ? totalScore / xiClean.length : 0.0;

    const xiPlayers = xiClean.map(x => x.player);
    const hasLeader = xiPlayers.some(p => p.s1 === 'LID' || p.s2 === 'LID');
    const spAudit = auditSetPieces(xiPlayers);
    const bench = avail.filter(p => !usedIds.has(p.id)).sort((a, b) => b.force - a.force);

    const chem = teamChemistry(xiPlayers);
    const chemMul = chemistryMul(chem);
    const bugInfo = (C.FORMATION_BUGS && C.FORMATION_BUGS[fk]) || null;

    return {
      formation: fk,
      xi: xiClean,
      bench: bench.slice(0, 12),
      totalScore: U.roundTo(totalScore, 2),
      avgScore: U.roundTo(avgScore, 2),
      sectors: {
        GK: U.roundTo(gkAvg, 1),
        DEF: U.roundTo(defAvg, 1),
        MID: U.roundTo(midAvg, 1),
        ATK: U.roundTo(atkAvg, 1),
      },
      engineSectors: {
        GK: U.roundTo(gkAvg, 1),
        DEF: U.roundTo(engineDef, 1),
        MID: U.roundTo(engineMid, 1),
        ATK: U.roundTo(engineAtk, 1),
      },
      chemistry: chem,
      chemMul: U.roundTo(chemMul, 4),
      hasFormationBug: Boolean(bugInfo && bugInfo.hasBug),
      formationBugInfo: bugInfo,
      foreignCount: foreignUsed,
      hasLeader,
      falseNine: !hasDedicatedStriker,
      wrongFootCount: xiClean.filter(x => x.wrongFoot).length,
      setPieces: spAudit,
      setPieceWarnings: spAudit.warnings,
    };
  }

  /**
   * Bytecode #21891 & #34992: Menghitung Kekuatan Sektor Aktual di Match Engine (`DEF`, `MID`, `ATK`, `GK`).
   * Denominator sektor tetap: DEF = sum(D)/5, MID = sum(M)/5, ATK = sum(A)/3 (tanpa atkMod/defMod).
   * Pada 3-4-3, slot ke-11 (rule 18) jatuh ke sektor 'X' sehingga tidak terhitung di ATK.
   */
  function computeEngineSectorPower(xiObj, formationKey = null, opts = {}) {
    const fk = formationKey || (xiObj && xiObj.formation) || '4-3-3';
    const ruleSlots = (C.FORMATION_RULE_SLOTS && C.FORMATION_RULE_SLOTS[fk]) || [0, 1, 2, 3, 5, 6, 8, 12, 15, 16, 15];

    const isHome = opts.isHome !== undefined ? Boolean(opts.isHome) : true;
    const crowdOver70 = opts.crowdOver70 !== undefined ? Boolean(opts.crowdOver70) : true;
    const style = String(opts.style || 'Balanced').toLowerCase();
    const marking = String(opts.marking || 'Light').toLowerCase();
    const shout = String(opts.shout || 'none').toLowerCase();
    const lockerHitPct = U.safeNum(opts.lockerHitPct, 0.0);

    let sumG = 0, sumD = 0, sumM = 0, sumA = 0;
    let cntG = 0, cntD = 0, cntM = 0, cntA = 0;

    const xiList = (xiObj && Array.isArray(xiObj.xi)) ? xiObj.xi : [];
    if (xiList.length) {
      xiList.forEach((item, idx) => {
        const sc = U.safeNum(item.score !== undefined ? item.score : (item.player && item.player.force), 0);
        const rId = item.ruleId !== undefined ? item.ruleId : ruleSlots[idx];
        const ri = (C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[rId]) || null;
        const sec = item.sectorCode || (ri ? ri.sec : (idx === 0 ? 'G' : 'M'));
        if (sec === 'G') { sumG += sc; cntG++; }
        else if (sec === 'D') { sumD += sc; cntD++; }
        else if (sec === 'M') { sumM += sc; cntM++; }
        else if (sec === 'A') { sumA += sc; cntA++; }
      });
    } else {
      const sec = (xiObj && xiObj.sectors) || {};
      const shape = (C.FORMATION_SHAPE && C.FORMATION_SHAPE[fk]) || { D: 4, M: 3, A: 3 };
      sumG = U.safeNum(sec.GK, 15); cntG = 1;
      sumD = U.safeNum(sec.DEF, 15) * shape.D; cntD = shape.D;
      sumM = U.safeNum(sec.MID, 15) * shape.M; cntM = shape.M;
      sumA = U.safeNum(sec.ATK, 15) * shape.A; cntA = shape.A;
    }

    const falseNineMul = (xiObj && xiObj.falseNine) ? 0.90 : 1.00;
    const leaderMul = (xiObj && xiObj.hasLeader === false) ? 1.00 : 1.015;
    const lockerMul = Math.max(0.92, 1.0 - lockerHitPct / 100.0);
    const chem = (xiObj && xiObj.chemistry !== undefined) ? xiObj.chemistry : 100;
    const chemMul = chemistryMul(chem);
    const globalMul = leaderMul * lockerMul * chemMul;

    // #21891: Denominator tetap /5, /5, /3
    let rawGk = (cntG > 0 ? sumG / cntG : 15.0) * globalMul;
    let rawDef = (sumD / 5.0) * globalMul;
    let rawMid = (sumM / 5.0) * globalMul;
    let rawAtk = (sumA / 3.0) * falseNineMul * globalMul;

    if (isHome && crowdOver70) {
      rawMid *= 1.02;
    }

    let convBonusPct = 0.0;
    if (style.includes('off') || style.includes('serang')) {
      rawAtk *= 1.08;
      rawDef *= 0.92;
    } else if (style.includes('counter') || style.includes('balik')) {
      rawMid *= 0.94;
      convBonusPct = 9.0;
    }

    let cardRiskLabel = 'Rendah';
    let staminaDrainLabel = 'Normal';
    if (marking.includes('very') || marking.includes('sangat')) {
      rawDef *= 1.08;
      cardRiskLabel = 'Tinggi (+65% kartu, waspada penalti!)';
      staminaDrainLabel = 'Cepat (-35% stamina)';
    } else if (marking.includes('heavy') || marking.includes('ketat')) {
      rawDef *= 1.04;
      cardRiskLabel = 'Sedang (+25% kartu)';
      staminaDrainLabel = 'Agak Cepat (-18% stamina)';
    }

    if (shout.includes('praise') || shout.includes('elogiar')) {
      rawAtk *= 1.04;
      rawMid *= 1.04;
    } else if (shout.includes('focus') || shout.includes('concentrar')) {
      rawDef *= 1.06;
      rawMid *= 1.04;
    } else if (shout.includes('push') || shout.includes('avan')) {
      rawAtk *= 1.08;
      rawDef *= 0.96;
    }

    const totalPower = rawDef + rawMid + rawAtk + rawGk * 0.35;
    const bugInfo = (C.FORMATION_BUGS && C.FORMATION_BUGS[fk]) || null;

    return {
      formation: fk,
      shape: { D: cntD, M: cntM, A: cntA },
      GK: U.roundTo(rawGk, 1),
      DEF: U.roundTo(rawDef, 1),
      MID: U.roundTo(rawMid, 1),
      ATK: U.roundTo(rawAtk, 1),
      totalPower: U.roundTo(totalPower, 1),
      convBonusPct,
      cardRiskLabel,
      staminaDrainLabel,
      chemistry: chem,
      hasFormationBug: Boolean(bugInfo && bugInfo.hasBug),
      formationBugInfo: bugInfo,
    };
  }

  // Bytecode #23795 chooseAITactics (hanya Balanced/Offensive/Counter-Attack & Wings/Center)
  function predictAiTacticsDetail(oppForce, userForce, oppIsHome = false, oppXiPlayers = null) {
    const diff = (oppForce - userForce) + (oppIsHome ? 1.5 : -1.5);
    let aiStyle = 'Balanced';
    let styleReason = 'Kekuatan berimbang (selisih kekuatan di rentang -2.5 s.d. +3.5)';
    if (diff >= 3.5) {
      aiStyle = 'Offensive';
      styleReason = `Lawan unggul kekuatan (+${diff.toFixed(1)} termasuk faktor kandang) → AI otomatis menyerang (+8% ATK, -8% DEF)`;
    } else if (diff <= -2.5) {
      aiStyle = 'Counter-Attack';
      styleReason = `Lawan kalah kekuatan (${diff.toFixed(1)}) → AI parkir bus & mengincar serangan balik (-6% MID, +6..12% konversi)`;
    }

    let wingTags = 0;
    let centerTags = 0;
    const wingNames = [];
    const centerNames = [];

    for (const p of (oppXiPlayers || [])) {
      const pos = p.pos || '';
      const s1 = p.s1 || '';
      const s2 = p.s2 || '';
      if (['LD', 'LE', 'MD', 'ME', 'PD', 'PE'].includes(pos) && (s1 === 'CRU' || s2 === 'CRU' || s1 === 'VEL' || s2 === 'VEL')) {
        wingTags++;
        if (wingNames.length < 3) wingNames.push(`${p.name || U.posEn(pos)}(${U.skillEn(s1)})`);
      }
      if (['MC', 'MO', 'SA', 'A'].includes(pos) && (s1 === 'PAS' || s2 === 'PAS' || s1 === 'DRI' || s2 === 'DRI')) {
        centerTags++;
        if (centerNames.length < 3) centerNames.push(`${p.name || U.posEn(pos)}(${U.skillEn(s1)})`);
      }
    }

    let aiFocus = 'Center';
    let focusReason = `Poros tengah PAS/DRI (${centerTags}) >= sayap CRO/PAC (${wingTags})`;
    if (wingTags > centerTags) {
      aiFocus = 'Wings';
      focusReason = `Sayap lawan memiliki ${wingTags} pemain CRO/PAC (${wingNames.join(', ')}) > poros tengah (${centerTags})`;
    }

    let counterTip = 'Balanced';
    if (aiStyle === 'Offensive') {
      counterTip = 'Counter-Attack (+6..12% konversi peluang vs DEF lawan yang terbuka -8%)';
    } else if (aiStyle === 'Counter-Attack') {
      counterTip = 'Offensive (+8% ATK untuk membongkar parkir bus lawan) + Shout Praise';
    } else {
      counterTip = diff < -1.0 ? 'Balanced → Offensive jika buntu di menit 60' : 'Balanced + Marking Heavy';
    }

    return {
      aiStyle,
      aiFocus,
      diff: U.roundTo(diff, 1),
      wingTags,
      centerTags,
      styleReason,
      focusReason,
      counterTip,
    };
  }

  function predictAiTactics(oppForce, userForce, oppIsHome = false, oppXiPlayers = null) {
    const det = predictAiTacticsDetail(oppForce, userForce, oppIsHome, oppXiPlayers);
    return {
      aiStyle: det.aiStyle,
      aiFocus: det.aiFocus,
      counterTip: det.counterTip,
    };
  }

  /**
   * Rekomendasi Taktik & Matchup H2H Spesifik Lawan:
   * Hanya menggunakan opsi taktik valid di bytecode #3492:
   * - Play Style: Balanced | Offensive | Counter-Attack
   * - Attack Focus: Wings | Center (TIDAK ADA Mixed)
   * - Marking: Light (0%) | Heavy (+4% DEF) | Very Heavy (+8% DEF) (TIDAK ADA Normal)
   */
  function recommendMatchupForOpponent(
    userRoster, oppXi, isHome, isKnockout, isBig,
    foreignCap = 7, userCountry = '', activeFormation = '4-3-3',
    yellowIds = null, safeRotate = false, repLevel = 3
  ) {
    const oppAvg = U.safeNum(oppXi && oppXi.avgScore, 20.0);
    const oppXiPlayers = (oppXi && Array.isArray(oppXi.xi)) ? oppXi.xi.map(x => x.player || x) : [];
    const ySet = yellowIds ? new Set(yellowIds) : new Set();

    let excludeForRec = null;
    if (safeRotate && ySet.size) {
      const availNonYellow = (userRoster || []).filter(p => !p.injured && !p.suspended && !ySet.has(p.id));
      if (availNonYellow.length >= 14) {
        excludeForRec = ySet;
      }
    }

    const oppAi = predictAiTacticsDetail(oppAvg, oppAvg, !isHome, oppXiPlayers);
    const oppStyle = oppAi.aiStyle;
    const oppPow = computeEngineSectorPower(oppXi, (oppXi && oppXi.formation) || '4-4-2', {
      isHome: !isHome,
      crowdOver70: true,
      style: oppStyle,
      marking: 'Heavy',
    });

    const candidates = [];
    for (const fk of Object.keys(C.FORMATIONS)) {
      const res = solveBestXi(userRoster, fk, foreignCap, userCountry, excludeForRec, safeRotate, repLevel);
      const avgEdge = res.avgScore - oppAvg;
      let trialStyle = 'Balanced';
      if (avgEdge >= 2.0) trialStyle = 'Offensive';
      else if (avgEdge <= -1.5 || oppStyle === 'Offensive') trialStyle = 'Counter-Attack';

      const trialMark = (avgEdge >= 4.0 && !isKnockout && !isBig) ? 'Light' : 'Heavy';
      const uPow = computeEngineSectorPower(res, fk, {
        isHome,
        crowdOver70: true,
        style: trialStyle,
        marking: trialMark,
      });

      const atkVsDef = uPow.ATK - oppPow.DEF;
      const midVsMid = uPow.MID - oppPow.MID;
      const defVsAtk = uPow.DEF - oppPow.ATK;

      // Penalti kuat untuk formasi 3-4-3 yang terkena bug #34992 (-33% ATK)
      const bugPenalty = res.hasFormationBug ? -25.0 : 0.0;
      const h2hScore = res.avgScore * 1.4
        + atkVsDef * 0.45
        + midVsMid * 0.40
        + defVsAtk * 0.45
        - res.wrongFootCount * 0.8
        + (res.falseNine ? -3.0 : 0.0)
        + bugPenalty;

      const mods = (C.FORMATION_MODS && C.FORMATION_MODS[fk]) || { atkMod: 0, defMod: 0 };
      const enginePow = {
        ...uPow,
        atkMod: mods.atkMod,
        defMod: mods.defMod,
      };
      const xiSummary = res.xi.map(a => `${a.slot}:${a.player.name}`);

      candidates.push({
        formation: fk,
        h2hScore: U.roundTo(h2hScore, 2),
        avgScore: res.avgScore,
        totalScore: res.totalScore,
        sectors: res.sectors,
        uPow: enginePow,
        enginePow,
        atkMod: mods.atkMod,
        defMod: mods.defMod,
        atkVsDef: U.roundTo(atkVsDef, 1),
        midVsMid: U.roundTo(midVsMid, 1),
        defVsAtk: U.roundTo(defVsAtk, 1),
        dMid: U.roundTo(midVsMid, 1),
        dAtk: U.roundTo(atkVsDef, 1),
        dDef: U.roundTo(defVsAtk, 1),
        matchupScore: U.roundTo(h2hScore - oppAvg * 1.4, 1),
        wrongFootCount: res.wrongFootCount,
        falseNine: res.falseNine,
        hasLeader: res.hasLeader,
        foreignCount: res.foreignCount,
        chemistry: res.chemistry,
        hasFormationBug: res.hasFormationBug,
        formationBugInfo: res.formationBugInfo,
        setPieces: res.setPieces,
        xiSummary,
        xi: res.xi.map(a => ({
          slot: a.slot,
          ruleId: a.ruleId,
          sectorCode: a.sectorCode,
          wildcard: a.wildcard,
          score: U.roundTo(a.score, 1),
          wrongFoot: a.wrongFoot,
          id: a.player.id,
          name: a.player.name,
          pos: a.player.pos,
          force: a.player.force,
          age: a.player.age,
          energy: a.player.energy,
          s1: a.player.s1,
          s2: a.player.s2,
          stackPct: a.player.stackPct,
          star: a.player.star,
          top: a.player.top,
          starAwarded: a.player.starAwarded,
        })),
        bench: res.bench,
      });
    }

    candidates.sort((a, b) => b.h2hScore - a.h2hScore);
    const best = candidates[0];
    const activeComp = candidates.find(c => c.formation === activeFormation) || best;

    const finalAi = predictAiTacticsDetail(oppAvg, best.avgScore, !isHome, oppXiPlayers);
    const recEdge = U.roundTo(best.avgScore - oppAvg, 1);
    const activeEdge = U.roundTo(activeComp.avgScore - oppAvg, 1);

    let recStyle = 'Balanced';
    let recStyleWhy = '';
    if (finalAi.aiStyle === 'Offensive') {
      recStyle = 'Counter-Attack';
      recStyleWhy = `Lawan diprediksi main Offensive (+8% ATK, -8% DEF). Counter-Attack memberimu +6..12% bonus konversi peluang langsung ke pertahanan lawan yang terbuka!`;
    } else if (finalAi.aiStyle === 'Counter-Attack') {
      if (recEdge >= 1.8) {
        recStyle = 'Offensive';
        recStyleWhy = `Lawan parkir bus (Counter-Attack, -6% MID). Kamu unggul +${recEdge.toFixed(1)} Force → gunakan Offensive (+8% ATK) untuk membongkar blok rendah mereka.`;
      } else {
        recStyle = 'Balanced';
        recStyleWhy = `Lawan main Counter-Attack tapi selisih Force tipis (${recEdge >= 0 ? '+' : ''}${recEdge.toFixed(1)}). Mulai dengan Balanced agar DEF tidak bocor (-8%), baru ubah ke Offensive di menit 60 jika masih 0-0.`;
      }
    } else {
      if (recEdge >= 3.0 && isHome) {
        recStyle = 'Offensive';
        recStyleWhy = `Laga kandang & unggul kualitas +${recEdge.toFixed(1)} Force → tekan penuh dengan Offensive (+8% ATK).`;
      } else if (recEdge <= -2.0) {
        recStyle = 'Counter-Attack';
        recStyleWhy = `Underdog (${recEdge.toFixed(1)} Force) → amankan lini belakang dan curi gol lewat Counter-Attack (+6..12% konversi).`;
      } else {
        recStyle = 'Balanced';
        recStyleWhy = `Pertandingan berimbang (${recEdge >= 0 ? '+' : ''}${recEdge.toFixed(1)} Force) → Balanced menjaga keseimbangan 3 sektor tanpa penalti DEF/MID.`;
      }
    }

    // Attack Focus (#3492: HANYA 'Wings' atau 'Center', tidak ada 'Mixed')
    let uWings = 0;
    let uCenter = 0;
    for (const item of best.xi) {
      if (['LD', 'LE', 'MD', 'ME', 'PD', 'PE'].includes(item.pos) && ['CRU', 'VEL'].includes(item.s1)) uWings += 2;
      else if (['LD', 'LE', 'MD', 'ME', 'PD', 'PE'].includes(item.pos) && ['CRU', 'VEL'].includes(item.s2)) uWings += 1;
      if (['MC', 'MO', 'SA', 'A'].includes(item.pos) && ['PAS', 'DRI', 'FIN'].includes(item.s1)) uCenter += 2;
      else if (['MC', 'MO', 'SA', 'A'].includes(item.pos) && ['PAS', 'DRI', 'FIN'].includes(item.s2)) uCenter += 1;
    }

    let recFocus = 'Center';
    let recFocusWhy = '';
    if (uWings > uCenter) {
      recFocus = 'Wings';
      recFocusWhy = `Sayap XI kamu memiliki skor spesialis CRO/PAC tinggi (${uWings} vs tengah ${uCenter}) — eksploitasi lewat umpan silang & overlap sayap.`;
    } else {
      recFocus = 'Center';
      recFocusWhy = `Lini tengah & depan kamu dominan di skill PAS/DRI/FIN (skor tengah ${uCenter} >= sayap ${uWings}) — tembus lewat umpan terobosan poros tengah.`;
    }

    // Marking (#3492: HANYA Light (0%), Heavy (+4% DEF), Very Heavy (+8% DEF))
    let recMarking = 'Heavy (+4% DEF)';
    let recMarkingWhy = '';
    if (safeRotate && recEdge >= 4.0) {
      recMarking = 'Light (0%)';
      recMarkingWhy = `Unggul jauh (+${recEdge.toFixed(1)} Force) di laga rotasi → gunakan Light untuk menghemat stamina dan menghindari kartu kuning.`;
    } else if ((isKnockout || isBig) && recEdge <= -1.5) {
      recMarking = 'Very Heavy (+8% DEF)';
      recMarkingWhy = `Laga hidup-mati melawan tim lebih kuat (${recEdge.toFixed(1)} Force) → Very Heavy memberi +8% DEF ekstra (waspada kartu kuning: siapkan shout Calm Down!).`;
    } else if (ySet.size >= 2 && !isKnockout) {
      recMarking = 'Light (0%)';
      recMarkingWhy = `Ada ${ySet.size} pemain berisiko akumulasi kartu kuning → gunakan Light (0%) agar tidak kehilangan starter di laga berikutnya.`;
    } else {
      recMarking = 'Heavy (+4% DEF)';
      recMarkingWhy = `Sweet-spot v1.2.0: memberi +4% DEF gratis dengan risiko kartu & kuras stamina yang masih terkendali.`;
    }

    const shoutPlan = [
      {
        phase: 'Kickoff / Babak 1 (Menit 15–30)',
        shout: recEdge >= 0 ? 'Praise (Elogiar)' : 'Focus (Concentrar)',
        why: recEdge >= 0
          ? '+4% ATK & +4% MID selama 12 menit (tanpa penalti DEF) untuk mencuri gol pembuka (kuota 1: efek 100%).'
          : '+6% DEF & +4% MID selama 15 menit untuk meredam gempuran awal lawan (kuota 1: efek 100%).',
      },
      {
        phase: 'Babak 2 — Jika Unggul (Menit 65+)',
        shout: 'Focus (Concentrar)',
        why: 'Kunci kemenangan dengan +6% DEF & +4% MID (kuota 2: efek 70%) + tarik keluar pemain berenergi <65%.',
      },
      {
        phase: 'Babak 2 — Jika Imbang/Tertinggal (Menit 75+)',
        shout: 'Push Forward (Avançar)',
        why: '+8% ATK selama 10 menit terakhir (kombinasikan dengan Play Style Offensive & Supersub PAC/FIN).',
      },
    ];

    const keepActive = best.formation === activeFormation;
    const scoreGain = U.roundTo(Math.max(0, best.h2hScore - activeComp.h2hScore), 1);
    const reasons = [
      `Skor H2H terbaik (${best.avgScore} Avg · Chemistry ${best.chemistry}/100) vs ${oppXi.formation || '4-4-2'} lawan`,
      `Duel Sektor Engine (#21891): ATK vs DEF ${best.atkVsDef >= 0 ? '+' : ''}${best.atkVsDef} · MID ${best.midVsMid >= 0 ? '+' : ''}${best.midVsMid} · DEF vs ATK ${best.defVsAtk >= 0 ? '+' : ''}${best.defVsAtk}`,
      best.wrongFootCount === 0
        ? 'Bebas penalti salah kaki Fullback/Wingback (-5%)'
        : `Terdapat ${best.wrongFootCount} slot Fullback/Wingback salah kaki (-5%)`,
    ];

    const refereePlan = {
      strict: {
        marking: 'Light (0%)',
        badge: 'b-info',
        note: 'Wasit Ketat (+45% risiko kartu): pakai Light (0%) agar terhindar dari kartu merah & penalti.',
      },
      normal: {
        marking: recMarking,
        badge: recMarking.includes('Very') ? 'b-warn' : (recMarking.includes('Heavy') ? 'b-good' : 'b-info'),
        note: recMarkingWhy,
      },
      lenient: {
        marking: (isKnockout || isBig || recEdge <= 0) ? 'Very Heavy (+8% DEF)' : 'Heavy (+4% DEF)',
        badge: 'b-good',
        note: 'Wasit Longgar (-30% kartu): manfaatkan untuk menaikkan intensitas marking demi bonus +4% s.d. +8% DEF!',
      },
    };

    const weatherPlan = {
      clear: {
        label: '☀️ Cerah (Normal)',
        note: 'Kondisi ideal — jalankan fokus serangan & 3 pergantian normal di menit 60–70.',
      },
      rain: {
        label: '🌧️ Hujan (Lapangan Basah)',
        note: 'Bola licin & duel udara meningkat: prioritaskan fokus Wings (umpan silang) & eksekutor bola mati.',
      },
      heat: {
        label: '🔥 Panas (Kuras Stamina)',
        note: 'Stamina terkuras lebih cepat (energyFactor turun 0.1%/poin): masukkan 3 pergantian lebih awal di menit 55–62!',
      },
    };

    const halftimePlan = {
      win: "Unggul di HT: Pilih 'Focus (Concentrar)' (+6% DEF & +4% MID selama 15 menit).",
      draw: "Seri di HT: Pilih 'Praise (Elogiar)' (+4% ATK & +4% MID tanpa penalti DEF).",
      lose: "Tertinggal di HT: Pilih 'Push Forward (Avançar)' (+8% ATK) + masukkan Supersub PAC/FIN di menit 58.",
    };

    const top3List = candidates.slice(0, 3).map(c => ({
      formation: c.formation,
      h2hScore: c.h2hScore,
      matchupScore: c.matchupScore,
      avgScore: c.avgScore,
      uPow: c.uPow,
      atkMod: c.atkMod,
      defMod: c.defMod,
      atkVsDef: c.atkVsDef,
      midVsMid: c.midVsMid,
      defVsAtk: c.defVsAtk,
      dMid: c.dMid,
      dAtk: c.dAtk,
      dDef: c.dDef,
      wrongFootCount: c.wrongFootCount,
      hasFormationBug: c.hasFormationBug,
    }));

    return {
      recommended: best,
      activeComp,
      keepActive,
      scoreGain,
      reasons,
      top3: top3List,
      top3Formations: top3List,
      oppPow,
      aiInfo: finalAi,
      recEdge,
      activeEdge,
      playStyle: recStyle,
      playReason: recStyleWhy,
      playStyleWhy: recStyleWhy,
      attackFocus: recFocus,
      focusReason: recFocusWhy,
      attackFocusWhy: recFocusWhy,
      marking: recMarking,
      markingWhy: recMarkingWhy,
      refereePlan,
      weatherPlan,
      halftimePlan,
      setPieceNotes: (best.setPieces && best.setPieces.warnings) || [],
      shoutPlan,
    };
  }

  function detectSquadHoles(roster, activeFormation = '4-3-3') {
    const fk = (activeFormation in C.FORMATIONS) ? activeFormation : '4-3-3';
    const slots = C.FORMATIONS[fk];
    const avail = (roster || []).filter(p => !p.injured);
    if (!avail.length) return { holes: [], holePositions: [] };

    const avgForce = avail.reduce((acc, p) => acc + p.force, 0) / avail.length;
    const reqCounts = {};
    for (const s of slots) reqCounts[s] = (reqCounts[s] || 0) + 1;

    const holes = [];
    const holePositions = new Set();

    for (const [posCode, minStarter] of Object.entries(reqCounts)) {
      const idealDepth = minStarter * 2;
      const naturalPlayers = (roster || [])
        .filter(p => p.pos === posCode)
        .sort((a, b) => b.force - a.force);

      let footValid = naturalPlayers;
      if (posCode === 'LD') {
        footValid = naturalPlayers.filter(p => p.foot === 'D' || p.foot === 'A');
      } else if (posCode === 'LE') {
        footValid = naturalPlayers.filter(p => p.foot === 'E' || p.foot === 'A');
      }

      const bestForce = naturalPlayers.length ? naturalPlayers[0].force : 0;

      if (naturalPlayers.length < minStarter) {
        holes.push({
          pos: posCode,
          posEn: U.posEn(posCode),
          severity: 'CRITICAL',
          kind: 'NO_STARTER',
          count: naturalPlayers.length,
          needed: idealDepth,
          bestForce,
          desc: `Kurang starter natural di ${U.posEn(posCode)} (cuma ${naturalPlayers.length}/${minStarter} untuk ${fk})`,
        });
        holePositions.add(posCode);
      } else if ((posCode === 'LD' || posCode === 'LE') && footValid.length < minStarter) {
        const reqFoot = posCode === 'LD' ? 'Kanan (D)' : 'Kiri (E)';
        holes.push({
          pos: posCode,
          posEn: U.posEn(posCode),
          severity: 'HIGH',
          kind: 'FOOT_HOLE',
          count: footValid.length,
          needed: minStarter,
          bestForce,
          desc: `Tidak ada ${U.posEn(posCode)} berkaki ${reqFoot} — terkena penalti wrongFoot -5%!`,
        });
        holePositions.add(posCode);
      } else if (bestForce < avgForce - 4.0) {
        holes.push({
          pos: posCode,
          posEn: U.posEn(posCode),
          severity: 'HIGH',
          kind: 'WEAK_STARTER',
          count: naturalPlayers.length,
          needed: idealDepth,
          bestForce,
          desc: `Starter ${U.posEn(posCode)} terkuat (${bestForce}) tertinggal dari rata-rata skuad (${avgForce.toFixed(1)})`,
        });
        holePositions.add(posCode);
      } else if (naturalPlayers.length < idealDepth) {
        holes.push({
          pos: posCode,
          posEn: U.posEn(posCode),
          severity: 'MEDIUM',
          kind: 'NO_BACKUP',
          count: naturalPlayers.length,
          needed: idealDepth,
          bestForce,
          desc: ` Kedalaman tipis di ${U.posEn(posCode)} (${naturalPlayers.length}/${idealDepth} pemain)`,
        });
        holePositions.add(posCode);
      }
    }

    return {
      holes,
      holePositions: Array.from(holePositions),
    };
  }

  // =========================================================================
  // Bytecode #23839, #23840, #23845, #23847, #23850, #23919, #24474:
  // Transfer Policy, Buyer Force Ceiling, Refuses Distance, & Bosman Guard
  // =========================================================================

  // Bytecode #23839 buyerForceCeiling
  function buyerForceCeiling(rep = 60, division = 1) {
    const rLv = U.reputationLevel(rep);
    const repCap = (C.REP_CEILING && C.REP_CEILING[rLv] !== undefined) ? C.REP_CEILING[rLv] : 72;
    const div = U.safeInt(division, 1);
    const divCap = (C.DIV_CEILING && C.DIV_CEILING[div] !== undefined) ? C.DIV_CEILING[div] : 68;
    return Math.min(repCap, divCap);
  }

  // Bytecode #23845 transferPolicy
  function transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers = null, posCount = null) {
    if (!p || !sellerCountry) return { status: 'OK', mult: 1.0, reason: null };

    const sPlayers = Array.isArray(sellerPlayers) ? sellerPlayers : [];
    const samePosCount = posCount !== null && posCount !== undefined
      ? posCount
      : sPlayers.filter(x => x.pos === p.pos && !x.injured).length;

    if (p.pos === 'G' && samePosCount <= 1) {
      return { status: 'REFUSE', mult: 2.0, reason: 'onlyGoalkeeper' };
    }

    const age = U.safeInt(p.age, 24);
    const isYoungStar = Boolean(age <= 22 && ((p.potential || 0) >= (p.force || 0) + 10 || (p.hash || 0) >= 8 || p.star || p.top));
    const isKeyTop = Boolean(p.top || (p.star && age <= 28));

    const bLv = U.safeInt(buyerLevel, 10);
    const sLv = U.safeInt(sellerLevel, 10);
    const levelDiff = bLv - sLv;

    if (U.sameCountry(sellerCountry, buyerCountry) && sLv >= 14 && Math.abs(levelDiff) <= 2 && (isKeyTop || isYoungStar)) {
      return { status: 'REFUSE', mult: 2.0, reason: 'domesticRival' };
    }

    let mult = 1.0;
    if (isKeyTop) mult += 0.35;
    if (isYoungStar) mult += 0.30;
    if (samePosCount <= 2) mult += 0.25;
    if ((p.contractDays || 365) > 720) mult += 0.15;
    if (levelDiff < 0) mult += Math.min(0.4, Math.abs(levelDiff) * 0.08);
    if (p.forSale) mult = Math.min(mult, 0.90);

    return {
      status: 'OK',
      mult: U.roundTo(Math.min(2.5, mult), 2),
      reason: null,
      isKeyTop,
      isYoungStar,
    };
  }

  // Bytecode #23840 refusesDistance
  function refusesDistance(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel) {
    if (!buyerCountry || !sellerCountry) return false;
    if (U.sameCountry(sellerCountry, buyerCountry)) return false;

    const bLv = U.safeInt(buyerLevel, 10);
    const sLv = U.safeInt(sellerLevel, 10);
    const age = U.safeInt(p && p.age, 25);
    const pNat = String((p && p.nationality) || '').toUpperCase();

    if (pNat && U.sameCountry(pNat, buyerCountry)) {
      if (age >= 30) return false;
      if (bLv >= sLv - 3) return false;
    }

    const gSeller = U.countryGroup(sellerCountry);
    const gBuyer = U.countryGroup(buyerCountry);
    const aff = U.hasAffinity(sellerCountry, buyerCountry) || (pNat && U.hasAffinity(pNat, buyerCountry));

    let minBuyerLevel = sLv;
    if (gSeller === 0 && gBuyer !== 0) {
      minBuyerLevel = sLv + (age < 29 ? 3 : 0);
    } else if (gSeller === 1 && gBuyer === 0) {
      minBuyerLevel = Math.max(8, sLv - 2);
    } else if (!aff && gSeller !== gBuyer) {
      minBuyerLevel = sLv + (age < 28 ? 2 : 0);
    } else if (aff) {
      minBuyerLevel = sLv - 1;
    }

    if (p && (p.top || p.star) && age < 30 && gBuyer !== 0 && gSeller === 0) {
      return true;
    }
    return bLv < minBuyerLevel;
  }

  // Bytecode #23847 userBuyPolicy
  function userBuyPolicy(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, buyerRep, buyerDiv, sellerPlayers = null, posCount = null, isUnattached = false) {
    const pol = isUnattached
      ? { status: 'OK', mult: 1.0, reason: null, isKeyTop: Boolean(p.top || (p.star && p.age <= 28)), isYoungStar: false }
      : transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers, posCount);
    if (pol.status === 'REFUSE') return pol;

    const sLv = isUnattached ? U.clamp(Math.round(((p.force || 50) - 18) / 3), 1, 20) : U.safeInt(sellerLevel, 10);
    const bLv = U.safeInt(buyerLevel, 10);
    const sCountry = isUnattached ? (p.nationality || '') : sellerCountry;

    if (refusesDistance(p, sCountry, buyerCountry, sLv, bLv)) {
      return { status: 'REFUSE', mult: 2.0, reason: 'distanceOrLeague', code: 'REFUSE_DIST' };
    }

    const gap = sLv - bLv;
    if (!p.forSale) {
      const maxStepDown = (p.age >= 32) ? 5 : ((p.age >= 29) ? 3 : 2);
      if (gap > maxStepDown) {
        return { status: 'REFUSE', mult: 2.0, reason: 'clubLevelLow', code: 'REFUSE_LVL' };
      }
      if ((p.top || p.star) && gap >= 2 && p.age < 31) {
        return { status: 'REFUSE', mult: 2.0, reason: 'ambition', code: 'REFUSE_LVL' };
      }
    }

    const ceil = buyerForceCeiling(buyerRep, buyerDiv);
    let ceilMult = 1.0;
    if ((p.force || 0) > ceil) {
      const over = (p.force || 0) - ceil;
      if (over >= 12 && !p.forSale) {
        return { status: 'REFUSE', mult: 2.0, reason: 'clubStatusLow', code: 'REFUSE_LVL' };
      }
      ceilMult = 2.0;
    }

    return {
      status: 'OK',
      mult: U.roundTo(Math.min(3.5, pol.mult * ceilMult), 2),
      reason: null,
      code: ceilMult > 1.0 ? 'CEIL_2X' : 'OK',
      ceilMult,
    };
  }

  // Bytecode #23850 buyPersuadable (tawaran >= 1.5x MV memberi slack +2 level, max 2.0x)
  function buyPersuadable(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, pol) {
    if (!pol || pol.status !== 'REFUSE') return false;
    if (pol.reason === 'onlyGoalkeeper' || pol.reason === 'domesticRival') return false;
    if (p && p.top && (p.age || 25) < 28 && U.safeInt(buyerLevel, 10) < U.safeInt(sellerLevel, 10) - 2) return false;
    const slack = 2;
    return !refusesDistance(p, sellerCountry, buyerCountry, sellerLevel, U.safeInt(buyerLevel, 10) + slack);
  }

  LF.tactics = {
    repToLevel,
    evalSkillStacking,
    integrationOf,
    rhythmOf,
    teamChemistry,
    chemistryMul,
    arriveAtClubInit,
    computeSquadMoodsV9,
    slotCompatFactor,
    isPlayerStar,
    evalPlayerForSlot,
    auditSetPieces,
    solveBestXi,
    computeEngineSectorPower,
    predictAiTacticsDetail,
    predictAiTactics,
    recommendMatchupForOpponent,
    detectSquadHoles,
    buyerForceCeiling,
    transferPolicy,
    refusesDistance,
    userBuyPolicy,
    buyPersuadable,
  };
})(typeof window !== 'undefined' ? window : globalThis);
