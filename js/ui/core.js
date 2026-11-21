// ==================== STATE & HELPERS (v7.0 Exact Engine Sync) ====================
let activeTab = 't1';
let xiMode = 'best';
let warRef = 'normal';     // strict | normal | lenient
let warWeather = 'clear';  // clear | rain | heat
let simMode = 'normal';
let simPrices = { ...((D && D.stadium && D.stadium.optLigaPrices) || { geral: 12, arquibancada: 19, cadeiras: 47, camarotes: 160 }) };
let rosterSort = { col: 'force', dir: -1 };
let scoutPreset = 'ALL';
let scoutBlueprintTab = 'UPGRADE';
let cartOut = {}; // playerId -> { arab: bool }
let cartIn = {};  // playerId -> scoutRow

// Single Source of Truth dari optimizer/config.py via D.cfg
const CFG = D.cfg || {};
const EXACT_CAT = CFG.EXACT_CAT || { G:0, LD:1, LE:1, LAT:1, ZD:2, ZE:2, ZAG:2, VOL:3, MC:3, MD:3, ME:3, MA:3, MEI:3, PD:4, PE:4, SA:4, ATA:4 };
const SLOT_FOOT_PREF = CFG.SLOT_FOOT_PREF || { LE:'E', LD:'D' }; // Khusus Fullback (#21882)
const POS_EN = CFG.POS_EN || {
  G:'GK', LD:'RB', LE:'LB', LAT:'FB', ZD:'RCB', ZE:'LCB', ZAG:'CB',
  VOL:'CDM', MC:'CM', MD:'RM', ME:'LM', MA:'CAM', MEI:'MID',
  PD:'RW', PE:'LW', SA:'SS', ATA:'ST'
};
const FOOT_EN = CFG.FOOT_EN || { D:'R', E:'L', A:'Both', B:'Both' };
const SKILL_EN = CFG.SKILL_EN || {
  FIN:'FIN', PAS:'PAS', ARM:'PLY', DES:'TCK', MAR:'MRK',
  CAB:'HDG', CRU:'CRS', DRI:'DRI', VEL:'PAC', RES:'STA',
  COL:'POS', REF:'REF', SAI:'RUS', DPE:'PEN'
};
const FORM_EN = CFG.FORM_EN || {
  '4-4-2 def.':'4-4-2 Def', '4-4-2 ofe.':'4-4-2 Off',
  '4-3-3 def.':'4-3-3 Def', '4-3-3 ofe.':'4-3-3 Off',
  '4-2-3-1 Alas':'4-2-3-1 Wide'
};
const FORMATION_MODS = CFG.FORMATION_MODS || {};
const PITCH_COORDS = CFG.PITCH_COORDS || {
  G:[[50,91]],
  LE:[[13,66]], LD:[[87,66]],
  ZE:[[36,78]], ZD:[[64,78],[50,79]], ZAG:[[50,79]],
  VOL:[[50,56],[22,57],[78,57]],
  ME:[[14,45]], MD:[[86,45]],
  MC:[[27,45],[73,45],[50,44]],
  MA:[[50,32],[20,34],[80,34]],
  PE:[[15,22]], PD:[[85,22]],
  SA:[[50,23]], ATA:[[50,12],[23,15],[77,15]]
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

// ==================== EXACT v1.2.0 ENGINE MATH IN JS ====================
function priceFactorJS(m, lin, up, down) {
  const dx = m - 1.0;
  const k = dx >= 0 ? up : down;
  const v = Math.exp(-lin * dx - k * dx * dx);
  return Math.max(0.25, Math.min(1.60, v));
}

function ticketDemandJS(m, big) {
  const cm = Math.max(0.5, Math.min(2.0, m));
  const slope = big ? 0.2 : 0.7;
  return cm < 1.0 ? 1.0 + 0.4 * (1.0 - cm) : Math.max(0.25, 1.0 - slope * (cm - 1.0));
}

function simulateStadiumJS(prices, big) {
  const bp = D.stadium.basePrices;
  const secs = D.stadium.sections;
  const totalCap = Math.max(1, D.stadium.totalSeats);
  const fanFactor = 0.62 + 0.48 * Math.max(0, Math.min(1, D.meta.fanConf / 100));
  const matchBonus = big ? 0.35 : 0.0;
  const baseFill = Math.max(0.35, Math.min(1.55, fanFactor + matchBonus));
  const sm = { geral: 0.92, arquibancada: 1.08, cadeiras: 2.40, camarotes: 4.20 };
  let totAtt = 0, totRev = 0;
  const out = {};
  ['geral', 'arquibancada', 'cadeiras', 'camarotes'].forEach(s => {
    const cap = secs[s] || 0;
    const p = prices[s] || bp[s];
    const mul = p / bp[s];
    const dem = ticketDemandJS(mul, big);
    const fill = Math.max(0, Math.min(1, baseFill * sm[s] * dem));
    const att = Math.round(cap * fill);
    const rev = att * p;
    totAtt += att; totRev += rev;
    out[s] = { cap, bp: bp[s], p, mul, att, fillPct: +(fill * 100).toFixed(1), rev };
  });
  const fillPct = +((totAtt / totalCap) * 100).toFixed(1);
  return { totAtt, totRev, fillPct, crowdFull: fillPct >= 70.0, sectors: out };
}

function optimalPricesJS(big) {
  const bp = D.stadium.basePrices;
  const totalCap = Math.max(1, D.stadium.totalSeats);
  const minAtt = Math.ceil(totalCap * 0.705);
  const pareto = {};
  ['geral', 'arquibancada', 'cadeiras', 'camarotes'].forEach(s => {
    const lo = Math.max(1, Math.round(bp[s] * 0.5));
    const hi = Math.max(lo, Math.round(bp[s] * 2.0));
    const step = bp[s] >= 50 ? 5 : 1;
    const opts = [];
    for (let p = lo; p <= hi; p += step) {
      const sim = simulateStadiumJS({ ...bp, [s]: p }, big).sectors[s];
      opts.push([p, sim.att, sim.rev]);
    }
    if (opts[opts.length - 1][0] !== hi) {
      const sim = simulateStadiumJS({ ...bp, [s]: hi }, big).sectors[s];
      opts.push([hi, sim.att, sim.rev]);
    }
    opts.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]));
    const pf = [];
    let bestR = -1;
    for (const o of opts) { if (o[2] > bestR) { pf.push(o); bestR = o[2]; } }
    pareto[s] = pf;
  });
  let bestFeas = null, bestAny = null;
  for (const g of pareto.geral)
    for (const a of pareto.arquibancada)
      for (const c of pareto.cadeiras)
        for (const v of pareto.camarotes) {
          const att = g[1] + a[1] + c[1] + v[1];
          const rev = g[2] + a[2] + c[2] + v[2];
          const pr = { geral: g[0], arquibancada: a[0], cadeiras: c[0], camarotes: v[0] };
          if (!bestAny || rev > bestAny.rev) bestAny = { rev, att, pr };
          if (att >= minAtt && (!bestFeas || rev > bestFeas.rev)) bestFeas = { rev, att, pr };
        }
  return (bestFeas || bestAny).pr;
}

