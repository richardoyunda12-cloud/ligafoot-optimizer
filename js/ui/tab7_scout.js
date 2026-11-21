// ==================== RENDER TAB 4: TRANSFER, SHORTLIST & AUTO-SCOUT (v8.0 FINAL) ====================
function isRecommendedSell(p) {
  if (p.injured) return false;
  return Boolean(
    p.forSale
    || p.isDeclining
    || p.age >= p.sellWarnAge
    || (p.squadRank >= 15 && p.age >= 24 && !p.isGem)
    || (p.action && p.action.includes('JUAL'))
  );
}

function getCartMetrics() {
  let cashIn = 0, cashOut = 0, salDelta = 0, fDelta = 0;
  const hc = D.meta.country;
  D.roster.forEach(p => {
    const sel = cartOut[p.id];
    if (!sel) return;
    cashIn += sel.arab ? p.estArabLow : p.estRealSale;
    salDelta -= p.salary;
    if (hc && p.nationality && p.nationality !== hc) fDelta -= 1;
  });
  const inList = Object.values(cartIn);
  inList.forEach(r => {
    cashOut += r[14];
    salDelta += Math.round(r[12] * 0.95);
    if (hc && r[4] && r[4] !== hc) fDelta += 1;
  });
  const curForeign = D.roster.filter(p => hc && p.nationality && p.nationality !== hc).length;
  const projForeign = curForeign + fDelta;
  const projBudget = D.meta.budget + cashIn - cashOut;
  const buyingPower = D.meta.budget + cashIn;
  return { cashIn, cashOut, salDelta, fDelta, curForeign, projForeign, projBudget, buyingPower, inList };
}

function findBestReplacement(r, cm) {
  if (!D.roster || !D.roster.length) return null;
  const tPos = r[1], tFoot = r[3], tNat = r[4];
  const tCat = EXACT_CAT[tPos] ?? 3;
  const tEff = r[5] * (1 + (r[10] || 0) / 100);
  const hc = D.meta.country;
  const tIsForeign = Boolean(hc && tNat && tNat !== hc);
  const foreignTight = cm.projForeign >= D.meta.foreignCap;
  const prefFoot = SLOT_FOOT_PREF[tPos];

  let pool = D.roster.filter(p => p.pos === tPos);
  let matchKind = 'EXACT';
  if (!pool.length) {
    pool = D.roster.filter(p => (EXACT_CAT[p.pos] ?? 3) === tCat);
    matchKind = 'CAT';
  }
  if (!pool.length) return null;

  let best = null;
  pool.forEach(p => {
    const pEff = (p.force || 0) * (1 + (p.stackPct || 0) / 100);
    const pWrongFoot = Boolean(prefFoot && p.foot && p.foot !== prefFoot && (p.foot === 'D' || p.foot === 'E'));
    const pIsForeign = Boolean(hc && p.nationality && p.nationality !== hc);
    const effGain = tEff - (pWrongFoot ? pEff * 0.95 : pEff);

    let replaceScore = effGain * 3.0;
    if (p.age >= p.sellWarnAge || p.isDeclining) replaceScore += 12;
    if (pWrongFoot && (!prefFoot || tFoot === prefFoot)) replaceScore += 10;
    if (p.nonStack && r[11] === 0) replaceScore += 6;
    if (p.forSale && !p.injured) replaceScore += 10;
    if (p.squadRank >= 15 && p.age >= 24) replaceScore += 5;
    if (tIsForeign && foreignTight && pIsForeign) replaceScore += 14;
    if (p.isGem && p.age <= 20) replaceScore -= 12;
    if (p.injured) replaceScore -= 4;

    if (!best || replaceScore > best.replaceScore) {
      const repSale = p.injured ? 0 : p.estRealSale;
      const sal3y = Math.round(r[12] * 0.95);
      const reasons = [];
      if (matchKind === 'CAT' && D.holePositions.includes(tPos)) reasons.push(`Tambal lubang ${fmtPos(tPos)}`);
      if (pWrongFoot && (!prefFoot || tFoot === prefFoot)) reasons.push('Hapus penalti salah kaki -5%');
      if (p.age >= p.sellWarnAge || p.isDeclining) reasons.push(`Regenerasi veteran (${p.age}th)`);
      if (effGain >= 2.0) reasons.push(`Upgrade +${effGain.toFixed(1)} Eff`);
      if (sal3y < p.salary) reasons.push(`Hemat gaji -${fmtM(p.salary - sal3y)}/bln`);
      if (tIsForeign && pIsForeign) reasons.push('Tukar slot asing 1-for-1');
      if (p.injured) reasons.push('⚠ Sedang cedera (tunggu sembuh baru jual)');
      best = {
        p, matchKind, replaceScore,
        deltaForce: r[5] - p.force,
        deltaEff: +effGain.toFixed(1),
        deltaCap: r[7] - p.potCap,
        repSale,
        netCost: r[14] - repSale,
        deltaSal: sal3y - p.salary,
        reason: reasons.slice(0, 2).join(' · ') || 'Peremajaan / kedalaman skuad',
      };
    }
  });
  return best;
}

