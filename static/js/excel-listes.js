'use strict';

/* =========================================================
   EXPORT / IMPORT EXCEL AVEC LISTES DEROULANTES - Livrables et Bordereaux
   d'envoi (V2.16). Charge APRES app.js (utilise ses fonctions et son STATE).

   Principe :
   - Export : le navigateur decrit le classeur (colonnes, lignes, listes de
     choix) et POST /api/xlsx-tools/build le fabrique (openpyxl). Chaque
     colonne "a liste" porte un menu deroulant Excel qui REFUSE toute valeur
     hors liste (feuille "Listes") : Zone 00 / 02 / 03 / 05, Statut, Type,
     Categorie, Indice, Destinataire, Etat de transmission, etc.
   - Import : POST /api/xlsx-tools/read decode le fichier (lecture seule).
     Le navigateur valide chaque ligne contre les memes listes, la compare
     a l'existant et affiche un ECRAN DE RELECTURE colore AVANT toute
     ecriture :
        vert   = ajoute      orange = modifie (ancienne valeur barree)
        rouge  = refuse (jamais importe, motif indique)
        gris   = inchange
     L'utilisateur peut decocher des lignes puis valider ; les ecritures
     passent par les routes generiques /api/doc/... (protegees par role).
   - Un compte rendu colore peut etre telecharge en Excel.
   ========================================================= */

var XL_COLORS = {add:'C8E6C9', mod:'FFE0B2', err:'FFCDD2', same:'F1F3F5'};
var XL_STATUS_LABEL = {add:'Ajouté', mod:'Modifié', err:'Refusé', same:'Inchangé'};
var XL_STATUS_TONE = {add:'success', mod:'warning', err:'danger', same:'neutral'};

