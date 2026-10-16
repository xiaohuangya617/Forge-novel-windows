const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const url = 'file:///' + path.join(root, 'electron/resources/app/index.html').replace(/\\/g, '/');
const chromePath = process.env.NOVEL_CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const book = { id:'multi-race-book', name:'连发竞态测试', currentChapterId:'multi-ch1', worldview:'', plotSet:'', globalPrompt:'', writingStyle:'', characters:[], chapters:[{id:'multi-ch1',title:'第一章',content:'开场正文',summary:'',prompt:'',checkResult:[]}], chatHistory:[], forbiddenWords:[] };
const api = { url:'https://mock.test/chat', key:'k', model:'mock', contextWindow:1000000, temp:1, top_p:.9, repetition_penalty:1, maxTokens:3000, freqPenalty:0, presPenalty:0, ctxChapters:5, stopWords:'', thinking:false, reasoningEffort:'high', notify:false, dualMode:false, multiChap:true, multiChapCount:2, branchAutoSend:false, rewriteAutoSend:false };
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:chromePath}); const context=await browser.newContext();
  await context.addInitScript(({book,api})=>{
    localStorage.setItem('books_v2',JSON.stringify([book])); localStorage.setItem('currentBookId_v2',book.id);
    localStorage.setItem('global_characters_v2','[]'); localStorage.setItem('global_actions_v2','[]'); localStorage.setItem('global_costumes_v2','[]');
    localStorage.setItem('api_config_v3',JSON.stringify({main:api,polish:{url:'https://mock.test/chat',key:'k',model:'mock',maxTokens:3000},image:{},act:{}}));
    let seq=0;
    window.fetch=async(_url,opts)=>{ const body=JSON.parse(opts?.body||'{}'); const isSummary=body.messages?.[1]?.content?.includes('【任务】'); const n=++seq; await new Promise(r=>setTimeout(r,isSummary?20:(n===1?900:20))); const content=isSummary?'【摘要】测试摘要\\n【成长】无':'# 测试章节'+n+'\\n\\n测试正文'+n; return new Response(JSON.stringify({choices:[{message:{content:content},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}}),{status:200,headers:{'Content-Type':'application/json'}}); };
  },{book,api});
  const page=await context.newPage(); await page.goto(url,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(900);
  await page.locator('#chatInp').fill('第一轮连发'); await page.locator('#sendMsgBtn').click(); await page.waitForTimeout(80);
  await page.locator('#stopGenBtn').click(); await page.locator('#chatInp').fill('停止后新任务'); await page.locator('#sendMsgBtn').click(); await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>({text:document.body.innerText,content:document.querySelector('#novelContent')?.innerText||'',stopDisabled:document.querySelector('#stopGenBtn')?.disabled,summary:document.querySelector('#summaryArea')?.value||''}));
  await browser.close(); console.log(JSON.stringify(state,null,2)); assert.match(state.text,/测试章节2/); assert.equal(state.stopDisabled,true); assert.match(state.summary,/测试摘要/);
})().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});


