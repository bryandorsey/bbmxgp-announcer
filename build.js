// Turns bbmxgp-2026-announcer-sheet.md into index.html.
// The .md is the only place content lives. Edit it, run `node build.js`, push.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'bbmxgp-2026-announcer-sheet.md');
const OUT = path.join(__dirname, 'index.html');

const md = fs.readFileSync(SRC, 'utf8');
const lines = md.split('\n');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// inline: bold, links, and the "..." the sheet uses as a dash stand-in
function inline(s) {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) =>
    href.startsWith('#') ? txt : `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|\s)\.\.\.(\s|$)/g, '$1<span class="sep">·</span>$2');
  return t;
}

// a line that still needs an answer before Saturday
const GAP = /BLANK,?\s*fill in|\bconfirm\b/i;
function gapWrap(html, isTodo) {
  const gap = isTodo || GAP.test(html.replace(/<[^>]+>/g, ''));
  return { html, gap };
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let title = '', subtitle = '';
const sections = [];
let cur = null;
let i = 0;

// ---- header block ----
while (i < lines.length) {
  const l = lines[i];
  if (l.startsWith('# ')) { title = l.slice(2).trim(); i++; continue; }
  if (l.trim() === '---') { i++; break; }
  if (l.trim() && !subtitle) { subtitle = l.trim(); }
  i++;
}

// ---- sections ----
for (; i < lines.length; i++) {
  const l = lines[i];

  if (l.startsWith('## ')) {
    const name = l.slice(3).trim();
    cur = { name, id: slug(name), blocks: [] };
    // the hand-written Contents list is replaced by the generated jump bar
    if (name.toLowerCase() === 'contents') { cur = null; continue; }
    sections.push(cur);
    continue;
  }
  if (!cur) continue;
  if (l.trim() === '---' || !l.trim()) continue;

  // table
  if (l.trim().startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
      i++;
    }
    i--;
    cur.blocks.push({ type: 'table', head: rows[0], body: rows.slice(1) });
    continue;
  }

  // list
  if (/^\s*-\s/.test(l)) {
    const items = [];
    while (i < lines.length && /^\s*-\s/.test(lines[i])) {
      let txt = lines[i].replace(/^\s*-\s/, '');
      const todo = /^\[\s?\]\s*/.test(txt);
      txt = txt.replace(/^\[\s?\]\s*/, '');
      items.push(gapWrap(inline(txt), todo));
      i++;
    }
    i--;
    cur.blocks.push({ type: 'list', items });
    continue;
  }

  // paragraph (incl. the bold sub-heads under Booth Partners / Classes)
  const bare = l.trim();
  const isLead = /^\*\*[^*]+\*\*$/.test(bare);
  cur.blocks.push({ type: isLead ? 'lead' : 'p', ...gapWrap(inline(bare), false) });
}

// ---- render ----
function renderBlocks(blocks) {
  return blocks.map(b => {
    if (b.type === 'table') {
      const head = `<tr>${b.head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>`;
      const body = b.body.map(r => {
        const cells = r.map((c, n) => `<td${n === 0 ? ' class="day"' : ''}>${inline(c)}</td>`).join('');
        return `<tr class="row" data-t="${esc(r.join(' ').replace(/\*/g, '').toLowerCase())}">${cells}</tr>`;
      }).join('');
      return `<div class="tw"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    }
    if (b.type === 'list') {
      const items = b.items.map(it =>
        `<li class="row${it.gap ? ' gap' : ''}" data-t="${esc(it.html.replace(/<[^>]+>/g, '').toLowerCase())}">${it.html}</li>`
      ).join('');
      return `<ul>${items}</ul>`;
    }
    const cls = b.type === 'lead' ? 'lead' : 'p';
    return `<p class="${cls} row${b.gap ? ' gap' : ''}" data-t="${esc(b.html.replace(/<[^>]+>/g, '').toLowerCase())}">${b.html}</p>`;
  }).join('\n');
}

