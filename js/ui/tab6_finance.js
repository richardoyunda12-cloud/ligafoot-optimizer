// ==================== RENDER TAB 5: KEUANGAN, TIKET, SHOP & STADION (v8.2.4) ====================
const MONTH_ID_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function fmtYmShort(ym) {
  const s = String(ym || '');
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return s.slice(-5);
  const moIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
  return `${MONTH_ID_SHORT[moIdx]} '${m[1].slice(2)}`;
}

function getSaveTicketPrices(kind = simCompKind) {
  const bp = (typeof getSimBasePrices === 'function')
    ? getSimBasePrices(kind)
    : ((D.stadium && D.stadium.basePrices) || { geral: 10, arquibancada: 15, cadeiras: 25, camarotes: 80 });
  const cm = (D.stadium && D.stadium.curMul) || { geral: 1, arquibancada: 1, cadeiras: 1, camarotes: 1 };
  return {
    geral: Math.max(1, Math.round(bp.geral * (cm.geral ?? 1))),
    arquibancada: Math.max(1, Math.round(bp.arquibancada * (cm.arquibancada ?? 1))),
    cadeiras: Math.max(1, Math.round(bp.cadeiras * (cm.cadeiras ?? 1))),
    camarotes: Math.max(1, Math.round(bp.camarotes * (cm.camarotes ?? 1))),
  };
}

