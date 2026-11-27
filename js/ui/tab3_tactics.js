// ==================== RENDER TAB 3: LAPANGAN, DUAL XI & RUANG GANTI (v8.2.2) ====================
function initTab3() {
  const sel = document.getElementById('t3-form-select');
  const rawAct = (D.meta && D.meta.isCustomFormation && D.meta.activeFormationRaw) ? D.meta.activeFormationRaw : null;
  const initFk = rawAct || (D.meta && D.meta.activeFormation) || '4-3-3';
  if (sel) {
    const keys = [...Object.keys(D.formations || {})];
    if (rawAct && !keys.includes(rawAct)) keys.unshift(rawAct);
    sel.innerHTML = keys.map(f => {
      const sp = (window.LFEngine && LFEngine.tactics && LFEngine.tactics.resolveFormationSpec)
        ? LFEngine.tactics.resolveFormationSpec(f)
        : null;
      const md = sp ? { atkMod: sp.atkMod, defMod: sp.defMod } : FORMATION_MODS[f];
      const mStr = md ? ` (A${fmtMod(md.atkMod)}/D${fmtMod(md.defMod)})` : '';
      return `<option value="${esc(f)}" ${f === initFk ? 'selected' : ''}>${esc(fmtForm(f))}${mStr}</option>`;
    }).join('');
  }
  renderTab3Pitch();
  renderFormCompareTable();
  renderMoodTable();

  const recEl = document.getElementById('t3-recent-tbl');
  if (recEl) {
    recEl.innerHTML = `<thead><tr><th>Tgl</th><th>Lawan &amp; Kompetisi</th><th>Skor</th><th>Venue</th></tr></thead><tbody>` +
      (D.recentMatches && D.recentMatches.length ? D.recentMatches.map(m => {
        const hasScore = (m.gf !== null && m.gf !== undefined && m.ga !== null && m.ga !== undefined);
        const cls = !hasScore ? 'b-muted' : (m.gf > m.ga ? 'b-good' : (m.gf < m.ga ? 'b-crit' : 'b-warn'));
        const scTxt = hasScore ? `${m.gf} - ${m.ga}` : (m.rev > 0 ? fmtM(m.rev) : (m.att ? m.att.toLocaleString('id-ID') + ' org' : '-'));
        return `<tr><td class="mono">${esc(m.date)}</td><td><b>${esc(m.opp)}</b> <span class="c-muted" style="font-size:10px">(${esc(m.comp)})</span></td><td><span class="badge ${cls} mono">${scTxt}</span></td><td>${m.home ? '🏠 Kandang' : '✈️ Tandang'}</td></tr>`;
      }).join('') : '<tr><td colspan="4" class="c-muted">Belum ada catatan laga.</td></tr>') + `</tbody>`;
  }
}

