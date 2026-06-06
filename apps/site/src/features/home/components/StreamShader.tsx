import { ShaderBackdrop } from "./ShaderBackdrop.js";

/**
 * Stream look: a thin, discrete stream of cryptic glyph-strokes drifting across
 * the dark. The original hero backdrop, kept as a drop-in alternative to
 * NeuralShader (swap the island import in the Astro page to revert).
 */

const FRAG = [
  "#ifdef GL_FRAGMENT_PRECISION_HIGH",
  "precision highp float;",
  "#else",
  "precision mediump float;",
  "#endif",
  "uniform float u_time;uniform vec2 u_res;uniform vec2 u_mouse;",
  "uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_bg;uniform float u_cells;",
  "float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}",
  "void main(){",
  "  vec2 uv=gl_FragCoord.xy/u_res.xy;",
  "  vec2 p=(gl_FragCoord.xy-0.5*u_res.xy)/u_res.y;",
  "  vec2 m=(u_mouse-0.5);",
  "  float band=smoothstep(0.85,0.0,abs(p.y-0.06*m.y));",
  "  float cells=u_cells;",
  "  float xf=uv.x*cells + u_time*0.9 + 0.4*m.x;",
  "  float ci=floor(xf); float cf=fract(xf);",
  "  float active=step(0.55,hash(vec2(ci,2.0)));",
  "  float sx=cf*3.0; float si=floor(sx); float sf=fract(sx);",
  "  float thinV=smoothstep(0.085,0.015,abs(sf-0.5));",
  "  float laneY=(hash(vec2(ci,si+5.0))-0.5)*1.4;",
  "  float gh=0.02+0.05*hash(vec2(ci,si+9.0));",
  "  float ymask=smoothstep(gh,gh-0.015,abs(p.y-laneY));",
  "  float glyph=active*thinV*ymask;",
  "  float flick=0.4+0.6*hash(vec2(ci,floor(u_time*2.0)+si));",
  "  float inten=glyph*band*flick*0.5;",
  "  vec3 col=u_bg;",
  "  col=mix(col,u_c1,inten);",
  "  float head=step(0.85,hash(vec2(ci,floor(u_time*1.3)+si)));",
  "  col=mix(col,u_c2,glyph*band*head*0.7);",
  "  col*=1.0-0.25*smoothstep(0.6,1.3,length(p));",
  "  col+=(hash(uv*u_res.xy+u_time)-0.5)*0.015;",
  "  gl_FragColor=vec4(col,1.0);",
  "}",
].join("\n");

export function StreamShader({ className }: { className?: string }) {
  return <ShaderBackdrop frag={FRAG} className={className} />;
}
