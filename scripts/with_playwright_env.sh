#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
playwright_lib_dir="${repo_root}/.playwright-runtime/usr/lib/x86_64-linux-gnu"

if [[ -d "${playwright_lib_dir}" ]]; then
  if [[ -n "${LD_LIBRARY_PATH:-}" ]]; then
    export LD_LIBRARY_PATH="${playwright_lib_dir}:${LD_LIBRARY_PATH}"
  else
    export LD_LIBRARY_PATH="${playwright_lib_dir}"
  fi
fi

exec "$@"
