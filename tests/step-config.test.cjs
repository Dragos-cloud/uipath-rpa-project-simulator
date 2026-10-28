// Synthetic metadata only: no private workflow, workbook or document content.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const s=page.indexOf(a),e=page.indexOf(b,s);assert.ok(s>=0&&e>s,a);return page.slice(s,e);};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const api=new Function('APP_VERSION','esc','T',between('const NS_X   =','/* =====================================================================\n   12. IMPORT UI')+
  '\nreturn {normalizeConfigRows,stepConfigEvidence,validStepConfigEvidence,stepConfigurationHtml,configWorkflowMatch,buildProjectModel,inlineSteps,readXamlContext};')('test',esc,k=>k);
const clone=x=>JSON.parse(JSON.stringify(x));
const workflow=(file,activities=[],evidence={})=>({file,cls:path.basename(file,'.xaml'),activities,invokes:activities.filter(a=>a.tag==='InvokeWorkflowFile'),
  throws:[],logs:[],decisions:[],tryCatches:0,isFramework:false,projectEvidence:{configUses:[],fileUses:[],argumentBindings:[],...evidence}});
const use=(key,idx=1,activity='CopyFile',property='Path')=>({key,idx,activity,property});
const makeConfig=(pairs,sheet='Settings')=>{
  const rows=[{row:1,cells:[{ref:'A1',value:'Name'},{ref:'B1',value:'Value'}]},...pairs.map(([key,value,formula],i)=>({row:i+2,cells:[{ref:'A'+(i+2),value:key},{ref:'B'+(i+2),value,formula:!!formula}]}))];
  return {version:1,file:'Data/Config.xlsx',...api.normalizeConfigRows(rows,sheet,'Data/Config.xlsx',['Data/Template.docx'])};
};
const step=(file='Project/Child.xaml',extra={})=>({id:'s1',name:'Prepare posting',configSource:{file,scope:'workflow',...extra}});
const render=ev=>api.stepConfigurationHtml({_importReport:{}},{configEvidence:ev});

test('only the selected workflow receives its referenced settings; a same-named setting elsewhere is not copied',()=>{
  const child=workflow('Project/Child.xaml',[],{configUses:[use('TemplatePath')]}),other=workflow('Project/Other.xaml',[],{configUses:[use('OtherPath')]});
  const configs=[makeConfig([['TemplatePath','Data/Template.docx'],['OtherPath','PRIVATE_PATH']])],before=clone(configs);
  const ev=api.stepConfigEvidence(step(),[child,other],configs);
  assert.equal(ev.settings.length,1);assert.equal(ev.settings[0].key,'TemplatePath');assert.equal(ev.settings[0].references[0].file,child.file);
  assert.equal(ev.settings[0].candidates[0].source.cell,'B2');assert.deepEqual(configs,before);
  assert.equal(api.validStepConfigEvidence(ev),true);assert.doesNotMatch(JSON.stringify(ev),/PRIVATE_PATH|OtherPath/);
});

test('inline activity/subtree scopes exclude sibling steps and a decision excludes branch contents',()=>{
  const acts=[{idx:0,parent:-1},{idx:1,parent:0},{idx:2,parent:1},{idx:3,parent:0},{idx:4,parent:3}];
  const wf=workflow('Main.xaml',acts,{configUses:[use('First',1),use('Nested',2),use('Sibling',3),use('Branch',4)]});
  const configs=[makeConfig([['First','x'],['Nested','y'],['Sibling','z'],['Branch','q']])];
  assert.deepEqual(api.stepConfigEvidence(step('Main.xaml',{scope:'subtree',idx:1}),[wf],configs).settings.map(s=>s.key),['First','Nested']);
  assert.deepEqual(api.stepConfigEvidence(step('Main.xaml',{scope:'activity',idx:3}),[wf],configs).settings.map(s=>s.key),['Sibling']);
});

test('repeated child calls retain their own directly forwarded config key, without cross-call contamination',()=>{
  const bindings=[{idx:5,target:'Child.xaml',parameter:'templateArg',key:'FirstTemplate'},{idx:8,target:'Child.xaml',parameter:'templateArg',key:'SecondTemplate'}];
  const parent=workflow('Project/Main.xaml',[],{argumentBindings:bindings});
  const child=workflow('Project/Child.xaml',[],{fileUses:[{idx:2,activity:'CopyFile',property:'Path',symbol:'templateArg'}]});
  const configs=[makeConfig([['FirstTemplate','Data/Template.docx'],['SecondTemplate','Data/Template.docx']])];
  const at=idx=>api.stepConfigEvidence(step(child.file,{caller:{file:parent.file,idx,target:'Child.xaml'}}),[parent,child],configs);
  assert.deepEqual(at(5).settings.map(s=>s.key),['FirstTemplate']);assert.deepEqual(at(8).settings.map(s=>s.key),['SecondTemplate']);
  assert.equal(at(5).settings[0].references[0].kind,'forwarded');assert.equal(at(5).settings[0].references[0].via.idx,5);
  assert.equal(api.validStepConfigEvidence(at(5)),true);
});

