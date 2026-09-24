import katex from 'katex';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function children(element: Element): Element[] {
  return Array.from(element.children);
}

function group(element: Element): string {
  return children(element).map(toOmml).join('');
}

function argument(element: Element | undefined): string {
  return element ? toOmml(element) : '';
}

function run(element: Element): string {
  const text = escapeXml(element.textContent || '');
  const normal = element.localName === 'mtext' || element.localName === 'mn' || element.localName === 'mo'
    || element.getAttribute('mathvariant') === 'normal';
  return `<m:r>${normal ? '<m:rPr><m:nor/></m:rPr>' : ''}<m:t xml:space="preserve">${text}</m:t></m:r>`;
}

function script(kind: 'sSub' | 'sSup' | 'sSubSup', parts: Element[]): string {
  const base = `<m:e>${argument(parts[0])}</m:e>`;
  const sub = kind !== 'sSup' ? `<m:sub>${argument(parts[1])}</m:sub>` : '';
  const sup = kind !== 'sSub' ? `<m:sup>${argument(parts[kind === 'sSubSup' ? 2 : 1])}</m:sup>` : '';
  return `<m:${kind}>${base}${sub}${sup}</m:${kind}>`;
}

function limit(kind: 'limLow' | 'limUpp', base: string, value: string): string {
  return `<m:${kind}><m:e>${base}</m:e><m:lim>${value}</m:lim></m:${kind}>`;
}

function toOmml(element: Element): string {
  const parts = children(element);
  switch (element.localName) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'semantics':
      return group(element);
    case 'annotation':
    case 'annotation-xml':
      return '';
    case 'mi':
    case 'mn':
    case 'mo':
    case 'mtext':
    case 'ms':
      return run(element);
    case 'mspace':
      return '<m:r><m:t xml:space="preserve"> </m:t></m:r>';
    case 'mfrac': {
      const noBar = element.getAttribute('linethickness') === '0px'
        || element.getAttribute('linethickness') === '0';
      return `<m:f><m:fPr><m:type m:val="${noBar ? 'noBar' : 'bar'}"/></m:fPr><m:num>${argument(parts[0])}</m:num><m:den>${argument(parts[1])}</m:den></m:f>`;
    }
    case 'msup':
      return script('sSup', parts);
    case 'msub':
      return script('sSub', parts);
    case 'msubsup':
      return script('sSubSup', parts);
    case 'msqrt':
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${group(element)}</m:e></m:rad>`;
    case 'mroot':
      return `<m:rad><m:deg>${argument(parts[1])}</m:deg><m:e>${argument(parts[0])}</m:e></m:rad>`;
    case 'munder':
      return limit('limLow', argument(parts[0]), argument(parts[1]));
    case 'mover': {
      if (element.getAttribute('accent') === 'true') {
        const mark = escapeXml(parts[1]?.textContent || '¯');
        return `<m:acc><m:accPr><m:chr m:val="${mark}"/></m:accPr><m:e>${argument(parts[0])}</m:e></m:acc>`;
      }
      return limit('limUpp', argument(parts[0]), argument(parts[1]));
    }
    case 'munderover':
      return limit('limUpp', limit('limLow', argument(parts[0]), argument(parts[1])), argument(parts[2]));
    case 'mtable':
      return `<m:m>${parts.map(toOmml).join('')}</m:m>`;
    case 'mtr':
      return `<m:mr>${parts.map(toOmml).join('')}</m:mr>`;
    case 'mtd':
      return `<m:e>${group(element)}</m:e>`;
    case 'mfenced': {
      const open = escapeXml(element.getAttribute('open') ?? '(');
      const close = escapeXml(element.getAttribute('close') ?? ')');
      return `<m:d><m:dPr><m:begChr m:val="${open}"/><m:endChr m:val="${close}"/></m:dPr><m:e>${group(element)}</m:e></m:d>`;
    }
    case 'mphantom':
      return `<m:phant><m:e>${group(element)}</m:e></m:phant>`;
    default:
      return group(element);
  }
}

export function renderWordEquations(formulas: string[]): Record<string, string> {
  const equations: Record<string, string> = {};
  for (const formula of formulas) {
    const markup = katex.renderToString(formula, {
      output: 'mathml',
      throwOnError: true,
      strict: 'ignore',
    });
    const math = new DOMParser().parseFromString(markup, 'text/html').querySelector('math');
    if (!math) throw new Error('Formula could not be converted for Word export');
    equations[formula] = `<m:oMath>${toOmml(math)}</m:oMath>`;
  }
  return equations;
}
