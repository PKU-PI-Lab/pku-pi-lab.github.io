// build.js — read content/site.json and regenerate index.html
// Keeps the original design, CSS, and scripts intact; only replaces editable sections.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contentPath = path.join(root, 'content', 'site.json');
const htmlPath = path.join(root, 'index.html');
const backupPath = htmlPath + '.bak';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spanPair(en, zh) {
  return '<span class="en">' + en + '</span><span class="zh">' + zh + '</span>';
}

function readData() {
  return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
}

function readHtml() {
  if (!fs.existsSync(backupPath)) fs.copyFileSync(htmlPath, backupPath);
  return fs.readFileSync(htmlPath, 'utf8');
}

function replaceRegion(html, markerRe, replacement) {
  return html.replace(markerRe, replacement);
}

// ---- Render helpers ----
function renderBrand(brand) {
  return esc(brand.en) + ' <span class="nav-brand-cn">' + esc(brand.zh) + '</span>';
}

function renderNav(nav, sections) {
  const visible = nav.filter(n => n.visible !== false && !(sections && sections[n.id] === false));
  return visible.map((n, i) => '                <a href="' + esc(n.href) + '"' + (i === 0 ? ' class="active"' : '') + '>' + spanPair(n.en, n.zh) + '</a>').join('\n');
}

function renderHome(home) {
  // 如果用户已在标题文字里插入链接（富文本编辑器），则保留；否则用 title_link 整体包裹
  const hasLink = /<a[\s>]/i.test(home.title_en) || /<a[\s>]/i.test(home.title_zh);
  let titleEn = home.title_en;
  let titleZh = home.title_zh;
  if (home.title_link && !hasLink) {
    titleEn = '<a href="' + esc(home.title_link) + '">' + titleEn + '</a>';
    titleZh = '<a href="' + esc(home.title_link) + '">' + titleZh + '</a>';
  }
  return `<section class="profile" id="home">
            <div class="profile-left">
                <img src="${esc(home.photo)}" alt="Prof. ${esc(home.name_en)}" class="avatar">
            </div>
            <div class="profile-right">
                <h1>${esc(home.name_en)} <span class="name-cn">${esc(home.name_zh)}</span></h1>
                <p class="title">${spanPair(titleEn, titleZh)}</p>
                <p class="affiliation">${spanPair(home.affiliation_en, home.affiliation_zh)}</p>
                <p class="affiliation">${spanPair(home.former_en, home.former_zh)}</p>
                <div class="social-links">
                    <a href="mailto:${esc(home.email)}" title="Email">✉️ ${esc(home.email)}</a>
                </div>
            </div>
        </section>`;
}

function renderParas(paras) {
  return paras.map(p => {
    const inner = spanPair(p.en, p.zh);
    return '            <p' + (p.strong ? '><strong>' + inner + '</strong>' : '>' + inner) + '</p>';
  }).join('\n');
}

function renderNews(news, sections) {
  const items = news.items.map(n => {
    const link = n.link ? ' <a href="' + esc(n.link) + '" target="_blank" rel="noopener">Read more →</a>' : '';
    const linkZh = n.link ? ' <a href="' + esc(n.link) + '" target="_blank" rel="noopener">查看详情 →</a>' : '';
    const img = n.image
      ? '<div class="news-thumb">' +
          (n.link ? '<a href="' + esc(n.link) + '" target="_blank" rel="noopener">' : '') +
          '<img src="' + esc(n.image) + '" alt="' + esc(n.image_alt || '') + '" loading="lazy">' +
          (n.link ? '</a>' : '') +
        '</div>'
      : '';
    return '                <li>' + img + '<div class="news-body"><span class="news-date">' + esc(n.date) + '</span> <span class="en">' + n.en + link + '</span><span class="zh">' + n.zh + linkZh + '</span></div></li>';
  }).join('\n');

  const impactItems = news.impact.items.map(it =>
    '                <li><span class="impact-year">' + esc(it.year) + '</span> <span class="en">' + it.en + '</span><span class="zh">' + it.zh + '</span></li>'
  ).join('\n');

  const showImpact = !(sections && sections.impact === false);
  const impactBlock = showImpact ? `

            <h3 class="news-sub">${spanPair('🏭 Industrial Impact', '🏭 产业影响')}</h3>
            <p class="impact-intro">
                ${spanPair(news.impact.intro_en, news.impact.intro_zh)}
            </p>
            <ul class="impact-list">
${impactItems}
            </ul>` : '';

  return `<section class="news-section" id="news">
            <h2 class="section-title">📰 ${spanPair('News', '新闻动态')}</h2>
            <ul class="news-list">
${items}
            </ul>${impactBlock}
        </section>`;
}

