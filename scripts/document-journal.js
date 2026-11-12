import { escapeHtml, markdownToHtml, MODULE_ID } from './person-journal.js';

export const buildDocumentPages = (documents, { labels, converter = null }) => {
  const seen = new Set();
  return documents.map((document) => {
    if (!document.id || seen.has(document.id)) throw new Error('Invalid or duplicate Atlas document ID');
    seen.add(document.id);
    const subtitle = document.subtitle
      ? `<p class="atlas-document-subtitle">${escapeHtml(document.subtitle)}</p>` : '';
    const author = document.ownerName
      ? `<p><strong>${escapeHtml(labels.author)}:</strong> ${escapeHtml(document.ownerName)}</p>` : '';
    const parameters = (document.parameters ?? []).map(([name, value]) =>
      `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    ).join('');
    const tags = (document.tags ?? []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');
    return {
      name: document.title,
      type: 'text',
      // Atlas adventurer IDs cannot be mapped to Foundry user IDs. The GM
      // explicitly shares each imported document through native page ownership.
      ownership: { default: 0 },
      text: {
        format: 1,
        content: `<article class="atlas-document">${subtitle}${author}${parameters ? `<dl class="atlas-document-parameters">${parameters}</dl>` : ''}<div class="atlas-person-description">${markdownToHtml(document.text ?? '', converter)}</div>${tags ? `<ul class="atlas-document-tags">${tags}</ul>` : ''}</article>`,
      },
      flags: { [MODULE_ID]: { part: 'document', documentId: document.id, subtitle: document.subtitle ?? '' } },
    };
  });
};
