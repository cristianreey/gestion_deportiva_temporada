import {repo} from './database.js';
import {uid,esc,fmtDate} from './utils.js';
import {DRAW_COLORS,HANDLES,clampNum,round,drawingMarkup,hitDrawing,snapLine45,rotateVec,normAngle,snapAngle,fitCenter,sizeLimits,computeResize,cursorFor} from './boardTools.js';

export const EXERCISE_CATEGORIES=['Calentamiento','Técnica','Táctica','Posesión','Conservación','Transiciones','Ataque','Defensa','Finalización','ABP','Porteros','Físico','Recuperación'];
export const SURFACES={full:'Campo completo',half:'Medio campo',third:'Último tercio',area:'Área',horizontal:'Campo horizontal',vertical:'Campo vertical',grid:'Terreno libre / cuadrícula'};
const icon={A:'A',B:'B',N:'N',GK:'P',ball:'⚽',cone:'▲',pole:'│',goal:'▭',mini:'▱',ring:'○',ladder:'▥',hurdle:'⌒',dummy:'♟'};
let ctx=null;
export async function tacticsLibrary({A,setHead,openModal,notify,saved}){
 setHead('Pizarra Táctica','Biblioteca de ejercicios y tareas');const xs=(await repo.all('exercises')).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 A.innerHTML=`<div class="d-flex flex-wrap gap-2 justify-content-between mb-3"><div class="d-flex gap-2 flex-grow-1"><input id="exSearch" class="form-control" placeholder="Buscar ejercicio..."><select id="exCat" class="form-select" style="max-width:220px"><option value="">Todas las categorías</option>${EXERCISE_CATEGORIES.map(x=>`<option>${x}</option>`).join('')}</select></div><a href="#tacticBoard/new" class="btn btn-primary"><i class="fa-solid fa-plus me-1"></i> Nuevo ejercicio</a></div><div id="exerciseGrid" class="row g-3"></div>`;
 const render=()=>{const q=document.querySelector('#exSearch').value.toLowerCase(),cat=document.querySelector('#exCat').value;document.querySelector('#exerciseGrid').innerHTML=xs.filter(x=>(!cat||x.category===cat)&&(!q||`${x.name} ${x.objective} ${x.description}`.toLowerCase().includes(q))).map(x=>`<div class="col-md-6 col-xl-4"><div class="card h-100 exercise-card"><div class="exercise-preview">${x.preview||'<i class="fa-solid fa-chalkboard-user"></i>'}</div><div class="card-body"><div class="d-flex justify-content-between"><span class="badge text-bg-light">${esc(x.category||'Sin categoría')}</span><small class="text-secondary">${x.duration||0} min</small></div><h5 class="mt-2">${esc(x.name||'Ejercicio sin nombre')}</h5><p class="text-secondary small">${esc(x.objective||x.description||'')}</p><div class="d-flex gap-2"><a class="btn btn-sm btn-primary" href="#tacticBoard/${x.id}">Abrir</a><button class="btn btn-sm btn-outline-secondary" data-dup="${x.id}">Duplicar</button><button class="btn btn-sm btn-outline-danger ms-auto" data-del="${x.id}"><i class="fa-solid fa-trash"></i></button></div></div></div></div>`).join('')||'<div class="col-12"><div class="alert alert-info">No hay ejercicios. Crea el primero desde la Pizarra Táctica.</div></div>';document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('¿Eliminar este ejercicio de la biblioteca?')){await repo.delete('exercises',b.dataset.del);tacticsLibrary({A,setHead,openModal,notify,saved})}});document.querySelectorAll('[data-dup]').forEach(b=>b.onclick=async()=>{const x=xs.find(z=>z.id===b.dataset.dup);await repo.put('exercises',{...x,id:uid('EX'),name:x.name+' (copia)',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});notify('Ejercicio duplicado');tacticsLibrary({A,setHead,openModal,notify,saved})})};document.querySelector('#exSearch').oninput=render;document.querySelector('#exCat').onchange=render;render();
}
export async function tacticBoard(id,{A,setHead,openModal,notify,saved}){
 const existing=id&&id!=='new'?await repo.get('exercises',id):null;setHead(existing?'Editar ejercicio':'Nueva Pizarra Táctica','Diseño gráfico editable');
 const state=existing?.boardState?JSON.parse(existing.boardState):{surface:'full',objects:[]};
 state.drawings=state.drawings||[]; // compatibilidad: los ejercicios antiguos no tienen dibujos
 let selected=null,history=[],future=[];
 // Estado de la herramienta de dibujo (no se guarda: es solo de la sesión de edición)
 const pen={on:false,tool:'free',color:DRAW_COLORS[1].value,width:5};
 const ERASER_TOL=10; // radio del borrador en px
 A.innerHTML=`<div class="tactic-layout"><div class="card tactic-tools"><div class="card-body"><div class="section-title">Herramientas</div><label class="form-label small">Terreno</label><select id="surface" class="form-select mb-3">${Object.entries(SURFACES).map(([k,v])=>`<option value="${k}" ${state.surface===k?'selected':''}>${v}</option>`).join('')}</select><div class="tool-group"><b>Jugadores</b><div class="tool-grid"><button data-add="A">A</button><button data-add="B">B</button><button data-add="N">N</button><button data-add="GK">POR</button></div></div><div class="tool-group"><b>Material</b><div class="tool-grid"><button data-add="ball">⚽</button><button data-add="cone">▲</button><button data-add="pole">Pica</button><button data-add="goal">Portería</button><button data-add="mini">Mini</button><button data-add="ring">Aro</button><button data-add="ladder">Esc.</button><button data-add="hurdle">Valla</button><button data-add="dummy">Maniq.</button></div></div><div class="tool-group"><b>Gráficos</b><div class="tool-grid"><button data-add="arrow">→</button><button data-add="pass">⇢ Pase</button><button data-add="run">➜ Cond.</button><button data-add="line">―</button><button data-add="dash">┄</button><button data-add="rect">▭ Zona</button><button data-add="circle">○</button><button data-add="text">Texto</button></div></div><div class="tool-group"><b>Edición</b><div class="tool-grid"><button id="undo">↶</button><button id="redo">↷</button><button id="duplicate">Duplicar</button><button id="deleteObj">Eliminar</button><button id="front">Delante</button><button id="back">Detrás</button><button id="rotate90">Girar 90°</button><button id="rotateReset">Quitar giro</button></div><input id="objColor" type="color" class="form-control form-control-color mt-2" value="#1d75bd"><div class="object-size-panel mt-3"><b>Tamaño del elemento</b><div class="row g-2 mt-1"><div class="col-6"><label class="form-label small mb-1">Ancho</label><input id="objWidth" type="number" min="2" max="80" step="1" class="form-control form-control-sm" value="8" disabled></div><div class="col-6"><label class="form-label small mb-1">Alto</label><input id="objHeight" type="number" min="2" max="80" step="1" class="form-control form-control-sm" value="8" disabled></div></div><div class="small text-secondary mt-1">Selecciona un elemento y arrastra sus tiradores, o escribe aquí su ancho y alto (% de la pizarra).</div><button id="resetSize" type="button" class="btn btn-sm btn-outline-secondary w-100 mt-2" disabled>Restablecer tamaño</button></div></div></div></div><div><div class="card"><div class="card-body"><div class="d-flex flex-wrap gap-2 justify-content-between mb-2"><div><b>Pizarra</b><div class="small text-secondary">Arrastra los elementos. Selecciona uno para redimensionarlo o girarlo con sus tiradores. Toca dos veces un texto/jugador para editar su etiqueta.</div></div><div><button id="clearBoard" class="btn btn-outline-danger btn-sm">Limpiar</button> <button id="saveExercise" class="btn btn-primary btn-sm"><i class="fa-solid fa-floppy-disk"></i> Guardar ejercicio</button></div></div>
 <div class="draw-toolbar"><button id="drawToggle" type="button" class="btn btn-sm btn-outline-primary" aria-pressed="false" title="Activar / desactivar el modo dibujo"><i class="fa-solid fa-pen"></i> Dibujar</button><div id="drawOptions" class="draw-options" hidden><div class="btn-group btn-group-sm" role="group" aria-label="Herramienta de dibujo"><button type="button" class="btn btn-outline-secondary" data-dtool="free" title="Trazo libre"><i class="fa-solid fa-pencil"></i></button><button type="button" class="btn btn-outline-secondary" data-dtool="line" title="Línea recta (Mayús = ángulos de 45°)"><i class="fa-solid fa-slash"></i></button><button type="button" class="btn btn-outline-secondary" data-dtool="arrow" title="Flecha"><i class="fa-solid fa-arrow-right-long"></i></button><button type="button" class="btn btn-outline-secondary" data-dtool="erase" title="Borrador"><i class="fa-solid fa-eraser"></i></button></div><div class="draw-colors" role="group" aria-label="Color">${DRAW_COLORS.map(c=>`<button type="button" class="draw-color" data-dcolor="${c.value}" title="${c.name}" aria-label="${c.name}" style="--c:${c.value}"></button>`).join('')}</div><label class="draw-width" title="Grosor del trazo"><i class="fa-solid fa-grip-lines"></i><input id="drawWidth" type="range" min="2" max="16" step="1" value="${pen.width}"><span id="drawWidthVal">${pen.width}</span></label><div class="btn-group btn-group-sm"><button type="button" id="dUndo" class="btn btn-outline-secondary" title="Deshacer (Ctrl+Z)"><i class="fa-solid fa-rotate-left"></i></button><button type="button" id="dRedo" class="btn btn-outline-secondary" title="Rehacer (Ctrl+Y)"><i class="fa-solid fa-rotate-right"></i></button></div><button type="button" id="clearDrawings" class="btn btn-sm btn-outline-danger" title="Borrar todos los dibujos (las fichas se conservan)"><i class="fa-solid fa-trash-can"></i> Borrar dibujos</button></div></div>
 <div id="tacticCanvas" class="tactic-canvas" data-mode="move"><div class="tactic-objects"></div><svg class="tactic-draw" xmlns="http://www.w3.org/2000/svg" aria-label="Capa de dibujo"><g class="draw-items"></g><g class="draw-live"></g></svg><div class="tactic-selection" hidden></div></div></div></div><div class="card mt-3"><div class="card-body"><div class="section-title">Ficha del ejercicio</div><form id="exerciseForm" class="row g-3"><div class="col-md-8"><label class="form-label">Nombre</label><input name="name" required class="form-control" value="${esc(existing?.name||'')}"></div><div class="col-md-4"><label class="form-label">Categoría</label><select name="category" class="form-select">${EXERCISE_CATEGORIES.map(x=>`<option ${existing?.category===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('objective','Objetivo',existing)}${field('description','Descripción',existing,true)}${field('organization','Organización',existing,true)}${field('development','Desarrollo',existing,true)}<div class="col-md-3"><label class="form-label">Duración (min)</label><input name="duration" type="number" min="0" class="form-control" value="${existing?.duration||0}"></div><div class="col-md-3"><label class="form-label">Series</label><input name="series" type="number" min="0" class="form-control" value="${existing?.series||0}"></div><div class="col-md-3"><label class="form-label">Repeticiones</label><input name="repetitions" type="number" min="0" class="form-control" value="${existing?.repetitions||0}"></div><div class="col-md-3"><label class="form-label">Nº jugadores</label><input name="playerCount" type="number" min="0" class="form-control" value="${existing?.playerCount||0}"></div>${field('dimensions','Dimensiones del espacio',existing)}${field('material','Material necesario',existing)}${field('intensity','Intensidad',existing)}${field('variants','Variantes',existing,true)}${field('corrections','Aspectos a corregir',existing,true)}${field('observations','Observaciones',existing,true)}</form></div></div></div></div>`;

 /* ---------- Referencias al DOM ---------- */
 const $=s=>document.querySelector(s);
 const canvas=$('#tacticCanvas'),objLayer=canvas.querySelector('.tactic-objects'),svg=canvas.querySelector('.tactic-draw');
 const drawItems=svg.querySelector('.draw-items'),drawLive=svg.querySelector('.draw-live'),sel=canvas.querySelector('.tactic-selection');

 /* ---------- Utilidades de geometría (todo en px del lienzo) ---------- */
 const size=()=>({W:canvas.clientWidth||1,H:canvas.clientHeight||1});
 const byId=i=>state.objects.find(o=>o.id===i);
 const dims=o=>{const d=defaultSize(o.type);return{w:o.width??d.width,h:o.height??d.height}}; // ancho/alto en %
 const geo=o=>{const{W,H}=size(),{w,h}=dims(o);return{W,H,cx:o.x/100*W,cy:o.y/100*H,w:w/100*W,h:h/100*H,rot:o.rotation||0}};
 // Escribe la posición/tamaño/giro de una ficha directamente en su elemento (sin repintar todo)
 function place(el,o){const{w,h}=dims(o),r=o.rotation||0;el.style.left=o.x+'%';el.style.top=o.y+'%';el.style.width=w+'%';el.style.height=h+'%';el.style.setProperty('--rot',r+'deg');el.style.transform=`translate(-50%,-50%) rotate(${r}deg)`}
 // Mantiene la ficha dentro de la pizarra tras mover, redimensionar o girar
 function keepInside(o){const g=geo(o),c=fitCenter(g.cx,g.cy,g.w,g.h,g.rot,g.W,g.H);o.x=round(c.cx/g.W*100,3);o.y=round(c.cy/g.H*100,3)}
 // Ajusta el símbolo interior de la ficha al tamaño de su caja: así se comporta como una imagen
 function fitObject(el,o){const g=el.querySelector('.tg');if(!g)return;const{W,H}=size(),{w,h}=dims(o),pw=w/100*W,ph=h/100*H;g.style.transform='none';const nw=g.offsetWidth||1,nh=g.offsetHeight||1;
  if(['A','B','N','GK'].includes(o.type)){g.style.transform=`scale(${Math.min(pw*.6/nw,ph*.6/nh)})`}          // letra de jugador: proporcional
  else if(o.type==='text'){g.style.transform=`scale(${Math.min(pw*.86/nw,ph*.8/nh)})`}                        // texto: proporcional
  else{g.style.transform=`scale(${pw*.9/nw},${ph*.9/nh})`}}                                                    // material/gráficos: se estiran
 const fitAll=()=>objLayer.querySelectorAll('.tactic-object').forEach(el=>{const o=byId(el.dataset.id);if(o)fitObject(el,o)});

 /* ---------- Historial (fichas + dibujos comparten deshacer/rehacer) ---------- */
 function pushHistory(str){history.push(str);if(history.length>50)history.shift();future=[];syncUi()}
 const snap=()=>pushHistory(JSON.stringify(state));
 function restore(str){Object.assign(state,JSON.parse(str));state.drawings=state.drawings||[];render()}
 function undo(){if(!history.length)return;future.push(JSON.stringify(state));restore(history.pop())}
 function redo(){if(!future.length)return;history.push(JSON.stringify(state));restore(future.pop())}

 /* ---------- Pintado ---------- */
 function render(){if(selected&&!byId(selected))selected=null;canvas.dataset.surface=state.surface;objLayer.innerHTML=state.objects.map((o,i)=>objHtml(o,i,selected===o.id)).join('');fitAll();renderDrawings();buildSelection();syncSizeControls();syncUi()}
 function renderDrawings(){const{W,H}=size();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);drawItems.innerHTML=state.drawings.map(d=>drawingMarkup(d,W,H)).join('')}

 /* ---------- Selección y tiradores ---------- */
 let lockFlip=false; // durante un giro no se recoloca el tirador de giro
 function setSelected(i){if(selected===i)return;selected=i;objLayer.querySelectorAll('.tactic-object').forEach(el=>el.classList.toggle('selected',el.dataset.id===i));buildSelection();syncSizeControls()}
 function buildSelection(){const o=byId(selected);sel.hidden=!o;if(!o){sel.innerHTML='';return}
  sel.innerHTML=Object.keys(HANDLES).map(h=>`<span class="sh sh-${h}" data-h="${h}"></span>`).join('')+'<span class="sh-rot" data-h="rot" title="Girar (Mayús = saltos de 15°)"><i class="fa-solid fa-rotate"></i></span><span class="sh-del" data-h="del" title="Eliminar"><i class="fa-solid fa-xmark"></i></span>';updateSelection()}
 function updateSelection(){const o=byId(selected);if(!o||sel.hidden)return;const g=geo(o),{w,h}=dims(o);
  Object.assign(sel.style,{left:o.x+'%',top:o.y+'%',width:w+'%',height:h+'%',transform:`translate(-50%,-50%) rotate(${g.rot}deg)`});
  if(!lockFlip){const[,ry]=rotateVec(0,-(g.h/2+40),g.rot);sel.classList.toggle('flip',g.cy+ry<14)} // si el giro cae fuera por arriba, va debajo
  sel.querySelectorAll('.sh[data-h]').forEach(e=>e.style.cursor=cursorFor(e.dataset.h,g.rot))}

 /* Seguimiento de un puntero (ratón, dedo o lápiz) hasta que se suelta */
 function trackPointer(e,onMove,onEnd){const pid=e.pointerId;
  const mv=ev=>{if(ev.pointerId===pid)onMove(ev)};
  const end=ev=>{if(ev.pointerId!==pid)return;window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);if(onEnd)onEnd(ev)};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end)}

 /* ---------- MOVER (arrastrar el cuerpo de la ficha) ---------- */
 objLayer.addEventListener('pointerdown',e=>{
  const el=e.target.closest('.tactic-object');if(!el||pen.on||e.button>0)return;
  const o=byId(el.dataset.id);if(!o)return;e.preventDefault();setSelected(o.id);
  const g0=geo(o),r0=canvas.getBoundingClientRect(),before=JSON.stringify(state);let moved=false;
  const off={x:g0.cx-(e.clientX-r0.left),y:g0.cy-(e.clientY-r0.top)}; // se conserva el punto donde se agarró la ficha
  trackPointer(e,ev=>{
   if(!moved){if(Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)<3)return;moved=true;pushHistory(before)} // un simple clic no ensucia el historial
   const r=canvas.getBoundingClientRect(),g=geo(o),c=fitCenter(ev.clientX-r.left+off.x,ev.clientY-r.top+off.y,g.w,g.h,g.rot,g.W,g.H);
   o.x=round(c.cx/g.W*100,3);o.y=round(c.cy/g.H*100,3);place(el,o);updateSelection()})});
 objLayer.addEventListener('dblclick',e=>{const el=e.target.closest('.tactic-object');if(!el)return;const o=byId(el.dataset.id);if(!o)return;const t=prompt('Etiqueta / número',o.text||'');if(t!==null){snap();o.text=t;render()}});
 // Clic en el fondo = deseleccionar (se usa pointerdown para no depender del evento click tras arrastrar)
 canvas.addEventListener('pointerdown',e=>{if(!pen.on&&(e.target===canvas||e.target===objLayer))setSelected(null)});

 /* ---------- REDIMENSIONAR y GIRAR (tiradores) ---------- */
 sel.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('[data-h="del"]'))deleteSelected()});
 sel.addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-h]')?.dataset.h;if(!h||e.button>0)return;e.preventDefault();e.stopPropagation();
  const o=byId(selected);if(!o||h==='del')return;const el=objLayer.querySelector(`[data-id="${o.id}"]`),g0=geo(o),before=JSON.stringify(state);let moved=false;
  if(h==='rot'){ // --- girar alrededor del centro
   const base=sel.classList.contains('flip')?-90:90;lockFlip=true;
   trackPointer(e,ev=>{const r=canvas.getBoundingClientRect(),ang=Math.atan2(ev.clientY-r.top-g0.cy,ev.clientX-r.left-g0.cx)*180/Math.PI+base,rot=snapAngle(normAngle(ang),ev.shiftKey);
    if(!moved){if(rot===g0.rot)return;moved=true;pushHistory(before)}
    o.rotation=rot;keepInside(o);place(el,o);updateSelection()},()=>{lockFlip=false;updateSelection()});return}
  // --- redimensionar: el puntero se pasa al sistema local de la ficha (des-girado) para que funcione con cualquier ángulo
  const local=ev=>{const r=canvas.getBoundingClientRect(),[x,y]=rotateVec(ev.clientX-r.left-g0.cx,ev.clientY-r.top-g0.cy,-g0.rot);return{x,y}},p0=local(e),lim=sizeLimits(g0.W,g0.H);
  trackPointer(e,ev=>{const p=local(ev),res=computeResize(h,{w:g0.w,h:g0.h},{x:p.x-p0.x,y:p.y-p0.y},ev.shiftKey,lim);
   if(!moved){if(Math.abs(res.w-g0.w)+Math.abs(res.h-g0.h)<1)return;moved=true;pushHistory(before)}
   const[wx,wy]=rotateVec(res.dx,res.dy,g0.rot),c=fitCenter(g0.cx+wx,g0.cy+wy,res.w,res.h,g0.rot,g0.W,g0.H); // el lado opuesto al tirador queda fijo
   o.width=round(res.w/g0.W*100,3);o.height=round(res.h/g0.H*100,3);o.x=round(c.cx/g0.W*100,3);o.y=round(c.cy/g0.H*100,3);
   place(el,o);fitObject(el,o);updateSelection();syncSizeControls()})});

 function deleteSelected(){if(!selected)return;snap();state.objects=state.objects.filter(x=>x.id!==selected);selected=null;render()}

 /* ---------- DIBUJO ---------- */
 svg.addEventListener('click',e=>e.stopPropagation());
 svg.addEventListener('pointerdown',e=>{
  if(!pen.on||e.button>0||drawing)return;e.preventDefault();drawing=true;
  const{W,H}=size(),pos=ev=>{const r=canvas.getBoundingClientRect();return[clampNum(ev.clientX-r.left,0,W),clampNum(ev.clientY-r.top,0,H)]},p0=pos(e);
  if(pen.tool==='erase'){ // --- borrador: elimina los trazos que toque (un solo paso de deshacer por pasada)
   const before=JSON.stringify(state);let removed=false;
   const hit=ev=>{const p=pos(ev),keep=state.drawings.filter(d=>!hitDrawing(d,p,W,H,ERASER_TOL));
    drawLive.innerHTML=`<circle cx="${p[0]}" cy="${p[1]}" r="${ERASER_TOL}" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="1.5"/>`;
    if(keep.length!==state.drawings.length){if(!removed){pushHistory(before);removed=true}state.drawings=keep;renderDrawings();syncUi()}};
   hit(e);trackPointer(e,hit,()=>{drawLive.innerHTML='';drawing=false});return}
  // --- trazo libre / línea / flecha
  let pts=[p0];const tool=pen.tool,tmp={type:tool,color:pen.color,width:pen.width,pts:[]};
  const show=()=>{tmp.pts=pts.map(([x,y])=>[x/W,y/H]);drawLive.innerHTML=drawingMarkup(tmp,W,H)};show();
  trackPointer(e,ev=>{
   if(tool==='free'){const list=(ev.getCoalescedEvents&&ev.getCoalescedEvents())||[];for(const ce of list.length?list:[ev]){const p=pos(ce),l=pts[pts.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>=2.5)pts.push(p)}}
   else{const p=pos(ev);pts=[p0,ev.shiftKey?snapLine45(p0,p):p]}
   show()},
  ev=>{drawing=false;drawLive.innerHTML='';if(ev.type==='pointercancel')return;
   if(tool==='free'){const p=pos(ev),l=pts[pts.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>=1)pts.push(p)}
   else if(pts.length<2||Math.hypot(pts[1][0]-p0[0],pts[1][1]-p0[1])<4)return; // línea/flecha demasiado corta: se descarta
   snap();state.drawings.push({id:uid('D'),type:tool,color:pen.color,width:pen.width,pts:pts.map(([x,y])=>[round(x/W),round(y/H)])});renderDrawings();syncUi()})});
 let drawing=false;

 function setDrawMode(on){pen.on=on;if(on)setSelected(null);syncUi()}
 // Sincroniza el estado visual de botones (modo, herramienta, color, deshacer/rehacer)
 function syncUi(){const t=$('#drawToggle');if(!t)return;t.classList.toggle('btn-primary',pen.on);t.classList.toggle('btn-outline-primary',!pen.on);t.setAttribute('aria-pressed',pen.on);
  $('#drawOptions').hidden=!pen.on;canvas.dataset.mode=pen.on?'draw':'move';canvas.dataset.tool=pen.tool;
  document.querySelectorAll('[data-dtool]').forEach(b=>b.classList.toggle('active',b.dataset.dtool===pen.tool));
  document.querySelectorAll('[data-dcolor]').forEach(b=>{const on=b.dataset.dcolor===pen.color;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
  $('#dUndo').disabled=!history.length;$('#dRedo').disabled=!future.length;$('#clearDrawings').disabled=!state.drawings.length}
 $('#drawToggle').onclick=()=>setDrawMode(!pen.on);
 document.querySelectorAll('[data-dtool]').forEach(b=>b.onclick=()=>{pen.tool=b.dataset.dtool;syncUi()});
 document.querySelectorAll('[data-dcolor]').forEach(b=>b.onclick=()=>{pen.color=b.dataset.dcolor;if(pen.tool==='erase')pen.tool='free';syncUi()});
 $('#drawWidth').oninput=e=>{pen.width=+e.target.value;$('#drawWidthVal').textContent=pen.width};
 $('#dUndo').onclick=undo;$('#dRedo').onclick=redo;
 $('#clearDrawings').onclick=()=>{if(!state.drawings.length)return;snap();state.drawings=[];renderDrawings();syncUi()}; // solo dibujos: las fichas no se tocan

 /* ---------- Panel de herramientas (fichas) ---------- */
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{setDrawMode(false);snap();const type=b.dataset.add;const ds=defaultSize(type);state.objects.push({id:uid('O'),type,x:45+Math.random()*10,y:45+Math.random()*10,width:ds.width,height:ds.height,rotation:0,color:$('#objColor').value,text:['A','B','N','GK'].includes(type)?type:''});selected=state.objects.at(-1).id;render()});
 $('#surface').onchange=e=>{snap();state.surface=e.target.value;render()};
 $('#deleteObj').onclick=deleteSelected;
 $('#duplicate').onclick=()=>{const o=byId(selected);if(!o)return;snap();const n={...o,id:uid('O'),x:o.x+3,y:o.y+3};state.objects.push(n);keepInside(n);selected=n.id;render()};
 $('#front').onclick=()=>layer(1);$('#back').onclick=()=>layer(-1);
 function layer(dir){const i=state.objects.findIndex(x=>x.id===selected);if(i<0)return;snap();const[o]=state.objects.splice(i,1);state.objects.splice(dir>0?state.objects.length:0,0,o);render()}
 $('#objColor').oninput=e=>{const o=byId(selected);if(o){snap();o.color=e.target.value;render()}};
 // Ancho/alto numéricos (en % de la pizarra), respetando los mismos límites que los tiradores
 function setSizeFromInput(prop,val){const o=byId(selected);if(!o)return;const{W,H}=size(),lim=sizeLimits(W,H),[a,b]=prop==='width'?[lim.minW/W*100,lim.maxW/W*100]:[lim.minH/H*100,lim.maxH/H*100];snap();o[prop]=round(clampNum(Number(val)||a,a,b),3);keepInside(o);render()}
 $('#objWidth').onchange=e=>setSizeFromInput('width',e.target.value);$('#objHeight').onchange=e=>setSizeFromInput('height',e.target.value);
 $('#resetSize').onclick=()=>{const o=byId(selected);if(!o)return;snap();const d=defaultSize(o.type);o.width=d.width;o.height=d.height;keepInside(o);render()};
 $('#rotate90').onclick=()=>{const o=byId(selected);if(!o)return;snap();o.rotation=normAngle((o.rotation||0)+90);keepInside(o);render()};
 $('#rotateReset').onclick=()=>{const o=byId(selected);if(!o||!o.rotation)return;snap();o.rotation=0;keepInside(o);render()};
 $('#undo').onclick=undo;$('#redo').onclick=redo;
 $('#clearBoard').onclick=()=>{if(confirm('¿Limpiar toda la pizarra (fichas y dibujos)?')){snap();state.objects=[];state.drawings=[];selected=null;render()}};
 // Activa/desactiva los controles que dependen de tener un elemento seleccionado
 function syncSizeControls(){const o=byId(selected),w=$('#objWidth'),h=$('#objHeight');if(!w||!h)return;[w,h,$('#resetSize'),$('#rotate90'),$('#rotateReset')].forEach(x=>x.disabled=!o);if(!o)return;const d=dims(o);w.value=round(d.w,1);h.value=round(d.h,1)}
 
 /* ---------- Teclado (Ctrl+Z / Ctrl+Y / Supr / Esc). Se autodesactiva al salir de la pizarra ---------- */
 const onKey=ev=>{if(!canvas.isConnected){document.removeEventListener('keydown',onKey);return}
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)||ev.target.isContentEditable)return;
  const k=ev.key.toLowerCase(),mod=ev.ctrlKey||ev.metaKey;
  if(mod&&k==='z'){ev.preventDefault();ev.shiftKey?redo():undo()}
  else if(mod&&k==='y'){ev.preventDefault();redo()}
  else if((k==='delete'||k==='backspace')&&selected){ev.preventDefault();deleteSelected()}
  else if(k==='escape'){pen.on?setDrawMode(false):setSelected(null)}};
 document.addEventListener('keydown',onKey);
 // Al cambiar el tamaño de la pizarra (ventana, móvil girado, otro terreno) se reescalan símbolos, dibujos y selección
 if(typeof ResizeObserver!=='undefined'){const ro=new ResizeObserver(()=>{if(!canvas.isConnected){ro.disconnect();return}fitAll();renderDrawings();updateSelection()});ro.observe(canvas)}

 $('#saveExercise').onclick=async()=>{const f=$('#exerciseForm');if(!f.reportValidity())return;const data=Object.fromEntries(new FormData(f)),now=new Date().toISOString(),ex={...existing,...data,id:existing?.id||uid('EX'),duration:+data.duration||0,series:+data.series||0,repetitions:+data.repetitions||0,playerCount:+data.playerCount||0,boardState:JSON.stringify(state),preview:previewSvg(state),createdAt:existing?.createdAt||now,updatedAt:now,author:existing?.author||'Entrenador'};await repo.put('exercises',ex);notify('Ejercicio y pizarra guardados');saved();location.hash='#tacticBoard/'+ex.id};
 render();
}
function defaultSize(type){if(type==='goal')return{width:16,height:8};if(type==='mini')return{width:10,height:6};if(type==='rect')return{width:18,height:14};if(['line','dash','arrow','pass','run'].includes(type))return{width:14,height:7};if(type==='ladder')return{width:12,height:8};if(['pole','hurdle','dummy'].includes(type))return{width:7,height:12};if(type==='text')return{width:14,height:7};return{width:8,height:8}}

function field(n,l,x,big=false){return `<div class="${big?'col-12':'col-md-6'}"><label class="form-label">${l}</label>${big?`<textarea name="${n}" class="form-control" rows="2">${esc(x?.[n]||'')}</textarea>`:`<input name="${n}" class="form-control" value="${esc(x?.[n]||'')}">`}</div>`}
function objHtml(o,i,sel){const d=defaultSize(o.type),basic=['A','B','N','GK','ball','cone','pole','goal','mini','ring','ladder','hurdle','dummy'].includes(o.type);let body=basic?(icon[o.type]||o.type):o.type==='text'?(o.text||'Texto'):o.type==='rect'?'':o.type==='circle'?'':o.type==='dash'?'┄┄┄':o.type==='pass'?'⇢':o.type==='run'?'➜':'→';const rot=o.rotation||0;
 // El símbolo va en <span class="tg">: boardTools/fitObject lo escala al tamaño de la caja (efecto "imagen")
 return `<div class="tactic-object tactic-${o.type} ${sel?'selected':''}" data-id="${o.id}" style="left:${o.x}%;top:${o.y}%;width:${o.width??d.width}%;height:${o.height??d.height}%;--obj:${o.color};--rot:${rot}deg;transform:translate(-50%,-50%) rotate(${rot}deg);z-index:${i+2}">${body!==''?`<span class="tg">${esc(body)}</span>`:''}${o.text&&basic?`<small>${esc(o.text)}</small>`:''}</div>`}
function previewSvg(state){const dots=state.objects.slice(0,40).map(o=>`<circle cx="${o.x}" cy="${+(o.y*.64).toFixed(2)}" r="2.8" fill="${o.color||'#fff'}" stroke="white" stroke-width=".5"/>`).join('');const draws=(state.drawings||[]).map(d=>drawingMarkup(d,100,64,.4)).join('');return `<svg viewBox="0 0 100 64" role="img"><rect width="100" height="64" rx="3" fill="#267c4e"/><path d="M50 0v64M0 32h100" stroke="#fff" opacity=".7" stroke-width=".5"/><circle cx="50" cy="32" r="9" fill="none" stroke="#fff" opacity=".7" stroke-width=".5"/>${dots}${draws}</svg>`}
export async function trainingExercisesHtml(trainingId){const [rels,xs]=await Promise.all([repo.all('trainingExercises'),repo.all('exercises')]);const rows=rels.filter(r=>r.trainingId===trainingId).sort((a,b)=>a.order-b.order).map(r=>({...r,exercise:xs.find(x=>x.id===r.exerciseId)})).filter(x=>x.exercise);const total=rows.reduce((s,x)=>s+(+x.exercise.duration||0),0);return {rows,total,html:rows.map(x=>`<div class="training-exercise" draggable="true" data-rel="${x.id}"><div class="training-exercise-preview">${x.exercise.preview||''}</div><div class="flex-grow-1"><b>${x.order}. ${esc(x.exercise.name)}</b><div class="small text-secondary">${esc(x.exercise.objective||'')} · ${x.exercise.duration||0} min · ${x.exercise.playerCount||0} jugadores</div><div class="small">${esc(x.exercise.material||'')}</div></div><a href="#tacticBoard/${x.exercise.id}" class="btn btn-sm btn-outline-primary">Abrir</a><button class="btn btn-sm btn-outline-danger" data-remove-ex="${x.id}">×</button></div>`).join('')}}
export async function addExerciseDialog(trainingId,{openModal,notify,refresh}){const [xs,rels]=await Promise.all([repo.all('exercises'),repo.all('trainingExercises')]);openModal('Añadir ejercicio al entrenamiento',`<div class="list-group">${xs.map(x=>`<button class="list-group-item list-group-item-action d-flex justify-content-between" data-pick-ex="${x.id}"><span><b>${esc(x.name)}</b><small class="d-block text-secondary">${esc(x.category)} · ${x.duration||0} min</small></span><i class="fa-solid fa-plus"></i></button>`).join('')||'No hay ejercicios en la biblioteca.'}</div>`);document.querySelectorAll('[data-pick-ex]').forEach(b=>b.onclick=async()=>{const order=rels.filter(r=>r.trainingId===trainingId).length+1;await repo.put('trainingExercises',{id:uid('TE'),trainingId,exerciseId:b.dataset.pickEx,order});bootstrap.Modal.getInstance(document.querySelector('#appModal')).hide();notify('Ejercicio añadido');await refresh()})}
