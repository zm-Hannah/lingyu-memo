(() => {
  const grid = document.querySelector('#notebookGrid');
  const count = document.querySelector('#notebookCount');
  const search = document.querySelector('#notebookSearch');
  if (!grid) return;

  const source = typeof notebooks !== 'undefined' ? notebooks : [];

  const render = (query = '') => {
    const q = query.trim().toLowerCase();
    const list = source.filter(n =>
      !q || [n.title, n.chineseTitle, n.description, ...(n.tags || [])]
        .join(' ').toLowerCase().includes(q)
    );
    if (count) count.textContent = String(list.length).padStart(2, '0');
    grid.innerHTML = list.map(n => `
      <a class="notebook-card ${n.accent || ''}" href="${n.href}">
        <div class="notebook-cover">
          <span class="notebook-number">${n.number}</span>
          <span class="notebook-stamp">${n.status}</span>
          <strong>${n.title}</strong>
          <span class="notebook-symbol">✦</span>
        </div>
        <div class="notebook-info">
          <div class="notebook-info-top"><span>${n.chineseTitle || ''}</span><span>${n.number}</span></div>
          <p>${n.description}</p>
          <div class="notebook-tags">${(n.tags || []).map(t => `<span>${t}</span>`).join('')}</div>
        </div>
      </a>`).join('');
  };

  render();
  search?.addEventListener('input', e => render(e.target.value));
  document.querySelector('#exportNotes')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(source, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lingyu-memo-notebooks.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
