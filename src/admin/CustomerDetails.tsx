import { useState } from "react";
import { api, date, money } from "../api";
import { countryName } from "../countries";
import { Modal, Badge } from "./components";
import { type Customer, identityLabel, geoLabel } from "./customerTypes";
export default function CustomerDetails({
  customer: u,
  onClose,
  onRefresh,
}: {
  customer: Customer;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [note, setNote] = useState(u.admin_note),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [confirm, setConfirm] = useState(false);
  async function action(kind: "notes" | "revoke-sessions") {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(
        "/admin/accounts/" + u.id + "/" + kind,
        "POST",
        kind === "notes" ? { note } : {},
      );
      setSuccess(
        kind === "notes"
          ? "内部备注已保存"
          : "已退出此客户的全部设备，需要重新登录",
      );
      setConfirm(false);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
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
          {u.approved_cards} 张银行卡已通过 · {u.pending_cards} 张卡待审 ·{" "}
          {u.pending_funds} 笔资金申请待审
        </p>
        <a
          className="ad-button secondary small"
          href={"/admin#finance?customer=" + encodeURIComponent(u.email)}
        >
          进入资金与认证审批
        </a>
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
    </Modal>
  );
}
