/** Convert Atlas paragraph markers without flattening inline HTML formatting. */
export const formatDropCapHtml = (html) => {
  if (!html.includes('{capitular}')) return html;
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const paragraph of document.querySelectorAll('p')) {
    if (paragraph.closest('pre, code')) continue;
    const first = paragraph.firstChild;
    if (first?.nodeType !== 3 || !/^\s*\{capitular\}\s+/.test(first.textContent)) continue;
    first.textContent = first.textContent.replace(/^\s*\{capitular\}\s+/, '');
    paragraph.classList.add('atlas-drop-cap');
  }
  return document.body.innerHTML;
};
