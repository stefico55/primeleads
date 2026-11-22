// Extraction de contacts depuis des pages publiques (sans service payant).
const FORMES=/\b(sas|sasu|sarl|eurl|sa|sci|snc|scop|selarl|groupe|societe|ets|etablissements?|holding|et fils|france|international)\b/g;
const nz=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/&/g," et ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const BAD_DOM=/(societe\.com|pappers|pagesjaunes|infogreffe|verif\.com|manageo|kompass|societeinfo|annuaire-entreprises|data\.gouv|facebook|linkedin|instagram|twitter|youtube|google|bing|yelp|mappy|tripadvisor|indeed|wikipedia|lefigaro|bodacc|score3|entreprises\.|firmenwissen|europages|ellisphere|dnb\.com|opencorporates|infonet|corporama|fr\.kompass|journaldunet|doctrine|legalstart|lemonde|leparisien|lyon\.fr)/i;
function slugs(nom){const base=nz(nom).replace(FORMES," ").replace(/\s+/g," ").trim();if(!base)return[];const w=base.split(" ").filter(x=>x.length>1);const out=new Set();
 const j=w.join(""),h=w.join("-");[j,h].forEach(s=>{if(s.length>=3)["fr","com"].forEach(t=>out.add(s+"."+t))});
 if(w.length>2){const j2=w.slice(0,2).join(""),h2=w.slice(0,2).join("-");[j2,h2].forEach(s=>out.add(s+".fr"))}
 return [...out].slice(0,8)}
function clean(html){return String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<!--[\s\S]*?-->/g," ")}
function text(html){return clean(html).replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ")}
function decodeCf(h){try{const k=parseInt(h.slice(0,2),16);let o="";for(let i=2;i<h.length;i+=2)o+=String.fromCharCode(parseInt(h.slice(i,i+2),16)^k);return o}catch(e){return""}}
const fmtTel=d=>{d=d.replace(/\D/g,"");if(d.startsWith("33"))d="0"+d.slice(2);if(d.length!==10||d[0]!=="0")return null;return d.replace(/(\d{2})(?=\d)/g,"$1 ").trim()};
function phones(html){const h=clean(html),res=new Map();
 const add=(raw,w)=>{const t=fmtTel(raw);if(!t||/^0[0]/.test(t))return;if(/^0[89]/.test(t)&&!/^0[89]00/.test(t)&&0)return;res.set(t,Math.max(res.get(t)||0,w))};
 for(const m of h.matchAll(/href=["']tel:([^"']+)["']/gi))add(decodeURIComponent(m[1]),3);
 const tx=text(h).replace(/\b\d{11,}\b/g," ");
 for(const m of tx.matchAll(/(?:t[ée]l(?:[ée]phone)?|phone|standard|contact|appel(?:ez)?|fixe|mobile|portable|fax)\s*(?:[:.\-–]|au)?\s*((?:\+|00)?[\d][\d\s.\-()]{8,17}\d)/gi)){const fax=/fax/i.test(m[0]);add(m[1],fax?0.5:2)}
 for(const m of tx.matchAll(/(?<![\d])((?:(?:\+|00)33[\s.\-]?\(?0?\)?|0)[1-9](?:[\s.\-]?\d{2}){4})(?![\d])/g))add(m[1],1);
 return [...res.entries()].filter(x=>x[1]>0.5).sort((a,b)=>b[1]-a[1]).map(x=>({v:x[0],mobile:/^0[67]/.test(x[0])}))}
function emails(html){const h=String(html||""),set=new Map();
 const add=(e,w)=>{e=String(e).trim().toLowerCase().replace(/^mailto:/,"").split("?")[0];if(!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(e))return;if(/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)||/(sentry|wixpress|example\.|domain\.|votre|email\.com|test@|noreply|no-reply|u00)/.test(e))return;set.set(e,Math.max(set.get(e)||0,w))};
 for(const m of h.matchAll(/href=["']mailto:([^"']+)["']/gi))add(decodeURIComponent(m[1]),3);
 for(const m of h.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi))add(decodeCf(m[1]),3);
 const tx=text(h).replace(/\s*[\[(]\s*(?:at|arobase)\s*[\])]\s*/gi,"@").replace(/\s+@\s+/g,"@");
 for(const m of tx.matchAll(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi))add(m[0],1);
 return [...set.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0])}
function links(html,base){const out=[];for(const m of String(html||"").matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const t=nz(text(m[2])+" "+m[1]);if(/contact|mention|legal|a propos|qui sommes|cgv|societe|coordonnees|nous trouver/.test(t)){if(/^(mailto|tel|javascript):/i.test(m[1]))continue;try{out.push(new URL(m[1],base).href)}catch(e){}}}return [...new Set(out)]}
function social(html){const o={};for(const m of String(html||"").matchAll(/href=["'](https?:\/\/(?:www\.)?(linkedin|facebook|instagram)\.com\/[^"'?#]+)/gi)){const k=m[2].toLowerCase();if(!o[k]&&!/sharer|share|plugins|login/.test(m[1]))o[k]=m[1]}return o}
function hasId(html,siren,siret){const d=String(html||"").replace(/[^\d]/g,"");return !!((siret&&d.includes(siret))||(siren&&d.includes(siren)))}
function titleMatch(html,nom,cp,ville){const t=nz(text(html).slice(0,60000)),w=nz(nom).replace(FORMES," ").split(" ").filter(x=>x.length>2);if(!w.length)return false;const nm=w.every(x=>t.includes(x));const loc=(cp&&t.includes(cp))||(ville&&t.includes(nz(ville)));return nm&&!!loc}
function hostOk(u){try{const x=new URL(u);if(!/^https?:$/.test(x.protocol))return false;const h=x.hostname;if(!h.includes(".")||/^(\d+\.){3}\d+$/.test(h)||/localhost|\.local$|\.internal$/.test(h))return false;return !BAD_DOM.test(h)}catch(e){return false}}
module.exports={nz,slugs,clean,text,phones,emails,links,social,hasId,titleMatch,hostOk,BAD_DOM,fmtTel};
