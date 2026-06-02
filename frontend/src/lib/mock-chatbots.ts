export type BotTemplateRow = {
  id: string;
  bot_name: string;
  display_name: string | null;
  description: string | null;
  use_case: string;
  has_zip: boolean;
  file_count: number;
  created_at: string;
  source_metadata: Record<string, unknown>;
};

export type BotTemplateFileRow = {
  id: string;
  bot_id: string;
  relative_path: string;
  content: string;
  size_bytes: number;
  created_at: string;
};

export type BotTemplateWithFiles = BotTemplateRow & {
  bot_files: BotTemplateFileRow[];
};

let mockChatbots: BotTemplateRow[] = [
  {
    id: "support-blueprint",
    bot_name: "saas-support-copilot",
    display_name: "SaaS Support Copilot",
    description:
      "A website assistant template for plan questions, docs lookup, ticket creation, fallback routing, and PII-safe support conversations.",
    use_case: "support",
    has_zip: true,
    file_count: 4,
    created_at: "2026-06-02T08:00:00.000Z",
    source_metadata: {
      primary_model: "bedrock/deepseek-v3",
      fallback_model: "openai/gpt-5.5",
      budget: "$50/day",
    },
  },
  {
    id: "docs-blueprint",
    bot_name: "developer-docs-guide",
    display_name: "Developer Docs Guide",
    description:
      "A docs chatbot template with MCP search tools, GitHub issue lookup, tool argument validation, and request trace visibility.",
    use_case: "docs",
    has_zip: true,
    file_count: 4,
    created_at: "2026-06-01T15:45:00.000Z",
    source_metadata: {
      primary_model: "openai/gpt-5.5",
      fallback_model: "bedrock/claude-sonnet",
      guardrail: "tool validation",
    },
  },
  {
    id: "campus-blueprint",
    bot_name: "campus-helpdesk-agent",
    display_name: "Campus Helpdesk Agent",
    description:
      "A public helpdesk assistant recipe for FAQ answers, calendar lookup, safe escalation, and policy-based unsafe-input blocking.",
    use_case: "helpdesk",
    has_zip: false,
    file_count: 3,
    created_at: "2026-05-31T11:20:00.000Z",
    source_metadata: {
      primary_model: "gemini/flash",
      fallback_model: "openai/gpt-5.5",
      guardrail: "unsafe input block",
    },
  },
];

