export function createDailyExample(balance,random=Math.random){
 if(!Number.isSafeInteger(balance)||balance<0||balance>100000000)throw new Error('Invalid example balance');
 const int=(min,max)=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid random source');return min+Math.floor(n*(max-min+1));};
 return Array.from({length:int(12,15)},(_,i)=>{const portion=int(1500,7500),rate=int(200,500),amount=Math.round(balance*portion/10000);return {sequence:i+1,portion,amount,rate,commission:Math.round(amount*rate/10000)};});
}
