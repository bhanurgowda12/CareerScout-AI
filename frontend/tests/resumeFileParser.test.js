import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_RESUME_UPLOAD_STATE,
  extractResumeText,
  MAX_RESUME_FILE_SIZE,
  MAX_RESUME_TEXT_LENGTH,
  ResumeFileParserError,
  resumeUploadReducer,
} from '../src/resumeFileParser.js';
import { compareJobRequirements } from '../src/jobMatchUtils.js';

function zipWithEntries(entries) {
  const encoder = new TextEncoder();
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;

  entries.forEach(({ name, content, uncompressedSize = content.length, flags = 0 }) => {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + contentBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, flags, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(contentBytes, 30 + nameBytes.length);
    localRecords.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, flags, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, uncompressedSize, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralRecords.push(central);
    localOffset += local.length;
  });

  const centralSize = centralRecords.reduce((size, record) => size + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  return new Uint8Array([...localRecords, ...centralRecords, end].flatMap((record) => [...record]));
}

function makeFile(name, type, content) {
  const blob = new Blob([content], { type });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

function pdfFile(content = '%PDF-1.7\nbody', name = 'resume.pdf', type = 'application/pdf') {
  return makeFile(name, type, content);
}

function docxFile(content = zipWithEntries([
  { name: '[Content_Types].xml', content: '<Types />' },
  { name: 'word/document.xml', content: '<document />' },
]), name = 'resume.docx', type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  return makeFile(name, type, content);
}

function mockPdfJs(pageText) {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: pageText.map((str) => ({ str })),
          }),
        }),
      }),
      destroy: async () => {},
    }),
  };
}

test('extracts readable text from a valid PDF locally', async () => {
  const result = await extractResumeText(pdfFile(), { pdfjs: mockPdfJs(['Python', 'and SQL']) });

  assert.deepEqual(result, { text: 'Python and SQL', wasTruncated: false });
});

test('large multi-page PDFs retain the existing text limit and stop extracting after the limit is exceeded', async () => {
  const file = pdfFile();
  let extractedPages = 0;
  const pdfjs = {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 12_001,
        getPage: async () => ({
          getTextContent: async () => {
            extractedPages += 1;
            return { items: [{ str: 'a' }] };
          },
        }),
      }),
      destroy: async () => {},
    }),
  };

  const result = await extractResumeText(file, { pdfjs });

  assert.equal(result.text, Array(6_001).fill('a').join('\n').slice(0, MAX_RESUME_TEXT_LENGTH));
  assert.equal(result.text.length, MAX_RESUME_TEXT_LENGTH);
  assert.equal(result.wasTruncated, true);
  assert.equal(extractedPages, 6_001);
});

test('large PDF text pages preserve extracted text while bounding subsequent page work', async () => {
  let extractedPages = 0;
  const pdfjs = {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 100,
        getPage: async () => ({
          getTextContent: async () => {
            extractedPages += 1;
            return { items: Array.from({ length: 20_000 }, () => ({ str: 'word' })) };
          },
        }),
      }),
      destroy: async () => {},
    }),
  };

  const result = await extractResumeText(pdfFile(), { pdfjs });

  assert.equal(result.text, Array(20_000).fill('word').join(' ').slice(0, MAX_RESUME_TEXT_LENGTH));
  assert.equal(result.wasTruncated, true);
  assert.equal(extractedPages, 1);
});

test('malformed PDF page text structures are reported as unreadable documents', async () => {
  const pdfjs = {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({ getTextContent: async () => ({ items: null }) }),
      }),
      destroy: async () => {},
    }),
  };

  await assert.rejects(
    extractResumeText(pdfFile(), { pdfjs }),
    (error) => error instanceof ResumeFileParserError && error.code === 'unreadable-pdf',
  );
});

test('extracts readable text from a valid DOCX locally', async () => {
  const result = await extractResumeText(docxFile(), {
    mammoth: { extractRawText: async () => ({ value: 'React developer experience' }) },
  });

  assert.deepEqual(result, { text: 'React developer experience', wasTruncated: false });
});

