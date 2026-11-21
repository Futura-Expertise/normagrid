/*
 * Shim "base de donnees locale" reproduisant l'API Firestore-like attendue
 * par app.js (window.claude.use('db') -> db.collection(path) / db.doc(path),
 * avec .add/.get/.set/.update/.delete/.onSnapshot).
 *
 * Cote reseau, il parle a l'API REST generique exposee par le serveur Flask
 * (backend/routes/api.py) : GET/PUT/PATCH/DELETE sur /api/doc/<collection>/<id>
 * et GET sur /api/collection/<nom>. Le "temps reel" de Firestore est assure
 * (V4.2) par un flux Server-Sent Events GET /api/events : le serveur n'envoie
 * un message que lorsqu'une donnee a ete modifiee en base, et le navigateur
 * ne recharge alors que les collections citees. Aucune requete periodique
 * tant que rien ne change. Si le flux est indisponible (proxy qui le coupe,
 * navigateur ancien), repli automatique sur un rafraichissement toutes les
 * 5 s, uniquement pendant la coupure.
 */
(function () {
  'use strict';

  var FALLBACK_MS = 5000, DEBOUNCE_MS = 120;

  function request(method, url, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* reponse non-JSON */ }
        if (!r.ok) {
          var msg = (json && json.error) ? json.error : ('Erreur HTTP ' + r.status);
          var err = new Error(msg);
          // V1.55 : le code HTTP est conserve sur l'erreur pour que l'appelant
          // (voir subscribeCollection dans app.js) distingue une session
          // expiree/absente (401, doit renvoyer vers l'ecran de connexion)
          // d'un simple refus de role (403, juste ignorer silencieusement
          // cette collection) ou d'une vraie panne (le reste).
          err.status = r.status;
          throw err;
        }
        return json;
      });
    });
  }

  function uid() {
    return 'xxxxxxxxxxxxxxxx'.replace(/x/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  }

  function wrapDoc(id, data) {
    return {
      id: id,
      data: function () { return data; }
    };
  }

  /* -------------------- CollectionReference -------------------- */
  function CollectionRef(path) { this.path = path; }

  CollectionRef.prototype.add = function (data) {
    var id = uid();
    return request('PUT', '/api/doc/' + this.path + '/' + id, data).then(function () {
      return { id: id };
    });
  };

  /* -------------------- Flux de modifications (SSE) -------------------- */
  var subs = [], es = null, esOpen = false, readyWaiters = [], fallbackTimer = null;

  function refetch(sub, delay) {
    if (sub.stopped) return;
    if (sub.timer) clearTimeout(sub.timer);
    sub.timer = setTimeout(function () {
      sub.timer = null;
      if (sub.stopped) return;
      if (sub.busy) { sub.again = true; return; }
      sub.busy = true;
      sub.fetch().then(function () {}, function () {}).then(function () {
        sub.busy = false;
        if (sub.again) { sub.again = false; refetch(sub, 0); }
      });
    }, delay === undefined ? DEBOUNCE_MS : delay);
  }
  function refetchAll() { subs.slice().forEach(function (s) { refetch(s, 0); }); }

  function startFallback() {
    if (fallbackTimer || !subs.length) return;
    fallbackTimer = setInterval(function () { if (!esOpen) refetchAll(); }, FALLBACK_MS);
  }
  function stopFallback() { if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; } }
  function flushReady() { var w = readyWaiters; readyWaiters = []; w.forEach(function (f) { f(); }); }

  function ensureStream() {
    if (!window.EventSource) { startFallback(); return; }
    if (es && es.readyState !== 2) return;
    var premiere = !es;
    es = new EventSource('/api/events');
    es.onopen = function () {
      var rouvert = !esOpen && !premiere;
      esOpen = true; stopFallback();
      if (rouvert) refetchAll();       /* rattrape ce qui a pu changer pendant la coupure */
      premiere = false;
      flushReady();
    };
    es.onmessage = function (ev) {
      var d = null;
      try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (!d) return;
      subs.slice().forEach(function (s) {
        if (d.all || (d.c && d.c.indexOf(s.coll) >= 0)) refetch(s);
      });
    };
    es.onerror = function () {
      esOpen = false;
      startFallback();   /* pendant la coupure seulement ; 401 -> remonte par les requetes de repli */
      if (es && es.readyState === 2) setTimeout(function () { if (subs.length) ensureStream(); }, FALLBACK_MS);
    };
  }
  /* promesse resolue des que le flux est ouvert (ou apres 1,5 s au plus) : les premiers
     chargements n'ont lieu qu'apres l'inscription au flux, donc aucune modification n'est ratee. */
  function whenStreamReady() {
    ensureStream();
    return new Promise(function (resolve) {
      if (esOpen || !window.EventSource) { resolve(); return; }
      var done = false, f = function () { if (!done) { done = true; resolve(); } };
      readyWaiters.push(f); setTimeout(f, 1500);
    });
  }
  function closeStreamIfIdle() {
    if (subs.length) return;
    stopFallback();
    if (es) { es.onopen = es.onmessage = es.onerror = null; es.close(); es = null; esOpen = false; }
  }
  function addSub(coll, fetchFn) {
    var sub = { coll: coll, fetch: fetchFn, stopped: false, busy: false, again: false, timer: null };
    subs.push(sub);
    whenStreamReady().then(function () { refetch(sub, 0); });
    return function unsubscribe() {
      sub.stopped = true;
      if (sub.timer) clearTimeout(sub.timer);
      var i = subs.indexOf(sub); if (i >= 0) subs.splice(i, 1);
      closeStreamIfIdle();
    };
  }

  CollectionRef.prototype.onSnapshot = function (onNext, onError) {
    var path = this.path, lastJSON = null;
    return addSub(path, function () {
      return request('GET', '/api/collection/' + path).then(function (list) {
        var json = JSON.stringify(list);
        if (json !== lastJSON) {
          lastJSON = json;
          var docs = list.map(function (row) {
            var copy = Object.assign({}, row);
            delete copy.id;
            return wrapDoc(row.id, copy);
          });
          onNext({ docs: docs });
        }
      }).catch(function (err) {
        if (onError) onError(err);
      });
    });
  };

  /* -------------------- DocumentReference -------------------- */
  function DocRef(path) { this.path = path; }

  DocRef.prototype.get = function () {
    return request('GET', '/api/doc/' + this.path).then(function (res) {
      return { exists: !!(res && res.exists), data: function () { return (res && res.data) || {}; } };
    });
  };

  DocRef.prototype.set = function (data) {
    return request('PUT', '/api/doc/' + this.path, data);
  };

  DocRef.prototype.update = function (patch) {
    return request('PATCH', '/api/doc/' + this.path, patch);
  };

  DocRef.prototype.delete = function () {
    return request('DELETE', '/api/doc/' + this.path);
  };

  /* Incrementation atomique d'un champ numerique (compteur de numerotation
   * transactionnel, cote serveur : voir backend/routes/api.py increment_doc). */
  DocRef.prototype.increment = function (field, step) {
    return request('POST', '/api/increment/' + this.path, { field: field, step: step || 1 }).then(function (res) {
      return res.value;
    });
  };

  DocRef.prototype.onSnapshot = function (onNext, onError) {
    var path = this.path, lastJSON = null;
    return addSub(path.split('/')[0], function () {
      return request('GET', '/api/doc/' + path).then(function (res) {
        var json = JSON.stringify(res);
        if (json !== lastJSON) {
          lastJSON = json;
          onNext({ exists: !!(res && res.exists), data: function () { return (res && res.data) || {}; } });
        }
      }).catch(function (err) {
        if (onError) onError(err);
      });
    });
  };

  /* -------------------- Db -------------------- */
  function Db() {}
  Db.prototype.collection = function (path) { return new CollectionRef(path); };
  Db.prototype.doc = function (path) { return new DocRef(path); };

  window.claude = window.claude || {};
  window.claude.use = function (name) {
    if (name !== 'db') return Promise.resolve(null);
    return request('GET', '/api/ping').then(function () {
      return new Db();
    }).catch(function () {
      return null;
    });
  };
})();
