import { Router } from "express";
import { z } from "zod";
import {
  connectExistingFoundryUser,
  getSavedExistingFoundryInventory,
  applyGuardrailPolicy,
} from "./service.js";

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

existingFoundryUserRouter.post("/apply-guardrail-policy", async (request, response, next) => {
  try {
    const { apiKey } = request.body;
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return response.status(400).json({ error: "apiKey is required." });
    }
    const result = await applyGuardrailPolicy({ apiKey: apiKey.trim() });
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
