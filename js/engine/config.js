/**
 * LigaFoot Optimizer Web Engine — config.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm`, `economyV = 9`).
 * Menyimpan seluruh konstanta engine, 15 formasi + RULE_SLOTS, tabel PAYROLL_REF,
 * kurva tiket/stadion v9, matriks transfer/refusal, & panduan Live Match Coach.
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});

  // Kategori posisi: 0=GK, 1=Fullback, 2=CB, 3=Midfield, 4=Forward/Winger
  const EXACT_CAT = {
    G: 0,
    LD: 1, LE: 1, LAT: 1,
    ZD: 2, ZE: 2, ZAG: 2, Z: 2,
    VOL: 3, V: 3, MC: 3, MD: 3, ME: 3, MA: 3, MO: 3, MEI: 3,
    PD: 4, PE: 4, SA: 4, ATA: 4, A: 4,
  };

  const POS_CATEGORY = EXACT_CAT;

  const SLOT_FOOT_PREF = {
    LE: 'E',
    LD: 'D',
  };

  const POS_PT_TO_EN = {
    G: 'GK',
    LD: 'RB', LE: 'LB', LAT: 'FB',
    ZD: 'RCB', ZE: 'LCB', ZAG: 'CB', Z: 'CB',
    VOL: 'CDM', V: 'CDM', MC: 'CM', MD: 'RM', ME: 'LM', MA: 'CAM', MO: 'CAM', MEI: 'MID',
    PD: 'RW', PE: 'LW', SA: 'SS', ATA: 'ST', A: 'ST',
  };
  const POS_EN = POS_PT_TO_EN;

  const FOOT_EN = { D: 'R', E: 'L', A: 'Both', B: 'Both' };

  const SKILL_PT_TO_EN = {
    FIN: 'FIN', PAS: 'PAS', ARM: 'PLY', DES: 'TCK', MAR: 'MRK',
    CAB: 'HDG', CRU: 'CRS', DRI: 'DRI', VEL: 'PAC', RES: 'STA',
    COL: 'POS', REF: 'REF', SAI: 'RUS', DPE: 'PEN', PEN: 'PEN',
    FOR: 'STR', LID: 'LEA', CRI: 'PLY', DEF: 'POS',
  };
  const SKILL_EN = SKILL_PT_TO_EN;

  const FORM_EN = {
    '4-4-2 def.': '4-4-2 Def',
    '4-4-2 ofe.': '4-4-2 Off',
    '4-3-3 def.': '4-3-3 Def',
    '4-3-3 ofe.': '4-3-3 Off',
    '4-2-3-1 Alas': '4-2-3-1 Wide',
  };

  // Matriks Kompatibilitas Posisi (1.00 = natural, 0.99 = satu kategori, 0.70 = outOfPosition #21882)
  const POS_COMPAT_MATRIX = {
    G:   { G: 1.00 },
    LD:  { LD: 1.00, LE: 0.99, LAT: 0.99, ZD: 0.70, ZE: 0.70, ZAG: 0.70, Z: 0.70 },
    LE:  { LE: 1.00, LD: 0.99, LAT: 0.99, ZE: 0.70, ZD: 0.70, ZAG: 0.70, Z: 0.70 },
    LAT: { LAT: 1.00, LD: 0.99, LE: 0.99 },
    ZD:  { ZD: 1.00, ZE: 0.99, ZAG: 0.99, Z: 1.00, LD: 0.70, LE: 0.70, VOL: 0.70 },
    ZE:  { ZE: 1.00, ZD: 0.99, ZAG: 0.99, Z: 1.00, LE: 0.70, LD: 0.70, VOL: 0.70 },
    ZAG: { ZAG: 1.00, ZD: 0.99, ZE: 0.99, Z: 1.00 },
    Z:   { Z: 1.00, ZD: 1.00, ZE: 1.00, ZAG: 1.00 },
    VOL: { VOL: 1.00, V: 1.00, MC: 0.99, MA: 0.99, MO: 0.99, MD: 0.99, ME: 0.99, MEI: 0.99 },
    V:   { V: 1.00, VOL: 1.00, MC: 0.99, MA: 0.99, MO: 0.99, MD: 0.99, ME: 0.99 },
    MC:  { MC: 1.00, VOL: 0.99, V: 0.99, MA: 0.99, MO: 0.99, MD: 0.99, ME: 0.99, MEI: 0.99 },
    MD:  { MD: 1.00, MC: 0.99, MA: 0.99, MO: 0.99, ME: 0.99, VOL: 0.99, V: 0.99 },
    ME:  { ME: 1.00, MC: 0.99, MA: 0.99, MO: 0.99, MD: 0.99, VOL: 0.99, V: 0.99 },
    MA:  { MA: 1.00, MO: 1.00, MC: 0.99, VOL: 0.99, V: 0.99, MD: 0.99, ME: 0.99, MEI: 0.99 },
    MO:  { MO: 1.00, MA: 1.00, MC: 0.99, VOL: 0.99, V: 0.99, MD: 0.99, ME: 0.99 },
    MEI: { MEI: 1.00, MC: 0.99, MA: 0.99, VOL: 0.99 },
    PD:  { PD: 1.00, PE: 0.99, SA: 0.99, ATA: 0.99, A: 0.99 },
    PE:  { PE: 1.00, PD: 0.99, SA: 0.99, ATA: 0.99, A: 0.99 },
    SA:  { SA: 1.00, ATA: 0.99, A: 0.99, PD: 0.99, PE: 0.99 },
    ATA: { ATA: 1.00, A: 1.00, SA: 0.99, PD: 0.99, PE: 0.99 },
    A:   { A: 1.00, ATA: 1.00, SA: 0.99, PD: 0.99, PE: 0.99 },
  };

  // Bytecode #3575 & #3576: 18 Rule Slots & Pemetaan 15 Formasi Resmi (#3492)
  // cat: 0=GK, 1=DEF, 2=MID, 3=ATK | sec: 'G'|'D'|'M'|'A'|'X' | side: null|'D'(kanan)|'E'(kiri)
  const RULE_SLOT_INFO = {
    0:  { label: 'G',   cat: 0, sec: 'G', side: null, exact: ['G'],                          wildcard: false },
    1:  { label: 'LD',  cat: 1, sec: 'D', side: 'D',  exact: ['LD', 'LAT'],                  wildcard: false },
    2:  { label: 'ZD',  cat: 1, sec: 'D', side: null, exact: ['ZD', 'ZE', 'ZAG', 'Z'],       wildcard: false },
    3:  { label: 'ZE',  cat: 1, sec: 'D', side: null, exact: ['ZE', 'ZD', 'ZAG', 'Z'],       wildcard: false },
    4:  { label: 'ZD',  cat: 1, sec: 'D', side: null, exact: ['ZD', 'ZE', 'ZAG', 'Z'],       wildcard: false },
    5:  { label: 'LE',  cat: 1, sec: 'D', side: 'E',  exact: ['LE', 'LAT'],                  wildcard: false },
    6:  { label: 'VOL', cat: 2, sec: 'M', side: null, exact: ['VOL', 'V', 'MC'],             wildcard: false },
    7:  { label: 'VOL', cat: 2, sec: 'M', side: null, exact: ['VOL', 'V', 'MC'],             wildcard: false },
    8:  { label: 'MC',  cat: 2, sec: 'M', side: null, exact: ['MC', 'VOL', 'V', 'MA', 'MO'], wildcard: false },
    9:  { label: 'MC',  cat: 2, sec: 'M', side: null, exact: ['MC', 'VOL', 'V', 'MA', 'MO'], wildcard: false },
    10: { label: 'PD',  cat: 1, sec: 'M', side: 'D',  exact: [],                             wildcard: true  }, // #3575 wildcard wingback kanan
    11: { label: 'PD',  cat: 2, sec: 'M', side: 'D',  exact: ['PD', 'MD', 'MC', 'MA', 'MO'], wildcard: false },
    12: { label: 'MA',  cat: 2, sec: 'M', side: null, exact: ['MA', 'MO', 'MC', 'MEI'],      wildcard: false },
    13: { label: 'MA',  cat: 2, sec: 'M', side: null, exact: ['MA', 'MO', 'MC', 'MEI'],      wildcard: false },
    14: { label: 'PE',  cat: 2, sec: 'M', side: 'E',  exact: ['PE', 'ME', 'MC', 'MA', 'MO'], wildcard: false },
    15: { label: 'SA',  cat: 3, sec: 'A', side: null, exact: ['ATA', 'A', 'SA', 'PD', 'PE'], wildcard: false },
    16: { label: 'ATA', cat: 3, sec: 'A', side: null, exact: ['ATA', 'A', 'SA'],             wildcard: false },
    17: { label: 'PE',  cat: 1, sec: 'M', side: 'E',  exact: [],                             wildcard: true  }, // #3575 wildcard wingback kiri
    18: { label: 'ATA', cat: 3, sec: 'X', side: null, exact: ['ATA', 'A', 'SA', 'PD', 'PE'], wildcard: false }, // #34992 bug: rule 18 di luar 15..16 -> sec 'X'
  };

  const FORMATION_RULE_SLOTS = {
    '4-4-2':        [0, 1, 2, 3, 5, 6, 7, 12, 13, 15, 16],
    '4-4-2 def.':   [0, 1, 2, 3, 5, 6, 7, 6,  12, 15, 16],
    '4-4-2 ofe.':   [0, 1, 2, 3, 5, 6, 12, 13, 12, 15, 16],
    '4-3-3':        [0, 1, 2, 3, 5, 6, 8, 9,  15, 15, 16],
    '4-3-3 def.':   [0, 1, 2, 3, 5, 6, 7, 12, 15, 15, 16],
    '4-3-3 ofe.':   [0, 1, 2, 3, 5, 6, 8, 12, 15, 15, 16],
    '4-2-3-1':      [0, 1, 2, 3, 5, 6, 7, 12, 13, 12, 16],
    '4-2-3-1 Alas': [0, 1, 2, 3, 5, 6, 7, 14, 12, 11, 16],
    '4-5-1':        [0, 1, 2, 3, 5, 14, 6, 7, 11, 12, 16],
    '4-1-4-1':      [0, 1, 2, 3, 5, 6, 8, 9,  11, 14, 16],
    '4-4-1-1':      [0, 1, 2, 3, 5, 8, 9, 11, 14, 15, 16],
    '5-4-1':        [0, 1, 2, 4, 3, 5, 6, 7,  12, 13, 16],
    '5-3-2':        [0, 1, 2, 4, 3, 5, 6, 12, 13, 15, 16],
    '3-5-2':        [0, 2, 4, 3, 17, 6, 7, 10, 12, 15, 16],
    '3-4-3':        [0, 2, 4, 3, 14, 6, 7, 11, 15, 16, 18],
  };

  // Bug engine asli di #34992 slotSector: slot ke-11 pada 3-4-3 memakai rule 18 -> sec 'X' (ATK -33%)
  const FORMATION_BUGS = {
    '3-4-3': {
      hasBug: true,
      droppedSlotIdx: 10,
      ruleId: 18,
      title: 'BUG ENGINE v1.2.0 (#34992): Slot Striker ke-3 Hilang (-33% ATK)',
      desc: 'Di bytecode #34992 slotSector, slot ke-11 pada 3-4-3 memakai rule ID 18 yang jatuh ke sektor "X" (bukan "A"). Akibatnya kekuatan ATK 3-4-3 hanya menghitung 2 penyerang dibagi 3 (-33% ATK). Hindari formasi 3-4-3!',
    },
  };

  // 15 Formasi RESMI LigaFoot v1.2.0 (terverifikasi 100% dari bytecode #3492)
  const FORMATIONS = {
    '4-4-2':        ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'MA', 'ATA', 'ATA'],
    '4-4-2 def.':   ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'VOL', 'MA', 'ATA', 'ATA'],
    '4-4-2 ofe.':   ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MA', 'MA', 'MA', 'ATA', 'ATA'],
    '4-3-3':        ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MC', 'MC', 'PD', 'PE', 'ATA'],
    '4-3-3 def.':   ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'PD', 'PE', 'ATA'],
    '4-3-3 ofe.':   ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MC', 'MA', 'PD', 'PE', 'ATA'],
    '4-2-3-1':      ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'MA', 'MA', 'ATA'],
    '4-2-3-1 Alas': ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'PE', 'MA', 'PD', 'ATA'],
    '4-5-1':        ['G', 'LD', 'ZD', 'ZE', 'LE', 'PE', 'VOL', 'VOL', 'PD', 'MA', 'ATA'],
    '4-1-4-1':      ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MC', 'MC', 'PD', 'PE', 'ATA'],
    '4-4-1-1':      ['G', 'LD', 'ZD', 'ZE', 'LE', 'MC', 'MC', 'PD', 'PE', 'SA', 'ATA'],
    '5-4-1':        ['G', 'LD', 'ZD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'MA', 'ATA'],
    '5-3-2':        ['G', 'LD', 'ZD', 'ZD', 'ZE', 'LE', 'VOL', 'MA', 'MA', 'ATA', 'ATA'],
    '3-5-2':        ['G', 'ZD', 'ZD', 'ZE', 'PE', 'VOL', 'VOL', 'PD', 'MA', 'ATA', 'ATA'],
    '3-4-3':        ['G', 'ZD', 'ZD', 'ZE', 'PE', 'VOL', 'VOL', 'PD', 'ATA', 'ATA', 'ATA'],
  };

  // Modifier resmi atkMod & defMod dari bytecode #3492
  const FORMATION_MODS = {
    '4-4-2':        { atkMod:  0, defMod:  0 },
    '4-4-2 def.':   { atkMod: -3, defMod:  5 },
    '4-4-2 ofe.':   { atkMod:  5, defMod: -4 },
    '4-3-3':        { atkMod:  3, defMod: -2 },
    '4-3-3 def.':   { atkMod:  0, defMod:  3 },
    '4-3-3 ofe.':   { atkMod:  5, defMod: -4 },
    '4-2-3-1':      { atkMod:  2, defMod:  0 },
    '4-2-3-1 Alas': { atkMod:  3, defMod: -1 },
    '4-5-1':        { atkMod: -2, defMod:  3 },
    '4-1-4-1':      { atkMod: -2, defMod:  3 },
    '4-4-1-1':      { atkMod:  1, defMod:  0 },
    '5-4-1':        { atkMod: -3, defMod:  5 },
    '5-3-2':        { atkMod: -1, defMod:  3 },
    '3-5-2':        { atkMod:  1, defMod: -1 },
    '3-4-3':        { atkMod:  5, defMod: -4 },
  };

  // Struktur jumlah pemain tiap sektor (G=1, D, M, A) sesuai #34992 slotSector
  const FORMATION_SHAPE = {
    '4-4-2':        { D: 4, M: 4, A: 2, width: 'NARROW' },
    '4-4-2 def.':   { D: 4, M: 4, A: 2, width: 'NARROW' },
    '4-4-2 ofe.':   { D: 4, M: 4, A: 2, width: 'NARROW' },
    '4-3-3':        { D: 4, M: 3, A: 3, width: 'WIDE'   },
    '4-3-3 def.':   { D: 4, M: 3, A: 3, width: 'WIDE'   },
    '4-3-3 ofe.':   { D: 4, M: 3, A: 3, width: 'WIDE'   },
    '4-2-3-1':      { D: 4, M: 5, A: 1, width: 'NARROW' },
    '4-2-3-1 Alas': { D: 4, M: 5, A: 1, width: 'WIDE'   },
    '4-5-1':        { D: 4, M: 5, A: 1, width: 'WIDE'   },
    '4-1-4-1':      { D: 4, M: 5, A: 1, width: 'WIDE'   },
    '4-4-1-1':      { D: 4, M: 4, A: 2, width: 'WIDE'   },
    '5-4-1':        { D: 5, M: 4, A: 1, width: 'NARROW' },
    '5-3-2':        { D: 5, M: 3, A: 2, width: 'NARROW' },
    '3-5-2':        { D: 3, M: 5, A: 2, width: 'WIDE'   },
    '3-4-3':        { D: 3, M: 4, A: 2, X: 1, width: 'WIDE' }, // slot 11 jatuh ke X (#34992)
  };

  // Usia mulai regresi spesifik per posisi (v1.2.0 #21447 declineStartAge)
  const DECLINE_START_AGE = {
    ATA: 31, A: 31, SA: 31, PD: 31, PE: 31, MA: 31, MO: 31,
    LD: 32, LE: 32, LAT: 32, VOL: 32, V: 32, MC: 32, MD: 32, ME: 32, MEI: 32,
    ZD: 33, ZE: 33, ZAG: 33, Z: 33,
    G: 34,
  };

  const DECLINE_AGE_BY_CAT = {
    0: 34, // GK
    1: 32, // Fullback
    2: 33, // CB
    3: 32, // Midfield
    4: 31, // Forward/Winger
  };

  const SELL_WARN_AGE_BY_CAT = {
    0: 33,
    1: 31,
    2: 32,
    3: 31,
    4: 30,
  };

  // Bytecode #3480 & #19856: PAYROLL_REF & PAYROLL_REF_BIG (TAHUNAN / ANNUAL!)
  const PAYROLL_REF = {
    BR:    { 1: 41000000, 2: 24000000, 3: 14900000, 4: 8000000 },
    ES:    { 1: 40900000, 2: 22800000, 3: 12400000, 4: 6800000 },
    EN:    { 1: 46600000, 2: 26000000, 3: 15500000, 4: 8000000 },
    GB:    { 1: 46600000, 2: 26000000, 3: 15500000, 4: 8000000 },
    IT:    { 1: 44100000, 2: 24700000, 3: 15000000, 4: 7800000 },
    DE:    { 1: 44500000, 2: 24000000, 3: 15000000, 4: 7800000 },
    FR:    { 1: 42300000, 2: 21700000, 3: 13200000, 4: 6900000 },
    AR:    { 1: 32700000, 2: 19500000, 3: 10700000, 4: 5600000 },
    PT:    { 1: 34900000, 2: 21600000, 3: 13500000, 4: 7000000 },
    OTHER: { 1: 28500000, 2: 18700000, 3: 11300000, 4: 5900000 },
  };

  const PAYROLL_REF_BIG = {
    BR:    { 4: 40200000, 5: 40200000 },
    ES:    { 4: 49300000, 5: 62300000 },
    EN:    { 4: 58500000, 5: 60700000 },
    GB:    { 4: 58500000, 5: 60700000 },
    IT:    { 4: 51100000, 5: 51100000 },
    DE:    { 4: 58600000, 5: 58600000 },
    FR:    { 4: 36100000, 5: 53000000 },
    AR:    { 4: 34900000, 5: 34900000 },
    PT:    { 4: 38600000, 5: 38600000 },
    OTHER: { 4: 32900000, 5: 32900000 },
  };

  // Bytecode #19879 & #34226 tvQuotaMonthly
  // TV_SHARE_TOP indexed by clamp(Math.round(reputation / 20), 0, 5)
  // TV_IDLE_SHARE indexed by Math.min(5, division)
  const TV_SHARE_DIV1 = [0.222, 0.222, 0.189, 0.111, 0.022, 0.022];
  const TV_SHARE_OTHER = { 0: 0, 2: 0.144, 3: 0.047, 4: 0.156 };
  const TV_IDLE_BY_DIV = [0.5, 0.167, 0.167, 0.5, 0.417, 0.417];
  const TV_IDLE_BY_REP = TV_IDLE_BY_DIV;

  // Bytecode #2737, #19903, #19904, #19907, #19915, #34244: Tiket & Stadion v9
  const TICKETS_LEAGUE = [
    [3, 12, 15, 30],   // div 0
    [10, 15, 25, 80],  // div 1
    [7, 13, 20, 70],   // div 2
    [1, 3, 5, 10],     // div 3
    [1, 3, 4, 7],      // div 4
  ];

  // Kompatibilitas objek TICKETS_BASE per divisi
  const TICKETS_BASE = {
    0: { geral: 3,  arquibancada: 12, cadeiras: 15, camarotes: 30 },
    1: { geral: 10, arquibancada: 15, cadeiras: 25, camarotes: 80 },
    2: { geral: 7,  arquibancada: 13, cadeiras: 20, camarotes: 70 },
    3: { geral: 1,  arquibancada: 3,  cadeiras: 5,  camarotes: 10 },
    4: { geral: 1,  arquibancada: 3,  cadeiras: 4,  camarotes: 7  },
  };

  const TICKETS_CONT1 = {
    eu:    [30, 45, 65, 200],
    other: [20, 35, 55, 150],
  };

  const TICKETS_CONT2 = {
    eu:    [20, 25, 45, 150],
    other: [20, 25, 40, 120],
  };

  const TICKETS_CUP = {
    low:  [3, 12, 15, 30],  // repLvl <= 2
    mid:  [7, 13, 20, 70],  // repLvl === 3
    high: [10, 15, 25, 80], // repLvl >= 4
  };

  // BASE_ATTENDANCE indexed by homeRepLvl (0..5) -> [geral, arquibancada, cadeiras, camarotes]
  const BASE_ATTENDANCE = [
    [200,  500,   50,   0],
    [1000, 5000,  1200, 20],
    [2000, 10000, 1500, 50],
    [4000, 20000, 2500, 300],
    [4500, 30000, 3500, 400],
    [5000, 40000, 5500, 500],
  ];

  // EXTRA_DRAW indexed by division (0..4) -> [geral, arquibancada, cadeiras, camarotes]
  const EXTRA_DRAW = [
    [10,  20,   5,    0],
    [100, 500,  200,  10],
    [300, 1000, 400,  20],
    [400, 1200, 500,  30],
    [500, 1500, 1000, 50],
  ];

  // REP_DIFF_ADJ indexed by Math.abs(clamp(awayRepLvl - homeRepLvl, -5, 5))
  const REP_DIFF_ADJ = [0, 0.05, 0.10, 0.15, 0.20, 0.25];

  // Knockout / Classic capacity fill overrides (#34244)
  const KO_FILL_RANGES = {
    classic: { min: 1.00, max: 1.00, mid: 1.00  },
    final:   { min: 1.00, max: 1.00, mid: 1.00  },
    sf:      { min: 0.98, max: 0.996, mid: 0.988 },
    qf:      { min: 0.94, max: 0.97,  mid: 0.955 },
    r16:     { min: 0.90, max: 0.94,  mid: 0.920 },
  };

  const TICKET_OCCASIONS = ['normal', 'runin', 'r16', 'qf', 'sf', 'final'];

  const STADIUM_FREE_SEATS = 20000;
  const STADIUM_OPS_PER_SEAT = 35;

  const STADIUM_SEAT_TIERS = {
    geral: [
      [1000, 80],
      [2500, 160],
      [3500, 240],
      [5000, 400],
      [10000, 800],
      [999999, 1600],
    ],
    arquibancada: [
      [5000, 120],
      [10000, 240],
      [20000, 480],
      [40000, 960],
      [999999, 1920],
    ],
    cadeiras: [
      [1000, 250],
      [2500, 500],
      [5000, 1000],
      [10000, 2000],
      [999999, 4000],
    ],
    camarotes: [
      [100, 1000],
      [250, 2000],
      [500, 4000],
      [1000, 8000],
      [999999, 16000],
    ],
  };

  // Bytecode #21317, #21322–#21339, #3525 (slots 187 & 190): Club Shop & Member Plan v9
  const PRICE_FACTOR_MIN = 0.1;
  const PRICE_FACTOR_MAX = 1.35;

  const SHOP_ELAST = { lin: 1.0, up: 1.3, down: 0.8 };
  const SHOP_OPTIMAL_MUL = 1.00;

  const MEMBER_ELAST = { lin: 0.9, up: 1.2, down: 0.8 };
  const MEMBER_PRICE_MIN = 0.5;
  const MEMBER_PRICE_MAX = 2.0;
  const MEMBER_DISC_MAX = 30;            // 30% max annual discount
  const MEMBER_ANNUAL_PER_DISC = 0.03;   // annualShare = min(0.80, dPct * 0.03) = min(0.80, dFrac * 3)
  const MEMBER_ANNUAL_SHARE_MAX = 0.80;
  const MEMBER_LOYAL = 0.12;             // memberDemand = priceFactor * (1 + 0.12 * annualShare)
  const MEMBER_RETAIN = 1.0;             // Legacy alias kept at 1.0 (no separate retain factor in v9)
  const MEMBER_OPTIMAL_MUL = 1.00;
  const MEMBER_OPTIMAL_DISC = 6;

  // Naming Rights multiplier per durasi (#2719)
  const NAMING_DURATION_MULT = {
    1: 1.15,
    2: 1.08,
    3: 1.00,
    4: 0.94,
    5: 0.88,
  };

  // CT Upgrade & Milestones (#21495, #21507)
  const CT_UPGRADE_COSTS = {
    2: 400000,
    3: 900000,
    4: 1800000,
    5: 3200000,
    6: 5500000,
    7: 9000000,
    8: 14000000,
    9: 21000000,
    10: 30000000,
  };

  const CT_UPGRADE_WEEKS = {
    2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20,
  };

  // Share dari PAYROLL_REF tahunan dibagi 12, dibulatkan ke kelipatan 100 (#21495)
  const CT_UPKEEP_SHARE = {
    1: 0.000,
    2: 0.004,
    3: 0.008,
    4: 0.015,
    5: 0.025,
    6: 0.038,
    7: 0.055,
    8: 0.078,
    9: 0.105,
    10: 0.140,
  };

  const CT_MILESTONES = [
    { level: 1, slots: 3, perk: 'Dasar (3 slot latihan, pemulihan standar)' },
    { level: 3, slots: 4, perk: '+1 Slot Latihan (total 4), pemulihan stamina lebih cepat' },
    { level: 5, slots: 5, perk: '+1 Slot Latihan (total 5), pertumbuhan akademi +15%' },
    { level: 7, slots: 6, perk: '+1 Slot Latihan (total 6), risiko cedera otot -20%' },
    { level: 9, slots: 7, perk: 'Maksimum 7 Slot Latihan & akselerasi potCap elit' },
    { level: 10, slots: 7, perk: 'Fasilitas Kelas Dunia (+reputasi & daya tarik transfer)' },
  ];

  const YOUTH_COACH_COSTS = { 1: 0, 2: 250000, 3: 750000, 4: 2000000, 5: 5000000 };
  const YOUTH_COACH_SALARY_SHARE = { 1: 0.003, 2: 0.008, 3: 0.015, 4: 0.028, 5: 0.045 };

  // Kuota Pemain Asing (#3454 FOREIGN_LIMITS: max di skuad & field di lapangan)
  const FOREIGN_LIMITS = {
    BR:      { max: 9,  field: 7  },
    ES:      { max: 5,  field: 3  },
    EN:      { max: 17, field: 11 },
    GB:      { max: 17, field: 11 },
    IT:      { max: 7,  field: 5  },
    DE:      { max: 12, field: 8  },
    FR:      { max: 6,  field: 4  },
    AR:      { max: 6,  field: 5  },
    PT:      { max: 10, field: 7  },
    MX:      { max: 9,  field: 7  },
    US:      { max: 10, field: 8  },
    JP:      { max: 6,  field: 5  },
    SA:      { max: 10, field: 8  },
    TR:      { max: 14, field: 11 },
    NL:      { max: 12, field: 8  },
    DEFAULT: { max: 9,  field: 7  },
  };

  const FOREIGN_FIELD_LIMITS = {
    BR: 7, ES: 3, EN: 11, GB: 11, IT: 5, DE: 8, FR: 4, AR: 5, PT: 7,
    MX: 7, US: 8, JP: 5, SA: 8, TR: 11, NL: 8, ID: 7,
  };

  // Bytecode #3454, #21513, #21517, #23839, #23840: Geografi, Afiliasi, & Batas Transfer
  const COUNTRY_GROUPS = {
    0: ['ES', 'EN', 'GB', 'EN-EL', 'EN-SL', 'EN-WL', 'EN-NL', 'IT', 'DE', 'FR', 'PT', 'NL', 'BE', 'TR', 'RU', 'UA', 'PL', 'AT', 'CH', 'SC', 'GR', 'HR', 'RS', 'CZ', 'DK', 'SE', 'NO', 'RO'],
    1: ['BR', 'AR', 'CO', 'UY', 'CL', 'PY', 'PE', 'EC', 'BO', 'VE'],
    2: ['MX', 'US', 'CA', 'CR', 'HN', 'PA', 'JM'],
    3: ['JP', 'KR', 'SA', 'QA', 'AE', 'CN', 'AU', 'IR', 'UZ', 'TH', 'VN', 'ID', 'MY'],
    4: ['EG', 'MA', 'TN', 'NG', 'GH', 'SN', 'CI', 'CM', 'DZ', 'ZA', 'ML'],
  };

  const UK_CODES = ['EN', 'GB', 'EN-EL', 'EN-SL', 'EN-WL', 'EN-NL', 'SC'];

  const AFFINITY_CLUSTERS = [
    ['BR', 'PT'],
    ['ES', 'AR', 'CO', 'UY', 'CL', 'PY', 'PE', 'EC', 'BO', 'VE', 'MX', 'CR', 'HN', 'PA'],
    ['EN', 'GB', 'EN-EL', 'EN-SL', 'EN-WL', 'EN-NL', 'SC', 'US', 'CA', 'AU', 'JM'],
    ['FR', 'BE', 'CH', 'SN', 'CI', 'CM', 'MA', 'TN', 'DZ', 'ML'],
    ['NL', 'BE', 'DE', 'AT', 'CH'],
    ['DE', 'AT', 'CH'],
    ['DK', 'SE', 'NO'],
    ['RU', 'UA'],
    ['HR', 'RS'],
    ['SA', 'QA', 'AE', 'EG', 'MA', 'TN', 'DZ'],
    ['JP', 'KR'],
    ['TH', 'VN', 'ID', 'MY'],
  ];

  // Bytecode #23839 buyerForceCeiling
  const REP_CEILING = { 0: 44, 1: 58, 2: 72, 3: 100, 4: 100, 5: 100 };
  const DIV_CEILING = { 1: 100, 2: 68, 3: 54, 4: 44, 0: 36 };

  // Bytecode #3454 FX currency rates
  const FX = {
    BRL: 1,
    EUR: 0.18,
    USD: 0.20,
    GBP: 0.15,
    ARS: 180,
    IDR: 3200,
    JPY: 30,
    MXN: 3.4,
    SAR: 0.75,
  };

  // Kontrak, Ruang Ganti, & Arbitrase Transfer
  const RENEW_GOLDEN_MIN = 11;
  const RENEW_GOLDEN_MAX = 59;
  const RENEW_DISCOUNT_3YR = 0.12;
  const PRECONTRACT_DAYS = 180;

  const LOCKER_UNHAPPY_MIN = 3;
  const LOCKER_HIT_PER_PLAYER = 0.015;
  const LOCKER_HIT_CAP = 0.08;

  const COUNTER_MAX_NORMAL = 1.40;
  const COUNTER_AVG_REALIZED = 1.39;
  const COUNTER_ARAB_BONUS = 1.40;

  const SELL_TAX_THRESHOLD = 1500000;
  const SELL_TAX_LOW = 0.10;
  const SELL_TAX_HIGH = 0.15;

  // Bytecode #3541: Salary Cut & Termination Tiers
  const SALARY_CUT = {
    maxPct: 0.30,
    moodSteps: [0.10, 0.20],
    refuseAt: 2,
    floorStarter: 0.85,
    floorReserve: 0.72,
  };

  const TERMINATION_FEE_TIERS = [
    { maxDays: 90,   rate: 0.20 },
    { maxDays: 180,  rate: 0.35 },
    { maxDays: 365,  rate: 0.50 },
    { maxDays: 9999, rate: 0.70 },
  ];

  // Bytecode #3542: Injured Sale Discount
  const INJURED_SALE = {
    minorMaxDays: 14,
    moderateMaxDays: 45,
    minorFactor: 0.90,
    moderateFactor: 0.72,
    severeFactor: 0.50,
    severeBlockChance: 0.55,
  };

  // Bytecode #3543 & #23984: Youth Scout (Olheiro da Base)
  const YOUTH_SCOUT = {
    maxAge: 21,
    minGrowthMargin: 10,
    priceFactor: 1.5,
    maxPerSeason: 2,
  };

  // Bytecode #3544 & #21546: Squad Moods
  const MOOD_CFG = {
    minGames: 6,
    starterQuota: 0.40,
    midQuota: 0.25,
    youngQuota: 0.08,
    injuryDaysPerGame: 4,
    unhappyPenaltyMin: 3,
    unhappyPenaltyStep: 0.015,
    unhappyPenaltyMax: 0.08,
  };

  // Bytecode #3545: Red Card Fine
  const FINE_CFG = {
    maxPct: 1.00,
    safePct: 0.20,
    midPct: 0.50,
    slumpChanceMid: 0.25,
    slumpChanceHigh: 0.50,
  };

  // Bytecode #3548 & #20496: Loan Buy-Option AI Decision
  const LOAN_OPTION = {
    baseChance: 0.35,
    playedBonus: 0.25,
    goalsBonus: 0.20,
    ratingBonus: 0.15,
    highFeePenalty: 0.25,
  };

  // Bytecode #35020: Shout Decay per kuota dalam 1 pertandingan
  const SHOUT_DECAY = [1.0, 0.7, 0.4];

  const LIVE_COACH_GUIDE = {
    shouts: [
      {
        name: 'Praise (Elogiar) — +4% ATK & +4% MID',
        when: 'Butuh Gol / Imbang (Menit 15–75)',
        situation: 'Butuh Gol / Tertinggal (Menit 1–75)',
        shout: 'Praise (Elogiar)',
        effect: '+4% ATK & +4% MID selama 12 menit (tanpa penalti DEF, decay kuota 1.0x → 0.7x → 0.4x)',
        avoid: 'JANGAN pakai Push Forward sebelum menit 75 karena DEF bocor -4%!',
      },
      {
        name: 'Focus (Concentrar) — +6% DEF & +4% MID',
        when: 'Unggul Tipis & Lawan Menekan (Menit 65+)',
        situation: 'Unggul Tipis & Lawan Menekan (Menit 65+)',
        shout: 'Focus (Concentrar)',
        effect: '+6% DEF & +4% MID selama 15 menit (pengunci kemenangan paling aman)',
        avoid: 'Jangan biarkan stamina bek/DM di bawah 65% (penalti energyFactor kontinu s.d. -8%).',
      },
      {
        name: 'Push Forward (Avançar) — +8% ATK, -4% DEF',
        when: 'All-Out Attack (Menit 75+ Tertinggal)',
        situation: 'All-Out Attack (Menit 78+ Tertinggal 1 Gol)',
        shout: 'Push Forward (Avançar)',
        effect: '+8% ATK selama 10 menit, tapi -4% DEF (kombinasikan dengan Play Style Offensive +8% ATK)',
        avoid: 'Jangan dipakai di babak pertama — kuota shout cuma 3x per laga (efek ke-2 70%, ke-3 40%)!',
      },
      {
        name: 'Calm Down (Acalmar) — -35% Risiko Kartu',
        when: 'Wasit Ketat / Banyak Kartu Kuning',
        situation: 'Lawan Bermain Kasar / Banyak Pelanggaran',
        shout: 'Calm Down (Acalmar)',
        effect: 'Menurunkan risiko kartu kuning ke-2 / kartu merah sekitar -35% selama 15 menit',
        avoid: 'Segera tarik keluar pemain yang sudah mengantongi 1 kartu kuning jika marking Heavy/Very Heavy.',
      },
    ],
    orders: [
      {
        cond: 'Unggul 1–2 Gol (Menit 65+)',
        order: 'Balanced + Marking Heavy (+4% DEF) + Shout Focus',
        note: 'Kunci kemenangan dengan +6% DEF & +4% MID. Masukkan 1–2 pemain muda/cadangan yang butuh kuota menit.',
      },
      {
        cond: 'Imbang / Tertinggal 1 Gol (Menit 70+)',
        order: 'Offensive (+8% ATK) + Shout Praise / Push Forward',
        note: 'Masukkan Supersub VEL/FIN segar (energi 100% vs bek lawan yang terkena penalti energyFactor).',
      },
      {
        cond: 'Terkena Kartu Merah (10 Pemain)',
        order: 'Counter-Attack + Marking Heavy + Denda Manual 20%',
        note: 'Tarik 1 penyerang untuk mengisi slot bek/DM yang kosong. Usai laga, beri denda manual tepat 20% gaji (0% risiko fineSlump!).',
      },
    ],
    subsRule: 'Di v1.2.0, energyFactor turun kontinu 0.1% per poin energi hilang (RES memotong penalti 40%, lantai 0.92x). Masukkan 1–2 pemain moodTier=1 yang minPct < 12% pada menit 60–70 bila sudah unggul >=2 gol, atau masukkan Supersub VEL/FIN untuk mencetak gol penentu.',
    redCardRule: 'Jika pemainmu kena Kartu Merah: (1) Setelah laga beri denda manual tepat 20% gaji (0% peluang fineSlump + dapat kas gratis!), (2) Di lapangan langsung ganti 1 penyerang/AM ke posisi bek/DM yang kosong dan ubah gaya ke Counter-Attack + Marking Heavy.',
  };

  function getClientConfig() {
    return {
      EXACT_CAT,
      POS_CATEGORY,
      SLOT_FOOT_PREF,
      POS_EN,
      POS_PT_TO_EN,
      FOOT_EN,
      SKILL_EN,
      SKILL_PT_TO_EN,
      FORM_EN,
      POS_COMPAT_MATRIX,
      RULE_SLOT_INFO,
      FORMATION_RULE_SLOTS,
      FORMATION_BUGS,
      FORMATIONS,
      FORMATION_MODS,
      FORMATION_SHAPE,
      DECLINE_START_AGE,
      DECLINE_AGE_BY_CAT,
      SELL_WARN_AGE_BY_CAT,
      PAYROLL_REF,
      PAYROLL_REF_BIG,
      TV_SHARE_DIV1,
      TV_SHARE_OTHER,
      TV_IDLE_BY_REP,
      TICKETS_BASE,
      TICKETS_LEAGUE,
      TICKETS_CONT1,
      TICKETS_CONT2,
      TICKETS_CUP,
      BASE_ATTENDANCE,
      EXTRA_DRAW,
      REP_DIFF_ADJ,
      KO_FILL_RANGES,
      TICKET_OCCASIONS,
      STADIUM_FREE_SEATS,
      STADIUM_OPS_PER_SEAT,
      STADIUM_SEAT_TIERS,
      PRICE_FACTOR_MIN,
      PRICE_FACTOR_MAX,
      SHOP_ELAST,
      SHOP_OPTIMAL_MUL,
      MEMBER_ELAST,
      MEMBER_PRICE_MIN,
      MEMBER_PRICE_MAX,
      MEMBER_DISC_MAX,
      MEMBER_ANNUAL_PER_DISC,
      MEMBER_ANNUAL_SHARE_MAX,
      MEMBER_LOYAL,
      MEMBER_RETAIN,
      MEMBER_OPTIMAL_MUL,
      MEMBER_OPTIMAL_DISC,
      NAMING_DURATION_MULT,
      CT_UPGRADE_COSTS,
      CT_UPGRADE_WEEKS,
      CT_UPKEEP_SHARE,
      CT_MILESTONES,
      YOUTH_COACH_COSTS,
      YOUTH_COACH_SALARY_SHARE,
      FOREIGN_LIMITS,
      FOREIGN_FIELD_LIMITS,
      COUNTRY_GROUPS,
      UK_CODES,
      AFFINITY_CLUSTERS,
      REP_CEILING,
      DIV_CEILING,
      FX,
      RENEW_GOLDEN_MIN,
      RENEW_GOLDEN_MAX,
      RENEW_DISCOUNT_3YR,
      PRECONTRACT_DAYS,
      LOCKER_UNHAPPY_MIN,
      LOCKER_HIT_PER_PLAYER,
      LOCKER_HIT_CAP,
      COUNTER_MAX_NORMAL,
      COUNTER_AVG_REALIZED,
      COUNTER_ARAB_BONUS,
      SELL_TAX_THRESHOLD,
      SELL_TAX_LOW,
      SELL_TAX_HIGH,
      SALARY_CUT,
      TERMINATION_FEE_TIERS,
      INJURED_SALE,
      YOUTH_SCOUT,
      MOOD_CFG,
      FINE_CFG,
      LOAN_OPTION,
      SHOUT_DECAY,
      LIVE_COACH_GUIDE,
    };
  }

  LF.config = getClientConfig();
  LF.config.getClientConfig = getClientConfig;
})(typeof window !== 'undefined' ? window : globalThis);
