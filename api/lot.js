// File d'enrichissement côté serveur : POST {refs:[...]} avec le jeton de session de l'utilisateur (Authorization: Bearer …).
// Lit les fiches dans Supabase avec les droits de l'utilisateur (RLS), complète chaque fiche (registre + coordonnées),
// l'enregistre aussitôt, et renvoie l'avancement ligne par ligne (NDJSON). Le travail continue si l'onglet est fermé.
const F=require("./_fiche.js");
const SB=process.env.SUPABASE_URL||"https://ypmwhynacdynjvylacwl.supabase.co";
const KEY=process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_hfh92ZmPEDl5_SlxlVvOug_jBg2t9vz";
const BUDGET=250000,MAXREFS=60,CONC=3;
async function sb(path,jwt,opt={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
 try{const r=await fetch(SB+path,{...opt,signal:c.signal,headers:{apikey:KEY,authorization:"Bearer "+jwt,"content-type":"application/json",...(opt.headers||{})}});
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}return{ok:r.ok,status:r.status,j}}
 catch(e){return{ok:false,status:0,j:null}}finally{clearTimeout(t)}}
const q=s=>'"'+String(s).replace(/["\\]/g,"")+'"';
module.exports=async(req,rsp)=>{
 rsp.setHeader("cache-control","no-store");
 if(req.method!=="POST")return rsp.status(405).json({err:"POST"});
 const o=String(req.headers.origin||req.headers.referer||"");if(o&&!/primeleads|localhost|127\.0\.0\.1/.test(o))return rsp.status(403).json({err:"origine"});
 const jwt=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!jwt)return rsp.status(401).json({err:"session"});
 let p=req.body;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){p={}}}p=p||{};
 const refs=[...new Set((Array.isArray(p.refs)?p.refs:[]).map(String))].slice(0,MAXREFS);if(!refs.length)return rsp.status(400).json({err:"refs"});
 const force=new Set((Array.isArray(p.force)?p.force:[]).map(String));
 const u=await sb("/auth/v1/user",jwt);if(!u.ok||!u.j||!u.j.id)return rsp.status(401).json({err:"session"});
 const uid=u.j.id,m=await sb(`/rest/v1/membres?select=org_id&user_id=eq.${uid}&limit=1`,jwt);
 const org=m.ok&&m.j&&m.j[0]&&m.j[0].org_id;if(!org)return rsp.status(403).json({err:"organisation"});
 const t0=Date.now();rsp.statusCode=200;rsp.setHeader("content-type","application/x-ndjson; charset=utf-8");
 const send=o=>{try{rsp.write(JSON.stringify(o)+"\n")}catch(e){}};
 send({start:true,n:refs.length});
 const rows=await sb(`/rest/v1/batiments?select=ref,data&org_id=eq.${org}&ref=in.(${refs.map(q).join(",")})`,jwt);
 if(!rows.ok||!Array.isArray(rows.j)){send({err:"lecture"});return rsp.end()}
 const todo=rows.j.map(r=>({ref:String(r.ref),data:r.data||{}}));const reste=new Set(todo.map(x=>x.ref));let i=0,ok=0;
 const work=async()=>{while(i<todo.length&&Date.now()-t0<BUDGET){const it=todo[i++],l=JSON.parse(JSON.stringify(it.data));
  let done=false;try{done=await F.run(l,force.has(it.ref))}catch(e){console.log(JSON.stringify({lot_err:it.ref,e:String(e&&e.message||e)}))}
  if(!done){reste.delete(it.ref);send({ref:it.ref,ok:false});continue}
  // relire juste avant d'écrire, pour ne pas écraser une modification faite entre-temps par un commercial
  const cur=await sb(`/rest/v1/batiments?select=data&org_id=eq.${org}&ref=eq.${encodeURIComponent(it.ref)}`,jwt);
  const base=cur.ok&&cur.j&&cur.j[0]?cur.j[0].data:it.data,merged=F.merge(base,l);
  const w=await sb(`/rest/v1/batiments?org_id=eq.${org}&ref=eq.${encodeURIComponent(it.ref)}`,jwt,{method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({data:merged,updated_at:new Date().toISOString(),updated_by:uid})});
  reste.delete(it.ref);if(w.ok)ok++;send({ref:it.ref,ok:w.ok,lead:merged})}};
 await Promise.all(Array.from({length:CONC},work));
 console.log(JSON.stringify({lot:refs.length,ok,reste:reste.size,ms:Date.now()-t0}));
 send({done:true,ok,reste:[...reste]});rsp.end()};
module.exports.config={maxDuration:300};
