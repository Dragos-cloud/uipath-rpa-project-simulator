// Synthetic documents/configuration only. Real projects remain outside the repo.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const s=page.indexOf(a),e=page.indexOf(b,s);assert.ok(s>=0&&e>s,a);return page.slice(s,e);};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Minimal DOM fixtures test package traversal, not XML syntax (checked in browser).
function el(tag,attrs={},children=[],text=''){
  return {localName:tag,children,attributes:Object.entries(attrs).map(([name,value])=>({name,localName:name.split(':').pop(),value})),
    get firstElementChild(){return children[0]||null;},get textContent(){return text+children.map(c=>c.textContent).join('');},
    getAttribute:k=>attrs[k]??null,getAttributeNS:(_,k)=>attrs['x:'+k]??null,
    getElementsByTagName(){return children.flatMap(c=>[c,...c.getElementsByTagName('*')]);}};
}
const doms=new Map();
class FixtureDOMParser{parseFromString(text){const root=doms.get(text);assert.ok(root,'registered fixture');return {querySelector:()=>null,getElementsByTagName:()=>[root,...root.getElementsByTagName('*')]};}}
const api=new Function('DOMParser','APP_VERSION','esc','T',between('const NS_X   =','/* =====================================================================\n   12. IMPORT UI')+
  between('async function parseAll(', '/* stage 1b')+between('const UIPATH_NOISE_DIRS =','function renderImpList(')+
  between('const CRC_T =','function pddDocx(')+
  '\nreturn {normalizeConfigRows,parseConfigXmlParts,parseConfigWorkbook,configReferences,matchImportedDocument,readXamlContext,reviewImportDocuments,setDocumentRole,selectPddDocument,projectContextSnapshot,projectContextHtml,projectContextPrompt,documentContentEvidence,parseAll,createPddConverters,parsePddBlocks,buildProjectModel,classify,zipStore,unzip};')(
    FixtureDOMParser,'test',esc,k=>k);
const pdd=()=>api.parsePddBlocks([{kind:'p',heading:1,text:'4. Future State'},
  {kind:'tbl',header:['Step','Description'],rows:[['Step','Description'],['1','Review evidence']]}]);
const doc=(file,body=pdd(),priority=10)=>({file,pdd:body?{...body,sourceFile:file}:null,priority,...(!body?{error:true}:{})});
const wf=(file,evidence={})=>({file,cls:'Main',activities:[],invokes:[],throws:[],logs:[],decisions:[],tryCatches:0,isFramework:false,
  projectEvidence:{configUses:[],fileUses:[],argumentBindings:[],...evidence}});
const review=(documents,xaml=[],configs=[])=>api.reviewImportDocuments({documents,xaml,configs,errors:[],importWarnings:[]});
const rows=(pairs)=>[{row:1,cells:[{ref:'A1',value:'Name'},{ref:'B1',value:'Value'}]},...pairs.map(([key,value,formula],i)=>({row:i+2,cells:[{ref:'A'+(i+2),value:key},{ref:'B'+(i+2),value,formula:!!formula}]}))];
const config=(pairs,files=[],sheet='Settings')=>({version:1,file:'Data/Config.xlsx',sheets:[sheet],warnings:[],...api.normalizeConfigRows(rows(pairs),sheet,'Data/Config.xlsx',files)});
const use=(key)=>({key,file:'Main.xaml',idx:1,activity:'InvokeWorkflowFile',property:'Arguments'});

test('supported steps plus design evidence suggest PDD; filename and narrative alone do not',()=>{
  assert.equal(api.documentContentEvidence(pdd(),'generic.docx').likely,true);
  const weak={kind:'pdd-docx',meta:{name:'Job description'},sections:[{steps:[{desc:'Template instruction'}]}]};
  assert.equal(api.documentContentEvidence(weak,'PDD_Template.docx').likely,false);
  assert.equal(api.documentContentEvidence({...pdd(),sections:[]},'PDD.docx').likely,false);
  assert.equal(review([doc('requirements.docx')]).pdd.sourceFile,'requirements.docx');
});

