import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Monitor, Server } from "lucide-react";

export function SapConnectivityGuide() {
  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">How SAP Connection Works</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Lovable Cloud cannot reach SAP's private IP (<code className="px-1 py-0.5 bg-muted rounded text-xs">10.200.1.2</code>) directly.
          The <strong>SAP Sync</strong> button calls a Node.js middleware running inside your network, which then forwards the request to SAP.
          Save the middleware's <strong>base URL only</strong> below — the system appends{" "}
          <code className="px-1 py-0.5 bg-muted rounded text-xs">/sap/bp/create</code> automatically.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Lovable Cloud Preview</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                App → Backend Function → ngrok → local middleware → SAP
              </p>
              <p className="text-xs text-muted-foreground">
                Set <strong>"Node.js Middleware URL"</strong> to your <strong>public ngrok URL</strong>
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">e.g. https://abc123.ngrok-free.app</p>
            </CardContent>
          </Card>

          <Card className="border bg-background">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">Self-Hosted / Client Server</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Backend Function → internal middleware → SAP
              </p>
              <p className="text-xs text-muted-foreground">
                Set <strong>"Node.js Middleware URL"</strong> to a URL reachable from the public internet (reverse proxy with TLS).
              </p>
              <p className="text-[11px] text-muted-foreground">
                Default port: <code className="px-1 bg-muted rounded">3002</code>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-3 space-y-2">
          <p className="font-semibold text-foreground">Required setup checklist:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              In <code className="px-1 py-0.5 bg-muted rounded">middleware/.env</code> set:{" "}
              <code className="px-1 py-0.5 bg-muted rounded">MIDDLEWARE_SHARED_SECRET</code>,{" "}
              <code className="px-1 py-0.5 bg-muted rounded">SAP_BP_API_URL</code>,{" "}
              <code className="px-1 py-0.5 bg-muted rounded">SAP_BP_USERNAME</code>,{" "}
              <code className="px-1 py-0.5 bg-muted rounded">SAP_BP_PASSWORD</code>, then{" "}
              <code className="px-1 py-0.5 bg-muted rounded">node server.js</code>.
            </li>
            <li>Expose port 3002 publicly (e.g. <code className="px-1 py-0.5 bg-muted rounded">ngrok http 3002</code>).</li>
            <li>
              In the <strong>Business Partner</strong> SAP API config above, set Connection Mode = <em>Via Proxy Server</em>,
              paste the public URL into <strong>Node.js Middleware URL</strong>, and copy the same{" "}
              <code className="px-1 py-0.5 bg-muted rounded">MIDDLEWARE_SHARED_SECRET</code> into{" "}
              <strong>Proxy Secret / Password</strong>.
            </li>
            <li>Click <strong>Test SAP connection</strong> → should return HTTP 200 from the middleware.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
