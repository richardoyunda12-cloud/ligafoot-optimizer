/**
 * LigaFoot Optimizer Web Engine — scout.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * - Pre-Match War Room (5 laga terdekat: resolusi roundsLeft via m.ref -> 'runin',
 *   H2H 15 formasi, ticketMulBy[occasion], chooseAITactics #23795, alarm 2 kartu kuning, & 3 sub plan).
 * - Global Auto-Scout Moneyball dengan filter kelayakan transfer v9:
 *   refusesDistance (#23840), teamLevelOf (#21518), buyerForceCeiling (#23839),
 *   buyPersuadable (#23850), Bosman Pre-Contract Guard (#23919/#24474), & Youth Scout (#23984).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const E = LF.economy;
  const T = LF.tactics;
  const R = LF.roster;

  function resolveRoundsLeftFromWorld(m, comps) {
    if (!m || typeof m !== 'object' || !comps || typeof comps !== 'object') return null;
    if (m.roundsLeft !== undefined && m.roundsLeft !== null) return U.safeInt(m.roundsLeft, null);

    const ref = (m.ref && typeof m.ref === 'object') ? m.ref : null;
    const cid = String((ref && ref.compId) || m.compId || m.competitionId || m.leagueId || '');
    const comp = comps[cid];
    if (!comp || typeof comp !== 'object' || !Array.isArray(comp.stages)) return null;

    if (ref && ref.stageIdx !== undefined && ref.roundIdx !== undefined) {
      const st = comp.stages[U.safeInt(ref.stageIdx, 0)];
      if (st && String(st.kind || comp.kind || '') === 'table' && Array.isArray(st.rounds)) {
        return Math.max(0, st.rounds.length - 1 - U.safeInt(ref.roundIdx, 0));
      }
    }

    const rStr = String(m.roundName || m.round || '');
    const numMatch = /(\d+)/.exec(rStr);
    if (numMatch) {
      const rNum = Number(numMatch[1]);
      for (const st of comp.stages) {
        if (st && String(st.kind || comp.kind || '') === 'table' && Array.isArray(st.rounds) && st.rounds.length >= rNum) {
          return Math.max(0, st.rounds.length - rNum);
        }
      }
    }
    return null;
  }

  function extractUpcomingMatches(
    save, userId, clubsMeta, compactTeams, staticPlayers,
    userXi, userSections, fanConf, userDiv, userRep, userRoster,
    activeFormation = '4-3-3', foreignCap = 7, userCountry = '',
    curTicketMul = null, ticketMulBy = null
  ) {
    const matches = [];
    const seenKeys = new Set();
    const userRepLv = T.repToLevel(userRep);
    const world = (save.world && typeof save.world === 'object') ? save.world : {};
    const comps = (world.comps && typeof world.comps === 'object') ? world.comps : {};
    const todayNum = U.safeInt(world.today, 0);

    function addMatchEntry(homeId, awayId, compId, compName, roundName = '', stageKind = '', day = null, roundsLeft = null, neutral = false, classic = false) {
      if (homeId !== userId && awayId !== userId) return;
      const oppId = homeId === userId ? awayId : homeId;
      if (!oppId) return;
      const k = `${compId}|${oppId}|${day ?? roundName}`;
      if (seenKeys.has(k)) return;
      seenKeys.add(k);
      matches.push({
        homeId,
        awayId,
        oppId,
        isHome: homeId === userId,
        compId: String(compId || ''),
        compName: U.translateCompName(compName || compId || 'Liga', compId),
        roundName: U.translateRoundName(roundName),
        stageKind: String(stageKind || ''),
        day,
        roundsLeft,
        neutral: Boolean(neutral),
        classic: Boolean(classic),
      });
    }

    const rawList = [];
    if (save.currentMatch && typeof save.currentMatch === 'object' && !Array.isArray(save.currentMatch)) {
      rawList.push(save.currentMatch);
    }
    if (save.nextMatch && typeof save.nextMatch === 'object' && !Array.isArray(save.nextMatch)) {
      rawList.push(save.nextMatch);
    }
    if (Array.isArray(save.pendingMatches)) {
      for (const m of save.pendingMatches) {
        if (m && typeof m === 'object') rawList.push(m);
      }
    }

    for (const m of rawList) {
      let h = m.homeId || m.home || m.h || (m.homeTeam && m.homeTeam.id);
      let a = m.awayId || m.away || m.a || (m.awayTeam && m.awayTeam.id);
      if (!h && m.opponentId) {
        if (m.isHome !== false) { h = userId; a = m.opponentId; }
        else { h = m.opponentId; a = userId; }
      }
      const resolvedRl = resolveRoundsLeftFromWorld(m, comps);
      addMatchEntry(
        h, a,
        m.compId || (m.ref && m.ref.compId) || m.competitionId || m.leagueId || '',
        m.compName || m.competitionName || m.matchType || 'Pertandingan',
        m.roundName || m.round || '',
        (m.knockout || m.isKnockout) ? 'knockout' : String(m.matchType || ''),
        m.day ?? m.date ?? null,
        resolvedRl,
        Boolean(m.neutral),
        Boolean(m.classic)
      );
    }

    const compFixtures = [];
    for (const [cid, comp] of Object.entries(comps)) {
      if (!comp || typeof comp !== 'object' || comp.finished) continue;
      const cname = comp.name || cid;
      const ckind = String(comp.kind || '');
      for (const st of (comp.stages || [])) {
        if (!st || typeof st !== 'object' || st.done) continue;
        const skind = String(st.kind || ckind);
        const rounds = st.rounds || [];
        const totalR = rounds.length;
        for (let rIdx = 0; rIdx < totalR; rIdx++) {
          const rnd = rounds[rIdx];
          if (!rnd || typeof rnd !== 'object') continue;
          const rDay = U.safeInt((rnd.day !== undefined && rnd.day !== null) ? rnd.day : rnd.d, 0);
          const rName = rnd.name || st.name || `Ronde ${rIdx + 1}`;
          for (const fx of (rnd.matches || [])) {
            if (!fx || typeof fx !== 'object') continue;
            if (fx.played || (fx.homeGoals !== undefined && fx.homeGoals !== null)) continue;
            const h = fx.home || fx.homeId || fx.h;
            const a = fx.away || fx.awayId || fx.a;
            if (h === userId || a === userId) {
              const rl = skind === 'table' ? Math.max(0, totalR - 1 - rIdx) : null;
              compFixtures.push({
                sortKey: rDay >= todayNum ? rDay : (rDay + 10000),
                h, a, cid, cname, rName, skind, rDay, rl,
                neut: Boolean(fx.neutral),
                classic: Boolean(fx.classic),
              });
            }
          }
        }
      }
    }

    compFixtures.sort((a, b) => a.sortKey - b.sortKey);
    for (const f of compFixtures) {
      if (matches.length >= 5) break;
      addMatchEntry(f.h, f.a, f.cid, f.cname, f.rName, f.skind, f.rDay, f.rl, f.neut, f.classic);
    }

    const enriched = [];
    const worldTeams = (world.teams && typeof world.teams === 'object') ? world.teams : {};
    const basePrices = C.TICKETS_BASE[userDiv] || C.TICKETS_BASE[1];
    const curMuls = U.normalizeTicketMul(curTicketMul);
    const tmbMap = (ticketMulBy && typeof ticketMulBy === 'object') ? ticketMulBy : {};
    const sectorKeys = ['geral', 'arquibancada', 'cadeiras', 'camarotes'];
    const secNames = { geral: 'General', arquibancada: 'Stands', cadeiras: 'Seats', camarotes: 'Boxes' };

    for (const fx of matches.slice(0, 5)) {
      const oppId = fx.oppId;
      const oppCm = compactTeams[oppId] || {};
      const oppMeta = U.getStaticClub(clubsMeta, oppId);
      const oppWt = worldTeams[oppId] || {};
      const oppName = oppMeta.name || oppCm.name || oppId;
      const oppCountry = String(oppMeta.country || oppCm.country || '').toUpperCase();
      const oppRep = U.safeNum(oppCm.reputation, U.safeNum(oppWt.rep, oppMeta.rep || 50));
      const oppRepLv = T.repToLevel(oppRep);
      const oppForm = (oppCm.formation in C.FORMATIONS) ? oppCm.formation : '4-4-2';

      const { roster: oppRoster } = R.extractTeamRoster(oppCm, staticPlayers, false, oppId, oppName, oppCountry);
      const oppXi = T.solveBestXi(oppRoster, oppForm, 99, oppCountry, null, false, oppRepLv);
      const oppXiPlayers = oppXi.xi.map(a => a.player);
      const oppInjured = oppRoster.filter(p => p.injured);
      const oppStars = oppRoster.filter(p => !p.injured).sort((a, b) => b.force - a.force).slice(0, 3);

      const aiInfo = T.predictAiTacticsDetail(oppXi.avgScore, userXi.avgScore, !fx.isHome, oppXiPlayers);

      const rnLow = fx.roundName.toLowerCase();
      const koTokens = ['semi', 'quartas', 'quarter', 'perempat', 'oitavas', '16 besar', 'final'];
      const isKo = (fx.stageKind === 'knockout') || koTokens.some(k => rnLow.includes(k));
      let occasion = 'normal';
      let koStage = null;
      if (isKo) {
        if (rnLow.includes('semi')) { occasion = 'sf'; koStage = 'sf'; }
        else if (rnLow.includes('quartas') || rnLow.includes('quarter') || rnLow.includes('perempat')) { occasion = 'qf'; koStage = 'qf'; }
        else if (rnLow.includes('oitavas') || rnLow.includes('16')) { occasion = 'r16'; koStage = 'r16'; }
        else if (rnLow.includes('final') && !rnLow.includes('3º') && !rnLow.includes('terceiro') && !rnLow.includes('juara 3')) { occasion = 'final'; koStage = 'final'; }
      } else if (fx.roundsLeft !== null && fx.roundsLeft <= 5) {
        occasion = 'runin';
      }

      const isBig = Boolean(
        fx.classic
        || occasion === 'runin'
        || occasion === 'sf'
        || occasion === 'final'
        || oppRep >= userRep + 10
        || fx.compId.includes('cont:')
      );
      const repLvlDiff = oppRepLv - userRepLv;

      let ticketRec = null;
      if (fx.isHome && !fx.neutral) {
        const hasPhasePreset = Object.prototype.hasOwnProperty.call(tmbMap, occasion);
        const fxMuls = hasPhasePreset ? U.normalizeTicketMul(tmbMap[occasion]) : curMuls;
        const fxCurPrices = {};
        for (const s of sectorKeys) {
          fxCurPrices[s] = Math.max(1, Math.round(basePrices[s] * fxMuls[s]));
        }
        const simOpts = {
          homeRepLvl: userRepLv,
          country: userCountry,
          kind: 'league',
          koStage,
          isClassic: fx.classic,
        };
        const opt = E.optimizeTicketPricesV9(userSections, fanConf, userDiv, isKo, isBig, repLvlDiff, 70.5, simOpts);
        const curSimFx = E.simulateStadiumByPricesV9(userSections, fxCurPrices, fanConf, userDiv, isKo, isBig, repLvlDiff, simOpts);
        const diffs = [];
        for (const s of sectorKeys) {
          if (Math.abs(opt.prices[s] - fxCurPrices[s]) >= 1) {
            diffs.push(`${secNames[s]} ${fxCurPrices[s]}→${opt.prices[s]}`);
          }
        }
        ticketRec = {
          occasion,
          isBig,
          isKnockout: isKo,
          koStage,
          usingPhasePreset: hasPhasePreset,
          prices: opt.prices,
          muls: opt.muls,
          curPrices: fxCurPrices,
          diffs,
          revGain: Math.round(opt.sim.totalRev - curSimFx.totalRev),
          fillPct: opt.sim.fillPct,
          estRev: opt.sim.totalRev,
        };
      }

      const activeEdge = U.roundTo(userXi.avgScore - oppXi.avgScore, 1);

      const yellowRisks = [];
      const yellowIds = new Set();
      const cid = fx.compId;
      for (const p of userRoster) {
        const entry = (p.cardsByComp || {})[cid];
        if (entry && typeof entry === 'object' && U.safeInt(entry.y, 0) >= 2 && U.safeInt(entry.s, 0) === 0) {
          yellowRisks.push({ name: p.name, pos: p.pos, y: U.safeInt(entry.y, 0) });
          yellowIds.add(p.id);
        }
      }

      const safeRotatePrelim = (activeEdge >= 4.0) && !isKo && !isBig;
      const matchup = T.recommendMatchupForOpponent(
        userRoster, oppXi, fx.isHome, isKo, isBig,
        foreignCap, userCountry, activeFormation,
        yellowIds, safeRotatePrelim, userRepLv
      );

      const recEdge = (matchup && matchup.recEdge !== undefined)
        ? matchup.recEdge
        : activeEdge;
      const safeRotate = (recEdge >= 4.0) && !isKo && !isBig;

      const recBench = (matchup && matchup.recommended && matchup.recommended.bench) || userXi.bench || [];
      const needMinSubs = recBench
        .filter(p => p.pos !== 'G' && p.moodTier === 1 && U.safeNum(p.minPct, 100) < 12.0)
        .slice(0, 2);
      const needIds = new Set(needMinSubs.map(x => x.id));
      const supersubs = recBench
        .filter(p => p.pos !== 'G' && !needIds.has(p.id))
        .sort((a, b) => {
          const sa = (a.s1 === 'VEL' || a.s2 === 'VEL' || a.s1 === 'FIN' || a.s2 === 'FIN') ? 1 : 0;
          const sb = (b.s1 === 'VEL' || b.s2 === 'VEL' || b.s1 === 'FIN' || b.s2 === 'FIN') ? 1 : 0;
          return (sb - sa) || (b.force - a.force);
        });

      const subPlan = [];
      for (const p of needMinSubs) {
        subPlan.push(`${p.name} (${U.posEn(p.pos)} ${p.force}) — kuota menit ${p.minPct || 0}%/8%`);
      }
      const needMore = Math.max(1, 3 - subPlan.length);
      for (const p of supersubs.slice(0, needMore)) {
        const isAttMid = (p.cat ?? 3) >= 3;
        const hasPaceFin = (p.s1 === 'VEL' || p.s2 === 'VEL' || p.s1 === 'FIN' || p.s2 === 'FIN');
        let tag = 'Gelandang/Penyerang Segar';
        if (isAttMid && hasPaceFin) tag = 'Supersub PAC/FIN';
        else if (!isAttMid) tag = (p.s1 === 'VEL' || p.s2 === 'VEL') ? 'Bek Segar (PAC)' : 'Bek Segar';
        subPlan.push(`${p.name} (${U.posEn(p.pos)} ${p.force}) — ${tag}`);
      }

      if (matchup) {
        if (matchup.recommended) delete matchup.recommended.bench;
        if (matchup.activeComp) delete matchup.activeComp.bench;
      }

      const finalAi = (matchup && matchup.aiInfo) || aiInfo;
      enriched.push({
        ...fx,
        oppName,
        oppCountry,
        oppRep: Math.round(oppRep),
        oppFormation: oppForm,
        oppAvg: oppXi.avgScore,
        oppSectors: oppXi.sectors,
        edge: recEdge,           // SSOT: Selaras dengan formasi rekomendasi terbaik War Room
        recEdge,
        activeEdge,              // Edge jika memakai formasi aktif save saat ini
        aiStyle: finalAi.aiStyle,
        aiFocus: finalAi.aiFocus,
        aiInfo: finalAi,
        counterTip: matchup ? matchup.playStyle : finalAi.counterTip,
        focusTip: matchup ? matchup.attackFocus : finalAi.aiFocus,
        matchup,
        occasion,
        safeRotate,
        ticketRec,
        oppStars: oppStars.map(p => ({ name: p.name, pos: p.pos, force: p.force, star: p.star })),
        oppInjured: oppInjured.slice(0, 3).map(p => ({ name: p.name, pos: p.pos, force: p.force, days: p.injuryDays })),
        yellowRisks,
        subPlan: subPlan.slice(0, 3),
      });
    }

    return enriched;
  }

  /**
   * Pemindai Global Auto-Scout Moneyball (freePlayers + 1.185+ klub AI)
   * dengan evaluasi kelayakan transfer v9 (`userBuyPolicy`, `refusesDistance`, `buyPersuadable`, `KEY_LOCK`, `YSCOUT`).
   */
  function buildGlobalScoutPool(save, staticPlayers, clubsMeta, userId, userCountry, holePositions, userAvgForce) {
    const compactTeams = (save.compactTeams && typeof save.compactTeams === 'object') ? save.compactTeams : {};
    const worldComps = (save.world && save.world.comps) || {};
    const uTeam = compactTeams[userId] || {};
    const uMeta = U.getStaticClub(clubsMeta, userId);
    const userRep = U.safeNum(uTeam.reputation, uMeta.rep || 50);
    const userDiv = U.estimateDivisionFromLeague(save.league || uTeam.league || '', worldComps);
    const userLevel = U.teamLevelOf(uTeam, userDiv, uMeta.level);

    const holesSet = new Set(holePositions || []);
    const candidates = [];
    const youthScoutCandidates = [];
    let aiUnhappyTotal = 0;
    let aiBosmanTotal = 0;

    function scoreTarget(p, isFree = false, isUnhappy = false, isScarce = false, clubCashCrisis = false, pol = null, persuadable = false, isReachableBosman = false) {
      const gap = Math.max(0, p.potCap - p.force);
      let flip = 0.0;
      if (p.cat === 4) flip += 18.0;
      if (p.age >= 16 && p.age <= 20) flip += 22.0;
      else if (p.age >= 21 && p.age <= 23) flip += 12.0;
      else if (p.age >= p.sellWarnAge) flip -= 18.0;

      flip += Math.min(30.0, gap * 2.4);
      flip += p.stackPct * 1.4;
      if (p.nonStack) flip -= 8.0;
      if (p.isTrap) flip -= 15.0;
      if (p.isGem) flip += 10.0;
      if (isFree) flip += 16.0;
      if (isUnhappy) flip += 14.0;
      if (p.forSale) flip += 10.0;
      if (isReachableBosman) flip += 14.0;
      if (clubCashCrisis) flip += 8.0;
      if (isScarce) flip -= 7.0;
      if (holesSet.has(p.pos)) flip += 9.0;
      if (p.injured) flip -= 6.0;

      const blocked = Boolean(pol && pol.status === 'REFUSE' && !persuadable);
      if (blocked) flip -= 35.0;
      else if (persuadable) flip -= 6.0;

      let estBuy = isFree ? 0 : p.marketValue;
      if (!isFree) {
        let mul = 1.0;
        if (isUnhappy) mul *= 0.85;
        if (clubCashCrisis) mul *= 0.88;
        if (p.contractDays <= C.PRECONTRACT_DAYS) mul *= 0.92;
        if (p.forSale) mul *= 0.90;
        if (isScarce) mul *= 1.15;
        if (p.injured && p.injurySaleMul < 1.0) mul *= p.injurySaleMul;
        if (persuadable) {
          mul = Math.max(mul, 1.50);
        } else if (pol && pol.status === 'OK' && pol.ceilMult > 1.0) {
          mul *= pol.ceilMult;
        }
        estBuy = Math.round(p.marketValue * mul);
      }

      let baseMv = p.marketValue;
      if (baseMv <= 0) {
        baseMv = Math.max(100000, Math.round(45000 * Math.pow(1.115, Math.max(1, p.force - 15))));
      }
      let projGain = 0;
      if (p.age <= 19) projGain = Math.min(gap, 7);
      else if (p.age <= 21) projGain = Math.min(gap, 5);
      else if (p.age <= 23) projGain = Math.min(gap, 3);
      else if (p.age <= 26) projGain = Math.min(gap, 1);

      const futAge = p.age + (projGain >= 4 ? 2 : 1);
      const ageResaleMul = futAge >= p.declineAge ? 0.76 : ((p.age <= 21 && gap >= 5) ? 1.12 : 1.00);
      const estResale = Math.round(baseMv * Math.pow(1.11, projGain) * ageResaleMul * C.COUNTER_AVG_REALIZED);
      const rel = flip
        + (p.force - userAvgForce) * 1.3
        + (p.nationality === userCountry ? 10.0 : 0.0)
        + (blocked ? -40.0 : 0.0);

      return {
        flip: U.roundTo(flip, 1),
        estBuy,
        estResale,
        projGain,
        rel: U.roundTo(rel, 1),
      };
    }

    // 1. Free Agents
    for (const fp of (save.freePlayers || [])) {
      if (!fp || typeof fp !== 'object') continue;
      const p = R.buildPlayerRecord(fp, staticPlayers, false, 'FREE', 'Free Agent', '');
      if (p.force < Math.max(20, userAvgForce - 16)) continue;

      const pol = T.userBuyPolicy(p, p.nationality, userCountry, 0, userLevel, userRep, userDiv, null, 3, true);
      const persuadable = (pol.status === 'REFUSE')
        ? T.buyPersuadable(p, p.nationality, userCountry, U.clamp(Math.round((p.force - 18) / 3), 1, 20), userLevel, pol)
        : false;

      const sc = scoreTarget(p, true, false, false, false, pol, persuadable, false);
      const flags = ['FREE'];
      if (p.isGem) flags.push('GEM');
      if (p.isTrap) flags.push('TRAP');
      if (p.stackGrade === 'GOD') flags.push('GOD');
      if (userCountry && p.nationality === userCountry) flags.push('LOCAL');
      if (pol.status === 'REFUSE') {
        if (persuadable) flags.push('PERSUADE');
        else flags.push(pol.code || 'REFUSE');
      } else if (pol.code === 'CEIL_2X') {
        flags.push('CEIL_2X');
      }
      candidates.push({ rel: sc.rel, p, flip: sc.flip, estBuy: sc.estBuy, estResale: sc.estResale, projGain: sc.projGain, flags });
    }

    // 2. AI Clubs
    for (const [cid, cobj] of Object.entries(compactTeams)) {
      if (cid === userId || !cobj || typeof cobj !== 'object') continue;
      const cm = U.getStaticClub(clubsMeta, cid);
      const cname = cm.name || cobj.name || cid;
      const ccountry = String(cm.country || cobj.country || '').toUpperCase();
      const cDiv = U.estimateDivisionFromLeague(cobj.league || '', worldComps);
      const sellerLevel = U.teamLevelOf(cobj, cDiv, cm.level);
      const cashCrisis = U.safeNum(cobj.budget, 1000000) < 0;

      const { roster: cRoster } = R.extractTeamRoster(cobj, staticPlayers, false, cid, cname, ccountry);
      if (!cRoster.length) continue;

      const posStock = {};
      for (const p of cRoster) {
        if (!p.injured) posStock[p.pos] = (posStock[p.pos] || 0) + 1;
      }
      const { moods: cMoods } = T.computeSquadMoodsV9(cRoster, true);

      for (const p of cRoster) {
        const isUnh = Boolean(cMoods[p.id] && cMoods[p.id].mood === 'unhappy');
        const isScarce = (posStock[p.pos] || 0) <= 2;
        if (isUnh) aiUnhappyTotal++;

        const pol = T.userBuyPolicy(
          p, ccountry, userCountry, sellerLevel, userLevel,
          userRep, userDiv, null, posStock[p.pos] || 1, false
        );
        const persuadable = (pol.status === 'REFUSE')
          ? T.buyPersuadable(p, ccountry, userCountry, sellerLevel, userLevel, pol)
          : false;
        const isReachable = (pol.status === 'OK') || persuadable;

        // Bosman Pre-Contract (#23919 & #24474): wajib <=180d, tidak sedang dipinjam, tidak KEY_LOCK, & tidak menolak pindah
        const inBosmanWindow = (p.contractDays > 0 && p.contractDays <= C.PRECONTRACT_DAYS && !p.loanedFrom);
        const isKeyLocked = Boolean(
          inBosmanWindow
          && (pol.isKeyTop || pol.isYoungStar)
          && !cashCrisis
          && !isUnh
          && !p.forSale
        );
        const isBosman = Boolean(inBosmanWindow && !isKeyLocked && isReachable);
        if (isBosman) aiBosmanTotal++;

        // Youth Scout Olheiro da Base (#23984): U-21, gap >= 10, reachable, 1.5x MV
        if (p.youthScoutEligible && isReachable) {
          youthScoutCandidates.push({
            id: p.id,
            name: p.name,
            pos: p.pos,
            age: p.age,
            foot: p.foot,
            nationality: p.nationality,
            force: p.force,
            potential: p.potential,
            potCap: p.potCap,
            potGap: p.potGap,
            hash: p.hash,
            s1: p.s1,
            s2: p.s2,
            stackPct: p.stackPct,
            stackGrade: p.stackGrade,
            marketValue: p.marketValue,
            scoutPrice: p.youthScoutPrice,
            youthScoutGap: p.youthScoutGap,
            teamName: cname,
            teamCountry: ccountry,
            isLocal: Boolean(userCountry && p.nationality === userCountry),
          });
        }

        const localFlag = Boolean(userCountry && p.nationality === userCountry);

        const sc = scoreTarget(p, false, isUnh, isScarce, cashCrisis, pol, persuadable, isBosman);
        const flags = [];
        if (isUnh) flags.push('UNH');
        if (isBosman) flags.push('BOSMAN');
        if (isKeyLocked) flags.push('KEY_LOCK');
        if (p.forSale) flags.push('SALE');
        if (p.loanable) flags.push('LOAN');
        if (isScarce) flags.push('SCARCE');
        if (p.isGem) flags.push('GEM');
        if (p.isTrap) flags.push('TRAP');
        if (p.stackGrade === 'GOD') flags.push('GOD');
        if (p.injured) {
          flags.push('INJ');
          if (p.injurySaleMul < 1.0) flags.push('INJ_DISC');
        }
        if (localFlag) flags.push('LOCAL');
        if (p.youthScoutEligible && isReachable) flags.push('YSCOUT');

        if (pol.status === 'REFUSE') {
          if (persuadable) flags.push('PERSUADE');
          else flags.push(pol.code || 'REFUSE');
        } else if (pol.code === 'CEIL_2X') {
          flags.push('CEIL_2X');
        }

        candidates.push({
          rel: sc.rel,
          p,
          flip: sc.flip,
          estBuy: sc.estBuy,
          estResale: sc.estResale,
          projGain: sc.projGain,
          flags,
          reachable: isReachable,
        });
      }
    }

    candidates.sort((a, b) => b.rel - a.rel);
    const selected = [];
    const seenIds = new Set();

    for (const c of candidates) {
      const p = c.p;
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      const stCode = p.top ? 2 : (p.star ? 1 : 0);
      // Format kompak 23 elemen: sertakan SELURUH pemain aktif dari save (tanpa dipotong 2.800)
      selected.push([
        p.name, p.pos, p.age, p.foot, p.nationality,
        p.force, p.potential, p.potCap,
        p.s1, p.s2, p.stackPct, p.nonStack ? 1 : 0,
        p.salary, p.marketValue, c.estBuy, p.contractDays,
        p.teamName, c.flip, c.flags.join(','), p.id, stCode,
        c.estResale, c.projGain,
      ]);
    }

    youthScoutCandidates.sort((a, b) => {
      const locDiff = (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0);
      return locDiff || (b.potCap - a.potCap) || (b.youthScoutGap - a.youthScoutGap) || (a.scoutPrice - b.scoutPrice);
    });

    return {
      scoutPool: selected,
      youthScoutTargets: youthScoutCandidates.slice(0, 24),
      aiUnhappyTotal,
      aiBosmanTotal,
    };
  }

  function extractSimOpponents(save, userId, clubsMeta, compactTeams, staticPlayers) {
    const world = (save.world && typeof save.world === 'object') ? save.world : {};
    const worldTeams = (world.teams && typeof world.teams === 'object') ? world.teams : {};
    const standings = Array.isArray(save.standings) ? save.standings : [];
    const candIds = [];
    const seen = new Set([userId]);

    for (const row of standings) {
      const tid = row && (row.teamId || row.id);
      if (tid && !seen.has(tid) && compactTeams[tid]) {
        seen.add(tid);
        candIds.push(tid);
      }
    }
    if (candIds.length < 12) {
      const extra = Object.entries(compactTeams)
        .filter(([cid, obj]) => !seen.has(cid) && obj && typeof obj === 'object')
        .sort((a, b) => U.safeNum(b[1].reputation, 0) - U.safeNum(a[1].reputation, 0))
        .slice(0, 12 - candIds.length);
      for (const [cid] of extra) {
        seen.add(cid);
        candIds.push(cid);
      }
    }

    const out = [];
    for (const cid of candIds.slice(0, 18)) {
      const cm = compactTeams[cid] || {};
      const meta = U.getStaticClub(clubsMeta, cid);
      const wt = worldTeams[cid] || {};
      const name = meta.name || cm.name || cid;
      const country = String(meta.country || cm.country || '').toUpperCase();
      const rep = U.safeNum(cm.reputation, U.safeNum(wt.rep, meta.rep || 50));
      const form = (cm.formation in C.FORMATIONS) ? cm.formation : '4-4-2';
      const { roster } = R.extractTeamRoster(cm, staticPlayers, false, cid, name, country);
      if (!roster.length) continue;
      const xi = T.solveBestXi(roster, form, 99, country, null, false, T.repToLevel(rep));
      const xiLite = (xi.xi || []).map(a => [a.player.pos, a.player.s1, a.player.s2, a.player.force]);
      const stars = roster.filter(p => !p.injured).sort((a, b) => b.force - a.force).slice(0, 3)
        .map(p => ({ name: p.name, pos: p.pos, force: p.force, s1: p.s1, s2: p.s2, star: p.star }));
      const injured = roster.filter(p => p.injured).slice(0, 3)
        .map(p => ({ name: p.name, pos: p.pos, force: p.force, days: p.injuryDays }));
      out.push({
        id: cid,
        name,
        country,
        rep: Math.round(rep),
        formation: form,
        avgScore: xi.avgScore,
        sectors: xi.sectors,
        xiLite,
        stars,
        injured,
      });
    }
    return out.sort((a, b) => b.avgScore - a.avgScore);
  }

  LF.scout = {
    resolveRoundsLeftFromWorld,
    extractUpcomingMatches,
    buildGlobalScoutPool,
    extractSimOpponents,
  };
})(typeof window !== 'undefined' ? window : globalThis);
