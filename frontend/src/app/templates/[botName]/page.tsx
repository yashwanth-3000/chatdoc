import type { Metadata } from "next";
import { AppFrame } from "@/components/product/app-frame";
import { ChatbotDetail } from "@/components/product/chatbot-detail";
import styles from "../../product-page.module.css";

type BotDetailPageProps = {
  params: Promise<{ botName: string }>;
};

export async function generateMetadata(
  { params }: BotDetailPageProps,
): Promise<Metadata> {
  const { botName } = await params;

  return {
    title: `${botName} - ChatDock`,
    description: `Inspect chatbot configuration files and demo trace output for ${botName}.`,
  };
}

export default async function BotDetailPage({ params }: BotDetailPageProps) {
  const { botName } = await params;

  return (
    <AppFrame currentPage="templates">
      <div className={styles.page}>
        <section className={styles.content}>
          <ChatbotDetail botName={botName} />
        </section>
      </div>
    </AppFrame>
  );
}
