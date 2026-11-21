/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.15) - Calcul > « Importer note Caneco ».
   Charge APRES etude-calcul.js (utilise ECC_CAB, eccCables, eccCircuit, eelCle, eelTexte, eprCategories, ECB_DATA, ecbCharger,
   STATE.etudeMat*, STATE.etudeBtLiensCaneco, openModal, toast...).

   On importe UNIQUEMENT les informations de cable et de protection de chaque circuit de l'export « Circuits » d'une note de calcul
   Caneco (zip des exports, ou le seul fichier Circuits.XLS). Le serveur lit le fichier (POST /api/etude-elec/caneco-lire, sans ecriture) ;
   le rapprochement et l'enregistrement se font ici :
     - circuit Caneco <-> depart de la base : par le repere (Repere Caneco = tag du consommateur) ;
     - type de cable Caneco -> famille de NOTRE catalogue ; bloc de coupure Caneco -> constructeur / categorie / gamme ; bloc declencheur
       Caneco -> declencheur : par correspondance exacte du nom, sinon par un LIEN etabli par l'utilisateur (etudeBtLiensCaneco, reutilise
       aux imports suivants) ;
     - le libelle d'origine de Caneco est TOUJOURS conserve (champs caneco* du circuit), meme sans lien.
   ========================================================= */

var ECN = {data: null, projet: null, fichier: null, liens: {}, nouveaux: 0};   // liens : surcharge locale (cle -> lien | null) en attendant la synchro

function ecnNorm(s){ return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function ecnSansParentheses(s){ return String(s || '').replace(/\([^)]*\)/g, ' '); }

/* ---------- liens ---------- */
function ecnLien(type, cle){
  var k = type + '|' + cle;
  if(Object.prototype.hasOwnProperty.call(ECN.liens, k)) return ECN.liens[k];
  return (STATE.etudeBtLiensCaneco || []).filter(function(l){ return l.type === type && l.cle === cle; })[0] || null;
}
/* resolutions : { ... , source: 'lien' | 'auto' } ou null */
function ecnResoudreCable(typeCable){
  if(!typeCable) return null;
  var cle = ecnNorm(typeCable), l = ecnLien('cable', cle);
  var fams = (ECB_DATA.familles || []).map(function(f){ return f.famille; });
  if(l && l.famille && fams.indexOf(l.famille) >= 0) return {famille: l.famille, source: 'lien'};
  var n1 = ecnNorm(typeCable), n2 = ecnNorm(ecnSansParentheses(typeCable));
  var t = fams.filter(function(f){ var n = ecnNorm(f); return n === n1 || n === n2; })[0];
  return t ? {famille: t, source: 'auto'} : null;
}
function ecnResoudreProt(bloc){
  if(!bloc) return null;
  var cle = ecnNorm(bloc), l = ecnLien('protection', cle);
  var disj = STATE.etudeMatDisj || [];
  if(l && l.constructeur && l.gamme && disj.some(function(x){ return x.constructeur === l.constructeur && x.gamme === l.gamme; })){
    return {constructeur: l.constructeur, categorie: l.categorie || '', gamme: l.gamme, variante: l.variante || '', source: 'lien'};
  }
  var cc = ecnCompact(bloc);
  var d = disj.filter(function(x){ return ecnNorm(x.gamme) === cle || ecnCompact(x.gamme) === cc; })[0];
  return d ? {constructeur: d.constructeur, categorie: d.categorie || '', gamme: d.gamme, variante: '', source: 'auto'} : null;
}
function ecnResoudreDecl(bloc){
  if(!bloc) return null;
  var cle = ecnNorm(bloc), l = ecnLien('declencheur', cle), decl = STATE.etudeMatDecl || [];
  if(l && l.declencheur && decl.some(function(x){ return x.code === l.declencheur; })) return {declencheur: l.declencheur, source: 'lien'};
  var cc = ecnCompact(bloc);
  var d = decl.filter(function(x){ return ecnNorm(x.code) === cle || ecnCompact(x.code) === cc; })[0];
  return d ? {declencheur: d.code, source: 'auto'} : null;
}