test('DOCX worker receives bytes and returns the same bounded extracted text', async () => {
  let workerMessage;
  let terminated = false;
  const workerFactory = () => ({
    postMessage(message, transfer) {
      workerMessage = { message, transfer };
      queueMicrotask(() => this.onmessage({
        data: { ok: true, text: 'React developer experience', wasTruncated: false },
      }));
    },
    terminate() { terminated = true; },
  });

  const result = await extractResumeText(docxFile(), { workerFactory });

  assert.deepEqual(result, { text: 'React developer experience', wasTruncated: false });
  assert.equal(workerMessage.message.maxTextLength, MAX_RESUME_TEXT_LENGTH);
  assert.equal(workerMessage.message.bytes instanceof ArrayBuffer, true);
  assert.deepEqual(workerMessage.transfer, [workerMessage.message.bytes]);
  assert.equal(terminated, true);
});

test('DOCX worker reports malformed documents without exposing parser errors', async () => {
  const workerFactory = () => ({
    postMessage() {
      queueMicrotask(() => this.onmessage({ data: { ok: false } }));
    },
    terminate() {},
  });

  await assert.rejects(
    extractResumeText(docxFile(), { workerFactory }),
    (error) => error instanceof ResumeFileParserError
      && error.code === 'unreadable-docx'
      && /corrupted|encrypted|valid Word document/i.test(error.message),
  );
});

test('canceling DOCX worker parsing terminates the worker and reports cancellation', async () => {
  const controller = new AbortController();
  let worker;
  let markWorkerStarted;
  const workerStarted = new Promise((resolve) => { markWorkerStarted = resolve; });
  const workerFactory = () => {
    worker = {
      postMessage() {},
      terminate() { this.terminated = true; },
    };
    markWorkerStarted();
    return worker;
  };

  const extraction = extractResumeText(docxFile(), {
    signal: controller.signal,
    workerFactory,
  });
  await workerStarted;
  controller.abort();

  await assert.rejects(
    extraction,
    (error) => error instanceof ResumeFileParserError && error.code === 'aborted',
  );
  assert.equal(worker.terminated, true);
});

test('rejects unsupported file extensions', async () => {
  await assert.rejects(
    extractResumeText(makeFile('resume.txt', 'text/plain', 'Python')),
    (error) => error instanceof ResumeFileParserError && error.code === 'unsupported-type',
  );
});

test('rejects files larger than the upload limit before reading them', async () => {
  const file = makeFile('resume.pdf', 'application/pdf', new Uint8Array(MAX_RESUME_FILE_SIZE + 1));
  file.arrayBuffer = () => { throw new Error('must not read oversized file'); };

  await assert.rejects(
    extractResumeText(file),
    (error) => error instanceof ResumeFileParserError && error.code === 'file-too-large',
  );
});

test('rejects corrupted and mislabeled signatures', async () => {
  await assert.rejects(
    extractResumeText(pdfFile('not a PDF')),
    (error) => error instanceof ResumeFileParserError && error.code === 'invalid-signature',
  );
  await assert.rejects(
    extractResumeText(docxFile('not a DOCX')),
    (error) => error instanceof ResumeFileParserError && error.code === 'invalid-signature',
  );
  await assert.rejects(
    extractResumeText(pdfFile('%PDF-1.7', 'resume.pdf', 'application/msword')),
    (error) => error instanceof ResumeFileParserError && error.code === 'mime-mismatch',
  );
  await assert.rejects(
    extractResumeText(docxFile(undefined, 'resume.docx', 'application/pdf')),
    (error) => error instanceof ResumeFileParserError && error.code === 'mime-mismatch',
  );
  const invalidPdfJs = {
    getDocument: () => ({
      promise: Promise.reject(new Error('private malformed PDF details')),
      destroy: async () => {},
    }),
  };
  await assert.rejects(
    extractResumeText(pdfFile(), { pdfjs: invalidPdfJs }),
    (error) => error instanceof ResumeFileParserError
      && error.code === 'unreadable-pdf'
      && !error.message.includes('private malformed PDF details'),
  );
});

test('reports corrupted DOCX files without exposing parser errors', async () => {
  const result = await extractResumeText(docxFile(), {
    mammoth: { extractRawText: async () => { throw new Error('secret file contents'); } },
  }).catch((error) => error);

  assert.equal(result.code, 'unreadable-docx');
  assert.match(result.message, /corrupted|encrypted|valid Word document/i);
  assert.doesNotMatch(result.message, /secret file contents/i);
});