test('ambiguous workflow basenames are refused instead of guessing a card binding',()=>{
  const a=workflow('Project/A/Child.xaml'),b=workflow('Project/B/Child.xaml');
  assert.equal(api.configWorkflowMatch([a,b],'Child.xaml'),null);
  assert.equal(api.configWorkflowMatch([a,b],'B/Child.xaml'),b);
  assert.equal(api.configWorkflowMatch([a,b],'project\\a\\CHILD.xaml'),a);
  assert.equal(api.stepConfigEvidence(step(a.file,{caller:{file:'Project/Main.xaml',idx:1,target:'Child.xaml'}}),[a,b],[]).state,'unavailable');
  assert.equal(api.configWorkflowMatch([a,clone(a)],a.file),null);
});

test('duplicate setting keys display all candidates and do not pick an effective value',()=>{
  const wf=workflow('Main.xaml',[],{configUses:[use('MaxRetryNumber')]});
  const ev=api.stepConfigEvidence(step(wf.file),[wf],[makeConfig([['MaxRetryNumber','0']]),makeConfig([['MaxRetryNumber','3']],'Constants')]);
  assert.equal(ev.settings[0].ambiguous,true);assert.deepEqual(ev.settings[0].candidates.map(e=>e.displayValue),['0','3']);
  assert.match(render(ev),/scfg.duplicate/);assert.equal(api.validStepConfigEvidence(ev),true);
});

test('sensitive rows/keys and nonallowlisted values never enter step evidence or its rendered section',()=>{
  const pairs=[['Password','SECRET_CANARY'],['ApiToken','TOKEN_CANARY'],['InputFolder','C:\\PATH_CANARY'],['TemplatePath','C:\\old\\Data\\Template.docx'],
    ['PortalUrl','https://example.invalid/SECRET_QUERY?token=QUERY_CANARY'],['Calculated','FORMULA_CANARY',true],['TestMode','false'],['MaxRetryNumber','0']];
  const wf=workflow('Main.xaml',[],{configUses:pairs.map(([key],idx)=>use(key,idx))});
  const cfg=makeConfig(pairs);cfg.entries[0].source.unapproved='SOURCE_CANARY';
  const ev=api.stepConfigEvidence(step(wf.file),[wf],[cfg]),output=JSON.stringify(ev)+render(ev);
  assert.doesNotMatch(output,/CANARY|SECRET_QUERY|Password|ApiToken|C:\\|\bold\b/);assert.match(output,/https:\/\/example.invalid/);
  assert.equal(ev.settings.find(s=>s.key==='Calculated').candidates[0].status,'formula');
  assert.equal(ev.settings.find(s=>s.key==='TestMode').candidates[0].displayValue,'false');
  assert.equal(ev.settings.find(s=>s.key==='MaxRetryNumber').candidates[0].displayValue,'0');
});

test('asset values are runtime-supplied, unknown keys are unresolved, and no config is not a missing-setting verdict',()=>{
  const wf=workflow('Main.xaml',[],{configUses:[use('QueueAsset'),use('UnknownKey')]});
  const ev=api.stepConfigEvidence(step(wf.file),[wf],[makeConfig([['QueueAsset','ASSET_VALUE_CANARY']],'Assets')]);
  assert.equal(ev.settings[0].candidates[0].status,'runtime');assert.equal(ev.unresolved[0].key,'UnknownKey');assert.doesNotMatch(JSON.stringify(ev),/CANARY/);
  const without=api.stepConfigEvidence(step(wf.file),[wf],[]);assert.equal(without.hasConfig,false);assert.match(render(without),/scfg.noWorkbook/);
  const none=api.stepConfigEvidence(step('Empty.xaml'),[workflow('Empty.xaml')],[makeConfig([])]);assert.match(render(none),/scfg.none/);
});

test('long inventories disclose key, reference and candidate truncation',()=>{
  const uses=Array.from({length:45},(_,i)=>use('Setting'+i,i));for(let i=50;i<65;i++) uses.push(use('Setting0',i));
  const wf=workflow('Main.xaml',[],{configUses:uses}),cfg=makeConfig(uses.slice(0,45).map(u=>[u.key,'withheld']));
  const ev=api.stepConfigEvidence(step(wf.file),[wf],Array(9).fill(cfg));
  assert.equal(ev.settings.length,40);assert.equal(ev.truncated,true);assert.equal(ev.settings[0].moreReferences,8);assert.equal(ev.settings[0].moreCandidates,1);
  assert.match(render(ev),/scfg.truncated/);assert.match(render(ev),/scfg.moreReferences/);assert.match(render(ev),/scfg.moreCandidates/);
});

