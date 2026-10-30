import {CHECK_THRESHOLD} from './ai-schema.ts';
export function calibrationMetrics(rows:any[],fingerprint:string){
 const cases=rows.filter(x=>x.fingerprint===fingerprint);const accepted=cases.filter(x=>x.output.verdict==='valid'&&x.output.confidence>=CHECK_THRESHOLD);const correct=accepted.filter(x=>x.expectedValid===true).length;const n=accepted.length;const p=n?correct/n:0;const z=1.96;const lower=n?(p+z*z/(2*n)-z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/(1+z*z/n):0;
 const invalid=cases.filter(x=>!x.expectedValid).length;const valid=cases.length-invalid;
 return {samples:cases.length,valid,invalid,accepted:n,correct,precision:p,precisionLower95:lower,threshold:CHECK_THRESHOLD,ready:cases.length>=100&&valid>=20&&invalid>=20&&n>=80&&lower>=CHECK_THRESHOLD,fingerprint};
}
