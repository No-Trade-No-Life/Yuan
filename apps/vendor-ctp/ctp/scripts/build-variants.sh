#!/usr/bin/env bash
set -euo pipefail

# Always work relative to the CTP project root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${CTP_ROOT}"

# Recreate the build directory for each variant to avoid mixing artifacts.
rm -rf build
mkdir -p build/prod build/cp build/demo

cmake -S . -B build/prod -DCTP_BUILD_VARIANT=prod
cmake --build build/prod --target main_linux

cmake -S . -B build/cp -DCTP_BUILD_VARIANT=cp
cmake --build build/cp --target main_linux_cp

cmake -S . -B build/demo -DCTP_BUILD_VARIANT=demo
cmake --build build/demo --target main_linux_demo

# Drop unnecessary CMake outputs to keep the package lightweight.
rm -rf build/*/CMakeFiles build/*/Makefile build/*/cmake_install.cmake build/*/CMakeCache.txt
