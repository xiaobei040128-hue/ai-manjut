import {usePermission} from './PermissionContext';
import CustomerFundPassword from './CustomerFundPassword';
import { useEffect, useRef, useState } from "react";
import { api, date, money } from "../api";
import { countryName } from "../countries";
import { Modal, Badge } from "./components";
import { type Customer, identityLabel, geoLabel, customerTypeLabel } from "./customerTypes";
export default function CustomerDetails({
  customer: u,
  onClose,
  onRefresh,
  inline=false,
}: {
  inline?:boolean;
  customer: Customer;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const can=usePermission();
  const [note, setNote] = useState(u.admin_note),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [password,setPassword]=useState(''),[temporaryPassword,setTemporaryPassword]=useState(''),[passwordConfirm,setPasswordConfirm]=useState<'change'|'reset'|null>(null);
  useEffect(()=>{setPassword('');setTemporaryPassword('');setPasswordConfirm(null);},[u.id]);
  async function savePassword(mode:'change'|'reset'){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setSuccess('');setTemporaryPassword('');
    try{const result=await api<{temporaryPassword?:string}>('/admin/accounts/'+u.id+'/password','POST',{mode,...(mode==='change'?{password}:{})});if(!alive.current)return;setTemporaryPassword(result.temporaryPassword||'');setPassword('');setPasswordConfirm(null);setSuccess('密码已更新，旧登录会话已失效。');await onRefresh();}catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const alive=useRef(true),lock=useRef(false);
  const [customerType,setCustomerType] = useState(u.customer_type || 'real');
  const noteBaseline=useRef(u.admin_note),typeBaseline=useRef(u.customer_type||'real');
  useEffect(()=>{setNote(u.admin_note);noteBaseline.current=u.admin_note;setCustomerType(u.customer_type||'real');typeBaseline.current=u.customer_type||'real';},[u.id]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function action(kind: "notes" | "revoke-sessions" | "customer-type") {
    if (lock.current) return;
    lock.current=true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(
        "/admin/accounts/" + u.id + "/" + kind,
        "POST",
        kind === "notes" ? { note,expectedNote:noteBaseline.current } : kind === 'customer-type' ? { customerType,expectedCustomerType:typeBaseline.current } : {},
      );
      if(!alive.current)return;
      if(kind==='notes')noteBaseline.current=note.trim();
      if(kind==='customer-type')typeBaseline.current=customerType;
      setSuccess(
        kind === 'customer-type' ? '客户类型已保存为'+customerTypeLabel(customerType) : kind === "notes"
          ? "内部备注已保存"
          : "已退出此客户的全部设备，需要重新登录",
      );
      setConfirm(false);
      try { await onRefresh(); } catch { if(alive.current)setError("操作已保存，客户列表暂未刷新；请刷新核对，无需重复操作。"); }
    } catch (e) {
      if(alive.current)setError((e as Error).message);
    } finally {
      lock.current=false;
      if(alive.current)setBusy(false);
    }
  }
  return (
    <CustomerFrame
      inline={inline}
      title="客户档案"
      description={u.email}
      onClose={() => !busy && onClose()}
    >
      <div className="ad-customer-detail">
        <div className="ad-customer-heading">
          <h3>{u.name}</h3>
          <Badge tone={u.frozen ? "red" : "green"}>
            {u.frozen ? "已冻结" : "正常"}
          </Badge>
          <Badge tone={u.identity_status === "approved" ? "green" : "amber"}>
            {identityLabel(u.identity_status)}
          </Badge>
        </div>
        <dl className="ad-customer-grid">
          <dt>账号编号</dt>
          <dd>{u.id}</dd>
          <dt>注册时间</dt>
          <dd>{date(u.created_at, true)}</dd>
          <dt>国家 / 地区</dt>
          <dd>
            {geoLabel(u)}
            {u.country && " · IP 自动识别"}
          </dd>
          <dt>注册国家</dt>
          <dd>
            {u.registration_country
              ? countryName(u.registration_country)
              : "未识别"}
          </dd>
          <dt>注册 IP</dt>
          <dd>{u.registration_ip || "历史记录未采集"}</dd>
          <dt>最近登录 IP</dt>
          <dd>{u.last_login_ip || "尚无记录"}</dd>
          <dt>最近登录</dt>
          <dd>
            {u.last_login_at ? date(u.last_login_at, true) : "历史记录未采集"}
          </dd>
          <dt>登录设备</dt>
          <dd>{u.last_login_agent || "尚无记录"}</dd>
          <dt>有效登录会话</dt>
          <dd>{u.session_count} 个</dd>
          <dt>归属后台</dt>
          <dd>{u.agent_username}</dd>
          <dt>注册邀请码</dt>
          <dd>
            {u.invite_code || "旧邀请码"} · {u.invite_label}
          </dd>
          <dt>邮箱验证</dt>
          <dd>未验证（当前不启用邮件验证码）</dd>
          {!!u.frozen && (
            <>
              <dt>冻结原因</dt>
              <dd>{u.freeze_reason}</dd>
            </>
          )}
        </dl>
        <h4>账户资金 · USD</h4>
        <div className="ad-customer-balances">
          <div>
            <span>可用余额</span>
            <b>{money(u.wallet.available)}</b>
          </div>
          <div>
            <span>冻结金额</span>
            <b>{money(u.wallet.held)}</b>
          </div>
          <div>
            <span>账户合计</span>
            <b>{money(u.wallet.total)}</b>
          </div>
        </div>
        <dl className="ad-customer-grid">
          <dt>任务冻结</dt>
          <dd>{money(u.wallet.taskHeld)}</dd>
          <dt>提现冻结</dt>
          <dd>{money(u.wallet.withdrawalHeld)}</dd>
          <dt>累计任务佣金</dt>
          <dd>{money(u.wallet.earned)}</dd>
          <dt>审核入账充值</dt>
          <dd>{money(u.deposited)}</dd>
          <dt>已出款提现</dt>
          <dd>{money(u.withdrawn)}</dd>
        </dl>
        <h4>任务与审批</h4>
        <p>
          {u.counts.active} 项进行中 · {u.counts.review} 项作品待审 ·{" "}
          {u.counts.completed} 项完成
        </p>
        <p>
          {u.approved_cards} 个提款方式已保存 · {u.pending_cards} 个提款方式待审 ·{" "}
          {u.pending_funds} 笔资金申请待审
        </p>
        {!inline&&<a
          className="ad-button secondary small"
          href={"/admin#finance?customer=" + encodeURIComponent(u.email)}
        >
          进入资金与认证审批
        </a>}
        <div className="customer-type-setting">
          <label>客户类型<select aria-label="设置客户类型" value={customerType} disabled={busy} onChange={e=>setCustomerType(e.target.value as 'real'|'test')}><option value="real">真实客户</option><option value="test">测试账号</option></select></label>
          <button className="ad-button small" disabled={!can('customerEdit')||busy||customerType===(u.customer_type||'real')} onClick={()=>void action('customer-type')}>保存客户类型</button>
          <p>仅用于后台分类与筛选，不改变余额、流水及任务进度。</p>
        </div>
        <section className="customer-login-setting">
          <h4>登录账号与密码</h4>
          <label>登录账号<input readOnly value={u.email} aria-label="客户登录账号" /></label>
          <p>密码已加密保存，无法查看原文。修改或重置后，客户需要重新登录。</p>
          <label>新密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>{setPassword(e.target.value);setPasswordConfirm(null);}} placeholder="输入 8–128 位新密码" /></label>
          <div className="ad-row-actions"><button className="ad-button small" disabled={!can('customerSecurity')||busy||password.length<8} onClick={()=>setPasswordConfirm('change')}>修改密码</button><button className="ad-button secondary small" disabled={!can('customerSecurity')||busy} onClick={()=>setPasswordConfirm('reset')}>生成临时密码</button></div>
          {passwordConfirm&&<div className="ad-callout"><p>{passwordConfirm==='reset'?'确认生成新的临时密码？':'确认使用输入的新密码？'}旧密码和现有登录会话将失效。</p><div className="ad-row-actions"><button className="ad-button small" disabled={!can('customerSecurity')||busy} onClick={()=>void savePassword(passwordConfirm)}>{busy?'正在更新…':'确认更新密码'}</button><button className="ad-button secondary small" disabled={busy} onClick={()=>setPasswordConfirm(null)}>取消</button></div></div>}
          {temporaryPassword&&<div className="ad-callout" role="status"><label>临时密码（仅本次显示）<input readOnly value={temporaryPassword} aria-label="生成的临时密码" /></label><button className="ad-button secondary small" onClick={()=>void navigator.clipboard.writeText(temporaryPassword)}>复制临时密码</button><button className="ad-text" onClick={()=>setTemporaryPassword('')}>隐藏</button></div>}
        </section>
        <CustomerFundPassword key={u.id} customerId={u.id}/>
        <label className="ad-customer-note">
          内部备注
          <textarea
            maxLength={1000}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="仅管理员可见，记录跟进事项，不填写密码或证件号码"
          />
        </label>
        {error && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="ad-callout" role="status">
            {success}
          </p>
        )}
        <div className="ad-row-actions">
          <button
            className="ad-button small"
            disabled={busy}
            onClick={() => void action("notes")}
          >
            保存内部备注
          </button>
          <button
            className="ad-button secondary small"
            disabled={busy}
            onClick={() => setConfirm(!confirm)}
          >
            退出全部登录设备
          </button>
        </div>
        {confirm && (
          <div className="ad-callout amber">
            <p>将使此客户所有登录会话失效，不改变资金和账号状态。</p>
            <button
              className="ad-button small"
              disabled={busy}
              onClick={() => void action("revoke-sessions")}
            >
              确认退出全部设备
            </button>
          </div>
        )}
      </div>
    </CustomerFrame>
  );
}

function CustomerFrame({inline,children,...props}:{inline:boolean;children:React.ReactNode;title:string;description:string;onClose:()=>void}){return inline?<section className="ad-panel customer-details-panel">{children}</section>:<Modal {...props}>{children}</Modal>;}
