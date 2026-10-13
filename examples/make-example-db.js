#!/usr/bin/env node
// make-example-db.js — builds examples/Example-Reports-DB.json, a demo database for EmployeeWizard's 📊 Reports.
//
//   node examples/make-example-db.js [output.json]
//
// Starts from PaperWizard/Current.json (the real rooms, buildings, lots, schedules, projections, roster, daily chores and
// grow-log wizard) and adds, dated relative to today:
//   • ~2½ years of past crops in the three flower rooms on the 76-day cadence, kept as crop summaries (with frozen labour
//     costs). Each one is built as if it were a close-out archive and summarised by EmployeeWizard's own code.
//   • labour on every past crop task (roster staff + temps; the last two weeks signed in DailyWizard), recipe estimates,
//     tagged grow logs, an example harvest log (1000 g wet per plant), chore hours, equipment maintenance with hours,
//     booked time off, canopy sq ft and room light counts.
// Rerun it on the day of a demo so "today" is current. The output holds real staff and lot names: it is git-ignored.
// Needs Node 18+. Nothing here touches the real database files.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(__dirname, 'Example-Reports-DB.json');
// A do-nothing page, so EmployeeWizard's script can run outside a browser
const mk = () => { const el = { value: '', options: [], dataset: {}, style: {}, hidden: false, checked: false, innerHTML: '', textContent: '',
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, addEventListener() {}, removeEventListener() {}, appendChild() {}, insertBefore() {},
  querySelector: () => mk(), querySelectorAll: () => [], closest: () => null, focus() {}, getBoundingClientRect: () => ({ width: 10, height: 10, left: 0, top: 0 }),
  setAttribute() {}, getAttribute: () => null, selectedOptions: [{ textContent: 'Task' }], scrollIntoView() {} }; return el; };
const els = {};
globalThis.document = { getElementById: id => els[id] || (els[id] = mk()), querySelector: () => mk(), querySelectorAll: () => [], createElement: () => mk(), body: mk(), addEventListener() {}, activeElement: null, visibilityState: 'visible' };
globalThis.window = globalThis; window.opener = null; globalThis.addEventListener = () => {};
globalThis.location = { protocol: 'file:', origin: 'null' }; globalThis.indexedDB = { open: () => ({}) };
globalThis.innerWidth = 1400; globalThis.innerHeight = 900; globalThis.screen = { availWidth: 1400, availHeight: 900 };
globalThis.alert = m => console.log('ALERT', m); globalThis.confirm = () => true;

const ewHtml = fs.readFileSync(path.join(ROOT, 'EmployeeWizard', 'EmployeeWizard.html'), 'utf8');
const ewScript = ewHtml.slice(ewHtml.indexOf('<script>') + 8, ewHtml.lastIndexOf('</script>'));
eval(ewScript + '\n' + fs.readFileSync(path.join(__dirname, 'example-db-data.js'), 'utf8') + '\nprocess.exit(0);');
