/**
 * LigaFoot Optimizer Web Engine — config.js
 * Konstanta terverifikasi dari bytecode LigaFoot v1.2.0 (economyV = 9).
 * Single Source of Truth untuk seluruh modul Engine & UI browser.
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});

  // Kategori posisi: 0=GK, 1=Fullback, 2=CB, 3=Midfield, 4=Forward/Winger
  const EXACT_CAT = {
    G: 0,
    LD: 1, LE: 1, LAT: 1,
    ZD: 2, ZE: 2, ZAG: 2,
    VOL: 3, MC: 3, MD: 3, ME: 3, MA: 3, MEI: 3,
    PD: 4, PE: 4, SA: 4, ATA: 4,
  };

  // EXACT (#21882, #35246): Penalti wrongFoot (-5%) HANYA berlaku di Fullback (category === 1)
  const SLOT_FOOT_PREF = {
    LE: 'E',
    LD: 'D',
  };

  // Usia mulai regresi spesifik per posisi (v1.2.0 #21447 declineStartAge)
  const DECLINE_START_AGE = {
    ATA: 31, SA: 31, PD: 31, PE: 31, MA: 31,
    LD: 32, LE: 32, LAT: 32, VOL: 32, MC: 32, MD: 32, ME: 32, MEI: 32,
    ZD: 33, ZE: 33, ZAG: 33,
    G: 34,
  };

  // Mapping tampilan kode internal Portugis (save) -> Bahasa Inggris in-game (UI)
  const POS_EN = {
    G: 'GK',
    LD: 'RB', LE: 'LB', LAT: 'FB',
    ZD: 'RCB', ZE: 'LCB', ZAG: 'CB',
    VOL: 'CDM', MC: 'CM', MD: 'RM', ME: 'LM', MA: 'CAM', MEI: 'MID',
    PD: 'RW', PE: 'LW', SA: 'SS', ATA: 'ST',
  };

  const FOOT_EN = { D: 'R', E: 'L', A: 'Both', B: 'Both' };

  const SKILL_EN = {
    FIN: 'FIN', PAS: 'PAS', ARM: 'PLY', DES: 'TCK', MAR: 'MRK',
    CAB: 'HDG', CRU: 'CRS', DRI: 'DRI', VEL: 'PAC', RES: 'STA',
    COL: 'POS', REF: 'REF', SAI: 'RUS', DPE: 'PEN',
  };

  const FORM_EN = {
    '4-4-2 def.': '4-4-2 Def',
    '4-4-2 ofe.': '4-4-2 Off',
    '4-3-3 def.': '4-3-3 Def',
    '4-3-3 ofe.': '4-3-3 Off',
    '4-2-3-1 Alas': '4-2-3-1 Wide',
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

  // [nDEF, nMID, nATK, defBonusPct, midBonusPct, atkBonusPct, wingWidth]
  const FORMATION_SHAPE = {
    '4-4-2':        [4, 4, 2,  0.00,  0.00,  0.00, 'NARROW'],
    '4-4-2 def.':   [4, 4, 2,  0.05,  0.00, -0.03, 'NARROW'],
    '4-4-2 ofe.':   [4, 4, 2, -0.04,  0.00,  0.05, 'NARROW'],
    '4-3-3':        [4, 3, 3, -0.02,  0.00,  0.03, 'WIDE'],
    '4-3-3 def.':   [4, 3, 3,  0.03,  0.00,  0.00, 'WIDE'],
    '4-3-3 ofe.':   [4, 3, 3, -0.04,  0.00,  0.05, 'WIDE'],
    '4-2-3-1':      [4, 5, 1,  0.00,  0.01,  0.02, 'NARROW'],
    '4-2-3-1 Alas': [4, 3, 3, -0.01,  0.00,  0.03, 'WIDE'],
    '4-5-1':        [4, 3, 3,  0.03,  0.01, -0.02, 'WIDE'],
    '4-1-4-1':      [4, 3, 3,  0.03,  0.01, -0.02, 'WIDE'],
    '4-4-1-1':      [4, 2, 4,  0.00,  0.00,  0.01, 'WIDE'],
    '5-4-1':        [5, 4, 1,  0.05,  0.00, -0.03, 'NARROW'],
    '5-3-2':        [5, 3, 2,  0.03,  0.00, -0.01, 'NARROW'],
    '3-5-2':        [3, 3, 4, -0.01,  0.01,  0.01, 'WIDE'],
    '3-4-3':        [3, 2, 5, -0.04,  0.00,  0.05, 'WIDE'],
  };

  // Koordinat lapangan (x%, y%) v8.1 — fallback terkalibrasi (layout utama pakai Dynamic Row-Band)
  const PITCH_COORDS = {
    G:   [[50, 91]],
    LE:  [[12, 74]], LD:  [[88, 74]],
    ZE:  [[37, 74]], ZD:  [[63, 74], [50, 74]], ZAG: [[50, 74]],
    VOL: [[50, 56], [28, 56], [72, 56]],
    ME:  [[14, 44]], MD:  [[86, 44]],
    MC:  [[50, 44], [28, 44], [72, 44]],
    MA:  [[50, 30], [28, 30], [72, 30]],
    PE:  [[16, 12]], PD:  [[84, 12]],
    SA:  [[50, 26]], ATA: [[50, 10], [28, 10], [72, 10]],
  };

  const SKILL_DESC = {
    FIN: 'Finishing (+5% konversi)',
    PAS: 'Passing (+3% Mid)',
    ARM: 'Playmaking (+3% Mid)',
    DES: 'Tackling (+5% Def)',
    MAR: 'Marking (+5% Def)',
    CAB: 'Heading (+4% Def / +3% Atk)',
    CRU: 'Crossing (+3% Corner s1)',
    DRI: 'Dribbling (+2% Mid / +3% Atk)',
    VEL: 'Pace (+2% Def/Atk)',
    RES: 'Stamina (-40% lelah)',
    COL: 'Positioning (+4% GK s1)',
    REF: 'Reflexes (+4% GK s1)',
    SAI: 'Off-line GK (+2%)',
    DPE: 'Penalty Save (+8% pen)',
  };

  // Konstanta priceFactor (#21338) v1.2.0
  const MEMBER_ELAST = { lin: 0.9, up: 1.2, down: 0.8 };
  const SHOP_ELAST = { lin: 1.0, up: 1.3, down: 0.8 };
  const PRICE_FACTOR_MIN = 0.25;
  const PRICE_FACTOR_MAX = 1.60;
  const MEMBER_DISC_MAX = 6;
  const MEMBER_ANNUAL_PER_DISC = 0.045;
  const MEMBER_ANNUAL_SHARE_MAX = 0.55;
  const MEMBER_LOYAL = 0.08;
  const MEMBER_ANNUAL_RETAIN_PER_DISC = 0.0036;

  // Konstanta Club Shop (#3527, #21341-#21360)
  const SHOP_BUY_RATE = { 1: 0.022, 2: 0.017, 3: 0.013, 4: 0.010 };
  const SHOP_SHIRT_PRICE_BY_DIV = { 1: 20, 2: 14, 3: 10, 4: 7 };
  const SHOP_FANS_BY_REP = { 0: 15000, 1: 120000, 2: 800000, 3: 3000000, 4: 9000000, 5: 24000000 };
  const SHOP_SIGNING_DAYS = 90;
  const SHOP_SIGNING_FEE_SHARE = 0.08;
  const SHOP_SIGNING_BONUS = 0.08;
  const SHOP_MEGA_DAYS = 365;
  const SHOP_MEGA_FEE_SHARE = 0.30;
  const SHOP_MEGA_BONUS = 0.30;

  // Konstanta Tiket & Stadion
  const TICKETS_BASE = {
    1: { geral: 10, arquibancada: 15, cadeiras: 25, camarotes: 80 },
    2: { geral:  7, arquibancada: 11, cadeiras: 18, camarotes: 55 },
    3: { geral:  5, arquibancada:  8, cadeiras: 13, camarotes: 40 },
    4: { geral:  4, arquibancada:  6, cadeiras: 10, camarotes: 30 },
  };
  const SECTOR_SHARE_WEIGHT = { geral: 0.42, arquibancada: 0.46, cadeiras: 0.10, camarotes: 0.02 };
  const STADIUM_FREE_SEATS = 20000;
  const STADIUM_OPS_PER_SEAT = 35;
  const TICKET_OCCASIONS = ['normal', 'runin', 'r16', 'qf', 'sf', 'final'];

  // Konstanta Ruang Ganti, Kontrak & Denda Kartu Merah (#3753, #24491)
  const LOCKER_UNHAPPY_MIN = 4;
  const RENEW_GOLDEN_MIN = 11;
  const RENEW_GOLDEN_MAX = 59;
  const PRECONTRACT_DAYS = 180;
  const COUNTER_SAFE_MUL = 1.40;
  const COUNTER_AVG_REALIZED = 1.25;

  const FINE_SAFE_PCT = 20;
  const FINE_DEFAULT_DIRECT = 100;
  const FINE_DEFAULT_YELLOW = 50;
  const FINE_SLUMP_DAYS = 30;
  const FINE_SLUMP_PROB_BASE = 0.50;
  const FINE_SLUMP_AMOUNT = 0.03;
  const FINE_SLUMP_CAP = 0.20;

  const FOREIGN_FIELD_LIMITS = {
    ID: 7, BR: 9, AR: 6, JP: 5, KR: 5, CN: 5, SA: 8,
    EN: 99, ES: 99, IT: 99, DE: 99, FR: 99, PT: 99, NL: 99,
    US: 8, MX: 7, TR: 12, RU: 8, MY: 6, TH: 5, VN: 3,
  };

  const CT_MILESTONES = [
    [1, 'Dasar — slot latihan minimal (2 slot)'],
    [2, '+0.015/mgg growth pemain <=23 thn'],
    [3, 'Diskon biaya Scout -25% & +1 slot latihan'],
    [4, '+0.010/mgg growth untuk SELURUH skuad'],
    [5, '-20% kecepatan regresi veteran & +1 slot latihan'],
    [6, '+1 prospek akademi baru per musim'],
    [7, '-20% risiko cedera & +1 slot latihan'],
    [8, 'Membuka tampilan potensi eksak pemain'],
    [9, '+10% pemulihan stamina & +1 slot latihan'],
    [10, '+3 batas plafon potensi pemain muda'],
  ];

  const LIVE_COACH_GUIDE = {
    shouts: [
      {
        name: 'Fire Up (Bakar Semangat)',
        when: 'Skor seri/tertinggal atau menit 15–30',
        effect: 'Boost moral & intensitas serangan (gunakan 1x saja: pengulangan 100% -> 50% -> 0%)',
      },
      {
        name: 'Focus (Konsentrasi)',
        when: 'Unggul 1 gol (menit 55–70) atau laga tandang ketat',
        effect: 'Kurangi error bertahan & jaga ritme lini tengah',
      },
      {
        name: 'Push Forward / Demand More',
        when: 'Tertinggal di menit 65–80',
        effect: 'Tambah dorongan ofensif menjelang akhir laga',
      },
    ],
    orders: [
      {
        cond: 'Unggul >= 1 gol (menit 72+)',
        order: 'Lock Door + Time Waste (menit 80+)',
        note: 'Tutup celah belakang & habiskan waktu tanpa menguras energi',
      },
      {
        cond: 'Tertinggal (menit 65+)',
        order: 'All-Out Attack + Sub Supersub (PAC/FIN)',
        note: 'Tambah volume tembakan terutama jika cuaca hujan',
      },
      {
        cond: 'Unggul >= 2 gol (menit 60+)',
        order: 'Save Energy + Rotasi Pelapis #11–#17',
        note: 'Simpan stamina inti & penuhi kuota 8% menit pelapis anti-unhappy',
      },
    ],
  };

  function getClientConfig() {
    return {
      EXACT_CAT,
      SLOT_FOOT_PREF,
      POS_EN,
      FOOT_EN,
      SKILL_EN,
      FORM_EN,
      PITCH_COORDS,
      FORMATION_MODS,
      FINE_SAFE_PCT,
    };
  }

  LF.config = {
    EXACT_CAT,
    SLOT_FOOT_PREF,
    DECLINE_START_AGE,
    POS_EN,
    FOOT_EN,
    SKILL_EN,
    FORM_EN,
    FORMATIONS,
    FORMATION_MODS,
    FORMATION_SHAPE,
    PITCH_COORDS,
    SKILL_DESC,
    MEMBER_ELAST,
    SHOP_ELAST,
    PRICE_FACTOR_MIN,
    PRICE_FACTOR_MAX,
    MEMBER_DISC_MAX,
    MEMBER_ANNUAL_PER_DISC,
    MEMBER_ANNUAL_SHARE_MAX,
    MEMBER_LOYAL,
    MEMBER_ANNUAL_RETAIN_PER_DISC,
    SHOP_BUY_RATE,
    SHOP_SHIRT_PRICE_BY_DIV,
    SHOP_FANS_BY_REP,
    SHOP_SIGNING_DAYS,
    SHOP_SIGNING_FEE_SHARE,
    SHOP_SIGNING_BONUS,
    SHOP_MEGA_DAYS,
    SHOP_MEGA_FEE_SHARE,
    SHOP_MEGA_BONUS,
    TICKETS_BASE,
    SECTOR_SHARE_WEIGHT,
    STADIUM_FREE_SEATS,
    STADIUM_OPS_PER_SEAT,
    TICKET_OCCASIONS,
    LOCKER_UNHAPPY_MIN,
    RENEW_GOLDEN_MIN,
    RENEW_GOLDEN_MAX,
    PRECONTRACT_DAYS,
    COUNTER_SAFE_MUL,
    COUNTER_AVG_REALIZED,
    FINE_SAFE_PCT,
    FINE_DEFAULT_DIRECT,
    FINE_DEFAULT_YELLOW,
    FINE_SLUMP_DAYS,
    FINE_SLUMP_PROB_BASE,
    FINE_SLUMP_AMOUNT,
    FINE_SLUMP_CAP,
    FOREIGN_FIELD_LIMITS,
    CT_MILESTONES,
    LIVE_COACH_GUIDE,
    getClientConfig,
  };
})(typeof window !== 'undefined' ? window : globalThis);
