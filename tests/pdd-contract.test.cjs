// Synthetic inputs only. Exercise the exact, dependency-free production code.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const start=page.indexOf(a),end=page.indexOf(b,start);assert.ok(start>=0&&end>start,a);return page.slice(start,end);};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const api=new Function('APP_VERSION','esc','T',between('const NS_X   =','/* =====================================================================\n   12. IMPORT UI')+
  between('async function parseAll(', '/* stage 1b')+
  '\nreturn {canonicalPdd,validateCanonicalPdd,parsePddJson,parsePddBlocks,createPddConverters,convertPdd,parseAll,buildProjectModel,pddReadSummary,pddPromptContext,PDD_SCHEMA_VERSION};')('test',esc,key=>key);
const clone=v=>JSON.parse(JSON.stringify(v));
const heading=text=>({kind:'p',heading:1,text});
const table=(header,rows)=>({kind:'tbl',header,rows:[header,...rows]});
const json=()=>({nume_proces:'Synthetic review',tobe_sections:[{title:'Review order',steps:[{descriere:'Check evidence',detalii:'Read only'}]}],
  biz_exceptii:[{denumire:'Missing evidence',pas:'1',actiune:'Ask for clarification'}],
  iam_apps:[{denumire:'Order system'}],test_cases:[{id:1,tip:'Positive',descriere:'Complete evidence',rezultat:'Accepted'}]});
const blocks=()=>[heading('4. Future State'),table(['Step','Description','Details'],[['1','Check evidence','Read only']])];
const file=(name,body={})=>({name,relPath:'Project/'+name,kind:'pdd',blob:{text:async()=>JSON.stringify(body),arrayBuffer:async()=>new ArrayBuffer(0)}});
const workflow=()=>({file:'Main.xaml',cls:'Main',activities:[],invokes:[],throws:[],logs:[],decisions:[],tryCatches:0,isFramework:false});

test('both readers produce the same versioned, validated documentation contract',()=>{
  for(const p of [api.parsePddJson(json()),api.parsePddBlocks(blocks())]){
    assert.equal(p.modelType,'pdd');assert.equal(p.schemaVersion,1);assert.equal(api.PDD_SCHEMA_VERSION,1);
    assert.deepEqual(api.validateCanonicalPdd(p),[]);
    for(const key of ['sections','exceptions','exceptionStates','interventions','rules','constraints','apps','applicationEvidence','outofscope','notifications','testCases']) assert.ok(Array.isArray(p[key]),key);
    assert.equal(p.sections[0].steps[0].kind,'activity');
    assert.equal(p.meta.schema,undefined);assert.equal(p.steps,undefined);
  }
});

test('metadata stays optional; explicit, detected and unknown have distinct evidence',()=>{
  const j=api.parsePddJson(json());
  assert.equal(j.metadataEvidence.name.status,'provided');assert.equal(j.metadataEvidence.name.source.path,'/nume_proces');
  assert.equal(j.meta.author,'');assert.equal(j.metadataEvidence.author.status,'unknown');
  assert.equal(j.metadataEvidence.author.source.locationKnown,false);
  const d=api.parsePddBlocks([{kind:'p',heading:0,text:'Synthetic document title'},...blocks()]);
  assert.equal(d.metadataEvidence.name.status,'detected');assert.equal(d.metadataEvidence.name.source.block,1);
  assert.equal(d.metadataEvidence.name.source.locationKnown,true);
  const empty=api.parsePddBlocks([]);
  assert.equal(empty.metadataEvidence.name.status,'unknown');assert.ok(empty.diagnostics.warnings.length);
});

test('English and Romanian metadata aliases retain explicit field/table/row evidence',()=>{
  for(const fields of [
    [['Process name','Synthetic review'],['Document version','2.1'],['Author','Test author'],['Template ID','review-v2'],['Expected scope','Order intake']],
    [['Denumirea procesului','Synthetic review'],['Versiunea documentului','2.1'],['Autorul documentului','Test author'],['Identificator șablon','review-v2'],['Domeniu de aplicare','Order intake']]
  ]){
    const p=api.parsePddBlocks([heading('Document control'),table(['Field','Value'],fields),...blocks()]);
    assert.equal(p.meta.version,'2.1');assert.equal(p.meta.templateId,'review-v2');assert.equal(p.meta.expectedScope,'Order intake');
    assert.equal(p.meta.author,'Test author');assert.equal(p.metadataEvidence.author.status,'provided');
    assert.equal(p.metadataEvidence.author.source.table,1);assert.equal(p.metadataEvidence.author.source.row,4);
  }
});

