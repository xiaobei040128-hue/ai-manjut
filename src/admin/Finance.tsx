import { createCsv, downloadBlob } from "../studio/downloads";
import { useEffect, useRef, useState } from "react";
import { api, date, money } from "../api";
import {
  financeStatus,
  type FinanceCard,
  type FinanceIdentity,
  type FundRequest,
} from "../finance";
import { Badge, Empty, Modal } from "./components";
interface Account {
  id: string;
  email: string;
  name: string;
  frozen: number;
  freeze_reason: string;
  balance: number;
}
interface Snapshot {
  users: Account[];
  identities: FinanceIdentity[];
  cards: FinanceCard[];
  requests: FundRequest[];
}
type Target = {
  type: "identity" | "bank" | "fund" | "account";
  id: string;
  action: "review" | "adjust" | "freeze";
  decision?: string;
  frozen?: boolean;
  amount?: number;
  kind?: string;
};
export default function Finance({isSuper=true}:{isSuper?:boolean}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState("withdrawal"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(
      () =>
        new URLSearchParams(location.hash.split("?")[1] || "").get(
          "customer",
        ) || "",
    ),
    [target, setTarget] = useState<Target | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [note, setNote] = useState(""),
    [reference, setReference] = useState(""),
    [received, setReceived] = useState(false),
    [amount, setAmount] = useState(""),
    [direction, setDirection] = useState("credit"),
    [privateData, setPrivate] = useState<{
      name: string;
      number: string;
      bank?: string;
      documentType?: string;
      photos?: { front: string; back: string } | null;
    } | null>(null),
    [page, setPage] = useState(1),
    key = useRef("");
  const alive=useRef(true),version=useRef(0),mutation=useRef(false),privateVersion=useRef(0);
  async function load() {
    const current=++version.current;
    const next=await api<Snapshot>("/admin/finance");
    if(alive.current&&current===version.current){setData(next);setError("");}
  }
  useEffect(() => {
    alive.current=true;
    const read=()=>{if(!mutation.current)void load().catch(e=>{if(alive.current)setError(e.message);});};
    read();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')read();},15000);
    return()=>{alive.current=false;version.current++;privateVersion.current++;clearInterval(timer);};
  },[]);
  function open(t: Target) {
    privateVersion.current++;
    setTarget(t);
    setNote("");
    setReference("");
    setReceived(false);
    setAmount("");
    setDirection("credit");
    setPrivate(null);
    setError("");
    setSuccess("");
    key.current = crypto.randomUUID();
  }
  async function perform(e: React.FormEvent) {
    e.preventDefault();
    if (!target || mutation.current) return;
    mutation.current=true;version.current++;
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/finance/" + target.type + "/" + target.id + "/" + target.action,
        "POST",
        target.action === "adjust"
          ? { amount, direction, note, operationKey: key.current }
          : target.action === "freeze"
            ? { frozen: target.frozen, reason: note }
            : {
                decision: target.decision,
                note,
                reference,
                confirmReceived: received,
              },
      );
      if(!alive.current)return;
      privateVersion.current++;
      setTarget(null);
      setPrivate(null);
      setSuccess("操作已保存。");
      try { await load();if(alive.current)setSuccess("操作已保存，账本与客户状态已同步。"); }
      catch { if(alive.current)setError("操作已保存，但列表暂未刷新。请刷新核对最新记录，无需重复提交。"); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      mutation.current=false;
      if(alive.current)setBusy(false);
    }
  }
  const account = (id: string) => data?.users.find((u) => u.id === id),
    color = (s: string) =>
      ["paid", "completed", "approved"].includes(s)
        ? "green"
        : s === "rejected"
          ? "red"
          : s === "paying"
            ? "purple"
            : "amber";
  const matches = (u: string, recordId: string) => {
    const a = account(u);
    return (
      !query ||
      (a?.email + " " + a?.name + " " + u + " " + recordId)
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  };
  const records: ((FundRequest | FinanceIdentity | FinanceCard | Account) & {
    status?: string;
  })[] = data
    ? (tab === "identity"
        ? data.identities
        : tab === "bank"
          ? data.cards
          : tab === "account"
            ? data.users
            : data.requests.filter((r) => r.kind === tab)
      ).filter(
        (r) =>
          matches("user_id" in r ? r.user_id : r.id, r.id) &&
          (status === "all" ||
            ("status" in r
              ? r.status === status
              : status === "frozen"
                ? !!r.frozen
                : !r.frozen)),
      )
    : [];
  useEffect(() => {
    setPage((current) =>
      Math.min(current, Math.max(1, Math.ceil(records.length / 10))),
    );
  }, [records.length]);
  const pendingWithdrawals =
    data?.requests.filter(
      (r) => r.kind === "withdrawal" && r.status === "review",
    ) || [];
  const payingRequests =
    data?.requests.filter(
      (r) => r.kind === "withdrawal" && r.status === "paying",
    ) || [];
  function exportRecords() {
    const rows = [
      [
        "客户名称",
        "客户邮箱",
        "申请编号",
        "申请类型",
        "金额 USD",
        "状态",
        "提交时间",
      ],
      ...records.map((row) => {
        const uid = "user_id" in row ? row.user_id : row.id,
          u = account(uid);
        return [
          u?.name,
          u?.email,
          row.id,
          tab,
          "amount" in row
            ? (row.amount / 100).toFixed(2)
            : "balance" in row
              ? (row.balance / 100).toFixed(2)
              : "",
          tab === "account"
            ? "frozen" in row && row.frozen
              ? "已冻结"
              : "正常"
            : financeStatus(row.status || "", tab),
          "created_at" in row ? row.created_at : "",
        ];
      }),
    ];
    downloadBlob(
      new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" }),
      "审批记录-" + tab + ".csv",
    );
  }
  return (
    <>
      <section className="ad-finance-overview" aria-label="当前权限内审批概览">
        <button
          onClick={() => {
            setTab("withdrawal");
            setStatus("review");
            setPage(1);
            setQuery("");
          }}
        >
          <span>待审核提现</span>
          <strong>{pendingWithdrawals.length}</strong>
          <small>
            {money(pendingWithdrawals.reduce((sum, r) => sum + r.amount, 0))} ·
            账户资金
          </small>
        </button>
        <button
          onClick={() => {
            setTab("withdrawal");
            setStatus("paying");
            setPage(1);
            setQuery("");
          }}
        >
          <span>等待登记出款</span>
          <strong>{payingRequests.length}</strong>
          <small>
            {money(payingRequests.reduce((sum, r) => sum + r.amount, 0))} ·
            账户资金
          </small>
        </button>
        <button
          onClick={() => {
            setTab("identity");
            setStatus("review");
            setPage(1);
            setQuery("");
          }}
        >
          <span>实名待审核</span>
          <strong>
            {data?.identities.filter((r) => r.status === "review").length || 0}
          </strong>
          <small>核对证件与正反面照片</small>
        </button>
        <button
          onClick={() => {
            setTab("bank");
            setStatus("review");
            setPage(1);
            setQuery("");
          }}
        >
          <span>提款方式待审核</span>
          <strong>
            {data?.cards.filter((r) => r.status === "review").length || 0}
          </strong>
          <small>核对收款账户姓名与实名资料</small>
        </button>
      </section>
      <div className="ad-callout" style={{ marginBottom: 20 }}>
        <span>
          人工审批账本 ·
          充值须核实外部实际收款；提现须完成实际转账并登记凭证后，才能标记已出款。
        </span>
      </div>
      <section className="ad-panel">
        <div className="ad-toolbar">
          <div className="ad-tabs">
            {[
              ["withdrawal", "提现审批"],
              ["deposit", "充值审批"],
              ["identity", "实名认证"],
              ["bank", "提款方式"],
              ["account", isSuper ? "账户与上下分" : "账户状态"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => {
                  setTab(id);
                  setStatus("all");
                  setPage(1);
                }}
              >
                {label}
                {data && id !== "account" && (
                  <small className="ad-tab-count">
                    {id === "identity"
                      ? data.identities.filter((r) => r.status === "review")
                          .length
                      : id === "bank"
                        ? data.cards.filter((r) => r.status === "review").length
                        : data.requests.filter(
                            (r) => r.kind === id && r.status === "review",
                          ).length}
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="ad-toolbar">
          <input
            className="ad-finance-search"
            aria-label="搜索资金账号"
            placeholder="搜索客户邮箱、名称、账号或申请编号"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="筛选审批状态"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部状态</option>
            {(tab === "account"
              ? [
                  ["frozen", "已冻结"],
                  ["active", "正常"],
                ]
              : tab === "withdrawal"
                ? [
                    ["review", "审核中"],
                    ["paying", "出款中"],
                    ["paid", "已出款"],
                    ["rejected", "未通过"],
                  ]
                : tab === "deposit"
                  ? [
                      ["review", "审核中"],
                      ["completed", "已到账"],
                      ["rejected", "未通过"],
                    ]
                  : [
                      ["review", "审核中"],
                      ["approved", "已通过"],
                      ["rejected", "未通过"],
                    ]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            className="ad-button secondary small"
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            刷新
          </button>
          <button
            className="ad-button secondary small"
            disabled={!records.length}
            onClick={exportRecords}
          >
            导出筛选结果
          </button>
        </div>
        {error && !target && (
          <p className="ad-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="ad-callout">
            {success}
          </p>
        )}
        {!data ? (
          <p style={{ padding: 24 }}>正在读取审批记录…</p>
        ) : (
          <>
            <div className="ad-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>客户账号</th>
                    <th>{tab === "account" ? "可用余额" : "申请内容"}</th>
                    <th>{tab === "account" ? "冻结原因" : "提交时间"}</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice((page - 1) * 10, page * 10).map((row) => {
                    const userId = "user_id" in row ? row.user_id : row.id,
                      u = account(userId),
                      s =
                        "status" in row
                          ? row.status || ""
                          : "frozen" in row && row.frozen
                            ? "frozen"
                            : "active";
                    return (
                      <tr key={row.id}>
                        <td>
                          <b>{u?.name || "创作者"}</b>
                          <small>{u?.email || userId}</small>
                          {!!u?.frozen && <Badge tone="red">账号已冻结</Badge>}
                        </td>
                        <td>
                          {"amount" in row ? (
                            <>
                              <b>{money(row.amount)}</b>
                              <small>#{row.id.slice(0, 8)}</small>
                              {row.bank && (
                                <small>
                                  {row.bank} {row.number_mask}
                                </small>
                              )}
                              {row.reference && (
                                <small>凭证：{row.reference}</small>
                              )}
                            </>
                          ) : "document_type" in row ? (
                            <>
                              <b>
                                {row.document_type} · {row.name}
                              </b>
                              <small>{row.number_mask}</small>
                            </>
                          ) : "bank" in row ? (
                            <>
                              <b>
                                {row.bank} {row.number_mask}
                              </b>
                              <small>{row.holder}</small>
                            </>
                          ) : "balance" in row ? (
                            <b>{money(row.balance)}</b>
                          ) : null}
                          {"note" in row && row.note && (
                            <small>{row.note}</small>
                          )}
                        </td>
                        <td>
                          {"freeze_reason" in row
                            ? row.freeze_reason || "—"
                            : date(row.created_at, true)}
                        </td>
                        <td>
                          <Badge
                            tone={
                              s === "frozen"
                                ? "red"
                                : s === "active"
                                  ? "green"
                                  : color(s)
                            }
                          >
                            {s === "frozen"
                              ? "已冻结"
                              : s === "active"
                                ? "正常"
                                : financeStatus(s, tab)}
                          </Badge>
                        </td>
                        <td>
                          <div className="ad-row-actions">
                            {tab === "account" ? (
                              <>
                                {isSuper && <button
                                  onClick={() =>
                                    open({
                                      type: "account",
                                      id: row.id,
                                      action: "adjust",
                                    })
                                  }
                                >
                                  上下分
                                </button>}
                                <button
                                  onClick={() =>
                                    open({
                                      type: "account",
                                      id: row.id,
                                      action: "freeze",
                                      frozen: !u?.frozen,
                                    })
                                  }
                                >
                                  {u?.frozen ? "解冻" : "冻结账户"}
                                </button>
                              </>
                            ) : (
                              <>
                                {["identity", "bank"].includes(tab) && (
                                  <button
                                    onClick={() =>
                                      open({
                                        type: tab as "identity" | "bank",
                                        id: row.id,
                                        action: "review",
                                      })
                                    }
                                  >
                                    查看资料
                                  </button>
                                )}
                                {s === "review" && (
                                  <>
                                    <button
                                      onClick={() =>
                                        open({
                                          type:
                                            tab === "identity"
                                              ? "identity"
                                              : tab === "bank"
                                                ? "bank"
                                                : "fund",
                                          id: row.id,
                                          action: "review",
                                          decision: "approve",
                                          ...("amount" in row
                                            ? {
                                                amount: row.amount,
                                                kind: row.kind,
                                              }
                                            : {}),
                                        })
                                      }
                                    >
                                      审核通过
                                    </button>
                                    <button
                                      onClick={() =>
                                        open({
                                          type:
                                            tab === "identity"
                                              ? "identity"
                                              : tab === "bank"
                                                ? "bank"
                                                : "fund",
                                          id: row.id,
                                          action: "review",
                                          decision: "reject",
                                        })
                                      }
                                    >
                                      拒绝
                                    </button>
                                  </>
                                )}
                                {tab === "withdrawal" && s === "paying" && (
                                  <>
                                    <button
                                      onClick={() =>
                                        open({
                                          type: "fund",
                                          id: row.id,
                                          action: "review",
                                          decision: "paid",
                                          amount:
                                            "amount" in row ? row.amount : 0,
                                        })
                                      }
                                    >
                                      设置已出款
                                    </button>
                                    <button
                                      onClick={() =>
                                        open({
                                          type: "fund",
                                          id: row.id,
                                          action: "review",
                                          decision: "reject",
                                        })
                                      }
                                    >
                                      拒绝并返还
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!records.length && (
              <Empty
                title={query ? "没有匹配的申请" : "暂无相关记录"}
                text={
                  query
                    ? "请核对邮箱或申请编号，也可以清空搜索后查看。"
                    : status !== "all"
                      ? "当前状态没有记录，试试切换全部状态。"
                      : "客户提交申请后会出现在这里，状态由后台审批更新。"
                }
              />
            )}
            <footer className="ad-pagination">
              <span>
                共 {records.length} 条 · 第 {page} 页
              </span>
              <div>
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  上一页
                </button>
                <button
                  disabled={page * 10 >= records.length}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
      {target && (
        <Modal
          title={
            target.action === "adjust"
              ? "后台上下分"
              : target.action === "freeze"
                ? target.frozen
                  ? "冻结客户账户"
                  : "解冻客户账户"
                : !target.decision
                  ? "审核资料"
                  : target.decision === "paid"
                    ? "确认已出款"
                    : target.decision === "reject"
                      ? "拒绝申请"
                      : "审核通过"
          }
          description={
            "操作对象 #" + target.id.slice(0, 8) + " · 每次处理均会写入操作日志"
          }
          onClose={() => {if(!busy){privateVersion.current++;setTarget(null);setPrivate(null);}}}
        >
          <form className="ad-creator-form" onSubmit={perform}>
            {["identity", "bank"].includes(target.type) && (
              <>
                <p>
                  资料默认脱敏。需要核对时，可查看完整姓名和号码，查看操作会记录日志。
                </p>
                <button
                  type="button"
                  className="ad-button secondary"
                  onClick={async () => {
                    const current=++privateVersion.current;
                    try {
                      const details=await api<NonNullable<typeof privateData>>("/admin/finance/"+target.type+"/"+target.id+"/reveal","POST",{});
                      if(alive.current&&current===privateVersion.current)setPrivate(details);
                    } catch(e) {
                      if(alive.current&&current===privateVersion.current)setError((e as Error).message);
                    }
                  }}
                >
                  查看完整审核资料
                </button>
                {privateData && (
                  <dl className="ad-definition">
                    <dt>姓名</dt>
                    <dd>{privateData.name}</dd>
                    <dt>证件 / 银行</dt>
                    <dd>{privateData.documentType || privateData.bank}</dd>
                    <dt>号码</dt>
                    <dd style={{ overflowWrap: "anywhere" }}>
                      {privateData.number}
                    </dd>
                  </dl>
                )}
                {privateData?.photos && (
                  <div className="ad-identity-photos">
                    {Object.entries(privateData.photos).map(([side, path]) => (
                      <a
                        key={side}
                        href={path}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={path}
                          alt={side === "front" ? "证件正面" : "证件反面"}
                        />
                        <span>
                          {side === "front" ? "证件正面" : "证件反面"} ·
                          点击查看原图
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
            {target.action === "adjust" && (
              <>
                <label>
                  操作方向
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="credit">上分 · 增加余额</option>
                    <option value="debit">下分 · 扣减余额</option>
                  </select>
                </label>
                <label>
                  金额（USD）
                  <input
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="至少 1 USD，最多两位小数"
                  />
                </label>
                <p>立即修改客户账本，不能扣成负余额。请核对账号和金额。</p>
              </>
            )}
            {target.action === "freeze" && (
              <p>
                {target.frozen
                  ? "冻结会撤销现有登录会话，禁止客户登录、领取任务及资金申请，并阻止待审充值和提现继续出款。历史记录和冻结额度保留。"
                  : "解冻后客户可重新登录；已有申请不会自动通过。"}
              </p>
            )}
            {target.amount != null && <h3>{money(target.amount)}</h3>}
            {target.decision === "approve" && target.kind === "deposit" && (
              <label className="ad-finance-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={received}
                  onChange={(e) => setReceived(e.target.checked)}
                />
                我已在外部核实实际收款，同意入账
              </label>
            )}
            {target.decision === "paid" && (
              <>
                <p>请在实际转账完成后登记。系统不会代为发起银行转账。</p>
                <label>
                  实际出款凭证编号
                  <input
                    required
                    minLength={3}
                    maxLength={150}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </>
            )}
            {(target.decision || target.action !== "review") && (
              <label>
                {target.decision === "reject" ? "拒绝原因" : "操作备注"}
                <textarea
                  required={
                    target.decision === "reject" || target.action !== "review"
                  }
                  minLength={target.action !== "review" ? 3 : 2}
                  maxLength={500}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="ad-error">
                {error}
              </p>
            )}
            {(target.decision || target.action !== "review") && (
              <button className="ad-button" disabled={busy}>
                {busy ? "保存中…" : "确认保存"}
              </button>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
