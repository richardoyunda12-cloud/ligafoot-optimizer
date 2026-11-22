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
   * - Mendukung kode posisi penuh: G, LD, LE, LAT, ZD, ZE, ZAG, Z, VOL, V, MC, MD, ME, MA, MO, MEI, PD, PE, SA, ATA, A.
   * - Mendukung kode skill penuh: REF, COL, SAI, DPE, PEN, DES, MAR, CAB, VEL, RES, CRU, PAS, ARM, DRI, FIN.
   * - DES+MAR di DEF tidak menumpuk (cuma +5% sekali); PAS+ARM di MID tidak menumpuk (cuma +3% sekali).
   * - GK SAI: +3% di s1, +1% di s2 (#35011).
   */
  function evalSkillStacking(posCode, s1Raw, s2Raw) {
    const pos = String(posCode || 'MC').toUpperCase();
    const cat = (C.EXACT_CAT && (pos in C.EXACT_CAT)) ? C.EXACT_CAT[pos] : U.posCategory(pos);
    const s1 = String(s1Raw || '').trim().toUpperCase();
    const s2 = String(s2Raw || '').trim().toUpperCase();
    const skills = new Set([s1, s2].filter(Boolean));

    if (cat === 0) {
      let bonus = 1.0;
      const notes = [];
      if (s1 === 'REF' || s1 === 'COL') {
        bonus *= 1.04;
        notes.push(`${U.skillEn(s1)}(s1)+4%`);
      } else if (s1 === 'SAI') {
        notes.push('RUS(s1)+2%Save'); // #21834 keeperSaveMul: s1 SAI = +2% save
      }
      if (s2 === 'REF' || s2 === 'COL') {
        bonus *= 1.02;
        notes.push(`${U.skillEn(s2)}(s2)+2%`);
      } else if (s2 === 'SAI') {
        notes.push('RUS(s2)+1%Save'); // #21834 keeperSaveMul: s2 SAI = +1% save
      }
      if (skills.has('DPE') || skills.has('PEN')) notes.push('PEN(+8% penalti)');
      const pct = U.roundTo((bonus - 1.0) * 100, 2);
      const grade = (pct >= 5.0 || (pct >= 4.0 && skills.has('SAI'))) ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD');
      return { stackPct: pct, pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    if (cat === 1 || cat === 2) {
      const nonStack = (skills.has('DES') && skills.has('MAR')) || (s1 && s2 && s1 === s2);
      let bonus = 1.0;
      const notes = [];
      if (skills.has('DES') || skills.has('MAR')) {
        bonus *= 1.05;
        notes.push('TCK/MRK+5%');
      }
      if (skills.has('CAB')) {
        bonus *= 1.04;
        notes.push('HDG+4%');
      }
      if (skills.has('VEL')) {
        bonus *= 1.02;
        notes.push('PAC+2%');
      }
      if (skills.has('RES')) notes.push('STA(-40% lelah)');
      if (skills.has('CRU') && cat === 1) notes.push('CRS(Corner)');
      const pct = U.roundTo((bonus - 1.0) * 100, 2);
      if (nonStack) {
        return { stackPct: pct, pct, grade: 'NON-STACK', nonStack: true, note: 'TCK+MRK tidak stack (cuma +5%)' };
      }
      const grade = (pct >= 7.0 || (pct >= 5.0 && skills.has('RES'))) ? 'GOD' : (pct >= 4.0 ? 'GOOD' : 'STD');
      return { stackPct: pct, pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    if (cat === 3) {
      const nonStack = (skills.has('PAS') && skills.has('ARM')) || (s1 && s2 && s1 === s2);
      let bonus = 1.0;
      const notes = [];
      if (skills.has('PAS') || skills.has('ARM')) {
        bonus *= 1.03;
        notes.push('PAS/PLY+3%');
      }
      if (skills.has('DRI')) {
        bonus *= 1.02;
        notes.push('DRI+2%');
      }
      // #35011: DES/MAR di MID tidak menambah sector power +2%
      if (skills.has('RES')) notes.push('STA(-40% lelah)');
      if (skills.has('FIN')) notes.push('FIN(+5% konv)');
      const pct = U.roundTo((bonus - 1.0) * 100, 2);
      if (nonStack) {
        return { stackPct: pct, pct, grade: 'NON-STACK', nonStack: true, note: 'PAS+PLY tidak stack (cuma +3%)' };
      }
      const grade = (pct >= 5.0 || (pct >= 3.0 && skills.has('RES'))) ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD');
      return { stackPct: pct, pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    // cat === 4: Penyerang / Sayap (PD, PE, SA, ATA, A)
    // #35201: DRI+3%, CAB+3%, VEL+2% pada ATK; FIN memberi 0% sector bonus (+5% konversi di #21833 & +4 bobot shooter di #21835)
    const nonStack = Boolean(s1 && s2 && s1 === s2);
    let bonus = 1.0;
    const notes = [];
    if (skills.has('DRI')) { bonus *= 1.03; notes.push('DRI+3%'); }
    if (skills.has('CAB')) { bonus *= 1.03; notes.push('HDG+3%'); }
    if (skills.has('VEL')) { bonus *= 1.02; notes.push('PAC+2%'); }
    if (skills.has('FIN')) { notes.push('FIN(+5% konv & +4 tembak)'); }
    if (skills.has('RES')) notes.push('STA(-40% lelah)');
    if (skills.has('CRU')) notes.push('CRS(Corner)');
    const pct = U.roundTo((bonus - 1.0) * 100, 2);
    const grade = nonStack ? 'NON-STACK' : ((pct >= 5.0 || (pct >= 3.0 && skills.has('FIN'))) ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD'));
    return { stackPct: pct, pct, grade, nonStack, note: notes.join(' ') || 'Standar' };
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
   * Bytecode #21465 & #3726: Simulasi `squadMoods` v1.2.0:
   * - Tier natural (hanya pemain fit !injured && !suspended):
   *   - Tier 2 (natural starter, 40%): Top 1 GK + Top 10 Outfield
   *   - Tier 1 (natural sub, 8%): Outfield indeks 10..16 (7 pemain berikutnya) dengan age > 19
   *   - Tier 0 (0%, kebal di mode auto): sisanya, termasuk pemain dengan age <= 19!
   * - Role eksplisit: 'starter' || roleSore -> 40%; 'rotation' -> 25%; 'youth' -> 8% (jika age<=19); 'reserve' && !roleSore -> 0%
   * - lockerRoomHit (#21831): min(0.04, max(0, unhappyCount - 3) * 0.01) -> baru aktif di >= 4 unhappy!
   */
  function computeSquadMoodsV9(roster, isAiTeam = false, explicitTeamGames = null) {
    if (!roster || !roster.length) {
      return { moods: {}, unhappyCount: 0, lockerHit: 0.0, teamGames: 0 };
    }

    const availGks = roster
      .filter(p => !p.injured && !p.suspended && p.pos === 'G')
      .sort((a, b) => (b.force - a.force) || String(a.id).localeCompare(String(b.id)));
    const availOutfield = roster
      .filter(p => !p.injured && !p.suspended && p.pos !== 'G')
      .sort((a, b) => (b.force - a.force) || String(a.id).localeCompare(String(b.id)));

    const tier2Ids = new Set();
    if (availGks.length > 0) tier2Ids.add(availGks[0].id);
    availOutfield.slice(0, 10).forEach(p => tier2Ids.add(p.id));

    const tier1Ids = new Set();
    availOutfield.slice(10, 17).forEach(p => {
      if ((p.age || 20) > 19) tier1Ids.add(p.id);
    });

    const maxMins = Math.max(...roster.map(p => U.safeNum(p.seasonMinutes, 0)), 0);
    const teamGames = explicitTeamGames !== null && explicitTeamGames !== undefined
      ? Math.max(0, U.safeInt(explicitTeamGames, 0))
      : (maxMins > 0 ? Math.max(1, Math.ceil(maxMins / 90.0)) : 0);

    const moods = {};
    let unhappyCount = 0;

    for (const p of roster) {
      const pid = p.id;
      const naturalStarter = tier2Ids.has(pid);
      const naturalSub = tier1Ids.has(pid);

      let tier = 0;
      if (naturalStarter) tier = 2;
      else if (naturalSub) tier = 1;

      const role = String(p.squadRole || 'auto').toLowerCase();
      const minsNow = Math.round(U.safeNum(p.seasonMinutes, 0));
      const injDays = U.safeInt(p.seasonInjuryDays, 0);
      const injGames = Math.floor(injDays / 4); // #3726 injuryDaysPerGame = 4
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
        reqRatio = 0.40;
        if (roleSore) reason = 'Natural Top-11 diset Reserve (tetap wajib 40%!)';
      } else if (role === 'rotation') {
        reqRatio = 0.25;
      } else if (role === 'youth') {
        reqRatio = p.age <= 19 ? 0.08 : 0.0;
        if (reqRatio === 0.0) immune = true;
      } else {
        if (tier === 2) reqRatio = 0.40;
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

    // #21831 lockerRoomHit: min(0.04, max(0, unhappyCount - 3) * 0.01)
    let lockerHit = 0.0;
    if (unhappyCount >= C.LOCKER_UNHAPPY_MIN) {
      lockerHit = Math.min(C.LOCKER_HIT_CAP, Math.max(0, unhappyCount - (C.LOCKER_UNHAPPY_MIN - 1)) * C.LOCKER_HIT_PER_PLAYER);
    }

    return {
      moods,
      unhappyCount,
      lockerHit: U.roundTo(lockerHit, 4),
      teamGames,
    };
  }

  // Bytecode #21826: slotCompatFactor dengan dukungan RULE_SLOT_INFO & Wildcard slots 10/17
  // Di engine #21826, pemain dengan kategori yang sama dengan slot mendapat 1.00 (tidak ada penalti 0.99/0.995),
  // GK di slot outfield = 0.70 (kecuali wildcard 10/17 = 1.00), outfield di slot GK = 0.20, dan OOP = 0.70.
  function slotCompatFactor(playerPos, targetSlot, ruleId = null) {
    if (ruleId !== null && ruleId !== undefined && C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleId]) {
      const ri = C.RULE_SLOT_INFO[ruleId];
      if (ri.wildcard) {
        return 1.00; // #3639: Slot 10 & 17 wildcard (category: null) menerima pemain tanpa penalti OOP
      }
      if (ri.cat === 0 || targetSlot === 'G') {
        return playerPos === 'G' ? 1.00 : 0.20;
      }
      if (playerPos === 'G') {
        return 0.70;
      }
      const pCat4 = (C.EXACT_CAT && (playerPos in C.EXACT_CAT)) ? C.EXACT_CAT[playerPos] : U.posCategory(playerPos);
      const pRuleCat = pCat4 === 0 ? 0 : (pCat4 <= 2 ? 1 : (pCat4 === 3 ? 2 : 3));
      return pRuleCat === ri.cat ? 1.00 : 0.70;
    }
    if (targetSlot === 'G') {
      return playerPos === 'G' ? 1.00 : 0.20;
    }
    if (playerPos === 'G') {
      return 0.70;
    }
    if (playerPos === targetSlot) {
      return 1.00;
    }
    const pCat4 = (C.EXACT_CAT && (playerPos in C.EXACT_CAT)) ? C.EXACT_CAT[playerPos] : U.posCategory(playerPos);
    const tCat4 = (C.EXACT_CAT && (targetSlot in C.EXACT_CAT)) ? C.EXACT_CAT[targetSlot] : U.posCategory(targetSlot);
    const pRuleCat = pCat4 === 0 ? 0 : (pCat4 <= 2 ? 1 : (pCat4 === 3 ? 2 : 3));
    const tRuleCat = tCat4 === 0 ? 0 : (tCat4 <= 2 ? 1 : (tCat4 === 3 ? 2 : 3));
    return pRuleCat === tRuleCat ? 1.00 : 0.70;
  }

  function isPlayerStar(p) {
    return Boolean(p && (p.star || p.top || p.starAwarded));
  }

  /**
   * Bytecode #21807, #21813, #21826, #35201: Evaluasi kontribusi efektif pemain pada slot formasi.
   */
  function evalPlayerForSlot(p, targetSlot, includeEnergy = true, repLevel = 3, ruleId = null) {
    const compat = slotCompatFactor(p.pos, targetSlot, ruleId);

    // #21826: wrongFoot (-5%) dicek pada slot dengan category===1 & side 'D' atau 'E'
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

    // #35201: skill bonus tetap dihitung pada sektor tempat pemain dipasang (tidak dinolkan saat OOP)
    const stackBonus = p.stackPct || 0.0;

    // #21826 L1656530: p.top mendapat bonus lebih besar (1.10 / 1.05) dibanding star biasa (1.05 / 1.02)
    let starMul = 1.00;
    if (p && p.top) {
      starMul = repLevel > 3 ? 1.10 : 1.05;
    } else if (isPlayerStar(p)) {
      starMul = repLevel > 3 ? 1.05 : 1.02;
    }

    // #21826: pemain yang bermain di posisi valid (!oop -> compat >= 1.0) mendapat same-club bonus * 1.05
    const clubSyncMul = compat >= 1.0 ? 1.05 : 1.00;

    // #21826: pemain unhappy terkena * 0.97 (-3%)
    const moodMul = (p && p.mood === 'unhappy') ? 0.97 : 1.00;

    // #21826: fineSlump dibatasi maksimal 0.20 (lantai 0.80)
    const slumpVal = U.safeNum(p.fineSlump, 0.0);
    const slumpFrac = slumpVal <= 1.0 ? slumpVal : (slumpVal / 100.0);
    const slumpMul = slumpVal > 0 ? (1.0 - Math.min(0.20, slumpFrac)) : 1.00;

    // #21807 & #35201: Continuous energyFactor = max(0.92, 1 - 0.001 * deficit), RES memotong deficit 40%
    let energyMul = 1.00;
    if (includeEnergy) {
      const en = U.clamp(U.safeNum(p.energy, 100), 0, 100);
      const hasRes = (p.s1 === 'RES' || p.s2 === 'RES');
      const deficit = (100.0 - en) * (hasRes ? 0.6 : 1.0);
      energyMul = Math.max(0.92, 1.0 - 0.001 * deficit);
    }

    const baseF = U.safeNum(p.effForce !== undefined ? p.effForce : p.force, 10.0);
    const score = baseF * compat * clubSyncMul * footMul * (1.0 + stackBonus / 100.0) * starMul * moodMul * slumpMul * energyMul;

    return {
      score,
      wrongFoot,
      compat,
    };
  }

  /**
   * Audit Set-Piece & Kapten (#21818, #21822, #21823, #21825, #35438, #35439):
   * - Captain: auto (#35438) memilih starter tertua; hanya age >= 28 yang memberi +3% MID (+6% saat babak 2 & tertinggal).
   * - Free Kick: auto (#35439) memilih s1==='FIN' || s2==='FIN'; di #21823 hanya FIN yang memberi +2% konversi (PAS/ARM = 0%).
   * - Corner: auto (#35439) memilih s1==='CRU' || s2==='CRU'; di #21823/#21825 s1 CRU = +3% konv & +4 header, s2 CRU = +1.5% konv & +4 header.
   * - Penalty: auto (#21818) memilih starter dengan s1==='FIN' tertinggi (buta PEN & s2==='FIN'!). Di #21824 s1/s2 FIN memberi +3% gol penalti.
   */
  function auditSetPieces(xiPlayers) {
    if (!xiPlayers || !xiPlayers.length) {
      return { captain: [], freeKick: [], corner: [], penalty: [], warnings: [], autoSame: {} };
    }

    const capRanked = [...xiPlayers].sort((a, b) => {
      const vetA = (a.age || 0) >= 28 ? 1 : 0;
      const vetB = (b.age || 0) >= 28 ? 1 : 0;
      return (vetB - vetA) || ((b.age || 0) - (a.age || 0)) || (b.force - a.force);
    });

    const fkRanked = [...xiPlayers].sort((a, b) => {
      const finA = (a.s1 === 'FIN' || a.s2 === 'FIN') ? 1 : 0;
      const finB = (b.s1 === 'FIN' || b.s2 === 'FIN') ? 1 : 0;
      return (finB - finA) || (b.force - a.force);
    });

    const ckRanked = [...xiPlayers].sort((a, b) => {
      const cruA = a.s1 === 'CRU' ? 2 : (a.s2 === 'CRU' ? 1 : 0);
      const cruB = b.s1 === 'CRU' ? 2 : (b.s2 === 'CRU' ? 1 : 0);
      return (cruB - cruA) || (b.force - a.force);
    });

    const pkRanked = [...xiPlayers].sort((a, b) => {
      const finA = (a.s1 === 'FIN' || a.s2 === 'FIN') ? 1 : 0;
      const finB = (b.s1 === 'FIN' || b.s2 === 'FIN') ? 1 : 0;
      return (finB - finA) || (b.force - a.force);
    });

    // #21818 autoPenaltyTaker: hanya cek s1 === 'FIN'
    const autoPk = [...xiPlayers].sort((a, b) => {
      const s1A = a.s1 === 'FIN' ? 1 : 0;
      const s1B = b.s1 === 'FIN' ? 1 : 0;
      return (s1B - s1A) || (b.force - a.force);
    });

    // #35439 auto freeKick: cek s1 === 'FIN' || s2 === 'FIN'
    const autoFk = [...fkRanked];

    // #35439 auto corner: cek s1 === 'CRU' || s2 === 'CRU' (tanpa membedakan s1 vs s2)
    const autoCk = [...xiPlayers].sort((a, b) => {
      const cA = (a.s1 === 'CRU' || a.s2 === 'CRU') ? 1 : 0;
      const cB = (b.s1 === 'CRU' || b.s2 === 'CRU') ? 1 : 0;
      return (cB - cA) || (b.force - a.force);
    });

    const warnings = [];
    if (pkRanked[0].id !== autoPk[0].id) {
      warnings.push(
        `Penalti (#21818): Auto memilih ${autoPk[0].name} (F${autoPk[0].force}), padahal ${pkRanked[0].name} (F${pkRanked[0].force}, ${pkRanked[0].s1}/${pkRanked[0].s2}) punya FIN di slot 2 (+3% konversi penalti — Auto hanya membaca s1==='FIN'!).`
      );
    }
    if (ckRanked[0].id !== autoCk[0].id) {
      warnings.push(
        `Corner (#21823): Set manual ke ${ckRanked[0].name} (${ckRanked[0].s1}/${ckRanked[0].s2}) karena CRU di slot 1 memberi +3% konversi (slot 2 hanya +1.5%).`
      );
    }
    if ((capRanked[0].age || 0) < 28) {
      warnings.push(
        `Kapten (#21822): Tidak ada starter berusia ≥28 tahun di XI (kapten ${capRanked[0].name} ${capRanked[0].age}th belum mengaktifkan bonus +3% MID / +6% comeback).`
      );
    }

    const fmtTaker = (p, roleType) => {
      const sk = [U.skillEn(p.s1), U.skillEn(p.s2)].filter(Boolean).join('/');
      let reason = `F:${p.force}`;
      if (roleType === 'cap') reason = (p.age >= 28) ? `Usia ${p.age}th (+3% MID / +6% Comeback)` : `Tertua (${p.age}th, <28th)`;
      else if (roleType === 'pk' && p.s2 === 'FIN' && p.s1 !== 'FIN') reason = 'FIN Slot 2 (+3% Penalti, Lewat di Auto!)';
      else if (roleType === 'pk' && p.s1 === 'FIN') reason = 'FIN Slot 1 (+3% Penalti)';
      else if (roleType === 'fk' && (p.s1 === 'FIN' || p.s2 === 'FIN')) reason = 'FIN (+2% Konversi Freekick #21823)';
      else if (roleType === 'ck' && p.s1 === 'CRU') reason = 'CRS Slot 1 (+3% Konv & +4 Header)';
      else if (roleType === 'ck' && p.s2 === 'CRU') reason = 'CRS Slot 2 (+1.5% Konv & +4 Header)';
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

    // 2-opt internal swap untuk menghilangkan salah kaki (LD<->LE) & memaksimalkan total skor
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let i = 1; i < assigned.length; i++) {
        for (let j = i + 1; j < assigned.length; j++) {
          if (!assigned[i] || !assigned[j]) continue;
          const pi = assigned[i].player;
          const pj = assigned[j].player;
          const si = assigned[i].slot;
          const sj = assigned[j].slot;
          const ri = assigned[i].ruleId;
          const rj = assigned[j].ruleId;
          const curSum = assigned[i].score + assigned[j].score;
          const evI = evalPlayerForSlot(pj, si, true, repLevel, ri);
          const evJ = evalPlayerForSlot(pi, sj, true, repLevel, rj);
          if (evI.score + evJ.score > curSum + 0.01) {
            assigned[i] = { ...assigned[i], player: pj, score: U.roundTo(evI.score, 2), wrongFoot: evI.wrongFoot, compat: evI.compat };
            assigned[j] = { ...assigned[j], player: pi, score: U.roundTo(evJ.score, 2), wrongFoot: evJ.wrongFoot, compat: evJ.compat };
            improved = true;
          }
        }
      }
      if (!improved) break;
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
      if (p.pos === 'ATA' || p.pos === 'A' || p.pos === 'SA') {
        hasDedicatedStriker = true;
      }
    }

    const f9Players = xiClean
      .map(x => x.player)
      .filter(p => (p.pos === 'ATA' || p.pos === 'A' || p.pos === 'SA') && (p.s1 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'PAS' || p.s2 === 'ARM'))
      .map(p => p.name);
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
      falseNine: f9Players.length >= 2,
      falseNinePlayers: f9Players,
      noDedicatedStriker: !hasDedicatedStriker,
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

    const falseNineMul = (xiObj && xiObj.noDedicatedStriker) ? 0.90 : 1.00;
    const lockerMul = Math.max(0.96, 1.0 - lockerHitPct / 100.0);
    const chem = (xiObj && xiObj.chemistry !== undefined) ? xiObj.chemistry : 100;
    const chemMul = chemistryMul(chem);
    const outfieldGlobalMul = lockerMul * chemMul;

    // #21822: Denominator tetap /5, /5, /3; lockerMul & chemMul hanya berlaku pada DEF, MID, ATK (bukan GK)
    const baseGk = (cntG > 0 ? sumG / cntG : 15.0);
    const baseDef = (sumD / 5.0);
    const baseMid = (sumM / 5.0);
    const baseAtk = (sumA / 3.0);

    let rawGk = baseGk;
    let rawDef = baseDef * outfieldGlobalMul;
    let rawMid = baseMid * outfieldGlobalMul;
    let rawAtk = baseAtk * falseNineMul * outfieldGlobalMul;

    // #21822: False Nine (f9Count >= 2) juga memberi +4% MID, atau jika 0 dedicated striker tapi ada gelandang serang memberi +3% MID
    const f9Cnt = (xiObj && Array.isArray(xiObj.falseNinePlayers)) ? xiObj.falseNinePlayers.length : ((xiObj && xiObj.falseNine) ? 2 : 0);
    if (f9Cnt >= 2) {
      rawMid *= 1.04;
    } else if (xiObj && xiObj.noDedicatedStriker) {
      rawMid *= 1.03;
    }

    // #21822: Kapten berusia >= 28 memberi +3% MID (+6% saat babak ke-2 & tertinggal)
    const hasVetCaptain = xiList.length
      ? xiList.some(item => ((item.player || item).age || 0) >= 28)
      : true;
    if (hasVetCaptain) {
      rawMid *= 1.03;
    }

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

    if (shout.includes('praise') || shout.includes('elogiar') || shout.includes('encourage')) {
      rawMid *= 1.012;
    } else if (shout.includes('focus') || shout.includes('concentrar') || shout.includes('tighten')) {
      rawDef *= 1.012;
    } else if (shout.includes('push') || shout.includes('avan') || shout.includes('attack')) {
      rawAtk *= 1.012;
    }

    const totalPower = rawDef + rawMid + rawAtk + rawGk * 0.35;
    const bugInfo = (C.FORMATION_BUGS && C.FORMATION_BUGS[fk]) || null;

    // Hitung pengumpan silang sayap, playmaker tengah, bonus FIN/SAI, & skor penembak (#21822, #21833, #21834, #21835)
    let wingCrossers = 0;
    let centerPlaymakers = 0;
    let finAttackers = 0;
    let gkSaveBonus = 0.0;
    let shooterNum = 0;
    let shooterDen = 0;
    if (xiList.length) {
      for (const item of xiList) {
        const p = item.player || item;
        const pos = p.pos || item.slot || '';
        const s1 = p.s1 || '';
        const s2 = p.s2 || '';
        const sec = item.sectorCode || 'M';
        if (sec === 'G') {
          if (s1 === 'SAI') gkSaveBonus += 0.02;
          else if (s2 === 'SAI') gkSaveBonus += 0.01;
        }
        if (['LD', 'LE', 'LAT', 'MD', 'ME', 'PD', 'PE'].includes(pos) && (s1 === 'CRU' || s2 === 'CRU')) {
          wingCrossers++;
        }
        if (sec === 'M' && (s1 === 'PAS' || s2 === 'PAS' || s1 === 'ARM' || s2 === 'ARM')) {
          centerPlaymakers++;
        }
        if (sec === 'A' && (s1 === 'FIN' || s2 === 'FIN')) {
          finAttackers++;
        }
        if (sec !== 'G' && sec !== 'X') {
          let w = sec === 'A' ? 5.0 : sec === 'M' ? 2.0 : 0.4;
          if (s1 === 'FIN' || s2 === 'FIN') w += 4.0; // #21835: FIN menambah bobot shooter +4
          const sc = U.safeNum(item.score !== undefined ? item.score : p.force, 0);
          shooterNum += sc * w;
          shooterDen += w;
        }
      }
    }
    const shooterVal = shooterDen > 0
      ? shooterNum / shooterDen
      : U.safeNum(xiObj && xiObj.avgScore, (rawGk + rawDef + rawMid + rawAtk) / 4);
    const finBonusMul = 1.0 + Math.min(0.05, finAttackers * 0.025);
    const gkSaveMul = 1.0 + gkSaveBonus;

    // #21822 effectiveSectors:
    // Focus Center: weighted (0.8*ATK + 0.2*MID) * (centerPlaymakers > 0 ? 1 + 0.015*min(3, centerPlaymakers) : 0.97)
    // Focus Wings: rawAtk * (wingCrossers > 0 ? 1 + 0.02*min(3, wingCrossers) : 0.96)
    // Lalu di-clamp ke ±8% (sectorCap = 0.08) terhadap baseDef / baseMid / baseAtk!
    const clampCap = (val, base) => base > 0 ? U.clamp(val, base * 0.92, base * 1.08) : val;
    const focusOpt = String(opts.focus || opts.attackFocus || '').toLowerCase();
    const centerPmMul = centerPlaymakers > 0 ? (1.0 + 0.015 * Math.min(3, centerPlaymakers)) : 0.97;
    const rawAtkCenter = ((rawAtk > 0 && rawMid > 0) ? (rawAtk * 0.8 + rawMid * 0.2) : rawAtk) * centerPmMul;
    const wingMul = wingCrossers > 0 ? (1.0 + 0.02 * Math.min(3, wingCrossers)) : 0.96;
    const rawAtkWings = rawAtk * wingMul;

    rawDef = clampCap(rawDef, baseDef);
    rawMid = clampCap(rawMid, baseMid);
    const atkCenter = clampCap(rawAtkCenter, (baseAtk * 0.8 + baseMid * 0.2));
    const atkWings = clampCap(rawAtkWings, baseAtk);
    rawAtk = clampCap(rawAtk, baseAtk);

    let effAtk = rawAtk;
    if (focusOpt.includes('wing') || focusOpt.includes('sayap')) effAtk = atkWings;
    else if (focusOpt.includes('center') || focusOpt.includes('tengah')) effAtk = atkCenter;

    return {
      formation: fk,
      shape: { D: cntD, M: cntM, A: cntA },
      GK: U.roundTo(rawGk, 1),
      DEF: U.roundTo(rawDef, 1),
      MID: U.roundTo(rawMid, 1),
      ATK: U.roundTo(effAtk, 1),
      rawATK: U.roundTo(rawAtk, 1),
      atkCenter: U.roundTo(atkCenter, 1),
      atkWings: U.roundTo(atkWings, 1),
      wingCrossers,
      centerPlaymakers,
      finBonusMul: U.roundTo(finBonusMul, 4),
      gkSaveMul: U.roundTo(gkSaveMul, 4),
      shooterVal: U.roundTo(shooterVal, 1),
      totalPower: U.roundTo(totalPower, 1),
      convBonusPct,
      cardRiskLabel,
      staminaDrainLabel,
      chemistry: chem,
      hasFormationBug: Boolean(bugInfo && bugInfo.hasBug),
      formationBugInfo: bugInfo,
    };
  }

  // #21806 gapDamp: skala engine (/10 dari skor tampilan): linear s.d. knee 1.6 (16 di tampilan), lalu slope 0.8
  function gapDamp(diffEngine) {
    const abs = Math.abs(diffEngine);
    if (abs <= 1.6) return diffEngine;
    return (diffEngine < 0 ? -1 : 1) * (1.6 + (abs - 1.6) * 0.8);
  }

  /**
   * Model Markov Analitik #21813 + #21822 + #48031 (_loop5):
   * Menghitung peluang menang/seri/kalah, ekspektasi gol (xG), penguasaan bola, dan jumlah tembakan
   * sesuai formula bytecode asli:
   *   1) Duel MID: (55 * pAtt) / (55 * pAtt + 45 * pDef) dengan div=8 & homeBonus=+0.3
   *   2) Shot Attempt (jika menang MID): sAtt / (sAtt + sDef)
   *   3) Goal vs GK Save vs Miss: gkVal - shooterVal (base 35.55 / 40.55 + 15 miss vs 5.5 / 4.5 / 3.0)
   */
  function simulateMatchExpectation(uPow, oPow, opts = {}) {
    const isHome = Boolean(opts.isHome);
    const neutral = Boolean(opts.neutral);
    const focus = String(opts.focus || 'Center').toLowerCase();
    const oFocus = String(opts.oppFocus || 'Center').toLowerCase();
    const uStyle = String(opts.style || 'Balanced').toLowerCase();
    const oStyle = String(opts.oppStyle || 'Balanced').toLowerCase();

    const uAtk = focus.includes('wing')
      ? U.safeNum(uPow.atkWings, uPow.ATK)
      : U.safeNum(uPow.atkCenter, (uPow.ATK * 0.8 + uPow.MID * 0.2));
    const oAtk = oFocus.includes('wing')
      ? U.safeNum(oPow.atkWings, oPow.ATK)
      : U.safeNum(oPow.atkCenter, (oPow.ATK * 0.8 + oPow.MID * 0.2));

    const uSec = {
      GK: U.safeNum(uPow.GK, 35) / 10,
      DEF: U.safeNum(uPow.DEF, 30) / 10,
      MID: U.safeNum(uPow.MID, 30) / 10,
      ATK: uAtk / 10,
      shooter: U.safeNum(uPow.shooterVal, 40) / 10,
    };
    const oSec = {
      GK: U.safeNum(oPow.GK, 35) / 10,
      DEF: U.safeNum(oPow.DEF, 30) / 10,
      MID: U.safeNum(oPow.MID, 30) / 10,
      ATK: oAtk / 10,
      shooter: U.safeNum(oPow.shooterVal, 40) / 10,
    };

    // #21833 conversionMul: convBase = 0.965 * (counter ? 1.07 : 1.0) * finBonusMul
    const uFinMul = U.safeNum(uPow.finBonusMul, 1.025);
    const oFinMul = U.safeNum(oPow.finBonusMul, 1.025);
    const uGkSaveMul = U.safeNum(uPow.gkSaveMul, 1.0);
    const oGkSaveMul = U.safeNum(oPow.gkSaveMul, 1.0);
    const uConvMul = 0.965 * (uStyle.includes('counter') ? 1.07 : 1.0) * uFinMul;
    const oConvMul = 0.965 * (oStyle.includes('counter') ? 1.07 : 1.0) * oFinMul;
    const hU = (!neutral && isHome) ? 0.3 : 0.0;
    const hO = (!neutral && !isHome) ? 0.3 : 0.0;
    const nPerSide = 48; // 96 total lances rata-rata per laga (#21844: 45+stop1 + 45+stop2)

    function sideRates(att, def, attHomeBonus, attIsHome, convMul, defGkSaveMul) {
      const midD = gapDamp(att.MID - def.MID);
      const pAtt = Math.max(0.2, 1 + midD / 8 + attHomeBonus);
      const pDef = Math.max(0.2, 1 - midD / 8);
      const duelProb = (55 * pAtt) / (55 * pAtt + 45 * pDef);

      const atkD = gapDamp(att.ATK - def.DEF);
      const sAtt = Math.max(0.2, 1 + atkD / 8 + attHomeBonus);
      const sDef = Math.max(0.2, 1 - atkD / 8);
      const shotGivenDuel = sAtt / (sAtt + sDef);

      const diffGk = def.GK - att.shooter;
      const dampGk = diffGk < 0 ? gapDamp(diffGk) : diffGk;
      const sideHomeAdj = (!neutral && attIsHome) ? 0.1 : 0.0;
      const gkF = Math.max(0.2, 1 + dampGk / 8 + sideHomeAdj) * defGkSaveMul;
      const missF = Math.max(0.2, 1 - dampGk / 8 + sideHomeAdj);

      const conv0 = (5.5 * convMul) / (5.5 * convMul + 35.55 * gkF + 15 * missF);
      const conv2 = (4.5 * convMul) / (4.5 * convMul + 40.55 * gkF + 15 * missF);
      return { duelProb, shotProb: duelProb * shotGivenDuel, conv0, conv2 };
    }

    const rU = sideRates(uSec, oSec, hU, isHome, uConvMul, oGkSaveMul);
    const rO = sideRates(oSec, uSec, hO, !isHome, oConvMul, uGkSaveMul);

    function goalDist(r) {
      const maxG = 8;
      let dp = new Array(maxG + 1).fill(0);
      dp[0] = 1;
      for (let i = 0; i < nPerSide; i++) {
        // #48031: earlyGoalDamp = 0.35 pada 15 menit pertama, setelah itu earlyGoalComp = 1.05
        const early = i < 4 ? 0.35 : 1.05;
        const ndp = new Array(maxG + 1).fill(0);
        for (let g = 0; g <= maxG; g++) {
          if (dp[g] === 0) continue;
          const baseC = g >= 3 ? r.conv2 * 0.65 : (g >= 2 ? r.conv2 : r.conv0);
          const pGoal = r.shotProb * Math.min(0.8, baseC * early);
          ndp[g] += dp[g] * (1 - pGoal);
          if (g < maxG) ndp[g + 1] += dp[g] * pGoal;
          else ndp[g] += dp[g] * pGoal;
        }
        dp = ndp;
      }
      return dp;
    }

    const dpU = goalDist(rU);
    const dpO = goalDist(rO);
    let pWin = 0, pDraw = 0, pLoss = 0, xGF = 0, xGA = 0;
    for (let gu = 0; gu <= 8; gu++) {
      xGF += gu * dpU[gu];
      for (let go = 0; go <= 8; go++) {
        const p = dpU[gu] * dpO[go];
        if (gu > go) pWin += p;
        else if (gu === go) pDraw += p;
        else pLoss += p;
      }
    }
    for (let go = 0; go <= 8; go++) xGA += go * dpO[go];

    const possPct = (rU.duelProb / Math.max(0.01, rU.duelProb + rO.duelProb)) * 100;
    return {
      winPct: U.roundTo(pWin * 100, 1),
      drawPct: U.roundTo(pDraw * 100, 1),
      lossPct: U.roundTo(pLoss * 100, 1),
      xPts: U.roundTo(pWin * 3 + pDraw, 3),
      xGF: U.roundTo(xGF, 2),
      xGA: U.roundTo(xGA, 2),
      possPct: U.roundTo(possPct, 1),
      uShots: U.roundTo(nPerSide * rU.shotProb, 1),
      oShots: U.roundTo(nPerSide * rO.shotProb, 1),
      effAtkUser: U.roundTo(uAtk, 1),
      effAtkOpp: U.roundTo(oAtk, 1),
    };
  }

  // Bytecode #24016 chooseAITactics:
  // - diff = oppTop11ForceAvg - userTop11ForceAvg (TIDAK ADA bonus kandang ±1.5!)
  // - diff <= -4: velDefCount >= 2 ? 'Counter-Attack' : 'Balanced' (velDefCount = non-G/ZD/ZE dengan VEL)
  // - diff >= 6: 'Offensive' (60% chance) / 'Balanced' (40%)
  // - -4 < diff < 6: velDefCount >= 3 ? 'Balanced (30% Counter)' : 'Balanced'
  // - attackFocus: count(pos in ['LD','LE','PD','PE'] && has CRU) >= 2 ? 'Wings' : 'Center'
  function predictAiTacticsDetail(oppForce, userForce, oppIsHome = false, oppXiPlayers = null) {
    const diff = oppForce - userForce;
    let velDefCount = 0;
    let wingCruCount = 0;
    let centerTags = 0;
    const wingNames = [];
    const centerNames = [];

    for (const p of (oppXiPlayers || [])) {
      const pos = p.pos || '';
      const s1 = p.s1 || '';
      const s2 = p.s2 || '';
      if (!['G', 'ZD', 'ZE', 'ZAG', 'Z'].includes(pos) && (s1 === 'VEL' || s2 === 'VEL')) {
        velDefCount++;
      }
      if (['LD', 'LE', 'LAT', 'PD', 'PE'].includes(pos) && (s1 === 'CRU' || s2 === 'CRU')) {
        wingCruCount++;
        if (wingNames.length < 3) wingNames.push(`${p.name || U.posEn(pos)}(CRS)`);
      }
      if (['VOL', 'V', 'MC', 'MA', 'MO', 'MEI', 'SA', 'ATA', 'A'].includes(pos) && (s1 === 'PAS' || s2 === 'PAS' || s1 === 'ARM' || s2 === 'ARM')) {
        centerTags++;
        if (centerNames.length < 3) centerNames.push(`${p.name || U.posEn(pos)}(${U.skillEn(s1)})`);
      }
    }

    let aiStyle = 'Balanced';
    let styleReason = `Selisih Force Top-11 (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}) di rentang -4 s.d. +6 (#24016) → AI memilih Balanced`;
    if (diff >= 6.0) {
      aiStyle = 'Offensive';
      styleReason = `Lawan unggul Force +${diff.toFixed(1)} (≥ +6.0 di #24016) → AI 60% pilih Offensive (+8% ATK, -8% DEF) / 40% Balanced`;
    } else if (diff <= -4.0) {
      if (velDefCount >= 2) {
        aiStyle = 'Counter-Attack';
        styleReason = `Lawan kalah Force ${diff.toFixed(1)} (≤ -4.0) & punya ${velDefCount} pemain cepat VEL (≥2) → AI otomatis Counter-Attack (-6% MID, +7% konversi)`;
      } else {
        aiStyle = 'Balanced';
        styleReason = `Lawan kalah Force ${diff.toFixed(1)} (≤ -4.0) tapi hanya punya ${velDefCount} pemain VEL (<2) → AI tetap Balanced (#24016)`;
      }
    } else if (velDefCount >= 3) {
      aiStyle = 'Balanced';
      styleReason = `Selisih Force berimbang (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}), punya ${velDefCount} pemain VEL (≥3) → AI 70% Balanced / 30% Counter-Attack`;
    }

    let aiFocus = 'Center';
    let focusReason = `Pemain sayap (LD/LE/PD/PE) ber-skill CRS hanya ${wingCruCount} (< 2 di #24016) → AI otomatis fokus Center`;
    if (wingCruCount >= 2) {
      aiFocus = 'Wings';
      focusReason = `Lawan punya ${wingCruCount} pemain LD/LE/PD/PE ber-skill CRS (≥ 2 di #24016: ${wingNames.join(', ')}) → AI otomatis fokus Wings`;
    }

    let counterTip = 'Balanced';
    if (aiStyle === 'Offensive') {
      counterTip = 'Counter-Attack (+7% konversi peluang vs DEF lawan yang terbuka -8%)';
    } else if (aiStyle === 'Counter-Attack') {
      counterTip = 'Dominasi MID + Offensive (+8% ATK untuk membongkar lawan yang melepas -6% MID)';
    } else {
      counterTip = 'Dominasi H2H Lini Tengah (3-5-2 / 4-5-1) + Marking Heavy';
    }

    return {
      aiStyle,
      aiFocus,
      diff: U.roundTo(diff, 1),
      wingTags: wingCruCount,
      centerTags,
      velDefCount,
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
    const oppFocus = oppAi.aiFocus || 'Center';
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

      // Evaluasi kedua opsi Attack Focus (#21822): Center (0.8*ATK + 0.2*MID) vs Wings (+2%/crosser)
      const simC = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Center', oppFocus, style: trialStyle, oppStyle,
      });
      const simW = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Wings', oppFocus, style: trialStyle, oppStyle,
      });
      const optFocus = simC.xPts >= simW.xPts ? 'Center' : 'Wings';
      const sim = optFocus === 'Center' ? simC : simW;

      const effAtk = sim.effAtkUser;
      const atkVsDef = effAtk - oppPow.DEF;
      const midVsMid = uPow.MID - oppPow.MID;
      const defVsAtk = uPow.DEF - oppPow.ATK;

      // Penalti untuk bug #34992 (3-4-3 membuang slot ke-11 ke sektor 'X') & wrong-foot fullback
      const bugPenalty = res.hasFormationBug ? -18.0 : 0.0;
      const wfPenalty = res.wrongFootCount * 0.45;
      const h2hScore = sim.xPts * 40.0 + res.avgScore * 0.05 - wfPenalty + bugPenalty;

      const mods = (C.FORMATION_MODS && C.FORMATION_MODS[fk]) || { atkMod: 0, defMod: 0 };
      const enginePow = {
        ...uPow,
        ATK: effAtk,
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
        matchupScore: U.roundTo(sim.winPct - sim.lossPct, 1),
        winPct: sim.winPct,
        drawPct: sim.drawPct,
        lossPct: sim.lossPct,
        xPts: sim.xPts,
        xGF: sim.xGF,
        xGA: sim.xGA,
        possPct: sim.possPct,
        uShots: sim.uShots,
        oShots: sim.oShots,
        optFocus,
        optStyle: trialStyle,
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

    // Uji 3 Play Style resmi pada formasi terbaik via Markov #48031
    const bestXiObj = solveBestXi(userRoster, best.formation, foreignCap, userCountry, excludeForRec, safeRotate, repLevel);
    const bestMark = (recEdge >= 4.0 && !isKnockout && !isBig) ? 'Light' : 'Heavy';
    const styleSims = {};
    for (const stTry of ['Balanced', 'Offensive', 'Counter-Attack']) {
      const pTry = computeEngineSectorPower(bestXiObj, best.formation, {
        isHome, crowdOver70: true, style: stTry, marking: bestMark,
      });
      styleSims[stTry] = simulateMatchExpectation(pTry, oppPow, {
        isHome, neutral: false, focus: best.optFocus, oppFocus, style: stTry, oppStyle: finalAi.aiStyle,
      });
    }

    let recStyle = 'Balanced';
    let bestStylePts = styleSims.Balanced.xPts;
    if (styleSims.Offensive.xPts >= bestStylePts + 0.012) {
      recStyle = 'Offensive';
      bestStylePts = styleSims.Offensive.xPts;
    }
    if (styleSims['Counter-Attack'].xPts >= bestStylePts + 0.012) {
      recStyle = 'Counter-Attack';
    }

    let recStyleWhy = '';
    if (recStyle === 'Counter-Attack') {
      recStyleWhy = `Uji simulasi memberi ekspektasi poin tertinggi (${styleSims['Counter-Attack'].winPct}% Win) vs AI ${finalAi.aiStyle}: +6..12% bonus konversi peluang sangat efektif saat transisi cepat.`;
    } else if (recStyle === 'Offensive') {
      recStyleWhy = `Uji simulasi unggul di Offensive (${styleSims.Offensive.winPct}% Win, xG ${styleSims.Offensive.xGF} vs Balanced ${styleSims.Balanced.xGF}): +8% ATK memaksimalkan volume gol tanpa mengorbankan dominasi MID.`;
    } else if (finalAi.aiStyle === 'Offensive') {
      recStyleWhy = `Lawan diprediksi Offensive (+8% ATK, -8% DEF). Balanced menjaga DEF tetap rapat; siapkan Counter-Attack jika tertekan.`;
    } else {
      recStyleWhy = `Balanced paling stabil (${styleSims.Balanced.winPct}% Win · ${styleSims.Balanced.drawPct}% Seri · xPts ${styleSims.Balanced.xPts}) — menjaga 3 sektor tanpa penalti -8% DEF (Offensive) maupun -6% MID (Counter).`;
    }

    // Attack Focus (#21822 effectiveSectors): Center (20% MID -> ATK) vs Wings (+2%/crosser)
    const recFocus = best.optFocus;
    let recFocusWhy = '';
    if (recFocus === 'Center') {
      const bonus = U.roundTo(best.uPow.atkCenter - best.uPow.rawATK, 1);
      recFocusWhy = `Center (#21822 centerBlend 20% MID → ATK) menaikkan ATK efektif dari ${best.uPow.rawATK} menjadi ${best.uPow.atkCenter} (${bonus >= 0 ? '+' : ''}${bonus}) berkat kekuatan MID ${best.uPow.MID}, lebih tinggi dari Wings (${best.uPow.atkWings}).`;
    } else {
      recFocusWhy = `Wings lebih unggul (ATK efektif ${best.uPow.atkWings} dengan ${best.uPow.wingCrossers} crosser CRU vs Center ${best.uPow.atkCenter} yang tertarik turun oleh MID ${best.uPow.MID}).`;
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
        shout: recEdge >= 0 ? 'Encourage (Incentivar)' : 'Tighten Up (Fechar Atrás)',
        why: recEdge >= 0
          ? '+1.2% MID selama 15 menit (#3640) untuk memenangkan duel penguasaan bola & shot attempt.'
          : '+1.2% DEF selama 15 menit (#3640) untuk meredam peluang gol awal lawan.',
      },
      {
        phase: 'Babak 2 — Jika Unggul (Menit 65+)',
        shout: 'Focus (Concentrar) + Order Defend Lead',
        why: 'Focus memberi +1.2% DEF (bebas decay pengulangan 25m jika bergantian dengan Tighten Up) + Order Defend Lead (+4% DEF, -3% ATK) + gunakan 5 kuota sub (#21779) untuk pemain <60% energi.',
      },
      {
        phase: 'Babak 2 — Jika Imbang/Tertinggal (Menit 75+)',
        shout: 'Attack More (Atacar Mais) + Order All-Out Attack',
        why: '+1.2% ATK dari shout + Order All-Out Attack (+8% ATK, -7% DEF) + masukkan Supersub PAC/FIN segar.',
      },
    ];

    const keepActive = best.formation === activeFormation;
    const scoreGain = U.roundTo(Math.max(0, best.winPct - activeComp.winPct), 1);
    const ptsGain = U.roundTo(Math.max(0, best.xPts - activeComp.xPts), 2);
    const reasons = [
      `Peluang Simulasi (#48031): ${best.winPct}% Menang · ${best.drawPct}% Seri · ${best.lossPct}% Kalah (xG ${best.xGF}–${best.xGA} · Ball ${best.possPct}%)`,
      `Duel Sektor Engine (#21822): MID ${best.midVsMid >= 0 ? '+' : ''}${best.midVsMid} (Penentu Ball/Shot!) · ATK vs DEF ${best.atkVsDef >= 0 ? '+' : ''}${best.atkVsDef} · DEF vs ATK ${best.defVsAtk >= 0 ? '+' : ''}${best.defVsAtk}`,
      best.wrongFootCount === 0
        ? `Bebas penalti salah kaki Fullback (-5%) · Chemistry ${best.chemistry}/100`
        : `Terdapat ${best.wrongFootCount} slot Fullback salah kaki (-5%) · Chemistry ${best.chemistry}/100`,
    ];

    const refereePlan = {
      strict: {
        marking: 'Light (0%)',
        badge: 'b-info',
        note: 'Wasit Ketat (#21836: +20% risiko pelanggaran/kartu, foulMul 1.20x): pakai Light (0%) atau Order Stay Calm (-25% kartu).',
      },
      normal: {
        marking: recMarking,
        badge: recMarking.includes('Very') ? 'b-warn' : (recMarking.includes('Heavy') ? 'b-good' : 'b-info'),
        note: recMarkingWhy,
      },
      lenient: {
        marking: (isKnockout || isBig || recEdge <= 0) ? 'Very Heavy (+8% DEF)' : 'Heavy (+4% DEF)',
        badge: 'b-good',
        note: 'Wasit Longgar (#21836: -18% risiko kartu, foulMul 0.82x): manfaatkan untuk menaikkan marking demi +4% s.d. +8% DEF!',
      },
    };

    const weatherPlan = {
      clear: {
        label: '☀️ Cerah (Normal)',
        note: 'Kondisi ideal — jalankan fokus serangan & manfaatkan hingga 5 pergantian pemain (#21779) saat energi <60%.',
      },
      rain: {
        label: '🌧️ Hujan (+12% Miss, +8% Kartu)',
        note: 'Di #21837/#21838, hujan menaikkan missMul 1.12x (+12% tembakan meleset) & foulMul 1.08x: prioritaskan volume peluang (MID tinggi) & bola mati.',
      },
      heat: {
        label: '🔥 Panas (+12% Kuras Stamina)',
        note: 'Di #21839, cuaca panas menaikkan energyDrainMul 1.12x (+12% kuras energi; Altitude juga +18%): rotasikan 5 sub lebih awal mulai menit 55!',
      },
      snow: {
        label: '❄️ Salju (+18% Miss, +5% Kuras Stamina)',
        note: 'Di #21837/#21839, salju menaikkan missMul 1.18x & energyDrainMul 1.05x: kurangi spekulasi jarak jauh dan jaga kesegaran lini tengah.',
      },
    };

    const halftimePlan = {
      win: "Unggul di HT (#3642): Pilih 'Praise (Elogiar)' (+1.5% DEF & +1.5% MID selama 20 menit babak ke-2) atau 'Calm' jika unggul ≥2 gol (+2% DEF, -15% kartu).",
      draw: "Seri di HT (#3642): Pilih 'Demand More (Cobrar)' (+2.0% ATK & +1.0% MID selama 20 menit babak ke-2).",
      lose: "Tertinggal di HT (#3642): Pilih 'Motivate (Motivar)' (+2.0% MID & +2.0% ATK selama 20 menit jika tertinggal) + siapkan 5 kuota sub!",
    };

    const top3List = candidates.slice(0, 3).map(c => ({
      formation: c.formation,
      h2hScore: c.h2hScore,
      matchupScore: c.matchupScore,
      winPct: c.winPct,
      drawPct: c.drawPct,
      lossPct: c.lossPct,
      xPts: c.xPts,
      xGF: c.xGF,
      xGA: c.xGA,
      possPct: c.possPct,
      optFocus: c.optFocus,
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
      ptsGain,
      reasons,
      top3: top3List,
      top3Formations: top3List,
      allCandidates: candidates.map(c => ({
        formation: c.formation,
        winPct: c.winPct,
        drawPct: c.drawPct,
        lossPct: c.lossPct,
        xPts: c.xPts,
        xGF: c.xGF,
        xGA: c.xGA,
        possPct: c.possPct,
        optFocus: c.optFocus,
        dMid: c.dMid,
        dAtk: c.dAtk,
        dDef: c.dDef,
        h2hScore: c.h2hScore,
        avgScore: c.avgScore,
        wrongFootCount: c.wrongFootCount,
        hasFormationBug: c.hasFormationBug,
      })),
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
  // Bytecode #24059–#24064, #24136, #24715:
  // Transfer Policy, Buyer Force Ceiling, Refuses Distance, & Bosman Guard
  // =========================================================================

  // Bytecode #24059 buyerForceCeiling: Math.max(repCap, divCap, avgTop11 + 8) + ctCeilingBonus
  function buyerForceCeiling(rep = 60, division = 1, avgTop11 = 0, ctLevel = 1) {
    const rLv = U.reputationLevel(rep);
    const repCap = (C.REP_CEILING && C.REP_CEILING[rLv] !== undefined) ? C.REP_CEILING[rLv] : 45;
    const div = U.clamp(U.safeInt(division, 1), 0, 5);
    const divCap = (C.DIV_CEILING && C.DIV_CEILING[div] !== undefined) ? C.DIV_CEILING[div] : 60;
    const squadCap = U.safeNum(avgTop11, 0) > 0 ? Math.round(U.safeNum(avgTop11, 0) + 8) : 0;
    const ctBonus = U.safeInt(ctLevel, 1) >= 10 ? 3 : 0; // #21426: CT L10 ceilingBonus = +3
    return Math.max(repCap, divCap, squadCap) + ctBonus;
  }

  // Bytecode #24061 transferPolicy (#3695 SELLER_STANCE: listed 0.90x, topStar <=27 1.35x, top3 1.25x, starter 1.10x, scarce 1.15x)
  function transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers = null, posCount = null, playerRankInClub = 99) {
    if (!p || !sellerCountry) return { status: 'OK', mult: 1.0, reason: null };

    const sPlayers = Array.isArray(sellerPlayers) ? sellerPlayers : [];
    const samePosCount = posCount !== null && posCount !== undefined
      ? posCount
      : sPlayers.filter(x => x.pos === p.pos && !x.injured).length;

    if (p.pos === 'G' && samePosCount <= 1) {
      return { status: 'REFUSE', mult: 2.0, reason: 'onlyGoalkeeper' };
    }

    const age = U.safeInt(p.age, 24);
    const isTopOrStar = Boolean(p.top || p.star || p.starAwarded);
    const isTop3 = U.safeInt(playerRankInClub, 99) <= 3;
    const isStarter = U.safeInt(playerRankInClub, 99) <= 11;
    const isYoungStar = Boolean(age <= 22 && ((p.potential || 0) >= (p.force || 0) + 10 || (p.hash || 0) >= 8 || isTopOrStar));
    const isKeyTop = Boolean(isTopOrStar || isTop3);

    if (p.forSale) {
      return {
        status: 'OK',
        mult: 0.90,
        reason: null,
        isKeyTop,
        isYoungStar,
      };
    }

    let mult = 1.0;
    if (isTopOrStar && age <= 27) mult = 1.35;
    else if (isTop3) mult = 1.25;
    else if (isStarter) mult = 1.10;

    if (samePosCount <= 2) mult *= 1.15;

    return {
      status: 'OK',
      mult: U.roundTo(Math.min(2.5, mult), 2),
      reason: null,
      isKeyTop,
      isYoungStar,
    };
  }

  // Bytecode #24060 refusesDistance
  // gS===0 && gB>0 -> sL>=7 && bL+1<sL && !aff && !homeReturn && age<32
  // gS!==gB && !aff && !homeReturn -> sL>=7 && (sL - bL) >= 2 && age<30
  function refusesDistance(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel) {
    if (!buyerCountry || !sellerCountry) return false;
    if (U.sameCountry(sellerCountry, buyerCountry)) return false;

    const bLv = U.safeInt(buyerLevel, 7);
    const sLv = U.safeInt(sellerLevel, 7);
    const age = U.safeInt(p && p.age, 25);
    const pNat = String((p && p.nationality) || '').toUpperCase();

    const homeReturn = Boolean(pNat && U.sameCountry(pNat, buyerCountry));
    const aff = U.hasAffinity(sellerCountry, buyerCountry) || Boolean(pNat && U.hasAffinity(pNat, buyerCountry));
    const gSeller = U.countryGroup(sellerCountry);
    const gBuyer = U.countryGroup(buyerCountry);

    if (gSeller === 0 && gBuyer > 0) {
      if (sLv >= 7 && (bLv + 1) < sLv && !aff && !homeReturn && age < 32) {
        return true;
      }
    }
    if (gSeller !== gBuyer && !aff && !homeReturn) {
      if (sLv >= 7 && (sLv - bLv) >= 2 && age < 30) {
        return true;
      }
    }
    return false;
  }

  // Bytecode #24062 userBuyPolicy
  function userBuyPolicy(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, buyerRep, buyerDiv, sellerPlayers = null, posCount = null, isUnattached = false, extra = null) {
    const ex = (extra && typeof extra === 'object') ? extra : {};
    const rankInClub = U.safeInt(ex.rankInClub, 99);
    const avgTop11 = U.safeNum(ex.avgTop11, 0);
    const ctLevel = U.safeInt(ex.ctLevel, 1);

    const pol = isUnattached
      ? { status: 'OK', mult: 1.0, reason: null, isKeyTop: Boolean(p.top || p.star), isYoungStar: false }
      : transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers, posCount, rankInClub);
    if (pol.status === 'REFUSE') return pol;

    const sLv = isUnattached ? U.clamp(Math.round(((p.force || 50) - 18) / 7), 1, 10) : U.safeInt(sellerLevel, 7);
    const bLv = U.safeInt(buyerLevel, 7);
    const sCountry = isUnattached ? (p.nationality || '') : sellerCountry;

    if (!isUnattached && refusesDistance(p, sCountry, buyerCountry, sLv, bLv)) {
      return { status: 'REFUSE', mult: 2.0, reason: 'distanceOrLeague', code: 'REFUSE_DIST', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
    }

    const gap = sLv - bLv;
    const age = U.safeInt(p && p.age, 25);
    const isTopOrStar = Boolean(p && (p.top || p.star || p.starAwarded));
    const isUnhappy = Boolean(ex.isUnhappy || (p && p.mood === 'unhappy'));

    if (!p.forSale && !isUnhappy) {
      if (gap >= 3 && age < 29) {
        return { status: 'REFUSE', mult: 2.0, reason: 'clubLevelLow', code: 'REFUSE_LVL', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
      }
      if (gap >= 2 && isTopOrStar && age < 28) {
        return { status: 'REFUSE', mult: 2.0, reason: 'ambition', code: 'REFUSE_LVL', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
      }
    }

    const ceil = buyerForceCeiling(buyerRep, buyerDiv, avgTop11, ctLevel);
    let ceilMult = 1.0;
    if ((p.force || 0) > ceil) {
      if (!p.forSale && !isUnhappy && (p.force || 0) > ceil + 5) {
        return { status: 'REFUSE', mult: 2.0, reason: 'clubStatusLow', code: 'REFUSE_LVL', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
      }
      ceilMult = 2.0;
    }

    return {
      status: 'OK',
      mult: U.roundTo(Math.min(3.5, Math.max(pol.mult, ceilMult)), 2),
      reason: null,
      code: ceilMult > 1.0 ? 'CEIL_2X' : 'OK',
      ceilMult,
      isKeyTop: pol.isKeyTop,
      isYoungStar: pol.isYoungStar,
    };
  }

  // Bytecode #24064 buyPersuadable: tawaran >= 1.5x MV memberi slack +2 pada buyerLevel & +4 pada ceiling!
  function buyPersuadable(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, pol, extra = null) {
    if (!pol || pol.status !== 'REFUSE') return false;
    if (pol.reason === 'onlyGoalkeeper' || pol.reason === 'domesticRival') return false;
    const ex = (extra && typeof extra === 'object') ? extra : {};
    const bLv = U.safeInt(buyerLevel, 7) + 2;
    const sLv = U.safeInt(sellerLevel, 7);
    const age = U.safeInt(p && p.age, 25);
    const isTopOrStar = Boolean(p && (p.top || p.star || p.starAwarded));

    if (refusesDistance(p, sellerCountry, buyerCountry, sLv, bLv)) return false;
    const gap = sLv - bLv;
    if (gap >= 3 && age < 29) return false;
    if (gap >= 2 && isTopOrStar && age < 28) return false;

    if (ex.buyerRep !== undefined) {
      const ceil = buyerForceCeiling(ex.buyerRep, ex.buyerDiv || 1, ex.avgTop11 || 0, ex.ctLevel || 1) + 4;
      if ((p.force || 0) > ceil + 5) return false;
    }
    return true;
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
    simulateMatchExpectation,
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
