#!/usr/bin/env bash
# 90-summary: pretty final output
set -Eeuo pipefail

# shellcheck disable=SC1090
[[ -f "$BACKEND_DIR/.env.secrets" ]] && source "$BACKEND_DIR/.env.secrets"

mask() { local s="$1"; [[ -z "$s" ]] && echo "(unset)" || echo "${s:0:12}...${s: -8}"; }

MW_SECRET="(see ${MIDDLEWARE_DIR}/.env)"
if [[ -n "${MIDDLEWARE_SHARED_SECRET_GENERATED:-}" ]]; then
  MW_SECRET="$MIDDLEWARE_SHARED_SECRET_GENERATED"
fi

cat <<EOF

================================================================
  VMS DEV stack is up
================================================================
  App:           ${PUBLIC_BASE_URL}/
  Supabase API:  ${PUBLIC_BASE_URL}/supabase/           (-> Kong 127.0.0.1:${KONG_HTTP_PORT})
  Middleware:    ${PUBLIC_BASE_URL}/api/health          (-> 127.0.0.1:${MIDDLEWARE_PORT})
  Studio:        ${PUBLIC_BASE_URL}/studio/             (basic auth)

  Studio login:        ${DASHBOARD_USERNAME} / ${DASHBOARD_PASSWORD}
  ANON_KEY:            $(mask "${ANON_KEY:-}")
  SERVICE_ROLE_KEY:    $(mask "${SERVICE_ROLE_KEY:-}")
  Middleware secret:   ${MW_SECRET}

  Full secrets:        ${BACKEND_DIR}/.env.secrets   (chmod 600)
  Middleware env:      ${MIDDLEWARE_DIR}/.env

  Logs:
    Deploy:      ${LOG_FILE}
    Nginx:       ${LOGS_DIR}/{access,error}.log
    Middleware:  journalctl -u vms-middleware -f
    Supabase:    cd ${BACKEND_DIR} && docker compose logs -f kong auth rest functions

  Common commands:
    cd ${BACKEND_DIR}
    docker compose ps
    docker compose restart functions
    systemctl status nginx vms-middleware

  NEXT STEPS (one-time):
    1) Open ${PUBLIC_BASE_URL}/studio/  and log in.
       Create first admin user under Authentication -> Users.
    2) In SQL editor:
         insert into public.user_roles (user_id, role)
         values ('<new-user-uuid>', 'sharvi_admin');
    3) Add edge-function secrets to ${BACKEND_DIR}/.env then
       \`docker compose restart functions\`:
         RESEND_API_KEY, CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET,
         SAP_MIDDLEWARE_KEY  (must equal middleware MIDDLEWARE_SHARED_SECRET)
    4) Edit SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD in
       ${MIDDLEWARE_DIR}/.env then \`systemctl restart vms-middleware\`.
    5) Open ${PUBLIC_BASE_URL}/ and sign in.
================================================================
EOF
