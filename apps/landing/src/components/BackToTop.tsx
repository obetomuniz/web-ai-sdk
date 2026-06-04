import { useEffect, useState } from "react";
import { backToTop, backToTopArrow } from "../lib/ui.js";

// Mirror ScrollSpy's marker so the button appears at the exact moment the
// first nav item ("Why not raw?") starts being highlighted.
const scrollMarker = (): number => {
  const styles = getComputedStyle(document.documentElement);
  const navHeight = Number.parseFloat(styles.getPropertyValue("--nav-height"));
  return (Number.isFinite(navHeight) ? navHeight : 57) + 24;
};

export const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const firstSection = document.querySelector<HTMLElement>(
      '[data-section="why-raw"]',
    );
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (!firstSection) return;
      setVisible(firstSection.getBoundingClientRect().top <= scrollMarker());
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <button
      type="button"
      className={backToTop}
      data-visible={visible}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <span className={backToTopArrow} aria-hidden="true">
        ↑
      </span>
      Back to top
    </button>
  );
};
