import CustomerDetails from "./CustomerDetails";
import { type Customer, identityLabel, geoLabel } from "./customerTypes";
import { countryName } from "../countries";
import { useEffect, useRef, useState } from "react";
import { api, money, date } from "../api";
import { Badge, Empty, Modal, Pagination } from "./components";
import { createCsv, downloadBlob } from "../studio/downloads";
interface Invite {
  id: string;
  hint: string;
  code: string;
  label: string;
  used: number;
  active: number;
  created_at: string;
  owner_id: string;
}
type User = Customer;
export default function Accounts() {
  const [users, setUsers] = useState<User[]>([]),
    [invitations, setInvites] = useState<Invite[]>([]),
    [label, setLabel] = useState("创作者邀请"),
    [count, setCount] = useState("1"),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [inviteQuery, setInviteQuery] = useState(""),
    [inviteState, setInviteState] = useState("all"),
    [page, setPage] = useState(1),
    [invitePage, setInvitePage] = useState(1),
    [revoke, setRevoke] = useState<Invite | null>(null);
  const [countryFilter, setCountryFilter] = useState("all"),
    [kycFilter, setKycFilter] = useState("all"),
    [accountFilter, setAccountFilter] = useState("all"),
    [selectedId, setSelectedId] = useState("");
  const actionInFlight = useRef(false);
  async function load() {
    const r = await api<{ users: User[]; invitations: Invite[] }>(
      "/admin/accounts",
    );
    setUsers(r.users);
    setInvites(r.invitations);
  }
  useEffect(() => {
    let active = true;
    void api<{ users: User[]; invitations: Invite[] }>("/admin/accounts")
      .then((r) => {
        if (active) {
          setUsers(r.users);
          setInvites(r.invitations);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const filteredUsers = users.filter(
    (u) =>
      (countryFilter === "all" ||
        (countryFilter === "empty"
          ? !u.country
          : u.country === countryFilter)) &&
      (kycFilter === "all" || u.identity_status === kycFilter) &&
      (accountFilter === "all" ||
        (accountFilter === "frozen" ? !!u.frozen : !u.frozen)) &&
      (!query.trim() ||
        [
          u.name,
          u.email,
          u.id,
          u.registration_ip,
          u.last_login_ip,
          u.invite_code,
          u.agent_username,
          u.admin_note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );
  const filteredInvites = invitations.filter(
    (i) =>
      (inviteState === "all" ||
        (inviteState === "active" && !!i.active) ||
        (inviteState === "inactive" && !i.active)) &&
      (!inviteQuery.trim() ||
        ((i.code || i.hint) + " " + i.label)
          .toLowerCase()
          .includes(inviteQuery.trim().toLowerCase())),
  );
  useEffect(
    () =>
      setPage((p) =>
        Math.min(p, Math.max(1, Math.ceil(filteredUsers.length / 10))),
      ),
    [filteredUsers.length],
  );
  useEffect(
    () =>
      setInvitePage((p) =>
        Math.min(p, Math.max(1, Math.ceil(filteredInvites.length / 10))),
      ),
    [filteredInvites.length],
  );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("邀请码已复制");
      setError("");
    } catch {
      setError("浏览器无法复制，请手动选择邀请码");
    }
  }
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ codes: { code: string }[] }>(
        "/admin/invitations",
        "POST",
        { label, count: Number(count) },
      );
      setCodes(r.codes.map((c) => c.code));
      setMessage("邀请码已生成，长期有效。");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      actionInFlight.current = false;
    }
  }
  async function revokeInvite() {
    if (!revoke || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    try {
      await api("/admin/invitations/" + revoke.id + "/revoke", "POST", {});
      await load();
      setRevoke(null);
      setMessage("邀请码已停用；已有客户归属保持不变。");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      actionInFlight.current = false;
    }
  }
  function exportUsers() {
    const rows = [
      [
        "客户名称",
        "账号邮箱",
        "账号编号",
        "国家地区（IP识别）",
        "注册IP",
        "最近登录IP",
        "注册时间（北京时间）",
        "最近登录时间",
        "账号状态",
        "实名状态",
        "可用余额 USD",
        "冻结 USD",
        "总额 USD",
        "累计佣金 USD",
        "已入账充值 USD",
        "已出款提现 USD",
        "归属后台",
        "邀请码",
        "待审资金笔数",
        "已通过银行卡",
        "内部备注",
      ],
      ...filteredUsers.map((u) => [
        u.name,
        u.email,
        u.id,
        geoLabel(u),
        u.registration_ip,
        u.last_login_ip,
        date(u.created_at, true),
        u.last_login_at ? date(u.last_login_at, true) : "",
        u.frozen ? "冻结" : "正常",
        identityLabel(u.identity_status),
        (u.wallet.available / 100).toFixed(2),
        (u.wallet.held / 100).toFixed(2),
        (u.wallet.total / 100).toFixed(2),
        (u.wallet.earned / 100).toFixed(2),
        (u.deposited / 100).toFixed(2),
        (u.withdrawn / 100).toFixed(2),
        u.agent_username,
        u.invite_code,
        u.pending_funds,
        u.approved_cards,
        u.admin_note,
      ]),
    ];
    downloadBlob(
      new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" }),
      "客户筛选记录.csv",
    );
  }
  return (
    <>
      <div className="ad-account-summary">
        <div>
          <span>可管理客户</span>
          <strong>{users.length}</strong>
          <small>依当前后台权限显示</small>
        </div>
        <div>
          <span>有效邀请码</span>
          <strong>{invitations.filter((i) => i.active).length}</strong>
          <small>长期有效 · 次数不限</small>
        </div>
        <div>
          <span>已停用邀请码</span>
          <strong>{invitations.filter((i) => !i.active).length}</strong>
          <small>保留归属与注册记录</small>
        </div>
      </div>
      {error && !revoke && (
        <p role="alert" className="ad-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="ad-callout">
          {message}
        </p>
      )}
      <section className="ad-panel">
        <div className="ad-panel-heading">
          <div>
            <h2>可管理客户 · {users.length}</h2>
            <p>总后台可见全部客户，代理仅可见自己邀请码注册的客户。</p>
          </div>
        </div>
        <div className="ad-toolbar">
          <input
            className="ad-finance-search"
            aria-label="搜索客户"
            placeholder="搜索邮箱、编号、IP、邀请码或备注"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="国家地区筛选"
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部国家地区</option>
            <option value="empty">未识别国家地区</option>
            {[...new Set(users.map((u) => u.country).filter(Boolean))].map(
              (c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="实名状态筛选"
            value={kycFilter}
            onChange={(e) => {
              setKycFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部实名状态</option>
            {["not_submitted", "review", "approved", "rejected"].map((k) => (
              <option key={k} value={k}>
                {identityLabel(k)}
              </option>
            ))}
          </select>
          <select
            aria-label="账号状态筛选"
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部账号状态</option>
            <option value="active">正常账号</option>
            <option value="frozen">已冻结账号</option>
          </select>
          <button
            className="ad-button secondary small"
            disabled={!filteredUsers.length}
            onClick={exportUsers}
          >
            导出筛选客户
          </button>
          <button
            className="ad-button secondary small"
            onClick={() => void load().catch((e) => setError(e.message))}
          >
            刷新列表
          </button>
        </div>
        <div className="ad-table-scroll">
          <table>
            <thead>
              <tr>
                <th>客户 / 账号</th>
                <th>国家与 IP</th>
                <th>账号 / 实名</th>
                <th>资金 · USD</th>
                <th>归属 / 邀请码</th>
                <th>最近登录 / 注册</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice((page - 1) * 10, page * 10).map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <small>{u.email}</small>
                    <small>#{u.id.slice(0, 8)}</small>
                    {u.admin_note && (
                      <small
                        className="ad-customer-note-preview"
                        title={u.admin_note}
                      >
                        {u.admin_note}
                      </small>
                    )}
                  </td>
                  <td>
                    <b>{geoLabel(u)}</b>
                    <small>注册 {u.registration_ip || "历史未采集"}</small>
                    <small>登录 {u.last_login_ip || "暂无记录"}</small>
                  </td>
                  <td>
                    <Badge tone={u.frozen ? "red" : "green"}>
                      {u.frozen ? "已冻结" : "正常"}
                    </Badge>
                    <small>
                      <Badge
                        tone={
                          u.identity_status === "approved"
                            ? "green"
                            : u.identity_status === "review"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {identityLabel(u.identity_status)}
                      </Badge>
                    </small>
                  </td>
                  <td>
                    <b>可用 {money(u.wallet.available)}</b>
                    <small>冻结 {money(u.wallet.held)}</small>
                    <small>合计 {money(u.wallet.total)}</small>
                  </td>
                  <td>
                    <b>{u.agent_username}</b>
                    <small>{u.invite_code || "旧邀请码"}</small>
                  </td>
                  <td>
                    {u.last_login_at
                      ? date(u.last_login_at, true)
                      : "历史未采集"}
                    <small>注册 {date(u.created_at, true)}</small>
                  </td>
                  <td>
                    <button
                      className="ad-button secondary small"
                      onClick={() => setSelectedId(u.id)}
                    >
                      客户档案
                    </button>
                    {(u.pending_funds > 0 ||
                      u.pending_cards > 0 ||
                      u.identity_status === "review") && (
                      <small className="ad-customer-pending">有待办审批</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredUsers.length && (
          <Empty
            title={users.length ? "没有匹配的客户" : "等待客户注册"}
            text={
              users.length
                ? "请核对邮箱或账号编号。"
                : "客户通过你的邀请码注册后会出现在这里。"
            }
          />
        )}
        <Pagination
          page={page}
          total={filteredUsers.length}
          onChange={setPage}
        />
      </section>
      <section className="ad-panel ad-invite-generator">
        <div className="ad-panel-heading">
          <div>
            <h2>我的注册邀请码</h2>
            <p>
              新生成的 8 位邀请码长期有效，使用次数不限，归属于生成它的后台。
            </p>
          </div>
        </div>
        <form onSubmit={generate} className="ad-invite-form">
          <label>
            邀请码备注
            <input
              required
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="如：十月创作者招募"
            />
          </label>
          <label>
            生成数量
            <input
              type="number"
              min={1}
              max={20}
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          <button disabled={busy} className="ad-button">
            {busy ? "处理中…" : "生成邀请码"}
          </button>
        </form>
        {codes.length > 0 && (
          <div className="ad-generated-codes">
            <div>
              <b>本次生成 {codes.length} 个邀请码</b>
              <button
                className="ad-button secondary small"
                onClick={() => void copy(codes.join("\n"))}
              >
                复制全部
              </button>
            </div>
            <div className="ad-code-grid">
              {codes.map((code) => (
                <button
                  key={code}
                  aria-label={"复制邀请码 " + code}
                  onClick={() => void copy(code)}
                >
                  {code}
                  <small>点击复制</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="ad-panel" style={{ marginBottom: 22 }}>
        <div className="ad-panel-heading">
          <div>
            <h2>邀请码记录 · {invitations.length}</h2>
            <p>停用仅停止新注册，已有客户归属保持不变。</p>
          </div>
        </div>
        <div className="ad-toolbar">
          <input
            className="ad-finance-search"
            aria-label="搜索邀请码"
            placeholder="搜索邀请码或备注"
            value={inviteQuery}
            onChange={(e) => {
              setInviteQuery(e.target.value);
              setInvitePage(1);
            }}
          />
          <select
            aria-label="邀请码状态"
            value={inviteState}
            onChange={(e) => {
              setInviteState(e.target.value);
              setInvitePage(1);
            }}
          >
            <option value="all">全部状态</option>
            <option value="active">长期有效</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
        <div className="ad-table-scroll">
          <table>
            <thead>
              <tr>
                <th>邀请码 / 备注</th>
                <th>归属后台</th>
                <th>已注册人数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvites
                .slice((invitePage - 1) * 10, invitePage * 10)
                .map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b className="ad-invite-code">
                        {i.code || "旧码尾号 " + i.hint}
                      </b>
                      <small>{i.label}</small>
                    </td>
                    <td>
                      {i.owner_id === "super"
                        ? "总后台"
                        : "代理 #" + i.owner_id.slice(0, 8)}
                    </td>
                    <td>{i.used}</td>
                    <td>
                      <Badge tone={i.active ? "green" : "neutral"}>
                        {i.active ? "长期有效" : "已停用"}
                      </Badge>
                    </td>
                    <td>
                      <div className="ad-row-actions">
                        {i.code && (
                          <button onClick={() => void copy(i.code)}>
                            复制
                          </button>
                        )}
                        {!!i.active && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setRevoke(i);
                            }}
                          >
                            停用
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!filteredInvites.length && (
          <Empty
            title={invitations.length ? "没有匹配的邀请码" : "还没有邀请码"}
            text={
              invitations.length
                ? "试试其他备注或状态。"
                : "生成后分享给客户，对方注册后归属到你的后台。"
            }
          />
        )}
        <Pagination
          page={invitePage}
          total={filteredInvites.length}
          onChange={setInvitePage}
        />
      </section>
      {selectedId && users.find((u) => u.id === selectedId) && (
        <CustomerDetails
          key={selectedId}
          customer={users.find((u) => u.id === selectedId)!}
          onClose={() => setSelectedId("")}
          onRefresh={load}
        />
      )}
      {revoke && (
        <Modal
          title="停用这个邀请码？"
          description="停用后不能用于新注册，不影响已经归属的客户。"
          onClose={() => !busy && setRevoke(null)}
        >
          <div className="ad-revoke-confirm">
            <strong>{revoke.code || revoke.hint}</strong>
            <p>{revoke.label}</p>
            {error && (
              <p role="alert" className="ad-error">
                {error}
              </p>
            )}
            <button
              className="ad-button"
              disabled={busy}
              onClick={() => void revokeInvite()}
            >
              {busy ? "正在停用…" : "确认停用邀请码"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
