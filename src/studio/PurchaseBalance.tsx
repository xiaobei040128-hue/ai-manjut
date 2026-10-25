import {money} from '../api';
import './purchase-balance.css';
export default function PurchaseBalance({amount,available,reservedAmount,returnDesign}:{amount:number;available:number|null;reservedAmount?:number|null;returnDesign:string}){
 if(available===null||reservedAmount===null)return <p className="purchase-balance-pending" role="status">正在核对可用余额，请稍候…</p>;
 const reserved=reservedAmount!==undefined;
 const deduction=reserved?reservedAmount:Math.min(amount,Math.max(0,available)),shortfall=Math.max(0,amount-deduction);
 const query=new URLSearchParams({view:'app',page:'wallet',finance:'deposit',amount:(Math.max(100,shortfall)/100).toFixed(2),returnDesign});
 return <div className={'purchase-balance'+(reserved?' has-reservation':'')} aria-label="购买金额明细"><dl>{!reserved&&<div><dt>可用余额</dt><dd>{money(available)}</dd></div>}<div><dt>{reserved?'已抵扣':'余额抵扣'}</dt><dd>{reserved?'':'− '}{money(deduction)}</dd></div><div className="purchase-balance-total"><dt>待补金额</dt><dd>{money(shortfall)}</dd></div></dl><p>{shortfall>0?(reserved?(deduction>0?'已抵扣余额仅用于本单，可取消领取退回。':'补齐款项后，即可完成本单购买。'):'任务已保留，补齐差额后即可购买。确认前尚未扣款。'):(reserved?'款项已备齐，确认后完成版权购买。':'余额充足，可直接确认购买。')}</p>{shortfall>0&&shortfall<100&&<p>最低充值 $1.00，多余金额留在可用余额。</p>}{shortfall>0&&<a className="purchase-topup" href={'/?'+query.toString()}>{shortfall<100?'充值':'补齐差额'} · {money(Math.max(100,shortfall))} <span aria-hidden="true">→</span></a>}</div>;
}