function ensureFormSelectOption(fk) {
  const sel = document.getElementById('t3-form-select');
  const key = String(fk || '').trim();
  if (!sel || !key) return;
  if (!Array.from(sel.options).some(o => o.value === key)) {
    const sp = (window.LFEngine && LFEngine.tactics && LFEngine.tactics.resolveFormationSpec)
      ? LFEngine.tactics.resolveFormationSpec(key)
      : null;
    const mStr = sp ? ` (A${fmtMod(sp.atkMod)}/D${fmtMod(sp.defMod)})` : '';
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${fmtForm(key)}${mStr}`;
    sel.insertBefore(opt, sel.firstChild);
  }
}

function setXiMode(m) {
  xiMode = m;
  const bBest = document.getElementById('xi-mode-best');
  const bRot = document.getElementById('xi-mode-rot');
  if (bBest) bBest.className = m === 'best' ? 'btn btn-green' : 'btn';
  if (bRot) bRot.className = m === 'rot' ? 'btn btn-green' : 'btn';
  renderTab3Pitch();
  renderFormCompareTable();
}

function onFormationChange() {
  renderTab3Pitch();
  renderFormCompareTable();
}

function selectFormationFromTable(fk) {
  ensureFormSelectOption(fk);
  const sel = document.getElementById('t3-form-select');
  if (sel) sel.value = fk;
  renderTab3Pitch();
  renderFormCompareTable();
  const pitch = document.getElementById('t3-pitch');
  if (pitch && pitch.scrollIntoView) {
    pitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showToast(`Lapangan diperbarui ke formasi ${fmtForm(fk)}`);
}

function computeLiveFormCompare(rotMode) {
  const keys = [...Object.keys(D.formations || {})];
  const rawAct = (D.meta && D.meta.isCustomFormation && D.meta.activeFormationRaw) ? D.meta.activeFormationRaw : null;
  if (rawAct && !keys.includes(rawAct)) keys.push(rawAct);
  const sel = document.getElementById('t3-form-select');
  const curSel = sel ? sel.value : '';
  if (curSel && curSel.includes('~') && !keys.includes(curSel)) keys.push(curSel);
  const rows = keys.map(fk => {
    const res = solveBestXiJS(fk, rotMode);
    const md = (res.atkMod !== undefined) ? { atkMod: res.atkMod, defMod: res.defMod } : (FORMATION_MODS[res.baseFormation || fk] || { atkMod: 0, defMod: 0 });
    return {
      formation: fk,
      baseFormation: res.baseFormation || fk.split('~')[0],
      isCustom: Boolean(res.isCustom || String(fk).includes('~')),
      avgScore: res.avg,
      totalScore: res.tot,
      sectors: res.sectors || { GK: 0, DEF: 0, MID: 0, ATK: 0 },
      engineSectors: res.engineSectors || res.sectors || { GK: 0, DEF: 0, MID: 0, ATK: 0 },
      chemistry: res.chemistry !== undefined ? res.chemistry : 100,
      foreignCount: res.fCnt,
      wrongFootCount: res.wfCnt,
      atkMod: md.atkMod,
      defMod: md.defMod,
      falseNine: res.falseNine,
      hasFormationBug: Boolean(res.hasFormationBug),
      formationBugInfo: res.formationBugInfo || null,
    };
  });
  rows.sort((a, b) => {
    if (a.hasFormationBug !== b.hasFormationBug) return a.hasFormationBug ? 1 : -1;
    return b.totalScore - a.totalScore;
  });
  return rows;
}

function renderFormCompareTable() {
  const tbl = document.getElementById('t3-form-tbl');
  if (!tbl) return;
  const isRot = xiMode === 'rot';
  const sel = document.getElementById('t3-form-select');
  const clubActiveFk = (D.meta && D.meta.isCustomFormation && D.meta.activeFormationRaw) ? D.meta.activeFormationRaw : D.meta.activeFormation;
  const curFk = sel ? sel.value : clubActiveFk;
  const rows = isRot ? computeLiveFormCompare(true) : ((D.formCompare && D.formCompare.length && (!curFk.includes('~') || D.formCompare.some(x => x.formation === curFk))) ? D.formCompare : computeLiveFormCompare(false));

  // Tombol 1-ketuk "✨ Pakai #1" jika formasi aktif bukan yang terkuat
  const bestSlot = document.getElementById('t3-best-form-slot');
  if (bestSlot && rows.length) {
    const topF = rows[0];
    if (topF.formation !== curFk) {
      bestSlot.innerHTML = `<button type="button" class="btn btn-sm btn-amber" onclick="selectFormationFromTable('${escJs(topF.formation)}')">✨ Pakai #1 (${esc(fmtForm(topF.formation))} · ${topF.avgScore})</button>`;
    } else {
      bestSlot.innerHTML = `<span class="badge b-good">🏆 Formasi #1 Aktif</span>`;
    }
  }

  const modeLbl = isRot ? 'Rotation XI' : 'Best XI';
  const hdrEl = document.getElementById('t3-form-title');
  if (hdrEl) hdrEl.textContent = `📊 ${rows.length} Formasi (#3575/#21891 • Mode ${modeLbl})`;

  tbl.innerHTML = `<thead><tr>
    <th>Formasi (Klik → Pitch)</th><th>Avg</th><th class="col-hide-mob">Chem</th><th>DEF</th><th>MID</th><th>ATK</th><th class="col-hide-mob">Asing</th><th class="col-hide-mob">FB-WF</th>
  </tr></thead><tbody>` +
    rows.map((f, idx) => {
      const isCur = f.formation === curFk;
      const isClub = f.formation === clubActiveFk;
      const isCust = Boolean(f.isCustom || String(f.formation).includes('~'));
      const bugTag = f.hasFormationBug
        ? `<span class="badge b-crit" style="margin-left:3px" title="${esc(tipFor('BUG343'))}">⚠ BUG -33% ATK</span>`
        : '';
      return `<tr class="${isCur ? 'hl-user' : ''}" style="cursor:pointer" onclick="selectFormationFromTable('${escJs(f.formation)}')">
        <td>
          <b>${idx === 0 ? '🏆 ' : ''}${esc(fmtForm(f.formation))}</b>
          ${isCust ? '<span class="badge b-accent" style="margin-left:3px">CUSTOM</span>' : ''}
          ${isClub ? '<span class="badge b-info" style="margin-left:3px">Klub</span>' : ''}
          ${f.falseNine ? '<span class="badge b-accent" style="margin-left:3px">F9</span>' : ''}
          ${bugTag}
        </td>
        <td class="mono ${f.hasFormationBug ? 'c-red' : 'c-green'}"><b>${f.avgScore}</b></td>
        <td class="mono c-sky col-hide-mob">${f.chemistry ?? 100}%</td>
        <td class="mono">${f.sectors.DEF}</td>
        <td class="mono">${f.sectors.MID}</td>
        <td class="mono ${f.hasFormationBug ? 'c-red' : ''}">${f.sectors.ATK}${f.hasFormationBug ? ' (-33%)' : ''}</td>
        <td class="mono col-hide-mob">${f.foreignCount}/${D.meta.foreignCap}</td>
        <td class="mono col-hide-mob ${f.wrongFootCount ? 'c-amber' : 'c-green'}">${f.wrongFootCount}</td>
      </tr>`;
    }).join('') + `</tbody>`;
}

