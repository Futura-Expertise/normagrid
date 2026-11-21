/* =========================================================
   MODULE ETUDE ELECTRIQUE (V3.05) - Bilan de puissance.
   Charge APRES etude-liste.js (utilise eeSectionsAmontAval, eeListes, eeSpecExport...).

   Un bilan par tableau (Switchgear / MCC), calcule depuis la Base de donnees, avec la
   meme forme que les feuilles du classeur de reference : liste des departs, bilan
   "source normale", bilan "source secours" (lignes E), puissance du transfo et reserve,
   pertes des transformateurs, charges motrices (DOL) / normales. Une feuille "Recap puissance"
   rassemble les tableaux.
   CASCADE AUTOMATIQUE : un depart qui alimente un autre tableau (son tag = ce tableau)
   reprend la puissance totale de ce tableau aval (ce n'etait plus a saisir a la main).
   Stocke par tableau (etudeBilanTableaux) : en-tete, K.Foisonnement normal / secours,
   puissance du transfo, pertes (P, Q).
   ========================================================= */

function eebNum(x){ if(x===null || x===undefined || x==='') return 0; var n = Number(x); return isNaN(n) ? 0 : n; }
function eebEstE(d){ return String(d.eNe===null||d.eNe===undefined?'':d.eNe).toLowerCase() === 'e'; }
function eebEstDol(d){ return String(d.specialReqts===null||d.specialReqts===undefined?'':d.specialReqts).trim().toLowerCase() === 'dol'; }
function eebS(p, q){ return Math.sqrt(p*p + q*q); }
function eebCos(p, s){ return s ? p/s : null; }

/* Calcule le bilan de chaque tableau. sections : eeSectionsAmontAval(...) ; params : cle -> {kfN, kfS, transfo, pertes:[{p,q}]}.
   Renvoie cle -> resultat. Les tableaux aval sont calcules avant leur amont (ordre inverse). */
function eeBilanCalculer(sections, params){
  var res = {};
  var enfantDe = {};
  sections.forEach(function(s){ if(s.cle && s.departId) enfantDe[s.departId] = s.cle; });
  for(var i = sections.length - 1; i >= 0; i--){
    var s = sections[i];
    if(!s.cle) continue;                       // "Sans tableau" : pas un tableau, pas de bilan
    var prm = (params && params[s.cle]) || {};
    var lignes = s.lignes.map(function(d){
      var ch = enfantDe[d.id];
      if(ch && res[ch] && ch !== s.cle){
        // V3.10 : le tableau aval peut etre repris AVEC son coefficient de reserve (defaut) ou SANS (option du tableau aval)
        var cn = res[ch].normal, sans = res[ch].cascSans;
        return {d: d, cascade: ch, P: sans ? cn.Psans : cn.P, Q: sans ? cn.Qsans : cn.Q};
      }
      return {d: d, cascade: null, P: eebNum(d.pActiveFoisonnee), Q: eebNum(d.pReactiveFoisonnee)};
    });
    var sP = 0, sQ = 0, eP = 0, eQ = 0, dolNP = 0, dolNQ = 0, dolEP = 0, dolEQ = 0;
    lignes.forEach(function(l){
      sP += l.P; sQ += l.Q;
      var e = eebEstE(l.d);
      if(e){ eP += l.P; eQ += l.Q; }
      if(l.cascade){
        var c = res[l.cascade].mot.ne;
        dolNP += c.dolP; dolNQ += c.dolQ;
        if(e){ dolEP += c.dolP; dolEQ += c.dolQ; }
      } else if(eebEstDol(l.d)){
        dolNP += l.P; dolNQ += l.Q;
        if(e){ dolEP += l.P; dolEQ += l.Q; }
      }
    });
    var pertes = (prm.pertes || []);
    var pP = 0, pQ = 0; pertes.forEach(function(x){ pP += eebNum(x.p); pQ += eebNum(x.q); });
    var kfN = (prm.kfN === null || prm.kfN === undefined || prm.kfN === '') ? 1 : Number(prm.kfN);
    var kfS = (prm.kfS === null || prm.kfS === undefined || prm.kfS === '') ? 1 : Number(prm.kfS);
    var krN = (prm.krN === null || prm.krN === undefined || prm.krN === '') ? 1 : Number(prm.krN);
    var krS = (prm.krS === null || prm.krS === undefined || prm.krS === '') ? 1 : Number(prm.krS);
    function bloc(tp, tq, kf, kr){
      var P = tp * kf * kr, Q = tq * kf * kr, S = eebS(P, Q);
      return {tabP: tp, tabQ: tq, kf: kf, kr: kr, P: P, Q: Q, S: S, cos: eebCos(P, S), Psans: tp * kf, Qsans: tq * kf};
    }
    var normal = bloc(sP + pP, sQ + pQ, kfN, krN);
    var secours = bloc(eP, eQ, kfS, krS);
    var transfo = (prm.transfo === null || prm.transfo === undefined || prm.transfo === '') ? null : Number(prm.transfo);
    var reserve = (transfo && isFinite(transfo)) ? 1 - normal.S/transfo : null;
    function motc(totP, totQ, dolP, dolQ){
      var nP = totP - dolP, nQ = totQ - dolQ;
      var sd = eebS(dolP, dolQ), sn = eebS(nP, nQ), sTot = eebS(dolP + nP, dolQ + nQ);
      return {dolP: dolP, dolQ: dolQ, dolS: sd, normP: nP, normQ: nQ, normS: sn, totP: dolP + nP, totQ: dolQ + nQ, totS: sTot,
              pct: sTot ? sd/sTot : null};
    }
    res[s.cle] = {cle: s.cle, titre: s.titre, cascSans: !!prm.cascSans, lignes: lignes, pertes: {P: pP, Q: pQ}, normal: normal, secours: secours,
      transfo: transfo, reserve: reserve,
      mot: {ne: motc(sP, sQ, dolNP, dolNQ), e: motc(eP, eQ, dolEP, dolEQ)}};
  }
  return res;
}

