/**
 * Strip HTML from note content to avoid storing potentially unsafe markup.
 * Returns plain text for safe rendering across the app.
 */
export function sanitizeNoteContent(content) {
  if (typeof content !== 'string') {
    return '';
  }

  if (typeof DOMParser === 'undefined') {
    return content.replace(/<[^>]*>/g, '');
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');
  return doc.body?.textContent || '';
}
