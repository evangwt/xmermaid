#!/usr/bin/env bash
set -euo pipefail

echo "=== Building xmermaid ==="

# Build WASM package
echo "[1/3] Building WASM package..."
wasm-pack build crates/xmermaid-wasm --target web --out-dir ../../pkg --scope xmermaid

# Build JS SDK
echo "[2/3] Building JS SDK..."
npx rollup -c

# Run tests
echo "[3/3] Running tests..."
cargo test --workspace
npx vitest run

echo "=== Build complete ==="