test('old sessions get reimport guidance; samples and assumed exception steps do not acquire invented config',()=>{
  assert.match(api.stepConfigurationHtml({_importReport:{}},{}),/scfg.reimport/);
  assert.equal(api.stepConfigurationHtml({},{}),'');assert.equal(api.stepConfigurationHtml({_importReport:{}},{synth:true}),'');
  assert.match(api.stepConfigurationHtml({_importReport:{}},{grp:true}),/scfg.group/);
  assert.equal(api.stepConfigurationHtml({_importReport:{}},{branch:'exception'}),'');
  assert.match(render({version:999}),/scfg.reimport/);
  assert.match(render(api.stepConfigEvidence({id:'synthetic'},[],[])),/scfg.unavailable/);
});

test('invalid optional saved evidence cannot render unsafe values or break the inspector',()=>{
  const wf=workflow('Main.xaml',[],{configUses:[use('MaxRetryNumber')]}),ev=api.stepConfigEvidence(step(wf.file),[wf],[makeConfig([['MaxRetryNumber','2']])]);
  for(const mutate of [x=>{x.settings='bad'},x=>{x.settings[0].references=null},x=>{x.settings[0].candidates[0].displayValue='UNSAFE_CANARY'},
    x=>{x.settings[0].candidates[0].category='unrecognized'},x=>{x.source=null}]){
    const broken=clone(ev);mutate(broken);assert.equal(api.validStepConfigEvidence(broken),false);assert.match(render(broken),/scfg.reimport/);assert.doesNotMatch(render(broken),/CANARY/);
  }
});

test('all supplied text is escaped, including code/argument source labels',()=>{
  const wf=workflow('Main.xaml',[],{configUses:[use('<img src=x>',1,'<svg>','<script>')]});
  const ev=api.stepConfigEvidence(step(wf.file),[wf],[makeConfig([['<img src=x>','hidden']])]);const html=render(ev);
  assert.doesNotMatch(html,/<img|<svg|<script>/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);
});

test('complete builder attaches source-bound evidence without changing process names, timings, routes, requirements or AI/PDD consumers',()=>{
  const main=workflow('Main.xaml',[{idx:0,parent:-1,tag:'Sequence',name:'Main'},{idx:1,parent:0,tag:'InvokeWorkflowFile',name:'Prepare posting',target:'Child.xaml',args:[]}]);
  const child=workflow('Child.xaml',[],{configUses:[use('TemplatePath')]});
  const src={xaml:[main,child],projectContext:{configuration:[makeConfig([['TemplatePath','Data/Template.docx']])]}};
  const built=api.buildProjectModel(src),card=built.model.steps.find(s=>s.xamlTarget==='Child.xaml');
  assert.equal(card.configSource.caller.idx,1);assert.equal(card.configEvidence.settings[0].key,'TemplatePath');assert.equal(card.name,'Prepare posting');
  const old=api.buildProjectModel({...src,projectContext:{configuration:[]}});
  const shape=m=>m.steps.map(({configEvidence,...s})=>s);assert.deepEqual(shape(built.model),shape(old.model));
  assert.equal(built.model._pdd,undefined);assert.deepEqual(built.gaps,old.gaps);
  assert.doesNotMatch(between("$('btnExplain').addEventListener", '/* Shared by Brief me'),/configEvidence|stepConfiguration/);
  assert.doesNotMatch(between('function pddQuestions(', 'const STR ='),/configEvidence|stepConfiguration/);
});

test('inline builder records exact activity scopes and serializes new metadata in schema 1',()=>{
  const acts=[{idx:0,parent:-1,tag:'Sequence',name:'Main'},{idx:1,parent:0,tag:'Sequence',name:'Prepare posting'},
    {idx:2,parent:1,tag:'CopyFile',name:'Copy template'}];
  const wf=workflow('Main.xaml',acts,{configUses:[use('TemplatePath',2)]});
  const built=api.buildProjectModel({xaml:[wf],projectContext:{configuration:[makeConfig([['TemplatePath','Data/Template.docx']])]}});
  const card=built.model.steps.find(s=>s.name==='Prepare posting');assert.equal(card.configSource.idx,1);assert.equal(card.configEvidence.settings.length,1);
  const serialize=new Function('SCHEMA_VERSION','APP_VERSION',between('function serializeModel(', '/* Returns { model, from, notes }')+'\nreturn serializeModel;')(1,'0.70');
  const saved=JSON.parse(serialize(built.model));assert.equal(saved.meta.schema,1);assert.deepEqual(saved.steps.find(s=>s.id===card.id).configEvidence,card.configEvidence);
});

test('inspector wiring is present and every new label has English/Romanian parity',()=>{
  assert.match(between('function selectStep(', "$('inspClose')"),/stepConfigurationHtml\(S.model,s\)/);
  const keys=[...page.slice(page.indexOf("'tb.process':'Process'")).matchAll(/'(scfg\.[^']+)'\s*:/g)].map(m=>m[1]);
  assert.ok(keys.length>30);for(const key of new Set(keys)) assert.equal(keys.filter(k=>k===key).length,2,key);
});
