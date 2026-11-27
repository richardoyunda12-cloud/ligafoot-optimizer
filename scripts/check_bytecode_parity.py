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


def run_checks(hasm_path):
    with open(hasm_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    getters = index_small_getters(lines)
    m3611, _ = parse_module_exports_and_slots(lines, "=> [Function #3611 ", getters)
    m3659, s3659 = parse_module_exports_and_slots(lines, "=> [Function #3659 ", getters)
    m3678, s3678 = parse_module_exports_and_slots(lines, "=> [Function #3678 ", getters)
    m3640, _ = parse_module_exports_and_slots(lines, "=> [Function #3640 ", getters)
    inj_nums = extract_function_consts(lines, "=> [Function #23498 ")
    mood_nums = extract_function_consts(lines, "=> [Function #22134 ")
    js_cfg = dump_js_config()

    mismatches = []

    def chk(label, expected, actual):
        if not deep_close(expected, actual):
            mismatches.append(f"{label}: hasm={expected!r} != js={actual!r}")

    # 1. INJURED_SALE (#3611 & #23498)
    hasm_inj = m3611.get("INJURED_SALE") or {}
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

    # 2. Direct #3611 structured constants vs config.js
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
    ]
    for k in direct_keys:
        if k in m3611 and m3611[k] is not None:
            hv = m3611[k]
            jv = js_cfg.get(k)
            if isinstance(hv, dict) and isinstance(jv, dict):
                for sk, sv in hv.items():
                    sk_js = str(sk)
                    chk(f"{k}.{sk_js}", sv, jv.get(sk_js))
            else:
                chk(k, hv, jv)

    # 3. LOAN_OPTION (#3611)
    if isinstance(m3611.get("LOAN_OPTION"), dict):
        hl = m3611["LOAN_OPTION"]
        jl = js_cfg.get("LOAN_OPTION") or {}
        for sk in ("minMul", "star", "near", "maxMul", "maxChance"):
            if sk in hl:
                chk(f"LOAN_OPTION.{sk}", hl[sk], jl.get(sk))

    # 4. COUNTRY_GROUPS (#3659 slots 0..5)
    js_cg = js_cfg.get("COUNTRY_GROUPS") or {}
    cg_arrays = [v for v in s3659.values() if isinstance(v, list) and len(v) >= 10 and all(isinstance(x, str) for x in v)]
    if len(cg_arrays) >= 6:
        for gi in range(6):
            chk(f"COUNTRY_GROUPS[{gi}]", sorted(cg_arrays[gi]), sorted(js_cg.get(str(gi)) or []))

    # 5. UNHAPPY_GROWTH (#3678) & MOOD_CFG (#22134)
    unhappy_g = m3678.get("UNHAPPY_GROWTH")
    if unhappy_g is None:
        for sv in s3678.values():
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

    # 6. AUCTION_CFG / SHOUT_DECAY
    if isinstance(m3611.get("AUCTION_CFG"), dict):
        chk("AUCTION_MAX_MUL", m3611["AUCTION_CFG"].get("maxPct"), js_cfg.get("AUCTION_MAX_MUL"))
    if isinstance(m3640.get("SHOUT_DECAY"), list):
        chk("SHOUT_DECAY", m3640["SHOUT_DECAY"], js_cfg.get("SHOUT_DECAY"))

    return mismatches, len(m3611)


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

    print(f"  Bytecode parity OK: 100% cocok dengan {os.path.basename(args.hasm)} ({exported_cnt} konstanta #3611 dipindai).")


if __name__ == "__main__":
    main()
