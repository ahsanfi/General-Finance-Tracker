const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('modules/flagship.css','utf8');
const luminance=hex=>{let h=hex.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');const c=h.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
for(const theme of ['light','dark'])test(`${theme} semantic text colors meet 4.5:1 on their surfaces`,()=>{
  const block=css.match(new RegExp('\\[data-theme="'+theme+'"\\]\\s*\\{([^}]+)'))[1];
  const tokens=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map(m=>[m[1],m[2]]));
  const pairs=['text','text-muted','text-faint'].flatMap(f=>['surface','surface-muted','background'].map(b=>[f,b]));
  pairs.push(['positive','positive-soft'],['negative','negative-soft'],['accent','accent-soft']);
  for(const [f,b] of pairs){const [hi,lo]=[luminance(tokens[f]),luminance(tokens[b])].sort((a,b)=>b-a);const ratio=(hi+.05)/(lo+.05);assert.ok(ratio>=4.5,`${f} / ${b}: ${ratio.toFixed(2)}`);}
});
