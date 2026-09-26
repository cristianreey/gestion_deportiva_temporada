
const DB_NAME='GestionDeportivaDB', DB_VERSION=2;
const STORES=['config','players','trainings','evaluations','matches','callups','changes','lineups','lineupPlayers'];
let dbp;
function openDB(){if(dbp)return dbp;dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;for(const s of STORES)if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbp}
async function tx(store,mode='readonly'){const db=await openDB();return db.transaction(store,mode).objectStore(store)}
export const repo={
 stores:STORES,
 async all(s){const o=await tx(s);return new Promise((res,rej)=>{const r=o.getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async get(s,id){const o=await tx(s);return new Promise((res,rej)=>{const r=o.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async put(s,v){const o=await tx(s,'readwrite');return new Promise((res,rej)=>{const r=o.put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error)})},
 async delete(s,id){const o=await tx(s,'readwrite');return new Promise((res,rej)=>{const r=o.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})},
 async clear(s){const o=await tx(s,'readwrite');return new Promise((res,rej)=>{const r=o.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})},
 async replaceAll(data){for(const s of STORES){await this.clear(s);for(const x of (data[s]||[]))await this.put(s,x)}},
 async dump(){const d={version:2,exportedAt:new Date().toISOString()};for(const s of STORES)d[s]=await this.all(s);return d}
};
