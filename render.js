/* Rebus Club: puzzle rendering. Shared by index.html and scripts/check-puzzles.mjs.
   R() turns a layout object (the vocabulary Claude-written puzzles use) into HTML;
   the short helpers below build the built-in puzzles directly. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const w=(s,c='')=>`<span class="w ${c}">${s}</span>`;
const stk=(a,b,bar=true)=>`<div class="stk">${a}${bar?'<i class="bar"></i>':''}${b}</div>`;
const em=(...p)=>`<div class="emo">${p.map(x=>`<span>${x}</span>`).join('<b class="plus">+</b>')}</div>`;
const row=(cls,...p)=>`<div class="row ${cls}">${p.join('')}</div>`;
const col=(...p)=>`<div class="col">${p.join('')}</div>`;
const T=(...p)=>`<span class="tight">${p.join('')}</span>`;

const SHAPES={triangle:'<path d="M50 5 L96 94 L4 94 Z"/>',square:'<rect x="5" y="5" width="90" height="90"/>',circle:'<circle cx="50" cy="50" r="46"/>',oval:'<ellipse cx="50" cy="50" rx="48" ry="46"/>',octagon:'<path d="M30 4 L70 4 L96 30 L96 70 L70 96 L30 96 L4 70 L4 30 Z"/>',heart:'<path d="M50 93 C18 70 3 52 7 31 C11 12 36 6 50 26 C64 6 89 12 93 31 C97 52 82 70 50 93 Z"/>'};
/* Layout objects: a small safe vocabulary Claude-written puzzles (and some built-ins) use. */
const SIZE={normal:'',small:'sm',big:'huge',tiny:'tiny'};
const STYLE={blue:'blue',tophalf:'tophalf',half:'tophalf',bottomhalf:'bottomhalf',outline:'outline',hollow:'outline',shadow:'shadow',blur:'blur',blurred:'blur',glow:'glow',dotline:'dotline',dotted:'dotline',circled:'circled',red:'red',green:'green',vertical:'vertical',marked:'marked',arrow:'marked',pointed:'pointed',tilted:'tilt',upside:'upside',upsidedown:'upside',mirror:'mirror',spaced:'spaced',faded:'faded',strike:'strike',crossed:'strike',underline:'under',cracked:'crack'};
function R(n,depth=0){
  if(depth>4) throw new Error('too deep');
  if(typeof n==='string'||typeof n==='number'){const s=String(n);if(!s.trim()||s.length>40)throw new Error('bad text');return w(esc(s))}
  if(!n||typeof n!=='object') throw new Error('bad node');
  const kid=x=>R(x,depth+1);
  const text=()=>{const s=String(n.text??'');if(!s.trim()||s.length>40)throw new Error('bad text');return s};
  const items=(min,max)=>{const a=n.items;if(!Array.isArray(a)||a.length<min||a.length>max)throw new Error('bad items');return a};
  switch(String(n.type||'').toLowerCase()){
    case 'emoji':{const a=items(1,5).map(x=>{const s=String(x);if(!s||s.length>14)throw new Error('bad emoji');return esc(s)});
      return n.plus===false?`<div class="emo">${a.map(x=>`<span>${x}</span>`).join('')}</div>`:em(...a)}
    case 'word':{let s=esc(text());const h=n.highlight&&String(n.highlight);
      if(h&&text().includes(h)){const t=text(),i=t.indexOf(h);s=esc(t.slice(0,i))+`<span class="hl">${esc(h)}</span>`+esc(t.slice(i+h.length))}
      const cls=[SIZE[n.size]||'',...[].concat(n.style||[]).map(x=>STYLE[String(x).toLowerCase()]||'')].join(' ');
      return w(s,cls)}
    case 'over':return stk(kid(n.top),kid(n.bottom),true);
    case 'on':return stk(kid(n.top),kid(n.bottom),false);
    case 'row':return row(n.gap?'gap':'',...items(1,8).map(kid));
    case 'column':return col(...items(1,8).map(kid));
    case 'between':return `<div class="stk"><i class="bar"></i>${kid(n.item??text())}<i class="bar"></i></div>`;
    case 'box':{const inner=n.inside!=null?kid(n.inside):'';const box=`<div class="box">${inner}</div>`;
      return n.outside!=null?row('gap',box,kid(n.outside)):box}
    case 'descending': case 'ascending':{const up=n.type==='ascending';const L=[...text()];
      return `<div class="down ${up?'up':''}">${L.map((c,i)=>`<span class="w" style="margin-left:${(i*.6).toFixed(1)}em">${esc(c)}</span>`).join('')}</div>`}
    case 'high':return `<div class="tall">${kid(n.item??text())}<i class="floor"></i></div>`;
    case 'low':return `<div class="tall low"><i class="ceil" style="margin-bottom:auto"></i>${kid(n.item??text())}</div>`;
    case 'grow': case 'shrink':{const L=[...text()];const g=n.type==='grow';
      return `<div class="grow">${L.map((c,i)=>{const f=g?(.9+i*.55):(.9+(L.length-1-i)*.55);return `<span style="font-size:${f.toFixed(2)}rem">${esc(c)}</span>`}).join('')}</div>`}
    case 'scattered':return `<div class="row scr">${[...text()].map(c=>w(esc(c))).join('')}</div>`;
    case 'repeat':{const c=Math.max(2,Math.min(12,parseInt(n.count)||0));return `<div class="rep">${Array.from({length:c},()=>kid(n.item??text())).join('')}</div>`}

    case 'shape':{const sh=String(n.shape||'').toLowerCase();const P=SHAPES[sh];if(!P)throw new Error('bad shape');
      return `<div class="shp ${sh}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${P}</svg><div class="shp-in">${n.item!=null?kid(n.item):''}</div></div>`}
    case 'ring':{const it=Array.isArray(n.items)?n.items:[...text()];if(it.length<2||it.length>16)throw new Error('bad ring');
      const dir=String(n.direction||'').toLowerCase()==='ccw'?-1:1,N=it.length;
      const parts=it.map((x,i)=>{const a=(-90+dir*360*i/N)*Math.PI/180;return `<span class="ring-it" style="left:${(50+40*Math.cos(a)).toFixed(1)}%;top:${(50+40*Math.sin(a)).toFixed(1)}%">${kid(x)}</span>`}).join('');
      return `<div class="ring${n.outline?' ol':''}">${parts}${n.center!=null?`<span class="ring-c">${kid(n.center)}</span>`:''}</div>`}
    case 'clock':{const h=((parseInt(n.hour)||0)%12+12)%12,m=Math.max(0,Math.min(59,parseInt(n.minute)||0));
      const hand=(ang,len,wd)=>{const r=ang*Math.PI/180;return `<line x1="60" y1="60" x2="${(60+len*Math.sin(r)).toFixed(1)}" y2="${(60-len*Math.cos(r)).toFixed(1)}" stroke="var(--ink)" stroke-width="${wd}" stroke-linecap="round"/>`};
      let ticks='';for(let i=0;i<12;i++){const r=i*30*Math.PI/180;ticks+=`<line x1="${(60+46*Math.sin(r)).toFixed(1)}" y1="${(60-46*Math.cos(r)).toFixed(1)}" x2="${(60+51*Math.sin(r)).toFixed(1)}" y2="${(60-51*Math.cos(r)).toFixed(1)}" stroke="var(--muted)" stroke-width="2"/>`}
      const num=(t,x,y)=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Archivo Black, Arial Black, sans-serif" font-size="13" fill="var(--ink)">${t}</text>`;
      const cls=[].concat(n.style||[]).map(x=>String(x).toLowerCase()).filter(x=>x==='mirror'||x==='shadow').join(' ');
      return `<div class="clockw ${cls}" data-time="${m?`${h||12}:${String(m).padStart(2,'0')}`:`${h||12} o’clock`}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="var(--surface)" stroke="var(--ink)" stroke-width="4"/>${ticks}${hand((h+m/60)*30,28,6)}${hand(m*6,42,4)}<circle cx="60" cy="60" r="4" fill="var(--ink)"/>${num(12,60,18)}${num(3,98,60)}${num(6,60,100)}${num(9,22,60)}</svg></div>`}
    case 'calendar':{const mo=String(n.month||'').trim();if(!mo||mo.length>5)throw new Error('bad month');const dy=n.day!=null?String(n.day).slice(0,2):'';
      return dy?`<div class="cal"><div class="cal-h">${esc(mo)}</div><div class="cal-b">${esc(dy)}</div></div>`:`<div class="cal"><div class="cal-h"></div><div class="cal-b mo">${esc(mo)}</div></div>`}
    case 'key':{const t=String(n.text??'');if(t.length>12||(!t.trim()&&!n.wide))throw new Error('bad key');return `<kbd class="key${n.wide?' wide':''}">${esc(t)}</kbd>`}
    case 'bubble':{const k=String(n.kind||'').toLowerCase()==='thought'?'thought':'speech';return `<div class="bub ${k}">${n.item!=null?kid(n.item):''}</div>`}
    case 'venn':return `<div class="venn"><svg viewBox="0 0 250 150" aria-hidden="true"><circle cx="96" cy="75" r="64"/><circle cx="154" cy="75" r="64"/></svg><span class="venn-m">${n.middle!=null?kid(n.middle):''}</span></div>`;
    default: throw new Error('unknown type '+n.type);
  }
}

