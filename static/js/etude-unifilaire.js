/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.24) - Sous-menu « Schéma unifilaire ».
   Charge APRES etude-calcul.js (utilise eccArbre, eccCircuit, eccAlimTexte, eccProtTexte, eeBilanCalculer, eebParams,
   eebDocDe, eebTransfoParCode, eebTransfoKva, eeProjetsDe, eeLignesDuProjet, eeSectionsAmontAval...).

   Genere, pour un contrat / devis, le schema unifilaire de la distribution : de la source (reseau amont) aux tableaux,
   SANS les departs terminaux (moteurs, charges...) et SANS les tableaux « modeles » (Appart type N). Les appartements d'un meme
   modele sous un meme tableau sont regroupes (« 17 × IMM A1-01 ... »). Disposition automatique, symboles CEI 60617
   (source, transformateur, disjoncteur, interrupteur-sectionneur, fusible, jeu de barres, cable).
   Rien n'est stocke : le schema est recalcule depuis la base, le bilan et la note de calcul. Exports : SVG, DXF (AutoCAD), PDF (impression).
   ========================================================= */
var EUN_UI = {projetId: '', recepteurs: true, fiches: false, view: null};
/* V3.36 : repere optionnel « fiche technique jointe » (documents du declencheur, etudeMatDocs) */
function eunRepereFiche(cons, decl, gamme){
  if(!EUN_UI.fiches || !cons || !(decl || gamme) || typeof emdDocsPour !== 'function') return '';
  var n = emdDocsPour(cons, decl, gamme).length;
  return n ? '(fiche technique' + (n > 1 ? ' ×' + n : '') + ')' : '';
}
var EUN_SCENE = null;

/* ---------- 1. arbre a dessiner ---------- */
function eunTxtW(s, px){ return String(s || '').length * (px || 11) * 0.58; }

function eunConsoParId(id){ return (STATE.etudeConsommateurs || []).filter(function(d){ return d.id === id; })[0] || null; }

