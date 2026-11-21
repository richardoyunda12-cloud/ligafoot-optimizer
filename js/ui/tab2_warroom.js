// ==================== RENDER TAB 2: WAR ROOM FOKUS 1 LAGA (v8.0) ====================
function setWarCond(kind, val) {
  if (kind === 'ref') warRef = val;
  if (kind === 'weather') warWeather = val;
  ['strict', 'normal', 'lenient'].forEach(r => {
    const el = document.getElementById('wr-ref-' + r);
    if (el) el.className = (warRef === r) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  ['clear', 'rain', 'heat'].forEach(w => {
    const el = document.getElementById('wr-w-' + w);
    if (el) el.className = (warWeather === w) ? 'btn btn-sm btn-green' : 'btn btn-sm';
  });
  renderTab2();
}

function selectWarMatch(idx) {
  activeMatchIdx = idx;
  renderTab2();
}

function openFormInTab3(formKey, useRot) {
  const sel = document.getElementById('t3-form-select');
  if (sel) sel.value = formKey;
  setXiMode(useRot ? 'rot' : 'best');
  goToView('t3', 't3-xi');
  showToast(`Menampilkan ${useRot ? 'Rotation XI' : 'Best XI'} formasi ${fmtForm(formKey)}`);
}

function fmtDelta(v) {
  const n = Number(v) || 0;
  const cls = n >= 1 ? 'c-green' : (n <= -1 ? 'c-red' : 'c-amber');
  return `<b class="mono ${cls}">${n >= 0 ? '+' : ''}${n.toFixed(1)}</b>`;
}

function renderH2HBars(userPow, oppPow) {
  const rows = [
    { lbl: 'GK',  u: userPow.GK,  o: oppPow.GK },
    { lbl: 'DEF', u: userPow.DEF, o: oppPow.DEF },
    { lbl: 'MID', u: userPow.MID, o: oppPow.MID },
    { lbl: 'ATK', u: userPow.ATK, o: oppPow.ATK },
  ];
  return rows.map(r => {
    const diff = +(r.u - r.o).toFixed(1);
    const mag = Math.min(48, Math.abs(diff) * 2.8);
    const barStyle = diff >= 0
      ? `left:50%;width:${mag.toFixed(1)}%;background:var(--green)`
      : `right:50%;width:${mag.toFixed(1)}%;background:var(--red)`;
    const dCls = diff >= 1 ? 'c-green' : (diff <= -1 ? 'c-red' : 'c-amber');
    return `<div class="h2h-row mono">
      <b>${r.lbl}</b>
      <span class="c-sky" style="text-align:right"><b>${r.u.toFixed(1)}</b></span>
      <div class="h2h-track"><div class="h2h-mid"></div><div class="h2h-fill" style="${barStyle}"></div></div>
      <span class="${dCls}" style="text-align:center"><b>${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</b></span>
      <span class="c-muted">${r.o.toFixed(1)}</span>
    </div>`;
  }).join('');
}

function renderTab2() {
  const selEl = document.getElementById('t2-selector');
  const mainEl = document.getElementById('t2-active-match');
  const list = D.upcoming || [];

  if (!list.length) {
    selEl.innerHTML = '';
    mainEl.innerHTML = '<div class="c-muted">Tidak ada jadwal laga mendatang terbaca di save saat ini (mungkin sedang jeda antar-musim).</div>';
  } else {
    if (activeMatchIdx >= list.length) activeMatchIdx = 0;

    // 1. Bar Pemilih 5 Laga
    selEl.innerHTML = list.map((fx, idx) => {
      const isAct = idx === activeMatchIdx;
      const tktNeed = fx.ticketRec && fx.ticketRec.diffs && fx.ticketRec.diffs.length;
      const edgeCls = fx.edge >= 2 ? 'c-green' : (fx.edge <= -2 ? 'c-red' : 'c-amber');
      return `<button class="match-pill ${isAct ? 'active' : ''}" onclick="selectWarMatch(${idx})">
        <div class="flex-between" style="font-size:10px;margin-bottom:3px">
          <span class="badge ${idx === 0 ? 'b-good' : 'b-muted'}">${idx === 0 ? 'BERIKUTNYA' : 'LAGA #' + (idx + 1)} • ${fx.isHome ? '🏠' : '✈️'}</span>
          <span class="mono ${edgeCls}"><b>${fx.edge >= 0 ? '+' : ''}${fx.edge}</b></span>
        </div>
        <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ${esc(fx.oppName)}</div>
        <div class="c-muted" style="font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(fx.compName)}${fx.roundName ? ' · ' + esc(fx.roundName) : ''}
          ${tktNeed ? ' <b class="c-amber">• 🎟️</b>' : ''}
          ${fx.yellowRisks && fx.yellowRisks.length ? ' <b class="c-red">• 🟨</b>' : ''}
        </div>
      </button>`;
    }).join('');

    // 2. Panel Fokus 1 Laga Terpilih
    const fx = list[activeMatchIdx];
    const m = fx.matchup;
    const rec = m ? m.recommended : null;
    const act = m ? m.activeComp : null;
    const refObj = m ? (m.refereePlan[warRef] || m.refereePlan.normal) : null;
    const wObj = m ? (m.weatherPlan[warWeather] || m.weatherPlan.clear) : null;
    const aiFocus = fx.aiFocus || (m && m.aiInfo ? m.aiInfo.aiFocus : 'Mixed');

    const h2hBlock = (m && rec) ? `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;margin-bottom:10px">
        <div class="flex-between mb-8">
          <span class="kpi-lbl">⚔️ Duel Sektor Visual (${esc(D.meta.teamName)} ${esc(fmtForm(rec.formation))} vs ${esc(fx.oppName)} ${esc(fmtForm(fx.oppFormation))})</span>
          <span class="mono c-muted" style="font-size:11px">Kita <b class="c-sky">${rec.avgScore}</b> vs Lawan <b>${fx.oppAvg}</b></span>
        </div>
        ${renderH2HBars(rec.enginePow, m.oppPow)}
      </div>` : '';

    const formBlock = m ? `
      <div style="background:var(--bg2);border:1px solid ${m.keepActive ? 'rgba(16,185,129,.45)' : 'rgba(56,189,248,.55)'};border-radius:11px;padding:11px">
        <div class="flex-between mb-8">
          <div>
            <span class="kpi-lbl">1. Formasi Rekomendasi</span>
            <div style="margin-top:3px;display:flex;align-items:center;gap:7px;flex-wrap:wrap">
              <span style="font-size:20px;font-weight:900" class="mono c-green">${esc(fmtForm(rec.formation))}</span>
              <span class="badge ${m.keepActive ? 'b-good' : 'b-info'}">${m.keepActive ? '✓ PERTAHANKAN' : `🔄 GANTI (+${m.scoreGain} H2H)`}</span>
              <span class="badge b-muted mono">A${fmtMod(rec.enginePow.atkMod)}/D${fmtMod(rec.enginePow.defMod)}</span>
              ${rec.falseNine ? '<span class="badge b-accent">⚡ FALSE NINE</span>' : ''}
            </div>
          </div>
          <button class="btn btn-sm btn-green" onclick="openFormInTab3('${escJs(rec.formation)}', ${fx.safeRotate ? 'true' : 'false'})">⚽ Lihat XI</button>
        </div>
        <div style="font-size:11px;margin-bottom:8px">${m.reasons.map(r => `<div>• ${esc(r)}</div>`).join('')}</div>
        <div class="tbl-wrap"><table><thead><tr><th>Top 3 Formasi</th><th>Mod A/D</th><th>MID</th><th>ATK</th><th>DEF</th><th>FB Salah Kaki</th><th>Skor</th></tr></thead><tbody>
          ${m.top3.map((tf, ti) => `<tr style="cursor:pointer" class="${tf.formation === rec.formation ? 'hl-user' : ''}" onclick="openFormInTab3('${escJs(tf.formation)}', ${fx.safeRotate ? 'true' : 'false'})">
            <td><b>#${ti + 1} ${esc(fmtForm(tf.formation))}</b></td>
            <td class="mono">${fmtMod(tf.atkMod)}/${fmtMod(tf.defMod)}</td>
            <td>${fmtDelta(tf.dMid)}</td><td>${fmtDelta(tf.dAtk)}</td><td>${fmtDelta(tf.dDef)}</td>
            <td class="mono ${tf.wrongFootCount ? 'c-amber' : 'c-green'}">${tf.wrongFootCount}</td>
            <td class="mono c-green"><b>${tf.matchupScore >= 0 ? '+' : ''}${tf.matchupScore}</b></td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>` : '';

    const tacticBlock = m ? `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
        <div class="kpi-lbl mb-8">2. Contekan Taktik, Wasit &amp; Cuaca</div>
        <div class="mb-8" style="background:var(--card);padding:6px 8px;border-radius:7px">
          <b>🤖 Prediksi AI Lawan:</b> <span class="badge b-warn">${esc(fx.aiStyle)}</span>
          <span class="badge b-accent">Fokus: ${esc(aiFocus)}</span>
        </div>
        <div class="mb-8"><b>Gaya Main:</b> <span class="badge b-good">${esc(m.playStyle)}</span>
          <div class="c-muted" style="margin-top:2px">${esc(m.playReason)}</div>
        </div>
        <div class="mb-8"><b>Fokus Serang:</b> <span class="badge b-info">${esc(m.attackFocus)}</span>
          <div class="c-muted" style="margin-top:2px">${esc(m.focusReason)}</div>
        </div>
        <div class="mb-8"><b>Marking (Wasit ${warRef.toUpperCase()}):</b> <span class="badge ${refObj.badge}">${esc(refObj.marking)}</span>
          <div class="c-muted" style="margin-top:2px">${esc(refObj.note)}</div>
        </div>
        <div><b>Cuaca (${esc(wObj.label)}):</b> <span class="c-muted">${esc(wObj.note)}</span></div>
      </div>` : '';

    const tkt = fx.ticketRec;
    const tktCopyStr = tkt ? `${tkt.prices.geral} · ${tkt.prices.arquibancada} · ${tkt.prices.cadeiras} · ${tkt.prices.camarotes}` : '';
    const ticketBlock = tkt ? `
      <div style="background:var(--bg2);border:1px solid rgba(16,185,129,.45);border-radius:11px;padding:11px;font-size:11px">
        <div class="flex-between mb-8">
          <span class="kpi-lbl">3. Harga Tiket Kandang (${tkt.occasion.toUpperCase()}${tkt.isBig ? ' • BIG MATCH' : ''}${tkt.isKnockout ? ' • GUGUR' : ''})</span>
          <div style="display:flex;gap:5px;align-items:center">
            <span class="badge ${tkt.diffs.length ? 'b-warn' : 'b-good'}">${tkt.diffs.length ? 'UBAH HARGA!' : '✓ SUDAH PAS'}</span>
            <button class="btn btn-sm" onclick="copyText('${tktCopyStr}','Harga Tiket')">📋 Salin</button>
          </div>
        </div>
        <div class="grid g4" style="gap:6px;margin-bottom:8px;text-align:center">
          <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">General</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.geral}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.geral}</div></div>
          <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Stands</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.arquibancada}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.arquibancada}</div></div>
          <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Seats</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.cadeiras}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.cadeiras}</div></div>
          <div style="background:var(--card);padding:6px;border-radius:8px"><div class="c-muted" style="font-size:10px">Boxes (VIP)</div><div class="mono c-green" style="font-size:18px;font-weight:900">${tkt.prices.camarotes}</div><div class="mono c-muted" style="font-size:10px">kini ${tkt.curPrices.camarotes}</div></div>
        </div>
        <div>Est. Fill: <b class="mono ${tkt.fillPct >= 70 ? 'c-green' : 'c-red'}">${tkt.fillPct}%</b> (bonus +2% MID ≥70%) • Est. Gate: <b class="mono c-green">${fmtM(tkt.estRev)}</b>
        ${tkt.diffs.length ? `<div class="c-amber" style="margin-top:3px"><b>Ubah di layar Tickets:</b> ${tkt.diffs.join(' · ')} ${tkt.revGain > 0 ? `(+${fmtM(tkt.revGain)}/laga)` : ''}</div>` : ''}</div>
      </div>` : `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
        <div class="kpi-lbl mb-8">3. Tiket Pertandingan</div>
        <div class="c-muted">✈️ Laga Tandang / Netral — tidak mengatur harga tiket kandang. Fokus curi poin &amp; jaga stamina!</div>
      </div>`;

    const sp = rec ? rec.setPieces : D.bestXi.setPieces;
    const yWarn = fx.yellowRisks.length
      ? `<div class="mb-8"><span class="badge b-crit">🟨 RAWAN SKORSING (2 Kuning): ${fx.yellowRisks.map(y => esc(y.name)).join(', ')}</span></div>` : '';
    const spAndSubBlock = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:11px;padding:11px;font-size:11px">
        <div class="kpi-lbl mb-8">4. Set Pieces, 3 Sub (Menit ${warWeather === 'heat' ? '55–62' : '60–70'}) &amp; Intel Lawan</div>
        ${yWarn}
        <div class="grid g2" style="gap:6px;margin-bottom:8px">
          <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Penalti:</span> <b class="c-green">${esc(sp.penalty)}</b></div>
          <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Corner:</span> <b class="c-sky">${esc(sp.corner)}</b></div>
          <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Free Kick:</span> <b class="c-purple">${esc(sp.freeKick)}</b></div>
          <div style="background:var(--card);padding:6px 8px;border-radius:7px"><span class="c-muted">Kapten:</span> <b class="c-amber">${esc(sp.captain)}</b></div>
        </div>
        <div class="mb-8"><b>🪑 3 Pergantian Prioritas:</b><div class="c-muted">${fx.subPlan.map(s => '• ' + esc(s)).join('<br/>')}</div></div>
        <div><b>⚠️ Bintang Lawan:</b> <span class="c-muted">${fx.oppStars.map(s => `${esc(s.name)} (${fmtPos(s.pos)} ${s.force})`).join(', ') || '-'}</span></div>
        ${fx.oppInjured.length ? `<div class="c-amber"><b>🏥 Lawan Cedera:</b> ${fx.oppInjured.map(s => `${esc(s.name)} (${s.days}d)`).join(', ')}</div>` : ''}
      </div>`;

    mainEl.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div class="flex-between mb-8">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="badge ${activeMatchIdx === 0 ? 'b-good' : 'b-info'}">${fx.isHome ? '🏠 KANDANG' : '✈️ TANDANG'}</span>
            <span class="badge b-muted">${esc(fx.compName)}${fx.roundName ? ' • ' + esc(fx.roundName) : ''}</span>
            <strong style="font-size:16px">vs ${esc(fx.oppName)}</strong>
            <span class="mono c-muted" style="font-size:11px">(Rep ${fx.oppRep} • ${fmtForm(fx.oppFormation)})</span>
          </div>
          <span class="badge ${fx.safeRotate ? 'b-accent' : 'b-warn'}">${fx.safeRotate ? '🔄 AMAN ROTASI XI' : '⚡ FULL BEST XI'}</span>
        </div>
        ${h2hBlock}
        <div class="grid g2" style="gap:10px">
          ${formBlock}
          ${tacticBlock}
          ${ticketBlock}
          ${spAndSubBlock}
        </div>
      </div>`;

    // Render Halftime Talk sekali di laci bawah
    const htEl = document.getElementById('t2-halftime');
    if (htEl && m && m.halftimePlan) {
      htEl.innerHTML = `
        <div class="alert-item">
          <span class="badge b-accent">HALFTIME</span>
          <div>• ${esc(m.halftimePlan.win)}<br/>• ${esc(m.halftimePlan.draw)}<br/>• ${esc(m.halftimePlan.lose)}</div>
        </div>`;
    }
  }

  document.getElementById('t2-shouts').innerHTML = D.liveCoach.shouts.map(s => `
    <div class="alert-item">
      <span class="badge b-good">SHOUT</span>
      <div><b>${esc(s.name)}</b> <span class="c-muted">(${esc(s.when)})</span><div class="c-muted" style="font-size:11px">${esc(s.effect)}</div></div>
    </div>`).join('');

  document.getElementById('t2-orders').innerHTML = D.liveCoach.orders.map(o => `
    <div class="alert-item">
      <span class="badge b-info">ORDER</span>
      <div><b>${esc(o.cond)}</b> → <span class="c-green">${esc(o.order)}</span><div class="c-muted" style="font-size:11px">${esc(o.note)}</div></div>
    </div>`).join('');
}
