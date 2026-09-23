const STORAGE_KEY = 'lingyu-memo-state-v1';

const defaultState = () => ({ customNotebooks: [], notesBySlug: {}, curatedCards: {} });

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.customNotebooks)) {
      return { customNotebooks: saved.customNotebooks, notesBySlug: saved.notesBySlug || {}, curatedCards: saved.curatedCards || {} };
    }
  } catch (error) {
    console.warn('Could not load local notes.', error);
  }
  return defaultState();
};

let state = loadState();
let editingNoteId = null;

const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const slugFor = (title) => `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'notebook'}-${Date.now().toString(36)}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

const progressBar = document.querySelector('#progressBar');
const updateReadingProgress = () => {
  if (!progressBar) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0}%`;
};
window.addEventListener('scroll', updateReadingProgress, { passive: true });
updateReadingProgress();

const builtInNotebooks = () => (typeof notebooks !== 'undefined' ? notebooks : []);
const allNotebooks = () => [...builtInNotebooks(), ...state.customNotebooks];

const noteCount = (slug) => (state.notesBySlug[slug] || []).length;

const notebookCard = (notebook) => {
  const count = notebook.slug === 'hacks' ? 9 + noteCount('hacks') : noteCount(notebook.slug);
  const href = notebook.builtIn ? notebook.href : `notebook.html?slug=${encodeURIComponent(notebook.slug)}`;
  return `
    <a class="notebook-card ${notebook.accent || ''}" href="${href}">
      <div class="notebook-cover">
        <span class="notebook-number">${escapeHtml(notebook.number || 'NEW')}</span>
        <span class="notebook-stamp">${escapeHtml(notebook.status || 'My notebook')}</span>
        <strong>${escapeHtml(notebook.title)}</strong>
        <span class="notebook-symbol">♠</span>
      </div>
      <div class="notebook-info">
        <div class="notebook-info-top"><span>${escapeHtml(notebook.chineseTitle || 'Untitled series')}</span><span>↗</span></div>
        <p>${escapeHtml(notebook.description || '一部正在慢慢记录的剧集。')}</p>
        <div class="notebook-tags">${(notebook.tags || ['Words', 'Notes']).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}<span>${count} cards</span></div>
      </div>
    </a>`;
};

const renderCollection = (query = '') => {
  const notebookGrid = document.querySelector('#notebookGrid');
  if (!notebookGrid) return;
  const normalizedQuery = query.trim().toLowerCase();
  const matches = allNotebooks().filter((notebook) => {
    const haystack = [notebook.title, notebook.chineseTitle, notebook.description, ...(notebook.tags || [])].join(' ').toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const count = document.querySelector('#notebookCount');
  if (count) count.textContent = String(allNotebooks().length).padStart(2, '0');
  const emptySearch = document.querySelector('#emptySearch');
  if (emptySearch) emptySearch.hidden = matches.length > 0;
  notebookGrid.innerHTML = matches.map(notebookCard).join('') + `
    <button class="notebook-card add-notebook-card" type="button" data-open-modal>
      <span class="add-symbol">＋</span>
      <span class="section-kicker">NEXT NOTEBOOK</span>
      <strong>留一页给<br /><em>下一部剧。</em></strong>
      <span>点击这里，创建一本新的剧集笔记本。</span>
    </button>`;
  document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', openNotebookModal));
};

const modal = document.querySelector('#notebookModal');
const openNotebookModal = () => {
  if (!modal) return;
  modal.hidden = false;
  modal.querySelector('input[name="title"]')?.focus();
};
const closeNotebookModal = () => { if (modal) modal.hidden = true; };
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeNotebookModal));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNotebookModal(); });

const notebookForm = document.querySelector('#notebookForm');
notebookForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(notebookForm);
  const title = String(formData.get('title')).trim();
  if (!title) return;
  const createMode = String(event.submitter?.value || 'normal');
  const slug = slugFor(title);
  state.customNotebooks.unshift({
    number: String(allNotebooks().length + 1).padStart(2, '0'),
    slug,
    title,
    chineseTitle: String(formData.get('chineseTitle')).trim() || title,
    status: String(formData.get('status')),
    description: String(formData.get('description')).trim() || '一部正在慢慢记录的剧集。',
    tags: ['Words', 'Notes'],
    accent: String(formData.get('accent')),
    builtIn: false,
  });
  state.notesBySlug[slug] = [];
  saveState();
  notebookForm.reset();
  closeNotebookModal();
  renderCollection(document.querySelector('#notebookSearch')?.value || '');
  const importParam = createMode === 'import' ? '&import=1' : '';
  window.location.href = `notebook.html?slug=${encodeURIComponent(slug)}${importParam}`;
});