const nav = sections.map((s, n) => `<a href="#${s.id}"><span class="n">${n + 1}</span>${esc(s.name)}</a>`).join('');
const body = sections.map(s => `
<section id="${s.id}" data-sec>
  <h2>${esc(s.name)}</h2>
  ${renderBlocks(s.blocks)}
</section>`).join('\n');

const gapCount = sections.reduce((n, s) => n + s.blocks.reduce((m, b) =>
  m + (b.type === 'list' ? b.items.filter(x => x.gap).length : (b.gap ? 1 : 0)), 0), 0);

const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f7f5f1">
<title>${esc(title)}</title>
<style>
:root{
  --bg:#f7f5f1; --panel:#fffefb; --ink:#14130f; --ink2:#4a4740; --line:#ddd8cd;
  --accent:#9a2f14; --gap:#8a5100; --gapbg:#fcf1dc; --shadow:0 1px 0 rgba(0,0,0,.05); --track:#e8e3d8;
}
html[data-theme="dark"]{
  --bg:#101010; --panel:#191817; --ink:#f0ede6; --ink2:#a8a49a; --line:#302e2b;
  --accent:#ff8a5c; --gap:#f0b25c; --gapbg:#2c2313; --shadow:none; --track:#2a2825;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font:400 17.5px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:760px;margin:0 auto;padding:0 18px 96px}

/* ---- masthead ---- */
header{padding:26px 0 14px}
h1{font-size:26px;line-height:1.2;letter-spacing:-.01em;margin:0 0 6px;font-weight:800}
.sub{color:var(--ink2);font-size:15px;margin:0}
.tgl{
  position:absolute;top:24px;right:16px;width:70px;height:38px;padding:0;
  border-radius:999px;border:1px solid var(--line);background:var(--track);
  cursor:pointer;-webkit-tap-highlight-color:transparent;
}
.tgl svg{width:17px;height:17px;display:block}
.ghost{position:absolute;top:50%;transform:translateY(-50%);color:var(--ink2);opacity:.5}
.gm{right:10px} .gs{left:10px;display:none}
.knob{
  position:absolute;top:4px;left:4px;width:29px;height:29px;border-radius:50%;
  background:var(--panel);border:1px solid var(--line);color:var(--ink);
  display:grid;place-items:center;transition:transform .18s ease;
  box-shadow:0 1px 3px rgba(0,0,0,.22)
}
.km{display:none}
html[data-theme="dark"] .knob{transform:translateX(31px)}
html[data-theme="dark"] .gm{display:none}
html[data-theme="dark"] .gs{display:block}
html[data-theme="dark"] .ks{display:none}
html[data-theme="dark"] .km{display:block}
.tgl:active .knob{width:33px}
.tgl:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---- sticky search ---- */
.stick{position:sticky;top:0;z-index:20;background:var(--bg);
  padding:10px 18px 12px;margin:0 -18px;border-bottom:1px solid var(--line)}
#q{
  width:100%;height:48px;padding:0 14px;border-radius:10px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink);
  font-size:17px;font-family:inherit;box-shadow:var(--shadow)
}
#q:focus{outline:2px solid var(--accent);outline-offset:-1px}
#q::placeholder{color:var(--ink2)}

/* ---- table of contents ---- */
#toc{display:block;padding:14px 0 4px}
#toc a{
  display:flex;align-items:center;gap:12px;padding:13px 2px;
  border-bottom:1px solid var(--line);color:var(--ink);
  text-decoration:none;font-weight:600;font-size:17px
}
#toc a:last-child{border-bottom:0}
#toc .n{
  flex:0 0 26px;text-align:right;color:var(--ink2);
  font-size:14px;font-weight:700;font-variant-numeric:tabular-nums
}

/* ---- content ---- */
section{padding:30px 0 4px;border-top:1px solid var(--line)}
section:first-of-type{border-top:0}
h2{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);
  margin:0 0 14px;font-weight:800;scroll-margin-top:118px}