/* What a screen reader hears for a drawn puzzle (the board is exposed as one image).
   Built from the same classes the drawing uses; a puzzle's `alt` overrides it. */
const STYLE_WORDS={huge:'in huge letters',tiny:'in tiny letters',tophalf:'with only the top half showing',bottomhalf:'with only the bottom half showing',outline:'in hollow outline letters',shadow:'with a shadow behind it',blur:'blurred',glow:'glowing',dotline:'sitting on a dotted line',circled:'circled',red:'in red',green:'in green',blue:'in blue',vertical:'written vertically, reading upwards',marked:'with an arrow pointing up at it',pointed:'with an arrow pointing at it',tilt:'tilted',upside:'upside down',mirror:'mirror-reversed',spaced:'with wide gaps between the letters',faded:'faded, barely visible',strike:'crossed out',under:'underlined',crack:'broken off and tilted'};
const SHAPE_NAMES=['triangle','square','circle','oval','octagon','heart'];
function describe(el){
  const has=k=>el.classList.contains(k);
  const text=x=>x.textContent.replace(/\s+/g,' ').trim();
  const q=s=>`“${s}”`;
  const letters=x=>text(x).replace(/ /g,'').split('').join(' ');
  const parts=(x=el)=>[...x.children].map(describe).filter(Boolean);
  const styles=x=>[...x.classList].map(k=>STYLE_WORDS[k]).filter(Boolean);
  if(has('bar')||has('floor')||has('ceil')||has('plus')) return '';
  if(has('w')){
    const mods=styles(el);
    const hl=el.querySelector('.hl');
    if(hl) mods.push(`with ${q(text(hl))} ${[...styles(hl),'in a different colour'].join(', ')}`);
    return [q(text(el)),...mods].join(', ');
  }
  if(has('e')) return el.textContent+(/rotate\(180deg\)/.test(el.getAttribute('style')||'')?' upside down':'');
  if(has('emo')){const it=[...el.children].filter(x=>x.tagName==='SPAN').map(x=>x.textContent);return it.join(el.querySelector('.plus')?' plus ':' ')}
  if(has('stk')){
    const bars=el.querySelectorAll(':scope > .bar').length, p=parts();
    if(bars===2) return `${p[0]} between two lines`;
    if(bars===1) return `${p[0]} above a line, with ${p[1]} below it`;
    return `${p[0]} on top of ${p[1]}`;
  }
  if(has('box')){const p=parts();return p.length?`a box containing ${p.join(', ')}`:'an empty box'}
  if(has('down')) return has('up')?`the letters ${letters(el)} climbing upwards from the bottom`:`the letters ${letters(el)} stepping downwards`;
  if(has('tall')) return has('low')?`${parts()[0]} low down, under a line`:`${parts()[0]} high up, above a line`;
  if(has('grow')){const s=[...el.children];return `the letters ${letters(el)} getting ${parseFloat(s[s.length-1].style.fontSize)>parseFloat(s[0].style.fontSize)?'bigger':'smaller'}`}
  if(has('scr')) return `the letters ${letters(el)}, jumbled and scattered at angles`;
  if(has('rep')||has('feet')){const p=parts();return `${p.length} copies of ${p[0]||q(text(el.children[0]))}`}
  if(has('alpha')) return `the letters ${letters(el)}`;
  if(has('shp')){
    const sh=SHAPE_NAMES.find(has), p=parts(el.querySelector(':scope > .shp-in'));
    const name=sh==='octagon'?'a red stop sign':`a ${sh}`;
    return p.length?`${name} containing ${p.join(', ')}`:name;
  }
  if(has('ring')){
    const it=[...el.querySelectorAll(':scope > .ring-it')], p=it.map(x=>describe(x.firstElementChild));
    const ccw=it.length>2&&parseFloat(it[1].style.left)<50;
    const same=p.every(x=>x===p[0]);
    const c=el.querySelector(':scope > .ring-c');
    return (same?`${p.length} copies of ${p[0]} arranged in a circle`:`in a circle, ${ccw?'anticlockwise':'clockwise'} from the top: ${p.join('; ')}`)
      +(has('ol')?', around a drawn ring':'')+(c?`, with ${describe(c.firstElementChild)} in the middle`:'');
  }
  if(has('clockw')) return `a clock showing ${el.dataset.time}`+(has('mirror')?', drawn mirror-reversed':'')+(has('shadow')?', with a shadow behind it':'');
  if(has('cal')){const h=text(el.querySelector('.cal-h')),b=text(el.querySelector('.cal-b'));return h?`a calendar page showing ${h} ${b}`:`a calendar page showing the month ${b}`}
  if(has('key')) return text(el)?`a keyboard key labelled ${text(el)}`:'a long blank keyboard key, like a space bar';
  if(has('bub')){const p=parts(),n=has('thought')?'thought bubble':'speech bubble';return p.length?`a ${n} containing ${p.join(', ')}`:`an empty ${n}`}
  if(has('venn')){const m=el.querySelector('.venn-m'),p=m?parts(m):[];return 'two overlapping circles'+(p.length?` with ${p.join(', ')} in the overlap`:'')}
  if(has('xo')) return `a noughts and crosses grid: ${letters(el)}`;
  if(has('xgrid')) return `letters in a grid: ${letters(el)}`;
  const p=parts();
  if(!p.length) return text(el)?q(text(el)):'';
  if(p.length===1) return p[0];
  if(has('row')) return (has('gap')?'left to right, spread apart: ':'left to right: ')+p.join('; ');
  if(has('col')) return 'top to bottom: '+p.join('; ');
  if(has('tight')) return 'run together: '+p.join(', ');
  return p.join(', ');
}

