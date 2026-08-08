/**
 * Replacement for Starlight's IntersectionObserver-based TOC highlighting on
 * the desktop right sidebar.
 *
 * Starlight marks a heading as current only while it crosses a ~53px band just
 * below the header, so short sections near the end of a page never activate:
 * their headings sit below the band even when the page is scrolled to the
 * bottom. This spy uses a proportional "reading line" instead — the line sits
 * just below the header at the top of the page and sweeps down to the bottom
 * edge of the viewport as scroll progress approaches 100% — so the last entry
 * becomes current exactly when the page bottom is reached.
 *
 * The element name is intentionally not `starlight-toc`: Starlight's mobile
 * TOC (left untouched) still registers that name on every page.
 */
class WebAiSdkToc extends HTMLElement {
  private _current = this.querySelector<HTMLAnchorElement>(
    'a[aria-current="true"]',
  );
  private links: HTMLAnchorElement[] = [];
  private headings: (HTMLElement | null)[] = [];
  private frame = 0;

  private set current(link: HTMLAnchorElement) {
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
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    this.update();
  };

  private update = (): void => {
    if (!this.links.length) return;
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    const progress = maxScroll > 0 ? Math.min(doc.scrollTop / maxScroll, 1) : 0;
    const navBarHeight =
      document.querySelector("header")?.getBoundingClientRect().height || 0;
    const offsetTop = navBarHeight + 32;
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

customElements.define("waisdk-toc", WebAiSdkToc);
