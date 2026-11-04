#!/usr/bin/env bash
set -euo pipefail
curl --fail --silent --show-error http://localhost:8000/health
printf '\n'
curl --fail --silent --show-error http://localhost:8080/healthz
printf '\n'
if [[ -f sample_data/students.csv ]]; then
  curl --fail --silent --show-error -X POST \
    -F 'file=@sample_data/students.csv' \
    http://localhost:8080/api/analyze
  printf '\n'
else
  echo 'Run this script from the project root to test the CSV upload.'
fi
