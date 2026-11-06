import type {BuilderBlock,BuilderLocale,BuilderTheme} from "./schema";
export type BuilderTemplateId="business"|"portfolio"|"restaurant"|"landing";
export type BuilderTemplate={id:BuilderTemplateId;name:{ar:string;en:string};description:{ar:string;en:string};theme:BuilderTheme;blocks:(locale:BuilderLocale)=>BuilderBlock[]};
export const builderTemplates:BuilderTemplate[]=[
 {id:"business",name:{ar:"شركة وخدمات",en:"Business & services"},description:{ar:"موقع احترافي للتعريف بشركتك وخدماتك.",en:"A professional company and services website."},theme:{accentColor:"#6f4acb",backgroundColor:"#ffffff",textColor:"#202433",fontFamily:"sans"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"حلول تصنع فرقاً في أعمالك",body:"نساعدك على تطوير أعمالك بخدمات واضحة ونتائج ملموسة."}},
  {id:"2",type:"features",props:{title:"كيف نساعدك",body:"استشارات • تنفيذ • دعم مستمر"}},
  {id:"3",type:"text",props:{title:"من نحن",body:"فريق يعمل معك لفهم احتياجك وتحويله إلى حل عملي."}},
  {id:"4",type:"testimonial",props:{title:"عميلنا يثق بنا",body:"أضف هنا رأياً حقيقياً من أحد عملائك يوضح تجربته مع خدماتك."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Solutions that move your business forward",body:"We help you grow with clear services and measurable results."}},
  {id:"2",type:"features",props:{title:"How we help",body:"Consulting • Delivery • Ongoing support"}},
  {id:"3",type:"text",props:{title:"About us",body:"A team focused on understanding your needs and delivering practical solutions."}},
  {id:"4",type:"testimonial",props:{title:"A happy client",body:"Add a genuine customer review describing their experience with your service."}}
 ]},
 {id:"portfolio",name:{ar:"أعمال ومعرض",en:"Portfolio"},description:{ar:"اعرض مشاريعك وخبراتك بطريقة أنيقة.",en:"Showcase your projects and expertise."},theme:{accentColor:"#65a5ff",backgroundColor:"#101319",textColor:"#f5f7fb",fontFamily:"sans"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"أعمال تستحق أن تُعرض",body:"اكتشف مجموعة من المشاريع التي نفخر بتنفيذها."}},
  {id:"2",type:"features",props:{title:"مختارات من أعمالنا",body:"مشروع الهوية • تجربة رقمية • حملة إبداعية"}},
  {id:"3",type:"text",props:{title:"لنعمل معاً",body:"لديك فكرة جديدة؟ يسعدنا أن نسمع عنها."}},
  {id:"4",type:"testimonial",props:{title:"من تجربة أحد عملائنا",body:"اكتب هنا شهادة حقيقية من عميل عن تجربته مع مشروعك."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Work worth showing",body:"Explore a selection of projects we're proud to have delivered."}},
  {id:"2",type:"features",props:{title:"Selected work",body:"Brand identity • Digital experience • Creative campaign"}},
  {id:"3",type:"text",props:{title:"Let's work together",body:"Have a new idea? We'd love to hear about it."}},
  {id:"4",type:"testimonial",props:{title:"A client's words",body:"Add a real client testimonial about their experience with your service."}}
 ]},
 {id:"restaurant",name:{ar:"مطعم ومقهى",en:"Restaurant & café"},description:{ar:"واجهة شهية لعرض القائمة واستقبال الحجوزات.",en:"A welcoming place to present your menu and bookings."},theme:{accentColor:"#b85c32",backgroundColor:"#fff8f0",textColor:"#3d2b22",fontFamily:"serif"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"نكهة تجمعنا",body:"أطباق طازجة، أجواء مميزة، وتجربة تستحق الزيارة."}},
  {id:"2",type:"features",props:{title:"قائمتنا",body:"مقبلات • أطباق رئيسية • مشروبات"}},
  {id:"3",type:"text",props:{title:"زورونا",body:"ننتظركم يومياً. تواصل معنا للاستفسار أو الحجز."}},
  {id:"4",type:"testimonial",props:{title:"آراء زبائننا",body:"أضف هنا رأياً حقيقياً من أحد زبائن المطعم أو المقهى."}}
 ]:[
  {id:"1",type:"hero",props:{title:"Good food brings us together",body:"Fresh dishes, a welcoming atmosphere and an experience worth sharing."}},
  {id:"2",type:"features",props:{title:"Our menu",body:"Starters • Main courses • Drinks"}},
  {id:"3",type:"text",props:{title:"Visit us",body:"We're here every day. Get in touch for questions or reservations."}},
  {id:"4",type:"testimonial",props:{title:"Guest feedback",body:"Add a genuine guest review about the restaurant or café experience."}}
 ]},
 {id:"landing",name:{ar:"صفحة تسويقية",en:"Landing page"},description:{ar:"صفحة مركزة على عرض خدمة وتحويل الزوار إلى عملاء.",en:"A focused page to promote an offer and convert visitors."},theme:{accentColor:"#5b45d6",backgroundColor:"#ffffff",textColor:"#202033",fontFamily:"sans"},blocks:(locale)=>locale==="ar"?[
  {id:"1",type:"hero",props:{title:"حلّك يبدأ بخطوة واحدة",body:"اكتشف كيف يمكن لخدمتنا أن تختصر وقتك وتحقق نتائج أفضل.",buttonText:"اطلب الخدمة الآن",buttonUrl:"#contact"}},
  {id:"2",type:"features",props:{title:"لماذا تختارنا؟",body:"نتائج واضحة • تنفيذ سريع • دعم موثوق"}},
  {id:"3",type:"text",props:{title:"كيف نعمل؟",body:"1. أخبرنا باحتياجك  2. نجهز الحل  3. تبدأ بتحقيق النتائج"}},
  {id:"4",type:"testimonial",props:{title:"تجربة عميل",body:"أضف هنا تجربة حقيقية لعميل استفاد من الخدمة."}},
  {id:"5",type:"form",props:{title:"ابدأ الآن",body:"اترك بياناتك وسنتواصل معك قريباً.",formKind:"contact"}}
 ]:[
  {id:"1",type:"hero",props:{title:"Your next step starts here",body:"Discover how our service can save time and deliver better results.",buttonText:"Get started",buttonUrl:"#contact"}},
  {id:"2",type:"features",props:{title:"Why choose us?",body:"Clear outcomes • Fast delivery • Reliable support"}},
  {id:"3",type:"text",props:{title:"How it works",body:"1. Tell us what you need  2. We prepare your solution  3. Start seeing results"}},
  {id:"4",type:"testimonial",props:{title:"Customer story",body:"Add a genuine customer experience showing the value of your service."}},
  {id:"5",type:"form",props:{title:"Get started",body:"Leave your details and our team will contact you.",formKind:"contact"}}
 ]}
];
