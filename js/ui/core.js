// ==================== STATE & HELPERS (v7.0 Exact Engine Sync) ====================
let activeTab = 't1';
let xiMode = 'best';
let warRef = 'normal';     // strict | normal | lenient
let warWeather = 'clear';  // clear | rain | heat
let simMode = 'normal';
let simCompKind = 'league';
let simPrices = { ...((D && D.stadium && D.stadium.optLigaPrices) || { geral: 12, arquibancada: 19, cadeiras: 47, camarotes: 160 }) };
let rosterSort = { col: 'force', dir: -1 };
let scoutPreset = 'ALL';
let scoutBlueprintTab = 'UPGRADE';
let cartOut = {}; // playerId -> { arab: bool }
let cartIn = {};  // playerId -> scoutRow
let cartInBosman = {}; // playerId -> bool (0€ Pra-Kontrak)

// Single Source of Truth dari js/engine/config.js via D.cfg
const CFG = D.cfg || {};
const EXACT_CAT = CFG.EXACT_CAT || {
  G:0,
  LD:1, LE:1, LAT:1,
  Z:2, ZD:2, ZE:2, ZAG:2,
  V:3, VOL:3, MC:3, MD:3, ME:3, MO:3, MA:3, MEI:3,
  PD:4, PE:4, SA:4, A:4, ATA:4
};
const SLOT_FOOT_PREF = CFG.SLOT_FOOT_PREF || { LE:'E', LD:'D' }; // Khusus Fullback/Wingback (#21882)
const POS_EN = CFG.POS_EN || {
  G:'GK', LD:'RB', LE:'LB', LAT:'FB',
  Z:'CB', ZD:'RCB', ZE:'LCB', ZAG:'CB',
  V:'DM', VOL:'CDM', MC:'CM', MD:'RM', ME:'LM',
  MO:'AM', MA:'CAM', MEI:'MID',
  PD:'RW', PE:'LW', SA:'SS', A:'ST', ATA:'ST'
};
const FOOT_EN = CFG.FOOT_EN || { D:'R', E:'L', A:'Both', B:'Both' };
const SKILL_EN = CFG.SKILL_EN || {
  FIN:'FIN', PAS:'PAS', ARM:'PLY', DES:'TAC', MAR:'MRK',
  CAB:'HEA', CRU:'CRO', DRI:'DRI', VEL:'PAC', RES:'STA',
  COL:'POS', REF:'REF', SAI:'OUT', PEN:'PEN', DPE:'PEN',
  FOR:'STR', LID:'LEA'
};
const FORM_EN = CFG.FORM_EN || {
  '4-4-2 def.':'4-4-2 Def', '4-4-2 ofe.':'4-4-2 Off',
  '4-3-3 def.':'4-3-3 Def', '4-3-3 ofe.':'4-3-3 Off',
  '4-2-3-1 Alas':'4-2-3-1 Wide'
};
const FORMATION_MODS = CFG.FORMATION_MODS || {};
const PITCH_COORDS = CFG.PITCH_COORDS || {
  G:[[50,91]],
  LE:[[12,74]], LD:[[88,74]],
  ZE:[[37,74]], ZD:[[63,74],[50,74]], ZAG:[[50,74]],
  VOL:[[50,56],[28,56],[72,56]],
  ME:[[14,44]], MD:[[86,44]],
  MC:[[50,44],[28,44],[72,44]],
  MA:[[50,30],[28,30],[72,30]],
  PE:[[16,12]], PD:[[84,12]],
  SA:[[50,26]], ATA:[[50,10],[28,10],[72,10]]
};

function fmtPos(c) { return POS_EN[c] || c || '-'; }
function fmtFoot(c) { return FOOT_EN[c] || c || '-'; }
function fmtSkill(c) { return SKILL_EN[c] || c || ''; }
function fmtSkills(s1, s2) { return [fmtSkill(s1), fmtSkill(s2)].filter(Boolean).join('/') || '-'; }
function fmtForm(fk) { return FORM_EN[fk] || fk || '-'; }
function fmtMod(v) { const n = Number(v) || 0; return n > 0 ? '+' + n : String(n); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escJs(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function fmtM(v) {
  const n = Number(v) || 0;
  const sg = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return sg + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sg + Math.round(a / 1e3) + 'K';
  return sg + Math.round(a);
}
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => el.classList.remove('show'), 2200);
}
function switchTab(t) {
  const legacy = { t1: ['t1', null], t2: ['t2', null], t3: ['t3', 't3-xi'], t4: ['t3', 't3-squad'], t5: ['t3', 't3-acad'], t6: ['t5', 't5-ov'], t7: ['t4', 't4-bp'], t8: ['t6', 't6-lg'] };
  const m = legacy[t] || [t, null];
  goToView(m[0], m[1]);
}

// ==================== EXACT v1.2.0 ENGINE MATH IN JS (SSOT via LFEngine) ====================
function priceFactorJS(m, lin, up, down) {
  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.priceFactorV9 === 'function') {
    return LFEngine.economy.priceFactorV9(m, { lin, up, down });
  }
  const d = Number(m || 1) - 1.0;
  const quad = d >= 0 ? up : down;
  const raw = Math.exp(-lin * d - quad * d * d);
  return Math.max(0.10, Math.min(1.35, raw));
}

function ticketDemandJS(m, big) {
  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.ticketDemandV9 === 'function') {
    return LFEngine.economy.ticketDemandV9(m, big);
  }
  const cm = Math.max(0.5, Math.min(2.0, m));
  const slope = big ? 0.2 : 0.7;
  return cm < 1.0 ? 1.0 + 0.4 * (1.0 - cm) : Math.max(0.25, 1.0 - slope * (cm - 1.0));
}

function getSimBasePrices(kind = simCompKind) {
  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.getBaseTicketPrices === 'function') {
    const country = (D.meta && D.meta.country) || 'OTHER';
    const repLv = (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3;
    const div = (D.meta && D.meta.division) || 1;
    const euSet = (D.cfg && D.cfg.COUNTRY_GROUPS && D.cfg.COUNTRY_GROUPS[0]) || [];
    const region = euSet.includes(String(country).toUpperCase()) ? 0 : 1;
    return LFEngine.economy.getBaseTicketPrices(div, kind || 'league', repLv, country, region);
  }
  return (D.stadium && D.stadium.basePrices) || { geral: 10, arquibancada: 15, cadeiras: 25, camarotes: 80 };
}

