/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.06) - Base materiel.
   Charge APRES etude-bilan.js (utilise eeStyleOnce, toast, openModal...).

   Bases de donnees "materiel" REUTILISABLES d'un projet a l'autre (non rattachees a un contrat / devis).
   Categorie disponible : transformateurs HT/MT (d'autres categories pourront etre ajoutees dans EMT_CATS).
   Quatre onglets, comme le classeur Excel de reference :
     - Transformateurs : une ligne par puissance ; saisies (tensions, ONAN, uk, valeurs constructeur...) et
       colonnes CALCULEES (ONAF, pertes estimees / retenues, courants, ur, ux, Z, pouvoir de court-circuit...).
     - Explications : signification et principe de calcul de chaque colonne.
     - Parametres : rapport ONAF/ONAN, point d'ancrage des pertes, exposants, tolerances IEC...
     - Sources : documents, etat de verification et hypotheses.
   Collections : etudeMatTransfos, etudeMatParams, etudeMatSources. Import / export Excel (4 feuilles, vraies formules).
   ========================================================= */

var EMT_CATS = [{id:'transfo', label:'Transformateurs HT/MT'}, {id:'protections', label:'Protections BT (disjoncteurs et déclencheurs)'}, {id:'cables', label:'Câbles BT (catalogue)'}];
var EMT_UI = {cat:'transfo', onglet:'liste', tension:'tous', flash:null};
var EMT_EXPL = null;     // explications chargees depuis le serveur (une fois)
var EMT_DEFAUT = {ratio_onaf_onan:1.25, pk_ancrage:110, p0_ancrage:24, s_ancrage:40, exp_pk:0.85, exp_p0:0.70, maj_225:1.10,
                  i0_pct:0.30, tol_pertes_tot:0.10, tol_pertes_comp:0.15, tol_uk_sup10:0.075, tol_uk_inf10:0.10};
var EMT_STATUTS = ['estimé', 'constructeur', 'ONEE', 'autre'];

function emtNum(x){
  if(x===null || x===undefined || x==='') return null;
  var n = Number(String(x).replace(',', '.')); return isNaN(n) ? null : n;
}
function emtF(v, dec){
  if(v===null || v===undefined || v==='' || (typeof v === 'number' && !isFinite(v))) return '';
  return Number(v).toLocaleString('fr-FR', {minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping:false});
}
function emtParams(){
  var P = Object.assign({}, EMT_DEFAUT);
  (STATE.etudeMatParams||[]).forEach(function(p){
    if(p.categorie === 'transfo' && p.code){ var n = emtNum(p.valeur); if(n !== null) P[p.code] = n; }
  });
  return P;
}
/* Calcule les colonnes derivees d'un transformateur (memes formules que le classeur Excel). */
function emtCalc(t, P){
  var s = emtNum(t.sOnan), up = emtNum(t.tensionPrimaire), us = emtNum(t.tensionSecondaire), uk = emtNum(t.uk);
  var r = {};
  var ok = function(x){ return x !== null && isFinite(x); };
  r.onafNA = String(t.onaf === null || t.onaf === undefined ? '' : t.onaf).trim().toUpperCase() === 'NON';   // pas de ventilation : ONAF non applicable
  r.sOnaf = (ok(s) && !r.onafNA) ? s * P.ratio_onaf_onan : null;
  var maj = (ok(up) && up >= 225) ? P.maj_225 : 1;
  r.pkEst = ok(s) ? P.pk_ancrage * Math.pow(s / P.s_ancrage, P.exp_pk) * maj : null;
  r.p0Est = ok(s) ? P.p0_ancrage * Math.pow(s / P.s_ancrage, P.exp_p0) * maj : null;
  var i0 = emtNum(t.i0); r.i0 = i0 !== null ? i0 : P.i0_pct; r.i0Propre = i0 !== null;
  var pkC = emtNum(t.pkConstructeur), p0C = emtNum(t.p0Constructeur);
  r.pkRet = pkC !== null ? pkC : r.pkEst; r.p0Ret = p0C !== null ? p0C : r.p0Est;
  var cour = function(S, U){ return (ok(S) && ok(U) && U) ? S * 1000 / (Math.sqrt(3) * U) : null; };
  r.iPrimOnan = cour(s, up); r.iPrimOnaf = r.onafNA ? null : cour(r.sOnaf, up); r.iSecOnan = cour(s, us); r.iSecOnaf = r.onafNA ? null : cour(r.sOnaf, us);
  r.ur = (ok(r.pkRet) && ok(s) && s) ? r.pkRet / (s * 10) : null;
  r.ux = (ok(uk) && ok(r.ur)) ? Math.sqrt(Math.max(0, uk * uk - r.ur * r.ur)) : null;
  r.z = (ok(uk) && ok(us) && ok(s) && s) ? uk / 100 * us * us / s : null;
  r.scc = (ok(uk) && uk && ok(s)) ? s / (uk / 100) : null;
  r.ik = (ok(r.scc) && ok(us) && us) ? r.scc / (Math.sqrt(3) * us) : null;
  r.p0Max = ok(r.p0Ret) ? r.p0Ret * (1 + P.tol_pertes_comp) : null;
  r.pkMax = ok(r.pkRet) ? r.pkRet * (1 + P.tol_pertes_comp) : null;
  return r;
}

function emtStyleOnce(){
  if(byId('emt-style')) return;
  var st = document.createElement('style'); st.id = 'emt-style';
  st.textContent =
    '.emt-tabs{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap;} .emt-tab{border:1px solid var(--border,#d0d5db);background:var(--surface,#fff);border-radius:6px;padding:6px 14px;cursor:pointer;font:inherit;}'+
    '.emt-tab.on{background:var(--primary,#1f3a5f);color:#fff;border-color:var(--primary,#1f3a5f);}'+
    '.emt-wrap{overflow:auto;max-height:68vh;border:1px solid var(--border,#d0d5db);border-radius:8px;}'+
    '.emt-t{border-collapse:separate;border-spacing:0;font-size:12.5px;} .emt-t th{position:sticky;top:0;z-index:2;background:#1f3a5f;color:#fff;padding:6px 8px;font-weight:600;text-align:center;vertical-align:middle;min-width:84px;white-space:normal;}'+
    '.emt-t td{border-bottom:1px solid var(--border-soft,#eceff2);border-right:1px solid var(--border-soft,#eceff2);padding:2px 4px;white-space:nowrap;}'+
    '.emt-t td.c{background:#f2f2f2;text-align:right;font-variant-numeric:tabular-nums;padding:4px 8px;} .emt-t td.in input,.emt-t td.in select{background:#fff2cc;border:1px solid #e0d19a;width:100%;font:inherit;padding:2px 4px;}'+
    '.emt-t td.in input.n{width:78px;text-align:right;} .emt-t td.in input.w{width:340px;} .emt-t td.in input.m{width:120px;} .emt-t td.in input.s{width:150px;}'+
    '.emt-t td.id{position:sticky;left:0;background:#fff;z-index:1;font-weight:600;} .emt-t th.id{left:0;z-index:3;}'+
    '.emt-t tr.flash td{background:#e2f0d9 !important;}'+
    '.emt-expl h4{margin:16px 0 6px;} .emt-expl table{border-collapse:collapse;width:100%;font-size:13px;} .emt-expl th{background:#1f3a5f;color:#fff;text-align:left;padding:6px 8px;} .emt-expl td{border:1px solid var(--border-soft,#dfe3e8);padding:6px 8px;vertical-align:top;}'+
    '.emt-expl td:first-child{font-weight:600;white-space:nowrap;width:260px;}'+
    '.emt-t td.emt-na{background:repeating-linear-gradient(45deg,#e4e4e4,#e4e4e4 4px,#d4d4d4 4px,#d4d4d4 8px) !important;color:#888;text-align:center;} .emt-ok{background:#e2f0d9 !important;} .emt-warn{background:#fff2cc !important;}';
  document.head.appendChild(st);
}

/* ---------- enregistrement ---------- */
function emtSauver(col, id, patch){
  patch.updatedAt = nowISO();
  return STATE.db.doc(col+'/'+id).update(patch).then(function(){ if(typeof scheduleRender === 'function') scheduleRender(); })
    .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); });
}
function emtAjouter(col, doc){
  doc.createdAt = nowISO(); doc.creePar = currentUserName();
  return STATE.db.collection(col).add(doc);
}
function emtSupprimer(col, id, libelle){
  confirmDialog('Supprimer définitivement « '+libelle+' » ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
    if(!ok) return;
    deleteDoc(col, id).then(function(){ toast('Supprimé', 'success'); setTimeout(function(){ if(typeof scheduleRender === 'function') scheduleRender(); }, 300); })
      .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
  });
}

