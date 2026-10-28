// No npm dependencies: exercise the exact normalisation code shipped in index.html.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const between = (a,b) => {
  const start=page.indexOf(a), end=page.indexOf(b,start);
  assert.ok(start>=0 && end>start, `Source boundaries: ${a}`);
  return page.slice(start,end);
};
const contract = between('/* --- 10.2a Canonical PDD contract', 'function parsePddJson(');
const parse = new Function(contract+between('function parsePddBlocks(', 'const pddSections =')+'\nreturn parsePddBlocks;')();
const context = new Function(between('function pddPromptContext(', 'function pddReadSummary(')+'\nreturn pddPromptContext;')();
const heading = (text,level=2) => ({kind:'p',heading:level,text,style:'Heading'+level});
const para = text => ({kind:'p',heading:0,text,style:'Normal'});
const table = (header,rows) => ({kind:'tbl',header,rows:[header,...rows]});
const legacy = ro => [heading(ro?'3.2 Proces TO-BE':'3.2 TO-BE process',1),
  heading('3.2.1 '+(ro?'Verificare comanda':'Validate order')),
  table(ro?['Pas','Descriere','Detalii']:['Step','Description','Details'],[['1','Validate customer','Read approved reference']]),
  heading(ro?'3.4 Exceptii functionale':'3.4 Business exceptions',1),
  table(ro?['Denumire exceptie','Pas','Parametri','Actiune']:['Exception','Step','Parameters','Action'],[['Invalid order','1','Missing account','Request clarification']]),
  heading(ro?'3.5 Exceptii de sistem':'3.5 System exceptions',1),
  table(ro?['Denumire exceptie','Pas','Parametri','Actiune']:['Exception','Step','Parameters','Action'],[['Unavailable reference','1','Workbook unavailable','Recover source']]),
  heading('Human review',1),table(ro?['Actiune','Descriere','Tip interventie','Rol','Drepturi','Limitari']:['Action','Description','Intervention type','Role','Rights','Limits'],
    [['Review order','Confirm accepted values','Human','Agent','Review only','No master writes']])];

for(const ro of [false,true]) test(`legacy ${ro?'Romanian':'English'} template remains readable`,()=>{
  const p=parse(legacy(ro));
  assert.equal(p.sections.length,1);
  assert.equal(p.sections[0].ref,'3.2.1');
  assert.equal(p.sections[0].steps[0].detail,'Read approved reference');
  assert.deepEqual(p.exceptions.map(e=>e.cls),['business','system']);
  assert.equal(p.exceptions[0].action,'Request clarification');
  assert.equal(p.interventions[0].role,'Agent');
  assert.equal(p.interventions[0].rights,'Review only');
  assert.equal(p.interventions[0].limits,'No master writes');
  assert.equal(p.interventions[0].documentedOnly,undefined);
});

test('legacy and element tables resolve reordered columns by meaning',()=>{
  const p=parse([heading('4. Future State',1), heading('4.2 Checks'),
    table(['Details','Description','Step'],[['Check against evidence','Review record','7']]),
    heading('4.3 Agent'),table(['Description','Element type','#','BPMN element'],[['Preserve the decision','Gateway','2','Accepted?']])]);
  assert.equal(p.sections[0].steps[0].ref,'7');
  assert.equal(p.sections[0].steps[0].desc,'Review record');
  assert.equal(p.sections[0].steps[0].detail,'Check against evidence');
  assert.equal(p.sections[1].steps[0].desc,'Accepted?');
  assert.equal(p.sections[1].steps[0].detail,'Preserve the decision');
  assert.equal(p.sections[1].steps[0].kind,'gateway');
});

test('Current/Future State and AS-IS/TO-BE scopes exclude current-state steps',()=>{
  for(const [current,future] of [['3. Current State','4. Future State'],['3. AS-IS','4. TO-BE'],['3. Starea actuala','4. Starea viitoare']]){
    const p=parse([heading(current,1),heading('3.2 Current flow'),table(['Step','Description'],[['1','Old manual task']]),
      heading(future,1),heading('4.2 Target flow'),table(['Step','Description'],[['1','Target task']])]);
    assert.deepEqual(p.sections.map(s=>s.steps[0].desc),['Target task']);
    assert.equal(p.diagnostics.tables[0].kind,'current-steps');
  }
});

