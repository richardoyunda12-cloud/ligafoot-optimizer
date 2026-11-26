"""
LigaFoot Optimizer PWA — Playwright Desktop & Mobile UI Verification (`verify_ui.py`)
Dipanggil otomatis oleh `node scripts/verify_e2e.js [savePath]` atau langsung:
  python scripts/verify_ui.py [path/to/save.ligafoot]
"""
import functools
import http.server
import os
import re
import socketserver
import sys
import threading
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def read_expected_version():
    idx_path = os.path.join(REPO_ROOT, 'index.html')
    with open(idx_path, 'r', encoding='utf-8') as f:
        txt = f.read()
    m = re.search(r'v\d+\.\d+\.\d+', txt)
    assert m, 'Tag versi vX.Y.Z tidak ditemukan di index.html'
    return m.group(0)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def start_server():
    handler = functools.partial(QuietHandler, directory=REPO_ROOT)
    srv = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, port


def shift_iso_date(date_str, delta_days):
    dt = datetime.strptime(str(date_str)[:10], '%Y-%m-%d') + timedelta(days=delta_days)
    return dt.strftime('%Y-%m-%d')


def load_save_on_page(page, save_path):
    page.set_input_files('#lf-file-input', save_path)
    page.wait_for_selector('#webapp-dashboard-shell:not(.app-hidden)', timeout=20000)
    page.wait_for_function("() => window.D && window.D.meta && document.getElementById('hdr-badge')", timeout=15000)


