/* =========================================================
   V3.30 — ÉTUDE ÉLECTRIQUE > ÉDITEUR DE SYMBOLES
   Éditeur graphique (type AutoCAD) de la bibliothèque de symboles utilisée par le schéma unifilaire.
   - Bibliothèque COMMUNE à tous les projets (collection etudeSymboles, table etude_symboles).
   - Unités : millimètres, Y vers le haut, origine (0,0) = point d'insertion du symbole dans le schéma.
   - Quadrillage fin au millimètre, traits des centimètres plus foncés (niveau de détail selon le zoom).
   - Outils : ligne L, polyligne PL, rectangle REC, cercle C, arc A (3 points), texte T, effacer E ; sélection par clic,
     fenêtre (gauche -> droite : objets entièrement inclus) ou capture (droite -> gauche : objets touchés).
   - Accrochages : grille (F9), ortho (F8), objets OSNAP (F3) : extrémité, milieu, centre, quadrant, intersection ; grille visible (F7).
   - Navigation : molette = zoom, molette enfoncée = déplacer, double-clic molette = étendue ; Z + E / W.
   - Pas de ligne de commande : on tape directement les alias (L, PL, REC, C, A, T, E, U, Z...) puis Espace ou Entrée.
   Les symboles « système » (livrés avec l'application) n'existent en base qu'une fois modifiés ; « Rétablir » supprime la modification.
   ========================================================= */
var ESY_CATS = [['disjoncteur', 'Disjoncteur'], ['sectionneur', 'Sectionneur'], ['interrupteur_sectionneur', 'Interrupteur-sectionneur'],
  ['interrupteur_fusibles', 'Interrupteur à fusibles'], ['fusible', 'Fusible'], ['transfo', 'Transformateur'], ['source', 'Source'],
  ['moteur', 'Moteur'], ['charge', 'Charge'], ['autre', 'Autre']];

/* ---------- symboles livrés (mm, Y vers le haut ; reprennent la géométrie du schéma V3.28) ---------- */
function esyL(x1, y1, x2, y2){ return {t: 'l', x1: x1, y1: y1, x2: x2, y2: y2}; }
function esyCer(x, y, r){ return {t: 'c', x: x, y: y, r: r}; }
function esyPl(pts, closed){ return {t: 'p', pts: pts, closed: !!closed}; }
function esyTxt(x, y, h, s){ return {t: 't', x: x, y: y, h: h, s: s}; }
function esyBor(nom, x, y){ return {t: 'b', nom: nom, x: x, y: y}; }
var ESY_DEFAUTS = (function(){
  function bb(){ return [esyBor('in', 0, 7.2), esyBor('out', 0, -7.2)]; }
  function lame(){ return [esyL(0, 7.2, 0, 3.6), esyL(-2.4, -3.6, 0, 2.4), esyL(-2.4, -3.6, -2.4, -5.7), esyL(-2.4, -5.7, 0, -5.7), esyL(0, -5.7, 0, -7.2)]; }
  function disj(){ return lame().concat([esyL(-1.2, 4.2, 1.2, 1.8), esyL(1.2, 4.2, -1.2, 1.8)], bb()); }
  function sect(){ return lame().concat([esyL(-2.1, 3.6, 2.1, 3.6)], bb()); }
  function interSect(){ return sect().concat([esyCer(0, 1.8, 0.9)]); }
  function interFus(){
    var cx = -1.2, cy = -0.6, a = 1.65, b = 0.78, ux = 0.372, uy = 0.928, nx = 0.928, ny = -0.372, pts = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function(s){ pts.push([Math.round((cx + s[0] * a * ux + s[1] * b * nx) * 1e4) / 1e4, Math.round((cy + s[0] * a * uy + s[1] * b * ny) * 1e4) / 1e4]); });
    return sect().concat([esyPl(pts, true)]);
  }
  return [
    {code: 'disjoncteur', nom: 'Disjoncteur', categorie: 'disjoncteur', description: 'Disjoncteur : lame ouverte et croix (planche « Appareillage d\'installation »).', entites: disj()},
    {code: 'sectionneur', nom: 'Sectionneur', categorie: 'sectionneur', description: 'Sectionneur : lame ouverte et barre de coupure.', entites: sect()},
    {code: 'interrupteur_sectionneur', nom: 'Interrupteur-sectionneur', categorie: 'interrupteur_sectionneur', description: 'Interrupteur-sectionneur : sectionneur avec cercle de manœuvre.', entites: interSect()},
    {code: 'interrupteur_fusibles', nom: 'Interrupteur à fusibles', categorie: 'interrupteur_fusibles', description: 'Sectionneur avec fusible incliné sur la lame.', entites: interFus()},
    {code: 'fusible', nom: 'Fusible', categorie: 'fusible', description: 'Fusible : rectangle traversé par le conducteur.', entites: [esyL(0, 7.2, 0, -7.2), esyPl([[-1.2, -3.6], [1.2, -3.6], [1.2, 3.6], [-1.2, 3.6]], true), esyBor('in', 0, 7.2), esyBor('out', 0, -7.2)]},
    {code: 'transfo', nom: 'Transformateur', categorie: 'transfo', description: 'Transformateur : deux cercles superposés.', entites: [esyCer(0, 2.4, 3.6), esyCer(0, -2.4, 3.6), esyBor('in', 0, 6), esyBor('out', 0, -6)]},
    {code: 'source', nom: 'Source (réseau amont)', categorie: 'source', description: 'Source : cercle avec le signe alternatif.', entites: [esyCer(0, 0, 3.6), esyTxt(0, 0, 4.8, '~'), esyL(0, -3.6, 0, -7.2), esyBor('out', 0, -7.2)]},
    {code: 'moteur', nom: 'Moteur', categorie: 'moteur', description: 'Moteur : cercle avec la lettre M.', entites: [esyCer(0, 0, 3.3), esyTxt(0, 0, 3.6, 'M'), esyBor('in', 0, 3.3)]},
    {code: 'charge', nom: 'Charge', categorie: 'charge', description: 'Charge : rectangle vide.', entites: [esyPl([[-3, -2.4], [3, -2.4], [3, 2.4], [-3, 2.4]], true), esyBor('in', 0, 2.4)]}
  ];
})();

var ESY = {root: null, wrap: null, svg: null, w: 800, h: 500, cx: 0, cy: 0, k: 12,
  ents: [], undo: [], redo: [], sel: [], rev: 0, cur: null, refJson: '',
  cmd: null, pts: [], clos: false, win: null, mouse: null, snap: null, pointeur: null,
  grille: true, accroche: true, ortho: false, osnap: true, pas: 1, hTexte: 3, dernier: null, numBuf: '', aliasBuf: '', prompt: '',
  pan: null, lastMid: 0, cache: null, tourne: false, branche: false};

function esyStyleOnce(){
  if(byId('esy-style')) return;
  var st = document.createElement('style'); st.id = 'esy-style';
  st.textContent =
    '.esy{display:flex;gap:12px;align-items:flex-start;} .esy-side{width:250px;flex:none;max-height:calc(100vh - 190px);overflow:auto;border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);padding:8px;}' +
    '.esy-side h4{margin:10px 4px 4px;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#667);} .esy-side h4:first-child{margin-top:2px;}' +
    '.esy-it{display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent;} .esy-it:hover{background:var(--surface-2,#f1f3f5);} .esy-it.on{border-color:var(--primary,#1f3a5f);background:var(--surface-2,#eef2f7);}' +
    '.esy-it svg{width:34px;height:34px;flex:none;background:#fff;border:1px solid #dde1e7;border-radius:4px;} .esy-it .nm{font-size:12.5px;line-height:1.2;} .esy-it .cd{font-size:11px;color:var(--muted,#667);}' +
    '.esy-main{flex:1;min-width:0;} .esy-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:8px;} .esy-meta label{display:flex;flex-direction:column;font-size:11.5px;color:var(--muted,#667);gap:2px;} .esy-meta input,.esy-meta select{font-size:13px;padding:4px 6px;}' +
    '.esy-tools{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px;} .esy-tools .btn{padding:4px 9px;font-size:12.5px;} .esy-tools .sep{width:1px;height:22px;background:var(--border,#d0d5db);margin:0 4px;}' +
    '.esy-tools .btn.actif,.esy-st .btn.actif{background:var(--primary,#1f3a5f);color:#fff;border-color:var(--primary,#1f3a5f);}' +
    '.esy-wrap{position:relative;overflow:hidden;border:1px solid var(--border,#d0d5db);border-radius:8px 8px 0 0;background:#fbfcfd;height:calc(100vh - 340px);min-height:340px;touch-action:none;user-select:none;cursor:none;outline:none;}' +
    '.esy-wrap.pan{cursor:grab;} .esy-wrap.pan.on{cursor:grabbing;} .esy-wrap svg{display:block;position:absolute;left:0;top:0;width:100%;height:100%;}' +
    '.esy-tip{position:absolute;background:rgba(20,30,50,.9);color:#fff;font-size:12px;padding:2px 7px;border-radius:4px;pointer-events:none;display:none;white-space:nowrap;}' +
    '.esy-txt{position:absolute;display:none;font-size:13px;padding:3px 6px;border:1px solid #1b4fd8;border-radius:4px;min-width:140px;z-index:3;cursor:text;user-select:text;}' +
    '.esy-st{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--border,#d0d5db);border-top:0;border-radius:0 0 8px 8px;background:var(--surface-2,#f1f3f5);padding:4px 8px;font-size:12px;} .esy-st .btn{padding:2px 8px;font-size:11.5px;} .esy-st .xy{min-width:190px;font-variant-numeric:tabular-nums;} .esy-st .pr{flex:1;min-width:200px;color:var(--text,#222);} .esy-st select{font-size:11.5px;padding:1px 4px;}' +
    '.esy-help{font-size:12px;color:var(--muted,#667);margin:6px 2px 0;}';
  document.head.appendChild(st);
}

/* ---------- utilitaires géométriques ---------- */
function esyN(v){ return Math.round(v * 1e4) / 1e4; }
function esyMod(a){ a = a % 360; return a < 0 ? a + 360 : a; }
function esyEchantillon(e){
  var pts = [], i, n, a, span;
  if(e.t === 'l') return [[[e.x1, e.y1], [e.x2, e.y2]]];
  if(e.t === 'p'){ pts = e.pts.slice(); if(e.closed && pts.length) pts.push(pts[0]); return [pts]; }
  if(e.t === 'c'){ for(i = 0; i <= 64; i++){ a = i * 2 * Math.PI / 64; pts.push([e.x + e.r * Math.cos(a), e.y + e.r * Math.sin(a)]); } return [pts]; }
  if(e.t === 'a'){
    span = esyMod(e.a2 - e.a1) || 360; n = Math.max(2, Math.ceil(span / 6));
    for(i = 0; i <= n; i++){ a = (e.a1 + span * i / n) * Math.PI / 180; pts.push([e.x + e.r * Math.cos(a), e.y + e.r * Math.sin(a)]); }
    return [pts];
  }
  if(e.t === 't'){ var w = 0.62 * e.h * String(e.s).length / 2, h = e.h / 2; return [[[e.x - w, e.y - h], [e.x + w, e.y - h], [e.x + w, e.y + h], [e.x - w, e.y + h], [e.x - w, e.y - h]]]; }
  if(e.t === 'b') return [[[e.x - 0.6, e.y - 0.6], [e.x + 0.6, e.y - 0.6], [e.x + 0.6, e.y + 0.6], [e.x - 0.6, e.y + 0.6], [e.x - 0.6, e.y - 0.6]]];
  return [];
}
function esyDistSeg(px, py, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
function esyDistEnt(e, x, y){
  var best = Infinity;
  esyEchantillon(e).forEach(function(p){ for(var i = 0; i < p.length - 1; i++){ var d = esyDistSeg(x, y, p[i], p[i + 1]); if(d < best) best = d; } });
  return best;
}
function esyBoite(ents){
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ents.forEach(function(e){ esyEchantillon(e).forEach(function(p){ p.forEach(function(q){ x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); }); });
  return x0 === Infinity ? null : {x0: x0, y0: y0, x1: x1, y1: y1};
}
function esySegInter(a, b, c, d){
  var r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if(Math.abs(den) < 1e-12) return null;
  var t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if(t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return [a[0] + t * r[0], a[1] + t * r[1]];
}
function esySegDansRect(a, b, R){
  function dedans(p){ return p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1; }
  if(dedans(a) || dedans(b)) return true;
  var c = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]];
  for(var i = 0; i < 4; i++) if(esySegInter(a, b, c[i], c[(i + 1) % 4])) return true;
  return false;
}
function esyArc3(p1, p2, p3){
  var ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1];
  var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if(Math.abs(d) < 1e-9) return null;
  var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  function ang(p){ return esyMod(Math.atan2(p[1] - uy, p[0] - ux) * 180 / Math.PI); }
  var a1 = ang(p1), a2 = ang(p2), a3 = ang(p3), r = Math.hypot(ax - ux, ay - uy);
  if(esyMod(a2 - a1) <= esyMod(a3 - a1)) return {t: 'a', x: esyN(ux), y: esyN(uy), r: esyN(r), a1: esyN(a1), a2: esyN(a3)};
  return {t: 'a', x: esyN(ux), y: esyN(uy), r: esyN(r), a1: esyN(a3), a2: esyN(a1)};
}

