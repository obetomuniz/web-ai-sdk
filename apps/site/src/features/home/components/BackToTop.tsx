import { useEffect, useState } from "react";
import { backToTop, backToTopArrow } from "../../../shared/ui.js";

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
    // The footer carries its own "Back to top" link, so hand off to it: hide
    // the floating button once that link itself scrolls into view.
    const footerLink = document.querySelector<HTMLElement>(
      "[data-footer-top-link]",
    );
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (!firstSection) return;
      const pastFirstSection =
        firstSection.getBoundingClientRect().top <= scrollMarker();
      const footerLinkInView = footerLink
        ? footerLink.getBoundingClientRect().top <= window.innerHeight
        : false;
      setVisible(pastFirstSection && !footerLinkInView);
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
