import { Router } from "express";
import { z } from "zod";
import {
  connectExistingFoundryUser,
  getSavedExistingFoundryInventory,
  applyGuardrailPolicy,
} from "./service.js";
import { DEMO_SENTINEL, demoConfig, demoPublicConfig, resolveApiKey } from "../demo-credentials.js";

const connectSchema = z.object({
  controlPlaneUrl: z.string().trim().min(1, "TrueFoundry control plane URL is required."),
  apiKey: z.string().trim().min(1, "A TrueFoundry PAT or VAT is required."),
  gatewayBaseUrl: z.string().trim().optional().or(z.literal("")),
  dataRoutingDestination: z.string().trim().optional().or(z.literal("")),
});

export const existingFoundryUserRouter = Router();

existingFoundryUserRouter.get("/saved-inventory", async (_request, response, next) => {
  try {
    response.json(await getSavedExistingFoundryInventory());
  } catch (error) {
    next(error);
  }
});

// Judge/demo mode — evaluators without a TrueFoundry tenant connect with
// ChatDock's own credentials, which never leave the server.
existingFoundryUserRouter.get("/demo-availability", (_request, response) => {
  response.json(demoPublicConfig());
});

existingFoundryUserRouter.post("/demo-connect", async (_request, response, next) => {
  const demo = demoConfig();
  if (!demo) {
    return response.status(503).json({ error: "Judge demo mode is not configured on this server." });
  }
  try {
    response.json(await connectExistingFoundryUser(demo));
  } catch (error) {
    next(error);
  }
});

existingFoundryUserRouter.post("/apply-guardrail-policy", async (request, response, next) => {
  try {
    const rawKey = request.body.apiKey;
    if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
      return response.status(400).json({ error: "apiKey is required." });
    }
    const apiKey = resolveApiKey(rawKey.trim());
    if (rawKey.trim() === DEMO_SENTINEL && !apiKey) {
      return response.status(503).json({ error: "Judge demo mode is not configured on this server." });
    }
    const result = await applyGuardrailPolicy({ apiKey });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

existingFoundryUserRouter.post("/connect", async (request, response, next) => {
  try {
    const payload = connectSchema.parse(request.body);
    const result = await connectExistingFoundryUser(payload);
    response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "Invalid TrueFoundry connection details.",
        issues: error.issues.map((issue) => issue.message),
      });
      return;
    }

    next(error);
  }
});
