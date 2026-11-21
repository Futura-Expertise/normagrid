/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.04) - Liste des consommateurs.
   Charge APRES etude-electrique.js (utilise EE_COLS, eeListes, eeSpecExport...).

   La liste est un DOCUMENT DERIVE de la base de donnees : elle est generee, jamais saisie
   tag par tag. Elle est triee par "Switchgear / MCC" : chaque tableau a une section qui
   liste les equipements alimentes depuis lui. Les sections vont de l'AMONT vers l'AVAL
   (un tableau alimente par un depart d'un autre tableau vient apres celui-ci).
   TOUS les consommateurs de la base apparaissent (aucune exclusion) ; ceux sans
   tableau sont regroupes dans une derniere section.
   Seuls sont stockes : l'en-tete (affaire, compte, code doc., revision, date) et, par
   consommateur, le "Type cable" et le "Commentaire" (collection etudeListeDocs).
   ========================================================= */

var EEL_SANS_TABLEAU = 'Sans tableau (Switchgear / MCC non renseigné)';

function eelCle(s){ return String(s===null||s===undefined?'':s).trim().toLowerCase().replace(/\s+/g, ' '); }
function eelTexte(s){ return String(s===null||s===undefined?'':s).trim().replace(/\s+/g, ' '); }

/* Sections de la liste, de l'amont vers l'aval. Fonction pure (testee sous node).
   lignes : consommateurs de la base d'un meme projet ({id, ordre, tag, switchgear, tension...}).
   Renvoie [{cle, titre, amont, niveau, lignes:[...]}].
   - un tableau T est "alimente" par le consommateur dont le tag est T (le depart) : son tableau amont est le
     Switchgear / MCC de ce consommateur ;
   - racines (aucun amont) : tension la plus elevee d'abord, puis nom ;
   - enfants d'un tableau : dans l'ordre des departs dans le tableau amont ;
   - cycles (A alimente par B alimente par A...) : coupes, les tableaux restants sont ajoutes par nom. */
function eeSectionsAmontAval(lignes){
  var tri = lignes.slice().sort(function(a, b){ return (a.ordre||0) - (b.ordre||0); });
  var groupes = {}, ordreCles = [];
  tri.forEach(function(d){
    var cle = eelCle(d.switchgear);
    if(!cle) cle = '';
    if(!groupes[cle]){ groupes[cle] = {cle: cle, titre: cle ? eelTexte(d.switchgear) : EEL_SANS_TABLEAU, lignes: [], amont: '', depart: null}; ordreCles.push(cle); }
    groupes[cle].lignes.push(d);
  });
  // depart : consommateur dont le tag est le nom du tableau (le tableau lui-meme apparait comme consommateur de son amont)
  var parTag = {};
  tri.forEach(function(d){ var t = eelCle(d.tag); if(t && !parTag[t]) parTag[t] = d; });
  ordreCles.forEach(function(cle){
    if(!cle) return;
    var dep = parTag[cle];
    if(dep){
      var amont = eelCle(dep.switchgear);
      if(amont && amont !== cle && groupes[amont]){ groupes[cle].amont = amont; groupes[cle].depart = dep; }
    }
  });
  function tensionDe(g){
    var m = 0;
    if(g.depart && Number(g.depart.tension) > 0) m = Number(g.depart.tension);
    g.lignes.forEach(function(d){ var v = Number(d.tension); if(v > m) m = v; });
    return m;
  }
  var posDepart = function(g){ return g.depart ? tri.indexOf(g.depart) : 0; };
  var enfants = {};
  ordreCles.forEach(function(cle){ if(cle && groupes[cle].amont){ (enfants[groupes[cle].amont] = enfants[groupes[cle].amont] || []).push(cle); } });
  Object.keys(enfants).forEach(function(p){ enfants[p].sort(function(a, b){ return posDepart(groupes[a]) - posDepart(groupes[b]); }); });
  var racines = ordreCles.filter(function(cle){ return cle && !groupes[cle].amont; });
  racines.sort(function(a, b){
    var d = tensionDe(groupes[b]) - tensionDe(groupes[a]);
    return d !== 0 ? d : groupes[a].titre.localeCompare(groupes[b].titre, 'fr', {numeric:true});
  });
  var sortie = [], vus = {};
  function visiter(cle, niveau){
    if(vus[cle]) return;
    vus[cle] = true;
    var g = groupes[cle];
    sortie.push({cle: cle, titre: g.titre, amont: g.amont ? groupes[g.amont].titre : '', amontCle: g.amont || '', departId: g.depart ? g.depart.id : null, niveau: niveau, lignes: g.lignes});
    (enfants[cle] || []).forEach(function(c){ visiter(c, niveau + 1); });
  }
  racines.forEach(function(c){ visiter(c, 0); });
  // tableaux pris dans un cycle (jamais atteints depuis une racine) : par nom, niveau 0
  ordreCles.filter(function(c){ return c && !vus[c]; })
    .sort(function(a, b){ return groupes[a].titre.localeCompare(groupes[b].titre, 'fr', {numeric:true}); })
    .forEach(function(c){ visiter(c, 0); });
  if(groupes['']) sortie.push({cle: '', titre: EEL_SANS_TABLEAU, amont: '', amontCle: '', departId: null, niveau: 0, lignes: groupes[''].lignes});
  return sortie;
}

/* ---------- valeurs affichees (memes regles que les formules de l'export) ---------- */
function eelVide(v){ return v===null || v===undefined || v===''; }
function eelPuissanceInstallee(d){
  if(eelVide(d.puissanceInstallee)) return '';
  var n = Number(d.puissanceInstallee); if(isNaN(n)) return String(d.puissanceInstallee);
  return (Math.round(n*10)/10).toLocaleString('fr-FR', {useGrouping:false}) + ' ' + (d.unite||'');
}
function eelTotal(d){
  var a = [d.puissanceApparente, d.nombre, d.kUtil, d.kSimul];
  if(a.some(function(x){ return eelVide(x) || isNaN(Number(x)); })) return null;
  return Number(a[0]) * Number(a[1]) * Number(a[2]) * Number(a[3]);
}
function eelAlimentation(d){
  if(eelVide(d.tension)) return '';
  return d.tension + ' VAC / ' + (eelVide(d.contenu) ? '' : d.contenu);
}
var EEL_COLS = [
  {t:'Repère', v:function(d){ return d.tag; }},
  {t:'Désignation', v:function(d){ return d.nom; }},
  {t:'Source', v:function(d){ return eelTexte(d.switchgear); }},
  {t:'Puissance Installée (KW)', v:eelPuissanceInstallee, num:true},
  {t:'Rendement', v:function(d){ return d.rend; }, num:true},
  {t:'Puissance unitaire (KW)', v:function(d){ return d.pActive; }, num:true},
  {t:'Cos ϕ', v:function(d){ return d.cosPhi; }, num:true},
  {t:'Puissance unitaire (KVA)', v:function(d){ return d.puissanceApparente; }, num:true},
  {t:'Nombre', v:function(d){ return d.nombre; }, num:true},
  {t:'Facteur d\'utilisation', v:function(d){ return d.kUtil; }, num:true},
  {t:'Facteur de simultanéité', v:function(d){ return d.kSimul; }, num:true},
  {t:'Puissance totale (KVA)', v:eelTotal, num:true},
  {t:'Type câble', saisi:'typeCable'},
  {t:'Alimentation', v:eelAlimentation},
  {t:'E/NE', v:function(d){ return d.eNe; }},
  {t:'Type Consommateur', v:function(d){ return d.typeConso; }},
  {t:'Départ type', v:function(d){ return d.specialReqts; }},
  {t:'Commentaire', saisi:'commentaire'}
];

/* ---------- document de la liste (un par contrat / devis) ---------- */
var EEL_UI = {projetId:'', editerEntete:null};
var EEL_CACHE = {};     // projetId -> {id, ... } derniere version connue (evite les pertes lors de saisies rapprochees)
var EEL_CHAINE = {};    // projetId -> promesse d'ecriture en cours (les ecritures d'un meme document sont serialisees)

function eelDocDe(projetId){
  var s = (STATE.etudeListeDocs||[]).filter(function(d){ return projetIdDe(d) === projetId; })[0] || null;
  var c = EEL_CACHE[projetId] || null;
  if(s && (!c || c.id !== s.id || String(s.updatedAt||s.createdAt||'') >= String(c.updatedAt||c.createdAt||''))){ EEL_CACHE[projetId] = c = s; }
  return c || s;
}
function eelEnteteParDefaut(projet){
  return {affaire: projet ? (projetNumeroDe(projet) || '') : '', compte: '', codeDoc: '', revision: '0', dateDoc: todayISO()};
}
/* ecrit un morceau du document ; cree le document au premier enregistrement */
function eelSauver(projet, fabriquerPatch){
  var id = projet.id;
  var suite = (EEL_CHAINE[id] || Promise.resolve()).then(function(){
    var doc = eelDocDe(id);
    var patch = fabriquerPatch(doc);
    if(doc){
      patch.updatedAt = nowISO();
      return STATE.db.doc('etudeListeDocs/'+doc.id).update(patch).then(function(){ EEL_CACHE[id] = Object.assign({}, doc, patch); });
    }
    var nouveau = Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null,
      lignes: {}, createdAt: nowISO(), creePar: currentUserName()}, eelEnteteParDefaut(projet), patch);
    return STATE.db.collection('etudeListeDocs').add(nouveau).then(function(ref){ EEL_CACHE[id] = Object.assign({id: ref && ref.id}, nouveau); });
  });
  EEL_CHAINE[id] = suite.catch(function(){});
  return suite;
}

