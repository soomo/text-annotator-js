import type { TextAnnotation, TextAnnotationTarget } from '@soomo/text-annotator';
import type { TEIAnnotation, TEIAnnotationTarget, TEIRangeSelector } from '../TEIAnnotation';
import { reanchor } from './utils';

/**
 * Helper: converts the given XPath string and DOM container element
 * to a DOM position (parent node + text offset).
 */
const xpathToDOMPosition = (path: string, container: Element) => {
  const offsetIdx = path.indexOf('::');

  // CETEIcean-specific: prefix all path elements with 'tei-'!
  const normalized = 
    path.substring(0, offsetIdx).replace(/\/([^[/]+)/g, (_, p1) => {
      return "/tei-" + p1.toLowerCase();
    }).replace(/xml:/g, '');

  const parentNode = document.evaluate('.' + normalized,
    container, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

  if (parentNode.firstChild.nodeType !== Node.TEXT_NODE)
    console.warn('XPath not pointing to text node', path);

  const node: Node = parentNode.firstChild;

  const offset = parseInt(path.substring(offsetIdx + 2));

  if (!(node instanceof Text) || offset > node.length) {
    return reanchor(node, parentNode, offset);
  } else {
    return { node, offset };
  }
}

/**
 * Computes the DOM Range corresponding to the given TEIRangeSelector.
 */
export const teiRangeSelectorToRange = (selector: TEIRangeSelector, container: Element) => {
  const start = xpathToDOMPosition(selector.startSelector.value, container);
  const end = xpathToDOMPosition(selector.endSelector.value, container);

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  return range;
}

export const teiToTextAnnotation = (container: HTMLElement) => (a: TEIAnnotation): TextAnnotation => ({
  ...a,
  target: teiToTextTarget(container)(a.target)
})

export const teiToTextTarget = (container: HTMLElement) => (t: TEIAnnotationTarget): TextAnnotationTarget => ({
  ...t,
  selector: t.selector.map(s => ({
    start: s.start,
    end: s.end,
    quote: s.quote,
    range: teiRangeSelectorToRange(s, container)
  }))
});
