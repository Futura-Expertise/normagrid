import json, urllib.request
B='http://127.0.0.1:5380/api/'
def call(m,u,b=None):
    r=urllib.request.Request(B+u,data=json.dumps(b).encode() if b is not None else None,method=m,headers={'Content-Type':'application/json'})
    try:
        x=urllib.request.urlopen(r); t=x.read(); return x.status,(json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t=e.read()
        try: return e.code,json.loads(t)
        except Exception: return e.code,t
ok=fail=0
def chk(label,cond):
    global ok,fail
    print(('OK   ' if cond else 'FAIL ')+label); ok+=cond; fail+=(not cond)
s,d=call('GET','modules'); mods={m['id']:m for m in d['modules']}
chk('9 modules dont planification et etude_electrique', len(mods)==9 and 'planification' in mods and 'etude_electrique' in mods)
chk('planification requiert livrables', [r['id'] for r in mods['planification']['requiert']]==['livrables'])
chk('tous actifs au depart', all(m['actif'] for m in mods.values()))
s,a=call('GET','auth/access-matrix'); mat=a['access']
chk('sections planification + timesheet dans la matrice', 'planification' in mat and 'timesheet' in mat)
chk('droits identiques a livrables au depart', mat['planification']==mat['livrables']==mat['timesheet'])
s,r=call('GET','collection/planificationLignes'); chk('lecture planificationLignes (module actif) 200', s==200)
s,r=call('GET','collection/timesheetLignes'); chk('lecture timesheetLignes (module actif) 200', s==200)
# desactiver Contrat -> cascade
s,r=call('POST','modules',{'modulesActifs':{'contrat':False}}); 
mods={m['id']:m for m in r['modules']}
chk('desactiver Contrat inactive Livrables, Planification, Facturation', all(not mods[x]['actif'] for x in ('livrables','planification','facturation')) and mods['commercial']['actif'])
chk('Planification non decochee explicitement (cascade)', not mods['planification']['decoche'] and mods['contrat']['decoche'])
s,r=call('GET','collection/planificationLignes'); chk('planificationLignes ferme quand Contrat inactif (404)', s==404)
s,r=call('PUT','doc/timesheetLignes/x1',{'a':1}); chk('ecriture timesheetLignes refusee (404)', s==404)
s,r=call('POST','modules',{'modulesActifs':{'planification':True}}); chk('activer Planification sans Contrat refuse (400)', s==400 and 'Livrables' in str(r))
s,r=call('POST','modules',{'modulesActifs':{'contrat':True}}); mods={m['id']:m for m in r['modules']}
chk('reactiver Contrat reactive tout', all(m['actif'] for m in mods.values()))
# desactiver seulement Planification : Livrables reste
s,r=call('POST','modules',{'modulesActifs':{'planification':False}}); mods={m['id']:m for m in r['modules']}
chk('desactiver Planification seule : Livrables actif', mods['livrables']['actif'] and not mods['planification']['actif'])
s,r=call('GET','collection/livrables'); chk('livrables toujours lisible (200)', s==200)
s,r=call('GET','collection/planificationLignes'); chk('planificationLignes ferme (404)', s==404)
s,r=call('GET','personnel-light'); chk('personnel-light reste sous Livrables (200)', s==200)
call('POST','modules',{'modulesActifs':{'planification':True}})
s,d=call('GET','modules'); chk('etat final : tout actif', all(m['actif'] for m in d['modules']))
print('TOTAL %d / %d FAIL: %d'%(ok,ok+fail,fail))
