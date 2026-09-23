
import {repo} from './database.js'; import {download} from './utils.js';
export async function exportBackup(){const d=await repo.dump();const c=(d.config||[])[0]||{};download(`equipo_temporada_${(c.season||'backup').replace('/','_')}.json`,d)}
export async function importBackup(file){const data=JSON.parse(await file.text());for(const s of repo.stores)if(!Array.isArray(data[s]))throw new Error('JSON no válido: falta '+s);await repo.replaceAll(data)}
