#!/usr/bin/env python3
"""Atualiza index.html a partir de games.json (gerado por tools/scrape.js).
 - mantém ROWS (jogos do clube) em dia com horário, mesa, adversários e novos jogos
 - gera NEXT: possível jogo seguinte no chaveamento de cada jogo do clube
Uso: python3 tools/update.py games.json [index.html]"""
import json,re,sys,unicodedata
gp=sys.argv[1]; ip=sys.argv[2] if len(sys.argv)>2 else 'index.html'
s=open(ip,encoding='utf8').read(); G=json.load(open(gp))
def norm(x): return re.sub(r'\s+',' ',unicodedata.normalize('NFD',x).encode('ascii','ignore').decode().upper().strip())
i=s.index('var ROWS=')+9; j=s.index('];',i)+1
rows=json.loads(s[i:j])
k=s.index('var TM={'); k2=s.index('};',k)+1
TM=json.loads(s[k+7:k2])
club={}
for r in rows:
    if r[8]: club[norm(r[6])]=r[8]
    if r[9]: club[norm(r[7])]=r[9]
def winner(x):
    """'a' ou 'b' quando dá para saber quem venceu: pelo placar ou porque avançou no chaveamento."""
    if x['status']=='Agendado': return ''
    m=re.match(r'(\d+) × (\d+)$',x.get('sc',''))
    if m and m.group(1)!=m.group(2): return 'a' if int(m.group(1))>int(m.group(2)) else 'b'
    if x['fase'].startswith('GRUPO'): return ''
    key=(x['d'],x['t'])
    def later(n):
        for y in G:
            if y is x or y['cat']!=x['cat'] or (y['d'],y['t'])<=key or y['fase'].startswith('GRUPO'): continue
            if n in (y['a'],y['b']): return True
        return False
    la,lb=later(x['a']),later(x['b'])
    return 'a' if la and not lb else 'b' if lb and not la else ''
out=[];seen=set()
for x in G:
    la,lb=club.get(norm(x['a'])),club.get(norm(x['b']))
    if x['cat'].endswith(' EQUIPE'):
        la=la if la and (la+'|'+x['cat']) in TM else None
        lb=lb if lb and (lb+'|'+x['cat']) in TM else None
    if not(la or lb): continue
    out.append([x['d'],x['t'],x['mesa'],x['j'],x['cat'],x['fase'],x['a'],x['b'],la or '',lb or '',x.get('sc',''),'' if x['status']=='Agendado' else x['status'],winner(x)])
old={(r[4],r[3]) for r in rows}; new={(r[4],r[3]) for r in out}
print('linhas',len(out),'| novas',sorted(new-old),'| removidas',sorted(old-new))
idx={(x['cat'],x['j']):x for x in G}
def slot_txt(cat,t,deep=True):
    m=re.match(r'Vencedor Jogo (\d+)$',t)
    if m:
        g=idx.get((cat,m.group(1)))
        if g and deep: return 'Vencedor de '+slot_txt(cat,g['a'],False)+' x '+slot_txt(cat,g['b'],False)
        return ('Vencedor do jogo ' if deep else 'venc. jogo ')+m.group(1)
    m=re.match(r'(\d+)º Grupo (\w+)$',t)
    if m: return m.group(1)+'º do Grupo '+m.group(2)
    return t
def child(cat,jn):
    r=[]
    for x in G:
        if x['cat']!=cat: continue
        for side,oth in (('a','b'),('b','a')):
            if x[side]=='Vencedor Jogo '+jn: r.append(('',x,x[oth]))
    return r
def group_children(cat,grp):
    r=[]
    for x in G:
        if x['cat']!=cat: continue
        for side,oth in (('a','b'),('b','a')):
            m=re.match(r'(\d+)º Grupo (\w+)$',x[side])
            if m and 'GRUPO '+m.group(2)==grp: r.append((m.group(1)+'º',x,x[oth]))
    return sorted(r,key=lambda t:t[0])
NEXT={}
for r in out:
    cat,jn,fase=r[4],r[3],r[5]
    ch=group_children(cat,fase) if fase.startswith('GRUPO') else child(cat,jn.lstrip('0') and jn)
    if not ch and not fase.startswith('GRUPO'): ch=child(cat,jn)
    if ch: NEXT[cat+'|'+jn]=[{'p':p,'f':x['fase'],'d':x['d'],'t':x['t'],'m':x['mesa'],'j':x['j'],'o':slot_txt(cat,o)} for p,x,o in ch]
print('NEXT',len(NEXT))
def js(o): return json.dumps(o,ensure_ascii=False,separators=(',',':'))
rows_js='['+',\n'.join(js(r) for r in out)+']'
s=s[:i]+rows_js+s[j:]
nx='/*NEXT_START*/var NEXT='+js(NEXT)+';/*NEXT_END*/'
if '/*NEXT_START*/' in s: s=re.sub(r'/\*NEXT_START\*/.*?/\*NEXT_END\*/',lambda m:nx,s,flags=re.S)
else: s=s.replace('var DAYS=',nx+'\nvar DAYS=',1)
open(ip,'w',encoding='utf8').write(s)
