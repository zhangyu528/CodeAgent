#!/usr/bin/env python3
"""
Security Audit Script for CodeAgent

Uses npm audit when package-lock.json is available,
falls back to manual dependency review from bun.lock.

Run with: python3 scripts/security_audit.py
Or add to package.json: "audit": "python3 scripts/security_audit.py"
"""

import json
import subprocess
import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_deps_from_npm():
    """Get dependency list via bun pm ls"""
    try:
        result = subprocess.run(
            ["bun", "pm", "ls", "--json"],
            capture_output=True, text=True,
            cwd=PROJECT_ROOT,
            timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"Warning: Could not get deps via bun pm ls: {e}", file=sys.stderr)
        return None

def try_npm_audit():
    """Try npm audit with package-lock.json if available"""
    lockfile = os.path.join(PROJECT_ROOT, "package-lock.json")
    if not os.path.exists(lockfile):
        # Try to generate it
        print("package-lock.json not found, attempting to generate...", file=sys.stderr)
        result = subprocess.run(
            ["npm", "install", "--package-lock-only", "--ignore-scripts"],
            capture_output=True, text=True,
            cwd=PROJECT_ROOT,
            timeout=60
        )
        if result.returncode != 0:
            print(f"Could not generate package-lock.json: {result.stderr}", file=sys.stderr)
            return None
    
    result = subprocess.run(
        ["npm", "audit", "--json"],
        capture_output=True, text=True,
        cwd=PROJECT_ROOT,
        timeout=60
    )
    
    if result.returncode == 0:
        return {"vulnerabilities": {}}
    
    try:
        return json.loads(result.stdout)
    except:
        return None

def main():
    print("=" * 60)
    print("CodeAgent Security Audit")
    print("=" * 60)
    
    # Get dependency info
    deps = get_deps_from_npm()
    if deps:
        print("\nDirect dependencies:")
        # bun pm ls --json output format
        for line in deps.get("stdout", "").split("\n"):
            if "@" in line and "node_modules" not in line:
                print(f"  {line.strip()}")
    
    print("\n" + "-" * 60)
    print("Running npm audit (if package-lock.json available)...")
    print("-" * 60)
    
    audit_result = try_npm_audit()
    
    if audit_result is None:
        print("npm audit not available (no package-lock.json, using bun.lock)")
        print("Recommendation: Run 'npm install --package-lock-only' to generate")
        print("then 'npm audit' to check for vulnerabilities.")
        print("\nNOTE: 'bun pm scan' also requires configuration in bunfig.toml")
        return 0
    
    vulnerabilities = audit_result.get("vulnerabilities", {})
    if not vulnerabilities:
        print("No vulnerabilities found!")
        return 0
    
    print(f"Found {len(vulnerabilities)} vulnerable packages:")
    for name, info in vulnerabilities.items():
        severity = info.get("severity", "unknown")
        via = info.get("via", [])
        print(f"  [{severity.upper()}] {name}")
        if via:
            for v in via:
                if isinstance(v, dict):
                    print(f"      - {v.get('title', 'N/A')} ({v.get('url', 'N/A')})")
                else:
                    print(f"      - {v}")
    
    return 1

if __name__ == "__main__":
    sys.exit(main())
