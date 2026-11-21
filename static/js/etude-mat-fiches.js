/* =========================================================
   V3.43 — ÉTUDE ÉLECTRIQUE : fiches techniques page par page, répertoire dédié, nomenclature
     Nom d'un fichier :  CONSTRUCTEUR_Categorie_Gamme_DonneesSpecifiques.pdf   (ASCII, sans espace ni accent)
       ex. SCHNEIDER_Disjonct-B-C-D_iC60_Alternatif-60898-1-6a63A.pdf
     - emfOuvrirDecoupage : découpe un PDF en pages, lit le titre de chaque page, contrôle avant enregistrement
       (référence absente du catalogue = non importée ; nom déjà existant = remplacer / ignorer)
     - emfOuvrirMigration : renomme les fiches déjà importées selon la même nomenclature
     - emfFichesLigne / emfVoir : accès aux fiches depuis la Base matériel, devant chaque référence
     - emfTri : dans la fenêtre d'une protection, la page qui correspond au calibre / à la courbe vient en premier
   ========================================================= */
var EMF_TYPES = {alternatif: 'Alternatif', continu: 'Continu', moteur: 'Moteur'};
var EMF_ALIAS = {};   /* aucun alias : une gamme doit figurer telle quelle au catalogue (DPN ≠ iDPN, C60 ≠ iC60) */
function emfAscii(s){ return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9+.-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, ''); }
function emfNum(v){ var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
function emfFmtN(n){ return String(n).replace('.', ','); }
function emfPlage(mn, mx){
  if(mx == null) return '';
  var f = function(x){ return String(x).replace(/\.0$/, '').replace('.', ','); };
  return mn ? f(mn) + 'a' + f(mx) + 'A' : 'max' + f(mx) + 'A';
}
function emfNomFichier(cons, categorie, gamme, donnees, ext){
  return [cons, categorie, gamme, donnees].map(function(x){ return emfAscii(x) || 'NA'; }).join('_') + '.' + (ext || 'pdf');
}

/* ---- rattachement d'une page au catalogue : gamme + courbes ---- */
function emfBaseGamme(brut){
  var t = String(brut || '').split('/')[0].trim();
  if(/^reflex/i.test(t) || /-/.test(t)) return '';               /* Reflex, C60H-DC, iC60L-MA : pas des gammes du catalogue */
  t = t.replace(/^(i?[A-Z]+\d+)[a-z]$/, '$1');                     /* iC60a, NG125a */
  t = t.replace(/^([A-Za-z]+\d+)[NHL]$/, '$1');                    /* C120N, iC60N */
  return t;
}
function emfRattache(page, constructeur){
  var base = emfBaseGamme(page.gamme), res = {ok: false, raison: '', gamme: '', jeton: '', categorie: '', courbes: []};
  if(!base){ res.raison = 'gamme « ' + page.gamme + ' » absente du catalogue'; return res; }
  var rows = (STATE.etudeMatDisj || []).filter(function(d){ return d.constructeur === constructeur; }), trouve = null, jeton = '';
  rows.forEach(function(d){
    if(trouve || !d.gamme) return;
    d.gamme.split('/').forEach(function(t){ t = t.trim(); if(!trouve && (t === base || t === EMF_ALIAS[base])){ trouve = d.gamme; jeton = t; } });
  });
  if(!trouve){ res.raison = 'gamme « ' + base + ' » absente du catalogue'; return res; }
  var cats = {}; rows.filter(function(d){ return d.gamme === trouve; }).forEach(function(d){ cats[d.categorie] = true; });
  var courbes = [], pre = '';
  (page.courbes || []).forEach(function(c){
    Object.keys(cats).forEach(function(k){ var m = String(k).match(new RegExp('^(.*?)\\.?\\s+' + c + '$')); if(m && courbes.indexOf(c) < 0){ courbes.push(c); pre = pre || m[1]; } });
  });
  if(!courbes.length){ res.raison = 'courbe(s) ' + (page.courbes || []).join(', ') + ' absente(s) du catalogue pour ' + jeton; return res; }
  res.ok = true; res.gamme = trouve; res.jeton = jeton; res.courbes = courbes; res.categorie = emfAscii(pre || 'Disj') + '-' + courbes.join('-');
  return res;
}
function emfNomPage(constructeur, page, rt){
  var d = [EMF_TYPES[page.type] || 'Fiche'];
  if(page.magnetique) d.push('Magnetique');
  if(page.norme) d.push(page.norme);
  var pl = emfPlage(page.calMin, page.calMax); if(pl) d.push(pl);
  return emfNomFichier(constructeur, rt.categorie, rt.jeton, d.join('-'), 'pdf');
}

/* ---- correspondance d'une fiche avec la protection choisie (courbe, calibre) ---- */
function emfConvient(d, courbe, cal){
  if(Array.isArray(d.courbes) && d.courbes.length && courbe && courbe !== '—' && d.courbes.indexOf(String(courbe)) < 0) return false;
  var mn = emfNum(d.calMin), mx = emfNum(d.calMax);
  if(cal != null && mx != null && (cal > mx || cal < (mn || 0))) return false;
  return true;
}
function emfScore(d, ctx){
  var s = 0, cb = Array.isArray(d.courbes) && d.courbes.length;
  if(emfConvient(d, ctx.courbe, ctx.calibre)) s += cb || d.calMax != null ? 4 : 1; else s -= 4;
  if(d.norme && ctx.normes && String(ctx.normes).indexOf(String(d.norme).replace(/^(\d{5})-/, '$1-')) >= 0) s += 2;
  if(d.typeCourant && ctx.courant && d.typeCourant === ctx.courant) s += 3;
  return s;
}
function emfTri(docs, ctx){
  if(!ctx || (ctx.courbe == null && ctx.calibre == null && !ctx.normes)) return docs;
  return docs.map(function(d, i){ return {d: d, i: i, s: emfScore(d, ctx)}; }).sort(function(a, b){ return b.s - a.s || a.i - b.i; }).map(function(x){ return x.d; });
}
/* fiches rattachées à une ligne de la Base matériel : disjoncteur (gamme, courbe, calibre) ou déclencheur (code + gammes associées) */
function emfFichesLigne(constructeur, ligne, genre){
  if(typeof emdDocsPour !== 'function') return [];
  var docs = [], vu = {}, add = function(l){ l.forEach(function(d){ if(!vu[d.id]){ vu[d.id] = 1; docs.push(d); } }); };
  if(genre === 'disj'){
    if(!emfGammeIntegree(constructeur, ligne.gamme)) return [];      /* déclencheur monté séparément : rien n'est lié à la protection */
    var cal = emfNum(ligne.calibreA != null ? ligne.calibreA : ligne.calibre), l = emdDocsPour(constructeur, '', ligne.gamme);
    var ok = l.filter(function(d){ return emfConvient(d, ligne.courbe, cal); });
    return emfTri(ok.length ? ok : l, {courbe: ligne.courbe, calibre: cal, normes: ligne.normes});
  }
  add(emdDocsPour(constructeur, ligne.code, ''));
  var gam = (STATE.etudeMatAssoc || []).filter(function(a){ return a.constructeur === constructeur && a.declencheur === ligne.code; }).map(function(a){ return a.gamme; });
  var lettres = (String(ligne.code).match(/(?:^|[\s/])([BCDKZ])(?=$|[\s/])/g) || []).map(function(x){ return x.replace(/[\s/]/g, ''); });
  var cal2 = emfNum(ligne.calibreA);
  gam.forEach(function(g){
    if(!emfGammeIntegree(constructeur, g)){      /* déclencheur monté séparément : fiches de la gamme retenues d'après le nom du déclencheur */
      emdDocsPour(constructeur, ligne.code, g).forEach(function(d){ add([d]); });
      return;
    }
    emdDocsPour(constructeur, '', g).forEach(function(d){
      var cb = Array.isArray(d.courbes) ? d.courbes : [];
      if(cb.length && lettres.length && !cb.some(function(c){ return lettres.indexOf(c) >= 0; })) return;
      if(!emfConvient(d, null, cal2)) return;
      add([d]);
    });
  });
  return emfTri(docs, {calibre: cal2});
}
function emfBoutonFiche(constructeur, ligne, genre){
  var n = emfFichesLigne(constructeur, ligne, genre).length;
  return n ? '<button type="button" class="btn btn-sm emf-voir" title="Voir la fiche technique" style="padding:0 6px;">' + ic('file', 13) + ' ' + n + '</button>' : '<span style="color:#aab;" title="Aucune fiche technique pour cette référence">—</span>';
}
function emfVoir(titre, docs){
  var ov = openModal({title: 'Fiches techniques — ' + titre, large: true, foot: '<button type="button" class="btn" data-close-modal>Fermer</button>',
    body: '<div id="emf-liste">' + docs.map(function(d, i){
      return '<div style="display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid #eef;"><span style="background:#eef2fa;border-radius:4px;padding:1px 6px;font-size:11px;">' + esc(EMF_TYPES[d.typeCourant] || emdLib(d.type)) + '</span>' +
        '<span style="flex:1;min-width:0;"><b>' + esc(d.titre) + '</b><span style="color:#889;"> ' + esc(d.fichier || d.url || '') + '</span></span>' +
        '<button type="button" class="btn btn-sm" data-i="' + i + '">Aperçu</button>' + (d.fichier ? '<a class="btn btn-sm" href="' + emdUrl(d, true) + '" download>Télécharger</a>' : '') + '</div>';
    }).join('') + '</div><div id="emf-ap" style="margin-top:8px;"></div>'});
  var voir = function(d){
    if(!d.fichier){ window.open(d.url, '_blank', 'noopener'); return; }
    ov.querySelector('#emf-ap').innerHTML = '<iframe src="' + emdUrl(d) + '" style="width:100%;height:60vh;border:1px solid #ccd;border-radius:6px;"></iframe>';
  };
  ov.querySelectorAll('[data-i]').forEach(function(b){ b.addEventListener('click', function(){ voir(docs[+b.getAttribute('data-i')]); }); });
  if(docs.length && docs[0].fichier) voir(docs[0]);
}

/* ---- découpage d'un ou plusieurs PDF page par page, contrôle, enregistrement ---- */
function emfEnvoyer(url, corps){
  return fetch(url, corps instanceof FormData ? {method: 'POST', body: corps} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(corps)})
    .then(function(r){ return r.text().then(function(t){ var j = null; try { j = t ? JSON.parse(t) : null; } catch(e){} if(!r.ok) throw new Error((j && j.error) || ('Erreur HTTP ' + r.status)); return j; }); });
}
function emfOuvrirDecoupage(constructeur, pre){
  var cons = (STATE.etudeMatConstructeurs || []).slice().sort(function(a, b){ return (a.rang || 0) - (b.rang || 0) || String(a.code).localeCompare(b.code); });
  var ov = openModal({title: 'Découper des fiches PDF page par page', large: true, foot: '<button type="button" class="btn" data-close-modal>Fermer</button><button type="button" class="btn btn-primary" id="emf-go" disabled>Enregistrer</button>',
    body: '<div class="toolbar" style="gap:10px;flex-wrap:wrap;margin-bottom:8px;align-items:center;"><label>Constructeur&nbsp;<select id="emf-cons">' + cons.map(function(k){ return '<option value="' + esc(k.code) + '"' + (k.code === constructeur ? ' selected' : '') + '>' + esc(k.nom || k.code) + '</option>'; }).join('') + '</select></label>' +
      '<input type="file" id="emf-files" accept=".pdf" multiple' + (pre ? ' style="display:none;"' : '') + '><label style="font-weight:400;"><input type="checkbox" id="emf-org" checked style="width:auto;"> conserver aussi le PDF d’origine</label><span id="emf-rep" class="muted"></span></div>' +
      '<p class="hint" style="margin:0 0 8px;">Chaque page est enregistrée dans le répertoire des fiches sous le nom <b>Constructeur_Categorie_Gamme_Données</b>. Les pages dont la gamme ou la courbe n’est pas au catalogue ne sont <b>pas importées</b>. Si un nom existe déjà, choisissez <b>Remplacer</b> ou <b>Ignorer</b>.</p>' +
      '<div id="emf-etat" class="muted"></div><div id="emf-tab"></div>'});
  var $ = function(s){ return ov.querySelector(s); }, groupes = [];
  fetch('/api/etude-elec/docs/dir').then(function(r){ return r.json(); }).then(function(j){ $('#emf-rep').textContent = 'Répertoire : ' + j.dir; }).catch(function(){});
  var K = function(){ return $('#emf-cons').value; };
  function analyser(sources){
    $('#emf-etat').textContent = 'Lecture des pages…'; $('#emf-go').disabled = true; groupes = [];
    var suite = Promise.resolve();
    sources.forEach(function(s){
      suite = suite.then(function(){
        var corps; if(s.file){ corps = new FormData(); corps.append('file', s.file); } else corps = {fichier: s.fichier};
        return emfEnvoyer('/api/etude-elec/docs/pages/analyse', corps).then(function(j){ j.source = s; groupes.push(j); }).catch(function(e){ groupes.push({nom: s.file ? s.file.name : s.fichier, erreur: e.message, pages: [], source: s}); });
      });
    });
    suite.then(function(){ return controle(); }).catch(function(e){ $('#emf-etat').textContent = 'Erreur : ' + e.message; });
  }
  function lignes(){
    var l = [];
    groupes.forEach(function(g, gi){ (g.pages || []).forEach(function(p){
      var rt = emfRattache(p, K()), nom = rt.ok ? emfNomPage(K(), p, rt) : '';
      l.push({g: gi, p: p, rt: rt, nom: nom, jeton: g.jeton});
    }); });
    return l;
  }
  var LIGNES = [];
  function controle(){
    LIGNES = lignes();
    var noms = LIGNES.filter(function(x){ return x.rt.ok; }).map(function(x){ return x.nom; });
    return (noms.length ? emfEnvoyer('/api/etude-elec/docs/existe', {noms: noms}) : Promise.resolve({existants: []})).then(function(r){
      var ex = {}; (r.existants || []).forEach(function(n){ ex[n] = 1; });
      LIGNES.forEach(function(x){ x.existe = !!ex[x.nom]; x.choix = x.existe ? 'remplacer' : 'importer'; x.coche = x.rt.ok; });
      dessiner();
    });
  }
  function dessiner(){
    var nbOk = LIGNES.filter(function(x){ return x.rt.ok; }).length, h = '';
    groupes.filter(function(g){ return g.erreur; }).forEach(function(g){ h += '<div style="color:#b3261e;">' + esc(g.nom) + ' : ' + esc(g.erreur) + '</div>'; });
    h += '<div class="emt-wrap" style="max-height:52vh;overflow:auto;"><table class="emt-t"><thead><tr><th></th><th>Source · page</th><th>Type</th><th>Gamme du PDF</th><th>Courbes</th><th>Calibres</th><th>Norme</th><th>Catalogue</th><th>Nom du fichier</th><th>Si le nom existe</th></tr></thead><tbody>';
    LIGNES.forEach(function(x, i){
      var p = x.p, absent = !x.rt.ok;
      h += '<tr style="' + (absent ? 'opacity:.55;' : '') + '"><td><input type="checkbox" data-c="' + i + '" style="width:auto;"' + (x.coche && !absent ? ' checked' : '') + (absent ? ' disabled' : '') + '></td>' +
        '<td class="c" style="text-align:left;">' + esc(groupes[x.g].nom) + ' · p.' + p.page + '</td><td class="c" style="text-align:left;">' + esc(EMF_TYPES[p.type] || '?') + '</td><td class="c" style="text-align:left;">' + esc(p.gamme) + '</td>' +
        '<td class="c" style="text-align:left;">' + esc((p.courbes || []).join(', ')) + '</td><td class="c" style="text-align:left;">' + esc(emfPlage(p.calMin, p.calMax) || '—') + '</td><td class="c" style="text-align:left;">' + esc(p.norme || '—') + '</td>' +
        '<td class="c" style="text-align:left;' + (absent ? 'color:#b3261e;' : 'color:#1e7a46;') + '">' + (absent ? 'absent — non importée<div style="font-size:11px;">' + esc(x.rt.raison) + '</div>' : esc(x.rt.gamme)) + '</td>' +
        '<td class="c" style="text-align:left;">' + (absent ? '' : '<input data-n="' + i + '" value="' + esc(x.nom) + '" style="width:340px;">') + '</td>' +
        '<td class="c" style="text-align:left;">' + (absent ? '' : (x.existe ? '<select data-s="' + i + '"><option value="remplacer"' + (x.choix === 'remplacer' ? ' selected' : '') + '>Remplacer</option><option value="ignorer"' + (x.choix === 'ignorer' ? ' selected' : '') + '>Ignorer</option></select> <span style="color:#a15c00;">existe déjà</span>' : '<span style="color:#1e7a46;">nouveau</span>')) + '</td></tr>';
    });
    if(!LIGNES.length) h += '<tr><td colspan="10" class="c" style="text-align:left;">Aucune page lue.</td></tr>';
    h += '</tbody></table></div>';
    $('#emf-tab').innerHTML = h;
    $('#emf-etat').textContent = LIGNES.length + ' page(s) lue(s) — ' + nbOk + ' rattachée(s) au catalogue, ' + (LIGNES.length - nbOk) + ' ignorée(s) (absentes du catalogue).';
    $('#emf-go').disabled = !nbOk || !canWrite('etude_elec');
    $('#emf-tab').querySelectorAll('[data-c]').forEach(function(c){ c.addEventListener('change', function(){ LIGNES[+c.getAttribute('data-c')].coche = c.checked; }); });
    $('#emf-tab').querySelectorAll('[data-s]').forEach(function(c){ c.addEventListener('change', function(){ LIGNES[+c.getAttribute('data-s')].choix = c.value; }); });
    $('#emf-tab').querySelectorAll('[data-n]').forEach(function(c){ c.addEventListener('change', function(){
      var x = LIGNES[+c.getAttribute('data-n')]; x.nom = c.value.trim();
      emfEnvoyer('/api/etude-elec/docs/existe', {noms: [x.nom]}).then(function(r){ x.existe = (r.existants || []).length > 0; x.choix = x.existe ? 'remplacer' : 'importer'; dessiner(); });
    }); });
  }
  $('#emf-cons').addEventListener('change', function(){ if(groupes.length) controle(); });
  $('#emf-files').addEventListener('change', function(e){ var f = Array.prototype.slice.call(e.target.files); if(f.length) analyser(f.map(function(x){ return {file: x}; })); });
  if(pre) analyser(pre);
  $('#emf-go').addEventListener('click', function(){
    var choisies = LIGNES.filter(function(x){ return x.rt.ok && x.coche && x.choix !== 'ignorer'; });
    var vu = {}, dbl = false; choisies.forEach(function(x){ if(vu[x.nom]) dbl = true; vu[x.nom] = 1; });
    if(dbl){ toast('Deux pages portent le même nom : modifiez un des noms.', 'danger'); return; }
    if(choisies.some(function(x){ return !/^[A-Za-z0-9][A-Za-z0-9._+-]*\.pdf$/.test(x.nom); })){ toast('Nom invalide (lettres, chiffres, - _ . + seulement, extension .pdf).', 'danger'); return; }
    if(!choisies.length){ toast('Aucune page à enregistrer.', ''); return; }
    var btn = $('#emf-go'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    var org = $('#emf-org').checked, k = K(), total = 0, remp = 0, suite = Promise.resolve();
    groupes.forEach(function(g, gi){
      var mes = choisies.filter(function(x){ return x.g === gi; }); if(!mes.length || !g.jeton) return;
      suite = suite.then(function(){
        var dejaOrg = g.source && g.source.fichier, nomOrg = g.source && g.source.file ? 'Origine_' + emfAscii(g.nom.replace(/\.pdf$/i, '')) + '.pdf' : '';
        var corps = {jeton: g.jeton, pages: mes.map(function(x){ return {page: x.p.page, nom: x.nom}; }), remplacer: mes.filter(function(x){ return x.existe; }).map(function(x){ return x.nom; })};
        if(org && nomOrg){ corps.origine = {nom: k + '_' + nomOrg}; corps.remplacer.push(k + '_' + nomOrg); }
        return emfEnvoyer('/api/etude-elec/docs/pages/enregistrer', corps).then(function(res){
          var ok = {}; (res.enregistres || []).forEach(function(e){ ok[e.nom] = e; });
          var ops = Promise.resolve();
          mes.forEach(function(x){
            var e = ok[x.nom]; if(!e) return;
            var p = x.p, doc = {constructeur: k, type: 'fiche', titre: (x.rt.jeton + ' ' + x.rt.courbes.join(',') + (p.calMax != null ? ' · ' + emfPlage(p.calMin, p.calMax) : '') + ' · ' + (EMF_TYPES[p.type] || '').toLowerCase() + (p.norme ? ' · ' + p.norme : '') + (p.magnetique ? ' · magnétique' : '')).trim(),
              fichier: e.nom, nomFichier: e.nom, taille: e.taille, mime: 'application/pdf', cibles: ['g:' + x.rt.gamme], typeCourant: p.type || null, courbes: x.rt.courbes, calMin: p.calMin, calMax: p.calMax, norme: p.norme || null,
              temperature: p.temp, page: p.page, source: g.nom, dateDoc: p.version ? 'v' + p.version : null, updatedAt: nowISO()};
            var ancien = (STATE.etudeMatDocs || []).filter(function(d){ return d.fichier === e.nom; })[0];
            total++;
            if(ancien){ remp++; ops = ops.then(function(){ return STATE.db.doc('etudeMatDocs/' + ancien.id).update(doc).then(function(){ Object.assign(ancien, doc); }); }); }
            else { doc.createdAt = nowISO(); ops = ops.then(function(){ return STATE.db.collection('etudeMatDocs').add(doc).then(function(ref){ (STATE.etudeMatDocs || (STATE.etudeMatDocs = [])).push(Object.assign({id: ref && ref.id}, doc)); }); }); }
          });
          var eo = nomOrg && ok[k + '_' + nomOrg];
          if(eo && !(STATE.etudeMatDocs || []).some(function(d){ return d.fichier === eo.nom; })){
            var dOrg = {constructeur: k, type: 'notice', titre: 'Document d’origine — ' + g.nom, fichier: eo.nom, nomFichier: eo.nom, taille: eo.taille, mime: 'application/pdf', cibles: null, createdAt: nowISO(), updatedAt: nowISO()};
            ops = ops.then(function(){ return STATE.db.collection('etudeMatDocs').add(dOrg).then(function(ref){ (STATE.etudeMatDocs || (STATE.etudeMatDocs = [])).push(Object.assign({id: ref && ref.id}, dOrg)); }); });
          }
          return ops.then(function(){ if((res.refuses || []).length) toast((res.refuses.length) + ' page(s) refusée(s) : ' + res.refuses.map(function(r){ return r.nom + ' (' + r.raison + ')'; }).join(' ; '), 'danger'); });
        });
      });
    });
    suite.then(function(){
      toast(total + ' fiche(s) enregistrée(s)' + (remp ? ' dont ' + remp + ' remplacée(s)' : ''), 'success');
      /* source = document déjà importé (migration) : proposer de le retirer */
      var src = groupes.filter(function(g){ return g.source && g.source.docId; });
      if(src.length && total) return confirmDialog('Supprimer l’ancien document entier (non découpé) de la liste des fiches ?', {okLabel: 'Supprimer l’ancien'}).then(function(ok){
        if(!ok) return; return Promise.all(src.map(function(g){ var d = (STATE.etudeMatDocs || []).filter(function(x){ return x.id === g.source.docId; })[0]; if(!d) return null;
          return fetch('/api/etude-elec/docs/file/' + encodeURIComponent(d.fichier), {method: 'DELETE'}).catch(function(){}).then(function(){ return deleteDoc('etudeMatDocs', d.id); }).then(function(){ STATE.etudeMatDocs = (STATE.etudeMatDocs || []).filter(function(x){ return x.id !== d.id; }); }); }));
      });
    }).then(function(){ closeModal(); if(typeof scheduleRender === 'function') scheduleRender(); })
      .catch(function(e){ toast('Erreur : ' + e.message, 'danger'); btn.disabled = false; btn.textContent = 'Enregistrer'; });
  });
}

/* ---- migration : renommer les fiches déjà importées selon la nomenclature ---- */
function emfConforme(nom){ if(/^[A-Za-z0-9-]+_Origine_[A-Za-z0-9._+-]+$/.test(String(nom || ''))) return true; return /^[A-Za-z0-9-]+_[A-Za-z0-9.+-]+_[A-Za-z0-9.+-]+_[A-Za-z0-9._+-]+\.[a-z]{3,4}$/.test(String(nom || '')) && !/^[0-9a-f]{10}_/.test(nom); }
function emfNomMigre(d){
  var cons = d.constructeur || 'GENERAL', cb = Array.isArray(d.cibles) ? d.cibles : [], gam = '', cat = '', dec = d.declencheur || '';
  var cg = cb.filter(function(x){ return x.indexOf('g:') === 0; })[0], cd = cb.filter(function(x){ return x.indexOf('d:') === 0; })[0], cf = cb.filter(function(x){ return x.indexOf('f:') === 0; })[0];
  if(cg){
    var g = cg.slice(2), rt = emfRattache({gamme: g.split('/')[0].trim(), courbes: ['B', 'C', 'D', 'K', 'Z']}, cons);
    gam = (g.split('/')[0] || g).trim();
    var cs = {}; (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === cons && x.gamme === g; }).forEach(function(x){ var m = String(x.categorie).match(/^(.*?)\.?\s+([A-Z]{1,2})$/); if(m){ cs[m[1]] = cs[m[1]] || []; if(cs[m[1]].indexOf(m[2]) < 0) cs[m[1]].push(m[2]); } });
    var k0 = Object.keys(cs)[0]; cat = k0 ? emfAscii(k0) + '-' + cs[k0].sort().join('-') : 'Disj';
    void rt;
  } else if(cd){ dec = cd.slice(2); cat = 'Declencheur'; gam = (emdDecl(cons, dec) || {}).serie || dec; }
  else if(cf){ cat = 'Famille'; gam = cf.slice(2); }
  else { cat = 'Divers'; gam = 'General'; }
  var ext = String(d.fichier || '').split('.').pop().toLowerCase() || 'pdf';
  var don = [emfAscii(emdLib(d.type)), emfAscii(String(d.titre || '').slice(0, 45))].filter(Boolean).join('-');
  return emfNomFichier(cons, cat, gam, don, ext);
}
function emfOuvrirMigration(constructeur){
  var docs = (STATE.etudeMatDocs || []).filter(function(d){ return d.fichier && !emfConforme(d.fichier) && (!constructeur || !d.constructeur || d.constructeur === constructeur); });
  var ov = openModal({title: 'Mettre à la nouvelle nomenclature les fiches déjà importées', large: true, foot: '<button type="button" class="btn" data-close-modal>Fermer</button><button type="button" class="btn btn-primary" id="emm2-go"' + (docs.length ? '' : ' disabled') + '>Renommer les cochées</button>',
    body: '<p class="hint" style="margin:0 0 8px;">Les fichiers sont renommés <b>Constructeur_Categorie_Gamme_Données</b> dans le répertoire des fiches ; les liens vers les déclencheurs sont conservés. Un fichier PDF de plusieurs pages peut en plus être <b>découpé page par page</b>.</p><div id="emm2-tab"></div>'});
  var L = docs.map(function(d){ return {d: d, nom: emfNomMigre(d), coche: true, choix: 'remplacer'}; });
  var noms = {}; L.forEach(function(x){ noms[x.nom] = (noms[x.nom] || 0) + 1; });
  L.forEach(function(x){ if(noms[x.nom] > 1) x.nom = x.nom.replace(/(\.[a-z]+)$/, '-' + emfAscii(x.d.id).slice(0, 4) + '$1'); });
  function dessiner(){
    var h = '<div class="emt-wrap" style="max-height:55vh;overflow:auto;"><table class="emt-t"><thead><tr><th></th><th>Fichier actuel</th><th>Titre</th><th>Nouveau nom</th><th>Si le nom existe</th><th></th></tr></thead><tbody>';
    L.forEach(function(x, i){
      h += '<tr><td><input type="checkbox" data-c="' + i + '" style="width:auto;"' + (x.coche ? ' checked' : '') + '></td><td class="c" style="text-align:left;">' + esc(x.d.fichier) + '</td><td class="c" style="text-align:left;">' + esc(x.d.titre) + '</td>' +
        '<td class="c" style="text-align:left;"><input data-n="' + i + '" value="' + esc(x.nom) + '" style="width:330px;"></td>' +
        '<td class="c" style="text-align:left;">' + (x.existe ? '<select data-s="' + i + '"><option value="remplacer">Remplacer</option><option value="ignorer"' + (x.choix === 'ignorer' ? ' selected' : '') + '>Ignorer</option></select> <span style="color:#a15c00;">existe déjà</span>' : '<span style="color:#1e7a46;">libre</span>') + '</td>' +
        '<td class="c">' + (/\.pdf$/i.test(x.d.fichier) ? '<button type="button" class="btn btn-sm" data-d="' + i + '">Découper…</button>' : '') + '</td></tr>';
    });
    if(!L.length) h += '<tr><td colspan="6" class="c" style="text-align:left;">Toutes les fiches respectent déjà la nomenclature.</td></tr>';
    ov.querySelector('#emm2-tab').innerHTML = h + '</tbody></table></div>';
    ov.querySelectorAll('[data-c]').forEach(function(c){ c.addEventListener('change', function(){ L[+c.getAttribute('data-c')].coche = c.checked; }); });
    ov.querySelectorAll('[data-s]').forEach(function(c){ c.addEventListener('change', function(){ L[+c.getAttribute('data-s')].choix = c.value; }); });
    ov.querySelectorAll('[data-n]').forEach(function(c){ c.addEventListener('change', function(){ L[+c.getAttribute('data-n')].nom = c.value.trim(); verif().then(dessiner); }); });
    ov.querySelectorAll('[data-d]').forEach(function(c){ c.addEventListener('click', function(){ var x = L[+c.getAttribute('data-d')]; emfOuvrirDecoupage(x.d.constructeur || constructeur, [{fichier: x.d.fichier, docId: x.d.id}]); }); });
  }
  function verif(){
    return emfEnvoyer('/api/etude-elec/docs/existe', {noms: L.map(function(x){ return x.nom; })}).then(function(r){ var e = {}; (r.existants || []).forEach(function(n){ e[n] = 1; }); L.forEach(function(x){ x.existe = !!e[x.nom] && x.nom !== x.d.fichier; }); });
  }
  verif().then(dessiner).catch(dessiner);
  ov.querySelector('#emm2-go').addEventListener('click', function(){
    var btn = ov.querySelector('#emm2-go'); btn.disabled = true;
    var faits = 0, suite = Promise.resolve();
    L.filter(function(x){ return x.coche && !(x.existe && x.choix === 'ignorer'); }).forEach(function(x){
      suite = suite.then(function(){
        return emfEnvoyer('/api/etude-elec/docs/renommer', {fichier: x.d.fichier, nouveau: x.nom, remplacer: !!x.existe}).then(function(r){
          var patch = {fichier: r.fichier, nomFichier: r.fichier, updatedAt: nowISO()};
          return STATE.db.doc('etudeMatDocs/' + x.d.id).update(patch).then(function(){ Object.assign(x.d, patch); faits++; });
        }).catch(function(e){ toast(x.d.fichier + ' : ' + e.message, 'danger'); });
      });
    });
    suite.then(function(){ toast(faits + ' fiche(s) renommée(s)', 'success'); closeModal(); if(typeof scheduleRender === 'function') scheduleRender(); });
  });
}

