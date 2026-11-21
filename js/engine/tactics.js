/**
 * LigaFoot Optimizer Web Engine — tactics.js
 * Port eksak 1:1 dari optimizer/engine_tactics.py (v7.2 / v8.0):
 * - Skill stacking valid (DES+MAR & PAS+ARM non-stack).
 * - squadMoods v9 (#21546 squadRole/roleSore) & lockerRoomHit (#21552 >= 4).
 * - entryValue eksak (#21882): berbasis Force murni, outOfPos=0.70, wrongFoot
 *   khusus Fullback LD/LE (-5%), star/top per repLevel, unhappy -3%, fineSlump.
 * - Solver Best XI (2-opt + foreign-vs-local swap), Rotation XI (pickScore vs
 *   trueScore), False Nine (#35253), & War Room H2H 15 Formasi (#3492 + #23795).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;

  function repToLevel(reputation) {
    const r = U.safeNum(reputation, 50);
    if (r >= 80) return 5;
    if (r >= 65) return 4;
    if (r >= 45) return 3;
    if (r >= 25) return 2;
    return 1;
  }

  function evalSkillStacking(pos, s1Raw, s2Raw) {
    const cat = (pos in C.EXACT_CAT) ? C.EXACT_CAT[pos] : 3;
    const s1 = String(s1Raw || '').toUpperCase();
    const s2 = String(s2Raw || '').toUpperCase();
    const skills = new Set([s1, s2].filter(Boolean));

    if (cat === 0) {
      let bonus = 1.0;
      const notes = [];
      if (s1 === 'REF' || s1 === 'COL') {
        bonus *= 1.04;
        notes.push(`${U.skillEn(s1)}(s1)+4%`);
      } else if (s1 === 'SAI') {
        bonus *= 1.02;
        notes.push('RUS+2%');
      }
      if (s2 === 'REF' || s2 === 'COL') {
        bonus *= 1.02;
        notes.push(`${U.skillEn(s2)}(s2)+2%`);
      } else if (s2 === 'SAI') {
        bonus *= 1.02;
        notes.push('RUS+2%');
      }
      if (skills.has('DPE')) notes.push('PEN(+8% penalti)');
      const pct = U.roundTo((bonus - 1.0) * 100, 2);
      const grade = pct >= 5.5 ? 'GOD' : (pct >= 3.5 ? 'GOOD' : 'STD');
      return { pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    if (cat === 1 || cat === 2) {
      const nonStack = skills.has('DES') && skills.has('MAR');
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
        return { pct, grade: 'NON-STACK', nonStack: true, note: 'TCK+MRK tidak stack (cuma +5%)' };
      }
      const grade = (pct >= 7.0 || (pct >= 5.0 && skills.has('RES'))) ? 'GOD' : (pct >= 4.0 ? 'GOOD' : 'STD');
      return { pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    if (cat === 3) {
      const nonStack = skills.has('PAS') && skills.has('ARM');
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
      if (skills.has('DES') || skills.has('MAR')) {
        bonus *= 1.02;
        notes.push('Def+2%');
      }
      if (skills.has('RES')) notes.push('STA(-40% lelah)');
      if (skills.has('FIN')) notes.push('FIN(+5% konv)');
      const pct = U.roundTo((bonus - 1.0) * 100, 2);
      if (nonStack) {
        return { pct, grade: 'NON-STACK', nonStack: true, note: 'PAS+PLY tidak stack (cuma +3%)' };
      }
      const grade = (pct >= 5.0 || (pct >= 3.0 && skills.has('RES'))) ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD');
      return { pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
    }

    // cat === 4: Penyerang / Sayap (semua stack!)
    let bonus = 1.0;
    const notes = [];
    if (skills.has('DRI')) { bonus *= 1.03; notes.push('DRI+3%'); }
    if (skills.has('CAB')) { bonus *= 1.03; notes.push('HDG+3%'); }
    if (skills.has('VEL')) { bonus *= 1.02; notes.push('PAC+2%'); }
    if (skills.has('FIN')) { bonus *= 1.035; notes.push('FIN(+5% konv)'); }
    if (skills.has('RES')) notes.push('STA(-40% lelah)');
    if (skills.has('CRU')) notes.push('CRS(Corner)');
    const pct = U.roundTo((bonus - 1.0) * 100, 2);
    const grade = pct >= 5.5 ? 'GOD' : (pct >= 3.0 ? 'GOOD' : 'STD');
    return { pct, grade, nonStack: false, note: notes.join(' ') || 'Standar' };
  }

  function computeSquadMoodsV9(players, isAi = false) {
    const active = (players || []).filter(p => !p.isYouth);
    if (!active.length) return { moods: {}, unhappyCount: 0, lockerHit: 0.0 };

    const hasMins = active.some(p => U.safeNum(p.seasonMinutes, 0) > 0);
    let maxGames = 0;
    let maxMins = 0;
    for (const p of active) {
      const gp = U.safeInt(p.gamesPlayed, 0);
      const sm = U.safeNum(p.seasonMinutes, 0);
      if (gp > maxGames) maxGames = gp;
      if (sm > maxMins) maxMins = sm;
    }

    if (isAi && !hasMins) {
      const moods = {};
      let unhappyCnt = 0;
      for (const p of active) {
        const mf = p.moodFrom;
        let isUnh = false;
        if (Array.isArray(mf) && mf.length >= 2) {
          const tg = Math.max(1, U.safeNum(mf[0], 0));
          if (U.safeInt(p.age, 25) > 19 && !p.injured) {
            if (U.safeNum(p.seasonMinutes, 0) === 0 && tg >= 6) isUnh = true;
          }
        }
        if (p.roleSore) isUnh = true;
        moods[p.id] = {
          mood: isUnh ? 'unhappy' : 'ok',
          tier: 0, minPct: 0.0, reqPct: 0.0,
          immune: !isUnh,
          reason: isUnh ? 'AI moodFrom' : 'AI normal',
        };
        if (isUnh) unhappyCnt++;
      }
      const hit = Math.min(0.04, Math.max(0, unhappyCnt - (C.LOCKER_UNHAPPY_MIN - 1)) * 0.01);
      return { moods, unhappyCount: unhappyCnt, lockerHit: hit };
    }

    const teamGames = Math.max(maxGames, Math.ceil(maxMins / 90.0));
    const gks = active.filter(p => p.pos === 'G').sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));
    const outfields = active.filter(p => p.pos !== 'G').sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));

    const natTier = {};
    if (gks.length) natTier[gks[0].id] = 2;
    outfields.forEach((p, idx) => {
      natTier[p.id] = idx < 10 ? 2 : (idx < 17 ? 1 : 0);
    });

    const moods = {};
    let unhappyCnt = 0;

    for (const p of active) {
      const pid = p.id;
      const age = U.safeInt(p.age, 25);
      const injured = Boolean(p.injured);
      const sRole = String(p.squadRole || '');
      const roleSore = Boolean(p.roleSore);

      const mf = p.moodFrom;
      const baseG = (Array.isArray(mf) && mf.length >= 1) ? U.safeNum(mf[0], 0) : 0;
      const baseM = (Array.isArray(mf) && mf.length >= 2) ? U.safeNum(mf[1], 0) : 0;

      const injGames = Math.floor(U.safeNum(p.seasonInjuryDays, 0) / 5.0);
      const effGames = Math.max(0, (teamGames - Math.min(teamGames, baseG)) - Math.min(Math.max(0, teamGames - baseG), injGames));

      const mins = Math.max(0.0, U.safeNum(p.seasonMinutes, 0) - baseM);
      const ratio = (effGames > 0 && hasMins)
        ? (mins / (effGames * 90.0))
        : (effGames > 0 ? U.safeNum(p.gamesPlayed, 0) / effGames : 1.0);

      let tier = 0;
      let immuneReason = '';
      if (injured || age <= 19) {
        tier = 0;
        immuneReason = injured ? 'Cedera' : 'Usia <=19';
      } else {
        tier = (pid in natTier) ? natTier[pid] : 0;
        immuneReason = (p.pos === 'G' && tier === 0) ? 'GK Cadangan' : (tier === 0 ? 'Rank #18+' : '');
      }

      if (!injured) {
        if (roleSore || sRole === 'starter') {
          tier = 2;
          immuneReason = roleSore ? 'roleSore!' : 'Role Starter';
        } else if (sRole === 'reserve') {
          tier = 0;
          immuneReason = 'Role Reserve (Kebal)';
        } else if (sRole === 'rotation') {
          tier = Math.min(tier, 1);
          immuneReason = 'Role Rotation (8%)';
        }
      }

      const reqRatio = tier === 2 ? 0.25 : (tier === 1 ? 0.08 : 0.0);
      let mood = 'ok';
      if (teamGames >= 4 && effGames >= 4) {
        if ((tier === 2 && ratio < 0.25) || (tier === 1 && ratio < 0.08)) {
          mood = 'unhappy';
        } else if (ratio >= 0.60 || (tier === 1 && ratio >= 0.35) || (tier === 0 && ratio >= 0.15)) {
          mood = 'happy';
        }
      }

      if (mood === 'unhappy') unhappyCnt++;
      moods[pid] = {
        mood,
        tier,
        minPct: U.roundTo(U.clamp(ratio * 100.0, 0.0, 100.0), 1),
        reqPct: U.roundTo(reqRatio * 100.0, 1),
        immune: tier === 0,
        reason: immuneReason || (tier === 2 ? 'Starter >=25%' : 'Pelapis >=8%'),
        squadRole: sRole,
        roleSore,
      };
    }

    const lockerHit = Math.min(0.04, Math.max(0, unhappyCnt - (C.LOCKER_UNHAPPY_MIN - 1)) * 0.01);
    return { moods, unhappyCount: unhappyCnt, lockerHit };
  }

  function slotCompatFactor(pPos, slotPos, foot) {
    const pCat = (pPos in C.EXACT_CAT) ? C.EXACT_CAT[pPos] : 3;
    const sCat = (slotPos in C.EXACT_CAT) ? C.EXACT_CAT[slotPos] : 3;

    let posMul = 0.70; // penalti resmi outOfPosition (#21882)
    if (pPos === slotPos) posMul = 1.00;
    else if (pCat === sCat) posMul = 0.99;
    else if (pCat === 0 || sCat === 0) posMul = 0.35;

    // Penalti wrongFoot (-5%) HANYA berlaku di Fullback (LD / LE)
    const pref = C.SLOT_FOOT_PREF[slotPos];
    const footU = String(foot || 'D').toUpperCase();
    const wrongFoot = Boolean(pref && footU && footU !== pref && (footU === 'D' || footU === 'E'));
    const footMul = (wrongFoot && pCat === sCat) ? 0.95 : 1.00;
    return { mul: posMul * footMul, wrongFoot };
  }

  function evalPlayerForSlot(p, slotPos, repLevel = 3) {
    const { mul: compat, wrongFoot } = slotCompatFactor(p.pos, slotPos, p.foot || 'D');
    const stackMul = 1.0 + (U.safeNum(p.stackPct, 0) / 100.0);
    const energy = U.safeNum(p.energy, 100);
    const energyMul = energy >= 80 ? 1.0 : (energy >= 65 ? 0.96 : (energy >= 50 ? 0.90 : 0.80));

    // Bug 1 Fix: selalu berbasis p.force (bukan effForce) sesuai #21882 rulesForce
    const base = U.safeNum(p.force, 0);

    let starMul = 1.0;
    if (p.top) starMul = repLevel > 3 ? 1.10 : 1.05;
    else if (p.star) starMul = repLevel > 3 ? 1.05 : 1.02;

    const unhappyMul = p.mood === 'unhappy' ? 0.97 : 1.0;
    const slumpVal = U.clamp(U.safeNum(p.fineSlump, 0.0), 0.0, C.FINE_SLUMP_CAP);
    const slumpMul = 1.0 - slumpVal;

    const score = base * compat * stackMul * energyMul * starMul * unhappyMul * slumpMul;
    return { score, wrongFoot };
  }

  function rotationPriorityMul(p, slotPos, rotationMode) {
    if (!rotationMode || slotPos === 'G') return 1.0;
    let mul = 1.0;
    const energy = U.safeNum(p.energy, 100);
    const tier = p.moodTier || 0;
    const mpct = U.safeNum(p.minPct, 100.0);
    const gap = U.safeInt(p.potCap, p.force) - U.safeInt(p.force, 0);

    const has2Y = Object.values(p.cardsByComp || {}).some(
      v => v && typeof v === 'object' && U.safeInt(v.y, 0) >= 2 && U.safeInt(v.s, 0) === 0
    );

    if (has2Y) mul *= 0.86;
    if (energy < 90) mul *= 0.88;
    else if (energy < 95) mul *= 0.94;
    else if (energy >= 97 && mpct < 65.0) mul *= 1.12;

    if (tier === 1 && mpct < 25.0) mul *= 1.14;
    else if (p.age <= 21 && gap >= 5) mul *= 1.13;
    else if (mpct < 40.0) mul *= 1.06;

    return mul;
  }

  function detectFalseNine(xiPlayers) {
    const f9 = (xiPlayers || [])
      .filter(p => (p.pos === 'ATA' || p.pos === 'SA') && (p.s1 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'PAS' || p.s2 === 'ARM'))
      .map(p => p.name);
    return { active: f9.length >= 2, players: f9 };
  }

  function pickMaxBy(arr, keyFn) {
    let best = null;
    let bestKey = null;
    for (const item of arr) {
      const k = keyFn(item);
      if (best === null) {
        best = item;
        bestKey = k;
      } else {
        for (let i = 0; i < k.length; i++) {
          if (k[i] > bestKey[i]) { best = item; bestKey = k; break; }
          if (k[i] < bestKey[i]) break;
        }
      }
    }
    return best;
  }

  function solveBestXi(players, formationKey, foreignCap = 99, homeCountry = '', excludeIds = null, rotationMode = false, repLevel = 3) {
    const fk = (formationKey in C.FORMATIONS) ? formationKey : '4-3-3';
    const slots = C.FORMATIONS[fk];
    const excl = new Set(excludeIds || []);
    const pool = (players || []).filter(
      p => !p.isYouth && !p.injured && !p.suspended && !excl.has(p.id)
    );

    if (!pool.length) {
      return {
        formation: fk, xi: [], bench: [], totalScore: 0.0, avgScore: 0.0,
        sectors: { GK: 0, DEF: 0, MID: 0, ATK: 0 }, foreignCount: 0,
        setPieces: {}, wrongFootCount: 0, falseNine: false, falseNinePlayers: [],
        setPieceWarnings: [],
      };
    }

    const hc = String(homeCountry || '').toUpperCase();
    const isForeign = p => {
      const nat = String(p.nationality || '').toUpperCase();
      return Boolean(hc && nat && nat !== hc);
    };

    const evalPick = (p, sl) => {
      const { score, wrongFoot } = evalPlayerForSlot(p, sl, repLevel);
      const pickScore = score * rotationPriorityMul(p, sl, rotationMode);
      return { score, pickScore, wrongFoot };
    };

    const assigned = new Array(slots.length).fill(null);
    const used = new Set();
    let fUsed = 0;

    // 1. Kiper
    const gkCands = [...pool].sort((a, b) => evalPick(b, 'G').pickScore - evalPick(a, 'G').pickScore);
    if (gkCands.length) {
      let bestGk = gkCands[0];
      if (isForeign(bestGk) && foreignCap <= 0) {
        const locGk = gkCands.find(p => !isForeign(p));
        if (locGk) bestGk = locGk;
      }
      const r = evalPick(bestGk, 'G');
      assigned[0] = { slot: 'G', player: bestGk, score: r.score, pickScore: r.pickScore, wrongFoot: r.wrongFoot };
      used.add(bestGk.id);
      if (isForeign(bestGk)) fUsed++;
    }

    // 2. 10 Outfield Global-Greedy
    const openSlots = [];
    for (let i = 1; i < slots.length; i++) openSlots.push(i);

    while (openSlots.length) {
      let bestPair = null;
      for (const si of openSlots) {
        const sl = slots[si];
        for (const p of pool) {
          if (used.has(p.id)) continue;
          if (isForeign(p) && fUsed >= foreignCap) continue;
          const r = evalPick(p, sl);
          if (!bestPair || r.pickScore > bestPair.pickScore) {
            bestPair = { si, p, ...r };
          }
        }
      }
      if (!bestPair) {
        for (const si of openSlots) {
          const sl = slots[si];
          const rem = pool.filter(p => !used.has(p.id));
          if (!rem.length) break;
          rem.sort((a, b) => evalPick(b, sl).pickScore - evalPick(a, sl).pickScore);
          const p = rem[0];
          const r = evalPick(p, sl);
          assigned[si] = { slot: sl, player: p, score: r.score, pickScore: r.pickScore, wrongFoot: r.wrongFoot };
          used.add(p.id);
        }
        break;
      }
      assigned[bestPair.si] = {
        slot: slots[bestPair.si],
        player: bestPair.p,
        score: bestPair.score,
        pickScore: bestPair.pickScore,
        wrongFoot: bestPair.wrongFoot,
      };
      used.add(bestPair.p.id);
      if (isForeign(bestPair.p)) fUsed++;
      openSlots.splice(openSlots.indexOf(bestPair.si), 1);
    }

    // 3. 2-opt internal swap
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let i = 1; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          if (!assigned[i] || !assigned[j]) continue;
          const pi = assigned[i].player;
          const pj = assigned[j].player;
          const curPs = assigned[i].pickScore + assigned[j].pickScore;
          const ri = evalPick(pj, slots[i]);
          const rj = evalPick(pi, slots[j]);
          if (ri.pickScore + rj.pickScore > curPs + 0.05) {
            assigned[i] = { slot: slots[i], player: pj, score: ri.score, pickScore: ri.pickScore, wrongFoot: ri.wrongFoot };
            assigned[j] = { slot: slots[j], player: pi, score: rj.score, pickScore: rj.pickScore, wrongFoot: rj.wrongFoot };
            improved = true;
          }
        }
      }
      if (!improved) break;
    }

    // 4. Cross-bench foreign-vs-local swap
    if (foreignCap < 50) {
      for (let iter = 0; iter < 4; iter++) {
        const benchForeign = pool.filter(p => !used.has(p.id) && isForeign(p));
        const benchLocal = pool.filter(p => !used.has(p.id) && !isForeign(p));
        if (!benchForeign.length || !benchLocal.length) break;

        let bestGain = 0.05;
        let bestMove = null;

        for (let idxOut = 0; idxOut < assigned.length; idxOut++) {
          const curOut = assigned[idxOut];
          if (!curOut || !isForeign(curOut.player)) continue;
          let bestLoc = null;
          for (const lp of benchLocal) {
            const r = evalPick(lp, slots[idxOut]);
            if (!bestLoc || r.pickScore > bestLoc.pickScore) bestLoc = { p: lp, ...r };
          }
          const loss = curOut.pickScore - bestLoc.pickScore;

          for (let idxIn = 0; idxIn < assigned.length; idxIn++) {
            const curIn = assigned[idxIn];
            if (!curIn || idxIn === idxOut || isForeign(curIn.player)) continue;
            for (const bf of benchForeign) {
              const r = evalPick(bf, slots[idxIn]);
              const gain = (r.pickScore - curIn.pickScore) - loss;
              if (gain > bestGain) {
                bestGain = gain;
                bestMove = { idxOut, bestLoc, idxIn, bf, bfRes: r };
              }
            }
          }
        }
        if (!bestMove) break;
        const { idxOut, bestLoc, idxIn, bf, bfRes } = bestMove;
        used.delete(assigned[idxOut].player.id);
        used.delete(assigned[idxIn].player.id);
        assigned[idxOut] = { slot: slots[idxOut], player: bestLoc.p, score: bestLoc.score, pickScore: bestLoc.pickScore, wrongFoot: bestLoc.wrongFoot };
        assigned[idxIn] = { slot: slots[idxIn], player: bf, score: bfRes.score, pickScore: bfRes.pickScore, wrongFoot: bfRes.wrongFoot };
        used.add(bestLoc.p.id);
        used.add(bf.id);
      }
    }

    const xiList = assigned.filter(Boolean);
    const benchList = pool
      .filter(p => !used.has(p.id))
      .sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));

    const secVals = { GK: [], DEF: [], MID: [], ATK: [] };
    let totScore = 0;
    let foreignCnt = 0;
    let wrongFootCnt = 0;

    for (const a of xiList) {
      const c = (a.slot in C.EXACT_CAT) ? C.EXACT_CAT[a.slot] : 3;
      const key = c === 0 ? 'GK' : ((c === 1 || c === 2) ? 'DEF' : (c === 3 ? 'MID' : 'ATK'));
      secVals[key].push(a.score);
      totScore += a.score;
      if (isForeign(a.player)) foreignCnt++;
      if (a.wrongFoot) wrongFootCnt++;
    }

    const sectors = {};
    for (const k of ['GK', 'DEF', 'MID', 'ATK']) {
      const arr = secVals[k];
      sectors[k] = arr.length ? U.roundTo(arr.reduce((s, v) => s + v, 0) / arr.length, 1) : 0.0;
    }
    const totalScore = U.roundTo(totScore, 1);
    const avgScore = xiList.length ? U.roundTo(totScore / xiList.length, 1) : 0.0;

    const xiPlayers = xiList.map(a => a.player);
    const outfieldXi = xiPlayers.filter(p => p.pos !== 'G');
    const spPool = outfieldXi.length ? outfieldXi : xiPlayers;

    const penTaker = pickMaxBy(spPool, p => [p.s1 === 'FIN' ? 2 : (p.s2 === 'FIN' ? 1 : 0), p.force]);
    const corTaker = pickMaxBy(spPool, p => [p.s1 === 'CRU' ? 2 : (p.s2 === 'CRU' ? 1 : 0), (p.s1 === 'PAS' || p.s1 === 'ARM') ? 1 : 0, p.force]);
    const fkTaker = pickMaxBy(spPool, p => [(p.s1 === 'FIN' || p.s2 === 'FIN') ? 1 : 0, (p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM') ? 1 : 0, p.force]);
    const captain = pickMaxBy(xiPlayers, p => [p.age >= 28 ? 1 : 0, p.force, p.age]);

    const f9 = detectFalseNine(xiPlayers);
    const spWarnings = [];
    if (penTaker && penTaker.s2 === 'FIN' && penTaker.s1 !== 'FIN') {
      spWarnings.push(`Penalti: ${penTaker.name} punya FIN di slot 2 — tombol Auto game akan melewatinya, wajib pilih manual!`);
    }
    const cruS1List = spPool.filter(p => p.s1 === 'CRU');
    const cruS2List = spPool.filter(p => p.s2 === 'CRU' && p.s1 !== 'CRU');
    if (cruS1List.length && cruS2List.length) {
      const bestS1 = pickMaxBy(cruS1List, x => [x.force]);
      const bestS2 = pickMaxBy(cruS2List, x => [x.force]);
      if (bestS2.force > bestS1.force) {
        spWarnings.push(`Corner: Pilih manual ${bestS1.name} (CRS slot 1 = +3%) daripada ${bestS2.name} (CRS slot 2 = +1.5%, yang akan dipilih Auto game).`);
      }
    }

    const hasFinPen = penTaker && (penTaker.s1 === 'FIN' || penTaker.s2 === 'FIN');
    return {
      formation: fk,
      xi: xiList,
      bench: benchList,
      totalScore,
      avgScore,
      sectors,
      foreignCount: foreignCnt,
      wrongFootCount: wrongFootCnt,
      falseNine: f9.active,
      falseNinePlayers: f9.players,
      setPieceWarnings: spWarnings,
      setPieces: {
        penalty: penTaker ? (penTaker.name + (hasFinPen ? ` (${U.skillEn(penTaker.s1)}/${U.skillEn(penTaker.s2)})` : '')) : '-',
        corner: corTaker ? (corTaker.name + (corTaker.s1 === 'CRU' ? ' [CRS s1 +3%!]' : (corTaker.s2 === 'CRU' ? ' [CRS s2 +1.5%]' : ''))) : '-',
        freeKick: fkTaker ? fkTaker.name : '-',
        captain: captain ? `${captain.name} (${captain.age}th${captain.age >= 28 ? ' ✓>=28' : ' ⚠<28'})` : '-',
      },
    };
  }

  function detectSquadHoles(players, formationKey) {
    const slots = C.FORMATIONS[formationKey] || C.FORMATIONS['4-3-3'];
    const active = (players || []).filter(p => !p.isYouth);
    const holes = [];
    const holePositions = new Set();

    const slotCats = {};
    for (const s of slots) {
      const c = (s in C.EXACT_CAT) ? C.EXACT_CAT[s] : 3;
      slotCats[c] = (slotCats[c] || 0) + 1;
    }
    const squadCats = {};
    for (const p of active) {
      const c = (p.pos in C.EXACT_CAT) ? C.EXACT_CAT[p.pos] : 3;
      squadCats[c] = (squadCats[c] || 0) + 1;
    }

    const catLabels = {
      0: 'Kiper (GK)',
      1: 'Fullback (RB/LB)',
      2: 'Bek Tengah (RCB/LCB)',
      3: 'Gelandang (CDM/CM/CAM)',
      4: 'Penyerang/Sayap (LW/ST/RW)',
    };

    for (const [cStr, need] of Object.entries(slotCats)) {
      const c = Number(cStr);
      const minDepth = c > 0 ? Math.max(need + 1, 2) : 2;
      const have = squadCats[c] || 0;
      if (have < minDepth) {
        holes.push({
          kind: 'DEPTH',
          pos: catLabels[c],
          have,
          need: minDepth,
          desc: `Stok ${catLabels[c]} tipis (${have} pemain, butuh min. ${minDepth}).`,
        });
        for (const [posCode, pc] of Object.entries(C.EXACT_CAT)) {
          if (pc === c) holePositions.add(posCode);
        }
      }
    }

    const fbChecks = [
      ['LE', 'E', 'Bek Kiri (LB berkaki Kiri/L)'],
      ['LD', 'D', 'Bek Kanan (RB berkaki Kanan/R)'],
    ];
    for (const [slotCode, reqFoot, label] of fbChecks) {
      if (!slots.includes(slotCode)) continue;
      const exact = active.filter(p => p.pos === slotCode);
      const footOk = active.filter(p => C.EXACT_CAT[p.pos] === 1 && String(p.foot || '').toUpperCase() === reqFoot);
      if (exact.length === 0 || footOk.length === 0) {
        holes.push({
          kind: 'FOOT_HOLE',
          pos: U.posEn(slotCode),
          have: exact.length,
          need: 1,
          desc: `Lubang ${label}: ${exact.length} spesialis ${U.posEn(slotCode)}, ${footOk.length} berkaki ${U.footEn(reqFoot)} (kena wrongFoot -5%).`,
        });
        holePositions.add(slotCode);
      }
    }

    if (slots.includes('ATA')) {
      const strikers = active.filter(p => p.pos === 'ATA' || p.pos === 'SA');
      if (strikers.length < 2) {
        holes.push({
          kind: 'SIDE',
          pos: 'ST',
          have: strikers.length,
          need: 2,
          desc: `Striker Murni (ST/SS) minim (${strikers.length} pemain senior).`,
        });
        holePositions.add('ATA');
        holePositions.add('SA');
      }
    }

    return { holes, holePositions: Array.from(holePositions).sort() };
  }

  function predictAiTacticsDetail(oppAvgForce, userAvgForce, oppIsHome, oppXiPlayers = null) {
    const diff = U.roundTo(oppAvgForce - userAvgForce, 1);
    const pls = oppXiPlayers || [];

    let fastAtk = 0;
    let wingCnt = 0;
    if (pls.length) {
      for (const p of pls) {
        if (['ATA', 'SA', 'PD', 'PE'].includes(p.pos) && (['VEL', 'DRI'].includes(p.s1) || ['VEL', 'DRI'].includes(p.s2))) {
          fastAtk++;
        }
        if (['PD', 'PE', 'MD', 'ME'].includes(p.pos) || p.s1 === 'CRU' || p.s2 === 'CRU') {
          wingCnt++;
        }
      }
    } else {
      fastAtk = 2;
      wingCnt = 2;
    }

    const aiFocus = wingCnt >= 2 ? 'Wings (Sayap)' : 'Center (Tengah)';
    let aiStyle = 'Balanced';
    let counterTip = 'Offensive jika unggul sektor atau Balanced saat tandang ketat';

    if (diff <= -4.0 && fastAtk >= 2) {
      aiStyle = 'Counter-Attack';
      counterTip = 'Offensive + waspada serangan balik cepat AI';
    } else if (diff >= 6.0) {
      aiStyle = 'Offensive (40%) / Balanced (60%)';
      counterTip = 'Counter-Attack (manfaatkan ruang belakang AI saat Offensive)';
    } else if (fastAtk >= 3) {
      aiStyle = 'Balanced (70%) / Counter (30%)';
      counterTip = 'Balanced / Offensive terkontrol (jaga transisi bertahan)';
    }

    return { aiStyle, aiFocus, counterTip, diff, fastAtk, wingCnt };
  }

  function computeEngineSectorPower(xiObj) {
    const fk = (xiObj && xiObj.formation) || '4-3-3';
    const [nDef, nMid, nAtk, _bDef, bMid, _bAtk, width] = C.FORMATION_SHAPE[fk] || [4, 3, 3, 0, 0, 0, 'WIDE'];
    const mods = C.FORMATION_MODS[fk] || { atkMod: 0, defMod: 0 };
    const sec = (xiObj && xiObj.sectors) || { GK: 0, DEF: 0, MID: 0, ATK: 0 };

    const defMul = 1.0 + 0.035 * (nDef - 4) + (mods.defMod / 100.0);
    const midMul = 1.0 + 0.035 * (nMid - 3) + bMid;
    const atkMul = 1.0 + 0.035 * (nAtk - 3) + (mods.atkMod / 100.0);

    return {
      GK: U.roundTo(sec.GK || 0, 1),
      DEF: U.roundTo((sec.DEF || 0) * defMul, 1),
      MID: U.roundTo((sec.MID || 0) * midMul, 1),
      ATK: U.roundTo((sec.ATK || 0) * atkMul, 1),
      shape: `${nDef}-${nMid}-${nAtk}`,
      atkMod: mods.atkMod,
      defMod: mods.defMod,
      nDef, nMid, nAtk, width,
    };
  }

  function fmtSigned(v) {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  }

  function recommendMatchupForOpponent(
    userRoster, oppXi, isHome, isKo, isBig,
    foreignCap, userCountry, activeFormation,
    yellowRiskIds = null, rotationMode = false, repLevel = 3
  ) {
    const oppPow = computeEngineSectorPower(oppXi);
    const oppPlayers = (oppXi.xi || []).map(a => a.player);
    const oppCabCnt = oppPlayers.filter(p => p.s1 === 'CAB' || p.s2 === 'CAB').length;
    const yIds = new Set(yellowRiskIds || []);

    const homeMidAdj = isHome ? 1.4 : -1.4;
    const homeAtkAdj = isHome ? 0.9 : -0.9;
    const homeDefAdj = isHome ? 0.7 : -0.7;

    const evaluated = [];
    for (const fk of Object.keys(C.FORMATIONS)) {
      const xi = solveBestXi(userRoster, fk, foreignCap, userCountry, null, rotationMode, repLevel);
      if (!xi.xi.length) continue;
      const up = computeEngineSectorPower(xi);

      const dMid = U.roundTo((up.MID + homeMidAdj) - oppPow.MID, 1);
      const dAtk = U.roundTo((up.ATK + homeAtkAdj) - (oppPow.DEF * 0.72 + oppPow.GK * 0.28), 1);
      const dDef = U.roundTo(((up.DEF * 0.72 + up.GK * 0.28) + homeDefAdj) - oppPow.ATK, 1);

      let collapsePen = 0.0;
      if (dMid < -3.0) collapsePen += Math.abs(dMid + 3.0) * 0.65;
      if (dDef < -3.0) collapsePen += Math.abs(dDef + 3.0) * 0.75;
      if (dAtk < -5.0) collapsePen += Math.abs(dAtk + 5.0) * 0.35;

      const matchupScore = U.roundTo(
        0.42 * dMid + 0.29 * dAtk + 0.29 * dDef + 0.12 * (xi.avgScore - oppXi.avgScore) - collapsePen,
        2
      );

      const xiPls = xi.xi.map(a => a.player);
      const cabCnt = xiPls.filter(p => p.s1 === 'CAB' || p.s2 === 'CAB').length;
      const cruS1 = [...xiPls].sort((a, b) => b.force - a.force).filter(p => p.s1 === 'CRU').map(p => p.name);
      const finCnt = xiPls.filter(p => p.s1 === 'FIN' || p.s2 === 'FIN').length;
      const gkDpe = xi.xi.some(a => a.slot === 'G' && (a.player.s1 === 'DPE' || a.player.s2 === 'DPE'));
      const yStarters = xiPls.filter(p => yIds.has(p.id)).map(p => p.name);

      evaluated.push({
        formation: fk,
        matchupScore,
        avgScore: xi.avgScore,
        sectors: xi.sectors,
        enginePow: up,
        dMid, dAtk, dDef,
        wrongFootCount: xi.wrongFootCount,
        foreignCount: xi.foreignCount,
        setPieces: xi.setPieces,
        setPieceWarnings: xi.setPieceWarnings,
        falseNine: xi.falseNine,
        falseNinePlayers: xi.falseNinePlayers,
        cabCount: cabCnt,
        cruS1,
        finCount: finCnt,
        gkDpe,
        yellowStarters: yStarters,
        xiSummary: xi.xi.map(a => `${a.slot}:${a.player.name}`),
        bench: xi.bench,
      });
    }

    evaluated.sort((a, b) => (b.matchupScore - a.matchupScore) || (b.avgScore - a.avgScore));
    if (!evaluated.length) return null;

    const best = evaluated[0];
    const activeEv = evaluated.find(x => x.formation === activeFormation) || best;
    const scoreGain = U.roundTo(best.matchupScore - activeEv.matchupScore, 2);
    const keepActive = (best.formation === activeFormation) || (scoreGain < 0.45);
    const chosen = keepActive ? activeEv : best;

    const reasons = [];
    if (!keepActive) {
      if (activeEv.dMid < 0 && chosen.dMid > activeEv.dMid + 0.8) {
        reasons.push(`Formasi aktif (${U.formEn(activeFormation)}) kalah di tengah (${fmtSigned(activeEv.dMid)}); ${U.formEn(chosen.formation)} menaikkan dominasi MID jadi ${fmtSigned(chosen.dMid)}`);
      }
      if (activeEv.dDef < 0 && chosen.dDef > activeEv.dDef + 0.8) {
        reasons.push(`Memperkokoh pertahanan DEF dari ${fmtSigned(activeEv.dDef)} menjadi ${fmtSigned(chosen.dDef)}`);
      }
      if (chosen.dAtk > activeEv.dAtk + 0.8) {
        reasons.push(`Meningkatkan daya dobrak ATK dari ${fmtSigned(activeEv.dAtk)} menjadi ${fmtSigned(chosen.dAtk)}`);
      }
      if (chosen.wrongFootCount < activeEv.wrongFootCount) {
        reasons.push(`Menghilangkan ${activeEv.wrongFootCount - chosen.wrongFootCount} penalti Fullback salah kaki (-5%)`);
      }
      if (!reasons.length) {
        reasons.push(`Keseimbangan 3 sektor terbaik melawan ${U.formEn(oppXi.formation)} lawan (Skor H2H +${scoreGain.toFixed(1)})`);
      }
    } else {
      reasons.push(`Formasi aktif ${U.formEn(activeFormation)} sudah paling pas melawan ${U.formEn(oppXi.formation)} lawan (MID ${fmtSigned(chosen.dMid)}, ATK ${fmtSigned(chosen.dAtk)}, DEF ${fmtSigned(chosen.dDef)})`);
    }
    if (chosen.falseNine) {
      reasons.push(`Bonus FALSE NINE aktif ✓ (${chosen.falseNinePlayers.join(', ')})`);
    }

    const aiInfo = predictAiTacticsDetail(oppXi.avgScore, chosen.avgScore, !isHome, oppPlayers);
    const aiStyle = aiInfo.aiStyle;

    let playStyle, playReason;
    if (chosen.dMid >= 2.0 && chosen.dAtk >= 1.5 && chosen.dDef >= 0.0) {
      playStyle = 'Offensive (Menyerang)';
      playReason = 'Unggul di lini tengah & depan — tekan sejak menit awal untuk cari gol cepat';
    } else if (aiStyle.includes('Offensive') || (chosen.dDef < -1.0 && !isHome)) {
      if (chosen.dAtk >= -1.5) {
        playStyle = 'Counter-Attack (Serangan Balik)';
        playReason = `AI diprediksi ${aiStyle} (fokus ${aiInfo.aiFocus}) — serap tekanan lalu hukum ruang belakang AI`;
      } else {
        playStyle = 'Defensive (Bertahan)';
        playReason = 'Lawan jauh lebih superior — rapatkan barisan & curi gol dari bola mati';
      }
    } else if (aiStyle.includes('Counter')) {
      playStyle = 'Offensive (Menyerang)';
      playReason = `AI diprediksi ${aiStyle} (diff ${fmtSigned(aiInfo.diff)}, ${aiInfo.fastAtk} penyerang cepat) — wajib tekan agar volume peluang tinggi`;
    } else {
      playStyle = 'Balanced (Seimbang)';
      playReason = `Kekuatan berimbang vs AI ${aiStyle} (fokus ${aiInfo.aiFocus}) — jaga transisi, naikkan tempo di menit 60`;
    }

    const width = chosen.enginePow.width;
    const oppSec = oppXi.sectors;
    let attackFocus, focusReason;
    if (width === 'NARROW' || (chosen.dMid >= 2.5 && oppSec.MID <= oppSec.DEF)) {
      attackFocus = 'Center (Tengah)';
      focusReason = `Formasi ${U.formEn(chosen.formation)} padat di tengah (MID ${fmtSigned(chosen.dMid)}) — tusuk celah gelandang lawan`;
    } else if (width === 'WIDE' && (chosen.cruS1.length || chosen.cabCount >= 2 || oppSec.DEF < oppSec.MID)) {
      attackFocus = 'Wings (Sayap)';
      focusReason = `Maksimalkan lebar sayap ${U.formEn(chosen.formation)} + umpan silang (${chosen.cruS1.length} CRS s1, ${chosen.cabCount} penyundul HDG)`;
    } else {
      attackFocus = 'Mixed (Campuran)';
      focusReason = 'Variasikan serangan tengah & sayap agar tidak mudah dibaca pertahanan lawan';
    }

    const spNotes = [...(chosen.setPieceWarnings || [])];
    if (chosen.cruS1.length) {
      spNotes.push(`Corner wajib ${chosen.cruS1[0]} (CRS slot 1 = +3% bonus langsung!)`);
    } else {
      spNotes.push('Belum ada pemain CRS (Crossing) di slot 1 — pakai eksekutor PAS/PLY ber-Force tertinggi');
    }
    if (chosen.cabCount > oppCabCnt) {
      spNotes.push(`Unggul duel udara (${chosen.cabCount} vs ${oppCabCnt} HDG lawan) → bola mati & crossing sangat mematikan!`);
    } else if (chosen.cabCount < oppCabCnt) {
      spNotes.push(`Waspada corner lawan (${oppCabCnt} HDG lawan vs ${chosen.cabCount} kita) → jaga fokus saat bertahan`);
    }
    if (isKo && chosen.gkDpe) {
      spNotes.push('Laga gugur: Kiper kita punya PEN/Penalty Save (+8% tepis penalti) — aman jika adu penalti!');
    }
    if (String(chosen.setPieces.captain || '').includes('⚠<28')) {
      spNotes.push('Perhatian: Kapten XI ini <28 thn (bonus captainMid +3% saat tertinggal tidak aktif)');
    } else {
      spNotes.push('Kapten >=28 thn aktif ✓ (+3% Lini Tengah otomatis saat tim tertinggal)');
    }

    const hasY = chosen.yellowStarters.length > 0;
    const yTxt = hasY ? ` (⚠ Starter 2 kuning: ${chosen.yellowStarters.join(', ')})` : '';
    const refereePlan = {
      strict: {
        marking: 'LIGHT (Ringan)',
        badge: 'b-good',
        note: `Wasit KETAT mudah beri kartu! Wajib Light agar bebas kartu merah.${yTxt}`,
      },
      normal: {
        marking: hasY ? 'LIGHT (Ringan)' : 'NORMAL (Sedang)',
        badge: hasY ? 'b-warn' : 'b-info',
        note: `Wasit Normal: ${hasY ? 'turunkan ke Light demi amankan starter 2 kuning!' + yTxt : 'Normal paling ideal — naikkan ke Heavy jika tertinggal di menit 70+.'}`,
      },
      lenient: {
        marking: hasY ? 'NORMAL (amankan 2 kuning)' : ((isBig || isKo || chosen.dDef < 1.5) ? 'HEAVY (Keras)' : 'NORMAL / HEAVY'),
        badge: hasY ? 'b-warn' : 'b-accent',
        note: `Wasit LONGGAR jarang keluar kartu! ${hasY ? 'Tetap Normal karena ada starter 2 kuning' + yTxt : 'Gas HEAVY (+4% DEF) untuk bonus rebut bola ekstra di duel ketat!'}`,
      },
    };

    const weatherPlan = {
      clear: {
        label: 'Cerah / Berawan (Normal)',
        note: 'Kondisi lapangan ideal. Jalankan skema utama & simpan 3 pergantian untuk menit 60–70.',
      },
      rain: {
        label: 'Hujan (Rain — Bola Licin)',
        note: `Penyelesaian akhir lebih berat! Pastikan penembak FIN aktif (${chosen.finCount} pemain FIN di XI) & tambah volume tembakan.`,
      },
      heat: {
        label: 'Panas (Heat — Kuras Stamina)',
        note: 'Energi anjlok lebih cepat! Hindari Heavy/Pressing berlebih & lakukan 3 sub lebih awal di menit 55–62.',
      },
    };

    const halftimePlan = {
      win: "Unggul di HT: Pilih 'Focus / Don't Get Complacent' (jaga konsentrasi, jangan santai).",
      draw: "Seri di HT: Pilih 'Encourage / Demand More' (dorong intensitas babak 2).",
      lose: "Tertinggal di HT: Pilih 'Fire Up / Passion' + geser gaya ke Offensive & masukkan supersub PAC/FIN menit 58.",
    };

    return {
      keepActive,
      scoreGain,
      recommended: chosen,
      activeComp: activeEv,
      oppPow,
      aiInfo,
      top3: evaluated.slice(0, 3).map(x => ({
        formation: x.formation,
        matchupScore: x.matchupScore,
        avgScore: x.avgScore,
        dMid: x.dMid, dAtk: x.dAtk, dDef: x.dDef,
        wrongFootCount: x.wrongFootCount,
        shape: x.enginePow.shape,
        atkMod: x.enginePow.atkMod,
        defMod: x.enginePow.defMod,
      })),
      reasons,
      playStyle,
      playReason,
      attackFocus,
      focusReason,
      setPieceNotes: spNotes,
      refereePlan,
      weatherPlan,
      halftimePlan,
    };
  }

  LF.tactics = {
    repToLevel,
    evalSkillStacking,
    computeSquadMoodsV9,
    slotCompatFactor,
    evalPlayerForSlot,
    rotationPriorityMul,
    detectFalseNine,
    solveBestXi,
    detectSquadHoles,
    predictAiTacticsDetail,
    computeEngineSectorPower,
    recommendMatchupForOpponent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
