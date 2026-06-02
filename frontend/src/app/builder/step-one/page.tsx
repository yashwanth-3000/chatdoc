import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { WidgetDesigner } from "@/components/product/widget-designer";

export const metadata: Metadata = {
  title: "Widget Designer - ChatDock",
  description: "Design the website chatbot widget UI with a real-time preview.",
};

export default function BuilderStepOnePage() {
  return (
    <AppFrame currentPage="builder">
      <WidgetDesigner />
    </AppFrame>
  );
}
