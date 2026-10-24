#!/usr/bin/env python3
"""Resolve {{placeholders}} in a portfolio JSON file.

Usage:
    python resolve_portfolio.py portfolio.json portfolio.resolved.json [--keep-variables]

Variable sources (later wins):
    1. Derived defaults: since, experience, currentRole
    2. An optional top-level "variables" block in the JSON itself, e.g.
         "variables": { "experience": "{{years}}+ years of experience", "years": "4" }
       Values in that block may reference other variables.

Unknown placeholders are left as-is and reported, so nothing fails silently.
"""
import json
import re
import sys
from datetime import date

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def derive_defaults(data: dict) -> dict:
    """Compute variables from the data itself (never from placeholders)."""
    start = data.get("profile", {}).get("experienceStart", "")
    out = {}
    m = re.match(r"^(\d{4})-(\d{2})$", start)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        today = date.today()
        years = today.year - y - (1 if today.month < mo else 0)
        out["since"] = f"{MONTHS[mo - 1]} {y}"
        out["years"] = str(years)
        out["experience"] = f"{years}+ years of experience"
    current = next((e for e in data.get("experience", []) if e.get("end") is None), None)
    if current:
        out["currentRole"] = current.get("role", "")
    return out


def substitute(text: str, variables: dict, missing: set) -> str:
    def repl(match):
        key = match.group(1)
        if key in variables:
            return str(variables[key])
        missing.add(key)
        return match.group(0)
    return PATTERN.sub(repl, text)


def build_variables(data: dict) -> dict:
    variables = derive_defaults(data)
    variables.update(data.get("variables", {}))
    # Let variables reference each other (a few passes handles chains)
    for _ in range(5):
        changed = False
        for key, val in list(variables.items()):
            if isinstance(val, str):
                new = substitute(val, variables, set())
                if new != val:
                    variables[key] = new
                    changed = True
        if not changed:
            break
    return variables


def resolve(node, variables: dict, missing: set):
    if isinstance(node, str):
        return substitute(node, variables, missing)
    if isinstance(node, list):
        return [resolve(n, variables, missing) for n in node]
    if isinstance(node, dict):
        return {k: resolve(v, variables, missing) for k, v in node.items()}
    return node


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keep_vars = "--keep-variables" in sys.argv
    if len(args) != 2:
        sys.exit(__doc__)
    src, dst = args

    with open(src, encoding="utf-8") as f:
        data = json.load(f)

    # experienceStart must be a real date; it can't depend on {{since}}
    if "{{" in data.get("profile", {}).get("experienceStart", ""):
        sys.exit("experienceStart contains a placeholder; set it to e.g. '2022-09'.")

    variables = build_variables(data)
    missing = set()
    body = {k: v for k, v in data.items() if k != "variables"}
    out = resolve(body, variables, missing)
    if keep_vars and "variables" in data:
        out["variables"] = data["variables"]

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"Resolved with: {variables}")
    if missing:
        print(f"WARNING unresolved placeholders left: {sorted(missing)}")


if __name__ == "__main__":
    main()