// v7.0 EXACT entryValue (#21882): outOfPosition=0.70, wrongFoot khusus Fullback,
// bonus star/top per repLevel, penalti unhappy -3%, dan fineSlump (cap -20%).
function slotScoreJS(p, sl, rotMode) {
  const pc = EXACT_CAT[p.pos] ?? 3, sc = EXACT_CAT[sl] ?? 3;
  let pm = 0.70;
  if (p.pos === sl) pm = 1.0;
  else if (pc === sc) pm = 0.99;
  else if (pc === 0 || sc === 0) pm = 0.35;

  const pref = SLOT_FOOT_PREF[sl];
  const wf = Boolean(pref && p.foot && p.foot !== pref && (p.foot === 'D' || p.foot === 'E'));
  const fm = (wf && pc === sc) ? 0.95 : 1.0;
  const en = p.energy >= 80 ? 1.0 : (p.energy >= 65 ? 0.96 : (p.energy >= 50 ? 0.90 : 0.80));
  const repLv = D.meta.repLevel || 3;
  const starMul = p.top ? (repLv > 3 ? 1.10 : 1.05) : (p.star ? (repLv > 3 ? 1.05 : 1.02) : 1.0);
  const unhMul = p.mood === 'unhappy' ? 0.97 : 1.0;
  const slumpMul = 1.0 - Math.max(0, Math.min(0.20, Number(p.fineSlump) || 0));

  const score = (p.force || 0) * pm * fm * (1 + (p.stackPct || 0) / 100) * en * starMul * unhMul * slumpMul;
  let pickScore = score;
  if (rotMode && sl !== 'G') {
    const has2Y = Object.values(p.cardsByComp || {}).some(v => v && (v.y || 0) >= 2 && (v.s || 0) === 0);
    if (has2Y) pickScore *= 0.86;
    if ((p.energy ?? 100) < 90) pickScore *= 0.88;
    else if ((p.energy ?? 100) < 95) pickScore *= 0.94;
    else if ((p.energy ?? 100) >= 97 && (p.minPct ?? 100) < 65) pickScore *= 1.12;
    if (p.moodTier === 1 && (p.minPct ?? 100) < 25) pickScore *= 1.14;
    else if (p.age <= 21 && (p.potCap - p.force) >= 5) pickScore *= 1.13;
    else if ((p.minPct ?? 100) < 40) pickScore *= 1.06;
  }
  return { score, pickScore, wf };
}

