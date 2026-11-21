/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.03) - Base de donnees des consommateurs.
   Charge APRES app.js (utilise ses fonctions et son STATE).

   Une ligne = un consommateur, rattache a un contrat OU a un devis. Les 37
   colonnes reprennent exactement le fichier modele "Liste des consommateurs" :
     - Saisi   : saisie manuelle ;
     - Liste   : liste deroulante (valeurs gerees dans "Gerer les listes") ;
     - Formule : calculee comme dans Excel (memes formules), avec possibilite
                 d'imposer une valeur a la main (cellule teintee, "forces").
   Import Excel avec correspondance des colonnes ; export Excel avec les
   VRAIES formules et les listes deroulantes (POST /api/etude-elec/export).
   Les sous-menus "Liste des consommateurs" et "Bilan de puissance" viendront
   plus tard : seule la Base de donnees est livree ici.
   ========================================================= */

/* ---------- colonnes (ordre et titres du fichier modele, A..AK) ---------- */
var EE_COLS = [
  {key:'sr', title:'Sr.', nature:'Saisi', w:56},
  {key:'rev', title:'Rev', nature:'Saisi', w:46},
  {key:'switchgear', title:'Switchgear / MCC', nature:'Saisi', w:130},
  {key:'systemArea', title:'System / Area', nature:'Saisi', w:190},
  {key:'tag', title:'Equipment Tag No.', nature:'Saisi', w:120},
  {key:'nom', title:'Equipment Name', nature:'Saisi', w:240},
  {key:'puissanceKw', title:'Installed power (kW)', nature:'Saisi', num:true, w:90},
  {key:'puissanceAbsorbee', title:'Absorbed power', nature:'Saisi', num:true, w:90},
  {key:'tension', title:'Voltage (V)', nature:'Liste', list:'tension', num:true, w:80},
  {key:'phaseFreq', title:'Phase / Freq. (Hz)', nature:'Liste', list:'phaseFreq', w:90},
  {key:'specialReqts', title:'Départ type', nature:'Liste', list:'specialReqts', w:90},
  {key:'ws', title:'W/S', nature:'Liste', list:'ws', w:60},
  {key:'ci', title:'C/I', nature:'Liste', list:'ci', w:56},
  {key:'eNe', title:'E/NE', nature:'Liste', list:'eNe', w:60},
  {key:'pctE', title:'% E', nature:'Saisi', num:true, w:64},
  {key:'remarks', title:'Remarks', nature:'Saisi', w:220},
  {key:'puissanceApparente', title:'Puissance apparente (kVA)', nature:'Formule', num:true, w:100,
    xl:'IFERROR(SQRT({pActive}^2+{pReactive}^2),"")'},
  {key:'puissanceInstallee', title:'Puissance Installée', nature:'Formule', num:true, w:90, xl:'{puissanceKw}'},
  {key:'unite', title:'Unité', nature:'Liste', list:'unite', w:64},
  {key:'courant', title:'Courant Installé', nature:'Formule', num:true, w:90,
    xl:'IF({phaseFreq}="3/50",IF({unite}="A",{puissanceInstallee},IF({unite}="KVA",1000*{puissanceInstallee}/{tension}/1.732,1000*{puissanceInstallee}/{tension}/1.732/{cosPhi})),IF({phaseFreq}="1/50",IF({unite}="A",{puissanceInstallee},IF({unite}="KVA",1000*{puissanceInstallee}/{tension},1000*{puissanceInstallee}/{tension}/{cosPhi})),"Spécifier la polarité pour calculer le courant"))'},
  {key:'typeConso', title:'Type', nature:'Liste', list:'typeConso', w:80},
  {key:'vitesse', title:'Vitesse', nature:'Saisi', w:70},
  {key:'contenu', title:'Contenu', nature:'Liste', list:'contenu', w:90},
  {key:'nombre', title:'Nombre', nature:'Saisi', num:true, w:70},
  {key:'cosPhi', title:'Cos ϕ', nature:'Saisi', num:true, w:64},
  {key:'rend', title:'Rend', nature:'Saisi', num:true, w:64},
  {key:'pVfd', title:'P VFD', nature:'Saisi', num:true, w:70},
  {key:'cosPhiVfd', title:'Cos ϕ VFD', nature:'Saisi', num:true, w:70},
  {key:'rendVfd', title:'Rend VFD', nature:'Saisi', num:true, w:70},
  {key:'kUtil', title:'K.Util', nature:'Formule', num:true, w:70, xl:'{puissanceAbsorbee}/{puissanceKw}'},
  {key:'kSimul', title:'K.Simul', nature:'Formule', num:true, w:70, xl:'IF({ws}="W",1,0)'},
  {key:'pActive', title:'Puissance Active (kW)', nature:'Formule', num:true, w:100,
    xl:'IFERROR(IF({typeConso}="Moteur",{puissanceInstallee}/{rend},IF({unite}="kva",{puissanceInstallee}*{cosPhi},IF({unite}="A",{puissanceInstallee}*1.732*{tension}*{cosPhi}/1000,{puissanceInstallee}/{rend}))),"")'},
  {key:'pReactive', title:'Puissance Réactive (kvar)', nature:'Formule', num:true, w:100,
    xl:'IFERROR({pActive}*TAN(ACOS({cosPhi})),"")'},
  {key:'longueur', title:'Longueur', nature:'Saisi', num:true, w:76},
  {key:'modePose', title:'Mode de pose', nature:'Liste', list:'modePose', w:100},
  {key:'pActiveFoisonnee', title:'Puissance Active Foisonnée (kW)', nature:'Formule', num:true, w:110,
    xl:'IFERROR((IF({typeConso}="Moteur",{puissanceInstallee}/{rend},{pActive}))*{nombre}*{kUtil}*{kSimul},"")'},
  {key:'pReactiveFoisonnee', title:'Puissance Réactive Foisonnée (kvar)', nature:'Formule', num:true, w:110,
    xl:'IFERROR({pActiveFoisonnee}*TAN(ACOS({cosPhi})),"")'}
];
var EE_BY_KEY = {};
EE_COLS.forEach(function(c){ EE_BY_KEY[c.key] = c; });
// ordre de calcul des colonnes "formule" (chacune ne depend que des precedentes)
var EE_ORDRE_CALCUL = ['puissanceInstallee','kUtil','kSimul','pActive','pReactive','puissanceApparente','courant','pActiveFoisonnee','pReactiveFoisonnee'];
var EE_MSG_POLARITE = 'Spécifier la polarité pour calculer le courant';

var EE_LISTES_TITRES = {
  tension:'Voltage (V)', phaseFreq:'Phase / Freq. (Hz)', specialReqts:'Départ type', ws:'W/S', ci:'C/I', eNe:'E/NE',
  unite:'Unité', typeConso:'Type', contenu:'Contenu', modePose:'Mode de pose', typeCable:'Type câble (Liste des consommateurs)'
};
// valeurs de depart (identiques a celles semees par le serveur, voir backend/schema_upgrades.py)
var EE_LISTES_DEFAUT = {
  tension:['230','400','525','10000'], phaseFreq:['3/50','1/50','2/50'], specialReqts:['DOL','VFD','DD','FEEDER','NA','N/A'],
  ws:['W','S','Futur'], ci:['C','I','S'], eNe:['E','NE'], unite:['kW','kVA','A'], typeConso:['Moteur','Tableau','Divers'],
  contenu:['3P+PE','P+N+PE','3P+N+PE','3P'], modePose:[], typeCable:[]
};

