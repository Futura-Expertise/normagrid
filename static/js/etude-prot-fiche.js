/* =========================================================
   V3.35 — ÉTUDE ÉLECTRIQUE > SCHÉMA UNIFILAIRE : fenêtre de paramétrage d'une protection
   Un clic sur le symbole d'une protection du schéma (disjoncteur, sectionneur, interrupteur, interrupteur à fusibles, fusible, différentiel)
   ou sur le jeu de barres d'un tableau (protection de tête) ouvre cette fenêtre :
     constructeur > catégorie > gamme > calibre · courbe · variante · pouvoir de coupure > déclencheur (ou classe de fusible)
     compatible avec la gamme et le calibre > réglages du déclencheur (crans du catalogue) + fiche de l'équipement choisi.
   V3.35 : la fenêtre a deux onglets — « Protection » (appareil, caractéristiques, Prot CI) et « Déclencheur » (choix du déclencheur,
   réglages courant / temps par fonction avec crans, valeurs en A, contrôle de plage ; déclencheur intégré affiché en lecture seule).
   Enregistrement : départ  -> circuit du consommateur (etudeBtCircuits : protConstructeur, protCategorie, protGamme, protVariante,
                                 protCalibre, protCourbe, protDeclencheur, protReglages) — les mêmes champs que l'écran Calcul ;
                    tête    -> document du tableau (etudeBilanTableaux : teteConstructeur … teteReglages), commun à un modèle et à ses appartements.
   ========================================================= */
function epfCle(f, p){ return f + '|' + p; }
function epfFmt(v, d){ return (v === null || v === undefined || v === '') ? '—' : Number(v).toLocaleString('fr-FR', {maximumFractionDigits: d === undefined ? 2 : d}); }
function epfFusible(cat){ return /fusible/i.test(String(cat || '')); }

