import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import styles from "./app-frame.module.css";

type CurrentPage = "home" | "builder" | "demo";

type AppFrameProps = {
  children: ReactNode;
  currentPage?: CurrentPage;
};

export function AppFrame({ children, currentPage }: AppFrameProps) {
  return (
    <div className={styles.page}>
      <div className={styles.gridBackdrop} aria-hidden="true" />

      <SiteHeader currentPage={currentPage} />

      <main className={styles.main}>{children}</main>
    </div>
  );
}
