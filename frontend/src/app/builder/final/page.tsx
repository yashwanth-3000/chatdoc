import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { ChatbotBuilder } from "@/components/product/chatbot-builder";

export const metadata: Metadata = {
  title: "Final Builder - ChatDock",
  description: "Finalize a resilient website chatbot with model fallback, MCP tools, budgets, guardrails, and embed output.",
};

export default function FinalBuilderPage() {
  return (
    <AppFrame currentPage="builder">
      <ChatbotBuilder />
    </AppFrame>
  );
}
