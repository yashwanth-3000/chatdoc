import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { PublishPage } from "@/components/product/publish-page";

export const metadata: Metadata = {
  title: "Publish — ChatDock",
  description: "Install the chatdock-widget package and embed your configured AI chatbot in minutes.",
};

export default function FinalBuilderPage() {
  return (
    <AppFrame currentPage="builder">
      <PublishPage />
    </AppFrame>
  );
}