/* ---------- suggestions automatiques (V3.17) : on PROPOSE, l'utilisateur confirme ; rien n'est enregistre sans « Enregistrer » ---------- */
function ecnCompact(s){ return ecnNorm(ecnSansParentheses(s)).replace(/[^a-z0-9.]/g, ''); }
function ecnAltsGamme(gamme){
  return String(gamme || '').split('/').map(function(a){ return ecnNorm(a).replace(/compact|masterpact|acti ?9|tesys|multi ?9/g, '').replace(/[^a-z0-9]/g, ''); }).filter(function(a){ return a.length >= 2; });
}
/* bloc de coupure Caneco (ex. NSX250HB1) -> {constructeur, categorie, gamme, variante, why} ; ou {candidats:[...]} si ambigu ; ou null */
function ecnSuggProt(bloc){
  var b = ecnCompact(bloc).replace(/\./g, ''); if(!b) return null;
  var vus = {}, meilleur = 0, liste = [];
  (STATE.etudeMatDisj || []).forEach(function(x){
    var k = x.constructeur + '|' + x.categorie + '|' + x.gamme; if(vus[k]) return; vus[k] = 1;
    ecnAltsGamme(x.gamme).forEach(function(a){
      if(b.indexOf(a) !== 0) return;
      if(a.length > meilleur){ meilleur = a.length; liste = []; }
      if(a.length === meilleur) liste.push({constructeur: x.constructeur, categorie: x.categorie, gamme: x.gamme, alt: a});
    });
  });
  if(!liste.length) return null;
  var gammes = {}; liste.forEach(function(x){ gammes[x.constructeur + '|' + x.gamme] = 1; });
  if(Object.keys(gammes).length > 1) return {candidats: liste.map(function(x){ return x.gamme; })};
  var ordre = (typeof EPR_CAT_ORDRE !== 'undefined') ? EPR_CAT_ORDRE : [];
  liste.sort(function(a, b2){ var ia = ordre.indexOf(a.categorie), ib = ordre.indexOf(b2.categorie); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  var r = liste[0], reste = b.slice(r.alt.length).replace(/^[0-9]+/, ''), variante = '';
  ecnVariantes(r.constructeur, r.categorie, r.gamme).forEach(function(v){
    var n = ecnNorm(v).replace(/[^a-z0-9]/g, '');
    if(n && n.length > variante.length && reste.indexOf(n) === 0) variante = v;
  });
  return {constructeur: r.constructeur, categorie: r.categorie, gamme: r.gamme, variante: variante,
    why: 'nom « ' + r.gamme + ' »' + (variante ? ' + variante « ' + variante + ' » (lettre du nom)' : ' ; variante laissée automatique') + (liste.length > 1 ? ' ; catégorie à vérifier' : '')};
}
function ecnSuggDecl(it){
  var cle = ecnCompact(it.libelle); if(!cle) return null;
  var trouves = [];
  (STATE.etudeMatDecl || []).forEach(function(x){
    var ok = false;
    String(x.code).split('/').forEach(function(alt){
      var a = ecnCompact(alt); if(!a) return;
      if(/\.x/.test(a)){ if(new RegExp('^' + a.replace(/\./g, '\\.').replace(/\\\.x/g, '\\.[0-9a-z]*') + '$').test(cle)) ok = true; }
      else if(a === cle) ok = true;
      else if(!/[0-9]/.test(a) && cle.replace(/[0-9.]/g, '') === a) ok = true;
    });
    if(ok && !trouves.some(function(t){ return t.code === x.code; })) trouves.push(x);
  });
  var exacts = trouves.filter(function(t){ return ecnCompact(t.code) === cle; });
  if(exacts.length) trouves = exacts;
  if(trouves.length > 1){      /* on garde ceux qui sont associes a la gamme proposee pour les blocs de coupure de ces circuits */
    var gs = {}; Object.keys(it.blocs || {}).forEach(function(bl){ var p = ecnResoudreProt(bl) || ecnSuggProt(bl); if(p && p.gamme) gs[p.constructeur + '|' + p.gamme] = 1; });
    var assoc = (STATE.etudeMatAssoc || []).filter(function(a){ return gs[a.constructeur + '|' + a.gamme]; }).map(function(a){ return a.declencheur; });
    var filtres = trouves.filter(function(t){ return assoc.indexOf(t.code) >= 0; });
    if(filtres.length) trouves = filtres;
  }
  if(trouves.length === 1) return {declencheur: trouves[0].code, why: 'nom proche de « ' + trouves[0].code + ' »'};
  return trouves.length ? {candidats: trouves.map(function(t){ return t.code; })} : null;
}
function ecnSuggCable(typeCable){
  var n = ecnCompact(typeCable).replace(/\./g, ''); if(n.length < 3) return null;
  var l = (ECB_DATA.familles || []).map(function(f){ return f.famille; }).filter(function(f){
    var m = ecnCompact(f).replace(/\./g, ''); return m && (m.indexOf(n) === 0 || n.indexOf(m) === 0);
  });
  l.sort(function(a, b){ return Math.abs(a.length - typeCable.length) - Math.abs(b.length - typeCable.length); });
  if(l.length === 1) return {famille: l[0], why: 'nom proche de « ' + l[0] + ' »'};
  return l.length ? {candidats: l.slice(0, 5)} : null;
}
function ecnHintSugg(s){
  if(!s) return '<b style="color:#b3261e;">à relier</b><div class="hint">aucune suggestion</div>';
  if(s.candidats) return '<b style="color:#b3261e;">à relier</b><div class="hint">plusieurs candidats : ' + esc(s.candidats.slice(0, 5).join(', ')) + '</div>';
  return '<b style="color:#b36b00;">suggéré</b><div class="hint">' + esc(s.why) + '. À confirmer : « Enregistrer les liens ».</div>';
}

/* « 3X(1x240) », « 5G4 », « 3x120 », « 2 Câbles 3x120 » -> structure du cable (V3.20) */
function ecnParseCable(txt){
  var t = String(txt || '').trim(); if(!t) return null;
  var m = /^(?:(\d+)\s*c[aâ]bles?\s+)?(\d+)\s*X\s*\(\s*1\s*x\s*([0-9.,]+)\s*\)$/i.exec(t);
  if(m) return {structure: 'uni', nbCond: Number(m[2]), avecPe: false, nbCables: m[1] ? Number(m[1]) : null};
  m = /^(?:(\d+)\s*c[aâ]bles?\s+)?(\d+)\s*([GgXx])\s*([0-9.,]+)$/i.exec(t);
  if(m) return {structure: 'multi', nbCond: Number(m[2]), avecPe: m[3].toLowerCase() === 'g', nbCables: m[1] ? Number(m[1]) : null};
  return null;
}

/* ---------- calcul de l'import (sans ecriture) ---------- */
/* « + LA9LB920 » (bloc declencheur des GV2 L) est un accessoire, pas un declencheur : jamais a relier */
function ecnDeclNom(c){ var t = c.blocDecl ? String(c.blocDecl).trim() : ''; return t && t.charAt(0) !== '+' ? t : null; }
function ecnNum(v){ var n = Number(v); return (v === null || v === undefined || v === '' || isNaN(n)) ? null : n; }
function ecnPreparer(cb){
  var fams = {};
  ECN.data.circuits.forEach(function(c){ var r = ecnResoudreCable(c.typeCable); if(r) fams[r.famille] = true; });
  var liste = Object.keys(fams).filter(function(f){ return !ECC_CAB[f]; });
  (function suite(i){
    if(i >= liste.length) return cb();
    eccCables(liste[i], function(){ suite(i + 1); });
  })(0);
}
function ecnConsommateurs(projetId){
  var m = {};
  eeLignesDuProjet(projetId).forEach(function(d){ var k = eelCle(d.tag); if(k && !m[k]) m[k] = d; });
  return m;
}
function ecnCalculer(){
  var projet = ECN.projet, cons = ecnConsommateurs(projet.id);
  var res = {lignes: [], ignores: [], tableauDiff: 0, cables: {}, prots: {}, decls: {}, alertes: []};
  function item(map, cle, lib){ if(!map[cle]) map[cle] = {cle: cle, libelle: lib, n: 0, calibres: {}}; map[cle].n++; return map[cle]; }
  ECN.data.circuits.forEach(function(c){
    var d = cons[eelCle(c.repere)];
    var iC = c.typeCable ? item(res.cables, ecnNorm(c.typeCable), c.typeCable) : null;
    var iP = c.blocCoupure ? item(res.prots, ecnNorm(c.blocCoupure), c.blocCoupure) : null;
    var decl = ecnDeclNom(c);
    var iD = decl ? item(res.decls, ecnNorm(decl), decl) : null;
    if(iD && c.blocCoupure){ iD.blocs = iD.blocs || {}; iD.blocs[c.blocCoupure] = 1; }
    if(iP && c.calibre !== null && c.calibre !== undefined) iP.calibres[c.calibre] = true;
    if(!d){ res.ignores.push(c.repere); return; }
    if(c.amont && eelCle(d.switchgear) !== eelCle(c.amont)) res.tableauDiff++;
    var p = {
      canecoRepere: c.repere, canecoSectionNeutre: ecnNum(c.sectionNeutre), canecoSectionPe: ecnNum(c.sectionPe), canecoNbNeutre: ecnNum(c.nbNeutre), canecoNbPe: ecnNum(c.nbPe), canecoSectionPhase: ecnNum(c.sectionPhase), canecoCable: c.cable || null, canecoTypeCable: c.typeCable || null, canecoBlocCoupure: c.blocCoupure || null, canecoBlocDecl: c.blocDecl || null,
      canecoContacteur: c.contacteur || null, canecoRelais: c.relais || null, canecoRef: c.refInterne || null, canecoIcu: ecnNum(c.icu), canecoIrTh: ecnNum(c.irTh),
      canecoIrMg: ecnNum(c.irMg), canecoCalibre: ecnNum(c.calibre), canecoModePose: c.modePose === null || c.modePose === undefined ? null : String(c.modePose)};
    var nbm = ecnNum(c.nbCablesMulti);
    p.nbCables = nbm && nbm > 0 ? nbm : 1;
    p.longueurM = ecnNum(c.longueur);
    var etat = {cable: 'absent', prot: 'absent', decl: decl ? 'absent' : '-'};
    var rc = ecnResoudreCable(c.typeCable);
    if(rc){
      var rows = (ECC_CAB[rc.famille] || []).filter(function(x){ return ecnNum(c.sectionPhase) !== null && Math.abs(x.sectionMm2 - Number(c.sectionPhase)) < 1e-6; });
      var cab = rows.filter(function(x){ return String(x.ame||'').toLowerCase() === 'cu'; })[0] || rows[0];
      if(cab){
        p.cableFamille = rc.famille; p.cableIdCaneco = cab.idCaneco; p.cableSectionTxt = cab.sectionTxt || String(cab.sectionMm2); etat.cable = 'ok';
        /* V3.31 : la base l'emporte. Le « Contenu » du consommateur fixe la composition du câble (3x / 4G / 5G…) ; Caneco ne fournit que la famille,
           la section, le nombre de câbles par phase et la longueur. Toute structure mémorisée auparavant est donc effacée. */
        var st = ecnParseCable(c.cable);
        if(st && st.nbCables) p.nbCables = st.nbCables;
        p.cableStructure = null; p.cableNbCond = null; p.cableAvecPe = false; p.neutreNb = null; p.neutreMm2 = null; p.peNb = null; p.peMm2 = null;
      }
      else { p.cableFamille = rc.famille; etat.cable = 'section'; res.alertes.push(c.repere + ' : section ' + c.sectionPhase + ' mm² absente de la famille « ' + rc.famille + ' »'); }
    }
    var rp = ecnResoudreProt(c.blocCoupure);
    if(rp){
      var cal = ecnNum(c.calibre);
      var lg = (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === rp.constructeur && x.gamme === rp.gamme && cal !== null && Number(x.calibreA) === cal; });
      if(rp.variante){ var lv = lg.filter(function(x){ return x.variante === rp.variante; }); if(lv.length) lg = lv; }
      var icu = ecnNum(c.icu), dj = null;
      if(lg.length){
        lg.sort(function(a, b){ return (a.icuKa||0) - (b.icuKa||0); });
        dj = (icu !== null ? lg.filter(function(x){ return (x.icuKa||0) >= icu; })[0] : null) || lg[lg.length - 1];
      }
      p.protConstructeur = rp.constructeur; p.protCategorie = dj ? dj.categorie : (rp.categorie || null); p.protGamme = rp.gamme;
      if(dj){ p.protVariante = dj.variante; p.protCalibre = String(dj.calibre); p.protCourbe = dj.courbe; etat.prot = 'ok'; }
      else { p.protCalibre = cal !== null ? String(cal) : null; etat.prot = 'calibre'; res.alertes.push(c.repere + ' : calibre ' + c.calibre + ' A absent de la gamme « ' + rp.gamme + ' »'); }
      var rd = ecnResoudreDecl(decl);
      if(rd){ p.protDeclencheur = rd.declencheur; etat.decl = 'ok'; }
    }
    if(c.jdbAmont) p.jdb = String(c.jdbAmont);
    if(c.lieu) p.lieu = String(c.lieu);
    if(c.designation) p.designation = String(c.designation);
    res.lignes.push({circuit: c, d: d, patch: p, etat: etat});
  });
  return res;
}

/* ---------- ecran ---------- */
function ecnStyleOnce(){
  if(byId('ecn-style')) return;
  var st = document.createElement('style'); st.id = 'ecn-style';
  st.textContent = '.ecn-ed{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:4px 6px;min-width:300px;} .ecn-ed select,#ecn-corps td select{width:100%;min-width:0;max-width:100%;font-size:12.5px;padding:3px 6px;}'+
    '#ecn-corps .ecc-t td{white-space:normal;vertical-align:top;} #ecn-corps .ecc-t td:nth-child(2){min-width:150px;}';
  document.head.appendChild(st);
}
function ecnVariantes(cons, cat, gam){
  var l = [];
  (STATE.etudeMatDisj || []).forEach(function(x){ if(x.constructeur === cons && x.categorie === cat && x.gamme === gam && x.variante && l.indexOf(x.variante) < 0) l.push(x.variante); });
  return l.sort(function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); });
}
function ecnOpts(liste, sel, vide){
  return '<option value="">' + esc(vide || '—') + '</option>' + liste.map(function(x){
    var v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
    return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
}
function ecnStatut(r){ return r ? (r.source === 'lien' ? '<span style="color:#1d6b3a;">relié (lien)</span>' : '<span style="color:#1d6b3a;">trouvé</span>') : '<b style="color:#b3261e;">à relier</b>'; }
function ecnLignesLiens(res){
  var h = '';
  var cons = (STATE.etudeMatConstructeurs || []).map(function(k){ return {v: k.code, t: k.nom || k.code}; });
  var tousDecl = (STATE.etudeMatDecl || []).slice().sort(function(a, b){ return String(a.constructeur).localeCompare(b.constructeur) || String(a.code).localeCompare(b.code, 'fr', {numeric: true}); });
  var declVus = {}, declOpts = [];
  tousDecl.forEach(function(x){ if(!declVus[x.code]){ declVus[x.code] = 1; declOpts.push({v: x.code, t: x.code + (x.famille ? ' (' + x.famille + ')' : '')}); } });
  Object.keys(res.cables).forEach(function(k){
    var it = res.cables[k], r = ecnResoudreCable(it.libelle), s = r ? null : ecnSuggCable(it.libelle), v = r || (s && !s.candidats ? s : null);
    h += '<tr data-type="cable" data-cle="' + esc(k) + '"><td>Câble</td><td><b>' + esc(it.libelle) + '</b><div class="hint">' + it.n + ' circuit(s)</div></td><td>' + (r ? ecnStatut(r) : ecnHintSugg(s)) + '</td>' +
      '<td><div class="ecn-ed" style="grid-template-columns:1fr;"><select class="ecn-fam">' + ecnOpts((ECB_DATA.familles || []).map(function(f){ return f.famille; }), v ? v.famille : '', '— Famille de câble —') + '</select></div></td></tr>';
  });
  Object.keys(res.prots).forEach(function(k){
    var it = res.prots[k], r0 = ecnResoudreProt(it.libelle), s = r0 ? null : ecnSuggProt(it.libelle), r = r0 || (s && !s.candidats ? s : null), cal = Object.keys(it.calibres).join(', ');
    var cats = r ? eprCategories(r.constructeur).map(function(x){ return x.nom; }) : [];
    var gams = [];
    if(r) (STATE.etudeMatDisj || []).forEach(function(x){ if(x.constructeur === r.constructeur && x.categorie === r.categorie && gams.indexOf(x.gamme) < 0) gams.push(x.gamme); });
    h += '<tr data-type="protection" data-cle="' + esc(k) + '"><td>Protection</td><td><b>' + esc(it.libelle) + '</b><div class="hint">' + it.n + ' circuit(s)' + (cal ? ' · calibres ' + esc(cal) + ' A' : '') + '</div></td><td>' + (r0 ? ecnStatut(r0) : ecnHintSugg(s)) + '</td>' +
      '<td><div class="ecn-ed"><select class="ecn-pc" title="Constructeur">' + ecnOpts(cons, r ? r.constructeur : '', '— Constructeur —') + '</select>' +
      '<select class="ecn-pk" title="Catégorie">' + ecnOpts(cats, r ? r.categorie : '', '— Catégorie —') + '</select>' +
      '<select class="ecn-pg" title="Gamme">' + ecnOpts(gams.sort(function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); }), r ? r.gamme : '', '— Gamme —') + '</select>' +
      '<select class="ecn-pv" title="Variante (pouvoir de coupure)">' + ecnOpts(r ? ecnVariantes(r.constructeur, r.categorie, r.gamme) : [], r ? r.variante : '', '— Variante (auto, selon Icu) —') + '</select></div></td></tr>';
  });
  Object.keys(res.decls).forEach(function(k){
    var it = res.decls[k], r0 = ecnResoudreDecl(it.libelle), s = r0 ? null : ecnSuggDecl(it), r = r0 || (s && !s.candidats ? s : null);
    h += '<tr data-type="declencheur" data-cle="' + esc(k) + '"><td>Déclencheur</td><td><b>' + esc(it.libelle) + '</b><div class="hint">' + it.n + ' circuit(s)</div></td><td>' + (r0 ? ecnStatut(r0) : ecnHintSugg(s)) + '</td>' +
      '<td><div class="ecn-ed" style="grid-template-columns:1fr;"><select class="ecn-dc">' + ecnOpts(declOpts, r ? r.declencheur : '', '— Déclencheur —') + '</select></div></td></tr>';
  });
  return h;
}
function ecnCorps(res){
  var tot = ECN.data.circuits.length, ok = res.lignes.length;
  var nbCableOk = res.lignes.filter(function(l){ return l.etat.cable === 'ok'; }).length;
  var nbProtOk = res.lignes.filter(function(l){ return l.etat.prot === 'ok'; }).length;
  var nbExist = res.lignes.filter(function(l){ var e = eccCircuit(ECN.projet.id, l.d.id); return e && (e.cableFamille || e.protConstructeur); }).length;
  var tete = (ECN.data.tableaux || []).filter(function(t){ return t.protection; }).map(function(t){ return esc(t.repere) + ' : ' + esc(t.protection) + (t.calibre ? ' ' + esc(t.calibre) + ' A' : '') + (t.declencheur ? ' · ' + esc(t.declencheur) : ''); }).join(' ; ');
  var nbSugg = (res.nbSugg || 0);
  var h = (nbSugg ? '<p style="margin-top:0;padding:8px 10px;background:#fff4d6;border:1px solid #e6c36a;border-radius:6px;"><b>' + nbSugg + ' lien(s) suggéré(s)</b> ci-dessous : ils seront enregistrés puis appliqués quand vous cliquerez sur « Importer » (modifiez les menus si une suggestion ne convient pas).</p>' : '') + '<p style="margin-top:0;">Fichier <b>' + esc(ECN.fichier) + '</b> : <b>' + tot + '</b> circuit(s) lu(s), dont <b>' + ok + '</b> rattaché(s) à un départ de <b>' + esc(projetLibelle(ECN.projet)) + '</b> (par le repère). ' +
    'Câble relié au catalogue : <b>' + nbCableOk + '</b> · protection reliée : <b>' + nbProtOk + '</b>. Le libellé d’origine de Caneco est conservé dans tous les cas.</p>';
  if(res.ignores.length) h += '<p class="hint"><b>' + res.ignores.length + ' repère(s) sans départ correspondant dans la base (ignorés)</b> : ' + esc(res.ignores.slice(0, 12).join(', ')) + (res.ignores.length > 12 ? '…' : '') + '</p>';
  if(res.tableauDiff) h += '<p class="hint">' + res.tableauDiff + ' départ(s) ont un tableau différent de l’« Amont » Caneco (information).</p>';
  if(tete) h += '<p class="hint">Protection de tête lue dans la note (non importée pour l’instant) : ' + tete + '</p>';
  if(res.alertes.length) h += '<details><summary class="hint"><b>' + res.alertes.length + ' avertissement(s)</b></summary><ul style="max-height:120px;overflow:auto;">' + res.alertes.slice(0, 80).map(function(m){ return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></details>';
  h += '<h4 style="margin:12px 0 4px;">Correspondance Caneco ⇄ nos catalogues</h4><p class="hint" style="margin:0 0 6px;">Ce qui n’est pas trouvé par son nom se relie ici à un élément de nos catalogues. Les liens sont mémorisés et réutilisés aux imports suivants.</p>' +
    '<div style="max-height:300px;overflow:auto;border:1px solid var(--border,#d0d5db);border-radius:6px;"><table class="ecc-t" style="width:100%;"><thead><tr><th>Type</th><th>Libellé Caneco</th><th>État</th><th>Élément de notre catalogue</th></tr></thead><tbody>' + ecnLignesLiens(res) + '</tbody></table></div>' +
    (ECN.mode === 'liens' ? '' : '<div style="margin-top:10px;"><label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="checkbox" id="ecn-skip" style="width:auto;"' + (nbExist ? ' checked' : '') + '> Ne pas modifier les ' + nbExist + ' circuit(s) dont le câble ou la protection est déjà saisi</label></div>');
  return h;
}
function ecnRendre(){
  var cible = byId('ecn-corps'); if(!cible) return;
  ecnStyleOnce();
  var res = ecnCalculer();
  res.nbSugg = ecnCompterSuggestions(res);
  var skip = byId('ecn-skip') ? byId('ecn-skip').checked : null;
  cible.innerHTML = ecnCorps(res);
  if(skip !== null && byId('ecn-skip')) byId('ecn-skip').checked = skip;
  ECN.res = res;
  var go = byId('ecn-go'); if(go) go.textContent = (ECN.mode === 'liens' ? 'Appliquer à ' : 'Importer ') + res.lignes.length + ' circuit(s)';
  /* listes en cascade des lignes protection */
  cible.querySelectorAll('tr[data-type=protection]').forEach(function(tr){
    var pc = tr.querySelector('.ecn-pc'), pk = tr.querySelector('.ecn-pk'), pg = tr.querySelector('.ecn-pg'), pv = tr.querySelector('.ecn-pv');
    var vide = function(el, t){ el.innerHTML = ecnOpts([], '', t); };
    pc.addEventListener('change', function(){ pk.innerHTML = ecnOpts(pc.value ? eprCategories(pc.value).map(function(x){ return x.nom; }) : [], '', '— Catégorie —'); vide(pg, '— Gamme —'); vide(pv, '— Variante (auto, selon Icu) —'); });
    pg.addEventListener('change', function(){ pv.innerHTML = ecnOpts(ecnVariantes(pc.value, pk.value, pg.value), '', '— Variante (auto, selon Icu) —'); });
    pk.addEventListener('change', function(){
      var l = []; (STATE.etudeMatDisj || []).forEach(function(x){ if(x.constructeur === pc.value && x.categorie === pk.value && l.indexOf(x.gamme) < 0) l.push(x.gamme); });
      pg.innerHTML = ecnOpts(l.sort(function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); }), '', '— Gamme —'); vide(pv, '— Variante (auto, selon Icu) —');
    });
  });
}
function ecnCompterSuggestions(res){
  var n = 0;
  Object.keys(res.cables).forEach(function(k){ var it = res.cables[k]; if(!ecnResoudreCable(it.libelle)){ var s = ecnSuggCable(it.libelle); if(s && !s.candidats) n++; } });
  Object.keys(res.prots).forEach(function(k){ var it = res.prots[k]; if(!ecnResoudreProt(it.libelle)){ var s = ecnSuggProt(it.libelle); if(s && !s.candidats) n++; } });
  Object.keys(res.decls).forEach(function(k){ var it = res.decls[k]; if(!ecnResoudreDecl(it.libelle)){ var s = ecnSuggDecl(it); if(s && !s.candidats) n++; } });
  return n;
}
function ecnEcrire(coll, id, data){
  return id ? STATE.db.doc(coll + '/' + id).update(data) : STATE.db.collection(coll).add(data);
}
function ecnEnregistrerLiens(silencieux){
  var taches = [], nb = 0;
  byId('ecn-corps').querySelectorAll('tbody tr[data-type]').forEach(function(tr){
    var type = tr.getAttribute('data-type'), cle = tr.getAttribute('data-cle');
    var lib = (ECN.res[type === 'cable' ? 'cables' : (type === 'protection' ? 'prots' : 'decls')][cle] || {}).libelle || cle;
    var cible = {}, vide = false, actuel = null;
    if(type === 'cable'){ cible.famille = tr.querySelector('.ecn-fam').value; vide = !cible.famille; actuel = ecnResoudreCable(lib); if(actuel && actuel.famille === cible.famille) return; }
    else if(type === 'protection'){
      cible.constructeur = tr.querySelector('.ecn-pc').value; cible.categorie = tr.querySelector('.ecn-pk').value; cible.gamme = tr.querySelector('.ecn-pg').value; cible.variante = tr.querySelector('.ecn-pv').value;
      vide = !cible.gamme; actuel = ecnResoudreProt(lib); if(actuel && actuel.gamme === cible.gamme && actuel.constructeur === cible.constructeur && (actuel.variante || '') === cible.variante) return;
    } else { cible.declencheur = tr.querySelector('.ecn-dc').value; vide = !cible.declencheur; actuel = ecnResoudreDecl(lib); if(actuel && actuel.declencheur === cible.declencheur) return; }
    var ex = ecnLien(type, cle), k = type + '|' + cle;
    if(vide){
      if(ex && ex.id){ taches.push(deleteDoc('etudeBtLiensCaneco', ex.id).then(function(){ ECN.liens[k] = null; })); nb++; }
      return;
    }
    var data = Object.assign({type: type, cle: cle, libelle: lib, updatedAt: nowISO()}, cible);
    if(!ex || !ex.id){ data.createdAt = nowISO(); data.creePar = currentUserName(); }
    nb++;
    taches.push(ecnEcrire('etudeBtLiensCaneco', ex && ex.id, data).then(function(ref){ ECN.liens[k] = Object.assign({id: ex && ex.id ? ex.id : (ref && ref.id)}, ex || {}, data); }));
  });
  if(!nb){ if(silencieux !== true) toast('Aucun lien à enregistrer'); return Promise.resolve(0); }
  return Promise.all(taches).then(function(){
    if(silencieux !== true) toast(nb + ' lien(s) enregistré(s)', 'success');
    return new Promise(function(ok){ ecnPreparer(function(){ if(silencieux !== true) ecnRendre(); ok(nb); }); });
  }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement des liens : ' + (e && e.message ? e.message : e), 'danger'); throw e; });
}
function ecnImporter(){
  /* les liens et suggestions affiches dans la fenetre sont enregistres AVANT l'import (sinon les circuits restent « non relies ») */
  ecnEnregistrerLiens(true).then(function(){ ECN.res = ecnCalculer(); ecnImporterCalcule(); }).catch(function(){ /* message deja affiche */ });
}
function ecnImporterCalcule(){
  var res = ECN.res, skip = ECN.mode !== 'liens' && byId('ecn-skip') && byId('ecn-skip').checked, projet = ECN.projet;
  var lignes = res.lignes.filter(function(l){
    if(!skip) return true;
    var e = eccCircuit(projet.id, l.d.id); return !(e && (e.cableFamille || e.protConstructeur));
  });
  if(!lignes.length){ toast('Aucun circuit à importer'); return; }
  closeModal(); toast('Import de ' + lignes.length + ' circuit(s)…');
  var taches = lignes.map(function(l){
    var patch = {}; Object.keys(l.patch).forEach(function(k){ if(l.patch[k] !== null && l.patch[k] !== undefined) patch[k] = l.patch[k]; });
    patch.updatedAt = nowISO();
    var ex = eccCircuit(projet.id, l.d.id);
    if(ex) return function(){ return STATE.db.doc('etudeBtCircuits/' + ex.id).update(patch); };
    var nouveau = Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null, consoId: l.d.id, tag: l.d.tag || null,
      tableauCle: eelCle(l.d.switchgear), createdAt: nowISO(), creePar: currentUserName()}, patch);
    return function(){ return STATE.db.collection('etudeBtCircuits').add(nouveau); };
  });
  var ok = 0, ko = 0;
  (function lot(i){
    if(i >= taches.length){
      toast('Import Caneco terminé : ' + ok + ' circuit(s)' + (ko ? ', ' + ko + ' en erreur' : ''), ko ? 'danger' : 'success');
      setTimeout(function(){ if(typeof scheduleRender === 'function') scheduleRender(); }, 600); return;
    }
    Promise.all(taches.slice(i, i + 10).map(function(f){ return f().then(function(){ ok++; }).catch(function(e){ console.error(e); ko++; }); })).then(function(){ lot(i + 10); });
  })(0);
}
function ecnOuvrir(projet){
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip,.xls,.xlsx';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0]; if(!f) return;
    var fd = new FormData(); fd.append('file', f);
    toast('Lecture de la note Caneco…');
    fetch('/api/etude-elec/caneco-lire', {method: 'POST', body: fd})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP ' + r.status)); return j; }); })
      .then(function(j){
        ECN.data = j; ECN.projet = projet; ECN.fichier = f.name; ECN.liens = {}; ECN.mode = 'fichier';
        var go = function(){ ecnPreparer(ecnModal); };
        if(ECB_DATA.familles) go(); else ecbCharger(go);
      })
      .catch(function(e){ console.error(e); toast('Lecture impossible : ' + e.message, 'danger'); });
  });
  inp.click();
}

