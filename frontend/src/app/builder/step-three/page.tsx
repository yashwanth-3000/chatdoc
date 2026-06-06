import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { LiveTestPage } from "@/components/product/live-test-page";

export const metadata: Metadata = {
  title: "Live Test — ChatDock",
  description: "Test your chatbot live against your TrueFoundry gateway and simulate failures.",
};

export default function StepThreePage() {
  return (
    <AppFrame currentPage="builder">
      <LiveTestPage />
    </AppFrame>
  );
}