/* ---------- transformations (V3.31) : T = {p: (x, y) -> [x', y'], a: (a1, a2) -> [a1', a2']} ---------- */
function esyTransforme(e, T){
  var o = JSON.parse(JSON.stringify(e)), q, r;
  if(e.t === 'l'){ q = T.p(e.x1, e.y1); r = T.p(e.x2, e.y2); o.x1 = esyN(q[0]); o.y1 = esyN(q[1]); o.x2 = esyN(r[0]); o.y2 = esyN(r[1]); }
  else if(e.t === 'p'){ o.pts = e.pts.map(function(u){ var v = T.p(u[0], u[1]); return [esyN(v[0]), esyN(v[1])]; }); }
  else { q = T.p(e.x, e.y); o.x = esyN(q[0]); o.y = esyN(q[1]); if(e.t === 'a'){ var an = T.a(e.a1, e.a2); o.a1 = esyN(esyMod(an[0])); o.a2 = esyN(esyMod(an[1])); } }
  return o;
}
function esyTDeplacement(dx, dy){ return {p: function(x, y){ return [x + dx, y + dy]; }, a: function(a1, a2){ return [a1, a2]; }}; }
function esyTRotation(c, deg){
  var co = Math.cos(deg * Math.PI / 180), si = Math.sin(deg * Math.PI / 180);
  return {p: function(x, y){ var dx = x - c[0], dy = y - c[1]; return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co]; }, a: function(a1, a2){ return [a1 + deg, a2 + deg]; }};
}
function esyTMiroir(a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, th = Math.atan2(dy, dx) * 180 / Math.PI;
  return {p: function(x, y){ var t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2, fx = a[0] + t * dx, fy = a[1] + t * dy; return [2 * fx - x, 2 * fy - y]; }, a: function(a1, a2){ return [2 * th - a2, 2 * th - a1]; }};
}
function esyTransfActive(){
  var c = ESY.cmd, p = ESY.pts, m = ESY.snap; if(!m || !p.length) return null;
  if(c === 'move' || c === 'copy') return esyTDeplacement(m.x - p[0][0], m.y - p[0][1]);
  if(c === 'rotate') return esyTRotation(p[0], esyAngleRot());
  if(c === 'mirror' && p.length === 1 && (m.x !== p[0][0] || m.y !== p[0][1])) return esyTMiroir(p[0], [m.x, m.y]);
  return null;
}
function esyAngleRot(){ var p = ESY.pts[0], m = ESY.snap; return m ? Math.atan2(m.y - p[1], m.x - p[0]) * 180 / Math.PI : 0; }
var ESY_TRANS = {move: 1, copy: 1, rotate: 1, mirror: 1, mirrorq: 1};

/* ---------- rendu ---------- */
function esyX(x){ return ESY.w / 2 + (x - ESY.cx) * ESY.k; }
function esyY(y){ return ESY.h / 2 - (y - ESY.cy) * ESY.k; }
function esyWx(sx){ return ESY.cx + (sx - ESY.w / 2) / ESY.k; }
function esyWy(sy){ return ESY.cy - (sy - ESY.h / 2) / ESY.k; }
function esyF(v){ return (Math.round(v * 100) / 100).toString(); }

/* SVG d'une entité ; X, Y : conversion monde -> écran ; K : échelle (px par mm) ; st : attributs de trait */
function esyEntSvg(e, X, Y, K, st){
  var i, a, d;
  if(e.t === 'l') return '<line x1="' + esyF(X(e.x1)) + '" y1="' + esyF(Y(e.y1)) + '" x2="' + esyF(X(e.x2)) + '" y2="' + esyF(Y(e.y2)) + '" ' + st + '/>';
  if(e.t === 'p'){
    d = ''; for(i = 0; i < e.pts.length; i++) d += (i ? 'L' : 'M') + esyF(X(e.pts[i][0])) + ' ' + esyF(Y(e.pts[i][1]));
    return '<path d="' + d + (e.closed ? 'Z' : '') + '" fill="none" ' + st + '/>';
  }
  if(e.t === 'c') return '<circle cx="' + esyF(X(e.x)) + '" cy="' + esyF(Y(e.y)) + '" r="' + esyF(e.r * K) + '" fill="none" ' + st + '/>';
  if(e.t === 'a'){
    var span = esyMod(e.a2 - e.a1);
    if(!span) return '<circle cx="' + esyF(X(e.x)) + '" cy="' + esyF(Y(e.y)) + '" r="' + esyF(e.r * K) + '" fill="none" ' + st + '/>';
    var p1 = [e.x + e.r * Math.cos(e.a1 * Math.PI / 180), e.y + e.r * Math.sin(e.a1 * Math.PI / 180)];
    var p2 = [e.x + e.r * Math.cos(e.a2 * Math.PI / 180), e.y + e.r * Math.sin(e.a2 * Math.PI / 180)];
    return '<path d="M' + esyF(X(p1[0])) + ' ' + esyF(Y(p1[1])) + 'A' + esyF(e.r * K) + ' ' + esyF(e.r * K) + ' 0 ' + (span > 180 ? 1 : 0) + ' 0 ' + esyF(X(p2[0])) + ' ' + esyF(Y(p2[1])) + '" fill="none" ' + st + '/>';
  }
  if(e.t === 'b'){
    var bx = X(e.x), by = Y(e.y), nb = e.nom === 'out' ? 'sortie' : 'entrée';
    return '<circle cx="' + esyF(bx) + '" cy="' + esyF(by) + '" r="4.5" fill="#fff" stroke="#7c3aed" stroke-width="1.6"/><circle cx="' + esyF(bx) + '" cy="' + esyF(by) + '" r="1.4" fill="#7c3aed"/>' +
      '<text x="' + esyF(bx + 8) + '" y="' + esyF(by - 6) + '" font-size="10.5" fill="#7c3aed" font-family="Arial,Helvetica,sans-serif">' + nb + '</text>';
  }
  if(e.t === 't') return '<text x="' + esyF(X(e.x)) + '" y="' + esyF(Y(e.y)) + '" font-size="' + esyF(e.h * K) + '" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" fill="' + (/\{\w+\}/.test(String(e.s)) && !/opacity/.test(st) ? '#7c3aed' : (/stroke="([^"]+)"/.exec(st) || [0, '#111'])[1]) + '">' + esc(e.s) + '</text>';
  return '';
}
function esyGrilleHtml(){
  var k = ESY.k, w = ESY.w, h = ESY.h, out = '', x0 = esyWx(0), x1 = esyWx(w), yT = esyWy(0), yB = esyWy(h);
  var minor = k >= 3.5 ? 1 : 0, major = 10;
  while(k * major < 14) major *= 10;
  ESY.pasAffiche = minor ? 1 : major;
  function lignes(s, ex){
    var d = '', i, a, b, p;
    a = Math.ceil(x0 / s); b = Math.floor(x1 / s);
    for(i = a; i <= b; i++){ if(ex && i % ex === 0) continue; p = Math.round(esyX(i * s)) + 0.5; d += 'M' + p + ' 0V' + h; }
    a = Math.ceil(yB / s); b = Math.floor(yT / s);
    for(i = a; i <= b; i++){ if(ex && i % ex === 0) continue; p = Math.round(esyY(i * s)) + 0.5; d += 'M0 ' + p + 'H' + w; }
    return d;
  }
  if(ESY.grille){
    if(minor) out += '<path d="' + lignes(1, 10) + '" stroke="#e9edf2" stroke-width="1" fill="none"/>';
    out += '<path d="' + lignes(major, 0) + '" stroke="#b4bcc9" stroke-width="1" fill="none"/>';
  }
  var ox = esyX(0), oy = esyY(0);
  out += '<line x1="0" y1="' + oy + '" x2="' + w + '" y2="' + oy + '" stroke="rgba(214,69,69,.65)" stroke-width="1"/>' +
    '<line x1="' + ox + '" y1="0" x2="' + ox + '" y2="' + h + '" stroke="rgba(31,160,92,.65)" stroke-width="1"/>' +
    '<circle cx="' + ox + '" cy="' + oy + '" r="3.5" fill="none" stroke="#555" stroke-width="1"/>';
  return out;
}
function esyDessiner(){
  if(!ESY.svg) return;
  ESY.svg.setAttribute('viewBox', '0 0 ' + ESY.w + ' ' + ESY.h);
  var X = esyX, Y = esyY, html = '';
  ESY.ents.forEach(function(e, i){
    var sel = ESY.sel.indexOf(i) >= 0;
    html += esyEntSvg(e, X, Y, ESY.k, 'stroke="' + (sel ? '#1b4fd8' : '#14181f') + '" stroke-width="' + (sel ? 2.4 : 1.8) + '" stroke-linecap="round" stroke-linejoin="round"' + (sel ? ' stroke-dasharray="6 3"' : ''));
  });
  byId('esy-g').innerHTML = esyGrilleHtml();
  byId('esy-e').innerHTML = html;
  esyOverlay(); esyStatut();
}

/* ---------- accrochages ---------- */
function esyAccrochesObjets(){
  if(ESY.cache && ESY.cache.rev === ESY.rev) return ESY.cache.pts;
  var pts = [], segs = [];
  ESY.ents.forEach(function(e){
    var i, a;
    if(e.t === 'l'){ pts.push({x: e.x1, y: e.y1, k: 'end'}, {x: e.x2, y: e.y2, k: 'end'}, {x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2, k: 'mid'}); segs.push([[e.x1, e.y1], [e.x2, e.y2]]); }
    else if(e.t === 'p'){
      for(i = 0; i < e.pts.length; i++){
        pts.push({x: e.pts[i][0], y: e.pts[i][1], k: 'end'});
        var j = i + 1; if(j >= e.pts.length){ if(!e.closed) break; j = 0; }
        pts.push({x: (e.pts[i][0] + e.pts[j][0]) / 2, y: (e.pts[i][1] + e.pts[j][1]) / 2, k: 'mid'}); segs.push([e.pts[i], e.pts[j]]);
      }
    } else if(e.t === 'c'){ pts.push({x: e.x, y: e.y, k: 'cen'}, {x: e.x + e.r, y: e.y, k: 'qua'}, {x: e.x - e.r, y: e.y, k: 'qua'}, {x: e.x, y: e.y + e.r, k: 'qua'}, {x: e.x, y: e.y - e.r, k: 'qua'}); }
    else if(e.t === 'a'){
      var span = esyMod(e.a2 - e.a1) || 360; pts.push({x: e.x, y: e.y, k: 'cen'});
      [e.a1, e.a2].forEach(function(an){ pts.push({x: e.x + e.r * Math.cos(an * Math.PI / 180), y: e.y + e.r * Math.sin(an * Math.PI / 180), k: 'end'}); });
      a = (e.a1 + span / 2) * Math.PI / 180; pts.push({x: e.x + e.r * Math.cos(a), y: e.y + e.r * Math.sin(a), k: 'mid'});
    } else if(e.t === 't') pts.push({x: e.x, y: e.y, k: 'end'});
  });
  var n = segs.length, a1, b1, q;
  if(n <= 300) for(a1 = 0; a1 < n; a1++) for(b1 = a1 + 1; b1 < n; b1++){ q = esySegInter(segs[a1][0], segs[a1][1], segs[b1][0], segs[b1][1]); if(q) pts.push({x: q[0], y: q[1], k: 'int'}); }
  ESY.cache = {rev: ESY.rev, pts: pts};
  return pts;
}
var ESY_NOM_SNAP = {end: 'Extrémité', mid: 'Milieu', cen: 'Centre', qua: 'Quadrant', int: 'Intersection', gri: 'Grille'};
function esyAccroche(sx, sy){
  var wx = esyWx(sx), wy = esyWy(sy), best = null, bd = 11, dernier = ESY.pts.length ? ESY.pts[ESY.pts.length - 1] : null;
  if(ESY.osnap){
    esyAccrochesObjets().concat(ESY.pts.map(function(p){ return {x: p[0], y: p[1], k: 'end'}; })).forEach(function(p){
      var d = Math.hypot(esyX(p.x) - sx, esyY(p.y) - sy);
      if(d < bd){ bd = d; best = p; }
    });
  }
  if(best) return {x: esyN(best.x), y: esyN(best.y), k: best.k};
  if(ESY.ortho && dernier && (ESY.cmd === 'line' || ESY.cmd === 'pline')){
    if(Math.abs(wx - dernier[0]) >= Math.abs(wy - dernier[1])) wy = dernier[1]; else wx = dernier[0];
  }
  if(ESY.accroche){
    var s = ESY.pas;
    if(!(ESY.ortho && dernier && (ESY.cmd === 'line' || ESY.cmd === 'pline') && wy === dernier[1])) wy = Math.round(wy / s) * s;
    if(!(ESY.ortho && dernier && (ESY.cmd === 'line' || ESY.cmd === 'pline') && wx === dernier[0])) wx = Math.round(wx / s) * s;
  }
  return {x: esyN(wx), y: esyN(wy), k: null};
}

