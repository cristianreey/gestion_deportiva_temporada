
import {repo} from './database.js'; import {avg,pct} from './utils.js';
export async function playerStats(id){
 const [ts,es,ms,cs,xs]=await Promise.all([repo.all('trainings'),repo.all('evaluations'),repo.all('matches'),repo.all('callups'),repo.all('changes')]);
 const ev=es.filter(e=>e.playerId===id), present=ev.filter(e=>['presente','tarde'].includes(e.asistencia));
 const playedMatches=ms.filter(m=>m.estado==='disputado');
 const call=cs.filter(c=>c.playerId===id);
 const mins=[]; for(const m of playedMatches) mins.push({m,min:calcMinutes(m,id,call,xs)});
 const used=mins.filter(x=>x.min>0);
 return {trainings:ts.length,attendance:present.length,attendancePct:pct(present.length,ev.length),just:ev.filter(e=>e.asistencia==='justificada').length,
 unJust:ev.filter(e=>e.asistencia==='noJustificada').length,injured:ev.filter(e=>e.asistencia==='lesionado').length,late:ev.filter(e=>e.asistencia==='tarde').length,
 behavior:avg(ev.map(e=>e.comportamiento)),attitude:avg(ev.map(e=>e.actitud)),efficacy:avg(ev.map(e=>e.eficacia)),global:avg(ev.flatMap(e=>[e.comportamiento,e.actitud,e.eficacia])),
 callups:call.filter(c=>c.convocado).length,starters:call.filter(c=>c.situacionInicial==='titular').length,subs:call.filter(c=>c.situacionInicial==='suplente').length,
 matchesPlayed:used.length,totalMinutes:used.reduce((a,x)=>a+x.min,0),avgMinutes:avg(used.map(x=>x.min))||0,
 pctMinutes:pct(used.reduce((a,x)=>a+x.min,0),playedMatches.reduce((a,m)=>a+(m.duracion||0),0)),
 substituted:xs.filter(x=>x.jugadorSaleId===id).length,entered:xs.filter(x=>x.jugadorEntraId===id).length};
}
function calcMinutes(m,id,callups,changes){const c=callups.find(x=>x.matchId===m.id&&x.playerId===id);if(!c)return 0;let on=c.situacionInicial==='titular',start=on?0:null,total=0;for(const x of changes.filter(x=>x.matchId===m.id).sort((a,b)=>a.minuto-b.minuto)){if(x.jugadorSaleId===id&&on){total+=x.minuto-start;on=false;start=null}if(x.jugadorEntraId===id&&!on){on=true;start=x.minuto}}if(on)total+=(m.duracion||0)-start;return Math.max(0,total)}
