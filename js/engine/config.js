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

  // Bytecode #3575, #3576 & #22444/#3699: 18 Rule Slots & Pemetaan 16 Formasi Resmi (#614)
  // cat 5-kelompok (#3700 env[29]): 0=G, 1=LAT(LD/LE), 2=ZAG(ZD/ZE), 3=MEI(MID), 4=ATA(ATK)
  // sec: 'G'|'D'|'M'|'A'|'X' | side: null|'D'(kanan)|'E'(kiri) | wildcard: true hanya slot 10 & 17
  const RULE_SLOT_INFO = {
    0:  { label: 'G',   cat: 0, sec: 'G', side: null, exact: ['G'],                          wildcard: false },
    1:  { label: 'LD',  cat: 1, sec: 'D', side: 'D',  exact: ['LD', 'LAT'],                  wildcard: false },
    2:  { label: 'ZD',  cat: 2, sec: 'D', side: null, exact: ['ZD', 'ZE', 'ZAG', 'Z'],       wildcard: false },
    3:  { label: 'ZE',  cat: 2, sec: 'D', side: null, exact: ['ZE', 'ZD', 'ZAG', 'Z'],       wildcard: false },
    4:  { label: 'ZD',  cat: 2, sec: 'D', side: null, exact: ['ZD', 'ZE', 'ZAG', 'Z'],       wildcard: false },
    5:  { label: 'LE',  cat: 1, sec: 'D', side: 'E',  exact: ['LE', 'LAT'],                  wildcard: false },
    6:  { label: 'VOL', cat: 3, sec: 'M', side: null, exact: ['VOL', 'V', 'MC'],             wildcard: false },
    7:  { label: 'VOL', cat: 3, sec: 'M', side: null, exact: ['VOL', 'V', 'MC'],             wildcard: false },
    8:  { label: 'MC',  cat: 3, sec: 'M', side: null, exact: ['MC', 'VOL', 'V', 'MA', 'MO'], wildcard: false },
    9:  { label: 'MC',  cat: 3, sec: 'M', side: null, exact: ['MC', 'VOL', 'V', 'MA', 'MO'], wildcard: false },
    10: { label: 'PD',  cat: 1, sec: 'M', side: 'D',  exact: [],                             wildcard: true  }, // #3575 wildcard wingback kanan
    11: { label: 'PD',  cat: 3, sec: 'M', side: 'D',  exact: ['PD', 'MD', 'MC', 'MA', 'MO'], wildcard: false },
    12: { label: 'MA',  cat: 3, sec: 'M', side: null, exact: ['MA', 'MO', 'MC', 'MEI'],      wildcard: false },
    13: { label: 'MA',  cat: 3, sec: 'M', side: null, exact: ['MA', 'MO', 'MC', 'MEI'],      wildcard: false },
    14: { label: 'PE',  cat: 3, sec: 'M', side: 'E',  exact: ['PE', 'ME', 'MC', 'MA', 'MO'], wildcard: false },
    15: { label: 'SA',  cat: 4, sec: 'A', side: null, exact: ['ATA', 'A', 'SA', 'PD', 'PE'], wildcard: false },
    16: { label: 'ATA', cat: 4, sec: 'A', side: null, exact: ['ATA', 'A', 'SA'],             wildcard: false },
    17: { label: 'PE',  cat: 1, sec: 'M', side: 'E',  exact: [],                             wildcard: true  }, // #3575 wildcard wingback kiri
    18: { label: 'ATA', cat: 4, sec: 'X', side: null, exact: ['ATA', 'A', 'SA', 'PD', 'PE'], wildcard: false }, // #34992 bug: rule 18 di luar 15..16 -> sec 'X'
  };

  const FORMATION_RULE_SLOTS = {
    '4-4-2':        [0, 1, 2, 3, 5, 6, 7, 12, 13, 15, 16],
    '4-4-2 def.':   [0, 1, 2, 3, 5, 6, 7, 6,  12, 15, 16],
    '4-4-2 ofe.':   [0, 1, 2, 3, 5, 6, 12, 13, 12, 15, 16],
    '4-3-3':        [0, 1, 2, 3, 5, 6, 8, 9,  15, 15, 16],
    '4-3-3 def.':   [0, 1, 2, 3, 5, 6, 7, 12, 15, 15, 16],
    '4-3-3 ofe.':   [0, 1, 2, 3, 5, 6, 8, 12, 15, 15, 16],
    '4-2-3-1':      [0, 1, 2, 3, 5, 6, 7, 12, 13, 12, 16],
    '4-2-3-1 Alas': [0, 1, 2, 3, 5, 6, 7, 17, 12, 10, 16],
    '4-5-1':        [0, 1, 2, 3, 5, 17, 6, 7, 10, 12, 16],
    '4-1-4-1':      [0, 1, 2, 3, 5, 6, 8, 9,  17, 10, 16],
    '4-4-1-1':      [0, 1, 2, 3, 5, 6, 7, 12, 13, 15, 16],
    '5-4-1':        [0, 1, 2, 4, 3, 5, 6, 7,  12, 13, 16],
    '5-3-2':        [0, 1, 2, 4, 3, 5, 6, 12, 13, 15, 16],
    '3-5-2':        [0, 2, 4, 3, 10, 6, 7, 17, 12, 15, 16],
    '3-4-3':        [0, 2, 4, 3, 10, 6, 7, 17, 15, 16, 18],
    '3-4-1-2':      [0, 2, 4, 3, 17, 6, 12, 10, 15, 16, 16],
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

  // 16 Formasi RESMI LigaFoot (#614 & #3699)
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
    '4-1-4-1':      ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'MC', 'MC', 'MA', 'MA', 'ATA'],
    '4-4-1-1':      ['G', 'LD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'MA', 'SA', 'ATA'],
    '5-4-1':        ['G', 'LD', 'ZD', 'ZD', 'ZE', 'LE', 'VOL', 'VOL', 'MA', 'MA', 'ATA'],
    '5-3-2':        ['G', 'LD', 'ZD', 'ZD', 'ZE', 'LE', 'VOL', 'MA', 'MA', 'ATA', 'ATA'],
    '3-5-2':        ['G', 'ZD', 'ZD', 'ZE', 'PD', 'VOL', 'VOL', 'PE', 'MA', 'ATA', 'ATA'],
    '3-4-3':        ['G', 'ZD', 'ZD', 'ZE', 'PD', 'VOL', 'VOL', 'PE', 'ATA', 'ATA', 'ATA'],
    '3-4-1-2':      ['G', 'ZD', 'ZD', 'ZE', 'PE', 'VOL', 'MA', 'PD', 'SA', 'ATA', 'ATA'],
  };

  // Modifier resmi atkMod & defMod dari bytecode #614
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
    '3-4-1-2':      { atkMod:  2, defMod: -1 },
  };

  // Struktur jumlah pemain tiap sektor (G=1, D, M, A) sesuai #3699 & #614
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
    '3-4-1-2':      { D: 3, M: 4, A: 3, width: 'WIDE'   },
  };

  // Custom Formation Role Overrides (Bytecode #2999 / #19552–#19560 / #22023)
  const CUSTOM_MID_ROLES = ['VOL', 'MC', 'MA', 'PD', 'PE'];
  const CUSTOM_ATK_ROLES = ['ATA', 'SA', 'PD', 'PE'];
  const CUSTOM_MID_OFF = { VOL: 0, MC: 1, MA: 2, PD: 2, PE: 2 };
  const CUSTOM_ATK_OFF = { SA: 1, ATA: 2, PD: 2, PE: 2 };
  const CUSTOM_DELTA_CAP = 3;
  const CUSTOM_MID_RULE_ID = { VOL: 6, MC: 8, MA: 12, PD: 11, PE: 14 };
  const CUSTOM_ATK_RULE_ID = { ATA: 16, SA: 15, PD: 15, PE: 15 };

  // Usia mulai regresi spesifik per posisi (v1.2.0 #21447 & OTA 2.1.0 #22062 declineStartAge)
  const DECLINE_START_AGE = {
    // Classic: ATA/SA/PD/PE/MA=31, ZD/ZE=33, G=34, SISANYA=32 (termasuk MO, ZAG, Z)
    ATA: 31, A: 31, SA: 31, PD: 31, PE: 31, MA: 31,
    LD: 32, LE: 32, LAT: 32, VOL: 32, V: 32, MC: 32, MD: 32, ME: 32, MEI: 32, MO: 32,
    ZD: 33, ZE: 33, ZAG: 32, Z: 32,
    G: 34,
  };

  // OTA 2.1.0 (#22062): saat mode Real Scale 0-100 aktif -> G=35, outfield=33
  const DECLINE_START_AGE_SCALE100 = { G: 35, default: 33 };

  // OTA 2.1.0 (#3611 & #24952 releaseClauseOf): Klausul rilis per wilayah (ganti buyoutMul flat 2x)
  const RELEASE_CLAUSE = { europe: 3.0, brazil: 1.5, other: 2.0 };

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

  // Bytecode #3452 L705456: SEAT_COST_TIERS, SEAT_COST_MUL = 3, STADIUM_COST_DIV_MUL, fixed work cost 300000 * costMul (#19807)
  const SEAT_COST_MUL = 3;
  const STADIUM_WORK_FIXED_COST = 300000;
  const STADIUM_COST_DIV_MUL = {
    0: 0.25,
    1: 1.00,
    2: 0.60,
    3: 0.30,
    4: 0.25,
  };

  // Bytecode #3611 env[62] SEAT_COST_TIERS + #20282 seatCost (#20292 calculateStadiumExpansion)
  const STADIUM_SEAT_TIERS = {
    geral: [
      [1000, 80],
      [2500, 160],
      [3500, 240],
      [10000, 500],
      [18000, 700],
      [20000, 700],
      [22000, 800],
    ],
    arquibancada: [
      [5000, 120],
      [15000, 380],
      [30000, 640],
      [60000, 700],
      [80000, 1400],
      [99000, 1400],
    ],
    cadeiras: [
      [1000, 300],
      [2000, 600],
      [3000, 750],
      [5000, 800],
      [9000, 1200],
      [10000, 1200],
    ],
    camarotes: [
      [100, 1500],
      [200, 3500],
      [500, 4000],
      [600, 6000],
      [700, 6400],
      [800, 6400],
      [900, 7000],
      [1000, 7300],
    ],
  };

  // Bytecode #21255 priceFactor(m, e), #21260–#21277, #3525: Club Shop & Member Plan v9
  const PRICE_FACTOR_MIN = 0.1;
  const PRICE_FACTOR_MAX = 1.35;

  const SHOP_ELAST = { lin: 1.0, up: 1.3, down: 0.8 };
  const SHOP_OPTIMAL_MUL = 1.00;
  const SHOP_MEGA_DAYS = 365;
  const SHOP_MEGA_BONUS = 0.30;
  const SHOP_SIGNING_DAYS = 90;
  const SHOP_SIGNING_BONUS = 0.08;
  const SHOP_STAR_MAX = 0.30;
  const SHOP_FANS_STADIUM_MIN = 0.85;
  const SHOP_FANS_STADIUM_MAX = 1.15;

  // Bytecode #3841 FX & #51163 (_loop5): Home MID & Home Shot bonus
  const MATCH_HOME_MID = 0.3;
  const MATCH_HOME_SHOT = 0;

  const MEMBER_ELAST = { lin: 0.9, up: 1.2, down: 0.8 };
  const MEMBER_PRICE_MIN = 0.5;
  const MEMBER_PRICE_MAX = 2.0;
  const MEMBER_DISC_MAX = 30;            // 30% max annual discount
  const MEMBER_ANNUAL_PER_DISC = 0.03;   // annualShare = min(0.80, dPct * 0.03) = min(0.80, dFrac * 3)
  const MEMBER_ANNUAL_SHARE_MAX = 0.80;
  const MEMBER_LOYAL = 0.12;             // memberDemand = priceFactor * (1 + 0.12 * annualShare)
  const MEMBER_RETAIN = 1.0;             // Legacy alias kept at 1.0 (no separate retain factor in v9)
  const MEMBER_OPTIMAL_MUL = 1.05;       // #21255 Math.exp -> peak at 1.05x + 6% discount (1.0114)
  const MEMBER_OPTIMAL_DISC = 6;

  // Naming Rights multiplier per durasi (#3525 L716176: NAMING_YEARS=[1,3,5], NAMING_WARN_MONTHS=3)
  const NAMING_WARN_MONTHS = 3;
  const NAMING_DURATION_MULT = {
    1: 1.15,
    3: 1.00,
    5: 0.88,
  };

  // CT Upgrade & Milestones (#21411, #21418, #21426, #3459 L705815)
  const CT_COST_SHARE = {
    1: 0.00,
    2: 0.05,
    3: 0.07,
    4: 0.10,
    5: 0.13,
    6: 0.17,
    7: 0.22,
    8: 0.28,
    9: 0.35,
    10: 0.45,
  };

  const CT_BUILD_DAYS = {
    1: 0, 2: 30, 3: 40, 4: 50, 5: 60, 6: 75, 7: 90, 8: 110, 9: 130, 10: 160,
  };

  // Legacy aliases kept for backwards compatibility
  const CT_UPGRADE_COSTS = CT_COST_SHARE;
  const CT_UPGRADE_WEEKS = CT_BUILD_DAYS;

  // Share dari PAYROLL_REF tahunan dibagi 12, dibulatkan ke kelipatan 100 (#21418, #3459 L705819)
  const CT_UPKEEP_SHARE = {
    1: 0.000,
    2: 0.005,
    3: 0.010,
    4: 0.015,
    5: 0.020,
    6: 0.025,
    7: 0.030,
    8: 0.035,
    9: 0.040,
    10: 0.050,
  };

  // #21426 ctEffectsOf & #3459 L705819 CT_MILESTONES
  const CT_MILESTONES = [
    { level: 1, slots: 3, perk: 'Dasar (3 slot latihan khusus)' },
    { level: 2, slots: 3, perk: 'Pertumbuhan Pemain Muda +1.5% (usia ≤23 thn)' },
    { level: 3, slots: 4, perk: '+1 Slot Latihan (total 4) & Diskon Biaya Olheiro da Base 0.75x (-25%)' },
    { level: 4, slots: 4, perk: 'Pertumbuhan Seluruh Skuad +1.0%' },
    { level: 5, slots: 5, perk: '+1 Slot Latihan (total 5) & Regresi Veteran melambat 0.80x (-20%)' },
    { level: 6, slots: 5, perk: 'Junior Boost Akademi (+1 kualitas batch tahunan)' },
    { level: 7, slots: 6, perk: '+1 Slot Latihan (total 6) & Durasi Cedera 0.80x (-20%)' },
    { level: 8, slots: 6, perk: 'Exact Potential Akademi (bintang & potensi asli terbuka 100% tanpa kabut)' },
    { level: 9, slots: 7, perk: '+1 Slot Latihan (maks 7) & Pemulihan Energi 1.10x (+10%)' },
    { level: 10, slots: 7, perk: 'Ceiling Bonus Transfer +3 Force (plafon rekrutmen klub naik +3)' },
  ];

  // #21707–#21709 & #3459 L705865: Youth Coach 0..3, no hire cost, dev bonus +15%/lv
  const YOUTH_COACH_MAX_LEVEL = 3;
  const YOUTH_COACH_DEV_BONUS_PER_LV = 0.15;
  const YOUTH_COACH_COSTS = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const YOUTH_COACH_SALARY_SHARE = { 0: 0.000, 1: 0.004, 2: 0.008, 3: 0.015 };

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

  // Bytecode #3659, #21513, #21517, #24934-#24941: Geografi (6 grup resmi), Afiliasi & Batas Transfer
  const COUNTRY_GROUPS = {
    0: ['AL', 'DE', 'AD', 'AM', 'AT', 'AZ', 'BE', 'BY', 'BA', 'BG', 'KZ', 'CY', 'HR', 'DK', 'SC', 'SK', 'SI', 'ES', 'EE', 'FI', 'FR', 'GE', 'GR', 'NL', 'HU', 'FO', 'EN', 'GB', 'IE', 'NIR', 'IS', 'IL', 'IT', 'ME', 'XK', 'LV', 'LI', 'LT', 'LU', 'MK', 'MT', 'MD', 'MC', 'NO', 'WL', 'PL', 'PT', 'CZ', 'RO', 'RU', 'SM', 'RS', 'SE', 'CH', 'TR', 'UA', 'GI'],
    1: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'PY', 'PE', 'UY', 'VE'],
    2: ['ZA', 'AO', 'DZ', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'TD', 'CG', 'CI', 'DJ', 'EG', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'GQ', 'KE', 'LS', 'LY', 'LR', 'MG', 'MW', 'ML', 'MA', 'MR', 'MZ', 'NA', 'NE', 'NG', 'CF', 'CD', 'RW', 'ST', 'SN', 'SL', 'SYC', 'SO', 'SZ', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW', 'KM', 'MU', 'SS'],
    3: ['AF', 'SA', 'AU', 'BH', 'BD', 'BN', 'BT', 'KH', 'QA', 'CN', 'TL', 'KP', 'KR', 'AE', 'PH', 'HK', 'YE', 'IN', 'ID', 'IR', 'IQ', 'JP', 'JO', 'KW', 'LA', 'LB', 'MO', 'MY', 'MV', 'MM', 'MN', 'NP', 'OM', 'PS', 'PK', 'KG', 'SG', 'SY', 'LK', 'TJ', 'TH', 'TW', 'TM', 'UZ', 'VN'],
    4: ['AI', 'AG', 'CW', 'AW', 'BS', 'BB', 'BZ', 'BM', 'CA', 'CR', 'CU', 'DM', 'SV', 'US', 'GD', 'GT', 'GY', 'HT', 'HN', 'KY', 'VG', 'JM', 'MX', 'NI', 'PA', 'PR', 'DO', 'LC', 'KN', 'VC', 'SR', 'TT', 'VI', 'MS', 'TC', 'GP', 'MQ', 'GF'],
    5: ['FJ', 'CK', 'SB', 'NZ', 'PG', 'WS', 'PF', 'TO', 'VU', 'FM', 'MH', 'NR', 'PW', 'KI', 'TV', 'AS', 'NC', 'GU'],
  };

  const UK_CODES = ['EN', 'GB', 'WL', 'SC', 'NIR', 'EN-EL', 'EN-SL', 'EN-WL', 'EN-NL'];

  // Bytecode #3454 L705658: 5 AFFINITY_CLUSTERS resmi
  const AFFINITY_CLUSTERS = [
    ['BR', 'PT', 'AO', 'MZ', 'CV'],
    ['AR', 'UY', 'PY', 'CL', 'CO', 'PE', 'EC', 'BO', 'VE', 'MX', 'CR', 'HN', 'PA', 'SV', 'GT', 'ES'],
    ['EN', 'GB', 'WL', 'SC', 'NIR', 'IE', 'US', 'CA', 'AU', 'NZ'],
    ['FR', 'BE', 'SN', 'CI', 'CM', 'ML', 'BF', 'GN', 'CD', 'CG', 'GA', 'MA', 'DZ', 'TN'],
    ['DE', 'AT', 'CH', 'NL'],
  ];

  // Bytecode #24059 buyerForceCeiling (#3696 L793961)
  const REP_CEILING = { 0: 20, 1: 30, 2: 45, 3: 85, 4: 100, 5: 100 };
  const DIV_CEILING = { 0: 0, 1: 100, 2: 60, 3: 40, 4: 30, 5: 30 };

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
  // #24161 renewalMinimumSalary (diverifikasi langsung di bytecode):
  //   sisa kontrak <= 10 hari  -> minta NAIK  [+25%, +30%, +35%, +20%]  (6bln, 1th, 2th, 3th)
  //   11..59 hari              -> minta NAIK  [+10%, +12%, +15%, +5%]
  //   >= 60 hari               -> DISKON      [-1%, -3%, -5%, -12%]
  // Jadi diskon -12% (3 tahun) hanya didapat jika sisa kontrak >= 60 hari.
  const RENEWAL_TERMS_DAYS = [180, 365, 730, 1095];
  const RENEWAL_RAISE_LAST = [0.25, 0.30, 0.35, 0.20];
  const RENEWAL_RAISE_MID = [0.10, 0.12, 0.15, 0.05];
  const RENEWAL_DISCOUNT = [-0.01, -0.03, -0.05, -0.12];
  const RENEWAL_DISCOUNT_FROM_DAYS = 60;
  // Jendela saran aplikasi (heuristik): perpanjang 3 th selagi sisa 60..120 hari sebelum turun < 60.
  const RENEW_GOLDEN_MIN = 60;
  const RENEW_GOLDEN_MAX = 120;
  const RENEW_DISCOUNT_3YR = 0.12;
  const PRECONTRACT_DAYS = 180;

  // #21831 lockerRoomHit & #3726 MOOD_CFG: unhappyPenaltyMin = 4 (4+ unhappy), step = 0.01 (1%), cap = 0.04 (4%)
  const LOCKER_UNHAPPY_MIN = 4;
  const LOCKER_HIT_PER_PLAYER = 0.01;
  const LOCKER_HIT_CAP = 0.04;

  // #25089 AI_COUNTER {min:1.1, max:1.4, stretch:1.3} (E[maxWilling]=1.25x); #25091 AI_OFFER_MUL
  const COUNTER_MAX_NORMAL = 1.40;
  const COUNTER_AVG_REALIZED = 1.25;
  const COUNTER_ARAB_BONUS = 2.50;
  const ARAB_OFFER_MIN_MUL = 2.50;
  const ARAB_OFFER_MAX_MUL = 3.00;
  const AI_OFFER_MUL = { young: 1.50, mid: 1.35, old: 1.30 };

  // Legacy aliases deprecated (#25088 saleFeeRate = terminationFeeRate(contractDays); incoming offer = 0%)
  const SELL_TAX_THRESHOLD = 0;
  const SELL_TAX_LOW = 0.0;
  const SELL_TAX_HIGH = 0.0;

  // Bytecode #24721 windowsOf (realTransferWindows per negara, MM-DD)
  const TRANSFER_WINDOW_DEFAULT = [['01-01', '02-02'], ['06-15', '09-01']];
  const TRANSFER_WINDOWS = {
    BR: [['01-01', '03-03'], ['07-20', '09-11']],
    AR: [['01-01', '02-28'], ['06-20', '08-10']],
    CL: [['01-01', '02-28'], ['06-20', '08-10']],
    CO: [['01-01', '02-28'], ['06-20', '08-10']],
    PE: [['01-01', '02-28'], ['06-20', '08-10']],
    UY: [['01-01', '02-28'], ['06-20', '08-10']],
    PY: [['01-01', '02-28'], ['06-20', '08-10']],
    EC: [['01-01', '02-28'], ['06-20', '08-10']],
    BO: [['01-01', '02-28'], ['06-20', '08-10']],
    VE: [['01-01', '02-28'], ['06-20', '08-10']],
    ES: [['01-01', '02-02'], ['07-01', '09-01']],
    DE: [['01-01', '02-02'], ['07-01', '08-31']],
    IT: [['01-01', '02-02'], ['06-29', '09-01']],
    PT: [['01-01', '02-02'], ['07-01', '09-01']],
    SC: [['01-01', '02-02'], ['06-15', '09-03']],
    US: [['02-01', '04-24'], ['07-24', '08-21']],
    CA: [['02-01', '04-24'], ['07-24', '08-21']],
    JP: [['01-06', '03-27'], ['07-17', '08-14']],
    KR: [['01-01', '03-26'], ['07-01', '07-31']],
    CN: [['01-01', '02-28'], ['07-01', '07-31']],
    NO: [['01-07', '03-31'], ['07-15', '08-31']],
    SE: [['01-07', '03-31'], ['07-15', '08-31']],
    FI: [['01-07', '03-31'], ['07-15', '08-31']],
    IS: [['01-07', '03-31'], ['07-15', '08-31']],
    FO: [['01-07', '03-31'], ['07-15', '08-31']],
    IE: [['01-07', '03-31'], ['07-15', '08-31']],
    LT: [['01-07', '03-31'], ['07-15', '08-31']],
    LV: [['01-07', '03-31'], ['07-15', '08-31']],
    EE: [['01-07', '03-31'], ['07-15', '08-31']],
    BY: [['01-07', '03-31'], ['07-15', '08-31']],
    KZ: [['01-07', '03-31'], ['07-15', '08-31']],
    SA: [['01-01', '02-01'], ['06-15', '09-10']],
  };

  // Bytecode #3886 env[54..56], #24929 minForceFor, #24933 buyerAcceptsPlayer, #25045 findInterestedTeams:
  // Kelayakan klub AI pembeli TIDAK memeriksa budget kas klub; memakai minForce divisi/rep, REP_CEILING, & veteranFits.
  const BUYER_MIN_FORCE_BY_DIV = [1, 40, 30, 20, 5, 5];
  const BUYER_MIN_FORCE_BY_REP = [1, 10, 20, 40, 50, 55];
  const PURCHASE_OFFER_MAX_ASK_MUL = 1.10;
  const AUCTION_MAX_MUL = 1.20;

  // Bytecode #3541: Salary Cut & Termination Tiers
  // SALARY_FLOOR (#3723) + #24159 salaryCutLocked + #24160 salaryFloorFactor + #24162 salaryCutMinimum
  //   terkunci jika salaryCuts >= maxCuts (1) — renewRefusals TIDAK mengunci.
  //   factor = max(0.5, 1 + (idx>=11 ? reserve : 0) + (age>=32 ? veteran : 0) + cuts*perCut + refusals*perRefusal)
  //   gaji minimum = min(gaji, round(gaji * cutBase * factor))
  const SALARY_CUT = {
    maxPct: 0.30,
    moodSteps: [0.10, 0.20],
    reserve: -0.12,
    veteran: -0.10,
    veteranAge: 32,
    perCut: 0.05,
    perRefusal: 0.03,
    cutBase: 0.9,
    maxCuts: 1,
  };

  // #19789 terminationFeeRate (sisa hari <= 0 -> 0)
  const TERMINATION_FEE_TIERS = [
    { maxDays: 30,   rate: 0.12 },
    { maxDays: 60,   rate: 0.20 },
    { maxDays: 90,   rate: 0.22 },
    { maxDays: 180,  rate: 0.25 },
    { maxDays: 99999, rate: 0.30 },
  ];

  // Bytecode #3611 & #23498/#20972: Injured Sale Discount (OTA 2.1.0)
  // <=10d: 0.70, <=28d: 0.55, <=70d: 0.40, >70d: 0.25
  const INJURED_SALE = {
    minorMaxDays: 10,
    moderateMaxDays: 28,
    majorMaxDays: 70,
    minorFactor: 0.70,
    moderateFactor: 0.55,
    majorFactor: 0.40,
    severeFactor: 0.25,
  };

  // Bytecode #3611 & #25091: Youth Scout U-21 incoming AI scout valuation & Rival Junior floors
  const YOUTH_SCOUT = {
    maxAge: 21,
    minGrowthMargin: 10,
    priceFactor: 2.0,
    maxPerSeason: 2,
  };

  const RIVAL_JUNIOR_DIV_FLOOR = [50000, 300000, 200000, 120000, 80000, 50000];
  const RIVAL_JUNIOR_STAR_FLOOR = { 8: 600000, 9: 1500000, 10: 3000000 };

  // Bytecode #3611 & #22134: Squad Moods
  // Tier 2 (natural starter auto): 0.25; explicit role='starter' atau roleSore: 0.40; Happy: 0.60/0.35/0.15
  const MOOD_CFG = {
    minGames: 6,
    starterQuota: 0.25,
    explicitStarterQuota: 0.40,
    midQuota: 0.25,
    youngQuota: 0.08,
    happyTop: 0.60,
    happySub: 0.35,
    happyRes: 0.15,
    injuryDaysPerGame: 4,
    unhappyPenaltyMin: 4,
    unhappyPenaltyStep: 0.01,
    unhappyPenaltyMax: 0.04,
  };

  const UNHAPPY_GROWTH = 0.5;

  // Bytecode #3611 slot 227-229, 273 & #24934-#24951: Seller Stance, Persuade & Star Pull
  const SELLER_STANCE = {
    maxPremium: 0.50,
    maxDiscount: 0.30,
    weight: { worldTop: 0.20, craque: 0.14, keyTop: 0.12, starter: 0.08 },
    keyTop: 3,
    starters: 11,
    topScorer: 0.08,
    scorerMinGoals: 4,
    captain: 0.03,
    onlyOne: 0.06,
    scarceGap: 10,
    midSeason: 0.04,
    midGames: 10,
    endGames: 30,
    levelScale: [1, 0.5, 0.2, 0.1],
    betterDivisionScale: 0.2,
    poorCash: 0.10,
    redCash: 0.20,
    poorMonths: 3,
    contractEnds: 0.08,
    veteranFrom: 32,
    veteranPerYear: 0.05,
    veteranMax: 0.20,
    refuseTop: 3,
    scarce: { starter: 0.50, backup: 0.30 },
  };

  const BUY_PERSUADE = {
    levelGap: 2,
    forceOver: 5,
    wageFloor: 2.5,
    base: 0.25,
    perWage: 0.05,
    perPrice: 0.06,
    max: 0.85,
    starterBonus: 0.15,
  };

  const STAR_PULL = {
    minGap: 5,
    top: 5,
    loanOver: 3,
  };

  // Bytecode #3611 & #21911: Quadratic Market Value Constants (OTA 2.1.0)
  const VALUE_K_BY_LEVEL = [[21, 750], [20, 600], [18, 500], [12, 400], [0, 366]];
  const VALUE_CRAQUE_MUL = { europeElite: 3, europeBig: 2, default: 1.7 };
  const VALUE_WORLDTOP_MUL = 1.6;
  const VALUE_ATTACKER_MUL = 1.3;
  const VALUE_HIGHLIGHT_MUL = 1.2;
  const VALUE_AGE_TERMS = [[19, 32, 27], [25, 32, 22], [31, 32, 15], [33, 34, 10]];
  const VALUE_AGE_OLD_CUT = 50;
  const VALUE_LOW_LEVEL_MUL = [[0, 0.08], [2, 0.12], [4, 0.18], [6, 0.28], [8, 0.42], [10, 0.65], [12, 1]];
  const VALUE_OLD_MUL = [[40, 0.1], [39, 0.14], [38, 0.19], [37, 0.26], [36, 0.35], [35, 0.47], [34, 0.62], [33, 0.78], [32, 0.9]];
  const VALUE_YOUNG_BONUS = { perPoint: 0.018, max: 0.4, weights: [[19, 1], [21, 0.8], [23, 0.55], [25, 0.3]] };
  const VALUE_K_MIN = 60;
  const VALUE_YOUTH_FRACTION = 0.03;
  const VALUE_YOUTH_RAMP = { ageFrom: 19, ageTo: 22, forceFrom: 40, forceTo: 60 };
  const EURO_TOP_BONUS = 1.05;
  const EURO_TOP_MIN_LEVEL = 20;

  // Bytecode #3545: Red Card Fine
  const FINE_CFG = {
    maxPct: 1.00,
    safePct: 0.20,
    midPct: 0.50,
    slumpChanceMid: 0.25,
    slumpChanceHigh: 0.50,
  };

  // Bytecode #21089 loanBuyDecisionChance & #3611 env[241] LOAN_OPTION
  const LOAN_OPTION = {
    minMul: 1,
    star: 0.15,
    near: 0.85,
    maxMul: 3,
    maxChance: 0.95,
  };

  // Bytecode #3640 & #35210: Shout Decay per pengulangan shout yang sama dalam 25 menit [1, 0.5, 0]
  const SHOUT_DECAY = [1.0, 0.5, 0.0];

  const LIVE_COACH_GUIDE = {
    shouts: [
      {
        name: 'Encourage — MID (+1.0% / +1.2%)',
        when: 'Imbang atau Tertinggal di Babak 1/2',
        situation: 'Memenangkan duel lini tengah & shot attempt',
        shout: 'Encourage',
        effect: 'Menang +1.0% MID · Imbang +1.2% MID · Kalah +1.2% MID (+sedikit lelah; pengulangan beruntun shout sama: 1.0x → 0.5x → 0x)',
        avoid: 'Jangan ulang shout identik beruntun lebih dari 2x karena pemakaian ke-3 memberi efek 0%!',
      },
      {
        name: 'Demand More — ATK (Kalah +1.2% / Menang -0.8%!)',
        when: 'Hanya saat Imbang (+1.0% ATK) atau Tertinggal (+1.2% ATK)',
        situation: 'Mengejar gol penyeimbang / comeback',
        shout: 'Demand More',
        effect: 'Menang -0.8% ATK (MERUGIKAN!) · Imbang +1.0% ATK · Kalah +1.2% ATK (+lebih lelah & +kartu)',
        avoid: 'DILARANG dipakai saat sedang UNGGUL karena menurunkan ATK -0.8% + menambah kartu & kelelahan!',
      },
      {
        name: 'Fire Up — ATK (Kalah +1.2% / Menang 0%)',
        when: 'Hanya saat Tertinggal (+1.2% ATK) atau Imbang (+0.8% ATK)',
        situation: 'Tertinggal dan butuh dorongan serangan maksimal',
        shout: 'Fire Up',
        effect: 'Menang 0% (sia-sia!) · Imbang +0.8% ATK · Kalah +1.2% ATK (+cepat lelah & +risiko kartu lebih tinggi)',
        avoid: 'Jangan buang kuota shout saat sedang unggul karena memberi 0% efek sambil menguras stamina.',
      },
      {
        name: 'Focus — DEF (+1.2% Menang / +1.0% Imbang)',
        when: 'Mengamankan keunggulan / meredam serangan balik',
        situation: 'Unggul tipis atau ingin merapatkan pertahanan',
        shout: 'Focus',
        effect: 'Menang +1.2% DEF · Imbang +1.0% DEF · Kalah +0.6% DEF (tanpa penalti kartu)',
        avoid: 'Selingi dengan Calm Down jika butuh pengurangan kartu sekaligus mempertahankan +1.2% DEF.',
      },
      {
        name: 'Praise — MID (Menang +1.2% / Kalah -0.8%!)',
        when: 'Hanya saat UNGGUL (+1.2% MID)',
        situation: 'Menjaga momentum penguasaan bola saat memimpin',
        shout: 'Praise',
        effect: 'Menang +1.2% MID · Imbang +0.4% MID · Kalah -0.8% MID (MERUGIKAN saat tertinggal!)',
        avoid: 'JANGAN pernah dipakai saat tertinggal karena menurunkan MID -0.8%!',
      },
      {
        name: 'Calm Down — DEF (Menang +1.2% & −Kartu)',
        when: 'Saat Unggul / Banyak Pemain Terkena Kartu',
        situation: 'Wasit ketat atau agresivitas tim terlalu tinggi',
        shout: 'Calm Down',
        effect: 'Menang +1.2% DEF · Imbang +0.6% DEF · Kalah 0% (menurunkan risiko pelanggaran & kartu)',
        avoid: 'Ganti ke Focus saat imbang (+1.0% DEF) atau Encourage jika butuh mendorong penguasaan MID.',
      },
    ],
    orders: [
      {
        cond: 'Unggul Skor — Kunci Laga',
        order: 'Lock the Door (+1.5% DEF, -1.5% ATK, -5% Lelah, +5% Kartu)',
        note: 'Aktif permanen sampai diganti (#3700). Menguatkan DEF +1.5% dengan kelelahan sedikit lebih ringan dibanding membiarkan tim terbuka.',
      },
      {
        cond: 'Unggul di Menit Akhir (75+)',
        order: 'Time-Wasting (+1.0% DEF, +0.5% MID, -1.5% ATK, -10% Lelah, +30% Kartu)',
        note: 'Efek DEF/MID/ATK HANYA aktif saat sedang memimpin! Hindari jika wasit ketat (+30% risiko kartu kuning).',
      },
      {
        cond: 'Kontrol Bola & Hemat Stamina',
        order: 'Pass and Move (+1.2% MID, -0.6% ATK, Lebih Hemat Stamina & Lebih Sedikit Kartu)',
        note: 'Order paling seimbang saat imbang atau unggul tipis: menaikkan duel MID sekaligus menurunkan kelelahan dan pelanggaran.',
      },
      {
        cond: 'Punya Sayap CRS + Penyerang CAB',
        order: 'Crosses (+1.0% ATK, -1.0% MID) / Long Ball (+1.2% ATK, -1.2% MID)',
        note: 'Crosses butuh winger/fullback ber-skill CRS & penyerang CAB (minimal orderFit 0.30). Long Ball butuh penyerang ber-skill VEL/CAB.',
      },
      {
        cond: 'Mengejar Gol (Menit 70+ / Tertinggal)',
        order: 'All-Out Attack (+1.5% ATK, -1.5% DEF, +Lebih Lelah & +Lebih Banyak Kartu)',
        note: 'Aktifkan hanya satu order per waktu (order baru menggantikan order lama). Siapkan sub segar karena stamina terkuras lebih cepat.',
      },
      {
        cond: 'Bertahan Total / Sapu Bersih',
        order: 'Clear It (+1.2% DEF, -1.2% MID, 0% ATK)',
        note: 'Membuang bola dari kotak penalti: memperkuat pertahanan +1.2% tanpa memotong ATK, namun melepaskan kendali lini tengah -1.2%.',
      },
    ],
    subsRule: 'Di #21779 & #35197, kuota pergantian adalah 5 pemain (6 jika Extra Time). Hanya 1 Order yang aktif pada satu waktu sampai kamu menggantinya. AI Match Order dapat menyisipkan pemain rotation atau memasukkan supersub VEL/FIN segar.',
    redCardRule: 'Jika terkena Kartu Merah: (1) Usai laga beri denda manual tepat 20% gaji (0% fineSlump!), (2) Di lapangan segera ganti ke Lock the Door (+1.5% DEF) / Clear It (+1.2% DEF) dan isi sektor kosong.',
  };

  // Bytecode #19825 matchTicketKind & Env[15] continental map
  const CONT_TICKET_MAP = {
    championsLeague: { kind: 'continental1', region: 0 },
    europaLeague: { kind: 'continental2', region: 0 },
    conferenceLeague: { kind: 'continental3', region: 0 },
    libertadores: { kind: 'continental1', region: 1 },
    sulAmericana: { kind: 'continental2', region: 1 },
    intercontinentalCup: { kind: 'world', region: 0 },
    'cont:lib': { kind: 'continental1', region: 1 },
    'cont:sula': { kind: 'continental2', region: 1 },
    'cont:ucl': { kind: 'continental1', region: 0 },
    'cont:uel': { kind: 'continental2', region: 0 },
    'cont:conf': { kind: 'continental3', region: 0 },
    'cont:caf': { kind: 'continental1', region: 2 },
    'cont:afc': { kind: 'continental1', region: 4 },
    'cont:cafc': { kind: 'continental2', region: 2 },
    'cont:afc2': { kind: 'continental2', region: 4 },
    'cont:concacaf': { kind: 'continental1', region: 3 },
    'cont:lcup': { kind: 'continental2', region: 3 },
    'cont:ofc': { kind: 'continental1', region: 5 },
    'cont:mundial': { kind: 'world', region: 0 },
    'cont:cwc': { kind: 'world', region: 0 },
    'cont:icc': { kind: 'world', region: 0 },
    'cont:recopa': { kind: 'supercup', region: 1 },
    'cont:supuefa': { kind: 'supercup', region: 0 },
  };

  const CLASSICS_RAW = [["ogol-4297","al-wahda-tripoli","Abu Dhabi City derby",2],["ogol-9511","ogol-8610","Bur Dubai derby",2],["kf-tirana","partizani-alb","Tirana derby",1],["1deagosto-ang","petroluanda-ang","Derbi do Povo",1],["banfield","lanus","Clásico del Sur",1],["belgrano","talleres","Clásico Cordobés",1],["boca-juniors","river-plate","Superclásico",1],["colon","union-arg","Clásico Santafesino",1],["estudiantes-de-la-plata","gimnasia-de-la-plata","Clásico Platense",1],["huracan","san-lorenzo","",1],["independiente","racing-club","Clásico de Avellaneda",1],["newell-s-old-boys","rosario-central","Clásico Rosarino",1],["all-boys","nueva-chicago","Superclásico del Ascenso",2],["almagro","estudiantesba-arg","Clásico de Tres de Febrero",2],["atlanta","chacarita-juniors","Clásico de Villa Crespo",2],["atletico-tucuman","san-martin-de-tucuman","Clásico Tucumano",2],["gimnasia-de-mendoza","independienteridavia-arg","Clásico Mendocino",2],["godoy-cruz","san-martin","Clásico Cuyano",2],["instituto-arg","racingcordoba-arg","",2],["platense","tigre","Clásico del Norte",2],["rapidviena-aut","austria-wien","Wiener Derby",1],["admirawacker-aut","stpotten-aut","Niederösterreich-Derby",2],["austria-lustenau","rheindorf-altach","Vorarlberg-Derby",2],["austria-lustenau","schwarzweib-aut","Vorarlberg-Derby",2],["blau-weiss-linz","lask-linz","Linzer Derby",2],["grazerak-aut","sturm-graz","Grazer Derby",2],["lask-linz","sv-ried","Oberösterreich-Derby",2],["salzburg-aut","austria-salzburg","Salzburger Derby",2],["rheindorf-altach","schwarzweib-aut","Vorarlberg-Derby",2],["sturm-graz","rapidviena-aut","",2],["wacker-innsbruck","austria-salzburg","Westderby",2],["wsg-tirol","wacker-innsbruck","Tiroler Derby",2],["melbourne-victory","melbourne-city","Melbourne derby",1],["melbourne-victory","sydney-fc","The Big Blue",1],["sydney-fc","westernsydney-aus","Sydney derby",1],["adelaideunited-aus","melbourne-victory","The Original Rivalry",2],["central-fc","newcastle-jets","F3 derby",2],["wellingtonphoenix-aus","auckland-aus","New Zealand derby",2],["westernsydney-aus","macarthur-aus","Battle of the West",2],["zeljeznicar-ser","saraievo-bos","Sarajevo derby",1],["zrinjski-bos","velezmostar-bos","Mostar derby",1],["rudarprijedor-bos","borac-banja-luka","Krajina derby",2],["sirokibrijeg-bos","hskposusje-bos","Susjedski derbi",2],["zrinjski-bos","sirokibrijeg-bos","Herzegovina derby",2],["anderlecht","standard-liege","Le Classique",1],["anderlecht","club-brugge","De Topper",1],["anderlecht","union-saint-gilloise","Brusselse Derby",1],["club-brugge","cercle-brugge","Brugse Derby",1],["royal-antwerp","beerschot-bel","Antwerpse Derby",1],["charleroi","raal-bel","Derby du Hainaut",2],["club-brugge","gent-bel","Slag om Vlaanderen",2],["genk","sint-bel","Limburgse Derby",2],["gent-bel","lokeren-bel","Oost-Vlaamse Derby",2],["kv-mechelen","oh-leuven","Dijlederby",2],["lierse-bel","kv-mechelen","Derby van de provincie Antwerpen",2],["sk-beveren","lokeren-bel","Waaslandderby",2],["standard-liege","charleroi","Choc wallon",2],["standard-liege","liege-bel","Derby liégeois",2],["standard-liege","seraing","Derby de la province de Liège",2],["zulte-waregem","kortrijk","Zuid-West-Vlaamse Derby",2],["botev-plovdiv","lokoplovdiv-bul","Plovdiv derby",1],["levski-sofia","cska-sofia","Eternal derby",1],["cska-sofia","slaviasofia-bul","Sofia derby",2],["levski-sofia","slaviasofia-bul","Sofia derby",2],["slaviasofia-bul","lokomotivsofia-bul","Little Sofia derby",2],["spartakvarna-bul","chernomore-bul","Varna derby",2],["bolivar","the-strongest","Clásico Paceño",1],["oriente-petrolero","blooming","Clásico Cruceño",1],["jorgewil-bol","aurora","Clásico Cochabambino",2],["athletico-pr","coritiba","Atletiba",1],["atletico-mg","cruzeiro","Clássico Mineiro",1],["avai","figueirense","Clássico de Floripa",1],["bahia","vitoria","Ba-Vi",1],["botafogo","fluminense","Clássico Vovô",1],["botafogo","vasco-da-gama","Clássico da Amizade",1],["ceara","fortaleza","Clássico-Rei",1],["corinthians","palmeiras","Derby Paulista",1],["corinthians","sao-paulo","Majestoso",1],["corinthians","santos","Clássico Alvinegro",1],["flamengo","fluminense","Fla-Flu",1],["flamengo","vasco-da-gama","Clássico dos Milhões",1],["flamengo","botafogo","Clássico da Rivalidade",1],["fluminense","vasco-da-gama","Clássico dos Gigantes",1],["goias","vila-nova","",1],["gremio","internacional","Grenal",1],["guarani-campinas","ponte-preta","Dérbi Campineiro",1],["nautico","santa-cruz","Clássico das Emoções",1],["palmeiras","sao-paulo","Choque-Rei",1],["palmeiras","santos","Clássico da Saudade",1],["remo","paysandu","Re-Pa",1],["santos","sao-paulo","San-São",1],["sport","nautico","Clássico dos Clássicos",1],["sport","santa-cruz","Clássico das Multidões",1],["abc","americarn","Clássico-Rei de Natal",2],["ogol-3104","ogol-3261","Goyta-Cano",2],["araguaina-to","ogol-3282","Clássico Norte-Sul",2],["athletico-pr","parana","Paratico",2],["atletico-mg","america-mg","",2],["ogol-3264","guaranyrs-bra","Ba-Gua",2],["bahiafeira-ba","ogol-3247","",2],["bangu-bra","ogol-3172","",2],["ogol-3151","ogol-3369","Clássico Leopoldinense",2],["botafogo-pb","trezepb-bra","Clássico Tradição",2],["botafogo-pb","campinensepb-bra","Clássico Emoção",2],["brasil-de-pelotas","pelotasrs-bra","Bra-Pel",2],["brasiliense-df","gama-df","",2],["campinensepb-bra","trezepb-bra","Clássico dos Maiorais",2],["caxias","juventude","Ca-Ju",2],["ceara","ferroviario","Clássico da Paz",2],["ogol-3202","botafogo-sp","Come-Fogo",2],["ogol-3200","operario-ms","Comerário",2],["confianca","sergipe-se","Dérbi Sergipano",2],["coritiba","parana","Paratiba",2],["crb","csa","Clássico das Multidões",2],["criciuma","joinville","",2],["criciuma","prospera-sc","Clássico do Carvão",2],["cruzeiro","america-mg","",2],["cuiaba","mixto-mt","Dérbi Cuiabano",2],["cuiaba","luverdensemt-bra","Clássico Ouro-Verde",2],["domboscomt","mixto-mt","Clássico Vovô",2],["ogol-9781","nacional-am","Clássico Pai e Filho",2],["ferroviario","fortaleza","Clássico das Cores",2],["goias","atletico-go","",2],["icasa-ce","ogol-3276","Clássico do Cariri",2],["londrina","maringa","Clássico do Café",2],["ogol-3334","urt-bra","Clássico do Milho",2],["motoclubma-bra","samapaiocorrea-ma","Superclássico Maranhense",2],["paysandu","tunaluso-pa","Pa-Tu",2],["remo","tunaluso-pa","Re-Tu",2],["resenderj-bra","volta-redonda","Clássico do Sul Fluminense",2],["riobranco-es","ogol-3224","",2],["ogol-13253","ogol-3244","Rivengo",2],["santoandre-sp","saocaetano-bra","Dérbi do ABC",2],["santos","ogol-3406","Dérbi Santista",2],["uberlandia","ogol-3504","Clássico do Triângulo",2],["vitoria-es","riobranco-es","Vi-Rio",2],["dinamo-minsk","bate-borisov","Belarusian Clasico",1],["basel","fc-zurich","Klassiker",1],["grasshopper-club-zurich","fc-zurich","Zürcher Derby",1],["basel","young-boys","",2],["fc-lugano","ac-bellinzona","Derby del Ticino",2],["fc-sion","fc-lausanne-sport","Derby romand",2],["fc-winterthur","grasshopper-club-zurich","Zürcher Kantonsderby",2],["fc-winterthur","fc-zurich","Zürcher Kantonsderby",2],["fc-lausanne-sport","fc-stade-lausanne-ouchy","Derby de Lausanne",2],["neuchatel-xamax","fc-sion","Derby romand",2],["neuchatel-xamax","fc-lausanne-sport","Derby romand",2],["servette","fc-lausanne-sport","Derby lémanique",2],["servette","fc-sion","Derby du Rhône",2],["st-gallen","wil-sui","St. Galler Derby",2],["young-boys","fc-thun","Berner Derby",2],["yverdon-sport-fc","fc-lausanne-sport","Derby vaudois",2],["colo-colo","universidad-chile","Superclásico",1],["universidad-chile","universidad-catolica","Clásico Universitario",1],["cobreloa","cobresal","Clásico del Cobre",2],["cobreloa","antofagasta","Clásico del Desierto",2],["colo-colo","universidad-catolica","",2],["colo-colo","cobreloa","",2],["deportes-la-serena","coquimbo-unido","Clásico de la Cuarta Región",2],["palestino","audax-italiano","Clásico de Colonias",2],["rangers-de-talca","curico-unido","Clásico del Maule",2],["rangers-de-talca","ohiggins-chi","Clásico Huaso",2],["san-luis","union-la-calera","Clásico Provincial",2],["san-marcos-arica","deportes-iquique","Clásico del Norte",2],["santiago-wanderers","everton-cl","Clásico Porteño",2],["union-espanola","palestino","Clásico de Colonias",2],["union-espanola","audax-italiano","Clásico de Colonias",2],["beijing-guoan","shanghai-shenhua","Jing-Hu derby",1],["shanghai-shenhua","shanghai-port","Shanghai derby",1],["beijing-guoan","tianjinteda-chn","Jing-Jin derby",2],["qingdaohainiu-chn","qingdaowc-chn","Qingdao derby",2],["america-de-cali","deportivo-cali","Clásico Vallecaucano",1],["atletico-nacional","indepmedellin-col","Clásico Paisa",1],["millonarios","santa-fe","Clásico Capitalino",1],["atletico-nacional","millonarios","",2],["junior-col","unionmagdalena-col","Clásico Costeño",2],["millonarios","deportivo-cali","Clásico Añejo",2],["once-caldas","deportivo-pereira","Clásico Cafetero",2],["alajuelense","deportivo-saprissa","Clásico Nacional",1],["apoel","omonia-nicosia","Nicosia Derby",1],["aellimassol-chp","aris-limassol","Limassol Derby",2],["anorthosisfamag-cyp","neasalamina-chp","Famagusta Derby",2],["apoel","olympiakosnicosia-chp","Nicosia Derby",2],["apoel","anorthosisfamag-cyp","",2],["apollon-limassol","aellimassol-chp","Limassol Derby",2],["apollon-limassol","aris-limassol","Limassol Derby",2],["omonia-nicosia","olympiakosnicosia-chp","Nicosia Derby",2],["sparta-praga","slavia-cze","Prague derby",1],["banik-ostrava","tm-479","Silesian derby",2],["hradeckralove-tch","pardubice-cze","East Bohemian derby",2],["fk-jablonec","slovan-liberec","Podjestedske derby",2],["slavia-cze","bohemians-cze","Vrsovice derby",2],["teplice-cze","tm-6377","Usti derby",2],["zbrojovkabrno-tch","sigma-cze","Moravian derby",2],["zbrojovkabrno-tch","slovacko-tch","Moravian derby",2],["zbrojovkabrno-tch","zlin-cze","Moravian derby",2],["bayern-ale","borussia-dortmund","Der Klassiker",1],["bayern-ale","tm-72","Münchner Derby",1],["borussia-dortmund","schalke-04","Revierderby",1],["borussia-monchengladbach","koln","Rheinderby",1],["fortuna-ale","koln","Rheinderby",1],["hamburgo-ale","st-pauli","Hamburger Stadtderby",1],["hannover-96","eintracht-braunschweig","Niedersachsenderby",1],["hertha-berlin","union-berlin","Berliner Derby",1],["nurnberg-ale","greuther-furth","Frankenderby",1],["werder-bremen","hamburgo-ale","Nordderby",1],["tm-1","tm-459","Saarlandderby",2],["arminia-bielefeld","preussenmunster-ale","Westfalenderby",2],["arminia-bielefeld","paderborn-07","Ostwestfalenderby",2],["borussia-dortmund","bochum","Revierderby",2],["borussia-dortmund","borussia-monchengladbach","Borussenderby",2],["tm-9572","tm-497","Leipziger Stadtderby",2],["dynamo-dresden","magdeburg","Elb-Clasico",2],["eintracht-frankfurt","darmstadt-98","Hessenderby",2],["eintracht-frankfurt","tm-293","Frankfurter Derby",2],["tm-113","tm-111","Thüringenderby",2],["tm-94","tm-275","",2],["tm-30","st-pauli","Politisches Derby",2],["koln","bayer-leverkusen","Rheinderby",2],["koln","tm-92","Kölner Derby",2],["koln","tm-1622","Kölner Derby",2],["union-berlin","tm-222","Ostberliner Derby",2],["fortuna-ale","borussia-monchengladbach","Rheinderby",2],["sc-freiburg","karlsruher-sc","Baden-Derby",2],["hamburgo-ale","bayern-ale","Nord-Süd-Gipfel",2],["heidenheim","tm-83","Ostalb-Derby",2],["tm-109","tm-4795","Donauderby",2],["kaiserslautern","tm-1","Südwestderby",2],["karlsruher-sc","vfb-stuttgart","Baden-Schwaben-Derby",2],["tm-107","darmstadt-98","Hessenderby",2],["nurnberg-ale","bayern-ale","Bayernderby",2],["preussenmunster-ale","osnabruck","Grenzlandderby",2],["tm-56","tm-52","",2],["tm-92","tm-1622","Kölner Derby",2],["schalke-04","bochum","Revierderby",2],["tm-90","energie-cottbus","Brandenburg-Derby",2],["tm-85","tm-106","Mannheimer Derby",2],["tm-78","holstein-kiel","Holsteinderby",2],["vfb-stuttgart","bayern-ale","Südderby",2],["vfb-stuttgart","tm-71","Stuttgarter Derby",2],["bochum","tm-97","Bochumer Derby",2],["br-ndby-if","copenhague-din","Copenhagen derby",1],["aalborg-bk","aarhus-gf","Battle of Jutland",2],["ogol-900002272","ogol-900001930","Algiers derby",1],["ogol-900002272","cr-belouizdad","Algiers derby",1],["ogol-900001930","cr-belouizdad","Algiers derby",1],["es-setif","ogol-900002042","East derby",2],["ogol-900002272","js-kabylie","Algerian Clasico",2],["barcelona-equ","emelec","Clásico del Astillero",1],["ldu","aucas","Superclásico de Quito",2],["ldu","el-nacional","Clásico Quiteño",2],["floratallinn-est","fci-levadia","Tallinn derby",1],["al-ahly","zamalek","Cairo Derby",1],["al-ittihad-alexandria","smouha","Alexandria derby",2],["ismaily","elmasry-egi","Canal Derby",2],["arsenal","tottenham-hotspur","North London Derby",1],["aston-villa","birmingham-city","Second City Derby",1],["blackburn-rovers","burnley","East Lancashire Derby",1],["bristol-city","tm-2455","Bristol Derby",1],["cardiff-city","swansea-city","South Wales Derby",1],["crystal-palace","brighton-hove-albion","M23 Derby",1],["ipswich-town","norwich-city","East Anglian Derby",1],["leeds-united","manchester-united","War of the Roses",1],["liverpool","everton","Merseyside Derby",1],["liverpool","manchester-united","North West Derby",1],["manchester-united","manchester-city","Manchester Derby",1],["millwall","west-ham","Dockers Derby",1],["newcastle-united","sunderland","Tyne-Wear Derby",1],["nottingham-forest","derby-county","East Midlands Derby",1],["sheffield-united","sheffield-ing","Steel City Derby",1],["southampton","portsmouth","South Coast Derby",1],["wolverhampton","west-bromwich","Black Country Derby",1],["tm-3884","crystal-palace","South London Derby",2],["tm-3884","millwall","South London Derby",2],["tm-3884","tm-991","Dons Derby",2],["tm-3717","tm-4279","Rushmoor Derby",2],["tm-3717","tm-2796","Hampshire-Surrey Derby",2],["tm-2962","tm-1098","Cheshire Derby",2],["aston-villa","coventry-city","West Midlands Derby",2],["aston-villa","west-bromwich","West Midlands Derby",2],["aston-villa","wolverhampton","West Midlands Derby",2],["tm-349","tm-2454","South Yorkshire Derby",2],["tm-349","tm-1194","South Yorkshire Derby",2],["tm-349","sheffield-united","South Yorkshire Derby",2],["tm-349","sheffield-ing","South Yorkshire Derby",2],["tm-6168","tm-1220","Cumbrian Derby",2],["birmingham-city","west-bromwich","West Midlands Derby",2],["birmingham-city","wolverhampton","West Midlands Derby",2],["blackburn-rovers","preston-north-end","Lancashire Derby",2],["tm-1181","tm-11177","Fylde Coast Derby",2],["tm-1181","preston-north-end","West Lancashire Derby",2],["tm-3867","tm-17980","Hertfordshire Derby",2],["bournemouth","southampton","New Forest Derby",2],["tm-1027","tm-1110","West Yorkshire Derby",2],["brentford","queenspark-ing","West London Derby",2],["bristol-city","tm-2262","West Country Derby",2],["bristol-city","cardiff-city","Severnside Derby",2],["tm-2455","tm-6699","West Country Derby",2],["burnley","preston-north-end","Lancashire Derby",2],["tm-986","tm-1072","Cambridgeshire Derby",2],["cardiff-city","tm-3716","South Wales Derby",2],["charlton-athletic","millwall","South London Derby",2],["chelsea","fulham","West London Derby",2],["chelsea","brentford","West London Derby",2],["chelsea","queenspark-ing","West London Derby",2],["tm-3371","tm-3455","Gloucestershire Derby",2],["tm-31367","wrexham-ing","Cross-border Derby",2],["tm-1219","derby-county","Derbyshire Derby",2],["tm-1060","tm-2793","Essex Derby",2],["coventry-city","leicestercity-ing","M69 Derby",2],["tm-1042","tm-1211","A500 Derby",2],["crystal-palace","millwall","South London Derby",2],["crystal-palace","charlton-athletic","South London Derby",2],["tm-37486","tm-2577","Teesside Derby",2],["derby-county","leicestercity-ing","East Midlands Derby",2],["tm-2454","tm-1194","South Yorkshire Derby",2],["tm-6699","tm-1218","Devon Derby",2],["tm-1127","tm-1027","West Yorkshire Derby",2],["fulham","brentford","West London Derby",2],["fulham","queenspark-ing","West London Derby",2],["tm-2814","tm-7047","Kent Derby",2],["tm-1034","tm-3489","Lincolnshire Derby",2],["tm-1034","tm-2964","Humber Derby",2],["tm-1110","tm-1078","A62 Derby",2],["hull-city","tm-1034","Humber Derby",2],["leeds-united","tm-1027","West Yorkshire Derby",2],["leeds-united","tm-1110","West Yorkshire Derby",2],["leicestercity-ing","nottingham-forest","East Midlands Derby",2],["tm-1150","west-ham","East London Derby",2],["tm-1150","tm-2793","A13 Derby",2],["lincoln-city","tm-1034","Lincolnshire Derby",2],["lincoln-city","tm-3489","Lincolnshire Derby",2],["tm-1031","watford","M1 Derby",2],["tm-7123","tm-11310","Berkshire Derby",2],["tm-3820","tm-1045","Nottinghamshire Derby",2],["middlesbrough","sunderland","Tees-Wear Derby",2],["middlesbrough","newcastle-united","Tyne-Tees Derby",2],["tm-991","tm-2805","Buckinghamshire Derby",2],["tm-1302","tm-1072","Nene Derby",2],["nottingham-forest","tm-1045","Nottingham Derby",2],["tm-1078","tm-1088","A627 Derby",2],["oxford-ing","tm-2805","M40 Derby",2],["oxford-ing","tm-352","A420 Derby",2],["oxford-ing","tm-1032","Thames Valley Derby",2],["tm-2262","tm-6699","Devon Derby",2],["tm-2262","tm-1218","Devon Derby",2],["tm-2262","portsmouth","Dockyard Derby",2],["tm-1032","tm-352","M4 Derby",2],["tm-3054","tm-3694","Shropshire Derby",2],["stoke-city","tm-1211","Potteries Derby",2],["stoke-city","wolverhampton","Staffordshire Derby",2],["swansea-city","tm-3716","South Wales Derby",2],["tm-899","wolverhampton","West Midlands Derby",2],["athletic-bilbao","real-sociedad","Derbi vasco",1],["barcelona","espanyol","Derbi barceloní",1],["celta-de-vigo","rc-deportivo","Derbi gallego",1],["las-palmas","tenerife","Derbi canario",1],["real-madrid","barcelona","El Clásico",1],["real-madrid","atletico-de-madrid","Derbi madrileño",1],["real-oviedo","real-sporting-gijon","Derbi asturiano",1],["sevilla","real-betis","Derbi sevillano",1],["valencia","levante","Derbi valenciano",1],["alaves","eibar","Derbi vasco",2],["tm-13436","tm-16576","Derbi del Henares",2],["tm-11259","eldense","Derbi del interior de Alicante",2],["athletic-bilbao","alaves","Derbi vasco",2],["athletic-bilbao","eibar","Derbi vasco",2],["tm-18687","mallorca","Derbi mallorquín",2],["tm-2923","tm-46854","Derbi extremeño",2],["cadiz","tm-134","Derbi gaditano",2],["cartagena","tm-171","Derbi murciano",2],["castellon","villarreal","Derbi de La Plana",2],["ad-ceuta","tm-3705","Derbi del Estrecho",2],["cultural-leonesa","ponferradina","Derbi leonés",2],["elche","eldense","Derbi del Vinalopó",2],["tm-20528","tm-12697","Derbi del Pla de Barcelona",2],["getafe","leganes","Derbi del sur",2],["gimnastic","tm-83848","Derbi del Camp de Tarragona",2],["granada","malaga","Derbi andaluz oriental",2],["tm-7971","elche","Derbi alicantino",2],["lugo","ponferradina","Derbi de los Ancares",2],["malaga","almeria","Derbi mediterráneo andaluz",2],["tm-5650","celta-de-vigo","Derbi gallego",2],["racing-santander","tm-12588","Derbi cántabro",2],["racing-santander","athletic-bilbao","Derbi del Cantábrico",2],["tm-666","linares-es","Derbi jienense",2],["tm-171","tm-34148","Nuevo Derbi de Murcia",2],["real-sociedad","alaves","Derbi vasco",2],["real-sociedad","eibar","Derbi vasco",2],["real-valladolid","tm-2296","Derbi del Duero",2],["real-zaragoza","huesca","Derbi aragonés",2],["sabadell","tm-1881","Derbi del Vallès",2],["tm-42039","tm-52397","Derbi salmantino",2],["valencia","villarreal","Derbi de la Comunitat",2],["inter-turku","turunpalloseura-fin","Turku derby",2],["hb-torshavn","b36-torshavn","Torshavn derby",1],["lens","lille","Derby du Nord",1],["lyon","saint-etienne","Derby rhônalpin",1],["lyon","olympique-marseille","Choc des Olympiques",1],["paris-saint-germain","olympique-marseille","Le Classique",1],["rennes-fr","nantes","Derby breton",1],["angers","stade-lavallois","",2],["auxerre","troyes","Derby de la N77",2],["bastia-fra","nice","Derby de la Méditerranée",2],["stade-brest","guingamp","Derby breton",2],["tm-1162","le-havre","Derby normand",2],["tm-1175","tm-10868","Derby du Centre",2],["dijon","auxerre","Derby de Bourgogne",2],["stade-lavallois","le-mans","Derby du Maine",2],["lorient","stade-brest","Derby breton",2],["lorient","guingamp","Derby breton",2],["montpellier","tm-1160","Derby du Languedoc",2],["nancy","metz","Derby lorrain",2],["nice","tm-895","Derby des Alpes-Maritimes",2],["olympique-marseille","tm-494","Derby provençal",2],["paris-saint-germain","paris-fc","Derby de Paris",2],["stade-reims","troyes","Derby de Champagne-Ardenne",2],["rennes-fr","stade-brest","Derby breton",2],["rennes-fr","guingamp","Derby breton",2],["rennes-fr","lorient","Derby breton",2],["dinamotbilisi-geo","locotbilisi-geo","Tbilisi derby",2],["europa-fc","lincoln-red-imps","",2],["aek-atenas","panathinaikos","Athenian Derby",1],["aek-atenas","olympiakos","",1],["aek-atenas","paok","Double-headed Eagles Derby",1],["olympiakos","panathinaikos","Derby of the Eternal Enemies",1],["paok","aris-gre","Derby of Thessaloniki",1],["athenskallithea-gre","panionios-gre","South Athens Derby",2],["iraklis-gre","aris-gre","Derby of Thessaloniki",2],["volos-nfc","nikivolos-gre","Derby of Volos",2],["kitchee","eastern-sc","Battle of the Blues",2],["dinamo-zagreb","hajduk-split","Eternal derby",1],["hajduk-split","hnk-rijeka","Adriatic derby",2],["hnk-rijeka","nk-istra","Derby della Ucka",2],["nk-osijek","cibalia-cro","Slavonian derby",2],["nk-osijek","vukovar-cro","Slavonian derby",2],["ferencvarosi","ujpest-hun","Derbi",1],["ogol-900002022","ogol-900001957","Super East Java derby",1],["ogol-900001532","ogol-900001603","Indonesian El Clasico",1],["ogol-900002913","ogol-900002538","Yogyakarta derby",1],["ogol-900003971","ogol-900002678","Papadaan derby",2],["ogol-900002022","ogol-900001713","Suramadu derby",2],["ogol-900004642","ogol-900002913","Mataram derby",2],["ogol-900004642","tm-20646","Super Central Java derby",2],["shamrock-rovers","bohemian-fc","Dublin Derby",1],["maccabihaifa-isr","hapoelhaifa-isr","Haifa derby",1],["maccaitel-isr","hapoel-tel-aviv","Tel Aviv derby",1],["maccaitel-isr","maccabihaifa-isr","Israeli Clasico",1],["beitarjer-isr","hapoeljerusalem-isr","Jerusalem derby",2],["maccabipetahtikva-isr","hapoelpetahtikva-isr","Petah Tikva derby",2],["ogol-257751","ogol-18703","Kolkata Derby",1],["bengaluru","ogol-93653","South Indian Derby",2],["bengaluru","ogol-93654","South Indian Derby",2],["ogol-93654","ogol-93653","South Indian Derby",2],["ogol-8321","al-shorta","Baghdad derby",1],["ogol-8684","ogol-8321","Baghdad derby",1],["ogol-8684","al-shorta","Baghdad derby",1],["ogol-29657","ogol-11783","Northern derby",2],["ogol-29657","ogol-68036","Duhok derby",2],["persepolis","esteghlal","Tehran Derby",1],["ogol-900001217","ogol-900001394","Isfahan Derby",1],["genoa","sampdoria","Derby della Lanterna",1],["inter-it","milan","Derby della Madonnina",1],["juventus","torino","Derby della Mole",1],["palermo","tm-1627","Derby di Sicilia",1],["roma","lazio","Derby della Capitale",1],["ascoli","tm-4330","Derby del Tronto",2],["atalanta","tm-4541","Derby di Bergamo",2],["avellino","tm-380","Derby della Campania",2],["bari-it","lecce","Derby di Puglia",2],["bari-it","tm-704","Derby di Puglia",2],["bari-it","napoli","Derby del Mezzogiorno",2],["bologna","modena","Derby della Secchia Rapita",2],["cagliari","tm-2253","Derby sardo",2],["carrarese","spezia-it","Derby Lunense",2],["catanzaro","tm-4083","Derby della Calabria",2],["cesena","tm-1105","Derby di Romagna",2],["como","tm-5514","Derby del Lario",2],["tm-4031","catanzaro","Derby della Calabria",2],["tm-4031","tm-4083","Derby della Calabria",2],["cremonese","tm-132806","Derby lombardo",2],["fiorentina","tm-1210","Derby della Toscana",2],["fiorentina","pisa","Derby toscano",2],["frosinone","tm-22045","Derby del Basso Lazio",2],["hellas-verona","vicenza","Derby del Veneto",2],["hellas-verona","tm-132806","Derby del Garda",2],["mantova","hellas-verona","Derby del Mincio",2],["modena","reggiana-it","Derby della Secchia",2],["modena","sassuolo","Derby modenese",2],["modena","tm-4102","Derby modenese",2],["napoli","roma","Derby del Sole",2],["napoli","tm-380","Derby della Campania",2],["napoli","avellino","Derby della Campania",2],["napoli","juve-stabia","Derby del Golfo",2],["tm-6692","tm-26789","Derby del Riso",2],["padova","vicenza","Derby del Veneto",2],["padova","venezia","Derby del Veneto",2],["padova","tm-4084","Derby veneto",2],["palermo","cagliari","Derby delle Isole",2],["tm-839","arezzo","Derby etrusco",2],["pisa","tm-1210","Derby del Tirreno",2],["pisa","empoli","Derby toscano",2],["pisa","spezia-it","Derby tosco-ligure",2],["sassuolo","tm-4102","Derby modenese",2],["sudtirol","tm-4095","Derby tirolese",2],["tm-132806","atalanta","Derby di Lombardia",2],["vicenza","venezia","Derby del Veneto",2],["fc-tokyo","kawasaki-frontale","Tamagawa Clasico",1],["fc-tokyo","tokyoverdy-jap","Tokyo derby",1],["gamba-osaka","cerezo-osaka","Osaka derby",1],["jefunitedchiba-jap","kashiwareysol-jap","Chiba derby",1],["shimizuspulse-jap","jubiloiwata-jap","Shizuoka derby",1],["yokohama-marinos","kawasaki-frontale","Kanagawa derby",1],["kashima-antlers","mitohollyhock-jap","Ibaraki derby",2],["kawasaki-frontale","yokohamafc-jap","Kanagawa derby",2],["kawasaki-frontale","shonanbellmare-jap","Kanagawa derby",2],["tokyoverdy-jap","machidazelvia-jap","Tokyo Classic",2],["urawareds-jap","omiyaardija-jap","Saitama derby",2],["vegaltasendai-jap","montedioyamagata-jap","Michinoku derby",2],["yokohama-marinos","yokohamafc-jap","Yokohama derby",2],["yokohama-marinos","shonanbellmare-jap","Kanagawa derby",2],["yokohamafc-jap","shonanbellmare-jap","Kanagawa derby",2],["fc-seoul","incheon-cor","Gyeongin derby",1],["jeonbuk","ulsan-jap","Hyundai derby",1],["suwonbluewings-cor","fc-seoul","Super Match",1],["ulsan-jap","pohangsteelers-cor","Donghaean derby",1],["jeonbuk","fc-seoul","Jeonseol Match",2],["jeonbuk","suwonbluewings-cor","",2],["seongnam-cor","suwonbluewings-cor","Magyedaejeon",2],["suwon-cor","suwonbluewings-cor","Suwon derby",2],["riga","fk-rfs","Riga derby",2],["rajacasablanca-mar","wydad-casablanca","Casablanca Derby",1],["rajacasablanca-mar","far-rabat","Moroccan Clasico",1],["wydad-casablanca","far-rabat","Moroccan Clasico",1],["far-rabat","fus-rabat","Rabat Derby",2],["marrakech-mar","hassania","South Derby",2],["moghrebtetouan-mar","tanger-mar","North Derby",2],["ogol-900002111","difaa-mar","Doukkala Derby",2],["sutjeska","buducnost","Montenegrin derby",1],["shkendija-mkd","shkupi","Albanian derby",2],["valletta","floriana","Derby of the Capital",1],["america-mex","dep-guadalajara-mex","Clásico Nacional",1],["america-mex","cruz-azul","Clásico Joven",1],["america-mex","pumasunam-mex","Clásico Capitalino",1],["atlas-mex","dep-guadalajara-mex","Clásico Tapatío",1],["monterrey","tigres-uanl","Clásico Regio",1],["ogol-9642","johor-darul","Malaysian Giants Clash",1],["ogol-293500","johor-darul","Southern Derby",2],["ogol-22965","ogol-293500","Naning derby",2],["ogol-23309","ogol-269466","Borneo derby",2],["ogol-9642","ogol-32244","Klang Valley derby",2],["ogol-22972","ogol-22966","East Coast Derby",2],["linfield-irn","glentoran-irn","Big Two Derby",1],["ajax","feyenoord","De Klassieker",1],["ajax","psv","De Topper",1],["fc-groningen","heerenveen","Derby van het Noorden",1],["ado-den-haag","ajax","Hofstad vs Hoofdstad",2],["ado-den-haag","dordrecht","Zuid-Hollandse Derby",2],["ajax","az-alkmaar","Grote Noord-Hollandse Derby",2],["almere-city","volendam","Markermeerderby",2],["de-graafschap","vitesse","Gelderse Derby",2],["de-graafschap","nec-nijmegen","Gelderse Derby",2],["eindhoven","helmond-sport","Brabantse Derby",2],["fc-groningen","fc-emmen","Drents-Groningse Derby",2],["feyenoord","sparta-rotterdam","Rotterdamse Derby",2],["feyenoord","excelsior-hol","Rotterdamse Derby",2],["feyenoord","ado-den-haag","Zuid-Hollandse Derby",2],["heerenveen","cambuur","Friese Derby",2],["heracles-almelo","fc-twente","Twentse Derby",2],["mvv-maastricht","fortuna-sittard","Derby van het Zuiden",2],["psv","eindhoven","Lichtstadderby",2],["roda","vvv-venlo","Limburgse Derby",2],["roda","mvv-maastricht","Limburgse Derby",2],["roda","fortuna-sittard","Mijnstreekderby",2],["sparta-rotterdam","excelsior-hol","Rotterdamse Derby",2],["top-oss","den-bosch","Brabantse Derby",2],["fc-twente","go-ahead-eagles","Derby van het Oosten",2],["vitesse","nec-nijmegen","Gelderse Derby",2],["volendam","telstar","Vissersderby",2],["willem-ii","nac-breda","Brabantse Derby",2],["willem-ii","rkc-waalwijk","Brabantse Derby",2],["pec-zwolle","go-ahead-eagles","IJsselderby",2],["rosenborg","brann-nor","The Classic",1],["bodoglimt-nor","tromso-nor","North Norway derby",2],["brann-nor","viking-fk","Vestlandsderbyet",2],["kristiansund","molde-fk","Kristiansund derby",2],["lillestrom-nor","strommen-nor","Romeriksderbyet",2],["moss-nor","fredrikstad-nor","Ostfold derby",2],["sarpsborg-08","fredrikstad-nor","Ostfold derby",2],["valerenga","lyn-nor","Battle of Oslo",2],["auckland-nze","aucklandunited-nze","Dominion Road derby",2],["christchurch-nze","cashmere-nze","Christchurch Derby",2],["alianza-lima","universitario","Clásico del Fútbol Peruano",1],["alianza-lima","sporting-cristal","Clásico Moderno",2],["melgar","cienciano","Clásico del Sur",2],["universitario","sporting-cristal","Clásico Moderno",2],["gornik-zabrze","ruchchorzow-pol","Great Silesian Derby",1],["lechia-pol","arka-pol","Tricity derby",1],["legia-warsaw","lech-poznan","Klasyk",1],["widzew-pol","lodz-pol","Lodz derby",1],["wislakrakow-pol","cracovia","Holy War",1],["gornik-zabrze","katowice-pol","Silesian Classic",2],["legia-warsaw","wislakrakow-pol","",2],["legia-warsaw","poloniavarsovia-pol","Warsaw derby",2],["miedzlegnica-pol","zaglebielubin-pol","Copper Basin derby",2],["piast-pol","gornik-zabrze","Gliwice-Zabrze derby",2],["pogon-szczecin","lechia-pol","Pomeranian derby",2],["poloniabytom-pol","ruchchorzow-pol","Old Silesian derby",2],["slaskwroclaw-pol","zaglebielubin-pol","Lower Silesian derby",2],["benfica","sporting","Derby de Lisboa",1],["cd-nacional","maritimo","Derby da Madeira",1],["porto","benfica","O Clássico",1],["sc-braga","vitoriaguimaraes-por","Derby do Minho",1],["academica-coimbra","tm-1436","Derby do Centro",2],["farense","portimonense","Derby do Algarve",2],["tm-3267","leixoes","Derby de Matosinhos",2],["tm-4297","rio-ave","",2],["tm-4297","leixoes","Derby do Mar",2],["olimpia","cerro-porteno","Superclásico Paraguayo",1],["olimpia","guarani","Clásico Añejo",2],["olimpia","libertad","",2],["steua-bucaresti-rom","dinamo-rom","Eternal derby",1],["steua-bucaresti-rom","rapid-bucuresti-rom","Bucharest derby",1],["universitatea-cluj-rom","cfrcluj-rom","Cluj derby",1],["dinamo-rom","rapid-bucuresti-rom","Bucharest derby",2],["dinamo-rom","craiova-rom","",2],["bihor-rom","arad-rom","Crisana derby",2],["petrolul-rom","rapid-bucuresti-rom","",2],["arad-rom","politehnica-rom","West derby",2],["estrelavermelha-ser","partizan","Eternal derby",1],["ofkbelgrad-ser","estrelavermelha-ser","Belgrade derby",2],["ofkbelgrad-ser","partizan","Belgrade derby",2],["spartak-moscow","cska-moscow","Moscow derby",1],["spartak-moscow","dynamo-rus","Oldest Russian derby",1],["cska-moscow","dynamo-rus","Moscow derby",2],["cska-moscow","lokomotiv","Moscow derby",2],["dynamo-rus","lokomotiv","Moscow derby",2],["rubin-kazan","neftekhimik","Tatarstan derby",2],["rubin-kazan","kamaz","Tatarstan derby",2],["shinnik","tekstilshchik","Golden Ring derby",2],["spartak-moscow","lokomotiv","Moscow derby",2],["zenit-st-petersburg","spartak-moscow","Rivalry of Two Capitals",2],["zenit-st-petersburg","cska-moscow","Rivalry of Two Capitals",2],["al-ahli","al-ittihad","Jeddah derby",1],["al-hilal","al-nassr","Riyadh derby",1],["al-hilal","al-ittihad","Saudi El Clasico",1],["al-ettifaq","al-qadisiya-ara","Al-Sharqiyah derby",2],["hajer-ara","al-fateh","Al-Hasa derby",2],["celtic","rangers","Old Firm",1],["dundee-esc","dundee-united","Dundee Derby",1],["hearts-of-oak","hibernian","Edinburgh Derby",1],["aberdeen","dundee-united","New Firm",2],["airdrieonians","tm-2999","Lanarkshire Derby",2],["arbroath","tm-3030","Angus Derby",2],["arbroath","tm-3016","Angus Derby",2],["ayr-esc","kilmarnock-esc","Ayrshire Derby",2],["dunfermline-esc","raith-rovers","Fife Derby",2],["dunfermline-esc","tm-3024","Fife Derby",2],["tm-12886","tm-17602","Edinburgh Derby",2],["tm-2451","ross-county","Highland Derby",2],["tm-3030","tm-3016","Angus Derby",2],["greenock-morton","st-mirren","Renfrewshire Derby",2],["motherwell","airdrieonians","Lanarkshire Derby",2],["motherwell","tm-2999","Lanarkshire Derby",2],["partick-esc","queenspark-esc","Glasgow Derby",2],["tm-3001","tm-3034","Dumfries & Galloway Derby",2],["raith-rovers","tm-3024","Fife Derby",2],["st-johnstone","dundee-esc","Tayside Derby",2],["st-johnstone","dundee-united","Tayside Derby",2],["al-hilal-outros","al-merrikh","Omdurman derby",1],["aik","djurgardens-if","Tvillingderbyt",1],["aik","hammarby-if","Stockholm derby",1],["djurgardens-if","hammarby-if","Stockholm derby",1],["gais-sue","ifk-goteborg","Gothenburg derby",1],["ifk-goteborg","orgryte-is","Gothenburg derby",1],["malmo-ff","helsingborg-if","Scanian derby",1],["gais-sue","orgryte-is","Gothenburg derby",2],["helsingborg-if","landskronabois-sue","Scanian derby",2],["kalmar-ff","osters-if","Smalandsderbyt",2],["malmo-ff","landskronabois-sue","Scanian derby",2],["ik-sirius","vasteras-sk","Arosderbyt",2],["maribor-esl","olimpia-esl","Eternal derby",1],["koper-elv","primorje-elv","Slovene Littoral derby",2],["maribor-esl","celje-elv","Styrian derby",2],["maribor-esl","nsmura-elv","Prekmurje-Styria derby",2],["nsmura-elv","nknafta-elv","Prekmurje derby",2],["olimpia-esl","bravo-elv","Ljubljana derby",2],["slovan-slk","spartaktrnava-slk","Traditional derby",1],["ruzomberok-slk","banskabystrica-slk","Over the Hill derby",2],["slovan-slk","dacdunajskastreda-slk","DAC-Slovan derby",2],["zilina-slk","trencin-slk","North Slovak derby",2],["ogol-900001574","buriram-united","",1],["ogol-900001574","ogol-900001576","Thailand Clasico",2],["ogol-900001574","ogol-900002934","Bangkok derby",2],["ogol-900000564","ogol-900000567","Tunis derby",1],["ogol-900000564","ogol-900000568","Tunisian Clasico",1],["ogol-900000568","ogol-900002196","Derby du Sahel",1],["ogol-900000567","ogol-900001540","Small Tunis derby",2],["ogol-900002060","ogol-900003979","South-East derby",2],["ogol-900000564","ogol-900001540","Small Tunis derby",2],["besiktas","galatasaray","İstanbul Derbisi",1],["besiktas","fenerbahce","İstanbul Derbisi",1],["fenerbahce","galatasaray","Kıtalar Arası Derbi",1],["genclerbirligi-tur","tm-868","Ankara Derbisi",1],["galatasaray","kasimpasa-tur","Beyoğlu Derbisi",2],["kasimpasa-tur","karagumruk-tur","Haliç Derbisi",2],["kayserispor","sivasspor-tur","İç Anadolu Derbisi",2],["kocaelispor-tur","sakaryaspor-tur","Marmara Derbisi",2],["trabzonspor","caykur-rizespor","Doğu Karadeniz Derbisi",2],["trabzonspor","samsunspor","Karadeniz Derbisi",2],["dinamokiev-ucr","shakhtar-donetsk","Klasychne",1],["shakhtar-donetsk","zorya-lugansk","Donbas derby",2],["los-angeles-galaxy","los-angeles-fc","El Tráfico",1],["nyredbulls-eua","new-york-city","Hudson River Derby",1],["seattle-sounders","portland-timbers","Cascadia Derby",1],["colorado-rapids","real-salt-lake","Rocky Mountain Cup",2],["columbus-crew","fc-cincinnati","Hell Is Real Derby",2],["dc-united","nyredbulls-eua","Atlantic Cup",2],["houston-dynamo","fc-dallas","Texas Derby",2],["los-angeles-galaxy","san-jose-earthquakes","California Clásico",2],["portland-timbers","vancouver-whitecaps","Cascadia Derby",2],["seattle-sounders","vancouver-whitecaps","Cascadia Derby",2],["toronto-fc","cf-montreal","Canadian Classique",2],["nacional","penarol","Clásico del Fútbol Uruguayo",1],["ca-cerro","ramplajuniors-uru","Clásico de la Villa",2],["pakhtakor","ogol-900001319","Big Tashkent derby",1],["ogol-900001319","ogol-900001946","Tashkent derby",2],["ogol-900002046","ogol-900005437","Southern derby",2],["ogol-900005886","ogol-900002335","Valley derby",2],["ogol-900005886","ogol-900004126","Ferghana derby",2],["pakhtakor","ogol-900001946","Tashkent derby",2],["pakhtakor","ogol-900005886","Uzbek El Clasico",2],["caracas","deportivo-tachira","Clásico Moderno",1],["deportivo-tachira","merida-ve","Clásico Andino",2],["hanoi-vie","viettel","Hanoi derby",2],["drita-kos","gjilani","Gjilan derby",2],["kaizer-chiefs","orlando-pirates","Soweto derby",1],["kaizer-chiefs","mamelodi-sundowns","Golden Derby",1],["orlando-pirates","mamelodi-sundowns","South African Classic",1],["amazulu-afs","lamontville-afs","Durban derby",2],["polokwanecity-afs","magesi-afs","Limpopo derby",2]];

  const CLASSICS_LOOKUP = Object.create(null);
  for (const [a, b, label, tier] of CLASSICS_RAW) {
    const info = { label: label || 'Derby Classic', tier: tier || 2 };
    CLASSICS_LOOKUP[a + '|' + b] = info;
    CLASSICS_LOOKUP[b + '|' + a] = info;
  }

  function getClassicInfo(teamA, teamB) {
    if (!teamA || !teamB) return null;
    return CLASSICS_LOOKUP[String(teamA) + '|' + String(teamB)] || null;
  }

  // Konversi compId + compKind menjadi metadata tiket { kind, region } (#19825)
  function matchTicketMeta(compId = '', compKind = '', country = '') {
    const cid = String(compId || '');
    const ck = String(compKind || '').toLowerCase();
    const fallbackEu = COUNTRY_GROUPS[0].includes(String(country || '').toUpperCase()) ? 0 : 1;
    if (cid in CONT_TICKET_MAP) {
      const e = CONT_TICKET_MAP[cid];
      const rawKind = e.kind === 'continental3' ? 'other' : e.kind;
      return { kind: rawKind, region: e.region };
    }
    if (ck === 'continental' || ck === 'intercontinental' || cid.startsWith('cont:')) {
      return { kind: 'continental1', region: fallbackEu };
    }
    if (ck === 'cup' || cid.startsWith('cup:')) return { kind: 'cup', region: fallbackEu };
    if (ck === 'estadual' || ck === 'state' || cid.startsWith('state:')) return { kind: 'state', region: fallbackEu };
    if (ck === 'friendly') return { kind: 'friendly', region: fallbackEu };
    if (ck === 'nations' || cid.startsWith('nat:')) return { kind: 'nations', region: fallbackEu };
    return { kind: 'league', region: fallbackEu };
  }

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
      CUSTOM_MID_ROLES,
      CUSTOM_ATK_ROLES,
      CUSTOM_MID_OFF,
      CUSTOM_ATK_OFF,
      CUSTOM_DELTA_CAP,
      CUSTOM_MID_RULE_ID,
      CUSTOM_ATK_RULE_ID,
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
      CONT_TICKET_MAP,
      getClassicInfo,
      matchTicketMeta,
      STADIUM_FREE_SEATS,
      STADIUM_OPS_PER_SEAT,
      SEAT_COST_MUL,
      STADIUM_WORK_FIXED_COST,
      STADIUM_COST_DIV_MUL,
      STADIUM_SEAT_TIERS,
      PRICE_FACTOR_MIN,
      PRICE_FACTOR_MAX,
      SHOP_ELAST,
      SHOP_OPTIMAL_MUL,
      SHOP_MEGA_DAYS,
      SHOP_MEGA_BONUS,
      SHOP_SIGNING_DAYS,
      SHOP_SIGNING_BONUS,
      SHOP_STAR_MAX,
      SHOP_FANS_STADIUM_MIN,
      SHOP_FANS_STADIUM_MAX,
      MATCH_HOME_MID,
      MATCH_HOME_SHOT,
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
      NAMING_WARN_MONTHS,
      NAMING_DURATION_MULT,
      CT_COST_SHARE,
      CT_BUILD_DAYS,
      CT_UPGRADE_COSTS,
      CT_UPGRADE_WEEKS,
      CT_UPKEEP_SHARE,
      CT_MILESTONES,
      YOUTH_COACH_MAX_LEVEL,
      YOUTH_COACH_DEV_BONUS_PER_LV,
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
      RENEWAL_TERMS_DAYS,
      RENEWAL_RAISE_LAST,
      RENEWAL_RAISE_MID,
      RENEWAL_DISCOUNT,
      RENEWAL_DISCOUNT_FROM_DAYS,
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
      ARAB_OFFER_MIN_MUL,
      ARAB_OFFER_MAX_MUL,
      AI_OFFER_MUL,
      SELL_TAX_THRESHOLD,
      SELL_TAX_LOW,
      SELL_TAX_HIGH,
      TRANSFER_WINDOW_DEFAULT,
      TRANSFER_WINDOWS,
      BUYER_MIN_FORCE_BY_DIV,
      BUYER_MIN_FORCE_BY_REP,
      PURCHASE_OFFER_MAX_ASK_MUL,
      AUCTION_MAX_MUL,
      SALARY_CUT,
      TERMINATION_FEE_TIERS,
      INJURED_SALE,
      YOUTH_SCOUT,
      RIVAL_JUNIOR_DIV_FLOOR,
      RIVAL_JUNIOR_STAR_FLOOR,
      MOOD_CFG,
      UNHAPPY_GROWTH,
      SELLER_STANCE,
      BUY_PERSUADE,
      STAR_PULL,
      VALUE_K_BY_LEVEL,
      VALUE_CRAQUE_MUL,
      VALUE_WORLDTOP_MUL,
      VALUE_ATTACKER_MUL,
      VALUE_HIGHLIGHT_MUL,
      VALUE_AGE_TERMS,
      VALUE_AGE_OLD_CUT,
      VALUE_LOW_LEVEL_MUL,
      VALUE_OLD_MUL,
      VALUE_YOUNG_BONUS,
      VALUE_K_MIN,
      VALUE_YOUTH_FRACTION,
      VALUE_YOUTH_RAMP,
      EURO_TOP_BONUS,
      EURO_TOP_MIN_LEVEL,
      FINE_CFG,
      LOAN_OPTION,
      SHOUT_DECAY,
      LIVE_COACH_GUIDE,
      DECLINE_START_AGE_SCALE100,
      RELEASE_CLAUSE,
    };
  }

  LF.config = getClientConfig();
  LF.config.getClientConfig = getClientConfig;
})(typeof window !== 'undefined' ? window : globalThis);
