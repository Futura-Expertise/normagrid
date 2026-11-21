/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.13) - Base materiel > Cables BT (catalogue).
   Charge APRES etude-protections.js (utilise EMT_UI, EMT_CATS, emtStyleOnce, eeStyleOnce, toast, openModal...).

   Catalogue des cables (referentiel importe d'un classeur Excel : 01_Cables.xlsx). Plusieurs milliers de lignes : on
   choisit d'abord une FAMILLE de cables, puis on consulte ses cables (sections) ; la liste complete n'est jamais affichee.
   Le catalogue n'est pas dans STATE (trop volumineux pour le rafraichissement toutes les 2 s) : lecture a la demande par
   GET /api/etude-elec/cables/familles et /cables/famille?nom=..., import par POST /api/etude-elec/cables/import (un seul lot).
   ========================================================= */

var ECB_UI = {q:'', famille:'', ame:''};
var ECB_DATA = {familles:null, total:0, chargement:false, rows:null, rowsDe:''};
var ECB_COLS = [
  {k:'ref', t:'Réf.'}, {k:'sectionTxt', t:'Section (mm²)'}, {k:'sectionReduiteMm2', t:'Section réduite (mm²)', n:1, dec:1}, {k:'nbConducteurs', t:'Nb cond.', n:1, dec:0},
  {k:'ame', t:'Âme'}, {k:'isolant', t:'Isolant'}, {k:'tempMaxC', t:'T° max (°C)', n:1, dec:0}, {k:'tempCcMaxC', t:'T° cc max (°C)', n:1, dec:0},
  {k:'arme', t:'Armé', b:1}, {k:'enterrable', t:'Enterrable', b:1}, {k:'unV', t:'Un (V)', n:1, dec:0}, {k:'diametreMm', t:'Ø (mm)', n:1, dec:1}, {k:'poidsKgKm', t:'Poids (kg/km)', n:1, dec:0},
  {k:'pays', t:'Pays'}, {k:'kThermique', t:'k thermique', n:1, dec:0}, {k:'r20MohmM', t:'R 20 °C (mΩ/m)', n:1, dec:4}, {k:'rChaudMohmM', t:'R à chaud (mΩ/m)', n:1, dec:4},
  {k:'xMohmM', t:'X (mΩ/m)', n:1, dec:2}, {k:'autorise', t:'Autorisé', b:1}, {k:'statut', t:'Statut'}];

function ecbCharger(cb){
  if(ECB_DATA.chargement) return;
  ECB_DATA.chargement = true;
  fetch('/api/etude-elec/cables/familles').then(function(r){ return r.json(); })
    .then(function(j){ ECB_DATA.familles = j.familles || []; ECB_DATA.total = j.total || 0; ECB_DATA.chargement = false; cb(); })
    .catch(function(e){ console.error(e); ECB_DATA.chargement = false; ECB_DATA.familles = []; cb(); });
}
function ecbChargerFamille(nom, cb){
  fetch('/api/etude-elec/cables/famille?nom='+encodeURIComponent(nom)).then(function(r){ return r.json(); })
    .then(function(j){ ECB_DATA.rows = Array.isArray(j) ? j : []; ECB_DATA.rowsDe = nom; cb(); })
    .catch(function(e){ console.error(e); ECB_DATA.rows = []; ECB_DATA.rowsDe = nom; cb(); });
}
function ecbVal(c, v){
  if(v === null || v === undefined || v === '') return '';
  if(c.b) return Number(v) ? 'Oui' : 'Non';
  if(c.n) return Number(v).toLocaleString('fr-FR', {maximumFractionDigits: c.dec, useGrouping:false});
  return String(v);
}
function renderEtudeCables(mount, actions){
  eeStyleOnce(); emtStyleOnce();
  var canEdit = canWrite('etude_elec');
  actions.innerHTML = '<button type="button" class="btn btn-primary" id="ecb-imp"'+(canEdit?'':' disabled')+'>'+ic('upload',15)+' Importer Excel</button>';
  if(!ECB_DATA.familles){
    mount.innerHTML = '<p class="hint">Chargement du catalogue…</p>';
    ecbCharger(function(){ renderEtudeCables(mount, actions); });
    return;
  }
  var q = ECB_UI.q.toLowerCase();
  var fams = ECB_DATA.familles.filter(function(f){ return !q || f.famille.toLowerCase().indexOf(q) >= 0; });
  if(ECB_UI.famille && !ECB_DATA.familles.some(function(f){ return f.famille === ECB_UI.famille; })) ECB_UI.famille = '';
  var rows = null;
  if(ECB_UI.famille){
    if(ECB_DATA.rowsDe !== ECB_UI.famille || !ECB_DATA.rows){
      ecbChargerFamille(ECB_UI.famille, function(){ renderEtudeCables(mount, actions); });
    } else rows = ECB_DATA.rows;
  }
  var fiche = ECB_UI.famille ? ECB_DATA.familles.filter(function(f){ return f.famille === ECB_UI.famille; })[0] : null;
  var h = '<div class="section-head"><div class="toolbar"><select id="emt-cat" title="Catégorie de matériel">'+EMT_CATS.map(function(c){ return '<option value="'+c.id+'"'+(EMT_UI.cat===c.id?' selected':'')+'>'+esc(c.label)+'</option>'; }).join('')+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Catalogue des câbles BT (<b>'+ECB_DATA.total.toLocaleString('fr-FR')+'</b> câbles dans <b>'+ECB_DATA.familles.length+'</b> familles), importé depuis Excel. '+
    'Choisissez une <b>famille</b> pour voir ses câbles : la liste complète n’est pas affichée. Données non modifiables ligne à ligne ici.</p>'+
    '<div class="toolbar" style="margin-bottom:8px;gap:10px;align-items:center;flex-wrap:wrap;">'+
    '<input type="search" id="ecb-q" placeholder="Filtrer les familles (ex. U1000, RO2V, H07…)" value="'+esc(ECB_UI.q)+'" style="min-width:280px;">'+
    '<label>Famille&nbsp;<select id="ecb-fam"><option value="">— Choisir ('+fams.length+' famille'+(fams.length>1?'s':'')+') —</option>'+
      fams.map(function(f){ return '<option value="'+esc(f.famille)+'"'+(ECB_UI.famille===f.famille?' selected':'')+'>'+esc(f.famille)+' ('+f.nb+')</option>'; }).join('')+'</select></label>'+
    (fiche ? '<span class="muted">'+fiche.nb+' câble(s) — âme '+esc(fiche.ames || '—')+' — isolant '+esc(fiche.isolants || '—')+' — sections '+ecbVal({n:1,dec:1}, fiche.sectionMin)+' à '+ecbVal({n:1,dec:1}, fiche.sectionMax)+' mm²</span>' : '')+'</div>';
  if(!ECB_DATA.familles.length){
    h += '<p class="hint" style="padding:18px;border:1px dashed var(--border,#d0d5db);border-radius:8px;">Aucun câble. Utilisez « Importer Excel » (fichier « 01_Cables.xlsx »).</p>';
  } else if(!ECB_UI.famille){
    h += '<p class="hint" style="padding:18px;border:1px dashed var(--border,#d0d5db);border-radius:8px;">Choisissez une <b>famille</b> de câbles.</p>';
  } else if(!rows){
    h += '<p class="hint">Chargement des câbles de la famille…</p>';
  } else {
    h += '<div class="emt-wrap"><table class="emt-t"><thead><tr>'+ECB_COLS.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      rows.map(function(d){ return '<tr>'+ECB_COLS.map(function(c){ return '<td class="c" style="'+(c.n?'text-align:right;':'text-align:left;')+'">'+esc(ecbVal(c, d[c.k]))+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table></div>';
  }
  mount.innerHTML = h;
  byId('emt-cat').addEventListener('change', function(e){ EMT_UI.cat = e.target.value; scheduleRender(); });
  byId('ecb-q').addEventListener('change', function(e){ ECB_UI.q = e.target.value.trim(); renderEtudeCables(mount, actions); });
  byId('ecb-fam').addEventListener('change', function(e){ ECB_UI.famille = e.target.value; ECB_DATA.rows = null; renderEtudeCables(mount, actions); });
  byId('ecb-imp').addEventListener('click', ecbImporter);
}

/* ---------- import Excel : apercu puis application (serveur, un seul lot) ---------- */
function ecbImporter(){
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0]; if(!f) return;
    var fd = new FormData(); fd.append('file', f); fd.append('apercu', '1');
    toast('Lecture du fichier…');
    fetch('/api/etude-elec/cables/import', {method:'POST', body: fd})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP '+r.status)); return j; }); })
      .then(function(a){ ecbConfirmer(f, a); })
      .catch(function(e){ console.error(e); toast('Import impossible : '+e.message, 'danger'); });
  });
  inp.click();
}
function ecbConfirmer(fichier, a){
  var avert = (a.avertissements||[]).length ? '<p class="hint" style="margin-top:10px;"><b>'+a.nbAvertissements+' avertissement(s)</b> (les lignes concernées sont ignorées) :</p><ul style="max-height:140px;overflow:auto;font-size:12px;margin:4px 0 0 18px;">'+
    a.avertissements.map(function(m){ return '<li>'+esc(m)+'</li>'; }).join('')+(a.nbAvertissements > a.avertissements.length ? '<li>…</li>' : '')+'</ul>' : '';
  var ov = openModal({
    title: 'Importer le catalogue des câbles BT',
    body: '<p>Le fichier contient <b>'+a.cables.toLocaleString('fr-FR')+'</b> câble(s) dans <b>'+a.familles+'</b> famille(s).</p>'+
      '<div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="ecb-mode" value="fusion" checked style="width:auto;"> <span><b>Fusionner</b> : met à jour les câbles de même id_caneco, ajoute les nouveaux, ne supprime rien</span></label>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="ecb-mode" value="remplacer" style="width:auto;"> <span><b>Remplacer</b> : vide d’abord tout le catalogue des câbles</span></label></div>'+avert,
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="ecb-go">Importer</button>'
  });
  ov.querySelector('#ecb-go').addEventListener('click', function(){
    var mode = (ov.querySelector('input[name="ecb-mode"]:checked')||{}).value || 'fusion';
    closeModal();
    var fd = new FormData(); fd.append('file', fichier); fd.append('mode', mode);
    toast('Import en cours…');
    fetch('/api/etude-elec/cables/import', {method:'POST', body: fd})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP '+r.status)); return j; }); })
      .then(function(j){
        toast('Import terminé : '+j.ajoutes+' ajouté(s), '+j.modifies+' mis à jour'+(j.supprimes ? ', '+j.supprimes+' supprimé(s)' : ''), 'success');
        ECB_DATA.familles = null; ECB_DATA.rows = null;
        if(typeof scheduleRender === 'function') scheduleRender();
      })
      .catch(function(e){ console.error(e); toast('Import impossible : '+e.message, 'danger'); });
  });
}