/* ---------- document par tableau ---------- */
var EEB_UI = {projetId:'', vue:'recap'};
var EEB_CACHE = {};
var EEB_CHAINE = {};

function eebDocDe(projetId, cle){
  var s = (STATE.etudeBilanTableaux||[]).filter(function(d){ return projetIdDe(d) === projetId && d.tableauCle === cle; })[0] || null;
  var k = projetId + '|' + cle, c = EEB_CACHE[k] || null;
  if(s && (!c || c.id !== s.id || String(s.updatedAt||s.createdAt||'') >= String(c.updatedAt||c.createdAt||''))){ EEB_CACHE[k] = c = s; }
  return c || s;
}
function eebParams(projetId, sections){
  var m = {};
  sections.forEach(function(s){
    if(!s.cle) return;
    var d = eebDocDe(projetId, s.cle) || {};
    m[s.cle] = {kfN: d.kFoisNormal, kfS: d.kFoisSecours, krN: d.kReserveNormal, krS: d.kReserveSecours, cascSans: d.cascadeSansReserve === true || d.cascadeSansReserve === 'sans', transfo: d.puissanceTransfo, pertes: d.pertes || []};
  });
  return m;
}
function eebEntete(projet, doc){
  var def = {affaire: projet ? (projetNumeroDe(projet) || '') : '', compte: '', codeDoc: '', revision: '0', dateDoc: todayISO()};
  var ent = {};
  Object.keys(def).forEach(function(k){ ent[k] = (doc && doc[k] !== undefined && doc[k] !== null && doc[k] !== '') ? doc[k] : def[k]; });
  return ent;
}
function eebSauver(projet, sec, fabriquerPatch){
  var k = projet.id + '|' + sec.cle;
  var suite = (EEB_CHAINE[k] || Promise.resolve()).then(function(){
    var doc = eebDocDe(projet.id, sec.cle);
    var patch = fabriquerPatch(doc);
    if(doc){
      patch.updatedAt = nowISO();
      return STATE.db.doc('etudeBilanTableaux/'+doc.id).update(patch).then(function(){ EEB_CACHE[k] = Object.assign({}, doc, patch); });
    }
    var nouveau = Object.assign(champsProjet(projet), {clientId: projet.clientId || null, clientNom: projet.clientNom || null,
      tableauCle: sec.cle, tableau: sec.titre, pertes: [], createdAt: nowISO(), creePar: currentUserName()}, eebEntete(projet, null), patch);
    return STATE.db.collection('etudeBilanTableaux').add(nouveau).then(function(ref){ EEB_CACHE[k] = Object.assign({id: ref && ref.id}, nouveau); });
  });
  EEB_CHAINE[k] = suite.catch(function(){});
  return suite;
}
function eebApresSauvegarde(p){
  return p.then(function(){ if(typeof scheduleRender === 'function') scheduleRender(); })
    .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); });
}