function simulateStadiumJS(prices, big, kind = simCompKind) {
  const k = kind || simCompKind || 'league';
  const bp = getSimBasePrices(k);
  const secs = (D.stadium && D.stadium.sections) || { geral: 6000, arquibancada: 13000, cadeiras: 900, camarotes: 100 };
  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.simulateStadiumByPricesV9 === 'function') {
    const country = (D.meta && D.meta.country) || 'OTHER';
    const euSet = (D.cfg && D.cfg.COUNTRY_GROUPS && D.cfg.COUNTRY_GROUPS[0]) || [];
    const region = euSet.includes(String(country).toUpperCase()) ? 0 : 1;
    const opts = {
      homeRepLvl: (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3,
      country,
      region,
      kind: k,
      koStage: big ? 'final' : null,
      isClassic: Boolean(big && k === 'league'),
    };
    const res = LFEngine.economy.simulateStadiumByPricesV9(
      secs, prices, (D.meta && D.meta.fanConf) || 80, (D.meta && D.meta.division) || 1,
      Boolean(big && k !== 'league'), Boolean(big), big ? 1 : 0, opts
    );
    const out = {};
    ['geral', 'arquibancada', 'cadeiras', 'camarotes'].forEach(s => {
      const bs = res.bySector[s];
      out[s] = {
        cap: bs.cap,
        bp: bs.basePrice,
        p: bs.price,
        mul: bs.mul,
        att: bs.att,
        demandRaw: bs.demandRaw,
        fillPct: bs.fillPct,
        rev: bs.rev,
      };
    });
    return {
      totAtt: res.totalAtt,
      totRev: res.totalRev,
      fillPct: res.fillPct,
      crowdFull: res.homeMidBonus,
      sectors: out,
    };
  }
  return { totAtt: 0, totRev: 0, fillPct: 0, crowdFull: false, sectors: { geral: { cap: 0, bp: bp.geral, p: bp.geral, mul: 1, att: 0, fillPct: 0, rev: 0 }, arquibancada: { cap: 0, bp: bp.arquibancada, p: bp.arquibancada, mul: 1, att: 0, fillPct: 0, rev: 0 }, cadeiras: { cap: 0, bp: bp.cadeiras, p: bp.cadeiras, mul: 1, att: 0, fillPct: 0, rev: 0 }, camarotes: { cap: 0, bp: bp.camarotes, p: bp.camarotes, mul: 1, att: 0, fillPct: 0, rev: 0 } } };
}

function optimalPricesJS(big, kind = simCompKind) {
  const k = kind || simCompKind || 'league';
  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.optimizeTicketPricesV9 === 'function') {
    const secs = (D.stadium && D.stadium.sections) || { geral: 6000, arquibancada: 13000, cadeiras: 900, camarotes: 100 };
    const country = (D.meta && D.meta.country) || 'OTHER';
    const euSet = (D.cfg && D.cfg.COUNTRY_GROUPS && D.cfg.COUNTRY_GROUPS[0]) || [];
    const region = euSet.includes(String(country).toUpperCase()) ? 0 : 1;
    const opts = {
      homeRepLvl: (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3,
      country,
      region,
      kind: k,
      koStage: big ? 'final' : null,
      isClassic: Boolean(big && k === 'league'),
    };
    const opt = LFEngine.economy.optimizeTicketPricesV9(
      secs, (D.meta && D.meta.fanConf) || 80, (D.meta && D.meta.division) || 1,
      Boolean(big && k !== 'league'), Boolean(big), big ? 1 : 0, 70.5, opts
    );
    return { ...opt.prices };
  }
  return { ...((D.stadium && (big ? D.stadium.optBigPrices : D.stadium.optLigaPrices)) || { geral: 12, arquibancada: 21, cadeiras: 48, camarotes: 160 }) };
}

