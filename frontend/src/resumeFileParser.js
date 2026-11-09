export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT_LENGTH = 12000;
const MAX_DOCX_UNCOMPRESSED_SIZE = 25 * 1024 * 1024;

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/octet-stream']);
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
]);

export class ResumeFileParserError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ResumeFileParserError';
    this.code = code;
  }
}

export const EMPTY_RESUME_UPLOAD_STATE = Object.freeze({
  fileName: '',
  text: '',
  isExtracting: false,
  error: '',
  wasTruncated: false,
});

export function resumeUploadReducer(state, action) {
  switch (action.type) {
    case 'start':
      return {
        ...EMPTY_RESUME_UPLOAD_STATE,
        fileName: action.fileName,
        isExtracting: true,
      };
    case 'success':
      if (!state.isExtracting || state.fileName !== action.fileName) return state;
      return {
        ...state,
        text: action.text,
        isExtracting: false,
        wasTruncated: action.wasTruncated,
      };
    case 'failure':
      if (!state.isExtracting || state.fileName !== action.fileName) return state;
      return {
        ...state,
        isExtracting: false,
        error: action.error,
      };
    case 'edit':
      return { ...state, text: action.text, error: '', wasTruncated: false };
    case 'remove':
      return EMPTY_RESUME_UPLOAD_STATE;
    default:
      return state;
  }
}

function parserError(message, code) {
  return new ResumeFileParserError(message, code);
}

function getFileFormat(file) {
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
    throw parserError('Choose a PDF or DOCX resume file.', 'invalid-file');
  }
  const lowerName = file.name.toLocaleLowerCase('en-US');
  const extension = lowerName.endsWith('.pdf') ? 'pdf' : lowerName.endsWith('.docx') ? 'docx' : '';
  if (!extension) {
    throw parserError('Unsupported file type. Choose a PDF or DOCX resume.', 'unsupported-type');
  }

  const mimeType = typeof file.type === 'string' ? file.type.trim().toLocaleLowerCase('en-US') : '';
  const allowedMimeTypes = extension === 'pdf' ? PDF_MIME_TYPES : DOCX_MIME_TYPES;
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw parserError('The selected file type does not match its filename. Choose a valid PDF or DOCX resume.', 'mime-mismatch');
  }
  return extension;
}

function hasPdfSignature(bytes) {
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  return header.includes('%PDF-');
}

function hasZipSignature(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (
      (bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08)
    );
}

function validateDocxArchive(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOfDirectoryMin = Math.max(0, bytes.length - 22 - 0xffff);
    let endOfDirectory = -1;
    for (let offset = bytes.length - 22; offset >= endOfDirectoryMin; offset -= 1) {
      if (view.getUint32(offset, true) !== 0x06054b50) continue;
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === bytes.length) {
        endOfDirectory = offset;
        break;
      }
    }
    if (endOfDirectory < 0) {
      throw parserError('The DOCX could not be read. It may be corrupted or not a valid Word document.', 'unreadable-docx');
    }

    const diskNumber = view.getUint16(endOfDirectory + 4, true);
    const directoryDisk = view.getUint16(endOfDirectory + 6, true);
    const entriesOnDisk = view.getUint16(endOfDirectory + 8, true);
    const entryCount = view.getUint16(endOfDirectory + 10, true);
    const directorySize = view.getUint32(endOfDirectory + 12, true);
    const directoryOffset = view.getUint32(endOfDirectory + 16, true);
    const directoryEnd = directoryOffset + directorySize;
    if (
      diskNumber !== 0
      || directoryDisk !== 0
      || entriesOnDisk !== entryCount
      || entryCount === 0
      || entryCount === 0xffff
      || directoryEnd > endOfDirectory
    ) {
      throw parserError('The DOCX archive is corrupted or uses an unsupported format.', 'unreadable-docx');
    }

    let offset = directoryOffset;
    let uncompressedSize = 0;
    const entryNames = new Set();
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) {
        throw parserError('The DOCX archive is corrupted or uses an unsupported format.', 'unreadable-docx');
      }
      const flags = view.getUint16(offset + 8, true);
      const entrySize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
      if (entryEnd > directoryEnd) {
        throw parserError('The DOCX archive is corrupted or uses an unsupported format.', 'unreadable-docx');
      }
      if (flags & 1) {
        throw parserError('This DOCX is encrypted. Remove its protection and try again.', 'encrypted-docx');
      }
      if (entrySize === 0xffffffff) {
        throw parserError('This DOCX uses an unsupported ZIP64 archive format.', 'unsupported-docx-archive');
      }

      uncompressedSize += entrySize;
      if (uncompressedSize > MAX_DOCX_UNCOMPRESSED_SIZE) {
        throw parserError('This DOCX expands beyond the 25 MB processing limit. Use a smaller document.', 'docx-too-large');
      }
      entryNames.add(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
      offset = entryEnd;
    }

    if (offset !== directoryEnd || !entryNames.has('[Content_Types].xml') || !entryNames.has('word/document.xml')) {
      throw parserError('This file is not a valid DOCX Word document.', 'invalid-docx');
    }
}

function truncateText(value) {
  const cleaned = value.replace(/\r\n?/g, '\n').trim();
  return {
    text: cleaned.slice(0, MAX_RESUME_TEXT_LENGTH),
    wasTruncated: cleaned.length > MAX_RESUME_TEXT_LENGTH,
  };
}

function hasReadableText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw parserError('Resume text extraction was canceled.', 'aborted');
  }
}

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function createDocxWorker() {
  return new Worker(new URL('./resumeDocxWorker.js', import.meta.url), { type: 'module' });
}

