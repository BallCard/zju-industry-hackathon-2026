'use strict';
// UI-only fixtures: model names and explanations below are synthetic, not product claims.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function workbench() {
  const elements = new Map();
  class Element {
    constructor(id) {
      this.id = id; this.value = ''; this.hidden = false; this.disabled = false;
      this.tagName = /^(mode|platform|scene|stage|objective|version-select)$/.test(id) ? 'SELECT' : 'INPUT';
      this.options = []; this.selectedOptions = []; this.listeners = {}; this.dataset = {};
      this.attributes = {}; this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set innerHTML(value) { this.markup = value; }
    get innerHTML() { return this.markup || ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    focus() { this.focused = true; }
    scrollIntoView() {}
    add(option) { this.options.push(option); }
    replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
    querySelector() { return get(this.id + '-child'); }
    querySelectorAll(selector) {
      if (selector !== '[data-candidate]') return [];
      return [...this.innerHTML.matchAll(/data-candidate="([^"]*)"/g)].map((match, index) => {
        const button = get(this.id + '-candidate-' + index);
        button.dataset.candidate = match[1]; return button;
      });
    }
  }
  function get(id) { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); }
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) get(match[1]);
  const context = vm.createContext({ document: { getElementById: get, querySelectorAll: () => [] },
    window: { matchMedia: () => ({ matches: false }) }, Option: function(text, value) { this.textContent = text; this.value = value; },
    setTimeout: () => 1, clearTimeout() {}, console });
  // Avoid only the automatic network bootstrap; exercise the actual UI functions unchanged.
  vm.runInContext(script.replace(/\ninit\(\);\s*$/, '\n'), context);
  const run = code => vm.runInContext(code, context);
  run("fillTask({mode:'local',platform:'小红书',scene:'职场办公',stage:'了解阶段',objective:'引导到店体验'});");
  function reply(result) {
    context.reply = result;
    run('api = async (url, payload) => { globalThis.sent = payload; return globalThis.reply; };');
  }
  return { get, run, reply, context };
}
const product = '合成测试型号甲';
function draft(task = {}) {
  return { status: 'ok', mode: 'local', task: { product, audience: '测试读者', platform: '小红书', ...task },
    copy: { blocks: [{ id: 'title', type: 'heading', text: '合成测试标题' }] }, facts: [], images: [], audit: {} };
}

test('index exposes a primary free-form request and optional model with no fact promises', () => {
  assert.match(html, /<textarea id="request" name="request"/);
  assert.match(html, /已有型号（可选）/);
  assert.match(html, /产品事实仍需知识库核验/);
  assert.ok(html.indexOf('id="request"') < html.indexOf('id="product"'));
});

test('init keeps product empty instead of implicitly selecting the first model', async () => {
  const ui = workbench();
  ui.reply({ models: [{ name: product }], scenes: ['职场办公'], platforms: ['小红书'] });
  await ui.run('init()');
  assert.equal(ui.get('product').value, '');
  assert.match(ui.get('model-list').innerHTML, new RegExp(product));
});

test('request alone submits; follow-up shows reasons and parsed fields; candidate keeps request', async () => {
  const ui = workbench();
  const request = '请帮测试读者按使用需求选电脑，不代表产品事实';
  ui.get('request').value = request;
  ui.reply({ status: 'need_info', questions: ['请确认具体型号'],
    inputUnderstanding: { method: 'local', notice: '模型未配置，使用本地需求解析。' },
    parsedTask: { audience: '测试读者', scene: '开学季', product: '不得自动选择', request: '不得改写原需求' },
    candidates: [], recommendations: [{ name: product, reason: '合成选型理由 <script>bad()</script>', highlights: ['合成资料依据'] }] });
  await ui.run('generate()');
  assert.equal(ui.context.sent.request, request);
  assert.equal(ui.context.sent.product, '');
  assert.equal(ui.context.sent.audience, '');
  assert.equal(ui.get('audience').value, '测试读者');
  assert.equal(ui.get('scene').value, '开学季');
  assert.equal(ui.get('request').value, request);
  assert.equal(ui.get('product').value, '');
  assert.match(ui.get('result-notice').innerHTML, /模型未配置/);
  assert.match(ui.get('result-notice').innerHTML, /合成选型理由 &lt;script&gt;/);
  assert.match(ui.get('result-notice').innerHTML, /合成资料依据/);
  ui.get('result-notice-candidate-0').listeners.click();
  assert.equal(ui.get('product').value, product);
  assert.equal(ui.get('request').value, request);
  ui.reply(draft({ request: '服务端改写不应覆盖原文' }));
  await ui.run('generate()');
  assert.equal(ui.context.sent.request, request);
  assert.equal(ui.context.sent.product, product);
  assert.equal(ui.context.sent.audience, '测试读者');
  assert.equal(ui.context.sent.scene, '开学季');
  assert.equal(ui.get('request').value, request);
  assert.equal(ui.run('state.versions.length'), 1);
});

test('empty form asks for request, while exact-model legacy flow and string candidates still work', async () => {
  const ui = workbench();
  assert.equal(ui.run('validateTask(getTask())'), false);
  assert.equal(ui.get('request').focused, true);
  ui.get('product').value = product;
  assert.equal(ui.run('validateTask(getTask())'), false);
  assert.equal(ui.get('audience-error').hidden, false);
  ui.get('audience').value = '测试读者';
  ui.reply({ status: 'need_info', candidates: [product], recommendations: [] });
  await ui.run('generate()');
  assert.match(ui.get('result-notice').innerHTML, new RegExp(product));
  ui.reply(draft());
  await ui.run('generate()');
  assert.equal(ui.run('state.result.task.product'), product);
  assert.equal(ui.get('draft-content').hidden, false);
});

test('revisions, platform changes and version restore retain original request and compact context', async () => {
  const ui = workbench();
  ui.get('request').value = '原始选型需求'; ui.get('product').value = product;
  ui.reply(draft({ omittedTopics: ['测试主题'], writingPreferences: { length: 'short' } }));
  await ui.run('generate()');
  ui.reply(draft());
  await ui.run("generate('换个标题')");
  assert.equal(ui.context.sent.instructions, '换个标题');
  assert.equal(ui.context.sent.request, '原始选型需求');
  assert.equal(ui.context.sent.previousResult.task.omittedTopics[0], '测试主题');
  assert.equal(ui.context.sent.previousResult.task.writingPreferences.length, 'short');
  assert.equal(ui.context.sent.previousResult.previousResult, undefined);
  ui.get('platform').value = '公众号';
  ui.reply(draft({ platform: '公众号' }));
  await ui.run('generate()');
  assert.equal(ui.context.sent.previousResult.task.product, product);
  ui.get('request').value = '临时新输入';
  ui.run("restoreVersion('1')");
  assert.equal(ui.get('request').value, '原始选型需求');
  ui.get('product').value = '合成测试型号乙';
  await ui.run("generate('短一点')");
  assert.equal(ui.get('revision-error').hidden, false);
});

test('local parsing/failure explanation remains visible with incomplete drafts and fallback notices', () => {
  const ui = workbench();
  const result = draft();
  result.status = 'incomplete';
  result.inputUnderstanding = { method: 'local', notice: '需求模型调用失败，已使用本地解析。' };
  result.generationNotice = { message: '写作模型不可用，已使用基础写作。' };
  ui.context.noticeResult = result;
  const notice = ui.run('resultNotice(noticeResult)');
  assert.match(notice.message, /需求模型调用失败/);
  assert.match(notice.message, /写作模型不可用/);
});