function slotScoreJS(p, sl, rotMode, ruleId = null) {
  if (window.LFEngine && LFEngine.tactics && typeof LFEngine.tactics.evalPlayerForSlot === 'function') {
    const repLv = (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3;
    const ev = LFEngine.tactics.evalPlayerForSlot(p, sl, true, repLv, ruleId);
    let pickScore = ev.score;
    if (rotMode && sl !== 'G') {
      pickScore += ((p.energy ?? 100) - 80) * 0.35;
      if (p.moodTier === 1 && (p.minPct ?? 100) < 12.0) pickScore += 4.5;
      else if (p.mood === 'unhappy' || p.mood === 'warn') pickScore += 3.0;
      if ((p.potCap - p.force) >= 6 && p.age <= 22) pickScore += 2.0;
    }
    return { score: ev.score, pickScore, wf: ev.wrongFoot };
  }
  return { score: p.force || 0, pickScore: p.force || 0, wf: false };
}

function solveBestXiJS(formKey, rotMode) {
  const fk = (D.formations && formKey in D.formations) ? formKey : ((D.meta && D.meta.activeFormation) || '4-3-3');
  if (window.LFEngine && LFEngine.tactics && typeof LFEngine.tactics.solveBestXi === 'function') {
    const repLv = (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3;
    const res = LFEngine.tactics.solveBestXi(
      D.roster || [], fk, (D.meta && D.meta.foreignCap) || 7,
      (D.meta && D.meta.country) || '', null, Boolean(rotMode), repLv
    );
    const xi = (res.xi || []).map(a => ({
      slot: a.slot,
      ruleId: a.ruleId,
      sectorCode: a.sectorCode,
      wildcard: a.wildcard,
      droppedByBug: a.droppedByBug,
      p: a.player,
      score: a.score,
      pickScore: a.score,
      wf: a.wrongFoot,
    }));
    return {
      xi,
      bench: res.bench || [],
      tot: res.totalScore,
      avg: res.avgScore,
      fCnt: res.foreignCount,
      wfCnt: res.wrongFootCount,
      falseNine: res.falseNine,
      chemistry: res.chemistry,
      chemMul: res.chemMul,
      sectors: res.sectors,
      engineSectors: res.engineSectors,
      hasFormationBug: res.hasFormationBug,
      formationBugInfo: res.formationBugInfo,
      setPieces: res.setPieces,
      f9Players: [],
    };
  }
  return { xi: [], bench: [], tot: 0, avg: 0, fCnt: 0, wfCnt: 0, falseNine: false, chemistry: 100, f9Players: [] };
}

// ==================== KAMUS ISTILAH & TOOLTIP OTOMATIS (v7.1) ====================
const BADGE_TIPS = {
  BOSMAN: 'Kontrak tersisa ≤180 hari (≤6 bulan) — bisa direkrut GRATIS (biaya transfer 0) via Pra-Kontrak saat kontraknya habis!',
  UNH: 'Pemain tidak bahagia (Unhappy) di klub AI — diskon harga beli -15% dan tuntutan gaji dipotong -50%!',
  FREE: 'Free Agent (tanpa klub) — gratis biaya transfer. Catatan: terkunci tidak bisa Sell Now selama 1 tahun.',
  SALE: 'Pemain masuk daftar jual (For Sale) oleh klub AI — harga lebih murah sekitar -10%.',
  LOAN: 'Tersedia untuk dipinjam (Loanable) oleh klub AI.',
  SCARCE: 'Klub AI kekurangan stok di posisi ini (≤2 pemain) — harga jual dinaikkan +15%, sebaiknya hindari!',
  TRAP: 'Jebakan Potensi: Potential tampilan jauh lebih tinggi daripada PotCap asli (≥4 poin) — pertumbuhannya bakal mentok lebih cepat!',
  GEM: 'Hidden Gem / Permata Tersembunyi: PotCap asli lebih tinggi dari tampilan atau punya ruang tumbuh sangat besar.',
  GOD: 'Kombinasi Skill Stack kelas atas (efek kedua skill menumpuk penuh di Match Engine).',
  LOCAL: 'Pemain domestik (satu negara dengan klubmu) — tidak memakan kuota pemain asing & adaptasi 2x lebih cepat!',
  INJ: 'Pemain sedang cedera.',
  F9: 'False Nine aktif: ≥2 penyerang (ST/SS) di XI punya skill PAS/PLY — memberi bonus kreativitas serangan.',
  SLUMP: 'Fine Slump: penurunan performa (-3% per denda, maks -20%) selama 30 hari karena denda kartu merah >20%.',
  NONSTACK: 'Skill tidak menumpuk (TCK+MRK di bek cuma +5% sekali; PAS+PLY di gelandang cuma +3% sekali).',
  ARAB: 'Arab Watch: pemain Top-5 skuad usia ≥26 thn punya peluang 10% ditawar klub Arab 2.5x–3.0x Market Value!',
  GOLDEN: 'Golden Window (60–120 hari, syarat >=60 hari di #24161): perpanjang kontrak 3 tahun di jendela ini untuk potong gaji -12% GRATIS! Di 11–59 hari mereka justru minta naik +5–15%.',
  LOOPHOLE: 'Loophole Auto-Renew 0%: nyalakan Auto-Renew sementara untuk pemain inti ≤10 hari agar diperpanjang +180 hari dengan gaji lama (0% naik).',
  SWAP: 'Rekomendasi tukar beli target + jual pemain skuad lama (hitung net kas, selisih gaji & upgrade performa Eff).',
  FLIP: 'Strategi beli pemain muda (17–21 thn) murah, latih 1–2 musim, lalu jual mahal (+40% counter) untuk cetak kas!',
  REFUSEDIST: 'Menolak Pindah (#24060 refusesDistance): pemain dari liga Eropa / benua lain tanpa afiliasi menolak pindah ke level liga klubmu.',
  REFUSELVL: 'Menolak Turun Kasta (#24062 clubLevelLow): selisih level klub terlalu jauh (≥3 level untuk usia <29 thn, atau ≥2 level untuk bintang <28 thn).',
  PERSUADE: 'Bisa Dibujuk (#24064 buyPersuadable): awalnya menolak, tapi mau pindah jika ditawar >=1.5x Market Value (+2 slack level & +4 plafon Force).',
  CEIL2X: 'Di Atas Plafon Force (#24059 buyerForceCeiling): membutuhkan tawaran 2.0x Market Value (maks +5 di atas plafon).',
  KEYLOCK: 'Dikunci Klub AI (#24136/#24715): pemain Top/Star atau Top-3 Force klub AI yang tidak unhappy — otomatis diperpanjang sebelum Bosman.',
  YSCOUT: 'Olheiro da Base (#24197): U-21 berpotensi besar (potential - force >=10) yang bisa dibajak instan seharga 2.0x MV (kuota 2/musim; diskon 0.75x di CT Lv 3+).',
  INJDISC: 'Diskon Cedera (#3724 INJURED_SALE): harga pasar sedang terpotong -30% (≤10d), -45% (≤30d), -60% (≤60d), atau -75% (>60d) karena cedera.',
  BUG343: 'Bug Engine v1.2.0 (#34992): slot ke-11 pada formasi 3-4-3 memakai rule 18 yang jatuh ke sektor X (ATK hilang -33%)!'
};
function tipFor(code) {
  const k = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return BADGE_TIPS[k] || '';
}
function openGlossary() {
  const el = document.getElementById('glossary-modal');
  if (el) el.classList.add('open');
}
function closeGlossary() {
  const el = document.getElementById('glossary-modal');
  if (el) el.classList.remove('open');
}

// ==================== NAVIGASI 6-TAB + SUB-TAB, DENSITY & CLIPBOARD (v8.0) ====================
let activeSubTabs = { t3: 't3-xi', t4: 't4-bp', t5: 't5-ov', t6: 't6-lg' };
let activeMatchIdx = 0;

function goToView(tab, sub) {
  const validTabs = ['t1', 't2', 't3', 't4', 't5', 't6'];
  const t = validTabs.includes(tab) ? tab : 't1';
  activeTab = t;
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + t));
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === t));

  const targetSub = sub || activeSubTabs[t];
  if (targetSub) {
    activeSubTabs[t] = targetSub;
    const bar = document.querySelector(`.subtabs[data-group="${t}"]`);
    if (bar) {
      bar.querySelectorAll('.subtab').forEach(b => b.classList.toggle('active', b.dataset.sub === targetSub));
    }
    const panel = document.getElementById('panel-' + t);
    if (panel) {
      panel.querySelectorAll('.subpanel').forEach(sp => sp.classList.toggle('active', sp.id === 'sub-' + targetSub));
    }
  }
  if (t === 't2' && typeof renderTab2 === 'function') {
    const am = document.getElementById('t2-active-match');
    if (!am || !am.innerHTML.trim()) { try { renderTab2(); } catch (e) { console.error(e); } }
  }
  if (typeof renderStickyCartBar === 'function') renderStickyCartBar();
  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
    window.scrollTo(0, 0);
  }
  try {
    localStorage.setItem('lf_opt_v8_nav', JSON.stringify({ tab: activeTab, subs: activeSubTabs }));
  } catch {}
}

