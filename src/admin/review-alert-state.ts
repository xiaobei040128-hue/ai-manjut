export interface ReviewItem {id:string;status:string;created_at?:string;kind?:string}
export interface ReviewSnapshot {identities?:ReviewItem[];requests?:ReviewItem[]}
export function pendingReviews(data:ReviewSnapshot){
 const identities=(data.identities||[]).filter(x=>x.status==='review');
 const withdrawals=(data.requests||[]).filter(x=>x.status==='review'&&x.kind==='withdrawal');
 const keys=[...identities.map(x=>'identity:'+x.id+':'+(x.created_at||'')),...withdrawals.map(x=>'withdrawal:'+x.id+':'+(x.created_at||''))];
 return {identities:identities.length,withdrawals:withdrawals.length,keys};
}
export function newReviewKeys(previous:Set<string>|null,next:string[]){return previous===null?[]:next.filter(key=>!previous.has(key));}
