export type GenerateMode = "support" | "docs" | "helpdesk";

export type GeneratedFile = {
  relative_path: string;
  content: string;
};

export type GenerateBotResponse = {
  bot_name: string;
  output_path?: string | null;
  zip_path?: string | null;
  files: GeneratedFile[];
  warnings: string[];
  source_metadata?: Record<string, unknown> | null;
};

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

export type ExistingFoundryConnectPayload = {
  controlPlaneUrl: string;
  apiKey: string;
  gatewayBaseUrl?: string;
  dataRoutingDestination?: string;
};

export type FoundryInventorySection = {
  key: string;
  title: string;
  description: string;
  status: "ok" | "error";
  count: number;
  records?: unknown[];
  raw?: unknown;
  error?: {
    status: number;
    message: string;
  };
};

export type ExistingFoundryConnectResponse = {
  connected: boolean;
  connection: {
    status: "connected" | "partial" | "failed";
    checkedAt: string;
    controlPlaneUrl: string;
    gatewayBaseUrl: string;
    dataRoutingDestination: string;
    okSections: number;
    failedSections: number;
  };
  credentialHandling: {
    stored: boolean;
    message: string;
  };
  highlights: {
    models: number;
    providerAccounts: number;
    mcpServers: number;
    guardrails: number;
    workspaces: number;
    ledgers: number;
  };
  sections: FoundryInventorySection[];
};
