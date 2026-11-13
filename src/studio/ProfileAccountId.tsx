import {copyTaskCode as copyText} from './task-clipboard';
import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import {useState} from 'react';
import {CopyIcon,CheckIcon} from '@radix-ui/react-icons';
import './profile-account-id.css';
export default function ProfileAccountId({id}:{id:string}){const [copied,setCopied]=useState(false),[error,setError]=useState('');return <div className="profile-account-id"><span>{tx("用户编号")}</span><b>{lx(id.slice(0,8).toUpperCase())}</b><button type="button" aria-label={tx("复制完整用户编号")} onClick={()=>void copyText(id).then(()=>{setCopied(true);setError('');}).catch(()=>setError('复制失败，请稍后重试'))}>{lx(copied?<CheckIcon/>:<CopyIcon/>)}<span>{lx(copied?'已复制':'复制')}</span></button>{lx(error&&<small role="alert">{lx(error)}</small>)}</div>;}