test('document history records the actual revision row, not the parser/app version',()=>{
  const p=api.parsePddBlocks([heading('Document history'),table(['Version','Date','Change description'],[['1','2026-01-01','Draft'],['1.1','2026-02-01','Review']])]);
  assert.equal(p.meta.version,'1.1');assert.equal(p.metadataEvidence.version.source.row,3);
  assert.equal(p.schemaVersion,1);assert.equal(p.parser.version,1);
});

test('JSON records and optional metadata keep original JSON Pointer locations',()=>{
  const input={...json(),template_id:'orders-v1',expected_scope:'Intake',versiune_doc:1.1,ops_tip_declansare:'Manual',
    'sys_excepții':[{denumire:'Service unavailable',actiune:'Review service'}],notif_342:[{denumire:'Clarification',subiect:'Evidence needed'}]};
  const p=api.parsePddJson(input);
  assert.equal(p.sections[0].steps[0].source.path,'/tobe_sections/0/steps/0');
  assert.equal(p.exceptions[1].source.path,'/sys_excepții/0');assert.equal(p.notifications[0].source.path,'/notif_342/0');
  assert.equal(p.applicationEvidence[0].source.path,'/iam_apps/0');assert.equal(p.testCases[0].id,'1');
  assert.equal(p.metadataEvidence.templateId.source.path,'/template_id');assert.equal(p.meta.version,'1.1');
  assert.equal(p.opsEvidence.trigger.source.path,'/ops_tip_declansare');assert.equal(p.opsEvidence.trigger.status,'provided');
});

test('DOCX operational details and applications retain row evidence without changing apps[] consumers',()=>{
  const p=api.parsePddBlocks([heading('General information'),table(['Field','Value'],[['Trigger','After approval']]),
    heading('Applications'),table(['Application','Role in process'],[['Order system','Read reference']])]);
  assert.equal(p.opsEvidence.trigger.source.row,2);assert.equal(p.opsEvidence.trigger.status,'provided');
  assert.deepEqual(p.apps,['Order system']);assert.equal(p.applicationEvidence[0].source.table,2);
});

test('normalization is nonmutating, deterministic and idempotent through JSON serialization',()=>{
  const input=json(),before=clone(input),p=api.parsePddJson(input);
  assert.deepEqual(input,before);
  const saved=clone(p),again=api.canonicalPdd(saved);
  assert.deepEqual(again,p);assert.deepEqual(saved,p);
  assert.deepEqual(api.parsePddJson(input),p);
  assert.notEqual(p.sections[0].uid,p.sections[0].steps[0].uid);
});

test('converter registry supports injected readers and binds every source to the actual file',async()=>{
  const calls=[];
  const registry=api.createPddConverters({json:obj=>{calls.push('json');return api.parsePddJson(obj);},docx:async()=>{calls.push('docx');return api.parsePddBlocks(blocks());}});
  const converted=await api.convertPdd(file('REVIEW.JSON',json()),registry);
  assert.deepEqual(calls,['json']);assert.equal(converted.priority,20);
  const p=converted.pdd;
  assert.equal(p.parser.id,'legacy-pdd-json');assert.equal(p.sourceFile,'Project/REVIEW.JSON');
  for(const s of [p.sections[0].source,p.sections[0].steps[0].source,p.exceptions[0].source,p.metadataEvidence.name.source,p.applicationEvidence[0].source]) assert.equal(s.file,p.sourceFile);
  assert.equal(p.metadataEvidence.author.source.locationKnown,false);
  const d=await api.convertPdd(file('review.docx'),registry);
  assert.deepEqual(calls,['json','docx']);assert.equal(d.pdd.parser.id,'pdd-docx-tables');assert.equal(d.priority,10);
  assert.ok(Object.isFrozen(registry));
});

test('unsupported formats and invalid converter registrations fail explicitly',async()=>{
  await assert.rejects(api.convertPdd(file('review.pdf')),{code:'UNSUPPORTED_PDD_FORMAT'});
  for(const registry of [null,[{}],[{extensions:['json'],format:'json',priority:10,read:null}]])
    await assert.rejects(api.convertPdd(file('review.json'),registry),{code:'INVALID_PDD'});
  await assert.rejects(api.convertPdd(file('review.json',json()),[{id:'bad',version:0,extensions:['json'],format:'json',priority:1,read:()=>({kind:'pdd-json'})}]),/parser/);
});

test('malformed JSON input is rejected with useful paths, not silently replaced by empty data',()=>{
  for(const [patch,pattern] of [
    [{tobe_sections:{}},/tobe_sections/],[{tobe_sections:[null]},/tobe_sections/],
    [{tobe_sections:[{steps:'invalid'}]},/tobe_sections\/0\/steps/],
    [{tobe_sections:[{title:7}]},/tobe_sections\/0\/title/],
    [{biz_exceptii:[{denumire:{text:'wrong'}}]},/biz_exceptii\/0\/denumire/],
    [{template_id:{id:'wrong'}},/template_id/],[{test_cases:[false]},/test_cases/]
  ]) assert.throws(()=>api.parsePddJson({...json(),...patch}),pattern);
});

