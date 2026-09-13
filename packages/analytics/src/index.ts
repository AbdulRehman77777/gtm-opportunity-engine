export interface StageCount { stage: string; count: number; }
export interface ConversionMetric { from: string; to: string; fromCount: number; toCount: number; rate: number | null; }

export function calculateFunnelConversions(stages: string[], counts: StageCount[]): ConversionMetric[] {
  const byStage = new Map(counts.map((item) => [item.stage, item.count]));
  return stages.slice(1).map((to, index) => {
    const from = stages[index]!; const fromCount = byStage.get(from) ?? 0; const toCount = byStage.get(to) ?? 0;
    return { from, to, fromCount, toCount, rate: fromCount ? toCount / fromCount : null };
  });
}

export function revenuePerAction(revenueCents: number, actions: number): number | null {
  return actions > 0 ? revenueCents / actions : null;
}

export type CohortRow={cohort:string;sampleSize:number;successCount:number;rate:number;baselineRate:number;difference:number;reliability:'LOW'|'MEDIUM'|'HIGH'};
export function cohortAnalysis<T>(rows:T[],group:(row:T)=>string,outcome:(row:T)=>boolean,minSample=10):CohortRow[]{const baseline=rows.length?rows.filter(outcome).length/rows.length:0;const groups=new Map<string,{n:number;wins:number}>();for(const row of rows){const key=group(row),value=groups.get(key)??{n:0,wins:0};value.n++;if(outcome(row))value.wins++;groups.set(key,value);}return [...groups].map(([cohort,value])=>({cohort,sampleSize:value.n,successCount:value.wins,rate:value.n?value.wins/value.n:0,baselineRate:baseline,difference:value.n?value.wins/value.n-baseline:0,reliability:reliability(value.n,value.wins)})).filter(row=>row.sampleSize>=minSample).sort((a,b)=>b.rate-a.rate);}
export function reliability(sampleSize:number,positiveCount:number):'LOW'|'MEDIUM'|'HIGH'{if(sampleSize>=100&&positiveCount>=15)return'HIGH';if(sampleSize>=30&&positiveCount>=5)return'MEDIUM';return'LOW';}

export type TrainingRow={features:number[];label:0|1;occurredAt:string};
export type LogisticModel={intercept:number;coefficients:number[];means:number[];scales:number[]};
export function modelEligibility(rows:TrainingRow[],minimumSamples=100,minimumPositives=15){const positives=rows.reduce((sum,row)=>sum+row.label,0);return{eligible:rows.length>=minimumSamples&&positives>=minimumPositives&&(rows.length-positives)>=minimumPositives,sampleSize:rows.length,positiveCount:positives,reason:rows.length<minimumSamples?'INSUFFICIENT_SAMPLES':positives<minimumPositives?'INSUFFICIENT_POSITIVES':rows.length-positives<minimumPositives?'INSUFFICIENT_NEGATIVES':'ELIGIBLE'};}
export function trainLogisticRegression(rows:TrainingRow[],iterations=500,learningRate=.08,l2=.01):LogisticModel{if(!rows.length)throw new Error('Training data is empty');const width=rows[0]!.features.length,means=Array(width).fill(0) as number[],scales=Array(width).fill(1) as number[];for(let j=0;j<width;j++){means[j]=rows.reduce((s,r)=>s+(r.features[j]??0),0)/rows.length;const variance=rows.reduce((s,r)=>s+((r.features[j]??0)-means[j]!)**2,0)/rows.length;scales[j]=Math.sqrt(variance)||1;}let intercept=0;const coefficients=Array(width).fill(0) as number[];for(let step=0;step<iterations;step++){let biasGrad=0;const grads=Array(width).fill(0) as number[];for(const row of rows){const x=row.features.map((v,j)=>(v-means[j]!)/scales[j]!);const p=sigmoid(intercept+x.reduce((s,v,j)=>s+v*coefficients[j]!,0)),error=p-row.label;biasGrad+=error;for(let j=0;j<width;j++)grads[j]!+=error*x[j]!;}intercept-=learningRate*biasGrad/rows.length;for(let j=0;j<width;j++)coefficients[j]!-=learningRate*(grads[j]!/rows.length+l2*coefficients[j]!);}return{intercept,coefficients,means,scales};}
export function predictProbability(model:LogisticModel,features:number[]){const z=model.intercept+features.reduce((sum,value,index)=>sum+((value-model.means[index]!)/model.scales[index]!)*model.coefficients[index]!,0);return sigmoid(z);}
export function evaluateProbability(labels:number[],probabilities:number[]){if(labels.length!==probabilities.length||!labels.length)throw new Error('Evaluation arrays must have equal non-zero length');const brier=labels.reduce((s,y,i)=>s+(probabilities[i]!-y)**2,0)/labels.length;const threshold=.5,tp=labels.filter((y,i)=>y===1&&probabilities[i]!>=threshold).length,fp=labels.filter((y,i)=>y===0&&probabilities[i]!>=threshold).length,fn=labels.filter((y,i)=>y===1&&probabilities[i]!<threshold).length;return{brierScore:brier,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,rocAuc:rocAuc(labels,probabilities),calibrationStatus:brier<=.18?'GOOD':brier<=.25?'FAIR':'POOR'};}
function sigmoid(value:number){return 1/(1+Math.exp(-Math.max(-30,Math.min(30,value))));}
function rocAuc(labels:number[],scores:number[]){const positives=labels.filter(Boolean).length,negatives=labels.length-positives;if(!positives||!negatives)return null;const ranked=scores.map((score,i)=>({score,label:labels[i]!})).sort((a,b)=>a.score-b.score);let rankSum=0;ranked.forEach((row,index)=>{if(row.label)rankSum+=index+1;});return(rankSum-positives*(positives+1)/2)/(positives*negatives);}
