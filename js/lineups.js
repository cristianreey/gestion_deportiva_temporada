import {repo} from './database.js';
import {uid} from './utils.js';

export const FORMATIONS={
 '4-3-3':[['POR',50,90],['LI',15,72],['DFC',38,76],['DFC',62,76],['LD',85,72],['MC',30,56],['MC',50,60],['MC',70,56],['EI',15,30],['DC',50,22],['ED',85,30]],
 '4-4-2':[['POR',50,90],['LI',15,72],['DFC',38,76],['DFC',62,76],['LD',85,72],['MI',15,52],['MC',38,56],['MC',62,56],['MD',85,52],['DC',38,25],['DC',62,25]],
 '4-2-3-1':[['POR',50,90],['LI',15,72],['DFC',38,76],['DFC',62,76],['LD',85,72],['MCD',38,60],['MCD',62,60],['EI',18,40],['MCO',50,38],['ED',82,40],['DC',50,20]],
 '4-3-1-2':[['POR',50,90],['LI',15,72],['DFC',38,76],['DFC',62,76],['LD',85,72],['MC',28,58],['MC',50,62],['MC',72,58],['MCO',50,40],['DC',38,23],['DC',62,23]],
 '3-5-2':[['POR',50,90],['DFC',25,74],['DFC',50,78],['DFC',75,74],['MI',10,50],['MC',32,56],['MC',50,60],['MC',68,56],['MD',90,50],['DC',38,24],['DC',62,24]],
 '3-4-3':[['POR',50,90],['DFC',25,74],['DFC',50,78],['DFC',75,74],['MI',18,53],['MC',40,58],['MC',60,58],['MD',82,53],['EI',18,29],['DC',50,21],['ED',82,29]],
 '5-3-2':[['POR',50,90],['LI',8,70],['DFC',28,76],['DFC',50,79],['DFC',72,76],['LD',92,70],['MC',30,57],['MC',50,62],['MC',70,57],['DC',38,24],['DC',62,24]]
};
export async function latestLineup(matchId){const ls=(await repo.all('lineups')).filter(x=>x.matchId===matchId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));if(!ls.length)return null;const l=ls[0];l.players=await repo.all('lineupPlayers').then(xs=>xs.filter(x=>x.lineupId===l.id));return l}
export async function saveLineup(matchId,formation,players){
  const now=new Date().toISOString();
  const current=await latestLineup(matchId);
  const lineup={id:uid('L'),matchId,formation,createdAt:now,updatedAt:now,version:(current?.version||0)+1};
  await repo.put('lineups',lineup);
  for(const p of players)await repo.put('lineupPlayers',{id:uid('LP'),lineupId:lineup.id,matchId,playerId:p.playerId,status:p.status,role:p.role||'',dorsal:p.dorsal??null,x:+p.x,y:+p.y});
  return lineup;
}
