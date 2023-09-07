import type { FormatAdapter } from '@annotorious/core';
import type { PresencePainterOptions } from './presence';
import type { TextAnnotation } from './model';

export interface TextAnnotatorOptions<T extends unknown = TextAnnotation> {

  adapter?: FormatAdapter<TextAnnotation, T> | null;

  readOnly?: boolean;

  presence?: PresencePainterOptions;
    
}