/* ---------- choix d'un transformateur dans la base materiel (V3.09) ---------- */
function eebTransfosBase(){
  return (typeof emtLignesTransfos === 'function') ? emtLignesTransfos() : [];
}
function eebTransfoParCode(code){
  if(!code) return null;
  return eebTransfosBase().filter(function(t){ return t.code === code; })[0] || null;
}
/* Puissance a retenir pour la reserve : la plus elevee des puissances (ONAF si elle existe, sinon ONAN), en kVA. */
function eebTransfoKva(t){
  var c = emtCalc(t, emtParams()), mva = c.onafNA ? emtNum(t.sOnan) : c.sOnaf;
  return (mva === null || mva === undefined) ? null : mva * 1000;
}
function eebTransfoLibelle(t){
  var c = emtCalc(t, emtParams()), on = emtNum(t.sOnan);
  function pw(mva){
    if(mva === null || mva === undefined) return '?';
    return mva < 1 ? Math.round(mva * 1000).toLocaleString('fr-FR', {useGrouping:false})+' kVA' : mva.toLocaleString('fr-FR', {maximumFractionDigits:3, useGrouping:false})+' MVA';
  }
  return t.code+'  —  '+pw(on)+' ONAN, '+(c.onafNA ? 'sans ONAF' : 'ONAF '+pw(c.sOnaf))+', uk '+emtF(emtNum(t.uk), 1)+' %';
}
/* Pertes (P kW, Q kvar) d'un transformateur charge a l'aide de la charge s0 (kVA) repartie entre n transformateurs :
   P = P0 + l^2 * Pk ; Q = Q0 + l^2 * Qk ; l = s0 / (n * Sr), Sr = puissance ONAN (base de uk, Pk, P0). */
function eebPertesTransfo(t, s0Kva, n){
  var P = emtParams(), c = emtCalc(t, P), sr = (emtNum(t.sOnan) || 0) * 1000;
  if(!sr || c.pkRet === null || c.p0Ret === null) return null;
  var l = s0Kva / (Math.max(1, n || 1) * sr);
  var q0 = Math.sqrt(Math.max(0, Math.pow(c.i0 / 100 * sr, 2) - c.p0Ret * c.p0Ret));
  var qk = (c.ux === null) ? 0 : sr * c.ux / 100;
  return {l: l, p: c.p0Ret + l * l * c.pkRet, q: q0 + l * l * qk, p0: c.p0Ret, pk: c.pkRet, q0: q0, qk: qk};
}

/* ---------- affichage ---------- */
function eebF(v, dec){
  if(v===null || v===undefined || v==='' || (typeof v === 'number' && !isFinite(v))) return '';
  return Number(v).toLocaleString('fr-FR', {minimumFractionDigits: dec===undefined?2:dec, maximumFractionDigits: dec===undefined?2:dec, useGrouping:false});
}
var EEB_COLS = [
  {t:'Repère', v:function(d){ return d.tag; }},
  {t:'Désignation', v:function(d){ return d.nom; }},
  {t:'E/NE', v:function(d){ return d.eNe; }},
  {t:'% E', v:function(d){ return d.pctE; }, n:2},
  {t:'Type', v:function(d){ return d.typeConso; }},
  {t:'Service I/C', v:function(d){ return d.ci; }},
  {t:'W/S', v:function(d){ return d.ws; }},
  {t:'Puissance Apparente Unitaire (KVA)', v:function(d){ return d.puissanceApparente; }, n:2},
  {t:'Puissance Installée', v:function(d){ return eelPuissanceInstallee(d); }},
  {t:'Rendement', v:function(d){ return d.rend; }, n:2},
  {t:'Puissance active (kw)', v:function(d){ return d.pActive; }, n:2},
  {t:'Nombre', v:function(d){ return d.nombre; }, n:0},
  {t:'Cos ϕ', v:function(d){ return d.cosPhi; }, n:2},
  {t:'Puissance Réactive Unitaire (kvar)', v:function(d){ return d.pReactive; }, n:2},
  {t:'K.Util', v:function(d){ return d.kUtil; }, n:2},
  {t:'K.Simul', v:function(d){ return d.kSimul; }, n:2},
  {t:'Puissance Active Foisonée (kw)', fois:'P'},
  {t:'Puissance Réactive Foisonée (kvar)', fois:'Q'},
  {t:'Alimentation', v:function(d){ return eelAlimentation(d); }},
  {t:'Départ type', v:function(d, l){ return l.cascade ? '' : d.specialReqts; }}
];

