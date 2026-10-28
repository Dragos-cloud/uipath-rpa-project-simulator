const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{
  const start=page.indexOf(a), end=page.indexOf(b,start);
  assert.ok(start>=0 && end>start,a);
  return page.slice(start,end);
};
const api=new Function(between('function parseScenarioCondition(', '/* Scenario details UI.')+
  '\nreturn {parseScenarioCondition,describeScenarioCondition,scenarioSource,enumerateScenarioPaths,describeScenarioPath,scenarioAssignmentKey};')();
const {parseScenarioCondition:parse,describeScenarioCondition:describe,scenarioSource,enumerateScenarioPaths:paths,describeScenarioPath:view}=api;
const gateway=(id,condition,dec=[])=>({id:'g'+id,decId:id,kind:'gateway',decision:true,condition,name:condition+'?',dec,source:{xaml:'Main.xaml'}});
const work=(id,name,dec)=>({id,name,xamlTarget:id+'.xaml',dec,actor:'bot'});
const branch=(id,br)=>({id,br});
const duplicate='String.Equals(duplicateResult, "Duplicate", StringComparison.OrdinalIgnoreCase) OrElse String.Equals(duplicateResult, "Withdrawn", StringComparison.OrdinalIgnoreCase)';
const accepted='validationAccepted AndAlso String.Equals(reviewNextRoute, "OMS_Evidence", StringComparison.OrdinalIgnoreCase)';

test('false branch of Not sourceUsable is positive; true branch stays negative',()=>{
  assert.equal(describe('Not sourceUsable',false).text,'Source is usable');
  assert.equal(describe('Not sourceUsable',true).text,'Source is not usable');
  assert.equal(describe('Not Not sourceUsable',true).text,'Source is usable');
});

test('OR false requires both alternatives to be false, without losing Withdrawn',()=>{
  const d=describe(duplicate,false);
  assert.equal(d.supported,true);
  assert.equal(d.text,'Duplicate check result is not “Duplicate” and duplicate check result is not “Withdrawn”');
  assert.match(describe(duplicate,true).text,/“Duplicate” or .*“Withdrawn”/);
});

test('AND false is an OR of negations, not an AND',()=>{
  assert.equal(describe(accepted,false).text,'Validation is not accepted or next review step is not “OMS_Evidence”');
  assert.equal(describe(accepted,true).text,'Validation is accepted and next review step is “OMS_Evidence”');
});

// Evaluate the parsed AST only in tests against synthetic booleans. The app
// itself never executes imported expressions or evaluates runtime data.
function evaluate(n,vars){
  if(n.type==='id') return vars[n.value];
  if(n.type==='literal') return n.value;
  if(n.type==='not') return !evaluate(n.child,vars);
  if(n.type==='and') return evaluate(n.left,vars)&&evaluate(n.right,vars);
  if(n.type==='or') return evaluate(n.left,vars)||evaluate(n.right,vars);
  if(n.type==='eq') return evaluate(n.left,vars)===evaluate(n.right,vars);
  if(n.type==='ne') return evaluate(n.left,vars)!==evaluate(n.right,vars);
  throw Error('Unexpected AST');
}
test('Boolean precedence and nested parentheses match truth tables',()=>{
  const examples=[
    ['Not a AndAlso b OrElse c',v=>(!v.a&&v.b)||v.c],
    ['Not (a OrElse b) AndAlso c',v=>!(v.a||v.b)&&v.c],
    ['a && (!b || c)',v=>v.a&&(!v.b||v.c)],
    ['a = True AndAlso b <> False',v=>v.a&&v.b],
    ['Not a = b',v=>!(v.a===v.b)]
  ];
  for(const [text,expected] of examples){
    const ast=parse(text); assert.ok(ast,text);
    for(let mask=0;mask<8;mask++){
      const vars={a:!!(mask&1),b:!!(mask&2),c:!!(mask&4)};
      assert.equal(evaluate(ast,vars),expected(vars),text+' '+mask);
    }
  }
});

