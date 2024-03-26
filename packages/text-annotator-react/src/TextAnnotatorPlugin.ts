import { AnnotatorPlugin, AnnotoriousPlugin } from '@annotorious/react';
import type { TextAnnotator } from '@soomo/text-annotator';

export type TextAnnotatorPlugin<T extends unknown = TextAnnotator> = AnnotatorPlugin<T>;
export { AnnotoriousPlugin as TextAnnotatorPlugin }
