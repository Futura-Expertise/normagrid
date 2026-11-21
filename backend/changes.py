# -*- coding: utf-8 -*-
"""V4.2 : notification des modifications (remplace le polling de 2 s du navigateur).

Principe : chaque connexion SQLite ouverte par l'application (db.get_connection) est une
TrackedConnection. Elle note, via l'autorisateur SQLite, les tables sur lesquelles une
instruction INSERT / UPDATE / DELETE est preparee, et lors du commit (si des lignes ont
reellement change) publie les collections concernees. Le navigateur, abonne au flux
GET /api/events (Server-Sent Events), ne recharge alors que ces collections.

Ce mecanisme ne depend d'AUCUNE route : imports Excel, etude electrique, factures, restauration...
toute ecriture en base est detectee. Une table inconnue declenche par securite une notification
« tout ».  Limite : l'etat est en memoire du processus serveur (un seul processus, plusieurs
threads - cas du lancement standard python app.py / desktop.py).
"""
import collections
import sqlite3
import threading

_cond = threading.Condition()
_seq = 0
_events = collections.deque(maxlen=2000)   # (seq, frozenset(collections) | None = tout)
_table_map = None
_SQLITE_INSERT, _SQLITE_DELETE, _SQLITE_UPDATE = 18, 9, 23


def _build_table_map():
    from backend import sql_migration as sm
    m = collections.defaultdict(set)
    for coll, spec in sm.MAIN.items():
        m[spec['table']].add(coll)
        for ch in spec.get('children', []) or []:
            m[ch['table']].add(coll)
        for t, _fk in sm.SPECIAL_CHILD_TABLES.get(spec.get('special'), []):
            m[t].add(coll)
    # tables lues en plus par certaines collections (voir tests/verif_tables_lues)
    for t, colls in EXTRA_READS.items():
        m[t].update(colls)
    return m


EXTRA_READS = {
    'competences': {'personnel', 'niveauxAttendusStatuts'},
    'personnel_competences_historique': {'personnel'},
    'contrat_segment_valeurs': {'contrats'},
    'niveaux_attendus': {'niveauxAttendusStatuts'},
    'niveaux_attendus_historique': {'niveauxAttendusStatuts'},
    'numerotation_parametres': {'settings'},
    'migrations_faites': {'settings'},
}


def collections_for_tables(tables):
    """Ensemble de collections touchees, ou None (= toutes) si une table n'est pas connue."""
    global _table_map
    if _table_map is None:
        _table_map = _build_table_map()
    out = set()
    for t in tables:
        if t.startswith('sqlite_'):
            continue
        c = _table_map.get(t)
        if c is None:
            return None
        out |= c
    return out


def publish(colls):
    """colls : iterable de noms de collections, ou None pour « tout »."""
    global _seq
    with _cond:
        _seq += 1
        _events.append((_seq, None if colls is None else frozenset(colls)))
        _cond.notify_all()


def bump_all():
    publish(None)


def current_seq():
    with _cond:
        return _seq


def wait_for(since, timeout):
    """Bloque jusqu'a un nouvel evenement (ou timeout). Renvoie (seq, tout, collections)."""
    with _cond:
        if _seq <= since:
            _cond.wait(timeout)
        if _seq <= since:
            return since, False, set()
        tout, colls = False, set()
        for s, c in _events:
            if s > since:
                if c is None:
                    tout = True
                else:
                    colls |= c
        return _seq, tout, colls


class TrackedConnection(sqlite3.Connection):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._tables = set()
        self._publie = 0
        self.set_authorizer(self._autorise)

    def _autorise(self, action, arg1, arg2, dbname, source):
        if action in (_SQLITE_INSERT, _SQLITE_UPDATE, _SQLITE_DELETE) and arg1:
            self._tables.add(arg1)
        return sqlite3.SQLITE_OK

    def _notifier(self):
        if self.total_changes != self._publie:
            self._publie = self.total_changes
            if self._tables:
                publish(collections_for_tables(self._tables))

    def commit(self):
        super().commit()
        self._notifier()

    def executescript(self, script):
        r = super().executescript(script)
        self._notifier()
        return r
