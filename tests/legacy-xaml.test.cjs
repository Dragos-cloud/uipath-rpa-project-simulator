// Synthetic namespaces and workflow fragments only; no client project content.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const between=(a,b)=>{const start=page.indexOf(a),end=page.indexOf(b,start);assert.ok(start>=0&&end>start,a);return page.slice(start,end);};
const normalize=new Function(between('function normalizeLegacyXamlNamespaces(', 'function parseXaml(')+'\nreturn normalizeLegacyXamlNamespaces;')();
const ns='clr-namespace:System;assembly=mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=example';
const xmlns=`xmlns:s="${ns}"`;
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// DOM fixtures exercise traversal/report/error handling, not XML correctness.
// Actual browser DOMParser imports are separately checked on real files.
let parsedText='',xmlError=null;
const root={children:[],getAttributeNS(){return 'SyntheticLegacy';},getElementsByTagName(){return [];}};
class FixtureDOMParser{
  parseFromString(text){parsedText=text;return {documentElement:root,querySelector(){return xmlError;}};}
}
const api=new Function('DOMParser','APP_VERSION','esc','T',between('const NS_X   =','/* =====================================================================\n   12. IMPORT UI')+
  '\nreturn {parseXaml,readCatchType,buildImportReport,importReportHtml,buildProjectModel};')(FixtureDOMParser,'test',escape,key=>key);

test('modern namespaces and all ordinary attributes remain byte-for-byte unchanged',()=>{
  const xml='<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:s="clr-namespace:System;assembly=mscorlib"><Sequence DisplayName="Keep exact name" /></Activity>';
  assert.deepEqual(normalize(xml),{text:xml,adjustments:[]});
});

test('assembly-qualified namespaces encode whitespace without removing assembly identity or changing prefixes',()=>{
  const xml=`<Activity ${xmlns}><s:Exception /></Activity>`;
  const p=normalize(xml);
  assert.equal(p.adjustments.length,1);assert.equal(p.adjustments[0].prefix,'s');assert.equal(p.adjustments[0].original,ns);
  assert.equal(p.adjustments[0].normalized,ns.replace(/ /g,'%20'));
  assert.equal(p.text,xml.replace(ns,ns.replace(/ /g,'%20')));
  assert.match(p.text,/<s:Exception/);assert.match(p.text,/Version=4.0.0.0/);assert.match(p.text,/PublicKeyToken=example/);
});

