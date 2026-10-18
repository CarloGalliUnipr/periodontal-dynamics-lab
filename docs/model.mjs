/**
 * Educational, dimensionless periodontal-response model.
 * Based on the equations described in the draft manuscript, not fitted patient data.
 * No external dependencies; shared by the browser and automated numerical checks.
 */
export const REFERENCE = Object.freeze({
  theta0: 0.8, n: 4, q: 4, K: 0.9, r: 1, alpha: 1,
  epsilon: 0.01, k: 0.05, T: 60, peak: 0.575, cycles: 60,
});
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export function hill(signal, threshold, exponent) {
  const s = Math.max(0, signal), th = Math.max(1e-12, threshold);
  if (s === 0) return 0;
  const ratio = Math.pow(th / s, exponent);
  return 1 / (1 + ratio);
}
export function microbialResponse(H, p = REFERENCE) {
  return hill(clamp(H, 0, 1), p.K, p.q);
}
export function currentThreshold(A, theta0 = REFERENCE.theta0) {
  return theta0 * Math.exp(-A);
}
export function plaqueAt(tau, { peak, T, k }) {
  const phase = Math.max(0, Math.min(T, tau));
  const denominator = -Math.expm1(-k * T);
  return peak * (-Math.expm1(-k * phase)) / denominator;
}
export function rightHandSide(y, u, p, mode = 'memory') {
  const [H, M, A] = y;
  const adaptive = mode === 'instant' ? p.alpha * H : A;
  const theta = currentThreshold(adaptive, p.theta0);
  return [
    -H + hill(M + Math.max(0, u), theta, p.n),
    p.r * (-M + microbialResponse(H, p)),
    mode === 'instant' ? 0 : p.epsilon * (p.alpha * H - A),
  ];
}
function addScale(y, derivatives, scale) {
  return y.map((v, i) => v + scale * derivatives[i]);
}
export function rk4Step(y, dt, p, input, mode = 'memory') {
  const k1 = rightHandSide(y, input(0), p, mode);
  const k2 = rightHandSide(addScale(y, k1, dt / 2), input(0.5), p, mode);
  const k3 = rightHandSide(addScale(y, k2, dt / 2), input(0.5), p, mode);
  const k4 = rightHandSide(addScale(y, k3, dt), input(1), p, mode);
  const out = y.map((v, i) => v + dt * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]) / 6);
  return [clamp(out[0], 0, 1), clamp(out[1], 0, 1), mode === 'instant' ? p.alpha*clamp(out[0],0,1) : out[2]];
}
export function runPeriodic(p = REFERENCE) {
  const stepsPerCycle = Math.ceil(p.T / 0.16);
  const dt = p.T / stepsPerCycle;
  const interval = Math.max(1, Math.floor((stepsPerCycle * p.cycles) / 1100));
  let slow = [0, 0, 0], instant = [0, 0, 0];
  const points = [{t:0, u:0, H:0, Hinstant:0, M:0, A:0, theta:p.theta0}];
  const cycleMetrics = [];
  for (let cycle = 0; cycle < p.cycles; cycle++) {
    let lowSlow = slow[0], lowInstant = instant[0];
    for (let j = 0; j < stepsPerCycle; j++) {
      const tau = j * dt;
      const input = frac => plaqueAt(tau + frac*dt, p);
      const u = input(0);
      lowSlow = Math.min(lowSlow, slow[0]);
      lowInstant = Math.min(lowInstant, instant[0]);
      const tick = cycle*stepsPerCycle+j;
      if (tick % interval === 0) {
        points.push({t:cycle*p.T+tau, u, H:slow[0], Hinstant:instant[0], M:slow[1], A:slow[2], theta:currentThreshold(slow[2], p.theta0)});
      }
      slow = rk4Step(slow, dt, p, input, 'memory');
      instant = rk4Step(instant, dt, p, input, 'instant');
    }
    lowSlow = Math.min(lowSlow, slow[0]);
    lowInstant = Math.min(lowInstant, instant[0]);
    cycleMetrics.push({cycle:cycle+1, minH:lowSlow, minInstant:lowInstant, endH:slow[0], endA:slow[2]});
  }
  points.push({t:p.cycles*p.T,u:0,H:slow[0],Hinstant:instant[0],M:slow[1],A:slow[2],theta:currentThreshold(slow[2],p.theta0)});
  const conversion = arr => {
    const i = arr.findIndex((v, k) => v > 0.5 && arr.slice(k).every(x => x > 0.5));
    return i < 0 ? null : i+1;
  };
  return {points, cycleMetrics, slow, instant, memoryConversion:conversion(cycleMetrics.map(x=>x.minH)), instantConversion:conversion(cycleMetrics.map(x=>x.minInstant))};
}
export function forcingForEquilibrium(H, uParams) {
  const p = uParams;
  return currentThreshold(p.alpha*H, p.theta0) * Math.pow(H/(1-H), 1/p.n) - microbialResponse(H, p);
}
export function equilibriaAtU(u, p=REFERENCE) {
  const count=2400, roots=[];
  let prevH=1e-7, prev=forcingForEquilibrium(prevH,p)-u;
  for(let i=1;i<=count;i++) {
    let h=i/count*(1-2e-7)+1e-7;
    const val=forcingForEquilibrium(h,p)-u;
    if(prev*val<0 || val===0) {
      let lo=prevH,hi=h,fl=prev;
      for(let j=0;j<55;j++) {
        const mid=(lo+hi)/2, fm=forcingForEquilibrium(mid,p)-u;
        if(fl*fm<=0){hi=mid;}else{lo=mid;fl=fm;}
      }
      const root=(lo+hi)/2;
      if(!roots.length || root-roots[roots.length-1]>1e-4) roots.push(root);
    }
    prevH=h;prev=val;
  }
  return roots;
}
export function runRechallenge({epsilon=0.03,recovery=0,amplitude=0.60,duration=55,baseline=0.20}={}) {
  const p={...REFERENCE,epsilon};
  const roots=equilibriaAtU(baseline,p);
  if(roots.length<3) throw new Error('The reference post-therapy example requires three equilibria.');
  const low=roots[0], high=roots[roots.length-1], M=microbialResponse(low,p);
  let naive=[low,M,p.alpha*low], treated=[low,M,p.alpha*high];
  const settle=120,total=recovery+duration+settle,dtNom=0.15,N=Math.ceil(total/dtNom),dt=total/N;
  const every=Math.max(1,Math.floor(N/1000)),points=[];
  let treatedRelapse=false,naiveRelapse=false;
  for(let i=0;i<=N;i++) {
    const t=i*dt;
    if(i%every===0||i===N) points.push({t,naive:naive[0],treated:treated[0],A:treated[2]});
    if(i===N) break;
    const input=(frac)=>{const time=t+frac*dt;return time>=recovery&&time<recovery+duration?amplitude:baseline;};
    naive=rk4Step(naive,dt,p,input,'memory');
    treated=rk4Step(treated,dt,p,input,'memory');
  }
  treatedRelapse=treated[0]>0.5; naiveRelapse=naive[0]>0.5;
  return {points,roots,low,high,naive,treated,naiveRelapse,treatedRelapse,total};
}
