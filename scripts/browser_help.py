#!/usr/bin/env python3
import subprocess, sys

def run(cmd):
    r = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    return (r.stdout or "") + ("\nERR: " if r.stderr else "") + (r.stderr or "")

def snap():
    out = run("agent-browser snapshot")
    print(out[:5000])

print(run("agent-browser get url"))
