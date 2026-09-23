
export const uid=(p='ID')=>p+'_'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(16).slice(2));
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export const fmtDate=s=>s?new Intl.DateTimeFormat('es-ES').format(new Date(s+'T12:00:00')):'—';
export const age=s=>{if(!s)return '—';let d=new Date(s),n=new Date(),a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a};
export const avg=a=>{const v=a.filter(x=>Number.isFinite(+x)).map(Number);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
export const pct=(a,b)=>b?100*a/b:0;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const today=()=>new Date().toISOString().slice(0,10);
export function download(name,obj){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
