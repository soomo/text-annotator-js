import { AnnotatorPlugin, AnnotoriousPlugin } from '@annotorious/react';
import type { TextAnnotation } from '@recogito/text-annotator';

export type TextAnnotatorPlugin<T extends unknown = TextAnnotation> = AnnotatorPlugin<T>;
export { AnnotoriousPlugin as TextAnnotatorPlugin }