/* ---------- surcouche (curseur, accrochage, aperçu) ---------- */
function esyOverlay(){
  var g = byId('esy-o'); if(!g) return;
  var m = ESY.mouse, html = '', p = ESY.snap, i, S = 'stroke="#1b4fd8" stroke-width="1.2" fill="none"';
  var tip = byId('esy-tip'), texte = '';
  function sx(x){ return esyX(x); } function sy(y){ return esyY(y); }
  /* fenêtre de sélection / zoom */
  if(ESY.win && m){
    var a = ESY.win, x0 = Math.min(a.sx, m.sx), y0 = Math.min(a.sy, m.sy), ww = Math.abs(m.sx - a.sx), hh = Math.abs(m.sy - a.sy), cross = (m.sx < a.sx) && ESY.win.type !== 'zoom';
    html += '<rect x="' + x0 + '" y="' + y0 + '" width="' + ww + '" height="' + hh + '" fill="' + (cross ? 'rgba(31,160,92,.14)' : 'rgba(27,79,216,.12)') + '" stroke="' + (cross ? '#1fa05c' : '#1b4fd8') + '" stroke-width="1"' + (cross ? ' stroke-dasharray="6 4"' : '') + '/>';
  }
  /* aperçu des commandes de dessin */
  if(p && ESY.pts.length){
    var last = ESY.pts[ESY.pts.length - 1];
    if(ESY.cmd === 'line' || ESY.cmd === 'pline'){
      var d = ''; for(i = 0; i < ESY.pts.length; i++) d += (i ? 'L' : 'M') + sx(ESY.pts[i][0]) + ' ' + sy(ESY.pts[i][1]);
      html += '<path d="' + d + 'L' + sx(p.x) + ' ' + sy(p.y) + '" ' + S + '/>';
      texte = 'Longueur ' + esyF(Math.hypot(p.x - last[0], p.y - last[1])) + ' mm  ∠ ' + esyF(esyMod(Math.atan2(p.y - last[1], p.x - last[0]) * 180 / Math.PI)) + '°';
    } else if(ESY.cmd === 'rect'){
      html += '<rect x="' + Math.min(sx(last[0]), sx(p.x)) + '" y="' + Math.min(sy(last[1]), sy(p.y)) + '" width="' + Math.abs(sx(p.x) - sx(last[0])) + '" height="' + Math.abs(sy(p.y) - sy(last[1])) + '" ' + S + '/>';
      texte = esyF(Math.abs(p.x - last[0])) + ' × ' + esyF(Math.abs(p.y - last[1])) + ' mm';
    } else if(ESY.cmd === 'circle'){
      var r = Math.hypot(p.x - last[0], p.y - last[1]);
      html += '<circle cx="' + sx(last[0]) + '" cy="' + sy(last[1]) + '" r="' + r * ESY.k + '" ' + S + '/><line x1="' + sx(last[0]) + '" y1="' + sy(last[1]) + '" x2="' + sx(p.x) + '" y2="' + sy(p.y) + '" ' + S + ' stroke-dasharray="4 3"/>';
      texte = 'Rayon ' + esyF(r) + ' mm';
    } else if(ESY.cmd === 'arc'){
      if(ESY.pts.length === 1) html += '<line x1="' + sx(last[0]) + '" y1="' + sy(last[1]) + '" x2="' + sx(p.x) + '" y2="' + sy(p.y) + '" ' + S + ' stroke-dasharray="4 3"/>';
      else { var ar = esyArc3(ESY.pts[0], ESY.pts[1], [p.x, p.y]); if(ar) { html += esyEntSvg(ar, esyX, esyY, ESY.k, S); texte = 'Rayon ' + esyF(ar.r) + ' mm'; } }
    }
  }
  /* aperçu des transformations : objets sélectionnés déplacés / copiés / pivotés / symétriques */
  if(ESY.cmd && ESY_TRANS[ESY.cmd] && !ESY.tsel && p){
    var Tt = esyTransfActive();
    if(Tt){ ESY.sel.forEach(function(ix){ html += esyEntSvg(esyTransforme(ESY.ents[ix], Tt), esyX, esyY, ESY.k, 'stroke="#1b4fd8" stroke-width="1.4" stroke-dasharray="5 3" opacity=".8"'); }); }
    if(ESY.cmd === 'mirror' && ESY.pts.length === 1) html += '<line x1="' + sx(ESY.pts[0][0]) + '" y1="' + sy(ESY.pts[0][1]) + '" x2="' + sx(p.x) + '" y2="' + sy(p.y) + '" stroke="#d97706" stroke-width="1" stroke-dasharray="8 3 2 3"/>';
    if(ESY.pts.length) html += '<line x1="' + sx(ESY.pts[0][0]) + '" y1="' + sy(ESY.pts[0][1]) + '" x2="' + sx(p.x) + '" y2="' + sy(p.y) + '" stroke="#1b4fd8" stroke-width="1" stroke-dasharray="2 3"/>';
    if(ESY.cmd === 'rotate' && ESY.pts.length) texte = 'Angle ' + esyF(esyMod(esyAngleRot())) + '°';
    else if((ESY.cmd === 'move' || ESY.cmd === 'copy') && ESY.pts.length) texte = 'Δ ' + esyF(p.x - ESY.pts[0][0]) + ' ; ' + esyF(p.y - ESY.pts[0][1]) + ' mm';
  }
  /* viseur */
  if(m && ESY.cmd !== 'pan' && !ESY.pan){
    html += '<path d="M0 ' + m.sy + 'H' + ESY.w + 'M' + m.sx + ' 0V' + ESY.h + '" stroke="rgba(20,24,31,.45)" stroke-width="1" fill="none"/>' +
      '<rect x="' + (m.sx - 4) + '" y="' + (m.sy - 4) + '" width="8" height="8" fill="none" stroke="#14181f" stroke-width="1"/>';
  }
  /* marqueur d'accrochage */
  if(p && p.k && p.k !== 'gri'){
    var X0 = sx(p.x), Y0 = sy(p.y), M = 'stroke="#d97706" stroke-width="2" fill="none"';
    if(p.k === 'end') html += '<rect x="' + (X0 - 6) + '" y="' + (Y0 - 6) + '" width="12" height="12" ' + M + '/>';
    else if(p.k === 'mid') html += '<path d="M' + X0 + ' ' + (Y0 - 7) + 'L' + (X0 + 7) + ' ' + (Y0 + 6) + 'L' + (X0 - 7) + ' ' + (Y0 + 6) + 'Z" ' + M + '/>';
    else if(p.k === 'cen') html += '<circle cx="' + X0 + '" cy="' + Y0 + '" r="6" ' + M + '/>';
    else if(p.k === 'qua') html += '<path d="M' + X0 + ' ' + (Y0 - 7) + 'L' + (X0 + 7) + ' ' + Y0 + 'L' + X0 + ' ' + (Y0 + 7) + 'L' + (X0 - 7) + ' ' + Y0 + 'Z" ' + M + '/>';
    else if(p.k === 'int') html += '<path d="M' + (X0 - 6) + ' ' + (Y0 - 6) + 'L' + (X0 + 6) + ' ' + (Y0 + 6) + 'M' + (X0 + 6) + ' ' + (Y0 - 6) + 'L' + (X0 - 6) + ' ' + (Y0 + 6) + '" ' + M + '/>';
  }
  g.innerHTML = html;
  /* bulle près du curseur : saisie en cours, sinon accrochage / dimensions */
  var saisie = ESY.numBuf ? ('Distance : ' + ESY.numBuf) : (ESY.aliasBuf ? ESY.aliasBuf : '');
  if(!saisie) saisie = texte || (p && p.k ? ESY_NOM_SNAP[p.k] : '');
  if(m && saisie){ tip.textContent = saisie; tip.style.display = 'block'; tip.style.left = (m.sx + 16) + 'px'; tip.style.top = (m.sy + 16) + 'px'; }
  else tip.style.display = 'none';
}
function esyStatut(){
  var el = byId('esy-xy'); if(!el) return;
  var p = ESY.snap;
  el.textContent = p ? 'X ' + esyF(p.x) + '   Y ' + esyF(p.y) + ' mm' : 'X —   Y — mm';
  byId('esy-pr').textContent = ESY.prompt + (ESY.sel.length && !ESY.cmd ? '  ·  ' + ESY.sel.length + ' objet(s) sélectionné(s)' : '');
  [['esy-bg', ESY.grille], ['esy-ba', ESY.accroche], ['esy-bo', ESY.ortho], ['esy-bs', ESY.osnap]].forEach(function(t){ var b = byId(t[0]); if(b) b.classList.toggle('actif', !!t[1]); });
  byId('esy-sc').textContent = ESY.grille ? ('Carreau : ' + (ESY.pasAffiche >= 10 ? (ESY.pasAffiche / 10) + ' cm' : '1 mm') + (ESY.pasAffiche === 1 ? ' · trait foncé : 1 cm' : '')) : '';
  ['line', 'pline', 'rect', 'circle', 'arc', 'text', 'erase', 'zoomwin', 'pan', 'move', 'copy', 'rotate', 'mirror'].forEach(function(c){ var b = byId('esy-t-' + c); if(b) b.classList.toggle('actif', ESY.cmd === c || (c === 'mirror' && ESY.cmd === 'mirrorq')); });
  var bi = byId('esy-t-bin'), bo = byId('esy-t-bout'); if(bi) bi.classList.toggle('actif', ESY.cmd === 'borne' && ESY.bnom !== 'out'); if(bo) bo.classList.toggle('actif', ESY.cmd === 'borne' && ESY.bnom === 'out');
  var sb = byId('esy-t-select'); if(sb) sb.classList.toggle('actif', !ESY.cmd);
  var tl = ESY.wrap; if(tl) tl.classList.toggle('pan', ESY.cmd === 'pan');
}

/* ---------- vue ---------- */
function esyTaille(){
  if(!ESY.wrap) return;
  var r = ESY.wrap.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
  if(w < 10 || h < 10) return false;
  var change = w !== ESY.w || h !== ESY.h; ESY.w = w; ESY.h = h; return change;
}
function esyEtendue(){
  esyTaille();
  var b = esyBoite(ESY.ents);
  if(!b) b = {x0: -12, y0: -12, x1: 12, y1: 12};
  var bw = Math.max(b.x1 - b.x0, 20), bh = Math.max(b.y1 - b.y0, 20);
  ESY.cx = (b.x0 + b.x1) / 2; ESY.cy = (b.y0 + b.y1) / 2;
  ESY.k = Math.max(0.4, Math.min(80, Math.min(ESY.w / (bw * 1.35), ESY.h / (bh * 1.35))));
  esyDessiner();
}
function esyZoomAu(sx, sy, f){
  var wx = esyWx(sx), wy = esyWy(sy), k = Math.max(0.4, Math.min(160, ESY.k * f));
  ESY.k = k; ESY.cx = wx - (sx - ESY.w / 2) / k; ESY.cy = wy + (sy - ESY.h / 2) / k;
  esyDessiner();
}
function esyZoomFenetre(a, b){
  var dx = Math.abs(b.sx - a.sx), dy = Math.abs(b.sy - a.sy);
  if(dx < 6 || dy < 6) return;
  var x0 = esyWx(Math.min(a.sx, b.sx)), x1 = esyWx(Math.max(a.sx, b.sx)), y1 = esyWy(Math.min(a.sy, b.sy)), y0 = esyWy(Math.max(a.sy, b.sy));
  ESY.cx = (x0 + x1) / 2; ESY.cy = (y0 + y1) / 2; ESY.k = Math.max(0.4, Math.min(160, Math.min(ESY.w / (x1 - x0), ESY.h / (y1 - y0))));
  esyDessiner();
}

/* ---------- historique ---------- */
function esyPousser(){ ESY.undo.push(JSON.stringify(ESY.ents)); if(ESY.undo.length > 120) ESY.undo.shift(); ESY.redo = []; }
function esyModifie(){ ESY.rev++; ESY.sel = []; esyDessiner(); esyMajEtat(); }
function esyAnnuler(){
  if(!ESY.undo.length){ ESY.prompt = 'Rien à annuler.'; esyStatut(); return; }
  ESY.redo.push(JSON.stringify(ESY.ents)); ESY.ents = JSON.parse(ESY.undo.pop()); esyModifie(); ESY.prompt = 'Annulé.'; esyStatut();
}
function esyRetablir(){
  if(!ESY.redo.length){ ESY.prompt = 'Rien à rétablir.'; esyStatut(); return; }
  ESY.undo.push(JSON.stringify(ESY.ents)); ESY.ents = JSON.parse(ESY.redo.pop()); esyModifie(); ESY.prompt = 'Rétabli.'; esyStatut();
}
function esyAjouter(e){ esyPousser(); ESY.ents.push(e); esyModifie(); }

