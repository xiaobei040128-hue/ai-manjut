// Keep unchanged network records stable so background refreshes do not repaint lists.
export function createTaskRowCache<T extends {id:string}>(){
 let rows:T[]=[],signatures:string[]=[];
 return (next:T[]):T[]=>{
  const previous=new Map(rows.map((row,i)=>[row.id,{row,signature:signatures[i]}]));
  const encoded=next.map(row=>JSON.stringify(row));
  const shared=next.map((row,i)=>{const old=previous.get(row.id);return old?.signature===encoded[i]?old.row:row;});
  if(shared.length===rows.length&&shared.every((row,i)=>row===rows[i]))return rows;
  rows=shared;signatures=encoded;return rows;
 };
}