function eebStyleOnce(){
  if(byId('eeb-style')) return;
  var st = document.createElement('style'); st.id = 'eeb-style';
  st.textContent =
    '.eeb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:14px 0;}'+
    '.eeb-card{border:1px solid var(--border,#d0d5db);border-radius:8px;background:var(--surface,#fff);padding:10px 12px;}'+
    '.eeb-card h4{margin:0 0 8px;font-size:13.5px;}'+
    '.eeb-kv{width:100%;border-collapse:collapse;font-size:12.5px;} .eeb-kv td{padding:3px 4px;border-bottom:1px solid var(--border-soft,#eceff2);} .eeb-kv td.v{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}'+
    '.eeb-kv input{width:84px;text-align:right;font:inherit;padding:2px 4px;} .eeb-pert input.n{width:120px;text-align:left;}'+
    '.eeb-casc td{background:#fff2cc !important;} .eeb-lien{cursor:pointer;color:var(--primary,#1f3a5f);text-decoration:underline;}';
  document.head.appendChild(st);
}

function renderEtudeBilan(mount, actions){
  eeStyleOnce(); eelStyleOnce(); eebStyleOnce();
  var canEdit = canWrite('etude_elec');
  var projets = eeProjetsDe();
  if(!projets.length){
    mount.innerHTML = emptyState('ruler', 'Aucun contrat ni devis enregistré. Le bilan de puissance se rattache à un contrat ou à un devis.');
    return;
  }
  if(!EEB_UI.projetId || !projets.some(function(p){ return p.id === EEB_UI.projetId; })){
    var avec = projets.filter(function(p){ return (STATE.etudeConsommateurs||[]).some(function(d){ return projetIdDe(d) === p.id; }); })[0];
    EEB_UI.projetId = (avec || projets[0]).id; EEB_UI.vue = 'recap';
  }
  var projet = projetParId(EEB_UI.projetId);
  var toutes = eeLignesDuProjet(EEB_UI.projetId);
  var sections = eeSectionsAmontAval(toutes);
  var tableaux = sections.filter(function(s){ return s.cle; });
  var res = eeBilanCalculer(sections, eebParams(EEB_UI.projetId, sections));
  if(EEB_UI.vue !== 'recap' && !res[EEB_UI.vue]) EEB_UI.vue = 'recap';

  actions.innerHTML = '<button type="button" class="btn btn-primary" id="eeb-export" '+(tableaux.length?'':'disabled')+'>'+ic('download',15)+' Exporter Excel</button>';
  var opts = '<option value="recap"'+(EEB_UI.vue==='recap'?' selected':'')+'>Récap puissance (tous les tableaux)</option>'+
    tableaux.map(function(s){ return '<option value="'+esc(s.cle)+'"'+(EEB_UI.vue===s.cle?' selected':'')+'>'+'&nbsp;&nbsp;'.repeat(0)+esc(s.titre)+'</option>'; }).join('');

  var corps;
  if(!tableaux.length){
    corps = emptyState('ruler', 'Aucun tableau (Switchgear / MCC) dans la base de données de ce contrat / devis.', '<p class="hint">Renseignez la colonne « Switchgear / MCC » des consommateurs dans « Base de données ».</p>');
  } else if(EEB_UI.vue === 'recap'){
    corps = eebRecapHtml(tableaux, res);
  } else {
    corps = eebTableauHtml(projet, sections.filter(function(s){ return s.cle === EEB_UI.vue; })[0], res[EEB_UI.vue], canEdit, res);
  }
  mount.innerHTML =
    '<div class="section-head"><div class="toolbar"><select id="eeb-projet" title="Contrat ou devis">'+projetsOptionsHtml(EEB_UI.projetId, null, '', true)+'</select>'+
      '<select id="eeb-vue" title="Tableau">'+opts+'</select></div></div>'+
    '<p class="hint" style="margin:-4px 0 10px;">Bilan de puissance de '+esc(projet ? projetLibelle(projet) : '')+' : '+tableaux.length+' tableau(x), calculé depuis la base de données. '+
      'Un départ qui alimente un autre tableau reprend automatiquement la puissance totale de ce tableau (cellule jaune). '+
      (canEdit ? 'Saisissez ici l’en-tête, les K.Foisonnement, les coefficients de réserve, la puissance du transformateur et les pertes.' : 'Consultation seule.')+'</p>'+corps;

  byId('eeb-projet').addEventListener('change', function(e){ EEB_UI.projetId = e.target.value; EEB_UI.vue = 'recap'; renderEtudeBilan(mount, actions); });
  byId('eeb-vue').addEventListener('change', function(e){ EEB_UI.vue = e.target.value; renderEtudeBilan(mount, actions); });
  byId('eeb-export').addEventListener('click', function(){ eebExporter(projet, toutes, sections, res); });
  mount.querySelectorAll('.eeb-lien').forEach(function(a){ a.addEventListener('click', function(){ EEB_UI.vue = a.getAttribute('data-cle'); renderEtudeBilan(mount, actions); }); });
  if(tableaux.length && EEB_UI.vue !== 'recap' && canEdit) eebLier(mount, projet, sections.filter(function(s){ return s.cle === EEB_UI.vue; })[0]);
}