document.querySelector('#notebookSearch')?.addEventListener('input', (event) => renderCollection(event.target.value));

document.querySelector('#exportNotes')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lingyu-memo-backup.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector('#importNotes')?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.customNotebooks) || typeof imported.notesBySlug !== 'object') throw new Error('Invalid backup');
      state = { customNotebooks: imported.customNotebooks, notesBySlug: imported.notesBySlug, curatedCards: imported.curatedCards || {} };
      saveState();
      renderCollection(document.querySelector('#notebookSearch')?.value || '');
      window.alert('笔记已经导入。');
    } catch (error) {
      window.alert('这个备份文件无法读取。');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

const renderNoteCards = (notes, container) => {
  if (!container) return;
  if (!notes.length) {
    container.innerHTML = '<p class="notes-empty">还没有学习卡。先把看剧时捡到的第一句话写下来吧。</p>';
    return;
  }
  container.innerHTML = notes.map((note, index) => `
    <article class="learning-card">
      <div class="learning-card-top"><span>${escapeHtml(note.category || 'LANGUAGE NOTE')}</span><span>${String(index + 1).padStart(2, '0')}</span></div>
      <h3>${escapeHtml(note.term)}</h3>
      ${note.quote ? `<blockquote>${escapeHtml(note.quote)}</blockquote>` : ''}
      <p>${escapeHtml(note.explanation)}</p>
      ${note.reflection ? `<p class="learning-reflection">${escapeHtml(note.reflection)}</p>` : ''}
      <div class="learning-actions"><button type="button" data-edit-note="${note.id}">编辑</button><button type="button" data-delete-note="${note.id}">删除</button></div>
    </article>`).join('');
};

const bindCuratedCards = () => {
  const cards = document.querySelectorAll('[data-curated-card]');
  if (!cards.length) return;
  const resetButton = document.querySelector('[data-reset-curated]');
  const refreshResetButton = () => {
    if (resetButton) resetButton.hidden = Object.keys(state.curatedCards || {}).length === 0;
  };
  cards.forEach((card) => {
    const id = card.dataset.curatedCard;
    const saved = state.curatedCards?.[id];
    if (saved?.deleted) {
      card.hidden = true;
      return;
    }
    if (saved?.html) card.innerHTML = saved.html;
    card.querySelector('[data-curated-actions]')?.remove();
    const actions = document.createElement('div');
    actions.className = 'curated-card-actions';
    actions.dataset.curatedActions = 'true';
    actions.innerHTML = '<button type="button" data-curated-edit>编辑</button><button type="button" data-curated-delete>删除</button>';
    card.append(actions);
    const editButton = actions.querySelector('[data-curated-edit]');
    editButton.addEventListener('click', () => {
      if (card.isContentEditable) {
        const snapshot = card.cloneNode(true);
        snapshot.querySelector('[data-curated-actions]')?.remove();
        state.curatedCards[id] = { html: snapshot.innerHTML };
        saveState();
        card.contentEditable = 'false';
        card.classList.remove('is-editing');
        editButton.textContent = '编辑';
        refreshResetButton();
        return;
      }
      card.contentEditable = 'true';
      card.classList.add('is-editing');
      editButton.textContent = '保存修改';
      card.focus();
    });
    actions.querySelector('[data-curated-delete]').addEventListener('click', () => {
      if (!window.confirm('确定删除这张展示卡片吗？之后可以恢复原始卡片。')) return;
      state.curatedCards[id] = { deleted: true };
      saveState();
      card.hidden = true;
      refreshResetButton();
    });
  });
  resetButton?.addEventListener('click', () => {
    if (!window.confirm('恢复所有展示卡片的原始内容吗？')) return;
    delete state.curatedCards;
    state.curatedCards = {};
    saveState();
    window.location.reload();
  });
  refreshResetButton();
};

const aiMemoPrompt = `请把我下面提供的剧集学习笔记整理成严格 JSON。不要补充笔记中没有出现的事实，不要输出 Markdown 代码围栏，不要解释 JSON 以外的内容。

JSON 格式必须是：
{
  "cards": [
    {
      "term": "英文词语或表达",
      "category": "Words & Expressions / Cultural References / Quotes / My Notes",
      "quote": "原句或语境，没有就留空",
      "explanation": "中文解释和使用语境",
      "reflection": "个人感想，没有就留空"
    }
  ]
}

请合并重复内容，并尽量保留我原本的语气。现在开始整理以下笔记：`;

const parseAIMemo = (raw) => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  const cards = Array.isArray(parsed) ? parsed : parsed.cards;
  if (!Array.isArray(cards)) throw new Error('需要 cards 数组');
  const normalized = cards.map((card) => ({
    id: makeId(),
    term: String(card.term || '').trim(),
    category: String(card.category || 'LANGUAGE NOTE').trim(),
    quote: String(card.quote || '').trim(),
    explanation: String(card.explanation || '').trim(),
    reflection: String(card.reflection || '').trim(),
  })).filter((card) => card.term && card.explanation);
  if (!normalized.length) throw new Error('没有找到同时包含 term 和 explanation 的学习卡');
  return normalized;
};

