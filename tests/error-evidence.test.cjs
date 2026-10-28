const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const start=page.indexOf(a),end=page.indexOf(b,start);assert.ok(start>=0&&end>start,a);return page.slice(start,end);};
// Minimal DOM fixture adapter, not an XML parser: tests exercise the real
// parseXaml traversal/type extraction. Real XML is also checked in the browser.
const NS_X='http://schemas.microsoft.com/winfx/2006/xaml';
const namespaces={x:NS_X,s:'clr-namespace:System;assembly=mscorlib',io:'clr-namespace:System.IO;assembly=mscorlib',ui:'clr-namespace:UiPath.Core;assembly=UiPath.System.Activities',custom:'clr-namespace:Example'};
function el(localName,attrs={},children=[],text=''){
  return {localName,children,attrs,text,
    get firstElementChild(){return this.children[0]||null;},
    get textContent(){return this.text+this.children.map(c=>c.textContent).join('');},
    getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return Object.hasOwn(this.attrs,k);},
    getAttributeNS(ns,k){for(const [prefix,uri] of Object.entries(namespaces))if(uri===ns&&this.attrs[prefix+':'+k]!==undefined)return this.attrs[prefix+':'+k];return null;},
    lookupNamespaceURI(prefix){return namespaces[prefix]||null;},
    getElementsByTagName(){return this.children.flatMap(c=>[c,...c.getElementsByTagName('*')]);}};
}
let currentRoot;
class FixtureDOMParser{parseFromString(){return {documentElement:currentRoot,querySelector(){return null;}};}}
const api=new Function('DOMParser',`const NS_X=${JSON.stringify(NS_X)},NS_ANN='urn:annotation'; const FW_NAMES=new Set();\n`+
  between('const XSKIP =','/* Pull the ordered business spine')+
  '\nreturn {parseXaml,readCatchType,analyseWorkflowErrors,collectErrorEvidence,inlineExceptionRaises,isErrorHandlerActivity};')(FixtureDOMParser);
const seq=(name,children)=>el('Sequence',{DisplayName:name},children);
const act=(tag,name,attrs={})=>el(tag,{DisplayName:name,...attrs});
const caught=(type,children)=>el('Catch',{'x:TypeArguments':type},[seq('Handler body',children)]);
const tc=(name,work,catches,finallyNodes)=>el('TryCatch',{DisplayName:name},[
  el('TryCatch.Try',{},[seq('Protected body',work)]),el('TryCatch.Catches',{},catches),
  ...(finallyNodes===undefined?[]:[el('TryCatch.Finally',{},finallyNodes)])]);
const raise=(message='Failure')=>act('Throw','Raise '+message,{Exception:`[New System.Exception("${message}")]`});
function parse(children,file='Main.xaml'){
  currentRoot=el('Activity',{'x:Class':file.replace('.xaml','')},[seq('Main',children)]);
  return api.parseXaml(file,'fixture');
}

