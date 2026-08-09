// Extract editable content from the current static index.html into content/site.json
// Run: node scripts/extract.js   (from the site/ directory)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function section(name, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').trim();
}

function extractSpanPair(re, cb) {
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push(cb(m));
  }
  return out;
}

// ---- Navigation ----
function extractNav() {
  const navHtml = section('nav', /<nav class="navbar">([\s\S]*?)<\/nav>/);
  const re = /<a href="#([^"]+)"[^>]*><span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span><\/a>/g;
  const out = [];
  let m;
  while ((m = re.exec(navHtml))) {
    out.push({ id: m[1], en: decodeEntities(m[2].trim()), zh: decodeEntities(m[3].trim()), href: '#' + m[1], visible: true });
  }
  return out;
}

// ---- Home / PI profile ----
function extractHome() {
  const profileHtml = section('profile', /<section class="profile" id="home">([\s\S]*?)<\/section>/);
  const nameEn = (profileHtml.match(/<h1>([^<]+)/) || [, ''])[1].trim();
  const nameZh = (profileHtml.match(/<span class="name-cn">([^<]+)<\/span>/) || [, ''])[1].trim();
  const titleMatch = profileHtml.match(/<p class="title"><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/p>/);
  const titleEn = titleMatch ? titleMatch[1].trim() : '';
  const titleZh = titleMatch ? titleMatch[2].trim() : '';
  const titleLink = titleEn.match(/href="([^"]+)"/) ? titleEn.match(/href="([^"]+)"/)[1] : 'https://www.pku.edu.cn';
  const affMatch = profileHtml.match(/<p class="affiliation">\s*<span class="en">([\s\S]*?)<\/span>\s*<span class="zh">([\s\S]*?)<\/span>\s*<\/p>/);
  const affEn = affMatch ? affMatch[1].trim() : '';
  const affZh = affMatch ? affMatch[2].trim() : '';
  // Match the second affiliation paragraph (contains Former/曾任)
  const formerRe = /<p class="affiliation">[\s\S]*?<\/span>[\s\S]*?<\/span>[\s\S]*?<\/p>\s*<p class="affiliation">\s*<span class="en">([\s\S]*?)<\/span>\s*<span class="zh">([\s\S]*?)<\/span>\s*<\/p>/;
  const f2 = profileHtml.match(formerRe);
  const formerEn = f2 ? f2[1].trim() : '';
  const formerZh = f2 ? f2[2].trim() : '';
  const emailMatch = profileHtml.match(/href="mailto:([^"]+)"/);
  const photoMatch = profileHtml.match(/<img src="([^"]+)"[^>]*class="avatar"/);
  return {
    photo: photoMatch ? decodeEntities(photoMatch[1]) : 'images/pang.jpg',
    name_en: nameEn,
    name_zh: nameZh,
    title_en: titleEn,
    title_zh: titleZh,
    title_link: titleLink,
    affiliation_en: affEn,
    affiliation_zh: affZh,
    former_en: formerEn,
    former_zh: formerZh,
    email: emailMatch ? emailMatch[1] : 'zhibo.pang@pku.edu.cn',
  };
}

// ---- Bio / Opportunities: list of { en, zh, strong } paragraphs ----
function paragraphs(secHtml) {
  const out = [];
  const re = /<p[^>]*>\s*(<strong>)?\s*<span class="en">([\s\S]*?)<\/span>\s*<span class="zh">([\s\S]*?)<\/span>\s*(<\/strong>)?\s*<\/p>/g;
  let m;
  while ((m = re.exec(secHtml))) {
    out.push({ en: m[2].trim(), zh: m[3].trim(), strong: !!m[1] });
  }
  return out;
}

const bioHtml = section('bio', /<section class="bio">([\s\S]*?)<\/section>/);
const oppHtml = section('opp', /<section class="opportunities-section" id="opportunities">([\s\S]*?)<\/section>/);