function eelStyleOnce(){
  if(byId('eel-style')) return;
  var st = document.createElement('style'); st.id = 'eel-style';
  st.textContent =
    '.eel-entete{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 14px;padding:12px;border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);}'+
    '.eel-sec{margin:0 0 18px;}'+
    '.eel-sec h3{margin:0 0 6px;font-size:14px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;}'+
    '.eel-sec h3 .muted{font-size:12px;font-weight:400;}'+
    '.eel-wrap{overflow:auto;border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);}'+
    '.eel-table{border-collapse:separate;border-spacing:0;font-size:12.5px;width:max-content;min-width:100%;}'+
    '.eel-table th{background:#1f3a5f;color:#fff;text-align:center;padding:6px 8px;font-weight:600;white-space:normal;vertical-align:middle;}'+
    '.eel-table td{padding:3px 8px;border-bottom:1px solid var(--border-soft,#eceff2);white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis;}'+
    '.eel-table td.eel-num{text-align:right;font-variant-numeric:tabular-nums;}'+
    '.eel-table td.eel-edit{cursor:cell;background:rgba(46,125,107,.07);}'+
    '.eel-table tr:hover td{background:rgba(31,58,95,.05);}';
  document.head.appendChild(st);
}
function eelFmt(v){ return (typeof v === 'number') ? eeFmt(v) : (eelVide(v) ? '' : String(v)); }

