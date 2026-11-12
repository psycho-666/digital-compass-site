export type Locale = "ar" | "en";
export type BlockType = "hero" | "text" | "image" | "features" | "contact";
export type BuilderBlock = {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
};
export type PageDocument = {
  schemaVersion: 1;
  locale: Locale;
  title: string;
  blocks: BuilderBlock[];
};
