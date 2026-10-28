const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const start=page.indexOf(a),end=page.indexOf(b,start);assert.ok(start>=0&&end>start,a);return page.slice(start,end);};
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const api=new Function('APP_VERSION','esc','T',between('const NS_X   =','/* =====================================================================\n   12. IMPORT UI')+
  '\nreturn {buildProjectModel,parsePddBlocks,parsePddJson,buildMeta,buildImportReport,importReportHtml,createPddConverters,convertPdd,parseConfigWorkbook,reviewImportDocuments};')('test',escape,key=>key);
const pddFixture=()=>api.parsePddBlocks([{kind:'p',heading:1,text:'4. Future State'},
  {kind:'tbl',header:['Step','Description'],rows:[['Step','Description'],['1','Review evidence']]}]);
function workflow(file,activities=[]){return {file,cls:file.replace('.xaml',''),activities,invokes:[],throws:[],logs:[],decisions:[],tryCatches:0,isFramework:false};}

test('full model builder preserves parsed metadata, source errors and unsupported Flowchart evidence',()=>{
  const main=workflow('Main.xaml',[{idx:0,parent:-1,tag:'Sequence',name:'Main'},
    {idx:1,parent:0,tag:'FlowDecision',name:'Record available?',cond:'recordAvailable',branch:''}]);
  const pdd=api.parsePddBlocks([{kind:'p',heading:1,text:'1. General information'},
    {kind:'tbl',rows:[['No.','Description','Details'],['1','Process name','Synthetic review']],header:['No.','Description','Details']}]);
  const built=api.buildProjectModel({xaml:[main],pdd,sourceFileNames:['Main.xaml','review.docx'],parseErrors:['Missing.xaml: invalid XML']});
  assert.equal(built.model.meta.name,'Synthetic review');
  assert.equal(built.model._importReport.workflowCount,1);
  assert.equal(built.model._importReport.routing.flowchartDecisions,1);
  assert.equal(built.model._importReport.routing.selectableDecisions,0);
  assert.equal(built.model._importReport.pdd.steps,0);
  assert.ok(built.gaps.some(g=>g.kind==='import-error'));
  assert.equal(JSON.parse(JSON.stringify(built.model))._importReport.errors[0],'Missing.xaml: invalid XML');
});

test('project identity uses manifest first, then useful class/PDD, never an arbitrary first input file',()=>{
  const c={xaml:[],pdd:{meta:{name:'Documented process'}},uiapps:[],sourceFileNames:[],processWf:{cls:'Process'}};
  assert.equal(api.buildMeta(c).name,'Documented process');
  assert.equal(api.buildMeta({...c,projectName:'Manifest process'}).name,'Manifest process');
  assert.equal(api.buildMeta({...c,processWf:{cls:'MeaningfulProcessClass'}}).name,'MeaningfulProcessClass');
  assert.doesNotMatch(between('function doBuild(', '/* After a multi-project batch'),/projectName:.*IMP\.files\[0\]/);
});

test('full builder still produces two selectable branches for structured If/Else source',()=>{
  const activities=[{idx:0,parent:-1,tag:'Sequence',name:'Main'},
    {idx:1,parent:0,tag:'If',cond:'approved',name:'Approved?'},
    {idx:2,parent:1,branch:'then',tag:'InvokeWorkflowFile',name:'Accept request',target:'Accept.xaml',args:[]},
    {idx:3,parent:1,branch:'else',tag:'InvokeWorkflowFile',name:'Clarify request',target:'Clarify.xaml',args:[]}];
  const main=workflow('Main.xaml',activities);main.invokes=activities.slice(2);main.decisions=[activities[1]];
  const built=api.buildProjectModel({xaml:[main,workflow('Accept.xaml'),workflow('Clarify.xaml')],projectName:'Structured review'});
  const gateways=built.model.steps.filter(s=>s.kind==='gateway' && s.decision && !s.inline);
  assert.equal(gateways.length,1);assert.equal(built.model._importReport.routing.selectableDecisions,1);
  const branches=built.model.steps.filter(s=>s.dec?.length).map(s=>s.dec[0].br);
  assert.ok(branches.includes('then'));assert.ok(branches.includes('else'));
});

test('import review escapes supplied paths and error text',()=>{
  const report={appVersion:'test',workflowCount:1,entryWorkflow:'<img src=x>',processWorkflow:null,
    routing:{selectableDecisions:0,flowchartDecisions:1},pdd:null,errors:['<script>bad</script>'],warnings:[],
    missingWorkflows:['<script>missing</script>'],sourceFiles:['<svg onload=bad>']};
  const html=api.importReportHtml(report);
  assert.doesNotMatch(html,/<img|<script|<svg/);assert.match(html,/&lt;script&gt;/);
});

test('PDD selection is explicit, JSON precedence is preserved and parse errors remain available',async()=>{
  const parseAll=new Function('parseXaml','createPddConverters','convertPdd','parseBpmn','parseUiApp','parseConfigWorkbook','reviewImportDocuments',
    between('async function parseAll(', '/* stage 1b')+'\nreturn parseAll;')(
      ()=>{throw new Error('invalid XML');},()=>api.createPddConverters({json:obj=>api.parsePddJson({nume_proces:obj.name,tobe_sections:[{title:'Review',steps:[{descriere:'Review evidence'}]}]}),docx:async()=>pddFixture()}),api.convertPdd,()=>{},()=>{},api.parseConfigWorkbook,api.reviewImportDocuments);
  const file=(name,kind,text)=>({name,relPath:name,kind,blob:{text:async()=>text,arrayBuffer:async()=>new ArrayBuffer(0)}});
  const parsed=await parseAll([file('first.docx','pdd'),file('preferred.json','pdd','{"name":"Review"}'),file('Bad.xaml','xaml','bad')]);
  assert.equal(parsed.pdd.sourceFile,'preferred.json');assert.equal(parsed.errors.length,1);
  assert.match(parsed.importWarnings[0],/not merged/);
});

test('valid non-PDD JSON is skipped with a warning and cannot displace the Word PDD',async()=>{
  const parseAll=new Function('parseXaml','createPddConverters','convertPdd','parseBpmn','parseUiApp','parseConfigWorkbook','reviewImportDocuments',
    between('async function parseAll(', '/* stage 1b')+'\nreturn parseAll;')(
      ()=>{},()=>api.createPddConverters({json:api.parsePddJson,docx:async()=>pddFixture()}),api.convertPdd,()=>{},()=>{},api.parseConfigWorkbook,api.reviewImportDocuments);
  const parsed=await parseAll([{kind:'pdd',name:'design.docx',relPath:'design.docx',blob:{arrayBuffer:async()=>new ArrayBuffer(0)}},
    {kind:'pdd',name:'settings.json',relPath:'settings.json',blob:{text:async()=>' {"settings":{"theme":"dark"}}'}}]);
  assert.equal(parsed.pdd.sourceFile,'design.docx');assert.equal(parsed.errors.length,0);
  assert.match(parsed.importWarnings[0],/not a supported PDD export/);
});

test('review findings do not turn weak text matches or document order into business/runtime verdicts',()=>{
  assert.doesNotMatch(between('function addPddGaps(', 'function exceptionCoverage('),/business has never|because that is what actually happens/);
  assert.doesNotMatch(page,/business-ul nu a agreat niciodată/);
  assert.match(page,/not a verified execution trace/);
});
