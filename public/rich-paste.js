(function () {
  if (!globalThis.TurndownService || !globalThis.turndownPluginGfm || !globalThis.DOMPurify) {
    throw new Error('Rich text conversion libraries failed to load');
  }

  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    headingStyle: 'atx',
    strongDelimiter: '**'
  });
  service.use(turndownPluginGfm.gfm);
  const richElementPattern = /<(?:h[1-6]|p|div|section|article|span|strong|b|em|i|u|s|del|a|img|br|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|th|td|input|figure|figcaption)\b/i;

  globalThis.LinktranRichPaste = {
    convert(clipboardData) {
      const html = clipboardData?.getData('text/html') || '';
      if (!html || !richElementPattern.test(html)) return '';
      const cleanHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
      return service.turndown(cleanHtml).trim();
    }
  };
})();
