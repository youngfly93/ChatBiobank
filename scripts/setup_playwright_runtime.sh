#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
runtime_dir="${repo_root}/.playwright-runtime"
temp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${temp_dir}"
}

trap cleanup EXIT

cd "${temp_dir}"
apt-get download libasound2t64 >/dev/null

deb_path="$(find "${temp_dir}" -maxdepth 1 -name 'libasound2t64_*.deb' | head -n 1)"
if [[ -z "${deb_path}" ]]; then
  echo "Failed to download libasound2t64 package." >&2
  exit 1
fi

rm -rf "${runtime_dir}"
mkdir -p "${runtime_dir}"
dpkg-deb -x "${deb_path}" "${runtime_dir}"

echo "Prepared Playwright runtime at ${runtime_dir}"
