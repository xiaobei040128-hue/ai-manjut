import type {PropsWithChildren} from 'react';
import {MobileScroll} from '../mobile';
import './app-scroll.css';

// Production uses browser/compositor scrolling, without per-frame React updates.
// The device demonstration keeps its original drag and simulated keyboard runtime.
export default function AppScroll({className='',children}:PropsWithChildren<{className?:string}>){
 const nativeMode=import.meta.env.PROD||window.innerWidth<=600||new URLSearchParams(location.search).get('view')==='app';
 if(!nativeMode)return <MobileScroll className={className}>{children}</MobileScroll>;
 return <section className={`mobile-page app-native-scroll ${className}`}><div className="mobile-scroll" data-testid="mobile-scroll"><div className="mobile-scroll-content" data-testid="mobile-scroll-content">{children}</div></div></section>;
}