// ---- News ----
function extractNews(secHtml) {
  const items = [];
  const ul = secHtml.match(/<ul class="news-list">([\s\S]*?)<\/ul>/);
  if (ul) {
    const re = /<li><span class="news-date">([^<]*)<\/span>\s*<span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/li>/g;
    let m;
    while ((m = re.exec(ul[1]))) {
      let en = m[2].trim();
      let zh = m[3].trim();
      let link = '';
      const a = en.match(/<a\s+href="([^"]+)"[^>]*>[\s\S]*?<\/a>/);
      if (a) {
        link = a[1];
        en = en.replace(/<a\s+href="[^"]+"[^>]*>[\s\S]*?<\/a>/g, '').trim();
        zh = zh.replace(/<a\s+href="[^"]+"[^>]*>[\s\S]*?<\/a>/g, '').trim();
      }
      items.push({ date: decodeEntities(m[1].trim()), en, zh, link });
    }
  }

  const impact = { intro_en: '', intro_zh: '', items: [] };
  const introMatch = secHtml.match(/<p class="impact-intro">\s*<span class="en">([\s\S]*?)<\/span>\s*<span class="zh">([\s\S]*?)<\/span>\s*<\/p>/);
  if (introMatch) {
    impact.intro_en = introMatch[1].trim();
    impact.intro_zh = introMatch[2].trim();
  }
  const impactUl = secHtml.match(/<h3 class="news-sub">[\s\S]*?<\/h3>\s*<p class="impact-intro">[\s\S]*?<\/p>\s*(<ul class="impact-list">[\s\S]*?<\/ul>)/);
  if (impactUl) {
    const re2 = /<li><span class="impact-year">([^<]*)<\/span>\s*<span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/li>/g;
    let m2;
    while ((m2 = re2.exec(impactUl[1]))) {
      impact.items.push({ year: decodeEntities(m2[1].trim()), en: m2[2].trim(), zh: m2[3].trim() });
    }
  }
  return { items, impact };
}

const newsHtml = section('news', /<section class="news-section" id="news">([\s\S]*?)<\/section>/);
const newsData = extractNews(newsHtml);

// ---- Research ----
function extractResearch(secHtml, hidden) {
  const visible = !hidden;
  const slides = [];
  const re = /<div class="slide">\s*<img class="slide-img" src="([^"]+)" alt="([^"]*)"[^>]*>\s*<h3><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/h3>\s*<p><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/p>\s*<\/div>/g;
  let m;
  while ((m = re.exec(secHtml))) {
    slides.push({
      img: decodeEntities(m[1].trim()),
      alt: decodeEntities(m[2].trim()),
      title_en: m[3].trim(),
      title_zh: m[4].trim(),
      desc_en: m[5].trim(),
      desc_zh: m[6].trim(),
    });
  }
  return { visible, slides };
}

const researchMatch = html.match(/<section class="research-section" id="research"([^>]*)>([\s\S]*?)<\/section>/);
const researchHtml = researchMatch ? researchMatch[2] : '';
const researchHidden = researchMatch ? /style=["'][^"']*display\s*:\s*none/i.test(researchMatch[1]) : false;

// ---- People ----
function extractPeople(secHtml) {
  const introMatch = secHtml.match(/<p class="people-intro">\s*<span class="en">([\s\S]*?)<\/span>\s*<span class="zh">([\s\S]*?)<\/span>\s*<\/p>/);
  const intro = introMatch ? { en: introMatch[1].trim(), zh: introMatch[2].trim() } : { en: '', zh: '' };

  const titleRe = /<h3 class="people-subtitle"><span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span><\/h3>/g;
  const cardRe = /<div class="member-card">\s*<img src="([^"]+)"[^>]*>\s*<div class="member-info">\s*<span class="member-name">([^<]+)<\/span>\s*<span class="member-role"><span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span>/g;

  const titles = [];
  let t;
  while ((t = titleRe.exec(secHtml))) titles.push({ en: decodeEntities(t[1].trim()), zh: decodeEntities(t[2].trim()), index: t.index });

  const cards = [];
  let c;
  while ((c = cardRe.exec(secHtml))) {
    cards.push({
      photo: decodeEntities(c[1].trim()),
      name: decodeEntities(c[2].trim()),
      role_en: decodeEntities(c[3].trim()),
      role_zh: decodeEntities(c[4].trim()),
      index: c.index,
    });
  }

  const groups = [];
  titles.forEach((title, i) => {
    const nextIdx = i + 1 < titles.length ? titles[i + 1].index : Infinity;
    const members = cards
      .filter((c) => c.index > title.index && c.index < nextIdx)
      .map((c) => ({ name: c.name, role_en: c.role_en, role_zh: c.role_zh, photo: c.photo }));
    groups.push({ title_en: title.en, title_zh: title.zh, members });
  });
  return { intro, groups };
}