function solveBestXiJS(formKey, rotMode) {
  const slots = D.formations[formKey] || D.formations['4-3-3'];
  const pool = D.roster.filter(p => !p.injured && !p.suspended);
  const fCap = D.meta.foreignCap;
  const hc = D.meta.country;
  const isF = p => Boolean(hc && p.nationality && p.nationality !== hc);

  const assigned = new Array(slots.length).fill(null);
  const used = new Set();
  let fUsed = 0;

  const gks = [...pool].sort((a, b) => slotScoreJS(b, 'G', rotMode).pickScore - slotScoreJS(a, 'G', rotMode).pickScore);
  if (gks.length) {
    let g = gks[0];
    if (isF(g) && fCap <= 0) { const lg = gks.find(x => !isF(x)); if (lg) g = lg; }
    const r = slotScoreJS(g, 'G', rotMode);
    assigned[0] = { slot: 'G', p: g, score: r.score, pickScore: r.pickScore, wf: r.wf };
    used.add(g.id);
    if (isF(g)) fUsed++;
  }
  const open = [];
  for (let i = 1; i < slots.length; i++) open.push(i);
  while (open.length) {
    let best = null;
    for (const si of open) {
      for (const p of pool) {
        if (used.has(p.id)) continue;
        if (isF(p) && fUsed >= fCap) continue;
        const r = slotScoreJS(p, slots[si], rotMode);
        if (!best || r.pickScore > best.pickScore) best = { si, p, score: r.score, pickScore: r.pickScore, wf: r.wf };
      }
    }
    if (!best) break;
    assigned[best.si] = { slot: slots[best.si], p: best.p, score: best.score, pickScore: best.pickScore, wf: best.wf };
    used.add(best.p.id);
    if (isF(best.p)) fUsed++;
    open.splice(open.indexOf(best.si), 1);
  }
  // 2-opt internal swap
  for (let pass = 0; pass < 3; pass++) {
    let imp = false;
    for (let i = 1; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (!assigned[i] || !assigned[j]) continue;
        const pi = assigned[i].p, pj = assigned[j].p;
        const ri = slotScoreJS(pj, slots[i], rotMode);
        const rj = slotScoreJS(pi, slots[j], rotMode);
        if (ri.pickScore + rj.pickScore > assigned[i].pickScore + assigned[j].pickScore + 0.05) {
          assigned[i] = { slot: slots[i], p: pj, score: ri.score, pickScore: ri.pickScore, wf: ri.wf };
          assigned[j] = { slot: slots[j], p: pi, score: rj.score, pickScore: rj.pickScore, wf: rj.wf };
          imp = true;
        }
      }
    }
    if (!imp) break;
  }
  // Cross-bench foreign-vs-local swap
  if (fCap < 50) {
    for (let iter = 0; iter < 4; iter++) {
      const bfList = pool.filter(p => !used.has(p.id) && isF(p));
      const blList = pool.filter(p => !used.has(p.id) && !isF(p));
      if (!bfList.length || !blList.length) break;
      let bestG = 0.05, move = null;
      for (let i = 0; i < assigned.length; i++) {
        if (!assigned[i] || !isF(assigned[i].p)) continue;
        let bLoc = null;
        for (const lp of blList) {
          const r = slotScoreJS(lp, slots[i], rotMode);
          if (!bLoc || r.pickScore > bLoc.pickScore) bLoc = { p: lp, ...r };
        }
        const loss = assigned[i].pickScore - bLoc.pickScore;
        for (let j = 0; j < assigned.length; j++) {
          if (!assigned[j] || j === i || isF(assigned[j].p)) continue;
          for (const bf of bfList) {
            const r = slotScoreJS(bf, slots[j], rotMode);
            const gain = (r.pickScore - assigned[j].pickScore) - loss;
            if (gain > bestG) { bestG = gain; move = { i, bLoc, j, bf, r }; }
          }
        }
      }
      if (!move) break;
      used.delete(assigned[move.i].p.id); used.delete(assigned[move.j].p.id);
      assigned[move.i] = { slot: slots[move.i], p: move.bLoc.p, score: move.bLoc.score, pickScore: move.bLoc.pickScore, wf: move.bLoc.wf };
      assigned[move.j] = { slot: slots[move.j], p: move.bf, score: move.r.score, pickScore: move.r.pickScore, wf: move.r.wf };
      used.add(move.bLoc.p.id); used.add(move.bf.id);
    }
  }
  const xi = assigned.filter(Boolean);
  const bench = pool.filter(p => !used.has(p.id)).sort((a, b) => b.force - a.force);
  const tot = xi.reduce((s, a) => s + a.score, 0);
  const fCnt = xi.filter(a => isF(a.p)).length;
  const wfCnt = xi.filter(a => a.wf).length;
  const f9Players = xi.map(a => a.p).filter(p => (p.pos === 'ATA' || p.pos === 'SA') && (p.s1 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'PAS' || p.s2 === 'ARM')).map(p => p.name);
  return { xi, bench, tot: +tot.toFixed(1), avg: xi.length ? +(tot / xi.length).toFixed(1) : 0, fCnt, wfCnt, falseNine: f9Players.length >= 2, f9Players };
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
  GOLDEN: 'Golden Window (11–59 hari): perpanjang kontrak 3 tahun di jendela ini untuk potong gaji -12% GRATIS!',
  LOOPHOLE: 'Loophole Auto-Renew 0%: nyalakan Auto-Renew sementara untuk pemain inti ≤10 hari agar diperpanjang +180 hari dengan gaji lama (0% naik).',
  SWAP: 'Rekomendasi tukar beli target + jual pemain skuad lama (hitung net kas, selisih gaji & upgrade performa Eff).',
  FLIP: 'Strategi beli pemain muda (17–21 thn) murah, latih 1–2 musim, lalu jual mahal (+40% counter) untuk cetak kas!'
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
    const need = Math.max(0, maxSec - user.pts + 1);
    return {
      userPos: 1, totalRounds, remUser, lead, secondName: second.name,
      clinched: (user.pts > maxSec),
      needPts: need,
      text: (user.pts > maxSec)
        ? `🏆 JUARA SECARA MATEMATIS! Unggul ${lead} poin atas ${second.name} di sisa ${remSecond} pekan.`
        : `🥇 Peringkat #1 (+${lead} poin dari ${second.name}). Butuh ${need} poin lagi dari sisa ${remUser} laga untuk kunci gelar!`
    };
  }
  const behind = leader.pts - user.pts;
  return {
    userPos: user.pos, totalRounds, remUser, lead: -behind, secondName: leader.name,
    clinched: false, needPts: null,
    text: `Peringkat #${user.pos} (${user.pts} poin, selisih ${behind} poin dari pemuncak ${leader.name} di sisa ${remUser} pekan).`
  };
}