/* ---------- onglet Transformateurs ---------- */
var EMT_COLS = [
  // k : champ stocke (saisie) ou cle du calcul ; t : titre ; ty : in (saisie) / c (calcule) ; dec : decimales ; w : classe d'entree
  {k:'code', t:'id', ty:'in', w:'m', id:true},
  {k:'tensionPrimaire', t:'Tension primaire (kV)', ty:'in', w:'n', num:true},
  {k:'tensionSecondaire', t:'Tension secondaire (kV)', ty:'in', w:'n', num:true},
  {k:'sOnan', t:'S ONAN (MVA)', ty:'in', w:'n', num:true},
  {k:'onaf', t:'ONAF applicable (OUI / NON)', ty:'in', w:'s', select:true, opts:['OUI','NON'], defVal:'OUI'},
  {k:'sOnaf', t:'S ONAF (MVA) = ONAN × rapport', ty:'c', dec:3, onafCol:true},
  {k:'serie', t:'Série de puissance', ty:'in', w:'s'},
  {k:'uk', t:'uk (%)', ty:'in', w:'n', num:true},
  {k:'pkEst', t:'Pk estimé (kW)', ty:'c', dec:2},
  {k:'p0Est', t:'P0 estimé (kW)', ty:'c', dec:2},
  {k:'i0', t:'I0 (%) — vide = paramètre', ty:'in', w:'n', num:true, defCalc:'i0', dec:2},
  {k:'pkConstructeur', t:'Pk constructeur (kW)', ty:'in', w:'n', num:true},
  {k:'p0Constructeur', t:'P0 constructeur (kW)', ty:'in', w:'n', num:true},
  {k:'pkRet', t:'Pk retenu (kW)', ty:'c', dec:2},
  {k:'p0Ret', t:'P0 retenu (kW)', ty:'c', dec:2},
  {k:'iPrimOnan', t:'I primaire ONAN (A)', ty:'c', dec:1},
  {k:'iPrimOnaf', onafCol:true, t:'I primaire ONAF (A)', ty:'c', dec:1},
  {k:'iSecOnan', t:'I secondaire ONAN (A)', ty:'c', dec:1},
  {k:'iSecOnaf', onafCol:true, t:'I secondaire ONAF (A)', ty:'c', dec:1},
  {k:'ur', t:'ur = Pk/(S×10) (%)', ty:'c', dec:3},
  {k:'ux', t:'ux = √(uk²−ur²) (%)', ty:'c', dec:2},
  {k:'z', t:'Z secondaire = uk/100·U²/S (Ω)', ty:'c', dec:3},
  {k:'scc', t:'Pouvoir de cc, source infinie = S/uk (MVA)', ty:'c', dec:1},
  {k:'ik', t:'Ik″ secondaire, source infinie (kA)', ty:'c', dec:2},
  {k:'p0Max', t:'P0 max avec tolérance (kW)', ty:'c', dec:2},
  {k:'pkMax', t:'Pk max avec tolérance (kW)', ty:'c', dec:2},
  {k:'couplage', t:'Couplage', ty:'in', w:'m'},
  {k:'statut', t:'Statut', ty:'in', w:'s', select:true},
  {k:'source', t:'Source / hypothèse', ty:'in', w:'w'}
];
function emtLignesTransfos(){
  return (STATE.etudeMatTransfos||[]).slice().sort(function(a,b){
    return (a.tensionPrimaire||0)-(b.tensionPrimaire||0) || (a.sOnan||0)-(b.sOnan||0) || (a.rang||0)-(b.rang||0);
  });
}
function emtTableTransfos(canEdit){
  var P = emtParams();
  var all = emtLignesTransfos();
  var tensions = []; all.forEach(function(t){ var u = String(t.tensionPrimaire); if(tensions.indexOf(u) < 0) tensions.push(u); });
  var lignes = all.filter(function(t){ return EMT_UI.tension === 'tous' || String(t.tensionPrimaire) === EMT_UI.tension; });
  var nbEst = all.filter(function(t){ return (t.statut||'estimé') === 'estimé'; }).length;
  var h = '<div class="toolbar" style="margin-bottom:8px;gap:10px;align-items:center;"><label>Tension primaire&nbsp;<select id="emt-tension"><option value="tous">Toutes</option>'+
    tensions.map(function(u){ return '<option value="'+esc(u)+'"'+(EMT_UI.tension===u?' selected':'')+'>'+esc(u)+' kV</option>'; }).join('')+'</select></label>'+
    (canEdit ? '<button type="button" class="btn" id="emt-add">'+ic('plus',15)+' Ajouter un transformateur</button>' : '')+
    '<span class="muted">'+lignes.length+' ligne(s) — '+nbEst+' valeur(s) « estimé » sur '+all.length+'</span></div>'+
    '<p class="hint" style="margin:0 0 8px;">Fond jaune = saisie ; fond gris = calculé avec les paramètres (onglet « Paramètres »). Pk, P0 et I0 « estimés » sont des ordres de grandeur d’avant-projet : saisissez les valeurs du constructeur ou de l’ONEE dans les colonnes « constructeur » (elles priment) et passez le statut en conséquence.</p>';
  h += '<div class="emt-wrap"><table class="emt-t"><thead><tr>'+EMT_COLS.map(function(c){ return '<th'+(c.id?' class="id"':'')+'>'+esc(c.t)+'</th>'; }).join('')+(canEdit?'<th></th>':'')+'</tr></thead><tbody>';
  lignes.forEach(function(t){
    var r = emtCalc(t, P);
    h += '<tr'+(EMT_UI.flash === t.id ? ' class="flash"' : '')+' data-id="'+t.id+'">';
    EMT_COLS.forEach(function(c){
      if(c.ty === 'c'){
        if(c.onafCol && r.onafNA){ h += '<td class="c emt-na" title="Pas de ventilation : ONAF non applicable">—</td>'; return; }
        h += '<td class="c">'+emtF(r[c.k], c.dec)+'</td>'; return;
      }
      var v = t[c.k]; if(v === null || v === undefined) v = '';
      if(c.select){
        var opts = c.opts || EMT_STATUTS, vv = v || c.defVal || 'estimé';
        h += '<td class="in'+(c.id?' id':'')+'"><select data-k="'+c.k+'"'+(canEdit?'':' disabled')+'>'+opts.concat(opts.indexOf(vv) < 0 ? [vv] : []).map(function(s){ return '<option'+(s===vv?' selected':'')+'>'+esc(s)+'</option>'; }).join('')+'</select></td>';
        return;
      }
      var ph = (c.defCalc ? emtF(r[c.defCalc], c.dec||2) : '');
      h += '<td class="in'+(c.id?' id':'')+'"><input class="'+(c.w||'')+(c.num?' n':'')+'" data-k="'+c.k+'" data-num="'+(c.num?1:0)+'" value="'+esc(c.num ? (v===''?'':String(v).replace('.', ',')) : v)+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+(canEdit?'':' disabled')+'></td>';
    });
    if(canEdit) h += '<td style="white-space:nowrap;"><button type="button" class="iconbtn emt-dup" title="Dupliquer" data-id="'+t.id+'">'+ic('layers',14)+'</button><button type="button" class="iconbtn emt-del" title="Supprimer" data-id="'+t.id+'">'+ic('trash',14)+'</button></td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
function emtLierTransfos(mount, canEdit){
  var sel = byId('emt-tension');
  if(sel) sel.addEventListener('change', function(e){ EMT_UI.tension = e.target.value; scheduleRender(); });
  if(!canEdit) return;
  var add = byId('emt-add');
  if(add) add.addEventListener('click', function(){
    var base = EMT_UI.tension !== 'tous' ? Number(EMT_UI.tension) : 60, n = (STATE.etudeMatTransfos||[]).length + 1, code = 'TR-NOUVEAU-'+n;
    while((STATE.etudeMatTransfos||[]).some(function(t){ return t.code === code; })){ n++; code = 'TR-NOUVEAU-'+n; }
    emtAjouter('etudeMatTransfos', {code: code, tensionPrimaire: base, tensionSecondaire: 10, sOnan: null, onaf: 'OUI', serie: '', uk: null, statut: 'estimé', rang: n,
      source: 'À renseigner'}).then(function(ref){ EMT_UI.flash = ref && ref.id; toast('Ligne ajoutée : renseignez la puissance et uk', 'success'); scheduleRender(); })
      .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  });
  mount.querySelectorAll('.emt-t [data-k]').forEach(function(inp){
    inp.addEventListener('change', function(){
      var id = inp.closest('tr').getAttribute('data-id'), k = inp.getAttribute('data-k'), v = inp.value.trim();
      var patch = {};
      if(inp.getAttribute('data-num') === '1'){
        var n = v === '' ? null : emtNum(v);
        if(v !== '' && n === null){ toast('Valeur numérique attendue', 'danger'); scheduleRender(); return; }
        patch[k] = n;
      } else if(k === 'code'){
        if(!v){ toast('Le code ne peut pas être vide', 'danger'); scheduleRender(); return; }
        if((STATE.etudeMatTransfos||[]).some(function(t){ return t.id !== id && t.code === v; })){ toast('Ce code existe déjà', 'danger'); scheduleRender(); return; }
        patch[k] = v;
      } else patch[k] = v === '' ? null : v;
      emtSauver('etudeMatTransfos', id, patch);
    });
  });
  mount.querySelectorAll('.emt-del').forEach(function(b){ b.addEventListener('click', function(){
    var t = (STATE.etudeMatTransfos||[]).filter(function(x){ return x.id === b.getAttribute('data-id'); })[0];
    emtSupprimer('etudeMatTransfos', b.getAttribute('data-id'), t ? t.code : 'cette ligne');
  }); });
  mount.querySelectorAll('.emt-dup').forEach(function(b){ b.addEventListener('click', function(){
    var t = (STATE.etudeMatTransfos||[]).filter(function(x){ return x.id === b.getAttribute('data-id'); })[0]; if(!t) return;
    var copie = Object.assign({}, t); delete copie.id; delete copie.updatedAt;
    var code = t.code+'-copie', n = 1; while((STATE.etudeMatTransfos||[]).some(function(x){ return x.code === code; })){ n++; code = t.code+'-copie'+n; }
    copie.code = code; copie.rang = (STATE.etudeMatTransfos||[]).length + 1;
    emtAjouter('etudeMatTransfos', copie).then(function(ref){ EMT_UI.flash = ref && ref.id; toast('Ligne dupliquée', 'success'); scheduleRender(); })
      .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  }); });
}

/* ---------- onglet Explications ---------- */
function emtChargerExplications(cb){
  if(EMT_EXPL){ cb(); return; }
  fetch('/api/etude-elec/materiel-explications').then(function(r){ return r.json(); }).then(function(j){ EMT_EXPL = j; cb(); })
    .catch(function(e){ console.error(e); EMT_EXPL = {groupes: [], intro: 'Explications indisponibles.'}; cb(); });
}
function emtExplicationsHtml(){
  var x = EMT_EXPL || {groupes: []};
  var h = '<div class="emt-expl"><p class="hint">'+esc(x.intro||'')+'</p>';
  (x.groupes||[]).forEach(function(g){
    h += '<h4>'+esc(g.groupe)+'</h4><table><thead><tr><th>Colonne</th><th>Signification</th><th>Calcul / principe</th></tr></thead><tbody>'+
      (g.colonnes||[]).map(function(c){ return '<tr><td>'+esc(c.colonne)+'</td><td>'+esc(c.signification||'')+'</td><td>'+esc(c.calcul||'')+'</td></tr>'; }).join('')+'</tbody></table>';
  });
  if(x.note) h += '<p class="hint" style="margin-top:14px;"><b>'+esc(x.note)+'</b></p>';
  return h+'</div>';
}

/* ---------- onglets Parametres et Sources (tableaux editables) ---------- */
function emtTableGenerique(opts){
  var h = '<div class="toolbar" style="margin-bottom:8px;">'+(opts.canEdit ? '<button type="button" class="btn" id="'+opts.addId+'">'+ic('plus',15)+' '+opts.addLabel+'</button>' : '')+'</div>';
  h += '<p class="hint" style="margin:0 0 8px;">'+opts.hint+'</p>';
  h += '<div class="emt-wrap"><table class="emt-t"><thead><tr>'+opts.cols.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('')+(opts.canEdit?'<th></th>':'')+'</tr></thead><tbody>';
  opts.rows.forEach(function(d){
    h += '<tr data-id="'+d.id+'">'+opts.cols.map(function(c){
      var v = d[c.k]; if(v === null || v === undefined) v = '';
      if(c.ro) return '<td class="c" style="text-align:left;">'+esc(v)+'</td>';
      return '<td class="in"><input class="'+(c.w||'')+'" data-k="'+c.k+'" data-num="'+(c.num?1:0)+'" value="'+esc(c.num ? String(v).replace('.', ',') : v)+'"'+(opts.canEdit?'':' disabled')+'></td>';
    }).join('')+(opts.canEdit ? '<td><button type="button" class="iconbtn emt-gdel" data-id="'+d.id+'" title="Supprimer">'+ic('trash',14)+'</button></td>' : '')+'</tr>';
  });
  return h+'</tbody></table></div>';
}
function emtLierGenerique(mount, col, opts){
  if(!opts.canEdit) return;
  var add = byId(opts.addId);
  if(add) add.addEventListener('click', function(){
    var doc = opts.nouveau(); emtAjouter(col, doc).then(function(){ toast('Ligne ajoutée', 'success'); scheduleRender(); })
      .catch(function(e){ console.error(e); toast('Erreur d’enregistrement (code déjà utilisé ?)', 'danger'); });
  });
  mount.querySelectorAll('.emt-t [data-k]').forEach(function(inp){
    inp.addEventListener('change', function(){
      var id = inp.closest('tr').getAttribute('data-id'), k = inp.getAttribute('data-k'), v = inp.value.trim(), patch = {};
      if(inp.getAttribute('data-num') === '1'){
        var n = v === '' ? null : emtNum(v);
        if(v !== '' && n === null){ toast('Valeur numérique attendue', 'danger'); scheduleRender(); return; }
        patch[k] = n;
      } else patch[k] = v === '' ? null : v;
      emtSauver(col, id, patch);
    });
  });
  mount.querySelectorAll('.emt-gdel').forEach(function(b){ b.addEventListener('click', function(){
    var d = (STATE[opts.stateKey]||[]).filter(function(x){ return x.id === b.getAttribute('data-id'); })[0];
    emtSupprimer(col, b.getAttribute('data-id'), d ? (d[opts.libKey] || 'cette ligne') : 'cette ligne');
  }); });
}
var EMT_PARAM_OPTS = function(canEdit){
  return {canEdit: canEdit, addId: 'emt-padd', addLabel: 'Ajouter un paramètre', stateKey: 'etudeMatParams', libKey: 'code',
    hint: 'Paramètres lus par les formules (onglet Transformateurs et export Excel). Le <b>code</b> est reconnu par le calcul : ne le renommez pas. Un changement de valeur recalcule toutes les lignes.',
    cols: [{k:'code', t:'Code', ro:true}, {k:'libelle', t:'Paramètre', w:'w'}, {k:'valeur', t:'Valeur', w:'n', num:true}, {k:'unite', t:'Unité', w:'m'}, {k:'source', t:'Hypothèse / source', w:'w'}],
    rows: (STATE.etudeMatParams||[]).filter(function(p){ return p.categorie === 'transfo'; }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); }),
    nouveau: function(){
      var n = (STATE.etudeMatParams||[]).length + 1, code = 'param_'+n;
      return {categorie:'transfo', code: code, libelle: 'Nouveau paramètre', valeur: null, unite: '', source: '', rang: n};
    }};
};
var EMT_SOURCE_OPTS = function(canEdit){
  return {canEdit: canEdit, addId: 'emt-sadd', addLabel: 'Ajouter une source', stateKey: 'etudeMatSources', libKey: 'ref',
    hint: 'Documents d’où proviennent les informations, état de vérification (vérifié dans un document fourni / lu en ligne / non consulté / non trouvé) et hypothèses. À tenir à jour quand une valeur est remplacée par celle d’un constructeur ou de l’ONEE.',
    cols: [{k:'ref', t:'Réf.', w:'n'}, {k:'document', t:'Document', w:'w'}, {k:'elements', t:'Éléments utilisés', w:'w'}, {k:'etat', t:'État de vérification', w:'w'}, {k:'lien', t:'Lien / emplacement', w:'w'}],
    rows: (STATE.etudeMatSources||[]).filter(function(p){ return p.categorie === 'transfo'; }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); }),
    nouveau: function(){ var n = (STATE.etudeMatSources||[]).length + 1; return {categorie:'transfo', ref: 'S'+n, document: '', elements: '', etat: '', lien: '', rang: n}; }};
};

