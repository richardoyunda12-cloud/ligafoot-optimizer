// ==================== RENDER TAB 5 (KEUANGAN, SHOP & STADION — v8.0) ====================
function renderTab6() {
  const sh = D.shop, mb = D.member;
  document.getElementById('t6-shop').innerHTML = `
    <div class="mb-8">Harga Saat Ini: <b class="mono">${sh.cur_m.toFixed(2)}x</b> (Demand <b class="mono">${(sh.cur_pf*100).toFixed(1)}%</b> • ${sh.cur_word.toUpperCase()})</div>
    <div class="mb-8">Optimal v1.2.0: <span class="badge b-good">1.00x (Puncak Mutlak!)</span> ${sh.is_optimal ? '<span class="c-green">✓ Sudah Optimal</span>' : `<span class="c-amber">Potensi +${sh.gain_pct}%</span>`}</div>
    <div class="c-muted mb-8">Bonus Bintang: <b>+${sh.star_bonus_pct}%</b> (${sh.star_cnt} star, ${sh.top_cnt} top) | Hype Rekrutan: <b class="c-green">+${sh.hype_bonus_pct}%</b></div>
    ${sh.mega_signings.length ? `<div class="badge b-accent mb-8">🔥 MEGA SIGNING (+30%): ${sh.mega_signings.map(x => esc(x.name) + ' ' + x.daysLeft + 'd').join(', ')}</div>` : ''}
    ${sh.big_signings.length ? `<div class="badge b-info mb-8">⚡ BIG SIGNING (+8%): ${sh.big_signings.map(x => esc(x.name) + ' ' + x.daysLeft + 'd').join(', ')}</div>` : ''}
    <div class="flex-between"><span class="c-muted">Bulan Terakhir: <b class="mono c-green">${fmtM(sh.last_rev)}</b> (${sh.last_shirts.toLocaleString('id-ID')} jersey)</span><button class="btn btn-sm" onclick="goToView('t5','t5-shop')">Grafik &amp; Top Jersey →</button></div>`;

  document.getElementById('t6-member').innerHTML = `
    <div class="mb-8">Anggota Aktif: <b class="mono">${mb.n.toLocaleString('id-ID')}</b> (Rasio Cap g = <b class="mono">${(mb.g*100).toFixed(1)}%</b>)</div>
    <div class="mb-8">Setelan Kini: <b class="mono">${mb.cur_m.toFixed(2)}x</b> • Diskon Tahunan <b class="mono">${mb.cur_d}%</b></div>
    <div class="mb-8">Optimal v1.2.0: <span class="badge b-good">${mb.opt_m.toFixed(2)}x + Diskon ${mb.opt_d}%</span> ${mb.is_optimal ? '<span class="c-green">✓ Sudah Optimal</span>' : `<span class="c-amber">Potensi +${mb.gain_pct}%</span>`}</div>
    <div class="c-muted">Puncak matematis <code>priceFactor</code> di <b>${mb.opt_m.toFixed(2)}x / Diskon ${mb.opt_d}%</b> (Indeks ${(mb.opt_idx*100).toFixed(2)}%, tidak terpotong cap).</div>`;

  const nm = D.naming;
  const nmHtml = nm
    ? `<div><b>Naming Rights:</b> ${esc(nm.name)} (${fmtM(nm.yearly)}/thn, sisa <b class="${nm.monthsLeft <= 2 ? 'c-red' : 'c-green'}">${nm.monthsLeft} bln</b>) — <i>Wajib 1 Tahun (1.15x)</i></div>`
    : `<div class="c-red"><b>Naming Rights:</b> KOSONG — segera tanda tangani durasi 1 Tahun (1.15x)!</div>`;
  const slotMap = { master: 'Utama (Master)', material: 'Apparel / Jersey', secundario: 'Sekunder', secondary: 'Sekunder' };
  const spHtml = D.sponsors.length
    ? D.sponsors.map(s => {
        const sLbl = slotMap[(s.slot || '').toLowerCase()] || s.slot || 'Sponsor';
        const rem = (s.monthsLeft ?? s.paymentsLeft ?? s.months ?? '?');
        const mo = Number(s.monthly) || 0;
        const luv = Number(s.luvas) || 0;
        const dur = Math.max(1, Number(s.months) || 12);
        const valTxt = (mo > 0)
          ? `${fmtM(mo)}/bln${luv > 0 ? ' + DP ' + fmtM(luv) : ''}`
          : (luv > 0 ? `Bayar Dimuka ${fmtM(luv)} (~${fmtM(luv / dur)}/bln)` : 'Aktif');
        return `<div>• <b>${esc(sLbl)}:</b> ${esc(s.company || '-')} (${valTxt}, sisa ${rem} bln)</div>`;
      }).join('')
    : '<div class="c-amber">Belum ada sponsor aktif terbaca.</div>';

  const pg = (D.presGoals && typeof D.presGoals === 'object' && !Array.isArray(D.presGoals)) ? D.presGoals : null;
  let pgHtml = '';
  if (pg) {
    const items = [];
    if (pg.league) items.push(`<div>• <b>${esc(pg.league.name || 'Liga')}:</b> ${formatPresTarget('league', pg.league.target)}</div>`);
    if (pg.cup) items.push(`<div>• <b>${esc(pg.cup.name || 'Piala')}:</b> ${formatPresTarget('cup', pg.cup.target)}</div>`);
    if (pg.cont) items.push(`<div>• <b>${esc(pg.cont.name || 'Kontinental')}:</b> ${formatPresTarget('cont', pg.cont.target)}</div>`);
    if (pg.last && pg.last.bonus) items.push(`<div class="c-green" style="margin-top:3px">🏆 Bonus Musim Lalu: <b class="mono">+${fmtM(pg.last.bonus)}</b></div>`);
    if (items.length) pgHtml = '<div class="mt-12"><b>🎯 Target Presiden (Musim ' + (pg.season || D.meta.season) + '):</b>' + items.join('') + '</div>';
  }
  document.getElementById('t6-commercial').innerHTML = nmHtml + '<div class="mt-12"><b>Sponsor Jersey:</b>' + spHtml + '</div>' + pgHtml;

  // Rincian Estimasi Arus Kas Rutin Musim Ini (Bug 1 Fix)
  const cfEl = document.getElementById('t6-cashflow-detail');
  if (cfEl && D.cashflow && D.cashflow.estBreakdown) {
    const b = D.cashflow.estBreakdown;
    const cf = D.cashflow;
    cfEl.innerHTML = `
      <div class="grid g2" style="gap:8px;margin-bottom:8px">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:9px">
          <div class="c-green" style="font-weight:700;margin-bottom:4px">📥 Est. Pemasukan Rutin (+${fmtM(cf.estCurrentIncome)})</div>
          <div class="mono">• Tiket (~2 kandang): <b>${fmtM(b.tickets)}</b></div>
          <div class="mono">• Sponsor (amortisasi): <b>${fmtM(b.sponsors)}</b></div>
          <div class="mono">• Naming Rights (/12): <b>${fmtM(b.naming)}</b></div>
          <div class="mono">• Iuran Member: <b>${fmtM(b.members)}</b></div>
          <div class="mono">• Hak Siar TV: <b>${fmtM(b.tv)}</b></div>
          <div class="mono">• Club Shop: <b>${fmtM(b.shop)}</b></div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:9px">
          <div class="c-amber" style="font-weight:700;margin-bottom:4px">📤 Pengeluaran Rutin (-${fmtM(cf.estCurrentExpense)})</div>
          <div class="mono">• Total Gaji Skuad: <b>${fmtM(b.payroll)}</b></div>
          <div class="mono">• Ops Stadion (&gt;20K): <b>${fmtM(b.stadiumOps)}</b></div>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
            Net Rutin/Bln: <b class="mono ${cf.estCurrentNet >= 0 ? 'c-green' : 'c-amber'}" style="font-size:15px">${cf.estCurrentNet >= 0 ? '+' : ''}${fmtM(cf.estCurrentNet)}</b>
            <div class="c-muted" style="font-size:10px;margin-top:2px">Belum termasuk hadiah kompetisi, bonus presiden, &amp; profit transfer pemain.</div>
          </div>
        </div>
      </div>`;
  }

  renderTicketSim();
  renderCashChartAndRoi();
  renderShopAnalytics();

  // Bug 2 Fix: Tampilkan kolom Kompetisi di histori penonton kandang
  document.getElementById('t6-crowd-tbl').innerHTML = `<thead><tr><th>Tgl</th><th>Lawan &amp; Kompetisi</th><th>Penonton</th><th>Pemasukan Tiket</th></tr></thead><tbody>` +
    (D.homeCrowdLog.length ? D.homeCrowdLog.map(h => `<tr><td class="mono">${esc(h.date)}</td><td><b>${esc(h.opp)}</b> <span class="c-muted" style="font-size:10px">(${esc(h.comp)})</span></td><td class="mono">${h.att.toLocaleString('id-ID')}</td><td class="mono c-green">${fmtM(h.rev)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="c-muted">Histori at/rv matchLog belum terisi di save ini.</td></tr>') + `</tbody>`;

  // Bug 5 Fix: Sembunyikan kotak tabel mutasi bila statement kosong
  const stWrap = document.getElementById('t6-stmt-wrap');
  if (stWrap) {
    if (!D.statement || !D.statement.length) {
      stWrap.style.display = 'none';
    } else {
      stWrap.style.display = '';
      document.getElementById('t6-stmt-tbl').innerHTML = `<thead><tr><th>Tgl</th><th>Keterangan</th><th>Jumlah</th></tr></thead><tbody>` +
        D.statement.map(s => `<tr><td class="mono">${esc(s.date)}</td><td>${esc(s.label)}</td><td class="mono ${s.amount >= 0 ? 'c-green' : 'c-red'}">${s.amount >= 0 ? '+' : ''}${fmtM(s.amount)}</td></tr>`).join('') + `</tbody>`;
    }
  }
}

function setSimMode(mode) {
  simMode = mode;
  document.getElementById('sim-mode-normal').className = mode === 'normal' ? 'btn btn-sm btn-green' : 'btn btn-sm';
  document.getElementById('sim-mode-big').className = mode === 'big' ? 'btn btn-sm btn-amber' : 'btn btn-sm';
  renderTicketSim();
}
function stepSimPrice(sec, delta) {
  const bp = D.stadium.basePrices[sec];
  const lo = Math.max(1, Math.round(bp * 0.5)), hi = Math.round(bp * 2.0);
  simPrices[sec] = Math.max(lo, Math.min(hi, simPrices[sec] + delta));
  renderTicketSim();
}
function applyOptimalTicketJS() {
  simPrices = optimalPricesJS(simMode === 'big');
  renderTicketSim();
  showToast('Harga tiket optimal (Fill ≥ 70.5%) diterapkan!');
}
function applyPhaseToSim(phaseKey) {
  const row = (D.stadium.phases || []).find(r => r.phase === phaseKey);
  if (!row) return;
  simPrices = { ...row.optPrices };
  simMode = (phaseKey === 'normal' || phaseKey === 'r16') ? 'normal' : 'big';
  setSimMode(simMode);
  showToast(`Preset fase ${row.label} dimuat ke simulator!`);
}

function renderTicketSim() {
  const big = simMode === 'big';
  const sim = simulateStadiumJS(simPrices, big);
  const labels = { geral: 'General', arquibancada: 'Stands', cadeiras: 'Seats', camarotes: 'Boxes (VIP)' };
  document.getElementById('t6-ticket-sim').innerHTML = ['geral','arquibancada','cadeiras','camarotes'].map(s => {
    const sd = sim.sectors[s];
    const step = sd.bp >= 50 ? 5 : 1;
    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div class="flex-between"><b style="font-size:12px">${labels[s]}</b><span class="c-muted mono" style="font-size:10px">${sd.cap.toLocaleString('id-ID')} • List ${sd.bp}</span></div>
      <div class="flex-between mt-12">
        <button class="btn btn-sm" onclick="stepSimPrice('${s}', -${step})">-</button>
        <span class="mono c-green" style="font-size:19px;font-weight:800">${sd.p}</span>
        <button class="btn btn-sm" onclick="stepSimPrice('${s}', ${step})">+</button>
      </div>
      <div class="mono c-muted mt-12" style="font-size:11px;text-align:center">${sd.mul.toFixed(2)}x • Fill <b>${sd.fillPct}%</b> • <b class="c-green">${fmtM(sd.rev)}</b></div>
    </div>`;
  }).join('');

  document.getElementById('t6-ticket-res').innerHTML = `
    Total Penonton: <b class="mono">${sim.totAtt.toLocaleString('id-ID')} / ${D.stadium.totalSeats.toLocaleString('id-ID')}</b>
    (<b class="${sim.crowdFull ? 'c-green' : 'c-red'} mono">${sim.fillPct}%</b> ${sim.crowdFull ? '✓ Bonus +2% Tengah AKTIF' : '⚠ <70% Bonus Tengah HILANG!'})
    | Est. Pemasukan Laga: <b class="mono c-green">${fmtM(sim.totRev)}</b>
    | <span class="c-muted">Label Unhappy UI murni kosmetik &amp; tidak mengurangi fanConfidence.</span>`;

  const phases = D.stadium.phases || [];
  if (phases.length) {
    document.getElementById('t6-tmb').innerHTML = `
      <div class="mb-8"><b>📋 Tabel Preset Siap Salin — 6 Fase Resmi <code>ticketMulBy</code> (v1.2.0):</b></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Fase (Occasion)</th><th>Status</th><th>Harga Kini (Gen·St·Sea·Box)</th><th>Optimal Siap Salin</th><th>Fill</th><th>Est. Gate</th><th>Potensi +</th><th>Aksi</th></tr></thead>
        <tbody>${phases.map(r => {
          const cp = r.curPrices, op = r.optPrices;
          const curStr = `${cp.geral} · ${cp.arquibancada} · ${cp.cadeiras} · ${cp.camarotes}`;
          const optStr = `${op.geral} · ${op.arquibancada} · ${op.cadeiras} · ${op.camarotes}`;
          return `<tr>
            <td><b>${esc(r.label)}</b> <span class="c-muted mono">(${r.phase})</span></td>
            <td><span class="badge ${r.isCustom ? 'b-info' : 'b-muted'}">${r.isCustom ? 'Custom' : 'Default'}</span></td>
            <td class="mono c-muted">${curStr}</td>
            <td class="mono c-green"><b>${optStr}</b></td>
            <td class="mono ${r.fillPct >= 70 ? 'c-green' : 'c-red'}">${r.fillPct}%</td>
            <td class="mono">${fmtM(r.estRev)}</td>
            <td class="mono ${r.revGain > 5000 ? 'c-amber' : 'c-green'}">${r.revGain > 0 ? '+' + fmtM(r.revGain) : '✓ Pas'}</td>
            <td>
              <button class="btn btn-sm" onclick="copyText('${optStr}','Preset ${escJs(r.label)}')">📋</button>
              <button class="btn btn-sm" onclick="applyPhaseToSim('${r.phase}')">Muat</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }
}

