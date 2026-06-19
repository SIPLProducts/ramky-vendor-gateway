# Tracing `fetch-tenants-from-sap` end-to-end

This guide explains the structured logs added to the edge function and the
Node.js middleware, and how to enable matching logs in Nginx, Kong, and the
self-hosted edge-runtime so a single request can be followed across every hop.

Every layer is correlated by a single **`reqId`** (UUID). The edge function
generates it (or reuses `x-request-id` if the caller sent one) and forwards it
to the middleware via the `x-request-id` request header. The middleware echoes
it back in the response header of the same name.

## 1. What gets logged

### Edge function — `supabase/functions/fetch-tenants-from-sap/index.ts`

One JSON line per stage:

| stage                    | meaning                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `req.received`           | request hit the worker                                           |
| `auth.ok` / `auth.failed`| JWT validation result                                            |
| `body.parsed`            | parsed email from the body                                       |
| `config.loaded`          | SAP config row, including `proxySecretPresent` (boolean)         |
| `proxy.prepared`         | proxy URL, abort cap, outgoing header keys                       |
| `proxy.fetch.start`      | timestamp just before `fetch()` to the middleware                |
| `proxy.fetch.end`        | elapsed ms, status, response header keys, first 500 bytes        |
| `proxy.fetch.error`      | name, code, cause, stack, `aborted`, `timerFired`, `abortReason` |
| `direct.*`               | same shape, when `connection_mode = direct`                      |
| `sap.parsed`             | tenant count                                                     |
| `response.sent`          | success boolean and total elapsed ms                             |
| `unhandled.error`        | catch-all                                                        |

### Middleware — `middleware/server.js`

| stage                    | meaning                                                  |
| ------------------------ | -------------------------------------------------------- |
| `req.received`           | reqId, client IP, header keys, `middlewareKeyPresent`    |
| `auth.result`            | shared-secret validation result (boolean)                |
| `upstream.prepared`      | SAP URL, method, header keys, username, payload bytes    |
| `upstream.fetch.start`   | timestamp just before fetch to SAP                       |
| `upstream.fetch.end`     | elapsed, SAP status/headers, first 500 bytes of body     |
| `upstream.fetch.error`   | name, code, cause, mapped describeFetchError, stack      |
| `response.sent`          | status returned to edge, total elapsed                   |

Secrets are never printed — only `present` / `***` markers and key names.

## 2. Reading the logs by `reqId`

Once you reproduce a failure, copy the `reqId` from the edge function log
(`stage: "req.received"`) and grep both sides on the VM:

```bash
# Edge function logs (self-hosted Supabase docker compose)
docker compose logs --since=15m functions | grep <reqId>

# Middleware logs (systemd)
journalctl -u vms-middleware --since "15 min ago" | grep <reqId>

# Nginx
grep <reqId> /var/log/nginx/edge_access.log /var/log/nginx/edge_error.log
```

**Whichever side does NOT contain the `reqId` is the side the request never
reached** — that is where the abort is happening.

## 3. Enable correlated logs in Nginx

Add this to the upstream-facing server block (only the `/supabase/` location
so other traffic is unaffected):

```nginx
log_format edge_main escape=json
  '{"ts":"$time_iso8601","reqId":"$http_x_request_id",'
  '"client":"$remote_addr","method":"$request_method","uri":"$request_uri",'
  '"status":$status,"upstream":"$upstream_addr",'
  '"upstream_status":"$upstream_status",'
  '"request_time":$request_time,"upstream_time":"$upstream_response_time",'
  '"connection_closed":"$upstream_connection_close"}';

server {
    # ... existing config ...

    location /supabase/ {
        access_log /var/log/nginx/edge_access.log edge_main;
        error_log  /var/log/nginx/edge_error.log  debug;

        proxy_read_timeout   180s;
        proxy_send_timeout   180s;
        proxy_connect_timeout 30s;

        # Generate a reqId if the client did not provide one, and forward it.
        set $req_id $http_x_request_id;
        if ($req_id = "") { set $req_id $request_id; }
        proxy_set_header X-Request-Id $req_id;

        proxy_pass http://127.0.0.1:8000;   # Kong
    }
}
```

Reload: `nginx -t && systemctl reload nginx`.

> Turn `error_log debug` **off** once you're done debugging — it's verbose and
> can leak request data.

## 4. Enable Kong access logs

Edit `kong.conf` (or set env vars on the Kong container):

```
proxy_access_log = /dev/stdout
admin_access_log = off
log_level        = info
```

To include `reqId` in Kong logs, add the
[`correlation-id`](https://docs.konghq.com/hub/kong-inc/correlation-id/)
plugin globally so Kong reads/echoes `X-Request-Id`. Restart Kong after
the change.

## 5. Self-hosted edge-runtime — the most likely culprit

Current production logs show:

```
[fetch-tenants-from-sap] fetch failed after 90003ms aborted=true
```

i.e. the **edge worker** sat in `fetch()` to the middleware for the full 90 s
in-code cap and never received bytes back. Direct curl from the same VM to
the middleware finishes in ~70 ms. That means the request likely never left
the edge-runtime container in the first place, or its egress was throttled by
the supervisor's wall-clock / CPU limit (default 60 s on many images).

Raise the limits in `docker-compose.override.yml`:

```yaml
services:
  functions:
    environment:
      EDGE_RUNTIME_WORKER_REQUEST_WALL_CLOCK_LIMIT_MS: "150000"
      EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_SOFT_LIMIT_MS: "150000"
      EDGE_RUNTIME_WORKER_REQUEST_CPU_TIME_HARD_LIMIT_MS: "150000"
```

Apply:

```bash
docker compose up -d functions
docker compose logs --tail=30 functions
```

## 6. Assembling a timing summary

After reproducing once, build this table from the grep output (timestamps are
all ISO-8601):

```
Nginx received           <nginx access ts>
Kong upstream            <kong access ts>
Edge   req.received      <edge log>
Edge   proxy.fetch.start <edge log>
MW     req.received      <middleware log>
MW     upstream.fetch.start
MW     upstream.fetch.end   (elapsedMs = SAP time)
MW     response.sent        (elapsedTotalMs = middleware time)
Edge   proxy.fetch.end      (elapsedMs = edge -> mw -> SAP -> mw -> edge)
Edge   response.sent        (elapsedTotalMs)
```

Subtracting adjacent rows tells you exactly which hop is slow.

## 7. What to look at first when you see "The signal has been aborted"

1. Does the middleware log contain the same `reqId`?
   - **No** → the request never left the edge-runtime container. Fix the
     edge-runtime supervisor limits (section 5) and/or Nginx/Kong timeouts.
   - **Yes** → check the middleware's `upstream.fetch.end` / `error` to see if
     SAP was slow. If `upstream.fetch.end` is fast but the edge function still
     timed out, the response was lost between middleware and edge (Kong/Nginx
     buffering or an idle timeout shorter than the SAP call).
2. Cross-check Nginx `request_time` vs `upstream_response_time`. A large gap
   means Nginx held the connection waiting for upstream.

That single piece of evidence is enough to decide whether to raise
edge-runtime limits, Nginx `proxy_read_timeout`, or Kong's upstream timeout.