/* ---------- commandes ---------- */
var ESY_INVITES = {
  line: 'LIGNE : premier point', pline: 'POLYLIGNE : premier point', rect: 'RECTANGLE : premier coin', circle: 'CERCLE : centre',
  arc: 'ARC (3 points) : point de départ', text: 'TEXTE : point d\'insertion (centré)', erase: 'EFFACER : sélectionnez les objets puis Entrée',
  zoomwin: 'ZOOM FENÊTRE : premier coin', pan: 'MAIN : glissez pour déplacer', zoom: 'ZOOM : E = étendue, W = fenêtre, A = tout (puis Entrée)',
  move: 'DÉPLACER : sélectionnez les objets puis Entrée', copy: 'COPIER : sélectionnez les objets puis Entrée', rotate: 'ROTATION : sélectionnez les objets puis Entrée', mirror: 'SYMÉTRIE : sélectionnez les objets puis Entrée',
  borne: 'BORNE : cliquez le point de raccordement'
};
var ESY_PT1 = {move: 'DÉPLACER : point de base', copy: 'COPIER : point de base', rotate: 'ROTATION : point de base', mirror: 'SYMÉTRIE : premier point de l\'axe'};
function esyCmd(nom){
  esyFinCmd(true); ESY.numBuf = ''; ESY.aliasBuf = '';
  if(nom === 'select' || !nom){ ESY.cmd = null; ESY.prompt = 'Sélection : clic = ajouter, Maj+clic = retirer, glisser = fenêtre (gauche→droite) ou capture (droite→gauche).'; esyDessiner(); return; }
  if(nom === 'erase' && ESY.sel.length){ esyEffacerSel(); return; }
  ESY.cmd = nom; ESY.pts = []; ESY.win = null; ESY.clos = false;
  if(nom !== 'zoom' && nom !== 'zoomwin' && nom !== 'pan') ESY.dernier = nom;
  ESY.tsel = false;
  if(ESY_TRANS[nom]){
    if(ESY.sel.length){ ESY.prompt = ESY_PT1[nom]; esyDessiner(); return; }
    ESY.tsel = true;
  } else if(nom !== 'zoomwin' && nom !== 'pan' && nom !== 'zoom' && nom !== 'erase') ESY.sel = [];
  if(nom !== 'zoom' && nom !== 'zoomwin' && nom !== 'pan') ESY.dernier = nom;
  ESY.prompt = nom === 'borne' ? 'BORNE ' + (ESY.bnom === 'out' ? 'de sortie (out, bas)' : 'd\'entrée (in, haut)') + ' : cliquez le point de raccordement' : (ESY_INVITES[nom] || ''); esyDessiner();
  byId('esy-txt').style.display = 'none';
}
function esyFinCmd(valide){
  ESY.tsel = false;
  if(ESY.cmd === 'pline' && valide && ESY.pts.length >= 2){ esyAjouter({t: 'p', pts: ESY.pts.map(function(p){ return [p[0], p[1]]; }), closed: !!ESY.clos}); }
  ESY.pts = []; ESY.win = null; ESY.clos = false;
  var t = byId('esy-txt'); if(t) t.style.display = 'none';
}
function esyEchap(){
  ESY.tsel = false;
  if(ESY.cmd || ESY.win || ESY.pts.length || ESY.numBuf || ESY.aliasBuf){ esyFinCmd(false); ESY.cmd = null; ESY.numBuf = ''; ESY.aliasBuf = ''; ESY.prompt = 'Annulé.'; }
  else if(ESY.sel.length){ ESY.sel = []; ESY.prompt = ''; }
  esyDessiner();
}
function esyEffacerSel(){
  if(!ESY.sel.length){ ESY.prompt = 'Aucun objet sélectionné.'; esyStatut(); return; }
  var n = ESY.sel.length; esyPousser(); ESY.ents = ESY.ents.filter(function(e, i){ return ESY.sel.indexOf(i) < 0; });
  ESY.cmd = null; esyModifie(); ESY.prompt = n + ' objet(s) effacé(s).'; esyStatut();
}
function esyTousSel(){ ESY.sel = ESY.ents.map(function(e, i){ return i; }); ESY.prompt = ESY.sel.length + ' objet(s) sélectionné(s).'; esyDessiner(); }
function esyAjoutPoint(p){
  var c = ESY.cmd, last;
  if(c === 'line'){
    if(ESY.pts.length){ last = ESY.pts[ESY.pts.length - 1]; if(last[0] === p[0] && last[1] === p[1]) return; esyAjouter(esyL(last[0], last[1], p[0], p[1])); }
    ESY.pts.push(p); ESY.prompt = 'LIGNE : point suivant (Entrée ou Échap pour terminer, C pour fermer, U pour annuler le dernier)';
  } else if(c === 'pline'){
    ESY.pts.push(p); ESY.prompt = 'POLYLIGNE : point suivant (Entrée pour terminer, C + Entrée pour fermer, U pour annuler le dernier)';
  } else if(c === 'rect'){
    if(!ESY.pts.length){ ESY.pts.push(p); ESY.prompt = 'RECTANGLE : coin opposé'; }
    else {
      var a = ESY.pts[0];
      if(a[0] === p[0] || a[1] === p[1]){ ESY.prompt = 'RECTANGLE : coin opposé (le rectangle ne peut pas être plat)'; esyStatut(); return; }
      esyAjouter(esyPl([[a[0], a[1]], [p[0], a[1]], [p[0], p[1]], [a[0], p[1]]], true)); ESY.pts = []; ESY.cmd = null; ESY.prompt = 'Rectangle créé.';
    }
  } else if(c === 'circle'){
    if(!ESY.pts.length){ ESY.pts.push(p); ESY.prompt = 'CERCLE : rayon (cliquez ou tapez la valeur puis Entrée)'; }
    else { var r = esyN(Math.hypot(p[0] - ESY.pts[0][0], p[1] - ESY.pts[0][1])); if(r > 0) { esyAjouter(esyCer(ESY.pts[0][0], ESY.pts[0][1], r)); ESY.pts = []; ESY.cmd = null; ESY.prompt = 'Cercle créé.'; } }
  } else if(c === 'arc'){
    ESY.pts.push(p);
    if(ESY.pts.length === 1) ESY.prompt = 'ARC : deuxième point (sur l\'arc)';
    else if(ESY.pts.length === 2) ESY.prompt = 'ARC : point d\'arrivée';
    else {
      var ar = esyArc3(ESY.pts[0], ESY.pts[1], ESY.pts[2]);
      if(ar){ esyAjouter(ar); ESY.prompt = 'Arc créé.'; } else ESY.prompt = 'Les trois points sont alignés : arc impossible.';
      ESY.pts = []; ESY.cmd = null;
    }
  } else if(c === 'borne'){
    var nm = ESY.bnom === 'out' ? 'out' : 'in';
    esyPousser(); ESY.ents = ESY.ents.filter(function(e){ return !(e.t === 'b' && e.nom === nm); }); ESY.ents.push(esyBor(nm, p[0], p[1]));
    ESY.cmd = null; esyModifie(); ESY.prompt = 'Borne ' + (nm === 'out' ? 'de sortie' : 'd\'entrée') + ' placée en (' + esyF(p[0]) + ' ; ' + esyF(p[1]) + ').'; esyDessiner(); return;
  } else if(c === 'move' || c === 'copy'){
    if(!ESY.pts.length){ ESY.pts.push(p); ESY.prompt = (c === 'move' ? 'DÉPLACER' : 'COPIER') + ' : point de destination'; }
    else {
      var Td = esyTDeplacement(p[0] - ESY.pts[0][0], p[1] - ESY.pts[0][1]);
      if(c === 'move'){ esyPousser(); ESY.sel.forEach(function(ix){ ESY.ents[ix] = esyTransforme(ESY.ents[ix], Td); }); ESY.pts = []; ESY.cmd = null; esyModifie(); ESY.prompt = 'Objets déplacés.'; }
      else { esyPousser(); var cp = ESY.sel.map(function(ix){ return esyTransforme(ESY.ents[ix], Td); }); ESY.ents = ESY.ents.concat(cp); ESY.rev++; esyMajEtat(); ESY.prompt = 'COPIER : point de destination suivant (Entrée pour terminer)'; }
    }
  } else if(c === 'rotate'){
    if(!ESY.pts.length){ ESY.pts.push(p); ESY.prompt = 'ROTATION : angle (cliquez ou tapez les degrés puis Entrée)'; }
    else esyRotationFaire(esyAngleRot());
  } else if(c === 'mirror'){
    ESY.pts.push(p);
    if(ESY.pts.length === 1) ESY.prompt = 'SYMÉTRIE : deuxième point de l\'axe';
    else if(p[0] === ESY.pts[0][0] && p[1] === ESY.pts[0][1]){ ESY.pts.pop(); ESY.prompt = 'SYMÉTRIE : le deuxième point doit différer du premier.'; }
    else { ESY.axe = [ESY.pts[0], ESY.pts[1]]; ESY.pts = []; ESY.cmd = 'mirrorq'; ESY.prompt = 'Effacer les objets source ? O = oui, Entrée = non'; }
  } else if(c === 'text'){
    ESY.pts = [p];
    var t = byId('esy-txt'); t.value = ''; t.style.display = 'block'; t.style.left = esyX(p[0]) + 'px'; t.style.top = (esyY(p[1]) - 14) + 'px'; t.focus();
    ESY.prompt = 'TEXTE : saisissez le texte puis Entrée (hauteur ' + ESY.hTexte + ' mm)';
  }
  esyDessiner();
}
function esyRotationFaire(deg){
  var Tr = esyTRotation(ESY.pts[0], deg);
  esyPousser(); ESY.sel.forEach(function(ix){ ESY.ents[ix] = esyTransforme(ESY.ents[ix], Tr); }); ESY.pts = []; ESY.cmd = null; esyModifie(); ESY.prompt = 'Rotation de ' + esyF(deg) + '° effectuée.'; esyDessiner();
}
function esyMiroirFaire(supprime){
  var Tm = esyTMiroir(ESY.axe[0], ESY.axe[1]), sel = ESY.sel.slice();
  esyPousser(); var cp = sel.map(function(ix){ return esyTransforme(ESY.ents[ix], Tm); });
  if(supprime) ESY.ents = ESY.ents.filter(function(e, i){ return sel.indexOf(i) < 0; });
  ESY.ents = ESY.ents.concat(cp); ESY.cmd = null; esyModifie(); ESY.prompt = 'Symétrie effectuée' + (supprime ? ' (source effacée).' : '.'); esyDessiner();
}
function esyDistanceSaisie(v){
  var c = ESY.cmd, last = ESY.pts.length ? ESY.pts[ESY.pts.length - 1] : null, p = ESY.snap;
  if(ESY.cmd === 'rotate' && ESY.pts.length && isFinite(v)){ esyRotationFaire(v); return; }
  if(!(v > 0)) { ESY.prompt = 'Valeur invalide.'; esyStatut(); return; }
  if(c === 'circle' && last){ esyAjouter(esyCer(last[0], last[1], esyN(v))); ESY.pts = []; ESY.cmd = null; ESY.prompt = 'Cercle créé.'; esyDessiner(); return; }
  if((c === 'line' || c === 'pline') && last && p){
    var dx = p.x - last[0], dy = p.y - last[1], l = Math.hypot(dx, dy);
    if(ESY.ortho || l === 0){ if(Math.abs(dx) >= Math.abs(dy)) { dx = dx >= 0 ? 1 : -1; dy = 0; l = 1; } else { dy = dy >= 0 ? 1 : -1; dx = 0; l = 1; } }
    esyAjoutPoint([esyN(last[0] + dx / l * v), esyN(last[1] + dy / l * v)]); return;
  }
  ESY.prompt = 'Saisie de distance non disponible ici.'; esyStatut();
}
var ESY_ALIAS = {L: 'line', LINE: 'line', PL: 'pline', PLINE: 'pline', REC: 'rect', RECTANG: 'rect', C: 'circle', CIRCLE: 'circle', A: 'arc', ARC: 'arc', T: 'text', DT: 'text', TEXT: 'text',
  E: 'erase', ERASE: 'erase', Z: 'zoom', P: 'pan', PAN: 'pan', ZW: 'zoomwin', ZE: 'zoomext', S: 'select', U: 'undo', UNDO: 'undo', REDO: 'redo',
  M: 'move', MOVE: 'move', CO: 'copy', CP: 'copy', COPY: 'copy', RO: 'rotate', ROTATE: 'rotate', MI: 'mirror', MIRROR: 'mirror', BE: 'bin', BS: 'bout'};
function esyAlias(a){
  var c = ESY_ALIAS[a];
  if(ESY.cmd === 'zoom'){
    if(a === 'E' || a === 'A' || a === 'ZE'){ ESY.cmd = null; esyEtendue(); ESY.prompt = ''; esyStatut(); return; }
    if(a === 'W'){ esyCmd('zoomwin'); return; }
  }
  if((ESY.cmd === 'pline' || ESY.cmd === 'line') && a === 'C'){
    if(ESY.cmd === 'pline'){ if(ESY.pts.length >= 3){ ESY.clos = true; esyFinCmd(true); ESY.cmd = null; ESY.prompt = 'Polyligne fermée.'; } else ESY.prompt = 'Au moins 3 points pour fermer.'; }
    else if(ESY.pts.length >= 3){ var f = ESY.pts[0]; esyAjoutPoint([f[0], f[1]]); ESY.pts = []; ESY.cmd = null; ESY.prompt = 'Figure fermée.'; }
    else ESY.prompt = 'Au moins 2 segments pour fermer.';
    esyDessiner(); return;
  }
  if((ESY.cmd === 'pline' || ESY.cmd === 'line') && (a === 'U' || a === 'UNDO') && ESY.pts.length){
    if(ESY.cmd === 'line' && ESY.pts.length > 1) esyAnnuler();
    ESY.pts.pop(); ESY.prompt = 'Dernier point retiré.'; esyDessiner(); return;
  }
  if(!c){ ESY.prompt = 'Commande inconnue : ' + a; esyStatut(); return; }
  if(c === 'bin' || c === 'bout'){ ESY.bnom = c === 'bout' ? 'out' : 'in'; esyCmd('borne'); return; }
  if(c === 'undo'){ esyAnnuler(); return; }
  if(c === 'redo'){ esyRetablir(); return; }
  if(c === 'zoomext'){ esyFinCmd(false); ESY.cmd = null; esyEtendue(); return; }
  esyCmd(c);
}
function esyValide(){
  if(ESY.cmd === 'mirrorq'){ var o = ESY.aliasBuf === 'O' || ESY.aliasBuf === 'Y'; ESY.aliasBuf = ''; esyMiroirFaire(o); return; }
  if(ESY.tsel && ESY_TRANS[ESY.cmd]){
    ESY.aliasBuf = '';
    if(!ESY.sel.length) ESY.prompt = 'Aucun objet sélectionné : cliquez ou tracez une fenêtre.'; else { ESY.tsel = false; ESY.prompt = ESY_PT1[ESY.cmd]; }
    esyDessiner(); return;
  }
  if(ESY.numBuf){ var v = parseFloat(ESY.numBuf.replace(',', '.')); ESY.numBuf = ''; esyDistanceSaisie(v); return; }
  if(ESY.aliasBuf){ var a = ESY.aliasBuf; ESY.aliasBuf = ''; esyAlias(a); return; }
  var c = ESY.cmd;
  if(c === 'erase'){ esyEffacerSel(); return; }
  if(c === 'line' || c === 'pline'){ esyFinCmd(true); ESY.cmd = null; ESY.prompt = ''; esyDessiner(); return; }
  if(c){ esyEchap(); return; }
  if(ESY.dernier){ esyCmd(ESY.dernier); }
}

/* ---------- sélection ---------- */
function esyTouche(wx, wy){
  var best = -1, bd = 7 / ESY.k;
  ESY.ents.forEach(function(e, i){ var d = esyDistEnt(e, wx, wy); if(d <= bd){ bd = d; best = i; } });
  return best;
}
function esySelectionner(idx, retire){
  idx.forEach(function(i){
    var p = ESY.sel.indexOf(i);
    if(retire){ if(p >= 0) ESY.sel.splice(p, 1); } else if(p < 0) ESY.sel.push(i);
  });
}
function esyFenetreSel(a, b, retire){
  var R = {x0: Math.min(esyWx(a.sx), esyWx(b.sx)), x1: Math.max(esyWx(a.sx), esyWx(b.sx)), y0: Math.min(esyWy(a.sy), esyWy(b.sy)), y1: Math.max(esyWy(a.sy), esyWy(b.sy))};
  var capture = b.sx < a.sx, idx = [];
  ESY.ents.forEach(function(e, i){
    var paths = esyEchantillon(e), ok;
    if(capture){ ok = paths.some(function(p){ for(var j = 0; j < p.length - 1; j++) if(esySegDansRect(p[j], p[j + 1], R)) return true; return false; }); }
    else ok = paths.length && paths.every(function(p){ return p.every(function(q){ return q[0] >= R.x0 && q[0] <= R.x1 && q[1] >= R.y0 && q[1] <= R.y1; }); });
    if(ok) idx.push(i);
  });
  esySelectionner(idx, retire);
  ESY.prompt = ESY.sel.length + ' objet(s) sélectionné(s) (' + (capture ? 'capture' : 'fenêtre') + ').';
}