function renderCashChartAndRoi() {
  const ch = D.cashHistory;
  const el = document.getElementById('t6-cash-chart');
  if (ch.length < 2) {
    el.innerHTML = '<div class="c-muted" style="font-size:12px">Data cashHistory belum cukup untuk grafik.</div>';
  } else {
    const vals = ch.map(x => x.val);
    const mn = Math.min(...vals), mx = Math.max(...vals, mn + 1);
    const W = 520, H = 140, pad = 16;
    const pts = ch.map((x, i) => {
      const px = pad + (i / (ch.length - 1)) * (W - pad * 2);
      const py = H - pad - ((x.val - mn) / (mx - mn)) * (H - pad * 2);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:140px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">
      <polyline fill="none" stroke="#10b981" stroke-width="2.5" points="${pts}" />
      <text x="10" y="14" fill="#8ea3bc" font-size="10">Max: ${fmtM(mx)}</text>
      <text x="10" y="${H - 5}" fill="#8ea3bc" font-size="10">Min: ${fmtM(mn)}</text>
      <text x="${W - 110}" y="14" fill="#6ee7b7" font-size="10">Kini: ${fmtM(vals[vals.length - 1])}</text>
    </svg>`;
  }

  const bp = D.stadium.basePrices;
  const homeGamesYr = 22;
  const opsSeatYr = 35 * 12;
  const secRoi = [
    { name: '+100 Boxes (VIP)', seats: 100, price: bp.camarotes * 2, costEst: 2_600_000 },
    { name: '+1.000 Seats', seats: 1000, price: bp.cadeiras * 2, costEst: 4_500_000 },
    { name: '+3.000 Stands', seats: 3000, price: Math.round(bp.arquibancada * 1.4), costEst: 7_200_000 },
  ].map(x => {
    const grossYr = x.seats * x.price * homeGamesYr;
    const netYr = grossYr - (D.stadium.totalSeats >= 20000 ? x.seats * opsSeatYr : 0);
    const paybackGames = netYr > 0 ? Math.ceil(x.costEst / (netYr / homeGamesYr)) : 999;
    return `<tr><td><b>${x.name}</b></td><td class="mono">${fmtM(x.costEst)}</td><td class="mono c-green">+${fmtM(netYr)}/thn</td><td class="mono">${paybackGames} laga</td></tr>`;
  }).join('');

  const nextCt = Math.min(10, D.meta.ctLevel + 1);
  const ctDesc = (D.ctMilestones.find(x => x[0] === nextCt) || [nextCt, 'Maksimal'])[1];
  document.getElementById('t6-roi').innerHTML = `
    <div class="mb-8"><b>Perbandingan ROI (12 Bulan • 22 Laga Kandang):</b></div>
    <div class="tbl-wrap mb-8"><table><thead><tr><th>Opsi Ekspansi</th><th>Est. Biaya</th><th>Net/Tahun</th><th>Balik Modal</th></tr></thead><tbody>${secRoi}</tbody></table></div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:9px">
      <div><b>Next CT Milestone (Lv ${nextCt}):</b> <span class="c-sky">${esc(ctDesc)}</span></div>
      <div class="c-muted" style="margin-top:3px">Maintenance CT: <b class="${D.meta.ctMaintOff ? 'c-red' : 'c-green'}">${D.meta.ctMaintOff ? 'MATI (NYALAKAN SEGERA!)' : 'AKTIF ✓'}</b> (Kondisi ${D.meta.ctCond}%) • Youth Coach Lv ${D.meta.youthCoach} ${D.meta.youthCoach < 3 ? '<span class="c-amber">(Wajib naik ke Lv 3!)</span>' : '<span class="c-green">(Maksimal ✓)</span>'}</div>
    </div>`;
}

// ==================== CLUB SHOP ANALYTICS & TOP 8 JERSEY LEADERBOARD (v8.0 TAHAP 3) ====================
function parseTopJerseyEntries(rawTop) {
  const roster = D.roster || [];
  const byId = new Map(roster.map(p => [p.id, p]));
  const byName = new Map(roster.map(p => [String(p.name || '').toLowerCase(), p]));
  const out = [];

  const pushEntry = (idOrName, nameHint, countVal) => {
    const cnt = Number(countVal) || 0;
    if (cnt <= 0) return;
    let p = byId.get(idOrName) || byName.get(String(nameHint || idOrName || '').toLowerCase()) || null;
    const displayName = (p && p.name) || nameHint || idOrName || 'Pemain';
    out.push({
      id: p ? p.id : (typeof idOrName === 'string' && byId.has(idOrName) ? idOrName : ''),
      name: displayName,
      shirts: Math.round(cnt),
      player: p,
    });
  };

  if (Array.isArray(rawTop)) {
    rawTop.forEach(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const idVal = item.id || item.pid || item.playerId || item.p || '';
        const nmVal = item.name || item.n || item.playerName || '';
        const cntVal = item.s ?? item.shirts ?? item.count ?? item.q ?? item.qty ?? item.v ?? 0;
        pushEntry(idVal || nmVal, nmVal, cntVal);
      } else if (Array.isArray(item) && item.length >= 2) {
        if (typeof item[1] === 'number') pushEntry(item[0], '', item[1]);
        else if (item.length >= 3 && typeof item[2] === 'number') pushEntry(item[0], item[1], item[2]);
      }
    });
  } else if (rawTop && typeof rawTop === 'object') {
    Object.entries(rawTop).forEach(([k, v]) => pushEntry(k, '', v));
  }

  return out.sort((a, b) => b.shirts - a.shirts).slice(0, 8);
}

function renderShopAnalytics() {
  const wrap = document.getElementById('t5-shop-analytics');
  if (!wrap) return;
  const sh = D.shop || {};
  const hist = sh.history || [];

  if (!hist.length) {
    wrap.innerHTML = '<div class="c-muted">Belum ada histori penjualan bulanan Club Shop (<code>shopLog</code>) di save ini.</div>';
    return;
  }

  const latest = hist[hist.length - 1];
  const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  const totalShirts12 = hist.reduce((s, x) => s + (x.shirts || 0), 0);
  const totalRev12 = hist.reduce((s, x) => s + (x.revenue || 0), 0);
  const growthPct = (prev && prev.shirts > 0) ? Math.round(((latest.shirts - prev.shirts) / prev.shirts) * 100) : null;

  // 1. Grafik SVG 12 Bulan Penjualan Jersey & Omzet
  const W = 580, H = 195, padL = 44, padR = 16, padT = 22, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxS = Math.max(10, ...hist.map(x => x.shirts || 0));
  const barW = Math.max(14, Math.min(34, (plotW / hist.length) * 0.62));

  const barsSvg = hist.map((x, i) => {
    const cx = padL + ((i + 0.5) / hist.length) * plotW;
    const bh = Math.max(3, ((x.shirts || 0) / maxS) * plotH);
    const y = padT + plotH - bh;
    const isLast = i === hist.length - 1;
    const ymLbl = (x.ym || '').slice(2); // "28-03"
    return `
      <g>
        <title>${x.ym}: ${(x.shirts || 0).toLocaleString('id-ID')} jersey (${fmtM(x.revenue)})</title>
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}"
              rx="4" fill="${isLast ? '#10b981' : '#38bdf8'}" opacity="${isLast ? '0.95' : '0.72'}" />
        <text x="${cx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" fill="${isLast ? '#6ee7b7' : '#8ea3bc'}" font-size="9" font-weight="700">${x.shirts >= 1000 ? (x.shirts / 1000).toFixed(1) + 'K' : x.shirts}</text>
        <text x="${cx.toFixed(1)}" y="${H - 12}" text-anchor="middle" fill="#8ea3bc" font-size="9">${esc(ymLbl)}</text>
      </g>`;
  }).join('');

  const chartSvg = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:195px;background:var(--bg2);border-radius:11px;border:1px solid var(--border)">
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#243449" stroke-width="1" />
      <text x="6" y="${padT + 8}" fill="#8ea3bc" font-size="9">${maxS.toLocaleString('id-ID')}</text>
      <text x="6" y="${padT + plotH}" fill="#8ea3bc" font-size="9">0</text>
      ${barsSvg}
    </svg>`;

  // 2. Leaderboard Top 8 Jersey Bulan Terakhir
  const topList = parseTopJerseyEntries(latest.top);
  const maxTop = topList.length ? Math.max(1, topList[0].shirts) : 1;
  const totalTopSum = Math.max(latest.shirts || 1, topList.reduce((s, x) => s + x.shirts, 0));

  const leaderHtml = topList.length ? topList.map((it, idx) => {
    const pctBar = Math.max(8, Math.round((it.shirts / maxTop) * 100));
    const sharePct = ((it.shirts / totalTopSum) * 100).toFixed(1);
    const p = it.player;
    const rCls = idx === 0 ? 'r1' : (idx === 1 ? 'r2' : (idx === 2 ? 'r3' : ''));
    const inSell = p && cartOut && cartOut[p.id];
    const nameHtml = p
      ? `<a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(it.name)}</b></a> ${p.top ? '👑' : (p.star ? '⭐' : '')} <span class="c-muted" style="font-size:10px">(${fmtPos(p.pos)} • F${p.force})</span>`
      : `<b>${esc(it.name)}</b>`;
    const idolWarn = inSell
      ? `<span class="badge b-crit" title="Pemain terlaris di Toko sedang ada di Cart Jual — waspadai penurunan penjualan jersey (Idol Shop Drop)!">⚠ DI CART JUAL</span>`
      : '';
    return `<div class="jersey-row">
      <div class="jersey-rank ${rCls}">#${idx + 1}</div>
      <div style="min-width:0;overflow:hidden;text-overflow:ellipsis">${nameHtml} ${idolWarn}</div>
      <div class="mini-bar-wrap">
        <div class="mini-bar-bg" style="height:8px"><div class="mini-bar-fill" style="width:${pctBar}%;background:${idx === 0 ? '#fbbf24' : (idx < 3 ? '#10b981' : '#38bdf8')}"></div></div>
      </div>
      <div class="mono" style="text-align:right"><b>${it.shirts.toLocaleString('id-ID')}</b> <span class="c-muted" style="font-size:10px">(${sharePct}%)</span></div>
    </div>`;
  }).join('') : '<div class="c-muted">Data rincian top seller jersey bulan terakhir tidak tersedia.</div>';

  // 3. Tabel Ringkas 12 Bulan Terakhir
  const histRows = [...hist].reverse().map(x => `<tr>
    <td class="mono"><b>${esc(x.ym)}</b></td>
    <td class="mono">${(x.shirts || 0).toLocaleString('id-ID')}</td>
    <td class="mono c-green"><b>${fmtM(x.revenue)}</b></td>
    <td class="mono c-muted">${x.shirts > 0 ? (x.revenue / x.shirts).toFixed(2) : '-'}</td>
  </tr>`).join('');

  wrap.innerHTML = `
    <div class="shop-kpi-strip">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Bulan Terakhir (${esc(latest.ym)})</div>
        <div class="kpi-val mono c-green">${(latest.shirts || 0).toLocaleString('id-ID')}</div>
        <div class="kpi-sub">Omzet <b>${fmtM(latest.revenue)}</b>${growthPct !== null ? ` • ${growthPct >= 0 ? '+' : ''}${growthPct}% vs bln lalu` : ''}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Total ${hist.length} Bulan Terakhir</div>
        <div class="kpi-val mono c-sky">${totalShirts12.toLocaleString('id-ID')}</div>
        <div class="kpi-sub">Total Omzet: <b class="mono c-green">${fmtM(totalRev12)}</b></div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Harga Jersey &amp; Demand</div>
        <div class="kpi-val mono ${sh.is_optimal ? 'c-green' : 'c-amber'}">${(sh.cur_m || 1).toFixed(2)}x</div>
        <div class="kpi-sub">${sh.is_optimal ? '✓ Tepat di puncak 1.00x' : 'Ubah ke 1.00x (+' + sh.gain_pct + '%)'}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Boost Bintang &amp; Hype</div>
        <div class="kpi-val mono c-purple">+${((sh.star_bonus_pct || 0) + (sh.hype_bonus_pct || 0)).toFixed(0)}%</div>
        <div class="kpi-sub">Bintang +${sh.star_bonus_pct}% • Hype Rekrutan +${sh.hype_bonus_pct}%</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>📈 Tren Penjualan Jersey (${hist.length} Bulan)</h2>
        ${chartSvg}
        <div class="tbl-wrap mt-12" style="max-height:220px;overflow-y:auto">
          <table><thead><tr><th>Bulan</th><th>Jersey Terjual</th><th>Omzet Bersih</th><th>Net / Jersey</th></tr></thead><tbody>${histRows}</tbody></table>
        </div>
      </div>
      <div class="card">
        <h2>🏆 Top 8 Jersey Terlaris (${esc(latest.ym)})</h2>
        <div class="kpi-sub mb-8">Klik nama pemain untuk melihat profil &amp; kontraknya. Hindari menjual idola #1 tanpa pengganti agar tidak terkena <i>Idol Shop Drop</i>!</div>
        ${leaderHtml}
      </div>
    </div>`;
}
