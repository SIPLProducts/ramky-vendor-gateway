#!/usr/bin/env bash
# 80-firewall: allow 22 + 80 only
set -Eeuo pipefail

if ufw status | grep -q "Status: active"; then
  log "Configuring ufw"
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
else
  log "Enabling ufw (allowing 22 + 80 only)"
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw --force enable
fi
ufw status | sed 's/^/  /'
