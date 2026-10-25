import {money} from '../api';
import './purchase-balance.css';
export default function PurchaseBalance({amount,available,returnDesign}:{amount:number;available:number|null;returnDesign:string}){
 if(available===null)return <p className="purchase-balance-pending" role="status">正在核对可用余额，请稍候…</p>;
 const deduction=Math.min(amount,Math.max(0,available)),shortfall=amount-deduction;
 const query=new URLSearchParams({view:'app',page:'wallet',finance:'deposit',amount:(Math.max(100,shortfall)/100).toFixed(2),returnDesign});
 return <div className="purchase-balance" aria-label="购买金额明细"><dl><div><dt>当前可用余额</dt><dd>{money(available)}</dd></div><div><dt>余额可抵扣</dt><dd>− {money(deduction)}</dd></div><div className="purchase-balance-total"><dt>还需补足金额</dt><dd>{money(shortfall)}</dd></div></dl><p>{shortfall>0?'补足差额到账后，再确认购买。任务已保留，当前余额尚未扣款。':'余额足够，确认购买后将一次性扣款。'}</p>{shortfall>0&&shortfall<100&&<p>最低充值 $1.00，多余金额留在可用余额。</p>}{shortfall>0&&<a className="purchase-topup" href={'/?'+query.toString()}>{shortfall<100?'充值':'补足差额'} · {money(Math.max(100,shortfall))} <span aria-hidden="true">→</span></a>}</div>;
}
