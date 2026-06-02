import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { ChatbotBuilder } from "@/components/product/chatbot-builder";

export const metadata: Metadata = {
  title: "Builder - ChatDock",
  description: "Configure a resilient website chatbot with model fallback, MCP tools, budgets, guardrails, and embed output.",
};

export default function BuilderPage() {
  return (
    <AppFrame currentPage="builder">
      <ChatbotBuilder />
    </AppFrame>
  );
}
