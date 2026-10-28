import { countryName } from "../countries";
export interface Customer {
  progress?: {stage:number;planDay:number|null;completed:number;total:number;dailyClaimed:number;dailyCompleted:number;dailyLimit?:number;currentOrdinal:number;currentTask:string};
  id: string;
  email: string;
  name: string;
  bio: string;
  channel: string;
  created_at: string;
  country: string;
  country_source: string;
  registration_country: string;
  last_login_country: string;
  registration_ip: string;
  last_login_ip: string;
  last_login_at: string;
  last_login_agent: string;
  admin_note: string;
  customer_type: 'real' | 'test';
  frozen: number;
  freeze_reason: string;
  invite_code: string;
  invite_label: string;
  agent_id: string;
  agent_username: string;
  identity_status: string;
  approved_cards: number;
  pending_cards: number;
  pending_funds: number;
  pending_deposits: number;
  pending_withdrawals: number;
  session_count: number;
  deposited: number;
  withdrawn: number;
  assignmentCount: number;
  counts: { active: number; review: number; completed: number };
  wallet: {
    available: number;
    earned: number;
    held: number;
    taskHeld: number;
    withdrawalHeld: number;
    total: number;
  };
}
export const customerTypeLabel = (value: string) => value === 'test' ? '测试账号' : '真实客户';
export const identityLabel = (status: string) =>
  ({
    approved: "已实名",
    review: "实名审核中",
    rejected: "实名未通过",
    not_submitted: "未提交实名",
  })[status] || "未提交实名";

export const geoLabel = (u: Customer) =>
  u.country
    ? countryName(u.country)
    : u.country_source === "private"
      ? "本机 / 内网"
      : u.country_source === "unavailable"
        ? "定位暂不可用"
        : "未识别";