/* ---------- souris ---------- */
function esyPos(ev){ var r = ESY.wrap.getBoundingClientRect(); return {sx: ev.clientX - r.left, sy: ev.clientY - r.top}; }
function esySourisMouvement(ev){
  var m = esyPos(ev);
  if(ESY.pan){
    ESY.cx = ESY.pan.cx - (m.sx - ESY.pan.sx) / ESY.k; ESY.cy = ESY.pan.cy + (m.sy - ESY.pan.sy) / ESY.k;
    ESY.mouse = m; ESY.snap = esyAccroche(m.sx, m.sy); esyDessiner(); return;
  }
  ESY.mouse = m; ESY.snap = ESY.cmd === 'pan' ? null : esyAccroche(m.sx, m.sy);
  if(ESY.win && !ESY.win.drag && Math.hypot(m.sx - ESY.win.sx, m.sy - ESY.win.sy) > 4) ESY.win.drag = true;
  esyOverlay(); esyStatut();
}
function esySourisBas(ev){
  var m = esyPos(ev); ESY.mouse = m; ESY.wrap.focus({preventScroll: true});
  if(ev.button === 1){
    ev.preventDefault(); var now = Date.now();
    if(now - ESY.lastMid < 400){ ESY.lastMid = 0; esyEtendue(); return; }
    ESY.lastMid = now; ESY.pan = {sx: m.sx, sy: m.sy, cx: ESY.cx, cy: ESY.cy}; ESY.wrap.classList.add('pan', 'on'); return;
  }
  if(ev.button === 2){ ev.preventDefault(); return; }
  if(ev.button !== 0) return;
  if(ESY.cmd === 'pan'){ ESY.pan = {sx: m.sx, sy: m.sy, cx: ESY.cx, cy: ESY.cy}; ESY.wrap.classList.add('on'); return; }
  if(ESY.cmd === 'zoomwin'){
    if(!ESY.win) ESY.win = {sx: m.sx, sy: m.sy, drag: false, type: 'zoom'};
    else { var a = ESY.win; ESY.win = null; ESY.cmd = null; esyZoomFenetre(a, m); ESY.prompt = ''; }
    esyDessiner(); return;
  }
  var dessin = ESY.cmd && ESY.cmd !== 'erase' && !ESY.tsel && ESY.cmd !== 'mirrorq';
  if(dessin){ var p = esyAccroche(m.sx, m.sy); esyAjoutPoint([p.x, p.y]); return; }
  /* sélection (aussi pour EFFACER) */
  if(ESY.win && ESY.win.click){ var w = ESY.win; ESY.win = null; esyFenetreSel(w, m, ev.shiftKey); esyDessiner(); return; }
  var hit = esyTouche(esyWx(m.sx), esyWy(m.sy));
  if(hit >= 0){ esySelectionner([hit], ev.shiftKey); ESY.prompt = ESY.sel.length + ' objet(s) sélectionné(s).'; esyDessiner(); return; }
  ESY.win = {sx: m.sx, sy: m.sy, drag: false, click: false}; esyDessiner();
}
function esySourisHaut(ev){
  var m = esyPos(ev);
  if(ev.button === 1 || (ESY.pan && ev.button === 0)){ ESY.pan = null; ESY.wrap.classList.remove('on'); if(ESY.cmd !== 'pan') ESY.wrap.classList.remove('pan'); esyDessiner(); return; }
  if(ev.button !== 0) return;
  if(ESY.win && ESY.win.type !== 'zoom'){
    if(ESY.win.drag){ var w = ESY.win; ESY.win = null; esyFenetreSel(w, m, ev.shiftKey); esyDessiner(); }
    else ESY.win.click = true;
  } else if(ESY.win && ESY.win.type === 'zoom' && ESY.win.drag){ var z = ESY.win; ESY.win = null; ESY.cmd = null; esyZoomFenetre(z, m); ESY.prompt = ''; esyDessiner(); }
}
function esyMolette(ev){
  ev.preventDefault(); var m = esyPos(ev);
  esyZoomAu(m.sx, m.sy, Math.exp(-ev.deltaY * 0.0015 * (ev.deltaMode === 1 ? 16 : 1)));
  ESY.mouse = m; ESY.snap = esyAccroche(m.sx, m.sy); esyOverlay();
}

/* ---------- clavier ---------- */
function esyTouchePressee(ev){
  if(!ESY.root || !ESY.root.isConnected) return;
  var tg = ev.target, tag = tg && tg.tagName;
  if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if(byId('active-modal')) return;
  var k = ev.key;
  if(ev.ctrlKey || ev.metaKey){
    var kk = k.toLowerCase();
    if(kk === 'z'){ ev.preventDefault(); esyAnnuler(); } else if(kk === 'y'){ ev.preventDefault(); esyRetablir(); }
    else if(kk === 'a'){ ev.preventDefault(); ESY.cmd = null; esyTousSel(); }
    else if(kk === 's'){ ev.preventDefault(); esyEnregistrer(); }
    return;
  }
  if(k === 'Escape'){ esyEchap(); return; }
  if(k === 'F3'){ ev.preventDefault(); ESY.osnap = !ESY.osnap; esyDessiner(); return; }
  if(k === 'F7'){ ev.preventDefault(); ESY.grille = !ESY.grille; esyDessiner(); return; }
  if(k === 'F8'){ ev.preventDefault(); ESY.ortho = !ESY.ortho; esyDessiner(); return; }
  if(k === 'F9'){ ev.preventDefault(); ESY.accroche = !ESY.accroche; esyDessiner(); return; }
  if(k === 'Delete'){ ev.preventDefault(); esyEffacerSel(); return; }
  if(k === 'Enter' || k === ' '){ ev.preventDefault(); esyValide(); return; }
  if(k === 'Backspace'){ ev.preventDefault(); if(ESY.numBuf) ESY.numBuf = ESY.numBuf.slice(0, -1); else ESY.aliasBuf = ESY.aliasBuf.slice(0, -1); esyOverlay(); return; }
  if(/^[0-9.,\-]$/.test(k) && (ESY.cmd === 'line' || ESY.cmd === 'pline' || ESY.cmd === 'circle' || (ESY.cmd === 'rotate' && ESY.pts.length))){ ev.preventDefault(); ESY.numBuf += k; esyOverlay(); return; }
  if(/^[a-zA-Z]$/.test(k)){ ev.preventDefault(); ESY.numBuf = ''; ESY.aliasBuf += k.toUpperCase(); esyOverlay(); }
}

