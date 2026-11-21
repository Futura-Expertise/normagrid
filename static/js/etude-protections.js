/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.12) - Base materiel > Protections BT.
   Charge APRES etude-materiel.js (utilise EMT_UI, EMT_CATS, emtStyleOnce, eeStyleOnce, toast, openModal...).

   Disjoncteurs et declencheurs ORGANISES PAR CONSTRUCTEUR puis PAR CATEGORIE (Disj. Boitier moule, Disj. Ouvert, Disjonct. B / C / D / Mot / +Th, Fusible gG...): on choisit d'abord le constructeur, puis la categorie ; la liste complete n'est jamais affichee. Consultation + IMPORT Excel uniquement (aucune
   saisie manuelle, aucune valeur dans le code) : le fichier d'import contient 5 feuilles (Constructeurs,
   Disjoncteurs, Declencheurs, Associations, Reglages). L'import est fait par le serveur en un seul lot
   (POST /api/etude-elec/protections/import) : apercu d'abord, puis fusion ou remplacement par constructeur.
   Collections : etudeMatConstructeurs, etudeMatDisj, etudeMatDecl, etudeMatAssoc, etudeMatReglages.
   ========================================================= */

var EPR_UI = {constructeur:'', categorie:'', onglet:'disj', gamme:'', q:''};
var EPR_ONGLETS = [['disj', 'Disjoncteurs'], ['decl', 'Déclencheurs'], ['assoc', 'Associations'], ['regl', 'Réglages'], ['cons', 'Constructeurs']];
// ordre d'affichage des categories (celles de la liste de choix des logiciels de calcul) ; les autres suivent par ordre alphabetique
var EPR_CAT_ORDRE = ['Disj. Boîtier moulé', 'Disj. Ouvert', 'Disjonct. C', 'Disjonct. B', 'Disjonct. D', 'Disjonct. K', 'Disjonct. Z', 'Disjonct. Mot', 'Disjonct. +Th', 'Disjonct. différentiel', 'Interrupt. sectionneur', 'Interrupt. différentiel', 'Interrupt. à fusibles', 'Fusible gG'];
var EPR_MAX = 1000;     // lignes affichees au maximum (le filtre et la recherche restent exacts)