test('standalone validator reports corrupt shapes without throwing; versioned data is not silently repaired',()=>{
  const good=api.parsePddJson(json());
  const mutations=[p=>{p.sections={};},p=>{p.meta=null;},p=>{p.exceptions={};},p=>{p.exceptions=[null];},
    p=>{p.sections[0].steps='invalid';},p=>{p.sections[0].steps[0].source.row=0;},
    p=>{p.metadataEvidence.name.source=null;},p=>{p.opsEvidence=null;},p=>{p.diagnostics.tables=[null];},
    p=>{p.diagnostics.warnings={};},p=>{delete p.rules;},p=>{p.applicationEvidence=[];},
    p=>{p.interventions=[{documentedOnly:'yes'}];},p=>{p.sections[0].steps[0].kind='runtime-proof';},
    p=>{p.metadataEvidence.name.source.file='another.docx';},p=>{p.kind=7;}];
  for(const mutate of mutations){
    const p=clone(good);mutate(p);
    assert.doesNotThrow(()=>api.validateCanonicalPdd(p));assert.ok(api.validateCanonicalPdd(p).length);
    assert.throws(()=>api.canonicalPdd(p),{code:'INVALID_PDD'});
  }
  assert.deepEqual(api.validateCanonicalPdd(null),['PDD must be an object']);
});

test('future versions, duplicate identifiers and broken state links are refused',()=>{
  const p=api.parsePddJson(json());
  assert.throws(()=>api.canonicalPdd({...p,schemaVersion:99}),/Unsupported PDD schema/);
  const duplicate=clone(p);duplicate.sections[0].steps[0].uid=duplicate.sections[0].uid;
  assert.throws(()=>api.canonicalPdd(duplicate),/unique/);
  const definitions=clone(p);definitions.exceptions.push({...definitions.exceptions[0],uid:'another'});
  assert.throws(()=>api.canonicalPdd(definitions),/unique within exceptions/);
  const legacy={kind:'pdd-docx',exceptions:[],exceptionStates:[{name:'Missing',exceptionId:'not-defined'}]};
  assert.throws(()=>api.canonicalPdd(legacy),/exceptionId/);
});

test('legacy fragments retain values but do not acquire invented provenance or metadata',()=>{
  const input={kind:'pdd-docx',meta:{name:'Legacy import'},sections:[{ref:'1',title:'Review',steps:[{ref:'1',desc:'Check source'}]}]};
  const before=clone(input),p=api.canonicalPdd(input);
  assert.deepEqual(input,before);assert.equal(p.meta.name,'Legacy import');
  assert.equal(p.metadataEvidence.name.status,'unknown');assert.equal(p.sections[0].steps[0].source.locationKnown,false);
  assert.equal(p.sections[0].steps[0].source.path,undefined);
});

test('typed mapping is a derived view; documented gateways/human tasks do not become executable routes',()=>{
  const p=api.parsePddBlocks([heading('4. Future State'),table(['#','BPMN element','Element type','Description'],
    [['1','Review','Activity','Check evidence'],['2','Approved?','Gateway','Decision']]),
    heading('Human review'),table(['Escalation point','Available actions','Task SLA / assignee'],[['Missing evidence','Clarify','Reviewer']])]);
  assert.equal(p.sections[0].steps.length,2);assert.equal(p.mappingSections.length,1);
  assert.equal(p.mappingSections[0].steps[0].uid,p.sections[0].steps[0].uid);
  const built=api.buildProjectModel({xaml:[workflow()],pdd:p});
  assert.equal(built.model._importReport.routing.selectableDecisions,0);assert.equal(built.model.exceptions.length,0);
  assert.ok(!built.model.steps.some(s=>s.gate));assert.equal(built.model._pdd.interventions[0].documentedOnly,true);
});

test('invalid higher-priority PDD never displaces a valid document and its error remains visible',async()=>{
  const registry=api.createPddConverters({json:api.parsePddJson,docx:async()=>api.parsePddBlocks(blocks())});
  const parsed=await api.parseAll([file('review.docx'),file('invalid.json',{nume_proces:'Broken',tobe_sections:'invalid'})],registry);
  assert.equal(parsed.pdd.kind,'pdd-docx');assert.match(parsed.errors[0],/invalid.json.*tobe_sections/);
  const built=api.buildProjectModel({xaml:[workflow()],pdd:parsed.pdd,parseErrors:parsed.errors});
  assert.match(built.model._importReport.errors[0],/tobe_sections/);assert.equal(built.model._importReport.pdd.schemaVersion,1);
  assert.equal(built.model._importReport.pdd.parser.id,'pdd-docx-tables');
});