/* ---------- calcul des colonnes "formule" (memes regles que les formules Excel) ----------
   Convention Excel : une cellule vide vaut 0 dans un calcul ; une division par 0 ou un texte dans un
   calcul donne une erreur (NaN ici) que IFERROR transforme en vide (null ici). */
function eeN(x){ if(x===null || x===undefined || x==='') return 0; var n = Number(String(x).replace(',', '.')); return isNaN(n) ? NaN : n; }
function eeEgal(a, b){ return String(a===null||a===undefined?'':a).trim().toLowerCase() === String(b).toLowerCase(); }
function eeDiv(a, b){ return (b===0 || isNaN(a) || isNaN(b)) ? NaN : a/b; }
function eeOk(x){ return typeof x === 'number' && isFinite(x); }
function eeTanAcos(c){ return (c>1 || c<-1) ? NaN : Math.tan(Math.acos(c)); }

// d : ligne (valeurs saisies + valeurs imposees dans d.forces). Renvoie les valeurs calculees (null = vide / erreur)
// et _msgCourant = true si la polarite n'est ni 3/50 ni 1/50.
function eeCalculer(d){
  var forces = d.forces || {};
  var out = {};
  function eff(key, calcule){
    if(forces[key]){ var f = d[key]; out[key] = (f===undefined || f==='') ? null : f; return out[key]; }
    var v = calcule();
    out[key] = eeOk(v) ? v : null;
    return out[key];
  }
  function val(key){ return out[key]; }
  function cos(){ return eeN(d.cosPhi); }
  var G = eeN(d.puissanceKw);
  eff('puissanceInstallee', function(){ return G; });
  var R = function(){ return val('puissanceInstallee')===null ? NaN : val('puissanceInstallee'); };
  eff('kUtil', function(){ return eeDiv(eeN(d.puissanceAbsorbee), G); });
  eff('kSimul', function(){ return eeEgal(d.ws, 'W') ? 1 : 0; });
  eff('pActive', function(){
    if(eeEgal(d.typeConso, 'Moteur')) return eeDiv(R(), eeN(d.rend));
    if(eeEgal(d.unite, 'kVA')) return R() * cos();
    if(eeEgal(d.unite, 'A')) return R() * 1.732 * eeN(d.tension) * cos() / 1000;
    return eeDiv(R(), eeN(d.rend));
  });
  eff('pReactive', function(){ return val('pActive')===null ? NaN : val('pActive') * eeTanAcos(cos()); });
  eff('puissanceApparente', function(){
    return (val('pActive')===null || val('pReactive')===null) ? NaN : Math.sqrt(Math.pow(val('pActive'),2) + Math.pow(val('pReactive'),2));
  });
  out._msgCourant = false;
  eff('courant', function(){
    var ph = String(d.phaseFreq===null||d.phaseFreq===undefined?'':d.phaseFreq).trim();
    var V = eeN(d.tension), P = R(), u = d.unite;
    if(ph === '3/50'){
      if(eeEgal(u, 'A')) return P;
      if(eeEgal(u, 'kVA')) return eeDiv(1000*P, V) / 1.732;
      return eeDiv(eeDiv(1000*P, V) / 1.732, cos());
    }
    if(ph === '1/50'){
      if(eeEgal(u, 'A')) return P;
      if(eeEgal(u, 'kVA')) return eeDiv(1000*P, V);
      return eeDiv(eeDiv(1000*P, V), cos());
    }
    out._msgCourant = true;
    return NaN;
  });
  eff('pActiveFoisonnee', function(){
    var base = eeEgal(d.typeConso, 'Moteur') ? eeDiv(R(), eeN(d.rend)) : (val('pActive')===null ? NaN : val('pActive'));
    var ku = val('kUtil') === null ? NaN : val('kUtil');
    return base * eeN(d.nombre) * ku * val('kSimul');
  });
  eff('pReactiveFoisonnee', function(){ return val('pActiveFoisonnee')===null ? NaN : val('pActiveFoisonnee') * eeTanAcos(cos()); });
  return out;
}
// Complete une ligne : renvoie {valeurs a ecrire pour les colonnes formule non imposees, forces}
function eeCompleter(d){
  var calc = eeCalculer(d), patch = {};
  EE_ORDRE_CALCUL.forEach(function(k){ if(!(d.forces||{})[k]) patch[k] = calc[k]; });
  return patch;
}

/* ---------- etat de l'ecran ---------- */
var EE_UI = {projetId:'', q:'', switchgear:'', limite:200, selection:{}, edition:null, flash:null};

/* V3.23 : la liste « Départ type » est propre a chaque contrat / devis (ex. DOL, VFD... ou Appart type 12...). Elle est stockee sous le nom
   « specialReqts@<id du projet> » ; tant qu'elle n'existe pas, les valeurs par defaut (« specialReqts ») sont proposees. */
var EE_LISTE_PROJET = 'specialReqts';
function eeNomListeProjet(liste, projetId){ return liste === EE_LISTE_PROJET && projetId ? liste + '@' + projetId : liste; }
function eeListeProjetExiste(projetId){ var n = eeNomListeProjet(EE_LISTE_PROJET, projetId); return (STATE.etudeListes||[]).some(function(v){ return v.liste === n; }); }
function eeListes(){
  var m = {};
  Object.keys(EE_LISTES_DEFAUT).forEach(function(k){ m[k] = []; });
  (STATE.etudeListes||[]).slice().sort(function(a,b){ return (a.rang||0)-(b.rang||0); }).forEach(function(v){
    if(String(v.liste).indexOf('@') >= 0) return;
    if(!m[v.liste]) m[v.liste] = [];
    m[v.liste].push(String(v.valeur));
  });
  if(EE_UI.projetId && eeListeProjetExiste(EE_UI.projetId)){
    var n = eeNomListeProjet(EE_LISTE_PROJET, EE_UI.projetId);
    m[EE_LISTE_PROJET] = (STATE.etudeListes||[]).filter(function(v){ return v.liste === n; }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); }).map(function(v){ return String(v.valeur); });
  }
  return m;
}
/* cree la liste du projet en copiant les valeurs par defaut (une seule fois) */
function eeCreerListeProjet(projetId){
  if(!projetId || eeListeProjetExiste(projetId)) return Promise.resolve();
  var n = eeNomListeProjet(EE_LISTE_PROJET, projetId), base = eeListes()[EE_LISTE_PROJET].slice(), p = Promise.resolve();
  base.forEach(function(v, i){
    p = p.then(function(){ return STATE.db.collection('etudeListes').add({liste: n, valeur: String(v), rang: i + 1, createdAt: nowISO()}); });
  });
  return p;
}
function eeProjetsDe(){ return projetsTries(); }
function eeLignesDuProjet(projetId){
  return (STATE.etudeConsommateurs||[]).filter(function(d){ return projetIdDe(d) === projetId; })
    .sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); });
}
function eeFmt(v){
  if(v===null || v===undefined || v==='') return '';
  if(typeof v === 'number'){
    if(!isFinite(v)) return '';
    return (Math.round(v*1000)/1000).toLocaleString('fr-FR', {maximumFractionDigits:3, useGrouping:false});
  }
  return String(v);
}
function eeParseNum(s){
  var t = String(s===null||s===undefined?'':s).trim().replace(/\s/g,'').replace(',', '.');
  if(t === '') return null;
  var n = Number(t);
  return isNaN(n) ? NaN : n;
}
function eeStyleOnce(){
  if(byId('ee-style')) return;
  var st = document.createElement('style'); st.id = 'ee-style';
  st.textContent =
    '.ee-wrap{overflow:auto;max-height:calc(100vh - 250px);border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);}'+
    '.ee-table{border-collapse:separate;border-spacing:0;font-size:12.5px;width:max-content;min-width:100%;}'+
    '.ee-table th{position:sticky;top:0;z-index:2;background:var(--surface-2,#f1f3f5);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border,#d0d5db);white-space:normal;vertical-align:bottom;font-weight:600;}'+
    '.ee-table td{padding:3px 8px;border-bottom:1px solid var(--border-soft,#eceff2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;}'+
    '.ee-table tr:hover td{background:rgba(31,58,95,.05);}'+
    '.ee-nat{display:block;font-size:9.5px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;opacity:.7;}'+
    '.ee-nat-Formule{color:#7f6a00;} .ee-nat-Liste{color:#2e7d6b;}'+
    '.ee-f{background:rgba(127,140,155,.10);} .ee-forced{background:#fff2cc !important;}'+
    '.ee-edit{cursor:cell;} .ee-hors{color:#b9770e;} .ee-num{text-align:right;font-variant-numeric:tabular-nums;}'+
    '.ee-flash td{background:#c8e6c9 !important;} .ee-act{width:70px;} .ee-sel{width:28px;}'+
    '.ee-cell-input{width:100%;min-width:70px;box-sizing:border-box;font:inherit;padding:2px 4px;}'+
    '.ee-map td,.ee-map th{padding:5px 8px;border-bottom:1px solid var(--border-soft,#eceff2);font-size:12.5px;vertical-align:middle;}'+
    '.ee-liste-chip{display:inline-flex;align-items:center;gap:4px;margin:2px 4px 2px 0;padding:2px 4px 2px 9px;border:1px solid var(--border,#d0d5db);border-radius:999px;font-size:12.5px;}';
  document.head.appendChild(st);
}