/* V3.46 : protection (constructeur, ligne de catalogue, déclencheur, réglages) enregistrée pour un départ ou une tête de tableau, ou null */
function epfProtDe(i, projet){
  var v = null, lib = i.titre || '';
  if(i.k === 'dep'){
    var d = i.consoId ? eunConsoParId(i.consoId) : null, c = d ? eccCircuit(projet.id, d.id) : null; if(!c || !c.protConstructeur) return null;
    v = {constructeur: c.protConstructeur, categorie: c.protCategorie, gamme: c.protGamme, variante: c.protVariante, calibre: c.protCalibre, courbe: c.protCourbe, declencheur: c.protDeclencheur, reglages: c.protReglages};
  } else {
    var t = (typeof eebDocDe === 'function' && i.cle) ? eebDocDe(projet.id, i.cle) : null; if(!t || !t.teteConstructeur) return null;
    v = {constructeur: t.teteConstructeur, categorie: t.teteCategorie, gamme: t.teteGamme, variante: t.teteVariante, calibre: t.teteCalibre, courbe: t.teteCourbe, declencheur: t.teteDeclencheur, reglages: t.teteReglages};
  }
  if(!v.gamme) return null;
  var cand = (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === v.constructeur && x.gamme === v.gamme && (!v.categorie || x.categorie === v.categorie); });
  var dj = cand.filter(function(x){ return String(x.calibre) === String(v.calibre) && String(x.courbe) === String(v.courbe) && String(x.variante) === String(v.variante); })[0] ||
    cand.filter(function(x){ return String(x.calibre) === String(v.calibre) && String(x.variante) === String(v.variante); })[0] || cand.filter(function(x){ return String(x.calibre) === String(v.calibre); })[0] || null;
  if(!dj) return null;
  return {constructeur: v.constructeur, dj: dj, code: v.declencheur || '', regl: v.reglages || {}, In: Number(dj.calibreA) || ecvNum(dj.calibre), titre: lib, k: i.k};
}
var EPF_AMONT_ON = true;
function epfOuvrir(info, projet){
  if(!projet) projet = (typeof projetParId === 'function') ? projetParId(EUN_UI.projetId) : null;
  if(!projet) return;
  if(!canWrite('etude_elec')){ toast('Lecture seule : vous n\'avez pas le droit de modifier l\'étude électrique.', 'danger'); return; }
  var d = null, circuit = null, doc = null, val = {};
  if(info.k === 'dep'){
    d = info.consoId ? eunConsoParId(info.consoId) : null;
    if(!d){ toast('Ce départ n\'est rattaché à aucun consommateur de la base : la protection ne peut pas être enregistrée ici.', 'danger'); return; }
    circuit = eccCircuit(projet.id, d.id);
    var c = circuit || {};
    val = {constructeur: c.protConstructeur, categorie: c.protCategorie, gamme: c.protGamme, variante: c.protVariante, calibre: c.protCalibre, courbe: c.protCourbe, declencheur: c.protDeclencheur, reglages: c.protReglages};
  } else {
    doc = eebDocDe(projet.id, info.cle);
    var t = doc || {};
    val = {constructeur: t.teteConstructeur, categorie: t.teteCategorie, gamme: t.teteGamme, variante: t.teteVariante, calibre: t.teteCalibre, courbe: t.teteCourbe, declencheur: t.teteDeclencheur, reglages: t.teteReglages};
  }
  var cons = (STATE.etudeMatConstructeurs || []).slice().sort(function(a, b){ return (a.rang || 0) - (b.rang || 0) || String(a.code).localeCompare(b.code); });
  var champ = function(id, lab, html){ return '<div class="field"><label for="' + id + '" id="' + id + '-l">' + lab + '</label>' + html + '</div>'; };
  var titre = info.k === 'dep' ? 'Protection du départ ' + (d.tag || '') : 'Protection de tête du tableau ' + (info.titre || '');
  var sous = info.k === 'dep'
    ? 'Départ <b>' + esc(d.tag || '') + '</b> — ' + esc(d.nom || '') + (circuit ? '' : ' <i>(aucun circuit saisi : il sera créé à l\'enregistrement)</i>')
    : 'Appareil de protection placé à l\'arrivée du tableau <b>' + esc(info.titre || '') + '</b> (juste au-dessus du jeu de barres). Pour un appartement, la protection est celle de son modèle.';
  var body = '<p class="hint" style="margin-top:0;">' + sous + '</p>' +
    '<div class="tabs" id="epf-tabs" style="display:flex;gap:4px;border-bottom:1px solid #ccd;margin-bottom:10px;"><button type="button" class="btn" data-tab="1" id="epf-t1" style="border-bottom:0;font-weight:600;">Protection</button><button type="button" class="btn" data-tab="2" id="epf-t2" style="border-bottom:0;">Déclencheur</button></div>' +
    '<div id="epf-p1"><div class="ecc-f">' +
    champ('epf-cons', 'Constructeur (fournisseur)', '<select id="epf-cons">' + eccOpts(cons.map(function(k){ return {v: k.code, t: k.nom || k.code}; }), val.constructeur, cons.length ? '—' : 'Aucun constructeur importé') + '</select>') +
    champ('epf-cat', 'Catégorie', '<select id="epf-cat"></select>') +
    champ('epf-gam', 'Gamme', '<select id="epf-gam"></select>') +
    champ('epf-cal', 'Calibre · courbe · variante · pouvoir de coupure', '<select id="epf-cal"></select>') +
    (info.k === 'dep' ? champ('epf-pci', 'Prot CI (C / I / S)', '<select id="epf-pci">' + eccOpts(['C', 'I', 'S'], (circuit && circuit.protCi) || (d && d.ci) || '', '—') + '</select>') : '') +
    '<div class="field" style="grid-column:1/-1;"><label>Caractéristiques de l\'appareil</label><div id="epf-fiche" style="font-size:12.5px;"></div></div></div></div>' +
    '<div id="epf-p2" style="display:none;"><div class="ecc-f">' +
    champ('epf-dec', 'Déclencheur', '<select id="epf-dec"></select>') +
    '<div class="field" style="grid-column:1/-1;"><label>Caractéristiques du déclencheur</label><div id="epf-fiche-d" style="font-size:12.5px;"></div></div></div>' +
    '<div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px;"><b style="font-size:13px;">Réglages</b><span style="flex:1;"></span><button type="button" class="btn btn-sm" id="epf-usuel" title="Point de départ à ajuster : Ir au maximum, autres réglages à un cran médian">Valeurs usuelles</button><button type="button" class="btn btn-sm" id="epf-raz">Effacer les réglages</button></div>' +
    '<div id="epf-regl" style="font-size:12.5px;"></div>' +
    '<div id="epf-amont-opt" style="display:none;margin-top:14px;border-top:1px solid #dde;padding-top:8px;font-size:12.5px;"><label style="font-weight:400;display:flex;gap:6px;align-items:center;"><input type="checkbox" id="epf-amont" style="width:auto;"> Superposer la courbe de la protection en amont : <b id="epf-amont-nom"></b></label></div>' +
    '<div id="epf-courbe" style="margin-top:6px;font-size:12.5px;"></div>' +
    '<div id="epf-docs" style="margin-top:14px;border-top:1px solid #dde;padding-top:8px;font-size:12.5px;"></div></div>';
  var ov = openModal({title: titre, large: true, body: body,
    foot: '<button type="button" class="btn btn-danger" id="epf-clear" style="margin-right:auto;">Retirer la protection</button><button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="epf-ok">Enregistrer</button>'});
  var $ = function(id){ return ov.querySelector('#' + id); };
  var regl = Object.assign({}, val.reglages || {});
  /* protection amont : la plus proche, sur le chemin vers la source, dont la protection est saisie */
  var amontProt = null;
  (info.amont || []).some(function(i){ var pr = epfProtDe(i, projet); if(pr){ amontProt = pr; return true; } return false; });
  $('epf-amont').addEventListener('change', function(){ EPF_AMONT_ON = $('epf-amont').checked; courbeDecl(); });

  function disjDe(k, cat, gam){ return (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === k && (!cat || x.categorie === cat) && (!gam || x.gamme === gam); }); }
  function cats(){
    var k = $('epf-cons').value;
    $('epf-cat').innerHTML = eccOpts(k ? eprCategories(k).map(function(x){ return x.nom; }) : [], $('epf-cat').getAttribute('data-sel') || '', '— Catégorie —');
    $('epf-cat').setAttribute('data-sel', ''); gammes();
  }
  function gammes(){
    var k = $('epf-cons').value, cat = $('epf-cat').value, l = [];
    if(k && cat) disjDe(k, cat).forEach(function(x){ if(l.indexOf(x.gamme) < 0) l.push(x.gamme); });
    $('epf-gam').innerHTML = eccOpts(l.sort(function(a, b){ return a.localeCompare(b, 'fr', {numeric: true}); }), $('epf-gam').getAttribute('data-sel') || '', '— Gamme —');
    $('epf-gam').setAttribute('data-sel', ''); calibres();
  }
  function calibres(){
    var k = $('epf-cons').value, cat = $('epf-cat').value, g = $('epf-gam').value, l = [];
    if(k && cat && g){
      disjDe(k, cat, g).sort(function(a, b){ return (a.calibreA || 0) - (b.calibreA || 0) || String(a.courbe).localeCompare(b.courbe) || (b.icuKa || 0) - (a.icuKa || 0); })
        .forEach(function(x){ l.push({v: x.id, t: x.calibre + ' A · ' + (x.courbe && x.courbe !== '—' ? 'courbe ' + x.courbe + ' · ' : '') + (x.variante && x.variante !== '—' ? x.variante + ' · ' : '') + (x.icuKa !== null && x.icuKa !== undefined ? 'Icu ' + x.icuKa + ' kA' : '')}); });
    }
    $('epf-cal').innerHTML = eccOpts(l, $('epf-cal').getAttribute('data-sel') || '', '— Calibre —');
    $('epf-cal').setAttribute('data-sel', ''); declencheurs();
  }
  function declencheurs(){
    var k = $('epf-cons').value, g = $('epf-gam').value, id = $('epf-cal').value, ca = null, l = [];
    var dj = (STATE.etudeMatDisj || []).filter(function(x){ return x.id === id; })[0];
    if(dj) ca = dj.calibreA;
    (STATE.etudeMatAssoc || []).forEach(function(a){
      if(a.constructeur !== k || a.gamme !== g) return;
      if(ca !== null && ca !== undefined && ((a.calibreMin !== null && a.calibreMin !== undefined && ca < a.calibreMin) || (a.calibreMax !== null && a.calibreMax !== undefined && ca > a.calibreMax))) return;
      if(l.indexOf(a.declencheur) < 0) l.push(a.declencheur);
    });
    var fus = epfFusible($('epf-cat').value);
    $('epf-dec-l').textContent = fus ? 'Classe du fusible (gG / aM)' : 'Déclencheur (compatible avec la gamme et le calibre)';
    $('epf-t2').textContent = fus ? 'Fusible' : 'Déclencheur';
    $('epf-dec').innerHTML = eccOpts(l, $('epf-dec').getAttribute('data-sel') || '', l.length ? (fus ? '— Classe —' : '— Déclencheur —') : '— (aucun associé) —');
    $('epf-dec').setAttribute('data-sel', '');
    fiche(); reglages(); docsDecl();
  }
  function djCourant(){ return (STATE.etudeMatDisj || []).filter(function(x){ return x.id === $('epf-cal').value; })[0] || null; }
  function decCourant(){ var k = $('epf-cons').value, code = $('epf-dec').value; return code ? ((STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === k && x.code === code; })[0] || null) : null; }
  function tabl(rows){ return '<table style="border-collapse:collapse;">' + rows.filter(Boolean).map(function(r){ return '<tr><td style="padding:1px 12px 1px 0;color:#667;white-space:nowrap;">' + r[0] + '</td><td style="padding:1px 0;">' + r[1] + '</td></tr>'; }).join('') + '</table>'; }
  function fiche(){
    var dj = djCourant(), k = $('epf-cons').value, cs = (STATE.etudeMatConstructeurs || []).filter(function(x){ return x.code === k; })[0], dc = decCourant();
    if(!dj){ $('epf-fiche').innerHTML = '<span style="color:var(--muted,#667);">Choisissez constructeur, catégorie, gamme et calibre.</span>'; }
    else {
      $('epf-fiche').innerHTML = tabl([['Fournisseur', esc(cs ? (cs.nom || cs.code) : k)], ['Équipement', esc([dj.categorie, dj.gamme, dj.variante && dj.variante !== '—' ? dj.variante : ''].filter(Boolean).join(' · '))],
        ['Calibre / courbe', esc(dj.calibre + ' A' + (dj.courbe && dj.courbe !== '—' ? ' · courbe ' + dj.courbe : ''))],
        ['Pouvoir de coupure', 'Icu ' + epfFmt(dj.icuKa) + ' kA' + (dj.icnKa ? ' · Icn ' + epfFmt(dj.icnKa) + ' kA' : '') + (dj.icsPct ? ' · Ics ' + epfFmt(dj.icsPct, 0) + ' % Icu' : '')],
        (dj.imMin || dj.imMax) ? ['Seuil magnétique Im', epfFmt(dj.imMin) + ' à ' + epfFmt(dj.imMax) + ' × In'] : null, dj.normes ? ['Normes', esc(dj.normes)] : null, dj.statut ? ['Statut des données', esc(dj.statut)] : null]);
    }
    var fd;
    if(dc){
      fd = tabl([['Déclencheur', '<b>' + esc(dc.code) + '</b>' + (dc.type ? ' · ' + esc(dc.type) : '')], dc.protections ? ['Protections', esc(dc.protections)] : null,
        (dc.irMinA || dc.irMaxA) ? ['Plage Ir', epfFmt(dc.irMinA) + ' à ' + epfFmt(dc.irMaxA) + ' A'] : null, (dc.imMinA || dc.imMaxA) ? ['Plage Im', epfFmt(dc.imMinA) + ' à ' + epfFmt(dc.imMaxA) + ' A'] : null]);
    } else if(dj && $('epf-dec').options.length <= 1){   /* aucun déclencheur associé : déclencheur intégré (modulaire, fusible…) */
      fd = '<div style="padding:6px 8px;background:#f3f6fa;border-radius:6px;"><b>Déclencheur intégré à l\'appareil</b> (non interchangeable)</div>' + tabl([dj.courbe && dj.courbe !== '—' ? ['Courbe', esc(dj.courbe)] : null,
        (dj.imMin || dj.imMax) ? ['Seuil magnétique Im', epfFmt(dj.imMin) + ' à ' + epfFmt(dj.imMax) + ' × In' + (dj.calibreA ? ' (' + epfFmt(dj.imMin * dj.calibreA, 0) + ' à ' + epfFmt(dj.imMax * dj.calibreA, 0) + ' A)' : '')] : null, ['Réglage', 'fixe : non réglable sur le terrain']]);
    } else fd = '<span style="color:var(--muted,#667);">Choisissez un déclencheur dans la liste.</span>';
    $('epf-fiche-d').innerHTML = fd;
  }
  function epfNum(t){ var m = String(t === undefined || t === null ? '' : t).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  var metaRows = [];
  function majCalc(){
    var dj = djCourant(), In = dj ? Number(dj.calibreA) || epfNum(dj.calibre) : null, Ir = null, nbAlerte = 0;
    metaRows.forEach(function(m){ if(/^courant Ir/.test(m.parametre) && m.unite === '× In'){ var v = epfNum(regl[epfCle(m.fonction, m.parametre)]); if(v !== null) Ir = v; } });
    metaRows.forEach(function(m, i){
      var cel = $('epf-a' + i), msg = $('epf-w' + i); if(!cel) return;
      var v = epfNum(regl[epfCle(m.fonction, m.parametre)]), txt = '', w = '';
      if(v !== null){
        if(m.unite === '× In' && In) txt = epfFmt(v * In, 1) + ' A';
        else if(m.unite === '× Ir' && In) txt = Ir !== null ? epfFmt(v * Ir * In, 1) + ' A' : '(Ir non réglé)';
        else if(m.unite === 'A') txt = epfFmt(v, 1) + ' A';
        var mn = epfNum(m.cranMin), mx = epfNum(m.cranMax);
        if(m.reglable !== 'non' && ((mn !== null && v < mn) || (mx !== null && v > mx))) w = 'hors plage du catalogue (' + epfFmt(mn) + ' à ' + epfFmt(mx) + ')';
        var toks = (m.crans || '').split(/\s*;\s*/).map(epfNum).filter(function(x){ return x !== null; });
        if(!w && m.reglable !== 'non' && toks.length > 1 && toks.indexOf(v) < 0) w = 'valeur intermédiaire : pas un cran du catalogue';
      }
      cel.textContent = txt; msg.textContent = w; msg.style.color = /hors plage/.test(w) ? '#b3261e' : '#a15c00'; if(/hors plage/.test(w)) nbAlerte++;
    });
    var fus = epfFusible($('epf-cat').value);
    $('epf-t2').textContent = (fus ? 'Fusible' : 'Déclencheur') + (nbAlerte ? ' ⚠ ' + nbAlerte : '');
    courbeDecl();
  }
  /* V3.45 : courbe de déclenchement calculée avec les réglages en cours (et courbes numérisées de la fiche) */
  function courbeDecl(){
    var h = $('epf-courbe'); if(!h || typeof ecvDessiner !== 'function') return;
    var k = $('epf-cons').value, code = $('epf-dec').value, dj = djCourant(), g = $('epf-gam').value;
    if(epfFusible($('epf-cat').value) || !dj || (!code && typeof emfGammeIntegree === 'function' && !emfGammeIntegree(k, g))){ h.innerHTML = ''; return; }
    var opt = {constructeur: k, code: code, dj: dj, In: Number(dj.calibreA) || epfNum(dj.calibre), regl: regl};
    var bloc = $('epf-amont-opt');
    if(amontProt){
      bloc.style.display = ''; $('epf-amont').checked = EPF_AMONT_ON; $('epf-amont-nom').textContent = amontProt.titre + ' — ' + (amontProt.dj.gamme || '') + ' ' + (amontProt.dj.calibre || '') + ' A' + (amontProt.code ? ' · ' + amontProt.code : '');
      if(EPF_AMONT_ON) opt.amont = amontProt;
    } else bloc.style.display = 'none';
    ecvDessiner(h, opt);
  }

  function docsDecl(){
    var h = $('epf-docs'); if(!h || typeof emdPanneau !== 'function') return;
    var k = $('epf-cons').value, code = $('epf-dec').value, g = $('epf-gam').value;
    if(!code && !g){ h.innerHTML = '<span style="color:var(--muted,#667);">Choisissez une gamme ou un déclencheur pour voir ou ajouter ses fiches techniques et courbes.</span>'; return; }
    if(!code && g && typeof emfGammeIntegree === 'function' && !emfGammeIntegree(k, g)){ h.innerHTML = '<span style="color:var(--muted,#667);">Déclencheur monté séparément : aucune fiche n’est liée à la protection. Choisissez un déclencheur pour voir ses fiches techniques et courbes.</span>'; return; }
    var dj = djCourant(), opt = {gamme: g}; if(dj){ opt.courbe = dj.courbe; opt.calibre = dj.calibreA != null ? Number(dj.calibreA) : epfNum(dj.calibre); opt.normes = dj.normes; }
    opt.apres = function(){ $('epf-t2').setAttribute('data-nd', emdDocsPour(k, code, g).length); };
    emdPanneau(h, k, code, opt);
  }
  function reglages(){
    var k = $('epf-cons').value, code = $('epf-dec').value;
    metaRows = code ? (STATE.etudeMatReglages || []).filter(function(r){ return r.constructeur === k && r.declencheur === code; }).sort(function(a, b){ return (a.rang || 0) - (b.rang || 0); }) : [];
    if(!metaRows.length){ $('epf-regl').innerHTML = '<span style="color:var(--muted,#667);">' + (code ? 'Aucun réglage décrit au catalogue pour « ' + esc(code) + ' ».' : 'Sans déclencheur à régler.') + '</span>'; majCalc(); return; }
    var h = '', fonc = null;
    h += '<table style="border-collapse:collapse;width:100%;"><thead><tr style="text-align:left;color:#667;"><th style="padding:2px 8px 2px 0;">Paramètre</th><th style="padding:2px 8px;">Réglage</th><th style="padding:2px 8px;">Soit</th><th style="padding:2px 8px;">Crans / plage du catalogue</th></tr></thead><tbody>';
    metaRows.forEach(function(m, i){
      if(m.fonction !== fonc){ fonc = m.fonction; h += '<tr><td colspan="4" style="padding:8px 0 2px;font-weight:600;border-bottom:1px solid #dde;">' + esc(m.fonction) + '</td></tr>'; }
      var cle = epfCle(m.fonction, m.parametre), toks = String(m.crans || '').split(/\s*;\s*|\s+\/\s+/).map(function(x){ return x.trim(); }).filter(function(x){ return x && x !== '—' && !/[:à<>]/.test(x.replace(/\(.*\)/, '')) && !/classe|plage|fixe/.test(x); }), lid = 'epf-l' + i;
      var fixe = m.reglable === 'non';
      h += '<tr><td style="padding:2px 8px 2px 0;">' + esc(m.parametre) + (m.unite ? ' <span style="color:#889;">(' + esc(m.unite) + ')</span>' : '') + '</td><td style="padding:2px 8px;">' +
        (fixe ? '<span style="color:#667;">' + esc(m.crans && m.crans !== '—' ? m.crans : 'fixe') + '</span>'
          : '<input data-rk="' + esc(cle) + '" list="' + lid + '" style="width:110px;" value="' + esc(regl[cle] !== undefined && regl[cle] !== null ? regl[cle] : '') + '" placeholder="valeur"><datalist id="' + lid + '">' + toks.map(function(t2){ return '<option value="' + esc(t2) + '">'; }).join('') + '</datalist>') +
        '</td><td style="padding:2px 8px;white-space:nowrap;" id="epf-a' + i + '"></td><td style="padding:2px 8px;color:#667;">' + (fixe ? 'non réglable' : esc(m.crans || [m.cranMin, m.cranMax].filter(Boolean).join(' à ') || '—')) + '<div id="epf-w' + i + '" style="font-size:11.5px;"></div></td></tr>';
    });
    $('epf-regl').innerHTML = h + '</tbody></table>';
    $('epf-regl').querySelectorAll('input[data-rk]').forEach(function(inp){ inp.addEventListener('input', function(){ regl[inp.getAttribute('data-rk')] = inp.value; majCalc(); }); });
    majCalc();
  }
  function valeursUsuelles(){
    metaRows.forEach(function(m){
      if(m.reglable === 'non') return;
      var toks = String(m.crans || '').split(/\s*;\s*/).map(function(x){ return x.trim(); }).filter(function(x){ return epfNum(x) !== null && !/[à<>]/.test(x); });
      if(!toks.length) return;
      regl[epfCle(m.fonction, m.parametre)] = /^courant Ir/.test(m.parametre) ? toks[toks.length - 1] : toks[Math.floor(toks.length / 2)];
    });
    reglages();
  }
  function onglet(n){ $('epf-p1').style.display = n === 1 ? '' : 'none'; $('epf-p2').style.display = n === 2 ? '' : 'none'; $('epf-t1').style.fontWeight = n === 1 ? '600' : '400'; $('epf-t2').style.fontWeight = n === 2 ? '600' : '400'; $('epf-t1').classList.toggle('btn-primary', n === 1); $('epf-t2').classList.toggle('btn-primary', n === 2); }
  $('epf-t1').addEventListener('click', function(){ onglet(1); }); $('epf-t2').addEventListener('click', function(){ onglet(2); });
  $('epf-usuel').addEventListener('click', valeursUsuelles);
  $('epf-raz').addEventListener('click', function(){ regl = {}; reglages(); });
  onglet(1);

  /* pre-remplissage depuis la saisie existante */
  var exist = null;
  if(val.constructeur){
    exist = (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === val.constructeur && x.gamme === val.gamme && String(x.calibre) === String(val.calibre) &&
      String(x.courbe) === String(val.courbe) && String(x.variante) === String(val.variante); })[0] || null;
  }
  if(!exist && val.constructeur && val.gamme){      /* saisie plus ancienne ou importée : on retrouve au mieux la ligne du catalogue (calibre égal, puis courbe / variante proches) */
    var cand = (STATE.etudeMatDisj || []).filter(function(x){ return x.constructeur === val.constructeur && x.gamme === val.gamme && (!val.categorie || x.categorie === val.categorie); });
    exist = cand.filter(function(x){ return String(x.calibre) === String(val.calibre) && String(x.variante) === String(val.variante); })[0] || cand.filter(function(x){ return String(x.calibre) === String(val.calibre); })[0] || null;
    if(!exist && cand.length){ $('epf-cat').setAttribute('data-sel', cand[0].categorie); cats(); $('epf-gam').value = val.gamme; calibres(); $('epf-dec').setAttribute('data-sel', val.declencheur || ''); declencheurs(); exist = false; }
  }
  if(exist !== false){
    $('epf-cat').setAttribute('data-sel', exist ? exist.categorie : (val.categorie || ''));
    cats();
    if(exist){ $('epf-gam').value = exist.gamme; calibres(); $('epf-cal').value = exist.id; $('epf-dec').setAttribute('data-sel', val.declencheur || ''); declencheurs(); }
  }
  $('epf-cons').addEventListener('change', function(){ regl = {}; cats(); });
  $('epf-cat').addEventListener('change', function(){ regl = {}; gammes(); });
  $('epf-gam').addEventListener('change', function(){ regl = {}; calibres(); });
  $('epf-cal').addEventListener('change', function(){ declencheurs(); });
  $('epf-dec').addEventListener('change', function(){ regl = {}; fiche(); reglages(); docsDecl(); });

  function patchDe(vide){
    var dj = vide ? null : ((STATE.etudeMatDisj || []).filter(function(x){ return x.id === $('epf-cal').value; })[0] || null);
    var cc = vide ? '' : $('epf-cons').value, dec = vide ? '' : $('epf-dec').value;
    var rg = {}; Object.keys(regl).forEach(function(kk){ if(regl[kk] !== undefined && regl[kk] !== null && String(regl[kk]).trim() !== '') rg[kk] = String(regl[kk]).trim(); });
    return {constructeur: dj ? dj.constructeur : (cc || null), categorie: dj ? dj.categorie : (vide ? null : ($('epf-cat').value || null)), gamme: dj ? dj.gamme : (vide ? null : ($('epf-gam').value || null)),
      variante: dj ? dj.variante : null, calibre: dj ? String(dj.calibre) : null, courbe: dj ? dj.courbe : null, declencheur: dec || null, reglages: dec && Object.keys(rg).length ? rg : null};
  }
  function enregistrer(vide){
    var v = patchDe(vide), p;
    closeModal();
    if(info.k === 'dep'){
      var patch = {protConstructeur: v.constructeur, protCategorie: v.categorie, protGamme: v.gamme, protVariante: v.variante, protCalibre: v.calibre, protCourbe: v.courbe, protDeclencheur: v.declencheur, protReglages: v.reglages, updatedAt: nowISO()};
      if($('epf-pci')) patch.protCi = $('epf-pci').value || null;
      if(circuit){ p = STATE.db.doc('etudeBtCircuits/' + circuit.id).update(patch).then(function(){ Object.assign(circuit, patch); }); }
      else {
        var nouveau = Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null, consoId: d.id, tag: d.tag || null,
          tableauCle: eelCle(d.switchgear), instanceCle: null, createdAt: nowISO(), creePar: currentUserName()}, patch);
        p = STATE.db.collection('etudeBtCircuits').add(nouveau).then(function(ref){ (STATE.etudeBtCircuits || (STATE.etudeBtCircuits = [])).push(Object.assign({id: ref && ref.id}, nouveau)); });
      }
    } else {
      p = eebSauver(projet, {cle: info.cle, titre: info.titre}, function(){ return {teteConstructeur: v.constructeur, teteCategorie: v.categorie, teteGamme: v.gamme, teteVariante: v.variante,
        teteCalibre: v.calibre, teteCourbe: v.courbe, teteDeclencheur: v.declencheur, teteReglages: v.reglages}; });
    }
    p.then(function(){ toast(vide ? 'Protection retirée' : 'Protection enregistrée', 'success'); scheduleRender(); }).catch(function(e){ console.error(e); toast('Erreur d\'enregistrement', 'danger'); });
  }
  $('epf-ok').addEventListener('click', function(){
    if(!$('epf-cal').value){ toast('Choisissez au moins le constructeur, la catégorie, la gamme et le calibre.', 'danger'); return; }
    enregistrer(false);
  });
  $('epf-clear').addEventListener('click', function(){ enregistrer(true); });
}
