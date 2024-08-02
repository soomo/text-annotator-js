import { Filter, Origin, type Selection, type User } from '@annotorious/core';
import { v4 as uuidv4 } from 'uuid';
import hotkeys from 'hotkeys-js';
import { Key } from 'ts-key-enum';
import type { TextAnnotatorState } from './state';
import type { TextAnnotationTarget } from './model';
import {
  clonePointerEvent,
  cloneKeyboardEvent,
  debounce,
  splitAnnotatableRanges,
  rangeToSelector,
  isWhitespaceOrEmpty,
  NOT_ANNOTATABLE_SELECTOR
} from './utils';

export const createSelectionHandler = (
  container: HTMLElement,
  state: TextAnnotatorState,
  offsetReferenceSelector?: string
) => {

  let currentUser: User | undefined;

  const setUser = (user?: User) => currentUser = user;

  let currentFilter: Filter | undefined;

  const setFilter = (filter?: Filter) => currentFilter = filter;

  let currentAnnotatingEnabled = true;

  const setAnnotatingEnabled = (enabled: boolean) => currentAnnotatingEnabled = enabled;

  const { store, selection } = state;

  let currentTarget: TextAnnotationTarget | undefined;

  let isLeftClick: boolean | undefined;

  let lastDownEvent: Selection['event'] | undefined;

  const onSelectStart = (evt: Event) => {
    if (!currentAnnotatingEnabled) return;

    if (isLeftClick === false)
      return;

    /**
     * Make sure we don't listen to selection changes that were
     * not started on the container, or which are not supposed to
     * be annotatable (like a component popup).
     * Note that Chrome/iOS will sometimes return the root doc as target!
     */
    const annotatable = !(evt.target as Node).parentElement?.closest(NOT_ANNOTATABLE_SELECTOR);

    currentTarget = annotatable ? {
      annotation: uuidv4(),
      selector: [],
      creator: currentUser,
      created: new Date()
    } : undefined;
  }

  container.addEventListener('selectstart', onSelectStart);

  const onSelectionChange = debounce((evt: Event) => {
    if (!currentAnnotatingEnabled) return;
    const sel = document.getSelection();

    // This is to handle cases where the selection is "hijacked" by another element
    // in a not-annotatable area. A rare case in theory. But rich text editors
    // will like Quill do it...
    const annotatable = !sel.anchorNode?.parentElement?.closest(NOT_ANNOTATABLE_SELECTOR);
    if (!annotatable) {
      currentTarget = undefined;
      return;
    }

    // Chrome/iOS does not reliably fire the 'selectstart' event!
    if (evt.timeStamp - (lastDownEvent?.timeStamp || evt.timeStamp) < 1000 && !currentTarget) {
      onSelectStart(lastDownEvent || evt);
    }

    if (sel.isCollapsed || !currentTarget || isLeftClick === false)
      return;


    const selectionRange = sel.getRangeAt(0);
    if (isWhitespaceOrEmpty(selectionRange)) return;

    const annotatableRanges = splitAnnotatableRanges(selectionRange.cloneRange());

    const hasChanged =
      annotatableRanges.length !== currentTarget.selector.length ||
      annotatableRanges.some((r, i) => r.toString() !== currentTarget.selector[i]?.quote);

    if (!hasChanged) return;

    currentTarget = {
      ...currentTarget,
      selector: annotatableRanges.map(r => rangeToSelector(r, container, offsetReferenceSelector)),
      updated: new Date()
    };

    if (store.getAnnotation(currentTarget.annotation)) {
      store.updateTarget(currentTarget, Origin.LOCAL);
    } else {
      // Proper lifecycle management: clear selection first...
      selection.clear();

      // ...then add annotation to store...
      store.addAnnotation({
        id: currentTarget.annotation,
        bodies: [],
        target: currentTarget
      }, Origin.LOCAL);

      // ...then make the new annotation the current selection
      selection.userSelect(currentTarget.annotation, lastDownEvent);
    }
  })

  document.addEventListener('selectionchange', onSelectionChange);

  /**
   * Select events don't carry information about the mouse button
   * Therefore, to prevent right-click selection, we need to listen
   * to the initial pointerdown event and remember the button
   */
  const onPointerDown = (evt: PointerEvent) => {
    /**
     * Cloning the event to prevent it from accidentally being `undefined`
     * @see https://github.com/recogito/text-annotator-js/commit/65d13f3108c429311cf8c2523f6babbbc946013d#r144033948
     */
    lastDownEvent = clonePointerEvent(evt);
    isLeftClick = lastDownEvent.button === 0;
  }
  container.addEventListener('pointerdown', onPointerDown);

  const onPointerUp = (evt: PointerEvent) => {
    const annotatable = !(evt.target as Node).parentElement?.closest(NOT_ANNOTATABLE_SELECTOR);
    if (!annotatable || !isLeftClick)
      return;

    // Logic for selecting an existing annotation
    const userSelect = () => {
      const { x, y } = container.getBoundingClientRect();

      const hovered = store.getAt(evt.clientX - x, evt.clientY - y, currentFilter);
      if (hovered) {
        const { selected } = selection;

        if (selected.length !== 1 || selected[0].id !== hovered.id)
          selection.userSelect(hovered.id, evt);
      } else if (!selection.isEmpty()) {
        selection.clear();
      }
    }

    const timeDifference = evt.timeStamp - lastDownEvent.timeStamp;

    // Just a click, not a selection
    if (document.getSelection().isCollapsed && timeDifference < 300) {
      currentTarget = undefined;
      userSelect();
    } else if (currentTarget) {
      selection.userSelect(currentTarget.annotation, evt);
    }
  }
  document.addEventListener('pointerup', onPointerUp);

  /**
   * Track arbitrary keydown events to use them during
   * the `selectionchange` annotation selection.
   */
  hotkeys('*', { element: container, keyup: false, keydown: true }, (evt, handler) => {
    if (!evt.repeat) {
      lastDownEvent = cloneKeyboardEvent(evt);
    }
  });

  /**
   * Track the "Shift" key lift which signifies the end of a select operation.
   * Unfortunately, we cannot track modifier key immediately, so the wildcard is used.
   */
  hotkeys('*', { keyup: true, keydown: false }, (evt) => {
    if (hotkeys.shift && evt.key === Key.Shift) {
      if (!evt.repeat && currentTarget) {
        selection.userSelect(currentTarget.annotation, evt);
      }
    }
  });

  /**
   * Track the "select all" command on lifting the keys.
   * Unfortunately, system-related shortcuts can be captured
   * only on `keydown` event, so an additional flag is used.
   */
  let selectAllCaptured = false;
  hotkeys('ctrl+a, ⌘+a', { keyup: false, keydown: true }, () => {
    selectAllCaptured = true;
  });
  hotkeys('*', { keyup: true, keydown: false }, (evt) => {
    if (selectAllCaptured) {
      if (!evt.repeat && currentTarget) {
        selection.userSelect(currentTarget.annotation, evt);
      }
    }
    selectAllCaptured = false;
  });

  const destroy = () => {
    container.removeEventListener('selectstart', onSelectStart);
    document.removeEventListener('selectionchange', onSelectionChange);

    container.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerup', onPointerUp);

    hotkeys.unbind();
  }

  return {
    destroy,
    setFilter,
    setUser,
    setAnnotatingEnabled
  }

}

