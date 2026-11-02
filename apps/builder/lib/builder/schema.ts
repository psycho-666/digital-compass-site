export type BuilderLocale = "ar" | "en";
export type BuilderBlockType = "hero" | "text" | "features";
export type BuilderTheme = { accentColor:string; backgroundColor:string; textColor:string; fontFamily:"sans"|"serif" };
export const defaultBuilderTheme:BuilderTheme={accentColor:"#6f4acb",backgroundColor:"#ffffff",textColor:"#202433",fontFamily:"sans"};
export type BuilderBlock = {
  id: string;
  type: BuilderBlockType;
  props: { title: string; body: string; imagePath?: string; align?:"left"|"center"|"right"; backgroundColor?:string; buttonText?:string; buttonUrl?:string };
};
export type BuilderDocument = {
  schemaVersion: 1;
  locale: BuilderLocale;
  title: string;
  blocks: BuilderBlock[];
  theme?: BuilderTheme;
};
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
export function isSafeBuilderLink(value:string):boolean{return value.startsWith("#")||(value.startsWith("/")&&!value.startsWith("//"))||/^https?:\/\//i.test(value)||/^mailto:/i.test(value)||/^tel:/i.test(value);}
export function validateBuilderDocument(value:unknown):value is BuilderDocument {
  if(!isRecord(value)||value.schemaVersion!==1||(value.locale!=="ar"&&value.locale!=="en")||typeof value.title!=="string"||!Array.isArray(value.blocks))return false;
  const validTheme=value.theme===undefined||(isRecord(value.theme)&&typeof value.theme.accentColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(value.theme.accentColor)&&typeof value.theme.backgroundColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(value.theme.backgroundColor)&&typeof value.theme.textColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(value.theme.textColor)&&(value.theme.fontFamily==="sans"||value.theme.fontFamily==="serif"));
  return validTheme&&value.blocks.every((block)=>isRecord(block)&&typeof block.id==="string"&&(block.type==="hero"||block.type==="text"||block.type==="features")&&isRecord(block.props)&&typeof block.props.title==="string"&&typeof block.props.body==="string"&&(block.props.imagePath===undefined||typeof block.props.imagePath==="string")&&(block.props.align===undefined||block.props.align==="left"||block.props.align==="center"||block.props.align==="right")&&(block.props.backgroundColor===undefined||(typeof block.props.backgroundColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(block.props.backgroundColor)))&&(block.props.buttonText===undefined||typeof block.props.buttonText==="string")&&(block.props.buttonUrl===undefined||(typeof block.props.buttonUrl==="string"&&isSafeBuilderLink(block.props.buttonUrl))));
}
export function createBuilderDocument(locale:BuilderLocale,title:string,blocks:BuilderBlock[],theme:BuilderTheme=defaultBuilderTheme):BuilderDocument {
 const document:BuilderDocument={schemaVersion:1,locale,title,blocks,theme};
 if(!validateBuilderDocument(document))throw new Error("Invalid page content.");
 return document;
}