test('an operational template is excluded from requirements and an ambiguous duplicate is left for review',()=>{
  const files=['Data/Template.docx','Data/Test/Template.docx'];
  const c=config([['TemplatePath','C:\\original\\Data\\Template.docx']],files);
  const parsed=review(files.map(f=>doc(f,{kind:'pdd-docx',sections:[]})),[wf('Main.xaml',{configUses:[use('TemplatePath')]})],[c]);
  assert.deepEqual(parsed.documents.map(d=>d.role),['operational','review']);assert.equal(parsed.pdd,null);
  const ambiguous=review(files.map(f=>doc(f,{kind:'pdd-docx',sections:[]})),[wf('Main.xaml',{configUses:[use('TemplatePath')]})],[config([['TemplatePath','Template.docx']],files)]);
  assert.ok(ambiguous.documents.every(d=>d.role==='review'&&d.reasons.includes('ambiguousReference')));
  assert.doesNotMatch(JSON.stringify(api.projectContextSnapshot(parsed)),/C:|original/);
});

test('requirements-like content with operational evidence requires a decision, not silent exclusion',()=>{
  const parsed=review([doc('Data/PDD.docx')],[wf('Main.xaml',{fileUses:[{file:'Main.xaml',idx:2,activity:'CopyFile',property:'Path',documents:[{file:'Data/PDD.docx',match:'path'}]}]})]);
  assert.equal(parsed.documents[0].role,'review');assert.ok(parsed.documents[0].reasons.includes('conflictingEvidence'));assert.equal(parsed.pdd,null);
  api.setDocumentRole(parsed,'Data/PDD.docx','pdd');assert.equal(parsed.pdd.sourceFile,'Data/PDD.docx');
  assert.equal(parsed.documents[0].decision,'user-confirmed');
  api.selectPddDocument(parsed,'');assert.equal(parsed.pdd,null);
  api.setDocumentRole(parsed,'Data/PDD.docx','operational');assert.equal(parsed.pdd,null);
});

test('multiple PDDs have a stable default and user source choice; failed readers cannot be overridden as PDD',()=>{
  const parsed=review([doc('a.docx'),doc('b.json',{...pdd(),kind:'pdd-json'},20),doc('broken.docx',null)]);
  assert.equal(parsed.pdd.sourceFile,'b.json');assert.match(parsed.importWarnings[0],/not merged/);
  api.selectPddDocument(parsed,'a.docx');assert.equal(parsed.pdd.sourceFile,'a.docx');
  assert.match(parsed.importWarnings[0],/Selected a.docx/);
  assert.throws(()=>api.setDocumentRole(parsed,'broken.docx','pdd'),/cannot/);
  assert.throws(()=>api.selectPddDocument(parsed,'broken.docx'),/marked as PDD/);
});