function ecnModal(){
  var ov = openModal({title: ECN.mode === 'liens' ? 'Liens Caneco ⇄ catalogues (circuits déjà importés)' : 'Importer une note de calcul Caneco (câbles et protections)', large: true, body: '<div id="ecn-corps"></div>',
    foot: '<button type="button" class="btn" style="margin-right:auto;" id="ecn-liens">Enregistrer les liens et suggestions</button><button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="ecn-go">Importer</button>'});
  ov.querySelector('#ecn-liens').addEventListener('click', function(){ ecnEnregistrerLiens(); });
  ov.querySelector('#ecn-go').addEventListener('click', ecnImporter);
  ecnRendre();
}
/* circuits deja importes de Caneco : on rouvre la fenetre de liens SANS le fichier (le libelle Caneco est conserve dans le circuit) */
function ecnCircuitsImportes(projetId){
  return (STATE.etudeBtCircuits || []).filter(function(c){ return projetIdDe(c) === projetId && (c.canecoBlocCoupure || c.canecoCable); });
}
function ecnOuvrirLiens(projet){
  var circ = ecnCircuitsImportes(projet.id);
  if(!circ.length){ toast('Aucun circuit importé de Caneco dans ce contrat / devis'); return; }
  ECN.data = {tableaux: [], circuits: circ.map(function(c){
    var sec = ecnNum(c.canecoSectionPhase);
    if(sec === null){ var m = /x\s*([0-9]+(?:[.,][0-9]+)?)\s*$/i.exec(String(c.canecoCable || '')); if(m) sec = Number(m[1].replace(',', '.')); }
    return {repere: c.canecoRepere || c.tag, amont: null, longueur: c.longueurM, calibre: c.canecoCalibre, icu: c.canecoIcu, irTh: c.canecoIrTh, irMg: c.canecoIrMg,
      cable: c.canecoCable, typeCable: c.canecoTypeCable, sectionPhase: sec, sectionNeutre: c.canecoSectionNeutre, sectionPe: c.canecoSectionPe, nbNeutre: c.canecoNbNeutre, nbPe: c.canecoNbPe, nbCablesMulti: c.nbCables, blocCoupure: c.canecoBlocCoupure, blocDecl: c.canecoBlocDecl,
      contacteur: c.canecoContacteur, relais: c.canecoRelais, refInterne: c.canecoRef, modePose: c.canecoModePose, jdbAmont: c.jdb, lieu: c.lieu, designation: c.designation};
  })};
  ECN.projet = projet; ECN.fichier = 'circuits déjà importés de Caneco'; ECN.liens = {}; ECN.mode = 'liens';
  var go = function(){ ecnPreparer(ecnModal); };
  if(ECB_DATA.familles) go(); else ecbCharger(go);
}
