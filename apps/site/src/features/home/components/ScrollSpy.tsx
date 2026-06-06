import { useEffect } from "react";

const IDS = [
  "why-raw",
  "packages",
  "philosophy",
  "how",
  "support",
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

      links.forEach((link, i) => {
        link?.classList.toggle("active", i === activeIndex);
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