test('safe config values retain zero/false while secrets, formulas, paths, descriptions and arbitrary values do not escape',()=>{
  const c=config([['Password','SECRET_CANARY'],['ApiToken','TOKEN_CANARY'],['RecruiterEmail','EMAIL_CANARY'],
    ['MaxRetryNumber',0],['TestMode',false],['PortalUrl','https://example.invalid/private?token=QUERY_CANARY#fragment'],
    ['OtherSetting','VALUE_CANARY'],['InputFolder','C:\\PRIVATE_CANARY\\data'],['Calculated','FORMULA_CANARY',true],
    ['BadUrl','https://user:PWD_CANARY@example.invalid/'],['Empty','']]);
  assert.equal(c.withheld,3);assert.equal(c.entries.find(e=>e.key==='MaxRetryNumber').displayValue,'0');
  assert.equal(c.entries.find(e=>e.key==='TestMode').displayValue,'false');
  assert.equal(c.entries.find(e=>e.key==='PortalUrl').displayValue,'https://example.invalid');
  assert.equal(c.entries.find(e=>e.key==='Calculated').status,'formula');
  const parsed=review([],[],[c]);parsed.sourceReviewCompleted=true;
  const ctx=api.projectContextSnapshot(parsed);const output=JSON.stringify(ctx)+api.projectContextHtml(ctx)+api.projectContextPrompt(ctx);
  assert.doesNotMatch(output,/CANARY|Password|ApiToken|RecruiterEmail|\/private|fragment/);
  assert.match(output,/not PDD requirements/);assert.equal(ctx.reviewed,true);
  const built=api.buildProjectModel({xaml:[wf('Main.xaml')],pdd:null,projectContext:ctx});
  assert.equal(built.model._pdd,undefined);assert.doesNotMatch(JSON.stringify(built.model),/CANARY/);
  assert.deepEqual(JSON.parse(JSON.stringify(built.model))._projectContext,ctx);
});

test('assets are runtime references, formulas are not evaluated and reordered EN/RO headers work',()=>{
  const asset=config([['QueueAsset','DO_NOT_STORE'],['TestMode','true']],[],'Assets');
  assert.ok(asset.entries.every(e=>e.status==='runtime'&&!e.displayValue));
  const parsed=api.normalizeConfigRows([{row:4,cells:[{ref:'C4',value:'Valoare'},{ref:'E4',value:'Nume'}]},
    {row:5,cells:[{ref:'E5',value:'MaxRetryNumber'},{ref:'C5',value:'2'}]}],'Constants','Settings.xlsx');
  assert.equal(parsed.entries[0].source.cell,'C5');assert.equal(parsed.entries[0].displayValue,'2');
  assert.equal(api.normalizeConfigRows(rows([['Limit',2]]).slice(1),'Settings','Config.xlsx').recognized,false);
  assert.throws(()=>api.normalizeConfigRows(Array(2001).fill({}),'Settings','Config.xlsx'),/row limit/);
});

test('file matching prefers a specific relative suffix and never fetches an original absolute location',()=>{
  const files=['Project/Data/Template.docx','Project/Data/Test/Template.docx'];
  assert.deepEqual(api.matchImportedDocument('C:\\elsewhere\\Data\\Template.docx',files),[{file:files[0],match:'suffix'}]);
  assert.deepEqual(api.matchImportedDocument('Data/Template.docx',files),[{file:files[0],match:'path'}]);
  assert.ok(api.matchImportedDocument('Template.docx',files).every(r=>r.match==='ambiguous'));
  assert.deepEqual(api.matchImportedDocument('C:\\not-imported.docx',files),[]);
});

test('config symbols and one-hop arguments link evidence without evaluating expressions',()=>{
  const caller=wf('Main.xaml'),node={idx:1,tag:'InvokeWorkflowFile',target:'Child.xaml'};
  const input=el('InArgument',{'x:Key':'templateArg'},[],'[in_Config("TemplatePath").ToString]');
  api.readXamlContext(el('InvokeWorkflowFile',{},[el('InvokeWorkflowFile.Arguments',{},[input])]),node,caller,[],{});
  assert.equal(caller.projectEvidence.argumentBindings[0].key,'TemplatePath');
  const child=wf('Child.xaml');api.readXamlContext(el('CopyFile',{Path:'[templateArg]'}),{idx:4,tag:'CopyFile'},child,['Data/Template.docx'],{});
  const parsed=review([doc('Data/Template.docx',{kind:'pdd-docx',sections:[]})],[caller,child],[config([['TemplatePath','Data/Template.docx']],['Data/Template.docx'])]);
  assert.equal(parsed.documents[0].role,'operational');assert.equal(parsed.documents[0].references[0].operations[0].activity,'CopyFile');
  assert.deepEqual(api.configReferences('[Config["X"] + in_Config("Y") + Config(variable)]'),['X','Y']);
});