function eprFmt(v, dec){
  if(v === null || v === undefined || v === '') return '';
  if(typeof v === 'number') return isFinite(v) ? Number(v).toLocaleString('fr-FR', {maximumFractionDigits: dec === undefined ? 3 : dec, useGrouping:false}) : '';
  return String(v);
}
function eprConstructeurs(){
  return (STATE.etudeMatConstructeurs||[]).slice().sort(function(a,b){ return (a.rang||0)-(b.rang||0) || String(a.code).localeCompare(String(b.code)); });
}
/* categories presentes pour un constructeur, dans l'ordre de EPR_CAT_ORDRE */
function eprCategories(cons){
  var vues = {};
  (STATE.etudeMatDisj||[]).forEach(function(d){ if(d.constructeur === cons && d.categorie) vues[d.categorie] = (vues[d.categorie]||0) + 1; });
  var noms = Object.keys(vues).sort(function(a,b){
    var ia = EPR_CAT_ORDRE.indexOf(a), ib = EPR_CAT_ORDRE.indexOf(b);
    if(ia < 0) ia = 999; if(ib < 0) ib = 999;
    return ia - ib || a.localeCompare(b);
  });
  return noms.map(function(n){ return {nom: n, nb: vues[n]}; });
}
/* disjoncteurs du constructeur et de la categorie choisis */
function eprDisjChoisis(){
  return (STATE.etudeMatDisj||[]).filter(function(d){ return d.constructeur === EPR_UI.constructeur && d.categorie === EPR_UI.categorie; });
}
function eprGammesChoisies(){
  var g = {}; eprDisjChoisis().forEach(function(d){ g[d.gamme] = true; }); return g;
}
function eprAssocChoisies(){
  var g = eprGammesChoisies();
  return (STATE.etudeMatAssoc||[]).filter(function(a){ return a.constructeur === EPR_UI.constructeur && g[a.gamme]; });
}
function eprColonnes(onglet){
  if(onglet === 'disj') return [
    {k:'gamme', t:'Gamme'}, {k:'variante', t:'Variante'},
    {k:'calibre', t:'Calibre (A)'}, {k:'courbe', t:'Courbe'}, {k:'icuKa', t:'Icu 415 V (kA)', n:1, dec:1}, {k:'icuOrigine', t:'Origine Icu'},
    {k:'icnKa', t:'Icn (kA)', n:1, dec:1}, {k:'icsPct', t:'Ics (% Icu)', n:1, dec:0}, {k:'imMin', t:'Im min (× In)', n:1, dec:1}, {k:'imMax', t:'Im max (× In)', n:1, dec:1},
    {k:'normes', t:'Normes'}, {k:'statut', t:'Statut'}];
  if(onglet === 'decl') return [{k:'code', t:'Référence'}, {k:'serie', t:'Série'}, {k:'famille', t:'Famille'}, {k:'calibreA', t:'In (A)', n:1, dec:1}, {k:'irMinA', t:'Ir min (A)', n:1, dec:1}, {k:'irMaxA', t:'Ir max (A)', n:1, dec:1}, {k:'imMinA', t:'Im min (A)', n:1, dec:0}, {k:'imMaxA', t:'Im max (A)', n:1, dec:0}, {k:'type', t:'Type'}, {k:'protections', t:'Protections'}, {k:'statut', t:'Statut'}];
  if(onglet === 'assoc') return [{k:'gamme', t:'Gamme de disjoncteurs'}, {k:'declencheur', t:'Déclencheur'}, {k:'calibres', t:'Calibres (A)'}, {k:'note', t:'Note'}];
  if(onglet === 'regl') return [
    {k:'declencheur', t:'Déclencheur'}, {k:'fonction', t:'Fonction'}, {k:'parametre', t:'Paramètre'}, {k:'unite', t:'Unité'},
    {k:'crans', t:'Crans de réglage'}, {k:'nbCrans', t:'Nb crans', n:1, dec:0}, {k:'cranMin', t:'Min'}, {k:'cranMax', t:'Max'}, {k:'reglable', t:'Réglable'}, {k:'remarque', t:'Remarque'}, {k:'statut', t:'Statut'}];
  return [{k:'code', t:'Code'}, {k:'nom', t:'Nom'}, {k:'siteWeb', t:'Site web'}, {k:'_nc', t:'Catégories', n:1, dec:0}, {k:'_nb', t:'Lignes de disjoncteurs', n:1, dec:0}, {k:'_nd', t:'Déclencheurs', n:1, dec:0}];
}
function eprLignes(onglet){
  if(onglet === 'cons'){
    return eprConstructeurs().map(function(c){
      return Object.assign({}, c, {
        _nc: eprCategories(c.code).length,
        _nb: (STATE.etudeMatDisj||[]).filter(function(d){ return d.constructeur === c.code; }).length,
        _nd: (STATE.etudeMatDecl||[]).filter(function(d){ return d.constructeur === c.code; }).length});
    });
  }
  var l;
  if(onglet === 'disj'){
    l = eprDisjChoisis();
    if(EPR_UI.gamme) l = l.filter(function(d){ return d.gamme === EPR_UI.gamme; });
  } else if(onglet === 'assoc') l = eprAssocChoisies();
  else {
    var noms = {}; eprAssocChoisies().forEach(function(a){ noms[a.declencheur] = true; });
    if(onglet === 'decl') l = (STATE.etudeMatDecl||[]).filter(function(d){ return d.constructeur === EPR_UI.constructeur && noms[d.code]; });
    else l = (STATE.etudeMatReglages||[]).filter(function(d){ return d.constructeur === EPR_UI.constructeur && noms[d.declencheur]; });
  }
  if(EPR_UI.q){
    var q = EPR_UI.q.toLowerCase();
    l = l.filter(function(d){ return Object.keys(d).some(function(k){ return k !== 'id' && String(d[k] === null || d[k] === undefined ? '' : d[k]).toLowerCase().indexOf(q) >= 0; }); });
  }
  return l.sort(function(a,b){ return (a.rang||0)-(b.rang||0); });
}
function eprTable(onglet){
  var cols = eprColonnes(onglet), lignes = eprLignes(onglet), tot = lignes.length;
  if(tot > EPR_MAX) lignes = lignes.slice(0, EPR_MAX);
  var fic = (onglet === 'disj' || onglet === 'decl') && typeof emfBoutonFiche === 'function';
  var crb = fic && typeof ecvOuvrir === 'function';
  var h = '<div class="emt-wrap"><table class="emt-t"><thead><tr>'+(fic ? '<th title="Fiche technique de la référence">Fiche</th>' : '')+(crb ? '<th title="Courbe de déclenchement calculée à partir des réglages">Courbe</th>' : '')+cols.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('')+'</tr></thead><tbody>';
  lignes.forEach(function(d, li){
    h += '<tr'+(fic ? ' data-li="'+li+'"' : '')+'>'+(fic ? '<td class="c" style="text-align:center;">'+emfBoutonFiche(EPR_UI.constructeur, d, onglet)+'</td>' : '')+(crb ? '<td class="c" style="text-align:center;">'+((onglet === 'decl' ? !/^(vigi|mx|mn)/i.test(d.code||'') : (typeof emfGammeIntegree === 'function' && emfGammeIntegree(EPR_UI.constructeur, d.gamme) && d.imMin && d.imMax)) ? '<button type="button" class="btn btn-sm ecv-voir" title="Courbe de déclenchement" style="padding:0 6px;">'+ic('trend',13)+'</button>' : '<span style="color:#aab;">—</span>')+'</td>' : '')+cols.map(function(c){
      var v = d[c.k];
      var estEstime = (c.k === 'icuOrigine' && v === 'estimé');
      return '<td class="c'+(estEstime?' emt-warn':'')+'" style="'+(c.n?'text-align:right;':'text-align:left;')+'">'+esc(c.n ? eprFmt(v, c.dec) : (v === null || v === undefined ? '' : v))+'</td>';
    }).join('')+'</tr>';
  });
  if(!lignes.length) h += '<tr><td class="c" colspan="'+(cols.length+(fic?1:0)+(crb?1:0))+'" style="text-align:left;">'+(onglet === 'cons' ? 'Aucun constructeur. Utilisez « Importer Excel » (fichier « Protections BT »).' :
    (onglet === 'decl' || onglet === 'assoc' || onglet === 'regl') ? 'Aucun déclencheur pour cette catégorie (par exemple un fusible).' : 'Aucune ligne pour ce choix.')+'</td></tr>';
  h += '</tbody></table></div>';
  return {html: h, total: tot, affiche: lignes.length, lignes: lignes, onglet: onglet};
}
function renderEtudeProtections(mount, actions){
  eeStyleOnce(); emtStyleOnce();
  var canEdit = canWrite('etude_elec');
  var cons = eprConstructeurs();
  if(EPR_UI.constructeur && !cons.some(function(c){ return c.code === EPR_UI.constructeur; })) EPR_UI.constructeur = '';
  var cats = EPR_UI.constructeur ? eprCategories(EPR_UI.constructeur) : [];
  if(EPR_UI.categorie && !cats.some(function(c){ return c.nom === EPR_UI.categorie; })) EPR_UI.categorie = '';
  actions.innerHTML = '<button type="button" class="btn btn-primary" id="epr-imp"'+(canEdit?'':' disabled')+'>'+ic('upload',15)+' Importer Excel</button> <button type="button" class="btn" id="epr-fiches">'+ic('file',15)+' Fiches techniques</button> <button type="button" class="btn" id="epr-decoupe"'+(canEdit?'':' disabled')+'>'+ic('upload',15)+' Découper un PDF…</button>';
  var choisi = EPR_UI.onglet === 'cons' || (EPR_UI.constructeur && EPR_UI.categorie);
  var gammes = []; if(EPR_UI.onglet === 'disj' && choisi) eprDisjChoisis().forEach(function(d){ if(gammes.indexOf(d.gamme) < 0) gammes.push(d.gamme); });
  var t = choisi ? eprTable(EPR_UI.onglet) : null;
  var nbEst = (STATE.etudeMatDisj||[]).filter(function(d){ return d.icuOrigine === 'estimé'; }).length;
  var nbVer = [].concat(STATE.etudeMatDisj||[], STATE.etudeMatDecl||[], STATE.etudeMatReglages||[]).filter(function(d){ return /vérifier/i.test(d.statut||''); }).length;
  mount.innerHTML =
    '<div class="section-head"><div class="toolbar"><select id="emt-cat" title="Catégorie de matériel">'+EMT_CATS.map(function(c){ return '<option value="'+c.id+'"'+(EMT_UI.cat===c.id?' selected':'')+'>'+esc(c.label)+'</option>'; }).join('')+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Choisissez le <b>constructeur</b>, puis la <b>catégorie</b> de protection : la liste complète n’est pas affichée. '+
      'Les données sont <b>importées depuis Excel</b> (5 feuilles : Constructeurs, Disjoncteurs, Declencheurs, Associations, Reglages) ; elles ne sont pas modifiables ligne à ligne ici. '+
      (nbVer ? '<b>'+nbVer+'</b> ligne(s) portent le statut « à vérifier catalogue »'+(nbEst ? ' dont <b>'+nbEst+'</b> pouvoir(s) de coupure « estimé(s) »' : '')+' : à confirmer avant usage dans un calcul.' : '')+'</p>'+
    '<div class="toolbar" style="margin-bottom:8px;gap:10px;align-items:center;flex-wrap:wrap;"><label>Constructeur&nbsp;<select id="epr-cons"><option value="">— Choisir —</option>'+
      cons.map(function(c){ return '<option value="'+esc(c.code)+'"'+(EPR_UI.constructeur===c.code?' selected':'')+'>'+esc(c.nom || c.code)+'</option>'; }).join('')+'</select></label>'+
    '<label>Catégorie&nbsp;<select id="epr-categorie"'+(EPR_UI.constructeur?'':' disabled')+'><option value="">— Choisir —</option>'+
      cats.map(function(c){ return '<option value="'+esc(c.nom)+'"'+(EPR_UI.categorie===c.nom?' selected':'')+'>'+esc(c.nom)+'</option>'; }).join('')+'</select></label>'+
    (EPR_UI.onglet === 'disj' && choisi && gammes.length > 1 ? '<label>Gamme&nbsp;<select id="epr-gamme"><option value="">Toutes (de la catégorie)</option>'+gammes.map(function(g){ return '<option'+(EPR_UI.gamme===g?' selected':'')+'>'+esc(g)+'</option>'; }).join('')+'</select></label>' : '')+
    (EPR_UI.onglet !== 'cons' && choisi ? '<input type="search" id="epr-q" placeholder="Rechercher dans la catégorie…" value="'+esc(EPR_UI.q)+'" style="min-width:220px;">' : '')+
    (t ? '<span class="muted">'+t.total+' ligne(s)'+(t.affiche < t.total ? ' — '+t.affiche+' affichée(s), affinez avec le filtre ou la recherche' : '')+'</span>' : '')+'</div>'+
    '<div class="emt-tabs">'+EPR_ONGLETS.map(function(o){ return '<button type="button" class="emt-tab'+(EPR_UI.onglet===o[0]?' on':'')+'" data-o="'+o[0]+'">'+o[1]+'</button>'; }).join('')+'</div>'+
    (t ? t.html : '<p class="hint" style="padding:18px;border:1px dashed var(--border,#d0d5db);border-radius:8px;">'+(cons.length ? (EPR_UI.constructeur ? 'Choisissez maintenant une <b>catégorie</b> (Disj. Boîtier moulé, Disj. Ouvert, Disjonct. C, B, D, Mot, +Th, Fusible gG…).' : 'Choisissez d’abord un <b>constructeur</b>.') : 'Aucune donnée. Utilisez « Importer Excel » (fichier « Protections BT »).')+'</p>');
  byId('emt-cat').addEventListener('change', function(e){ EMT_UI.cat = e.target.value; scheduleRender(); });
  byId('epr-cons').addEventListener('change', function(e){ EPR_UI.constructeur = e.target.value; EPR_UI.categorie = ''; EPR_UI.gamme = ''; EPR_UI.q = ''; renderEtudeProtections(mount, actions); });
  byId('epr-categorie').addEventListener('change', function(e){ EPR_UI.categorie = e.target.value; EPR_UI.gamme = ''; EPR_UI.q = ''; renderEtudeProtections(mount, actions); });
  var g = byId('epr-gamme'); if(g) g.addEventListener('change', function(e){ EPR_UI.gamme = e.target.value; renderEtudeProtections(mount, actions); });
  var q = byId('epr-q');
  if(q) q.addEventListener('change', function(e){ EPR_UI.q = e.target.value.trim(); renderEtudeProtections(mount, actions); });
  mount.querySelectorAll('.emt-tab').forEach(function(b){ b.addEventListener('click', function(){ EPR_UI.onglet = b.getAttribute('data-o'); EPR_UI.q = ''; EPR_UI.gamme = ''; renderEtudeProtections(mount, actions); }); });
  mount.querySelectorAll('.emf-voir').forEach(function(b){ b.addEventListener('click', function(){
    var tr = b.closest('tr'), l = t && t.lignes[+tr.getAttribute('data-li')]; if(!l) return;
    emfVoir((t.onglet === 'decl' ? l.code : (l.gamme+' '+(l.courbe && l.courbe !== '—' ? l.courbe+' ' : '')+l.calibre+' A')), emfFichesLigne(EPR_UI.constructeur, l, t.onglet));
  }); });
  mount.querySelectorAll('.ecv-voir').forEach(function(b){ b.addEventListener('click', function(){
    var tr = b.closest('tr'), l = t && t.lignes[+tr.getAttribute('data-li')]; if(!l) return;
    if(t.onglet === 'decl') ecvOuvrir({constructeur: EPR_UI.constructeur, code: l.code}); else ecvOuvrir({constructeur: EPR_UI.constructeur, dj: l});
  }); });
  byId('epr-decoupe').addEventListener('click', function(){ if(typeof emfOuvrirDecoupage === 'function') emfOuvrirDecoupage(EPR_UI.constructeur); });
  byId('epr-imp').addEventListener('click', eprImporter);
  byId('epr-fiches').addEventListener('click', function(){ if(typeof emdOuvrirBiblio === 'function') emdOuvrirBiblio(EPR_UI.constructeur); });
}

