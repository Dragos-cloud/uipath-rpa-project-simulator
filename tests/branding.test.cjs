const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const page=read('index.html');

test('current product branding is neutral in app title, header and both guides',()=>{
  assert.match(page,/<title>RPA Project Simulator<\/title>/);
  assert.match(page,/const APP_NAME = 'RPA Project Simulator';/);
  assert.match(page,/id="appName">RPA Project Simulator<\/span>/);
  assert.match(page,/id="guideTitleEN">RPA Project Simulator — User Guide/);
  assert.match(page,/id="guideTitleRO">RPA Project Simulator — Ghid de utilizare/);
  assert.doesNotMatch(page,/UiPath RPA Project Simulator/);
});

test('bilingual notices attribute the platform mark without claiming permission',()=>{
  assert.match(page,/UiPath™ is a trademark of UiPath, Inc\. and UiPath SRL/);
  assert.match(page,/UiPath™ este o marcă a UiPath, Inc\. și UiPath SRL/);
  assert.match(page,/'footer\.notice':'Independent community tool/);
  assert.match(page,/'footer\.notice':'Instrument comunitar independent/);
  const footer=page.match(/<footer class="app-footer">[\s\S]*?<\/footer>/)[0];
  assert.match(footer,/Developed by Dragos Marin/);
  assert.match(footer,/data-t="footer.notice"/);
  assert.doesNotMatch(page,/used here with permission|folosită cu permisiune/i);
  assert.match(read('README.md'),/UiPath™ is a trademark of UiPath, Inc\. and UiPath SRL/);
  assert.match(read('README.md'),/^# RPA Project Simulator/m);
});

test('rename keeps legacy browser keys and saved-session schema',()=>{
  assert.match(page,/const SCHEMA_VERSION = 1;/);
  for(const key of ['rpasim.lang','rpasim.llm']) assert.ok(page.includes(key),key);
  assert.match(page,/appVersion: APP_VERSION/);
  assert.doesNotMatch(read('LICENSE'),/UiPath/);
});

test('public video links, preserved archive and retained repository URLs are disclosed',()=>{
  const demo=read('docs/demo/README.md');
  assert.match(demo,/Historical v0\.61/);
  assert.match(demo,/preserved unchanged/);
  assert.match(demo,/releases\/download\/v0\.61\/uipath-rpa-project-simulator-demo\.mp4/);
  assert.match(read('README.md'),/https:\/\/dragos-cloud\.github\.io\/uipath-rpa-project-simulator\//);
  assert.match(read('README.md'),/https:\/\/github\.com\/Dragos-cloud\/uipath-rpa-project-simulator\/releases\/tag\/v0\.70/);
  assert.match(read('README.md'),/releases\/download\/v0\.70\/rpa-project-simulator-short-v070\.mp4/);
  assert.match(demo,/releases\/download\/v0\.63\/rpa-project-simulator-walkthrough-v063\.mp4/);
  assert.match(read('README.md'),/Watch the walkthrough \(3:28\)/);
});
