import { useEffect } from "react";

const IDS = ["packages", "philosophy", "how", "support", "start"];

export const ScrollSpy = () => {
  useEffect(() => {
    const links = IDS.map((id) =>
      document.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`),
    );

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = IDS.indexOf(e.target.id);
            links.forEach((l, j) => {
              l?.classList.toggle("active", i === j);
            });
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const id of IDS) {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            revealObserver.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    const revealEls = document.querySelectorAll<HTMLElement>(".reveal");
    for (const el of revealEls) revealObserver.observe(el);

    return () => {
      sectionObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return null;
};
