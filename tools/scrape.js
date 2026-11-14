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
fs.writeFileSync(process.argv[2]||'games.json',JSON.stringify(games,null,1));
console.log(games.length+' jogos');await b.close()})()