function renderTab6() {
  const sh = D.shop || {};
  const mb = D.member || {};

  // 1. Sub-Tab 5A: Rincian Arus Kas + Bar Visual + Rasio Gaji/Income + Hutang & Runway
  const cfEl = document.getElementById('t6-cashflow-detail');
  if (cfEl && D.cashflow && D.cashflow.estBreakdown) {
    const b = D.cashflow.estBreakdown;
    const cf = D.cashflow;
    const inc = Math.max(0, Number(cf.estCurrentIncome) || 0);
    const exp = Math.max(0, Number(cf.estCurrentExpense) || 0);
    const net = Number(cf.estCurrentNet) || (inc - exp);
    const totBar = Math.max(1, inc + exp);
    const inPct = Math.round((inc / totBar) * 100);
    const outPct = 100 - inPct;
    const wageRatio = inc > 0 ? Math.round((b.payroll / inc) * 100) : 999;
    const wageCls = wageRatio <= 65 ? 'b-good' : (wageRatio <= 85 ? 'b-warn' : 'b-crit');
    const wageLbl = wageRatio <= 65 ? 'Sehat' : (wageRatio <= 85 ? 'Wajar' : 'Ketat');
    const loan = Number(D.meta.bankLoan) || 0;
    const tdParcel = Number(b.transferDebtParcel) || 0;
    const tdTotal = Number(cf.transferDebtTotal) || 0;
    const debtCap = cf.transferDebtCap ?? Math.max(500000, Math.round(((D.meta && D.meta.payroll) || 0) * 12 * 0.30));
    const debtRoom = cf.transferDebtRoom ?? Math.max(0, debtCap - tdTotal);
    const debtBanned = Boolean(cf.transferBanned || (D.meta && D.meta.transferBanned));
    const runwayTxt = net >= 0
      ? '<span class="c-green"><b>Surplus ✓</b></span>'
      : `<span class="c-amber"><b>~${Math.max(0, Math.floor((D.meta.budget || 0) / Math.max(1, Math.abs(net))))} bln</b></span>`;

    cfEl.innerHTML = `
      <div class="cf-health-strip mono">
        <span>Gaji/Income: <span class="badge ${wageCls}">${wageRatio}% (${wageLbl})</span></span>
        <span>Hutang Bank: <b class="${loan > 0 ? 'c-red' : 'c-green'}">${fmtM(loan)}</b></span>
        <span>Plafon Cicilan: <span id="t6-debt-room-badge" class="badge ${debtBanned ? 'b-crit' : (debtRoom > 0 ? 'b-info' : 'b-warn')} mono">${debtBanned ? '⛔ BAN' : `Sisa ${fmtM(debtRoom)} / ${fmtM(debtCap)}`}</span></span>
        ${tdTotal > 0 ? `<span>Cicilan Aktif: <b class="c-amber">${fmtM(tdTotal)}</b> (${fmtM(tdParcel)}/bln)</span>` : ''}
        <span>Runway: ${runwayTxt}</span>
      </div>
      <div class="flex-between mono" style="font-size:11px">
        <span class="c-green">Masuk +${fmtM(inc)}</span>
        <span class="${net >= 0 ? 'c-green' : 'c-amber'}"><b>Net ${net >= 0 ? '+' : ''}${fmtM(net)}/bln</b></span>
        <span class="c-amber">Keluar -${fmtM(exp)}</span>
      </div>
      <div class="cf-ratio-bar">
        <div class="cf-ratio-in" style="width:${inPct}%"></div>
        <div class="cf-ratio-out" style="width:${outPct}%"></div>
      </div>
      <div class="grid g2" style="gap:8px">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:8px 9px;font-size:11.5px">
          <div class="c-green" style="font-weight:700;margin-bottom:4px">📥 Pemasukan Rutin</div>
          <div class="mono">• Tiket Kandang: <b>${fmtM(b.tickets)}</b></div>
          <div class="mono">• Hak Siar TV: <b>${fmtM(b.tv)}</b></div>
          <div class="mono">• Sponsor Tetap: <b>${fmtM(b.fixedSponsor ?? b.sponsors)}</b></div>
          ${b.varSponsor ? `<div class="mono">• Sponsor Bulanan: <b>${fmtM(b.varSponsor)}</b></div>` : ''}
          <div class="mono">• Naming Rights (/12): <b>${fmtM(b.naming)}</b></div>
          <div class="mono">• Iuran Member: <b>${fmtM(b.members)}</b></div>
          <div class="mono">• Club Shop: <b>${fmtM(b.shop)}</b></div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:8px 9px;font-size:11.5px">
          <div class="c-amber" style="font-weight:700;margin-bottom:4px">📤 Pengeluaran Rutin</div>
          <div class="mono">• Gaji Senior: <b>${fmtM(b.seniorPayroll ?? b.payroll)}</b></div>
          ${b.youthPayroll ? `<div class="mono">• Gaji Akademi: <b>${fmtM(b.youthPayroll)}</b></div>` : ''}
          <div class="mono">• Ops Stadion (&gt;20K): <b>${fmtM(b.stadiumOps)}</b></div>
          <div class="mono">• Maint. CT: <b>${fmtM(b.ctCost || 0)}</b></div>
          <div class="mono">• Pelatih Akademi: <b>${fmtM(b.youthCost || 0)}</b></div>
          ${b.bankLoanParcel ? `<div class="mono">• Cicilan Bank: <b>${fmtM(b.bankLoanParcel)}</b></div>` : ''}
          ${b.transferDebtParcel ? `<div class="mono c-amber">• Cicilan Transfer: <b>${fmtM(b.transferDebtParcel)}</b></div>` : ''}
          <div class="c-muted" style="font-size:10.5px;margin-top:6px;padding-top:5px;border-top:1px solid var(--border)">
            Sponsor Jersey <i>Upfront (Luvas)</i> sudah cair di awal musim &amp; tidak dihitung ganda.
          </div>
        </div>
      </div>
      ${(() => {
        const bud = (D.meta && D.meta.budget) || 0;
        const maxBuyByCap24 = debtBanned ? 0 : (cf.transferDebtMaxBuy24 ?? Math.floor(debtRoom / (0.75 * 1.18)));
        const safeMo = Math.max(0, Math.round(net * 0.70));
        const maxBuyByCash24 = Math.floor((safeMo * 24) / (0.75 * 1.18));
        const effMaxBuy24 = Math.min(maxBuyByCap24, maxBuyByCash24);
        const dp25Cap = Math.round(effMaxBuy24 * 0.25);
        const ctLv = (D.meta && D.meta.ctLevel) || 1;
        const ctNext = D.ctUpgrade || null;
        let invTip = 'Kas sehat — prioritaskan Bosman 0€ atau cicilan DP 25% untuk upgrade titik lemah XI.';
        if (debtBanned) {
          invTip = 'Klub sedang terkena Transfer Ban — cicilan transfer diblokir sementara.';
        } else if (ctLv < 9 && ctNext && ctNext.cost && bud >= ctNext.cost * 1.1) {
          invTip = `Rekomendasi: CT Lv ${ctLv} → ${ctLv + 1} (${fmtM(ctNext.cost)}) untuk tambah slot/bonus jangka panjang.`;
        } else if (safeMo <= 0) {
          invTip = 'Surplus bulanan tipis/negatif — fokus jual pemain berlebih & optimasi tiket/sponsor dulu sebelum cicil pemain.';
        }
        return `<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border:1px solid rgba(56,189,248,.35);border-radius:9px;font-size:11.5px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
            <b class="c-sky" title="Plafon Utang Cicilan Game (#21652): max(500K, 30% gaji tahunan)">💳 Plafon Utang Cicilan &amp; Cap Aman Cashflow</b>
            <span class="badge ${debtBanned ? 'b-crit' : (debtRoom > 0 && safeMo > 0 ? 'b-info' : 'b-warn')} mono">${debtBanned ? '⛔ BAN' : `Sisa Plafon: ${fmtM(debtRoom)}`}</span>
          </div>
          <div class="mono c-muted" style="font-size:11px">
            Plafon utang game (30% gaji tahunan, min 500K): <b>${fmtM(debtRoom)}</b> / ${fmtM(debtCap)}${tdTotal > 0 ? ` (terpakai ${fmtM(tdTotal)})` : ''} · Maks beli 24b: <b class="c-green">${fmtM(maxBuyByCap24)}</b>${safeMo > 0 ? ` (Aman cashflow ${fmtM(safeMo)}/bln → <b class="c-sky">${fmtM(effMaxBuy24)}</b>, DP 25%: <b>${fmtM(dp25Cap)}</b> vs Kas <b>${fmtM(bud)}</b>)` : ''}
          </div>
          <div class="c-muted" style="font-size:10.5px;margin-top:3px">Bunga OTA: 6b +3% · 12b +8% · 24b +18%. ${esc(invTip)}</div>
        </div>`;
      })()}`;
  }

  // 2. Kartu Club Shop, Member Plans & Komersial
  document.getElementById('t6-shop').innerHTML = `
    <div class="mb-8">Harga Kini: <b class="mono">${(sh.cur_m || 1).toFixed(2)}x</b> (Demand <b class="mono">${((sh.cur_pf || 1) * 100).toFixed(1)}%</b> • ${String(sh.cur_word || 'optimal').toUpperCase()})</div>
    <div class="mb-8">Optimal v1.2.0: <span class="badge b-good">1.00x (Puncak Mutlak!)</span> ${sh.is_optimal ? '<span class="c-green">✓ Optimal</span>' : `<span class="c-amber">+${sh.gain_pct}%</span>`}</div>
    <div class="c-muted mb-8">Bonus Bintang: <b>+${sh.star_bonus_pct || 0}%</b> (${sh.star_cnt || 0} star, ${sh.top_cnt || 0} top) | Hype (#19856): <b class="c-green">+${sh.hype_bonus_pct || 0}%</b></div>
    ${(sh.mega_signings || []).length ? `<div class="badge b-accent mb-8">🔥 MEGA (≥${fmtM(sh.mega_threshold)}): ${sh.mega_signings.map(x => esc(x.name) + ' ' + x.daysLeft + 'd').join(', ')}</div>` : ''}
    ${(sh.big_signings || []).length ? `<div class="badge b-info mb-8">⚡ BIG (+8% ≥${fmtM(sh.big_threshold)}): ${sh.big_signings.map(x => esc(x.name) + ' ' + x.daysLeft + 'd').join(', ')}</div>` : ''}
    <div class="flex-between"><span class="c-muted">Bulan Lalu: <b class="mono c-green">${fmtM(sh.last_rev)}</b> (${(sh.last_shirts || 0).toLocaleString('id-ID')} jrs)</span><button type="button" class="btn btn-sm" onclick="goToView('t5','t5-shop')">Grafik &amp; Top 8 →</button></div>`;

  document.getElementById('t6-member').innerHTML = `
    <div class="mb-8">Basis Member: <b class="mono">${(mb.n || 0).toLocaleString('id-ID')}</b> (Cap <b class="mono">${(mb.cap || 60000).toLocaleString('id-ID')}</b> • Bayar <b class="mono c-sky">${(mb.cur_paying || mb.n || 0).toLocaleString('id-ID')}</b>)</div>
    <div class="mb-8">Setelan Kini: <b class="mono">${(mb.cur_m || 1).toFixed(2)}x</b> • Diskon <b class="mono">${mb.cur_d || 0}%</b> → <b class="mono c-green">${fmtM(mb.cur_parcel || 0)}/bln</b></div>
    <div class="mb-8">Optimal v1.2.0 (#21255): <span class="badge b-good">${(mb.opt_m || 1.05).toFixed(2)}x + Diskon ${mb.opt_d ?? 6}%</span> ${mb.is_optimal ? '<span class="c-green">✓ Optimal</span>' : `<span class="c-amber">+${mb.gain_pct}% (${fmtM(mb.opt_parcel || 0)}/bln)</span>`}</div>
    <div class="c-muted">Puncak <code>memberDemand × memberNet</code> di <b>${(mb.opt_m || 1.05).toFixed(2)}x / Diskon ${mb.opt_d ?? 6}%</b> (Indeks ${(mb.opt_yield || 101.14).toFixed(2)}%, ${(mb.opt_paying || 0).toLocaleString('id-ID')} anggota membayar).</div>`;

  const nm = D.naming;
  const needSponsorCalc = (D.sponsors || []).length < 3 || !nm || (nm.monthsLeft <= 3);
  const nmHtml = nm
    ? `<div><b>Naming Rights:</b> ${esc(nm.name)} (${fmtM(nm.yearly)}/thn, sisa <b class="${nm.monthsLeft <= 3 ? 'c-red' : 'c-green'}">${nm.monthsLeft} bln</b>) — <i>Wajib 1 Thn (1.15x)</i></div>`
    : `<div class="c-red"><b>Naming Rights:</b> KOSONG — segera kontrak 1 Tahun (1.15x)!</div>`;
  const slotMap = { master: 'Utama', material: 'Apparel', secundario: 'Sekunder', secondary: 'Sekunder' };
  const spHtml = (D.sponsors && D.sponsors.length)
    ? D.sponsors.map(s => {
        const sLbl = slotMap[(s.slot || '').toLowerCase()] || s.slot || 'Sponsor';
        const rem = (s.monthsLeft ?? s.paymentsLeft ?? s.months ?? '?');
        const mo = Number(s.monthly) || 0;
        const luv = Number(s.luvas) || 0;
        const dur = Math.max(1, Number(s.months) || 12);
        const valTxt = (mo > 0)
          ? `${fmtM(mo)}/bln${luv > 0 ? ' + DP ' + fmtM(luv) : ''}`
          : (luv > 0 ? `Dimuka ${fmtM(luv)} (~${fmtM(luv / dur)}/bln)` : 'Aktif');
        return `<div>• <b>${esc(sLbl)}:</b> ${esc(s.company || '-')} (${valTxt}, ${rem} bln)</div>`;
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
    if (items.length) pgHtml = '<div class="mt-12"><b>🎯 Target Presiden (M' + (pg.season || D.meta.season) + '):</b>' + items.join('') + '</div>';
  }
  const calcBtnHtml = needSponsorCalc
    ? `<div class="mt-12"><button type="button" class="btn btn-sm btn-green" onclick="goToView('t6','t6-calc')">🤝 Buka Kalkulator Sponsor →</button></div>`
    : '';
  document.getElementById('t6-commercial').innerHTML = nmHtml + '<div class="mt-12"><b>Sponsor Jersey (' + (D.sponsors || []).length + '/3):</b>' + spHtml + '</div>' + pgHtml + calcBtnHtml;

  renderTicketSim();
  renderTicketPresetAudit();
  renderCashflowCalendar12m();
  renderCashChartAndRoi();
  renderShopAnalytics();
  renderCrowdHistoryAndStmt();
}

// ==================== AUDIT TICKET PRESETS & KALENDER CASHFLOW 12 BLN (TIER 2 #6) ====================
function loadSavedPresetToSim(presetIdx) {
  const pa = D.stadium && D.stadium.presetAudit;
  const p = pa && Array.isArray(pa.presets) ? pa.presets[presetIdx] : null;
  if (!p || !p.mul) return;
  const bp = getSimBasePrices(simCompKind);
  simPrices = {
    geral: Math.max(1, Math.round(bp.geral * (p.mul.geral ?? 1))),
    arquibancada: Math.max(1, Math.round(bp.arquibancada * (p.mul.arquibancada ?? 1))),
    cadeiras: Math.max(1, Math.round(bp.cadeiras * (p.mul.cadeiras ?? 1))),
    camarotes: Math.max(1, Math.round(bp.camarotes * (p.mul.camarotes ?? 1))),
  };
  renderTicketSim();
  showToast(`Preset "${p.name}" dimuat ke Simulator Tiket!`);
}

function renderTicketPresetAudit() {
  const el = document.getElementById('t6-preset-audit');
  if (!el) return;
  const pa = (D.stadium && D.stadium.presetAudit) || null;
  if (!pa || !Array.isArray(pa.presets) || !pa.presets.length) {
    el.innerHTML = '';
    return;
  }

  const alertsHtml = []
    .concat(pa.summaryAlert ? [`<div class="alert-item HIGH mb-8"><span class="badge b-warn">PRESET AKTIF</span><div>${esc(pa.summaryAlert)}</div></div>`] : [])
    .concat(pa.runinAlert ? [`<div class="alert-item HIGH mb-8"><span class="badge b-warn">RUN-IN</span><div>${esc(pa.runinAlert)}</div></div>`] : [])
    .join('');

  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
        <div>
          <b>🏷️ Audit Preset Tiket Tersimpan (<code>save.ticketPresets</code>)</b>
          <span class="c-muted" style="font-size:10.5px">(Aktif di save: <b>${esc(pa.activePresetName || '-')}</b>)</span>
        </div>
        ${pa.bestLigaPresetName ? `<span class="badge b-good">Rekomendasi Liga: ${esc(pa.bestLigaPresetName)}</span>` : ''}
      </div>
      ${alertsHtml}
      <div class="tbl-wrap tbl-sticky">
        <table>
          <thead><tr>
            <th>Preset</th>
            <th class="col-hide-mob">Multiplier</th>
            <th>Liga (Fill · Gate)</th>
            <th class="col-hide-mob">Big Match</th>
            <th>Status</th>
            <th>Tes</th>
          </tr></thead>
          <tbody>${pa.presets.map((pr, idx) => `
            <tr class="${pr.isActive ? 'hl-user' : ''}">
              <td>
                <b>${esc(pr.name)}</b>
                ${pr.isActive ? ' <span class="badge b-accent">AKTIF</span>' : ''}
              </td>
              <td class="mono col-hide-mob">${esc(pr.mulSummary)}</td>
              <td class="mono">
                <b class="${pr.ligaFillPct >= 70 ? 'c-green' : 'c-red'}">${pr.ligaFillPct}%</b> · ${fmtM(pr.ligaRev)}
                ${pr.ligaLoss > 5000 ? `<div class="c-amber" style="font-size:10px">-${fmtM(pr.ligaLoss)} vs opt</div>` : ''}
              </td>
              <td class="mono col-hide-mob">
                <b class="${pr.bigFillPct >= 70 ? 'c-green' : 'c-amber'}">${pr.bigFillPct}%</b> · ${fmtM(pr.bigRev)}
              </td>
              <td><span class="badge ${esc(pr.badgeCls)}">${esc(pr.verdict)}</span></td>
              <td><button type="button" class="btn btn-sm" onclick="loadSavedPresetToSim(${idx})">Tes</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

let calRangeMode = (typeof window !== 'undefined' && window.innerWidth <= 768) ? '4m' : '12m';

function setCalRangeMode(m) {
  calRangeMode = m === '4m' ? '4m' : '12m';
  renderCashflowCalendar12m();
}

function renderCashflowCalendar12m() {
  const el = document.getElementById('t6-calendar-12m');
  const sumEl = document.getElementById('t6-cal-summary');
  if (!el) return;
  const cal = D.cashflowCalendar || null;
  if (!cal || !Array.isArray(cal.months) || !cal.months.length) {
    el.innerHTML = '<div class="c-muted">Data proyeksi 12 bulan tidak tersedia.</div>';
    return;
  }

  if (sumEl) {
    sumEl.innerHTML =
      `Kas Kini <b class="c-sky">${fmtM(cal.startBudget)}</b> → 12 Bln <b class="${cal.endBudget12m >= cal.startBudget ? 'c-green' : 'c-amber'}">${fmtM(cal.endBudget12m)}</b> · ` +
      `Sponsor/Naming: <b>${cal.commercialEventsCount}</b> · Golden -12%: <b class="c-green">${cal.goldenQueueCount}</b>`;
  }

  const visMonths = (calRangeMode === '4m' && cal.months.length > 4) ? cal.months.slice(0, 4) : cal.months;

  el.innerHTML = `
    <div class="flex-between mb-8" style="gap:6px;flex-wrap:wrap">
      <div class="t3-seg-2">
        <button type="button" class="btn btn-sm ${calRangeMode === '4m' ? 'btn-green' : ''}" onclick="setCalRangeMode('4m')">4 Bln Terdekat</button>
        <button type="button" class="btn btn-sm ${calRangeMode === '12m' ? 'btn-green' : ''}" onclick="setCalRangeMode('12m')">12 Bln Penuh</button>
      </div>
      <span class="c-muted mono" style="font-size:10.5px">Menampilkan ${visMonths.length}/${cal.months.length} bulan</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px">
      ${visMonths.map(m => {
        const hasComm = m.events.some(e => e.type === 'SPONSOR' || e.type === 'NAMING');
        const hasCrit = m.events.some(e => e.sev === 'CRITICAL' || e.sev === 'HIGH');
        const borderCol = hasCrit ? 'rgba(245,158,11,.55)' : (hasComm ? 'rgba(56,189,248,.45)' : 'var(--border)');
        const evHtml = m.events.map(ev => {
          const bCls = ev.sev === 'CRITICAL' ? 'b-crit' : (ev.sev === 'HIGH' ? 'b-warn' : (ev.sev === 'GOOD' ? 'b-good' : 'b-info'));
          return `<div style="margin-top:4px;font-size:10.5px;line-height:1.35">
            <span class="badge ${bCls}">${esc(ev.type)}</span> <b>${esc(ev.title)}</b>
            <div class="c-muted">${esc(ev.detail)}</div>
          </div>`;
        }).join('');

        const gPills = (m.goldenPlayers || []).slice(0, 3).map(gp =>
          `<span class="tl-pill" onclick="openPlayerDrawer('${gp.kind === 'bteam' ? 'bteam' : 'roster'}','${escJs(gp.id)}')"><b>${esc(gp.name)}</b> <span class="mono">${gp.contractDays}d${gp.kind === 'bteam' ? '·B' : ''}</span></span>`
        ).join('');

        return `<div style="background:var(--bg2);border:1px solid ${borderCol};border-radius:9px;padding:8px 10px">
          <div class="flex-between" style="border-bottom:1px dashed var(--border);padding-bottom:4px;margin-bottom:4px">
            <b class="mono">${esc(m.label)}</b>
            <span class="mono ${m.projBudget >= 0 ? 'c-green' : 'c-red'}" style="font-size:11.5px"><b>${fmtM(m.projBudget)}</b></span>
          </div>
          ${evHtml || '<div class="c-muted" style="font-size:10.5px">Operasional rutin ✓</div>'}
          ${gPills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${gPills}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

// ==================== SUB-TAB 5B: SIMULATOR TIKET & 6 FASE ====================
const SIM_COMP_LABELS = {
  league: 'Liga Utama',
  continental2: 'Kontinental 2 (AFC2 / UEL)',
  continental1: 'Kontinental 1 (AFC Elite / UCL)',
  cup: 'Piala Domestik (Copa)',
};

function setSimCompKind(kind, keepPrices = false) {
  simCompKind = kind || 'league';
  const sel = document.getElementById('sim-comp-kind');
  if (sel && sel.value !== simCompKind) sel.value = simCompKind;
  if (!keepPrices) {
    simPrices = optimalPricesJS(simMode === 'big', simCompKind);
  }
  renderTicketSim();
}

function setSimMode(mode) {
  simMode = mode;
  const bn = document.getElementById('sim-mode-normal');
  const bb = document.getElementById('sim-mode-big');
  if (bn) bn.className = mode === 'normal' ? 'btn btn-sm btn-green' : 'btn btn-sm';
  if (bb) bb.className = mode === 'big' ? 'btn btn-sm btn-amber' : 'btn btn-sm';
  renderTicketSim();
}

function stepSimPrice(sec, delta) {
  const bp = getSimBasePrices(simCompKind)[sec];
  const lo = Math.max(1, Math.round(bp * 0.5)), hi = Math.round(bp * 2.0);
  simPrices[sec] = Math.max(lo, Math.min(hi, simPrices[sec] + delta));
  renderTicketSim();
}

function applyOptimalTicketJS() {
  simPrices = optimalPricesJS(simMode === 'big', simCompKind);
  renderTicketSim();
  showToast(`Harga tiket optimal (${SIM_COMP_LABELS[simCompKind] || 'Liga'}) diterapkan!`);
}

function resetSimToSavePrices() {
  simPrices = getSaveTicketPrices(simCompKind);
  renderTicketSim();
  showToast('Harga tiket dikembalikan ke setelan Save saat ini');
}

function applyPhaseToSim(phaseKey) {
  const byKind = (D.stadium && D.stadium.phasesByKind && D.stadium.phasesByKind[simCompKind]) || D.stadium.phases || [];
  const row = byKind.find(r => r.phase === phaseKey);
  if (!row) return;
  simPrices = { ...row.optPrices };
  simMode = phaseKey === 'normal' ? 'normal' : 'big';
  setSimMode(simMode);
  showToast(`Preset fase ${row.label} (${SIM_COMP_LABELS[simCompKind] || 'Liga'}) dimuat!`);
}

function renderTicketSim() {
  const sel = document.getElementById('sim-comp-kind');
  if (sel && sel.value !== simCompKind) sel.value = simCompKind;
  const big = simMode === 'big';
  const sim = simulateStadiumJS(simPrices, big, simCompKind);
  const saveP = getSaveTicketPrices(simCompKind);
  const saveSim = simulateStadiumJS(saveP, big, simCompKind);
  const deltaRev = Math.round(sim.totRev - saveSim.totRev);
  const labels = { geral: 'General', arquibancada: 'Stands', cadeiras: 'Seats', camarotes: 'Boxes (VIP)' };
  const compLbl = SIM_COMP_LABELS[simCompKind] || 'Liga Utama';

  document.getElementById('t6-ticket-sim').innerHTML = ['geral', 'arquibancada', 'cadeiras', 'camarotes'].map(s => {
    const sd = sim.sectors[s];
    const svP = saveP[s];
    const isDiff = Math.abs(sd.p - svP) >= 1;
    const step = sd.bp >= 50 ? 5 : 1;
    return `<div class="sim-sec-card ${isDiff ? 'diff-save' : ''}">
      <div class="flex-between"><b style="font-size:12px">${labels[s]}</b><span class="c-muted mono" style="font-size:10px">${sd.cap.toLocaleString('id-ID')} • List ${sd.bp}</span></div>
      <div class="flex-between mt-12">
        <button type="button" class="btn btn-sm" onclick="stepSimPrice('${s}', -${step})">-</button>
        <div style="text-align:center">
          <span class="mono ${isDiff ? 'c-amber' : 'c-green'}" style="font-size:19px;font-weight:800">${sd.p}</span>
          <div class="mono c-muted" style="font-size:10px">${isDiff ? `kini ${svP} → ${sd.p}` : `✓ save (${svP})`}</div>
        </div>
        <button type="button" class="btn btn-sm" onclick="stepSimPrice('${s}', ${step})">+</button>
      </div>
      <div class="mono c-muted mt-12" style="font-size:11px;text-align:center">${sd.mul.toFixed(2)}x • Fill <b>${sd.fillPct}%</b> • <b class="c-green">${fmtM(sd.rev)}</b></div>
    </div>`;
  }).join('');

  const vsSaveHtml = deltaRev === 0
    ? '<span class="badge b-muted">Sama dgn Save</span>'
    : `<span class="badge ${deltaRev > 0 ? 'b-good' : 'b-crit'} mono">vs Save: ${deltaRev > 0 ? '+' : ''}${fmtM(deltaRev)}/laga</span>`;

  document.getElementById('t6-ticket-res').innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px 11px">
      <div>
        <span class="badge b-info" style="margin-right:6px">${esc(compLbl)}</span>
        Total Penonton: <b class="mono">${sim.totAtt.toLocaleString('id-ID')} / ${D.stadium.totalSeats.toLocaleString('id-ID')}</b>
        (<b class="${sim.crowdFull ? 'c-green' : 'c-red'} mono">${sim.fillPct}%</b> ${sim.crowdFull ? '✓ Bonus +2% Tengah AKTIF' : '⚠ <70% Bonus Tengah HILANG!'})
      </div>
      <div style="margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:8px">
        <span>Est. Gate: <b class="mono c-green" style="font-size:14px">${fmtM(sim.totRev)}</b></span>
        ${vsSaveHtml}
        <span class="c-muted" style="font-size:11px">Tarif kompetisi mengikuti bytecode #19815 (Kontinental/Copa punya harga dasar tersendiri!).</span>
      </div>
    </div>`;

  // Tabel 6 Fase ticketMulBy sesuai kompetisi aktif (#19815 + #24024 R16/QF = isBigMatch!)
  const phases = (D.stadium && D.stadium.phasesByKind && D.stadium.phasesByKind[simCompKind]) || D.stadium.phases || [];
  if (phases.length) {
    const bpShow = phases[0].basePrices || getSimBasePrices(simCompKind);
    document.getElementById('t6-tmb').innerHTML = `
      <div class="mb-8"><b>📋 Preset Siap Salin — 6 Fase Resmi <code>ticketMulBy</code> (${esc(compLbl)} • Base ${bpShow.geral}·${bpShow.arquibancada}·${bpShow.cadeiras}·${bpShow.camarotes}):</b></div>
      <div class="tbl-wrap tbl-sticky"><table>
        <thead><tr>
          <th>Fase &amp; Harga + Multiplier Optimal</th><th class="col-hide-mob">Status</th><th class="col-hide-mob">Harga Kini</th><th class="col-hide-mob">Fill</th><th>Est. Gate</th><th>Potensi +</th><th class="col-desk-only">Aksi</th>
        </tr></thead>
        <tbody>${phases.map(r => {
          const cp = r.curPrices, op = r.optPrices, om = r.optMuls || {};
          const curStr = `${cp.geral}·${cp.arquibancada}·${cp.cadeiras}·${cp.camarotes}`;
          const optStr = `${op.geral} · ${op.arquibancada} · ${op.cadeiras} · ${op.camarotes}`;
          const optCompact = `${op.geral}·${op.arquibancada}·${op.cadeiras}·${op.camarotes}`;
          const mulStr = `${Number(om.geral || 1).toFixed(2)}x · ${Number(om.arquibancada || 1).toFixed(2)}x · ${Number(om.cadeiras || 1).toFixed(2)}x · ${Number(om.camarotes || 1).toFixed(2)}x`;
          return `<tr>
            <td>
              <div><b>${esc(r.label)}</b> <span class="badge ${r.fillPct >= 70 ? 'b-good' : 'b-crit'} mono">${r.fillPct}%</span></div>
              <div class="mono c-green" style="font-size:11px;margin-top:2px"><b>${optCompact}</b> <span class="c-muted">(${mulStr})</span></div>
              <div class="sticky-inline-acts">
                <button type="button" class="btn btn-sm" onclick="copyText('${optStr}','Preset ${escJs(r.label)}')">📋 Salin</button>
                <button type="button" class="btn btn-sm" onclick="applyPhaseToSim('${r.phase}')">Muat</button>
              </div>
            </td>
            <td class="col-hide-mob"><span class="badge ${r.isCustom ? 'b-info' : 'b-muted'}">${r.isCustom ? 'Custom' : 'Default'}</span></td>
            <td class="mono c-muted col-hide-mob">${curStr}</td>
            <td class="mono col-hide-mob ${r.fillPct >= 70 ? 'c-green' : 'c-red'}">${r.fillPct}%</td>
            <td class="mono">${fmtM(r.estRev)}</td>
            <td class="mono ${r.revGain > 5000 ? 'c-amber' : 'c-green'}">${r.revGain > 0 ? '+' + fmtM(r.revGain) : '✓ Pas'}</td>
            <td class="col-desk-only">
              <button type="button" class="btn btn-sm" onclick="copyText('${optStr}','Preset ${escJs(r.label)}')">📋</button>
              <button type="button" class="btn btn-sm" onclick="applyPhaseToSim('${r.phase}')">Muat</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }
}

// ==================== SUB-TAB 5A GRAFIK KAS v2 & SUB-TAB 5D STADION + ROI INTERAKTIF ====================
function calcStadiumRoiSim() {
  const secEl = document.getElementById('roi-sec');
  const seatsEl = document.getElementById('roi-seats');
  const costEl = document.getElementById('roi-cost');
  const gamesEl = document.getElementById('roi-games');
  const outEl = document.getElementById('roi-calc-out');
  if (!secEl || !outEl) return;

  const sec = secEl.value || 'camarotes';
  const addSeats = Math.max(10, parseInt(seatsEl.value, 10) || 100);
  const gamesYr = Math.max(1, parseInt(gamesEl.value, 10) || 22);
  const secs = (D.stadium && D.stadium.sections) || { geral: 6000, arquibancada: 13000, cadeiras: 900, camarotes: 100 };

  let tierCost = 0;
  let deltaRevMatch = 0;
  let deltaOpsMonth = 0;
  let newFillPct = 0;

  if (window.LFEngine && LFEngine.economy && typeof LFEngine.economy.calcStadiumRoi === 'function') {
    const opts = {
      homeRepLvl: (D.meta && D.meta.repLevel) !== undefined ? D.meta.repLevel : 3,
      country: (D.meta && D.meta.country) || 'OTHER',
      kind: 'league',
    };
    const roi = LFEngine.economy.calcStadiumRoi(
      secs, { [sec]: addSeats }, (D.meta && D.meta.fanConf) || 80,
      (D.meta && D.meta.division) || 1, gamesYr, opts
    );
    tierCost = roi.buildCost;
    deltaRevMatch = roi.deltaRevPerMatch;
    deltaOpsMonth = roi.deltaOpsMonth;
    newFillPct = roi.newFillPct;
  }

  const userCostM = parseFloat(costEl && costEl.value);
  const costVal = (!isNaN(userCostM) && userCostM > 0) ? (userCostM * 1_000_000) : Math.max(100000, tierCost);
  const opsAddYr = deltaOpsMonth * 12;
  const grossYr = Math.round(deltaRevMatch * gamesYr);
  const netYr = grossYr - opsAddYr;
  const netPerGame = netYr / gamesYr;
  const paybackGames = netPerGame > 0 ? Math.ceil(costVal / netPerGame) : 9999;
  const paybackSeasons = netYr > 0 ? (costVal / netYr).toFixed(1) : '∞';
  const roiPctYr = costVal > 0 ? Math.round((netYr / costVal) * 100) : 0;
  const saturatedWarn = deltaRevMatch <= 0
    ? `<div class="c-red" style="margin-top:4px"><b>⚠️ Peringatan Permintaan (#19915):</b> Sektor ini sudah melampaui <code>BASE_ATTENDANCE</code> di reputasi klub saat ini — kursi baru belum terisi penuh di laga liga normal!</div>`
    : '';

  outEl.innerHTML = `
    <div class="roi-res-grid mono">
      <div>
        <div class="c-muted" style="font-size:10px">Net / Tahun</div>
        <div class="${netYr > 0 ? 'c-green' : 'c-red'}" style="font-size:15px;font-weight:800">${netYr >= 0 ? '+' : ''}${fmtM(netYr)}</div>
        <div class="c-muted" style="font-size:10px">ROI ${roiPctYr}%/thn</div>
      </div>
      <div>
        <div class="c-muted" style="font-size:10px">Balik Modal</div>
        <div class="c-sky" style="font-size:15px;font-weight:800">${paybackGames > 999 ? '∞' : paybackGames + ' laga'}</div>
        <div class="c-muted" style="font-size:10px">≈ ${paybackSeasons} musim</div>
      </div>
      <div>
        <div class="c-muted" style="font-size:10px">Tambahan Ops</div>
        <div class="c-amber" style="font-size:15px;font-weight:800">-${fmtM(opsAddYr)}</div>
        <div class="c-muted" style="font-size:10px">/tahun (>20K)</div>
      </div>
    </div>
    <div class="c-muted" style="font-size:11px">
      ΔGate Riil (#19915): <b class="mono ${deltaRevMatch > 0 ? 'c-green' : 'c-red'}">${deltaRevMatch >= 0 ? '+' : ''}${fmtM(deltaRevMatch)}/laga</b> × <b>${gamesYr}</b> laga = Gross <b class="mono">${fmtM(grossYr)}/thn</b> (Fill baru <b>${newFillPct}%</b> · Est. Biaya Tier: <b class="mono">${fmtM(tierCost)}</b>).
      ${saturatedWarn}
      <br/>💡 <b>Tip Engine:</b> Prioritaskan <b>Boxes VIP (camarotes)</b> &amp; <b>Seats (cadeiras)</b> karena margin tiket per kursi tertinggi dibanding biaya ops 35/kursi/bln.
    </div>`;
}

function onRoiSectorPreset() {
  const sec = (document.getElementById('roi-sec') || {}).value || 'camarotes';
  const seatsEl = document.getElementById('roi-seats');
  const costEl = document.getElementById('roi-cost');
  const defSeats = sec === 'camarotes' ? 100 : (sec === 'cadeiras' ? 500 : 2000);
  if (seatsEl) seatsEl.value = defSeats;
  if (costEl && window.LFEngine && LFEngine.economy && typeof LFEngine.economy.calcExpansionCost === 'function') {
    const secs = (D.stadium && D.stadium.sections) || {};
    const div = (D.meta && D.meta.division) || 1;
    const tc = LFEngine.economy.calcExpansionCost(sec, secs[sec] || 0, defSeats, div, true);
    costEl.value = Math.max(0.2, +(tc / 1_000_000).toFixed(2));
  }
  calcStadiumRoiSim();
}

function renderFacilityStatusCard() {
  const el = document.getElementById('t6-facility-status');
  if (!el) return;
  const secs = (D.stadium && D.stadium.sections) || { geral: 0, arquibancada: 0, cadeiras: 0, camarotes: 0 };
  const tot = Math.max(1, Number((D.stadium && D.stadium.totalSeats) || 0));
  const ops = Number((D.stadium && D.stadium.opsMonthly) || 0);
  const over20k = Math.max(0, tot - 20000);

  const items = [
    { k: 'geral', lbl: 'General', col: '#64748b', n: secs.geral || 0 },
    { k: 'arquibancada', lbl: 'Stands', col: '#38bdf8', n: secs.arquibancada || 0 },
    { k: 'cadeiras', lbl: 'Seats', col: '#10b981', n: secs.cadeiras || 0 },
    { k: 'camarotes', lbl: 'Boxes VIP', col: '#f59e0b', n: secs.camarotes || 0 },
  ];

  const barHtml = `<div class="stad-stack-bar">${items.map(it => {
    const pct = Math.max(it.n > 0 ? 1.5 : 0, (it.n / tot) * 100);
    return `<div style="width:${pct.toFixed(1)}%;background:${it.col}" title="${it.lbl}: ${it.n.toLocaleString('id-ID')} (${((it.n/tot)*100).toFixed(1)}%)"></div>`;
  }).join('')}</div>`;

  const legHtml = `<div class="stad-legend mono">${items.map(it => `
    <div class="stad-leg-box">
      <div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:${it.col};display:inline-block"></span><span class="c-muted">${it.lbl}</span></div>
      <div style="font-size:13px;font-weight:800;margin-top:2px">${it.n.toLocaleString('id-ID')}</div>
      <div class="c-muted" style="font-size:10px">${((it.n / tot) * 100).toFixed(1)}%</div>
    </div>`).join('')}</div>`;

  // Banner Proyek Upgrade CT Aktif (D.meta.ctWork) & Konstruksi Stadion (D.stadium.construction)
  let workHtml = '';
  const ctw = D.meta && D.meta.ctWork;
  if (ctw && typeof ctw === 'object' && ctw.to) {
    const nextSlots = 3 + Math.floor((Math.max(1, Math.min(10, Number(ctw.to))) - 1) / 2);
    const curSlots = 3 + Math.floor((Math.max(1, Math.min(10, Number(D.meta.ctLevel || 1))) - 1) / 2);
    const slotUnlock = nextSlots > curSlots ? ` • <b>Membuka Slot Latihan ke-${nextSlots}!</b>` : '';
    workHtml += `<div class="work-banner">
      <div><span class="badge b-info">🏗️ UPGRADE CT BERJALAN</span> <b>CT Lv ${D.meta.ctLevel} → Lv ${ctw.to}</b></div>
      <div class="c-muted" style="margin-top:4px;font-size:11.5px">
        Target selesai: <b class="mono c-green">${esc(ctw.endDate || '-')}</b> · Biaya proyek: <b class="mono">${fmtM(ctw.cost || 0)}</b>${slotUnlock}
      </div>
    </div>`;
  }
  const stWork = D.stadium && D.stadium.construction;
  if (stWork && typeof stWork === 'object') {
    workHtml += `<div class="work-banner">
      <div><span class="badge b-warn">🏗️ KONSTRUKSI STADION AKTIF</span></div>
      <div class="c-muted" style="margin-top:4px;font-size:11.5px">Selesai: <b class="mono">${esc(stWork.endDate || stWork.end || '-')}</b> · 12% kursi ditutup sementara selama pekerjaan.</div>
    </div>`;
  }

  const baseLv = ctw && ctw.to ? Number(ctw.to) : Number(D.meta.ctLevel || 1);
  const nextCt = Math.min(10, baseLv + 1);
  const msHit = (D.ctMilestones || []).find(x => (x.level || x[0]) >= nextCt);
  const nextCtDesc = msHit ? (msHit.perk || msHit[1]) : 'Fasilitas Kelas Dunia (Lv 10)';
  const curSlots = 3 + Math.floor((Math.max(1, Math.min(10, Number(D.meta.ctLevel || 1))) - 1) / 2);

  el.innerHTML = `
    <div class="flex-between mb-8">
      <div>Kapasitas Total: <b class="mono c-sky" style="font-size:15px">${tot.toLocaleString('id-ID')} kursi</b></div>
      <span class="badge ${ops > 0 ? 'b-warn' : 'b-good'} mono">Ops Stadion: ${fmtM(ops)}/bln ${over20k > 0 ? `(+${over20k.toLocaleString('id-ID')} >20K)` : '(Gratis ≤20K)'}</span>
    </div>
    ${barHtml}
    ${legHtml}
    ${workHtml}
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;font-size:11.5px">
      <div><b>CT Lv ${D.meta.ctLevel} (${curSlots} Slot Latihan):</b> ${ctw && ctw.to ? `Setelah Lv ${ctw.to}, target berikutnya` : 'Next Milestone'} <b>Lv ${nextCt}</b> → <span class="c-sky">${esc(nextCtDesc)}</span></div>
      <div class="c-muted" style="margin-top:4px">
        Maintenance CT: <b class="${D.meta.ctMaintOff ? 'c-red' : 'c-green'}">${D.meta.ctMaintOff ? 'MATI (NYALAKAN!)' : 'AKTIF ✓'}</b> (${D.meta.ctCond}%)
        · Youth Coach: <b class="${D.meta.youthCoach < 3 ? 'c-amber' : 'c-green'}">Lv ${D.meta.youthCoach}${D.meta.youthCoach < 3 ? ' (Naikkan ke Lv 3!)' : ' ✓'}</b>
        · Target Naming Max: <b class="mono">51.200</b> kursi
      </div>
    </div>`;
}

function renderCashChartAndRoi() {
  // 1. Grafik Tren Kas v2 (Area Fill + Label Tanggal Awal/Akhir + Delta Periode)
  const ch = D.cashHistory || [];
  const el = document.getElementById('t6-cash-chart');
  const titleEl = document.getElementById('t6-cash-chart-title');
  if (ch.length < 2) {
    if (el) el.innerHTML = '<div class="c-muted" style="font-size:12px">Data cashHistory belum cukup untuk grafik.</div>';
  } else {
    const vals = ch.map(x => Number(x.val) || 0);
    const firstV = vals[0], lastV = vals[vals.length - 1];
    const diffPeriod = lastV - firstV;
    if (titleEl) {
      titleEl.innerHTML = `<span>📈 Tren Kas Klub</span><span class="badge ${diffPeriod >= 0 ? 'b-good' : 'b-crit'} mono">${diffPeriod >= 0 ? '+' : ''}${fmtM(diffPeriod)} (${ch.length} titik)</span>`;
    }
    const mn = Math.min(...vals), mx = Math.max(...vals, mn + 1);
    const W = 520, H = 158, padL = 16, padR = 16, padT = 24, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const coords = ch.map((x, i) => {
      const px = padL + (i / (ch.length - 1)) * plotW;
      const py = padT + plotH - ((x.val - mn) / (mx - mn)) * plotH;
      return [px, py];
    });
    const linePts = coords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const areaPts = `${padL},${padT + plotH} ${linePts} ${(padL + plotW).toFixed(1)},${padT + plotH}`;
    const lastC = coords[coords.length - 1];
    const lblStart = ch[0].label || 'Awal';
    const lblEnd = ch[ch.length - 1].label || 'Kini';

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:158px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">
      <defs>
        <linearGradient id="lfCashAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points="${areaPts}" fill="url(#lfCashAreaGrad)" />
      <polyline fill="none" stroke="#10b981" stroke-width="2.6" points="${linePts}" />
      <circle cx="${lastC[0].toFixed(1)}" cy="${lastC[1].toFixed(1)}" r="4" fill="#6ee7b7" />
      <text x="12" y="16" fill="#8ea3bc" font-size="11">Max: ${fmtM(mx)}</text>
      <text x="${W - 12}" y="16" text-anchor="end" fill="#6ee7b7" font-size="11" font-weight="700">Kini: ${fmtM(lastV)}</text>
      <text x="12" y="${H - 7}" fill="#8ea3bc" font-size="11">${esc(lblStart)} (Min ${fmtM(mn)})</text>
      <text x="${W - 12}" y="${H - 7}" text-anchor="end" fill="#8ea3bc" font-size="11">${esc(lblEnd)}</text>
    </svg>`;
  }

  // 2. Render Status Stadion & Proyek CT + Kalkulator ROI Interaktif
  renderFacilityStatusCard();

  const roiEl = document.getElementById('t6-roi');
  if (roiEl) {
    roiEl.innerHTML = `
      <div class="roi-calc-grid">
        <label class="roi-calc-field">Sektor Ekspansi
          <select id="roi-sec" onchange="onRoiSectorPreset()">
            <option value="camarotes">Boxes VIP (List ${(D.stadium && D.stadium.basePrices ? D.stadium.basePrices.camarotes : 80)})</option>
            <option value="cadeiras">Seats (List ${(D.stadium && D.stadium.basePrices ? D.stadium.basePrices.cadeiras : 25)})</option>
            <option value="arquibancada">Stands (List ${(D.stadium && D.stadium.basePrices ? D.stadium.basePrices.arquibancada : 15)})</option>
          </select>
        </label>
        <label class="roi-calc-field">Tambahan Kursi
          <input id="roi-seats" class="input" type="number" min="10" step="50" value="100" oninput="calcStadiumRoiSim()" />
        </label>
        <label class="roi-calc-field">Est. Biaya di Game (Juta / M)
          <input id="roi-cost" class="input" type="number" min="0.1" step="0.1" value="2.6" oninput="calcStadiumRoiSim()" />
        </label>
        <label class="roi-calc-field">Laga Kandang / Musim
          <input id="roi-games" class="input" type="number" min="1" max="40" value="22" oninput="calcStadiumRoiSim()" />
        </label>
      </div>
      <div id="roi-calc-out"></div>`;
    calcStadiumRoiSim();
  }
}

function renderCrowdHistoryAndStmt() {
  const log = D.homeCrowdLog || [];
  const cap = Math.max(1, Number((D.stadium && D.stadium.totalSeats) || 20000));
  const kpiEl = document.getElementById('t6-crowd-kpis');
  if (kpiEl) {
    if (log.length) {
      const avgAtt = Math.round(log.reduce((s, x) => s + (x.att || 0), 0) / log.length);
      const avgFill = ((avgAtt / cap) * 100).toFixed(1);
      const avgRev = Math.round(log.reduce((s, x) => s + (x.rev || 0), 0) / log.length);
      kpiEl.innerHTML = `
        <div class="crowd-kpi-3">
          <div class="crowd-kpi-box"><div class="kpi-lbl">Avg Penonton</div><div class="kpi-val mono c-sky">${avgAtt.toLocaleString('id-ID')}</div></div>
          <div class="crowd-kpi-box"><div class="kpi-lbl">Avg Fill %</div><div class="kpi-val mono ${Number(avgFill) >= 70 ? 'c-green' : 'c-amber'}">${avgFill}%</div></div>
          <div class="crowd-kpi-box"><div class="kpi-lbl">Avg Gate/Laga</div><div class="kpi-val mono c-green">${fmtM(avgRev)}</div></div>
        </div>`;
    } else {
      kpiEl.innerHTML = '';
    }
  }

  document.getElementById('t6-crowd-tbl').innerHTML = `<thead><tr><th>Lawan &amp; Tgl</th><th>Penonton</th><th>Fill</th><th>Gate</th></tr></thead><tbody>` +
    (log.length ? log.map(h => {
      const fp = ((h.att / cap) * 100).toFixed(0);
      return `<tr>
        <td><b>${esc(h.opp)}</b><div class="c-muted mono" style="font-size:10px">${esc(h.date)} · ${esc(h.comp)}</div></td>
        <td class="mono">${h.att.toLocaleString('id-ID')}</td>
        <td class="mono ${Number(fp) >= 70 ? 'c-green' : 'c-amber'}">${fp}%</td>
        <td class="mono c-green"><b>${fmtM(h.rev)}</b></td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="c-muted">Histori at/rv matchLog belum terisi di save ini.</td></tr>') + `</tbody>`;

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

// ==================== SUB-TAB 5C: CLUB SHOP ANALYTICS & TOP 8 JERSEY (v8.2.4) ====================
function parseTopJerseyEntries(rawTop) {
  const roster = D.roster || [];
  const byId = new Map(roster.map(p => [p.id, p]));
  const byName = new Map(roster.map(p => [String(p.name || '').toLowerCase(), p]));
  const out = [];

  const pushEntry = (idOrName, nameHint, countVal) => {
    const cnt = Number(countVal) || 0;
    if (cnt <= 0) return;
    const p = byId.get(idOrName) || byName.get(String(nameHint || idOrName || '').toLowerCase()) || null;
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
    wrap.innerHTML = '<div class="card"><div class="c-muted">Belum ada histori penjualan bulanan Club Shop (<code>shopLog</code>) di save ini.</div></div>';
    return;
  }

  const latest = hist[hist.length - 1];
  const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  const totalShirts12 = hist.reduce((s, x) => s + (x.shirts || 0), 0);
  const totalRev12 = hist.reduce((s, x) => s + (x.revenue || 0), 0);
  const growthPct = (prev && prev.shirts > 0) ? Math.round(((latest.shirts - prev.shirts) / prev.shirts) * 100) : null;

  // Banner Hype Rekrutan Aktif (Mega +30% / Big +8%)
  let hypeBannerHtml = '';
  if ((sh.mega_signings || []).length) {
    hypeBannerHtml = `<div class="shop-hype-banner">
      <div><span class="badge b-accent">🔥 MEGA SIGNING HYPE +30% AKTIF</span> <b>${sh.mega_signings.map(x => esc(x.name) + ` (sisa ${x.daysLeft}d)`).join(' · ')}</b></div>
      <span class="c-muted" style="font-size:11px">Mendongkrak omzet toko selama 365 hari!</span>
    </div>`;
  } else if ((sh.big_signings || []).length) {
    hypeBannerHtml = `<div class="shop-hype-banner">
      <div><span class="badge b-info">⚡ BIG SIGNING HYPE +8% AKTIF</span> <b>${sh.big_signings.map(x => esc(x.name) + ` (sisa ${x.daysLeft}d)`).join(' · ')}</b></div>
      <span class="c-muted" style="font-size:11px">Aktif 90 hari (beli 1 Mega Signing untuk +30%/365d).</span>
    </div>`;
  }

  // Grafik SVG 12 Bulan dengan label X-axis rapi bebas tabrakan (selang 1 bila >=9 batang)
  const W = 580, H = 200, padL = 46, padR = 14, padT = 24, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxS = Math.max(10, ...hist.map(x => x.shirts || 0));
  const barW = Math.max(16, Math.min(34, (plotW / hist.length) * 0.62));
  const thinLabels = hist.length >= 9;

  const barsSvg = hist.map((x, i) => {
    const cx = padL + ((i + 0.5) / hist.length) * plotW;
    const bh = Math.max(3, ((x.shirts || 0) / maxS) * plotH);
    const y = padT + plotH - bh;
    const isLast = i === hist.length - 1;
    const showX = !thinLabels || (i === 0) || isLast || (i % 2 === 0);
    const moShort = fmtYmShort(x.ym).split(' ')[0];
    const valLbl = x.shirts >= 1000 ? (x.shirts / 1000).toFixed(1) + 'K' : String(x.shirts);
    return `
      <g>
        <title>${x.ym}: ${(x.shirts || 0).toLocaleString('id-ID')} jersey (${fmtM(x.revenue)})</title>
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}"
              rx="4" fill="${isLast ? '#10b981' : '#38bdf8'}" opacity="${isLast ? '0.95' : '0.72'}" />
        ${(!thinLabels || isLast || i % 2 === 0) ? `<text x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="${isLast ? '#6ee7b7' : '#8ea3bc'}" font-size="11" font-weight="700">${valLbl}</text>` : ''}
        ${showX ? `<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" fill="${isLast ? '#6ee7b7' : '#8ea3bc'}" font-size="11">${esc(moShort)}</text>` : ''}
      </g>`;
  }).join('');

  const chartSvg = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:200px;background:var(--bg2);border-radius:11px;border:1px solid var(--border)">
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#243449" stroke-width="1" />
      <text x="6" y="${padT + 9}" fill="#8ea3bc" font-size="11">${maxS >= 1000 ? (maxS / 1000).toFixed(1) + 'K' : maxS}</text>
      <text x="6" y="${padT + plotH}" fill="#8ea3bc" font-size="11">0</text>
      ${barsSvg}
    </svg>`;

  // Top 8 Jersey Leaderboard v2 (2-Baris -> Progress Bar 100% Hidup di Mobile 360px!)
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
      ? `<a class="clickable-name" onclick="openPlayerDrawer('roster','${escJs(p.id)}')"><b>${esc(it.name)}</b></a> ${p.top ? '👑' : (p.star ? '⭐' : '')} <span class="c-muted" style="font-size:10.5px">(${fmtPos(p.pos)} · F${p.force})</span>`
      : `<b>${esc(it.name)}</b>`;
    const idolBadge = inSell
      ? `<span class="badge b-crit" title="Sedang di Cart Jual — risiko Idol Shop Drop!">⚠ DI CART JUAL</span>`
      : (idx === 0 ? `<span class="badge b-warn" title="Magnet komersial #1 — hindari jual tanpa pengganti bintang!">Magnet #1</span>` : '');
    const barCol = idx === 0 ? '#fbbf24' : (idx < 3 ? '#10b981' : '#38bdf8');
    return `<div class="jersey-row-v2 jersey-row">
      <div class="jersey-row-top">
        <div class="jersey-row-left">
          <div class="jersey-rank ${rCls}">#${idx + 1}</div>
          <div class="jersey-row-name">${nameHtml} ${idolBadge}</div>
        </div>
        <div class="mono" style="flex-shrink:0;text-align:right"><b>${it.shirts.toLocaleString('id-ID')}</b> <span class="c-muted" style="font-size:10.5px">(${sharePct}%)</span></div>
      </div>
      <div class="jersey-bar-track"><div class="jersey-bar-fill" style="width:${pctBar}%;background:${barCol}"></div></div>
    </div>`;
  }).join('') : '<div class="c-muted">Data rincian top seller jersey bulan terakhir tidak tersedia.</div>';

  const histRows = [...hist].reverse().map(x => `<tr>
    <td class="mono"><b>${esc(fmtYmShort(x.ym))}</b></td>
    <td class="mono">${(x.shirts || 0).toLocaleString('id-ID')}</td>
    <td class="mono c-green"><b>${fmtM(x.revenue)}</b></td>
    <td class="mono c-muted">${x.shirts > 0 ? (x.revenue / x.shirts).toFixed(2) : '-'}</td>
  </tr>`).join('');

  wrap.innerHTML = `
    ${hypeBannerHtml}
    <div class="shop-kpi-strip">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Bulan Terakhir (${esc(fmtYmShort(latest.ym))})</div>
        <div class="kpi-val mono c-green">${(latest.shirts || 0).toLocaleString('id-ID')}</div>
        <div class="kpi-sub">Omzet <b>${fmtM(latest.revenue)}</b>${growthPct !== null ? ` • ${growthPct >= 0 ? '+' : ''}${growthPct}%` : ''}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Total ${hist.length} Bulan</div>
        <div class="kpi-val mono c-sky">${totalShirts12.toLocaleString('id-ID')}</div>
        <div class="kpi-sub">Total Omzet: <b class="mono c-green">${fmtM(totalRev12)}</b></div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Harga Jersey</div>
        <div class="kpi-val mono ${sh.is_optimal ? 'c-green' : 'c-amber'}">${(sh.cur_m || 1).toFixed(2)}x</div>
        <div class="kpi-sub">${sh.is_optimal ? '✓ Puncak mutlak 1.00x' : 'Ubah ke 1.00x (+' + sh.gain_pct + '%)'}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px">
        <div class="kpi-lbl">Boost Bintang + Hype</div>
        <div class="kpi-val mono c-purple">+${((sh.star_bonus_pct || 0) + (sh.hype_bonus_pct || 0)).toFixed(0)}%</div>
        <div class="kpi-sub">Bintang +${sh.star_bonus_pct || 0}% · Hype +${sh.hype_bonus_pct || 0}%</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>📈 Tren Penjualan Jersey (${hist.length} Bulan)</h2>
        ${chartSvg}
        <div class="tbl-wrap mt-12" style="max-height:220px;overflow-y:auto">
          <table><thead><tr><th>Bulan</th><th>Jersey</th><th>Omzet Bersih</th><th>Net/Jrs</th></tr></thead><tbody>${histRows}</tbody></table>
        </div>
      </div>
      <div class="card">
        <h2>🏆 Top 8 Jersey Terlaris (${esc(fmtYmShort(latest.ym))})</h2>
        <div class="kpi-sub mb-8">Klik nama pemain untuk cek kontrak &amp; profil. Hindari menjual idola #1 tanpa pengganti agar bebas <i>Idol Shop Drop</i>!</div>
        ${leaderHtml}
      </div>
    </div>`;
}
