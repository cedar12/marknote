/** Bounded, line-oriented comparison. Omitted ranges are explicit, never guessed edits. */
export interface TextDiffOptions {
  maxInputChars?: number;
  maxLines?: number;
  maxWork?: number;
  maxEditDistance?: number;
  maxRows?: number;
  maxLineLength?: number;
  context?: number;
}

export type TextDiffRow = {
  kind: 'equal' | 'remove' | 'add';
  text: string;
  localLine: number | null;
  diskLine: number | null;
  ending: 'LF' | 'CRLF' | 'CR' | 'EOF';
  shortened: boolean;
} | {
  kind: 'skip';
  reason: 'equal' | 'work' | 'input' | 'display';
  count: number;
  localCount: number;
  diskCount: number;
};

export interface TextDiffResult {
  rows: TextDiffRow[];
  removed: number;
  added: number;
  complete: boolean;
  limitedReason: 'input' | 'work' | null;
  hiddenRows: number;
  shortenedLines: number;
  localLines: number | null;
  diskLines: number | null;
}

interface Line { value: string; text: string; ending: 'LF' | 'CRLF' | 'CR' | 'EOF' }
type Operation = { kind: 'equal' | 'remove' | 'add'; local: number | null; disk: number | null } | {
  kind: 'skip'; localCount: number; diskCount: number;
};

const DEFAULTS = { maxInputChars: 2 * 1024 * 1024, maxLines: 25_000, maxWork: 350_000,
  maxEditDistance: 128, maxRows: 400, maxLineLength: 800, context: 3 };
function limit(value: number | undefined, fallback: number, minimum = 1): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(fallback * 8, Math.floor(value!))) : fallback;
}

function lines(text: string, maxChars: number, maxLines: number): { lines: Line[]; complete: boolean } {
  // Slice before searching: even a single 128-MiB line cannot cause an unbounded scan.
  const source = text.length > maxChars ? text.slice(0, maxChars) : text;
  const result: Line[] = [];
  const newline = /\r\n|\r|\n/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while (result.length < maxLines && (match = newline.exec(source))) {
    const end = match.index + match[0].length;
    result.push({ value: source.slice(start, end), text: source.slice(start, match.index),
      ending: match[0] === '\r\n' ? 'CRLF' : match[0] === '\r' ? 'CR' : 'LF' });
    start = end;
  }
  if (result.length < maxLines && start < source.length && source.length === text.length) {
    result.push({ value: source.slice(start), text: source.slice(start), ending: 'EOF' });
    start = source.length;
  }
  return { lines: result, complete: source.length === text.length && start === source.length };
}

