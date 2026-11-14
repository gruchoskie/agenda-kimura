// Lê a programação pública (todas as páginas) e grava em games.json
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
await p.goto('https://geradorjogos.com.br/competicoes/8abtg1zl',{waitUntil:'networkidle',timeout:60000});
await p.click('text=Programação (mesa e horário)');await p.waitForTimeout(4000);
const games=[];const seen=new Set();
for(let page=1;page<=30;page++){
  const t=await p.evaluate(()=>document.body.innerText);
  const lines=t.split('\n').map(s=>s.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^Jogo (\d+) · Mesa (\d+) · (\d\d:\d\d) · (\d\d)\/11\/2026/);
    if(!m||!lines[i-2]||!lines[i-2].includes(' · '))continue;
    const [cat,fase]=lines[i-2].split(' · ');
    // placar/status ficam entre o título e a linha do jogo; os nomes vêm depois
    const g={cat:cat.replace(/[()]/g,'').replace(/\s+/g,' ').replace(/ INDIVIDUAL$/,''),fase,status:lines[i-1],j:m[1],mesa:m[2],t:m[3],d:m[4],a:lines[i+1],b:lines[i+2]};
    const k=[g.cat,g.fase,g.j,g.mesa,g.t,g.d].join('|');
    if(!seen.has(k)){seen.add(k);games.push(g)}
  }
  const next=p.locator('button:has-text("›")').last();
  if(!(await next.isEnabled().catch(()=>false)))break;
  await next.click();await p.waitForTimeout(800);
}
const comResultado=new Set(games.filter(g=>g.status!=='Agendado').map(g=>g.cat));
async function abrir(url,nome,ok){
  for(let t=1;t<=3;t++){
    try{
      await p.goto(url,{waitUntil:'networkidle',timeout:60000});
      await p.getByRole('button',{name:nome,exact:true}).first().click({timeout:15000});
      await p.waitForSelector(ok,{timeout:20000});
      await p.waitForTimeout(1200);
      return (await p.evaluate(()=>document.body.innerText)).split('\n').map(x=>x.trim()).filter(Boolean);
    }catch(e){if(t>=3)throw e}
  }
}
// Placares: só as chaves de equipe publicam o resultado (X × Y)
const teamCats=[...new Set(games.filter(g=>g.cat.endsWith(' EQUIPE')&&comResultado.has(g.cat)).map(g=>g.cat.replace(/ EQUIPE$/,'')))];
const scores={};
for(const base of teamCats){
  try{
    const L=await abrir('https://geradorjogos.com.br/competicoes/8abtg1zl',base,'text=Eliminatórias');
    for(let i=0;i<L.length;i++){
      const m=L[i].match(/^Jogo (\d+) · Mesa/);if(!m)continue;
      for(let k=i+1;k<Math.min(i+7,L.length);k++){
        if(/^Jogo \d+ ·/.test(L[k]))break;
        if(/^\d+ × \d+$/.test(L[k])){const sc=L[k].split(' × ').map(Number);scores[base+' EQUIPE|'+m[1]]={a:L[i+1],b:L[k+1],sa:sc[0],sb:sc[1]};break}
      }
    }
  }catch(e){}
}
games.forEach(g=>{const v=scores[g.cat+'|'+g.j];if(!v||g.status==='Agendado')return;
  if(v.a===g.a&&v.b===g.b)g.sc=v.sa+' × '+v.sb;else if(v.a===g.b&&v.b===g.a)g.sc=v.sb+' × '+v.sa});
// Individuais: a competição dos atletas publica placar e parciais dos sets
try{
  const html=fs.readFileSync(__dirname+'/../index.html','utf8');
  const rowsTxt=html.slice(html.indexOf('var ROWS=')+9,html.indexOf('];',html.indexOf('var ROWS='))+1);
  const rowCats=[...new Set(JSON.parse(rowsTxt).map(r=>r[4]).filter(c=>!c.endsWith(' EQUIPE')&&comResultado.has(c)))];
  const strip=n=>n.replace(/\s*\(#\d+[^)]*\)\s*$/,'').trim();
  const ind={};
  for(const cat of rowCats){
    try{
      const L=await abrir('https://geradorjogos.com.br/competicoes/qs3i5xgp',cat,'text=ORDEM DOS JOGOS');
      for(let i=0;i<L.length;i++){
        const m=L[i].match(/^Jogo (\d+) · Mesa/);if(!m)continue;
        try{
        let k=i+1;if(/^\d+º$/.test(L[k]))k++;
        const a=strip(L[k]);
        let sc=null,q=k+1;
        for(;q<Math.min(i+9,L.length);q++){if(/^\d+ × \d+$/.test(L[q])){sc=L[q];break}if(/^Jogo \d+ ·/.test(L[q]))break}
        if(!sc)continue;
        const sets=[];let r=q+1;while(r<L.length&&/^\d+×\d+$/.test(L[r])){sets.push(L[r]);r++}
        const b=strip(L[r]);
        const conf=/^CONFIRMADO/.test(L[i-1]||'');
        const n=sc.split(' × ').map(Number);
        if(conf||n[0]||n[1])ind[cat+'|'+m[1]]={a,b,sa:n[0],sb:n[1],sets:sets.map(x=>x.replace('×','-')),conf};
        }catch(e){}
      }
      console.error('ind',cat,Object.keys(ind).filter(k=>k.startsWith(cat+'|')).length);
    }catch(e){console.error('ERRO',cat,String(e).slice(0,120))}
  }
  games.forEach(g=>{const v=ind[g.cat+'|'+g.j];if(!v||(!v.conf&&g.status==='Agendado'))return;
    const f=v.a===g.a&&v.b===g.b,sw=v.a===g.b&&v.b===g.a;if(!f&&!sw)return;
    const sa=f?v.sa:v.sb,sb=f?v.sb:v.sa,sets=v.sets.map(x=>{const t=x.split('-');return f?x:t[1]+'-'+t[0]});
    if(sa===sb)return;
    g.sc=sa+' × '+sb+(sets.length?' ('+sets.join(', ').replace(/-/g,'×')+')':'');
    if(g.status==='Agendado')g.status='Concluído';
  });
}catch(e){}
fs.writeFileSync(process.argv[2]||'games.json',JSON.stringify(games,null,1));
console.log(games.length+' jogos');await b.close()})()