/* ---------- bibliothèque ---------- */
function esyBibli(){
  var docs = (typeof STATE !== 'undefined' && STATE.etudeSymboles) || [], par = {}, out = [], defs = {};
  docs.forEach(function(d){ par[d.code] = d; });
  ESY_DEFAUTS.forEach(function(d){
    defs[d.code] = 1; var o = par[d.code];
    out.push({code: d.code, nom: (o && o.nom) || d.nom, categorie: (o && o.categorie) || d.categorie, description: o ? (o.description || '') : d.description,
      entites: o && Array.isArray(o.entites) ? o.entites : d.entites, systeme: true, modifie: !!o, id: o ? o.id : null, parDefaut: !!(o && o.parDefaut)});
  });
  docs.forEach(function(o){ if(!defs[o.code]) out.push({code: o.code, nom: o.nom || o.code, categorie: o.categorie || 'autre', description: o.description || '', entites: Array.isArray(o.entites) ? o.entites : [], systeme: false, modifie: false, id: o.id, parDefaut: !!o.parDefaut}); });
  var ordre = {}; ESY_CATS.forEach(function(c, i){ ordre[c[0]] = i; });
  out.sort(function(a, b){ return ((ordre[a.categorie] == null ? 99 : ordre[a.categorie]) - (ordre[b.categorie] == null ? 99 : ordre[b.categorie])) || a.nom.localeCompare(b.nom); });
  return out;
}
function esyMini(ents){
  ents = ents.filter(function(e){ return e.t !== 'b'; });
  var b = esyBoite(ents) || {x0: -5, y0: -5, x1: 5, y1: 5}, pad = 1.5;
  var w = Math.max(b.x1 - b.x0, 6) + 2 * pad, h = Math.max(b.y1 - b.y0, 6) + 2 * pad, s = Math.max(w, h), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  var st = 'stroke="#14181f" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linecap="round"';
  var inner = ents.map(function(e){ return esyEntSvg(e, function(x){ return x; }, function(y){ return -y; }, 1, st).replace(/<(line|path|circle)\b/, '<$1 vector-effect="non-scaling-stroke"'); }).join('');
  return '<svg viewBox="' + esyF(cx - s / 2) + ' ' + esyF(-cy - s / 2) + ' ' + esyF(s) + ' ' + esyF(s) + '">' + inner + '</svg>';
}
function esyListe(){
  var el = byId('esy-side'); if(!el) return;
  var lib = esyBibli(), html = '', cat = null, courant = ESY.cur && ESY.cur.code;
  var ecrit = canWrite('etude_elec');
  html += '<div style="display:flex;gap:6px;margin-bottom:6px;"><button type="button" class="btn btn-primary" id="esy-nouveau"' + (ecrit ? '' : ' disabled') + '>Nouveau</button><button type="button" class="btn" id="esy-dupli"' + (ecrit ? '' : ' disabled') + ' title="Copier le symbole affiché dans un nouveau symbole">Dupliquer</button></div>';
  lib.forEach(function(s){
    if(s.categorie !== cat){ cat = s.categorie; var cn = ESY_CATS.filter(function(c){ return c[0] === cat; })[0]; html += '<h4>' + esc(cn ? cn[1] : cat) + '</h4>'; }
    html += '<div class="esy-it' + (s.code === courant ? ' on' : '') + '" data-code="' + esc(s.code) + '">' + esyMini(s.entites) + '<div><div class="nm">' + esc(s.nom) + '</div><div class="cd">' + esc(s.code) + (s.systeme ? ' · système' : '') + (s.modifie ? ' · modifié' : '') + '</div></div></div>';
  });
  el.innerHTML = html;
}
function esyCharger(code){
  var s = esyBibli().filter(function(x){ return x.code === code; })[0]; if(!s) return;
  ESY.cur = {id: s.id, code: s.code, nom: s.nom, categorie: s.categorie, description: s.description, systeme: s.systeme, modifie: s.modifie, nouveau: false, parDefaut: esyEstChoisi(s)};
  ESY.ents = JSON.parse(JSON.stringify(s.entites)); ESY.undo = []; ESY.redo = []; ESY.sel = []; ESY.rev++; ESY.cmd = null; ESY.pts = [];
  esyRef(); esyChampsMeta(); esyListe(); esyEtendue(); esyMajEtat();
  ESY.prompt = 'Symbole « ' + s.nom + ' » chargé. Origine (0,0) = point d\'insertion dans le schéma.'; esyStatut();
}
function esyChoisi(cat){
  var lib = esyBibli();
  return lib.filter(function(x){ return x.categorie === cat && x.parDefaut; })[0] || lib.filter(function(x){ return x.code === cat; })[0] || lib.filter(function(x){ return x.categorie === cat; })[0] || null;
}
function esyEstChoisi(s){ var c = esyChoisi(s.categorie); return !!c && c.code === s.code; }
function esySig(){ return JSON.stringify([ESY.cur.nom, ESY.cur.categorie, ESY.cur.description, !!ESY.cur.parDefaut, ESY.ents]); }
function esyRef(){ ESY.refJson = esySig(); }
function esySale(){ return !!ESY.cur && esySig() !== ESY.refJson; }
function esyChampsMeta(){
  var c = ESY.cur;
  byId('esy-pd').checked = !!c.parDefaut; byId('esy-pd').disabled = !canWrite('etude_elec');
  byId('esy-nom').value = c.nom; byId('esy-cat').value = c.categorie; byId('esy-desc').value = c.description || '';
  var code = byId('esy-code'); code.value = c.code; code.disabled = !c.nouveau;
  var ecrit = canWrite('etude_elec');
  ['esy-nom', 'esy-cat', 'esy-desc'].forEach(function(i){ byId(i).disabled = !ecrit; });
  byId('esy-save').disabled = !ecrit;
  byId('esy-supp').style.display = (c.systeme && c.modifie) ? '' : (c.systeme || c.nouveau ? 'none' : '');
  byId('esy-supp').textContent = c.systeme ? 'Rétablir le symbole par défaut' : 'Supprimer';
  byId('esy-supp').disabled = !ecrit;
}
function esyMajEtat(){
  var el = byId('esy-etat'); if(!el || !ESY.cur) return;
  el.textContent = esySale() ? 'Modifications non enregistrées' : (ESY.cur.nouveau ? 'Nouveau symbole non enregistré' : 'Enregistré');
  el.style.color = esySale() || ESY.cur.nouveau ? '#b45309' : 'var(--muted,#667)';
}
function esyConfirmerAbandon(){
  if(!esySale()) return Promise.resolve(true);
  return confirmDialog('Le symbole affiché a des modifications non enregistrées. Les abandonner ?', {okLabel: 'Abandonner', danger: true});
}
function esyEnregistrer(){
  if(!canWrite('etude_elec') || !ESY.cur) return;
  var c = ESY.cur, nom = (byId('esy-nom').value || '').trim(), code = (byId('esy-code').value || '').trim();
  if(!nom){ toast('Donnez un nom au symbole.', 'error'); return; }
  if(c.nouveau){
    if(!/^[a-z][a-z0-9_]{1,25}$/.test(code)){ toast('Code invalide : lettres minuscules, chiffres et _ (2 à 26 caractères, commence par une lettre).', 'error'); return; }
    if(esyBibli().some(function(s){ return s.code === code; })){ toast('Ce code existe déjà dans la bibliothèque.', 'error'); return; }
  }
  if(!ESY.ents.length){ toast('Le symbole est vide : dessinez au moins un objet.', 'error'); return; }
  var id = c.id || ('sym_' + (c.nouveau ? code : c.code)), now = nowISO();
  var data = {code: c.nouveau ? code : c.code, nom: nom, categorie: byId('esy-cat').value, description: byId('esy-desc').value, entites: JSON.parse(JSON.stringify(ESY.ents)), updatedAt: now, parDefaut: !!byId('esy-pd').checked};
  /* un seul symbole « utilisé dans le schéma » par catégorie : on retire l'indicateur aux autres */
  var autres = (STATE.etudeSymboles || []).filter(function(d){ return d.parDefaut && d.categorie === data.categorie && d.id !== id; });
  if(!c.id){ data.createdAt = now; data.creePar = currentUserName(); }
  var ref = STATE.db.doc('etudeSymboles/' + id);
  var p = c.id ? ref.get().then(function(sn){ var o = sn.exists ? sn.data() : {}; data.createdAt = o.createdAt || now; data.creePar = o.creePar || currentUserName(); return ref.set(data); }) : ref.set(data);
  if(data.parDefaut) p = p.then(function(){ return Promise.all(autres.map(function(d){ return STATE.db.doc('etudeSymboles/' + d.id).update({parDefaut: false}).then(function(){ d.parDefaut = false; }); })); });
  p.then(function(){
    var l = STATE.etudeSymboles || (STATE.etudeSymboles = []), i, ok = false;
    for(i = 0; i < l.length; i++) if(l[i].id === id){ l[i] = Object.assign({id: id}, data); ok = true; }
    if(!ok) l.push(Object.assign({id: id}, data));
    ESY.cur = {id: id, code: data.code, nom: nom, categorie: data.categorie, description: data.description, systeme: ESY_DEFAUTS.some(function(d){ return d.code === data.code; }), modifie: true, nouveau: false, parDefaut: data.parDefaut};
    esyRef(); esyChampsMeta(); esyListe(); esyMajEtat(); toast('Symbole enregistré.', 'success');
  }).catch(function(err){ toast('Enregistrement impossible : ' + (err && err.message || err), 'error'); });
}
function esyNouveau(depuis){
  esyConfirmerAbandon().then(function(ok){
    if(!ok) return;
    var base = depuis ? ESY.cur : null;
    ESY.cur = {id: null, code: '', nom: base ? base.nom + ' (copie)' : 'Nouveau symbole', categorie: base ? base.categorie : 'autre', description: base ? base.description : '', systeme: false, modifie: false, nouveau: true, parDefaut: false};
    if(!depuis){ ESY.ents = []; } else ESY.ents = JSON.parse(JSON.stringify(ESY.ents));
    ESY.undo = []; ESY.redo = []; ESY.sel = []; ESY.rev++; ESY.refJson = ''; esyChampsMeta(); esyListe(); esyEtendue(); esyMajEtat();
    ESY.prompt = 'Nouveau symbole : dessinez avec L, PL, REC, C, A, T ; renseignez nom et code puis Enregistrer.'; esyStatut();
    byId('esy-code').focus();
  });
}
function esySupprimer(){
  var c = ESY.cur; if(!c || !c.id || !canWrite('etude_elec')) return;
  confirmDialog(c.systeme ? 'Rétablir le dessin par défaut du symbole « ' + c.nom + ' » ? Votre version sera supprimée.' : 'Supprimer définitivement le symbole « ' + c.nom + ' » ?', {okLabel: c.systeme ? 'Rétablir' : 'Supprimer', danger: true}).then(function(ok){
    if(!ok) return;
    deleteDoc('etudeSymboles', c.id).then(function(){
      STATE.etudeSymboles = (STATE.etudeSymboles || []).filter(function(d){ return d.id !== c.id; });
      if(c.systeme) esyCharger(c.code);
      else { var lib = esyBibli(); ESY.cur = null; esyCharger(lib[0].code); }
      toast(c.systeme ? 'Symbole par défaut rétabli.' : 'Symbole supprimé.', 'success');
    }).catch(function(err){ toast('Suppression impossible : ' + (err && err.message || err), 'error'); });
  });
}
/* ---------- DXF : symboles en BLOCK (V3.31) ---------- */
function esyNomBloc(code){ return ('SYM_' + String(code).toUpperCase().replace(/[^A-Z0-9_]/g, '_')).slice(0, 31); }
function esyDxfBlocs(liste, avecBornes, g, nombre){
  liste.forEach(function(sy){
    var nm = esyNomBloc(sy.code);
    g(0, 'BLOCK'); g(8, '0'); g(2, nm); g(70, 0); g(10, 0); g(20, 0); g(30, 0); g(3, nm);
    sy.entites.forEach(function(e){
      var i, a, span;
      var seg = function(x1, y1, x2, y2){ g(0, 'LINE'); g(8, '0'); g(10, nombre(x1)); g(20, nombre(y1)); g(30, 0); g(11, nombre(x2)); g(21, nombre(y2)); g(31, 0); };
      if(e.t === 'l') seg(e.x1, e.y1, e.x2, e.y2);
      else if(e.t === 'p'){ for(i = 0; i < e.pts.length - 1; i++) seg(e.pts[i][0], e.pts[i][1], e.pts[i + 1][0], e.pts[i + 1][1]); if(e.closed && e.pts.length > 2) seg(e.pts[e.pts.length - 1][0], e.pts[e.pts.length - 1][1], e.pts[0][0], e.pts[0][1]); }
      else if(e.t === 'c'){ g(0, 'CIRCLE'); g(8, '0'); g(10, nombre(e.x)); g(20, nombre(e.y)); g(30, 0); g(40, nombre(e.r)); }
      else if(e.t === 'a'){ g(0, 'ARC'); g(8, '0'); g(10, nombre(e.x)); g(20, nombre(e.y)); g(30, 0); g(40, nombre(e.r)); g(50, nombre(e.a1)); g(51, nombre(e.a2)); }
      else if(e.t === 't'){ g(0, 'TEXT'); g(8, '0'); g(10, nombre(e.x)); g(20, nombre(e.y)); g(30, 0); g(40, nombre(e.h)); g(1, String(e.s).replace(/[^\x20-\xFF]/g, '-')); g(72, 1); g(73, 2); g(11, nombre(e.x)); g(21, nombre(e.y)); g(31, 0); }
      else if(e.t === 'b' && avecBornes){ g(0, 'CIRCLE'); g(8, 'BORNES'); g(10, nombre(e.x)); g(20, nombre(e.y)); g(30, 0); g(40, 0.5); g(0, 'TEXT'); g(8, 'BORNES'); g(10, nombre(e.x + 0.8)); g(20, nombre(e.y + 0.8)); g(30, 0); g(40, 1.2); g(1, e.nom === 'out' ? 'out' : 'in'); }
    });
    g(0, 'ENDBLK'); g(8, '0');
  });
}
function esyExporterDxf(){
  var o = [], g = function(c, v){ o.push(String(c)); o.push(String(v)); }, nombre = function(v){ return (Math.round(v * 1000) / 1000).toString(); };
  var lib = esyBibli().map(function(x){ return {code: x.code, nom: x.nom, entites: (ESY.cur && ESY.cur.code === x.code && !ESY.cur.nouveau) ? ESY.ents : x.entites}; });
  if(ESY.cur && ESY.cur.nouveau && ESY.ents.length && ESY.cur.code) lib.push({code: ESY.cur.code, nom: ESY.cur.nom, entites: ESY.ents});
  var couches = {'0': 7, SYMBOLES: 3, BORNES: 5, TEXTES: 7};
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, Object.keys(couches).length);
  Object.keys(couches).forEach(function(n){ g(0, 'LAYER'); g(2, n); g(70, 0); g(62, couches[n]); g(6, 'CONTINUOUS'); });
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'BLOCKS'); esyDxfBlocs(lib, true, g, nombre); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  lib.forEach(function(x, i){
    g(0, 'INSERT'); g(8, 'SYMBOLES'); g(2, esyNomBloc(x.code)); g(10, i * 30); g(20, 0); g(30, 0); g(41, 1); g(42, 1); g(43, 1); g(50, 0);
    g(0, 'TEXT'); g(8, 'TEXTES'); g(10, nombre(i * 30)); g(20, -12); g(30, 0); g(40, 2.5); g(1, String(x.code)); g(72, 1); g(73, 2); g(11, nombre(i * 30)); g(21, -12); g(31, 0);
  });
  g(0, 'ENDSEC'); g(0, 'EOF');
  eunTelecharger('Bibliotheque_symboles.dxf', o.join('\r\n') + '\r\n', 'application/dxf', true);
  ESY.prompt = 'Bibliothèque exportée : ' + lib.length + ' symbole(s), un BLOCK par symbole (nom SYM_<code>), unités en millimètres.'; esyStatut();
}
/* ---------- import DXF / SVG d'un symbole, export SVG (V3.32) ---------- */
function esyNum(v){ var n = parseFloat(v); return isFinite(n) ? n : 0; }
/* DXF ASCII -> {blocs: {nom: [entites]}, dessin: [entites], unite: facteur vers mm} ; entites en unites du fichier */
function esyDxfLire(txt){
  var L = txt.split(/\r?\n/), recs = [], cur = null, res = {blocs: {}, dessin: [], unite: 1, insunits: null}, i;
  for(i = 0; i + 1 < L.length; i += 2){
    var c = parseInt(L[i].trim(), 10), v = L[i + 1].replace(/\r$/, '');
    if(c === 9 && v.trim() === '$INSUNITS' && L[i + 3] !== undefined) res.insunits = parseInt(L[i + 3].trim(), 10);
    if(c === 0){ cur = {type: v.trim(), g: {}}; recs.push(cur); }
    else if(cur) (cur.g[c] = cur.g[c] || []).push(v);
  }
  var section = '', bloc = null, poly = null;
  function conv(r){
    var t = r.type, g = r.g, e = null, v = function(c, d){ return g[c] ? esyNum(g[c][0]) : (d === undefined ? 0 : d); };
    if(t === 'LINE') e = {t: 'l', x1: v(10), y1: v(20), x2: v(11), y2: v(21)};
    else if(t === 'CIRCLE') e = {t: 'c', x: v(10), y: v(20), r: v(40)};
    else if(t === 'ARC') e = {t: 'a', x: v(10), y: v(20), r: v(40), a1: v(50), a2: v(51)};
    else if(t === 'LWPOLYLINE'){ var xs = g[10] || [], ys = g[20] || [], pts = [], j; for(j = 0; j < xs.length; j++) pts.push([esyNum(xs[j]), esyNum(ys[j])]); e = {t: 'p', pts: pts, closed: (v(70) & 1) === 1}; }
    else if(t === 'TEXT' || t === 'MTEXT'){
      var h = v(40, 2.5), sx = String(g[1] ? g[1].join('') : '').replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, ''), al = g[11] && (v(72) || v(73)), cx = al ? v(11) : v(10), cy = al ? v(21) : v(20);
      if(!al){ cx += 0.31 * h * sx.length; cy += h / 2; }
      if(sx) e = {t: 't', x: cx, y: cy, h: h, s: sx};
    }
    else if(t === 'INSERT') e = {t: 'i', nom: g[2] ? g[2][0].trim() : '', x: v(10), y: v(20), sx: v(41, 1), sy: v(42, g[41] ? v(41, 1) : 1), rot: v(50)};
    return e;
  }
  recs.forEach(function(r){
    var t = r.type;
    if(t === 'SECTION'){ section = (r.g[2] || [''])[0].trim(); return; }
    if(t === 'ENDSEC'){ section = ''; bloc = null; poly = null; return; }
    if(t === 'BLOCK'){ bloc = (r.g[2] || [''])[0].trim(); res.blocs[bloc] = []; return; }
    if(t === 'ENDBLK'){ bloc = null; return; }
    if(section !== 'ENTITIES' && section !== 'BLOCKS') return;
    var dest = bloc ? res.blocs[bloc] : res.dessin;
    if(t === 'POLYLINE'){ poly = {pts: [], closed: !!(r.g[70] && (esyNum(r.g[70][0]) & 1))}; return; }
    if(t === 'VERTEX' && poly){ poly.pts.push([esyNum(r.g[10] && r.g[10][0]), esyNum(r.g[20] && r.g[20][0])]); return; }
    if(t === 'SEQEND' && poly){ if(poly.pts.length > 1) dest.push({t: 'p', pts: poly.pts, closed: poly.closed}); poly = null; return; }
    var e = conv(r); if(e && dest) dest.push(e);
  });
  var u = {1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000}[res.insunits]; res.unite = u || 1;
  return res;
}
function esyDxfConvertir(res, source, k){
  var liste = source === '__dessin' ? res.dessin : (res.blocs[source] || []), out = [];
  function ajoute(e, M, prof){
    if(e.t === 'i'){
      if(prof > 3 || !res.blocs[e.nom]) return;
      var th = e.rot * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), M2 = {sx: e.sx * M.sx, sy: e.sy * M.sy, th: e.rot + M.th};
      var Mn = {
        p: function(x, y){ var a = x * e.sx, b = y * e.sy, u = a * co - b * si + e.x, w = a * si + b * co + e.y; return M.p(u, w); },
        sx: M2.sx, sy: M2.sy, th: M2.th, miroir: (e.sx * e.sy < 0) !== !!M.miroir, unif: Math.abs(Math.abs(e.sx) - Math.abs(e.sy)) < 1e-9 && M.unif};
      res.blocs[e.nom].forEach(function(f){ ajoute(f, Mn, prof + 1); }); return;
    }
    var q;
    if(e.t === 'l'){ var a = M.p(e.x1, e.y1), b = M.p(e.x2, e.y2); out.push({t: 'l', x1: a[0], y1: a[1], x2: b[0], y2: b[1]}); }
    else if(e.t === 'p') out.push({t: 'p', pts: e.pts.map(function(u){ return M.p(u[0], u[1]); }), closed: e.closed});
    else if(e.t === 'c' || e.t === 'a'){
      var ctr = M.p(e.x, e.y), sc = Math.abs(M.sx);
      if(M.unif && !M.miroir){ if(e.t === 'c') out.push({t: 'c', x: ctr[0], y: ctr[1], r: e.r * sc}); else out.push({t: 'a', x: ctr[0], y: ctr[1], r: e.r * sc, a1: esyMod(e.a1 + M.th), a2: esyMod(e.a2 + M.th)}); }
      else { esyEchantillon(e)[0].forEach(function(u, ix, arr){ if(ix) { var A = M.p(arr[ix - 1][0], arr[ix - 1][1]), B = M.p(u[0], u[1]); out.push({t: 'l', x1: A[0], y1: A[1], x2: B[0], y2: B[1]}); } }); }
    }
    else if(e.t === 't'){ q = M.p(e.x, e.y); out.push({t: 't', x: q[0], y: q[1], h: e.h * Math.abs(M.sy), s: e.s}); }
  }
  var id = {p: function(x, y){ return [x, y]; }, sx: 1, sy: 1, th: 0, miroir: false, unif: true};
  liste.forEach(function(e){ ajoute(e, id, 0); });
  return out.map(function(e){ return esyEchelle(e, k); });
}
function esyEchelle(e, k){
  var o = JSON.parse(JSON.stringify(e)), f = function(v){ return esyN(v * k); };
  if(o.t === 'l'){ o.x1 = f(o.x1); o.y1 = f(o.y1); o.x2 = f(o.x2); o.y2 = f(o.y2); }
  else if(o.t === 'p') o.pts = o.pts.map(function(u){ return [f(u[0]), f(u[1])]; });
  else { o.x = f(o.x); o.y = f(o.y); if(o.r !== undefined) o.r = f(o.r); if(o.h !== undefined) o.h = f(o.h); if(o.a1 !== undefined){ o.a1 = esyN(o.a1); o.a2 = esyN(o.a2); } }
  return o;
}
/* SVG -> entites (unites utilisateur, Y vers le haut) ; k = facteur vers mm */
function esySvgLire(txt){
  var doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), svg = doc.documentElement, out = [];
  if(!svg || String(svg.nodeName).toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  var k = 0.2646, w = svg.getAttribute('width') || '', vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat);
  if(/mm\s*$/.test(w) && vb.length === 4 && vb[2] > 0) k = parseFloat(w) / vb[2];
  else if(/cm\s*$/.test(w) && vb.length === 4 && vb[2] > 0) k = 10 * parseFloat(w) / vb[2];
  var mul = function(A, B){ return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; };
  function matrice(t){
    var M = [1, 0, 0, 1, 0, 0], re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g, m;
    while((m = re.exec(t || ''))){
      var a = m[2].split(/[\s,]+/).filter(Boolean).map(parseFloat), T = [1, 0, 0, 1, 0, 0];
      if(m[1] === 'matrix') T = a; else if(m[1] === 'translate') T = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; else if(m[1] === 'scale') T = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
      else { var th = (a[0] || 0) * Math.PI / 180, co = Math.cos(th), si = Math.sin(th); T = [co, si, -si, co, 0, 0]; if(a.length > 2) T = mul(mul([1, 0, 0, 1, a[1], a[2]], T), [1, 0, 0, 1, -a[1], -a[2]]); }
      M = mul(M, T);
    }
    return M;
  }
  var pt = function(M, x, y){ return [M[0] * x + M[2] * y + M[4], -(M[1] * x + M[3] * y + M[5])]; };
  function chemin(d, M){
    var tk = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [], i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = [], subs = [], qx = 0, qy = 0, px = 0, py = 0;
    var n = function(){ return parseFloat(tk[i++]); };
    function fin(cl){ if(cur.length > 1) subs.push({pts: cur, closed: cl}); cur = []; }
    function bez(p0, p1, p2, p3){ for(var s = 1; s <= 12; s++){ var t = s / 12, u = 1 - t; cur.push(pt(M, u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1])); } }
    function arc(x1, y1, rx, ry, phi, fa, fs, x2, y2){
      if(!rx || !ry){ cur.push(pt(M, x2, y2)); return; }
      var ph = phi * Math.PI / 180, c = Math.cos(ph), s = Math.sin(ph), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = c * dx + s * dy, yp = -s * dx + c * dy;
      rx = Math.abs(rx); ry = Math.abs(ry); var l = xp * xp / (rx * rx) + yp * yp / (ry * ry); if(l > 1){ rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
      var sq = Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp)), co = (fa === fs ? -1 : 1) * Math.sqrt(sq);
      var cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx, cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
      var ang = function(ux, uy, vx, vy){ var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
      var t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry), dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
      if(!fs && dt > 0) dt -= 2 * Math.PI; else if(fs && dt < 0) dt += 2 * Math.PI;
      for(var q = 1; q <= 20; q++){ var a = t1 + dt * q / 20; cur.push(pt(M, c * rx * Math.cos(a) - s * ry * Math.sin(a) + cx, s * rx * Math.cos(a) + c * ry * Math.sin(a) + cy)); }
    }
    while(i < tk.length){
      if(/[a-zA-Z]/.test(tk[i])) cmd = tk[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if(C === 'M'){ fin(false); x = ox + n(); y = oy + n(); sx = x; sy = y; cur = [pt(M, x, y)]; cmd = rel ? 'l' : 'L'; }
      else if(C === 'L'){ x = ox + n(); y = oy + n(); cur.push(pt(M, x, y)); }
      else if(C === 'H'){ x = (rel ? x : 0) + n(); cur.push(pt(M, x, y)); }
      else if(C === 'V'){ y = (rel ? y : 0) + n(); cur.push(pt(M, x, y)); }
      else if(C === 'C'){ var a1 = [ox + n(), oy + n()], a2 = [ox + n(), oy + n()], a3 = [ox + n(), oy + n()]; bez([x, y], a1, a2, a3); px = a2[0]; py = a2[1]; x = a3[0]; y = a3[1]; }
      else if(C === 'S'){ var b2 = [ox + n(), oy + n()], b3 = [ox + n(), oy + n()]; bez([x, y], [2 * x - px, 2 * y - py], b2, b3); px = b2[0]; py = b2[1]; x = b3[0]; y = b3[1]; }
      else if(C === 'Q'){ var q1 = [ox + n(), oy + n()], q2 = [ox + n(), oy + n()]; bez([x, y], [x + 2 / 3 * (q1[0] - x), y + 2 / 3 * (q1[1] - y)], [q2[0] + 2 / 3 * (q1[0] - q2[0]), q2[1] + 2 / 3 * (q1[1] - q2[1])], q2); qx = q1[0]; qy = q1[1]; x = q2[0]; y = q2[1]; }
      else if(C === 'T'){ var t2 = [ox + n(), oy + n()], q1b = [2 * x - qx, 2 * y - qy]; bez([x, y], [x + 2 / 3 * (q1b[0] - x), y + 2 / 3 * (q1b[1] - y)], [t2[0] + 2 / 3 * (q1b[0] - t2[0]), t2[1] + 2 / 3 * (q1b[1] - t2[1])], t2); qx = q1b[0]; qy = q1b[1]; x = t2[0]; y = t2[1]; }
      else if(C === 'A'){ var rx = n(), ry = n(), ph = n(), fa = n(), fs = n(), ex = ox + n(), ey = oy + n(); arc(x, y, rx, ry, ph, !!fa, !!fs, ex, ey); x = ex; y = ey; }
      else if(C === 'Z'){ fin(true); x = sx; y = sy; cur = [pt(M, x, y)]; }
      else i++;
    }
    fin(false);
    return subs;
  }
  function visite(el, M){
    if(el.nodeType !== 1) return;
    var nom = el.localName, T = mul(M, matrice(el.getAttribute('transform'))), g = function(a){ return parseFloat(el.getAttribute(a)) || 0; };
    if(nom === 'defs' || nom === 'metadata' || nom === 'style' || nom === 'symbol' || nom === 'clipPath') return;
    if(nom === 'line'){ var a = pt(T, g('x1'), g('y1')), b = pt(T, g('x2'), g('y2')); out.push({t: 'l', x1: a[0], y1: a[1], x2: b[0], y2: b[1]}); }
    else if(nom === 'polyline' || nom === 'polygon'){ var nums = (el.getAttribute('points') || '').split(/[\s,]+/).filter(Boolean).map(parseFloat), pp = []; for(var i = 0; i + 1 < nums.length; i += 2) pp.push(pt(T, nums[i], nums[i + 1])); if(pp.length > 1) out.push({t: 'p', pts: pp, closed: nom === 'polygon'}); }
    else if(nom === 'rect'){ var x = g('x'), y = g('y'), w2 = g('width'), h2 = g('height'); out.push({t: 'p', pts: [pt(T, x, y), pt(T, x + w2, y), pt(T, x + w2, y + h2), pt(T, x, y + h2)], closed: true}); }
    else if(nom === 'circle' || nom === 'ellipse'){
      var cx = g('cx'), cy = g('cy'), rx = nom === 'circle' ? g('r') : g('rx'), ry = nom === 'circle' ? g('r') : g('ry'), sxs = Math.hypot(T[0], T[1]), sys = Math.hypot(T[2], T[3]);
      if(Math.abs(rx - ry) < 1e-9 && Math.abs(sxs - sys) < 1e-6 && Math.abs(T[0] * T[2] + T[1] * T[3]) < 1e-6){ var cc = pt(T, cx, cy); out.push({t: 'c', x: cc[0], y: cc[1], r: rx * sxs}); }
      else { var ep = []; for(var j = 0; j <= 48; j++){ var an = j * Math.PI / 24; ep.push(pt(T, cx + rx * Math.cos(an), cy + ry * Math.sin(an))); } out.push({t: 'p', pts: ep, closed: true}); }
    }
    else if(nom === 'path'){ chemin(el.getAttribute('d') || '', T).forEach(function(sp){ out.push({t: 'p', pts: sp.pts, closed: sp.closed}); }); }
    else if(nom === 'text'){ var tx = (el.textContent || '').trim(), fs = parseFloat(el.getAttribute('font-size')) || 10, pq = pt(T, g('x'), g('y')); if(tx) out.push({t: 't', x: pq[0], y: pq[1] + fs * Math.hypot(T[2], T[3]) * 0.35, h: fs * Math.hypot(T[2], T[3]), s: tx}); }
    for(var c = el.firstChild; c; c = c.nextSibling) if(nom !== 'text') visite(c, T);
  }
  visite(svg, [1, 0, 0, 1, 0, 0]);
  return {entites: out, unite: k};
}
function esyImportAppliquer(ents, recentrer){
  if(!ents.length){ toast('Rien à importer.', 'error'); return; }
  if(ents.length > 3000){ toast('Fichier trop détaillé (' + ents.length + ' objets) : limitez-vous à un symbole.', 'error'); return; }
  if(recentrer){ var b = esyBoite(ents); if(b){ var dx = -(b.x0 + b.x1) / 2, dy = -(b.y0 + b.y1) / 2, Td = esyTDeplacement(dx, dy); ents = ents.map(function(e){ return esyTransforme(e, Td); }); } }
  esyPousser(); var n0 = ESY.ents.length; ESY.ents = ESY.ents.concat(ents); ESY.rev++;
  ESY.sel = ESY.ents.map(function(e, i){ return i; }).slice(n0); esyDessiner(); esyMajEtat(); esyEtendue();
  ESY.prompt = ents.length + ' objet(s) importé(s) et sélectionnés : M pour les placer, Ctrl+Z pour annuler.'; esyStatut();
}
function esyImporter(){ var f = byId('esy-file'); f.value = ''; f.click(); }
function esyImportFichier(file){
  var rd = new FileReader();
  rd.onload = function(){
    var txt = String(rd.result || ''), nom = file.name, dxf = /\.dxf$/i.test(nom), body, src = '__dessin', k = 1, res = null, svg = null;
    if(dxf){ res = esyDxfLire(txt); k = res.unite; }
    else { svg = esySvgLire(txt); if(!svg){ toast('Fichier SVG illisible.', 'error'); return; } k = svg.unite; }
    var opts = '';
    if(dxf){ opts += '<option value="__dessin">Dessin (espace objet) — ' + res.dessin.length + ' objet(s)</option>'; Object.keys(res.blocs).filter(function(b){ return b.charAt(0) !== '*'; }).forEach(function(b){ opts += '<option value="' + esc(b) + '">Bloc « ' + esc(b) + ' » — ' + res.blocs[b].length + ' objet(s)</option>'; }); }
    body = '<p style="font-size:13px;">Fichier <b>' + esc(nom) + '</b> (' + (dxf ? 'DXF' : 'SVG') + ').</p>' +
      (dxf ? '<div class="field"><label>Contenu à importer</label><select id="esy-i-src">' + opts + '</select></div>' : '<p style="font-size:12.5px;">' + svg.entites.length + ' objet(s) lu(s) ; courbes et arcs convertis en segments.</p>') +
      '<div class="field"><label>Facteur d\'unité vers le millimètre (1 unité du fichier = … mm)</label><input id="esy-i-k" type="number" step="any" value="' + esyN(k) + '"></div>' +
      '<label style="display:flex;gap:6px;align-items:center;font-weight:400;"><input type="checkbox" id="esy-i-ctr" style="width:auto;"' + (dxf ? '' : ' checked') + '> Centrer le dessin sur l\'origine (0,0)</label>' +
      '<p style="font-size:12px;color:#667;margin-top:8px;">Les objets importés s\'ajoutent au dessin courant et restent sélectionnés (M pour les déplacer, Ctrl+Z pour annuler). Les images, hachures et cotes ne sont pas importées.</p>';
    openModal({title: 'Importer un symbole', body: body, foot: '<button type="button" class="btn" onclick="closeModal()">Annuler</button><button type="button" class="btn btn-primary" id="esy-i-go">Importer</button>',
      onMount: function(ov){
        ov.querySelector('#esy-i-go').addEventListener('click', function(){
          var kk = parseFloat(ov.querySelector('#esy-i-k').value) || 1, ctr = ov.querySelector('#esy-i-ctr').checked, ents;
          if(dxf){ var sel = ov.querySelector('#esy-i-src').value; ents = esyDxfConvertir(res, sel, kk); }
          else ents = svg.entites.map(function(e){ return esyEchelle(e, kk); });
          closeModal(); esyImportAppliquer(ents, ctr);
        });
      }});
  };
  rd.readAsText(file);
}
function esyExporterSvg(){
  var ents = ESY.ents.filter(function(e){ return e.t !== 'b'; }), b = esyBoite(ents);
  if(!b){ toast('Le symbole est vide.', 'error'); return; }
  var m = 2, x0 = b.x0 - m, y0 = -b.y1 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
  var st = 'stroke="#000" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"';
  var inner = ents.map(function(e){ return esyEntSvg(e, function(x){ return x; }, function(y){ return -y; }, 1, st).replace(/fill="#7c3aed"/, 'fill="#000"'); }).join('\n');
  var code = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + esyN(w) + 'mm" height="' + esyN(h) + 'mm" viewBox="' + esyN(x0) + ' ' + esyN(y0) + ' ' + esyN(w) + ' ' + esyN(h) + '" font-family="Arial, Helvetica, sans-serif">\n' + inner + '\n</svg>\n';
  eunTelecharger('Symbole_' + ((ESY.cur && ESY.cur.code) || 'nouveau') + '.svg', code, 'image/svg+xml', false);
  ESY.prompt = 'Symbole exporté en SVG (unités en millimètres, origine (0,0) du symbole à ' + esyN(-x0) + ' ; ' + esyN(-y0) + ' du coin).'; esyStatut();
}
function esyAide(){
  openModal({title: 'Raccourcis de l\'éditeur de symboles', body:
    '<p style="font-size:13px;">Comme sous AutoCAD, sans ligne de commande : tapez l\'alias au clavier puis <b>Espace</b> ou <b>Entrée</b>. Entrée / Espace sans saisie répète la dernière commande ; le clic droit vaut Entrée.</p>' +
    '<table class="table" style="font-size:12.5px;"><tbody>' +
    '<tr><td><b>L</b></td><td>Ligne (enchaînée) — tapez une longueur puis Entrée pour une distance exacte</td></tr>' +
    '<tr><td><b>PL</b></td><td>Polyligne (<b>C</b> + Entrée pour fermer, <b>U</b> pour retirer le dernier point)</td></tr>' +
    '<tr><td><b>REC</b></td><td>Rectangle (deux coins)</td></tr>' +
    '<tr><td><b>C</b></td><td>Cercle (centre puis rayon cliqué ou tapé)</td></tr>' +
    '<tr><td><b>A</b></td><td>Arc par trois points</td></tr>' +
    '<tr><td><b>T</b> / <b>DT</b></td><td>Texte centré sur le point cliqué (hauteur réglable dans la barre d\'outils)</td></tr>' +
    '<tr><td><b>M</b> · <b>CO</b></td><td>Déplacer · copier (objets déjà sélectionnés ou choisis puis Entrée ; point de base puis destination ; Entrée pour finir la copie)</td></tr>' +
    '<tr><td><b>RO</b></td><td>Rotation : point de base, puis angle cliqué ou tapé en degrés (négatif = sens horaire)</td></tr>' +
    '<tr><td><b>MI</b></td><td>Symétrie : deux points d\'axe, puis O + Entrée pour effacer la source (Entrée = la garder)</td></tr>' +
    '<tr><td><b>BE</b> · <b>BS</b></td><td>Borne d\'entrée (haut) · borne de sortie (bas) : points où le schéma raccorde le conducteur</td></tr>' +
    '<tr><td>Texte variable</td><td>Dans un texte du symbole : <b>{gamme}</b> <b>{calibre}</b> <b>{declencheur}</b> <b>{kVA}</b> <b>{code}</b> <b>{tension}</b> <b>{repere}</b> <b>{puissance}</b> <b>{reglages}</b> — remplacés par les données du schéma (en violet dans l\'éditeur)</td></tr>' +
    '<tr><td><b>Importer…</b></td><td>Importer un symbole depuis un fichier DXF (dessin ou bloc) ou SVG ; <b>Exporter SVG</b> pour le symbole affiché</td></tr>' +
    '<tr><td><b>E</b> / Suppr</td><td>Effacer la sélection (ou choisir les objets puis Entrée)</td></tr>' +
    '<tr><td><b>U</b> / Ctrl+Z · Ctrl+Y</td><td>Annuler · rétablir</td></tr>' +
    '<tr><td><b>Z</b> puis <b>E</b> / <b>W</b></td><td>Zoom étendue · zoom fenêtre (aussi <b>ZE</b>, <b>ZW</b>)</td></tr>' +
    '<tr><td><b>P</b></td><td>Main (déplacer) — ou molette enfoncée</td></tr>' +
    '<tr><td>Molette</td><td>Zoom autour du curseur ; double-clic molette = étendue</td></tr>' +
    '<tr><td><b>F3</b> · <b>F7</b> · <b>F8</b> · <b>F9</b></td><td>Accrochage aux objets · grille · ortho · accrochage à la grille</td></tr>' +
    '<tr><td>Glisser dans le vide</td><td>Gauche→droite : fenêtre (objets entièrement inclus) · droite→gauche : capture (objets touchés) ; Maj = retirer</td></tr>' +
    '<tr><td><b>Ctrl+A</b> · <b>Ctrl+S</b> · <b>Échap</b></td><td>Tout sélectionner · enregistrer · annuler la commande</td></tr>' +
    '</tbody></table><p style="font-size:12px;color:#667;">Unités : millimètres. Origine (0,0) = point d\'insertion dans le schéma, axe Y vers le haut. Carreau fin = 1 mm, trait foncé = 1 cm.</p>',
    foot: '<button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>'});
}

