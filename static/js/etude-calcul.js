/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.14) - Sous-menu « Calcul ».
   Charge APRES etude-cables.js (utilise eeProjetsDe, eeLignesDuProjet, eeSectionsAmontAval, eelCle, eelPuissanceInstallee,
   ecbCharger / ECB_DATA, eprCategories, STATE.etudeMat*, openModal, toast...).

   A gauche : hierarchie de la distribution (SOURCE > tableaux > sous-tableaux), deduite de la base de donnees des
   consommateurs (un consommateur dont le tag est le nom d'un tableau est le depart de ce tableau).
   A droite : detail du tableau selectionne (un depart par ligne). Pour chaque depart on saisit le cable (catalogue des cables),
   la longueur et la protection (catalogue des protections : constructeur > categorie > gamme > calibre > declencheur).
   Les saisies sont stockees dans etudeBtCircuits (une ligne par consommateur). Aucun resultat de calcul (IB, section, chute de
   tension, Ik) n'est affiche a ce stade : il viendra avec le moteur de calcul.
   ========================================================= */

var ECC_UI = {projetId:'', cle:''};      // cle '' = SOURCE (racine)
var ECC_CAB = {};                        // cache : famille -> cables
var ECC_COLS = [
  ['Repère', 'tag'], ['Style', 'style'], ['Contenu', 'contenu'], ['Nb', 'nb'], ['Consommation', 'conso'], ['Longueur (m)', 'lg'], ['Protection', 'prot'],
  ['Prot CI', 'protCi'], ['JdB', 'jdb'], ['D. Origine', 'orig'], ['Alimentation', 'alim'], ['Lieu', 'lieu'], ['Désignation', 'des']];

function eccStyleOnce(){
  if(byId('ecc-style')) return;
  var st = document.createElement('style'); st.id = 'ecc-style';
  st.textContent =
    '.ecc-layout{display:flex;gap:12px;align-items:flex-start;} .ecc-tree{flex:0 0 280px;max-height:calc(100vh - 260px);overflow:auto;border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);padding:8px 6px;}'+
    '.ecc-tree .t{margin:0;padding:3px 6px;border-radius:4px;cursor:pointer;font-size:13px;white-space:nowrap;} .ecc-tree .t:hover{background:var(--surface-2,#f1f3f5);} .ecc-tree .t.on{background:var(--primary,#1f3a5f);color:#fff;}'+
    '.ecc-tree .tt{font-weight:600;font-size:12px;color:var(--muted,#667);padding:2px 6px 6px;}'+
    '.ecc-main{flex:1;min-width:0;} .ecc-wrap{overflow:auto;max-height:calc(100vh - 290px);border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);}'+
    '.ecc-t{border-collapse:separate;border-spacing:0;font-size:12.5px;width:max-content;min-width:100%;} .ecc-t th{position:sticky;top:0;background:var(--surface-2,#f1f3f5);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border,#d0d5db);font-weight:600;white-space:nowrap;}'+
    '.ecc-t td{padding:4px 8px;border-bottom:1px solid var(--border-soft,#eceff2);white-space:nowrap;} .ecc-t tr.lig{cursor:pointer;} .ecc-t tr.lig:hover td{background:#fff8e1;} .ecc-t td.r{text-align:right;font-variant-numeric:tabular-nums;} .ecc-t td.vide{color:#b0b6bd;}'+
    '.ecc-t tr.tab td{font-weight:600;color:var(--primary,#1f3a5f);} .ecc-f{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;} .ecc-f .field{margin:0;} .ecc-f h4{grid-column:1/-1;margin:6px 0 0;font-size:13px;}'+
    '.ecc-t tr.herite td{color:#5b6573;font-style:italic;} .ecc-t tr.herite td:first-child{border-left:3px solid #9aa7b8;}'+
    '@media (max-width:900px){.ecc-layout{flex-direction:column;} .ecc-tree{flex:none;width:100%;max-height:240px;}}';
  document.head.appendChild(st);
}

/* ---------- donnees ---------- */
/* instCle (V3.23) : appartement qui herite d'un modele ; la personnalisation d'un depart herite est un circuit avec instanceCle = cle de l'appartement.
   Sans instCle, on renvoie le circuit « normal » (jamais une personnalisation). */
function eccCircuit(projetId, consoId, instCle){
  var l = (STATE.etudeBtCircuits||[]).filter(function(c){ return projetIdDe(c) === projetId && c.consoId === consoId; });
  if(instCle){ var o = l.filter(function(c){ return c.instanceCle === instCle; })[0]; if(o) return o; }
  return l.filter(function(c){ return !c.instanceCle; })[0] || null;
}
function eccProtTexte(c){
  if(!c || !c.protConstructeur) return '';
  var t = [c.protGamme, c.protVariante && c.protVariante !== '—' ? c.protVariante : '', c.protCalibre ? c.protCalibre+' A' : '', c.protCourbe && c.protCourbe !== '—' ? 'courbe '+c.protCourbe : '', c.protDeclencheur].filter(Boolean).join(' ');
  return c.protConstructeur + ' ' + t;
}
/* ---------- representation du cable façon Caneco (V3.20) : « Câble / Neutre / PE ou PEN » ----------
   multipolaire : 3x120 (sans PE), 5G4 (G = conducteur vert/jaune dans le cable) ; unipolaires : 3X(1x240) + Neutre 1x240 + PE 1x70.
   Plusieurs cables par phase : « 2 Câbles 3x120 ». Champs du circuit : cableStructure (multi | uni), cableNbCond, cableAvecPe, neutreNb, neutreMm2, peNb, peMm2. */
function eccContenuDefaut(d){
  var t = String(d && d.contenu || '').toUpperCase(), m = /(\d)\s*P/.exec(t), ph = m ? Number(m[1]) : (t ? 1 : 3);
  var n = /(^|\+)\s*N(\+|$)/.test(t), pe = /PE/.test(t);
  return {nbCond: ph + (n ? 1 : 0) + (pe ? 1 : 0), avecPe: pe};
}
function eccReprCable(c){
  if(!c || !c.cableStructure || !c.cableSectionTxt) return null;
  var nb = Number(c.nbCables) > 1 ? c.nbCables + ' Câbles ' : '', n = Number(c.cableNbCond) || 3, s = String(c.cableSectionTxt), o = {cable: '', neutre: '', pe: ''};
  if(c.cableStructure === 'uni'){
    o.cable = nb + n + 'X(1x' + s + ')';
    if(Number(c.neutreNb) > 0 && c.neutreMm2) o.neutre = c.neutreNb + 'x' + eccFmtNum(c.neutreMm2);
    if(Number(c.peNb) > 0 && c.peMm2) o.pe = c.peNb + 'x' + eccFmtNum(c.peMm2);
  } else o.cable = nb + n + (c.cableAvecPe ? 'G' : 'x') + s;
  return o;
}
/* circuit saisi avant la V3.20 (pas de structure memorisee) : meme valeur par defaut que la fiche, deduite du « Contenu » du consommateur */
function eccAlimTexte(c, d){
  if(c && c.cableFamille && c.cableSectionTxt && !c.cableStructure){
    var dd = eccContenuDefaut(d);
    c = Object.assign({}, c, {cableStructure: 'multi', cableNbCond: dd.nbCond, cableAvecPe: dd.avecPe});
  }
  var r = eccReprCable(c);
  if(!r) return eccCableTexte(c);
  return r.cable + (r.neutre ? ' + N ' + r.neutre : '') + (r.pe ? ' + PE ' + r.pe : '') + (c.cableFamille ? ' · ' + c.cableFamille : '');
}
function eccReprHtml(r){
  var l = function(t, v){ return '<tr><td style="text-align:right;padding:2px 10px;color:#555;">' + t + '</td><td style="padding:2px 10px;color:#1b4fd8;font-weight:600;min-width:140px;">' + esc(v || '') + '</td></tr>'; };
  return '<table style="border-collapse:collapse;background:#f6f8fb;border:1px solid var(--border,#d0d5db);border-radius:6px;">' + l('Câble', r ? r.cable : '') + l('Neutre', r ? r.neutre : '') + l('PE ou PEN', r ? r.pe : '') + '</table>';
}
function eccCableTexte(c){
  if(!c || !c.cableFamille) return '';
  var n = Number(c.nbCables) > 1 ? c.nbCables + ' × ' : '';
  return n + c.cableFamille + (c.cableSectionTxt ? ' ' + c.cableSectionTxt + ' mm²' : '');
}
function eccConso(d){
  var t = (typeof eelPuissanceInstallee === 'function') ? eelPuissanceInstallee(d) : '';
  if(t) return t;
  if(d.puissanceKw === null || d.puissanceKw === undefined || d.puissanceKw === '') return '';
  return eccFmtNum(d.puissanceKw) + ' ' + (d.unite || 'kW');
}
/* texte Caneco d'origine, affiche quand le catalogue n'a pas de correspondance */
function eccProtCaneco(c){
  if(!c || !c.canecoBlocCoupure) return '';
  return 'Caneco : ' + [c.canecoBlocCoupure, c.canecoBlocDecl, c.canecoCalibre ? c.canecoCalibre + ' A' : ''].filter(Boolean).join(' ') + ' (non relié)';
}
function eccCableCaneco(c){
  if(!c || !c.canecoCable) return '';
  return 'Caneco : ' + [c.canecoCable, c.canecoTypeCable].filter(Boolean).join(' ') + ' (non relié)';
}
function eccFmtNum(v){ return (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('fr-FR', {maximumFractionDigits:2, useGrouping:false}); }

/* arbre : enfants par cle de tableau */
function eccArbre(sections){
  var enfants = {'': []};
  var connus = {};
  sections.forEach(function(s){ if(s.cle) connus[s.cle] = true; });
  sections.forEach(function(s){
    if(!s.cle) return;
    (enfants[s.amontCle] = enfants[s.amontCle] || []).push(s);
  });
  /* tableaux sans depart propre (ex. TABLEAU1.2) : un consommateur de type Tableau dont le nom n'est le « Switchgear » d'aucune ligne apparait quand meme dans l'arbre */
  sections.slice().forEach(function(s){
    if(!s.cle) return;
    s.lignes.forEach(function(d){
      var t = eelCle(d.tag);
      if(t && !connus[t] && String(d.typeConso||'').toLowerCase() === 'tableau'){
        connus[t] = true;
        /* V3.23 : « Depart type » = modele (ex. Appart type 12) : l'appartement herite des departs du tableau modele */
        var mk = eelCle(d.specialReqts), mod = mk && mk !== t ? sections.filter(function(x){ return x.cle === mk; })[0] : null;
        (enfants[s.cle] = enfants[s.cle] || []).push({cle: t, titre: eelTexte(d.tag), amont: s.titre, amontCle: s.cle, departId: d.id, niveau: s.niveau + 1,
          lignes: mod ? mod.lignes : [], virtuel: true, modele: mod ? mod.cle : '', modeleTitre: mod ? mod.titre : ''});
      }
    });
  });
  /* tableaux modeles : references par le « Depart type » d'au moins un appartement ; ranges dans la rubrique « Modeles », hors SOURCE */
  var modeles = {}, nbInst = {};
  Object.keys(enfants).forEach(function(k){ (enfants[k]||[]).forEach(function(x){ if(x.virtuel && x.modele){ modeles[x.modele] = true; nbInst[x.modele] = (nbInst[x.modele]||0) + 1; } }); });
  enfants['__modeles'] = (enfants[''] || []).filter(function(x){ return modeles[x.cle]; });
  enfants[''] = (enfants[''] || []).filter(function(x){ return !modeles[x.cle]; });
  enfants['__modeles'].forEach(function(m){ m.nbInstances = nbInst[m.cle] || 0; });
  return enfants;
}
function eccArbreHtml(sections, enfants, projetId){
  var out = '';
  if((enfants['__modeles']||[]).length){
    out += '<div class="tt">Modèles <span style="font-weight:400;">(sans calcul)</span></div>';
    enfants['__modeles'].forEach(function(m){
      out += '<div class="t'+(ECC_UI.cle===m.cle?' on':'')+'" data-cle="'+esc(m.cle)+'" style="padding-left:10px;" title="Modèle utilisé par '+m.nbInstances+' appartement(s)">'+esc(m.titre)+' <span style="opacity:.6;">('+m.lignes.length+')</span> <span style="opacity:.55;font-size:11px;">× '+m.nbInstances+'</span></div>';
    });
    out += '<div style="height:8px;"></div>';
  }
  out += '<div class="tt">Toutes les distributions depuis :</div><div class="t'+(ECC_UI.cle===''?' on':'')+'" data-cle="" style="font-weight:600;">SOURCE</div>';
  function noeud(s, niveau){
    out += '<div class="t'+(ECC_UI.cle===s.cle?' on':'')+'" data-cle="'+esc(s.cle)+'" style="padding-left:'+(10+niveau*16)+'px;" title="'+esc(s.titre)+(s.modeleTitre ? ' — hérite de '+esc(s.modeleTitre) : '')+'">'+(niveau ? '└ ' : '')+esc(s.titre)+' <span style="opacity:.6;">('+s.lignes.length+')</span>'+(s.modeleTitre ? ' <span style="opacity:.55;font-style:italic;font-size:11px;">↳ '+esc(s.modeleTitre)+'</span>' : '')+'</div>';
    (enfants[s.cle]||[]).forEach(function(c){ noeud(c, niveau+1); });
  }
  (enfants['']||[]).forEach(function(s){ noeud(s, 1); });
  var sans = sections.filter(function(s){ return !s.cle && s.lignes.length; })[0];
  if(sans) out += '<div class="t'+(ECC_UI.cle==='__sans'?' on':'')+'" data-cle="__sans" style="padding-left:10px;opacity:.8;">Sans tableau ('+sans.lignes.length+')</div>';
  return out;
}

function eccVirtuel(enfants, cle){
  var r = null;
  Object.keys(enfants).forEach(function(k){ (enfants[k]||[]).forEach(function(x){ if(x.cle === cle && x.virtuel) r = x; }); });
  return r;
}
/* lignes du detail : { d: consommateur ou null, section, circuit, nomTableau } */
function eccLignesDe(sections, enfants, projetId){
  var rows = [];
  if(ECC_UI.cle === ''){
    (enfants['']||[]).forEach(function(s){ rows.push({tableau: s}); });
    return rows;
  }
  var sec = sections.filter(function(s){ return (ECC_UI.cle === '__sans' ? !s.cle : s.cle === ECC_UI.cle); })[0] || eccVirtuel(enfants, ECC_UI.cle);
  if(!sec) return rows;
  if(sec.virtuel && sec.modele){      /* appartement : departs herites du modele (lecture seule, personnalisables un par un) */
    sec.lignes.forEach(function(d){
      var c = eccCircuit(projetId, d.id, sec.cle);
      rows.push({d: d, section: {titre: sec.titre, cle: sec.cle}, circuit: c, herite: true, instCle: sec.cle, modeleTitre: sec.modeleTitre, perso: !!(c && c.instanceCle)});
    });
    return rows;
  }
  sec.lignes.forEach(function(d){ rows.push({d: d, section: sec, circuit: eccCircuit(projetId, d.id)}); });
  return rows;
}
function eccLigneHtml(r){
  if(r.tableau){
    var s = r.tableau;
    return '<tr class="lig tab" data-cle="'+esc(s.cle)+'"><td>'+esc(s.titre)+'</td><td>Tableau</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>SOURCE</td><td></td><td></td><td>'+s.lignes.length+' départ(s)</td></tr>';
  }
  var d = r.d, c = r.circuit, v = function(x){ return x === '' || x === null || x === undefined; };
  var lg = c && !v(c.longueurM) ? c.longueurM : d.longueur;
  var cells = [
    ['', d.tag], ['', d.typeConso], ['', d.contenu], ['r', d.nombre], ['r', eccConso(d)],
    ['r', eccFmtNum(lg)], ['', eccProtTexte(c) || eccProtCaneco(c)], ['', c && c.protCi ? c.protCi : d.ci], ['', c && c.jdb], ['', r.section.titre], ['', eccAlimTexte(c, d) || eccCableCaneco(c)],
    ['', c && c.lieu], ['', c && c.designation ? c.designation : d.nom]];
  if(r.herite) cells[0][1] = (d.tag || '') + (r.perso ? '  ✎' : '');
  return '<tr class="lig'+(r.herite ? ' herite' : '')+'" data-id="'+esc(d.id)+'"'+(r.herite ? ' title="'+(r.perso ? 'Personnalisé pour cet appartement' : 'Hérité de '+esc(r.modeleTitre)+' (cliquer pour personnaliser)')+'"' : '')+'>'+cells.map(function(x){ return '<td class="'+x[0]+(v(x[1])?' vide':'')+'">'+(v(x[1]) ? '·' : esc(x[1]))+'</td>'; }).join('')+'</tr>';
}

/* ---------- ecran ---------- */
function renderEtudeCalcul(mount, actions){
  eeStyleOnce(); eccStyleOnce();
  actions.innerHTML = '';
  var projets = eeProjetsDe();
  if(!projets.length){ mount.innerHTML = emptyState('ruler', 'Aucun contrat ni devis enregistré. Le calcul se rattache à un contrat ou à un devis.'); return; }
  if(!ECC_UI.projetId || !projets.some(function(p){ return p.id === ECC_UI.projetId; })){
    var avec = projets.filter(function(p){ return (STATE.etudeConsommateurs||[]).some(function(d){ return projetIdDe(d) === p.id; }); })[0];
    ECC_UI.projetId = (avec || projets[0]).id; ECC_UI.cle = '';
  }
  var projet = projetParId(ECC_UI.projetId);
  var sections = eeSectionsAmontAval(eeLignesDuProjet(ECC_UI.projetId));
  var enfants = eccArbre(sections);
  if(ECC_UI.cle && ECC_UI.cle !== '__sans' && !sections.some(function(s){ return s.cle === ECC_UI.cle; }) && !eccVirtuel(enfants, ECC_UI.cle)) ECC_UI.cle = '';
  var rows = eccLignesDe(sections, enfants, ECC_UI.projetId);
  var canEdit = canWrite('etude_elec');
  actions.innerHTML = '<button type="button" class="btn btn-primary" id="ecc-caneco"'+(canEdit && projet ? '' : ' disabled')+' title="Importer les câbles et protections d’une note de calcul Caneco">'+ic('upload',15)+' Importer note Caneco</button>'+
    (typeof ecnCircuitsImportes === 'function' && projet && ecnCircuitsImportes(projet.id).length ? ' <button type="button" class="btn" id="ecc-liens"'+(canEdit ? '' : ' disabled')+' title="Relier les câbles et protections Caneco à nos catalogues (circuits déjà importés)">Liens Caneco</button>' : '');
  var nodeCur = (ECC_UI.cle && ECC_UI.cle !== '__sans') ? (eccVirtuel(enfants, ECC_UI.cle) || (enfants['__modeles']||[]).filter(function(m){ return m.cle === ECC_UI.cle; })[0] || null) : null;
  var bandeau = '';
  if(nodeCur && nodeCur.virtuel && nodeCur.modele) bandeau = '<p class="hint" style="margin:0 0 8px;">Appartement de type <b>'+esc(nodeCur.modeleTitre)+'</b> : les départs ci-dessous sont <b>hérités du modèle</b> (câbles, protections et longueurs saisis une seule fois sur le modèle). Cliquez un départ pour le <b>personnaliser</b> pour cet appartement seulement.</p>';
  else if(nodeCur && nodeCur.nbInstances !== undefined) bandeau = '<p class="hint" style="margin:0 0 8px;"><b>Modèle</b> : pas de calcul ici (chute de tension et courant de court-circuit dépendent de l’amont). Les départs saisis sont repris par les <b>'+nodeCur.nbInstances+'</b> appartement(s) qui ont « '+esc(nodeCur.titre)+' » dans « Départ type ».</p>';
  var titre = ECC_UI.cle === '' ? 'SOURCE : tableaux alimentés directement' : (ECC_UI.cle === '__sans' ? 'Sans tableau' : (sections.filter(function(s){ return s.cle === ECC_UI.cle; })[0] || eccVirtuel(enfants, ECC_UI.cle) || {}).titre);

  var corps;
  if(!sections.some(function(s){ return s.cle; })){
    corps = emptyState('ruler', 'Aucun tableau (Switchgear / MCC) dans la base de données de ce contrat / devis.', '<p class="hint">Renseignez la colonne « Switchgear / MCC » des consommateurs dans « Base de données ».</p>');
  } else {
    corps = '<div class="ecc-layout"><div class="ecc-tree" id="ecc-tree">'+eccArbreHtml(sections, enfants, ECC_UI.projetId)+'</div>'+
      '<div class="ecc-main">'+bandeau+'<div style="font-weight:600;margin:0 0 6px;">'+esc(titre)+' <span class="hint" style="font-weight:400;">— '+rows.length+' ligne(s)'+(canEdit ? ' · cliquez une ligne pour saisir le câble, la longueur et la protection' : '')+'</span></div>'+
      '<div class="ecc-wrap"><table class="ecc-t"><thead><tr>'+ECC_COLS.map(function(c){ return '<th>'+c[0]+'</th>'; }).join('')+'</tr></thead><tbody>'+
      (rows.length ? rows.map(eccLigneHtml).join('') : '<tr><td colspan="13" class="vide">Aucun départ.</td></tr>')+'</tbody></table></div></div></div>';
  }
  mount.innerHTML = '<div class="section-head"><div class="toolbar"><select id="ecc-projet" title="Contrat ou devis">'+projetsOptionsHtml(ECC_UI.projetId, null, '', true)+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Distribution de '+esc(projet ? projetLibelle(projet) : '')+', de la source aux tableaux, déduite de la base de données. Les colonnes calculées (IB, section, chute de tension, Ik) viendront avec le moteur de calcul.</p>'+corps;

  byId('ecc-caneco').addEventListener('click', function(){ ecnOuvrir(projet); });
  if(byId('ecc-liens')) byId('ecc-liens').addEventListener('click', function(){ ecnOuvrirLiens(projet); });
  byId('ecc-projet').addEventListener('change', function(e){ ECC_UI.projetId = e.target.value; ECC_UI.cle = ''; renderEtudeCalcul(mount, actions); });
  mount.querySelectorAll('#ecc-tree .t').forEach(function(n){ n.addEventListener('click', function(){ ECC_UI.cle = n.getAttribute('data-cle'); renderEtudeCalcul(mount, actions); }); });
  mount.querySelectorAll('tr.lig').forEach(function(tr){
    tr.addEventListener('click', function(){
      if(tr.getAttribute('data-cle')){ ECC_UI.cle = tr.getAttribute('data-cle'); renderEtudeCalcul(mount, actions); return; }
      if(!canEdit){ toast('Consultation seule'); return; }
      var r = rows.filter(function(x){ return x.d && x.d.id === tr.getAttribute('data-id'); })[0];
      if(!r) return;
      if(r.herite && !r.perso){ eccChoixHerite(projet, r); return; }
      eccOuvrirSaisie(projet, r);
    });
  });
}

/* depart herite d'un modele : personnaliser pour cet appartement, ou aller sur le modele */
function eccChoixHerite(projet, r){
  var ov = openModal({
    title: 'Départ hérité du modèle',
    body: '<p>Le départ <b>'+esc(r.d.tag||'')+'</b> de l’appartement <b>'+esc(r.section.titre)+'</b> est hérité du modèle <b>'+esc(r.modeleTitre)+'</b> : il utilise le câble, la protection et la longueur saisis sur le modèle.</p>'+
      '<p class="hint">« Personnaliser » crée une saisie propre à cet appartement (le modèle et les autres appartements ne changent pas). « Revenir au modèle » est possible ensuite.</p>',
    foot: '<button type="button" class="btn" data-close-modal>Fermer</button> <button type="button" class="btn" id="ecc-hm">Ouvrir le modèle</button> <button type="button" class="btn btn-primary" id="ecc-hp">Personnaliser pour '+esc(r.section.titre)+'</button>'
  });
  ov.querySelector('#ecc-hm').addEventListener('click', function(){ closeModal(); ECC_UI.cle = eelCle(r.modeleTitre); scheduleRender(); });
  ov.querySelector('#ecc-hp').addEventListener('click', function(){ closeModal(); eccOuvrirSaisie(projet, r); });
}

/* ---------- saisie d'un circuit ---------- */
function eccCables(famille, cb){
  if(ECC_CAB[famille]) return cb(ECC_CAB[famille]);
  fetch('/api/etude-elec/cables/famille?nom='+encodeURIComponent(famille)).then(function(r){ return r.json(); })
    .then(function(j){ ECC_CAB[famille] = Array.isArray(j) ? j : []; cb(ECC_CAB[famille]); })
    .catch(function(e){ console.error(e); cb([]); });
}
function eccOpts(liste, sel, vide){
  return '<option value="">'+esc(vide||'—')+'</option>'+liste.map(function(x){ var v = (typeof x === 'object') ? x.v : x, t = (typeof x === 'object') ? x.t : x; return '<option value="'+esc(v)+'"'+(String(v)===String(sel)?' selected':'')+'>'+esc(t)+'</option>'; }).join('');
}
function eccOuvrirSaisie(projet, r){
  var d = r.d, c = r.circuit || {};
  var cons = (STATE.etudeMatConstructeurs||[]).slice().sort(function(a,b){ return (a.rang||0)-(b.rang||0) || String(a.code).localeCompare(b.code); });
  var champ = function(id, lab, html){ return '<div class="field"><label for="'+id+'">'+lab+'</label>'+html+'</div>'; };
  var info = c.canecoBlocCoupure || c.canecoCable ? '<p class="hint" style="margin:0 0 8px;">Importé de Caneco : câble <b>'+esc(c.canecoCable||'—')+'</b> '+esc(c.canecoTypeCable||'')+' · protection <b>'+esc([c.canecoBlocCoupure, c.canecoBlocDecl, c.canecoCalibre ? c.canecoCalibre+' A' : ''].filter(Boolean).join(' ')||'—')+'</b>'+(c.canecoContacteur ? ' · contacteur '+esc(c.canecoContacteur) : '')+(c.canecoRelais ? ' · relais '+esc(c.canecoRelais) : '')+(c.canecoRef ? ' · réf. '+esc(c.canecoRef) : '')+'</p>' : '';
  var dd = eccContenuDefaut(d), dfl = {structure: c.cableStructure || 'multi', nbCond: c.cableNbCond || dd.nbCond, avecPe: c.cableStructure ? !!c.cableAvecPe : dd.avecPe};
  var body = info+'<p class="hint" style="margin-top:0;">Départ <b>'+esc(d.tag||'')+'</b> — '+esc(d.nom||'')+' · tableau '+esc(r.section.titre)+(r.instCle ? ' <i>(personnalisation pour cet appartement ; modèle : '+esc(r.modeleTitre)+')</i>' : '')+'</p><div class="ecc-f">'+
    '<h4>Câble</h4>'+
    champ('ecc-fam', 'Famille de câble', '<select id="ecc-fam"><option value="">Chargement…</option></select>')+
    champ('ecc-sec', 'Section de phase', '<select id="ecc-sec"><option value="">—</option></select>')+
    champ('ecc-struct', 'Structure', '<select id="ecc-struct"><option value="multi"'+(dfl.structure==='multi'?' selected':'')+'>Multipolaire (3x120, 5G4…)</option><option value="uni"'+(dfl.structure==='uni'?' selected':'')+'>Unipolaires 3X(1x240)</option></select>')+
    champ('ecc-ncond', '<span id="ecc-ncond-lab">Nombre de conducteurs</span>', '<input type="number" id="ecc-ncond" min="1" step="1" value="'+esc(dfl.nbCond)+'">')+
    '<div class="field" id="ecc-gbox"><label>PE dans le câble (G)</label><label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="checkbox" id="ecc-g" style="width:auto;"'+(dfl.avecPe?' checked':'')+'> Oui (ex. 5G4)</label></div>'+
    champ('ecc-nbc', 'Câbles par phase', '<input type="number" id="ecc-nbc" min="1" step="1" value="'+esc(c.nbCables||'')+'">')+
    '<div class="field ecc-uni"><label>Neutre : nombre × section (mm²)</label><div style="display:flex;gap:6px;"><input type="number" id="ecc-nnb" min="0" step="1" style="width:70px;" value="'+esc(c.neutreNb !== undefined && c.neutreNb !== null ? c.neutreNb : '')+'"><input type="number" id="ecc-nsec" min="0" step="any" value="'+esc(c.neutreMm2||'')+'"></div></div>'+
    '<div class="field ecc-uni"><label>PE ou PEN : nombre × section (mm²)</label><div style="display:flex;gap:6px;"><input type="number" id="ecc-pnb" min="0" step="1" style="width:70px;" value="'+esc(c.peNb !== undefined && c.peNb !== null ? c.peNb : '')+'"><input type="number" id="ecc-psec" min="0" step="any" value="'+esc(c.peMm2||'')+'"></div></div>'+
    '<div class="field" style="grid-column:1/-1;"><label>Représentation du câble</label><div id="ecc-prev"></div></div>'+
    champ('ecc-lg', 'Longueur (m)', '<input type="number" id="ecc-lg" min="0" step="any" value="'+esc(c.longueurM !== undefined && c.longueurM !== null ? c.longueurM : (d.longueur||''))+'">')+
    '<h4>Protection (catalogue)</h4>'+
    champ('ecc-pcons', 'Constructeur', '<select id="ecc-pcons">'+eccOpts(cons.map(function(k){ return {v:k.code, t:k.nom||k.code}; }), c.protConstructeur, cons.length ? '—' : 'Aucun constructeur importé')+'</select>')+
    champ('ecc-pcat', 'Catégorie', '<select id="ecc-pcat"></select>')+
    champ('ecc-pgam', 'Gamme', '<select id="ecc-pgam"></select>')+
    champ('ecc-pcal', 'Calibre · courbe · pouvoir de coupure', '<select id="ecc-pcal"></select>')+
    champ('ecc-pdec', 'Déclencheur', '<select id="ecc-pdec"></select>')+
    champ('ecc-pci', 'Prot CI (C / I / S)', '<select id="ecc-pci">'+eccOpts(['C','I','S'], c.protCi || d.ci || '', '—')+'</select>')+
    '<h4>Informations</h4>'+
    champ('ecc-jdb', 'JdB (jeu de barres)', '<input id="ecc-jdb" value="'+esc(c.jdb||'')+'">')+
    champ('ecc-lieu', 'Lieu', '<input id="ecc-lieu" value="'+esc(c.lieu||'')+'">')+
    '<div class="field" style="grid-column:1/-1;"><label for="ecc-des">Désignation</label><input id="ecc-des" value="'+esc(c.designation || d.nom || '')+'"></div></div>';
  var ov = openModal({title: 'Circuit ' + (d.tag||''), large: true, body: body,
    foot: (r.circuit && (!r.instCle || r.circuit.instanceCle) ? '<button type="button" class="btn btn-danger" id="ecc-del" style="margin-right:auto;">'+(r.instCle ? 'Revenir au modèle' : 'Effacer la saisie')+'</button>' : '')+'<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="ecc-ok">Enregistrer</button>'});
  var $ = function(id){ return ov.querySelector('#'+id); };

  /* cable */
  var cabCourant = c.cableIdCaneco || null;
  function remplirSections(){
    var fam = $('ecc-fam').value;
    if(!fam){ $('ecc-sec').innerHTML = '<option value="">—</option>'; return; }
    $('ecc-sec').innerHTML = '<option value="">Chargement…</option>';
    eccCables(fam, function(liste){
      if($('ecc-fam').value !== fam) return;
      $('ecc-sec').innerHTML = '<option value="">— Section —</option>' + liste.map(function(x){
        return '<option value="' + esc(x.idCaneco) + '" data-st="' + esc(x.sectionTxt || x.sectionMm2) + '"' + (String(x.idCaneco) === String(cabCourant) ? ' selected' : '') + '>' + esc((x.sectionTxt || x.sectionMm2) + ' mm²' + (x.nbConducteurs ? ' · ' + x.nbConducteurs + ' cond.' : '') + (x.ref ? ' · ' + x.ref : '')) + '</option>'; }).join('');
      majRepr();
    });
  }
  function eccLireRepr(){
    var o = $('ecc-sec').selectedOptions && $('ecc-sec').selectedOptions[0], st = o ? o.getAttribute('data-st') : '';
    var uni = $('ecc-struct').value === 'uni', nn = Number($('ecc-nnb').value) || 0, pn = Number($('ecc-pnb').value) || 0;
    return {cableStructure: $('ecc-struct').value, cableSectionTxt: st || null, nbCables: Number($('ecc-nbc').value) || 1, cableNbCond: Number($('ecc-ncond').value) || null, cableAvecPe: !uni && $('ecc-g').checked,
      neutreNb: uni ? nn : null, neutreMm2: uni && nn ? (Number($('ecc-nsec').value) || null) : null, peNb: uni ? pn : null, peMm2: uni && pn ? (Number($('ecc-psec').value) || null) : null};
  }
  function majRepr(){
    var uni = $('ecc-struct').value === 'uni';
    ov.querySelectorAll('.ecc-uni').forEach(function(e){ e.style.display = uni ? '' : 'none'; });
    $('ecc-gbox').style.display = uni ? 'none' : '';
    $('ecc-ncond-lab').textContent = uni ? 'Nombre de phases (câbles unipolaires)' : 'Nombre de conducteurs';
    $('ecc-prev').innerHTML = eccReprHtml(eccReprCable(eccLireRepr()));
  }
  ['ecc-struct', 'ecc-ncond', 'ecc-g', 'ecc-nbc', 'ecc-sec', 'ecc-nnb', 'ecc-nsec', 'ecc-pnb', 'ecc-psec'].forEach(function(id){ $(id).addEventListener('input', majRepr); $(id).addEventListener('change', majRepr); });
  function initFamilles(){
    var l = (ECB_DATA.familles||[]).map(function(f){ return f.famille; });
    $('ecc-fam').innerHTML = eccOpts(l, c.cableFamille, l.length ? '— Famille —' : 'Aucun câble importé');
    remplirSections();
  }
  if(ECB_DATA.familles) initFamilles(); else ecbCharger(function(){ if(byId('ecc-fam')) initFamilles(); });
  majRepr();
  $('ecc-fam').addEventListener('change', function(){ cabCourant = null; remplirSections(); });

  /* protection : constructeur > categorie > gamme > calibre > declencheur */
  function disjDe(cons, cat, gam){ return (STATE.etudeMatDisj||[]).filter(function(x){ return x.constructeur === cons && (!cat || x.categorie === cat) && (!gam || x.gamme === gam); }); }
  function cats(){
    var k = $('ecc-pcons').value;
    $('ecc-pcat').innerHTML = eccOpts(k ? eprCategories(k).map(function(x){ return x.nom; }) : [], $('ecc-pcat').getAttribute('data-sel') || '', '— Catégorie —');
    $('ecc-pcat').setAttribute('data-sel', '');
    gammes();
  }
  function gammes(){
    var k = $('ecc-pcons').value, cat = $('ecc-pcat').value, l = [];
    if(k && cat) disjDe(k, cat).forEach(function(x){ if(l.indexOf(x.gamme) < 0) l.push(x.gamme); });
    $('ecc-pgam').innerHTML = eccOpts(l.sort(function(a,b){ return a.localeCompare(b, 'fr', {numeric:true}); }), $('ecc-pgam').getAttribute('data-sel') || '', '— Gamme —');
    $('ecc-pgam').setAttribute('data-sel', '');
    calibres();
  }
  function calibres(){
    var k = $('ecc-pcons').value, cat = $('ecc-pcat').value, g = $('ecc-pgam').value, l = [];
    if(k && cat && g){
      disjDe(k, cat, g).sort(function(a,b){ return (a.calibreA||0)-(b.calibreA||0) || String(a.courbe).localeCompare(b.courbe) || (b.icuKa||0)-(a.icuKa||0); })
        .forEach(function(x){ l.push({v: x.id, t: x.calibre+' A · '+(x.courbe && x.courbe !== '—' ? 'courbe '+x.courbe+' · ' : '')+(x.variante && x.variante !== '—' ? x.variante+' · ' : '')+(x.icuKa !== null && x.icuKa !== undefined ? 'Icu '+x.icuKa+' kA' : '')}); });
    }
    $('ecc-pcal').innerHTML = eccOpts(l, $('ecc-pcal').getAttribute('data-sel') || '', '— Calibre —');
    $('ecc-pcal').setAttribute('data-sel', '');
    declencheurs();
  }
  function declencheurs(){
    var k = $('ecc-pcons').value, g = $('ecc-pgam').value, id = $('ecc-pcal').value, ca = null, l = [];
    var dj = (STATE.etudeMatDisj||[]).filter(function(x){ return x.id === id; })[0];
    if(dj) ca = dj.calibreA;
    (STATE.etudeMatAssoc||[]).forEach(function(a){
      if(a.constructeur !== k || a.gamme !== g) return;
      if(ca !== null && ca !== undefined && ((a.calibreMin !== null && a.calibreMin !== undefined && ca < a.calibreMin) || (a.calibreMax !== null && a.calibreMax !== undefined && ca > a.calibreMax))) return;
      if(l.indexOf(a.declencheur) < 0) l.push(a.declencheur);
    });
    $('ecc-pdec').innerHTML = eccOpts(l, $('ecc-pdec').getAttribute('data-sel') || '', l.length ? '— Déclencheur —' : '— (aucun associé) —');
    $('ecc-pdec').setAttribute('data-sel', '');
  }
  /* pre-remplissage depuis la saisie existante */
  var exist = null;
  if(c.protConstructeur){
    exist = (STATE.etudeMatDisj||[]).filter(function(x){ return x.constructeur === c.protConstructeur && x.gamme === c.protGamme && String(x.calibre) === String(c.protCalibre) &&
      String(x.courbe) === String(c.protCourbe) && String(x.variante) === String(c.protVariante); })[0] || null;
  }
  $('ecc-pcat').setAttribute('data-sel', exist ? exist.categorie : (c.protCategorie || ''));
  cats();
  if(exist){ $('ecc-pgam').value = exist.gamme; calibres(); $('ecc-pcal').value = exist.id; $('ecc-pdec').setAttribute('data-sel', c.protDeclencheur || ''); declencheurs(); }
  $('ecc-pcons').addEventListener('change', cats);
  $('ecc-pcat').addEventListener('change', gammes);
  $('ecc-pgam').addEventListener('change', calibres);
  $('ecc-pcal').addEventListener('change', declencheurs);

  if(r.circuit && (!r.instCle || r.circuit.instanceCle)) $('ecc-del').addEventListener('click', function(){
    closeModal();
    deleteDoc('etudeBtCircuits', r.circuit.id).then(function(){ toast('Saisie effacée', 'success'); scheduleRender(); }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  });
  $('ecc-ok').addEventListener('click', function(){
    var fam = $('ecc-fam').value, idc = $('ecc-sec').value, cab = null;
    if(fam && idc) cab = (ECC_CAB[fam]||[]).filter(function(x){ return String(x.idCaneco) === String(idc); })[0] || null;
    var dj = (STATE.etudeMatDisj||[]).filter(function(x){ return x.id === $('ecc-pcal').value; })[0] || null;
    var num = function(id){ var v = $(id).value; return v === '' ? null : Number(v); };
    var lr = eccLireRepr();
    var patch = {
      cableFamille: fam || null, cableIdCaneco: cab ? cab.idCaneco : null, cableSectionTxt: cab ? (cab.sectionTxt || String(cab.sectionMm2)) : null,
      nbCables: num('ecc-nbc'), longueurM: num('ecc-lg'),
      cableStructure: fam ? $('ecc-struct').value : null, cableNbCond: fam ? num('ecc-ncond') : null, cableAvecPe: fam && $('ecc-struct').value === 'multi' ? $('ecc-g').checked : false,
      neutreNb: lr.neutreNb, neutreMm2: lr.neutreMm2, peNb: lr.peNb, peMm2: lr.peMm2,
      protConstructeur: dj ? dj.constructeur : ($('ecc-pcons').value || null), protCategorie: dj ? dj.categorie : null, protGamme: dj ? dj.gamme : null,
      protVariante: dj ? dj.variante : null, protCalibre: dj ? String(dj.calibre) : null, protCourbe: dj ? dj.courbe : null, protDeclencheur: $('ecc-pdec').value || null,
      protCi: $('ecc-pci').value || null, jdb: $('ecc-jdb').value.trim() || null, lieu: $('ecc-lieu').value.trim() || null, designation: $('ecc-des').value.trim() || null,
      updatedAt: nowISO()};
    closeModal();
    var p;
    var ex = r.circuit && (!r.instCle || r.circuit.instanceCle) ? r.circuit : null;
    if(ex) p = STATE.db.doc('etudeBtCircuits/'+ex.id).update(patch);
    else p = STATE.db.collection('etudeBtCircuits').add(Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null,
      consoId: d.id, tag: d.tag || null, tableauCle: eelCle(d.switchgear), instanceCle: r.instCle || null, createdAt: nowISO(), creePar: currentUserName()}, patch));
    p.then(function(){ toast('Circuit enregistré', 'success'); scheduleRender(); }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  });
}
