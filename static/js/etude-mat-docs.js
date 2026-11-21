/* =========================================================
   V3.36 — ÉTUDE ÉLECTRIQUE : fiches techniques et courbes de déclenchement des déclencheurs
   Collections : etudeMatDocs (fiche : fichier sur disque data/etude_materiel_docs/ ou lien web ; rattachée à un déclencheur ou à une famille / série)
                 etudeMatCourbes (extra.series = [{nom, pts:[[courant, temps], ...]}], abscisse « × Ir » | « × In » | « A »)
   Panneau réutilisable : emdPanneau(hote, constructeur, code, {ecriture}) — utilisé dans l'onglet « Déclencheur » de la fenêtre de protection
   et, sans déclencheur précis, dans « Fiches techniques » (emdOuvrirBiblio) du catalogue des protections.
   ========================================================= */
var EMD_TYPES = [['fiche', 'Fiche technique'], ['courbe', 'Courbe de déclenchement'], ['notice', 'Notice / guide'], ['autre', 'Autre']];
var EMD_COULEURS = ['#1f5fa8', '#c0392b', '#2e8b57', '#b9770e', '#7d3c98'];
function emdLib(t){ var x = EMD_TYPES.filter(function(a){ return a[0] === t; })[0]; return x ? x[1] : 'Document'; }
function emdDecl(constructeur, code){ return (STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === constructeur && x.code === code; })[0] || null; }
function emdDocsPour(constructeur, code, gamme){
  var dc = code ? emdDecl(constructeur, code) : null, serie = dc ? dc.serie : '';
  var integre = !gamme || typeof emfGammeIntegree !== 'function' || emfGammeIntegree(constructeur, gamme);   /* V3.44 : déclencheur monté séparément = fiches liées au seul déclencheur */
  return (STATE.etudeMatDocs || []).filter(function(d){
    if(d.constructeur && d.constructeur !== constructeur) return false;
    var cb = Array.isArray(d.cibles) ? d.cibles : [];
    if(code && d.declencheur && d.declencheur === code) return true;
    if(code && (cb.indexOf('d:' + code) >= 0 || cb.indexOf(code) >= 0)) return true;
    if(serie && cb.indexOf('f:' + serie) >= 0) return true;
    if(gamme && cb.indexOf('g:' + gamme) >= 0){ if(integre) return true; if(code && emfDeclDansTexte(code, [d.titre, d.nomFichier, d.fichier].join(' '))) return true; }
    return !!(d.famille && serie && d.famille === serie);
  }).sort(function(a, b){ return String(a.type).localeCompare(b.type) || String(a.titre).localeCompare(b.titre, 'fr'); });
}
/* Cibles possibles d'une fiche pour un constructeur : gammes, familles, déclencheurs ; presets (Acti9 = disjoncteurs modulaires) */
function emdItemsCibles(constructeur){
  var cmp = function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); }, gam = [], ser = [];
  (STATE.etudeMatDisj || []).forEach(function(x){ if(x.constructeur === constructeur && x.gamme && gam.indexOf(x.gamme) < 0) gam.push(x.gamme); });
  var decl = (STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === constructeur; });
  decl.forEach(function(x){ if(x.serie && ser.indexOf(x.serie) < 0) ser.push(x.serie); });
  return gam.sort(cmp).map(function(g){ return ['g:' + g, 'Gamme', g]; }).concat(ser.sort(cmp).map(function(g){ return ['f:' + g, 'Famille', g]; })).concat(decl.map(function(x){ return x.code; }).sort(cmp).map(function(c){ return ['d:' + c, 'Déclencheur', c]; }));
}
var EMD_PRESETS = [
  ['Acti9 — disjoncteurs modulaires', /^g:(iC60|iC40|iK60|iDPN|iC120|NG125|iDT40|iDD40|iID|C60|C120|DPN)/i, 'Gammes iC60, iC40, iK60, iDPN, iC120 / C120, NG125, iDT40, iDD40, iID'],
  ['ComPacT NSX', /^g:ComPacT NSX/i, 'Gammes ComPacT NSX100 à NSX630 et NSXm'],
  ['MasterPact / ComPacT NS', /^g:(MasterPact|ComPacT NS[0-9])/i, 'Gammes MasterPact NT, NW, MTZ et ComPacT NS'],
  ['TeSys (GV2, GV3, GV4)', /^g:GV/i, 'Gammes GV2, GV3, GV4']
];
/* Liste à cocher réutilisable : retourne le HTML ; emdListeLier(root, onChange) branche filtre / presets ; emdListeLire(root) donne les cibles cochées */
function emdListeHtml(items, sel){
  return '<div style="display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;"><input class="emd-lf" placeholder="Filtrer (ex. iC60, Intégré, Micrologic…)" style="flex:1;min-width:160px;"><button type="button" class="btn btn-sm emd-lall">Cocher les affichés</button><button type="button" class="btn btn-sm emd-lnone">Décocher les affichés</button></div>' +
    '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">' + EMD_PRESETS.map(function(p, i){ return '<button type="button" class="btn btn-sm emd-lpre" data-p="' + i + '" title="' + esc(p[2]) + '">+ ' + esc(p[0]) + '</button>'; }).join('') + '</div>' +
    '<div class="emd-llist" style="max-height:190px;overflow:auto;border:1px solid #dde;border-radius:6px;padding:4px;background:#fff;">' + items.map(function(it){ return '<label data-t="' + esc((it[1] + ' ' + it[2]).toLowerCase()) + '" data-v="' + esc(it[0]) + '" style="display:flex;gap:6px;align-items:center;font-weight:400;padding:1px 2px;"><input type="checkbox" style="width:auto;" value="' + esc(it[0]) + '"' + (sel[it[0]] ? ' checked' : '') + '> <span style="color:#889;min-width:78px;">' + it[1] + '</span> ' + esc(it[2]) + '</label>'; }).join('') + '</div>';
}
function emdListeLier(root, onChange){
  var rows = function(){ return Array.prototype.slice.call(root.querySelectorAll('.emd-llist label')); }, ch = function(){ if(onChange) onChange(); };
  root.querySelectorAll('.emd-llist input').forEach(function(i){ i.addEventListener('change', ch); });
  root.querySelector('.emd-lf').addEventListener('input', function(e){ var q = e.target.value.trim().toLowerCase(); rows().forEach(function(l){ l.style.display = !q || l.getAttribute('data-t').indexOf(q) >= 0 ? 'flex' : 'none'; }); });
  var tout = function(v){ rows().forEach(function(l){ if(l.style.display !== 'none') l.querySelector('input').checked = v; }); ch(); };
  root.querySelector('.emd-lall').addEventListener('click', function(){ tout(true); }); root.querySelector('.emd-lnone').addEventListener('click', function(){ tout(false); });
  root.querySelectorAll('.emd-lpre').forEach(function(b){ b.addEventListener('click', function(){ var re = EMD_PRESETS[+b.getAttribute('data-p')][1]; rows().forEach(function(l){ if(re.test(l.getAttribute('data-v'))) l.querySelector('input').checked = true; }); ch(); }); });
}
function emdListeLire(root){ return Array.prototype.slice.call(root.querySelectorAll('.emd-llist input:checked')).map(function(i){ return i.value; }); }
function emdUrl(d, tel){
  if(d.fichier) return '/api/etude-elec/docs/file/' + encodeURIComponent(d.fichier) + (tel ? '?dl=1&name=' + encodeURIComponent(d.nomFichier || d.fichier) : '');
  return d.url || '#';
}
function emdFmtTaille(n){ n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko'; }

/* ---- courbes : saisie « courant ; temps » par série, tracé log-log ---- */
function emdParseSeries(txt){
  var series = [], cur = null;
  String(txt || '').split(/\r?\n/).forEach(function(l){
    l = l.trim(); if(!l) return;
    var m = l.match(/^#\s*(.*)$/);
    if(m){ cur = {nom: m[1].replace(/^s[ée]rie\s*:?\s*/i, '').trim() || 'Série ' + (series.length + 1), pts: []}; series.push(cur); return; }
    var p = l.split(/\s*[;\t]\s*|\s{2,}/);
    if(p.length < 2) return;
    var x = parseFloat(p[0].replace(',', '.')), y = parseFloat(p[1].replace(',', '.'));
    if(!isFinite(x) || !isFinite(y) || x <= 0 || y <= 0) return;
    if(!cur){ cur = {nom: 'Série 1', pts: []}; series.push(cur); }
    cur.pts.push([x, y]);
  });
  return series.filter(function(s){ return s.pts.length; });
}
function emdSeriesTexte(series){
  return (series || []).map(function(s){ return '# ' + s.nom + '\n' + s.pts.map(function(p){ return String(p[0]).replace('.', ',') + ' ; ' + String(p[1]).replace('.', ','); }).join('\n'); }).join('\n');
}
function emdSvgCourbe(series, abscisse){
  var W = 440, H = 280, ml = 46, mb = 34, mt = 10, mr = 10, pts = [];
  (series || []).forEach(function(s){ s.pts.forEach(function(p){ pts.push(p); }); });
  if(!pts.length) return '<div class="hint">Aucun point à tracer.</div>';
  var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
  var x0 = Math.floor(Math.log10(Math.min.apply(null, xs))), x1 = Math.ceil(Math.log10(Math.max.apply(null, xs))); if(x1 <= x0) x1 = x0 + 1;
  var y0 = Math.floor(Math.log10(Math.min.apply(null, ys))), y1 = Math.ceil(Math.log10(Math.max.apply(null, ys))); if(y1 <= y0) y1 = y0 + 1;
  var X = function(v){ return ml + (Math.log10(v) - x0) / (x1 - x0) * (W - ml - mr); }, Y = function(v){ return H - mb - (Math.log10(v) - y0) / (y1 - y0) * (H - mb - mt); };
  var g = '', i, k;
  for(i = x0; i <= x1; i++){
    for(k = 1; k < 10; k++){ var vx = k * Math.pow(10, i); if(Math.log10(vx) > x1) break; g += '<line x1="' + X(vx) + '" y1="' + mt + '" x2="' + X(vx) + '" y2="' + (H - mb) + '" stroke="' + (k === 1 ? '#b9c2d0' : '#e6eaf0') + '" stroke-width="' + (k === 1 ? 1 : 0.6) + '"/>'; }
    g += '<text x="' + X(Math.pow(10, i)) + '" y="' + (H - mb + 14) + '" font-size="10" text-anchor="middle" fill="#556">' + Math.pow(10, i).toLocaleString('fr-FR') + '</text>';
  }
  for(i = y0; i <= y1; i++){
    for(k = 1; k < 10; k++){ var vy = k * Math.pow(10, i); if(Math.log10(vy) > y1) break; g += '<line x1="' + ml + '" y1="' + Y(vy) + '" x2="' + (W - mr) + '" y2="' + Y(vy) + '" stroke="' + (k === 1 ? '#b9c2d0' : '#e6eaf0') + '" stroke-width="' + (k === 1 ? 1 : 0.6) + '"/>'; }
    g += '<text x="' + (ml - 5) + '" y="' + (Y(Math.pow(10, i)) + 3) + '" font-size="10" text-anchor="end" fill="#556">' + Math.pow(10, i).toLocaleString('fr-FR') + '</text>';
  }
  g += '<rect x="' + ml + '" y="' + mt + '" width="' + (W - ml - mr) + '" height="' + (H - mb - mt) + '" fill="none" stroke="#889"/>';
  g += '<text x="' + ((ml + W - mr) / 2) + '" y="' + (H - 4) + '" font-size="10.5" text-anchor="middle" fill="#334">courant (' + esc(abscisse || '× Ir') + ')</text>';
  g += '<text transform="translate(11 ' + ((mt + H - mb) / 2) + ') rotate(-90)" font-size="10.5" text-anchor="middle" fill="#334">temps de déclenchement (s)</text>';
  series.forEach(function(s, n){
    var c = EMD_COULEURS[n % EMD_COULEURS.length];
    g += '<polyline fill="none" stroke="' + c + '" stroke-width="1.8" points="' + s.pts.map(function(p){ return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    g += '<text x="' + (ml + 8) + '" y="' + (H - mb - 8 - (series.length - 1 - n) * 13) + '" font-size="10.5" fill="' + c + '">— ' + esc(s.nom) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:520px;background:#fff;border:1px solid #dde;border-radius:6px;">' + g + '</svg>';
}

/* ---- panneau ---- */
function emdPanneau(hote, constructeur, code, opt){
  opt = opt || {};
  var ecr = opt.ecriture !== false && canWrite('etude_elec');
  var docs = (code || opt.gamme) ? emdDocsPour(constructeur, code, opt.gamme) : (STATE.etudeMatDocs || []).filter(function(d){ return !constructeur || !d.constructeur || d.constructeur === constructeur; });
  if(typeof emfTri === 'function') docs = emfTri(docs, opt);
  var courbes = (STATE.etudeMatCourbes || []).filter(function(c){ return c.declencheur === code && (!c.constructeur || c.constructeur === constructeur); });
  var h = '<div class="emd">';
  h += '<div style="font-weight:600;margin:2px 0 4px;">Fiches techniques' + (docs.length ? ' (' + docs.length + ')' : '') + '</div>';
  if(!docs.length) h += '<div style="color:#667;">Aucune fiche pour ce choix' + (ecr ? ' — ajoutez un PDF, une image ou un lien ci-dessous.' : '.') + '</div>';
  docs.forEach(function(d){
    var cb = Array.isArray(d.cibles) ? d.cibles : [];
    var portee = cb.length ? ' · ' + esc(cb.length > 3 ? cb.slice(0, 3).map(function(x){ return x.slice(2); }).join(', ') + '… (' + cb.length + ' cibles)' : cb.map(function(x){ return x.slice(2); }).join(', ')) : (d.declencheur ? '' : (d.famille ? ' · toute la famille « ' + esc(d.famille) + ' »' : ' · tout le constructeur'));
    h += '<div class="emd-doc" style="display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid #eef;">' +
      '<span style="background:#eef2fa;border-radius:4px;padding:1px 6px;font-size:11px;white-space:nowrap;">' + esc(emdLib(d.type)) + (d.typeCourant && typeof EMF_TYPES !== 'undefined' ? ' · ' + esc(EMF_TYPES[d.typeCourant]) : '') + '</span>' + (typeof emfConvient === 'function' && (opt.courbe != null || opt.calibre != null) && (d.courbes || d.calMax != null) ? (emfConvient(d, opt.courbe, opt.calibre) ? '<span title="Correspond au calibre et à la courbe choisis" style="color:#1e7a46;">✔</span>' : '<span title="Autre calibre ou autre courbe que celui choisi" style="color:#a15c00;">≠</span>') : '') +
      '<span style="flex:1;min-width:0;"><b>' + esc(d.titre) + '</b>' + portee + '<span style="color:#889;"> ' + (d.fichier ? '· ' + esc(d.nomFichier || '') + ' ' + emdFmtTaille(d.taille) : '· lien web') + (d.dateDoc ? ' · ' + esc(d.dateDoc) : '') + '</span>' + (d.remarque ? '<div style="color:#667;font-size:11.5px;">' + esc(d.remarque) + '</div>' : '') + '</span>' +
      '<button type="button" class="btn btn-sm" data-emd-voir="' + esc(d.id) + '">' + (d.fichier ? 'Aperçu' : 'Ouvrir') + '</button>' +
      (d.fichier ? '<a class="btn btn-sm" href="' + emdUrl(d, true) + '" download>Télécharger</a>' : '') +
      (ecr ? '<button type="button" class="btn btn-sm" data-emd-mod="' + esc(d.id) + '">Modifier</button>' : '') +
      (ecr ? '<button type="button" class="btn btn-sm" data-emd-sup="' + esc(d.id) + '" title="Supprimer cette fiche">✕</button>' : '') + '</div>';
  });
  h += '<div id="emd-apercu" style="margin-top:6px;"></div><div id="emd-edit"></div>';
  if(ecr){
    h += '<details style="margin-top:6px;"><summary style="cursor:pointer;color:#1f5fa8;">+ Ajouter une fiche (fichier ou lien)</summary><div class="ecc-f" style="margin-top:6px;">' +
      '<div class="field"><label>Type</label><select id="emd-type">' + EMD_TYPES.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Titre</label><input id="emd-titre" placeholder="ex. Micrologic 5.0 — courbes de déclenchement"></div>' +
      ((code || opt.gamme) ? '<div class="field"><label>S\'applique à</label><select id="emd-portee">' + (code ? '<option value="decl">ce déclencheur (' + esc(code) + ')</option>' : '') + ((code && (emdDecl(constructeur, code) || {}).serie) ? '<option value="fam">toute la famille « ' + esc(emdDecl(constructeur, code).serie) + ' »</option>' : '') + (opt.gamme ? '<option value="gam">toute la gamme « ' + esc(opt.gamme) + ' »</option>' : '') + '</select></div>' : '<div class="field"><label>Déclencheur / famille</label><input id="emd-cible" placeholder="code du déclencheur ou famille"></div>') +
      '<div class="field"><label>Fichier (PDF, PNG, JPG, SVG)</label><input type="file" id="emd-fichier" accept=".pdf,.png,.jpg,.jpeg,.svg,.webp"></div>' +
      '<div class="field"><label>… ou lien web</label><input id="emd-url" placeholder="https://…"><label style="font-weight:400;display:flex;gap:6px;align-items:center;margin-top:3px;" title="Le serveur télécharge le fichier (domaines constructeurs autorisés) et le range comme un fichier envoyé"><input type="checkbox" id="emd-dl" style="width:auto;" checked> Télécharger et stocker le fichier</label></div>' +
      '<div class="field"><label>Date du document</label><input id="emd-date" placeholder="ex. 06/2024"></div>' +
      '<div class="field" style="grid-column:1/-1;"><label>Remarque</label><input id="emd-rem"></div>' +
      '<div style="grid-column:1/-1;"><button type="button" class="btn btn-primary btn-sm" id="emd-ajout">Ajouter la fiche</button> <span id="emd-msg" style="color:#b3261e;"></span></div></div></details>';
  }
  /* courbes de déclenchement */
  if(code){
    h += '<div style="font-weight:600;margin:12px 0 4px;">Courbes de déclenchement' + (courbes.length ? ' (' + courbes.length + ')' : '') + '</div>';
    if(!courbes.length) h += '<div style="color:#667;">Aucune courbe saisie.' + (ecr ? ' Saisissez des points « courant ; temps » (relevés sur la fiche technique).' : '') + '</div>';
    courbes.forEach(function(c){
      h += '<div style="margin:4px 0;"><div style="display:flex;gap:8px;align-items:center;"><b style="flex:1;">' + esc(c.nom) + '</b>' + (ecr ? '<button type="button" class="btn btn-sm" data-emd-cmod="' + esc(c.id) + '">Modifier</button><button type="button" class="btn btn-sm" data-emd-csup="' + esc(c.id) + '">✕</button>' : '') + '</div>' + emdSvgCourbe(c.series || [], c.abscisse) + '</div>';
    });
    if(ecr) h += '<button type="button" class="btn btn-sm" id="emd-cnew" style="margin-top:4px;">+ Nouvelle courbe</button><div id="emd-cform"></div>';
  }
  h += '</div>';
  hote.innerHTML = h;
  var refaire = function(){ emdPanneau(hote, constructeur, code, opt); if(typeof opt.apres === 'function') opt.apres(); };
  var $ = function(id){ return hote.querySelector('#' + id); };
  var docDe = function(id){ return (STATE.etudeMatDocs || []).filter(function(x){ return x.id === id; })[0]; };
  hote.querySelectorAll('[data-emd-voir]').forEach(function(b){ b.addEventListener('click', function(){
    var d = docDe(b.getAttribute('data-emd-voir')); if(!d) return;
    if(!d.fichier){ window.open(d.url, '_blank', 'noopener'); return; }
    var ap = $('emd-apercu'), ext = String(d.fichier).split('.').pop().toLowerCase();
    ap.innerHTML = ext === 'pdf' ? '<iframe src="' + emdUrl(d) + '" style="width:100%;height:480px;border:1px solid #ccd;border-radius:6px;"></iframe>' : '<img src="' + emdUrl(d) + '" style="max-width:100%;border:1px solid #ccd;border-radius:6px;">';
    ap.scrollIntoView({block: 'nearest'});
  }); });
  hote.querySelectorAll('[data-emd-mod]').forEach(function(b){ b.addEventListener('click', function(){ var d = docDe(b.getAttribute('data-emd-mod')); if(d) formModif(d); }); });
  function formModif(d){
    var cons = d.constructeur || constructeur;
    var sel = {}; (Array.isArray(d.cibles) ? d.cibles : []).forEach(function(x){ sel[x] = 1; });
    if(d.declencheur) sel['d:' + d.declencheur] = 1; if(d.famille) sel['f:' + d.famille] = 1;
    var items = emdItemsCibles(cons);
    var E = $('emd-edit');
    E.innerHTML = '<div class="ecc-f" style="margin-top:8px;border:1px solid #9fb3d1;border-radius:6px;padding:8px;background:#f8fbff;">' +
      '<div style="grid-column:1/-1;font-weight:600;">Modifier la fiche</div>' +
      '<div class="field"><label>Titre</label><input id="emd-mt" value="' + esc(d.titre) + '"></div>' +
      '<div class="field"><label>Type</label><select id="emd-mty">' + EMD_TYPES.map(function(t){ return '<option value="' + t[0] + '"' + (d.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Date du document</label><input id="emd-md" value="' + esc(d.dateDoc || '') + '"></div>' +
      '<div class="field"><label>Remarque</label><input id="emd-mr" value="' + esc(d.remarque || '') + '"></div>' +
      '<div class="field" style="grid-column:1/-1;"><label>S\'applique à (gammes, familles, déclencheurs) — <span id="emd-mcount"></span></label><div id="emd-mliste">' + emdListeHtml(items, sel) + '</div>' +
      '<div style="color:#667;font-size:11.5px;margin-top:2px;">Une fiche liée à une gamme apparaît dans la fenêtre de toutes les protections de cette gamme, quel que soit le déclencheur. Aucune case cochée = fiche du constructeur en général (visible dans la bibliothèque seulement).</div></div>' +
      '<div style="grid-column:1/-1;"><button type="button" class="btn btn-primary btn-sm" id="emd-mok">Enregistrer</button> <button type="button" class="btn btn-sm" id="emd-mann">Annuler</button> <span id="emd-mmsg" style="color:#b3261e;"></span></div></div>';
    var M = function(id){ return E.querySelector('#' + id); };
    var compte = function(){ M('emd-mcount').textContent = emdListeLire(E).length + ' coché(s)'; };
    emdListeLier(M('emd-mliste'), compte); compte();
    M('emd-mann').addEventListener('click', function(){ E.innerHTML = ''; });
    M('emd-mok').addEventListener('click', function(){
      var titre = M('emd-mt').value.trim(); if(!titre){ M('emd-mmsg').textContent = 'Titre obligatoire.'; return; }
      var cibles = emdListeLire(E);
      var patch = {titre: titre, type: M('emd-mty').value, dateDoc: M('emd-md').value.trim() || null, remarque: M('emd-mr').value.trim() || null, cibles: cibles.length ? cibles : null, declencheur: null, famille: null, updatedAt: nowISO()};
      STATE.db.doc('etudeMatDocs/' + d.id).update(patch).then(function(){ Object.assign(d, patch); toast('Fiche modifiée', 'success'); refaire(); }).catch(function(){ M('emd-mmsg').textContent = 'Erreur d\'enregistrement'; });
    });
    E.scrollIntoView({block: 'nearest'});
  }
  hote.querySelectorAll('[data-emd-sup]').forEach(function(b){ b.addEventListener('click', function(){
    if(b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Confirmer ?'; setTimeout(function(){ if(b.isConnected){ b.setAttribute('data-sure', ''); b.textContent = '✕'; } }, 3500); return; }
    var d = docDe(b.getAttribute('data-emd-sup')); if(!d) return;
    var p = d.fichier ? fetch('/api/etude-elec/docs/file/' + encodeURIComponent(d.fichier), {method: 'DELETE'}).catch(function(){}) : Promise.resolve();
    p.then(function(){ return deleteDoc('etudeMatDocs', d.id); }).then(function(){ STATE.etudeMatDocs = (STATE.etudeMatDocs || []).filter(function(x){ return x.id !== d.id; }); toast('Fiche supprimée', 'success'); refaire(); }).catch(function(){ toast('Suppression impossible', 'danger'); });
  }); });
  if($('emd-ajout')) $('emd-ajout').addEventListener('click', function(){
    var titre = $('emd-titre').value.trim(), f = $('emd-fichier').files[0], url = $('emd-url').value.trim(), msg = $('emd-msg');
    if(!titre){ msg.textContent = 'Titre obligatoire.'; return; }
    if(!f && !url){ msg.textContent = 'Choisissez un fichier ou saisissez un lien.'; return; }
    if(url && !/^https?:\/\//i.test(url)){ msg.textContent = 'Le lien doit commencer par http:// ou https://'; return; }
    var base = {constructeur: constructeur || null, type: $('emd-type').value, titre: titre, dateDoc: $('emd-date').value.trim() || null, remarque: $('emd-rem').value.trim() || null, declencheur: null, famille: null, createdAt: nowISO(), creePar: currentUserName()};
    if(code || opt.gamme){ var pt = $('emd-portee').value; if(pt === 'fam') base.famille = (emdDecl(constructeur, code) || {}).serie || null; else if(pt === 'gam') base.cibles = ['g:' + opt.gamme]; else base.declencheur = code; }
    else { var cb = $('emd-cible').value.trim(); if(cb){ if(emdDecl(constructeur, cb)) base.declencheur = cb; else base.famille = cb; } }
    $('emd-ajout').disabled = true; msg.textContent = 'Envoi…'; msg.style.color = '#667';
    var envoi = Promise.resolve({});
    if(!f && url && $('emd-dl').checked){ envoi = emdTelecharger(url).then(function(j){ return {fichier: j.fichier, nomFichier: j.nom, taille: j.taille, mime: j.mime, remarque: base.remarque || ('Source : ' + url)}; }); url = ''; }
    if(f){ var fd = new FormData(); fd.append('file', f);
      envoi = fetch('/api/etude-elec/docs/upload', {method: 'POST', body: fd}).then(function(r){ return r.text().then(function(t){ var j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){} if(!r.ok) throw new Error((j && j.error) || ('Erreur HTTP ' + r.status)); return {fichier: j.fichier, nomFichier: j.nom, taille: j.taille, mime: j.mime}; }); }); }
    envoi.then(function(up){ var doc = Object.assign(base, up, {url: (f || up.fichier) ? null : url}); return STATE.db.collection('etudeMatDocs').add(doc).then(function(ref){ (STATE.etudeMatDocs || (STATE.etudeMatDocs = [])).push(Object.assign({id: ref && ref.id}, doc)); }); })
      .then(function(){ toast('Fiche ajoutée', 'success'); refaire(); }).catch(function(e){ msg.style.color = '#b3261e'; msg.textContent = e.message || 'Erreur'; $('emd-ajout').disabled = false; });
  });
  /* courbes */
  var courbeDe = function(id){ return (STATE.etudeMatCourbes || []).filter(function(x){ return x.id === id; })[0]; };
  var formCourbe = function(c){
    $('emd-cform').innerHTML = '<div class="ecc-f" style="margin-top:6px;border:1px solid #dde;border-radius:6px;padding:8px;">' +
      '<div class="field"><label>Nom de la courbe</label><input id="emd-cnom" value="' + esc(c ? c.nom : '') + '" placeholder="ex. Long retard + court retard"></div>' +
      '<div class="field"><label>Courant exprimé en</label><select id="emd-cabs">' + ['× Ir', '× In', 'A'].map(function(a){ return '<option' + (c && c.abscisse === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" style="grid-column:1/-1;"><label>Points (une ligne « courant ; temps en s » ; une ligne « # nom » commence une nouvelle série, ex. # min / # max)</label><textarea id="emd-cpts" rows="8" style="width:100%;font-family:monospace;">' + esc(c ? emdSeriesTexte(c.series) : '# min\n1,05 ; 7200\n1,3 ; 3600\n# max\n1,05 ; 7200\n1,3 ; 3600') + '</textarea></div>' +
      '<div style="grid-column:1/-1;"><div id="emd-cprev"></div><button type="button" class="btn btn-sm" id="emd-ctrace">Tracer</button> <button type="button" class="btn btn-sm" id="emd-cnum" title="Relever la courbe sur la page d\'une fiche PDF">Numériser depuis une fiche…</button> <button type="button" class="btn btn-primary btn-sm" id="emd-cok">Enregistrer la courbe</button> <span id="emd-cmsg" style="color:#b3261e;"></span></div></div>';
    var trace = function(){ $('emd-cprev').innerHTML = emdSvgCourbe(emdParseSeries($('emd-cpts').value), $('emd-cabs').value); };
    trace(); $('emd-ctrace').addEventListener('click', trace);
    $('emd-cnum').addEventListener('click', function(){
      if(typeof ecvNumeriser !== 'function') return;
      var pdfs = emdDocsPour(constructeur, code, opt.gamme).concat((STATE.etudeMatDocs || []).filter(function(d){ return d.fichier && (!d.constructeur || d.constructeur === constructeur); })).filter(function(d, i, a){ return a.indexOf(d) === i; });
      ecvNumeriser({docs: pdfs, abscisse: $('emd-cabs').value, retour: function(series, abs){
        var ex = emdParseSeries($('emd-cpts').value); var base = ex.length && !/^# min\n1,05/.test($('emd-cpts').value) ? ex : [];
        $('emd-cpts').value = emdSeriesTexte(base.concat(series)); $('emd-cabs').value = abs; trace();
      }});
    });
    $('emd-cok').addEventListener('click', function(){
      var nom = $('emd-cnom').value.trim(), ser = emdParseSeries($('emd-cpts').value);
      if(!nom){ $('emd-cmsg').textContent = 'Nom obligatoire.'; return; }
      if(!ser.length){ $('emd-cmsg').textContent = 'Aucun point valide (courant > 0 ; temps > 0).'; return; }
      var data = {constructeur: constructeur || null, declencheur: code, nom: nom, abscisse: $('emd-cabs').value, series: ser, updatedAt: nowISO()};
      var p = c ? STATE.db.doc('etudeMatCourbes/' + c.id).update(data).then(function(){ Object.assign(c, data); })
        : STATE.db.collection('etudeMatCourbes').add(Object.assign(data, {createdAt: nowISO(), creePar: currentUserName()})).then(function(ref){ (STATE.etudeMatCourbes || (STATE.etudeMatCourbes = [])).push(Object.assign({id: ref && ref.id}, data)); });
      p.then(function(){ toast('Courbe enregistrée', 'success'); refaire(); }).catch(function(){ $('emd-cmsg').textContent = 'Erreur d\'enregistrement'; });
    });
  };
  if($('emd-cnew')) $('emd-cnew').addEventListener('click', function(){ formCourbe(null); });
  hote.querySelectorAll('[data-emd-cmod]').forEach(function(b){ b.addEventListener('click', function(){ var c = courbeDe(b.getAttribute('data-emd-cmod')); if(c) formCourbe(c); }); });
  hote.querySelectorAll('[data-emd-csup]').forEach(function(b){ b.addEventListener('click', function(){
    if(b.getAttribute('data-sure') !== '1'){ b.setAttribute('data-sure', '1'); b.textContent = 'Confirmer ?'; setTimeout(function(){ if(b.isConnected){ b.setAttribute('data-sure', ''); b.textContent = '✕'; } }, 3500); return; }
    var id = b.getAttribute('data-emd-csup');
    deleteDoc('etudeMatCourbes', id).then(function(){ STATE.etudeMatCourbes = (STATE.etudeMatCourbes || []).filter(function(x){ return x.id !== id; }); toast('Courbe supprimée', 'success'); refaire(); });
  }); });
}

/* Bibliothèque : toutes les fiches du catalogue (fenêtre), par constructeur */
function emdOuvrirBiblio(constructeur){
  var cons = (STATE.etudeMatConstructeurs || []).slice().sort(function(a, b){ return (a.rang || 0) - (b.rang || 0) || String(a.code).localeCompare(b.code); });
  if(!cons.some(function(k){ return /siemens/i.test(k.code); })) cons.push({code: 'SIEMENS', nom: 'Siemens'});
  var ov = openModal({title: 'Fiches techniques des déclencheurs', large: true, body: '<div class="toolbar" style="margin-bottom:8px;"><select id="emd-bcons">' + cons.map(function(k){ return '<option value="' + esc(k.code) + '"' + (k.code === constructeur ? ' selected' : '') + '>' + esc(k.nom || k.code) + '</option>'; }).join('') + '</select> <select id="emd-bdec"></select> <span style="flex:1;"></span><button type="button" class="btn btn-primary btn-sm" id="emd-bdec2">Découper un PDF par pages…</button> <button type="button" class="btn btn-sm" id="emd-bmig" title="Renommer les fiches déjà importées selon Constructeur_Categorie_Gamme_Données">Nomenclature…</button> <button type="button" class="btn btn-sm" id="emd-bmasse">Importer en masse…</button></div><div id="emd-bhote"></div>', foot: '<button type="button" class="btn" data-close-modal>Fermer</button>'});
  var cs = function(){ return ov.querySelector('#emd-bcons').value; }, host = ov.querySelector('#emd-bhote');
  var decs = function(){ var l = (STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === cs(); }).map(function(x){ return x.code; }).sort(function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); });
    ov.querySelector('#emd-bdec').innerHTML = '<option value="">Toutes les fiches du constructeur</option>' + l.map(function(c){ return '<option>' + esc(c) + '</option>'; }).join(''); aff(); };
  var aff = function(){ emdPanneau(host, cs(), ov.querySelector('#emd-bdec').value); };
  ov.querySelector('#emd-bdec2').addEventListener('click', function(){ emfOuvrirDecoupage(cs()); });
  ov.querySelector('#emd-bmig').addEventListener('click', function(){ emfOuvrirMigration(cs()); });
  ov.querySelector('#emd-bmasse').addEventListener('click', function(){ ov.querySelector('.toolbar').style.display = 'none'; emdImportMasse(host, cs(), function(){ ov.querySelector('.toolbar').style.display = ''; aff(); }); });
  ov.querySelector('#emd-bcons').addEventListener('change', decs); ov.querySelector('#emd-bdec').addEventListener('change', aff); decs();
}

/* =========================================================
   V3.37 — import en masse : plusieurs fichiers, un dossier ou un ZIP ; rattachement automatique d'après le nom du fichier
   (code de déclencheur ou famille retrouvé dans le nom), contrôle et correction dans un tableau, puis « Importer ».
   ========================================================= */
function emdNorm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''); }
function emdDevine(nom, constructeur){
  var n = emdNorm(nom.replace(/\.[^.]+$/, '')), best = '', cibles = [], decl = (STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === constructeur; });
  decl.forEach(function(x){ var c = emdNorm(x.code); if(c.length >= 3 && n.indexOf(c) >= 0 && c.length > best.length){ best = c; cibles = ['d:' + x.code]; } });
  if(!cibles.length){ var sb = ''; decl.forEach(function(x){ var s = emdNorm(x.serie); if(s.length >= 4 && n.indexOf(s) >= 0 && s.length > sb.length){ sb = s; cibles = ['f:' + x.serie]; } }); }
  if(!cibles.length){   /* gamme reconnue dans le nom du fichier (ex. « iC60 courbes.pdf ») */
    var gb = ''; (STATE.etudeMatDisj || []).forEach(function(x){ if(x.constructeur !== constructeur || !x.gamme) return;
      x.gamme.split('/').forEach(function(t){ var g = emdNorm(t); if(g.length >= 4 && n.indexOf(g) >= 0 && g.length > gb.length){ gb = g; cibles = ['g:' + x.gamme]; } }); });
  }
  var type = /courbe|curve|tripping|declench/i.test(nom) ? 'courbe' : (/notice|guide|manual|manuel|instruction|user/i.test(nom) ? 'notice' : 'fiche');
  var titre = nom.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[_\s-]+/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return {type: type, cibles: cibles, titre: titre};
}
function emdResumeCibles(c){ c = c || []; return c.length ? (c.length > 3 ? c.slice(0, 3).map(function(x){ return x.slice(2); }).join(', ') + '… (' + c.length + ')' : c.map(function(x){ return x.slice(2); }).join(', ')) : '— constructeur en général —'; }
function emdImportMasse(host, constructeur, retour){
  var ecr = canWrite('etude_elec');
  if(!ecr){ host.innerHTML = '<p class="hint">Lecture seule : import impossible.</p>'; return; }
  var lignes = [];   /* {nom, taille, file | fichier(deja sur disque, zip / lien), type, titre, cibles[], ok, info} */
  var items = emdItemsCibles(constructeur);
  host.innerHTML = '<div style="margin-bottom:8px;"><button type="button" class="btn btn-sm" id="emm-retour">← Retour aux fiches</button></div>' +
    '<p class="hint" style="margin:0 0 8px;">Constructeur : <b>' + esc(constructeur) + '</b>. Déposez ici plusieurs fichiers (PDF, images), un dossier entier ou un ZIP. Chaque fichier est rattaché automatiquement au déclencheur, à la famille ou à la gamme dont le nom figure dans le nom du fichier ; sinon rattachez-les en une fois avec « Rattacher les cochés… » (une fiche peut viser plusieurs gammes). Vous contrôlez avant d\'importer.</p>' +
    '<div id="emm-zone" style="border:2px dashed #9fb3d1;border-radius:8px;padding:16px;text-align:center;background:#f6f9fd;">Glissez-déposez vos fichiers ici<br>' +
    '<span style="color:#667;font-size:12px;">ou</span><br><label class="btn btn-sm" style="margin:4px 4px 0;">Choisir des fichiers<input type="file" id="emm-files" multiple accept=".pdf,.png,.jpg,.jpeg,.svg,.webp,.zip" style="display:none;"></label>' +
    '<label class="btn btn-sm" style="margin:4px 4px 0;">Choisir un dossier<input type="file" id="emm-dir" webkitdirectory multiple style="display:none;"></label></div>' +
    '<details style="margin-top:8px;"><summary style="cursor:pointer;color:#1f5fa8;">Télécharger à partir de liens (le serveur récupère les PDF)</summary><div style="margin-top:6px;">' +
    '<p class="hint" style="margin:0 0 4px;">Une ligne par fichier : <code>https://… ; titre ; déclencheur ou famille (facultatif)</code>. Domaines autorisés : <span id="emm-dom">…</span></p>' +
    '<textarea id="emm-urls" rows="6" style="width:100%;font-family:monospace;font-size:12px;" placeholder="https://www.productinfo.schneider-electric.com/…/DOCA0187EN-02.pdf ; ComPacT NSX guide utilisateur"></textarea>' +
    '<div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn btn-sm" id="emm-known">Remplir avec la liste fournie</button><button type="button" class="btn btn-primary btn-sm" id="emm-dlgo">Télécharger les liens</button><span id="emm-dlmsg" style="color:#667;"></span></div></div></details>' +
    '<div id="emm-liste" style="margin-top:10px;"></div><div id="emm-cib"></div>';
  var $ = function(id){ return host.querySelector('#' + id); };
  $('emm-retour').addEventListener('click', function(){ (retour || function(){})(); });
  var extOk = function(n){ return /\.(pdf|png|jpe?g|svg|webp)$/i.test(n); };
  function nouvelle(nom, taille, src){
    var g = emdDevine(nom, constructeur);
    var deja = (STATE.etudeMatDocs || []).some(function(d){ return d.nomFichier === nom && Number(d.taille) === Number(taille) && (!d.constructeur || d.constructeur === constructeur); });
    return Object.assign({nom: nom, taille: taille, type: g.type, titre: g.titre, cibles: g.cibles, ok: !deja, info: deja ? 'déjà importé' : ''}, src);
  }
  function ajouter(files){
    var zips = [], vus = {};
    lignes.forEach(function(l){ vus[l.nom + '|' + l.taille] = 1; });
    Array.prototype.slice.call(files).forEach(function(f){
      if(/\.zip$/i.test(f.name)){ zips.push(f); return; }
      if(!extOk(f.name) || vus[f.name + '|' + f.size]) return;
      vus[f.name + '|' + f.size] = 1; lignes.push(nouvelle(f.name, f.size, {file: f}));
    });
    if(!zips.length){ aff(); return; }
    $('emm-liste').innerHTML = '<p class="hint">Lecture de l\'archive…</p>';
    zips.reduce(function(p, z){ return p.then(function(){ var fd = new FormData(); fd.append('file', z);
      return fetch('/api/etude-elec/docs/unzip', {method: 'POST', body: fd}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || 'Erreur ZIP'); (j.fichiers || []).forEach(function(e){ if(vus[e.nom + '|' + e.taille]){ fetch('/api/etude-elec/docs/file/' + encodeURIComponent(e.fichier), {method: 'DELETE'}); return; } vus[e.nom + '|' + e.taille] = 1; lignes.push(nouvelle(e.nom, e.taille, {fichier: e.fichier, mime: e.mime})); }); }); }); }); }, Promise.resolve())
      .then(aff).catch(function(e){ toast(e.message || 'Archive illisible', 'danger'); aff(); });
  }
  function aff(){
    var L = $('emm-liste');
    if(!lignes.length){ L.innerHTML = ''; return; }
    var nbOk = lignes.filter(function(l){ return l.ok; }).length, nbCible = lignes.filter(function(l){ return l.ok && l.cibles.length; }).length;
    var h = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;"><b>' + lignes.length + ' fichier(s)</b><span style="color:#667;">' + nbOk + ' à importer, dont ' + nbCible + ' rattaché(s)</span><span style="flex:1;"></span>' +
      '<button type="button" class="btn btn-sm" id="emm-lot">Rattacher les cochés…</button>' +
      '<select id="emm-all-t">' + EMD_TYPES.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select><button type="button" class="btn btn-sm" id="emm-allt-b">Type pour tous</button></div>' +
      '<div style="max-height:360px;overflow:auto;border:1px solid #dde;border-radius:6px;"><table style="border-collapse:collapse;width:100%;font-size:12.5px;"><thead style="position:sticky;top:0;background:#f3f6fa;"><tr style="text-align:left;"><th style="padding:4px;"></th><th>Fichier</th><th>Type</th><th>Titre</th><th>Rattaché à</th></tr></thead><tbody>';
    lignes.forEach(function(l, i){
      h += '<tr style="border-top:1px solid #eef;' + (l.ok ? '' : 'opacity:.55;') + '"><td style="padding:3px 4px;"><input type="checkbox" data-i="' + i + '" data-k="ok"' + (l.ok ? ' checked' : '') + '></td>' +
        '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(l.nom) + '">' + esc(l.nom) + '<div style="color:#889;font-size:11px;">' + emdFmtTaille(l.taille) + (l.info ? ' · ' + esc(l.info) : '') + '</div></td>' +
        '<td><select data-i="' + i + '" data-k="type">' + EMD_TYPES.map(function(t){ return '<option value="' + t[0] + '"' + (l.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></td>' +
        '<td><input data-i="' + i + '" data-k="titre" value="' + esc(l.titre) + '" style="width:100%;min-width:180px;"></td>' +
        '<td style="white-space:nowrap;"><span style="color:' + (l.cibles.length ? '#223' : '#a15c00') + ';">' + esc(emdResumeCibles(l.cibles)) + '</span> <button type="button" class="btn btn-sm" data-cib="' + i + '">Cibles…</button></td></tr>';
    });
    h += '</tbody></table></div><div style="margin-top:8px;display:flex;gap:8px;align-items:center;"><button type="button" class="btn btn-primary" id="emm-go"' + (nbOk ? '' : ' disabled') + '>Importer ' + nbOk + ' fichier(s)</button><button type="button" class="btn" id="emm-vider">Vider la liste</button><span id="emm-msg" style="color:#667;"></span></div>';
    L.innerHTML = h;
    L.querySelectorAll('[data-k]').forEach(function(e){ e.addEventListener('change', function(){ var l = lignes[+e.getAttribute('data-i')], k = e.getAttribute('data-k'); l[k] = k === 'ok' ? e.checked : e.value; if(k === 'ok') aff(); }); e.addEventListener('input', function(){ if(e.getAttribute('data-k') === 'titre') lignes[+e.getAttribute('data-i')].titre = e.value; }); });
    L.querySelectorAll('[data-cib]').forEach(function(b){ b.addEventListener('click', function(){ var i = +b.getAttribute('data-cib'); choisir([i], 'Cibles de « ' + lignes[i].nom + ' »'); }); });
    $('emm-lot').addEventListener('click', function(){ var idx = []; lignes.forEach(function(l, i){ if(l.ok) idx.push(i); }); if(!idx.length) return; choisir(idx, 'Rattacher les ' + idx.length + ' fichier(s) cochés (remplace leurs cibles actuelles)'); });
    $('emm-allt-b').addEventListener('click', function(){ var v = $('emm-all-t').value; lignes.forEach(function(l){ l.type = v; }); aff(); });
    $('emm-vider').addEventListener('click', function(){ lignes.forEach(function(l){ if(l.fichier) fetch('/api/etude-elec/docs/file/' + encodeURIComponent(l.fichier), {method: 'DELETE'}); }); lignes = []; aff(); });
    $('emm-go').addEventListener('click', importer);
  }
  function choisir(idx, titre){
    var sel = {}; if(idx.length === 1) lignes[idx[0]].cibles.forEach(function(c){ sel[c] = 1; });
    var C = $('emm-cib');
    C.innerHTML = '<div style="margin-top:10px;border:1px solid #9fb3d1;border-radius:6px;padding:8px;background:#f8fbff;"><div style="font-weight:600;margin-bottom:4px;">' + esc(titre) + ' <span id="emm-ccount" style="color:#667;font-weight:400;"></span></div><div id="emm-cliste">' + emdListeHtml(items, sel) + '</div>' +
      '<div style="margin-top:6px;"><button type="button" class="btn btn-primary btn-sm" id="emm-cok">Appliquer</button> <button type="button" class="btn btn-sm" id="emm-cann">Annuler</button></div></div>';
    var compte = function(){ $('emm-ccount').textContent = '— ' + emdListeLire(C).length + ' coché(s)'; };
    emdListeLier($('emm-cliste'), compte); compte(); C.scrollIntoView({block: 'nearest'});
    $('emm-cann').addEventListener('click', function(){ C.innerHTML = ''; });
    $('emm-cok').addEventListener('click', function(){ var c = emdListeLire(C); idx.forEach(function(i){ lignes[i].cibles = c.slice(); }); C.innerHTML = ''; aff(); });
  }
  function importer(){
    var aFaire = lignes.filter(function(l){ return l.ok; }), msg = $('emm-msg'), fait = 0, echecs = [];
    lignes.filter(function(l){ return !l.ok && l.fichier; }).forEach(function(l){ fetch('/api/etude-elec/docs/file/' + encodeURIComponent(l.fichier), {method: 'DELETE'}); });
    $('emm-go').disabled = true;
    aFaire.reduce(function(p, l){ return p.then(function(){
      msg.textContent = 'Import ' + (fait + 1) + ' / ' + aFaire.length + '…';
      var up = Promise.resolve(l.file ? null : {fichier: l.fichier, nom: l.nom, taille: l.taille, mime: l.mime});
      if(l.file){ var fd = new FormData(); fd.append('file', l.file); up = fetch('/api/etude-elec/docs/upload', {method: 'POST', body: fd}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || 'Erreur'); return j; }); }); }
      return up.then(function(j){
        var c = l.cibles || [], un = c.length === 1 ? c[0] : '';
        var doc = {constructeur: constructeur, remarque: l.source ? 'Source : ' + l.source : null, type: l.type, titre: (l.titre || l.nom).trim(),
          declencheur: un.indexOf('d:') === 0 ? un.slice(2) : null, famille: un.indexOf('f:') === 0 ? un.slice(2) : null, cibles: (c.length > 1 || un.indexOf('g:') === 0) ? c : null,
          fichier: j.fichier, nomFichier: j.nom, taille: j.taille, mime: j.mime, url: null, createdAt: nowISO(), creePar: currentUserName()};
        return STATE.db.collection('etudeMatDocs').add(doc).then(function(ref){ (STATE.etudeMatDocs || (STATE.etudeMatDocs = [])).push(Object.assign({id: ref && ref.id}, doc)); fait++; });
      }).catch(function(e){ echecs.push(l.nom + ' : ' + (e.message || 'erreur')); });
    }); }, Promise.resolve()).then(function(){
      lignes = lignes.filter(function(l){ return !l.ok; }); toast(fait + ' fiche(s) importée(s)' + (echecs.length ? ', ' + echecs.length + ' échec(s)' : ''), echecs.length ? 'danger' : 'success');
      if(echecs.length){ aff(); $('emm-msg').style.color = '#b3261e'; $('emm-msg').textContent = echecs.slice(0, 3).join(' · '); }
      else if(retour) retour(); else aff();
    });
  }
  fetch('/api/etude-elec/docs/domaines').then(function(r){ return r.json(); }).then(function(j){ $('emm-dom').textContent = (j.domaines || []).join(', '); }).catch(function(){});
  $('emm-known').addEventListener('click', function(){
    var l = emdLiensConnus(constructeur);
    if(!l.length){ toast('Aucune liste fournie pour ce constructeur.', 'danger'); return; }
    $('emm-urls').value = l.map(function(x){ return x[0] + ' ; ' + x[1] + (x[2] ? ' ; ' + x[2] : ''); }).join('\n');
  });
  $('emm-dlgo').addEventListener('click', function(){
    var its = $('emm-urls').value.split(/\r?\n/).filter(function(l){ return l.trim() && l.trim().charAt(0) !== '#'; }).map(function(l){ var p = l.split(';').map(function(x){ return x.trim(); }); return p[0] ? {url: p[0], titre: p[1] || '', cible: p[2] || ''} : null; }).filter(Boolean), msg = $('emm-dlmsg'), echecs = [], n = 0;
    if(!its.length){ msg.textContent = 'Aucun lien.'; return; }
    var decl = (STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === constructeur; });
    $('emm-dlgo').disabled = true;
    its.reduce(function(p, it){ return p.then(function(){
      msg.style.color = '#667'; msg.textContent = 'Téléchargement ' + (n + echecs.length + 1) + ' / ' + its.length + '…';
      return emdTelecharger(it.url).then(function(j){
        var l = nouvelle(j.nom, j.taille, {fichier: j.fichier, mime: j.mime});
        if(it.titre) l.titre = it.titre;
        var g = emdDevine(j.nom + ' ' + it.titre, constructeur); if(it.titre) l.type = g.type;
        var cv = []; if(it.cible){ var m = decl.filter(function(x){ return x.code.toLowerCase() === it.cible.toLowerCase(); })[0]; cv = [m ? 'd:' + m.code : 'f:' + it.cible]; }
        l.cibles = cv.length ? cv : g.cibles; l.info = (l.info ? l.info + ' · ' : '') + 'téléchargé'; l.source = it.url;
        lignes.push(l); n++;
      }).catch(function(e){ echecs.push(it.url.replace(/^https?:\/\//, '').slice(0, 60) + ' → ' + (e.message || 'erreur')); });
    }); }, Promise.resolve()).then(function(){
      $('emm-dlgo').disabled = false; aff();
      msg.style.color = echecs.length ? '#b3261e' : '#2e7d32'; msg.textContent = n + ' téléchargé(s)' + (echecs.length ? ', ' + echecs.length + ' échec(s) : ' + echecs.join(' | ') : ' — contrôlez le tableau puis importez.');
      if(n) $('emm-urls').value = its.filter(function(it){ return echecs.some(function(e){ return e.indexOf(it.url.replace(/^https?:\/\//, '').slice(0, 60)) === 0; }); }).map(function(it){ return it.url + ' ; ' + it.titre + (it.cible ? ' ; ' + it.cible : ''); }).join('\n');
    });
  });
  $('emm-files').addEventListener('change', function(e){ ajouter(e.target.files); e.target.value = ''; });
  $('emm-dir').addEventListener('change', function(e){ ajouter(e.target.files); e.target.value = ''; });
  var z = $('emm-zone');
  ['dragenter', 'dragover'].forEach(function(ev){ z.addEventListener(ev, function(e){ e.preventDefault(); z.style.background = '#e6effa'; }); });
  ['dragleave', 'drop'].forEach(function(ev){ z.addEventListener(ev, function(e){ e.preventDefault(); z.style.background = '#f6f9fd'; }); });
  z.addEventListener('drop', function(e){ if(e.dataTransfer && e.dataTransfer.files) ajouter(e.dataTransfer.files); });
}

/* V3.38 — téléchargement d'un fichier à partir d'un lien (côté serveur) */
function emdTelecharger(url){
  return fetch('/api/etude-elec/docs/fetch', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: url})})
    .then(function(r){ return r.text().then(function(t){ var j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){} if(!r.ok) throw new Error((j && j.error) || ('Erreur HTTP ' + r.status)); return j; }); });
}
/* Liens officiels connus (relevés dans des résultats de recherche ; les deux premiers Schneider ont été ouverts et lus). Un lien peut mener à une page
   et non au PDF : l'application le signale ligne par ligne, il suffit alors de télécharger le fichier à la main. */
var EMD_LIENS = {
  SCHNEIDER: [
    ['https://www.productinfo.schneider-electric.com/compactnsxuserguide/doca0187-compact-nsx-user-guide/English/DOCA0187EN-02.pdf', 'ComPacT NSX 100-630 A — guide utilisateur DOCA0187EN'],
    ['https://productinfo.se.com/micrologic_literature/48049-137-05-micrologic-5.0p-and-6.0p-electronic-trip-units-instruction-bulletin/English/48049-137-05EN.pdf', 'Micrologic 5.0P et 6.0P — bulletin d\'instruction 48049-137-05EN']
  ],
  SIEMENS: [
    ['https://assets.new.siemens.com/siemens/assets/api/uuid:1dfc72e2-76bd-4242-82af-baf29ad9b3a2/manual-sentron-3va-en.pdf', 'SENTRON 3VA — manuel'],
    ['https://assets.new.siemens.com/siemens/assets/api/uuid:7e361690-1c0c-49af-a0af-07abddff300d/3va27-3wl10-manual-en.pdf', '3VA27 / 3WL10 — manuel'],
    ['https://assets.new.siemens.com/siemens/assets/api/uuid:b838e7e4-b284-4dce-abd1-d7b92b324ddc/manual-sentron-3wl-en.pdf', 'SENTRON 3WL — manuel'],
    ['https://cache.industry.siemens.com/dl/files/637/109750637/att_1088587/v1/02_MoldedCaseCircuitBreakers_LV10_102021_EN_202111301145323473.pdf', 'Catalogue LV 10 — disjoncteurs boîtier moulé (3VA)'],
    ['https://cache.industry.siemens.com/dl/files/636/109750636/att_1088641/v1/01_AirCircuitBreakers_LV10_102021_EN_202111301146249676.pdf', 'Catalogue LV 10 — disjoncteurs ouverts (3WL)'],
    ['https://cache.industry.siemens.com/dl/files/638/109750638/att_1006082/v1/03_MiniatureCircuitBreakers_LV10_102019_EN_201912031928445012.pdf', 'Catalogue LV 10 — disjoncteurs modulaires (5SL / 5SY)'],
    ['https://assets.new.siemens.com/siemens/assets/api/uuid:fb03f6c7-c323-4c20-abd5-be2df866a5a1/5s-mcb-configuration-manual.pdf', '5SL / 5SY — manuel de configuration'],
    ['https://assets.new.siemens.com/siemens/assets/api/uuid:fd8f796d-9e24-4eba-a56b-69b868024970/SENTRON-5SY-MCB-overview.pdf', 'SENTRON 5SY — aperçu des disjoncteurs modulaires']
  ]
};
function emdLiensConnus(constructeur){
  var k = /siemens/i.test(constructeur) ? 'SIEMENS' : (/schneider/i.test(constructeur) ? 'SCHNEIDER' : '');
  return k ? EMD_LIENS[k] : [];
}
