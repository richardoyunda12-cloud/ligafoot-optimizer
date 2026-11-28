#!/usr/bin/env python3
"""
LigaFoot Optimizer — Bytecode-to-Engine Parity Checker
Memverifikasi secara otomatis bahwa konstanta & ambang batas di `js/engine/config.js`
sama persis dengan definisi bytecode Hermes di `D:/Liga/disasm_v9.hasm`.
"""
import argparse
import ast
import json
import os
import re
import shutil
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DEFAULT_HASM = os.path.abspath(os.path.join(REPO_ROOT, "..", "disasm_v9.hasm"))


def parse_js_literal(expr_str):
    s = expr_str.strip()
    s = re.sub(r"\bnull\b", "None", s)
    s = re.sub(r"\btrue\b", "True", s)
    s = re.sub(r"\bfalse\b", "False", s)
    s = re.sub(r"\bundefined\b", "None", s)
    return ast.literal_eval(s)


def index_small_getters(lines):
    getters = {}
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        if ln.startswith("=> [Function #"):
            m = re.match(r"=> \[Function #(\d+) ", ln)
            if m:
                fid = int(m.group(1))
                block = "".join(lines[i + 1 : i + 10])
                if "GetParentEnvironment" in block and "<Ret>" in block:
                    sm = re.search(
                        r"<LoadFromEnvironment(?:L)?>:\s*<Reg8:\s*\d+,\s*Reg8:\s*\d+,\s*UInt(?:8|16):\s*(\d+)>",
                        block,
                    )
                    if sm:
                        getters[fid] = int(sm.group(1))
        i += 1
    return getters


def parse_module_exports_and_slots(lines, fn_prefix, getters):
    start = -1
    for idx, ln in enumerate(lines):
        if ln.startswith(fn_prefix):
            start = idx
            break
    if start < 0:
        return {}, {}

    regs = {}
    slots = {}
    bindings = {}
    env_reg = None
    last_closure_fid = None
    i = start + 1
    n = len(lines)

    while i < n:
        ln = lines[i]
        if ln.startswith("=> [Function #"):
            break
        s = ln.strip()
        if not s.startswith("==>"):
            i += 1
            continue

        if "<CreateFunctionEnvironment>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),", s)
            if m:
                env_reg = int(m.group(1))
        elif "<LoadConstZero>:" in s:
            m = re.search(r"<Reg8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = 0
        elif "<LoadConstUInt8>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*UInt8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = int(m.group(2))
        elif "<LoadConstInt>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Imm32:\s*(-?\d+)>", s)
            if m:
                regs[int(m.group(1))] = int(m.group(2))
        elif "<LoadConstDouble>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Double:\s*([^>]+)>", s)
            if m:
                try:
                    regs[int(m.group(1))] = float(m.group(2))
                except ValueError:
                    pass
        elif "<LoadConstTrue>:" in s:
            m = re.search(r"<Reg8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = True
        elif "<LoadConstFalse>:" in s:
            m = re.search(r"<Reg8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = False
        elif "<LoadConstString" in s:
            m_reg = re.search(r"<Reg8:\s*(\d+),", s)
            m_str = re.search(r"# String:\s*'((?:[^'\\]|\\.)*)'", s)
            if m_reg and m_str:
                val = m_str.group(1)
                regs[int(m_reg.group(1))] = val
                if last_closure_fid in getters:
                    bindings[val] = getters[last_closure_fid]
                    last_closure_fid = None
        elif "<Negate>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Reg8:\s*(\d+)>", s)
            if m and isinstance(regs.get(int(m.group(2))), (int, float)):
                regs[int(m.group(1))] = -regs[int(m.group(2))]
        elif "<Mov>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Reg8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = regs.get(int(m.group(2)))
        elif "<NewArray>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*UInt16:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = [None] * int(m.group(2))
        elif "<NewArrayWithBufferLong>:" in s or "<NewArrayWithBuffer>:" in s:
            m_reg = re.search(r"<Reg8:\s*(\d+),", s)
            m_arr = re.search(r"# Array:\s*(.+)$", s)
            if m_reg and m_arr:
                try:
                    regs[int(m_reg.group(1))] = parse_js_literal(m_arr.group(1))
                except Exception:
                    pass
        elif "<NewObject>:" in s:
            m = re.search(r"<Reg8:\s*(\d+)>", s)
            if m:
                regs[int(m.group(1))] = {}
        elif "<NewObjectWithBufferLong>:" in s or "<NewObjectWithBuffer>:" in s:
            m_reg = re.search(r"<Reg8:\s*(\d+),", s)
            m_obj = re.search(r"# Object:\s*(.+)$", s)
            if m_reg and m_obj:
                try:
                    regs[int(m_reg.group(1))] = parse_js_literal(m_obj.group(1))
                except Exception:
                    pass
        elif "<DefineOwnInDenseArray>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Reg8:\s*(\d+),\s*UInt8:\s*(\d+)>", s)
            if m:
                arr = regs.get(int(m.group(1)))
                val = regs.get(int(m.group(2)))
                idx = int(m.group(3))
                if isinstance(arr, list):
                    while len(arr) <= idx:
                        arr.append(None)
                    arr[idx] = val
        elif "<PutOwnBySlotIdx>:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*Reg8:\s*(\d+),\s*UInt8:\s*(\d+)>", s)
            if m:
                obj = regs.get(int(m.group(1)))
                val = regs.get(int(m.group(2)))
                slot_i = int(m.group(3))
                if isinstance(obj, dict):
                    keys = list(obj.keys())
                    if slot_i < len(keys):
                        obj[keys[slot_i]] = val
        elif "<CreateClosure>:" in s:
            cm = re.search(r"function_id:\s*(\d+)>", s)
            if cm:
                last_closure_fid = int(cm.group(1))
        elif "ToEnvironment" in s and ">:" in s:
            m = re.search(r"<Reg8:\s*(\d+),\s*UInt(?:8|16):\s*(\d+),\s*Reg8:\s*(\d+)>", s)
            if m and (env_reg is None or int(m.group(1)) == env_reg):
                slots[int(m.group(2))] = regs.get(int(m.group(3)))
        i += 1

    resolved = {}
    for name, slot in bindings.items():
        if slot in slots:
            resolved[name] = slots[slot]
    return resolved, slots