/* ---------- utilitaires ---------- */
function xlKey(s){
  return String(s===null||s===undefined?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[’‘`]/g,"'").replace(/\*/g,'').replace(/\s+/g,' ').trim();
}
function xlStripZeros(s){ return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/,'') : s; }
// options : [{id, label}] ; retrouve par libelle OU par identifiant (sans
// tenir compte de la casse/des accents) ; "2" retrouve "02" (Excel peut
// avoir converti un code numerique en nombre).
function xlFindOption(options, raw){
  var k = xlKey(raw);
  if(!k) return null;
  var i, o;
  for(i=0;i<options.length;i++){ o = options[i]; if(xlKey(o.label)===k || xlKey(o.id)===k) return o; }
  if(/^\d+$/.test(k)){
    var z = xlStripZeros(k);
    for(i=0;i<options.length;i++){ o = options[i]; if(/^\d+$/.test(xlKey(o.label)) && xlStripZeros(xlKey(o.label))===z) return o; }
  }
  return null;
}
function xlIsoDate(raw){
  raw = String(raw||'').trim();
  if(!raw) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw), y, mo, d;
  if(m){ y=+m[1]; mo=+m[2]; d=+m[3]; }
  else {
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(raw);
    if(!m) return null;
    d=+m[1]; mo=+m[2]; y=+m[3];
  }
  var dt = new Date(Date.UTC(y, mo-1, d));
  if(dt.getUTCFullYear()!==y || dt.getUTCMonth()!==mo-1 || dt.getUTCDate()!==d) return null;
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function xlNumber(raw){
  raw = String(raw||'').trim().replace(/\s/g,'').replace(',', '.');
  if(!raw) return '';
  var n = Number(raw);
  if(isNaN(n) || n<0) return null;
  return n;
}
function xlSame(a, b){ return String(a===null||a===undefined?'':a).trim() === String(b===null||b===undefined?'':b).trim(); }
function xlShow(v){ return (v===null||v===undefined||v==='') ? '(vide)' : String(v); }
function xlWithExtras(base, extras){
  var out = base.slice();
  extras.forEach(function(v){ if(v!==undefined && v!==null && v!=='' && out.indexOf(v)<0) out.push(v); });
  return out;
}
function xlAlphabet(){ return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); }
function xlPlain(list){ return list.map(function(v){ return {id:v, label:v}; }); }

function xlDownloadBuild(spec){
  return fetch('/api/xlsx-tools/build', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec)})
    .then(function(r){
      if(!r.ok) return r.text().then(function(t){ var j=null; try{ j=JSON.parse(t); }catch(e){} throw new Error((j&&j.error)||('Erreur HTTP '+r.status)); });
      return r.blob();
    }).then(function(blob){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = spec.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    });
}
function xlReadFile(file){
  var fd = new FormData(); fd.append('file', file);
  return fetch('/api/xlsx-tools/read', {method:'POST', body: fd}).then(function(r){
    return r.text().then(function(t){
      var j=null; try{ j = t? JSON.parse(t) : null; }catch(e){}
      if(!r.ok) throw new Error((j&&j.error)||('Erreur HTTP '+r.status));
      return j;
    });
  });
}
function xlCtrOptions(selectedId){
  return projetsOptionsHtml(selectedId, null, '', true);
}
function xlDateStamp(){ return todayISO().replace(/-/g,''); }

/* =========================================================
   MODELES DE COLONNES
   Chaque champ : {k, header, kind:'text'|'list'|'date'|'num', list (nom de la
   liste Excel), options ([{id,label}]), info (colonne indicative non
   importee), hidden, aliases (autres intitules acceptes a l'import)}
   ========================================================= */
function xlLivrablesModel(ctr){
  var livs = STATE.livrables.filter(function(l){ return projetIdDe(l)===ctr.id; });
  var segs = segmentsPersonnalisesDuContrat(ctr);
  var lists = {};      // nom -> [libelles] (feuille Listes)
  var fields = [];
  function addList(name, options){
    var n = name, i = 2;
    while(lists[n]){ n = name+' ('+i+')'; i++; }
    lists[n] = options.map(function(o){ return o.label; });
    return n;
  }
  fields.push({k:'id', header:'ID (ne pas modifier)', kind:'text', info:true, hidden:true, aliases:['id']});
  fields.push({k:'code', header:'Code (indicatif, non modifiable)', kind:'text', info:true});
  fields.push({k:'designation', header:'Désignation *', kind:'text', required:true, aliases:['designation']});
  // V2.17 : feuille « Listes » organisee comme la codification du contrat -
  // une colonne par segment (en-tete = nom du segment, valeurs en dessous),
  // les segments en premier, puis les autres listes.
  var segFields = segs.map(function(s){
    var opt = xlPlain(xlWithExtras(s.valeurs, livs.map(function(l){ return livrableSegmentValeur(l, s.id); })));
    return {k:'seg:'+s.id, segId:s.id, header:s.nom, kind:'list', options:opt, list:addList(s.nom, opt)};
  });
  var optType = xlPlain(xlWithExtras(LIVRABLE_TYPES, livs.map(function(l){ return l.typeDocument; })));
  var optCat = xlPlain(xlWithExtras(LIVRABLE_CATEGORIES, livs.map(function(l){ return l.categorie; })));
  var typeField = {k:'typeDocument', header:'Type de document', kind:'list', options:optType, list:addList('Type de document', optType)};
  var catField = {k:'categorie', header:'Catégorie', kind:'list', options:optCat, list:addList('Catégorie', optCat)};
  fields.push(typeField);
  fields.push(catField);
  segFields.forEach(function(f){ fields.push(f); });
  var optInd = xlPlain(xlWithExtras(xlAlphabet(), livs.map(function(l){ return l.indiceRevision; })));
  fields.push({k:'indiceRevision', header:'Indice de révision', kind:'list', options:optInd, list:addList('Indice', optInd)});
  var optSt = LIVRABLE_STATUTS.map(function(s){ return {id:s.id, label:s.label}; });
  fields.push({k:'statut', header:'Statut', kind:'list', options:optSt, list:addList('Statut', optSt)});
  fields.push({k:'dateEmission', header:'Date d’émission', kind:'date'});
  fields.push({k:'referenceClient', header:'Référence / code client', kind:'text'});
  fields.push({k:'destinataire', header:'Destinataire', kind:'text'});
  fields.push({k:'budget', header:'Budget horaire (h) - révision courante', kind:'num', aliases:['budget horaire (h)','budget horaire']});
  fields.push({k:'datePlanifieeDebut', header:'Début planifié', kind:'date'});
  fields.push({k:'datePlanifieeFin', header:'Fin planifiée', kind:'date'});
  fields.push({k:'notes', header:'Notes', kind:'text'});
  return {ctr:ctr, livs:livs, segs:segs, fields:fields, lists:lists};
}
// Valeur actuelle d'un champ pour un livrable (TEXTE comparable)
function xlLivrableValue(f, l, ctr){
  if(f.k==='id') return l.id;
  if(f.k==='code') return livrableCodeDuLivrable(l, ctr);
  if(f.segId) return livrableSegmentValeur(l, f.segId) || '';
  if(f.k==='statut'){ var o = xlFindOption(f.options, l.statut||'NEE'); return o ? o.label : (l.statut||''); }
  if(f.k==='budget'){ var b = budgetRevisionCourante(l); return b===null ? '' : b; }
  return l[f.k]===undefined || l[f.k]===null ? '' : l[f.k];
}

function xlLivrableLabel(l, ctr, dupCounts){
  var code = livrableCodeDuLivrable(l, ctr);
  return (dupCounts[code]>1 || !code) ? (code+' — '+(l.designation||'')) : code;
}
function xlBordereauxModel(ctr){
  var livs = STATE.livrables.filter(function(l){ return projetIdDe(l)===ctr.id; })
    .sort(function(a,b){ return (a.numeroSeq||0)-(b.numeroSeq||0) || (a.designation||'').localeCompare(b.designation||''); });
  var dup = {};
  livs.forEach(function(l){ var c = livrableCodeDuLivrable(l, ctr); dup[c] = (dup[c]||0)+1; });
  var livByLabel = livs.map(function(l){ return {id:l.id, label:xlLivrableLabel(l, ctr, dup), liv:l}; });
  var dests = (ctr.destinataires||[]).map(function(d){ return {id:d.id, label:d.nom, dest:d}; });
  var indices = [];
  livs.forEach(function(l){
    ((l.historiqueIndices||[]).map(function(h){ return h.indice; }).concat([l.indiceRevision])).forEach(function(i){ if(i && indices.indexOf(i)<0) indices.push(i); });
  });
  var optInd = xlPlain(xlWithExtras(xlAlphabet(), indices));
  var optEtat = BORDEREAU_ETATS.map(function(s){ return {id:s.id, label:s.label}; });
  var optRet = STATUT_RETOUR_REFERENTIEL.map(function(s){ return {id:s.id, label:s.label}; });
  var lists = {};
  lists['Destinataire'] = dests.map(function(d){ return d.label; });
  lists['Livrable'] = livByLabel.map(function(o){ return o.label; });
  lists['Indice'] = optInd.map(function(o){ return o.label; });
  lists['État de transmission'] = optEtat.map(function(o){ return o.label; });
  lists['Statut de retour'] = optRet.map(function(o){ return o.label; });
  var fields = [
    {k:'id', header:'ID bordereau (ne pas modifier)', kind:'text', info:true, hidden:true, aliases:['id bordereau','id']},
    {k:'numero', header:'N° bordereau (vide = nouveau)', kind:'text', aliases:['n° bordereau','no bordereau','numero bordereau','numero','n°']},
    {k:'destinataire', header:'Destinataire', kind:'list', options:dests, list:'Destinataire'},
    {k:'destCategorie', header:'Catégorie du destinataire (indicatif)', kind:'text', info:true, aliases:['categorie du destinataire']},
    {k:'date', header:'Date d’envoi', kind:'date', aliases:['date d\'envoi','date envoi']},
    {k:'livrable', header:'Code du livrable *', kind:'list', options:livByLabel, list:'Livrable', required:true, aliases:['code du livrable','code livrable','livrable','code']},
    {k:'livDesignation', header:'Désignation (indicatif)', kind:'text', info:true, aliases:['designation']},
    {k:'indice', header:'Indice', kind:'list', options:optInd, list:'Indice'},
    {k:'etat', header:'État de transmission', kind:'list', options:optEtat, list:'État de transmission', aliases:['etat','etat de transmission']},
    {k:'dateRetour', header:'Date de retour', kind:'date'},
    {k:'statutRetour', header:'Statut de retour', kind:'list', options:optRet, list:'Statut de retour'}
  ];
  return {ctr:ctr, livs:livs, livByLabel:livByLabel, dests:dests, fields:fields, lists:lists, optInd:optInd, optEtat:optEtat, optRet:optRet};
}

// Associe chaque champ du modele a l'index de sa colonne dans le fichier lu
function xlMapColumns(fields, headers){
  var keys = headers.map(xlKey);
  var map = {};
  fields.forEach(function(f){
    var cands = [xlKey(f.header)].concat((f.aliases||[]).map(xlKey));
    var idx = -1;
    for(var i=0;i<cands.length && idx<0;i++){ idx = keys.indexOf(cands[i]); }
    map[f.k] = idx;
  });
  return map;
}
function xlSheetOf(parsed, nameKey){
  var names = parsed.order || [];
  var i;
  for(i=0;i<names.length;i++){ if(xlKey(names[i])===nameKey) return parsed.sheets[names[i]]; }
  for(i=0;i<names.length;i++){
    var k = xlKey(names[i]);
    var sh = parsed.sheets[names[i]];
    if(k==='listes' || k==='meta' || k.indexOf('mode d')===0 || !sh.headers.length) continue;
    return sh;
  }
  return null;
}

/* =========================================================
   EXPORT
   ========================================================= */
function xlGuideLines(kind, ctr){
  var common = [
    'Contrat : '+ctr.numero+' — '+(ctr.clientNom||''),
    '',
    'COULEURS DES EN-TÊTES',
    '  • Bleu foncé : cellule libre (texte, date, nombre).',
    '  • Vert : liste déroulante — cliquez sur la flèche de la cellule et choisissez une valeur. Toute autre valeur est refusée par Excel.',
    '  • Gris : colonne indicative (non importée) — ne pas modifier.',
    '',
    'Les valeurs autorisées de chaque liste se trouvent dans la feuille « Listes ».',
    ''
  ];
  if(kind==='livrables') return common.concat([
    'LIVRABLES',
    '  • Pour MODIFIER un livrable existant : changez la valeur dans sa ligne. Ne touchez pas à la colonne ID (masquée).',
    '  • Pour AJOUTER un livrable : remplissez une nouvelle ligne en laissant l’ID vide (la désignation est obligatoire).',
    '  • Le code du livrable est calculé par l’application (jamais saisi) ; la colonne « Code » n’est qu’indicative.',
    '  • Les personnes affectées ne passent pas par Excel : elles restent inchangées.',
    '  • Un livrable « Annulé » est verrouillé : sa ligne ne peut plus être modifiée.',
    '  • Rien n’est enregistré tant que vous n’avez pas validé l’écran de relecture (vert = ajouté, orange = modifié, rouge = refusé, gris = inchangé).'
  ]);
  return common.concat([
    'BORDEREAUX D’ENVOI — une ligne = un document transmis',
    '  • Pour CRÉER un bordereau : laissez « N° bordereau » vide ; les lignes ayant le même destinataire et la même date d’envoi forment UN nouveau bordereau (numéroté automatiquement).',
    '  • Un bordereau existant est FIGÉ : seules la date de retour et le statut de retour de chaque ligne peuvent être renseignés ou modifiés. Toute autre modification est refusée.',
    '  • Les lignes absentes du fichier ne sont jamais supprimées.',
    '  • Rien n’est enregistré tant que vous n’avez pas validé l’écran de relecture.'
  ]);
}
function xlColSpec(f){
  var c = {header:f.header, info:!!f.info, hidden:!!f.hidden};
  if(f.list) c.list = f.list;
  if(f.kind==='date') c.date = true;
  if(f.kind==='num') c.number = true;
  if(f.info) c.width = f.hidden ? 12 : 30;
  else if(f.kind==='date') c.width = 14;
  return c;
}
function xlDisplayedLivrables(ctrId){
  return STATE.livrables.filter(function(l){
    if(projetIdDe(l)!==ctrId) return false;
    if(livrablesFilter.ctrId===ctrId && livrablesFilter.q){
      var q = livrablesFilter.q.toLowerCase();
      if((l.designation||'').toLowerCase().indexOf(q)<0 && projetNumeroDe(l).toLowerCase().indexOf(q)<0 &&
         (l.clientNom||'').toLowerCase().indexOf(q)<0 && (l.destinataire||'').toLowerCase().indexOf(q)<0 &&
         (l.categorie||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  });
}
function xlDisplayedBordereaux(ctrId){
  return STATE.bordereaux.filter(function(b){
    if(projetIdDe(b)!==ctrId) return false;
    if(bordereauxFilter.ctrId===ctrId || !bordereauxFilter.ctrId){
      if(bordereauxFilter.destNom && b.destNom!==bordereauxFilter.destNom) return false;
      if(bordereauxFilter.q){
        var q = bordereauxFilter.q.toLowerCase();
        if((b.numero||'').toLowerCase().indexOf(q)<0 && projetNumeroDe(b).toLowerCase().indexOf(q)<0 &&
           (b.clientNom||'').toLowerCase().indexOf(q)<0 && (b.destNom||'').toLowerCase().indexOf(q)<0) return false;
      }
    }
    return true;
  });
}

function xlBuildLivrablesSpec(ctr, mode){
  var model = xlLivrablesModel(ctr);
  var src = mode==='vide' ? [] : (mode==='tous' ? model.livs : xlDisplayedLivrables(ctr.id));
  src = src.slice().sort(function(a,b){ return (a.numeroSeq||0)-(b.numeroSeq||0) || (a.designation||'').localeCompare(b.designation||''); });
  var rows = src.map(function(l){
    return model.fields.map(function(f){ return xlLivrableValue(f, l, ctr); });
  });
  return {
    filename: 'Livrables_'+(ctr.numero||'contrat')+'_'+(mode==='vide'?'modele_':'')+xlDateStamp()+'.xlsx',
    sheets: [{name:'Livrables', columns: model.fields.map(xlColSpec), rows: rows}],
    lists: model.lists,
    guide: {name:'Mode d\'emploi', title:'Livrables — mode d\'emploi', lines: xlGuideLines('livrables', ctr)},
    meta: {type:'livrables', ctrId:ctr.id, ctrNumero:ctr.numero, version:(window.APP_VERSION||'')}
  };
}
function xlBuildBordereauxSpec(ctr, mode){
  var model = xlBordereauxModel(ctr);
  var src = mode==='vide' ? [] : (mode==='tous' ? STATE.bordereaux.filter(function(b){ return projetIdDe(b)===ctr.id; }) : xlDisplayedBordereaux(ctr.id));
  src = src.slice().sort(function(a,b){ return (a.numero||'').localeCompare(b.numero||''); });
  var rows = [];
  src.forEach(function(b){
    (b.lignes||[]).forEach(function(ln){
      var lo = model.livByLabel.find(function(o){ return o.id===ln.livId; });
      var st = ln.statutRetour ? xlFindOption(model.optRet, ln.statutRetour) : null;
      var et = xlFindOption(model.optEtat, ln.etat);
      rows.push([b.id, b.numero, b.destNom||'', b.destCategorie||'', b.date||'',
        lo ? lo.label : (ln.livCode||''), ln.livDesignation||'', ln.indice||'',
        et ? et.label : (ln.etat||''), ln.dateRetour||'', st ? st.label : (ln.statutRetour||'')]);
    });
  });
  return {
    filename: 'Bordereaux_'+(ctr.numero||'contrat')+'_'+(mode==='vide'?'modele_':'')+xlDateStamp()+'.xlsx',
    sheets: [{name:'Bordereaux', columns: model.fields.map(xlColSpec), rows: rows}],
    lists: model.lists,
    guide: {name:'Mode d\'emploi', title:'Bordereaux d\'envoi — mode d\'emploi', lines: xlGuideLines('bordereaux', ctr)},
    meta: {type:'bordereaux', ctrId:ctr.id, ctrNumero:ctr.numero, version:(window.APP_VERSION||'')}
  };
}

function xlOpenExportModal(kind){
  var isLiv = kind==='livrables';
  var ctrs = projetsTries();
  if(!ctrs.length){ toast('Aucun contrat ni devis enregistré.', 'danger'); return; }
  var defCtr = isLiv ? livrablesFilter.ctrId : bordereauxFilter.ctrId;
  if(!defCtr || !ctrs.some(function(c){ return c.id===defCtr; })) defCtr = ctrs[0].id;
  var noun = isLiv ? 'livrable(s)' : 'bordereau(x)';
  var overlay = openModal({
    title: 'Exporter les '+(isLiv?'livrables':'bordereaux d’envoi')+' vers Excel',
    body:
      '<p class="hint" style="margin-bottom:12px;">Le classeur généré contient des <b>listes déroulantes</b> (cellules vertes) : l’utilisateur ne peut choisir que des valeurs autorisées. Il peut ensuite être corrigé, complété puis réimporté avec « Importer un Excel ».</p>'+
      '<div class="field"><label for="xle-ctr">Contrat</label><select id="xle-ctr">'+xlCtrOptions(defCtr)+'</select></div>'+
      '<div class="field"><label>Contenu</label>'+
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="xle-mode" value="affiches" checked style="width:auto;"> <span id="xle-n-aff">Éléments affichés</span></label>'+
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="xle-mode" value="tous" style="width:auto;"> <span id="xle-n-tous">Tous les éléments du contrat</span></label>'+
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="xle-mode" value="vide" style="width:auto;"> <span>Modèle vide (en-têtes + listes déroulantes, pour saisir de nouvelles lignes)</span></label>'+
      '</div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="xle-go">'+ic('download',15)+' Générer le fichier</button>'
  });
  function counts(){
    var id = byId('xle-ctr').value;
    var nAff = isLiv ? xlDisplayedLivrables(id).length : xlDisplayedBordereaux(id).length;
    var nTous = isLiv ? STATE.livrables.filter(function(l){ return projetIdDe(l)===id; }).length : STATE.bordereaux.filter(function(b){ return projetIdDe(b)===id; }).length;
    byId('xle-n-aff').textContent = 'Éléments affichés avec le filtre actuel ('+nAff+' '+noun+')';
    byId('xle-n-tous').textContent = 'Tous les éléments du contrat ('+nTous+' '+noun+')';
  }
  counts();
  byId('xle-ctr').addEventListener('change', counts);
  byId('xle-go').addEventListener('click', function(){
    var ctr = projetParId(byId('xle-ctr').value);
    var mode = overlay.querySelector('input[name="xle-mode"]:checked').value;
    if(!ctr) return;
    var spec = isLiv ? xlBuildLivrablesSpec(ctr, mode) : xlBuildBordereauxSpec(ctr, mode);
    toast('Génération du fichier Excel…');
    xlDownloadBuild(spec).then(function(){ closeModal(); toast('Fichier Excel généré', 'success'); })
      .catch(function(err){ console.error(err); toast('Erreur d’export : '+err.message, 'danger'); });
  });
}

/* =========================================================
   IMPORT - etape 1 : choix du fichier et du contrat
   ========================================================= */
function xlOpenImportModal(kind){
  var isLiv = kind==='livrables';
  if(!canWrite('livrables')){ toast('Vous n’avez pas le droit de modifier les livrables.', 'danger'); return; }
  if(!projetsTries().length){ toast('Aucun contrat ni devis enregistré.', 'danger'); return; }
  var defCtr = isLiv ? livrablesFilter.ctrId : bordereauxFilter.ctrId;
  if(!defCtr) defCtr = projetsTries()[0].id;
  openModal({
    title: 'Importer '+(isLiv?'des livrables':'des bordereaux')+' depuis un fichier Excel',
    large: true,
    body:
      '<p class="hint" style="margin-bottom:12px;">Sélectionnez un fichier obtenu avec « Exporter Excel » (corrigé ou complété). Le fichier est d’abord <b>analysé</b> : rien n’est enregistré avant que vous ayez relu l’écran des changements (vert = ajouté, orange = modifié, rouge = refusé, gris = inchangé).</p>'+
      '<input type="file" id="xli-file" accept=".xlsx">'+
      '<div id="xli-zone" style="margin-top:14px;"></div>',
    foot: false
  });
  var parsed = null;
  byId('xli-file').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    var zone = byId('xli-zone');
    zone.innerHTML = '<p class="hint">Lecture du fichier…</p>';
    xlReadFile(file).then(function(p){
      parsed = p;
      var sh = xlSheetOf(p, isLiv ? 'livrables' : 'bordereaux');
      if(!sh){ zone.innerHTML = ''; toast('Aucune feuille de données trouvée dans ce fichier.', 'danger'); return; }
      var ctrId = defCtr;
      if(p.meta && p.meta.ctrId && projetParId(p.meta.ctrId)) ctrId = p.meta.ctrId;
      var typeMismatch = p.meta && p.meta.type && p.meta.type!==kind;
      zone.innerHTML =
        (typeMismatch ? '<p class="hint" style="color:var(--danger);">Attention : ce fichier semble être un export de « '+esc(p.meta.type)+' », pas de « '+esc(kind)+' ».</p>' : '')+
        '<p class="hint"><b>'+sh.rows.length+'</b> ligne(s) de données lue(s) dans la feuille.</p>'+
        '<div class="field"><label for="xli-ctr">Contrat concerné</label><select id="xli-ctr">'+xlCtrOptions(ctrId)+'</select>'+
          '<p class="hint">Les livrables/bordereaux d’un autre contrat sont refusés.</p></div>'+
        '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">'+
          '<button type="button" class="btn" data-close-modal>Annuler</button>'+
          '<button type="button" class="btn btn-primary" id="xli-analyse">Analyser le fichier</button></div>';
      zone.querySelectorAll('[data-close-modal]').forEach(function(b){ b.addEventListener('click', closeModal); });
      byId('xli-analyse').addEventListener('click', function(){
        var ctr = projetParId(byId('xli-ctr').value);
        try {
          var res = isLiv ? xlAnalyseLivrables(sh, ctr) : xlAnalyseBordereaux(sh, ctr);
          xlOpenReview(res);
        } catch(err){ console.error(err); toast(err.message || 'Analyse impossible', 'danger'); }
      });
    }).catch(function(err){ console.error(err); zone.innerHTML=''; toast('Erreur de lecture du fichier : '+err.message, 'danger'); });
  });
}

/* =========================================================
   IMPORT - etape 2 : analyse (aucune ecriture)
   ========================================================= */
function xlNewItem(rowNum, raw){
  return {row:rowNum, raw:raw, status:'same', title:'', sub:'', changes:[], infos:[], warnings:[], errors:[], marks:{}, selected:false, payload:null};
}
function xlErr(item, colIdx, msg){
  item.errors.push(msg);
  item.status = 'err';
  if(colIdx>=0) item.marks[colIdx] = {kind:'err', msg:msg};
}
function xlFieldName(f){ return f.header.replace(/\s*\(.*?\)\s*/g,' ').replace(/\s*\*$/,'').trim(); }

// Lit et valide les cellules d'une ligne selon les champs du modele.
// Retourne {k: valeur} pour les seules colonnes PRESENTES dans le fichier.
function xlParseRow(it, raw, model, map){
  var vals = {};
  model.fields.forEach(function(f){
    if(f.info || map[f.k]<0) return;
    var c = String(raw[map[f.k]]||'').trim();
    var idx = map[f.k];
    if(f.kind==='list'){
      if(c===''){ vals[f.k] = ''; return; }
      var o = xlFindOption(f.options, c);
      if(!o){ xlErr(it, idx, xlFieldName(f)+' : « '+c+' » n’est pas dans la liste autorisée'); return; }
      vals[f.k] = o.id;
    } else if(f.kind==='date'){
      var d = xlIsoDate(c);
      if(d===null){ xlErr(it, idx, xlFieldName(f)+' : « '+c+' » n’est pas une date valide (JJ/MM/AAAA)'); return; }
      vals[f.k] = d;
    } else if(f.kind==='num'){
      var n = xlNumber(c);
      if(n===null){ xlErr(it, idx, xlFieldName(f)+' : « '+c+' » n’est pas un nombre positif'); return; }
      vals[f.k] = n;
    } else {
      vals[f.k] = c;
    }
  });
  return vals;
}

function xlLivrableData(ctr, cur, vals){
  var segs = segmentsPersonnalisesDuContrat(ctr);
  var sv = {};
  segs.forEach(function(s){
    var v = cur ? livrableSegmentValeur(cur, s.id) : '';
    sv[s.id] = (v===undefined || v===null) ? '' : v;
    if(vals['seg:'+s.id]!==undefined) sv[s.id] = vals['seg:'+s.id];
  });
  function pick(k, curVal, def){ return vals[k]!==undefined ? vals[k] : (cur ? (curVal===undefined||curVal===null ? def : curVal) : def); }
  var budget = vals.budget!==undefined ? (vals.budget==='' ? null : vals.budget) : (cur ? budgetRevisionCourante(cur) : null);
  var debut = pick('datePlanifieeDebut', cur&&cur.datePlanifieeDebut, '');
  var fin = pick('datePlanifieeFin', cur&&cur.datePlanifieeFin, '');
  return {
    ctrId: champsProjet(ctr).ctrId, ctrNumero: champsProjet(ctr).ctrNumero, devisId: champsProjet(ctr).devisId, devisNumero: champsProjet(ctr).devisNumero, clientId: ctr.clientId, clientNom: ctr.clientNom,
    designation: pick('designation', cur&&cur.designation, ''),
    typeDocument: pick('typeDocument', cur&&cur.typeDocument, ''),
    categorie: pick('categorie', cur&&cur.categorie, ''),
    segmentsValeurs: sv,
    indiceRevision: vals.indiceRevision || (cur ? cur.indiceRevision : '') || 'A',
    statut: vals.statut || (cur ? cur.statut : '') || 'NEE',
    dateEmission: pick('dateEmission', cur&&cur.dateEmission, ''),
    destinataire: pick('destinataire', cur&&cur.destinataire, ''),
    notes: pick('notes', cur&&cur.notes, ''),
    affectations: (cur && Array.isArray(cur.affectations)) ? cur.affectations : [],
    datePlanifieeDebut: debut || null, datePlanifieeFin: fin || null,
    budgetHeuresRevision: (typeof budget==='number') ? budget : null,
    referenceClient: pick('referenceClient', cur&&cur.referenceClient, '')
  };
}

function xlAnalyseLivrables(sheet, ctr){
  var model = xlLivrablesModel(ctr);
  var map = xlMapColumns(model.fields, sheet.headers);
  if(map.designation<0) throw new Error('Colonne « Désignation » introuvable : utilisez un fichier obtenu avec « Exporter Excel ».');
  var byIdMap = {}; model.livs.forEach(function(l){ byIdMap[l.id] = l; });
  var seen = {};
  var desigExist = {}; model.livs.forEach(function(l){ desigExist[xlKey(l.designation)] = true; });
  var desigNew = {};
  var items = sheet.rows.map(function(raw, i){
    var it = xlNewItem(sheet.rowNumbers[i], raw);
    var vals = xlParseRow(it, raw, model, map);
    var idRaw = map.id>=0 ? String(raw[map.id]||'').trim() : '';
    var cur = null;
    if(idRaw){
      cur = byIdMap[idRaw] || null;
      if(!cur){
        var other = STATE.livrables.find(function(l){ return l.id===idRaw; });
        xlErr(it, map.id, other ? 'Ce livrable appartient à un autre contrat ('+(other.ctrNumero||'?')+')' : 'ID inconnu : ce livrable n’existe plus (effacez l’ID pour en créer un nouveau)');
      } else if(seen[idRaw]){
        xlErr(it, map.id, 'ID en double dans le fichier (voir ligne '+seen[idRaw]+') : effacez l’ID pour créer un nouveau livrable');
      } else seen[idRaw] = it.row;
    }
    var designation = vals.designation!==undefined ? vals.designation : (cur ? cur.designation : '');
    it.title = designation || '(sans désignation)';
    if(vals.designation!==undefined && !vals.designation) xlErr(it, map.designation, 'Désignation obligatoire');
    // dates planifiees : les deux ou aucune, fin >= debut
    var debut = vals.datePlanifieeDebut!==undefined ? vals.datePlanifieeDebut : (cur ? (cur.datePlanifieeDebut||'') : '');
    var fin = vals.datePlanifieeFin!==undefined ? vals.datePlanifieeFin : (cur ? (cur.datePlanifieeFin||'') : '');
    if(it.status!=='err'){
      if((debut && !fin) || (!debut && fin)) xlErr(it, map.datePlanifieeFin>=0 ? map.datePlanifieeFin : map.datePlanifieeDebut, 'Renseignez à la fois le début et la fin planifiés (ou laissez les deux vides)');
      else if(debut && fin && fin < debut) xlErr(it, map.datePlanifieeFin, 'La fin planifiée ne peut pas précéder le début');
    }
    it.vals = vals; it.curId = cur ? cur.id : null;
    if(it.status==='err') return it;

    if(!cur){
      // ----- nouveau livrable -----
      it.status = 'add'; it.selected = true; it.sub = 'Nouveau livrable';
      model.fields.forEach(function(f){
        if(f.info || vals[f.k]===undefined || vals[f.k]==='' || f.k==='designation') return;
        var shown = vals[f.k];
        if(f.k==='statut'){ var so = xlFindOption(f.options, shown); shown = so ? so.label : shown; }
        it.infos.push({label:xlFieldName(f), val:String(shown)});
      });
      var dk = xlKey(designation);
      if(desigExist[dk]) it.warnings.push('Un livrable de même désignation existe déjà dans ce contrat');
      else if(desigNew[dk]) it.warnings.push('Même désignation que la ligne '+desigNew[dk]+' de ce fichier');
      if(!desigNew[dk]) desigNew[dk] = it.row;
      return it;
    }
    // ----- livrable existant : comparaison champ par champ -----
    model.fields.forEach(function(f){
      if(f.info || vals[f.k]===undefined) return;
      var nv = vals[f.k];
      if((f.k==='statut' || f.k==='indiceRevision') && nv==='') return;   // vide = inchange
      var cv = xlLivrableValue(f, cur, ctr);
      var curCmp = cv, newCmp = nv;
      if(f.k==='statut'){ var co = xlFindOption(f.options, cv); curCmp = co ? co.id : cv; }
      if(!xlSame(curCmp, newCmp)){
        var oldShow = cv, newShow = nv;
        if(f.k==='statut'){ var no = xlFindOption(f.options, nv); newShow = no ? no.label : nv; }
        it.changes.push({label:xlFieldName(f), old:oldShow, nw:newShow});
        it.marks[map[f.k]] = {kind:'mod', old:xlShow(oldShow)};
      }
    });
    it.sub = livrableCodeDuLivrable(cur, ctr);
    if(!it.changes.length){ it.status = 'same'; return it; }
    if(cur.statut==='annule'){
      xlErr(it, -1, 'Livrable annulé : verrouillé, aucune modification possible');
      Object.keys(it.marks).forEach(function(k){ it.marks[k] = {kind:'err', msg:'Livrable annulé (verrouillé)'}; });
      it.changes = [];
      return it;
    }
    it.status = 'mod'; it.selected = true;
    return it;
  });
  return {
    kind:'livrables', title:'Relecture de l’import — livrables du contrat '+ctr.numero,
    ctr:ctr, headers:sheet.headers, items:items, nounOne:'livrable', nounPlural:'livrables',
    filename:'Compte_rendu_import_livrables_'+(ctr.numero||'')+'_'+xlDateStamp()+'.xlsx',
    apply: function(sel, progress){ return xlApplyLivrables(ctr, sel, progress); }
  };
}

function xlApplyLivrables(ctr, selected, progress){
  var ok = 0, ko = 0, errs = [];
  var chain = Promise.resolve();
  selected.forEach(function(it, i){
    chain = chain.then(function(){
      var cur = it.curId ? STATE.livrables.find(function(l){ return l.id===it.curId; }) : null;
      if(it.curId && !cur) throw new Error('livrable introuvable');
      var data = xlLivrableData(ctr, cur, it.vals);
      return saveLivrable(data, it.curId || null);
    }).then(function(){ ok++; }).catch(function(e){
      console.error(e); ko++; errs.push('Ligne '+it.row+' : '+(e&&e.message||'erreur'));
    }).then(function(){ progress(i+1, selected.length); });
  });
  return chain.then(function(){
    return {ok:ok, ko:ko, errs:errs, message: ok+' ligne(s) enregistrée(s)'+(ko?' — '+ko+' en erreur':'')};
  });
}

/* ---------- bordereaux ---------- */
function xlAnalyseBordereaux(sheet, ctr){
  var model = xlBordereauxModel(ctr);
  var map = xlMapColumns(model.fields, sheet.headers);
  if(map.livrable<0) throw new Error('Colonne « Code du livrable » introuvable : utilisez un fichier obtenu avec « Exporter Excel ».');
  var bors = STATE.bordereaux.filter(function(b){ return projetIdDe(b)===ctr.id; });
  var seenLine = {}, seenNew = {};
  var groups = {};            // cle -> {n, destId, ...}
  var groupCount = 0;
  var today = todayISO();
  var items = sheet.rows.map(function(raw, i){
    var it = xlNewItem(sheet.rowNumbers[i], raw);
    var vals = xlParseRow(it, raw, model, map);
    var idRaw = map.id>=0 ? String(raw[map.id]||'').trim() : '';
    var numRaw = map.numero>=0 ? String(raw[map.numero]||'').trim() : '';
    var lo = null;
    if(vals.livrable){ lo = model.livByLabel.find(function(o){ return o.id===vals.livrable; }); }
    else if(vals.livrable===''){ xlErr(it, map.livrable, 'Code du livrable obligatoire'); }
    var liv = lo ? lo.liv : null;
    it.title = lo ? lo.label : '(livrable ?)';
    it.vals = vals;
    // retour : date + statut (valides aussi pour une creation)
    var b = null;
    if(idRaw || numRaw){
      b = bors.find(function(x){ return (idRaw && x.id===idRaw) || (!idRaw && xlKey(x.numero)===xlKey(numRaw)); });
      if(!b && idRaw && numRaw) b = bors.find(function(x){ return xlKey(x.numero)===xlKey(numRaw); });
      if(!b) xlErr(it, map.numero>=0 ? map.numero : map.id, 'Bordereau « '+(numRaw||idRaw)+' » introuvable dans ce contrat (pour en créer un nouveau, laissez le N° vide)');
    }
    if(it.status==='err') return it;

    if(b){
      // ----- ligne d'un bordereau EXISTANT : seuls les retours peuvent changer -----
      it.sub = 'Bordereau '+b.numero+' · '+(b.destNom||'');
      if(!liv && !lo){ xlErr(it, map.livrable, 'Livrable introuvable'); return it; }
      var lignes = b.lignes||[];
      var wanted = vals.indice;
      var cands = lignes.map(function(l, ix){ return {l:l, ix:ix}; }).filter(function(c){ return c.l.livId===liv.id; });
      var hit = (wanted ? cands.find(function(c){ return xlKey(c.l.indice)===xlKey(wanted); }) : null) || (wanted ? null : cands[0]);
      if(!hit){
        xlErr(it, map.livrable, wanted && cands.length ? 'Ce document figure sur le bordereau avec un autre indice ('+cands.map(function(c){ return c.l.indice; }).join(', ')+') : un bordereau envoyé est figé'
          : 'Ce document ne figure pas sur le bordereau '+b.numero+' : un bordereau envoyé est figé (aucun ajout de ligne)');
        return it;
      }
      var lk = b.id+'|'+hit.ix;
      if(seenLine[lk]){ xlErr(it, map.livrable, 'Ligne en double dans le fichier (voir ligne '+seenLine[lk]+')'); return it; }
      seenLine[lk] = it.row;
      // champs figes : toute difference est refusee
      var destVu = vals.destinataire ? model.dests.find(function(d){ return d.id===vals.destinataire; }) : null;
      if(destVu && xlKey(destVu.label)!==xlKey(b.destNom||''))
        xlErr(it, map.destinataire, 'Destinataire figé : « '+(b.destNom||'')+' » (non modifiable sur un bordereau envoyé)');
      if(vals.date && vals.date!==(b.date||'')) xlErr(it, map.date, 'Date d’envoi figée : '+fmtDate(b.date)+' (non modifiable)');
      if(vals.etat && vals.etat!==hit.l.etat) xlErr(it, map.etat, 'État de transmission figé : « '+statutMeta(BORDEREAU_ETATS, hit.l.etat).label+' » (non modifiable)');
      it.hit = {bId:b.id, ix:hit.ix, livId:liv.id};
      if(it.status==='err') return it;
      var curDate = hit.l.dateRetour||'', curSt = hit.l.statutRetour||'';
      if(vals.dateRetour!==undefined && !xlSame(curDate, vals.dateRetour)){
        it.changes.push({label:'Date de retour', old:curDate, nw:vals.dateRetour, key:'dateRetour'});
        it.marks[map.dateRetour] = {kind:'mod', old:xlShow(curDate)};
      }
      if(vals.statutRetour!==undefined && !xlSame(curSt, vals.statutRetour)){
        var oo = curSt ? xlFindOption(model.optRet, curSt) : null, nn = vals.statutRetour ? xlFindOption(model.optRet, vals.statutRetour) : null;
        it.changes.push({label:'Statut de retour', old: oo?oo.label:curSt, nw: nn?nn.label:vals.statutRetour, key:'statutRetour'});
        it.marks[map.statutRetour] = {kind:'mod', old:xlShow(oo?oo.label:curSt)};
      }
      if(!it.changes.length){ it.status = 'same'; return it; }
      it.status = 'mod'; it.selected = true;
      return it;
    }

    // ----- nouvelle ligne : fera partie d'un NOUVEAU bordereau -----
    if(!liv){ if(vals.livrable) xlErr(it, map.livrable, 'Livrable introuvable dans ce contrat'); return it; }
    if(liv.statut==='annule') xlErr(it, map.livrable, 'Livrable annulé : ne peut pas être transmis');
    var destO = vals.destinataire ? model.dests.find(function(d){ return d.id===vals.destinataire; }) : null;
    if(!vals.destinataire && map.destinataire>=0) xlErr(it, map.destinataire, 'Destinataire obligatoire pour un nouveau bordereau');
    else if(map.destinataire<0) xlErr(it, -1, 'Colonne « Destinataire » absente du fichier');
    var date = vals.date || today;
    var indice = vals.indice || liv.indiceRevision || 'A';
    var indices = (liv.historiqueIndices||[]).map(function(h){ return h.indice; }).concat([liv.indiceRevision]);
    if(indices.indexOf(indice)<0) xlErr(it, map.indice, 'Indice « '+indice+' » inexistant pour ce livrable (indices connus : '+indices.filter(function(v,ix){ return v && indices.indexOf(v)===ix; }).join(', ')+')');
    if(!vals.etat) xlErr(it, map.etat>=0 ? map.etat : -1, 'État de transmission obligatoire');
    if(it.status==='err') return it;
    var gk = destO.id+'|'+date;
    var dk = gk+'|'+liv.id+'|'+indice;
    if(seenNew[dk]){ xlErr(it, map.livrable, 'Doublon dans le même bordereau (voir ligne '+seenNew[dk]+')'); return it; }
    seenNew[dk] = it.row;
    if(!groups[gk]){ groups[gk] = {n:++groupCount, key:gk}; }
    it.group = gk;
    it.status = 'add'; it.selected = true;
    it.sub = 'Nouveau bordereau n°'+groups[gk].n+' → '+destO.label+' · '+fmtDate(date);
    it.line = {livId:liv.id, livCode:livrableCodeDuLivrable(liv, ctr), livDesignation:liv.designation||'', indice:indice, etat:vals.etat};
    if(vals.dateRetour) it.line.dateRetour = vals.dateRetour;
    if(vals.statutRetour) it.line.statutRetour = vals.statutRetour;
    it.dest = destO.dest; it.date = date;
    it.infos.push({label:'Indice', val:indice});
    it.infos.push({label:'État', val:statutMeta(BORDEREAU_ETATS, vals.etat).label});
    if(!vals.date) it.warnings.push('Date d’envoi vide : la date du jour sera utilisée');
    return it;
  });
  var nbBor = Object.keys(groups).length;
  return {
    kind:'bordereaux', title:'Relecture de l’import — bordereaux du contrat '+ctr.numero,
    ctr:ctr, headers:sheet.headers, items:items, nounOne:'ligne', nounPlural:'lignes',
    extraSummary: nbBor ? (nbBor+' nouveau(x) bordereau(x) seront créés (numérotation automatique).') : '',
    filename:'Compte_rendu_import_bordereaux_'+(ctr.numero||'')+'_'+xlDateStamp()+'.xlsx',
    apply: function(sel, progress){ return xlApplyBordereaux(ctr, sel, progress); }
  };
}

function xlApplyBordereaux(ctr, selected, progress){
  var ok = 0, ko = 0, errs = [], done = 0, total = selected.length;
  var chain = Promise.resolve();
  // 1) retours sur bordereaux existants : un seul PATCH par bordereau
  var byBor = {};
  selected.filter(function(it){ return it.status==='mod'; }).forEach(function(it){
    (byBor[it.hit.bId] = byBor[it.hit.bId] || []).push(it);
  });
  Object.keys(byBor).forEach(function(bId){
    chain = chain.then(function(){
      var b = STATE.bordereaux.find(function(x){ return x.id===bId; });
      if(!b) throw new Error('bordereau introuvable');
      var lignes = (b.lignes||[]).map(function(l){ return Object.assign({}, l); });
      byBor[bId].forEach(function(it){
        var ln = lignes[it.hit.ix];
        if(!ln || ln.livId!==it.hit.livId) throw new Error('la ligne a changé depuis l’analyse');
        it.changes.forEach(function(c){ ln[c.key] = it.vals[c.key] || ''; });
      });
      return STATE.db.doc('bordereaux/'+bId).update({lignes:lignes, updatedAt:nowISO()});
    }).then(function(){ ok += byBor[bId].length; }).catch(function(e){
      console.error(e); ko += byBor[bId].length; errs.push('Bordereau '+bId+' : '+(e&&e.message||'erreur'));
    }).then(function(){ done += byBor[bId].length; progress(done, total); });
  });
  // 2) nouveaux bordereaux : un par (destinataire, date)
  var groups = {}, order = [];
  selected.filter(function(it){ return it.status==='add'; }).forEach(function(it){
    if(!groups[it.group]){ groups[it.group] = []; order.push(it.group); }
    groups[it.group].push(it);
  });
  order.forEach(function(gk){
    var its = groups[gk];
    chain = chain.then(function(){
      var first = its[0];
      var data = {
        ctrId: champsProjet(ctr).ctrId, ctrNumero: champsProjet(ctr).ctrNumero, devisId: champsProjet(ctr).devisId, devisNumero: champsProjet(ctr).devisNumero, clientId: ctr.clientId, clientNom: ctr.clientNom,
        destId: first.dest.id, destNom: first.dest.nom, destCategorie: first.dest.categorie,
        date: first.date, lignes: its.map(function(it){ return it.line; }),
        notes: 'Créé par import Excel', createdAt: nowISO(), creePar: currentUserName()
      };
      return nextLocalSeq(projetCollection(ctr), ctr.id, 'bordereauSeq').then(function(seq){
        data.numero = ctr.numero+'-BOR'+pad2(seq);
        return STATE.db.collection('bordereaux').add(data);
      });
    }).then(function(){ ok += its.length; }).catch(function(e){
      console.error(e); ko += its.length; errs.push('Nouveau bordereau (lignes '+its.map(function(i){ return i.row; }).join(', ')+') : '+(e&&e.message||'erreur'));
    }).then(function(){ done += its.length; progress(done, total); });
  });
  return chain.then(function(){
    return {ok:ok, ko:ko, errs:errs, message: ok+' ligne(s) enregistrée(s)'+(ko?' — '+ko+' en erreur':'')};
  });
}

/* =========================================================
   IMPORT - etape 3 : ECRAN DE RELECTURE COLORE + application
   cfg = {title, items, headers, nounOne, nounPlural, extraSummary, filename,
          ctr, apply(selectedItems, progress) -> Promise<{message, errs}>}
   ========================================================= */
function xlChipsHtml(it){
  var h = '';
  if(it.status==='mod'){
    it.changes.forEach(function(c){
      if(c.text!==undefined) h += '<span class="xl-chip xl-chip-'+(c.kind||'mod')+'">'+esc(c.text)+'</span>';
      else h += '<span class="xl-chip xl-chip-mod"><b>'+esc(c.label)+'</b> <s>'+esc(xlShow(c.old))+'</s> → <b>'+esc(xlShow(c.nw))+'</b></span>';
    });
  } else if(it.status==='add'){
    it.infos.forEach(function(c){ h += '<span class="xl-chip xl-chip-add"><b>'+esc(c.label)+'</b> '+esc(c.val)+'</span>'; });
  }
  it.errors.forEach(function(m){ h += '<span class="xl-chip xl-chip-err">'+esc(m)+'</span>'; });
  it.warnings.forEach(function(m){ h += '<span class="xl-chip xl-chip-warn">⚠ '+esc(m)+'</span>'; });
  if(!h && it.status==='same') h = '<span class="muted" style="font-size:12px;">Aucune différence avec l’existant</span>';
  return h;
}
function xlItemDetailText(it){
  if(it.status==='err') return it.errors.join(' ; ');
  if(it.status==='mod') return it.changes.map(function(c){ return c.text!==undefined ? c.text : c.label+' : '+xlShow(c.old)+' → '+xlShow(c.nw); }).join(' ; ');
  if(it.status==='add') return (it.sub ? it.sub+' — ' : '')+it.infos.map(function(c){ return c.label+' : '+c.val; }).join(' ; ');
  return 'Inchangé';
}
function xlBuildReportSpec(cfg){
  var cols = [{header:'Ligne Excel', info:true, width:11}, {header:'Résultat', info:true, width:12}, {header:'Détail', info:true, width:70}]
    .concat(cfg.headers.map(function(h){ return {header:h, width:24}; }));
  var rows = cfg.items.map(function(it){
    var fill = XL_COLORS[it.status];
    var row = [{v:it.row}, {v:XL_STATUS_LABEL[it.status], fill:fill, bold:true}, {v:xlItemDetailText(it), fill:(it.status==='same'?null:fill)}];
    it.raw.forEach(function(val, ci){
      var m = it.marks[ci];
      var cell = {v:val};
      if(it.status==='add') cell.fill = XL_COLORS.add;
      if(m && m.kind==='mod'){ cell.fill = XL_COLORS.mod; cell.bold = true; cell.comment = 'Avant : '+m.old; }
      if(m && m.kind==='err'){ cell.fill = 'EF9A9A'; cell.bold = true; cell.comment = m.msg; }
      if(it.status==='err' && !m) cell.fill = XL_COLORS.err;
      row.push(cell);
    });
    return row;
  });
  return {
    filename: cfg.filename,
    sheets: [{name:'Compte rendu', columns: cols, rows: rows, extraRows:false}],
    guide: {name:'Légende', title:'Légende des couleurs', lines:[
      'Vert : ligne ajoutée.',
      'Orange : ligne modifiée — la cellule modifiée est en orange foncé, l’ancienne valeur est dans son commentaire.',
      'Rouge : ligne refusée (non importée) — la cellule en cause est en rouge, le motif est dans son commentaire et dans la colonne « Détail ».',
      'Sans couleur : ligne inchangée.'
    ]}
  };
}

function xlOpenReview(cfg){
  var items = cfg.items;
  var filter = 'all';
  var overlay = openModal({
    title: cfg.title, large: true,
    body: '<div id="xlr-root"></div>',
    foot: false
  });
  overlay.querySelector('.modal').style.maxWidth = '1100px';
  function counts(){
    var c = {add:0, mod:0, err:0, same:0};
    items.forEach(function(it){ c[it.status]++; });
    return c;
  }
  function selectedItems(){ return items.filter(function(it){ return (cfg.atomic || it.selected) && (it.status==='add' || it.status==='mod'); }); }
  function render(){
    var c = counts();
    var sel = selectedItems();
    var tabs = [['all','Tout ('+items.length+')'], ['add','Ajoutés ('+c.add+')'], ['mod','Modifiés ('+c.mod+')'], ['err','Refusés ('+c.err+')'], ['same','Inchangés ('+c.same+')']];
    var shown = items.filter(function(it){ return filter==='all' || it.status===filter; });
    var actionable = cfg.atomic ? [] : items.filter(function(it){ return it.status==='add' || it.status==='mod'; });
    var blocked = !!(cfg.blockOnError && c.err);
    var applyLabel = cfg.applyLabel || ('Importer '+sel.length+' ligne(s)');
    byId('xlr-root').innerHTML =
      '<div class="xl-sum">'+
        '<span class="pill pill-success">'+c.add+' ajouté(s)</span>'+
        '<span class="pill pill-warning">'+c.mod+' modifié(s)</span>'+
        '<span class="pill pill-danger">'+c.err+' refusé(s)</span>'+
        '<span class="pill pill-neutral">'+c.same+' inchangé(s)</span>'+
      '</div>'+
      (cfg.extraSummary ? '<p class="hint" style="margin:6px 0;">'+esc(cfg.extraSummary)+'</p>' : '')+
      (c.err ? (cfg.blockOnError ? '<p class="hint" style="margin:6px 0;color:var(--danger);">Cette importation est « tout ou rien » : corrigez les éléments refusés dans le fichier Excel puis réimportez-le.</p>'
        : '<p class="hint" style="margin:6px 0;color:var(--danger);">Les lignes refusées ne seront <b>pas</b> importées : corrigez-les dans le fichier Excel puis réimportez-le (le compte rendu coloré indique chaque cellule en cause).</p>') : '')+
      '<div class="xl-tabs">'+tabs.map(function(t){ return '<button type="button" class="xl-tab'+(filter===t[0]?' active':'')+'" data-xl-tab="'+t[0]+'">'+esc(t[1])+'</button>'; }).join('')+'</div>'+
      (actionable.length ? '<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn btn-sm" id="xlr-all">Tout cocher</button><button type="button" class="btn btn-sm" id="xlr-none">Tout décocher</button></div>' : '')+
      '<div class="table-wrap" style="max-height:52vh;overflow:auto;"><table class="xl-table"><thead><tr><th style="width:28px;"></th><th>Ligne</th><th>Résultat</th><th>Élément</th><th>Détail</th></tr></thead><tbody>'+
        (shown.length ? shown.map(function(it){
          var idx = items.indexOf(it);
          var can = it.status==='add' || it.status==='mod';
          return '<tr class="xl-row-'+it.status+'">'+
            '<td>'+(can && !cfg.atomic ? '<input type="checkbox" class="xlr-chk" data-i="'+idx+'" style="width:auto;"'+(it.selected?' checked':'')+'>' : '')+'</td>'+
            '<td class="num muted">'+it.row+'</td>'+
            '<td><span class="pill pill-'+XL_STATUS_TONE[it.status]+'">'+XL_STATUS_LABEL[it.status]+'</span></td>'+
            '<td><b>'+esc(it.title)+'</b>'+(it.sub?'<div class="muted" style="font-size:11.5px;">'+esc(it.sub)+'</div>':'')+'</td>'+
            '<td>'+xlChipsHtml(it)+'</td>'+
          '</tr>';
        }).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:18px;">Aucune ligne dans cette catégorie.</td></tr>')+
      '</tbody></table></div>'+
      '<div id="xlr-progress" class="hint" style="margin-top:8px;"></div>'+
      '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="xlr-report">'+ic('download',15)+' Compte rendu coloré (Excel)</button>'+
        '<span style="display:flex;gap:10px;"><button type="button" class="btn" id="xlr-cancel">Fermer sans importer</button>'+
        '<button type="button" class="btn btn-primary" id="xlr-apply"'+((sel.length && !blocked)?'':' disabled')+'>'+esc(applyLabel)+'</button></span>'+
      '</div>';
    byId('xlr-root').querySelectorAll('[data-xl-tab]').forEach(function(b){ b.addEventListener('click', function(){ filter = b.getAttribute('data-xl-tab'); render(); }); });
    byId('xlr-root').querySelectorAll('.xlr-chk').forEach(function(ch){ ch.addEventListener('change', function(){
      items[+ch.getAttribute('data-i')].selected = ch.checked;
      var n = selectedItems().length;
      var ab = byId('xlr-apply'); ab.disabled = !n; ab.textContent = 'Importer '+n+' ligne(s)';
    }); });
    var ba = byId('xlr-all'); if(ba) ba.addEventListener('click', function(){ actionable.forEach(function(it){ it.selected = true; }); render(); });
    var bn = byId('xlr-none'); if(bn) bn.addEventListener('click', function(){ actionable.forEach(function(it){ it.selected = false; }); render(); });
    byId('xlr-cancel').addEventListener('click', closeModal);
    byId('xlr-report').addEventListener('click', function(){
      xlDownloadBuild(xlBuildReportSpec(cfg)).then(function(){ toast('Compte rendu généré', 'success'); })
        .catch(function(e){ console.error(e); toast('Erreur : '+e.message, 'danger'); });
    });
    byId('xlr-apply').addEventListener('click', function(){
      var chosen = selectedItems();
      if(!chosen.length || blocked) return;
      var msg = cfg.confirmMessage ? cfg.confirmMessage(chosen) : '';
      if(msg){
        // La boite de confirmation remplace la fenetre : on rouvre la relecture
        // (etat conserve dans items) si l'utilisateur refuse.
        confirmDialog(msg, {danger:true, okLabel:'Appliquer quand même', title:'Confirmer l’importation'}).then(function(ok){
          if(!ok){ xlOpenReview(cfg); return; }
          cfg.apply(chosen, function(){}).then(function(res){
            toast(res.message, res.ko ? 'danger' : 'success');
          }).catch(function(e){ console.error(e); toast('Erreur pendant l’import : '+(e&&e.message||''), 'danger'); });
        });
        return;
      }
      var btn = byId('xlr-apply'); btn.disabled = true;
      byId('xlr-cancel').disabled = true; byId('xlr-report').disabled = true;
      var prog = byId('xlr-progress');
      cfg.apply(chosen, function(done, total){ prog.textContent = 'Enregistrement… '+done+' / '+total; }).then(function(res){
        closeModal();
        toast(res.message, res.ko ? 'danger' : 'success');
        if(res.errs && res.errs.length) console.error('Import Excel - erreurs :', res.errs);
      }).catch(function(e){ console.error(e); toast('Erreur pendant l’import : '+(e&&e.message||''), 'danger'); btn.disabled = false; byId('xlr-cancel').disabled = false; byId('xlr-report').disabled = false; });
    });
  }
  render();
}

/* =========================================================
   CODIFICATION DES LIVRABLES (V2.17) - export / import Excel
   Fichier propre a UN contrat, distinct de l'export des livrables :
   - feuille « Codification » : UN SEGMENT PAR COLONNE (en-tete = nom du
     segment, une valeur par cellule en dessous) ;
   - feuille « Composition du code » : ordre des segments dans le code et
     inclusion Oui/Non (menu deroulant) ; « Numero sequentiel » reste
     toujours inclus.
   Un segment est reconnu par son NOM (renommer dans Excel = retirer un
   segment et en creer un autre : a faire plutot dans l'application, qui
   conserve les valeurs deja saisies). Import « tout ou rien », avec
   confirmation prealable si des valeurs ou segments deja utilises par des
   livrables sont retires.
   ========================================================= */
function xlCodifState(ctr){
  var segs = segmentsPersonnalisesDuContrat(ctr).map(function(sg){ return {id:sg.id, nom:sg.nom, valeurs:sg.valeurs.slice()}; });
  var labels = {};
  fixesActifsDuContrat(ctr).forEach(function(f){ labels[f.id] = f.label; });
  segs.forEach(function(sg){ labels[sg.id] = sg.nom; });
  var saved = (Array.isArray(ctr.codificationSegments) && ctr.codificationSegments.length) ? ctr.codificationSegments.slice() : CODIFICATION_SEGMENTS_DEFAUT.slice();
  var included = saved.filter(function(id){ return labels[id]; });
  var order = included.slice();
  Object.keys(labels).forEach(function(id){ if(order.indexOf(id)<0) order.push(id); });
  return {segs:segs, labels:labels, included:included, order:order};
}
function xlCodifExample(ctr, segs, includedIds){
  var vals = {};
  segs.forEach(function(sg){ vals[sg.id] = (sg.valeurs[0]) || sg.nom || '—'; });
  return livrableCode({ctrNumero:ctr.numero, typeDocument:'Plan', numeroSeq:1, indiceRevision:'A', segmentsValeurs:vals}, {numero:ctr.numero, codificationSegments:includedIds});
}

function xlExportCodification(ctr){
  ctr = projetParId(ctr.id) || ctr;
  var st = xlCodifState(ctr);
  var maxLen = st.segs.reduce(function(m, sg){ return Math.max(m, sg.valeurs.length); }, 0);
  var rows = [];
  for(var i=0;i<maxLen;i++) rows.push(st.segs.map(function(sg){ return sg.valeurs[i] || ''; }));
  var compRows = st.order.map(function(id, ix){
    return [ix+1, st.labels[id], st.included.indexOf(id)>=0 ? 'Oui' : 'Non'];
  });
  var spec = {
    filename: 'Codification_'+(ctr.numero||'contrat')+'_'+xlDateStamp()+'.xlsx',
    sheets: [
      {name:'Codification', columns: st.segs.map(function(sg){
        var w = Math.max.apply(null, [String(sg.nom).length].concat(sg.valeurs.map(function(v){ return String(v).length; }))) + 4;
        return {header: sg.nom, width: Math.min(Math.max(w, 14), 40)};
      }), rows: rows},
      {name:'Composition du code', columns:[
        {header:'Ordre', number:true, width:9},
        {header:'Segment', info:true, width:34},
        {header:'Inclus', list:'Oui / Non', width:10}
      ], rows: compRows, extraRows:false}
    ],
    lists: {'Oui / Non':['Oui','Non']},
    guide: {name:'Mode d\'emploi', title:'Codification des livrables — mode d\'emploi', lines:[
      'Contrat : '+ctr.numero+' — '+(ctr.clientNom||''),
      '',
      'FEUILLE « Codification »',
      '  • Un segment par colonne : le nom du segment est en en-tête, ses valeurs sont dans les cellules en dessous (une valeur par cellule).',
      '  • Pour ajouter une valeur : tapez-la dans la première cellule vide sous la colonne. Pour ajouter un segment : ajoutez un en-tête dans la première colonne libre.',
      '  • Un segment est reconnu par son NOM. Ne le renommez pas ici (ce serait compris comme « segment retiré + nouveau segment ») : renommez-le plutôt dans l\'application.',
      '',
      'FEUILLE « Composition du code »',
      '  • L\'ordre des lignes (colonne « Ordre ») donne l\'ordre des segments dans le code ; « Inclus » = Oui/Non (liste déroulante).',
      '  • Un segment nouveau absent de cette feuille est ajouté à la fin, inclus. Les segments fixes supprimés dans l\'application n\'apparaissent plus ici.',
      '',
      'IMPORT',
      '  • Le fichier est d\'abord analysé : vous voyez ce qui est ajouté (vert), modifié (orange) ou refusé (rouge) AVANT toute modification.',
      '  • L\'importation est « tout ou rien ». Si des valeurs ou segments déjà utilisés par des livrables sont retirés, une confirmation vous est demandée.'
    ]},
    meta: {type:'codification', ctrId:ctr.id, ctrNumero:ctr.numero, version:(window.APP_VERSION||'')}
  };
  toast('Génération du fichier Excel…');
  return xlDownloadBuild(spec).then(function(){ toast('Fichier Excel généré', 'success'); })
    .catch(function(err){ console.error(err); toast('Erreur d’export : '+err.message, 'danger'); });
}

function xlOpenImportCodification(ctr){
  if(!canWrite('livrables')){ toast('Vous n’avez pas le droit de modifier la codification.', 'danger'); return; }
  openModal({
    title: 'Importer la codification du contrat '+ctr.numero+' depuis Excel',
    large: true,
    body:
      '<p class="hint" style="margin-bottom:12px;">Sélectionnez un fichier obtenu avec « Exporter Excel » (corrigé ou complété). Il sera <b>analysé</b> avant toute modification : segments et valeurs ajoutés (vert), modifiés (orange), refusés (rouge). Le résultat remplace la codification actuelle de ce contrat.</p>'+
      '<input type="file" id="xlc-file" accept=".xlsx"><div id="xlc-zone" style="margin-top:12px;"></div>',
    foot: false
  });
  byId('xlc-file').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    byId('xlc-zone').innerHTML = '<p class="hint">Lecture du fichier…</p>';
    xlReadFile(file).then(function(parsed){
      var res = xlAnalyseCodification(parsed, projetParId(ctr.id) || ctr);
      xlOpenReview(res);
    }).catch(function(err){ console.error(err); byId('xlc-zone').innerHTML=''; toast(err.message || 'Analyse impossible', 'danger'); });
  });
}

function xlAnalyseCodification(parsed, ctr){
  if(parsed.meta && parsed.meta.type && parsed.meta.type!=='codification') throw new Error('Ce fichier est un export de « '+parsed.meta.type+' », pas de codification.');
  if(parsed.meta && parsed.meta.ctrId && parsed.meta.ctrId!==ctr.id) throw new Error('Ce fichier a été exporté pour un autre contrat ('+(parsed.meta.ctrNumero||'?')+').');
  var names = parsed.order || [];
  var nmCod = names.find(function(n){ return xlKey(n)==='codification'; });
  if(!nmCod) throw new Error('Feuille « Codification » introuvable : utilisez un fichier obtenu avec « Exporter Excel ».');
  var shCod = parsed.sheets[nmCod];
  var nmComp = names.find(function(n){ return xlKey(n)==='composition du code'; });
  var shComp = nmComp ? parsed.sheets[nmComp] : null;
  var cur = xlCodifState(ctr);
  var items = [], seq = 0;
  function newIt(title){ var it = xlNewItem(++seq, [title]); it.title = title; return it; }
  var fixedByLabel = {};
  CODIFICATION_SEGMENTS_FIXES.forEach(function(f){ fixedByLabel[xlKey(f.label)] = f.id; });
  var usedLivs = STATE.livrables.filter(function(l){ return projetIdDe(l)===ctr.id; });
  function usage(segId, value){
    return usedLivs.filter(function(l){ var v = livrableSegmentValeur(l, segId); return value===null ? (v!==undefined && v!==null && v!=='') : String(v||'')===value; }).length;
  }
  var impacts = [];   // [{seg, value|null, count}]

  // ---------- feuille Codification : un segment par colonne ----------
  var fileSegs = [], seenNames = {};
  shCod.headers.forEach(function(h, j){
    var nom = String(h||'').trim();
    var vals = [], dupVals = [];
    shCod.rows.forEach(function(r){
      var v = String(r[j]||'').trim();
      if(!v) return;
      if(vals.indexOf(v)>=0){ if(dupVals.indexOf(v)<0) dupVals.push(v); } else vals.push(v);
    });
    if(!nom){
      if(vals.length){ var e = newIt('(colonne '+(j+1)+' sans nom)'); xlErr(e, -1, 'Colonne '+(j+1)+' : des valeurs sont saisies sous un en-tête vide — donnez un nom au segment'); items.push(e); }
      return;
    }
    var k = xlKey(nom);
    if(seenNames[k]){ var e2 = newIt(nom); xlErr(e2, -1, 'Segment « '+nom+' » en double dans le fichier'); items.push(e2); return; }
    seenNames[k] = true;
    if(fixedByLabel[k]){ var e3 = newIt(nom); xlErr(e3, -1, '« '+nom+' » est un segment fixe du code : ne le recréez pas ici (voir la feuille « Composition du code »)'); items.push(e3); return; }
    fileSegs.push({nom:nom, key:k, valeurs:vals, dupVals:dupVals});
  });
  if(!fileSegs.length && !items.length){ var e4 = newIt('Codification'); xlErr(e4, -1, 'Aucun segment trouvé dans la feuille « Codification »'); items.push(e4); }

  var finalSegs = [];
  fileSegs.forEach(function(fs){
    var ex = cur.segs.find(function(sg){ return xlKey(sg.nom)===fs.key; });
    var id = ex ? ex.id : 'seg'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    finalSegs.push({id:id, nom:fs.nom, valeurs:fs.valeurs, isNew:!ex});
    var it = newIt(fs.nom);
    fs.dupVals.forEach(function(v){ it.warnings.push('Valeur « '+v+' » en double : conservée une seule fois'); });
    if(!ex){
      it.status = 'add'; it.sub = 'Nouveau segment';
      fs.valeurs.forEach(function(v){ it.infos.push({label:'Valeur', val:v}); });
      if(!fs.valeurs.length) it.warnings.push('Segment sans aucune valeur');
    } else {
      var added = fs.valeurs.filter(function(v){ return ex.valeurs.indexOf(v)<0; });
      var removed = ex.valeurs.filter(function(v){ return fs.valeurs.indexOf(v)<0; });
      added.forEach(function(v){ it.changes.push({text:'+ '+v, kind:'new'}); });
      removed.forEach(function(v){
        it.changes.push({text:v, kind:'del'});
        var n = usage(ex.id, v);
        if(n){ impacts.push({seg:ex.nom, value:v, count:n}); it.warnings.push('« '+v+' » est utilisée par '+n+' livrable(s)'); }
      });
      if(!added.length && !removed.length && ex.valeurs.join('\u0001')!==fs.valeurs.join('\u0001')) it.changes.push({text:'Ordre des valeurs modifié', kind:'mod'});
      it.sub = ex.valeurs.length+' → '+fs.valeurs.length+' valeur(s)';
      it.status = it.changes.length ? 'mod' : 'same';
    }
    items.push(it);
  });
  // segments existants absents du fichier = retires
  cur.segs.forEach(function(sg){
    if(fileSegs.some(function(fs){ return fs.key===xlKey(sg.nom); })) return;
    // un segment dont l'en-tete est present mais en erreur n'est pas "retire"
    if(seenNames[xlKey(sg.nom)]) return;
    var it = newIt(sg.nom);
    it.status = 'mod'; it.sub = 'Segment absent du fichier';
    it.changes.push({text:'Segment retiré', kind:'del'});
    var n = usage(sg.id, null);
    if(n){ impacts.push({seg:sg.nom, value:null, count:n}); it.warnings.push(n+' livrable(s) ont une valeur pour ce segment : elle sera conservée en mémoire mais n’apparaîtra plus dans le code'); }
    items.push(it);
  });

  // ---------- feuille Composition du code ----------
  var labelToId = {};
  fixesActifsDuContrat(ctr).forEach(function(f){ labelToId[xlKey(f.label)] = f.id; });
  finalSegs.forEach(function(sg){ labelToId[xlKey(sg.nom)] = sg.id; });
  var catalogue = fixesActifsDuContrat(ctr).map(function(f){ return f.id; }).concat(finalSegs.map(function(sg){ return sg.id; }));
  var compIt = newIt('Composition du code');
  var listed = [];     // [{id, inclus, ordre, pos}]
  if(shComp){
    var hk = shComp.headers.map(xlKey);
    var iO = hk.indexOf('ordre'), iS = hk.indexOf('segment'), iI = hk.indexOf('inclus');
    if(iS<0 || iI<0){ xlErr(compIt, -1, 'Feuille « Composition du code » : colonnes « Segment » et « Inclus » introuvables'); }
    else {
      var seenIds = {}, ordreOk = iO>=0;
      shComp.rows.forEach(function(r, pos){
        var segName = String(r[iS]||'').trim();
        if(!segName) return;
        var id = labelToId[xlKey(segName)];
        if(!id){ xlErr(compIt, -1, 'Ligne '+shComp.rowNumbers[pos]+' : segment « '+segName+' » inconnu (absent de la feuille « Codification »)'); return; }
        if(seenIds[id]){ xlErr(compIt, -1, 'Ligne '+shComp.rowNumbers[pos]+' : segment « '+segName+' » en double'); return; }
        seenIds[id] = true;
        var optI = xlFindOption([{id:'oui',label:'Oui'},{id:'non',label:'Non'}], r[iI]);
        if(!optI){ xlErr(compIt, -1, 'Ligne '+shComp.rowNumbers[pos]+' : « Inclus » doit être Oui ou Non (valeur lue : « '+r[iI]+' »)'); return; }
        var ordre = null;
        if(iO>=0){
          var o = xlNumber(r[iO]);
          if(o===null || o===''){ xlErr(compIt, -1, 'Ligne '+shComp.rowNumbers[pos]+' : « Ordre » doit être un nombre'); ordreOk = false; return; }
          ordre = o;
        }
        listed.push({id:id, inclus:optI.id==='oui', ordre:ordre, pos:pos});
      });
      if(ordreOk && iO>=0) listed.sort(function(a,b){ return a.ordre-b.ordre || a.pos-b.pos; });
    }
  }
  var newOrder = [], newIncluded = [];
  if(compIt.status!=='err'){
    if(shComp){
      listed.forEach(function(x){
        newOrder.push(x.id);
        if(x.inclus) newIncluded.push(x.id);
      });
    } else {
      cur.order.forEach(function(id){ if(catalogue.indexOf(id)>=0){ newOrder.push(id); if(cur.included.indexOf(id)>=0) newIncluded.push(id); } });
    }
    catalogue.forEach(function(id){
      if(newOrder.indexOf(id)>=0) return;
      var wasInc = cur.included.indexOf(id)>=0;
      var isNewSeg = finalSegs.some(function(sg){ return sg.id===id && sg.isNew; });
      newOrder.push(id);
      if(wasInc || isNewSeg){ newIncluded.push(id); }
    });
    // composition = segments inclus, dans l'ordre
    var comp = newOrder.filter(function(id){ return newIncluded.indexOf(id)>=0; });
    if(!comp.length) comp.push('seq');
    var labelOf = {};
    fixesActifsDuContrat(ctr).forEach(function(f){ labelOf[f.id] = f.label; });
    finalSegs.forEach(function(sg){ labelOf[sg.id] = sg.nom; });
    var curTxt = cur.included.map(function(id){ return cur.labels[id]; }).join(' › ');
    var newTxt = comp.map(function(id){ return labelOf[id]; }).join(' › ');
    compIt.sub = 'Exemple de code : '+xlCodifExample(ctr, finalSegs, comp);
    if(curTxt!==newTxt){
      compIt.status = 'mod';
      compIt.changes.push({label:'Composition', old:curTxt, nw:newTxt});
    } else compIt.status = 'same';
    compIt.finalComposition = comp;
  }
  items.push(compIt);
  items.forEach(function(it, ix){ it.row = ix+1; });

  return {
    kind:'codification', title:'Relecture de l’import — codification du contrat '+ctr.numero,
    ctr:ctr, headers:['Élément'], items:items, atomic:true, blockOnError:true,
    applyLabel:'Appliquer la codification',
    filename:'Compte_rendu_import_codification_'+(ctr.numero||'')+'_'+xlDateStamp()+'.xlsx',
    confirmMessage: function(){
      if(!impacts.length) return '';
      var total = impacts.reduce(function(n, x){ return n + x.count; }, 0);
      var ex = impacts.slice(0,6).map(function(x){ return x.value===null ? 'segment « '+x.seg+' » ('+x.count+' livrable(s))' : '« '+x.value+' » dans « '+x.seg+' » ('+x.count+')'; }).join(' ; ');
      return 'Cette importation retire des éléments déjà utilisés par des livrables : '+ex+(impacts.length>6?' …':'')+'. Les livrables concernés ('+total+' utilisation(s)) gardent leur valeur en mémoire, mais leur code sera recalculé immédiatement sans elle. Appliquer quand même ?';
    },
    apply: function(){
      var segs = finalSegs.map(function(sg){ return {id:sg.id, nom:sg.nom, valeurs:sg.valeurs}; });
      var comp = compIt.finalComposition || cur.included.filter(function(id){ return catalogue.indexOf(id)>=0; });
      return STATE.db.doc(projetDocPath(ctr)).update({segmentsPersonnalises:segs, codificationSegments:comp}).then(function(){
        return {ok:1, ko:0, errs:[], message:'Codification du contrat enregistrée ('+segs.length+' segment(s))'};
      });
    }
  };
}
