import { ShaderBackdrop } from "./ShaderBackdrop.js";

/**
 * Mesh look: composable building blocks wiring together with data streaming
 * between them — the web-ai-sdk story (composition + streaming / AsyncIterable),
 * deliberately not a neural-net brain. Small square *module* nodes drift slowly,
 * connected by faint steady wires (the composition graph); bright dots stream
 * along each live wire in one direction, like tokens flowing through the
 * lifecycle. A drop-in alternative to StreamShader (swap the island import in
 * the Astro page).
 */

const FRAG = [
  "#ifdef GL_FRAGMENT_PRECISION_HIGH",
  "precision highp float;",
  "#else",
  "precision mediump float;",
  "#endif",
  "uniform float u_time;uniform vec2 u_res;uniform vec2 u_mouse;",
  "uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_bg;uniform float u_cells;",
  "vec2 hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}",
  "float hash1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
  // module position + activation for a given cell (drifts slowly)
  "vec2 nodeAt(vec2 c){vec2 r=hash2(c);return c+0.5+0.30*sin(u_time*0.18+6.2831*r);}",
  "float actAt(vec2 c){return 0.5+0.5*sin(u_time*0.4+6.2831*hash1(c+7.0));}",
  // a fixed wire (cell c -> cell c2): vec2(wire, streaming-dots). The wire is a
  // continuous segment, so it renders smoothly for every pixel that draws it.
  "vec2 edge(vec2 gp,vec2 a,float aa,vec2 c,vec2 c2){",
  "  float link=hash1(c*1.7+c2*2.3);",
  "  if(link<0.62) return vec2(0.0);",
  "  vec2 b=nodeAt(c2);float ab=actAt(c2);",
  "  float g=0.4+0.6*smoothstep(0.15,0.85,aa*ab);",
  "  vec2 d=b-a;float L2=max(dot(d,d),1e-4);",
  "  float h=clamp(dot(gp-a,d)/L2,0.0,1.0);",
  "  float perp=length(gp-(a+d*h));",
  "  float line=smoothstep(0.014,0.0,perp)*g;",
  // dots travel a -> b along the wire (one-directional stream)
  "  float ph=h*sqrt(L2)*1.7 - u_time*0.5 + link*6.0;",
  "  float f=fract(ph);",
  "  float dots=line*smoothstep(0.13,0.0,min(f,1.0-f));",
  "  return vec2(line,dots);",
  "}",
  "void main(){",
  "  vec2 uv=gl_FragCoord.xy/u_res.xy;",
  "  float asp=u_res.x/u_res.y;",
  "  vec2 p=(gl_FragCoord.xy-0.5*u_res.xy)/u_res.y;",
  "  vec2 mp=vec2((u_mouse.x-0.5)*asp,u_mouse.y-0.5);",
  "  p+=0.03*mp;",
  // Higher floor keeps narrow/mobile viewports from looking zoomed-in (only a
  // few huge modules); wide desktops still scale by u_cells.
  "  float scale=max(4.5,u_cells*0.11);",
  "  vec2 gp=p*scale;",
  "  vec2 cell=floor(gp);",
  "  float wireI=0.0,streamI=0.0,nodeI=0.0;",
  "  for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){",
  "    vec2 c=cell+vec2(float(i),float(j));",
  "    vec2 a=nodeAt(c);float aa=actAt(c);",
  // square module node (a building block, not a neuron)
  "    vec2 q=abs(gp-a);float bd=max(q.x,q.y)-0.045;",
  "    nodeI=max(nodeI,smoothstep(0.018,0.0,bd)*(0.4+0.6*aa));",
  "    vec2 e=edge(gp,a,aa,c,c+vec2(1.0,0.0));",
  "    e=max(e,edge(gp,a,aa,c,c+vec2(0.0,1.0)));",
  "    e=max(e,edge(gp,a,aa,c,c+vec2(1.0,1.0)));",
  "    wireI=max(wireI,e.x);streamI=max(streamI,e.y);",
  "  }}",
  "  float mb=1.0+smoothstep(0.55,0.0,length(p-mp))*0.6;",
  "  vec3 col=u_bg;",
  "  col=mix(col,u_c1,clamp(wireI*0.28*mb,0.0,1.0));",
  "  col=mix(col,u_c2,clamp(max(streamI,nodeI)*mb,0.0,1.0));",
  "  col*=1.0-0.3*smoothstep(0.5,1.4,length(p));",
  "  col+=(hash1(uv*u_res.xy+u_time)-0.5)*0.012;",
  "  gl_FragColor=vec4(col,1.0);",
  "}",
].join("\n");

export function MeshShader({ className }: { className?: string }) {
  return <ShaderBackdrop frag={FRAG} className={className} />;
}