function restoreLastView() {
  try {
    const raw = JSON.parse(localStorage.getItem('lf_opt_v8_nav') || 'null');
    if (raw && raw.tab) {
      if (raw.subs && typeof raw.subs === 'object') activeSubTabs = { ...activeSubTabs, ...raw.subs };
      goToView(raw.tab, activeSubTabs[raw.tab]);
    }
    const dens = localStorage.getItem('lf_opt_v8_density');
    if (dens === 'compact') {
      document.body.classList.add('compact');
      const bd = document.getElementById('btn-density');
      if (bd) bd.textContent = '↕️ Mode: Kompak';
    }
  } catch {}
}

function toggleDensity() {
  const isC = document.body.classList.toggle('compact');
  const bd = document.getElementById('btn-density');
  if (bd) bd.textContent = isC ? '↕️ Mode: Kompak' : '↕️ Mode: Lega';
  try { localStorage.setItem('lf_opt_v8_density', isC ? 'compact' : 'cozy'); } catch {}
}

function copyText(txt, label) {
  const done = () => showToast((label || 'Disalin') + ': ' + txt);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  } else {
    fallbackCopy(txt, done);
  }
}

function fallbackCopy(txt, cb) {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (cb) cb();
  } catch {}
}

function formatPresTarget(kind, t) {
  const n = Number(t) || 1;
  if (n === 1) return 'Juara (#1)';
  if (kind === 'league') return 'Top ' + n;
  if (n === 2) return 'Finalis (Top 2)';
  if (n === 4) return 'Semifinalis (Top 4)';
  if (n === 8) return 'Perempat Final (Top 8)';
  return 'Top ' + n;
}

function computeTitleStatus() {
  const st = D.standings || [];
  if (st.length < 2) return null;
  const nClubs = st.length;
  const totalRounds = (nClubs - 1) * 2;
  const user = st.find(s => s.isUser);
  if (!user) return null;
  const leader = st[0];
  const second = st[1];
  const remUser = Math.max(0, totalRounds - user.p);
  const remSecond = Math.max(0, totalRounds - second.p);

  if (user.pos === 1) {
    const lead = user.pts - second.pts;
    const maxSec = second.pts + remSecond * 3;
    // Edge Case Akhir Musim (0 laga tersisa)
    if (remSecond === 0 && (remUser === 0 || user.pts > second.pts || (user.pts === second.pts && user.gd >= second.gd))) {
      const tieMsg = lead > 0
        ? `Unggul ${lead} poin atas ${second.name}`
        : `Unggul selisih gol (${user.gd >= 0 ? '+' : ''}${user.gd}) atas ${second.name}`;
      return {
        userPos: 1, totalRounds, remUser, lead, secondName: second.name,
        clinched: true, needPts: 0,
        text: `🏆 JUARA LIGA! Musim selesai • ${tieMsg}.`
      };
    }
    if (user.pts > maxSec) {
      return {
        userPos: 1, totalRounds, remUser, lead, secondName: second.name,
        clinched: true, needPts: 0,
        text: `🏆 JUARA SECARA MATEMATIS! Unggul ${lead} poin atas ${second.name} di sisa ${remSecond} pekan.`
      };
    }
    const need = Math.max(1, maxSec - user.pts + 1);
    return {
      userPos: 1, totalRounds, remUser, lead, secondName: second.name,
      clinched: false, needPts: need,
      text: `🥇 Peringkat #1 (+${lead} poin dari ${second.name}). Butuh ${need} poin lagi dari sisa ${remUser} laga untuk kunci gelar!`
    };
  }

  const behind = leader.pts - user.pts;
  return {
    userPos: user.pos, totalRounds, remUser, lead: -behind, secondName: leader.name,
    clinched: false, needPts: null,
    text: remUser === 0
      ? `🏁 Musim selesai di Peringkat #${user.pos} (${user.pts} poin, selisih ${behind} poin dari juara ${leader.name}).`
      : `Peringkat #${user.pos} (${user.pts} poin, selisih ${behind} poin dari pemuncak ${leader.name} di sisa ${remUser} pekan).`
  };
}

function openSquadWithFilter(fltVal) {
  const inp = document.getElementById('t4-search');
  const sel = document.getElementById('t4-filter');
  if (inp) inp.value = '';
  if (sel) sel.value = fltVal || 'ALL';
  if (typeof renderRosterTable === 'function') renderRosterTable();
  goToView('t3', 't3-squad');
}

function openWarRoomOfficial(idx) {
  if (typeof warSimMode !== 'undefined') warSimMode = false;
  activeMatchIdx = Number(idx) || 0;
  if (typeof renderTab2 === 'function') renderTab2();
  goToView('t2');
}// ==================== PLAYER DRAWER (v8.0 TAHAP 2) ====================
let activeDrawer = null; // { kind: 'roster'|'youth'|'scout', id: string }

function closePlayerDrawer() {
  activeDrawer = null;
  const bg = document.getElementById('player-drawer-bg');
  if (bg) bg.classList.remove('open');
}

function energyPillHtml(en) {
  const v = Number(en ?? 100);
  const cls = v >= 95 ? 'en-hi' : (v >= 85 ? 'en-md' : (v >= 70 ? 'en-lo' : 'en-cr'));
  return `<span class="en-pill mono ${cls}">${v}%</span>`;
}

