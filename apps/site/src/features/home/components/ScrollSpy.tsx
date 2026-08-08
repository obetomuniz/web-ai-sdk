import { useEffect } from "react";

const IDS = [
  "why-raw",
  "why-sdk",
  "matrix",
  "packages",
  "support",
  "how",
  "philosophy",
  "start",
] as const;

const scrollMarker = (): number => {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const navHeight = Number.parseFloat(styles.getPropertyValue("--nav-height"));
  return (Number.isFinite(navHeight) ? navHeight : 57) + 24;
};

export const ScrollSpy = () => {
  useEffect(() => {
    const links = IDS.map((id) =>
      document.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`),
    );

    const sections = IDS.map((id) =>
      document.querySelector<HTMLElement>(`[data-section="${id}"]`),
    );

    // Same handoff signal the floating Back-to-top button uses: once the
    // footer's own "Back to top" link scrolls into view, the visitor left
    // the section flow and no nav item stays highlighted.
    const footerLink = document.querySelector<HTMLElement>(
      "[data-footer-top-link]",
    );

    let frame = 0;

    const syncActive = () => {
      frame = 0;
      const marker = scrollMarker();
      let activeIndex = -1;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (!section) continue;
        if (section.getBoundingClientRect().top <= marker) activeIndex = i;
      }

      // The short last section cannot reach the top marker before the page
      // ends, so it activates once it fills the lower half of the viewport.
      const lastSection = sections[sections.length - 1];
      if (
        lastSection &&
        lastSection.getBoundingClientRect().top <= window.innerHeight / 2
      ) {
        activeIndex = sections.length - 1;
      }

      // Same handoff signal that hides the floating Back-to-top button:
      // once the footer's own link is in view, the visitor left the section
      // flow and no nav item stays highlighted.
      const footerLinkInView = footerLink
        ? footerLink.getBoundingClientRect().top <= window.innerHeight
        : false;
      if (footerLinkInView) activeIndex = -1;

      links.forEach((link, i) => {
        const isActive = i === activeIndex;
        link?.classList.toggle("active", isActive);
        if (isActive) link?.setAttribute("aria-current", "location");
        else link?.removeAttribute("aria-current");
      });
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(syncActive);
    };

    syncActive();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("hashchange", syncActive);

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "true";
            revealObserver.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]");
    for (const el of revealEls) revealObserver.observe(el);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", syncActive);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      revealObserver.disconnect();
    };
  }, []);

  return null;
};
