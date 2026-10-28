import {createContext,useContext} from 'react';
export const PermissionContext=createContext<Record<string,boolean>|null>(null);
export const usePermission=()=>{const permissions=useContext(PermissionContext);return (key:string)=>!permissions||permissions[key]===true;};
