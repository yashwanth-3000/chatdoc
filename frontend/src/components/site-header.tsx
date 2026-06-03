import Link from "next/link";
import styles from "./site-header.module.css";

type CurrentPage = "home" | "about" | "templates" | "builder" | "architecture" | "demo";

type SiteHeaderProps = {
  currentPage?: CurrentPage;
};

const navLinks: Array<{ label: string; href: string; page: CurrentPage }> = [
  { label: "Builder", href: "/builder", page: "builder" },
  { label: "Templates", href: "/templates", page: "templates" },
  { label: "Architecture", href: "/architecture", page: "architecture" },
  { label: "Demo", href: "/demo", page: "demo" },
  { label: "Hackathon", href: "/about", page: "about" },
];

export function SiteHeader({ currentPage }: SiteHeaderProps) {
  return (
    <header className={styles.siteHeader}>
      <Link className={styles.brand} href="/" aria-label="ChatDock home">
        <span className={styles.brandMark} aria-hidden="true">
          <span />
          <span />
        </span>
        <span className={styles.brandWord}>ChatDock</span>
      </Link>

      <nav className={styles.mainNav} aria-label="Primary">
        {navLinks.map(({ label, href, page }) => (
          <Link
            key={page}
            href={href}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
