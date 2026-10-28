import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {ExternalLinkIcon,ChevronDownIcon,CheckCircledIcon,ClockIcon,Pencil1Icon} from '@radix-ui/react-icons';
import {date,type Submission} from '../api';

export default function SubmissionHistory({submissions}:{submissions:Submission[]}) {
 return <div className="s-history-list">
  <p className="s-field-help">{tx("每次提交都会保留独立版本，审核意见与当时的附件不会被后续修改覆盖。")}</p>
  {lx(submissions.map((s,index)=><details key={s.id} open={index===0} className="s-history-version">
   <summary><span><b>{tx("第 ")}{lx(s.version)}{tx(" 次提交")}</b><small>{lx(date(s.created_at,true))}</small></span><em className={s.status}>{lx(s.status==='approved'?<CheckCircledIcon/>:s.status==='changes'?<Pencil1Icon/>:<ClockIcon/>)}{lx(s.status==='approved'?'审核通过':s.status==='changes'?'退回修改':'等待审核')}</em><ChevronDownIcon/></summary>
   <div className="s-history-content">
    {lx(s.reviewed_at&&<p className="s-history-reviewed">{tx("审核时间：")}{lx(date(s.reviewed_at,true))}</p>)}
    {lx(s.review_note&&<div className="s-feedback"><Pencil1Icon/><div><b>{tx("本次审核意见")}</b><p>{lx(s.review_note)}</p></div></div>)}
    <div className="s-submission-links">{lx(s.links.map((link,i)=><a href={link} target="_blank" rel="noreferrer" key={link}><span>{lx(i+1)}</span><div><b>{tx("视频链接 ")}{lx(i+1)}</b><small>{lx(link)}</small></div><ExternalLinkIcon/></a>))}</div>
    <div className="s-proof-grid">{lx(s.uploads.map(u=><a href={u.path} target="_blank" rel="noreferrer" key={u.id} aria-label={tx('打开历史截图 '+u.name)}><img loading="lazy" src={u.path} alt={tx(u.name)}/></a>))}</div>
    {lx(s.note&&<p className="s-submission-note">{tx("创作备注：")}{lx(s.note)}</p>)}
   </div>
  </details>))}
 </div>;
}