def run_desktop_checks(browser, url, save_path, expected_ver):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

    page.goto(url, wait_until='domcontentloaded')
    load_save_on_page(page, save_path)

    hdr_badge = page.text_content('#hdr-badge') or ''
    assert expected_ver in hdr_badge, f'Header badge tidak {expected_ver}: {hdr_badge}'

    # 0. Tab 2 Desktop: Tabel Top 3 Formasi bebas horizontal scroll
    page.evaluate("() => { goToView('t2'); }")
    top3_hscroll = page.evaluate("""() => {
      const t = document.querySelector('#panel-t2 .wr-top3-tbl');
      const w = t && t.closest('.tbl-wrap');
      return w ? Math.max(0, w.scrollWidth - w.clientWidth) : 0;
    }""")
    assert top3_hscroll <= 2, f'Desktop wr-top3-tbl masih horizontal scroll {top3_hscroll}px'

    # 1. Tab 3C: Pelacak Progresi Wonderkid + SVG + Selector + Scope Tabs
    page.evaluate("() => { goToView('t3', 't3-train'); }")
    page.wait_for_selector('#t3-growth-tracker svg polyline', timeout=5000)
    opt_vals = page.evaluate("""() => {
      const sel = document.getElementById('t3-wk-select');
      return sel ? Array.from(sel.options).map(o => o.value) : [];
    }""")
    assert len(opt_vals) >= 1, 'Select wonderkid kosong'
    if len(opt_vals) >= 2:
        page.select_option('#t3-wk-select', opt_vals[1])
        cur_val = page.evaluate("() => document.getElementById('t3-wk-select').value")
        assert cur_val == opt_vals[1], 'Ganti pilihan wonderkid di chart gagal'
    page.evaluate("() => { setT3TrainScope('WK'); }")
    wk_only_ct_hidden = page.evaluate("() => getComputedStyle(document.getElementById('t3-ct-card')).display === 'none'")
    assert wk_only_ct_hidden, 'Scope tab tab3-train (WK) tidak menyembunyikan card Training'
    page.evaluate("() => { setT3TrainScope('ALL'); }")

    # 1b. Tab 3B & 3E: Audit Tim — Sortable Force/PotCap headers & Asing/Lokal Notes
    page.evaluate("() => { goToView('t3', 't3-squad'); }")
    page.wait_for_selector('#t4-tbl th[data-sort-col="potCap"]', timeout=5000)

    def read_audit_rows(tbl_sel):
        return page.evaluate("""(sel) => Array.from(document.querySelectorAll(sel + ' tbody tr[data-force]')).map(tr => {
          const noteEl = tr.querySelector('.origin-note');
          const style = noteEl ? getComputedStyle(noteEl) : null;
          return {
            force: Number(tr.dataset.force),
            potCap: Number(tr.dataset.potcap),
            foreign: tr.dataset.foreign === '1',
            noteVisible: Boolean(noteEl && style && style.display !== 'none' && noteEl.getBoundingClientRect().width > 0),
            noteText: noteEl ? noteEl.textContent.trim() : '',
          };
        })""", tbl_sel)

    rows_init = read_audit_rows('#t4-tbl')
    assert len(rows_init) >= 2, 'Tabel Audit Skuad Senior (<2 baris)'
    assert all(
        r['noteVisible'] and (('ASING' if r['foreign'] else 'LOKAL') in r['noteText'])
        for r in rows_init
    ), 'Note Asing/Lokal tidak tampil lengkap pada seluruh baris Audit Skuad Senior'

    page.locator('#t4-tbl th[data-sort-col="potCap"]').click()
    assert 'sort-active' in (page.get_attribute('#t4-tbl th[data-sort-col="potCap"]', 'class') or ''), 'Header potCap tidak aktif setelah diklik'
    pot_desc = [r['potCap'] for r in read_audit_rows('#t4-tbl')]
    assert pot_desc == sorted(pot_desc, reverse=True), f'Sort PotCap DESC gagal: {pot_desc[:8]}'

    page.locator('#t4-tbl th[data-sort-col="potCap"]').click()
    pot_asc = [r['potCap'] for r in read_audit_rows('#t4-tbl')]
    assert pot_asc == sorted(pot_asc), f'Sort PotCap ASC gagal: {pot_asc[:8]}'

    page.locator('#t4-tbl th[data-sort-col="force"]').click()
    assert 'sort-active' in (page.get_attribute('#t4-tbl th[data-sort-col="force"]', 'class') or ''), 'Header force tidak aktif setelah diklik'
    f_desc = [r['force'] for r in read_audit_rows('#t4-tbl')]
    assert f_desc == sorted(f_desc, reverse=True), f'Sort Force DESC gagal: {f_desc[:8]}'

    page.locator('#t4-tbl th[data-sort-col="force"]').click()
    f_asc = [r['force'] for r in read_audit_rows('#t4-tbl')]
    assert f_asc == sorted(f_asc), f'Sort Force ASC gagal: {f_asc[:8]}'

    page.locator('#t4-tbl th[data-sort-col="force"]').click()

    expected_counts = page.evaluate("() => ({ total: (D.roster || []).length, foreign: D.meta.foreignCountSquad || 0 })")
    page.evaluate("() => { setRosterQuickFilter('FOREIGN'); }")
    f_rows = read_audit_rows('#t4-tbl')
    assert len(f_rows) == expected_counts['foreign'] and all(r['foreign'] for r in f_rows), 'Filter FOREIGN mismatch'
    page.evaluate("() => { setRosterQuickFilter('LOCAL'); }")
    l_rows = read_audit_rows('#t4-tbl')
    assert len(l_rows) == (expected_counts['total'] - expected_counts['foreign']) and all(not r['foreign'] for r in l_rows), 'Filter LOCAL mismatch'
    page.evaluate("() => { setRosterQuickFilter('ALL'); }")

    page.evaluate("() => { goToView('t3', 't3-bteam'); }")
    b_rows = read_audit_rows('#t3b-tbl')
    if len(b_rows) >= 2:
        assert all(
            r['noteVisible'] and (('ASING' if r['foreign'] else 'LOKAL') in r['noteText'])
            for r in b_rows
        ), 'Note Asing/Lokal tidak tampil lengkap pada Audit Tim B'
        page.locator('#t3b-tbl th[data-sort-col="potCap"]').click()
        bp_desc = [r['potCap'] for r in read_audit_rows('#t3b-tbl')]
        assert bp_desc == sorted(bp_desc, reverse=True), f'Tim B Sort PotCap DESC gagal: {bp_desc[:8]}'
        page.locator('#t3b-tbl th[data-sort-col="potCap"]').click()
        bp_asc = [r['potCap'] for r in read_audit_rows('#t3b-tbl')]
        assert bp_asc == sorted(bp_asc), f'Tim B Sort PotCap ASC gagal: {bp_asc[:8]}'
        page.locator('#t3b-tbl th[data-sort-col="force"]').click()
        bf_desc = [r['force'] for r in read_audit_rows('#t3b-tbl')]
        assert bf_desc == sorted(bf_desc, reverse=True), f'Tim B Sort Force DESC gagal: {bf_desc[:8]}'
        has_bsetup_xi = page.evaluate("() => Boolean(D.bTeamInfo && D.bTeamInfo.bSetup && D.bTeamInfo.bSetup.xiCount > 0)")
        if has_bsetup_xi:
            bteam_txt = page.text_content('#t3b-tbl') or ''
            assert 'XI B' in bteam_txt, 'Badge XI B dari save.bSetup tidak tampil di Audit Tim B'

    # 2. Tier 2 Controls Spot-Check
    page.evaluate("() => { goToView('t6', 't6-tel'); }")
    tel_txt = page.text_content('#t6-tel-wrap') or ''
    assert len(tel_txt.strip()) > 30, 'Forensik Laga (t6-tel) kosong'
    if page.locator('#t6-tel-wrap button:has-text("Musim")').count() > 0:
        page.locator('#t6-tel-wrap button:has-text("Musim")').first.click()

    page.evaluate("() => { goToView('t5', 't5-ov'); }")
    assert len((page.text_content('#t6-calendar-12m') or '').strip()) > 20, 'Kalender 12M kosong'
    t6_debt_txt = (page.text_content('#t6-debt-room-badge') or '').strip()
    assert ('Sisa' in t6_debt_txt) or ('BAN' in t6_debt_txt), f'Badge Plafon Cicilan Tab 5A tidak tampil: {t6_debt_txt}'
    has_upfront_sp = page.evaluate("() => Number((D.finance && D.finance.estUpfrontSponsorMonthly) || 0) > 0")
    if has_upfront_sp:
        eff_txt = (page.text_content('#t6-eff-net-pill') or '').strip()
        assert 'Net Efektif' in eff_txt, f'Pill Net Efektif amortisasi sponsor tidak tampil: {eff_txt}'

    # v8.9.4: War Room Buff Morale (Bicho #22238) + Transfer Debt Room Badge (#21652/#21653)
    page.evaluate("() => { goToView('t2'); }")
    morale_txt = (page.text_content('#wr-morale-box') or '').strip()
    assert 'Buff Morale' in morale_txt and 'MID' in morale_txt, f'Kartu Buff Morale War Room tidak tampil: {morale_txt[:120]}'
    page.locator('#wr-morale-win').click()
    assert page.locator('#wr-morale-delta').count() > 0, 'Simulasi WinGlow tidak menampilkan #wr-morale-delta'
    page.locator('#wr-morale-miss').click()
    miss_delta_txt = (page.text_content('#wr-morale-delta') or '').strip()
    assert 'ΔMID' in miss_delta_txt, f'Simulasi MissGlow tidak memperbarui #wr-morale-delta: {miss_delta_txt}'
    page.locator('#wr-morale-auto').click()

    page.evaluate("() => { goToView('t4', 't4-bp'); }")
    bp_debt_txt = (page.text_content('#t7-debt-room-badge') or '').strip()
    assert 'Sisa Plafon Cicilan' in bp_debt_txt, f'Badge Sisa Plafon Cicilan di Tab 4A tidak tampil: {bp_debt_txt}'

    # v8.10.0: Filter Lokal/Asing di Gratis/Diskon, Peminat di Jual Skuad, & Mini Kalkulator Drawer
    page.evaluate("() => { setBlueprintTab('BARGAIN'); }")
    assert page.locator('#t7-bargain-origin-bar').count() > 0, 'Filter Lokal/Asing Gratis/Diskon tidak tampil'
    page.evaluate("() => { setBargainOrigin('LOCAL'); setBargainOrigin('ALL'); setBlueprintTab('SELL'); }")
    sell_hdr = (page.text_content('#t7-blueprint') or '')
    assert 'Peminat' in sell_hdr, 'Kolom Peminat di Tab 4A Jual Skuad tidak tampil'
    page.evaluate("() => { setBlueprintTab('UPGRADE'); }")

    first_pid = page.evaluate("() => (D.roster && D.roster[0] && D.roster[0].id) || ''")
    assert first_pid, 'Roster kosong untuk uji Player Drawer'
    page.evaluate("(pid) => { openPlayerDrawer('roster', pid); }", first_pid)
    assert page.locator('#drw-buyer-demand').count() > 0, 'Badge Minat Pasar tidak tampil di Player Drawer'
    page.fill('#drw-ctr-inp', '1000')
    ctr_out = (page.text_content('#drw-ctr-out') or '')
    assert '1.400 K' in ctr_out or '1,400 K' in ctr_out, f'Mini Kalkulator Counter Drawer tidak menghitung 1.40x: {ctr_out}'
    page.evaluate("() => { closePlayerDrawer(); }")

    # v8.10.2: Klausul Rilis regional di Scout Drawer & DP 25% Cicilan di Radar Olheiro da Base
    scout_pid = page.evaluate("""() => {
      const row = (D.scoutPool || []).find(r => r && r[13] > 0 && r[16] && r[16] !== 'Free Agent' && !String(r[18] || '').includes('FREE'));
      return row ? row[19] : '';
    }""")
    if scout_pid:
        page.evaluate("(pid) => { openPlayerDrawer('scout', pid); }", scout_pid)
        rc_txt = (page.text_content('#drw-release-clause') or '').strip()
        assert 'Klausul Rilis' in rc_txt and ('1.5x' in rc_txt or '2.0x' in rc_txt or '3.0x' in rc_txt), f'Klausul Rilis regional tidak tampil di Scout Drawer: {rc_txt}'
        page.evaluate("() => { closePlayerDrawer(); }")

    page.evaluate("() => { goToView('t3', 't3-acad'); }")
    if page.locator('#t5-yscout-box table').count() > 0:
        ys_txt = (page.text_content('#t5-yscout-box') or '')
        assert 'DP 25%' in ys_txt, 'Keterangan Cicilan DP 25% tidak tampil di Radar Olheiro da Base'

    page.evaluate("() => { goToView('t5', 't5-tkt'); }")
    if page.locator('#t6-preset-audit button:has-text("Tes")').count() > 0:
        page.locator('#t6-preset-audit button:has-text("Tes")').first.click()

    page.evaluate("() => { goToView('t4', 't4-cart'); }")
    cart_debt_txt = (page.text_content('#t7-cart-debt-badge') or '').strip()
    assert 'Plafon Cicilan' in cart_debt_txt or 'Cicil DP 25%' in cart_debt_txt, f'Badge Plafon Cicilan Cart tidak tampil: {cart_debt_txt}'
    if page.locator('#t7-bteam-pick option').count() > 1:
        b_opt = page.evaluate("() => document.getElementById('t7-bteam-pick').options[0].value")
        page.select_option('#t7-bteam-pick', b_opt)
        page.evaluate("() => addBTeamSelectToCart()")
        assert page.locator('#t7-whatif-sim').count() > 0, 'What-If Simulator tidak tampil'

    page.evaluate("() => { goToView('t6', 't6-ext'); }")
    if page.locator('#nat-warroom-box').count() > 0:
        before_wr = page.text_content('#nat-wr-win-badge') or ''
        page.locator('#nat-warroom-box button:has-text("Optimal Call-Up")').click()
        after_wr = page.text_content('#nat-wr-win-badge') or ''
        assert len(before_wr) > 0 and len(after_wr) > 0, 'Timnas War Room badge kosong'

    # 3. Tier 3 Multi-Save IndexedDB Seed + Reload Flow ("Apa yang Berubah?")
    cur_date = page.evaluate("() => window.D.meta.currentDate")
    prev_date = shift_iso_date(cur_date, -28)
    seeded = page.evaluate("""async (prevD) => {
      const hist = (await window.LFStorage.getHistory()) || {};
      const uid = window.D.meta.userId;
      const curD = window.D.meta.currentDate;
      const curSnap = hist[uid] && hist[uid][curD];
      if (!curSnap) return false;
      const oldSnap = JSON.parse(JSON.stringify(curSnap));
      oldSnap.budget = (oldSnap.budget || 0) - 2500000;
      oldSnap.bestXiAvg = Number(((oldSnap.bestXiAvg || 50) - 0.6).toFixed(2));
      const wkId = window.D.progression && window.D.progression.wonderkids && window.D.progression.wonderkids[0] && window.D.progression.wonderkids[0].id;
      if (wkId && oldSnap.players && oldSnap.players[wkId]) {
        oldSnap.players[wkId].force = Math.max(1, oldSnap.players[wkId].force - 1);
        oldSnap.players[wkId].gf = 0.15;
      }
      hist[uid][prevD] = oldSnap;
      await window.LFStorage.saveHistory(hist);
      return true;
    }""", prev_date)
    assert seeded, 'Gagal menulis snapshot sintetis ke LFStorage'

    page.evaluate("() => { LFApp.openSavePicker(); }")
    page.wait_for_selector('#webapp-loader-screen:not(.app-hidden)', timeout=5000)
    load_save_on_page(page, save_path)

    page.evaluate("() => { goToView('t1'); }")
    wn_txt = page.text_content('#t1-whats-new') or ''
    assert 'Apa yang Berubah' in wn_txt and prev_date in wn_txt, f'Kartu What\'s New tidak tampil benar: {wn_txt[:120]}'

    page.evaluate("() => { goToView('t3', 't3-train'); }")
    trk_txt = page.text_content('#t3-growth-tracker') or ''
    assert '2 Snapshot' in trk_txt, f'Wonderkid tracker tidak menampilkan 2 Snapshot: {trk_txt[:120]}'

    page.evaluate("() => { goToView('t1'); dismissWhatsNew(); }")
    wn_after_dismiss = (page.text_content('#t1-whats-new') or '').strip()
    assert wn_after_dismiss == '', 'dismissWhatsNew gagal menutup #t1-whats-new'

    assert errors == [], f'Desktop console/page errors: {errors}'
    print(f'  Desktop (1280x800) PASS: {hdr_badge} | Multi-save & Wonderkid SVG verified | 0 errors.')
    ctx.close()


