function truncateText(value, maxTextLength) {
  const cleaned = value.replace(/\r\n?/g, '\n').trim();
  return {
    text: cleaned.slice(0, maxTextLength),
    wasTruncated: cleaned.length > maxTextLength,
  };
}

self.onmessage = async ({ data }) => {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: data.bytes });
    const parsed = truncateText(result?.value || '', data.maxTextLength);
    self.postMessage({ ok: true, ...parsed });
  } catch {
    self.postMessage({ ok: false });
  }
};