test('nested negation keeps explicit grouping in business wording',()=>{
  assert.equal(describe('Not (sourceUsable OrElse validationAccepted) AndAlso omsReconciled',false).text,
    '(source is usable or validation is accepted) or OMS is not reconciled');
  assert.equal(describe('ready = False',false).text,'Ready is true');
  assert.equal(describe('False <> ready',true).text,'Ready is true');
});

test('quoted literal contents, doubled quotes and significant spaces are preserved',()=>{
  assert.equal(parse('status = "A  B"').right.value,'A  B');
  assert.equal(describe('status = "A  B"',true).text,'Status is “A  B”');
  assert.equal(parse('status = "say ""Yes"""').right.value,'say "Yes"');
  assert.equal(parse('status = "Not OrElse AndAlso"').right.value,'Not OrElse AndAlso');
});

test('unknown syntax fails closed instead of dropping expression fragments',()=>{
  for(const source of ['items.Count > 0','CheckOrder()','a AndAlso','a = b = c','a XOR b','a + b','a || unknown(value)',
    'String.Equals(status,"Open",UnknownComparer)','status = "unclosed','a…','a; alert(1)','status = "C:\\Temp"']){
    assert.equal(describe(source,true).supported,false,source);
  }
});

test('expression recursion and token budgets are bounded',()=>{
  assert.equal(parse('Not '.repeat(100)+'ready'),null);
  assert.equal(parse('('.repeat(100)+'ready'+')'.repeat(100)),null);
  assert.equal(parse('a'.repeat(50001)),null);
  assert.equal(describe(Array(500).fill('a').join(' AndAlso '),true).supported,false);
});

test('full conditions survive clean-label truncation and decision extraction',()=>{
  const cleanApi=new Function(between('function fullCond(', 'function whenOf(')+'\nreturn {fullCond,cleanCond};')();
  assert.equal(cleanApi.fullCond('[status = "A  B"]'),'status = "A  B"');
  assert.ok(cleanApi.cleanCond(duplicate).includes('…'));
  assert.ok(cleanApi.fullCond(duplicate).endsWith('OrdinalIgnoreCase)'));
  const decOf=new Function('branchStats','fullCond',between('function decOf(', '/* A real project')+'\nreturn decOf;')(
    ()=>({thr:0,inv:1,acts:[]}),cleanApi.fullCond);
  const parent={idx:0,parent:-1,tag:'If',cond:duplicate,name:'Check duplicate or revision'};
  const child={idx:1,parent:0,branch:'else'};
  const d=decOf({file:'Main.xaml',activities:[parent,child]},child,'main')[0];
  assert.equal(d.cond,duplicate);
  assert.equal(d.label,'Check duplicate or revision');
});

test('author question and AI label cannot flip the source-condition polarity',()=>{
  const g={...gateway('a','Not sourceUsable'),conditionLabel:'Is the source usable?',name:'Is the source usable?',plain:'Is the source usable?'};
  const v=view([g],{a:'then'});
  assert.equal(v.clauses[0].text,'Source is not usable');
  assert.equal(v.clauses[0].condition,'Not sourceUsable');
  assert.equal(v.clauses[0].truth,true);
});

test('older truncated saved sessions warn and never fabricate the missing condition',()=>{
  const old={name:'AI label?',plain:'AI label?',plainOrig:'String.Equals(status, "…?'};
  const src=scenarioSource(old);
  assert.equal(src.complete,false);
  assert.equal(describe(src.condition,true).supported,false);
});