const peopleHtml = section('people', /<section class="people-section" id="people">([\s\S]*?)<\/section>/);

// Extract inner HTML of a tag starting at startIdx, counting nested same-name open/close tags.
function extractTagInner(html, startIdx, tagName) {
  const openRe = new RegExp('<' + tagName + '\\b', 'gi');
  const closeRe = new RegExp('<\\/' + tagName + '>', 'gi');
  let depth = 1;
  let idx = startIdx;
  openRe.lastIndex = idx;
  closeRe.lastIndex = idx;
  while (depth > 0) {
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (!c) break;
    if (o && o.index < c.index) {
      depth++;
      idx = o.index + o[0].length;
      openRe.lastIndex = idx;
      closeRe.lastIndex = idx;
    } else {
      depth--;
      idx = c.index + c[0].length;
      openRe.lastIndex = idx;
      closeRe.lastIndex = idx;
    }
  }
  return html.slice(startIdx, idx - ('</' + tagName + '>').length);
}

// ---- Publications ----
function extractPublications(secHtml) {
  const titleMatch = secHtml.match(/<h2 class="section-title">[\s\S]*?<span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span><\/h2>/);
  const title = titleMatch ? { en: titleMatch[1].trim(), zh: titleMatch[2].trim() } : { en: 'Selected Publications', zh: '代表性论文' };
  const hintMatch = secHtml.match(/<p class="pub-hint"><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/p>/);
  const hint = hintMatch ? { en: hintMatch[1].trim(), zh: hintMatch[2].trim() } : { en: '', zh: '' };

  const groups = [];
  const chunks = secHtml.split(/<h3 class="pub-group">/);
  chunks.shift();
  for (const chunk of chunks) {
    const titleMatch2 = chunk.match(/<span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/h3>/);
    if (!titleMatch2) continue;
    const listIdx = chunk.indexOf('<div class="paper-list">');
    if (listIdx === -1) continue;
    const listStart = listIdx + '<div class="paper-list">'.length;
    const listHtml = extractTagInner(chunk, listStart, 'div');
    const group = { title_en: titleMatch2[1].trim(), title_zh: titleMatch2[2].trim(), papers: [] };
    const paperRe = /<div class="paper-card">\s*<div class="paper-info">([\s\S]*?)<\/div>\s*<div class="paper-figure"><img src="([^"]+)" alt="([^"]*)"[^>]*><\/div>\s*<\/div>/g;
    let pm;
    while ((pm = paperRe.exec(listHtml))) {
      const infoHtml = pm[1];
      const citeMatch = infoHtml.match(/<p class="paper-cite">([\s\S]*?)<\/p>/);
      const noteMatch = infoHtml.match(/<p class="paper-note"><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/p>/);
      const links = [];
      const linkRe = /<a href="([^"]+)"[^>]*target="_blank"[^>]*>([^<]*)<\/a>/g;
      let lnk;
      while ((lnk = linkRe.exec(infoHtml))) {
        links.push({ text: decodeEntities(lnk[2].trim()), href: decodeEntities(lnk[1].trim()) });
      }
      group.papers.push({
        cite: citeMatch ? citeMatch[1].trim() : '',
        note_en: noteMatch ? noteMatch[1].trim() : '',
        note_zh: noteMatch ? noteMatch[2].trim() : '',
        links,
        figure: decodeEntities(pm[2].trim()),
        figure_alt: decodeEntities(pm[3].trim()),
      });
    }
    groups.push(group);
  }
  return { title, hint, groups };
}

