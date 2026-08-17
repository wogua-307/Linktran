(function () {
  if (!globalThis.marked || !globalThis.DOMPurify) {
    throw new Error('Markdown libraries failed to load');
  }

  marked.setOptions({
    async: false,
    breaks: true,
    gfm: true
  });

  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  globalThis.LinktranMarkdown = {
    render(source) {
      return DOMPurify.sanitize(marked.parse(String(source || '')), {
        USE_PROFILES: { html: true }
      });
    }
  };
})();