test('literal/variable document usage is retained but selectors, code and sensitive attributes are ignored',()=>{
  const w=wf('Copy.xaml'),node={idx:2,tag:'CopyFile'};
  api.readXamlContext(el('CopyFile',{Path:'[templateFile]',Password:'[Config("Hidden")]',Selector:'[Config("Hidden2")]',Code:'[Config("Hidden3")]'}),node,w,['Data/Template.docx'],{templateFile:'Data/Template.docx'});
  assert.deepEqual(w.projectEvidence.fileUses[0].documents,[{file:'Data/Template.docx',match:'path'}]);
  assert.equal(w.projectEvidence.configUses.length,0);
});

test('duplicate settings keep references ambiguous and unresolved code keys do not imply missing requirements',()=>{
  const files=['Template.docx'],c=config([['TemplatePath','Template.docx'],['TemplatePath','Template.docx']],files);
  const parsed=review([doc(files[0],{kind:'pdd-docx',sections:[]})],[wf('Main.xaml',{configUses:[use('TemplatePath'),use('OtherKey'),use('Password')]})],[c]);
  assert.equal(parsed.documents[0].role,'review');assert.deepEqual(api.projectContextSnapshot(parsed).unresolvedSettings,['OtherKey']);
  assert.equal(api.projectContextHtml(undefined),'');assert.equal(api.projectContextPrompt(undefined),'');
});