function modern(){
  const blocks=[para('Synthetic Order Review'),heading('Document Control',1),
    table(['Field','Value'],[['Process name','Synthetic Order Review'],['Process identifier','order-review']]),
    heading('3. Current State',1),table(['#','Current step'],[['1','Manual capture']]),
    heading('4. Future State',1),heading('4.2 Target Flow'),
    table(['#','BPMN element group','Participant / lane','Route or outcome'],[['1','Summary','Agent','Review']]),
    heading('4.2.1 Future Work Details')];
  for(const [name,count] of [['Automation',10],['Order Processing Agent',13],['Team Lead',9]]){
    blocks.push(heading(name,3),para('Table 9: '+name),
      table(['#','BPMN element','Element type','Description'],Array.from({length:count},(_,i)=>
        [String(i+1),name+' step '+(i+1),i===0?'Start event':i===2?'Gateway':'Activity','Evidence for '+name+' '+(i+1)])));
  }
  blocks.push(heading('5. Business Rules',1),table(['Rule ID','Description'],Array.from({length:14},(_,i)=>['BR-'+String(i+1).padStart(3,'0'),'Require evidence '+i])),
    heading('8. Exceptions and Error Handling',1),heading('8.1 Known Exceptions'),
    table(['Exception','Trigger','AS-IS Handling','TO-BE Handling'],Array.from({length:9},(_,i)=>['Case '+i,'Trigger '+i,'Old action '+i,'Target action '+i])),
    heading('8.2 Exception Data State Transitions'),table(['Exception','Affected record','State on entry','State on resolution','State on terminal failure'],
      Array.from({length:6},(_,i)=>['Case '+i,'Review record','Flagged','Revalidated','Held'])),
    heading('8.3 Human review tasks'),table(['Escalation point','Trigger and fields surfaced','Available actions -> resulting state','Task SLA / assignee'],
      Array.from({length:5},(_,i)=>['Task '+i,'Source evidence','Accept or revalidate','Agent'])),
    heading('13. Next Steps',1),table(['#','Action item'],[['1','Confirm deployment']]),
    table(['Test case','Scenario type (positive/negative/exception)','Description'],[['T1','Exception','Not an inventory']]));
  return blocks;
}

test('lane-oriented PDD keeps typed groups and excludes summaries and next steps',()=>{
  const p=parse(modern());
  assert.equal(p.meta.name,'Synthetic Order Review');
  assert.equal(p.meta.code,'order-review');
  assert.deepEqual(p.sections.map(s=>s.steps.length),[10,13,9]);
  assert.equal(p.sections[0].steps[0].kind,'event');
  assert.equal(p.sections[0].steps[2].kind,'gateway');
  assert.equal(p.sections[0].steps[1].detail,'Evidence for Automation 2');
  assert.equal(p.mappingSections.length,26);
  assert.ok(p.mappingSections.every(s=>s.steps[0].kind==='activity'));
  assert.equal(p.rules.length,14);
  assert.equal(p.exceptions.length,9);
  assert.equal(p.exceptionStates.length,6);
  assert.equal(p.interventions.length,5);
  assert.ok(p.interventions.every(i=>i.documentedOnly));
  assert.ok(p.sections.every(s=>s.source.heading.includes('Future State')));
});

test('exception state rows are not extra system exceptions; target action wins',()=>{
  const p=parse(modern());
  assert.ok(p.exceptions.every(e=>e.cls==='unknown'));
  assert.equal(p.exceptions[0].action,'Target action 0');
  assert.equal(p.exceptions[0].asis,'Old action 0');
  assert.equal(p.exceptions[0].params,'');
  assert.equal(p.exceptionStates[0].exceptionId,p.exceptions[0].id);
});

test('reordered exception columns and explicit row classifications',()=>{
  const p=parse([heading('Known Exceptions'),table(['TO-BE Handling','Class','Trigger','Exception','AS-IS Handling'],
    [['Reconcile','system','Partial save','OMS failure','Manual retry'],['Clarify','business','Incomplete','Missing data','Call customer']])]);
  assert.deepEqual(p.exceptions.map(e=>e.cls),['system','business']);
  assert.equal(p.exceptions[0].action,'Reconcile');
  assert.equal(p.exceptions[0].pas,'Partial save');
});

