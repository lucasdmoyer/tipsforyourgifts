import { parse } from 'yaml';

function normalizeSource(source) {
  if (Buffer.isBuffer(source)) return source.toString('utf8');
  return String(source ?? '');
}

export default function matter(source) {
  const raw = normalizeSource(source);
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    return { data: {}, content: raw };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && (line.trim() === '---' || line.trim() === '...')
  );

  if (closingIndex === -1) {
    throw new SyntaxError('Front matter is missing a closing delimiter.');
  }

  const data = parse(lines.slice(1, closingIndex).join('\n')) ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Front matter must parse to an object.');
  }

  return {
    data,
    content: lines.slice(closingIndex + 1).join(newline)
  };
}
