import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CustomSelect from './CustomSelect.jsx';
import { annotationDefaults, drawImageAnnotations } from '../domain/image-annotation.js';
import { getStoredAttachment } from '../domain/attachments.js';
import '../styles/image-annotation.css';

export default function ImageAnnotationEditor({ attachment, onSave, onClose }) {
  const [initial] = useState(() => attachment.imageAnnotation?.marks || []);
  const [history,setHistory]=useState([initial]); const [cursor,setCursor]=useState(0);
  const marks=history[cursor]; const [draft,setDraft]=useState(null); const [selected,setSelected]=useState(null);
  const [tool,setTool]=useState('rect'); const [style,setStyle]=useState({...annotationDefaults});
  const [zoom,setZoom]=useState(1); const [image,setImage]=useState(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const canvasRef=useRef(null), gesture=useRef(null), dialogRef=useRef(null), closeRef=useRef(null);
  const activeMarks=draft || marks;
  const commit = next => { setHistory(prev => [...prev.slice(0,cursor+1),next]); setCursor(cursor+1); setDraft(null); };
  const close=()=> { if (!busy && (JSON.stringify(marks)===JSON.stringify(initial) || window.confirm('ทิ้งการแก้ไขเครื่องหมายที่ยังไม่ได้บันทึก?'))) onClose(); };
  closeRef.current=close;
  useEffect(()=> {
    const previousFocus=document.activeElement; const overflow=document.body.style.overflow; document.body.style.overflow='hidden'; dialogRef.current?.focus();
    const key=e=> { if(e.key==='Escape'){e.preventDefault();closeRef.current();} if(e.key==='Tab'){const nodes=[...dialogRef.current.querySelectorAll('button,input,select')].filter(n=>!n.disabled);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}} };
        document.addEventListener('keydown',key);
    return ()=> {document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previousFocus?.focus();};
  },[]);
  useEffect(()=> {const handler=e=>{e.preventDefault();e.returnValue='';}; if(JSON.stringify(marks)!==JSON.stringify(initial))window.addEventListener('beforeunload',handler);return ()=>window.removeEventListener('beforeunload',handler);},[marks,initial]);
  useEffect(()=> {let cancelled=false; let bitmap;getStoredAttachment(attachment.id).then(async blob=>{if(!blob)throw new Error('ไม่พบภาพต้นฉบับ');bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});if(cancelled)bitmap.close();else setImage(bitmap);}).catch(e=>{if(!cancelled)setError(e.message);});return ()=>{cancelled=true;bitmap?.close();};},[attachment.id]);
  useEffect(()=> {if(!image||!canvasRef.current)return;const canvas=canvasRef.current;canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);drawImageAnnotations(ctx,activeMarks,image.width,image.height);
    const mark=activeMarks.find(m=>m.id===selected);if(mark){ctx.fillStyle='#0066ff';for(const [x,y] of [[mark.x,mark.y],[mark.endX,mark.endY]]){ctx.fillRect(x*image.width-5*image.width/1000,y*image.height-5*image.width/1000,10*image.width/1000,10*image.width/1000);}}
  },[image,activeMarks,selected]);
  const point=e=>{const r=canvasRef.current.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
  const down=e=>{if(busy||e.button!==0)return;const p=point(e);e.currentTarget.setPointerCapture(e.pointerId);
    if(tool==='pan'){gesture.current={mode:'pan',clientX:e.clientX,clientY:e.clientY,left:e.currentTarget.parentElement.scrollLeft,top:e.currentTarget.parentElement.scrollTop};return;}
    const tolerance=16/e.currentTarget.getBoundingClientRect().width;
    const chosen=marks.find(m=>m.id===selected);let mode='',hit=null;
    if(chosen){if(Math.hypot(p.x-chosen.x,p.y-chosen.y)<tolerance){mode='start';hit=chosen;}else if(Math.hypot(p.x-chosen.endX,p.y-chosen.endY)<tolerance){mode='end';hit=chosen;}}
    if(!hit && tool==='select') hit=[...marks].reverse().find(m=>{if(m.type==='rect')return p.x>=Math.min(m.x,m.endX)-tolerance&&p.x<=Math.max(m.x,m.endX)+tolerance&&p.y>=Math.min(m.y,m.endY)-tolerance&&p.y<=Math.max(m.y,m.endY)+tolerance;const dx=m.endX-m.x,dy=m.endY-m.y,t=Math.max(0,Math.min(1,((p.x-m.x)*dx+(p.y-m.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-m.x-t*dx,p.y-m.y-t*dy)<tolerance;});
    if(hit){setSelected(hit.id);setStyle({color:hit.color,width:hit.width,outline:hit.outline});gesture.current={mode:mode||'move',mark:hit,p};}
    else if(tool!=='select'){const mark={id:crypto.randomUUID(),type:tool,...style,x:p.x,y:p.y,endX:p.x,endY:p.y};setSelected(mark.id);setDraft([...marks,mark]);gesture.current={mode:'new',mark,p};}
    else setSelected(null);
  };
  const move=e=>{const g=gesture.current;if(!g)return;if(g.mode==='pan'){const stage=e.currentTarget.parentElement;stage.scrollLeft=g.left+g.clientX-e.clientX;stage.scrollTop=g.top+g.clientY-e.clientY;return;}const p=point(e),m={...g.mark};if(g.mode==='move'){const dx=Math.max(-Math.min(m.x,m.endX),Math.min(1-Math.max(m.x,m.endX),p.x-g.p.x));const dy=Math.max(-Math.min(m.y,m.endY),Math.min(1-Math.max(m.y,m.endY),p.y-g.p.y));m.x+=dx;m.endX+=dx;m.y+=dy;m.endY+=dy;}else if(g.mode==='start'){m.x=p.x;m.y=p.y;}else{m.endX=p.x;m.endY=p.y;}setDraft(g.mode==='new'?[...marks,m]:marks.map(entry=>entry.id===m.id?m:entry));};
  const up=()=>{if(!gesture.current)return;const g=gesture.current;gesture.current=null;if(draft){const next=draft.filter(m=>m.id!==g.mark.id||Math.hypot(m.endX-m.x,m.endY-m.y)>.003);if(JSON.stringify(next)!==JSON.stringify(marks))commit(next);else setDraft(null);}};
  const changeStyle=patch=>{const next={...style,...patch};setStyle(next);Object.assign(annotationDefaults,next);if(selected)commit(marks.map(m=>m.id===selected?{...m,...patch}:m));};
  const save=async()=>{setBusy(true);setError('');try{await onSave(marks);onClose();}catch(e){setError(e.message||'บันทึกไม่สำเร็จ');setBusy(false);}};
  return createPortal(<div className="annotation-backdrop"><section ref={dialogRef} className="annotation-dialog" role="dialog" aria-modal="true" aria-labelledby="annotation-title" tabIndex={-1}>
    <header><h2 id="annotation-title">ทำเครื่องหมายบนภาพหลักฐาน</h2><button type="button" disabled={busy} onClick={close}>ปิด</button></header>
    <div className="annotation-toolbar"><fieldset disabled={busy}><legend>เครื่องมือ</legend>{[['select','เลือก / ย้าย'],['rect','กรอบสี่เหลี่ยม'],['arrow','ลูกศร'],['pan','เลื่อนภาพ']].map(([value,label])=><button type="button" key={value} aria-pressed={tool===value} onClick={()=>{setTool(value);if(value!=='select')setSelected(null);}}>{label}</button>)}
      <label>สี <input type="color" value={style.color} onChange={e=>changeStyle({color:e.target.value})}/></label>{[['#ff0000','แดง'],['#ffff00','เหลือง'],['#00aa44','เขียว'],['#00aaff','ฟ้า'],['#ffffff','ขาว'],['#000000','ดำ']].map(([color,name])=><button key={color} type="button" aria-label={`สี${name}`} className="annotation-color" style={{backgroundColor:color}} onClick={()=>changeStyle({color})}/>)}
      <label>ความหนา {style.width}<input aria-label="ความหนาเส้น" type="range" min="1" max="12" value={style.width} onChange={e=>changeStyle({width:Number(e.target.value)})}/></label><label><input type="checkbox" checked={style.outline} onChange={e=>changeStyle({outline:e.target.checked})}/>ขอบขาว</label>
      <label>ขยายภาพ<CustomSelect aria-label="ขยายภาพ" disabled={busy} menuClassName="annotation-zoom-menu" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[1,1.5,2,3].map(value=><option key={value} value={value}>{value*100}%</option>)}</CustomSelect></label>
    </fieldset></div>
    <p className="annotation-help">ลากเพื่อวาด · เลือก / ย้ายเพื่อแก้เครื่องหมาย · ลากจุดสีน้ำเงินเพื่อปรับขนาด · เลื่อนภาพเพื่อดูภาพขยาย</p>
    <div className="annotation-stage">{image?<canvas ref={canvasRef} aria-label="ภาพหลักฐานสำหรับทำเครื่องหมาย" style={{width:`${zoom*100}%`}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDraft(null);}}/>:<p>กำลังเปิดภาพต้นฉบับ…</p>}</div>
    {error&&<p role="alert" className="annotation-error">{error}</p>}
    <footer><button disabled={busy||cursor===0} onClick={()=>{setCursor(cursor-1);setSelected(null);}}>ย้อนกลับ</button><button disabled={busy||cursor===history.length-1} onClick={()=>{setCursor(cursor+1);setSelected(null);}}>ทำซ้ำ</button><button disabled={busy||!selected} onClick={()=>{commit(marks.filter(m=>m.id!==selected));setSelected(null);}}>ลบที่เลือก</button><button disabled={busy||!selected} onClick={()=>{const m=marks.find(m=>m.id===selected);if(!m)return;const dx=Math.min(.02,1-Math.max(m.x,m.endX)),dy=Math.min(.02,1-Math.max(m.y,m.endY));const copy={...m,id:crypto.randomUUID(),x:m.x+dx,endX:m.endX+dx,y:m.y+dy,endY:m.endY+dy};commit([...marks,copy]);setSelected(copy.id);}}>ทำสำเนา</button><button disabled={busy||!marks.length} onClick={()=>{if(window.confirm('ล้างเครื่องหมายทั้งหมดในภาพนี้?')){commit([]);setSelected(null);}}}>ล้างทั้งหมด</button><button disabled={busy} onClick={close}>ยกเลิก</button><button className="annotation-save" disabled={busy||!image||JSON.stringify(marks)===JSON.stringify(initial)} onClick={save}>{busy?'กำลังบันทึก…':'บันทึก'}</button></footer>
  </section></div>,document.body);
}
