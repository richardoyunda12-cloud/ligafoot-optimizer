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

  const parityPy = path.join(REPO_ROOT, 'scripts', 'check_bytecode_parity.py');
  if (fs.existsSync(parityPy)) {
    const pyRunners = process.platform === 'win32' ? [['python', []], ['py', ['-3']]] : [['python3', []], ['python', []]];
    for (const [cmd, prefix] of pyRunners) {
      const pr = spawnSync(cmd, [...prefix, parityPy], { cwd: REPO_ROOT, stdio: 'inherit' });
      if (pr.error && pr.error.code === 'ENOENT') continue;
      if (pr.status !== 0) {
        throw new Error(`Bytecode parity check gagal (exit code ${pr.status})`);
      }
      break;
    }
  }

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

  // Regresi v8.10.3 + v8.10.11: buyerAcceptsPlayer (#24933) + findInterestedTeams (#25496) + lastInPosition (#25401)
  const topUnlocked = D.roster.find(p => !p.freeSigned && !p.loanedFrom && !p.lastInPositionLock && !(p.pos === 'G' && D.roster.filter(x => x.pos === 'G').length <= 1));
  if (topUnlocked) {
    assert(topUnlocked.estBuyersCount > 0, `Pemain utama ${topUnlocked.name} seharusnya memiliki peminat AI (estBuyersCount=${topUnlocked.estBuyersCount})`);
    assert.strictEqual(typeof topUnlocked.estAffordBuyersCount, 'number', 'estAffordBuyersCount harus ada pada roster');
    const expEffMv = topUnlocked.injured ? Math.round((topUnlocked.marketValue || 0) * (topUnlocked.injurySaleMul || 1)) : Math.round(topUnlocked.marketValue || 0);
    assert.strictEqual(topUnlocked.maxAskPrice, Math.round(expEffMv * 1.10), `maxAskPrice ${topUnlocked.name} harus 1.10x MV efektif`);
    assert(typeof topUnlocked.offerSlotsRange === 'string' && topUnlocked.offerSlotsRange.includes('–'), 'offerSlotsRange hilang');
  }
  // Regresi v8.10.11: SGEM flag di Pasar Global & superGemCount di Tim B
  assert(D.scoutPool.some(r => String(r[18] || '').split(',').includes('SGEM')), 'Pasar Global (scoutPool) harus menandai flag SGEM pada Super Gem U-22');
  assert.strictEqual(typeof D.bTeamInfo.superGemCount, 'number', 'D.bTeamInfo.superGemCount harus bertipe number');
  assert.strictEqual(typeof D.meta.maxAiBudgetOpen, 'number', 'D.meta.maxAiBudgetOpen harus bertipe number');
  // Regresi v8.11.0: forSalePrice, contSlack & index.html #webapp-dashboard-shell nesting
  assert(D.roster.every(p => typeof p.forSalePrice === 'number'), 'Semua roster harus mengekstrak angka forSalePrice');
  const idxHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const shellOpenIdx = idxHtml.indexOf('id="webapp-dashboard-shell"');
  const navBnavIdx = idxHtml.indexOf('class="mobile-bnav"');
  const gdModalIdx = idxHtml.indexOf('id="gdrive-folder-modal"');
  assert(shellOpenIdx > 0 && navBnavIdx > shellOpenIdx && gdModalIdx > navBnavIdx, 'index.html: mobile-bnav harus berada DI DALAM #webapp-dashboard-shell sebelum penutup');

  // Regresi v8.10.6 (Batch 2 Match Engine, Tactics & Formations Parity - OTA 2.1.0)
{
  const C = global.LFEngine.config;
  const T = global.LFEngine.tactics;

  assert.strictEqual(Object.keys(C.FORMATIONS).length, 16, 'Harus ada tepat 16 formasi resmi termasuk 3-4-1-2');
  assert.ok(C.FORMATIONS['3-4-1-2'], 'Formasi 3-4-1-2 harus terdaftar');
  assert.strictEqual(C.FORMATION_RULE_SLOTS['3-4-1-2'].length, 11, '3-4-1-2 ruleSlots harus 11');
  assert.deepStrictEqual(C.FORMATION_MODS['3-4-1-2'], { atkMod: 2, defMod: -1 }, '3-4-1-2 mods harus +2/-1');
  assert.strictEqual(T.slotCompatFactor('LD', 'ZD', 2), 0.70, 'FB di slot CB (rule 2) harus OOP 0.70');
  assert.strictEqual(T.slotCompatFactor('ZD', 'ZD', 2), 1.00, 'CB di slot CB (rule 2) harus 1.00');
  assert.strictEqual(T.slotCompatFactor('LD', 'LE', 5), 1.00, 'RB di slot LB (rule 5) tidak OOP (hanya wrongFoot)');
  assert.strictEqual(T.evalSkillStackingForSector('G', 'REF', 'COL').stackPct, 0, 'GK REF/COL memberi 0% sector power');
  assert.strictEqual(T.evalSkillStackingForSector('D', 'DES', '').stackPct, 5, 'DEF TCK memberi +5% sector');

  const pTop = { id: 'pt', pos: 'MC', force: 20, s1: '', s2: '', top: true, star: true };
  const pStar = { id: 'ps', pos: 'MC', force: 20, s1: '', s2: '', top: false, star: true };
  const evTopH = T.evalPlayerForSlot(pTop, 'MC', false, 4, 7, true);
  const evStarH = T.evalPlayerForSlot(pStar, 'MC', false, 4, 7, true);
  const evStarAI = T.evalPlayerForSlot(pStar, 'MC', false, 4, 7, false);
  assert.ok(Math.abs(evTopH.score - evStarH.score) < 1e-9, 'p.top harus capped 1.05 sama seperti isPlayerStar');
  assert.ok(Math.abs((evStarH.score / evStarAI.score) - 1.05) < 1e-6, 'humanBoost 1.05 hanya untuk human, AI=1.00');

  const bXi = ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MC', 'MD', 'PD', 'ATA', 'PE'].map((pos, idx) => ({
    slot: pos,
    sectorCode: idx === 0 ? 'G' : (idx <= 4 ? 'D' : (idx <= 7 ? 'M' : 'A')),
    score: 20,
    player: {
      id: 'p' + idx, name: 'P' + idx, pos, force: 20, age: 25,
      s1: idx === 0 ? 'REF' : (pos === 'MD' ? 'CRU' : (pos === 'PD' ? 'CRU' : '')),
      s2: idx === 0 ? 'SAI' : '',
    },
  }));
  const powLight = T.computeEngineSectorPower({ xi: bXi, formation: '4-3-3', chemistry: 100 }, '4-3-3', { marking: 'Light', cardMul: 1.0 });
  const powVh = T.computeEngineSectorPower({ xi: bXi, formation: '4-3-3', chemistry: 100 }, '4-3-3', { marking: 'Very Heavy', cardMul: 1.0 });
  assert.strictEqual(powVh.staminaDrainLabel, 'Normal', 'Marking Very Heavy tetap stamina Normal');
  assert.strictEqual(powVh.redMarkMul, 1.35, 'Very Heavy redMarkMul=1.35');
  assert.ok(powVh.DEF <= powLight.DEF, 'Marking Very Heavy tidak memberi +8% DEF');
  assert.strictEqual(powLight.gkSaveMul, 1.05, 'GK s1 REF(+4%)+s2 SAI(+1%) -> gkSaveMul 1.05');
  assert.strictEqual(powLight.wingCrossers, 1, 'Wings hanya hitung LD/LE/PD/PE (MD CRU tidak dihitung)');

  const bXiOldCap = bXi.map((it, idx) => idx === 2 ? { ...it, player: { ...it.player, age: 31 } } : it);
  const powYoung = T.computeEngineSectorPower({ xi: bXi, formation: '4-3-3', chemistry: 100 }, '4-3-3', { marking: 'Light' });
  const powOld = T.computeEngineSectorPower({ xi: bXiOldCap, formation: '4-3-3', chemistry: 100 }, '4-3-3', { marking: 'Light' });
  assert.strictEqual(powYoung.MID, powOld.MID, 'Kapten tidak memberi +3% MID pasif sebelum Babak 2 Kalah');
  const powOldCb = T.computeEngineSectorPower({ xi: bXiOldCap, formation: '4-3-3', chemistry: 100 }, '4-3-3', { marking: 'Light', secondHalf: true, losing: true });
  assert.ok(powOldCb.MID > powOld.MID, 'Kapten >=28th aktif +6% MID di Babak 2 saat kalah');

  const powAlt = T.computeEngineSectorPower({ xi: bXi, formation: '4-3-3', chemistry: 100 }, '4-3-3', { isHome: false, neutral: false, altHit: 1, style: 'Balanced' });
  assert.ok(powAlt.DEF < 16 * 0.92, 'altMul diterapkan SETELAH clamp ±8% (tidak terpotong di 0.92)');

  const sp = T.auditSetPieces([
    { id: 'c1', name: 'Old', pos: 'MC', force: 16, age: 31, s1: '', s2: 'FIN' },
    { id: 'c2', name: 'Fin1', pos: 'ATA', force: 18, age: 23, s1: 'FIN', s2: '' },
    { id: 'c3', name: 'NoFin', pos: 'ZD', force: 25, age: 25, s1: '', s2: '' },
  ]);
  assert.strictEqual(sp.takers.captain[0].id, 'c1', 'Captain urut usia murni (#22450)');
  assert.strictEqual(sp.autoPick.freeKick.id, sp.autoPick.penalty.id, 'Auto FK fallback sama dengan Auto PK');
  assert.strictEqual(T.predictAiTacticsDetail(30, 20, false, []).aiStyle, 'Balanced', 'AI diff>=6 default Balanced (#24891)');
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
    const curGf = Number(s28.players[seniorWk.id].gf || 0);
    if (curGf >= 0.15) {
      s28.players[seniorWk.id].gf = Math.max(0, Number((curGf - Math.min(curGf, 0.35)).toFixed(3)));
    } else {
      s28.players[seniorWk.id].force = Math.max(1, Number(s28.players[seniorWk.id].force || 1) - 1);
      s28.players[seniorWk.id].gf = 0.85;
    }
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

  // 10. Batch 3 OTA 2.1.0 Parity Unit Checks
  const U = global.LFEngine.utils;
  const T = global.LFEngine.tactics;
  const C = global.LFEngine.config;
  assert.strictEqual(Object.keys(C.COUNTRY_GROUPS).length, 6, 'COUNTRY_GROUPS harus 6 grup');
  assert.strictEqual(U.countryGroup('EN'), 0);
  assert.strictEqual(U.countryGroup('BR'), 1);
  assert.strictEqual(U.countryGroup('NZ'), 5);
  assert.strictEqual(U.countryGroup('XX_UNKNOWN'), -1);
  assert.strictEqual(U.injuryTier(28), 'moderate');
  assert.strictEqual(U.injuryTier(70), 'major');
  assert.strictEqual(U.injuryTier(71), 'severe');
  assert.strictEqual(C.MOOD_CFG.starterQuota, 0.25);
  assert.strictEqual(C.MOOD_CFG.explicitStarterQuota, 0.40);

  const synthRoster = [];
  for (let i = 0; i < 12; i++) {
    synthRoster.push({
      id: `p${i}`,
      pos: i === 0 ? 'G' : 'MC',
      age: 24,
      force: 80 - i,
      squadRole: i === 2 ? 'starter' : 'auto',
      seasonMinutes: i === 1 ? 630 : 270, // 70% vs 30% of 900m (10 games)
      gamesPlayed: 10,
      seasonInjuryDays: 0,
    });
  }
  const { moods: mTest } = T.computeSquadMoodsV9(synthRoster, false);
  assert.strictEqual(mTest.p0.reqPct, 25, 'Natural starter auto harus reqPct 25%');
  assert.strictEqual(mTest.p1.mood, 'happy', 'Natural starter 70% (>=60%) harus happy');
  assert.strictEqual(mTest.p2.reqPct, 40, 'Explicit role=starter harus reqPct 40%');
  assert.strictEqual(mTest.p2.mood, 'unhappy', 'Explicit starter 30% (<40%) harus unhappy');

  const brRate = U.estimateWeeklyGrowthRate({ age: 20, force: 25, top: true }, { clubLevel: 20, country: 'BR', played: true });
  const mxRate = U.estimateWeeklyGrowthRate({ age: 20, force: 25, top: true }, { clubLevel: 20, country: 'MX', played: true });
  assert(mxRate > brRate, 'BR harus kena penalti -0.02 sementara MX tidak');

  const polCeil = T.userBuyPolicy({ id: 'x1', pos: 'MC', force: 79, age: 25, marketValue: 1000000 }, 'ES', 'ES', 10, 10, 40, 2, null, 3, false, { avgTop11: 68 });
  assert.strictEqual(polCeil.status, 'OK');
  assert.strictEqual(polCeil.code, 'CEIL_2X');
  assert.strictEqual(polCeil.salaryMul, 2.0);
  assert.strictEqual(polCeil.ceilMult, 1.0);
  assert.strictEqual(T.refusesStatus({ force: 70, top: true }, 18, 13, 1, 0), true);
  assert.strictEqual(T.refusesDistance({ age: 35, nationality: 'IT' }, 'IT', 'JP', 15, 13, 0, 1), true);
  assert(U.computeMarketValue({ force: 60, age: 20, potCap: 75, pos: 'ATA', star: true }, { level: 21, country: 'ES' }) > 10000000);
  assert(D.bTeamInfo.creationCost >= 2600000, 'bTeamCost minimum 2.6M tanpa cap 2M');
  assert(Array.isArray(D.rivalYouthTargets), 'D.rivalYouthTargets harus ada');

  // 11. Golden Regression Checks (False Nine, sellerStance, lastInPosition, Economy)
  const stRes = T.sellerStance(
    { id: 's1', pos: 'MC', force: 70, age: 25, forSale: true, marketValue: 1000000 },
    { id: 'c1', level: 10, division: 1, country: 'BR', budget: -100000, players: [{ id: 's1', pos: 'MC', force: 70, salary: 50000 }, { id: 's2', pos: 'MC', force: 60, salary: 40000 }] },
    { level: 10, division: 1, country: 'BR' }
  );
  assert.strictEqual(stRes.mult, 0.80, 'forSale (0%) + redCash (-20%) harus menghasilkan mult 0.80');
  const stScarce = T.sellerStance(
    { id: 's1', pos: 'MC', force: 75, age: 24, forSale: false, marketValue: 1000000 },
    { id: 'c1', level: 10, division: 1, country: 'BR', budget: 50000000, players: [{ id: 's1', pos: 'MC', force: 75, salary: 10000 }, { id: 's2', pos: 'MC', force: 60, salary: 10000 }] },
    { level: 10, division: 1, country: 'BR' }
  );
  assert(stScarce.reasons.some(r => r.key === 'scarce' && r.delta === 0.5), 'SCARCE starter harus +0.50');
  assert.strictEqual(T.lastInPosition({ id: 'only1', pos: 'PD', forSale: false }, [{ id: 'only1', pos: 'PD' }]), true, 'lastInPosition harus menolak semua posisi jika stok 1');
  const f9GateXi = {
    formation: '4-3-3',
    xi: [
      { slot: 'G', sectorCode: 'G', score: 60, player: { id: 'g1', pos: 'G', force: 60, age: 25 } },
      { slot: 'LD', sectorCode: 'D', score: 60, player: { id: 'd1', pos: 'LD', force: 60, age: 25 } },
      { slot: 'ZD', sectorCode: 'D', score: 60, player: { id: 'd2', pos: 'ZD', force: 60, age: 25 } },
      { slot: 'ZE', sectorCode: 'D', score: 60, player: { id: 'd3', pos: 'ZE', force: 60, age: 25 } },
      { slot: 'LE', sectorCode: 'D', score: 60, player: { id: 'd4', pos: 'LE', force: 60, age: 25 } },
      { slot: 'MC', sectorCode: 'M', score: 60, player: { id: 'm1', pos: 'MC', force: 60, age: 25 } },
      { slot: 'MC', sectorCode: 'M', score: 60, player: { id: 'm2', pos: 'MC', force: 60, age: 25 } },
      { slot: 'MC', sectorCode: 'M', score: 60, player: { id: 'm3', pos: 'MC', force: 60, age: 25 } },
      { slot: 'PD', sectorCode: 'A', score: 60, player: { id: 'w1', pos: 'PD', force: 60, age: 25, s1: 'PAS', s2: 'CRU' } },
      { slot: 'ATA', sectorCode: 'A', score: 60, player: { id: 'st1', pos: 'ATA', force: 60, age: 25, s1: 'PAS', s2: 'FIN' } },
      { slot: 'ATA', sectorCode: 'A', score: 60, player: { id: 'st2', pos: 'ATA', force: 60, age: 25, s1: 'FIN', s2: 'DRI' } },
    ],
  };
  const f9GateBase = T.computeEngineSectorPower(f9GateXi, '4-3-3', {});
  const f9GateWing = T.computeEngineSectorPower(f9GateXi, '4-3-3', { falseNineId: 'w1' });
  const f9GateSt = T.computeEngineSectorPower(f9GateXi, '4-3-3', { falseNineId: 'st1' });
  assert.strictEqual(f9GateWing.MID, f9GateBase.MID, 'Winger PD/PE TIDAK boleh memakai False Nine (MID harus tetap)');
  assert(f9GateSt.MID > f9GateBase.MID && f9GateSt.rawATK < f9GateBase.rawATK, 'False Nine pada ST/SS/CAM harus transfer ATK->MID');

  // Regresi v8.11.0: sellerStance (#25402) + precomputeSellerMeta zero-diff
  {
    const pTop1 = { id: 'top1', pos: 'MC', force: 70, age: 23, top: true, forSale: false, marketValue: 1000000 };
    const stPool = [pTop1, { id: 'p2', pos: 'MC', force: 60, age: 24, goals: 0 }, { id: 'p3', pos: 'ZD', force: 58, age: 25 }];
    const bigBuyFromSmall = T.sellerStance(pTop1, { level: 8, division: 2, country: 'BR', players: stPool }, { level: 14, division: 1 });
    assert(bigBuyFromSmall.reasons.some(r => r.key === 'bigBuyer'), 'Klub besar Div 1 beli dari Div 2 harus mendapat diskon bigBuyer (#25402)');
    assert.notStrictEqual(bigBuyFromSmall.refuse, 'keyPlayer', 'Klub kecil level 8 tidak boleh menolak keyPlayer ke klub level 14 Div 1');
    const smallBuyFromBig = T.sellerStance(pTop1, { level: 14, division: 1, country: 'BR', players: stPool }, { level: 10, division: 1 });
    assert.strictEqual(smallBuyFromBig.refuse, 'keyPlayer', 'Klub besar level 14 harus mengaktifkan keyPlayer buyout terhadap pembeli level 10');
    assert(smallBuyFromBig.buyout > 0, 'keyPlayer buyout harus positif');
    const sMeta = T.precomputeSellerMeta(stPool, []);
    const stanceWithMeta = T.sellerStance(pTop1, { level: 8, division: 2, country: 'BR', players: stPool, _meta: sMeta }, { level: 14, division: 1 });
    assert.deepStrictEqual(stanceWithMeta, bigBuyFromSmall, 'precomputeSellerMeta harus menghasilkan output 100% identik');
  }

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
