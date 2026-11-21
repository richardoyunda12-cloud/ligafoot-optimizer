// ==================== RENDER TAB 3: TAKTIK, PITCH v2 & RUANG GANTI (v8.0) ====================
function initTab3() {
  const sel = document.getElementById('t3-form-select');
  sel.innerHTML = Object.keys(D.formations).map(f => {
    const md = FORMATION_MODS[f];
    const mStr = md ? ` (A${fmtMod(md.atkMod)}/D${fmtMod(md.defMod)})` : '';
    return `<option value="${f}" ${f === D.meta.activeFormation ? 'selected' : ''}>${fmtForm(f)}${mStr}</option>`;
  }).join('');
  renderTab3Pitch();

  document.getElementById('t3-mood-summary').innerHTML =
    `Status Ruang Ganti: <b class="${D.meta.unhappyCount >= 4 ? 'c-red' : 'c-green'}">${D.meta.unhappyCount} Unhappy</b> ` +
    `(Penalti individu <b>-3%</b> per pemain unhappy; penalti tim <code>lockerRoomHit</code> aktif di <b>≥ 4 pemain</b> → kini <b>-${D.meta.lockerHitPct}%</b>). ` +
    `Garis kuning pada bar menit menandai target minimal (<b>8%</b> pelapis / <b>25%</b> starter).`;

  const mRows = [...D.roster].sort((a, b) => (a.mood === 'unhappy' ? -1 : 1) - (b.mood === 'unhappy' ? -1 : 1) || b.moodTier - a.moodTier || a.minPct - b.minPct);
  document.getElementById('t3-mood-tbl').innerHTML = `<thead><tr><th>Pemain</th><th>Pos</th><th>Role v9</th><th>Kuota Menit Main</th><th>Target</th><th>Mood</th></tr></thead><tbody>` +
    mRows.map(p => `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a></td>
      <td><b>${fmtPos(p.pos)}</b></td>
      <td><span class="badge ${p.roleSore ? 'b-crit' : 'b-muted'}">${esc(p.moodReason)}</span></td>
      <td>${minutesQuotaBarHtml(p.minPct, p.reqPct, p.mood)}</td>
      <td class="mono">${p.reqPct}%</td>
      <td><span class="badge ${p.mood === 'unhappy' ? 'b-crit' : (p.mood === 'happy' ? 'b-good' : 'b-info')}">${p.mood.toUpperCase()}</span></td>
    </tr>`).join('') + `</tbody>`;

  document.getElementById('t3-form-tbl').innerHTML = `<thead><tr><th>15 Formasi Resmi (#3492)</th><th>A/D</th><th>Avg</th><th>DEF</th><th>MID</th><th>ATK</th><th>Asing</th><th>FB Salah Kaki</th></tr></thead><tbody>` +
    D.formCompare.map(f => `<tr class="${f.formation === D.meta.activeFormation ? 'hl-user' : ''}" style="cursor:pointer" onclick="document.getElementById('t3-form-select').value='${f.formation}';onFormationChange()">
      <td><b>${fmtForm(f.formation)}</b> ${f.falseNine ? '<span class="badge b-accent">F9</span>' : ''}</td>
      <td class="mono">${fmtMod(f.atkMod)}/${fmtMod(f.defMod)}</td>
      <td class="mono c-green"><b>${f.avgScore}</b></td>
      <td class="mono">${f.sectors.DEF}</td><td class="mono">${f.sectors.MID}</td><td class="mono">${f.sectors.ATK}</td>
      <td class="mono">${f.foreignCount}/${D.meta.foreignCap}</td>
      <td class="mono ${f.wrongFootCount ? 'c-amber' : 'c-green'}">${f.wrongFootCount}</td>
    </tr>`).join('') + `</tbody>`;

  document.getElementById('t3-recent-tbl').innerHTML = `<thead><tr><th>Tgl</th><th>Lawan &amp; Kompetisi</th><th>Skor</th><th>Venue</th></tr></thead><tbody>` +
    (D.recentMatches.length ? D.recentMatches.map(m => {
      const hasScore = (m.gf !== null && m.gf !== undefined && m.ga !== null && m.ga !== undefined);
      const cls = !hasScore ? 'b-muted' : (m.gf > m.ga ? 'b-good' : (m.gf < m.ga ? 'b-crit' : 'b-warn'));
      const scTxt = hasScore ? `${m.gf} - ${m.ga}` : (m.rev > 0 ? fmtM(m.rev) : (m.att ? m.att.toLocaleString('id-ID') + ' org' : '-'));
      return `<tr><td class="mono">${esc(m.date)}</td><td><b>${esc(m.opp)}</b> <span class="c-muted" style="font-size:10px">(${esc(m.comp)})</span></td><td><span class="badge ${cls} mono">${scTxt}</span></td><td>${m.home ? '🏠 Kandang' : '✈️ Tandang'}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="c-muted">Belum ada catatan laga.</td></tr>') + `</tbody>`;
}

function setXiMode(m) {
  xiMode = m;
  document.getElementById('xi-mode-best').className = m === 'best' ? 'btn btn-green' : 'btn';
  document.getElementById('xi-mode-rot').className = m === 'rot' ? 'btn btn-green' : 'btn';
  renderTab3Pitch();
}
function onFormationChange() { renderTab3Pitch(); }

function renderTab3Pitch() {
  const fk = document.getElementById('t3-form-select').value;
  const isRot = (xiMode === 'rot');
  const res = solveBestXiJS(fk, isRot);
  const bestRef = isRot ? solveBestXiJS(fk, false) : res;
  const md = FORMATION_MODS[fk] || { atkMod: 0, defMod: 0 };

  // Hitung Diff visual Rotation XI vs Best XI
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
          <b>🔄 Diff Rotation XI (${rotInPlayers.length} pemain dirotasi • Skor ${bestRef.avg} → ${res.avg}):</b><br/>
          <div style="margin-top:3px">${pairs}</div>
        </div>`;
      } else {
        diffEl.innerHTML = `<div class="rot-diff-banner">🔄 Seluruh starter Best XI dalam kondisi bugar &amp; aman kartu — belum ada rotasi wajib untuk formasi ini.</div>`;
      }
    } else {
      diffEl.innerHTML = '';
    }
  }

  document.getElementById('t3-xi-summary').innerHTML =
    `Avg XI: <b class="c-green">${res.avg}</b> (ATK ${fmtMod(md.atkMod)} / DEF ${fmtMod(md.defMod)}) | ` +
    `Asing: <b>${res.fCnt}/${D.meta.foreignCap}</b> | FB Salah Kaki: <b class="${res.wfCnt ? 'c-amber' : 'c-green'}">${res.wfCnt}</b>` +
    (res.falseNine ? ` <span class="badge b-accent">⚡ FALSE NINE</span>` : '');

  const pitch = document.getElementById('t3-pitch');
  pitch.querySelectorAll('.p-node').forEach(n => n.remove());
  // v8.1 Dynamic Row-Band Pitch Engine: 0 tabrakan di SEMUA 15 formasi pada layar 360px!
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
    else bands[6].push(a); // ATA
  });

  // Urutkan kiri -> kanan di dalam setiap baris agar posisi lapangan alami
  const lrRank = { LE: 1, ME: 1, PE: 1, ZE: 2, ZAG: 3, VOL: 3, MC: 3, MA: 3, SA: 3, ATA: 3, ZD: 4, LD: 5, MD: 5, PD: 5 };
  const activeBands = Object.keys(bands)
    .map(Number)
    .sort((a, b) => a - b)
    .map(k => bands[k])
    .filter(arr => arr.length > 0);

  activeBands.forEach(arr => arr.sort((a, b) => (lrRank[a.slot] || 3) - (lrRank[b.slot] || 3)));

  const rowCount = activeBands.length;
  activeBands.forEach((arr, rowIdx) => {
    // Baris 0 = Kiper di bawah (y=91%), baris teratas = Penyerang di atas (y=9%)
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

  document.getElementById('t3-setpieces').innerHTML = pen ? `
    <div class="pill-row">
      <span class="badge b-good">Penalti: ${esc(pen.name)}${(pen.s1==='FIN'||pen.s2==='FIN') ? ' (FIN)' : ''}</span>
      <span class="badge b-info">Corner: ${esc(cor.name)}${cor.s1==='CRU' ? ' [CRS s1 +3%!]' : (cor.s2==='CRU' ? ' [CRS s2 +1.5%]' : '')}</span>
      <span class="badge b-accent">Free Kick: ${esc(fkT.name)}</span>
      <span class="badge b-warn">Kapten: ${esc(cap.name)} (${cap.age}th ${cap.age >= 28 ? '✓>=28' : '⚠<28'})</span>
    </div>
    ${spWarns.length ? `<div class="alert-item HIGH" style="padding:7px 10px;margin-top:4px"><span class="badge b-warn">AUTO BLIND SPOT</span><div style="font-size:11px">${spWarns.map(w => esc(w)).join('<br/>')}</div></div>` : ''}` : '';

  document.getElementById('t3-bench-tbl').innerHTML = `<thead><tr><th>Cadangan</th><th>Pos</th><th>F</th><th>Energi</th><th>Menit%</th><th>Skill</th></tr></thead><tbody>` +
    res.bench.slice(0, 10).map(p => `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a></td>
      <td><b>${fmtPos(p.pos)}</b></td><td class="mono">${p.force}</td>
      <td>${energyPillHtml(p.energy)}</td><td class="mono">${p.minPct}%</td><td class="mono">${fmtSkills(p.s1, p.s2)}</td>
    </tr>`).join('') + `</tbody>`;
}
