import { useEffect, useRef } from "react";

/**
 * Shared WebGL backdrop engine (no libraries). Renders a full-screen fragment
 * shader passed in as `frag`; the individual looks live in thin wrappers
 * (StreamShader, NeuralShader) so they can be swapped by changing one import.
 *
 * Colors are *not* hardcoded: the shader reads the design tokens (`--color-bg` /
 * `--color-accent` / `--color-accent-dim`) and re-reads them on the
 * `themechange` event, so it follows whatever theme is applied. Pauses when
 * off-screen, caps DPR, reacts to the pointer, and no-ops on no-WebGL /
 * reduced-motion so it never blocks the hero from rendering.
 *
 * Shader contract (uniforms the engine feeds every frame):
 *   float u_time, vec2 u_res, vec2 u_mouse, float u_cells,
 *   vec3 u_bg (=--color-bg), u_c1 (=--color-accent-dim), u_c2 (=--color-accent)
 */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// Resolve a CSS custom property to rgb[0..1] by letting the browser compute it
// (handles hex / hsl() / rgb() alike). Returns null if unreadable so callers can
// keep the previous color rather than flashing black.
function readTokenRgb(
  probe: HTMLElement,
  varName: string,
): [number, number, number] | null {
  probe.style.color = "";
  probe.style.color = `var(${varName})`;
  const m = getComputedStyle(probe).color.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function ShaderBackdrop({
  frag,
  className,
}: {
  frag: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const gl = (canvas.getContext("webgl", { antialias: true }) ||
      canvas.getContext("experimental-webgl", {
        antialias: true,
      })) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
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
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uC1 = gl.getUniformLocation(prog, "u_c1");
    const uC2 = gl.getUniformLocation(prog, "u_c2");
    const uBg = gl.getUniformLocation(prog, "u_bg");
    const uCells = gl.getUniformLocation(prog, "u_cells");

    // Colors come from the live design tokens: bg matches the page (no seam),
    // the dimmer accent is the flow, the bright accent is the heads.
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;width:0;height:0;visibility:hidden";
    canvas.parentElement?.appendChild(probe);
    const syncColors = () => {
      const bg = readTokenRgb(probe, "--color-bg");
      const flow = readTokenRgb(probe, "--color-accent-dim");
      const core = readTokenRgb(probe, "--color-accent");
      if (bg) gl.uniform3f(uBg, bg[0], bg[1], bg[2]);
      if (flow) gl.uniform3f(uC1, flow[0], flow[1], flow[2]);
      if (core) gl.uniform3f(uC2, core[0], core[1], core[2]);
    };
    syncColors();
    window.addEventListener("themechange", syncColors);

    const mouse: [number, number] = [0.7, 0.5];
    const target: [number, number] = [0.7, 0.5];
    // Cell count scales with width so each cell stays ~constant physical size
    // (~26 CSS px). Fixed counts looked dense/flickery on small screens.
    let cells = 48;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target[0] = (e.clientX - r.left) / r.width;
      target[1] = 1 - (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    let visible = true;
    const start = performance.now();
    const frame = (now: number) => {
      // Note: do NOT reset raf to 0 here. Keeping the live id non-zero during the
      // frame prevents the IntersectionObserver from starting a second, parallel
      // rAF loop (stacked loops made the shader flicker badly on mobile).
      mouse[0] += (target[0] - mouse[0]) * 0.05;
      mouse[1] += (target[1] - mouse[1]) * 0.05;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.uniform1f(uCells, cells);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

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

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("themechange", syncColors);
      probe.remove();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (buf) gl.deleteBuffer(buf);
    };
  }, [frag]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {/* Bottom-to-top page-bg gradient eases the shader into the page. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,var(--color-bg)_0%,var(--color-bg)_18%,transparent_100%)]" />
    </div>
  );
}
