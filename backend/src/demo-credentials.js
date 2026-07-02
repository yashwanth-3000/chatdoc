// Judge/demo mode: hackathon evaluators without a TrueFoundry tenant can use
// ChatDock's own tenant. The real credentials live only in backend env vars;
// the browser holds DEMO_SENTINEL in place of a key and never sees the real one.
export const DEMO_SENTINEL = "__chatdock_demo__";

export function demoConfig() {
  const apiKey = (process.env.TFY_DEMO_API_KEY || "").trim();
  const controlPlaneUrl = (process.env.TFY_DEMO_CONTROL_PLANE_URL || "").trim();
  if (!apiKey || !controlPlaneUrl) return null;

  return {
    controlPlaneUrl,
    gatewayBaseUrl: (process.env.TFY_DEMO_GATEWAY_BASE_URL || "").trim() || undefined,
    dataRoutingDestination: (process.env.TFY_DEMO_DATA_ROUTING || "default").trim(),
    apiKey,
  };
}

// Swap the sentinel for the server-side key. Returns undefined when the client
// sent the sentinel but demo mode is not configured, so callers can 503.
export function resolveApiKey(apiKey) {
  if (apiKey !== DEMO_SENTINEL) return apiKey;
  return demoConfig()?.apiKey;
}