function growthBarHtml(gf, nearDrop) {
  const v = Number(gf) || 0;
  const isNeg = v < 0;
  const pct = Math.min(100, Math.round((Math.abs(v) / (isNeg ? 0.97 : 1.0)) * 100));
  const color = isNeg ? 'var(--red)' : 'var(--green)';
  const txtCls = isNeg ? 'c-red' : 'c-green';
  return `<div class="mini-bar-wrap" title="Progress menuju ${isNeg ? '-1 Force (di -0.97)' : '+1 Force (di +1.00)'}">
    <div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="mono ${txtCls}" style="font-size:11px;min-width:44px;text-align:right">${v >= 0 ? '+' : ''}${v.toFixed(2)}${nearDrop ? '⚠' : ''}</span>
  </div>`;
}

function minutesQuotaBarHtml(minPct, reqPct, mood) {
  const v = Math.min(100, Math.max(0, Number(minPct) || 0));
  const req = Math.min(100, Math.max(0, Number(reqPct) || 0));
  const color = mood === 'unhappy' ? 'var(--red)' : (mood === 'happy' ? 'var(--green)' : 'var(--sky)');
  return `<div class="mini-bar-wrap" title="Menit main ${v}% vs ambang minimal ${req}%">
    <div class="mini-bar-bg">
      <div class="mini-bar-fill" style="width:${v}%;background:${color}"></div>
      ${req > 0 ? `<div class="mini-bar-mark" style="left:${req}%"></div>` : ''}
    </div>
    <span class="mono" style="font-size:11px;min-width:42px;text-align:right">${v}%</span>
  </div>`;
}