def run_mobile_checks(browser, url, save_path, expected_ver):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

    page.goto(url, wait_until='domcontentloaded')
    load_save_on_page(page, save_path)

    hdr_badge = page.text_content('#hdr-badge') or ''
    assert expected_ver in hdr_badge, f'Mobile header badge tidak {expected_ver}: {hdr_badge}'

    views = [
        ('t1', None), ('t2', None),
        ('t3', 't3-xi'), ('t3', 't3-squad'), ('t3', 't3-train'), ('t3', 't3-acad'), ('t3', 't3-bteam'),
        ('t4', 't4-bp'), ('t4', 't4-exp'), ('t4', 't4-short'), ('t4', 't4-cart'),
        ('t5', 't5-ov'), ('t5', 't5-tkt'), ('t5', 't5-shop'), ('t5', 't5-roi'),
        ('t6', 't6-lg'), ('t6', 't6-tel'), ('t6', 't6-calc'), ('t6', 't6-ext'),
    ]

    max_overflow = 0
    overflows = []
    for tab, sub in views:
        page.evaluate("([t, s]) => { if (s) goToView(t, s); else goToView(t); }", [tab, sub])
        ov = page.evaluate("() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")
        if ov > max_overflow:
            max_overflow = ov
        if ov > 0:
            overflows.append((sub or tab, ov))

    # Cek global .col-hide-mob berfungsi di luar War Room & tombol Kondisi War Room >= 32px saat dibuka
    page.evaluate("() => { goToView('t3', 't3-bteam'); }")
    hidden_bteam = page.evaluate("() => Array.from(document.querySelectorAll('#t3b-tbl .col-hide-mob')).every(el => getComputedStyle(el).display === 'none')")
    assert hidden_bteam, 'Global .col-hide-mob tidak menyembunyikan kolom sekunder di Mobile'

    page.evaluate("() => { goToView('t2'); document.getElementById('wr-cond-details').setAttribute('open',''); }")
    small_t2_btns = page.evaluate("""() => {
      const ids = ['#wr-cond-auto', '#wr-ref-strict', '#wr-w-clear'];
      return ids.filter(sel => {
        const el = document.querySelector(sel);
        return el && el.getBoundingClientRect().height < 32;
      });
    }""")
    assert small_t2_btns == [], f'Tombol War Room Mobile terlalu kecil (<32px): {small_t2_btns}'

    assert not overflows, f'Mobile horizontal overflow ditemukan: {overflows}'
    assert errors == [], f'Mobile console/page errors: {errors}'
    print(f'  Mobile (390x844) PASS: {len(views)}/19 view | maxOverflowPx={max_overflow} | 0 errors.')
    ctx.close()


