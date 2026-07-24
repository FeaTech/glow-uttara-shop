import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Stagger delay in ms. */
  delay?: number;
  once?: boolean;
}

/**
 * Fades + slides its children into view when scrolled near the viewport.
 * Uses IntersectionObserver; respects prefers-reduced-motion via the `.reveal`
 * utility in styles.css.
 */
export function ScrollReveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref as never}
      className={cn("reveal", className)}
      style={{
        ...(delay ? { transitionDelay: `${delay}ms` } : {}),
        ...(visible ? { opacity: 1, transform: "none" } : {}),
      }}
    >
      {children}
    </Tag>
  );
}