/* ---------- export / import Excel ---------- */
function emtExporter(){
  var spec = {
    filename: 'Liste_transformateurs_HTMT_'+todayISO().replace(/-/g,'')+'.xlsx',
    transfos: emtLignesTransfos(),
    params: (STATE.etudeMatParams||[]).filter(function(p){ return p.categorie === 'transfo'; }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); }),
    sources: (STATE.etudeMatSources||[]).filter(function(p){ return p.categorie === 'transfo'; }).sort(function(a,b){ return (a.rang||0)-(b.rang||0); }),
    meta: {type:'materiel_transformateurs', version: (window.APP_VERSION||'')}
  };
  toast('Génération du fichier Excel…');
  fetch('/api/etude-elec/export-materiel', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec)})
    .then(function(r){
      if(!r.ok) return r.text().then(function(t){ var j=null; try{ j=JSON.parse(t); }catch(e){} throw new Error((j&&j.error)||('Erreur HTTP '+r.status)); });
      return r.blob();
    }).then(function(blob){
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = spec.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
      toast('Fichier Excel généré', 'success');
    }).catch(function(e){ console.error(e); toast('Export impossible : '+e.message, 'danger'); });
}
function emtImporter(){
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0]; if(!f) return;
    var fd = new FormData(); fd.append('file', f);
    toast('Lecture du fichier…');
    fetch('/api/etude-elec/import-materiel', {method:'POST', body: fd}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ('Erreur HTTP '+r.status)); return j; }); })
      .then(emtConfirmerImport).catch(function(e){ console.error(e); toast('Import impossible : '+e.message, 'danger'); });
  });
  inp.click();
}
function emtConfirmerImport(data){
  var ov = openModal({
    title: 'Importer la base transformateurs',
    body: '<p>Le fichier contient <b>'+data.transfos.length+'</b> transformateur(s), <b>'+data.params.length+'</b> paramètre(s) et <b>'+data.sources.length+'</b> source(s).</p>'+
      '<div class="field"><label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="emi-mode" value="fusion" checked style="width:auto;"> <span><b>Fusionner</b> : met à jour les lignes de même code, ajoute les nouvelles, ne supprime rien</span></label>'+
      '<label style="display:flex;gap:8px;align-items:center;font-weight:400;"><input type="radio" name="emi-mode" value="remplacer" style="width:auto;"> <span><b>Remplacer</b> : supprime d’abord les lignes actuelles (transformateurs, paramètres et sources)</span></label></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="emi-go">Importer</button>'
  });
  ov.querySelector('#emi-go').addEventListener('click', function(){
    var mode = (ov.querySelector('input[name="emi-mode"]:checked')||{}).value || 'fusion';
    closeModal(); emtAppliquerImport(data, mode);
  });
}
function emtAppliquerImport(data, mode){
  var chaine = Promise.resolve(), nb = 0;
  function etape(fn){ chaine = chaine.then(fn); }
  var defs = [['etudeMatTransfos', 'etudeMatTransfos', data.transfos, 'code'], ['etudeMatParams', 'etudeMatParams', data.params, 'code'], ['etudeMatSources', 'etudeMatSources', data.sources, 'ref']];
  if(mode === 'remplacer'){
    defs.forEach(function(d){ (STATE[d[1]]||[]).slice().forEach(function(x){ etape(function(){ return deleteDoc(d[0], x.id); }); }); });
  }
  defs.forEach(function(d){
    (d[2]||[]).forEach(function(n){
      var existant = mode === 'fusion' ? (STATE[d[1]]||[]).filter(function(x){ return String(x[d[3]]||'') === String(n[d[3]]||'') && (d[0] !== 'etudeMatParams' || x.categorie === n.categorie); })[0] : null;
      etape(function(){
        nb++;
        if(existant){ var patch = Object.assign({}, n); delete patch.rang; patch.updatedAt = nowISO(); return STATE.db.doc(d[0]+'/'+existant.id).update(patch); }
        return emtAjouter(d[0], Object.assign({}, n));
      });
    });
  });
  toast('Import en cours…');
  chaine.then(function(){ toast('Import terminé ('+nb+' ligne(s) traitée(s))', 'success'); setTimeout(function(){ if(typeof scheduleRender === 'function') scheduleRender(); }, 600); })
    .catch(function(e){ console.error(e); toast('Erreur pendant l’import : '+(e && e.message || e), 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); });
}

