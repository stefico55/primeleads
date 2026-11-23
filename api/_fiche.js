// Fiche complète côté serveur : registre officiel (société, dirigeants, propriétaires, voisins) + coordonnées (api/enrichir).
// Même logique que l'enrichissement du navigateur, pour qu'une recherche continue même appli fermée.
const ENR=require("./enrichir.js");
const API="https://recherche-entreprises.api.gouv.fr/search";
const FJ={5710:"SAS",5720:"SASU",5499:"SARL",5498:"EURL",5599:"SA",5505:"SA",5308:"SA",6540:"SCI",6541:"SCI de construction-vente",6551:"SCI",6598:"SCI",6599:"Société civile",5202:"SNC",5306:"SELARL",9220:"Association",6220:"GIE",1000:"Entrepreneur individuel",7210:"Commune",6521:"SCPI",6532:"SCI",6533:"GAEC"};
const EF={"00":"0 salarié","01":"1 à 2","02":"3 à 5","03":"6 à 9","11":"10 à 19","12":"20 à 49","21":"50 à 99","22":"100 à 199","31":"200 à 249","32":"250 à 499","41":"500 à 999","42":"1 000 à 1 999","51":"2 000 à 4 999","52":"5 000 à 9 999","53":"10 000 et plus"};
const MINSC=40;
const nz=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const tok=s=>nz(s).split(" ").filter(Boolean);
const same=(a,b)=>tok(a).sort().join()===tok(b).sort().join();
const cap=s=>String(s||"").toLowerCase().replace(/(^|[\s'-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
const now=()=>new Date().toISOString();
let last=0;
async function get(p){const w=Math.max(0,last+170-Date.now());last=Date.now()+w;if(w)await new Promise(r=>setTimeout(r,w));
 const u=API+"?"+new URLSearchParams({per_page:5,...p});
 for(let i=0;i<3;i++){try{const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);const r=await fetch(u,{signal:c.signal});clearTimeout(t);
  if(r.status===429){await new Promise(x=>setTimeout(x,900*(i+1)));continue}if(!r.ok)return null;return await r.json()}catch(e){if(i===2)return null}}return null}
const card=r=>{const f=r.finances||{},y=Object.keys(f).sort().pop(),d=r.dirigeants||[];
 return{siren:r.siren,nom:r.nom_complet,forme:FJ[r.nature_juridique]||("Forme "+r.nature_juridique),cree:r.date_creation,eff:EF[r.tranche_effectif_salarie]||null,effA:r.annee_tranche_effectif_salarie,cat:r.categorie_entreprise,
 ca:y?f[y].ca:null,rn:y?f[y].resultat_net:null,an:y||null,nEt:r.nombre_etablissements,nOu:r.nombre_etablissements_ouverts,adr:(r.siege||{}).adresse,naf:r.activite_principale,actif:r.etat_administratif==="A",
 bio:!!(r.complements&&r.complements.est_bio),sci:String(r.nature_juridique).startsWith("65")||String(r.activite_principale).startsWith("68"),
 dir:d.filter(x=>x.type_dirigeant==="personne physique").map(x=>({n:cap([String(x.prenoms||"").split(",")[0].trim(),x.nom].filter(Boolean).join(" ")),f:x.qualite||""})),
 mor:d.filter(x=>x.type_dirigeant==="personne morale"&&!/commissaire/i.test(x.qualite||"")).map(x=>({n:x.denomination,siren:x.siren,f:x.qualite||""}))}};
async function bySiret(l){if(!l.siret)return null;const j=await get({q:String(l.siret),per_page:1});return j===null?undefined:(j.results&&j.results[0]?card(j.results[0]):null)}
async function byName(name,cp){const dep=String(cp||"").slice(0,2),t=tok(name);if(!t.length)return null;
 for(const p of [{q:name,departement:dep},{q:name}]){if(!dep&&p.departement)continue;const j=await get(p);if(j===null)return undefined;
  const ok=(j.results||[]).filter(r=>{const n=tok(r.nom_complet);return t.every(x=>n.includes(x))});
  if(ok.length){const ex=ok.find(r=>same(r.nom_complet,name)||same(r.nom_raison_sociale,name));const r=ex||ok[0];
   const loc=String((r.siege||{}).departement)===dep;return{c:card(r),fiab:(ex&&loc)||(ok.length===1&&loc)?"ok":"a-confirmer"}}}
 return null}
async function voisins(l,skip){const num=nz(l.adresse);if(!num||!l.cp)return null;const j=await get({q:l.adresse,code_postal:l.cp,per_page:25,minimal:"true",include:"siege"});if(j===null)return undefined;
 const out=(j.results||[]).filter(r=>nz((r.siege||{}).adresse).includes(num)&&!skip.has(r.siren)).map(r=>({nom:r.nom_complet,siren:r.siren,naf:r.activite_principale,eff:EF[r.tranche_effectif_salarie]||null,sci:String(r.nature_juridique).startsWith("65")||String(r.activite_principale).startsWith("68"),actif:r.etat_administratif==="A"}));
 return{liste:out.filter(x=>x.actif).slice(0,12),total:j.total_results}}
const pid=()=>"p"+Math.random().toString(36).slice(2,9);
function addPeople(l,org,dirs){l.people=l.people||[];dirs.forEach(d=>{if(!d.n)return;if(l.people.some(p=>p.o===org&&same(p.n,d.n)))return;l.people.push({id:pid(),n:d.n,f:d.f||"",o:org,t:"",e:"",src:"RNE"})})}
function fill(l){const E=l.enr&&l.enr.ent;if(!E||!E.dir||!E.dir[0])return;l.q=l.q||{};if(!l.q.contact){l.q.contact=E.dir[0].n;if(!l.q.fonction&&E.dir[0].f)l.q.fonction=E.dir[0].f;l.q.contactSrc="RNE"}}
let gate=Promise.resolve();const slot=()=>{const x=gate.then(()=>new Promise(r=>setTimeout(r,1100)));gate=x;return x};// Brave : 1 requête/s
async function contacts(l,e,guess){const nom=(e.ent&&e.ent.nom)||l.entreprise;if(!nom)return false;
 if(!guess)await slot();
 const r=await ENR.core({nom,siren:e.ent&&e.ent.siren,siret:l.siret,cp:l.cp,ville:l.ville,adresse:l.adresse||"",site:(l.q&&l.q.site)||"",nosearch:!!guess});
 if(!r||r.err||r.retry)return false;
 const pv=e.ct;e.ct={tel:r.tel||null,tels:r.tels||[],email:r.email||null,emails:r.emails||[],site:r.site||null,siteFiab:r.siteFiab||null,social:r.social||{},fiab:r.fiab||"aucune",src:r.src||[],cle:r.cle!==false,g:!!guess,r3:true,r4:true,r5:true,srv:true,t:now()};
 if(pv&&guess&&!pv.g){["tel","email","tels","emails","fiab","src"].forEach(k=>{const v=e.ct[k];if(!v||(Array.isArray(v)&&!v.length)||v==="aucune")e.ct[k]=pv[k]});e.ct.cle=pv.cle;e.ct.g=false}
 l.q=l.q||{};if(!l.q.tel&&e.ct.tel)l.q.tel=e.ct.tel;if(!l.q.email&&e.ct.email)l.q.email=e.ct.email;if(!l.q.site&&e.ct.site)l.q.site=e.ct.site;return e.ct.cle!==false}
// Fiche complète d'un bâtiment. Modifie l et renvoie true si quelque chose a été fait.
async function run(l,force){
 if(l.enr&&l.enr.v>=1&&l.enr.ent!==undefined){fill(l);const pc=l.enr.ct;if(!force&&pc&&!pc.site&&!pc.r4&&(pc.cle||pc.g)&&!(pc.cle===false&&(l.score||0)>=MINSC)){await contacts(l,l.enr,true);return true}if(force||(l.score||0)>=MINSC){const ok=await contacts(l,l.enr);if(ok)l.enr.v=2}else{await contacts(l,l.enr,true);l.enr.g=true}return true}
 const e={t:now(),v:1,ent:null,own:[],aut:[],voi:null,srv:true};
 const ent=await bySiret(l);
 if(ent===null||ent===undefined){const n=await byName(l.entreprise,l.cp);if(n===undefined&&ent===undefined)return false;if(n&&n.c)e.ent=n.c}else e.ent=ent;
 const skip=new Set(e.ent?[e.ent.siren]:[]);
 const own=(l.proprietaire||"").split(",").map(s=>s.trim()).filter(Boolean);
 for(const nm of own){const r=await byName(nm,l.cp);if(r&&r.c){e.own.push({nom:nm,c:r.c,fiab:r.fiab});skip.add(r.c.siren)}else e.own.push({nom:nm,c:null})}
 for(const nm of (l.autres||[])){const r=await byName(nm,l.cp);if(r&&r.c){e.aut.push({nom:nm,c:r.c,fiab:r.fiab});skip.add(r.c.siren)}else e.aut.push({nom:nm,c:null})}
 e.voi=await voisins(l,skip)||null;
 if(e.ent){addPeople(l,l.entreprise||e.ent.nom,e.ent.dir);if(!l.dirigeant&&e.ent.dir[0])l.dirigeant=e.ent.dir[0].n;if(!l.naf&&e.ent.naf)l.naf=e.ent.naf}
 e.own.forEach(o=>{if(o.c)addPeople(l,o.nom,o.c.dir)});e.aut.forEach(o=>{if(o.c)addPeople(l,o.nom,o.c.dir)});
 l.enr=e;fill(l);if(force||(l.score||0)>=MINSC){const okc=await contacts(l,e);if(okc)e.v=2}else{await contacts(l,e,true);e.g=true}return true}
// Champs que le serveur écrit : le reste de la fiche (statut, notes, journal…) reste celui de la base au moment de l'écriture.
const FIELDS=["enr","people","dirigeant","naf"];
function merge(base,done){const out={...base};FIELDS.forEach(k=>{if(done[k]!==undefined)out[k]=done[k]});
 const bq=base.q||{},dq=done.q||{};out.q={...bq};
 if(!bq.contact&&dq.contact){out.q.contact=dq.contact;if(!bq.fonction&&dq.fonction)out.q.fonction=dq.fonction;if(dq.contactSrc)out.q.contactSrc=dq.contactSrc}
 ["tel","email","site"].forEach(k=>{if(!bq[k]&&dq[k])out.q[k]=dq[k]});return out}
module.exports={run,merge,MINSC,_t:{card,byName,nz}};