def launch_chromium(p):
    try:
        return p.chromium.launch(headless=True)
    except Exception:
        local_app = os.environ.get('LOCALAPPDATA', '')
        ms_pw = os.path.join(local_app, 'ms-playwright')
        if os.path.isdir(ms_pw):
            for entry in sorted(os.listdir(ms_pw), reverse=True):
                if not entry.startswith('chromium'):
                    continue
                for sub in (
                    ('chrome-win64', 'chrome.exe'),
                    ('chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
                    ('chrome-linux', 'chrome'),
                ):
                    cand = os.path.join(ms_pw, entry, *sub)
                    if os.path.isfile(cand):
                        return p.chromium.launch(headless=True, executable_path=cand)
        for chan in ('msedge', 'chrome'):
            try:
                return p.chromium.launch(headless=True, channel=chan)
            except Exception:
                pass
        raise


def main():
    save_arg = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(REPO_ROOT, '..', 'ligafoot_slot1.ligafoot'))
    save_path = os.path.abspath(save_arg)
    if not os.path.isfile(save_path):
        raise FileNotFoundError(f'Save file tidak ditemukan: {save_path}')

    expected_ver = read_expected_version()
    srv, port = start_server()
    url = f'http://127.0.0.1:{port}/index.html'
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            try:
                run_desktop_checks(browser, url, save_path, expected_ver)
                run_mobile_checks(browser, url, save_path, expected_ver)
            finally:
                browser.close()
    finally:
        srv.shutdown()
        srv.server_close()


if __name__ == '__main__':
    main()