function renderResearch(research) {
  const slides = research.slides.map(s => `                    <div class="slide">
                        <img class="slide-img" src="${esc(s.img)}" alt="${esc(s.alt)}" loading="lazy">
                        <h3>${spanPair(s.title_en, s.title_zh)}</h3>
                        <p>${spanPair(s.desc_en, s.desc_zh)}</p>
                    </div>`).join('\n');
  return `<section class="research-section" id="research">
            <h2 class="section-title">🔬 ${spanPair('Research', '研究方向')}</h2>
            <div class="research-carousel" id="researchCarousel">
                <div class="carousel-track">
${slides}
                </div>
                <button class="carousel-btn prev" type="button" aria-label="Previous">‹</button>
                <button class="carousel-btn next" type="button" aria-label="Next">›</button>
                <div class="carousel-dots" id="researchDots"></div>
            </div>
        </section>`;
}

function renderPeople(people) {
  const groups = people.groups.map((g, i) => {
    const members = g.members.map(m => `                <div class="member-card">
                    <img src="${esc(m.photo)}" alt="${esc(m.name)}">
                    <div class="member-info">
                        <span class="member-name">${esc(m.name)}</span>
                        <span class="member-role">${spanPair(m.role_en, m.role_zh)}</span>
                    </div>
                </div>`).join('\n');
    const gridClass = i === 0 ? 'people-grid pi-grid' : 'people-grid';
    return `            <h3 class="people-subtitle">${spanPair(g.title_en, g.title_zh)}</h3>
            <div class="${gridClass}">
${members}
            </div>`;
  }).join('\n\n');

  return `<section class="people-section" id="people">
            <h2 class="section-title">👥 ${spanPair('People', '团队')}</h2>
            <p class="people-intro">
                ${spanPair(people.intro.en, people.intro.zh)}
            </p>

${groups}
        </section>`;
}