/* ---------- import Excel : apercu puis application (par le serveur, en un seul lot) ---------- */
function eprImporter(){
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0]; if(!f) return;
    var fd = new FormData(); fd.append('file', f); fd.append('apercu', '1');
    toast('Lecture du fichier…');
    fetch('/api/etude-elec/protections/import', {method:'POST', body: fd})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP '+r.status)); return j; }); })
      .then(function(apercu){ eprConfirmer(f, apercu); })
      .catch(function(e){ console.error(e); toast('Import impossible : '+e.message, 'danger'); });
  });
  inp.click();
}
function eprConfirmer(fichier, a){
  var c = a.comptes || {};
  var avert = (a.avertissements||[]).length ? '<p class="hint" style="margin-top:10px;"><b>'+a.nbAvertissements+' avertissement(s)</b> (les lignes concernées sont ignorées) :</p><ul style="max-height:140px;overflow:auto;font-size:12px;margin:4px 0 0 18px;">'+
    a.avertissements.map(function(m){ return '<li>'+esc(m)+'</li>'; }).join('')+(a.nbAvertissements > a.avertissements.length ? '<li>…</li>' : '')+'</ul>' : '';
  var ov = openModal({
    title: 'Importer les protections BT',
    body: '<p>Constructeur(s) : <b>'+esc((a.constructeurs||[]).join(', ') || '—')+'</b>. Le fichier contient <b>'+(c.etudeMatDisj||0)+'</b> ligne(s) de disjoncteurs, <b>'+(c.etudeMatDecl||0)+'</b> déclencheur(s), <b>'+
      (c.etudeMatAssoc||0)+'</b> association(s) et <b>'+(c.etudeMatReglages||0)+'</b> réglage(s).</p>'+
      '<div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="epr-mode" value="fusion" checked style="width:auto;"> <span><b>Fusionner</b> : met à jour les lignes de même clé, ajoute les nouvelles, ne supprime rien</span></label>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="epr-mode" value="remplacer" style="width:auto;"> <span><b>Remplacer</b> : supprime d’abord les disjoncteurs, déclencheurs, associations et réglages des constructeurs du fichier (les autres constructeurs ne sont pas touchés)</span></label></div>'+avert,
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="epr-go">Importer</button>'
  });
  ov.querySelector('#epr-go').addEventListener('click', function(){
    var mode = (ov.querySelector('input[name="epr-mode"]:checked')||{}).value || 'fusion';
    closeModal();
    var fd = new FormData(); fd.append('file', fichier); fd.append('mode', mode);
    toast('Import en cours…');
    fetch('/api/etude-elec/protections/import', {method:'POST', body: fd})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP '+r.status)); return j; }); })
      .then(function(j){
        toast('Import terminé : '+j.ajoutes+' ajoutée(s), '+j.modifies+' mise(s) à jour'+(j.supprimes ? ', '+j.supprimes+' supprimée(s)' : ''), 'success');
        setTimeout(function(){ if(typeof scheduleRender === 'function') scheduleRender(); }, 600);
      })
      .catch(function(e){ console.error(e); toast('Import impossible : '+e.message, 'danger'); });
  });
}
