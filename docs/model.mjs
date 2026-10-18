/**
 * Periodontal Dynamics Lab v0.2 — illustrative browser calculations.
 * Reference equations / protocols: draft model and Experiment 14 revision export.
 * Numerical outputs are exploratory; archived research data remain authoritative.
 */
export const REFERENCE = Object.freeze({
  theta0: .8, n: 4, q: 4, K: .9, r: 1, alpha: 1,
  epsilon: .01, k: .05, T: 60, peak: .575, cycles: 60, gamma: .8
});
export const UNIT_DAYS = 5/3; // interpretive mapping, not calibrated
export const clamp = (x,lo,hi)=>Math.min(hi,Math.max(lo,x));
export function hill(signal,threshold,n){
  const s=Math.max(0,signal),theta=Math.max(1e-12,threshold);
  return s===0?0:1/(1+Math.pow(theta/s,n));
}
export function microbialResponse(H,p=REFERENCE){return hill(clamp(H,0,1),p.K,p.q);}
export function currentThreshold(A,theta0=REFERENCE.theta0){return theta0*Math.exp(-A);}
export function plaqueAt(tau,{peak,T,k}){
  const q=clamp(tau,0,T);
  return peak*(-Math.expm1(-k*q))/(-Math.expm1(-k*T));
}
export function rightHandSide(y,u,p,mode='memory',D=0){
  const [H,M,A]=y;
  const targetA=p.target==='dose' ? p.alpha*H - 1.4*H*H : p.alpha*H;
  const adapted=mode==='instant'?targetA:A;
  return [
    -H+hill(M+Math.max(0,u),currentThreshold(adapted,p.theta0),p.n),
    p.r*(-M+microbialResponse(H,p)+(p.gamma??.8)*D),
    mode==='instant'?0:p.epsilon*(targetA-A)
  ];
}
const plus=(a,b,m)=>a.map((x,i)=>x+m*b[i]);
export function rk4Step(y,dt,p,input,mode='memory',D=0){
  const k1=rightHandSide(y,input(0),p,mode,D);
  const k2=rightHandSide(plus(y,k1,dt/2),input(.5),p,mode,D);
  const k3=rightHandSide(plus(y,k2,dt/2),input(.5),p,mode,D);
  const k4=rightHandSide(plus(y,k3,dt),input(1),p,mode,D);
  const out=y.map((x,i)=>x+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
  const H=clamp(out[0],0,1),M=Math.max(0,out[1]);
  const target=p.target==='dose'?p.alpha*H-1.4*H*H:p.alpha*H;
  return [H,M,mode==='instant'?target:out[2]];
}
export function integrateStage(y, duration, inputAt, p, {mode='memory',D=0,step=.1,record=null,offset=0,tag=''}={}) {
  if(duration<=0) return y.slice();
  const N=Math.max(1,Math.ceil(duration/step)),dt=duration/N;
  let current=y.slice();
  for(let i=0;i<N;i++){
    const t=i*dt;
    if(record && (i%Math.max(1,Math.floor(N/180))===0))record.push({t:offset+t,H:current[0],M:current[1],A:current[2],phase:tag});
    current=rk4Step(current,dt,p,f=>inputAt(t+f*dt),mode,D);
  }
  if(record)record.push({t:offset+duration,H:current[0],M:current[1],A:current[2],phase:tag});
  return current;
}
export function runPeriodic(p=REFERENCE){
  const N=Math.ceil(p.T/.1),dt=p.T/N;
  const stride=Math.max(1,Math.floor(N*p.cycles/1150));
  let slow=[0,0,0],instant=[0,0,0];
  const points=[{t:0,u:0,H:0,Hinstant:0,M:0,A:0}];
  const cycleMetrics=[];
  for(let c=0;c<p.cycles;c++){
    let minH=slow[0],minInstant=instant[0];
    for(let j=0;j<N;j++){
      const tau=j*dt,input=f=>plaqueAt(tau+f*dt,p);
      if((c*N+j)%stride===0)points.push({t:c*p.T+tau,u:input(0),H:slow[0],Hinstant:instant[0],M:slow[1],A:slow[2]});
      minH=Math.min(minH,slow[0]); minInstant=Math.min(minInstant,instant[0]);
      slow=rk4Step(slow,dt,p,input);instant=rk4Step(instant,dt,p,input,'instant');
    }
    minH=Math.min(minH,slow[0]);minInstant=Math.min(minInstant,instant[0]);
    cycleMetrics.push({cycle:c+1,minH,minInstant,recallH:slow[0],recallInstant:instant[0],endA:slow[2]});
  }
  points.push({t:p.cycles*p.T,u:0,H:slow[0],Hinstant:instant[0],M:slow[1],A:slow[2]});
  const permanent=(key)=>{
    const ix=cycleMetrics.findIndex((v,i)=>v[key]>.5 && cycleMetrics.slice(i).every(x=>x[key]>.5));
    return ix<0?null:ix+1;
  };
  const first=(key,value)=>{
    const ix=cycleMetrics.findIndex(x=>x[key]>value);
    return ix<0?null:ix+1;
  };
  return {points,cycleMetrics,slow,instant,
    memoryConversion:permanent('minH'),instantConversion:permanent('minInstant'),
    firstInflamed:first('recallH',.5),firstDamaging:first('recallH',.8),
    instantFirstInflamed:first('recallInstant',.5),instantFirstDamaging:first('recallInstant',.8)};
}
export function forcingForEquilibrium(H,p=REFERENCE){
  const A=p.target==='dose'?(p.alpha*H-1.4*H*H):p.alpha*H;
  return currentThreshold(A,p.theta0)*Math.pow(H/(1-H),1/p.n)-microbialResponse(H,p);
}
export function equilibriaAtU(u,p=REFERENCE,D=0){
  // For fixed structural D: M*=G(H)+gamma*D. D is not an adaptive state here.
  const target=u+(p.gamma??.8)*D,roots=[];
  let prevH=1e-8,prev=forcingForEquilibrium(prevH,p)-target;
  for(let i=1;i<=3600;i++){
    const H=1e-8+(1-2e-8)*i/3600,val=forcingForEquilibrium(H,p)-target;
    if(prev*val<=0){let lo=prevH,hi=H,fl=prev;
      for(let j=0;j<52;j++){
        const mid=(lo+hi)/2,f=forcingForEquilibrium(mid,p)-target;
        if(fl*f<=0)hi=mid;else {lo=mid;fl=f;}
      }
      const root=(lo+hi)/2;
      if(!roots.length || root-roots.at(-1)>1e-5)roots.push(root);
    }
    prevH=H;prev=val;
  }
  return roots;
}
export function equilibriumState(u,p=REFERENCE,D=0,branch='low',mode='memory'){
  const roots=equilibriaAtU(u,p,D);
  if(!roots.length)throw new Error('No equilibrium at selected baseline');
  const H=branch==='high'?roots.at(-1):roots[0];
  const A=p.target==='dose'?p.alpha*H-1.4*H*H:p.alpha*H;
  return [H,microbialResponse(H,p)+(p.gamma??.8)*D,A];
}
function stagePair(a,b,duration,inputA,inputB,p,config,offset,points,phase){
  const apts=[],bpts=[];
  const a2=integrateStage(a,duration,inputA,p,{...config,record:apts,offset,tag:phase});
  const b2=integrateStage(b,duration,inputB,p,{...config,record:bpts,offset,tag:phase});
  for(let i=0;i<apts.length;i++)points.push({t:apts[i].t,naive:apts[i].H,treated:bpts[i].H,A:bpts[i].A,phase});
  return [a2,b2];
}
export function runRechallenge({epsilon=.03,recovery=0,amplitude=.5,duration=55,baseline=.2,control=4,protocol='treatment',r=1}={}){
  const p={...REFERENCE,epsilon,r};
  const roots=equilibriaAtU(baseline,p);
  if(roots.length<3)throw new Error('Reference treatment comparison requires a bistable baseline');
  let naive=equilibriumState(baseline,p),treated=equilibriumState(baseline,p,0,'high');
  const points=[];let t=0;
  if(protocol==='reset'){
    treated=[naive[0],naive[1],treated[2]];
    points.push({t,naive:naive[0],treated:treated[0],A:treated[2],phase:'reset'});
  }else{
    // Exp 14B: debridement sets M=0; complete plaque control is held for 4 units by default.
    treated[1]=0;
    [naive,treated]=stagePair(naive,treated,control,()=>baseline,()=>0,p,{},t,points,'plaque control');
    t+=control;
  }
  [naive,treated]=stagePair(naive,treated,recovery,()=>baseline,()=>baseline,p,{},t,points,'recovery');t+=recovery;
  const challengeStart=t, HAtChallenge=treated[0];
  [naive,treated]=stagePair(naive,treated,duration,()=>amplitude,()=>amplitude,p,{},t,points,'challenge');t+=duration;
  const challengeEnd=t;
  const plotFollow=Math.min(100,Math.max(35,1.5/epsilon));
  [naive,treated]=stagePair(naive,treated,plotFollow,()=>baseline,()=>baseline,p,{},t,points,'post-challenge');t+=plotFollow;
  // The classification is made after additional settling, not inferred from short plot extent.
  const extra=Math.max(0,10/epsilon-plotFollow);
  naive=integrateStage(naive,extra,()=>baseline,p);
  treated=integrateStage(treated,extra,()=>baseline,p);
  return {points,roots,naive,treated,naiveRelapse:naive[0]>.5,treatedRelapse:treated[0]>.5,
    challengeStart,challengeEnd,HAtChallenge,protocol,control,total:t};
}
/**
 * Experiment 14A-inspired challenge: a 21-day plaque accumulation challenge (12.6 model units),
 * k=.5 in model time, target peak U. D is fixed; no bone-loss inference is made.
 * We use the same treatment strategy as 14B and compare three histories under challenge.
 */
export function runGingivitis({epsilon=.03,recoveryDays=30,U=.4,baseline=.1,D=.1,challengeDays=21}={}){
  const p={...REFERENCE,epsilon},pc=4,rec=recoveryDays/UNIT_DAYS,ch=challengeDays/UNIT_DAYS;
  const histories=[
    {key:'naive',name:'Never diseased',D:0,y:equilibriumState(baseline,p)},
    {key:'treated',name:'Treated, no residual damage',D:0,y:equilibriumState(baseline,p,0,'high')},
    {key:'residual',name:'Treated, residual damage',D,y:equilibriumState(baseline,p,D,'high')},
  ];
  const all=[];let peaks=[],aucs=[];
  const plume=t=>U*(-Math.expm1(-.5*t))/(-Math.expm1(-.5*ch));
  for(const h of histories){
    let y=h.y.slice();
    if(h.key!=='naive'){
      y[1]=0;
      y=integrateStage(y,pc,()=>0,p,{D:h.D});
    }
    const therapySuccess=h.key==='naive'||y[0]<.5;
    y=integrateStage(y,rec,()=>baseline,p,{D:h.D});
    const trace=[];
    let auc=0,peak=y[0];
    // Numerical quadrature in model units, convert to illustrative days.
    const n=Math.ceil(ch/.1),dt=ch/n;
    for(let i=0;i<=n;i++){
      const t=i*dt;
      trace.push({t:t*UNIT_DAYS,H:y[0],A:y[2]});
      peak=Math.max(peak,y[0]);
      if(i===n)break;
      const next=rk4Step(y,dt,p,f=>plume(t+f*dt),'memory',h.D);
      auc+=(y[0]+next[0])/2*dt*UNIT_DAYS;
      y=next;
    }
    peaks.push({key:h.key,value:peak});aucs.push({key:h.key,value:auc});all.push({...h,trace,peak,auc,therapySuccess});
  }
  return {histories:all,peaks,aucs,challengeDays,recoveryDays};
}
