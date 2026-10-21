/* EmotionLens - tiny_face_detector + 68 landmarks + 7-class expressions, all local. */
(()=>{
const $=s=>document.querySelector(s);
const EMOTIONS=['neutral','happy','sad','angry','fearful','disgusted','surprised'];
const ECOLOR={neutral:'#64748b',happy:'#16a34a',sad:'#3b82f6',angry:'#dc2626',fearful:'#7c3aed',disgusted:'#ca8a04',surprised:'#ea580c'};
const stage=$('#stage');
let stream=null,video=null,canvas=null,ctx=null,img=null,running=false,lastT=0,fps=0;
let detOpts=null, hist=[], histCounts={}, lastDomKey=null, lastHistPush=0;

async function loadModels(){
  $('#st-model').textContent='loading...';
  await faceapi.nets.tinyFaceDetector.loadFromUri('./weights');
  await faceapi.nets.faceLandmark68Net.loadFromUri('./weights');
  await faceapi.nets.faceExpressionNet.loadFromUri('./weights');
  detOpts=new faceapi.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.4});
  $('#st-model').textContent='3 nets ready';
}
function legendHTML(){
  $('#legend').innerHTML=EMOTIONS.map(e=>`<span><i style="background:${ECOLOR[e]}"></i>${e}</span>`).join('');
}
function setStage(node){
  stage.innerHTML='';
  canvas=document.createElement('canvas');canvas.className='overlay';
  stage.append(node,canvas);ctx=canvas.getContext('2d');
}
function fitOverlay(w,h){canvas.width=w;canvas.height=h;}
function dominant(expressions){
  let best='neutral',bv=0;
  for(const e of EMOTIONS){const v=expressions[e]||0;if(v>bv){bv=v;best=e;}}
  return [best,bv];
}
async function detectLoop(){
  if(!running)return;
  const src=video||img;
  if(src&&(video?video.readyState>=2:true)){
    const w=video?video.videoWidth:img.naturalWidth,h=video?video.videoHeight:img.naturalHeight;
    if(canvas.width!==w)fitOverlay(w,h);
    const t0=performance.now();
    const dets=await faceapi.detectAllFaces(src,detOpts).withFaceLandmarks().withFaceExpressions();
    const ms=performance.now()-t0;
    const now=performance.now();
    if(lastT){fps=fps*0.85+1000/(now-lastT)*0.15;}
    lastT=now;
    ctx.clearRect(0,0,w,h);
    drawDets(dets,w,h);
    $('#st-faces').textContent=dets.length;
    $('#st-ms').textContent=Math.round(ms);
    $('#st-fps').textContent=video?fps.toFixed(0):'still';
    renderFaces(dets,src,w,h);
    renderMix(dets);
    updateTimeline(dets,now);
  }
  if(video)setTimeout(()=>requestAnimationFrame(detectLoop),140);
}
function drawDets(dets,w,h){
  ctx.lineWidth=Math.max(2,w/480);
  dets.forEach(d=>{
    const b=d.detection.box;
    const [em,conf]=dominant(d.expressions);
    const col=ECOLOR[em];
    if($('#tBox').checked){
      const r=Math.min(12,b.width/6);
      ctx.strokeStyle=col;
      ctx.beginPath();
      [[b.x,b.y,1,1],[b.x+b.width,b.y,-1,1],[b.x,b.y+b.height,1,-1],[b.x+b.width,b.y+b.height,-1,-1]].forEach(([x,y,dx,dy])=>{
        ctx.moveTo(x+dx*r,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*r);});
      ctx.stroke();
      const label=em+' '+(conf*100).toFixed(0)+'%';
      ctx.font=`bold ${Math.max(13,w/46)}px system-ui`;
      const tw=ctx.measureText(label).width+14;
      ctx.fillStyle=col+'e0';
      ctx.fillRect(b.x,Math.max(0,b.y-Math.max(20,w/34)),tw,Math.max(20,w/34));
      ctx.fillStyle='#fff';
      ctx.fillText(label,b.x+7,Math.max(0,b.y-Math.max(6,w/110)));
    }
    if($('#tLand').checked&&d.landmarks){
      ctx.fillStyle='#22d3ee';
      d.landmarks.positions.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1.3,w/340),0,7);ctx.fill();});
    }
  });
}
function cropFace(src,b){
  const c=document.createElement('canvas');
  const pad=Math.round(b.width*0.18);
  const x=Math.max(0,b.x-pad),y=Math.max(0,b.y-pad);
  const ww=Math.min((src.videoWidth||src.naturalWidth)-x,b.width+2*pad);
  const hh=Math.min((src.videoHeight||src.naturalHeight)-y,b.height+2*pad);
  c.width=52;c.height=52;
  c.getContext('2d').drawImage(src,x,y,ww,hh,0,0,52,52);
  return c.toDataURL('image/jpeg',0.7);
}
function renderFaces(dets,src,w,h){
  const el=$('#faces');
  if(!dets.length){el.innerHTML='<p style="font-size:13.5px;color:var(--muted)">No faces in view.</p>';return;}
  el.innerHTML='';
  dets.forEach((d,i)=>{
    const [em,conf]=dominant(d.expressions);
    const sorted=[...EMOTIONS].sort((a,b)=>(d.expressions[b]||0)-(d.expressions[a]||0)).slice(0,3);
    const row=document.createElement('div');row.className='frow';
    row.innerHTML=`<img class="av" alt="face ${i+1}">
      <div class="meta"><b>${em} <span style="color:${ECOLOR[em]}">${(conf*100).toFixed(1)}%</span></b>
      <span>detection ${(d.detection.score*100).toFixed(1)}% · face ${i+1}</span>
      <div class="bars">${sorted.map(e=>`<div class="bar-row"><span>${e}</span><div class="tr"><div class="fl" style="width:${((d.expressions[e]||0)*100).toFixed(1)}%;background:${ECOLOR[e]}"></div></div><span class="pc">${((d.expressions[e]||0)*100).toFixed(0)}%</span></div>`).join('')}</div>
      </div>`;
    row.querySelector('.av').src=cropFace(src,d.detection.box);
    el.appendChild(row);
  });
}
function renderMix(dets){
  const el=$('#mix');
  if(!dets.length){el.innerHTML='<p style="font-size:13.5px;color:var(--muted)">No faces yet.</p>';$('#st-dom').textContent='-';return;}
  const agg={};EMOTIONS.forEach(e=>agg[e]=0);
  dets.forEach(d=>EMOTIONS.forEach(e=>agg[e]+=(d.expressions[e]||0)/dets.length));
  const sorted=[...EMOTIONS].sort((a,b)=>agg[b]-agg[a]);
  el.innerHTML=sorted.map(e=>`<div class="bar-row"><span>${e}</span><div class="tr"><div class="fl" style="width:${(agg[e]*100).toFixed(1)}%;background:${ECOLOR[e]}"></div></div><span class="pc">${(agg[e]*100).toFixed(0)}%</span></div>`).join('');
  $('#st-dom').textContent=sorted[0];
}
function updateTimeline(dets,now){
  if(!video)return; // timeline is for live sessions
  if(!dets.length)return;
  // largest face drives the timeline
  const big=[...dets].sort((a,b)=>b.detection.box.area-a.detection.box.area)[0];
  const [em,conf]=dominant(big.expressions);
  const key=em;
  if(key!==lastDomKey&&now-lastHistPush>600){
    lastDomKey=key;lastHistPush=now;
    hist.push({t:new Date(),em,conf});
    histCounts[em]=(histCounts[em]||0)+1;
    if(hist.length>40)hist.shift();
    renderTimeline();
  }
}
function renderTimeline(){
  const el=$('#timeline');
  el.innerHTML=hist.slice().reverse().map(h=>
    `<div class="tl-row"><span class="tl-dot" style="background:${ECOLOR[h.em]}"></span><b>${h.em}</b><span style="color:var(--muted)">${(h.conf*100).toFixed(0)}%</span><time>${h.t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div>`).join('');
  const top=Object.entries(histCounts).sort((a,b)=>b[1]-a[1])[0];
  $('#st-top').textContent=top?top[0]:'-';
  $('#summary').innerHTML=Object.entries(histCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([e,n])=>`<span class="chip"><i style="background:${ECOLOR[e]}"></i>${e} ×${n}</span>`).join('');
}
async function useVideo(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960}},audio:false});
  }catch(e){toast('Camera blocked - allow permission or upload a photo');return;}
  video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  await video.play();
  img=null;setStage(video);running=true;detectLoop();
  $('#camBtn').textContent='Stop webcam';
}
function stopVideo(){
  if(stream)stream.getTracks().forEach(t=>t.stop());
  stream=null;video=null;running=false;
  $('#camBtn').textContent='Start webcam';
}
function useImage(src){
  stopVideo();
  img=new Image();
  img.onload=()=>{setStage(img);running=true;detectLoop();};
  img.src=src;
}
$('#camBtn').onclick=()=>video?stopVideo():useVideo();
$('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>useImage(r.result);r.readAsDataURL(f);};
$('#sample1').onclick=()=>useImage('sample-lena.jpg');
$('#sample2').onclick=()=>useImage('sample-two.jpg');
$('#sample3').onclick=()=>useImage('sample-group.jpg');
function toast(msg){const t=document.createElement('div');t.className='toast show';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}
legendHTML();
loadModels().then(()=>{useImage('sample-lena.jpg');}).catch(e=>{$('#st-model').textContent='load error';toast('Model failed to load - check connection');});
})();
