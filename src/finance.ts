export interface FinanceIdentity{has_photos:boolean;id:string;user_id:string;name:string;document_type:string;number_mask:string;status:string;note:string;created_at:string}
export interface FinanceCard{id:string;user_id:string;bank:string;holder:string;number_mask:string;status:string;note:string;created_at:string}
export interface FundRequest{id:string;user_id:string;kind:string;amount:number;card_id:string|null;bank?:string;number_mask?:string;reference:string;status:string;note:string;created_at:string;reviewed_at:string;paid_at:string}
export interface FinanceSnapshot{identity:FinanceIdentity|null;cards:FinanceCard[];requests:FundRequest[];account:{frozen:boolean;freeze_reason:string}}
export const financeStatus=(status:string,kind='')=>({review:'审核中',approved:'已通过',rejected:'未通过',paying:'出款中',paid:'已出款',completed:kind==='deposit'?'已到账':'已完成'}[status]||status);
