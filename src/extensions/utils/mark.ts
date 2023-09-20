import { EditorState } from 'prosemirror-state';

export const markInputRegex = (tag:any) => new RegExp(`(<(${tag})((?: \\w+=".+?")+)?>([^<]+)</${tag}>)$`, 'gm');

export const extractMarkAttributesFromMatch = ([, , , attrsString]:any) => {
  const attrRegex = /(\w+)="(.+?)"/g;
  const attrs = {};

  let key;
  let value;

  do {
    [, key, value] = attrRegex.exec(attrsString) || [];
      // @ts-ignore
    if (key) attrs[key] = value;
  } while (key);

  return attrs;
};

  // @ts-ignore
export function findMarkPosition(state: EditorState, mark, from, to) {
  let markPos = { start: -1, end: -1 };

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (markPos.start > -1) {
      return false;
    }
    if (markPos.start === -1 && mark.isInSet(node.marks)) {
      markPos = {
        start: pos,
        end: pos + Math.max(node.textContent.length, 1),
      };
    }
  });

  return markPos;
}