test('Catch-only workflow records protected scope, general type and literal status evidence without inventing raises',()=>{
  const wf=parse([tc('Send clarification',[act('SendOutlookMail','Send customer mail')],[caught('s:Exception',[
    act('Assign','Set recovery status',{To:'[out_Status]',Value:'["ManualRecoveryRequired"]'})])])]);
  const ev=wf.errorEvidence;
  assert.equal(ev.raises.length,0);assert.equal(ev.handlers.length,1);
  const h=ev.handlers[0];assert.equal(h.catchType.fullName,'System.Exception');assert.equal(h.catchType.category,'general');
  assert.ok(h.protected.some(a=>a.tag==='SendOutlookMail'));assert.ok(!h.protected.some(a=>a.tag==='Assign'));
  assert.equal(h.actions.find(a=>a.tag==='Assign').statusAssignment.value,'ManualRecoveryRequired');
  const model=api.collectErrorEvidence({xaml:[wf],exceptions:[]});
  assert.equal(model.injectableRaises,0);assert.equal(model.counts.handlers,1);
});
test('Catch type aliases resolve to declared CLR namespaces, custom names are not misclassified',()=>{
  for(const [type,full,category] of [['ui:BusinessRuleException','UiPath.Core.BusinessRuleException','business'],['io:IOException','System.IO.IOException','system-typed'],['custom:BusinessRuleException','Example.BusinessRuleException','unknown'],['missing:Exception','','unknown']]){
    const t=api.readCatchType(el('Catch',{'x:TypeArguments':type}));
    assert.equal(t.fullName,full);assert.equal(t.category,category);
  }
});
test('multiple Catches stay attached to one Try; sibling scopes cannot protect an outside Throw',()=>{
  const wf=parse([tc('Protected',[raise('inside')],[caught('io:IOException',[]),caught('s:Exception',[])]),raise('outside')]);
  assert.equal(wf.errorEvidence.handlers.length,2);
  assert.equal(wf.errorEvidence.raises[0].handlerCandidates.length,2);
  assert.deepEqual(wf.errorEvidence.raises[0].handlerCandidates.map(h=>h.typeRelation),['unverified','exact-name']);
  assert.equal(wf.errorEvidence.raises[1].handlerCandidates.length,0);
});
test('Throw in Catch/Finally is not protected by that same Try, but outer Try may protect it',()=>{
  const inner=tc('Inner',[act('ReadFile','Read')],[caught('s:Exception',[raise('from catch')])],[raise('from finally')]);
  const wf=parse([tc('Outer',[inner],[caught('s:Exception',[])])]);
  const ev=wf.errorEvidence,outer=ev.handlers.find(h=>h.scope==='Outer');
  for(const r of ev.raises){assert.deepEqual(r.handlerCandidates.map(c=>c.id),[outer.id]);assert.equal(r.inHandler,true);}
});
test('nested Catch Rethrow belongs to the nearest Catch, Finally is separate and empty Finally is retained',()=>{
  const wf=parse([tc('Outer',[act('ReadFile','Read')],[caught('s:Exception',[
    tc('Inside handler',[act('WriteFile','Write')],[caught('s:Exception',[act('Rethrow','Propagate')])],[])
  ])],[act('CloseApp','Cleanup')])]);
  const ev=wf.errorEvidence;
  assert.equal(ev.handlers.find(h=>h.scope==='Outer').rethrows.length,0);
  assert.equal(ev.handlers.find(h=>h.scope==='Inside handler').rethrows.length,1);
  assert.equal(ev.handlers.find(h=>h.scope==='Outer').finally[0].name,'Cleanup');
  assert.equal(ev.finallyScopes,2);assert.equal(ev.rethrows.length,1);
});
test('a Catch in another workflow does not become a proven handler for a child Throw',()=>{
  const main=parse([tc('Caller',[act('InvokeWorkflowFile','Call child',{WorkflowFileName:'Child.xaml'})],[caught('s:Exception',[])])]);
  const child=parse([raise('child')],'Child.xaml');
  const ev=api.collectErrorEvidence({xaml:[main,child],exceptions:[]});
  assert.equal(ev.raises[0].handlerCandidates.length,0);assert.equal(ev.handlers.length,1);
});
test('Catch and Finally calls stay out of the normal invocation spine but remain source activities',()=>{
  const wf=parse([tc('Try',[act('InvokeWorkflowFile','Normal',{WorkflowFileName:'Normal.xaml'})],[caught('s:Exception',[
    act('InvokeWorkflowFile','Recover',{WorkflowFileName:'Recover.xaml'})])],[act('InvokeWorkflowFile','Cleanup',{WorkflowFileName:'Cleanup.xaml'})])]);
  assert.deepEqual(wf.invokes.map(a=>a.target),['Normal.xaml']);
  assert.ok(wf.errorEvidence.handlers[0].actions.some(a=>a.target==='Recover.xaml'));
  assert.ok(wf.errorEvidence.handlers[0].finally.some(a=>a.target==='Cleanup.xaml'));
});
test('inline C# construction, strings and comments are not explicit raises',()=>{
  const code='var e = new System.Exception("construction"); // throw new System.Exception("comment")\n'+
    'var s = "throw new System.Exception(\\"string\\")"; /* throw new System.Exception("block") */\n'+
    'throw new System.Exception("real");';
  assert.deepEqual(api.inlineExceptionRaises(code,'CSharp').map(e=>e.message),['real']);
  assert.equal(api.inlineExceptionRaises('throw new System.Exception(variable); var e = new System.Exception("later");','CSharp').length,0);
});
test('inline VB comments/strings are not raises and Throw New is retained',()=>{
  const code="' Throw New System.Exception(\"comment\")\nDim e = New System.Exception(\"construction\")\n"+
    'Dim s = "Throw New System.Exception(""string"")"\nThrow New System.Exception("real")';
  assert.deepEqual(api.inlineExceptionRaises(code,'VisualBasic').map(e=>e.message),['real']);
});
test('Throw property-element expressions are read and unrelated secret assignments are not included',()=>{
  const property=el('Throw', {DisplayName:'Property raise'},[el('Throw.Exception',{},[el('InArgument',{},[],'[New System.Exception("property")]')])]);
  const wf=parse([property,tc('Scope',[],[caught('s:Exception',[
    act('Assign','Secret',{To:'[tokenStatus]',Value:'["Sensitive"]'})])])]);
  assert.equal(wf.errorEvidence.raises[0].message,'property');
  assert.ok(!wf.errorEvidence.handlers[0].actions.find(a=>a.name==='Secret').statusAssignment);
});
test('source inventory survives the existing model JSON contract without creating injections',()=>{
  const wf=parse([tc('Scope',[],[caught('s:Exception',[])])]);
  const model={meta:{schema:1},steps:[],exceptions:[],errorEvidence:api.collectErrorEvidence({xaml:[wf],exceptions:[]})};
  const saved=JSON.parse(JSON.stringify(model));assert.equal(saved.errorEvidence.handlers.length,1);assert.equal(saved.exceptions.length,0);
});
test('general Catch is a scope candidate for a more specific raise, not a verified recovery',()=>{
  const wf=parse([tc('Scope',[act('Throw','Raise IO',{Exception:'[New System.IO.IOException("IO")]'})],[caught('s:Exception',[])])]);
  assert.equal(wf.errorEvidence.raises[0].handlerCandidates[0].typeRelation,'general-catch');
  assert.equal(wf.errorEvidence.handlers[0].catchType.category,'general');
});
test('evidence HTML escapes imported file names, Catch types and activity text',()=>{
  const ui=new Function('T','esc','SAMPLES','base',between('function errorWorkflowForStep(', "$('btnErrorEvidence').addEventListener")+
    '\nreturn {errorEvidenceHtml,errorEvidenceContext};')(
      key=>key, s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),{},p=>String(p||'').split(/[\\/]/).pop());
  const wf=parse([tc('<script>scope</script>',[act('ReadFile','<img src=x onerror=alert(1)>')],[caught('s:Exception',[])])],'<script>file</script>.xaml');
  const model={exceptions:[],errorEvidence:api.collectErrorEvidence({xaml:[wf],exceptions:[]})};
  const html=ui.errorEvidenceHtml(model);assert.doesNotMatch(html,/<script>|<img src/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(ui.errorEvidenceContext(model),/runtime outcomes not evaluated/);
});
test('bilingual UI distinguishes code evidence, samples and old sessions; model stop has a review boundary',()=>{
  assert.match(page,/'eh.sample':'Training sample/);assert.match(page,/'eh.sample':'Exemplu de instruire/);
  assert.match(page,/This saved model has no error-handling details/);assert.match(page,/Modelul salvat nu include detalii despre tratarea erorilor/);
  assert.match(page,/outcome:'Review required',review:true/);
  assert.doesNotMatch(page,/No exceptions are raised in the code that was supplied/);
});