/* ---------- ecran principal ---------- */
function renderEtudeBase(mount, actions){
  eeStyleOnce();
  var canEdit = canWrite('etude_elec');
  var projets = eeProjetsDe();
  var listes = eeListes();

  if(!projets.length){
    mount.innerHTML = emptyState('ruler', 'Aucun contrat ni devis enregistré. Une base de consommateurs se rattache à un contrat (marché gagné) ou à un devis : créez d’abord l’un des deux.');
    return;
  }
  if(!EE_UI.projetId || !projets.some(function(p){ return p.id === EE_UI.projetId; })){
    // projet par defaut : le premier qui porte deja des consommateurs, sinon le premier de la liste
    var avec = projets.filter(function(p){ return (STATE.etudeConsommateurs||[]).some(function(d){ return projetIdDe(d) === p.id; }); })[0];
    EE_UI.projetId = (avec || projets[0]).id;
  }
  var projet = projetParId(EE_UI.projetId);
  var toutes = eeLignesDuProjet(EE_UI.projetId);
  var sws = []; toutes.forEach(function(d){ if(d.switchgear && sws.indexOf(d.switchgear) < 0) sws.push(d.switchgear); });
  sws.sort();
  var q = (EE_UI.q||'').toLowerCase();
  var lignes = toutes.filter(function(d){
    if(EE_UI.switchgear && d.switchgear !== EE_UI.switchgear) return false;
    if(!q) return true;
    return [d.tag, d.nom, d.switchgear, d.systemArea, d.remarks, d.sr].some(function(x){ return String(x||'').toLowerCase().indexOf(q) >= 0; });
  });

  actions.innerHTML =
    (canEdit ? '<button type="button" class="btn btn-primary" id="ee-add">'+ic('plus',15)+' Ajouter une ligne</button>' : '')+
    (canEdit ? '<button type="button" class="btn" id="ee-import">'+ic('upload',15)+' Importer Excel</button>' : '')+
    '<button type="button" class="btn" id="ee-export">'+ic('download',15)+' Exporter Excel</button>'+
    (canEdit ? '<button type="button" class="btn" id="ee-listes">'+ic('gear',15)+' Gérer les listes</button>' : '');

  var nSel = Object.keys(EE_UI.selection).filter(function(id){ return EE_UI.selection[id]; }).length;
  var visibles = lignes.slice(0, EE_UI.limite);

  var thead = '<tr>'+
    (canEdit ? '<th class="ee-sel"><input type="checkbox" id="ee-selall" title="Tout sélectionner (lignes affichées)"></th><th class="ee-act"></th>' : '')+
    EE_COLS.map(function(c){
      return '<th style="min-width:'+c.w+'px;"><span class="ee-nat ee-nat-'+c.nature+'">'+c.nature+'</span>'+esc(c.title)+'</th>';
    }).join('')+'</tr>';

  var rows = visibles.map(function(d){
    var calc = eeCalculer(d); // pour le message de polarite (le courant stocke reste la reference affichee)
    var forces = d.forces || {};
    var tds = EE_COLS.map(function(c){
      var v = d[c.key];
      var cls = [];
      if(c.num) cls.push('ee-num');
      if(c.nature === 'Formule') cls.push('ee-f');
      if(c.nature === 'Formule' && forces[c.key]) cls.push('ee-forced');
      if(canEdit) cls.push('ee-edit');
      var txt = eeFmt(v), title = '';
      if(c.key === 'courant' && calc._msgCourant && !forces.courant){ txt = '⚠ polarité ?'; title = EE_MSG_POLARITE; }
      if(c.list && v !== null && v !== undefined && v !== '' && listes[c.list].indexOf(String(v)) < 0 && listes[c.list].indexOf(eeFmt(v)) < 0){
        cls.push('ee-hors'); title = 'Valeur absente de la liste';
      }
      if(c.nature === 'Formule' && forces[c.key]) title = 'Valeur imposée à la main (cliquez, videz la cellule pour revenir à la formule)';
      return '<td class="'+cls.join(' ')+'" data-k="'+c.key+'" data-id="'+d.id+'"'+(title?' title="'+esc(title)+'"':'')+'>'+esc(txt)+'</td>';
    }).join('');
    return '<tr data-id="'+d.id+'" class="'+(EE_UI.flash===d.id?'ee-flash':'')+'">'+
      (canEdit ? '<td class="ee-sel"><input type="checkbox" class="ee-chk" data-id="'+d.id+'"'+(EE_UI.selection[d.id]?' checked':'')+'></td>'+
        '<td class="ee-act"><button type="button" class="iconbtn ee-dup" data-id="'+d.id+'" title="Dupliquer">'+ic('layers',14)+'</button>'+
        '<button type="button" class="iconbtn ee-del" data-id="'+d.id+'" title="Supprimer">'+ic('trash',14)+'</button></td>' : '')+
      tds+'</tr>';
  }).join('');

  mount.innerHTML =
    '<div class="section-head"><div class="toolbar">'+
      '<select id="ee-projet" title="Contrat ou devis">'+projetsOptionsHtml(EE_UI.projetId, null, '', true)+'</select>'+
      '<input type="search" id="ee-q" placeholder="Tag, désignation, tableau, remarque…" value="'+esc(EE_UI.q)+'">'+
      '<select id="ee-sw"><option value="">Tous les tableaux (Switchgear / MCC)</option>'+
        sws.map(function(s){ return '<option value="'+esc(s)+'"'+(EE_UI.switchgear===s?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select>'+
      (nSel ? '<button type="button" class="btn btn-danger" id="ee-del-sel">'+ic('trash',14)+' Supprimer la sélection ('+nSel+')</button>' : '')+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Base de données des consommateurs de '+esc(projet ? projetLibelle(projet) : '')+' : '+toutes.length+' ligne(s)'+
      (lignes.length !== toutes.length ? ', '+lignes.length+' affichée(s)' : '')+'. '+
      (canEdit ? 'Cliquez sur une cellule pour la modifier. Les colonnes grisées sont calculées (comme dans Excel) ; cliquez dessus pour imposer une valeur (cellule jaune), videz-la pour revenir à la formule.' : 'Consultation seule.')+'</p>'+
    (toutes.length ? '<div class="ee-wrap"><table class="ee-table"><thead>'+thead+'</thead><tbody>'+rows+'</tbody></table></div>'+
      (lignes.length > visibles.length ? '<p style="text-align:center;margin:10px 0;"><button type="button" class="btn" id="ee-more">Afficher '+Math.min(200, lignes.length - visibles.length)+' lignes de plus ('+(lignes.length - visibles.length)+' non affichées)</button></p>' : '')
      : emptyState('ruler', 'Aucun consommateur pour ce contrat / devis.', canEdit ? '<p class="hint">Ajoutez une ligne ou importez un fichier Excel (« Importer Excel »).</p>' : ''));

  // --- liaisons ---
  byId('ee-projet').addEventListener('change', function(e){ EE_UI.projetId = e.target.value; EE_UI.limite = 200; EE_UI.selection = {}; EE_UI.switchgear = ''; renderEtudeBase(mount, actions); });
  var qi = byId('ee-q');
  qi.addEventListener('input', function(){ EE_UI.q = qi.value; EE_UI.limite = 200; clearTimeout(EE_UI._t); EE_UI._t = setTimeout(function(){ renderEtudeBase(mount, actions); var n = byId('ee-q'); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); });
  byId('ee-sw').addEventListener('change', function(e){ EE_UI.switchgear = e.target.value; EE_UI.limite = 200; renderEtudeBase(mount, actions); });
  var more = byId('ee-more'); if(more) more.addEventListener('click', function(){ EE_UI.limite += 200; renderEtudeBase(mount, actions); });
  byId('ee-export').addEventListener('click', function(){ eeOpenExport(projet, toutes, lignes); });
  if(canEdit){
    byId('ee-add').addEventListener('click', function(){ eeAjouterLigne(projet, toutes); });
    byId('ee-import').addEventListener('click', function(){ eeOpenImport(projet); });
    byId('ee-listes').addEventListener('click', function(){ eeOpenListes(); });
    var sa = byId('ee-selall');
    if(sa) sa.addEventListener('change', function(){ visibles.forEach(function(d){ EE_UI.selection[d.id] = sa.checked; }); renderEtudeBase(mount, actions); });
    mount.querySelectorAll('.ee-chk').forEach(function(ch){ ch.addEventListener('change', function(){ EE_UI.selection[ch.getAttribute('data-id')] = ch.checked; renderEtudeBase(mount, actions); }); });
    mount.querySelectorAll('.ee-dup').forEach(function(b){ b.addEventListener('click', function(){ eeDupliquer(b.getAttribute('data-id'), toutes); }); });
    mount.querySelectorAll('.ee-del').forEach(function(b){ b.addEventListener('click', function(){ eeSupprimer([b.getAttribute('data-id')]); }); });
    var ds = byId('ee-del-sel');
    if(ds) ds.addEventListener('click', function(){ eeSupprimer(Object.keys(EE_UI.selection).filter(function(id){ return EE_UI.selection[id]; })); });
    mount.querySelectorAll('td.ee-edit').forEach(function(td){
      td.addEventListener('click', function(){ eeEditerCellule(td, listes); });
    });
  }
  EE_UI.flash = null;
}

/* ---------- edition d'une cellule ---------- */
function eeDocParId(id){ return (STATE.etudeConsommateurs||[]).find(function(d){ return d.id === id; }); }

function eeEditerCellule(td, listes){
  if(td.querySelector('input,select')) return;
  var key = td.getAttribute('data-k'), id = td.getAttribute('data-id');
  var d = eeDocParId(id), c = EE_BY_KEY[key];
  if(!d || !c) return;
  var valeur = d[key];
  var ouvert = true;
  function fin(valide, brut){
    if(!ouvert) return; ouvert = false;
    if(!valide){ eeRafraichir(); return; }
    eeValiderCellule(d, key, brut);
  }
  if(c.list){
    var vals = listes[c.list].slice();
    var cur = (valeur===null||valeur===undefined) ? '' : eeFmt(valeur);
    var horsListe = cur !== '' && vals.indexOf(cur) < 0;
    var sel = document.createElement('select'); sel.className = 'ee-cell-input';
    sel.innerHTML = '<option value=""></option>'+
      (horsListe ? '<option value="'+esc(cur)+'" selected>'+esc(cur)+' (hors liste)</option>' : '')+
      vals.map(function(v){ return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+
      '<option value="__new__">＋ Nouvelle valeur…</option>';
    td.innerHTML = ''; td.appendChild(sel); sel.focus();
    sel.addEventListener('change', function(){
      if(sel.value === '__new__'){
        ouvert = false;
        eePromptValeurListe(c.list, function(v){ if(v !== null) eeValiderCellule(d, key, v); else eeRafraichir(); });
        return;
      }
      fin(true, sel.value);
    });
    sel.addEventListener('blur', function(){ setTimeout(function(){ if(ouvert) fin(false); }, 150); });
    sel.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ fin(false); } });
    return;
  }
  var inp = document.createElement('input'); inp.className = 'ee-cell-input';
  inp.type = 'text';
  inp.value = (valeur===null||valeur===undefined) ? '' : (c.num ? String(valeur).replace('.', ',') : String(valeur));
  td.innerHTML = ''; td.appendChild(inp); inp.focus(); inp.select();
  inp.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ fin(true, inp.value); }
    else if(e.key === 'Escape'){ fin(false); }
    else if(e.key === 'Tab'){
      e.preventDefault();
      var suivant = eeCelluleSuivante(td, e.shiftKey);
      fin(true, inp.value);
      if(suivant){ var k = suivant.getAttribute('data-k'), i = suivant.getAttribute('data-id'); setTimeout(function(){ var n = document.querySelector('td[data-id="'+i+'"][data-k="'+k+'"]'); if(n) n.click(); }, 400); }
    }
  });
  inp.addEventListener('blur', function(){ setTimeout(function(){ if(ouvert) fin(true, inp.value); }, 100); });
}
function eeCelluleSuivante(td, arriere){
  var tds = Array.prototype.slice.call(td.parentNode.querySelectorAll('td.ee-edit'));
  var i = tds.indexOf(td);
  return tds[i + (arriere ? -1 : 1)] || null;
}
function eeRafraichir(){ if(typeof scheduleRender === 'function') scheduleRender(); }

