import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { GatewayDesigner } from "@/components/product/gateway-designer";

export const metadata: Metadata = {
  title: "Gateway Setup - ChatDock",
  description:
    "Configure model routing, MCP tool scope, budgets, fallback behavior, and guardrails for a website chatbot.",
};

export default function BuilderStepTwoPage() {
  return (
    <AppFrame currentPage="builder">
      <GatewayDesigner />
    </AppFrame>
  );
}
