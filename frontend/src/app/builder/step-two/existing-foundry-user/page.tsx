import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { FoundryAccess } from "@/components/product/foundry-access";

export const metadata: Metadata = {
  title: "Existing Foundry User - ChatDock",
  description:
    "Connect an existing TrueFoundry tenant and inspect models, ledgers, tools, workspaces, and gateway policy.",
};

export default function ExistingFoundryUserPage() {
  return (
    <AppFrame currentPage="builder">
      <FoundryAccess mode="existing" />
    </AppFrame>
  );
}