test('enclosing Catch stops an injected raise for review without fabricating handler or retry events',()=>{
  const main=[{id:'s1'},{id:'s2'}],state={exc:{trigger:'s1',handlingUnverified:true,retry:{count:3},recovers:true,path:['invented']}};
  const build=new Function('S','mainSteps','resolveMain','skippedIds',
    between('function buildPlanRaw(){','/* ---------------------------------------------------------------')+'\nreturn buildPlanRaw;')(
      state,()=>main,id=>id,()=>new Set());
  const events=build();
  assert.deepEqual(events.map(e=>e.t),['step','fail','end']);
  assert.equal(events.at(-1).outcome,'Review required');assert.equal(events.at(-1).review,true);
});

test('PDD draft preserves Catch evidence without claiming absent recovery or automatic handling',async()=>{
  const wf=parse([tc('Send mail',[act('SendMail','Send')],[caught('s:Exception',[
    act('Assign','Set recovery',{To:'[out_Status]',Value:'["ManualRecoveryRequired"]'})])])]);
  const evidence=api.collectErrorEvidence({xaml:[wf],exceptions:[]});
  const model={meta:{name:'Fixture',framework:false},steps:[{id:'s1',name:'Send',actor:'bot'}],
    exceptions:[{name:'Failure',class:'system',trigger:'s1',handlingUnverified:true}],errorEvidence:evidence};
  let aiContext='';
  const draft=new Function('S','byId','draftOverview','draftExtraQuestions','pddQuestions','pddStepNote','pddHtml','pddMd','errorEvidenceContext',
    between('async function buildPddDraft(){',"$('btnGenPdd').addEventListener")+'\nreturn buildPddDraft;')(
      {model},id=>model.steps.find(s=>s.id===id),async ctx=>{aiContext=ctx;return '';},async()=>[],()=>[],()=>'',
      doc=>JSON.stringify(doc),doc=>JSON.stringify(doc),()=> '\nCODE HANDLING EVIDENCE');
  const result=await draft();
  assert.match(result.raw.sys_exceptii[0].actiune,/Review required/);
  assert.match(result.md,/Code-defined Catch handlers/);assert.match(result.md,/ManualRecoveryRequired/);
  assert.doesNotMatch(result.md,/code implements no retry or recovery|handled by the underlying automation framework/);
  assert.match(aiContext,/CODE HANDLING EVIDENCE/);
});

