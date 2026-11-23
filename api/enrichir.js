// Coordonnées publiques d'une entreprise par recoupement : API de recherche (clé BRAVE_API_KEY) + sites lus avec une identification honnête.
const L=require("./_lib.js");
const UA="Mozilla/5.0 (compatible; PrimeLeadsBot/1.0; +https://primeleads-app.vercel.app)";
const DBG=[];
async function get(url,ms=4500,hd={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,redirect:"follow",headers:{"user-agent":UA,"accept-language":"fr-FR,fr;q=0.9","accept":"text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",...hd}});DBG.push(url.slice(0,70)+" -> "+r.status);if(!r.ok)return{status:r.status};const ct=r.headers.get("content-type")||"";if(!/html|text|json/.test(ct))return{status:415};const b=await r.text();return{status:200,url:r.url,body:b.slice(0,500000),h:r.headers}}catch(e){DBG.push(url.slice(0,70)+" ERR "+(e&&(e.cause&&e.cause.code||e.name)));return{status:0}}finally{clearTimeout(t)}}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return""}};
const SKIP=/(facebook\.|linkedin\.|instagram\.|twitter\.|x\.com|youtube\.|wikipedia|tiktok|pinterest|amazon\.)/i;
async function brave(q,key){const r=await get("https://api.search.brave.com/res/v1/web/search?count=10&country=fr&search_lang=fr&extra_snippets=true&q="+encodeURIComponent(q),7000,{"accept":"application/json","x-subscription-token":key});
 if(r.status===429)return{retry:true};if(r.status!==200)return{err:r.status};let j;try{j=JSON.parse(r.body)}catch(e){return{err:"json"}}
 return{res:((j.web&&j.web.results)||[]).map(x=>({url:x.url,title:x.title||"",txt:[x.description||""].concat(x.extra_snippets||[]).join(" \n ")})),rl:r.h&&r.h.get("x-ratelimit-remaining")}}
