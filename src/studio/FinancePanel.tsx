import type {SupportIdentity} from './support-identity';
import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import PayoutDestinationPicker from './PayoutDestinationPicker';
import {payoutMethodName} from '../finance';
import ChannelIcon from '../ChannelIcon';
import withdrawalPolicy from '../../shared/withdrawal-policy.json';
import PayoutMethodFields from './PayoutMethodFields';
import WalletOverview from './WalletOverview';
import {channelName,depositCopy,type DepositLocale} from './deposit-copy';
import DepositDetails from './DepositDetails';
import {ContactLink} from './SupportContact';
import {hasDepositDetails} from '../deposit-options';
import DepositChannelPicker from './DepositChannelPicker';
import {PaymentIcon as CardStackIcon,IdentityIcon as PersonIcon,DepositIcon as PlusIcon,WithdrawIcon as ArrowTopRightIcon} from './PlatformIcons';
import {navigateApp} from './app-navigation';
import IdentityPhotos, { type IdentityPhoto } from "./IdentityPhotos";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  LockClosedIcon,
  CheckIcon,
  ReloadIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { BottomSheet, KeyboardInput, useKeyboard, useKeyboardInsets } from "../mobile";
import { api, date, money } from "../api";
import {
  type DepositChannelSettings,
  financeStatus,
  type FinanceSnapshot,
  type FundRequest,
} from "../finance";
import "./finance-panel.css";