const translations=new Function(between('const STR = {','let LANG =')+'\nreturn STR;')();
function explanationHarness({configured=true,lang='en',responseLanguage='auto',answer}={}){
  const nodes={};
  const element=()=>{
    const n={className:'',textContent:'',hidden:true,disabled:false,nextElementSibling:null,scrollTop:50};
    n.classList={contains:c=>n.className.split(/\s+/).includes(c),add:c=>{n.className+=' '+c;},remove:c=>{n.className=n.className.split(/\s+/).filter(x=>x!==c).join(' ');}};
    return n;
  };
  const wf=parse([tc('Send clarification',[act('SendMail','Email customer')],[caught('s:Exception',[
    act('Assign','Set recovery status',{To:'[out_Status]',Value:'["ManualRecoveryRequired"]'})])])]);
  const model={meta:{name:'Order processing'},exceptions:[],errorEvidence:api.collectErrorEvidence({xaml:[wf],exceptions:[]})};
  const S={model},LLM={on:configured,model:configured?'local-fixture':'',lang:responseLanguage},calls=[],exports=[];
  const T=key=>translations[lang][key]||key;
  const ui=new Function('T','esc','SAMPLES','base','S','LLM','document','$','askLLM','SYS','attachExportBtn','slug','LANG',
    between('function errorWorkflowForStep(',"$('btnErrorEvidence').addEventListener")+
    '\nreturn {explainErrorEvidence,resetErrorEvidenceExplanation,errorEvidenceExplainPrompt,errorEvidenceHtml,setLang:value=>{LANG=value;}};')(
      T,s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),{},p=>String(p||'').split(/[\\/]/).pop(),
      S,LLM,{createElement:element},id=>nodes[id]||(nodes[id]=element()),
      async(target,system,prompt)=>{calls.push({system,prompt});if(answer)await answer(target);else target.textContent='<b>Review this source</b>';},
      ()=> 'Configured language: '+responseLanguage, (...args)=>exports.push(args),s=>s,lang);
  return {ui,nodes,S,LLM,calls,exports,model};
}

