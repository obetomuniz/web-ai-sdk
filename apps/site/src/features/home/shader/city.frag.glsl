// City look: a dense night megacity, deliberately under-defined. Five stacked
// skyline layers give the crowded-silhouette depth of concept-art cityscapes:
// the far layers melt into horizon haze, the middle distance carries the
// light — a dense speckle field of lit windows — and the foreground towers
// are near-black masses that cut everything behind them. Neon rooflines glow
// with a soft bloom; vertical strips are rare and faint. Below the skyline,
// elevated freeways carry long-exposure light trails (hot comet heads, cooling
// tails, a rare full-speed streaker). Overhead, a faint perspective grid
// converges toward the horizon. All motion is slow continuous drift at
// depth-dependent speeds — no jitter, no pointer interaction (static camera).
// Colored entirely by the design tokens: bg is the sky, the dim accent is
// haze/grid/dim neon, the bright accent is hot neon, windows and cars.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float u_time;uniform vec2 u_res;
uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_bg;
uniform float u_cells;
float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
// one skyline layer: soft dark silhouette + sparse neon + window speckles.
// freq = columns per unit, hmax = tallest tower, soft = silhouette blur,
// amt = layer presence, drift = slide speed, lit = how much light this
// depth carries (the middle distance glows, far fades, front goes dark),
// seed = layer id
vec3 city(vec3 col,vec2 p,float freq,float hmax,float soft,float amt,float drift,float lit,float seed){
  float xx=p.x*freq+u_time*drift+seed*7.3;
  float ci=floor(xx);float fx=fract(xx);
  float h=hmax*(0.25+0.75*hash(vec2(ci,seed)));
  float y=p.y+0.16;
  float up=step(0.0,y);
  // tower width: each building occupies part of its column with soft x-edges
  // and a gap to its neighbor, so deeper layers show through — no full-column
  // slab, no hard vertical seams
  float bw=0.28+0.34*hash(vec2(ci,seed+21.0));
  float xm=smoothstep(bw+0.10,bw-0.05,abs(fx-0.5));
  // silhouette: a soft dark mass, edges left vague on purpose
  float inside=smoothstep(h+soft,h-soft,y)*up*xm;
  // depth shadow: a wider, softer dark halo hugs the tower and dims whatever
  // glows behind it — the contact shadow that separates the depth planes
  float xmw=smoothstep(bw+0.24,bw-0.05,abs(fx-0.5));
  float halo=clamp(smoothstep(h+0.10,h-0.02,y)*up*xmw-inside,0.0,1.0);
  col=mix(col,u_bg*0.30,halo*amt*0.35);
  // near-opaque fill: towers are solid cutouts, the city does not shine
  // through them
  col=mix(col,u_bg*0.40,inside*clamp(amt*1.15,0.0,1.0));
  // per-building neon personality: on/off, dim-or-hot color
  float non=step(0.35,hash(vec2(ci,seed+5.0)));
  vec3 nc=mix(u_c1,u_c2,step(0.55,hash(vec2(ci,seed+9.0))));
  // roofline: thin core wrapped in a soft bloom, spanning only the tower
  float d=abs(y-h);
  float roof=(smoothstep(0.006,0.0,d)*0.6+smoothstep(0.10,0.0,d)*0.18)*up*xm;
  col=mix(col,nc,roof*non*amt*lit);
  // windows: screen-space speckles (constant size at every depth), gated to
  // tower interiors, slow flicker
  float wxf=p.x*30.0+seed*11.0;float wyf=y*34.0;
  float wdot=smoothstep(0.38,0.24,abs(fract(wxf)-0.5))*smoothstep(0.44,0.30,abs(fract(wyf)-0.5));
  float w=step(0.60,hash(vec2(floor(wxf)+seed*7.0,floor(wyf)+seed*3.0)));
  float fl=0.6+0.4*sin(u_time*0.7+hash(vec2(floor(wxf),floor(wyf)))*6.28);
  col=mix(col,u_c2,inside*step(y,h-0.03)*w*wdot*fl*amt*lit*0.42);
  return col;
}
// one traffic lane: long-exposure light trails on a gently swooping elevated
// freeway. Returns vec2(heads, tails) — hot comet heads and the fading tail
// streaked behind each one (opposite to travel direction). w scales the
// beam thickness so near lanes read closer. sparse controls car density.
vec2 lane(vec2 p,float ly,float speed,float dens,float w,float sparse,float seed){
  float yy=ly+0.018*sin(p.x*1.6+seed*3.1);
  float d=abs(p.y-yy);
  float xr=p.x*dens+speed*u_time+seed*17.0;
  float car=step(sparse,hash(vec2(floor(xr),seed)));
  float f=fract(xr)-0.5;
  // cars travel toward -x for positive speed; the tail streaks the other way
  float behind=step(0.0,f*sign(speed));
  float head=smoothstep(0.10,0.0,abs(f));
  float tail=behind*smoothstep(0.48,0.02,abs(f));
  float coreY=smoothstep(0.0045*w,0.0008*w,d);
  float glowY=smoothstep(0.020*w,0.004*w,d)*0.35;
  return vec2(head*(coreY+glowY),tail*(coreY*0.55+glowY))*car;
}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res.xy;
  vec2 p=(gl_FragCoord.xy-0.5*u_res.xy)/u_res.y;
  float fs=clamp(u_cells*0.021,0.6,1.2);
  vec3 col=u_bg;
  // haze: the sky glows toward the horizon, dim accent with a hot tinge
  float gy=p.y+0.16;
  col=mix(col,u_c1,0.22*smoothstep(0.38,0.0,abs(gy)));
  col=mix(col,u_c2,0.05*smoothstep(0.14,0.0,abs(gy)));
  // sky dome: faint perspective grid converging at the horizon, slow drift
  if(gy>0.02){
    float pr=1.0/(0.06+gy*1.1);
    vec2 g=vec2(p.x*pr*0.8,pr*0.9+u_time*0.015);
    float grid=max(smoothstep(0.44,0.5,abs(fract(g.x)-0.5)),smoothstep(0.44,0.5,abs(fract(g.y)-0.5)));
    float fade=smoothstep(10.0,2.5,pr)*smoothstep(0.02,0.20,gy);
    col=mix(col,u_c1,grid*fade*0.10);
  }
  // skyline, back to front: five depths. Light lives in the middle distance;
  // the far city is haze, the foreground is near-black cutout mass
  col=city(col,p,16.0*fs,0.30,0.035,0.30,0.003,0.50,1.0);
  col=city(col,p,12.0*fs,0.40,0.020,0.50,0.005,1.00,2.0);
  col=city(col,p, 9.0*fs,0.48,0.010,0.70,0.007,1.00,3.0);
  // light pollution: the massed glow of the mid-city rising off the streets —
  // this is what the dark foreground towers cut their silhouettes against
  col=mix(col,mix(u_c1,u_c2,0.35),0.16*smoothstep(0.35,0.02,gy)*step(0.02,gy));
  col=city(col,p, 6.5*fs,0.55,0.005,0.90,0.009,0.55,4.0);
  col=city(col,p, 4.5*fs,0.62,0.003,1.00,0.012,0.25,5.0);
  // elevated freeways below the horizon: far -> near lanes get thicker,
  // brighter and faster, opposing directions; plus a rare full-speed streaker
  vec2 tr=lane(p,-0.195, 0.05,3.6,0.7,0.55,1.0)*0.5
         +lane(p,-0.245,-0.075,2.8,1.0,0.55,2.0)*0.8
         +lane(p,-0.300, 0.10,2.2,1.5,0.60,3.0)
         +lane(p,-0.300, 0.30,2.2,1.5,0.93,4.0)*1.2;
  // heads burn in the hot accent, tails cool toward the dim one
  col=mix(col,u_c2,clamp(tr.x,0.0,1.0)*0.75);
  col=mix(col,mix(u_c1,u_c2,0.35),clamp(tr.y,0.0,1.0)*0.55);
  // vignette + film grain
  col*=1.0-0.3*smoothstep(0.5,1.4,length(p));
  col+=(hash(uv*u_res.xy+u_time)-0.5)*0.012;
  gl_FragColor=vec4(col,1.0);
}
