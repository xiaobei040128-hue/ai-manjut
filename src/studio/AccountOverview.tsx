import {translateText as tx,localizeNode as lx} from '../i18n/translate';
import {PaymentIcon as CardStackIcon} from './PlatformIcons';
import {useEffect,useState} from 'react';
import {ChevronRightIcon} from '@radix-ui/react-icons';
import {api} from '../api';
import type {FinanceSnapshot} from '../finance';
export function AccountReadiness({onWallet}:{onWallet:()=>void}){
 const [data,setData]=useState<FinanceSnapshot|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api<FinanceSnapshot>('/finance').then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const count=data?.cards.filter(c=>c.provider==='bank').length||0;
 return <section className="v3-account"><header><div><span>{tx('ACCOUNT DETAILS')}</span><h2>{tx('收款方式')}</h2></div><span className={'v3-account-badge '+(data?.account.frozen?'warning':'')}>{lx(data?data.account.frozen?'账号已冻结':'账号正常':error?'暂未获取':'读取中')}</span></header>{data&&<button className="v3-account-row" onClick={onWallet}><span><CardStackIcon/></span><div><b>{tx('银行卡')}</b><small>{tx('查看与管理本人的收款方式')}</small></div><em>{count}{tx(' 个已添加')}</em><ChevronRightIcon/></button>}{error&&<p className="v3-inline-error" role="alert">{tx(error)}</p>}</section>;
}
