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
  /**
   * Bytecode #36792 (pv / sectorSkillBonus) OTA 2.1.0:
   * Evaluasi bonus skill murni berdasarkan sektor TARGET slot ('G'|'D'|'M'|'A'|'X').
   * - 'G' / 'X': 0% bonus sektor (REF/COL hanya memengaruhi keeperSaveMul #22455).
   * - 'D': (DES||MAR)+5%, VEL+2%, CAB+4%
   * - 'M': (PAS||ARM)+3%, DRI+2%
   * - 'A': VEL+2%, DRI+3%, CAB+3%
   */
  function evalSkillStackingForSector(sectorCode, s1Raw, s2Raw) {
    const sec = String(sectorCode || 'M').toUpperCase();
    const s1 = String(s1Raw || '').trim().toUpperCase();
    const s2 = String(s2Raw || '').trim().toUpperCase();
    const skills = new Set([s1, s2].filter(Boolean));
    let bonus = 1.0;
    if (sec === 'D') {
      if (skills.has('DES') || skills.has('MAR')) bonus *= 1.05;
      if (skills.has('VEL')) bonus *= 1.02;
      if (skills.has('CAB')) bonus *= 1.04;
    } else if (sec === 'M') {
      if (skills.has('PAS') || skills.has('ARM')) bonus *= 1.03;
      if (skills.has('DRI')) bonus *= 1.02;
    } else if (sec === 'A') {
      if (skills.has('VEL')) bonus *= 1.02;
      if (skills.has('DRI')) bonus *= 1.03;
      if (skills.has('CAB')) bonus *= 1.03;
    }
    return {
      mul: bonus,
      stackPct: U.roundTo((bonus - 1.0) * 100, 2),
    };
  }

  /**
   * Bytecode #35011, #21893, #36792: Evaluasi badge skill di Roster / UI.
   * - GK: REF/COL (+4% s1, +2% s2 Save), SAI (+2% s1, +1% s2 Save). Tidak menambah sector power.
   */
  function evalSkillStacking(posCode, s1Raw, s2Raw) {
    const pos = String(posCode || 'MC').toUpperCase();
    const cat = (C.EXACT_CAT && (pos in C.EXACT_CAT)) ? C.EXACT_CAT[pos] : U.posCategory(pos);
    const s1 = String(s1Raw || '').trim().toUpperCase();
    const s2 = String(s2Raw || '').trim().toUpperCase();
    const skills = new Set([s1, s2].filter(Boolean));

    if (cat === 0) {
      let saveBonus = 1.0;
      const notes = [];
      if (s1 === 'REF' || s1 === 'COL') {
        saveBonus *= 1.04;
        notes.push(`${U.skillEn(s1)}(s1)+4%Save`);
      } else if (s1 === 'SAI') {
        saveBonus *= 1.02;
        notes.push('RUS(s1)+2%Save'); // #22455 keeperSaveMul: s1 SAI = +2% save
      }
      if (s2 === 'REF' || s2 === 'COL') {
        saveBonus *= 1.02;
        notes.push(`${U.skillEn(s2)}(s2)+2%Save`);
      } else if (s2 === 'SAI') {
        saveBonus *= 1.01;
        notes.push('RUS(s2)+1%Save'); // #22455 keeperSaveMul: s2 SAI = +1% save
      }
      if (skills.has('DPE') || skills.has('PEN')) notes.push('PEN(+8% penalti)');
      const pct = U.roundTo((saveBonus - 1.0) * 100, 2);
      const grade = pct >= 5.0 ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD');
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
   * Bytecode #21754, #21757 & #3726: Simulasi `squadMoods` v1.2.0:
   * - Tier natural (hanya pemain fit !injured && !suspended, serta age > 19):
   *   - Tier 2 (natural starter, 40%): Top 1 GK + Top 10 Outfield
   *   - Tier 1 (natural sub, 8%): Outfield indeks 10..16 (7 pemain berikutnya) dengan age > 19
   *   - Tier 0 (0%, kebal di mode auto): sisanya, termasuk pemain dengan age <= 19!
   * - Role eksplisit: roleSore / 'starter' -> 40%; 'rotation' -> cap Math.min(tier, 1) (8%);
   *   'youth' -> 0% jika age<=19 else cap Math.min(tier, 1); 'reserve' -> 0% (kecuali roleSore=true di save)
   * - moodFrom: [baseTeamGames, baseSeasonMinutes, baseGamesPlayed] dikurangkan dari teamGames & seasonMinutes
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

    const computedTeamGames = Math.max(
      0,
      ...roster.map(p => Math.max(U.safeInt(p.gamesPlayed, 0), Math.ceil(U.safeNum(p.seasonMinutes, 0) / 90.0)))
    );
    const teamGames = explicitTeamGames !== null && explicitTeamGames !== undefined
      ? Math.max(0, U.safeInt(explicitTeamGames, 0))
      : computedTeamGames;

    const moods = {};
    let unhappyCount = 0;

    for (const p of roster) {
      const pid = p.id;
      const naturalStarter = tier2Ids.has(pid);
      const naturalSub = tier1Ids.has(pid);

      let tier = 0;
      if ((p.age || 20) > 19) {
        if (naturalStarter) tier = 2;
        else if (naturalSub) tier = 1;
      }

      const role = String(p.squadRole || 'auto').toLowerCase();
      const mf = (Array.isArray(p.moodFrom) && p.moodFrom.length >= 2) ? p.moodFrom : null;
      const baseGames = mf ? Math.min(teamGames, Math.max(0, U.safeInt(mf[0], 0))) : 0;
      const baseMins = mf ? Math.max(0, U.safeNum(mf[1], 0)) : 0;
      const minsNow = Math.max(0, Math.round(U.safeNum(p.seasonMinutes, 0) - baseMins));
      const injDays = U.safeInt(p.seasonInjuryDays, 0);
      const injGames = Math.floor(injDays / 4); // #3726 injuryDaysPerGame = 4
      const remGames = Math.max(0, teamGames - baseGames);
      const effGames = Math.max(0, remGames - Math.min(remGames, injGames));
      const minRatio = effGames > 0 ? (minsNow / (effGames * 90.0)) : 1.0;

      const roleSore = Boolean(p.roleSore);
      const raiseSore = Boolean(p.raiseSore);
      const mc = C.MOOD_CFG || {};
      const natStarterQuota = mc.starterQuota !== undefined ? mc.starterQuota : 0.25;
      const expStarterQuota = mc.explicitStarterQuota !== undefined ? mc.explicitStarterQuota : 0.40;
      const youngQuota = mc.youngQuota !== undefined ? mc.youngQuota : 0.08;
      let reqRatio = 0.0;
      let immune = false;
      let reason = 'Aman';

      if (p.injured || p.suspended) {
        immune = true;
        reason = p.injured ? 'Cedera (kebal sementara)' : 'Skorsing';
      } else if (roleSore) {
        reqRatio = expStarterQuota;
        reason = 'Menolak turun role (roleSore, wajib 40% menit)';
      } else if (role === 'starter') {
        reqRatio = expStarterQuota;
      } else if (role === 'reserve') {
        immune = true;
        reqRatio = 0.0;
        reason = 'Role Reserve (Kebal Unhappy)';
      } else if (role === 'rotation') {
        const rotTier = Math.min(tier, 1);
        if (rotTier >= 1) {
          reqRatio = youngQuota;
        } else {
          immune = true;
          reqRatio = 0.0;
          reason = 'Role Rotation (Kebal Unhappy)';
        }
      } else if (role === 'youth') {
        reqRatio = (p.age || 20) <= 19 ? 0.0 : (Math.min(tier, 1) >= 1 ? youngQuota : 0.0);
        if (reqRatio === 0.0) immune = true;
      } else {
        if (tier === 2) reqRatio = natStarterQuota;
        else if (tier === 1) reqRatio = youngQuota;
        else {
          reqRatio = 0.0;
          immune = true;
        }
      }

      const minsReq = Math.ceil(reqRatio * effGames * 90);
      const minsDeficit = Math.max(0, minsReq - minsNow);
      const gamesDeficit = Math.ceil(minsDeficit / 90.0);

      let mood = 'ok';
      let nearQuota = false;
      if (!immune && teamGames >= 6 && effGames >= 6 && reqRatio > 0 && minRatio < reqRatio) {
        mood = 'unhappy';
        unhappyCount++;
        reason = `Menit kurang (${Math.round(minRatio * 100)}% < ${Math.round(reqRatio * 100)}%, kurang ${minsDeficit} mnt / ~${gamesDeficit} laga)`;
      } else if (!immune && teamGames >= 6 && effGames >= 6 && (
        (tier === 2 && minRatio >= (mc.happyTop || 0.60))
        || (tier === 1 && minRatio >= (mc.happySub || 0.35))
        || (tier === 0 && minRatio >= (mc.happyRes || 0.15))
      )) {
        mood = 'happy';
        reason = `Bahagia (${Math.round(minRatio * 100)}% menit main)`;
      } else if (!immune && teamGames >= 6 && effGames >= 6 && reqRatio > 0 && minRatio < reqRatio + 0.05) {
        nearQuota = true;
        reason = `Ambang batas menit (${Math.round(minRatio * 100)}% / target ${Math.round(reqRatio * 100)}%)`;
      }

      // OTA 2.1.0 (#22494 squadMoods & #25354 answerRaise): tolak minta naik gaji -> p.raiseSore memaksa UNHAPPY
      if (raiseSore) {
        if (mood !== 'unhappy') {
          mood = 'unhappy';
          unhappyCount++;
          nearQuota = false;
          reason = 'Kecewa kenaikan gaji ditolak (raiseSore — UNHAPPY)';
        } else {
          reason = `raiseSore · ${reason}`;
        }
      }

      moods[pid] = {
        mood,
        nearQuota,
        tier,
        minPct: U.roundTo(minRatio * 100.0, 1),
        reqPct: U.roundTo(reqRatio * 100.0, 1),
        immune,
        roleSore,
        raiseSore,
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
      if (Array.isArray(ri.exact) && ri.exact.includes(playerPos)) {
        return 1.00;
      }
      const pCat5 = (C.EXACT_CAT && (playerPos in C.EXACT_CAT)) ? C.EXACT_CAT[playerPos] : U.posCategory(playerPos);
      return pCat5 === ri.cat ? 1.00 : 0.70;
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
    const pCat5 = (C.EXACT_CAT && (playerPos in C.EXACT_CAT)) ? C.EXACT_CAT[playerPos] : U.posCategory(playerPos);
    const tCat5 = (C.EXACT_CAT && (targetSlot in C.EXACT_CAT)) ? C.EXACT_CAT[targetSlot] : U.posCategory(targetSlot);
    return pCat5 === tCat5 ? 1.00 : 0.70;
  }

  function isPlayerStar(p) {
    return Boolean(p && (p.star || p.top || p.starAwarded));
  }

  /**
   * Bytecode #21807, #21813, #21826, #35201: Evaluasi kontribusi efektif pemain pada slot formasi.
   */
  /**
   * Bytecode #22444 & #36792 (OTA 2.1.0): Evaluasi kontribusi efektif pemain pada slot formasi.
   * - Skill stacking dihitung dari sektor TARGET slot (bukan posisi alami pemain).
   * - isPlayerStar dicek sebelum p.top -> starMul = 1.05 (rep >= 70) / 1.02.
   * - humanBoost = isHuman ? 1.05 : 1.00 (berlaku flat untuk tim user saja, tidak digate OOP).
   */
  function evalPlayerForSlot(p, targetSlot, includeEnergy = true, repLevel = 3, ruleId = null, isHuman = true) {
    const compat = slotCompatFactor(p.pos, targetSlot, ruleId);

    // #22444: wrongFoot (-5%) dicek pada slot dengan category===1 & side 'D' atau 'E' (termasuk wildcard 10/17)
    let wrongFoot = false;
    const foot = (p.foot || 'D').toUpperCase();
    let checkSide = null;
    const ri = (ruleId !== null && ruleId !== undefined && C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleId])
      ? C.RULE_SLOT_INFO[ruleId] : null;
    if (ri) {
      if (ri.cat === 1 && ri.side) checkSide = ri.side;
    } else if (targetSlot === 'LD') {
      checkSide = 'D';
    } else if (targetSlot === 'LE') {
      checkSide = 'E';
    }
    if (checkSide === 'D' && foot !== 'D' && foot !== 'A') wrongFoot = true;
    else if (checkSide === 'E' && foot !== 'E' && foot !== 'A') wrongFoot = true;
    const footMul = wrongFoot ? 0.95 : 1.00;

    // #36792: skill bonus dihitung berdasarkan sektor TARGET slot ('G'|'D'|'M'|'A'|'X')
    let targetSec = ri ? ri.sec : null;
    if (!targetSec) {
      const tCat5 = (C.EXACT_CAT && (targetSlot in C.EXACT_CAT)) ? C.EXACT_CAT[targetSlot] : U.posCategory(targetSlot);
      targetSec = tCat5 === 0 ? 'G' : (tCat5 <= 2 ? 'D' : (tCat5 === 3 ? 'M' : 'A'));
    }
    const stackBonus = evalSkillStackingForSector(targetSec, p.s1, p.s2).stackPct;

    // #22444 OTA 2.1.0: isPlayerStar dicek sebelum p.top -> cap 1.05 (repLevel > 3 / rep >= 70) / 1.02
    let starMul = 1.00;
    if (isPlayerStar(p)) {
      starMul = repLevel > 3 ? 1.05 : 1.02;
    } else if (p && p.top) {
      starMul = repLevel > 3 ? 1.10 : 1.05;
    }

    // #22444: +5% flat untuk tim human saja (AI = 1.00), tidak bergantung OOP
    const humanBoostMul = isHuman ? 1.05 : 1.00;

    // #22444: pemain unhappy terkena * 0.97 (-3%)
    const moodMul = (p && p.mood === 'unhappy') ? 0.97 : 1.00;

    // #22444: fineSlump dibatasi maksimal 0.20 (lantai 0.80)
    const slumpVal = U.safeNum(p.fineSlump, 0.0);
    const slumpFrac = slumpVal <= 1.0 ? slumpVal : (slumpVal / 100.0);
    const slumpMul = slumpVal > 0 ? (1.0 - Math.min(0.20, slumpFrac)) : 1.00;

    // #22444: Continuous energyFactor = max(0.92, 1 - 0.001 * deficit), RES memotong deficit 40%
    let energyMul = 1.00;
    if (includeEnergy) {
      const en = U.clamp(U.safeNum(p.energy, 100), 0, 100);
      const hasRes = (p.s1 === 'RES' || p.s2 === 'RES');
      const deficit = (100.0 - en) * (hasRes ? 0.6 : 1.0);
      energyMul = Math.max(0.92, 1.0 - 0.001 * deficit);
    }

    const baseF = U.safeNum(p.effForce !== undefined ? p.effForce : p.force, 10.0);
    const score = baseF * compat * humanBoostMul * footMul * (1.0 + stackBonus / 100.0) * starMul * moodMul * slumpMul * energyMul;

    return {
      score,
      wrongFoot,
      compat,
    };
  }

  /**
   * Audit Set-Piece & Kapten (#22450, #23468, #36781 OTA 2.1.0):
   * - Captain (#22450): auto memilih starter tertua (sort by age desc, force desc — tanpa filter >=28);
   *   HANYA aktif saat Babak 2 & sedang tertinggal (+6% MID jika >=28th, +3% MID jika <28th) + kurangi kartu (-10% >=28th, -5% <28th).
   * - Penalty (#23468/#22450): s1==='FIN' (+8%), s2==='FIN' (+4%); auto hanya cek s1==='FIN' else outfield.
   * - Free Kick (#22450/#22454): hanya FIN (+2% konv); auto fallback sama dengan autoPk (hanya s1==='FIN'!).
   * - Corner (#22450/#22454): s1 CRU (+3% konv & +4 header), s2 CRU (+1.5% konv & +4 header); auto cek s1||s2 CRU.
   */
  function auditSetPieces(xiPlayers) {
    if (!xiPlayers || !xiPlayers.length) {
      return { captain: [], freeKick: [], corner: [], penalty: [], warnings: [], autoSame: {} };
    }

    const capRanked = [...xiPlayers].sort((a, b) => ((b.age || 0) - (a.age || 0)) || (b.force - a.force));

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

    // #23468 penaltyKickAdj: s1 FIN (+8%) > s2 FIN (+4%)
    const pkRanked = [...xiPlayers].sort((a, b) => {
      const finA = a.s1 === 'FIN' ? 2 : (a.s2 === 'FIN' ? 1 : 0);
      const finB = b.s1 === 'FIN' ? 2 : (b.s2 === 'FIN' ? 1 : 0);
      return (finB - finA) || (b.force - a.force);
    });

    // #22450 autoPk: hanya cek s1 === 'FIN', fallback pemain outfield pertama (pos !== 'G')
    const autoPk = [...xiPlayers].sort((a, b) => {
      const s1A = a.s1 === 'FIN' ? 2 : (a.pos !== 'G' ? 1 : 0);
      const s1B = b.s1 === 'FIN' ? 2 : (b.pos !== 'G' ? 1 : 0);
      return (s1B - s1A) || (b.force - a.force);
    });

    // #22450 L632 autoFk: memanggil resolver yang sama dengan autoPk (buta s2==='FIN'!)
    const autoFk = [...autoPk];

    // #22450 autoCk: cek s1 === 'CRU' || s2 === 'CRU' (tanpa membedakan s1 vs s2)
    const autoCk = [...xiPlayers].sort((a, b) => {
      const cA = (a.s1 === 'CRU' || a.s2 === 'CRU') ? 1 : 0;
      const cB = (b.s1 === 'CRU' || b.s2 === 'CRU') ? 1 : 0;
      return (cB - cA) || (b.force - a.force);
    });

    const warnings = [];
    if (pkRanked[0].id !== autoPk[0].id) {
      const gapNote = pkRanked[0].s1 === 'FIN' ? 's1 FIN (+8%)' : 'FIN slot 2 (+4%)';
      warnings.push(
        `Penalti (#22450/#23468): Auto memilih ${autoPk[0].name} (F${autoPk[0].force}), padahal ${pkRanked[0].name} (F${pkRanked[0].force}, ${U.skillEn(pkRanked[0].s1)}/${U.skillEn(pkRanked[0].s2)}) punya ${gapNote} — Auto hanya membaca s1==='FIN'!`
      );
    }
    if (fkRanked[0].id !== autoFk[0].id) {
      warnings.push(
        `Freekick (#22450): Auto fallback ke algo Penalti (${autoFk[0].name}), padahal ${fkRanked[0].name} punya FIN di slot 2 (+2% konversi FK). Set FK manual!`
      );
    }
    if (ckRanked[0].id !== autoCk[0].id) {
      warnings.push(
        `Corner (#22454): Set manual ke ${ckRanked[0].name} (${U.skillEn(ckRanked[0].s1)}/${U.skillEn(ckRanked[0].s2)}) karena CRS di slot 1 memberi +3% konversi (slot 2 hanya +1.5%).`
      );
    }
    if ((capRanked[0].age || 0) < 28) {
      warnings.push(
        `Kapten (#22450): Starter tertua ${capRanked[0].name} (${capRanked[0].age}th < 28th) hanya memberi +3% MID comeback & -5% kartu (≥28th memberi +6% comeback & -10% kartu).`
      );
    }

    const fmtTaker = (p, roleType) => {
      const sk = [U.skillEn(p.s1), U.skillEn(p.s2)].filter(Boolean).join('/');
      let reason = `F:${p.force}`;
      if (roleType === 'cap') {
        reason = (p.age >= 28)
          ? `Usia ${p.age}th (+6% Comeback H2 Kalah, -10% Kartu)`
          : `Usia ${p.age}th (+3% Comeback H2 Kalah, -5% Kartu)`;
      } else if (roleType === 'pk' && p.s1 === 'FIN') reason = 'FIN Slot 1 (+8% Penalti #23468)';
      else if (roleType === 'pk' && p.s2 === 'FIN') reason = 'FIN Slot 2 (+4% Penalti, Lewat di Auto!)';
      else if (roleType === 'fk' && p.s1 === 'FIN') reason = 'FIN Slot 1 (+2% Konversi Freekick)';
      else if (roleType === 'fk' && p.s2 === 'FIN') reason = 'FIN Slot 2 (+2% Konv FK, Lewat di Auto!)';
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
  /**
   * Bytecode #19558 parseVariantKey: Memecah key custom formation (mis. '3-5-2~4MC~7MC~10PD')
   * menjadi `{ base, overrides, overrideList, key, isCustom }`.
   */
  function parseFormationKey(formKey) {
    const raw = String(formKey || '4-3-3').trim();
    const parts = raw.split('~');
    const rawBase = String(parts[0] || '4-3-3').trim();
    const base = (rawBase in C.FORMATIONS) ? rawBase : '4-3-3';
    const overrides = {};
    const rx = /^(\d{1,2})(VOL|MC|MA|PD|PE|SA|ATA)$/;
    for (let i = 1; i < parts.length; i++) {
      const m = rx.exec(String(parts[i] || '').trim().toUpperCase());
      if (!m) continue;
      const idx = Number(m[1]);
      if (Number.isInteger(idx) && idx >= 0 && idx < 11) {
        overrides[idx] = m[2];
      }
    }
    const overrideList = Object.keys(overrides)
      .map(Number)
      .sort((a, b) => a - b)
      .map(idx => ({ idx, role: overrides[idx] }));
    const key = overrideList.length
      ? `${base}~${overrideList.map(o => `${o.idx}${o.role}`).join('~')}`
      : base;
    return { base, overrides, overrideList, key, isCustom: overrideList.length > 0 };
  }

  /**
   * Bytecode #22023 resolveVariant & #19555 buildRoles: Memetakan slots, ruleSlots, shape,
   * serta delta atkMod/defMod dari formasi standar maupun custom (`~4MC~7MC~10PD`).
   */
  function resolveFormationSpec(formKey) {
    const parsed = parseFormationKey(formKey);
    const base = parsed.base;
    const baseSlots = C.FORMATIONS[base] || C.FORMATIONS['4-3-3'];
    const baseRules = (C.FORMATION_RULE_SLOTS && C.FORMATION_RULE_SLOTS[base]) || [0, 1, 2, 3, 5, 6, 8, 12, 15, 16, 15];
    const baseMods = (C.FORMATION_MODS && C.FORMATION_MODS[base]) || { atkMod: 0, defMod: 0 };

    const slots = [...baseSlots];
    const ruleSlots = [...baseRules];
    const midRoles = C.CUSTOM_MID_ROLES || ['VOL', 'MC', 'MA', 'PD', 'PE'];
    const atkRoles = C.CUSTOM_ATK_ROLES || ['ATA', 'SA', 'PD', 'PE'];
    const midOff = C.CUSTOM_MID_OFF || { VOL: 0, MC: 1, MA: 2, PD: 2, PE: 2 };
    const atkOff = C.CUSTOM_ATK_OFF || { SA: 1, ATA: 2, PD: 2, PE: 2 };
    const midRuleMap = C.CUSTOM_MID_RULE_ID || { VOL: 6, MC: 8, MA: 12, PD: 11, PE: 14 };
    const atkRuleMap = C.CUSTOM_ATK_RULE_ID || { ATA: 16, SA: 15, PD: 15, PE: 15 };
    const deltaCap = C.CUSTOM_DELTA_CAP !== undefined ? C.CUSTOM_DELTA_CAP : 3;

    let deltaSum = 0;
    const appliedList = [];
    const appliedMap = {};
    for (const { idx, role } of parsed.overrideList) {
      const bRule = baseRules[idx];
      const ri = (C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[bRule]) || null;
      const bSlot = baseSlots[idx];
      if (!ri || role === bSlot) continue;
      if (ri.sec === 'M' && midRoles.includes(role)) {
        slots[idx] = role;
        ruleSlots[idx] = midRuleMap[role] !== undefined ? midRuleMap[role] : bRule;
        deltaSum += (midOff[role] ?? 1) - (midOff[bSlot] ?? 1);
        appliedMap[idx] = role;
        appliedList.push({ idx, from: bSlot, role, sec: 'M' });
      } else if (ri.sec === 'A' && atkRoles.includes(role)) {
        slots[idx] = role;
        ruleSlots[idx] = atkRuleMap[role] !== undefined ? atkRuleMap[role] : bRule;
        deltaSum += (atkOff[role] ?? 2) - (atkOff[bSlot] ?? 2);
        appliedMap[idx] = role;
        appliedList.push({ idx, from: bSlot, role, sec: 'A' });
      }
    }

    const delta = U.clamp(deltaSum, -deltaCap, deltaCap);
    const shape = { D: 0, M: 0, A: 0, X: 0 };
    let hasBug = false;
    for (let i = 1; i < ruleSlots.length; i++) {
      const ri = C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[ruleSlots[i]];
      const sec = ri ? ri.sec : 'M';
      if (sec === 'D') shape.D++;
      else if (sec === 'M') shape.M++;
      else if (sec === 'A') shape.A++;
      else if (sec === 'X') { shape.X++; hasBug = true; }
    }
    const baseShape = (C.FORMATION_SHAPE && C.FORMATION_SHAPE[base]) || { width: 'NARROW' };
    shape.width = baseShape.width;

    const key = appliedList.length
      ? `${base}~${appliedList.map(o => `${o.idx}${o.role}`).join('~')}`
      : base;

    return {
      key,
      base,
      isCustom: appliedList.length > 0,
      overrides: appliedMap,
      overrideList: appliedList,
      slots,
      ruleSlots,
      delta,
      atkMod: baseMods.atkMod + delta,
      defMod: baseMods.defMod - delta,
      shape,
      hasBug,
      bugInfo: hasBug && C.FORMATION_BUGS ? (C.FORMATION_BUGS[base] || null) : null,
    };
  }

  function solveBestXi(
    roster, formationKey = '4-3-3', foreignCap = 7, userCountry = '',
    excludeIds = null, rotationMode = false, repLevel = 3, isHuman = true
  ) {
    const spec = resolveFormationSpec(formationKey);
    const fk = spec.key;
    const slots = spec.slots;
    const ruleSlots = spec.ruleSlots;
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

        const ev = evalPlayerForSlot(p, sCode, true, repLevel, ruleId, isHuman);
        let sc = ev.score;
        if (rotationMode) {
          sc += (U.safeNum(p.energy, 100) - 80) * 0.35;
          if (p.moodTier === 1 && U.safeNum(p.minPct, 100) < 12.0) {
            sc += 4.5;
          } else if (p.mood === 'unhappy' || p.nearQuota || p.mood === 'warn') {
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
            const ev = evalPlayerForSlot(p, sCode, true, repLevel, ruleId, isHuman);
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
          const evI = evalPlayerForSlot(pj, si, true, repLevel, ri, isHuman);
          const evJ = evalPlayerForSlot(pi, sj, true, repLevel, rj, isHuman);
          if (evI.score + evJ.score > curSum + 0.01) {
            assigned[i] = { ...assigned[i], player: pj, score: U.roundTo(evI.score, 2), wrongFoot: evI.wrongFoot, compat: evI.compat };
            assigned[j] = { ...assigned[j], player: pi, score: U.roundTo(evJ.score, 2), wrongFoot: evJ.wrongFoot, compat: evJ.compat };
            improved = true;
          }
        }
      }
      if (!improved) break;
    }

    // Bench-swap pass (Best XI): jika 2-opt memindahkan pemain keluar posisi ke slot dengan skor lebih rendah
    // dibanding pemain natural yang tersisa di bangku cadangan, tukar masuk pemain cadangan tersebut.
    for (let bPass = 0; bPass < (rotationMode ? 0 : 2); bPass++) {
      let bImproved = false;
      for (let i = 1; i < assigned.length; i++) {
        if (!assigned[i]) continue;
        const curItem = assigned[i];
        const sCode = curItem.slot;
        const ruleId = curItem.ruleId;
        const curIsF = Boolean(userCountry && curItem.player.nationality && curItem.player.nationality !== userCountry);
        let bestCand = null;
        let bestCandEv = null;
        for (const p of avail) {
          if (usedIds.has(p.id)) continue;
          if (sCode === 'G' && p.pos !== 'G') continue;
          if (sCode !== 'G' && p.pos === 'G') continue;
          const newIsF = Boolean(userCountry && p.nationality && p.nationality !== userCountry);
          if ((foreignUsed - (curIsF ? 1 : 0) + (newIsF ? 1 : 0)) > foreignCap) continue;
          const evB = evalPlayerForSlot(p, sCode, true, repLevel, ruleId, isHuman);
          if (evB.score > (bestCandEv ? bestCandEv.score : curItem.score + 0.01)) {
            bestCand = p;
            bestCandEv = evB;
          }
        }
        if (bestCand && bestCandEv) {
          const newIsF = Boolean(userCountry && bestCand.nationality && bestCand.nationality !== userCountry);
          usedIds.delete(curItem.player.id);
          usedIds.add(bestCand.id);
          foreignUsed = foreignUsed - (curIsF ? 1 : 0) + (newIsF ? 1 : 0);
          assigned[i] = {
            ...curItem,
            player: bestCand,
            score: U.roundTo(bestCandEv.score, 2),
            wrongFoot: bestCandEv.wrongFoot,
            compat: bestCandEv.compat,
          };
          bImproved = true;
        }
      }
      if (!bImproved) break;
      for (let i = 1; i < assigned.length; i++) {
        for (let j = i + 1; j < assigned.length; j++) {
          if (!assigned[i] || !assigned[j]) continue;
          const curSum = assigned[i].score + assigned[j].score;
          const evI = evalPlayerForSlot(assigned[j].player, assigned[i].slot, true, repLevel, assigned[i].ruleId, isHuman);
          const evJ = evalPlayerForSlot(assigned[i].player, assigned[j].slot, true, repLevel, assigned[j].ruleId, isHuman);
          if (evI.score + evJ.score > curSum + 0.01) {
            const pI = assigned[i].player, pJ = assigned[j].player;
            assigned[i] = { ...assigned[i], player: pJ, score: U.roundTo(evI.score, 2), wrongFoot: evI.wrongFoot, compat: evI.compat };
            assigned[j] = { ...assigned[j], player: pI, score: U.roundTo(evJ.score, 2), wrongFoot: evJ.wrongFoot, compat: evJ.compat };
          }
        }
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
      if (p.pos === 'ATA' || p.pos === 'A' || p.pos === 'SA') {
        hasDedicatedStriker = true;
      }
    }

    const FALSE_NINE_POS = ['MA', 'MO', 'ATA', 'A', 'SA']; // #42849 PartidaScreen picker: hanya MA/ATA/SA (bukan winger PE/PD)
    const f9Players = xiClean
      .filter(x => x.sectorCode === 'A' && x.player && FALSE_NINE_POS.includes(String(x.player.pos || '').toUpperCase()))
      .map(x => x.player)
      .filter(p => p.s1 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'PAS' || p.s2 === 'ARM')
      .map(p => p.name);
    const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0.0);

    // Rata-rata per pemain di tiap lini (tanpa penalti fiktif noDedicatedStriker — terverifikasi #22453)
    const gkAvg = avg(gkScores);
    const defAvg = avg(defScores);
    const midAvg = avg(midScores);
    const atkAvg = avg(atkScores);

    // Power Sektor Engine #22453 (denominator tetap DEF/5, MID/5, ATK/3)
    const engineDef = defScores.reduce((a, b) => a + b, 0) / 5.0;
    const engineMid = midScores.reduce((a, b) => a + b, 0) / 5.0;
    const engineAtk = atkScores.reduce((a, b) => a + b, 0) / 3.0;

    const totalScore = xiClean.reduce((acc, x) => acc + x.score, 0);
    const avgScore = xiClean.length ? totalScore / xiClean.length : 0.0;

    const xiPlayers = xiClean.map(x => x.player);
    const hasLeader = xiPlayers.some(p => p.s1 === 'LID' || p.s2 === 'LID');
    const spAudit = auditSetPieces(xiPlayers);
    const bench = avail.filter(p => !usedIds.has(p.id)).sort((a, b) => b.force - a.force);

    const chem = teamChemistry(xiPlayers);
    const chemMul = chemistryMul(chem);
    const bugInfo = spec.bugInfo;

    return {
      formation: fk,
      baseFormation: spec.base,
      isCustom: spec.isCustom,
      atkMod: spec.atkMod,
      defMod: spec.defMod,
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
      hasFormationBug: spec.hasBug,
      formationBugInfo: bugInfo,
      foreignCount: foreignUsed,
      hasLeader,
      falseNine: atkScores.length >= 2 && f9Players.length >= 1,
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
    const spec = resolveFormationSpec(formationKey || (xiObj && xiObj.formation) || '4-3-3');
    const fk = spec.key;
    const ruleSlots = spec.ruleSlots;

    const isHome = opts.isHome !== undefined ? Boolean(opts.isHome) : true;
    const neutral = Boolean(opts.neutral);
    const crowdOver70 = opts.crowdOver70 !== undefined ? Boolean(opts.crowdOver70) : true;
    const style = String(opts.style || 'Balanced').toLowerCase();
    const marking = String(opts.marking || 'Light').toLowerCase();
    const shout = String(opts.shout || 'none').toLowerCase();
    const lockerHitPct = U.safeNum(opts.lockerHitPct, 0.0);

    let sumG = 0, sumD = 0, sumM = 0, sumA = 0;
    let cntG = 0, cntD = 0, cntM = 0, cntA = 0;

    const xiList = (xiObj && Array.isArray(xiObj.xi)) ? xiObj.xi : [];
    const f9Id = opts.falseNineId ? String(opts.falseNineId) : null;
    const F9_ELIGIBLE_POS = ['MA', 'MO', 'ATA', 'A', 'SA']; // #42849 PartidaScreen picker
    let f9Applied = false;
    let midWeightNum = 0, midWeightDen = 0, atkRawSum = 0;
    let velCount = 0, amxCount = 0;
    let captainAge = U.safeNum(opts.captainAge, 0);
    let maxCapAge = -1, maxCapForce = -1;
    if (xiList.length) {
      xiList.forEach((item, idx) => {
        const p = item.player || item;
        const sc = U.safeNum(item.score !== undefined ? item.score : p.force, 0);
        const rId = item.ruleId !== undefined ? item.ruleId : ruleSlots[idx];
        const ri = (C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[rId]) || null;
        const sec = item.sectorCode || (ri ? ri.sec : (idx === 0 ? 'G' : 'M'));
        const pAge = U.safeNum(p && p.age, 25);
        const pForce = U.safeNum(p && p.force, sc);
        if (pAge > maxCapAge || (pAge === maxCapAge && pForce > maxCapForce)) {
          maxCapAge = pAge;
          maxCapForce = pForce;
          captainAge = pAge;
        }
        if (sec === 'A' || sec === 'M' || sec === 'X') {
          amxCount++;
          if (p && (p.s1 === 'VEL' || p.s2 === 'VEL')) velCount++;
        }
        if (sec === 'G') { sumG += sc; cntG++; }
        else if (sec === 'D') { sumD += sc; cntD++; }
        else if (sec === 'M') {
          sumM += sc;
          cntM++;
          const isMidPm = Boolean(p && (p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM'));
          const mw = isMidPm ? 1.5 : 1.0; // #36802/#36803
          midWeightNum += sc * mw;
          midWeightDen += mw;
        }
        else if (sec === 'A') {
          atkRawSum += sc;
          const pPos = String((p && p.pos) || '').toUpperCase();
          if (f9Id && p && String(p.id) === f9Id && F9_ELIGIBLE_POS.includes(pPos)) {
            // #22453 effectiveSectors: f9Atk = 0.6, f9MidPlaymaker (PAS/ARM) = 0.5, f9MidOther = 0.35
            const isPm = (p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM');
            sumA += sc * 0.6;
            sumM += sc * (isPm ? 0.5 : 0.35);
            f9Applied = true;
          } else {
            sumA += sc;
          }
          cntA++;
        }
      });
    } else {
      const sec = (xiObj && xiObj.sectors) || {};
      const shape = spec.shape || { D: 4, M: 3, A: 3 };
      sumG = U.safeNum(sec.GK, 15); cntG = 1;
      sumD = U.safeNum(sec.DEF, 15) * shape.D; cntD = shape.D;
      sumM = U.safeNum(sec.MID, 15) * shape.M; cntM = shape.M;
      sumA = U.safeNum(sec.ATK, 15) * shape.A; cntA = shape.A;
      atkRawSum = sumA;
      midWeightNum = sumM;
      midWeightDen = Math.max(1, cntM);
      if (!captainAge) captainAge = 28;
    }
    if (!captainAge) captainAge = 25;

    const lockerMul = Math.max(0.96, 1.0 - lockerHitPct / 100.0);
    const chem = (xiObj && xiObj.chemistry !== undefined) ? xiObj.chemistry : 100;
    const chemMul = chemistryMul(chem);
    const altHitSide = (!neutral && !isHome) ? Math.max(0, U.safeNum(opts.altHit, 0)) : 0.0;
    const altMul = altHitSide > 0 ? Math.max(0.85, 1.0 - 0.12 * altHitSide) : 1.00; // #22453 L1159: diterapkan SETELAH clamp ±8%
    const condEnergyMul = U.safeNum(opts.energyMul, 1.0);
    const condFatigueMul = condEnergyMul > 1.0 ? Math.max(0.95, 1.0 - 0.001 * ((condEnergyMul - 1.0) * 14.0)) : 1.0;
    const outfieldGlobalMul = lockerMul * chemMul * condFatigueMul;

    // #22453 & #3700 Marking: markAdj (+0 / +0.04 / +0.08) masuk pembilang sumM sebelum /5.0 (0% DEF!)
    const isVeryHeavyMark = marking.includes('very') || marking.includes('sangat');
    const isHeavyMark = !isVeryHeavyMark && (marking.includes('heavy') || marking.includes('ketat'));
    const markAdj = isVeryHeavyMark ? 0.08 : (isHeavyMark ? 0.04 : 0.0);

    // #22453: Denominator tetap /5, /5, /3; lockerMul, chemMul & cond hanya berlaku pada DEF, MID, ATK (bukan GK)
    const baseGk = (cntG > 0 ? sumG / cntG : 15.0);
    const baseDef = (sumD / 5.0);
    const baseMid = ((sumM + markAdj) / 5.0);
    const baseAtk = (sumA / 3.0);

    let rawGk = baseGk;
    let rawDef = baseDef * outfieldGlobalMul;
    let rawMid = baseMid * outfieldGlobalMul;
    let rawAtk = baseAtk * outfieldGlobalMul;

    // #22450 & #22453: Kapten TIDAK memberi +3% MID pasif; hanya aktif Babak 2 saat kalah (+6% >=28th, +3% <28th)
    // serta memotong risiko kartu sepanjang laga (-10% >=28th, -5% <28th).
    const captainComebackPct = captainAge >= 28 ? 6 : 3;
    const captainCardCutPct = captainAge >= 28 ? 10 : 5;
    if (opts.secondHalf && opts.losing) {
      rawMid *= (1.0 + captainComebackPct / 100.0);
    }

    if (isHome && crowdOver70) {
      rawMid *= 1.02;
    }

    // OTA #22453 (#3652 morale: 0.03): hanya sektor MID
    if (opts.morale !== undefined && opts.morale !== null && Number(opts.morale) !== 0) {
      const mVal = U.clamp(U.safeNum(opts.morale, 0), -1.0, 1.0);
      rawMid *= (1.0 + 0.03 * mVal);
    }

    const speedRatio = amxCount > 0 ? (velCount / amxCount) : 0.33;
    let convBonusPct = 0.0;
    if (style.includes('off') || style.includes('serang')) {
      rawAtk *= 1.08;
      rawDef *= 0.92;
    } else if (style.includes('def')) {
      rawAtk *= 0.92;
      rawDef *= 1.08;
    } else if (style.includes('counter') || style.includes('balik')) {
      rawMid *= 0.94;
      // #22454: Counter-Attack konversi + (0.06 + 0.06 * speedRatio) berdasarkan rasio pemain VEL di lini A/M/X
      convBonusPct = U.roundTo((0.06 + 0.06 * speedRatio) * 100.0, 1);
    }

    // #3700 & #22453 Marking card multipliers: Light 0.80x (+30 den), Heavy 1.05x (+10 den), Very Heavy 1.35x (+0 den)
    let cardRiskLabel = 'Rendah (merah 0.80×, kuning lebih jarang)';
    const staminaDrainLabel = 'Normal'; // #3700: Light/Heavy/Very Heavy semua memiliki kelelahan Normal
    let redMarkMul = 0.80;
    if (isVeryHeavyMark) {
      redMarkMul = 1.35;
      cardRiskLabel = 'Tinggi (merah 1.35×, kuning jauh lebih sering)';
    } else if (isHeavyMark) {
      redMarkMul = 1.05;
      cardRiskLabel = 'Sedang (merah 1.05× · fullback assist+)';
    }
    const shoutCardMul = (shout.includes('calm') || shout.includes('calma')) ? 0.85 : 1.0;
    if (opts.cardMul !== undefined && opts.cardMul !== null) {
      const redProb = Math.min(0.35, 0.045 * redMarkMul * (1.0 - captainCardCutPct / 100.0) * shoutCardMul * Math.max(0.5, U.safeNum(opts.cardMul, 1.0)));
      const redMul = 1.0 - redProb * 0.14;
      rawDef *= redMul;
      rawMid *= redMul;
      rawAtk *= redMul;
    }

    // #3700 6 Shout resmi OTA 2.1.0 (tergantung status skor saat diteriakkan)
    const scoreState = String(opts.scoreState || 'tied').toLowerCase();
    const isWinState = scoreState.includes('win') || scoreState.includes('lead') || scoreState.includes('unggul');
    const isLoseState = scoreState.includes('los') || scoreState.includes('trail') || scoreState.includes('kalah');
    if (shout.includes('encourage') || shout.includes('incentivar')) {
      rawMid *= isWinState ? 1.010 : 1.015;
    } else if (shout.includes('demand') || shout.includes('cobrar')) {
      if (isWinState) { rawDef *= 0.985; rawMid *= 0.990; }
      else rawAtk *= 1.015;
    } else if (shout.includes('fire') || shout.includes('incendiar') || shout.includes('motiv')) {
      if (isLoseState) rawAtk *= 1.020;
      else if (!isWinState) rawAtk *= 1.010;
    } else if (shout.includes('focus') || shout.includes('concentrar') || shout.includes('tighten')) {
      rawDef *= isWinState ? 1.015 : 1.008;
    } else if (shout.includes('praise') || shout.includes('elogiar')) {
      if (isLoseState) rawMid *= 0.990;
      else rawMid *= 1.012;
    } else if (shout.includes('calm') || shout.includes('calma')) {
      rawDef *= 1.005;
    }

    const bugInfo = (C.FORMATION_BUGS && C.FORMATION_BUGS[fk]) || null;

    // #22455 keeperSaveMul (REF/COL + SAI), #36800 Wings Crosser (tanpa MD/ME), #22465 shooterWeight (top 1.4, star 1.25)
    let wingCrossers = 0;
    let centerPlaymakers = 0;
    let finAttackers = 0;
    let gkSaveBonus = 0.0;
    let shooterNum = 0;
    let shooterDen = 0;
    if (xiList.length) {
      for (const item of xiList) {
        const p = item.player || item;
        const pos = String(p.pos || item.slot || '').toUpperCase();
        const s1 = String(p.s1 || '').toUpperCase();
        const s2 = String(p.s2 || '').toUpperCase();
        const sec = item.sectorCode || 'M';
        if (sec === 'G') {
          if (s1 === 'REF' || s1 === 'COL') gkSaveBonus += 0.04;
          else if (s1 === 'SAI') gkSaveBonus += 0.02;
          if (s2 === 'REF' || s2 === 'COL') gkSaveBonus += 0.02;
          else if (s2 === 'SAI') gkSaveBonus += 0.01;
        }
        // #36800: hanya LD, LE, LAT, PD, PE (TIDAK termasuk MD/ME!)
        if (['LD', 'LE', 'LAT', 'PD', 'PE'].includes(pos) && (s1 === 'CRU' || s2 === 'CRU')) {
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
          if (s1 === 'FIN' || s2 === 'FIN') w += 4.0;
          if (p && p.top) w *= 1.4;
          else if (isPlayerStar(p)) w *= 1.25;
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
    const gkSaveMul = U.clamp(1.0 + gkSaveBonus, 0.92, 1.08);
    const conversionMul = 0.965 * U.clamp((1.0 + convBonusPct / 100.0) * finBonusMul, 0.88, 1.12);

    // #22453 effectiveSectors (+ #36802/#36803):
    // Focus Center: atk *= (0.8 + 0.2 * (midWeightedAvg / atkPerPlayerAvg)), bobot PAS/ARM di MID = 1.5x
    // Focus Wings: rawAtk * (wingCrossers > 0 ? 1 + 0.02*min(3, wingCrossers) : 0.96)
    // Clamp ±8% terhadap baseDef/baseMid/baseAtk TERLEBIH DAHULU, BARU kalikan altMul di luar clamp (#22453 L1159-1204)!
    const clampCap = (val, base) => base > 0 ? U.clamp(val, base * 0.92, base * 1.08) : val;
    const focusOpt = String(opts.focus || opts.attackFocus || '').toLowerCase();
    const midWeightedAvg = midWeightDen > 0 ? (midWeightNum / midWeightDen) : 0;
    const atkPerPlayerAvg = cntA > 0 ? (atkRawSum / cntA) : 0;
    const centerRatioMul = (midWeightedAvg > 0 && atkPerPlayerAvg > 0)
      ? (0.8 + 0.2 * (midWeightedAvg / atkPerPlayerAvg))
      : 1.0;
    const rawAtkCenter = rawAtk * centerRatioMul;
    const wingMul = wingCrossers > 0 ? (1.0 + 0.02 * Math.min(3, wingCrossers)) : 0.96;
    const rawAtkWings = rawAtk * wingMul;

    rawDef = clampCap(rawDef, baseDef) * altMul;
    rawMid = clampCap(rawMid, baseMid) * altMul;
    const atkCenter = clampCap(rawAtkCenter, baseAtk) * altMul;
    const atkWings = clampCap(rawAtkWings, baseAtk) * altMul;
    rawAtk = clampCap(rawAtk, baseAtk) * altMul;

    let effAtk = rawAtk;
    if (focusOpt.includes('wing') || focusOpt.includes('sayap')) effAtk = atkWings;
    else if (focusOpt.includes('center') || focusOpt.includes('tengah')) effAtk = atkCenter;

    const totalPower = rawDef + rawMid + effAtk + rawGk * 0.35;

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
      conversionMul: U.roundTo(conversionMul, 4),
      speedRatio: U.roundTo(speedRatio, 3),
      markAdj,
      redMarkMul,
      captainAge,
      captainComebackPct,
      captainCardCutPct,
      altMul: U.roundTo(altMul, 4),
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
   * Resolusi faktor kondisi laga (#21362/#21365/#21366/#21367/#22073):
   * Menghasilkan missMul, energyMul & cardMul untuk masing-masing sisi (User vs Opponent)
   * dari objek `autoCond` maupun override manual UI (cuaca/wasit).
   */
  function resolveMatchCondFactors(cond, isHome, neutral = false) {
    const c = (cond && typeof cond === 'object') ? cond : {};
    const weather = String(c.weather || c.weatherKey || 'clear').toLowerCase();
    const refStyle = String(c.refStyle || c.refKey || 'normal').toLowerCase();
    const altHit = neutral ? 0 : Math.max(0, U.safeNum(c.altHit, 0));
    const alt = neutral ? 0 : Math.max(0, U.safeNum(c.alt, 0));
    const varOn = Boolean(c.varOn);

    const Cond = LF.conditions || null;
    const missMul = (c.missMul !== undefined)
      ? Math.max(0.8, U.safeNum(c.missMul, 1.0))
      : (Cond && typeof Cond.condMissMul === 'function'
        ? Cond.condMissMul(weather)
        : (weather === 'rain' ? 1.12 : (weather === 'snow' ? 1.18 : 1.0)));

    const energyFromWeatherAlt = (side) => {
      if (Cond && typeof Cond.condEnergyMul === 'function') {
        return Cond.condEnergyMul(weather, altHit, side);
      }
      const wm = weather === 'heat' ? 1.12 : (weather === 'snow' ? 1.05 : 1.0);
      const am = (side === 'away' && altHit > 0) ? (1 + 0.35 * altHit) : 1.0;
      return wm * am;
    };
    const cardFromRef = (side) => {
      if (Cond && typeof Cond.condCardMul === 'function') {
        return Cond.condCardMul(refStyle, side);
      }
      if (refStyle === 'strict') return 1.2;
      if (refStyle === 'lenient') return 0.82;
      if (refStyle === 'home') return side === 'home' ? 0.85 : 1.2;
      return 1.0;
    };

    const eHome = (c.energyMulHome !== undefined) ? U.safeNum(c.energyMulHome, 1.0) : energyFromWeatherAlt('home');
    const eAway = (c.energyMulAway !== undefined) ? U.safeNum(c.energyMulAway, 1.0) : energyFromWeatherAlt('away');
    const kHome = (c.cardMulHome !== undefined) ? U.safeNum(c.cardMulHome, 1.0) : cardFromRef('home');
    const kAway = (c.cardMulAway !== undefined) ? U.safeNum(c.cardMulAway, 1.0) : cardFromRef('away');

    return {
      weather,
      refStyle,
      alt,
      altHit,
      varOn,
      missMul: U.roundTo(missMul, 3),
      userEnergyMul: U.roundTo(isHome ? eHome : eAway, 3),
      oppEnergyMul: U.roundTo(isHome ? eAway : eHome, 3),
      userCardMul: U.roundTo(isHome ? kHome : kAway, 3),
      oppCardMul: U.roundTo(isHome ? kAway : kHome, 3),
    };
  }

  /**
   * Model Markov Analitik #21813 + #21822 + #48031 (_loop5):
   * Menghitung peluang menang/seri/kalah, ekspektasi gol (xG), penguasaan bola, dan jumlah tembakan
   * sesuai formula bytecode asli:
   *   1) Duel MID: (55 * pAtt) / (55 * pAtt + 45 * pDef) dengan div=8 & homeBonus=+0.3
   *   2) Shot Attempt (jika menang MID): sAtt / (sAtt + sDef)
   *   3) Goal vs GK Save vs Miss: gkVal - shooterVal (base 35.55 / 40.55 + 15 * missMul vs 5.5 / 4.5 / 3.0)
   */
  function simulateMatchExpectation(uPow, oPow, opts = {}) {
    const isHome = Boolean(opts.isHome);
    const neutral = Boolean(opts.neutral);
    const focus = String(opts.focus || 'Center').toLowerCase();
    const oFocus = String(opts.oppFocus || 'Center').toLowerCase();
    const uStyle = String(opts.style || 'Balanced').toLowerCase();
    const oStyle = String(opts.oppStyle || 'Balanced').toLowerCase();
    const condRef = (opts.autoCond || opts.cond) ? resolveMatchCondFactors(opts.autoCond || opts.cond, isHome, neutral) : null;
    const missMul = Math.max(0.8, U.safeNum(opts.missMul, condRef ? condRef.missMul : 1.0));

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

    // #22454 conversionMul: 0.965 * clamp(0.88, 1.12, counterMul * finBonusMul * ...)
    const uFinMul = U.safeNum(uPow.finBonusMul, 1.025);
    const oFinMul = U.safeNum(oPow.finBonusMul, 1.025);
    const uGkSaveMul = U.safeNum(uPow.gkSaveMul, 1.0);
    const oGkSaveMul = U.safeNum(oPow.gkSaveMul, 1.0);
    const uConvMul = U.safeNum(uPow.conversionMul, 0.965 * U.clamp((uStyle.includes('counter') ? 1.09 : 1.0) * uFinMul, 0.88, 1.12));
    const oConvMul = U.safeNum(oPow.conversionMul, 0.965 * U.clamp((oStyle.includes('counter') ? 1.09 : 1.0) * oFinMul, 0.88, 1.12));
    const homeMid = C.MATCH_HOME_MID !== undefined ? C.MATCH_HOME_MID : 0.3;
    const homeShot = C.MATCH_HOME_SHOT !== undefined ? C.MATCH_HOME_SHOT : 0.0;
    const hU = (!neutral && isHome) ? homeMid : 0.0;
    const hO = (!neutral && !isHome) ? homeMid : 0.0;
    const nPerSide = 48; // 96 total lances rata-rata per laga

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
      // #3841 FX.homeShot = 0 & #51163 (_loop5): penalti/bonus kandang pada shot dihapus (0.0)
      const sideHomeAdj = neutral ? 0.0 : (attIsHome ? homeShot : -homeShot);
      const gkF = Math.max(0.2, 1 + dampGk / 8 + sideHomeAdj) * defGkSaveMul;
      const missF = Math.max(0.2, 1 - dampGk / 8 + sideHomeAdj);

      // #22476 scoreBrake tiers: <3 (5.5/35.55), 3..4 (4.9/40.55), 5 (4.5/40.55), 6..9 (4.0/40.55), >=10 (0)
      const mkConv = (numC, gkDen) => (numC * convMul) / (numC * convMul + gkDen * gkF + 15 * missF * missMul);
      const convLt3 = mkConv(5.5, 35.55);
      const conv34 = mkConv(4.9, 40.55);
      const conv5 = mkConv(4.5, 40.55);
      const conv69 = mkConv(4.0, 40.55);
      return { duelProb, shotProb: duelProb * shotGivenDuel, convLt3, conv34, conv5, conv69 };
    }

    const rU = sideRates(uSec, oSec, hU, isHome, uConvMul, oGkSaveMul);
    const rO = sideRates(oSec, uSec, hO, !isHome, oConvMul, uGkSaveMul);

    function goalDist(r) {
      const maxG = 10;
      let dp = new Array(maxG + 1).fill(0);
      dp[0] = 1;
      for (let i = 0; i < nPerSide; i++) {
        // #22476 OTA 2.1.0 EARLY_GOAL = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5] lalu 1.05 setelah menit awal
        const early = i === 0 ? 0.125 : (i === 1 ? 0.25 : (i === 2 ? 0.45 : 1.05));
        const ndp = new Array(maxG + 1).fill(0);
        for (let g = 0; g <= maxG; g++) {
          if (dp[g] === 0) continue;
          const baseC = g >= 10 ? 0 : (g >= 6 ? r.conv69 : (g === 5 ? r.conv5 : (g >= 3 ? r.conv34 : r.convLt3)));
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
    for (let gu = 0; gu <= 10; gu++) {
      xGF += gu * dpU[gu];
      for (let go = 0; go <= 10; go++) {
        const p = dpU[gu] * dpO[go];
        if (gu > go) pWin += p;
        else if (gu === go) pDraw += p;
        else pLoss += p;
      }
    }
    for (let go = 0; go <= 10; go++) xGA += go * dpO[go];

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
      missMul: U.roundTo(missMul, 3),
      condApplied: condRef
        ? { weather: condRef.weather, refStyle: condRef.refStyle, altHit: condRef.altHit }
        : (missMul !== 1.0 ? { missMul: U.roundTo(missMul, 3) } : null),
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
    let styleReason = `Selisih Force Top-11 (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}) di rentang -4 s.d. +6 (#24891) → AI memilih Balanced`;
    if (diff >= 6.0) {
      aiStyle = 'Balanced';
      styleReason = `Lawan unggul Force +${diff.toFixed(1)} (≥ +6.0 di #24891) → AI 60% pilih Balanced / 40% Offensive (+8% ATK, -8% DEF)`;
    } else if (diff <= -4.0) {
      if (velDefCount >= 2) {
        aiStyle = 'Counter-Attack';
        styleReason = `Lawan kalah Force ${diff.toFixed(1)} (≤ -4.0) & punya ${velDefCount} pemain cepat VEL (≥2) → AI otomatis Counter-Attack (-6% MID, +6..12% konversi)`;
      } else {
        aiStyle = 'Balanced';
        styleReason = `Lawan kalah Force ${diff.toFixed(1)} (≤ -4.0) & pemain VEL <2 → AI 60% Balanced / 40% Defensive (-8% ATK, +8% DEF di #24891)`;
      }
    } else if (velDefCount >= 3) {
      aiStyle = 'Balanced';
      styleReason = `Selisih Force berimbang (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}), punya ${velDefCount} pemain VEL (≥3) → AI 70% Balanced / 30% Counter-Attack`;
    }

    let aiFocus = 'Center';
    let focusReason = `Pemain sayap (RB/LB/RW/LW) ber-skill CRS hanya ${wingCruCount} (< 2 di #24891) → AI otomatis fokus Center`;
    if (wingCruCount >= 2) {
      aiFocus = 'Wings';
      focusReason = `Lawan punya ${wingCruCount} pemain RB/LB/RW/LW ber-skill CRS (≥ 2 di #24891: ${wingNames.join(', ')}) → AI otomatis fokus Wings`;
    }

    let counterTip = 'Balanced';
    if (aiStyle === 'Offensive') {
      counterTip = 'Counter-Attack (+6..12% konversi peluang vs DEF lawan yang terbuka -8%)';
    } else if (aiStyle === 'Defensive') {
      counterTip = 'Offensive (+8% ATK untuk menembus DEF lawan yang menumpuk +8%)';
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
  /**
   * Auto Custom-Slot Optimizer (#19555/#19558/#22023):
   * Menguji hingga <=10 varian custom slot berdampak tertinggi pada formasi dasar `baseFk`
   * (mengubah slot MID wildcard/wrong-foot ke MC/MA/role alami & menyelaraskan slot ATK ke PD/PE/SA)
   * untuk mencari kombinasi xPts tertinggi dengan penalti salah kaki minimal.
   */
  function optimizeCustomSlots(baseFk, userRoster, oppPow, opts = {}) {
    const baseSpec = resolveFormationSpec(baseFk);
    const canonBase = baseSpec.base;
    const baseSlots = C.FORMATIONS[canonBase] || C.FORMATIONS['4-3-3'];
    const baseRules = (C.FORMATION_RULE_SLOTS && C.FORMATION_RULE_SLOTS[canonBase]) || [];
    const midRoles = C.CUSTOM_MID_ROLES || ['VOL', 'MC', 'MA', 'PD', 'PE'];
    const atkRoles = C.CUSTOM_ATK_ROLES || ['ATA', 'SA', 'PD', 'PE'];

    const isHome = Boolean(opts.isHome);
    const foreignCap = opts.foreignCap !== undefined ? opts.foreignCap : 7;
    const userCountry = opts.userCountry || '';
    const excludeIds = opts.excludeIds || null;
    const rotationMode = Boolean(opts.rotationMode);
    const repLevel = opts.repLevel !== undefined ? opts.repLevel : 3;
    const style = opts.style || 'Balanced';
    const marking = opts.marking || 'Heavy';
    const oppFocus = opts.oppFocus || 'Center';
    const oppStyle = opts.oppStyle || 'Balanced';
    const missMul = U.safeNum(opts.missMul, 1.0);
    const uCondOpts = {
      altHit: U.safeNum(opts.altHit, 0),
      energyMul: U.safeNum(opts.energyMul, 1.0),
      cardMul: opts.cardMul,
    };

    function evalKey(fk) {
      const res = solveBestXi(userRoster, fk, foreignCap, userCountry, excludeIds, rotationMode, repLevel);
      const uPow = computeEngineSectorPower(res, fk, {
        isHome, crowdOver70: true, style, marking, ...uCondOpts,
      });
      const simC = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Center', oppFocus, style, oppStyle, missMul,
      });
      const simW = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Wings', oppFocus, style, oppStyle, missMul,
      });
      const optFocus = simC.xPts >= simW.xPts ? 'Center' : 'Wings';
      const sim = optFocus === 'Center' ? simC : simW;
      const spec = resolveFormationSpec(fk);
      const score = sim.xPts * 40.0 + res.avgScore * 0.05 - res.wrongFootCount * 0.45 - (res.hasFormationBug ? 18.0 : 0.0);
      return {
        key: spec.key,
        base: spec.base,
        isCustom: spec.isCustom,
        overrides: spec.overrideList,
        atkMod: spec.atkMod,
        defMod: spec.defMod,
        res,
        uPow: { ...uPow, ATK: sim.effAtkUser, atkMod: spec.atkMod, defMod: spec.defMod },
        sim,
        optFocus,
        score: U.roundTo(score, 2),
      };
    }

    const baseEval = evalKey(canonBase);
    const candKeys = new Set();
    const pushKey = (k) => {
      if (candKeys.size >= 10) return;
      const sp = resolveFormationSpec(k);
      if (sp.isCustom && sp.key !== canonBase) candKeys.add(sp.key);
    };

    if (opts.activeFormationRaw) {
      const actSp = resolveFormationSpec(opts.activeFormationRaw);
      if (actSp.base === canonBase && actSp.isCustom) pushKey(actSp.key);
    }

    const naturalTokens = [];
    const wfMcTokens = [];
    const wfMaTokens = [];
    const atkNaturalTokens = [];
    for (let i = 1; i < baseSlots.length; i++) {
      const assign = (baseEval.res.xi || []).find(a => a.slotIdx === i) || baseEval.res.xi[i];
      if (!assign || !assign.player) continue;
      const bRole = baseSlots[i];
      const ri = C.RULE_SLOT_INFO && C.RULE_SLOT_INFO[baseRules[i]];
      if (!ri) continue;
      const pPos = assign.player.pos;
      const isWild = baseRules[i] === 10 || baseRules[i] === 17;
      if (ri.sec === 'M') {
        if (midRoles.includes(pPos) && pPos !== bRole) {
          naturalTokens.push(`${i}${pPos}`);
        }
        if (assign.wrongFoot || isWild || assign.compat < 0.99) {
          if (bRole !== 'MC') wfMcTokens.push(`${i}MC`);
          if (bRole !== 'MA') wfMaTokens.push(`${i}MA`);
          if (pPos === 'PD' || pPos === 'PE') pushKey(`${canonBase}~${i}${pPos}`);
          else if (bRole !== 'MC') pushKey(`${canonBase}~${i}MC`);
        }
      } else if (ri.sec === 'A') {
        if (atkRoles.includes(pPos) && pPos !== bRole) {
          atkNaturalTokens.push(`${i}${pPos}`);
          pushKey(`${canonBase}~${i}${pPos}`);
        }
      }
    }

    if (wfMcTokens.length) pushKey(`${canonBase}~${wfMcTokens.join('~')}`);
    if (wfMaTokens.length) pushKey(`${canonBase}~${wfMaTokens.join('~')}`);
    if (naturalTokens.length) pushKey(`${canonBase}~${naturalTokens.join('~')}`);
    if (wfMcTokens.length && atkNaturalTokens.length) {
      pushKey(`${canonBase}~${[...wfMcTokens, ...atkNaturalTokens].join('~')}`);
    }
    if (naturalTokens.length && atkNaturalTokens.length) {
      pushKey(`${canonBase}~${[...naturalTokens, ...atkNaturalTokens].join('~')}`);
    }

    let bestCustom = null;
    for (const ck of candKeys) {
      const ev = evalKey(ck);
      if (!bestCustom || ev.score > bestCustom.score) {
        bestCustom = ev;
      }
    }

    if (!bestCustom) return null;
    const deltaPts = U.roundTo(bestCustom.sim.xPts - baseEval.sim.xPts, 3);
    const deltaWin = U.roundTo(bestCustom.sim.winPct - baseEval.sim.winPct, 1);
    const wfSaved = baseEval.res.wrongFootCount - bestCustom.res.wrongFootCount;
    const isUpgrade = (deltaPts >= 0.002) || (wfSaved > 0 && deltaPts >= -0.002) || (bestCustom.score > baseEval.score + 0.05);
    if (!isUpgrade) return null;

    return {
      baseKey: canonBase,
      customKey: bestCustom.key,
      label: bestCustom.overrides.map(o => `#${o.idx + 1} ${o.from}→${o.role}`).join(' · '),
      overrides: bestCustom.overrides,
      winPct: bestCustom.sim.winPct,
      drawPct: bestCustom.sim.drawPct,
      lossPct: bestCustom.sim.lossPct,
      xPts: bestCustom.sim.xPts,
      xGF: bestCustom.sim.xGF,
      xGA: bestCustom.sim.xGA,
      possPct: bestCustom.sim.possPct,
      optFocus: bestCustom.optFocus,
      wrongFootCount: bestCustom.res.wrongFootCount,
      wfSaved,
      atkMod: bestCustom.atkMod,
      defMod: bestCustom.defMod,
      deltaPts,
      deltaWin,
      avgScore: bestCustom.res.avgScore,
      uPow: bestCustom.uPow,
    };
  }

  function recommendMatchupForOpponent(
    userRoster, oppXi, isHome, isKnockout, isBig,
    foreignCap = 7, userCountry = '', activeFormation = '4-3-3',
    yellowIds = null, safeRotate = false, repLevel = 3,
    autoCond = null, activeFormationRaw = null
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

    const rawActiveKey = activeFormationRaw || activeFormation || '4-3-3';
    const actSpec = resolveFormationSpec(rawActiveKey);
    const condF = resolveMatchCondFactors(autoCond, isHome, false);
    const uCondOpts = {
      altHit: condF.altHit,
      energyMul: condF.userEnergyMul,
      cardMul: condF.userCardMul,
    };
    const oCondOpts = {
      altHit: condF.altHit,
      energyMul: condF.oppEnergyMul,
      cardMul: condF.oppCardMul,
    };

    const healthySorted = (userRoster || [])
      .filter(p => !p.injured && !p.suspended && (!excludeForRec || !excludeForRec.has(p.id)))
      .sort((a, b) => (b.force || 0) - (a.force || 0));
    const top11Pool = healthySorted.length >= 11 ? healthySorted.slice(0, 11) : (userRoster || []).slice(0, 11);
    const userTop11Avg = top11Pool.length
      ? U.roundTo(top11Pool.reduce((s, p) => s + (p.force || 0), 0) / top11Pool.length, 1)
      : oppAvg;

    const oppAi = predictAiTacticsDetail(oppAvg, userTop11Avg, !isHome, oppXiPlayers);
    const oppStyle = oppAi.aiStyle;
    const oppFocus = oppAi.aiFocus || 'Center';
    const oppPow = computeEngineSectorPower(oppXi, (oppXi && oppXi.formation) || '4-4-2', {
      isHome: !isHome,
      crowdOver70: true,
      style: oppStyle,
      marking: 'Heavy',
      ...oCondOpts,
    });

    function evaluateFormationCandidate(fk) {
      const spec = resolveFormationSpec(fk);
      const res = solveBestXi(userRoster, spec.key, foreignCap, userCountry, excludeForRec, safeRotate, repLevel);
      const avgEdge = res.avgScore - oppAvg;
      let trialStyle = 'Balanced';
      if (avgEdge >= 2.0) trialStyle = 'Offensive';
      else if (avgEdge <= -1.5 || oppStyle === 'Offensive') trialStyle = 'Counter-Attack';

      let trialMark = (avgEdge >= 4.0 && !isKnockout && !isBig) ? 'Light' : 'Heavy';
      if (condF.userCardMul >= 1.15 && !(isKnockout && avgEdge <= -1.5)) trialMark = 'Light';
      else if (condF.userCardMul <= 0.88 && (isKnockout || isBig || avgEdge <= 1.0)) trialMark = 'Very Heavy';

      const uPow = computeEngineSectorPower(res, spec.key, {
        isHome,
        crowdOver70: true,
        style: trialStyle,
        marking: trialMark,
        ...uCondOpts,
      });

      // Evaluasi kedua opsi Attack Focus (#21822): Center (0.8*ATK + 0.2*MID) vs Wings (+2%/crosser)
      const simC = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Center', oppFocus, style: trialStyle, oppStyle, missMul: condF.missMul,
      });
      const simW = simulateMatchExpectation(uPow, oppPow, {
        isHome, neutral: false, focus: 'Wings', oppFocus, style: trialStyle, oppStyle, missMul: condF.missMul,
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

      const enginePow = {
        ...uPow,
        ATK: effAtk,
        atkMod: spec.atkMod,
        defMod: spec.defMod,
      };
      const xiSummary = res.xi.map(a => `${a.slot}:${a.player.name}`);

      return {
        formation: spec.key,
        baseFormation: spec.base,
        isCustom: spec.isCustom,
        h2hScore: U.roundTo(h2hScore, 2),
        avgScore: res.avgScore,
        totalScore: res.totalScore,
        sectors: res.sectors,
        uPow: enginePow,
        enginePow,
        atkMod: spec.atkMod,
        defMod: spec.defMod,
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
      };
    }

    const candidates = [];
    for (const fk of Object.keys(C.FORMATIONS)) {
      candidates.push(evaluateFormationCandidate(fk));
    }

    // Jika formasi aktif adalah custom formation (mis. '3-5-2~4MC~7MC~10PD'), ikut dievaluasi akurat
    if (actSpec.isCustom && !candidates.some(c => c.formation === actSpec.key)) {
      candidates.push(evaluateFormationCandidate(actSpec.key));
    }

    candidates.sort((a, b) => b.h2hScore - a.h2hScore);
    const best = candidates[0];
    const activeComp = candidates.find(c => c.formation === actSpec.key)
      || candidates.find(c => c.formation === actSpec.base)
      || best;

    const finalAi = predictAiTacticsDetail(oppAvg, best.avgScore, !isHome, oppXiPlayers);
    const effectiveOppPow = (finalAi.aiStyle !== oppStyle)
      ? computeEngineSectorPower(oppXi, (oppXi && oppXi.formation) || '4-4-2', {
          isHome: !isHome,
          crowdOver70: true,
          style: finalAi.aiStyle,
          marking: 'Heavy',
          ...oCondOpts,
        })
      : oppPow;
    const recEdge = U.roundTo(best.avgScore - oppAvg, 1);
    const activeEdge = U.roundTo(activeComp.avgScore - oppAvg, 1);

    // Uji 4 Play Style resmi (#21959) pada formasi terbaik via Markov #48031 + autoCond
    const bestXiObj = solveBestXi(userRoster, best.formation, foreignCap, userCountry, excludeForRec, safeRotate, repLevel);

    let bestMark = 'Heavy (+0.04 MID, FB Assist+)';
    let recMarkingWhy = '';
    if (condF.userCardMul >= 1.15 && !(isKnockout && recEdge <= -1.5)) {
      bestMark = 'Light (Kartu 0.80×)';
      recMarkingWhy = condF.refStyle === 'home' && !isHome
        ? `Wasit Pro-Kandang saat TANDANG (cardMul ${condF.userCardMul}×) → pilih Light (merah 0.80×, kuning jarang, stamina Normal) untuk hindari kartu merah.`
        : `Wasit Ketat (cardMul ${condF.userCardMul}×) → pilih Light (merah 0.80×, kuning jarang) demi menekan risiko kartu.`;
    } else if (condF.userCardMul <= 0.88 && (isKnockout || isBig || recEdge <= 1.0)) {
      bestMark = 'Very Heavy (+0.08 MID, Merah 1.35×)';
      recMarkingWhy = condF.refStyle === 'home' && isHome
        ? `Wasit Pro-Kandang di markas sendiri (cardMul ${condF.userCardMul}×) → aman dorong Very Heavy (+0.08 sumM MID; tidak menambah DEF; stamina Normal).`
        : `Wasit Longgar (cardMul ${condF.userCardMul}×) → manfaatkan untuk Very Heavy (+0.08 sumM MID; waspada kartu merah 1.35×).`;
    } else if (safeRotate && recEdge >= 4.0) {
      bestMark = 'Light (Kartu 0.80×)';
      recMarkingWhy = `Unggul jauh (+${recEdge.toFixed(1)} Force) → pakai Light agar terhindar kartu (0.80× merah); seluruh opsi marking punya lelah Normal (#3700).`;
    } else if ((isKnockout || isBig) && recEdge <= -1.5) {
      bestMark = 'Heavy (+0.04 MID, FB Assist+)';
      recMarkingWhy = `Laga krusial melawan tim lebih kuat (${recEdge.toFixed(1)} Force) → Heavy memberi dorongan MID (+0.04 sumM) + fullback assist lebih sering tanpa lonjakan merah 1.35× seperti Very Heavy.`;
    } else if (ySet.size >= 2 && !isKnockout) {
      bestMark = 'Light (Kartu 0.80×)';
      recMarkingWhy = `Ada ${ySet.size} pemain rawan akumulasi kuning → pakai Light (kuning jauh lebih jarang, 0.80× merah).`;
    } else {
      bestMark = 'Heavy (+0.04 MID, FB Assist+)';
      recMarkingWhy = `Sweet-spot OTA 2.1.0 (#3700/#22467): sedikit mendorong MID (+0.04 sumM) + fullback sering bantu assist dengan merah 1.05× (Heavy TIDAK menambah +4% DEF maupun kelelahan).`;
    }
    const recMarking = bestMark;

    const styleSims = {};
    for (const stTry of ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive']) {
      const pTry = computeEngineSectorPower(bestXiObj, best.formation, {
        isHome, crowdOver70: true, style: stTry, marking: bestMark, ...uCondOpts,
      });
      styleSims[stTry] = simulateMatchExpectation(pTry, effectiveOppPow, {
        isHome, neutral: false, focus: best.optFocus, oppFocus, style: stTry, oppStyle: finalAi.aiStyle, missMul: condF.missMul,
      });
    }

    let recStyle = 'Balanced';
    let bestStylePts = styleSims.Balanced.xPts;
    for (const stOpt of ['Offensive', 'Counter-Attack', 'Defensive']) {
      if (styleSims[stOpt].xPts >= bestStylePts + 0.012) {
        recStyle = stOpt;
        bestStylePts = styleSims[stOpt].xPts;
      }
    }

    // Evaluasi opsi False Nine (#42849 picker hanya MA/ATA/SA; #22453 f9Atk=0.6, f9MidPlaymaker=0.5, f9MidOther=0.35)
    const baseStyleSim = styleSims[recStyle];
    const F9_ELIGIBLE_POS = ['MA', 'MO', 'ATA', 'A', 'SA'];
    const atkItems = (bestXiObj.xi || []).filter(it => it.sectorCode === 'A' && it.player);
    const f9EligibleItems = atkItems.filter(it => F9_ELIGIBLE_POS.includes(String(it.player.pos || '').toUpperCase()));
    const pmAtkItems = f9EligibleItems.filter(it => {
      const p = it.player;
      return p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM';
    });
    let bestF9Pick = null;
    if (atkItems.length >= 2 && f9EligibleItems.length > 0) {
      for (const it of f9EligibleItems) {
        const p = it.player;
        const isPm = (p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM');
        const pF9 = computeEngineSectorPower(bestXiObj, best.formation, {
          isHome, crowdOver70: true, style: recStyle, marking: bestMark, falseNineId: p.id, ...uCondOpts,
        });
        const simF9 = simulateMatchExpectation(pF9, effectiveOppPow, {
          isHome, neutral: false, focus: best.optFocus, oppFocus, style: recStyle, oppStyle: finalAi.aiStyle, missMul: condF.missMul,
        });
        if (!bestF9Pick || simF9.xPts > bestF9Pick.sim.xPts) {
          bestF9Pick = { player: p, isPlaymaker: isPm, sim: simF9 };
        }
      }
    }

    const useFalseNine = Boolean(bestF9Pick && bestF9Pick.sim.xPts >= baseStyleSim.xPts + 0.005);
    const finalF9Id = (useFalseNine && bestF9Pick) ? bestF9Pick.player.id : null;

    // Sinkronkan styleCompare dengan konfigurasi False Nine aktif agar konsisten 100% dengan finalRecSim
    const compareStyleSims = {};
    for (const stName of ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive']) {
      if (!finalF9Id) {
        compareStyleSims[stName] = styleSims[stName];
      } else if (stName === recStyle) {
        compareStyleSims[stName] = bestF9Pick.sim;
      } else {
        const pF9St = computeEngineSectorPower(bestXiObj, best.formation, {
          isHome, crowdOver70: true, style: stName, marking: bestMark, falseNineId: finalF9Id, ...uCondOpts,
        });
        compareStyleSims[stName] = simulateMatchExpectation(pF9St, effectiveOppPow, {
          isHome, neutral: false, focus: best.optFocus, oppFocus, style: stName, oppStyle: finalAi.aiStyle, missMul: condF.missMul,
        });
      }
    }

    let recStyleWhy = '';
    if (recStyle === 'Counter-Attack') {
      recStyleWhy = `Uji simulasi memberi ekspektasi poin tertinggi (${compareStyleSims['Counter-Attack'].winPct}% Win) vs AI ${finalAi.aiStyle}: +6..12% bonus konversi peluang sangat efektif saat transisi cepat.`;
    } else if (recStyle === 'Offensive') {
      recStyleWhy = `Uji simulasi unggul di Offensive (${compareStyleSims.Offensive.winPct}% Win, xG ${compareStyleSims.Offensive.xGF} vs Balanced ${compareStyleSims.Balanced.xGF}): +8% ATK memaksimalkan volume gol tanpa mengorbankan dominasi MID.`;
    } else if (recStyle === 'Defensive') {
      recStyleWhy = `Uji simulasi unggul di Defensive (${compareStyleSims.Defensive.winPct}% Win · ${compareStyleSims.Defensive.drawPct}% Seri, xGA ${compareStyleSims.Defensive.xGA}): +8% DEF meredam gempuran lawan.`;
    } else if (finalAi.aiStyle === 'Offensive') {
      recStyleWhy = `Lawan diprediksi Offensive (+8% ATK, -8% DEF). Balanced menjaga DEF tetap rapat; siapkan Counter-Attack jika tertekan.`;
    } else {
      recStyleWhy = `Balanced paling stabil (${compareStyleSims.Balanced.winPct}% Win · ${compareStyleSims.Balanced.drawPct}% Seri · xPts ${compareStyleSims.Balanced.xPts}) — menjaga 3 sektor tanpa penalti -8% DEF (Offensive), -8% ATK (Defensive), maupun -6% MID (Counter).`;
    }

    const styleCompare = ['Balanced', 'Offensive', 'Counter-Attack', 'Defensive'].map(stName => {
      const s = compareStyleSims[stName];
      return {
        style: stName,
        winPct: s.winPct,
        drawPct: s.drawPct,
        lossPct: s.lossPct,
        xPts: s.xPts,
        xGF: s.xGF,
        xGA: s.xGA,
        possPct: s.possPct,
        isRec: stName === recStyle,
      };
    });

    const finalRecPow = computeEngineSectorPower(bestXiObj, best.formation, {
      isHome,
      crowdOver70: true,
      style: recStyle,
      marking: recMarking,
      falseNineId: finalF9Id,
      ...uCondOpts,
    });
    const finalRecSim = compareStyleSims[recStyle];
    best.winPct = finalRecSim.winPct;
    best.drawPct = finalRecSim.drawPct;
    best.lossPct = finalRecSim.lossPct;
    best.xPts = finalRecSim.xPts;
    best.xGF = finalRecSim.xGF;
    best.xGA = finalRecSim.xGA;
    best.possPct = finalRecSim.possPct;
    best.uShots = finalRecSim.uShots;
    best.oShots = finalRecSim.oShots;
    best.optStyle = recStyle;
    best.matchupScore = U.roundTo(finalRecSim.winPct - finalRecSim.lossPct, 1);
    best.atkVsDef = U.roundTo(finalRecSim.effAtkUser - effectiveOppPow.DEF, 1);
    best.midVsMid = U.roundTo(finalRecPow.MID - effectiveOppPow.MID, 1);
    best.defVsAtk = U.roundTo(finalRecPow.DEF - effectiveOppPow.ATK, 1);
    best.dMid = best.midVsMid;
    best.dAtk = best.atkVsDef;
    best.dDef = best.defVsAtk;
    best.uPow = { ...finalRecPow, ATK: finalRecSim.effAtkUser, atkMod: best.atkMod, defMod: best.defMod };
    best.enginePow = best.uPow;
    if (activeComp === best || activeComp.formation === best.formation) {
      Object.assign(activeComp, {
        winPct: best.winPct,
        drawPct: best.drawPct,
        lossPct: best.lossPct,
        xPts: best.xPts,
        xGF: best.xGF,
        xGA: best.xGA,
        possPct: best.possPct,
        uShots: best.uShots,
        oShots: best.oShots,
        optStyle: best.optStyle,
        matchupScore: best.matchupScore,
        atkVsDef: best.atkVsDef,
        midVsMid: best.midVsMid,
        defVsAtk: best.defVsAtk,
        dMid: best.dMid,
        dAtk: best.dAtk,
        dDef: best.dDef,
        uPow: best.uPow,
        enginePow: best.enginePow,
      });
    }
    const falseNineTarget = useFalseNine ? {
      id: bestF9Pick.player.id,
      name: bestF9Pick.player.name,
      pos: U.posEn(bestF9Pick.player.pos),
      isPlaymaker: bestF9Pick.isPlaymaker,
      winPct: bestF9Pick.sim.winPct,
      xPts: bestF9Pick.sim.xPts,
    } : null;

    let falseNineWhy = '';
    if (useFalseNine) {
      falseNineWhy = `Aktifkan False Nine pada ${falseNineTarget.name} (${falseNineTarget.pos}${falseNineTarget.isPlaymaker ? ' · PAS/PLY' : ''}): menukar -40% bobot ATK-nya menjadi +${falseNineTarget.isPlaymaker ? '50%' : '35%'} bobot ke MID (xPts ${bestF9Pick.sim.xPts} vs OFF ${baseStyleSim.xPts}, ${bestF9Pick.sim.winPct}% Win).`;
    } else if (atkItems.length <= 1) {
      falseNineWhy = 'OFF — Formasi hanya memakai 1 penyerang, mengaktifkan False Nine akan memangkas ATK -40%.';
    } else if (!f9EligibleItems.length) {
      falseNineWhy = 'OFF — Tidak ada pemain ST/SS/CAM di lini depan (opsi False Nine di game hanya bisa dipasang pada ST/SS/CAM, bukan winger LW/RW).';
    } else if (!pmAtkItems.length) {
      falseNineWhy = `OFF — Penyerang eligible (${f9EligibleItems.map(x => x.player.name).join(', ')}) tidak punya PAS/PLY (+35% MID tidak menutupi -40% ATK; xPts ${baseStyleSim.xPts} vs F9 ${bestF9Pick ? bestF9Pick.sim.xPts : '-'}).`;
    } else {
      falseNineWhy = `OFF — Mempertahankan 100% bobot ATK lebih unggul (xPts ${baseStyleSim.xPts} vs False Nine ${bestF9Pick ? bestF9Pick.sim.xPts : '-'}).`;
    }

    // Attack Focus (#22453 effectiveSectors): Center (rasio rata-rata MID/ATK, bobot 1.5x PAS/PLY) vs Wings (+2%/crosser)
    const recFocus = best.optFocus;
    let recFocusWhy = '';
    if (recFocus === 'Center') {
      const bonus = U.roundTo(best.uPow.atkCenter - best.uPow.rawATK, 1);
      recFocusWhy = `Center (rasio kualitas rata-rata MID terhadap ATK, bobot 1.5x untuk PAS/PLY) memberi ATK efektif ${best.uPow.atkCenter} (${bonus >= 0 ? '+' : ''}${bonus} dari dasar ${best.uPow.rawATK}), lebih tinggi dari Wings (${best.uPow.atkWings}).`;
    } else {
      recFocusWhy = `Wings lebih unggul (ATK efektif ${best.uPow.atkWings} dengan ${best.uPow.wingCrossers} pengumpan silang CRS vs Center ${best.uPow.atkCenter}).`;
    }

    const customRec = optimizeCustomSlots(best.baseFormation || best.formation, userRoster, effectiveOppPow, {
      isHome,
      foreignCap,
      userCountry,
      excludeIds: excludeForRec,
      rotationMode: safeRotate,
      repLevel,
      style: recStyle,
      marking: recMarking,
      oppFocus,
      oppStyle: finalAi.aiStyle,
      missMul: condF.missMul,
      activeFormationRaw: actSpec.key,
      ...uCondOpts,
    });
    if (customRec) {
      customRec.alreadyActive = customRec.customKey === actSpec.key;
    }

    let condBaseline = null;
    if (condF.missMul !== 1.0 || condF.altHit > 0 || condF.userEnergyMul !== 1.0 || condF.oppEnergyMul !== 1.0 || condF.userCardMul !== 1.0 || condF.oppCardMul !== 1.0) {
      const uPowClean = computeEngineSectorPower(bestXiObj, best.formation, {
        isHome, crowdOver70: true, style: recStyle, marking: recMarking,
        falseNineId: useFalseNine && bestF9Pick ? bestF9Pick.player.id : null,
      });
      const oPowClean = computeEngineSectorPower(oppXi, (oppXi && oppXi.formation) || '4-4-2', {
        isHome: !isHome, crowdOver70: true, style: finalAi.aiStyle, marking: 'Heavy',
      });
      const cleanSim = simulateMatchExpectation(uPowClean, oPowClean, {
        isHome, neutral: false, focus: recFocus, oppFocus, style: recStyle, oppStyle: finalAi.aiStyle, missMul: 1.0,
      });
      condBaseline = {
        cleanWinPct: cleanSim.winPct,
        cleanXPts: cleanSim.xPts,
        deltaWin: U.roundTo(finalRecSim.winPct - cleanSim.winPct, 1),
        deltaPts: U.roundTo(finalRecSim.xPts - cleanSim.xPts, 3),
        deltaXgf: U.roundTo(finalRecSim.xGF - cleanSim.xGF, 2),
        deltaXga: U.roundTo(finalRecSim.xGA - cleanSim.xGA, 2),
        weather: condF.weather,
        refStyle: condF.refStyle,
        alt: condF.alt,
        altHit: condF.altHit,
        missMul: condF.missMul,
        userEnergyMul: condF.userEnergyMul,
        userCardMul: condF.userCardMul,
      };
    }

    const shoutPlan = [
      {
        phase: 'Babak 1 / Imbang (Menit 15–30)',
        shout: recEdge >= 0 ? 'Encourage' : 'Focus',
        why: recEdge >= 0
          ? 'Encourage mendorong MID di skor apa pun (lebih efektif saat imbang/kalah) dengan kelelahan sedikit ekstra.'
          : 'Focus mengetatkan pertahanan di fase imbang/awal tanpa penalti kartu.',
      },
      {
        phase: 'Babak 2 — Jika Unggul (Menit 65+)',
        shout: 'Focus / Calm + Order Lock the Door / Clear It',
        why: 'JANGAN pakai Demand More/Fire Up saat unggul (Demand More merusak shape & Fire Up tidak berefek saat menang)! Pakai Focus/Praise/Calm + Order Lock the Door (kuat saat unggul, bisa 5 sub #21779).',
      },
      {
        phase: 'Babak 2 — Jika Imbang/Tertinggal (Menit 75+)',
        shout: 'Demand More / Fire Up + Order All-Out Attack',
        why: 'Demand More & Fire Up mengangkat ATK saat tertinggal/imbang (waspada lebih lelah & kartu) + Order All-Out Attack (+ATK, -DEF) + Supersub segar.',
      },
    ];

    const keepActive = best.formation === actSpec.key || (!actSpec.isCustom && best.formation === actSpec.base);
    const scoreGain = U.roundTo(Math.max(0, best.winPct - activeComp.winPct), 1);
    const ptsGain = U.roundTo(Math.max(0, best.xPts - activeComp.xPts), 2);
    const reasons = [
      `Peluang Simulasi (#22476): ${best.winPct}% Menang · ${best.drawPct}% Seri · ${best.lossPct}% Kalah (xG ${best.xGF}–${best.xGA} · Ball ${best.possPct}%)`,
      `Duel Sektor Engine (#22453): MID ${best.midVsMid >= 0 ? '+' : ''}${best.midVsMid} (Penentu Ball/Shot!) · ATK vs DEF ${best.atkVsDef >= 0 ? '+' : ''}${best.atkVsDef} · DEF vs ATK ${best.defVsAtk >= 0 ? '+' : ''}${best.defVsAtk}`,
      best.wrongFootCount === 0
        ? `Bebas penalti salah kaki Fullback (-5%) · Chemistry ${best.chemistry}/100`
        : `Terdapat ${best.wrongFootCount} slot Fullback salah kaki (-5%) · Chemistry ${best.chemistry}/100`,
    ];

    const refereePlan = {
      strict: {
        marking: 'Light (Kartu 0.80×)',
        badge: 'b-info',
        note: 'Wasit Ketat (#21365: +20% risiko pelanggaran/kartu, cardMul 1.20x): pakai Light (merah 0.80×, kuning jarang) atau Shout Calm / Order Pass and Move (-kartu).',
      },
      normal: {
        marking: recMarking,
        badge: recMarking.includes('Very') ? 'b-warn' : (recMarking.includes('Heavy') ? 'b-good' : 'b-info'),
        note: recMarkingWhy,
      },
      lenient: {
        marking: (isKnockout || isBig || recEdge <= 0) ? 'Very Heavy (+0.08 MID, Merah 1.35×)' : 'Heavy (+0.04 MID, FB Assist+)',
        badge: 'b-good',
        note: 'Wasit Longgar (#21365: -18% risiko kartu, cardMul 0.82x): aman naikkan ke Heavy/Very Heavy untuk dorongan MID & assist fullback (0% DEF).',
      },
      home: isHome
        ? {
            marking: (isKnockout || isBig || recEdge <= 0) ? 'Very Heavy (+0.08 MID, Merah 1.35×)' : 'Heavy (+0.04 MID, FB Assist+)',
            badge: 'b-good',
            note: 'Wasit Pro-Kandang (#21365): kartu kita 0.85x (-15%) & lawan 1.20x di KANDANG! Aman pilih Heavy/Very Heavy untuk dorongan MID & assist FB.',
          }
        : {
            marking: 'Light (Kartu 0.80×)',
            badge: 'b-warn',
            note: 'Wasit Pro-Kandang (#21365): kartu kita 1.20x (+20%) & tuan rumah 0.85x karena TANDANG! Turunkan ke Light (0.80× merah) atau Shout Calm.',
          },
    };

    const weatherPlan = {
      clear: {
        label: '☀️ Cerah (Normal)',
        note: 'Kondisi ideal — jalankan fokus serangan & manfaatkan hingga 5 pergantian pemain (#21779) saat energi <60%.',
      },
      cloudy: {
        label: '⛅ Berawan (Normal)',
        note: 'Cuaca sejuk/berawan — penalti miss (1.00x) & kuras stamina (1.00x) sama-sama normal; jalankan taktik optimal.',
      },
      rain: {
        label: '🌧️ Hujan (+12% Miss)',
        note: 'Di #21366/#21837, hujan menaikkan missMul 1.12x (+12% tembakan meleset): prioritaskan volume peluang (MID tinggi) & bola mati.',
      },
      heat: {
        label: '🔥 Panas (+12% Kuras Stamina)',
        note: 'Di #21367/#21839, cuaca panas menaikkan energyDrainMul 1.12x (+12% kuras energi): rotasikan 5 sub lebih awal mulai menit 55!',
      },
      snow: {
        label: '❄️ Salju (+18% Miss, +5% Stamina)',
        note: 'Di #21366/#21367, salju menaikkan missMul 1.18x & energyDrainMul 1.05x: kurangi spekulasi jarak jauh dan jaga kesegaran lini tengah.',
      },
    };

    const halftimePlan = {
      win: "Unggul di HT (#4437): Pilih 'Calm' (+2% DEF sepanjang Babak 2) atau 'Encourage' (+2% MID sepanjang Babak 2) — efek berlaku penuh di 1 sektor.",
      draw: "Seri di HT (#4437): Pilih 'Encourage' (+2% MID sepanjang Babak 2) atau 'Demand More' (+2% ATK sepanjang Babak 2).",
      lose: "Tertinggal di HT (#4437): Pilih 'Fire up' / 'Demand More' (+2% ATK sepanjang Babak 2) atau 'Encourage' (+2% MID) + pakai hingga 5 kuota sub!",
    };

    const top3List = candidates.slice(0, 3).map(c => ({
      formation: c.formation,
      baseFormation: c.baseFormation,
      isCustom: c.isCustom,
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
      customRec,
      condFactors: condF,
      condBaseline,
      allCandidates: candidates.map(c => ({
        formation: c.formation,
        baseFormation: c.baseFormation,
        isCustom: c.isCustom,
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
      oppPow: effectiveOppPow,
      aiInfo: finalAi,
      recEdge,
      activeEdge,
      playStyle: recStyle,
      playReason: recStyleWhy,
      playStyleWhy: recStyleWhy,
      styleCompare,
      attackFocus: recFocus,
      focusReason: recFocusWhy,
      attackFocusWhy: recFocusWhy,
      falseNine: useFalseNine,
      falseNineTarget,
      falseNineWhy,
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
    const spec = resolveFormationSpec(activeFormation);
    const slots = spec.slots;
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
          desc: `Kurang starter natural di ${U.posEn(posCode)} (cuma ${naturalPlayers.length}/${minStarter} untuk ${spec.key})`,
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

  // Bytecode #24950 lastInPosition: berlaku untuk SEMUA posisi (!forSale & hanya 1 pemain di sektor/posisi)
  function lastInPosition(p, sellerPlayers = [], bPlayers = []) {
    if (!p || p.forSale) return false;
    const all = [...(Array.isArray(sellerPlayers) ? sellerPlayers : []), ...(Array.isArray(bPlayers) ? bPlayers : [])];
    if (!all.length) return false;
    const pSec = (C.EXACT_CAT && (p.pos in C.EXACT_CAT)) ? C.EXACT_CAT[p.pos] : p.pos;
    const same = all.filter(x => {
      if (!x) return false;
      const xPos = x.pos || x.position;
      const xSec = (C.EXACT_CAT && (xPos in C.EXACT_CAT)) ? C.EXACT_CAT[xPos] : xPos;
      return xSec === pSec;
    });
    return same.length === 1 && same[0].id === p.id;
  }

  // Bytecode #24951 sellerStance (OTA 2.1.0): bobot posisi/peran/keuangan/kontrak/veteran/scarce + keyPlayer buyout
  function sellerStance(p, sellerCtx = {}, buyerCtx = {}, todayDays = null) {
    const sc = (sellerCtx && typeof sellerCtx === 'object') ? sellerCtx : {};
    const bc = (buyerCtx && typeof buyerCtx === 'object') ? buyerCtx : {};
    const cfg = C.SELLER_STANCE || {};
    const sPlayers = Array.isArray(sc.players) ? sc.players : [];
    const bPlayers = Array.isArray(sc.bPlayers) ? sc.bPlayers : [];
    if (!p || !sPlayers.length || !bc) return { mult: 1.0, reasons: [] };

    const sorted = [...sPlayers].sort((a, b) => (U.safeNum(b.force, 0) - U.safeNum(a.force, 0)) || String(a.id).localeCompare(String(b.id)));
    const rankIdx = sorted.findIndex(x => x.id === p.id);
    if (rankIdx < 0) return { mult: 1.0, reasons: [] };
    const rank = rankIdx + 1;

    const topScorer = [...sPlayers].sort((a, b) => (U.safeNum(b.goals, 0) - U.safeNum(a.goals, 0)) || String(a.id).localeCompare(String(b.id)))[0];
    const isTopScorer = Boolean(topScorer && topScorer.id === p.id && U.safeInt(p.goals, 0) >= (cfg.scorerMinGoals || 4));
    const isCap = Boolean(sc.captain && sPlayers.some(x => x.id === p.id && sc.captain === p.id))
      || Boolean(!sc.captain && rank === 1 && sPlayers.length > 0 && p.id === sorted[0].id);
    const isStarter = rank <= (cfg.starters || 11);
    const notForSale = !p.forSale;

    const pSec = (C.EXACT_CAT && (p.pos in C.EXACT_CAT)) ? C.EXACT_CAT[p.pos] : p.pos;
    const sameSector = sPlayers.filter(x => {
      const xp = x.pos || x.position;
      const xs = (C.EXACT_CAT && (xp in C.EXACT_CAT)) ? C.EXACT_CAT[xp] : xp;
      return xs === pSec;
    });
    const isWorldTop = Boolean(p.top);
    const isCraque = Boolean(p.star || p.starAwarded);
    const reasons = [];

    if (notForSale) {
      const w = cfg.weight || {};
      if (isWorldTop) reasons.push({ key: 'worldTop', delta: w.worldTop || 0.20 });
      else if (isCraque) reasons.push({ key: 'craque', delta: w.craque || 0.14 });
      else if (rank <= (cfg.keyTop || 3)) reasons.push({ key: 'keyStarter', delta: w.keyTop || 0.12 });
      else if (isStarter) reasons.push({ key: 'starter', delta: w.starter || 0.08 });
    }
    if (isTopScorer && notForSale) reasons.push({ key: 'topScorer', delta: cfg.topScorer || 0.08 });
    if (notForSale && isCap) reasons.push({ key: 'captain', delta: cfg.captain || 0.03 });
    if (notForSale) {
      const hasCover = sameSector.some(x => x.id !== p.id && (U.safeNum(x.force, 0) + (cfg.scarceGap || 10)) >= U.safeNum(p.force, 0));
      if (!hasCover) reasons.push({ key: 'onlyOne', delta: cfg.onlyOne || 0.06 });
    }
    const teamGames = sPlayers.reduce((m, x) => Math.max(m, U.safeInt(x.gamesPlayed, 0)), 0);
    if (notForSale && teamGames >= (cfg.midGames || 10) && teamGames <= (cfg.endGames || 30)) {
      reasons.push({ key: 'midSeason', delta: cfg.midSeason || 0.04 });
    }

    const sLv = U.safeInt(sc.level, 7);
    const bLv = U.safeInt(bc.level, 7);
    const lvlScales = cfg.levelScale || [1, 0.5, 0.2, 0.1];
    let scale = lvlScales[Math.min(lvlScales.length - 1, Math.max(0, sLv - bLv))];
    const sDiv = U.safeInt(sc.division, 0);
    const bDiv = U.safeInt(bc.division, 0);
    const betterDiv = Boolean(sDiv > 0 && bDiv > 0 && sDiv < bDiv);
    if (betterDiv) scale = Math.min(scale, cfg.betterDivisionScale || 0.2);

    const rawPosDelta = reasons.reduce((s, r) => s + r.delta, 0);
    if (rawPosDelta > 0 && scale < 1) {
      reasons.push({ key: 'bigBuyer', delta: -rawPosDelta * (1 - scale) });
    }
    if (p.forSale) reasons.push({ key: 'forSale', delta: 0 });

    let cashCrisis = false;
    const budget = U.safeNum(sc.budget, NaN);
    const payroll = sPlayers.reduce((s, x) => s + U.safeNum(x.salary, 0), 0);
    if (Number.isFinite(budget)) {
      if (budget < 0) {
        reasons.push({ key: 'redCash', delta: -(cfg.redCash || 0.20) });
        cashCrisis = true;
      } else if (payroll > 0 && budget < (cfg.poorMonths || 3) * payroll) {
        reasons.push({ key: 'poorCash', delta: -(cfg.poorCash || 0.10) });
        cashCrisis = true;
      }
    }

    const cDays = U.safeInt(p.contractDays, 999);
    if (cDays > 0 && cDays <= 365) {
      reasons.push({ key: 'contractEnds', delta: -(cfg.contractEnds || 0.08) });
    }
    const age = U.safeInt(p.age, 25);
    if (age >= (cfg.veteranFrom || 32)) {
      const vetDisc = Math.min(cfg.veteranMax || 0.20, (age - (cfg.veteranFrom || 32) + 1) * (cfg.veteranPerYear || 0.05));
      reasons.push({ key: 'veteran', delta: -vetDisc });
    }

    let scarceDelta = 0;
    if (notForSale) {
      const allSec = [...sPlayers, ...bPlayers].filter(x => {
        const xp = x.pos || x.position;
        const xs = (C.EXACT_CAT && (xp in C.EXACT_CAT)) ? C.EXACT_CAT[xp] : xp;
        return xs === pSec;
      });
      if (allSec.length === 2) {
        const other = allSec.find(x => x.id !== p.id);
        const scCfg = cfg.scarce || { starter: 0.50, backup: 0.30 };
        scarceDelta = (other && U.safeNum(other.force, 0) > U.safeNum(p.force, 0)) ? (scCfg.backup || 0.30) : (scCfg.starter || 0.50);
        if (scarceDelta > 0) reasons.push({ key: 'scarce', delta: scarceDelta });
      }
    }

    const baseSum = reasons.filter(r => r.key !== 'scarce').reduce((s, r) => s + r.delta, 0);
    const clampedBase = U.clamp(1 + baseSum, 1 - (cfg.maxDiscount || 0.30), 1 + (cfg.maxPremium || 0.50));
    let mult = clampedBase + scarceDelta;

    const paidIn = p.paidIn;
    if (paidIn && sc.id && paidIn.teamId === sc.id && todayDays !== null && todayDays <= paidIn.until && (paidIn.price || 0) > Math.round((p.marketValue || 0) * mult)) {
      reasons.unshift({ key: 'paidRecently', delta: 0 });
    }

    const out = { mult: U.roundTo(mult, 2), reasons };
    if (notForSale && !cashCrisis && rank <= (cfg.refuseTop || 3) && (isWorldTop || isTopScorer) && bLv >= sLv && !betterDiv) {
      const rc = U.releaseClauseOf(p.marketValue, sc.country || p.nationality, (paidIn && paidIn.price) || 0);
      out.refuse = 'keyPlayer';
      out.buyout = rc.amount;
      out.reasons.unshift({ key: 'keyPlayer', delta: 0 });
    }
    return out;
  }

  // Bytecode #24934 transferPolicy: matriks reputasi Eropa (cg=0) & non-Eropa
  // Mengembalikan string status ('ok'|'doubleSalary'|'refuse') atau objek compat jika dipanggil dengan signature lama
  function transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers = null, posCount = null, playerRankInClub = 99, sellerRep = 50, buyerRep = 50, sellerDiv = 1) {
    if (!p && !sellerCountry) return { status: 'OK', mult: 1.0, reason: null, clubPolicy: 'ok' };

    const sPlayers = Array.isArray(sellerPlayers) ? sellerPlayers : [];
    if (p && sPlayers.length > 0 && lastInPosition(p, sPlayers)) {
      return { status: 'REFUSE', mult: 2.0, reason: 'lastInPosition', clubPolicy: 'refuse' };
    }
    if (p && posCount !== null && posCount !== undefined && posCount <= 1 && !p.forSale) {
      return { status: 'REFUSE', mult: 2.0, reason: 'lastInPosition', clubPolicy: 'refuse' };
    }

    const gBuyer = buyerCountry ? Math.max(0, U.countryGroup(buyerCountry)) : 0;
    const gSeller = sellerCountry ? Math.max(0, U.countryGroup(sellerCountry)) : 1;
    const bRep = U.reputationLevel(buyerRep);
    const sRep = U.reputationLevel(sellerRep);
    let clubPolicy = 'ok';
    if (gBuyer !== 0) {
      if (sellerCountry && gSeller === 0 && bRep >= 4) {
        if (sRep >= 4) clubPolicy = 'ok';
        else if (U.safeInt(sellerDiv, 1) === 1) clubPolicy = 'ok';
        else if (sRep >= 3) clubPolicy = 'doubleSalary';
        else clubPolicy = 'refuse';
      } else if (bRep >= 3 && sRep >= 3) {
        clubPolicy = 'ok';
      } else if (bRep === 3 && (sRep === 2 || sRep === 1)) {
        clubPolicy = 'ok';
      } else if (bRep <= 2) {
        clubPolicy = 'ok';
      } else {
        clubPolicy = 'refuse';
      }
    }

    if (clubPolicy === 'refuse') {
      return { status: 'REFUSE', mult: 2.0, reason: 'transferPolicy', clubPolicy: 'refuse' };
    }

    const stance = sPlayers.length
      ? sellerStance(p, { level: sellerLevel, division: sellerDiv, country: sellerCountry, players: sPlayers }, { level: buyerLevel })
      : null;

    let mult = stance ? stance.mult : (p && p.forSale ? 1.0 : 1.0);
    if (!stance && p && !p.forSale) {
      const isTopOrStar = Boolean(p.top || p.star || p.starAwarded);
      const isTop3 = U.safeInt(playerRankInClub, 99) <= 3;
      const isStarter = U.safeInt(playerRankInClub, 99) <= 11;
      if (isTopOrStar) mult += 0.14;
      else if (isTop3) mult += 0.12;
      else if (isStarter) mult += 0.08;
      if ((posCount || 3) === 2) mult += 0.30;
    }

    const age = U.safeInt(p && p.age, 24);
    const isTopOrStar = Boolean(p && (p.top || p.star || p.starAwarded));
    const isKeyTop = Boolean(isTopOrStar || U.safeInt(playerRankInClub, 99) <= 3);
    const isYoungStar = Boolean(age <= 22 && (((p && p.potential) || 0) >= ((p && p.force) || 0) + 10 || ((p && p.hash) || 0) >= 8 || isTopOrStar));

    return {
      status: 'OK',
      mult: U.roundTo(Math.min(2.5, mult), 2),
      reason: stance && stance.refuse ? stance.refuse : null,
      buyout: stance && stance.buyout ? stance.buyout : 0,
      reasons: stance ? stance.reasons : [],
      clubPolicy,
      isKeyTop,
      isYoungStar,
    };
  }

  // Bytecode #24936 refusesDistance (TANPA cutoff usia; slack = clamp(contSlack, 0, 5) + bonus)
  function refusesDistance(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, slackBonus = 0, buyerDiv = 1, contSlack = 0) {
    if (!sellerCountry || !buyerCountry) return false;
    const sC = String(sellerCountry).toUpperCase();
    const bC = String(buyerCountry).toUpperCase();
    const pNat = String((p && p.nationality) || '').toUpperCase();

    if (U.sameCountry(sC, bC)) return false;
    if (pNat && U.sameCountry(pNat, bC)) return false;

    const slack = U.clamp(U.safeInt(slackBonus, 0), 0, 10) + U.clamp(U.safeInt(contSlack, 0), 0, 5);
    const sLv = U.safeInt(sellerLevel, 7);
    const bLv = U.safeInt(buyerLevel, 7);
    const bDiv = U.safeInt(buyerDiv, 1);
    const aff = U.hasAffinity(sC, bC) || Boolean(pNat && U.hasAffinity(pNat, bC));
    if (aff) {
      return bLv < sLv - 3 - slack;
    }
    if (bDiv < 1 || bDiv > 2) return true;
    return bLv < sLv - slack;
  }

  // Bytecode #24939 refusesStatus (STAR_PULL: gap >= 5 + top-5/star/top -> menolak pindah)
  function refusesStatus(p, sellerLevel, buyerLevel, playerRankInClub = 99, slack = 0) {
    const sp = C.STAR_PULL || { minGap: 5, top: 5 };
    const sLv = U.safeInt(sellerLevel, 7);
    const bLv = U.safeInt(buyerLevel, 7);
    if ((sLv - bLv - slack) < (sp.minGap || 5)) return false;
    return Boolean(isPlayerStar(p) || (p && p.top) || U.safeInt(playerRankInClub, 99) <= (sp.top || 5));
  }

  // Bytecode #24938 userBuyPolicy (#24934 + #24939 refusesStatus + #24936 refusesDistance + ceil -> doubleSalary)
  function userBuyPolicy(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, buyerRep, buyerDiv, sellerPlayers = null, posCount = null, isUnattached = false, extra = null) {
    const ex = (extra && typeof extra === 'object') ? extra : {};
    const rankInClub = U.safeInt(ex.rankInClub, 99);
    const avgTop11 = U.safeNum(ex.avgTop11, 0);
    const ctLevel = U.safeInt(ex.ctLevel, 1);

    const pol = isUnattached
      ? { status: 'OK', mult: 1.0, reason: null, clubPolicy: 'ok', isKeyTop: Boolean(p.top || p.star), isYoungStar: false }
      : transferPolicy(p, sellerCountry, buyerCountry, buyerLevel, sellerLevel, sellerPlayers, posCount, rankInClub, ex.sellerRep, buyerRep, ex.sellerDiv);
    if (pol.status === 'REFUSE') {
      return { ...pol, code: pol.reason === 'lastInPosition' ? 'LAST_POS' : 'REFUSE_POLICY' };
    }

    const sLv = isUnattached ? U.clamp(Math.round(((p.force || 50) - 18) / 7), 1, 10) : U.safeInt(sellerLevel, 7);
    const bLv = U.safeInt(buyerLevel, 7);
    const sCountry = isUnattached ? (p.nationality || '') : sellerCountry;
    const bDiv = U.safeInt(buyerDiv, 1);

    if (refusesStatus(p, sLv, bLv, rankInClub, 0)) {
      return { status: 'REFUSE', mult: pol.mult, reason: 'refuseLevel', code: 'REFUSE_LVL', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
    }
    if (!isUnattached && refusesDistance(p, sCountry, buyerCountry, sLv, bLv, 0, bDiv, ex.contSlack || 0)) {
      return { status: 'REFUSE', mult: pol.mult, reason: 'refuseDistance', code: 'REFUSE_DIST', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
    }

    const ceil = buyerForceCeiling(buyerRep, buyerDiv, avgTop11, ctLevel);
    let doubleSalary = pol.clubPolicy === 'doubleSalary';
    if ((p.force || 0) > ceil + 5) {
      return { status: 'REFUSE', mult: pol.mult, reason: 'refuseLevel', code: 'REFUSE_LVL', isKeyTop: pol.isKeyTop, isYoungStar: pol.isYoungStar };
    }
    if ((p.force || 0) > ceil) {
      doubleSalary = true;
    }

    return {
      status: 'OK',
      mult: pol.mult,
      reason: pol.reason || null,
      buyout: pol.buyout || 0,
      reasons: pol.reasons || [],
      code: doubleSalary ? 'CEIL_2X' : 'OK',
      doubleSalary,
      salaryMul: doubleSalary ? 2.0 : 1.0,
      ceilMult: 1.0,
      isKeyTop: pol.isKeyTop,
      isYoungStar: pol.isYoungStar,
    };
  }

  // Bytecode #24940 buyPersuadable: BUY_PERSUADE { levelGap: 2, forceOver: 5, wageFloor: 2.5 }
  function buyPersuadable(p, sellerCountry, buyerCountry, sellerLevel, buyerLevel, pol, extra = null) {
    if (!pol || pol.status !== 'REFUSE') return false;
    if (pol.reason === 'lastInPosition' || pol.reason === 'onlyGoalkeeper' || pol.reason === 'domesticRival' || pol.reason === 'transferPolicy') return false;
    if (pol.reason !== 'refuseLevel' && pol.reason !== 'refuseDistance') return false;
    const ex = (extra && typeof extra === 'object') ? extra : {};
    const bp = C.BUY_PERSUADE || { levelGap: 2, forceOver: 5 };
    const bLv = U.safeInt(buyerLevel, 7);
    const sLv = U.safeInt(sellerLevel, 7);
    const bDiv = U.safeInt(ex.buyerDiv, 1);
    const rankInClub = U.safeInt(ex.rankInClub, 99);

    if (refusesDistance(p, sellerCountry, buyerCountry, sLv, bLv, bp.levelGap || 2, bDiv, ex.contSlack || 0)) return false;
    if (refusesStatus(p, sLv, bLv, rankInClub, bp.levelGap || 2)) return false;

    if (ex.buyerRep !== undefined) {
      const ceil = buyerForceCeiling(ex.buyerRep, bDiv, ex.avgTop11 || 0, ex.ctLevel || 1);
      if ((p.force || 0) > ceil + 5 + (bp.forceOver || 5)) return false;
    }
    return true;
  }

  // Bytecode #24941 persuadeChance: base 0.25 + starterBonus + perWage + perPrice (maks 0.85)
  function persuadeChance(p, sellerLevel, buyerLevel, buyerRep, buyerDiv, wageMul = 2.5, priceMul = 1.5, role = 'starter', ex = null) {
    const bp = C.BUY_PERSUADE || {};
    const cfgEx = (ex && typeof ex === 'object') ? ex : {};
    const ceil = buyerForceCeiling(buyerRep, buyerDiv, cfgEx.avgTop11 || 0, cfgEx.ctLevel || 1);
    const forceGap = Math.max(0, U.safeNum(p && p.force, 0) - ceil);
    const priceGap = priceMul > 0 ? Math.max(0, (priceMul / (wageMul > 0 ? 1 : 1)) - 1) : 0;
    const bonus = (role === 'starter' ? (bp.starterBonus || 0.15) : 0);
    const prob = (bp.base || 0.25) + bonus + (forceGap / 0.1) * (bp.perWage || 0.05) * 0.01 + (priceGap / 0.1) * (bp.perPrice || 0.06);
    const gapLv = Math.max(0, U.safeInt(sellerLevel, 7) - U.safeInt(buyerLevel, 7));
    const adjusted = prob - Math.max(0, gapLv - 2) * 0.04;
    return U.roundTo(U.clamp(adjusted, bp.base || 0.25, bp.max || 0.85), 2);
  }

  /**
   * Simulasi cepat dampak perubahan skuad (Cart / What-If Transfer) terhadap Win%, xPts, xG,
   * formasi terbaik, dan kekuatan sektor terhadap lawan acuan (`oppPow`) via #21822 + #48031.
   */
  function evaluateSquadImpact(simRoster, oppPow, opts = {}) {
    const isHome = opts.isHome !== undefined ? Boolean(opts.isHome) : true;
    const neutral = Boolean(opts.neutral);
    const oppStyle = String(opts.oppStyle || 'Balanced');
    const oppFocus = String(opts.oppFocus || 'Center');
    const foreignCap = U.safeInt(opts.foreignCap, 7);
    const userCountry = String(opts.userCountry || '');
    const repLevel = U.safeInt(opts.repLevel, 3);
    const formList = Array.isArray(opts.formations) && opts.formations.length
      ? [...opts.formations]
      : Object.keys(C.FORMATIONS).filter(fk => !(C.FORMATION_BUGS && C.FORMATION_BUGS[fk] && C.FORMATION_BUGS[fk].hasBug));
    if (opts.activeFormationRaw && String(opts.activeFormationRaw).includes('~') && !formList.includes(opts.activeFormationRaw)) {
      formList.push(opts.activeFormationRaw);
    }

    let best = null;
    for (const fk of formList) {
      const xiRes = solveBestXi(simRoster, fk, foreignCap, userCountry, null, false, repLevel);
      const uPowBase = computeEngineSectorPower(xiRes, fk, {
        isHome, crowdOver70: true, style: 'Balanced', marking: 'Heavy',
      });
      const simC = simulateMatchExpectation(uPowBase, oppPow, {
        isHome, neutral, focus: 'Center', oppFocus, style: 'Balanced', oppStyle,
      });
      const simW = simulateMatchExpectation(uPowBase, oppPow, {
        isHome, neutral, focus: 'Wings', oppFocus, style: 'Balanced', oppStyle,
      });
      const optFocus = simC.xPts >= simW.xPts ? 'Center' : 'Wings';
      const sim = optFocus === 'Center' ? simC : simW;
      const wfPen = xiRes.wrongFootCount * 0.002;
      const score = sim.xPts - wfPen;
      if (!best || score > best.score) {
        best = {
          score,
          formation: fk,
          xiRes,
          uPow: { ...uPowBase, ATK: sim.effAtkUser },
          optFocus,
          optStyle: 'Balanced',
          sim,
        };
      }
    }

    if (!best) return null;

    // Cek juga apakah Offensive atau Counter-Attack memberi xPts lebih tinggi pada formasi terbaik
    let bestStyle = 'Balanced';
    let bestSim = best.sim;
    let bestPow = best.uPow;
    for (const stTry of ['Offensive', 'Counter-Attack', 'Defensive']) {
      const pTry = computeEngineSectorPower(best.xiRes, best.formation, {
        isHome, crowdOver70: true, style: stTry, marking: 'Heavy',
      });
      const sTry = simulateMatchExpectation(pTry, oppPow, {
        isHome, neutral, focus: best.optFocus, oppFocus, style: stTry, oppStyle,
      });
      if (sTry.xPts >= bestSim.xPts + 0.012) {
        bestStyle = stTry;
        bestSim = sTry;
        bestPow = { ...pTry, ATK: sTry.effAtkUser };
      }
    }

    // Cek opsi False Nine (#42849 picker: hanya MA/ATA/SA di lini depan; #22453) pada formasi & gaya terbaik
    let falseNineTarget = null;
    const F9_POS_IMP = ['MA', 'MO', 'ATA', 'A', 'SA'];
    const atkItems = (best.xiRes.xi || []).filter(it => it.sectorCode === 'A' && it.player);
    const f9EligImp = atkItems.filter(it => F9_POS_IMP.includes(String(it.player.pos || '').toUpperCase()));
    if (atkItems.length >= 2 && f9EligImp.length > 0) {
      for (const it of f9EligImp) {
        const p = it.player;
        const pF9 = computeEngineSectorPower(best.xiRes, best.formation, {
          isHome, crowdOver70: true, style: bestStyle, marking: 'Heavy', falseNineId: p.id,
        });
        const sF9 = simulateMatchExpectation(pF9, oppPow, {
          isHome, neutral, focus: best.optFocus, oppFocus, style: bestStyle, oppStyle,
        });
        if (sF9.xPts >= bestSim.xPts + 0.005) {
          bestSim = sF9;
          bestPow = { ...pF9, ATK: sF9.effAtkUser };
          falseNineTarget = { id: p.id, name: p.name, pos: U.posEn(p.pos) };
        }
      }
    }

    return {
      formation: best.formation,
      avgScore: best.xiRes.avgScore,
      chemistry: best.xiRes.chemistry,
      wrongFootCount: best.xiRes.wrongFootCount,
      xiIds: (best.xiRes.xi || []).map(a => a.player.id),
      xiSummary: (best.xiRes.xi || []).map(a => ({
        id: a.player.id,
        name: a.player.name,
        slot: a.slot,
        pos: a.player.pos,
        force: a.player.force,
      })),
      winPct: bestSim.winPct,
      drawPct: bestSim.drawPct,
      lossPct: bestSim.lossPct,
      xPts: bestSim.xPts,
      xGF: bestSim.xGF,
      xGA: bestSim.xGA,
      possPct: bestSim.possPct,
      optFocus: best.optFocus,
      optStyle: bestStyle,
      falseNineTarget,
      uPow: bestPow,
    };
  }

  /**
   * Morale Tim & Bonus Glow (OTA 01a20f1b: buildSide #22235 & effectiveSectors #22238):
   * - Kumpulkan rating pemain XI (>=6 pemain punya rating > 0; jika < 6 maka baseMorale = 0)
   * - baseMorale = clamp(-1, +1, (avgRating - 6.3) / 1.2)
   * - glowV = (bonusGlow && bonusGlow.left > 0) ? Number(bonusGlow.v || 0) : 0
   * - totalMorale = clamp(-1, +1, baseMorale + glowV) -> rawMid *= (1 + 0.03 * totalMorale)
   */
  function computeTeamMoraleV9(xiPlayers, bonusGlow = null, fallbackRatingsMap = null) {
    const list = Array.isArray(xiPlayers) ? xiPlayers : [];
    const ratings = [];
    for (const item of list) {
      const p = (item && item.player) ? item.player : item;
      if (!p) continue;
      let r = U.safeNum(p.avgRating, 0);
      if (r <= 0 && fallbackRatingsMap) {
        const keyId = p.id ? String(p.id) : '';
        const keyNm = p.name ? String(p.name).toLowerCase() : '';
        const fb = (keyId && fallbackRatingsMap.get(keyId)) || (keyNm && fallbackRatingsMap.get(keyNm)) || 0;
        r = U.safeNum(fb, 0);
      }
      if (r > 0) ratings.push(r);
    }
    const ratedCount = ratings.length;
    const avgRating = ratedCount > 0
      ? U.roundTo(ratings.reduce((a, b) => a + b, 0) / ratedCount, 2)
      : 0;
    const baseMorale = ratedCount >= 6
      ? U.roundTo(U.clamp((avgRating - 6.3) / 1.2, -1.0, 1.0), 3)
      : 0.0;
    const glowLeft = (bonusGlow && typeof bonusGlow === 'object') ? Math.max(0, U.safeInt(bonusGlow.left, 0)) : 0;
    const glowV = glowLeft > 0 ? U.roundTo(U.safeNum(bonusGlow.v, 0), 3) : 0.0;
    const totalMorale = U.roundTo(U.clamp(baseMorale + glowV, -1.0, 1.0), 3);
    const winSimMorale = U.roundTo(U.clamp(baseMorale + 0.30, -1.0, 1.0), 3);
    const missSimMorale = U.roundTo(U.clamp(baseMorale - 0.20, -1.0, 1.0), 3);
    const headroom = U.roundTo(Math.max(0, 1.0 - baseMorale), 3);
    const winGainMorale = U.roundTo(Math.max(0, winSimMorale - baseMorale), 3);
    return {
      avgRating,
      ratedCount,
      hasEnoughRatings: ratedCount >= 6,
      baseMorale,
      glowV,
      glowLeft,
      totalMorale,
      midBoostPct: U.roundTo(totalMorale * 3.0, 2),
      baseMidBoostPct: U.roundTo(baseMorale * 3.0, 2),
      headroom,
      isCapped: baseMorale >= 0.95,
      winSimMorale,
      winSimMidBoostPct: U.roundTo(winSimMorale * 3.0, 2),
      winGainMidPct: U.roundTo(winGainMorale * 3.0, 2),
      missSimMorale,
      missSimMidBoostPct: U.roundTo(missSimMorale * 3.0, 2),
      missDropMidPct: U.roundTo((baseMorale - missSimMorale) * 3.0, 2),
    };
  }

  LF.tactics = {
    repToLevel,
    evalSkillStacking,
    evalSkillStackingForSector,
    integrationOf,
    rhythmOf,
    teamChemistry,
    chemistryMul,
    arriveAtClubInit,
    computeSquadMoodsV9,
    computeTeamMoraleV9,
    slotCompatFactor,
    isPlayerStar,
    evalPlayerForSlot,
    auditSetPieces,
    parseFormationKey,
    resolveFormationSpec,
    resolveMatchCondFactors,
    solveBestXi,
    computeEngineSectorPower,
    simulateMatchExpectation,
    optimizeCustomSlots,
    predictAiTacticsDetail,
    predictAiTactics,
    recommendMatchupForOpponent,
    evaluateSquadImpact,
    detectSquadHoles,
    buyerForceCeiling,
    lastInPosition,
    sellerStance,
    transferPolicy,
    refusesDistance,
    refusesStatus,
    userBuyPolicy,
    buyPersuadable,
    persuadeChance,
  };
})(typeof window !== 'undefined' ? window : globalThis);