function fixture(){
  const root=gateway('a','Not sourceUsable');
  const dupe=gateway('b',duplicate,[branch('a','else')]);
  const accept=gateway('c',accepted,[branch('a','else'),branch('b','else')]);
  const reconcile=gateway('d','omsReconciled',[branch('a','else'),branch('b','else'),branch('c','then')]);
  return [root,work('fallback','PDD Step 12 — Record fallback closure',[branch('a','then')]),dupe,
    work('duplicate','Record duplicate/withdrawn',[branch('a','else'),branch('b','then')]),accept,
    work('review','Review unresolved order',[branch('a','else'),branch('b','else'),branch('c','else')]),reconcile,
    work('complete','Finalize Completed',[branch('a','else'),branch('b','else'),branch('c','then'),branch('d','then')]),
    work('recover','Recover OMS Evidence',[branch('a','else'),branch('b','else'),branch('c','then'),branch('d','else')])];
}
test('nested path enumeration ignores decisions on branches not selected',()=>{
  const p=paths(fixture().filter(s=>s.kind==='gateway'));
  assert.equal(p.partial,false);
  assert.equal(p.paths.length,5);
  assert.deepEqual(p.paths[0],{a:'then'});
  assert.ok(p.paths.every(a=>!(a.a==='then' && a.b!==undefined)));
});

test('OMS evidence recovery gets an activity-based title and all four exact assumptions',()=>{
  const assignment={a:'else',b:'else',c:'then',d:'else'}, before=JSON.stringify(assignment);
  const v=view(fixture(),assignment);
  assert.equal(v.title,'Recover OMS Evidence');
  assert.equal(v.clauses.length,4);
  assert.equal(v.clauses[0].text,'Source is usable');
  assert.match(v.clauses[1].text,/not “Duplicate” and .*not “Withdrawn”/);
  assert.match(v.clauses[2].text,/Validation is accepted and/);
  assert.equal(v.clauses[3].text,'OMS is not reconciled');
  assert.equal(v.clauses[1].condition,duplicate);
  assert.equal(JSON.stringify(assignment),before);
});

test('path titles discard document numbering but not business words',()=>{
  const v=view(fixture(),{a:'then'});
  assert.equal(v.title,'Record fallback closure');
});

test('cap overflow uses explicitly partial single-decision scenarios',()=>{
  const g=Array.from({length:5},(_,i)=>gateway('g'+i,'flag'+i));
  const p=paths(g,24);
  assert.equal(p.partial,true);
  assert.equal(p.paths.length,10);
  assert.ok(p.paths.every(a=>Object.keys(a).length===1));
  const v=view(g,p.paths[0],true);
  assert.equal(v.partial,true);
  assert.equal(v.clauses.length,1);
  assert.equal(v.focus,'');
});

test('stable assignment keys do not depend on object order or AI names',()=>{
  assert.equal(api.scenarioAssignmentKey({a:'then',b:'else'}),api.scenarioAssignmentKey({b:'else',a:'then'}));
  const steps=fixture(), assignment={a:'else',b:'else',c:'then',d:'else'};
  const before=view(steps,assignment);
  steps.filter(s=>s.kind==='gateway').forEach(s=>{s.plainOrig=s.name;s.plain='AI question?';s.name=s.plain;});
  assert.deepEqual(view(steps,assignment).clauses,before.clauses);
});

test('HTML source details escape imported code and explain incomplete data',()=>{
  const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const html=new Function('esc','T',between('function scenarioDetailsHtml(', 'function renderScenarioDetails(')+'\nreturn scenarioDetailsHtml;')(escape,k=>k);
  const g={...gateway('a','Call("<script>unsafe</script>")'),conditionLabel:'<img src=x onerror=1>'};
  const output=html(view([g],{a:'else'}));
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('<img src='));
  assert.match(output,/False \/ Else/);
  assert.match(output,/&lt;script&gt;/);
  assert.match(output,/scn.unsupported/);
});