function eebRecapHtml(tableaux, res){
  var th = ['Tableau','Puissance Active Foisonée (kw)','Puissance Réactive Foisonée (kvar)','S (kva)','K.Foisonnement','Coef. de réserve','S foisonnée avec réserve (kva)','Cos ϕ','Puissance Transfo (kVA)','Réserve réelle']
    .map(function(t){ return '<th>'+esc(t)+'</th>'; }).join('');
  var trs = tableaux.map(function(s){
    var r = res[s.cle], n = r.normal;
    var S0 = eebS(n.tabP, n.tabQ);
    return '<tr><td><a class="eeb-lien" data-cle="'+esc(s.cle)+'">'+esc(s.titre)+'</a></td>'+
      '<td class="eel-num">'+eebF(n.tabP)+'</td><td class="eel-num">'+eebF(n.tabQ)+'</td><td class="eel-num">'+eebF(S0)+'</td>'+
      '<td class="eel-num">'+eebF(n.kf)+'</td><td class="eel-num">'+eebF(n.kr)+'</td><td class="eel-num">'+eebF(n.S)+'</td><td class="eel-num">'+eebF(eebCos(n.tabP, S0), 3)+'</td>'+
      '<td class="eel-num">'+eebF(r.transfo, 0)+'</td><td class="eel-num">'+(r.reserve===null ? '' : eebF(r.reserve*100, 1)+' %')+'</td></tr>';
  }).join('');
  return '<div class="eel-wrap"><table class="eel-table"><thead><tr>'+th+'</tr></thead><tbody>'+trs+'</tbody></table></div>';
}