function openPlayerDrawer(kind, id) {
  const bg = document.getElementById('player-drawer-bg');
  const body = document.getElementById('player-drawer-body');
  if (!bg || !body) return;
  activeDrawer = { kind, id };

  if (kind === 'roster') {
    const p = (D.roster || []).find(x => x.id === id);
    if (!p) return;
    const potSpan = Math.max(1, p.potCap - 20);
    const curFill = Math.min(100, Math.max(10, Math.round(((p.force - 20) / potSpan) * 100)));
    const gap = Math.max(0, p.potCap - p.force);
    const inSell = !!cartOut[p.id];
    const inXi = (D.bestXi && D.bestXi.xi || []).some(a => a.id === p.id);
    const toGolden = p.contractDays > 120 ? (p.contractDays - 120) : 0;
    const actB = { crit: 'b-crit', warn: 'b-warn', good: 'b-good', accent: 'b-accent', info: 'b-info', muted: 'b-muted' }[p.actionCls] || 'b-muted';
    const cardsList = Object.entries(p.cardsByComp || {})
      .filter(([, v]) => v && ((v.y || 0) > 0 || (v.s || 0) > 0))
      .map(([cid, v]) => `${(window.LFEngine && LFEngine.utils ? LFEngine.utils.translateCompName(cid, cid) : cid)}: ${v.y || 0}🟨${v.s ? ' ' + v.s + '🟥' : ''}`);

    body.innerHTML = `
      <div class="flex-between mb-8">
        <div>
          <span class="badge b-good">SKUAD SENIOR • RANK #${p.squadRank}</span>
          ${inXi ? '<span class="badge b-info">BEST XI</span>' : '<span class="badge b-muted">CADANGAN</span>'}
          ${p.isTop5Arab ? '<span class="badge b-accent">ARAB WATCH</span>' : ''}
        </div>
        <button class="btn btn-sm" onclick="closePlayerDrawer()">Tutup (ESC)</button>
      </div>
      <div style="font-size:19px;font-weight:900;margin-bottom:3px">
        ${esc(p.name)} ${p.top ? '👑' : (p.star ? '⭐' : '')}
      </div>
      <div class="c-muted" style="font-size:12px;margin-bottom:10px">
        <b>${fmtPos(p.pos)}</b> • ${p.age} thn (mulai turun @${p.declineAge}) • Kaki <b>${fmtFoot(p.foot)}</b> • ${esc(p.nationality || '-')}
      </div>
      <div class="pill-row">
        <span class="badge ${actB}">${esc(p.action)}</span>
        ${p.injured ? `<span class="badge b-crit">🏥 Cedera ${p.injuryDays}d</span>` : ''}
        ${p.fineSlump > 0 ? `<span class="badge b-crit">SLUMP -${p.fineSlumpPct}% (${p.fineSlumpDays}d)</span>` : ''}
        ${p.isTrap ? `<span class="badge b-crit" title="${esc(tipFor('TRAP'))}">TRAP</span>` : ''}
        ${p.isGem ? `<span class="badge b-good" title="${esc(tipFor('GEM'))}">GEM</span>` : ''}
      </div>

      <div class="drawer-sec">
        <h3>📊 Kekuatan, PotCap &amp; Pertumbuhan</h3>
        <div class="drawer-kv"><span>Force → PotCap (Plafon Asli)</span><b class="mono"><span style="font-size:15px">${p.force}</span> → <span class="c-green">${p.potCap}</span> <span class="c-muted">(+${gap} ruang)</span></b></div>
        <div class="mini-bar-bg" style="height:9px;margin:5px 0 8px"><div class="mini-bar-fill" style="width:${curFill}%;background:linear-gradient(90deg,var(--sky),var(--green))"></div></div>
        <div class="drawer-kv"><span>Tampilan Potential UI</span><span class="mono">${p.potential} ${p.isTrap ? '<b class="c-red">(lebih tinggi dr asli!)</b>' : ''}</span></div>
        <div class="drawer-kv"><span>Progress GrowthFrac</span>${growthBarHtml(p.growthFrac, p.nearDrop)}</div>
        ${(() => {
          const ta = D.trainAudit || {};
          const inTr = (ta.currentIds || []).includes(p.id);
          const recIdx = (ta.ideal || []).findIndex(x => x.id === p.id || x.name === p.name);
          if (inTr && (p.force >= p.potCap || p.age >= p.declineAge)) {
            return '<div class="drawer-kv"><span>Special Training</span><span class="badge b-crit">⚠ MENTOK POTCAP — KELUARKAN!</span></div>';
          }
          if (inTr) {
            return '<div class="drawer-kv"><span>Special Training</span><span class="badge b-good">🏋️ Aktif di Slot Training</span></div>';
          }
          if (recIdx >= 0 && recIdx < (ta.slots || 4)) {
            return `<div class="drawer-kv"><span>Special Training</span><span class="badge b-info">✨ Rekomendasi Masuk (#${recIdx + 1})</span></div>`;
          }
          return '';
        })()}
        <div class="drawer-kv"><span>Skill &amp; Stacking</span><span class="badge ${p.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct}%)</span></div>
        <div class="c-muted" style="font-size:11px;margin-top:4px">${esc(p.stackNote)}</div>
      </div>

      <div class="drawer-sec">
        <h3>⚡ Kondisi, Chemistry &amp; Ruang Ganti (#21546 / #21995)</h3>
        <div class="drawer-kv"><span>Energi / Stamina</span>${energyPillHtml(p.energy)}</div>
        <div class="drawer-kv"><span>Chemistry Integrasi &amp; Ritme</span><span class="mono">Integrasi <b class="c-green">${p.integration ?? 100}%</b> • Ritme 3 Laga <b>${Math.round((p.rhythm ?? 1) * 100)}%</b> <span class="c-muted">(rx=${p.rx ?? 7})</span></span></div>
        <div class="drawer-kv"><span>Statistik Musim Ini</span><span class="mono"><b>${p.gamesPlayed}</b> laga (${p.seasonMinutes || 0} mnt) • <b>${p.goals}</b> gol • <b>${p.assists}</b> asis • Avg <b>${p.avgRating}</b></span></div>
        <div class="drawer-kv"><span>Mood &amp; Role v9</span><span class="badge ${p.mood === 'unhappy' ? 'b-crit' : (p.mood === 'warn' ? 'b-warn' : 'b-info')}">${p.mood.toUpperCase()} · ${esc(p.moodReason)}</span></div>
        <div class="drawer-kv"><span>Menit Main (Target ${p.reqPct}%)</span>${minutesQuotaBarHtml(p.minPct, p.reqPct, p.mood)}</div>
        ${(p.minsDeficit > 0 && !p.moodImmune) ? `<div class="drawer-kv"><span>Defisit Menit Main</span><b class="mono c-amber">Kurang ${p.minsDeficit} mnt (~${p.gamesDeficit} laga penuh)</b></div>` : ''}
        ${cardsList.length ? `<div class="drawer-kv"><span>Kartu Aktif</span><span class="mono c-amber">${esc(cardsList.join(' · '))}</span></div>` : ''}
      </div>

      <div class="drawer-sec">
        <h3>💰 Kontrak, Salary Cut &amp; Nilai Jual (#3723 / #24161)</h3>
        <div class="drawer-kv"><span>Sisa Kontrak</span><b class="mono ${p.contractDays <= 10 ? 'c-red' : (p.contractDays < 60 ? 'c-amber' : (p.contractDays <= 120 ? 'c-green' : ''))}">${p.contractDays} hari</b></div>
        <div class="drawer-kv"><span>Status Diskon 3Th (-12%, ≥60d)</span><span class="mono">${p.contractDays <= 10 ? '<b class="c-red">Zona Jebakan — pakai Loophole 0%!</b>' : (p.contractDays < 60 ? '<b class="c-amber">Minta Naik +5–15% (Tunggu ≤10d Loophole)</b>' : (p.contractDays <= 120 ? '<b class="c-green">GOLDEN WINDOW AKTIF (-12% gaji!)</b>' : `Bisa diskon -12% (Golden dalam ~${toGolden}d)`))}</span></div>
        <div class="drawer-kv"><span>Gaji Bulanan (Lantai ${Math.round((p.salaryFloorFactor || 0.90) * 100)}%)</span><b class="mono">${fmtM(p.salary)}/bln</b></div>
        <div class="drawer-kv"><span>Kuota Potong Gaji (salaryCuts)</span><span class="mono ${p.salaryCutLocked ? 'c-red' : 'c-green'}"><b>${p.salaryCuts || 0}/1</b> dipakai ${p.salaryCutLocked ? '(TERKUNCI — maks 1x potong di #24159!)' : '(Masih bisa negosiasi potong 1x)'}</span></div>
        ${p.benchCutSave ? `<div class="drawer-kv"><span>Trik Bangku Cadangan (#24160)</span><b class="mono c-sky">Cadangan -12% floor → Hemat -${fmtM(p.benchCutSave)}/bln</b></div>` : ''}
        <div class="drawer-kv"><span>Market Value</span><span class="mono">${fmtM(p.marketValue)} ${p.injured ? `<b class="c-red">(Diskon cedera ${Math.round((p.injurySaleMul || 1) * 100)}%)</b>` : ''}</span></div>
        <div class="drawer-kv"><span>Jual Langsung vs Counter +40%</span><b class="mono c-green">Net ${fmtM(p.estDirectSaleNet)} <span class="c-muted">· Ctr +39%: ${fmtM(p.estCounter39)} · +40%: ${fmtM(p.estCounter40)}</span></b></div>
        <div class="drawer-kv"><span>Biaya Putus Kontrak (${Math.round((p.termFeeRate || 0.5) * 100)}%)</span><span class="mono c-red">-${fmtM(p.estTerminationCost || 0)}</span></div>
        ${p.isTop5Arab ? `<div class="drawer-kv"><span>Potensi Jackpot Arab (2.5x–3.0x × 1.39x)</span><b class="mono c-purple">${fmtM(p.estArabLow)} – ${fmtM(p.estArabHigh)}</b></div>` : ''}
      </div>

      <div class="pill-row mt-12">
        <button class="btn ${inSell ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartOut('${escJs(p.id)}');openPlayerDrawer('roster','${escJs(p.id)}')">
          ${inSell ? '✓ Sudah di Cart Jual (Lepas)' : '📤 Masukkan ke Cart Jual'}
        </button>
        <button class="btn" onclick="closePlayerDrawer();goToView('t4','t4-cart')">🛒 Buka Cart</button>
      </div>`;
  } else if (kind === 'youth') {
    const y = (D.youth || []).find(x => x.id === id);
    if (!y) return;
    body.innerHTML = `
      <div class="flex-between mb-8">
        <div>
          <span class="badge b-accent">AKADEMI (YOUTH)</span>
          ${y.fillsHole ? '<span class="badge b-good">✓ TAMBAL LUBANG</span>' : ''}
        </div>
        <button class="btn btn-sm" onclick="closePlayerDrawer()">Tutup (ESC)</button>
      </div>
      <div style="font-size:19px;font-weight:900;margin-bottom:3px">${esc(y.name)}</div>
      <div class="c-muted" style="font-size:12px;margin-bottom:10px">
        <b>${fmtPos(y.pos)}</b> • ${y.age} thn • Kaki <b>${fmtFoot(y.foot)}</b> • Bintang <b class="c-amber">★${y.hash}</b>
      </div>
      <div class="pill-row"><span class="badge ${y.action.includes('PROMO') ? 'b-good' : 'b-info'}">${esc(y.action)}</span></div>
      <div class="drawer-sec">
        <h3>🌱 Progres Akademi</h3>
        <div class="drawer-kv"><span>Force Saat Ini</span><b class="mono">${y.force}</b></div>
        <div class="drawer-kv"><span>Development</span><b class="mono c-green">${y.development}%</b></div>
        <div class="mini-bar-bg" style="height:9px;margin:4px 0 8px"><div class="mini-bar-fill" style="width:${Math.min(100, y.development)}%;background:var(--green)"></div></div>
        <div class="drawer-kv"><span>Bonus Tembus Plafon Klub (v9)</span><b class="mono c-sky">${y.ceilBonus ? '+' + y.ceilBonus + ' PotCap' : 'Belum (butuh ★7+ & Dev ≥60)'}</b></div>
        <div class="drawer-kv"><span>Est. Tawaran Mega Eropa (#23886)</span><b class="mono ${y.isMegaProspect ? 'c-green' : 'c-muted'}">${fmtM(y.estMegaOffer || 0)} ${y.isMegaProspect ? '🔥 (Prospek ★9+)' : ''}</b></div>
        <div class="drawer-kv"><span>Skill &amp; Stacking</span><span class="badge ${y.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(y.s1, y.s2)} (+${y.stackPct}%)</span></div>
        <div class="drawer-kv"><span>Skor Pipeline Akademi</span><b class="mono">${y.pipeScore}</b></div>
      </div>
      <div class="c-muted mt-12" style="font-size:11px">Catatan engine: Pemain akademi berhenti berkembang pada usia 20 tahun. Jika ★≥5 dan Dev ≥90 atau usia 20, promosikan untuk menambal skuad atau dijadikan aset flip.</div>`;
  } else if (kind === 'scout') {
    const r = (D.scoutPool || []).find(x => x[19] === id);
    if (!r) return;
    const cm = typeof getCartMetrics === 'function' ? getCartMetrics() : { projBudget: D.meta.budget, projForeign: 0 };
    const it = typeof enrichScoutRow === 'function' ? enrichScoutRow(r, cm) : null;
    const sw = it ? it.swap : null;
    const inC = !!cartIn[r[19]];
    const flags = (r[18] ? r[18].split(',') : []);
    const pidJs = escJs(r[19]);
    const repIdJs = sw ? escJs(sw.p.id) : '';
    body.innerHTML = `
      <div class="flex-between mb-8">
        <div>
          <span class="badge b-info">TARGET AUTO-SCOUT</span>
          ${it && it.fillsHole ? '<span class="badge b-warn">★ ISI LUBANG</span>' : ''}
        </div>
        <button class="btn btn-sm" onclick="closePlayerDrawer()">Tutup (ESC)</button>
      </div>
      <div style="font-size:19px;font-weight:900;margin-bottom:3px">${esc(r[0])} ${r[20] === 2 ? '👑' : (r[20] === 1 ? '⭐' : '')}</div>
      <div class="c-muted" style="font-size:12px;margin-bottom:8px">
        <b>${fmtPos(r[1])}</b> • ${r[2]} thn • Kaki <b>${fmtFoot(r[3])}</b> • ${esc(r[4])} • <b>${esc(r[16])}</b>
      </div>
      <div class="pill-row">
        ${flags.map(f => `<span class="badge ${f === 'SCARCE' || f === 'TRAP' || f === 'INJ' ? 'b-crit' : (f === 'FREE' || f === 'BOSMAN' || f === 'UNH' || f === 'GEM' ? 'b-good' : 'b-info')}" title="${esc(tipFor(f))}">${f}</span>`).join('')}
      </div>
      <div class="drawer-sec">
        <h3>🔎 Profil &amp; Potensi</h3>
        <div class="drawer-kv"><span>Force → PotCap Asli</span><b class="mono">${r[5]} → <span class="c-green">${r[7]}</span> <span class="c-muted">(UI Pot: ${r[6]})</span></b></div>
        <div class="drawer-kv"><span>Skill &amp; Stacking</span><span class="badge ${r[11] ? 'b-crit' : 'b-good'}">${fmtSkills(r[8], r[9])} (+${r[10]}%)</span></div>
        <div class="drawer-kv"><span>Sisa Kontrak</span><b class="mono ${r[15] <= 180 ? 'c-green' : ''}">${r[15]} hari ${r[15] <= 180 ? '(BOSMAN 0€!)' : ''}</b></div>
      </div>
      <div class="drawer-sec">
        <h3>💸 Estimasi Harga &amp; Flip ROI</h3>
        <div class="drawer-kv"><span>Market Value</span><span class="mono">${fmtM(r[13])}</span></div>
        <div class="drawer-kv"><span>Estimasi Beli Riil</span><b class="mono c-amber">${fmtM(r[14])}</b></div>
        <div class="drawer-kv"><span>Gaji Kontrak 3 Tahun (-5%)</span><b class="mono">${fmtM(Math.round(r[12] * 0.95))}/bln</b></div>
        ${it ? `
        <div class="drawer-kv"><span>Proyeksi Jual (1–2 Musim)</span><b class="mono c-green">${fmtM(it.estResale)} (+${it.projGain}F)</b></div>
        <div class="drawer-kv"><span>Est. Profit &amp; ROI</span><b class="mono ${it.estProfit > 0 ? 'c-green' : 'c-muted'}">${it.estProfit >= 0 ? '+' : ''}${fmtM(it.estProfit)} (${it.roiPct}%)</b></div>` : ''}
      </div>
      ${sw ? `<div class="drawer-sec">
        <h3>⇄ Cocok Menggantikan</h3>
        <div class="drawer-kv"><span>Pemain Skuad</span><b>${esc(sw.p.name)} (${fmtPos(sw.p.pos)} ${sw.p.age}th • F${sw.p.force})</b></div>
        <div class="drawer-kv"><span>Upgrade Performa (ΔEff)</span><b class="mono ${sw.deltaEff >= 0 ? 'c-green' : 'c-amber'}">${sw.deltaEff >= 0 ? '+' : ''}${sw.deltaEff}</b></div>
        <div class="drawer-kv"><span>Net Kas (Beli - Jual)</span><b class="mono">${sw.netCost <= 0 ? '+' + fmtM(-sw.netCost) : '-' + fmtM(sw.netCost)}</b></div>
        <div class="c-muted" style="font-size:11px;margin-top:4px">${esc(sw.reason)}</div>
      </div>` : ''}
      <div class="pill-row mt-12">
        <button class="star-btn ${isShortlisted(r[19]) ? 'pinned' : ''}" style="padding:7px 11px;font-size:13px" onclick="toggleShortlist('${pidJs}')">${isShortlisted(r[19]) ? '★ Shortlisted' : '☆ Shortlist'}</button>
        <button class="btn ${inC ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartIn('${pidJs}', ${r[15] <= 180 ? 'true' : 'false'});openPlayerDrawer('scout','${pidJs}')">${inC ? (cartInBosman[r[19]] ? '✓ Bosman 0€' : '✓ Di Cart Beli') : (r[15] <= 180 ? '🆓 + Bosman 0€' : '+ Beli Saja')}</button>
        ${sw ? `<button class="btn" style="flex:1;border-color:rgba(56,189,248,.6)" onclick="swapToCart('${pidJs}','${repIdJs}');openPlayerDrawer('scout','${pidJs}')">⇄ Swap</button>` : ''}
      </div>`;
  }
  bg.classList.add('open');
}

// ==================== SHORTLIST PERSISTEN & STICKY CART BAR (v8.0 TAHAP 3) ====================
function getShortlistKey() { return 'lf_opt_v8_shortlist_' + (D.meta && D.meta.userId ? D.meta.userId : 'club'); }

function loadShortlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(getShortlistKey()) || '{}');
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  } catch { return {}; }
}

let shortlistMap = loadShortlist();

function saveShortlist() {
  try { localStorage.setItem(getShortlistKey(), JSON.stringify(shortlistMap)); } catch {}
}

function isShortlisted(pid) { return Boolean(shortlistMap[pid]); }

function toggleShortlist(pid) {
  if (!pid) return;
  if (shortlistMap[pid]) {
    const nm = shortlistMap[pid].name || 'Target';
    delete shortlistMap[pid];
    showToast('Dihapus dari Shortlist: ' + nm);
  } else {
    const r = (D.scoutPool || []).find(x => x[19] === pid);
    shortlistMap[pid] = {
      id: pid,
      name: r ? r[0] : pid,
      pos: r ? r[1] : '',
      club: r ? r[16] : '',
      savedAt: D.meta ? D.meta.currentDate : '',
      savedPrice: r ? r[14] : 0,
      savedForce: r ? r[5] : 0,
      wasBosman: r ? (String(r[18] || '').includes('BOSMAN') || Number(r[15]) <= 180) : false,
      wasUnh: r ? String(r[18] || '').includes('UNH') : false,
    };
    showToast('⭐ Disimpan ke Shortlist: ' + shortlistMap[pid].name);
  }
  saveShortlist();
  if (typeof renderTab7All === 'function') renderTab7All();
  if (activeDrawer && activeDrawer.kind === 'scout' && activeDrawer.id === pid) {
    openPlayerDrawer('scout', pid);
  }
}

function clearShortlist() {
  shortlistMap = {};
  saveShortlist();
  if (typeof renderTab7All === 'function') renderTab7All();
  showToast('Shortlist dikosongkan');
}

function renderStickyCartBar() {
  const bar = document.getElementById('sticky-cart-bar');
  if (!bar || typeof getCartMetrics !== 'function') return;
  const outCnt = Object.keys(cartOut || {}).length;
  const inCnt = Object.keys(cartIn || {}).length;
  const onCartSubtab = (activeTab === 't4' && activeSubTabs && activeSubTabs.t4 === 't4-cart');
  if ((outCnt === 0 && inCnt === 0) || onCartSubtab) {
    bar.classList.remove('open');
    return;
  }
  const cm = getCartMetrics();
  const sCls = cm.projBudget >= 0 ? 'c-green' : 'c-red';
  const fCls = cm.projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky';
  bar.classList.add('open');
  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px">
      <span class="badge b-good">🛒 TRANSFER CART</span>
      <span class="mono">Jual <b class="c-green">${outCnt} (+${fmtM(cm.cashIn)})</b></span>
      <span class="mono">Beli <b class="c-amber">${inCnt} (-${fmtM(cm.cashOut)})</b></span>
      <span class="mono">Sisa Kas <b class="${sCls}" style="font-size:14px">${fmtM(cm.projBudget)}</b></span>
      <span class="mono c-muted">ΔGaji <b class="${cm.salDelta <= 0 ? 'c-green' : 'c-amber'}">${cm.salDelta >= 0 ? '+' : ''}${fmtM(cm.salDelta)}</b></span>
      <span class="mono">Asing <b class="${fCls}">${cm.projForeign}/${D.meta.foreignCap}</b></span>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="btn btn-sm btn-green" onclick="goToView('t4','t4-cart')">Buka Cart →</button>
      <button class="btn btn-sm" onclick="clearCart()">Reset</button>
    </div>`;
}

// ==================== WEB APP DYNAMIC STATE RESET (v8.0 PWA) ====================
window.LFResetUIState = function () {
  simMode = 'normal';
  simCompKind = 'league';
  xiMode = 'best';
  activeMatchIdx = 0;
  cartOut = {};
  cartIn = {};
  scoutPreset = 'ALL';
  scoutBlueprintTab = 'UPGRADE';
  if (typeof acadFilter !== 'undefined') acadFilter = 'ALL';
  activeDrawer = null;
  if (D && D.stadium && D.stadium.optLigaPrices) {
    simPrices = { ...D.stadium.optLigaPrices };
  }
  if (typeof loadShortlist === 'function') {
    shortlistMap = loadShortlist();
  }
  if (typeof closePlayerDrawer === 'function') closePlayerDrawer();
  if (typeof closeSearch === 'function') closeSearch();
  if (typeof closeGlossary === 'function') closeGlossary();
};