function getMoodActionAdvice(p) {
  if (p.injured) return { txt: '🏥 Istirahat Cedera (Kebal)', cls: 'b-muted' };
  if (p.roleSore) return { txt: '⚠ roleSore: Beri menit / tunggu reda', cls: 'b-crit' };
  if (p.mood === 'unhappy') {
    if (p.squadRank >= 12) return { txt: 'Set squadRole = Reserve (100% kebal!)', cls: 'b-warn' };
    return { txt: 'Mainkan starter / Rotation XI segera', cls: 'b-crit' };
  }
  if (p.moodImmune || p.moodTier === 0) return { txt: '✓ Kebal Unhappy', cls: 'b-good' };
  if (p.minPct < (p.reqPct + 5)) {
    return p.moodTier === 1
      ? { txt: 'Rawan: beri 1 laga di Rotation XI', cls: 'b-warn' }
      : { txt: 'Rawan: jaga jatah menit ≥25%', cls: 'b-warn' };
  }
  return { txt: '✓ Aman', cls: 'b-info' };
}

function renderMoodTable() {
  const roster = D.roster || [];
  const unhCnt = roster.filter(p => p.mood === 'unhappy').length;
  const riskCnt = roster.filter(p => !p.injured && p.mood !== 'unhappy' && p.moodTier > 0 && p.minPct < (p.reqPct + 5)).length;
  const immuneCnt = roster.filter(p => p.moodImmune || p.moodTier === 0).length;

  const mc = (D.cfg && D.cfg.MOOD_CFG) || (window.LFEngine && LFEngine.config && LFEngine.config.MOOD_CFG) || {};
  const natPct = Math.round((mc.starterQuota ?? 0.25) * 100);
  const expPct = Math.round((mc.explicitStarterQuota ?? 0.40) * 100);
  const subPct = Math.round((mc.youngQuota ?? 0.08) * 100);
  const hapTop = Math.round((mc.happyTop ?? 0.60) * 100);
  const hapSub = Math.round((mc.happySub ?? 0.35) * 100);
  const hapRes = Math.round((mc.happyRes ?? 0.15) * 100);
  const sumEl = document.getElementById('t3-mood-summary');
  if (sumEl) {
    sumEl.innerHTML = `
      <div class="t3-mini-strip" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:8px">
        <div class="t3-mini-card">
          <div class="kpi-lbl">Unhappy (≥${(D.cfg && D.cfg.LOCKER_UNHAPPY_MIN) || 4} = Penalti)</div>
          <div class="kpi-val mono ${unhCnt >= 4 ? 'c-red' : (unhCnt > 0 ? 'c-amber' : 'c-green')}">${unhCnt}</div>
          <div class="kpi-sub">${unhCnt >= 4 ? `Penalti -${D.meta.lockerHitPct}%!` : 'Aman (<4 org)'}</div>
        </div>
        <div class="t3-mini-card">
          <div class="kpi-lbl">Rawan Menit</div>
          <div class="kpi-val mono ${riskCnt > 0 ? 'c-amber' : 'c-green'}">${riskCnt}</div>
          <div class="kpi-sub">Dekat batas ${subPct}%/${natPct}%/${expPct}%</div>
        </div>
        <div class="t3-mini-card">
          <div class="kpi-lbl">Kebal (Reserve)</div>
          <div class="kpi-val mono c-sky">${immuneCnt}</div>
          <div class="kpi-sub">0% risiko unhappy</div>
        </div>
      </div>
      <div class="c-muted" style="font-size:11px">Kuota bytecode #22134 (aktif setelah ≥${mc.minGames || 6} laga): <b>${natPct}%</b> Natural Top-11 <code>auto</code> (1 GK + 10 Outfield, &gt;19th) · <b>${expPct}%</b> hanya bila <code>role=starter</code> / <code>roleSore</code> · <b>${subPct}%</b> <code>rotation</code> / Cadangan #12–#18 (&gt;19th). Status <b class="c-green">HAPPY</b> bila ≥${hapTop}% (Top-11) / ≥${hapSub}% (Sub) / ≥${hapRes}% (Res). Usia ≤19th (auto) &amp; <code>reserve</code> kebal 0%!</div>`;
  }

  const sumHdr = document.getElementById('t3-mood-sum-hdr');
  const moodDet = document.getElementById('t3-mood-details');
  const lockerHitPct = Number((D.meta && D.meta.lockerHitPct) || 0);
  if (sumHdr) {
    const mBCls = (lockerHitPct > 0 || unhCnt >= 4) ? 'b-crit' : (unhCnt > 0 || riskCnt > 0 ? 'b-warn' : 'b-good');
    const mBTxt = lockerHitPct > 0 ? `Penalti -${lockerHitPct}%!` : (unhCnt > 0 ? `${unhCnt} Unhappy` : '✓ Ruang Ganti Aman');
    sumHdr.innerHTML = `
      <span style="font-size:15px;font-weight:800">😠 Radar Ruang Ganti v1.2.0 <span class="badge ${mBCls}">${mBTxt}</span></span>
      <span class="c-muted mono" style="font-size:11px">Rawan ${riskCnt} · Kebal ${immuneCnt} ▼</span>`;
  }
  if (moodDet && !moodDet.dataset.userToggled) {
    if (unhCnt >= 3 || lockerHitPct > 0) moodDet.setAttribute('open', '');
    else moodDet.removeAttribute('open');
  }

  const mRows = [...roster].sort(
    (a, b) => (a.mood === 'unhappy' ? -1 : 1) - (b.mood === 'unhappy' ? -1 : 1) || (b.minsDeficit || 0) - (a.minsDeficit || 0) || b.moodTier - a.moodTier || a.minPct - b.minPct
  );
  const tbl = document.getElementById('t3-mood-tbl');
  if (tbl) {
    tbl.innerHTML = `<thead><tr><th>Pemain &amp; Mood</th><th>Saran Aksi v9</th><th>Kuota Menit</th><th class="col-hide-mob">Target &amp; Defisit</th><th class="col-hide-mob">Role v9</th><th class="col-hide-mob">Pos</th></tr></thead><tbody>` +
      mRows.map(p => {
        const mCls = p.mood === 'unhappy' ? 'b-crit' : (p.mood === 'happy' ? 'b-good' : ((p.nearQuota || p.mood === 'warn') ? 'b-warn' : 'b-info'));
        const adv = getMoodActionAdvice(p);
        const defTxt = (!p.moodImmune && p.minsDeficit > 0)
          ? `<div class="c-amber" style="font-size:10px">-${p.minsDeficit}m (~${p.gamesDeficit} lg)</div>`
          : `<div class="c-muted" style="font-size:10px">${p.minsNow || 0}/${p.minsReq || 0}m</div>`;
        return `<tr>
          <td>
            <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a>
            <div class="inline-sticky-meta">
              <span class="badge ${mCls}">${p.mood.toUpperCase()}</span>
              ${p.roleSore ? '<span class="badge b-crit">roleSore!</span>' : ''}
            </div>
          </td>
          <td><span class="badge ${adv.cls}">${esc(adv.txt)}</span></td>
          <td>${minutesQuotaBarHtml(p.minPct, p.reqPct, p.mood)}</td>
          <td class="mono col-hide-mob"><b>${p.reqPct}%</b>${defTxt}</td>
          <td class="col-hide-mob"><span class="badge ${p.roleSore ? 'b-crit' : 'b-muted'}">${esc(p.moodReason)}</span></td>
          <td class="col-hide-mob"><b>${fmtPos(p.pos)}</b></td>
        </tr>`;
      }).join('') + `</tbody>`;
  }
}

