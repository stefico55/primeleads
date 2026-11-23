// Bâtiment d'un établissement dans la BDNB (API ouverte, sans clé) : surface au sol, hauteur, DPE, chauffage, propriétaires.
// Entrée POST {lat,lng,adresse}. Sélection : bâtiment à la même adresse, sinon celui qui contient le point, sinon le plus grand à moins de 60 m.
const API="https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet/bbox";
const COLS="batiment_groupe_id,s_geom_groupe,surface_emprise_sol,hauteur_mean,fiabilite_hauteur,fiabilite_emprise_sol,classe_bilan_dpe,classe_conso_energie_dpe_tertiaire,type_energie_chauffage_tertiaire,type_generateur_chauffage_tertiaire,type_energie_chauffage,type_generateur_chauffage,l_denomination_proprietaire,l_libelle_adr,annee_construction,usage_principal_bdnb_open,geom_groupe";
// WGS84 -> Lambert-93 (EPSG:2154), formule IGN
function l93(lat,lng){const e=0.0818191910428158,n=0.725607765053267,C=11754255.426096,r=Math.PI/180,p=lat*r,s=Math.sin(p);
 const L=0.5*Math.log((1+s)/(1-s))-e/2*Math.log((1+e*s)/(1-e*s)),R=C*Math.exp(-n*L),g=n*(lng-3)*r;return[700000+R*Math.sin(g),12655612.049876-R*Math.cos(g)]}
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\b(rue|avenue|av|bd|boulevard|chemin|ch|route|rte|allee|impasse|place|zi|za|zac|parc|de|du|des|la|le|les|d|l)\b/g," ").replace(/\s+/g," ").trim();
function adrKey(a){const m=norm(a).match(/^(\d+)\s*(?:bis|ter)?\s+(.*)$/);return m?{num:m[1],voie:m[2]}:{num:"",voie:norm(a)}}
function sameAdr(a,lst){const k=adrKey(a);if(!k.voie)return false;return(lst||[]).some(x=>{const v=norm(String(x).split(",")[0]),m=v.match(/^(\d+)\s*(?:bis|ter)?\s+(.*)$/);if(!m)return false;return m[1]===k.num&&(m[2]===k.voie||m[2].includes(k.voie)||k.voie.includes(m[2]))})}
function inRing(x,y,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
function contains(g,x,y){if(!g||!g.coordinates)return false;const polys=g.type==="Polygon"?[g.coordinates]:g.coordinates;return polys.some(p=>p&&p[0]&&inRing(x,y,p[0]))}
function dist(g,x,y){if(!g||!g.coordinates)return 1e9;let d=1e9;const polys=g.type==="Polygon"?[g.coordinates]:g.coordinates;polys.forEach(p=>(p[0]||[]).forEach(([a,b])=>{d=Math.min(d,Math.hypot(a-x,b-y))}));return d}
const up=v=>v==null?"":String(v);
module.exports=async(req,rsp)=>{
 rsp.setHeader("cache-control","no-store");
 if(req.method!=="POST")return rsp.status(405).json({err:"POST"});
 let p=req.body;if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){p={}}}p=p||{};
 const o=String(req.headers.origin||req.headers.referer||"");if(o&&!/primeleads|localhost|127\.0\.0\.1/.test(o))return rsp.status(403).json({err:"origine"});
 const lat=+p.lat,lng=+p.lng;if(!isFinite(lat)||!isFinite(lng)||!lat||!lng)return rsp.status(400).json({err:"coordonnees"});
 const[x,y]=l93(lat,lng),R=60,url=`${API}?xmin=${Math.round(x-R)}&ymin=${Math.round(y-R)}&xmax=${Math.round(x+R)}&ymax=${Math.round(y+R)}&limit=40&select=${COLS}`;
 let rows;try{const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);const r=await fetch(url,{signal:c.signal,headers:{accept:"application/json"}});clearTimeout(t);
  if(r.status===429)return rsp.status(429).json({err:"quota"});if(!r.ok)return rsp.status(502).json({err:"bdnb "+r.status});rows=await r.json()}catch(e){return rsp.status(504).json({err:"bdnb injoignable"})}
 if(!Array.isArray(rows)||!rows.length)return rsp.json({ok:true,found:false});
 let b=null,match="";
 const byAdr=rows.filter(r=>sameAdr(p.adresse,r.l_libelle_adr));
 if(byAdr.length){b=byAdr.sort((a,c)=>(c.s_geom_groupe||0)-(a.s_geom_groupe||0))[0];match="adresse"}
 if(!b){b=rows.find(r=>contains(r.geom_groupe,x,y));if(b)match="emprise"}
 if(!b){const near=rows.filter(r=>dist(r.geom_groupe,x,y)<=R).sort((a,c)=>(c.s_geom_groupe||0)-(a.s_geom_groupe||0));if(near.length){b=near[0];match="proche"}}
 if(!b)return rsp.json({ok:true,found:false});
 const en=up(b.type_energie_chauffage_tertiaire||b.type_energie_chauffage),gen=up(b.type_generateur_chauffage_tertiaire||b.type_generateur_chauffage);
 const out={ok:true,found:true,match,id:b.batiment_groupe_id,surface:Math.round(b.s_geom_groupe||b.surface_emprise_sol||0),hauteur:b.hauteur_mean!=null?Math.round(b.hauteur_mean):0,
  fiab_h:up(b.fiabilite_hauteur),dpe:up(b.classe_bilan_dpe||b.classe_conso_energie_dpe_tertiaire),chauffage:[en,gen].filter(Boolean).join(" ")||"inconnu",
  proprietaire:(b.l_denomination_proprietaire||[]).slice(0,3).join(", "),annee:b.annee_construction||null,usage:up(b.usage_principal_bdnb_open)};
 console.log(JSON.stringify({bdnb:out.id,match,surface:out.surface,n:rows.length}));
 return rsp.json(out)};
module.exports.config={maxDuration:15};
module.exports._t={l93,sameAdr,contains,API,COLS};
