#!/usr/bin/env bash
# Idempotent bootstrap for the Ciatta monorepo (ciatta-web + ciatta-mobile-app).
# Safe to run repeatedly: it only installs what is missing and refreshes deps.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Deno powers the ciatta-mobile-app test suite and the Supabase edge functions.
# Run the installer from $HOME so its bootstrap does not drop a stray deno.lock
# inside the repository tree.
if ! command -v deno >/dev/null 2>&1 && [ ! -x "$HOME/.deno/bin/deno" ]; then
  echo "Installing Deno..."
  ( cd "$HOME" && curl -fsSL https://deno.land/install.sh | sh -s -- -y )
fi
export PATH="$HOME/.deno/bin:$PATH"
deno --version | head -1

# Web app dependencies (Vite + React).
echo "Installing ciatta-web dependencies..."
( cd ciatta-web && npm install )

# Mobile app dependencies (Expo / React Native).
echo "Installing ciatta-mobile-app dependencies..."
( cd ciatta-mobile-app && npm install )

# The mobile app reads Supabase credentials from a local .env at runtime.
# Seed one from the checked-in example so the dev server can boot. Fill in real
# EXPO_PUBLIC_SUPABASE_* values to talk to a live Supabase project.
if [ ! -f ciatta-mobile-app/.env ]; then
  echo "Seeding ciatta-mobile-app/.env from .env.example..."
  cp ciatta-mobile-app/.env.example ciatta-mobile-app/.env
fi

echo "Bootstrap complete."
