import IdentityPhotos, { type IdentityPhoto } from "./IdentityPhotos";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CardStackIcon,
  PersonIcon,
  PlusIcon,
  ArrowTopRightIcon,
  LockClosedIcon,
  CheckIcon,
  ClockIcon,
  ReloadIcon,
  ChevronDownIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import { BottomSheet, KeyboardInput, useKeyboard } from "../mobile";
import { api, date, money } from "../api";
import {
  financeStatus,
  type FinanceSnapshot,
  type FundRequest,
} from "../finance";
import "./finance-panel.css";

type ModalKind = "" | "identity" | "card" | "deposit" | "withdrawal";
const modalTitles = {
  identity: "实名认证",
  card: "添加提款方式",
  deposit: "充值申请",
  withdrawal: "申请提款",
};
const short = (id: string) => id.slice(0, 8).toUpperCase();
function RequestRecord({ record: r }: { record: FundRequest }) {
  const withdrawal = r.kind === "withdrawal",
    done = ["paid", "completed"].includes(r.status);
  return (
    <details className="f-request">
      <summary>
        <span className={"f-request-icon " + r.status}>
          {withdrawal ? <ArrowTopRightIcon /> : <PlusIcon />}
        </span>
        <span className="f-request-title">
          <b>
            {withdrawal ? "提现申请" : "充值申请"} <em>{money(r.amount)}</em>
          </b>
          <small>
            {date(r.created_at, true)} · #{short(r.id)}
          </small>
        </span>
        <span className={"s-finance-status " + r.status}>
          {financeStatus(r.status, r.kind)}
        </span>
        <ChevronDownIcon />
      </summary>
      <div className="f-request-detail">
        <div className="f-request-track">
          <span className="done">
            <CheckIcon />
            已提交
          </span>
          <i />
          <span className={r.status === "review" ? "active" : "done"}>
            {r.status === "review" ? <ClockIcon /> : <CheckIcon />}
            {r.status === "rejected" ? "未通过" : "后台审核"}
          </span>
          {r.status !== "rejected" && (
            <>
              <i />
              <span
                className={
                  done ? "done" : r.status === "paying" ? "active" : ""
                }
              >
                {done ? <CheckIcon /> : <ClockIcon />}
                {withdrawal
                  ? done
                    ? "已出款"
                    : "出款中"
                  : done
                    ? "已到账"
                    : "核实入账"}
              </span>
            </>
          )}
        </div>
        <dl>
          <dt>申请编号</dt>
          <dd>{r.id}</dd>
          {r.bank && (
            <>
              <dt>收款方式</dt>
              <dd>
                {r.bank} {r.number_mask}
              </dd>
            </>
          )}
          {r.reference && (
            <>
              <dt>凭证编号</dt>
              <dd>{r.reference}</dd>
            </>
          )}
          {r.reviewed_at && (
            <>
              <dt>审核时间</dt>
              <dd>{date(r.reviewed_at, true)}</dd>
            </>
          )}
          {r.paid_at && (
            <>
              <dt>出款时间</dt>
              <dd>{date(r.paid_at, true)}</dd>
            </>
          )}
          {r.note && (
            <>
              <dt>后台说明</dt>
              <dd>{r.note}</dd>
            </>
          )}
        </dl>
        <p>
          {r.status === "rejected"
            ? "申请未通过。提现冻结额度已按系统规则释放，具体记录可在交易流水中查看。"
            : r.status === "review"
              ? "申请已保存，正在等待后台核实。请保留申请编号。"
              : r.status === "paying"
                ? "后台已审核通过，等待登记实际出款结果。"
                : "该申请已结束，可通过申请编号追溯记录。"}
        </p>
      </div>
    </details>
  );
}
export default function FinancePanel({
  onChange,
}: {
  onChange: () => Promise<unknown>;
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
  const [photos, setPhotos] = useState<{
    front?: IdentityPhoto;
    back?: IdentityPhoto;
  }>({});
  const key = useRef(""),
    version = useRef(0),
    mounted = useRef(true),
    submitting = useRef(false),
    keyboard = useKeyboard();
  const load = useCallback(async () => {
    const request = ++version.current;
    const snapshot = await api<FinanceSnapshot>("/finance");
    if (mounted.current && request === version.current){setData(snapshot);setForm(old=>snapshot.cards.some(c=>c.id===old.cardId&&c.status==='approved')?old:{...old,cardId:snapshot.cards.find(c=>c.status==='approved')?.id||''});}
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
  function open(kind: ModalKind) {
    keyboard.hide();
    setPhotos({});
    setForm({
      documentType: "居民身份证",
      provider: "okx",
      network: "TRC20",
      cardId: data?.cards.find((c) => c.status === "approved")?.id || "",
    });
    setError("");
    key.current = crypto.randomUUID();
    setModal(kind);
  }
  useEffect(()=>{
    const query=new URLSearchParams(location.search),requested=query.get('finance');if(requested==='card'||requested==='withdrawal'){query.delete('finance');history.replaceState(null,'','/?'+query.toString());open(requested);}
  },[]);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
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
    if (modal === "identity" && (!photos.front || !photos.back)) {
      setError("请先上传证件正面和反面照片");
      return;
    }
    const kind = modal;
    if (!kind) return;
    if(modal==='withdrawal'){
      const amount=/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(form.amount||'')?Math.round(Number(form.amount)*100):0;
      if(!data){setError('正在读取余额，请稍后再试');return;}
      if(amount<100){setError('最低提款金额为 $1.00');return;}
      if(amount>data.account.available){setError('余额不足，可用余额 '+money(data.account.available));return;}
      if(!data.cards.some(c=>c.id===form.cardId&&c.status==='approved')){setError('请选择提款方式');return;}
    }
    submitting.current = true;
    keyboard.hide();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id?: string;firstBinding?:boolean }>(
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
      setReceipt({ kind: kind==='card'?'提款方式已添加':modalTitles[kind], id: result.id });
      setModal("");
      setPhotos({});
      setForm({});
      if(kind==='withdrawal'){location.assign('/?view=app&design=newcomer&withdrawal=submitted');return;}
      if(kind==='card'&&result.firstBinding){location.assign('/?view=app&design=newcomer&binding=completed');return;}
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
  const field = (
    label: string,
    name: string,
    placeholder = "",
    type = "text",
  ) => (
    <label>
      {label}
      <KeyboardInput
        required
        type={type}
        value={form[name] || ""}
        onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
        placeholder={placeholder}
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
  const withdrawalCents=Math.round(Number(form.amount||0)*100);
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
  const identity = data?.identity;
  const receiptStatus = receipt?.id
    ? identity?.id === receipt.id
      ? identity.status
      : data?.requests.find((r) => r.id === receipt.id)?.status
    : undefined;
  return (
    <section className="s-finance">
      <div className="s-finance-title">
        <h2>账户与资金</h2>
        <button
          className="f-refresh"
          disabled={refreshing}
          onClick={refresh}
          aria-label="刷新账户审批状态"
        >
          <ReloadIcon className={refreshing ? "f-spinning" : ""} />
          <span>{refreshing ? "刷新中" : "刷新"}</span>
        </button>
      </div>
      <div className="s-finance-actions">
        <button onClick={() => open("deposit")}>
          <PlusIcon />
          <b>充值申请</b>
          <small>后台核实后入账</small>
        </button>
        <button onClick={() => open("withdrawal")}>
          <ArrowTopRightIcon />
          <b>申请提现</b>
          <small>审核后安排出款</small>
        </button>
        <button onClick={() => open("card")}>
          <CardStackIcon />
          <b>提款方式</b>
          <small>{approvedCards.length} 个已添加</small>
        </button>
        <button onClick={() => open("identity")}>
          <PersonIcon />
          <b>实名认证</b>
          <small>{identity ? financeStatus(identity.status) : "待提交"}</small>
        </button>
      </div>
      {receipt && (
        <div className="f-receipt" role="status">
          <CheckIcon />
          <div>
            <b>{receipt.kind}已提交成功</b>
            <p>
              审批状态：
              {receiptStatus
                ? financeStatus(
                    receiptStatus,
                    receipt.kind === "充值申请" ? "deposit" : "",
                  )
                : "已送达后台"}
              {receipt.id ? " · #" + short(receipt.id) : ""}
            </p>
            {receipt.id && <small>申请编号：{receipt.id}</small>}
            <small>请保留回执，后台可按申请编号核对记录。</small>
          </div>
          <button aria-label="收起申请回执" onClick={() => setReceipt(null)}>
            ×
          </button>
        </div>
      )}
      {error && !modal && (
        <div className="s-error-box" role="alert">
          {error}
        </div>
      )}
      {identity && (
        <div className="s-finance-record">
          <div>
            <b>实名认证 · {identity.name}</b>
            <small>
              {identity.document_type} · {identity.number_mask}
            </small>
            <small>
              #{short(identity.id)} · {date(identity.created_at, true)}
            </small>
            {identity.note && <p>{identity.note}</p>}
          </div>
          <span className={"s-finance-status " + identity.status}>
            {financeStatus(identity.status)}
          </span>
        </div>
      )}
      {data?.cards.map((c) => (
        <div className="s-finance-record" key={c.id}>
          <div>
            <b>
              {c.bank} · {c.number_mask}
            </b>
            <small>
              账户姓名 {c.holder} · #{short(c.id)}
            </small>
            {c.note && <p>{c.note}</p>}
          </div>
          <span className={"s-finance-status " + c.status}>
            {financeStatus(c.status)}
          </span>
        </div>
      ))}
      <div className="f-record-heading">
        <h3>充值与提现记录</h3>
        {data && data.requests.length > 0 && (
          <span>{data.requests.length} 笔申请</span>
        )}
      </div>
      {data && data.requests.length > 0 && (
        <div className="f-filters">
          {["全部", "审核中", "出款中", "已结束"].map((v) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {!data ? (
        <p className="s-subtle" role="status">
          正在读取申请记录…
        </p>
      ) : !requests.length ? (
        <div className="f-empty">
          <CardStackIcon />
          <b>
            {filter === "全部" ? "暂无资金申请" : "暂无" + filter + "的申请"}
          </b>
          <p>提交后，这里将显示编号、审核及出款进度。</p>
        </div>
      ) : (
        requests.map((r) => <RequestRecord key={r.id} record={r} />)
      )}
      <BottomSheet
        open={!!modal}
        onOpenChange={(v) => !busy && !v && setModal("")}
        title={modal ? modalTitles[modal] : "账户申请"}
        description={modal==='card'?"添加本人的收款账户，保存后即可使用。":"请填写属于本人的资料。"}
      >
        <div className={'s-finance-sheet'+(modal==='withdrawal'?' is-withdrawal':'')}>
          <button
            type="button"
            className="s-finance-close"
            aria-label="关闭"
            disabled={busy}
            onClick={() => {
              keyboard.hide();
              setModal("");
              setPhotos({});
            }}
          >
            <Cross2Icon/>
          </button>
          {modal === "identity" &&
          identity &&
          ["approved", "review"].includes(identity.status) &&
          identity.has_photos ? (
            <div className="s-finance-notice">
              实名认证{financeStatus(identity.status)}，请勿重复提交。
              <p>申请编号：{identity.id}</p>
              {identity.note}
            </div>
          ) : modal === "card" && identity?.status !== "approved" ? (
            <div className="s-finance-notice">
              请先完成实名认证并等待后台审核通过，再添加本人提款方式。
            </div>
          ) : modal === "withdrawal" &&
            (identity?.status !== "approved" || !approvedCards.length) ? (
            <div className="s-finance-notice">
              请先完成实名认证并添加提款方式。
            </div>
          ) : (
            <form onSubmit={submit}>
              {modal === "identity" && (
                <>
                  {field("真实姓名", "name", "与证件一致的姓名")}
                  <label>
                    证件类型
                    <select
                      aria-label="证件类型"
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
                      <option>居民身份证</option>
                      <option>护照</option>
                      <option>驾驶证</option>
                    </select>
                  </label>
                  {field("证件号码", "number", "证件号码将加密保存")}
                  <IdentityPhotos
                    type={form.documentType || "居民身份证"}
                    photos={photos}
                    onChange={(side, photo) =>
                      setPhotos((old) => ({ ...old, [side]: photo }))
                    }
                    onError={setError}
                  />
                  <p>这是人工实名资料审核，不代表已接入官方身份核验服务。</p>
                </>
              )}
              {modal === "card" && (
                <>
                  <div className="payout-method-picker" role="group" aria-label="选择提款方式">
                   {([['okx','OKX','OKX UID'],['binance','币安','Binance UID'],['usdt','USDT','链上收款地址']] as const).map(([value,label,hint])=><button key={value} type="button" aria-pressed={form.provider===value} onClick={()=>setForm(old=>({...old,provider:value,number:''}))}><span className={'payout-symbol '+value}><img src={'/brands/'+(value==='okx'?'okx.png':value+'.svg')} alt={label+' 官方标志'}/></span><b>{label}</b><small>{hint}</small></button>)}
                  </div>
                  {form.provider==='usdt'&&<label>收款网络<select required value={form.network||'TRC20'} onChange={e=>setForm(old=>({...old,network:e.target.value,number:''}))}><option value="TRC20">TRON · TRC20</option><option value="ERC20">Ethereum · ERC20</option><option value="BEP20">BNB Smart Chain · BEP20</option></select></label>}
                  {field(form.provider==='usdt'?'USDT 收款地址':form.provider==='okx'?'OKX UID':'币安 UID','number',form.provider==='usdt'?'粘贴对应网络的收款地址':'填写本人账户 UID')}
                  <p className="payout-method-note">{form.provider==='usdt'?'请确认收款网络与地址一致。':'使用本人账户的 UID，通过平台内部转账接收 USDT。'}</p>

                </>
              )}
              {["deposit", "withdrawal"].includes(modal) && (
                <>
                  {modal==='withdrawal'&&<div className="withdrawal-available"><span>可用余额</span><b>{data?money(data.account.available):'读取中…'}</b></div>}
                  {field("金额（USD）", "amount", "至少 1 USD，最多两位小数")}
                  {insufficient&&<p className="s-error-box" role="alert">余额不足，最多可申请 {money(data!.account.available)}。</p>}
                  {modal === "deposit" ? (
                    <>
                      {field(
                        "渠道 / 转账凭证编号",
                        "reference",
                        "填写渠道及凭证编号",
                      )}
                      <p>
                        仅填写凭证不会完成充值，后台核实实际收款后才入账。转账前请联系平台确认收款渠道。
                      </p>
                    </>
                  ) : (
                    <>
                      <label>
                        收款方式
                        <select
                          required
                          value={form.cardId || ""}
                          onChange={(e) =>
                            setForm((old) => ({
                              ...old,
                              cardId: e.target.value,
                            }))
                          }
                        >
                          <option value="" disabled>请选择提款方式</option>
                          {approvedCards.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.bank} {c.number_mask}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>
                        提交后由平台处理，到账进度可在提款记录查看。
                      </p>
                    </>
                  )}
                </>
              )}
              {error && (
                <p className="s-error-box" role="alert">
                  {error}
                </p>
              )}
              <button className="s-auth-submit" disabled={busy||modal==='withdrawal'&&(!data||insufficient||!form.cardId||withdrawalCents<100||!Number.isFinite(withdrawalCents))}>
                {busy ? "正在提交…" : modal==='card'?"保存提款方式":modal==='withdrawal'?"申请提款":"提交审核"}
              </button>
            </form>
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