function eebTableauHtml(projet, sec, r, canEdit, res){
  var doc = eebDocDe(projet.id, sec.cle);
  var ent = eebEntete(projet, doc);
  var champs = [['affaire','Affaire',''],['compte','Compte',''],['codeDoc','Code doc.',''],['revision','Révision',''],['dateDoc','Date','date']];
  var enteteHtml = '<div class="eel-entete">'+champs.map(function(c){
    return '<div class="field" style="margin:0;"><label>'+c[1]+'</label><input class="eeb-h" data-k="'+c[0]+'" type="'+(c[2]||'text')+'" value="'+esc(ent[c[0]])+'"'+(canEdit?'':' disabled')+'></div>';
  }).join('')+'</div>';
  var ths = EEB_COLS.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('');
  var trs = r.lignes.map(function(l){
    var tds = EEB_COLS.map(function(c){
      var v, num = false;
      if(c.fois){ v = eebF(c.fois === 'P' ? l.P : l.Q); num = true; }
      else { var x = c.v(l.d, l); if(c.n !== undefined && !eelVide(x) && !isNaN(Number(x))){ v = eebF(x, c.n); num = true; } else v = eelVide(x) ? '' : String(x); }
      return '<td'+(num?' class="eel-num"':'')+'>'+esc(v)+'</td>';
    }).join('');
    return '<tr'+(l.cascade ? ' class="eeb-casc" title="Reprend le total du tableau aval '+esc(res[l.cascade].titre)+'"' : '')+'>'+tds+'</tr>';
  }).join('');
  var n = r.normal, sc = r.secours;
  function kv(rows){ return '<table class="eeb-kv">'+rows.map(function(x){ return '<tr><td>'+x[0]+'</td><td class="v">'+x[1]+'</td>'+(x[2]!==undefined?'<td class="v">'+x[2]+'</td>':'')+'</tr>'; }).join('')+'</table>'; }
  function inp(id, val){ return canEdit ? '<input id="'+id+'" value="'+esc(val===null||val===undefined?'':String(val).replace('.', ','))+'">' : esc(eebF(val)); }
  var cascSel = '';
  if(sec.departId){
    var sansR = !!r.cascSans;
    cascSel = canEdit ? '<select id="eeb-casc" title="Total repris par le tableau amont"><option value="avec"'+(sansR?'':' selected')+'>avec le coefficient de réserve</option><option value="sans"'+(sansR?' selected':'')+'>sans le coefficient de réserve</option></select>' : (sansR ? 'sans' : 'avec')+' le coefficient de réserve';
  }
  function blocHtml(titre, b, idK, idR, avecCasc){
    return '<div class="eeb-card"><h4>'+titre+'</h4>'+kv([
      ['Total tableau (kW, kvar)', eebF(b.tabP), eebF(b.tabQ)],
      ['K.Foisonnement', inp(idK, b.kf)],
      ['Coefficient de réserve', inp(idR, b.kr)],
      ['Puissance totale (kW, kvar)', eebF(b.P), eebF(b.Q)],
      ['Puissance totale (kVA)', eebF(b.S)],
      ['Cos ϕ', eebF(b.cos, 3)]].concat(avecCasc && cascSel ? [['Total repris par le tableau amont', cascSel]] : []))+'</div>';
  }
  var pertes = (doc && doc.pertes) || [];
  var pertesHtml = '<div class="eeb-card eeb-pert"><h4>Pertes des transformateurs</h4><table class="eeb-kv"><tr><td></td><td class="v">P (kW)</td><td class="v">Q (kvar)</td><td></td></tr>'+
    pertes.map(function(p, i){
      return '<tr data-i="'+i+'"><td>'+(canEdit?'<input class="n eeb-p-nom" value="'+esc(p.nom||'')+'">':esc(p.nom||''))+'</td>'+
        '<td class="v">'+(canEdit?'<input class="eeb-p-p" value="'+esc(p.p===null||p.p===undefined?'':String(p.p).replace('.', ','))+'">':esc(eebF(p.p)))+'</td>'+
        '<td class="v">'+(canEdit?'<input class="eeb-p-q" value="'+esc(p.q===null||p.q===undefined?'':String(p.q).replace('.', ','))+'">':esc(eebF(p.q)))+'</td>'+
        '<td>'+(canEdit?'<button type="button" class="iconbtn eeb-p-del" title="Retirer">'+ic('x',12)+'</button>':'')+'</td></tr>';
    }).join('')+
    '<tr><td><b>Total pertes</b></td><td class="v"><b>'+eebF(r.pertes.P)+'</b></td><td class="v"><b>'+eebF(r.pertes.Q)+'</b></td><td></td></tr></table>'+
    (canEdit ? '<p style="margin:8px 0 0;"><button type="button" class="btn" id="eeb-p-add">'+ic('plus',13)+' Ajouter une perte</button></p>' : '')+'</div>';
  var codeTr = doc && doc.transfoCode ? String(doc.transfoCode) : '';
  var trBase = eebTransfoParCode(codeTr), listeTr = eebTransfosBase();
  var nbTr = (doc && doc.transfoNb) ? Number(doc.transfoNb) : 1;
  var groupes = {}, ordreG = [];
  listeTr.forEach(function(t){ var g = (t.tensionPrimaire === null || t.tensionPrimaire === undefined ? '?' : t.tensionPrimaire)+' / '+(t.tensionSecondaire === null || t.tensionSecondaire === undefined ? '?' : String(t.tensionSecondaire).replace('.', ','))+' kV';
    if(!groupes[g]){ groupes[g] = []; ordreG.push(g); } groupes[g].push(t); });
  var selTr = canEdit ? '<select id="eeb-trsel" style="max-width:100%;"><option value="">— Saisie manuelle —</option>'+
      ordreG.map(function(g){ return '<optgroup label="'+esc(g)+'">'+groupes[g].map(function(t){
        return '<option value="'+esc(t.code)+'"'+(t.code === codeTr ? ' selected' : '')+'>'+esc(eebTransfoLibelle(t))+'</option>'; }).join('')+'</optgroup>'; }).join('')+
      (codeTr && !trBase ? '<option value="'+esc(codeTr)+'" selected>'+esc(codeTr)+' (absent de la base)</option>' : '')+'</select>' : esc(codeTr || '—');
  var infoTr = '';
  if(codeTr && !trBase) infoTr = '<p class="hint" style="margin:6px 0 0;color:#b45309;">Ce transformateur n’existe plus dans la base matériel ; la puissance saisie est conservée.</p>';
  else if(trBase){
    var ct = emtCalc(trBase, emtParams());
    infoTr = '<p class="hint" style="margin:6px 0 0;">'+esc(trBase.statut || 'estimé')+' — uk '+emtF(emtNum(trBase.uk), 2)+' % ; Pk '+emtF(ct.pkRet, 2)+' kW ; P0 '+emtF(ct.p0Ret, 2)+' kW ; I0 '+emtF(ct.i0, 2)+' % ; '+
      (ct.onafNA ? 'pas de ventilation (ONAF non applicable)' : 'ONAF '+emtF(ct.sOnaf, 3)+' MVA')+'. Valeurs à confirmer (ONEE / constructeur) quand elles sont estimées.</p>';
  }
  var s0Tr = Math.sqrt(Math.pow((r.normal.tabP - r.pertes.P) * r.normal.kf, 2) + Math.pow((r.normal.tabQ - r.pertes.Q) * r.normal.kf, 2));
  var transfoHtml = '<div class="eeb-card"><h4>Transformateur et réserve</h4>'+kv([
    ['Transformateur de la base matériel', selTr],
    ['Nombre de transformateurs (partage de la charge)', inp('eeb-trnb', nbTr)],
    ['Puissance Transfo (kVA)', inp('eeb-transfo', r.transfo)],
    ['Réserve réelle (1 − S / transfo)', r.reserve===null ? '' : eebF(r.reserve*100, 1)+' %']])+infoTr+
    (canEdit && trBase ? '<p style="margin:8px 0 0;"><button type="button" class="btn" id="eeb-trpertes" data-s0="'+s0Tr+'" title="Pertes à la charge actuelle du tableau (hors pertes), partagée entre les transformateurs">'+ic('plus',13)+' Insérer les pertes calculées</button></p>' : '')+'</div>';
  var m = r.mot;
  var motHtml = '<div class="eeb-card"><h4>Charges motrices (DOL) / normales (hors pertes)</h4><table class="eeb-kv"><tr><td></td><td class="v">NE</td><td class="v">E</td></tr>'+
    [['Motrices P (kW)', m.ne.dolP, m.e.dolP], ['Motrices Q (kvar)', m.ne.dolQ, m.e.dolQ], ['Motrices S (kVA)', m.ne.dolS, m.e.dolS],
     ['Normales P (kW)', m.ne.normP, m.e.normP], ['Normales Q (kvar)', m.ne.normQ, m.e.normQ], ['Normales S (kVA)', m.ne.normS, m.e.normS],
     ['Totale P (kW)', m.ne.totP, m.e.totP], ['Totale Q (kvar)', m.ne.totQ, m.e.totQ], ['Totale S (kVA)', m.ne.totS, m.e.totS]].map(function(x){
      return '<tr><td>'+x[0]+'</td><td class="v">'+eebF(x[1])+'</td><td class="v">'+eebF(x[2])+'</td></tr>'; }).join('')+
    '<tr><td>Part des charges motrices</td><td class="v">'+(m.ne.pct===null?'':eebF(m.ne.pct*100,1)+' %')+'</td><td class="v">'+(m.e.pct===null?'':eebF(m.e.pct*100,1)+' %')+'</td></tr></table></div>';
  return '<h3 style="margin:0 0 8px;">Switchgear / MCC : '+esc(sec.titre)+(sec.amont ? ' <span class="muted" style="font-size:12px;font-weight:400;">alimenté depuis '+esc(sec.amont)+'</span>' : '')+'</h3>'+enteteHtml+
    '<div class="eel-wrap"><table class="eel-table"><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table></div>'+
    '<div class="eeb-grid">'+blocHtml('Bilan source normale', n, 'eeb-kfn', 'eeb-krn', true)+blocHtml('Bilan source secours (lignes E)', sc, 'eeb-kfs', 'eeb-krs', false)+transfoHtml+pertesHtml+motHtml+'</div>';
}

