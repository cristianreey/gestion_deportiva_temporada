
export function resultForTeam(m){if(m.golesLocal==null||m.golesVisitante==null)return '—';const us=m.somosLocal?m.golesLocal:m.golesVisitante, them=m.somosLocal?m.golesVisitante:m.golesLocal;return us>them?'Victoria':us<them?'Derrota':'Empate'}
export function rival(m){return m.somosLocal?m.equipoVisitante:m.equipoLocal}