function workbookFixture(target='worksheets/sheet1.xml',external=false){
  doms.set('workbook',el('workbook',{},[el('sheets',{},[el('sheet',{name:'Settings','r:id':'r1'})])]));
  doms.set('rels',el('Relationships',{},[el('Relationship',{Id:'r1',Target:target,...(external?{TargetMode:'External'}:{})})]));
  doms.set('strings',el('sst',{},['Name','Value','TemplatePath','Template.docx'].map(v=>el('si',{},[el('t',{},[],v)]))));
  const cell=(ref,v,type='s',formula=false)=>el('c',{r:ref,t:type},[...(formula?[el('f',{},[],'SECRET_FORMULA')]:[]),el('v',{},[],v)]);
  doms.set('sheet',el('worksheet',{},[el('sheetData',{},[
    el('row',{r:'1'},[cell('A1','0'),cell('B1','1')]),el('row',{r:'2'},[cell('A2','2'),cell('B2','3')]),
    el('row',{r:'3'},[el('c',{r:'A3',t:'inlineStr'},[el('is',{},[el('t',{},[],'Calculated')])]),cell('B3','CACHED_SECRET','str',true)])])]));
  return {'xl/workbook.xml':'workbook','xl/_rels/workbook.xml.rels':'rels','xl/sharedStrings.xml':'strings','xl/worksheets/sheet1.xml':'sheet'};
}
test('OOXML reader handles shared/inline strings and omits formula text and cached values',()=>{
  const c=api.parseConfigXmlParts(workbookFixture(),'Config.xlsx',['Data/Template.docx']);
  assert.equal(c.entries[0].source.cell,'B2');assert.equal(c.entries[0].documentRefs[0].file,'Data/Template.docx');
  assert.equal(c.entries[1].status,'formula');assert.doesNotMatch(JSON.stringify(c),/SECRET/);
});
test('OOXML external/unsafe references and entity declarations are rejected without fetching',()=>{
  for(const [target,external] of [['https://example.invalid/sheet.xml',true],['../../secret.xml',false],['file:secret.xml',false]]){
    const c=api.parseConfigXmlParts(workbookFixture(target,external),'Config.xlsx');assert.equal(c.entries.length,0);assert.ok(c.warnings.includes('externalSheet'));
  }
  assert.throws(()=>api.parseConfigXmlParts({'xl/workbook.xml':'<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///private">]>'},'Config.xlsx'),/entities/);
});
test('ZIP reader enforces count, entry and total limits, including stored XML size',async()=>{
  const z=api.zipStore([{name:'a.xml',data:'12345'},{name:'b.xml',data:'67890'}]);
  assert.equal((await api.unzip(z.buffer,{entries:2,entryBytes:5,totalBytes:10}))['a.xml'],'12345');
  await assert.rejects(api.unzip(z.buffer,{entries:1}),/entry limit/);
  await assert.rejects(api.unzip(z.buffer,{entryBytes:4}),/size limit/);
  await assert.rejects(api.unzip(z.buffer,{totalBytes:9}),/size limit/);
  const dishonest=api.zipStore([{name:'a.xml',data:'12345'}]),dv=new DataView(dishonest.buffer);
  dv.setUint32(22,0,true);dv.setUint32(35+5+24,0,true); // falsified uncompressed lengths
  await assert.rejects(api.unzip(dishonest.buffer,{entryBytes:4,totalBytes:100}),/size limit/);
  await assert.rejects(api.parseConfigWorkbook(new ArrayBuffer(8*1024*1024+1),'Config.xlsx'),/8 MB/);
});
test('deflate output is bounded even when its declared size is false',async()=>{
  const compressed=require('node:zlib').deflateRawSync('x'.repeat(10000));
  const z=api.zipStore([{name:'a.xml',data:compressed}]),dv=new DataView(z.buffer),central=35+compressed.length;
  dv.setUint16(8,8,true);dv.setUint32(22,0,true);dv.setUint16(central+10,8,true);dv.setUint32(central+24,0,true);
  await assert.rejects(api.unzip(z.buffer,{entryBytes:100,totalBytes:200}),/size limit/);
});
test('parseAll combines config and document evidence regardless of file order; config failures remain visible',async()=>{
  const file=(name,kind)=>({name,relPath:name,kind,blob:{arrayBuffer:async()=>new ArrayBuffer(0)}});
  const converters=api.createPddConverters({json:()=>{},docx:async()=>({kind:'pdd-docx',sections:[]})});
  const parsed=await api.parseAll([file('Config.xlsx','config'),file('Template.docx','pdd')],converters,
    async(_,file,docs)=>config([['TemplatePath','Template.docx']],docs));
  assert.equal(parsed.documents[0].role,'review'); // unused setting is not proof of bot use
  assert.equal(parsed.configs[0].entries[0].documentRefs[0].file,'Template.docx');
  const bad=await api.parseAll([file('Config.xlsx','config'),file('Template.docx','pdd')],converters,async()=>{throw new Error('Invalid configuration workbook XML.');});
  assert.match(bad.errors[0],/Config.xlsx/);assert.equal(bad.documents.length,1);
});
test('file classification accepts named config workbooks, not arbitrary data or macros',()=>{
  for(const f of ['Data/Config.xlsx','Settings.xlsx','Config-dev.xlsx']) assert.equal(api.classify(f),'config');
  for(const f of ['Data/Orders.xlsx','Config.xlsm','Config.xls','.local/Config.xlsx']) assert.equal(api.classify(f),'skip');
});
test('context HTML escapes imported text and all new labels have EN/RO parity',()=>{
  const ctx=api.projectContextSnapshot(review([doc('<img>.docx')]));
  assert.doesNotMatch(api.projectContextHtml(ctx),/<img>/);assert.match(api.projectContextHtml(ctx),/&lt;img&gt;/);
  const keys=[...page.slice(page.indexOf("'tb.process':'Process'")).matchAll(/'(ctx\.[^']+)'\s*:/g)].map(m=>m[1]);assert.ok(keys.length>70);
  for(const key of new Set(keys)) assert.equal(keys.filter(k=>k===key).length,2,key);
  assert.match(between('async function onImpBuild(', '13. GAP REPORT'),/renderSourceReview\(p\)/);
  assert.match(between('async function processQueue(', 'function renderSourceReview('),/renderSourceReview\(p\)/);
});
