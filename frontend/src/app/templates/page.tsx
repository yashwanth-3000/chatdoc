import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { ChatbotTemplates } from "@/components/product/chatbot-templates";
import styles from "../product-page.module.css";

export const metadata: Metadata = {
  title: "Templates - ChatDock",
  description:
    "Browse chatbot templates for support, docs, helpdesk, fallback routing, MCP tools, and guardrails.",
};

export default function TemplatesPage() {
  return (
    <AppFrame currentPage="templates">
      <div className={styles.page}>
        <section className={styles.content}>
          <ChatbotTemplates />
        </section>
      </div>
    </AppFrame>
  );
}