module.exports=async(req,rsp)=>{
 rsp.setHeader("cache-control","no-store");
 if(req.method!=="POST")return rsp.status(405).json({err:"POST"});
 let p=req.body;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){p={}}}p=p||{};
 const o=String(req.headers.origin||req.headers.referer||"");if(o&&!/primeleads|localhost|127\.0\.0\.1/.test(o))return rsp.status(403).json({err:"origine"});
 const nom=String(p.nom||"").slice(0,120);if(!nom)return rsp.status(400).json({err:"nom"});
 const q={nom,siren:String(p.siren||"").replace(/\D/g,"").slice(0,9),siret:String(p.siret||"").replace(/\D/g,"").slice(0,14),cp:String(p.cp||"").slice(0,5),ville:String(p.ville||"").slice(0,60),site:String(p.site||"")};
 DBG.length=0;const t0=Date.now(),key=p.nosearch?"":(process.env.BRAVE_API_KEY||"");
 const nt=L.nz(nom).replace(/\b(sas|sarl|eurl|sa|sci|snc|groupe|societe|ets)\b/g," ").split(" ").filter(x=>x.length>2);
 const vil=L.nz(q.ville);
 const cand=new Map(),add=(u,k)=>{const h=host(u);if(!h||SKIP.test(h)||cand.has(h))return;cand.set(h,{url:u,kind:k})};
 if(q.site)try{add(new URL(q.site).origin,"site")}catch(e){}
 // 1. recherche (1 requête, 2e seulement si rien de fiable) ; 2. extraits des résultats
 const snippets=[],locHosts=new Set();let rl=null,sErr=null,snipAll="";
 const handle=r=>{if(r.retry){sErr="retry";return}if(r.err){sErr="err"+r.err;return}rl=r.rl||rl;r.res.forEach(x=>{snipAll+=" "+x.url+" "+x.title+" "+x.txt;const tx=L.nz(x.title+" "+x.txt),rel=nt.length&&nt.every(t=>tx.includes(t)),loc=tx.includes(q.cp)||(vil&&tx.includes(vil))||(q.siren&&(x.title+x.txt).replace(/\D/g,"").includes(q.siren));
   if(loc)locHosts.add(host(x.url));if(rel&&loc)snippets.push({host:host(x.url),txt:x.title+" \n "+x.txt});add(x.url,L.hostOk(x.url)?"result":"dir")})};
 if(key){handle(await brave(`${nom} ${q.ville} contact`,key));if(sErr==="retry")return rsp.status(200).json({retry:true})}
 // adresses devinées après les résultats de recherche, pour que ceux-ci soient lus en priorité
 L.slugs(nom).forEach(d=>add("https://"+d,"guess"));
 const tokOk=u=>{const h=host(u).split(".")[0];return nt.some(x=>x.length>3&&h.includes(x))||(nt.length&&h.replace(/-/g,"")===nt.join(""))};
 const readPages=async list=>(await Promise.all(list.map(async c=>{const home=await get(c.url,4500);
   const snipLoc=c.kind==="result"&&locHosts.has(host(c.url))&&L.hostOk(c.url)&&tokOk(c.url);
   if(home.status!==200)return snipLoc?{host:host(c.url),site:new URL(c.url).origin,own:false,prob:true,ident:false,ph:[],em:[],social:{},txt:""}:null;let all=home.body;
   if(c.kind!=="dir"&&L.hostOk(home.url)){const lk=L.links(home.body,home.url).filter(u=>host(u)===host(home.url)).slice(0,3);const more=await Promise.all(lk.map(u=>get(u,3500)));all+="\n"+more.filter(x=>x.status===200).map(x=>x.body).join("\n")}
   const ident=L.hasId(all,q.siren,q.siret),h=host(home.url).split(".")[0],loc=L.titleMatch(all,nom,q.cp,q.ville),slug=nt.length&&(h===nt.join("")||h===nt.join("-")||h.replace(/-/g,"")===nt.join("")),hostTok=nt.some(x=>x.length>3&&h.includes(x)),nameIn=nt.length&&nt.every(x=>L.nz(L.text(home.body).slice(0,40000)).includes(x));
   const own=c.kind!=="dir"&&L.hostOk(home.url)&&((ident&&(hostTok||slug||c.kind!=="result"))||(c.kind==="guess"?(loc||(slug&&nameIn)):(loc&&hostTok)));
   const dirOk=ident&&!own,prob=!own&&!dirOk&&L.hostOk(home.url)&&tokOk(home.url)&&(snipLoc||(c.kind==="guess"&&nameIn));DBG.push(`page ${host(home.url)} ${c.kind} ident=${ident} loc=${loc} own=${own} tel=${L.phones(all).length}`);
   const pend=!own&&c.kind==="guess"&&slug&&L.hostOk(home.url);
   if(!own&&!dirOk&&!pend&&!prob)return null;return{host:host(home.url),site:home.url.replace(/\/+$/,""),own,prob:prob&&!pend,pend:pend&&!dirOk,ident,ph:L.phones(all),em:L.emails(all),social:L.social(all),txt:dirOk?all.toLowerCase().slice(0,150000):""}}))).filter(Boolean);
 let pages=await readPages([...cand.values()].slice(0,12));
 // 2e requête avec le SIREN seulement si on n'a rien de vérifiable
 if(key&&!sErr&&q.siren&&!pages.some(x=>x.own||x.ident)&&!snippets.length&&Date.now()-t0<15000){const before=new Set(cand.keys());handle(await brave(`"${q.siren}" ${nom}`,key));const fresh=[...cand.entries()].filter(([h])=>!before.has(h)).map(x=>x[1]).slice(0,6);pages=pages.concat(await readPages(fresh))}
 // un site au nom exact de la société, même vide, est retenu si au moins un annuaire ou un résultat le cite
 {const corpus=(snipAll+" "+pages.map(x=>x.txt||"").join(" ")).toLowerCase();pages.forEach(pg=>{if(pg.pend){if(corpus.includes(pg.host.toLowerCase()))pg.own=true;else pg.prob=true;pg.pend=false}});pages=pages.filter(x=>!x.pend)}
 snippets.forEach(s=>pages.push({host:s.host,site:null,own:false,ident:false,ph:L.phones(s.txt),em:L.emails(s.txt),social:{},snip:true}));
 const vote=sel=>{const m=new Map();pages.forEach(pg=>{const seen=new Set();sel(pg).forEach((v,k)=>{if(seen.has(v))return;seen.add(v);const e=m.get(v)||{n:0,own:false,r:k};e.n++;if(pg.own)e.own=true;e.r=Math.min(e.r,k);m.set(v,e)})});return [...m.entries()].sort((a,b)=>(b[1].own-a[1].own)||(b[1].n-a[1].n)||(a[1].r-b[1].r)).map(x=>({v:x[0],n:x[1].n,own:x[1].own}))};
 const tels=vote(pg=>pg.ph.filter(x=>!x.mobile||pg.own).map(x=>x.v)),mails=vote(pg=>pg.em);
 const ownPg=pages.find(x=>x.own),probPg=ownPg?null:pages.find(x=>x.prob),src=[];if(ownPg)src.push("Site de l'entreprise");else if(probPg)src.push("Site probable");const dirs=[...new Set(pages.filter(x=>!x.own&&!x.prob).map(x=>x.host))].slice(0,4);if(dirs.length)src.push("Recoupement : "+dirs.join(", "));
 const strong=a=>a&&(a.own||a.n>=2);
 const out={tel:tels[0]?tels[0].v:null,tels:tels.slice(0,4).map(x=>x.v),email:mails[0]?mails[0].v:null,emails:mails.slice(0,4).map(x=>x.v),site:ownPg?ownPg.site:probPg?probPg.site:null,siteFiab:ownPg?"verifie":probPg?"probable":null,social:ownPg?ownPg.social:probPg?probPg.social:{},src,rl,
  fiab:(tels.length||mails.length||ownPg||probPg)?((strong(tels[0])||strong(mails[0])||(ownPg&&ownPg.ident))?"verifie":"probable"):"aucune",cle:!!key,ms:Date.now()-t0};
 if(p.nosearch)out.note="Recherche web non lancée (score bas) : seuls les domaines devinés sont testés";else if(!key)out.note="BRAVE_API_KEY absente : seuls les domaines devinés sont testés";if(sErr)out.sErr=sErr;if(p.debug)out.dbg=DBG.slice(0,40);
 return rsp.status(200).json(out)};
module.exports.config={maxDuration:30};