export function compareText(localText: string, diskText: string, options: TextDiffOptions = {}): TextDiffResult {
  const maxChars = limit(options.maxInputChars, DEFAULTS.maxInputChars);
  const maxLines = limit(options.maxLines, DEFAULTS.maxLines);
  const maxRows = limit(options.maxRows, DEFAULTS.maxRows, 3);
  const maxLength = limit(options.maxLineLength, DEFAULTS.maxLineLength, 16);
  const context = limit(options.context, DEFAULTS.context, 0);
  const maxDistance = limit(options.maxEditDistance, DEFAULTS.maxEditDistance);
  const left = lines(localText, maxChars, maxLines), right = lines(diskText, maxChars, maxLines);
  const a = left.lines, b = right.lines;
  let remaining = limit(options.maxWork, DEFAULTS.maxWork);
  let workLimited = false;
  const operations: Operation[] = [];
  const equal = (x: number, y: number) => a[x].value === b[y].value;
  const charge = (count = 1) => (remaining -= count) >= 0;

  function myers(x0: number, x1: number, y0: number, y1: number): Operation[] | null {
    const n = x1 - x0, m = y1 - y0;
    const v = new Map<number, number>([[1, 0]]);
    const trace: Map<number, number>[] = [];
    for (let d = 0; d <= Math.min(n + m, maxDistance); d++) {
      trace.push(new Map(v));
      for (let k = -d; k <= d; k += 2) {
        if (!charge()) return null;
        let x = k === -d || (k !== d && (v.get(k - 1) ?? -Infinity) < (v.get(k + 1) ?? -Infinity))
          ? v.get(k + 1) ?? 0 : (v.get(k - 1) ?? 0) + 1;
        let y = x - k;
        while (x < n && y < m && equal(x0 + x, y0 + y)) {
          if (!charge()) return null;
          x++; y++;
        }
        v.set(k, x);
        if (x < n || y < m) continue;
        const result: Operation[] = [];
        for (let depth = trace.length - 1; depth >= 0; depth--) {
          const previous = trace[depth];
          const diagonal = x - y;
          const from = diagonal === -depth || (diagonal !== depth
            && (previous.get(diagonal - 1) ?? -Infinity) < (previous.get(diagonal + 1) ?? -Infinity))
            ? diagonal + 1 : diagonal - 1;
          const previousX = previous.get(from) ?? 0;
          const previousY = previousX - from;
          while (x > previousX && y > previousY) {
            result.push({ kind: 'equal', local: x0 + --x, disk: y0 + --y });
          }
          if (depth > 0) {
            if (x === previousX) result.push({ kind: 'add', local: null, disk: y0 + --y });
            else result.push({ kind: 'remove', local: x0 + --x, disk: null });
          }
        }
        return result.reverse();
      }
    }
    return null;
  }

  // Unique-line anchors keep distant edits independent. LIS preserves anchor order.
  function anchors(x0: number, x1: number, y0: number, y1: number): [number, number][] | null {
    if (!charge(x1 - x0 + y1 - y0)) return null;
    const positions = (values: Line[], start: number, end: number) => {
      const map = new Map<string, number>();
      for (let i = start; i < end; i++) map.set(values[i].value, map.has(values[i].value) ? -1 : i);
      return map;
    };
    const leftPositions = positions(a, x0, x1), rightPositions = positions(b, y0, y1);
    const candidates: [number, number][] = [];
    for (const [value, x] of leftPositions) {
      const y = rightPositions.get(value);
      if (x >= 0 && y !== undefined && y >= 0) candidates.push([x, y]);
    }
    const tails: number[] = [], previous: number[] = [];
    for (let i = 0; i < candidates.length; i++) {
      let low = 0, high = tails.length;
      while (low < high) {
        if (!charge()) return null;
        const middle = (low + high) >>> 1;
        if (candidates[tails[middle]][1] < candidates[i][1]) low = middle + 1;
        else high = middle;
      }
      previous[i] = low ? tails[low - 1] : -1;
      tails[low] = i;
    }
    const selected: [number, number][] = [];
    for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = previous[i]) selected.push(candidates[i]);
    return selected.reverse();
  }

  type Range = { x0: number; x1: number; y0: number; y1: number } | { equal: [number, number] };
  const stack: Range[] = [{ x0: 0, x1: a.length, y0: 0, y1: b.length }];
  while (stack.length) {
    const range = stack.pop()!;
    if ('equal' in range) { operations.push({ kind: 'equal', local: range.equal[0], disk: range.equal[1] }); continue; }
    let { x0, x1, y0, y1 } = range;
    while (x0 < x1 && y0 < y1 && charge() && equal(x0, y0)) {
      operations.push({ kind: 'equal', local: x0++, disk: y0++ });
    }
    let suffix = 0;
    while (x0 < x1 && y0 < y1 && charge() && equal(x1 - 1, y1 - 1)) { x1--; y1--; suffix++; }
    for (let i = suffix - 1; i >= 0; i--) stack.push({ equal: [x1 + i, y1 + i] });
    if (x0 === x1) { for (let y = y0; y < y1; y++) operations.push({ kind: 'add', local: null, disk: y }); continue; }
    if (y0 === y1) { for (let x = x0; x < x1; x++) operations.push({ kind: 'remove', local: x, disk: null }); continue; }
    const matches = remaining > 0 ? anchors(x0, x1, y0, y1) : null;
    if (matches?.length) {
      const ranges: Range[] = [];
      let x = x0, y = y0;
      for (const [anchorX, anchorY] of matches) {
        ranges.push({ x0: x, x1: anchorX, y0: y, y1: anchorY }, { equal: [anchorX, anchorY] });
        x = anchorX + 1; y = anchorY + 1;
      }
      ranges.push({ x0: x, x1, y0: y, y1 });
      for (let i = ranges.length - 1; i >= 0; i--) stack.push(ranges[i]);
    } else {
      const edits = matches === null ? null : myers(x0, x1, y0, y1);
      if (edits) for (const edit of edits) operations.push(edit);
      else { workLimited = true; operations.push({ kind: 'skip', localCount: x1 - x0, diskCount: y1 - y0 }); }
    }
  }

  let removed = 0, added = 0, shortenedLines = 0;
  const row = (operation: Exclude<Operation, { kind: 'skip' }>): TextDiffRow => {
    const value = operation.kind === 'add' ? b[operation.disk!] : a[operation.local!];
    const shortened = value.text.length > maxLength;
    if (shortened) shortenedLines++;
    // Both ends make shortening clear; the omitted middle is never rendered into the DOM.
    const text = shortened ? value.text.slice(0, Math.floor(maxLength / 2)) + ' … ' + value.text.slice(-Math.floor(maxLength / 2)) : value.text;
    return { kind: operation.kind, text, localLine: operation.local === null ? null : operation.local + 1,
      diskLine: operation.disk === null ? null : operation.disk + 1, ending: value.ending, shortened };
  };
  const rows: TextDiffRow[] = [];
  for (let i = 0; i < operations.length;) {
    const operation = operations[i];
    if (operation.kind === 'skip') {
      rows.push({ kind: 'skip', reason: 'work', count: 0, localCount: operation.localCount, diskCount: operation.diskCount }); i++; continue;
    }
    if (operation.kind !== 'equal') {
      operation.kind === 'remove' ? removed++ : added++;
      rows.push(row(operation)); i++; continue;
    }
    let end = i + 1;
    while (end < operations.length && operations[end].kind === 'equal') end++;
    const before = i > 0, after = end < operations.length;
    const head = before ? Math.min(context, end - i) : 0;
    const tail = after ? Math.min(context, end - i - head) : 0;
    for (let j = i; j < i + head; j++) rows.push(row(operations[j] as Exclude<Operation, { kind: 'skip' }>));
    const hidden = end - i - head - tail;
    if (hidden && (before || after)) rows.push({ kind: 'skip', reason: 'equal', count: hidden, localCount: hidden, diskCount: hidden });
    for (let j = end - tail; j < end; j++) rows.push(row(operations[j] as Exclude<Operation, { kind: 'skip' }>));
    i = end;
  }
  const inputLimited = !left.complete || !right.complete;
  if (inputLimited) rows.push({ kind: 'skip', reason: 'input', count: 0, localCount: 0, diskCount: 0 });
  let hiddenRows = 0;
  if (rows.length > maxRows) {
    const head = Math.floor((maxRows - 1) / 2), tail = maxRows - 1 - head;
    hiddenRows = rows.length - head - tail;
    rows.splice(head, hiddenRows, { kind: 'skip', reason: 'display', count: hiddenRows, localCount: 0, diskCount: 0 });
  }
  return { rows, removed, added, complete: !inputLimited && !workLimited,
    limitedReason: inputLimited ? 'input' : workLimited ? 'work' : null, hiddenRows, shortenedLines,
    localLines: left.complete ? a.length : null, diskLines: right.complete ? b.length : null };
}
