import { ReactNode, useContext, useEffect, useRef } from 'react';
import { AnnotoriousContext, Filter } from '@annotorious/react';
import type { FormatAdapter } from '@annotorious/core';
import type { HighlightStyleExpression, TextAnnotation, TextAnnotatorOptions } from '@soomo/text-annotator';
import { createTextAnnotator } from '@soomo/text-annotator';

import '@soomo/text-annotator/dist/text-annotator.css';

export interface TextAnnotatorProps<I extends TextAnnotation = TextAnnotation, E extends unknown = TextAnnotation> extends Omit<TextAnnotatorOptions<I, E>, 'adapter'> {

  children?: ReactNode | JSX.Element;

  adapter?: FormatAdapter<I, E> | ((container: HTMLElement) => FormatAdapter<I, E>) | null;

  filter?: Filter<I>;

  style?: HighlightStyleExpression;

  className?: string;

}

export const TextAnnotator = <I extends TextAnnotation = TextAnnotation, E extends unknown = TextAnnotation>(
  props: TextAnnotatorProps<I, E>
) => {

  const el = useRef<HTMLDivElement>(null);

  const { className, children, ...opts } = props;
  const { style, filter, user, annotatingEnabled, userSelectAction } = opts;

  const { anno, setAnno } = useContext(AnnotoriousContext);

  useEffect(() => {
    if (!setAnno) return;

    const adapter = typeof opts.adapter === 'function' ? opts.adapter(el.current) : opts.adapter;

    const anno = createTextAnnotator(el.current, { ...opts, adapter });
    setAnno(anno);

    return () => anno.destroy();
  }, [setAnno]);

  useEffect(() => anno?.setStyle(style), [anno, style]);

  useEffect(() => anno?.setFilter(filter), [anno, filter]);

  useEffect(() => anno?.setFilter(filter), [anno, filter]);

  useEffect(() => anno?.setUserSelectAction(userSelectAction), [anno, userSelectAction]);

  useEffect(() => anno?.setUser(user), [anno, user]);

  useEffect(() => anno?.setAnnotatingEnabled(annotatingEnabled), [anno, annotatingEnabled]);

  return (
    <div ref={el} className={className}>
      {children}
    </div>
  );

};