test('injected converter priority and first equal-priority document are honored without claiming a merge',async()=>{
  const readers={json:api.parsePddJson,docx:async()=>api.parsePddBlocks(blocks())};
  const defaultRegistry=api.createPddConverters(readers);
  const same=await api.parseAll([file('first.json',json()),file('second.json',json())],defaultRegistry);
  assert.equal(same.pdd.sourceFile,'Project/first.json');assert.match(same.importWarnings[0],/not merged/);
  const customRegistry=defaultRegistry.map(c=>({...c,priority:c.format==='docx'?30:c.priority}));
  const custom=await api.parseAll([file('preferred.json',json()),file('review.docx')],customRegistry);
  assert.equal(custom.pdd.sourceFile,'Project/review.docx');assert.match(custom.importWarnings[0],/Selected Project\/review.docx/);
  assert.match(custom.importWarnings[0],/not merged/);
});

test('the builder rejects malformed documentation before it can become a misleading empty review',()=>{
  assert.throws(()=>api.buildProjectModel({xaml:[workflow()],pdd:{kind:'pdd-json',meta:{name:'Broken'},sections:'wrong'}}),/sections must be an array/);
  const fragment={kind:'pdd-docx',meta:{name:'Legacy documented name'},sections:[]},before=clone(fragment);
  const built=api.buildProjectModel({xaml:[workflow()],pdd:fragment});
  assert.deepEqual(fragment,before);assert.deepEqual(api.validateCanonicalPdd(built.model._pdd),[]);
  assert.equal(built.model._pdd.metadataEvidence.name.status,'unknown');
});

test('reordered columns, repeated headers, AS-IS exclusion and unknown tables keep honest coverage',()=>{
  const p=api.parsePddBlocks([heading('3. AS-IS'),table(['Description','Step'],[['Old work','1']]),
    heading('4. TO-BE'),table(['Details','Step','Description'],[['Evidence','1','Review'],['Details','Step','Description']]),
    table(['Unfamiliar','Columns'],[['x','y']])]);
  assert.equal(p.sections.length,1);assert.equal(p.sections[0].steps.length,1);
  assert.equal(p.sections[0].steps[0].source.table,2);assert.equal(p.sections[0].steps[0].source.row,2);
  assert.deepEqual(p.diagnostics.coverage,{tablesRead:3,tablesClassified:2,tablesUnrecognised:1});
  assert.equal(p.diagnostics.tables[0].kind,'current-steps');assert.deepEqual(p.diagnostics.tables[2].headers,['Unfamiliar','Columns']);
});

test('metadata/readout and prompt source locations escape HTML and never render undefined JSON locators',async()=>{
  const p=(await api.convertPdd(file('review.json',{...json(),apr_intocmit_nume:'<img src=x onerror=bad()>',template_id:'<script>bad</script>'}))).pdd;
  const html=api.pddReadSummary(p);
  assert.doesNotMatch(html,/<img|<script|undefined/);assert.match(html,/&lt;img/);
  assert.match(html,/Project\/review.json \/apr_intocmit_nume/);
  const prompt=api.pddPromptContext(p);
  assert.match(prompt,/Project\/review.json \/tobe_sections\/0\/steps\/0/);assert.doesNotMatch(prompt,/undefined/);
});

test('PDD contract and source evidence survive the unchanged saved-session envelope',()=>{
  const serialize=new Function('SCHEMA_VERSION','APP_VERSION',between('function serializeModel(', '/* Returns { model, from, notes }')+'\nreturn serializeModel;')(1,'0.67');
  const model={meta:{name:'Synthetic'},steps:[],exceptions:[],_pdd:api.parsePddJson(json())};
  const saved=JSON.parse(serialize(model));
  assert.equal(saved.meta.schema,1);assert.equal(saved._pdd.schemaVersion,1);assert.deepEqual(api.validateCanonicalPdd(saved._pdd),[]);
  assert.equal(model.meta.schema,undefined);assert.equal(JSON.parse(serialize({meta:{},steps:[],exceptions:[]}))._pdd,undefined);
});

test('all metadata UI labels have English/Romanian parity',()=>{
  const keys=[...page.matchAll(/'(pdd\.[^']+)'\s*:/g)].map(m=>m[1]);
  assert.ok(keys.length>=40);
  for(const key of new Set(keys)) assert.equal(keys.filter(k=>k===key).length,2,key);
});