function renderPublications(pubs) {
  const groups = pubs.groups.map(g => {
    const papers = g.papers.map(p => {
      const links = p.links.map(l => '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + '</a>').join('');
      const note = p.note_en ? `\n                        <p class="paper-note">${spanPair(p.note_en, p.note_zh)}</p>` : '';
      return `                <div class="paper-card">
                    <div class="paper-info">
                        <p class="paper-cite">${p.cite}</p>
                        ${links ? `<p class="paper-links">${links}</p>` : ''}${note}
                    </div>
                    <div class="paper-figure"><img src="${esc(p.figure)}" alt="${esc(p.figure_alt)}" loading="lazy"></div>
                </div>`;
    }).join('\n');
    return `            <h3 class="pub-group">${spanPair(g.title_en, g.title_zh)}</h3>
            <div class="paper-list">
${papers}
            </div>`;
  }).join('\n\n');

  return `<section class="publications" id="publications">
            <h2 class="section-title">📚 ${spanPair(pubs.title.en, pubs.title.zh)}</h2>
            <p class="pub-hint">${spanPair(pubs.hint.en, pubs.hint.zh)}</p>

${groups}
        </section>`;
}

function renderTeaching(teaching) {
  const items = teaching.map(t => `                <li>
                    <strong>${spanPair(t.title_en, t.title_zh)}</strong> ${spanPair(t.badge_en, t.badge_zh)}
                    <br><span class="teaching-desc">${spanPair(t.desc_en, t.desc_zh)}</span>
                </li>`).join('\n');
  return `<section class="teaching-section" id="teaching">
            <h2 class="section-title">🎓 ${spanPair('Teaching', '教学')}</h2>
            <ul class="teaching-list">
${items}
            </ul>
        </section>`;
}

function renderFooter(footer) {
  return `<footer class="footer">
        <p><strong>${spanPair(footer.name_en, footer.name_zh)}</strong></p>
        <p>${spanPair(footer.affiliation_en, footer.affiliation_zh)}</p>
        <p>${spanPair('Contact: <a href="mailto:' + esc(footer.contact_email) + '">' + esc(footer.contact_email) + '</a>', '联系：<a href="mailto:' + esc(footer.contact_email) + '">' + esc(footer.contact_email) + '</a>')}</p>
        <p>© 2026 ${esc(footer.name_en)}, Peking University. ${spanPair(footer.copyright_en, footer.copyright_zh)}</p>
        ${footer.powered ? '<p>' + esc(footer.powered) + '</p>' : ''}
    </footer>`;
}

function build() {
  const data = readData();
  let html = readHtml();

  const secs = data.sections || {};

  html = replaceRegion(html, /(<div class="nav-brand">)[\s\S]*?(<\/div>)/, (m, p1) => p1 + renderBrand(data.brand || { en: '', zh: '' }) + '</div>');
  html = replaceRegion(html, /(?<=<div class="nav-links">)\s*<a href="#home"[\s\S]*?<\/a>\s*(?=<\/div>\s*<button id="langToggle")/, '\n' + renderNav(data.nav, secs) + '\n');
  html = replaceRegion(html, /(<!-- ===== Principal Investigator \/ Home ===== -->\s*)<section class="profile" id="home">[\s\S]*?<\/section>/, '$1' + renderHome(data.home));
  html = replaceRegion(html, /<section class="bio">[\s\S]*?<\/section>/,
    '<section class="bio" id="bio">\n            <h2 class="section-title">' + spanPair('About the Lab', '实验室简介') + '</h2>\n' + renderParas(data.bio) + '\n        </section>');
  html = replaceRegion(html, /(<!-- ===== Opportunities ===== -->\s*)<section class="opportunities-section" id="opportunities">[\s\S]*?<\/section>/,
    '$1<section class="opportunities-section" id="opportunities">\n            <h2 class="section-title">🚀 ' + spanPair('Opportunities', '招聘') + '</h2>\n' + renderParas(data.opportunities) + '\n        </section>');
  html = replaceRegion(html, /(<!-- ===== News \(includes Industrial Impact\) ===== -->\s*)<section class="news-section" id="news">[\s\S]*?<\/section>/, '$1' + renderNews(data.news, secs));
  html = replaceRegion(html, /(?:[ \t]*<!-- ===== Research \(carousel\) ===== -->\s*)+<section class="research-section" id="research"[^>]*>[\s\S]*?<\/section>/,
    '\n\n        <!-- ===== Research (carousel) ===== -->\n        ' + renderResearch(data.research));
  html = replaceRegion(html, /(<!-- ===== People ===== -->\s*)<section class="people-section" id="people">[\s\S]*?<\/section>/, '$1' + renderPeople(data.people));
  html = replaceRegion(html, /(<!-- ===== Publications ===== -->\s*)<section class="publications" id="publications">[\s\S]*?<\/section>/, '$1' + renderPublications(data.publications));
  html = replaceRegion(html, /(<!-- ===== Teaching ===== -->\s*)<section class="teaching-section" id="teaching">[\s\S]*?<\/section>/, '$1' + renderTeaching(data.teaching));
  html = replaceRegion(html, /(<footer class="footer">)[\s\S]*?(<\/footer>)/, '$1\n' + renderFooter(data.footer).replace(/<footer class="footer">|<\/footer>/g, '') + '    $2');

  // ---- 栏目显示开关：隐藏的 section 加 display:none ----
  ['bio', 'opportunities', 'news', 'research', 'people', 'publications', 'teaching'].forEach(id => {
    if (secs[id] === false) {
      html = html.replace(new RegExp('(<section\\b[^>]*\\b' + id + '"[^>]*?)>'), (m, p1) => p1 + ' style="display:none;">');
    }
  });
  // 隐藏栏目前的分隔线一并隐藏（允许中间隔着注释），避免页面留下孤立横线
  html = html.replace(/<hr class="divider">\s*(?=(?:<!--[\s\S]*?-->\s*)*<section\b[^>]*style="display:none;")/g, '');
  html = html.replace(/(<hr class="divider">)[ \t]*\n[ \t]*(<hr class="divider">)/g, '$1');

  fs.writeFileSync(htmlPath, html, 'utf8');
  return { ok: true };
}

module.exports = { build };

if (require.main === module) {
  build();
  console.log('Built', htmlPath);
}
