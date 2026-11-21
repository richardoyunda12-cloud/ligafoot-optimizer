/**
 * LigaFoot Optimizer Web Engine — club.js
 * Port eksak 1:1 dari optimizer/analyzer_club.py (v8.0 Final):
 * - Auto-Settings Guard (fineAuto, trainMode, autoBy, autoRenew, ctMaint, xiHold).
 * - Priority Alerts (16 kategori, termasuk Pareto VIP & Loophole 0%).
 * - Multi-format lookup `world.comps` untuk nama lawan `matchLog` & GD klasemen.
 * - Delta Tracker berbasis objek history (disimpan ke IndexedDB di browser).
 * - `analyzeSave(save, staticDb, historyStore, onProgress)` -> `{ data, updatedHistory }`.
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
    const fineAuto = Boolean(pickFlag(['fineAuto', 'autoFine'], false));
    const autoRenew = Boolean(pickFlag(['autoRenew', 'renewAuto'], false));
    let autoBy = String(pickFlag(['autoBy', 'autoLineupMode'], 'manual')).toLowerCase();
    if (pickFlag(['autoLineup'], false) === true && autoBy === 'manual') {
      autoBy = 'force';
    }
    const ctMaintOff = Boolean(pickFlag(['ctMaintOff'], false));
    const xiHoldRaw = uTeam.xiHold;
    const xiHoldCnt = (xiHoldRaw && typeof xiHoldRaw === 'object' && !Array.isArray(xiHoldRaw))
      ? Object.keys(xiHoldRaw).length
      : (xiHoldRaw ? 1 : 0);

    const hasTrapCore = userRoster.some(
      p => p.contractDays <= 10 && (p.force >= 40 || p.isGem || (p.squadRank || 99) <= 14) && !p.loanedFrom
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
          ? 'Aktif taktis ✓ — Siap menangkap Loophole 0% (+180d) untuk pemain inti <=10 hari (tandai noAutoRenew di cadangan!).'
          : (autoRenew
            ? 'MATIKAN saat normal! Auto-Renew bikin kamu kehilangan diskon -12% Golden Window (11–59 hari).'
            : (hasTrapCore
              ? 'OFF — Ada pemain inti <=10 hari! Pertimbangkan nyalakan sementara untuk Loophole 0% (+180d).'
              : 'OFF ✓ — Renew manual 3 tahun di 11–59 hari untuk potong gaji -12% gratis.')),
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

    const deltas = {
      prevDate,
      budgetDelta: 0,
      payrollDelta: 0,
      membersDelta: 0,
      playerChanges: [],
    };

    if (prevSnap) {
      deltas.budgetDelta = Math.round(snapshotData.budget - U.safeNum(prevSnap.budget, 0));
      deltas.payrollDelta = Math.round(snapshotData.payroll - U.safeNum(prevSnap.payroll, 0));
      deltas.membersDelta = U.safeInt(snapshotData.members, 0) - U.safeInt(prevSnap.members, 0);
      const prevPls = prevSnap.players || {};
      for (const [pid, curP] of Object.entries(snapshotData.players || {})) {
        if (pid in prevPls) {
          const pp = prevPls[pid];
          const df = curP.force - U.safeInt(pp.force, curP.force);
          const dmv = curP.mv - U.safeNum(pp.mv, curP.mv);
          const dgf = U.roundTo(curP.gf - U.safeNum(pp.gf, curP.gf), 3);
          if (df !== 0 || Math.abs(dmv) >= 50000) {
            deltas.playerChanges.push({ name: curP.name, forceDelta: df, mvDelta: Math.round(dmv), gfDelta: dgf });
          }
        }
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
    return { deltas, updatedHistory: hist };
  }

  function cleanPresGoals(rawPg) {
    if (!rawPg || typeof rawPg !== 'object' || Array.isArray(rawPg)) return rawPg || {};
    const pg = JSON.parse(JSON.stringify(rawPg));
    for (const k of ['league', 'cup', 'cont']) {
      if (pg[k] && typeof pg[k] === 'object') {
        const cid = String(pg[k].comp || '');
        pg[k].name = U.translateCompName(pg[k].name || cid, cid);
      }
    }
    if (pg.last && typeof pg.last === 'object') {
      for (const k of ['league', 'cup', 'cont']) {
        if (pg.last[k] && typeof pg.last[k] === 'object') {
          const cid = String(pg.last[k].comp || '');
          pg.last[k].name = U.translateCompName(pg.last[k].name || cid, cid);
        }
      }
    }
    return pg;
  }

  function buildPriorityAlerts(
    userRoster, youthRanked, moodsMap, unhappyCnt, lockerHit,
    namingObj, sponsorsObj, ticketMul, shopAudit, memberAudit,
    holes, upcomingMatches, trainAudit, preContracts, userDiv,
    autoGuard = null, bestXi = null, optLigaPrices = null
  ) {
    const alerts = [];
    const add = (sev, cat, title, action) => alerts.push({ sev, cat, title, action });

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
          'Matikan saat normal agar kamu bisa mengincar diskon gaji -12% di Golden Window (11–59 hari).');
      }
    }

    for (const p of userRoster) {
      if (p.injured && p.forSale) {
        add('CRITICAL', 'Transfer v9', `${p.name} sedang CEDERA tapi status For Sale!`,
          'Segera tarik dari daftar jual! Di v1.2.0, menjual pemain cedera kena potongan INJURED_SALE. Tunggu sembuh dulu.');
      }
    }

    const trapCore = userRoster.filter(
      p => p.contractDays <= 10 && (p.force >= 40 || p.isGem || (p.squadRank || 99) <= 14) && !p.loanedFrom
    );
    const trapCoreIds = new Set(trapCore.map(p => p.id));
    const trapOther = userRoster.filter(p => p.contractDays <= 10 && !trapCoreIds.has(p.id));
    if (trapCore.length) {
      const names = trapCore.slice(0, 4).map(p => `${p.name} (${p.contractDays}d)`).join(', ');
      add('CRITICAL', 'Loophole 0%', `${trapCore.length} pemain inti masuk Zona Jebakan <=10 hari!`,
        `${names}. Jangan renew manual (+20%–35%)! Nyalakan Auto-Renew sementara (tandai noAutoRenew di cadangan) agar diperpanjang 180d dengan gaji 0% naik!`);
    } else if (trapOther.length) {
      const names = trapOther.slice(0, 4).map(p => `${p.name} (${p.contractDays}d)`).join(', ');
      add('HIGH', 'Kontrak', `${trapOther.length} pemain cadangan kontrak <=10 hari.`,
        `Pemain: ${names}. Pastikan Auto-Renew OFF / noAutoRenew agar pergi gratis menghemat gaji.`);
    }

    if (namingObj && typeof namingObj === 'object' && U.safeInt(namingObj.monthsLeft, 99) <= 2) {
      const ml = U.safeInt(namingObj.monthsLeft, 0);
      add('CRITICAL', 'Naming Rights', `Naming Rights tinggal ${ml} bulan (${namingObj.name || '-'})!`,
        'Saat habis, WAJIB pilih kontrak 1 TAHUN (pengali 1.15x/thn, +30.7% lebih besar dari 5 tahun) di kapasitas stadion terbaru.');
    } else if (!namingObj) {
      add('CRITICAL', 'Naming Rights', 'Belum ada kontrak Naming Rights stadion aktif!',
        'Segera tanda tangani Naming Rights durasi 1 TAHUN (1.15x).');
    }

    if (unhappyCnt >= C.LOCKER_UNHAPPY_MIN) {
      add('CRITICAL', 'Ruang Ganti', `${unhappyCnt} pemain UNHAPPY — Penalti Tim -${Math.round(lockerHit * 100)}% AKTIF!`,
        "Atur pemain cadangan jadi squadRole = 'reserve' (100% kebal unhappy di v1.2.0) atau beri menit main di laga ringan.");
    }

    const slumped = userRoster.filter(p => (p.fineSlump || 0) > 0);
    if (slumped.length) {
      const sTxt = slumped.slice(0, 4).map(p => `${p.name} (-${Math.round(p.fineSlumpPct)}%, ${p.fineSlumpDays}d)`).join(', ');
      add('HIGH', 'Fine Slump', `${slumped.length} pemain sedang terkena penalti denda (fineSlump)!`,
        `${sTxt}. Performa mereka terpotong di lapangan sampai durasi habis. Ke depan gunakan denda maksimal 20% (0% risiko).`);
    }

    const goldC = userRoster.filter(p => p.contractDays >= C.RENEW_GOLDEN_MIN && p.contractDays <= C.RENEW_GOLDEN_MAX);
    if (goldC.length) {
      const names = goldC.slice(0, 5).map(p => `${p.name} (${p.contractDays}d)`).join(', ');
      add('HIGH', 'Kontrak -12%', `${goldC.length} pemain di GOLDEN WINDOW (11–59 hari)!`,
        `${names}. Perpanjang 3 Tahun (1095d) untuk potong gaji -12% GRATIS (+ gunakan trik bangku cadangan indeks >=11 jika perlu!).`);
    }

    const bpDiv = C.TICKETS_BASE[userDiv] || C.TICKETS_BASE[1];
    const curPLiga = {};
    for (const s of ['geral', 'arquibancada', 'cadeiras', 'camarotes']) {
      curPLiga[s] = Math.max(1, Math.round(bpDiv[s] * (ticketMul[s] ?? 1.0)));
    }
    const optP = optLigaPrices || {
      geral: Math.round(bpDiv.geral * 1.2),
      arquibancada: Math.round(bpDiv.arquibancada * 1.3),
      cadeiras: Math.round(bpDiv.cadeiras * 2.0),
      camarotes: Math.round(bpDiv.camarotes * 2.0),
    };
    const vipGaps = [];
    if (curPLiga.cadeiras < optP.cadeiras - 1) vipGaps.push(`Seats ${curPLiga.cadeiras}→${optP.cadeiras}`);
    if (curPLiga.camarotes < optP.camarotes - 2) vipGaps.push(`Boxes ${curPLiga.camarotes}→${optP.camarotes}`);
    if (vipGaps.length) {
      add('HIGH', 'Tiket VIP', `Harga VIP Liga Normal di bawah optimal Pareto (${vipGaps.join(', ')})!`,
        'Naikkan sektor VIP sesuai tabel Pareto Tab 5 untuk profit ekstra tanpa mengorbankan penonton.');
    }
    if (curPLiga.geral > optP.geral + 1) {
      add('HIGH', 'Tiket General', `Tiket General (${curPLiga.geral}) terlalu mahal (optimal ${optP.geral})!`,
        `Turunkan General ke ${optP.geral} agar pendapatan optimal dan total penonton tetap >70% (bonus +2% Tengah).`);
    }

    if (!shopAudit.is_optimal) {
      add('HIGH', 'Club Shop v9', `Harga Jersey Club Shop di ${shopAudit.cur_m.toFixed(2)}x (bukan puncak 1.00x)!`,
        `Sesuai rumus eksak priceFactor v1.2.0, titik puncak pendapatan jersey adalah tepat 1.00x (+${shopAudit.gain_pct.toFixed(2)}% potensi naik).`);
    }

    if (!memberAudit.is_optimal) {
      add('HIGH', 'Member Plan v9', `Setelan Member saat ini ${memberAudit.cur_m.toFixed(2)}x / diskon ${memberAudit.cur_d}%!`,
        `Ubah ke ${memberAudit.opt_m.toFixed(2)}x + Diskon Tahunan ${memberAudit.opt_d}% untuk puncak pendapatan (+${memberAudit.gain_pct.toFixed(2)}%, tidak pernah terpotong cap).`);
    }

    const footHoles = holes.filter(h => h.kind === 'FOOT_HOLE');
    if (footHoles.length) {
      add('HIGH', 'Lubang Fullback', `Lubang kaki dominan Fullback di: ${footHoles.map(h => h.pos).join(', ')}!`,
        'Penalti wrongFoot (-5%) aktif khusus di RB/LB. Cari pengganti di Akademi atau Auto-Scout.');
    }

    let sContracts = [];
    if (sponsorsObj && typeof sponsorsObj === 'object') {
      const rc = sponsorsObj.contracts;
      if (Array.isArray(rc)) sContracts = rc;
      else if (rc && typeof rc === 'object') sContracts = Object.values(rc);
    }
    if (sContracts.length < 3) {
      add('HIGH', 'Sponsor', `Baru ${sContracts.length}/3 slot Sponsor Jersey terisi!`,
        'Negosiasikan slot kosong dengan perusahaan Tier 3 (minta +8% s.d. +10% di percobaan 1, lalu terima counter di percobaan 2).');
    } else {
      const expSp = sContracts.filter(c => c && typeof c === 'object' && U.safeInt(c.monthsLeft, 99) <= 2);
      if (expSp.length) {
        add('MEDIUM', 'Sponsor', `${expSp.length} kontrak sponsor sisa <=2 bulan.`,
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
        `${ynames}. Pemain akademi berhenti tumbuh di usia 20 — promosikan untuk tambal skuad atau flip.`);
    }

    if (upcomingMatches.length && upcomingMatches[0].yellowRisks && upcomingMatches[0].yellowRisks.length) {
      const yr = upcomingMatches[0].yellowRisks.map(x => x.name).join(', ');
      add('MEDIUM', 'Kartu Kuning', `Waspada skorsing di laga vs ${upcomingMatches[0].oppName}: ${yr} (2 kuning)!`,
        'Pertimbangkan rotasi atau tarik keluar di menit 60 jika sudah unggul agar tidak absen di laga penting berikutnya.');
    }

    return alerts;
  }

  /**
   * Orkestrator utama (Pure JS, jalan 100% di browser HP / Node.js).
   * Mengembalikan `{ data, updatedHistory }` di mana `data` berformat 100% identik `D` v8.0.
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
    const reputation = U.safeNum(uTeam.reputation, 50);
    const repLevel = T.repToLevel(reputation);
    const boardConf = U.safeNum(uTeam.boardConfidence, 70);
    const fanConf = U.safeNum(uTeam.fanConfidence, 70);
    const ctLevel = Math.max(1, U.safeInt(uTeam.ctLevel, 1));
    const ctCond = U.safeInt(uTeam.ctCond, 100);
    const ctMaintOff = Boolean(uTeam.ctMaintOff);
    const youthCoach = U.safeInt(uTeam.youthCoach, 1);
    const bankLoan = U.safeNum(uTeam.bankLoan, 0);
    let activeFormation = uTeam.formation || (save.lastLineup && save.lastLineup.formation) || '4-3-3';
    if (!(activeFormation in C.FORMATIONS)) activeFormation = '4-3-3';
    const foreignCap = C.FOREIGN_FIELD_LIMITS[userCountry] || 7;

    prog(25, `Membedah skuad ${userName} & menghitung Best XI (15 formasi)...`);
    const { roster: userRoster, youth: userYouth } = R.extractTeamRoster(
      uTeam, staticPlayers, true, userId, userName, userCountry, userDiv
    );

    const totalPayroll = userRoster.reduce((s, p) => s + p.salary, 0);
    const totalSquadVal = userRoster.reduce((s, p) => s + p.marketValue, 0);
    const payrollRef = U.estimatePayrollRef(userDiv, totalPayroll);

    const { moods: moodsMap, unhappyCount: unhappyCnt, lockerHit } = T.computeSquadMoodsV9(userRoster, false);
    for (const p of userRoster) {
      const mi = moodsMap[p.id] || {};
      p.mood = mi.mood || 'ok';
      p.moodTier = mi.tier || 0;
      p.minPct = mi.minPct || 0.0;
      p.reqPct = mi.reqPct || 0.0;
      p.moodImmune = Boolean(mi.immune);
      p.moodReason = mi.reason || '';
    }

    const sortedByForce = [...userRoster].sort((a, b) => (b.force - a.force) || (b.effForce - a.effForce));
    const rankOf = {};
    sortedByForce.forEach((p, idx) => { rankOf[p.id] = idx; });
    const top5Ids = new Set(sortedByForce.slice(0, 5).map(p => p.id));

    for (const p of userRoster) {
      const rIdx = rankOf[p.id];
      p.squadRank = rIdx + 1;
      p.isTop5Arab = top5Ids.has(p.id) && p.age >= 26;
      p.benchCutSave = (rIdx < 11 && p.contractDays <= 120) ? Math.round(p.salary * 0.12) : 0;
      p.autoRenewLoophole = Boolean(
        p.contractDays <= 10 && (p.force >= 40 || p.isGem || rIdx < 14) && !p.loanedFrom
      );
      const actObj = R.classifyUserAction(p, rIdx, p.isTop5Arab, moodsMap);
      p.action = actObj.action;
      p.actionCls = actObj.cls;
    }

    const bestXi = T.solveBestXi(userRoster, activeFormation, foreignCap, userCountry, null, false, repLevel);
    const rotXi = T.solveBestXi(userRoster, activeFormation, foreignCap, userCountry, null, true, repLevel);
    const formCompare = [];
    for (const fk of Object.keys(C.FORMATIONS)) {
      const res = T.solveBestXi(userRoster, fk, foreignCap, userCountry, null, false, repLevel);
      const mods = C.FORMATION_MODS[fk] || { atkMod: 0, defMod: 0 };
      formCompare.push({
        formation: fk,
        avgScore: res.avgScore,
        totalScore: res.totalScore,
        sectors: res.sectors,
        foreignCount: res.foreignCount,
        wrongFootCount: res.wrongFootCount,
        atkMod: mods.atkMod,
        defMod: mods.defMod,
        falseNine: res.falseNine,
      });
    }
    formCompare.sort((a, b) => b.totalScore - a.totalScore);

    const { holes, holePositions } = T.detectSquadHoles(userRoster, activeFormation);
    const holePosSet = new Set(holePositions);

    // Special Training Audit
    const trainSlots = 2 + Math.floor((Math.max(1, Math.min(10, ctLevel)) - 1) / 2);
    const trainMode = String(uTeam.trainMode || 'auto');
    const rawTrainIds = Array.isArray(uTeam.trainIds) ? uTeam.trainIds : [];
    const pById = {};
    for (const p of userRoster) pById[p.id] = p;

    const idealTrain = userRoster
      .filter(p => !p.injured && p.age < p.declineAge && (p.potCap - p.force) > 0)
      .sort((a, b) => ((b.potCap - b.force) - (a.potCap - a.force)) || (a.age - b.age) || (b.growthFrac - a.growthFrac))
      .slice(0, trainSlots);

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
      ideal: idealTrain.map(p => ({ name: p.name, pos: p.pos, age: p.age, force: p.force, potCap: p.potCap, gap: p.potCap - p.force })),
      wastedNames: wastedTrain,
    };

    const autoGuard = auditAutoSettings(save, uTeam, userRoster, trainAudit);

    // Akademi Ranking
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
      if ((y.age >= 20 || y.development >= 90) && y.hash >= 5) yAct = 'PROMOSIKAN SEKARANG';
      else if (y.hash >= 6 || (fillsHole && y.hash >= 5)) yAct = 'TAHAN & LATIH';
      const ceilBonus = y.development >= 60 ? (ceilMap[y.hash] || 0) : 0;
      return { ...y, fillsHole, pipeScore: yScore, action: yAct, ceilBonus };
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

    const curSim = E.simulateStadiumV9(sections, ticketMul, fanConf, userDiv, false, false);
    const optLiga = E.optimizeTicketPricesV9(sections, fanConf, userDiv, false, false);
    const optBig = E.optimizeTicketPricesV9(sections, fanConf, userDiv, true, true);
    const ticketPhases = E.computeAllTicketPhases(sections, fanConf, userDiv, rawTmb, ticketMul);

    const memberAudit = E.evalMemberPlan(uTeam.memberPlan, uTeam.members, fanConf);
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

    // MatchLog & Home Crowd Log
    const rawMlog = Array.isArray(save.matchLog) ? save.matchLog : [];
    const seasonStart = save.seasonStartDate || null;
    const recentMatches = [];
    const homeCrowdLog = [];

    for (const entry of rawMlog.slice(-25)) {
      if (!entry || typeof entry !== 'object') continue;
      const attV = U.safeInt(('at' in entry) ? entry.at : entry.attendance, 0);
      const revV = U.safeNum(('rv' in entry) ? entry.rv : entry.revenue, 0);

      let isHm;
      if ('userHome' in entry) isHm = Boolean(entry.userHome);
      else if ('isHome' in entry) isHm = Boolean(entry.isHome);
      else if (typeof entry.home === 'boolean') isHm = entry.home;
      else if (typeof entry.h === 'boolean') isHm = entry.h;
      else if ('hm' in entry) isHm = Boolean(entry.hm);
      else if ('casa' in entry) isHm = Boolean(entry.casa);
      else isHm = revV > 0;

      let rawOpp = entry.opp || entry.opponent || entry.oppName || entry.o || entry.oppId || entry.oid || entry.adv || entry.vs || entry.t || '';
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
        date: U.formatMatchDay(rawDKey, seasonStart, currentDate),
        comp: U.translateCompName(compRaw, compRaw),
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
          fromTeam: pc.fromTeamName || pc.fromTeamId || '-',
          arriveDate: String(pc.arriveDate || pc.endDate || '').slice(0, 10),
          salary: U.safeNum(pc.salary, 0),
        });
      }
    }

    prog(58, 'Membedah jadwal 5 lawan terdekat (War Room H2H)...');
    const simOpponents = (typeof S.extractSimOpponents === 'function') ? S.extractSimOpponents(save, userId, clubsMeta, compactTeams, staticPlayers) : [];
    const upcomingMatches = S.extractUpcomingMatches(
      save, userId, clubsMeta, compactTeams, staticPlayers,
      bestXi, sections, fanConf, userDiv, reputation, userRoster,
      activeFormation, foreignCap, userCountry, ticketMul, rawTmb
    );

    prog(75, 'Memindai Global Auto-Scout Moneyball (1.185+ klub AI)...');
    const { scoutPool, aiUnhappyTotal, aiBosmanTotal } = S.buildGlobalScoutPool(
      save, staticPlayers, clubsMeta, userId, userCountry, holePositions, bestXi.avgScore
    );

    prog(90, 'Menyusun Delta Tracker, Alarm Prioritas & Klasemen...');
    const snapPlayers = {};
    for (const p of userRoster) {
      snapPlayers[p.id] = { name: p.name, force: p.force, mv: p.marketValue, gf: p.growthFrac };
    }
    const snapNow = {
      budget: Math.round(budget),
      payroll: Math.round(totalPayroll),
      members: memberAudit.n,
      shopLastRev: Math.round(shopAudit.last_rev),
      seats: totalSeats,
      players: snapPlayers,
    };
    const { deltas, updatedHistory } = computeDeltasAndHistory(historyStore, currentDate, userId, snapNow);

    const alerts = buildPriorityAlerts(
      userRoster, youthRanked, moodsMap, unhappyCnt, lockerHit,
      uTeam.naming, uTeam.sponsors, ticketMul, shopAudit, memberAudit,
      holes, upcomingMatches, trainAudit, preContracts, userDiv,
      autoGuard, bestXi, optLiga.prices
    );

    const fineSlumpPlayers = userRoster
      .filter(p => (p.fineSlump || 0) > 0)
      .map(p => ({ name: p.name, pos: p.pos, slumpPct: p.fineSlumpPct, days: p.fineSlumpDays }));

    const cashHist = [];
    if (Array.isArray(uTeam.cashHistory)) {
      uTeam.cashHistory.slice(-24).forEach((pt, idx) => {
        if (pt && typeof pt === 'object') {
          cashHist.push({
            label: String(pt.date || pt.m || `M${idx + 1}`).slice(0, 10),
            val: U.safeNum(('budget' in pt) ? pt.budget : pt.v, 0),
          });
        } else if (typeof pt === 'number') {
          cashHist.push({ label: `T${idx + 1}`, val: pt });
        }
      });
    }

    const stmt35 = [];
    if (Array.isArray(uTeam.statement)) {
      for (const row of uTeam.statement.slice(-35).reverse()) {
        if (row && typeof row === 'object') {
          stmt35.push({
            date: String(row.date || row.d || '').slice(0, 10),
            label: String(row.label || row.desc || row.type || row.k || '-'),
            amount: U.safeNum(('amount' in row) ? row.amount : row.v, 0),
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

    const natId = save.userNationId || '';
    const nationInfo = natId ? {
      iso: natId,
      squadCount: Array.isArray(save.nationalTeamLineup) ? save.nationalTeamLineup.length : 0,
      tactics: save.nationalTeamTactics || {},
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

    function slimXi(xiObj) {
      return {
        ...xiObj,
        xi: xiObj.xi.map(a => ({
          slot: a.slot,
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
          top: a.player.top,
        })),
        bench: xiObj.bench.slice(0, 12).map(p => ({
          id: p.id,
          name: p.name,
          pos: p.pos,
          force: p.force,
          age: p.age,
          energy: p.energy,
          minPct: p.minPct || 0,
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
        version: 'v8.1 Web PWA (Engine v1.2.0 • Mobile UX)',
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
        phase: U.translatePhaseName(save.phase),
        transferWindow: save.transferWindow,
        budget: Math.round(budget),
        reputation: Math.round(reputation),
        repLevel,
        boardConf: Math.round(boardConf),
        fanConf: Math.round(fanConf),
        ctLevel,
        ctCond,
        ctMaintOff,
        youthCoach,
        bankLoan: Math.round(bankLoan),
        payroll: Math.round(totalPayroll),
        payrollRef: Math.round(payrollRef),
        squadValue: Math.round(totalSquadVal),
        activeFormation,
        foreignCap,
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
      cashflow: E.buildCashflowPayload(
        cashflowMeta, uTeam, curSim, spContracts, shopAudit, memberAudit,
        totalPayroll, stadiumOps, userDiv
      ),
      deltas,
      alerts,
      holes,
      holePositions,
      roster: rosterExport,
      youth: youthRanked,
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
        curSim,
        optLigaPrices: optLiga.prices,
        optLigaSim: optLiga.sim,
        optBigPrices: optBig.prices,
        optBigSim: optBig.sim,
        construction: uTeam.stadiumConstruction || null,
      },
      member: memberAudit,
      shop: shopAudit,
      naming: uTeam.naming || null,
      sponsors: spContracts,
      presGoals: cleanPresGoals(uTeam.presGoals),
      preContracts,
      ctMilestones: C.CT_MILESTONES,
      cashHistory: cashHist,
      statement: stmt35,
      recentMatches: recentMatches.slice(-10).reverse(),
      homeCrowdLog: homeCrowdLog.slice(-10).reverse(),
      standings: standingsRows,
      scoutPool,
      nation: nationInfo,
    };

    prog(100, `Selesai! (${parseSec}s)`);
    return { data, updatedHistory };
  }

  LF.club = {
    auditAutoSettings,
    computeDeltasAndHistory,
    cleanPresGoals,
    buildPriorityAlerts,
    analyzeSave,
  };
})(typeof window !== 'undefined' ? window : globalThis);
