type CompletedAssignment={id:string;status:string;task:{premium?:number;stage:number}};
export function premiumSettlement<T extends CompletedAssignment>(expectedId:string,result:{first?:boolean;assignment:T}):T|null {
 const a=result.assignment;
 return result.first===true&&a.id===expectedId&&a.status==='completed'&&a.task.stage===3&&!!a.task.premium?a:null;
}
