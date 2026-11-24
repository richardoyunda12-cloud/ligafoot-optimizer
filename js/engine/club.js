/**
 * LigaFoot Optimizer Web Engine — club.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`):
 * - Auto-Settings Guard (fineAuto, trainMode, autoBy, autoRenew, ctMaint, xiHold).
 * - Priority Alerts (termasuk Pareto VIP v9, Loophole 0% !noAutoRenew, Sponsor paymentsLeft, & Bug 3-4-3).
 * - Parser `uTeam.statement` tuple `[date, cat, amt]` & `uTeam.cashHistory` `{d, v}`.
 * - Orkestrator `analyzeSave(save, staticDb, historyStore, onProgress)` -> `{ data, updatedHistory }`.
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;
  const U = LF.utils;
  const E = LF.economy;
  const T = LF.tactics;
  const R = LF.roster;
  const S = LF.scout;

  function auditAutoSettings(save, uTeam, userRoster, trainAudit) {
    const cfgSave = (save.settings && typeof save.settings === 'object') ? save.settings : {};

    function pickFlag(keys, defVal) {
      for (const src of [uTeam, save, cfgSave]) {
        if (src && typeof src === 'object') {
          for (const k of keys) {
            if (k in src && src[k] !== null && src[k] !== undefined) return src[k];
          }
        }
      }
      return defVal;
    }

    const trainMode = String(pickFlag(['trainMode'], 'auto')).toLowerCase();
    const rawFine = pickFlag(['fineAuto', 'autoFine'], 'off');
    const fineAuto = (rawFine !== false && rawFine !== 'off' && rawFine !== '' && rawFine !== 0 && rawFine !== '0');
    const autoRenew = Boolean(pickFlag(['autoRenewContracts', 'autoRenew', 'renewAuto'], false));
    let autoBy = 'manual';
    if (uTeam.lastLineup && typeof uTeam.lastLineup === 'object') {
      if (uTeam.lastLineup.auto === false) {
        autoBy = 'manual';
      } else if (uTeam.lastLineup.autoBy) {
        autoBy = String(uTeam.lastLineup.autoBy).toLowerCase();
      } else if (uTeam.lastLineup.auto === true) {
        autoBy = String(pickFlag(['autoBy', 'autoLineupMode'], 'force')).toLowerCase();
      }
    } else {
      autoBy = String(pickFlag(['autoBy', 'autoLineupMode'], 'manual')).toLowerCase();
      if (pickFlag(['autoLineup'], false) === true && autoBy === 'manual') {
        autoBy = 'force';
      }
    }
    const ctMaintOff = Boolean(pickFlag(['ctMaintOff'], false));
    const xiHoldRaw = uTeam.xiHold;
    const xiHoldCnt = (xiHoldRaw && typeof xiHoldRaw === 'object' && !Array.isArray(xiHoldRaw))
      ? Object.keys(xiHoldRaw).length
      : (xiHoldRaw ? 1 : 0);

    // #20912: Loophole Auto-Renew 0% hanya bekerja jika !p.noAutoRenew
    const hasTrapCore = userRoster.some(
      p => p.contractDays <= 10 && !p.noAutoRenew && (p.force >= 40 || p.isGem || (p.squadRank || 99) <= 14) && !p.loanedFrom
    );

    const items = [
      {
        key: 'trainMode',
        label: 'Auto Special Training',
        val: trainMode === 'auto' ? 'AUTO' : 'MANUAL',
        status: trainMode === 'auto' ? 'crit' : 'ok',
        advice: trainMode === 'auto'
          ? 'MATIKAN! Mode auto 100% buta potCap (#34840) — cuma pilih usia termuda.'
          : `Manual aktif ✓ (${trainAudit.slots} slot bisa diarahkan ke gap potCap terbesar).`,
      },
      {
        key: 'fineAuto',
        label: 'Auto Fine Kartu Merah',
        val: fineAuto ? 'ON' : 'OFF',
        status: fineAuto ? 'crit' : 'ok',
        advice: fineAuto
          ? 'MATIKAN! Auto-Fine denda 100%/50% (50%/25% peluang slump). Denda manual 20% = 0% risiko + uang gratis!'
          : 'OFF ✓ — Beri denda manual 20% ke starter yang kena kartu merah (uang gratis, 0% slump).',
      },
      {
        key: 'autoBy',
        label: 'Auto Lineup',
        val: autoBy.toUpperCase(),
        status: autoBy === 'force' ? 'warn' : 'ok',
        advice: autoBy === 'force'
          ? "MATIKAN mode 'force'! Otomatis menimpa taktik ke marking:light, buta skill stack, & skip FIN slot 2."
          : 'Aman ✓ — Pakai formasi & taktik manual sesuai War Room Tab 2.',
      },
      {
        key: 'autoRenew',
        label: 'Auto Renew Kontrak',
        val: autoRenew ? 'ON' : 'OFF',
        status: (autoRenew && !hasTrapCore) ? 'warn' : 'ok',
        advice: (autoRenew && hasTrapCore)
          ? 'Aktif taktis ✓ — Siap menangkap Loophole 0% (+180d) untuk pemain inti <=10 hari (pastikan !noAutoRenew pada inti & noAutoRenew pada cadangan!).'
          : (autoRenew
            ? 'MATIKAN saat normal! Auto-Renew bikin kamu kehilangan diskon -12% (sisa >=60 hari, ideal 60–120 hari).'
            : (hasTrapCore
              ? 'OFF — Ada pemain inti <=10 hari! Pertimbangkan nyalakan sementara untuk Loophole 0% (+180d).'
              : 'OFF ✓ — Renew manual 3 tahun saat sisa >=60 hari (60–120h) untuk potong gaji -12% gratis.')),
      },
      {
        key: 'ctMaint',
        label: 'Maintenance CT',
        val: ctMaintOff ? 'OFF' : 'ON',
        status: ctMaintOff ? 'crit' : 'ok',
        advice: ctMaintOff
          ? 'NYALAKAN SEGERA! CT turun -4/bln lalu kena renovasi 40% biaya upgrade.'
          : 'ON ✓ — Kondisi CT terjaga tanpa biaya renovasi.',
      },
      {
        key: 'xiHold',
        label: 'xiHold (Kunci Starter)',
        val: xiHoldCnt ? `${xiHoldCnt} terkunci` : 'Siap',
        status: 'ok',
        advice: 'Aman ✓ — Starter cedera/skorsing otomatis dikembalikan ke kursinya saat sembuh.',
      },
    ];

    const badCnt = items.filter(x => x.status === 'crit' || x.status === 'warn').length;
    return { items, issueCount: badCnt, trainMode, fineAuto, autoRenew, autoBy, hasTrapCore };
  }

  function computeDeltasAndHistory(historyStore, currentDate, teamId, snapshotData) {
    const hist = (historyStore && typeof historyStore === 'object' && !Array.isArray(historyStore))
      ? JSON.parse(JSON.stringify(historyStore))
      : {};
    if (!hist[teamId] || typeof hist[teamId] !== 'object') {
      hist[teamId] = {};
    }
    const clubHist = hist[teamId];
    const prevDates = Object.keys(clubHist).filter(d => d < currentDate).sort();
    const prevDate = prevDates.length ? prevDates[prevDates.length - 1] : null;
    const prevSnap = prevDate ? clubHist[prevDate] : null;

    const daysElapsed = prevDate ? Math.max(1, U.daysBetweenIso(prevDate, currentDate)) : 0;
    const weeksElapsed = daysElapsed ? U.roundTo(daysElapsed / 7, 1) : 0;

    const optDiff = (curVal, prevVal, precision = 2) => {
      if (prevVal === undefined || prevVal === null || curVal === undefined || curVal === null) return null;
      const a = Number(curVal), b = Number(prevVal);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return U.roundTo(a - b, precision);
    };

    const deltas = {
      prevDate,
      daysElapsed,
      weeksElapsed,
      budgetDelta: 0,
      payrollDelta: 0,
      membersDelta: 0,
      bestXiDelta: null,
      leaguePosDelta: null,
      leaguePtsDelta: null,
      unhappyDelta: null,
      repDelta: null,
      playerChanges: [],
      addedPlayers: [],
      removedPlayers: [],
      forceUpPlayers: [],
      forceDownPlayers: [],
      youthChanges: [],
      bTeamChanges: [],
      summaryBullets: [],
    };

    if (prevSnap) {
      deltas.budgetDelta = Math.round(U.safeNum(snapshotData.budget, 0) - U.safeNum(prevSnap.budget, 0));
      deltas.payrollDelta = Math.round(U.safeNum(snapshotData.payroll, 0) - U.safeNum(prevSnap.payroll, 0));
      deltas.membersDelta = U.safeInt(snapshotData.members, 0) - U.safeInt(prevSnap.members, 0);
      deltas.bestXiDelta = optDiff(snapshotData.bestXiAvg, prevSnap.bestXiAvg, 2);
      if (prevSnap.leaguePos !== undefined && prevSnap.leaguePos !== null && snapshotData.leaguePos !== undefined && snapshotData.leaguePos !== null) {
        const curPos = Number(snapshotData.leaguePos), pPos = Number(prevSnap.leaguePos);
        if (Number.isFinite(curPos) && Number.isFinite(pPos)) deltas.leaguePosDelta = pPos - curPos; // positif = naik peringkat
      }
      deltas.leaguePtsDelta = optDiff(snapshotData.leaguePts, prevSnap.leaguePts, 0);
      deltas.unhappyDelta = optDiff(snapshotData.unhappyCount, prevSnap.unhappyCount, 0);
      deltas.repDelta = optDiff(snapshotData.reputation, prevSnap.reputation, 0);

      const curPls = snapshotData.players || {};
      const prevPls = prevSnap.players || {};

      for (const [pid, curP] of Object.entries(curPls)) {
        if (pid in prevPls) {
          const pp = prevPls[pid] || {};
          const curF = U.safeInt(curP.force, 0);
          const prevF = U.safeInt(pp.force, curF);
          const df = curF - prevF;
          const dmv = Math.round(U.safeNum(curP.mv, 0) - U.safeNum(pp.mv, curP.mv));
          const dgf = U.roundTo(U.safeNum(curP.gf, 0) - U.safeNum(pp.gf, curP.gf), 3);
          const chg = {
            id: pid,
            name: curP.name,
            pos: curP.pos || pp.pos || '-',
            curForce: curF,
            curPotCap: U.safeInt(curP.potCap, curF),
            forceDelta: df,
            mvDelta: dmv,
            gfDelta: dgf,
          };
          if (df !== 0 || Math.abs(dmv) >= 50000 || Math.abs(dgf) >= 0.15) {
            deltas.playerChanges.push(chg);
          }
          if (df > 0 || dgf >= 0.15) deltas.forceUpPlayers.push(chg);
          else if (df < 0 || dgf <= -0.15) deltas.forceDownPlayers.push(chg);
        } else {
          deltas.addedPlayers.push({
            id: pid,
            name: curP.name,
            pos: curP.pos || '-',
            force: U.safeInt(curP.force, 0),
            potCap: U.safeInt(curP.potCap, curP.force || 0),
            mv: Math.round(U.safeNum(curP.mv, 0)),
          });
        }
      }

      for (const [pid, pp] of Object.entries(prevPls)) {
        if (!(pid in curPls)) {
          deltas.removedPlayers.push({
            id: pid,
            name: (pp && pp.name) || pid,
            pos: (pp && pp.pos) || '-',
            force: U.safeInt(pp && pp.force, 0),
            mv: Math.round(U.safeNum(pp && pp.mv, 0)),
          });
        }
      }

      const rankChg = (a, b) => (
        (Math.abs(b.forceDelta) * 10 + Math.abs(b.gfDelta) * 2 + Math.abs(b.mvDelta) / 1e6) -
        (Math.abs(a.forceDelta) * 10 + Math.abs(a.gfDelta) * 2 + Math.abs(a.mvDelta) / 1e6)
      );
      deltas.playerChanges.sort(rankChg);
      deltas.forceUpPlayers.sort(rankChg);
      deltas.forceDownPlayers.sort(rankChg);

      const prevYouth = prevSnap.youth || {};
      for (const [yid, curY] of Object.entries(snapshotData.youth || {})) {
        if (yid in prevYouth) {
          const py = prevYouth[yid] || {};
          const devDelta = U.safeInt(curY.dev, 0) - U.safeInt(py.dev, curY.dev || 0);
          const forceDelta = U.safeInt(curY.force, 0) - U.safeInt(py.force, curY.force || 0);
          if (devDelta !== 0 || forceDelta !== 0) {
            deltas.youthChanges.push({
              id: yid,
              name: curY.name,
              pos: curY.pos || '-',
              curForce: U.safeInt(curY.force, 0),
              curDev: U.safeInt(curY.dev, 0),
              devDelta,
              forceDelta,
            });
          }
        }
      }

      const prevB = prevSnap.bTeam || {};
      for (const [bid, curB] of Object.entries(snapshotData.bTeam || {})) {
        if (bid in prevB) {
          const pb = prevB[bid] || {};
          const forceDelta = U.safeInt(curB.force, 0) - U.safeInt(pb.force, curB.force || 0);
          const gfDelta = U.roundTo(U.safeNum(curB.gf, 0) - U.safeNum(pb.gf, curB.gf || 0), 3);
          if (forceDelta !== 0 || Math.abs(gfDelta) >= 0.15) {
            deltas.bTeamChanges.push({
              id: bid,
              name: curB.name,
              pos: curB.pos || '-',
              curForce: U.safeInt(curB.force, 0),
              forceDelta,
              gfDelta,
            });
          }
        }
      }

      if (deltas.budgetDelta !== 0) {
        deltas.summaryBullets.push(`Kas ${deltas.budgetDelta >= 0 ? '+' : ''}${U.fmtMoney(deltas.budgetDelta)} (${daysElapsed} hari vs ${prevDate})`);
      }
      if (deltas.bestXiDelta !== null && deltas.bestXiDelta !== 0) {
        deltas.summaryBullets.push(`Best XI ${deltas.bestXiDelta >= 0 ? '+' : ''}${deltas.bestXiDelta} (${U.safeNum(snapshotData.bestXiAvg, 0)})`);
      }
      if (deltas.leaguePosDelta !== null && deltas.leaguePosDelta !== 0) {
        deltas.summaryBullets.push(`Peringkat liga ${deltas.leaguePosDelta > 0 ? 'naik +' : 'turun '}${deltas.leaguePosDelta} (kini #${snapshotData.leaguePos})`);
      }
      if (deltas.forceUpPlayers.length) {
        const pureUps = deltas.forceUpPlayers.filter(x => x.forceDelta > 0).length;
        deltas.summaryBullets.push(`${deltas.forceUpPlayers.length} pemain bertumbuh (${pureUps} naik Force)`);
      }
      if (deltas.addedPlayers.length || deltas.removedPlayers.length) {
        deltas.summaryBullets.push(`Mutasi skuad: +${deltas.addedPlayers.length} masuk, -${deltas.removedPlayers.length} keluar`);
      }
      if (!deltas.summaryBullets.length) {
        deltas.summaryBullets.push(`Snapshot diperbarui (${daysElapsed} hari sejak ${prevDate}) tanpa perubahan signifikan.`);
      }
    }

    clubHist[currentDate] = snapshotData;
    const allDates = Object.keys(clubHist).sort();
    if (allDates.length > 40) {
      for (const oldK of allDates.slice(0, allDates.length - 40)) {
        delete clubHist[oldK];
      }
    }
    hist[teamId] = clubHist;
    return { deltas, updatedHistory: hist, clubHistory: clubHist };
  }

  function buildProgressionPayload(clubHist, currentDate, ctx = {}) {
    const histMap = (clubHist && typeof clubHist === 'object') ? clubHist : {};
    const dates = Object.keys(histMap).sort();
    const clubTimeline = dates.map(d => {
      const s = histMap[d] || {};
      return {
        date: d,
        budget: Math.round(U.safeNum(s.budget, 0)),
        payroll: Math.round(U.safeNum(s.payroll, 0)),
        members: U.safeInt(s.members, 0),
        bestXiAvg: (s.bestXiAvg !== undefined && s.bestXiAvg !== null) ? U.safeNum(s.bestXiAvg, 0) : null,
        squadAvg: (s.squadAvg !== undefined && s.squadAvg !== null) ? U.safeNum(s.squadAvg, 0) : null,
        leaguePos: (s.leaguePos !== undefined && s.leaguePos !== null) ? U.safeInt(s.leaguePos, 0) : null,
        leaguePts: (s.leaguePts !== undefined && s.leaguePts !== null) ? U.safeInt(s.leaguePts, 0) : null,
        ctLevel: (s.ctLevel !== undefined && s.ctLevel !== null) ? U.safeInt(s.ctLevel, 1) : null,
        rep: (s.reputation !== undefined && s.reputation !== null) ? Math.round(U.safeNum(s.reputation, 0)) : null,
      };
    });

    const userRoster = Array.isArray(ctx.userRoster) ? ctx.userRoster : [];
    const bRosterExport = Array.isArray(ctx.bRosterExport) ? ctx.bRosterExport : [];
    const youthRanked = Array.isArray(ctx.youthRanked) ? ctx.youthRanked : [];
    const trainCurSet = new Set((ctx.trainAudit && Array.isArray(ctx.trainAudit.currentIds)) ? ctx.trainAudit.currentIds : []);
    const clubLevel = U.safeInt(ctx.clubLevel, 15);
    const country = String(ctx.userCountry || '').toUpperCase();
    const ctLevel = U.clamp(U.safeInt(ctx.ctLevel, 1), 1, 10);

    const candidates = [];
    const seenIds = new Set();

    for (const p of userRoster) {
      if (!p || !p.id || seenIds.has(p.id)) continue;
      if (p.potCap > p.force && !p.isDeclining) {
        seenIds.add(p.id);
        candidates.push({ src: 'roster', pl: p, inTrain: trainCurSet.has(p.id) });
      }
    }

    const bTop = [...bRosterExport]
      .filter(p => p && p.id && !seenIds.has(p.id) && ((p.potCap || p.force) - p.force) >= 6 && p.age <= 23)
      .sort((a, b) => (((b.potCap || b.force) - b.force) - ((a.potCap || a.force) - a.force)) || (b.force - a.force))
      .slice(0, 12);
    for (const p of bTop) {
      seenIds.add(p.id);
      candidates.push({ src: 'bteam', pl: p, inTrain: false });
    }

    const yTop = [...youthRanked]
      .filter(y => y && y.id && !seenIds.has(y.id) && y.age <= 20)
      .sort((a, b) => (b.pipeScore || 0) - (a.pipeScore || 0))
      .slice(0, 10);
    for (const y of yTop) {
      seenIds.add(y.id);
      candidates.push({ src: 'youth', pl: y, inTrain: false });
    }

    const wonderkids = candidates.map(({ src, pl, inTrain }) => {
      const cap = Math.max(U.safeInt(pl.force, 10), U.safeInt(pl.potCap !== undefined ? pl.potCap : pl.estPotCap, pl.force || 10));
      const curGf = U.roundTo(U.safeNum(pl.growthFrac, 0), 3);
      const curEff = U.roundTo(pl.effForce !== undefined && pl.effForce !== null ? U.safeNum(pl.effForce, pl.force + curGf) : (pl.force + curGf), 2);
      const proj = U.calcGrowthProjection({ ...pl, potCap: cap }, {
        clubLevel,
        country,
        ctLevel,
        inTrain,
        played: src === 'youth' ? true : ((pl.seasonMinutes || 0) > 0 || (pl.gamesPlayed || 0) > 0),
        unhappy: pl.mood === 'unhappy' || Boolean(pl.roleSore),
      });

      const obsPoints = [];
      for (const d of dates) {
        const snap = histMap[d] || {};
        const rec = (snap.players && snap.players[pl.id])
          || (snap.bTeam && snap.bTeam[pl.id])
          || (snap.youth && snap.youth[pl.id])
          || null;
        if (!rec) continue;
        const rf = U.safeInt(rec.force, pl.force);
        const rgf = U.roundTo(U.safeNum(rec.gf, 0), 3);
        const rEff = U.roundTo(rf + rgf, 2);
        obsPoints.push({
          date: d,
          force: rf,
          effForce: rEff,
          gf: rgf,
          dev: (rec.dev !== undefined && rec.dev !== null) ? U.safeInt(rec.dev, 0) : null,
          mv: Math.round(U.safeNum(rec.mv, 0)),
        });
      }

      if (!obsPoints.length || obsPoints[obsPoints.length - 1].date !== currentDate) {
        obsPoints.push({
          date: currentDate,
          force: U.safeInt(pl.force, 0),
          effForce: curEff,
          gf: curGf,
          dev: src === 'youth' ? U.safeInt(pl.development, 0) : null,
          mv: Math.round(U.safeNum(pl.marketValue, 0)),
        });
      }

      let obsDeltaEff = 0;
      let obsWeeks = 0;
      let obsWeeklyRate = null;
      let paceRatio = null;
      let paceStatus = 'BASELINE';
      let paceNote = `Proyeksi engine +${proj.weeklyRate.toFixed(3)} F/pkn — simpan save berikutnya untuk mengukur laju aktual.`;

      if (obsPoints.length >= 2) {
        const first = obsPoints[0];
        const last = obsPoints[obsPoints.length - 1];
        const daysSpan = Math.max(0, U.daysBetweenIso(first.date, last.date));
        obsWeeks = U.roundTo(daysSpan / 7, 1);
        obsDeltaEff = U.roundTo(last.effForce - first.effForce, 2);
        if (obsWeeks >= 0.5) {
          obsWeeklyRate = U.roundTo(obsDeltaEff / obsWeeks, 4);
          paceRatio = U.roundTo(obsWeeklyRate / Math.max(0.01, proj.weeklyRate), 2);
          if (paceRatio >= 1.15) {
            paceStatus = 'AHEAD';
            paceNote = `Lebih cepat (${Math.round(paceRatio * 100)}% dari target +${proj.weeklyRate.toFixed(3)}/pkn).`;
          } else if (paceRatio >= 0.75) {
            paceStatus = 'ON_TRACK';
            paceNote = `Sesuai jalur (${Math.round(paceRatio * 100)}% dari target +${proj.weeklyRate.toFixed(3)}/pkn).`;
          } else {
            paceStatus = 'BEHIND';
            paceNote = `Di bawah target (${Math.round(paceRatio * 100)}%) — cek menit main, mood, atau masukkan ke slot CT.`;
          }
        }
      }

      const gap = Math.max(0, cap - U.safeInt(pl.force, 0));
      return {
        id: pl.id,
        src,
        name: pl.name,
        pos: pl.pos,
        age: U.safeInt(pl.age, 20),
        force: U.safeInt(pl.force, 0),
        potCap: cap,
        gap,
        growthFrac: curGf,
        effForce: curEff,
        inTrain,
        mins: U.safeInt(pl.seasonMinutes, 0),
        dev: src === 'youth' ? U.safeInt(pl.development, 0) : null,
        hash: U.safeInt(pl.hash, 0),
        estWeeklyRate: proj.weeklyRate,
        rateIfTrained: proj.rateIfTrained,
        weeksToNext: proj.weeksToNext,
        weeksToCap: proj.weeksToCap,
        etaMonthsToCap: proj.etaMonthsToCap,
        projectedCurve: proj.projectedCurve,
        obsPoints,
        obsDeltaEff,
        obsWeeks,
        obsWeeklyRate,
        paceRatio,
        paceStatus,
        paceNote,
      };
    });

    const srcOrder = { roster: 0, bteam: 1, youth: 2 };
    wonderkids.sort((a, b) => {
      if (a.inTrain !== b.inTrain) return a.inTrain ? -1 : 1;
      const so = (srcOrder[a.src] ?? 9) - (srcOrder[b.src] ?? 9);
      if (so !== 0) return so;
      return (b.gap - a.gap) || (a.age - b.age);
    });

    return {
      snapshotCount: dates.length,
      oldestDate: dates.length ? dates[0] : currentDate,
      latestDate: dates.length ? dates[dates.length - 1] : currentDate,
      clubTimeline,
      wonderkids,
    };
  }

  function cleanPresGoals(rawPg, worldComps = null) {
    if (!rawPg || typeof rawPg !== 'object' || Array.isArray(rawPg)) return rawPg || {};
    const pg = JSON.parse(JSON.stringify(rawPg));
    const comps = (worldComps && typeof worldComps === 'object') ? worldComps : {};
    for (const k of ['league', 'cup', 'cont']) {
      if (pg[k] && typeof pg[k] === 'object') {
        const cid = String(pg[k].comp || '');
        const wcName = cid && comps[cid] && comps[cid].name ? comps[cid].name : '';
        pg[k].name = U.translateCompName(pg[k].name || wcName || cid, cid);
      }
    }
    if (pg.last && typeof pg.last === 'object') {
      for (const k of ['league', 'cup', 'cont']) {
        if (pg.last[k] && typeof pg.last[k] === 'object') {
          const cid = String(pg.last[k].comp || '');
          const wcName = cid && comps[cid] && comps[cid].name ? comps[cid].name : '';
          pg.last[k].name = U.translateCompName(pg.last[k].name || wcName || cid, cid);
        }
      }
    }
    return pg;
  }

  function auditMatchOrdersList(rawOrders, rosterById, xiIds) {
    const orders = Array.isArray(rawOrders) ? rawOrders : [];
    const rMap = rosterById instanceof Map ? rosterById : new Map();
    const xSet = xiIds instanceof Set ? xiIds : new Set();
    let activeOrderCnt = 0;
    let hasTiredSubOrder = false;
    const orderIssues = [];
    for (const ord of orders) {
      if (!ord || typeof ord !== 'object' || ord.on === false) continue;
      activeOrderCnt++;
      const oName = String(ord.name || 'Order #' + activeOrderCnt);
      const when = ord.when || {};
      const does = Array.isArray(ord.does) ? ord.does : [];
      if ((when.redUs || when.redThem) && does.some(a => a && a.kind === 'formation')) {
        orderIssues.push({ severity: 'CRITICAL', title: `Order "${oName}": Ubah Formasi Diblokir Kartu Merah`, detail: 'Aksi ganti formasi otomatis gagal (formationBlocked) saat kondisi redUs/redThem aktif. Hapus aksi formasi pada order ini.' });
      }
      for (const act of does) {
        if (!act || act.kind !== 'sub') continue;
        if (act.out && act.out.mode === 'tired') hasTiredSubOrder = true;
        if (act.out && act.out.mode === 'player' && act.out.id) {
          const po = rMap.get(act.out.id);
          if (!po) orderIssues.push({ severity: 'CRITICAL', title: `Order "${oName}": Pemain Keluar Hilang`, detail: 'Pemain target substitusi keluar sudah tidak ada di skuad — ubah ke mode "The most tired".' });
          else if (po.injured || po.suspended) orderIssues.push({ severity: 'WARN', title: `Order "${oName}": ${po.name} Cedera/Skorsing`, detail: 'Pemain tidak akan berada di lapangan; pertimbangkan pakai mode "The most tired".' });
          else if (!xSet.has(po.id)) orderIssues.push({ severity: 'INFO', title: `Order "${oName}": ${po.name} Tidak di Best XI`, detail: 'Sub hanya berjalan jika pemain ini menjadi starter.' });
        }
        if (act.in && act.in.mode === 'player' && act.in.id) {
          const pi = rMap.get(act.in.id);
          if (!pi) orderIssues.push({ severity: 'CRITICAL', title: `Order "${oName}": Pemain Masuk Hilang`, detail: 'Pemain pengganti sudah tidak ada di skuad — ubah ke mode "Best sub / Same slot".' });
          else if (pi.injured || pi.suspended) orderIssues.push({ severity: 'WARN', title: `Order "${oName}": ${pi.name} Cedera/Skorsing`, detail: 'Pemain pengganti tidak tersedia untuk masuk.' });
          else if (xSet.has(pi.id)) orderIssues.push({ severity: 'WARN', title: `Order "${oName}": ${pi.name} Sudah Starter`, detail: 'Starter tidak bisa masuk dari bangku cadangan — ubah ke "Same slot".' });
        }
      }
    }
    return {
      count: orders.length,
      activeCount: activeOrderCnt,
      hasTiredSub: hasTiredSubOrder,
      issues: orderIssues,
    };
  }

  /**
   * Ekstraksi Analitik Forensik & Telemetri Pasca-Laga dari `save.matchLog` (pos, sh, so, pa, g, cd, f, l).
   * Catatan skema: `m.pos` & `m.sh/so/pa/f/l/cd` memakai indeks/sisi [0 = home, 1 = away].
   */
  function buildMatchTelemetry(save, userId, userRoster, currentSeason) {
    const rawLog = Array.isArray(save.matchLog) ? save.matchLog : [];
    const userMatches = rawLog.filter(m => m && (m.h === userId || m.a === userId));
    const curS = U.safeInt(currentSeason, 1);
    const seasonMatches = userMatches.filter(m => U.safeInt(m.s, 0) === curS);

    const rosterById = new Map();
    const rosterByName = new Map();
    for (const p of (Array.isArray(userRoster) ? userRoster : [])) {
      rosterById.set(p.id, p);
      const low = String(p.name || '').trim().toLowerCase();
      const prev = rosterByName.get(low);
      if (!prev || p.force > prev.force) rosterByName.set(low, p);
    }

    function bucketIdx(min) {
      const m = U.safeNum(min, 45);
      if (m <= 15) return 0;
      if (m <= 30) return 1;
      if (m <= 45) return 2;
      if (m <= 65) return 3;
      if (m <= 80) return 4;
      return 5;
    }

    function aggregateScope(list) {
      let games = 0, wins = 0, draws = 0, losses = 0, gf = 0, ga = 0, cleanSheets = 0;
      let posSum = 0, posCnt = 0;
      let shFor = 0, shAg = 0, soFor = 0, soAg = 0, shCnt = 0;
      let paForSum = 0, paAgSum = 0, paCnt = 0;
      let yellows = 0, reds = 0;
      const bLabels = ["0–15'", "16–30'", "31–45+'", "46–65'", "66–80'", "81–90+'"];
      const minuteBuckets = bLabels.map(lbl => ({ label: lbl, gf: 0, ga: 0 }));
      const formMap = new Map();
      const oppFormMap = new Map();
      const pStats = new Map();

      for (const m of list) {
        const isHome = m.h === userId;
        const uSide = isHome ? 0 : 1;
        const oSide = 1 - uSide;
        const ug = U.safeInt(isHome ? m.hg : m.ag, 0);
        const og = U.safeInt(isHome ? m.ag : m.hg, 0);
        games++;
        gf += ug;
        ga += og;
        if (ug > og) wins++;
        else if (ug === og) draws++;
        else losses++;
        if (og === 0) cleanSheets++;

        const upos = typeof m.pos === 'number' ? (isHome ? m.pos : (100 - m.pos)) : null;
        if (upos !== null && Number.isFinite(upos)) {
          posSum += upos;
          posCnt++;
        }
        if (Array.isArray(m.sh) && m.sh.length >= 2) {
          shFor += U.safeInt(m.sh[uSide], 0);
          shAg += U.safeInt(m.sh[oSide], 0);
          shCnt++;
        }
        if (Array.isArray(m.so) && m.so.length >= 2) {
          soFor += U.safeInt(m.so[uSide], 0);
          soAg += U.safeInt(m.so[oSide], 0);
        }
        if (Array.isArray(m.pa) && m.pa.length >= 2) {
          paForSum += U.safeNum(m.pa[uSide], 0);
          paAgSum += U.safeNum(m.pa[oSide], 0);
          paCnt++;
        }
        if (Array.isArray(m.cd) && m.cd.length >= 4) {
          yellows += U.safeInt(m.cd[uSide * 2], 0);
          reds += U.safeInt(m.cd[uSide * 2 + 1], 0);
        }

        const pGoalsThisMatch = new Map();
        for (const g of (Array.isArray(m.g) ? m.g : [])) {
          if (!Array.isArray(g)) continue;
          const bi = bucketIdx(g[0]);
          if (g[1] === uSide) {
            minuteBuckets[bi].gf++;
            const sn = String(g[3] || '').trim().toLowerCase();
            if (sn) pGoalsThisMatch.set(sn, (pGoalsThisMatch.get(sn) || 0) + 1);
          } else {
            minuteBuckets[bi].ga++;
          }
        }
        const pCardsThisMatch = new Map();
        for (const k of (Array.isArray(m.k) ? m.k : [])) {
          if (!Array.isArray(k)) continue;
          if (k[1] === uSide) {
            const kn = String(k[3] || '').trim().toLowerCase();
            if (kn) pCardsThisMatch.set(kn, (pCardsThisMatch.get(kn) || 0) + 1);
          }
        }

        const uForm = Array.isArray(m.f) ? String(m.f[uSide] || '-').trim() : '-';
        const oForm = Array.isArray(m.f) ? String(m.f[oSide] || '-').trim() : '-';
        const updMap = (mp, key) => {
          let row = mp.get(key);
          if (!row) {
            row = { key, games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, posSum: 0, posCnt: 0 };
            mp.set(key, row);
          }
          row.games++;
          if (ug > og) row.w++;
          else if (ug === og) row.d++;
          else row.l++;
          row.gf += ug;
          row.ga += og;
          if (upos !== null) { row.posSum += upos; row.posCnt++; }
        };
        updMap(formMap, uForm);
        updMap(oppFormMap, oForm);

        const uLine = (Array.isArray(m.l) && Array.isArray(m.l[uSide])) ? m.l[uSide] : [];
        for (const pl of uLine) {
          if (!Array.isArray(pl) || pl.length < 3) continue;
          const nm = String(pl[0] || '').trim();
          const low = nm.toLowerCase();
          const pos = String(pl[1] || '-');
          const rt = U.safeNum(pl[2], 0);
          const subMin = pl.length >= 4 ? U.safeInt(pl[3], 0) : 0;
          let st = pStats.get(low);
          if (!st) {
            const rp = rosterByName.get(low) || null;
            st = {
              id: rp ? rp.id : null,
              name: rp ? rp.name : nm,
              pos: rp ? rp.pos : pos,
              force: rp ? rp.force : 0,
              isCurrent: Boolean(rp),
              apps: 0,
              starts: 0,
              subs: 0,
              ratingSum: 0,
              subRatingSum: 0,
              goals: 0,
              cards: 0,
            };
            pStats.set(low, st);
          }
          st.apps++;
          if (subMin > 0) {
            st.subs++;
            st.subRatingSum += rt;
          } else {
            st.starts++;
          }
          st.ratingSum += rt;
          st.goals += (pGoalsThisMatch.get(low) || 0);
          st.cards += (pCardsThisMatch.get(low) || 0);
        }
      }

      const finForm = mp => Array.from(mp.values()).map(r => ({
        formation: r.key,
        oppForm: r.key,
        games: r.games,
        w: r.w,
        d: r.d,
        l: r.l,
        gf: r.gf,
        ga: r.ga,
        gd: r.gf - r.ga,
        winPct: r.games ? U.roundTo((r.w / r.games) * 100, 1) : 0,
        ppg: r.games ? U.roundTo((r.w * 3 + r.d) / r.games, 2) : 0,
        gfPg: r.games ? U.roundTo(r.gf / r.games, 2) : 0,
        gaPg: r.games ? U.roundTo(r.ga / r.games, 2) : 0,
        avgPos: r.posCnt ? U.roundTo(r.posSum / r.posCnt, 1) : 50,
      })).sort((a, b) => (b.games - a.games) || (b.ppg - a.ppg));

      const h1 = {
        gf: minuteBuckets[0].gf + minuteBuckets[1].gf + minuteBuckets[2].gf,
        ga: minuteBuckets[0].ga + minuteBuckets[1].ga + minuteBuckets[2].ga,
      };
      const mid2 = { gf: minuteBuckets[3].gf, ga: minuteBuckets[3].ga };
      const orderZone = {
        gf: minuteBuckets[4].gf + minuteBuckets[5].gf,
        ga: minuteBuckets[4].ga + minuteBuckets[5].ga,
      };
      const lateShareGa = ga > 0 ? U.roundTo((orderZone.ga / ga) * 100, 1) : 0;
      const lateShareGf = gf > 0 ? U.roundTo((orderZone.gf / gf) * 100, 1) : 0;
      let orderVerdict = 'Seimbang di menit akhir (66–90+\').';
      if (games > 0) {
        if (orderZone.gf >= orderZone.ga * 2 && lateShareGa <= 32) {
          orderVerdict = `Match Orders menit akhir dominan: cetak ${orderZone.gf} gol (${lateShareGf}% total gol) vs hanya kebobolan ${orderZone.ga} (${lateShareGa}%).`;
        } else if (lateShareGa >= 36 && orderZone.ga > orderZone.gf) {
          orderVerdict = `WASPADA menit 66–90+': ${lateShareGa}% kebobolan (${orderZone.ga} gol) terjadi di menit akhir! Aktifkan Order Defend Lead + sub pemain <60% stamina lebih awal.`;
        } else if (lateShareGa >= 34) {
          orderVerdict = `Cukup rapat tapi ${lateShareGa}% kebobolan (${orderZone.ga} dari ${ga}) muncul di menit 66–90+'. Pertimbangkan sub bertahan menit 65.`;
        } else {
          orderVerdict = `Stabil di menit 66–90+': ${orderZone.gf} gol vs ${orderZone.ga} kebobolan (${lateShareGa}% dari total GA).`;
        }
      }

      const rawPlayers = Array.from(pStats.values()).map(s => ({
        ...s,
        avgRating: s.apps ? U.roundTo(s.ratingSum / s.apps, 2) : 0,
        subAvgRating: s.subs ? U.roundTo(s.subRatingSum / s.subs, 2) : 0,
      }));
      const curList = rawPlayers.filter(p => p.isCurrent);
      const poolForRank = curList.length >= 6 ? curList : rawPlayers;
      const teamAvgRt = poolForRank.length
        ? U.roundTo(poolForRank.reduce((sum, x) => sum + x.avgRating * x.apps, 0) / Math.max(1, poolForRank.reduce((sum, x) => sum + x.apps, 0)), 2)
        : 6.5;
      const minApps = games >= 25 ? 4 : (games >= 8 ? 2 : 1);
      const overperformers = [...poolForRank]
        .filter(p => p.apps >= minApps)
        .sort((a, b) => (b.avgRating - a.avgRating) || (b.goals - a.goals))
        .slice(0, 6);
      const supersubs = [...poolForRank]
        .filter(p => p.subs >= (games >= 25 ? 2 : 1))
        .sort((a, b) => (b.subAvgRating - a.subAvgRating) || (b.subs - a.subs))
        .slice(0, 6);
      const underperformers = [...poolForRank]
        .filter(p => p.apps >= minApps && p.avgRating < teamAvgRt)
        .sort((a, b) => (a.avgRating - b.avgRating) || (b.force - a.force))
        .slice(0, 5);

      return {
        games,
        wins,
        draws,
        losses,
        winPct: games ? U.roundTo((wins / games) * 100, 1) : 0,
        ppg: games ? U.roundTo((wins * 3 + draws) / games, 2) : 0,
        gf,
        ga,
        gd: gf - ga,
        cleanSheets,
        avgPos: posCnt ? U.roundTo(posSum / posCnt, 1) : 0,
        avgShotsFor: shCnt ? U.roundTo(shFor / shCnt, 1) : 0,
        avgShotsAg: shCnt ? U.roundTo(shAg / shCnt, 1) : 0,
        avgOnTargetFor: shCnt ? U.roundTo(soFor / shCnt, 1) : 0,
        avgOnTargetAg: shCnt ? U.roundTo(soAg / shCnt, 1) : 0,
        shotAccPct: shFor ? U.roundTo((soFor / shFor) * 100, 1) : 0,
        convShotPct: shFor ? U.roundTo((gf / shFor) * 100, 1) : 0,
        convOtPct: soFor ? U.roundTo((gf / soFor) * 100, 1) : 0,
        avgPassFor: paCnt ? U.roundTo(paForSum / paCnt, 1) : 0,
        avgPassAg: paCnt ? U.roundTo(paAgSum / paCnt, 1) : 0,
        yellows,
        reds,
        minuteBuckets,
        phases: { h1, mid2, orderZone, lateShareGf, lateShareGa },
        orderVerdict,
        byFormation: finForm(formMap),
        vsOppFormation: finForm(oppFormMap).slice(0, 10),
        playerTelemetry: {
          teamAvgRating: teamAvgRt,
          overperformers,
          supersubs,
          underperformers,
          allPlayers: [...rawPlayers].sort((a, b) => b.avgRating - a.avgRating).slice(0, 30),
        },
      };
    }

    return {
      currentSeason: curS,
      all: aggregateScope(userMatches),
      season: aggregateScope(seasonMatches),
    };
  }

  function buildPriorityAlerts(
    userRoster, youthRanked, moodsMap, unhappyCnt, lockerHit,
    namingObj, sponsorsObj, ticketMul, shopAudit, memberAudit,
    holes, upcomingMatches, trainAudit, preContracts, userDiv,
    autoGuard = null, bestXi = null, optLigaPrices = null, activeFormation = '4-3-3',
    bTeamInfo = null, presetAudit = null
  ) {
    const alerts = [];
    const add = (sev, cat, title, action) => alerts.push({ sev, cat, title, action });

    if (activeFormation === '3-4-3') {
      add('CRITICAL', 'Bug Engine 3-4-3', 'Formasi aktif 3-4-3 terkena Bug Engine v1.2.0 (#34992)!',
        'Di bytecode #34992 slotSector, slot penyerang ke-11 pada 3-4-3 memakai rule ID 18 yang jatuh ke sektor "X" (bukan "A"), sehingga ATK kehilangan -33%! Segera ganti ke 4-2-3-1, 4-3-3, atau 3-4-2-1.');
    }

    if (autoGuard && typeof autoGuard === 'object') {
      if (autoGuard.fineAuto) {
        add('CRITICAL', 'Auto-Guard', 'Auto-Fine Kartu Merah masih ON!',
          'Matikan segera! Auto-Fine langsung denda 100%/50% (risiko slump 50%/25%). Beri denda manual 20% = 0% risiko + uang gratis.');
      }
      if (autoGuard.trainMode === 'auto') {
        add('HIGH', 'Auto-Guard', 'Auto Special Training masih ON (Buta potCap)!',
          'Ubah ke Manual! Mode auto (#34840) cuma pilih usia termuda meski sudah mentok potCap.');
      }
      if (autoGuard.autoBy === 'force') {
        add('HIGH', 'Auto-Guard', "Auto Lineup mode 'force' aktif!",
          'Matikan agar game tidak menimpa taktik ke marking:light & melewatkan penendang penalti FIN slot 2.');
      }
      if (autoGuard.autoRenew && !autoGuard.hasTrapCore) {
        add('MEDIUM', 'Auto-Guard', 'Auto-Renew Kontrak sedang ON!',
          'Matikan saat normal agar kamu bisa mengincar diskon gaji -12% saat sisa kontrak >=60 hari (ideal 60–120 hari).');
      }
    }

    for (const p of userRoster) {
      if (p.injured && p.forSale) {
        const discPct = Math.round((1.0 - (p.injurySaleMul || 0.72)) * 100);
        add('CRITICAL', 'Transfer v9', `${p.name} sedang CEDERA (${p.injuryDays}d) tapi status For Sale!`,
          `Segera tarik dari daftar jual! Di v1.2.0 (#3542), menjual pemain cedera ${p.injuryTier} terkena potongan harga -${discPct}%. Tunggu sembuh dulu.`);
      }
    }

    const trapCore = userRoster.filter(
      p => p.contractDays <= 10 && (p.force >= 40 || p.isGem || (p.squadRank || 99) <= 14) && !p.loanedFrom
    );
    const trapCoreIds = new Set(trapCore.map(p => p.id));
    const trapOther = userRoster.filter(p => p.contractDays <= 10 && !trapCoreIds.has(p.id));
    if (trapCore.length) {
      const blockedNoAuto = trapCore.filter(p => p.noAutoRenew);
      const names = trapCore.slice(0, 4).map(p => `${p.name} (${p.contractDays}d${p.noAutoRenew ? ', noAutoRenew!' : ''})`).join(', ');
      const extraWarn = blockedNoAuto.length
        ? ` PENTING: Matikan dulu centang noAutoRenew pada ${blockedNoAuto.map(p => p.name).join(', ')}!`
        : '';
      add('CRITICAL', 'Loophole 0%', `${trapCore.length} pemain inti masuk Zona Jebakan <=10 hari!`,
        `${names}. Jangan renew manual (+20%–35%)! Nyalakan Auto-Renew sementara (tandai noAutoRenew di cadangan) agar diperpanjang 180d dengan gaji 0% naik!${extraWarn}`);
    } else if (trapOther.length) {
      const names = trapOther.slice(0, 4).map(p => `${p.name} (${p.contractDays}d)`).join(', ');
      add('HIGH', 'Kontrak', `${trapOther.length} pemain cadangan kontrak <=10 hari.`,
        `Pemain: ${names}. Pastikan Auto-Renew OFF / noAutoRenew ON agar pergi gratis menghemat gaji.`);
    }

    const namingWarnMonths = C.NAMING_WARN_MONTHS || 3;
    if (namingObj && typeof namingObj === 'object' && U.safeInt(namingObj.monthsLeft, 99) <= namingWarnMonths) {
      const ml = U.safeInt(namingObj.monthsLeft, 0);
      add('CRITICAL', 'Naming Rights', `Naming Rights tinggal ${ml} bulan (${namingObj.name || '-'})!`,
        'Saat habis, WAJIB pilih kontrak 1 TAHUN (pengali 1.15x/thn, +30.7% lebih besar dari 5 tahun) di kapasitas stadion terbaru.');
    } else if (!namingObj) {
      add('CRITICAL', 'Naming Rights', 'Belum ada kontrak Naming Rights stadion aktif!',
        'Segera tanda tangani Naming Rights durasi 1 TAHUN (1.15x).');
    }

    if (unhappyCnt >= C.LOCKER_UNHAPPY_MIN) {
      add('CRITICAL', 'Ruang Ganti', `${unhappyCnt} pemain UNHAPPY — Penalti Tim -${Math.round(lockerHit * 100)}% AKTIF!`,
        "Atur pemain cadangan (#12 ke bawah) jadi squadRole = 'reserve' (kebal unhappy di v1.2.0 selama tidak roleSore) atau beri menit main sesuai target kuota.");
    }

    const slumped = userRoster.filter(p => (p.fineSlump || 0) > 0);
    if (slumped.length) {
      const sTxt = slumped.slice(0, 4).map(p => `${p.name} (-${Math.round(p.fineSlumpPct)}%, ${p.fineSlumpDays}d)`).join(', ');
      add('HIGH', 'Fine Slump', `${slumped.length} pemain sedang terkena penalti denda (fineSlump)!`,
        `${sTxt}. Performa mereka terpotong di lapangan sampai durasi habis. Ke depan gunakan denda maksimal 20% (0% risiko).`);
    }

    const goldC = userRoster.filter(p => p.contractDays >= C.RENEW_GOLDEN_MIN && p.contractDays <= C.RENEW_GOLDEN_MAX && !p.loanedFrom);
    if (goldC.length) {
      const names = goldC.slice(0, 5).map(p => `${p.name} (${p.contractDays}d)`).join(', ');
      add('HIGH', 'Kontrak -12%', `${goldC.length} pemain di GOLDEN WINDOW (60–120 hari)!`,
        `${names}. Di bytecode #24161, diskon 3 Tahun (-12% gaji) hanya berlaku saat sisa >=60 hari (di 11–59 hari mereka minta naik +5–15%!). Perpanjang sekarang sebelum turun ke <60 hari!`);
    }

    const bpDiv = C.TICKETS_BASE[userDiv] || C.TICKETS_BASE[1];
    const curPLiga = {};
    for (const s of ['geral', 'arquibancada', 'cadeiras', 'camarotes']) {
      curPLiga[s] = Math.max(1, Math.round(bpDiv[s] * (ticketMul[s] ?? 1.0)));
    }
    const optP = optLigaPrices || {
      geral: Math.round(bpDiv.geral * 1.2),
      arquibancada: Math.round(bpDiv.arquibancada * 1.4),
      cadeiras: Math.round(bpDiv.cadeiras * 1.92),
      camarotes: Math.round(bpDiv.camarotes * 2.0),
    };
    const ticketGaps = [];
    if (curPLiga.arquibancada < optP.arquibancada - 1) ticketGaps.push(`Stands ${curPLiga.arquibancada}→${optP.arquibancada}`);
    if (curPLiga.cadeiras < optP.cadeiras - 1) ticketGaps.push(`Seats ${curPLiga.cadeiras}→${optP.cadeiras}`);
    if (curPLiga.camarotes < optP.camarotes - 2) ticketGaps.push(`Boxes ${curPLiga.camarotes}→${optP.camarotes}`);
    if (ticketGaps.length) {
      add('HIGH', 'Tiket Stadion v9', `Harga tiket Liga Normal di bawah optimal v9 (${ticketGaps.join(', ')})!`,
        'Sesuaikan harga tiket di Tab 5B sesuai kurva BASE_ATTENDANCE #19915 untuk profit ekstra sambil menjaga penonton >70%.');
    }
    if (curPLiga.geral > optP.geral + 1) {
      add('HIGH', 'Tiket General', `Tiket General (${curPLiga.geral}) di atas titik optimal (${optP.geral})!`,
        `Turunkan General ke ${optP.geral} agar pendapatan optimal dan total penonton tetap >70% (bonus +2% Tengah).`);
    }

    if (!shopAudit.is_optimal) {
      add('HIGH', 'Club Shop v9', `Harga Jersey Club Shop di ${shopAudit.cur_m.toFixed(2)}x (bukan puncak 1.00x)!`,
        `Sesuai rumus eksak priceFactor v1.2.0 (#21317), titik puncak pendapatan jersey adalah tepat 1.00x (+${shopAudit.gain_pct.toFixed(2)}% potensi naik).`);
    }

    if (!memberAudit.is_optimal) {
      add('HIGH', 'Member Plan v9', `Setelan Member saat ini ${memberAudit.cur_m.toFixed(2)}x / diskon ${memberAudit.cur_d}% (${U.roundTo(memberAudit.cur_parcel / 1000, 1)}K/bln)!`,
        `Ubah ke ${memberAudit.opt_m.toFixed(2)}x + Diskon Tahunan ${memberAudit.opt_d}% (#21325–#21335) untuk puncak pendapatan (${U.roundTo(memberAudit.opt_parcel / 1000, 1)}K/bln, +${memberAudit.gain_pct.toFixed(2)}%).`);
    }

    const footHoles = holes.filter(h => h.kind === 'FOOT_HOLE');
    if (footHoles.length) {
      add('HIGH', 'Lubang Fullback', `Lubang kaki dominan Fullback di: ${footHoles.map(h => h.pos).join(', ')}!`,
        'Penalti wrongFoot (-5%) aktif di RB/LB & Wingback. Cari pengganti di Akademi atau Auto-Scout.');
    }

    let sContracts = [];
    if (sponsorsObj && typeof sponsorsObj === 'object') {
      const rc = sponsorsObj.contracts;
      if (Array.isArray(rc)) sContracts = rc;
      else if (rc && typeof rc === 'object') sContracts = Object.values(rc);
    }
    if (sContracts.length < 3) {
      add('HIGH', 'Sponsor', `Baru ${sContracts.length}/3 slot Sponsor Jersey terisi!`,
        'Negosiasikan slot kosong dengan perusahaan Tier 3 (minta +7% s.d. +12% sesuai performa klasemen & fanConfidence di percobaan 1, lalu terima counter di percobaan 2).');
    } else {
      // #19870: save v9 memakai `paymentsLeft` (atau fallback `monthsLeft`)
      const expSp = sContracts.filter(c => {
        if (!c || typeof c !== 'object') return false;
        const left = c.paymentsLeft !== undefined ? U.safeInt(c.paymentsLeft, 99) : U.safeInt(c.monthsLeft, 99);
        return left <= 2;
      });
      if (expSp.length) {
        const spNames = expSp.map(c => `${c.name || c.company || 'Sponsor'} (${c.paymentsLeft ?? c.monthsLeft} bln)`).join(', ');
        add('MEDIUM', 'Sponsor', `${expSp.length} kontrak sponsor sisa <=2 bulan: ${spNames}!`,
          'Siapkan negosiasi ulang saat tim di puncak klasemen & fanConfidence tinggi.');
      }
    }

    if (bestXi && Array.isArray(bestXi.setPieceWarnings) && bestXi.setPieceWarnings.length) {
      add('MEDIUM', 'Set-Piece Manual', 'Tombol Auto Set-Piece punya titik buta di XI kamu!',
        bestXi.setPieceWarnings.join(' | '));
    }

    const vetWarn = userRoster.filter(p => (p.isDeclining || p.age >= p.sellWarnAge) && !p.injured);
    if (vetWarn.length) {
      const names = vetWarn.slice(0, 4).map(p => `${p.name} (${U.posEn(p.pos)} ${p.age}th, turun@${p.declineAge})`).join(', ');
      add('MEDIUM', 'Regresi v9', `${vetWarn.length} pemain senior di ambang/fase regresi posisi!`,
        `${names}. Pertimbangkan jual dengan counter +40% sebelum nilai pasar anjlok.`);
    }

    if (trainAudit.wastedNames && trainAudit.wastedNames.length) {
      add('MEDIUM', 'Training', `Slot latihan terbuang di pemain mentok potCap: ${trainAudit.wastedNames.join(', ')}!`,
        'Pindahkan trainMode ke Manual dan isi slot dengan pemain muda ber-gap (potCap - force) terbesar.');
    }

    const readyY = youthRanked.filter(y => y.action === 'PROMOSIKAN SEKARANG');
    if (readyY.length) {
      const ynames = readyY.slice(0, 3).map(y => `${y.name} (${U.posEn(y.pos)} ${y.age}th, ★${y.hash})`).join(', ');
      add('MEDIUM', 'Akademi', `${readyY.length} pemain akademi siap promosi!`,
        `${ynames}. Pemain akademi tumbuh tercepat di usia 20 (rate 0.35, berhenti di >20 / usia 21+) dan dipromosikan otomatis saat pergantian tahun di usia >=20.`);
    }

    if (upcomingMatches.length && upcomingMatches[0].yellowRisks && upcomingMatches[0].yellowRisks.length) {
      const yr = upcomingMatches[0].yellowRisks.map(x => x.name).join(', ');
      add('MEDIUM', 'Kartu Kuning', `Waspada skorsing di laga vs ${upcomingMatches[0].oppName}: ${yr} (2 kuning)!`,
        'Pertimbangkan rotasi atau tarik keluar di menit 60 jika sudah unggul agar tidak absen di laga penting berikutnya.');
    }

    if (bTeamInfo && bTeamInfo.hasBTeam) {
      if ((bTeamInfo.contractAlertCount || 0) > 0) {
        add('MEDIUM', 'Tim B', `${bTeamInfo.contractAlertCount} pemain ${bTeamInfo.bTeamName || 'Tim B'} masuk Kontrak Kritis / Golden Window!`,
          'Buka Tab 3E (Tim B) untuk cek sisa kontrak & ekspor pemain Tim B agar tidak terlewat.');
      }
      if ((bTeamInfo.zeroMinPayrollLeak || 0) >= 150000) {
        const leakK = Math.round(bTeamInfo.zeroMinPayrollLeak / 1000);
        add('MEDIUM', 'Tim B Gaji Bocor', `${bTeamInfo.zeroMinLeakCount} pemain ${bTeamInfo.bTeamName || 'Tim B'} mencatat 0 menit main (${leakK}K/bln terbuang)!`,
          'Buka Tab 3E (Tim B) untuk audit pemain cadangan Tim B yang makan gaji tanpa bermain.');
      }
    }

    if (presetAudit && (presetAudit.summaryAlert || presetAudit.runinAlert)) {
      add('MEDIUM', 'Preset Tiket',
        presetAudit.summaryAlert || presetAudit.runinAlert,
        'Buka Tab 5B (Tiket & Preset) untuk mengganti preset aktif & memperbaiki tarif Run-in.');
    }

    return alerts;
  }

  /**
   * Orkestrator utama (Pure JS, jalan 100% di browser HP / Node.js).
   * Mengembalikan `{ data, updatedHistory }` dengan seluruh data v8.3 Bytecode v9 Verified.
   */
  function analyzeSave(save, staticDb = null, historyStore = null, onProgress = null) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const prog = (pct, msg) => {
      if (typeof onProgress === 'function') {
        try { onProgress(pct, msg); } catch (_) {}
      }
    };

    if (!save || typeof save !== 'object') {
      throw new Error('File save tidak valid (bukan objek JSON LigaFoot).');
    }

    prog(10, 'Memvalidasi struktur save & database statis...');
    const sdb = (staticDb && typeof staticDb === 'object') ? staticDb : {};
    const staticPlayers = sdb.players || {};
    const clubsMeta = sdb.clubs || {};

    const userId = save.userTeamId || '';
    const compactTeams = (save.compactTeams && typeof save.compactTeams === 'object') ? save.compactTeams : {};
    if (!userId || !(userId in compactTeams)) {
      throw new Error(`userTeamId '${userId}' tidak ditemukan di compactTeams! Pastikan ini file save .ligafoot yang valid.`);
    }

    const uTeam = compactTeams[userId];
    const uMeta = U.getStaticClub(clubsMeta, userId);
    const userName = save.userTeamName || uMeta.name || uTeam.name || userId;
    const userCountry = String(uMeta.country || uTeam.country || '').toUpperCase();
    const currentDate = String(save.currentDate || '2026-01-01').slice(0, 10);
    const leagueId = String(save.league || uTeam.league || '');
    const worldComps = (save.world && save.world.comps) || {};
    const userDiv = U.estimateDivisionFromLeague(leagueId, worldComps);

    const budget = U.safeNum(uTeam.budget, 0);
    const reputation = U.safeNum(uTeam.reputation, uMeta.rep || 50);
    const repLevel = T.repToLevel(reputation);
    const userTeamLevel = U.teamLevelOf(uTeam, userDiv, uMeta.level);

    const boardConf = U.safeNum(uTeam.boardConfidence, 70);
    const fanConf = U.safeNum(uTeam.fanConfidence, 70);
    const ctLevel = Math.max(1, U.safeInt(uTeam.ctLevel, 1));
    const ctCond = U.safeInt(uTeam.ctCond, 100);
    const ctMaintOff = Boolean(uTeam.ctMaintOff);
    const youthCoach = U.clamp(U.safeInt(uTeam.youthCoach, 0), 0, 3);
    const bankLoan = Array.isArray(uTeam.loans) && uTeam.loans.length
      ? uTeam.loans.reduce((s, ln) => s + U.safeNum(ln && ln.balance, 0), 0)
      : U.safeNum(uTeam.bankLoan, 0);
    const rawActiveFormation = String(uTeam.formation || (save.lastLineup && save.lastLineup.formation) || '4-3-3').trim();
    const baseActiveFormation = rawActiveFormation.split('~')[0].trim();
    let activeFormation = (baseActiveFormation in C.FORMATIONS)
      ? baseActiveFormation
      : ((rawActiveFormation in C.FORMATIONS) ? rawActiveFormation : '4-3-3');

    const foreignLims = U.getForeignLimit(userCountry);
    const foreignCap = C.FOREIGN_FIELD_LIMITS[userCountry] || foreignLims.field || 7;
    const foreignMax = foreignLims.max || 9;

    prog(25, `Membedah skuad ${userName} & menghitung Best XI (15 formasi)...`);
    const { roster: userRoster, youth: userYouth } = R.extractTeamRoster(
      uTeam, staticPlayers, true, userId, userName, userCountry, userDiv
    );

    const totalPayroll = userRoster.reduce((s, p) => s + p.salary, 0) + U.safeNum(uTeam.loanOutPay, 0);
    const youthPayroll = userYouth.reduce((s, y) => s + y.salary, 0);
    const totalSquadVal = userRoster.reduce((s, p) => s + p.marketValue, 0);
    // #19856: PAYROLL_REF tahunan eksak (28,500,000 untuk ID div 1 repLvl 3)
    const payrollRef = U.payrollRef(userCountry, userDiv, repLevel);
    const foreignCountSquad = userRoster.filter(p => userCountry && p.nationality && p.nationality !== userCountry).length;

    const { moods: moodsMap, unhappyCount: unhappyCnt, lockerHit, teamGames } = T.computeSquadMoodsV9(userRoster, false);
    for (const p of userRoster) {
      const mi = moodsMap[p.id] || {};
      p.mood = mi.mood || 'ok';
      p.moodTier = mi.tier || 0;
      p.minPct = mi.minPct || 0.0;
      p.reqPct = mi.reqPct || 0.0;
      p.moodImmune = Boolean(mi.immune);
      p.roleSore = Boolean(mi.roleSore);
      p.effGames = mi.effGames !== undefined ? mi.effGames : teamGames;
      p.minsNow = mi.minsNow !== undefined ? mi.minsNow : p.seasonMinutes;
      p.minsReq = mi.minsReq !== undefined ? mi.minsReq : 0;
      p.minsDeficit = mi.minsDeficit !== undefined ? mi.minsDeficit : 0;
      p.gamesDeficit = mi.gamesDeficit !== undefined ? mi.gamesDeficit : 0;
      p.moodReason = mi.reason || '';
    }

    const sortedByForce = [...userRoster].sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));
    const top11Slice = sortedByForce.slice(0, 11);
    const avgTop11Force = top11Slice.length
      ? top11Slice.reduce((s, p) => s + p.force, 0) / top11Slice.length
      : 0;
    const buyerCeiling = T.buyerForceCeiling(reputation, userDiv, avgTop11Force, ctLevel);
    const rankOf = {};
    sortedByForce.forEach((p, idx) => { rankOf[p.id] = idx; });
    const top5Ids = new Set(sortedByForce.slice(0, 5).map(p => p.id));

    for (const p of userRoster) {
      const rIdx = rankOf[p.id];
      p.squadRank = rIdx + 1;
      p.isTop5Arab = top5Ids.has(p.id) && p.age >= 26;
      const starterFloor = U.salaryCutFloorMul(false, p.age, p.salaryCuts, p.renewRefusals);
      const reserveFloor = U.salaryCutFloorMul(true, p.age, p.salaryCuts, p.renewRefusals);
      p.salaryFloorFactor = rIdx < 11 ? starterFloor : reserveFloor;
      p.benchCutSave = (!p.salaryCutLocked && rIdx < 11) ? Math.round(p.salary * (starterFloor - reserveFloor)) : 0;
      p.autoRenewLoophole = Boolean(
        p.contractDays <= 10 && !p.noAutoRenew && (p.force >= 40 || p.isGem || rIdx < 14) && !p.loanedFrom
      );
      const actObj = R.classifyUserAction(p, rIdx, p.isTop5Arab, moodsMap);
      p.action = actObj.action;
      p.actionCls = actObj.cls;
    }

    const bestXi = T.solveBestXi(userRoster, rawActiveFormation, foreignCap, userCountry, null, false, repLevel);
    const rotXi = T.solveBestXi(userRoster, rawActiveFormation, foreignCap, userCountry, null, true, repLevel);
    const formCompare = [];
    const formCompareKeys = [...Object.keys(C.FORMATIONS)];
    if (rawActiveFormation.includes('~') && !formCompareKeys.includes(rawActiveFormation)) {
      formCompareKeys.push(rawActiveFormation);
    }
    for (const fk of formCompareKeys) {
      const res = T.solveBestXi(userRoster, fk, foreignCap, userCountry, null, false, repLevel);
      const baseM = C.FORMATION_MODS[res.baseFormation || fk] || { atkMod: 0, defMod: 0 };
      formCompare.push({
        formation: fk,
        baseFormation: res.baseFormation || fk,
        isCustom: Boolean(res.isCustom),
        avgScore: res.avgScore,
        totalScore: res.totalScore,
        sectors: res.sectors,
        engineSectors: res.engineSectors,
        chemistry: res.chemistry,
        foreignCount: res.foreignCount,
        wrongFootCount: res.wrongFootCount,
        atkMod: res.atkMod !== undefined ? res.atkMod : baseM.atkMod,
        defMod: res.defMod !== undefined ? res.defMod : baseM.defMod,
        falseNine: res.falseNine,
        hasFormationBug: res.hasFormationBug,
        formationBugInfo: res.formationBugInfo,
      });
    }
    formCompare.sort((a, b) => {
      if (a.hasFormationBug !== b.hasFormationBug) return a.hasFormationBug ? 1 : -1;
      return b.totalScore - a.totalScore;
    });

    const { holes, holePositions } = T.detectSquadHoles(userRoster, rawActiveFormation);
    const holePosSet = new Set(holePositions);

    // Special Training Audit (#21430 trainSlots = 3 + floor((ctLevel - 1) / 2))
    const rawTrainIds = Array.isArray(uTeam.trainIds) ? uTeam.trainIds : [];
    const trainSlots = 3 + Math.floor((Math.max(1, Math.min(10, ctLevel)) - 1) / 2);
    const trainMode = String(uTeam.trainMode || 'auto');
    const pById = {};
    for (const p of userRoster) pById[p.id] = p;

    const idealCount = Math.max(6, trainSlots + 2);
    const idealTrain = userRoster
      .filter(p => !p.injured && p.age < p.declineAge && (p.potCap - p.force) > 0)
      .sort((a, b) => ((b.potCap - b.force) - (a.potCap - a.force)) || (a.age - b.age) || (b.growthFrac - a.growthFrac))
      .slice(0, idealCount);

    const wastedTrain = [];
    for (const tid of rawTrainIds.slice(0, trainSlots)) {
      const tp = pById[tid];
      if (tp && (tp.force >= tp.potCap || tp.age >= tp.declineAge)) {
        wastedTrain.push(tp.name);
      }
    }
    const trainAudit = {
      slots: trainSlots,
      mode: trainMode,
      currentIds: rawTrainIds.slice(0, trainSlots),
      currentNames: rawTrainIds.slice(0, trainSlots).filter(tid => tid in pById).map(tid => pById[tid].name),
      ideal: idealTrain.map(p => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        age: p.age,
        force: p.force,
        potCap: p.potCap,
        gap: p.potCap - p.force,
        growthFrac: p.growthFrac,
        stackGrade: p.stackGrade,
        nonStack: p.nonStack,
      })),
      wastedNames: wastedTrain,
    };

    const autoGuard = auditAutoSettings(save, uTeam, userRoster, trainAudit);

    // Akademi Ranking + European Mega-Offer estimator (#23886 / #23903)
    const ceilMap = { 7: 5, 8: 15, 9: 25, 10: 30 };
    const youthRanked = userYouth.map(y => {
      const fillsHole = holePosSet.has(y.pos);
      const yScore = U.roundTo(
        y.hash * 10.0 + y.development * 0.45 + y.stackPct * 1.5
        + (fillsHole ? 15.0 : 0.0) + (y.age >= 19 ? 10.0 : 0.0)
        - (y.nonStack ? 8.0 : 0.0),
        1
      );
      let yAct = 'LEPAS / CADANGAN';
      if ((y.age > 20 || y.development >= 90 || (y.age === 20 && y.development >= 75)) && y.hash >= 5) yAct = 'PROMOSIKAN SEKARANG';
      else if (y.hash >= 6 || (fillsHole && y.hash >= 5)) yAct = 'TAHAN & LATIH';
      const ceilBonus = y.development >= 60 ? (ceilMap[y.hash] || 0) : 0;
      const isMegaProspect = Boolean(y.hash >= 9 || y.potCap >= 75);
      const estMegaOffer = isMegaProspect
        ? Math.round(Math.max(y.marketValue * 2.2, payrollRef * (y.hash >= 10 ? 0.35 : 0.22)))
        : Math.round(Math.max(150000, y.marketValue * 1.4));
      return {
        ...y,
        fillsHole,
        pipeScore: yScore,
        action: yAct,
        ceilBonus,
        isMegaProspect,
        estMegaOffer,
      };
    }).sort((a, b) => b.pipeScore - a.pipeScore);

    prog(42, 'Menganalisis stadion, tiket 6 fase, Club Shop & Member Plans...');
    const rawSec = uTeam.stadiumSections || { geral: 6000, arquibancada: 13000, cadeiras: 900, camarotes: 100 };
    const sections = {
      geral: U.safeInt(rawSec.geral, 0),
      arquibancada: U.safeInt(rawSec.arquibancada, 0),
      cadeiras: U.safeInt(rawSec.cadeiras, 0),
      camarotes: U.safeInt(rawSec.camarotes, 0),
    };
    const totalSeats = sections.geral + sections.arquibancada + sections.cadeiras + sections.camarotes;
    const stadiumOps = Math.max(0, totalSeats - C.STADIUM_FREE_SEATS) * C.STADIUM_OPS_PER_SEAT;
    const ticketMul = U.normalizeTicketMul(uTeam.ticketMul);
    const rawTmb = (uTeam.ticketMulBy && typeof uTeam.ticketMulBy === 'object') ? uTeam.ticketMulBy : {};
    const ticketMulBy = {};
    for (const occ of C.TICKET_OCCASIONS) {
      if (occ in rawTmb) ticketMulBy[occ] = U.normalizeTicketMul(rawTmb[occ]);
    }

    const stadOpts = { homeRepLvl: repLevel, country: userCountry, kind: 'league' };
    const curSim = E.simulateStadiumV9(sections, ticketMul, fanConf, userDiv, false, false, 0, stadOpts);
    const optLiga = E.optimizeTicketPricesV9(sections, fanConf, userDiv, false, false, 0, 70.5, stadOpts);
    const optBig = E.optimizeTicketPricesV9(sections, fanConf, userDiv, true, true, 1, 70.5, { ...stadOpts, koStage: 'final', isClassic: true });
    const ticketPhases = E.computeAllTicketPhases(sections, fanConf, userDiv, rawTmb, ticketMul, stadOpts);
    const ticketPhasesByKind = {
      league: ticketPhases,
      cup: E.computeAllTicketPhases(sections, fanConf, userDiv, rawTmb, ticketMul, { homeRepLvl: repLevel, country: userCountry, kind: 'cup' }),
      continental2: E.computeAllTicketPhases(sections, fanConf, userDiv, rawTmb, ticketMul, { homeRepLvl: repLevel, country: userCountry, region: (C.COUNTRY_GROUPS[0].includes(userCountry) ? 0 : 1), kind: 'continental2' }),
      continental1: E.computeAllTicketPhases(sections, fanConf, userDiv, rawTmb, ticketMul, { homeRepLvl: repLevel, country: userCountry, region: (C.COUNTRY_GROUPS[0].includes(userCountry) ? 0 : 1), kind: 'continental1' }),
    };

    const memberAudit = E.evalMemberPlan(uTeam.memberPlan, uTeam.members, fanConf, userCountry, userDiv, repLevel);
    const shopAudit = E.evalClubShop(uTeam.shopPrice, uTeam.shopLog, userRoster, currentDate, fanConf, payrollRef);
    const cashflowMeta = E.computeCashflow3m(uTeam, uTeam.ledger, uTeam.lastLedger, totalPayroll, stadiumOps);

    // Multi-format lookup laga selesai di world.comps (resolusi nama lawan matchLog & GD klasemen)
    const playedByCompDay = new Map();
    const playedUserList = [];
    const leagueGdCalc = {};

    function extractScores(fxObj) {
      const pairs = [['homeGoals', 'awayGoals'], ['hg', 'ag'], ['hs', 'as'], ['gh', 'ga']];
      for (const [kf, ka] of pairs) {
        if (fxObj[kf] !== undefined && fxObj[kf] !== null && fxObj[ka] !== undefined && fxObj[ka] !== null) {
          return [U.safeInt(fxObj[kf], 0), U.safeInt(fxObj[ka], 0)];
        }
      }
      for (const ks of ['score', 'res', 'g', 's', 'placar']) {
        const sv = fxObj[ks];
        if (Array.isArray(sv) && sv.length >= 2 && sv[0] !== null && sv[1] !== null) {
          return [U.safeInt(sv[0], 0), U.safeInt(sv[1], 0)];
        }
        if (typeof sv === 'string' && sv.includes('-')) {
          const ps = sv.split('-', 2);
          return [U.safeInt(ps[0], 0), U.safeInt(ps[1], 0)];
        }
      }
      return [null, null];
    }

    for (const [cidK, compV] of Object.entries(worldComps)) {
      if (!compV || typeof compV !== 'object') continue;
      const cidS = String(cidK);
      const cidTail = cidS.split(':').pop();
      for (const stV of (compV.stages || [])) {
        if (!stV || typeof stV !== 'object') continue;
        for (const rndV of (stV.rounds || [])) {
          if (!rndV || typeof rndV !== 'object') continue;
          const rDayBase = (rndV.day !== undefined && rndV.day !== null) ? rndV.day : rndV.d;
          for (const fxV of (rndV.matches || [])) {
            if (!fxV || typeof fxV !== 'object') continue;
            const [hgI, agI] = extractScores(fxV);
            if (hgI === null || agI === null) continue;
            const hId = fxV.home || fxV.homeId || fxV.h;
            const aId = fxV.away || fxV.awayId || fxV.a;
            const fxDay = (fxV.day !== undefined && fxV.day !== null)
              ? fxV.day
              : ((fxV.d !== undefined && fxV.d !== null) ? fxV.d : rDayBase);
            const dayV = (fxDay !== undefined && fxDay !== null) ? U.safeInt(fxDay, -999) : -999;

            if (cidS === leagueId && hId && aId) {
              leagueGdCalc[hId] = (leagueGdCalc[hId] || 0) + (hgI - agI);
              leagueGdCalc[aId] = (leagueGdCalc[aId] || 0) + (agI - hgI);
            }
            if (hId === userId || aId === userId) {
              const oppK = hId === userId ? aId : hId;
              const oppClub = U.getStaticClub(clubsMeta, oppK);
              const oppNm = oppClub.name || (compactTeams[oppK] && compactTeams[oppK].name) || String(oppK || '');
              const uHm = hId === userId;
              const uGf = uHm ? hgI : agI;
              const uGa = uHm ? agI : hgI;
              const recTup = [oppNm, uHm, uGf, uGa];
              if (dayV !== -999) {
                playedByCompDay.set(`${cidS}|${dayV}`, recTup);
                playedByCompDay.set(`${cidTail}|${dayV}`, recTup);
                playedByCompDay.set(`*|${dayV}`, recTup);
              }
              playedUserList.push([cidS, cidTail, dayV, oppNm, uHm, uGf, uGa]);
            }
          }
        }
      }
    }

    // MatchLog & Home Crowd Log (filter hanya laga klub user, kecualikan nat:*)
    const rawMlog = Array.isArray(save.matchLog) ? save.matchLog : [];
    const clubMlog = rawMlog.filter((e) => {
      if (!e || typeof e !== 'object') return false;
      const cRaw = String(e.comp || e.c || '').toLowerCase();
      if (cRaw.startsWith('nat:')) return false;
      if (typeof e.h === 'string' && typeof e.a === 'string') {
        return e.h === userId || e.a === userId;
      }
      if (typeof e.home === 'string' && typeof e.away === 'string') {
        return e.home === userId || e.away === userId;
      }
      return true;
    });
    const seasonStart = save.seasonStartDate || null;
    const recentMatches = [];
    const homeCrowdLog = [];

    for (const entry of clubMlog.slice(-40)) {
      if (!entry || typeof entry !== 'object') continue;
      const attV = U.safeInt(('at' in entry) ? entry.at : entry.attendance, 0);
      const revV = U.safeNum(('rv' in entry) ? entry.rv : entry.revenue, 0);

      let isHm;
      if ('userHome' in entry) isHm = Boolean(entry.userHome);
      else if ('isHome' in entry) isHm = Boolean(entry.isHome);
      else if (typeof entry.home === 'boolean') isHm = entry.home;
      else if (typeof entry.h === 'boolean') isHm = entry.h;
      else if (typeof entry.h === 'string' && typeof entry.a === 'string') isHm = (entry.h === userId);
      else if ('hm' in entry) isHm = Boolean(entry.hm);
      else if ('casa' in entry) isHm = Boolean(entry.casa);
      else isHm = revV > 0;

      let rawOpp = entry.opp || entry.opponent || entry.oppName || entry.o || entry.oppId || entry.oid || entry.adv || entry.vs || entry.t || '';
      if (!rawOpp && typeof entry.h === 'string' && typeof entry.a === 'string') {
        rawOpp = isHm ? (entry.an || entry.a) : (entry.hn || entry.h);
      }
      if (!rawOpp && typeof entry.home === 'string' && typeof entry.away === 'string') {
        rawOpp = entry.home === userId ? entry.away : entry.home;
      }
      let oppStr = String(rawOpp || '').trim();
      if (oppStr) {
        const cm = U.getStaticClub(clubsMeta, oppStr);
        if (cm.name) oppStr = cm.name;
        else if (compactTeams[oppStr] && compactTeams[oppStr].name) oppStr = compactTeams[oppStr].name;
      }

      let gfV = null, gaV = null;
      for (const [kf, ka] of [['gf', 'ga'], ['us', 'them'], ['gp', 'gc'], ['s1', 's2']]) {
        if (kf in entry && ka in entry) {
          gfV = U.safeInt(entry[kf], 0);
          gaV = U.safeInt(entry[ka], 0);
          break;
        }
      }
      if (gfV === null && 'hg' in entry && 'ag' in entry) {
        const hg = U.safeInt(entry.hg, 0), ag = U.safeInt(entry.ag, 0);
        gfV = isHm ? hg : ag;
        gaV = isHm ? ag : hg;
      }
      if (gfV === null) {
        const scRaw = entry.score || entry.res || entry.placar;
        if (typeof scRaw === 'string' && scRaw.includes('-')) {
          const ps = scRaw.split('-', 2);
          gfV = U.safeInt(ps[0], 0);
          gaV = U.safeInt(ps[1], 0);
        } else if (Array.isArray(scRaw) && scRaw.length >= 2) {
          gfV = U.safeInt(scRaw[0], 0);
          gaV = U.safeInt(scRaw[1], 0);
        }
      }

      const compRaw = String(entry.comp || entry.c || '');
      const compTail = compRaw.split(':').pop();
      const rawDKey = ('date' in entry) ? entry.date : entry.d;
      const dayI = (rawDKey !== undefined && rawDKey !== null && /^\d+(\.\d+)?$/.test(String(rawDKey).trim()))
        ? U.safeInt(rawDKey, -999)
        : -999;

      if (!oppStr && dayI !== -999) {
        let hit = null;
        for (const dd of [0, -1, 1, -2, 2]) {
          for (const ck of [compRaw, compTail, '*']) {
            const cand = playedByCompDay.get(`${ck}|${dayI + dd}`);
            if (cand && (gfV === null || (cand[2] === gfV && cand[3] === gaV))) {
              hit = cand;
              break;
            }
          }
          if (hit) break;
        }
        if (!hit && gfV !== null) {
          for (const [c1, c2, dv, onm, uhm, ugf, uga] of playedUserList) {
            if ((compRaw === c1 || compRaw === c2 || compTail === c1 || compTail === c2) && uhm === isHm && ugf === gfV && uga === gaV) {
              if (dv === -999 || Math.abs(dv - dayI) <= 7) {
                hit = [onm, uhm, ugf, uga];
                break;
              }
            }
          }
        }
        if (hit) {
          oppStr = hit[0];
          if (gfV === null) { gfV = hit[2]; gaV = hit[3]; }
        }
      }

      const recM = {
        date: U.formatMatchDay(rawDKey, seasonStart, currentDate, entry.y ?? null),
        comp: U.translateCompName(entry.cn || compRaw, compRaw),
        opp: oppStr || (isHm ? 'Laga Kandang' : 'Laga Tandang'),
        home: isHm,
        gf: gfV,
        ga: gaV,
        att: attV,
        rev: revV,
      };
      recentMatches.push(recM);
      if (attV > 0 && revV > 0) homeCrowdLog.push(recM);
    }

    const preContracts = [];
    for (const pc of (save.preContracts || [])) {
      if (pc && typeof pc === 'object') {
        preContracts.push({
          playerName: pc.playerName || pc.name || pc.playerId || '-',
          fromTeam: pc.fromTeamName || (pc.fromTeamId ? (U.getStaticClub(clubsMeta, pc.fromTeamId).name || (compactTeams[pc.fromTeamId] && compactTeams[pc.fromTeamId].name) || pc.fromTeamId) : '-'),
          arriveDate: String(pc.arriveDate || pc.endDate || '').slice(0, 10),
          salary: U.safeNum(pc.salary, 0),
        });
      }
    }

    prog(58, 'Membedah jadwal 5 lawan terdekat (War Room H2H)...');
    const simOpponents = (typeof S.extractSimOpponents === 'function')
      ? S.extractSimOpponents(save, userId, clubsMeta, compactTeams, staticPlayers)
      : [];
    const upcomingMatches = S.extractUpcomingMatches(
      save, userId, clubsMeta, compactTeams, staticPlayers,
      bestXi, sections, fanConf, userDiv, reputation, userRoster,
      activeFormation, foreignCap, userCountry, ticketMul, rawTmb, sdb,
      rawActiveFormation
    );

    prog(75, 'Memindai Global Auto-Scout Moneyball (1.185+ klub AI)...');
    const { scoutPool, youthScoutTargets, aiUnhappyTotal, aiBosmanTotal } = S.buildGlobalScoutPool(
      save, staticPlayers, clubsMeta, userId, userCountry, holePositions, bestXi.avgScore
    );

    prog(88, 'Menyusun mutasi keuangan, kontrak pinjaman & status timnas...');

    const fineSlumpPlayers = userRoster
      .filter(p => (p.fineSlump || 0) > 0)
      .map(p => ({ id: p.id, name: p.name, pos: p.pos, slumpPct: p.fineSlumpPct, days: p.fineSlumpDays }));

    // #21866: cashHistory memakai format { d: "YYYY-MM-DD", v: number }
    const cashHist = [];
    if (Array.isArray(uTeam.cashHistory)) {
      uTeam.cashHistory.slice(-24).forEach((pt, idx) => {
        if (pt && typeof pt === 'object') {
          cashHist.push({
            label: String(pt.date || pt.d || pt.m || `M${idx + 1}`).slice(0, 10),
            val: U.safeNum(('budget' in pt) ? pt.budget : pt.v, 0),
          });
        } else if (typeof pt === 'number') {
          cashHist.push({ label: `T${idx + 1}`, val: pt });
        }
      });
    }

    // #21866: statement memakai format tuple [isoDate, category, positiveAmount, ...meta]
    const stmt35 = [];
    if (Array.isArray(uTeam.statement)) {
      for (const row of uTeam.statement.slice(-35).reverse()) {
        const parsed = U.parseStatementRow(row);
        if (parsed) {
          stmt35.push({
            date: parsed.date,
            category: parsed.category,
            label: parsed.label,
            amount: parsed.amount,
            isExpense: parsed.isExpense,
          });
        }
      }
    }

    let spContracts = [];
    if (uTeam.sponsors && typeof uTeam.sponsors === 'object') {
      const rc = uTeam.sponsors.contracts;
      if (Array.isArray(rc)) spContracts = rc.filter(c => c && typeof c === 'object');
      else if (rc && typeof rc === 'object') spContracts = Object.values(rc).filter(c => c && typeof c === 'object');
    }

    const fixedSponsor = (uTeam.fixedSponsor && typeof uTeam.fixedSponsor === 'object')
      ? {
          ...uTeam.fixedSponsor,
          monthlyParcel: U.fixedSponsorParcel(uTeam.fixedSponsor),
        }
      : null;

    const idolsList = Array.isArray(uTeam.idols) ? uTeam.idols : [];
    const loanBuyWatch = userRoster
      .filter(p => p.loanedFrom || p.loanBuyFee > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        age: p.age,
        force: p.force,
        potCap: p.potCap,
        marketValue: p.marketValue,
        loanedFrom: p.loanedFrom,
        loanDays: p.loanDays,
        loanBuyFee: p.loanBuyFee,
        loanBuyChance: p.loanBuyChance,
      }));

    const natId = save.userNationId || save.nationalTeamId || save.nationId || '';
    const natIso = natId ? String(natId).toUpperCase() : '';
    let nationInfo = null;
    if (natIso) {
      const rawLineup = Array.isArray(save.nationalTeamLineup) ? save.nationalTeamLineup : [];
      const clubNameById = {};
      const dynById = {};
      rawLineup.forEach(rp => {
        if (rp && rp.id) {
          dynById[rp.id] = rp;
          clubNameById[rp.id] = rp.clubName || '';
        }
      });
      const parsedLineup = rawLineup.length
        ? R.extractTeamRoster({ playerDynamic: dynById }, staticPlayers, false, natIso, natIso, natIso).roster
            .map(p => ({ ...p, clubName: clubNameById[p.id] || p.teamName || '-' }))
        : [];
      const natMatches = [];
      const wComps = (save.world && save.world.comps && typeof save.world.comps === 'object') ? save.world.comps : {};
      for (const [cid, comp] of Object.entries(wComps)) {
        if (!comp || typeof comp !== 'object' || comp.finished) continue;
        if (!String(cid).startsWith('nat:') && comp.kind !== 'nations') continue;
        const cname = U.translateCompName(comp.name || cid, cid);
        for (const st of (comp.stages || [])) {
          if (!st || st.done) continue;
          for (const rnd of (st.rounds || [])) {
            if (!rnd || typeof rnd !== 'object') continue;
            const day = U.safeInt((rnd.day !== undefined && rnd.day !== null) ? rnd.day : rnd.d, 0);
            const rName = U.translateRoundName(rnd.name || st.name || '');
            for (const fx of (rnd.matches || [])) {
              if (!fx || fx.played || (fx.homeGoals !== undefined && fx.homeGoals !== null)) continue;
              const h = String(fx.home || fx.homeId || fx.h || '').toUpperCase();
              const a = String(fx.away || fx.awayId || fx.a || '').toUpperCase();
              if (h === natIso || a === natIso) {
                natMatches.push({
                  compId: cid,
                  compName: cname,
                  roundName: rName,
                  day,
                  home: h,
                  away: a,
                  isHome: h === natIso,
                  oppIso: h === natIso ? a : h,
                  neutral: Boolean(fx.neutral),
                });
              }
            }
          }
        }
      }
      natMatches.sort((a, b) => a.day - b.day);

      // Mini War Room Timnas: 1-pass pool index dari userRoster + scoutPool (terisolasi penuh dari War Room Klub)
      const natMap = new Map();
      for (const p of parsedLineup) {
        if (p && p.id) natMap.set(p.id, p);
      }
      const needIsos = new Set([natIso, ...natMatches.slice(0, 3).map(m => m.oppIso)]);
      const byIsoMap = new Map();
      const pushIsoPlayer = (isoKey, pObj) => {
        if (!isoKey || !needIsos.has(isoKey)) return;
        let mIso = byIsoMap.get(isoKey);
        if (!mIso) { mIso = new Map(); byIsoMap.set(isoKey, mIso); }
        if (!mIso.has(pObj.id)) mIso.set(pObj.id, pObj);
      };
      for (const p of parsedLineup) pushIsoPlayer(natIso, p);
      for (const p of userRoster) {
        const pi = String(p.nationality || '').toUpperCase();
        if (needIsos.has(pi)) pushIsoPlayer(pi, p);
      }
      for (const r of scoutPool) {
        const pi = String(r[4] || '').toUpperCase();
        if (!needIsos.has(pi)) continue;
        const pos = r[1] || 'MC';
        pushIsoPlayer(pi, {
          id: r[19],
          name: r[0],
          pos,
          age: r[2] || 22,
          foot: r[3] || 'D',
          nationality: pi,
          force: r[5] || 20,
          effForce: r[5] || 20,
          s1: r[8] || '',
          s2: r[9] || '',
          stackPct: r[10] || 0,
          nonStack: Boolean(r[11]),
          energy: 100,
          injured: false,
        });
      }
      const natBestPool = Array.from((byIsoMap.get(natIso) || new Map()).values());
      const natForms = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '4-1-2-1-2']
        .filter(f => (f in C.FORMATIONS) && !(C.FORMATION_BUGS && (f in C.FORMATION_BUGS)));
      let uNatBestXi = null;
      if (natBestPool.length >= 11) {
        for (const fk of natForms) {
          const rXi = T.solveBestXi(natBestPool, fk, 99, '');
          if (!uNatBestXi || rXi.avgScore > uNatBestXi.avgScore) uNatBestXi = { ...rXi, formation: fk };
        }
      }
      const oppForms = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'].filter(f => f in C.FORMATIONS);
      const matchPreviews = [];
      for (const m of natMatches.slice(0, 3)) {
        const oppPool = Array.from((byIsoMap.get(m.oppIso) || new Map()).values());
        if (!uNatBestXi || oppPool.length < 11) {
          matchPreviews.push(null);
          continue;
        }
        let oppXi = null;
        for (const fk of oppForms) {
          const rXi = T.solveBestXi(oppPool, fk, 99, '');
          if (!oppXi || rXi.avgScore > oppXi.avgScore) oppXi = { ...rXi, formation: fk };
        }
        const Cond = LF.conditions || null;
        let natAutoCond = null;
        if (Cond && typeof Cond.matchConditions === 'function') {
          const wYear = save.world && save.world.year ? save.world.year : Number(currentDate.slice(0, 4));
          const mDate = Number.isFinite(Number(m.day)) ? (Cond.dayToIsoDate(wYear, Number(m.day)) || currentDate) : currentDate;
          const mComp = wComps[m.compId] || { kind: 'nations' };
          try {
            natAutoCond = Cond.matchConditions(
              m.home, m.away, m.home, m.away, mDate, Cond.varOfComp(mComp),
              { world: save.world, allTeams: compactTeams, neutral: Boolean(m.neutral), comp: mComp, staticDb: sdb, clubsMeta }
            );
          } catch (_) {
            natAutoCond = null;
          }
        }
        const natCondF = (typeof T.resolveMatchCondFactors === 'function')
          ? T.resolveMatchCondFactors(natAutoCond, m.isHome, Boolean(m.neutral))
          : { altHit: 0, missMul: 1.0, userEnergyMul: 1.0, oppEnergyMul: 1.0, userCardMul: 1.0, oppCardMul: 1.0 };
        const oPow = T.computeEngineSectorPower(oppXi, oppXi.formation, {
          isHome: !m.isHome, neutral: Boolean(m.neutral), style: 'Balanced',
          altHit: natCondF.altHit, energyMul: natCondF.oppEnergyMul, cardMul: natCondF.oppCardMul,
        });
        let bestCombo = null;
        for (const stTry of ['Balanced', 'Offensive', 'Counter', 'Defensive']) {
          const uPow = T.computeEngineSectorPower(uNatBestXi, uNatBestXi.formation, {
            isHome: m.isHome, neutral: Boolean(m.neutral), style: stTry,
            altHit: natCondF.altHit, energyMul: natCondF.userEnergyMul, cardMul: natCondF.userCardMul,
          });
          for (const fcTry of ['Center', 'Wings']) {
            const sim = T.simulateMatchExpectation(uPow, oPow, {
              isHome: m.isHome, neutral: Boolean(m.neutral), style: stTry, focus: fcTry,
              oppStyle: 'Balanced', oppFocus: 'Center', missMul: natCondF.missMul,
            });
            if (!bestCombo || sim.xPts > bestCombo.sim.xPts) {
              bestCombo = { stTry, fcTry, uPow, sim };
            }
          }
        }
        const oppStars = oppPool.slice().sort((a, b) => (b.force || 0) - (a.force || 0)).slice(0, 3)
          .map(p => ({ name: p.name, pos: p.pos, force: p.force }));
        const oppPoolSlim = oppPool
          .slice()
          .sort((a, b) => (b.force || 0) - (a.force || 0))
          .slice(0, 18)
          .map(p => ({
            id: p.id, name: p.name, pos: p.pos, force: p.force || 20, effForce: p.effForce || p.force || 20,
            age: p.age || 24, foot: p.foot || 'D', s1: p.s1 || '', s2: p.s2 || '',
            stackPct: p.stackPct || 0, nonStack: Boolean(p.nonStack), energy: p.energy ?? 100,
          }));
        matchPreviews.push({
          ...m,
          autoCond: natAutoCond,
          uAvg: uNatBestXi.avgScore,
          oAvg: oppXi.avgScore,
          uForm: uNatBestXi.formation,
          oForm: oppXi.formation,
          uPow: bestCombo.uPow,
          oPow,
          winPct: bestCombo.sim.winPct,
          drawPct: bestCombo.sim.drawPct,
          lossPct: bestCombo.sim.lossPct,
          recStyle: bestCombo.stTry,
          recFocus: bestCombo.fcTry,
          oppStars,
          oppPoolSlim,
        });
      }

      const natOrdersRaw = (save.matchOrders && !Array.isArray(save.matchOrders) && Array.isArray(save.matchOrders[natIso]))
        ? save.matchOrders[natIso]
        : [];
      const natXiIds = new Set(uNatBestXi && Array.isArray(uNatBestXi.xi) ? uNatBestXi.xi.map(a => a.player.id) : []);
      const natOrdersAudit = auditMatchOrdersList(natOrdersRaw, natMap, natXiIds);

      // Call-Up Optimizer (#25 dipanggil vs seluruh pool paspor di userRoster + scoutPool)
      const calledIdsSet = new Set(parsedLineup.map(p => p.id));
      const rosterIdsSet = new Set(userRoster.map(p => p.id));
      const scoutById = new Map(scoutPool.map(r => [r[19], r]));
      const rosterMapById = new Map(userRoster.map(p => [p.id, p]));
      const natPoolFullMap = new Map();
      const clubMetaByNat = p => p.clubName || '-';

      for (const p of parsedLineup) {
        const rp = rosterMapById.get(p.id);
        const sr = scoutById.get(p.id);
        const src = rp ? 'roster' : (sr ? 'scout' : '');
        const resolved = rp || p;
        natPoolFullMap.set(p.id, {
          id: resolved.id,
          name: resolved.name,
          pos: resolved.pos,
          age: resolved.age,
          foot: resolved.foot,
          nationality: natIso,
          force: resolved.force,
          effForce: resolved.effForce || resolved.force,
          potCap: resolved.potCap || resolved.force,
          s1: resolved.s1 || '',
          s2: resolved.s2 || '',
          stackPct: resolved.stackPct || 0,
          nonStack: Boolean(resolved.nonStack),
          energy: resolved.energy ?? 100,
          injured: Boolean(resolved.injured),
          injuryDays: resolved.injuryDays || 0,
          suspended: Boolean(resolved.suspended),
          clubName: rp ? userName : clubMetaByNat(p),
          called: true,
          src,
        });
      }
      for (const p of userRoster) {
        if (String(p.nationality || '').toUpperCase() !== natIso || natPoolFullMap.has(p.id)) continue;
        natPoolFullMap.set(p.id, {
          id: p.id, name: p.name, pos: p.pos, age: p.age, foot: p.foot, nationality: natIso,
          force: p.force, effForce: p.effForce, potCap: p.potCap,
          s1: p.s1 || '', s2: p.s2 || '', stackPct: p.stackPct || 0, nonStack: Boolean(p.nonStack),
          energy: p.energy ?? 100, injured: Boolean(p.injured), injuryDays: p.injuryDays || 0,
          suspended: Boolean(p.suspended), clubName: userName, called: false, src: 'roster',
        });
      }
      for (const r of scoutPool) {
        if (String(r[4] || '').toUpperCase() !== natIso || natPoolFullMap.has(r[19])) continue;
        natPoolFullMap.set(r[19], {
          id: r[19], name: r[0], pos: r[1] || 'MC', age: r[2] || 22, foot: r[3] || 'D', nationality: natIso,
          force: r[5] || 20, effForce: r[5] || 20, potCap: r[7] || r[5] || 20,
          s1: r[8] || '', s2: r[9] || '', stackPct: r[10] || 0, nonStack: Boolean(r[11]),
          energy: 100, injured: false, injuryDays: 0, suspended: false,
          clubName: r[16] || '-', called: false, src: 'scout',
        });
      }
      const allNatVals = Array.from(natPoolFullMap.values());
      const calledNatVals = allNatVals.filter(p => p.called);
      const uncalledNatVals = allNatVals.filter(p => !p.called)
        .sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce))
        .slice(0, 25);
      const natPoolSorted = calledNatVals.concat(uncalledNatVals)
        .sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));

      const roleFamilyOfNat = pos => {
        if (pos === 'G') return 'GK';
        if (['ZD', 'ZE', 'Z', 'ZAG'].includes(pos)) return 'CB';
        if (['LD', 'LE', 'LAT'].includes(pos)) return 'FB';
        if (['VOL', 'V'].includes(pos)) return 'DM';
        if (['PD', 'PE'].includes(pos)) return 'WING';
        if (['SA', 'ATA', 'A'].includes(pos)) return 'ST';
        return 'MID';
      };
      const validNatForms = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '4-1-2-1-2', '3-4-2-1']
        .filter(f => (f in C.FORMATIONS) && !(C.FORMATION_BUGS && (f in C.FORMATION_BUGS)));
      const solveNatBest = pool => {
        let bestN = null;
        if (pool.length < 11) return null;
        for (const fk of validNatForms) {
          const rXi = T.solveBestXi(pool, fk, 99, '');
          if (!bestN || rXi.avgScore > bestN.avgScore) bestN = { ...rXi, formation: fk };
        }
        return bestN;
      };

      const calledList = Array.from(natPoolFullMap.values()).filter(p => p.called);
      const healthyCalled = calledList.filter(p => !p.injured && !p.suspended);
      const curBestNat = solveNatBest(healthyCalled.length >= 11 ? healthyCalled : calledList);
      const curBestIds = new Set(curBestNat && Array.isArray(curBestNat.xi) ? curBestNat.xi.map(a => a.player.id) : []);
      const uncalledAvail = Array.from(natPoolFullMap.values())
        .filter(p => !p.called && !p.injured && !p.suspended)
        .sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));

      const usedInIds = new Set();
      const usedOutIds = new Set();
      const swaps = [];

      // 1) Prioritaskan mengganti pemain dipanggil yang cedera atau skorsing
      for (const cp of calledList.filter(x => x.injured || x.suspended)) {
        const fam = roleFamilyOfNat(cp.pos);
        const rep = uncalledAvail.find(u => !usedInIds.has(u.id) && roleFamilyOfNat(u.pos) === fam)
          || uncalledAvail.find(u => !usedInIds.has(u.id) && u.pos !== 'G');
        if (rep) {
          usedInIds.add(rep.id);
          usedOutIds.add(cp.id);
          swaps.push({
            out: cp,
            in: rep,
            sector: fam,
            forceGain: rep.force - cp.force,
            reason: cp.injured ? `Cedera ${cp.injuryDays}d` : 'Skorsing',
          });
        }
      }

      // 2) Kumpulkan pasangan upgrade per famili posisi (hindari menggusur starter Best XI dengan posisi berbeda!)
      const swapCandidates = [];
      for (const up of uncalledAvail) {
        if (usedInIds.has(up.id)) continue;
        const uFam = roleFamilyOfNat(up.pos);
        const outPool = calledList.filter(cp =>
          !usedOutIds.has(cp.id)
          && roleFamilyOfNat(cp.pos) === uFam
          && up.force >= cp.force + 2
        ).sort((a, b) => ((curBestIds.has(a.id) ? 1 : 0) - (curBestIds.has(b.id) ? 1 : 0)) || (a.force - b.force));
        for (const cp of outPool.slice(0, 2)) {
          swapCandidates.push({
            out: cp,
            in: up,
            sector: uFam,
            forceGain: up.force - cp.force,
            reason: `+${up.force - cp.force} Force (${uFam})`,
            priorityScore: (up.force - cp.force) + (cp.pos === up.pos ? 1.5 : 0) + (curBestIds.has(cp.id) ? -1.5 : 3.0),
          });
        }
      }
      swapCandidates.sort((a, b) => b.priorityScore - a.priorityScore || b.forceGain - a.forceGain);

      let workingPool = [...(healthyCalled.length >= 11 ? healthyCalled : calledList)];
      let workingAvg = curBestNat ? curBestNat.avgScore : 0;
      for (const cand of swapCandidates) {
        if (swaps.length >= 8) break;
        if (usedInIds.has(cand.in.id) || usedOutIds.has(cand.out.id)) continue;
        // Uji agar swap tidak menurunkan kekuatan Best XI Timnas
        const trialPool = workingPool.filter(p => p.id !== cand.out.id).concat([cand.in]);
        const trialBest = solveNatBest(trialPool);
        const trialAvg = trialBest ? trialBest.avgScore : workingAvg;
        if (trialAvg + 0.01 < workingAvg) continue;
        usedInIds.add(cand.in.id);
        usedOutIds.add(cand.out.id);
        workingPool = trialPool;
        workingAvg = trialAvg;
        swaps.push({
          out: cand.out,
          in: cand.in,
          sector: cand.sector,
          forceGain: cand.forceGain,
          reason: cand.reason,
        });
      }

      const optBestNat = solveNatBest(workingPool);
      const curFormRaw = String((save.nationalTeamTactics && save.nationalTeamTactics.formation) || '');
      const hasBug343 = curFormRaw.split('~')[0].trim() === '3-4-3';

      const callupAudit = {
        currentXiAvg: curBestNat ? curBestNat.avgScore : 0,
        optimalXiAvg: optBestNat ? optBestNat.avgScore : (curBestNat ? curBestNat.avgScore : 0),
        xiAvgGain: (curBestNat && optBestNat) ? U.roundTo(Math.max(0, optBestNat.avgScore - curBestNat.avgScore), 2) : 0,
        curForm: curBestNat ? curBestNat.formation : '-',
        optForm: optBestNat ? optBestNat.formation : (curBestNat ? curBestNat.formation : '-'),
        swaps,
        injuredCalled: calledList.filter(p => p.injured || p.suspended).length,
        hasBug343,
        curFormRaw,
        poolCount: natPoolFullMap.size,
      };

      nationInfo = {
        iso: natIso,
        squadCount: rawLineup.length,
        tactics: save.nationalTeamTactics || {},
        lineup: parsedLineup,
        natPool: natPoolSorted,
        callupAudit,
        upcomingMatches: natMatches.slice(0, 6),
        matchPreviews: matchPreviews.filter(Boolean),
        matchOrdersAudit: natOrdersAudit,
      };
    }

    // Audit Match Orders (OTA 01a20a9f)
    const rawOrders = Array.isArray(save.matchOrders)
      ? save.matchOrders
      : (save.matchOrders && Array.isArray(save.matchOrders[userId])
          ? save.matchOrders[userId]
          : (Array.isArray(uTeam.matchOrders) ? uTeam.matchOrders : []));
    const rosterById = new Map(userRoster.map(p => [p.id, p]));
    const bestXiIds = new Set((bestXi.xi || []).map(a => a.player.id));
    const matchOrdersAudit = auditMatchOrdersList(rawOrders, rosterById, bestXiIds);

    // Info & Routing Tim B (eqb / checkCreateB #24615 + save.userBTeams)
    const userBList = Array.isArray(save.userBTeams) ? save.userBTeams : [];
    const bTeamEntry = userBList.find(b => b && typeof b === 'object' && (b.main === userId || b.id === `userb-${userId}`)) || null;
    const bTeamId = (bTeamEntry && bTeamEntry.id)
      || uTeam.bTeamId
      || save.bTeamId
      || (compactTeams && compactTeams[`userb-${userId}`] ? `userb-${userId}` : null)
      || (compactTeams && compactTeams[`${userId}_b`] ? `${userId}_b` : null);
    const bTeamObj = (bTeamId && compactTeams && compactTeams[bTeamId]) ? compactTeams[bTeamId] : null;
    const hasBTeam = Boolean(bTeamEntry || bTeamObj || bTeamId);
    const bTeamName = (bTeamEntry && bTeamEntry.name) || (bTeamObj && bTeamObj.name) || (hasBTeam ? `${userName} B` : null);
    const bTeamLeague = (bTeamEntry && bTeamEntry.leagueId) || (bTeamObj && bTeamObj.league) || null;
    const bTeamSquadCount = bTeamObj
      ? (Array.isArray(bTeamObj.playerIds) && bTeamObj.playerIds.length
        ? bTeamObj.playerIds.length
        : (Array.isArray(bTeamObj.extraRows) ? bTeamObj.extraRows.length : 0))
      : 0;
    const bTeamCost = Math.min(2000000, Math.max(100000, Math.round(U.safeNum(userTeamLevel, 3) * 600000)));
    const excessForeign = Math.max(0, foreignCountSquad - foreignCap);
    const bTeamCandidates = userRoster
      .filter(p => !p.loanedFrom && !p.injured && p.age <= 22 && (p.potCap - p.force) >= 10 && (!bestXiIds.has(p.id) || p.force <= (bestXi.avgScore - 8)))
      .map(p => {
        const isF = Boolean(userCountry && p.nationality && p.nationality !== userCountry);
        return {
          id: p.id,
          name: p.name,
          pos: p.pos,
          age: p.age,
          nationality: p.nationality,
          isForeign: isF,
          force: p.force,
          potCap: p.potCap,
          gap: p.potCap - p.force,
          star: Boolean(p.star),
        };
      })
      .sort((a, b) => (excessForeign > 0 ? ((b.isForeign ? 1 : 0) - (a.isForeign ? 1 : 0)) : 0) || (b.gap - a.gap) || (a.force - b.force))
      .slice(0, 6);
    let bRosterExport = [];
    let bTeamBudget = 0;
    let bTeamRep = 0;
    let bTeamPayroll = 0;
    let bTeamAvgForce = 0;
    let bTeamAvgAge = 0;
    let bTeamForeignCount = 0;
    let bTeamReadyPromote = 0;
    let bTeamZeroMinLeak = 0;
    let bTeamZeroMinPayrollLeak = 0;
    let bTeamContractAlerts = 0;
    if (hasBTeam && bTeamObj) {
      const bDiv = U.estimateDivisionFromLeague(bTeamLeague || '', worldComps);
      const bCountry = String((bTeamObj && bTeamObj.country) || userCountry || '').toUpperCase();
      const bExt = R.extractTeamRoster(bTeamObj, staticPlayers, true, bTeamId, bTeamName || `${userName} B`, bCountry, bDiv);
      const rawBRoster = (bExt && Array.isArray(bExt.roster)) ? bExt.roster : [];
      const minForcePromotion = Math.max(25, Math.round(avgTop11Force - 6));
      bTeamBudget = Math.round(U.safeNum(bTeamObj.budget, 0));
      bTeamRep = Math.round(U.safeNum(bTeamObj.reputation, 0));
      bTeamPayroll = Math.round(rawBRoster.reduce((s, p) => s + (p.salary || 0), 0));
      bTeamAvgForce = rawBRoster.length
        ? U.roundTo(rawBRoster.reduce((s, p) => s + (p.force || 0), 0) / rawBRoster.length, 1)
        : 0;
      bTeamAvgAge = rawBRoster.length
        ? U.roundTo(rawBRoster.reduce((s, p) => s + (p.age || 0), 0) / rawBRoster.length, 1)
        : 0;
      bRosterExport = rawBRoster.map(p => {
        const isF = Boolean(userCountry && p.nationality && p.nationality !== userCountry);
        if (isF) bTeamForeignCount++;
        const gap = Math.max(0, (p.potCap || p.force) - (p.force || 0));
        const fillsHole = holePosSet.has(p.pos);
        const zeroMin = (p.gamesPlayed || 0) === 0 && !p.injured;
        const inGolden = p.contractDays >= C.RENEW_GOLDEN_MIN && p.contractDays <= C.RENEW_GOLDEN_MAX && !p.loanedFrom;
        const critContract = p.contractDays <= 30 && !p.loanedFrom;
        if (critContract || inGolden) bTeamContractAlerts++;
        if (zeroMin) {
          bTeamZeroMinLeak++;
          bTeamZeroMinPayrollLeak += (p.salary || 0);
        }
        let bAction = 'TAHAN & LATIH';
        let bCls = 'b-info';
        if (p.force >= minForcePromotion || (fillsHole && p.force >= minForcePromotion - 2 && (!isF || excessForeign <= 0))) {
          bAction = 'SIAP PROMOSI';
          bCls = 'b-good';
          bTeamReadyPromote++;
        } else if (zeroMin && (p.age >= 21 || gap <= 5 || p.salary >= 40000)) {
          bAction = '0 MENIT · GAJI BOCOR';
          bCls = 'b-crit';
        } else if (critContract) {
          bAction = 'KONTRAK KRITIS';
          bCls = 'b-warn';
        } else if (inGolden) {
          bAction = 'GOLDEN WINDOW';
          bCls = 'b-good';
        } else if (gap <= 1 && p.age >= 21) {
          bAction = 'MENTOK POTCAP';
          bCls = 'b-amber';
        }
        return {
          ...p,
          isForeign: isF,
          gap,
          fillsHole,
          zeroMin,
          bAction,
          bCls,
        };
      }).sort((a, b) => (b.force - a.force) || (b.gap - a.gap));
      bTeamZeroMinPayrollLeak = Math.round(bTeamZeroMinPayrollLeak);
    }

    const bTeamInfo = {
      hasBTeam,
      bTeamId: bTeamId || null,
      bTeamName,
      bTeamLeague,
      bTeamSquadCount,
      creationCost: bTeamCost,
      curForeign: foreignCountSquad,
      foreignCap,
      excessForeign,
      candidates: bTeamCandidates,
      budget: bTeamBudget,
      reputation: bTeamRep,
      totalPayroll: bTeamPayroll,
      avgForce: bTeamAvgForce,
      avgAge: bTeamAvgAge,
      foreignCount: bTeamForeignCount,
      readyPromoteCount: bTeamReadyPromote,
      zeroMinLeakCount: bTeamZeroMinLeak,
      zeroMinPayrollLeak: bTeamZeroMinPayrollLeak,
      contractAlertCount: bTeamContractAlerts,
      roster: bRosterExport,
    };

    const cashflowPayload = E.buildCashflowPayload(
      cashflowMeta, uTeam, curSim, spContracts, shopAudit, memberAudit,
      totalPayroll, stadiumOps, userDiv,
      { country: userCountry, repLvl: repLevel, youthPayroll }
    );
    const rawPresets = Array.isArray(save.ticketPresets) ? save.ticketPresets : [];
    const activePresetId = uTeam.ticketPresetId || save.ticketPresetId || null;
    const firstHomeFx = upcomingMatches.find(u => u.isHome) || null;
    const presetAudit = (typeof E.auditTicketPresets === 'function')
      ? E.auditTicketPresets(
          rawPresets, activePresetId, sections, fanConf, userDiv, repLevel, userCountry,
          optLiga, optBig, ticketMul, rawTmb, firstHomeFx
        )
      : null;
    const cashflowCalendar = (typeof E.buildCashflowCalendar12m === 'function')
      ? E.buildCashflowCalendar12m(
          currentDate, budget, cashflowPayload, spContracts, uTeam.naming, uTeam,
          userRoster, bRosterExport
        )
      : null;
    const matchTelemetry = buildMatchTelemetry(save, userId, userRoster, U.safeInt(save.season, 1));

    const alerts = buildPriorityAlerts(
      userRoster, youthRanked, moodsMap, unhappyCnt, lockerHit,
      uTeam.naming, uTeam.sponsors, ticketMul, shopAudit, memberAudit,
      holes, upcomingMatches, trainAudit, preContracts, userDiv,
      autoGuard, bestXi, optLiga.prices, activeFormation, bTeamInfo, presetAudit
    );

    const rawLastLineup = (save.lastLineup && typeof save.lastLineup === 'object') ? save.lastLineup : null;
    const lastStarterIds = (rawLastLineup && Array.isArray(rawLastLineup.playerIds))
      ? rawLastLineup.playerIds.slice(0, 11).filter(Boolean)
      : [];
    const resolvePlayerName = (pid) => {
      if (!pid) return null;
      const rp = rosterById.get(pid);
      return rp ? rp.name : String(pid);
    };
    const lastLineup = rawLastLineup ? {
      formationRaw: String(rawLastLineup.formation || rawActiveFormation || activeFormation),
      playStyle: String(rawLastLineup.playStyle || ''),
      marking: String(rawLastLineup.marking || ''),
      attackFocus: String(rawLastLineup.attackFocus || ''),
      falseNine: Boolean(rawLastLineup.falseNine || rawLastLineup.falseNineId),
      falseNineId: rawLastLineup.falseNineId || null,
      captainId: rawLastLineup.captain || null,
      captainName: resolvePlayerName(rawLastLineup.captain),
      penaltyId: rawLastLineup.penaltyTaker || null,
      penaltyName: resolvePlayerName(rawLastLineup.penaltyTaker),
      cornerId: rawLastLineup.cornerTaker || null,
      cornerName: resolvePlayerName(rawLastLineup.cornerTaker),
      freeKickId: rawLastLineup.freeKickTaker || null,
      freeKickName: resolvePlayerName(rawLastLineup.freeKickTaker),
      starterIds: lastStarterIds,
      starters: lastStarterIds.map(pid => {
        const rp = rosterById.get(pid);
        return rp ? {
          id: rp.id, name: rp.name, pos: rp.pos, force: rp.force,
          injured: Boolean(rp.injured), suspended: Boolean(rp.suspended), energy: rp.energy,
        } : { id: pid, name: pid, pos: '?', force: 0, injured: false, suspended: false, energy: 100 };
      }),
    } : null;

    const standingsRows = [];
    const rawStandings = Array.isArray(save.standings) ? save.standings.slice(0, 24) : [];
    rawStandings.forEach((row, idx) => {
      if (!row || typeof row !== 'object') return;
      const tid = row.teamId || row.id || '';
      const cm = U.getStaticClub(clubsMeta, tid);
      const tname = cm.name || row.name || tid;
      let gdVal = leagueGdCalc[tid] || 0;
      if ('gd' in row) gdVal = U.safeInt(row.gd, 0);
      else if ('goalDiff' in row) gdVal = U.safeInt(row.goalDiff, 0);
      else if ('goalDifference' in row) gdVal = U.safeInt(row.goalDifference, 0);
      else if ('sg' in row) gdVal = U.safeInt(row.sg, 0);
      else if ('saldo' in row) gdVal = U.safeInt(row.saldo, 0);
      else if ('goalsFor' in row && 'goalsAgainst' in row) gdVal = U.safeInt(row.goalsFor, 0) - U.safeInt(row.goalsAgainst, 0);
      else if ('golsPro' in row && 'golsContra' in row) gdVal = U.safeInt(row.golsPro, 0) - U.safeInt(row.golsContra, 0);
      else if ('gf' in row && 'ga' in row) gdVal = U.safeInt(row.gf, 0) - U.safeInt(row.ga, 0);
      else if ('gp' in row && 'gc' in row) gdVal = U.safeInt(row.gp, 0) - U.safeInt(row.gc, 0);
      else if ('for' in row && 'against' in row) gdVal = U.safeInt(row.for, 0) - U.safeInt(row.against, 0);

      standingsRows.push({
        pos: idx + 1,
        teamId: tid,
        name: tname,
        p: U.safeInt(row.played ?? row.games ?? row.j, 0),
        w: U.safeInt(row.wins ?? row.v, 0),
        d: U.safeInt(row.draws ?? row.e, 0),
        l: U.safeInt(row.losses ?? row.d, 0),
        gd: gdVal,
        pts: U.safeInt(row.points ?? row.pts, 0),
        isUser: tid === userId,
      });
    });

    prog(94, 'Menyusun Delta Tracker, Progresi Wonderkid & Snapshot...');
    const userStandRow = standingsRows.find(r => r.isUser) || null;
    const trainCurIdSet = new Set(trainAudit.currentIds || []);
    const snapPlayers = {};
    for (const p of userRoster) {
      snapPlayers[p.id] = {
        name: p.name,
        pos: p.pos,
        age: p.age,
        force: p.force,
        potCap: p.potCap,
        mv: p.marketValue,
        gf: p.growthFrac,
        inTrain: trainCurIdSet.has(p.id),
        mins: p.seasonMinutes || 0,
        mood: p.mood || 'ok',
      };
    }
    const snapBTeam = {};
    for (const bp of bRosterExport) {
      snapBTeam[bp.id] = {
        name: bp.name,
        pos: bp.pos,
        age: bp.age,
        force: bp.force,
        potCap: bp.potCap || bp.force,
        mv: bp.marketValue,
        gf: bp.growthFrac,
      };
    }
    const snapYouth = {};
    for (const yp of youthRanked) {
      snapYouth[yp.id] = {
        name: yp.name,
        pos: yp.pos,
        age: yp.age,
        force: yp.force,
        dev: yp.development,
        hash: yp.hash,
        estPotCap: yp.estPotCap || yp.potCap || yp.force,
      };
    }
    const snapNow = {
      budget: Math.round(budget),
      payroll: Math.round(totalPayroll),
      members: memberAudit.n,
      shopLastRev: Math.round(shopAudit.last_rev),
      seats: totalSeats,
      season: U.safeInt(save.season, 1),
      week: U.safeInt(save.week, 1),
      bestXiAvg: bestXi.avgScore,
      squadAvg: U.roundTo(avgTop11Force, 2),
      leaguePos: userStandRow ? userStandRow.pos : null,
      leaguePts: userStandRow ? userStandRow.pts : null,
      reputation: Math.round(reputation),
      ctLevel,
      unhappyCount: unhappyCnt,
      squadCount: userRoster.length,
      players: snapPlayers,
      bTeam: snapBTeam,
      youth: snapYouth,
    };
    const { deltas, updatedHistory, clubHistory } = computeDeltasAndHistory(historyStore, currentDate, userId, snapNow);
    const progression = buildProgressionPayload(clubHistory, currentDate, {
      userRoster,
      bRosterExport,
      youthRanked,
      trainAudit,
      clubLevel: userTeamLevel,
      userCountry,
      ctLevel,
    });

    function slimXi(xiObj) {
      return {
        ...xiObj,
        xi: xiObj.xi.map(a => ({
          slot: a.slot,
          ruleId: a.ruleId,
          sectorCode: a.sectorCode,
          wildcard: a.wildcard,
          droppedByBug: a.droppedByBug,
          score: U.roundTo(a.score, 1),
          wrongFoot: a.wrongFoot,
          id: a.player.id,
          name: a.player.name,
          pos: a.player.pos,
          force: a.player.force,
          effForce: a.player.effForce,
          age: a.player.age,
          foot: a.player.foot,
          nat: a.player.nationality,
          s1: a.player.s1,
          s2: a.player.s2,
          stackPct: a.player.stackPct,
          energy: a.player.energy,
          star: a.player.star,
          starAwarded: a.player.starAwarded,
          top: a.player.top,
          integration: a.player.integration,
          rhythm: a.player.rhythm,
          minsDeficit: a.player.minsDeficit || 0,
        })),
        bench: xiObj.bench.slice(0, 12).map(p => ({
          id: p.id,
          name: p.name,
          pos: p.pos,
          force: p.force,
          age: p.age,
          energy: p.energy,
          minPct: p.minPct || 0,
          reqPct: p.reqPct || 0,
          minsDeficit: p.minsDeficit || 0,
          gamesDeficit: p.gamesDeficit || 0,
          moodTier: p.moodTier || 0,
          s1: p.s1,
          s2: p.s2,
        })),
      };
    }

    const rosterExport = userRoster.map(p => {
      const cp = { ...p };
      delete cp.clubHistory;
      delete cp.moodFrom;
      return cp;
    });

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const parseSec = U.roundTo((t1 - t0) / 1000.0, 2);

    const now = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const generatedAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    const data = {
      cfg: C.getClientConfig(),
      meta: {
        version: 'v8.9.0 Web PWA (Engine v1.2.0 • Bytecode v9 Verified)',
        generatedAt,
        parseSec,
        userId,
        teamName: userName,
        managerName: save.managerName || 'Manager',
        country: userCountry,
        leagueId,
        division: userDiv,
        season: U.safeInt(save.season, 1),
        week: U.safeInt(save.week, 1),
        currentDate,
        todayNum: U.safeInt(save.world && save.world.today, -1),
        phase: U.translatePhaseName(save.phase),
        transferWindow: save.transferWindow,
        budget: Math.round(budget),
        reputation: Math.round(reputation),
        repLevel,
        userTeamLevel,
        buyerForceCeiling: buyerCeiling,
        boardConf: Math.round(boardConf),
        fanConf: Math.round(fanConf),
        ctLevel,
        ctCond,
        ctMaintOff,
        ctWork: uTeam.ctWork || null,
        youthCoach,
        bankLoan: Math.round(bankLoan),
        payroll: Math.round(totalPayroll),
        youthPayroll: Math.round(youthPayroll),
        payrollRef: Math.round(payrollRef),
        squadValue: Math.round(totalSquadVal),
        activeFormation,
        activeFormationRaw: rawActiveFormation,
        isCustomFormation: rawActiveFormation.includes('~'),
        foreignCap,
        foreignMax,
        foreignCountSquad,
        teamGames,
        unhappyCount: unhappyCnt,
        lockerHitPct: U.roundTo(lockerHit * 100, 1),
        xiHold: Boolean(uTeam.xiHold),
        aiUnhappyTotal,
        aiBosmanTotal,
        scoutPoolCount: scoutPool.length,
        hasStaticDb: Object.keys(staticPlayers).length > 0,
      },
      autoGuard,
      fineSlumpPlayers,
      cashflow: cashflowPayload,
      cashflowCalendar,
      matchTelemetry,
      deltas,
      progression,
      alerts,
      holes,
      holePositions,
      roster: rosterExport,
      youth: youthRanked,
      youthScoutTargets,
      loanBuyWatch,
      idols: idolsList,
      trainAudit,
      bestXi: slimXi(bestXi),
      rotXi: slimXi(rotXi),
      formCompare,
      formations: C.FORMATIONS,
      upcoming: upcomingMatches,
      simOpponents,
      liveCoach: C.LIVE_COACH_GUIDE,
      stadium: {
        sections,
        totalSeats,
        opsMonthly: stadiumOps,
        basePrices: C.TICKETS_BASE[userDiv] || C.TICKETS_BASE[1],
        curMul: ticketMul,
        ticketMulBy,
        phases: ticketPhases,
        phasesByKind: ticketPhasesByKind,
        curSim,
        optLigaPrices: optLiga.prices,
        optLigaSim: optLiga.sim,
        optBigPrices: optBig.prices,
        optBigSim: optBig.sim,
        presetAudit,
        lastGate: uTeam.lastGate || null,
        construction: uTeam.stadiumConstruction || null,
      },
      member: memberAudit,
      shop: shopAudit,
      naming: uTeam.naming || null,
      fixedSponsor,
      sponsors: spContracts,
      presGoals: cleanPresGoals(uTeam.presGoals, worldComps),
      preContracts,
      ctMilestones: C.CT_MILESTONES,
      cashHistory: cashHist,
      statement: stmt35,
      recentMatches: recentMatches.slice(-10).reverse(),
      homeCrowdLog: homeCrowdLog.slice(-10).reverse(),
      standings: standingsRows,
      scoutPool,
      nation: nationInfo,
      matchOrdersAudit,
      bTeamInfo,
      lastLineup,
    };

    prog(100, `Selesai! (${parseSec}s)`);
    return { data, updatedHistory };
  }

  LF.club = {
    auditAutoSettings,
    computeDeltasAndHistory,
    buildProgressionPayload,
    cleanPresGoals,
    buildPriorityAlerts,
    analyzeSave,
  };
})(typeof window !== 'undefined' ? window : globalThis);
