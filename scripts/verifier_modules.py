# -*- coding: utf-8 -*-
"""Contrôle de cohérence des descriptions de modules (backend/module_defs).
Usage : python3 scripts/verifier_modules.py   (code de sortie 0 = tout est cohérent)"""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from backend.module_defs import DEFS, NOYAU, ORDRE
from backend import access, sql_migration as sm

err = []
ALL = [NOYAU] + [DEFS[m] for m in ORDRE]

# 1. dépendances connues, ordre respecté, pas de boucle
vus = {'noyau'}
for m in ORDRE:
    d = DEFS[m]
    for dep in d['depends'] + d['optional']:
        if dep not in DEFS: err.append('%s : dépendance inconnue %s' % (m, dep))
    for dep in d['depends']:
        if dep not in vus: err.append('%s dépend de %s qui est déclaré après lui (ou en boucle)' % (m, dep))
    vus.add(m)

# 2. tables : chaque table du schéma appartient à exactement un module
schema = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'database', 'schema.sql'), encoding='utf-8').read()
tables = set(re.findall(r'CREATE TABLE (\w+)', schema))
owner = {}
for d in ALL:
    for t in d['tables']:
        if t in owner: err.append('table %s déclarée par %s et %s' % (t, owner[t], d['id']))
        owner[t] = d['id']
for t in sorted(tables - set(owner)): err.append('table sans module : %s' % t)
for t in sorted(set(owner) - tables): err.append('table déclarée mais absente du schéma : %s' % t)

# 3. clés étrangères : vers le noyau, ou un module obligatoire (transitif), ou un module optionnel (liens facultatifs)
def fermeture(mid):
    res, pile = set(), list(DEFS[mid]['depends']) if mid in DEFS else []
    while pile:
        x = pile.pop()
        if x not in res:
            res.add(x); pile += DEFS[x]['depends']
    return res
for b in re.split(r'(?=CREATE TABLE )', schema):
    m = re.match(r'CREATE TABLE (\w+)', b)
    if not m: continue
    t = m.group(1); mod = owner.get(t)
    for ref in set(re.findall(r'REFERENCES (\w+)', b.split(';')[0])) - {t}:
        rm = owner.get(ref)
        if rm in (mod, 'noyau') or rm is None: continue
        if rm in fermeture(mod): continue
        if rm in DEFS[mod]['optional']: continue
        err.append('FK %s (%s) -> %s (%s) : dépendance non déclarée' % (t, mod, ref, rm))

# 4. sections de droits : chaque section d'ACCESS appartient à un seul module (ou au noyau)
sec_owner = {}
for d in ALL:
    for s in d['sections']:
        if s in sec_owner: err.append('section %s déclarée par %s et %s' % (s, sec_owner[s], d['id']))
        sec_owner[s] = d['id']
for s in sorted(set(access.ACCESS) - set(sec_owner)): err.append('section ACCESS sans module : %s' % s)
for s in sorted(set(sec_owner) - set(access.ACCESS)): err.append('section déclarée absente d\'ACCESS : %s' % s)

# 5. collections : chaque collection connue du moteur SQL appartient à un module ; sa section d'accès est celle du module
col_owner = {}
for d in ALL:
    for c in d['collections']:
        if c in col_owner: err.append('collection %s déclarée par %s et %s' % (c, col_owner[c], d['id']))
        col_owner[c] = d['id']
for c in sorted(set(sm.MAIN) - set(col_owner)): err.append('collection sans module : %s' % c)
for c in sorted(set(col_owner) - set(sm.MAIN)): err.append('collection déclarée inconnue du moteur SQL : %s' % c)
for c, mid in col_owner.items():
    sec = access.COLLECTION_SECTION.get(c)
    if sec and sec_owner.get(sec) not in (mid, None) and not (mid == 'noyau' and sec_owner.get(sec) == 'noyau'):
        err.append('collection %s (%s) : sa section de droits %s appartient à %s' % (c, mid, sec, sec_owner.get(sec)))

print('modules : %d + noyau ; tables : %d ; sections : %d ; collections : %d' % (len(ORDRE), len(tables), len(sec_owner), len(col_owner)))
print('\n'.join('ERREUR : ' + e for e in err) if err else 'OK : descriptions de modules cohérentes avec le schéma, les droits et les collections')
sys.exit(1 if err else 0)
