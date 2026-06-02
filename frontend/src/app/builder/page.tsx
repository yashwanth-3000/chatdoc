import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { BuilderStart } from "@/components/product/builder-start";

export const metadata: Metadata = {
  title: "Builder - ChatDock",
  description: "Start building a governed website chatbot with ChatDock.",
};

export default function BuilderPage() {
  return (
    <AppFrame currentPage="builder">
      <BuilderStart />
    </AppFrame>
  );
}