function enrichScoutRow(r, cm) {
  const flags = r[18] || '';
  const estBuy = r[14];
  const sal3y = Math.round(r[12] * 0.95);
  const estResale = r[21] || Math.round(r[13] * 1.25);
  const projGain = r[22] || 0;
  const estProfit = estResale - estBuy;
  const costBasis = Math.max(estBuy, sal3y * 12, 120000);
  const roiPct = Math.round((estProfit / costBasis) * 100);
  const fillsHole = (D.holePositions || []).includes(r[1]);
  const hc = D.meta.country;
  const isForeign = Boolean(hc && r[4] && r[4] !== hc);
  const swap = findBestReplacement(r, cm);

  const remCash = cm.projBudget;
  const netCostIfSwap = swap ? swap.netCost : estBuy;
  let affordCode = 'EXP';
  if (estBuy <= remCash) affordCode = 'CASH';
  else if (swap && !swap.p.injured && !cartOut[swap.p.id] && netCostIfSwap <= remCash) affordCode = 'SWAP';

  const dEff = swap ? swap.deltaEff : (r[5] - D.bestXi.avgScore);
  const costPen = Math.max(0, netCostIfSwap) / 2_500_000;
  let upgradeScore = dEff * 5.0 + (fillsHole ? 16 : 0) + r[10] * 1.2 + Math.min(12, (r[7] - r[5]) * 1.1) - costPen * 2.5;
  if (r[11] === 1) upgradeScore -= 8;
  if (flags.includes('TRAP')) upgradeScore -= 14;
  if (flags.includes('INJ')) upgradeScore -= 12;
  if (flags.includes('SCARCE')) upgradeScore -= 4;
  if (isForeign && cm.projForeign >= D.meta.foreignCap && !(swap && hc && swap.p.nationality !== hc)) upgradeScore -= 10;
  if (affordCode === 'EXP') upgradeScore -= 18;

  const smartScore = +(upgradeScore * 0.65 + Math.min(45, Math.max(-20, roiPct * 0.12)) + r[17] * 0.35).toFixed(1);

  return {
    r, flags, estBuy, sal3y, estResale, projGain, estProfit, roiPct,
    fillsHole, isForeign, swap, affordCode, netCostIfSwap,
    upgradeScore: +upgradeScore.toFixed(1),
    smartScore,
  };
}

// Hierarki Badge 2-Tingkat (maks 3 badge primer + mikro-tag sekunder yang tenang)
function renderCompactScoutBadges(flagsStr, fillsHole) {
  const all = flagsStr ? flagsStr.split(',').filter(Boolean) : [];
  const primaryOrder = ['FREE', 'BOSMAN', 'UNH', 'SCARCE', 'TRAP', 'GEM', 'INJ'];
  const primary = [];
  if (fillsHole) primary.push({ k: 'LUBANG', cls: 'b-warn', tip: 'Mengisi lubang posisi di skuad senior' });
  primaryOrder.forEach(k => {
    if (all.includes(k) && primary.length < 3) {
      const cls = (k === 'SCARCE' || k === 'TRAP' || k === 'INJ') ? 'b-crit' : 'b-good';
      primary.push({ k, cls, tip: tipFor(k) });
    }
  });
  const used = new Set(primary.map(x => x.k));
  const secondary = all.filter(k => !used.has(k));

  const primHtml = primary.map(x => `<span class="badge ${x.cls}" title="${esc(x.tip)}">${x.k}</span>`).join(' ');
  const secHtml = secondary.length
    ? `<span class="micro-tags">${secondary.map(k => `<span class="micro-tag" title="${esc(tipFor(k))}">${k}</span>`).join('')}</span>`
    : '';
  return primHtml + secHtml;
}

