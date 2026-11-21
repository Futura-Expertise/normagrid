/* =========================================================
   V3.45 — ÉTUDE ÉLECTRIQUE : courbes de déclenchement
     1. Courbe CALCULÉE d'un déclencheur à partir de ses réglages (catalogue etudeMatReglages) : bande « plus rapide / plus lente »
        - électronique (MicroLogic) : long retard I²t (Ir, tr à 6 Ir) ou classe moteur, court retard (Isd, tsd, I²t), instantané (Ii)
        - thermique-magnétique (TM-D, TM-G) : thermique CEI 60947-2 (1,05 Ir / 1,30 Ir) + magnétique ±20 %
        - magnétique seul (MA) ; disjoncteur à déclencheur intégré : thermique CEI 60898-1 (1,13 / 1,45 In) + magnétique Im min / max du catalogue
        Modèle générique et indicatif : la courbe numérisée de la fiche constructeur (etudeMatCourbes) est tracée en superposition et prime pour l'étude.
     2. Affichage : dans la Base matériel (colonne « Courbe »), dans la fenêtre de protection du schéma (déclencheur choisi, réglages en direct).
     3. Numérisation d'une courbe sur la page d'une fiche PDF : calage des axes (log-log), points cliqués ou suivi automatique d'une courbe.
   ========================================================= */
