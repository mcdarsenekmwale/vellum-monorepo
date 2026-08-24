#!/usr/bin/env python3
import json, subprocess, sys, os

def run(cmd):
    return subprocess.run(cmd, shell=True, text=True, capture_output=True).stdout + "\n" + subprocess.run(cmd, shell=True, text=True, capture_output=True).stderr

out = run("agent-browser snapshot -i")
print(out[:4000])
