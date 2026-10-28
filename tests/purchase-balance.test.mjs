import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('purchase breakdown caps balance usage, preserves cents, and respects minimum top-up',async()=>{
 const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom'});
 try{const {default:Balance}=await server.ssrLoadModule('/src/studio/PurchaseBalance.tsx');
 const render=(amount,available)=>renderToStaticMarkup(createElement(Balance,{amount,available,returnDesign:'advanced'}));
 const short=render(6789,410);assert.match(short,/63\.79/);assert.match(short,/amount=63\.79/);assert.match(short,/returnDesign=advanced/);assert.match(short,/No payment has been deducted/);
 const exact=render(6789,6789);assert.match(exact,/balance is sufficient/);assert.doesNotMatch(exact,/finance=deposit/);
 const excess=render(6789,10000);assert.match(excess,/− \$67\.89/);assert.doesNotMatch(excess,/finance=deposit/);
 const tiny=render(6789,6788);assert.match(tiny,/\$0\.01/);assert.match(tiny,/amount=1\.00/);assert.match(tiny,/Minimum deposit/);
 const held=renderToStaticMarkup(createElement(Balance,{amount:6789,available:0,reservedAmount:410,returnDesign:'advanced'}));assert.match(held,/Already deducted/);assert.match(held,/63\.79/);assert.doesNotMatch(held,/No payment has been deducted/);assert.doesNotMatch(held,/Available balance/);
 const paid=renderToStaticMarkup(createElement(Balance,{amount:6789,available:0,reservedAmount:6789,returnDesign:'advanced'}));assert.match(paid,/payment has been prepared/);assert.doesNotMatch(paid,/finance=deposit/);
 const zero=render(6789,0);assert.match(zero,/amount=67\.89/);
 assert.match(render(6789,null),/Checking available balance/);assert.doesNotMatch(render(6789,null),/finance=deposit/);
 }finally{await server.close();}
});
