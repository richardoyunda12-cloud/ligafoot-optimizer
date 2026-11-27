#!/usr/bin/env node
/**
 * LigaFoot Optimizer PWA — Automated Save-Sync & Regression Test Suite (`verify_e2e.js`)
 * Pemakaian:
 *   node scripts/verify_e2e.js [path/to/save.ligafoot] [--skip-ui]
 *
 * 3 Tahap Verifikasi:
 *   1. Syntax check (`node --check`) pada seluruh berkas JS engine, UI, SW & skrip tes.
 *   2. Engine E2E & Save-Sync Parity (termasuk simulasi multi-save berantai 3 snapshot).
 *   3. Playwright Desktop (1280x800) & Mobile (390x844, 0px overflow di 19 view) via `scripts/verify_ui.py`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function resolveSavePath(cliArg) {
  const candidates = [
    cliArg,
    process.env.LIGAFOOT_SAVE,
    path.resolve(REPO_ROOT, '..', 'ligafoot_slot1.ligafoot'),
    path.resolve(REPO_ROOT, 'ligafoot_slot1.ligafoot'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
  }
  throw new Error(
    `File save .ligafoot tidak ditemukan. Berikan path sebagai argumen atau set LIGAFOOT_SAVE.\n` +
    `Kandidat diperiksa:\n  - ${candidates.join('\n  - ')}`
  );
}

function collectJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectJsFiles(full, out);
    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function addDaysIso(isoDate, deltaDays) {
  const s = String(isoDate || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  assert(m, `Tanggal save tidak valid untuk simulasi multi-save: ${isoDate}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + deltaDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function runStage1Syntax() {
  console.log('\n[Stage 1/3] Syntax Check (`node --check`)...');
  const files = [
    ...collectJsFiles(path.join(REPO_ROOT, 'js')),
    ...collectJsFiles(path.join(REPO_ROOT, 'scripts')),
    path.join(REPO_ROOT, 'sw.js'),
  ].filter(f => fs.existsSync(f));

  for (const f of files) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  }
  console.log(`  PASS: ${files.length} file JavaScript lolos node --check.`);
}

function checkVersionParity() {
  const idx = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const club = fs.readFileSync(path.join(REPO_ROOT, 'js', 'engine', 'club.js'), 'utf8');
  const tab8 = fs.readFileSync(path.join(REPO_ROOT, 'js', 'ui', 'tab8_tools.js'), 'utf8');
  const sw = fs.readFileSync(path.join(REPO_ROOT, 'sw.js'), 'utf8');

  const mClub = /version:\s*'((v\d+\.\d+\.\d+)[^']*)'/.exec(club);
  assert(mClub, 'Version metadata tidak ditemukan di js/engine/club.js');
  const ver = mClub[2];
  const swVer = ver.replace(/\./g, '-');

  assert(idx.includes(ver), `index.html harus memuat versi ${ver}`);
  assert(tab8.includes(ver), `js/ui/tab8_tools.js harus memuat versi ${ver}`);
  assert(sw.includes(`ligafoot-opt-pwa-${swVer}`), `sw.js CACHE_NAME harus sinkron dengan ${ver}`);
  return ver;
}

function runStage2Engine(savePath) {
  console.log(`\n[Stage 2/3] Engine E2E & Save-Sync Parity (${path.basename(savePath)})...`);
  const expectedVer = checkVersionParity();
  console.log(`  Version parity OK: ${expectedVer}`);

  global.window = global;
  for (const f of ['config', 'utils', 'conditions', 'tactics', 'economy', 'roster', 'scout', 'club']) {
    require(path.join(REPO_ROOT, 'js', 'engine', f + '.js'));
  }

  const dbPath = path.join(REPO_ROOT, 'data', 'static_db.min.json.gz');
  assert(fs.existsSync(dbPath), `Static DB tidak ditemukan: ${dbPath}`);
  const db = JSON.parse(zlib.gunzipSync(fs.readFileSync(dbPath)));

  // Regresi v8.10.1: detectSquadHoles tidak boleh crash ReferenceError saat skuad kurang starter natural
  const sparseHoles = global.LFEngine.tactics.detectSquadHoles([{ pos: 'G', force: 45, foot: 'D', injured: false }], '4-3-3');
  assert(sparseHoles && Array.isArray(sparseHoles.holes) && sparseHoles.holes.some(h => h.kind === 'NO_STARTER' && h.desc.includes('4-3-3')),
    'detectSquadHoles gagal membentuk deskripsi NO_STARTER dengan spec.key');
  // Unit regression OTA 2.1.0: releaseClauseOf regional (BR 1.5x, EU 3.0x, Other 2.0x) & realScale declineStartAge
  assert.strictEqual(global.LFEngine.utils.releaseClauseOf(1000000, 'BR', 0).amount, 1500000, 'Release clause BR harus 1.5x');
  assert.strictEqual(global.LFEngine.utils.releaseClauseOf(1000000, 'ES', 0).amount, 3000000, 'Release clause EU harus 3.0x');
  assert.strictEqual(global.LFEngine.utils.releaseClauseOf(1000000, 'ID', 0).amount, 2000000, 'Release clause Other harus 2.0x');
  assert.strictEqual(global.LFEngine.utils.releaseClauseOf(1000000, 'BR', 2400000).amount, 2400000, 'Release clause harus respect paidIn floor');
  assert.strictEqual(global.LFEngine.utils.getDeclineAge('G', true), 35, 'RealScale GK decline harus 35');
  assert.strictEqual(global.LFEngine.utils.getDeclineAge('ATA', true), 33, 'RealScale outfield decline harus 33');
  assert.strictEqual(global.LFEngine.utils.getDeclineAge('ATA', false), 31, 'Classic ATA decline harus 31');
  const save = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  const uTeam = save.compactTeams && save.compactTeams[save.userTeamId];
  assert(uTeam, 'userTeamId tidak ditemukan di save.compactTeams');

  const res1 = global.LFEngine.club.analyzeSave(save, db, {});
  const D = res1.data;
  const uid = D.meta.userId;

  // 1. Metadata & Core Sync
  assert(D.meta.parseSec < 2.5, `Parse terlalu lambat: ${D.meta.parseSec}s (>= 2.5s)`);
  assert(D.meta.version.includes(expectedVer), `meta.version (${D.meta.version}) tidak cocok dengan ${expectedVer}`);
  const rawDate = String(save.currentDate || (save.world && save.world.date) || '').slice(0, 10);
  if (rawDate) assert.strictEqual(D.meta.currentDate, rawDate, 'currentDate mismatch');
  assert.strictEqual(D.meta.budget, Math.round(Number(uTeam.budget || 0)), 'budget mismatch');
  assert.strictEqual(D.meta.ctLevel, Math.max(1, Math.round(Number(uTeam.ctLevel || 1))), 'ctLevel mismatch');
  assert(D.roster.length > 0, 'roster kosong');

  // Regresi v8.10.4: False Nine hanya boleh dipasang pada ST/SS/CAM (MA/ATA/SA), tidak boleh winger (LW/RW/PE/PD)
  for (const fx of (D.upcoming || [])) {
    const f9t = fx.matchup && fx.matchup.falseNineTarget;
    if (f9t) {
      assert(!['LW', 'RW', 'PE', 'PD'].includes(String(f9t.pos || '').toUpperCase()),
        `False Nine tidak boleh merekomendasikan winger ${f9t.name} (${f9t.pos})`);
    }
  }
  const f9TestRoster = [
    { id: 'gk', name: 'GK', pos: 'G', force: 50, foot: 'D', energy: 100 },
    { id: 'd1', name: 'D1', pos: 'LD', force: 50, foot: 'D', energy: 100 },
    { id: 'd2', name: 'D2', pos: 'ZD', force: 50, foot: 'D', energy: 100 },
    { id: 'd3', name: 'D3', pos: 'ZE', force: 50, foot: 'E', energy: 100 },
    { id: 'd4', name: 'D4', pos: 'LE', force: 50, foot: 'E', energy: 100 },
    { id: 'm1', name: 'M1', pos: 'VOL', force: 50, foot: 'D', energy: 100 },
    { id: 'm2', name: 'M2', pos: 'MC', force: 50, foot: 'D', energy: 100 },
    { id: 'm3', name: 'M3', pos: 'MA', force: 50, foot: 'D', energy: 100 },
    { id: 'm4', name: 'M4', pos: 'MA', force: 50, foot: 'D', energy: 100 },
    { id: 'a1', name: 'StrikerPM', pos: 'ATA', force: 55, foot: 'D', s1: 'PAS', s2: 'FIN', energy: 100 },
    { id: 'a2', name: 'WingerPM', pos: 'PE', force: 55, foot: 'E', s1: 'PAS', s2: 'VEL', energy: 100 },
  ];
  const f9Xi = global.LFEngine.tactics.solveBestXi(f9TestRoster, '4-4-2', 9, '');
  assert.strictEqual(f9Xi.falseNine, true, 'solveBestXi harus menandai falseNine=true dengan >=2 penyerang & 1 ST PAS/ARM');
  assert.deepStrictEqual(f9Xi.falseNinePlayers, ['StrikerPM'], 'falseNinePlayers hanya boleh memuat ST/SS/CAM, bukan winger PE');

  // Regresi v8.10.3: buyerAcceptsPlayer (#24933) + findInterestedTeams (#25045) tanpa filter budget palsu
  const topUnlocked = D.roster.find(p => !p.freeSigned && !p.loanedFrom && !(p.pos === 'G' && D.roster.filter(x => x.pos === 'G').length <= 1));
  if (topUnlocked) {
    assert(topUnlocked.estBuyersCount > 0, `Pemain utama ${topUnlocked.name} seharusnya memiliki peminat AI (estBuyersCount=${topUnlocked.estBuyersCount})`);
    const expEffMv = topUnlocked.injured ? Math.round((topUnlocked.marketValue || 0) * (topUnlocked.injurySaleMul || 1)) : Math.round(topUnlocked.marketValue || 0);
    assert.strictEqual(topUnlocked.maxAskPrice, Math.round(expEffMv * 1.10), `maxAskPrice ${topUnlocked.name} harus 1.10x MV efektif`);
    assert(typeof topUnlocked.offerSlotsRange === 'string' && topUnlocked.offerSlotsRange.includes('–'), 'offerSlotsRange hilang');
  }

  // Regresi v8.10.5 (Batch 1 Bytecode Parity): saleFeeRate vs 0% incoming/Arab, 1.25x counter, loanBuyPrice, stadium tier single-rate, shop clubHistory[0], kindScale=1.0, loanLimit repLvl=0, installment ceil/floor
  assert.strictEqual(global.LFEngine.roster.calcNetSaleProceeds(1000000, 365, false), 700000, 'Jual manual >180d harus kena 30% fee (#25088)');
  assert.strictEqual(global.LFEngine.roster.calcNetSaleProceeds(1000000, 365, true), 1000000, 'Incoming/Arab offer harus 0% fee (#25025)');
  assert.strictEqual(global.LFEngine.config.COUNTER_AVG_REALIZED, 1.25, 'COUNTER_AVG_REALIZED harus 1.25 (#25089)');
  assert.strictEqual(global.LFEngine.economy.calcExpansionCost('cadeiras', 5000, 1000, 1, false), 3600000, 'Cadeiras 5000+1000 div1 harus single tier 6000->1200*3*1000 (#20282)');
  assert.strictEqual(global.LFEngine.economy.calcExpansionCost('geral', 800, 500, 1, false), 240000, 'Geral 800+500 harus single tier 1300->160*3*500 (#20282)');
  const inst24 = global.LFEngine.economy.computeInstallmentPlan(1000001, 24);
  assert.strictEqual(inst24.dp, 250001, 'DP cicilan harus Math.ceil(p*0.25) (#21875)');
  assert.strictEqual(inst24.monthly, Math.floor(inst24.totalFinanced / 24), 'Cicilan bulanan harus Math.floor(owed/m) (#21875)');
  assert.strictEqual(global.LFEngine.economy.computeLoanLimit('ES', 1, 5), global.LFEngine.economy.computeLoanLimit('ES', 1, 0), 'LoanLimit harus pakai repLvl=0 (#20258)');
  const simCont1 = global.LFEngine.economy.simulateStadiumV9({ geral: 10000, arquibancada: 30000, cadeiras: 5000, camarotes: 500 }, 1.0, 80, 1, false, false, 0, { kind: 'continental1', homeRepLvl: 3, country: 'ID' });
  const simLigaSameBonus = global.LFEngine.economy.simulateStadiumV9({ geral: 10000, arquibancada: 30000, cadeiras: 5000, camarotes: 500 }, 1.0, 80, 1, false, false, 0, { kind: 'cup', homeRepLvl: 3, country: 'ID' });
  const simLigaBase = global.LFEngine.economy.simulateStadiumV9({ geral: 10000, arquibancada: 30000, cadeiras: 5000, camarotes: 500 }, 1.0, 80, 1, false, false, 0, { kind: 'league', homeRepLvl: 3, country: 'ID' });
  assert.strictEqual(simLigaSameBonus.totalAtt, simLigaBase.totalAtt, 'cup kindScale harus 1.0 sama dengan league (#20312)');
  assert(simCont1.totalAtt > simLigaBase.totalAtt, 'continental1 harus naik karena +0.30 fillBonus');
  assert.strictEqual(global.LFEngine.utils.loanBuyDecisionChance({ loanedFrom: 'x', loanBuyPrice: 900000, marketValue: 1000000, seasonGames: 10, avgRating: 7.2, forceTo: 45, forceFrom: 42 }, 800000), 0, 'Budget < buyFee harus 0 (#21089)');
  assert.strictEqual(global.LFEngine.utils.loanBuyDecisionChance({ loanedFrom: 'x', loanBuyPrice: 900000, marketValue: 1000000, seasonGames: 10, avgRating: 7.2, forceTo: 45, forceFrom: 42 }, 1500000), 0.95, '0.75*1.3*1.15 capped 0.95 (#21089)');
  assert.strictEqual(global.LFEngine.utils.isWindowOpenOn('ES', '2032-07-15'), true, 'ES window Jul harus buka');
  assert.strictEqual(global.LFEngine.utils.isWindowOpenOn('ES', '2032-11-28'), false, 'ES window Nov harus tutup');
  if (D.shop && D.shop.hype_events) {
    assert(Array.isArray(D.shop.hype_events), 'shop.hype_events harus array');
  }

  // 2. Best XI & Rotation XI & War Room Matchup Parity
  assert.strictEqual(D.bestXi.xi.length, 11, 'Best XI harus tepat 11 pemain');
  assert.strictEqual(D.rotXi.xi.length, 11, 'Rotation XI harus tepat 11 pemain');
  if (D.upcoming.length > 0 && D.upcoming[0].matchup) {
    const m0 = D.upcoming[0].matchup;
    assert(Array.isArray(m0.styleCompare) && m0.recommended, 'Matchup styleCompare/recommended hilang');
    const recRow = m0.styleCompare.find(s => s.style === m0.recommended.optStyle);
    assert(recRow, `styleCompare tidak memuat optStyle ${m0.recommended.optStyle}`);
    assert.strictEqual(
      m0.recommended.winPct,
      recRow.winPct,
      'Matchup recommended.winPct tidak sinkron dengan styleCompare'
    );
  }

  // 3. lastLineup & B-Team Parity
  if (save.lastLineup && Array.isArray(save.lastLineup.playerIds)) {
    assert(D.lastLineup, 'lastLineup harus terisi saat save.lastLineup ada');
    assert.strictEqual(
      D.lastLineup.starterIds.length,
      Math.min(11, save.lastLineup.playerIds.filter(Boolean).length),
      'lastLineup.starterIds count mismatch'
    );
  }
  const bTeamId = D.bTeamInfo && D.bTeamInfo.bTeamId;
  if (bTeamId && save.compactTeams[bTeamId]) {
    const bt = save.compactTeams[bTeamId];
    const rawBCnt = (Array.isArray(bt.playerIds) && bt.playerIds.length)
      ? bt.playerIds.length
      : (Array.isArray(bt.extraRows) ? bt.extraRows.length : 0);
    assert.strictEqual(D.bTeamInfo.roster.length, rawBCnt, 'B-Team roster count mismatch');
  }

  // 4. MatchLog Telemetry Parity
  const expectedClubMlogCnt = (Array.isArray(save.matchLog) ? save.matchLog : []).filter(e => {
    if (!e || typeof e !== 'object') return false;
    if (String(e.comp || e.c || '').toLowerCase().startsWith('nat:')) return false;
    if (typeof e.h === 'string' && typeof e.a === 'string') return e.h === uid || e.a === uid;
    if (typeof e.home === 'string' && typeof e.away === 'string') return e.home === uid || e.away === uid;
    return true;
  }).length;
  assert.strictEqual(D.matchTelemetry.all.games, expectedClubMlogCnt, 'matchTelemetry all.games mismatch');
  assert(D.matchTelemetry.season.games <= D.matchTelemetry.all.games, 'season.games > all.games');
  assert.strictEqual(D.matchTelemetry.all.minuteBuckets.length, 6, 'minuteBuckets harus 6');
  assert(D.matchTelemetry.all.avgPos >= 0 && D.matchTelemetry.all.avgPos <= 100, 'avgPos di luar 0..100');
  const sPlayers = D.matchTelemetry.season && D.matchTelemetry.season.playerTelemetry ? D.matchTelemetry.season.playerTelemetry : null;
  if (sPlayers && Array.isArray(sPlayers.allPlayers)) {
    for (const sp of sPlayers.allPlayers) {
      assert(sp.ratedApps <= sp.apps && sp.ratedSubs <= sp.subs, `ratedApps/ratedSubs invalid untuk ${sp.name}`);
    }
    for (const up of (sPlayers.underperformers || [])) {
      if (up.ratedApps > 0) {
        assert(up.avgRating >= 4.0, `Underperformer avgRating (${up.avgRating} untuk ${up.name}) terlalu rendah — indikasi bug null rating=0`);
      }
    }
  }

  // 5. Ticket Presets & 12M Cashflow Calendar
  const rawPresets = Array.isArray(save.ticketPresets) ? save.ticketPresets : [];
  assert.strictEqual(D.stadium.presetAudit.presets.length, rawPresets.length, 'presetAudit count mismatch');
  assert.strictEqual(D.cashflowCalendar.months.length, 12, 'cashflowCalendar harus 12 bulan');
  assert(Number.isFinite(D.cashflowCalendar.endBudget12m), 'endBudget12m harus finite');

  // 6. What-If Squad Impact (Custom formation ~)
  const impact = global.LFEngine.tactics.evaluateSquadImpact(D.roster, {
    activeFormation: D.meta.activeFormation,
    activeFormationRaw: D.meta.activeFormationRaw,
    foreignCap: D.meta.foreignCap,
    userCountry: D.meta.country,
  });
  assert.strictEqual(impact.xiIds.length, 11, 'evaluateSquadImpact xiIds harus 11');
  assert(Number.isFinite(impact.chemistry), 'evaluateSquadImpact chemistry harus finite');

  // 7. National Team Non-Regressing Optimizer (jika melatih Timnas)
  if (D.nation && D.nation.iso) {
    const calledInPool = D.nation.natPool.filter(p => p.called).length;
    assert.strictEqual(calledInPool, D.nation.squadCount, 'Semua pemain timnas dipanggil harus tersimpan di natPool');
    if (D.nation.callupAudit && D.nation.callupAudit.currentXiAvg > 0) {
      assert(
        D.nation.callupAudit.optimalXiAvg >= D.nation.callupAudit.currentXiAvg,
        `Optimal Timnas XI (${D.nation.callupAudit.optimalXiAvg}) tidak boleh lebih rendah dari dipanggil (${D.nation.callupAudit.currentXiAvg})`
      );
    }
  }

  // 8. Tier 3 Single-Save Progression Baseline
  assert(D.progression, 'D.progression hilang');
  assert.strictEqual(D.progression.snapshotCount, 1, 'Single-save snapshotCount harus 1');
  assert.strictEqual(D.progression.clubTimeline.length, 1, 'clubTimeline length harus 1');
  assert(D.progression.wonderkids.length > 0, 'Harus ada minimal 1 prospek di wonderkids');
  const wk0 = D.progression.wonderkids[0];
  assert(wk0.estWeeklyRate >= 0.01, 'estWeeklyRate tidak valid');
  assert.strictEqual(wk0.projectedCurve.length, 4, 'projectedCurve harus 4 titik (Kini, +3B, +6B, +12B)');
  assert.strictEqual(wk0.paceStatus, 'BASELINE', 'Single save paceStatus harus BASELINE');

  // 9. Tier 3 Synthetic 3-Save Chain (`T-56d -> T-28d -> currentDate`)
  const curSnap = res1.updatedHistory[uid][D.meta.currentDate];
  const seniorWk = D.progression.wonderkids.find(w => w.src === 'roster') || wk0;
  const d56 = addDaysIso(D.meta.currentDate, -56);
  const d28 = addDaysIso(D.meta.currentDate, -28);
  const s56 = JSON.parse(JSON.stringify(curSnap));
  const s28 = JSON.parse(JSON.stringify(curSnap));
  s56.budget -= 5000000;
  s56.bestXiAvg = Number((Number(s56.bestXiAvg || 50) - 1.2).toFixed(2));
  s28.budget -= 2000000;
  s28.bestXiAvg = Number((Number(s28.bestXiAvg || 50) - 0.5).toFixed(2));
  if (s56.players && s56.players[seniorWk.id]) {
    s56.players[seniorWk.id].force = Math.max(1, s56.players[seniorWk.id].force - 1);
    s56.players[seniorWk.id].gf = 0.1;
  }
  if (s28.players && s28.players[seniorWk.id]) {
    s28.players[seniorWk.id].gf = Math.max(0, Number((s28.players[seniorWk.id].gf - 0.35).toFixed(3)));
  }
  const synthHist = { [uid]: { [d56]: s56, [d28]: s28 } };
  const res3 = global.LFEngine.club.analyzeSave(save, db, synthHist);
  const D3 = res3.data;

  assert.strictEqual(D3.deltas.prevDate, d28, '3-save prevDate mismatch');
  assert.strictEqual(D3.deltas.daysElapsed, 28, 'daysElapsed harus 28');
  assert.strictEqual(D3.deltas.weeksElapsed, 4, 'weeksElapsed harus 4');
  assert.strictEqual(D3.deltas.budgetDelta, 2000000, 'budgetDelta mismatch');
  assert.strictEqual(D3.deltas.bestXiDelta, 0.5, 'bestXiDelta mismatch');
  assert(D3.deltas.forceUpPlayers.some(x => x.id === seniorWk.id), 'forceUpPlayers harus mendeteksi peningkatan wonderkid');
  assert.strictEqual(D3.progression.snapshotCount, 3, '3-save snapshotCount harus 3');
  assert.strictEqual(D3.progression.clubTimeline.length, 3, '3-save clubTimeline length harus 3');
  const tracked3 = D3.progression.wonderkids.find(w => w.id === seniorWk.id);
  assert(tracked3, 'Wonderkid terpantau hilang di 3-save chain');
  assert.strictEqual(tracked3.obsPoints.length, 3, 'obsPoints harus 3 titik');
  assert(Number.isFinite(tracked3.obsWeeklyRate) && tracked3.obsWeeklyRate > 0, 'obsWeeklyRate harus positif');
  assert.notStrictEqual(tracked3.paceStatus, 'BASELINE', '3-save paceStatus tidak boleh BASELINE');

  console.log(
    `  PASS: Parse ${D.meta.parseSec}s | Skuad ${D.roster.length} | BestXI ${D.bestXi.avgScore} | ` +
    `MatchLog ${D.matchTelemetry.all.games} | Wonderkids ${D.progression.wonderkids.length} | 3-Save Rate +${tracked3.obsWeeklyRate}/pkn (${tracked3.paceStatus}).`
  );
}

function runStage3Playwright(savePath) {
  console.log('\n[Stage 3/3] Playwright Desktop + Mobile Overflow Verification...');
  const pyScript = path.join(REPO_ROOT, 'scripts', 'verify_ui.py');
  const runners = process.platform === 'win32' ? [['python', []], ['py', ['-3']]] : [['python3', []], ['python', []]];
  let lastErr = null;
  for (const [cmd, prefix] of runners) {
    const res = spawnSync(cmd, [...prefix, pyScript, savePath], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (res.error && res.error.code === 'ENOENT') {
      lastErr = res.error;
      continue;
    }
    if (res.status !== 0) {
      throw new Error(`Playwright UI verification gagal (exit code ${res.status})`);
    }
    return;
  }
  throw lastErr || new Error('Interpreter Python untuk scripts/verify_ui.py tidak ditemukan.');
}

function main() {
  const args = process.argv.slice(2);
  const skipUi = args.includes('--skip-ui');
  const fileArg = args.find(a => !a.startsWith('--'));
  const savePath = resolveSavePath(fileArg);

  runStage1Syntax();
  runStage2Engine(savePath);
  if (!skipUi) runStage3Playwright(savePath);
  else console.log('\n[Stage 3/3] Playwright UI dilewati (--skip-ui).');

  console.log('\nALL LIGAFOOT OPTIMIZER E2E CHECKS PASSED!');
}

main();
