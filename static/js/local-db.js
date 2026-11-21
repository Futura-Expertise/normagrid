/*
 * Shim "base de donnees locale" reproduisant l'API Firestore-like attendue
 * par app.js (window.claude.use('db') -> db.collection(path) / db.doc(path),
 * avec .add/.get/.set/.update/.delete/.onSnapshot).
 *
 * Cote reseau, il parle a l'API REST generique exposee par le serveur Flask
 * (backend/routes/api.py) : GET/PUT/PATCH/DELETE sur /api/doc/<collection>/<id>
 * et GET sur /api/collection/<nom>. Le "temps reel" de Firestore est simule
 * par un polling toutes les 2 secondes (aucune modification n'est perdue,
 * seulement affichee avec un leger delai — suffisant pour un usage
 * mono-poste ou petit reseau local de bureau).
 */
(function () {
  'use strict';

  var POLL_MS = 2000;

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

  CollectionRef.prototype.onSnapshot = function (onNext, onError) {
    var path = this.path;
    var stopped = false;
    var lastJSON = null;

    function poll() {
      if (stopped) return;
      request('GET', '/api/collection/' + path).then(function (list) {
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
      }).then(function () {
        if (!stopped) setTimeout(poll, POLL_MS);
      });
    }
    poll();
    return function unsubscribe() { stopped = true; };
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
    var path = this.path;
    var stopped = false;
    var lastJSON = null;

    function poll() {
      if (stopped) return;
      request('GET', '/api/doc/' + path).then(function (res) {
        var json = JSON.stringify(res);
        if (json !== lastJSON) {
          lastJSON = json;
          onNext({ exists: !!(res && res.exists), data: function () { return (res && res.data) || {}; } });
        }
      }).catch(function (err) {
        if (onError) onError(err);
      }).then(function () {
        if (!stopped) setTimeout(poll, POLL_MS);
      });
    }
    poll();
    return function unsubscribe() { stopped = true; };
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