const bindAIImport = (slug, refresh) => {
  const trigger = document.querySelector('[data-ai-import]');
  if (!trigger) return;
  const shell = document.createElement('div');
  shell.className = 'modal-shell';
  shell.hidden = true;
  shell.innerHTML = `
    <div class="modal-backdrop" data-ai-close></div>
    <section class="entry-modal ai-import-modal" role="dialog" aria-modal="true" aria-labelledby="aiImportTitle">
      <button class="modal-close" type="button" data-ai-close aria-label="关闭">×</button>
      <p class="section-kicker">✦ IMPORT FROM YOUR AI</p>
      <h2 id="aiImportTitle">把整理好的笔记<br /><em>变成学习卡。</em></h2>
      <p class="modal-intro">先点击“复制整理提示词”，发给你正在使用的 AI。让它输出 JSON 后，把结果粘贴到下面；网站会先预览，再一次性保存。</p>
      <div class="ai-prompt-actions"><button class="text-button" type="button" data-copy-ai-prompt>复制整理提示词 ↗</button><label class="text-button file-button" for="aiMemoFile">上传 JSON ↥</label><input id="aiMemoFile" type="file" accept=".json,application/json" hidden /></div>
      <textarea class="ai-import-input" data-ai-input rows="10" placeholder="把 AI 输出的 JSON 粘贴到这里……"></textarea>
      <p class="ai-import-status" data-ai-status>格式示例：{ "cards": [{ "term": "nuanced", "explanation": "有微妙层次" }] }</p>
      <div class="ai-preview" data-ai-preview hidden></div>
      <div class="form-actions"><button class="primary-button" type="button" data-preview-ai>预览学习卡 <span>↗</span></button><button class="primary-button" type="button" data-confirm-ai disabled>确认并保存</button></div>
    </section>`;
  document.body.append(shell);
  const input = shell.querySelector('[data-ai-input]');
  const status = shell.querySelector('[data-ai-status]');
  const preview = shell.querySelector('[data-ai-preview]');
  const confirm = shell.querySelector('[data-confirm-ai]');
  let draftCards = [];
  const close = () => { shell.hidden = true; };
  const open = () => { shell.hidden = false; input.focus(); };
  trigger.addEventListener('click', open);
  shell.querySelectorAll('[data-ai-close]').forEach((button) => button.addEventListener('click', close));
  shell.querySelector('[data-copy-ai-prompt]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(aiMemoPrompt);
    status.textContent = '提示词已复制。把它发给你的 AI，再把返回的 JSON 粘贴回来。';
  });
  shell.querySelector('#aiMemoFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { input.value = reader.result; status.textContent = '文件已载入，现在可以预览学习卡。'; };
    reader.readAsText(file);
  });
  shell.querySelector('[data-preview-ai]').addEventListener('click', () => {
    try {
      draftCards = parseAIMemo(input.value);
      preview.hidden = false;
      preview.innerHTML = `<p class="section-kicker">PREVIEW · ${draftCards.length} CARDS</p>${draftCards.map((card) => `<div class="ai-preview-card"><strong>${escapeHtml(card.term)}</strong><span>${escapeHtml(card.category)}</span><p>${escapeHtml(card.explanation)}</p></div>`).join('')}`;
      confirm.disabled = false;
      status.textContent = '请检查预览，确认后才会加入这本笔记本。';
    } catch (error) {
      draftCards = [];
      preview.hidden = true;
      confirm.disabled = true;
      status.textContent = `格式还不能读取：${error.message}。请先让 AI 严格只输出 JSON。`;
    }
  });
  confirm.addEventListener('click', () => {
    state.notesBySlug[slug] = [...draftCards, ...(state.notesBySlug[slug] || [])];
    saveState();
    refresh();
    renderCollection(document.querySelector('#notebookSearch')?.value || '');
    close();
  });
  return open;
};

