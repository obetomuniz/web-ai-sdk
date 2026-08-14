/**
 * Framework-free WebGL boot for the hero backdrop, inlined into the page as a
 * synchronous `<script is:inline>` (see index.astro). Running during HTML
 * parse — after the canvas markup, blocked on the head stylesheets so the
 * design tokens are readable — it compiles the shader and draws the first
 * frame BEFORE the browser's first paint. That is what makes the backdrop
 * part of the initial render instead of popping in after React hydration
 * (a previous React-island version started ~1-2s late for exactly that
 * reason; alternate looks it carried live in git history).
 *
 * The __FRAG__ placeholder below (its quoted form only — keep it out of this
 * comment, index.astro replaces the first quoted occurrence) is swapped at
 * build time for the JSON-stringified fragment shader source
 * (city.frag.glsl). Runtime contract: token-driven colors re-read on
 * `themechange`, DPR cap, ~26px cells, IntersectionObserver pause, no-op on
 * no-WebGL / reduced-motion (the canvas then stays at opacity-0 and the
 * plain page background shows).
 */
(() => {
  const canvas = document.querySelector("[data-hero-shader]");
  if (!canvas) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const FRAG = "__FRAG__";
  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

  const gl =
    canvas.getContext("webgl", { antialias: true }) ||
    canvas.getContext("experimental-webgl", { antialias: true });
  if (!gl) return;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "u_time");
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uC1 = gl.getUniformLocation(prog, "u_c1");
  const uC2 = gl.getUniformLocation(prog, "u_c2");
  const uBg = gl.getUniformLocation(prog, "u_bg");
  const uCells = gl.getUniformLocation(prog, "u_cells");

  // Resolve a CSS custom property to rgb[0..1] by letting the browser compute
  // it (handles hex / hsl() / rgb() alike). Returns null if unreadable so the
  // previous color is kept rather than flashing black.
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  canvas.parentElement?.appendChild(probe);
  const readTokenRgb = (varName) => {
    probe.style.color = "";
    probe.style.color = `var(${varName})`;
    const m = getComputedStyle(probe).color.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  };
  // Colors come from the live design tokens: bg matches the page (no seam),
  // the dimmer accent is the flow, the bright accent is the heads.
  const syncColors = () => {
    const bg = readTokenRgb("--color-bg");
    const flow = readTokenRgb("--color-accent-dim");
    const core = readTokenRgb("--color-accent");
    if (bg) gl.uniform3f(uBg, bg[0], bg[1], bg[2]);
    if (flow) gl.uniform3f(uC1, flow[0], flow[1], flow[2]);
    if (core) gl.uniform3f(uC2, core[0], core[1], core[2]);
  };
  syncColors();
  window.addEventListener("themechange", syncColors);

  // Cell count scales with width so each cell stays ~constant physical size
  // (~26 CSS px). Fixed counts looked dense/flickery on small screens.
  let cells = 48;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = canvas.clientWidth || 1;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round((canvas.clientHeight || 1) * dpr));
    cells = Math.max(14, Math.min(60, Math.round(cssW / 26)));
    // Skip no-op resizes; mobile URL-bar show/hide fires resize constantly and
    // reallocating the GL buffer each time causes flicker.
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  };
  resize();
  window.addEventListener("resize", resize);

  let raf = 0;
  let visible = true;
  const start = performance.now();
  const drawFrame = (now) => {
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uCells, cells);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const frame = (now) => {
    // Note: do NOT reset raf to 0 here. Keeping the live id non-zero during
    // the frame prevents the IntersectionObserver from starting a second,
    // parallel rAF loop (stacked loops made the shader flicker on mobile).
    drawFrame(now);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };

  // First frame right now, synchronously, so the backdrop is already rendered
  // and revealed (data-ready) when the browser paints the page for the first
  // time — no pop, no fade needed.
  drawFrame(start);
  canvas.dataset.ready = "true";

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          const e = entries[0];
          visible = e ? e.isIntersecting : true;
          if (visible && !raf) raf = requestAnimationFrame(frame);
        })
      : null;
  if (io) io.observe(canvas);
  raf = requestAnimationFrame(frame);
})();