// Enregistre la valeur d'une cellule : recalcule les colonnes formule non imposees, ecrit seulement ce qui change.
function eeValiderCellule(d, key, brut){
  var c = EE_BY_KEY[key];
  var forces = Object.assign({}, d.forces || {});
  var valeur;
  if(c.num){
    valeur = eeParseNum(brut);
    if(valeur !== null && isNaN(valeur)){ toast('Valeur numérique attendue pour « '+c.title+' »', 'danger'); eeRafraichir(); return; }
  } else {
    valeur = String(brut===null||brut===undefined?'':brut).trim();
    if(valeur === '') valeur = null;
  }
  if(c.list && c.num && valeur === null) valeur = null;
  if(c.nature === 'Formule'){
    if(valeur === null) delete forces[key]; else forces[key] = true;
  }
  var nouveau = Object.assign({}, d, {forces: forces});
  nouveau[key] = valeur;
  var patch = eeCompleter(nouveau);
  if(!(c.nature === 'Formule' && valeur === null)) patch[key] = valeur;   // cellule formule videe : on revient au calcul
  var final = {};
  Object.keys(patch).forEach(function(k){
    var a = d[k], b = patch[k];
    var egal = (a === b) || ((a===undefined||a===null||a==='') && (b===null||b===undefined||b===''));
    if(!egal) final[k] = (b === undefined ? null : b);
  });
  if(JSON.stringify(forces) !== JSON.stringify(d.forces || {})) final.forces = forces;
  if(!Object.keys(final).length){ eeRafraichir(); return; }
  final.updatedAt = nowISO();
  STATE.db.doc('etudeConsommateurs/'+d.id).update(final).then(function(){ eeRafraichir(); })
    .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); eeRafraichir(); });
}