const bindNoteForm = (form, slug, container) => {
  if (!form) return;
  const notes = () => state.notesBySlug[slug] || [];
  const refresh = () => renderNoteCards(notes(), container);
  refresh();
  const openAIImport = bindAIImport(slug, refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const note = {
      id: editingNoteId || makeId(),
      term: String(formData.get('term')).trim(),
      category: String(formData.get('category')).trim() || 'LANGUAGE NOTE',
      quote: String(formData.get('quote')).trim(),
      explanation: String(formData.get('explanation')).trim(),
      reflection: String(formData.get('reflection')).trim(),
    };
    if (!note.term || !note.explanation) return;
    const current = notes();
    const existingIndex = current.findIndex((item) => item.id === note.id);
    if (existingIndex >= 0) current[existingIndex] = note; else current.unshift(note);
    state.notesBySlug[slug] = current;
    saveState();
    editingNoteId = null;
    form.reset();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.innerHTML = '保存学习卡 <span>↗</span>';
    refresh();
    renderCollection(document.querySelector('#notebookSearch')?.value || '');
  });
  container?.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-note]');
    const deleteButton = event.target.closest('[data-delete-note]');
    if (editButton) {
      const note = notes().find((item) => item.id === editButton.dataset.editNote);
      if (!note) return;
      editingNoteId = note.id;
      Object.entries(note).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (field) field.value = value; });
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.innerHTML = '保存修改 <span>↗</span>';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (deleteButton && window.confirm('确定删除这张学习卡吗？')) {
      state.notesBySlug[slug] = notes().filter((item) => item.id !== deleteButton.dataset.deleteNote);
      saveState();
      refresh();
      renderCollection(document.querySelector('#notebookSearch')?.value || '');
    }
  });
  return openAIImport;
};

const noteForm = document.querySelector('#noteForm');
const personalNotesGrid = document.querySelector('#personalNotesGrid');
const personalSlug = document.body.dataset.personalSlug;
if (noteForm && personalSlug) bindNoteForm(noteForm, personalSlug, personalNotesGrid);

const detailRoot = document.querySelector('[data-notebook-detail]');
if (detailRoot) {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const notebook = state.customNotebooks.find((item) => item.slug === slug);
  if (!notebook) {
    detailRoot.innerHTML = '<div class="not-found"><p class="section-kicker">NOTEBOOK NOT FOUND</p><h1>这本笔记本还不存在。</h1><a class="back-top" href="index.html">← 回到集合首页</a></div>';
  } else {
    document.title = `${notebook.title} · 灵语 Memo`;
    document.querySelector('#detailNumber').textContent = notebook.number;
    document.querySelector('#detailStatus').textContent = notebook.status;
    document.querySelector('#detailTitle').textContent = notebook.title;
    document.querySelector('#detailChineseTitle').textContent = notebook.chineseTitle;
    document.querySelector('#detailDescription').textContent = notebook.description;
    const openAIImport = bindNoteForm(document.querySelector('#noteForm'), slug, document.querySelector('#personalNotesGrid'));
    if (params.get('import') === '1') setTimeout(() => openAIImport?.(), 0);
    document.querySelector('#deleteNotebook')?.addEventListener('click', () => {
      if (!window.confirm(`确定删除「${notebook.title}」吗？这会删除它的全部学习卡。`)) return;
      state.customNotebooks = state.customNotebooks.filter((item) => item.slug !== slug);
      delete state.notesBySlug[slug];
      saveState();
      window.location.href = 'index.html';
    });
  }
}

if (document.querySelector('#notebookGrid')) renderCollection();
bindCuratedCards();