/* ---------- montage ---------- */
function esyConstruire(){
  var cats = ESY_CATS.map(function(c){ return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
  function tb(id, lib, titre){ return '<button type="button" class="btn" id="esy-t-' + id + '" title="' + esc(titre) + '">' + lib + '</button>'; }
  var root = document.createElement('div'); root.className = 'esy';
  root.innerHTML =
    '<div class="esy-side" id="esy-side"></div>' +
    '<div class="esy-main">' +
      '<div class="esy-meta"><label>Nom<input id="esy-nom" style="width:200px;"></label><label>Code<input id="esy-code" style="width:170px;" placeholder="ex. disjoncteur_tetra"></label>' +
      '<label>Catégorie<select id="esy-cat">' + cats + '</select></label><label style="flex:1;min-width:180px;">Description<input id="esy-desc"></label>' +
      '<label style="flex-direction:row;align-items:center;gap:5px;" title="Le schéma unifilaire dessinera ce symbole pour sa catégorie"><input type="checkbox" id="esy-pd" style="width:auto;"> Utilisé dans le schéma</label>' +
      '<button type="button" class="btn btn-primary" id="esy-save">Enregistrer</button><button type="button" class="btn btn-danger" id="esy-supp" style="display:none;"></button><span id="esy-etat" style="font-size:12px;"></span></div>' +
      '<div class="esy-tools">' + tb('select', 'Sélection', 'Sélection (Échap)') + '<span class="sep"></span>' + tb('line', 'Ligne', 'L') + tb('pline', 'Polyligne', 'PL') + tb('rect', 'Rectangle', 'REC') + tb('circle', 'Cercle', 'C') + tb('arc', 'Arc', 'A — 3 points') + tb('text', 'Texte', 'T') +
      '<label style="display:flex;gap:4px;align-items:center;font-size:12px;">h<input id="esy-ht" type="number" min="0.5" max="50" step="0.5" value="3" style="width:56px;font-size:12.5px;padding:2px 4px;">mm</label>' +
      '<span class="sep"></span>' + tb('erase', 'Effacer', 'E / Suppr') + '<span class="sep"></span>' + tb('move', 'Déplacer', 'M') + tb('copy', 'Copier', 'CO') + tb('rotate', 'Rotation', 'RO') + tb('mirror', 'Symétrie', 'MI') + '<span class="sep"></span>' + tb('bin', 'Borne in', 'BE — borne d\'entrée (haut)') + tb('bout', 'Borne out', 'BS — borne de sortie (bas)') + '<span class="sep"></span>' + '<button type="button" class="btn" id="esy-undo" title="Annuler (U, Ctrl+Z)">Annuler</button><button type="button" class="btn" id="esy-redo" title="Rétablir (Ctrl+Y)">Rétablir</button>' +
      '<span class="sep"></span><button type="button" class="btn" id="esy-ext" title="Zoom étendue (ZE, double-clic molette)">Tout afficher</button>' + tb('zoomwin', 'Zoom fenêtre', 'ZW') + tb('pan', 'Main', 'P') +
      '<span class="sep"></span><button type="button" class="btn" id="esy-imp" title="Importer un symbole depuis un fichier DXF ou SVG">Importer…</button><button type="button" class="btn" id="esy-exsvg" title="Exporter le symbole affiché en SVG">Exporter SVG</button><button type="button" class="btn" id="esy-dxf" title="Exporter toute la bibliothèque en DXF : un BLOCK par symbole">Exporter DXF</button><input type="file" id="esy-file" accept=".dxf,.svg" style="display:none;"><button type="button" class="btn" id="esy-aide">Raccourcis</button></div>' +
      '<div class="esy-wrap" id="esy-wrap" tabindex="0"><svg id="esy-svg" xmlns="http://www.w3.org/2000/svg"><g id="esy-g"></g><g id="esy-e"></g><g id="esy-o"></g></svg>' +
      '<div class="esy-tip" id="esy-tip"></div><input class="esy-txt" id="esy-txt" placeholder="Texte ou variable : {gamme} {calibre} {kVA}…" autocomplete="off"></div>' +
      '<div class="esy-st"><span class="xy" id="esy-xy"></span><button type="button" class="btn" id="esy-bg" title="Grille visible (F7)">GRILLE</button><button type="button" class="btn" id="esy-ba" title="Accrochage à la grille (F9)">ACCROCH.</button>' +
      '<button type="button" class="btn" id="esy-bo" title="Ortho (F8)">ORTHO</button><button type="button" class="btn" id="esy-bs" title="Accrochage aux objets (F3)">OSNAP</button>' +
      '<label style="display:flex;gap:4px;align-items:center;">Pas<select id="esy-pas"><option value="0.5">0,5 mm</option><option value="1" selected>1 mm</option><option value="2">2 mm</option><option value="2.5">2,5 mm</option><option value="5">5 mm</option><option value="10">1 cm</option></select></label>' +
      '<span id="esy-sc" style="color:var(--muted,#667);"></span><span class="pr" id="esy-pr"></span></div>' +
      '<p class="esy-help">Tapez un alias (L, PL, REC, C, A, T, E, Z…) puis Espace ou Entrée, comme sous AutoCAD. Bibliothèque commune à tous les projets. Origine (0,0) = point d\'insertion dans le schéma.</p>' +
    '</div>';
  ESY.root = root; ESY.wrap = root.querySelector('#esy-wrap'); ESY.svg = root.querySelector('#esy-svg');
  var w = ESY.wrap;
  w.addEventListener('mousemove', esySourisMouvement); w.addEventListener('mousedown', esySourisBas); w.addEventListener('wheel', esyMolette, {passive: false});
  w.addEventListener('contextmenu', function(e){ e.preventDefault(); esyValide(); });
  w.addEventListener('mouseleave', function(){ if(!ESY.pan){ ESY.mouse = null; ESY.snap = null; esyOverlay(); esyStatut(); } });
  window.addEventListener('mouseup', function(e){ if(ESY.root && ESY.root.isConnected) esySourisHaut(e); });
  root.querySelectorAll('.btn').forEach(function(b){ b.addEventListener('mousedown', function(e){ e.preventDefault(); }); });
  root.querySelector('#esy-side').addEventListener('click', function(e){
    var it = e.target.closest('.esy-it'); if(it){ var code = it.getAttribute('data-code'); if(ESY.cur && ESY.cur.code === code) return; esyConfirmerAbandon().then(function(ok){ if(ok) esyCharger(code); }); return; }
    if(e.target.id === 'esy-nouveau') esyNouveau(false); else if(e.target.id === 'esy-dupli') esyNouveau(true);
  });
  ['move', 'copy', 'rotate', 'mirror'].forEach(function(c){ root.querySelector('#esy-t-' + c).addEventListener('click', function(){ if(ESY.cmd === c) esyCmd('select'); else esyCmd(c); }); });
  ['bin', 'bout'].forEach(function(c){ root.querySelector('#esy-t-' + c).addEventListener('click', function(){ var n = c === 'bout' ? 'out' : 'in'; if(ESY.cmd === 'borne' && ESY.bnom === n) { esyCmd('select'); return; } ESY.bnom = n; esyCmd('borne'); }); });
  ['line', 'pline', 'rect', 'circle', 'arc', 'text', 'erase', 'zoomwin', 'pan', 'select'].forEach(function(c){ root.querySelector('#esy-t-' + c).addEventListener('click', function(){ if((ESY.cmd === c && c !== 'select') || (c === 'select' && !ESY.cmd)) { esyCmd('select'); return; } esyCmd(c); }); });
  root.querySelector('#esy-undo').addEventListener('click', esyAnnuler); root.querySelector('#esy-redo').addEventListener('click', esyRetablir);
  root.querySelector('#esy-ext').addEventListener('click', function(){ esyFinCmd(false); ESY.cmd = null; esyEtendue(); });
  root.querySelector('#esy-aide').addEventListener('click', esyAide);
  root.querySelector('#esy-dxf').addEventListener('click', esyExporterDxf);
  root.querySelector('#esy-imp').addEventListener('click', esyImporter); root.querySelector('#esy-exsvg').addEventListener('click', esyExporterSvg);
  root.querySelector('#esy-file').addEventListener('change', function(e){ if(e.target.files[0]) esyImportFichier(e.target.files[0]); });
  root.querySelector('#esy-pd').addEventListener('change', function(e){ ESY.cur.parDefaut = e.target.checked; esyMajEtat(); });
  root.querySelector('#esy-save').addEventListener('click', esyEnregistrer); root.querySelector('#esy-supp').addEventListener('click', esySupprimer);
  root.querySelector('#esy-bg').addEventListener('click', function(){ ESY.grille = !ESY.grille; esyDessiner(); });
  root.querySelector('#esy-ba').addEventListener('click', function(){ ESY.accroche = !ESY.accroche; esyDessiner(); });
  root.querySelector('#esy-bo').addEventListener('click', function(){ ESY.ortho = !ESY.ortho; esyDessiner(); });
  root.querySelector('#esy-bs').addEventListener('click', function(){ ESY.osnap = !ESY.osnap; esyDessiner(); });
  root.querySelector('#esy-pas').addEventListener('change', function(e){ ESY.pas = parseFloat(e.target.value) || 1; });
  root.querySelector('#esy-ht').addEventListener('change', function(e){ ESY.hTexte = Math.max(0.5, parseFloat(e.target.value) || 3); });
  ['esy-nom', 'esy-desc'].forEach(function(i){ root.querySelector('#' + i).addEventListener('input', function(e){ ESY.cur[i === 'esy-nom' ? 'nom' : 'description'] = e.target.value; esyMajEtat(); }); });
  root.querySelector('#esy-cat').addEventListener('change', function(e){ ESY.cur.categorie = e.target.value; esyMajEtat(); });
  var t = root.querySelector('#esy-txt');
  t.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Enter'){ var s = t.value.trim(), p = ESY.pts[0]; t.style.display = 'none'; if(s && p) esyAjouter(esyTxt(p[0], p[1], ESY.hTexte, s)); ESY.pts = []; ESY.cmd = null; ESY.prompt = s ? 'Texte créé.' : ''; esyDessiner(); ESY.wrap.focus({preventScroll: true}); }
    else if(e.key === 'Escape'){ t.style.display = 'none'; ESY.pts = []; ESY.cmd = null; ESY.prompt = 'Annulé.'; esyDessiner(); ESY.wrap.focus({preventScroll: true}); }
  });
  document.addEventListener('keydown', esyTouchePressee);
  window.addEventListener('resize', function(){ if(ESY.root && ESY.root.isConnected){ esyTaille(); esyDessiner(); } });
  if(window.ResizeObserver) new ResizeObserver(function(){ if(ESY.root && ESY.root.isConnected && esyTaille() !== false){ esyDessiner(); } }).observe(ESY.wrap);
}
function renderEtudeSymboles(mount, actions){
  esyStyleOnce(); actions.innerHTML = '';
  if(!ESY.root) esyConstruire();
  if(ESY.root.parentNode !== mount){ mount.innerHTML = ''; mount.appendChild(ESY.root); }
  esyTaille();
  if(!ESY.cur){ ESY.prompt = ''; esyCharger('disjoncteur'); }
  else { esyListe(); esyDessiner(); }
  /* la mise en page n'est connue qu'apres l'insertion : on remesure et on recadre au premier affichage */
  requestAnimationFrame(function(){ if(!ESY.root.isConnected) return; var premier = !ESY.cadre; ESY.cadre = true; esyTaille(); if(premier) esyEtendue(); else esyDessiner(); });
}
