import type { Formatter, ViewportState } from '@annotorious/core';
import type { TextAnnotatorState } from '../state';
import { defaultPainter, type HighlightPainter } from './HighlightPainter';
import { trackViewport } from './trackViewport';

import './highlightLayer.css';

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number = 10): T => {
  let timeoutId: number;

  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  }) as T;
}

const createCanvas = (className: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = /* 2 * */ window.innerWidth;
  canvas.height = /*2 * */ window.innerHeight;
  canvas.className = className;

  /*
  const context = canvas.getContext('2d');
  context.scale(2, 2);
  context.translate(0.5, 0.5);
  */

  return canvas;
}

const resetCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = /*2 *  */ window.innerWidth;
  canvas.height = /* 2 *  */ window.innerHeight;

  // Note that resizing the canvas resets the context
  // const context = canvas.getContext('2d');
  // context.scale(2, 2);
  // context.translate(0.5, 0.5);
}

export const createHighlightLayer = (
  container: HTMLElement, 
  state: TextAnnotatorState,
  viewport: ViewportState
) => {

  const { store, selection, hover } = state;
  
  let currentFormatter: Formatter | undefined;

  let currentPainter: HighlightPainter = defaultPainter;

  const onDraw = trackViewport(viewport);

  container.classList.add('r6o-annotatable');

  const bgCanvas = createCanvas('r6o-highlight-layer bg');
  const fgCanvas = createCanvas('r6o-highlight-layer fg');

  const bgContext = bgCanvas.getContext('2d');
  const fgContext = fgCanvas.getContext('2d');

  container.insertBefore(bgCanvas, container.firstChild);
  container.appendChild(fgCanvas);

  container.addEventListener('pointermove', (event: PointerEvent) => {
    const {x, y} = container.getBoundingClientRect();
    const hovered = store.getAt(event.clientX - x, event.clientY - y);
    if (hovered) {
      if (hover.current !== hovered.id) {
        container.classList.add('hovered');
        hover.set(hovered.id);
      }
    } else {
      if (hover.current) {
        container.classList.remove('hovered');
        hover.set(null);
      }
    }
  });

  const getViewport = () => {
    const { top, left } = container.getBoundingClientRect();

    const { innerWidth, innerHeight } = window;

    const minX = - left;
    const minY = - top;
    const maxX = innerWidth - left;
    const maxY = innerHeight - top;

    return { top, left, minX, minY, maxX, maxY };
  }

  const onScroll = () => redraw();

  document.addEventListener('scroll', onScroll, true);

  const onResize = debounce(() => {
    resetCanvas(bgCanvas);
    resetCanvas(fgCanvas);

    store.recalculatePositions();

    redraw();
  });

  // Note that in cases where the element resized due to a 
  // window resize, onResize will be triggered twice. This is
  // probably not a huge issue. But definitely an area for
  // future optimization. In terms of how to do this: there's 
  // probably no ideal solution, but one straightforward way
  // would be to just set a flag in 
  window.addEventListener('resize', onResize);

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  const redraw = () => {
    const { top, left, minX, minY, maxX, maxY } = getViewport();   

    const annotationsInView = store.getIntersectingRects(minX, minY, maxX, maxY);

    const { width, height } = fgCanvas;

    // Get current selection
    const selectedIds = new Set(selection.selected.map(({ id }) => id));

    requestAnimationFrame(() => {
      // New render loop - clear canvases
      fgContext.clearRect(-0.5, -0.5, width + 1, height + 1);
      bgContext.clearRect(-0.5, -0.5, width + 1, height + 1);
      
      annotationsInView.forEach(({ annotation, rects }) => {
        // Offset annotation rects by current scroll position
        const offsetRects = rects.map(({ x, y, width, height }) => ({ 
          x: x + left, 
          y: y + top, 
          width, 
          height 
        }));

        const isSelected = selectedIds.has(annotation.id);
        currentPainter.paint(annotation, offsetRects, bgContext, fgContext, isSelected, currentFormatter);
      });

      onDraw(annotationsInView.map(({ annotation }) => annotation));
    });
  }

  store.observe(() => redraw());

  // Selection should only ever affect visible annotations,
  // need need for extra check
  selection.subscribe(() => redraw());

  const setFormatter = (formatter: Formatter) => {
    currentFormatter = formatter;
    redraw();
  }

  return {
    redraw,
    setFormatter,
    setPainter: (painter: HighlightPainter) => currentPainter = painter
  }

}