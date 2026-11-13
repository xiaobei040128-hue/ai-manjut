import {translateText as tx} from '../i18n/translate';
import type {DepositChannelSettings} from '../finance';
import ChannelIcon from '../ChannelIcon';
import {depositCopy,type DepositLocale} from './deposit-copy';
export default function DepositChannelPicker({settings,error,onChannel,locale}:{settings:DepositChannelSettings|null;group:string;error:string;onGroup:(group:string)=>void;onChannel:(id:string)=>void;locale:DepositLocale}){
 const t=depositCopy(locale);if(error)return <p role="alert">{tx(error)}</p>;if(!settings)return <p role="status">{tx(t.loading)}</p>;
 return <div className="deposit-type-list"><button type="button" onClick={()=>onChannel('bank_wire')}><span className="deposit-type-logos bank"><ChannelIcon id="bank_wire"/></span><span><b>{tx(t.bank)}</b><small>{tx(t.bankHint)}</small></span><i aria-hidden="true">›</i></button></div>;
}
