export type BuilderLocale = "ar" | "en";
export type BuilderBlockType = "hero" | "text" | "features";
export type BuilderBlock = {
  id: string;
  type: BuilderBlockType;
  props: { title: string; body: string };
};
export type BuilderDocument = {
  schemaVersion: 1;
  locale: BuilderLocale;
  title: string;
  blocks: BuilderBlock[];
};
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
export function validateBuilderDocument(value:unknown):value is BuilderDocument {
  if(!isRecord(value)||value.schemaVersion!==1||(value.locale!=="ar"&&value.locale!=="en")||typeof value.title!=="string"||!Array.isArray(value.blocks))return false;
  return value.blocks.every((block)=>isRecord(block)&&typeof block.id==="string"&&(block.type==="hero"||block.type==="text"||block.type==="features")&&isRecord(block.props)&&typeof block.props.title==="string"&&typeof block.props.body==="string");
}
export function createBuilderDocument(locale:BuilderLocale,title:string,blocks:BuilderBlock[]):BuilderDocument {
 const document:BuilderDocument={schemaVersion:1,locale,title,blocks};
 if(!validateBuilderDocument(document))throw new Error("Invalid page content.");
 return document;
}