/* ---------- ajout / duplication / suppression ---------- */
function eeProchainOrdre(toutes){ return toutes.reduce(function(m, d){ return Math.max(m, d.ordre||0); }, 0) + 1; }
function eeProchainSr(toutes){
  var m = 0; toutes.forEach(function(d){ var n = parseInt(d.sr, 10); if(!isNaN(n) && n > m) m = n; });
  return String(m + 1);
}
function eeAjouterLigne(projet, toutes){
  var d = Object.assign(champsProjet(projet), {
    clientId: projet.clientId || null, clientNom: projet.clientNom || null,
    ordre: eeProchainOrdre(toutes), sr: eeProchainSr(toutes), rev: '0', unite: 'kW', nombre: 1, ws: 'W',
    forces: {}, createdAt: nowISO(), creePar: currentUserName()
  });
  Object.assign(d, eeCompleter(d));
  STATE.db.collection('etudeConsommateurs').add(d).then(function(ref){
    EE_UI.flash = ref && ref.id; EE_UI.limite = Math.max(EE_UI.limite, toutes.length + 1);
    toast('Ligne ajoutée', 'success'); eeRafraichir();
    setTimeout(function(){ var t = document.querySelector('td[data-id="'+(ref&&ref.id)+'"][data-k="tag"]'); if(t){ t.scrollIntoView({block:'center'}); t.click(); } }, 500);
  }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
}
function eeDupliquer(id, toutes){
  var src = eeDocParId(id); if(!src) return;
  var copie = Object.assign({}, src);
  delete copie.id;
  copie.ordre = eeProchainOrdre(toutes); copie.sr = eeProchainSr(toutes);
  copie.tag = src.tag ? src.tag + ' (copie)' : src.tag;
  copie.createdAt = nowISO(); copie.creePar = currentUserName(); copie.updatedAt = null;
  STATE.db.collection('etudeConsommateurs').add(copie).then(function(ref){
    EE_UI.flash = ref && ref.id; toast('Ligne dupliquée', 'success'); eeRafraichir();
  }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
}
function eeSupprimer(ids){
  ids = ids.filter(Boolean); if(!ids.length) return;
  confirmDialog('Supprimer définitivement '+(ids.length === 1 ? 'cette ligne' : ids.length+' lignes')+' de la base de données ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
    if(!ok) return;
    var chaine = Promise.resolve();
    ids.forEach(function(id){ chaine = chaine.then(function(){ return deleteDoc('etudeConsommateurs', id); }); });
    chaine.then(function(){ EE_UI.selection = {}; toast(ids.length === 1 ? 'Ligne supprimée' : ids.length+' lignes supprimées', 'success'); eeRafraichir(); })
      .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); eeRafraichir(); });
  });
}

/* ---------- listes deroulantes ---------- */
function eeAjouterValeurListe(liste, valeur){
  if(liste === EE_LISTE_PROJET && EE_UI.projetId){
    var pid = EE_UI.projetId;
    return eeCreerListeProjet(pid).then(function(){ return eeAjouterValeurListe0(eeNomListeProjet(liste, pid), valeur); });
  }
  return eeAjouterValeurListe0(liste, valeur);
}
function eeAjouterValeurListe0(liste, valeur){
  var existantes = (STATE.etudeListes||[]).filter(function(v){ return v.liste === liste; });
  if(existantes.some(function(v){ return String(v.valeur) === String(valeur); })) return Promise.resolve();
  var rang = existantes.reduce(function(m, v){ return Math.max(m, v.rang||0); }, 0) + 1;
  return STATE.db.collection('etudeListes').add({liste: liste, valeur: String(valeur), rang: rang, createdAt: nowISO()});
}
function eePromptValeurListe(liste, cb){
  var ov = openModal({
    title: 'Nouvelle valeur — '+(EE_LISTES_TITRES[liste]||liste),
    body: '<div class="field"><label for="eenv-val">Valeur à ajouter à la liste</label><input id="eenv-val" autofocus></div>',
    foot: '<button type="button" class="btn" data-annuler>Annuler</button><button type="button" class="btn btn-primary" id="eenv-ok">Ajouter</button>'
  });
  ov.querySelector('[data-annuler]').addEventListener('click', function(){ closeModal(); cb(null); });
  function ok(){
    var v = byId('eenv-val').value.trim();
    if(!v){ toast('Saisissez une valeur', 'danger'); return; }
    eeAjouterValeurListe(liste, v).then(function(){ closeModal(); cb(v); }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  }
  byId('eenv-ok').addEventListener('click', ok);
  byId('eenv-val').addEventListener('keydown', function(e){ if(e.key === 'Enter') ok(); });
}
function eeOpenListes(){
  if(EE_UI.projetId && !eeListeProjetExiste(EE_UI.projetId)){      /* copie des valeurs par defaut pour ce projet, puis ouverture */
    eeCreerListeProjet(EE_UI.projetId).then(function(){ setTimeout(eeOpenListes0, 2300); }).catch(function(e){ console.error(e); eeOpenListes0(); });
    return;
  }
  eeOpenListes0();
}
function eeOpenListes0(){
  function corps(){
    var listes = eeListes();
    return Object.keys(EE_LISTES_TITRES).map(function(k){
      var docs = (STATE.etudeListes||[]).filter(function(v){ return v.liste === eeNomListeProjet(k, EE_UI.projetId); }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); });
      return '<div class="field" style="margin-bottom:14px;"><label><b>'+esc(EE_LISTES_TITRES[k])+'</b>'+(k === EE_LISTE_PROJET ? ' <span class="muted">— propre à ce projet</span>' : '')+' <span class="muted">('+docs.length+' valeur(s))</span></label>'+
        '<div>'+(docs.length ? docs.map(function(v){
          return '<span class="ee-liste-chip">'+esc(v.valeur)+'<button type="button" class="iconbtn eel-del" data-id="'+v.id+'" title="Retirer de la liste">'+ic('x',11)+'</button></span>';
        }).join('') : '<span class="muted">Liste vide</span>')+'</div>'+
        '<div style="display:flex;gap:8px;margin-top:6px;"><input class="eel-new" data-l="'+k+'" placeholder="Nouvelle valeur" style="max-width:240px;"><button type="button" class="btn eel-add" data-l="'+k+'">Ajouter</button></div></div>';
    }).join('');
  }
  var ov = openModal({
    title: 'Listes déroulantes de l’étude électrique', large: true,
    body: '<p class="hint">Valeurs proposées dans les cellules à liste. Retirer une valeur ne modifie pas les lignes qui l’utilisent déjà (elles s’affichent alors en orange, « hors liste »).</p><div id="eel-corps">'+corps()+'</div>',
    foot: '<button type="button" class="btn btn-primary" data-close-modal>Fermer</button>'
  });
  function lier(){
    ov.querySelectorAll('.eel-del').forEach(function(b){ b.addEventListener('click', function(){
      deleteDoc('etudeListes', b.getAttribute('data-id')).then(function(){ setTimeout(rafraichir, 500); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    }); });
    ov.querySelectorAll('.eel-add').forEach(function(b){ b.addEventListener('click', function(){
      var l = b.getAttribute('data-l'), inp = ov.querySelector('.eel-new[data-l="'+l+'"]');
      var v = inp.value.trim(); if(!v) return;
      eeAjouterValeurListe(l, v).then(function(){ setTimeout(rafraichir, 500); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    }); });
    ov.querySelectorAll('.eel-new').forEach(function(inp){ inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ ov.querySelector('.eel-add[data-l="'+inp.getAttribute('data-l')+'"]').click(); } }); });
  }
  function rafraichir(){ var z = byId('eel-corps'); if(z){ z.innerHTML = corps(); lier(); } }
  lier();
}

