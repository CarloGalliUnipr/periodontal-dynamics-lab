import {REFERENCE, hill, microbialResponse, currentThreshold, plaqueAt, runPeriodic, runRechallenge} from './model.mjs';

const defaults={
  plaque:{k:0.05,T:60,max:0.8},
  hill:{theta0:0.8,n:4,A:0.55,signal:0.60},
  ratchet:{peak:0.575,T:60,epsilon:0.01,alpha:1,r:1,cycles:60},
  rechallenge:{epsilon:0.03,recovery:0,amplitude:0.50,duration:55},
};
const state=structuredClone(defaults);
const spec={
  plaque:[['k','Plaque regrowth rate k',0.01,0.15,0.01,'dimensionless regrowth rate'],['T','Cleaning interval T',15,120,5,'time between plaque resets'],['max','Plaque plateau uₘₐₓ',0.2,1.4,0.05,'limit approached without cleaning']],
  hill:[['theta0','Baseline threshold θ₀',0.3,1.2,0.05,'constitutive susceptibility'],['n','Hill steepness n',1,10,1,'how sharply the response rises'],['A','Acquired memory A',0,1.2,0.05,'higher A means stronger sensitization'],['signal','Physical signal S',0.05,1.5,0.05,'identical for both response curves']],
  ratchet:[['peak','Peak plaque per cycle',0.30,0.90,0.005,'forcing reached just before cleaning'],['T','Recall interval T',20,110,5,'number of model time units'],['epsilon','Memory rate ε',0.005,0.12,0.005,'smaller means slower adaptation'],['alpha','Sensitization α',0.2,1.4,0.1,'strength of positive acquired memory'],['r','Microbial recovery r',0.1,1.5,0.1,'rate of community adjustment'],['cycles','Cycles to simulate',10,100,5,'finite simulation horizon']],
  rechallenge:[['epsilon','Memory rate ε',0.01,0.10,0.01,'lower values retain memory longer'],['recovery','Time before challenge',0,160,10,'recovery at baseline plaque'],['amplitude','Challenge plaque level',0.25,1.2,0.025,'forcing during the challenge'],['duration','Challenge duration',10,120,5,'duration in model time units']],
};
const $=id=>document.getElementById(id);
const format=(v,k)=>k==='cycles'||k==='T'||k==='recovery'||k==='duration'||k==='n'?String(v):v<0.1?v.toFixed(3):v.toFixed(2);
function controls(section){
  const root=$('controls-'+section);
  root.innerHTML='';
  for(const [key,title,min,max,step,hint] of spec[section]){
    const id=section+'-'+key;
    const row=document.createElement('div');row.className='control';
    row.innerHTML=`<div class="control-head"><label for="${id}">${title}</label><output id="${id}-output">${format(state[section][key],key)}</output></div><div class="subhint">${hint}</div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${state[section][key]}"/><div class="range-labels"><span>${format(min,key)}</span><span>${format(max,key)}</span></div>`;
    const slider=row.querySelector('input');
    slider.addEventListener('input',()=>{state[section][key]=Number(slider.value);$(id+'-output').textContent=format(state[section][key],key); schedule(section);});
    root.append(row);
  }
}
function sync(section){for(const [key] of spec[section]){const input=$(section+'-'+key);input.value=state[section][key];$(section+'-'+key+'-output').textContent=format(state[section][key],key);}}
const colors={green:'#33766b',orange:'#c58f50',grey:'#97aba1',dark:'#24483d'};
function plot(id, series, {minX=0,maxX,maxY=1,minY=0,width=700,height=304,xlabel='Time (model units)',ylabel='',bands=[],lines=[],ticks=5}={}){
  const root=$(id),w=width,h=height,l=49,r=14,t=17,b=38;maxX ??= Math.max(...series.flatMap(s=>s.data.map(pt=>pt.x)),1);
  if(maxX<=minX)maxX=minX+1;if(maxY<=minY)maxY=minY+1;
  const X=v=>l+(v-minX)/(maxX-minX)*(w-l-r),Y=v=>h-b-(v-minY)/(maxY-minY)*(h-t-b);
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${ylabel||xlabel} plotted for the selected model parameters" xmlns="http://www.w3.org/2000/svg">`;
  for(const band of bands)svg+=`<rect x="${X(band.start).toFixed(1)}" y="${t}" width="${Math.max(0,X(band.end)-X(band.start)).toFixed(1)}" height="${h-t-b}" fill="#efdcbf" opacity=".45"/>`;
  for(let i=0;i<=4;i++){const val=minY+(maxY-minY)*i/4,y=Y(val);svg+=`<line x1="${l}" y1="${y}" x2="${w-r}" y2="${y}" stroke="#e1e8e1"/><text x="${l-10}" y="${y+4}" font-size="11" fill="#76877b" text-anchor="end">${val.toFixed(val>=10?0:2).replace(/0$/,'').replace(/\.$/,'')}</text>`;}
  for(let i=0;i<=ticks;i++){const val=minX+(maxX-minX)*i/ticks,x=X(val);svg+=`<line x1="${x}" y1="${h-b}" x2="${x}" y2="${h-b+4}" stroke="#9aaca0"/><text x="${x}" y="${h-b+19}" font-size="11" fill="#76877b" text-anchor="middle">${val<10?Number(val.toFixed(1)):Math.round(val)}</text>`;}
  for(const line of lines){const y=Y(line.y);svg+=`<line x1="${l}" y1="${y}" x2="${w-r}" y2="${y}" stroke="${line.color||'#a7b2a9'}" stroke-width="1.4" stroke-dasharray="5 5"/>`;}
  for(const s of series){if(!s.data.length)continue;const str=s.data.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(2)} ${Y(p.y).toFixed(2)}`).join(' ');svg+=`<path d="${str}" stroke="${s.color||colors.green}" fill="none" stroke-width="${s.width||2.7}" ${s.dash?'stroke-dasharray="7 5"':''} stroke-linejoin="round" stroke-linecap="round"/>`;if(s.dots){for(const pt of s.data)svg+=`<circle cx="${X(pt.x)}" cy="${Y(pt.y)}" r="4.2" fill="${s.color||colors.green}" stroke="white" stroke-width="2"/>`;}}
  svg+=`<text x="${(l+w-r)/2}" y="${h-4}" font-size="12" fill="#718678" text-anchor="middle">${xlabel}</text>`;
  if(ylabel)svg+=`<text x="15" y="${(t+h-b)/2}" transform="rotate(-90 15 ${(t+h-b)/2})" font-size="12" fill="#718678" text-anchor="middle">${ylabel}</text>`;
  svg+='</svg>';root.innerHTML=svg;
}
function plaquePlot(){const p=state.plaque,peak=plaqueAt(p.T,{peak:p.max*(-Math.expm1(-p.k*p.T)),T:p.T,k:p.k});
  const series=[];for(let c=0;c<3;c++){const data=[];for(let j=0;j<=160;j++){const tau=j/160*p.T;data.push({x:c*p.T+tau,y:p.max*(-Math.expm1(-p.k*tau))});}series.push({data,color:colors.green,width:2.8});series.push({data:[{x:(c+1)*p.T,y:p.max*(-Math.expm1(-p.k*p.T))},{x:(c+1)*p.T,y:0}],color:colors.green,width:2.8});}
  plot('chart-plaque',series,{maxX:3*p.T,maxY:Math.max(0.4,p.max*1.12),xlabel:'Time (model units)',ylabel:'Plaque u',ticks:3});
  $('plaque-peak').textContent=peak.toFixed(3);$('plaque-percent').textContent=(100*(1-Math.exp(-p.k*p.T))).toFixed(1)+'%';
}
function hillPlot(){const p=state.hill,at=currentThreshold(p.A,p.theta0),start=[],adapted=[];for(let i=0;i<=150;i++){const x=1.6*i/150;start.push({x,y:hill(x,p.theta0,p.n)});adapted.push({x,y:hill(x,at,p.n)});}
 const r0=hill(p.signal,p.theta0,p.n),r1=hill(p.signal,at,p.n);
 plot('chart-hill',[{data:start,color:colors.green},{data:adapted,color:colors.orange},{data:[{x:p.signal,y:r0}],color:colors.green,dots:true},{data:[{x:p.signal,y:r1}],color:colors.orange,dots:true}],{maxX:1.6,maxY:1,xlabel:'Physical signal S',ylabel:'Host response',lines:[{y:0.5,color:'#cbd2c8'}],ticks:4});
 $('hill-signal').textContent=p.signal.toFixed(2);$('hill-diff').textContent='+'+(r1-r0).toFixed(3);
}
function ratchetPlot(){const p={...REFERENCE,...state.ratchet};const result=runPeriodic(p);
  plot('chart-ratchet',[{data:result.points.map(x=>({x:x.t/p.T,y:x.H})),color:colors.green},{data:result.points.map(x=>({x:x.t/p.T,y:x.Hinstant})),color:colors.orange}],{maxX:p.cycles,maxY:1,xlabel:'Maintenance cycle',ylabel:'Inflammation H',lines:[{y:0.5,color:'#92a89f'}],ticks:5});
  const maximum=Math.max(0.6,p.alpha*1.05,...result.points.map(pt=>pt.A));
  plot('chart-memory',[{data:result.points.map(x=>({x:x.t/p.T,y:x.A})),color:colors.green}],{maxX:p.cycles,maxY:maximum,xlabel:'Maintenance cycle',ylabel:'Memory A',height:190,ticks:5});
  $('ratchet-conversion').textContent=result.memoryConversion?'Cycle '+result.memoryConversion:'Not sustained';
  $('instant-conversion').textContent=result.instantConversion?'Cycle '+result.instantConversion:'Not sustained';
}
function rechallengePlot(){const p=state.rechallenge;const r=runRechallenge(p);plot('chart-rechallenge',[{data:r.points.map(x=>({x:x.t,y:x.naive})),color:colors.green},{data:r.points.map(x=>({x:x.t,y:x.treated})),color:colors.orange}],{maxX:r.total,maxY:1,xlabel:'Time from matched initial state',ylabel:'Inflammation H',bands:[{start:p.recovery,end:p.recovery+p.duration}],lines:[{y:0.5,color:'#92a89f'}],ticks:5});$('naive-outcome').textContent=r.naiveRelapse?'High H':'Low H';$('treated-outcome').textContent=r.treatedRelapse?'High H':'Low H';}
const runners={plaque:plaquePlot,hill:hillPlot,ratchet:ratchetPlot,rechallenge:rechallengePlot};
let pending={};function schedule(name){if(pending[name])clearTimeout(pending[name]);pending[name]=setTimeout(()=>{try{runners[name]();}catch(err){console.error(err);const chart=$('chart-'+name);chart.innerHTML=`<p class="error">Unable to draw this setting; try Reset.</p>`;}pending[name]=null;},name==='ratchet'?100:25);}
for(const section of Object.keys(spec)){controls(section)}
function activate(section){for(const button of document.querySelectorAll('[data-tab]')){const selected=button.dataset.tab===section;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
 for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==section; schedule(section);}
for(const tab of document.querySelectorAll('[data-tab]')){tab.addEventListener('click',()=>activate(tab.dataset.tab));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],idx=tabs.indexOf(tab),next=tabs[(idx+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.focus();activate(next.dataset.tab);});}
for(const reset of document.querySelectorAll('[data-reset]'))reset.addEventListener('click',()=>{const section=reset.dataset.reset;state[section]=structuredClone(defaults[section]);sync(section);schedule(section);});
const presets={reference:{peak:.575,T:60,epsilon:.01,alpha:1,r:1,cycles:60},low:{peak:.45,T:60,epsilon:.01,alpha:1,r:1,cycles:60},high:{peak:.65,T:60,epsilon:.01,alpha:1,r:1,cycles:60}};
for(const preset of document.querySelectorAll('[data-preset]'))preset.addEventListener('click',()=>{Object.assign(state.ratchet,presets[preset.dataset.preset]);sync('ratchet');schedule('ratchet');});
$('download-settings').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({application:'Periodontal Dynamics Lab',version:'prototype-0.1',settings:state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='periodontal-dynamics-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
activate('plaque');