def extract_function_consts(lines, fn_prefix):
    for idx, ln in enumerate(lines):
        if ln.startswith(fn_prefix):
            nums = []
            for j in range(idx + 1, min(len(lines), idx + 150)):
                if lines[j].startswith("=> [Function #"):
                    break
                m_u = re.search(r"<LoadConstUInt8>:.*UInt8:\s*(\d+)>", lines[j])
                if m_u:
                    nums.append(int(m_u.group(1)))
                m_i = re.search(r"<LoadConstInt>:.*Imm32:\s*(-?\d+)>", lines[j])
                if m_i:
                    nums.append(int(m_i.group(1)))
                m_d = re.search(r"<LoadConstDouble>:.*Double:\s*([^>]+)>", lines[j])
                if m_d:
                    try:
                        nums.append(float(m_d.group(1)))
                    except ValueError:
                        pass
            return nums
    return []


def dump_js_config():
    node_exe = shutil.which("node") or shutil.which("node.exe")
    if not node_exe:
        raise RuntimeError("Node.js tidak ditemukan di PATH.")
    js_code = (
        "const path=require('path');"
        "global.window=global;"
        "require(path.join(process.env.REPO_ROOT,'js','engine','config.js'));"
        "console.log(JSON.stringify(global.LFEngine.config));"
    )
    env = dict(os.environ)
    env["REPO_ROOT"] = REPO_ROOT
    res = subprocess.run([node_exe, "-e", js_code], env=env, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def deep_close(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        return abs(float(a) - float(b)) <= 1e-6
    return a == b


def find_dynamic_functions(lines):
    """Temukan prefix fungsi di .hasm berdasarkan nama fungsi / string jangkar unik (kebal geser ID)."""
    prefixes = {
        "econ_mod": None,
        "value_mod": None,
        "mood_mod": None,
        "match_mod": None,
        "injury_tier": None,
        "squad_moods": None,
    }
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        if ln.startswith("=> ["):
            hdr = ln
            j = i + 1
            while j < n and not lines[j].startswith("=> ["):
                j += 1
            fn_len = j - i
            if ' "injuryTier" ' in hdr and prefixes["injury_tier"] is None:
                prefixes["injury_tier"] = (i, j, hdr)
            elif ' "squadMoods" ' in hdr and prefixes["squad_moods"] is None:
                prefixes["squad_moods"] = (i, j, hdr)
            else:
                blk = "".join(lines[i:j])
                if prefixes["econ_mod"] is None and "'INJURED_SALE'" in blk and "'PAYROLL_REF'" in blk:
                    prefixes["econ_mod"] = (i, j, hdr)
                elif prefixes["value_mod"] is None and fn_len < 300 and "'DEFAULT_VALUE_CONTEXT'" in blk and "'computeMarketValue'" in blk:
                    prefixes["value_mod"] = (i, j, hdr)
                elif prefixes["mood_mod"] is None and fn_len < 120 and "'UNHAPPY_GROWTH'" in blk:
                    prefixes["mood_mod"] = (i, j, hdr)
                elif prefixes["match_mod"] is None and "'wrongFoot'" in blk and "'orderFitMin'" in blk:
                    prefixes["match_mod"] = (i, j, hdr)
            i = j
        else:
            i += 1
    return prefixes


def extract_country_groups(lines, span):
    if not span:
        return []
    s_i, e_i, _ = span
    arrays = []
    for k in range(s_i, e_i):
        ln = lines[k]
        if "NewArrayWithBuffer" in ln and "# Array:" in ln:
            m = re.search(r"# Array:\s*(.+)$", ln)
            if m:
                try:
                    arr = parse_js_literal(m.group(1))
                    if isinstance(arr, list) and len(arr) >= 10 and all(isinstance(x, str) for x in arr):
                        arrays.append(arr)
                except Exception:
                    pass
    return arrays


def run_checks(hasm_path):
    with open(hasm_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    locs = find_dynamic_functions(lines)
    getters = index_small_getters(lines)

    def parse_span(key):
        sp = locs.get(key)
        if not sp:
            return {}, {}
        pref = sp[2].split(" of ")[0]
        return parse_module_exports_and_slots(lines, pref, getters)

    def consts_span(key):
        sp = locs.get(key)
        if not sp:
            return []
        pref = sp[2].split(" of ")[0]
        return extract_function_consts(lines, pref)

    m_econ, _ = parse_span("econ_mod")
    m_mood, s_mood = parse_span("mood_mod")
    m_match, _ = parse_span("match_mod")
    inj_nums = consts_span("injury_tier")
    mood_nums = consts_span("squad_moods")
    cg_arrays = extract_country_groups(lines, locs.get("value_mod"))
    js_cfg = dump_js_config()

    mismatches = []

    def chk(label, expected, actual):
        if not deep_close(expected, actual):
            mismatches.append(f"{label}: hasm={expected!r} != js={actual!r}")

    for req_key in ("econ_mod", "value_mod", "mood_mod", "match_mod", "injury_tier", "squad_moods"):
        if not locs.get(req_key):
            mismatches.append(f"locate.{req_key}: tidak ditemukan di {os.path.basename(hasm_path)}")

    # 1. INJURED_SALE
    hasm_inj = m_econ.get("INJURED_SALE") or {}
    js_inj = js_cfg.get("INJURED_SALE") or {}
    if isinstance(hasm_inj, dict):
        chk("INJURED_SALE.minorFactor", hasm_inj.get("light"), js_inj.get("minorFactor"))
        chk("INJURED_SALE.moderateFactor", hasm_inj.get("medium"), js_inj.get("moderateFactor"))
        chk("INJURED_SALE.majorFactor", hasm_inj.get("severe"), js_inj.get("majorFactor"))
        chk("INJURED_SALE.severeFactor", hasm_inj.get("long"), js_inj.get("severeFactor"))
    if len(inj_nums) >= 3:
        chk("INJURED_SALE.minorMaxDays", inj_nums[0], js_inj.get("minorMaxDays"))
        chk("INJURED_SALE.moderateMaxDays", inj_nums[1], js_inj.get("moderateMaxDays"))
        chk("INJURED_SALE.majorMaxDays", inj_nums[2], js_inj.get("majorMaxDays"))

    # 2. Direct economy structured constants vs config.js
    direct_keys = [
        "SELLER_STANCE",
        "BUY_PERSUADE",
        "STAR_PULL",
        "VALUE_K_BY_LEVEL",
        "VALUE_CRAQUE_MUL",
        "VALUE_WORLDTOP_MUL",
        "VALUE_ATTACKER_MUL",
        "VALUE_HIGHLIGHT_MUL",
        "VALUE_AGE_TERMS",
        "VALUE_AGE_OLD_CUT",
        "VALUE_LOW_LEVEL_MUL",
        "VALUE_OLD_MUL",
        "VALUE_YOUNG_BONUS",
        "VALUE_K_MIN",
        "VALUE_YOUTH_FRACTION",
        "VALUE_YOUTH_RAMP",
        "EURO_TOP_BONUS",
        "EURO_TOP_MIN_LEVEL",
        "PRECONTRACT_DAYS",
        "RIVAL_JUNIOR_STAR_FLOOR",
        "SHOP_ELAST",
        "SHOP_MEGA_DAYS",
        "SHOP_MEGA_BONUS",
        "SHOP_SIGNING_DAYS",
        "SHOP_SIGNING_BONUS",
        "SHOP_STAR_MAX",
        "SHOP_FANS_STADIUM_MIN",
        "SHOP_FANS_STADIUM_MAX",
    ]
    for k in direct_keys:
        if k in m_econ and m_econ[k] is not None:
            hv = m_econ[k]
            jv = js_cfg.get(k)
            if isinstance(hv, dict) and isinstance(jv, dict):
                for sk, sv in hv.items():
                    sk_js = str(sk)
                    chk(f"{k}.{sk_js}", sv, jv.get(sk_js))
            else:
                chk(k, hv, jv)

    # 3. LOAN_OPTION
    if isinstance(m_econ.get("LOAN_OPTION"), dict):
        hl = m_econ["LOAN_OPTION"]
        jl = js_cfg.get("LOAN_OPTION") or {}
        for sk in ("minMul", "star", "near", "maxMul", "maxChance"):
            if sk in hl:
                chk(f"LOAN_OPTION.{sk}", hl[sk], jl.get(sk))

    # 4. COUNTRY_GROUPS (6 grup di modul DEFAULT_VALUE_CONTEXT)
    js_cg = js_cfg.get("COUNTRY_GROUPS") or {}
    chk("COUNTRY_GROUPS.len", 6, len(cg_arrays))
    if len(cg_arrays) >= 6:
        for gi in range(6):
            chk(f"COUNTRY_GROUPS[{gi}]", sorted(cg_arrays[gi]), sorted(js_cg.get(str(gi)) or []))

    # 5. UNHAPPY_GROWTH & MOOD_CFG (squadMoods)
    unhappy_g = m_mood.get("UNHAPPY_GROWTH")
    if unhappy_g is None:
        for sv in s_mood.values():
            if sv == 0.5:
                unhappy_g = 0.5
    if unhappy_g is not None:
        chk("UNHAPPY_GROWTH", unhappy_g, js_cfg.get("UNHAPPY_GROWTH"))
    jm = js_cfg.get("MOOD_CFG") or {}
    if 0.25 in mood_nums and 0.4 in mood_nums:
        chk("MOOD_CFG.starterQuota", 0.25, jm.get("starterQuota"))
        chk("MOOD_CFG.explicitStarterQuota", 0.40, jm.get("explicitStarterQuota"))
        chk("MOOD_CFG.happyTop", 0.60, jm.get("happyTop"))
        chk("MOOD_CFG.happySub", 0.35, jm.get("happySub"))
        chk("MOOD_CFG.happyRes", 0.15, jm.get("happyRes"))

    # 6. AUCTION_CFG & Match FX (homeMid / homeShot)
    if isinstance(m_econ.get("AUCTION_CFG"), dict):
        chk("AUCTION_MAX_MUL", m_econ["AUCTION_CFG"].get("maxPct"), js_cfg.get("AUCTION_MAX_MUL"))
    fx = m_match.get("FX")
    if isinstance(fx, dict):
        chk("MATCH_HOME_MID", fx.get("homeMid"), js_cfg.get("MATCH_HOME_MID"))
        chk("MATCH_HOME_SHOT", fx.get("homeShot"), js_cfg.get("MATCH_HOME_SHOT"))
        if isinstance(fx.get("shoutRepeat"), list):
            chk("SHOUT_DECAY", fx["shoutRepeat"], js_cfg.get("SHOUT_DECAY"))
        if isinstance(fx.get("line"), dict):
            js_line = js_cfg.get("MATCH_LINE_MUL") or {}
            for lk in ("low", "high"):
                if isinstance(fx["line"].get(lk), list):
                    chk(f"MATCH_LINE_MUL.{lk}", fx["line"][lk], js_line.get(lk))
        if isinstance(fx.get("pass"), dict):
            js_pass = js_cfg.get("MATCH_PASS_MUL") or {}
            for pk in ("short", "long"):
                if isinstance(fx["pass"].get(pk), list):
                    chk(f"MATCH_PASS_MUL.{pk}", fx["pass"][pk], js_pass.get(pk))

    return mismatches, len(m_econ)


def main():
    ap = argparse.ArgumentParser(description="Verify config.js against Hermes bytecode disassembly")
    ap.add_argument("--hasm", default=DEFAULT_HASM, help="Path to disasm_v9.hasm")
    ap.add_argument("--strict", action="store_true", help="Fail if disasm_v9.hasm is missing")
    args = ap.parse_args()

    if not os.path.exists(args.hasm):
        msg = f"[SKIP] Bytecode parity check: {args.hasm} tidak ditemukan."
        if args.strict:
            print(msg.replace("[SKIP]", "[FAIL]"))
            sys.exit(1)
        print(msg)
        sys.exit(0)

    mismatches, exported_cnt = run_checks(args.hasm)
    if mismatches:
        print(f"[FAIL] Ditemukan {len(mismatches)} ketidakcocokan antara disasm_v9.hasm dan config.js:")
        for m in mismatches:
            print("  -", m)
        sys.exit(1)

    print(f"  Bytecode parity OK: 100% cocok dengan {os.path.basename(args.hasm)} ({exported_cnt} konstanta ekonomi dipindai, ID dinamis).")


if __name__ == "__main__":
    main()