function renderTab3Pitch() {
  const sel = document.getElementById('t3-form-select');
  const clubActiveFk = (D.meta && D.meta.isCustomFormation && D.meta.activeFormationRaw) ? D.meta.activeFormationRaw : D.meta.activeFormation;
  const fk = sel ? sel.value : clubActiveFk;
  const isRot = (xiMode === 'rot');
  const res = solveBestXiJS(fk, isRot);
  const bestRef = isRot ? solveBestXiJS(fk, false) : res;
  const md = (res.atkMod !== undefined) ? { atkMod: res.atkMod, defMod: res.defMod } : (FORMATION_MODS[res.baseFormation || fk] || { atkMod: 0, defMod: 0 });

  const bestIds = new Set(bestRef.xi.map(a => a.p.id));
  const rotIds = new Set(res.xi.map(a => a.p.id));
  const rotInPlayers = isRot ? res.xi.filter(a => !bestIds.has(a.p.id)).map(a => a.p) : [];
  const rotOutPlayers = isRot ? bestRef.xi.filter(a => !rotIds.has(a.p.id)).map(a => a.p) : [];
  const rotInSet = new Set(rotInPlayers.map(p => p.id));

  const diffEl = document.getElementById('t3-rot-diff');
  if (diffEl) {
    const bugBanner = res.hasFormationBug && res.formationBugInfo
      ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">BUG 3-4-3 (#34992)</span><div style="font-size:11px"><b>${esc(res.formationBugInfo.title)}:</b> ${esc(res.formationBugInfo.desc)}</div></div>`
      : '';
    if (isRot) {
      if (rotInPlayers.length) {
        const pairs = rotInPlayers.map((pin, idx) => {
          const pout = rotOutPlayers[idx];
          const inHtml = `<a class="clickable-name c-purple" onclick="openPlayerDrawer('roster','${escJs(pin.id)}')"><b>${esc(pin.name)} ↑</b></a> (${pin.energy}%)`;
          const outHtml = pout ? ` ⇄ <a class="clickable-name c-muted" onclick="openPlayerDrawer('roster','${escJs(pout.id)}')">${esc(pout.name)} ↓</a> (${pout.energy}%)` : '';
          return inHtml + outHtml;
        }).join(' &nbsp;·&nbsp; ');
        diffEl.innerHTML = bugBanner + `<div class="rot-diff-banner">
          <b>🔄 Diff Rotation XI (${rotInPlayers.length} dirotasi • Skor ${bestRef.avg} → ${res.avg}):</b><br/>
          <div style="margin-top:3px">${pairs}</div>
        </div>`;
      } else {
        diffEl.innerHTML = bugBanner + `<div class="rot-diff-banner">🔄 Seluruh starter Best XI dalam kondisi bugar &amp; aman kartu — belum ada rotasi wajib untuk formasi ini.</div>`;
      }
    } else {
      diffEl.innerHTML = bugBanner;
    }
  }

  const sumEl = document.getElementById('t3-xi-summary');
  if (sumEl) {
    const chemVal = res.chemistry !== undefined ? res.chemistry : 100;
    sumEl.innerHTML =
      `Avg XI: <b class="c-green">${res.avg}</b> · ` +
      `Chem <b class="c-sky">${chemVal}%</b> · ` +
      `Asing <b>${res.fCnt}/${D.meta.foreignCap}</b> · FB-WF <b class="${res.wfCnt ? 'c-amber' : 'c-green'}">${res.wfCnt}</b>` +
      (res.isCustom ? ` <span class="badge b-accent">★ CUSTOM</span>` : '') +
      (res.falseNine ? ` <span class="badge b-accent">⚡ F9</span>` : '') +
      (res.hasFormationBug ? ` <span class="badge b-crit">⚠ BUG -33% ATK</span>` : '');
  }

  const pitch = document.getElementById('t3-pitch');
  pitch.querySelectorAll('.p-node').forEach(n => n.remove());

  // v8.3 Dynamic Row-Band Pitch Engine (mendukung penuh 13 kode posisi C.FORMATIONS + custom ROLE_SLOTS)
  const fkStr = String(res.baseFormation || fk || '').split('~')[0];
  const defSlots = res.xi.filter(a => ['LE', 'LD', 'Z', 'ZE', 'ZD', 'ZAG', 'LAT'].includes(a.slot));
  const isFiveBack = defSlots.length >= 5;
  const is433 = fkStr.startsWith('4-3-3') || fkStr === '3-4-3' || fkStr === '4-2-4';
  const isMidWings = fkStr === '4-1-4-1' || fkStr === '4-4-1-1' || fkStr === '5-4-1' || fkStr === '3-4-1-2';

  const bands = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  res.xi.forEach(a => {
    const sl = a.slot;
    if (sl === 'G') bands[0].push(a);
    else if (['Z', 'ZE', 'ZD', 'ZAG'].includes(sl)) bands[1].push(a);
    else if (['LE', 'LD', 'LAT'].includes(sl)) bands[isFiveBack ? 2 : 1].push(a);
    else if (['V', 'VOL'].includes(sl)) bands[3].push(a);
    else if (['ME', 'MC', 'MD'].includes(sl)) bands[4].push(a);
    else if (['MO', 'MA', 'SA'].includes(sl)) bands[sl === 'SA' ? 6 : 5].push(a);
    else if (['PE', 'PD'].includes(sl)) bands[(a.sectorCode === 'A') ? 6 : (isMidWings ? 4 : (is433 ? 6 : 5))].push(a);
    else bands[6].push(a);
  });

  const lrRank = { LE: 1, ME: 1, PE: 1, ZE: 2, Z: 3, ZAG: 3, V: 3, VOL: 3, MC: 3, MO: 3, MA: 3, SA: 2, A: 3, ATA: 3, ZD: 4, LD: 5, MD: 5, PD: 5 };
  const activeBands = Object.keys(bands)
    .map(Number)
    .sort((a, b) => a - b)
    .map(k => bands[k])
    .filter(arr => arr.length > 0);

  activeBands.forEach(arr => arr.sort((a, b) => (lrRank[a.slot] || 3) - (lrRank[b.slot] || 3)));

  const rowCount = activeBands.length;
  activeBands.forEach((arr, rowIdx) => {
    const y = rowCount <= 1 ? 50 : +(91 - (rowIdx * (82 / (rowCount - 1)))).toFixed(1);
    const n = arr.length;
    const isWidePair = (n === 2 && arr.every(a => ['LE', 'LD', 'PE', 'PD', 'ME', 'MD'].includes(a.slot)));
    let xs;
    if (n === 1) xs = [50];
    else if (n === 2) xs = isWidePair ? [16, 84] : [28, 72];
    else if (n === 3) xs = [16, 50, 84];
    else if (n === 4) xs = [11.5, 37.2, 62.8, 88.5];
    else xs = arr.map((_, i) => +(11 + (i * (78 / Math.max(1, n - 1)))).toFixed(1));

    arr.forEach((a, colIdx) => {
      const x = xs[colIdx];
      const isRotIn = rotInSet.has(a.p.id);
      const d = document.createElement('div');
      d.className = 'p-node' + (a.wf ? ' wf' : '') + (isRotIn ? ' rot-in' : '');
      d.style.left = x + '%'; d.style.top = y + '%';
      d.title = `Klik untuk buka profil ${a.p.name}`;
      d.onclick = () => openPlayerDrawer('roster', a.p.id);

      const en = a.p.energy ?? 100;
      const enCol = en >= 90 ? '#10b981' : (en >= 80 ? '#38bdf8' : (en >= 65 ? '#f59e0b' : '#ef4444'));
      const ico = isRotIn ? '🔄 ' : (a.p.top ? '👑 ' : (a.p.star ? '⭐ ' : ''));
      const penTag = a.p.fineSlump > 0 ? ` -${a.p.fineSlumpPct}%` : (a.wf ? ' ⚠' : '');
      d.innerHTML = `
        <div class="pn">${ico}${esc(a.p.name)}</div>
        <div class="ps mono">${fmtPos(a.slot)} <b>${a.p.force}</b>${penTag} ${en}%</div>
        <div class="p-en-bar"><div class="p-en-fill" style="width:${Math.min(100, en)}%;background:${enCol}"></div></div>`;
      pitch.appendChild(d);
    });
  });

  // Set Pieces 2x2 Kompak — Semua Eksekutor Bisa Diklik -> Player Drawer!
  const xiPls = res.xi.map(a => a.p);
  const outPls = xiPls.filter(p => p.pos !== 'G');
  const poolSp = outPls.length ? outPls : xiPls;
  const pickMax = (arr, scoreFn) => arr.reduce((b, x) => (!b || scoreFn(x) > scoreFn(b)) ? x : b, null);
  const pen = pickMax(poolSp, p => (p.s1 === 'FIN' ? 2000 : (p.s2 === 'FIN' ? 1000 : 0)) + p.force);
  const cor = pickMax(poolSp, p => (p.s1 === 'CRU' ? 2000 : (p.s2 === 'CRU' ? 1000 : 0)) + p.force);
  const fkT = pickMax(poolSp, p => ((p.s1 === 'FIN' || p.s2 === 'FIN') ? 1000 : 0) + p.force);
  const autoPkPick = pickMax(poolSp, p => (p.s1 === 'FIN' ? 1000 : 0) + p.force);
  const cap = pickMax(xiPls, p => (p.age || 0) * 10000 + p.force);

  const spWarns = [];
  if (pen && pen.s2 === 'FIN' && pen.s1 !== 'FIN') {
    spWarns.push(`Penalti: ${pen.name} punya FIN di slot 2 (+4%) — tombol Auto game akan melewatinya, wajib pilih manual!`);
  }
  if (fkT && autoPkPick && fkT.id !== autoPkPick.id && fkT.s2 === 'FIN' && fkT.s1 !== 'FIN') {
    spWarns.push(`Free Kick: ${fkT.name} punya FIN di slot 2 (+2% FK) — Auto game fallback ke algo Penalti (buta s2 FIN), set manual!`);
  }
  const cS1 = poolSp.filter(p => p.s1 === 'CRU'), cS2 = poolSp.filter(p => p.s2 === 'CRU' && p.s1 !== 'CRU');
  if (cS1.length && cS2.length) {
    const b1 = pickMax(cS1, p => p.force), b2 = pickMax(cS2, p => p.force);
    if (b2.force > b1.force) {
      spWarns.push(`Corner: Pilih manual ${b1.name} (CRS s1 +3%) daripada ${b2.name} (CRS s2 +1.5% pilihan Auto game).`);
    }
  }

  const spLink = (p, extra, cls) => p
    ? `<a class="clickable-name ${cls}" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}${extra}</b></a>`
    : '-';

  document.getElementById('t3-setpieces').innerHTML = pen ? `
    <div class="sp-2grid">
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Penalti:</span>${spLink(pen, pen.s1 === 'FIN' ? ' (FIN +8%)' : (pen.s2 === 'FIN' ? ' (FIN s2 +4%)' : ''), 'c-green')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Corner:</span>${spLink(cor, cor.s1 === 'CRU' ? ' [CRS s1 +3%]' : (cor.s2 === 'CRU' ? ' [CRS s2]' : ''), 'c-sky')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Free Kick:</span>${spLink(fkT, (fkT.s1 === 'FIN' || fkT.s2 === 'FIN') ? ' (FIN)' : '', 'c-purple')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Kapten:</span>${spLink(cap, ` (${cap.age}th ${cap.age >= 28 ? '✓ -10%' : '+3% cb'})`, 'c-amber')}</div>
    </div>
    ${spWarns.length ? `<div class="alert-item HIGH" style="padding:7px 10px;margin-top:4px"><span class="badge b-warn">AUTO BLIND SPOT</span><div style="font-size:11px">${spWarns.map(w => esc(w)).join('<br/>')}</div></div>` : ''}` : '';

  // Bangku Cadangan PENUH (tanpa slice(0, 10)!)
  const bTitle = document.getElementById('t3-bench-title');
  if (bTitle) bTitle.textContent = `🪑 Bangku Cadangan (${res.bench.length} pemain sehat)`;

  document.getElementById('t3-bench-tbl').innerHTML = `<thead><tr><th>Cadangan</th><th>Pos</th><th>F</th><th>Energi</th><th>Menit%</th><th>Skill</th></tr></thead><tbody>` +
    (res.bench.length ? res.bench.map(p => `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a></td>
      <td><b>${fmtPos(p.pos)}</b></td><td class="mono">${p.force}</td>
      <td>${energyPillHtml(p.energy)}</td><td class="mono">${p.minPct}%</td><td class="mono">${fmtSkills(p.s1, p.s2)}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="c-muted">Tidak ada pemain cadangan sehat.</td></tr>') + `</tbody>`;

  // Blok Baru: 🏥 Absen (Cedera / Skorsing) agar pemain bintang yang hilang terlihat jelas!
  const absBox = document.getElementById('t3-absent-box');
  if (absBox) {
    const absents = (D.roster || []).filter(p => p.injured || p.suspended);
    if (!absents.length) {
      absBox.innerHTML = '';
    } else {
      absBox.innerHTML = `<div class="t3-absent-box">
        <div style="font-weight:800" class="c-red">🏥 Absen Tidak Masuk Lapangan (${absents.length} pemain — Klik → Profil)</div>
        <div class="t3-absent-list">${absents.map(p => {
          const reason = p.injured ? `🏥 Cedera ${p.injuryDays}d` : '🟥 Skorsing';
          return `<div class="t3-absent-pill" onclick="openPlayerDrawer('roster','${escJs(p.id)}')">
            <b>${esc(p.name)}</b>
            <span class="mono c-muted">${fmtPos(p.pos)} F${p.force}</span>
            <span class="badge b-crit">${reason}</span>
          </div>`;
        }).join('')}</div>
      </div>`;
    }
  }

  // Blok Baru v8.5.0: Top-3 Pengganti Langsung di Titik Lemah XI (dari Pasar Global)
  let weakBox = document.getElementById('t3-weak-upgrades');
  if (!weakBox && absBox && absBox.parentNode) {
    weakBox = document.createElement('div');
    weakBox.id = 't3-weak-upgrades';
    absBox.parentNode.appendChild(weakBox);
  }
  if (weakBox && Array.isArray(D.scoutPool) && D.scoutPool.length && res.xi && res.xi.length) {
    const sortedWeak = [...res.xi].sort((a, b) => a.score - b.score);
    const weakest = sortedWeak[0];
    if (weakest) {
      const wSlot = weakest.slot;
      const wForce = weakest.p ? weakest.p.force : Math.round(weakest.score);
      const budgetNow = (D.meta && D.meta.budget) || 0;
      const instCap = Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 0.30));
      const cands = [];
      for (const r of D.scoutPool) {
        if (r[1] !== wSlot && !(wSlot === 'A' && r[1] === 'ATA')) continue;
        const fl = String(r[18] || '');
        if (fl.includes('REFUSE') || fl.includes('PERSUADE') || fl.includes('KEY_LOCK') || fl.includes('TRAP') || fl.includes('INJ')) continue;
        if (r[5] <= wForce) continue;
        const isBos = fl.includes('BOSMAN');
        const cost = isBos ? 0 : (r[14] || 0);
        const dp25 = Math.round(cost * 0.25);
        const inst24 = Math.round((cost - dp25) / 24);
        const canCash = cost <= budgetNow;
        const canInst = !canCash && dp25 <= budgetNow && inst24 <= instCap;
        if (!isBos && !canCash && !canInst) continue;
        cands.push({ r, isBos, cost, dp25, inst24, canInst, dF: r[5] - wForce });
      }
      cands.sort((a, b) => (b.dF - a.dF) || (a.cost - b.cost));
      const top3 = cands.slice(0, 3);
      if (top3.length) {
        weakBox.innerHTML = `<div style="margin-top:10px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;font-size:11.5px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <div><b>🎯 Rekomendasi Pengganti Titik Lemah XI:</b> <span class="badge b-warn">${esc(fmtPos(wSlot))} ${esc(weakest.p.name)} (F${wForce})</span></div>
            <span class="c-muted" style="font-size:10.5px">Target Pasar Global yang mau pindah &amp; masuk kas / DP 25%</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
            ${top3.map(c => {
              const r = c.r;
              const pidJs = escJs(r[19]);
              const tag = c.isBos ? '<span class="badge b-good">🆓 Bosman 0€</span>' : (c.canInst ? `<span class="badge b-info">💳 DP ${fmtM(c.dp25)}</span>` : `<span class="badge b-good">${fmtM(c.cost)}</span>`);
              return `<div style="padding:7px 9px;background:var(--bg1);border:1px solid var(--border);border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:6px">
                <div style="min-width:0">
                  <div><a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')"><b>${esc(r[0])}</b></a> <span class="c-green mono">+${c.dF}F</span></div>
                  <div class="c-muted mono" style="font-size:10px">F${r[5]}→${r[7]} · ${r[2]}th · ${tag}</div>
                </div>
                <button type="button" class="btn btn-sm btn-green" onclick="toggleCartIn('${pidJs}', ${c.isBos ? 'true' : 'false'})">+Beli</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      } else {
        weakBox.innerHTML = '';
      }
    }
  }
}
