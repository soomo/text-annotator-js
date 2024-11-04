import { FC, PointerEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useAnnotator, useSelection } from '@annotorious/react';
import { isRevived, type TextAnnotation, type TextAnnotator } from '@recogito/text-annotator';

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

import { isMobile } from './isMobile';
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

  const [isFocused, setFocused] = useState(false);
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  useEffect(() => {
    if (!isOpen) handleBlur();
  }, [isOpen, handleBlur]);

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

  const dismiss = useDismiss(context);

  const role = useRole(context, { role: 'dialog' });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  useEffect(() => {
    const annotationSelector = annotation?.target.selector;
    setOpen(annotationSelector?.length > 0 ? isRevived(annotationSelector) : false);
  }, [annotation]);

  useEffect(() => {
    if (isOpen && annotation) {
      const {
        target: {
          selector: [{ range }]
        }
      } = annotation;

      refs.setPositionReference({
        getBoundingClientRect: () => range.getBoundingClientRect(),
        getClientRects: () => range.getClientRects()
      });
    } else {
      refs.setPositionReference(null);
    }
  }, [isOpen, annotation, refs]);

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

  // Prevent text-annotator from handling the irrelevant events triggered from the popup
  const getStopEventsPropagationProps = useCallback(
    () => ({ onPointerUp: (event: PointerEvent<HTMLDivElement>) => event.stopPropagation() }),
    []
  );

  // Don't shift focus to the floating element if selected via keyboard or on mobile.
  const initialFocus = useMemo(() => {
    return (event?.type === 'keyup' || event?.type === 'contextmenu' || isMobile()) ? -1 : 0;
  }, [event]);

  /**
   * Announce the navigation hint only on the keyboard selection,
   * because the focus isn't shifted to the popup automatically then
   */
  useAnnouncePopupNavigation({
    disabled: isFocused,
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
          {...getFloatingProps({
            onFocus: handleFocus,
            onBlur: handleBlur,
            ...getStopEventsPropagationProps()
          })}>
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
