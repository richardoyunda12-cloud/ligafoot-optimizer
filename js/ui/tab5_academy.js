// ==================== RENDER TAB 5: AKADEMI (v8.0) ====================
function renderTab5() {
  document.getElementById('t5-holes').innerHTML = D.holes.length
    ? `<b>Lubang Skuad Senior Aktif:</b> ` + D.holes.map(h => `<span class="badge b-warn">${esc(fmtPos(h.pos))}: ${esc(h.desc)}</span>`).join(' ')
    : '<span class="c-green">Tidak ada lubang posisi kritis di skuad senior.</span>';

  document.getElementById('t5-tbl').innerHTML = `<thead><tr>
    <th>Prospek (Klik Profil)</th><th>Pos</th><th>Usia</th><th>Kaki</th><th>Force</th><th>Bintang</th>
    <th>Development</th><th>Plafon +</th><th>Skill Stack</th><th>Lubang?</th><th>Skor</th><th>Aksi</th>
  </tr></thead><tbody>` + (D.youth.length ? D.youth.map(y => {
    const devPct = Math.min(100, Math.max(0, Math.round(y.development || 0)));
    const devCol = devPct >= 90 ? 'var(--green)' : (devPct >= 60 ? 'var(--sky)' : 'var(--amber)');
    return `<tr>
      <td><a class="clickable-name" onclick="openPlayerDrawer('youth','${escJs(y.id)}')"><b>${esc(y.name)}</b></a></td>
      <td><b>${fmtPos(y.pos)}</b></td><td class="mono ${y.age >= 20 ? 'c-amber' : ''}">${y.age}</td>
      <td>${fmtFoot(y.foot)}</td><td class="mono">${y.force}</td><td class="mono c-amber">★${y.hash}</td>
      <td><div class="mini-bar-wrap"><div class="mini-bar-bg"><div class="mini-bar-fill" style="width:${devPct}%;background:${devCol}"></div></div><span class="mono" style="font-size:11px;min-width:28px;text-align:right">${devPct}</span></div></td>
      <td class="mono c-green">${y.ceilBonus ? '+' + y.ceilBonus : '-'}</td>
      <td><span class="badge ${y.nonStack ? 'b-crit' : 'b-good'}">${fmtSkills(y.s1, y.s2)} (+${y.stackPct}%)</span></td>
      <td>${y.fillsHole ? '<span class="badge b-good">✓ TAMBAL</span>' : '-'}</td>
      <td class="mono"><b>${y.pipeScore}</b></td>
      <td><span class="badge ${y.action.includes('PROMO') ? 'b-good' : (y.action.includes('TAHAN') ? 'b-info' : 'b-muted')}">${y.action}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="12" class="c-muted">Tidak ada pemain akademi.</td></tr>') + `</tbody>`;
}