test('repeated canonical definitions merge references, not unrelated cases',()=>{
  const t=table(['Exception','Action'],[['Duplicate order','Review source']]);
  const p=parse([heading('Known Exceptions'),t,t,table(['Exception','State on entry','State on resolution'],[['A different case','Open','Closed']])]);
  assert.equal(p.exceptions.length,1);
  assert.equal(p.exceptions[0].references.length,1);
  assert.equal(p.exceptionStates[0].exceptionId,null);
});

test('multiple tables under one heading retain distinct references and row provenance',()=>{
  const p=parse([heading('4.2 Work'),table(['Step','Description'],[['1','First']]),table(['Step','Description'],[['1','Second']])]);
  assert.equal(new Set(p.sections.map(s=>s.ref)).size,2);
  assert.equal(p.sections[1].steps[0].source.table,2);
  assert.equal(p.sections[1].steps[0].source.row,2);
});

test('unknown tables and empty extraction are visible diagnostics',()=>{
  const p=parse([heading('Requirements'),table(['Something','Else'],[['a','b']])]);
  assert.equal(p._tables,1);
  assert.equal(p.diagnostics.tables[0].kind,'unrecognised');
  assert.match(p.diagnostics.warnings[0],/No target process step tables/);
});

test('normalisation does not modify source blocks',()=>{
  const b=modern(), before=JSON.stringify(b);
  parse(b);
  assert.equal(JSON.stringify(b),before);
});

test('Romanian general information is metadata, not numbered process work',()=>{
  const p=parse([para('Proiectul:'),heading('1. INTRODUCERE',1),heading('1.4 Informații generale'),
    table(['Nr.','Descriere','Detalii'],[['1','Denumirea procesului','Synthetic document review'],
      ['2','Când anume este programat procesul să ruleze','Manual, after approval']])]);
  assert.equal(p.sections.length,0);assert.equal(p.meta.name,'Synthetic document review');
  assert.equal(p.ops.trigger,'Manual, after approval');assert.equal(p.diagnostics.tables[0].kind,'metadata');
});

test('inflected Romanian action headers retain target rows and skip merged banners/repeated headings',()=>{
  const header=['Nr. pas','Descrierea acțiunii','Detalii'];
  const p=parse([heading('2. ANALIZA AS-IS',1),heading('2.2 Pașii procesului'),
    table(header,[['1. Old process group'],['1.1','Old manual step','Legacy']]),
    heading('3. PROCES TO-BE',1),heading('3.2 Pașii detaliați'),heading('3.2.1 Prepare input',3),
    table(header,[['1. Prepare input'],['1.1','Check input folder','Preserve the source reference'],header,['1.2','Read source','Inspect values']])]);
  assert.equal(p.sections.length,1);assert.equal(p.sections[0].ref,'3.2.1');
  assert.deepEqual(p.sections[0].steps.map(s=>s.desc),['Check input folder','Read source']);
  assert.equal(p.sections[0].steps[0].source.row,3);
  assert.equal(p.sections[0].steps[0].detail,'Preserve the source reference');
  assert.equal(p.diagnostics.tables[0].kind,'current-steps');
});

test('Romanian exception and intervention aliases preserve actions, references, owners and rights',()=>{
  const p=parse([heading('3.4 Excepții de business'),
    table(['Denumirea excepției','Nr. pas la care apare','Parametri','Acțiune de întreprins'],
      [['Missing input','3.2.1/1.1','No files','Record issue and request review']]),
    heading('3.3 Puncte de intervenție umană'),
    table(['Acțiune din proces','Descriere acțiune','Tip intervenție','Rol utilizator','Drepturi necesare?','Limitări'],
      [['Prepare files','Review before import','Manual','Reviewer','Read-only','No changes']])]);
  assert.equal(p.exceptions[0].pas,'3.2.1/1.1');assert.equal(p.exceptions[0].action,'Record issue and request review');
  assert.equal(p.interventions[0].action,'Prepare files');assert.equal(p.interventions[0].role,'Reviewer');
  assert.equal(p.interventions[0].rights,'Read-only');
});

test('AI context includes bounded PDD requirements with evidence warning',()=>{
  const p=parse(modern()), text=context(p);
  assert.match(text,/BR-001/);
  assert.match(text,/Target action 0/);
  assert.match(text,/not proof they are implemented/);
  assert.match(text,/table \d+, row \d+/);
  assert.match(context(p,150),/PDD context truncated/);
  assert.equal(context(null),'');
});

