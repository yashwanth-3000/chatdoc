import styles from "./page.module.css";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundBoxes} aria-hidden="true" />

      <SiteHeader currentPage="home" />

      <main className={styles.main}>
        <Hero />
      </main>
    </div>
  );
}
