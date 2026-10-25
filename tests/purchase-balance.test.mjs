import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('purchase breakdown caps balance usage, preserves cents, and respects minimum top-up',async()=>{
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{const {default:Balance}=await server.ssrLoadModule('/src/studio/PurchaseBalance.tsx');
 const render=(amount,available)=>renderToStaticMarkup(createElement(Balance,{amount,available,returnDesign:'advanced'}));
 const short=render(6789,410);assert.match(short,/63\.79/);assert.match(short,/amount=63\.79/);assert.match(short,/returnDesign=advanced/);assert.match(short,/尚未扣款/);
 const exact=render(6789,6789);assert.match(exact,/余额足够/);assert.doesNotMatch(exact,/finance=deposit/);
 const excess=render(6789,10000);assert.match(excess,/− \$67\.89/);assert.doesNotMatch(excess,/finance=deposit/);
 const tiny=render(6789,6788);assert.match(tiny,/\$0\.01/);assert.match(tiny,/amount=1\.00/);assert.match(tiny,/最低充值/);
 const zero=render(6789,0);assert.match(zero,/amount=67\.89/);
 assert.match(render(6789,null),/正在核对/);assert.doesNotMatch(render(6789,null),/finance=deposit/);
 }finally{await server.close();}
});
