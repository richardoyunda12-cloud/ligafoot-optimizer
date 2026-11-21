// ==================== RENDER TAB 3: LAPANGAN, DUAL XI & RUANG GANTI (v8.2.2) ====================
function initTab3() {
  const sel = document.getElementById('t3-form-select');
  if (sel) {
    sel.innerHTML = Object.keys(D.formations || {}).map(f => {
      const md = FORMATION_MODS[f];
      const mStr = md ? ` (A${fmtMod(md.atkMod)}/D${fmtMod(md.defMod)})` : '';
      return `<option value="${f}" ${f === D.meta.activeFormation ? 'selected' : ''}>${fmtForm(f)}${mStr}</option>`;
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
  const keys = Object.keys(D.formations || {});
  const rows = keys.map(fk => {
    const res = solveBestXiJS(fk, rotMode);
    const md = FORMATION_MODS[fk] || { atkMod: 0, defMod: 0 };
    const sec = { GK: [], DEF: [], MID: [], ATK: [] };
    res.xi.forEach(a => {
      const c = EXACT_CAT[a.slot] ?? 3;
      const k = c === 0 ? 'GK' : ((c === 1 || c === 2) ? 'DEF' : (c === 3 ? 'MID' : 'ATK'));
      sec[k].push(a.score);
    });
    const avgOf = arr => arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : 0;
    return {
      formation: fk,
      avgScore: res.avg,
      totalScore: res.tot,
      sectors: { GK: avgOf(sec.GK), DEF: avgOf(sec.DEF), MID: avgOf(sec.MID), ATK: avgOf(sec.ATK) },
      foreignCount: res.fCnt,
      wrongFootCount: res.wfCnt,
      atkMod: md.atkMod,
      defMod: md.defMod,
      falseNine: res.falseNine,
    };
  });
  rows.sort((a, b) => b.totalScore - a.totalScore);
  return rows;
}

function renderFormCompareTable() {
  const tbl = document.getElementById('t3-form-tbl');
  if (!tbl) return;
  const isRot = xiMode === 'rot';
  const sel = document.getElementById('t3-form-select');
  const curFk = sel ? sel.value : D.meta.activeFormation;
  const rows = isRot ? computeLiveFormCompare(true) : (D.formCompare && D.formCompare.length ? D.formCompare : computeLiveFormCompare(false));

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
  if (hdrEl) hdrEl.textContent = `📊 15 Formasi Resmi (#3492 • Mode ${modeLbl})`;

  tbl.innerHTML = `<thead><tr>
    <th>15 Formasi (Klik → Pitch)</th><th>A/D</th><th>Avg</th><th>DEF</th><th>MID</th><th>ATK</th><th>Asing</th><th>FB-WF</th>
  </tr></thead><tbody>` +
    rows.map((f, idx) => {
      const isCur = f.formation === curFk;
      const isClub = f.formation === D.meta.activeFormation;
      return `<tr class="${isCur ? 'hl-user' : ''}" style="cursor:pointer" onclick="selectFormationFromTable('${escJs(f.formation)}')">
        <td>
          <b>${idx === 0 ? '🏆 ' : ''}${esc(fmtForm(f.formation))}</b>
          ${isClub ? '<span class="badge b-info" style="margin-left:3px">Klub</span>' : ''}
          ${f.falseNine ? '<span class="badge b-accent" style="margin-left:3px">F9</span>' : ''}
        </td>
        <td class="mono">${fmtMod(f.atkMod)}/${fmtMod(f.defMod)}</td>
        <td class="mono c-green"><b>${f.avgScore}</b></td>
        <td class="mono">${f.sectors.DEF}</td>
        <td class="mono">${f.sectors.MID}</td>
        <td class="mono">${f.sectors.ATK}</td>
        <td class="mono">${f.foreignCount}/${D.meta.foreignCap}</td>
        <td class="mono ${f.wrongFootCount ? 'c-amber' : 'c-green'}">${f.wrongFootCount}</td>
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

  const sumEl = document.getElementById('t3-mood-summary');
  if (sumEl) {
    sumEl.innerHTML = `
      <div class="t3-mini-strip" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:8px">
        <div class="t3-mini-card">
          <div class="kpi-lbl">Unhappy</div>
          <div class="kpi-val mono ${unhCnt >= 4 ? 'c-red' : (unhCnt > 0 ? 'c-amber' : 'c-green')}">${unhCnt}</div>
          <div class="kpi-sub">${unhCnt >= 4 ? `Penalti -${D.meta.lockerHitPct}%!` : 'Aman (<4 org)'}</div>
        </div>
        <div class="t3-mini-card">
          <div class="kpi-lbl">Rawan Menit</div>
          <div class="kpi-val mono ${riskCnt > 0 ? 'c-amber' : 'c-green'}">${riskCnt}</div>
          <div class="kpi-sub">Dekat batas 8%/25%</div>
        </div>
        <div class="t3-mini-card">
          <div class="kpi-lbl">Kebal (Reserve/≤19)</div>
          <div class="kpi-val mono c-sky">${immuneCnt}</div>
          <div class="kpi-sub">0% risiko unhappy</div>
        </div>
      </div>
      <div class="c-muted" style="font-size:11px">Garis kuning pada bar menit menandai ambang minimal (<b>8%</b> pelapis · <b>25%</b> starter). Tip v1.2.0: Set cadangan ke <b>reserve</b> agar 100% kebal!</div>`;
  }

  const mRows = [...roster].sort(
    (a, b) => (a.mood === 'unhappy' ? -1 : 1) - (b.mood === 'unhappy' ? -1 : 1) || b.moodTier - a.moodTier || a.minPct - b.minPct
  );
  const tbl = document.getElementById('t3-mood-tbl');
  if (tbl) {
    tbl.innerHTML = `<thead><tr><th>Pemain &amp; Mood</th><th>Saran Aksi v9</th><th>Kuota Menit</th><th>Target</th><th>Role v9</th><th>Pos</th></tr></thead><tbody>` +
      mRows.map(p => {
        const mCls = p.mood === 'unhappy' ? 'b-crit' : (p.mood === 'happy' ? 'b-good' : 'b-info');
        const adv = getMoodActionAdvice(p);
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
          <td class="mono">${p.reqPct}%</td>
          <td><span class="badge ${p.roleSore ? 'b-crit' : 'b-muted'}">${esc(p.moodReason)}</span></td>
          <td><b>${fmtPos(p.pos)}</b></td>
        </tr>`;
      }).join('') + `</tbody>`;
  }
}

function renderTab3Pitch() {
  const sel = document.getElementById('t3-form-select');
  const fk = sel ? sel.value : D.meta.activeFormation;
  const isRot = (xiMode === 'rot');
  const res = solveBestXiJS(fk, isRot);
  const bestRef = isRot ? solveBestXiJS(fk, false) : res;
  const md = FORMATION_MODS[fk] || { atkMod: 0, defMod: 0 };

  const bestIds = new Set(bestRef.xi.map(a => a.p.id));
  const rotIds = new Set(res.xi.map(a => a.p.id));
  const rotInPlayers = isRot ? res.xi.filter(a => !bestIds.has(a.p.id)).map(a => a.p) : [];
  const rotOutPlayers = isRot ? bestRef.xi.filter(a => !rotIds.has(a.p.id)).map(a => a.p) : [];
  const rotInSet = new Set(rotInPlayers.map(p => p.id));

  const diffEl = document.getElementById('t3-rot-diff');
  if (diffEl) {
    if (isRot) {
      if (rotInPlayers.length) {
        const pairs = rotInPlayers.map((pin, idx) => {
          const pout = rotOutPlayers[idx];
          const inHtml = `<a class="clickable-name c-purple" onclick="openPlayerDrawer('roster','${escJs(pin.id)}')"><b>${esc(pin.name)} ↑</b></a> (${pin.energy}%)`;
          const outHtml = pout ? ` ⇄ <a class="clickable-name c-muted" onclick="openPlayerDrawer('roster','${escJs(pout.id)}')">${esc(pout.name)} ↓</a> (${pout.energy}%)` : '';
          return inHtml + outHtml;
        }).join(' &nbsp;·&nbsp; ');
        diffEl.innerHTML = `<div class="rot-diff-banner">
          <b>🔄 Diff Rotation XI (${rotInPlayers.length} dirotasi • Skor ${bestRef.avg} → ${res.avg}):</b><br/>
          <div style="margin-top:3px">${pairs}</div>
        </div>`;
      } else {
        diffEl.innerHTML = `<div class="rot-diff-banner">🔄 Seluruh starter Best XI dalam kondisi bugar &amp; aman kartu — belum ada rotasi wajib untuk formasi ini.</div>`;
      }
    } else {
      diffEl.innerHTML = '';
    }
  }

  const sumEl = document.getElementById('t3-xi-summary');
  if (sumEl) {
    sumEl.innerHTML =
      `Avg XI: <b class="c-green">${res.avg}</b> (A${fmtMod(md.atkMod)}/D${fmtMod(md.defMod)}) · ` +
      `Asing <b>${res.fCnt}/${D.meta.foreignCap}</b> · FB-WF <b class="${res.wfCnt ? 'c-amber' : 'c-green'}">${res.wfCnt}</b>` +
      (res.falseNine ? ` <span class="badge b-accent">⚡ F9</span>` : '');
  }

  const pitch = document.getElementById('t3-pitch');
  pitch.querySelectorAll('.p-node').forEach(n => n.remove());

  // v8.1+ Dynamic Row-Band Pitch Engine: 0 tabrakan di SEMUA 15 formasi pada layar 360px!
  const fkStr = String(fk || '');
  const defSlots = res.xi.filter(a => ['LE', 'LD', 'ZE', 'ZD', 'ZAG', 'LAT'].includes(a.slot));
  const isFiveBack = defSlots.length >= 5;
  const is433 = fkStr.startsWith('4-3-3');
  const isMidWings = fkStr === '4-1-4-1' || fkStr === '4-4-1-1';

  const bands = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  res.xi.forEach(a => {
    const sl = a.slot;
    if (sl === 'G') bands[0].push(a);
    else if (['ZE', 'ZD', 'ZAG'].includes(sl)) bands[1].push(a);
    else if (['LE', 'LD', 'LAT'].includes(sl)) bands[isFiveBack ? 2 : 1].push(a);
    else if (sl === 'VOL') bands[3].push(a);
    else if (['ME', 'MC', 'MD'].includes(sl)) bands[4].push(a);
    else if (['MA', 'SA'].includes(sl)) bands[5].push(a);
    else if (['PE', 'PD'].includes(sl)) bands[is433 ? 6 : (isMidWings ? 4 : 5)].push(a);
    else bands[6].push(a);
  });

  const lrRank = { LE: 1, ME: 1, PE: 1, ZE: 2, ZAG: 3, VOL: 3, MC: 3, MA: 3, SA: 3, ATA: 3, ZD: 4, LD: 5, MD: 5, PD: 5 };
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
  const cor = pickMax(poolSp, p => (p.s1 === 'CRU' ? 2000 : (p.s2 === 'CRU' ? 1000 : 0)) + ((p.s1 === 'PAS' || p.s1 === 'ARM') ? 300 : 0) + p.force);
  const fkT = pickMax(poolSp, p => ((p.s1 === 'FIN' || p.s2 === 'FIN') ? 1000 : 0) + ((p.s1 === 'PAS' || p.s2 === 'PAS' || p.s1 === 'ARM' || p.s2 === 'ARM') ? 400 : 0) + p.force);
  const cap = pickMax(xiPls, p => (p.age >= 28 ? 1000 : 0) + p.force * 5 + p.age);

  const spWarns = [];
  if (pen && pen.s2 === 'FIN' && pen.s1 !== 'FIN') {
    spWarns.push(`Penalti: ${pen.name} punya FIN di slot 2 — tombol Auto game akan melewatinya, wajib pilih manual!`);
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
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Penalti:</span>${spLink(pen, (pen.s1 === 'FIN' || pen.s2 === 'FIN') ? ' (FIN)' : '', 'c-green')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Corner:</span>${spLink(cor, cor.s1 === 'CRU' ? ' [CRS s1 +3%]' : (cor.s2 === 'CRU' ? ' [CRS s2]' : ''), 'c-sky')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Free Kick:</span>${spLink(fkT, '', 'c-purple')}</div>
      <div class="sp-box"><span class="c-muted" style="font-size:10px">Kapten:</span>${spLink(cap, ` (${cap.age}th ${cap.age >= 28 ? '✓' : '⚠<28'})`, 'c-amber')}</div>
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
}