/* ---------- vue ---------- */
function renderEtudeMateriel(mount, actions){
  eeStyleOnce(); emtStyleOnce();
  if(EMT_UI.cat === 'cables' && typeof renderEtudeCables === 'function'){ renderEtudeCables(mount, actions); return; }
  if(EMT_UI.cat === 'protections' && typeof renderEtudeProtections === 'function'){ renderEtudeProtections(mount, actions); return; }
  var canEdit = canWrite('etude_elec');
  actions.innerHTML = '<button type="button" class="btn" id="emt-imp"'+(canEdit?'':' disabled')+'>'+ic('upload',15)+' Importer Excel</button> '+
    '<button type="button" class="btn btn-primary" id="emt-exp">'+ic('download',15)+' Exporter Excel</button>';
  var onglets = [['liste', 'Transformateurs'], ['expl', 'Explications'], ['params', 'Paramètres'], ['sources', 'Sources']];
  var corps = '';
  if(EMT_UI.onglet === 'liste') corps = emtTableTransfos(canEdit);
  else if(EMT_UI.onglet === 'expl'){
    if(!EMT_EXPL){ emtChargerExplications(function(){ scheduleRender(); }); corps = '<p class="hint">Chargement…</p>'; }
    else corps = emtExplicationsHtml();
  }
  else if(EMT_UI.onglet === 'params') corps = emtTableGenerique(EMT_PARAM_OPTS(canEdit));
  else corps = emtTableGenerique(EMT_SOURCE_OPTS(canEdit));
  mount.innerHTML =
    '<div class="section-head"><div class="toolbar"><select id="emt-cat" title="Catégorie de matériel">'+EMT_CATS.map(function(c){ return '<option value="'+c.id+'"'+(EMT_UI.cat===c.id?' selected':'')+'>'+esc(c.label)+'</option>'; }).join('')+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Base de référence réutilisable d’un projet à l’autre : puissances ONAN / ONAF, pertes, impédances, pouvoirs de court-circuit et données utiles aux calculs de court-circuit et aux bilans de puissance. '+
      (canEdit ? 'Modifiable ; exportable et importable en Excel (4 feuilles).' : 'Consultation seule.')+'</p>'+
    '<div class="emt-tabs">'+onglets.map(function(o){ return '<button type="button" class="emt-tab'+(EMT_UI.onglet===o[0]?' on':'')+'" data-o="'+o[0]+'">'+o[1]+'</button>'; }).join('')+'</div>'+corps;
  mount.querySelectorAll('.emt-tab').forEach(function(b){ b.addEventListener('click', function(){ EMT_UI.onglet = b.getAttribute('data-o'); EMT_UI.flash = null; renderEtudeMateriel(mount, actions); }); });
  byId('emt-cat').addEventListener('change', function(e){ EMT_UI.cat = e.target.value; scheduleRender(); });
  byId('emt-exp').addEventListener('click', emtExporter);
  byId('emt-imp').addEventListener('click', emtImporter);
  if(EMT_UI.onglet === 'liste') emtLierTransfos(mount, canEdit);
  else if(EMT_UI.onglet === 'params') emtLierGenerique(mount, 'etudeMatParams', EMT_PARAM_OPTS(canEdit));
  else if(EMT_UI.onglet === 'sources') emtLierGenerique(mount, 'etudeMatSources', EMT_SOURCE_OPTS(canEdit));
  EMT_UI.flash = null;
}

if(typeof module !== 'undefined' && module.exports){ module.exports = {emtCalc: emtCalc, EMT_DEFAUT: EMT_DEFAUT}; }
