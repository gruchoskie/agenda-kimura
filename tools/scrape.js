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
// Placares: só as chaves de equipe publicam o resultado (X × Y)
const teamCats=[...new Set(games.filter(g=>g.cat.endsWith(' EQUIPE')).map(g=>g.cat.replace(/ EQUIPE$/,'')))];
const scores={};
for(const base of teamCats){
  try{
    await p.goto('https://geradorjogos.com.br/competicoes/8abtg1zl',{waitUntil:'networkidle',timeout:60000});
    await p.getByRole('button',{name:base,exact:true}).first().click({timeout:8000});
    await p.waitForTimeout(2500);
    const L=(await p.evaluate(()=>document.body.innerText)).split('\n').map(x=>x.trim()).filter(Boolean);
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
fs.writeFileSync(process.argv[2]||'games.json',JSON.stringify(games,null,1));
console.log(games.length+' jogos');await b.close()})()