test('single/double-quoted and default namespace declarations keep quoting, spacing and attribute names',()=>{
  const xml=`<Activity xmlns='${ns}' xmlns:alias = "${ns}" Name="Unchanged"/>`;
  const p=normalize(xml);assert.deepEqual(p.adjustments.map(a=>a.prefix),['','alias']);
  assert.match(p.text,/xmlns='clr-namespace:/);assert.match(p.text,/xmlns:alias = "clr-namespace:/);assert.match(p.text,/Name="Unchanged"/);
});

test('literal and numeric-reference whitespace in the assembly name is handled with XML attribute normalization',()=>{
  const xml='<Activity xmlns:s="clr-namespace:System;assembly=mscorlib,\r\n\tVersion=4,&#x20;Culture=neutral,&#32;Token=x,&#x9;Extra=y"/>';
  const p=normalize(xml);
  assert.match(p.text,/mscorlib,%20%20Version=4,%20Culture=neutral,%20Token=x,%09Extra=y/);
  assert.equal(p.adjustments.length,1);
});

test('already-escaped namespaces are not double encoded; normalization is idempotent',()=>{
  const once=normalize(`<Activity ${xmlns}/>`);
  const twice=normalize(once.text);
  assert.equal(twice.text,once.text);assert.deepEqual(twice.adjustments,[]);assert.doesNotMatch(twice.text,/%2520/);
});

test('selectors, code, expressions, messages and type arguments are never rewritten',()=>{
  const xml=`<Activity ${xmlns}>
    <InvokeWorkflowFile WorkflowFileName="Legacy child.xaml" />
    <Catch x:TypeArguments="s:Exception" />
    <Throw Exception='[New Exception("keep exact spaces")]'/>
    <InvokeCode Code='Dim t = "xmlns:fake=&quot;${ns}&quot;"' />
    <Click Selector="&lt;html title='Keep exact spaces' /&gt;" />
  </Activity>`;
  const p=normalize(xml);
  assert.equal(p.adjustments.length,1);assert.equal(p.text,xml.replace(xmlns,xmlns.replace(/ /g,'%20')));
});

test('namespace-looking text inside a non-namespace quoted attribute is never interpreted as markup',()=>{
  const snippets=[`<Activity Code="xmlns:s='${ns}'"/>`,`<Activity Code='xmlns:s="${ns}"'/>`];
  for(const xml of snippets) assert.deepEqual(normalize(xml),{text:xml,adjustments:[]});
});

test('comments, CDATA, processing instructions and DTD/entity declarations remain untouched',()=>{
  const xml=`<?xml version="1.0"?><?example <Fake ${xmlns}?>
    <!-- <Fake ${xmlns}/> -->
    <!DOCTYPE Activity [
      <!-- ] > <Fake ${xmlns}/> -->
      <?inside ] > <Fake ${xmlns}?>
      <!ENTITY fake '<Fake ${xmlns}/>'>
    ]>
    <Activity><Code><![CDATA[<Fake ${xmlns}/>]]></Code></Activity>`;
  assert.deepEqual(normalize(xml),{text:xml,adjustments:[]});
});

test('genuine nested namespace declarations are handled after ignored markup and quoted greater-than signs',()=>{
  const xml=`<!-- <Fake ${xmlns}/> --><Activity Text="one > two"><Sequence ${xmlns}/></Activity>`;
  const p=normalize(xml);assert.equal(p.adjustments.length,1);
  assert.ok(p.text.startsWith(`<!-- <Fake ${xmlns}/> -->`));assert.match(p.text,/Text="one > two"/);
  assert.match(p.text,/<Sequence xmlns:s="clr-namespace:System;assembly=mscorlib,%20Version/);
});

test('other URI errors and malformed/truncated markup are not broadly repaired',()=>{
  for(const xml of ['<Activity xmlns:s="https://example.test/not a URI"/>',
    '<Activity xmlns:s="clr-namespace:Bad Namespace"/>',
    '<!-- unterminated <Activity '+xmlns+'/>',
    '<![CDATA[unterminated <Activity '+xmlns+'/>',
    '<?unterminated <Activity '+xmlns+'/>',
    '<!DOCTYPE Activity [<!-- unterminated '+xmlns]){
    assert.deepEqual(normalize(xml),{text:xml,adjustments:[]});
  }
  const malformed=normalize(`<Activity ${xmlns}><Unclosed></Activity>`);
  assert.match(malformed.text,/<Unclosed><\/Activity>/); // XML well-formedness still belongs to DOMParser.
});

test('parseXaml uses the compatible copy, records provenance and leaves input untouched',()=>{
  const original=`<Activity ${xmlns}/>`;xmlError=null;
  const wf=api.parseXaml('Legacy.xaml',original);
  assert.equal(parsedText,normalize(original).text);assert.equal(original,`<Activity ${xmlns}/>`);
  assert.equal(wf.xmlCompatibility.version,1);assert.equal(wf.xmlCompatibility.namespaceAdjustments[0].original,ns);
  assert.equal(wf.file,'Legacy.xaml');assert.equal(wf.cls,'SyntheticLegacy');
  const modern=api.parseXaml('Modern.xaml','<Activity/>');assert.equal(modern.xmlCompatibility,undefined);
});

test('Catch CLR type resolution still works with escaped assembly identity',()=>{
  const uri=normalize(`<Activity ${xmlns}/>`).adjustments[0].normalized;
  const type=api.readCatchType({getAttributeNS(){return 's:Exception';},lookupNamespaceURI(){return uri;}});
  assert.equal(type.fullName,'System.Exception');assert.equal(type.category,'general');
});

test('remaining XML failures retain useful bounded diagnostics without rendered-source text',()=>{
  xmlError={textContent:'This page contains the following errors: error on line 4 at column 8: Opening and ending tag mismatch. Below is a rendering of the page up to the first error: PRIVATE_RENDERED_TEXT'};
  try{
    assert.throws(()=>api.parseXaml('Broken.xaml','<Activity>'),e=>{
      assert.equal(e.code,'XAML_XML_ERROR');assert.equal(e.file,'Broken.xaml');
      assert.match(e.message,/line 4 at column 8/);assert.doesNotMatch(e.message,/PRIVATE_RENDERED_TEXT|Below is a rendering/);return true;
    });
    xmlError={textContent:'x'.repeat(1000)};
    assert.throws(()=>api.parseXaml('Broken.xaml','<Activity>'),e=>e.message.length<350);
  }finally{xmlError=null;}
});

test('compatibility adjustments survive model building, import review and JSON serialization',()=>{
  const wf=api.parseXaml('Legacy.xaml',`<Activity ${xmlns}/>`);
  const built=api.buildProjectModel({xaml:[wf]});
  const report=JSON.parse(JSON.stringify(built.model._importReport));
  assert.equal(report.workflowCount,1);assert.equal(report.xmlCompatibility.workflows,1);
  assert.equal(report.xmlCompatibility.declarations,1);assert.equal(report.xmlCompatibility.files[0].adjustments[0].original,ns);
  assert.deepEqual(report.errors,[]);assert.equal(report.routing.selectableDecisions,0);
  assert.equal(built.model.exceptions.length,0);assert.ok(!built.model.steps.some(s=>s.gate));
});

test('compatibility review escapes imported filenames and stays optional for old sessions',()=>{
  const wf=api.parseXaml('<script>Legacy.xaml',`<Activity ${xmlns}/>`);
  const report=api.buildProjectModel({xaml:[wf]}).model._importReport;
  const html=api.importReportHtml(report);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
  delete report.xmlCompatibility;assert.doesNotThrow(()=>api.importReportHtml(report));
  const keys=[...page.matchAll(/'(imp\.legacyXml(?:Why)?)'\s*:/g)].map(m=>m[1]);
  assert.equal(keys.length,4);for(const key of new Set(keys)) assert.equal(keys.filter(k=>k===key).length,2);
});
