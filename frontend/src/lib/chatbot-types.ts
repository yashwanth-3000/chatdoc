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
