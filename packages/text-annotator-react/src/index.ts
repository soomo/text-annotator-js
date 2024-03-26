export * from './tei';
export * from './TextAnnotator';
export * from './TextAnnotatorPopup';
export * from './TextAnnotatorPlugin';

// Re-export essential Types for convenience
export type {
  AnnotoriousPlugin
} from '@annotorious/react';

export type { 
  TextAnnotation,
  TextAnnotator as RecogitoTextAnnotator
} from '@soomo/text-annotator';
