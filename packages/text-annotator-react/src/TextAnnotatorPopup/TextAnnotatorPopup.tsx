import { FC, PointerEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { isMobile } from './isMobile';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  inline,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole
} from '@floating-ui/react';

import { useAnnotator, useSelection } from '@annotorious/react';
import {
  isRevived,
  denormalizeRectWithOffset,
  toDomRectList,
  type TextAnnotation,
  type TextAnnotator
} from '@soomo/text-annotator';

import { useAnnouncePopupNavigation } from '../hooks';
import './TextAnnotatorPopup.css';

interface TextAnnotationPopupProps {

  ariaNavigationMessage?: string;

  ariaCloseWarning?: string;

  popup(props: TextAnnotationPopupContentProps): ReactNode;

}

export interface TextAnnotationPopupContentProps {

  annotation: TextAnnotation;

  editable?: boolean;

  event?: PointerEvent;

}

export const TextAnnotatorPopup: FC<TextAnnotationPopupProps> = (props) => {

  const { popup, ariaNavigationMessage } = props;

  const r = useAnnotator<TextAnnotator>();

  const { selected, event } = useSelection<TextAnnotation>();

  const annotation = selected[0]?.annotation;

  const [isOpen, setOpen] = useState(selected?.length > 0);
  const handleClose = () => r?.cancelSelected();

  const [isFloatingFocused, setFloatingFocused] = useState(false);
  const handleFloatingFocus = () => setFloatingFocused(true);
  const handleFloatingBlur = () => setFloatingFocused(false);
  useEffect(() => {
    if (!isOpen) handleFloatingBlur();
  }, [isOpen, handleFloatingBlur]);

  const { refs, floatingStyles, update, context } = useFloating({
    placement: isMobile() ? 'bottom' : 'top',
    open: isOpen,
    onOpenChange: (open, _event, reason) => {
      if (!open && (reason === 'escape-key' || reason === 'focus-out')) {
        setOpen(open);
        handleClose();
      }
    },
    middleware: [
      offset(10),
      inline(),
      flip(),
      shift({ mainAxis: false, crossAxis: true, padding: 10 })
    ],
    whileElementsMounted: autoUpdate
  });

  const role = useRole(context, { role: 'dialog' });
  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  useEffect(() => {
    const annotationSelector = annotation?.target.selector;
      if (!annotationSelector) return;

    setOpen(isRevived(annotationSelector));
  }, [annotation]);

  useEffect(() => {
    if (!r) return;

    if (isOpen && annotation?.id) {
      refs.setPositionReference({
        getBoundingClientRect: () => denormalizeRectWithOffset(
          r.state.store.getAnnotationBounds(annotation.id),
          r.element.getBoundingClientRect()
        ),
        getClientRects: () => {
          const rects = r.state.store.getAnnotationRects(annotation.id);
          const denormalizedRects = rects.map(
            rect => denormalizeRectWithOffset(rect, r.element.getBoundingClientRect())
          );
          return toDomRectList(denormalizedRects);
        }
      });
    } else {
      refs.setPositionReference(null);
    }
  }, [isOpen, annotation?.id, annotation?.target, r]);

  useEffect(() => {
    const config: MutationObserverInit = { attributes: true, childList: true, subtree: true };

    const mutationObserver = new MutationObserver(() => update());
    mutationObserver.observe(document.body, config);

    window.document.addEventListener('scroll', update, true);

    return () => {
      mutationObserver.disconnect();
      window.document.removeEventListener('scroll', update, true);
    };
  }, [update]);

  // Don't shift focus to the floating element if selected via keyboard or on mobile.
  const initialFocus = useMemo(() => {
    return (event?.type === 'keyup' || event?.type === 'contextmenu' || isMobile()) ? -1 : 0;
  }, [event]);

  /**
   * Announce the navigation hint only on the keyboard selection,
   * because the focus isn't shifted to the popup automatically then
   */
  useAnnouncePopupNavigation({
    disabled: isFloatingFocused,
    floatingOpen: isOpen,
    message: ariaNavigationMessage,
  });

  return isOpen && annotation ? (
    <FloatingPortal>
      <FloatingFocusManager
        context={context}
        modal={false}
        closeOnFocusOut={true}
        returnFocus={false}
        initialFocus={initialFocus}>
        <div
          className="a9s-popup r6o-popup annotation-popup r6o-text-popup not-annotatable"
          ref={refs.setFloating}
          style={floatingStyles}
          onFocus={handleFloatingFocus}
          onBlur={handleFloatingBlur}
          {...getFloatingProps(getStopEventsPropagationProps())}>
          {popup({
            annotation: selected[0].annotation,
            editable: selected[0].editable,
            event
          })}
          <button className="r6o-popup-sr-only" aria-live="assertive" onClick={handleClose}>
            {props.ariaCloseWarning || 'Click or leave this dialog to close it.'}
          </button>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  ) : null;

}

/**
 * Prevent text-annotator from handling the irrelevant events
 * triggered from the popup/toolbar/dialog
 */
export const getStopEventsPropagationProps = <T extends HTMLElement = HTMLElement>() => ({
  onPointerUp: (event: PointerEvent<T>) => event.stopPropagation(),
  onPointerDown: (event: PointerEvent<T>) => event.stopPropagation(),
  onMouseDown: (event: MouseEvent<T>) => event.stopPropagation(),
  onMouseUp: (event: MouseEvent<T>) => event.stopPropagation()
});