function setBlueprintTab(tab) {
  scoutBlueprintTab = tab;
  ['UPGRADE', 'ROI', 'BARGAIN', 'SELL'].forEach(t => {
    const btn = document.getElementById('bp-tab-' + t);
    if (btn) btn.className = (scoutBlueprintTab === t) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  renderScoutBlueprint();
}

function renderDealCard(it, badgeTitle, badgeCls) {
  const r = it.r;
  const sw = it.swap;
  const inC = !!cartIn[r[19]];
  const pinned = isShortlisted(r[19]);
  const affordBadge = it.affordCode === 'CASH'
    ? '<span class="badge b-good">✓ KAS CUKUP</span>'
    : (it.affordCode === 'SWAP' ? '<span class="badge b-info">⇄ CUKUP + SWAP</span>' : '<span class="badge b-crit">✗ BUTUH JUAL</span>');

  const swHtml = sw ? `
    <div class="deal-swap-box">
      <div class="flex-between">
        <span>⇄ <b>Gantikan:</b> <a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(sw.p.id)}')">${esc(sw.p.name)}</a> <span class="c-muted">(${fmtPos(sw.p.pos)} ${sw.p.age}th • F${sw.p.force})</span></span>
        <span class="mono ${sw.deltaEff >= 0 ? 'c-green' : 'c-amber'}"><b>${sw.deltaEff >= 0 ? '+' : ''}${sw.deltaEff} Eff</b></span>
      </div>
      <div class="c-muted" style="margin-top:2px">${esc(sw.reason)} • Est. Jual: <b class="mono">${sw.repSale ? fmtM(sw.repSale) : '0 (Cedera)'}</b> • ΔGaji: <b class="mono ${sw.deltaSal <= 0 ? 'c-green' : 'c-amber'}">${sw.deltaSal >= 0 ? '+' : ''}${fmtM(sw.deltaSal)}</b></div>
    </div>` : `<div class="deal-swap-box c-muted">Tambahan kedalaman skuad (belum ada pemain seposisi untuk diganti).</div>`;

  const pidJs = escJs(r[19]);
  const repIdJs = sw ? escJs(sw.p.id) : '';
  return `<div class="deal-card ${it.affordCode !== 'EXP' ? 'afford' : ''}">
    <div>
      <div class="flex-between mb-8">
        <span class="badge ${badgeCls}">${esc(badgeTitle)}</span>
        <div style="display:flex;gap:5px;align-items:center">
          ${affordBadge}
          <button class="star-btn ${pinned ? 'pinned' : ''}" title="${pinned ? 'Hapus dari Shortlist' : 'Simpan ke Shortlist'}" onclick="toggleShortlist('${pidJs}')">${pinned ? '★' : '☆'}</button>
        </div>
      </div>
      <div style="font-size:14px;font-weight:800"><a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')">${esc(r[0])}</a> ${r[20] === 2 ? '👑' : (r[20] === 1 ? '⭐' : '')} <span class="c-muted" style="font-size:11px">(${r[4]} • ${esc(r[16])})</span></div>
      <div class="mono" style="font-size:11px;margin:4px 0">
        <b>${fmtPos(r[1])}</b> • ${r[2]}th • Kaki <b>${fmtFoot(r[3])}</b> • Force <b>${r[5]}→<span class="c-green">${r[7]}</span></b> • Skill <span class="${r[11] ? 'c-red' : 'c-sky'}">${fmtSkills(r[8], r[9])} (+${r[10]}%)</span>
      </div>
      <div class="pill-row" style="margin-bottom:6px">${renderCompactScoutBadges(it.flags, it.fillsHole)}</div>
      ${swHtml}
    </div>
    <div>
      <div class="deal-metrics">
        <div><div class="c-muted" style="font-size:10px">Est. Beli</div><div class="mono c-amber"><b>${fmtM(it.estBuy)}</b></div></div>
        <div><div class="c-muted" style="font-size:10px">Net Kas (Swap)</div><div class="mono ${it.netCostIfSwap <= 0 ? 'c-green' : 'c-sky'}"><b>${it.netCostIfSwap <= 0 ? '+' + fmtM(-it.netCostIfSwap) : '-' + fmtM(it.netCostIfSwap)}</b></div></div>
        <div><div class="c-muted" style="font-size:10px">Flip ROI (1–2M)</div><div class="mono ${it.estProfit > 0 ? 'c-green' : 'c-muted'}"><b>${it.estProfit >= 0 ? '+' : ''}${fmtM(it.estProfit)} (${it.roiPct}%)</b></div></div>
      </div>
      <div class="flex-between" style="margin-top:8px">
        <button class="btn btn-sm ${inC ? 'btn-amber' : 'btn-green'}" style="flex:1" onclick="toggleCartIn('${pidJs}')">${inC ? '✓ Di Cart Beli' : '+ Beli Saja'}</button>
        ${sw ? `<button class="btn btn-sm" style="flex:1;border-color:rgba(56,189,248,.6)" onclick="swapToCart('${pidJs}','${repIdJs}')">⇄ Pasang Swap</button>` : ''}
      </div>
    </div>
  </div>`;
}

function renderScoutBlueprint() {
  const cm = getCartMetrics();
  const sellable = D.roster.filter(isRecommendedSell);
  const potentialSellCash = sellable.reduce((s, p) => s + p.estRealSale, 0);
  document.getElementById('t7-budget-strip').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:12px">
      <div><span class="kpi-lbl">Kas Awal</span><div class="mono" style="font-size:16px;font-weight:800">${fmtM(D.meta.budget)}</div></div>
      <div><span class="kpi-lbl">Cart Jual</span><div class="mono c-green" style="font-size:16px;font-weight:800">+${fmtM(cm.cashIn)}</div></div>
      <div><span class="kpi-lbl">Cart Beli</span><div class="mono c-amber" style="font-size:16px;font-weight:800">-${fmtM(cm.cashOut)}</div></div>
      <div><span class="kpi-lbl">Sisa Daya Beli</span><div class="mono ${cm.projBudget >= 0 ? 'c-green' : 'c-red'}" style="font-size:18px;font-weight:900">${fmtM(cm.projBudget)}</div></div>
      <div><span class="kpi-lbl">Kuota Asing</span><div class="mono ${cm.projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky'}" style="font-size:16px;font-weight:800">${cm.projForeign}/${D.meta.foreignCap}</div></div>
    </div>
    <div class="pill-row" style="margin:0">
      <button class="btn btn-sm btn-amber" onclick="selectAllRecommendedSells()">⚡ Pilih ${sellable.length} Layak Jual (+${fmtM(potentialSellCash)})</button>
      <button class="btn btn-sm" onclick="clearCart()">🔄 Reset Cart</button>
    </div>`;

  const box = document.getElementById('t7-blueprint');
  if (scoutBlueprintTab === 'SELL') {
    const rows = sellable.sort((a, b) => b.estRealSale - a.estRealSale);
    const injuredSale = D.roster.filter(p => p.injured && p.forSale);
    box.innerHTML = `
      ${injuredSale.length ? `<div class="alert-item CRITICAL mb-8"><span class="badge b-crit">INJURED_SALE</span><div><b>Tarik dari bursa jual:</b> ${injuredSale.map(p => esc(p.name)).join(', ')} — sedang cedera, jual sekarang kena potongan valuasi!</div></div>` : ''}
      <div class="kpi-sub mb-8">Pemain sehat yang direkomendasikan dijual (regresi / cadangan mahal / For Sale). Centang untuk langsung menambah <b>Sisa Daya Beli</b> di atas!</div>
      <div class="tbl-wrap tbl-sticky"><table><thead><tr><th>Pemain</th><th>Jual</th><th>Pos / Usia</th><th>Force / Cap</th><th>Gaji/Bln</th><th>Est. Cair (1.25x)</th><th>Alasan</th></tr></thead><tbody>` +
      (rows.length ? rows.map(p => {
        const sel = !!cartOut[p.id];
        return `<tr>
          <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> ${p.isTop5Arab ? `<span class="badge b-accent" title="${esc(tipFor('ARAB'))}">ARAB WATCH</span>` : ''}</td>
          <td><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleCartOut('${escJs(p.id)}')" /></td>
          <td class="mono">${fmtPos(p.pos)} • ${p.age}th (turun@${p.declineAge})</td>
          <td class="mono">${p.force} / ${p.potCap}</td>
          <td class="mono">${fmtM(p.salary)}</td>
          <td class="mono c-green"><b>+${fmtM(p.estRealSale)}</b> <span class="c-muted">(Ctr ${fmtM(p.estCounter40)})</span></td>
          <td><span class="badge b-warn">${esc(p.action)}</span></td>
        </tr>`;
      }).join('') : '<tr><td colspan="7" class="c-green">Skuad sangat ramping — tidak ada deadwood mendesak untuk dijual!</td></tr>') + `</tbody></table></div>`;
    return;
  }

  const cleanPool = D.scoutPool
    .filter(r => !cartIn[r[19]] && !(r[18] || '').includes('TRAP') && !(r[18] || '').includes('INJ'))
    .map(r => enrichScoutRow(r, cm));

  let picks = [];
  if (scoutBlueprintTab === 'UPGRADE') {
    const ranked = cleanPool
      .filter(x => x.affordCode !== 'EXP' && (x.fillsHole || (x.swap && x.swap.deltaEff >= 1.0)))
      .sort((a, b) => b.upgradeScore - a.upgradeScore);
    const posCnt = {};
    for (const x of ranked) {
      if ((posCnt[x.r[1]] || 0) >= 2) continue;
      posCnt[x.r[1]] = (posCnt[x.r[1]] || 0) + 1;
      picks.push({ it: x, lbl: x.fillsHole ? `TAMBAL LUBANG ${fmtPos(x.r[1])}` : `UPGRADE ${fmtPos(x.r[1])}`, cls: x.fillsHole ? 'b-warn' : 'b-good' });
      if (picks.length >= 6) break;
    }
  } else if (scoutBlueprintTab === 'ROI') {
    const ranked = cleanPool
      .filter(x => x.affordCode !== 'EXP' && x.r[2] <= 21 && x.r[11] === 0 && x.estProfit > 0)
      .sort((a, b) => (b.roiPct * 0.6 + (b.estProfit / 100000) * 1.8) - (a.roiPct * 0.6 + (a.estProfit / 100000) * 1.8));
    for (const x of ranked.slice(0, 6)) {
      picks.push({ it: x, lbl: `FLIP ROI +${x.roiPct}%`, cls: 'b-accent' });
    }
  } else if (scoutBlueprintTab === 'BARGAIN') {
    const ranked = cleanPool
      .filter(x => x.affordCode !== 'EXP' && (x.flags.includes('FREE') || x.flags.includes('BOSMAN') || x.flags.includes('UNH')))
      .sort((a, b) => b.smartScore - a.smartScore);
    for (const x of ranked.slice(0, 6)) {
      const tag = x.flags.includes('FREE') ? 'FREE AGENT (0€)' : (x.flags.includes('BOSMAN') ? 'BOSMAN ≤180D' : 'UNHAPPY (-15%)');
      picks.push({ it: x, lbl: tag, cls: 'b-info' });
    }
  }

  if (!picks.length) {
    box.innerHTML = `<div class="alert-item"><span class="badge b-warn">KAS KETAT</span><div>Belum ada rekomendasi yang muat di <b>Sisa Daya Beli (${fmtM(cm.projBudget)})</b>. Klik tombol <b>⚡ Pilih Layak Jual</b> di atas untuk menambah modal dari penjualan pemain, atau cek tab <b>🆓 Gratis &amp; Diskon</b>!</div></div>`;
    return;
  }
  box.innerHTML = `<div class="deal-grid">${picks.map(p => renderDealCard(p.it, p.lbl, p.cls)).join('')}</div>`;
}

function renderShortlistTab() {
  const ids = Object.keys(shortlistMap || {});
  const cntBadge = document.getElementById('t4-short-cnt');
  if (cntBadge) cntBadge.textContent = String(ids.length);
  const el = document.getElementById('t7-shortlist');
  if (!el) return;

  if (!ids.length) {
    el.innerHTML = `<div class="alert-item"><span class="badge b-accent">SHORTLIST KOSONG</span><div>Klik ikon bintang <b>☆</b> pada pemain mana saja di <b>Rencana Belanja</b>, <b>Eksplorasi Pasar</b>, atau <b>Player Drawer</b> untuk menyimpannya permanen antar-save!</div></div>`;
    return;
  }

  const cm = getCartMetrics();
  const poolById = new Map((D.scoutPool || []).map(r => [r[19], r]));
  const rosterById = new Map((D.roster || []).map(p => [p.id, p]));
  const activeCards = [];
  const archivedRows = [];

  ids.forEach(pid => {
    const saved = shortlistMap[pid];
    if (rosterById.has(pid)) {
      const p = rosterById.get(pid);
      archivedRows.push(`<div class="alert-item"><span class="badge b-good">SUDAH DIREKRUT ✓</span><div style="flex:1"><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(p.name)}</b></a> (${fmtPos(p.pos)} • F${p.force}) sudah masuk skuadmu!</div><button class="btn btn-sm" onclick="toggleShortlist('${escJs(pid)}')">Hapus</button></div>`);
    } else if (poolById.has(pid)) {
      const it = enrichScoutRow(poolById.get(pid), cm);
      const diffP = (saved && saved.savedPrice) ? (it.estBuy - saved.savedPrice) : 0;
      const lbl = diffP < -20000 ? `⭐ TURUN ${fmtM(-diffP)}!` : (it.flags.includes('BOSMAN') ? '⭐ BOSMAN GRATIS' : '⭐ TARGET SHORTLIST');
      activeCards.push(renderDealCard(it, lbl, diffP < -20000 ? 'b-good' : 'b-accent'));
    } else {
      archivedRows.push(`<div class="alert-item"><span class="badge b-muted">TIDAK DI POOL</span><div style="flex:1"><b>${esc(saved.name || pid)}</b> (${esc(fmtPos(saved.pos))} • ${esc(saved.club || '-')}) — tidak muncul di top scout pool save ini (disimpan ${esc(saved.savedAt || '-')}).</div><button class="btn btn-sm" onclick="toggleShortlist('${escJs(pid)}')">Hapus</button></div>`);
    }
  });

  el.innerHTML = (activeCards.length ? `<div class="deal-grid mb-8">${activeCards.join('')}</div>` : '') + archivedRows.join('');
}

function applyScoutPreset(preset) {
  scoutPreset = preset;
  document.getElementById('s-q').value = '';
  document.getElementById('s-pos').value = '';
  document.getElementById('s-foot').value = '';
  document.getElementById('s-max-age').value = preset === 'FLIP' ? '21' : '';
  document.getElementById('s-min-f').value = '';
  document.getElementById('s-max-price').value = '';
  document.getElementById('s-only-stack').checked = (preset === 'FLIP');
  document.getElementById('s-hide-trap').checked = true;
  document.getElementById('s-sort').value = preset === 'FLIP' ? 'ROI' : (preset === 'HOLES' ? 'UPGRADE' : 'SMART');
  renderScout();
  showToast('Preset Scout: ' + preset);
}

function getFilteredScout() {
  const cm = getCartMetrics();
  const q = (document.getElementById('s-q').value || '').toLowerCase();
  const pos = document.getElementById('s-pos').value;
  const foot = document.getElementById('s-foot').value;
  const maxAge = parseInt(document.getElementById('s-max-age').value, 10);
  const minF = parseInt(document.getElementById('s-min-f').value, 10);
  const maxPRaw = parseFloat(document.getElementById('s-max-price').value);
  const pUnit = parseFloat(document.getElementById('s-price-unit').value) || 1;
  const maxP = isNaN(maxPRaw) ? Infinity : maxPRaw * pUnit;
  const onlyAfford = document.getElementById('s-afford').checked;
  const onlyStack = document.getElementById('s-only-stack').checked;
  const hideTrap = document.getElementById('s-hide-trap').checked;
  const hideInj = document.getElementById('s-hide-inj').checked;
  const sortBy = document.getElementById('s-sort').value || 'SMART';
  const holesSet = new Set(D.holePositions || []);

  const filtered = [];
  for (const r of D.scoutPool) {
    const flags = r[18] || '';
    if (q && !(r[0].toLowerCase().includes(q) || r[16].toLowerCase().includes(q))) continue;
    if (pos && r[1] !== pos) continue;
    if (foot && r[3] !== foot) continue;
    if (!isNaN(maxAge) && r[2] > maxAge) continue;
    if (!isNaN(minF) && r[5] < minF) continue;
    if (r[14] > maxP) continue;
    if (onlyStack && (r[11] === 1 || r[10] < 3.0)) continue;
    if (hideTrap && flags.includes('TRAP')) continue;
    if (hideInj && flags.includes('INJ')) continue;

    if (scoutPreset === 'HOLES' && !holesSet.has(r[1])) continue;
    if (scoutPreset === 'FLIP' && (r[2] > 21 || r[17] < 30)) continue;
    if (scoutPreset === 'BOSMAN' && !flags.includes('BOSMAN')) continue;
    if (scoutPreset === 'UNH' && !flags.includes('UNH')) continue;
    if (scoutPreset === 'GEM' && !flags.includes('GEM')) continue;
    if (scoutPreset === 'FREE' && !flags.includes('FREE')) continue;
    if (scoutPreset === 'LOCAL' && !flags.includes('LOCAL')) continue;
    if (scoutPreset === 'SHORTLIST' && !isShortlisted(r[19])) continue;

    const item = enrichScoutRow(r, cm);
    if (onlyAfford && item.affordCode === 'EXP' && scoutPreset !== 'SHORTLIST') continue;
    filtered.push(item);
  }

  filtered.sort((a, b) => {
    if (sortBy === 'UPGRADE') return b.upgradeScore - a.upgradeScore;
    if (sortBy === 'ROI') return b.roiPct - a.roiPct || b.estProfit - a.estProfit;
    if (sortBy === 'PROFIT') return b.estProfit - a.estProfit;
    if (sortBy === 'CHEAP') return a.estBuy - b.estBuy || b.r[5] - a.r[5];
    if (sortBy === 'FORCE') return b.r[5] - a.r[5] || b.r[7] - a.r[7];
    if (sortBy === 'POTCAP') return b.r[7] - a.r[7] || b.r[5] - a.r[5];
    return b.smartScore - a.smartScore;
  });
  return filtered;
}

function renderScout() {
  const items = getFilteredScout();
  document.getElementById('t7-cnt').textContent = items.length + ' target';
  const show = items.slice(0, 120);
  document.getElementById('t7-scout-tbl').innerHTML = `<thead><tr>
    <th>Pemain &amp; Klub</th><th>Pos / Usia</th><th>F → Cap &amp; Skill</th>
    <th>Est. Beli &amp; Fit</th><th>Saran Gantikan (Swap)</th><th>Proyeksi Flip &amp; ROI</th><th>Aksi</th>
  </tr></thead><tbody>` + (show.length ? show.map(it => {
    const r = it.r;
    const sw = it.swap;
    const inC = !!cartIn[r[19]];
    const pinned = isShortlisted(r[19]);
    const stIcon = r[20] === 2 ? '👑' : (r[20] === 1 ? '⭐' : '');
    const fitBadge = it.affordCode === 'CASH'
      ? '<span class="badge b-good">✓ KAS</span>'
      : (it.affordCode === 'SWAP' ? '<span class="badge b-info">⇄ SWAP</span>' : '<span class="badge b-muted">✗ MAHAL</span>');

    const swCell = sw
      ? `<div><a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(sw.p.id)}')"><b>${esc(sw.p.name)}</b></a> <span class="mono ${sw.deltaEff >= 0 ? 'c-green' : 'c-amber'}">(${sw.deltaEff >= 0 ? '+' : ''}${sw.deltaEff} Eff)</span></div>
         <div class="c-muted" style="font-size:10px">Net: <b class="mono">${it.netCostIfSwap <= 0 ? '+' + fmtM(-it.netCostIfSwap) : '-' + fmtM(it.netCostIfSwap)}</b> • ΔGaji ${sw.deltaSal >= 0 ? '+' : ''}${fmtM(sw.deltaSal)}</div>`
      : '<span class="c-muted">-</span>';

    const pidJs = escJs(r[19]);
    const repIdJs = sw ? escJs(sw.p.id) : '';
    return `<tr>
      <td>
        <div><a class="clickable-name" onclick="openPlayerDrawer('scout','${pidJs}')"><b>${esc(r[0])}</b></a> ${stIcon} <span class="c-muted">(${r[4]} • ${esc(r[16])})</span></div>
        <div style="margin-top:3px">${renderCompactScoutBadges(r[18], it.fillsHole)}</div>
      </td>
      <td class="mono"><b>${fmtPos(r[1])}</b> • ${r[2]}th • <b>${fmtFoot(r[3])}</b><div class="c-muted" style="font-size:10px">Kontrak ${r[15]}d</div></td>
      <td class="mono">
        <b>${r[5]}</b> → <b class="c-green">${r[7]}</b>
        <div><span class="badge ${r[11] ? 'b-crit' : 'b-muted'}">${fmtSkills(r[8], r[9])} (+${r[10]}%)</span></div>
      </td>
      <td class="mono">
        <b>${fmtM(it.estBuy)}</b> ${fitBadge}
        <div class="c-muted" style="font-size:10px">Gaji 3th: ${fmtM(it.sal3y)}/bln</div>
      </td>
      <td>${swCell}</td>
      <td class="mono">
        <b class="${it.estProfit > 0 ? 'c-green' : 'c-muted'}">${it.estProfit >= 0 ? '+' : ''}${fmtM(it.estProfit)} (${it.roiPct}%)</b>
        <div class="c-muted" style="font-size:10px">Est. Jual ${fmtM(it.estResale)} (+${it.projGain}F)</div>
      </td>
      <td>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="star-btn ${pinned ? 'pinned' : ''}" title="${pinned ? 'Hapus dari Shortlist' : 'Pin ke Shortlist'}" onclick="toggleShortlist('${pidJs}')">${pinned ? '★' : '☆'}</button>
          <button class="btn btn-sm ${inC ? 'btn-amber' : 'btn-green'}" onclick="toggleCartIn('${pidJs}')">${inC ? '✓' : '+ Beli'}</button>
          ${sw ? `<button class="btn btn-sm" title="Beli target + Jual ${esc(sw.p.name)}" onclick="swapToCart('${pidJs}','${repIdJs}')">⇄</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="c-muted">Tidak ada target sesuai filter (coba lepas centang "Hanya Masuk Daya Beli" atau pilih pemain untuk dijual dulu).</td></tr>') + `</tbody>`;
}

function exportScoutCsv() {
  const items = getFilteredScout().slice(0, 500);
  const hdr = ['Name','Pos','Age','Foot','Nat','Force','Pot','PotCap','S1','S2','StackPct','Sal3Y','MV','EstBuy','EstResale','EstProfit','RoiPct','SuggestedReplace','DeltaEff','NetSwapCost','ContractDays','Club','Flags','Shortlisted'];
  const lines = [hdr.join(',')].concat(items.map(it => {
    const r = it.r, sw = it.swap;
    return [
      `"${r[0].replace(/"/g,'""')}"`, fmtPos(r[1]), r[2], fmtFoot(r[3]), r[4], r[5], r[6], r[7],
      fmtSkill(r[8]), fmtSkill(r[9]), r[10], it.sal3y, r[13], it.estBuy, it.estResale, it.estProfit, it.roiPct,
      sw ? `"${sw.p.name.replace(/"/g,'""')}"` : '""', sw ? sw.deltaEff : 0, it.netCostIfSwap,
      r[15], `"${r[16].replace(/"/g,'""')}"`, `"${r[18]}"`, isShortlisted(r[19]) ? 'YES' : 'NO'
    ].join(',');
  }));
  downloadCsv('ligafoot_scout.csv', lines.join('\n'));
}

