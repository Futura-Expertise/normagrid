# -*- coding: utf-8 -*-
"""Couche d'accès aux données (V3) : remplace tout accès direct à l'ancienne table « documents ».

Les routes continuent à parler en « collection / id / document JSON » ; ce module traduit vers les tables
relationnelles (voir sql_migration.py). Aucun commit ici : la transaction appartient à l'appelant.
"""
import re
import sqlite3

from backend import sql_migration as sm


class StoreError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _traduire(e):
    msg = str(e)
    if isinstance(e, sm.CollectionInconnue):
        return StoreError("Collection inconnue : %s" % e, 404)
    if isinstance(e, sqlite3.IntegrityError):
        if 'UNIQUE' in msg:
            return StoreError("Enregistrement refusé : cette valeur existe déjà (%s)." % msg.split(':', 1)[-1].strip(), 409)
        if 'FOREIGN KEY' in msg:
            return StoreError("Enregistrement refusé : le document est lié à d'autres documents "
                              "(référence inexistante, ou suppression d'un document encore utilisé).", 409)
        if 'NOT NULL' in msg:
            return StoreError("Enregistrement refusé : un champ obligatoire est vide (%s)." % msg.split(':', 1)[-1].strip(), 400)
        return StoreError("Enregistrement refusé par la base : " + msg, 409)
    if isinstance(e, ValueError):
        return StoreError(msg, 400)
    return None


def _wrap(fn):
    def inner(*a, **k):
        try:
            return fn(*a, **k)
        except StoreError:
            raise
        except Exception as e:  # noqa
            t = _traduire(e)
            if t is None:
                raise
            raise t from e
    inner.__name__ = fn.__name__
    return inner


@_wrap
def get_doc(conn, collection, doc_id):
    return sm.get_doc(conn, collection, doc_id)


@_wrap
def list_docs(conn, collection):
    if collection not in sm.MAIN:
        return []
    return sm.list_docs(conn, collection)


@_wrap
def set_doc(conn, collection, doc_id, doc):
    sm.replace_doc(conn, collection, doc_id, doc)


@_wrap
def merge_doc(conn, collection, doc_id, patch):
    return sm.merge_doc(conn, collection, doc_id, patch)


@_wrap
def delete_doc(conn, collection, doc_id):
    if collection in sm.MAIN:
        sm.delete_doc(conn, collection, doc_id)


@_wrap
def increment(conn, collection, doc_id, field, step=1):
    """Incrémente un champ numérique ; renvoie la nouvelle valeur."""
    spec = sm._spec(collection)
    sp = spec.get('special')
    if sp == 'meta':
        m = re.match(r'^(.+)_(\d{4})$', field)
        if m and doc_id == 'counters':
            conn.execute('INSERT INTO compteurs (type, annee, valeur) VALUES (?,?,?) '
                         'ON CONFLICT(type, annee) DO UPDATE SET valeur = valeur + ?',
                         (m.group(1), int(m.group(2)), step, step))
            return conn.execute('SELECT valeur FROM compteurs WHERE type=? AND annee=?', (m.group(1), int(m.group(2)))).fetchone()[0]
    elif sp is None:
        col = sm.to_col(spec['table'], field)
        if col in sm.cols_of(conn, spec['table']) and col not in ('id', 'extra') and sm.doc_exists(conn, collection, doc_id):
            conn.execute('UPDATE %s SET %s = COALESCE(%s, 0) + ? WHERE id=?' % (spec['table'], col, col), (step, doc_id))
            return conn.execute('SELECT %s FROM %s WHERE id=?' % (col, spec['table']), (doc_id,)).fetchone()[0]
    cur = sm.get_doc(conn, collection, doc_id) or {}
    new_value = int(cur.get(field) or 0) + step
    cur[field] = new_value
    sm.replace_doc(conn, collection, doc_id, cur)
    return new_value
