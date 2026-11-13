// Operational configuration details belong in the management interface.
export function customerMessage(message:string){
 if(/佣金率超出|派单|派发配置|后台|配置未|未配置|按比例|余额比例|默认规则|SQLite|SQLITE|stack trace|ECONN|数据库|服务端|内部错误/i.test(message))return '暂时无法完成操作，请联系客服';
 return message;
}