test('rejects encrypted and oversized expanded DOCX archives before parsing', async () => {
  const encrypted = zipWithEntries([
    { name: '[Content_Types].xml', content: '<Types />', flags: 1 },
    { name: 'word/document.xml', content: '<document />' },
  ]);
  const expanded = docxFile(zipWithEntries([
    { name: '[Content_Types].xml', content: '<Types />' },
    { name: 'word/document.xml', content: 'x', uncompressedSize: 26 * 1024 * 1024 },
  ]));
  let parserCalls = 0;
  const mammoth = { extractRawText: async () => { parserCalls += 1; return { value: 'text' }; } };

  await assert.rejects(
    extractResumeText(docxFile(encrypted), { mammoth }),
    (error) => error instanceof ResumeFileParserError && error.code === 'encrypted-docx',
  );
  await assert.rejects(
    extractResumeText(expanded, { mammoth }),
    (error) => error instanceof ResumeFileParserError && error.code === 'docx-too-large',
  );
  assert.equal(parserCalls, 0);
});

test('reports empty DOCX documents and scanned PDFs clearly', async () => {
  await assert.rejects(
    extractResumeText(docxFile(), {
      mammoth: { extractRawText: async () => ({ value: ' \n ' }) },
    }),
    (error) => error instanceof ResumeFileParserError && error.code === 'no-readable-text',
  );
  await assert.rejects(
    extractResumeText(pdfFile(), { pdfjs: mockPdfJs([]) }),
    (error) => error instanceof ResumeFileParserError
      && error.code === 'no-readable-text'
      && /scanned|image-only/i.test(error.message),
  );
});

test('reports password-protected PDFs without exposing parser errors', async () => {
  const passwordError = Object.assign(new Error('private parser detail'), { name: 'PasswordException' });
  const pdfjs = { getDocument: () => ({ promise: Promise.reject(passwordError), destroy: async () => {} }) };

  await assert.rejects(
    extractResumeText(pdfFile(), { pdfjs }),
    (error) => error instanceof ResumeFileParserError
      && error.code === 'encrypted-pdf'
      && /password-protected|encrypted/i.test(error.message),
  );
});

test('truncates extracted content to the matching limit and reports truncation', async () => {
  const result = await extractResumeText(docxFile(), {
    mammoth: { extractRawText: async () => ({ value: `Python ${'x'.repeat(MAX_RESUME_TEXT_LENGTH)}` }) },
  });

  assert.equal(result.text.length, MAX_RESUME_TEXT_LENGTH);
  assert.equal(result.wasTruncated, true);
});

test('replacing and removing a selected file clears its previous extracted text', () => {
  const extracted = resumeUploadReducer(EMPTY_RESUME_UPLOAD_STATE, {
    type: 'start',
    fileName: 'first.pdf',
  });
  const completed = resumeUploadReducer(extracted, {
    type: 'success',
    fileName: 'first.pdf',
    text: 'Python',
    wasTruncated: false,
  });
  const replaced = resumeUploadReducer(completed, { type: 'start', fileName: 'second.docx' });
  const removed = resumeUploadReducer(replaced, { type: 'remove' });
  const removedExtracted = resumeUploadReducer(completed, { type: 'remove' });

  assert.equal(replaced.fileName, 'second.docx');
  assert.equal(replaced.text, '');
  assert.equal(replaced.isExtracting, true);
  assert.deepEqual(removed, EMPTY_RESUME_UPLOAD_STATE);
  assert.deepEqual(removedExtracted, EMPTY_RESUME_UPLOAD_STATE);
});

test('pasted and extracted versions of the same text use identical matching behavior', async () => {
  const resumeText = 'Built projects with Python and SQL.';
  const result = await extractResumeText(docxFile(), {
    mammoth: { extractRawText: async () => ({ value: resumeText }) },
  });
  const requirements = ['Python', 'SQL', 'React'];

  assert.deepEqual(
    compareJobRequirements(requirements, [result.text]),
    compareJobRequirements(requirements, [resumeText]),
  );
});