test('Main entry mapping retains original call indices; REFramework keys are unchanged',()=>{
  const fn=new Function('norm','stripExt','invokeName',between('function projectMappingSteps(', 'function attachPddSection(')+'\nreturn projectMappingSteps;')(
    s=>s.toLowerCase(),s=>s.replace(/\.xaml$/i,''),inv=>inv.name||inv.target);
  assert.deepEqual(fn({hasFramework:true,spine:[{name:'Validate'}]}).map(s=>s.key),['b0']);
  const mapped=fn({hasFramework:false,mainWf:{invokes:[{target:''},{target:'Validate.xaml',name:'Validate'}]},wfByKey:{}});
  assert.equal(mapped[0].key,'m1');
  assert.equal(mapped[0].name,'Validate');
});

test('unknown exception classes can match evidence without inventing a type',()=>{
  const matches=new Function(between('const exceptionClassMatches =', 'function pddPromptContext(')+'\nreturn exceptionClassMatches;')();
  assert.equal(matches('unknown','system'),true);
  assert.equal(matches('unknown','business'),true);
  assert.equal(matches('business','system'),false);
});

test('embedded application JavaScript compiles',()=>{
  const script=page.split('<script>')[1].split('</script>')[0];
  assert.doesNotThrow(()=>new Function(script));
});

test('legacy PDD JSON contract stays unchanged',()=>{
  const parseJson=new Function(contract+between('function parsePddJson(', '/* --- 10.3 PDD as DOCX')+'\nreturn parsePddJson;')();
  const p=parseJson({nume_proces:'Legacy JSON',tobe_sections:[{title:'Validate',steps:[{descriere:'Check account',detalii:'Use reference'}]}],
    biz_exceptii:[{denumire:'Missing account',pas:'1',actiune:'Clarify'}]});
  assert.equal(p.meta.name,'Legacy JSON');
  assert.equal(p.sections[0].steps[0].detail,'Use reference');
  assert.equal(p.exceptions[0].cls,'business');
  assert.equal(p.exceptions[0].action,'Clarify');
});

test('unrelated JSON cannot silently replace a valid Word PDD',()=>{
  const parseJson=new Function(contract+between('function parsePddJson(', '/* --- 10.3 PDD as DOCX')+'\nreturn parsePddJson;')();
  for(const input of [{settings:{theme:'dark'}},{meta:{schema:1},steps:[],exceptions:[]},null,[]])
    assert.throws(()=>parseJson(input),/not a supported PDD export/);
});

test('PDD details and old sessions survive JSON serialisation without schema change',()=>{
  const serialise=new Function('SCHEMA_VERSION','APP_VERSION',between('function serializeModel(', '/* Returns { model, from, notes }')+'\nreturn serializeModel;')(1,'0.60');
  const original={meta:{name:'Imported'},steps:[],exceptions:[],_pdd:parse(modern())};
  const copy=JSON.parse(serialise(original));
  assert.equal(copy._pdd.rules.length,14);
  assert.equal(copy._pdd.sections[0].steps[0].source.row,2);
  assert.equal(copy.meta.schema,1);
  assert.equal(original.meta.schema,undefined);
  assert.equal(JSON.parse(serialise({meta:{name:'Older session'},steps:[],exceptions:[]}))._pdd,undefined);
});

test('confirmed Main mappings replace the unconfirmed-detail placeholder',()=>{
  const attach=new Function(between('function attachPddSection(', '/* --- 10.4 BPMN')+'\nreturn attachPddSection;')();
  const step={detail:'Invoked from Main.xaml. No matching PDD section was confirmed.',source:{xaml:'Main.xaml'}};
  attach(step,{ref:'4.2.1',title:'Validate',steps:[{desc:'Compare fields',detail:'Read-only reference'}]},0);
  assert.equal(step.detail,'Invoked from Main.xaml.');
  assert.equal(step.source.pdd,'4.2.1 Validate');
  assert.equal(step.pddDetail,'Compare fields — Read-only reference');
});

test('PDD readout escapes imported document text',()=>{
  const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const summary=new Function('esc','T',contract+between('function pddReadSummary(', 'function projectMappingSteps(')+'\nreturn pddReadSummary;')(escape,key=>key);
  const p=parse([para('<img src=x onerror=alert(1)>'),heading('4.2 Work'),table(['Step','Description'],[['1','<script>bad()</script>']])]);
  const html=summary(p);
  assert.ok(!html.includes('<img src='));
  assert.ok(!html.includes('<script>'));
  assert.match(html,/&lt;script&gt;/);
});