test('business wording and technical disclosure keys have complete English/Romanian parity',()=>{
  const keys=lang=>Object.keys(translations[lang]).filter(k=>k.startsWith('eh.')).sort();
  assert.deepEqual(keys('en'),keys('ro'));
  for(const lang of ['en','ro']){
    assert.doesNotMatch(translations[lang]['eh.boundary'],/CLR|XAML|Catch|Rethrow|caller propagation/);
    assert.match(translations[lang]['eh.technicalLimits'],/CLR/);
  }
  assert.match(page, /id="errorEvidenceExplain" data-t="eh.explain"/);
  const opening=between("$('btnErrorEvidence').addEventListener", "$('errorEvidenceExplain').addEventListener");
  assert.doesNotMatch(opening,/askLLM|explainErrorEvidence\(/);
});

test('business-first evidence keeps exact source details in balanced expandable sections',()=>{
  const {ui,model}=explanationHarness();
  const html=ui.errorEvidenceHtml(model);
  assert.match(html,/<summary><b>Send clarification<\/b>/);
  assert.match(html,/Work covered by this response/);
  assert.match(html,/Recorded value: “ManualRecoveryRequired”/);
  assert.match(html,/System.Exception · Catch/);
  assert.match(html,/&lt;Assign&gt; Set recovery status — out_Status = ManualRecoveryRequired/);
  assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
});

test('Explain sends bounded project evidence and cautions, respects language and renders text safely',async()=>{
  const {ui,nodes,calls,exports}=explanationHarness({lang:'ro'});
  await ui.explainErrorEvidence();
  assert.equal(calls.length,1);assert.match(calls[0].system,/respond in Romanian/);
  assert.match(calls[0].prompt,/ManualRecoveryRequired/);assert.match(calls[0].prompt,/Available modeled failures: 0/);
  assert.match(calls[0].prompt,/does not prove a person was notified/);
  assert.match(calls[0].prompt,/tests and helpers are not proven/);
  assert.match(calls[0].prompt,/Never describe an unmapped raise as a confirmed main-process failure/);
  assert.match(calls[0].prompt,/Never infer that automatic recovery, retries or other handling are absent/);
  assert.equal(nodes.errorEvidenceAi.textContent,'<b>Review this source</b>');
  assert.equal(nodes.errorEvidenceExplain.disabled,false);assert.equal(nodes.errorEvidenceAiPanel.hidden,false);
  assert.equal(nodes.errorEvidenceScroll.scrollTop,0);assert.equal(exports.length,1);
  const explicit=explanationHarness({responseLanguage:'en',lang:'ro'});
  await explicit.ui.explainErrorEvidence();
  assert.doesNotMatch(explicit.calls[0].system,/respond in Romanian/);
});

test('unconfigured local AI provides translated setup guidance without making a request',async()=>{
  const {ui,nodes,calls}=explanationHarness({configured:false,lang:'ro'});
  await ui.explainErrorEvidence();
  assert.equal(calls.length,0);assert.match(nodes.errorEvidenceAi.textContent,/Nu a fost trimisă nicio cerere AI/);
  assert.equal(nodes.errorEvidenceExplain.disabled,false);
});

test('late replies cannot overwrite a closed, changed-project or changed-language view',async()=>{
  for(const change of ['close','project','language']){
    let finish;
    const h=explanationHarness({answer:target=>new Promise(resolve=>{finish=()=>{target.textContent='Obsolete answer';resolve();};})});
    const pending=h.ui.explainErrorEvidence();assert.equal(h.nodes.errorEvidenceExplain.disabled,true);
    if(change==='close')h.ui.resetErrorEvidenceExplanation();
    if(change==='project')h.S.model={...h.model};
    if(change==='language')h.ui.setLang('ro');
    finish();await pending;
    assert.notEqual(h.nodes.errorEvidenceAi.textContent,'Obsolete answer');assert.equal(h.exports.length,0);
  }
});

test('a failed AI request enables retry but does not create an answer export',async()=>{
  const h=explanationHarness({answer:async target=>{target.className='ai-out err';target.textContent='Connection failed';}});
  await h.ui.explainErrorEvidence();
  assert.equal(h.nodes.errorEvidenceExplain.disabled,false);
  assert.match(h.nodes.errorEvidenceAi.className,/err/);assert.equal(h.exports.length,0);
});

test('large source inventories are bounded and explicitly marked as truncated',()=>{
  const h=explanationHarness();
  h.model.errorEvidence.raises=Array.from({length:25},(_,i)=>({file:'Test'+i+'.xaml',activity:'Test',type:'Exception',message:'x'.repeat(1000),handlerCandidates:[]}));
  const prompt=h.ui.errorEvidenceExplainPrompt(h.model);
  assert.match(prompt,/Raise evidence truncated/);assert.ok(prompt.length<16000,prompt.length);
});
