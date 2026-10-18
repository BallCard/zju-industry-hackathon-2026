'use strict';

const $ = id => document.getElementById(id);
const state = { options: null, health: null, result: null, versions: [], selectedVersion: null,
  versionCounter: 0, busy: false, stale: false, serviceUnreachable: false, notice: null, toastTimer: null,
  parsedTask: null, explicitFields: new Set() };
const TASK_FIELDS = ['mode', 'request', 'product', 'audience', 'platform', 'scene', 'stage', 'objective', 'instructions'];
const PLATFORM_HINTS = {
  小红书: '短段落、场景清单与话题，方便阅读和收藏。',
  公众号: '完整展开使用场景、产品亮点与选购建议。',
  门店朋友圈: '一个核心亮点，配上自然的咨询或到店邀请。',
  门店海报: '醒目的标题与简洁卖点，适合门店展示。'
};
const PRESETS = {
  student: { request: '我想给刚入学的大学生选一台适合图书馆学习和日常携带的华为电脑。', audience: '大学新生', scene: '开学季', stage: '了解阶段', platform: '小红书',
    objective: '引导到店体验', instructions: '语气轻松，结合上课、图书馆学习和日常携带，结尾邀请到店看看。' },
  office: { request: '请帮经常出差的职场人群选一台华为电脑，关注移动办公和外设连接需求。', audience: '经常出差的职场人群', scene: '职场办公', stage: '比较阶段', platform: '公众号',
    objective: '辅助比较', instructions: '围绕移动办公和外设连接，帮读者梳理选购时要确认的事情。' },
  creator: { request: '请帮摄影与设计创作者选一台华为电脑，关注屏幕和内容创作需求。', audience: '摄影与设计创作者', scene: '内容创作', stage: '比较阶段', platform: '小红书',
    objective: '鼓励收藏分享', instructions: '重点介绍有资料支持的屏幕信息，整理成容易收藏的选购清单。' }
};
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function announce(message) { $('announcement').textContent = message; }
function toast(message) {
  clearTimeout(state.toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  announce(message);
  state.toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500);
}
function safeTask(task) {
  const clean = Object.fromEntries(TASK_FIELDS.filter(key => typeof task?.[key] === 'string').map(key => [key, task[key]]));
  if (Array.isArray(task?.omittedTopics)) clean.omittedTopics = task.omittedTopics.filter(topic => typeof topic === 'string');
  const preferences = task?.writingPreferences;
  if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
    const writingPreferences = {};
    if (['short', 'normal'].includes(preferences.length)) writingPreferences.length = preferences.length;
    if (['conversational', 'neutral'].includes(preferences.tone)) writingPreferences.tone = preferences.tone;
    if (Array.isArray(preferences.focusTopics)) {
      writingPreferences.focusTopics = preferences.focusTopics.filter(topic => typeof topic === 'string')
        .slice(0, 20).map(topic => topic.slice(0, 80));
    }
    clean.writingPreferences = writingPreferences;
  }
  return clean;
}
function getTask() {
  return Object.fromEntries(TASK_FIELDS.map(key => [key, $(key).value.trim()]));
}
function fillTask(task, includeMode = true) {
  for (const key of TASK_FIELDS) {
    if ((!includeMode && key === 'mode') || task?.[key] === undefined) continue;
    const field = $(key);
    if (field.tagName === 'SELECT' && !Array.from(field.options).some(option => option.value === task[key])) {
      field.add(new Option(task[key], task[key]));
    }
    field.value = task[key];
  }
  updateRequirements();
  updateMode();
}
function updateRequirements() {
  const objective = $('objective').selectedOptions[0]?.textContent || $('objective').value;
  $('requirements-summary').textContent = [$('scene').value, $('stage').value, objective].join(' · ');
  $('platform-hint').textContent = PLATFORM_HINTS[$('platform').value] || '根据发布位置，组织合适的图文结构。';
  document.querySelectorAll('[data-audience]').forEach(button => {
    button.classList.toggle('is-active', $('audience').value === button.dataset.audience);
    button.setAttribute('aria-pressed', String($('audience').value === button.dataset.audience));
  });
}
async function api(url, payload) {
  const options = payload === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  };
  let response;
  try { response = await fetch(url, options); } catch (cause) {
    // Fetch rejects with TypeError on a network failure; decoding and application errors stay distinct.
    if (!(cause instanceof TypeError) && cause?.name !== 'TypeError') throw cause;
    const error = new Error('无法连接写稿服务，请确认服务已启动，再重试。');
    error.code = 'SERVICE_UNREACHABLE';
    state.serviceUnreachable = true;
    updateMode();
    throw error;
  }
  state.serviceUnreachable = false;
  updateMode();
  let data;
  try { data = await response.json(); } catch { throw new Error('服务暂时没有返回结果，请稍后重试。'); }
  if (!response.ok) throw new Error(data.error || `服务暂时无法完成请求（${response.status}），请重试。`);
  return data;
}
function updateMode() {
  const live = $('mode').value === 'live';
  $('source-badge').textContent = state.serviceUnreachable ? '服务未连接 · 可重试' : live ? 'ima 在线资料' : '本地资料';
  $('source-badge').classList.toggle('offline', state.serviceUnreachable);
  $('source-detail').textContent = state.serviceUnreachable
    ? '无法连接写稿服务。确认服务已启动后，再点「生成文案」即可重新连接，当前输入与上一稿会保留。'
    : live ? '从已配置的 ima 知识库获取产品信息与图片，连接可用后即可生成。'
      : '使用本机已有的产品资料与图片。无需在线知识库连接，也可以写稿。';
}
function clearFieldErrors() {
  for (const key of ['product', 'audience']) {
    $(key).removeAttribute('aria-invalid');
    $(key + '-error').hidden = true;
  }
  $('form-error').hidden = true;
  $('revision-error').hidden = true;
}
function validateTask(task) {
  let firstInvalid;
  if (!task.request && !task.product) {
    $('form-error').textContent = '请先描述你的需求，或选择一个已有型号。';
    $('form-error').hidden = false;
    $('request').focus();
    announce('请先描述需求或选择已有型号。');
    return false;
  }
  // The legacy product + audience flow remains available when no free-form request is supplied.
  if (!task.request && !task.audience) {
    $('audience').setAttribute('aria-invalid', 'true');
    $('audience-error').textContent = '写一下这篇文案想给谁看。';
    $('audience-error').hidden = false;
    firstInvalid = $('audience');
  }
  if (firstInvalid) { firstInvalid.focus(); announce('请先补充目标人群。'); return false; }
  return true;
}
function setBusy(busy, revision = false) {
  state.busy = busy;
  for (const key of TASK_FIELDS) $(key).disabled = busy;
  document.querySelectorAll('[data-preset], [data-audience], [data-candidate]').forEach(button => { button.disabled = busy; });
  $('generate').disabled = busy;
  $('generate-label').textContent = busy ? (revision ? '正在修改…' : '正在生成…') : '生成文案';
  $('working-state').hidden = !busy;
  $('working-state').querySelector('strong').textContent = revision ? '正在按你的想法修改' : '正在为你写稿';
  $('draft-content').setAttribute('aria-busy', String(busy));
  document.querySelectorAll('[data-revision], #revise, #version-select').forEach(button => { button.disabled = busy; });
  if (busy) {
    $('empty-state').hidden = true;
    $('draft-state').textContent = revision ? '修改中' : '写稿中';
    $('draft-state').className = 'draft-state';
    announce(revision ? '正在修改文案，请稍候。' : '正在生成文案，请稍候。');
  }
}
function sourceMode(result) { return result.sourceMode || result.mode || result.task?.mode || 'local'; }
function sourceLabel(result) { return sourceMode(result) === 'live' ? 'ima 在线资料' : '本地资料'; }
function resultStatus(result) { return result.status || (result.ok ? 'ok' : result.needsInput ? 'need_info' : 'blocked'); }
function imageUrl(image, result) {
  const model = result.task?.product || image.model || '';
  if (image.origin === 'local' || (!image.origin && sourceMode(result) === 'local')) {
    return '/api/local-image?model=' + encodeURIComponent(model) + '&id=' + encodeURIComponent(image.id);
  }
  if (image.mediaId) return '/api/ima-image?model=' + encodeURIComponent(model) + '&mediaId=' + encodeURIComponent(image.mediaId);
  return '';
}
function articleBlocks(result) {
  if (Array.isArray(result.copy?.blocks) && result.copy.blocks.length) return result.copy.blocks;
  // Older servers provide fullText. Preserve the article once, without repeating its title or lead.
  const textBlocks = String(result.copy?.fullText || '').split(/\n\s*\n/).filter(Boolean).map((text, index) => {
    const heading = text.match(/^(#{1,3})\s+(.+)$/);
    return heading ? { id: 'legacy-' + index, type: 'heading', level: heading[1].length, text: heading[2] }
      : { id: 'legacy-' + index, type: 'text', text };
  });
  for (const [index, image] of (result.images || []).entries()) {
    textBlocks.splice(Math.min(3 + index * 2, textBlocks.length), 0,
      { id: 'legacy-image-' + image.id, type: 'image', imageId: image.id });
  }
  return textBlocks;
}
function renderText(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function renderImage(image, result) {
  if (!image) return '';
  const url = imageUrl(image, result);
  const caption = image.description || image.caption || '产品配图';
  const fileName = image.filename || 'pc-studio-image.jpg';
  return '<figure data-image-id="' + esc(image.id) + '">' + (url
    ? '<img loading="lazy" alt="' + esc(caption) + '" src="' + esc(url) + '">'
    : '<div class="image-error">这张图片暂时无法查看，请在资料来源中确认。</div>')
    + '<figcaption><span>' + esc(caption) + '<br>来源：' + esc(image.sourceTitle || result.kbName || sourceLabel(result))
    + '</span>' + (url ? '<span class="image-actions"><a href="' + esc(url) + '" target="_blank" rel="noopener">查看原图</a>'
      + '<a href="' + esc(url) + '" download="' + esc(fileName) + '">下载</a></span>' : '') + '</figcaption></figure>';
}
function renderArticle(result) {
  const images = new Map((result.images || []).map(image => [image.id, image]));
  const issues = result.audit?.issues || [];
  $('article').innerHTML = articleBlocks(result).map(block => {
    let html;
    if (block.type === 'image') html = renderImage(images.get(block.imageId), result);
    else if (block.type === 'heading') {
      const level = Math.min(3, Math.max(1, Number(block.level) || 2));
      html = '<h' + level + '>' + renderText(block.text) + '</h' + level + '>';
    } else html = '<p>' + renderText(block.text || '') + '</p>';
    const blockIssues = issues.filter(issue => issue.blockId === block.id);
    return '<div data-block-id="' + esc(block.id || '') + '">' + html + blockIssues.map(issue =>
      '<div class="block-issue">需要确认：' + esc(issue.message) + '</div>').join('') + '</div>';
  }).join('');
  $('article').querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
    const fallback = document.createElement('div');
    fallback.className = 'image-error';
    fallback.textContent = '图片暂时无法加载，请重试或查看资料来源。';
    image.replaceWith(fallback);
    toast('有图片暂时无法加载，发布前请确认。');
  }, { once: true }));
}
function missingNotes(result) {
  const notes = [];
  const missing = Number(result.audit?.images?.missing || 0);
  if (missing > 0) notes.push('还缺 ' + missing + ' 张符合要求的图片');
  const issues = (result.audit?.issues || []).filter(issue => !issue.blockId).map(issue => issue.message).filter(Boolean);
  notes.push(...issues);
  if (!notes.length && resultStatus(result) === 'incomplete') notes.push('资料或图片尚未完整，请先确认缺失项');
  return [...new Set(notes)];
}
function draftPrefix(result) {
  return resultStatus(result) === 'incomplete' ? '【草稿 · 尚未完整】\n' + missingNotes(result).join('；') + '\n\n' : '';
}
function renderSources(result) {
  const facts = result.facts || [], images = result.images || [];
  $('source-count').textContent = facts.length + ' 条资料 · ' + images.length + ' 张图';
  const sourceLink = source => {
    if (!/^https?:\/\//i.test(source || '')) return '';
    return '<a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">查看原始资料 ↗</a>';
  };
  $('source-content').innerHTML = '<div class="source-meta">产品：' + esc(result.task?.product)
    + '<br>资料来源：' + esc(result.kbName || sourceLabel(result)) + '（' + esc(sourceLabel(result)) + '）'
    + '<br>写作方式：' + esc(/模型|llm|智能/i.test(result.generationEngine || '') ? '智能写作' : '基础写作')
    + '<br>发布前请核对配置、图片及信息时效。</div>'
    + '<h3>文案使用的产品信息</h3>'
    + (facts.length ? facts.map(fact => '<div class="source-item"><p class="source-quote">' + esc(fact.quote || fact.text)
      + '</p><p>' + esc(fact.sourceTitle || '产品资料') + '</p><p class="source-detail">参考编号：'
      + esc(fact.id) + ' · ' + esc(fact.model || result.task?.product) + '</p>' + sourceLink(fact.sourceUrl) + '</div>').join('') : '<p>这份草稿没有可引用的产品信息。</p>')
    + '<h3>图片出处</h3>' + (images.length ? images.map(image => '<div class="source-item"><p>' + esc(image.description || '产品配图')
      + '</p><p>' + esc(image.sourceTitle || result.kbName || sourceLabel(result)) + '</p><p class="source-detail">'
      + esc(image.filename || image.id) + '</p>' + sourceLink(image.sourceUrl) + '</div>').join('') : '<p>尚未找到符合要求的产品图片。</p>')
    + ((result.audit?.unknowns || []).length ? '<h3>发布前还要确认</h3>' + result.audit.unknowns.map(item => '<p>' + esc(item) + '</p>').join('') : '');
}
function renderNotice() {
  const notice = $('result-notice');
  if (!state.notice) { notice.hidden = true; notice.innerHTML = ''; return; }
  notice.hidden = false;
  notice.className = 'notice' + (state.notice.error ? ' error' : state.notice.success ? ' success' : '');
  const items = state.notice.items || [];
  const candidates = state.notice.candidates || [];
  notice.innerHTML = '<strong>' + esc(state.notice.title) + '</strong>'
    + (state.notice.message ? '<p>' + esc(state.notice.message) + '</p>' : '')
    + (items.length ? '<ul>' + items.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '')
    + (candidates.length ? '<div class="candidates">' + candidates.map(candidate => {
      const name = typeof candidate === 'string' ? candidate : candidate.name || candidate.model || candidate.product || '';
      const reason = typeof candidate === 'object' ? (candidate.reason || candidate.reasons || '') : '';
      const highlights = typeof candidate === 'object' && Array.isArray(candidate.highlights) ? candidate.highlights : [];
      return '<div class="candidate-option"><button class="button secondary" type="button" data-candidate="' + esc(name) + '">' + esc(name) + '</button>'
        + (reason ? '<p class="candidate-reason"><strong>选型依据：</strong>' + esc(reason) + '</p>' : '')
        + (highlights.length ? '<ul class="candidate-highlights">' + highlights.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '') + '</div>';
    }).join('') + '</div>' : '');
  notice.querySelectorAll('[data-candidate]').forEach(button => button.addEventListener('click', () => {
    $('product').value = button.dataset.candidate;
    $('product').removeAttribute('aria-invalid');
    $('product-error').hidden = true;
    $('generate').focus();
    toast('已选择具体型号，原始需求已保留；点击「生成文案」继续。');
  }));
}
function renderVersions() {
  $('version-control').hidden = state.versions.length < 1;
  $('version-select').innerHTML = state.versions.map(version => '<option value="' + version.id + '">第 ' + version.number
    + ' 版 · ' + esc(version.platform.replace('门店', '')) + '</option>').join('');
  if (state.selectedVersion) $('version-select').value = state.selectedVersion;
}
function render() {
  const result = state.result;
  $('draft-content').hidden = !result;
  $('empty-state').hidden = Boolean(result) || state.busy;
  $('export-audit').disabled = !result;
  renderNotice();
  renderVersions();
  if (!result) {
    $('draft-state').textContent = state.notice ? '需要补充' : '等待你的想法';
    $('draft-state').className = 'draft-state';
    return;
  }
  const incomplete = resultStatus(result) === 'incomplete';
  $('draft-state').textContent = state.stale ? '上一版' : incomplete ? '待完善的草稿' : '已成稿';
  $('draft-state').className = 'draft-state ' + (state.stale ? 'stale' : incomplete ? 'draft' : 'ready');
  $('article-platform').textContent = result.task?.platform?.replace('门店朋友圈', '朋友圈') || '图文';
  $('article-source').textContent = sourceLabel(result);
  $('copy').textContent = incomplete ? '复制草稿' : '复制文案';
  $('export-markdown').textContent = incomplete ? '导出草稿' : '导出';
  renderArticle(result);
  renderSources(result);
  $('diagnostic-output').textContent = JSON.stringify({
    status: resultStatus(result), mode: sourceMode(result), engine: result.generationEngine,
    generationNotice: result.generationNotice, audit: result.audit
  }, null, 2);
}
function resultNotice(result) {
  const explanation = [result.inputUnderstanding?.notice, result.generationNotice?.message].filter(Boolean).join(' ');
  if (resultStatus(result) === 'incomplete') return { title: '草稿写好了，还有些内容需要补齐',
    message: ['你可以先阅读、继续修改或导出草稿，确认缺失项后再发布。', explanation].filter(Boolean).join(' '), items: missingNotes(result) };
  if (explanation) return { title: '写稿说明', message: explanation };
  return null;
}
function compactPrevious(result) {
  return { task: safeTask(result.task), copy: { blocks: articleBlocks(result).map(block => ({
    id: block.id, type: block.type, ...(block.text !== undefined ? { text: block.text } : {}),
    ...(block.imageId ? { imageId: block.imageId } : {}), factRefs: Array.isArray(block.factRefs) ? [...block.factRefs] : [],
    ...(block.level ? { level: block.level } : {}), ...(block.role ? { role: block.role } : {})
  })) } };
}
async function generate(revisionInstruction) {
  if (state.busy) return;
  clearFieldErrors();
  const task = getTask();
  if (!validateTask(task)) return;
  const isRevision = typeof revisionInstruction === 'string';
  if (isRevision && (!state.result || task.product !== state.result.task?.product)) {
    $('revision-error').textContent = '产品已更换，请先生成这款产品的文案，再继续修改。';
    $('revision-error').hidden = false;
    $('generate').focus();
    return;
  }
  const payload = { ...task };
  // Untouched form defaults must not override a free-form scene or publishing intent.
  if (task.request && !task.product && !state.parsedTask) {
    for (const key of ['scene', 'stage', 'platform', 'objective']) {
      if (!state.explicitFields.has(key)) delete payload[key];
    }
  }
  if (isRevision) {
    if (!revisionInstruction.trim()) { $('revision-input').focus(); return; }
    payload.instructions = revisionInstruction.trim();
    payload.previousResult = compactPrevious(state.result);
  } else if (state.result && task.product === state.result.task?.product && task.platform !== state.result.task?.platform) {
    payload.previousResult = compactPrevious(state.result);
  }
  state.notice = null;
  renderNotice();
  setBusy(true, isRevision);
  try {
    const result = await api('/api/generate', payload);
    const status = resultStatus(result);
    if ((status === 'ok' || status === 'incomplete') && result.copy) {
      const previousProduct = state.result?.task?.product;
      result.task = { ...safeTask(task), ...safeTask(result.task), request: task.request, mode: sourceMode({ ...result, task }) };
      state.parsedTask = null;
      if (previousProduct && previousProduct !== result.task.product) { state.versions = []; state.versionCounter = 0; }
      state.result = result;
      state.stale = false;
      state.notice = resultNotice(result);
      const number = ++state.versionCounter;
      const version = { id: String(number), number, result, task: { ...result.task }, platform: result.task.platform };
      state.versions.unshift(version);
      state.versions = state.versions.slice(0, 5);
      state.selectedVersion = version.id;
      fillTask(result.task, false);
      if (isRevision) $('revision-input').value = '';
      announce(status === 'incomplete' ? '草稿已生成，还有内容需要确认。' : isRevision ? '修改完成，新版本已保存。' : '文案已生成，可以阅读、修改或复制。');
    } else {
      state.stale = Boolean(state.result);
      const questions = (result.questions || []).map(question => typeof question === 'string' ? question : question.message || '').filter(Boolean);
      const auditMessages = (result.audit?.issues || []).map(issue => issue.message).filter(Boolean);
      // Parsed values are task preferences, never product evidence or an automatic model selection.
      state.parsedTask = result.parsedTask && typeof result.parsedTask === 'object'
        ? Object.fromEntries(TASK_FIELDS.filter(key => !['mode', 'product', 'request'].includes(key))
          .filter(key => typeof result.parsedTask[key] === 'string' && result.parsedTask[key].trim())
          .map(key => [key, result.parsedTask[key]])) : null;
      if (state.parsedTask) fillTask(state.parsedTask, false);
      const candidates = Array.isArray(result.recommendations) && result.recommendations.length
        ? result.recommendations : Array.isArray(result.candidates) ? result.candidates : [];
      state.notice = {
        title: status === 'need_info' ? (candidates.length ? '根据你的需求，先选一个具体型号' : '再确认一下，就能继续写稿') : '这次还没能生成成稿',
        message: [result.inputUnderstanding?.notice, result.error, state.result ? '下方保留的是上一版，这次没有生成新的文案。' : '调整需求后，可以再试一次。'].filter(Boolean).join(' '),
        items: [...new Set([...questions, ...auditMessages])],
        candidates, error: status !== 'need_info'
      };
      announce(state.notice.title);
    }
  } catch (error) {
    state.stale = Boolean(state.result);
    state.notice = { title: error.code === 'SERVICE_UNREACHABLE' ? '写稿服务暂时未连接' : '这次生成没有完成', message: error.message
      + (state.result ? ' 下方保留的是上一版，你的输入也已保留。' : ' 你的输入已保留，可以稍后重试。'), error: true };
    announce(state.notice.title);
  } finally {
    setBusy(false);
    render();
    const target = state.notice && (!state.result || state.stale) ? $('result-notice') : $('article');
    target.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 800px)').matches || state.notice) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
function plainArticle(result) {
  return draftPrefix(result) + articleBlocks(result).filter(block => block.type !== 'image').map(block => String(block.text || '')
    .replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1')).filter(Boolean).join('\n\n');
}
function markdownArticle(result) {
  const usedFacts = new Set();
  const imageMap = new Map((result.images || []).map(image => [image.id, image]));
  const body = articleBlocks(result).map(block => {
    if (block.type === 'image') {
      const image = imageMap.get(block.imageId);
      if (!image) return '';
      const url = imageUrl(image, result);
      const absolute = url ? new URL(url, window.location.href).href : '';
      const caption = (image.description || '产品配图').replace(/[\[\]\n]/g, '');
      return (absolute ? '![' + caption + '](' + absolute + ')' : '［图片待确认］')
        + '\n\n*图片来源：' + (image.sourceTitle || result.kbName || sourceLabel(result)) + '*';
    }
    const refs = (block.factRefs || []).map(id => { usedFacts.add(id); return '[^' + id + ']'; }).join('');
    return (block.type === 'heading' ? '#'.repeat(Math.min(3, Math.max(1, Number(block.level) || 2))) + ' ' : '')
      + (block.text || '') + refs;
  }).filter(Boolean).join('\n\n');
  const citations = (result.facts || []).filter(fact => usedFacts.has(fact.id)).map(fact => '[^' + fact.id + ']: '
    + (fact.sourceTitle || '产品资料') + '；适用型号：' + (fact.model || result.task.product) + '。'
    + (fact.quote || fact.text || '') + (fact.sourceUrl ? ' [原始资料](' + fact.sourceUrl + ')' : '')).join('\n\n');
  return draftPrefix(result) + body + '\n\n---\n\n资料来源：' + sourceLabel(result) + ' · ' + (result.kbName || '产品知识库')
    + '\n\n产品：' + result.task.product + '\n\n本地图片访问链接依赖 PC Studio 服务运行，建议下载图片后与文案一起保存。'
    + (citations ? '\n\n' + citations : '') + '\n';
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyArticle() {
  if (!state.result) return;
  const text = plainArticle(state.result);
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) throw new Error('copy');
    }
    toast(resultStatus(state.result) === 'incomplete' ? '草稿已复制，包含待确认标记。' : '文案已复制，可以粘贴使用。');
  } catch { toast('浏览器暂不允许复制，可以先导出文案。'); }
}
function restoreVersion(id) {
  const version = state.versions.find(item => item.id === id);
  if (!version) return;
  state.result = version.result;
  state.selectedVersion = version.id;
  state.stale = false;
  state.notice = resultNotice(version.result);
  fillTask(version.task);
  render();
  toast('已恢复第 ' + version.number + ' 版及对应需求。');
}
function openSettings() {
  $('settings-dialog').showModal();
  $('close-settings').focus();
}
function closeSettings() { $('settings-dialog').close(); $('open-settings').focus(); }
async function init() {
  $('generate').disabled = true;
  try {
    const [health, options] = await Promise.all([api('/api/health'), api('/api/options')]);
    state.health = health;
    state.options = options;
    $('input-understanding').textContent = options.inputUnderstanding?.notice || '可直接描述需求，先获取有知识库依据的型号推荐。';
    $('model-list').innerHTML = (options.models || []).map(model => '<option value="' + esc(model.name) + '"></option>').join('');
    for (const [id, values] of [['scene', options.scenes], ['platform', options.platforms], ['stage', options.stages]]) {
      if (!values?.length) continue;
      $(id).replaceChildren(...values.map(value => new Option(value === '门店朋友圈' ? '朋友圈' : value, value)));
    }
    $('product').value = '';
    fillTask({ mode: options.defaultMode === 'live' ? 'live' : 'local', request: '', audience: '', scene: '职场办公',
      stage: '了解阶段', objective: '引导到店体验', platform: '小红书', instructions: '' });
    $('server-status').textContent = '服务已连接 · ' + (health.localModelCount || 0) + ' 个本地型号 · '
      + (health.imaConfigured ? 'ima 已配置' : 'ima 尚未配置');
    $('connection-result').textContent = health.imaConfigured ? 'ima 已配置，可检查连接是否正常。' : 'ima 尚未配置。使用本地资料可以正常写稿。';
  } catch (error) {
    $('source-badge').textContent = state.serviceUnreachable ? '服务未连接 · 可重试' : '服务未连接';
    $('source-badge').classList.add('offline');
    $('server-status').textContent = error.message;
    state.notice = { title: '暂时无法连接写稿服务', message: '请确认服务已启动，再刷新页面。' + error.message, error: true };
    renderNotice();
    announce('无法连接写稿服务，请确认服务已启动。');
  } finally { $('generate').disabled = false; }
}

$('task-form').addEventListener('submit', event => { event.preventDefault(); generate(); });
$('revision-form').addEventListener('submit', event => { event.preventDefault(); generate($('revision-input').value); });
$('copy').addEventListener('click', copyArticle);
$('export-markdown').addEventListener('click', () => {
  if (!state.result) return;
  const draft = resultStatus(state.result) === 'incomplete';
  downloadFile('PC-Studio-' + state.result.task.platform + (draft ? '-草稿' : '') + '.md', markdownArticle(state.result), 'text/markdown;charset=utf-8');
  toast(draft ? '草稿已导出，缺失项已标记。' : '文案和图片链接已导出。');
});
$('export-audit').addEventListener('click', () => {
  if (state.result) downloadFile('PC-Studio-核验记录.json', JSON.stringify(state.result, null, 2), 'application/json;charset=utf-8');
});
$('version-select').addEventListener('change', event => restoreVersion(event.target.value));
$('open-settings').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('settings-dialog').addEventListener('cancel', () => { setTimeout(() => $('open-settings').focus(), 0); });
$('settings-dialog').addEventListener('click', event => {
  const rect = $('settings-dialog').getBoundingClientRect();
  if (event.target === $('settings-dialog') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeSettings();
});
$('mode').addEventListener('change', () => { updateMode(); toast('资料来源已设置，将用于下一次生成。'); });
$('check-ima').addEventListener('click', async () => {
  $('check-ima').disabled = true;
  $('connection-result').textContent = '正在检查连接，请稍候…';
  try {
    const result = await api('/api/ima-check');
    $('connection-result').textContent = result.connected ? '连接正常，可以使用 ima 在线资料。' : result.reason || 'ima 暂时无法连接，请检查配置后重试。';
  } catch (error) { $('connection-result').textContent = error.message; }
  finally { $('check-ima').disabled = false; }
});
for (const id of ['scene', 'stage', 'objective', 'platform', 'audience']) $(id).addEventListener('input', () => {
  state.explicitFields.add(id);
  updateRequirements();
});
$('request').addEventListener('input', () => {
  state.parsedTask = null;
  state.explicitFields.clear();
  $('product').value = '';
  $('audience').value = '';
});
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
  state.parsedTask = null;
  state.explicitFields.clear();
  $('product').value = '';
  fillTask(PRESETS[button.dataset.preset], false);
  for (const key of ['scene', 'stage', 'platform', 'objective']) state.explicitFields.add(key);
  document.querySelectorAll('[data-preset]').forEach(item => {
    item.classList.toggle('is-active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  toast('需求已填好，你可以继续调整，再生成文案。');
}));
document.querySelectorAll('[data-audience]').forEach(button => button.addEventListener('click', () => {
  $('audience').value = button.dataset.audience;
  $('audience').removeAttribute('aria-invalid');
  $('audience-error').hidden = true;
  updateRequirements();
}));
document.querySelectorAll('[data-revision]').forEach(button => button.addEventListener('click', () => generate(button.dataset.revision)));
init();