function eunLien(projetId, node){
  return eunLienConso(projetId, node.departId ? eunConsoParId(node.departId) : null);
}
/* V3.34 : reglages choisis dans la fenetre de la protection -> « Thermique 1 × In · Instantané 8 × In » */
function eunReglTexte(cons, decl, regl){
  if(!regl || !decl) return '';
  var meta = (STATE.etudeMatReglages || []).filter(function(r){ return r.constructeur === cons && r.declencheur === decl; }), out = [];
  meta.forEach(function(m){
    var v = regl[m.fonction + '|' + m.parametre]; if(v === undefined || v === null || String(v).trim() === '') return;
    out.push(String(m.parametre).replace(/^(courant|temps)\s+/i, '').split(/[ (]/)[0] + ' ' + String(v).trim() + (m.unite && String(v).indexOf(m.unite) < 0 ? ' ' + m.unite : ''));
  });
  return out.join(' · ');
}
function eunLienConso(projetId, d){
  var c = d ? eccCircuit(projetId, d.id) : null;
  var out = {prot: [], cable: [], cat: '', ok: !!c, vars: {}};
  if(!c) return out;
  if(c.protGamme){
    var g = [c.protGamme, c.protVariante && c.protVariante !== '—' ? c.protVariante : ''].filter(Boolean).join(' ');
    out.prot.push(g);
    var l2 = [c.protCalibre ? c.protCalibre + ' A' : '', c.protDeclencheur || ''].filter(Boolean).join(' · ');
    if(l2) out.prot.push(l2);
    out.cat = c.protCategorie || '';
    var rg = eunReglTexte(c.protConstructeur, c.protDeclencheur, c.protReglages); if(rg) out.prot.push(rg);
    var rf = eunRepereFiche(c.protConstructeur, c.protDeclencheur, c.protGamme); if(rf) out.prot.push(rf);
    out.vars = {gamme: g, calibre: c.protCalibre ? c.protCalibre + ' A' : '', declencheur: c.protDeclencheur || '', reglages: rg};
  } else if(c.canecoBlocCoupure){ out.prot.push(c.canecoBlocCoupure); if(c.canecoCalibre) out.prot.push(c.canecoCalibre + ' A'); out.vars = {gamme: c.canecoBlocCoupure, calibre: c.canecoCalibre ? c.canecoCalibre + ' A' : ''}; }
  var al = d ? eccAlimTexte(c, d) : '';
  if(al) out.cable.push(al);
  var lg = (c.longueurM !== null && c.longueurM !== undefined && c.longueurM !== '') ? c.longueurM : (d ? d.longueur : null);
  if(lg !== null && lg !== undefined && lg !== '') out.cable.push(eccFmtNum(lg) + ' m');
  return out;
}

/* noeud : {titre, sub:[], enf:[], lien, transfo, w, x, y} */
function eunConstruire(projet){
  var pid = projet.id;
  var sections = eeSectionsAmontAval(eeLignesDuProjet(pid));
  var enfants = eccArbre(sections);
  var bilan = null;
  try { bilan = eeBilanCalculer(sections, eebParams(pid, sections)); } catch(e){ bilan = null; }
  var parCle = {}; sections.forEach(function(s){ if(s.cle) parCle[s.cle] = s; });

  function fmtS(v){ return v ? Math.round(v).toLocaleString('fr-FR', {useGrouping: false}) + ' kVA' : ''; }
  function transfoDe(cle){
    var doc = (typeof eebDocDe === 'function') ? eebDocDe(pid, cle) : null;
    if(!doc || !doc.transfoCode) return null;
    var t = eebTransfoParCode(doc.transfoCode), n = Math.max(1, Math.round(Number(doc.transfoNb) || 1)), kva = null;
    try { kva = t ? eebTransfoKva(t) : null; } catch(e){ kva = null; }
    var sOnan = t && Number(t.sOnan) ? Number(t.sOnan) * 1000 : null, sOnaf = null, pk = null;
    try { if(t){ var cc = emtCalc(t, emtParams()); sOnaf = cc.sOnaf ? cc.sOnaf * 1000 : null; pk = cc.pkRet; } } catch(e){}
    return {code: doc.transfoCode, n: n, kva: kva, sOnan: sOnan, sOnaf: sOnaf, uk: t ? t.uk : null, pk: pk, up: t ? t.tensionPrimaire : null, us: t ? t.tensionSecondaire : null};
  }
  function noeud(x){
    var s = parCle[x.cle], terminaux = 0;
    var enf = (enfants[x.cle] || []);
    if(s){ var fils = {}; enf.forEach(function(e){ fils[e.cle] = true; }); terminaux = s.lignes.filter(function(d){ return !fils[eelCle(d.tag)]; }).length; }
    else if(x.virtuel && x.modele){ terminaux = x.lignes.length; }
    var n = {titre: x.titre, sub: [], enf: [], lien: eunLien(pid, x), transfo: transfoDe(x.cle), cle: x.cle, terminaux: terminaux, departId: x.departId || null};
    /* protection de tete du tableau (V3.34) : stockee dans le document du tableau (celui du modele pour un appartement) */
    n.cleTete = (x.virtuel && x.modele) ? x.modele : x.cle; n.titreTete = (x.virtuel && x.modele) ? (x.modeleTitre || x.titre) : x.titre;
    var dt = (typeof eebDocDe === 'function' && n.cleTete) ? eebDocDe(pid, n.cleTete) : null;
    if(dt && (dt.teteGamme || dt.teteConstructeur)){
      var rgT = eunReglTexte(dt.teteConstructeur, dt.teteDeclencheur, dt.teteReglages);
      n.tete = {cat: dt.teteCategorie || '', prot: [[dt.teteGamme, dt.teteVariante && dt.teteVariante !== '—' ? dt.teteVariante : ''].filter(Boolean).join(' '), [dt.teteCalibre ? dt.teteCalibre + ' A' : '', dt.teteDeclencheur || ''].filter(Boolean).join(' · '), rgT, eunRepereFiche(dt.teteConstructeur, dt.teteDeclencheur, dt.teteGamme)].filter(Boolean),
        vars: {gamme: dt.teteGamme || '', calibre: dt.teteCalibre ? dt.teteCalibre + ' A' : '', declencheur: dt.teteDeclencheur || '', reglages: rgT}};
    }
    var r = bilan && bilan[x.cle];
    if(r && r.normal && r.normal.S) n.sub.push('S = ' + fmtS(r.normal.S));
    var tens = 0; if(s) s.lignes.forEach(function(d){ var v = Number(d.tension); if(v > tens) tens = v; });
    if(tens) n.sub.push(tens >= 1000 ? (tens / 1000) + ' kV' : tens + ' V');
    if(terminaux) n.sub.push(terminaux + ' départ(s)');
    /* regroupement : appartements (tableaux virtuels sans enfants) d'un meme modele */
    var groupes = {}, ordre = [];
    enf.forEach(function(e){
      var k = e.virtuel && e.modele && !(enfants[e.cle] || []).length ? 'm:' + e.modele : 'u:' + e.cle;
      if(!groupes[k]){ groupes[k] = []; ordre.push(k); }
      groupes[k].push(e);
    });
    var recs = [];
    if(EUN_UI.recepteurs && s){
      var fils2 = {}; enf.forEach(function(e){ fils2[e.cle] = true; });
      s.lignes.forEach(function(d){
        if(fils2[eelCle(d.tag)]) return;
        recs.push({rec: true, titre: d.tag || '', d: d, lien: eunLienConso(pid, d), puiss: (typeof eccConso === 'function') ? eccConso(d) : '', nombre: Number(d.nombre) > 1 ? Number(d.nombre) : 0,
          moteur: String(d.typeConso || '').toLowerCase() === 'moteur', ordre: d.ordre || 0, enf: [], sub: []});
      });
    }
    ordre.forEach(function(k){
      var l = groupes[k];
      if(k.charAt(0) === 'm' && l.length >= 2){
        var c = noeud(l[0]);
        c.titre = l.length + ' × ' + l[0].titre + ' … ' + l[l.length - 1].titre;
        c.sub = [l[0].modeleTitre];
        c.groupe = l.length;
        n.enf.push(c);
      } else l.forEach(function(e){ n.enf.push(noeud(e)); });
    });
    if(recs.length){      /* ordre de la base : recepteurs et tableaux fils melanges */
      n.enf.forEach(function(c, i){ var dd = c.departId ? eunConsoParId(c.departId) : null; c.ordre = dd ? (dd.ordre || 0) : 1e9 + i; });
      n.enf = n.enf.concat(recs).sort(function(a, b){ return a.ordre - b.ordre; });
    }
    return n;
  }
  var racines = (enfants[''] || []).map(noeud);
  return {racines: racines, nbTableaux: sections.filter(function(s){ return s.cle; }).length};
}

/* ---------- 2. mise en page (arbre de haut en bas) ---------- */
var EUN = {Hlien: 230, Hsrc: 210, wMin: 210, gap: 24, marge: 60, wRec: 44, Hrec: 175};
function eunMesurer(n){
  if(n.rec){ n.wBox = 0; n.wSub = EUN.wRec; return; }
  var sw = 0; (n.sub || []).forEach(function(t){ sw = Math.max(sw, eunTxtW(t, 10)); });
  var wt = 2 * Math.max(eunTxtW(n.titre, 12) * 1.12 + 14, sw * 1.12 + 14, 75);   /* titre a gauche de l'arrivee, infos a droite : l'encombrement est symetrique */
  n.wBox = wt;
  n.enf.forEach(eunMesurer);
  var somme = n.enf.reduce(function(a, c){ return a + c.wSub; }, 0);
  n.wSub = Math.max(EUN.wMin, wt + EUN.gap, somme);
}
function eunPlacer(n, x0, y){
  n.y = y;
  var somme = n.enf.reduce(function(a, c){ return a + c.wSub; }, 0), cx = x0;
  if(n.enf.length){
    var debut = x0 + (n.wSub - somme) / 2;
    cx = debut;
    n.enf.forEach(function(c){ eunPlacer(c, cx, y + (c.rec ? EUN.Hrec : EUN.Hlien)); cx += c.wSub; });
    var a = n.enf[0], b = n.enf[n.enf.length - 1];
    n.x = (a.x + b.x) / 2;
  } else n.x = x0 + n.wSub / 2;
}

/* ---------- 3. primitives ---------- */
/* symbole de la bibliotheque pour une categorie : celui marque « utilise dans le schema », sinon le symbole systeme du meme nom, sinon le premier de la categorie */
function eunSymLib(cat){
  var lib = esyBibli();
  return lib.filter(function(x){ return x.categorie === cat && x.parDefaut; })[0] || lib.filter(function(x){ return x.code === cat; })[0] || lib.filter(function(x){ return x.categorie === cat; })[0] || null;
}
function eunScene(projet){
  var P = [], g = eunConstruire(projet), HITS = [];
  var L = function(x1, y1, x2, y2, o){ P.push(Object.assign({t: 'l', x1: x1, y1: y1, x2: x2, y2: y2, w: 1.4, layer: 'LIAISONS'}, o || {})); };
  var C = function(cx, cy, r, o){ P.push(Object.assign({t: 'c', cx: cx, cy: cy, r: r, w: 1.4, layer: 'SYMBOLES'}, o || {})); };
  var R = function(x, y, w, h, o){ P.push(Object.assign({t: 'r', x: x, y: y, w: w, h: h, lw: 1.4, layer: 'SYMBOLES'}, o || {})); };
  var T = function(x, y, s, o){ if(s === null || s === undefined || s === '') return; P.push(Object.assign({t: 't', x: x, y: y, s: String(s), h: 11, a: 'start', layer: 'TEXTES'}, o || {})); };

  /* V3.31 : les symboles viennent de la bibliotheque (Editeur de symboles). Le symbole de chaque categorie est celui designe dans l'editeur
     (« utilise dans le schema ») ; sinon le symbole systeme du meme nom. Les bornes « in » (haut) et « out » (bas) du symbole
     fixent le raccordement : un conducteur est ajoute si elles ne tombent pas sur les points de raccordement du schema. */
  /* textes variables du symbole : {gamme} {calibre} {declencheur} {kVA} {code} {tension} {repere} {puissance} (voir l'editeur de symboles) */
  function varTexte(t, vars){
    return String(t).replace(/\{(\w+)\}/g, function(m, k){ var key = k.toLowerCase(), v = vars ? vars[key] : ''; return v === undefined || v === null ? '' : String(v); });
  }
  function sym(cat, x, y, nomIn, nomOut, vars, hit){
    var s = eunSymLib(cat); if(!s) return;
    var vv = {}; Object.keys(vars || {}).forEach(function(k){ vv[k.toLowerCase()] = vars[k]; });
    var estVar = function(e){ return e.t === 't' && /\{\w+\}/.test(String(e.s)); };
    var ents = s.entites.filter(function(e){ return e.t !== 'b' && !estVar(e); }), textes = s.entites.filter(estVar);
    var bin = s.entites.filter(function(e){ return e.t === 'b' && e.nom === 'in'; })[0], bout = s.entites.filter(function(e){ return e.t === 'b' && e.nom === 'out'; })[0];
    nomIn = nomIn === undefined ? 24 : nomIn; nomOut = nomOut === undefined ? 24 : nomOut;
    var ax = x - (bin ? bin.x / 0.3 : 0);
    if(ents.length){ var ps = {t: 's', code: s.code, x: ax, y: y, ents: ents, w: 1.4, layer: 'SYMBOLES'}; if(hit){ HITS.push(hit); ps.hit = HITS.length - 1; } P.push(ps); }
    textes.forEach(function(e){ var tx = varTexte(e.s, vv); if(tx) T(ax + e.x / 0.3, y - e.y / 0.3 + e.h / 0.3 * 0.35, tx, {a: 'middle', h: e.h / 0.3, layer: 'SYMBOLES'}); });
    if(bin && nomIn){ var yt = y - bin.y / 0.3; if(Math.abs(yt - (y - nomIn)) > 0.5) L(x, y - nomIn, x, yt); }
    if(bout && nomOut){
      var xb = ax + bout.x / 0.3, yb = y - bout.y / 0.3;
      if(Math.abs(yb - (y + nomOut)) > 0.5 || Math.abs(xb - x) > 0.5){ L(xb, yb, xb, y + nomOut); if(Math.abs(xb - x) > 0.5) L(xb, y + nomOut, x, y + nomOut); }
    }
  }
  function disjoncteur(x, y, vars, hit){ sym('disjoncteur', x, y, 24, 24, vars, hit); }
  function transfo(x, y, vars){ sym('transfo', x, y, 20, 20, vars); }
  function source(x, y, titre, sub){      /* symbole « source » de la bibliotheque, titre et sous-titre a droite */
    sym('source', x, y, 0, 24, {tension: titre, repere: titre});
    T(x + 22, y - 2, titre, {a: 'start', h: 11, bold: true}); if(sub) T(x + 22, y + 10, sub, {a: 'start', h: 9});
  }
  function symboleProt(cat, x, y, vars, hit){
    var c = String(cat || '').toLowerCase(), code = 'disjoncteur';
    if(c.indexOf('fusibles') >= 0) code = 'interrupteur_fusibles';
    else if(c.indexOf('fusible') === 0) code = 'fusible';
    else if(c.indexOf('sectionneur') >= 0) code = 'interrupteur_sectionneur';
    else if(c.indexOf('différentiel') >= 0 && c.indexOf('interrupt') >= 0) code = 'sectionneur';
    sym(code, x, y, 24, 24, vars, hit);
  }

  g.racines.forEach(eunMesurer);
  var xa = EUN.marge;
  g.racines.forEach(function(r){ eunPlacer(r, xa, EUN.marge + EUN.Hsrc); xa += r.wSub; });
  var largeur = xa + EUN.marge - EUN.marge, maxY = 0;

  function nf(v, d){ return Number(v).toLocaleString('fr-FR', {maximumFractionDigits: d === undefined ? 0 : d, useGrouping: false}); }
  function transfoLignes(tr){
    var l = [{s: 'Transformateur ' + tr.code, b: true}], pw = [];
    if(tr.sOnan) pw.push((tr.n > 1 ? tr.n + ' × ' : '') + nf(tr.sOnan) + ' kVA' + (tr.sOnaf ? ' ONAN' : ''));
    else if(tr.kva) pw.push((tr.n > 1 ? tr.n + ' × ' : '') + nf(tr.kva / tr.n) + ' kVA');
    if(tr.sOnaf) pw.push(nf(tr.sOnaf) + ' kVA ONAF');
    if(pw.length) l.push({s: pw.join(' / ')});
    if(tr.up && tr.us) l.push({s: nf(tr.up, 3) + ' / ' + nf(tr.us, 3) + ' kV'});
    var e = []; if(tr.uk) e.push('uk ' + nf(tr.uk, 2) + ' %'); if(tr.pk) e.push('Pk ' + nf(tr.pk, 1) + ' kW');
    if(e.length) l.push({s: e.join(' · ')});
    return l;
  }
  function dessinerTransfo(x, y, tr){      /* symbole (2 cercles) + caracteristiques a droite */
    transfo(x, y, {code: tr.code, kva: tr.sOnan ? (tr.n > 1 ? tr.n + ' × ' : '') + nf(tr.sOnan) + ' kVA' : (tr.kva ? nf(tr.kva / tr.n) + ' kVA' : ''), tension: tr.up && tr.us ? nf(tr.up, 3) + ' / ' + nf(tr.us, 3) + ' kV' : ''});
    var l = transfoLignes(tr), y0 = y - ((l.length - 1) * 11) / 2 + 3;
    l.forEach(function(e, i){ T(x + 20, y0 + i * 11, e.s, {h: 9, bold: !!e.b}); });
  }
  function court(t, m){ t = String(t || ''); return t.length > m ? t.slice(0, m - 1) + '…' : t; }
  function recepteur(c, n){
    var x = c.x, yh = n.y, ys = c.y;
    maxY = Math.max(maxY, ys + 95);
    var nomR = c.moteur ? 11 : 8;      /* haut du cercle (moteur) ou du rectangle (charge) */
    L(x, yh + 48, x, ys - nomR);      /* le symbole de protection (yh+24) porte ses conducteurs */
    var hr = {k: 'dep', consoId: c.d ? c.d.id : null, titre: c.titre, amont: [{k: 'tete', cle: n.cleTete, titre: n.titreTete}].concat(n._up || [])};
    if(c.lien.ok){
      symboleProt(c.lien.cat, x, yh + 24, Object.assign({repere: c.titre, puissance: c.puiss}, c.lien.vars), hr);
      var tp = c.lien.prot.join(' '), tc = c.lien.cable.join(' · ');
      T(x + 10, yh + 148, court(tp, 24), {h: 8, rot: true});
      T(x + 20, yh + 148, court(tc, 24), {h: 8, rot: true, c: 'cable'});
    } else disjoncteur(x, yh + 24, {repere: c.titre, puissance: c.puiss}, hr);
    sym(c.moteur ? 'moteur' : 'charge', x, ys, nomR, 0, {repere: c.titre, puissance: c.puiss});      /* moteur : M cerclé ; charge : rectangle CEI sans lettre */
    T(x + 4, ys + 18, court(c.titre, 16) + (c.nombre ? ' ×' + c.nombre : ''), {a: 'end', h: 9, rot: true, bold: true});
    if(c.puiss) T(x + 15, ys + 18, c.puiss, {a: 'end', h: 8, rot: true});
  }
  function dessiner(n, parent){
    maxY = Math.max(maxY, n.y);
    var w = n.wBox, g2 = n.enf.length;
    var xg = n.x - w / 2, xd = n.x + w / 2;
    if(g2){ xg = Math.min(xg, n.enf[0].x - 14); xd = Math.max(xd, n.enf[g2 - 1].x + 14); }
    /* jeu de barres + titres */
    var ht = {k: 'tete', cle: n.cleTete, titre: n.titreTete, amont: n._up || []};
    HITS.push(ht);
    L(xg, n.y, xd, n.y, {w: 5, layer: 'BARRES', hit: HITS.length - 1});
    if(n.tete){       /* protection de tete : symbole juste au-dessus du jeu de barres, caracteristiques a gauche */
      symboleProt(n.tete.cat, n.x, n.y - 28, Object.assign({repere: n.titre}, n.tete.vars), ht);
      n.tete.prot.forEach(function(t, i){ T(n.x - 26, n.y - 34 - (n.tete.prot.length - 1 - i) * 11 - 14, t, {a: 'end', h: 9}); });
    }
    var dxT = n.tete ? 26 : 8;
    T(n.x - dxT, n.y - 8, n.titre, {a: 'end', h: 12, bold: true});
    n.sub.forEach(function(s, i){ T(n.x + (n.tete ? 26 : 8), n.y - 8 - (n.sub.length - 1 - i) * 12, s, {a: 'start', h: 10}); });
    if(n.groupe) R(xg - 6, n.y - 34, xd - xg + 12, 40, {dash: true, layer: 'TEXTES', lw: 0.8});
    /* liaisons vers les enfants */
    n.enf.forEach(function(c){
      if(c.rec){ recepteur(c, n); return; }
      var yh = n.y, ye = c.y, ym = yh + 26;
      /* le conducteur ne traverse ni le symbole de protection (qui porte ses propres conducteurs) ni le transformateur */
      var yfin = c.tete ? ye - 52 : ye;      /* au-dessus de la protection de tete du tableau */
      var ya = ym - 24, yz = ym + 24, ysup = c.transfo ? yh + 115 : yfin;
      L(c.x, yh, c.x, ya); L(c.x, yz, c.x, ysup); if(c.transfo) L(c.x, yh + 155, c.x, yfin);
      var cat = c.lien.cat;
      var vp = Object.assign({repere: c.titre}, c.lien.vars);
      var hd = {k: 'dep', consoId: c.departId, titre: c.titre, amont: [{k: 'tete', cle: n.cleTete, titre: n.titreTete}].concat(n._up || [])};
      c._up = [{k: 'dep', consoId: c.departId, titre: c.titre}].concat(hd.amont);      /* V3.46 : protections situées en amont du jeu de barres de c (la plus proche d'abord) */
      if(c.lien.ok){ symboleProt(cat, c.x, ym, vp, hd); } else { disjoncteur(c.x, ym, vp, hd); }
      c.lien.prot.forEach(function(s, i){ T(c.x + 14, ym - 2 + i * 11, s, {h: 9}); });
      var yc = yh + 95;
      if(c.transfo){ dessinerTransfo(c.x, yh + 135, c.transfo); }
      c.lien.cable.forEach(function(s, i){ T(c.x + 14, yc + i * 11, s, {h: 9, c: 'cable'}); });
      if(!c.lien.ok) T(c.x + 14, yc, 'câble / protection non saisis', {h: 9, c: 'vide'});
      dessiner(c, n);
    });
  }
  g.racines.forEach(function(r){
    var ys = r.y - EUN.Hsrc + 40;
    var tr = r.transfo;
    if(!tr && /transfo/i.test(r.titre)){      /* tableau nomme « TRANSFORMATEUR 1000 kVA » sans transfo choisi dans le bilan : on garde au moins le symbole et la puissance du nom */
        tr = {code: r.titre.replace(/^transformateur\s*/i, '') || r.titre, n: 1, kva: null};
    }
    source(r.x, ys, tr && tr.up ? 'Réseau ' + nf(tr.up, 3) + ' kV' : 'Source', '');
    var yr = r.tete ? r.y - 52 : r.y;
    if(tr){ L(r.x, ys + 24, r.x, ys + 60); L(r.x, ys + 100, r.x, yr); dessinerTransfo(r.x, ys + 80, tr); } else L(r.x, ys + 24, r.x, yr);
    dessiner(r, null);
  });
  var H = maxY + 120, W = Math.max(xa + EUN.marge, 900);
  /* cartouche */
  var cw = 300, ch = 78, cx0 = W - cw - 20, cy0 = H - ch - 10;
  R(cx0, cy0, cw, ch, {layer: 'CARTOUCHE', lw: 1.2});
  L(cx0, cy0 + 26, cx0 + cw, cy0 + 26, {layer: 'CARTOUCHE', w: 0.8});
  T(cx0 + 8, cy0 + 18, 'SCHÉMA UNIFILAIRE', {h: 13, bold: true, layer: 'CARTOUCHE'});
  T(cx0 + 8, cy0 + 42, projetLibelle(projet), {h: 10, layer: 'CARTOUCHE'});
  var dt = new Date();
  T(cx0 + 8, cy0 + 58, 'Du ' + ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + dt.getFullYear() + ' · généré depuis la base de données', {h: 9, layer: 'CARTOUCHE'});
  T(cx0 + 8, cy0 + 71, (EUN_UI.recepteurs ? 'Récepteurs : M moteur, □ charge' : 'Récepteurs non représentés') + ' · tableaux modèles non représentés', {h: 8, layer: 'CARTOUCHE'});
  return {prims: P, hits: HITS, w: W, h: H, vide: !g.racines.length, nbTableaux: g.nbTableaux};
}

/* ---------- 4. etendue, boites, SVG ---------- */
/* boite englobante d'une primitive : {x1, y1, x2, y2} */
function eunBoite(p){
  if(p.t === 'l'){ var m = p.w > 3 ? p.w / 2 : 0; return {x1: Math.min(p.x1, p.x2), y1: Math.min(p.y1, p.y2) - m, x2: Math.max(p.x1, p.x2), y2: Math.max(p.y1, p.y2) + m}; }
  if(p.t === 'c') return {x1: p.cx - p.r, y1: p.cy - p.r, x2: p.cx + p.r, y2: p.cy + p.r};
  if(p.t === 'r') return {x1: p.x, y1: p.y, x2: p.x + p.w, y2: p.y + p.h};
  if(p.t === 's'){ var bs = esyBoite(p.ents); return bs ? {x1: p.x + bs.x0 / 0.3 - 1, y1: p.y - bs.y1 / 0.3 - 1, x2: p.x + bs.x1 / 0.3 + 1, y2: p.y - bs.y0 / 0.3 + 1} : {x1: p.x, y1: p.y, x2: p.x, y2: p.y}; }
  var wd = String(p.s).length * p.h * 0.58;
  if(p.rot){ return p.a === 'end' ? {x1: p.x - p.h, y1: p.y, x2: p.x + 2, y2: p.y + wd} : {x1: p.x - p.h, y1: p.y - wd, x2: p.x + 2, y2: p.y}; }
  var a = p.a === 'end' ? p.x - wd : (p.a === 'middle' ? p.x - wd / 2 : p.x), b = a + wd;
  return {x1: a, y1: p.y - p.h, x2: b, y2: p.y + 3};
}
/* etendue du dessin (comme « Zoom etendue » / « Etendue » d'AutoCAD) */
function eunEtendue(sc){
  var e = {x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9};
  sc.prims.forEach(function(p){ var b = eunBoite(p); e.x1 = Math.min(e.x1, b.x1); e.y1 = Math.min(e.y1, b.y1); e.x2 = Math.max(e.x2, b.x2); e.y2 = Math.max(e.y2, b.y2); });
  if(e.x1 > e.x2) return {x: 0, y: 0, w: sc.w, h: sc.h};
  var mg = 24;
  return {x: e.x1 - mg, y: e.y1 - mg, w: e.x2 - e.x1 + 2 * mg, h: e.y2 - e.y1 + 2 * mg};
}
function eunXml(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
/* o.region : zone exportee {x, y, w, h} (fond blanc, viewBox, dimensions) ; o.ecran : pour l'affichage (viewBox pilote par la souris, pas de fond) */
function eunSvg(sc, o){
  o = o || {}; var r = o.region;
  var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (r ? [r.x, r.y, r.w, r.h].join(' ') : '0 0 ' + sc.w + ' ' + sc.h) + '"' +
    (r ? ' width="' + Math.round(r.w) + '" height="' + Math.round(r.h) + '"' : '') + ' font-family="Arial, Helvetica, sans-serif">'];
  if(r) out.push('<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="#ffffff"/>');
  else if(!o.ecran) out.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  var hits = [];
  var col = {BARRES: '#111', LIAISONS: '#111', SYMBOLES: '#111', TEXTES: '#111', CARTOUCHE: '#111'};
  sc.prims.forEach(function(p){
    var c = col[p.layer] || '#111';
    if(o.ecran && p.hit !== undefined && sc.hits && sc.hits[p.hit]){ var hb = eunBoite(p), hi = sc.hits[p.hit], mg = p.t === 'l' ? (p.w > 3 ? 2 : 4) : 3; hits.push('<rect class="eun-hit" data-hit="' + p.hit + '" x="' + (hb.x1 - mg) + '" y="' + (hb.y1 - mg) + '" width="' + (hb.x2 - hb.x1 + 2 * mg) + '" height="' + (hb.y2 - hb.y1 + 2 * mg) + '"><title>' + eunXml(hi.k === 'tete' ? 'Protection de tête de ' + (hi.titre || 'tableau') + ' : cliquer pour paramétrer' : 'Protection de ' + (hi.titre || 'départ') + ' : cliquer pour paramétrer') + '</title></rect>'); }
    if(p.t === 'l') out.push('<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + c + '" stroke-width="' + p.w + '" stroke-linecap="' + (p.w > 3 ? 'butt' : 'round') + '"/>');
    else if(p.t === 'c') out.push('<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="none" stroke="' + c + '" stroke-width="' + p.w + '"/>');
    else if(p.t === 'r') out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="none" stroke="' + c + '" stroke-width="' + p.lw + '"' + (p.dash ? ' stroke-dasharray="6 4"' : '') + '/>');
    else if(p.t === 's'){
      var sts = 'stroke="' + c + '" stroke-width="' + p.w + '" stroke-linecap="round" stroke-linejoin="round"';
      out.push('<g>' + p.ents.map(function(e){ return esyEntSvg(e, function(x){ return p.x + x / 0.3; }, function(y){ return p.y - y / 0.3; }, 1 / 0.3, sts); }).join('') + '</g>');
    }
    else if(p.t === 't'){
      var fill = p.c === 'cable' ? '#1b4fd8' : (p.c === 'vide' ? '#b3261e' : '#111');
      out.push('<text x="' + p.x + '" y="' + p.y + '" font-size="' + p.h + '" text-anchor="' + p.a + '" fill="' + fill + '"' + (p.rot ? ' transform="rotate(-90 ' + p.x + ' ' + p.y + ')"' : '') + (p.bold ? ' font-weight="700"' : '') + (p.c === 'vide' ? ' font-style="italic"' : '') + '>' + eunXml(p.s) + '</text>');
    }
  });
  hits.forEach(function(h){ out.push(h); });
  out.push('</svg>');
  return out.join('\n');
}

/* ---------- 5. DXF (AutoCAD R12, ASCII ; 1 px = 0,3 mm, Y vers le haut) ----------
   region : seule la zone choisie est ecrite (traits coupes a la fenetre, cercles et textes conserves s'ils la touchent) ; l'origine du dessin est le coin bas-gauche de la zone. */
function eunClipLigne(x1, y1, x2, y2, R){
  var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1, p = [-dx, dx, -dy, dy], q = [x1 - R.x, R.x + R.w - x1, y1 - R.y, R.y + R.h - y1];
  for(var i = 0; i < 4; i++){
    if(p[i] === 0){ if(q[i] < 0) return null; }
    else { var t = q[i] / p[i]; if(p[i] < 0){ if(t > t1) return null; if(t > t0) t0 = t; } else { if(t < t0) return null; if(t < t1) t1 = t; } }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}
function eunTouche(b, R){ return !(b.x2 < R.x || b.x1 > R.x + R.w || b.y2 < R.y || b.y1 > R.y + R.h); }
function eunDxf(sc, region){
  var K = 0.3, R = region || null, ox = R ? R.x : 0, yb = R ? R.y + R.h : sc.h, o = [];
  var g = function(code, val){ o.push(String(code)); o.push(String(val)); };
  var nombre = function(v){ return (Math.round(v * 1000) / 1000).toString(); };
  var X = function(x){ return nombre((x - ox) * K); }, Y = function(y){ return nombre((yb - y) * K); };
  var couches = {BARRES: 1, LIAISONS: 7, SYMBOLES: 3, TEXTES: 7, CARTOUCHE: 8};
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(couches).length);
  Object.keys(couches).forEach(function(n){ g(0, 'LAYER'); g(2, n); g(70, 0); g(62, couches[n]); g(6, 'CONTINUOUS'); });
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  /* V3.31 : chaque symbole utilise est un BLOCK (en mm, origine = point d'insertion), insere par INSERT sur le calque SYMBOLES */
  var utilises = {}, listeBlocs = [];
  sc.prims.forEach(function(p){ if(p.t === 's' && !utilises[p.code]){ utilises[p.code] = 1; listeBlocs.push({code: p.code, entites: p.ents}); } });
  g(0, 'SECTION'); g(2, 'BLOCKS'); esyDxfBlocs(listeBlocs, false, g, nombre); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  var ligne = function(x1, y1, x2, y2, layer){
    if(R){ var c = eunClipLigne(x1, y1, x2, y2, R); if(!c) return; x1 = c[0]; y1 = c[1]; x2 = c[2]; y2 = c[3]; }
    g(0, 'LINE'); g(8, layer); g(10, X(x1)); g(20, Y(y1)); g(30, 0); g(11, X(x2)); g(21, Y(y2)); g(31, 0);
  };
  sc.prims.forEach(function(p){
    if(R && !eunTouche(eunBoite(p), R)) return;
    if(p.t === 'l'){
      if(p.w > 3){ [-1.5, 1.5].forEach(function(d){ ligne(p.x1, p.y1 + d, p.x2, p.y2 + d, p.layer); }); }
      else ligne(p.x1, p.y1, p.x2, p.y2, p.layer);
    } else if(p.t === 's'){ g(0, 'INSERT'); g(8, p.layer); g(2, esyNomBloc(p.code)); g(10, X(p.x)); g(20, Y(p.y)); g(30, 0); g(41, 1); g(42, 1); g(43, 1); g(50, 0); }
    else if(p.t === 'c'){ g(0, 'CIRCLE'); g(8, p.layer); g(10, X(p.cx)); g(20, Y(p.cy)); g(30, 0); g(40, nombre(p.r * K)); }
    else if(p.t === 'r'){ ligne(p.x, p.y, p.x + p.w, p.y, p.layer); ligne(p.x + p.w, p.y, p.x + p.w, p.y + p.h, p.layer); ligne(p.x + p.w, p.y + p.h, p.x, p.y + p.h, p.layer); ligne(p.x, p.y + p.h, p.x, p.y, p.layer); }
    else if(p.t === 't'){
      g(0, 'TEXT'); g(8, p.layer); g(10, X(p.x)); g(20, Y(p.y)); g(30, 0); g(40, nombre(p.h * K * 0.9));
      g(1, String(p.s).replace(/[^\x20-\xFF]/g, '-'));
      if(p.rot) g(50, 90);
      if(p.a !== 'start'){ g(72, p.a === 'end' ? 2 : 1); g(11, X(p.x)); g(21, Y(p.y)); g(31, 0); }
    }
  });
  g(0, 'ENDSEC'); g(0, 'EOF');
  return o.join('\r\n') + '\r\n';
}

/* ---------- 6. telechargements et impression ---------- */
function eunTelecharger(nom, contenu, type, latin1){
  var blob;
  if(latin1){ var u = new Uint8Array(contenu.length); for(var i = 0; i < contenu.length; i++){ var c = contenu.charCodeAt(i); u[i] = c < 256 ? c : 63; } blob = new Blob([u], {type: type}); }
  else blob = new Blob([contenu], {type: type});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function eunNomFichier(projet, ext, suffixe){ return 'Schema_unifilaire_' + String(projetLibelle(projet) || 'projet').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') + (suffixe ? '_' + suffixe : '') + '.' + ext; }
function eunImprimer(sc, projet, region, suffixe){
  var w = window.open('', '_blank');
  if(!w){ toast('Autorisez les fenêtres pop-up pour imprimer', 'danger'); return; }
  var paysage = region.w >= region.h;
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + eunXml(eunNomFichier(projet, 'pdf', suffixe)) + '</title><style>@page{size:A3 ' + (paysage ? 'landscape' : 'portrait') + ';margin:8mm}html,body{margin:0;background:#fff}svg{width:100%;height:auto;max-height:100vh}</style></head><body>' + eunSvg(sc, {region: region}) + '</body></html>');
  w.document.close(); w.focus(); setTimeout(function(){ w.print(); }, 400);
}
/* export d'une zone : format svg | dxf | pdf ; zone = etendue | affichage | fenetre (suffixe du nom de fichier) */
function eunExporter(sc, projet, format, region, zone){
  var suf = zone === 'etendue' ? '' : zone;
  var r = {x: Math.round(region.x * 100) / 100, y: Math.round(region.y * 100) / 100, w: Math.round(region.w * 100) / 100, h: Math.round(region.h * 100) / 100};
  if(format === 'svg') eunTelecharger(eunNomFichier(projet, 'svg', suf), eunSvg(sc, {region: r}), 'image/svg+xml');
  else if(format === 'dxf') eunTelecharger(eunNomFichier(projet, 'dxf', suf), eunDxf(sc, zone === 'etendue' ? null : r), 'application/dxf', true);
  else eunImprimer(sc, projet, r, suf);
}

/* ---------- 7. ecran : navigation a la souris façon AutoCAD ----------
   molette = zoom centre sur le curseur ; molette enfoncee (glisser) = deplacement ; double-clic molette = Zoom etendue ;
   « Zoom fenetre » = 2 coins ou glisser un cadre ; « Main » (ou barre d'espace maintenue + glisser) pour les souris sans molette ;
   Echap annule. Export : etendue / affichage / fenetre (comme les options « Etendue », « Affichage », « Fenetre » de la commande TRACER). */
var EUN_RT = {sc: null, ext: null, wrap: null, svg: null, vis: null, tool: null, coin: null, pending: null, espace: false, projet: null};
function eunStyleOnce(){
  if(byId('eun-style')) return;
  var st = document.createElement('style'); st.id = 'eun-style';
  st.textContent = '.eun-wrap{position:relative;overflow:hidden;border:1px solid var(--border,#d0d5db);border-radius:8px;background:#fff;height:calc(100vh - 250px);min-height:340px;touch-action:none;user-select:none;} .eun-wrap svg{display:block;width:100%;height:100%;}' +
    '.eun-wrap.pan{cursor:grab;} .eun-wrap.pan.on{cursor:grabbing;} .eun-wrap.pick{cursor:crosshair;}' +
    '.eun-hit{fill:transparent;cursor:pointer;} .eun-hit:hover{fill:rgba(27,79,216,.12);stroke:#1b4fd8;stroke-width:1;stroke-dasharray:4 3;} .eun-band{position:absolute;border:1px dashed #1b4fd8;background:rgba(27,79,216,.10);pointer-events:none;display:none;}' +
    '.eun-msg{position:absolute;left:10px;top:8px;background:rgba(27,79,216,.92);color:#fff;font-size:12.5px;padding:5px 10px;border-radius:6px;display:none;pointer-events:none;}' +
    '.eun-tool.actif{background:var(--primary,#1f3a5f);color:#fff;border-color:var(--primary,#1f3a5f);} .eun-pct{min-width:48px;text-align:center;font-size:12.5px;color:var(--muted,#667);}';
  document.head.appendChild(st);
}
function eunTailleEcran(){ var w = EUN_RT.wrap; return {cw: Math.max(1, w.clientWidth), ch: Math.max(1, w.clientHeight)}; }
/* applique la vue {cx, cy, w} : le cadre visible garde le rapport largeur/hauteur de l'ecran */
function eunAppliquer(){
  var R = EUN_RT; if(!R.wrap || !R.svg) return;
  var t = eunTailleEcran(), v = EUN_UI.view, w = v.w, h = w * t.ch / t.cw;
  R.vis = {x: v.cx - w / 2, y: v.cy - h / 2, w: w, h: h};
  R.svg.setAttribute('viewBox', R.vis.x + ' ' + R.vis.y + ' ' + R.vis.w + ' ' + R.vis.h);
  var pct = byId('eun-pct'); if(pct) pct.textContent = Math.round(t.cw / w * 100) + ' %';
}
function eunBornerVue(v){ var e = EUN_RT.ext; v.w = Math.max(60, Math.min(v.w, Math.max(e.w, e.h) * 8)); return v; }
function eunVersEtendue(){
  var R = EUN_RT, t = eunTailleEcran(), e = R.ext;
  EUN_UI.view = {cx: e.x + e.w / 2, cy: e.y + e.h / 2, w: Math.max(e.w, e.h * t.cw / t.ch) * 1.03};
  eunAppliquer();
}
function eunVersRect(r){
  var t = eunTailleEcran();
  EUN_UI.view = eunBornerVue({cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: Math.max(r.w, r.h * t.cw / t.ch) * 1.02});
  eunAppliquer();
}
function eunZoomAu(px, py, facteur){          /* zoom autour du point ecran (px, py) : le point vise ne bouge pas */
  var R = EUN_RT, b = R.wrap.getBoundingClientRect(), t = eunTailleEcran(), vis = R.vis;
  var fx = (px - b.left) / t.cw, fy = (py - b.top) / t.ch, wx = vis.x + fx * vis.w, wy = vis.y + fy * vis.h;
  var nw = eunBornerVue({w: vis.w * facteur}).w, nh = nw * t.ch / t.cw;
  EUN_UI.view = {cx: wx - fx * nw + nw / 2, cy: wy - fy * nh + nh / 2, w: nw};
  eunAppliquer();
}
function eunEcranVersMonde(px, py){
  var R = EUN_RT, b = R.wrap.getBoundingClientRect(), t = eunTailleEcran();
  return {x: R.vis.x + (px - b.left) / t.cw * R.vis.w, y: R.vis.y + (py - b.top) / t.ch * R.vis.h};
}
function eunOutil(nom, message){
  var R = EUN_RT; R.tool = nom; R.coin = null;
  if(R.wrap){
    R.wrap.classList.toggle('pan', nom === 'pan'); R.wrap.classList.toggle('pick', nom === 'zoomwin' || nom === 'exportwin');
    R.wrap.classList.remove('on');
    var m = byId('eun-msg'); if(m){ m.textContent = message || ''; m.style.display = message ? 'block' : 'none'; }
    var b = byId('eun-band'); if(b) b.style.display = 'none';
  }
  ['eun-zw', 'eun-pan'].forEach(function(id){ var e = byId(id); if(e) e.classList.toggle('actif', (id === 'eun-zw' && nom === 'zoomwin') || (id === 'eun-pan' && nom === 'pan')); });
}
function eunBande(a, b){                       /* cadre de selection (pixels) */
  var w = EUN_RT.wrap, r = w.getBoundingClientRect(), band = byId('eun-band');
  var x1 = Math.min(a.x, b.x) - r.left, y1 = Math.min(a.y, b.y) - r.top, x2 = Math.max(a.x, b.x) - r.left, y2 = Math.max(a.y, b.y) - r.top;
  band.style.display = 'block'; band.style.left = x1 + 'px'; band.style.top = y1 + 'px'; band.style.width = (x2 - x1) + 'px'; band.style.height = (y2 - y1) + 'px';
}
function eunFinFenetre(a, b){
  var R = EUN_RT, p1 = eunEcranVersMonde(a.x, a.y), p2 = eunEcranVersMonde(b.x, b.y);
  var rect = {x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y)};
  var nom = R.tool, cb = R.pending; R.pending = null;
  eunOutil(null);
  if(rect.w < 4 || rect.h < 4){ toast('Fenêtre trop petite', 'danger'); return; }
  if(nom === 'zoomwin') eunVersRect(rect);
  else if(nom === 'exportwin' && cb) cb(rect);
}
function eunLier(){
  var R = EUN_RT, wrap = R.wrap, mv = null;
  wrap.addEventListener('wheel', function(e){ e.preventDefault(); eunZoomAu(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0016)); }, {passive: false});
  wrap.addEventListener('contextmenu', function(e){ if(R.tool) e.preventDefault(); });
  wrap.addEventListener('mousedown', function(e){
    var pick = R.tool === 'zoomwin' || R.tool === 'exportwin';
    if(e.button === 1){                              /* molette enfoncee : deplacement ; double-clic = etendue */
      e.preventDefault();
      if(e.detail === 2){ eunVersEtendue(); return; }
      mv = {x: e.clientX, y: e.clientY, cx: EUN_UI.view.cx, cy: EUN_UI.view.cy}; wrap.classList.add('pan', 'on'); return;
    }
    if(e.button !== 0) return;
    if(pick){
      e.preventDefault();
      if(R.coin){ eunFinFenetre(R.coin, {x: e.clientX, y: e.clientY}); return; }          /* 2e clic : fin du cadre */
      R.coin = {x: e.clientX, y: e.clientY, depart: Date.now(), glisse: false}; return;
    }
    if(R.tool === 'pan' || R.espace){ e.preventDefault(); mv = {x: e.clientX, y: e.clientY, cx: EUN_UI.view.cx, cy: EUN_UI.view.cy}; wrap.classList.add('pan', 'on'); }
  });
  /* V3.34 : clic sur un symbole de protection (ou sur un jeu de barres) = fenetre de parametrage */
  var dn = null;
  wrap.addEventListener('mousedown', function(e){ dn = {x: e.clientX, y: e.clientY}; });
  wrap.addEventListener('click', function(e){
    if(e.button !== 0 || R.tool || R.espace || !dn || Math.abs(e.clientX - dn.x) + Math.abs(e.clientY - dn.y) > 5) return;
    var h = e.target.closest && e.target.closest('[data-hit]'); if(!h || !R.sc || !R.sc.hits) return;
    var info = R.sc.hits[parseInt(h.getAttribute('data-hit'), 10)];
    if(info && typeof epfOuvrir === 'function') epfOuvrir(info, R.projet);
  });
  window.addEventListener('mousemove', function(e){
    if(!R.wrap || !document.body.contains(R.wrap)) return;
    if(mv){
      var t = eunTailleEcran(), k = R.vis.w / t.cw;
      EUN_UI.view.cx = mv.cx - (e.clientX - mv.x) * k; EUN_UI.view.cy = mv.cy - (e.clientY - mv.y) * k; eunAppliquer(); return;
    }
    if(R.coin && (R.tool === 'zoomwin' || R.tool === 'exportwin')){
      if(Math.abs(e.clientX - R.coin.x) + Math.abs(e.clientY - R.coin.y) > 5) R.coin.glisse = true;
      eunBande(R.coin, {x: e.clientX, y: e.clientY});
    }
  });
  window.addEventListener('mouseup', function(e){
    if(!R.wrap || !document.body.contains(R.wrap)) return;
    if(mv){ mv = null; wrap.classList.remove('on'); if(R.tool !== 'pan' && !R.espace) wrap.classList.remove('pan'); return; }
    if(R.coin && R.coin.glisse && e.button === 0 && (R.tool === 'zoomwin' || R.tool === 'exportwin')) eunFinFenetre(R.coin, {x: e.clientX, y: e.clientY});   /* glisser-deposer */
  });
  /* tactile : un doigt = deplacement, deux doigts = pincement */
  var tc = null;
  wrap.addEventListener('touchstart', function(e){
    if(e.touches.length === 1) tc = {mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, cx: EUN_UI.view.cx, cy: EUN_UI.view.cy};
    else if(e.touches.length === 2) tc = {mode: 'zoom', d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)};
  }, {passive: true});
  wrap.addEventListener('touchmove', function(e){
    if(!tc) return; e.preventDefault();
    if(tc.mode === 'pan' && e.touches.length === 1){
      var t = eunTailleEcran(), k = R.vis.w / t.cw;
      EUN_UI.view.cx = tc.cx - (e.touches[0].clientX - tc.x) * k; EUN_UI.view.cy = tc.cy - (e.touches[0].clientY - tc.y) * k; eunAppliquer();
    } else if(tc.mode === 'zoom' && e.touches.length === 2){
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if(tc.d > 0 && d > 0){ eunZoomAu((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2, tc.d / d); tc.d = d; }
    }
  }, {passive: false});
  wrap.addEventListener('touchend', function(){ tc = null; }, {passive: true});
  if(window.ResizeObserver){ var ro = new ResizeObserver(function(){ eunAppliquer(); }); ro.observe(wrap); }
}
/* clavier : Echap annule l'outil ; barre d'espace maintenue = main ; 0 ou Home = etendue */
if(!window.__eunClavier){
  window.__eunClavier = true;
  window.addEventListener('keydown', function(e){
    var R = EUN_RT; if(!R.wrap || !document.body.contains(R.wrap)) return;
    var tg = e.target && e.target.tagName; if(tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if(e.key === 'Escape'){ R.pending = null; eunOutil(null); }
    else if(e.key === ' '){ e.preventDefault(); if(!R.espace){ R.espace = true; R.wrap.classList.add('pan'); } }
    else if(e.key === '0' || e.key === 'Home') eunVersEtendue();
  });
  window.addEventListener('keyup', function(e){
    var R = EUN_RT; if(e.key === ' ' && R.espace){ R.espace = false; if(R.wrap && R.tool !== 'pan') R.wrap.classList.remove('pan'); }
  });
}

function eunDialogueExport(){
  var R = EUN_RT, sc = R.sc, projet = R.projet;
  var ov = openModal({
    title: 'Exporter le schéma unifilaire',
    body: '<div class="field"><label>Zone à exporter</label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:4px 0;"><input type="radio" name="eun-zone" value="etendue" checked style="width:auto;margin-top:3px;"> <span><b>Vue entière</b> (étendue) : tout le schéma</span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:4px 0;"><input type="radio" name="eun-zone" value="affichage" style="width:auto;margin-top:3px;"> <span><b>Affichage</b> : ce qui est affiché à l’écran</span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin:4px 0;"><input type="radio" name="eun-zone" value="fenetre" style="width:auto;margin-top:3px;"> <span><b>Fenêtre</b> : sélection à la souris (vous tracez le cadre sur le schéma)</span></label></div>' +
      '<div class="field"><label for="eun-fmt">Format</label><select id="eun-fmt"><option value="dxf">DXF (AutoCAD)</option><option value="svg">SVG</option><option value="pdf">PDF (impression A3)</option></select></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button> <button type="button" class="btn btn-primary" id="eun-go">Exporter</button>'
  });
  ov.querySelector('#eun-go').addEventListener('click', function(){
    var zone = (ov.querySelector('input[name="eun-zone"]:checked') || {}).value || 'etendue', fmt = ov.querySelector('#eun-fmt').value;
    closeModal();
    if(zone === 'etendue') eunExporter(sc, projet, fmt, R.ext, 'etendue');
    else if(zone === 'affichage') eunExporter(sc, projet, fmt, R.vis, 'affichage');
    else {
      R.pending = function(rect){ eunExporter(sc, projet, fmt, rect, 'fenetre'); };
      eunOutil('exportwin', 'Exporter une fenêtre : cliquez le premier coin puis le second (ou glissez un cadre). Échap pour annuler.');
    }
  });
}

function renderEtudeUnifilaire(mount, actions){
  eeStyleOnce(); eunStyleOnce(); actions.innerHTML = '';
  var projets = eeProjetsDe();
  if(!projets.length){ mount.innerHTML = emptyState('ruler', 'Aucun contrat ni devis enregistré. Le schéma se rattache à un contrat ou à un devis.'); return; }
  if(!EUN_UI.projetId || !projets.some(function(p){ return p.id === EUN_UI.projetId; })){
    var avec = projets.filter(function(p){ return (STATE.etudeConsommateurs || []).some(function(d){ return projetIdDe(d) === p.id; }); })[0];
    EUN_UI.projetId = (avec || projets[0]).id; EUN_UI.view = null;
  }
  var projet = projetParId(EUN_UI.projetId);
  var sc = eunScene(projet); EUN_SCENE = sc;
  actions.innerHTML = '<button type="button" class="btn btn-primary" id="eun-exp"' + (sc.vide ? ' disabled' : '') + '>Exporter…</button>';
  var corps = sc.vide
    ? emptyState('ruler', 'Aucun tableau à représenter.', '<p class="hint">Renseignez la colonne « Switchgear / MCC » des consommateurs dans « Base de données ».</p>')
    : '<div class="eun-wrap" id="eun-wrap">' + eunSvg(sc, {ecran: true}) + '<div class="eun-band" id="eun-band"></div><div class="eun-msg" id="eun-msg"></div></div>';
  mount.innerHTML = '<div class="section-head"><div class="toolbar"><select id="eun-projet" title="Contrat ou devis">' + projetsOptionsHtml(EUN_UI.projetId, null, '', true) + '</select>' +
    '<label style="display:flex;gap:6px;align-items:center;font-weight:400;"><input type="checkbox" id="eun-rec" style="width:auto;"' + (EUN_UI.recepteurs ? ' checked' : '') + '> Récepteurs</label>' +
    '<label style="display:flex;gap:6px;align-items:center;font-weight:400;" title="Ajoute « (fiche technique) » sous les protections dont le déclencheur a une fiche jointe"><input type="checkbox" id="eun-fic" style="width:auto;"' + (EUN_UI.fiches ? ' checked' : '') + '> Repère fiches</label>' +
    '<button type="button" class="btn" id="eun-ext" title="Zoom étendue : tout afficher (double-clic molette, touche 0)">Tout afficher</button>' +
    '<button type="button" class="btn eun-tool" id="eun-zw" title="Zoom fenêtre : deux coins ou cadre glissé">Zoom fenêtre</button>' +
    '<button type="button" class="btn eun-tool" id="eun-pan" title="Main : déplacer le schéma (ou molette enfoncée, ou barre d’espace)">Main</button>' +
    '<button type="button" class="btn" id="eun-zm" title="Réduire">−</button><span class="eun-pct" id="eun-pct"></span><button type="button" class="btn" id="eun-zp" title="Agrandir">+</button></div></div>' +
    '<p class="hint" style="margin:-4px 0 10px;">Schéma unifilaire de ' + esc(projet ? projetLibelle(projet) : '') + ' : de la source aux tableaux (' + sc.nbTableaux + ')' + (EUN_UI.recepteurs ? ', avec les récepteurs' : ', sans les récepteurs') + ', sans les tableaux modèles. ' +
    '<b>Souris</b> : molette = zoom, molette enfoncée (glisser) = déplacer, double-clic molette = tout afficher, « Zoom fenêtre » = tracer un cadre.</p>' + corps;
  byId('eun-projet').addEventListener('change', function(e){ EUN_UI.projetId = e.target.value; EUN_UI.view = null; renderEtudeUnifilaire(mount, actions); });
  byId('eun-fic').addEventListener('change', function(e){ EUN_UI.fiches = e.target.checked; renderEtudeUnifilaire(mount, actions); });
  byId('eun-rec').addEventListener('change', function(e){ EUN_UI.recepteurs = e.target.checked; EUN_UI.view = null; renderEtudeUnifilaire(mount, actions); });
  EUN_RT.sc = sc; EUN_RT.projet = projet; EUN_RT.ext = eunEtendue(sc); EUN_RT.wrap = byId('eun-wrap'); EUN_RT.tool = null; EUN_RT.coin = null; EUN_RT.pending = null;
  if(sc.vide){ EUN_RT.wrap = null; return; }
  EUN_RT.svg = EUN_RT.wrap.querySelector('svg');
  EUN_RT.svg.removeAttribute('width'); EUN_RT.svg.removeAttribute('height');
  if(EUN_UI.view) eunAppliquer(); else eunVersEtendue();
  eunLier();
  byId('eun-ext').addEventListener('click', function(){ eunOutil(null); eunVersEtendue(); });
  byId('eun-zw').addEventListener('click', function(){ if(EUN_RT.tool === 'zoomwin') eunOutil(null); else eunOutil('zoomwin', 'Zoom fenêtre : cliquez le premier coin puis le second (ou glissez un cadre). Échap pour annuler.'); });
  byId('eun-pan').addEventListener('click', function(){ if(EUN_RT.tool === 'pan') eunOutil(null); else eunOutil('pan', ''); });
  byId('eun-zm').addEventListener('click', function(){ var b = EUN_RT.wrap.getBoundingClientRect(); eunZoomAu(b.left + b.width / 2, b.top + b.height / 2, 1.25); });
  byId('eun-zp').addEventListener('click', function(){ var b = EUN_RT.wrap.getBoundingClientRect(); eunZoomAu(b.left + b.width / 2, b.top + b.height / 2, 0.8); });
  byId('eun-exp').addEventListener('click', eunDialogueExport);
}
