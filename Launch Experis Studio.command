#!/bin/zsh
cd -- "${0:A:h}"
if [[ ! -x .venv-tts/bin/python ]]; then
  print 'First run setup: see README.md in this folder.'
  read '?Press Enter to close.'
  exit 1
fi
.venv-tts/bin/python scripts/launch.py