var ECV_COULEURS = ['#1f5fa8', '#c0392b', '#2e8b57', '#b9770e', '#7d3c98', '#117a8b'];
function ecvNum(t){ var m = String(t === undefined || t === null ? '' : t).replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function ecvFmt(v, d){ return v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toLocaleString('fr-FR', {maximumFractionDigits: d === undefined ? 1 : d}); }
function ecvReglagesDe(constructeur, code){
  return (STATE.etudeMatReglages || []).filter(function(r){ return r.constructeur === constructeur && r.declencheur === code; }).sort(function(a, b){ return (a.rang || 0) - (b.rang || 0); });
}
/* valeur d'un réglage : choisie (regl) sinon valeur usuelle déduite des crans du catalogue */
function ecvTokens(m){ return String(m.crans || '').split(/\s*;\s*/).map(ecvNum).filter(function(x){ return x !== null; }); }
function ecvValeur(rows, regl, fonctionRe, paramRe, parDefaut){
  var m = rows.filter(function(r){ return fonctionRe.test(r.fonction || '') && paramRe.test(r.parametre || ''); })[0];
  if(!m) return {v: null, defaut: false, m: null};
  var v = ecvNum((regl || {})[(m.fonction + '|' + m.parametre)]);
  if(v !== null) return {v: v, defaut: false, m: m};
  var tk = ecvTokens(m); if(!tk.length) return {v: null, defaut: false, m: m};
  var d = parDefaut === 'max' ? Math.max.apply(null, tk) : (tk.indexOf(parDefaut) >= 0 ? parDefaut : Math.max.apply(null, tk));
  return {v: d, defaut: true, m: m};
}
var ECV_TSD = {0: [0.02, 0.08], 0.1: [0.08, 0.14], 0.2: [0.14, 0.2], 0.3: [0.23, 0.32], 0.4: [0.35, 0.5]};   /* tsd (s) -> [temps de non-déclenchement, temps de coupure max] */

/* Modèle : retourne {fonctions:[{nom, lo(I), hi(I), bp:[…]}], In, Ir, notes[], ok, jalons:[{x,label}]} ; lo/hi renvoient le temps (s) ou Infinity */
function ecvModele(o){
  var dc = o.code ? ((STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === o.constructeur && x.code === o.code; })[0] || null) : null;
  var rows = o.code ? ecvReglagesDe(o.constructeur, o.code) : [], dj = o.dj || null, regl = o.regl || {};
  var In = Number(o.In) || (dj && (Number(dj.calibreA) || ecvNum(dj.calibre))) || (dc && Number(dc.calibreA)) || null;
  var res = {fonctions: [], In: In, Ir: null, notes: [], ok: false, jalons: [], type: ''};
  var INF = Infinity;
  var defauts = [];
  var note = function(t){ if(res.notes.indexOf(t) < 0) res.notes.push(t); };
  if(o.code && !dc){ return res; }
  var tp = dc ? String(dc.type || '').toLowerCase() : '';
  var code = o.code || '';
  /* ---------- électronique (MicroLogic) ---------- */
  if(dc && (/lectron/.test(tp) || /^micrologic/i.test(code)) && rows.length){
    if(!In){ note('Choisissez le calibre de l\'appareil.'); return res; }
    var fIr = ecvValeur(rows, regl, /long/i, /courant Ir/i, 'max'), Ir = (fIr.v !== null ? fIr.v : 1) * In; if(fIr.defaut) defauts.push('Ir');
    res.Ir = Ir; res.type = 'électronique';
    var fTr = ecvValeur(rows, regl, /long/i, /temps tr/i, 16), fCl = ecvValeur(rows, regl, /long/i, /classe/i, 10);
    var cl = fCl.m ? fCl.v : null, tr = fTr.m ? fTr.v : null;
    var fSd = ecvValeur(rows, regl, /short/i, /courant Isd/i, 10), fTs = ecvValeur(rows, regl, /short/i, /temps tsd/i, 0.2), fIi = ecvValeur(rows, regl, /instant/i, /courant Ii/i, 'max');
    var rowTsd = fTs.m, i2tOn = false;
    if(rowTsd){ var k = ecvNum((regl || {})[(rowTsd.fonction + '|' + rowTsd.parametre)]); i2tOn = /i²t on/i.test(String((regl || {})[(rowTsd.fonction + '|' + rowTsd.parametre)] || '')) || (k !== null && /on/i.test(String((regl || {})[(rowTsd.fonction + '|' + rowTsd.parametre)] || ''))); }
    if(cl !== null){   /* départ-moteur : classe = temps de déclenchement à 7,2 Ir */
      res.fonctions.push({nom: 'Long retard (classe ' + cl + ')', bp: [1.05 * Ir, 1.2 * Ir],
        hi: function(I){ var x = I / Ir; return x < 1.2 ? INF : cl * Math.pow(7.2 / x, 2) * 1.2; },
        lo: function(I){ var x = I / Ir; return x < 1.05 ? INF : cl * Math.pow(7.2 / x, 2) * 0.8; }});
      if(fCl.defaut) defauts.push('classe');
    } else if(tr !== null){
      res.fonctions.push({nom: 'Long retard (tr = ' + ecvFmt(tr) + ' s)', bp: [1.05 * Ir, 1.2 * Ir],
        hi: function(I){ var x = I / Ir; return x < 1.2 ? INF : tr * 36 / (x * x); },
        lo: function(I){ var x = I / Ir; return x < 1.05 ? INF : 0.8 * tr * 36 / (x * x); }});
      if(fTr.defaut) defauts.push('tr');
    }
    if(fSd.m && fSd.v !== null){
      var Isd = fSd.v * Ir, ts = fTs.v !== null ? fTs.v : 0.2, tt = ECV_TSD[ts] || ECV_TSD[0.2];
      res.fonctions.push({nom: 'Court retard (Isd = ' + ecvFmt(fSd.v) + ' Ir' + (ts ? ', tsd = ' + ecvFmt(ts, 2) + ' s' : '') + ')', bp: [0.9 * Isd, 1.1 * Isd],
        hi: function(I){ if(I < 1.1 * Isd) return INF; return i2tOn ? Math.min(tt[1], ts * Math.pow(10 * Ir / I, 2) * 1.25 + 0.02) : tt[1]; },
        lo: function(I){ if(I < 0.9 * Isd) return INF; return i2tOn ? Math.min(tt[0], ts * Math.pow(10 * Ir / I, 2) * 0.8) : tt[0]; }});
      if(fSd.defaut) defauts.push('Isd'); if(fTs.defaut && ts) defauts.push('tsd');
      res.jalons.push({x: Isd, label: 'Isd'});
    }
    if(fIi.m && fIi.v !== null){
      var Ii = fIi.v * In;
      res.fonctions.push({nom: 'Instantané (Ii = ' + ecvFmt(fIi.v) + ' In = ' + ecvFmt(Ii, 0) + ' A)', bp: [0.9 * Ii, 1.1 * Ii],
        hi: function(I){ return I < 1.1 * Ii ? INF : 0.05; }, lo: function(I){ return I < 0.9 * Ii ? INF : 0.01; }});
      if(fIi.defaut) defauts.push('Ii'); res.jalons.push({x: Ii, label: 'Ii'});
    }
    res.jalons.push({x: Ir, label: 'Ir'});
    res.ok = res.fonctions.length > 0; if(defauts.length) note('Réglage non choisi, valeur usuelle utilisée : ' + defauts.join(', ') + '.');
    note('Modèle générique MicroLogic (tolérances usuelles) — à confirmer avec la courbe de la fiche constructeur.');
    return res;
  }
  /* ---------- thermique-magnétique (TM-D, TM-G) ---------- */
  if(dc && (/thermique/.test(tp) || /^TM\d/i.test(code))){
    var InT = In || Number(dc.calibreA) || null; if(!InT){ note('Choisissez le calibre.'); return res; }
    var fI = ecvValeur(rows, regl, /thermique|long/i, /^courant/i, 'max'), irMax = Number(dc.irMaxA) || InT, ir = fI.m && fI.v !== null ? (fI.m.unite === 'A' ? fI.v : fI.v * InT) : irMax;
    var Im = Number(dc.imMinA) || null, imMax = Number(dc.imMaxA) || Im;
    var fIm = ecvValeur(rows, regl, /instant/i, /^courant/i, 'max'); if(fIm.m && fIm.v !== null && !Im) Im = fIm.m.unite === 'A' ? fIm.v : fIm.v * InT;
    res.Ir = ir; res.type = 'thermique-magnétique';
    var T0 = 3600 * (1.3 * 1.3 - 1);
    res.fonctions.push({nom: 'Thermique (Ir = ' + ecvFmt(ir, 0) + ' A)', bp: [1.05 * ir, 1.3 * ir],
      hi: function(I){ var x = I / ir; return x < 1.3 ? INF : T0 / (x * x - 1); },
      lo: function(I){ var x = I / ir; return x < 1.05 ? INF : (x < 1.3 ? 3600 : 0.3 * T0 / (x * x - 1)); }});
    if(Im){ res.fonctions.push({nom: 'Magnétique (Im = ' + ecvFmt(Im, 0) + ' A)', bp: [0.8 * Im, 1.2 * (imMax || Im)],
      hi: function(I){ return I < 1.2 * (imMax || Im) ? INF : 0.02; }, lo: function(I){ return I < 0.8 * Im ? INF : 0.005; }}); res.jalons.push({x: Im, label: 'Im'}); }
    res.jalons.push({x: ir, label: 'Ir'}); res.ok = true;
    note('Modèle thermique générique CEI 60947-2 (non-déclenchement 1,05 Ir, déclenchement 1,30 Ir) ; magnétique ±20 % — à confirmer avec la fiche.');
    return res;
  }
  /* ---------- magnétique seul (MA) ---------- */
  if(dc && (/magn/.test(tp) || /^MA\d/i.test(code))){
    var InM = In || Number(dc.calibreA) || ecvNum(code); if(!InM){ note('Choisissez le calibre.'); return res; }
    var fM = ecvValeur(rows, regl, /instant/i, /^courant/i, 'max'), ImM = fM.m && fM.v !== null ? (fM.m.unite === 'A' ? fM.v : fM.v * InM) : (Number(dc.imMinA) || null);
    if(!ImM){ note('Seuil magnétique inconnu.'); return res; }
    res.type = 'magnétique'; res.fonctions.push({nom: 'Magnétique (Im = ' + ecvFmt(ImM, 0) + ' A)', bp: [0.8 * ImM, 1.2 * ImM], hi: function(I){ return I < 1.2 * ImM ? INF : 0.02; }, lo: function(I){ return I < 0.8 * ImM ? INF : 0.005; }});
    res.jalons.push({x: ImM, label: 'Im'}); res.Ir = null; res.ok = true;
    note('Déclencheur magnétique seul : pas de protection contre les surcharges (à assurer par un relais thermique). Seuil ±20 %.');
    return res;
  }
  /* ---------- disjoncteur à déclencheur intégré (modulaire) ---------- */
  if(!o.code && dj && (typeof emfGammeIntegree !== 'function' || emfGammeIntegree(o.constructeur, dj.gamme))){
    var InI = Number(dj.calibreA) || ecvNum(dj.calibre); if(!InI) return res;
    var a = Number(dj.imMin), b = Number(dj.imMax); if(!a || !b){ note('Seuils magnétiques absents du catalogue pour cette ligne.'); }
    res.In = InI; res.Ir = InI; res.type = 'intégré';
    res.fonctions.push({nom: 'Thermique (In = ' + ecvFmt(InI, 0) + ' A)', bp: [1.13 * InI, 1.45 * InI],
      hi: function(I){ var x = I / InI; return x < 1.45 ? INF : 3600 * 0.45 * 1.45 / (x * x - 1) * 1.1; },
      lo: function(I){ var x = I / InI; return x < 1.13 ? INF : (x < 1.45 ? 3600 : 0.35 * 3600 * 0.45 * 1.45 / (x * x - 1)); }});
    if(a && b){ res.fonctions.push({nom: 'Magnétique ' + ecvFmt(a) + ' à ' + ecvFmt(b) + ' In (' + ecvFmt(a * InI, 0) + ' à ' + ecvFmt(b * InI, 0) + ' A)', bp: [a * InI, b * InI],
      hi: function(I){ return I < b * InI ? INF : 0.01; }, lo: function(I){ return I < a * InI ? INF : 0.005; }}); res.jalons.push({x: a * InI, label: 'Im min'}, {x: b * InI, label: 'Im max'}); }
    res.ok = true; note('Modèle thermique générique CEI 60898-1 (1,13 In / 1,45 In) ; seuils magnétiques du catalogue — à confirmer avec la fiche.');
    return res;
  }
  return res;
}
/* échantillonne la bande : retourne {lo:[[I,t]…], hi:[[I,t]…]} (min de toutes les fonctions actives) */
function ecvEchantillon(mod, imax){
  var pts = [], f, i, n = 140, i0 = Infinity;
  mod.fonctions.forEach(function(fn){ fn.bp.forEach(function(b){ i0 = Math.min(i0, b); }); });
  var a = Math.max(1, i0 * 0.98), b = imax || (mod.In || 100) * 60;
  if(b <= a * 2) b = a * 20;
  for(i = 0; i <= n; i++) pts.push(a * Math.pow(b / a, i / n));
  mod.fonctions.forEach(function(fn){ fn.bp.forEach(function(x){ pts.push(x * 0.9999, x, x * 1.0001); }); });
  pts = pts.filter(function(x){ return x >= a && x <= b; }).sort(function(p, q){ return p - q; });
  var lo = [], hi = [];
  pts.forEach(function(I){
    var l = Infinity, h = Infinity;
    mod.fonctions.forEach(function(fn){ l = Math.min(l, fn.lo(I)); h = Math.min(h, fn.hi(I)); });
    if(isFinite(l)) lo.push([I, Math.max(0.001, Math.min(l, 1e5))]);
    if(isFinite(h)) hi.push([I, Math.max(0.001, Math.min(h, 1e5))]);
  });
  return {lo: lo, hi: hi};
}

