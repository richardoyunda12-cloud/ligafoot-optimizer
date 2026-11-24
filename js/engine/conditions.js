/**
 * LigaFoot Optimizer Web Engine — conditions.js
 * Port eksak 1:1 dari bytecode Hermes v1.2.0 (`disasm_v9.hasm` #21342–#21407):
 * - Deterministik `hash` (FNV-1a + Murmur3 fmix32) & `frac`.
 * - `dayToIsoDate` (#21202 buildYearCalendar / #21390 dayOfDate).
 * - `kickoffOf` (#21344), `weatherFor` (#21349), `varFor` / `varOfComp` (#21357–#21358).
 * - `refereeCountry` (#21352), `daySchedule` (#21360), `refereeOf` (#21361), `refStyleOf` (#21350).
 * - `matchConditions` (#21362) + `condCardMul` (#21365), `condMissMul` (#21366), `condEnergyMul` (#21367).
 */
(function (root) {
  'use strict';

  const LF = (root.LFEngine = root.LFEngine || {});

  // Exact COUNTRY_INFO key order & continent mapping from disasm L705224..705573
  const COUNTRY_ISO_ORDER = [
    'ZA', 'AL', 'DE', 'AD', 'AO', 'SA', 'DZ', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BE', 'BZ', 'BY', 'BO', 'BA', 'BR',
    'BG', 'CM', 'CA', 'QA', 'KZ', 'CL', 'CN', 'CY', 'CO', 'CG', 'KP', 'KR', 'CI', 'CR', 'HR', 'CU', 'DK', 'EG',
    'SV', 'AE', 'EC', 'SC', 'SK', 'SI', 'ES', 'EE', 'ET', 'US', 'FJ', 'FI', 'PH', 'FR', 'GH', 'GE', 'GR', 'GT',
    'GN', 'HT', 'NL', 'HN', 'HK', 'HU', 'FO', 'SB', 'IN', 'ID', 'EN', 'IR', 'IQ', 'IE', 'NIR', 'IS', 'IL', 'IT',
    'ME', 'JM', 'JP', 'JO', 'XK', 'LV', 'LB', 'LY', 'LI', 'LT', 'LU', 'MK', 'MY', 'ML', 'MT', 'MA', 'MX', 'MM',
    'MZ', 'MD', 'NI', 'NG', 'NO', 'NZ', 'WL', 'PA', 'PG', 'PY', 'PE', 'PL', 'PT', 'CD', 'DO', 'CZ', 'RO', 'RU',
    'SM', 'SN', 'RS', 'SG', 'SY', 'SD', 'SE', 'CH', 'TJ', 'TH', 'PF', 'TZ', 'TT', 'TN', 'TR', 'UA', 'UG', 'UY',
    'UZ', 'VU', 'VE', 'VN', 'ZM', 'ZW', 'NC', 'GI',
  ];

  // Fix exact key order to match COUNTRY_INFO continent buckets (#20567 continentOfIso)
  const CONTINENT_GROUPS = {
    africa: 'ZA AO DZ CM CG CI EG ET GH GN LY ML MA MZ NG CD SN SD TZ TN UG ZM ZW',
    asia: 'SA QA CN KP KR AE PH HK IN ID IR IQ JP JO LB MY MM SG SY TJ TH UZ VN',
    europe: 'AL DE AD AM AT AZ BE BY BA BG KZ CY HR DK SC SK SI ES EE FI FR GE GR NL HU FO EN IE NIR IS IL IT ME XK LV LI LT LU MK MT MD NO WL PL PT CZ RO RU SM RS SE CH TR UA GI',
    northAmerica: 'BZ CA CR CU SV US GT HT HN JM MX NI PA DO TT',
    oceania: 'AU FJ SB NZ PG PF VU NC',
    southAmerica: 'AR BO BR CL CO EC PY PE UY VE',
  };
  const CONTINENT_OF_ISO = {};
  for (const [cont, listStr] of Object.entries(CONTINENT_GROUPS)) {
    for (const iso of listStr.split(' ')) {
      if (iso) CONTINENT_OF_ISO[iso] = cont;
    }
  }

  const RANK0_ISOS = new Set(
    'AE AR AU BE BR CA CL CN CO CR DE DZ EC EG EN ES FR IT JP KR MA MX NG NL NZ PT PY QA SA SC TN TR US UY ZA'.split(' ')
  );

  // poolOf(cont) cache (#21351): preserves COUNTRY_INFO iteration order + duplicates rank0 countries
  const CONTINENT_POOLS = {};
  for (const iso of COUNTRY_ISO_ORDER) {
    const cont = CONTINENT_OF_ISO[iso] || 'other';
    if (!CONTINENT_POOLS[cont]) CONTINENT_POOLS[cont] = [];
    CONTINENT_POOLS[cont].push(iso);
    if (RANK0_ISOS.has(iso)) CONTINENT_POOLS[cont].push(iso);
  }
  const ALL_RANKED_POOL = [];
  for (const iso of COUNTRY_ISO_ORDER) {
    ALL_RANKED_POOL.push(iso);
    if (RANK0_ISOS.has(iso)) ALL_RANKED_POOL.push(iso);
  }

  const SOUTH_HEMISPHERE = new Set(
    'BR AR CL UY PY BO PE ZA AU NZ AO MZ ZM ZW TZ FJ PG SB VU PF NC'.split(' ')
  );

  const CLIMATE_BY_COUNTRY_GROUPS = {
    tropical: 'BR CO VE EC PE BO MX CR PA SV GT HN NI BZ CU DO HT JM TT NG GH CI CM CG CD SN ML GN AO MZ TZ UG ZM ZW ET SD TH VN ID MY SG PH IN MM HK FJ PG SB VU PF NC',
    arid: 'SA QA AE EG IQ JO LY SY IR',
    med: 'ES PT IT GR CY MT TR IL LB TN DZ MA AL ME HR GI SM AD XK MK',
    oceanic: 'EN SC WL NIR IE FR NL BE LU',
    continental: 'DE AT CH LI CZ SK PL HU RO BG RS BA SI UA RU BY MD KZ UZ TJ GE AM AZ US CA KP',
    nordic: 'SE NO FI EE LV LT IS FO DK',
    south: 'AR CL UY PY ZA AU NZ',
    eastAsia: 'JP KR CN',
    temperate: '',
  };
  const CLIMATE_OF_COUNTRY = {};
  for (const [clim, listStr] of Object.entries(CLIMATE_BY_COUNTRY_GROUPS)) {
    if (!listStr) continue;
    for (const iso of listStr.split(' ')) {
      if (iso) CLIMATE_OF_COUNTRY[iso] = clim;
    }
  }

  // Seasonal [pRain, pSnow, pHeat] tables across 4 seasons (0: Winter NH, 1: Spring, 2: Summer, 3: Autumn)
  const CLIMATE_PROBS = {
    tropical:    [[0.12, 0, 0.14], [0.20, 0, 0.20], [0.30, 0, 0.24], [0.20, 0, 0.18]],
    arid:        [[0.05, 0, 0.04], [0.03, 0, 0.25], [0.01, 0, 0.50], [0.03, 0, 0.28]],
    med:         [[0.22, 0.01, 0], [0.15, 0, 0.06], [0.03, 0, 0.32], [0.15, 0, 0.06]],
    oceanic:     [[0.32, 0.04, 0], [0.25, 0, 0],    [0.18, 0, 0.04], [0.30, 0.01, 0]],
    continental: [[0.12, 0.18, 0], [0.20, 0.03, 0.02], [0.20, 0, 0.12], [0.20, 0.04, 0]],
    nordic:      [[0.12, 0.30, 0], [0.18, 0.08, 0], [0.22, 0, 0.02], [0.25, 0.08, 0]],
    south:       [[0.20, 0.01, 0], [0.18, 0, 0.05], [0.12, 0, 0.24], [0.18, 0, 0.05]],
    eastAsia:    [[0.08, 0.08, 0], [0.18, 0, 0.03], [0.32, 0, 0.20], [0.18, 0, 0.02]],
    temperate:   [[0.20, 0.05, 0], [0.18, 0, 0.03], [0.14, 0, 0.12], [0.20, 0.01, 0]],
  };
  const ALT_MID_PROBS  = [[0.22, 0.02, 0], [0.28, 0, 0], [0.30, 0, 0], [0.26, 0.01, 0]];
  const ALT_HIGH_PROBS = [[0.12, 0.05, 0], [0.20, 0.02, 0], [0.30, 0.01, 0], [0.18, 0.03, 0]];

  // Kickoff weighted slots [weekendSlots, midweekSlots]
  const KO_BR_MAIN  = [[['16:00', 4], ['18:30', 3], ['19:00', 1], ['20:30', 1], ['21:00', 1], ['11:00', 1]], [['19:30', 3], ['21:30', 5]]];
  const KO_BR_LOWER = [[['15:00', 3], ['16:00', 3], ['17:00', 2], ['18:30', 1], ['20:30', 1]], [['19:00', 2], ['20:00', 2], ['21:30', 1]]];
  const KO_SA_OTHER = [[['15:00', 2], ['17:00', 2], ['18:00', 2], ['20:00', 2]], [['19:00', 2], ['20:30', 2]]];
  const SA_KO_SET = new Set('UY CL CO EC PE BO PY VE'.split(' '));
  const KO_CONT_SA = [['19:00', 1], ['21:00', 2], ['21:30', 3]];
  const KO_CONT_OTHER = [['18:45', 1], ['21:00', 4]];
  const KO_NATIONS = [['16:00', 1], ['19:00', 2], ['21:00', 2]];
  const KO_COUNTRY_TABLE = {
    AR:    [[['14:30', 2], ['17:00', 3], ['19:15', 2], ['21:30', 3]], [['17:00', 1], ['21:30', 3]]],
    MX:    [[['17:00', 2], ['19:00', 3], ['21:00', 3]], [['19:00', 1], ['21:00', 2]]],
    US:    [[['19:30', 4], ['13:00', 1]], [['19:30', 1]]],
    EN:    [[['15:00', 4], ['12:30', 1], ['17:30', 1], ['14:00', 1], ['16:30', 1]], [['19:45', 2], ['20:00', 2]]],
    ES:    [[['14:00', 1], ['16:15', 2], ['18:30', 2], ['21:00', 3]], [['19:00', 1], ['21:00', 3]]],
    IT:    [[['12:30', 1], ['15:00', 2], ['18:00', 2], ['20:45', 3]], [['18:30', 1], ['20:45', 3]]],
    DE:    [[['15:30', 5], ['17:30', 1], ['18:30', 2], ['19:30', 1]], [['18:30', 1], ['20:30', 3]]],
    FR:    [[['15:00', 1], ['17:00', 2], ['19:00', 1], ['21:00', 2]], [['20:45', 1]]],
    PT:    [[['15:30', 2], ['18:00', 2], ['20:30', 3]], [['20:15', 1]]],
    NL:    [[['12:15', 1], ['14:30', 2], ['16:30', 2], ['18:45', 2], ['20:00', 2]], [['20:00', 1]]],
    JP:    [[['14:00', 1], ['15:00', 1], ['18:00', 1], ['19:00', 3]], [['19:00', 1]]],
    ASIA:  [[['17:00', 1], ['19:30', 4]], [['19:30', 1]]],
    ARID:  [[['18:00', 1], ['20:00', 3], ['21:30', 2]], [['20:00', 1], ['21:30', 1]]],
    EUR:   [[['15:00', 2], ['17:00', 2], ['18:30', 1], ['20:30', 2]], [['19:00', 1], ['20:00', 2], ['20:45', 1]]],
    OTHER: [[['15:00', 2], ['17:00', 2], ['19:00', 2], ['20:00', 1]], [['19:30', 2], ['20:30', 1]]],
  };
  const KO_ALIAS = {
    CA: 'US', SC: 'EN', WL: 'EN', NIR: 'EN', IE: 'EN', AT: 'DE', CH: 'DE',
    BE: 'FR', LU: 'FR', KR: 'ASIA', CN: 'ASIA', AU: 'ASIA',
    SA: 'ARID', QA: 'ARID', AE: 'ARID', KW: 'ARID', BH: 'ARID', OM: 'ARID', EG: 'ARID', IQ: 'ARID', JO: 'ARID',
  };

  // VAR sets (L723111..723135)
  const VAR_COUNTRIES = new Set(
    'BR AR CL CO EC PE UY PY BO VE MX US CA EN ES IT DE FR PT NL BE SC TR GR CH AT DK NO SE PL CZ RU UA HR RS RO HU BG SK SI CY IL SA QA AE EG MA TN DZ JP KR CN AU TH VN ID MY ZA IN'.split(' ')
  );
  const VAR_DIV2_COUNTRIES = new Set('ES IT DE BR'.split(' '));
  const VAR_BR_STATES = new Set('SP RJ MG RS PR BA PE CE GO SC'.split(' '));

  // Ref caches (keyed cleanly per country / world.comps)
  const _synthRefStyleCache = new Map();
  const _dayScheduleWeakCache = new WeakMap();
  const _poolSizeWeakCache = new WeakMap();

  /** FNV-1a 32-bit + Murmur3 fmix32 (#21348) */
  function hash(str) {
    const s = String(str || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** Normalized [0, 1) hash fraction (#21377) */
  function frac(str) {
    return hash(str) / 4294967296;
  }

  /** Konversi index hari kalender tahun (0 = 1 Jan) ke YYYY-MM-DD (#21202 / #21390) */
  function dayToIsoDate(year, day) {
    const y = Number(year);
    const d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(d)) return '';
    return new Date(Date.UTC(y, 0, 1) + d * 86400000).toISOString().slice(0, 10);
  }

  /** Seed deterministik pertandingan (#21353): `${homeId}|${awayId}|${YYYY-MM-DD}` */
  function matchSeedKey(homeId, awayId, dateStr) {
    return `${homeId || ''}|${awayId || ''}|${String(dateStr || '').slice(0, 10)}`;
  }

  function resolveTeamCountry(teamObj, teamIdOrIso, clubsMeta) {
    if (teamObj && typeof teamObj === 'object' && teamObj.country) {
      return String(teamObj.country).toUpperCase();
    }
    const idStr = String(teamIdOrIso || '');
    if (clubsMeta && clubsMeta[idStr]) {
      const mc = clubsMeta[idStr];
      if (Array.isArray(mc) && mc[2]) return String(mc[2]).toUpperCase();
      if (mc && mc.country) return String(mc.country).toUpperCase();
    }
    if (/^[A-Z]{2,3}$/.test(idStr)) return idStr;
    return '';
  }

  function lookupGeo(staticDb, teamId) {
    const gMap = staticDb && staticDb.geo;
    if (!gMap || !teamId) return null;
    const raw = gMap[teamId];
    if (Array.isArray(raw) && raw.length >= 2) {
      return { lat: Number(raw[0]) || 0, alt: Number(raw[1]) || 0 };
    }
    if (raw && typeof raw === 'object') {
      return { lat: Number(raw.lat) || 0, alt: Number(raw.alt) || 0 };
    }
    return null;
  }

  /** Penalti ketinggian kandang (#21345 altLoad): clamp((alt - 1400) / 2200, 0, 1) */
  function altLoad(alt) {
    return Math.max(0, Math.min(1, ((Number(alt) || 0) - 1400) / 2200));
  }

  /** Cek VAR per kompetisi (#21357 / #21358) */
  function varOfComp(comp) {
    if (!comp || typeof comp !== 'object') return false;
    const kind = String(comp.kind || 'league');
    if (
      kind === 'continental' || kind === 'recopa' || kind === 'worldclub'
      || kind === 'intercontinental' || kind === 'nation' || kind === 'qualifiers' || kind === 'nations'
    ) {
      return true;
    }
    const c = String(comp.country || '').toUpperCase();
    const div = Number(comp.division) || 1;
    const uf = String((comp.meta && comp.meta.uf) || '');
    if (kind === 'supercup' || kind === 'cup') return VAR_COUNTRIES.has(c);
    if (kind === 'league') {
      if (div <= 1) return VAR_COUNTRIES.has(c);
      if (div === 2) return VAR_DIV2_COUNTRIES.has(c);
      return false;
    }
    if (kind === 'state') {
      return c === 'BR' && div <= 1 && VAR_BR_STATES.has(uf);
    }
    return false;
  }

  /** Tier wasit per kompetisi (#21343) */
  function tierOfComp(comp) {
    if (!comp || typeof comp !== 'object') return 'A';
    const k = String(comp.kind || 'league');
    if (k === 'continental' || k === 'recopa' || k === 'worldclub' || k === 'qualifiers' || k === 'nations') return 'A';
    const div = Number(comp.division || comp.tier || 1) || 1;
    if (k === 'league') {
      if (div <= 1) return 'A';
      if (div === 2) return 'B';
      if (div === 3) return 'C';
      return 'D';
    }
    if (k === 'cup') {
      if (div <= 2) return 'A';
      if (div === 3) return 'B';
      return 'C';
    }
    if (k === 'state') {
      return div <= 1 ? 'B' : 'D';
    }
    return 'A';
  }

  /** Jam kickoff deterministik (#21344 kickoffOf) */
  function kickoffOf(homeCountry, dateStr, seed, comp) {
    const c = String(homeCountry || '').toUpperCase();
    const dIso = String(dateStr || '').slice(0, 10);
    let isWeekend = false;
    if (dIso.length === 10) {
      const dow = new Date(`${dIso}T12:00:00Z`).getUTCDay();
      isWeekend = (dow === 0 || dow === 6);
    }
    const kind = String((comp && comp.kind) || 'league');
    let slots = null;
    if (kind === 'continental' || kind === 'recopa' || kind === 'worldclub') {
      const isSA = (CONTINENT_OF_ISO[c] === 'southAmerica') || c === 'BR' || c === 'AR';
      slots = isSA ? KO_CONT_SA : KO_CONT_OTHER;
    } else if (kind === 'qualifiers' || kind === 'nations') {
      slots = KO_NATIONS;
    } else {
      let pair = null;
      if (c === 'BR') {
        const div = Number((comp && comp.division) || 1) || 1;
        pair = (kind === 'state' || div >= 3) ? KO_BR_LOWER : KO_BR_MAIN;
      } else if (SA_KO_SET.has(c)) {
        pair = KO_SA_OTHER;
      } else {
        const mapped = KO_COUNTRY_TABLE[c] || KO_COUNTRY_TABLE[KO_ALIAS[c] || ''];
        if (mapped) {
          pair = mapped;
        } else if (CLIMATE_OF_COUNTRY[c] === 'arid') {
          pair = KO_COUNTRY_TABLE.ARID;
        } else if (CONTINENT_OF_ISO[c] === 'europe') {
          pair = KO_COUNTRY_TABLE.EUR;
        } else {
          pair = KO_COUNTRY_TABLE.OTHER;
        }
      }
      slots = pair[isWeekend ? 0 : 1];
    }

    const totalW = slots.reduce((acc, it) => acc + it[1], 0);
    let r = frac(`ko|${seed}`) * totalW;
    for (const [hhmm, w] of slots) {
      r -= w;
      if (r < 0) return hhmm;
    }
    return slots[slots.length - 1][0];
  }

  /** Cuaca deterministik (#21349 weatherFor) */
  function weatherFor(homeCountry, dateStr, seed, geo, ko) {
    const month = Number(String(dateStr || '').slice(5, 7)) || 1;
    const c = String(homeCountry || '').toUpperCase();
    const isSouth = geo ? (geo.lat < 0) : SOUTH_HEMISPHERE.has(c);

    let season = 0;
    if (month === 12 || month <= 2) season = 0;
    else if (month <= 5) season = 1;
    else if (month <= 8) season = 2;
    else season = 3;
    if (isSouth) season = (season + 2) % 4;

    const highAlt = Boolean(
      geo && (geo.alt >= 2500 || (geo.alt >= 1500 && Math.abs(geo.lat) < 30))
    );

    let probs;
    if (highAlt) {
      probs = (geo.alt >= 3500 ? ALT_HIGH_PROBS : ALT_MID_PROBS)[season];
    } else {
      let clim = CLIMATE_OF_COUNTRY[c] || 'temperate';
      if (geo) {
        const lat = geo.lat;
        const absLat = Math.abs(lat);
        if (absLat >= 60) clim = 'nordic';
        else if (clim === 'tropical') clim = (lat <= -24) ? 'south' : (lat >= 24 ? 'med' : 'tropical');
        else if (clim === 'arid' || clim === 'med' || clim === 'oceanic') clim = (absLat < 20) ? 'tropical' : clim;
        else if (clim === 'south') clim = (lat > -24) ? 'tropical' : 'south';
        else if (clim === 'eastAsia') clim = (lat < 25) ? 'tropical' : (lat >= 41 ? 'continental' : 'eastAsia');
        else if (clim === 'continental') clim = (absLat < 28) ? 'tropical' : (absLat < 37 ? 'med' : (lat >= 57 ? 'nordic' : 'continental'));
        else clim = (absLat < 20) ? 'tropical' : clim;
      }
      probs = (CLIMATE_PROBS[clim] || CLIMATE_PROBS.temperate)[season];
    }

    const pRain = probs[0];
    const pSnow = probs[1];
    const pHeatBase = probs[2];

    let heatMul = 1;
    if (ko) {
      const hr = Number(String(ko).slice(0, 2));
      heatMul = hr < 17 ? 1.4 : (hr < 19 ? 1 : 0.3);
    }
    const pHeat = Math.min(0.7, pHeatBase * heatMul);

    const u = frac(`w|${seed}`);
    if (u < pRain) return 'rain';
    if (u < pRain + pSnow) return 'snow';
    if (u < pRain + pSnow + pHeat) return 'heat';
    const pCloudy = (1 - pRain - pSnow - pHeat) * 0.4;
    if (u < pRain + pSnow + pHeat + pCloudy) return 'cloudy';
    return 'clear';
  }

  /** Pilih negara wasit (#21352 refereeCountry) */
  function refereeCountry(homeCountry, awayCountry, seed) {
    const hc = String(homeCountry || '').toUpperCase();
    const ac = String(awayCountry || '').toUpperCase();
    if (!hc || hc === ac || !ac) return hc || 'BR';

    const cont = CONTINENT_OF_ISO[hc] || 'other';
    let cand = (CONTINENT_POOLS[cont] || []).filter(x => x !== hc && x !== ac);
    if (!cand.length) {
      cand = ALL_RANKED_POOL.filter(x => x !== hc && x !== ac);
    }
    if (!cand.length) return hc || 'BR';
    return cand[hash(`rc|${seed}`) % cand.length];
  }

  function refPoolSize(country, allTeams, realRefs) {
    const c = String(country || '').toUpperCase();
    if (!c) return 30;
    const rr = realRefs && realRefs[c];
    if (rr && rr.n > 0) return Math.max(30, rr.n);

    if (!allTeams || typeof allTeams !== 'object') return 32;
    let map = _poolSizeWeakCache.get(allTeams);
    if (!map) {
      map = new Map();
      for (const tm of Object.values(allTeams)) {
        const tc = String((tm && tm.country) || '');
        if (tc) map.set(tc, (map.get(tc) || 0) + 1);
      }
      _poolSizeWeakCache.set(allTeams, map);
    }
    const cnt = map.get(c) || 0;
    return Math.max(32, (Math.ceil(cnt / 2) + 6) * 4);
  }

  /** Jadwal wasit harian tanpa bentrok (#21360 daySchedule) */
  function daySchedule(world, allTeams, dateStr, realRefs, clubsMeta) {
    if (!world || !world.comps || typeof world.comps !== 'object') return new Map();
    const dIso = String(dateStr || '').slice(0, 10);
    if (dIso.length !== 10) return new Map();
    const yStr = String(world.year || '');
    const reqYear = Number(dIso.slice(0, 4));
    if (Number(world.year) !== reqYear) return new Map();

    let byDate = _dayScheduleWeakCache.get(world.comps);
    if (byDate && byDate.year !== yStr) byDate = null;
    if (!byDate) {
      byDate = { year: yStr, days: new Map() };
      _dayScheduleWeakCache.set(world.comps, byDate);
    }
    if (byDate.days.has(dIso)) return byDate.days.get(dIso);

    // Cari angka day untuk dIso
    const targetDay = Math.round((Date.parse(`${dIso}T00:00:00Z`) - Date.UTC(reqYear, 0, 1)) / 86400000);
    const items = [];
    for (const comp of Object.values(world.comps)) {
      if (!comp || !Array.isArray(comp.stages)) continue;
      const t = tierOfComp(comp);
      for (const st of comp.stages) {
        if (!st || !Array.isArray(st.rounds)) continue;
        for (const rnd of st.rounds) {
          if (!rnd || Number(rnd.day) !== targetDay) continue;
          for (const m of (rnd.matches || [])) {
            if (!m || !m.home || !m.away) continue;
            const hc = resolveTeamCountry(allTeams && allTeams[m.home], m.home, clubsMeta);
            const ac = resolveTeamCountry(allTeams && allTeams[m.away], m.away, clubsMeta);
            const seed = matchSeedKey(m.home, m.away, dIso);
            const rCountry = refereeCountry(hc, ac, seed);
            const intl = Boolean(hc && ac && hc !== ac);
            items.push({ seed, country: rCountry, intl, tier: t });
          }
        }
      }
    }

    items.sort((a, b) => {
      if (a.intl !== b.intl) return a.intl ? 1 : -1;
      return a.seed < b.seed ? -1 : (a.seed > b.seed ? 1 : 0);
    });

    const rot = targetDay % 4;
    const usedByCountry = new Map();
    const assigned = new Map();

    for (const it of items) {
      if (assigned.has(it.seed)) continue;
      const pool = refPoolSize(it.country, allTeams, realRefs);
      let used = usedByCountry.get(it.country);
      if (!used) { used = new Set(); usedByCountry.set(it.country, used); }

      const r = hash(`ri|${it.seed}`);
      let chosen = -1;

      const rr = realRefs && realRefs[it.country];
      const sl = rr && rr.t ? (rr.t[it.tier] || rr.t.A || rr.t.B || rr.t.C || rr.t.D) : null;
      if (sl && sl[1] > 0) {
        const [start, len] = sl;
        for (let k = 0; k < len && chosen < 0; k++) {
          const cand = start + ((r + k) % len);
          if (!used.has(cand)) chosen = cand;
        }
      }
      if (chosen < 0) {
        const slotSize = Math.max(1, Math.floor(pool / 4));
        for (let k = 0; k < slotSize && chosen < 0; k++) {
          const cand = 4 * ((r + k) % slotSize) + rot;
          if (!used.has(cand)) chosen = cand;
        }
      }
      for (let k = 0; k < pool && chosen < 0; k++) {
        const cand = (r + k) % pool;
        if (!used.has(cand)) chosen = cand;
      }
      if (chosen < 0) chosen = r % pool;

      used.add(chosen);
      assigned.set(it.seed, chosen);
    }

    byDate.days.set(dIso, assigned);
    return assigned;
  }

  /** Penugasan wasit pertandingan (#21361 refereeOf) */
  function refereeOf(homeId, awayId, homeCountry, awayCountry, dateStr, opts = {}) {
    const dIso = String(dateStr || '').slice(0, 10);
    const seed = matchSeedKey(homeId, awayId, dIso);
    const refCountry = refereeCountry(homeCountry, awayCountry, seed);
    const realRefs = (opts.staticDb && opts.staticDb.realRefs) || opts.realRefs || null;
    const sched = daySchedule(opts.world, opts.allTeams, dIso, realRefs, opts.clubsMeta);

    let refIdx = sched.get(seed);
    if (refIdx === undefined) {
      const rr = realRefs && realRefs[refCountry];
      const tier = tierOfComp(opts.comp);
      const sl = rr && rr.t ? (rr.t[tier] || rr.t.A || rr.t.B || rr.t.C || rr.t.D) : null;
      if (sl && sl[1] > 0) {
        refIdx = sl[0] + (hash(`ri|${seed}`) % sl[1]);
      } else {
        refIdx = hash(`ri|${seed}`) % 30;
      }
    }

    return { refCountry, refIdx, seed };
  }

  /** Gaya & nama wasit deterministik (#21350 refStyleOf) */
  function refStyleOf(country, refIdx, realRefs) {
    const c = String(country || 'BR').toUpperCase();
    const rr = realRefs && realRefs[c];
    if (rr && rr.n > 0) {
      const i = ((refIdx % rr.n) + rr.n) % rr.n;
      const ch = rr.s ? rr.s[i] : 'N';
      const style = ch === 'S' ? 'strict' : (ch === 'L' ? 'lenient' : 'normal');
      const name = (Array.isArray(rr.names) && rr.names[i]) ? rr.names[i] : '';
      return { style, name, isReal: true };
    }

    if (refIdx < 30) {
      let arr = _synthRefStyleCache.get(c);
      if (!arr) {
        const indices = Array.from({ length: 30 }, (_, i) => i).sort((a, b) => hash(`rs|${c}|${a}`) - hash(`rs|${c}|${b}`));
        const bucket = [];
        for (let k = 0; k < 8; k++) bucket.push('strict');
        for (let k = 0; k < 8; k++) bucket.push('lenient');
        for (let k = 0; k < 4; k++) bucket.push('home');
        for (let k = 0; k < 10; k++) bucket.push('normal');
        arr = new Array(30).fill('normal');
        indices.forEach((slotIdx, i) => { arr[slotIdx] = bucket[i] || 'normal'; });
        _synthRefStyleCache.set(c, arr);
      }
      const idx = ((refIdx % 30) + 30) % 30;
      return { style: arr[idx], name: '', isReal: false };
    }

    const r = hash(`rs|${c}|${refIdx}`) % 30;
    const style = r < 8 ? 'strict' : (r < 16 ? 'lenient' : (r < 20 ? 'home' : 'normal'));
    return { style, name: '', isReal: false };
  }

  function condCardMul(refStyle, side) {
    if (refStyle === 'strict') return 1.2;
    if (refStyle === 'lenient') return 0.82;
    if (refStyle === 'home') return side === 'home' ? 0.85 : 1.2;
    return 1.0;
  }

  function condMissMul(weather) {
    if (weather === 'rain') return 1.12;
    if (weather === 'snow') return 1.18;
    return 1.0;
  }

  function condEnergyMul(weather, altHit, side) {
    const wm = weather === 'heat' ? 1.12 : (weather === 'snow' ? 1.05 : 1.0);
    const am = (side === 'away' && altHit > 0) ? (1 + 0.35 * altHit) : 1.0;
    return wm * am;
  }

  /** Kondisi pertandingan lengkap (#21362 matchConditions) */
  function matchConditions(homeId, awayId, homeCountry, awayCountry, dateStr, varOn, opts = {}) {
    const sdb = opts.staticDb || null;
    const clubsMeta = (sdb && sdb.clubs) || opts.clubsMeta || null;
    const realRefs = (sdb && sdb.realRefs) || opts.realRefs || null;
    const dIso = String(dateStr || '').slice(0, 10);

    const hc = String(homeCountry || resolveTeamCountry(opts.allTeams && opts.allTeams[homeId], homeId, clubsMeta) || '').toUpperCase();
    const ac = String(awayCountry || resolveTeamCountry(opts.allTeams && opts.allTeams[awayId], awayId, clubsMeta) || '').toUpperCase();

    const refInfo = refereeOf(homeId, awayId, hc, ac, dIso, {
      world: opts.world,
      allTeams: opts.allTeams,
      comp: opts.comp,
      staticDb: sdb,
      realRefs,
      clubsMeta,
    });
    const styleRes = refStyleOf(refInfo.refCountry, refInfo.refIdx, realRefs);
    const homeGeo = lookupGeo(sdb, homeId);
    const awayGeo = lookupGeo(sdb, awayId);
    const ko = kickoffOf(hc, dIso, refInfo.seed, opts.comp);
    const weather = weatherFor(hc, dIso, refInfo.seed, homeGeo, ko);

    const neutral = Boolean(opts.neutral);
    const alt = (!neutral && homeGeo && homeGeo.alt >= 2000) ? homeGeo.alt : 0;
    let altHit = 0;
    if (alt > 0) {
      const awayAlt = awayGeo ? awayGeo.alt : 0;
      altHit = Math.round(Math.max(0, altLoad(alt) - altLoad(awayAlt)) * 100) / 100;
    }

    const vOn = varOn !== undefined ? Boolean(varOn) : varOfComp(opts.comp);
    return {
      weather,
      ko,
      alt,
      altHit,
      dateStr: dIso,
      refCountry: refInfo.refCountry,
      refIdx: refInfo.refIdx,
      refStyle: styleRes.style,
      refName: styleRes.name,
      refIsReal: styleRes.isReal,
      seed: refInfo.seed,
      varOn: vOn,
      cardMulHome: condCardMul(styleRes.style, 'home'),
      cardMulAway: condCardMul(styleRes.style, 'away'),
      missMul: condMissMul(weather),
      energyMulHome: condEnergyMul(weather, altHit, 'home'),
      energyMulAway: condEnergyMul(weather, altHit, 'away'),
    };
  }

  LF.conditions = {
    hash,
    frac,
    dayToIsoDate,
    matchSeedKey,
    varOfComp,
    tierOfComp,
    kickoffOf,
    weatherFor,
    refereeCountry,
    refPoolSize,
    daySchedule,
    refereeOf,
    refStyleOf,
    condCardMul,
    condMissMul,
    condEnergyMul,
    matchConditions,
  };
})(typeof window !== 'undefined' ? window : globalThis);