type ModalKind = "" | "identity" | "card" | "deposit" | "withdrawal";
const modalTitles = {
  identity: "实名认证",
  card: "添加银行卡",
  deposit: "充值",
  withdrawal: "提现",
};
const short = (id: string) => id.slice(0, 8).toUpperCase();
function RequestRecord({ record: r }: { record: FundRequest }) {
  return <article className="f-request"><div className="f-request-heading">
    <span className={'f-request-icon '+r.status}>{lx(r.kind==='withdrawal'?<ArrowTopRightIcon/>:<PlusIcon/>)}</span>
    <span className="f-request-title"><b>{lx(r.kind==='withdrawal'?'提现':'充值')} <em>{lx(money(r.amount))}</em></b><small>{lx(r.deposit_channel_name? r.deposit_channel_name+' · '+(r.deposit_method_label?r.deposit_method_label+' · ':''):'')}{lx(date(r.created_at,true))} · #{lx(short(r.id))}</small></span>
    <span className={'s-finance-status '+r.status}>{lx(financeStatus(r.status,r.kind))}</span>
  </div></article>;
}
export default function FinancePanel({
  onChange,
  supportIdentity,
}: {
  onChange: () => Promise<unknown>;
  supportIdentity?: SupportIdentity;
}) {
  const [data, setData] = useState<FinanceSnapshot | null>(null),
    [modal, setModal] = useState<ModalKind>(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [receipt, setReceipt] = useState<{ kind: string; id?: string } | null>(
      null,
    ),
    [form, setForm] = useState<Record<string, string>>({}),
    [filter, setFilter] = useState("全部");
  const depositLocale:DepositLocale='zh';
  const dt=depositCopy(depositLocale);
  const [channelSettings,setChannelSettings]=useState<DepositChannelSettings|null>(null);
  const [channelError,setChannelError]=useState('');
  useEffect(()=>{if(modal==='deposit'){setChannelSettings(null);setChannelError('');void api<DepositChannelSettings>('/finance/deposit-channels').then(setChannelSettings).catch(e=>setChannelError(e.message));}},[modal]);
  const selectedChannel=channelSettings?.channels.find(c=>c.id===form.depositChannel);
  const [fundPasswordReady,setFundPasswordReady]=useState<boolean|null>(null);
  const [addingMethod,setAddingMethod]=useState(false);
  const [fundEntryEnabled,setFundEntryEnabled]=useState(false);
  const [requestsExpanded,setRequestsExpanded]=useState(false);
  useEffect(()=>setRequestsExpanded(false),[filter]);
  const [photos, setPhotos] = useState<{
    front?: IdentityPhoto;
    back?: IdentityPhoto;
  }>({});
  const key = useRef(""),
    version = useRef(0),
    mounted = useRef(true),
    submitting = useRef(false),
    keyboard = useKeyboard();
  const {keyboardHeight:financeKeyboardHeight}=useKeyboardInsets();
  const [financeViewport,setFinanceViewport]=useState({height:typeof window==='undefined'?844:window.innerHeight,top:0});
  useEffect(()=>{const viewport=window.visualViewport,sync=()=>setFinanceViewport({height:viewport?.height||window.innerHeight,top:viewport?.offsetTop||0});sync();viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);window.addEventListener('resize',sync);return()=>{viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);window.removeEventListener('resize',sync);};},[]);
  const load = useCallback(async () => {
    const request = ++version.current;
    const snapshot = await api<FinanceSnapshot>("/finance");
    if (mounted.current && request === version.current){setData({...snapshot,cards:snapshot.cards.filter(c=>c.provider==='bank')});setForm(old=>snapshot.cards.some(c=>c.provider==='bank'&&c.id===old.cardId&&c.status==='approved')?old:{...old,cardId:snapshot.cards.find(c=>c.provider==='bank'&&c.status==='approved')?.id||''});}
    return snapshot;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const read = () =>
      void load().catch((e) => {
        if (mounted.current) setError(e.message);
      });
    read();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !submitting.current) read();
    }, 15000);
    return () => {
      mounted.current = false;
      version.current++;
      clearInterval(timer);
    };
  }, [load]);
  const passwordRequest = useRef(0);
  function closeModal() {
    if (submitting.current) return;
    passwordRequest.current++;
    keyboard.hide();
    setModal("");
    setForm({});
    setPhotos({});
    setError("");
  }
  function open(kind: ModalKind) {
    setAddingMethod(false);
    setFundEntryEnabled(false);
    const request = ++passwordRequest.current;
    if(kind==='withdrawal'){
      setFundPasswordReady(null);
      void api<{configured:boolean}>('/auth/fund-password').then(v=>{if(mounted.current&&request===passwordRequest.current)setFundPasswordReady(v.configured);}).catch(()=>{if(mounted.current&&request===passwordRequest.current)setError('暂时无法读取资金密码状态，请关闭后重试');});
    }

    keyboard.hide();
    setPhotos({});
    setForm({
      documentType: "居民身份证",
      provider: "bank",
      methodGroup:"bank",
      depositGroup: "bank",
      depositChannel: kind==='deposit'?'bank_wire':'',
      network: "TRC20",
      cardId: data?.cards.find((c) => c.status === "approved")?.id || "",
    });
    setError("");
    key.current = crypto.randomUUID();
    setModal(kind);
  }
  useEffect(()=>{
    const query=new URLSearchParams(location.search),requested=query.get('finance');if(requested==='card'||requested==='withdrawal'||requested==='deposit'){const amount=query.get('amount')||'';query.delete('finance');query.delete('amount');history.replaceState(null,'','/?'+query.toString());open(requested);if(requested==='deposit'&&/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(amount)&&Number(amount)>0)setForm(old=>({...old,amount}));}
  },[]);
  const [refreshNote,setRefreshNote]=useState('');
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshNote('');
    try {
      await onChange();
      await load();
      if(mounted.current)setRefreshNote('已更新');
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if(modal==='deposit'&&!form.depositMethod){setError(dt.selectMethodError);return;}
    if (modal === "identity" && (!photos.front || !photos.back)) {
      setError("请先上传证件正面和反面照片");
      return;
    }
    const kind = modal;
    if (!kind) return;
    if(modal==='withdrawal'){
      if(!fundPasswordReady||!form.fundPassword){setError('请先设置并输入资金密码');return;}
      const amount=/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(form.amount||'')?Math.round(Number(form.amount)*100):0;
      if(!data){setError('正在读取余额，请稍后再试');return;}
      if(data?.hasUnsettledThirdTask){setError('请先完成当前任务后再申请提现');return;}
      if(amount<minimumWithdrawal){setError('请调整金额或选择其他收款方式');return;}
      if(amount>data.account.available){setError('余额不足，可用余额 '+money(data.account.available));return;}
      if(!data.cards.some(c=>c.id===form.cardId&&c.status==='approved')){setError('请选择收款方式');return;}
    }
    submitting.current = true;
    keyboard.hide();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id?: string;firstBinding?:boolean;status?:string;newcomer_task?:number }>(
        "/finance/" +
          (kind === "identity"
            ? "identity"
            : kind === "card"
              ? "cards"
              : "requests"),
        "POST",
        {
          ...form,
          ...(kind === "identity"
            ? { frontPhoto: photos.front, backPhoto: photos.back }
            : {}),
          ...(["deposit", "withdrawal"].includes(kind)
            ? { kind, operationKey: key.current }
            : {}),
        },
      );
      if (!mounted.current) return;
      version.current++;
      setReceipt({ kind: kind==='card'?(result.status==='review'?'银行收款资料':'收款方式已添加'):modalTitles[kind], id: result.id });
      setModal("");
      setPhotos({});
      setForm({});
      if(kind==='withdrawal'&&result.newcomer_task===1){navigateApp('/?design=newcomer&withdrawal=submitted');return;}
      if(kind==='withdrawal'&&data?.fullBalanceWithdrawal){navigateApp('/?design=advanced');return;}
      if(kind==='card'&&result.firstBinding){navigateApp('/?view=app&design=newcomer&binding=completed');return;}
      // A successful server receipt remains successful even when the subsequent refresh fails.
      try {
        await Promise.all([load(), onChange()]);
      } catch {
        if (mounted.current)
          setError(
            "申请已提交成功，但最新状态暂未刷新。请保留回执，稍后点刷新查看；无需重复提交。",
          );
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(()=>{if(modal==='withdrawal'&&data?.fullBalanceWithdrawal)setForm(old=>({...old,amount:(data.account.available/100).toFixed(2)}));},[modal,data?.fullBalanceWithdrawal,data?.account.available]);
  const field = (
    label: string,
    name: string,
    placeholder = "",
    type = "text",
  ) => (
    <label>
      {lx(label)}
      <KeyboardInput
        required
        type={name==='amount'?'number':type}
        readOnly={name==='amount'&&modal==='withdrawal'&&!!data?.fullBalanceWithdrawal}
        name={name==='amount'?'transfer-amount':name}
        inputMode={name==='amount'?'decimal':undefined}
        min={name==='amount'?(modal==='withdrawal'?String(minimumWithdrawal/100):'1'):undefined}
        step={name==='amount'?'0.01':undefined}
        value={form[name] || ""}
        onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
        placeholder={tx(placeholder)}
        maxLength={
          name === "amount"
            ? 12
            : name === "name" || name === "holder"
              ? 50
              : 150
        }
        autoComplete="off"
      />
    </label>
  );
  const approvedCards =
    data?.cards.filter((c) => c.status === "approved") || [];
  const selectedPayout=approvedCards.find(c=>c.id===form.cardId);
  const minimumWithdrawal=selectedPayout?.provider==='bank'?withdrawalPolicy.bankMinimumCents:withdrawalPolicy.defaultMinimumCents;
  const withdrawalCents=Math.round(Number(form.amount||0)*100);
  const bankBelowMinimum=modal==='withdrawal'&&selectedPayout?.provider==='bank'&&withdrawalCents>0&&withdrawalCents<minimumWithdrawal;
  const insufficient=modal==='withdrawal'&&!!data&&Number.isFinite(withdrawalCents)&&withdrawalCents>data.account.available;
  const requests =
    data?.requests.filter(
      (r) =>
        filter === "全部" ||
        (filter === "审核中" && r.status === "review") ||
        (filter === "出款中" && r.status === "paying") ||
        (filter === "已结束" &&
          ["paid", "completed", "rejected"].includes(r.status)),
    ) || [];
  const returnDesign=new URLSearchParams(location.search).get('returnDesign');
  const returnHref=returnDesign&&['advanced','third','newcomer'].includes(returnDesign)?'/?view=app&design='+returnDesign:null;
  const identity = data?.identity;
  const receiptStatus = receipt?.id
    ? identity?.id === receipt.id
      ? identity.status
      : data?.cards.find(c=>c.id===receipt.id)?.status || data?.requests.find((r) => r.id === receipt.id)?.status
    : undefined;
  return (
    <section className="s-finance">
      {lx(returnHref&&<a className="purchase-return" href={returnHref}>{tx("‹ 返回已领取的任务")}</a>)}
      {lx(data?.overview&&<WalletOverview available={data.account.available} data={data.overview} actions={<div className="wallet-overview-refresh"><span className="wallet-refresh-status" role="status">{lx(refreshNote)}</span><button type="button" aria-label={tx("刷新余额")} disabled={refreshing} onClick={()=>void refresh()}><ReloadIcon className={refreshing?'wallet-refresh-spinning':''}/>{lx(refreshing?'更新中…':'刷新')}</button></div>}/>)}
      <div className="wallet-transfer-actions" aria-label={tx("资金操作")}>
        <button onClick={() => open("deposit")}><PlusIcon/><span>{tx("充值")}</span></button>
        <button onClick={() => open("withdrawal")}><ArrowTopRightIcon/><span>{tx("提现")}</span></button>
      </div>
      <div className="wallet-management" aria-label={tx("收款方式")}>
        <button onClick={() => open("card")}><CardStackIcon/><span><b>{tx("收款方式")}</b><small>{lx(data?.cards.length ? data.cards.length+' 个已添加' : '添加收款账户')}</small></span><i aria-hidden="true">›</i></button>
      </div>
      {lx(receipt && (
        <div className="f-receipt" role="status">
          <CheckIcon />
          <div>
            <b>{lx(receipt.kind === '收款方式已添加' ? '收款方式已保存，可直接使用' : receipt.kind + '已提交成功')}</b>
            <p>
              {lx(receipt.kind === '收款方式已添加' ? '保存状态：' : '审批状态：')}
              {lx(receiptStatus
                ? financeStatus(
                    receiptStatus,
                    receipt.kind === "充值" ? "deposit" : "",
                  )
                : receipt.kind === '收款方式已添加' ? '已保存' : "已提交")}
              {lx(receipt.id ? " · #" + short(receipt.id) : "")}
            </p>
            {lx(receipt.id && <small>{tx("申请编号：")}{lx(receipt.id)}</small>)}
            <small>{lx(receipt.kind === '收款方式已添加' ? '可在提款申请中选择此收款方式。' : receipt.kind==='银行收款资料'?'可在收款方式中查看审核进度。':'可在申请记录中查看进度。')}</small>
          </div>
          <button aria-label={tx("收起申请回执")} onClick={() => setReceipt(null)}>
            ×
          </button>
        </div>
      ))}
      {lx(error && !modal && (
        <div className="s-error-box" role="alert">
          {lx(error)}
        </div>
      ))}

      <div className="f-record-heading">
        <h3>{tx("充值与提现记录")}</h3>
        {lx(data && data.requests.length > 0 && (
          <span>{lx(data.requests.length)}{tx(" 笔申请")}</span>
        ))}
      </div>
      {lx(data && data.requests.length > 0 && (
        <div className="f-filters">
          {lx(["全部", "审核中", "出款中", "已结束"].map((v) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {lx(v)}
            </button>
          )))}
        </div>
      ))}
      {lx(!data ? (
        <p className="s-subtle" role="status">{tx("正在读取申请记录…")}</p>
      ) : !requests.length ? (
        <div className="f-empty">
          <CardStackIcon />
          <b>
            {lx(filter === "全部" ? "暂无资金申请" : "暂无" + filter + "的申请")}
          </b>
          <p>{tx("提交后，这里将显示编号、审核及出款进度。")}</p>
        </div>
      ) : (
        <>{lx(requests.slice(0,requestsExpanded?undefined:5).map((r) => <RequestRecord key={r.id} record={r} />))}{lx(requests.length>5&&<button className="account-show-more" aria-expanded={requestsExpanded} onClick={()=>setRequestsExpanded(v=>!v)}>{lx(requestsExpanded?"收起申请记录":"展开更多申请 · "+requests.length+" 笔")}</button>)}</>
      ))}
      <style>{lx(`.bottom-sheet:has(.s-finance-sheet){--finance-keyboard-offset:${financeKeyboardHeight}px;--finance-visible-height:${financeViewport.height}px;--finance-visible-top:${financeViewport.top}px;}`)}</style>
      <BottomSheet
        snap={modal==='identity'?0.92:0.85}
        open={!!modal}
        onOpenChange={(v) => !v && closeModal()}
        title={tx(modal==='deposit'?(selectedChannel?channelName(selectedChannel.id,selectedChannel.name,depositLocale):form.depositGroup==='crypto'?dt.crypto:dt.deposit):modal==='card'&&!addingMethod&&data?.cards.length?'收款方式':modal==='identity'&&identity?.status==='approved'?'实名资料':modal ? modalTitles[modal] : '账户申请')}
        description={tx(modal==='deposit'?(selectedChannel?(selectedChannel.id==='bank_wire'||!selectedChannel.enabled||!hasDepositDetails(selectedChannel)?undefined:dt.review):form.depositGroup==='crypto'?dt.chooseCrypto:dt.choose):modal==='withdrawal'?"选择收款方式并核对金额，提交后可查看处理进度。":modal==='card'?(data?.cards.length&&!addingMethod?"查看已保存的收款账户。":"填写本人的银行收款资料。"):modal==='identity'&&identity?.status==='approved'?"查看已认证的身份资料。":modal==='identity'&&identity?.status==='review'?"资料已提交，等待审核结果。":"请填写属于本人的资料。")}
      >
        <div className={'s-finance-sheet is-'+modal}>
          {lx(modal==='deposit'&&<><button type="button" className="deposit-flow-back" aria-label={tx(dt.back)} disabled={busy} onClick={()=>{keyboard.hide();closeModal();setError('');}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button></>)}
          <button
            type="button"
            className="s-finance-close"
            hidden={modal==='deposit'}
            aria-label={tx("关闭")}
            disabled={busy}
            onClick={() => {
              keyboard.hide();
              closeModal();
            }}
          >
            <Cross2Icon/>
          </button>
          {lx(modal === "deposit" && (!selectedChannel || !selectedChannel.enabled || !hasDepositDetails(selectedChannel) || selectedChannel.id==='bank_wire') ? (
            <div className="deposit-channels">{lx(selectedChannel?<div className={'deposit-state '+(selectedChannel.id==='bank_wire'&&selectedChannel.enabled?'is-bank':'')}><span className="deposit-state-icon"><ChannelIcon id={selectedChannel.id}/></span>{lx(selectedChannel.id==='bank_wire'&&selectedChannel.enabled?<><p>{lx(dt.bankBody)}</p><ContactLink identity={supportIdentity} url={channelSettings?.supportUrl} label={tx(dt.contact)} unavailableMessage={tx(dt.supportUnavailable)} forceModal={modal==='deposit'}/></>:<p>{lx(!selectedChannel.enabled?(selectedChannel.unavailableMessage==='当前区域暂未开通'||!selectedChannel.unavailableMessage?dt.unavailable:selectedChannel.unavailableMessage):dt.channelUnavailable)}</p>)}</div>:<DepositChannelPicker locale={depositLocale} settings={channelSettings} group={form.depositGroup||''} error={channelError} onGroup={group=>setForm(old=>({...old,depositGroup:group,depositChannel:group==='bank'?'bank_wire':'',depositMethod:'',reference:''}))} onChannel={id=>setForm(old=>({...old,depositChannel:id,depositMethod:'',reference:''}))}/>)}</div>
          ) : modal === "identity" &&
          identity &&
          ["approved", "review"].includes(identity.status) ? (
            <div className="wallet-identity-summary">
              <div className="wallet-identity-status"><PersonIcon/><h3>{lx(identity.status==='approved'?'已实名':'实名认证审核中')}</h3><span>{lx(identity.status==='approved'?'认证已通过':'资料已提交，请等待审核')}</span></div>
              <dl><div><dt>{tx("姓名")}</dt><dd>{lx(identity.name)}</dd></div><div><dt>{tx("证件类型")}</dt><dd>{lx(identity.document_type)}</dd></div><div><dt>{tx("证件号码")}</dt><dd>{lx('•••• •••• '+identity.number_mask.slice(-2))}</dd></div></dl>
              {lx(identity.note&&<p>{lx(identity.note)}</p>)}
            </div>
          ) : modal === "card" && !!data?.cards.length && !addingMethod ? (
            <div className="wallet-saved-methods"><div className="wallet-saved-list">{lx(data.cards.map(c=><article key={c.id}><div className="payout-saved-icon"><ChannelIcon id={c.provider==='bank'?'bank_wire':c.provider||'bank_wire'}/></div><div><h3 title={c.provider==='bank'?payoutMethodName(c):tx(payoutMethodName(c))}>{c.provider==='bank'?payoutMethodName(c):lx(payoutMethodName(c))}</h3><p>{c.number_mask}</p><small>{c.holder}</small></div><span className={'payout-method-status '+c.status}>{lx(financeStatus(c.status))}</span></article>))}</div><button type="button" className="wallet-add-method" disabled={data.cards.length>=10} onClick={()=>setAddingMethod(true)}>{lx(data.cards.length>=10?'已添加 10 个收款账户':'＋ 添加收款方式')}</button></div>
          ) : modal === "withdrawal" &&
            (!approvedCards.length) ? (
            <div className="s-finance-notice">{tx("请先添加银行卡。")}</div>
          ) : (
            <form onSubmit={submit} autoComplete="off">
              {lx(modal==='deposit'&&selectedChannel&&<DepositDetails channel={selectedChannel} method={form.depositMethod||''} onMethod={id=>setForm(old=>({...old,depositMethod:id,reference:''}))} locale={depositLocale}/>)}
              {lx(modal === "identity" && (
                <>
                  {lx(field("真实姓名", "name", "与证件一致的姓名"))}
                  <label>{tx("证件类型")}<select
                      aria-label={tx("证件类型")}
                      value={form.documentType || "居民身份证"}
                      onChange={(e) => {
                        setPhotos({});
                        setForm((old) => ({
                          ...old,
                          documentType: e.target.value,
                          number: "",
                        }));
                      }}
                    >
                      <option value="居民身份证">{tx("居民身份证")}</option>
                      <option value="护照">{tx("护照")}</option>
                      <option value="驾驶证">{tx("驾驶证")}</option>
                    </select>
                  </label>
                  {lx(field("证件号码", "number", "证件号码将加密保存"))}
                  <IdentityPhotos
                    type={form.documentType || "居民身份证"}
                    photos={photos}
                    onChange={(side, photo) =>
                      setPhotos((old) => ({ ...old, [side]: photo }))
                    }
                    onError={setError}
                  />
                </>
              ))}
              {lx(modal === "card" && (
                <>
                  <PayoutMethodFields form={form} setForm={setForm}/>

                </>
              ))}
              {lx(["deposit", "withdrawal"].includes(modal) && (
                <>
                  {lx(modal==='withdrawal'&&<div className="withdrawal-available"><span>{tx("可用余额")}</span><b>{lx(data?money(data.account.available):'读取中…')}</b></div>)}
                  {lx(field(modal==='deposit'?dt.amount:"金额", "amount",modal==='deposit'?dt.amountHint:'请输入金额，最多两位小数'))}
                  {lx(modal==='withdrawal'&&data?.fullBalanceWithdrawal&&<p>{tx('第二阶段将提取全部可用余额，金额无需填写。')}</p>)}
                  {lx(modal==='withdrawal'&&data?.hasUnsettledThirdTask&&<p className="s-error-box" role="status">{tx("请先完成当前任务后再申请提现")}</p>)}
                  {lx(bankBelowMinimum&&<div className="withdrawal-minimum-error" role="alert"><b>{tx("暂无法提交银行转账")}</b><p>{tx("请调整金额或选择其他收款方式")}</p></div>)}
                  {lx(insufficient&&<p className="s-error-box" role="alert">{tx("余额不足，最多可申请 ")}{lx(money(data!.account.available))}。</p>)}
                  {lx(modal === "deposit" ? (
                    <>
                      {lx(field(
                        dt.reference,
                        "reference",
                        dt.referenceHint,
                      ))}
                      <p>
                        {lx(dt.receipt)}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="withdrawal-destination-field"><span>{tx("收款方式")}</span><PayoutDestinationPicker cards={approvedCards} value={form.cardId||''} onChange={cardId=>setForm(old=>({...old,cardId}))}/></div>
                      
                      {lx(fundPasswordReady===null?<p role="status">{tx("正在读取资金密码状态…")}</p>:fundPasswordReady===false?<div className="fund-password-required"><p>{tx("提款前，请先设置独立的资金密码。")}</p><button type="button" onClick={()=>{closeModal();navigateApp('/?view=app&page=profile&security=fund');}}>{tx("去设置资金密码")}</button></div>:<label>{tx("资金密码")}<KeyboardInput required type="password" name="withdrawal-security-code" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" readOnly={!fundEntryEnabled} onFocus={()=>setFundEntryEnabled(true)} maxLength={128} value={form.fundPassword||''} onChange={e=>setForm(v=>({...v,fundPassword:e.target.value}))}/></label>)}
                    </>
                  ))}
                </>
              ))}
              {lx(error && (
                <p className="s-error-box" role="alert">
                  {lx(error)}
                </p>
              ))}
              {lx((modal!=='card'||form.methodGroup==='bank'||form.methodChosen==='yes')&&<button className="s-auth-submit" disabled={busy||modal==='card'&&(!form.methodGroup||form.methodGroup==='cards'||form.methodGroup==='crypto'&&!form.methodChosen)||modal==='withdrawal'&&(!!data?.hasUnsettledThirdTask||!fundPasswordReady||!form.fundPassword||!data||insufficient||!form.cardId||withdrawalCents<minimumWithdrawal||!Number.isFinite(withdrawalCents))}>
                {lx(busy ? (modal==='deposit'?dt.submitting:'正在提交…') : modal==='deposit'?dt.submit:modal==='card'?"保存银行卡":modal==='withdrawal'?"提现":"提交审核")}
              </button>)}
            </form>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
}
