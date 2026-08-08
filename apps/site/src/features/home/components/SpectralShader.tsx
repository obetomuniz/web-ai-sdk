import { ShaderBackdrop } from "./ShaderBackdrop.js";

/**
 * Spectral look: slow domain-warped smoke — dark veils drifting upward with
 * faint phantom highlights where the folds compress — and a *presence* behind
 * it: a soft head-and-shoulders occluder that wanders slowly through the fog,
 * swallowing the smoke's light where it passes and betraying itself only as a
 * faint rim. Its edges are eroded by the same noise as the smoke so it never
 * reads as a crisp cutout, just something moving back there. Colored entirely
 * by the design tokens: bg is the void, the dim accent is the smoke body, the
 * bright accent surfaces as spectral edges. The pointer stirs the fog locally.
 * A drop-in alternative to MeshShader / StreamShader (swap the island import
 * in the Astro page).
 */

const FRAG = [
  "#ifdef GL_FRAGMENT_PRECISION_HIGH",
  "precision highp float;",
  "#else",
  "precision mediump float;",
  "#endif",
  "uniform float u_time;uniform vec2 u_res;uniform vec2 u_mouse;",
  "uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_bg;",
  "uniform float u_cells;uniform float u_intro;",
  "float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}",
  "float vnoise(vec2 p){",
  "  vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);",
  "  float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));",
  "  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);",
  "}",
  "float fbm(vec2 p){",
  "  float v=0.0,a=0.5;",
  "  mat2 r=mat2(0.8,0.6,-0.6,0.8);",
  "  for(int i=0;i<5;i++){v+=a*vnoise(p);p=r*p*2.03+11.5;a*=0.5;}",
  "  return v;",
  "}",
  // polynomial smooth-min: blends head and shoulders through a neck instead of
  // a hard union seam
  "float smin(float a,float b,float k){",
  "  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);",
  "}",
  "void main(){",
  "  vec2 uv=gl_FragCoord.xy/u_res.xy;",
  "  float asp=u_res.x/u_res.y;",
  "  vec2 p=(gl_FragCoord.xy-0.5*u_res.xy)/u_res.y;",
  "  vec2 mp=vec2((u_mouse.x-0.5)*asp,u_mouse.y-0.5);",
  "  p+=0.04*mp;",
  // smoke rises: sample space slides slowly downward over time
  "  vec2 sp=p*1.9+vec2(0.0,-u_time*0.05);",
  // fbm-of-fbm domain warp: q bends space, r bends it again -> curling veils
  "  vec2 q=vec2(fbm(sp+vec2(0.0,0.0)),fbm(sp+vec2(5.2,1.3)));",
  "  vec2 r=vec2(fbm(sp+3.2*q+vec2(1.7,9.2)+0.10*u_time),",
  "              fbm(sp+3.2*q+vec2(8.3,2.8)+0.08*u_time));",
  // pointer stirs the fog: extra warp falling off with distance to the cursor
  "  float stir=smoothstep(0.65,0.0,length(p-mp));",
  "  float s=fbm(sp+3.0*r+0.35*stir*vec2(mp.y,-mp.x));",
  // smoke body: mid-tones of the warped field, kept dim
  "  float body=smoothstep(0.28,0.85,s);",
  // spectral edges: narrow ridge where the warp folds compress
  "  float ridge=smoothstep(0.42,0.5,s)*smoothstep(0.58,0.5,s);",
  "  float depth=clamp(length(r)*0.9,0.0,1.0);",
  // the presence: a bust — wide sloping shoulders + a head that slowly turns,
  // blended through a neck dip (the head/neck/shoulder curve is what makes a
  // silhouette read as *someone*, no face needed). The wander path is pinned
  // inside the smoky right zone (the left ~55% of the hero sits under an
  // opaque bg gradient where the figure could never show); drift is slow so it
  // hovers rather than paces
  "  vec2 fp=vec2(0.55+0.25*sin(u_time*0.13)+0.08*sin(u_time*0.31+1.7),",
  "               -0.02+0.06*sin(u_time*0.21+0.6));",
  "  vec2 fd=p-fp;",
  // shoulders: wide flat ellipse below; half-width ~0.32, ~2.9x head radius
  "  float sh=length((fd+vec2(0.0,0.24))*vec2(0.62,1.30))-0.20;",
  // head: drifts sideways relative to the shoulders, someone looking around
  "  vec2 hoff=vec2(0.05*sin(u_time*0.33+2.1),0.17+0.012*sin(u_time*0.7));",
  "  float head=length(fd-hoff)-0.095;",
  "  float dfig=smin(sh,head,0.055);",
  // breathe: the whole bust presses toward the veil, then recedes
  "  dfig-=0.025*sin(u_time*0.15+4.0);",
  // erode the silhouette with the warped smoke noise: ragged, half-dissolved
  // (kept mild so the head/shoulder line stays recognizable)
  "  dfig+=0.09*(fbm(p*3.5+r+vec2(0.0,u_time*0.10))-0.5);",
  "  float figure=smoothstep(0.09,-0.07,dfig);",
  // rim: thin band around the silhouette edge, only visible through the fog
  "  float rim=smoothstep(0.05,0.0,abs(dfig));",
  // halo: fog just outside the silhouette catches light, so the dark core has
  // contrast to read against even where the smoke is thin
  "  float halo=smoothstep(0.30,0.02,dfig)*(1.0-figure);",
  // spread-in: a dissolve keyed to the smoke's own warp field (q), not to
  // geometry — as u_intro rises, more of the field passes the threshold, so
  // the fog condenses in liquid patches that grow and merge along the noise
  // contours, with no discernible origin (only a trace of distance bias keeps
  // the presence's neighborhood slightly ahead). The wide soft band keeps the
  // front misty. Saturates to 1 everywhere by the end of the ramp, then
  // continues as-is.
  "  float rn=0.5*(q.x+q.y);",
  "  float rev=smoothstep(0.45,0.0,0.9*rn+0.15*length(p-fp)+0.35-u_intro*1.6);",
  "  vec3 col=u_bg;",
  // shadow first: the presence soaks light out of the bg where it stands
  "  col*=1.0-0.30*figure*rev;",
  // smoke over it: brightened in the halo, swallowed where the figure occludes
  "  float fog=body*(0.16+0.22*depth)*(1.0+1.1*halo)*(1.0-0.85*figure);",
  "  col=mix(col,u_c1,fog*rev);",
  "  col=mix(col,u_c2,ridge*(0.10+0.25*depth)*(0.7+0.5*stir)*(1.0-0.7*figure)*rev);",
  // faint spectral outline: you sense the shape more than you see it
  "  col=mix(col,u_c2,rim*body*0.16*rev);",
  "  col*=1.0-0.3*smoothstep(0.5,1.4,length(p));",
  "  col+=(hash(uv*u_res.xy+u_time)-0.5)*0.012;",
  "  gl_FragColor=vec4(col,1.0);",
  "}",
].join("\n");

export function SpectralShader({ className }: { className?: string }) {
  return <ShaderBackdrop frag={FRAG} className={className} />;
}
