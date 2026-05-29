
const SHEET_ID=CONFIG.sheetId;
function setSyncStatus(msg,color){const el=document.getElementById('syncStatus');if(el){el.textContent=msg;el.style.color=color||'var(--muted)'}}
function saveNote(month,text){const url=SCRIPT_URL+'?action=saveNote&month='+encodeURIComponent(month)+'&text='+encodeURIComponent(text);setSyncStatus('🔄 同步中...','var(--yellow)');if(url.length<2000)return fetch(url).then(()=>{setSyncStatus('✅ 已同步','var(--green)');setTimeout(()=>setSyncStatus(''),3000)}).catch(()=>setSyncStatus('❌ 同步失敗','var(--red)'));return fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'saveNote',month:month,text:text})}).then(()=>{setSyncStatus('✅ 已同步','var(--green)');setTimeout(()=>setSyncStatus(''),3000)}).catch(()=>setSyncStatus('❌ 同步失敗','var(--red)'))}

const SCRIPT_URL=CONFIG.scriptUrl;
const CSV_URL=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;
function getSheetUrl(){if(window._unscheduledMode)return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent('未修正')}`;const y=currentMonth.getFullYear(),m=currentMonth.getMonth()+1;const name=y+'/'+(m<10?'0'+m:m);return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(name)}`}
let tasks=[],currentMonth=new Date(),activeFilter='';
let unlocked=sessionStorage.getItem('fzg_unlocked')==='1';
async function syncAndReload(){
  const keys=Object.keys(localStorage).filter(k=>k.startsWith('fzg_'));
  if(!confirm('確定執行以下操作？\n\n1. 清除本機快取（'+keys.length+' 筆）\n2. 重新載入頁面（從雲端讀取設定）\n\n※ 所有操作已即時同步到雲端'))return;
  document.body.innerHTML='<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:9999"><div class="spinner"></div></div>';
  Object.keys(localStorage).filter(k=>k.startsWith('fzg_')).forEach(k=>localStorage.removeItem(k));location.reload()
}
function toggleAdmin(){
  if(unlocked){unlocked=false;sessionStorage.removeItem('fzg_unlocked')}
  else{if(document.getElementById('adminPw').value!==(CONFIG.password||'fzg')){alert('密碼錯誤');return}unlocked=true;sessionStorage.setItem('fzg_unlocked','1')}
  document.getElementById('adminPw').value='';
  applyLock();render();renderFilterBar();
}
function applyLock(){
  document.body.classList.toggle('locked',!unlocked);
  document.getElementById('adminBtn').textContent=unlocked?'鎖定':'管理';
  document.getElementById('adminPw').style.display=unlocked?'none':'';
}
function _normDate(s){if(!s)return'';if(s.includes('-'))return s.substring(0,10);const p=s.split('/');return p.length===3?p[0]+'-'+p[1].padStart(2,'0')+'-'+p[2].padStart(2,'0'):''}
function _savePendingEdit(t){const p=JSON.parse(localStorage.getItem('fzg_pending_edits')||'{}');p[t['任務名稱']]={ts:Date.now(),data:{'開始日':t['開始日'],'截止日':t['截止日'],'負責人':t['負責人'],'狀態':t['狀態'],'標籤':t['標籤'],'優先級':t['優先級'],'父任務':t['父任務'],'備註':t['備註'],'工時':t['工時'],'評論':t['評論']}};localStorage.setItem('fzg_pending_edits',JSON.stringify(p))}
function _moveTaskToMonth(t,row,fromMonth,toMonth){
  fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'delete',month:fromMonth,row:row})});
  fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({name:t['任務名稱'],owner:t['負責人'],status:t['狀態'],progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註']||'',priority:t['優先級']||'',tags:t['標籤']||'',parent:t['父任務']||'',hours:t['工時']||'',comment:t['評論']||'',month:toMonth})});
}
function getDeadlineColor(t){if(t['狀態']==='已完成')return '';const due=_normDate(t['截止日']||'');if(!due)return '';const today=new Date();today.setHours(0,0,0,0);const d=new Date(due+'T00:00:00');if(isNaN(d))return '';const diff=Math.round((d-today)/(1000*60*60*24));if(diff<0)return '#dc143c';if(diff===0)return '#ff8c00';if(diff===1)return '#ffd700';return ''}
function getDeadlineBg(t){
  if(t['狀態']==='已完成')return 'border-left:6px solid var(--border)';
  const due=_normDate(t['截止日']||'');if(!due)return 'border-left:6px solid var(--border)';
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(due+'T00:00:00');if(isNaN(d))return 'border-left:6px solid var(--border)';
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
    const sd=t['開始日']||'';const _toISO=d=>{if(!d)return'';if(d.includes('-'))return d.substring(0,10);const p=d.split('/');return p.length===3?p[0]+'-'+p[1].padStart(2,'0')+'-'+p[2].padStart(2,'0'):''};document.getElementById('f-start').value=_toISO(sd);
    const ed=t['截止日']||'';document.getElementById('f-due').value=_toISO(ed);
    document.getElementById('f-tags').value=t['標籤']||'';
    document.getElementById('f-parent').value=t['父任務']||'';document.getElementById('f-parent-select').value=t['父任務']||'';
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
function closeModal(){const m=document.getElementById('addModal');m.classList.add('hidden');m.querySelectorAll('input,textarea,select').forEach(el=>{if(el.type!=='button'&&el.type!=='submit'){el.value='';el.style.border=''}});const oe=document.getElementById('owner-err');if(oe)oe.remove();delete m.dataset.editIdx}
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
  const curParent=document.getElementById('f-parent').value;
  if(curParent&&!parentNames.includes(curParent))parentNames.unshift(curParent);
  parentSel.innerHTML='<option value="">選擇...</option>'+[...new Set(parentNames)].map(n=>`<option value="${n}">${n}</option>`).join('');
  if(curParent)parentSel.value=curParent;
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
  if(sel.value==='__new'){const v=prompt('輸入新負責人名稱：');if(v){const cur=input.value?input.value.split(',').map(s=>s.trim()):[];if(!cur.includes(v))cur.push(v);input.value=cur.join(',')}sel.value=''}
  else if(sel.value){const cur=input.value?input.value.split(',').map(s=>s.trim()):[];if(!cur.includes(sel.value))cur.push(sel.value);input.value=cur.join(',');sel.value=''}
}
function changeMonth(dir){window._unscheduledMode=false;currentMonth.setMonth(currentMonth.getMonth()+dir);updateMonthLabel();loadCollapsedOwners();fetchData();loadNotes();renderOutsource()}
function toggleStatus(idx,e){
  e.stopPropagation();if(!unlocked)return;
  const t=tasks[idx];
  const next=t['狀態']==='待辦'?'進行中':t['狀態']==='進行中'?'已完成':'待辦';
  t['狀態']=next;
  setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:next,progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']}),});
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
    const _d2i=d=>{if(!d)return'';if(d.includes('-'))return d.substring(0,10);const p=d.split('/');return p.length===3?p[0]+'-'+p[1].padStart(2,'0')+'-'+p[2].padStart(2,'0'):''};
    const _sv=_d2i(t['開始日']||''),_ev=_d2i(t['截止日']||'');
    html+=`<label style="font-size:0.8em;color:var(--accent);margin-bottom:6px;display:block">修改日期</label>`;
    html+=`<div style="margin-bottom:6px"><span style="font-size:0.75em;color:var(--muted)">開始日</span><input id="ie-start" type="date" value="${_sv}" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)" onclick="this.showPicker()"></div>`;
    html+=`<div><span style="font-size:0.75em;color:var(--muted)">截止日</span><input id="ie-due" type="date" value="${_ev}" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text)" onclick="this.showPicker()"></div>`;
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
    _savePendingEdit(t);
    // Auto-adjust parent date if child task date exceeds parent range
    if(field==='日期'&&t['父任務']){
      const parent=tasks.find(p=>p['任務名稱']===t['父任務']);
      if(parent){
        const children=tasks.filter(c=>c['父任務']===parent['任務名稱']);
        const dates=children.map(c=>({s:c['開始日']||'',e:c['截止日']||''})).filter(d=>d.s&&d.e);
        if(dates.length){
          const minS=dates.map(d=>d.s).sort()[0];
          const maxE=dates.map(d=>d.e).sort().pop();
          let changed=false;
          if(!parent['開始日']||minS<parent['開始日']){parent['開始日']=minS;changed=true}
          if(!parent['截止日']||maxE>parent['截止日']){parent['截止日']=maxE;changed=true}
          if(changed){
            const pi=tasks.indexOf(parent);
            _savePendingEdit(parent);
            fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:pi,name:parent['任務名稱'],owner:parent['負責人'],status:parent['狀態'],progress:'',startDate:parent['開始日'],dueDate:parent['截止日'],note:parent['備註'],priority:parent['優先級'],tags:parent['標籤'],parent:parent['父任務'],hours:parent['工時'],comment:parent['評論']})}).then(()=>{
              // Check if parent needs to move to different month
              const _cm=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1<10?'0':'')+(currentMonth.getMonth()+1);
              const _ps=parent['開始日']||'';const _pm2=_ps?(_ps.includes('-')?_ps.substring(0,4)+'/'+_ps.substring(5,7):(()=>{const pp=_ps.split('/');return pp.length>=2?pp[0]+'/'+pp[1].padStart(2,'0'):''})()):'';
              const _parentIsTop=!parent['父任務']||!tasks.find(x=>x['任務名稱']===parent['父任務']);
              if(_parentIsTop&&_pm2&&_pm2!==_cm){
                _moveTaskToMonth(parent,pi,_cm,_pm2);
                // Also move children
                tasks.filter(c=>c['父任務']===parent['任務名稱']).forEach((c,ci)=>{const cIdx=tasks.indexOf(c);_moveTaskToMonth(c,cIdx>pi?cIdx-1:cIdx,_cm,_pm2)});
              }
            });
          }
        }
      }
    }
    // Reverse rule: if this task is a parent and dates shrink, push children
    if(field==='日期'){
      const _children=tasks.filter(c=>c['父任務']===t['任務名稱']);
      if(_children.length){
        const pStart=t['開始日']||'';const pEnd=t['截止日']||'';
        _children.forEach(c=>{
          let cChanged=false;
          if(pStart&&c['開始日']&&c['開始日']<pStart){c['開始日']=pStart;cChanged=true}
          if(pEnd&&c['截止日']&&c['截止日']>pEnd){c['截止日']=pEnd;cChanged=true}
          // Ensure at least 1 day duration
          if(c['開始日']&&c['截止日']&&c['開始日']>=c['截止日']){c['截止日']=c['開始日'];cChanged=true}
          if(cChanged){
            const ci=tasks.indexOf(c);_savePendingEdit(c);
            fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:c['父任務'],hours:c['工時'],comment:c['評論']})});
          }
        });
      }
    }
    const _curMonth=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1<10?'0':'')+(currentMonth.getMonth()+1);
    const _newStart=t['開始日']||'';
    const _newMonth=_newStart?(_newStart.includes('-')?_newStart.substring(0,4)+'/'+_newStart.substring(5,7):(()=>{const p=_newStart.split('/');return p.length>=2?p[0]+'/'+p[1].padStart(2,'0'):''})()):'';
    // Only move if this is a top-level task (no parent, or parent not in current tasks)
    const _isTopLevel=!t['父任務']||!tasks.find(p=>p['任務名稱']===t['父任務']);
    // Always update first
    setSyncStatus('🔄 同步中...','var(--yellow)');
    fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:t['狀態'],progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']})}).then(()=>{
      // Only top-level tasks trigger move
      if(_isTopLevel&&_newMonth&&_newMonth!==_curMonth){
        _moveTaskToMonth(t,idx,_curMonth,_newMonth);
        // Also move children
        tasks.filter(c=>c['父任務']===t['任務名稱']).forEach((c)=>{const ci=tasks.indexOf(c);_moveTaskToMonth(c,ci>idx?ci-1:ci,_curMonth,_newMonth)});
      }
    });
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
      setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:'',hours:c['工時'],comment:c['評論']}),});
    } else {
      c['父任務']=parentOfDeleted;
      setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:parentOfDeleted,hours:c['工時'],comment:c['評論']}),});
    }
    grandChildren.forEach(g=>{
      const gi=tasks.indexOf(g);
      g['父任務']=parentOfDeleted||t['任務名稱']?'':'';
      if(!parentOfDeleted){g['父任務']=c['任務名稱']}
    });
  });
  setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'delete',row:idx}),});
  tasks.splice(idx,1);render();
}
function updateMonthLabel(){const lbl=document.getElementById('monthLabel');if(window._unscheduledMode){lbl.textContent='未修正';lbl.style.cursor='pointer';lbl.onclick=()=>{window._unscheduledMode=false;updateMonthLabel();fetchData()};return}lbl.textContent=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1);lbl.style.cursor='pointer';lbl.onclick=()=>{const p=document.getElementById('monthPicker');p.value=currentMonth.getFullYear()+'-'+String(currentMonth.getMonth()+1).padStart(2,'0');p.showPicker()};const p=document.getElementById('monthPicker');if(p)p.value=currentMonth.getFullYear()+'-'+String(currentMonth.getMonth()+1).padStart(2,'0')}
function jumpToMonth(v){if(!v)return;window._unscheduledMode=false;const[y,m]=v.split('-').map(Number);currentMonth=new Date(y,m-1,1);updateMonthLabel();loadCollapsedOwners();fetchData();loadNotes();renderOutsource()}
function showUnscheduled(){window._unscheduledMode=true;updateMonthLabel();fetchData()}
let _showUnmodified=false,_unmodifiedTasks=[];
async function toggleUnmodified(){
  _showUnmodified=!_showUnmodified;
  const btn=document.querySelector('[data-unmod-btn]');
  if(btn)btn.textContent=_showUnmodified?'🔽 隱藏未修正':'📋 顯示未修正';
  if(_showUnmodified&&!_unmodifiedTasks.length){
    try{const r=await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent('未修正')}`);const t=await r.text();const j=JSON.parse(t.substring(47).slice(0,-2));const c=j.table.cols.map(x=>x.label.trim());_unmodifiedTasks=j.table.rows.map(r=>{const o={};c.forEach((col,i)=>{if(r.c&&r.c[i])o[col]=r.c[i].f||String(r.c[i].v||'');else o[col]=''});return o}).filter(x=>x['任務名稱'])}catch(e){}
  }
  render();renderFilterBar();
}
function loadNotes(){
  const notesUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=notes&headers=0`;
  fetch(notesUrl).then(r=>r.text()).then(text=>{
    try{const json=JSON.parse(text.substring(47).slice(0,-2));const rows=json.table.rows||[];
    rows.forEach(r=>{if(r.c&&r.c[0]){const v=String(r.c[0].v||'');if(v.startsWith('owner_sort_')){try{const arr=JSON.parse(r.c[1].v||'[]');const sortObj={};arr.forEach((o,i)=>{sortObj[o]=String(i+1)});localStorage.setItem('fzg_'+v,JSON.stringify(sortObj))}catch(e){}}if(v.startsWith('collapsed_owners_')){try{const arr=JSON.parse(r.c[1].v||'[]');localStorage.setItem('fzg_'+v,JSON.stringify(arr))}catch(e){}}if(v.startsWith('collapsed_timeline_owners_')){try{const arr=JSON.parse(r.c[1].v||'[]');localStorage.setItem('fzg_'+v,JSON.stringify(arr))}catch(e){}}if(v.startsWith('collapsed_timeline_tasks_')){try{const arr=JSON.parse(r.c[1].v||'[]');localStorage.setItem('fzg_'+v,JSON.stringify(arr))}catch(e){}}if(v.startsWith('timeline_task_sort_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'{}')}catch(e){}}if(v.startsWith('collapsed_outsource_groups_')||v.startsWith('collapsed_outsource_board_groups_')||v.startsWith('expanded_outsource_board_groups_')||v.startsWith('expanded_outsource_groups_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'[]')}catch(e){}}if(v.startsWith('group_names_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'{}')}catch(e){}}if(v.startsWith('manual_board_groups_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'{}')}catch(e){}}if(v.startsWith('board_item_sort_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'{}')}catch(e){}}if(v.startsWith('collapsed_outsource_owners_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'[]')}catch(e){}}if(v.startsWith('sync_time_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'')}catch(e){}}if(v.startsWith('task_collapse_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'[]')}catch(e){}}if(v.startsWith('sub_collapse_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'[]')}catch(e){}}if(v==='outsource_zones'){try{localStorage.setItem('fzg_outsource_zones',r.c[1].v||'{}');outsourceZones=JSON.parse(r.c[1].v||'{}')}catch(e){}}if(v.startsWith('col_collapse_')){try{localStorage.setItem('fzg_'+v,r.c[1].v||'[]')}catch(e){}}}});
    }catch(e){}
    loadCollapsedOwners();updateSyncTimestamp();
    var tc=JSON.parse(localStorage.getItem('fzg_task_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'[]');tc.forEach(name=>{var t=tasks.find(x=>x['任務名稱']===name);if(t)t['收合']='1'});
    render();
  }).catch(()=>{});
}
function saveOwnerSort(status,sortArray){
  saveNote('owner_sort_'+status+'_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(sortArray));
}
function filterByMonth(list){
  if(window._unscheduledMode)return list;
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth()+1,prefix=y+'-'+(m<10?'0'+m:m);
  const toYM=d=>{if(!d)return'';const p=d.split('/');if(p.length>=2)return p[0]+'-'+(p[1].length<2?'0'+p[1]:p[1]);if(d.includes('-'))return d.substring(0,7);return''};
  return list.filter(t=>{
    const sd=t['開始日']||'';const ed=t['截止日']||'';
    if(!sd&&!ed)return true;
    const sym=toYM(sd),eym=toYM(ed);
    if(sym===prefix||eym===prefix)return true;
    if(sym&&eym)return sym<=prefix&&eym>=prefix;
    return false;
  });
}
function getFiltered(){
  let list=filterByMonth(tasks);
  const q=(document.getElementById('search')||{}).value||'';const ql=q.toLowerCase();
  if(ql)list=list.filter(t=>Object.values(t).join(' ').toLowerCase().includes(ql));
  if(activeFilter)list=list.filter(t=>(t['標籤']||'').includes(activeFilter));
  return list;
}
async function submitTask(){
  const m=document.getElementById('addModal');
  const oe=document.getElementById('owner-err');if(oe)oe.remove();document.getElementById('f-owner').style.border='';document.getElementById('f-name').style.border='';
  const data={name:document.getElementById('f-name').value,owner:document.getElementById('f-owner').value,status:document.getElementById('f-status').value,progress:'',startDate:document.getElementById('f-start').value,dueDate:document.getElementById('f-due').value,note:document.getElementById('f-note').value,priority:document.getElementById('f-priority').value,tags:document.getElementById('f-tags').value,parent:document.getElementById('f-parent').value,hours:document.getElementById('f-hours').value,comment:document.getElementById('f-comment').value};
  let valid=true;
  if(!data.name){document.getElementById('f-name').style.border='2px solid var(--red)';valid=false}
  if(!data.owner){document.getElementById('f-owner').style.border='2px solid var(--red)';valid=false}
  if(!valid)return;
  const dupIdx=tasks.findIndex(t=>t['任務名稱']===data.name);
  if(dupIdx!==-1&&(m.dataset.editIdx===undefined||dupIdx!==parseInt(m.dataset.editIdx))){alert('任務名稱已存在，請使用不同名稱');return}
  if(m.dataset.editIdx!==undefined){data.action='update';data.row=m.dataset.editIdx}
  try{
    const _curM=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1<10?'0':'')+(currentMonth.getMonth()+1);
    const _sd=data.startDate||'';const _nm=_sd?(_sd.includes('-')?_sd.substring(0,4)+'/'+_sd.substring(5,7):(()=>{const p=_sd.split('/');return p.length>=2?p[0]+'/'+p[1].padStart(2,'0'):''})()):'';
    const _isTop=!data.parent||!tasks.find(p=>p['任務名稱']===data.parent);
    // Always send update first
    setSyncStatus('🔄 同步中...','var(--yellow)');
    fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(data)}).then(()=>{
      if(data.action==='update'&&_isTop&&_nm&&_nm!==_curM){
        const _t=tasks[parseInt(m.dataset.editIdx)];
        _moveTaskToMonth(_t,parseInt(m.dataset.editIdx),_curM,_nm);
        tasks.filter(c=>c['父任務']===_t['任務名稱']).forEach(c=>{const ci=tasks.indexOf(c);_moveTaskToMonth(c,ci,_curM,_nm)});
      }
    });
    if(data.action==='update'){
      const t=tasks[parseInt(m.dataset.editIdx)];
      const oldName=t['任務名稱'];
      t['任務名稱']=data.name;t['負責人']=data.owner;t['狀態']=data.status;t['開始日']=data.startDate;t['截止日']=data.dueDate;t['備註']=data.note;t['優先級']=data.priority;t['標籤']=data.tags;t['父任務']=data.parent;t['工時']=data.hours;t['評論']=data.comment;
      _savePendingEdit(t);
      if(oldName!==data.name){tasks.filter(c=>c['父任務']===oldName).forEach(c=>{c['父任務']=data.name;const ci=tasks.indexOf(c);setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:data.name,hours:c['工時'],comment:c['評論']}),})})}
    }else{
      const maxSort=Math.max(0,...tasks.map(t=>parseInt(t['排序'])||0));
      tasks.push({'任務名稱':data.name,'負責人':data.owner||'','狀態':data.status||'待辦','進度':'','開始日':data.startDate||'','截止日':data.dueDate||'','備註':data.note||'','優先級':data.priority||'','標籤':data.tags||'','父任務':data.parent||'','工時':data.hours||'','評論':data.comment||'','排序':String(maxSort+1)});
    }
    closeModal();render();renderFilterBar();
    // Auto-move: if task was in unmodified list and now complete, move to monthly tab
    if(_showUnmodified&&data.owner&&data.startDate&&data.dueDate&&data.name){
      const unIdx=_unmodifiedTasks.findIndex(t=>t['任務名稱']===data.name);
      if(unIdx!==-1){
        const toMonth=data.startDate.substring(0,7).replace('-','/');
        fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'moveTask',fromMonth:'未修正',toMonth:toMonth,row:unIdx})});
        _unmodifiedTasks.splice(unIdx,1);
        render();renderFilterBar();
      }
    }
  }catch(e){alert('❌ 失敗：'+e.message)}
}
function deleteTask(idx){
  const m=document.getElementById('addModal');
  const row=idx!==undefined?idx:m.dataset.editIdx;
  if(row===undefined)return;
  if(!confirm('確定刪除？'))return;
  setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'delete',row:row}),});
  tasks.splice(parseInt(row),1);if(idx===undefined)closeModal();render();
}
async function fetchData(){
  document.getElementById('boardView').innerHTML='<div class="spinner"></div>';
  document.getElementById('timelineView').innerHTML='<div class="spinner"></div>';
  document.getElementById('reportView').innerHTML='<div class="spinner"></div>';
  try{
    const res=await fetch(getSheetUrl());const text=await res.text();
    const json=JSON.parse(text.substring(47).slice(0,-2));
    const cols=json.table.cols.map(c=>c.label.trim());
    tasks=json.table.rows.map(r=>{const obj={};cols.forEach((c,i)=>{if(r.c&&r.c[i])obj[c]=r.c[i].f||String(r.c[i].v||'');else obj[c]=''});return obj}).filter(t=>t['任務名稱']);
    // Merge localStorage pending edits (gviz cache workaround)
    const _pending=JSON.parse(localStorage.getItem('fzg_pending_edits')||'{}');
    const _now=Date.now();
    Object.keys(_pending).forEach(name=>{const e=_pending[name];if(_now-e.ts>300000){delete _pending[name];return}const t=tasks.find(x=>x['任務名稱']===name);if(t){Object.assign(t,e.data)}});
    localStorage.setItem('fzg_pending_edits',JSON.stringify(_pending));
    // Also fetch previous month for cross-month tasks
    try{const pm=new Date(currentMonth);pm.setMonth(pm.getMonth()-1);const py=pm.getFullYear(),pmm=pm.getMonth()+1;const prevUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(py+'/'+(pmm<10?'0'+pmm:pmm))}`;const r2=await fetch(prevUrl);const t2=await r2.text();const j2=JSON.parse(t2.substring(47).slice(0,-2));const c2=j2.table.cols.map(c=>c.label.trim());const prev=j2.table.rows.map(r=>{const obj={};c2.forEach((c,i)=>{if(r.c&&r.c[i])obj[c]=r.c[i].f||String(r.c[i].v||'');else obj[c]=''});return obj}).filter(t=>t['任務名稱']&&!tasks.find(e=>e['任務名稱']===t['任務名稱']));tasks=tasks.concat(prev);
    // Re-apply pending edits to prev month tasks
    const _p2=JSON.parse(localStorage.getItem('fzg_pending_edits')||'{}');Object.keys(_p2).forEach(name=>{const e=_p2[name];if(Date.now()-e.ts<=300000){const t=tasks.find(x=>x['任務名稱']===name);if(t)Object.assign(t,e.data)}});
    }catch(e){}
    render();renderFilterBar();
  }catch(e){document.getElementById('boardView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">載入失敗<br><button onclick="fetchData()" style="margin-top:10px;padding:6px 12px;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer">重試</button></div>'}
}
function renderFilterBar(){
  const allTags=new Set();tasks.forEach(t=>(t['標籤']||'').split(',').filter(Boolean).forEach(tag=>allTags.add(tag.trim())));
  if(!allTags.size){document.getElementById('filterBar').innerHTML='';return}
  let html=`<span class="filter-tag ${!activeFilter?'active':''}" onclick="activeFilter='';render();renderFilterBar()">全部</span>`;
  allTags.forEach(tag=>{html+=`<span class="filter-tag ${activeFilter===tag?'active':''}" onclick="activeFilter='${tag}';render();renderFilterBar()">${tag}</span>`});
  html+=`<input class="search-box" id="search" placeholder="🔍 搜尋..." oninput="searchRender()" style="margin-left:auto"/>`;
  const oldVal=(document.getElementById('search')||{}).value||'';
  document.getElementById('filterBar').innerHTML=html;
  document.getElementById('search').value=oldVal;
}
function toggleSub(el,e){e.stopPropagation();var d=el.lastElementChild,s=el.firstElementChild;if(d.style.display==='none'){d.style.display='block';s.textContent='▼'}else{d.style.display='none';s.textContent='▶'};var card=el.closest('.card');var name=card?card.querySelector('.name')?.textContent.replace(/[▶▼●]\s*/g,'').trim():'';if(name){var key='fzg_sub_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);var list=JSON.parse(localStorage.getItem(key)||'[]');if(d.style.display==='none'){if(!list.includes(name))list.push(name)}else{list=list.filter(n=>n!==name)}localStorage.setItem(key,JSON.stringify(list));saveNote('sub_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(list))}}
function toggleCollapse(idx,el){var b=el.closest('.card').querySelector('.card-body');var collapsed=b.style.display!=='none';b.style.display=collapsed?'none':'block';el.querySelector('span').textContent=collapsed?'▶':'▼';tasks[idx]['收合']=collapsed?'1':'';var key='fzg_task_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);var list=JSON.parse(localStorage.getItem(key)||'[]');var name=tasks[idx]['任務名稱'];if(collapsed){if(!list.includes(name))list.push(name)}else{list=list.filter(n=>n!==name)}localStorage.setItem(key,JSON.stringify(list));saveNote('task_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(list))}
let _collapsedOwners=new Set();
function getCollapsedOwnersKey(){return 'fzg_collapsed_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function loadCollapsedOwners(){_collapsedOwners=new Set(JSON.parse(localStorage.getItem(getCollapsedOwnersKey())||'[]'))}
let _collapsedTimelineOwners=new Set();
function getTimelineCollapseKey(){return 'fzg_collapsed_timeline_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function getTimelineSortKey(){return 'fzg_timeline_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function loadTimelineCollapse(){_collapsedTimelineOwners=new Set(JSON.parse(localStorage.getItem(getTimelineCollapseKey())||'[]'));_collapsedTimelineTasks=new Set(JSON.parse(localStorage.getItem(getTimelineTaskCollapseKey())||'[]'))}
function getTimelineTaskCollapseKey(){return 'fzg_collapsed_timeline_tasks_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
let _collapsedTimelineTasks=new Set();
let _collapsedOutsourceGroups=new Set(JSON.parse(localStorage.getItem('fzg_collapsed_outsource_groups_'+new Date().getFullYear()+'_'+(new Date().getMonth()+1))||'[]'));
function getOutsourceGroupCollapseKey(){return 'fzg_expanded_outsource_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function getOutsourceBoardGroupCollapseKey(){return 'fzg_expanded_outsource_board_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function getOutsourceOwnerCollapseKey(){return 'fzg_collapsed_outsource_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
let _collapsedOutsourceOwners=new Set();
function toggleOutsourceOwner(el,owner){var d=el.nextElementSibling;var collapsed=d.style.display!=='none';d.style.display=collapsed?'none':'block';el.querySelector('.tog').textContent=collapsed?'▶':'▼';if(collapsed)_collapsedOutsourceOwners.add(owner);else _collapsedOutsourceOwners.delete(owner);localStorage.setItem(getOutsourceOwnerCollapseKey(),JSON.stringify([..._collapsedOutsourceOwners]));if(unlocked)saveNote('collapsed_outsource_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedOutsourceOwners]))}
function updateSyncTimestamp(){const el=document.getElementById('syncTimestamp');if(!el)return;const ts=localStorage.getItem('fzg_sync_time_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1));el.textContent=ts?'🕐 更新：'+ts:''}
function getGroupNamesKey(){return 'fzg_group_names_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function getManualBoardGroupsKey(){return 'fzg_manual_board_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
let _groupNames={};
let _manualBoardGroups={};
function loadGroupNames(){_groupNames=JSON.parse(localStorage.getItem(getGroupNamesKey())||'{}');_manualBoardGroups=JSON.parse(localStorage.getItem(getManualBoardGroupsKey())||'{}')}
function simplifyGroupName(items){const names=items.map(t=>t['工作項目']||'');if(!names.length)return'';const shortest=names.reduce((a,b)=>a.length<=b.length?a:b);return shortest.length<=10?shortest:shortest.substring(0,10)}
function getGroupDisplayName(key,items){if(_groupNames[key])return _groupNames[key];const name=simplifyGroupName(items);if(items.length>1){_groupNames[key]=name;localStorage.setItem(getGroupNamesKey(),JSON.stringify(_groupNames));fetch(SCRIPT_URL+'?action=saveNote&month='+encodeURIComponent('group_names_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))+'&text='+encodeURIComponent(JSON.stringify(_groupNames)))}return name}
function editGroupName(el,key){if(!unlocked)return;const current=_groupNames[key]||key;const v=prompt('修改群組名稱：',current);if(v&&v.trim()){_groupNames[key]=v.trim();localStorage.setItem(getGroupNamesKey(),JSON.stringify(_groupNames));saveNote('group_names_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(_groupNames));renderOutsourceFromCache()}}
function saveBoardGroups(){localStorage.setItem(getManualBoardGroupsKey(),JSON.stringify(_manualBoardGroups));saveNote('manual_board_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(_manualBoardGroups))}
function getBoardItemSortKey(){return 'fzg_board_item_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function moveBoardItem(owner,key,dir,e){e.stopPropagation();if(!unlocked)return;const sort=JSON.parse(localStorage.getItem(getBoardItemSortKey())||'{}');let list=sort[owner]||[];if(!list.length||list.indexOf(key)<0){const col=e.target.closest('.column');if(col){const items=[...col.querySelectorAll('[data-board-item],[data-board-group]')];list=items.map(el=>el.dataset.boardItem||el.dataset.boardGroup).filter(Boolean);list=[...new Set(list)]}sort[owner]=list}const pos=list.indexOf(key);if(pos<0)return;const np=pos+dir;if(np<0||np>=list.length)return;list.splice(pos,1);list.splice(np,0,key);const swappedKey=list[pos];sort[owner]=list;localStorage.setItem(getBoardItemSortKey(),JSON.stringify(sort));saveNote('board_item_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(sort));renderOutsourceFromCache();[key,swappedKey].forEach(k=>{if(!k)return;const el2=document.querySelector(`[data-board-item="${k}"],[data-board-group="${k}"]`);if(el2){el2.classList.add('moved');setTimeout(()=>el2.classList.remove('moved'),600)}})}
function boardCardDragStart(e,el){if(!unlocked){e.preventDefault();return}e.stopPropagation();e.dataTransfer.setData('text/board-item',el.dataset.boardItem);el.classList.add('dragging')}
function boardCardDragEnd(){document.querySelectorAll('.dragging,.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('dragging','drag-over-top','drag-over-bottom'));document.querySelectorAll('[style*="outline: 2px dashed"]').forEach(x=>x.style.outline='')}
function boardCardDragOver(e,el){e.preventDefault();const item=e.dataTransfer.types.includes('text/board-item');if(!item)return;document.querySelectorAll('[style*="outline: 2px dashed"]').forEach(x=>x.style.outline='');const target=el.closest('[data-board-group]')||el;target.style.outline='2px dashed var(--accent)'}
function boardCardDrop(e,el){e.preventDefault();e.stopPropagation();el.style.outline='';const src=e.dataTransfer.getData('text/board-item');if(!src||!unlocked)return;const groupEl=el.closest('[data-board-group]');const targetGroup=groupEl?.dataset.boardGroup||el.dataset.boardGroup;const target=el.dataset.boardItem;if(!targetGroup&&!target)return;if(targetGroup){if(targetGroup===src)return;_manualBoardGroups[src]=targetGroup;const gid=_getTaskId;outsourceTasks.forEach(t=>{const id=gid(t);if(_manualBoardGroups[id]===targetGroup||id===targetGroup)_manualBoardGroups[id]=targetGroup})}else if(target){if(target===src)return;_manualBoardGroups[src]=target;_manualBoardGroups[target]=target}saveBoardGroups();boardCardDragEnd();renderOutsourceFromCache()}
function moveOutOfGroup(e,itemId){e.stopPropagation();if(!unlocked)return;delete _manualBoardGroups[itemId];saveBoardGroups();renderOutsourceFromCache()}
let _collapsedOutsourceBoardGroups=new Set();
function toggleOutsourceGroup(el){var wrapper=el.closest('[data-group]');var d=wrapper.children[1];d.style.display=d.style.display==='none'?'block':'none';el.textContent=d.style.display==='none'?'▶':'▼';var name=wrapper.dataset.group;if(!name)return;if(d.style.display!=='none')_collapsedOutsourceGroups.add(name);else _collapsedOutsourceGroups.delete(name);if(!unlocked)return;localStorage.setItem(getOutsourceGroupCollapseKey(),JSON.stringify([..._collapsedOutsourceGroups]));saveNote('expanded_outsource_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedOutsourceGroups]))}
function toggleOutsourceBoardGroup(el){var d=el.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';el.querySelector('span').textContent=d.style.display==='none'?'▶':'▼';var name=el.dataset.boardGroup;if(!name)return;if(d.style.display!=='none')_collapsedOutsourceBoardGroups.add(name);else _collapsedOutsourceBoardGroups.delete(name);if(!unlocked)return;localStorage.setItem(getOutsourceBoardGroupCollapseKey(),JSON.stringify([..._collapsedOutsourceBoardGroups]));saveNote('expanded_outsource_board_groups_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedOutsourceBoardGroups]))}
let _tlTaskDrag=null;
function getTlTaskSortKey(){return 'fzg_timeline_task_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)}
function tlTaskDragStart(e,el){if(!unlocked){e.preventDefault();return}_tlTaskDrag=el.dataset.task;e.dataTransfer.setData('text/tl-task',_tlTaskDrag);el.classList.add('dragging')}
function tlTaskDragEnd(){_tlTaskDrag=null;document.querySelectorAll('.dragging,.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('dragging','drag-over-top','drag-over-bottom'))}
function tlTaskDragOver(e,el){e.preventDefault();if(!_tlTaskDrag||el.dataset.task===_tlTaskDrag)return;document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));const rect=el.getBoundingClientRect();el.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom')}
function tlTaskDrop(e,el){e.preventDefault();e.stopPropagation();document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));if(!_tlTaskDrag||!unlocked||el.dataset.task===_tlTaskDrag)return;const sort=JSON.parse(localStorage.getItem(getTlTaskSortKey())||'{}');const src=_tlTaskDrag,tgt=el.dataset.task;const srcTask=tasks.find(t=>t['任務名稱']===src),tgtTask=tasks.find(t=>t['任務名稱']===tgt);if(!srcTask||!tgtTask||(srcTask['負責人']||'')!==(tgtTask['負責人']||''))return;const owner=srcTask['負責人']||'未指派';const allNames=tasks.filter(t=>(t['負責人']||'未指派')===owner&&!t['父任務']).map(t=>t['任務名稱']);const existing=sort[owner]||allNames;const ownerTasks=[...existing.filter(n=>allNames.includes(n)),...allNames.filter(n=>!existing.includes(n))];const from=ownerTasks.indexOf(src);if(from>=0)ownerTasks.splice(from,1);const to=ownerTasks.indexOf(tgt);const rect=el.getBoundingClientRect();ownerTasks.splice(e.clientY<rect.top+rect.height/2?to:to+1,0,src);sort[owner]=ownerTasks;localStorage.setItem(getTlTaskSortKey(),JSON.stringify(sort));saveNote('timeline_task_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(sort));tlTaskDragEnd();render()}
function toggleTlChildren(el){var row=el.closest('[data-task]');var wrapper=row.parentNode;var c=wrapper.querySelector('.tl-children');if(c){c.style.display=c.style.display==='none'?'block':'none';el.textContent=c.style.display==='none'?'▶':'▼';var name=row.dataset.task;if(!name||!unlocked)return;if(c.style.display==='none')_collapsedTimelineTasks.add(name);else _collapsedTimelineTasks.delete(name);localStorage.setItem(getTimelineTaskCollapseKey(),JSON.stringify([..._collapsedTimelineTasks]));saveNote('collapsed_timeline_tasks_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedTimelineTasks]))}}
let _timelineDragOwner=null;
function timelineDragStart(e,el){if(!unlocked){e.preventDefault();return}_timelineDragOwner=el.dataset.owner;e.dataTransfer.setData('text/tl-owner',_timelineDragOwner);el.closest('[style*="border-bottom"]').classList.add('dragging')}
function timelineDragEnd(){_timelineDragOwner=null;document.querySelectorAll('.dragging,.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('dragging','drag-over-top','drag-over-bottom'))}
function timelineDragOver(e,el){e.preventDefault();if(!_timelineDragOwner)return;const owner=el.querySelector('[data-owner]')?.dataset.owner;if(owner===_timelineDragOwner)return;document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));const rect=el.getBoundingClientRect();el.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom')}
function timelineDrop(e,el){e.preventDefault();document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));if(!_timelineDragOwner||!unlocked)return;const tgtOwner=el.querySelector('[data-owner]')?.dataset.owner;if(!tgtOwner||tgtOwner===_timelineDragOwner)return;const sort=JSON.parse(localStorage.getItem(getTimelineSortKey())||'[]');const container=el.closest('.timeline')?.querySelector('[style*="position:relative"]')||el.parentNode;const groups=[...container.querySelectorAll('[data-owner]')].map(s=>s.dataset.owner);const from=groups.indexOf(_timelineDragOwner);if(from>=0)groups.splice(from,1);const to=groups.indexOf(tgtOwner);const rect=el.getBoundingClientRect();groups.splice(e.clientY<rect.top+rect.height/2?to:to+1,0,_timelineDragOwner);localStorage.setItem(getTimelineSortKey(),JSON.stringify(groups));saveNote('timeline_sort_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(groups));timelineDragEnd();render();if(!document.getElementById('outsourceSection').classList.contains('hidden'))renderOutsourceFromCache()}
function toggleTimelineGroup(el){var d=el.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';el.querySelector('.tog').textContent=d.style.display==='none'?'▶':'▼';if(!unlocked)return;var owner=el.dataset.owner;if(d.style.display==='none')_collapsedTimelineOwners.add(owner);else _collapsedTimelineOwners.delete(owner);localStorage.setItem(getTimelineCollapseKey(),JSON.stringify([..._collapsedTimelineOwners]));saveNote('collapsed_timeline_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedTimelineOwners]))}
function toggleColumn(el,ev){var d=el.nextElementSibling;var collapsed=d.style.display!=='none';d.style.display=collapsed?'none':'block';el.querySelector('.tog').textContent=collapsed?'▶':'▼';if(ev&&ev.ctrlKey){var col=el.closest('.column');var status=col?.dataset.status||'';if(col){col.querySelectorAll('.owner-group').forEach(g=>{var gd=g.lastElementChild;gd.style.display=collapsed?'none':'block';g.querySelector('.owner-title .tog').textContent=collapsed?'▶':'▼';var owner=g.dataset.owner;var key=owner+'::'+status;if(collapsed)_collapsedOwners.add(key);else _collapsedOwners.delete(key)});if(unlocked){localStorage.setItem(getCollapsedOwnersKey(),JSON.stringify([..._collapsedOwners]));saveNote('collapsed_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedOwners]))}}}var status=el.closest('.column')?.dataset.status;if(status){var key='fzg_col_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);var list=JSON.parse(localStorage.getItem(key)||'[]');if(collapsed){if(!list.includes(status))list.push(status)}else{list=list.filter(s=>s!==status)}localStorage.setItem(key,JSON.stringify(list));saveNote('col_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(list))}}
function toggleOwnerGroup(el,ev){var g=el.closest('.owner-group');var d=g.lastElementChild;var collapsed=d.style.display!=='none';d.style.display=collapsed?'none':'block';el.querySelector('.tog').textContent=collapsed?'▶':'▼';if(ev&&ev.ctrlKey){d.querySelectorAll('.card-body').forEach(b=>{b.style.display=collapsed?'none':'block'});d.querySelectorAll('.card .card-buttons .name span:first-child').forEach(s=>{s.textContent=collapsed?'▶':'▼'});var key2='fzg_task_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1);var list2=JSON.parse(localStorage.getItem(key2)||'[]');d.querySelectorAll('.card[data-idx]').forEach(c=>{var idx=parseInt(c.dataset.idx);var name=tasks[idx]?.['任務名稱'];if(name){if(collapsed){if(!list2.includes(name))list2.push(name)}else{list2=list2.filter(n=>n!==name)}}});localStorage.setItem(key2,JSON.stringify(list2))}if(!unlocked)return;var owner=g.dataset.owner;var status=g.closest('.column')?.dataset.status||'';var key=owner+'::'+status;if(collapsed)_collapsedOwners.add(key);else _collapsedOwners.delete(key);localStorage.setItem(getCollapsedOwnersKey(),JSON.stringify([..._collapsedOwners]));saveNote('collapsed_owners_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify([..._collapsedOwners]))}
function moveOwnerGroup(owner,dir,e){
  e.stopPropagation();
  if(!unlocked)return;
  const col=e.target.closest('.column');
  const status=col.dataset.status;
  const ownerSort=JSON.parse(localStorage.getItem('fzg_owner_sort_'+status+'_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'{}');
  const groups=[...col.querySelectorAll('.owner-group')].map(g=>g.dataset.owner);
  const pos=groups.indexOf(owner);if(pos<0)return;
  const newPos=pos+dir;if(newPos<0||newPos>=groups.length)return;
  const swappedOwner=groups[newPos];
  groups.splice(pos,1);groups.splice(newPos,0,owner);
  groups.forEach((o,i)=>{ownerSort[o]=String(i+1)});
  localStorage.setItem('fzg_owner_sort_'+status+'_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(ownerSort));
  saveOwnerSort(status,groups);
  render();renderFilterBar();
  const moved=document.querySelector('#boardView .column[data-status="'+status+'"] .owner-group[data-owner="'+owner+'"]');if(moved){moved.classList.add('moved');setTimeout(()=>moved.classList.remove('moved'),600)}
  const swapped=document.querySelector('#boardView .column[data-status="'+status+'"] .owner-group[data-owner="'+swappedOwner+'"]');if(swapped){swapped.classList.add('swapped');setTimeout(()=>swapped.classList.remove('swapped'),600)}
}
function render(){renderStats();const bv=document.getElementById('boardView'),tv=document.getElementById('timelineView'),rv=document.getElementById('reportView');if(!bv.classList.contains('hidden'))renderBoard();if(!tv.classList.contains('hidden'))renderTimeline();if(!rv.classList.contains('hidden'))renderReport();renderFilterBar()}
function searchRender(){renderStats();const bv=document.getElementById('boardView'),tv=document.getElementById('timelineView'),rv=document.getElementById('reportView');if(!bv.classList.contains('hidden'))renderBoard();if(!tv.classList.contains('hidden'))renderTimeline();if(!rv.classList.contains('hidden'))renderReport()}
function renderStats(){
  const f=getFiltered(),total=f.length,done=f.filter(t=>t['狀態']==='已完成').length;
  document.getElementById('stats').innerHTML=`<div class="stat"><div class="num">${total}</div><div class="label">任務</div></div><div class="stat"><div class="num" style="color:var(--green)">${done}</div><div class="label">完成</div></div><div class="stat"><div class="num" style="color:var(--yellow)">${total-done}</div><div class="label">未完成</div></div>`;
}
function renderBoard(){
  const _taskCollapseList=JSON.parse(localStorage.getItem('fzg_task_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'[]');
  // Collapse states now stored in _collapsedOwners with owner::status keys
  const filtered=getFiltered();
  const unassigned=_showUnmodified?_unmodifiedTasks:[];
  const unHtml=unassigned.length?`<div style="margin-bottom:8px"><div onclick="toggleColumn(this,event)" style="color:var(--red);padding:4px 0;border-bottom:1px solid var(--red);margin-bottom:4px;cursor:pointer"><span class="tog">▶</span> ⚠️ 有 ${unassigned.length} 筆任務資訊不全</div><div style="display:none">${unassigned.map(t=>{const idx=tasks.indexOf(t);return `<div class="card" style="display:flex;align-items:center;gap:8px"><span>${t['任務名稱']}</span><span class="edit-ctrl" style="margin-left:auto;display:flex;gap:4px"><span onclick="openModal(${idx})" style="cursor:pointer">✏️</span><span onclick="deleteTask(${idx})" style="cursor:pointer;color:var(--red)">🗑️</span></span></div>`}).join('')}</div></div>`:'';
  if(!filtered.length){document.getElementById('boardView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">本月無任務</div>';return}
  const parentTasks=filtered.filter(t=>!t['父任務']||!filtered.find(p=>p['任務名稱']===t['父任務']));
  const getChildren=name=>filtered.filter(t=>t['父任務']===name);
  const sortFn=(a,b)=>(parseInt(a['排序'])||999)-(parseInt(b['排序'])||999);
  const todo=parentTasks.filter(t=>t['狀態']==='待辦'&&t['負責人']).sort(sortFn);
  const doing=parentTasks.filter(t=>t['狀態']==='進行中'&&t['負責人']).sort(sortFn);
  const done=parentTasks.filter(t=>t['狀態']==='已完成'&&t['負責人']).sort(sortFn);
  const getLevel=(t)=>{if(!t['父任務'])return 0;const p=tasks.find(x=>x['任務名稱']===t['父任務']);if(!p)return 0;if(!p['父任務'])return 1;const gp=tasks.find(x=>x['任務名稱']===p['父任務']);if(!gp)return 1;return 2};
  const cardHtml=(items)=>items.map(t=>{
    const idx=tasks.indexOf(t);
    const pClass=t['優先級']==='高'||t['優先級']==='緊急'?'p-high':t['優先級']==='中'?'p-mid':t['優先級']==='低'?'p-low':'';
    const children=getChildren(t['任務名稱']);
    const childDone=children.filter(c=>c['狀態']==='已完成').length;
    const tags=(t['標籤']||'').split(',').filter(Boolean);
    const level=getLevel(t);
    const canAddSub=level<2;
    const _dbg=getDeadlineBg(t);
    return `<div class="card" data-idx="${idx}" ondragover="taskDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="taskDrop(event,${idx},this)" style="${_dbg}">
      <div class="card-buttons"><div class="name" draggable="true" ondragstart="event.stopPropagation();taskDragStart(event,${idx})" ondragend="taskDragEnd()" onclick="event.stopPropagation();toggleCollapse(${idx},this)" style="cursor:grab;flex:1"><span style="font-size:0.7em;margin-right:4px">${_taskCollapseList.includes(t['任務名稱'])?'▶':'▼'}</span>${pClass?'<span class="priority-dot '+pClass+'"></span>':''}${t['任務名稱']}</div><span class="edit-ctrl card-btn" onclick="event.stopPropagation();openModal(${idx})" style="background:#4caf50">編輯</span>${canAddSub?`<span class="edit-ctrl card-btn" onclick="event.stopPropagation();openModalWithParent('${t['任務名稱'].replace(/'/g,"\\'")}')" style="background:var(--accent)">+子任務</span>`:''}<span class="edit-ctrl card-btn" onclick="quickDelete(${idx},event)" style="background:var(--red)">✕</span></div>
      <div class="card-body"${_taskCollapseList.includes(t['任務名稱'])?' style="display:none"':''}>
      <div class="meta" style="flex-wrap:nowrap;gap:6px"><span onclick="inlineEdit(${idx},'負責人',event)" style="color:var(--green);cursor:pointer;white-space:nowrap">${t['負責人']||'未指派'}</span>${tags.length?'<span style="display:inline-flex;gap:3px;flex:1;overflow:hidden">'+tags.map(tg=>'<span class="tag-pill" onclick="inlineEdit('+idx+',\'標籤\',event)" style="cursor:pointer">'+tg.trim()+'</span>').join('')+'</span>':'<span style="flex:1"></span>'}<span onclick="inlineEdit(${idx},'日期',event)" style="cursor:pointer;white-space:nowrap;color:${getDeadlineColor(t)||'var(--accent)'}">${t['開始日']?t['開始日'].substring(0,10):''}${t['開始日']||t['截止日']?' ~ ':''}${t['截止日']?t['截止日'].substring(0,10):''}</span></div>
      ${t['評論']?'<div style="font-size:0.75rem;color:var(--muted);margin-top:3px;font-style:italic">💬 '+t['評論'].substring(0,50)+(t['評論'].length>50?'...':'')+'</div>':''}
      ${children.length?'<div class="subtasks" onclick="toggleSub(this,event)" style="cursor:pointer"><span style="font-size:0.75rem">'+(JSON.parse(localStorage.getItem('fzg_sub_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'[]').includes(t['任務名稱'])?'▶':'▼')+'</span> 子任務：'+childDone+'/'+children.length+'<div style="margin-top:4px'+(JSON.parse(localStorage.getItem('fzg_sub_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'[]').includes(t['任務名稱'])?';display:none':'')+'">'+children.map(c=>{
        const ci=tasks.indexOf(c);const cpClass=c['優先級']==='高'||c['優先級']==='緊急'?'p-high':c['優先級']==='中'?'p-mid':c['優先級']==='低'?'p-low':'';
        const grandChildren=getChildren(c['任務名稱']);const gcDone=grandChildren.filter(g=>g['狀態']==='已完成').length;
        const cLevel=getLevel(c);const cCanAddSub=cLevel<2;const _cdbg=getDeadlineBg(c);
        return `<div style="border:1px solid var(--border);border-radius:6px;margin-bottom:4px;${_cdbg||'background:var(--surface)'};padding:6px 8px;transition:border-color .2s" onmouseover="this.style.outline='2px solid var(--accent)';this.style.outlineOffset='-2px'" onmouseout="this.style.outline='none'">
          <div onclick="event.stopPropagation();openModal(${ci})" style="display:flex;align-items:center;gap:4px;font-size:0.875rem;cursor:pointer">
            <span onclick="toggleStatus(${ci},event)" style="cursor:pointer;color:${c['狀態']==='已完成'?'var(--green)':c['狀態']==='進行中'?'var(--yellow)':'var(--muted)'}">${c['狀態']==='已完成'?'✅':c['狀態']==='進行中'?'🔄':'⬜'}</span>
            ${cpClass?'<span class="priority-dot '+cpClass+'"></span>':''}
            <span onclick="event.stopPropagation();openModal(${ci})" style="flex:1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c['任務名稱']}">${c['任務名稱']}</span>
            <span onclick="inlineEdit(${ci},'負責人',event)" style="color:var(--green);font-size:0.875rem;cursor:pointer;margin-right:4px">${c['負責人']||'未指派'}</span>
            <span onclick="inlineEdit(${ci},'日期',event)" style="color:${getDeadlineColor(c)||'var(--accent)'};font-size:0.9em;cursor:pointer">${c['開始日']?c['開始日'].substring(5,10):''}${c['開始日']||c['截止日']?'~':''}${c['截止日']?c['截止日'].substring(5,10):''}</span>
            ${cCanAddSub?`<span class="edit-ctrl" onclick="event.stopPropagation();openModalWithParent('${c['任務名稱'].replace(/'/g,"\\'")}')" style="font-size:0.85em;background:var(--accent);color:#fff;border-radius:3px;padding:1px 4px;cursor:pointer;margin-left:4px">+</span>`:''}
            <span class="edit-ctrl" onclick="quickDelete(${ci},event)" style="cursor:pointer;font-size:0.75rem;background:var(--red);color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px">✕</span>
          </div>
          ${grandChildren.length?'<div style="margin-top:4px;padding-left:12px">'+grandChildren.map(g=>{
            const gi=tasks.indexOf(g);const gpClass=g['優先級']==='高'||g['優先級']==='緊急'?'p-high':g['優先級']==='中'?'p-mid':g['優先級']==='低'?'p-low':'';const _gdbg=getDeadlineBg(g);
            return `<div onclick="event.stopPropagation();openModal(${gi})" style="display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:0.875rem;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-bottom:3px;${_gdbg||'background:var(--bg)'};transition:border-color .2s" onmouseover="this.style.outline='2px solid var(--accent)';this.style.outlineOffset='-2px'" onmouseout="this.style.outline='none'">
              <span onclick="toggleStatus(${gi},event)" style="cursor:pointer;color:${g['狀態']==='已完成'?'var(--green)':g['狀態']==='進行中'?'var(--yellow)':'var(--muted)'}">${g['狀態']==='已完成'?'✅':g['狀態']==='進行中'?'🔄':'⬜'}</span>
              ${gpClass?'<span class="priority-dot '+gpClass+'"></span>':''}
              <span style="flex:1">${g['任務名稱']}</span>
              <span onclick="inlineEdit(${gi},'負責人',event)" style="color:var(--green);font-size:0.875rem;cursor:pointer;margin-right:4px">${g['負責人']||'未指派'}</span>
              <span onclick="inlineEdit(${gi},'日期',event)" style="color:${getDeadlineColor(g)||'var(--accent)'};cursor:pointer">${g['開始日']?g['開始日'].substring(5,10):''}${g['開始日']||g['截止日']?'~':''}${g['截止日']?g['截止日'].substring(5,10):''}</span>
              
              <span class="edit-ctrl" onclick="quickDelete(${gi},event)" style="cursor:pointer;font-size:0.75rem;background:var(--red);color:#fff;border-radius:3px;padding:1px 4px;margin-left:4px">✕</span>
            </div>`}).join('')+'</div>':''}
        </div>`}).join('')+'</div></div>':''}
    </div></div>`}).join('');
  const groupByOwner=(items,status)=>{
    const groups={};
    items.forEach(t=>{const owners=(t['負責人']||'未指派').split(',').map(s=>s.trim()).filter(Boolean);if(!owners.length)owners.push('未指派');owners.forEach(o=>{if(!groups[o])groups[o]=[];groups[o].push(t)})});
    const ownerSort=JSON.parse(localStorage.getItem('fzg_owner_sort_'+status+'_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'{}');
    return Object.entries(groups).sort((a,b)=>{if(a[0]===_lastMovedOwner)return -1;if(b[0]===_lastMovedOwner)return 1;return(parseInt(ownerSort[a[0]])||999)-(parseInt(ownerSort[b[0]])||999)}).map(([owner,list])=>`<div class="owner-group" data-owner="${owner}" ondragover="ownerGroupOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="ownerGroupDrop(event,this)" style="margin-bottom:8px"><div class="owner-title" draggable="true" ondragstart="ownerDragStart(event,this.closest('.owner-group'))" ondragend="ownerDragEnd()" onclick="toggleOwnerGroup(this,event)" style="display:flex;align-items:center;color:var(--accent);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:pointer"><span class="tog">▼</span> 👤 ${owner} (${list.length})<span class="edit-ctrl" style="margin-left:auto;display:flex;gap:2px;flex-shrink:0"><span onclick="moveOwnerGroup('${owner.replace(/'/g,"\\'")}', -1, event)" style="cursor:pointer;padding:0 4px">▲</span><span onclick="moveOwnerGroup('${owner.replace(/'/g,"\\'")}', 1, event)" style="cursor:pointer;padding:0 4px">▼</span></span></div><div>${cardHtml(list)}</div></div>`).join('');
  };
  document.getElementById('boardWarn').innerHTML='';
  const unCol=unHtml?`<div class="column" style="border-color:var(--red)"><h3 onclick="toggleColumn(this,event)" style="color:var(--red);cursor:pointer"><span class="tog">${_showUnmodified?'▶':'▼'}</span> ⚠️ 待修正 (${unassigned.length})</h3><div${_showUnmodified?' style="display:none"':''}>${unassigned.map(t=>{const idx=tasks.indexOf(t);return `<div class="card" style="display:flex;align-items:center;gap:8px"><span>${t['任務名稱']}</span><span class="edit-ctrl" style="margin-left:auto;display:flex;gap:4px"><span onclick="openModal(${idx})" style="cursor:pointer">✏️</span><span onclick="deleteTask(${idx})" style="cursor:pointer;color:var(--red)">🗑️</span></span></div>`}).join('')}</div></div>`:'';
  document.getElementById('boardView').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:12px">${unCol}<div class="column" data-status="待辦" ondragover="event.preventDefault();if(_taskDragIdx!==null||_dragOwner)this.style.outline='2px dashed var(--accent)'" ondragleave="this.style.outline=''" ondrop="this.style.outline='';colTaskDrop(event,'待辦')"><h3 onclick="toggleColumn(this,event)" style="color:var(--muted);cursor:pointer"><span class="tog">▼</span> 📝 待辦 (${todo.length})</h3><div>${todo.length?groupByOwner(todo,'待辦'):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div></div>
    <div class="column" data-status="進行中" ondragover="event.preventDefault();if(_taskDragIdx!==null||_dragOwner)this.style.outline='2px dashed var(--accent)'" ondragleave="this.style.outline=''" ondrop="this.style.outline='';colTaskDrop(event,'進行中')"><h3 onclick="toggleColumn(this,event)" style="color:var(--yellow);cursor:pointer"><span class="tog">▼</span> 🔄 進行中 (${doing.length})</h3><div>${doing.length?groupByOwner(doing,'進行中'):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div>
    <div class="column" data-status="已完成" ondragover="event.preventDefault();if(_taskDragIdx!==null||_dragOwner)this.style.outline='2px dashed var(--accent)'" ondragleave="this.style.outline=''" ondrop="this.style.outline='';colTaskDrop(event,'已完成')"><h3 onclick="toggleColumn(this,event)" style="color:var(--green);cursor:pointer"><span class="tog">▼</span> ✅ 已完成 (${done.length})</h3><div>${done.length?groupByOwner(done,'已完成'):'<div style="text-align:center;color:var(--muted);padding:20px">無任務</div>'}</div></div>`;
  // Restore owner-group collapse states (per column)
  document.querySelectorAll('#boardView .column[data-status]').forEach(col=>{const status=col.dataset.status;col.querySelectorAll('.owner-group').forEach(g=>{const owner=g.dataset.owner;const key=owner+'::'+status;if(_collapsedOwners.has(key)){g.lastElementChild.style.display='none';const tog=g.querySelector('.tog');if(tog)tog.textContent='▶'}})});
  // Auto-collapse empty columns + restore saved column collapse
  const _colCollapse=JSON.parse(localStorage.getItem('fzg_col_collapse_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'[]');
  document.querySelectorAll('#boardView .column[data-status]').forEach(col=>{const h3=col.querySelector('h3');const content=h3?.nextElementSibling;if(content&&(col.querySelector('.owner-group')===null||_colCollapse.includes(col.dataset.status))){content.style.display='none';const tog=h3.querySelector('.tog');if(tog)tog.textContent='▶'}});
  _lastMovedOwner=null;
}
let dragIdx=null;
let _dragOwner=null;
let _dragOwnerSrcStatus=null;
let _lastMovedOwner=null;
let _taskDragIdx=null;
function taskDragStart(e,idx){if(!unlocked){e.preventDefault();return}_taskDragIdx=idx;e.dataTransfer.setData('text/task',String(idx));e.dataTransfer.effectAllowed='move';e.target.closest('.card').classList.add('dragging');document.querySelectorAll('#boardView .column[data-status]').forEach(col=>{const h3=col.querySelector('h3');const content=h3?.nextElementSibling;if(content&&content.style.display==='none'){content.style.display='';const tog=h3.querySelector('.tog');if(tog)tog.textContent='▼'}})}
function taskDragEnd(){_taskDragIdx=null;document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(el=>el.classList.remove('drag-over-top','drag-over-bottom'));document.querySelectorAll('.column').forEach(c=>c.style.outline='');document.querySelectorAll('#boardView .column[data-status]').forEach(col=>{const h3=col.querySelector('h3');const content=h3?.nextElementSibling;if(content&&col.querySelector('.owner-group')===null){content.style.display='none';const tog=h3.querySelector('.tog');if(tog)tog.textContent='▶'}})}
function colTaskDrop(e,status){
  if(_taskDragIdx!==null){
    e.preventDefault();
    const src=tasks[_taskDragIdx];
    if(src['狀態']!==status){src['狀態']=status;setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:_taskDragIdx,name:src['任務名稱'],owner:src['負責人'],status:status,progress:'',startDate:src['開始日'],dueDate:src['截止日'],note:src['備註'],priority:src['優先級'],tags:src['標籤'],parent:src['父任務'],hours:src['工時'],comment:src['評論']}),})}
    taskDragEnd();render();renderFilterBar();
  }
}
function taskDragOver(e,el){e.preventDefault();if(_taskDragIdx===null)return;const card=el.closest('.card');if(!card||parseInt(card.dataset.idx)===_taskDragIdx)return;document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));const rect=card.getBoundingClientRect();card.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom');const col=card.closest('.column');if(col)col.style.outline='2px dashed var(--accent)'}
function taskDrop(e,targetIdx,el){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(x=>x.classList.remove('drag-over-top','drag-over-bottom'));
  if(!unlocked||_taskDragIdx===null||_taskDragIdx===targetIdx)return;
  const src=tasks[_taskDragIdx],tgt=tasks[targetIdx];
  const targetStatus=tgt['狀態'];
  // Cross-column: change status (only parent task, not children)
  if(src['狀態']!==targetStatus){
    src['狀態']=targetStatus;
    setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:_taskDragIdx,name:src['任務名稱'],owner:src['負責人'],status:targetStatus,progress:'',startDate:src['開始日'],dueDate:src['截止日'],note:src['備註'],priority:src['優先級'],tags:src['標籤'],parent:src['父任務'],hours:src['工時'],comment:src['評論']}),});
  }
  // Sort within target status
  const rect=el.getBoundingClientRect();const above=e.clientY<rect.top+rect.height/2;
  const sameStatus=filterByMonth(tasks).filter(x=>x['狀態']===targetStatus&&!x['父任務']).sort((a,b)=>(parseInt(a['排序'])||999)-(parseInt(b['排序'])||999));
  const fromPos=sameStatus.indexOf(src);if(fromPos>=0)sameStatus.splice(fromPos,1);
  const toPos=sameStatus.indexOf(tgt);
  sameStatus.splice(above?toPos:toPos+1,0,src);
  sameStatus.forEach((item,i)=>{item['排序']=String(i+1);const idx=tasks.indexOf(item);setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'updateSort',row:idx,sort:i+1}),})});
  taskDragEnd();render();renderFilterBar();
}
function ownerDragStart(e,el){
  if(!unlocked){e.preventDefault();return}
  _dragOwner=el.dataset.owner;
  e.dataTransfer.setData('text/owner',_dragOwner);
  el.classList.add('dragging');
  const srcCol=el.closest('.column');
  _dragOwnerSrcStatus=srcCol.dataset.status;
  document.querySelectorAll('#boardView .column').forEach(col=>{
    if(col===srcCol)return;
    const content=col.querySelector(':scope>div');
    if(content){content.dataset.origDisplay=content.style.display||'';content.style.display='none'}
    const dz=document.createElement('div');dz.className='drop-zone';dz.dataset.status=col.dataset.status;
    dz.ondragover=ev=>ev.preventDefault();
    dz.ondrop=ev=>{ev.preventDefault();ownerDropZone(ev,col.dataset.status)};
    col.appendChild(dz);
  });
}
function ownerDragEnd(){
  _dragOwner=null;_dragOwnerSrcStatus=null;
  document.querySelectorAll('.dragging').forEach(e=>e.classList.remove('dragging'));
  document.querySelectorAll('.drop-zone').forEach(dz=>dz.remove());
  document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'));
  document.querySelectorAll('.column').forEach(c=>c.style.outline='');
  document.querySelectorAll('#boardView .column>div[data-orig-display]').forEach(d=>{d.style.display=d.dataset.origDisplay||'';delete d.dataset.origDisplay});
}
function ownerGroupOver(e,el){e.preventDefault()}
function ownerGroupDrop(e,el){e.preventDefault();e.stopPropagation()}
function ownerDropZone(e,targetStatus){
  if(!_dragOwner)return;
  const owner=_dragOwner;
  const filtered=filterByMonth(tasks);
  filtered.filter(t=>(t['負責人']||'未指派')===owner&&!t['父任務']&&t['狀態']===_dragOwnerSrcStatus).forEach(t=>{
    t['狀態']=targetStatus;const idx=tasks.indexOf(t);
    setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:targetStatus,progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']}),});
  });
  const ownerSort=JSON.parse(localStorage.getItem('fzg_owner_sort_'+targetStatus)||'{}');
  // Get all owners that will be in target status after this move
  const targetOwners=[...new Set(tasks.filter(t=>t['狀態']===targetStatus&&!t['父任務']).map(t=>t['負責人']||'未指派'))];
  if(!targetOwners.includes(owner))targetOwners.unshift(owner);else{targetOwners.splice(targetOwners.indexOf(owner),1);targetOwners.unshift(owner)}
  targetOwners.forEach((o,i)=>{ownerSort[o]=String(i+1)});
  localStorage.setItem('fzg_owner_sort_'+targetStatus+'_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),JSON.stringify(ownerSort));
  saveOwnerSort(targetStatus,targetOwners);
  _lastMovedOwner=owner;
  ownerDragEnd();render();renderFilterBar();
}
function cardDragOver(e,el){e.preventDefault();if(el.classList.contains('dragging'))return;var target=el;if(document.querySelector('.owner-group.dragging')&&!el.classList.contains('owner-group')){target=el.closest('.owner-group');if(!target||target.classList.contains('dragging'))return}document.querySelectorAll('.drag-over-top,.drag-over-bottom').forEach(e=>e.classList.remove('drag-over-top','drag-over-bottom'));const rect=target.getBoundingClientRect();target.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-top':'drag-over-bottom')}
function drag(e,idx){if(!unlocked){e.preventDefault();return}dragIdx=idx;e.dataTransfer.effectAllowed='move'}
function renderTimeline(){
  loadTimelineCollapse();
  const filtered=getFiltered();
  if(!filtered.length){document.getElementById('timelineView').innerHTML='<div style="text-align:center;color:var(--muted);padding:40px">本月無任務</div>';return}
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
  const days=new Date(y,m+1,0).getDate();
  const weekdays=['日','一','二','三','四','五','六'];
  let h='<div style="position:relative"><div style="display:flex;border-bottom:2px solid rgba(88,166,255,0.4);padding:4px 0;margin-bottom:6px"><div style="width:200px;flex-shrink:0"></div><div style="flex:1;display:flex;position:relative">';
  const today=new Date();const isThisMonth=today.getFullYear()===y&&today.getMonth()===m;
  for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();const wd=weekdays[dow];const isToday=isThisMonth&&d===today.getDate();const isWeekend=dow===0||dow===6;h+=`<div style="flex:1;text-align:center;font-size:0.75rem;color:${isToday?'var(--red)':'var(--muted)'};font-weight:${isToday?'bold':'normal'};${isWeekend?'background:rgba(56,139,253,0.12);border-radius:2px':''}">${d}<br>${wd}</div>`}
  h+='</div></div>';

  const groups={};filtered.filter(t=>t['負責人']).forEach(t=>{(t['負責人']||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(o=>{if(!groups[o])groups[o]=[];groups[o].push(t)})});
  const tlSort=JSON.parse(localStorage.getItem(getTimelineSortKey())||'[]');
  Object.entries(groups).sort((a,b)=>{const ai=tlSort.indexOf(a[0]),bi=tlSort.indexOf(b[0]);return(ai<0?999:ai)-(bi<0?999:bi)}).forEach(([owner,items])=>{
    h+=`<div style="border-bottom:2px solid rgba(88,166,255,0.4);padding:4px 0" ondragover="timelineDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="timelineDrop(event,this)"><span data-owner="${owner}" draggable="true" ondragstart="timelineDragStart(event,this)" ondragend="timelineDragEnd()" onclick="toggleTimelineGroup(this)" style="cursor:grab;font-size:1rem;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="tog">${_collapsedTimelineOwners.has(owner)?'▶':'▼'}</span>&nbsp;👤 ${owner} (${items.length})</span><div${_collapsedTimelineOwners.has(owner)?' style="display:none"':''}>`;
    const parents=items.filter(t=>!t['父任務']||!items.find(p=>p['任務名稱']===t['父任務']));
    const tlTaskSort=JSON.parse(localStorage.getItem(getTlTaskSortKey())||'{}');
    const ownerTaskOrder=tlTaskSort[owner]||[];
    parents.sort((a,b)=>{const ai=ownerTaskOrder.indexOf(a['任務名稱']),bi=ownerTaskOrder.indexOf(b['任務名稱']);return(ai<0?999:ai)-(bi<0?999:bi)});
    const renderGanttRow=(t,level,hasChildren,collapsed)=>{
      const startStr=(t['開始日']||'').substring(0,10);const endStr=(t['截止日']||'').substring(0,10);
      const _dp=d=>{if(!d)return null;const sep=d.includes('-')?'-':'/';const p=d.split(sep).map(Number);return p.length>=3?p:null};
      let sd=1,ed=days;
      if(startStr){const p=_dp(startStr);if(p){const py=p[0],pm=startStr.includes('-')?p[1]-1:p[1]-1,pd=p[2];if(py===y&&pm===m)sd=pd;else if(py>y||(py===y&&pm>m))sd=days+1;else sd=1}}
      if(endStr){const p=_dp(endStr);if(p){const py=p[0],pm=endStr.includes('-')?p[1]-1:p[1]-1,pd=p[2];if(py===y&&pm===m)ed=pd;else if(py<y||(py===y&&pm<m))ed=0;else ed=days}}else{ed=sd}
      if(sd>days||ed<1)return;sd=Math.max(1,sd);ed=Math.min(days,ed);
      const hasKids=tasks.some(c=>c['父任務']===t['任務名稱']);
      const color=t['狀態']==='已完成'?(hasKids?'var(--accent)':'var(--green)'):t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
      const l=((sd-1)/days*100).toFixed(1),w=((ed-sd+1)/days*100).toFixed(1);
      const pClass=t['優先級']==='高'||t['優先級']==='緊急'?'p-high':t['優先級']==='中'?'p-mid':'';
      const pl=level===0?12:level===1?24:36;const _ti=tasks.indexOf(t);
      h+=`<div data-task="${t['任務名稱'].replace(/"/g,'&quot;')}"${hasChildren?' data-has-kids':''} ${level===0?'draggable="true" ondragstart="tlTaskDragStart(event,this)" ondragend="tlTaskDragEnd()" ondragover="tlTaskDragOver(event,this)" ondragleave="this.classList.remove(\'drag-over-top\',\'drag-over-bottom\')" ondrop="tlTaskDrop(event,this)"':''} onclick="ganttRowClick(this,'${t['任務名稱'].replace(/'/g,"\\'")}')" style="display:flex;align-items:center;padding:2px 0;cursor:${level===0?'grab':'pointer'}"><div style="width:200px;flex-shrink:0;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:${pl}px;${level?'color:var(--yellow)':''}">${level===0?(hasChildren?'<span onclick="event.stopPropagation();toggleTlChildren(this)" style="display:inline-block;width:16px;text-align:center;cursor:pointer">'+(collapsed?'▶':'▼')+'</span>':'<span style="display:inline-block;width:16px"></span>'):''}${level?'└ ':''}${pClass?'<span class="priority-dot '+pClass+'"></span>':''}${t['任務名稱']}</div><div class="gantt-track" style="flex:1;position:relative;height:${level?'12':'16'}px;background:var(--bg);border-radius:3px"><div class="gantt-bar" data-idx="${_ti}" style="position:absolute;left:${l}%;width:${w}%;height:100%;background:${color};border-radius:3px;opacity:0.8;cursor:default"><div class="gantt-handle gantt-handle-l" data-idx="${_ti}" data-side="l" style="position:absolute;left:0;top:0;width:6px;height:100%;cursor:ew-resize;border-radius:3px 0 0 3px"></div><div class="gantt-handle gantt-handle-r" data-idx="${_ti}" data-side="r" style="position:absolute;right:0;top:0;width:6px;height:100%;cursor:ew-resize;border-radius:0 3px 3px 0"></div></div></div></div>`;
    };
    parents.forEach(t=>{
      const children=items.filter(c=>c['父任務']===t['任務名稱']);
      if(children.length){
        const taskCollapsed=_collapsedTimelineTasks.has(t['任務名稱']);
        // Calculate group date range
        const allGroup=[t,...children,...children.flatMap(c=>items.filter(g=>g['父任務']===c['任務名稱']))];
        let gsd=days+1,ged=0;
        allGroup.forEach(g=>{const s=(g['開始日']||'').substring(0,10),e=(g['截止日']||'').substring(0,10);if(s){const sep=s.includes('-')?'-':'/';const p=s.split(sep).map(Number);if(p[0]===y&&p[1]-1===m)gsd=Math.min(gsd,p[2]);else if(p[0]<y||(p[0]===y&&p[1]-1<m))gsd=1}if(e){const sep=e.includes('-')?'-':'/';const p=e.split(sep).map(Number);if(p[0]===y&&p[1]-1===m)ged=Math.max(ged,p[2]);else if(p[0]>y||(p[0]===y&&p[1]-1>m))ged=days}});
        if(gsd>days||ged<1){gsd=1;ged=days}
        const gl=((gsd-1)/days*100).toFixed(1),gw=((ged-gsd+1)/days*100).toFixed(1);
        const rowCount=1+children.length+children.reduce((s,c)=>s+items.filter(g=>g['父任務']===c['任務名稱']).length,0);
        h+=`<div style="position:relative;margin-bottom:3px;padding:2px 0">`;renderGanttRow(t,0,true,taskCollapsed);h+=`<div class="tl-children"${taskCollapsed?' style="display:none"':''}>`;
        children.forEach(c=>{const gc=items.filter(g=>g['父任務']===c['任務名稱']);if(gc.length){let csd=days+1,ced=0;[c,...gc].forEach(g=>{const s=(g['開始日']||'').substring(0,10),e=(g['截止日']||'').substring(0,10);if(s){const p=s.split('-');if(+p[0]===y&&+p[1]-1===m)csd=Math.min(csd,+p[2]);else if(+p[0]<y||(+p[0]===y&&+p[1]-1<m))csd=1}if(e){const p=e.split('-');if(+p[0]===y&&+p[1]-1===m)ced=Math.max(ced,+p[2]);else if(+p[0]>y||(+p[0]===y&&+p[1]-1>m))ced=days}});if(csd>days||ced<1){csd=1;ced=days}const cl=((csd-1)/days*100).toFixed(1),cw=((ced-csd+1)/days*100).toFixed(1);h+=`<div style="position:relative;margin:2px 0;padding:1px 0">`;renderGanttRow(c,1,false);gc.forEach(g=>renderGanttRow(g,2,false));h+=`<div style="position:absolute;top:0;bottom:0;left:calc(200px + (100% - 200px) * ${cl} / 100 - 2px);width:calc((100% - 200px) * ${cw} / 100 + 4px);border:1px solid var(--border);border-radius:4px;pointer-events:none;z-index:1;background:rgba(100,200,100,0.15)"></div></div>`}else{renderGanttRow(c,1,false)}});
        h+=`</div><div style="position:absolute;top:0;bottom:0;left:calc(200px + (100% - 200px) * ${gl} / 100 - 6px);width:calc((100% - 200px) * ${gw} / 100 + 12px);border:1px solid var(--border);border-radius:4px;pointer-events:none;z-index:0;background:rgba(88,166,255,0.15)"></div></div>`;
      }else{renderGanttRow(t,0,false)}
    });
    items.filter(t=>t['父任務']&&!parents.find(p=>p['任務名稱']===t['父任務'])&&!items.find(s=>s['任務名稱']===t['父任務'])).forEach(t=>renderGanttRow(t,0,false));
    h+=`</div></div>`;
  });
  for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();if(dow===0||dow===6){const pos=((d-1)/days*100).toFixed(1);h+=`<div style="position:absolute;top:40px;bottom:0;left:calc(200px + (100% - 200px) * ${pos} / 100);width:calc((100% - 200px) / ${days});background:rgba(56,139,253,0.1);pointer-events:none"></div>`}}
  if(isThisMonth){const todayPos=((today.getDate()-0.5)/days*100).toFixed(1);h+=`<div style="position:absolute;top:40px;bottom:0;left:calc(200px + (100% - 200px) * ${todayPos} / 100);width:2px;background:var(--red);z-index:10;pointer-events:none;opacity:0.7"></div>`}
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
      const onMove=ev=>{const x=Math.max(0,Math.min(trackW,ev.clientX-trackRect.left));const day=Math.max(1,Math.min(days,Math.round(x/trackW*days)+1));const t=tasks[idx];const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(side==='l'){const ed=_normDate(t['截止日']||'')||dateStr;if(dateStr<=ed)t['開始日']=dateStr}else{const sd=_normDate(t['開始日']||'')||dateStr;if(dateStr>=sd)t['截止日']=dateStr}render()};
      const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);const t=tasks[idx];_savePendingEdit(t);if(t['父任務']){const parent=tasks.find(p=>p['任務名稱']===t['父任務']);if(parent){let pc=false;if(t['開始日']&&(!parent['開始日']||t['開始日']<parent['開始日'])){parent['開始日']=t['開始日'];pc=true}if(t['截止日']&&(!parent['截止日']||t['截止日']>parent['截止日'])){parent['截止日']=t['截止日'];pc=true}if(pc){_savePendingEdit(parent);const pi=tasks.indexOf(parent);fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:pi,name:parent['任務名稱'],owner:parent['負責人'],status:parent['狀態'],progress:'',startDate:parent['開始日'],dueDate:parent['截止日'],note:parent['備註'],priority:parent['優先級'],tags:parent['標籤'],parent:parent['父任務'],hours:parent['工時'],comment:parent['評論']})})}}}const _ch=tasks.filter(c=>c['父任務']===t['任務名稱']);_ch.forEach(c=>{let cc=false;if(t['開始日']&&c['開始日']&&c['開始日']<t['開始日']){c['開始日']=t['開始日'];cc=true}if(t['截止日']&&c['截止日']&&c['截止日']>t['截止日']){c['截止日']=t['截止日'];cc=true}if(c['開始日']&&c['截止日']&&c['開始日']>=c['截止日']){c['截止日']=c['開始日'];cc=true}if(cc){_savePendingEdit(c);const ci=tasks.indexOf(c);fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:ci,name:c['任務名稱'],owner:c['負責人'],status:c['狀態'],progress:'',startDate:c['開始日'],dueDate:c['截止日'],note:c['備註'],priority:c['優先級'],tags:c['標籤'],parent:c['父任務'],hours:c['工時'],comment:c['評論']})})}});setSyncStatus('🔄 同步中...','var(--yellow)');fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'update',row:idx,name:t['任務名稱'],owner:t['負責人'],status:t['狀態'],progress:'',startDate:t['開始日'],dueDate:t['截止日'],note:t['備註'],priority:t['優先級'],tags:t['標籤'],parent:t['父任務'],hours:t['工時'],comment:t['評論']})});render()};
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
  const hourMap={};filtered.filter(t=>!filtered.some(c=>c['父任務']===t['任務名稱'])).forEach(t=>{const o=t['負責人']||'未指派';let days=0;if(t['開始日']&&t['截止日']){const s=new Date(t['開始日'].substring(0,10)),e=new Date(t['截止日'].substring(0,10));days=Math.max(1,Math.round((e-s)/(1000*60*60*24))+1)}else if(t['開始日']||t['截止日']){days=1}if(!hourMap[o])hourMap[o]=0;hourMap[o]+=days});
  const totalDays=Object.values(hourMap).reduce((s,v)=>s+v,0);
  if(totalDays>0){html+=`<div class="report-section"><h3>📅 工作天數統計（本月共 ${totalDays} 天）</h3>`;Object.entries(hourMap).filter(([,h])=>h>0).sort((a,b)=>b[1]-a[1]).forEach(([n,h])=>{html+=`<p style="margin-bottom:4px">• <strong>${n}</strong>：${h} 天（${Math.round(h/totalDays*100)}%）</p>`});html+=`</div>`}
  if(overdue.length)html+=`<div class="report-section"><h3>⚠️ 逾期任務</h3>${overdue.map(t=>`<p class="overdue">• ${t['任務名稱']}（截止：${t['截止日']}）</p>`).join('')}</div>`;
  document.getElementById('reportView').innerHTML=html;
}
const OUTSOURCE_SHEET_ID=CONFIG.outsourceSheetId;
const OUTSOURCE_SCRIPT_URL=CONFIG.outsourceScriptUrl;
let outsourceTasks=[],outsourceMode='list',outsourceZones={},outsourceFetchError=false;
function _getTaskId(t){return(t['負責人']||'')+'_'+(t['工作項目']||'')+'_'+(t['開始日']||'')}
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
    // Verify data belongs to requested month (gviz returns first tab if requested tab doesn't exist)
    const monthPrefix=currentMonth.getFullYear()+'/'+(currentMonth.getMonth()+1);
    const hasCorrectMonth=items.length===0||items.some(t=>(t['開始日']||'').startsWith(monthPrefix));
    if(!hasCorrectMonth){outsourceTasks=[];return}
    // Group similar tasks (no merge, keep all items)
    const normalize=s=>(s||'').replace(/[\d\s+]/g,'').trim();
    const similarity=(a,b)=>{const na=normalize(a),nb=normalize(b);if(!na||!nb)return 0;const longer=na.length>nb.length?na:nb,shorter=na.length>nb.length?nb:na;let matches=0;const used=[];for(let i=0;i<shorter.length;i++){const idx=longer.indexOf(shorter[i],0);if(idx!==-1&&!used.includes(idx)){matches++;used.push(idx)}}return matches/longer.length};
    const isSimilar=(a,b)=>{if(a===b)return true;return similarity(a,b)>=0.5};
    // Store isSimilar for use in rendering
    window._isSimilar=isSimilar;
    outsourceTasks=items;outsourceFetchError=false;
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
  const isGroupHeader=(el.closest('[data-group]')&&!el.closest('[data-group-item]'))||el.hasAttribute('data-has-kids');
  const tip=document.createElement('div');tip.className='gantt-tooltip'+(isGroupHeader?' red':'');tip.textContent=name;
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
let _outsourceDragOwner=null;
function outsourceOwnerDragStart(e,el){
  if(!unlocked){e.preventDefault();return}
  _outsourceDragOwner=el.dataset.owner;
  e.dataTransfer.setData('text/plain',_outsourceDragOwner);
  el.classList.add('dragging');
  const srcCol=el.closest('.column');
  document.querySelectorAll('#outsourceContent .column').forEach(col=>{
    if(col===srcCol)return;
    const content=col.querySelector(':scope>div:not(.drop-zone)');
    if(content){content.dataset.origDisplay=content.style.display||'';content.style.display='none'}
    const dz=document.createElement('div');dz.className='drop-zone';dz.dataset.zone=col.dataset.zone;
    dz.ondragover=ev=>ev.preventDefault();
    dz.ondrop=ev=>{ev.preventDefault();outsourceDrop(ev,col.dataset.zone)};
    col.appendChild(dz);
  });
}
function outsourceOwnerDragEnd(){
  _outsourceDragOwner=null;
  document.querySelectorAll('.dragging').forEach(x=>x.classList.remove('dragging'));
  document.querySelectorAll('#outsourceContent .drop-zone').forEach(dz=>dz.remove());
  document.querySelectorAll('#outsourceContent .column>div[data-orig-display]').forEach(d=>{d.style.display=d.dataset.origDisplay||'';delete d.dataset.origDisplay});
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
  setSyncStatus('🔄 同步中...','var(--yellow)');fetch(OUTSOURCE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'saveZone',owner:owner,zone:outsourceZones[owner]||zone,sort:outsourceZones['_sort_'+owner]||''})}).then(()=>{setSyncStatus('✅ 已同步','var(--green)');setTimeout(()=>setSyncStatus(''),3000)}).catch(()=>setSyncStatus('❌ 同步失敗','var(--red)'));
  renderOutsourceFromCache();
}
const DAILY_SHEET_ID=CONFIG.dailySheetId||'';
async function syncOutsource(){
  if(!confirm('確定執行以下操作？\n\n1. 從雲端重新讀取外包工作項目\n2. 重新渲染看板/時間軸'))return;
  document.getElementById('outsourceContent').innerHTML='<div class="spinner"></div>';
  renderOutsource();
}
function activateOutsource(){
  var id=document.getElementById('setupOutsourceId').value.trim();
  var url=document.getElementById('setupOutsourceUrl').value.trim();
  var excelPath=(document.getElementById('setupExcelPath')||{}).value||'';
  var status=document.getElementById('setupStatus');
  var btn=document.getElementById('setupBtn');
  if(!id||!url){status.innerHTML='<span style="color:var(--red)">請填寫兩個欄位</span>';return}
  btn.disabled=true;btn.style.opacity='0.5';btn.style.cursor='not-allowed';
  status.innerHTML='<span style="color:var(--yellow)">⏳ 驗證 Sheet ID...</span>';
  fetch('https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq?tqx=out:json&headers=1').then(function(r){if(!r.ok)throw new Error();return r.text()}).then(function(){
    status.innerHTML='<span style="color:var(--yellow)">⏳ 送出啟用請求...</span>';
    var req=JSON.stringify({action:'activate_outsource',folder:location.pathname.split('/').filter(Boolean).pop(),outsourceSheetId:id,outsourceScriptUrl:url,excelPath:excelPath.trim()});
    return fetch('https://script.google.com/macros/s/AKfycbyNevW7oTS-hKWXTkFknvQfVmai9pqlkUXmU9viGTPHDqs261F312cvY_JMEGwOrt_4/exec?action=saveNote&month=activate_outsource_request&text='+encodeURIComponent(req));
  }).then(function(){
    status.innerHTML='<span style="color:var(--green)">✅ 請求已送出，等待啟用中...</span>';
    var poll=setInterval(function(){fetch(location.href+'config.js?_='+Date.now(),{cache:'no-store'}).then(function(r){return r.text()}).then(function(t){if(t.indexOf(id)>=0){clearInterval(poll);status.innerHTML='<span style="color:var(--green)">✅ 外包功能已啟用！請重新整理頁面。</span>';btn.disabled=false}}).catch(function(){})},10000);
    setTimeout(function(){clearInterval(poll);if(btn.disabled){status.innerHTML='<span style="color:var(--muted)">⏳ 仍在處理中，請稍後重新整理確認</span>';btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer'}},300000);
  }).catch(function(){status.innerHTML='<span style="color:var(--red)">❌ Sheet ID 無效或未設為公開</span>';btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer'});
}
function requestCloudSync(){
  if(!confirm('確定通知秘書執行雲端資料更新？\n\n同步期間可繼續操作，完成後頁面會顯示通知。'))return;
  const btn=document.querySelector('[onclick="requestCloudSync()"]');if(btn){btn.disabled=true;btn.style.opacity='0.5'}
  const ts=Date.now();
  saveNote('sync_request_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),ts+'|'+currentMonth.getFullYear()+'/'+('0'+(currentMonth.getMonth()+1)).slice(-2));
  const el=document.getElementById('cloudSyncStatus');
  el.style.display='block';el.style.color='var(--yellow)';el.textContent='☁️ 已通知秘書，同步中...';
  const origTime=localStorage.getItem('fzg_sync_time_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1))||'';
  const poll=setInterval(()=>{
    const notesUrl=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=notes&headers=0`;
    fetch(notesUrl).then(r=>r.text()).then(text=>{
      try{const json=JSON.parse(text.substring(47).slice(0,-2));
      json.table.rows.forEach(r=>{if(r.c&&r.c[0]&&r.c[0].v==='sync_time_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1)){const newTime=r.c[1]?r.c[1].v:'';if(newTime&&newTime!==origTime){clearInterval(poll);localStorage.setItem('fzg_sync_time_'+currentMonth.getFullYear()+'_'+(currentMonth.getMonth()+1),newTime);el.style.color='var(--green)';el.textContent='✅ 雲端資料已更新，請重新載入';if(btn){btn.disabled=false;btn.style.opacity='1'}}}})
      }catch(e){}
    }).catch(()=>{});
  },10000);
  setTimeout(()=>{clearInterval(poll);if(el.textContent.includes('同步中')){el.style.color='var(--red)';el.textContent='❌ 同步逾時，可能秘書離線，請稍後再試或到頻道通知';if(btn){btn.disabled=false;btn.style.opacity='1'}}},300000);
}

async function renderOutsource(){
  if(!OUTSOURCE_SHEET_ID){document.getElementById('outsourceContent').innerHTML=`<div style="max-width:600px;margin:20px auto;padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
<h3 style="color:var(--accent);margin-bottom:12px">尚未設定外包功能</h3>
<p style="font-size:0.85rem;color:var(--muted);margin-bottom:16px">請依照以下步驟建立外包 Sheet 並填入資料以啟用。</p>
<details style="margin-bottom:12px"><summary style="cursor:pointer;color:var(--accent);font-size:0.9rem">📋 建立外包 Sheet 步驟</summary>
<ol style="font-size:0.8rem;color:var(--muted);padding-left:20px;margin-top:8px;line-height:1.8">
<li>Google Drive → 新增 → Google 試算表</li>
<li>命名為「外包工作項目」</li>
<li>第一個分頁命名「2026/05」（年/月，月份補零）</li>
<li>A1~G1 填入：負責人、工作項目、狀態、開始日、截止日、備註、工時</li>
<li>新增分頁「zones」，A1~C1：負責人、區域、排序</li>
<li>共用 → 知道連結的任何人 → 檢視者</li>
<li>擴充功能 → Apps Script → 全選刪除預設程式碼 → 貼上下方程式碼 → 按「儲存」→ 點「部署」→「新增部署」→ 左側齒輪⚙️點選「類型」→ 選擇「網頁應用程式」→「誰可以存取」選「所有人」→ 按「部署」→ 複製產生的網址</li>
</ol>
</details>
<details style="margin-bottom:16px"><summary style="cursor:pointer;color:var(--accent);font-size:0.9rem">📋 外包 Apps Script 程式碼</summary>
<button onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent).then(()=>{this.textContent='✅ 已複製';setTimeout(()=>this.textContent='📋 複製程式碼',2000)})" style="background:var(--accent);color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:0.8rem;cursor:pointer;margin:8px 0">📋 複製程式碼</button>
<pre style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:0.75rem;overflow-x:auto">function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.action === 'clear') {
    const ws = ss.getSheetByName(data.month);
    if (ws && ws.getLastRow() > 1) ws.getRange(2, 1, ws.getLastRow()-1, 7).clearContent();
    return ContentService.createTextOutput(JSON.stringify({result:'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  if (data.action === 'add') {
    let ws = ss.getSheetByName(data.month);
    if (!ws) { ws = ss.insertSheet(data.month); ws.getRange(1,1,1,7).setValues([['負責人','工作項目','狀態','開始日','截止日','備註','工時']]); }
    ws.appendRow([data.owner, data.task, data.status, data.startDate, data.dueDate, data.note, data.hours]);
    return ContentService.createTextOutput(JSON.stringify({result:'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  if (data.action === 'saveZone') {
    let ws = ss.getSheetByName('zones');
    if (!ws) { ws = ss.insertSheet('zones'); ws.getRange(1,1,1,3).setValues([['負責人','區域','排序']]); }
    const rows = ws.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.owner) { ws.getRange(i+1,2).setValue(data.zone); ws.getRange(i+1,3).setValue(data.sort); found = true; break; }
    }
    if (!found) ws.appendRow([data.owner, data.zone, data.sort]);
    return ContentService.createTextOutput(JSON.stringify({result:'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({result:'unknown'})).setMimeType(ContentService.MimeType.JSON);
}</pre></details>
<div style="margin-bottom:8px"><label style="font-size:0.8rem;color:var(--muted)">外包 Sheet ID（從網址 /d/ 和 /edit 之間複製）</label><input id="setupOutsourceId" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.85rem;margin-top:4px"></div>
<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:var(--muted)">外包 Apps Script URL（部署後複製的「網頁應用程式」網址）</label><input id="setupOutsourceUrl" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.85rem;margin-top:4px"></div>
<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:var(--muted)">Excel 日報路徑（選填，填寫後啟用每日自動同步。本機或網路磁碟的完整路徑，如 F:\\\\資料夾\\\\日報.xlsx）</label><input id="setupExcelPath" style="width:100%;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.85rem;margin-top:4px" placeholder="選填，無則不啟用每日自動同步"></div>
<div id="setupStatus" style="font-size:0.85rem;margin-bottom:8px"></div>
<button onclick="activateOutsource()" id="setupBtn" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer">🔌 啟用外包功能</button>
</div>`;return}
  outsourceTasks=[];outsourceFetchError=false;
  document.getElementById('outsourceContent').innerHTML='<div class="spinner"></div>';
  await fetchOutsource();
  await loadOutsourceZones();
  renderOutsourceFromCache();
}
function renderOutsourceFromCache(){
  updateSyncTimestamp();
  _collapsedOutsourceBoardGroups=new Set(JSON.parse(localStorage.getItem(getOutsourceBoardGroupCollapseKey())||'[]'));
  _collapsedOutsourceOwners=new Set(JSON.parse(localStorage.getItem(getOutsourceOwnerCollapseKey())||'[]'));
  loadGroupNames();
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
    let c=`<div class="outsource-group" data-owner="${owner}" data-sort="${outsourceZones['_sort_'+owner]||i}" style="margin-bottom:8px"><div class="owner-title" draggable="true" ondragstart="outsourceOwnerDragStart(event,this.closest('.outsource-group'))" ondragend="outsourceOwnerDragEnd()" onclick="toggleOutsourceOwner(this,'${owner.replace(/'/g,"\\'")}')" style="color:var(--accent);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:grab"><span class="tog">${_collapsedOutsourceOwners.has(owner)?'▶':'▼'}</span> 👤 ${owner} (${items.length})</div><div${_collapsedOutsourceOwners.has(owner)?' style="display:none"':''}>`;
    // Group items by manual board groups only (no auto-grouping)
    const gid=_getTaskId;
    const groups2=[];
    items.forEach(t=>{const id=gid(t);const mk=_manualBoardGroups[id];if(mk&&mk!=='__independent__'){const g=groups2.find(gr=>gr.key===mk);if(g){g.push(t)}else{const ng=[t];ng.key=mk;groups2.push(ng)}}else{groups2.push([t])}});
    const boardSort=JSON.parse(localStorage.getItem(getBoardItemSortKey())||'{}');
    const ownerOrder=boardSort[owner]||[];
    groups2.sort((a,b)=>{const ak=a.key||gid(a[0]),bk=b.key||gid(b[0]);const ai=ownerOrder.indexOf(ak),bi=ownerOrder.indexOf(bk);return(ai<0?999:ai)-(bi<0?999:bi)});
    // Register keys for sort
    const sortKeys=groups2.map(gr=>gr.key||gid(gr[0]));if(!ownerOrder.length){boardSort[owner]=sortKeys;localStorage.setItem(getBoardItemSortKey(),JSON.stringify(boardSort))}
    groups2.forEach(gr=>{
      if(gr.length===1){
        const t=gr[0];const statusIcon=t['狀態']==='已完成'?'✅':t['狀態']==='進行中'?'🔄':'📝';const statusColor=t['工作項目'].includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
        c+=`<div class="card" data-board-item="${gid(t).replace(/"/g,'&quot;')}" draggable="true" ondragstart="boardCardDragStart(event,this)" ondragend="boardCardDragEnd()" ondragover="boardCardDragOver(event,this)" ondragleave="this.style.outline=''" ondrop="boardCardDrop(event,this)" style="cursor:grab"><div class="name" style="color:${statusColor};display:flex;align-items:center">${statusIcon} ${t['工作項目']}<span class="edit-ctrl" style="margin-left:auto;display:flex;gap:2px"><span onclick="moveBoardItem('${owner.replace(/'/g,"\\'")}','${gid(t).replace(/'/g,"\\'")}', -1, event)" style="cursor:pointer">▲</span><span onclick="moveBoardItem('${owner.replace(/'/g,"\\'")}','${gid(t).replace(/'/g,"\\'")}', 1, event)" style="cursor:pointer">▼</span></span></div><div class="meta"><span>${t['狀態']}${t['備註']?' '+t['備註']:''}</span><span>${t['開始日']?t['開始日'].substring(0,10):''}${t['開始日']&&t['截止日']?' ~ ':''}${t['截止日']?t['截止日'].substring(0,10):''}</span></div></div>`;
      }else{
        const shortest=gr.reduce((a,b)=>a['工作項目'].length<=b['工作項目'].length?a:b)['工作項目'];
        const grKey=gr.key||gid(gr[0]);const grName=getGroupDisplayName(grKey,gr);
        c+=`<div class="card" data-board-group="${grKey.replace(/"/g,'&quot;')}" ondragover="boardCardDragOver(event,this)" ondragleave="this.style.outline=''" ondrop="boardCardDrop(event,this)" style="cursor:default"><div class="name" data-board-group="${grKey.replace(/"/g,'&quot;')}" onclick="toggleOutsourceBoardGroup(this)" style="cursor:pointer;display:flex;align-items:center"><span>${_collapsedOutsourceBoardGroups.has(grKey)?'▼':'▶'}</span> <span class="edit-ctrl" onclick="event.stopPropagation();editGroupName(this,'${grKey.replace(/'/g,"\\'")}')" style="cursor:pointer">✏️</span><span class="view-ctrl">📁</span> ${grName} (${gr.length})<span class="edit-ctrl" style="margin-left:auto;display:flex;gap:2px"><span onclick="event.stopPropagation();moveBoardItem('${owner.replace(/'/g,"\\'")}','${grKey.replace(/'/g,"\\'")}', -1, event)" style="cursor:pointer">▲</span><span onclick="event.stopPropagation();moveBoardItem('${owner.replace(/'/g,"\\'")}','${grKey.replace(/'/g,"\\'")}', 1, event)" style="cursor:pointer">▼</span></span></div><div style="padding-top:4px${_collapsedOutsourceBoardGroups.has(grKey)?'':';display:none'}">`;
        gr.forEach(t=>{const statusIcon=t['狀態']==='已完成'?'✅':t['狀態']==='進行中'?'🔄':'📝';const statusColor=t['工作項目'].includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';c+=`<div style="padding:2px 0;font-size:0.85em;color:${statusColor};display:flex;align-items:center">${statusIcon} ${t['工作項目']} <span style="color:var(--muted);margin-left:4px">${t['開始日']?t['開始日'].substring(0,10):''}</span><span class="edit-ctrl" onclick="moveOutOfGroup(event,'${gid(t).replace(/'/g,"\\'")}')" style="cursor:pointer;margin-left:auto">⤴️</span></div>`});
        c+=`</div></div>`;
      }
    });
    c+=`</div></div>`;
    cols[colIdx]+=c;
  });
  if(outsourceMode==='gantt'){
    _collapsedOutsourceGroups=new Set(JSON.parse(localStorage.getItem(getOutsourceGroupCollapseKey())||'[]'));
    loadTimelineCollapse();
    const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
    const days=new Date(y,m+1,0).getDate();
    const weekdays=['日','一','二','三','四','五','六'];
    let gh='<div class="timeline"><div style="position:relative"><div style="display:flex;border-bottom:2px solid rgba(88,166,255,0.4);padding:4px 0;margin-bottom:6px"><div style="width:200px;flex-shrink:0"></div><div style="flex:1;display:flex">';
    const today2=new Date();const isThisMonth2=today2.getFullYear()===y&&today2.getMonth()===m;
    for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();const wd=weekdays[dow];const isToday=isThisMonth2&&d===today2.getDate();const isWeekend=dow===0||dow===6;gh+=`<div style="flex:1;text-align:center;font-size:0.75rem;color:${isToday?'var(--red)':'var(--muted)'};font-weight:${isToday?'bold':'normal'};${isWeekend?'background:rgba(56,139,253,0.12);border-radius:2px':''}">${d}<br>${wd}</div>`}
    gh+='</div></div>';
    const gGroups={};outsourceFiltered.filter(t=>{const s=(t['開始日']||'').replace(/[^\d\/]/g,'').replace(/\//g,'-'),e=(t['截止日']||'').replace(/[^\d\/]/g,'').replace(/\//g,'-');if(!s&&!e)return false;const sp=s.split('-'),ep=e.split('-');let sd=1,ed=days;if(s){if(+sp[0]===y&&+sp[1]-1===m)sd=+sp[2];else if(+sp[0]>y||(+sp[0]===y&&+sp[1]-1>m))sd=days+1;else sd=1}if(e){if(+ep[0]===y&&+ep[1]-1===m)ed=+ep[2];else if(+ep[0]<y||(+ep[0]===y&&+ep[1]-1<m))ed=0;else ed=days}else ed=sd;return sd<=days&&ed>=1&&sd<=ed}).forEach(t=>{const o=t['負責人']||'未指派';if(!gGroups[o])gGroups[o]=[];gGroups[o].push(t)});
    const tlSort2=JSON.parse(localStorage.getItem(getTimelineSortKey())||'[]');
    Object.entries(gGroups).sort((a,b)=>{const ai=tlSort2.indexOf(a[0]),bi=tlSort2.indexOf(b[0]);return(ai<0?999:ai)-(bi<0?999:bi)}).forEach(([owner,items])=>{
      gh+=`<div style="border-bottom:2px solid rgba(88,166,255,0.4);padding:4px 0" ondragover="timelineDragOver(event,this)" ondragleave="this.classList.remove('drag-over-top','drag-over-bottom')" ondrop="timelineDrop(event,this)"><span data-owner="${owner}" draggable="true" ondragstart="timelineDragStart(event,this)" ondragend="timelineDragEnd()" onclick="toggleTimelineGroup(this)" style="cursor:grab;font-size:1rem;color:var(--accent);font-weight:600;display:inline-flex;align-items:center;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="tog">${_collapsedTimelineOwners.has(owner)?'▶':'▼'}</span>&nbsp;👤 ${owner} (${items.length})</span><div${_collapsedTimelineOwners.has(owner)?' style="display:none"':''}>`;
      // Group items for gantt (same as board - manual only)
      const gid=_getTaskId;
      const tGroups=[];items.forEach(t=>{const id=gid(t);const mk=_manualBoardGroups[id];if(mk&&mk!=='__independent__'){const g=tGroups.find(gr=>gr.key===mk);if(g){g.push(t)}else{const ng=[t];ng.key=mk;tGroups.push(ng)}}else{tGroups.push([t])}});
      const parseDay=(str)=>{const s=(str||'').replace(/[^\d\/]/g,'').replace(/\//g,'-').split('-');if(s.length<3)return null;const sy=+s[0],sm=+s[1]-1,sd=+s[2];if(sy===y&&sm===m)return sd;if(sy>y||(sy===y&&sm>m))return days+1;return sy<y||(sy===y&&sm<m)?0:1};
      const boardSort2=JSON.parse(localStorage.getItem(getBoardItemSortKey())||'{}');const ownerOrder2=boardSort2[owner]||[];
      tGroups.sort((a,b)=>{const ak=a.key||gid(a[0]),bk=b.key||gid(b[0]);const ai=ownerOrder2.indexOf(ak),bi=ownerOrder2.indexOf(bk);return(ai<0?999:ai)-(bi<0?999:bi)});
      tGroups.forEach(gr=>{
        if(gr.length===1){
          const t=gr[0];let sd=parseDay(t['開始日']),ed=parseDay(t['截止日']);if(ed===null)ed=sd;if(sd===null||sd>days||ed<1||sd>ed)return;sd=Math.max(1,sd);ed=Math.min(days,ed);
          const color=(t['工作項目']||'').includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';
          const l=((sd-1)/days*100).toFixed(1),w=((ed-sd+1)/days*100).toFixed(1);
          gh+=`<div data-item="${(t['工作項目']||'').replace(/"/g,'&quot;')}" onclick="ganttRowClick(this,'${(t['工作項目']||'').replace(/'/g,"\\'")}')" style="display:flex;align-items:center;padding:4px 0;cursor:pointer"><div style="width:200px;flex-shrink:0;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:12px"><span style="display:inline-block;width:16px"></span>${t['工作項目']}</div><div style="flex:1;position:relative;height:16px;background:var(--bg);border-radius:3px"><div style="position:absolute;left:${l}%;width:${w}%;height:100%;background:${color};border-radius:3px;opacity:0.8"></div></div></div>`;
        }else{
          const shortest=gr.reduce((a,b)=>a['工作項目'].length<=b['工作項目'].length?a:b)['工作項目'];
          let gsd=days+1,ged=0;gr.forEach(t=>{const s=parseDay(t['開始日']),e=parseDay(t['截止日'])||s;if(s!==null&&s<gsd)gsd=s;if(e!==null&&e>ged)ged=e});
          gsd=Math.max(1,gsd);ged=Math.min(days,ged);if(gsd>days||ged<1)return;
          const gl=((gsd-1)/days*100).toFixed(1),gw=((ged-gsd+1)/days*100).toFixed(1);
          const grCollapsed=!_collapsedOutsourceGroups.has(shortest);
          const grKey=gr.key||gid(gr[0]);const grName=getGroupDisplayName(grKey,gr);
          gh+=`<div data-group="${grKey.replace(/"/g,'&quot;')}" style="position:relative;margin:2px 0"><div style="display:flex;align-items:center;padding:4px 0"><div style="width:200px;flex-shrink:0;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:12px"><span onclick="event.stopPropagation();toggleOutsourceGroup(this)" style="display:inline-block;width:16px;text-align:center;cursor:pointer">${grCollapsed?'▶':'▼'}</span><span class="edit-ctrl" onclick="event.stopPropagation();editGroupName(this,'${grKey.replace(/'/g,"\\'")}')" style="cursor:pointer">✏️</span><span class="view-ctrl">📁</span> <span onclick="ganttRowClick(this.closest('[data-group]').querySelector('[style*=flex]'),'${grName.replace(/'/g,"\\'")}')" style="cursor:pointer">${grName} (${gr.length})</span></div><div onclick="ganttRowClick(this.closest('[data-group]').querySelector('[style*=flex]'),'${grName.replace(/'/g,"\\'")}')" style="flex:1;position:relative;height:16px;background:var(--bg);border-radius:3px;cursor:pointer"><div style="position:absolute;left:${gl}%;width:${gw}%;height:100%;background:var(--accent);border-radius:3px;opacity:0.4"></div></div></div><div${grCollapsed?' style="display:none"':''}>`;
          gr.forEach(t=>{let sd=parseDay(t['開始日']),ed=parseDay(t['截止日']);if(ed===null)ed=sd;if(sd===null||sd>days||ed<1||sd>ed)return;sd=Math.max(1,sd);ed=Math.min(days,ed);const color=(t['工作項目']||'').includes('請假')?'var(--red)':t['狀態']==='已完成'?'var(--green)':t['狀態']==='進行中'?'var(--yellow)':'var(--muted)';const l=((sd-1)/days*100).toFixed(1),w=((ed-sd+1)/days*100).toFixed(1);gh+=`<div data-group-item data-item="${(t['工作項目']||'').replace(/"/g,'&quot;')}" onclick="ganttRowClick(this,'${(t['工作項目']||'').replace(/'/g,"\\'")}')" style="display:flex;align-items:center;padding:2px 0;cursor:pointer"><div style="width:200px;flex-shrink:0;font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:28px;color:var(--muted)">└ ${t['工作項目']}</div><div style="flex:1;position:relative;height:12px;background:var(--bg);border-radius:3px"><div style="position:absolute;left:${l}%;width:${w}%;height:100%;background:${color};border-radius:3px;opacity:0.8"></div></div></div>`});
          gh+=`</div><div style="position:absolute;top:0;bottom:0;left:calc(200px + (100% - 200px) * ${gl} / 100 - 6px);width:calc((100% - 200px) * ${gw} / 100 + 12px);border:1px solid var(--border);border-radius:4px;pointer-events:none;z-index:0;background:rgba(88,166,255,0.15)"></div></div>`;
        }
      });
      gh+=`</div></div>`;
    });
    for(let d=1;d<=days;d++){const dow=new Date(y,m,d).getDay();if(dow===0||dow===6){const pos=((d-1)/days*100).toFixed(1);gh+=`<div style="position:absolute;top:40px;bottom:0;left:calc(200px + (100% - 200px) * ${pos} / 100);width:calc((100% - 200px) / ${days});background:rgba(56,139,253,0.1);pointer-events:none"></div>`}}
    if(isThisMonth2){const todayPos=((today2.getDate()-0.5)/days*100).toFixed(1);gh+=`<div style="position:absolute;top:40px;bottom:0;left:calc(200px + (100% - 200px) * ${todayPos} / 100);width:2px;background:var(--red);z-index:10;pointer-events:none;opacity:0.7"></div>`}
    gh+='</div></div>';
    document.getElementById('outsourceContent').innerHTML=gh;
    return;
  }
  document.getElementById('outsourceContent').innerHTML='<div class="board"><div class="column" data-zone="一區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'一區\')">'+cols[0]+'</div><div class="column" data-zone="二區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'二區\')">'+cols[1]+'</div><div class="column" data-zone="三區" ondragover="event.preventDefault();this.style.outline=\'2px dashed var(--accent)\'" ondragleave="this.style.outline=\'\'" ondrop="this.style.outline=\'\';outsourceDrop(event,\'三區\')">'+cols[2]+'</div></div>';
}
fetchData();updateMonthLabel();loadNotes();applyLock();
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister()))}