function renderTab7All() {
  renderCart();
  renderScoutBlueprint();
  renderShortlistTab();
  renderScout();
  if (typeof renderStickyCartBar === 'function') renderStickyCartBar();
  if (typeof renderShopAnalytics === 'function') renderShopAnalytics();
}

function selectAllRecommendedSells() {
  let added = 0;
  D.roster.forEach(p => {
    if (isRecommendedSell(p) && !cartOut[p.id]) {
      cartOut[p.id] = { arab: false };
      added++;
    }
  });
  renderTab7All();
  showToast(added ? `${added} pemain layak jual masuk ke Cart!` : 'Semua pemain layak jual sudah ada di Cart');
}

function swapToCart(targetId, replaceId) {
  const found = D.scoutPool.find(r => r[19] === targetId);
  if (found) cartIn[targetId] = found;
  const rep = D.roster.find(p => p.id === replaceId);
  if (rep) {
    if (rep.injured) {
      showToast(`${found ? found[0] : 'Target'} masuk Beli! (${rep.name} sedang cedera, jangan dijual dulu)`);
    } else {
      cartOut[replaceId] = cartOut[replaceId] || { arab: false };
      showToast(`Swap dipasang: Beli ${found ? found[0] : ''} ⇄ Jual ${rep.name}`);
    }
  }
  renderTab7All();
}