/* ---- tracé log-log : bandes, courbes numérisées, jalons ---- */
function ecvSvg(o){
  var W = 620, H = 380, ml = 52, mb = 38, mt = 12, mr = 14, i, k, g = '';
  var tous = [];
  (o.bandes || []).forEach(function(b){ b.lo.concat(b.hi).forEach(function(p){ tous.push(p); }); });
  (o.series || []).forEach(function(s){ s.pts.forEach(function(p){ tous.push(p); }); });
  (o.jalons || []).forEach(function(j){ tous.push([j.x, 1]); });
  if(!tous.length) return '<div class="hint">Rien à tracer.</div>';
  var xs = tous.map(function(p){ return p[0]; }), x0 = Math.floor(Math.log10(Math.max(0.1, Math.min.apply(null, xs) * 0.6))), x1 = Math.ceil(Math.log10(Math.max.apply(null, xs)));
  if(o.xmax) x1 = Math.max(x1, Math.ceil(Math.log10(o.xmax))); if(x1 <= x0) x1 = x0 + 1;
  var y0 = -3, y1 = 4;
  var X = function(v){ return ml + (Math.log10(v) - x0) / (x1 - x0) * (W - ml - mr); }, Y = function(v){ return H - mb - (Math.log10(Math.max(1e-3, Math.min(1e4, v))) - y0) / (y1 - y0) * (H - mb - mt); };
  for(i = x0; i <= x1; i++){
    for(k = 1; k < 10; k++){ var vx = k * Math.pow(10, i); if(Math.log10(vx) > x1) break; g += '<line x1="' + X(vx) + '" y1="' + mt + '" x2="' + X(vx) + '" y2="' + (H - mb) + '" stroke="' + (k === 1 ? '#b9c2d0' : '#e6eaf0') + '" stroke-width="' + (k === 1 ? 1 : 0.6) + '"/>'; }
    g += '<text x="' + X(Math.pow(10, i)) + '" y="' + (H - mb + 14) + '" font-size="10" text-anchor="middle" fill="#556">' + Math.pow(10, i).toLocaleString('fr-FR') + '</text>';
  }
  for(i = y0; i <= y1; i++){
    for(k = 1; k < 10; k++){ var vy = k * Math.pow(10, i); if(Math.log10(vy) > y1) break; g += '<line x1="' + ml + '" y1="' + Y(vy) + '" x2="' + (W - mr) + '" y2="' + Y(vy) + '" stroke="' + (k === 1 ? '#b9c2d0' : '#e6eaf0') + '" stroke-width="' + (k === 1 ? 1 : 0.6) + '"/>'; }
    g += '<text x="' + (ml - 5) + '" y="' + (Y(Math.pow(10, i)) + 3) + '" font-size="10" text-anchor="end" fill="#556">' + Math.pow(10, i).toLocaleString('fr-FR') + '</text>';
  }
  g += '<rect x="' + ml + '" y="' + mt + '" width="' + (W - ml - mr) + '" height="' + (H - mb - mt) + '" fill="none" stroke="#889"/>';
  g += '<text x="' + ((ml + W - mr) / 2) + '" y="' + (H - 4) + '" font-size="11" text-anchor="middle" fill="#334">courant (A)</text>';
  g += '<text transform="translate(12 ' + ((mt + H - mb) / 2) + ') rotate(-90)" font-size="11" text-anchor="middle" fill="#334">temps de déclenchement (s)</text>';
  var lg = [];
  (o.bandes || []).forEach(function(b, n){
    var c = b.color || ECV_COULEURS[n % ECV_COULEURS.length];
    if(b.lo.length && b.hi.length){
      var poly = b.lo.concat(b.hi.slice().reverse());
      g += '<polygon points="' + poly.map(function(p){ return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '" fill="' + c + '" fill-opacity="0.16" stroke="none"/>';
    }
    [b.lo, b.hi].forEach(function(l){ if(l.length) g += '<polyline fill="none" stroke="' + c + '" stroke-width="1.7" points="' + l.map(function(p){ return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>'; });
    lg.push([c, b.nom || 'Courbe calculée', false]);
  });
  (o.series || []).forEach(function(s, n){
    var c = s.color || ECV_COULEURS[(n + 3) % ECV_COULEURS.length];
    g += '<polyline fill="none" stroke="' + c + '" stroke-width="1.6" stroke-dasharray="5 3" points="' + s.pts.map(function(p){ return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    lg.push([c, s.nom, true]);
  });
  (o.jalons || []).forEach(function(j){
    if(!(j.x > 0) || Math.log10(j.x) < x0 || Math.log10(j.x) > x1) return;
    g += '<line x1="' + X(j.x) + '" y1="' + mt + '" x2="' + X(j.x) + '" y2="' + (H - mb) + '" stroke="#889" stroke-dasharray="2 3"/><text x="' + (X(j.x) + 3) + '" y="' + (mt + 10) + '" font-size="10" fill="#556">' + esc(j.label) + '</text>';
  });
  lg.forEach(function(l, n){ g += '<text x="' + (ml + 8) + '" y="' + (H - mb - 8 - (lg.length - 1 - n) * 13) + '" font-size="10.5" text-anchor="start" fill="' + l[0] + '">' + (l[2] ? '- - ' : '■ ') + esc(l[1]) + '</text>'; });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:700px;background:#fff;border:1px solid #dde;border-radius:6px;">' + g + '</svg>';
}
/* courbes numérisées d'un déclencheur, converties en ampères */
function ecvSeriesNumerisees(constructeur, code, In, Ir){
  var out = [];
  (STATE.etudeMatCourbes || []).filter(function(c){ return c.declencheur === code && (!c.constructeur || c.constructeur === constructeur); }).forEach(function(c){
    var f = c.abscisse === 'A' ? 1 : (c.abscisse === '× In' ? In : Ir);
    if(!f){ return; }
    (c.series || []).forEach(function(s){ out.push({nom: 'numérisée : ' + c.nom + (s.nom ? ' / ' + s.nom : ''), pts: s.pts.map(function(p){ return [p[0] * f, p[1]]; })}); });
  });
  return out;
}
/* dessine dans « hote » la courbe du déclencheur (ou du disjoncteur intégré) avec les réglages de o.regl */
function ecvDessiner(hote, o){
  var mod = ecvModele(o);
  var h = '';
  if(!mod.ok){
    hote.innerHTML = '<span style="color:var(--muted,#667);">' + esc(mod.notes[0] || (o.code ? 'Pas de modèle de courbe pour ce déclencheur (accessoire ou donnée manquante).' : 'Courbe indisponible pour cette sélection.')) + '</span>';
    return mod;
  }
  var ech = ecvEchantillon(mod, o.imax);
  var ser = o.code ? ecvSeriesNumerisees(o.constructeur, o.code, mod.In, mod.Ir) : [];
  h += '<div style="font-weight:600;margin:2px 0 4px;">Courbe de déclenchement' + (o.code ? ' — ' + esc(o.code) : '') + (mod.In ? ' · In ' + ecvFmt(mod.In, 0) + ' A' : '') + '</div>';
  var bandes = [{lo: ech.lo, hi: ech.hi, nom: (o.amont ? 'cette protection' : 'bande calculée') + ' (' + (mod.type || '') + ')', color: '#1f5fa8'}], jal = mod.jalons.slice(), noteAmont = '';
  if(o.amont){
    var m2 = ecvModele({constructeur: o.amont.constructeur, code: o.amont.code, dj: o.amont.dj, In: o.amont.In, regl: o.amont.regl});
    if(m2.ok){
      var e2 = ecvEchantillon(m2, o.imax || Math.max((mod.In || 100) * 60, (m2.In || 100) * 20));
      bandes.push({lo: e2.lo, hi: e2.hi, nom: 'amont : ' + o.amont.titre + ' (' + (m2.type || '') + ')', color: '#c0392b'});
      m2.jalons.forEach(function(j){ jal.push({x: j.x, label: j.label + ' amont'}); });
      noteAmont = 'Protection amont : ' + m2.fonctions.map(function(f){ return esc(f.nom); }).join(' · ');
    } else noteAmont = 'Protection amont (' + esc(o.amont.titre) + ') : courbe indisponible (aucun déclencheur choisi ou donnée manquante).';
  }
  h += ecvSvg({bandes: bandes, series: ser, jalons: jal, xmax: o.imax});
  h += '<div style="color:#667;font-size:11.5px;margin-top:3px;">' + mod.fonctions.map(function(f){ return esc(f.nom); }).join(' · ') + (ser.length ? '<br>Courbe(s) numérisée(s) de la fiche en pointillés.' : '') + (noteAmont ? '<br><span style="color:#c0392b;">' + noteAmont + '</span>' : '') + '</div>';
  if(mod.notes.length) h += '<div style="color:#a15c00;font-size:11.5px;">' + mod.notes.map(esc).join('<br>') + '</div>';
  hote.innerHTML = h;
  return mod;
}

/* ---- fenêtre « Courbe » (Base matériel) : calibre et réglages modifiables, tracé en direct ---- */
function ecvOuvrir(o){
  var code = o.code || '', cons = o.constructeur, dj = o.dj || null;
  var dc = code ? ((STATE.etudeMatDecl || []).filter(function(x){ return x.constructeur === cons && x.code === code; })[0] || null) : null;
  var rows = code ? ecvReglagesDe(cons, code) : [], regl = {}, In = dj ? (Number(dj.calibreA) || ecvNum(dj.calibre)) : null;
  var cal = [];
  if(code){
    (STATE.etudeMatAssoc || []).filter(function(a){ return a.constructeur === cons && a.declencheur === code; }).forEach(function(a){
      (STATE.etudeMatDisj || []).filter(function(d){ return d.constructeur === cons && d.gamme === a.gamme && d.calibreA && (a.calibreMin == null || d.calibreA >= a.calibreMin) && (a.calibreMax == null || d.calibreA <= a.calibreMax); }).forEach(function(d){ if(cal.indexOf(Number(d.calibreA)) < 0) cal.push(Number(d.calibreA)); });
    });
    if(dc && dc.calibreA && cal.indexOf(Number(dc.calibreA)) < 0) cal.push(Number(dc.calibreA));
    cal.sort(function(a, b){ return a - b; });
    if(!In && cal.length) In = cal[cal.length - 1];
    if(dc && dc.calibreA) In = Number(dc.calibreA);
  }
  var h = '<div class="ecc-f" style="margin-bottom:8px;">' + (code ? '<div class="field"><label>Calibre de l\'appareil (A)</label><select id="ecv-in">' + cal.map(function(c){ return '<option' + (c === In ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' : '') + '</div>';
  var fonc = null;
  if(rows.length){
    h += '<table style="border-collapse:collapse;font-size:12.5px;margin-bottom:8px;"><tbody>';
    rows.forEach(function(m, i){
      if(m.reglable === 'non') return;
      if(m.fonction !== fonc){ fonc = m.fonction; h += '<tr><td colspan="3" style="padding:6px 0 2px;font-weight:600;border-bottom:1px solid #dde;">' + esc(m.fonction) + '</td></tr>'; }
      var toks = String(m.crans || '').split(/\s*;\s*/).map(function(x){ return x.trim(); }).filter(function(x){ return x && x !== '—'; });
      h += '<tr><td style="padding:2px 8px 2px 0;">' + esc(m.parametre) + (m.unite ? ' <span style="color:#889;">(' + esc(m.unite) + ')</span>' : '') + '</td><td><input data-rk="' + esc(m.fonction + '|' + m.parametre) + '" list="ecvl' + i + '" style="width:110px;" placeholder="usuel"><datalist id="ecvl' + i + '">' + toks.map(function(t){ return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></td><td style="padding-left:8px;color:#889;">' + esc(m.crans || '') + '</td></tr>';
    });
    h += '</tbody></table>';
  }
  var titre = code ? code : ((dj && dj.gamme) + (dj && dj.courbe && dj.courbe !== '—' ? ' courbe ' + dj.courbe : '') + ' ' + (dj && dj.calibre) + ' A');
  var ov = openModal({title: 'Courbe de déclenchement — ' + titre, large: true, foot: '<button type="button" class="btn" data-close-modal>Fermer</button>', body: '<div style="display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:16px;align-items:start;"><div>' + h + '</div><div id="ecv-g"></div></div>'});
  var maj = function(){
    var sel = ov.querySelector('#ecv-in'); if(sel) In = Number(sel.value) || In;
    ov.querySelectorAll('[data-rk]').forEach(function(i){ regl[i.getAttribute('data-rk')] = i.value; });
    ecvDessiner(ov.querySelector('#ecv-g'), {constructeur: cons, code: code, dj: dj, In: In, regl: regl});
  };
  ov.querySelectorAll('[data-rk], #ecv-in').forEach(function(i){ i.addEventListener('input', maj); i.addEventListener('change', maj); });
  maj();
}

/* =========================================================
   Numérisation d'une courbe sur une page de fiche PDF
   ecvNumeriser({docs:[fiches PDF], abscisse:'× Ir'|'× In'|'A', retour: function(series, abscisse)})
   ========================================================= */
function ecvNumeriser(o){
  var docs = (o.docs || []).filter(function(d){ return d.fichier && /\.pdf$/i.test(d.fichier); });
  if(!docs.length){ toast('Aucune fiche PDF disponible : ajoutez d\'abord la fiche (PDF) du déclencheur.', 'danger'); return; }
  var ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'ecv-num'; ov.style.zIndex = 5000;
  ov.innerHTML = '<div class="modal modal-lg"><div class="modal-head"><h3>Numériser une courbe sur la fiche</h3><button type="button" class="iconbtn" id="ecn-x">×</button></div><div class="modal-body">' +
    '<div class="toolbar" style="gap:8px;flex-wrap:wrap;margin-bottom:6px;"><label>Fiche <select id="ecn-doc">' + docs.map(function(d, i){ return '<option value="' + i + '">' + esc(d.nomFichier || d.fichier) + '</option>'; }).join('') + '</select></label>' +
    '<label>Page <input id="ecn-page" type="number" min="1" value="1" style="width:60px;"></label><button type="button" class="btn btn-sm" id="ecn-load">Afficher</button>' +
    '<label>Zoom <button type="button" class="btn btn-sm" id="ecn-zm">−</button> <span id="ecn-zv">100 %</span> <button type="button" class="btn btn-sm" id="ecn-zp">+</button></label><span id="ecn-msg" style="color:#b3261e;"></span></div>' +
    '<div style="display:grid;grid-template-columns:auto auto;gap:4px 14px;font-size:12.5px;margin-bottom:6px;align-items:center;">' +
      '<div><b>1. Calage des axes (log-log)</b> : saisissez deux valeurs de repère par axe, puis cliquez sur ces repères dans l\'image : <input id="ecn-x1" value="1" style="width:52px;"> → <input id="ecn-x2" value="100" style="width:52px;"> (axe courant) · <input id="ecn-y1" value="0,01" style="width:52px;"> → <input id="ecn-y2" value="1000" style="width:52px;"> (axe temps, s) <button type="button" class="btn btn-sm" id="ecn-cal">Caler</button> <span id="ecn-calst" style="color:#667;"></span></div>' +
      '<div>Courant exprimé en <select id="ecn-abs">' + ['× Ir', '× In', 'A'].map(function(a){ return '<option' + (o.abscisse === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px;font-size:12.5px;"><b>2. Relevé</b> : <label><input type="radio" name="ecn-m" value="auto" checked style="width:auto;"> suivre une courbe (cliquer dessus)</label> <label><input type="radio" name="ecn-m" value="pts" style="width:auto;"> points un à un</label>' +
    '<label>tolérance couleur <input id="ecn-tol" type="range" min="15" max="120" value="55" style="width:90px;"></label><label>nom <input id="ecn-nom" value="min" style="width:90px;"></label><button type="button" class="btn btn-sm" id="ecn-undo">Annuler le dernier</button> <button type="button" class="btn btn-sm" id="ecn-clr">Tout effacer</button></div>' +
    '<div id="ecn-wrap" style="max-height:56vh;overflow:auto;border:1px solid #ccd;border-radius:6px;background:#fff;"><canvas id="ecn-cv" style="cursor:crosshair;display:block;"></canvas></div>' +
    '<div id="ecn-ser" style="margin-top:6px;font-size:12.5px;"></div></div><div class="modal-foot"><button type="button" class="btn" id="ecn-ann">Annuler</button><button type="button" class="btn btn-primary" id="ecn-ok">Utiliser ces points</button></div></div>';
  document.body.appendChild(ov);
  var $ = function(id){ return ov.querySelector('#' + id); };
  var cv = $('ecn-cv'), ctx = cv.getContext('2d'), img = null, zoom = 1, cal = {x: [], y: [], etape: 0}, series = [], hist = [];
  var fermer = function(){ ov.remove(); };
  $('ecn-x').addEventListener('click', fermer); $('ecn-ann').addEventListener('click', fermer);
  var val = function(id){ return ecvNum($(id).value); };
  var inv = function(px, p1, p2, v1, v2){ return Math.pow(10, Math.log10(v1) + (px - p1) / (p2 - p1) * (Math.log10(v2) - Math.log10(v1))); };
  var vx = function(px){ return inv(px, cal.x[0], cal.x[1], val('ecn-x1'), val('ecn-x2')); }, vy = function(py){ return inv(py, cal.y[0], cal.y[1], val('ecn-y1'), val('ecn-y2')); };
  var calOk = function(){ return cal.etape >= 4; };
  var pxX = function(v){ return cal.x[0] + (Math.log10(v) - Math.log10(val('ecn-x1'))) / (Math.log10(val('ecn-x2')) - Math.log10(val('ecn-x1'))) * (cal.x[1] - cal.x[0]); };
  var pxY = function(v){ return cal.y[0] + (Math.log10(v) - Math.log10(val('ecn-y1'))) / (Math.log10(val('ecn-y2')) - Math.log10(val('ecn-y1'))) * (cal.y[1] - cal.y[0]); };
  function dessiner(){
    if(!img) return;
    cv.width = Math.round(img.width * zoom); cv.height = Math.round(img.height * zoom);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#d00'; ctx.fillStyle = '#d00';
    [cal.x[0], cal.x[1]].forEach(function(p){ if(p !== undefined){ ctx.beginPath(); ctx.moveTo(p * zoom, 0); ctx.lineTo(p * zoom, cv.height); ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]); } });
    [cal.y[0], cal.y[1]].forEach(function(p){ if(p !== undefined){ ctx.beginPath(); ctx.moveTo(0, p * zoom); ctx.lineTo(cv.width, p * zoom); ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]); } });
    series.forEach(function(s, n){
      ctx.strokeStyle = ctx.fillStyle = ECV_COULEURS[n % ECV_COULEURS.length]; ctx.lineWidth = 2; ctx.beginPath();
      s.px.forEach(function(p, i){ if(i) ctx.lineTo(p[0] * zoom, p[1] * zoom); else ctx.moveTo(p[0] * zoom, p[1] * zoom); }); ctx.stroke();
      s.px.forEach(function(p){ ctx.fillRect(p[0] * zoom - 2, p[1] * zoom - 2, 4, 4); });
    });
    liste();
  }
  function liste(){
    $('ecn-ser').innerHTML = series.length ? series.map(function(s, n){ return '<span style="color:' + ECV_COULEURS[n % ECV_COULEURS.length] + ';">■ ' + esc(s.nom) + '</span> (' + s.px.length + ' pts)'; }).join(' · ') : '<span style="color:#667;">Aucune série relevée.</span>';
    $('ecn-calst').textContent = calOk() ? 'axes calés ✔' : ['cliquez le repère X1 (axe courant)', 'cliquez le repère X2', 'cliquez le repère Y1 (axe temps)', 'cliquez le repère Y2', ''][cal.etape] || '';
  }
  function charge(){
    var d = docs[+$('ecn-doc').value], pg = Math.max(1, parseInt($('ecn-page').value, 10) || 1);
    $('ecn-msg').textContent = 'Chargement…';
    var im = new Image();
    im.onload = function(){ img = im; $('ecn-msg').textContent = ''; zoom = Math.min(1, 1100 / im.width); $('ecn-zv').textContent = Math.round(zoom * 100) + ' %'; cal = {x: [], y: [], etape: 0}; series = []; dessiner(); };
    im.onerror = function(){ fetch('/api/etude-elec/docs/page-image/' + encodeURIComponent(d.fichier) + '?page=' + pg + '&scale=2.5').then(function(r){ return r.json(); }).then(function(j){ $('ecn-msg').textContent = j.error || 'Image illisible.'; }).catch(function(){ $('ecn-msg').textContent = 'Image illisible.'; }); };
    im.src = '/api/etude-elec/docs/page-image/' + encodeURIComponent(d.fichier) + '?page=' + pg + '&scale=2.5';
  }
  $('ecn-load').addEventListener('click', charge);
  $('ecn-zp').addEventListener('click', function(){ zoom = Math.min(3, zoom * 1.25); $('ecn-zv').textContent = Math.round(zoom * 100) + ' %'; dessiner(); });
  $('ecn-zm').addEventListener('click', function(){ zoom = Math.max(0.2, zoom / 1.25); $('ecn-zv').textContent = Math.round(zoom * 100) + ' %'; dessiner(); });
  $('ecn-cal').addEventListener('click', function(){ cal = {x: [], y: [], etape: 0}; dessiner(); });
  $('ecn-clr').addEventListener('click', function(){ series = []; dessiner(); });
  $('ecn-undo').addEventListener('click', function(){ if(series.length){ var s = series[series.length - 1]; if(s.manuel && s.px.length > 1) s.px.pop(); else series.pop(); } dessiner(); });
  /* suivi automatique d'une courbe : pixels de couleur proche, colonne par colonne, à partir du point cliqué */
  function suivre(x0, y0){
    var w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h; var cx = c.getContext('2d', {willReadFrequently: true}); cx.drawImage(img, 0, 0);
    var data = cx.getImageData(0, 0, w, h).data, tol = +$('ecn-tol').value, ref = [0, 0, 0], n = 0, a, b;
    var mn = 1e9;   /* couleur du trait = pixel le plus foncé autour du clic (le centre du trait, pas son bord anti-crénelé) */
    for(a = -4; a <= 4; a++) for(b = -4; b <= 4; b++){ var q = ((y0 + b) * w + (x0 + a)) * 4; if(q < 0 || q >= data.length - 4) continue; var sm = data[q] + data[q + 1] + data[q + 2]; if(sm < mn){ mn = sm; ref = [data[q], data[q + 1], data[q + 2]]; } n++; }
    if(ref[0] > 235 && ref[1] > 235 && ref[2] > 235) return null;
    var match = function(x, y){ var q = (y * w + x) * 4, dr = data[q] - ref[0], dg = data[q + 1] - ref[1], db = data[q + 2] - ref[2]; return Math.sqrt(dr * dr + dg * dg + db * db) < tol; };
    var saut = Math.max(10, Math.round(h / 60)), pts = [[x0, y0]];
    [-1, 1].forEach(function(dir){
      var y = y0, x = x0, perdu = 0;
      for(x = x0 + dir * 2; x > 1 && x < w - 1; x += dir * 2){
        var runs = [], yy, deb = null;
        for(yy = Math.max(1, Math.round(y - saut)); yy <= Math.min(h - 2, Math.round(y + saut)); yy++){
          if(match(x, yy)){ if(deb === null) deb = yy; } else if(deb !== null){ runs.push((deb + yy - 1) / 2); deb = null; }
        }
        if(deb !== null) runs.push((deb + Math.min(h - 2, y + saut)) / 2);
        if(!runs.length){ if(++perdu > 12) break; continue; }
        perdu = 0; runs.sort(function(p, q){ return Math.abs(p - y) - Math.abs(q - y); }); y = runs[0]; pts.push([x, y]);
      }
    });
    pts.sort(function(p, q){ return p[0] - q[0]; });
    /* allègement : un point tous les 6 px au plus */
    var out = [], dernier = -999; pts.forEach(function(p){ if(p[0] - dernier >= 6){ out.push(p); dernier = p[0]; } });
    return out;
  }
  cv.addEventListener('click', function(e){
    if(!img) return;
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / zoom, y = (e.clientY - r.top) / zoom;
    if(!calOk()){
      if(cal.etape < 2) cal.x.push(x); else cal.y.push(y);
      cal.etape++; dessiner(); return;
    }
    var mode = ov.querySelector('input[name=ecn-m]:checked').value, nom = $('ecn-nom').value.trim() || 'série ' + (series.length + 1);
    if(mode === 'pts'){
      var s = series[series.length - 1]; if(!s || !s.manuel || s.nom !== nom){ s = {nom: nom, px: [], manuel: true}; series.push(s); }
      s.px.push([x, y]); dessiner();
    } else {
      var px = suivre(Math.round(x), Math.round(y));
      if(!px || px.length < 3){ $('ecn-msg').textContent = 'Aucune courbe détectée à cet endroit : cliquez exactement sur le trait (ou augmentez la tolérance).'; return; }
      $('ecn-msg').textContent = ''; series.push({nom: nom, px: px}); dessiner();
    }
  });
  $('ecn-ok').addEventListener('click', function(){
    if(!calOk()){ $('ecn-msg').textContent = 'Calez d\'abord les axes (4 clics).'; return; }
    var res = series.filter(function(s){ return s.px.length >= 2; }).map(function(s){
      var pts = s.px.map(function(p){ return [vx(p[0]), vy(p[1])]; }).filter(function(p){ return isFinite(p[0]) && isFinite(p[1]) && p[0] > 0 && p[1] > 0; });
      pts = pts.map(function(p){ return [Number(p[0].toPrecision(4)), Number(p[1].toPrecision(4))]; });
      pts.sort(function(a, b){ return a[0] - b[0]; });
      return {nom: s.nom, pts: pts};
    }).filter(function(s){ return s.pts.length >= 2; });
    if(!res.length){ $('ecn-msg').textContent = 'Aucun point relevé.'; return; }
    fermer(); if(o.retour) o.retour(res, $('ecn-abs').value);
  });
  charge();
}
