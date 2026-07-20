import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5199/money-map-artifact/';
const PORT = 9337; const OUT = '/tmp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = (p) => new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); });
class CDP { constructor(ws){this.ws=ws;this.id=0;this.p=new Map();ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&this.p.has(m.id)){this.p.get(m.id)(m.result);this.p.delete(m.id);}};}
  send(method,params={}){const id=++this.id;return new Promise((r)=>{this.p.set(id,r);this.ws.send(JSON.stringify({id,method,params}));});}
  async ev(e){const r=await this.send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r?.result?.value;} }
async function main(){
  const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--hide-scrollbars','--disable-gpu','--no-first-run','--window-size=480,1260','about:blank'],{stdio:'ignore'});
  process.on('exit',()=>chrome.kill());
  let tab; for(let i=0;i<40;i++){try{const l=await getJSON('/json');tab=l.find((t)=>t.type==='page');if(tab?.webSocketDebuggerUrl)break;}catch{}await sleep(250);}
  const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r)=>(ws.onopen=r));
  const cdp=new CDP(ws);await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:470,height:1220,deviceScaleFactor:2,mobile:false});
  await cdp.send('Page.navigate',{url:URL});await sleep(2500);
  const pickStyle=(l)=>cdp.ev(`(()=>{const b=[...document.querySelectorAll('button.style-tile')].find(x=>x.querySelector('.style-tile-label')?.textContent.trim()===${JSON.stringify(l)});if(!b)return 'no';b.click();return 'ok';})()`);
  const pickDataset=(l)=>cdp.ev(`(()=>{const e=[...document.querySelectorAll('button.mode-opt')].find(b=>b.textContent.trim()===${JSON.stringify(l)});if(!e)return 'no';e.click();return 'ok';})()`);
  const play=()=>cdp.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Play events/.test(b.textContent));if(!b)return 'no';b.click();return 'ok';})()`);
  // full-device shot + a branch-region close-up crop
  const shot=async(n,clip)=>{const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:clip||{x:0,y:0,width:470,height:1220,scale:1}});writeFileSync(`${OUT}/${n}.png`,Buffer.from(r.data,'base64'));};
  const CLOSE={x:0,y:300,width:300,height:640,scale:1};
  console.log('style',await (async()=>{await pickDataset('Simple with debt');return pickStyle('Pills');})());
  await sleep(600);await play();await sleep(11000);
  await shot('pills5_simple_full');await shot('pills5_simple_close',CLOSE);
  console.log('opt',await pickDataset('Optimizer'));await sleep(500);await play();await sleep(17000);
  await shot('pills5_opt_full');await shot('pills5_opt_close',CLOSE);
  console.log('done');ws.close();chrome.kill();
}
main().catch((e)=>{console.error(e);process.exit(1);});
