import {repo} from './database.js';
import {avg,pct,clamp} from './utils.js';
import {evaluationMean} from './evaluations.js';

export const DEFAULT_CONVOCATION_WEIGHTS={rendimiento:50,asistencia:25,puntualidad:15,evolucion:10};
export const ATTENDED=['presente','tarde'];

function dateObj(s){return new Date(`${s}T12:00:00`)}
export function weekBounds(matchDate){
  const d=dateObj(matchDate), day=(d.getDay()+6)%7;
  const monday=new Date(d); monday.setDate(d.getDate()-day);
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
  const iso=x=>x.toISOString().slice(0,10);
  return {start:iso(monday),end:iso(sunday)};
}
export async function getWeekTrainings(matchDate){
  const {start,end}=weekBounds(matchDate);
  const all=(await repo.all('trainings')).filter(t=>t.estado==='realizado'&&t.fecha>=start&&t.fecha<=end&&t.fecha<matchDate).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  return all.slice(-3);
}
function normalize5(n){return Number.isFinite(+n)?clamp((+n-1)/4*100,0,100):null}
function evolutionLabel(current,previous){
  if(!Number.isFinite(current)||!Number.isFinite(previous))return {key:'sinDatos',label:'Sin datos',icon:'→',delta:null};
  const delta=current-previous;
  if(delta>=0.2)return {key:'positiva',label:'Positiva',icon:'↑',delta};
  if(delta<=-0.2)return {key:'negativa',label:'Negativa',icon:'↓',delta};
  return {key:'estable',label:'Estable',icon:'→',delta};
}
function consistency(values){
  const v=values.filter(Number.isFinite);
  if(v.length<2)return v.length?100:null;
  const range=Math.max(...v)-Math.min(...v);
  return clamp(100-(range/4*100),0,100);
}
export async function analyzePlayerWeek(player,trainings,evaluations,allTrainings){
  const rows=trainings.map(t=>evaluations.find(e=>e.trainingId===t.id&&e.playerId===player.id)||null);
  const scores=rows.map(e=>e?evaluationMean(e):null);
  const normalized=scores.map(normalize5).filter(Number.isFinite);
  const performance=normalized.length?avg(normalized):null;
  const attendance=rows.filter(e=>ATTENDED.includes(e?.asistencia)).length;
  const justified=rows.filter(e=>e?.asistencia==='justificada').length;
  const unjustified=rows.filter(e=>e?.asistencia==='noJustificada').length;
  const late=rows.filter(e=>e?.asistencia==='tarde').length;
  const punctual=rows.filter(e=>e?.asistencia==='presente').length;
  const attendancePct=pct(attendance,trainings.length);
  const punctualityPct=pct(punctual,trainings.length);
  const regularity=consistency(normalized);
  const before=allTrainings.filter(t=>t.estado==='realizado'&&t.fecha<trainings[0]?.fecha).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,3);
  const prevScores=before.map(t=>{const e=evaluations.find(x=>x.trainingId===t.id&&x.playerId===player.id);return e?normalize5(evaluationMean(e)):null}).filter(Number.isFinite);
  const previousPerformance=prevScores.length?avg(prevScores):null;
  const evolution=evolutionLabel(performance,previousPerformance);
  const evolutionScore=Number.isFinite(previousPerformance)?clamp(50+(evolution.delta/4*100),0,100):50;
  return {player,trainings,rows,scores,performance,attendance,justified,unjustified,late,punctual,attendancePct,punctualityPct,regularity,evolution,previousPerformance,evolutionScore,total:trainings.length,missing:rows.filter(e=>!e).length};
}
export function weightedScore(a,weights=DEFAULT_CONVOCATION_WEIGHTS){
  const w={...DEFAULT_CONVOCATION_WEIGHTS,...weights};
  const values={rendimiento:a.performance??0,asistencia:a.attendancePct,puntualidad:a.punctualityPct,evolucion:a.evolutionScore};
  const totalWeights=Object.values(w).reduce((x,y)=>x+(Number(y)||0),0)||100;
  return clamp(Object.entries(w).reduce((sum,[k,v])=>sum+(Number(v)||0)*(values[k]??0),0)/totalWeights,0,100);
}
export function reasons(a,score){
  const out=[];
  if(Number.isFinite(a.performance))out.push(`Media deportiva de ${(a.performance/10).toFixed(1)}/10`); else out.push('Sin evaluaciones deportivas completas');
  if(a.total)out.push(`${a.attendance}/${a.total} asistencias (${a.attendancePct.toFixed(0)}%)`);
  if(a.punctual===a.total&&a.total)out.push('100% de puntualidad');
  else if(a.punctual)out.push(`${a.punctual}/${a.total} llegadas puntuales`);
  if(a.unjustified===0)out.push('Sin faltas injustificadas'); else out.push(`${a.unjustified} falta${a.unjustified>1?'s':''} injustificada${a.unjustified>1?'s':''}`);
  if(a.late)out.push(`${a.late} retraso${a.late>1?'s':''}`);
  if(a.evolution.key==='positiva')out.push('Evolución positiva respecto a entrenamientos anteriores');
  if(a.evolution.key==='negativa')out.push('Evolución negativa respecto a entrenamientos anteriores');
  if(a.regularity>=90)out.push('Rendimiento muy regular');
  return out;
}
export function priority(score){if(score>=80)return ['Alta prioridad','success'];if(score>=60)return ['Prioridad media','warning'];return ['Prioridad baja','secondary']}
export async function buildWeeklyAnalysis(matchDate){
  const [players,trainings,evaluations,allTrainings,cfg]=await Promise.all([repo.all('players'),getWeekTrainings(matchDate),repo.all('evaluations'),repo.all('trainings'),repo.get('config','main')]);
  const weights=cfg?.convocationWeights||DEFAULT_CONVOCATION_WEIGHTS;
  const rows=[]; for(const p of players.filter(x=>x.activo)) {const a=await analyzePlayerWeek(p,trainings,evaluations,allTrainings);const score=weightedScore(a,weights);rows.push({...a,score,reasons:reasons(a,score),priority:priority(score)});}
  rows.sort((a,b)=>b.score-a.score||b.performance-a.performance||b.attendancePct-a.attendancePct||a.player.apellidos.localeCompare(b.player.apellidos));
  return {rows,trainings,weights,week:weekBounds(matchDate)};
}
