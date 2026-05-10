
const SHEET_ID='142VCJ65sgkzmELIy6ImUFD8z2RXQRwVs-YvkWnPCF2s';
const SCRIPT_URL='https://script.google.com/macros/s/AKfycbyNevW7oTS-hKWXTkFknvQfVmai9pqlkUXmU9viGTPHDqs261F312cvY_JMEGwOrt_4/exec';
const CSV_URL=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;
let tasks=[],currentMonth=new Date(),activeFilter='';
let unlocked=sessionStorage.getItem('fzg_unlocked')==='1';
function toggleAdmin(){
  if(unlocked){unlocked=false;sessionStorage.removeItem('fzg_unlocked')}
  else{if(document.getElementById('adminPw').value!=='fzg'){alert('密碼錯誤');return}unlocked=true;sessionStorage.setItem('fzg_unlocked','1')}
  document.getElementById('adminPw').value='';
  applyLock();render();renderFilterBar();
}
function applyLock(){
  document.body.classList.toggle('locked',!unlocked);
  document.getElementById('adminBtn').textContent=unlocked?'鎖定':'管理';
  document.getElementById('adminPw').style.display=unlocked?'none':'';
  document.getElementById('notesArea').readOnly=!unlocked;
}
function getDeadlineBg(t){
  if(t['狀態']==='已完成')return 'border-left:6px solid var(--border)';
  const due=(t['截止日']||'').substring(0,10);if(!due)return 'border-left:6px solid var(--border)';
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(due+'T00:00:00');
  const diff=Math.round((d-today)/(1000*60*60*24));
  if(diff<0)return 'border-left:6px solid #dc143c';
  if(diff===0)return 'border-left:6px solid #ff8c00';
  if(diff===1)return 'border-left:6px solid #ffd700';
  return 'border-left:6px solid var(--border)';
}
function switchMainTab(tab){
  document.getElementById('mainTabInternal').classList.toggle('active',tab==='internal');
  document.getElementById('mainTabOutsource').classList.toggle('active',tab==='outsource');
  document.getElementById('internalSection').classList.toggle('hidden',tab!=='internal');
  document.getElementById('outsourceSection').classList.toggle('hidden',tab!=='outsource');
  if(tab==='outsource')renderOutsource();
  window.scrollTo(0,0);
}
function switchView(el){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const v=el.dataset.view;
  document.getElementById('boardView').classList.toggle('hidden',v!=='board');
  document.getElementById('timelineView').classList.toggle('hidden',v!=='timeline');
  document.getElementById('reportView').classList.toggle('hidden',v!=='report');
  render();
}
function openModal(idx){
  if(!unlocked)return;
  const m=document.getElementById('addModal');m.classList.remove('hidden');
  populateSelects();
  document.getElementById('deleteBtn').style.display=idx!==undefined?'block':'none';
  document.getElementById('modalTitle').textContent=idx!==undefined?'✏️ 編輯任務':'➕ 新增任務';
  if(idx!==undefined){
    const t=tasks[idx];
    document.getElementById('f-name').value=t['任務名稱']||'';
    document.getElementById('f-owner').value=t['負責人']||'';
    document.getElementById('f-status').value=t['狀態']||'待辦';
    document.getElementById('f-priority').value=t['優先級']||'';
    const sd=t['開始日']||'';document.getElementById('f-start').value=sd.length>=10?sd.substring(0,10):'';
    const ed=t['截止日']||'';document.getElementById('f-due').value=ed.length>=10?ed.substring(0,10):'';
    document.getElementById('f-tags').value=t['標籤']||'';
    document.getElementById('f-parent').value=t['父任務']||'';
    document.getElementById('f-note').value=t['備註']||'';
    document.getElementById('f-hours').value=t['工時']||0;
    document.getElementById('f-comment').value=t['評論']||'';
    m.dataset.editIdx=idx;
  }else{
    ['f-name','f-owner','f-tags','f-parent','f-note'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('f-status').value='待辦';document.getElementById('f-priority').value='';const _today=new Date(),_defDate=(_today.getFullYear()===currentMonth.getFullYear()&&_today.getMonth()===currentMonth.getMonth())?_today.toISOString().split('T')[0]:`${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}-01`;document.getElementById('f-start').value=_defDate;document.getElementById('f-due').value=_defDate;
    document.getElementById('f-hours').value=0;document.getElementById('f-comment').value='';
    delete m.dataset.editIdx;
  }
}
function closeModal(){document.getElementById('addModal').classList.add('hidden')}
function openModalWithParent(parentName){
  openModal();
  document.getElementById('f-parent').value=parentName;
}
function populateSelects(){
  const allTags=new Set();tasks.forEach(t=>(t['標籤']||'').split(',').filter(Boolean).forEach(tag=>allTags.add(tag.trim())));
  const tagSel=document.getElementById('f-tags-select');
  tagSel.innerHTML='<option value="">選擇...</option>'+[...allTags].map(t=>`<option value="${t}">${t}</option>`).join('')+'<option value="__new">+ 新增</option>';
  const parentSel=document.getElementById('f-parent-select');
  const getTaskLevel=(t)=>{if(!t['父任務'])return 0;const p=tasks.find(x=>x['任務名稱']===t['父任務']);if(!p||!p['父任務'])return 1;return 2};
  const parentNames=tasks.filter(t=>getTaskLevel(t)<2).map(t=>t['任務名稱']).filter(Boolean);
  parentSel.innerHTML='<option value="">選擇...</option>'+[...new Set(parentNames)].map(n=>`<option value="${n}">${n}</option>`).join('')+'<option value="__new">+ 新增</option>';
  const ownerSel=document.getElementById('f-owner-select');
  const owners=[...new Set(tasks.map(t=>t['負責人']).filter(Boolean))];
  ownerSel.innerHTML='<option value="">選擇...</option>'+owners.map(o=>`<option value="${o}">${o}</option>`).join('')+'<option value="__new">+ 新增</option>';
}
function onTagSelect(){
  const sel=document.getElementById('f-tags-select');
  const input=document.getElementById('f-tags');
  if(sel.value==='__new'){const v=prompt('輸入新標籤名稱：');if(v){input.value=input.value?(input.value+','+v):v}sel.value=''}
  else if(sel.value){const cur=input.value?input.value.split(',').map(s=>s.trim()):[];if(!cur.includes(sel.value))cur.push(sel.value);input.value=cur.join(',');sel.value=''}
}
function onParentSelect(){
  const sel=document.getElementById('f-parent-select');
  const input=document.getElementById('f-parent');
  if(sel.value==='__new'){const v=prompt('輸入父任務名稱：');if(v)input.value=v;sel.value=''}
  else if(sel.value){input.value=sel.value;sel.value=''}
}
function onOwnerSelect(){
  const sel=document.getElementById('f-owner-select');
  const input=document.getElementById('f-owner');
  if(sel.value==='__new'){const v=prompt('輸入新負責人名稱：');if(v)input.value=v;sel.value=''}
  else if(sel.value){input.value=sel.value;sel.value=''}
}
function changeMonth(dir){currentMonth.setMonth(currentMonth.getMonth()+dir);updateMonthLabel();render();loadNotes();renderOutsource()}
function toggleStatus(idx,e){
  e.stopPropagation();if(!unlocked)return;
  const t=tasks[idx];
  const next=t['狀態']==='待辦'?'進行中':t['狀態']==='進行中'?'已完成':'待辦';
  t['狀態']=next;
  fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:next,progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']}),mode:'no-cors'});
  render();
}
function inlineEdit(idx,field,e){
  e.stopPropagation();if(!unlocked)return;
  const t=tasks[idx];
  const m=document.createElement('div');
  m.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:200';
  let html='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;width:90%;max-width:360px">';
  if(field==='負責人'){
    const owners=[...new Set(tasks.map(x=>x['負責人']).filter(Boolean))];
    html+=`<label style="font-size:0.8em;color:var(--accent);margin-bottom:6px;display:block">修改負責人</label>`;
    html+=`<select id="ie-owner" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);margin-bottom:8px"><option value="">選擇...</option>${owners.map(o=>`<option value="${o}" ${o===t['負責人']?'selected':''}>${o}</option>`).join('')}<option value="__new">+ 新增</option></select>`;
    html+=`<input id="ie-owner-new" placeholder="或直接輸入" value="${t['負責人']||''}" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);box-sizing:border-box">`;
  }else if(field==='日期'){
    html+=`<label style="font-size:0.8em;color:var(--accent);margin-bottom:6px;display:block">修改日期</label>`;
    html+=`<div style="margin-bottom:6px"><span style="font-size:0.75em;color:var(--muted)">開始日</span><input id="ie-start" type="date" value="${t['開始日']?t['開始日'].substring(0,10):''}" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)" onclick="this.showPicker()"></div>`;
    html+=`<div><span style="font-size:0.75em;color:var(--muted)">截止日</span><input id="ie-due" type="date" value="${t['截止日']?t['截止日'].substring(0,10):''}" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)" onclick="this.showPicker()"></div>`;
  }else if(field==='標籤'){
    const allTags=[...new Set(tasks.flatMap(x=>(x['標籤']||'').split(',').filter(Boolean).map(s=>s.trim())))];
    html+=`<label style="font-size:0.8em;color:var(--accent);margin-bottom:6px;display:block">修改標籤</label>`;
    if(allTags.length)html+=`<div style="margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap">${allTags.map(tg=>`<span onclick="document.getElementById('ie-tags').value+=(document.getElementById('ie-tags').value?',':'')+this.textContent" style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-size:0.7em;cursor:pointer">${tg}</span>`).join('')}</div>`;
    html+=`<input id="ie-tags" value="${t['標籤']||''}" placeholder="逗號分隔" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);box-sizing:border-box">`;
  }
  html+=`<div style="display:flex;gap:6px;margin-top:12px"><button id="ie-ok" style="flex:1;padding:8px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">確認</button><button id="ie-cancel" style="flex:1;padding:8px;background:var(--border);color:var(--text);border:none;border-radius:6px;cursor:pointer">取消</button></div></div>`;
  m.innerHTML=html;
  document.body.appendChild(m);
  m.querySelector('#ie-cancel').onclick=()=>m.remove();
  m.onclick=(ev)=>{if(ev.target===m)m.remove()};
  m.querySelector('#ie-ok').onclick=()=>{
    if(field==='負責人'){const sel=m.querySelector('#ie-owner');const inp=m.querySelector('#ie-owner-new');t['負責人']=sel.value==='__new'||!sel.value?inp.value:sel.value}
    else if(field==='日期'){t['開始日']=m.querySelector('#ie-start').value;t['截止日']=m.querySelector('#ie-due').value}
    else if(field==='標籤'){t['標籤']=m.querySelector('#ie-tags').value}
    fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:t['狀態'],progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']}),mode:'no-cors'});
    m.remove();render();
  };
  if(m.querySelector('#ie-owner'))m.querySelector('#ie-owner').onchange=function(){if(this.value&&this.value!=='__new')m.querySelector('#ie-owner-new').value=this.value};
}
function quickDelete(idx,e){
  e.stopPropagation();if(!unlocked)return;
  const t=tasks[idx];
  if(!confirm('確定要刪除「'+t['任務名稱']+'」嗎？'))return;
  const parentOfDeleted=t['父任務']||'';
  const children=tasks.filter(c=>c['父任務']===t['任務名稱']);
  children.forEach(c=>{
    const ci=tasks.indexOf(c);
    const grandChildren=tasks.filter(g=>g['父任務']===c['任務名稱']);
    if(!parentOfDeleted){
      c['父任務']='';
      fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:'',hours:c['工時'],comment:c['評論']}),mode:'no-cors'});
    } else {
      c['父任務']=parentOfDeleted;
      fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:parentOfDeleted,hours:c['工時'],comment:c['評論']}),mode:'no-cors'});
    }
    grandChildren.forEach(g=>{
      const gi=tasks.indexOf(g);
      g['父任務']=parentOfDeleted||t['任務名稱']?'':'';
      if(!parentOfDeleted){g['父任務']=c['任務名稱']}
    });
  });
  fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'delete',row:idx}),mode:'no-cors'});
  tasks.splice(idx,1);render();
}
function updateMonthLabel(){document.getElementById('monthLabel').textContent=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1)}
function saveNotes(){
  const month='month_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);
  const text=document.getElementById('notesArea').value;
  fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'saveNote',month:month,text:text}),mode:'no-cors'});
  alert('✅ 已儲存');
}
function loadNotes(){
  const month='month_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);
  const notesUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=notes`;
  fetch(notesUrl).then(r=>r.text()).then(text=>{
    try{const json=JSON.parse(text.substring(47).slice(0,-2));const rows=json.table.rows||[];
    let noteText='';
    rows.forEach(r=>{if(r.c&&r.c[0]){const v=String(r.c[0].v||'');if(v===month)noteText=r.c[1]?(r.c[1].v||''):''}});
    document.getElementById('notesArea').value=noteText;var na=document.getElementById('notesArea');na.style.height='auto';na.style.height=na.scrollHeight+'px';}catch(e){document.getElementById('notesArea').value=''}
  }).catch(()=>{document.getElementById('notesArea').value=''});
}
function filterByMonth(list){
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth()+1,prefix=y+'-'+(m<10?'0'+m:m);
  return list.filter(t=>{
    const sd=t['開始日']||'';const ed=t['截止日']||'';
    if(!sd&&!ed)return true;
    if(sd&&sd.startsWith(prefix))return true;
    if(ed&&ed.startsWith(prefix))return true;
    if(sd&&ed)return sd.substring(0,7)<=prefix&&ed.substring(0,7)>=prefix;
    return false;
  });
}
function getFiltered(){
  let list=filterByMonth(tasks);
  const q=document.getElementById('search').value.toLowerCase();
  if(q)list=list.filter(t=>Object.values(t).join(' ').toLowerCase().includes(q));
  if(activeFilter)list=list.filter(t=>(t['標籤']||'').includes(activeFilter));
  return list;
}
async function submitTask(){
  const m=document.getElementById('addModal');
  const data={name:document.getElementById('f-name').value,owner:document.getElementById('f-owner').value,status:document.getElementById('f-status').value,progress:'',startDate:document.getElementById('f-start').value,dueDate:document.getElementById('f-due').value,note:document.getElementById('f-note').value,priority:document.getElementById('f-priority').value,tags:document.getElementById('f-tags').value,parent:document.getElementById('f-parent').value,hours:document.getElementById('f-hours').value,comment:document.getElementById('f-comment').value};
  if(!data.name){let n=1;while(tasks.some(t=>t['任務名稱']==='未命名'+n))n++;data.name='未命名'+n}
  const dupIdx=tasks.findIndex(t=>t['任務名稱']===data.name);
  if(dupIdx!==-1&&(m.dataset.editIdx===undefined||dupIdx!==parseInt(m.dataset.editIdx))){alert('任務名稱已存在，請使用不同名稱');return}
  if(m.dataset.editIdx!==undefined){data.action='update';data.row=m.dataset.editIdx}
  try{
    fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify(data),mode:'no-cors'});
    if(data.action==='update'){
      const t=tasks[parseInt(m.dataset.editIdx)];
      t['任務名稱']=data.name;t['負責人']=data.owner;t['狀態']=data.status;t['開始日']=data.startDate;t['截止日']=data.dueDate;t['備註']=data.note;t['優先級']=data.priority;t['標籤']=data.tags;t['父任務']=data.parent;t['工時']=data.hours;t['評論']=data.comment;
    }else{
      const maxSort=Math.max(0,...tasks.map(t=>parseInt(t['排序'])||0));
      tasks.push({'任務名稱':data.name,'負責人':data.owner||'','狀態':data.status||'待辦','進度':'','開始日':data.startDate||'','截止日':data.dueDate||'','備註':data.note||'','優先級':data.priority||'','標籤':data.tags||'','父任務':data.parent||'','工時':data.hours||'','評論':data.comment||'','排序':String(maxSort+1)});
    }
    closeModal();render();renderFilterBar();
  }catch(e){alert('❌ 失敗：'+e.message)}
}
async function deleteTask(){
  const m=document.getElementById('addModal');
  if(!confirm('確定刪除？'))return;
  try{await fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'delete',row:m.dataset.editIdx}),mode:'no-cors'});alert('✅ 已刪除');closeModal();setTimeout(()=>location.reload(),2000)}catch(e){alert('❌ 失敗')}
}
async function fetchData(){
  try{
    const res=await fetch(CSV_URL);const text=await res.text();
    const json=JSON.parse(text.substring(47).slice(0,-2));
    const cols=json.table.cols.map(c=>c.label.trim());
    tasks=json.table.rows.map(r=>{const obj={};cols.forEach((c,i)=>{if(r.c&&r.c[i])obj[c]=r.c[i].f||String(r.c[i].v||'');else obj[c]=''});return obj}).filter(t=>t['任務名稱']);
    render();renderFilterBar();
  }catch(e){document.getElementById('boardView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">載入失敗<br><button onclick="fetchData()" style="margin-top:10px;padding:6px 12px;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer">重試</button></div>'}
}
function renderFilterBar(){
  const allTags=new Set();tasks.forEach(t=>(t['標籤']||'').split(',').filter(Boolean).forEach(tag=>allTags.add(tag.trim())));
  if(!allTags.size){document.getElementById('filterBar').innerHTML='';return}
  let html=`<span class="filter-tag ${!activeFilter?'active':''}" onclick="activeFilter='';render();renderFilterBar()">全部</span>`;
  allTags.forEach(tag=>{html+=`<span class="filter-tag ${activeFilter===tag?'active':''}" onclick="activeFilter='${tag}';render();renderFilterBar()">${tag}</span>`});
  document.getElementById('filterBar').innerHTML=html;
}
function toggleSub(el,e){e.stopPropagation();var d=el.lastElementChild,s=el.firstElementChild;if(d.style.display==='none'){d.style.display='block';s.textContent='▼'}else{d.style.display='none';s.textContent='▶'}}
function toggleCollapse(idx,el){var b=el.closest('.card').querySelector('.card-body');var collapsed=b.style.display!=='none';b.style.display=collapsed?'none':'block';el.querySelector('span').textContent=collapsed?'▶':'▼';if(unlocked){tasks[idx]['收合']=collapsed?'1':'';fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'updateCollapse',row:idx,collapsed:collapsed?'1':''}),mode:'no-cors'})}}
function render(){renderStats();const bv=document.getElementById('boardView'),tv=document.getElementById('timelineView'),rv=document.getElementById('reportView');if(!bv.classList.contains('hidden'))renderBoard();if(!tv.classList.contains('hidden'))renderTimeline();if(!rv.classList.contains('hidden'))renderReport();renderFilterBar()}
function renderStats(){
  const f=getFiltered(),total=f.length,done=f.filter(t=>t['狀態']==='已完成').length;
  document.getElementById('stats').innerHTML=`<div class="stat"><div class="num">${total}</div><div class="label">任務</div></div><div class="stat"><div class="num" style="color:var(--green)">${done}</div><div class="label">完成</div></div><div class="stat"><div class="num" style="color:var(--yellow)">${total-done}</div><div class="label">未完成</div></div>`;
}
function renderBoard(){
  const filtered=getFiltered();
  if(!filtered.length){document.getElementById('boardView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">本月無任務</div>';return}
  const parentTasks=filtered.filter(t=>!t['父任務']||!filtered.find(p=>p['任務名稱']===t['父任務']));
  const getChildren=name=>filtered.filter(t=>t['父任務']===name);
  const sortFn=(a,b)=>(parseInt(a['排序'])||999)-(parseInt(b['排序'])||999);
  const todo=parentTasks.filter(t=>t['狀態']==='待辦').sort(sortFn);
  const doing=parentTasks.filter(t=>t['狀態']==='進行中').sort(sortFn);
  const done=parentTasks.filter(t=>t['狀態']==='已完成').sort(sortFn);
  const getLevel=(t)=>{if(!t['父任務'])return 0;const p=tasks.find(x=>x['任務名稱']===t['父任務']);if(!p)return 0;if(!p['父任務'])return 1;const gp=tasks.find(x=>x['任務名稱']===p['父任務']);if(!gp)return 1;return 2};
  const cardHtml=(items)=>items.map(t=>{
    const idx=tasks.indexOf(t);
    const pClass=t['優先級']==='高'?'p-high':t['優先級']==='中'?'p-mid':t['優先級']==='低'?'p-low':'';
    const children=getChildren(t['任務名稱']);
    const childDone=children.filter(c=>c['狀態']==='已完成').length;
    const tags=(t['標籤']||'').split(',').filter(Boolean);
    const level=getLevel(t);
    const canAddSub=level<2;
    const _dbg=getDeadlineBg(t);
    return `<div class="card" draggable="true" data-idx="${idx}" ondragstart="drag(event,${idx});this.classList.add('dragging')" ondragend="this.classList.remove('dragging');document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'))" ondragover="cardDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="cardDrop(event,${idx},this)" style="${_dbg}">
      <div class="card-buttons"><div class="name" onclick="event.stopPropagation();toggleCollapse(${idx},this)" style="cursor:pointer;flex:1"><span style="font-size:0.7em;margin-right:4px">${t['收合']==='1'?'▶':'▼'}</span>${pClass?'<span class="priority-dot '+pClass+'"></span>':''}${t['任務名稱']}</div><span class="edit-ctrl card-btn" onclick="event.stopPropagation();openModal(${idx})" style="background:#4caf50">編輯</span>${canAddSub?`<span class="edit-ctrl card-btn" onclick="event.stopPropagation();openModalWithParent('${t['任務名稱'].replace(/'/g,"\\'")}')" style="background:var(--accent)">+子任務</span>`:''}<span class="edit-ctrl card-btn" onclick="quickDelete(${idx},event)" style="background:var(--red)">✕</span></div>
      <div class="card-body"${t['收合']==='1'?' style="display:none"':''}>
      <div class="meta" style="flex-wrap:nowrap;gap:6px"><span onclick="inlineEdit(${idx},'負責人',event)" style="color:var(--green);cursor:pointer;white-space:nowrap">${t['負責人']||'未指派'}</span>${tags.length?'<span onclick="inlineEdit('+idx+',\'標籤\',event)" style="cursor:pointer;display:inline-flex;gap:3px;flex:1;overflow:hidden">'+tags.map(tg=>'<span class="tag-pill">'+tg.trim()+'</span>').join('')+'</span>':'<span style="flex:1"></span>'}<span onclick="inlineEdit(${idx},'日期',event)" style="cursor:pointer;white-space:nowrap">${t['開始日']?t['開始日'].substring(0,10):''}${t['開始日']||t['截止日']?' ~ ':''}${t['截止日']?t['截止日'].substring(0,10):''}</span></div>
      ${t['評論']?'<div style="font-size:0.75rem;color:var(--muted);margin-top:3px;font-style:italic">💬 '+t['評論'].substring(0,50)+(t['評論'].length>50?'...':'')+'</div>':''}
      ${children.length?'<div class="subtasks" onclick="toggleSub(this,event)" style="cursor:pointer"><span style="font-size:0.75rem">▼</span> 子任務：'+childDone+'/'+children.length+'<div style="margin-top:4px">'+children.map(c=>{
        const ci=tasks.indexOf(c);const cpClass=c['優先級']==='高'?'p-high':c['優先級']==='中'?'p-mid':c['優先級']==='低'?'p-low':'';
        const grandChildren=getChildren(c['任務名稱']);const gcDone=grandChildren.filter(g=>g['狀態']==='已完成').length;
        const cLevel=getLevel(c);const cCanAddSub=cLevel<2;const _cdbg=getDeadlineBg(c);
        return `<div style="border:1px solid var(--border);border-radius:6px;margin-bottom:4px;${_cdbg||'background:var(--surface)'};padding:6px 8px;transition:border-color .2s" onmouseover="this.style.outline='2px solid var(--accent)';this.style.outlineOffset='-2px'" onmouseout="this.style.outline='none'">
          <div onclick="event.stopPropagation();openModal(${ci})" style="display:flex;align-items:center;gap:4px;font-size:0.875rem;cursor:pointer">
            <span onclick="toggleStatus(${ci},event)" style="cursor:pointer;color:${c['狀態']==='已完成'?'var(--green)':c['狀態']==='進行中'?'var(--yellow)':'var(--muted)'}">${c['狀態']==='已完成'?'✅':c['狀態']==='進行中'?'🔄':'⬜'}</span>
            ${cpClass?'<span class="priority-dot '+cpClass+'"></span>':''}
            <span onclick="event.stopPropagation();openModal(${ci})" style="flex:1;cursor:pointer">${c['任務名稱']}</span>
            <span onclick="inlineEdit(${ci},'負責人',event)" style="color:var(--green);font-size:0.875rem;cursor:pointer;margin-right:4px">${c['負責人']||'未指派'}</span>
            <span onclick="inlineEdit(${ci},'日期',event)" style="color:var(--muted);font-size:0.9em;cursor:pointer">${c['開始日']?c['開始日'].substring(5,10):''}${c['開始日']||c['截止日']?'~':''}${c['截止日']?c['截止日'].substring(5,10):''}</span>
            ${cCanAddSub?`<span class="edit-ctrl" onclick="event.stopPropagation();openModalWithParent('${c['任務名稱'].replace(/'/g,"\\'")}')" style="font-size:0.85em;background:var(--accent);color:#fff;border-radius:3px;padding:1px 4px;cursor:pointer;margin-left:4px">+</span>`:''}
            <span class="edit-ctrl" onclick="quickDelete(${ci},event)" style="cursor:pointer;font-size:0.75rem;background:var(--red);color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px">✕</span>
          </div>
          ${grandChildren.length?'<div style="margin-top:4px;padding-left:12px">'+grandChildren.map(g=>{
            const gi=tasks.indexOf(g);const gpClass=g['優先級']==='高'?'p-high':g['優先級']==='中'?'p-mid':g['優先級']==='低'?'p-low':'';const _gdbg=getDeadlineBg(g);
            return `<div onclick="event.stopPropagation();openModal(${gi})" style="display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:0.875rem;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-bottom:3px;${_gdbg||'background:var(--bg)'};transition:border-color .2s" onmouseover="this.style.outline='2px solid var(--accent)';this.style.outlineOffset='-2px'" onmouseout="this.style.outline='none'">
              <span onclick="toggleStatus(${gi},event)" style="cursor:pointer;color:${g['狀態']==='已完成'?'var(--green)':g['狀態']==='進行中'?'var(--yellow)':'var(--muted)'}">${g['狀態']==='已完成'?'✅':g['狀態']==='進行中'?'🔄':'⬜'}</span>
              ${gpClass?'<span class="priority-dot '+gpClass+'"></span>':''}
              <span style="flex:1">${g['任務名稱']}</span>
              <span onclick="inlineEdit(${gi},'負責人',event)" style="color:var(--green);font-size:0.875rem;cursor:pointer;margin-right:4px">${g['負責人']||'未指派'}</span>
              <span onclick="inlineEdit(${gi},'日期',event)" style="color:var(--muted);cursor:pointer">${g['開始日']?g['開始日'].substring(5,10):''}${g['開始日']||g['截止日']?'~':''}${g['截止日']?g['截止日'].substring(5,10):''}</span>
              
              <span class="edit-ctrl" onclick="quickDelete(${gi},event)" style="cursor:pointer;font-size:0.75rem;background:var(--red);color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px">✕</span>
            </div>`}).join('')+'</div>':''}
        </div>`}).join('')+'</div></div>':''}
    </div></div>`}).join('');
  const groupByOwner=(items)=>{
    const groups={};
    items.forEach(t=>{const o=t['負責人']||'未指派';if(!groups[o])groups[o]=[];groups[o].push(t)});
    const ownerSort=JSON.parse(localStorage.getItem('fzg_owner_sort')||'{}');
    return Object.entries(groups).sort((a,b)=>(parseInt(ownerSort[a[0]])||999)-(parseInt(ownerSort[b[0]])||999)).map(([owner,list])=>`<div class="owner-group" draggable="true" data-owner="${owner}" ondragstart="event.dataTransfer.setData('text/owner','${owner.replace(/'/g,"\\'")}');this.classList.add('dragging')" ondragend="this.classList.remove('dragging');document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'))" ondragover="cardDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="ownerGroupDrop(event,this)" style="margin-bottom:8px"><div class="owner-title" onclick="var d=this.closest('.owner-group').lastElementChild;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="color:var(--accent);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:pointer"><span class="tog">▼</span> 👤 ${owner} (${list.length})</div><div>${cardHtml(list)}</div></div>`).join('');
  };
  document.getElementById('boardView').innerHTML=`
    <div class="column" ondragover="event.preventDefault()" ondrop="drop(event,'待辦')"><h3 onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="color:var(--muted);cursor:pointer"><span class="tog">▼</span> 📝 待辦 (${todo.length})</h3><div>${todo.length?groupByOwner(todo):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div>
    <div class="column" ondragover="event.preventDefault()" ondrop="drop(event,'進行中')"><h3 onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="color:var(--yellow);cursor:pointer"><span class="tog">▼</span> 🔄 進行中 (${doing.length})</h3><div>${doing.length?groupByOwner(doing):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div>
    <div class="column" ondragover="event.preventDefault()" ondrop="drop(event,'已完成')"><h3 onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="color:var(--green);cursor:pointer"><span class="tog">▼</span> ✅ 已完成 (${done.length})</h3><div>${done.length?groupByOwner(done):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div>`;
}
let dragIdx=null;
function ownerGroupDrop(e,el){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));
  const srcOwner=e.dataTransfer.getData('text/owner');if(!srcOwner)return;
  const tgtOwner=el.dataset.owner;if(srcOwner===tgtOwner)return;
  const ownerSort=JSON.parse(localStorage.getItem('fzg_owner_sort')||'{}');
  const column=el.closest('.column');
  const groups=[...column.querySelectorAll('.owner-group')].map(g=>g.dataset.owner);
  const fromPos=groups.indexOf(srcOwner);if(fromPos>=0)groups.splice(fromPos,1);
  const toPos=groups.indexOf(tgtOwner);
  const rect=el.getBoundingClientRect();const above=e.clientY<rect.top+rect.height/2;
  groups.splice(above?toPos:toPos+1,0,srcOwner);
  groups.forEach((o,i)=>{ownerSort[o]=String(i+1)});
  localStorage.setItem('fzg_owner_sort',JSON.stringify(ownerSort));
  render();
}
function cardDragOver(e,el){e.preventDefault();if(el.classList.contains('dragging'))return;document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'));const rect=el.getBoundingClientRect();el.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom')}
function cardDrop(e,targetIdx,el){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'));
  if(!unlocked||dragIdx===null||dragIdx===targetIdx)return;
  const src=tasks[dragIdx],tgt=tasks[targetIdx];
  if(src['狀態']!==tgt['狀態']){drop(e,tgt['狀態']);return}
  const rect=el.getBoundingClientRect();const above=e.clientY<rect.top+rect.height/2;
  const sameStatus=tasks.filter(x=>x['狀態']===src['狀態']&&!x['父任務']).sort((a,b)=>(parseInt(a['排序'])||999)-(parseInt(b['排序'])||999));
  const fromPos=sameStatus.indexOf(src);if(fromPos>=0)sameStatus.splice(fromPos,1);
  const toPos=sameStatus.indexOf(tgt);
  sameStatus.splice(above?toPos:toPos+1,0,src);
  sameStatus.forEach((item,i)=>{item['排序']=String(i+1);const idx=tasks.indexOf(item);fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'updateSort',row:idx,sort:i+1}),mode:'no-cors'})});
  render();dragIdx=null;
}
function drag(e,idx){if(!unlocked){e.preventDefault();return}dragIdx=idx;e.dataTransfer.effectAllowed='move'}
function drop(e,status){if(!unlocked)return;
  e.preventDefault();if(dragIdx===null)return;
  const t=tasks[dragIdx];
  if(t['狀態']===status){
    // Same status: reorder within column
    const sameStatus=tasks.filter(x=>x['狀態']===status&&!x['父任務']).sort((a,b)=>(parseInt(a['排序'])||999)-(parseInt(b['排序'])||999));
    const fromPos=sameStatus.indexOf(t);
    if(fromPos>=0){sameStatus.splice(fromPos,1);sameStatus.push(t)}// move to end (simple reorder)
    sameStatus.forEach((item,i)=>{item['排序']=String(i+1);const idx=tasks.indexOf(item);fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'updateSort',row:idx,sort:i+1}),mode:'no-cors'})});
    render();dragIdx=null;return;
  }
  const data={action:'update',row:dragIdx,name:t['任務名稱'],owner:t['負責人'],status:status,progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']};
  fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify(data),mode:'no-cors'});
  t['狀態']=status;
  if(status==='已完成'){
    const children=tasks.filter(c=>c['父任務']===t['任務名稱']);
    children.forEach(c=>{const ci=tasks.indexOf(c);c['狀態']='已完成';fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:'已完成',progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:c['父任務'],hours:c['工時'],comment:c['評論']}),mode:'no-cors'});
      const grandChildren=tasks.filter(g=>g['父任務']===c['任務名稱']);
      grandChildren.forEach(g=>{const gi=tasks.indexOf(g);g['狀態']='已完成';fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:gi,name:g['任務名稱'],owner:g['負責人'],status:'已完成',progress:'',startDate:g['開始日'],dueDate:g['截止日'],note:g['備註'],priority:g['優先級'],tags:g['標籤'],parent:g['父任務'],hours:g['工時'],comment:g['評論']}),mode:'no-cors'})});
    });
  }
  render();dragIdx=null;
}
function renderTimeline(){
  const filtered=getFiltered();
  if(!filtered.length){document.getElementById('timelineView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">本月無任務</div>';return}
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
  const days=new Date(y,m+1,0).getDate();
  const weekdays=['日','一','二','三','四','五','六'];
  let h='<div style="position:relative"><div style="display:flex;border-bottom:1px solid var(--border);padding:4px 0;margin-bottom:6px"><div style="width:150px;flex-shrink:0"></div><div style="flex:1;display:flex;position:relative">';
  const today=new Date();const isThisMonth=today.getFullYear()===y&&today.getMonth()===m;
  for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();const wd=weekdays[dow];const isToday=isThisMonth&&d===today.getDate();const isWeekend=dow===0||dow===6;h+=`<div style="flex:1;text-align:center;font-size:0.75rem;color:${isToday?'var(--red)':'var(--muted)'};font-weight:${isToday?'bold':'normal'};${isWeekend?'background:rgba(56,139,253,0.12);border-radius:2px':''}">${d}<br>${wd}</div>`}
  h+='</div></div>';

  const groups={};filtered.forEach(t=>{const o=t['負責人']||'未指派';if(!groups[o])groups[o]=[];groups[o].push(t)});
  Object.entries(groups).forEach(([owner,items])=>{
    h+=`<div style="border-bottom:1px solid var(--border);padding:4px 0"><span onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;font-size:1rem;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="tog">▼</span>&nbsp;👤 ${owner} (${items.length})</span><div>`;
    const parents=items.filter(t=>!t['父任務']);
    const renderGanttRow=(t,level)=>{
      const startStr=(t['開始日']||'').substring(0,10);const endStr=(t['截止日']||'').substring(0,10);
      let sd=1,ed=days;
      if(startStr){const p=startStr.split('-');if(parseInt(p[0])===y&&parseInt(p[1])-1===m)sd=parseInt(p[2]);else if(parseInt(p[0])>y||(parseInt(p[0])===y&&parseInt(p[1])-1>m))sd=days+1;else sd=1}
      if(endStr){const p=endStr.split('-');if(parseInt(p[0])===y&&parseInt(p[1])-1===m)ed=parseInt(p[2]);else if(parseInt(p[0])<y||(parseInt(p[0])===y&&parseInt(p[1])-1<m))ed=0;else ed=days}else{ed=sd}
      if(sd>days||ed<1)return;sd=Math.max(1,sd);ed=Math.min(days,ed);
      const color=t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
      const l=((sd-1)/days*100).toFixed(1),w=((ed-sd+1)/days*100).toFixed(1);
      const pClass=t['優先級']==='高'?'p-high':t['優先級']==='中'?'p-mid':'';
      const pl=level===0?12:level===1?24:36;const _ti=tasks.indexOf(t);
      h+=`<div onclick="ganttRowClick(this,'${t['任務名稱'].replace(/'/g,"\\'")}')" style="display:flex;align-items:center;padding:4px 0;cursor:pointer"><div style="width:150px;flex-shrink:0;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:${pl}px;${level?'color:var(--yellow)':''}">${level?'└ ':''}${pClass?'<span class="priority-dot '+pClass+'"></span>':''}${t['任務名稱']}</div><div class="gantt-track" style="flex:1;position:relative;height:${level?'12':'16'}px;background:var(--bg);border-radius:3px"><div class="gantt-bar" data-idx="${_ti}" style="position:absolute;left:${l}%;width:${w}%;height:100%;background:${color};border-radius:3px;opacity:0.8;cursor:default"><div class="gantt-handle gantt-handle-l" data-idx="${_ti}" data-side="l" style="position:absolute;left:0;top:0;width:6px;height:100%;cursor:ew-resize;border-radius:3px 0 0 3px"></div><div class="gantt-handle gantt-handle-r" data-idx="${_ti}" data-side="r" style="position:absolute;right:0;top:0;width:6px;height:100%;cursor:ew-resize;border-radius:0 3px 3px 0"></div></div></div></div>`;
    };
    parents.forEach(t=>{
      renderGanttRow(t,0);
      const children=items.filter(c=>c['父任務']===t['任務名稱']);
      children.forEach(c=>{renderGanttRow(c,1);const gc=items.filter(g=>g['父任務']===c['任務名稱']);gc.forEach(g=>renderGanttRow(g,2))});
    });
    items.filter(t=>t['父任務']&&!parents.find(p=>p['任務名稱']===t['父任務'])&&!items.find(s=>s['任務名稱']===t['父任務'])).forEach(t=>renderGanttRow(t,0));
    h+=`</div></div>`;
  });
  for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();if(dow===0||dow===6){const pos=((d-1)/days*100).toFixed(1);h+=`<div style="position:absolute;top:40px;bottom:0;left:calc(150px + (100% - 150px) * ${pos} / 100);width:calc((100% - 150px) / ${days});background:rgba(56,139,253,0.1);pointer-events:none"></div>`}}
  if(isThisMonth){const todayPos=((today.getDate()-0.5)/days*100).toFixed(1);h+=`<div style="position:absolute;top:40px;bottom:0;left:calc(150px + (100% - 150px) * ${todayPos} / 100);width:2px;background:var(--red);z-index:10;pointer-events:none;opacity:0.7"></div>`}
  h+='</div>';
  document.getElementById('timelineView').innerHTML=h;
  // Gantt drag setup - event delegation
  const tv=document.getElementById('timelineView');
  if(!tv._ganttDelegated){tv._ganttDelegated=true;tv.addEventListener('mousedown',e=>{
    const handle=e.target.closest('.gantt-handle');
    const bar=e.target.closest('.gantt-bar');
    if(handle){
      e.stopPropagation();e.preventDefault();
      const idx=parseInt(handle.dataset.idx),side=handle.dataset.side;
      const track=handle.closest('.gantt-track');
      const trackRect=track.getBoundingClientRect();const trackW=trackRect.width;
      const onMove=ev=>{const x=Math.max(0,Math.min(trackW,ev.clientX-trackRect.left));const day=Math.max(1,Math.min(days,Math.round(x/trackW*days)+1));const t=tasks[idx];const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(side==='l'){if(dateStr<=((t['截止日']||'').substring(0,10)||dateStr))t['開始日']=dateStr}else{if(dateStr>=((t['開始日']||'').substring(0,10)||dateStr))t['截止日']=dateStr}render()};
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);const t=tasks[idx];fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:t['狀態'],progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']}),mode:'no-cors'})};
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    }
  })}
}
function renderReport(){
  const filtered=getFiltered(),total=filtered.length,done=filtered.filter(t=>t['狀態']==='已完成').length;
  const today=new Date().toISOString().split('T')[0];
  const overdue=filtered.filter(t=>t['狀態']!=='已完成'&&t['截止日']&&t['截止日']<today);
  let html=`<div class="report-section"><h3>📊 整體進度</h3><p>完成率：${total?Math.round(done/total*100):0}%（${done}/${total}）</p></div>`;
  const ownerMap={};filtered.forEach(t=>{const o=t['負責人']||'未指派';if(!ownerMap[o])ownerMap[o]={total:0,done:0,doing:0,todo:0};ownerMap[o].total++;if(t['狀態']==='已完成')ownerMap[o].done++;else if(t['狀態']==='進行中')ownerMap[o].doing++;else ownerMap[o].todo++});
  if(Object.keys(ownerMap).length){html+=`<div class="report-section"><h3>👤 各負責人工作數量</h3>`;Object.entries(ownerMap).forEach(([n,d])=>{html+=`<p style="margin-bottom:4px">• <strong>${n}</strong>：共${d.total}項（待辦${d.todo}/進行中${d.doing}/完成${d.done}）</p>`});html+=`</div>`}
  const hourMap={};filtered.forEach(t=>{const o=t['負責人']||'未指派';let days=0;if(t['開始日']&&t['截止日']){const s=new Date(t['開始日'].substring(0,10)),e=new Date(t['截止日'].substring(0,10));days=Math.max(1,Math.round((e-s)/(1000*60*60*24))+1)}else if(t['開始日']||t['截止日']){days=1}if(!hourMap[o])hourMap[o]=0;hourMap[o]+=days});
  const totalDays=Object.values(hourMap).reduce((s,v)=>s+v,0);
  if(totalDays>0){html+=`<div class="report-section"><h3>📅 工作天數統計（本月共 ${totalDays} 天）</h3>`;Object.entries(hourMap).filter(([,h])=>h>0).sort((a,b)=>b[1]-a[1]).forEach(([n,h])=>{html+=`<p style="margin-bottom:4px">• <strong>${n}</strong>：${h} 天</p>`});html+=`</div>`}
  if(overdue.length)html+=`<div class="report-section"><h3>⚠️ 逾期任務</h3>${overdue.map(t=>`<p class="overdue">• ${t['任務名稱']}（截止：${t['截止日']}）</p>`).join('')}</div>`;
  document.getElementById('reportView').innerHTML=html;
}
const OUTSOURCE_SHEET_ID='11cuSAO3MZfUmau1pd603685i18d0SlQKN-h--jUrp2s';
const OUTSOURCE_SCRIPT_URL='https://script.google.com/macros/s/AKfycbyuqw9ZXRCGLeOtKyYbv0p7xrdIXHYSUydXNuR2j2tiUYrUwK3JFjK765J4Kh0Pk2_I/exec';
let outsourceTasks=[],outsourceMode='list',outsourceZones={},outsourceFetchError=false;
async function loadOutsourceZones(){
  try{
    const url=`https://docs.google.com/spreadsheets/d/${OUTSOURCE_SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=zones`;
    const res=await fetch(url);const text=await res.text();
    const json=JSON.parse(text.substring(47).slice(0,-2));
    const rows=json.table.rows||[];
    outsourceZones={};
    rows.forEach(r=>{if(r.c&&r.c[0]&&r.c[1])outsourceZones[String(r.c[0].v||'')]=String(r.c[1].v||'一區')});
    localStorage.setItem('fzg_outsource_zones',JSON.stringify(outsourceZones));
  }catch(e){outsourceZones=JSON.parse(localStorage.getItem('fzg_outsource_zones')||'{}')}
}
async function fetchOutsource(){
  const m=currentMonth.getMonth()+1;const sheetName=currentMonth.getFullYear()+'/'+('0'+m).slice(-2);
  const url=`https://docs.google.com/spreadsheets/d/${OUTSOURCE_SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
  outsourceTasks=[];
  try{
    const res=await fetch(url);const text=await res.text();
    const json=JSON.parse(text.substring(47).slice(0,-2));
    if(!json.table.rows||!json.table.rows.length){outsourceTasks=[];return}
    const cols=json.table.cols.map(c=>c.label.trim());
    const items=json.table.rows.map(r=>{const obj={};cols.forEach((c,i)=>{if(r.c&&r.c[i])obj[c]=r.c[i].f||String(r.c[i].v||'');else obj[c]=''});return obj}).filter(t=>t['工作項目']);
    // Consolidate: merge same owner + similar task name with consecutive dates
    const merged=[];
    const toDate=s=>{const p=(s||'').replace(/\//g,'-').split('-');return p.length===3?new Date(+p[0],+p[1]-1,+p[2]):null};
    const fmtDate=d=>d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();
    const diffDays=(a,b)=>Math.round((b-a)/(86400000));
    const normalize=s=>(s||'').replace(/[\d\s+]/g,'').trim();
    const isSimilar=(a,b)=>{if(a===b)return true;const na=normalize(a),nb=normalize(b);return na.includes(nb)||nb.includes(na)};
    items.forEach(t=>{
      const existing=merged.find(m=>m['負責人']===t['負責人']&&isSimilar(m['工作項目'],t['工作項目']));
      if(existing){
        const eEnd=toDate(existing['截止日']),tStart=toDate(t['開始日']),tEnd=toDate(t['截止日']);
        if(eEnd&&tStart&&diffDays(eEnd,tStart)<=1){
          if(tEnd&&tEnd>eEnd)existing['截止日']=fmtDate(tEnd);
          const eStart=toDate(existing['開始日']);if(tStart&&eStart&&tStart<eStart)existing['開始日']=fmtDate(tStart);
          existing['狀態']=t['狀態']||existing['狀態'];
          if(t['工作項目'].length<existing['工作項目'].length)existing['工作項目']=t['工作項目'];
        }else{merged.push({...t})}
      }else{merged.push({...t})}
    });
    const cy=currentMonth.getFullYear(),cm=currentMonth.getMonth()+1;
    outsourceTasks=merged.filter(t=>{const s=(t['開始日']||'').replace(/\//g,'-').split('-'),e=(t['截止日']||'').replace(/\//g,'-').split('-');if(s.length<3&&e.length<3)return false;const sy=+s[0],sm=+s[1],ey=+e[0],em=+e[1];if(sy&&sm&&sy===cy&&sm===cm)return true;if(ey&&em&&ey===cy&&em===cm)return true;if(sy&&sm&&ey&&em){const sv=sy*100+sm,ev=ey*100+em,cv=cy*100+cm;if(sv<=cv&&ev>=cv)return true}return false});outsourceFetchError=false;
  }catch(e){outsourceTasks=[];outsourceFetchError=true;}
}
let _ganttTip=null,_ganttTipTimer=null;
function ganttRowClick(el,name){
  if(_ganttTip){_ganttTip.remove();_ganttTip=null;clearTimeout(_ganttTipTimer)}
  document.querySelectorAll('.gantt-bar-label').forEach(e=>e.remove());
  document.querySelectorAll('[data-name-hidden]').forEach(e=>{e.style.visibility='visible';e.removeAttribute('data-name-hidden')});
  if(el.classList.contains('gantt-row-hl')){el.classList.remove('gantt-row-hl');return}
  document.querySelectorAll('.gantt-row-hl').forEach(e=>e.classList.remove('gantt-row-hl'));
  el.classList.add('gantt-row-hl');
  const nameEl=el.firstElementChild;if(nameEl){nameEl.style.visibility='hidden';nameEl.setAttribute('data-name-hidden','1')}
  const tip=document.createElement('div');tip.className='gantt-tooltip';tip.textContent=name;
  el.style.position='relative';el.appendChild(tip);
  _ganttTip=tip;
  _ganttTipTimer=setTimeout(()=>{if(tip.parentNode)tip.remove();_ganttTip=null;if(nameEl){nameEl.style.visibility='visible';nameEl.removeAttribute('data-name-hidden')}},3000);
  // Show name on bar
  const track=el.querySelector('[style*="position:relative"]');
  if(track){
    const lbl=document.createElement('div');lbl.className='gantt-bar-label';lbl.textContent=name;
    lbl.style.cssText='position:absolute;top:50%;transform:translateY(-50%);font-size:0.875rem;color:#fff;z-index:5;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #000';
    track.style.position='relative';track.appendChild(lbl);
    const container=el.closest('.timeline')||el.closest('#outsourceContent');
    const updatePos=()=>{if(!lbl.parentNode)return;const sl=container?container.scrollLeft:0;const vw=container?container.clientWidth:track.clientWidth;const lblW=lbl.offsetWidth;lbl.style.left=Math.max(0,sl-track.offsetLeft+(vw-lblW)/2)+'px'};
    updatePos();
    if(container){container.addEventListener('scroll',updatePos);setTimeout(()=>container.removeEventListener('scroll',updatePos),10000)}
  }
}
function outsourceDrop(e,zone){
  const owner=e.dataTransfer.getData('text/plain');if(!owner)return;
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));
  const targetGroup=e.target.closest('.outsource-group');
  const srcZone=outsourceZones[owner]||'一區';
  if(targetGroup&&srcZone===zone){
    // Same zone reorder
    const targetOwner=targetGroup.dataset.owner;if(targetOwner===owner)return;
    const rect=targetGroup.getBoundingClientRect();const above=e.clientY<rect.top+rect.height/2;
    const sameZone=Object.keys(outsourceZones).filter(k=>!k.startsWith('_sort_')&&(outsourceZones[k]||'一區')===zone).sort((a,b)=>(parseInt(outsourceZones['_sort_'+a])||999)-(parseInt(outsourceZones['_sort_'+b])||999));
    const fromPos=sameZone.indexOf(owner);if(fromPos>=0)sameZone.splice(fromPos,1);
    const toPos=sameZone.indexOf(targetOwner);
    sameZone.splice(above?toPos:toPos+1,0,owner);
    sameZone.forEach((o,i)=>{outsourceZones['_sort_'+o]=String(i+1)});
  }else{
    outsourceZones[owner]=zone;
  }
  localStorage.setItem('fzg_outsource_zones',JSON.stringify(outsourceZones));
  fetch(OUTSOURCE_SCRIPT_URL,{method:'POST',body:JSON.stringify({action:'saveZone',owner:owner,zone:outsourceZones[owner]||zone,sort:outsourceZones['_sort_'+owner]||''}),mode:'cors'}).catch(()=>{});
  renderOutsourceFromCache();
}
async function renderOutsource(){
  outsourceTasks=[];outsourceFetchError=false;
  document.getElementById('outsourceContent').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">載入中...</div>';
  await fetchOutsource();
  await loadOutsourceZones();
  renderOutsourceFromCache();
}
function renderOutsourceFromCache(){
  let outsourceFiltered=outsourceTasks;
  const q=(document.getElementById('searchOutsource')||{}).value||'';
  if(q)outsourceFiltered=outsourceFiltered.filter(t=>Object.values(t).join(' ').toLowerCase().includes(q.toLowerCase()));
  if(!outsourceFiltered.length){document.getElementById('outsourceContent').innerHTML=outsourceFetchError?'<div style="text-align:center;color:var(--muted);padding:40px">載入失敗<br><button onclick="renderOutsource()" style="margin-top:10px;padding:6px 12px;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer">重試</button></div>':'<div style="text-align:center;color:var(--muted);padding:40px">本月無外包工作項目</div>';return}
  const owners={};
  outsourceFiltered.forEach(t=>{const o=t['負責人']||'未指派';if(!owners[o])owners[o]=[];owners[o].push(t)});
  const zones=outsourceZones;
  const zoneNames=['一區','二區','三區'];
  let cols=['','',''];
  Object.entries(owners).sort((a,b)=>(parseInt(zones['_sort_'+a[0]])||999)-(parseInt(zones['_sort_'+b[0]])||999)).forEach(([owner,items],i)=>{
    const zone=zones[owner]||'一區';
    const zi=zoneNames.indexOf(zone);const colIdx=zi>=0?zi:(i%3);
    const done=items.filter(t=>t['狀態']==='已完成').length;
    let c=`<div class="outsource-group" draggable="true" data-owner="${owner}" data-sort="${outsourceZones['_sort_'+owner]||i}" ondragstart="event.dataTransfer.setData('text/plain','${owner.replace(/'/g,"\\'")}');event.dataTransfer.effectAllowed='move';this.classList.add('dragging')" ondragend="this.classList.remove('dragging');document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'))" ondragover="cardDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" style="margin-bottom:8px"><div class="owner-title" onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="color:var(--accent);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:pointer"><span class="tog">▼</span> 👤 ${owner} (${items.length})</div><div>`;
    items.forEach(t=>{
      const statusIcon=t['狀態']==='已完成'?'✅':t['狀態']==='進行中'?'🔄':'📝';
      const statusColor=t['工作項目'].includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
      c+=`<div class="card" style="cursor:default"><div class="name" style="color:${statusColor}">${statusIcon} ${t['工作項目']}</div><div class="meta"><span>${t['狀態']}${t['備註']?' '+t['備註']:''}</span><span>${t['開始日']?t['開始日'].substring(0,10):''}${t['開始日']&&t['截止日']?' ~ ':''}${t['截止日']?t['截止日'].substring(0,10):''}</span></div></div>`;
    });
    c+=`</div></div>`;
    cols[colIdx]+=c;
  });
  if(outsourceMode==='gantt'){
    const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
    const days=new Date(y,m+1,0).getDate();
    const weekdays=['日','一','二','三','四','五','六'];
    let gh='<div class="timeline"><div style="position:relative"><div style="display:flex;border-bottom:1px solid var(--border);padding:4px 0;margin-bottom:6px"><div style="width:150px;flex-shrink:0"></div><div style="flex:1;display:flex">';
    const today2=new Date();const isThisMonth2=today2.getFullYear()===y&&today2.getMonth()===m;
    for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();const wd=weekdays[dow];const isToday=isThisMonth2&&d===today2.getDate();const isWeekend=dow===0||dow===6;gh+=`<div style="flex:1;text-align:center;font-size:0.75rem;color:${isToday?'var(--red)':'var(--muted)'};font-weight:${isToday?'bold':'normal'};${isWeekend?'background:rgba(56,139,253,0.12);border-radius:2px':''}">${d}<br>${wd}</div>`}
    gh+='</div></div>';
    const gGroups={};outsourceFiltered.filter(t=>{const s=(t['開始日']||'').replace(/\//g,'-'),e=(t['截止日']||'').replace(/\//g,'-');if(!s&&!e)return false;const sp=s.split('-'),ep=e.split('-');let sd=1,ed=days;if(s){if(+sp[0]===y&&+sp[1]-1===m)sd=+sp[2];else if(+sp[0]>y||(+sp[0]===y&&+sp[1]-1>m))sd=days+1;else sd=1}if(e){if(+ep[0]===y&&+ep[1]-1===m)ed=+ep[2];else if(+ep[0]<y||(+ep[0]===y&&+ep[1]-1<m))ed=0;else ed=days}else ed=sd;return sd<=days&&ed>=1&&sd<=ed}).forEach(t=>{const o=t['負責人']||'未指派';if(!gGroups[o])gGroups[o]=[];gGroups[o].push(t)});
    Object.entries(gGroups).forEach(([owner,items])=>{
      gh+=`<div style="border-bottom:1px solid var(--border);padding:4px 0"><span onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;font-size:1rem;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="tog">▼</span>&nbsp;👤 ${owner} (${items.length})</span><div>`;
      items.forEach(t=>{
      const startStr=(t['開始日']||'').replace(/\//g,'-').substring(0,10);
      const endStr=(t['截止日']||'').replace(/\//g,'-').substring(0,10);
      let sd=1,ed=days;
      if(startStr){const parts=startStr.split('-');const sy=parseInt(parts[0]),sm=parseInt(parts[1])-1,sday=parseInt(parts[2]);if(sy===y&&sm===m)sd=sday;else if(sy>y||(sy===y&&sm>m))sd=days+1;else sd=1}
      if(endStr){const parts=endStr.split('-');const ey=parseInt(parts[0]),em=parseInt(parts[1])-1,eday=parseInt(parts[2]);if(ey===y&&em===m)ed=eday;else if(ey<y||(ey===y&&em<m))ed=0;else ed=days}else{ed=sd}
      if(sd>days||ed<1||sd>ed)return;
      sd=Math.max(1,sd);ed=Math.min(days,ed);
      const color=(t['工作項目']||'').includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
      const l=((sd-1)/days*100).toFixed(1),w=((ed-sd+1)/days*100).toFixed(1);
      gh+=`<div onclick="ganttRowClick(this,'${(t['工作項目']||'').replace(/'/g,"\\'")}')" style="display:flex;align-items:center;padding:4px 0;cursor:pointer"><div style="width:150px;flex-shrink:0;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:12px">${t['工作項目']}</div><div style="flex:1;position:relative;height:16px;background:var(--bg);border-radius:3px"><div style="position:absolute;left:${l}%;width:${w}%;height:100%;background:${color};border-radius:3px;opacity:0.8"></div></div></div>`;
    });
      gh+=`</div></div>`;
    });
    for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();if(dow===0||dow===6){const pos=((d-1)/days*100).toFixed(1);gh+=`<div style="position:absolute;top:40px;bottom:0;left:calc(150px + (100% - 150px) * ${pos} / 100);width:calc((100% - 150px) / ${days});background:rgba(56,139,253,0.1);pointer-events:none"></div>`}}
    if(isThisMonth2){const todayPos=((today2.getDate()-0.5)/days*100).toFixed(1);gh+=`<div style="position:absolute;top:40px;bottom:0;left:calc(150px + (100% - 150px) * ${todayPos} / 100);width:2px;background:var(--red);z-index:10;pointer-events:none;opacity:0.7"></div>`}
    gh+='</div></div>';
    document.getElementById('outsourceContent').innerHTML=gh;
    return;
  }
  document.getElementById('outsourceContent').innerHTML='<div class="board"><div class="column" data-zone="一區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'一區\')">'+cols[0]+'</div><div class="column" data-zone="二區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'二區\')">'+cols[1]+'</div><div class="column" data-zone="三區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'三區\')">'+cols[2]+'</div></div>';
}
fetchData();updateMonthLabel();loadNotes();applyLock();
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister()))}