/* =========================================================
   V3.44 — fiches et déclencheurs montés séparément
   - Protection à déclencheur INTÉGRÉ (iC60, NG125…, association « Intégré … ») : fiches par gamme + courbe + calibre (comme en V3.43).
   - Protection à déclencheur MONTÉ SÉPARÉMENT (ComPacT NSX : TM-D, MA, MicroLogic…) : aucune fiche liée à la protection ni à la gamme ;
     les fiches ne dépendent que du déclencheur choisi.
   ========================================================= */
function emfGammeIntegree(cons, gamme){
  var a = (STATE.etudeMatAssoc || []).filter(function(x){ return x.constructeur === cons && x.gamme === gamme; });
  if(!a.length) return true;
  return a.some(function(x){ return /^int[eé]gr/i.test(x.declencheur || ''); });
}
/* le texte d'une fiche (titre, nom de fichier) vise-t-il ce déclencheur ? TM80D dans « TM80D-a-TM250D », MA50 dans « Moteurs-MA », « Micrologic 2.2 » dans « MicroLogic-2.2-4.2 » */
function emfDeclDansTexte(code, texte){
  code = String(code || '').trim(); texte = String(texte || '');
  var m = code.match(/^TM(\d+)([DG])$/i), x, re, r;
  if(m){
    x = +m[1]; re = new RegExp('TM(\\d+)' + m[2].toUpperCase() + '(?:-a-TM(\\d+)' + m[2].toUpperCase() + '|-TM(\\d+)' + m[2].toUpperCase() + ')?', 'g');
    while((r = re.exec(texte))){ var a = +r[1]; if(r[2]){ if(x >= a && x <= +r[2]) return true; } else if(r[3]){ if(x === a || x === +r[3]) return true; } else if(x === a) return true; }
    return false;
  }
  if(/^MA\d/i.test(code)) return /(^|[-_ ])MA(?![A-Za-z0-9])/.test(texte);
  m = code.match(/^Micrologic\s+(\d\.\d)\s*([A-Za-z](?:-[A-Za-z])?)?$/i);
  if(m){
    var ver = m[1], suf = (m[2] || '').toUpperCase(), i = texte.toLowerCase().indexOf('micrologic');
    if(i < 0) return false;
    re = /(\d\.\d)([A-Za-z]?)(?![A-Za-z])/g; var t = texte.slice(i);
    while((r = re.exec(t))){ if(r[1] === ver && r[2].toUpperCase() === suf) return true; }
    return false;
  }
  var n = function(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }, pre = n(code).replace(/\d+$/, '');
  return pre.length >= 4 && n(texte).indexOf(pre) >= 0;
}