const mockBotFiles: Record<string, BotTemplateFileRow[]> = {
  "saas-support-copilot": [
    {
      id: "support-file-1",
      bot_id: "support-blueprint",
      relative_path: "chatdock.config.json",
      content: JSON.stringify(
        {
          name: "SaaS Support Copilot",
          widget: { position: "bottom-right", tone: "calm, concise, helpful" },
          truefoundry: {
            aiGateway: {
              virtualModel: "prod-support",
              primary: "bedrock/deepseek-v3",
              fallback: "openai/gpt-5.5",
              rateLimit: "10 requests per minute",
              dailyBudgetUsd: 50,
            },
            mcpGateway: {
              allowedTools: ["docs.search", "linear.create_ticket", "billing.lookup_plan"],
              disabledTools: ["linear.delete_attachment"],
            },
            guardrails: ["PII redaction", "Unsafe input block", "Tool argument validation"],
          },
        },
        null,
        2,
      ),
      size_bytes: 640,
      created_at: "2026-06-02T08:00:00.000Z",
    },
    {
      id: "support-file-2",
      bot_id: "support-blueprint",
      relative_path: "embed.js",
      content:
        "window.ChatDock.mount({ bot: 'saas-support-copilot', position: 'bottom-right', gateway: '/api/chatdock/saas-support-copilot', traceRecovery: true });\n",
      size_bytes: 148,
      created_at: "2026-06-02T08:00:00.000Z",
    },
    {
      id: "support-file-3",
      bot_id: "support-blueprint",
      relative_path: "guardrails.md",
      content:
        "# Guardrails\n\n- Redact PII before LLM calls.\n- Block unsafe inputs.\n- Validate MCP arguments.\n- Inspect tool results before returning them to the assistant.\n",
      size_bytes: 154,
      created_at: "2026-06-02T08:00:00.000Z",
    },
    {
      id: "support-file-4",
      bot_id: "support-blueprint",
      relative_path: "demo-trace.md",
      content:
        "# Demo Trace\n\n1. User asks a billing question.\n2. Primary model is rate limited.\n3. TrueFoundry AI Gateway falls back to GPT 5.5.\n4. MCP Gateway allows billing lookup and ticket creation only.\n5. The assistant preserves conversation state and replies.\n",
      size_bytes: 254,
      created_at: "2026-06-02T08:00:00.000Z",
    },
  ],
  "developer-docs-guide": [
    {
      id: "docs-file-1",
      bot_id: "docs-blueprint",
      relative_path: "chatdock.config.json",
      content:
        "{\n  \"name\": \"Developer Docs Guide\",\n  \"tools\": [\"docs.search\", \"github.search_issues\"],\n  \"guardrails\": [\"Tool argument validation\", \"Tool result inspection\"]\n}\n",
      size_bytes: 160,
      created_at: "2026-06-01T15:45:00.000Z",
    },
    {
      id: "docs-file-2",
      bot_id: "docs-blueprint",
      relative_path: "embed.js",
      content:
        "window.ChatDock.mount({ bot: 'developer-docs-guide', position: 'inline', gateway: '/api/chatdock/developer-docs-guide' });\n",
      size_bytes: 125,
      created_at: "2026-06-01T15:45:00.000Z",
    },
    {
      id: "docs-file-3",
      bot_id: "docs-blueprint",
      relative_path: "guardrails.md",
      content:
        "# Guardrails\n\nValidate search query arguments, block destructive GitHub tools, and inspect retrieved issue text before model synthesis.\n",
      size_bytes: 132,
      created_at: "2026-06-01T15:45:00.000Z",
    },
    {
      id: "docs-file-4",
      bot_id: "docs-blueprint",
      relative_path: "demo-trace.md",
      content:
        "# Demo Trace\n\nShow a docs lookup, tool validation, and request trace with token and latency metrics.\n",
      size_bytes: 96,
      created_at: "2026-06-01T15:45:00.000Z",
    },
  ],
  "campus-helpdesk-agent": [
    {
      id: "campus-file-1",
      bot_id: "campus-blueprint",
      relative_path: "chatdock.config.json",
      content:
        "{\n  \"name\": \"Campus Helpdesk Agent\",\n  \"tools\": [\"faq.search\", \"calendar.find_slot\"],\n  \"guardrails\": [\"Unsafe input block\", \"PII redaction\"]\n}\n",
      size_bytes: 152,
      created_at: "2026-05-31T11:20:00.000Z",
    },
    {
      id: "campus-file-2",
      bot_id: "campus-blueprint",
      relative_path: "guardrails.md",
      content:
        "# Guardrails\n\nReject unsafe visitor input, redact student identifiers, and escalate policy-sensitive requests to a human.\n",
      size_bytes: 118,
      created_at: "2026-05-31T11:20:00.000Z",
    },
    {
      id: "campus-file-3",
      bot_id: "campus-blueprint",
      relative_path: "demo-trace.md",
      content:
        "# Demo Trace\n\nShow a blocked unsafe prompt, a safe FAQ answer, and a graceful escalation path.\n",
      size_bytes: 91,
      created_at: "2026-05-31T11:20:00.000Z",
    },
  ],
};

function waitForDemoData() {
  return new Promise((resolve) => window.setTimeout(resolve, 180));
}

export async function fetchBotTemplates(): Promise<BotTemplateRow[]> {
  await waitForDemoData();
  return [...mockChatbots].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function fetchBotTemplateDetail(
  botName: string,
): Promise<BotTemplateWithFiles | null> {
  await waitForDemoData();

  const bot = mockChatbots.find((row) => row.bot_name === botName);
  if (!bot) return null;

  return {
    ...bot,
    bot_files: [...(mockBotFiles[botName] ?? [])],
  };
}

export async function deleteBotTemplate(botName: string): Promise<boolean> {
  await waitForDemoData();
  mockChatbots = mockChatbots.filter((row) => row.bot_name !== botName);
  delete mockBotFiles[botName];
  return true;
}