function extractDocxInWorker(bytes, signal, workerFactory = createDocxWorker) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = workerFactory();
    } catch {
      reject(parserError('The DOCX reader could not be started. Refresh the page and try again.', 'docx-reader-unavailable'));
      return;
    }

    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const handleAbort = () => finish(
      reject,
      parserError('Resume text extraction was canceled.', 'aborted'),
    );

    worker.onmessage = ({ data }) => {
      if (data?.ok && typeof data.text === 'string' && typeof data.wasTruncated === 'boolean') {
        finish(resolve, { text: data.text, wasTruncated: data.wasTruncated });
      } else {
        finish(
          reject,
          parserError('The DOCX could not be read. It may be corrupted, encrypted, or not a valid Word document.', 'unreadable-docx'),
        );
      }
    };
    worker.onerror = () => finish(
      reject,
      parserError('The DOCX reader could not be loaded. Refresh the page and try again.', 'docx-reader-unavailable'),
    );
    signal?.addEventListener('abort', handleAbort, { once: true });

    try {
      worker.postMessage({ bytes: bytes.buffer, maxTextLength: MAX_RESUME_TEXT_LENGTH }, [bytes.buffer]);
    } catch {
      finish(
        reject,
        parserError('The DOCX could not be read. It may be corrupted, encrypted, or not a valid Word document.', 'unreadable-docx'),
      );
    }
  });
}

function getPdfError(error) {
  if (error?.name === 'PasswordException' || /password/i.test(error?.name || '')) {
    return parserError('This PDF is password-protected or encrypted. Remove its protection and try again.', 'encrypted-pdf');
  }
  return parserError('The PDF could not be read. It may be corrupted or password-protected.', 'unreadable-pdf');
}

async function extractPdfText(bytes, pdfjs, signal) {
  let loadingTask;
  try {
    throwIfAborted(signal);
    loadingTask = pdfjs.getDocument({ data: bytes });
    const document = await loadingTask.promise;
    const pageText = [];
    let accumulatedLength = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageParts = [];
      for (const item of content.items) {
        if (typeof item?.str === 'string' && item.str) pageParts.push(item.str);
      }
      const text = pageParts.join(' ');
      if (pageNumber > 1) accumulatedLength += 1;
      accumulatedLength += text.length;
      pageText.push(text);
      if (accumulatedLength > MAX_RESUME_TEXT_LENGTH) break;
    }
    return pageText.join('\n');
  } catch (error) {
    if (error instanceof ResumeFileParserError) throw error;
    throw getPdfError(error);
  } finally {
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch (error) {
        throw getPdfError(error);
      }
    }
  }
}

export async function extractResumeText(file, options = {}) {
  const format = getFileFormat(file);
  if (file.size > MAX_RESUME_FILE_SIZE) {
    throw parserError('Resume files must be 5 MB or smaller.', 'file-too-large');
  }

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw parserError('The selected file could not be opened. Try choosing it again.', 'file-read-failed');
  }
  throwIfAborted(options.signal);

  if (format === 'pdf' && !hasPdfSignature(bytes)) {
    throw parserError('This file does not contain a valid PDF signature. Choose a valid PDF resume.', 'invalid-signature');
  }
  if (format === 'docx' && !hasZipSignature(bytes)) {
    const isEncryptedOfficeFile = bytes.length >= 8
      && bytes[0] === 0xd0
      && bytes[1] === 0xcf
      && bytes[2] === 0x11
      && bytes[3] === 0xe0
      && bytes[4] === 0xa1
      && bytes[5] === 0xb1
      && bytes[6] === 0x1a
      && bytes[7] === 0xe1;
    if (isEncryptedOfficeFile) {
      throw parserError('This DOCX appears to be encrypted. Remove its protection and try again.', 'encrypted-docx');
    }
    throw parserError('This file does not contain a valid DOCX signature. Choose a valid Word document.', 'invalid-signature');
  }
  if (format === 'docx') validateDocxArchive(bytes);

  let extractedText;
  if (format === 'pdf') {
    let pdfjs;
    try {
      pdfjs = options.pdfjs || await loadPdfJs();
    } catch {
      throw parserError('The PDF reader could not be loaded. Refresh the page and try again.', 'pdf-reader-unavailable');
    }
    extractedText = await extractPdfText(bytes, pdfjs, options.signal);
    if (!hasReadableText(extractedText)) {
      throw parserError(
        'No selectable text was found. This may be an image-only or scanned PDF; scanned resumes are not supported.',
        'no-readable-text',
      );
    }
  } else {
    let result;
    if (options.mammoth) {
      try {
        result = await options.mammoth.extractRawText({ arrayBuffer: bytes.buffer });
      } catch {
        throw parserError('The DOCX could not be read. It may be corrupted, encrypted, or not a valid Word document.', 'unreadable-docx');
      }
    } else if (typeof Worker === 'function' || options.workerFactory) {
      result = await extractDocxInWorker(bytes, options.signal, options.workerFactory);
    } else {
      throw parserError('The DOCX reader requires a browser with Web Worker support. Refresh or use a supported browser.', 'docx-reader-unavailable');
    }
    extractedText = typeof result?.text === 'string' ? result.text : result?.value;
    if (!hasReadableText(extractedText)) {
      throw parserError('No readable text was found in this DOCX resume.', 'no-readable-text');
    }
    if (typeof result?.wasTruncated === 'boolean') {
      throwIfAborted(options.signal);
      return { text: extractedText, wasTruncated: result.wasTruncated };
    }
  }

  throwIfAborted(options.signal);
  return truncateText(extractedText);
}
