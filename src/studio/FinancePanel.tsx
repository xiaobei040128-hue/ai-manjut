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
  card: "添加银行卡",
  deposit: "充值申请",
  withdrawal: "申请提现",
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
    if (mounted.current && request === version.current) setData(snapshot);
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
      cardId: data?.cards.find((c) => c.status === "approved")?.id || "",
    });
    setError("");
    key.current = crypto.randomUUID();
    setModal(kind);
  }
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
    submitting.current = true;
    keyboard.hide();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id?: string }>(
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
      setReceipt({ kind: modalTitles[kind], id: result.id });
      setModal("");
      setPhotos({});
      setForm({});
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
          <b>银行卡</b>
          <small>{approvedCards.length} 张已通过</small>
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
              持卡人 {c.holder} · #{short(c.id)}
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
        description="提交后需后台审批，请填写属于本人的资料。"
      >
        <div className="s-finance-sheet">
          <button
            type="button"
            className="s-finance-close"
            disabled={busy}
            onClick={() => {
              keyboard.hide();
              setModal("");
              setPhotos({});
            }}
          >
            关闭
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
              请先完成实名认证并等待后台审核通过，再添加本人银行卡。
            </div>
          ) : modal === "withdrawal" &&
            (identity?.status !== "approved" || !approvedCards.length) ? (
            <div className="s-finance-notice">
              提现前需实名认证和银行卡均审核通过。请先完成资料审核。
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
                  {field("银行名称", "bank", "如：中国工商银行")}
                  {field("持卡人姓名", "holder", "必须与已通过实名的姓名一致")}
                  {field("银行卡号", "number", "本人银行卡号")}
                </>
              )}
              {["deposit", "withdrawal"].includes(modal) && (
                <>
                  {field("金额（USD）", "amount", "至少 1 USD，最多两位小数")}
                  {modal === "deposit" ? (
                    <>
                      {field(
                        "渠道 / 转账凭证编号",
                        "reference",
                        "填写渠道及凭证编号",
                      )}
                      <p>
                        仅填写凭证不会完成充值，后台核实实际收款后才入账。当前尚未接入支付通道。
                      </p>
                    </>
                  ) : (
                    <>
                      <label>
                        收款银行卡
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
                          {approvedCards.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.bank} {c.number_mask}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>
                        提交后冻结对应额度；审核通过显示“出款中”，后台登记出款结果后显示“已出款”。拒绝后返还冻结额度。
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
              <button className="s-auth-submit" disabled={busy}>
                {busy ? "正在提交…" : "提交审核"}
              </button>
            </form>
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
