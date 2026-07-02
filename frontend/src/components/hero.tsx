"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import styles from "./hero.module.css";

const leadLine = "Build chatbots that survive real";

// Trailing phrase that cycles - each names a real failure mode a production
// chatbot has to ride out, which is exactly what ChatDock configures for.
const rotatingPhrases = [
  "traffic.",
  "rate limits.",
  "provider outages.",
  "429 storms.",
  "model failures.",
  "prompt abuse.",
];

const easeOutExpo: [number, number, number, number] = [0.22, 1, 0.36, 1];

const headingMotion: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.72, delay: 0.05, ease: easeOutExpo },
  },
};

const copyMotion: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.74, delay: 0.46, ease: easeOutExpo },
  },
};

const mockupMotion: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.98, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, delay: 0.64, ease: easeOutExpo },
  },
};

function RotatingPhrase() {
  const [titleNumber, setTitleNumber] = useState(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((n) => (n === rotatingPhrases.length - 1 ? 0 : n + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber]);

  return (
    <span className={styles.rotor}>
      &nbsp;
      {rotatingPhrases.map((title, index) => (
        <motion.span
          key={title}
          className={styles.rotorItem}
          initial={{ opacity: 0, y: -100 }}
          transition={{ type: "spring", stiffness: 50 }}
          animate={
            titleNumber === index
              ? { y: 0, opacity: 1 }
              : { y: titleNumber > index ? -150 : 150, opacity: 0 }
          }
        >
          {title}
        </motion.span>
      ))}
    </span>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <h1 className={styles.title}>
          <motion.span
            className={styles.line}
            variants={headingMotion}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="show"
          >
            {leadLine}
          </motion.span>
          <span className={styles.line}>
            <RotatingPhrase />
          </span>
        </h1>

        <motion.p
          className={styles.lead}
          variants={copyMotion}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="show"
        >
          ChatDock lets teams design a website chat widget, choose model routes, scope
          Gateway actions, add guardrails, set budgets, and ship one embed that recovers
          when a provider fails.
        </motion.p>

        <motion.div
          className={styles.actions}
          variants={copyMotion}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="show"
        >
          <Link href="/builder" className={styles.primary}>
            Configure a bot
            <ArrowRight className={styles.arrow} />
          </Link>
          <Link href="/demo" className={styles.secondary}>
            View demo
          </Link>
        </motion.div>
      </div>

      <motion.div
        className={styles.media}
        variants={mockupMotion}
        initial={shouldReduceMotion ? false : "hidden"}
        animate="show"
      >
        <div className={styles.mediaFrame}>
          <iframe
            src="https://www.youtube.com/embed/RJMUyunJStk"
            title="ChatDock demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </motion.div>
    </section>
  );
}
