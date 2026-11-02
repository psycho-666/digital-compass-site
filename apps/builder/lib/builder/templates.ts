import type {BuilderBlock,BuilderLocale,BuilderTheme} from "./schema";
export type BuilderTemplateId="business"|"portfolio"|"restaurant";
export type BuilderTemplate={id:BuilderTemplateId;name:{ar:string;en:string};description:{ar:string;en:string};theme:BuilderTheme;blocks:(locale:BuilderLocale)=>BuilderBlock[]};
export const builderTemplates:BuilderTemplate[]=[
 {id:"business",name:{ar:"شركة وخدمات",en:"Business & services"},description:{ar:"موقع احترافي للتعريف بشركتك وخدماتك.",en:"A professional company and services website."},theme:{accentColor:"#6f4acb",backgroundColor:"#ffffff",textColor:"#202433",fontFamily:"sans"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"حلول تصنع فرقاً في أعمالك",body:"نساعدك على تطوير أعمالك بخدمات واضحة ونتائج ملموسة."}},
  {id:"2",type:"features",props:{title:"كيف نساعدك",body:"استشارات • تنفيذ • دعم مستمر"}},
  {id:"3",type:"text",props:{title:"من نحن",body:"فريق يعمل معك لفهم احتياجك وتحويله إلى حل عملي."}},
  {id:"4",type:"testimonial",props:{title:"عميلنا يثق بنا",body:"فريق متعاون وفهموا احتياجنا من البداية، والنتيجة كانت أفضل مما توقعنا."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Solutions that move your business forward",body:"We help you grow with clear services and measurable results."}},
  {id:"2",type:"features",props:{title:"How we help",body:"Consulting • Delivery • Ongoing support"}},
  {id:"3",type:"text",props:{title:"About us",body:"A team focused on understanding your needs and delivering practical solutions."}},
  {id:"4",type:"testimonial",props:{title:"A happy client",body:"The team understood our needs from day one and delivered beyond expectations."}}
 ]},
 {id:"portfolio",name:{ar:"أعمال ومعرض",en:"Portfolio"},description:{ar:"اعرض مشاريعك وخبراتك بطريقة أنيقة.",en:"Showcase your projects and expertise."},theme:{accentColor:"#65a5ff",backgroundColor:"#101319",textColor:"#f5f7fb",fontFamily:"sans"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"أعمال تستحق أن تُعرض",body:"اكتشف مجموعة من المشاريع التي نفخر بتنفيذها."}},
  {id:"2",type:"features",props:{title:"مختارات من أعمالنا",body:"مشروع الهوية • تجربة رقمية • حملة إبداعية"}},
  {id:"3",type:"text",props:{title:"لنعمل معاً",body:"لديك فكرة جديدة؟ يسعدنا أن نسمع عنها."}},
  {id:"4",type:"testimonial",props:{title:"من تجربة أحد عملائنا",body:"تجربة جميلة واهتمام بالتفاصيل من أول تواصل إلى تسليم المشروع."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Work worth showing",body:"Explore a selection of projects we're proud to have delivered."}},
  {id:"2",type:"features",props:{title:"Selected work",body:"Brand identity • Digital experience • Creative campaign"}},
  {id:"3",type:"text",props:{title:"Let's work together",body:"Have a new idea? We'd love to hear about it."}},
  {id:"4",type:"testimonial",props:{title:"A client's words",body:"A thoughtful experience with great attention to detail from start to finish."}}
 ]},
 {id:"restaurant",name:{ar:"مطعم ومقهى",en:"Restaurant & café"},description:{ar:"واجهة شهية لعرض القائمة واستقبال الحجوزات.",en:"A welcoming place to present your menu and bookings."},theme:{accentColor:"#b85c32",backgroundColor:"#fff8f0",textColor:"#3d2b22",fontFamily:"serif"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"نكهة تجمعنا",body:"أطباق طازجة، أجواء مميزة، وتجربة تستحق الزيارة."}},
  {id:"2",type:"features",props:{title:"قائمتنا",body:"مقبلات • أطباق رئيسية • مشروبات"}},
  {id:"3",type:"text",props:{title:"زورونا",body:"ننتظركم يومياً. تواصل معنا للاستفسار أو الحجز."}},
  {id:"4",type:"testimonial",props:{title:"آراء زبائننا",body:"أجواء رائعة وخدمة مميزة، بالتأكيد سنكرر الزيارة."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Good food brings us together",body:"Fresh dishes, a welcoming atmosphere and an experience worth sharing."}},
  {id:"2",type:"features",props:{title:"Our menu",body:"Starters • Main courses • Drinks"}},
  {id:"3",type:"text",props:{title:"Visit us",body:"We're here every day. Get in touch for questions or reservations."}},
  {id:"4",type:"testimonial",props:{title:"Guest feedback",body:"A lovely atmosphere and excellent service. We will definitely visit again."}}
 ]}
];
