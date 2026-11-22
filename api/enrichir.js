// Fonction gratuite : coordonnées publiques d'une entreprise (OpenStreetMap, site officiel, mentions légales).
const L=require("./_lib.js");
const UA="Mozilla/5.0 (compatible; PrimeLeadsBot/1.0; +https://primeleads-app.vercel.app)";
const T0=()=>Date.now();
const DBG=[];
async function get(url,ms=4500,opt={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"user-agent":UA,"accept-language":"fr-FR,fr;q=0.9","accept":"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5"},...opt});DBG.push(url.slice(0,70)+" -> "+r.status);if(!r.ok)return null;const ct=r.headers.get("content-type")||"";if(!/html|json|text/.test(ct))return null;const b=await r.text();return{url:r.url,body:b.slice(0,400000)}}catch(e){DBG.push(url.slice(0,70)+" ERR "+(e&&(e.cause&&e.cause.code||e.name||e.message)));return null}finally{clearTimeout(t)}}
async function osm(lat,lng,nom){if(!lat||!lng)return null;const q=`[out:json][timeout:8];nwr(around:90,${lat},${lng})["name"];out tags center 40;`;
 let r=null;for(const ep of ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]){r=await get(ep,9000,{method:"POST",headers:{"user-agent":"PrimeLeads/1.0 (+https://primeleads-app.vercel.app)","content-type":"application/x-www-form-urlencoded","accept":"*/*"},body:"data="+encodeURIComponent(q)});if(r)break}
 if(!r)return null;let j;try{j=JSON.parse(r.body)}catch(e){return null}
 const w=L.nz(nom).replace(/\b(sas|sarl|eurl|sa|sci|groupe)\b/g," ").split(" ").filter(x=>x.length>2);
 const best=(j.elements||[]).map(e=>e.tags||{}).map(t=>{const n=L.nz(t.name),hit=w.length&&w.every(x=>n.includes(x));return{t,hit}}).filter(x=>x.hit)[0];
 if(!best)return null;const t=best.t,tel=t.phone||t["contact:phone"]||t["contact:mobile"],mail=t.email||t["contact:email"],site=t.website||t["contact:website"];
 return{tel:tel?L.fmtTel(String(tel).split(";")[0]):null,email:mail?String(mail).split(";")[0].toLowerCase():null,site:site||null}}
async function search(nom,ville){const qq=encodeURIComponent(`${nom} ${ville||""}`.trim());const engines=[["https://www.bing.com/search?setlang=fr&q="+qq,"bing.com"],["https://www.mojeek.com/search?q="+qq,"mojeek.com"],["https://lite.duckduckgo.com/lite/?q="+qq,"duckduckgo.com"]];
 for(const [u,dom] of engines){const r=await get(u,5000);if(!r)continue;const out=[];
  for(const m of r.body.matchAll(/href="(https?:\/\/[^"]+)"/g)){let h=m[1].replace(/&amp;/g,"&");const x=h.match(/uddg=([^&]+)/);if(x)h=decodeURIComponent(x[1]);if(h.includes(dom)||/microsoft|bing\.|w3\.org|schema\.org/.test(h))continue;if(L.hostOk(h)){try{out.push(new URL(h).origin)}catch(e){}}}
  const u2=[...new Set(out)].slice(0,4);if(u2.length)return u2}
 return[]}
async function inspect(origin,p,fromSearch){const home=await get(origin,4500);if(!home)return null;let pages=[home];const lk=L.links(home.body,home.url).filter(u=>{try{return new URL(u).hostname.replace(/^www\./,"")===new URL(home.url).hostname.replace(/^www\./,"")}catch(e){return false}}).slice(0,4);
 const more=await Promise.all(lk.slice(0,3).map(u=>get(u,4000)));pages=pages.concat(more.filter(Boolean));
 const all=pages.map(x=>x.body).join("\n");const ident=L.hasId(all,p.siren,p.siret);const loc=pages.some(x=>L.titleMatch(x.body,p.nom,p.cp,p.ville));
 const host=(()=>{try{return new URL(home.url).hostname.replace(/^www\./,"").split(".")[0]}catch(e){return""}})();
 const nt=L.nz(p.nom).replace(/\b(sas|sarl|eurl|sa|sci|snc|groupe|societe|ets)\b/g," ").split(" ").filter(x=>x.length>2);
 const slugOk=nt.length>0&&(host===nt.join("")||host===nt.join("-")||host.replace(/-/g,"")===nt.join(""));
 const nameIn=nt.length>0&&nt.every(x=>L.nz(L.text(home.body).slice(0,40000)).includes(x));
 const hostTok=nt.some(x=>x.length>3&&host.includes(x));
 const accept=ident||(fromSearch?(loc&&hostTok):(loc||(slugOk&&nameIn)));
 DBG.push("inspect "+host+" ident="+ident+" loc="+loc+" slug="+slugOk+" name="+nameIn+" accept="+accept+" tel="+L.phones(all).length+" mail="+L.emails(all).length);
 return{site:home.url.replace(/\/+$/,""),ident,loc,accept,tel:L.phones(all),email:L.emails(all),social:L.social(all)}}