function eebLier(mount, projet, sec){
  function num(v){ var x = eeParseNum(v); return x; }
  mount.querySelectorAll('.eeb-h').forEach(function(i){ i.addEventListener('change', function(){
    var k = i.getAttribute('data-k'), v = i.value;
    eebApresSauvegarde(eebSauver(projet, sec, function(){ var p = {}; p[k] = v; return p; }));
  }); });
  function champNum(id, cle, positif){
    var el = byId(id); if(!el) return;
    el.addEventListener('change', function(){
      var x = num(el.value);
      if(x !== null && isNaN(x)){ toast('Valeur numérique attendue', 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); return; }
      if(positif && x !== null && x <= 0){ toast('Le coefficient doit être supérieur à 0', 'danger'); if(typeof scheduleRender === 'function') scheduleRender(); return; }
      eebApresSauvegarde(eebSauver(projet, sec, function(){ var p = {}; p[cle] = x; return p; }));
    });
  }
  champNum('eeb-kfn', 'kFoisNormal'); champNum('eeb-kfs', 'kFoisSecours'); champNum('eeb-krn', 'kReserveNormal', true); champNum('eeb-krs', 'kReserveSecours', true);
  var cs = byId('eeb-casc');
  if(cs) cs.addEventListener('change', function(){ var v = cs.value === 'sans'; eebApresSauvegarde(eebSauver(projet, sec, function(){ return {cascadeSansReserve: v}; })); }); champNum('eeb-transfo', 'puissanceTransfo');
  champNum('eeb-trnb', 'transfoNb');
  var selTr = byId('eeb-trsel');
  if(selTr) selTr.addEventListener('change', function(){
    var code = selTr.value, t = eebTransfoParCode(code);
    eebApresSauvegarde(eebSauver(projet, sec, function(){
      var p = {transfoCode: code || null};
      if(t){ var kva = eebTransfoKva(t); if(kva !== null) p.puissanceTransfo = Math.round(kva * 1000) / 1000; }
      return p;
    }));
  });
  var bp = byId('eeb-trpertes');
  if(bp) bp.addEventListener('click', function(){
    var doc = eebDocDe(projet.id, sec.cle) || {}, t = eebTransfoParCode(doc.transfoCode), n = Math.max(1, Math.round(Number(doc.transfoNb) || 1));
    if(!t){ toast('Choisissez d’abord un transformateur de la base', 'danger'); return; }
    var pe = eebPertesTransfo(t, Number(bp.getAttribute('data-s0')) || 0, n);
    if(!pe){ toast('Pk / P0 manquants pour ce transformateur', 'danger'); return; }
    var lignes = []; for(var i = 1; i <= n; i++) lignes.push({nom: t.code+(n > 1 ? ' ('+i+'/'+n+')' : '')+', charge '+eebF(pe.l * 100, 0)+' %', p: Math.round(pe.p * 1000) / 1000, q: Math.round(pe.q * 1000) / 1000});
    function appliquer(){ eebApresSauvegarde(eebSauver(projet, sec, function(){ return {pertes: lignes}; })); }
    var existantes = (doc.pertes || []).length;
    if(!existantes){ appliquer(); return; }
    confirmDialog('Remplacer les '+existantes+' ligne(s) de pertes existantes par les pertes calculées du transformateur ?', {okLabel: 'Remplacer'}).then(function(ok){ if(ok) appliquer(); });
  });
  function lirePertes(){
    return Array.prototype.map.call(mount.querySelectorAll('.eeb-pert tr[data-i]'), function(tr){
      var p = eeParseNum(tr.querySelector('.eeb-p-p').value), q = eeParseNum(tr.querySelector('.eeb-p-q').value);
      return {nom: tr.querySelector('.eeb-p-nom').value.trim(), p: (p===null||isNaN(p)) ? null : p, q: (q===null||isNaN(q)) ? null : q};
    });
  }
  mount.querySelectorAll('.eeb-pert input').forEach(function(i){ i.addEventListener('change', function(){
    var l = lirePertes(); eebApresSauvegarde(eebSauver(projet, sec, function(){ return {pertes: l}; }));
  }); });
  mount.querySelectorAll('.eeb-p-del').forEach(function(b){ b.addEventListener('click', function(){
    var i = Number(b.closest('tr').getAttribute('data-i')), l = lirePertes(); l.splice(i, 1);
    eebApresSauvegarde(eebSauver(projet, sec, function(){ return {pertes: l}; }));
  }); });
  var add = byId('eeb-p-add');
  if(add) add.addEventListener('click', function(){
    var l = lirePertes(); l.push({nom: 'Pertes_TR'+(l.length+1), p: null, q: null});
    eebApresSauvegarde(eebSauver(projet, sec, function(){ return {pertes: l}; }));
  });
}

