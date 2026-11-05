// A separately owned browser server gives cleanup a public process handle on macOS Chrome.
import {chromium} from 'playwright';
export async function testBrowser(options){
 const server=await chromium.launchServer(options),browser=await chromium.connect(server.wsEndpoint());
 return {browser,async close(){
  let timer,closed=false;
  const cleanup=(async()=>{await Promise.allSettled(browser.contexts().map(context=>context.close()));await browser.close();await server.close();closed=true;})();
  try{await Promise.race([cleanup,new Promise(resolve=>timer=setTimeout(resolve,5000))]);}
  finally{
   clearTimeout(timer);
   if(!closed){
    // All assertions have already completed. Kill only this test's owned Chrome process group.
    const killing=server.kill();
    for(const pipe of server.process().stdio)pipe?.destroy?.();
    await killing;
   }else for(const pipe of server.process().stdio)pipe?.destroy?.();
  }
 }};
}
