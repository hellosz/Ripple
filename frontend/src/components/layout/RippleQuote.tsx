"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const QUOTES = [
  {
    text: "Creativity is intelligence having fun.",
    author: "Albert Einstein",
  },
  {
    text: "No one has ever become poor by giving.",
    author: "Anne Frank",
  },
  {
    text: "Alone we can do so little; together we can do so much.",
    author: "Helen Keller",
  },
  {
    text: "The purpose of life is to find your gift and give it away.",
    author: "Pablo Picasso",
  },
  {
    text: "We make a living by what we get, but we make a life by what we give.",
    author: "Winston Churchill",
  },
];

type Phase = "in" | "visible" | "out";

export function RippleQuote() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("in");

  const quote = QUOTES[index];
  const fullText = `"${quote.text}" — ${quote.author}`;
  const chars = useMemo(() => fullText.split(""), [fullText]);

  // Wave duration based on character count
  const waveDuration = chars.length * 20 + 400; // ms for full wave to complete

  const cycleNext = useCallback(() => {
    setPhase("out");

    // After out-wave completes, switch quote and wave in
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
      setPhase("in");

      // After in-wave completes, mark as visible
      setTimeout(() => {
        setPhase("visible");
      }, waveDuration);
    }, waveDuration);
  }, [waveDuration]);

  // Initial wave-in
  useEffect(() => {
    const timer = setTimeout(() => setPhase("visible"), waveDuration);
    return () => clearTimeout(timer);
  }, [waveDuration]);

  // Schedule next cycle: random 6-9s after becoming visible
  useEffect(() => {
    if (phase !== "visible") return;
    const delay = 6000 + Math.random() * 3000;
    const timer = setTimeout(cycleNext, delay);
    return () => clearTimeout(timer);
  }, [phase, cycleNext]);

  return (
    <p className="mt-6 max-w-2xl mx-auto text-sm md:text-base leading-relaxed h-[3em] flex items-center justify-center">
      <span className="inline" aria-label={fullText}>
        {chars.map((char, i) => {
          // Stagger delay: wave flows left-to-right
          const delay = i * 20;

          // Determine animation class based on phase
          let style: React.CSSProperties;
          if (phase === "in") {
            style = {
              animationName: "ripple-char-in",
              animationDuration: "0.5s",
              animationDelay: `${delay}ms`,
              animationFillMode: "both",
              animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            };
          } else if (phase === "out") {
            style = {
              animationName: "ripple-char-out",
              animationDuration: "0.4s",
              animationDelay: `${delay}ms`,
              animationFillMode: "both",
              animationTimingFunction: "cubic-bezier(0.55, 0, 1, 0.45)",
            };
          } else {
            style = { opacity: 1 };
          }

          // Is this part of the author name (after " — ")?
          const dashIndex = fullText.indexOf(" — ");
          const isAuthor = i >= dashIndex;

          return (
            <span
              key={`${index}-${i}`}
              className={isAuthor ? "text-ripple-400/70" : "text-white/40"}
              style={{ display: "inline-block", whiteSpace: "pre", ...style }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}
      </span>
    </p>
  );
}
