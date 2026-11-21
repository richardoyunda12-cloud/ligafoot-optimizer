/**
 * LigaFoot Optimizer Web Engine — utils.js
 * Utilitas aman (zero-crash), translator ID/EN, tanggal kalender UTC eksak,
 * parser baris save LigaFoot, dan adapter static_db kompak (.min.json.gz).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});
  const C = LF.config;

  function posEn(code) {
    const c = String(code || '').toUpperCase();
    return C.POS_EN[c] || c;
  }

  function footEn(code) {
    const c = String(code || '').toUpperCase();
    return C.FOOT_EN[c] || c;
  }

  function skillEn(code) {
    const c = String(code || '').toUpperCase();
    return C.SKILL_EN[c] || c;
  }

  function formEn(fk) {
    return C.FORM_EN[fk] || fk;
  }

  function clamp(val, lo, hi) {
    const v = Number(val);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function safeNum(val, defVal = 0.0) {
    if (val === null || val === undefined || typeof val === 'boolean' || val === '') return defVal;
    const v = Number(val);
    return Number.isFinite(v) ? v : defVal;
  }

  function safeInt(val, defVal = 0) {
    return Math.round(safeNum(val, defVal));
  }

  function roundTo(val, decimals = 1) {
    const p = Math.pow(10, decimals);
    return Math.round((safeNum(val, 0) + Number.EPSILON) * p) / p;
  }

  function fmtMoney(val) {
    const v = safeNum(val, 0.0);
    const sign = v < 0 ? '-' : '';
    const av = Math.abs(v);
    if (av >= 1e6) return `${sign}${(av / 1e6).toFixed(2)}M`;
    if (av >= 1e3) return `${sign}${Math.round(av / 1e3)}K`;
    return `${sign}${Math.round(av)}`;
  }

  /**
   * Parse tanggal ISO "YYYY-MM-DD" secara murni UTC (bebas bug timezone/DST).
   * Mengembalikan timestamp UTC ms (number) atau null.
   */
  function parseIsoDateMs(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const ms = Date.UTC(y, mo - 1, d);
    return Number.isFinite(ms) ? ms : null;
  }

  function msToIsoDate(ms) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  function daysBetweenIso(fromStr, toStr) {
    const a = parseIsoDateMs(fromStr);
    const b = parseIsoDateMs(toStr);
    if (a === null || b === null) return null;
    return Math.round((b - a) / 86400000);
  }

  /**
   * Ubah angka hari kalender LigaFoot (1 Januari = hari 0; 2028-03-14 = hari 73)
   * menjadi tanggal YYYY-MM-DD eksak (otomatis pilih tahun ini atau tahun lalu).
   */
  function formatMatchDay(rawDay, seasonStartDate = null, currentDate = null) {
    if (rawDay === null || rawDay === undefined || rawDay === '') return '-';
    const s = String(rawDay).trim();
    if (s.length >= 8 && s.includes('-')) return s.slice(0, 10);

    const dayNum = Math.trunc(Number(s));
    if (!Number.isFinite(dayNum)) return s.slice(0, 10);

    const curMs = parseIsoDateMs(currentDate);
    if (curMs !== null && dayNum >= 0 && dayNum <= 366) {
      const curYear = new Date(curMs).getUTCFullYear();
      const jan1Cur = Date.UTC(curYear, 0, 1);
      const curDoy = Math.round((curMs - jan1Cur) / 86400000);
      if (dayNum <= curDoy + 2) {
        return msToIsoDate(jan1Cur + dayNum * 86400000);
      }
      const jan1Prev = Date.UTC(curYear - 1, 0, 1);
      return msToIsoDate(jan1Prev + dayNum * 86400000);
    }

    const baseMs = parseIsoDateMs(seasonStartDate);
    if (baseMs !== null) {
      return msToIsoDate(baseMs + dayNum * 86400000);
    }
    return `Hari ${dayNum}`;
  }

  function translateCompName(name, compId = '') {
    const raw = String(name || '').trim();
    const cid = String(compId || '').toLowerCase();
    const low = raw.toLowerCase();

    if (!raw || low === 'league') {
      if (cid.includes('indonesia1')) return 'Liga 1 Indonesia';
      if (cid.includes('indonesia2')) return 'Liga 2 Indonesia';
      return 'Liga';
    }

    const codeMap = {
      indonesia1: 'Super League Indonesia',
      indonesia2: 'Liga 2 Indonesia',
      'cont:afc2': 'AFC Champions League Two',
      'cont:afc1': 'AFC Champions League Elite',
      'cup:indonesia:presiden': 'Piala Presiden',
    };
    if (codeMap[low]) return codeMap[low];
    if (codeMap[cid]) return codeMap[cid];

    const exactMap = {
      'super league da indonésia': 'Super League Indonesia',
      'liga dos campeões da afc two': 'AFC Champions League Two',
      'liga dos campeões da afc': 'AFC Champions League',
      'liga dos campeões da uefa': 'UEFA Champions League',
      'liga europa da uefa': 'UEFA Europa League',
      'liga conferência da uefa': 'UEFA Conference League',
      'copa libertadores': 'Copa Libertadores',
      'copa sul-americana': 'Copa Sudamericana',
      'mundial de clubes': 'Piala Dunia Antarklub',
    };
    if (exactMap[low]) return exactMap[low];

    let out = raw;
    const reps = [
      [/\bLiga dos Campeões da\b/gi, 'Liga Champions'],
      [/\bLiga dos Campeões\b/gi, 'Liga Champions'],
      [/\bSupercopa da\b/gi, 'Piala Super'],
      [/\bSupercopa do\b/gi, 'Piala Super'],
      [/\bSupercopa de\b/gi, 'Piala Super'],
      [/\bCopa da\b/gi, 'Piala'],
      [/\bCopa do\b/gi, 'Piala'],
      [/\bCopa de\b/gi, 'Piala'],
      [/\bTaça da\b/gi, 'Piala'],
      [/\bTaça do\b/gi, 'Piala'],
      [/\bTaça de\b/gi, 'Piala'],
      [/\bCampeonato\b/gi, 'Liga'],
      [/\bda Indonésia\b/gi, 'Indonesia'],
      [/\bdo Brasil\b/gi, 'Brasil'],
      [/\bda Inglaterra\b/gi, 'Inggris'],
      [/\bda Espanha\b/gi, 'Spanyol'],
      [/\bda Itália\b/gi, 'Italia'],
      [/\bda Alemanha\b/gi, 'Jerman'],
      [/\bda França\b/gi, 'Prancis'],
      [/\bPré-temporada\b/gi, 'Pramusim'],
      [/\bAmistoso\b/gi, 'Uji Coba'],
    ];
    for (const [re, rep] of reps) {
      out = out.replace(re, rep);
    }
    return out.trim();
  }

  function translateRoundName(rn) {
    const s = String(rn || '').trim();
    if (!s) return '';

    let m = /^(\d+)\s*[ªºa]?\s*rodada$/i.exec(s);
    if (m) return `Pekan ${m[1]}`;
    m = /^rodada\s*(\d+)$/i.exec(s);
    if (m) return `Pekan ${m[1]}`;

    let out = s;
    const reps = [
      [/\bQuartas de final\b/gi, 'Perempat Final'],
      [/\bOitavas de final\b/gi, '16 Besar'],
      [/\bSemifinais\b/gi, 'Semifinal'],
      [/\bFase de grupos\b/gi, 'Fase Grup'],
      [/\bFase preliminar\b/gi, 'Babak Kualifikasi'],
      [/\bDisputa de 3º lugar\b/gi, 'Perebutan Juara 3'],
      [/\bTerceiro lugar\b/gi, 'Perebutan Juara 3'],
      [/\b3º lugar\b/gi, 'Perebutan Juara 3'],
      [/\bPré-temporada\b/gi, 'Pramusim'],
      [/\bAmistoso\b/gi, 'Uji Coba'],
      [/\(\s*ida\s*\)/gi, '(Leg 1)'],
      [/\(\s*volta\s*\)/gi, '(Leg 2)'],
      [/\bida\b/gi, 'Leg 1'],
      [/\bvolta\b/gi, 'Leg 2'],
    ];
    for (const [re, rep] of reps) {
      out = out.replace(re, rep);
    }
    return out.trim();
  }

  function translateSponsorSlot(slot) {
    const s = String(slot || '').trim().toLowerCase();
    const map = {
      master: 'Utama (Master)',
      material: 'Apparel / Jersey',
      secundario: 'Sekunder',
      secondary: 'Sekunder',
      manga: 'Lengan',
      costas: 'Punggung',
    };
    return map[s] || slot || 'Sponsor';
  }

  function translatePhaseName(phase) {
    const s = String(phase || '').trim().toLowerCase();
    const map = {
      season: 'Musim Berjalan',
      preseason: 'Pramusim',
      offseason: 'Jeda Musim',
      end: 'Akhir Musim',
      transfer: 'Bursa Transfer',
    };
    return map[s] || String(phase || '-');
  }

  /**
   * Parser referensi teruji untuk playerDynamic (user = object, AI = array[6..7]).
   */
  function parseDynamicRow(row) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return [row.id || null, { ...row }];
    }
    if (Array.isArray(row) && row.length >= 6) {
      const extra = (row.length > 6 && row[6] && typeof row[6] === 'object' && !Array.isArray(row[6]))
        ? row[6]
        : {};
      const d = {
        ...extra,
        id: row[0],
        age: row[1],
        force: row[2],
        contractYears: row[3],
        salary: row[4],
        marketValue: row[5],
      };
      return [row[0], d];
    }
    return [null, null];
  }

  /**
   * Parser referensi teruji untuk extraRows (regen/transfer: object atau array[14..16]).
   */
  function parseExtraRow(row) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const d = { ...row, _source: 'regen' };
      return [d.id || null, d];
    }
    if (Array.isArray(row) && row.length >= 14) {
      const extra = (row.length > 15 && row[15] && typeof row[15] === 'object' && !Array.isArray(row[15]))
        ? row[15]
        : {};
      const d = {
        id: row[0],
        name: row[1],
        position: row[2],
        age: row[3],
        nationality: row[4],
        foot: row[5],
        force: row[6],
        potential: row[7],
        skill1: row[8],
        skill2: row[9],
        star: row[10],
        salary: row[11],
        marketValue: row[12],
        contractYears: row[13],
        photo: row.length > 14 ? row[14] : '',
        _source: 'regen',
        ...extra,
      };
      return [d.id || null, d];
    }
    return [null, null];
  }

  /**
   * Adapter universal Static DB: mendukung baik objek JSON asli ligafoot_static_db.json
   * MAUPUN format array kompak static_db.min.json.gz:
   *   Player: ["Name", "Pos", "S1", "S2", "Nat", "Foot", age, force, starInt, hashInt]
   *   Club:   ["Name", "Short", "Country"]
   */
  function getStaticPlayer(staticPlayers, pid) {
    if (!staticPlayers || !pid) return {};
    const entry = staticPlayers[pid];
    if (!entry) return {};
    if (Array.isArray(entry)) {
      return {
        id: pid,
        name: entry[0] || pid,
        pos: entry[1] || '',
        s1: entry[2] || '',
        s2: entry[3] || '',
        nationality: entry[4] || '',
        foot: entry[5] || 'D',
        age: entry[6],
        force: entry[7],
        star: Boolean(entry[8]),
        hash: entry[9] || 0,
      };
    }
    return entry;
  }

  function getStaticClub(clubsMeta, cid) {
    if (!clubsMeta || !cid) return {};
    const entry = clubsMeta[cid];
    if (!entry) return {};
    if (Array.isArray(entry)) {
      return {
        id: cid,
        name: entry[0] || cid,
        short: entry[1] || '',
        country: entry[2] || '',
      };
    }
    return entry;
  }

  function normalizeTicketMul(rawMul) {
    const def = { geral: 1.0, arquibancada: 1.0, cadeiras: 1.0, camarotes: 1.0 };
    if (typeof rawMul === 'number') {
      const v = clamp(rawMul, 0.5, 2.0);
      return { geral: v, arquibancada: v, cadeiras: v, camarotes: v };
    }
    if (rawMul && typeof rawMul === 'object') {
      return {
        geral: clamp(safeNum(rawMul.geral, 1.0), 0.5, 2.0),
        arquibancada: clamp(safeNum(rawMul.arquibancada, 1.0), 0.5, 2.0),
        cadeiras: clamp(safeNum(rawMul.cadeiras, 1.0), 0.5, 2.0),
        camarotes: clamp(safeNum(rawMul.camarotes, 1.0), 0.5, 2.0),
      };
    }
    return def;
  }

  function estimateDivisionFromLeague(leagueId, worldComps = null) {
    if (worldComps && typeof worldComps === 'object' && worldComps[leagueId]) {
      const meta = (worldComps[leagueId] && worldComps[leagueId].meta) || {};
      const d = safeInt(meta.div || meta.division || meta.tier, 0);
      if (d >= 1 && d <= 4) return d;
    }
    const lid = String(leagueId || '').toLowerCase();
    const letters = ['a', 'b', 'c', 'd'];
    for (let d = 1; d <= 4; d++) {
      if (lid.endsWith(String(d)) || lid.includes(`div${d}`) || lid.includes(`serie${letters[d - 1]}`)) {
        return d;
      }
    }
    return 1;
  }

  function estimatePayrollRef(division, teamPayroll) {
    const baseByDiv = { 1: 2200000, 2: 900000, 3: 400000, 4: 200000 };
    return Math.max(safeNum(teamPayroll, 0), baseByDiv[division] || 1500000);
  }

  LF.utils = {
    posEn,
    footEn,
    skillEn,
    formEn,
    clamp,
    safeNum,
    safeInt,
    roundTo,
    fmtMoney,
    parseIsoDateMs,
    msToIsoDate,
    daysBetweenIso,
    formatMatchDay,
    translateCompName,
    translateRoundName,
    translateSponsorSlot,
    translatePhaseName,
    parseDynamicRow,
    parseExtraRow,
    getStaticPlayer,
    getStaticClub,
    normalizeTicketMul,
    estimateDivisionFromLeague,
    estimatePayrollRef,
  };
})(typeof window !== 'undefined' ? window : globalThis);