// ==================== PLAYER DRAWER (v8.0 TAHAP 2) ====================
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
    const toGolden = p.contractDays > 59 ? (p.contractDays - 59) : 0;
    const actB = { crit: 'b-crit', warn: 'b-warn', good: 'b-good', accent: 'b-accent', info: 'b-info', muted: 'b-muted' }[p.actionCls] || 'b-muted';
    const cardsList = Object.entries(p.cardsByComp || {})
      .filter(([, v]) => v && ((v.y || 0) > 0 || (v.s || 0) > 0))
      .map(([cid, v]) => `${cid}: ${v.y || 0}🟨${v.s ? ' ' + v.s + '🟥' : ''}`);

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
        <div class="drawer-kv"><span>Skill &amp; Stacking</span><span class="badge ${p.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(p.s1, p.s2)} (+${p.stackPct}%)</span></div>
        <div class="c-muted" style="font-size:11px;margin-top:4px">${esc(p.stackNote)}</div>
      </div>

      <div class="drawer-sec">
        <h3>⚡ Kondisi, Statistik &amp; Ruang Ganti</h3>
        <div class="drawer-kv"><span>Energi / Stamina</span>${energyPillHtml(p.energy)}</div>
        <div class="drawer-kv"><span>Statistik Musim Ini</span><span class="mono"><b>${p.gamesPlayed}</b> laga • <b>${p.goals}</b> gol • <b>${p.assists}</b> asis • Avg <b>${p.avgRating}</b></span></div>
        <div class="drawer-kv"><span>Mood &amp; Role v9</span><span class="badge ${p.mood === 'unhappy' ? 'b-crit' : (p.mood === 'happy' ? 'b-good' : 'b-info')}">${p.mood.toUpperCase()} · ${esc(p.moodReason)}</span></div>
        <div class="drawer-kv"><span>Menit Main (Target ${p.reqPct}%)</span>${minutesQuotaBarHtml(p.minPct, p.reqPct, p.mood)}</div>
        ${cardsList.length ? `<div class="drawer-kv"><span>Kartu Aktif</span><span class="mono c-amber">${esc(cardsList.join(' · '))}</span></div>` : ''}
      </div>

      <div class="drawer-sec">
        <h3>💰 Kontrak &amp; Proyeksi Nilai Jual</h3>
        <div class="drawer-kv"><span>Sisa Kontrak</span><b class="mono ${p.contractDays <= 10 ? 'c-red' : (p.contractDays <= 59 ? 'c-green' : '')}">${p.contractDays} hari</b></div>
        <div class="drawer-kv"><span>Status Golden Window (11–59d)</span><span class="mono">${p.contractDays <= 10 ? '<b class="c-red">Zona Jebakan — pakai Loophole 0%!</b>' : (p.contractDays <= 59 ? '<b class="c-green">AKTIF SEKARANG (-12% gaji!)</b>' : `Masuk dalam ~${toGolden} hari`)}</span></div>
        <div class="drawer-kv"><span>Gaji Bulanan</span><b class="mono">${fmtM(p.salary)}/bln</b></div>
        ${p.benchCutSave ? `<div class="drawer-kv"><span>Trik Bangku Cadangan (#20882)</span><b class="mono c-sky">Hemat ekstra -${fmtM(p.benchCutSave)}/bln</b></div>` : ''}
        <div class="drawer-kv"><span>Market Value</span><span class="mono">${fmtM(p.marketValue)}</span></div>
        <div class="drawer-kv"><span>Est. Cair Jual (Real 1.25x)</span><b class="mono c-green">${fmtM(p.estRealSale)} <span class="c-muted">(Ctr +40%: ${fmtM(p.estCounter40)})</span></b></div>
        ${p.isTop5Arab ? `<div class="drawer-kv"><span>Potensi Jackpot Arab (2.5–3x)</span><b class="mono c-purple">${fmtM(p.estArabLow)} – ${fmtM(p.estArabHigh)}</b></div>` : ''}
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
        <button class="btn ${inC ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartIn('${pidJs}');openPlayerDrawer('scout','${pidJs}')">${inC ? '✓ Di Cart Beli' : '+ Beli Saja'}</button>
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
  if (outCnt === 0 && inCnt === 0) {
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
  xiMode = 'best';
  activeMatchIdx = 0;
  cartOut = {};
  cartIn = {};
  scoutPreset = 'ALL';
  scoutBlueprintTab = 'UPGRADE';
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
