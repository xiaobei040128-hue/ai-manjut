const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'});
export const shanghaiDay=(date=new Date())=>formatter.format(date);