/* ---------- export Excel (formules + listes deroulantes) ---------- */
function eeSpecExport(projet, lignes, modeVide){
  return {
    filename: 'Etude_electrique_'+(projet ? projetNumeroDe(projet) || projet.numero : '')+'_'+todayISO().replace(/-/g,'')+'.xlsx',
    columns: EE_COLS.map(function(c){
      return {key:c.key, title:c.title, nature:c.nature, list:c.list||null, number:!!c.num, formula:c.xl||null, width:Math.round(c.w/6.5),
              fmt: (c.num && !c.list && c.nature==='Formule') ? '0.000' : null};
    }),
    rows: modeVide ? [] : lignes.map(function(d){
      var v = {}; EE_COLS.forEach(function(c){ v[c.key] = (d[c.key]===undefined) ? null : d[c.key]; });
      return {v: v, forces: d.forces || {}};
    }),
    lists: (function(){ var l = eeListes(); delete l.typeCable; return l; })(),
    meta: {type:'etude_electrique', projet: projet ? (projet.numero||'') : '', version: (window.APP_VERSION||'')}
  };
}
function eeOpenExport(projet, toutes, affichees){
  var ov = openModal({
    title: 'Exporter la base de données vers Excel',
    body:
      '<p class="hint" style="margin-bottom:12px;">Le classeur contient les <b>vraies formules</b> Excel dans les colonnes « Formule » (sauf les valeurs imposées à la main, teintées en jaune) et des <b>listes déroulantes</b> dans les colonnes « Liste ». Il garde la forme du modèle (ligne 1 : nature, ligne 2 : titres), il peut être corrigé puis réimporté.</p>'+
      '<div class="field"><label>Contenu</label>'+
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="eex-mode" value="tous" checked style="width:auto;"> Toutes les lignes ('+toutes.length+')</label>'+
        (affichees.length !== toutes.length ? '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="eex-mode" value="affichees" style="width:auto;"> Lignes affichées avec le filtre actuel ('+affichees.length+')</label>' : '')+
        '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="eex-mode" value="vide" style="width:auto;"> Modèle vide (titres, formules et listes, pour saisir de nouvelles lignes)</label></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="eex-go">'+ic('download',15)+' Générer le fichier</button>'
  });
  byId('eex-go').addEventListener('click', function(){
    var mode = ov.querySelector('input[name="eex-mode"]:checked').value;
    var src = mode === 'vide' ? [] : (mode === 'affichees' ? affichees : toutes);
    // en mode vide, quelques lignes de formules deja posees seraient utiles : on laisse les lignes vierges pre-validees (listes), sans formules
    var spec = eeSpecExport(projet, src, mode === 'vide');
    toast('Génération du fichier Excel…');
    fetch('/api/etude-elec/export', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec)})
      .then(function(r){
        if(!r.ok) return r.text().then(function(t){ var j=null; try{ j=JSON.parse(t); }catch(e){} throw new Error((j&&j.error)||('Erreur HTTP '+r.status)); });
        return r.blob();
      }).then(function(blob){
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = spec.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
        closeModal(); toast('Fichier Excel généré', 'success');
      }).catch(function(e){ console.error(e); toast('Export impossible : '+e.message, 'danger'); });
  });
}