test('rebuilding labels preserves the selected branch assignment when requested',()=>{
  const S={model:{steps:fixture()},scn:{a:'else',b:'else',c:'then',d:'else'}};
  const controls={selScn:{value:'',innerHTML:''},btnScenarioDetails:{disabled:true},scnWrap:{style:{}}};
  const build=new Function('S','$','T','esc','renderScenarioDetails',
    between('function parseScenarioCondition(', '/* Scenario details UI.')+
    between('function buildScenarios(', "$('selScn').addEventListener")+'\nreturn buildScenarios;')(
      S,id=>controls[id],k=>k,s=>String(s),()=>{});
  const selected={...S.scn};
  build(true);
  assert.deepEqual(S.scn,selected);
  assert.equal(controls.btnScenarioDetails.disabled,false);
  assert.equal(S.scnDescription.title,'Recover OMS Evidence');
  S.model.steps.filter(s=>s.kind==='gateway').forEach(s=>{s.plainOrig=s.name;s.plain='AI question?';s.name=s.plain;});
  build(true);
  assert.deepEqual(S.scn,selected);
  assert.equal(S.scnDescription.clauses[0].text,'Source is usable');
  build(false);
  assert.equal(S.scn,null);
  assert.equal(controls.btnScenarioDetails.disabled,true);
});

test('new gateway models retain full conditions independently of compact names',()=>{
  const cleanApi=new Function(between('function fullCond(', 'function whenOf(')+'\nreturn {fullCond,cleanCond};')();
  const infer=new Function('cleanCond',between('function inferGateways(', 'function addFlowNotes(')+'\nreturn inferGateways;')(cleanApi.cleanCond);
  const c={xaml:[],steps:[work('a','Accepted input',[{id:'root#0',br:'then',cond:duplicate,wf:'Main.xaml',label:'Duplicate check',otherActs:[]}]),
    work('b','Continue intake',[{id:'root#0',br:'else',cond:duplicate,wf:'Main.xaml',label:'Duplicate check',otherActs:[]}])]};
  infer(c);
  const g=c.steps.find(s=>s.kind==='gateway');
  assert.equal(g.condition,duplicate);
  assert.equal(g.conditionLabel,'Duplicate check');
  assert.ok(g.name.includes('…'));
  assert.ok(g.detail.includes('"Withdrawn"'));
  assert.equal(scenarioSource(g).complete,true);
});

test('saved new scenario source retains all literal values and full conditions',()=>{
  const g=gateway('b',duplicate);
  const restored=JSON.parse(JSON.stringify(g));
  assert.equal(scenarioSource(restored).condition,duplicate);
  assert.match(describe(scenarioSource(restored).condition,false).text,/“Withdrawn”/);
});

test('an ellipsis inside a complete source string literal is not mistaken for truncation',()=>{
  const g=gateway('a','status = "…"');
  assert.equal(scenarioSource(g).complete,true);
  assert.equal(describe(g.condition,true).supported,true);
  assert.equal(parse(g.condition).right.value,'…');
  assert.equal(scenarioSource({name:'status = "…?'}).complete,false);
});

test('Scenario stays visible and explains unsupported Flowchart routes instead of disappearing',()=>{
  const controls={selScn:{value:'',innerHTML:''},btnScenarioDetails:{disabled:false},scnWrap:{style:{}},scenarioStatus:{hidden:true,textContent:''}};
  const S={model:{steps:[],_importReport:{routing:{flowchartDecisions:7}}}};
  const build=new Function('S','$','T','esc','renderScenarioDetails',
    between('function parseScenarioCondition(', '/* Scenario details UI.')+
    between('function buildScenarios(', "$('selScn').addEventListener")+'\nreturn buildScenarios;')(
      S,id=>controls[id],k=>k,s=>String(s),()=>{});
  build();
  assert.equal(controls.scnWrap.style.display,'inline-flex');assert.equal(controls.selScn.disabled,true);
  assert.equal(controls.scenarioStatus.hidden,false);assert.equal(controls.scenarioStatus.textContent,'scn.flowchartUnavailable');
  S.model={steps:[]};build();assert.equal(controls.scenarioStatus.textContent,'scn.noRoutes');
  S.model={steps:fixture()};build();assert.equal(controls.selScn.disabled,false);assert.equal(controls.scenarioStatus.hidden,true);
  assert.equal(S.scnList.length,5);
});