/* ---------- export Excel ---------- */
function eebExporter(projet, toutes, sections, res){
  var spec = eeSpecExport(projet, toutes, false);
  spec.filename = 'Bilan_de_puissance_'+(projet ? projetNumeroDe(projet) || projet.numero : '')+'_'+todayISO().replace(/-/g,'')+'.xlsx';
  spec.bilan = {tableaux: sections.filter(function(s){ return s.cle; }).map(function(s){
    var doc = eebDocDe(projet.id, s.cle), ent = eebEntete(projet, doc), r = res[s.cle];
    return {cle: s.cle, titre: s.titre,
      header: {affaire: ent.affaire, compte: ent.compte, codeDoc: ent.codeDoc, revision: ent.revision, date: ent.dateDoc},
      kfN: doc ? doc.kFoisNormal : null, kfS: doc ? doc.kFoisSecours : null, krN: doc ? doc.kReserveNormal : null, krS: doc ? doc.kReserveSecours : null, cascSans: !!r.cascSans, transfo: doc ? doc.puissanceTransfo : null, transfoCode: doc ? (doc.transfoCode || '') : '',
      pertes: ((doc && doc.pertes) || []).map(function(p){ return {nom: p.nom || '', p: p.p, q: p.q}; }),
      lignes: r.lignes.map(function(l){ return {tag: eelTexte(l.d.tag), cascade: l.cascade}; })};
  })};
  toast('Génération du fichier Excel…');
  fetch('/api/etude-elec/export-bilan', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(spec)})
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

if(typeof module !== 'undefined' && module.exports){ module.exports = {eeBilanCalculer: eeBilanCalculer}; }