function renderEtudeListe(mount, actions){
  eeStyleOnce(); eelStyleOnce();
  var canEdit = canWrite('etude_elec');
  var projets = eeProjetsDe();
  if(!projets.length){
    mount.innerHTML = emptyState('ruler', 'Aucun contrat ni devis enregistré. La liste des consommateurs se rattache à un contrat ou à un devis.');
    return;
  }
  if(!EEL_UI.projetId || !projets.some(function(p){ return p.id === EEL_UI.projetId; })){
    var avec = projets.filter(function(p){ return (STATE.etudeConsommateurs||[]).some(function(d){ return projetIdDe(d) === p.id; }); })[0];
    EEL_UI.projetId = (avec || projets[0]).id;
  }
  var projet = projetParId(EEL_UI.projetId);
  var toutes = eeLignesDuProjet(EEL_UI.projetId);
  var sections = eeSectionsAmontAval(toutes);
  var doc = eelDocDe(EEL_UI.projetId);
  var def = eelEnteteParDefaut(projet);
  var ent = {}; Object.keys(def).forEach(function(k){ ent[k] = (doc && doc[k] !== undefined && doc[k] !== null && doc[k] !== '') ? doc[k] : def[k]; });
  var saisies = (doc && doc.lignes) || {};
  var listes = eeListes();

  actions.innerHTML = '<button type="button" class="btn btn-primary" id="eel-export" '+(toutes.length?'':'disabled')+'>'+ic('download',15)+' Exporter Excel</button>';

  var champs = [['affaire','Affaire',''],['compte','Compte',''],['codeDoc','Code doc.',''],['revision','Révision',''],['dateDoc','Date','date']];
  var enteteHtml = '<div class="eel-entete">'+champs.map(function(c){
    return '<div class="field" style="margin:0;"><label for="eel-h-'+c[0]+'">'+c[1]+'</label><input id="eel-h-'+c[0]+'" data-k="'+c[0]+'" type="'+(c[2]||'text')+'" value="'+esc(ent[c[0]])+'"'+(canEdit?'':' disabled')+'></div>';
  }).join('')+'</div>';

  var corps = sections.map(function(sec){
    var ths = EEL_COLS.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('');
    var trs = sec.lignes.map(function(d){
      var tds = EEL_COLS.map(function(c){
        if(c.saisi){
          var v = (saisies[d.id] || {})[c.saisi];
          return '<td class="eel-edit'+(canEdit?'':'')+'" data-id="'+d.id+'" data-s="'+c.saisi+'"'+(canEdit?' title="Cliquez pour modifier"':'')+'>'+esc(eelVide(v)?'':v)+'</td>';
        }
        var val = c.v(d);
        return '<td'+(c.num?' class="eel-num"':'')+'>'+esc(eelFmt(val))+'</td>';
      }).join('');
      return '<tr>'+tds+'</tr>';
    }).join('');
    return '<div class="eel-sec"><h3>'+esc(sec.titre)+' <span class="muted">'+sec.lignes.length+' consommateur(s)'+
      (sec.amont ? ' · alimenté depuis '+esc(sec.amont) : (sec.cle ? ' · tête de réseau' : ''))+'</span></h3>'+
      '<div class="eel-wrap"><table class="eel-table"><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table></div></div>';
  }).join('');

  mount.innerHTML =
    '<div class="section-head"><div class="toolbar"><select id="eel-projet" title="Contrat ou devis">'+projetsOptionsHtml(EEL_UI.projetId, null, '', true)+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Liste des consommateurs de '+esc(projet ? projetLibelle(projet) : '')+', générée depuis la base de données : '+
      sections.length+' section(s), '+toutes.length+' consommateur(s). Une section par Switchgear / MCC, de l’amont vers l’aval ; chaque section liste les équipements alimentés depuis ce tableau. '+
      (canEdit ? 'Seuls l’en-tête, le <b>type de câble</b> et le <b>commentaire</b> se saisissent ici (cellules vertes) ; le reste se modifie dans « Base de données ».' : 'Consultation seule.')+'</p>'+
    enteteHtml+
    (toutes.length ? corps : emptyState('ruler', 'La base de données de ce contrat / devis ne contient aucun consommateur.', '<p class="hint">Importez ou saisissez les consommateurs dans « Base de données » : la liste se génère toute seule.</p>'));

  byId('eel-projet').addEventListener('change', function(e){ EEL_UI.projetId = e.target.value; renderEtudeListe(mount, actions); });
  byId('eel-export').addEventListener('click', function(){ eelExporter(projet, toutes, sections, ent, saisies); });
  if(canEdit){
    mount.querySelectorAll('.eel-entete input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var k = inp.getAttribute('data-k'), v = inp.value;
        eelSauver(projet, function(){ var p = {}; p[k] = v; return p; })
          .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
      });
    });
    mount.querySelectorAll('td.eel-edit').forEach(function(td){ td.addEventListener('click', function(){ eelEditer(td, projet, saisies, listes); }); });
  }
}