function toggleCartOut(pid) {
  if (cartOut[pid]) delete cartOut[pid];
  else cartOut[pid] = { arab: false };
  renderTab7All();
}
function toggleCartArab(pid) {
  if (!cartOut[pid]) cartOut[pid] = { arab: true };
  else cartOut[pid].arab = !cartOut[pid].arab;
  renderTab7All();
}
function toggleCartIn(pid) {
  if (cartIn[pid]) {
    delete cartIn[pid];
  } else {
    const found = D.scoutPool.find(r => r[19] === pid);
    if (found) cartIn[pid] = found;
  }
  renderTab7All();
}
function clearCart() { cartOut = {}; cartIn = {}; renderTab7All(); showToast('Keranjang transfer dikosongkan'); }

function renderCart() {
  const cm = getCartMetrics();
  const { cashIn, cashOut, salDelta, projBudget, projForeign, inList } = cm;

  document.getElementById('t7-cart-kpis').innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div class="kpi-lbl">Est. Dana Masuk (Real 1.25x)</div>
      <div class="kpi-val mono c-green">+${fmtM(cashIn)}</div>
      <div class="kpi-sub">${Object.keys(cartOut).length} pemain dijual</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div class="kpi-lbl">Est. Belanja Masuk</div>
      <div class="kpi-val mono c-amber">-${fmtM(cashOut)}</div>
      <div class="kpi-sub">${inList.length} target masuk</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div class="kpi-lbl">Proyeksi Sisa Kas</div>
      <div class="kpi-val mono ${projBudget >= 0 ? 'c-green' : 'c-red'}">${fmtM(projBudget)}</div>
      <div class="kpi-sub">Delta Gaji: <b class="mono">${salDelta >= 0 ? '+' : ''}${fmtM(salDelta)}/bln</b></div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div class="kpi-lbl">Kuota Asing Skuad</div>
      <div class="mono kpi-val ${projForeign > D.meta.foreignCap ? 'c-amber' : 'c-sky'}">${projForeign} <span style="font-size:12px" class="c-muted">(Batas XI: ${D.meta.foreignCap})</span></div>
      <div class="kpi-sub">${projForeign > D.meta.foreignCap ? '⚠ Lebih dari batas lapangan!' : '✓ Aman masuk XI'}</div>
    </div>`;

  const sortedOut = [...D.roster].sort((a, b) => (isRecommendedSell(b) ? 1 : 0) - (isRecommendedSell(a) ? 1 : 0) || b.estRealSale - a.estRealSale);
  document.getElementById('t7-out-tbl').innerHTML = `<thead><tr><th>Jual</th><th>Pemain</th><th>Real 1.25x (Ctr +40%)</th><th>Arab 2.5x</th></tr></thead><tbody>` +
    sortedOut.map(p => {
      const sel = cartOut[p.id];
      const recSell = isRecommendedSell(p);
      const injWarn = p.injured ? ' <span class="badge b-crit">🏥INJ</span>' : (recSell ? ' <span class="badge b-warn">LAYAK JUAL</span>' : '');
      const pidJs = escJs(p.id);
      return `<tr>
        <td><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleCartOut('${pidJs}')" /></td>
        <td><a class="clickable-name" onclick="openPlayerDrawer('roster','${pidJs}')"><b>${esc(p.name)}</b></a> <span class="c-muted">(${fmtPos(p.pos)} ${p.age}th • F${p.force})</span>${injWarn}</td>
        <td class="mono">${fmtM(p.estRealSale)} <span class="c-muted" style="font-size:10px">(Ctr ${fmtM(p.estCounter40)})</span></td>
        <td>${p.isTop5Arab ? `<button class="btn btn-sm ${sel && sel.arab ? 'btn-amber' : ''}" onclick="toggleCartArab('${pidJs}')">${fmtM(p.estArabLow)}</button>` : '<span class="c-muted">-</span>'}</td>
      </tr>`;
    }).join('') + `</tbody>`;

  document.getElementById('t7-in-tbl').innerHTML = `<thead><tr><th>Target</th><th>Pos</th><th>Est. Beli</th><th>Gaji 3Th</th><th>Hapus</th></tr></thead><tbody>` +
    (inList.length ? inList.map(r => `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('scout','${escJs(r[19])}')"><b>${esc(r[0])}</b></a> (${r[5]}→${r[7]})</td><td><b>${fmtPos(r[1])}</b></td>
      <td class="mono c-amber">${fmtM(r[14])}</td><td class="mono">${fmtM(Math.round(r[12] * 0.95))}</td>
      <td><button class="btn btn-sm" onclick="toggleCartIn('${escJs(r[19])}')">✕</button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="c-muted">Belum ada target ditambahkan. Klik "+ Beli" atau "⇄ Swap" di atas!</td></tr>') + `</tbody>`;
}
