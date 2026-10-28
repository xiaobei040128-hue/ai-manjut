import {translateText as tx,localizeNode as lx} from "../i18n/translate";
import type {SVGProps,ReactNode} from 'react';
type Props=Omit<SVGProps<SVGSVGElement>,'children'> & {children?:never};
const Icon=({children,...props}:Omit<Props,'children'> & {children:ReactNode})=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{lx(children)}</svg>;
export const WalletIcon=(p:Props):ReactNode=><Icon {...p}><path d="M19 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2H6a2 2 0 0 1 0-4"/><path d="M21 12h-5v5h5"/><path d="M17.7 14.5h.1"/></Icon>;
export const DepositIcon=(p:Props):ReactNode=><Icon {...p}><path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></Icon>;
export const WithdrawIcon=(p:Props):ReactNode=><Icon {...p}><path d="M12 15V3M8 7l4-4 4 4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></Icon>;
export const PaymentIcon=(p:Props):ReactNode=><Icon {...p}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></Icon>;
export const IdentityIcon=(p:Props):ReactNode=><Icon {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="10" r="2"/><path d="M5.5 16c.4-2.5 5.6-2.5 6 0M15 9h3m-3 4h3m-3 4h2"/></Icon>;
export const RecordsIcon=(p:Props):ReactNode=><Icon {...p}><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h3"/></Icon>;
export const ProfileIcon=(p:Props):ReactNode=><Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></Icon>;
export const HomeIcon=(p:Props):ReactNode=><Icon {...p}><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></Icon>;

