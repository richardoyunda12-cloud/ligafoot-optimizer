/**
 * LigaFoot Optimizer Web Engine — scout.js
 * Port eksak 1:1 dari optimizer/analyzer_scout.py (v8.0):
 * - Pre-Match War Room (5 laga terdekat: H2H 15 formasi, ticketMulBy[occasion],
 *   chooseAITactics #23795, alarm 2 kartu kuning per compId, & 3 sub plan).
 * - Global Auto-Scout Moneyball (freePlayers + 1.185+ klub AI, strict LOCAL,
 *   SCARCE #23854, UNH, BOSMAN, & Flip Arbitrage Score).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const E = LF.economy;
  const T = LF.tactics;
  const R = LF.roster;

  function extractUpcomingMatches(
    save, userId, clubsMeta, compactTeams, staticPlayers,
    userXi, userSections, fanConf, userDiv, userRep, userRoster,
    activeFormation = '4-3-3', foreignCap = 7, userCountry = '',
    curTicketMul = null, ticketMulBy = null
  ) {
    const matches = [];
    const seenKeys = new Set();
    const userRepLv = T.repToLevel(userRep);

    function addMatchEntry(homeId, awayId, compId, compName, roundName = '', stageKind = '', day = null, roundsLeft = null, neutral = false) {
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
      addMatchEntry(
        h, a,
        m.compId || m.competitionId || m.leagueId || '',
        m.compName || m.competitionName || m.matchType || 'Pertandingan',
        m.roundName || m.round || '',
        (m.knockout || m.isKnockout) ? 'knockout' : String(m.matchType || ''),
        m.day ?? m.date ?? null,
        m.roundsLeft ?? null,
        Boolean(m.neutral)
      );
    }

    const world = (save.world && typeof save.world === 'object') ? save.world : {};
    const comps = (world.comps && typeof world.comps === 'object') ? world.comps : {};
    const todayNum = U.safeInt(world.today, 0);

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
            if (fx.played || fx.homeGoals !== undefined && fx.homeGoals !== null) continue;
            const h = fx.home || fx.homeId || fx.h;
            const a = fx.away || fx.awayId || fx.a;
            if (h === userId || a === userId) {
              const rl = skind === 'table' ? Math.max(0, totalR - 1 - rIdx) : null;
              compFixtures.push({
                sortKey: rDay >= todayNum ? rDay : (rDay + 10000),
                h, a, cid, cname, rName, skind, rDay, rl,
                neut: Boolean(fx.neutral),
              });
            }
          }
        }
      }
    }

    compFixtures.sort((a, b) => a.sortKey - b.sortKey);
    for (const f of compFixtures) {
      if (matches.length >= 5) break;
      addMatchEntry(f.h, f.a, f.cid, f.cname, f.rName, f.skind, f.rDay, f.rl, f.neut);
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
      const oppRep = U.safeNum(oppCm.reputation, U.safeNum(oppWt.rep, 50));
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
      if (isKo) {
        if (rnLow.includes('semi')) occasion = 'sf';
        else if (rnLow.includes('quartas') || rnLow.includes('quarter') || rnLow.includes('perempat')) occasion = 'qf';
        else if (rnLow.includes('oitavas') || rnLow.includes('16')) occasion = 'r16';
        else if (rnLow.includes('final') && !rnLow.includes('3º') && !rnLow.includes('terceiro') && !rnLow.includes('juara 3')) occasion = 'final';
      } else if (fx.roundsLeft !== null && fx.roundsLeft <= 5) {
        occasion = 'runin';
      }

      const isBig = (occasion === 'sf' || occasion === 'final') || (oppRep >= userRep + 10) || fx.compId.includes('cont:');
      const repDiff = oppRep - userRep;

      let ticketRec = null;
      if (fx.isHome && !fx.neutral) {
        const hasPhasePreset = Object.prototype.hasOwnProperty.call(tmbMap, occasion);
        const fxMuls = hasPhasePreset ? U.normalizeTicketMul(tmbMap[occasion]) : curMuls;
        const fxCurPrices = {};
        for (const s of sectorKeys) {
          fxCurPrices[s] = Math.max(1, Math.round(basePrices[s] * fxMuls[s]));
        }
        const opt = E.optimizeTicketPricesV9(userSections, fanConf, userDiv, isKo, isBig, repDiff);
        const curSimFx = E.simulateStadiumV9(userSections, fxMuls, fanConf, userDiv, isKo, isBig, repDiff);
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

      const edge = U.roundTo(userXi.avgScore - oppXi.avgScore, 1);
      const safeRotate = (edge >= 4.0) && !isKo && !isBig;

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

      const matchup = T.recommendMatchupForOpponent(
        userRoster, oppXi, fx.isHome, isKo, isBig,
        foreignCap, userCountry, activeFormation,
        yellowIds, safeRotate, userRepLv
      );

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
        edge,
        aiStyle: finalAi.aiStyle,
        aiFocus: finalAi.aiFocus,
        aiInfo: finalAi,
        counterTip: matchup ? matchup.playStyle : finalAi.counterTip,
        focusTip: matchup ? matchup.attackFocus : 'Mixed',
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

  function buildGlobalScoutPool(save, staticPlayers, clubsMeta, userId, userCountry, holePositions, userAvgForce) {
    const compactTeams = (save.compactTeams && typeof save.compactTeams === 'object') ? save.compactTeams : {};
    const holesSet = new Set(holePositions || []);
    const candidates = [];
    let aiUnhappyTotal = 0;
    let aiBosmanTotal = 0;

    function scoreTarget(p, isFree = false, isUnhappy = false, isScarce = false, clubCashCrisis = false) {
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
      if (p.contractDays <= C.PRECONTRACT_DAYS) flip += 12.0;
      if (clubCashCrisis) flip += 8.0;
      if (isScarce) flip -= 7.0;
      if (holesSet.has(p.pos)) flip += 9.0;
      if (p.injured) flip -= 10.0;

      let estBuy = isFree ? 0 : p.marketValue;
      if (!isFree) {
        let mul = 1.0;
        if (isUnhappy) mul *= 0.85;
        if (clubCashCrisis) mul *= 0.88;
        if (p.contractDays <= C.PRECONTRACT_DAYS) mul *= 0.92;
        if (p.forSale) mul *= 0.90;
        if (isScarce) mul *= 1.15;
        estBuy = Math.round(estBuy * mul);
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
      const rel = flip + (p.force - userAvgForce) * 1.3 + (p.nationality === userCountry ? 8.0 : 0.0);

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
      const sc = scoreTarget(p, true);
      const flags = ['FREE'];
      if (p.isGem) flags.push('GEM');
      if (p.isTrap) flags.push('TRAP');
      if (p.stackGrade === 'GOD') flags.push('GOD');
      candidates.push({ rel: sc.rel, p, flip: sc.flip, estBuy: sc.estBuy, estResale: sc.estResale, projGain: sc.projGain, flags });
    }

    // 2. AI Clubs
    for (const [cid, cobj] of Object.entries(compactTeams)) {
      if (cid === userId || !cobj || typeof cobj !== 'object') continue;
      const cm = U.getStaticClub(clubsMeta, cid);
      const cname = cm.name || cobj.name || cid;
      const ccountry = String(cm.country || cobj.country || '').toUpperCase();
      const cashCrisis = U.safeNum(cobj.budget, 1000000) < 0;

      const { roster: cRoster } = R.extractTeamRoster(cobj, staticPlayers, false, cid, cname, ccountry);
      if (!cRoster.length) continue;

      const posStock = {};
      for (const p of cRoster) {
        posStock[p.pos] = (posStock[p.pos] || 0) + 1;
      }
      const { moods: cMoods } = T.computeSquadMoodsV9(cRoster, true);

      for (const p of cRoster) {
        const isUnh = Boolean(cMoods[p.id] && cMoods[p.id].mood === 'unhappy');
        const isBosman = (p.contractDays <= C.PRECONTRACT_DAYS) || (p.contractYears <= 1 && p.contractDays <= 200);
        const isScarce = (posStock[p.pos] || 0) <= 2;

        if (isUnh) aiUnhappyTotal++;
        if (isBosman) aiBosmanTotal++;

        // Strict LOCAL = WNI / domestik asli (tidak makan kuota asing!)
        const localFlag = Boolean(userCountry && p.nationality === userCountry);
        const sameLeague = Boolean(userCountry && ccountry === userCountry);

        if (!localFlag && !sameLeague && !isUnh && !p.forSale && !p.loanable && !isBosman && !p.isGem) {
          if (p.force < userAvgForce - 6 && p.potCap < userAvgForce + 2) continue;
        }

        const sc = scoreTarget(p, false, isUnh, isScarce, cashCrisis);
        const flags = [];
        if (isUnh) flags.push('UNH');
        if (isBosman) flags.push('BOSMAN');
        if (p.forSale) flags.push('SALE');
        if (p.loanable) flags.push('LOAN');
        if (isScarce) flags.push('SCARCE');
        if (p.isGem) flags.push('GEM');
        if (p.isTrap) flags.push('TRAP');
        if (p.stackGrade === 'GOD') flags.push('GOD');
        if (p.injured) flags.push('INJ');
        if (localFlag) flags.push('LOCAL');

        candidates.push({ rel: sc.rel, p, flip: sc.flip, estBuy: sc.estBuy, estResale: sc.estResale, projGain: sc.projGain, flags });
      }
    }

    candidates.sort((a, b) => b.rel - a.rel);
    const selected = [];
    const seenIds = new Set();

    for (const c of candidates) {
      const p = c.p;
      if (seenIds.has(p.id)) continue;
      const fSet = c.flags;
      const mustKeep = (fSet.includes('FREE') && p.force >= userAvgForce - 8)
        || fSet.includes('UNH')
        || (fSet.includes('LOCAL') && p.force >= userAvgForce - 10);

      if (mustKeep || selected.length < 2400) {
        seenIds.add(p.id);
        const stCode = p.top ? 2 : (p.star ? 1 : 0);
        // Format kompak 23 elemen 100% identik dengan Python v8.0 & Tab 7 UI
        selected.push([
          p.name, p.pos, p.age, p.foot, p.nationality,
          p.force, p.potential, p.potCap,
          p.s1, p.s2, p.stackPct, p.nonStack ? 1 : 0,
          p.salary, p.marketValue, c.estBuy, p.contractDays,
          p.teamName, c.flip, fSet.join(','), p.id, stCode,
          c.estResale, c.projGain,
        ]);
      }
      if (selected.length >= 2800) break;
    }

    return { scoutPool: selected, aiUnhappyTotal, aiBosmanTotal };
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
      const rep = U.safeNum(cm.reputation, U.safeNum(wt.rep, 50));
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
    extractUpcomingMatches,
    buildGlobalScoutPool,
    extractSimOpponents,
  };
})(typeof window !== 'undefined' ? window : globalThis);
