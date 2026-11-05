import type {ReactNode} from 'react';

type Kind='camera'|'mic'|'speaker'|'projector'|'tripod'|'cable'|'laptop'|'light'|'screen'|'walkie'|'box';
export function equipmentKind(name:string,category:string,icon:string):Kind{
 const s=[name,category,icon].join(' ').toLocaleLowerCase('vi-VN');
 if(/máy ảnh|camera|ống kính|lens|chụp ảnh/.test(s))return 'camera';
 if(/micro|mic|thu âm/.test(s))return 'mic';
 if(/loa|speaker|âm thanh/.test(s))return 'speaker';
 if(/máy chiếu|projector/.test(s))return 'projector';
 if(/chân máy|tripod|giá đỡ/.test(s))return 'tripod';
 if(/cáp|dây|ổ cắm|adapter|sạc/.test(s))return 'cable';
 if(/laptop|máy tính|notebook/.test(s))return 'laptop';
 if(/đèn|ring light|ánh sáng/.test(s))return 'light';
 if(/màn chiếu|màn hình|tv|tivi/.test(s))return 'screen';
 if(/bộ đàm|walkie/.test(s))return 'walkie';
 return 'box';
}

/** Small hand-painted style vector illustrations: readable at card sizes, no text baked into artwork. */
export default function EquipmentDoodle({name,category='',icon='box'}:{name:string,category?:string,icon?:string}){
 const kind=equipmentKind(name,category,icon);
 const cream='#f7efd1',sage='#bacaa1',mint='#d9dfb6',ink='#516c68',blue='#a8c6cc',gold='#efd790';
 let art:ReactNode;
 switch(kind){
 case 'camera':art=<><path d="M24 49 Q26 39 38 39 L47 29 Q51 25 60 27 L69 39 L89 39 Q99 40 100 50 L100 83 Q100 90 91 90 L31 90 Q23 88 24 80Z" fill={mint}/><path d="M47 39 L51 30 Q56 26 60 31 L67 39" fill={sage}/><circle cx="64" cy="65" r="24" fill={sage}/><circle cx="64" cy="65" r="18" fill={blue} stroke={ink} strokeWidth="3"/><circle cx="64" cy="65" r="11" fill={ink}/><rect x="31" y="48" width="12" height="7" rx="3" fill={cream}/><circle cx="90" cy="50" r="4" fill={ink}/></>;break;
 case 'mic':art=<><path d="M57 72 L53 100 Q62 105 70 100 L66 72Z" fill={mint}/><rect x="46" y="19" width="31" height="56" rx="16" fill={blue}/><path d="M47 46 Q63 51 77 46 L77 56 Q64 61 47 56Z" fill={cream}/><path d="M55 29 L55 42 M64 26 L64 43 M72 29 L72 41" stroke={ink} strokeWidth="2.6" strokeLinecap="round"/><circle cx="62" cy="86" r="4" fill={ink}/></>;break;
 case 'speaker':art=<><rect x="30" y="24" width="66" height="76" rx="17" fill={mint}/><rect x="43" y="20" width="40" height="12" rx="6" fill={sage}/><circle cx="63" cy="69" r="24" fill={sage} stroke={ink} strokeWidth="3"/><circle cx="63" cy="69" r="13" fill={ink}/><circle cx="43" cy="44" r="4" fill={cream}/><circle cx="55" cy="43" r="3" fill={blue}/></>;break;
 case 'projector':art=<><rect x="21" y="45" width="82" height="48" rx="17" fill={cream}/><path d="M27 56 Q63 37 98 56" stroke={sage} strokeWidth="4" fill="none"/><circle cx="76" cy="69" r="19" fill={sage}/><circle cx="76" cy="69" r="13" fill={blue} stroke={ink} strokeWidth="3"/><circle cx="76" cy="69" r="6" fill={ink}/><path d="M36 70 h17 M36 76 h17" stroke={ink} strokeWidth="3" strokeLinecap="round"/><path d="M39 93 v7 M89 93 v7" stroke={ink} strokeWidth="5" strokeLinecap="round"/></>;break;
 case 'tripod':art=<><path d="M60 50 L34 105 M61 51 L62 109 M63 50 L92 105" stroke={sage} strokeWidth="10" strokeLinecap="round"/><path d="M60 51 L36 105 M63 50 L92 105" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/><rect x="42" y="31" width="43" height="14" rx="6" fill={mint}/><rect x="53" y="22" width="18" height="14" rx="5" fill={blue}/><path d="M79 40 L99 33" stroke={ink} strokeWidth="5" strokeLinecap="round"/><circle cx="62" cy="50" r="8" fill={cream}/></>;break;
 case 'cable':art=<><path d="M45 36 C18 34 21 78 52 75 C82 72 74 39 94 48 C108 56 94 98 73 99" fill="none" stroke={sage} strokeWidth="12" strokeLinecap="round"/><path d="M45 36 C18 34 21 78 52 75 C82 72 74 39 94 48 C108 56 94 98 73 99" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/><rect x="38" y="25" width="21" height="21" rx="6" fill={cream}/><path d="M44 25 v-8 M53 25 v-8" stroke={ink} strokeWidth="4" strokeLinecap="round"/><rect x="66" y="93" width="20" height="15" rx="5" fill={mint}/></>;break;
 case 'laptop':art=<><rect x="25" y="25" width="75" height="59" rx="9" fill={cream} stroke={sage} strokeWidth="5"/><rect x="31" y="32" width="63" height="43" rx="5" fill={blue}/><path d="M17 85 H106 L95 98 H29Z" fill={mint}/><path d="M45 91 H78" stroke={ink} strokeWidth="3" strokeLinecap="round"/></>;break;
 case 'light':art=<><circle cx="63" cy="48" r="29" fill={gold} stroke={sage} strokeWidth="8"/><circle cx="63" cy="48" r="15" fill="#fbf9f0"/><path d="M62 77 v16 M62 93 L39 109 M62 93 L88 109" stroke={ink} strokeWidth="5" strokeLinecap="round"/><rect x="53" y="78" width="19" height="9" rx="4" fill={sage}/></>;break;
 case 'screen':art=<><rect x="20" y="25" width="87" height="62" rx="10" fill={cream} stroke={sage} strokeWidth="5"/><rect x="27" y="33" width="73" height="45" rx="5" fill={blue}/><path d="M63 87 v17 M46 106 H80" stroke={ink} strokeWidth="5" strokeLinecap="round"/></>;break;
 case 'walkie':art=<><path d="M80 17 V5" stroke={ink} strokeWidth="7" strokeLinecap="round"/><rect x="37" y="28" width="56" height="77" rx="15" fill={mint}/><rect x="45" y="40" width="38" height="27" rx="8" fill={blue}/><circle cx="50" cy="77" r="5" fill={ink}/><circle cx="65" cy="77" r="5" fill={ink}/><path d="M50 92 h30" stroke={ink} strokeWidth="3" strokeLinecap="round"/></>;break;
 default:art=<><rect x="29" y="40" width="70" height="55" rx="12" fill={mint}/><path d="M29 53 L63 35 L99 53 L64 70Z" fill={cream}/><path d="M63 70 V94" stroke={ink} strokeWidth="3" strokeLinecap="round"/><path d="M30 53 L63 70 L98 53" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/></>;
 }
 return <svg className="equipment-doodle" viewBox="0 0 128 128" role="img" aria-label={'Minh họa '+name} xmlns="http://www.w3.org/2000/svg">
  <path d="M21 24 Q23 16 26 24 Q28 27 34 29 Q27 31 26 38 Q23 32 16 30 Q21 28 21 24Z" fill={gold}/>
  {art}
 </svg>;
}
