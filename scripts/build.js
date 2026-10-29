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

// 成员头衔：按「 · 」拆成「学历 + 方向」两行，去掉中间的 ·
// 例：「联培硕士生 · 语义提取」→ 第一行「联培硕士生」、第二行「语义提取」
// 中英文各自拆分并保留语言切换；无「·」的（如 PI、访问学者、项目管理）只显示单行。
function renderMemberRole(en, zh) {
  const splitRole = (s) => {
    const str = String(s == null ? '' : s);
    const i = str.indexOf(' · ');
    return i === -1 ? [str] : [str.slice(0, i), str.slice(i + 3)];
  };
  const enParts = splitRole(en);
  const zhParts = splitRole(zh);
  const n = Math.max(enParts.length, zhParts.length);
  const lines = [];
  for (let k = 0; k < n; k++) {
    const e = enParts[k] || '';
    const z = zhParts[k] || '';
    lines.push('<span class="role-line"><span class="en">' + esc(e) + '</span><span class="zh">' + esc(z) + '</span></span>');
  }
  return lines.join('');
}

// ---- 导航 ↔ 区块标题联动 ----
// 区块大标题自动取自导航栏对应项（按 href 匹配，如 #news → id 为 news 的区块）。
// 这样在后台改导航栏文字，正文区块标题会跟着变，避免"导航改了、内容区还是旧标题"。
function navTitles(data) {
  const map = {};
  (data.nav || []).forEach(n => {
    if (n && n.href && n.visible !== false) map[n.href.replace(/^#/, '')] = { en: n.en, zh: n.zh };
  });
  return map;
}

function titleFor(titles, id, fbEn, fbZh) {
  return titles[id] ? spanPair(titles[id].en, titles[id].zh) : spanPair(fbEn, fbZh);
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
                <p class="affiliation">${spanPair(home.former_en, home.former_zh)}</p>${home.email ? `
                <div class="social-links">
                    <a href="mailto:${esc(home.email)}" title="Email">✉️ ${esc(home.email)}</a>
                </div>` : ''}
            </div>
        </section>`;
}

function renderParas(paras) {
  return paras.map(p => {
    const inner = spanPair(p.en, p.zh);
    return '            <p' + (p.strong ? '><strong>' + inner + '</strong>' : '>' + inner) + '</p>';
  }).join('\n');
}

function renderNews(news, titles, sections) {
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
            <h2 class="section-title">📰 ${titleFor(titles, 'news', 'News', '新闻动态')}</h2>
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

function renderPeople(people, titles) {
  // visible===false 的成员/分组在前端隐藏（数据保留在 site.json，后台可随时恢复）
  const groups = people.groups
    .filter(g => g.visible !== false && g.members.some(m => m.visible !== false));

  // 小分组并排：连续两个都 ≤2 人的分组放在同一水平线上（如 访问学者 / 项目管理），
  // 避免各占一整行、页面被拉得又长又空。
  const SMALL = 2;
  const rows = []; // 每项 = {group} 或 {pair:[g1,g2]}
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const n = g.members.filter(m => m.visible !== false).length;
    // i>0：学术带头人（第一组）始终独占一行，不参与并排
    if (i > 0 && n <= SMALL && i + 1 < groups.length) {
      const g2 = groups[i + 1];
      const n2 = g2.members.filter(m => m.visible !== false).length;
      if (n2 <= SMALL) { rows.push({ pair: [g, g2] }); i++; continue; }
    }
    rows.push({ group: g });
  }

  const blocks = rows.map(row => {
    const renderGroup = (g, i) => {
      const members = g.members.filter(m => m.visible !== false).map(m => `                <div class="member-card">
                    <img src="${esc(m.photo)}" alt="${esc(m.name)}">
                    <div class="member-info">
                        <span class="member-name">${esc(m.name)}</span>
                        <span class="member-role">${renderMemberRole(m.role_en, m.role_zh)}</span>
                    </div>
                </div>`).join('\n');
      const gridClass = i === 0 ? 'people-grid pi-grid' : 'people-grid';
      return `            <div class="people-block">
            <h3 class="people-subtitle">${spanPair(g.title_en, g.title_zh)}</h3>
            <div class="${gridClass}">
${members}
            </div>
            </div>`;
    };
    if (row.pair) {
      const firstIdx = groups.indexOf(row.pair[0]);
      return `            <div class="people-row">\n` +
        row.pair.map((g, k) => renderGroup(g, firstIdx + k)).join('\n') +
        `\n            </div>`;
    }
    return renderGroup(row.group, groups.indexOf(row.group));
  }).join('\n\n');

  // 团队简介为空时不渲染，避免残留占位字符
  const intro = (people.intro && (String(people.intro.en || '').trim() || String(people.intro.zh || '').trim()))
    ? `            <p class="people-intro">
                ${spanPair(people.intro.en, people.intro.zh)}
            </p>\n` : '';

  return `<section class="people-section" id="people">
            <h2 class="section-title">👥 ${titleFor(titles, 'people', 'People', '团队')}</h2>
${intro}${blocks}
        </section>`;
}

function renderPublications(pubs, titles) {
  // visible===false 的论文/分组在前端隐藏（数据保留在 site.json，后台可随时恢复）
  const groups = pubs.groups
    .filter(g => g.visible !== false && g.papers.some(p => p.visible !== false))
    .map(g => {
    const papers = g.papers.filter(p => p.visible !== false).map(p => {
      const links = p.links.map(l => '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.text) + '</a>').join('');
      const note = p.note_en ? `\n                        <p class="paper-note">${spanPair(p.note_en, p.note_zh)}</p>` : '';
      // 没有配图时不渲染 figure 容器，避免出现 <img src=""> 碎图
      const fig = p.figure ? `\n                    <div class="paper-figure"><img src="${esc(p.figure)}" alt="${esc(p.figure_alt)}" loading="lazy"></div>` : '';
      return `                <div class="paper-card">
                    <div class="paper-info">
                        <p class="paper-cite">${p.cite}</p>
                        ${links ? `<p class="paper-links">${links}</p>` : ''}${note}
                    </div>${fig}
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

function renderTeaching(teaching, titles) {
  const items = teaching.map(t => `                <li>
                    <strong>${spanPair(t.title_en, t.title_zh)}</strong> ${spanPair(t.badge_en, t.badge_zh)}
                    <br><span class="teaching-desc">${spanPair(t.desc_en, t.desc_zh)}</span>
                </li>`).join('\n');
  return `<section class="teaching-section" id="teaching">
            <h2 class="section-title">🎓 ${titleFor(titles, 'teaching', 'Teaching', '教学')}</h2>
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

  // 先清除上一轮构建残留的 style="display:none;"（可能有重复），否则分区替换正则
  // 无法匹配、已隐藏的栏目将永远无法再显示或编辑（隐藏→取消隐藏会失效）。随后按当前开关重新注入。
  html = html.replace(/ style="display:none;"/g, '');

  const secs = data.sections || {};
  const titles = navTitles(data);

  html = replaceRegion(html, /(<div class="nav-brand">)[\s\S]*?(<\/div>)/, (m, p1) => p1 + renderBrand(data.brand || { en: '', zh: '' }) + '</div>');
  html = replaceRegion(html, /(?<=<div class="nav-links">)\s*<a href="#home"[\s\S]*?<\/a>\s*(?=<\/div>\s*<button id="langToggle")/, '\n' + renderNav(data.nav, secs) + '\n');
  html = replaceRegion(html, /(<!-- ===== Principal Investigator \/ Home ===== -->\s*)<section class="profile" id="home">[\s\S]*?<\/section>/, '$1' + renderHome(data.home));
  html = replaceRegion(html, /<section\b[^>]*\bid="bio"[^>]*>[\s\S]*?<\/section>/,
    '<section class="bio" id="bio">\n            <h2 class="section-title">🔬 ' + titleFor(titles, 'bio', 'Research Directions', '研究方向') + '</h2>\n' + renderParas(data.bio) + '\n        </section>');
  html = replaceRegion(html, /(<!-- ===== Opportunities ===== -->\s*)<section\b[^>]*\bid="opportunities"[^>]*>[\s\S]*?<\/section>/,
    '$1<section class="opportunities-section" id="opportunities">\n            <h2 class="section-title">🚀 ' + titleFor(titles, 'opportunities', 'Opportunities', '招聘') + '</h2>\n' + renderParas(data.opportunities) + '\n        </section>');
  html = replaceRegion(html, /(<!-- ===== News \(includes Industrial Impact\) ===== -->\s*)<section\b[^>]*\bid="news"[^>]*>[\s\S]*?<\/section>/, '$1' + renderNews(data.news, titles, secs));
  html = replaceRegion(html, /(?:[ \t]*<!-- ===== Research \(carousel\) ===== -->\s*)+<section\b[^>]*\bid="research"[^>]*>[\s\S]*?<\/section>/,
    '\n\n        <!-- ===== Research (carousel) ===== -->\n        ' + renderResearch(data.research));
  html = replaceRegion(html, /(<!-- ===== People ===== -->\s*)<section\b[^>]*\bid="people"[^>]*>[\s\S]*?<\/section>/, '$1' + renderPeople(data.people, titles));
  html = replaceRegion(html, /(<!-- ===== Publications ===== -->\s*)<section\b[^>]*\bid="publications"[^>]*>[\s\S]*?<\/section>/, '$1' + renderPublications(data.publications, titles));
  html = replaceRegion(html, /(<!-- ===== Teaching ===== -->\s*)<section\b[^>]*\bid="teaching"[^>]*>[\s\S]*?<\/section>/, '$1' + renderTeaching(data.teaching, titles));
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