p{margin:0 0 12px}
p.lead{font-weight:700;font-size:19px;margin:22px 0 8px}
p.lead:first-of-type{margin-top:0}
ul{list-style:none;margin:0 0 14px;padding:0}
li{position:relative;padding:7px 0 7px 18px;border-bottom:1px solid var(--line)}
li:last-child{border-bottom:0}
li::before{content:"";position:absolute;left:2px;top:16px;width:5px;height:5px;
  border-radius:50%;background:var(--ink2);opacity:.55}
strong{font-weight:700}
a{color:var(--accent)}
.sep{color:var(--ink2);padding:0 2px}
.gap{background:var(--gapbg);border-radius:8px;padding-left:22px;padding-right:10px;
  box-shadow:inset 3px 0 0 var(--gap)}
.gap::before{background:var(--gap);opacity:1;left:8px}
.gap strong{color:var(--gap)}
.tw{overflow-x:auto;margin:0 0 14px}
table{border-collapse:collapse;width:100%;font-size:16px}
th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink2);padding:0 10px 8px 0;border-bottom:1px solid var(--line);font-weight:700}
td{padding:11px 10px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
td.day{white-space:nowrap;font-weight:700;padding-right:16px}
tr:last-child td{border-bottom:0}

.hide{display:none !important}
.empty{color:var(--ink2);padding:40px 0;text-align:center;font-size:16px}
footer{color:var(--ink2);font-size:13px;padding:34px 0 0;border-top:1px solid var(--line);margin-top:30px}
</style>
</head>
<body>
<div class="wrap">
<button class="tgl" id="theme" role="switch" aria-checked="false" aria-label="Dark mode">
  <span class="ghost gm"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 14.9A9.1 9.1 0 0 1 9.1 3 9.1 9.1 0 1 0 21 14.9Z"/></svg></span>
  <span class="ghost gs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/></svg></span>
  <span class="knob"><span class="ks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/></svg></span><span class="km"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 14.9A9.1 9.1 0 0 1 9.1 3 9.1 9.1 0 1 0 21 14.9Z"/></svg></span></span>
</button>

<header>
  <h1>${esc(title)}</h1>
  <p class="sub">${inline(subtitle)}</p>
</header>

<div class="stick">
  <input id="q" type="search" placeholder="Search riders, sponsors, anything" autocomplete="off" autocorrect="off" spellcheck="false">
</div>

<nav id="toc">${nav}</nav>

<main id="main">
${body}
<p class="empty hide" id="empty">Nothing matches.</p>
</main>

<footer>Source: <code>bbmxgp-2026-announcer-sheet.md</code>. Amber lines still need an answer.</footer>
</div>

<script>
(function(){
  var root=document.documentElement, tbtn=document.getElementById('theme');
  function setTheme(t){
    root.setAttribute('data-theme',t);
    tbtn.setAttribute('aria-checked', t==='dark');
    document.querySelector('meta[name=theme-color]').content = t==='dark'?'#101010':'#f7f5f1';
  }
  setTheme(localStorage.getItem('theme')||'light');
  tbtn.onclick=function(){
    var next=root.getAttribute('data-theme')==='dark'?'light':'dark';
    localStorage.setItem('theme',next); setTheme(next);
  };

  var q=document.getElementById('q'), toc=document.getElementById('toc');
  var rows=[].slice.call(document.querySelectorAll('.row'));
  var secs=[].slice.call(document.querySelectorAll('[data-sec]'));
  var empty=document.getElementById('empty');

  q.addEventListener('input',function(){
    var t=q.value.trim().toLowerCase(), any=false;
    rows.forEach(function(r){
      var ok=!t||r.dataset.t.indexOf(t)>-1;
      r.classList.toggle('hide',!ok); if(ok) any=true;
    });
    secs.forEach(function(s){
      s.classList.toggle('hide', !!t && s.querySelectorAll('.row:not(.hide)').length===0);
    });
    toc.classList.toggle('hide',!!t);
    empty.classList.toggle('hide',any||!t);
  });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log('index.html written · ' + sections.length + ' sections · ' + gapCount + ' gaps');
