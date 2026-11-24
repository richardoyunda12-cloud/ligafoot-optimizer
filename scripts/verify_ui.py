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

    # 2. Tier 2 Controls Spot-Check
    page.evaluate("() => { goToView('t6', 't6-tel'); }")
    tel_txt = page.text_content('#t6-tel-wrap') or ''
    assert len(tel_txt.strip()) > 30, 'Forensik Laga (t6-tel) kosong'
    if page.locator('#t6-tel-wrap button:has-text("Musim")').count() > 0:
        page.locator('#t6-tel-wrap button:has-text("Musim")').first.click()

    page.evaluate("() => { goToView('t5', 't5-ov'); }")
    assert len((page.text_content('#t6-calendar-12m') or '').strip()) > 20, 'Kalender 12M kosong'

    page.evaluate("() => { goToView('t5', 't5-tkt'); }")
    if page.locator('#t6-preset-audit button:has-text("Tes")').count() > 0:
        page.locator('#t6-preset-audit button:has-text("Tes")').first.click()

    page.evaluate("() => { goToView('t4', 't4-cart'); }")
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