/* ---------- import Excel avec correspondance des colonnes ---------- */
var EE_SYNONYMES = {
  sr:['sr','n','no','num','numero','item'], rev:['rev','revision','indice rev'],
  switchgear:['switchgear mcc','switchgear','mcc','tableau','armoire','depart'], systemArea:['system area','system','area','zone','systeme'],
  tag:['equipment tag no','equipment tag','tag no','tag','repere','code equipement'],
  nom:['equipment name','designation','description','libelle','nom'],
  puissanceKw:['installed power kw','installed power','puissance installee kw','puissance kw','pn kw','p kw'],
  puissanceAbsorbee:['absorbed power','puissance absorbee','pabs'], tension:['voltage v','voltage','tension','tension v','u v'],
  phaseFreq:['phase freq hz','phase freq','phase','polarite'], specialReqts:['depart type','special reqts','special requirements','demarrage','mode de demarrage'],
  ws:['w s','ws','working standby'], ci:['c i','ci','continu intermittent'], eNe:['e ne','ene','essential','secours'],
  pctE:['e','pct e','pourcentage e'], remarks:['remarks','remarque','remarques','commentaire','observations'],
  puissanceApparente:['puissance apparente kva','puissance apparente','kva','s kva'], puissanceInstallee:['puissance installee'],
  unite:['unite','unit'], courant:['courant installe','courant','in a','courant a'], typeConso:['type','type conso','type de charge'],
  vitesse:['vitesse','speed'], contenu:['contenu','cable','composition'], nombre:['nombre','nb','qte','quantite'],
  cosPhi:['cos phi','cos','cosphi'], rend:['rend','rendement','eta'], pVfd:['p vfd'], cosPhiVfd:['cos phi vfd'], rendVfd:['rend vfd'],
  kUtil:['k util','ku','kutil','coef utilisation'], kSimul:['k simul','ks','ksimul','coef simultaneite'],
  pActive:['puissance active kw','puissance active','p active'], pReactive:['puissance reactive kvar','puissance reactive','q kvar'],
  longueur:['longueur','length','long m'], modePose:['mode de pose','pose'],
  pActiveFoisonnee:['puissance active foisonee kw','puissance active foisonnee kw','puissance active foisonnee','puissance active foisonee'],
  pReactiveFoisonnee:['puissance reactive foisonee kvar','puissance reactive foisonnee kvar','puissance reactive foisonnee','puissance reactive foisonee']
};
function eeNorm(s){
  return String(s===null||s===undefined?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
var EE_IMP = null;

function eeOpenImport(projet){
  EE_IMP = {projetId: projet.id, table: null, mapping: {}, options: {forcer:true, ajouterListes:true, miseAJour:true}, file: null};
  openModal({
    title: 'Importer la base de données depuis un fichier Excel', large: true,
    body: '<div id="eei-corps"></div>', foot: false
  });
  eeImportEcranFichier();
}
function eeImportEcranFichier(){
  var zone = byId('eei-corps');
  zone.innerHTML =
    '<p class="hint" style="margin-bottom:12px;">Sélectionnez un classeur .xlsx (modèle « Liste des consommateurs » ou export de cette application). À l’étape suivante, vous indiquerez pour chaque colonne de l’application la colonne du fichier qui lui correspond. Rien n’est enregistré avant la validation finale.</p>'+
    '<div class="field"><label for="eei-projet">Importer dans</label><select id="eei-projet">'+projetsOptionsHtml(EE_IMP.projetId, null, '', true)+'</select></div>'+
    '<div class="field"><label for="eei-file">Fichier Excel</label><input type="file" id="eei-file" accept=".xlsx"></div>'+
    '<div id="eei-msg" class="hint"></div>';
  byId('eei-projet').addEventListener('change', function(e){ EE_IMP.projetId = e.target.value; });
  byId('eei-file').addEventListener('change', function(e){
    var f = e.target.files[0]; if(!f) return;
    EE_IMP.file = f;
    byId('eei-msg').textContent = 'Lecture du fichier…';
    eeImportChargerTable('', 0, true);
  });
}
function eeImportChargerTable(sheet, headerRow, premier){
  var fd = new FormData(); fd.append('file', EE_IMP.file);
  if(sheet) fd.append('sheet', sheet);
  if(headerRow) fd.append('headerRow', String(headerRow));
  fetch('/api/etude-elec/table', {method:'POST', body: fd}).then(function(r){
    return r.text().then(function(t){ var j=null; try{ j = t ? JSON.parse(t) : null; }catch(e){} if(!r.ok) throw new Error((j&&j.error)||('Erreur HTTP '+r.status)); return j; });
  }).then(function(t){
    EE_IMP.table = t;
    EE_IMP.mapping = eeProposerCorrespondance(t);
    eeImportEcranColonnes();
  }).catch(function(e){ console.error(e); var m = byId('eei-msg'); if(m) m.textContent = ''; toast(e.message || 'Lecture impossible', 'danger'); });
}
function eeProposerCorrespondance(t){
  var utilise = {}, m = {};
  var normes = t.columns.map(function(c){ return eeNorm(c.name); });
  // 1re passe : titre identique ; 2e passe : synonymes
  EE_COLS.forEach(function(c){
    var i = normes.indexOf(eeNorm(c.title));
    if(i >= 0 && !utilise[i]){ m[c.key] = i; utilise[i] = true; }
  });
  EE_COLS.forEach(function(c){
    if(m[c.key] !== undefined) return;
    var syn = EE_SYNONYMES[c.key] || [];
    for(var s = 0; s < syn.length; s++){
      var i = normes.indexOf(syn[s]);
      if(i >= 0 && !utilise[i]){ m[c.key] = i; utilise[i] = true; return; }
    }
    m[c.key] = '';
  });
  return m;
}
function eeImportEcranColonnes(){
  var t = EE_IMP.table, zone = byId('eei-corps');
  function optsCol(sel){
    return '<option value="">— Ne pas importer —</option>'+t.columns.map(function(c, i){
      return '<option value="'+i+'"'+(sel === i ? ' selected':'')+'>'+esc(c.letter+' — '+c.name)+'</option>';
    }).join('');
  }
  function ligne(c){
    var idx = EE_IMP.mapping[c.key];
    var ap = (idx === '' || idx === undefined) ? '' : t.rows.slice(0, 3).map(function(r){ return esc(r[idx]); }).filter(Boolean).join(' · ');
    return '<tr><td><span class="ee-nat ee-nat-'+c.nature+'" style="display:inline;margin-right:6px;">'+c.nature+'</span><b>'+esc(c.title)+'</b></td>'+
      '<td><select class="eei-sel" data-k="'+c.key+'">'+optsCol(idx)+'</select></td><td class="muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+ap+'</td></tr>';
  }
  var saisies = EE_COLS.filter(function(c){ return c.nature !== 'Formule'; });
  var formules = EE_COLS.filter(function(c){ return c.nature === 'Formule'; });
  zone.innerHTML =
    '<p class="hint">Feuille « '+esc(t.sheet)+' » : <b>'+t.rows.length+'</b> ligne(s), <b>'+t.columns.length+'</b> colonne(s), titres en ligne '+t.headerRow+(t.truncated?' — <b>fichier tronqué</b>':'')+'.</p>'+
    '<div class="field-row grid-2">'+
      '<div class="field"><label for="eei-hdr">Ligne des titres</label><div style="display:flex;gap:8px;"><input type="number" min="1" id="eei-hdr" value="'+t.headerRow+'" style="width:90px;"><button type="button" class="btn" id="eei-hdr-go">Relire</button></div></div>'+
      (t.sheets.length > 1 ? '<div class="field"><label for="eei-sheet">Feuille</label><select id="eei-sheet">'+t.sheets.map(function(n){ return '<option value="'+esc(n)+'"'+(n===t.sheet?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select></div>' : '')+
    '</div>'+
    '<div class="table-wrap" style="max-height:44vh;overflow:auto;"><table class="ee-map" style="width:100%;border-collapse:collapse;"><thead><tr><th>Colonne de l’application</th><th>Colonne du fichier</th><th>Aperçu</th></tr></thead><tbody>'+
      saisies.map(ligne).join('')+
      '<tr><td colspan="3" class="muted" style="font-size:12px;background:var(--surface-2,#f1f3f5);">Colonnes calculées : recalculées par l’application. Si vous les faites correspondre à une colonne, une valeur différente du calcul est conservée comme valeur imposée.</td></tr>'+
      formules.map(ligne).join('')+
    '</tbody></table></div>'+
    '<div class="field" style="margin-top:12px;">'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="checkbox" id="eei-maj" style="width:auto;"'+(EE_IMP.options.miseAJour?' checked':'')+'> Mettre à jour les lignes déjà présentes (même « Equipment Tag No. » dans ce contrat / devis) au lieu de les ajouter en double</label>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="checkbox" id="eei-forcer" style="width:auto;"'+(EE_IMP.options.forcer?' checked':'')+'> Conserver comme valeurs imposées les valeurs calculées du fichier qui diffèrent de la formule</label>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="checkbox" id="eei-listes" style="width:auto;"'+(EE_IMP.options.ajouterListes?' checked':'')+'> Ajouter automatiquement aux listes déroulantes les valeurs du fichier qui n’y figurent pas</label>'+
    '</div>'+
    '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;"><button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="eei-next">Continuer</button></div>';
  zone.querySelectorAll('[data-close-modal]').forEach(function(b){ b.addEventListener('click', closeModal); });
  zone.querySelectorAll('.eei-sel').forEach(function(sel){
    sel.addEventListener('change', function(){
      EE_IMP.mapping[sel.getAttribute('data-k')] = sel.value === '' ? '' : parseInt(sel.value, 10);
      eeImportLireOptions(); eeImportEcranColonnes();
    });
  });
  var sh = byId('eei-sheet'); if(sh) sh.addEventListener('change', function(){ eeImportChargerTable(sh.value, 0, false); });
  byId('eei-hdr-go').addEventListener('click', function(){ eeImportChargerTable(t.sheet, parseInt(byId('eei-hdr').value, 10) || 0, false); });
  byId('eei-next').addEventListener('click', function(){
    eeImportLireOptions();
    if(EE_IMP.mapping.tag === '' && EE_IMP.mapping.nom === ''){ toast('Faites correspondre au moins « Equipment Tag No. » ou « Equipment Name »', 'danger'); return; }
    eeImportEcranValidation();
  });
}
function eeImportLireOptions(){
  var m = byId('eei-maj'), f = byId('eei-forcer'), l = byId('eei-listes');
  if(m) EE_IMP.options.miseAJour = m.checked;
  if(f) EE_IMP.options.forcer = f.checked;
  if(l) EE_IMP.options.ajouterListes = l.checked;
}

// Construit, pour chaque ligne du fichier, le document a enregistrer. Fonction pure (testable) :
// colonnes = EE_COLS, mapping {cle -> index de colonne}, rows = lignes du fichier, options.
function eeConstruireLignes(rows, mapping, options, listes){
  var res = [];
  rows.forEach(function(r, n){
    var d = {}, forces = {}, cache = {};
    EE_COLS.forEach(function(c){
      var idx = mapping[c.key];
      if(idx === '' || idx === undefined) return;
      var brut = String(r[idx] === undefined ? '' : r[idx]).trim();
      if(c.nature === 'Formule'){
        var num = eeParseNum(brut);
        if(num !== null && !isNaN(num)) cache[c.key] = num;
        return;
      }
      if(c.list && (brut === '0')) brut = '';
      if(c.num){
        var v = eeParseNum(brut);
        d[c.key] = (v === null || isNaN(v)) ? null : v;
      } else {
        d[c.key] = brut === '' ? null : brut;
      }
    });
    // valeurs calculees du fichier qui different du calcul -> valeurs imposees
    if(options.forcer){
      EE_ORDRE_CALCUL.forEach(function(k){
        if(cache[k] === undefined) return;
        var calc = eeCalculer(Object.assign({}, d, {forces: forces}));
        var a = calc[k], b = cache[k];
        var pareil = a !== null && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b));
        if(!pareil){ d[k] = b; forces[k] = true; }
      });
    }
    d.forces = forces;
    Object.assign(d, eeCompleter(d));
    if(!d.tag && !d.nom) return;      // ligne vide ou de pied de tableau
    d._ligneFichier = n;
    res.push(d);
  });
  return res;
}
function eeImportEcranValidation(){
  var t = EE_IMP.table, zone = byId('eei-corps'), projet = projetParId(EE_IMP.projetId);
  var listes = eeListes();
  var docs = eeConstruireLignes(t.rows, EE_IMP.mapping, EE_IMP.options, listes);
  var existantes = eeLignesDuProjet(EE_IMP.projetId);
  var parTag = {}; existantes.forEach(function(d){ if(d.tag) parTag[eeNorm(d.tag)] = d; });
  var ajouts = 0, maj = 0, vus = {};
  docs.forEach(function(d){
    var cle = d.tag ? eeNorm(d.tag) : '';
    if(EE_IMP.options.miseAJour && cle && parTag[cle] && !vus[cle]){ d._existant = parTag[cle]; maj++; vus[cle] = true; }
    else { ajouts++; }
  });
  // valeurs de liste absentes
  var nouvelles = {};
  docs.forEach(function(d){
    EE_COLS.forEach(function(c){
      if(!c.list) return;
      var v = d[c.key]; if(v === null || v === undefined || v === '') return;
      var s = eeFmt(v);
      if(listes[c.list].indexOf(s) < 0){ (nouvelles[c.list] = nouvelles[c.list] || {})[s] = true; }
    });
  });
  var nbForces = docs.filter(function(d){ return Object.keys(d.forces||{}).length; }).length;
  var ignorees = t.rows.length - docs.length;
  zone.innerHTML =
    '<p><b>'+docs.length+'</b> consommateur(s) à importer dans <b>'+esc(projet ? projetLibelle(projet) : '')+'</b> : <b>'+ajouts+'</b> ajout(s), <b>'+maj+'</b> mise(s) à jour.</p>'+
    '<ul style="margin:8px 0 12px 18px;">'+
      (ignorees ? '<li>'+ignorees+' ligne(s) du fichier ignorée(s) (ni tag ni désignation).</li>' : '')+
      (nbForces ? '<li>'+nbForces+' ligne(s) avec au moins une valeur calculée imposée (différente de la formule).</li>' : '')+
      (Object.keys(nouvelles).length ? '<li>Valeurs absentes des listes : '+Object.keys(nouvelles).map(function(l){ return esc(EE_LISTES_TITRES[l])+' → '+Object.keys(nouvelles[l]).map(esc).join(', '); }).join(' ; ')+
        (EE_IMP.options.ajouterListes ? ' (elles seront ajoutées aux listes).' : ' (elles seront importées, affichées « hors liste »).')+'</li>' : '')+
    '</ul>'+
    '<div id="eei-progress" class="hint"></div>'+
    '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;"><button type="button" class="btn" id="eei-back">Retour</button><button type="button" class="btn btn-primary" id="eei-go"'+(docs.length?'':' disabled')+'>Importer</button></div>';
  byId('eei-back').addEventListener('click', eeImportEcranColonnes);
  byId('eei-go').addEventListener('click', function(){ eeImportExecuter(docs, nouvelles, projet); });
}
function eeImportExecuter(docs, nouvelles, projet){
  var btn = byId('eei-go'); btn.disabled = true; byId('eei-back').disabled = true;
  var prog = byId('eei-progress');
  var base = eeLignesDuProjet(projet.id);
  var ordre = eeProchainOrdre(base);
  var lien = Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null});
  var chaine = Promise.resolve(), faits = 0, erreurs = 0, ajoutes = 0, majs = 0;
  if(EE_IMP.options.ajouterListes){
    Object.keys(nouvelles).forEach(function(l){ Object.keys(nouvelles[l]).forEach(function(v){ chaine = chaine.then(function(){ return eeAjouterValeurListe(l, v); }); }); });
  }
  docs.forEach(function(d){
    chaine = chaine.then(function(){
      var ex = d._existant;
      var data = Object.assign({}, d); delete data._existant; delete data._ligneFichier;
      var p;
      if(ex){
        // les colonnes non reliees au fichier gardent leur valeur ; les valeurs imposees du fichier remplacent celles de la ligne
        var champsImportes = {};
        EE_COLS.forEach(function(c){ var idx = EE_IMP.mapping[c.key]; if(idx !== '' && idx !== undefined) champsImportes[c.key] = true; });
        var forces = Object.assign({}, ex.forces || {});
        EE_COLS.forEach(function(c){ if(c.nature === 'Formule' && champsImportes[c.key]) delete forces[c.key]; });
        Object.keys(data.forces || {}).forEach(function(k){ forces[k] = true; });
        var patch = {forces: forces, updatedAt: nowISO()};
        EE_COLS.forEach(function(c){
          if(champsImportes[c.key] || c.nature === 'Formule') patch[c.key] = (data[c.key] === undefined ? null : data[c.key]);
        });
        var fusion = Object.assign({}, ex, patch);
        Object.assign(patch, eeCompleter(fusion));
        p = STATE.db.doc('etudeConsommateurs/'+ex.id).update(patch).then(function(){ majs++; });
      } else {
        data = Object.assign(data, lien, {ordre: ordre++, createdAt: nowISO(), creePar: currentUserName()});
        if(!data.sr) data.sr = String(ordre - 1);
        p = STATE.db.collection('etudeConsommateurs').add(data).then(function(){ ajoutes++; });
      }
      return p.then(function(){ faits++; if(faits % 10 === 0 || faits === docs.length) prog.textContent = faits+' / '+docs.length+' ligne(s) enregistrée(s)…'; })
        .catch(function(e){ console.error(e); erreurs++; });
    });
  });
  chaine.then(function(){
    closeModal();
    toast('Import terminé : '+ajoutes+' ajout(s), '+majs+' mise(s) à jour'+(erreurs ? ', '+erreurs+' erreur(s)' : ''), erreurs ? 'danger' : 'success');
    EE_UI.projetId = projet.id; eeRafraichir();
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {EE_COLS: EE_COLS, eeCalculer: eeCalculer, eeCompleter: eeCompleter, eeConstruireLignes: eeConstruireLignes,
    eeProposerCorrespondance: eeProposerCorrespondance, eeParseNum: eeParseNum, eeNorm: eeNorm};
}