/* ---------- saisie d'un type de cable / d'un commentaire ---------- */
function eelEnregistrerSaisie(projet, consoId, cle, valeur){
  valeur = (valeur === null || valeur === undefined) ? '' : String(valeur).trim();
  return eelSauver(projet, function(doc){
    var lignes = Object.assign({}, (doc && doc.lignes) || {});
    var l = Object.assign({}, lignes[consoId] || {});
    if(valeur === '') delete l[cle]; else l[cle] = valeur;
    if(Object.keys(l).length) lignes[consoId] = l; else delete lignes[consoId];
    return {lignes: lignes};
  }).then(function(){ if(typeof scheduleRender === 'function') scheduleRender(); })
    .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); });
}
function eelEditer(td, projet, saisies, listes){
  if(td.querySelector('input,select')) return;
  var id = td.getAttribute('data-id'), cle = td.getAttribute('data-s');
  var actuel = ((saisies[id] || {})[cle]) || '';
  var fini = false;
  function valider(v){ if(fini) return; fini = true; if(String(v) === String(actuel)){ td.textContent = actuel; return; } eelEnregistrerSaisie(projet, id, cle, v); }
  if(cle === 'typeCable'){
    var vals = (listes.typeCable || []).slice();
    if(actuel && vals.indexOf(actuel) < 0) vals.push(actuel);
    var sel = document.createElement('select'); sel.className = 'ee-cell-input';
    sel.innerHTML = '<option value=""></option>'+vals.map(function(v){ return '<option value="'+esc(v)+'"'+(v===actuel?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+'<option value="__new__">+ Nouvelle valeur…</option>';
    td.textContent = ''; td.appendChild(sel); sel.focus();
    sel.addEventListener('change', function(){
      if(sel.value === '__new__'){
        fini = true;
        eePromptValeurListe('typeCable', function(v){ if(v){ eelEnregistrerSaisie(projet, id, cle, v); } else if(typeof scheduleRender === 'function'){ scheduleRender(); } });
        return;
      }
      valider(sel.value);
    });
    sel.addEventListener('blur', function(){ setTimeout(function(){ if(!fini){ fini = true; td.textContent = actuel; } }, 150); });
    return;
  }
  var inp = document.createElement('input'); inp.className = 'ee-cell-input'; inp.value = actuel; inp.style.minWidth = '200px';
  td.textContent = ''; td.appendChild(inp); inp.focus(); inp.select();
  inp.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); valider(inp.value); }
    else if(e.key === 'Escape'){ fini = true; td.textContent = actuel; }
  });
  inp.addEventListener('blur', function(){ valider(inp.value); });
}

/* ---------- export Excel ---------- */
function eelExporter(projet, toutes, sections, ent, saisies){
  var spec = eeSpecExport(projet, toutes, false);
  spec.filename = 'Liste_des_consommateurs_'+(projet ? projetNumeroDe(projet) || projet.numero : '')+'_'+todayISO().replace(/-/g,'')+'.xlsx';
  var tc = eeListes().typeCable || [];
  if(tc.length) spec.lists.typeCable = tc;
  spec.liste = {
    header: {affaire: ent.affaire, compte: ent.compte, codeDoc: ent.codeDoc, revision: ent.revision, date: ent.dateDoc},
    sections: sections.map(function(sec){
      return {titre: sec.titre, lignes: sec.lignes.map(function(d){
        var s = saisies[d.id] || {};
        return {tag: eelTexte(d.tag), typeCable: s.typeCable || '', commentaire: s.commentaire || ''};
      })};
    })
  };
  toast('Génération du fichier Excel…');
  fetch('/api/etude-elec/export-liste', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec)})
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

if(typeof module !== 'undefined' && module.exports){ module.exports = {eeSectionsAmontAval: eeSectionsAmontAval, eelTotal: eelTotal, eelCle: eelCle}; }
