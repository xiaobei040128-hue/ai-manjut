import {translateText as tx} from '../i18n/translate';
import type {Dispatch,SetStateAction} from 'react';
import {KeyboardInput} from '../mobile';
import './payout-method-fields.css';
export default function PayoutMethodFields({form,setForm}:{form:Record<string,string>;setForm:Dispatch<SetStateAction<Record<string,string>>>}){
 return <div className="payout-fields">{[['银行名称','bank','填写银行名称，可附 SWIFT / BIC'],['账户姓名','holder','填写银行账户持有人姓名'],['银行账号 / IBAN','number','填写本人银行收款账号']].map(([label,key,hint])=><label key={key}>{tx(label)}<KeyboardInput required autoComplete="off" maxLength={key==='number'?60:key==='holder'?50:80} value={form[key]||''} placeholder={tx(hint)} onChange={e=>setForm(old=>({...old,provider:'bank',[key]:e.target.value}))}/></label>)}</div>;
}