const pubsHtml = section('pubs', /<section class="publications" id="publications">([\s\S]*?)<\/section>/);

// ---- Teaching ----
function extractTeaching(secHtml) {
  const items = [];
  const re = /<li>\s*<strong><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/strong>\s*<span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span>\s*<br><span class="teaching-desc"><span class="en">([\s\S]*?)<\/span><span class="zh">([\s\S]*?)<\/span><\/span>\s*<\/li>/g;
  let m;
  while ((m = re.exec(secHtml))) {
    items.push({
      title_en: m[1].trim(),
      title_zh: m[2].trim(),
      badge_en: m[3].trim(),
      badge_zh: m[4].trim(),
      desc_en: m[5].trim(),
      desc_zh: m[6].trim(),
    });
  }
  return items;
}

const teachingHtml = section('teaching', /<section class="teaching-section" id="teaching">([\s\S]*?)<\/section>/);

// ---- Footer ----
function extractFooter() {
  const footerHtml = section('footer', /<footer class="footer">([\s\S]*?)<\/footer>/);
  const nameMatch = footerHtml.match(/<p><strong>([\s\S]*?)<\/strong><\/p>/);
  const affMatch = footerHtml.match(/<p><span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span><\/p>/);
  const contactMatch = footerHtml.match(/<p><span class="en">Contact: ([\s\S]*?)<\/span><span class="zh">联系：([\s\S]*?)<\/span><\/p>/);
  const copyMatch = footerHtml.match(/<p>(©[\s\S]*?)<span class="en">([^<]*)<\/span><span class="zh">([^<]*)<\/span><\/p>/);
  const emailMatch = footerHtml.match(/href="mailto:([^"]+)"/);
  return {
    name_en: nameMatch ? stripTags(nameMatch[1].split('（')[0]).trim() : 'Physical Intelligence Lab',
    name_zh: nameMatch ? (nameMatch[1].match(/（([^）]+)）/) || [, '物理智能实验室'])[1] : '物理智能实验室',
    affiliation_en: affMatch ? affMatch[1].trim() : '',
    affiliation_zh: affMatch ? affMatch[2].trim() : '',
    contact_en: contactMatch ? contactMatch[1].trim() : '',
    contact_zh: contactMatch ? contactMatch[2].trim() : '',
    contact_email: emailMatch ? emailMatch[1] : 'zhibo.pang@pku.edu.cn',
    copyright_en: copyMatch ? copyMatch[2].trim() : 'All rights reserved.',
    copyright_zh: copyMatch ? copyMatch[3].trim() : '保留所有权利。',
    powered: footerHtml.includes('GitHub Pages') ? 'Powered by GitHub Pages' : '',
  };
}

const data = {
  nav: extractNav(),
  home: extractHome(),
  bio: paragraphs(bioHtml),
  opportunities: paragraphs(oppHtml),
  news: newsData,
  research: extractResearch(researchHtml, researchHidden),
  people: extractPeople(peopleHtml),
  publications: extractPublications(pubsHtml),
  teaching: extractTeaching(teachingHtml),
  footer: extractFooter(),
};

const outPath = path.join(root, 'content', 'site.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

// sanity report
const totalMembers = data.people.groups.reduce((s, g) => s + g.members.length, 0);
const totalPapers = data.publications.groups.reduce((s, g) => s + g.papers.length, 0);
console.log('Extracted:');
console.log('  nav items      :', data.nav.length);
console.log('  bio paragraphs :', data.bio.length);
console.log('  opportunities  :', data.opportunities.length);
console.log('  news items     :', data.news.items.length);
console.log('  impact items   :', data.news.impact.items.length);
console.log('  research slides:', data.research.slides.length, 'visible=', data.research.visible);
console.log('  people groups  :', data.people.groups.length, 'total', totalMembers);
console.log('  pub groups     :', data.publications.groups.length, 'total', totalPapers);
console.log('  teaching items :', data.teaching.length);
console.log('Wrote', outPath);
