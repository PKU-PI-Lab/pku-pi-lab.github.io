const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function count(tag) {
  const open = (html.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
  const close = (html.match(new RegExp('<\\/' + tag + '>', 'gi')) || []).length;
  return { open, close, ok: open === close };
}

const tags = ['section', 'div', 'p', 'ul', 'li', 'span', 'a', 'strong', 'em'];
let allOk = true;
const report = [];
for (const t of tags) {
  const c = count(t);
  if (!c.ok) allOk = false;
  report.push(t + ': ' + c.open + '/' + c.close + (c.ok ? ' OK' : ' MISMATCH'));
}

// Check required sections
const required = ['id="home"', 'id="opportunities"', 'id="news"', 'id="people"', 'id="publications"', 'id="teaching"', 'class="footer"'];
for (const r of required) {
  const ok = html.includes(r);
  if (!ok) allOk = false;
  report.push(r + ': ' + (ok ? 'OK' : 'MISSING'));
}

// Verify hidden research
report.push('research hidden: ' + (html.includes('id="research" style="display:none;"') ? 'YES' : 'NO'));
report.push('appointments removed: ' + (!html.includes('学术与兼职任职') && !html.includes('Academic &amp; Professional Appointments') ? 'YES' : 'NO'));

fs.writeFileSync(path.join(__dirname, '_verify_report.txt'), report.join('\n') + '\n' + (allOk ? 'ALL OK' : 'HAS ISSUES'));
console.log(allOk ? 'ALL OK' : 'HAS ISSUES');
