/**
 * Replacement for Starlight's IntersectionObserver-based TOC highlighting,
 * shared by the desktop sidebar (`waisdk-toc`) and the mobile dropdown
 * (`mobile-starlight-toc`, subclassed in `MobileTableOfContents.astro`).
 *
 * Starlight marks a heading as current only while it crosses a ~53px band just
 * below the header, so short sections near the end of a page never activate:
 * their headings sit below the band even when the page is scrolled to the
 * bottom. This spy uses a proportional "reading line" instead — the line sits
 * just below the header at the top of the page and sweeps down to the bottom
 * edge of the viewport as scroll progress approaches 100% — so the last entry
 * becomes current exactly when the page bottom is reached.
 */
export class WebAiSdkToc extends HTMLElement {
  private _current = this.querySelector<HTMLAnchorElement>(
    'a[aria-current="true"]',
  );
  private links: HTMLAnchorElement[] = [];
  private headings: (HTMLElement | null)[] = [];
  private frame = 0;
  private controller = new AbortController();

  protected set current(link: HTMLAnchorElement) {
    if (link === this._current) return;
    if (this._current) this._current.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    this._current = link;
  }

  constructor() {
    super();
    const onIdle =
      window.requestIdleCallback ||
      ((cb: IdleRequestCallback) => setTimeout(cb, 1));
    onIdle(() => this.init());
  }

  private init = (): void => {
    this.links = [...this.querySelectorAll("a")];
    this.headings = this.links.map((link) =>
      document.getElementById(decodeURIComponent(link.hash.slice(1))),
    );
    const schedule = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.update();
      });
    };
    const { signal } = this.controller;
    window.addEventListener("scroll", schedule, { passive: true, signal });
    window.addEventListener("resize", schedule, { signal });
    this.update();
  };

  disconnectedCallback(): void {
    this.controller.abort();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private update = (): void => {
    if (!this.links.length) return;
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    const progress = maxScroll > 0 ? Math.min(doc.scrollTop / maxScroll, 1) : 0;
    // Expose overall page progress for the dropdown bar's progress ring.
    this.style.setProperty("--waisdk-toc-progress", String(progress));
    const navBarHeight =
      document.querySelector("header")?.getBoundingClientRect().height || 0;
    // `<summary>` only exists in the mobile dropdown variant; 0 on desktop.
    const barHeight =
      this.querySelector("summary")?.getBoundingClientRect().height || 0;
    const offsetTop = navBarHeight + barHeight + 32;
    const line = offsetTop + progress * (doc.clientHeight - offsetTop);
    let current = this.links[0];
    for (const [i, link] of this.links.entries()) {
      const heading = this.headings[i];
      if (!heading) continue;
      if (heading.getBoundingClientRect().top > line) break;
      current = link;
    }
    if (current) this.current = current;
  };
}

if (!customElements.get("waisdk-toc")) {
  customElements.define("waisdk-toc", WebAiSdkToc);
}