module.exports=async(req,rsp)=>{
 rsp.setHeader("cache-control","no-store");
 if(req.method!=="POST")return rsp.status(405).json({err:"POST"});
 let p=req.body;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){p={}}}p=p||{};
 const o=String(req.headers.origin||req.headers.referer||"");if(o&&!/primeleads|localhost|127\.0\.0\.1/.test(o))return rsp.status(403).json({err:"origine"});
 const nom=String(p.nom||"").slice(0,120);if(!nom)return rsp.status(400).json({err:"nom"});
 const q={nom,siren:String(p.siren||"").replace(/\D/g,"").slice(0,9),siret:String(p.siret||"").replace(/\D/g,"").slice(0,14),cp:String(p.cp||"").slice(0,5),ville:String(p.ville||"").slice(0,60),lat:+p.lat||0,lng:+p.lng||0,site:String(p.site||"")};
 DBG.length=0;const t0=T0(),src=[],out={tel:null,email:null,site:null,social:{},fiab:"aucune",src,tried:[]};
 // 1. OpenStreetMap (gratuit) + site déjà connu, en parallèle avec les domaines probables
 const cand=new Set();if(q.site&&L.hostOk(q.site)){try{cand.add(new URL(q.site).origin)}catch(e){}}
 const [o1]=await Promise.all([osm(q.lat,q.lng,nom)]);
 if(o1){if(o1.site&&L.hostOk(o1.site)){try{cand.add(new URL(o1.site).origin)}catch(e){}}src.push("OpenStreetMap")}
 L.slugs(nom).forEach(d=>cand.add("https://"+d));
 // 2. inspection des candidats (domaines probables) en parallèle, verrouillage par SIREN ou nom+ville
 let res=await Promise.all([...cand].slice(0,8).map(c=>inspect(c,q).catch(()=>null)));
 let ok=res.filter(r=>r&&r.accept);
 // 3. repli : moteur de recherche
 if(!ok.length&&Date.now()-t0<14000){const urls=await search(nom,q.ville);out.tried.push("recherche web");const r2=await Promise.all(urls.map(c=>inspect(c,q,true).catch(()=>null)));ok=r2.filter(r=>r&&r.accept)}
 ok.sort((a,b)=>(b.ident-a.ident)||(b.tel.length+b.email.length)-(a.tel.length+a.email.length));
 const best=ok[0];
 if(best){out.site=best.site;out.social=best.social;src.push("Site de l'entreprise");
  const dom=(()=>{try{return new URL(best.site).hostname.replace(/^www\./,"")}catch(e){return""}})();
  const em=best.email.sort((a,b)=>(b.endsWith("@"+dom))-(a.endsWith("@"+dom)));
  out.email=em[0]||null;out.emails=em.slice(0,4);out.tel=(best.tel.find(x=>!x.mobile)||best.tel[0]||{}).v||null;out.tels=best.tel.slice(0,4).map(x=>x.v);out.fiab=best.ident?"verifie":"probable"}
 if(o1){if(!out.tel&&o1.tel){out.tel=o1.tel;out.tels=[o1.tel]}if(!out.email&&o1.email){out.email=o1.email;out.emails=[o1.email]}if(!out.site&&o1.site)out.site=o1.site;if(out.fiab==="aucune"&&(o1.tel||o1.email||o1.site))out.fiab="probable"}
 out.ms=Date.now()-t0;if(p.debug)out.dbg=DBG.slice(0,25);return rsp.status(200).json(out)};
module.exports.config={maxDuration:30};
