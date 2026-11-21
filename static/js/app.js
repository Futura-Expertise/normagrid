'use strict';

/* =========================================================
   CONSTANTES
   ========================================================= */
var ROLES = [
  {id:'admin', label:'Administrateur'},
  {id:'commercial', label:'Commercial'},
  {id:'chantier', label:'Conducteur de travaux'},
  {id:'comptable', label:'Comptable'},
  // V1.85 : nouveau role dedie pour la gestion des competences/formations du
  // personnel (voir claude/module-personnel.md) - acces defini cote serveur
  // dans backend/access.py (sections "personnel"/"competences"/"formations"/
  // "dashboard"), jamais code en dur ici (voir access() plus bas).
  {id:'rh', label:'RH'}
];
// V3.54 : la liste des profils (roles) vient du serveur (Administration > Droits d'acces).
function chargerProfilsRoles(res){
  if(res && Array.isArray(res.profiles) && res.profiles.length){
    ROLES.length = 0;
    res.profiles.forEach(function(p){ ROLES.push({id:p.id, label:p.label}); });
  }
}
function roleLabel(id){ var r=ROLES.find(function(x){return x.id===id;}); return r?r.label:id; }

// V1.55 : cette matrice n'est plus codee en dur ici - elle est recuperee au
// demarrage depuis GET /api/auth/access-matrix (voir chargerAccessMatrix(),
// appelee par bootApp()), qui fait foi cote serveur (backend/access.py,
// enforce_request() : chaque appel API est de toute facon revérifié
// independamment, meme si cette copie cote client etait vide, absente ou
// falsifiee). Objet vide par defaut : tant qu'elle n'est pas chargee,
// canSee()/canWrite() renvoient prudemment "aucun acces" pour tout le
// monde plutot que d'ouvrir quoi que ce soit par defaut.
var ACCESS = {};
function access(section){
  var role = STATE.currentUser ? STATE.currentUser.role : null;
  if(!role) return 'none';
  // V1.60 : "bordereaux" (Carnet d'envois) n'a pas d'entree ACCESS propre -
  // memes droits que Livrables techniques, par construction (voir
  // backend/access.py, COLLECTION_SECTION["bordereaux"]="livrables", et la
  // route STATE.route==='bordereaux' revalidee ici meme par render()).
  if(section === 'bordereaux') section = 'livrables';
  // V1.64 : "backlog" (Backlog de developpement) n'a pas d'entree ACCESS
  // propre - rattache a 'settings' (reserve a l'Administrateur), voir
  // backend/access.py, COLLECTION_SECTION["backlog"]="settings".
  if(section === 'backlog') section = 'settings';
  // V1.65 : "plandecharge" (Plan de charge) n'a pas d'entree ACCESS propre -
  // vue derivee des Livrables techniques (memes personnes affectees/dates
  // planifiees), memes droits qu'eux - voir NAV (accessKey) et
  // backend/access.py (/api/personnel-light rattache a la section 'livrables').
  // V3.01 : le module Planification a ses propres sections de droits (planification, timesheet).
  if(section === 'plandecharge') section = 'planification';
  // V1.71 : "timesheet" (pointage reel) n'a pas d'entree ACCESS propre -
  // memes droits que Livrables techniques, meme principe que plandecharge
  // ci-dessus (voir NAV et backend/access.py,
  // COLLECTION_SECTION["timesheetLignes"]="livrables").
  // V1.87 : l'ecran unique "Compétences" (V1.85/V1.86) est scinde en deux
  // ecrans a la demande de l'utilisateur - "Gestion des compétences"
  // (catalogue : categories + noms de competences) et "Évaluation_Suivi"
  // (matrice d'evaluation des personnes + suivi de l'evolution). Les deux
  // partagent la MEME section ACCESS "competences" (decision explicite de
  // l'utilisateur : memes droits RH/Administrateur pour les deux), meme
  // principe que "backlog" ci-dessus.
  if(section === 'gestionCompetences') section = 'competences';
  if(section === 'evaluationSuivi') section = 'competences';
  // V1.99 : "Utilisateurs" et "Modules installés" (ecrans extraits de
  // Parametres, voir NAV/NAV_GROUPS) n'ont pas d'entree ACCESS propre -
  // rattaches a 'settings' comme 'backlog' ci-dessus, meme principe.
  if(section === 'utilisateurs') section = 'settings';
  if(section === 'modulesInstalles') section = 'settings';
  if(section === 'droitsAcces') section = 'settings';
  // V3.03 : Etude electrique > Base de donnees - section de droits dediee 'etude_elec'.
  if(section === 'etudeBase' || section === 'etudeListe' || section === 'etudeBilan' || section === 'etudeMateriel' || section === 'etudeCalcul' || section === 'etudeUnifilaire' || section === 'etudeSymboles') section = 'etude_elec';
  var a = ACCESS[section];
  return a ? (a[role]||'none') : 'none';
}
function canWrite(section){ return access(section)==='full'; }
function canSee(section){ return access(section)!=='none'; }
// V2.05 : premier usage d'un controle de role "en dur" cote frontend (tous
// les autres passent par access()/canWrite()/canSee() ci-dessus, pilotes
// par la matrice ACCESS). Necessaire ici car la modification du numero
// officiel d'un devis/commande/contrat n'est pas une section a part : c'est
// un controle sur UN SEUL CHAMP d'une section (devis/bc/ctr) ou le role qui
// a par ailleurs le droit d'ecriture normal (ex. commercial) ne doit PAS
// pouvoir toucher ce champ precis - voir le meme principe cote serveur
// dans backend/access.py (_is_numero_edit_request), qui est la verification
// qui fait foi : ce helper ne sert qu'a ne pas afficher un bouton qui serait
// de toute facon refuse par le serveur.
function isAdmin(){ return !!(STATE.currentUser && STATE.currentUser.role==='admin'); }

var NAV = [
  {id:'dashboard', label:'Tableau de bord', icon:'grid'},
  {id:'clients', label:'Clients', icon:'users'},
  {id:'devis', label:'Devis', icon:'file'},
  {id:'ctr', label:'Contrats', icon:'building'},
  {id:'av', label:'Avenants', icon:'pencil'},
  {id:'att', label:'Attachements', icon:'layers'},
  {id:'livrables', label:'Livrables techniques', icon:'folder'},
  // Carnet d'envois / bordereaux de transmission (V1.60) : pas de section
  // ACCESS dediee - memes droits que Livrables techniques (voir accessKey
  // ci-dessous et backend/access.py, COLLECTION_SECTION["bordereaux"]).
  {id:'bordereaux', accessKey:'livrables', label:'Bordereaux d\'envois', icon:'journal'},
  // Plan de charge (V1.65) : pas de section ACCESS dediee - vue derivee des
  // Livrables techniques (personnes affectees + dates planifiees de la
  // revision courante de chaque livrable), memes droits qu'eux (voir
  // accessKey ci-dessous et access() plus haut).
  {id:'plandecharge', accessKey:'planification', label:'Planning', icon:'calendar'},
  // Timesheet / pointage reel (V1.71) : pas de section ACCESS dediee -
  // memes droits que Livrables techniques (voir accessKey ci-dessous et
  // backend/access.py, COLLECTION_SECTION["timesheetLignes"]). Totalement
  // independant du Plan de charge (ci-dessus) : voir access() plus haut.
  {id:'timesheet', accessKey:'timesheet', label:'Timesheet', icon:'check'},
  // V3.03 : module Etude electrique - base de donnees des consommateurs (section de droits 'etude_elec').
  {id:'etudeBase', accessKey:'etude_elec', label:'Base de données', icon:'ruler'},
  {id:'etudeListe', accessKey:'etude_elec', label:'Liste des consommateurs', icon:'file'},
  {id:'etudeBilan', accessKey:'etude_elec', label:'Bilan de puissance', icon:'file'},
  // V3.06 : bases materiel reutilisables (transformateurs HT/MT...).
  {id:'etudeCalcul', accessKey:'etude_elec', label:'Calcul', icon:'ruler'},
  {id:'etudeUnifilaire', accessKey:'etude_elec', label:'Schéma unifilaire', icon:'ruler'},
  {id:'etudeSymboles', accessKey:'etude_elec', label:'Éditeur de symboles', icon:'ruler'},
  {id:'etudeMateriel', accessKey:'etude_elec', label:'Base matériel', icon:'ruler'},
  {id:'pfa', label:'Propositions de facturation', icon:'file'},
  {id:'fac', label:'Factures', icon:'receipt'},
  {id:'avo', label:'Avoirs', icon:'receipt'},
  {id:'reg', label:'Encaissements', icon:'coins'},
  // V1.98 : libelle renomme de "Fournisseurs" a "Édition fournisseur" - ce
  // lien etait un homonyme exact du groupe de menu "Fournisseurs" qui le
  // contient (voir NAV_GROUPS plus bas), ce qui provoquait une ambiguite de
  // clic genante (voir l'historique du commentaire juste au-dessus de
  // NAV_GROUPS, desormais mis a jour). Le libelle de la PAGE elle-meme
  // (TITLES.fournisseurs, affiche en-tete de l'ecran) reste "Fournisseurs"
  // - seul le texte du lien dans le menu change.
  {id:'fournisseurs', label:'Édition fournisseur', icon:'building'},
  {id:'releves', label:'Relevés bancaires', icon:'upload'},
  {id:'facturesF', label:'Factures fournisseurs', icon:'receipt'},
  {id:'personnel', label:'Personnel', icon:'idcard'},
  // V1.87 : l'ancien ecran unique "Compétences" (V1.85/V1.86) est scinde
  // en deux, a la demande de l'utilisateur - catalogue d'un cote,
  // evaluation/suivi de l'autre. Les deux redirigent vers la section
  // ACCESS "competences" (voir access() ci-dessus), meme principe que
  // bordereaux/plandecharge/timesheet/backlog.
  {id:'gestionCompetences', accessKey:'competences', label:'Gestion des compétences', icon:'star'},
  {id:'evaluationSuivi', accessKey:'competences', label:'Évaluation_Suivi', icon:'trend'},
  // Formations (V1.85) : a sa propre section ACCESS dediee (admin + role
  // "rh" uniquement, voir backend/access.py) - pas de redirection
  // accessKey ici, a la difference des deux entrees ci-dessus.
  {id:'formations', label:'Formations', icon:'graduation'},
  {id:'planComptable', label:'Plan comptable', icon:'book'},
  {id:'ecritures', label:'Journal comptable', icon:'journal'},
  {id:'ecritureOuverture', label:'Écriture d\'ouverture', icon:'upload'},
  {id:'exercicesArchives', label:'Exercices archivés', icon:'layers'},
  {id:'controleGestion', label:'Contrôle de gestion', icon:'ruler'},
  // Backlog de developpement de l'application elle-meme (V1.64) : pas de
  // section ACCESS dediee - reserve a l'Administrateur comme Parametres
  // (voir accessKey ci-dessous et backend/access.py, COLLECTION_SECTION).
  {id:'backlog', accessKey:'settings', label:'Backlog de développement', icon:'clipboard'},
  {id:'settings', label:'Paramètres', icon:'gear'},
  // V1.99 : "Utilisateurs" et "Modules installés sur ce poste" etaient de
  // simples cartes a l'interieur de l'ecran Parametres (renderSettings) -
  // devenus deux ecrans autonomes a part entiere, regroupes dans le nouveau
  // menu "Administration" (voir NAV_GROUPS plus bas). Memes droits qu'avant
  // (reserve a l'Administrateur) : accessKey:'settings', exactement comme
  // deja fait pour 'backlog' ci-dessus - aucun changement cote
  // backend/access.py, pas de nouvelle section ACCESS creee.
  {id:'utilisateurs', accessKey:'settings', label:'Utilisateurs', icon:'users'},
  {id:'modulesInstalles', accessKey:'settings', label:'Modules installés', icon:'layers'},
  {id:'droitsAcces', accessKey:'settings', label:'Droits d’accès', icon:'shield'}
];

var NAV_BY_ID = {};
NAV.forEach(function(n){ NAV_BY_ID[n.id] = n; });

/* V1.74 : regroupement visuel du menu en modules metier (demande de
   l'utilisateur, "reorganiser l'application en plusieurs modules").
   Reprend tel quel le decoupage deja utilise par les modules
   installables/desactivables par poste (V1.57, backend/modules.py) -
   seul le libelle du module "livrables" est renomme ici en "Projets
   d'ingenierie" pour refleter tout ce qu'il couvre desormais (Carnet
   d'envois/Plan de charge/Timesheet, V1.60/V1.65/V1.71) ; aucun
   changement cote backend/modules.py, qui garde son id et son libelle
   d'origine ("Livrables techniques") pour l'ecran Parametres > Modules
   installes - ce n'est qu'un regroupement d'affichage du menu, pas une
   nouvelle notion de permission. Tableau de bord, Backlog et Parametres
   restent hors de tout groupe (NAV_STANDALONE_TOP/BOTTOM), exactement
   comme ils restent hors de tout module desactivable.

   V1.76 : nouveau decoupage demande par l'utilisateur (capture annotee +
   "ajouter module contrat / ajouter module RH y integrer personnel /
   releve bancaire dans contrat" [en fait reoriente vers Comptabilite en
   cours d'echange]) - applique ICI ET cote backend/modules.py (les deux
   couches sont mises a jour ensemble cette fois, contrairement a la
   V1.74 qui ne touchait que l'affichage) :
     - "commercial" perd Commandes clients/Contrats/Avenants/Attachements,
       qui forment desormais leur propre module "contrat" ;
     - "fournisseurs" perd Relevés bancaires, qui rejoint "compta" ;
     - le module "personnel" est rebaptise "RH" dans le menu (le module
       backend garde son id interne "personnel", seul le libelle change,
       meme logique que "livrables"/"Projets d'ingenierie" ci-dessus). */
var NAV_GROUPS = [
  {id:'commercial', label:'Commercial', icon:'users', items:['clients','devis']},
  {id:'contrat', label:'Contrat', icon:'journal', items:['ctr','av','att']},
  {id:'livrables', label:'Projets d\'ingénierie', icon:'folder', items:['livrables','bordereaux','plandecharge','timesheet']},
  {id:'etude_electrique', label:'Étude électrique', icon:'ruler', items:['etudeBase','etudeListe','etudeBilan','etudeCalcul','etudeUnifilaire','etudeSymboles','etudeMateriel']},
  {id:'facturation', label:'Facturation clients', icon:'receipt', items:['pfa','fac','avo','reg']},
  // Corrige en V1.98 : ce groupe portait le meme libelle exact
  // ("Fournisseurs") que son propre item "fournisseurs", ce qui faisait
  // qu'un clic sur ce texte pouvait resoudre de façon ambigue sur l'en-tete
  // de groupe (repli/depli) au lieu du lien de navigation - l'item
  // "fournisseurs" s'appelle desormais "Édition fournisseur" (voir NAV
  // plus haut), ce qui leve l'ambiguite. Ce commentaire reste ici comme
  // rappel de ne JAMAIS redonner a un item le meme libelle que le groupe
  // qui le contient (voir la regle d'aplatissement sur l'egalite des
  // libelles dans navGroupHtml, V1.76).
  {id:'fournisseurs', label:'Fournisseurs', icon:'building', items:['fournisseurs','facturesF']},
  // V1.85 : Competences et Formations rejoignent le groupe RH, a cote de
  // Personnel. V1.87 : "competences" scinde en "gestionCompetences" +
  // "evaluationSuivi".
  {id:'personnel', label:'RH', icon:'idcard', items:['personnel','gestionCompetences','evaluationSuivi','formations']},
  {id:'compta', label:'Comptabilité', icon:'book', items:['planComptable','ecritures','ecritureOuverture','exercicesArchives','controleGestion','releves']},
  // V1.99 : nouveau menu "Administration" demande par l'utilisateur, pour
  // sortir "Utilisateurs" et "Modules installés sur ce poste" de l'ecran
  // Parametres (voir NAV ci-dessus) - Backlog et Parametres eux-memes
  // restent, comme avant, hors de tout groupe (NAV_STANDALONE_BOTTOM) : seuls
  // ces deux ecrans precis ont ete deplaces, pas tout Parametres.
  {id:'administration', label:'Administration', icon:'gear', items:['utilisateurs','droitsAcces','modulesInstalles']}
];
var NAV_STANDALONE_TOP = ['dashboard'];
var NAV_STANDALONE_BOTTOM = ['backlog','settings'];
// Etat replie/deplie de chaque groupe, en memoire pour la session en
// cours uniquement (meme principe que facAnneesRepliees pour les
// factures groupees par annee) - tous replies par defaut au chargement
// (on ne voit alors que le nom du module). Un groupe contenant la route
// active s'ouvre automatiquement LA PREMIERE FOIS qu'on y arrive (pour
// montrer ou on se trouve), mais seulement si l'utilisateur n'a encore
// jamais touche a son en-tete (navGroupesDepliees[g.id] est alors
// undefined - ni true ni false). Des qu'un clic explicite a eu lieu sur
// l'en-tete (ouvrir OU refermer), ce choix est memorise et respecte
// ensuite a chaque affichage, meme si l'ecran actif reste a l'interieur
// de ce groupe.
//
// V2.00 : avant ce correctif, le forcage "route active -> toujours
// deplie" etait inconditionnel (il ignorait navGroupesDepliees), ce qui
// rendait impossible de refermer le menu de l'ecran qu'on est en train
// de regarder (signale par l'utilisateur sur Administration et
// Comptabilite - mais le souci touchait en realite tous les groupes,
// pas seulement ceux-la : simplement les deux groupes ou le test avait
// ete fait). Desormais, un choix explicite (navGroupesDepliees[g.id]
// defini) a toujours priorite sur ce forcage automatique.
var navGroupesDepliees = {}; // id -> true/false si explicitement (dé)plié par l'utilisateur pendant la session, undefined sinon
function navGroupeEstReplie(g, itemsVisibles){
  if(navGroupesDepliees[g.id] !== undefined) return !navGroupesDepliees[g.id];
  if(itemsVisibles.some(function(n){ return n.id===STATE.route; })) return false;
  return true;
}

var UNITES = ['u','ens','ml','m²','m³','kg','t','Fft','h','j'];

var DEVIS_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'envoye', label:'Envoyé', tone:'primary'},
  {id:'accepte', label:'Accepté', tone:'success'},
  {id:'refuse', label:'Refusé', tone:'danger'},
  {id:'annule', label:'Annulé', tone:'neutral'}
];
// V2.03 : libelles "Clos" -> "Attribue" sur demande explicite de
// l'utilisateur (Commandes clients ET Contrats). L'identifiant technique
// interne ('clos') est volontairement conserve tel quel en base pour ne
// rien casser sur les documents deja enregistres - seul le libelle
// affiche a l'ecran change (meme principe que les renommages "Bon de
// commande"->"Commande client" ou "Reglement"->"Encaissement" du CDC,
// voir claude/cdc-nomenclature-numerotation-analyse.md).
// V2.14 : la Commande client a fusionne dans le Contrat (document
// d'engagement unique). « Attribue » n'a plus de sens (le devis accepte vaut
// attribution) : statuts du contrat = Actif / Termine / Annule. Les anciens
// contrats « Attribue » (id technique 'clos') ont ete convertis en 'actif'
// par la migration _migrate_commandes_vers_contrats_if_needed (backend/db.py).
var CTR_STATUTS = [
  {id:'actif', label:'Actif', tone:'primary'},
  {id:'termine', label:'Terminé', tone:'success'},
  {id:'annule', label:'Annulé', tone:'neutral'}
];
var AV_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'valide', label:'Validé', tone:'success'},
  {id:'annule', label:'Annulé', tone:'neutral'}
];
var ATT_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'valide', label:'Validé', tone:'success'},
  {id:'annule', label:'Annulé', tone:'neutral'}
];
// V1.62 : le referentiel des statuts (du livrable ET du retour par
// destinataire, voir plus bas) a ete remplace par celui fourni par
// l'utilisateur (capture d'ecran d'un tableau Excel : colonnes Statut /
// Code Interne / Code Client) - demande explicite d'unifier la
// denomination. Remplace l'ancien cycle a 6 etats (a_faire/en_cours/
// emis/valide_client/remarques/annule) de la V1.54. Retro-compatible
// sans migration : un livrable garde son ancien statut texte tel quel
// jusqu'a sa prochaine modification (statutMeta() retombe sur l'id brut
// si non trouve dans la liste courante, comme pour LIVRABLE_TYPES).
// V1.63 : colonne "Avancement" ajoutee au meme tableau Excel (pourcentage
// associe a chaque statut, pour le calcul du suivi budgetaire - voir
// livrableAvancement()/avancementPondere() plus bas). Trois statuts n'ont
// PAS de pourcentage dans le tableau fourni (As built accepte/propose,
// Bloquee) - confirme explicitement par l'utilisateur ("ces statuts n'ont
// pas d'avancement pour ce contrat") : avancement:null, qui exclut le
// document concerne du calcul pondere (ni au numerateur, ni au
// denominateur) tant qu'il reste dans l'un de ces 3 statuts.
var STATUT_RETOUR_REFERENTIEL = [
  {id:'ABA', label:'"As built" accepté', tone:'success', avancement:null},
  {id:'ABP', label:'"As built" proposé', tone:'primary', avancement:null},
  {id:'BLO', label:'Bloquée', tone:'danger', avancement:null},
  {id:'NEE', label:'Non encore entamé', tone:'neutral', avancement:0},
  {id:'DE', label:'Document entamé', tone:'primary', avancement:40},
  {id:'TPV', label:'Transmis pour validation', tone:'primary', avancement:70},
  {id:'NV', label:'Non validé', tone:'danger', avancement:70},
  {id:'VAC', label:'Validé avec commentaires', tone:'warning', avancement:90},
  {id:'VSC', label:'Validé sans commentaires', tone:'success', avancement:100},
  {id:'SO', label:'Sans Objet', tone:'neutral', avancement:0}
];
// Statut global du livrable (saisi manuellement par l'utilisateur, JAMAIS
// recalcule automatiquement depuis les retours de bordereau - decision
// explicite de l'utilisateur) : meme denomination que le referentiel des
// statuts de retour ci-dessus, complete du seul etat propre au livrable
// lui-meme (Annulé, deja utilise par cancelDoc()/le verrouillage V1.58 -
// inchange). Un livrable annule est lui aussi exclu du calcul d'avancement
// (avancement:null), coherent avec le reste de l'application qui l'exclut
// deja des listes actives (ex. ctrOptionsHtml, livrables transmissibles).
var LIVRABLE_STATUTS = STATUT_RETOUR_REFERENTIEL.concat([
  {id:'annule', label:'Annulé', tone:'neutral', avancement:null}
]);
// Liste indicative, modifiable au besoin : un livrable garde son type tel
// quel meme s'il n'est pas dans cette liste (ex. donnee anterieure a un
// changement de cette liste), aucune validation stricte cote serveur.
var LIVRABLE_TYPES = ['Plan', 'Note de calcul', 'Rapport', 'Autre'];
// Catégorie (V1.59) : classification metier plus fine que le Type de
// document ci-dessus (inchange), fournie telle quelle par l'utilisateur -
// propre a l'activite electrique (CFO/CFA) de Futura Expertise. Champ
// independant, facultatif, qui n'entre pas dans le code a 6 segments de la
// codification (V1.58) - decision explicite de l'utilisateur, pour ne pas
// toucher a un format deja valide et teste. Meme principe que LIVRABLE_TYPES
// : liste "vivante", aucune validation stricte cote serveur.
var LIVRABLE_CATEGORIES = [
  'Liste des plans', 'Note de Calcul d’Éclairement', 'Prises de courant et forces',
  'Synoptiques CFO', 'Carnet des câbles CFO', 'Bilan de puissance', 'Note de Calcul BT',
  'Note de Calcul MT', 'Note de Calcul DC', 'Note de Calcul Batterie', 'Note de Calcul CDC',
  'Note de Calcul de mise à la terre', 'Bilan Thermique', 'Note de Calcul paratonnerre',
  'Éclairage', 'Réseau sous dallage', 'Réservations', 'Plans des locaux techniques',
  'Mise à la terre et protection foudre', 'Plans CDC', 'Plans des locaux types',
  'Réseau extérieur', 'Photovoltaïque', 'Schémas des tableaux', 'Synoptiques CFA',
  'Réseau wifi', 'Sonorisation', 'Audiovisuel', 'Précâblage informatique',
  'Système sécurité incendie', 'Vidéosurveillance', 'Contrôle d’accès et d’intrusion',
  'Gestion d’éclairage', 'Aménagement local PCS', 'Carnet des câbles CFA',
  'Gestion domotique', 'GTC', 'TBE'
];
// Codification des livrables techniques (V1.58, voir démarche validée dans
// claude/codification-livrables-futura-expertise.md, analyse d'une
// convention professionnelle du secteur BTP/AEC adaptee au perimetre propre
// de Futura Expertise - metier electrique). Code a 6 segments :
// [Contrat]-[Zone]-[Niveau]-[Discipline]-[Type]-[NumeroSequentiel]-[Indice].
// Listes "vivantes" au sens du document de reference : completables selon
// le besoin reel, sans migration necessaire pour les livrables existants
// (voir livrableCode() et saveLivrable() ci-dessous).
var LIVRABLE_ZONES = [
  {id:'BATA', label:'Bâtiment A'},
  {id:'BATB', label:'Bâtiment B'},
  {id:'BATC', label:'Bâtiment C'},
  {id:'BATD', label:'Bâtiment D'},
  {id:'EXT', label:'Extérieur / VRD'},
  {id:'G', label:'Général (sans bâtiment distinct)'}
];
var LIVRABLE_NIVEAUX = (function(){
  var list = [
    {id:'FND', label:'Fondations'},
    {id:'SSL', label:'Sous-sol'},
    {id:'RDC', label:'Rez-de-chaussée'}
  ];
  for(var i=1;i<=10;i++){ list.push({id:'N'+String(i).padStart(2,'0'), label:'Étage '+i}); }
  list.push({id:'TOI', label:'Toiture'});
  list.push({id:'TER', label:'Terrasse'});
  list.push({id:'G', label:'Général (sans niveau distinct)'});
  return list;
})();
// Perimetre metier de Futura Expertise : electricite uniquement (courant
// fort / courant faible), + une valeur generale pour le reste.
var LIVRABLE_DISCIPLINES = [
  {id:'CFO', label:'Courant fort'},
  {id:'CFA', label:'Courant faible'},
  {id:'AUT', label:'Autre'}
];
// Code court par type de document, pour la composition du code complet
// (LIVRABLE_TYPES reste la liste des libelles affiches dans le formulaire,
// inchangee depuis la V1.54) - un type non reconnu (donnee ancienne) retombe
// sur AUT plutot que de bloquer le calcul du code.
var LIVRABLE_TYPE_CODES = {'Plan':'PLA', 'Note de calcul':'NDC', 'Rapport':'RAP', 'Autre':'AUT'};

// V1.72 : configurateur de codification PAR CONTRAT - a la demande
// explicite de l'utilisateur ("chaque Contrat a sa propre [codification] /
// ca peut un increment comme ca peut etre une composition de plusieurs
// champs / qu est ce que vous me recommandez"), le code a 6 segments de la
// V1.58 n'est plus un format unique impose a toute l'application.
//
// V1.73 : deux changements supplementaires, toujours a la demande explicite
// de l'utilisateur ("mettre cette configuration au niveau de la gestion des
// livrables et non au niveau contrat / Donner la possibilite par contrat
// d'ajouter des segment (batiment niveau ....) leurs noms et leurs contenu
// (liste deroulante) doivent rester configurable par contrat") :
//  - l'interface de configuration quitte la fiche Contrat (openCTRFormModal)
//    pour un bouton dedie dans la barre d'outils de l'ecran "Livrables
//    techniques" (voir openCodificationLivrablesModal, renderLivrables) ;
//  - Zone/Niveau/Discipline - jusqu'ici 3 axes FIXES, identiques pour tous
//    les contrats - deviennent eux-memes des SEGMENTS PERSONNALISES, au
//    meme titre que n'importe quel nouveau segment qu'un contrat voudrait
//    creer (ex. "Bâtiment", "Lot", "Phase"...) : chaque contrat definit
//    desormais librement son propre catalogue de segments, chacun avec un
//    nom libre ET sa propre liste de valeurs (nouveau champ
//    `segmentsPersonnalises` sur le document Contrat, tableau de
//    `{id, nom, valeurs:[...]}`).
// Restent FIXES (jamais personnalisables, communs a tous les contrats) :
// le numero de contrat, le type de document (lie a LIVRABLE_TYPE_CODES,
// utilise aussi ailleurs), le numero sequentiel (toujours inclus - seul
// garant de l'unicite du code) et l'indice de revision.
// Decisions actees par choix multiples avant implementation (V1.72 et
// V1.73) :
//  - un vrai configurateur libre (pas un simple choix binaire
//    increment/composition) ;
//  - modifiable a tout moment, pas verrouille a la creation du contrat ;
//  - le segment "seq" reste TOUJOURS present, mais sa POSITION dans la
//    composition est libre, comme les autres segments ;
//  - le code n'est JAMAIS une valeur figee : il est recalcule EN DIRECT, a
//    chaque affichage, a partir de la configuration COURANTE du contrat
//    (voir livrableCodeDuLivrable ci-dessous) - meme principe que
//    livrableAvancement/dernierEnvoiLivrable, deja calcules a la volee ;
//  - rien n'est bloque si on renomme/retire un segment ou une valeur deja
//    utilisee par des livrables existants : "les anciennes codifications
//    reprennent la nouvelle facon de codifier" (reponse explicite de
//    l'utilisateur) - cohere avec le recalcul en direct ci-dessus.
// Un contrat qui n'a jamais defini ses propres segments personnalises
// retombe sur le defaut ci-dessous - memes id et memes listes de valeurs
// que les anciens axes fixes Zone/Niveau/Discipline (V1.58-V1.72) - retro-
// compatible sans aucune migration, pour tout contrat cree avant la V1.73.
//
// V1.82 : contrat CTR-2026-0003 (JESA/QW2245) - 82 livrables deja importes
// (V1.66) avec une reference client deja codifiee selon la methodologie du
// client ("QW2245-000-00-SOG-24925024-EL-C102-00035" = Code projet-Site-
// Zone-Emetteur-PO Number-Discipline-Type de document-N° de document),
// avant que cette methodologie ne soit definie dans l'application. Demande
// explicite de l'utilisateur : adopter cette methodologie pour ce contrat,
// sans ressaisir a la main les 82 x 8 valeurs deja presentes telles quelles
// dans referenceClient. Ajout d'une case facultative par contrat
// (segmentsAutoDepuisReferenceClient, voir openCodificationLivrablesModal)
// qui active un repli supplementaire dans livrableSegmentValeur ci-dessous :
// decoupage EN DIRECT de referenceClient sur les tirets, un morceau par
// segment personnalise dans l'ordre configure - meme principe de recalcul
// en direct que le reste de cette codification, donc toujours reversible
// et jamais une migration. Cible le contrat par sa configuration (la case
// cochee), jamais par son numero - fonctionne pour tout contrat futur dans
// le meme cas, pas seulement CTR-2026-0003.
var CODIFICATION_SEGMENTS_FIXES = [
  {id:'ctr', label:'Numéro de contrat'},
  {id:'type', label:'Type de document'},
  {id:'seq', label:'Numéro séquentiel'},
  {id:'indice', label:'Indice de révision'}
];
var SEGMENTS_PERSONNALISES_DEFAUT = [
  {id:'zone', nom:'Zone', valeurs: LIVRABLE_ZONES.map(function(z){ return z.id; })},
  {id:'niveau', nom:'Niveau', valeurs: LIVRABLE_NIVEAUX.map(function(n){ return n.id; })},
  {id:'discipline', nom:'Discipline', valeurs: LIVRABLE_DISCIPLINES.map(function(d){ return d.id; })}
];
var CODIFICATION_SEGMENTS_DEFAUT = ['ctr','zone','niveau','discipline','type','seq','indice'];

// Segments personnalises EFFECTIFS d'un contrat : les siens s'il en a
// defini au moins un, sinon le defaut ci-dessus (jamais vide).
function segmentsPersonnalisesDuContrat(ctr){
  if(ctr && Array.isArray(ctr.segmentsPersonnalises) && ctr.segmentsPersonnalises.length) return ctr.segmentsPersonnalises;
  return SEGMENTS_PERSONNALISES_DEFAUT;
}
// Catalogue complet des segments disponibles pour UN contrat (les 4 fixes
// + ses segments personnalises), sous la forme {id, label} utilisee par le
// configurateur (checkbox + ordre, voir openCodificationLivrablesModal) et
// par livrableCode() ci-dessous.
// V2.22 : les 4 segments fixes peuvent etre SUPPRIMES de la composition d'un
// contrat (ctr.segmentsFixesRetires, ex. ['ctr','type'] quand le code suit
// celui du client) et re-ajoutes a tout moment depuis la fenetre de
// codification. Ils restent definis globalement (CODIFICATION_SEGMENTS_FIXES).
function fixesActifsDuContrat(ctr){
  var retires = (ctr && Array.isArray(ctr.segmentsFixesRetires)) ? ctr.segmentsFixesRetires : [];
  return CODIFICATION_SEGMENTS_FIXES.filter(function(f){ return retires.indexOf(f.id)<0; });
}
function catalogueSegmentsDuContrat(ctr){
  var liste = fixesActifsDuContrat(ctr).slice();
  segmentsPersonnalisesDuContrat(ctr).forEach(function(s){ liste.push({id:s.id, label:s.nom}); });
  return liste;
}
// Valeur d'UN segment personnalise pour UN livrable (ou un brouillon du
// formulaire, pas encore enregistre) - lit la carte generique
// `segmentsValeurs` (V1.73), avec repli sur les anciens champs plats
// `zone`/`niveau`/`discipline` (V1.58) pour un livrable enregistre avant la
// V1.73 et jamais reenregistre depuis - aucune migration necessaire, meme
// principe que le reste de l'application ("referentiel vivant").
function livrableSegmentValeur(l, segId){
  if(!l) return undefined;
  if(l.segmentsValeurs && l.segmentsValeurs[segId]!==undefined && l.segmentsValeurs[segId]!==null && l.segmentsValeurs[segId]!=='') return l.segmentsValeurs[segId];
  if((segId==='zone'||segId==='niveau'||segId==='discipline') && l[segId]) return l[segId];
  // V1.82 : repli supplementaire, UNIQUEMENT si le contrat a explicitement
  // active la case "Recuperer automatiquement depuis la reference client"
  // du configurateur de codification (ctr.segmentsAutoDepuisReferenceClient)
  // - demande explicite de l'utilisateur ("nous avons deja importe une liste
  // de livrable avec une codification [client] ... maintenant je souhaite
  // que ce projet [suive] cette methodologie"). Decoupe EN DIRECT (jamais
  // ecrit en base - meme principe que tout le reste de la codification,
  // voir le commentaire au-dessus de CODIFICATION_SEGMENTS_FIXES) la
  // reference client importee (referenceClient, V1.66) sur les tirets, et
  // associe chaque morceau au segment personnalise de meme position dans
  // la configuration COURANTE du contrat - UNIQUEMENT si le nombre de
  // morceaux correspond exactement au nombre de segments personnalises
  // (sinon on ne devine rien : le segment reste affiche "—", comme avant).
  // Beneficie immediatement aux livrables deja importes (reference client
  // deja presente, segments encore vides) sans aucune migration ni
  // reecriture, et n'est jamais applique a un contrat qui n'a pas coche la
  // case - aucun risque de collision avec un autre contrat dont la
  // reference client aurait, par coincidence, le meme nombre de tirets.
  if(l.referenceClient && typeof STATE!=='undefined' && STATE.ctr){
    var ctrRef = projetParId(projetIdDe(l));
    if(ctrRef && ctrRef.segmentsAutoDepuisReferenceClient){
      var segsCtr = segmentsPersonnalisesDuContrat(ctrRef);
      var idxSeg = -1;
      for(var iSeg=0; iSeg<segsCtr.length; iSeg++){ if(segsCtr[iSeg].id===segId){ idxSeg = iSeg; break; } }
      if(idxSeg>=0){
        var partsRef = String(l.referenceClient).split('-');
        if(partsRef.length===segsCtr.length) return partsRef[idxSeg];
      }
    }
  }
  return undefined;
}

// Compose le code complet d'un livrable. `l` porte les champs du livrable
// (ou un brouillon du formulaire pas encore enregistre : typeDocument,
// numeroSeq, indiceRevision, ctrNumero, segmentsValeurs) ; `ctr` est son
// contrat (numero de contrat, `codificationSegments` = ordre des segments
// INCLUS, et `segmentsPersonnalises` pour les segments au-dela des 4 fixes).
// Remplace en V1.73 la signature positionnelle de la V1.58/V1.72 (devenue
// impraticable avec un nombre de segments personnalises desormais
// variable d'un contrat a l'autre) - tous les appelants ont ete mis a jour
// dans ce meme changement.
function livrableCode(l, ctr){
  l = l || {};
  var typeCode = LIVRABLE_TYPE_CODES[l.typeDocument] || 'AUT';
  // V2.21 : un livrable importe avec le decoupage du code client garde le
  // numero de document du client tel quel (numeroSeqTexte, ex. '670300').
  var seqStr = l.numeroSeqTexte ? String(l.numeroSeqTexte) : (l.numeroSeq ? String(l.numeroSeq).padStart(3,'0') : '···');
  var liste = (ctr && Array.isArray(ctr.codificationSegments) && ctr.codificationSegments.length) ? ctr.codificationSegments.slice() : CODIFICATION_SEGMENTS_DEFAUT.slice();
  // V2.22 : le numero sequentiel n'est ajoute d'office que pour un contrat
  // sans composition enregistree ; une composition explicite peut l'exclure.
  if(!(ctr && Array.isArray(ctr.codificationSegments) && ctr.codificationSegments.length) && liste.indexOf('seq')<0) liste.push('seq');
  return liste.map(function(segId){
    if(segId==='ctr') return (ctr&&ctr.numero) || l.ctrNumero || l.devisNumero || '—';
    if(segId==='type') return typeCode;
    if(segId==='seq') return seqStr;
    if(segId==='indice') return l.indiceRevision || 'A';
    var val = livrableSegmentValeur(l, segId);
    return (val!==undefined && val!==null && val!=='') ? val : '—';
  }).join('-');
}

// Calcule le code d'UN LIVRABLE en direct, a partir de la configuration
// COURANTE de son contrat (ctr, deja charge en memoire - STATE.ctr). A
// utiliser partout ou le code est AFFICHE (liste des livrables, historique,
// formulaires) plutot que de se fier a l.codeComplet, qui reste ecrit a
// l'enregistrement (saveLivrable) pour servir de secours si le contrat
// n'est plus trouvable, mais qui peut devenir obsolete si la configuration
// du contrat change ensuite - exactement le cas d'usage demande.
function livrableCodeDuLivrable(l, ctr){
  if(!l) return '—';
  var code = livrableCode(l, ctr);
  // V3.47 : un seul code par livrable. Si la codification du projet ne peut
  // pas encore etre completee (segments sans valeur → « — ») mais que le
  // livrable porte la reference client importee, c'est celle-ci qui fait foi
  // (jamais de code a trous affiche a cote d'un code complet).
  if(l.referenceClient && /(^|-)—(-|$)/.test(code)) return String(l.referenceClient);
  return code;
}

/* =========================================================
   V3.02 : un livrable (et ses bordereaux, lignes de planning et de timesheet) est lie a un CONTRAT
   (marche gagne) OU a un DEVIS (marche pas encore gagne). Un « projet » est donc un contrat ou un
   devis : les deux portent la meme configuration de codification (segmentsPersonnalises,
   codificationSegments, segmentsFixesRetires, destinataires, codesRetourClient, livSeq, bordereauSeq),
   si bien que toute la mecanique de code, de bordereaux et de planning fonctionne a l'identique.
   ========================================================= */
function projetParId(id){
  if(!id) return null;
  return STATE.ctr.find(function(c){ return c.id===id; }) || (STATE.devis||[]).find(function(d){ return d.id===id; }) || null;
}
function projetEstDevis(p){
  return !!p && !STATE.ctr.some(function(c){ return c.id===p.id; }) && (STATE.devis||[]).some(function(d){ return d.id===p.id; });
}
function projetIdDe(x){ return x ? (x.ctrId || x.devisId || '') : ''; }
function projetCollection(p){ return projetEstDevis(p) ? 'devis' : 'contrats'; }
function projetDocPath(p){ return projetCollection(p)+'/'+p.id; }
function champsProjet(p){
  if(!p) return {ctrId:null, ctrNumero:null, devisId:null, devisNumero:null};
  if(projetEstDevis(p)) return {ctrId:null, ctrNumero:null, devisId:p.id, devisNumero:p.numero};
  return {ctrId:p.id, ctrNumero:p.numero, devisId:null, devisNumero:null};
}
function projetNumeroDe(x){ return x ? (x.ctrNumero || x.devisNumero || '') : ''; }
function projetLibelle(p){
  if(!p) return '';
  var estDevis = projetEstDevis(p);
  return (estDevis ? 'Devis ' : '')+(p.numero||'')+(estDevis && p.revision ? ' rév. '+p.revision : '')+' — '+(p.clientNom||'');
}
// Devis auxquels on peut lier des livrables : marche pas encore gagne (brouillon, envoye, accepte sans contrat
// cree), plus tout devis qui porte deja des elements (pour pouvoir les rattacher au contrat ensuite).
function devisPourLivrables(){
  var porteurs = {};
  [STATE.livrables, STATE.bordereaux, STATE.planificationLignes, STATE.timesheetLignes, STATE.etudeConsommateurs].forEach(function(liste){
    (liste||[]).forEach(function(x){ if(x.devisId) porteurs[x.devisId] = true; });
  });
  return (STATE.devis||[]).filter(function(d){
    if(porteurs[d.id]) return true;
    return ['brouillon','envoye','accepte'].indexOf(d.statut)>=0 && !STATE.ctr.some(function(c){ return c.devisId===d.id; });
  });
}
// Liste ordonnee des projets proposes dans les filtres : contrats (numero decroissant) puis devis.
function projetsTries(){
  var cs = STATE.ctr.slice().sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });
  var ds = devisPourLivrables().sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||'') || (b.revision||'').localeCompare(a.revision||''); });
  return cs.concat(ds);
}
function projetsOptionsHtml(selectedId, blankLabel, clientId, contratsAnnulesInclus){
  var blank = blankLabel===null ? '' : '<option value="">'+esc(blankLabel===undefined?'— Choisir —':blankLabel)+'</option>';
  var cs = STATE.ctr.filter(function(d){ return (contratsAnnulesInclus || d.statut!=='annule') && (!clientId || d.clientId===clientId); })
    .sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });
  var ds = devisPourLivrables().filter(function(d){ return !clientId || d.clientId===clientId; })
    .sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||'') || (b.revision||'').localeCompare(a.revision||''); });
  var opt = function(d){ return '<option value="'+d.id+'"'+(selectedId===d.id?' selected':'')+'>'+esc(projetLibelle(d).replace(/^Devis /,''))+'</option>'; };
  return blank+
    (cs.length ? '<optgroup label="Contrats">'+cs.map(opt).join('')+'</optgroup>' : '')+
    (ds.length ? '<optgroup label="Devis (marché pas encore gagné)">'+ds.map(opt).join('')+'</optgroup>' : '');
}

// V1.68 : la reference client (referenceClient, importee depuis le
// classeur Excel du client - voir importerLivrablesEtBordereaux, V1.66,
// et le champ "Référence / code client" du formulaire) est une
// codification longue propre au client (ex. "QW2245-000-00-SOG-24925024-
// EL-B102-00001"), illisible dans une colonne de liste deja dense -
// demande de l'utilisateur : n'en afficher que le dernier segment, qui en
// est l'increment/numero sequentiel. La valeur complete reste stockee
// telle quelle (referenceClient n'est jamais modifiee par cette fonction,
// purement un formatage d'affichage) et reste consultable via l'attribut
// title porte par l'affichage (voir renderLivrables).
function referenceClientIncrement(ref){
  if(!ref) return '';
  var parts = String(ref).split('-');
  return parts[parts.length-1] || String(ref);
}

// V1.69 : meme demande que ci-dessus, etendue au code interne lui-meme
// (codeComplet, V1.58) - toujours affiche en entier dans la liste malgre
// le raccourcissement de referenceClient, puisque le numero de contrat
// seul (ex. "CTR-2026-0003") contient deja des tirets, rendant le code
// complet tres long une fois les 6 segments concatenes (ex.
// "CTR-2026-0003-G-G-AUT-AUT-019-01"). Plutot que de re-splitter cette
// chaine (le numero de contrat contient lui-meme des tirets, ce qui
// rendrait un decoupage par "-" ambigu), on affiche directement le
// numero sequentiel (l.numeroSeq, le "numero sequentiel" du § 5e de la
// demarche de codification - voir le document de projet), deja le
// segment qui joue le role d'increment dans ce code - l'indice de
// revision, lui, reste visible dans sa propre colonne "Indice". Le code
// complet reste consultable via l'attribut title (voir renderLivrables).
function codeCompletIncrement(l){
  if(l && l.numeroSeqTexte) return String(l.numeroSeqTexte);
  if(l && l.numeroSeq) return String(l.numeroSeq).padStart(3,'0');
  return (l && l.codeComplet) || '—';
}

// =========================================================
// BORDEREAUX DE TRANSMISSION (V1.60) : chaque livrable peut evoluer en
// plusieurs indices successifs (historiqueIndices, voir saveLivrable
// ci-dessous) et chaque indice peut etre transmis a un ou plusieurs
// destinataires (liste configurable par contrat/projet, voir
// LIVRABLE_... et destinataires sur le contrat), avec un etat de
// transmission propre a chaque envoi. Le "bordereau" (carnet d'envois)
// materialise cet envoi : un document autonome, consultable et
// imprimable independamment de la fiche du livrable, jamais modifie ni
// supprime une fois cree (CREATE / LIST / PRINT uniquement en V1.60).
var BORDEREAU_ETATS = [
  {id:'PI', label:'Pour information', tone:'neutral'},
  {id:'PA', label:'Pour approbation', tone:'primary'},
  {id:'PE', label:'Pour exécution', tone:'success'},
  {id:'TQC', label:'Tel que construit', tone:'success'}
];
// Categories fixes de destinataires (RG implicite du besoin exprime) -
// la liste des destinataires NOMMES, elle, est propre a chaque contrat
// (voir contrat.destinataires, alimentee depuis l'ecran Carnet d'envois).
var DESTINATAIRE_CATEGORIES = ['Client', 'Bureau d’Études', 'Bureau de Contrôle', 'Architecte', 'Autre'];

// Dernier envoi connu d'un livrable donne (indice transmis + etat + date +
// destinataire), calcule a la volee a partir des bordereaux déjà créés -
// aucune denormalisation sur le livrable lui-meme, pour eviter tout risque
// de desynchronisation : le bordereau reste la seule source de verite.
function dernierEnvoiLivrable(livId){
  var best = null;
  (STATE.bordereaux||[]).forEach(function(b){
    (b.lignes||[]).forEach(function(l){
      if(l.livId===livId && (!best || (b.createdAt||'') > (best.createdAt||''))){
        best = {indice: l.indice, etat: l.etat, destNom: b.destNom, date: b.date, createdAt: b.createdAt, bordereauNumero: b.numero};
      }
    });
  });
  return best;
}

// =========================================================
// SUIVI BUDGETAIRE / AVANCEMENT DES LIVRABLES (V1.63)
// Demande (verbatim) : "chaque revision doit avoir un budget horaire / a
// chaque statut correspond un pourcentage d'avancement / le calcul de
// l'avancement global est le suivant: avancement global = (avancement de
// chaque document *somme des budget des differentes revision de ce
// document)/somme total de tout les budget / le statut retenu de chaque
// est celui de la derniere revision". Clarifie par l'utilisateur :
// - le "statut de chaque document" est le statut global du livrable
//   (LIVRABLE_STATUTS, deja manuel - V1.62), pas un champ distinct par
//   revision : on part du principe que l'utilisateur le met a jour a
//   chaque nouvelle revision, donc il represente deja "le statut de la
//   derniere revision" ;
// - 3 statuts du referentiel (As built accepte/propose, Bloquee) n'ont
//   pas de pourcentage d'avancement defini (voir avancement:null plus
//   haut) : un livrable dans l'un de ces 3 statuts est exclu du calcul
//   pondere (ni numerateur ni denominateur) ;
// - un livrable annule est exclu de la meme maniere ;
// - le budget horaire se saisit par revision (historiqueIndices[].budgetHeures,
//   voir withHistoriqueIndices et le formulaire du livrable) ;
// - l'avancement global se calcule a la fois par contrat et pour toute
//   l'entreprise (voir renderCTR et renderDashboard).

// Somme des budgets horaires de TOUTES les revisions d'un livrable (pas
// seulement la derniere) - une revision sans budget saisi compte pour 0,
// sans empecher le calcul (retro-compatible, meme esprit que le reste de
// l'application).
function livrableBudgetTotal(l){
  var hist = (l && Array.isArray(l.historiqueIndices)) ? l.historiqueIndices : [];
  return hist.reduce(function(sum, h){ return sum + (Number(h.budgetHeures) || 0); }, 0);
}
// Budget horaire deja enregistre pour la revision COURANTE d'un livrable
// (derniere entree de son historique des indices) - null si aucune entree
// (nouveau livrable) ou si cette entree n'a pas encore de budget saisi.
// Utilise pour pre-remplir le champ du formulaire (openLivrableFormModal).
function budgetRevisionCourante(l){
  var hist = (l && Array.isArray(l.historiqueIndices)) ? l.historiqueIndices : [];
  if(!hist.length) return null;
  var v = hist[hist.length-1].budgetHeures;
  return (typeof v === 'number') ? v : null;
}
// Avancement (%) d'UN livrable : lu sur son statut global actuel (cense
// refleter sa derniere revision, voir note ci-dessus) - retourne null si ce
// statut n'a pas de pourcentage defini (As built accepte/propose, Bloquee,
// Annulé, ou un ancien statut non reconnu), auquel cas le livrable est
// exclu du calcul pondere.
function livrableAvancement(l){
  if(!l) return null;
  var sm = statutMeta(LIVRABLE_STATUTS, l.statut);
  return (sm && typeof sm.avancement === 'number') ? sm.avancement : null;
}
// Avancement global pondere par les heures budgetees, sur un ensemble de
// livrables donne (un contrat, ou toute l'entreprise) :
//   avancement = Sum(avancement_i * budget_total_i) / Sum(budget_total_i)
// - les livrables annules, ou dont le statut n'a pas d'avancement defini,
//   sont exclus du calcul (ni numerateur ni denominateur) ; un livrable
//   sans aucun budget saisi (budget_total=0) n'apporte aucun poids, donc
//   n'influence pas le resultat. Retourne null si rien n'est calculable
//   (aucun livrable eligible, ou budget total nul).
function avancementPondere(livrables){
  var num = 0, den = 0;
  (livrables||[]).forEach(function(l){
    if(!l || l.statut==='annule') return;
    var av = livrableAvancement(l);
    if(av===null) return;
    var budget = livrableBudgetTotal(l);
    if(budget<=0) return;
    num += av*budget; den += budget;
  });
  return den>0 ? (num/den) : null;
}

// =========================================================
// MODULE DE PLANIFICATION : personnes affectees + dates planifiees, sur la
// REVISION COURANTE uniquement (V1.65). Demande (verbatim) : "PERSONNES
// AFFECTEES A CHAQUE LIVRABLES (dernier revision) les anciennes ne sont
// plus concernee / Date debute / Date Fin / ce va nous generer egalement
// le plan de charge" - prolonge les pistes "Dates de debut/fin planifiees
// par revision" et "Ressources affectees et plan de charge" de
// claude/pistes-developpement-futura.md.
//
// Decisions actees : plusieurs personnes possibles par livrable ; AUCUN
// historique par revision (a la difference du budget horaire, V1.63) - les
// champs affectations/datePlanifieeDebut/datePlanifieeFin sont plats sur le
// livrable et simplement remplaces a chaque nouvelle revision ; le plan de
// charge genere est une grille jour par jour, consultable par contrat ET de
// facon globale (voir renderPlanDeCharge) ; les personnes selectionnables
// viennent de STATE.personnelLight (voir chargerPersonnelLight() - liste
// minimale, jamais le salaire, pour rester accessible au Conducteur de
// travaux qui n'a pas acces au registre Personnel complet).

// Jours OUVRES (lundi a vendredi) entre deux dates ISO (yyyy-mm-dd)
// incluses - tableau vide si l'une des deux dates est absente, invalide ou
// si la plage est inversee (fin avant debut).
function joursOuvresEntre(debutISO, finISO){
  if(!debutISO || !finISO) return [];
  var d = new Date(debutISO+'T00:00:00');
  var f = new Date(finISO+'T00:00:00');
  if(isNaN(d.getTime()) || isNaN(f.getTime()) || f<d) return [];
  var out = [];
  while(d<=f){
    var jourSemaine = d.getDay(); // 0=dimanche, 6=samedi
    if(jourSemaine!==0 && jourSemaine!==6) out.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate()+1);
  }
  return out;
}
// Jours ouvres d'un mois calendaire (moisIdx 0-indexe, comme Date.getMonth())
// - sert de colonnes a la grille du plan de charge (renderPlanDeCharge).
function joursOuvresDuMois(annee, moisIdx){
  var premier = new Date(annee, moisIdx, 1);
  var dernier = new Date(annee, moisIdx+1, 0);
  return joursOuvresEntre(premier.toISOString().slice(0,10), dernier.toISOString().slice(0,10));
}
// Tous les jours CALENDAIRES (lundi a dimanche, week-ends inclus) d'un mois
// donne (moisIdx 0-indexe, comme Date.getMonth()) - sert de colonnes a la
// grille du module de planification manuelle (renderPlanDeCharge, V1.70).
// A la difference de joursOuvresDuMois() (toujours utilise ailleurs pour les
// jours ouvres planifies d'un livrable), les samedis/dimanches sont
// INCLUS ici : l'utilisateur a explicitement demande a les voir dans la
// grille (juste mis en evidence par une couleur differente a l'affichage).
// Renvoie [{date:'aaaa-mm-jj', weekend:bool}, ...].
function joursDuMois(annee, moisIdx){
  var premier = new Date(annee, moisIdx, 1);
  var dernier = new Date(annee, moisIdx+1, 0);
  var out = [];
  var d = new Date(premier);
  while(d<=dernier){
    var jourSemaine = d.getDay(); // 0=dimanche, 6=samedi
    out.push({date: d.toISOString().slice(0,10), weekend: (jourSemaine===0 || jourSemaine===6)});
    d.setDate(d.getDate()+1);
  }
  return out;
}

var PFA_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'a_valider', label:'À valider', tone:'primary'},
  {id:'validee', label:'Validée', tone:'success'},
  {id:'rejetee', label:'Rejetée', tone:'danger'},
  {id:'convertie', label:'Convertie en facture', tone:'success'},
  {id:'annulee', label:'Annulée', tone:'neutral'}
];
var FAC_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'validee', label:'Validée', tone:'success'},
  {id:'annulee', label:'Annulée', tone:'neutral'}
];
var AVO_STATUTS = [
  {id:'brouillon', label:'Brouillon', tone:'neutral'},
  {id:'validee', label:'Validée', tone:'success'},
  {id:'annulee', label:'Annulée', tone:'neutral'}
];
var REG_STATUTS = [
  {id:'valide', label:'Validé', tone:'success'},
  {id:'annule', label:'Annulé', tone:'neutral'}
];
var REG_MODES = [
  {id:'virement', label:'Virement'},
  {id:'cheque', label:'Chèque'},
  {id:'espece', label:'Espèces'},
  {id:'effet', label:'Effet'},
  {id:'autre', label:'Autre'}
];
// P-06 / section 5.2 du CDC : d'où vient l'engagement client sur une commande
// (utile meme sans reference externe - accord verbal ou par e-mail).
var ORIGINE_ENGAGEMENT = [
  {id:'verbal', label:'Verbal'},
  {id:'email', label:'E-mail'},
  {id:'bc', label:'Bon de commande client'},
  {id:'contrat', label:'Contrat client'},
  {id:'bc_contrat', label:'BC client et contrat'}
];

function statutMeta(list, id){ if(!id) return {id:'', label:'—', tone:'neutral'}; return list.find(function(s){return s.id===id;}) || {id:id, label:id, tone:'neutral'}; }

/* =========================================================
   ICONES (SVG line-icons, 20x20, stroke=currentColor)
   ========================================================= */
function ic(name, size){
  size = size || 18;
  var p = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
    users:'<circle cx="8" cy="8" r="3.2"/><path d="M2.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><circle cx="16.5" cy="8.5" r="2.5"/><path d="M15 13.6c2.5.3 4.5 2.2 4.5 5.4"/>',
    file:'<path d="M6 2.5h7l4.5 4.5V21H6z"/><path d="M13 2.5V7h4.5"/><path d="M8.5 12h6M8.5 15.5h6M8.5 18.5h3.5"/>',
    clipboard:'<rect x="4.5" y="4" width="14" height="16" rx="1.6"/><rect x="8" y="2" width="7" height="3.6" rx="1"/><path d="M8 12.5l2.3 2.3L15.5 10"/>',
    layers:'<path d="M11 3l8 4.3-8 4.3-8-4.3z"/><path d="M3 12l8 4.3 8-4.3"/><path d="M3 16.2l8 4.3 8-4.3"/>',
    receipt:'<path d="M5.5 2.5h11v18.7l-2.4-1.6-2 1.6-2-1.6-2 1.6-2.6-1.6z"/><path d="M8.3 8h5.6M8.3 11.3h5.6M8.3 14.6h3.6"/>',
    coins:'<circle cx="8" cy="9" r="5.5"/><path d="M12 6a5.5 5.5 0 110 10.6"/><path d="M5.5 9h5M8 6.5v5"/>',
    shield:'<path d="M11 2.5l7 2.8v5.4c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V5.3z"/><path d="M8 11l2.2 2.2L14.2 9"/>',
    gear:'<circle cx="11" cy="11" r="3.1"/><path d="M11 2.7v2.4M11 17v2.4M19.3 11h-2.4M4.7 11H2.3M16.6 5.4l-1.7 1.7M6.1 15.9l-1.7 1.7M16.6 16.6l-1.7-1.7M6.1 6.1L4.4 4.4"/>',
    plus:'<path d="M10 4v12M4 10h12"/>',
    pencil:'<path d="M13.6 3.4l3 3-9.7 9.7-3.6.6.6-3.6z"/>',
    trash:'<path d="M3.5 5.5h13M8 5.5V3.8a1 1 0 011-1h2a1 1 0 011 1v1.7"/><path d="M5.3 5.5l.8 11.4a1.4 1.4 0 001.4 1.3h5a1.4 1.4 0 001.4-1.3l.8-11.4"/>',
    print:'<path d="M6 8.5V3h8v5.5"/><rect x="3.5" y="8.5" width="13" height="7" rx="1"/><path d="M6 13h8v4.5H6z"/>',
    download:'<path d="M10 3v10.5M6 10l4 4 4-4"/><path d="M4 16.5h12"/>',
    upload:'<path d="M10 17V6.5M6 10l4-4 4 4"/><path d="M4 16.5h12"/>',
    x:'<path d="M5 5l10 10M15 5L5 15"/>',
    check:'<path d="M4 10.5l4 4 8-9"/>',
    chevron:'<path d="M7 4l6 6-6 6"/>',
    search:'<circle cx="9" cy="9" r="6"/><path d="M17 17l-3.5-3.5"/>',
    arrow:'<path d="M4 10h12M11 5l5 5-5 5"/>',
    building:'<rect x="4" y="3" width="10" height="17" rx=".5"/><path d="M16 9.5h4v10.5h-4z"/><path d="M7 6.5h1.2M10.2 6.5h1.2M7 9.5h1.2M10.2 9.5h1.2M7 12.5h1.2M10.2 12.5h1.2M7 15.5h1.2M10.2 15.5h1.2"/>',
    warn:'<path d="M10 3l8.5 14.5H1.5z"/><path d="M10 8v4.2M10 14.6v.1"/>',
    logout:'<path d="M8 3.5H4.5A1.5 1.5 0 003 5v10a1.5 1.5 0 001.5 1.5H8"/><path d="M13 14l4-4-4-4M17 10H7.5"/>',
    ruler:'<path d="M3 14.5L14.5 3l2.5 2.5L5.5 17z"/><path d="M6.2 11.8l1.6 1.6M8.6 9.4l1.6 1.6M11 7l1.6 1.6"/>',
    idcard:'<rect x="2.5" y="4.5" width="15" height="11" rx="1.6"/><circle cx="7" cy="9" r="1.8"/><path d="M4.3 13c0-1.7 1.2-2.8 2.7-2.8s2.7 1.1 2.7 2.8"/><path d="M11.5 7.8h4M11.5 10.8h4"/>',
    book:'<path d="M3 3.8c1.8-.7 4-.7 6 .4v11.8c-2-1-4.2-1-6-.3V3.8z"/><path d="M17 3.8c-1.8-.7-4-.7-6 .4v11.8c2-1 4.2-1 6-.3V3.8z"/>',
    journal:'<rect x="3" y="2.5" width="14" height="15" rx="1.4"/><path d="M6.5 6.5h7M6.5 9.5h7M6.5 12.5h4"/>',
    link:'<path d="M8.5 11.5a3 3 0 0 0 4.2.3l2-2a3 3 0 0 0-4.2-4.2l-1 1"/><path d="M11.5 8.5a3 3 0 0 0-4.2-.3l-2 2a3 3 0 0 0 4.2 4.2l1-1"/>',
    refresh:'<path d="M3.5 10a6.5 6.5 0 0 1 11-4.6l1.5 1.4"/><path d="M16 3.5v3.6h-3.6"/><path d="M16.5 10a6.5 6.5 0 0 1-11 4.6l-1.5-1.4"/><path d="M4 16.5v-3.6h3.6"/>',
    folder:'<path d="M3 6.2a1 1 0 011-1h4l1.6 2H16a1 1 0 011 1v8.1a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>',
    arrowup:'<path d="M10 16V5.3"/><path d="M5.3 9.8L10 5l4.7 4.8"/>',
    calendar:'<rect x="3" y="4" width="14" height="13.5" rx="1.6"/><path d="M3 8h14"/><path d="M6.5 2.5v3M13.5 2.5v3"/><path d="M6.5 11h1.2M10.4 11h1.2M14.3 11h0M6.5 14h1.2M10.4 14h1.2"/>',
    // V1.85 : Competences (etoile) et Formations (toque de diplome).
    star:'<path d="M10 2.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 15l-4.8 2.4.9-5.4-3.9-3.8 5.4-.8z"/>',
    graduation:'<path d="M10 3L2 7l8 4 8-4z"/><path d="M5.3 9v3.7c0 1.5 2.4 2.6 4.7 2.6s4.7-1.1 4.7-2.6V9"/><path d="M17 8v5.5"/>',
    // V1.87 : Évaluation_Suivi (courbe de progression).
    trend:'<path d="M3 15.5l5-5.5 4 3.5 7-8"/><path d="M13.5 5.5h5.5v5.5"/>',
    // V1.95 : radar de competences par personne (cercles concentriques +
    // reticule, evoque un radar/viseur).
    radar:'<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5"/><path d="M10 2.5v15M2.5 10h15"/>'
  };
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(p[name]||p.file)+'</svg>';
}

/* =========================================================
   ETAT GLOBAL
   ========================================================= */
var STATE = {
  db: null, dbAvailable: null,
  route: 'dashboard',
  // V1.55 : utilisateur authentifie par une vraie session serveur (voir
  // backend/auth.py) - n'est plus jamais lu depuis localStorage, seulement
  // depuis GET /api/auth/me. authReady ne devient vrai qu'une fois ce point
  // tranche (connecte ou pas), pour que render() sache quand il peut
  // decider d'afficher l'ecran de connexion ou l'application.
  currentUser: null,
  authReady: false,
  unsubscribers: [],
  company: defaultCompany(),
  clients: [], devis: [], ctr: [], av: [], att: [], pfa: [], fac: [], avo: [], reg: [], users: [],
  tiersBancaires: [], releves: [], facturesFournisseurs: [], personnel: [], livrables: [], bordereaux: [],
  planComptable: [], ecritures: [], exercicesArchives: [], backlog: [],
  // V1.70 : lignes du module de planification manuelle (remplace le Plan de
  // charge automatique V1.65) - collection generique comme les autres.
  planificationLignes: [],
  // V1.71 : lignes du Timesheet (pointage reel), collection generique
  // totalement independante de planificationLignes ci-dessus.
  timesheetLignes: [],
  // V3.03 : module Etude electrique (consommateurs + valeurs des listes deroulantes).
  etudeConsommateurs: [], etudeListes: [], etudeListeDocs: [], etudeBilanTableaux: [], etudeMatTransfos: [], etudeMatParams: [], etudeMatSources: [], etudeMatConstructeurs: [], etudeMatDisj: [], etudeMatDecl: [], etudeMatAssoc: [], etudeMatReglages: [], etudeBtCircuits: [], etudeBtLiensCaneco: [], etudeSymboles: [], etudeMatDocs: [], etudeMatCourbes: [],
  // V1.65 : liste minimale du Personnel (id/nom/fonction/actif, jamais le
  // salaire) pour le module de planification - chargee via
  // chargerPersonnelLight(), PAS via subscribeCollection (route dediee
  // /api/personnel-light, pas une collection generique).
  personnelLight: [],
  // V1.85 : referentiel des competences (catalogue) et gestion des
  // formations - collections generiques independantes, chargees comme les
  // autres via subscribeCollection() (voir demarrerAbonnements()).
  competencesReferentiel: [], formations: [],
  // V1.86 : categories de competences personnalisables (voir
  // categorieCompetenceLabel() et toutesCategoriesCompetence() plus bas -
  // depuis la V1.88, ce tableau contient aussi les 5 categories d'origine,
  // migrees en vrais documents pour devenir modifiables/supprimables).
  competenceCategories: [],
  // V1.88 : statuts du personnel personnalisables (voir
  // statutPersonnelLabel()/openStatutPersonnelFormModal() plus bas) - meme
  // principe que competenceCategories, mais sans aucune valeur fixe : la
  // liste est entierement definie par l'utilisateur.
  personnelStatuts: [],
  // V1.90 : niveaux attendus (cible, 1 a 5) par statut x competence - un
  // document par statut (id = id du statut), voir niveauAttenduStatut() et
  // setNiveauAttenduStatut() plus bas.
  niveauxAttendusStatuts: [],
  loaded: {clients:false, devis:false, bc:false, ctr:false, av:false, att:false, pfa:false, fac:false, avo:false, reg:false, users:false, company:false, tiersBancaires:false, releves:false, facturesFournisseurs:false, personnel:false, livrables:false, bordereaux:false, planComptable:false, ecritures:false, exercicesArchives:false, backlog:false, planificationLignes:false, timesheetLignes:false, etudeConsommateurs:false, etudeListes:false, etudeListeDocs:false, etudeBilanTableaux:false, etudeMatTransfos:false, etudeMatParams:false, etudeMatSources:false, etudeMatConstructeurs:false, etudeMatDisj:false, etudeMatDecl:false, etudeMatAssoc:false, etudeMatReglages:false, etudeBtCircuits:false, etudeBtLiensCaneco:false, etudeSymboles:false, etudeMatDocs:false, etudeMatCourbes:false, competencesReferentiel:false, formations:false, competenceCategories:false, personnelStatuts:false, niveauxAttendusStatuts:false}
};

// Prefixes et largeurs de sequence par defaut (RG-010 : parametrable sans
// modifier le code, voir STATE.company.seqPrefixes/seqWidths dans les
// Parametres). Cle = type utilise par nextDocNumber().
var SEQ_TYPES = {
  devis:{prefix:'DEV', width:4},
  cmd:  {prefix:'CMD', width:4},
  ctr:  {prefix:'CTR', width:4},
  pfa:  {prefix:'PFA', width:4},
  fac:  {prefix:'FAC', width:5},
  avo:  {prefix:'AVO', width:4},
  enc:  {prefix:'ENC', width:5}
};
// Champs edites sur la page Parametres > Numerotation (RG-010) : un input
// prefixe + largeur par type de document a compteur global (AV/ATT ne sont
// pas ici, ce sont des compteurs locaux au contrat, voir nextLocalSeq()).
var SEQ_NUMBERING_FIELDS = [
  {type:'devis', label:'devis', def:'DEV'},
  {type:'ctr', label:'contrat', def:'CTR'},
  {type:'pfa', label:'proposition facturation', def:'PFA'},
  {type:'fac', label:'facture', def:'FAC'},
  {type:'avo', label:'avoir', def:'AVO'},
  {type:'enc', label:'encaissement', def:'ENC'}
];

function defaultCompany(){
  return {
    nom:'Ma Société BTP', logo:'', ice:'', identifiantFiscal:'', rc:'', cnss:'', patente:'',
    adresse:'', ville:'', telephone:'', email:'', rib:'', banque:'', devise:'MAD',
    tauxTVA:20, tauxRG:10, facturesFournisseursDir:'', facturesFournisseursSourceDir:'', facturesClientsDir:'',
    fichesTechniquesDir:'', // V3.43 : répertoire des fiches techniques du matériel (Étude électrique)
    commandesPiecesJointesDir:'', // V2.04 : stockage de la piece jointe (scan BC/contrat) des commandes clients
    devisImportesDir:'', // V2.11 : stockage des devis deja emis importes (PDF)
    seqPrefixes: {devis:'DEV', ctr:'CTR', pfa:'PFA', fac:'FAC', avo:'AVO', enc:'ENC'},
    seqWidths: {devis:4, ctr:4, pfa:4, fac:5, avo:4, enc:5}
  };
}

/* =========================================================
   UTILITAIRES
   ========================================================= */
function esc(s){
  return String(s===null||s===undefined?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function n2(v){ v=Number(v); if(isNaN(v)) return 0; return Math.round(v*100)/100; }
function fmtMoney2(v){ return n2(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtMoney(v){ return fmtMoney2(v)+' '+(STATE.company.devise||'MAD'); }
function fmtQty(v){ v=Number(v)||0; return v.toLocaleString('fr-FR',{maximumFractionDigits:3}); }
function fmtPct(v){ return n2(v).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' %'; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){
  if(!iso) return '—';
  var d = new Date(iso.length>10?iso:iso+'T00:00:00');
  if(isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtDateTime(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}
function uid(){ return Math.random().toString(36).slice(2,10); }
function byId(id){ return document.getElementById(id); }
function initials(name){
  if(!name) return '?';
  var parts = name.trim().split(/\s+/);
  return (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
function debounce(fn, ms){
  var t; return function(){ var a=arguments, c=this; clearTimeout(t); t=setTimeout(function(){fn.apply(c,a);}, ms); };
}
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }

/* nombre -> lettres (FR) pour arrêté des montants */
var UNITES_FR = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
var DIZAINES_FR = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
function centaineEnLettres(n){
  n = Math.floor(n);
  if(n===0) return '';
  var c = Math.floor(n/100), r = n%100, out=[];
  if(c>0){ out.push(c>1?UNITES_FR[c]+' cent'+(c>1&&r===0?'s':''):'cent'); }
  if(r>0){
    if(r<20){ out.push(UNITES_FR[r]); }
    else {
      var d = Math.floor(r/10), u = r%10;
      if(d===7||d===9){ out.push(DIZAINES_FR[d]+'-'+UNITES_FR[10+u]); }
      else {
        var seg = DIZAINES_FR[d];
        if(u===1 && d!==8) seg += '-et-un'; else if(u>0) seg += '-'+UNITES_FR[u];
        else if(d===8) seg += 's';
        out.push(seg);
      }
    }
  }
  return out.join(' ');
}
function nombreEnLettres(n){
  n = Math.floor(Math.abs(n));
  if(n===0) return 'zéro';
  var groupes = [
    {v:1000000000, s:'milliard'}, {v:1000000, s:'million'}, {v:1000, s:'mille'}, {v:1, s:''}
  ];
  var out=[];
  var reste=n;
  for(var i=0;i<groupes.length;i++){
    var g=groupes[i];
    var q = Math.floor(reste/g.v);
    reste = reste%g.v;
    if(q>0){
      if(g.v===1000 && q===1){ out.push('mille'); }
      else {
        var mot = centaineEnLettres(q);
        out.push(mot + (g.s? ' '+g.s+(q>1&&g.v!==1000?'s':''):''));
      }
    }
  }
  return out.join(' ').replace(/\s+/g,' ').trim();
}
function montantEnLettres(montant){
  var v = n2(montant);
  var entier = Math.floor(v);
  var cent = Math.round((v-entier)*100);
  var devise = STATE.company.devise==='MAD' ? 'dirhams' : (STATE.company.devise||'');
  var txt = nombreEnLettres(entier)+' '+devise;
  if(cent>0) txt += ' et '+nombreEnLettres(cent)+' centimes';
  return txt.charAt(0).toUpperCase()+txt.slice(1);
}

/* =========================================================
   PARSEUR CSV (simple, gère guillemets et ; ou ,)
   ========================================================= */
function parseCSV(text){
  text = text.replace(/^﻿/, '').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  var firstLine = text.split('\n')[0] || '';
  var delim = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
  var rows = [], row = [], field = '', inQuotes = false;
  for(var i=0;i<text.length;i++){
    var c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field+='"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === delim){ row.push(field); field=''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  rows = rows.filter(function(r){ return r.some(function(v){ return String(v).trim()!==''; }); });
  if(!rows.length) return {headers:[], rows:[]};
  var headers = rows[0].map(function(h){ return h.trim(); });
  return {headers: headers, rows: rows.slice(1)};
}

/* =========================================================
   CALCULS METIER
   ========================================================= */
function ligneMontant(l){ return n2((Number(l.qte)||0) * (Number(l.pu)||0)); }
function calcLignesTotal(lignes){
  return n2((lignes||[]).reduce(function(s,l){ return s + ligneMontant(l); }, 0));
}
function calcDocTotals(lignes, tauxTVA, remisePct){
  var brut = calcLignesTotal(lignes);
  var remise = n2(brut * ((Number(remisePct)||0)/100));
  var ht = n2(brut - remise);
  var tva = n2(ht * ((Number(tauxTVA)||0)/100));
  var ttc = n2(ht + tva);
  return {brut:brut, remise:remise, ht:ht, tva:tva, ttc:ttc};
}
function calcFactureTotals(lignes, tauxTVA, tauxRG){
  var t = calcDocTotals(lignes, tauxTVA, 0);
  var rg = n2(t.ttc * ((Number(tauxRG)||0)/100));
  var net = n2(t.ttc - rg);
  return {ht:t.ht, tva:t.tva, ttc:t.ttc, rg:rg, net:net};
}
function attLigneCumul(l){
  var ant = Number(l.qteAnterieure)||0, per = Number(l.qtePeriode)||0;
  var cum = n2(ant+per);
  return {qteCumulee:cum, montantPeriode:n2(per*(Number(l.pu)||0)), montantCumule:n2(cum*(Number(l.pu)||0))};
}
function attTotals(att){
  var lignes = att.lignes||[];
  var periodeHT = 0, cumuleHT = 0, marcheHT = 0;
  lignes.forEach(function(l){
    var c = attLigneCumul(l);
    periodeHT += c.montantPeriode; cumuleHT += c.montantCumule;
    marcheHT += (Number(l.qteMarche)||0)*(Number(l.pu)||0);
  });
  periodeHT = n2(periodeHT); cumuleHT = n2(cumuleHT); marcheHT = n2(marcheHT);
  var tva = n2(periodeHT*((Number(att.tauxTVA)||0)/100));
  var avancement = marcheHT>0 ? n2(cumuleHT/marcheHT*100) : null;
  return {periodeHT:periodeHT, cumuleHT:cumuleHT, marcheHT:marcheHT, tva:tva, ttc:n2(periodeHT+tva), avancement:avancement};
}
function factureReglements(factureId){
  return STATE.reg.filter(function(r){ return r.factureId===factureId && r.statut!=='annule'; });
}
function factureEtat(f){
  // Brouillon (RG-003/P-09) : pas encore de numero officiel ni de montant
  // definitivement engage cote encaissement -> pas de calcul de reste du.
  if(f.statut==='brouillon'){
    return {paye:0, reste:Number(f.net)||0, statut:'Brouillon', tone:'neutral', enRetard:false};
  }
  var regs = factureReglements(f.id);
  var paye = n2(regs.reduce(function(s,r){ return s+(Number(r.montant)||0); }, 0));
  var net = Number(f.net)||0;
  var reste = n2(net - paye);
  var enRetard = reste>0.009 && f.echeance && f.echeance < todayISO();
  var statut, tone;
  if(f.statut==='annulee'){ statut='Annulée'; tone='neutral'; }
  else if(paye<=0.009){ statut = enRetard?'En retard':'Émise'; tone = enRetard?'danger':'primary'; }
  else if(reste<=0.009){ statut='Réglée'; tone='success'; }
  else { statut = enRetard?'Partielle (retard)':'Partielle'; tone='warning'; }
  return {paye:paye, reste:reste, statut:statut, tone:tone, enRetard:enRetard};
}

/* =========================================================
   NUMEROTATION
   Conforme au CDC "Nomenclature, codification et numerotation" : prefixe et
   largeur configurables par type (RG-010), compteurs annuels incrementes de
   facon atomique et transactionnelle cote serveur (RG-001/002 - voir
   POST /api/increment/<doc> dans backend/routes/api.py, qui fait tout le
   cycle lecture-incrementation-ecriture dans UNE seule transaction SQLite,
   contrairement a l'ancien mecanisme get()+set() en deux appels HTTP
   separes qui pouvait perdre un increment en cas d'ecritures concurrentes).
   Les compteurs locaux (version de devis, avenants/attachements d'un
   contrat) suivent le meme principe mais sur un champ du document PARENT
   lui-meme : jamais remis a zero, jamais reutilise (P-05/P-06 du CDC).
   ========================================================= */
function mergeSet(ref, patch){
  return ref.get().then(function(snap){
    var data = snap.exists ? Object.assign({}, snap.data(), patch) : patch;
    return ref.set(data);
  });
}
function seqPrefix(type){
  var o = STATE.company.seqPrefixes || {};
  return o[type] || (SEQ_TYPES[type] ? SEQ_TYPES[type].prefix : type.toUpperCase());
}
function seqWidth(type){
  var o = STATE.company.seqWidths || {};
  return o[type] || (SEQ_TYPES[type] ? SEQ_TYPES[type].width : 4);
}
function bumpCounter(key){
  return STATE.db.doc('meta/counters').increment(key, 1);
}
function nextDocNumber(type){
  var year = new Date().getFullYear();
  var key = type+'_'+year;
  return bumpCounter(key).then(function(seq){
    return seqPrefix(type)+'-'+year+'-'+String(seq).padStart(seqWidth(type),'0');
  });
}
// Compteur local a un document parent (ex. version d'un devis, avenants et
// attachements d'un contrat) : incremente directement un champ du document
// parent via le meme endpoint atomique. Jamais remis a zero, jamais
// reutilise, meme si l'enfant est ensuite annule.
function nextLocalSeq(parentCollection, parentId, field){
  return STATE.db.doc(parentCollection+'/'+parentId).increment(field, 1);
}
function pad2(n){ return String(n).padStart(2,'0'); }

/* =========================================================
   CRUD
   ========================================================= */
function nowISO(){ return new Date().toISOString(); }
function currentUserName(){ return STATE.currentUser ? STATE.currentUser.nom : ''; }

// Lien automatique avec le registre partage Tiers bancaires / Fournisseurs
// (collection 'tiersBancaires') : demande explicite de l'utilisateur
// (capture d'ecran de Parametres > Tiers bancaires / Fournisseurs a
// l'appui, V1.53) - "tout ajout de client, fournisseur ou membre du
// personnel doit etre ajoute a cette liste". Le fournisseur l'est deja
// depuis la V1.16 (meme collection, filtree par type) ; cette fonction
// couvre Client et Personnel, appelee par saveClient/savePersonnel
// ci-dessous a chaque creation ou modification.
//
// Ne bloque JAMAIS la sauvegarde principale du client/personnel en cas
// d'echec (voir les appelants : erreur simplement loguee en console) - ce
// lien est un confort pour le rapprochement bancaire, pas une donnee
// critique du client/personnel lui-meme.
//
// `existing` = fiche telle qu'elle etait AVANT cette sauvegarde (null a la
// creation). Deux cas :
//  - Un homonyme existe deja dans tiersBancaires (meme nom normalise,
//    QUEL QUE SOIT SON TYPE - ex. un fournisseur du meme nom) : on
//    reutilise cette fiche telle quelle ('tiersAuto': false). Une fiche
//    reutilisee n'est alors JAMAIS renommee ni supprimee automatiquement
//    par ce mecanisme, pour ne jamais alterer une fiche qui ne nous
//    appartient pas.
//  - Sinon, une nouvelle fiche est creee ('tiersAuto': true, type 'Client'
//    ou 'Salarié', AUCUN autre champ copie - en particulier jamais le
//    salaire d'une fiche Personnel) : elle est alors suivie automatiquement
//    (renommee si le client/employe est renomme, supprimee si plus aucune
//    autre fiche Client/Personnel ne la reference - voir
//    supprimerTiersAutoSiOrphelin ci-dessous).
function syncTiersPourFiche(col, type, id, nom, existing){
  if(!nom) return Promise.resolve();
  var nomNorm = normNomTiers(nom);
  var tiersId = existing && existing.tiersId;
  var tiersAuto = existing && existing.tiersAuto;
  var ancienNomNorm = (existing && existing.nom) ? normNomTiers(existing.nom) : null;

  if(tiersId && (!tiersAuto || ancienNomNorm===nomNorm)){
    // Fiche reutilisee (jamais touchee), ou fiche a nous dont le nom n'a
    // pas change : rien a faire.
    return Promise.resolve();
  }

  // Ici : soit aucune fiche liee pour l'instant (fiche jamais synchronisee -
  // nouvelle creation, ou fiche existante creee avant cette fonctionnalite
  // et pas encore rattrapee par la migration de demarrage), soit une fiche
  // a nous dont le nom vient de changer - dans les deux cas on redetermine
  // la bonne fiche Tiers pour le nouveau nom (reutilisation d'un homonyme
  // en priorite, sinon creation/renommage de notre propre fiche).
  var ancienneFicheANous = tiersAuto ? tiersId : null;
  var doublon = STATE.tiersBancaires.find(function(x){
    return x.id!==ancienneFicheANous && normNomTiers(x.tiers)===nomNorm;
  });

  var lienPromise;
  if(doublon){
    lienPromise = Promise.resolve({id:doublon.id, auto:false});
  } else if(ancienneFicheANous){
    lienPromise = STATE.db.doc('tiersBancaires/'+ancienneFicheANous).update({motCle:nom, tiers:nom})
      .then(function(){ return {id:ancienneFicheANous, auto:true}; });
  } else {
    lienPromise = STATE.db.collection('tiersBancaires').add({motCle:nom, tiers:nom, type:type, createdAt:nowISO()})
      .then(function(ref){ return {id:ref.id, auto:true}; });
  }

  return lienPromise.then(function(lien){
    var maj = STATE.db.doc(col+'/'+id).update({tiersId:lien.id, tiersAuto:lien.auto});
    if(ancienneFicheANous && lien.id!==ancienneFicheANous){
      // On abandonne notre ancienne fiche auto-creee au profit d'un
      // homonyme deja existant : si plus personne d'autre ne la reference,
      // on la supprime pour ne pas laisser un doublon orphelin derriere.
      maj = maj.then(function(res){
        supprimerTiersAutoSiOrphelin({id:id, tiersId:ancienneFicheANous, tiersAuto:true});
        return res;
      });
    }
    return maj;
  });
}
// Supprime la fiche Tiers bancaires auto-creee liee a `record` (client ou
// personnel) si et seulement si (a) elle a bien ete creee par ce mecanisme
// ('tiersAuto': true - jamais une fiche reutilisee/preexistante) et (b)
// plus aucun autre client, personnel ou facture fournisseur enregistree ne
// la reference. Renvoie 'supprimee', 'conservee' (encore utilisee ailleurs,
// l'appelant peut en informer l'utilisateur) ou null (rien a faire, ex.
// fiche reutilisee). Appelee a la suppression d'un client/personnel, et par
// syncTiersPourFiche ci-dessus lors de l'abandon d'une fiche auto-creee.
function supprimerTiersAutoSiOrphelin(record){
  if(!record || !record.tiersId || !record.tiersAuto) return null;
  // V1.55 : ce controle "utilise ailleurs" ne regarde que les donnees deja
  // chargees cote client (STATE.personnel, STATE.facturesFournisseurs) -
  // desormais vides pour un role qui n'y a pas acces (ex. Commercial, qui
  // peut neanmoins supprimer un Client). Sans ces deux collections, la
  // fiche Tiers liee pourrait sembler orpheline alors qu'elle est en realite
  // encore utilisee par le Personnel ou une facture fournisseur, invisibles
  // pour ce role - on prefere alors conserver la fiche par prudence
  // (nettoyable plus tard par un role qui voit tout) plutot que de risquer
  // une suppression a tort.
  if(!canSee('personnel') || !canSee('facturesF')) return 'conservee';
  var utiliseAilleurs =
    STATE.clients.some(function(x){ return x.id!==record.id && x.tiersId===record.tiersId; }) ||
    STATE.personnel.some(function(x){ return x.id!==record.id && x.tiersId===record.tiersId; }) ||
    STATE.facturesFournisseurs.some(function(f){ return f.fournisseurId===record.tiersId; });
  if(utiliseAilleurs) return 'conservee';
  deleteTiersBancaire(record.tiersId).catch(function(e){ console.error('Suppression fiche Tiers liée :', e); });
  return 'supprimee';
}

// V2.12 : un client doit etre unique (demande explicite de l'utilisateur :
// "les clients ne doivent pas etre en double"). Critere retenu avec lui :
// meme nom (casse/accents/espaces ignores, normNomTiers) OU meme ICE
// (non vide, ponctuation/espaces ignores). Meme logique que l'import Excel
// des clients, qui met deja a jour plutot que de dupliquer.
function normIce(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function findClientDoublon(nom, ice, excludeId){
  var kn = normNomTiers(nom), ki = normIce(ice);
  return STATE.clients.find(function(c){
    if(excludeId && c.id===excludeId) return false;
    if(kn && normNomTiers(c.nom)===kn) return true;
    if(ki && normIce(c.ice)===ki) return true;
    return false;
  }) || null;
}
// Groupes de clients deja en double dans la base (enregistres avant ce
// controle) : regroupement transitif par nom normalise ou ICE normalise.
function detecterDoublonsClients(){
  var n = STATE.clients.length, parent = [];
  for(var i=0;i<n;i++) parent.push(i);
  function find(x){ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; }
  function union(a,b){ a=find(a); b=find(b); if(a!==b) parent[b]=a; }
  var byNom = {}, byIce = {};
  STATE.clients.forEach(function(c, idx){
    var kn = normNomTiers(c.nom), ki = normIce(c.ice);
    if(kn){ if(byNom[kn]!==undefined) union(byNom[kn], idx); else byNom[kn]=idx; }
    if(ki){ if(byIce[ki]!==undefined) union(byIce[ki], idx); else byIce[ki]=idx; }
  });
  var groupes = {};
  STATE.clients.forEach(function(c, idx){ (groupes[find(idx)] = groupes[find(idx)] || []).push(c); });
  return Object.keys(groupes).map(function(k){ return groupes[k]; }).filter(function(g){ return g.length>1; });
}

function saveClient(data, id){
  if(id){
    var existingClient = STATE.clients.find(function(x){ return x.id===id; });
    return STATE.db.doc('clients/'+id).update(data).then(function(res){
      syncTiersPourFiche('clients', 'Client', id, data.nom, existingClient).catch(function(e){ console.error('Sync Tiers bancaires (client) :', e); });
      return res;
    });
  }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('clients').add(data).then(function(ref){
    syncTiersPourFiche('clients', 'Client', ref.id, data.nom, null).catch(function(e){ console.error('Sync Tiers bancaires (client) :', e); });
    return ref;
  });
}
// Registre Personnel (employes de l'entreprise - n'ont pas de compte dans
// cette application, a la difference de la collection 'users') : meme
// semantique de suppression physique que clients/tiersBancaires/users,
// registre independant (pas de lien avec les chantiers pour l'instant).
// Depuis la V1.53, chaque fiche est aussi liee au registre Tiers bancaires /
// Fournisseurs (voir syncTiersPourFiche) - jamais le champ salaire, qui
// reste uniquement ici.
function savePersonnel(data, id){
  if(id){
    var existingPersonnel = STATE.personnel.find(function(x){ return x.id===id; });
    return STATE.db.doc('personnel/'+id).update(data).then(function(res){
      syncTiersPourFiche('personnel', 'Salarié', id, data.nom, existingPersonnel).catch(function(e){ console.error('Sync Tiers bancaires (personnel) :', e); });
      // V1.65 : rafraichit immediatement la liste minimale (nom/fonction)
      // utilisee par le module de planification - sinon un nom modifie ici
      // ne serait visible dans le formulaire d'un livrable qu'a la
      // prochaine ouverture de CE formulaire-la (voir chargerPersonnelLight()).
      chargerPersonnelLight();
      return res;
    });
  }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('personnel').add(data).then(function(ref){
    syncTiersPourFiche('personnel', 'Salarié', ref.id, data.nom, null).catch(function(e){ console.error('Sync Tiers bancaires (personnel) :', e); });
    chargerPersonnelLight();
    return ref;
  });
}
// Suppression physique reservee aux donnees non documentaires (clients,
// utilisateurs). Pour tout document du perimetre CDC (devis, commande,
// contrat, avenant, attachement, PFA, facture, avoir, encaissement), RG-004
// et RG-005 interdisent la suppression : on utilise cancelDoc() ci-dessous,
// qui bascule le document sur son statut "Annule" en conservant sa
// reference et son historique.
function deleteDoc(col, id){ return STATE.db.doc(col+'/'+id).delete(); }
// Remplace la suppression pour tout document numerote du CDC : conserve la
// reference ERP (jamais reutilisee, P-05) et l'historique, se contente de
// changer le statut.
function cancelDoc(col, id, statutField, cancelValue){
  var patch = {}; patch[statutField||'statut'] = cancelValue||'annule';
  patch.updatedAt = nowISO(); patch.annulePar = currentUserName(); patch.annuleAt = nowISO();
  return STATE.db.doc(col+'/'+id).update(patch);
}

function saveDevis(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('devis/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  data.versionSeq = 1; // V01 : compteur local au devis (P-08, section 6.1)
  return nextDocNumber('devis').then(function(numero){
    data.numero = numero;
    return STATE.db.collection('devis').add(data);
  });
}
// Nouvelle edition externe d'un devis deja transmis : le numero racine ne
// change pas, seule la version locale s'incremente (V01 -> V02 -> ...),
// jamais remise a zero (section 6.1/6.2 du CDC).
function newDevisVersion(devisId){
  return nextLocalSeq('devis', devisId, 'versionSeq');
}

// V2.14 : la Commande client n'existe plus (saveBC/newBCVersion/
// ensureContratForCmd supprimes) - le Contrat est le document d'engagement
// unique, cree directement depuis un devis accepte (bouton « Créer Contrat »
// du devis) ou manuellement. Il porte les lignes, la TVA, l'origine de
// l'engagement, la reference client et la piece jointe qui vivaient sur la
// commande ; voir la migration backend/db.py pour les commandes existantes.
function saveCTR(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('contrats/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  data.avSeq = 0; data.attSeq = 0;
  // V2.09 : compteur de version local au contrat, meme principe que le
  // Devis (versionSeq) - independant des Avenants, qui restent le
  // mecanisme pour les modifications contractuelles substantielles.
  data.versionSeq = 1;
  return nextDocNumber('ctr').then(function(numero){
    data.numero = numero;
    return STATE.db.collection('contrats').add(data);
  });
}
// Montant TTC d'un contrat : calcule depuis ses lignes (V2.14) ; repli sur
// l'ancien champ « Montant contractuel » saisi a la main pour un contrat
// anterieur a la V2.14 qui n'a pas de lignes.
function ctrMontantTTC(d){
  if(d && d.lignes && d.lignes.length) return calcDocTotals(d.lignes, d.tauxTVA, 0).ttc||0;
  return Number(d && d.montant)||0;
}
// V2.09 : "Nouvelle version" du Contrat, a l'identique de newDevisVersion/
// newBCVersion ci-dessus - le numero racine (CTR-AAAA-NNNN) ne change pas,
// seul le compteur local versionSeq avance (jamais remis a zero). Sans
// rapport avec les Avenants (avSeq), qui restent le mecanisme pour les
// modifications contractuelles substantielles.
function newCTRVersion(ctrId){
  return nextLocalSeq('contrats', ctrId, 'versionSeq');
}

// V2.14 : lit le contrat rattache (numero officiel a reprendre dans le numero
// de l'avenant / de l'attachement : CTR-AAAA-NNNN-AVxx / -ATTxx).
function getContratById(ctrId){
  return STATE.db.doc('contrats/'+ctrId).get().then(function(snap){
    return Object.assign({id:ctrId}, snap.data()||{});
  });
}
function saveAV(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('avenants/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return getContratById(data.ctrId).then(function(ctr){
    data.ctrId = ctr.id; data.ctrNumero = ctr.numero;
    return nextLocalSeq('contrats', ctr.id, 'avSeq').then(function(seq){
      data.numero = ctr.numero+'-AV'+pad2(seq);
      return STATE.db.collection('avenants').add(data);
    });
  });
}

function saveAtt(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('attachements/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return getContratById(data.ctrId).then(function(ctr){
    data.ctrId = ctr.id; data.ctrNumero = ctr.numero;
    return nextLocalSeq('contrats', ctr.id, 'attSeq').then(function(seq){
      data.numero = ctr.numero+'-ATT'+pad2(seq);
      return STATE.db.collection('attachements').add(data);
    });
  });
}

function savePFA(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('propositionsFacturation/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return nextDocNumber('pfa').then(function(numero){
    data.numero = numero;
    return STATE.db.collection('propositionsFacturation').add(data);
  });
}

// Facture : le numero definitif n'est attribue qu'a la validation/emission
// comptable (P-09, RG-003), jamais a la simple creation du brouillon. Tant
// que la facture reste "brouillon", elle n'a pas de numero FAC et son
// contenu reste librement modifiable.
function saveFacture(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('factures/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  data.statut = data.statut || 'brouillon';
  data.numero = '';
  return STATE.db.collection('factures').add(data);
}
// Attribution du numero definitif + verrouillage (RG-003) : a partir de ce
// moment le numero ne peut plus etre modifie, supprime ni reaffecte, et le
// contenu de la facture est en lecture seule.
function validateFacture(id){
  return nextDocNumber('fac').then(function(numero){
    return STATE.db.doc('factures/'+id).update({
      numero: numero, statut: 'validee', verrouillee: true,
      valideePar: currentUserName(), valideeAt: nowISO()
    }).then(function(){
      // Comptabilite (V1.32) : ecriture de vente generee automatiquement a
      // la validation, a partir du contenu desormais verrouille de la facture.
      return STATE.db.doc('factures/'+id).get();
    }).then(function(snap){
      genererEcritureFacture(Object.assign({id:id}, snap.data()));
      return numero;
    });
  });
}

function saveAVO(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('avoirs/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return nextDocNumber('avo').then(function(numero){
    data.numero = numero;
    return STATE.db.collection('avoirs').add(data);
  });
}

function saveReglement(data, id){
  if(id){ return STATE.db.doc('reglements/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  data.statut = data.statut || 'valide';
  return nextDocNumber('enc').then(function(numero){
    data.numero = numero;
    return STATE.db.collection('reglements').add(data).then(function(ref){
      // Comptabilite (V1.32) : ecriture de tresorerie (banque ou caisse
      // selon le mode) generee automatiquement a la creation.
      genererEcritureEncaissement(Object.assign({id:ref.id}, data));
      return ref;
    });
  });
}
function saveUser(data, id){
  if(id) return STATE.db.doc('users/'+id).update(data);
  data.createdAt = nowISO();
  return STATE.db.collection('users').add(data);
}
function saveCompany(patch){
  return mergeSet(STATE.db.doc('settings/company'), patch);
}

// Module Relevés bancaires : mots-clés de rapprochement (hors périmètre CDC,
// suppression physique comme pour clients/users) et historique des imports.
function saveTiersBancaire(data, id){
  if(id) return STATE.db.doc('tiersBancaires/'+id).update(data);
  data.createdAt = nowISO();
  return STATE.db.collection('tiersBancaires').add(data);
}
function deleteTiersBancaire(id){ return STATE.db.doc('tiersBancaires/'+id).delete(); }

function saveReleve(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('releves/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('releves').add(data);
}
function deleteReleve(id){ return STATE.db.doc('releves/'+id).delete(); }

// Module Factures fournisseurs : registre hors perimetre CDC (suppression
// physique comme pour clients/users/tiersBancaires/releves).
function saveFactureFournisseur(data, id){
  if(id){ data.updatedAt = nowISO(); return STATE.db.doc('facturesFournisseurs/'+id).update(data); }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('facturesFournisseurs').add(data).then(function(ref){
    // Comptabilite (V1.32) : ecriture d'achat generee automatiquement a
    // l'enregistrement, seulement si les montants HT/TVA/TTC sont coherents
    // (sinon signalee dans le Journal comptable pour generation ulterieure).
    genererEcritureFactureFournisseur(Object.assign({id:ref.id, fournisseurNom: fournisseurNomById(data.fournisseurId)}, data));
    return ref;
  });
}
function deleteFactureFournisseur(id){ return STATE.db.doc('facturesFournisseurs/'+id).delete(); }

// Reglement (paiement) des factures fournisseurs (V1.33) : stocke comme un
// tableau de reglements DIRECTEMENT sur la fiche facture fournisseur
// (reglements[]), plutot qu'un registre separe comme Encaissements cote
// client - choix explicite de l'utilisateur (statut simple sur la facture),
// tout en permettant plusieurs reglements partiels sur la meme facture.
// Chaque reglement genere sa propre ecriture (debit Fournisseurs / credit
// Banque ou Caisse), jamais modifiee : une suppression genere une
// contre-ecriture (meme principe que le reste de l'application).
function factureFournisseurEtat(f){
  var regs = f.reglements || [];
  var paye = n2(regs.reduce(function(s,r){ return s+(Number(r.montant)||0); }, 0));
  var ttc = Number(f.montantTTC);
  if(ttc==null || isNaN(ttc)) return {paye:paye, reste:null, statut:'—', tone:'neutral'};
  var reste = n2(ttc - paye);
  var statut, tone;
  if(paye<=0.009){ statut='Non payée'; tone='neutral'; }
  else if(reste<=0.009){ statut='Payée'; tone='success'; }
  else { statut='Partielle'; tone='warning'; }
  return {paye:paye, reste:reste, statut:statut, tone:tone};
}

function ajouterReglementFactureFournisseur(f, data){
  var reglement = Object.assign({
    id: uid(), createdAt: nowISO(), creePar: currentUserName()
  }, data);
  var reglements = (f.reglements || []).concat([reglement]);
  return STATE.db.doc('facturesFournisseurs/'+f.id).update({reglements: reglements}).then(function(){
    genererEcritureReglementFournisseur(Object.assign({
      numero: f.numero, fournisseurNom: fournisseurNomById(f.fournisseurId)
    }, reglement));
    return reglement;
  });
}

function supprimerReglementFactureFournisseur(f, reglementId){
  var reglements = (f.reglements || []).filter(function(r){ return r.id!==reglementId; });
  return STATE.db.doc('facturesFournisseurs/'+f.id).update({reglements: reglements}).then(function(){
    genererContreEcritureSiExiste('reglementFournisseur', reglementId);
  });
}
function factureFournisseurFileUrl(f){
  if(!f || !f.fileRelPath) return '';
  return '/api/facture-fournisseur/file/'+f.fileRelPath.split('/').map(encodeURIComponent).join('/');
}
// Meme principe que factureFournisseurFileUrl ci-dessus, pour les factures
// CLIENTS importees (module Factures, V1.45) : seules les factures issues
// d'un import portent un fileRelPath (le PDF d'origine deja classe sur
// disque, voir backend/routes/facture_client.py) - une facture creee
// normalement dans l'application n'en a pas (elle n'existe que sous forme
// imprimee a la demande, cf. factureClientFileUrl appele conditionnellement
// dans renderFactures).
function factureClientFileUrl(f){
  if(!f || !f.fileRelPath) return '';
  return '/api/facture-client/file/'+f.fileRelPath.split('/').map(encodeURIComponent).join('/');
}
// V2.11 : meme principe, pour le PDF d'origine d'un devis importe (voir
// backend/routes/devis_import.py) - import de devis deja emis, a
// l'identique du module Factures clients.
function devisImporteFileUrl(d){
  if(!d || !d.fileRelPath) return '';
  return '/api/devis-import/file/'+d.fileRelPath.split('/').map(encodeURIComponent).join('/');
}
// V2.04 : meme principe, pour la piece jointe (scan BC/contrat) d'une
// Commande client - desormais un vrai fichier sur disque
// (pieceJointeRelPath, voir backend/routes/commande_client.py) plutot
// qu'un base64 embarque dans le document. Une commande enregistree avant
// la V2.04 n'a pas de pieceJointeRelPath : repli sur l'ancien champ
// pieceJointeData (base64, encore lisible en l'etat, jamais migre) - voir
// openBCFormModal.
function commandePieceJointeUrl(d){
  if(!d || !d.pieceJointeRelPath) return '';
  // V2.06 : transmet le nom d'origine du fichier (pieceJointeNom) au
  // serveur via ?name=..., pour que le telechargement propose ce nom
  // lisible plutot que le nom classe sur disque (voir get_piece_jointe()).
  return '/api/commande-client/piece-jointe/'+d.pieceJointeRelPath.split('/').map(encodeURIComponent).join('/')+
    (d.pieceJointeNom? '?name='+encodeURIComponent(d.pieceJointeNom) : '');
}
function fournisseurNomById(id){
  var t = STATE.tiersBancaires.find(function(x){ return x.id===id; });
  return t ? t.tiers : '';
}
// Normalisation pour comparer deux noms de tiers sans tenir compte de la
// casse, des accents ni des espaces superflus (RG : "un fournisseur doit
// etre unique" - "Marjane Market" / "MARJANE MARKET" / "Marjané  Market"
// doivent etre reconnus comme le meme fournisseur).
function normNomTiers(s){
  return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
// Normalisation du numero de facture pour la detection de doublon (RG :
// "une facture doit etre unique" - meme fournisseur + meme numero, casse et
// espaces superflus ignores).
function normNumeroFacture(s){
  return (s||'').trim().toLowerCase().replace(/\s+/g,' ');
}
// Cherche, parmi les factures fournisseurs DEJA ENREGISTREES, un doublon
// (meme fournisseur + meme numero normalise) autre que `excludeId` (utilise
// lors de la modification d'une facture existante, pour ne pas se comparer
// a elle-meme). Un numero vide n'est jamais considere comme un doublon
// (trop de factures n'ont pas de numero lisible).
function findFactureFournisseurDoublon(fournisseurId, numero, excludeId){
  var cle = normNumeroFacture(numero);
  if(!fournisseurId || !cle) return null;
  return STATE.facturesFournisseurs.find(function(f){
    return f.id !== excludeId && f.fournisseurId === fournisseurId && normNumeroFacture(f.numero) === cle;
  }) || null;
}
// Cherche, parmi TOUTES les factures CLIENTS deja enregistrees (tous
// statuts), une autre facture portant le meme numero normalise, autre que
// `excludeId` - utilise lors du changement du numero d'une facture
// importee (V1.50, demande explicite : "le numero doit etre unique").
// Different du controle cote fournisseurs (unicite verifiee uniquement par
// fournisseur, puisque ce sont alors des numeros attribues independamment
// par CHACUN des fournisseurs) : ici le numero est celui que NOTRE PROPRE
// societe a attribue a sa facture - il doit donc rester unique sur
// l'ensemble des factures clients, tous clients confondus.
function findFactureClientDoublon(numero, excludeId){
  var cle = normNumeroFacture(numero);
  if(!cle) return null;
  return STATE.fac.find(function(f){
    return f.id !== excludeId && normNumeroFacture(f.numero) === cle;
  }) || null;
}
// V2.05 : controles d'unicite pour la modification manuelle (reservee a
// l'administrateur, voir isAdmin() et backend/access.py) du numero officiel
// d'un Devis/Commande client/Contrat - meme principe que
// findFactureClientDoublon ci-dessus (unicite globale a toute la
// collection, comparaison normalisee via normNumeroFacture).
function findDevisDoublon(numero, excludeId){
  var cle = normNumeroFacture(numero);
  if(!cle) return null;
  return STATE.devis.find(function(d){ return d.id !== excludeId && normNumeroFacture(d.numero) === cle; }) || null;
}
function findCTRDoublon(numero, excludeId){
  var cle = normNumeroFacture(numero);
  if(!cle) return null;
  return STATE.ctr.find(function(d){ return d.id !== excludeId && normNumeroFacture(d.numero) === cle; }) || null;
}
// Detecte, parmi les fiches fournisseurs existantes, les doublons de nom
// (RG : un fournisseur doit etre unique) - utile pour signaler les
// doublons deja presents avant meme toute nouvelle saisie (voir bandeau
// d'avertissement sur la page Fournisseurs).
function detecterDoublonsFournisseurs(){
  var groupes = {};
  STATE.tiersBancaires.forEach(function(t){
    if((t.type||'').trim().toLowerCase()!=='fournisseur') return;
    var cle = normNomTiers(t.tiers);
    if(!cle) return;
    (groupes[cle] = groupes[cle] || []).push(t);
  });
  return Object.keys(groupes).map(function(k){ return groupes[k]; }).filter(function(g){ return g.length>1; });
}
// Detecte, parmi les factures fournisseurs deja enregistrees, les doublons
// (meme fournisseur + meme numero normalise) - RG : une facture doit etre
// unique. Un numero vide n'est jamais compte comme doublon (trop de
// factures n'ont pas de numero lisible pour que ce soit significatif).
function detecterDoublonsFactures(){
  var groupes = {};
  STATE.facturesFournisseurs.forEach(function(f){
    var cle = normNumeroFacture(f.numero);
    if(!f.fournisseurId || !cle) return;
    var k = f.fournisseurId+'|'+cle;
    (groupes[k] = groupes[k] || []).push(f);
  });
  return Object.keys(groupes).map(function(k){ return groupes[k]; }).filter(function(g){ return g.length>1; });
}
// Bandeau d'avertissement generique (meme presentation pour les doublons
// fournisseurs et factures) - `lignesHtml` est une liste de <li> deja
// construite par l'appelant.
function doublonsBannerHtml(titre, lignesHtml){
  return '<div style="border:1px solid var(--warning);background:rgba(234,179,8,0.10);'+
    'border-radius:8px;padding:10px 14px;margin:-4px 0 12px;font-size:13px;">'+
    '<strong style="display:flex;align-items:center;gap:6px;">'+ic('warn',14)+' '+esc(titre)+'</strong>'+
    '<ul style="margin:6px 0 0;padding-left:20px;">'+lignesHtml+'</ul>'+
  '</div>';
}
// Modele de zones ("apprentissage" de mise en page, voir openZonesEditorModal) :
// un fournisseur a un modele exploitable s'il a au moins une zone enregistree.
function fournisseurZonesModel(id){
  var t = STATE.tiersBancaires.find(function(x){ return x.id===id; });
  return (t && t.modeleZones && t.modeleZones.zones && t.modeleZones.zones.length) ? t.modeleZones : null;
}
function fournisseurHasZonesModel(id){ return !!fournisseurZonesModel(id); }
// Deplace/renomme sur disque le fichier d'une ligne de facture fournisseur
// vers data/factures_fournisseurs/<annee>/<mois>/AAAA_MM_JJ_Fournisseur_Numero.ext,
// a partir des valeurs finales (confirmees par l'utilisateur). Appele a
// l'enregistrement d'une nouvelle facture ET a chaque modification
// ulterieure d'une facture deja enregistree (si fournisseur/date/numero
// changent, le fichier est re-deplace en consequence).
function finalizeFactureFournisseurFile(currentRelPath, fournisseurNom, date, numero){
  return fetch('/api/facture-fournisseur/finalize-file', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({currentRelPath:currentRelPath, fournisseurNom:fournisseurNom, date:date, numero:numero})
  }).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  });
}

/* =========================================================
   BOOT / ABONNEMENTS TEMPS REEL
   ========================================================= */
var renderScheduled = false;
function scheduleRender(){
  if(renderScheduled) return;
  renderScheduled = true;
  Promise.resolve().then(function(){ renderScheduled=false; render(); });
}
// V1.55 : une collection n'est desormais abonnee que si le role courant y a
// au moins un acces en lecture (voir ACCESS, charge depuis le serveur) -
// avant cette version, TOUTES les collections etaient interrogees pour
// TOUT LE MONDE en permanence (toutes les 2 secondes), y compris des
// donnees sensibles (ex. salaires du Personnel) pour des roles qui ne
// devaient meme pas les voir dans l'interface : seul l'AFFICHAGE etait
// filtre, pas le chargement reel en memoire du navigateur. Ce n'est plus le
// cas : la donnee elle-meme n'est plus chargee du tout si le role n'y a pas
// droit (et de toute facon revérifié cote serveur a chaque requete, voir
// backend/access.py).
function subscribeCollection(key, section, path){
  if(!canSee(section)){
    STATE[key] = [];
    STATE.loaded[key] = true;
    return;
  }
  var unsub = STATE.db.collection(path).onSnapshot(function(qs){
    STATE[key] = qs.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    STATE.loaded[key] = true;
    scheduleRender();
  }, function(err){
    console.error(key, err);
    if(err && err.status===401){ forcerDeconnexion(); return; }
    // 403 : le role n'a (plus) le droit de lire cette collection ; 404 : le
    // module correspondant vient d'etre desactive (V1.57, voir
    // backend/modules.py) - dans les deux cas, ne doit normalement pas
    // arriver si ACCESS/les modules sont a jour cote client (brieve fenetre
    // possible juste avant un rechargement de page suite a un changement
    // de configuration), mais on ne spamme pas de toast pour autant (ce
    // n'est pas une panne).
    if(!err || (err.status!==403 && err.status!==404)){ toast('Synchronisation indisponible ('+key+')', 'danger'); }
  });
  STATE.unsubscribers.push(unsub);
}
// V1.65 : liste minimale du Personnel (id/nom/fonction/actif, jamais le
// salaire) pour le module de planification - voir /api/personnel-light
// (backend/routes/api.py) et backend/access.py (rattachee a la section
// 'livrables', pas 'personnel'). Simple fetch ponctuel (pas de polling en
// continu comme subscribeCollection : ce referentiel change rarement),
// rappelable a tout moment (ex. a l'ouverture du formulaire d'un livrable)
// pour rafraichir la liste sans attendre un redemarrage de l'application.
function chargerPersonnelLight(){
  if(!canSee('livrables')){ STATE.personnelLight = []; return Promise.resolve(STATE.personnelLight); }
  return fetch('/api/personnel-light').then(function(r){
    if(!r.ok) throw new Error('http '+r.status);
    return r.json();
  }).then(function(rows){
    STATE.personnelLight = Array.isArray(rows) ? rows : [];
    scheduleRender();
    return STATE.personnelLight;
  }).catch(function(e){ console.error('personnel-light', e); return STATE.personnelLight; });
}
// Arrete tous les abonnements de polling en cours (deconnexion, ou session
// expiree detectee en cours d'utilisation) - sans cela, le polling de 2s
// continuerait d'interroger une API qui repondrait 401 en boucle apres le
// retour a l'ecran de connexion.
function arreterAbonnements(){
  STATE.unsubscribers.forEach(function(fn){ try{ fn(); }catch(e){} });
  STATE.unsubscribers = [];
}
function forcerDeconnexion(){
  arreterAbonnements();
  STATE.currentUser = null;
  STATE.sessionMessage = 'Votre session a expiré, merci de vous reconnecter.';
  scheduleRender();
}
function boot(){
  var root = byId('app');
  root.innerHTML = '<div class="picker-screen"><div class="card card-pad" style="text-align:center;max-width:380px;">'+
    '<div class="brand-mark" style="margin:0 auto 14px;">'+ic('building',20)+'</div>'+
    "<h2>Chargement…</h2><p class=\"muted\" style=\"margin-top:8px;\">Connexion en cours à l'espace de données.</p></div></div>";
  // V1.40 : avant tout acces aux donnees, verifie si l'assistant de premier
  // demarrage (choix de l'emplacement de la base de donnees + reprise
  // eventuelle d'une version precedente) doit etre propose. S'il echoue a
  // repondre (serveur tres ancien, erreur reseau...), ne bloque jamais le
  // demarrage normal de l'application pour autant.
  fetch('/api/db/assistant-initial').then(function(r){ return r.json(); }).then(function(st){
    if(!st.termine){ renderAssistantInitial(st); return; }
    bootAuth();
  }).catch(function(err){ console.error(err); bootAuth(); });
}
// V1.55 : remplace l'ancien "choix de profil + PIN" (jamais verifie que
// cote navigateur) par une vraie authentification - voir
// claude/architecture-cloud-securite.md. Determine s'il faut proposer la
// creation du tout premier compte administrateur, ou l'ecran de connexion
// habituel, avant de charger quoi que ce soit.
// Initialise STATE.db une seule fois (idempotent) - necessaire aussi bien
// pour le formulaire de premier compte (saveUser utilise STATE.db) que pour
// les abonnements ulterieurs de bootApp(). Renvoie une promesse resolue a
// true/false selon que la connexion a reussi (jamais rejetee).
var _dbInitPromise = null;
function ensureDb(){
  if(_dbInitPromise) return _dbInitPromise;
  _dbInitPromise = new Promise(function(resolve){
    if(!window.claude || !window.claude.use){ resolve(false); return; }
    window.claude.use('db').then(function(db){
      if(!db){ resolve(false); return; }
      STATE.db = db; STATE.dbAvailable = true;
      resolve(true);
    }).catch(function(err){ console.error(err); resolve(false); });
  });
  return _dbInitPromise;
}
function bootAuth(){
  ensureDb().then(function(ok){
    if(!ok){ renderNoDb(); return; }
    fetch('/api/auth/status').then(function(r){ return r.json(); }).then(function(st){
      if(st.needsFirstUser){ STATE.authReady = true; renderFirstAccount(); return; }
      fetch('/api/auth/me').then(function(r){ return r.json(); }).then(function(res){
        STATE.authReady = true;
        if(res && res.user){ STATE.currentUser = res.user; bootApp(); }
        else { scheduleRender(); }
      });
    }).catch(function(err){ console.error(err); STATE.authReady = true; scheduleRender(); });
  });
}
function bootApp(){
  ensureDb().then(function(ok){
    if(!ok){ renderNoDb(); return; }
    // Matrice d'autorisation canonique (voir backend/access.py) : chargee
    // AVANT tout abonnement, pour que subscribeCollection sache tout de
    // suite quelles collections ce role a le droit de lire.
    fetch('/api/auth/access-matrix').then(function(r){ return r.json(); }).then(function(res){
      Object.keys(ACCESS).forEach(function(k){ delete ACCESS[k]; });
      Object.assign(ACCESS, (res && res.access) || {});
      chargerProfilsRoles(res);
      demarrerAbonnements();
    }).catch(function(err){ console.error(err); demarrerAbonnements(); });
  });
}
function demarrerAbonnements(){
  subscribeCollection('clients','clients','clients');
  subscribeCollection('devis','devis','devis');
  subscribeCollection('ctr','ctr','contrats');
  subscribeCollection('av','av','avenants');
  subscribeCollection('att','att','attachements');
  subscribeCollection('livrables','livrables','livrables');
  subscribeCollection('bordereaux','livrables','bordereaux');
  subscribeCollection('pfa','pfa','propositionsFacturation');
  subscribeCollection('fac','fac','factures');
  subscribeCollection('avo','avo','avoirs');
  subscribeCollection('reg','reg','reglements');
  subscribeCollection('users','settings','users');
  subscribeCollection('tiersBancaires','tiersBancaires','tiersBancaires');
  subscribeCollection('releves','releves','releves');
  subscribeCollection('facturesFournisseurs','facturesF','facturesFournisseurs');
  subscribeCollection('personnel','personnel','personnel');
  subscribeCollection('planComptable','planComptable','planComptable');
  subscribeCollection('ecritures','ecritures','ecritures');
  subscribeCollection('exercicesArchives','exercicesArchives','exercicesArchives');
  subscribeCollection('backlog','settings','backlog');
  // V1.70 : lignes du module de planification manuelle (Plan de charge),
  // meme mecanisme que 'bordereaux' - voir COLLECTION_SECTION ci-dessus.
  subscribeCollection('planificationLignes','planification','planificationLignes');
  // V1.71 : lignes du Timesheet (pointage reel), collection independante.
  subscribeCollection('timesheetLignes','timesheet','timesheetLignes');
  // V3.03 : Etude electrique.
  subscribeCollection('etudeConsommateurs','etude_elec','etudeConsommateurs');
  subscribeCollection('etudeListes','etude_elec','etudeListes');
  subscribeCollection('etudeListeDocs','etude_elec','etudeListeDocs');
  subscribeCollection('etudeBilanTableaux','etude_elec','etudeBilanTableaux');
  subscribeCollection('etudeBtCircuits','etude_elec','etudeBtCircuits');
  subscribeCollection('etudeBtLiensCaneco','etude_elec','etudeBtLiensCaneco');
  subscribeCollection('etudeSymboles','etude_elec','etudeSymboles');
  subscribeCollection('etudeMatDocs','etude_elec','etudeMatDocs');
  subscribeCollection('etudeMatCourbes','etude_elec','etudeMatCourbes');
  subscribeCollection('etudeMatTransfos','etude_elec','etudeMatTransfos');
  subscribeCollection('etudeMatParams','etude_elec','etudeMatParams');
  subscribeCollection('etudeMatSources','etude_elec','etudeMatSources');
  // V3.11 : protections BT (disjoncteurs / declencheurs par constructeur).
  ['etudeMatConstructeurs','etudeMatDisj','etudeMatDecl','etudeMatAssoc','etudeMatReglages'].forEach(function(n){ subscribeCollection(n,'etude_elec',n); });
  // V1.85 : referentiel des competences et formations - sections ACCESS
  // dediees (admin + role "rh"), voir backend/access.py.
  subscribeCollection('competencesReferentiel','competences','competencesReferentiel');
  subscribeCollection('formations','formations','formations');
  // V1.86 : categories de competences personnalisables.
  subscribeCollection('competenceCategories','competences','competenceCategories');
  // V1.88 : statuts du personnel personnalisables - rattaches a la section
  // ACCESS "personnel" (memes droits que le registre Personnel lui-meme).
  subscribeCollection('personnelStatuts','personnel','personnelStatuts');
  // V1.90 : niveaux attendus par statut x competence - rattaches a la
  // section ACCESS "competences" (memes droits que le reste du module
  // competences, PAS "personnel" - voir niveauAttenduStatut() plus bas
  // pour le detail de cette distinction deliberee).
  subscribeCollection('niveauxAttendusStatuts','competences','niveauxAttendusStatuts');
  // V1.65 : liste minimale du Personnel pour le module de planification -
  // chargee une seule fois au demarrage (pas un abonnement en continu,
  // simple fetch ponctuel), seulement pour les roles qui peuvent deja
  // ecrire les Livrables techniques (voir chargerPersonnelLight()).
  if(canSee('livrables')) chargerPersonnelLight();
  if(canSee('settings')){
    var unsub = STATE.db.doc('settings/company').onSnapshot(function(snap){
      STATE.company = Object.assign(defaultCompany(), snap.exists ? snap.data() : {});
      STATE.loaded.company = true;
      scheduleRender();
    }, function(err){
      console.error('company', err);
      if(err && err.status===401) forcerDeconnexion();
    });
    STATE.unsubscribers.push(unsub);
  } else {
    // Role sans acces a Parametres (V1.55) : le nom de la societe ne peut
    // plus etre lu (c'etait deja l'intention de la matrice ACCESS.settings
    // d'origine, simplement jamais appliquee cote serveur) - repli discret
    // sur le nom generique deja prevu par defaultCompany(), sans bloquer
    // l'affichage.
    STATE.loaded.company = true;
  }
  scheduleRender();
}
function renderNoDb(){
  STATE.dbAvailable = false;
  byId('app').innerHTML = '<div class="picker-screen"><div class="card card-pad" style="max-width:440px;text-align:center;">'+
    '<div class="brand-mark" style="margin:0 auto 14px;color:var(--danger);background:var(--danger-soft);">'+ic('warn',20)+'</div>'+
    '<h2>Connexion indisponible</h2>'+
    '<p class="muted" style="margin-top:10px;">Impossible de joindre le serveur local de Chantier ERP. Vérifiez qu’il est bien démarré (lancer_windows.bat / lancer_mac_linux.sh), puis rechargez cette page.</p>'+
    '</div></div>';
}
// Assistant de premier demarrage (V1.40) : propose le choix de
// l'emplacement de la base de donnees et la reprise eventuelle d'une
// version precedente AVANT l'ecran de connexion habituel (voir boot()).
// 'st' est la reponse de GET /api/db/assistant-initial.
function renderAssistantInitial(st){
  var root = byId('app');
  // V4.1 : filtre par version majeure (V2 / V3 / V4) au-dessus de la liste : on choisit la
  // famille, puis toutes les anciennes bases correspondantes s'affichent (la plus récente d'abord).
  var aiMajeure = null;
  function majeureDe(f){ var m = /^V(\d+)/i.exec(f.version||''); return m ? m[1] : '?'; }
  function versionsRowsHtml(liste){
    if(!liste || !liste.length) return '<p class="hint" id="ai-aucune-detectee">Aucune base de données d’une version précédente détectée dans ce répertoire.</p>';
    var majeures = [];
    liste.forEach(function(f){ var m = majeureDe(f); if(majeures.indexOf(m)<0) majeures.push(m); });
    majeures.sort(function(a,b){ return (parseInt(b,10)||0)-(parseInt(a,10)||0); });
    if(!aiMajeure || majeures.indexOf(aiMajeure)<0) aiMajeure = majeures[0];
    var barre = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;"><span class="hint" style="margin:0;">Version :</span>'+
      majeures.map(function(m){
        var n = liste.filter(function(f){ return majeureDe(f)===m; }).length;
        return '<button type="button" class="btn btn-sm'+(m===aiMajeure?' btn-primary':'')+'" data-ai-maj="'+esc(m)+'">V'+esc(m)+' ('+n+')</button>';
      }).join('')+'</div>';
    liste = liste.filter(function(f){ return majeureDe(f)===aiMajeure; });
    return barre+'<div class="table-wrap"><table><thead><tr><th>Fichier</th><th>Version</th><th>Taille</th><th>Modifié</th><th></th></tr></thead><tbody>'+
      liste.map(function(f){
        return '<tr>'+
          '<td class="muted">'+esc(f.fichier)+'</td>'+
          '<td><span class="pill pill-neutral">'+esc(f.version)+'</span></td>'+
          '<td>'+fmtOctets(f.taille)+'</td>'+
          '<td>'+fmtDateTime(f.modifie)+'</td>'+
          '<td><button type="button" class="btn btn-sm" data-ai-adopter="'+esc(f.fichier)+'">Récupérer cette base</button></td>'+
        '</tr>';
      }).join('')+
    '</tbody></table></div>';
  }

  root.innerHTML = '<div class="picker-screen"><div class="card card-pad" style="max-width:680px;width:100%;">'+
    '<div class="brand-mark" style="margin:0 auto 14px;">'+ic('building',20)+'</div>'+
    '<h2 style="text-align:center;">Configuration initiale</h2>'+
    '<p class="hint" style="text-align:center;margin:8px 0 20px;">Avant de commencer, choisissez où enregistrer la base de données de Chantier ERP, et indiquez si vous souhaitez reprendre une base déjà existante (par exemple après une mise à jour, ou en provenance d’un autre poste).</p>'+
    '<div class="field"><label for="ai-dir">Répertoire de stockage de la base de données</label>'+
      '<div style="display:flex;gap:8px;">'+
        '<input id="ai-dir" style="flex:1;" value="'+esc(st.repertoireActuel||'')+'">'+
        '<button type="button" class="btn" id="ai-parcourir-dir">Parcourir…</button>'+
      '</div></div>'+
    '<p class="hint" style="margin:-2px 0 16px;">Laissez cette valeur telle quelle pour utiliser le répertoire par défaut de l’application, ou indiquez un autre chemin (ex. un disque ou un partage réseau commun à plusieurs postes).</p>'+
    '<div style="padding:14px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:16px;">'+
      '<h3 style="font-size:13px;margin-bottom:8px;">Base(s) de données détectée(s) dans ce répertoire</h3>'+
      '<div id="ai-detectees">'+versionsRowsHtml(st.versionsPrecedentesDetectees)+'</div>'+
    '</div>'+
    '<div class="field"><label for="ai-chemin-externe">Ou indiquez le chemin complet d’un fichier de base de données d’une version antérieure à récupérer (copié depuis un autre poste, une sauvegarde…)</label>'+
      '<div style="display:flex;gap:8px;">'+
        '<input id="ai-chemin-externe" style="flex:1;" placeholder="ex. C:\\sauvegardes\\chantier_erp_V1.20.db">'+
        '<button type="button" class="btn" id="ai-parcourir-fichier">Parcourir…</button>'+
        '<button type="button" class="btn" id="ai-adopter-externe">Récupérer ce fichier</button>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;justify-content:flex-end;margin-top:18px;">'+
      '<button type="button" class="btn btn-primary" id="ai-demarrer-vide">Démarrer avec une base vide</button>'+
    '</div>'+
  '</div></div>';

  var aiDerniereListe = null;
  function brancherFiltreVersion(){
    document.querySelectorAll('[data-ai-maj]').forEach(function(b){
      b.addEventListener('click', function(){
        aiMajeure = b.getAttribute('data-ai-maj');
        var mount = byId('ai-detectees');
        if(mount) mount.innerHTML = versionsRowsHtml(aiDerniereListe);
        brancherFiltreVersion(); bindAdopterButtons();
      });
    });
  }
  function refreshDetectees(){
    var dir = byId('ai-dir').value.trim();
    fetch('/api/db/info?dir='+encodeURIComponent(dir)).then(function(r){ return r.json(); }).then(function(info){
      var mount = byId('ai-detectees');
      aiDerniereListe = info.versionsPrecedentesDisponibles;
      if(mount) mount.innerHTML = versionsRowsHtml(aiDerniereListe);
      brancherFiltreVersion(); bindAdopterButtons();
    }).catch(function(err){ console.error(err); });
  }
  byId('ai-dir').addEventListener('blur', refreshDetectees);

  byId('ai-parcourir-dir').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire de stockage',
      mode: 'dossier',
      cheminInitial: byId('ai-dir').value.trim(),
      onChoisirDossier: function(chemin){
        byId('ai-dir').value = chemin;
        refreshDetectees();
      }
    });
  });

  byId('ai-parcourir-fichier').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le fichier de base de données à récupérer',
      mode: 'fichier',
      cheminInitial: byId('ai-dir').value.trim(),
      onChoisirFichier: function(chemin){
        byId('ai-chemin-externe').value = chemin;
      }
    });
  });

  function terminerEtRecharger(){
    return fetch('/api/db/assistant-initial/terminer', {method:'POST'}).then(function(){
      location.reload();
    });
  }

  function appliquerRepertoirePuis(suite){
    var dir = byId('ai-dir').value.trim();
    return fetch('/api/db/location', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: dir})
    }).then(function(r){
      return r.text().then(function(text){
        var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
        if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
        return json;
      });
    }).then(suite);
  }

  function bindAdopterButtons(){
    document.querySelectorAll('[data-ai-adopter]').forEach(function(b){
      b.addEventListener('click', function(){
        var fichier = b.getAttribute('data-ai-adopter');
        b.disabled = true; b.textContent = 'Reprise en cours…';
        appliquerRepertoirePuis(function(){
          return fetch('/api/db/adopter', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fichier: fichier})
          }).then(function(r){
            return r.text().then(function(text){
              var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
              if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
              return json;
            });
          });
        }).then(function(){
          toast('Base de données reprise avec succès', 'success');
          return terminerEtRecharger();
        }).catch(function(err){
          console.error(err); toast('Erreur : '+err.message, 'danger');
          b.disabled = false; b.textContent = 'Récupérer cette base';
        });
      });
    });
  }
  aiDerniereListe = st.versionsPrecedentesDetectees;
  brancherFiltreVersion();
  bindAdopterButtons();

  byId('ai-adopter-externe').addEventListener('click', function(){
    var chemin = byId('ai-chemin-externe').value.trim();
    if(!chemin){ toast('Indiquez le chemin complet du fichier à récupérer', 'danger'); return; }
    var btn = byId('ai-adopter-externe');
    btn.disabled = true; btn.textContent = 'Reprise en cours…';
    appliquerRepertoirePuis(function(){
      return fetch('/api/db/adopter', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cheminSource: chemin})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      });
    }).then(function(){
      toast('Base de données reprise avec succès', 'success');
      return terminerEtRecharger();
    }).catch(function(err){
      console.error(err); toast('Erreur : '+err.message, 'danger');
      btn.disabled = false; btn.textContent = 'Récupérer ce fichier';
    });
  });

  byId('ai-demarrer-vide').addEventListener('click', function(){
    var btn = byId('ai-demarrer-vide');
    btn.disabled = true; btn.textContent = 'Démarrage…';
    appliquerRepertoirePuis(function(){ return terminerEtRecharger(); }).catch(function(err){
      console.error(err); toast('Erreur : '+err.message, 'danger');
      btn.disabled = false; btn.textContent = 'Démarrer avec une base vide';
    });
  });
}

// V1.55 : remplace restoreSession()/setCurrentUser() (qui lisaient/ecrivaient
// l'identite dans localStorage, sans aucune verification serveur - voir
// claude/architecture-cloud-securite.md). L'identite ne vient plus que
// d'une session serveur reelle (cookie signe, voir backend/auth.py).
function connecterUtilisateur(u){
  STATE.currentUser = u;
  STATE.sessionMessage = null;
  STATE.route = 'dashboard';
  bootApp();
}
function deconnecterUtilisateur(){
  fetch('/api/auth/logout', {method:'POST'}).catch(function(){}).then(function(){
    arreterAbonnements();
    STATE.currentUser = null;
    STATE.sessionMessage = null;
    scheduleRender();
  });
}

/* =========================================================
   TOASTS
   ========================================================= */
function toast(msg, type){
  var host = byId('toasts');
  var el = document.createElement('div');
  el.className = 'toast'+(type?' '+type:'');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(function(){ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(function(){ el.remove(); }, 300); }, 3200);
}

/* =========================================================
   MODALES
   ========================================================= */
function openModal(opts){
  closeModal();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML =
    '<div class="modal'+(opts.large?' modal-lg':'')+'">'+
      '<div class="modal-head"><h3>'+esc(opts.title)+'</h3><button type="button" class="iconbtn" data-close-modal>'+ic('x',16)+'</button></div>'+
      '<div class="modal-body">'+opts.body+'</div>'+
      (opts.foot!==false ? '<div class="modal-foot">'+(opts.foot||'')+'</div>' : '') +
    '</div>';
  document.body.style.overflow = 'hidden';
  byId('modal-root').appendChild(overlay);
  overlay.addEventListener('mousedown', function(e){ if(e.target===overlay) closeModal(); });
  overlay.querySelectorAll('[data-close-modal]').forEach(function(b){ b.addEventListener('click', closeModal); });
  if(opts.onMount) opts.onMount(overlay);
  return overlay;
}
function closeModal(){
  var m = byId('active-modal');
  if(m){ m.remove(); document.body.style.overflow=''; }
}
function confirmDialog(message, opts){
  opts = opts || {};
  return new Promise(function(resolve){
    var overlay = openModal({
      title: opts.title || 'Confirmer',
      body: '<p>'+esc(message)+'</p>',
      foot: '<button type="button" class="btn" data-cancel>Annuler</button>'+
            '<button type="button" class="btn '+(opts.danger?'btn-danger':'btn-primary')+'" data-ok>'+esc(opts.okLabel||'Confirmer')+'</button>'
    });
    overlay.classList.add('confirm-modal');
    overlay.querySelector('[data-cancel]').addEventListener('click', function(){ closeModal(); resolve(false); });
    overlay.querySelector('[data-ok]').addEventListener('click', function(){ closeModal(); resolve(true); });
  });
}
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });

/* =========================================================
   NAVIGATEUR DE DOSSIERS/FICHIERS (V1.41)
   Remplace la saisie manuelle d'un chemin par une navigation au clic,
   dossier par dossier, appuyee sur GET /api/db/parcourir (lecture seule,
   cote serveur - sur le poste de l'utilisateur).
   options = {
     titre: string,
     cheminInitial: string|null,
     mode: 'dossier' | 'fichier',   // 'fichier' : les .db du dossier sont aussi cliquables
     onChoisirDossier: function(chemin){},  // mode 'dossier'
     onChoisirFichier: function(chemin){}   // mode 'fichier'
   }
   ========================================================= */
function ouvrirNavigateurFichiers(options){
  options = options || {};
  var dernierChemin = null;

  function corpsErreur(msg){
    return '<p class="hint" style="color:var(--danger);margin-bottom:10px;">'+esc(msg)+'</p>'+
      '<button type="button" class="btn btn-sm" id="nf-racine">Revenir au départ</button>';
  }

  function corpsHtml(data){
    if(data.error) return corpsErreur(data.error);
    var html = '';
    if(!data.chemin){
      html += '<p class="hint" style="margin-bottom:10px;">Choisissez un point de départ :</p><div class="nf-liste">';
      (data.raccourcis||[]).concat(data.racines||[]).forEach(function(r){
        html += '<button type="button" class="nf-item" data-nf-dossier="'+esc(r.chemin)+'">'+ic('folder',16)+'<span>'+esc(r.nom)+'</span></button>';
      });
      html += '</div>';
      return html;
    }
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'+
      (data.parent!=null ?
        '<button type="button" class="btn btn-sm" id="nf-remonter">'+ic('arrowup',13)+' Remonter</button>' :
        '<button type="button" class="btn btn-sm" id="nf-racine">'+ic('arrowup',13)+' Départ</button>') +
      '<span class="nf-chemin" title="'+esc(data.chemin)+'">'+esc(data.chemin)+'</span>'+
    '</div><div class="nf-liste">';
    if(!data.dossiers.length && !(options.mode==='fichier' && data.fichiersDb.length)){
      html += '<p class="hint">Ce dossier est vide (ou ne contient aucun fichier .db).</p>';
    }
    data.dossiers.forEach(function(d){
      html += '<button type="button" class="nf-item" data-nf-dossier="'+esc(d.chemin)+'">'+ic('folder',16)+'<span>'+esc(d.nom)+'</span></button>';
    });
    if(options.mode==='fichier'){
      data.fichiersDb.forEach(function(f){
        html += '<button type="button" class="nf-item nf-item-fichier" data-nf-fichier="'+esc(f.chemin)+'">'+ic('file',16)+
          '<span>'+esc(f.nom)+(f.version?' — version '+esc(f.version):'')+'</span></button>';
      });
    }
    html += '</div>';
    return html;
  }

  function footHtml(data){
    if(options.mode==='dossier' && data && data.chemin){
      return '<button type="button" class="btn" data-close-modal>Annuler</button>'+
             '<button type="button" class="btn btn-primary" id="nf-choisir-dossier">Choisir ce dossier</button>';
    }
    return '<button type="button" class="btn" data-close-modal>Annuler</button>';
  }

  function lier(data){
    document.querySelectorAll('#active-modal [data-nf-dossier]').forEach(function(b){
      b.addEventListener('click', function(){ charger(b.getAttribute('data-nf-dossier')); });
    });
    document.querySelectorAll('#active-modal [data-nf-fichier]').forEach(function(b){
      b.addEventListener('click', function(){
        var chemin = b.getAttribute('data-nf-fichier');
        closeModal();
        if(options.onChoisirFichier) options.onChoisirFichier(chemin);
      });
    });
    var remonter = byId('nf-remonter');
    if(remonter) remonter.addEventListener('click', function(){ charger(data.parent); });
    var racine = byId('nf-racine');
    if(racine) racine.addEventListener('click', function(){ charger(null); });
    var choisirDossier = byId('nf-choisir-dossier');
    if(choisirDossier) choisirDossier.addEventListener('click', function(){
      var chemin = dernierChemin;
      closeModal();
      if(options.onChoisirDossier) options.onChoisirDossier(chemin);
    });
  }

  function charger(chemin){
    var url = '/api/db/parcourir'+(chemin ? ('?chemin='+encodeURIComponent(chemin)) : '');
    var body = byId('nf-body');
    if(body) body.innerHTML = '<p class="hint">Chargement…</p>';
    fetch(url).then(function(r){
      return r.text().then(function(text){
        var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
        if(!r.ok) return {error:(json&&json.error)||('Erreur HTTP '+r.status)};
        return json;
      });
    }).then(function(data){
      dernierChemin = data.chemin || null;
      var mount = byId('nf-body'); if(mount) mount.innerHTML = corpsHtml(data);
      var foot = document.querySelector('#active-modal .modal-foot'); if(foot) foot.innerHTML = footHtml(data);
      lier(data);
    }).catch(function(err){
      console.error(err);
      var mount = byId('nf-body'); if(mount) mount.innerHTML = corpsErreur('Erreur : '+err.message);
    });
  }

  openModal({
    title: options.titre || 'Parcourir',
    large: true,
    body: '<div id="nf-body"><p class="hint">Chargement…</p></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button>'
  });
  charger(options.cheminInitial || null);
}

/* =========================================================
   BOITE DE DIALOGUE NATIVE (V1.42) - Explorateur Windows / Finder Mac
   Point d'entree unique pour tous les boutons "Parcourir..." : tente
   d'abord la VRAIE boite de dialogue du systeme d'exploitation (via
   backend/routes/db_admin.py, qui l'ouvre dans un sous-processus
   tkinter dedie) ; si elle n'est pas disponible sur ce poste (ex.
   tkinter absent de cette installation Python), bascule automatiquement
   et sans intervention sur le navigateur de dossiers maison (V1.41,
   ouvrirNavigateurFichiers() ci-dessus), conserve pour cela.
   options : memes champs que ouvrirNavigateurFichiers().
   ========================================================= */
function parcourirChemin(options){
  options = options || {};
  var url = (options.mode==='fichier' ? '/api/db/choisir-fichier' : '/api/db/choisir-dossier') +
    (options.cheminInitial ? ('?initial='+encodeURIComponent(options.cheminInitial)) : '');
  fetch(url).then(function(r){ return r.json(); }).then(function(data){
    if(data.disponible){
      if(data.chemin){
        if(options.mode==='fichier'){ if(options.onChoisirFichier) options.onChoisirFichier(data.chemin); }
        else { if(options.onChoisirDossier) options.onChoisirDossier(data.chemin); }
      }
      // sinon : boite de dialogue affichee normalement mais annulee par l'utilisateur -> ne rien faire.
      return;
    }
    // Boite de dialogue native indisponible sur ce poste -> repli sur le navigateur maison.
    ouvrirNavigateurFichiers(options);
  }).catch(function(err){
    console.error(err);
    ouvrirNavigateurFichiers(options);
  });
}

/* =========================================================
   ROUTAGE / RENDU PRINCIPAL
   ========================================================= */
function goTo(route){ STATE.route = route; scheduleRender(); window.scrollTo(0,0); }

function render(){
  if(STATE.dbAvailable===false) return;
  // V1.55 : l'ancien garde-fou attendait que la collection 'users' soit
  // chargee - mais elle n'est plus abonnee que pour les roles ayant acces a
  // Parametres (voir demarrerAbonnements), donc plus jamais vraie pour les
  // autres roles. Le signal de disponibilite est desormais authReady,
  // alimente par bootAuth() une fois la question "qui est connecte ?"
  // tranchee cote serveur.
  if(!STATE.authReady){ return; }
  if(!STATE.currentUser){ renderLogin(); return; }
  if(!canSee(STATE.route)) STATE.route = 'dashboard';
  renderShell();
}

var VIEW_TITLES = {
  dashboard:['Tableau de bord','Vue d’ensemble de l’activité'],
  clients:['Clients','Répertoire des clients de l’entreprise'],
  devis:['Devis','Propositions commerciales et chiffrages'],
  ctr:['Contrats','Engagements confirmés par les clients (verbal, e-mail, BC, contrat) — créés depuis un devis accepté'],
  av:['Avenants','Modifications contractuelles (montant, délai, périmètre…)'],
  att:['Attachements','Situations de travaux et avancement chantier'],
  livrables:['Livrables techniques','Plans, notes de calcul, rapports remis au client'],
  bordereaux:['Bordereaux d\'envois','Historique des bordereaux de transmission des livrables, par destinataire'],
  plandecharge:['Planning','Planification manuelle par contrat, personne et livrable : heures saisies directement, jour par jour'],
  etudeBase:['Étude électrique — Base de données','Consommateurs électriques par contrat ou devis : import / export Excel, formules et listes déroulantes'],
  etudeMateriel:['Étude électrique — Base matériel','Transformateurs HT/MT (puissances, pertes, impédances, courts-circuits) protections BT par constructeur et catalogue des câbles BT (réutilisable d’un projet à l’autre)'],
  etudeSymboles:['Étude électrique — Éditeur de symboles','Bibliothèque commune de symboles (disjoncteur, transformateur…) dessinés au millimètre, comme sous AutoCAD.'],
  etudeUnifilaire:['Étude électrique — Schéma unifilaire','Schéma unifilaire généré depuis la base : de la source aux tableaux, avec ses récepteurs (option). Export SVG, DXF et PDF.'],
  etudeCalcul:['Étude électrique — Calcul','Hiérarchie de la distribution (de la source aux tableaux) et détail du tableau sélectionné : câble, longueur et protection de chaque circuit'],
  etudeBilan:['Étude électrique — Bilan de puissance','Bilan par tableau (source normale / secours, transformateur, pertes) et récap, calculé depuis la base'],
  etudeListe:['Étude électrique — Liste des consommateurs','Document généré depuis la base : une section par tableau (Switchgear / MCC), de l’amont vers l’aval'],
  timesheet:['Timesheet','Pointage réel des heures par contrat, personne et livrable — indépendant du Planning'],
  pfa:['Propositions de facturation','Pré-validation interne avant émission de facture'],
  fac:['Factures','Facturation client'],
  avo:['Avoirs','Avoirs émis sur factures'],
  reg:['Encaissements','Règlements et encaissements clients'],
  fournisseurs:['Fournisseurs','Répertoire des fournisseurs de l’entreprise'],
  releves:['Relevés bancaires','Import PDF, rapprochement TIERS et export Excel'],
  facturesF:['Factures fournisseurs','Reconnaissance de factures et rapprochement avec les relevés bancaires'],
  exercicesArchives:['Exercices archivés','Bilans des exercices antérieurs importés un à un, à titre de référence et de suivi comparatif'],
  controleGestion:['Contrôle de gestion','Comparatif des bilans (exercices archivés + situation courante) et indicateurs de pilotage'],
  backlog:['Backlog de développement','Pistes d’évolution de l’application elle-même, avec priorité et suivi d’implémentation/test'],
  settings:['Paramètres','Société, numérotation'],
  // V1.99 : ecrans extraits de Parametres, voir NAV/NAV_GROUPS plus haut.
  utilisateurs:['Utilisateurs','Comptes et profils d’accès à l’application'],
  droitsAcces:['Droits d’accès','Matrice des droits par profil : aucun accès, lecture seule ou lecture-écriture, par menu et par donnée'],
  modulesInstalles:['Modules installés sur ce poste','Activation/désactivation des modules métier sur ce poste']
};

function renderShell(){
  var app = byId('app');
  var u = STATE.currentUser;
  function navItemHtml(n){
    return '<a class="navlink'+(STATE.route===n.id?' active':'')+'" data-nav="'+n.id+'">'+ic(n.icon,17)+'<span>'+esc(n.label)+'</span></a>';
  }
  function navStandaloneHtml(ids){
    return ids.map(function(id){ return NAV_BY_ID[id]; })
      .filter(function(n){ return n && canSee(n.accessKey||n.id); })
      .map(navItemHtml).join('');
  }
  function navGroupHtml(g){
    // Un groupe sans aucun item visible (droits du role, ou module V1.57
    // entierement desactive sur ce poste) ne s'affiche pas du tout - pas
    // d'en-tete vide, exactement comme un module desactive faisait deja
    // disparaitre ses entrees individuelles avant ce regroupement visuel.
    var visibles = g.items.map(function(id){ return NAV_BY_ID[id]; })
      .filter(function(n){ return n && canSee(n.accessKey||n.id); });
    if(!visibles.length) return '';
    // Un groupe reduit a un seul item visible N'EST aplati en lien direct
    // QUE si son libelle de groupe est identique au libelle de cet unique
    // item (ex. jusqu'a la V1.75, le module "Personnel" ne contenait que
    // l'ecran "Personnel" lui-meme : un en-tete repliable au libelle
    // identique a son propre contenu n'aurait rien apporte). Depuis la
    // V1.76, le module "personnel" est affiche sous le libelle "RH" alors
    // que son unique ecran reste "Personnel" - les deux libelles different,
    // donc plus aucune redondance ni ambiguite : il s'affiche desormais
    // comme un vrai groupe repliable ("RH" > "Personnel"), pas aplati.
    if(visibles.length===1 && visibles[0].label===g.label) return navItemHtml(visibles[0]);
    var repliee = navGroupeEstReplie(g, visibles);
    return '<div class="nav-group">'+
      '<button type="button" class="nav-group-header" data-navgroup="'+g.id+'">'+
        '<span class="nav-group-chevron" style="display:inline-flex;transition:transform .15s;transform:rotate('+(repliee?'0':'90')+'deg);">'+ic('chevron',13)+'</span>'+
        ic(g.icon,15)+'<span>'+esc(g.label)+'</span>'+
      '</button>'+
      '<div class="nav-group-items"'+(repliee?' hidden':'')+'>'+visibles.map(navItemHtml).join('')+'</div>'+
    '</div>';
  }
  var navHtml = navStandaloneHtml(NAV_STANDALONE_TOP)+
    NAV_GROUPS.map(navGroupHtml).join('')+
    navStandaloneHtml(NAV_STANDALONE_BOTTOM);
  var vt = VIEW_TITLES[STATE.route] || ['',''];
  app.innerHTML =
    '<div class="sidebar">'+
      '<div class="brand"><div class="brand-mark">'+ic('building',19)+'</div>'+
        '<div class="brand-text"><b>'+esc(STATE.company.nom||'Chantier ERP')+'</b><span>Gestion BTP</span></div></div>'+
      '<nav class="mainnav">'+navHtml+'</nav>'+
      '<div class="navspacer"></div>'+
      '<div class="sidebar-foot">'+
        '<div class="profile-chip"><div class="avatar">'+esc(initials(u.nom))+'</div>'+
          '<div class="profile-meta"><b>'+esc(u.nom)+'</b><span>'+esc(roleLabel(u.role))+'</span></div></div>'+
        '<button type="button" class="linklike" data-action="switch-user">'+ic('logout',14)+' Se déconnecter</button>'+
        '<div class="muted" style="margin-top:8px;font-size:11px;">Chantier ERP '+esc(window.APP_VERSION||'')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="main">'+
      '<div class="topbar"><div><h1>'+esc(vt[0])+'</h1><div class="topbar-sub">'+esc(vt[1])+'</div></div>'+
        '<div class="topbar-actions" id="topbar-actions"></div></div>'+
      '<div class="content" id="view-content"></div>'+
    '</div>';
  app.querySelectorAll('[data-nav]').forEach(function(el){
    el.addEventListener('click', function(){ goTo(el.getAttribute('data-nav')); });
  });
  app.querySelectorAll('[data-navgroup]').forEach(function(el){
    el.addEventListener('click', function(){
      var gid = el.getAttribute('data-navgroup');
      // V1.79 - correctif : on lisait jusqu'ici l'etat AFFICHE a l'ecran
      // (qui peut etre force ouvert par la route active, voir
      // navGroupeEstReplie()) en inversant aveuglement navGroupesDepliees
      // sans tenir compte de ce forcage. Un clic sur l'en-tete du groupe
      // contenant la page couramment affichee n'avait donc aucun effet
      // visible, MAIS deregleait quand meme le drapeau explicite - deplie/
      // replie se comportait alors a l'envers (ou necessitait un second
      // clic) des qu'on quittait cette page. On part desormais de l'etat
      // REELLEMENT visible (attribut [hidden] du bloc d'items, pose au
      // dernier rendu) et on fixe le drapeau explicite a l'oppose de cet
      // etat visible, plutot que de l'inverser aveuglement.
      var items = el.parentElement.querySelector('.nav-group-items');
      var ouvertActuellement = !!items && !items.hasAttribute('hidden');
      navGroupesDepliees[gid] = !ouvertActuellement;
      renderShell();
    });
  });
  app.querySelector('[data-action="switch-user"]').addEventListener('click', function(){ deconnecterUtilisateur(); });
  renderView();
}

function renderView(){
  var mount = byId('view-content');
  var actions = byId('topbar-actions');
  actions.innerHTML = '';
  switch(STATE.route){
    case 'dashboard': renderDashboard(mount, actions); break;
    case 'clients': renderClients(mount, actions); break;
    case 'devis': renderDevis(mount, actions); break;
    case 'ctr': renderCTR(mount, actions); break;
    case 'av': renderAV(mount, actions); break;
    case 'att': renderAtt(mount, actions); break;
    case 'livrables': renderLivrables(mount, actions); break;
    case 'bordereaux': renderBordereaux(mount, actions); break;
    case 'plandecharge': renderPlanDeCharge(mount, actions); break;
    case 'timesheet': renderTimesheet(mount, actions); break;
    case 'etudeBase': renderEtudeBase(mount, actions); break;
    case 'etudeListe': renderEtudeListe(mount, actions); break;
    case 'etudeBilan': renderEtudeBilan(mount, actions); break;
    case 'etudeCalcul': renderEtudeCalcul(mount, actions); break;
    case 'etudeUnifilaire': renderEtudeUnifilaire(mount, actions); break;
    case 'etudeSymboles': renderEtudeSymboles(mount, actions); break;
    case 'etudeMateriel': renderEtudeMateriel(mount, actions); break;
    case 'pfa': renderPFA(mount, actions); break;
    case 'fac': renderFactures(mount, actions); break;
    case 'avo': renderAVO(mount, actions); break;
    case 'reg': renderReglements(mount, actions); break;
    case 'fournisseurs': renderFournisseurs(mount, actions); break;
    case 'releves': renderReleves(mount, actions); break;
    case 'facturesF': renderFacturesFournisseurs(mount, actions); break;
    case 'personnel': renderPersonnel(mount, actions); break;
    case 'gestionCompetences': renderGestionCompetences(mount, actions); break;
    case 'evaluationSuivi': renderEvaluationSuivi(mount, actions); break;
    case 'formations': renderFormations(mount, actions); break;
    case 'planComptable': renderPlanComptable(mount, actions); break;
    case 'ecritures': renderEcritures(mount, actions); break;
    case 'ecritureOuverture': renderEcritureOuverture(mount, actions); break;
    case 'exercicesArchives': renderExercicesArchives(mount, actions); break;
    case 'controleGestion': renderControleGestion(mount, actions); break;
    case 'backlog': renderBacklog(mount, actions); break;
    case 'settings': renderSettings(mount, actions); break;
    case 'utilisateurs': renderUtilisateurs(mount, actions); break;
    case 'droitsAcces': renderDroitsAcces(mount, actions); break;
    case 'modulesInstalles': renderModulesInstalles(mount, actions); break;
    default: mount.innerHTML = '<div class="empty-state">Section introuvable.</div>';
  }
}

function emptyState(icon, text, actionHtml){
  return '<div class="card"><div class="empty-state">'+ic(icon,34)+'<p>'+esc(text)+'</p>'+(actionHtml||'')+'</div></div>';
}

/* =========================================================
   CONNEXION (V1.55 : authentification reelle email + mot de passe)
   Remplace l'ancien "choix de profil + PIN", jamais verifie que cote
   navigateur - voir claude/architecture-cloud-securite.md.
   ========================================================= */
function renderFirstAccount(){
  var app = byId('app');
  app.innerHTML =
    '<div class="picker-screen"><div class="card card-pad picker-card">'+
      '<div class="brand-mark" style="margin-bottom:14px;">'+ic('building',20)+'</div>'+
      '<h2>Bienvenue</h2>'+
      '<p class="muted" style="margin-top:6px;">Créez le premier compte administrateur pour démarrer.</p>'+
      '<form id="first-user-form" style="margin-top:18px;">'+
        '<div class="field"><label for="fu-nom">Nom et prénom</label><input id="fu-nom" required placeholder="ex. Karim Alaoui"></div>'+
        '<div class="field"><label for="fu-email">Email de connexion</label><input id="fu-email" type="email" required placeholder="ex. karim@entreprise.com"></div>'+
        '<div class="field"><label for="fu-password">Mot de passe</label><input id="fu-password" type="password" required minlength="8" placeholder="8 caractères minimum"></div>'+
        '<div class="field"><label for="fu-password2">Confirmer le mot de passe</label><input id="fu-password2" type="password" required></div>'+
        '<div id="fu-error" style="color:var(--danger);font-size:12.5px;margin-bottom:8px;display:none;"></div>'+
        '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">Créer mon compte administrateur</button>'+
      '</form>'+
    '</div></div>';
  byId('first-user-form').addEventListener('submit', function(e){
    e.preventDefault();
    var nom = byId('fu-nom').value.trim();
    var email = byId('fu-email').value.trim();
    var password = byId('fu-password').value;
    var errEl = byId('fu-error');
    errEl.style.display = 'none';
    if(password.length<8 || password!==byId('fu-password2').value){
      errEl.textContent = 'Les mots de passe ne correspondent pas, ou comportent moins de 8 caractères.';
      errEl.style.display = 'block';
      return;
    }
    saveUser({nom:nom, role:'admin', email:email, password:password, actif:true}).then(function(){
      return fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email, password:password})});
    }).then(function(r){ return r.json(); }).then(function(res){
      if(!res || !res.ok){ errEl.textContent = (res && res.error) || 'Erreur de connexion.'; errEl.style.display='block'; return; }
      toast('Compte créé, bienvenue '+nom+' !', 'success');
      STATE.authReady = true;
      connecterUtilisateur(res.user);
    }).catch(function(err){ console.error(err); errEl.textContent = 'Erreur lors de la création du compte.'; errEl.style.display='block'; });
  });
}
function renderLogin(){
  var app = byId('app');
  app.innerHTML =
    '<div class="picker-screen"><div class="card card-pad picker-card">'+
      '<div class="brand-mark" style="margin-bottom:14px;">'+ic('building',20)+'</div>'+
      '<h2>'+esc(STATE.company.nom||'Chantier ERP')+'</h2>'+
      '<p class="muted" style="margin-top:4px;">Connectez-vous pour continuer.</p>'+
      (STATE.sessionMessage ? '<p style="color:var(--danger);font-size:12.5px;margin-top:10px;">'+esc(STATE.sessionMessage)+'</p>' : '')+
      '<form id="login-form" style="margin-top:18px;">'+
        '<div class="field"><label for="lf-email">Email</label><input id="lf-email" type="email" required autofocus></div>'+
        '<div class="field"><label for="lf-password">Mot de passe</label><input id="lf-password" type="password" required></div>'+
        '<div id="lf-error" style="color:var(--danger);font-size:12.5px;margin-bottom:8px;display:none;">Email ou mot de passe incorrect.</div>'+
        '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">Se connecter</button>'+
      '</form>'+
    '</div></div>';
  byId('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var email = byId('lf-email').value.trim();
    var password = byId('lf-password').value;
    var errEl = byId('lf-error');
    errEl.style.display = 'none';
    fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email, password:password})})
      .then(function(r){ return r.json().then(function(body){ return {status:r.status, body:body}; }); })
      .then(function(res){
        if(res.status!==200 || !res.body.ok){ errEl.style.display = 'block'; return; }
        connecterUtilisateur(res.body.user);
      }).catch(function(err){ console.error(err); errEl.textContent = 'Connexion impossible.'; errEl.style.display='block'; });
  });
}

function openUserFormModal(user){
  // V1.55 : email + mot de passe remplacent le code PIN (jamais verifie que
  // cote navigateur) - voir claude/architecture-cloud-securite.md. A la
  // modification, le mot de passe est laisse vide par defaut (conserve
  // l'existant inchange, voir _hash_user_password_if_needed cote serveur) ;
  // il n'est jamais pre-rempli ni renvoye par le serveur, meme hache.
  var overlay = openModal({
    title: user ? 'Modifier l’utilisateur' : 'Nouvel utilisateur',
    body:
      '<div class="field"><label for="uf-nom">Nom et prénom</label><input id="uf-nom" required value="'+esc(user?user.nom:'')+'"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="uf-role">Profil d’accès</label><select id="uf-role">'+ROLES.map(function(r){ return '<option value="'+r.id+'"'+(user&&user.role===r.id?' selected':'')+'>'+esc(r.label)+'</option>'; }).join('')+'</select></div>'+
        '<div class="field"><label for="uf-email">Email de connexion</label><input id="uf-email" type="email" required value="'+esc(user?user.email||'':'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="uf-password">'+(user?'Nouveau mot de passe (laisser vide pour ne pas le changer)':'Mot de passe')+'</label><input id="uf-password" type="password" '+(user?'':'required')+' minlength="8" placeholder="8 caractères minimum"></div>'+
      (user? '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="uf-actif" style="width:auto;" '+(user.actif!==false?'checked':'')+'> Compte actif</label>' : ''),
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="uf-save">Enregistrer</button>'
  });
  overlay.querySelector('#uf-save').addEventListener('click', function(){
    var nom = byId('uf-nom').value.trim();
    if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
    var email = byId('uf-email').value.trim();
    if(!email){ toast('L’email est obligatoire', 'danger'); return; }
    var password = byId('uf-password').value;
    if(!user && password.length<8){ toast('Le mot de passe doit comporter au moins 8 caractères', 'danger'); return; }
    if(password && password.length<8){ toast('Le mot de passe doit comporter au moins 8 caractères', 'danger'); return; }
    var data = {nom:nom, role:byId('uf-role').value, email:email};
    if(password) data.password = password;
    if(user) data.actif = byId('uf-actif').checked;
    else data.actif = true;
    saveUser(data, user?user.id:null).then(function(){
      closeModal(); toast('Utilisateur enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); });
  });
}

/* =========================================================
   TABLEAU DE BORD
   ========================================================= */
function renderDashboard(mount){
  var now = new Date();
  var mYear = now.getFullYear(), mMonth = now.getMonth();
  var facMois = STATE.fac.filter(function(f){
    var d = new Date((f.date||'')+'T00:00:00');
    return d.getFullYear()===mYear && d.getMonth()===mMonth && f.statut!=='annulee' && f.statut!=='brouillon';
  });
  var caFacture = n2(facMois.reduce(function(s,f){ return s+(Number(f.ht)||0); }, 0));
  var regMois = STATE.reg.filter(function(r){
    var d = new Date((r.date||'')+'T00:00:00');
    return d.getFullYear()===mYear && d.getMonth()===mMonth;
  });
  var encaisseMois = n2(regMois.reduce(function(s,r){ return s+(Number(r.montant)||0); }, 0));
  var impayes = 0, retard = 0;
  STATE.fac.forEach(function(f){
    if(f.statut==='annulee') return;
    var e = factureEtat(f);
    impayes += e.reste;
    if(e.enRetard) retard += e.reste;
  });
  impayes = n2(impayes); retard = n2(retard);
  var devisEnCours = STATE.devis.filter(function(d){ return d.statut==='envoye' || d.statut==='brouillon'; }).length;

  var recentDocs = [].concat(
    STATE.devis.map(function(d){ return {t:'Devis', num:d.numero, client:d.clientNom, date:d.createdAt, route:'devis'}; }),
    STATE.ctr.map(function(d){ return {t:'Contrat', num:d.numero, client:d.clientNom, date:d.createdAt, route:'ctr'}; }),
    STATE.av.map(function(d){ return {t:'Avenant', num:d.numero, client:d.clientNom, date:d.createdAt, route:'av'}; }),
    STATE.att.map(function(d){ return {t:'Attachement', num:d.numero, client:d.clientNom, date:d.createdAt, route:'att'}; }),
    STATE.pfa.map(function(d){ return {t:'Proposition fact.', num:d.numero, client:d.clientNom, date:d.createdAt, route:'pfa'}; }),
    STATE.fac.map(function(d){ return {t:'Facture', num:d.numero||'(brouillon)', client:d.clientNom, date:d.createdAt, route:'fac'}; }),
    STATE.avo.map(function(d){ return {t:'Avoir', num:d.numero, client:d.clientNom, date:d.createdAt, route:'avo'}; }),
    STATE.reg.map(function(d){ return {t:'Encaissement', num:d.numero, client:d.clientNom, date:d.createdAt, route:'reg'}; })
  ).filter(function(x){ return x.date; }).sort(function(a,b){ return b.date<a.date?-1:1; }).slice(0,8);

  var rows = recentDocs.length ? recentDocs.map(function(x){
    return '<tr><td><span class="pill pill-neutral">'+esc(x.t)+'</span></td><td class="num">'+esc(x.num)+'</td><td>'+esc(x.client||'—')+'</td>'+
      '<td class="muted">'+fmtDateTime(x.date)+'</td></tr>';
  }).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:24px;">Aucune activité pour le moment.</td></tr>';

  // V1.63 : avancement global pondere par les heures, toute l'entreprise
  // confondue (tous contrats) - complement du meme indicateur affiche par
  // contrat dans Contrats (renderCTR), demande explicite de l'utilisateur
  // ("les deux").
  var avEntreprise = avancementPondere(STATE.livrables||[]);
  var avEntrepriseHtml = (avEntreprise===null) ? '—' : (Math.round(avEntreprise*10)/10)+'%';

  var facARisque = STATE.fac.filter(function(f){ return f.statut!=='annulee' && factureEtat(f).enRetard; })
    .sort(function(a,b){ return (a.echeance||'')<(b.echeance||'')?-1:1; }).slice(0,6);
  var riskRows = facARisque.length ? facARisque.map(function(f){
    var e = factureEtat(f);
    return '<tr><td class="num">'+esc(f.numero)+'</td><td>'+esc(f.clientNom||'—')+'</td><td class="muted">'+fmtDate(f.echeance)+'</td><td class="r num">'+fmtMoney(e.reste)+'</td></tr>';
  }).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">Aucune facture en retard.</td></tr>';

  mount.innerHTML =
    '<div class="kpi-grid">'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">Facturé ce mois (HT)</div><div class="kpi-value">'+fmtMoney(caFacture)+'</div><div class="kpi-sub">'+facMois.length+' facture(s)</div></div>'+
      '<div class="card kpi kpi-accent ok"><div class="kpi-label">Encaissé ce mois</div><div class="kpi-value">'+fmtMoney(encaisseMois)+'</div><div class="kpi-sub">'+regMois.length+' règlement(s)</div></div>'+
      '<div class="card kpi kpi-accent warn"><div class="kpi-label">Impayés en cours</div><div class="kpi-value">'+fmtMoney(impayes)+'</div><div class="kpi-sub">dont '+fmtMoney(retard)+' en retard</div></div>'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">Devis en cours</div><div class="kpi-value">'+devisEnCours+'</div><div class="kpi-sub">brouillon ou envoyé</div></div>'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">Avancement livrables</div><div class="kpi-value">'+avEntrepriseHtml+'</div><div class="kpi-sub">pondéré par les heures budgétées, tous contrats</div></div>'+
    '</div>'+
    '<div class="field-row grid-2" style="align-items:start;">'+
      '<div class="card">'+
        '<div class="card-pad" style="padding-bottom:0;"><h3 style="font-size:14px;">Dernière activité</h3></div>'+
        '<div class="table-wrap" style="border:none;border-radius:0;margin-top:10px;"><table><thead><tr><th>Type</th><th>N°</th><th>Client</th><th>Date</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '</div>'+
      '<div class="card">'+
        '<div class="card-pad" style="padding-bottom:0;"><h3 style="font-size:14px;color:var(--danger);">Factures en retard</h3></div>'+
        '<div class="table-wrap" style="border:none;border-radius:0;margin-top:10px;"><table><thead><tr><th>N°</th><th>Client</th><th>Échéance</th><th class="r">Reste dû</th></tr></thead><tbody>'+riskRows+'</tbody></table></div>'+
      '</div>'+
    '</div>';
}

/* =========================================================
   CLIENTS
   ========================================================= */
var clientsFilter = '';
function renderClients(mount, actions){
  var canEdit = canWrite('clients');
  if(canEdit){
    actions.innerHTML =
      '<button type="button" class="btn btn-ghost" id="btn-export-clients">'+ic('download',15)+' Exporter Excel</button>'+
      '<button type="button" class="btn btn-ghost" id="btn-import-clients">'+ic('upload',15)+' Importer Excel</button>'+
      '<button type="button" class="btn btn-primary" id="btn-new-client">'+ic('plus',15)+' Nouveau client</button>';
    byId('btn-new-client').addEventListener('click', function(){ openClientFormModal(null); });
    byId('btn-export-clients').addEventListener('click', function(){ exportExcelList('clients'); });
    byId('btn-import-clients').addEventListener('click', function(){ openImportExcelModal('clients'); });
  }
  var list = STATE.clients.filter(function(c){
    if(!clientsFilter) return true;
    var q = clientsFilter.toLowerCase();
    return (c.nom||'').toLowerCase().indexOf(q)>-1 || (c.ice||'').toLowerCase().indexOf(q)>-1 || (c.ville||'').toLowerCase().indexOf(q)>-1;
  }).sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="client-search" placeholder="Rechercher un client…" value="'+esc(clientsFilter)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' client(s)</span>'+
    '</div></div>';

  var doublonsClients = detecterDoublonsClients();
  if(doublonsClients.length){
    body += doublonsBannerHtml(
      doublonsClients.length+' groupe(s) de clients en double détecté(s) (même nom ou même ICE, enregistrés avant l’activation de ce contrôle) :',
      doublonsClients.map(function(g){
        return '<li>'+g.map(function(c){ return esc(c.nom||'—')+(c.ice? ' (ICE '+esc(c.ice)+')' : ''); }).join(' / ')+(canEdit? ' : vérifiez laquelle est la bonne et supprimez les autres.' : '.')+'</li>';
      }).join('')
    );
  }

  if(!STATE.clients.length){
    body += emptyState('users', 'Aucun client enregistré pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-client">'+ic('plus',15)+' Créer un client</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun résultat pour cette recherche.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Client</th><th>ICE</th><th>Ville</th><th>Contact</th><th>Téléphone</th><th></th></tr></thead><tbody>'+
      list.map(function(c){
        var devisCount = STATE.devis.filter(function(d){ return d.clientId===c.id; }).length;
        return '<tr>'+
          '<td><b>'+esc(c.nom)+'</b>'+(devisCount?' <span class="muted" style="font-size:11.5px;">('+devisCount+' devis)</span>':'')+'</td>'+
          '<td class="num muted">'+esc(c.ice||'—')+'</td>'+
          '<td>'+esc(c.ville||'—')+'</td>'+
          '<td>'+esc(c.contact||'—')+'</td>'+
          '<td class="num">'+esc(c.telephone||'—')+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+c.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-del="'+c.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var searchEl = byId('client-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){ clientsFilter = searchEl.value; renderClients(mount, actions); searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length); }, 220));
  var emptyBtn = byId('empty-new-client');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openClientFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openClientFormModal(STATE.clients.find(function(c){ return c.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-del]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-del');
    var c = STATE.clients.find(function(x){ return x.id===id; });
    var used = STATE.devis.some(function(d){return d.clientId===id;}) || STATE.ctr.some(function(d){return d.clientId===id;}) || STATE.fac.some(function(d){return d.clientId===id;});
    confirmDialog(used? 'Ce client est référencé dans des documents existants. Le supprimer quand même ?' : 'Supprimer définitivement ce client ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteDoc('clients', id).then(function(){
        toast('Client supprimé', 'success');
        // Fiche Tiers bancaires liée (voir syncTiersPourFiche, V1.53) :
        // supprimée avec le client si on l'avait créée pour lui et que
        // personne d'autre ne s'en sert, sinon conservée (avertissement).
        if(supprimerTiersAutoSiOrphelin(c)==='conservee'){
          toast('La fiche Tiers bancaires liée à ce client est conservée (encore utilisée ailleurs).', 'warning');
        }
      }).catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
}

// `opts.presetNom`/`opts.presetIce` pre-remplissent le formulaire (ex.
// valeurs devinees depuis le contenu d'une facture importee) ; `opts.onSaved`
// (optionnel) est appele avec la fiche enregistree {id,...} juste apres la
// sauvegarde, pour une creation a la volee sans quitter l'ecran en cours
// (ex. depuis l'ecran d'import de factures clients) - meme principe que
// openTiersFormModal (module Factures fournisseurs).
function openClientFormModal(client, opts){
  opts = opts || {};
  var f = client || {};
  var overlay = openModal({
    title: client ? 'Modifier le client' : 'Nouveau client',
    large: true,
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-nom">Raison sociale / Nom</label><input id="cf-nom" required value="'+esc(f.nom||(opts.presetNom||''))+'"></div>'+
        '<div class="field"><label for="cf-ice">ICE</label><input id="cf-ice" value="'+esc(f.ice||(opts.presetIce||''))+'"></div>'+
      '</div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="cf-if">Identifiant fiscal (IF)</label><input id="cf-if" value="'+esc(f.identifiantFiscal||'')+'"></div>'+
        '<div class="field"><label for="cf-rc">RC</label><input id="cf-rc" value="'+esc(f.rc||'')+'"></div>'+
        '<div class="field"><label for="cf-patente">Patente</label><input id="cf-patente" value="'+esc(f.patente||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="cf-adresse">Adresse</label><textarea id="cf-adresse">'+esc(f.adresse||'')+'</textarea></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-ville">Ville</label><input id="cf-ville" value="'+esc(f.ville||'')+'"></div>'+
        '<div class="field"><label for="cf-telephone">Téléphone</label><input id="cf-telephone" value="'+esc(f.telephone||'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-email">Email</label><input id="cf-email" type="email" value="'+esc(f.email||'')+'"></div>'+
        '<div class="field"><label for="cf-contact">Personne à contacter</label><input id="cf-contact" value="'+esc(f.contact||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="cf-notes">Notes</label><textarea id="cf-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="cf-save">Enregistrer</button>'
  });
  overlay.querySelector('#cf-save').addEventListener('click', function(){
    var nom = byId('cf-nom').value.trim();
    if(!nom){ toast('La raison sociale est obligatoire', 'danger'); return; }
    var data = {
      nom:nom, ice:byId('cf-ice').value.trim(), identifiantFiscal:byId('cf-if').value.trim(),
      rc:byId('cf-rc').value.trim(), patente:byId('cf-patente').value.trim(),
      adresse:byId('cf-adresse').value.trim(), ville:byId('cf-ville').value.trim(),
      telephone:byId('cf-telephone').value.trim(), email:byId('cf-email').value.trim(),
      contact:byId('cf-contact').value.trim(), notes:byId('cf-notes').value.trim()
    };
    // V2.12 : anti-doublon. A la modification, on ne controle que si le nom
    // ou l'ICE a change (une fiche deja en double avant ce controle reste
    // modifiable pour ses autres champs).
    var changeCle = !client || normNomTiers(data.nom)!==normNomTiers(client.nom) || normIce(data.ice)!==normIce(client.ice);
    var doublonClient = changeCle ? findClientDoublon(data.nom, data.ice, client?client.id:null) : null;
    if(doublonClient){
      if(!client && opts.onSaved){
        // Depuis l'import de factures/devis : on reutilise le client
        // existant au lieu d'en creer un second.
        opts.onSaved({id: doublonClient.id, nom: doublonClient.nom, ice: doublonClient.ice});
        closeModal(); toast('Ce client existe déjà : « '+doublonClient.nom+' » — fiche existante sélectionnée', 'success');
      } else {
        toast('Ce client existe déjà : « '+doublonClient.nom+(doublonClient.ice? ' — ICE '+doublonClient.ice : '')+' » (même nom ou même ICE)', 'danger');
      }
      return;
    }
    saveClient(data, client?client.id:null).then(function(res){
      var saved = Object.assign({id: client?client.id:(res&&res.id)}, data);
      if(opts.onSaved) opts.onSaved(saved);
      closeModal(); toast('Client enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   PERSONNEL (employes de l'entreprise - registre independant, sans lien
   avec les comptes "Utilisateurs" de l'application ni avec les chantiers
   pour l'instant)
   ========================================================= */
var CONTRAT_TYPES = ['CDI', 'CDD', 'Intérim', 'Journalier', 'Autre'];
var personnelFilter = '';

// V1.88 : statuts du personnel personnalisables, a la demande explicite de
// l'utilisateur ("ajouter un champ Statut qui peut etre ajoute modifie et
// supprime par l'utilisateur") - voir claude/module-personnel.md.
//
// Decision explicite (assomption faite en l'absence de reponse de
// l'utilisateur sur ce point precis, a confirmer avec lui) : ce nouveau
// champ "statut" s'AJOUTE a la case "Personne active/inactive" existante,
// il ne la remplace PAS. Raison : la case "actif" est deja utilisee ailleurs
// dans l'application (voir STATE.personnelLight / /api/personnel-light) pour
// griser les personnes inactives dans les listes d'affectation d'un
// livrable - un champ Statut entierement libre (noms arbitraires choisis par
// l'utilisateur) ne permettrait plus de savoir de facon fiable qui est
// "inactif" sans ajouter une notion supplementaire non demandee. Le champ
// Statut est donc une information complementaire, totalement libre, sans
// aucune valeur pre-creee au demarrage : seul l'utilisateur definit ses
// valeurs, qu'il peut ajouter/modifier/supprimer - meme mecanisme que
// competenceCategories (V1.86/V1.88).
//
// Gestion (ajout/modification/suppression) directement sur l'ecran
// Personnel lui-meme (pas dans la modale de fiche, pour la meme raison
// deja rencontree en V1.86 : openModal() ferme toute modale deja ouverte,
// donc un confirmDialog() de suppression ne doit jamais etre ouvert depuis
// l'interieur d'une autre modale).
function statutPersonnelLabel(id){
  if(!id) return '—';
  var s = STATE.personnelStatuts.find(function(x){ return x.id===id; });
  return s ? s.nom : 'Statut supprimé';
}
function savePersonnelStatut(nom){
  return STATE.db.collection('personnelStatuts').add({nom:nom, createdAt:nowISO(), creePar:currentUserName()});
}
function deletePersonnelStatut(id){ return deleteDoc('personnelStatuts', id); }
function renderPersonnel(mount, actions){
  var canEdit = canWrite('personnel');
  if(canEdit){
    actions.innerHTML =
      '<button type="button" class="btn" id="btn-new-statut-personnel">'+ic('plus',15)+' Nouveau statut</button> '+
      '<button type="button" class="btn btn-primary" id="btn-new-personnel">'+ic('plus',15)+' Nouveau membre du personnel</button>';
    byId('btn-new-personnel').addEventListener('click', function(){ openPersonnelFormModal(null); });
    byId('btn-new-statut-personnel').addEventListener('click', function(){ openStatutPersonnelFormModal(null); });
  }
  var list = STATE.personnel.filter(function(p){
    if(!personnelFilter) return true;
    var q = personnelFilter.toLowerCase();
    return (p.nom||'').toLowerCase().indexOf(q)>-1 || (p.fonction||'').toLowerCase().indexOf(q)>-1 || (p.cin||'').toLowerCase().indexOf(q)>-1;
  }).sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

  var body =
    '<p class="hint" style="margin:0 0 12px;">Registre du personnel de l’entreprise (coordonnées, poste, contrat...) — indépendant des comptes « Utilisateurs » (le personnel n’a pas accès à cette application) et, pour l’instant, sans affectation à un chantier.</p>';

  // V1.88 : statuts du personnel, entierement definis par l'utilisateur
  // (ajout/modification/suppression) - voir plus haut pour la discussion
  // complete. Gestion directement sur cet ecran (jamais depuis l'interieur
  // de la modale de fiche personnel, meme regle qu'en V1.86/V1.87).
  var statutsTries = STATE.personnelStatuts.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  body += '<div class="card card-pad" style="margin-bottom:16px;">'+
    '<div class="section-head" style="margin-bottom:8px;"><h3 style="font-size:14px;">Statuts du personnel</h3></div>'+
    (statutsTries.length ?
      '<div class="table-wrap"><table><thead><tr><th>Statut</th><th>Créé le</th><th>Créé par</th><th></th></tr></thead><tbody>'+
        statutsTries.map(function(s){
          return '<tr><td><b>'+esc(s.nom)+'</b></td><td class="muted" style="font-size:12.5px;">'+fmtDate(s.createdAt)+'</td><td class="muted" style="font-size:12.5px;">'+esc(s.creePar||'—')+'</td>'+
            '<td><div class="row-actions">'+
              (canEdit? '<button type="button" class="iconbtn" data-edit-statut-personnel="'+s.id+'" title="Modifier">'+ic('pencil',14)+'</button>'+
              '<button type="button" class="iconbtn" data-del-statut-personnel="'+s.id+'" title="Supprimer">'+ic('trash',14)+'</button>' : '<span class="muted">—</span>')+
            '</div></td></tr>';
        }).join('')+
      '</tbody></table></div>' :
      '<p class="hint" style="margin:0;">Aucun statut défini pour le moment — utilisez le bouton « Nouveau statut » ci-dessus (ex. « En congé », « Suspendu », « Démissionnaire »...).</p>')+
  '</div>';

  body += '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="personnel-search" placeholder="Rechercher par nom, fonction ou CIN…" value="'+esc(personnelFilter)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' personne(s)</span>'+
    '</div></div>';

  if(!STATE.personnel.length){
    body += emptyState('idcard', 'Aucun membre du personnel enregistré pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-personnel">'+ic('plus',15)+' Ajouter une personne</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun résultat pour cette recherche.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Fonction</th><th>CIN</th><th>Téléphone</th><th>Contrat</th><th>Statut</th><th class="r">Actif</th><th></th></tr></thead><tbody>'+
      list.map(function(p){
        return '<tr>'+
          '<td><b>'+esc(p.nom)+'</b></td>'+
          '<td>'+esc(p.fonction||'—')+'</td>'+
          '<td class="num muted">'+esc(p.cin||'—')+'</td>'+
          '<td class="num">'+esc(p.telephone||'—')+'</td>'+
          '<td>'+esc(p.typeContrat||'—')+'</td>'+
          '<td>'+esc(statutPersonnelLabel(p.statut))+'</td>'+
          '<td class="r">'+(p.actif===false? '<span class="pill">Inactif</span>' : '<span class="pill pill-primary">Actif</span>')+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit-personnel="'+p.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-del-personnel="'+p.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var searchEl = byId('personnel-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){
    personnelFilter = searchEl.value; renderPersonnel(mount, actions);
    searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }, 220));
  var emptyBtn = byId('empty-new-personnel');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openPersonnelFormModal(null); });
  mount.querySelectorAll('[data-edit-personnel]').forEach(function(b){ b.addEventListener('click', function(){
    openPersonnelFormModal(STATE.personnel.find(function(p){ return p.id===b.getAttribute('data-edit-personnel'); }));
  }); });
  mount.querySelectorAll('[data-del-personnel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-del-personnel');
    var p = STATE.personnel.find(function(x){ return x.id===id; });
    confirmDialog('Supprimer définitivement cette personne du registre du personnel ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteDoc('personnel', id).then(function(){
        toast('Personnel supprimé', 'success');
        chargerPersonnelLight(); // V1.65 : retire aussi la personne de la liste minimale
        // Fiche Tiers bancaires liée (voir syncTiersPourFiche, V1.53) :
        // supprimée avec la personne si on l'avait créée pour elle et que
        // personne d'autre ne s'en sert, sinon conservée (avertissement).
        if(supprimerTiersAutoSiOrphelin(p)==='conservee'){
          toast('La fiche Tiers bancaires liée est conservée (encore utilisée ailleurs).', 'warning');
        }
      }).catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
  mount.querySelectorAll('[data-edit-statut-personnel]').forEach(function(b){
    b.addEventListener('click', function(){ openStatutPersonnelFormModal(STATE.personnelStatuts.find(function(s){ return s.id===b.getAttribute('data-edit-statut-personnel'); })); });
  });
  mount.querySelectorAll('[data-del-statut-personnel]').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.getAttribute('data-del-statut-personnel');
      var s = STATE.personnelStatuts.find(function(x){ return x.id===id; });
      confirmDialog('Supprimer le statut « '+(s?s.nom:'')+' » ? Les personnes qui l’ont déjà se verront affichées avec « Statut supprimé ».', {danger:true, okLabel:'Supprimer'}).then(function(ok){
        if(!ok) return;
        deletePersonnelStatut(id).then(function(){ toast('Statut supprimé', 'success'); })
          .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
      });
    });
  });
}
function openStatutPersonnelFormModal(item){
  var overlay = openModal({
    title: item ? 'Modifier le statut' : 'Nouveau statut',
    body: '<div class="field"><label for="stp-nom">Nom du statut</label><input id="stp-nom" required value="'+esc(item?item.nom||'':'')+'" placeholder="ex. En congé"></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="stp-save">Enregistrer</button>'
  });
  var stpSaveBtn = overlay.querySelector('#stp-save');
  stpSaveBtn.addEventListener('click', function(){
    var nom = byId('stp-nom').value.trim();
    if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
    if(STATE.personnelStatuts.some(function(s){ return (s.nom||'').toLowerCase()===nom.toLowerCase() && s.id!==(item?item.id:null); })){
      toast('Ce statut existe déjà', 'danger'); return;
    }
    // V1.93 : desactive le bouton le temps de l'enregistrement - evite que
    // deux clics rapprochés (ou un reseau lent) declenchent deux creations
    // avant que STATE.personnelStatuts (rafraichi toutes les POLL_MS=2s) ne
    // reflete la premiere, ce qui pourrait creer deux statuts au MEME nom
    // mais avec des ids distincts (la verification de doublon ci-dessus est
    // cote client et ne voit pas une creation encore en vol) - un risque
    // reel car un tel doublon rendrait le filtre de l'ecran Évaluation_Suivi
    // (qui filtre par id) incomprehensible a l'utilisateur : deux options du
    // select affichant le meme nom mais ne ramenant pas les memes personnes.
    stpSaveBtn.disabled = true;
    var p = item ? STATE.db.doc('personnelStatuts/'+item.id).update({nom:nom}) : savePersonnelStatut(nom);
    p.then(function(){ closeModal(); toast(item?'Statut modifié':'Statut ajouté', 'success'); })
      .catch(function(err){ console.error(err); stpSaveBtn.disabled = false; toast('Erreur d’enregistrement', 'danger'); });
  });
}

function openPersonnelFormModal(p){
  var overlay = openModal({
    title: p ? 'Modifier la fiche personnel' : 'Nouveau membre du personnel',
    large: true,
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="pf-nom">Nom complet</label><input id="pf-nom" required value="'+esc(p?p.nom||'':'')+'"></div>'+
        '<div class="field"><label for="pf-fonction">Fonction / Poste</label><input id="pf-fonction" value="'+esc(p?p.fonction||'':'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="pf-cin">CIN</label><input id="pf-cin" value="'+esc(p?p.cin||'':'')+'"></div>'+
        '<div class="field" style="display:flex;align-items:flex-end;">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:9px;"><input type="checkbox" id="pf-actif" style="width:auto;" '+(p? (p.actif!==false?'checked':'') : 'checked')+'> Personne active</label>'+
        '</div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="pf-telephone">Téléphone</label><input id="pf-telephone" value="'+esc(p?p.telephone||'':'')+'"></div>'+
        '<div class="field"><label for="pf-email">Email</label><input id="pf-email" type="email" value="'+esc(p?p.email||'':'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="pf-adresse">Adresse</label><textarea id="pf-adresse">'+esc(p?p.adresse||'':'')+'</textarea></div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="pf-date-embauche">Date d’embauche</label><input type="date" id="pf-date-embauche" value="'+esc(p?p.dateEmbauche||'':'')+'"></div>'+
        '<div class="field"><label for="pf-type-contrat">Type de contrat</label><select id="pf-type-contrat">'+
          '<option value="">—</option>'+
          CONTRAT_TYPES.map(function(t){ return '<option value="'+esc(t)+'"'+(p&&p.typeContrat===t?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label for="pf-salaire">Salaire mensuel (MAD)</label><input type="number" step="any" id="pf-salaire" value="'+(p&&p.salaire!=null?p.salaire:'')+'"></div>'+
      '</div>'+
      // V1.88 : statut du personnel, liste entierement definie par
      // l'utilisateur (voir plus haut) - champ independant de la case
      // "Personne active" ci-dessus, qui reste inchangee.
      '<div class="field"><label for="pf-statut">Statut</label><select id="pf-statut">'+
        '<option value="">—</option>'+
        STATE.personnelStatuts.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); }).map(function(s){ return '<option value="'+esc(s.id)+'"'+(p&&p.statut===s.id?' selected':'')+'>'+esc(s.nom)+'</option>'; }).join('')+
      '</select>'+
      '<p class="hint" style="margin:4px 0 0;">Statut manquant dans la liste ? Utilisez le bouton « Nouveau statut » sur l’écran Personnel, puis revenez ici.</p></div>'+
      '<div class="field"><label for="pf-notes">Notes</label><textarea id="pf-notes">'+esc(p?p.notes||'':'')+'</textarea></div>'+
      // V1.85 : le nouveau role "rh" recoit le meme acces complet que
      // Comptable sur ce registre (voir backend/access.py) - la mention
      // ci-dessous est mise a jour en consequence.
      '<p class="hint" style="margin:4px 0 0;">Le salaire est une donnée sensible : ce registre n’est accessible qu’à l’Administrateur, au Comptable et au rôle RH.</p>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="pf-save">Enregistrer</button>'
  });
  overlay.querySelector('#pf-save').addEventListener('click', function(){
    var nom = byId('pf-nom').value.trim();
    if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
    var salaireVal = byId('pf-salaire').value;
    var data = {
      nom: nom, fonction: byId('pf-fonction').value.trim(), cin: byId('pf-cin').value.trim(),
      actif: byId('pf-actif').checked,
      statut: byId('pf-statut').value || null,
      telephone: byId('pf-telephone').value.trim(), email: byId('pf-email').value.trim(),
      adresse: byId('pf-adresse').value.trim(),
      dateEmbauche: byId('pf-date-embauche').value, typeContrat: byId('pf-type-contrat').value,
      salaire: salaireVal===''?null:Number(salaireVal),
      notes: byId('pf-notes').value.trim()
    };
    savePersonnel(data, p?p.id:null).then(function(){
      closeModal(); toast('Personnel enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   RH - COMPETENCES ET FORMATIONS (V1.85)

   Demande utilisateur : gerer la competence du personnel y compris son
   evolution, et les formations - proposition validee en trois rondes de
   questions (voir claude/module-personnel.md pour le detail complet) :
     - echelle numerique 1 a 5, historisee a chaque changement (meme
       principe que historiqueIndices des livrables, voir
       withHistoriqueCompetence ci-dessous) ;
     - competences et formations totalement independantes l'une de
       l'autre : une formation peut viser des competences a titre
       indicatif (competencesViseesIds) mais ne met JAMAIS a jour
       automatiquement le niveau enregistre sur la fiche Personnel ;
     - nouveau role dedie "rh" (voir ROLES plus haut) - acces PAR ROLE
       uniquement, decision explicite de l'utilisateur (pas de notion de
       hierarchie/N+1 avec effet technique sur les droits) ;
     - Comptable ne recoit PAS automatiquement acces a ces deux nouvelles
       sections (seuls admin et rh - voir backend/access.py).
   ========================================================= */
// V1.86 : demande utilisateur "donner la possibilite d'ajouter les
// categories de competence" - categories personnalisees, creees librement
// par l'utilisateur et stockees dans la collection generique
// 'competenceCategories' (chaque document = {nom, createdAt, creePar} ;
// categorie sur une compétence du referentiel vaut alors l'id du
// document).
//
// V1.88 : a l'origine, les 5 categories "Discipline technique"/"Logiciel
// metier"/"Habilitation ou certification"/"Langue"/"Autre" etaient une
// liste fixe codee en dur ici meme (COMPETENCE_CATEGORIES), concatenee a
// l'affichage avec les categories personnalisees ci-dessus mais non
// modifiable/supprimable - signalee comme un manque par l'utilisateur
// ("une categorie doit etre modifiable et supprimable", voir
// claude/module-personnel.md). Elles sont desormais de vrais documents de
// la collection 'competenceCategories' comme les autres (migration
// serveur au demarrage, avec leurs ids d'origine 'discipline'/'logiciel'/
// 'habilitation'/'langue'/'autre' pour rester compatibles avec les
// compétences qui les referencent deja - voir backend/db.py,
// _migrate_categories_competences_predefinies_if_needed) : il n'existe
// donc plus qu'UN SEUL ensemble de categories, toutes traitees de facon
// identique (modifiables et supprimables par l'utilisateur, sans
// distinction visible a l'ecran entre categories "d'origine" et
// "personnalisees").
function toutesCategoriesCompetence(){
  return STATE.competenceCategories.slice()
    .sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); })
    .map(function(c){ return {id:c.id, label:c.nom}; });
}
function categorieCompetenceLabel(id){
  var c = STATE.competenceCategories.find(function(x){return x.id===id;});
  if(c) return c.nom;
  // Categorie supprimee du referentiel (voir deleteCategorieCompetence
  // ci-dessus, appelee depuis renderGestionCompetences) : les competences
  // qui la referencaient encore gardent leur id en base (jamais touche),
  // mais on evite d'afficher cet id technique brut.
  return id ? 'Catégorie supprimée' : '—';
}
function saveCategorieCompetence(nom){
  return STATE.db.collection('competenceCategories').add({nom:nom, createdAt:nowISO(), creePar:currentUserName()});
}
function deleteCategorieCompetence(id){ return deleteDoc('competenceCategories', id); }

function saveCompetenceReferentiel(data, id){
  if(id) return STATE.db.doc('competencesReferentiel/'+id).update(data);
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('competencesReferentiel').add(data);
}

// Historique des niveaux : une entree ajoutee a chaque changement, meme
// principe que withHistoriqueIndices() pour les livrables - porte
// directement sur le document Personnel (champ 'competences', tableau de
// {competenceId, competenceNom, niveau, historique:[...]}), jamais sur le
// referentiel lui-meme (qui ne porte que le catalogue des noms/categories).
function withHistoriqueCompetence(existingList, competenceId, competenceNom, niveau){
  var list = Array.isArray(existingList) ? existingList.slice() : [];
  var existant = list.find(function(c){ return c.competenceId===competenceId; });
  var hist = (existant && Array.isArray(existant.historique)) ? existant.historique.slice() : [];
  hist.push({niveau: niveau, date: nowISO(), par: currentUserName()});
  var entry = {competenceId: competenceId, competenceNom: competenceNom, niveau: niveau, historique: hist};
  if(existant){ list = list.map(function(c){ return c.competenceId===competenceId ? entry : c; }); }
  else { list.push(entry); }
  return list;
}
function setNiveauCompetencePersonne(personneId, competenceId, competenceNom, niveau){
  var p = STATE.personnel.find(function(x){ return x.id===personneId; });
  var nouvelleListe = withHistoriqueCompetence(p?p.competences:null, competenceId, competenceNom, niveau);
  return STATE.db.doc('personnel/'+personneId).update({competences: nouvelleListe});
}
function niveauCompetencePersonne(p, competenceId){
  var c = (p && Array.isArray(p.competences)) ? p.competences.find(function(x){ return x.competenceId===competenceId; }) : null;
  return (c && c.niveau!=null) ? c.niveau : '';
}

// V1.90 : niveau ATTENDU par statut du personnel, pour chaque competence du
// referentiel - demande explicite de l'utilisateur ("on doit avoir par
// statut le niveau attendu par competence"), avec trois decisions
// confirmees via AskUserQuestion (voir claude/module-personnel.md) :
//   - geree depuis l'ecran "Gestion des competences" (3e bloc, matrice
//     Statuts x Competences), pas un ecran separe ;
//   - l'ecart reel/attendu s'affiche DEJA sur la matrice d'evaluation
//     (Évaluation_Suivi), voir ecartBadgeHtml() plus bas ;
//   - historise a chaque changement, exactement comme un niveau reel
//     (reutilise directement withHistoriqueCompetence() ci-dessus, qui est
//     deja generique).
//
// Stockage DANS UNE COLLECTION SEPAREE ('niveauxAttendusStatuts', un
// document par statut, id = id du statut) plutot que directement sur le
// document 'personnelStatuts' (qui porte juste {nom, createdAt, creePar}) :
// la gestion des NOMS de statut reste rattachee a la section ACCESS
// "personnel" (memes droits que le registre Personnel - Admin/Comptable/RH,
// voir V1.88), alors que cette matrice de niveaux attendus est rattachee a
// la section ACCESS "competences" (Admin/RH uniquement, comme le reste du
// module competences - voir backend/access.py). Melanger les deux dans le
// meme document aurait expose les niveaux attendus a Comptable (qui a
// 'full' sur 'personnel' mais explicitement PAS sur 'competences' depuis la
// V1.85) des qu'il aurait eu acces en ecriture a 'personnelStatuts'.
function niveauxAttendusDoc(statutId){
  return STATE.niveauxAttendusStatuts.find(function(x){ return x.id===statutId; });
}
function niveauAttenduStatut(statutId, competenceId){
  if(!statutId) return '';
  var doc = niveauxAttendusDoc(statutId);
  var c = (doc && Array.isArray(doc.niveauxAttendus)) ? doc.niveauxAttendus.find(function(x){ return x.competenceId===competenceId; }) : null;
  return (c && c.niveau!=null) ? c.niveau : '';
}
function setNiveauAttenduStatut(statutId, competenceId, competenceNom, niveau){
  var doc = niveauxAttendusDoc(statutId);
  var nouvelleListe = withHistoriqueCompetence(doc?doc.niveauxAttendus:null, competenceId, competenceNom, niveau);
  return STATE.db.doc('niveauxAttendusStatuts/'+statutId).update({niveauxAttendus: nouvelleListe});
}
// Petit badge d'ecart affiche a cote du niveau REEL d'une personne sur
// Évaluation_Suivi, en fonction du niveau ATTENDU pour son statut - rien
// n'est affiche si le statut de la personne n'a pas de niveau attendu
// defini pour cette competence (pas de bruit visuel inutile).
function ecartBadgeHtml(actuel, attendu){
  if(attendu===''||attendu==null) return '';
  if(actuel===''||actuel==null) return '<span class="pill pill-neutral" style="font-size:10px;white-space:nowrap;">Attendu '+esc(attendu)+'</span>';
  if(actuel < attendu) return '<span class="pill pill-danger" style="font-size:10px;white-space:nowrap;">▼ attendu '+esc(attendu)+'</span>';
  if(actuel > attendu) return '<span class="pill pill-success" style="font-size:10px;white-space:nowrap;">▲ attendu '+esc(attendu)+'</span>';
  return '<span class="pill pill-success" style="font-size:10px;white-space:nowrap;">✓ attendu '+esc(attendu)+'</span>';
}

// V1.87 : l'ancien ecran unique "Compétences" (V1.85/V1.86) est scinde en
// deux, a la demande explicite de l'utilisateur - voir
// claude/module-personnel.md pour la discussion complete :
//   - "Gestion des compétences" (renderGestionCompetences ci-dessous) :
//     CATALOGUE uniquement (categories + noms de competences), aucune
//     personne, aucun niveau ;
//   - "Évaluation_Suivi" (renderEvaluationSuivi plus bas) : matrice
//     d'evaluation des personnes + fiche d'evolution par personne
//     (historique), aucune gestion du catalogue.
// Les deux ecrans partagent la meme section ACCESS "competences" (voir
// access() plus haut) - decision explicite de l'utilisateur, memes droits
// RH/Administrateur pour les deux.

// V1.91 : filtres par categorie, independants, pour les blocs "Competences"
// et "Niveaux attendus par statut" de l'ecran Gestion des competences -
// demande explicite de l'utilisateur. Variables au niveau module (meme
// patron que livrablesFilter/devisFilter/etc.) pour persister la selection
// entre deux re-rendus (polling STATE toutes les 2s).
var gestionCompetencesFilter = {catComp:'', catNiveaux:''};

function renderGestionCompetences(mount, actions){
  var canEdit = canWrite('gestionCompetences');
  if(canEdit){
    actions.innerHTML =
      '<button type="button" class="btn" id="btn-new-categorie">'+ic('plus',15)+' Nouvelle catégorie</button> '+
      '<button type="button" class="btn btn-primary" id="btn-new-competence">'+ic('plus',15)+' Nouvelle compétence</button>';
    byId('btn-new-categorie').addEventListener('click', function(){ openCategorieFormModal(null); });
    byId('btn-new-competence').addEventListener('click', function(){ openCompetenceRefFormModal(null); });
  }

  var body = '<p class="hint" style="margin:0 0 16px;">Catalogue des compétences de l’entreprise : les catégories et les noms de compétences disponibles. L’évaluation de chaque personne et le suivi de son évolution se font depuis l’écran « Évaluation_Suivi ».</p>';

  // V1.88 : a la demande explicite de l'utilisateur ("une categorie doit
  // etre modifiable et supprimable" - les 5 categories d'origine
  // (Discipline technique/Logiciel metier/Habilitation ou
  // certification/Langue/Autre) n'apparaissaient jusqu'ici que comme texte
  // informatif, non modifiable - voir claude/module-personnel.md), toutes
  // les categories (d'origine ou personnalisees) sont desormais de vrais
  // documents de la collection 'competenceCategories' (migration
  // serveur au demarrage, voir backend/db.py,
  // _migrate_categories_competences_predefinies_if_needed) et s'affichent
  // ici dans UNE SEULE liste, toutes modifiables/supprimables de la meme
  // facon - plus de distinction "predefinie/personnalisee" cote interface.
  var categoriesTriees = STATE.competenceCategories.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  body += '<div class="card card-pad" style="margin-bottom:16px;">'+
    '<div class="section-head" style="margin-bottom:8px;"><h3 style="font-size:14px;">Catégories</h3></div>'+
    (categoriesTriees.length ?
      '<div class="table-wrap"><table><thead><tr><th>Catégorie</th><th>Créée le</th><th>Créée par</th><th></th></tr></thead><tbody>'+
        categoriesTriees.map(function(c){
          return '<tr><td><b>'+esc(c.nom)+'</b></td><td class="muted" style="font-size:12.5px;">'+fmtDate(c.createdAt)+'</td><td class="muted" style="font-size:12.5px;">'+esc(c.creePar||'—')+'</td>'+
            '<td><div class="row-actions">'+
              (canEdit? '<button type="button" class="iconbtn" data-edit-cat="'+c.id+'" title="Modifier">'+ic('pencil',14)+'</button>'+
              '<button type="button" class="iconbtn" data-del-cat="'+c.id+'" title="Supprimer">'+ic('trash',14)+'</button>' : '<span class="muted">—</span>')+
            '</div></td></tr>';
        }).join('')+
      '</tbody></table></div>' :
      '<p class="hint" style="margin:0;">Aucune catégorie pour le moment.</p>')+
  '</div>';

  var toutesCompetences = STATE.competencesReferentiel.slice().sort(function(a,b){
    if(a.categorie!==b.categorie) return categorieCompetenceLabel(a.categorie).localeCompare(categorieCompetenceLabel(b.categorie));
    return (a.nom||'').localeCompare(b.nom||'');
  });
  // V1.91 : filtre par categorie (independant du filtre de la matrice ci-
  // dessous) - demande explicite de l'utilisateur ("les competences doivent
  // pouvoir etre filtres par categorie").
  var competences = toutesCompetences.filter(function(c){
    return !gestionCompetencesFilter.catComp || c.categorie===gestionCompetencesFilter.catComp;
  });
  var filtreCompHtml = categoriesTriees.length ?
    '<select id="filtre-cat-competences"><option value="">Toutes catégories</option>'+
      categoriesTriees.map(function(c){ return '<option value="'+esc(c.id)+'"'+(gestionCompetencesFilter.catComp===c.id?' selected':'')+'>'+esc(c.nom)+'</option>'; }).join('')+
    '</select>' : '';
  body += '<div class="card card-pad">'+
    '<div class="section-head" style="margin-bottom:8px;"><h3 style="font-size:14px;">Compétences</h3>'+filtreCompHtml+'</div>'+
    (toutesCompetences.length===0 ?
      emptyState('star', 'Aucune compétence définie dans le référentiel pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-competence">'+ic('plus',15)+' Ajouter une compétence</button>' : '') :
    competences.length===0 ?
      '<p class="hint" style="margin:0;">Aucune compétence dans cette catégorie.</p>' :
      '<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Catégorie</th><th>Créée le</th><th>Créée par</th><th></th></tr></thead><tbody>'+
        competences.map(function(c){
          return '<tr><td><b>'+esc(c.nom)+'</b></td><td class="muted">'+esc(categorieCompetenceLabel(c.categorie))+'</td>'+
            '<td class="muted" style="font-size:12.5px;">'+fmtDate(c.createdAt)+'</td><td class="muted" style="font-size:12.5px;">'+esc(c.creePar||'—')+'</td>'+
            '<td><div class="row-actions">'+
              (canEdit? '<button type="button" class="iconbtn" data-edit-competence="'+c.id+'" title="Modifier">'+ic('pencil',14)+'</button>'+
              '<button type="button" class="iconbtn" data-del-competence="'+c.id+'" title="Supprimer">'+ic('trash',14)+'</button>' : '<span class="muted">—</span>')+
            '</div></td></tr>';
        }).join('')+
      '</tbody></table></div>')+
  '</div>';

  // V1.90 : niveaux ATTENDUS (cible, 1 a 5) par statut du personnel x
  // competence - demande explicite de l'utilisateur ("on doit avoir par
  // statut le niveau attendu par competence"), voir
  // claude/module-personnel.md pour les trois decisions confirmees. Geree
  // ici (3e bloc de cet ecran, decision explicite) plutot que sur un ecran
  // separe - a la difference de la matrice d'EVALUATION REELLE
  // (Évaluation_Suivi), cette matrice-ci ne porte que des cibles/references,
  // jamais une evaluation d'une personne precise.
  var statutsTries = STATE.personnelStatuts.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  // V1.91 : filtre par categorie, independant de celui du bloc "Competences"
  // ci-dessus - demande explicite de l'utilisateur ("les Niveaux attendus
  // par statut doivent etre filtres par categorie").
  var competencesMatrice = toutesCompetences.filter(function(c){
    return !gestionCompetencesFilter.catNiveaux || c.categorie===gestionCompetencesFilter.catNiveaux;
  });
  var filtreNiveauxHtml = categoriesTriees.length ?
    '<select id="filtre-cat-niveaux-attendus"><option value="">Toutes catégories</option>'+
      categoriesTriees.map(function(c){ return '<option value="'+esc(c.id)+'"'+(gestionCompetencesFilter.catNiveaux===c.id?' selected':'')+'>'+esc(c.nom)+'</option>'; }).join('')+
    '</select>' : '';
  body += '<div class="card card-pad" style="margin-top:16px;">'+
    '<div class="section-head" style="margin-bottom:8px;"><h3 style="font-size:14px;">Niveaux attendus par statut</h3>'+filtreNiveauxHtml+'</div>'+
    '<p class="hint" style="margin:0 0 8px;">Niveau cible (1 à 5) attendu pour chaque compétence, selon le statut du personnel — affiché en comparaison du niveau réel sur l’écran « Évaluation_Suivi ».</p>';
  if(!statutsTries.length){
    body += '<p class="hint" style="margin:0;">Aucun statut défini pour le moment — les statuts se gèrent depuis l’écran Personnel (bouton « Nouveau statut »).</p>';
  } else if(!toutesCompetences.length){
    body += '<p class="hint" style="margin:0;">Ajoutez d’abord au moins une compétence ci-dessus pour pouvoir définir des niveaux attendus.</p>';
  } else if(!competencesMatrice.length){
    body += '<p class="hint" style="margin:0;">Aucune compétence dans cette catégorie.</p>';
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Statut</th>'+
      competencesMatrice.map(function(c){
        return '<th class="r" style="min-width:110px;">'+esc(c.nom)+
          '<div class="muted" style="font-size:10.5px;font-weight:400;">'+esc(categorieCompetenceLabel(c.categorie))+'</div>'+
        '</th>';
      }).join('')+
      '</tr></thead><tbody>'+
      statutsTries.map(function(s){
        return '<tr><td><b>'+esc(s.nom)+'</b></td>'+
          competencesMatrice.map(function(c){
            var niveau = niveauAttenduStatut(s.id, c.id);
            if(!canEdit){
              return '<td class="r">'+(niveau!==''? '<span class="pill pill-neutral">'+esc(niveau)+'</span>' : '<span class="muted">—</span>')+'</td>';
            }
            return '<td class="r"><select class="statut-niveau-select" data-statut="'+esc(s.id)+'" data-comp="'+esc(c.id)+'" data-comp-nom="'+esc(c.nom)+'">'+
              '<option value=""'+(niveau===''?' selected':'')+'>—</option>'+
              [1,2,3,4,5].map(function(n){ return '<option value="'+n+'"'+(niveau===n?' selected':'')+'>'+n+'</option>'; }).join('')+
            '</select></td>';
          }).join('')+
        '</tr>';
      }).join('')+
      '</tbody></table></div>';
  }
  body += '</div>';

  mount.innerHTML = body;

  var emptyBtn = byId('empty-new-competence');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openCompetenceRefFormModal(null); });

  var filtreComp = byId('filtre-cat-competences');
  if(filtreComp) filtreComp.addEventListener('change', function(){ gestionCompetencesFilter.catComp = filtreComp.value; renderGestionCompetences(mount, actions); });
  var filtreNiveaux = byId('filtre-cat-niveaux-attendus');
  if(filtreNiveaux) filtreNiveaux.addEventListener('change', function(){ gestionCompetencesFilter.catNiveaux = filtreNiveaux.value; renderGestionCompetences(mount, actions); });

  mount.querySelectorAll('.statut-niveau-select').forEach(function(sel){
    sel.addEventListener('change', function(){
      var val = sel.value===''? null : Number(sel.value);
      setNiveauAttenduStatut(sel.getAttribute('data-statut'), sel.getAttribute('data-comp'), sel.getAttribute('data-comp-nom'), val)
        .then(function(){ toast('Niveau attendu enregistré', 'success'); })
        .catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
    });
  });

  mount.querySelectorAll('[data-edit-cat]').forEach(function(b){
    b.addEventListener('click', function(){ openCategorieFormModal(STATE.competenceCategories.find(function(c){ return c.id===b.getAttribute('data-edit-cat'); })); });
  });
  mount.querySelectorAll('[data-del-cat]').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.getAttribute('data-del-cat');
      var c = STATE.competenceCategories.find(function(x){ return x.id===id; });
      confirmDialog('Supprimer la catégorie « '+(c?c.nom:'')+' » ? Les compétences qui l’utilisent déjà conservent leur affectation en base, mais elle ne sera plus proposée pour de nouvelles compétences et s’affichera comme « Catégorie supprimée ».', {danger:true, okLabel:'Supprimer'}).then(function(ok){
        if(!ok) return;
        deleteCategorieCompetence(id).then(function(){ toast('Catégorie supprimée', 'success'); })
          .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
      });
    });
  });
  mount.querySelectorAll('[data-edit-competence]').forEach(function(b){
    b.addEventListener('click', function(){ openCompetenceRefFormModal(STATE.competencesReferentiel.find(function(c){ return c.id===b.getAttribute('data-edit-competence'); })); });
  });
  mount.querySelectorAll('[data-del-competence]').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.getAttribute('data-del-competence');
      var c = STATE.competencesReferentiel.find(function(x){ return x.id===id; });
      confirmDialog('Supprimer la compétence « '+(c?c.nom:'')+' » du référentiel ? Les niveaux déjà attribués aux personnes restent visibles dans leur historique mais elle disparaîtra de l’écran Évaluation_Suivi.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
        if(!ok) return;
        deleteDoc('competencesReferentiel', id).then(function(){ toast('Compétence supprimée', 'success'); })
          .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
      });
    });
  });
}

function openCategorieFormModal(item){
  var overlay = openModal({
    title: item ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    body: '<div class="field"><label for="catf-nom">Nom de la catégorie</label><input id="catf-nom" required value="'+esc(item?item.nom||'':'')+'" placeholder="ex. Sécurité chantier"></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="catf-save">Enregistrer</button>'
  });
  var catfSaveBtn = overlay.querySelector('#catf-save');
  catfSaveBtn.addEventListener('click', function(){
    var nom = byId('catf-nom').value.trim();
    if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
    if(toutesCategoriesCompetence().some(function(c){ return c.label.toLowerCase()===nom.toLowerCase() && c.id!==(item?item.id:null); })){
      toast('Cette catégorie existe déjà', 'danger'); return;
    }
    // V1.93 : meme garde-fou anti double-clic que openStatutPersonnelFormModal
    // (voir son commentaire) - evite deux categories au meme nom avec des
    // ids distincts.
    catfSaveBtn.disabled = true;
    var p = item ? STATE.db.doc('competenceCategories/'+item.id).update({nom:nom}) : saveCategorieCompetence(nom);
    p.then(function(){ closeModal(); toast(item?'Catégorie modifiée':'Catégorie ajoutée', 'success'); })
      .catch(function(err){ console.error(err); catfSaveBtn.disabled = false; toast('Erreur d’enregistrement', 'danger'); });
  });
}

function openCompetenceRefFormModal(item){
  var overlay = openModal({
    title: item ? 'Modifier la compétence' : 'Nouvelle compétence',
    body:
      '<div class="field"><label for="crf-nom">Nom de la compétence</label><input id="crf-nom" required value="'+esc(item?item.nom||'':'')+'"></div>'+
      '<div class="field"><label for="crf-categorie">Catégorie</label><select id="crf-categorie">'+
        toutesCategoriesCompetence().map(function(c){ return '<option value="'+esc(c.id)+'"'+(item&&item.categorie===c.id?' selected':'')+'>'+esc(c.label)+'</option>'; }).join('')+
      '</select></div>'+
      '<p class="hint" style="margin:0;">Catégorie manquante dans la liste ? Utilisez le bouton « Nouvelle catégorie » sur cet écran, puis revenez ici.</p>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="crf-save">Enregistrer</button>'
  });
  var crfSaveBtn = overlay.querySelector('#crf-save');
  crfSaveBtn.addEventListener('click', function(){
    var nom = byId('crf-nom').value.trim();
    if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
    if(STATE.competencesReferentiel.some(function(c){ return (c.nom||'').toLowerCase()===nom.toLowerCase() && c.id!==(item?item.id:null); })){
      toast('Cette compétence existe déjà dans le référentiel', 'danger'); return;
    }
    // V1.93 : meme garde-fou anti double-clic que openStatutPersonnelFormModal.
    crfSaveBtn.disabled = true;
    var data = {nom:nom, categorie: byId('crf-categorie').value};
    saveCompetenceReferentiel(data, item?item.id:null).then(function(){
      closeModal(); toast(item?'Compétence modifiée':'Compétence ajoutée au référentiel', 'success');
    }).catch(function(err){ console.error(err); crfSaveBtn.disabled = false; toast('Erreur d’enregistrement', 'danger'); });
  });
}

// V1.91 : filtres par categorie, par statut et par personne, independants -
// demande explicite de l'utilisateur ("idem evaluation et suivi un filtre
// par categorie un filtre par statut et un filtre par personne"). Variable
// au niveau module (meme patron que gestionCompetencesFilter et tous les
// filtres de liste de l'application) pour persister la selection entre deux
// re-rendus (polling STATE toutes les 2s).
var evaluationSuiviFilter = {catComp:'', statutId:'', personneId:''};

function renderEvaluationSuivi(mount, actions){
  var canEdit = canWrite('evaluationSuivi');
  actions.innerHTML = '<button type="button" class="btn" id="btn-vers-gestion-comp">'+ic('star',15)+' Gérer le référentiel</button>';
  byId('btn-vers-gestion-comp').addEventListener('click', function(){ goTo('gestionCompetences'); });

  var body = '<p class="hint" style="margin:0 0 12px;">Évaluation du niveau (1 à 5) de chaque personne sur chaque compétence du référentiel, et suivi de son évolution — cliquez sur '+ic('trend',13)+' à côté d’une personne pour consulter son historique. Pour ajouter ou modifier une catégorie/compétence, utilisez l’écran « Gestion des compétences ». '+
    // V1.90 : le niveau ATTENDU (selon le statut de la personne, defini sur
    // l'ecran "Gestion des competences") s'affiche sous le niveau reel
    // quand il existe, avec un indicateur d'ecart (ecartBadgeHtml) - rien
    // ne s'affiche pour une personne sans statut ou sans niveau attendu
    // defini pour cette competence.
    'Quand un niveau attendu existe pour le statut de la personne, l’écart avec le niveau réel s’affiche sous la cellule.</p>';

  var toutesCompetences = STATE.competencesReferentiel.slice().sort(function(a,b){
    if(a.categorie!==b.categorie) return categorieCompetenceLabel(a.categorie).localeCompare(categorieCompetenceLabel(b.categorie));
    return (a.nom||'').localeCompare(b.nom||'');
  });
  if(!toutesCompetences.length){
    body += emptyState('star', 'Aucune compétence définie dans le référentiel pour le moment.', '<button type="button" class="btn btn-primary" id="empty-vers-gestion-comp">'+ic('plus',15)+' Aller sur « Gestion des compétences »</button>');
    mount.innerHTML = body;
    var emptyBtn = byId('empty-vers-gestion-comp');
    if(emptyBtn) emptyBtn.addEventListener('click', function(){ goTo('gestionCompetences'); });
    return;
  }

  var toutesPersonnes = STATE.personnel.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  if(!toutesPersonnes.length){
    body += emptyState('idcard', 'Aucun membre du personnel enregistré — ajoutez d’abord des personnes depuis l’écran Personnel pour pouvoir leur attribuer un niveau.');
    mount.innerHTML = body;
    return;
  }

  // V1.91 : trois filtres independants - categorie (colonnes/competences),
  // statut et personne (lignes/personnes). Les listes deroulantes proposent
  // toujours l'ensemble complet (categories/statuts/personnes existants),
  // independamment des filtres deja appliques par ailleurs.
  var categoriesTrieesFiltre = STATE.competenceCategories.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  var statutsTriesFiltre = STATE.personnelStatuts.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

  // V1.94 : le select "Personne" ne doit lister que les personnes ayant le
  // statut selectionne dans le select "Statut" (cascade statut -> personne,
  // demande explicitement par l'utilisateur). Le filtrage du TABLEAU par
  // statut fonctionnait deja correctement depuis la V1.92 - c'etait le
  // CONTENU de ce select qui restait non filtre (il listait toujours tout
  // le monde), ce qui donnait l'impression que le filtre statut etait sans
  // effet. Si la personne actuellement selectionnee n'a plus ce statut
  // (changement de filtre statut apres coup), on reinitialise la selection
  // plutot que de garder une valeur qui ne correspond plus a aucune option.
  var personnesPourSelect = toutesPersonnes.filter(function(p){
    return !evaluationSuiviFilter.statutId || p.statut===evaluationSuiviFilter.statutId;
  });
  if(evaluationSuiviFilter.personneId && !personnesPourSelect.some(function(p){ return p.id===evaluationSuiviFilter.personneId; })){
    evaluationSuiviFilter.personneId = '';
  }

  body += '<div class="toolbar" style="margin:-4px 0 14px;">'+
    '<select id="es-filtre-categorie"><option value="">Toutes catégories</option>'+
      categoriesTrieesFiltre.map(function(c){ return '<option value="'+esc(c.id)+'"'+(evaluationSuiviFilter.catComp===c.id?' selected':'')+'>'+esc(c.nom)+'</option>'; }).join('')+
    '</select>'+
    '<select id="es-filtre-statut"><option value="">Tous les statuts</option>'+
      statutsTriesFiltre.map(function(s){ return '<option value="'+esc(s.id)+'"'+(evaluationSuiviFilter.statutId===s.id?' selected':'')+'>'+esc(s.nom)+'</option>'; }).join('')+
    '</select>'+
    '<select id="es-filtre-personne"><option value="">Toutes les personnes</option>'+
      personnesPourSelect.map(function(p){ return '<option value="'+esc(p.id)+'"'+(evaluationSuiviFilter.personneId===p.id?' selected':'')+'>'+esc(p.nom)+'</option>'; }).join('')+
    '</select>'+
  '</div>';

  var competences = toutesCompetences.filter(function(c){
    return !evaluationSuiviFilter.catComp || c.categorie===evaluationSuiviFilter.catComp;
  });
  var personnes = toutesPersonnes.filter(function(p){
    if(evaluationSuiviFilter.statutId && p.statut!==evaluationSuiviFilter.statutId) return false;
    if(evaluationSuiviFilter.personneId && p.id!==evaluationSuiviFilter.personneId) return false;
    return true;
  });

  if(!competences.length){
    body += '<p class="hint" style="margin:0;">Aucune compétence dans cette catégorie.</p>';
    mount.innerHTML = body;
    wireEvaluationSuiviFiltres(mount, actions);
    return;
  }
  if(!personnes.length){
    body += '<p class="hint" style="margin:0;">Aucune personne ne correspond aux filtres sélectionnés.</p>';
    mount.innerHTML = body;
    wireEvaluationSuiviFiltres(mount, actions);
    return;
  }

  body += '<div class="table-wrap"><table><thead><tr><th style="white-space:nowrap;">Personne</th>'+
    competences.map(function(c){
      return '<th class="r" style="min-width:120px;">'+esc(c.nom)+
        '<div class="muted" style="font-size:10.5px;font-weight:400;">'+esc(categorieCompetenceLabel(c.categorie))+'</div>'+
      '</th>';
    }).join('')+
    '</tr></thead><tbody>'+
    personnes.map(function(p){
      return '<tr>'+
        // V1.93 : le nom doit tenir sur une seule ligne (demande explicite
        // de l'utilisateur) - sans "white-space:nowrap" ici, cette colonne
        // se faisait ecraser par les nombreuses colonnes de competences de
        // la matrice et le nom passait a la ligne. Seul le nom est concerne
        // (le sous-texte fonction/statut, lui, peut toujours passer a la
        // ligne si besoin).
        '<td style="white-space:nowrap;"><button type="button" class="iconbtn" data-fiche-personne="'+esc(p.id)+'" title="Voir l’évolution de '+esc(p.nom)+'" style="margin-right:4px;vertical-align:middle;">'+ic('trend',14)+'</button>'+
          // V1.95 : radar de competences (reel vs attendu) par personne,
          // moyenne par categorie - demande explicite de l'utilisateur.
          '<button type="button" class="iconbtn" data-radar-personne="'+esc(p.id)+'" title="Voir le radar de compétences de '+esc(p.nom)+'" style="margin-right:4px;vertical-align:middle;">'+ic('radar',14)+'</button>'+
          '<b>'+esc(p.nom)+'</b>'+(p.actif===false?' <span class="muted" style="font-size:11px;">(inactif)</span>':'')+
          // V1.91 : affichage du statut de chaque personne sur cette page -
          // demande explicite de l'utilisateur. Toujours affiche (y compris
          // "—" si aucun statut), meme logique de repli que
          // statutPersonnelLabel() ailleurs dans l'application.
          '<div class="muted" style="font-size:11.5px;margin-left:26px;white-space:normal;">'+
            (p.fonction? esc(p.fonction)+' · ' : '')+'Statut : '+esc(statutPersonnelLabel(p.statut))+
          '</div>'+
        '</td>'+
        competences.map(function(c){
          var niveau = niveauCompetencePersonne(p, c.id);
          var attendu = niveauAttenduStatut(p.statut, c.id);
          var ecart = ecartBadgeHtml(niveau, attendu);
          if(!canEdit){
            return '<td class="r">'+(niveau!==''? '<span class="pill pill-primary">'+esc(niveau)+'</span>' : '<span class="muted">—</span>')+
              (ecart? '<div style="margin-top:3px;">'+ecart+'</div>' : '')+
            '</td>';
          }
          return '<td class="r"><select class="comp-niveau-select" data-personne="'+esc(p.id)+'" data-comp="'+esc(c.id)+'" data-comp-nom="'+esc(c.nom)+'">'+
            '<option value=""'+(niveau===''?' selected':'')+'>—</option>'+
            [1,2,3,4,5].map(function(n){ return '<option value="'+n+'"'+(niveau===n?' selected':'')+'>'+n+'</option>'; }).join('')+
          '</select>'+
          (ecart? '<div style="margin-top:3px;">'+ecart+'</div>' : '')+
          '</td>';
        }).join('')+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';

  mount.innerHTML = body;
  wireEvaluationSuiviFiltres(mount, actions);

  mount.querySelectorAll('.comp-niveau-select').forEach(function(sel){
    sel.addEventListener('change', function(){
      var val = sel.value===''? null : Number(sel.value);
      setNiveauCompetencePersonne(sel.getAttribute('data-personne'), sel.getAttribute('data-comp'), sel.getAttribute('data-comp-nom'), val)
        .then(function(){ toast('Niveau enregistré', 'success'); })
        .catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
    });
  });
  mount.querySelectorAll('[data-fiche-personne]').forEach(function(b){
    b.addEventListener('click', function(){
      openFicheEvolutionModal(STATE.personnel.find(function(p){ return p.id===b.getAttribute('data-fiche-personne'); }));
    });
  });
  mount.querySelectorAll('[data-radar-personne]').forEach(function(b){
    b.addEventListener('click', function(){
      openRadarCompetencesModal(STATE.personnel.find(function(p){ return p.id===b.getAttribute('data-radar-personne'); }));
    });
  });
}

// V1.91 : cablage commun des 3 filtres de l'ecran Évaluation_Suivi -
// factorise car appele depuis les 3 chemins de sortie de
// renderEvaluationSuivi (tableau rendu, et les deux messages "aucun
// resultat" qui doivent malgre tout laisser les filtres actionnables pour
// permettre a l'utilisateur de revenir en arriere).
function wireEvaluationSuiviFiltres(mount, actions){
  var fCat = byId('es-filtre-categorie');
  if(fCat) fCat.addEventListener('change', function(){ evaluationSuiviFilter.catComp = fCat.value; renderEvaluationSuivi(mount, actions); });
  var fStatut = byId('es-filtre-statut');
  if(fStatut) fStatut.addEventListener('change', function(){ evaluationSuiviFilter.statutId = fStatut.value; renderEvaluationSuivi(mount, actions); });
  var fPersonne = byId('es-filtre-personne');
  if(fPersonne) fPersonne.addEventListener('change', function(){ evaluationSuiviFilter.personneId = fPersonne.value; renderEvaluationSuivi(mount, actions); });
}

// V1.87 : "fiche d'evolution" d'une personne - vue d'ensemble demandee
// explicitement par l'utilisateur pour le "suivi" (par opposition a un
// historique par cellule individuelle) : liste, pour CHAQUE competence sur
// laquelle cette personne a deja ete evaluee, son niveau actuel et
// l'historique chronologique complet des changements (meme principe de
// presentation que openLivrableHistoriqueModal pour les indices des
// livrables). Lecture seule - aucune modification possible depuis cette
// fenetre (on modifie un niveau depuis la matrice de l'ecran
// Évaluation_Suivi, jamais ici).
function openFicheEvolutionModal(p){
  if(!p) return;
  var entries = (Array.isArray(p.competences) ? p.competences.slice() : [])
    .sort(function(a,b){ return (a.competenceNom||'').localeCompare(b.competenceNom||''); });
  var body;
  if(!entries.length){
    body = '<p class="hint" style="margin:0;">Aucune compétence évaluée pour le moment pour cette personne.</p>';
  } else {
    body = entries.map(function(e){
      var hist = (Array.isArray(e.historique) && e.historique.length) ? e.historique.slice().reverse() : [];
      return '<div style="margin-bottom:16px;">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><b>'+esc(e.competenceNom)+'</b>'+
          (e.niveau!=null? '<span class="pill pill-primary">Niveau '+esc(e.niveau)+'</span>' : '<span class="muted">Non évalué</span>')+
        '</div>'+
        (hist.length ?
          '<table style="width:100%;"><tbody>'+
            hist.map(function(h){
              return '<tr>'+
                '<td class="num" style="white-space:nowrap;vertical-align:top;font-weight:600;width:70px;">'+(h.niveau!=null?esc(h.niveau):'—')+'</td>'+
                '<td class="muted" style="font-size:12.5px;vertical-align:top;">'+fmtDateTime(h.date)+(h.par?' — par '+esc(h.par):'')+'</td>'+
              '</tr>';
            }).join('')+
          '</tbody></table>' :
          '<p class="hint" style="margin:0;">Pas d’historique détaillé.</p>')+
      '</div>';
    }).join('');
  }
  openModal({
    title: 'Évolution de ' + (p.nom||''),
    large: true,
    body: body,
    foot: '<button type="button" class="btn" data-close-modal>Fermer</button>'
  });
}

// V1.95 : radar de competences par personne, un radar par personne avec un
// axe par CATEGORIE (demande explicite de l'utilisateur, 3 questions
// tranchees via AskUserQuestion - voir claude/module-personnel.md) :
//   - bouton sur Évaluation_Suivi, a cote de "Voir l'evolution" (meme
//     patron que la Fiche d'evolution, V1.87) ;
//   - TOUTES les categories du referentiel apparaissent comme axe, meme
//     sans aucune competence/donnee pour cette personne (axe a 0) ;
//   - si la personne n'a aucune donnee du tout, le radar s'affiche quand
//     meme, entierement a 0 (pas de message special) ;
//   - le niveau d'une categorie (reel ET attendu) est la MOYENNE des
//     niveaux de ses competences - seules les competences ayant une valeur
//     definie entrent dans la moyenne ; si aucune n'en a, la categorie vaut
//     0, par coherence avec la regle ci-dessus pour les categories sans
//     aucune donnee.
//
// Aucun changement backend : calcul purement cote client a partir des
// donnees deja chargees (STATE.competencesReferentiel, STATE.personnel,
// STATE.niveauxAttendusStatuts) - aucune nouvelle route API.
function calculerRadarCompetences(p){
  return toutesCategoriesCompetence().map(function(cat){
    var comps = STATE.competencesReferentiel.filter(function(c){ return c.categorie===cat.id; });
    var reelValeurs = [];
    var attenduValeurs = [];
    comps.forEach(function(c){
      var r = niveauCompetencePersonne(p, c.id);
      if(r!=='') reelValeurs.push(r);
      var a = niveauAttenduStatut(p?p.statut:null, c.id);
      if(a!=='') attenduValeurs.push(a);
    });
    var moyenne = function(arr){ return arr.length ? (arr.reduce(function(s,v){ return s+v; },0) / arr.length) : 0; };
    return {
      id: cat.id,
      label: cat.label,
      nbCompetences: comps.length,
      reel: moyenne(reelValeurs),
      reelCompte: reelValeurs.length,
      attendu: moyenne(attenduValeurs),
      attenduCompte: attenduValeurs.length
    };
  });
}

// V1.97 : detail d'une categorie, accessible en cliquant sur sa ligne dans
// le tableau de openRadarCompetencesModal - meme principe que
// calculerRadarCompetences ci-dessus, mais un axe par COMPETENCE de cette
// seule categorie (au lieu d'un axe par categorie, moyenne). Pas de
// moyenne ici : chaque axe porte directement le niveau reel/attendu de la
// competence elle-meme (0 si non defini, meme convention que plus haut).
function calculerRadarCompetencesDetail(p, categorieId){
  return STATE.competencesReferentiel
    .filter(function(c){ return c.categorie===categorieId; })
    .slice()
    .sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); })
    .map(function(c){
      var r = niveauCompetencePersonne(p, c.id);
      var a = niveauAttenduStatut(p?p.statut:null, c.id);
      return {
        id: c.id,
        label: c.nom,
        reel: r===''?0:r,
        reelCompte: r===''?0:1,
        attendu: a===''?0:a,
        attenduCompte: a===''?0:1
      };
    });
}

// Construit le radar lui-meme en SVG inline (aucune bibliotheque externe -
// l'application fonctionne hors-ligne sur le poste de l'utilisateur, pas de
// dependance CDN). Deux polygones superposes : niveau reel (moyenne) et
// niveau attendu (moyenne), echelle 0 a 5 (0 = aucune donnee, en-dessous du
// minimum valide de 1, pour rester visuellement distinct d'un vrai niveau
// 1 faible).
function buildRadarSvg(cats){
  var n = cats.length;
  var size = 340, center = size/2, maxR = center - 62, niveauMax = 5;
  function pt(i, valeur){
    var angle = (Math.PI*2*i/n) - Math.PI/2;
    var r = (valeur/niveauMax) * maxR;
    return [center + r*Math.cos(angle), center + r*Math.sin(angle)];
  }
  var grilleHtml = '';
  for(var lvl=1; lvl<=niveauMax; lvl++){
    var pts = [];
    for(var i=0;i<n;i++){ var pp = pt(i, lvl); pts.push(pp[0].toFixed(1)+','+pp[1].toFixed(1)); }
    grilleHtml += '<polygon points="'+pts.join(' ')+'" fill="none" stroke="var(--border)" stroke-width="1"/>';
  }
  var axesHtml = '', labelsHtml = '';
  for(var i=0;i<n;i++){
    var bout = pt(i, niveauMax);
    axesHtml += '<line x1="'+center+'" y1="'+center+'" x2="'+bout[0].toFixed(1)+'" y2="'+bout[1].toFixed(1)+'" stroke="var(--border)" stroke-width="1"/>';
    var angle = (Math.PI*2*i/n) - Math.PI/2;
    var labelPt = pt(i, niveauMax + 1.05);
    var ancrage = Math.cos(angle) > 0.25 ? 'start' : (Math.cos(angle) < -0.25 ? 'end' : 'middle');
    labelsHtml += '<text x="'+labelPt[0].toFixed(1)+'" y="'+labelPt[1].toFixed(1)+'" font-size="11" text-anchor="'+ancrage+'" fill="var(--ink-faint)">'+esc(cats[i].label)+'</text>';
  }
  var attenduPts = cats.map(function(c,i){ var pp=pt(i,c.attendu); return pp[0].toFixed(1)+','+pp[1].toFixed(1); }).join(' ');
  var reelPts = cats.map(function(c,i){ var pp=pt(i,c.reel); return pp[0].toFixed(1)+','+pp[1].toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="100%" style="max-width:440px;height:auto;display:block;margin:0 auto;overflow:visible;">'+
    grilleHtml + axesHtml +
    '<polygon points="'+attenduPts+'" fill="var(--warning)" fill-opacity="0.16" stroke="var(--warning)" stroke-width="2" stroke-dasharray="5,4"/>'+
    '<polygon points="'+reelPts+'" fill="var(--primary)" fill-opacity="0.2" stroke="var(--primary)" stroke-width="2"/>'+
    labelsHtml+
  '</svg>';
}

function openRadarCompetencesModal(p){
  if(!p) return;
  var cats = calculerRadarCompetences(p);
  var body;
  if(cats.length < 3){
    body = '<p class="hint" style="margin:0;">Pas assez de catégories de compétences définies pour tracer un radar (3 minimum). Ajoutez des catégories depuis « Gestion des compétences ».</p>';
  } else {
    // V1.96 : tableau a gauche, legende + radar a droite (demande
    // explicite de l'utilisateur - auparavant tout etait empile
    // verticalement). flex-wrap pour rester lisible si la fenetre est
    // etroite (le tableau repasse alors au-dessus du radar).
    // V1.97 : lignes cliquables (data-radar-categorie) ouvrant le detail de
    // la categorie - voir calculerRadarCompetencesDetail/
    // openRadarCompetenceDetailModal plus bas, et le onMount cable sur ce
    // openModal(). Le hover de fond des lignes de tableau existe deja
    // partout dans l'application (regle CSS generique tbody tr:hover),
    // d'ou le simple curseur "pointer" ici pour signaler l'interactivite.
    var tableauHtml =
      '<p class="hint" style="margin:0 0 8px;">Cliquez sur une catégorie pour voir le détail de ses compétences.</p>'+
      '<table style="width:100%;"><thead><tr><th>Catégorie</th><th class="r">Réel</th><th class="r">Attendu</th></tr></thead><tbody>'+
        cats.map(function(c){
          return '<tr data-radar-categorie="'+esc(c.id)+'" style="cursor:pointer;" title="Voir le détail des compétences de cette catégorie"><td>'+esc(c.label)+(c.nbCompetences? '<div class="muted" style="font-size:11px;">'+c.nbCompetences+' compétence'+(c.nbCompetences>1?'s':'')+'</div>' : '<div class="muted" style="font-size:11px;">Aucune compétence</div>')+'</td>'+
            '<td class="r">'+(c.reelCompte? c.reel.toFixed(1) : '<span class="muted">—</span>')+'</td>'+
            '<td class="r">'+(c.attenduCompte? c.attendu.toFixed(1) : '<span class="muted">—</span>')+'</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table>';
    var radarHtml =
      '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:10px;font-size:12.5px;">'+
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:50%;background:var(--primary);display:inline-block;"></span>Niveau réel (moyenne)</span>'+
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:50%;background:var(--warning);display:inline-block;"></span>Niveau attendu (moyenne)</span>'+
      '</div>'+
      buildRadarSvg(cats);
    body =
      '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'+
        '<div style="flex:1 1 280px;min-width:240px;">'+tableauHtml+'</div>'+
        '<div style="flex:1 1 360px;min-width:300px;">'+radarHtml+'</div>'+
      '</div>';
  }
  openModal({
    title: 'Radar de compétences — ' + (p.nom||''),
    large: true,
    body: body,
    foot: '<button type="button" class="btn" data-close-modal>Fermer</button>',
    onMount: function(overlay){
      overlay.querySelectorAll('[data-radar-categorie]').forEach(function(tr){
        tr.addEventListener('click', function(){
          openRadarCompetenceDetailModal(p, tr.getAttribute('data-radar-categorie'));
        });
      });
    }
  });
}

// V1.97 : detail d'une categorie, ouvert en cliquant sur sa ligne dans
// openRadarCompetencesModal ("lorsqu on clic sur une categorie [...] un
// tableau a gauche avec les competences de cette categorie et a droite le
// radar correspondant" - demande explicite de l'utilisateur, suite directe
// de la V1.96). Meme structure visuelle exacte que la modale parente
// (tableau a gauche, legende + radar a droite), mais un axe par COMPETENCE
// de cette seule categorie plutot qu'un axe par categorie - voir
// calculerRadarCompetencesDetail ci-dessus. Bouton "Retour" dans le pied de
// modale pour revenir a la vue par categorie sans tout refermer.
function openRadarCompetenceDetailModal(p, categorieId){
  if(!p) return;
  var catLabel = categorieCompetenceLabel(categorieId);
  var comps = calculerRadarCompetencesDetail(p, categorieId);
  var body;
  if(comps.length < 3){
    body = '<p class="hint" style="margin:0;">Pas assez de compétences définies dans cette catégorie pour tracer un radar (3 minimum). Ajoutez des compétences depuis « Gestion des compétences ».</p>';
  } else {
    var tableauHtml =
      '<table style="width:100%;"><thead><tr><th>Compétence</th><th class="r">Réel</th><th class="r">Attendu</th></tr></thead><tbody>'+
        comps.map(function(c){
          return '<tr><td>'+esc(c.label)+'</td>'+
            '<td class="r">'+(c.reelCompte? c.reel : '<span class="muted">—</span>')+'</td>'+
            '<td class="r">'+(c.attenduCompte? c.attendu : '<span class="muted">—</span>')+'</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table>';
    var radarHtml =
      '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:10px;font-size:12.5px;">'+
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:50%;background:var(--primary);display:inline-block;"></span>Niveau réel</span>'+
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:11px;height:11px;border-radius:50%;background:var(--warning);display:inline-block;"></span>Niveau attendu</span>'+
      '</div>'+
      buildRadarSvg(comps);
    body =
      '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'+
        '<div style="flex:1 1 280px;min-width:240px;">'+tableauHtml+'</div>'+
        '<div style="flex:1 1 360px;min-width:300px;">'+radarHtml+'</div>'+
      '</div>';
  }
  openModal({
    title: 'Radar de compétences — ' + (p.nom||'') + ' — ' + catLabel,
    large: true,
    body: body,
    foot: '<button type="button" class="btn" id="radar-detail-retour">← Retour</button>'+
          '<button type="button" class="btn" data-close-modal>Fermer</button>',
    onMount: function(overlay){
      var retour = overlay.querySelector('#radar-detail-retour');
      if(retour) retour.addEventListener('click', function(){ openRadarCompetencesModal(p); });
    }
  });
}

/* ---- Formations ---- */
var FORMATION_STATUTS = [
  {id:'planifiee', label:'Planifiée', tone:'neutral'},
  {id:'en_cours', label:'En cours', tone:'warning'},
  {id:'terminee', label:'Terminée', tone:'success'},
  {id:'annulee', label:'Annulée', tone:'danger'}
];

function saveFormation(data, id){
  if(id) return STATE.db.doc('formations/'+id).update(data);
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('formations').add(data);
}

function expirationBadgeHtml(dateExpiration){
  if(!dateExpiration) return '<span class="muted">—</span>';
  var j = daysBetween(todayISO(), dateExpiration);
  if(j<0) return '<span class="pill pill-danger">Expirée ('+fmtDate(dateExpiration)+')</span>';
  if(j<=60) return '<span class="pill pill-warning">Expire le '+fmtDate(dateExpiration)+' ('+j+'j)</span>';
  return '<span class="pill pill-neutral">'+fmtDate(dateExpiration)+'</span>';
}

var formationsFilter = {q:'', personneId:'', statut:''};
function renderFormations(mount, actions){
  var canEdit = canWrite('formations');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-formation">'+ic('plus',15)+' Nouvelle formation</button>';
    byId('btn-new-formation').addEventListener('click', function(){ openFormationFormModal(null); });
  }

  var personnesTriees = STATE.personnel.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

  var body = '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="form-search" placeholder="Rechercher par intitulé ou organisme…" value="'+esc(formationsFilter.q)+'">'+
      '<select id="form-filter-personne"><option value="">Toutes les personnes</option>'+
        personnesTriees.map(function(p){ return '<option value="'+esc(p.id)+'"'+(formationsFilter.personneId===p.id?' selected':'')+'>'+esc(p.nom)+'</option>'; }).join('')+
      '</select>'+
      '<select id="form-filter-statut"><option value="">Tous statuts</option>'+
        FORMATION_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(formationsFilter.statut===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+
      '</select>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Suivi des formations du personnel — indépendant du référentiel de compétences (une compétence visée par une formation n’est jamais mise à jour automatiquement).</p>';

  var list = STATE.formations.filter(function(f){
    if(formationsFilter.personneId && !(Array.isArray(f.personnes) && f.personnes.some(function(p){ return p.id===formationsFilter.personneId; }))) return false;
    if(formationsFilter.statut && f.statut!==formationsFilter.statut) return false;
    if(formationsFilter.q){
      var q = formationsFilter.q.toLowerCase();
      if((f.intitule||'').toLowerCase().indexOf(q)<0 && (f.organisme||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.dateDebut||'').localeCompare(a.dateDebut||''); });

  if(!STATE.formations.length){
    body += emptyState('graduation', 'Aucune formation enregistrée pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-formation">'+ic('plus',15)+' Ajouter une formation</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun résultat pour ces filtres.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Intitulé</th><th>Personnes</th><th>Organisme</th><th>Dates</th><th>Statut</th><th>Expiration</th><th></th></tr></thead><tbody>'+
      list.map(function(f){
        var st = statutMeta(FORMATION_STATUTS, f.statut);
        return '<tr>'+
          '<td><b>'+esc(f.intitule)+'</b></td>'+
          '<td class="muted" style="font-size:12.5px;">'+(Array.isArray(f.personnes)&&f.personnes.length? f.personnes.map(function(p){return esc(p.nom);}).join(', ') : '—')+'</td>'+
          '<td class="muted">'+esc(f.organisme||'—')+'</td>'+
          '<td class="num">'+fmtDate(f.dateDebut)+(f.dateFin? ' → '+fmtDate(f.dateFin) : '')+'</td>'+
          '<td><span class="pill pill-'+st.tone+'">'+esc(st.label)+'</span></td>'+
          '<td>'+expirationBadgeHtml(f.dateExpiration)+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit-formation="'+f.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-del-formation="'+f.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('')+'</tbody></table></div>';
  }
  mount.innerHTML = body;

  var searchEl = byId('form-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){
    formationsFilter.q = searchEl.value; renderFormations(mount, actions);
    searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }, 220));
  var persEl = byId('form-filter-personne');
  if(persEl) persEl.addEventListener('change', function(){ formationsFilter.personneId = persEl.value; renderFormations(mount, actions); });
  var statEl = byId('form-filter-statut');
  if(statEl) statEl.addEventListener('change', function(){ formationsFilter.statut = statEl.value; renderFormations(mount, actions); });

  var emptyBtn = byId('empty-new-formation');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openFormationFormModal(null); });
  mount.querySelectorAll('[data-edit-formation]').forEach(function(b){ b.addEventListener('click', function(){
    openFormationFormModal(STATE.formations.find(function(f){ return f.id===b.getAttribute('data-edit-formation'); }));
  }); });
  mount.querySelectorAll('[data-del-formation]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-del-formation');
    confirmDialog('Supprimer définitivement cette formation ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteDoc('formations', id).then(function(){ toast('Formation supprimée', 'success'); })
        .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
}

function openFormationFormModal(f){
  var personnesTriees = STATE.personnel.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });
  var overlay = openModal({
    title: f ? 'Modifier la formation' : 'Nouvelle formation',
    large: true,
    body:
      '<div class="field"><label for="ff-intitule">Intitulé</label><input id="ff-intitule" required value="'+esc(f?f.intitule||'':'')+'"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="ff-organisme">Organisme</label><input id="ff-organisme" value="'+esc(f?f.organisme||'':'')+'"></div>'+
        '<div class="field"><label for="ff-statut">Statut</label><select id="ff-statut">'+
          FORMATION_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(f&&f.statut===s.id?' selected':(!f&&s.id==='planifiee'?' selected':''))+'>'+esc(s.label)+'</option>'; }).join('')+
        '</select></div>'+
      '</div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="ff-debut">Date de début</label><input type="date" id="ff-debut" value="'+esc(f?f.dateDebut||'':'')+'"></div>'+
        '<div class="field"><label for="ff-fin">Date de fin</label><input type="date" id="ff-fin" value="'+esc(f?f.dateFin||'':'')+'"></div>'+
        '<div class="field"><label for="ff-cout">Coût (MAD)</label><input type="number" step="any" id="ff-cout" value="'+(f&&f.cout!=null?f.cout:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="ff-expiration">Date d’expiration <span class="muted" style="font-weight:400;">(certification/habilitation à renouveler — laisser vide si non applicable)</span></label><input type="date" id="ff-expiration" value="'+esc(f?f.dateExpiration||'':'')+'"></div>'+
      '<div class="field"><label>Personnes concernées</label>'+
        '<div id="ff-personnes" style="border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;max-height:150px;overflow:auto;">'+
          (personnesTriees.length ?
            personnesTriees.map(function(p){
              var checked = (Array.isArray(f&&f.personnes) ? f.personnes : []).some(function(x){ return x.id===p.id; });
              return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:3px 0;">'+
                '<input type="checkbox" class="ff-pers-chk" value="'+esc(p.id)+'" data-nom="'+esc(p.nom||'')+'" style="width:auto;"'+(checked?' checked':'')+'> '+esc(p.nom||'—')+
              '</label>';
            }).join('')
            : '<p class="hint" style="margin:0;">Aucune fiche dans le registre Personnel.</p>')+
        '</div>'+
      '</div>'+
      '<div class="field"><label>Compétences visées <span class="muted" style="font-weight:400;">(indicatif — ne modifie pas les niveaux déjà attribués)</span></label>'+
        '<div id="ff-competences" style="border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;max-height:120px;overflow:auto;">'+
          (STATE.competencesReferentiel.length ?
            STATE.competencesReferentiel.map(function(c){
              var checked = (Array.isArray(f&&f.competencesViseesIds) ? f.competencesViseesIds : []).indexOf(c.id)>-1;
              return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:3px 0;">'+
                '<input type="checkbox" class="ff-comp-chk" value="'+esc(c.id)+'" style="width:auto;"'+(checked?' checked':'')+'> '+esc(c.nom)+
              '</label>';
            }).join('')
            : '<p class="hint" style="margin:0;">Aucune compétence dans le référentiel.</p>')+
        '</div>'+
      '</div>'+
      '<div class="field"><label for="ff-notes">Notes</label><textarea id="ff-notes">'+esc(f?f.notes||'':'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="ff-save">Enregistrer</button>'
  });
  overlay.querySelector('#ff-save').addEventListener('click', function(){
    var intitule = byId('ff-intitule').value.trim();
    if(!intitule){ toast('L’intitulé est obligatoire', 'danger'); return; }
    var personnes = Array.prototype.slice.call(overlay.querySelectorAll('.ff-pers-chk:checked')).map(function(chk){
      return {id: chk.value, nom: chk.getAttribute('data-nom')};
    });
    var competencesViseesIds = Array.prototype.slice.call(overlay.querySelectorAll('.ff-comp-chk:checked')).map(function(chk){ return chk.value; });
    var coutVal = byId('ff-cout').value;
    var data = {
      intitule: intitule, organisme: byId('ff-organisme').value.trim(),
      statut: byId('ff-statut').value,
      dateDebut: byId('ff-debut').value, dateFin: byId('ff-fin').value,
      cout: coutVal===''?null:Number(coutVal),
      dateExpiration: byId('ff-expiration').value || null,
      personnes: personnes, competencesViseesIds: competencesViseesIds,
      notes: byId('ff-notes').value.trim()
    };
    saveFormation(data, f?f.id:null).then(function(){
      closeModal(); toast('Formation enregistrée', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   COMPTABILITE - PLAN COMPTABLE (V1.32, etape 1 de l'integration de la
   comptabilite marocaine : outil de PRE-COMPTABILITE INTERNE - organise les
   factures/encaissements deja presents dans l'ERP selon les normes
   marocaines (CGNC) pour faciliter le travail du comptable/de la fiduciaire,
   ce n'est PAS une comptabilite legale au sens du Code de Commerce ni un
   remplacement des teledeclarations officielles. Voir
   claude/module-comptabilite.md pour le detail des decisions.)
   ========================================================= */
var CLASSES_COMPTABLES = [
  {id:1, label:'1 — Financement permanent'},
  {id:2, label:'2 — Actif immobilisé'},
  {id:3, label:'3 — Actif circulant (hors trésorerie)'},
  {id:4, label:'4 — Passif circulant (hors trésorerie)'},
  {id:5, label:'5 — Trésorerie'},
  {id:6, label:'6 — Charges'},
  {id:7, label:'7 — Produits'},
  {id:8, label:'8 — Résultats et comptes spéciaux'}
];
function classeLabel(n){ var c = CLASSES_COMPTABLES.find(function(x){ return x.id===Number(n); }); return c?c.label:('Classe '+n); }

function normCodeCompte(s){ return (s||'').trim(); }
function findCompteDoublon(code, excludeId){
  var cle = normCodeCompte(code);
  if(!cle) return null;
  return STATE.planComptable.find(function(c){ return c.id!==excludeId && normCodeCompte(c.code)===cle; }) || null;
}
function compteLabel(code){
  var c = STATE.planComptable.find(function(x){ return x.code===code; });
  return c ? (c.code+' — '+c.libelle) : code;
}

function saveCompte(data, id){
  if(id) return STATE.db.doc('planComptable/'+id).update(data);
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('planComptable').add(data);
}

var planComptableFilter = '';
function renderPlanComptable(mount, actions){
  var canEdit = canWrite('planComptable');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-compte">'+ic('plus',15)+' Nouveau compte</button>';
    byId('btn-new-compte').addEventListener('click', function(){ openCompteFormModal(null); });
  }
  var list = STATE.planComptable.filter(function(c){
    if(!planComptableFilter) return true;
    var q = planComptableFilter.toLowerCase();
    return (c.code||'').toLowerCase().indexOf(q)>-1 || (c.libelle||'').toLowerCase().indexOf(q)>-1;
  }).sort(function(a,b){ return (a.code||'').localeCompare(b.code||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="pc-search" placeholder="Rechercher par code ou libellé…" value="'+esc(planComptableFilter)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' compte(s)</span>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Plan comptable basé sur le Code Général de Normalisation Comptable (CGNC) marocain, limité aux comptes utiles à cette activité — modifiable librement. Les comptes utilisés automatiquement par les écritures générées depuis les factures/encaissements sont repérés par '+ic('link',12)+'.</p>';

  if(!STATE.planComptable.length){
    body += emptyState('book', 'Aucun compte dans le plan comptable.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-compte">'+ic('plus',15)+' Ajouter un compte</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun résultat pour cette recherche.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Code</th><th>Libellé</th><th>Classe</th><th>Sens</th><th class="r">Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(c){
        return '<tr>'+
          '<td class="num"><b>'+esc(c.code)+'</b>'+(c.note? ' '+ic('link',12) : '')+'</td>'+
          '<td>'+esc(c.libelle)+(c.note? '<div class="hint" style="margin:2px 0 0;">'+esc(c.note)+'</div>' : '')+'</td>'+
          '<td class="muted">'+esc(classeLabel(c.classe))+'</td>'+
          '<td class="muted">'+(c.sens==='crediteur'?'Créditeur':'Débiteur')+'</td>'+
          '<td class="r">'+(c.actif===false? '<span class="pill">Inactif</span>' : '<span class="pill pill-primary">Actif</span>')+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit-compte="'+c.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-del-compte="'+c.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var searchEl = byId('pc-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){
    planComptableFilter = searchEl.value; renderPlanComptable(mount, actions);
    searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }, 220));
  var emptyBtn = byId('empty-new-compte');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openCompteFormModal(null); });
  mount.querySelectorAll('[data-edit-compte]').forEach(function(b){ b.addEventListener('click', function(){
    openCompteFormModal(STATE.planComptable.find(function(c){ return c.id===b.getAttribute('data-edit-compte'); }));
  }); });
  mount.querySelectorAll('[data-del-compte]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-del-compte');
    confirmDialog('Supprimer définitivement ce compte du plan comptable ? Les écritures déjà générées qui le référencent resteront inchangées.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteDoc('planComptable', id).then(function(){ toast('Compte supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
}

// `opts.prefill` (optionnel, uniquement si c est null) : {code, libelle,
// sens, classe} pour preremplir le formulaire (ex. compte suggere depuis une
// rubrique de bilan importee, V1.34). `opts.onSaved` (optionnel) est appele
// avec la fiche enregistree {id,...} - meme convention que openTiersFormModal.
function openCompteFormModal(c, opts){
  opts = opts || {};
  var pre = (!c && opts.prefill) ? opts.prefill : null;
  var overlay = openModal({
    title: c ? 'Modifier le compte '+c.code : 'Nouveau compte',
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-code">Code</label><input id="cf-code" required value="'+esc(c?c.code||'':(pre?pre.code||'':''))+'"></div>'+
        '<div class="field"><label for="cf-libelle">Libellé</label><input id="cf-libelle" required value="'+esc(c?c.libelle||'':(pre?pre.libelle||'':''))+'"></div>'+
      '</div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="cf-classe">Classe</label><select id="cf-classe">'+
          CLASSES_COMPTABLES.map(function(cl){ return '<option value="'+cl.id+'"'+((c&&Number(c.classe)===cl.id)||(pre&&pre.classe&&Number(pre.classe)===cl.id)?' selected':'')+'>'+esc(cl.label)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label for="cf-sens">Sens normal</label><select id="cf-sens">'+
          '<option value="debiteur"'+((!c&&!pre)||c&&c.sens==='debiteur'||pre&&pre.sens==='debiteur'?' selected':'')+'>Débiteur</option>'+
          '<option value="crediteur"'+((c&&c.sens==='crediteur')||(pre&&pre.sens==='crediteur')?' selected':'')+'>Créditeur</option>'+
        '</select></div>'+
        '<div class="field" style="display:flex;align-items:flex-end;">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:9px;"><input type="checkbox" id="cf-actif" style="width:auto;" '+(c? (c.actif!==false?'checked':'') : 'checked')+'> Compte actif</label>'+
        '</div>'+
      '</div>'+
      '<div class="field"><label for="cf-note">Note (optionnel)</label><input id="cf-note" value="'+esc(c?c.note||'':'')+'"></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="cf-save">Enregistrer</button>'
  });
  overlay.querySelector('#cf-save').addEventListener('click', function(){
    var code = byId('cf-code').value.trim();
    var libelle = byId('cf-libelle').value.trim();
    if(!code || !libelle){ toast('Le code et le libellé sont obligatoires', 'danger'); return; }
    var doublon = findCompteDoublon(code, c?c.id:null);
    if(doublon){ toast('Ce code existe déjà : '+doublon.code+' — '+doublon.libelle, 'danger'); return; }
    var data = {
      code: code, libelle: libelle, classe: Number(byId('cf-classe').value),
      sens: byId('cf-sens').value, actif: byId('cf-actif').checked,
      note: byId('cf-note').value.trim()
    };
    saveCompte(data, c?c.id:null).then(function(res){
      var saved = Object.assign({id: c?c.id:(res&&res.id)}, data);
      if(opts.onSaved) opts.onSaved(saved);
      closeModal(); toast('Compte enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   COMPTABILITE - ECRITURES AUTOMATIQUES ET JOURNAL
   Chaque facture client validee, avoir valide, encaissement et facture
   fournisseur enregistres genere automatiquement une ecriture en partie
   double (debit = credit), tracee vers son document source. Les ecritures
   ne sont JAMAIS modifiees ni supprimees a posteriori (meme principe que le
   reste de l'application) : une annulation de document genere une
   contre-ecriture (lignes inversees), jamais une suppression.
   ========================================================= */
var COMPTES_AUTO = {
  clients:'3421', fournisseurs:'4411', tvaFacturee:'4455', tvaRecuperable:'3455',
  banque:'5141', caisse:'5161', ventesTravaux:'7121', achatsTravaux:'6125'
};
var JOURNAUX_COMPTABLES = [
  {id:'VE', label:'Ventes'},
  {id:'AC', label:'Achats'},
  {id:'BQ', label:'Banque'},
  {id:'CA', label:'Caisse'},
  {id:'OD', label:'Opérations diverses'},
  {id:'AN', label:'À Nouveaux'}
];
function journalLabel(id){ var j = JOURNAUX_COMPTABLES.find(function(x){ return x.id===id; }); return j? (j.id+' — '+j.label) : id; }

// Tolerance de 0.5 (unite monetaire) pour absorber les ecarts d'arrondi/OCR
// entre HT+TVA et TTC sur une facture fournisseur saisie manuellement.
function montantsCoherents(ht, tva, ttc){
  if(ht==null || tva==null || ttc==null || isNaN(ht) || isNaN(tva) || isNaN(ttc)) return false;
  return Math.abs((Number(ht)+Number(tva)) - Number(ttc)) <= 0.5;
}

// Garde anti-doublon : jamais plus d'une ecriture "originale" (non
// contre-ecriture) par document source. Les contre-ecritures (annulation)
// sont generees separement par genererContreEcritureSiExiste(). Interroge
// directement le serveur (pas STATE.ecritures, rafraichi par polling toutes
// les 2s - trop lent pour fiabiliser cette garde, ex. double-clic ou
// generation manuelle relancee juste apres la precedente).
function creerEcriture(payload){
  return fetch('/api/collection/ecritures').then(function(r){ return r.json(); }).then(function(rows){
    rows = rows || [];
    var dejaExistante = rows.some(function(e){
      if(e.sourceType!==payload.sourceType || e.sourceId!==payload.sourceId || e.contrePieceDe) return false;
      // Un "original" deja annule (une contre-ecriture le referencant existe
      // deja) ne bloque pas une nouvelle creation pour ce meme sourceId -
      // necessaire pour l'ecriture d'ouverture (V1.34), dont le sourceId est
      // volontairement fixe pour permettre une nouvelle saisie apres
      // annulation. Sans incidence sur les autres sourceType, dont le
      // sourceId (id du document source) n'est jamais reutilise.
      var dejaAnnulee = rows.some(function(x){ return x.contrePieceDe===e.id; });
      return !dejaAnnulee;
    });
    if(dejaExistante) return null;
    var data = Object.assign({createdAt: nowISO(), creePar: currentUserName(), genereeAuto: true}, payload);
    return STATE.db.collection('ecritures').add(data);
  });
}

function genererEcritureFacture(f){
  if(!f || !f.numero) return Promise.resolve(null);
  return creerEcriture({
    date: f.date || todayISO(), journal:'VE', piece: f.numero,
    libelle: 'Facture '+f.numero+' — '+(f.clientNom||''),
    lignes: [
      {compte: COMPTES_AUTO.clients, libelle: f.clientNom||'Client', debit: n2(f.ttc), credit: 0},
      {compte: COMPTES_AUTO.ventesTravaux, libelle: 'Travaux facturés', debit: 0, credit: n2(f.ht)},
      {compte: COMPTES_AUTO.tvaFacturee, libelle: 'TVA facturée', debit: 0, credit: n2(f.montantTVA)}
    ],
    sourceType:'facture', sourceId: f.id
  });
}

function genererEcritureAvoir(a, totals){
  if(!a || !a.numero) return Promise.resolve(null);
  return creerEcriture({
    date: a.date || todayISO(), journal:'VE', piece: a.numero,
    libelle: 'Avoir '+a.numero+' — '+(a.clientNom||''),
    lignes: [
      {compte: COMPTES_AUTO.ventesTravaux, libelle: 'Annulation travaux facturés', debit: n2(totals.ht), credit: 0},
      {compte: COMPTES_AUTO.tvaFacturee, libelle: 'Annulation TVA facturée', debit: n2(totals.tva), credit: 0},
      {compte: COMPTES_AUTO.clients, libelle: a.clientNom||'Client', debit: 0, credit: n2(totals.ttc)}
    ],
    sourceType:'avoir', sourceId: a.id
  });
}

function genererEcritureFactureFournisseur(f){
  if(!f || !montantsCoherents(f.montantHT, f.montantTVA, f.montantTTC)) return Promise.resolve(null);
  return creerEcriture({
    date: f.date || todayISO(), journal:'AC', piece: f.numero||'',
    libelle: 'Facture fournisseur '+(f.numero||'')+' — '+(f.fournisseurNom||''),
    lignes: [
      {compte: COMPTES_AUTO.achatsTravaux, libelle:'Achats / sous-traitance', debit: n2(f.montantHT), credit: 0},
      {compte: COMPTES_AUTO.tvaRecuperable, libelle:'TVA récupérable', debit: n2(f.montantTVA), credit: 0},
      {compte: COMPTES_AUTO.fournisseurs, libelle: f.fournisseurNom||'Fournisseur', debit: 0, credit: n2(f.montantTTC)}
    ],
    sourceType:'factureFournisseur', sourceId: f.id
  });
}

function genererEcritureEncaissement(r){
  if(!r || !r.numero || !r.montant) return Promise.resolve(null);
  var espece = r.mode==='espece';
  return creerEcriture({
    date: r.date || todayISO(), journal: espece?'CA':'BQ', piece: r.numero,
    libelle: 'Encaissement '+r.numero+' — '+(r.clientNom||''),
    lignes: [
      {compte: espece?COMPTES_AUTO.caisse:COMPTES_AUTO.banque, libelle: espece?'Caisse':'Banque', debit: n2(r.montant), credit: 0},
      {compte: COMPTES_AUTO.clients, libelle: r.clientNom||'Client', debit: 0, credit: n2(r.montant)}
    ],
    sourceType:'encaissement', sourceId: r.id
  });
}

// Reglement (paiement) d'une facture fournisseur (V1.33) - r : {id (propre
// au reglement, pas a la facture : plusieurs reglements partiels possibles
// sur une meme facture), numero (piece), fournisseurNom, date, montant, mode}
function genererEcritureReglementFournisseur(r){
  if(!r || !r.id || !r.montant) return Promise.resolve(null);
  var espece = r.mode==='espece';
  return creerEcriture({
    date: r.date || todayISO(), journal: espece?'CA':'BQ', piece: r.numero||'',
    libelle: 'Règlement fournisseur '+(r.numero||'')+' — '+(r.fournisseurNom||''),
    lignes: [
      {compte: COMPTES_AUTO.fournisseurs, libelle: r.fournisseurNom||'Fournisseur', debit: n2(r.montant), credit: 0},
      {compte: espece?COMPTES_AUTO.caisse:COMPTES_AUTO.banque, libelle: espece?'Caisse':'Banque', debit: 0, credit: n2(r.montant)}
    ],
    sourceType:'reglementFournisseur', sourceId: r.id
  });
}

// Annulation d'un document deja comptabilise (RG-004/005 : jamais de
// suppression physique) -> contre-ecriture (lignes debit/credit inversees),
// jamais une modification/suppression de l'ecriture d'origine.
function genererContreEcritureSiExiste(sourceType, sourceId){
  return fetch('/api/collection/ecritures').then(function(r){ return r.json(); }).then(function(rows){
    rows = rows || [];
    var orig = rows.find(function(e){ return e.sourceType===sourceType && e.sourceId===sourceId && !e.contrePieceDe; });
    if(!orig) return null;
    var dejaContree = rows.some(function(e){ return e.contrePieceDe===orig.id; });
    if(dejaContree) return null;
    var lignesInversees = (orig.lignes||[]).map(function(l){ return {compte:l.compte, libelle:l.libelle, debit:l.credit, credit:l.debit}; });
    return STATE.db.collection('ecritures').add({
      date: todayISO(), journal: orig.journal, piece: 'ANNUL-'+(orig.piece||''),
      libelle: 'Annulation — '+(orig.libelle||''),
      lignes: lignesInversees, sourceType: orig.sourceType, sourceId: orig.sourceId,
      contrePieceDe: orig.id, createdAt: nowISO(), creePar: currentUserName(), genereeAuto: true
    });
  });
}

// Factures fournisseurs sans ecriture generee (montants manquants ou
// incoherents a l'enregistrement) : signalees dans le Journal comptable,
// avec un bouton pour reessayer apres correction des montants.
function detecterFacturesFournisseursSansEcriture(){
  var idsAvecEcriture = {};
  STATE.ecritures.forEach(function(e){ if(e.sourceType==='factureFournisseur' && !e.contrePieceDe) idsAvecEcriture[e.sourceId]=true; });
  return STATE.facturesFournisseurs.filter(function(f){ return !idsAvecEcriture[f.id]; });
}

// Generation retroactive, a la demande (jamais automatique) : pour les
// documents deja valides/enregistres AVANT l'arrivee de ce module, qui
// n'ont donc jamais declenche la generation automatique.
function genererEcrituresManquantes(){
  var promesses = [];
  STATE.fac.filter(function(f){ return f.statut==='validee'; }).forEach(function(f){ promesses.push(genererEcritureFacture(f)); });
  STATE.avo.filter(function(a){ return a.statut==='validee'; }).forEach(function(a){
    var t = calcDocTotals(a.lignes, a.tauxTVA, 0);
    promesses.push(genererEcritureAvoir(a, t));
  });
  STATE.reg.filter(function(r){ return r.statut!=='annule'; }).forEach(function(r){ promesses.push(genererEcritureEncaissement(r)); });
  STATE.facturesFournisseurs.forEach(function(f){
    var nom = f.fournisseurNom || fournisseurNomById(f.fournisseurId);
    promesses.push(genererEcritureFactureFournisseur(Object.assign({}, f, {fournisseurNom: nom})));
  });
  return Promise.all(promesses).then(function(resultats){
    var nb = resultats.filter(function(r){ return r; }).length;
    return nb;
  });
}

var ecrituresFilter = {journal:'', debut:'', fin:''};
function renderEcritures(mount, actions){
  var canEdit = canWrite('ecritures');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-gen-manquantes">'+ic('refresh',15)+' Générer les écritures manquantes</button>';
    byId('btn-gen-manquantes').addEventListener('click', function(){
      var btn = byId('btn-gen-manquantes');
      btn.disabled = true;
      genererEcrituresManquantes().then(function(nb){
        toast(nb>0? (nb+' écriture(s) générée(s)') : 'Aucune écriture manquante à générer', 'success');
      }).catch(function(e){ console.error(e); toast('Erreur lors de la génération', 'danger'); }).then(function(){
        btn.disabled = false;
      });
    });
  }
  var list = STATE.ecritures.filter(function(e){
    if(ecrituresFilter.journal && e.journal!==ecrituresFilter.journal) return false;
    if(ecrituresFilter.debut && e.date < ecrituresFilter.debut) return false;
    if(ecrituresFilter.fin && e.date > ecrituresFilter.fin) return false;
    return true;
  }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||'') || (b.createdAt||'').localeCompare(a.createdAt||''); });

  var sansEcriture = detecterFacturesFournisseursSansEcriture();

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<select id="ec-journal"><option value="">Tous les journaux</option>'+JOURNAUX_COMPTABLES.map(function(j){ return '<option value="'+j.id+'"'+(ecrituresFilter.journal===j.id?' selected':'')+'>'+esc(journalLabel(j.id))+'</option>'; }).join('')+'</select>'+
      '<input type="date" id="ec-debut" value="'+esc(ecrituresFilter.debut)+'" title="Du">'+
      '<input type="date" id="ec-fin" value="'+esc(ecrituresFilter.fin)+'" title="Au">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' écriture(s)</span>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Écritures générées automatiquement à partir des factures clients validées, avoirs validés, encaissements et factures fournisseurs — lecture seule, jamais de saisie manuelle dans cette version.</p>';

  if(sansEcriture.length){
    body += doublonsBannerHtml(
      sansEcriture.length+' facture(s) fournisseur sans écriture (montants manquants ou incohérents : HT + TVA doit être égal à TTC)',
      sansEcriture.map(function(f){
        return '<li>'+esc(f.numero||'(sans numéro)')+' — '+esc(f.fournisseurNom||fournisseurNomById(f.fournisseurId))+' : corrigez les montants puis cliquez sur « Générer les écritures manquantes »</li>';
      }).join('')
    );
  }

  if(!STATE.ecritures.length){
    body += emptyState('journal', 'Aucune écriture comptable pour le moment.');
  } else if(!list.length){
    body += emptyState('search', 'Aucune écriture ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th>Comptes</th><th class="r">Débit</th><th class="r">Crédit</th></tr></thead><tbody>'+
      list.map(function(e){
        var totDebit = (e.lignes||[]).reduce(function(s,l){ return s+(Number(l.debit)||0); }, 0);
        var totCredit = (e.lignes||[]).reduce(function(s,l){ return s+(Number(l.credit)||0); }, 0);
        var lignesHtml = (e.lignes||[]).map(function(l){
          return '<div style="font-size:12px;">'+esc(compteLabel(l.compte))+' — '+(Number(l.debit)?('D '+fmtMoney2(l.debit)):('C '+fmtMoney2(l.credit)))+'</div>';
        }).join('');
        return '<tr>'+
          '<td class="muted">'+fmtDate(e.date)+'</td>'+
          '<td><span class="pill pill-neutral">'+esc(e.journal)+'</span>'+(e.contrePieceDe?' <span class="pill">Annulation</span>':'')+'</td>'+
          '<td class="num">'+esc(e.piece||'—')+'</td>'+
          '<td>'+esc(e.libelle||'')+'</td>'+
          '<td>'+lignesHtml+'</td>'+
          '<td class="r num">'+fmtMoney2(totDebit)+'</td>'+
          '<td class="r num">'+fmtMoney2(totCredit)+'</td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  byId('ec-journal').addEventListener('change', function(){ ecrituresFilter.journal = this.value; renderEcritures(mount, actions); });
  byId('ec-debut').addEventListener('change', function(){ ecrituresFilter.debut = this.value; renderEcritures(mount, actions); });
  byId('ec-fin').addEventListener('change', function(){ ecrituresFilter.fin = this.value; renderEcritures(mount, actions); });
}

/* =========================================================
   COMPTABILITE - ECRITURE D'OUVERTURE (V1.34)
   Report, en une seule fois, du solde de cloture de l'exercice precedent
   (arrete par le comptable/la fiduciaire) comme point de depart du suivi
   comptable dans l'application : import du bilan de cloture (PDF, Tableau
   n 1 CGNC "Modele simplifie" - voir backend/bilan_parser.py) -> ecran de
   revue avec correspondance vers un compte du plan comptable (creation a la
   volee si besoin, meme principe que les fournisseurs a l'import de
   factures) -> une seule ecriture, journal AN, necessairement equilibree
   (debit = credit) avant enregistrement. Comme toutes les ecritures de
   l'application, jamais modifiee ni supprimee ensuite : une correction se
   fait par annulation (contre-ecriture), puis nouvelle saisie.
   sourceType/sourceId fixes a 'ouverture'/'ouverture' : une seule ecriture
   d'ouverture active a la fois (le flux normal est de ne la saisir qu'une
   fois, au demarrage de ce module).
   ========================================================= */
function ecritureOuvertureExistante(){
  return STATE.ecritures.find(function(e){
    if(e.sourceType!=='ouverture' || e.contrePieceDe) return false;
    var dejaAnnulee = STATE.ecritures.some(function(x){ return x.contrePieceDe===e.id; });
    return !dejaAnnulee;
  });
}

// Mise a jour locale optimiste de STATE.planComptable juste apres la
// creation d'un compte depuis un select (ecriture d'ouverture) : necessaire
// car STATE.planComptable n'est rafraichi que par le polling (jusqu'a 2s de
// retard), et le select doit refleter le nouveau compte immediatement.
function ajouterCompteLocal(saved){
  if(!STATE.planComptable.some(function(c){ return c.id===saved.id; })){
    STATE.planComptable = STATE.planComptable.concat([saved]);
  }
}

// Ouvre le formulaire de creation de compte pre-rempli avec la suggestion
// (code/libelle/sens) issue de l'analyse du bilan pour une ligne donnee, et
// affecte automatiquement le compte nouvellement cree a cette ligne une fois
// enregistre. Partage par le select "+ Nouveau compte..." et par le lien
// "creer ce compte" affiche sous une rubrique sans compte existant.
function ouvrirCreationCompteSuggere(ligne){
  openCompteFormModal(null, {
    prefill: {code: ligne.compteSuggereCode, libelle: ligne.compteSuggereLibelle, sens: ligne.compteSuggereSens},
    onSaved: function(saved){ ajouterCompteLocal(saved); ligne.compte = saved.code; scheduleRender(); }
  });
}

function compteOptionsHtml(selectedCode){
  var opts = STATE.planComptable.slice().sort(function(a,b){ return (a.code||'').localeCompare(b.code||''); })
    .map(function(c){ return '<option value="'+esc(c.code)+'"'+(selectedCode===c.code?' selected':'')+'>'+esc(c.code+' — '+c.libelle)+'</option>'; }).join('');
  return '<option value=""'+(!selectedCode?' selected':'')+'>— Choisir un compte —</option>'+opts+'<option value="__new__">+ Nouveau compte…</option>';
}

var ouvertureEnCours = null; // {nomFichier, exerciceDebut, exerciceFin, date, lignes:[{id,garder,libelle,debit,credit,compte,compteSuggereCode,compteSuggereLibelle}]}
var ouvertureFileInputEl = null;

function getOuvertureFileInput(){
  if(ouvertureFileInputEl && document.body.contains(ouvertureFileInputEl)) return ouvertureFileInputEl;
  ouvertureFileInputEl = document.createElement('input');
  ouvertureFileInputEl.type = 'file';
  ouvertureFileInputEl.accept = '.pdf';
  ouvertureFileInputEl.hidden = true;
  ouvertureFileInputEl.id = 'ouverture-file-input';
  document.body.appendChild(ouvertureFileInputEl);
  ouvertureFileInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if(files.length) importBilanFile(files[0]);
  });
  return ouvertureFileInputEl;
}

// Date d'ouverture par defaut = lendemain de la date de cloture detectee
// dans le bilan (ex. cloture 31/12/2025 -> ouverture 01/01/2026), sinon la
// date du jour - reste de toute facon librement modifiable dans l'ecran.
function lendemainISO(dateFr){
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateFr||'');
  if(!m) return todayISO();
  var d = new Date(Date.UTC(Number(m[3]), Number(m[2])-1, Number(m[1])));
  d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}

function importBilanFile(file){
  toast('Analyse du bilan en cours…');
  var fd = new FormData();
  fd.append('file', file);
  fetch('/api/ouverture/parse-bilan', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    ouvertureEnCours = {
      nomFichier: res.nomFichier, exerciceDebut: res.exerciceDebut, exerciceFin: res.exerciceFin,
      date: lendemainISO(res.exerciceFin),
      chiffreAffaires: (typeof res.chiffreAffaires==='number')? res.chiffreAffaires : null,
      lignes: res.lignes.map(function(l){
        var isDebit = (l.sens==='debiteur') !== (l.montant<0);
        var montant = Math.abs(l.montant);
        var compteExiste = STATE.planComptable.some(function(c){ return c.code===l.compteSuggere; });
        return {
          id: uid(), garder: true, libelle: l.label,
          debit: isDebit? montant : 0, credit: isDebit? 0 : montant,
          compte: compteExiste? l.compteSuggere : '',
          compteSuggereCode: l.compteSuggere, compteSuggereLibelle: l.libelleSuggere, compteSuggereSens: l.sens
        };
      })
    };
    toast(ouvertureEnCours.lignes.length+' rubrique(s) détectée(s) — vérifiez la correspondance des comptes avant d’enregistrer.', 'success');
    scheduleRender();
  }).catch(function(err){ console.error(err); toast(err.message || 'Erreur d’analyse du bilan', 'danger'); });
}

function renderEcritureOuverture(mount, actions){
  var canEdit = canWrite('ecritureOuverture');
  var existante = ecritureOuvertureExistante();
  actions.innerHTML = '';

  var body = '<p class="hint" style="margin:-4px 0 12px;">Reporte le solde de clôture arrêté par votre comptable/fiduciaire (bilan de l’exercice précédent) comme point de départ du suivi comptable dans l’application, sous la forme d’une écriture unique, journal « AN » (À Nouveaux). Comme toutes les écritures de l’application, elle n’est jamais modifiée après coup : une correction se fait par annulation (contre-écriture) puis nouvelle saisie.</p>';

  if(existante && !ouvertureEnCours){
    var totD = n2((existante.lignes||[]).reduce(function(s,l){ return s+(Number(l.debit)||0); }, 0));
    body += '<div class="card card-pad">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">'+
        '<div><b>Écriture d’ouverture enregistrée</b><div class="muted" style="font-size:12.5px;margin-top:2px;">Datée du '+fmtDate(existante.date)+' — '+(existante.lignes||[]).length+' ligne(s), total '+fmtMoney2(totD)+(typeof existante.chiffreAffairesExerciceCloture==='number'? ' — Chiffre d’affaires de l’exercice clôturé (information, non comptabilisé) : '+fmtMoney2(existante.chiffreAffairesExerciceCloture) : '')+'</div></div>'+
        (canEdit? '<button type="button" class="btn" id="btn-annuler-ouverture">'+ic('trash',15)+' Annuler cette écriture</button>' : '')+
      '</div>'+
      '<div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>Compte</th><th class="r">Débit</th><th class="r">Crédit</th></tr></thead><tbody>'+
        (existante.lignes||[]).map(function(l){
          return '<tr><td>'+esc(compteLabel(l.compte))+'</td><td class="r num">'+(Number(l.debit)?fmtMoney2(l.debit):'')+'</td><td class="r num">'+(Number(l.credit)?fmtMoney2(l.credit):'')+'</td></tr>';
        }).join('')+
      '</tbody></table></div>'+
    '</div>';
    mount.innerHTML = body;
    var btnAnnuler = byId('btn-annuler-ouverture');
    if(btnAnnuler) btnAnnuler.addEventListener('click', function(){
      confirmDialog('Annuler l’écriture d’ouverture ? Une contre-écriture sera générée (elle reste visible dans le journal, jamais supprimée), et vous pourrez ensuite en saisir une nouvelle.', {danger:true, okLabel:'Annuler l’écriture'}).then(function(ok){
        if(!ok) return;
        genererContreEcritureSiExiste('ouverture', 'ouverture').then(function(){
          toast('Écriture d’ouverture annulée', 'success'); scheduleRender();
        }).catch(function(err){ console.error(err); toast('Erreur', 'danger'); });
      });
    });
    return;
  }

  if(!ouvertureEnCours){
    body += emptyState('upload', 'Aucune écriture d’ouverture pour le moment.',
      canEdit? '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">'+
        '<button type="button" class="btn btn-primary" id="btn-import-bilan">'+ic('upload',15)+' Importer un bilan de clôture (PDF)</button>'+
        '<button type="button" class="btn" id="btn-ouverture-manuelle">'+ic('pencil',15)+' Saisir manuellement</button>'+
      '</div>' : '');
    mount.innerHTML = body;
    var btnImp = byId('btn-import-bilan');
    if(btnImp) btnImp.addEventListener('click', function(){ getOuvertureFileInput().click(); });
    var btnManuel = byId('btn-ouverture-manuelle');
    if(btnManuel) btnManuel.addEventListener('click', function(){
      // Demarrage sans PDF : meme ecran de revue que l'import, vide au
      // depart - l'utilisateur ajoute ses lignes une a une via "Ajouter une
      // ligne manuelle" (deja utilise aujourd'hui pour COMPLETER un import,
      // reutilise ici pour construire l'ecriture dans son ensemble).
      ouvertureEnCours = {nomFichier:null, exerciceFin:null, date: todayISO(), chiffreAffaires:null, lignes:[]};
      scheduleRender();
    });
    return;
  }

  var en = ouvertureEnCours;
  var totDebit = 0, totCredit = 0;
  en.lignes.forEach(function(l){ if(l.garder){ totDebit += Number(l.debit)||0; totCredit += Number(l.credit)||0; } });
  totDebit = n2(totDebit); totCredit = n2(totCredit);
  var ecart = n2(totDebit - totCredit);
  var equilibre = Math.abs(ecart) < 0.01;
  var toutesLesLignesOntUnCompte = en.lignes.every(function(l){ return !l.garder || l.compte; });
  // Au moins une ligne conservee : sans ce garde-fou, un debut de saisie
  // manuelle (lignes encore vides) ou un import entierement decoche serait
  // "equilibre" par defaut (0 = 0) et activerait a tort le bouton Enregistrer.
  var auMoinsUneLigneGardee = en.lignes.some(function(l){ return l.garder; });

  body += '<div class="card card-pad" style="margin-bottom:12px;">'+
    '<p class="muted" style="font-size:12.5px;margin:0 0 10px;">'+(en.nomFichier? 'Analysé depuis : '+esc(en.nomFichier)+(en.exerciceFin? ' — exercice clôturé le '+esc(en.exerciceFin) : '') : 'Saisie manuelle — sans import de PDF.')+'</p>'+
    (typeof en.chiffreAffaires==='number'? '<p class="hint" style="margin:0 0 10px;">Chiffre d’affaires de l’exercice clôturé (lu sur le Compte de Produits et Charges du même PDF) : <b>'+fmtMoney2(en.chiffreAffaires)+'</b> — pour information uniquement, ce montant n’est pas comptabilisé dans l’écriture d’ouverture (les comptes de produits et charges repartent à zéro à chaque exercice).</p>' : '')+
    '<div class="field" style="max-width:220px;"><label for="ou-date">Date de l’écriture d’ouverture</label><input type="date" id="ou-date" value="'+esc(en.date)+'"></div>'+
  '</div>';

  body += '<div class="table-wrap"><table><thead><tr><th style="width:36px;"></th><th>Rubrique</th><th class="r">Débit</th><th class="r">Crédit</th><th>Compte</th><th></th></tr></thead><tbody>'+
    en.lignes.map(function(l, idx){
      var suggestionACreer = l.compteSuggereCode && !l.compte;
      return '<tr style="'+(l.garder?'':'opacity:.45;')+'">'+
        '<td><input type="checkbox" class="ou-garder" data-idx="'+idx+'" '+(l.garder?'checked':'')+' style="width:auto;"></td>'+
        '<td>'+esc(l.libelle)+(suggestionACreer? '<div class="hint" style="margin-top:2px;">Suggestion : '+esc(l.compteSuggereCode)+' — '+esc(l.compteSuggereLibelle)+' — <a href="#" class="ou-creer-suggestion" data-idx="'+idx+'">créer ce compte</a></div>' : '')+'</td>'+
        '<td class="r num">'+(l.debit?fmtMoney2(l.debit):'')+'</td>'+
        '<td class="r num">'+(l.credit?fmtMoney2(l.credit):'')+'</td>'+
        '<td><select class="ou-compte" data-idx="'+idx+'" style="min-width:180px;'+(l.garder&&!l.compte?'border-color:var(--danger);':'')+'">'+compteOptionsHtml(l.compte)+'</select></td>'+
        '<td><button type="button" class="iconbtn" data-del-ligne="'+idx+'" title="Retirer">'+ic('trash',15)+'</button></td>'+
      '</tr>';
    }).join('')+
  '</tbody></table></div>';

  body += '<div style="display:flex;justify-content:flex-end;gap:24px;margin:14px 0;font-size:13.5px;">'+
    '<div>Total débit : <b>'+fmtMoney2(totDebit)+'</b></div>'+
    '<div>Total crédit : <b>'+fmtMoney2(totCredit)+'</b></div>'+
    '<div style="font-weight:600;color:'+((equilibre&&auMoinsUneLigneGardee)?'var(--success)':'var(--danger)')+';">'+(!auMoinsUneLigneGardee? 'Ajoutez au moins une ligne' : (equilibre? 'Équilibré' : 'Écart : '+fmtMoney2(ecart)))+'</div>'+
  '</div>';

  body += '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
    '<button type="button" class="btn" id="ou-ajouter-ligne">'+ic('plus',15)+' Ajouter une ligne manuelle</button>'+
    '<div style="display:flex;gap:10px;">'+
      '<button type="button" class="btn" id="ou-annuler-import">'+(en.nomFichier? 'Annuler l’import' : 'Abandonner la saisie')+'</button>'+
      '<button type="button" class="btn btn-primary" id="ou-save" '+((!equilibre||!toutesLesLignesOntUnCompte||!auMoinsUneLigneGardee)?'disabled':'')+'>'+ic('check',15)+' Enregistrer l’écriture d’ouverture</button>'+
    '</div>'+
  '</div>';

  mount.innerHTML = body;

  byId('ou-date').addEventListener('change', function(){ en.date = this.value || todayISO(); });

  mount.querySelectorAll('.ou-garder').forEach(function(cb){
    cb.addEventListener('change', function(){
      en.lignes[Number(cb.getAttribute('data-idx'))].garder = cb.checked;
      scheduleRender();
    });
  });
  mount.querySelectorAll('[data-del-ligne]').forEach(function(b){
    b.addEventListener('click', function(){
      en.lignes.splice(Number(b.getAttribute('data-del-ligne')), 1);
      scheduleRender();
    });
  });
  mount.querySelectorAll('.ou-compte').forEach(function(sel){
    sel.addEventListener('change', function(){
      var idx = Number(sel.getAttribute('data-idx'));
      var ligne = en.lignes[idx];
      if(sel.value==='__new__'){
        ouvrirCreationCompteSuggere(ligne);
        sel.value = ligne.compte||'';
        return;
      }
      ligne.compte = sel.value||'';
      scheduleRender();
    });
  });
  mount.querySelectorAll('.ou-creer-suggestion').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      ouvrirCreationCompteSuggere(en.lignes[Number(a.getAttribute('data-idx'))]);
    });
  });
  byId('ou-ajouter-ligne').addEventListener('click', function(){
    openOuvertureLigneManuelleModal(function(ligne){
      en.lignes.push(ligne); scheduleRender();
    });
  });
  byId('ou-annuler-import').addEventListener('click', function(){
    confirmDialog((en.nomFichier? 'Abandonner cet import ?' : 'Abandonner cette saisie manuelle ?')+' Rien n’a encore été enregistré.', {okLabel:'Abandonner'}).then(function(ok){
      if(!ok) return;
      ouvertureEnCours = null; scheduleRender();
    });
  });
  var saveBtn = byId('ou-save');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    if(!equilibre || !toutesLesLignesOntUnCompte || !auMoinsUneLigneGardee) return;
    // Regroupe par compte (somme) au cas ou plusieurs rubriques du bilan
    // auraient ete associees au meme compte - evite des lignes dupliquees
    // inutiles dans l'ecriture generee.
    var parCompte = {};
    en.lignes.filter(function(l){ return l.garder; }).forEach(function(l){
      var k = l.compte;
      if(!parCompte[k]) parCompte[k] = {compte:k, libelle: compteLabel(k), debit:0, credit:0};
      parCompte[k].debit += Number(l.debit)||0;
      parCompte[k].credit += Number(l.credit)||0;
    });
    var lignesFinales = Object.keys(parCompte).map(function(k){
      var l = parCompte[k];
      return {compte:l.compte, libelle:l.libelle, debit:n2(l.debit), credit:n2(l.credit)};
    });
    saveBtn.disabled = true;
    creerEcriture({
      date: en.date || todayISO(), journal:'AN', piece: 'OUVERTURE',
      libelle: 'Écriture d’ouverture', lignes: lignesFinales,
      sourceType:'ouverture', sourceId:'ouverture',
      // Champ purement informatif (pas une ligne de debit/credit) : permet
      // de retrouver le chiffre d'affaires de l'exercice cloture sur
      // l'ecran recapitulatif, meme apres la fermeture de l'ecran d'import.
      chiffreAffairesExerciceCloture: (typeof en.chiffreAffaires==='number')? en.chiffreAffaires : null
    }).then(function(res){
      if(!res){ toast('Une écriture d’ouverture existe déjà.', 'danger'); saveBtn.disabled=false; return; }
      ouvertureEnCours = null;
      toast('Écriture d’ouverture enregistrée', 'success');
      scheduleRender();
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); saveBtn.disabled=false; });
  });
}

function openOuvertureLigneManuelleModal(onAdded){
  var overlay = openModal({
    title: 'Ajouter une ligne manuelle',
    body:
      '<div class="field"><label for="om-libelle">Libellé</label><input id="om-libelle" placeholder="ex. Stock de marchandises"></div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="om-debit">Débit</label><input type="number" step="any" id="om-debit" value="0"></div>'+
        '<div class="field"><label for="om-credit">Crédit</label><input type="number" step="any" id="om-credit" value="0"></div>'+
        '<div class="field"><label for="om-compte">Compte</label><select id="om-compte">'+compteOptionsHtml('')+'</select></div>'+
      '</div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="om-save">Ajouter</button>'
  });
  overlay.querySelector('#om-compte').addEventListener('change', function(){
    if(this.value==='__new__'){
      var sel = this;
      openCompteFormModal(null, {onSaved: function(saved){ ajouterCompteLocal(saved); sel.innerHTML = compteOptionsHtml(saved.code); }});
      sel.value = '';
    }
  });
  overlay.querySelector('#om-save').addEventListener('click', function(){
    var libelle = byId('om-libelle').value.trim();
    var debit = Number(byId('om-debit').value)||0;
    var credit = Number(byId('om-credit').value)||0;
    var compte = byId('om-compte').value;
    if(!libelle || (!debit && !credit) || !compte || compte==='__new__'){
      toast('Libellé, compte et un montant (débit ou crédit) sont obligatoires', 'danger'); return;
    }
    closeModal();
    onAdded({id: uid(), garder:true, libelle: libelle, debit: n2(debit), credit: n2(credit), compte: compte});
  });
}

/* =========================================================
   EXERCICES ARCHIVES (V1.37) : import un a un des bilans
   d'exercices anterieurs (PDF, meme format CGNC et meme route
   /api/ouverture/parse-bilan que l'ecriture d'ouverture), pour
   constituer une archive consultable et un suivi comparatif
   pluriannuel (chiffre d'affaires, resultat net, total du bilan,
   tresorerie). Purement informatif : contrairement a l'ecriture
   d'ouverture, ceci ne genere jamais d'ecriture comptable - la
   suppression d'un exercice archive est donc directe (pas de
   contre-ecriture, ce n'est pas un document comptable officiel).
   ========================================================= */
var archiveEnCours = null; // {nomFichier, exerciceDebut, exerciceFin, lignes, chiffreAffaires, chiffreAffairesExercicePrecedent}
var archiveFileInputEl = null;

function getArchiveFileInput(){
  if(archiveFileInputEl && document.body.contains(archiveFileInputEl)) return archiveFileInputEl;
  archiveFileInputEl = document.createElement('input');
  archiveFileInputEl.type = 'file';
  archiveFileInputEl.accept = '.pdf';
  archiveFileInputEl.hidden = true;
  archiveFileInputEl.id = 'archive-file-input';
  document.body.appendChild(archiveFileInputEl);
  archiveFileInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if(files.length) importBilanArchive(files[0]);
  });
  return archiveFileInputEl;
}

function importBilanArchive(file){
  toast('Analyse du bilan en cours…');
  var fd = new FormData();
  fd.append('file', file);
  fetch('/api/ouverture/parse-bilan', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    archiveEnCours = {
      nomFichier: res.nomFichier, exerciceDebut: res.exerciceDebut, exerciceFin: res.exerciceFin,
      lignes: res.lignes||[],
      chiffreAffaires: (typeof res.chiffreAffaires==='number')? res.chiffreAffaires : null,
      chiffreAffairesExercicePrecedent: (typeof res.chiffreAffairesExercicePrecedent==='number')? res.chiffreAffairesExercicePrecedent : null
    };
    toast('Bilan analysé — vérifiez avant d’archiver.', 'success');
    scheduleRender();
  }).catch(function(err){ console.error(err); toast(err.message || 'Erreur d’analyse du bilan', 'danger'); });
}

// Retrouve le montant d'une rubrique du bilan par son libelle exact (tel
// qu'extrait par bilan_parser.py), 0 si absente - utilise pour calculer les
// indicateurs de synthese du tableau comparatif.
function rubriqueMontant(lignes, label){
  var l = (lignes||[]).find(function(x){ return x.label===label; });
  return l ? (Number(l.montant)||0) : 0;
}
// Total du bilan (= total actif = total passif, par construction d'un
// bilan equilibre) : somme signee des rubriques actif - volontairement pas
// de valeur absolue, pour rester coherent avec le signe d'un eventuel
// montant negatif (ex. debiteurs divers negatifs), meme si rare en pratique.
function totalBilanMontant(lignes){
  return n2((lignes||[]).filter(function(l){ return l.cote==='actif'; }).reduce(function(s,l){ return s+(Number(l.montant)||0); }, 0));
}
function tresorerieMontant(lignes){
  return n2(
    rubriqueMontant(lignes, 'Banque, T.G et C.C.P.') +
    rubriqueMontant(lignes, 'Caisses, régies d\'avances et accréditifs') +
    rubriqueMontant(lignes, 'Chèques et valeurs à encaisser')
  );
}
function resultatNetMontant(lignes){
  return rubriqueMontant(lignes, 'Résultat net de l\'exercice');
}

// Date ISO approximative pour trier les exercices archives par date de
// cloture (exerciceFin est au format texte francais DD/MM/YYYY tel que lu
// dans le PDF - jamais utilise pour un calcul, seulement pour le tri et
// l'affichage).
function exerciceFinTri(a){
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(a.exerciceFin||'');
  return m ? (m[3]+m[2]+m[1]) : '00000000';
}

function sauvegarderArchiveExercice(btn){
  var en = archiveEnCours;
  if(!en) return;
  btn.disabled = true;
  fetch('/api/collection/exercicesArchives').then(function(r){ return r.json(); }).then(function(rows){
    rows = rows || [];
    var doublon = en.exerciceFin && rows.some(function(r){ return r.exerciceFin===en.exerciceFin; });
    if(doublon){
      toast('Un exercice clôturé le '+en.exerciceFin+' est déjà archivé — supprimez-le dans la liste si vous voulez le remplacer.', 'danger');
      btn.disabled = false;
      return;
    }
    var data = {
      nomFichier: en.nomFichier, exerciceDebut: en.exerciceDebut, exerciceFin: en.exerciceFin,
      lignes: en.lignes, chiffreAffaires: en.chiffreAffaires, chiffreAffairesExercicePrecedent: en.chiffreAffairesExercicePrecedent,
      createdAt: nowISO(), creePar: currentUserName()
    };
    STATE.db.collection('exercicesArchives').add(data).then(function(){
      archiveEnCours = null;
      toast('Exercice archivé', 'success');
      scheduleRender();
    }).catch(function(err){ console.error(err); toast('Erreur à l’enregistrement', 'danger'); btn.disabled=false; });
  }).catch(function(err){ console.error(err); toast('Erreur', 'danger'); btn.disabled=false; });
}

// Deduit la rubrique de bilan (libelle + cote actif/passif) d'un compte du
// plan comptable, pour la saisie manuelle (V1.43 bis) : priorite a la table
// de correspondance CGNC (RUBRIQUES_BILAN_CGNC, definie plus bas dans ce
// fichier - un compte standard y a toujours une entree precise, y compris
// les cas particuliers comme les banques a solde crediteur, 5541, classees
// en passif) ; repli sur le sens normal du compte (debiteur -> actif,
// crediteur -> passif) et son libelle propre pour un compte non standard
// (ex. un compte cree par l'utilisateur, hors de cette liste de 35 postes).
function compteVersRubriqueBilan(code){
  var r = RUBRIQUES_BILAN_CGNC.find(function(x){ return x[3]===code; });
  if(r) return {label: r[0], cote: r[1]};
  var c = STATE.planComptable.find(function(p){ return p.code===code; });
  return {label: c? c.libelle : code, cote: (c&&c.sens==='crediteur')? 'passif' : 'actif'};
}

// Comptes de bilan (classes 1 a 5 uniquement, comme un vrai bilan - les
// comptes de charges/produits classes 6/7 n'y figurent jamais), pour le
// selecteur de la saisie manuelle d'un exercice archive ou d'une ecriture
// d'ouverture. 'exclure' retire les comptes deja utilises dans la saisie en
// cours (un meme compte ne peut apparaitre qu'une fois dans un bilan).
function compteOptionsBilanHtml(selectedCode, exclure){
  var opts = STATE.planComptable.filter(function(c){
    var cl = Number(c.classe);
    return cl>=1 && cl<=5 && (exclure||[]).indexOf(c.code)===-1;
  }).slice().sort(function(a,b){ return (a.code||'').localeCompare(b.code||''); })
    .map(function(c){ return '<option value="'+esc(c.code)+'"'+(selectedCode===c.code?' selected':'')+'>'+esc(c.code+' — '+c.libelle)+'</option>'; }).join('');
  return '<option value=""'+(!selectedCode?' selected':'')+'>— Choisir un compte —</option>'+opts;
}

function frDateToISO(fr){
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr||'');
  return m? (m[3]+'-'+m[2]+'-'+m[1]) : '';
}
function isoDateToFr(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  return m? (m[3]+'/'+m[2]+'/'+m[1]) : '';
}

function openArchiveLigneManuelleModal(en, onAdded){
  var dejaUtilises = en.lignes.map(function(l){ return l.compte; }).filter(Boolean);
  var overlay = openModal({
    title: 'Ajouter un compte',
    body:
      '<div class="field"><label for="am-compte">Compte (classes 1 à 5 uniquement, comme un bilan)</label><select id="am-compte">'+compteOptionsBilanHtml('', dejaUtilises)+'</select></div>'+
      '<div class="field"><label for="am-montant">Montant (solde de ce compte, toujours positif)</label><input type="number" step="any" min="0" id="am-montant"></div>'+
      '<p class="hint" id="am-apercu" style="margin-top:4px;min-height:16px;"></p>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="am-save">Ajouter</button>'
  });
  function majApercu(){
    var code = overlay.querySelector('#am-compte').value;
    var apercu = overlay.querySelector('#am-apercu');
    if(!code){ apercu.textContent=''; return; }
    var r = compteVersRubriqueBilan(code);
    apercu.textContent = 'Rubrique du bilan : '+r.label+' ('+(r.cote==='actif'?'Actif':'Passif')+')';
  }
  overlay.querySelector('#am-compte').addEventListener('change', majApercu);
  overlay.querySelector('#am-save').addEventListener('click', function(){
    var code = overlay.querySelector('#am-compte').value;
    var montant = Number(overlay.querySelector('#am-montant').value);
    if(!code){ toast('Choisissez un compte', 'danger'); return; }
    if(!montant || montant<=0){ toast('Indiquez un montant positif', 'danger'); return; }
    var r = compteVersRubriqueBilan(code);
    closeModal();
    onAdded({compte: code, label: r.label, cote: r.cote, montant: n2(montant)});
  });
}

function demarrerArchiveManuelle(){
  archiveEnCours = {manuel:true, nomFichier:null, exerciceDebut:'', exerciceFin:'', chiffreAffaires:null, chiffreAffairesExercicePrecedent:null, lignes:[]};
  scheduleRender();
}

function renderExercicesArchives(mount, actions){
  var canEdit = canWrite('exercicesArchives');
  actions.innerHTML = '';

  var body = '<p class="hint" style="margin:-4px 0 12px;">Archive, à titre de référence, les bilans de vos exercices antérieurs — importés en PDF ou saisis compte par compte quand le PDF n’est pas disponible — pour les consulter et les comparer au fil des années. Purement informatif : aucune écriture comptable n’est générée ici.</p>';

  if(archiveEnCours){
    var en = archiveEnCours;

    if(en.manuel){
      var totalBilanM = totalBilanMontant(en.lignes);
      var resultatNetM = resultatNetMontant(en.lignes);
      var tresorerieM = tresorerieMontant(en.lignes);
      body += '<div class="card card-pad" style="margin-bottom:12px;">'+
        '<p class="muted" style="font-size:12.5px;margin:0 0 10px;">Saisie manuelle — sans import de PDF.</p>'+
        '<div class="field-row grid-3">'+
          '<div class="field"><label for="am-debut">Début de l’exercice</label><input type="date" id="am-debut" value="'+esc(frDateToISO(en.exerciceDebut))+'"></div>'+
          '<div class="field"><label for="am-fin">Fin de l’exercice (clôture)</label><input type="date" id="am-fin" value="'+esc(frDateToISO(en.exerciceFin))+'"></div>'+
          '<div class="field"><label for="am-ca">Chiffre d’affaires (optionnel)</label><input type="number" step="any" id="am-ca" value="'+(typeof en.chiffreAffaires==='number'?en.chiffreAffaires:'')+'"></div>'+
        '</div>'+
      '</div>';
      body += '<div class="table-wrap"><table><thead><tr><th>Compte</th><th>Rubrique du bilan</th><th>Côté</th><th class="r">Montant</th><th></th></tr></thead><tbody>'+
        (en.lignes.length? en.lignes.map(function(l, idx){
          return '<tr><td class="num">'+esc(l.compte||'')+'</td><td>'+esc(l.label)+'</td><td class="muted">'+(l.cote==='actif'?'Actif':'Passif')+'</td><td class="r num">'+fmtMoney2(l.montant)+'</td>'+
            '<td><button type="button" class="iconbtn" data-del-ligne-archive="'+idx+'" title="Retirer">'+ic('trash',15)+'</button></td></tr>';
        }).join('') : '<tr><td colspan="5" class="muted" style="text-align:center;padding:16px;">Aucun compte ajouté pour le moment.</td></tr>')+
      '</tbody></table></div>';
      if(en.lignes.length){
        body += '<div style="display:flex;gap:28px;flex-wrap:wrap;font-size:13.5px;margin-top:14px;">'+
          '<div>Résultat net (déduit des comptes saisis) : <b style="color:'+(resultatNetM<0?'var(--danger)':'var(--success)')+';">'+fmtMoney2(resultatNetM)+'</b></div>'+
          '<div>Total du bilan (actif saisi) : <b>'+fmtMoney2(totalBilanM)+'</b></div>'+
          '<div>Trésorerie : <b>'+fmtMoney2(tresorerieM)+'</b></div>'+
        '</div>';
      }
      body += '<div style="display:flex;justify-content:space-between;gap:12px;margin-top:14px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="am-ajouter-ligne">'+ic('plus',15)+' Ajouter un compte</button>'+
        '<div style="display:flex;gap:10px;">'+
          '<button type="button" class="btn" id="arc-annuler">Abandonner</button>'+
          '<button type="button" class="btn btn-primary" id="arc-save" '+((!en.exerciceFin||!en.lignes.length)?'disabled':'')+'>'+ic('check',15)+' Archiver cet exercice</button>'+
        '</div>'+
      '</div>';
      if(!en.exerciceFin) body += '<p class="hint" style="margin-top:8px;">La date de fin d’exercice est obligatoire (utilisée pour trier et comparer les exercices).</p>';

      mount.innerHTML = body;
      byId('am-debut').addEventListener('change', function(){ en.exerciceDebut = isoDateToFr(this.value); scheduleRender(); });
      byId('am-fin').addEventListener('change', function(){ en.exerciceFin = isoDateToFr(this.value); scheduleRender(); });
      byId('am-ca').addEventListener('change', function(){ var v = this.value.trim(); en.chiffreAffaires = v? Number(v) : null; });
      byId('am-ajouter-ligne').addEventListener('click', function(){
        openArchiveLigneManuelleModal(en, function(ligne){ en.lignes.push(ligne); scheduleRender(); });
      });
      mount.querySelectorAll('[data-del-ligne-archive]').forEach(function(b){
        b.addEventListener('click', function(){
          en.lignes.splice(Number(b.getAttribute('data-del-ligne-archive')), 1);
          scheduleRender();
        });
      });
      byId('arc-annuler').addEventListener('click', function(){
        confirmDialog('Abandonner cette saisie manuelle ? Rien n’a encore été archivé.', {okLabel:'Abandonner'}).then(function(ok){
          if(!ok) return;
          archiveEnCours = null; scheduleRender();
        });
      });
      var saveBtnM = byId('arc-save');
      if(saveBtnM) saveBtnM.addEventListener('click', function(){
        if(!en.exerciceFin || !en.lignes.length) return;
        sauvegarderArchiveExercice(saveBtnM);
      });
      return;
    }

    var totalBilan = totalBilanMontant(en.lignes);
    var resultatNet = resultatNetMontant(en.lignes);
    var tresorerie = tresorerieMontant(en.lignes);
    body += '<div class="card card-pad" style="margin-bottom:12px;">'+
      '<p class="muted" style="font-size:12.5px;margin:0 0 10px;">Analysé depuis : '+esc(en.nomFichier)+(en.exerciceDebut&&en.exerciceFin? ' — exercice du '+esc(en.exerciceDebut)+' au '+esc(en.exerciceFin) : '')+'</p>'+
      '<div style="display:flex;gap:28px;flex-wrap:wrap;font-size:13.5px;">'+
        '<div>Chiffre d’affaires : <b>'+(typeof en.chiffreAffaires==='number'? fmtMoney2(en.chiffreAffaires) : '—')+'</b></div>'+
        '<div>Résultat net : <b style="color:'+(resultatNet<0?'var(--danger)':'var(--success)')+';">'+fmtMoney2(resultatNet)+'</b></div>'+
        '<div>Total du bilan : <b>'+fmtMoney2(totalBilan)+'</b></div>'+
        '<div>Trésorerie (banque + caisse) : <b>'+fmtMoney2(tresorerie)+'</b></div>'+
      '</div>'+
    '</div>';
    body += '<div class="table-wrap"><table><thead><tr><th>Rubrique</th><th>Côté</th><th class="r">Montant</th></tr></thead><tbody>'+
      en.lignes.map(function(l){
        return '<tr><td>'+esc(l.label)+'</td><td class="muted">'+(l.cote==='actif'?'Actif':'Passif')+'</td><td class="r num">'+fmtMoney2(l.montant)+'</td></tr>';
      }).join('')+
    '</tbody></table></div>';
    body += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">'+
      '<button type="button" class="btn" id="arc-annuler">Annuler</button>'+
      '<button type="button" class="btn btn-primary" id="arc-save">'+ic('check',15)+' Archiver cet exercice</button>'+
    '</div>';
    mount.innerHTML = body;
    byId('arc-annuler').addEventListener('click', function(){
      confirmDialog('Abandonner cet import ? Rien n’a encore été archivé.', {okLabel:'Abandonner'}).then(function(ok){
        if(!ok) return;
        archiveEnCours = null; scheduleRender();
      });
    });
    byId('arc-save').addEventListener('click', function(){ sauvegarderArchiveExercice(byId('arc-save')); });
    return;
  }

  var liste = STATE.exercicesArchives.slice().sort(function(a,b){ return exerciceFinTri(a).localeCompare(exerciceFinTri(b)); });

  if(canEdit && liste.length){
    actions.innerHTML = '<div style="display:flex;gap:10px;">'+
      '<button type="button" class="btn" id="btn-archive-manuelle">'+ic('pencil',15)+' Saisir manuellement</button>'+
      '<button type="button" class="btn btn-primary" id="btn-import-archive">'+ic('upload',15)+' Importer un exercice (PDF)</button>'+
    '</div>';
  }

  if(!liste.length){
    body += emptyState('layers', 'Aucun exercice archivé pour le moment.',
      canEdit? '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">'+
        '<button type="button" class="btn btn-primary" id="btn-import-archive-empty">'+ic('upload',15)+' Importer un exercice (PDF)</button>'+
        '<button type="button" class="btn" id="btn-archive-manuelle-empty">'+ic('pencil',15)+' Saisir manuellement</button>'+
      '</div>' : '');
    mount.innerHTML = body;
  } else {
    body += '<div class="table-wrap"><table><thead><tr>'+
      '<th style="width:30px;"></th><th>Exercice</th><th class="r">Chiffre d’affaires</th><th class="r">Évolution CA</th><th class="r">Résultat net</th><th class="r">Total du bilan</th><th class="r">Trésorerie</th><th></th>'+
    '</tr></thead><tbody>'+
      liste.map(function(a, idx){
        var ca = (typeof a.chiffreAffaires==='number')? a.chiffreAffaires : null;
        var prev = idx>0 ? liste[idx-1] : null;
        var prevCa = prev && (typeof prev.chiffreAffaires==='number') ? prev.chiffreAffaires : null;
        var evo = (ca!==null && prevCa!==null) ? n2(ca-prevCa) : null;
        var rn = resultatNetMontant(a.lignes);
        var detail = '<tr id="arch-detail-'+a.id+'" hidden><td></td><td colspan="7" style="padding:0 0 16px;">'+
          (a.lignes&&a.lignes.length?
            '<div class="table-wrap" style="margin-top:4px;"><table><thead><tr><th>Rubrique</th><th>Côté</th><th class="r">Montant</th></tr></thead><tbody>'+
              a.lignes.map(function(l){ return '<tr><td>'+esc(l.label)+'</td><td class="muted">'+(l.cote==='actif'?'Actif':'Passif')+'</td><td class="r num">'+fmtMoney2(l.montant)+'</td></tr>'; }).join('')+
            '</tbody></table></div>'
            : '<p class="hint" style="margin-top:4px;">Aucun détail disponible.</p>')+
        '</td></tr>';
        return '<tr>'+
          '<td><button type="button" class="iconbtn" data-toggle-archive="'+a.id+'" title="Voir le détail">'+ic('chevron',12)+'</button></td>'+
          '<td>'+esc(a.exerciceDebut||'')+' — '+esc(a.exerciceFin||'')+'</td>'+
          '<td class="r num">'+(ca!==null? fmtMoney2(ca) : '—')+'</td>'+
          '<td class="r num" style="'+(evo===null?'':'color:'+(evo<0?'var(--danger)':'var(--success)')+';')+'">'+(evo===null? '—' : (evo>=0?'+':'')+fmtMoney2(evo))+'</td>'+
          '<td class="r num" style="color:'+(rn<0?'var(--danger)':'var(--success)')+';">'+fmtMoney2(rn)+'</td>'+
          '<td class="r num">'+fmtMoney2(totalBilanMontant(a.lignes))+'</td>'+
          '<td class="r num">'+fmtMoney2(tresorerieMontant(a.lignes))+'</td>'+
          '<td>'+(canEdit? '<button type="button" class="iconbtn" data-del-archive="'+a.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '')+'</td>'+
        '</tr>'+detail;
      }).join('')+
    '</tbody></table></div>';
    mount.innerHTML = body;
    mount.querySelectorAll('[data-toggle-archive]').forEach(function(b){
      b.addEventListener('click', function(){
        var row = byId('arch-detail-'+b.getAttribute('data-toggle-archive'));
        if(row) row.hidden = !row.hidden;
      });
    });
    mount.querySelectorAll('[data-del-archive]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-del-archive');
        confirmDialog('Supprimer cet exercice archivé ? Il ne s’agit que d’une archive de référence (aucune écriture comptable associée) — cette suppression est directe et définitive.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
          if(!ok) return;
          deleteDoc('exercicesArchives', id).then(function(){ toast('Exercice archivé supprimé', 'success'); }).catch(function(err){ console.error(err); toast('Erreur', 'danger'); });
        });
      });
    });
  }

  var btnImp = byId('btn-import-archive');
  var btnImpEmpty = byId('btn-import-archive-empty');
  var btnManuel = byId('btn-archive-manuelle');
  var btnManuelEmpty = byId('btn-archive-manuelle-empty');
  if(btnImp) btnImp.addEventListener('click', function(){ getArchiveFileInput().click(); });
  if(btnImpEmpty) btnImpEmpty.addEventListener('click', function(){ getArchiveFileInput().click(); });
  if(btnManuel) btnManuel.addEventListener('click', demarrerArchiveManuelle);
  if(btnManuelEmpty) btnManuelEmpty.addEventListener('click', demarrerArchiveManuelle);
}

/* =========================================================
   CONTROLE DE GESTION (V1.43) : comparatif des bilans (exercices
   archives + situation courante reconstruite en direct) et indicateurs
   de pilotage.

   Origine : demande explicite « merci d ajouter un comparatif comptable
   entre les differents bilan ainsi que la situation courant Ajouter des
   indicateurs de controle de gestion ». Trois choix clarifies avec
   l'utilisateur avant implementation (AskUserQuestion) : (1) la
   "situation courante" est un BILAN RECONSTRUIT EN DIRECT a partir des
   soldes actuels du plan comptable (classes 1 a 5), dans la meme
   structure que les bilans archives importes - pas de simples chiffres
   isoles ; (2) indicateurs retenus : tresorerie/CA cumule/resultat net
   estime, et marge brute + taux de marge (ni delais de paiement, ni
   ratios de structure financiere) ; (3) nouvel ecran dedie "Controle de
   gestion", distinct de l'ecran "Tableau de bord" deja existant (qui est
   une vue commerciale/operationnelle, sans rapport avec cette demande).

   ========================================================= */

// Reprend EXACTEMENT la meme table de correspondance rubrique <-> compte
// CGNC que backend/bilan_parser.py (LABELS) - doit rester synchronisee
// avec ce fichier si de nouvelles rubriques y sont ajoutees. Dupliquee
// ici plutot que reexposee par une route dediee : coherent avec
// l'architecture existante du module comptabilite, ou tous les calculs
// (soldes, journal, indicateurs des exercices archives...) sont deja
// effectues cote client a partir des collections generiques synchronisees
// (STATE.ecritures, STATE.planComptable), jamais recalcules cote serveur.
var RUBRIQUES_BILAN_CGNC = [
  ["IMMOBILISATIONS EN NON VALEURS","actif","debiteur","2111"],
  ["Fonds commercial","actif","debiteur","2230"],
  ["Immobilisations incorporelles diverses","actif","debiteur","2280"],
  ["Terrains","actif","debiteur","2311"],
  ["Constructions","actif","debiteur","2321"],
  ["Installations techniques, matériel et outillage","actif","debiteur","2332"],
  ["Matériel de transport","actif","debiteur","2340"],
  ["Immobilisations corporelles diverses","actif","debiteur","2380"],
  ["IMMOBILISATIONS FINANCIERES","actif","debiteur","2510"],
  ["Marchandises","actif","debiteur","3111"],
  ["Stocks divers","actif","debiteur","3118"],
  ["Clients et comptes rattachés","actif","debiteur","3421"],
  ["Comptes d'associés","actif","debiteur","3461"],
  ["Débiteurs divers","actif","debiteur","3488"],
  ["Comptes de régularisation - actif","actif","debiteur","3491"],
  ["TITRES ET VALEURS DE PLACEMENT","actif","debiteur","3500"],
  ["Chèques et valeurs à encaisser","actif","debiteur","5112"],
  ["Banque, T.G et C.C.P.","actif","debiteur","5141"],
  ["Caisses, régies d'avances et accréditifs","actif","debiteur","5161"],
  ["Capital social ou personnel","passif","crediteur","1111"],
  ["Prime d'émission, de fusion, d'apport","passif","crediteur","1130"],
  ["Ecarts de réévaluation","passif","crediteur","1140"],
  ["Réserves diverses","passif","crediteur","1151"],
  ["Report à nouveau et résultats nets en instance d'affectation","passif","crediteur","1161"],
  ["Résultat net de l'exercice","passif","crediteur","1191"],
  ["CAPITAUX PROPRES ASSIMILES","passif","crediteur","1310"],
  ["DETTES DE FINANCEMENT","passif","crediteur","1481"],
  ["PROVISIONS DURABLES POUR RISQUES ET CHARGES","passif","crediteur","1511"],
  ["Fournisseurs et comptes rattachés","passif","crediteur","4411"],
  ["Comptes d'associés","passif","crediteur","4463"],
  ["Créanciers divers","passif","crediteur","4468"],
  ["Comptes de régularisation - passif","passif","crediteur","4491"],
  ["AUTRES PROVISIONS POUR RISQUES ET CHARGES","passif","crediteur","4501"],
  ["Crédits d'escompte et de trésorerie","passif","crediteur","5520"],
  ["Banques (soldes créditeurs)","passif","crediteur","5541"]
];

// Solde debit/credit brut de chaque compte, toutes ecritures actives
// confondues (une contre-ecriture neutralise naturellement l'ecriture
// annulee par le jeu normal de la partie double - inutile de l'exclure).
function soldesComptesActuels(){
  var soldes = {};
  STATE.ecritures.forEach(function(e){
    (e.lignes||[]).forEach(function(l){
      if(!l.compte) return;
      var s = soldes[l.compte] || (soldes[l.compte] = {debit:0, credit:0});
      s.debit += Number(l.debit)||0;
      s.credit += Number(l.credit)||0;
    });
  });
  return soldes;
}

// Reconstruit un "bilan" (lignes {label, cote, montant}, meme forme que
// celle produite par l'import PDF / bilan_parser.py et utilisee par
// exercicesArchives) a partir des soldes ACTUELS du plan comptable :
// la "situation courante", comparable aux exercices archives dans le
// meme tableau. Les comptes de classes 1 a 5 portent l'etat cumule
// depuis toujours (l'ecriture d'ouverture y a reporte l'etat de cloture
// precedent, les ecritures suivantes s'y ajoutent normalement) - une
// simple somme des ecritures suffit donc, sans filtre de date. Omet,
// comme le parseur PDF, les rubriques dont le solde est nul.
function bilanSituationCourante(){
  var soldes = soldesComptesActuels();
  var lignes = [];
  RUBRIQUES_BILAN_CGNC.forEach(function(r){
    var label = r[0], cote = r[1], sens = r[2], compte = r[3];
    var s = soldes[compte];
    if(!s) return;
    var montant = n2(sens==='debiteur' ? (s.debit - s.credit) : (s.credit - s.debit));
    if(Math.abs(montant) < 0.005) return;
    lignes.push({label: label, cote: cote, sens: sens, montant: montant});
  });
  return lignes;
}

// Ecriture d'ouverture active (ni elle-meme une contre-ecriture, ni deja
// annulee par une contre-ecriture la referencant) - meme principe de
// recherche que genererContreEcritureSiExiste()/creerEcriture(). Sa date
// (lendemain de la cloture de l'exercice precedent, voir ou.date dans
// renderEcritureOuverture) sert de point de depart a l'exercice en cours
// pour les indicateurs de flux ci-dessous (CA, resultat, marge) - les
// comptes de produits/charges (classes 6/7) ne faisant jamais partie de
// l'ecriture d'ouverture elle-meme (V1.36), contrairement aux comptes de
// bilan, ils doivent etre bornes dans le temps pour ne pas cumuler sur
// plusieurs exercices.
function ecritureOuvertureActive(){
  return STATE.ecritures.find(function(e){
    if(e.sourceType!=='ouverture' || e.contrePieceDe) return false;
    var annulee = STATE.ecritures.some(function(x){ return x.contrePieceDe===e.id; });
    return !annulee;
  }) || null;
}
function dateDebutExerciceEnCours(){
  var ouv = ecritureOuvertureActive();
  return ouv ? (ouv.date || null) : null;
}
// Ecritures de l'exercice en cours (hors ecriture d'ouverture elle-meme) :
// toutes si aucune ecriture d'ouverture n'existe encore (installation
// neuve), sinon seulement celles datees a partir de son ouverture.
function ecrituresExerciceEnCours(){
  var depuis = dateDebutExerciceEnCours();
  return STATE.ecritures.filter(function(e){
    if(e.sourceType==='ouverture') return false;
    if(depuis && (e.date||'') < depuis) return false;
    return true;
  });
}
function compteClasse(code){
  var c = STATE.planComptable.find(function(p){ return p.code===code; });
  return c ? Number(c.classe) : null;
}
// Solde (sens 'crediteur' : credit-debit, typiquement un compte de
// produits classe 7 ; sens 'debiteur' : debit-credit, typiquement un
// compte de charges classe 6) de toutes les lignes d'une CLASSE comptable
// entiere, cumule depuis l'ouverture de l'exercice en cours.
function soldeClasseExerciceEnCours(classeVoulue, sens){
  var total = 0;
  ecrituresExerciceEnCours().forEach(function(e){
    (e.lignes||[]).forEach(function(l){
      if(compteClasse(l.compte)!==classeVoulue) return;
      total += sens==='crediteur' ? ((Number(l.credit)||0)-(Number(l.debit)||0)) : ((Number(l.debit)||0)-(Number(l.credit)||0));
    });
  });
  return n2(total);
}
// Meme principe, mais pour UN SEUL compte precis (ex. 7121 Ventes/Travaux
// uniquement, plutot que toute la classe 7).
function soldeCompteExerciceEnCours(code, sens){
  var total = 0;
  ecrituresExerciceEnCours().forEach(function(e){
    (e.lignes||[]).forEach(function(l){
      if(l.compte!==code) return;
      total += sens==='crediteur' ? ((Number(l.credit)||0)-(Number(l.debit)||0)) : ((Number(l.debit)||0)-(Number(l.credit)||0));
    });
  });
  return n2(total);
}
// Chiffre d'affaires cumule de l'exercice en cours : specifiquement le
// compte Ventes/Travaux factures (COMPTES_AUTO.ventesTravaux, 7121),
// coherent avec le sens de "chiffre d'affaires" utilise partout ailleurs
// dans l'application - pas la classe 7 entiere (qui, pour l'instant,
// revient au meme en pratique puisque 7121 est le seul compte de produits
// utilise automatiquement par les ecritures generees, mais les deux
// notions doivent rester distinctes si l'utilisateur ajoute un jour
// d'autres comptes de produits via une ecriture manuelle).
function caCumuleExerciceEnCours(){
  return soldeCompteExerciceEnCours(COMPTES_AUTO.ventesTravaux, 'crediteur');
}
// Resultat net ESTIME de l'exercice en cours : produits (classe 7) moins
// charges (classe 6) deja comptabilises depuis l'ouverture - une
// ESTIMATION (d'ou son libelle explicite dans l'ecran), puisqu'aucune
// ecriture de cloture automatique n'existe dans cette application (le
// vrai resultat net definitif ne sera connu qu'a la cloture de
// l'exercice, lors de l'import de son bilan officiel - voir
// resultatNetMontant() pour les exercices archives, qui lit directement
// la rubrique calculee par la fiduciaire).
function resultatNetEstimeExerciceEnCours(){
  return n2(soldeClasseExerciceEnCours(7,'crediteur') - soldeClasseExerciceEnCours(6,'debiteur'));
}
// Marge brute = chiffre d'affaires (7121) moins achats/sous-traitance
// (COMPTES_AUTO.achatsTravaux, 6125) uniquement - volontairement plus
// etroit que le resultat net estime (qui deduit TOUTES les charges de
// classe 6), pour isoler la rentabilite directe des travaux. Coincide
// aujourd'hui en pratique avec le resultat net estime (6125 est, comme
// 7121, le seul compte automatique de sa classe), mais les deux
// indicateurs divergeront naturellement si d'autres comptes de charges
// sont utilises via une ecriture manuelle.
function margeBruteExerciceEnCours(){
  var ca = caCumuleExerciceEnCours();
  var achats = soldeCompteExerciceEnCours(COMPTES_AUTO.achatsTravaux, 'debiteur');
  return {montant: n2(ca - achats), taux: ca!==0 ? n2((ca-achats)/ca*100) : null};
}

function renderControleGestion(mount, actions){
  actions.innerHTML = '';

  var archives = STATE.exercicesArchives.slice().sort(function(a,b){ return exerciceFinTri(a).localeCompare(exerciceFinTri(b)); });
  var lignesCourante = bilanSituationCourante();
  var ouvertureActive = ecritureOuvertureActive();
  var caCumule = caCumuleExerciceEnCours();
  var resultatEstime = resultatNetEstimeExerciceEnCours();
  var tresorerieCourante = tresorerieMontant(lignesCourante);
  var marge = margeBruteExerciceEnCours();

  var dernierArchive = archives.length ? archives[archives.length-1] : null;
  var caPrecedent = dernierArchive && (typeof dernierArchive.chiffreAffaires==='number') ? dernierArchive.chiffreAffaires : null;
  var evoCourante = caPrecedent!==null ? n2(caCumule-caPrecedent) : null;

  var body = '<p class="hint" style="margin:-4px 0 16px;">Compare les bilans des exercices archivés (page « Exercices archivés ») à la situation courante, reconstruite en direct à partir des soldes actuels du plan comptable — et donne quelques indicateurs de pilotage calculés depuis l’ouverture de l’exercice en cours. Purement informatif : aucune écriture comptable n’est générée ou modifiée ici.</p>';

  body += '<div class="kpi-grid">'+
    '<div class="card kpi kpi-accent"><div class="kpi-label">Trésorerie actuelle</div><div class="kpi-value">'+fmtMoney(tresorerieCourante)+'</div><div class="kpi-sub">Banque + caisse + chèques à encaisser</div></div>'+
    '<div class="card kpi kpi-accent ok"><div class="kpi-label">CA cumulé — exercice en cours</div><div class="kpi-value">'+fmtMoney(caCumule)+'</div><div class="kpi-sub">'+(ouvertureActive? 'Depuis le '+fmtDate(ouvertureActive.date) : 'Aucune écriture d’ouverture enregistrée')+'</div></div>'+
    '<div class="card kpi kpi-accent'+(resultatEstime<0?' danger':' ok')+'"><div class="kpi-label">Résultat net estimé</div><div class="kpi-value" style="color:'+(resultatEstime<0?'var(--danger)':'var(--success)')+';">'+fmtMoney(resultatEstime)+'</div><div class="kpi-sub">Produits − charges comptabilisés, estimation avant clôture</div></div>'+
    '<div class="card kpi kpi-accent'+(marge.montant<0?' danger':'')+'"><div class="kpi-label">Marge brute</div><div class="kpi-value">'+fmtMoney(marge.montant)+'</div><div class="kpi-sub">'+(marge.taux!==null? 'Soit '+marge.taux.toLocaleString('fr-FR',{maximumFractionDigits:1})+' % du CA' : 'CA cumulé nul')+'</div></div>'+
  '</div>';

  body += '<div class="card card-pad" style="margin-bottom:18px;"><h3 style="font-size:14px;margin-bottom:10px;">Comparatif des bilans</h3>';
  body += '<div class="table-wrap"><table><thead><tr>'+
    '<th>Exercice</th><th class="r">Chiffre d’affaires</th><th class="r">Évolution CA</th><th class="r">Résultat net</th><th class="r">Total du bilan</th><th class="r">Trésorerie</th>'+
  '</tr></thead><tbody>'+
    archives.map(function(a, idx){
      var ca = (typeof a.chiffreAffaires==='number')? a.chiffreAffaires : null;
      var prev = idx>0 ? archives[idx-1] : null;
      var prevCa = prev && (typeof prev.chiffreAffaires==='number') ? prev.chiffreAffaires : null;
      var evo = (ca!==null && prevCa!==null) ? n2(ca-prevCa) : null;
      var rn = resultatNetMontant(a.lignes);
      return '<tr>'+
        '<td>'+esc(a.exerciceDebut||'')+' — '+esc(a.exerciceFin||'')+'</td>'+
        '<td class="r num">'+(ca!==null? fmtMoney2(ca) : '—')+'</td>'+
        '<td class="r num" style="'+(evo===null?'':'color:'+(evo<0?'var(--danger)':'var(--success)')+';')+'">'+(evo===null? '—' : (evo>=0?'+':'')+fmtMoney2(evo))+'</td>'+
        '<td class="r num" style="color:'+(rn<0?'var(--danger)':'var(--success)')+';">'+fmtMoney2(rn)+'</td>'+
        '<td class="r num">'+fmtMoney2(totalBilanMontant(a.lignes))+'</td>'+
        '<td class="r num">'+fmtMoney2(tresorerieMontant(a.lignes))+'</td>'+
      '</tr>';
    }).join('')+
    '<tr style="background:var(--surface-3);">'+
      '<td><span class="pill pill-primary">EN COURS</span> Situation courante</td>'+
      '<td class="r num">'+fmtMoney2(caCumule)+'</td>'+
      '<td class="r num" style="'+(evoCourante===null?'':'color:'+(evoCourante<0?'var(--danger)':'var(--success)')+';')+'">'+(evoCourante===null? '—' : (evoCourante>=0?'+':'')+fmtMoney2(evoCourante))+'</td>'+
      '<td class="r num" style="color:'+(resultatEstime<0?'var(--danger)':'var(--success)')+';">'+fmtMoney2(resultatEstime)+' <span class="muted" style="font-size:11px;">(estimé)</span></td>'+
      '<td class="r num">'+fmtMoney2(totalBilanMontant(lignesCourante))+'</td>'+
      '<td class="r num">'+fmtMoney2(tresorerieCourante)+'</td>'+
    '</tr>'+
  '</tbody></table></div>';
  body += '<p class="hint" style="margin-top:10px;">Pour la situation courante, le résultat net est <strong>estimé</strong> par différence entre produits et charges déjà comptabilisés depuis l’ouverture de l’exercice — il ne devient définitif qu’à la clôture, lors de l’import du bilan officiel de fin d’exercice (page « Exercices archivés »).</p>';
  body += '<p style="margin-top:12px;"><button type="button" class="linklike" id="cg-toggle-detail">'+ic('chevron',12)+' Voir le détail de la situation courante (rubrique par rubrique)</button></p>';
  body += '<div id="cg-detail" hidden style="margin-top:10px;">'+
    (lignesCourante.length ?
      '<div class="table-wrap"><table><thead><tr><th>Rubrique</th><th>Côté</th><th class="r">Montant</th></tr></thead><tbody>'+
        lignesCourante.map(function(l){
          return '<tr><td>'+esc(l.label)+'</td><td class="muted">'+(l.cote==='actif'?'Actif':'Passif')+'</td><td class="r num">'+fmtMoney2(l.montant)+'</td></tr>';
        }).join('')+
      '</tbody></table></div>'
    : '<p class="hint">Aucun compte de bilan mouvementé pour le moment (aucune écriture d’ouverture, et aucune écriture touchant un compte de classe 1 à 5).</p>')+
  '</div>';
  body += '</div>';

  mount.innerHTML = body;

  var toggleBtn = byId('cg-toggle-detail');
  if(toggleBtn) toggleBtn.addEventListener('click', function(){
    var d = byId('cg-detail');
    d.hidden = !d.hidden;
  });
}

/* -------- export / import Excel (Clients et Fournisseurs) --------
   Deux registres ("Clients" et "Fournisseurs") partagent le meme mecanisme
   d'aller-retour Excel, uniquement parametre par un petit schema de colonnes
   par registre (EXCEL_ENTITY ci-dessous) :
   - Export : telecharge /api/excel/<clients|fournisseurs>/export (genere
     cote serveur avec openpyxl - voir backend/routes/excel_io.py), memes
     colonnes que l'import sait relire.
   - Import : upload du .xlsx vers /api/excel/parse (le navigateur ne sait
     pas decoder un .xlsx lui-meme, c'est fait cote serveur), puis ecran de
     correspondance de colonnes (meme principe que l'ancien import CSV des
     clients, generalise ici), puis enregistrement ligne par ligne via l'API
     generique existante - en mettant a jour la fiche existante si une
     correspondance par ICE (ou, a defaut, par nom) est trouvee, plutot que
     de toujours creer une nouvelle fiche : un export puis reimport sans
     modification, ou apres correction dans Excel, ne cree donc jamais de
     doublon (comportement valide avec l'utilisateur avant implementation).
   Les champs techniques propres au rapprochement bancaire des fournisseurs
   (mot-cle, type, TVA) ne transitent jamais par cet aller-retour : une
   fiche fournisseur mise a jour via Excel garde ces champs inchanges, et une
   fiche nouvellement creee recoit les memes valeurs par defaut que le
   formulaire habituel (type "Fournisseur", TVA 20%, mot-cle = nom). */
var EXCEL_FIELDS = {
  clients: [
    {key:'nom', label:'Raison sociale / Nom', required:true, guesses:['nom','société','societe','client','raison sociale','company','name']},
    {key:'ice', label:'ICE', guesses:['ice']},
    {key:'identifiantFiscal', label:'Identifiant fiscal (IF)', guesses:['identifiant fiscal','if']},
    {key:'rc', label:'RC', guesses:['rc']},
    {key:'patente', label:'Patente', guesses:['patente']},
    {key:'adresse', label:'Adresse', guesses:['adresse','address']},
    {key:'ville', label:'Ville', guesses:['ville','city']},
    {key:'telephone', label:'Téléphone', guesses:['telephone','téléphone','tel','tél','phone']},
    {key:'email', label:'Email', guesses:['email','e-mail','mail']},
    {key:'contact', label:'Contact', guesses:['contact','interlocuteur']},
    {key:'notes', label:'Notes', guesses:['notes']}
  ],
  fournisseurs: [
    {key:'tiers', label:'Raison sociale / Nom', required:true, guesses:['nom','société','societe','fournisseur','raison sociale','company','name']},
    {key:'ice', label:'ICE', guesses:['ice']},
    {key:'identifiantFiscal', label:'Identifiant fiscal (IF)', guesses:['identifiant fiscal','if']},
    {key:'rc', label:'RC', guesses:['rc']},
    {key:'patente', label:'Patente', guesses:['patente']},
    {key:'adresse', label:'Adresse', guesses:['adresse','address']},
    {key:'ville', label:'Ville', guesses:['ville','city']},
    {key:'telephone', label:'Téléphone', guesses:['telephone','téléphone','tel','tél','phone']},
    {key:'email', label:'Email', guesses:['email','e-mail','mail']},
    {key:'contact', label:'Contact', guesses:['contact','interlocuteur']},
    {key:'notes', label:'Notes', guesses:['notes']}
  ]
};
var EXCEL_ENTITY = {
  clients: {
    collection:'clients', nameKey:'nom', iceKey:'ice', labelUn:'client', labelPlur:'client(s)',
    existingList: function(){ return STATE.clients; },
    buildNewExtra: function(){ return {}; }
  },
  fournisseurs: {
    collection:'tiersBancaires', nameKey:'tiers', iceKey:'ice', labelUn:'fournisseur', labelPlur:'fournisseur(s)',
    existingList: function(){ return STATE.tiersBancaires.filter(function(t){ return (t.type||'').trim().toLowerCase()==='fournisseur'; }); },
    buildNewExtra: function(nom){ return {motCle:nom, type:'Fournisseur', tva:0.2}; }
  }
};
function guessColumn(headers, guesses){
  var lower = headers.map(function(h){ return h.toLowerCase(); });
  for(var i=0;i<guesses.length;i++){
    var idx = lower.indexOf(guesses[i]);
    if(idx>-1) return idx;
  }
  for(var j=0;j<lower.length;j++){
    for(var k=0;k<guesses.length;k++){ if(lower[j].indexOf(guesses[k])>-1) return j; }
  }
  return -1;
}
function exportExcelList(kind){
  toast('Génération du fichier Excel…');
  fetch('/api/excel/'+kind+'/export').then(function(r){
    if(!r.ok) throw new Error('Erreur HTTP '+r.status);
    return r.blob();
  }).then(function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = kind+'.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }).catch(function(err){ console.error(err); toast('Erreur d’export : '+err.message, 'danger'); });
}
function openImportExcelModal(kind){
  var cfg = EXCEL_ENTITY[kind];
  var overlay = openModal({
    title: kind==='clients'? 'Importer des clients depuis un fichier Excel' : 'Importer des fournisseurs depuis un fichier Excel',
    large:true,
    body:
      '<p class="hint" style="margin-bottom:14px;">Sélectionnez un fichier .xlsx (par exemple celui obtenu via « Exporter Excel », corrigé ou complété). Vous pourrez faire correspondre les colonnes à l’étape suivante — une fiche dont le nom ou l’ICE correspond déjà à une fiche existante sera mise à jour plutôt que dupliquée.</p>'+
      '<input type="file" id="xl-file" accept=".xlsx">'+
      '<div id="xl-zone" style="margin-top:16px;"></div>',
    foot:false
  });
  byId('xl-file').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    var zone = byId('xl-zone');
    zone.innerHTML = '<p class="hint">Lecture du fichier…</p>';
    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/excel/parse', {method:'POST', body:fd}).then(function(r){
      return r.text().then(function(text){
        var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
        if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
        return json;
      });
    }).then(function(parsed){ handleExcelLoaded(kind, parsed); }).catch(function(err){
      console.error(err); zone.innerHTML=''; toast('Erreur de lecture du fichier : '+err.message, 'danger');
    });
  });
}
function handleExcelLoaded(kind, parsed){
  var cfg = EXCEL_ENTITY[kind];
  var fields = EXCEL_FIELDS[kind];
  if(!parsed || !parsed.headers || !parsed.headers.length){ toast('Fichier Excel vide ou illisible', 'danger'); return; }
  var mapping = {};
  fields.forEach(function(f){ mapping[f.key] = guessColumn(parsed.headers, f.guesses); });
  var zone = byId('xl-zone');
  function renderMappingUI(){
    var mapRows = fields.map(function(f){
      var opts = '<option value="-1">— Ignorer —</option>'+parsed.headers.map(function(h,i){
        return '<option value="'+i+'"'+(mapping[f.key]===i?' selected':'')+'>'+esc(h)+'</option>';
      }).join('');
      return '<div class="field"><label>'+esc(f.label)+(f.required?' *':'')+'</label><select data-map="'+f.key+'">'+opts+'</select></div>';
    }).join('');
    var nameKey = fields[0].key;
    var previewRows = parsed.rows.slice(0,5).map(function(r){
      var nomIdx = mapping[nameKey];
      return '<tr><td>'+esc(nomIdx>-1? r[nomIdx] : '—')+'</td></tr>';
    }).join('');
    zone.innerHTML =
      '<div class="field-row grid-3">'+mapRows+'</div>'+
      '<p class="hint">Aperçu (colonne « Nom » mappée) — '+parsed.rows.length+' ligne(s) détectée(s) :</p>'+
      '<div class="table-wrap"><table><thead><tr><th>Nom (aperçu)</th></tr></thead><tbody>'+(previewRows||'<tr><td class="muted">Aucune donnée</td></tr>')+'</tbody></table></div>'+
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">'+
        '<button type="button" class="btn" id="xl-cancel">Annuler</button>'+
        '<button type="button" class="btn btn-primary" id="xl-confirm">Importer '+parsed.rows.length+' '+cfg.labelPlur+'</button>'+
      '</div>'+
      '<div id="xl-progress" class="hint" style="margin-top:10px;"></div>';
    zone.querySelectorAll('[data-map]').forEach(function(sel){
      sel.addEventListener('change', function(){ mapping[sel.getAttribute('data-map')] = Number(sel.value); renderMappingUI(); });
    });
    byId('xl-cancel').addEventListener('click', closeModal);
    byId('xl-confirm').addEventListener('click', function(){ runExcelImport(kind, parsed, mapping); });
  }
  renderMappingUI();
}
function findExcelExistingMatch(cfg, ice, nom){
  var list = cfg.existingList();
  if(ice){
    var low = ice.trim().toLowerCase();
    var m = list.find(function(x){ return (x[cfg.iceKey]||'').trim().toLowerCase()===low; });
    if(m) return m;
  }
  if(nom){
    var lowNom = nom.trim().toLowerCase();
    var m2 = list.find(function(x){ return (x[cfg.nameKey]||'').trim().toLowerCase()===lowNom; });
    if(m2) return m2;
  }
  return null;
}
function runExcelImport(kind, parsed, mapping){
  var cfg = EXCEL_ENTITY[kind];
  var fields = EXCEL_FIELDS[kind];
  var nameKey = fields[0].key;
  if(mapping[nameKey]<0){ toast('Veuillez faire correspondre la colonne « Nom »', 'danger'); return; }
  var progress = byId('xl-progress');
  var rows = parsed.rows.filter(function(r){ return (r[mapping[nameKey]]||'').trim(); });
  var created = 0, updated = 0, errors = 0;
  function next(i){
    if(i>=rows.length){
      progress.textContent = created+' créé(s), '+updated+' mis à jour'+(errors?', '+errors+' erreur(s)':'')+'.';
      toast((created+updated)+' '+cfg.labelPlur+' importé(s)', errors?'':'success');
      STATE.route = kind; scheduleRender();
      setTimeout(closeModal, 900);
      return;
    }
    var r = rows[i];
    var data = {};
    fields.forEach(function(f){ data[f.key] = mapping[f.key]>-1 ? (r[mapping[f.key]]||'').trim() : ''; });
    var existing = findExcelExistingMatch(cfg, data[cfg.iceKey], data[nameKey]);
    var p;
    if(existing){
      p = STATE.db.doc(cfg.collection+'/'+existing.id).update(data).then(function(){ updated++; });
    } else {
      var toAdd = Object.assign({createdAt:nowISO(), creePar:currentUserName()}, cfg.buildNewExtra(data[nameKey]), data);
      p = STATE.db.collection(cfg.collection).add(toAdd).then(function(){ created++; });
    }
    p.catch(function(){ errors++; }).then(function(){
      progress.textContent = 'Import en cours… '+(i+1)+' / '+rows.length;
      next(i+1);
    });
  }
  progress.textContent = 'Import en cours…';
  next(0);
}

/* =========================================================
   EXPORT / IMPORT DES MODELES DE ZONES (Parametres), un seul
   fichier JSON global pour tous les fournisseurs a la fois -
   sauvegarde/transfert des modeles de reconnaissance de facture
   deja dessines (voir openZonesEditorModal). Format JSON (et non
   Excel) : ces modeles sont une structure technique, pas une
   liste destinee a etre lue/modifiee a la main dans un tableur.
   ========================================================= */
function exportZonesModeles(){
  toast('Génération du fichier…');
  fetch('/api/facture-fournisseur/zones-modeles/export').then(function(r){
    if(!r.ok) throw new Error('Erreur HTTP '+r.status);
    return r.blob();
  }).then(function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'modeles_zones_factures_fournisseurs.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }).catch(function(err){ console.error(err); toast('Erreur d’export : '+err.message, 'danger'); });
}
function openImportZonesModelesModal(){
  openModal({
    title: 'Importer des modèles de zones',
    body:
      '<p class="hint" style="margin-bottom:14px;">Sélectionnez un fichier .json précédemment obtenu via « Exporter les modèles de zones ». '+
      'Chaque modèle est rattaché à un fournisseur existant par ICE puis par nom, et '+
      '<strong>remplace</strong> le modèle déjà enregistré pour ce fournisseur le cas échéant — aucune fiche fournisseur n’est créée '+
      'à partir de ce fichier : un fournisseur introuvable sera simplement signalé.</p>'+
      '<input type="file" id="zm-file" accept=".json">',
    foot:false
  });
  byId('zm-file').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    // confirmDialog() reutilise la meme modale (une seule a la fois) : elle
    // remplace donc celle-ci plutot que de s'empiler par-dessus - la suite
    // ne doit rien referencer de son contenu (ex. #zm-file), tout se joue
    // sur la variable locale 'file' deja capturee ci-dessus.
    confirmDialog(
      'Les modèles de zones déjà enregistrés pour les fournisseurs présents dans ce fichier seront remplacés par ceux importés. Continuer ?',
      {okLabel:'Importer'}
    ).then(function(ok){
      if(!ok) return;
      toast('Import en cours…');
      var fd = new FormData();
      fd.append('file', file);
      fetch('/api/facture-fournisseur/zones-modeles/import', {method:'POST', body:fd}).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){ showZonesImportResultModal(res); }).catch(function(err){
        console.error(err); toast('Erreur d’import : '+err.message, 'danger');
      });
    });
  });
}
function showZonesImportResultModal(res){
  var listHtml = (res.non_trouves && res.non_trouves.length)
    ? '<p class="hint" style="margin-top:10px;">Fournisseur(s) non trouvé(s) (modèle ignoré, aucune fiche créée) :</p>'+
      '<ul style="margin:4px 0 0 18px;">'+res.non_trouves.map(function(n){ return '<li>'+esc(n)+'</li>'; }).join('')+'</ul>'
    : '';
  openModal({
    title: 'Import des modèles de zones terminé',
    body: '<p>'+res.importes+' modèle(s) importé(s) / mis à jour.</p>'+listHtml,
    foot: '<button type="button" class="btn btn-primary" data-close-modal>Fermer</button>'
  });
  toast(res.importes+' modèle(s) de zones importé(s)', (res.non_trouves && res.non_trouves.length) ? '' : 'success');
}

/* =========================================================
   EDITEUR DE LIGNES (devis / bon de commande / facture)
   ========================================================= */
function simpleLinesEditorHtml(lignes){
  var rows = (lignes||[]).map(function(l,i){ return simpleLineRow(l,i); }).join('');
  return (
    '<div class="table-wrap"><table class="lines-table"><thead><tr>'+
      '<th style="width:38%;">Désignation</th><th style="width:12%;">Unité</th><th class="r" style="width:14%;">Quantité</th>'+
      '<th class="r" style="width:16%;">Prix unitaire</th><th class="r" style="width:16%;">Montant</th><th></th>'+
    '</tr></thead><tbody id="lines-body">'+rows+'</tbody></table></div>'+
    '<div style="margin-top:10px;"><button type="button" class="btn btn-sm" id="lines-add">'+ic('plus',13)+' Ajouter une ligne</button></div>'
  );
}
function simpleLineRow(l, i){
  l = l || {designation:'', unite:'u', qte:1, pu:0};
  return '<tr data-row="'+i+'">'+
    '<td><textarea rows="2" data-f="designation" data-i="'+i+'" placeholder="Désignation des travaux / fournitures (plusieurs lignes possibles)">'+esc(l.designation||'')+'</textarea></td>'+
    '<td><input list="unites-list" data-f="unite" data-i="'+i+'" value="'+esc(l.unite||'u')+'"></td>'+
    '<td><input type="number" step="any" data-f="qte" data-i="'+i+'" value="'+(l.qte!==undefined?l.qte:1)+'" class="num" style="text-align:right;"></td>'+
    '<td><input type="number" step="any" data-f="pu" data-i="'+i+'" value="'+(l.pu!==undefined?l.pu:0)+'" class="num" style="text-align:right;"></td>'+
    '<td class="r num" data-montant="'+i+'">'+fmtMoney2(ligneMontant(l))+'</td>'+
    '<td><button type="button" class="iconbtn" data-rm="'+i+'" title="Supprimer la ligne">'+ic('trash',14)+'</button></td>'+
  '</tr>';
}
function wireSimpleLinesEditor(getLignes, setLignes, onChange){
  var body = byId('lines-body');
  var addBtn = byId('lines-add');
  function refreshRow(i){
    var l = getLignes()[i];
    var cell = body.querySelector('[data-montant="'+i+'"]');
    if(cell) cell.textContent = fmtMoney2(ligneMontant(l));
    if(onChange) onChange();
  }
  body.addEventListener('input', function(e){
    var t = e.target;
    var f = t.getAttribute('data-f');
    if(!f) return;
    var i = Number(t.getAttribute('data-i'));
    var lignes = getLignes();
    var val = (f==='qte'||f==='pu') ? Number(t.value) : t.value;
    lignes[i][f] = val;
    setLignes(lignes);
    refreshRow(i);
  });
  body.addEventListener('click', function(e){
    var rm = e.target.closest('[data-rm]');
    if(!rm) return;
    var i = Number(rm.getAttribute('data-i')||rm.getAttribute('data-rm'));
    var lignes = getLignes();
    lignes.splice(i,1);
    setLignes(lignes);
    body.innerHTML = lignes.map(function(l,idx){ return simpleLineRow(l,idx); }).join('');
    if(onChange) onChange();
  });
  addBtn.addEventListener('click', function(){
    var lignes = getLignes();
    lignes.push({designation:'', unite:'u', qte:1, pu:0});
    setLignes(lignes);
    body.innerHTML = lignes.map(function(l,idx){ return simpleLineRow(l,idx); }).join('');
    if(onChange) onChange();
  });
}
function unitesDatalist(){
  return '<datalist id="unites-list">'+UNITES.map(function(u){ return '<option value="'+esc(u)+'">'; }).join('')+'</datalist>';
}
function totalsBoxHtml(t, extra){
  return '<div class="lines-total"><div class="totals-box">'+
    '<div class="totals-row"><span>Total brut</span><span class="num">'+fmtMoney2(t.brut)+'</span></div>'+
    (t.remise? '<div class="totals-row"><span>Remise</span><span class="num">- '+fmtMoney2(t.remise)+'</span></div>' : '')+
    '<div class="totals-row"><span>Total HT</span><span class="num">'+fmtMoney2(t.ht)+'</span></div>'+
    '<div class="totals-row"><span>TVA</span><span class="num">'+fmtMoney2(t.tva)+'</span></div>'+
    (extra||'')+
    '<div class="totals-row grand"><span>Total TTC</span><span class="num">'+fmtMoney2(t.ttc)+'</span></div>'+
  '</div></div>';
}

// V2.10 : tri interactif (croissant/decroissant) sur les listes Devis,
// Commande client et Contrat, par N°, Client, Date ou Montant - demande
// explicite de l'utilisateur. En-tetes de colonne cliquables : un clic
// trie par cette colonne (sens par defaut : decroissant pour le N°,
// croissant pour les autres), un second clic sur la meme colonne inverse
// le sens. L'etat de tri (sortKey/sortDir) vit dans le meme objet filtre
// que la recherche/le statut (devisFilter/bcFilter/ctrFilter), pour que
// le tri choisi survive aux re-rendus (changement de filtre, etc.) tant
// que l'ecran reste ouvert.
function sortThHtml(filterObj, key, label, extraClass){
  var active = filterObj.sortKey===key;
  var arrow = active ? (filterObj.sortDir==='asc' ? ' <span class="sort-arrow">▲</span>' : ' <span class="sort-arrow">▼</span>') : '';
  var cls = 'th-sortable'+(extraClass? ' '+extraClass : '')+(active?' sort-active':'');
  return '<th class="'+cls+'" data-sort-key="'+esc(key)+'" title="Trier par '+esc(label)+'" style="cursor:pointer; user-select:none;">'+esc(label)+arrow+'</th>';
}
function wireSortHeaders(mount, filterObj, renderFn, mountEl, actionsEl){
  mount.querySelectorAll('[data-sort-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var key = th.getAttribute('data-sort-key');
      if(filterObj.sortKey===key){
        filterObj.sortDir = (filterObj.sortDir==='asc') ? 'desc' : 'asc';
      } else {
        filterObj.sortKey = key;
        filterObj.sortDir = (key==='numero') ? 'desc' : 'asc';
      }
      renderFn(mountEl, actionsEl);
    });
  });
}
function sortComparator(filterObj, getters){
  var get = getters[filterObj.sortKey] || getters.numero;
  var mul = (filterObj.sortDir==='asc') ? 1 : -1;
  return function(a, b){
    var va = get(a), vb = get(b);
    if(typeof va === 'number' && typeof vb === 'number') return (va-vb)*mul;
    va = String(va===undefined||va===null?'':va); vb = String(vb===undefined||vb===null?'':vb);
    return va.localeCompare(vb)*mul;
  };
}

/* =========================================================
   DEVIS
   ========================================================= */
// V2.19 : filtres « Client » et « Année » partages par Devis, Contrats et
// Factures clients (demande explicite de l'utilisateur). Les options sont
// construites a partir des documents reellement presents (un client sans
// document n'est pas propose) ; la cle d'un client est son id, a defaut son
// nom. L'annee est celle de la date du document (a defaut de sa date de
// creation, comme anneeFacture()).
function docAnneeFiltre(d){
  var m = /^(\d{4})/.exec((d && (d.date || d.createdAt)) || '');
  return m ? m[1] : 'Sans date';
}
function docClientCle(d){ return (d && (d.clientId || d.clientNom)) || ''; }
function clientAnneeFilterHtml(prefix, filter, docs){
  var clients = {}, annees = {};
  (docs||[]).forEach(function(d){
    var k = docClientCle(d); if(k) clients[k] = d.clientNom || k;
    annees[docAnneeFiltre(d)] = true;
  });
  if(filter.clientKey && !clients[filter.clientKey]) clients[filter.clientKey] = filter.clientKey;
  if(filter.annee && !annees[filter.annee]) annees[filter.annee] = true;
  var cl = Object.keys(clients).sort(function(a,b){ return String(clients[a]).localeCompare(String(clients[b]), 'fr', {sensitivity:'base'}); });
  var an = Object.keys(annees).sort(function(a,b){
    if(a==='Sans date') return 1; if(b==='Sans date') return -1; return b.localeCompare(a);
  });
  return '<select id="'+prefix+'-client-filter" title="Filtrer par client"><option value="">Tous les clients</option>'+
      cl.map(function(k){ return '<option value="'+esc(k)+'"'+(filter.clientKey===k?' selected':'')+'>'+esc(clients[k])+'</option>'; }).join('')+'</select>'+
    '<select id="'+prefix+'-annee-filter" title="Filtrer par année"><option value="">Toutes les années</option>'+
      an.map(function(a){ return '<option value="'+esc(a)+'"'+(filter.annee===a?' selected':'')+'>'+esc(a)+'</option>'; }).join('')+'</select>';
}
function docPasseClientAnnee(d, filter){
  if(filter.clientKey && docClientCle(d)!==filter.clientKey) return false;
  if(filter.annee && docAnneeFiltre(d)!==filter.annee) return false;
  return true;
}
function wireClientAnneeFilter(prefix, filter, rerender){
  var c = byId(prefix+'-client-filter'), a = byId(prefix+'-annee-filter');
  if(c) c.addEventListener('change', function(){ filter.clientKey = c.value; rerender(); });
  if(a) a.addEventListener('change', function(){ filter.annee = a.value; rerender(); });
}

var devisFilter = {q:'', statut:'', clientKey:'', annee:'', sortKey:'numero', sortDir:'desc'};
function renderDevis(mount, actions){
  var canEdit = canWrite('devis');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-devis">'+ic('plus',15)+' Nouveau devis</button>'+
      '<button type="button" class="btn" id="btn-import-devis" title="Enregistrer des devis déjà émis (PDF), à l’instar des factures clients">'+ic('upload',15)+' Importer des devis (PDF)</button>';
    byId('btn-new-devis').addEventListener('click', function(){ openDevisFormModal(null); });
    byId('btn-import-devis').addEventListener('click', function(){ getDevisFilesInput().click(); });
  }

  if(devisImportEnCours){
    mount.innerHTML = renderDevisEnCoursHtml(devisImportEnCours, canEdit);
    wireDevisEnCours(mount, actions);
    return;
  }

  var list = STATE.devis.filter(function(d){
    if(devisFilter.statut && d.statut!==devisFilter.statut) return false;
    if(!docPasseClientAnnee(d, devisFilter)) return false;
    if(devisFilter.q){
      var q = devisFilter.q.toLowerCase();
      if((d.numero||'').toLowerCase().indexOf(q)<0 && (d.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(sortComparator(devisFilter, {
    numero: function(d){ return d.numero||''; },
    clientNom: function(d){ return d.clientNom||''; },
    date: function(d){ return d.date||''; },
    montant: function(d){ return calcDocTotals(d.lignes, d.tauxTVA, d.remise).ttc||0; }
  }));

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="devis-search" placeholder="N° ou client…" value="'+esc(devisFilter.q)+'">'+
      '<select id="devis-statut-filter"><option value="">Tous statuts</option>'+DEVIS_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(devisFilter.statut===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select>'+
      clientAnneeFilterHtml('devis', devisFilter, STATE.devis)+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' devis</span>'+
    '</div></div>';

  if(!STATE.devis.length){
    body += emptyState('file', 'Aucun devis pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-devis">'+ic('plus',15)+' Créer un devis</button>'+
      '<button type="button" class="btn" id="empty-import-devis" style="margin-left:8px;">'+ic('upload',15)+' Importer des devis (PDF)</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun devis ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr>'+
      sortThHtml(devisFilter,'numero','N°')+
      sortThHtml(devisFilter,'clientNom','Client')+
      sortThHtml(devisFilter,'date','Date')+
      '<th>Objet</th>'+
      sortThHtml(devisFilter,'montant','Montant TTC','r')+
      '<th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(d){
        var t = calcDocTotals(d.lignes, d.tauxTVA, d.remise);
        var sm = statutMeta(DEVIS_STATUTS, d.statut);
        var dvFileUrl = devisImporteFileUrl(d);
        return '<tr>'+
          '<td class="num">'+esc(d.numero)+
            // V2.11 : badge "import" sur un devis importe depuis un PDF
            // deja emis (meme principe que le badge equivalent sur les
            // factures clients importees, voir facRowHtml) - numero
            // d'origine conserve tel quel (referenceHistorique), RG-009.
            (d.referenceHistorique? ' <span class="pill pill-neutral" style="font-size:10px;" title="Devis déjà émis, importé depuis un PDF — numéro d’origine conservé tel quel (référence historique), aucune renumérotation DEV-AAAA-NNNN (RG-009)">import</span>' : '')+
          '</td>'+
          '<td>'+esc(d.clientNom||'—')+'</td>'+
          '<td class="muted">'+fmtDate(d.date)+'</td>'+
          '<td>'+esc(d.objet||'—')+'</td>'+
          '<td class="r num">'+fmtMoney(t.ttc)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td><div class="row-actions">'+
            (dvFileUrl? '<a class="iconbtn" href="'+dvFileUrl+'" target="_blank" title="Voir le PDF d’origine importé">'+ic('file',15)+'</a>' : '')+
            // V2.14 : « Creer Contrat » directement depuis le devis accepte
            // (la Commande client a disparu, le contrat est le document
            // d'engagement unique). Masque une fois qu'un contrat a deja ete
            // cree depuis ce devis (STATE.ctr.devisId===d.id), pour ne
            // jamais creer un second contrat en doublon (principe V2.08).
            (canEdit && canWrite('ctr') && d.statut==='accepte' && !STATE.ctr.some(function(b){ return b.devisId===d.id; }) ? '<button type="button" class="btn btn-sm btn-accent" data-to-ctr="'+d.id+'">Créer Contrat</button>' : '')+
            (canEdit && d.statut!=='annule' ? '<button type="button" class="iconbtn" data-newversion="'+d.id+'" title="Nouvelle version (nouvelle édition externe)">'+ic('layers',15)+'</button>' : '')+
            // V2.05 : correction manuelle du numero officiel, reservee a
            // l'administrateur (demande explicite de l'utilisateur) - voir
            // openDevisNumeroEditModal(). Normalement le numero est attribue
            // une seule fois et jamais modifie (RG-003) ; ce bouton couvre
            // uniquement les cas exceptionnels (erreur de saisie).
            (isAdmin() ? '<button type="button" class="btn btn-sm" data-edit-numero="'+d.id+'" title="Modifier le numéro officiel (administrateur uniquement)">N°</button>' : '')+
            '<button type="button" class="iconbtn" data-print="'+d.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+d.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && d.statut!=='annule'? '<button type="button" class="iconbtn" data-cancel="'+d.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
            // V2.08 : suppression DEFINITIVE demandee explicitement par
            // l'utilisateur, malgre la regle RG-004/RG-005 du CDC de
            // nomenclature/numerotation (voir
            // claude/cdc-nomenclature-numerotation-analyse.md) - ecart
            // etendu au Devis, sur le meme principe que le Contrat (V2.01).
            // Bloquee si une commande client a deja ete creee depuis ce
            // devis (voir le gestionnaire de clic plus bas).
            (canEdit? '<button type="button" class="iconbtn" data-delete="'+d.id+'" title="Supprimer définitivement">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;
  wireSortHeaders(mount, devisFilter, renderDevis, mount, actions);

  mount.querySelectorAll('[data-to-ctr]').forEach(function(b){ b.addEventListener('click', function(){
    var d = STATE.devis.find(function(x){ return x.id===b.getAttribute('data-to-ctr'); });
    goTo('ctr');
    setTimeout(function(){ openCTRFormModal(null, d); }, 0);
  }); });
  mount.querySelectorAll('[data-edit-numero]').forEach(function(b){ b.addEventListener('click', function(){
    openDevisNumeroEditModal(STATE.devis.find(function(d){ return d.id===b.getAttribute('data-edit-numero'); }));
  }); });
  var s1 = byId('devis-search'), s2 = byId('devis-statut-filter');
  if(s1) s1.addEventListener('input', debounce(function(){ devisFilter.q = s1.value; renderDevis(mount, actions); }, 220));
  if(s2) s2.addEventListener('change', function(){ devisFilter.statut = s2.value; renderDevis(mount, actions); });
  wireClientAnneeFilter('devis', devisFilter, function(){ renderDevis(mount, actions); });
  var eb = byId('empty-new-devis'); if(eb) eb.addEventListener('click', function(){ openDevisFormModal(null); });
  var ebi = byId('empty-import-devis'); if(ebi) ebi.addEventListener('click', function(){ getDevisFilesInput().click(); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openDevisFormModal(STATE.devis.find(function(d){ return d.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('devis', STATE.devis.find(function(d){ return d.id===b.getAttribute('data-print'); }));
  }); });
  // Nouvelle version (P-08, section 6.1 CDC) : le numero racine du devis ne
  // change pas, seul le compteur local versionSeq est incremente de facon
  // atomique et transactionnelle (jamais remis a zero, jamais reutilise).
  mount.querySelectorAll('[data-newversion]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-newversion');
    confirmDialog('Créer une nouvelle version de ce devis (nouvelle édition externe) ? Le numéro racine reste inchangé, seule la version est incrémentée.', {okLabel:'Nouvelle version'}).then(function(ok){
      if(!ok) return;
      newDevisVersion(id).then(function(seq){
        return STATE.db.doc('devis/'+id).update({revision: pad2(seq)});
      }).then(function(){ toast('Nouvelle version créée', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler ce devis ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler le devis'}).then(function(ok){
      if(!ok) return;
      cancelDoc('devis', id, 'statut', 'annule').then(function(){ toast('Devis annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  // V2.08 : suppression definitive (demande explicite de l'utilisateur,
  // malgre la regle CDC RG-004/005 - voir commentaire ci-dessus). Bloquee
  // si une commande client reference deja ce devis (devisId), pour ne
  // jamais laisser de reference orpheline.
  mount.querySelectorAll('[data-delete]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete');
    var lie = (STATE.ctr||[]).some(function(x){ return x.devisId===id; });
    if(lie){
      toast('Suppression impossible : un contrat a déjà été créé depuis ce devis. Supprimez-le (ou annulez-la) d’abord.', 'danger');
      return;
    }
    var elD = elementsDuDevis(id);
    if(elD.livrables.length || elD.bordereaux.length || elD.plan.length || elD.pointage.length){
      toast('Suppression impossible : des livrables, bordereaux ou lignes de planning/timesheet sont liés à ce devis ('+elD.livrables.length+' livrable(s), '+elD.bordereaux.length+' bordereau(x), '+(elD.plan.length+elD.pointage.length)+' ligne(s)). Supprimez-les ou rattachez-les au contrat d’abord.', 'danger');
      return;
    }
    confirmDialog('Supprimer définitivement ce devis ? Contrairement à « Annuler », cette action est irréversible : aucune trace ne sera conservée, y compris sa numérotation.', {danger:true, okLabel:'Supprimer définitivement'}).then(function(ok){
      if(!ok) return;
      deleteDoc('devis', id).then(function(){ toast('Devis supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function clientOptionsHtml(selectedId, includeNew){
  var html = STATE.clients.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); }).map(function(c){
    return '<option value="'+c.id+'"'+(selectedId===c.id?' selected':'')+'>'+esc(c.nom)+'</option>';
  }).join('');
  if(includeNew) html += '<option value="__new__">+ Nouveau client…</option>';
  return html;
}

function openDevisFormModal(devis, prefill){
  var f = devis || prefill || {};
  var lignes = JSON.parse(JSON.stringify(f.lignes || [{designation:'', unite:'u', qte:1, pu:0}]));
  var tauxTVA = f.tauxTVA!==undefined ? f.tauxTVA : STATE.company.tauxTVA;
  var remise = f.remise || 0;

  var overlay = openModal({
    title: devis ? 'Modifier le devis '+devis.numero : 'Nouveau devis',
    large: true,
    body:
      unitesDatalist()+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="df-client">Client</label><select id="df-client" required><option value="">— Choisir —</option>'+clientOptionsHtml(f.clientId)+'</select></div>'+
        '<div class="field"><label for="df-date">Date</label><input type="date" id="df-date" value="'+esc(f.date||todayISO())+'"></div>'+
        '<div class="field"><label for="df-validite">Validité (jours)</label><input type="number" id="df-validite" value="'+(f.validiteJours!==undefined?f.validiteJours:30)+'"></div>'+
      '</div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="df-objet">Objet du devis</label><input id="df-objet" value="'+esc(f.objet||'')+'" placeholder="ex. Travaux de gros œuvre — Villa Ain Diab"></div>'+
        '<div class="field"><label for="df-reference">Référence (impression)</label><input id="df-reference" value="'+esc(f.reference||'')+'" placeholder="ex. Votre mail du 15/07/2026"></div>'+
        '<div class="field"><label for="df-revision">Rév.</label><input id="df-revision" value="'+esc(f.revision||'00')+'"></div>'+
      '</div>'+
      '<fieldset><legend>Lignes</legend>'+simpleLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="df-remise">Remise (%)</label><input type="number" step="any" id="df-remise" value="'+remise+'"></div>'+
        '<div class="field"><label for="df-tva">TVA (%)</label><input type="number" step="any" id="df-tva" value="'+tauxTVA+'"></div>'+
        '<div class="field"><label for="df-statut">Statut</label><select id="df-statut">'+DEVIS_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'brouillon')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div id="df-totals"></div>'+
      '<div class="field" style="margin-top:14px;"><label for="df-notes">Notes / conditions</label><textarea id="df-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="df-save">Enregistrer</button>'
  });

  function refreshTotals(){
    var t = calcDocTotals(lignes, Number(byId('df-tva').value), Number(byId('df-remise').value));
    byId('df-totals').innerHTML = totalsBoxHtml(t);
  }
  wireSimpleLinesEditor(function(){ return lignes; }, function(v){ lignes = v; }, refreshTotals);
  byId('df-tva').addEventListener('input', refreshTotals);
  byId('df-remise').addEventListener('input', refreshTotals);
  refreshTotals();

  overlay.querySelector('#df-save').addEventListener('click', function(){
    var clientId = byId('df-client').value;
    if(!clientId){ toast('Veuillez choisir un client', 'danger'); return; }
    var client = STATE.clients.find(function(c){ return c.id===clientId; });
    var data = {
      clientId: clientId, clientNom: client?client.nom:'',
      date: byId('df-date').value || todayISO(), validiteJours: Number(byId('df-validite').value)||0,
      objet: byId('df-objet').value.trim(), reference: byId('df-reference').value.trim(), revision: byId('df-revision').value.trim()||'00',
      lignes: lignes,
      remise: Number(byId('df-remise').value)||0, tauxTVA: Number(byId('df-tva').value)||0,
      statut: byId('df-statut').value, notes: byId('df-notes').value.trim()
    };
    saveDevis(data, devis?devis.id:null).then(function(){
      closeModal(); toast('Devis enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

// =========================================================
// V2.11 : import de devis deja emis (PDF), a l'identique du module
// Factures clients (demande explicite de l'utilisateur) - voir
// backend/routes/devis_import.py pour le pipeline cote serveur
// (reconnaissance + stockage des fichiers d'origine, meme principe que
// backend/routes/facture_client.py). A la difference de la Facture
// (qui n'a que deux etats a l'import : brouillon ou validee+verrouillee),
// le Devis conserve son cycle de statut normal (Brouillon/Envoye/
// Accepte/Refuse/Annule) - un selecteur de statut est donc propose sur
// l'ecran de relecture, par ligne, au lieu d'un etat impose. Le numero
// d'origine est conserve tel quel (pas de renumerotation DEV-AAAA-NNNN),
// dans un champ "referenceHistorique" dedie (RG-009 du CDC de
// nomenclature), exactement comme pour les factures clients importees.
// =========================================================
var devisImportEnCours = null; // {batchId, lignes:[...]} - pas encore enregistre

var devisFilesInputEl = null;
function getDevisFilesInput(){
  if(devisFilesInputEl && document.body.contains(devisFilesInputEl)) return devisFilesInputEl;
  devisFilesInputEl = document.createElement('input');
  devisFilesInputEl.type = 'file';
  devisFilesInputEl.accept = '.pdf,.jpg,.jpeg,.png';
  devisFilesInputEl.multiple = true;
  devisFilesInputEl.hidden = true;
  devisFilesInputEl.id = 'devis-files-input';
  document.body.appendChild(devisFilesInputEl);
  devisFilesInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if(files.length) importDevisFiles(files, byId('view-content'), byId('topbar-actions'));
  });
  return devisFilesInputEl;
}

function importDevisFiles(fileList, mount, actions){
  toast('Analyse des devis en cours…');
  var fd = new FormData();
  Array.prototype.forEach.call(fileList, function(f){ fd.append('files', f); });
  fetch('/api/devis-import/import-files', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    devisImportEnCours = {
      batchId: res.batchId,
      lignes: res.lignes.map(function(l){
        var first = (l.lignesGuess||[])[0];
        return Object.assign({
          garder:true, clientId:l.clientIdGuess||null, statut:'accepte',
          // V2.13 : la designation peut compter plusieurs lignes (devis a
          // description detaillee) - l'Objet (champ d'une seule ligne) ne
          // reprend que la premiere ; le texte complet est conserve a
          // l'enregistrement (voir wireDevisEnCours).
          objet: ((first&&first.designation) || '').split('\n')[0],
          qte: (first&&first.qte) || 1
        }, l);
      })
    };
    scheduleRender();
    toast(res.lignes.length+' fichier(s) analysé(s). Vérifiez les champs avant d’enregistrer.', 'success');
    if(res.skipped){ toast(res.skipped+' fichier(s) ignoré(s) (format non pris en charge)', 'warning'); }
  }).catch(function(err){ console.error(err); toast('Erreur d’analyse des fichiers : '+err.message, 'danger'); });
}

function finalizeDevisImportFile(currentRelPath, clientNom, date, reference){
  return fetch('/api/devis-import/finalize-file', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({currentRelPath:currentRelPath, clientNom:clientNom, date:date, reference:reference})
  }).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  });
}

// Enregistre directement un devis importe avec son numero d'origine
// conserve tel quel (pas d'appel a nextDocNumber) - a la difference de
// saveDevis() ci-dessus. versionSeq initialise a 1 comme tout nouveau
// devis : le mecanisme "Nouvelle version" (V2.09) fonctionne ensuite
// normalement, independamment de la revision imprimee sur le PDF
// d'origine (reprise telle quelle dans le champ revision).
function saveDevisImportee(data){
  data.createdAt = nowISO(); data.creePar = currentUserName();
  data.versionSeq = 1;
  return STATE.db.collection('devis').add(data);
}

function renderDevisEnCoursHtml(enCours, canEdit){
  var rows = enCours.lignes.map(function(l, idx){
    var fileUrl = '/api/devis-import/file/'+l.fileRelPath.split('/').map(encodeURIComponent).join('/');
    return '<tr'+(l.garder===false?' style="opacity:.45;"':'')+'>'+
      '<td style="text-align:center;"><input type="checkbox" class="dv-garder" data-idx="'+idx+'" style="width:auto;" '+(l.garder!==false?'checked':'')+'></td>'+
      '<td><a href="'+fileUrl+'" target="_blank" title="Voir le fichier">'+ic('file',14)+'</a> <span class="muted" style="font-size:11.5px;">'+esc(l.fileName)+'</span>'+
        (l.ocrUtilise? ' <span class="pill pill-neutral" style="font-size:10px;">OCR</span>' : '')+
      '</td>'+
      '<td><select class="dv-client" data-idx="'+idx+'" style="min-width:150px;">'+'<option value=""'+(l.clientId?'':' selected')+'>— Choisir —</option>'+clientOptionsHtml(l.clientId, true)+'</select>'+
        (!l.clientId? '<button type="button" class="linklike dv-add-client" data-idx="'+idx+'" style="display:block;margin-top:4px;font-size:11.5px;text-align:left;">'+ic('plus',11)+' Ajouter'+(l.clientNomGuess? ' « '+esc(l.clientNomGuess)+' »' : ' ce client')+'</button>' : '')+
      '</td>'+
      '<td><input class="dv-numero" data-idx="'+idx+'" value="'+esc(l.numero||'')+'" title="Numéro déjà présent sur le document d’origine — conservé tel quel, aucune renumérotation DEV-AAAA-NNNN" style="min-width:110px;"></td>'+
      '<td><input class="dv-revision" data-idx="'+idx+'" value="'+esc(l.revision||'00')+'" title="Rév." style="width:55px;"></td>'+
      '<td><input type="date" class="dv-date" data-idx="'+idx+'" value="'+esc(l.date||'')+'" style="min-width:130px;"></td>'+
      '<td><input class="dv-reference" data-idx="'+idx+'" value="'+esc(l.reference||'')+'" placeholder="Réf. (impression)" style="min-width:140px;"></td>'+
      '<td>'+((l.lignesGuess&&l.lignesGuess.length>1)?
          '<span class="pill pill-neutral" title="Devis a articles multiples : le detail complet ('+l.lignesGuess.length+' lignes) sera enregistre tel que detecte, modifiable ensuite via le bouton Modifier du devis.">'+l.lignesGuess.length+' lignes detectees</span>'
          : '<input class="dv-objet" data-idx="'+idx+'" value="'+esc(l.objet||'')+'" placeholder="Objet du devis" style="min-width:160px;">')+'</td>'+
      '<td><select class="dv-statut" data-idx="'+idx+'">'+DEVIS_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((l.statut||'accepte')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></td>'+
      '<td><input type="number" step="any" class="dv-ht" data-idx="'+idx+'" value="'+(l.montantHT!=null?l.montantHT:'')+'" style="width:95px;"></td>'+
      '<td><input type="number" step="any" class="dv-tva" data-idx="'+idx+'" value="'+(l.montantTVA!=null?l.montantTVA:'')+'" style="width:85px;"></td>'+
      '<td><input type="number" step="any" class="dv-ttc" data-idx="'+idx+'" value="'+(l.montantTTC!=null?l.montantTTC:'')+'" style="width:95px;"></td>'+
    '</tr>';
  }).join('');

  return '<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
      '<div><b>Devis importés</b><div class="muted" style="font-size:12.5px;margin-top:2px;">'+enCours.lignes.length+' fichier(s) détecté(s) — décochez ceux qui ne sont pas des devis. Le numéro d’origine est conservé tel quel (référence historique), choisissez le statut de chaque devis avant de confirmer.</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="dv-cancel">Annuler l’import</button>'+
        (canEdit? '<button type="button" class="btn btn-primary" id="dv-save-all">'+ic('check',14)+' Enregistrer les devis cochés</button>' : '')+
      '</div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr>'+
      '<th></th><th>Fichier</th><th>Client</th><th>N° (réf. historique)</th><th>Rév.</th><th>Date</th><th>Référence</th><th>Objet</th><th>Statut</th><th>HT</th><th>TVA</th><th>TTC</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p class="hint" style="margin-top:10px;">Reconnaissance automatique à vérifier ligne par ligne — l’extraction est une aide à la saisie, pas une garantie. Client, date et numéro sont nécessaires pour classer le fichier d’origine.</p>';
}

function wireDevisEnCours(mount, actions){
  var enCours = devisImportEnCours;
  function bindField(selector, prop, isNumber){
    mount.querySelectorAll(selector).forEach(function(inp){
      inp.addEventListener('change', function(){
        var idx = Number(inp.getAttribute('data-idx'));
        enCours.lignes[idx][prop] = isNumber ? (inp.value===''?null:Number(inp.value)) : inp.value;
      });
    });
  }
  mount.querySelectorAll('.dv-garder').forEach(function(chk){
    chk.addEventListener('change', function(){
      enCours.lignes[Number(chk.getAttribute('data-idx'))].garder = chk.checked;
      renderDevis(mount, actions);
    });
  });
  function openNewClientFor(idx){
    openClientFormModal(null, {
      presetNom: enCours.lignes[idx].clientNomGuess||'',
      presetIce: enCours.lignes[idx].clientIceGuess||'',
      onSaved: function(saved){
        enCours.lignes[idx].clientId = saved.id;
        scheduleRender();
      }
    });
  }
  mount.querySelectorAll('.dv-client').forEach(function(sel){
    sel.addEventListener('change', function(){
      var idx = Number(sel.getAttribute('data-idx'));
      if(sel.value==='__new__'){
        openNewClientFor(idx);
        sel.value = enCours.lignes[idx].clientId||'';
        return;
      }
      enCours.lignes[idx].clientId = sel.value||null;
      scheduleRender();
    });
  });
  mount.querySelectorAll('.dv-add-client').forEach(function(btn){
    btn.addEventListener('click', function(){ openNewClientFor(Number(btn.getAttribute('data-idx'))); });
  });
  mount.querySelectorAll('.dv-statut').forEach(function(sel){
    sel.addEventListener('change', function(){
      enCours.lignes[Number(sel.getAttribute('data-idx'))].statut = sel.value;
    });
  });
  bindField('.dv-numero', 'numero', false);
  bindField('.dv-revision', 'revision', false);
  bindField('.dv-date', 'date', false);
  bindField('.dv-reference', 'reference', false);
  bindField('.dv-objet', 'objet', false);
  bindField('.dv-ht', 'montantHT', true);
  bindField('.dv-tva', 'montantTVA', true);
  bindField('.dv-ttc', 'montantTTC', true);

  byId('dv-cancel').addEventListener('click', function(){
    confirmDialog('Abandonner cet import ? Les fichiers importés seront supprimés.', {danger:true, okLabel:'Abandonner'}).then(function(ok){
      if(!ok) return;
      fetch('/api/devis-import/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})}).catch(function(e){ console.error(e); });
      devisImportEnCours = null;
      scheduleRender();
    });
  });
  var saveBtn = byId('dv-save-all');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    var aGarder = enCours.lignes.filter(function(l){ return l.garder!==false && !l._savedOk; });
    if(!aGarder.length){ toast('Aucun devis coché à enregistrer', 'danger'); return; }
    var incomplet = aGarder.filter(function(l){ return !l.clientId || !l.date || !(l.numero||'').trim(); });
    if(incomplet.length){
      toast('Client, date et numéro sont obligatoires pour chaque devis coché ('+incomplet.length+' ligne(s) à compléter)', 'danger');
      return;
    }
    saveBtn.disabled = true;
    // V2.18 : enregistrement SEQUENTIEL, ligne par ligne, avec compte rendu
    // des echecs. Avant, toutes les lignes partaient en parallele : si l'une
    // echouait, les fichiers des autres avaient deja ete deplaces hors de la
    // zone d'attente (_pending) alors que l'ecran gardait l'ancien chemin -
    // le nouvel essai echouait alors sur « Fichier source introuvable » (et
    // pouvait enregistrer deux fois un meme devis).
    var echecs = [];
    var chaine = Promise.resolve();
    aGarder.forEach(function(l){ chaine = chaine.then(function(){
      var client = STATE.clients.find(function(c){ return c.id===l.clientId; });
      var nom = client? client.nom : '';
      var numero = (l.numero||'').trim();
      var ht = Number(l.montantHT)||0, tva = Number(l.montantTVA)||0, ttc = Number(l.montantTTC)||0;
      var qte = Number(l.qte)||1;
      // Devis a articles multiples correctement detecte par le moteur
      // d'extraction : on enregistre le detail complet tel que detecte
      // plutot qu'une seule ligne de synthese - modifiable ensuite via le
      // bouton Modifier (meme editeur de lignes qu'un devis normal). Sinon
      // (cas le plus frequent), une seule ligne construite a partir du
      // champ Objet/HT edites sur cet ecran (meme principe que l'import
      // des factures clients).
      // V2.13 : devis a UNE seule ligne dont la designation detectee compte
      // plusieurs lignes de texte : on la conserve en entier tant que
      // l'Objet n'a pas ete modifie a la main (sinon l'Objet edite prime).
      var g1 = (l.lignesGuess||[])[0];
      var designationUnique = (l.objet||'Prestations').trim();
      if(g1 && g1.designation && g1.designation.indexOf('\n')>=0 && (l.objet||'').trim()===g1.designation.split('\n')[0].trim()){
        designationUnique = g1.designation;
      }
      var lignes = (l.lignesGuess && l.lignesGuess.length>1)
        ? l.lignesGuess.map(function(x){
            return {
              designation: (x.designation||'Prestations').trim(),
              unite: x.unite||'u',
              qte: Number(x.qte)||0,
              pu: Number(x.pu)||0
            };
          })
        : [{designation: designationUnique, unite: (g1&&g1.unite)||'u', qte: qte, pu: n2(ht/qte)}];
      // Fichier deja classe lors d'un essai precedent : on ne le redeplace pas.
      var etapeFichier = l._fichierFinal ? Promise.resolve({fileRelPath:l.fileRelPath}) :
        finalizeDevisImportFile(l.fileRelPath, nom, l.date, numero).then(function(res){
          l.fileRelPath = res.fileRelPath; l._fichierFinal = true; return res;
        });
      return etapeFichier.then(function(res){
        return saveDevisImportee({
          clientId: l.clientId, clientNom: nom,
          date: l.date, validiteJours: 30,
          objet: (l.objet||'').trim(), reference: (l.reference||'').trim(),
          revision: (l.revision||'00').trim()||'00',
          lignes: lignes,
          remise: 0, tauxTVA: ht>0? n2(tva/ht*100) : STATE.company.tauxTVA,
          statut: l.statut||'accepte', notes: '',
          numero: numero, referenceHistorique: numero,
          fileRelPath: res.fileRelPath, fileName: l.fileName, ocrUtilise: !!l.ocrUtilise
        }).then(function(){ l._savedOk = true; });
      }).catch(function(err){
        console.error(err);
        var msg = (err && err.message) || 'erreur';
        if(msg==='Fichier source introuvable') msg = 'le fichier temporaire n’existe plus (import ancien, application redémarrée ou dossier de stockage modifié) — réimportez ce fichier';
        echecs.push({l:l, msg:msg});
      });
    }); });
    chaine.then(function(){
      var nbOk = aGarder.filter(function(l){ return l._savedOk; }).length;
      if(!echecs.length){
        return fetch('/api/devis-import/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})}).catch(function(){}).then(function(){
          toast(nbOk+' devis enregistré(s)', 'success');
          devisImportEnCours = null;
          scheduleRender();
        });
      }
      // Echec partiel : les devis deja enregistres quittent l'ecran, seuls
      // ceux en echec restent a corriger/reessayer (aucun doublon possible).
      enCours.lignes = enCours.lignes.filter(function(l){ return !l._savedOk; });
      var detail = echecs.slice(0,3).map(function(e){ return (e.l.fileName||e.l.numero||'?')+' : '+e.msg; }).join(' ; ')+(echecs.length>3?' …':'');
      toast((nbOk? nbOk+' devis enregistré(s). ' : '')+echecs.length+' en échec — '+detail, 'danger');
      saveBtn.disabled = false;
      scheduleRender();
    });
  });
}

function devisOptionsHtml(selectedId, clientId){
  var list = STATE.devis.filter(function(d){ return !clientId || d.clientId===clientId; });
  return '<option value="">— Aucun (contrat direct) —</option>'+list.map(function(d){
    return '<option value="'+d.id+'"'+(selectedId===d.id?' selected':'')+'>'+esc(d.numero)+' — '+esc(d.objet||'')+'</option>';
  }).join('');
}


/* =========================================================
   CONTRATS
   ========================================================= */
// V2.14 : le Contrat est le document d'engagement UNIQUE (la Commande client
// a ete supprimee). Il est cree depuis un devis accepte (bouton « Créer
// Contrat ») ou manuellement ici, quelle que soit l'origine de l'engagement
// (verbal, e-mail, BC client, contrat client, ou BC + contrat).
var ctrFilter = {q:'', statut:'', clientKey:'', annee:'', sortKey:'numero', sortDir:'desc'};
function renderCTR(mount, actions){
  var canEdit = canWrite('ctr');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-ctr">'+ic('plus',15)+' Nouveau contrat</button>';
    byId('btn-new-ctr').addEventListener('click', function(){ openCTRFormModal(null); });
  }
  var list = STATE.ctr.filter(function(d){
    if(ctrFilter.statut && d.statut!==ctrFilter.statut) return false;
    if(!docPasseClientAnnee(d, ctrFilter)) return false;
    if(ctrFilter.q){
      var q = ctrFilter.q.toLowerCase();
      if((d.numero||'').toLowerCase().indexOf(q)<0 && (d.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(sortComparator(ctrFilter, {
    numero: function(d){ return d.numero||''; },
    clientNom: function(d){ return d.clientNom||''; },
    date: function(d){ return d.date||''; },
    montant: function(d){ return ctrMontantTTC(d); }
  }));

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="ctr-search" placeholder="N° ou client…" value="'+esc(ctrFilter.q)+'">'+
      '<select id="ctr-statut-filter"><option value="">Tous statuts</option>'+CTR_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(ctrFilter.statut===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select>'+
      clientAnneeFilterHtml('ctr', ctrFilter, STATE.ctr)+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' contrat(s)</span>'+
    '</div></div>';

  if(!STATE.ctr.length){
    body += emptyState('building', 'Aucun contrat pour le moment. Un contrat se crée depuis un devis accepté (bouton « Créer Contrat »), ou directement ici.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-ctr">'+ic('plus',15)+' Créer un contrat</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun contrat ne correspond à ce filtre.');
  } else {
    // V2.07 : colonnes "Commande liée" et "Réf. client" remplacées par
    // "Objet" (demande explicite de l'utilisateur) - ces deux informations
    // restent consultables/modifiables dans le formulaire du contrat
    // (cmdNumero, referenceContrat), simplement plus affichées dans cette
    // liste.
    // V2.10 : colonne "Montant" ajoutee (champ "Montant contractuel",
    // optionnel, jusqu'ici saisi dans le formulaire mais jamais affiche
    // dans cette liste) - necessaire pour que le tri par montant,
    // harmonise avec Devis/Commande client, ait un sens visible a
    // l'ecran (demande explicite de l'utilisateur).
    body += '<div class="table-wrap"><table><thead><tr>'+
      sortThHtml(ctrFilter,'numero','N°')+
      sortThHtml(ctrFilter,'clientNom','Client')+
      '<th>Objet</th>'+
      sortThHtml(ctrFilter,'date','Date')+
      sortThHtml(ctrFilter,'montant','Montant TTC','r')+
      '<th>AV / ATT</th><th>Statut</th><th>Avancement livrables</th><th></th></tr></thead><tbody>'+
      list.map(function(d){
        var sm = statutMeta(CTR_STATUTS, d.statut);
        // V1.63 : avancement global pondere par les heures, sur les seuls
        // livrables de ce contrat (voir avancementPondere()) - "—" si
        // aucun livrable avec budget/statut eligible (aucun livrable du
        // tout, budgets pas encore saisis, ou tous dans un statut sans
        // avancement defini).
        var avCtr = avancementPondere((STATE.livrables||[]).filter(function(l){ return l.ctrId===d.id; }));
        var avHtml = (avCtr===null) ? '<span class="muted">—</span>' : (Math.round(avCtr*10)/10)+'%';
        return '<tr>'+
          '<td class="num">'+esc(d.numero)+'</td>'+
          '<td>'+esc(d.clientNom||'—')+'</td>'+
          '<td>'+esc(d.objet||'—')+'</td>'+
          '<td class="muted">'+fmtDate(d.date)+'</td>'+
          '<td class="r num">'+(ctrMontantTTC(d) ? fmtMoney(ctrMontantTTC(d)) : '<span class="muted">—</span>')+'</td>'+
          '<td class="muted">'+(d.avSeq||0)+' / '+(d.attSeq||0)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td class="num">'+avHtml+'</td>'+
          '<td><div class="row-actions">'+
            // V2.05 : voir le commentaire equivalent dans renderDevis -
            // correction manuelle du numero officiel, administrateur
            // uniquement (openCTRNumeroEditModal()). Bloquee par cette
            // fonction si des avenants/attachements/bordereaux existent
            // deja sur ce contrat (ils y bakent le numero, voir son
            // commentaire).
            (isAdmin() ? '<button type="button" class="btn btn-sm" data-edit-numero="'+d.id+'" title="Modifier le numéro officiel (administrateur uniquement)">N°</button>' : '')+
            // V2.09 : "Nouvelle version", a l'identique du Devis/de la
            // Commande client - independant des Avenants (avSeq), qui
            // restent le mecanisme pour les modifications contractuelles
            // substantielles. Harmonisation demandee explicitement par
            // l'utilisateur.
            (canEdit && d.statut!=='annule' ? '<button type="button" class="iconbtn" data-newversion="'+d.id+'" title="Nouvelle version (nouvelle édition externe)">'+ic('layers',15)+'</button>' : '')+
            '<button type="button" class="iconbtn" data-print="'+d.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+d.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && d.statut!=='annule'? '<button type="button" class="iconbtn" data-cancel="'+d.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
            // V2.01 : suppression DEFINITIVE demandee explicitement par
            // l'utilisateur, malgre la regle RG-004/RG-005 du CDC de
            // nomenclature/numerotation (aucune suppression physique des
            // documents de ce perimetre, voir
            // claude/cdc-nomenclature-numerotation-analyse.md) - ecart
            // assume sur decision explicite, uniquement pour le Contrat.
            // Bloquee si des avenants/attachements/livrables/bordereaux
            // sont deja rattaches a ce contrat (voir le gestionnaire de
            // clic plus bas), pour ne jamais casser leur reference ctrId/
            // ctrNumero ni la numerotation locale (avSeq/attSeq).
            (canEdit? '<button type="button" class="iconbtn" data-delete="'+d.id+'" title="Supprimer définitivement">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;
  wireSortHeaders(mount, ctrFilter, renderCTR, mount, actions);

  var s1 = byId('ctr-search'), s2 = byId('ctr-statut-filter');
  if(s1) s1.addEventListener('input', debounce(function(){ ctrFilter.q = s1.value; renderCTR(mount, actions); }, 220));
  if(s2) s2.addEventListener('change', function(){ ctrFilter.statut = s2.value; renderCTR(mount, actions); });
  wireClientAnneeFilter('ctr', ctrFilter, function(){ renderCTR(mount, actions); });
  var eb = byId('empty-new-ctr'); if(eb) eb.addEventListener('click', function(){ openCTRFormModal(null); });
  mount.querySelectorAll('[data-edit-numero]').forEach(function(b){ b.addEventListener('click', function(){
    openCTRNumeroEditModal(STATE.ctr.find(function(d){ return d.id===b.getAttribute('data-edit-numero'); }));
  }); });
  // V2.09 : voir le commentaire equivalent dans renderDevis - le numero
  // racine ne change pas, seul le compteur local versionSeq est incremente
  // de facon atomique et transactionnelle. Sans rapport avec avSeq/attSeq.
  mount.querySelectorAll('[data-newversion]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-newversion');
    confirmDialog('Créer une nouvelle version de ce contrat (nouvelle édition externe) ? Le numéro racine reste inchangé, seule la version est incrémentée.', {okLabel:'Nouvelle version'}).then(function(ok){
      if(!ok) return;
      newCTRVersion(id).then(function(seq){
        return STATE.db.doc('contrats/'+id).update({revision: pad2(seq)});
      }).then(function(){ toast('Nouvelle version créée', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openCTRFormModal(STATE.ctr.find(function(d){ return d.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('ctr', STATE.ctr.find(function(d){ return d.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler ce contrat ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler le contrat'}).then(function(ok){
      if(!ok) return;
      cancelDoc('contrats', id, 'statut', 'annule').then(function(){ toast('Contrat annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  // V2.01 : suppression definitive (demande explicite de l'utilisateur,
  // malgre la regle CDC RG-004/005 - voir commentaire ci-dessus). Bloquee
  // si des avenants, attachements, livrables ou bordereaux reference deja
  // ce contrat (ctrId), pour ne jamais laisser de reference orpheline ni
  // casser la numerotation locale (avSeq/attSeq portee par ce contrat).
  mount.querySelectorAll('[data-delete]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete');
    var lie = (STATE.av||[]).some(function(a){ return a.ctrId===id; }) ||
      (STATE.att||[]).some(function(a){ return a.ctrId===id; }) ||
      (STATE.pfa||[]).some(function(a){ return a.ctrId===id; }) ||
      (STATE.fac||[]).some(function(a){ return a.ctrId===id; }) ||
      (STATE.livrables||[]).some(function(l){ return l.ctrId===id; }) ||
      (STATE.bordereaux||[]).some(function(bd){ return bd.ctrId===id; });
    if(lie){
      toast('Suppression impossible : des avenants, attachements, propositions de facturation, factures, livrables ou bordereaux sont rattachés à ce contrat. Supprimez-les (ou annulez-les) d’abord.', 'danger');
      return;
    }
    confirmDialog('Supprimer définitivement ce contrat ? Contrairement à « Annuler », cette action est irréversible : aucune trace ne sera conservée, y compris sa numérotation.', {danger:true, okLabel:'Supprimer définitivement'}).then(function(ok){
      if(!ok) return;
      deleteDoc('contrats', id).then(function(){ toast('Contrat supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

// Options d'un menu deroulant de CONTRATS (V2.14 : le contrat est le document
// d'engagement unique ; blankLabel : texte de l'option vide en tete de liste,
// null l'omet entierement). Utilise par Avenant/Attachement/Livrables... pour choisir directement un
// CONTRAT existant (utilise par le module Livrables techniques, V1.54) -
// contrairement a Avenant/Attachement, un livrable ne cree jamais
// automatiquement de contrat : il se rattache a un contrat deja existant
// (cree ici ou issu d'ensureContratForCmd), choix volontaire pour ne pas
// generer de document commercial officiel (numerote CTR-AAAA-NNNN, soumis
// aux regles du CDC) comme simple effet de bord de la saisie d'un suivi
// technique.
function ctrOptionsHtml(selectedId, blankLabel, clientId){
  var list = STATE.ctr.filter(function(d){ return d.statut!=='annule' && (!clientId || d.clientId===clientId); });
  var blank = blankLabel===null ? '' : '<option value="">'+esc(blankLabel===undefined?'— Choisir —':blankLabel)+'</option>';
  return blank+list.map(function(d){
    return '<option value="'+d.id+'"'+(selectedId===d.id?' selected':'')+'>'+esc(d.numero)+' — '+esc(d.clientNom||'')+'</option>';
  }).join('');
}

// V2.14 : formulaire du Contrat = ancien formulaire de la Commande client
// (lignes, TVA, origine d'engagement, reference client, piece jointe) +
// champs propres au contrat (revision, codes de retour client). fromDevis :
// bouton « Créer Contrat » d'un devis accepte - pre-remplit client, devis,
// lignes, TVA et objet ; rien n'est cree tant que « Enregistrer » n'est pas
// clique.
function openCTRFormModal(ctr, fromDevis){
  var f = ctr || {};
  if(!ctr && fromDevis){
    f = {clientId: fromDevis.clientId, clientNom: fromDevis.clientNom,
      devisId: fromDevis.id, devisNumero: fromDevis.numero,
      lignes: fromDevis.lignes, tauxTVA: fromDevis.tauxTVA,
      referenceContrat: '', objet: fromDevis.objet||''};
  }
  var lignes = JSON.parse(JSON.stringify((f.lignes && f.lignes.length) ? f.lignes : [{designation:'', unite:'u', qte:1, pu:0}]));
  var tauxTVA = f.tauxTVA!==undefined && f.tauxTVA!==null ? f.tauxTVA : STATE.company.tauxTVA;
  var legacyMontant = (ctr && (!ctr.lignes || !ctr.lignes.length) && ctr.montant!==undefined && ctr.montant!==null && ctr.montant!=='') ? Number(ctr.montant) : null;

  var overlay = openModal({
    title: ctr ? 'Modifier le contrat '+ctr.numero : 'Nouveau contrat',
    large: true,
    body:
      unitesDatalist()+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="cf-client">Client</label><select id="cf-client" required><option value="">— Choisir —</option>'+clientOptionsHtml(f.clientId)+'</select></div>'+
        '<div class="field"><label for="cf-devis">Devis associé</label><select id="cf-devis">'+devisOptionsHtml(f.devisId, f.clientId)+'</select></div>'+
        '<div class="field"><label for="cf-date">Date</label><input type="date" id="cf-date" value="'+esc(f.date||todayISO())+'"></div>'+
      '</div>'+
      '<div class="field"><label for="cf-objet">Objet du contrat</label><input id="cf-objet" value="'+esc(f.objet||'')+'" placeholder="ex. Étude d’exécution — Villa Ain Diab"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-origine">Origine de l’engagement client</label><select id="cf-origine">'+ORIGINE_ENGAGEMENT.map(function(o){ return '<option value="'+o.id+'"'+((f.origineEngagement||'bc')===o.id?' selected':'')+'>'+esc(o.label)+'</option>'; }).join('')+'</select>'+
          '<p class="hint">Situation réelle d’origine du contrat (accord verbal/e-mail sans référence, BC client, contrat, ou les deux).</p></div>'+
        '<div class="field"><label for="cf-ref">Référence client (n° BC / contrat, si disponible)</label><input id="cf-ref" value="'+esc(f.referenceContrat||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="cf-precisions">Précisions (utile notamment si accord verbal ou par e-mail)</label><textarea id="cf-precisions" placeholder="ex. Accord verbal de M. X le 12/09, confirmé par mail le 14/09…">'+esc(f.precisions||'')+'</textarea></div>'+
      '<div class="field"><label>Pièce jointe (scan BC / contrat client)</label>'+
        '<div style="display:flex;align-items:center;gap:14px;">'+
          // Fichier reel sur disque (pieceJointeRelPath) -> lien de
          // telechargement ; repli sur l'ancien base64 (pieceJointeData)
          // pour une piece jointe anterieure a la V2.04, jamais migree.
          '<div id="cf-piece-preview" style="font-size:12.5px;">'+(f.pieceJointeNom? '<a href="'+esc(commandePieceJointeUrl(f)||f.pieceJointeData||'#')+'" download="'+esc(f.pieceJointeNom)+'" title="Télécharger la pièce jointe" class="pill pill-neutral">'+ic('file',11)+' '+esc(f.pieceJointeNom)+'</a>' : '<span class="muted">Aucune pièce jointe</span>')+'</div>'+
          '<input type="file" id="cf-piece-file" accept="image/*,application/pdf" style="display:none;">'+
          '<button type="button" class="btn btn-sm" id="cf-piece-pick">'+ic('upload',13)+' Joindre…</button>'+
          '<button type="button" class="btn btn-sm" id="cf-piece-clear"'+(f.pieceJointeNom?'':' hidden')+'>'+ic('trash',13)+' Retirer</button>'+
        '</div></div>'+
      // V2.09 : champ « Rev. » (compteur local versionSeq, voir newCTRVersion),
      // independant des Avenants.
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="cf-revision">Rév.</label><input id="cf-revision" value="'+esc(f.revision||'00')+'"></div>'+
      '</div>'+
      '<fieldset><legend>Lignes</legend>'+simpleLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="cf-tva">TVA (%)</label><input type="number" step="any" id="cf-tva" value="'+tauxTVA+'"></div>'+
        '<div class="field"><label for="cf-statut">Statut</label><select id="cf-statut">'+CTR_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'actif')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      (legacyMontant!==null ? '<p class="hint">Montant contractuel saisi avant la V2.14 : '+fmtMoney(legacyMontant)+' (conservé tant qu’aucune ligne n’est saisie).</p>' : '')+
      '<div id="cf-totals"></div>'+
      (ctr? '<p class="hint">Avenants émis : '+(f.avSeq||0)+' · Attachements émis : '+(f.attSeq||0)+(f.referenceHistorique? ' · Référence historique : '+esc(f.referenceHistorique) : '')+'</p>' : '')+
      '<div class="field" style="margin-top:14px;"><label for="cf-notes">Notes</label><textarea id="cf-notes">'+esc(f.notes||'')+'</textarea></div>'+
      // V1.62 : codification des statuts de retour PROPRE A CE CONTRAT - le
      // code que le client de ce contrat utilise en interne pour chaque
      // statut de retour (optionnel), configure par contrat.
      '<details style="margin-top:6px;"><summary class="linklike" style="cursor:pointer;font-size:12.5px;">Codification des statuts de retour (codes client)</summary>'+
        '<p class="hint" style="margin:6px 0;">Propre à ce contrat : le code que ce client utilise en interne pour chaque statut de retour des livrables (facultatif — laissé vide si non communiqué par le client).</p>'+
        '<div class="table-wrap"><table><thead><tr><th>Statut</th><th>Code interne</th><th>Code client</th></tr></thead><tbody>'+
          STATUT_RETOUR_REFERENTIEL.map(function(s){
            var val = (f.codesRetourClient && f.codesRetourClient[s.id]) || '';
            return '<tr><td style="font-size:12.5px;">'+esc(s.label)+'</td><td class="num muted">'+esc(s.id)+'</td>'+
              '<td><input class="cf-code-retour" data-code="'+s.id+'" value="'+esc(val)+'" style="width:70px;" placeholder="—"></td></tr>';
          }).join('')+
        '</tbody></table></div>'+
      '</details>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="cf-save">Enregistrer</button>'
  });

  // Piece jointe : vrai fichier sur disque (backend/routes/commande_client.py,
  // route conservee). pieceAction : 'unchanged' | 'new' (envoye APRES
  // l'enregistrement, pour nommer le fichier avec le numero definitif) |
  // 'cleared' (reference effacee, ancien fichier non supprime du disque).
  var pieceAction = 'unchanged';
  var pendingFile = null;
  byId('cf-piece-pick').addEventListener('click', function(){ byId('cf-piece-file').click(); });
  byId('cf-piece-file').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    if(file.size > 8*1024*1024){ toast('Fichier trop lourd (max ~8 Mo)', 'danger'); e.target.value=''; return; }
    pieceAction = 'new'; pendingFile = file;
    byId('cf-piece-preview').innerHTML = '<span class="pill pill-neutral">'+ic('file',11)+' '+esc(file.name)+'</span>';
    byId('cf-piece-clear').hidden = false;
  });
  byId('cf-piece-clear').addEventListener('click', function(){
    pieceAction = 'cleared'; pendingFile = null;
    byId('cf-piece-file').value = '';
    byId('cf-piece-preview').innerHTML = '<span class="muted">Aucune pièce jointe</span>';
    byId('cf-piece-clear').hidden = true;
  });

  function refreshTotals(){
    var t = calcDocTotals(lignes, Number(byId('cf-tva').value), 0);
    byId('cf-totals').innerHTML = totalsBoxHtml(t);
  }
  wireSimpleLinesEditor(function(){ return lignes; }, function(v){ lignes = v; }, refreshTotals);
  byId('cf-tva').addEventListener('input', refreshTotals);
  byId('cf-client').addEventListener('change', function(){
    byId('cf-devis').innerHTML = devisOptionsHtml('', byId('cf-client').value);
  });
  // Devis choisi/change ici : reprend lignes, TVA et objet (herites du devis,
  // modifiables ensuite - principe V2.07).
  byId('cf-devis').addEventListener('change', function(){
    var d = STATE.devis.find(function(x){ return x.id===byId('cf-devis').value; });
    if(d){
      lignes = JSON.parse(JSON.stringify(d.lignes||[]));
      byId('cf-tva').value = d.tauxTVA;
      byId('lines-body').innerHTML = lignes.map(function(l,idx){ return simpleLineRow(l,idx); }).join('');
      byId('cf-objet').value = d.objet||'';
      refreshTotals();
    }
  });
  refreshTotals();

  overlay.querySelector('#cf-save').addEventListener('click', function(){
    var clientId = byId('cf-client').value;
    if(!clientId){ toast('Veuillez choisir un client', 'danger'); return; }
    var client = STATE.clients.find(function(c){ return c.id===clientId; });
    var devisSel = STATE.devis.find(function(x){ return x.id===byId('cf-devis').value; });
    var codesRetourClient = {};
    document.querySelectorAll('.cf-code-retour').forEach(function(inp){
      var v = inp.value.trim();
      if(v) codesRetourClient[inp.getAttribute('data-code')] = v;
    });
    // Lignes entierement vides ignorees (contrat ancien style sans lignes :
    // son montant manuel est alors conserve tel quel).
    var lignesSaisies = lignes.filter(function(l){ return (l.designation||'').trim() || Number(l.pu)>0; });
    var data = {
      clientId: clientId, clientNom: client?client.nom:'',
      devisId: devisSel?devisSel.id:null, devisNumero: devisSel?devisSel.numero:null,
      referenceContrat: byId('cf-ref').value.trim(), date: byId('cf-date').value || todayISO(),
      origineEngagement: byId('cf-origine').value, precisions: byId('cf-precisions').value.trim(),
      revision: byId('cf-revision').value.trim()||'00',
      objet: byId('cf-objet').value.trim(),
      lignes: lignesSaisies, tauxTVA: Number(byId('cf-tva').value)||0,
      statut: byId('cf-statut').value, notes: byId('cf-notes').value.trim(),
      codesRetourClient: codesRetourClient
      // V1.72/V1.73 : `codificationSegments`/`segmentsPersonnalises` ne sont
      // plus modifies depuis ce formulaire - voir
      // openCodificationLivrablesModal (ecran « Livrables techniques »).
    };
    if(pieceAction === 'cleared'){
      data.pieceJointeNom = ''; data.pieceJointeRelPath = ''; data.pieceJointeData = '';
    } else if(pieceAction === 'unchanged'){
      data.pieceJointeNom = f.pieceJointeNom||''; data.pieceJointeRelPath = f.pieceJointeRelPath||''; data.pieceJointeData = f.pieceJointeData||'';
    }
    var btnSave = overlay.querySelector('#cf-save');
    btnSave.disabled = true;
    saveCTR(data, ctr?ctr.id:null).then(function(res){
      var id = ctr ? ctr.id : (res && res.id);
      if(pieceAction !== 'new' || !id){
        closeModal(); toast('Contrat enregistré', 'success');
        return;
      }
      // Fichier envoye APRES l'enregistrement : le numero definitif du
      // contrat (attribue a l'instant de la creation) sert a nommer le
      // fichier classe sur disque.
      return STATE.db.doc('contrats/'+id).get().then(function(snap){
        var saved = snap.data() || {};
        var fd = new FormData();
        fd.append('file', pendingFile);
        fd.append('numero', saved.numero||'');
        fd.append('clientNom', saved.clientNom||'');
        fd.append('date', saved.date||'');
        return fetch('/api/commande-client/piece-jointe', {method:'POST', body: fd}).then(function(r){
          return r.text().then(function(text){
            var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
            if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
            return json;
          });
        });
      }).then(function(uploadRes){
        return STATE.db.doc('contrats/'+id).update({
          pieceJointeNom: uploadRes.fileName, pieceJointeRelPath: uploadRes.fileRelPath, pieceJointeData: ''
        });
      }).then(function(){
        closeModal(); toast('Contrat enregistré', 'success');
      });
    }).catch(function(err){
      console.error(err); toast('Erreur d’enregistrement', 'danger'); btnSave.disabled = false;
    });
  });
}

/* =========================================================
   ATTACHEMENTS (situations de travaux)
   ========================================================= */
var attFilter = {q:''};
function renderAtt(mount, actions){
  var canEdit = canWrite('att');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-att">'+ic('plus',15)+' Nouvel attachement</button>';
    byId('btn-new-att').addEventListener('click', function(){ openAttFormModal(null); });
  }
  var list = STATE.att.filter(function(a){
    if(attFilter.q){
      var q = attFilter.q.toLowerCase();
      if((a.numero||'').toLowerCase().indexOf(q)<0 && (a.clientNom||'').toLowerCase().indexOf(q)<0 && (a.ctrNumero||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="att-search" placeholder="N°, contrat ou client…" value="'+esc(attFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' attachement(s)</span>'+
    '</div></div>';

  if(!STATE.att.length){
    body += emptyState('layers', 'Aucun attachement de chantier enregistré.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-att">'+ic('plus',15)+' Créer un attachement</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun attachement ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Contrat</th><th>Client</th><th>Date</th><th class="r">Avancement</th><th class="r">Montant période HT</th><th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(a){
        var t = attTotals(a);
        var sm = statutMeta(ATT_STATUTS, a.statut);
        var facLinked = STATE.fac.some(function(f){ return f.attachementId===a.id; });
        return '<tr>'+
          '<td class="num">'+esc(a.numero)+'</td>'+
          '<td class="num muted">'+esc(a.ctrNumero||'—')+'</td>'+
          '<td>'+esc(a.clientNom||'—')+'</td>'+
          '<td class="muted">'+fmtDate(a.date)+'</td>'+
          '<td class="r num">'+(t.avancement!==null? fmtPct(t.avancement) : '—')+'</td>'+
          '<td class="r num">'+fmtMoney(t.periodeHT)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span>'+(facLinked?' <span class="muted" style="font-size:11px;">(facturé)</span>':'')+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit && a.statut==='valide' && !facLinked && canWrite('fac') ? '<button type="button" class="btn btn-sm btn-accent" data-to-fac="'+a.id+'">Facturer</button>' : '')+
            '<button type="button" class="iconbtn" data-print="'+a.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+a.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && a.statut!=='annule'? '<button type="button" class="iconbtn" data-cancel="'+a.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('att-search');
  if(s1) s1.addEventListener('input', debounce(function(){ attFilter.q = s1.value; renderAtt(mount, actions); }, 220));
  var eb = byId('empty-new-att'); if(eb) eb.addEventListener('click', function(){ openAttFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openAttFormModal(STATE.att.find(function(a){ return a.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('att', STATE.att.find(function(a){ return a.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-to-fac]').forEach(function(b){ b.addEventListener('click', function(){
    var a = STATE.att.find(function(x){ return x.id===b.getAttribute('data-to-fac'); });
    goTo('fac');
    setTimeout(function(){ openFactureFormModal(null, a); }, 0);
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler cet attachement ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler l’attachement'}).then(function(ok){
      if(!ok) return;
      cancelDoc('attachements', id, 'statut', 'annule').then(function(){ toast('Attachement annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function attLineRow(l, i){
  l = l || {designation:'', unite:'u', qteMarche:0, pu:0, qteAnterieure:0, qtePeriode:0};
  var c = attLigneCumul(l);
  return '<tr data-row="'+i+'">'+
    '<td><input data-f="designation" data-i="'+i+'" value="'+esc(l.designation||'')+'" placeholder="Désignation"></td>'+
    '<td><input list="unites-list" data-f="unite" data-i="'+i+'" value="'+esc(l.unite||'u')+'" style="width:60px;"></td>'+
    '<td><input type="number" step="any" data-f="qteMarche" data-i="'+i+'" value="'+(l.qteMarche!==undefined?l.qteMarche:0)+'" class="num" style="text-align:right;width:80px;"></td>'+
    '<td><input type="number" step="any" data-f="pu" data-i="'+i+'" value="'+(l.pu!==undefined?l.pu:0)+'" class="num" style="text-align:right;width:90px;"></td>'+
    '<td><input type="number" step="any" data-f="qteAnterieure" data-i="'+i+'" value="'+(l.qteAnterieure!==undefined?l.qteAnterieure:0)+'" class="num" style="text-align:right;width:80px;"></td>'+
    '<td><input type="number" step="any" data-f="qtePeriode" data-i="'+i+'" value="'+(l.qtePeriode!==undefined?l.qtePeriode:0)+'" class="num" style="text-align:right;width:80px;"></td>'+
    '<td class="r num" data-cumul="'+i+'">'+fmtQty(c.qteCumulee)+'</td>'+
    '<td class="r num" data-montant="'+i+'">'+fmtMoney2(c.montantPeriode)+'</td>'+
    '<td><button type="button" class="iconbtn" data-rm="'+i+'" title="Supprimer">'+ic('trash',14)+'</button></td>'+
  '</tr>';
}
function attLinesEditorHtml(lignes){
  var rows = (lignes||[]).map(function(l,i){ return attLineRow(l,i); }).join('');
  return (
    '<div class="table-wrap"><table class="lines-table"><thead><tr>'+
      '<th style="width:24%;">Désignation</th><th>Unité</th><th class="r">Qté marché</th><th class="r">P.U.</th>'+
      '<th class="r">Qté antérieure</th><th class="r">Qté période</th><th class="r">Qté cumulée</th><th class="r">Montant période</th><th></th>'+
    '</tr></thead><tbody id="lines-body">'+rows+'</tbody></table></div>'+
    '<div style="margin-top:10px;display:flex;gap:8px;">'+
      '<button type="button" class="btn btn-sm" id="lines-add">'+ic('plus',13)+' Ajouter une ligne</button>'+
      '<button type="button" class="btn btn-sm btn-ghost" id="att-import-prev">'+ic('layers',13)+' Reprendre les quantités antérieures</button>'+
    '</div>'
  );
}
function wireAttLinesEditor(getLignes, setLignes, onChange){
  var body = byId('lines-body');
  function refreshRow(i){
    var l = getLignes()[i];
    var c = attLigneCumul(l);
    var cumCell = body.querySelector('[data-cumul="'+i+'"]');
    var mCell = body.querySelector('[data-montant="'+i+'"]');
    if(cumCell) cumCell.textContent = fmtQty(c.qteCumulee);
    if(mCell) mCell.textContent = fmtMoney2(c.montantPeriode);
    if(onChange) onChange();
  }
  body.addEventListener('input', function(e){
    var t = e.target; var f = t.getAttribute('data-f');
    if(!f) return;
    var i = Number(t.getAttribute('data-i'));
    var lignes = getLignes();
    var numeric = ['qteMarche','pu','qteAnterieure','qtePeriode'];
    lignes[i][f] = numeric.indexOf(f)>-1 ? Number(t.value) : t.value;
    setLignes(lignes);
    refreshRow(i);
  });
  body.addEventListener('click', function(e){
    var rm = e.target.closest('[data-rm]');
    if(!rm) return;
    var i = Number(rm.getAttribute('data-rm'));
    var lignes = getLignes();
    lignes.splice(i,1);
    setLignes(lignes);
    body.innerHTML = lignes.map(function(l,idx){ return attLineRow(l,idx); }).join('');
    if(onChange) onChange();
  });
  byId('lines-add').addEventListener('click', function(){
    var lignes = getLignes();
    lignes.push({designation:'', unite:'u', qteMarche:0, pu:0, qteAnterieure:0, qtePeriode:0});
    setLignes(lignes);
    body.innerHTML = lignes.map(function(l,idx){ return attLineRow(l,idx); }).join('');
    if(onChange) onChange();
  });
}
function attTotalsHtml(att){
  var t = attTotals(att);
  return '<div class="lines-total"><div class="totals-box">'+
    '<div class="totals-row"><span>Avancement cumulé du marché</span><span class="num">'+(t.avancement!==null?fmtPct(t.avancement):'—')+'</span></div>'+
    '<div class="totals-row"><span>Montant HT de la période</span><span class="num">'+fmtMoney2(t.periodeHT)+'</span></div>'+
    '<div class="totals-row"><span>TVA</span><span class="num">'+fmtMoney2(t.tva)+'</span></div>'+
    '<div class="totals-row grand"><span>Total TTC de la période</span><span class="num">'+fmtMoney2(t.ttc)+'</span></div>'+
    '<div class="totals-row muted" style="font-size:12px;"><span>Cumul HT depuis origine</span><span class="num">'+fmtMoney2(t.cumuleHT)+'</span></div>'+
  '</div></div>';
}

function openAttFormModal(att){
  var f = att ? Object.assign({}, att) : {ctrId:'', date:todayISO(), tauxTVA:STATE.company.tauxTVA, statut:'brouillon'};
  var lignes = JSON.parse(JSON.stringify(f.lignes || []));

  function bodyHtml(){
    return unitesDatalist()+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="af-cmd">Contrat</label><select id="af-cmd" required><option value="">— Choisir —</option>'+ctrOptionsHtml(f.ctrId, null)+'</select>'+
          '<p class="hint">Le numéro de l’attachement reprend celui du contrat (CTR-AAAA-NNNN-ATTxx).</p></div>'+
        '<div class="field"><label for="af-date">Date de la situation</label><input type="date" id="af-date" value="'+esc(f.date||todayISO())+'"></div>'+
        '<div class="field"><label for="af-periode">Période / N° situation</label><input id="af-periode" value="'+esc(f.periodeLabel||'')+'" placeholder="ex. Situation n°3 — Août 2026"></div>'+
      '</div>'+
      '<div class="field"><label for="af-revision">Rév.</label><input id="af-revision" style="max-width:120px;" value="'+esc(f.revision||'00')+'"></div>'+
      '<fieldset><legend>Quantités et avancement</legend>'+attLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="af-tva">TVA (%)</label><input type="number" step="any" id="af-tva" value="'+(f.tauxTVA!==undefined?f.tauxTVA:STATE.company.tauxTVA)+'"></div>'+
        '<div class="field"><label for="af-statut">Statut</label><select id="af-statut">'+ATT_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'brouillon')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div id="af-totals"></div>'+
      '<div class="field" style="margin-top:14px;"><label for="af-notes">Observations de chantier</label><textarea id="af-notes">'+esc(f.notes||'')+'</textarea></div>';
  }

  var overlay = openModal({
    title: att ? 'Modifier l’attachement '+att.numero : 'Nouvel attachement (situation de travaux)',
    large: true,
    body: bodyHtml(),
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="af-save">Enregistrer</button>'
  });

  function currentDraft(){ return {lignes:lignes, tauxTVA:Number(byId('af-tva').value)}; }
  function refreshTotals(){ byId('af-totals').innerHTML = attTotalsHtml(currentDraft()); }
  function wire(){
    wireAttLinesEditor(function(){ return lignes; }, function(v){ lignes=v; }, refreshTotals);
    byId('af-tva').addEventListener('input', refreshTotals);
    byId('att-import-prev').addEventListener('click', importPreviousQuantities);
    byId('af-cmd').addEventListener('change', function(){
      if(!lignes.length) initLinesFromCmd();
    });
  }
  function initLinesFromCmd(){
    var cmd = STATE.ctr.find(function(x){ return x.id===byId('af-cmd').value; });
    if(!cmd) return;
    lignes = (cmd.lignes||[]).map(function(l){ return {designation:l.designation, unite:l.unite, qteMarche:l.qte, pu:l.pu, qteAnterieure:0, qtePeriode:0}; });
    byId('lines-body').innerHTML = lignes.map(function(l,idx){ return attLineRow(l,idx); }).join('');
    refreshTotals();
  }
  function importPreviousQuantities(){
    var ctrId = byId('af-cmd').value;
    if(!ctrId){ toast('Choisissez d’abord un contrat', 'danger'); return; }
    var prevs = STATE.att.filter(function(a){ return a.ctrId===ctrId && (!att || a.id!==att.id); }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });
    if(!prevs.length){ initLinesFromCmd(); toast('Aucun attachement antérieur : lignes initialisées depuis le contrat', ''); return; }
    var prev = prevs[0];
    lignes = (prev.lignes||[]).map(function(l){
      var c = attLigneCumul(l);
      return {designation:l.designation, unite:l.unite, qteMarche:l.qteMarche, pu:l.pu, qteAnterieure:c.qteCumulee, qtePeriode:0};
    });
    byId('lines-body').innerHTML = lignes.map(function(l,idx){ return attLineRow(l,idx); }).join('');
    refreshTotals();
    toast('Quantités antérieures reprises de '+prev.numero, 'success');
  }
  wire();
  refreshTotals();

  overlay.querySelector('#af-save').addEventListener('click', function(){
    var ctrId = byId('af-cmd').value;
    if(!ctrId){ toast('Veuillez choisir un contrat', 'danger'); return; }
    var cmd = STATE.ctr.find(function(x){ return x.id===ctrId; });
    var data = {
      ctrId: ctrId, ctrNumero: cmd?cmd.numero:'', clientId: cmd?cmd.clientId:'', clientNom: cmd?cmd.clientNom:'',
      date: byId('af-date').value || todayISO(), periodeLabel: byId('af-periode').value.trim(), revision: byId('af-revision').value.trim()||'00',
      lignes: lignes, tauxTVA: Number(byId('af-tva').value)||0,
      statut: byId('af-statut').value, notes: byId('af-notes').value.trim()
    };
    saveAtt(data, att?att.id:null).then(function(){
      closeModal(); toast('Attachement enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   AVENANTS
   ========================================================= */
// L'avenant est toujours rattache a un contrat (choisi dans le formulaire,
// V2.14 : plus de commande intermediaire) ; sa numerotation CTR-AAAA-NNNN-AVxx utilise un
// compteur local au contrat (avSeq), jamais remis a zero (RG-002/section 6.3).
var avFilter = {q:''};
function renderAV(mount, actions){
  var canEdit = canWrite('av');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-av">'+ic('plus',15)+' Nouvel avenant</button>';
    byId('btn-new-av').addEventListener('click', function(){ openAVFormModal(null); });
  }
  var list = STATE.av.filter(function(a){
    if(avFilter.q){
      var q = avFilter.q.toLowerCase();
      if((a.numero||'').toLowerCase().indexOf(q)<0 && (a.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="av-search" placeholder="N° ou client…" value="'+esc(avFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' avenant(s)</span>'+
    '</div></div>';

  if(!STATE.av.length){
    body += emptyState('pencil', 'Aucun avenant enregistré.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-av">'+ic('plus',15)+' Créer un avenant</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun avenant ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Contrat</th><th>Client</th><th>Date</th><th>Objet</th><th class="r">Impact montant</th><th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(a){
        var sm = statutMeta(AV_STATUTS, a.statut);
        return '<tr>'+
          '<td class="num">'+esc(a.numero)+'</td>'+
          '<td class="num muted">'+esc(a.ctrNumero||'—')+'</td>'+
          '<td>'+esc(a.clientNom||'—')+'</td>'+
          '<td class="muted">'+fmtDate(a.date)+'</td>'+
          '<td>'+esc(a.objet||'—')+'</td>'+
          '<td class="r num">'+(a.montantImpact? fmtMoney(a.montantImpact) : '—')+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td><div class="row-actions">'+
            '<button type="button" class="iconbtn" data-print="'+a.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+a.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && a.statut!=='annule'? '<button type="button" class="iconbtn" data-cancel="'+a.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('av-search');
  if(s1) s1.addEventListener('input', debounce(function(){ avFilter.q = s1.value; renderAV(mount, actions); }, 220));
  var eb = byId('empty-new-av'); if(eb) eb.addEventListener('click', function(){ openAVFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openAVFormModal(STATE.av.find(function(a){ return a.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('av', STATE.av.find(function(a){ return a.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler cet avenant ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler l’avenant'}).then(function(ok){
      if(!ok) return;
      cancelDoc('avenants', id, 'statut', 'annule').then(function(){ toast('Avenant annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function openAVFormModal(av){
  var f = av || {};
  var overlay = openModal({
    title: av ? 'Modifier l’avenant '+av.numero : 'Nouvel avenant',
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="avf-cmd">Contrat</label><select id="avf-cmd" required'+(av?' disabled':'')+'><option value="">— Choisir —</option>'+ctrOptionsHtml(f.ctrId, null)+'</select>'+
          (av? '<p class="hint">Contrat : '+esc(av.ctrNumero||'—')+' (non modifiable après création).</p>' : '<p class="hint">Le numéro de l’avenant reprend celui du contrat (CTR-AAAA-NNNN-AVxx).</p>')+
        '</div>'+
        '<div class="field"><label for="avf-date">Date</label><input type="date" id="avf-date" value="'+esc(f.date||todayISO())+'"></div>'+
      '</div>'+
      '<div class="field"><label for="avf-objet">Objet de l’avenant</label><input id="avf-objet" value="'+esc(f.objet||'')+'" placeholder="ex. Extension de délai, modification du périmètre…"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="avf-montant">Impact montant HT (+/-, optionnel)</label><input type="number" step="any" id="avf-montant" value="'+(f.montantImpact!==undefined?f.montantImpact:'')+'"></div>'+
        '<div class="field"><label for="avf-delai">Impact délai (jours, optionnel)</label><input type="number" step="1" id="avf-delai" value="'+(f.delaiImpactJours!==undefined?f.delaiImpactJours:'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="avf-statut">Statut</label><select id="avf-statut">'+AV_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'brouillon')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '<div class="field"><label for="avf-notes">Notes</label><textarea id="avf-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="avf-save">Enregistrer</button>'
  });

  overlay.querySelector('#avf-save').addEventListener('click', function(){
    var ctrId = av ? av.ctrId : byId('avf-cmd').value;
    if(!ctrId){ toast('Veuillez choisir un contrat', 'danger'); return; }
    var cmd = STATE.ctr.find(function(x){ return x.id===ctrId; });
    var montantVal = byId('avf-montant').value;
    var delaiVal = byId('avf-delai').value;
    var data = {
      ctrId: ctrId, ctrNumero: cmd?cmd.numero:(f.ctrNumero||''), clientId: cmd?cmd.clientId:(f.clientId||''), clientNom: cmd?cmd.clientNom:(f.clientNom||''),
      date: byId('avf-date').value || todayISO(), objet: byId('avf-objet').value.trim(),
      montantImpact: montantVal!==''? Number(montantVal) : 0, delaiImpactJours: delaiVal!==''? Number(delaiVal) : 0,
      statut: byId('avf-statut').value, notes: byId('avf-notes').value.trim()
    };
    saveAV(data, av?av.id:null).then(function(){
      closeModal(); toast('Avenant enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   GESTION DE PROJET D'INGENIERIE - LIVRABLES TECHNIQUES (V1.54)
   Premiere etape (perimetre volontairement restreint, valide avec
   l'utilisateur) : suivi des livrables techniques (plans, notes de calcul,
   rapports...) remis au client pour un contrat donne - designation, type,
   indice de revision, statut, date d'emission, destinataire. Planning/
   avancement, charge de travail par ingenieur et suivi budgetaire sont
   explicitement reportes a de prochaines versions (voir
   claude/module-projets-ingenierie.md).
   Registre independant (collection generique 'livrables', suppression
   physique autorisee comme Clients/Fournisseurs/Personnel) : un livrable
   technique n'entre pas dans le perimetre des 10 documents commerciaux et
   de facturation regis par le CDC de nomenclature/numerotation (devis,
   commande, contrat, avenant, attachement, PFA, facture, avoir,
   encaissement) - pas de numero officiel attribue, pas de regle
   RG-004/005 d'interdiction de suppression.
   ========================================================= */
// Numero sequentiel propre a chaque contrat (jamais remis a zero, jamais
// reutilise - meme mecanisme que avSeq/attSeq, voir nextLocalSeq ci-dessus)
// et code complet a 6 segments (voir livrableCode ci-dessus), calcules par
// l'application : aucune saisie manuelle du code par l'utilisateur (V1.58).
// Un livrable cree avant cette version n'a pas encore de numeroSeq : il lui
// en est attribue un a sa premiere modification suivant la mise a niveau,
// sans avoir besoin d'une migration de donnees dediee.
// V1.60 : historique des indices - une entree est ajoutee chaque fois que
// l'indice de revision change par rapport au dernier connu (y compris a la
// creation). indiceRevision reste le champ "indice courant" (utilise par le
// code calcule et affiche dans les listes) ; historiqueIndices permet de
// retrouver tous les indices successifs. Retro-compatible sans migration :
// un livrable anterieur a cette version n'a pas d'historique, et sa
// premiere modification suivant la mise a niveau initialise l'historique
// avec son indice du moment comme premiere entree.
// V1.63 : budgetHeuresRevision (champ transitoire, voir openLivrableFormModal)
// porte le budget horaire saisi pour la revision COURANTE - s'il s'agit
// d'une nouvelle revision (indice different du dernier connu), il demarre
// l'entree d'historique de cette nouvelle revision ; sinon (meme indice),
// il corrige le budget de la derniere entree deja enregistree, seule
// correction autorisee sur une entree d'historique existante. Retire du
// document final (deja porte par historiqueIndices, pas besoin de le
// dupliquer a la racine).
function withHistoriqueIndices(data, existing){
  var hist = (existing && Array.isArray(existing.historiqueIndices)) ? existing.historiqueIndices.slice() : [];
  var dernier = hist.length ? hist[hist.length-1].indice : null;
  var budget = (typeof data.budgetHeuresRevision === 'number') ? data.budgetHeuresRevision : null;
  if(data.indiceRevision && data.indiceRevision !== dernier){
    hist.push({indice: data.indiceRevision, date: nowISO(), par: currentUserName(), budgetHeures: budget});
  } else if(hist.length){
    hist[hist.length-1] = Object.assign({}, hist[hist.length-1], {budgetHeures: budget});
  }
  data.historiqueIndices = hist;
  delete data.budgetHeuresRevision;
}
function saveLivrable(data, id){
  try { return saveLivrableInterne(data, id); } catch(e){ return Promise.reject(e); }
}
function saveLivrableInterne(data, id){
  function withCode(seq){
    data.numeroSeq = seq;
    // V1.72/V1.73 : utilise la configuration de codification COURANTE du
    // contrat (segments personnalises + ordre choisi) - codeComplet reste
    // ecrit ici a titre de secours (sort, contrat introuvable), mais
    // l'affichage recalcule toujours en direct via livrableCodeDuLivrable
    // (voir plus bas), donc jamais fige si la configuration change ensuite.
    var ctrLiv = projetParId(projetIdDe(data));
    data.codeComplet = livrableCode(data, ctrLiv);
    // V3.50 : un code ne doit exister qu'une seule fois dans un contrat/devis.
    var cle = implCle(data.codeComplet), pid = projetIdDe(data);
    var autre = STATE.livrables.find(function(x){ return x.id!==id && projetIdDe(x)===pid && x.statut!=='annule' && implCle(livrableCodeDuLivrable(x, ctrLiv))===cle; });
    if(autre){ var e = new Error('Le code '+data.codeComplet+' existe déjà dans ce contrat ou devis'); e.codeDoublon = true; throw e; }
  }
  if(id){
    data.updatedAt = nowISO();
    var existing = STATE.livrables.find(function(x){ return x.id===id; });
    withHistoriqueIndices(data, existing);
    if(!data.numeroSeqTexte && existing && existing.numeroSeqTexte) data.numeroSeqTexte = existing.numeroSeqTexte;
    if(existing && existing.numeroSeq){
      withCode(existing.numeroSeq);
      return STATE.db.doc('livrables/'+id).update(data);
    }
    return nextLocalSeq(projetCollection(projetParId(projetIdDe(data))), projetIdDe(data), 'livSeq').then(function(seq){
      withCode(seq);
      return STATE.db.doc('livrables/'+id).update(data);
    });
  }
  data.createdAt = nowISO(); data.creePar = currentUserName();
  withHistoriqueIndices(data, null);
  return nextLocalSeq(projetCollection(projetParId(projetIdDe(data))), projetIdDe(data), 'livSeq').then(function(seq){
    withCode(seq);
    return STATE.db.collection('livrables').add(data);
  });
}

// V2.15 : selection multiple (Livrables techniques et Bordereaux d'envoi) -
// case a cocher par ligne + bouton « Tout selectionner » (tous les elements
// AFFICHES, filtres compris) + suppression groupee. La selection survit aux
// rafraichissements periodiques de l'ecran (objet conserve au niveau du
// module) mais est restreinte a ce qui est affiche : un element masque par
// un filtre n'est jamais supprime sans que l'utilisateur le voie.
// cfg : {sel, ids, canEdit, collection, noun (« livrable »), nounPlural,
// guard(id) -> '' ou motif de blocage (memes regles que la corbeille d'une
// ligne), label(id) -> libelle pour le compte rendu}.
function bulkToolbarHtml(canEdit, count){
  if(!canEdit || !count) return '';
  return '<button type="button" class="btn" id="bulk-selall">Tout sélectionner</button>'+
    '<button type="button" class="btn btn-danger" id="bulk-del" hidden>'+ic('trash',15)+' <span id="bulk-del-label">Supprimer la sélection</span></button>';
}
function bulkHeadCellHtml(canEdit){
  return canEdit ? '<th style="width:28px;"><input type="checkbox" id="bulk-all" title="Tout sélectionner / désélectionner" style="width:auto;"></th>' : '';
}
function bulkRowCellHtml(canEdit, id, sel){
  return canEdit ? '<td><input type="checkbox" class="bulk-chk" data-id="'+id+'" style="width:auto;"'+(sel[id]?' checked':'')+'></td>' : '';
}
function bulkPruneSelection(sel, ids){
  var vis = {}; ids.forEach(function(id){ vis[id] = true; });
  Object.keys(sel).forEach(function(id){ if(!vis[id]) delete sel[id]; });
}
function wireBulkSelection(mount, cfg){
  var btnAll = byId('bulk-selall'), btnDel = byId('bulk-del'), head = byId('bulk-all');
  if(!btnAll && !head) return;
  var checks = Array.prototype.slice.call(mount.querySelectorAll('.bulk-chk'));
  function count(){ return cfg.ids.filter(function(id){ return cfg.sel[id]; }).length; }
  function refresh(){
    var n = count(), all = cfg.ids.length>0 && n===cfg.ids.length;
    checks.forEach(function(c){ c.checked = !!cfg.sel[c.getAttribute('data-id')]; });
    if(head){ head.checked = all; head.indeterminate = n>0 && !all; }
    if(btnAll) btnAll.textContent = all ? 'Tout désélectionner' : 'Tout sélectionner ('+cfg.ids.length+')';
    if(btnDel){
      btnDel.hidden = n===0;
      byId('bulk-del-label').textContent = 'Supprimer la sélection ('+n+')';
    }
  }
  function setAll(v){ cfg.ids.forEach(function(id){ if(v) cfg.sel[id] = true; else delete cfg.sel[id]; }); refresh(); }
  if(btnAll) btnAll.addEventListener('click', function(){ setAll(count()!==cfg.ids.length); });
  if(head) head.addEventListener('change', function(){ setAll(head.checked); });
  checks.forEach(function(c){ c.addEventListener('change', function(){
    var id = c.getAttribute('data-id');
    if(c.checked) cfg.sel[id] = true; else delete cfg.sel[id];
    refresh();
  }); });
  if(btnDel) btnDel.addEventListener('click', function(){
    var ids = cfg.ids.filter(function(id){ return cfg.sel[id]; });
    if(!ids.length) return;
    var bloques = [], ok = [];
    ids.forEach(function(id){ var motif = cfg.guard(id); if(motif) bloques.push({id:id, motif:motif}); else ok.push(id); });
    if(!ok.length){
      toast('Suppression impossible pour les '+ids.length+' '+cfg.nounPlural+' sélectionné(s) : '+bloques[0].motif, 'danger');
      return;
    }
    var msg = 'Supprimer définitivement '+ok.length+' '+(ok.length>1?cfg.nounPlural:cfg.noun)+' ? Cette action est irréversible.'+
      (bloques.length? ' ('+bloques.length+' autre(s) élément(s) de la sélection ne peuvent pas être supprimés et seront ignorés.)' : '');
    confirmDialog(msg, {danger:true, okLabel:'Supprimer '+ok.length+' '+(ok.length>1?cfg.nounPlural:cfg.noun)}).then(function(yes){
      if(!yes) return;
      btnDel.disabled = true;
      var erreurs = 0;
      ok.reduce(function(chain, id){
        return chain.then(function(){
          return deleteDoc(cfg.collection, id).then(function(){ delete cfg.sel[id]; }).catch(function(e){ console.error(e); erreurs++; });
        });
      }, Promise.resolve()).then(function(){
        var done = ok.length - erreurs;
        var txt = done+' '+(done>1?cfg.nounPlural:cfg.noun)+' supprimé(s)';
        if(bloques.length) txt += ' · '+bloques.length+' ignoré(s) ('+bloques[0].motif+')';
        if(erreurs) txt += ' · '+erreurs+' erreur(s)';
        toast(txt, (bloques.length||erreurs) ? 'danger' : 'success');
        btnDel.disabled = false;
      });
    });
  });
  refresh();
}

var livrablesSel = {}; // V2.15 : selection multiple (id -> true)
var livrablesFilter = {q:'', ctrId:'', sortKey:'designation', sortDir:'asc'};
// V2.24 : le Type de document n'est affiche (liste + formulaire) que si le
// segment fixe « Type de document » fait partie du code du contrat.
function typeDansCodeContrat(ctr){
  if(!ctr) return true;
  var liste = (Array.isArray(ctr.codificationSegments) && ctr.codificationSegments.length) ? ctr.codificationSegments : CODIFICATION_SEGMENTS_DEFAUT;
  return liste.indexOf('type')>=0;
}
// V3.02 : elements (livrables, bordereaux, lignes de planning et de timesheet) lies a un devis.
function elementsDuDevis(devisId){
  return {
    livrables: (STATE.livrables||[]).filter(function(x){ return x.devisId===devisId; }),
    bordereaux: (STATE.bordereaux||[]).filter(function(x){ return x.devisId===devisId; }),
    plan: (STATE.planificationLignes||[]).filter(function(x){ return x.devisId===devisId; }),
    pointage: (STATE.timesheetLignes||[]).filter(function(x){ return x.devisId===devisId; })
  };
}
// Rattachement propose pour le projet affiche : un contrat cree depuis un devis qui porte encore des elements.
function rattachementPropose(projet){
  if(!projet) return null;
  var devis = null, contrat = null;
  if(projetEstDevis(projet)){
    devis = projet; contrat = STATE.ctr.find(function(c){ return c.devisId===projet.id && c.statut!=='annule'; }) || null;
  } else if(projet.devisId){
    contrat = projet; devis = (STATE.devis||[]).find(function(d){ return d.id===projet.devisId; }) || null;
  }
  if(!devis || !contrat) return null;
  var el = elementsDuDevis(devis.id);
  var n = el.livrables.length + el.bordereaux.length + el.plan.length + el.pointage.length;
  return n ? {devis: devis, contrat: contrat, elements: el, n: n} : null;
}
function rattachementBandeauHtml(projet, canEdit){
  var pr = rattachementPropose(projet);
  if(!pr) return '';
  return '<div class="card card-pad" style="margin:0 0 12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'+
    '<div style="flex:1;min-width:260px;font-size:13px;">Le devis <b>'+esc(pr.devis.numero)+(pr.devis.revision?' rév. '+esc(pr.devis.revision):'')+'</b> est devenu le contrat <b>'+esc(pr.contrat.numero)+'</b>. '+
      pr.elements.livrables.length+' livrable(s), '+pr.elements.bordereaux.length+' bordereau(x) et '+(pr.elements.plan.length+pr.elements.pointage.length)+' ligne(s) de planning/timesheet sont encore liés au devis.</div>'+
    (canEdit ? '<button type="button" class="btn btn-accent" id="btn-rattacher-ctr">Rattacher au contrat '+esc(pr.contrat.numero)+'</button>' : '')+
  '</div>';
}
// Fusionne la configuration de codification du devis dans celle du contrat (celle du contrat l'emporte).
function configCodificationFusionnee(devis, contrat){
  var cfg = {};
  var contratVide = !(Array.isArray(contrat.segmentsPersonnalises) && contrat.segmentsPersonnalises.length) &&
                    !(Array.isArray(contrat.codificationSegments) && contrat.codificationSegments.length);
  if(contratVide){
    ['segmentsPersonnalises','codificationSegments','segmentsFixesRetires'].forEach(function(k){
      if(devis[k] !== undefined) cfg[k] = JSON.parse(JSON.stringify(devis[k]));
    });
    if(devis.segmentsAutoDepuisReferenceClient !== undefined) cfg.segmentsAutoDepuisReferenceClient = !!devis.segmentsAutoDepuisReferenceClient;
  }
  // destinataires : union par identifiant (les bordereaux gardent ainsi leur destinataire)
  var dest = (contrat.destinataires||[]).slice(), ids = {};
  dest.forEach(function(d){ ids[d.id] = true; });
  (devis.destinataires||[]).forEach(function(d){ if(!ids[d.id]){ dest.push(d); ids[d.id] = true; } });
  if(dest.length !== (contrat.destinataires||[]).length) cfg.destinataires = dest;
  // codes de retour client : ceux du contrat l'emportent
  var codes = Object.assign({}, devis.codesRetourClient||{}, contrat.codesRetourClient||{});
  if(Object.keys(codes).length !== Object.keys(contrat.codesRetourClient||{}).length) cfg.codesRetourClient = codes;
  return {cfg: cfg, copie: contratVide};
}
function rattacherDevisAuContrat(devis, contrat){
  var el = elementsDuDevis(devis.id);
  var fusion = configCodificationFusionnee(devis, contrat);
  confirmDialog(
    'Rattacher au contrat '+contrat.numero+' : '+el.livrables.length+' livrable(s), '+el.bordereaux.length+' bordereau(x), '+(el.plan.length+el.pointage.length)+' ligne(s) de planning/timesheet du devis '+devis.numero+'.\n\n'+
    'Les livrables sont renumérotés à la suite de ceux du contrat et leur code est recalculé avec le contrat. '+
    (fusion.copie ? 'La configuration de codification du devis (segments, ordre du code) est reprise par le contrat, qui n’en avait pas. ' : 'La configuration de codification du contrat est conservée. ')+
    'Les numéros de bordereaux déjà établis ne changent pas. Continuer ?',
    {okLabel:'Rattacher au contrat'}
  ).then(function(ok){
    if(!ok) return;
    var lien = champsProjet(contrat);
    var origine = {devisOrigineNumero: devis.numero};
    var ctrMaj = Object.assign({}, contrat, fusion.cfg);
    var chaine = Promise.resolve();
    if(Object.keys(fusion.cfg).length){
      chaine = chaine.then(function(){ return STATE.db.doc('contrats/'+contrat.id).update(Object.assign({updatedAt: nowISO()}, fusion.cfg)); });
    }
    // livrables : dans l'ordre de leur numero, a la suite des numeros du contrat
    el.livrables.slice().sort(function(a,b){ return (a.numeroSeq||0)-(b.numeroSeq||0); }).forEach(function(l){
      chaine = chaine.then(function(){ return nextLocalSeq('contrats', contrat.id, 'livSeq'); }).then(function(seq){
        var maj = Object.assign({}, lien, origine, {numeroSeq: seq, updatedAt: nowISO()});
        maj.codeComplet = livrableCode(Object.assign({}, l, maj), ctrMaj);
        return STATE.db.doc('livrables/'+l.id).update(maj);
      });
    });
    el.bordereaux.forEach(function(b){ chaine = chaine.then(function(){ return STATE.db.doc('bordereaux/'+b.id).update(Object.assign({}, lien, origine, {clientId: contrat.clientId||b.clientId, clientNom: contrat.clientNom||b.clientNom, updatedAt: nowISO()})); }); });
    el.plan.forEach(function(x){ chaine = chaine.then(function(){ return STATE.db.doc('planificationLignes/'+x.id).update(Object.assign({}, lien, origine, {updatedAt: nowISO()})); }); });
    el.pointage.forEach(function(x){ chaine = chaine.then(function(){ return STATE.db.doc('timesheetLignes/'+x.id).update(Object.assign({}, lien, origine, {updatedAt: nowISO()})); }); });
    chaine.then(function(){
      livrablesFilter.ctrId = contrat.id;
      toast('Éléments rattachés au contrat '+contrat.numero, 'success');
    }).catch(function(e){ console.error(e); toast('Erreur pendant le rattachement : '+(e&&e.message||e), 'danger'); });
  });
}
function livrablesCmp(a, b){ return String(a).localeCompare(String(b), 'fr', {numeric:true, sensitivity:'base'}); }
function renderLivrables(mount, actions){
  var canEdit = canWrite('livrables');
  // V2.01 : le filtre par contrat n'offre plus "Tous les contrats" (demande
  // explicite de l'utilisateur) - un contrat precis est desormais toujours
  // selectionne. Si aucun n'est encore choisi (premiere ouverture de
  // l'ecran, ou contrat precedemment choisi disparu/filtre reinitialise),
  // on preselectionne automatiquement le plus RECENT (meme tri que la
  // liste du menu deroulant juste en dessous : numero decroissant).
  // V3.02 : la liste propose aussi les devis (marche pas encore gagne), apres les contrats.
  var ctrsTries = projetsTries();
  if((!livrablesFilter.ctrId || !ctrsTries.some(function(c){ return c.id===livrablesFilter.ctrId; })) && ctrsTries.length){
    livrablesFilter.ctrId = ctrsTries[0].id;
  }
  // V2.16 : export / import Excel avec listes deroulantes (voir
  // static/js/excel-listes.js) - l'export est ouvert a tous ceux qui voient
  // l'ecran, l'import seulement a ceux qui peuvent modifier les livrables.
  actions.innerHTML = (canEdit ? '<button type="button" class="btn btn-primary" id="btn-new-livrable">'+ic('plus',15)+' Nouveau livrable</button>' : '')+
    '<button type="button" class="btn" id="btn-export-livrables-xl" title="Fichier Excel avec listes déroulantes (Zone, Statut, Type…)">'+ic('download',15)+' Exporter Excel</button>'+
    (canEdit ? '<button type="button" class="btn" id="btn-import-livrables-xl" title="Importer un fichier Excel exporté puis corrigé/complété">'+ic('upload',15)+' Importer un Excel</button>'+
      // V1.66 : import du registre depuis un classeur Excel reel ("Liste de
      // suivi des livrables") - voir openImportLivrablesExcelModal().
      '<button type="button" class="btn" id="btn-import-livrables-excel" title="Importer le registre « Liste de suivi des livrables » fourni par le client">'+ic('upload',15)+' Importer depuis Excel</button>' : '');
  if(canEdit){
    byId('btn-new-livrable').addEventListener('click', function(){ openLivrableFormModal(null); });
    byId('btn-import-livrables-excel').addEventListener('click', openImportLivrablesExcelModal);
    byId('btn-import-livrables-xl').addEventListener('click', function(){ xlOpenImportModal('livrables'); });
  }
  byId('btn-export-livrables-xl').addEventListener('click', function(){ xlOpenExportModal('livrables'); });
  var list = STATE.livrables.filter(function(l){
    // Filtre par contrat (dropdown ci-dessous, un contrat precis toujours
    // selectionne depuis la V2.01 - voir plus haut) - meme esprit que le
    // filtre du Plan de charge (planChargeFiltre.ctrId, V1.65).
    if(livrablesFilter.ctrId && projetIdDe(l)!==livrablesFilter.ctrId) return false;
    if(livrablesFilter.q){
      var q = livrablesFilter.q.toLowerCase();
      var ctrQ = projetParId(projetIdDe(l));
      if((l.designation||'').toLowerCase().indexOf(q)<0 && projetNumeroDe(l).toLowerCase().indexOf(q)<0 &&
         (l.clientNom||'').toLowerCase().indexOf(q)<0 && (l.destinataire||'').toLowerCase().indexOf(q)<0 &&
         (l.categorie||'').toLowerCase().indexOf(q)<0 && livrableCodeDuLivrable(l, ctrQ).toLowerCase().indexOf(q)<0 &&
         (l.referenceClient||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  });
  // V2.24 : tri par colonne (Code, Designation, Numero, Indice) - tri
  // « naturel » (606100 avant 606110, 2 avant 10).
  var ctrListe = projetParId(livrablesFilter.ctrId);
  var avecType = typeDansCodeContrat(ctrListe);
  var tris = {
    code: function(l){ return livrableCodeDuLivrable(l, projetParId(projetIdDe(l))); },
    designation: function(l){ return l.designation||''; },
    num: function(l){ return codeCompletIncrement(l); },
    indice: function(l){ return l.indiceRevision||''; }
  };
  var getTri = tris[livrablesFilter.sortKey] || tris.designation, mulTri = livrablesFilter.sortDir==='desc' ? -1 : 1;
  list.sort(function(a,b){
    var c = livrablesCmp(getTri(a), getTri(b))*mulTri;
    return c!==0 ? c : livrablesCmp(a.designation||'', b.designation||'');
  });

  // V2.01 : aucun contrat du tout en base - le filtre par contrat n'a plus
  // de sens (il n'y a rien a choisir), et "Tous les contrats" n'existe
  // plus pour afficher quand meme un melange vide. On remplace tout
  // l'ecran par un message dedie plutot que par un menu deroulant vide.
  if(!ctrsTries.length){
    mount.innerHTML = '<div class="section-head"><div class="toolbar"><span class="muted" style="font-size:12.5px;">0 livrable(s)</span></div></div>'+
      emptyState('folder', 'Aucun contrat ni devis enregistré pour le moment. Un livrable technique se rattache à un contrat (marché gagné) ou à un devis (marché pas encore gagné) : créez d’abord l’un des deux avant de pouvoir saisir ses livrables.', '');
    return;
  }

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="livrables-search" placeholder="Code, désignation, catégorie ou destinataire…" value="'+esc(livrablesFilter.q)+'">'+
      // V2.01 : "Tous les contrats" retire du menu deroulant (demande
      // explicite de l'utilisateur) - un contrat precis est toujours
      // selectionne (voir preselection automatique en tete de fonction).
      '<select id="livrables-filtre-ctr">'+
        projetsOptionsHtml(livrablesFilter.ctrId, null, '', true)+
      '</select>'+
      // V1.73 : le configurateur de codification (deplace depuis la fiche
      // Contrat, voir openCodificationLivrablesModal) agit forcement sur UN
      // contrat precis - toujours actif depuis la V2.01 puisqu'un contrat
      // est desormais toujours selectionne.
      '<button type="button" class="btn" id="btn-codif-livrables"'+(canEdit?'':' disabled')+' title="Configurer la codification des livrables de ce contrat ou de ce devis">'+ic('gear',15)+' Codification</button>'+
      bulkToolbarHtml(canEdit, list.length)+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' livrable(s)</span>'+
    '</div></div>'+
    rattachementBandeauHtml(projetParId(livrablesFilter.ctrId), canEdit)+
    '<p class="hint" style="margin:-4px 0 12px;">Suivi des livrables techniques (plans, notes de calcul, rapports…) remis au client pour un contrat donné (avancement et suivi budgétaire horaire depuis la V1.63). Depuis la V1.65, chaque livrable peut aussi être affecté à une ou plusieurs personnes avec des dates planifiées — concerne uniquement la révision courante, voir le menu « Planning » pour la charge de travail jour par jour qui en découle.</p>';

  if(!STATE.livrables.length){
    body += emptyState('folder', 'Aucun livrable technique enregistré pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-livrable">'+ic('plus',15)+' Créer un livrable</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun livrable ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr>'+bulkHeadCellHtml(canEdit)+sortThHtml(livrablesFilter,'code','Code')+sortThHtml(livrablesFilter,'designation','Désignation')+(avecType?'<th>Type</th>':'')+sortThHtml(livrablesFilter,'num','Numéro')+sortThHtml(livrablesFilter,'indice','Indice')+'<th>Statut</th><th>Avancement</th><th>Planification</th><th>Émission</th><th>Dernier envoi</th><th></th></tr></thead><tbody>'+
      list.map(function(l){
        var sm = statutMeta(LIVRABLE_STATUTS, l.statut);
        var annule = l.statut==='annule';
        // V1.72 : code recalcule en direct (voir livrableCodeDuLivrable) a
        // partir de la configuration COURANTE du contrat - jamais fige,
        // meme si cette configuration a change depuis l'enregistrement du
        // livrable.
        var ctrLiv = projetParId(projetIdDe(l));
        var codeLive = livrableCodeDuLivrable(l, ctrLiv);
        // V1.60 : "dernier envoi" remplace l'ancien champ libre "Destinataire"
        // dans cette colonne - calcule depuis les bordereaux reellement
        // emis (voir dernierEnvoiLivrable), plus fiable qu'une saisie libre.
        var env = dernierEnvoiLivrable(l.id);
        var envHtml = env ? (esc(env.destNom)+' <span class="muted">— '+esc(env.indice)+' · '+esc(statutMeta(BORDEREAU_ETATS, env.etat).label)+'</span>') : '<span class="muted">—</span>';
        // V1.63 : avancement (%) lu sur le statut du livrable - "—" si ce
        // statut n'a pas de pourcentage defini (As built accepte/propose,
        // Bloquee, Annule).
        var av = livrableAvancement(l);
        var avHtml = (av===null) ? '<span class="muted">—</span>' : (av+'%');
        // V1.65 : personnes affectees + dates planifiees de la REVISION
        // COURANTE uniquement (pas d'historique) - champ informatif sur la
        // fiche du livrable, independant du module de planification
        // manuelle (menu "Plan de charge", V1.70).
        var planHtml;
        if(l.datePlanifieeDebut && l.datePlanifieeFin){
          planHtml = fmtDate(l.datePlanifieeDebut)+' → '+fmtDate(l.datePlanifieeFin);
          if(Array.isArray(l.affectations) && l.affectations.length){
            planHtml += '<div class="muted" style="font-size:11px;">'+l.affectations.map(function(p){ return esc(p.nom); }).join(', ')+'</div>';
          }
        } else { planHtml = '<span class="muted">—</span>'; }
        return '<tr>'+
          bulkRowCellHtml(canEdit, l.id, livrablesSel)+
          // V2.24 : code COMPLET (recalcule en direct) a la place des anciennes
          // colonnes Contrat/Client ; la reference client n'est rappelee en
          // dessous que si elle differe du code (ex. colonne Code projet
          // different du code importe).
          '<td class="num" style="font-size:12px;white-space:nowrap;" title="'+esc(codeLive)+'">'+esc(codeLive)+'</td>'+
          '<td><b>'+esc(l.designation)+'</b>'+(l.categorie?'<div class="muted" style="font-size:11px;">'+esc(l.categorie)+'</div>':'')+'</td>'+
          (avecType ? '<td class="muted">'+esc(l.typeDocument||'—')+'</td>' : '')+
          '<td class="num">'+esc(codeCompletIncrement(l))+'</td>'+
          '<td class="num">'+esc(l.indiceRevision||'—')+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'" title="'+esc(sm.label)+'">'+esc(sm.id.toUpperCase())+'</span></td>'+
          '<td class="num">'+avHtml+'</td>'+
          '<td style="font-size:12px;">'+planHtml+'</td>'+
          '<td class="muted">'+(l.dateEmission?fmtDate(l.dateEmission):'—')+'</td>'+
          '<td style="font-size:12px;">'+envHtml+'</td>'+
          '<td><div class="row-actions">'+
            // V1.60 : "Historique" (lecture seule) est toujours visible, y
            // compris pour un livrable annulé (sinon son historique
            // deviendrait inconsultable une fois verrouillé) - Modifier et
            // Annuler restent conditionnes comme avant.
            '<button type="button" class="iconbtn" data-hist="'+l.id+'" title="Historique des indices">'+ic('journal',15)+'</button>'+
            (canEdit && !annule? '<button type="button" class="iconbtn" data-edit="'+l.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-cancel="'+l.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
            // V2.01 : suppression DEFINITIVE demandee explicitement par
            // l'utilisateur, en plus de l'annulation (V1.58) deja existante
            // - a la difference de celle-ci, disponible meme sur un
            // livrable deja annule (c'est justement le moyen de nettoyer un
            // livrable annule par erreur). Bloquee s'il a deja ete transmis
            // via un bordereau (voir le gestionnaire de clic plus bas) pour
            // ne jamais casser l'historique des envois.
            (canEdit? '<button type="button" class="iconbtn" data-delete="'+l.id+'" title="Supprimer définitivement">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  bulkPruneSelection(livrablesSel, list.map(function(l){ return l.id; }));
  mount.innerHTML = body;
  wireBulkSelection(mount, {
    sel: livrablesSel, ids: list.map(function(l){ return l.id; }), canEdit: canEdit, collection: 'livrables',
    noun: 'livrable', nounPlural: 'livrables',
    // Meme regle que la corbeille d'une ligne (V2.01) : un livrable deja
    // transmis par bordereau reste dans l'historique des envois.
    guard: function(id){
      var lie = (STATE.bordereaux||[]).some(function(bd){ return (bd.lignes||[]).some(function(ln){ return ln.livId===id; }); });
      return lie ? 'déjà transmis via un bordereau (Carnet d’envois)' : '';
    }
  });

  mount.querySelectorAll('[data-hist]').forEach(function(b){ b.addEventListener('click', function(){
    openLivrableHistoriqueModal(STATE.livrables.find(function(l){ return l.id===b.getAttribute('data-hist'); }));
  }); });

  wireSortHeaders(mount, livrablesFilter, renderLivrables, mount, actions);
  var s1 = byId('livrables-search');
  if(s1) s1.addEventListener('input', debounce(function(){ livrablesFilter.q = s1.value; renderLivrables(mount, actions); s1.focus(); s1.setSelectionRange(s1.value.length, s1.value.length); }, 220));
  var fc1 = byId('livrables-filtre-ctr');
  if(fc1) fc1.addEventListener('change', function(){ livrablesFilter.ctrId = fc1.value; renderLivrables(mount, actions); });
  var brt = byId('btn-rattacher-ctr');
  if(brt) brt.addEventListener('click', function(){
    var pr = rattachementPropose(projetParId(livrablesFilter.ctrId));
    if(pr) rattacherDevisAuContrat(pr.devis, pr.contrat);
  });
  var bc1 = byId('btn-codif-livrables');
  if(bc1) bc1.addEventListener('click', function(){
    var ctrSel = projetParId(livrablesFilter.ctrId);
    if(ctrSel) openCodificationLivrablesModal(ctrSel);
  });
  var eb = byId('empty-new-livrable'); if(eb) eb.addEventListener('click', function(){ openLivrableFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openLivrableFormModal(STATE.livrables.find(function(l){ return l.id===b.getAttribute('data-edit'); }));
  }); });
  // V1.58 : la codification formelle rapproche les livrables de la
  // discipline documentaire du CDC de nomenclature - un livrable n'est plus
  // supprime physiquement, il est annule (cancelDoc(), comme pour les
  // contrats/avenants/attachements), et reste visible dans l'historique.
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler ce livrable ? Il restera visible avec le statut « Annulé » (aucune suppression physique) et ne pourra plus être modifié.', {danger:true, okLabel:'Annuler le livrable'}).then(function(ok){
      if(!ok) return;
      cancelDoc('livrables', id, 'statut', 'annule').then(function(){ toast('Livrable annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  // V2.01 : suppression definitive (demande explicite de l'utilisateur,
  // en plus de l'annulation ci-dessus). Bloquee si ce livrable a deja ete
  // transmis via un bordereau (STATE.bordereaux[].lignes[].livId) - sinon
  // l'historique des envois (ecran Carnet d'envois) ferait reference a un
  // livrable qui n'existe plus. Choix confirme par l'utilisateur : bloquer
  // plutot que supprimer quand meme ou orphelin.
  mount.querySelectorAll('[data-delete]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete');
    var lie = (STATE.bordereaux||[]).some(function(bd){
      return (bd.lignes||[]).some(function(ln){ return ln.livId===id; });
    });
    if(lie){
      toast('Suppression impossible : ce livrable a déjà été transmis via un bordereau (Carnet d’envois). Il doit rester dans l’historique des envois.', 'danger');
      return;
    }
    confirmDialog('Supprimer définitivement ce livrable ? Contrairement à « Annuler », cette action est irréversible : aucune trace ne sera conservée.', {danger:true, okLabel:'Supprimer définitivement'}).then(function(ok){
      if(!ok) return;
      deleteDoc('livrables', id).then(function(){ toast('Livrable supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

// V1.73 : configurateur de codification, PROPRE A UN CONTRAT, ouvert depuis
// le bouton "Codification" de l'ecran "Livrables techniques" (voir
// renderLivrables) plutot que depuis la fiche Contrat (V1.72). Permet en
// plus de creer/renommer/supprimer des SEGMENTS PERSONNALISES (nom libre +
// liste de valeurs libre), au-dela des 4 segments fixes (numero de
// contrat, type de document, numero sequentiel, indice) - Zone/Niveau/
// Discipline ne sont plus des axes imposes : un contrat qui n'a encore
// rien personnalise affiche leur ancien format (V1.58-V1.72) comme simple
// point de depart, modifiable comme n'importe quel autre segment.
function openCodificationLivrablesModal(ctr){
  if(!ctr) return;
  // Copie de travail locale (aucune ecriture tant que "Enregistrer" n'est
  // pas clique) - segsPerso porte {id, nom, valeurs:[...]}.
  var segsPerso = segmentsPersonnalisesDuContrat(ctr).map(function(s){ return {id:s.id, nom:s.nom, valeurs:s.valeurs.slice()}; });
  var catalogueById = {};
  var fixesRetires = (Array.isArray(ctr.segmentsFixesRetires) ? ctr.segmentsFixesRetires : []).slice();
  function refreshCatalogue(){
    catalogueById = {};
    CODIFICATION_SEGMENTS_FIXES.forEach(function(s){ if(fixesRetires.indexOf(s.id)<0) catalogueById[s.id] = s; });
    segsPerso.forEach(function(s){ catalogueById[s.id] = {id:s.id, label:s.nom||'(sans nom)'}; });
  }
  refreshCatalogue();

  // Etat local de l'ordre complet (fixes + personnalises) et de l'inclusion
  // - meme principe que le configurateur V1.72, mais le catalogue peut
  // maintenant changer en cours d'edition (ajout/suppression de segment) :
  // codifOrder/codifIncluded sont donc tenus a jour explicitement a chaque
  // ajout/suppression, plutot que recalcules a chaque rendu.
  var codifSauve = (Array.isArray(ctr.codificationSegments) && ctr.codificationSegments.length) ? ctr.codificationSegments.slice() : CODIFICATION_SEGMENTS_DEFAUT.slice();
  var codifOrder = codifSauve.filter(function(id){ return catalogueById[id]; });
  Object.keys(catalogueById).forEach(function(id){ if(codifOrder.indexOf(id)<0) codifOrder.push(id); });
  var codifIncluded = codifSauve.filter(function(id){ return catalogueById[id]; });

  var overlay = openModal({
    title: 'Codification des livrables — contrat '+ctr.numero,
    large: true,
    body:
      '<p class="hint" style="margin-top:0;">Propre à ce contrat. Créez les segments qui composeront le code de ses livrables (ex. « Bâtiment », « Lot », « Phase »…), chacun avec son propre nom et sa propre liste de valeurs, puis choisissez ci-dessous lesquels entrent dans le code et dans quel ordre. Un changement s’applique immédiatement à tous les livrables de ce contrat, même ceux déjà codifiés — rien n’est bloqué si vous renommez ou retirez un segment ou une valeur déjà utilisée.</p>'+
      // V2.17 : export / import Excel de la codification (excel-listes.js) -
      // agit sur la configuration ENREGISTREE du contrat, pas sur les
      // modifications non enregistrees de cette fenetre.
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 0;">'+
        '<button type="button" class="btn" id="clm-export-xl" title="Fichier Excel : un segment par colonne + composition du code">'+ic('download',15)+' Exporter Excel</button>'+
        '<button type="button" class="btn" id="clm-import-xl" title="Importer une codification depuis un fichier Excel (relecture avant enregistrement)">'+ic('upload',15)+' Importer Excel</button>'+
      '</div>'+
      '<h4 style="margin:14px 0 6px;font-size:13px;">Segments personnalisés de ce contrat</h4>'+
      '<div id="clm-segments-list"></div>'+
      '<button type="button" class="btn" id="clm-add-segment" style="margin-top:4px;">'+ic('plus',14)+' Ajouter un segment</button>'+
      // V1.82 : case facultative — demande explicite de l'utilisateur
      // d'adopter, pour un contrat donne (typiquement un contrat dont les
      // livrables ont ete importes avec une reference client deja
      // codifiee selon la methodologie du client, voir V1.66), cette
      // methodologie plutot que de ressaisir les segments a la main. Ne
      // fait jamais que LIRE referenceClient en direct (voir
      // livrableSegmentValeur) — aucune ecriture, aucune migration,
      // reversible a tout moment en decochant la case.
      '<div class="field" style="margin-top:10px;">'+
        '<label style="display:flex;align-items:flex-start;gap:8px;font-weight:400;">'+
          '<input type="checkbox" id="clm-ref-client-auto" style="width:auto;margin-top:3px;"'+(ctr.segmentsAutoDepuisReferenceClient?' checked':'')+'>'+
          '<span>Récupérer automatiquement les valeurs des segments depuis la « Référence / code client » de chaque livrable, quand elle suit exactement le même nombre de segments que ci-dessus (ex. référence importée « QW2245-000-00-SOG-24925024-EL-C102-00035 » → 8 segments). Ne touche à rien en base : recalculé à chaque affichage, pour les livrables déjà importés comme pour les futurs.</span>'+
        '</label>'+
      '</div>'+
      '<h4 style="margin:18px 0 6px;font-size:13px;">Composition du code</h4>'+
      '<p class="hint" style="margin:0 0 6px;">Cochez les segments à inclure, et utilisez les flèches pour choisir leur ordre. Chaque segment, y compris les segments fixes (numéro de contrat, type de document, numéro séquentiel, indice), peut être coché ou non, déplacé, ou <strong>supprimé</strong> de la liste avec la croix ; un segment fixe supprimé peut être rétabli. Le numéro séquentiel est modifiable livrable par livrable (champ « Numéro séquentiel » du formulaire) ; sans lui dans le code, deux livrables peuvent avoir un code identique.</p>'+
      '<div id="clm-codif-list"></div>'+
      '<div id="clm-fixes-retires" style="margin-top:6px;"></div>'+
      '<p class="hint" style="margin:8px 0 0;">Exemple de code obtenu avec cette composition : <code id="clm-codif-preview" style="font-weight:600;">—</code></p>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="clm-save">Enregistrer</button>'
  });

  byId('clm-export-xl').addEventListener('click', function(){ xlExportCodification(ctr); });
  byId('clm-import-xl').addEventListener('click', function(){ xlOpenImportCodification(ctr); });

  function renderSegmentsList(){
    byId('clm-segments-list').innerHTML = segsPerso.length ? segsPerso.map(function(s, idx){
      return '<div class="field-row" style="display:flex;align-items:flex-end;gap:8px;margin-bottom:4px;">'+
        '<div class="field" style="margin:0;flex:1;"><label>Nom du segment</label><input class="clm-seg-nom" data-idx="'+idx+'" value="'+esc(s.nom)+'" placeholder="ex. Bâtiment"></div>'+
        '<div class="field" style="margin:0;flex:2;"><label>Valeurs (séparées par des virgules)</label><input class="clm-seg-valeurs" data-idx="'+idx+'" value="'+esc(s.valeurs.join(', '))+'" placeholder="ex. Bâtiment A, Bâtiment B, Général"></div>'+
        '<button type="button" class="iconbtn clm-seg-del" data-idx="'+idx+'" title="Supprimer ce segment" style="margin-bottom:8px;">'+ic('x',15)+'</button>'+
      '</div>';
    }).join('') : '<p class="hint" style="margin:0;">Aucun segment personnalisé pour l’instant — « Zone », « Niveau » et « Discipline » (format par défaut depuis la V1.58) sont utilisés ci-dessous tant qu’aucun n’est créé ici.</p>';

    byId('clm-segments-list').querySelectorAll('.clm-seg-nom').forEach(function(inp){
      inp.addEventListener('input', function(){
        segsPerso[Number(inp.getAttribute('data-idx'))].nom = inp.value;
        refreshCatalogue(); renderCodifList(); renderCodifPreview();
      });
    });
    byId('clm-segments-list').querySelectorAll('.clm-seg-valeurs').forEach(function(inp){
      inp.addEventListener('input', function(){
        segsPerso[Number(inp.getAttribute('data-idx'))].valeurs = inp.value.split(',').map(function(v){ return v.trim(); }).filter(function(v){ return v; });
        renderCodifPreview();
      });
    });
    byId('clm-segments-list').querySelectorAll('.clm-seg-del').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = Number(btn.getAttribute('data-idx'));
        var removedId = segsPerso[idx].id;
        segsPerso.splice(idx, 1);
        // V1.73 : retirer un segment ne bloque rien - voir la decision
        // explicite de l'utilisateur ("rien de bloque et les anciennes
        // codifications reprennent la nouvelle facon de codifier") ; les
        // livrables qui portaient deja une valeur pour ce segment la
        // gardent en memoire (segmentsValeurs), simplement inutilisee tant
        // que le segment n'existe plus dans la composition.
        codifOrder = codifOrder.filter(function(id){ return id!==removedId; });
        codifIncluded = codifIncluded.filter(function(id){ return id!==removedId; });
        refreshCatalogue();
        renderSegmentsList(); renderCodifList(); renderCodifPreview();
      });
    });
  }

  byId('clm-add-segment').addEventListener('click', function(){
    var newId = 'seg'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    segsPerso.push({id:newId, nom:'', valeurs:[]});
    codifOrder.push(newId);
    codifIncluded.push(newId); // coche par defaut, comme les segments existants
    refreshCatalogue();
    renderSegmentsList(); renderCodifList(); renderCodifPreview();
  });

  function codifSelectionnes(){
    return codifOrder.filter(function(id){ return codifIncluded.indexOf(id)>=0; });
  }
  function renderCodifPreview(){
    var exempleVals = {};
    segsPerso.forEach(function(s){ exempleVals[s.id] = s.valeurs[0] || s.nom || '—'; });
    var draft = {ctrNumero: ctr.numero, typeDocument:'Plan', numeroSeq:1, indiceRevision:'A', segmentsValeurs: exempleVals};
    var sel = codifSelectionnes();
    var ctrDraft = {numero: ctr.numero, codificationSegments: sel};
    byId('clm-codif-preview').textContent = sel.length ? livrableCode(draft, ctrDraft) : '—';
  }
  function renderCodifList(){
    byId('clm-codif-list').innerHTML = codifOrder.map(function(segId, idx){
      var seg = catalogueById[segId];
      if(!seg) return '';
      var checked = codifIncluded.indexOf(segId)>=0;
      var isFixe = CODIFICATION_SEGMENTS_FIXES.some(function(f){ return f.id===segId; });
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);">'+
        '<input type="checkbox" class="clm-codif-chk" data-seg="'+segId+'"'+(checked?' checked':'')+' style="width:auto;">'+
        '<span style="flex:1;font-size:13px;">'+esc(seg.label)+(isFixe?' <span class="muted" style="font-size:11px;">(segment fixe)</span>':'')+'</span>'+
        (isFixe ? '<button type="button" class="iconbtn clm-codif-del" data-seg="'+segId+'" title="Supprimer ce segment de la liste (rétablissable)">'+ic('x',14)+'</button>' : '')+
        '<button type="button" class="iconbtn clm-codif-up" data-idx="'+idx+'" title="Monter"'+(idx===0?' disabled':'')+'>'+ic('arrowup',14)+'</button>'+
        '<button type="button" class="iconbtn clm-codif-down" data-idx="'+idx+'" title="Descendre" style="transform:rotate(180deg);"'+(idx===codifOrder.length-1?' disabled':'')+'>'+ic('arrowup',14)+'</button>'+
      '</div>';
    }).join('');
    var rb = byId('clm-fixes-retires');
    if(rb){
      rb.innerHTML = fixesRetires.length ? '<span class="hint" style="margin-right:8px;">Segments fixes supprimés :</span><select id="clm-fixe-restore"><option value="">— Rétablir… —</option>'+
        fixesRetires.map(function(id){ var f = CODIFICATION_SEGMENTS_FIXES.find(function(x){ return x.id===id; }); return '<option value="'+id+'">'+esc(f?f.label:id)+'</option>'; }).join('')+'</select>' : '';
      var rs = byId('clm-fixe-restore');
      if(rs) rs.addEventListener('change', function(){
        var id = rs.value; if(!id) return;
        fixesRetires = fixesRetires.filter(function(x){ return x!==id; });
        refreshCatalogue();
        if(codifOrder.indexOf(id)<0) codifOrder.push(id);
        if(codifIncluded.indexOf(id)<0) codifIncluded.push(id);
        renderCodifList(); renderCodifPreview();
      });
    }
    byId('clm-codif-list').querySelectorAll('.clm-codif-chk').forEach(function(chk){
      chk.addEventListener('change', function(){
        var segId = chk.getAttribute('data-seg');
        if(chk.checked){ if(codifIncluded.indexOf(segId)<0) codifIncluded.push(segId); }
        else { codifIncluded = codifIncluded.filter(function(id){ return id!==segId; }); }
        renderCodifPreview();
      });
    });
    byId('clm-codif-list').querySelectorAll('.clm-codif-del').forEach(function(btn){
      btn.addEventListener('click', function(){
        var segId = btn.getAttribute('data-seg');
        if(fixesRetires.indexOf(segId)<0) fixesRetires.push(segId);
        codifOrder = codifOrder.filter(function(id){ return id!==segId; });
        codifIncluded = codifIncluded.filter(function(id){ return id!==segId; });
        refreshCatalogue(); renderCodifList(); renderCodifPreview();
      });
    });
    byId('clm-codif-list').querySelectorAll('.clm-codif-up').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = Number(btn.getAttribute('data-idx'));
        if(idx<=0) return;
        var tmp = codifOrder[idx-1]; codifOrder[idx-1] = codifOrder[idx]; codifOrder[idx] = tmp;
        renderCodifList(); renderCodifPreview();
      });
    });
    byId('clm-codif-list').querySelectorAll('.clm-codif-down').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = Number(btn.getAttribute('data-idx'));
        if(idx>=codifOrder.length-1) return;
        var tmp = codifOrder[idx+1]; codifOrder[idx+1] = codifOrder[idx]; codifOrder[idx] = tmp;
        renderCodifList(); renderCodifPreview();
      });
    });
  }
  renderSegmentsList();
  renderCodifList();
  renderCodifPreview();

  overlay.querySelector('#clm-save').addEventListener('click', function(){
    // Ignore silencieusement les segments laisses sans nom (brouillon
    // abandonne) - rien de bloquant, juste evite de polluer la
    // configuration enregistree.
    var segsAEnregistrer = segsPerso.filter(function(s){ return s.nom.trim(); }).map(function(s){ return {id:s.id, nom:s.nom.trim(), valeurs:s.valeurs}; });
    var idsValides = {}; segsAEnregistrer.forEach(function(s){ idsValides[s.id]=true; });
    CODIFICATION_SEGMENTS_FIXES.forEach(function(s){ if(fixesRetires.indexOf(s.id)<0) idsValides[s.id]=true; });
    var order = codifOrder.filter(function(id){ return idsValides[id]; });
    var included = codifIncluded.filter(function(id){ return idsValides[id]; });
    var composition = order.filter(function(id){ return included.indexOf(id)>=0; });
    if(!composition.length){ toast('Le code doit contenir au moins un segment', 'danger'); return; }
    // V1.73 : simple PATCH directement sur le contrat (meme principe que
    // addDestinataireContrat) - pas besoin de repasser par saveCTR()/
    // openCTRFormModal, desormais sans lien avec cette configuration.
    STATE.db.doc(projetDocPath(ctr)).update({
      segmentsPersonnalises: segsAEnregistrer,
      codificationSegments: composition,
      segmentsFixesRetires: fixesRetires,
      segmentsAutoDepuisReferenceClient: !!byId('clm-ref-client-auto').checked
    }).then(function(){
      closeModal(); toast('Codification enregistrée', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

// V1.60 : toutes les transmissions (lignes de bordereau) d'un livrable pour
// UN indice precis donne - un meme indice peut avoir ete envoye plusieurs
// fois, a des destinataires differents (ex. Pour information au client,
// puis Pour approbation au bureau de controle).
function transmissionsPourLivrableIndice(livId, indice){
  var out = [];
  (STATE.bordereaux||[]).forEach(function(b){
    (b.lignes||[]).forEach(function(ligne){
      if(ligne.livId===livId && ligne.indice===indice){
        // V1.62 : dateRetour/statutRetour n'existent que sur les bordereaux
        // (lignes) ou le retour a deja ete saisi via viewBordereauModal() -
        // undefined sinon, affiche alors comme "en attente de retour".
        out.push({date:b.date, destNom:b.destNom, destCategorie:b.destCategorie, etat:ligne.etat, bordereauNumero:b.numero, createdAt:b.createdAt, dateRetour:ligne.dateRetour, statutRetour:ligne.statutRetour});
      }
    });
  });
  out.sort(function(a,b){ return (a.createdAt||'').localeCompare(b.createdAt||''); });
  return out;
}

// Fenetre de consultation dediee (lecture seule) de l'historique des
// indices d'un livrable et de leurs transmissions - accessible depuis le
// bouton "Historique" de la liste, MEME pour un livrable annule (dont la
// fiche d'edition, elle, reste verrouillee). Remplace l'ancien bloc repliable
// qui etait integre au formulaire de modification, jugé peu pratique.
function openLivrableHistoriqueModal(l){
  if(!l) return;
  // V1.72 : code affiche en direct, meme principe que renderLivrables.
  var ctrHist = projetParId(projetIdDe(l));
  var codeLiveHist = livrableCodeDuLivrable(l, ctrHist);
  var hist = (Array.isArray(l.historiqueIndices) && l.historiqueIndices.length) ? l.historiqueIndices.slice()
    : [{indice: l.indiceRevision||'A', date: l.createdAt||null, par: null, ancien:true}];
  var rows = hist.slice().reverse().map(function(h){
    var trans = transmissionsPourLivrableIndice(l.id, h.indice);
    var transHtml = trans.length ? trans.map(function(t){
      var sm = statutMeta(BORDEREAU_ETATS, t.etat);
      // V1.62 : affiche aussi le retour (date + statut) de cette
      // transmission, ou "en attente de retour" si pas encore saisi.
      var retourHtml = t.statutRetour ?
        ' <span class="pill pill-'+statutMeta(STATUT_RETOUR_REFERENTIEL, t.statutRetour).tone+'" style="margin-left:4px;">'+esc(statutMeta(STATUT_RETOUR_REFERENTIEL, t.statutRetour).label)+'</span>'+
        (t.dateRetour?' <span class="muted" style="font-size:11px;">(retour le '+fmtDate(t.dateRetour)+')</span>':'') :
        ' <span class="muted" style="font-size:11px;">— en attente de retour</span>';
      return '<div style="margin-bottom:4px;">'+(t.date?fmtDate(t.date):'—')+' — <b>'+esc(t.destNom||'')+'</b>'+
        (t.destCategorie?' <span class="muted">('+esc(t.destCategorie)+')</span>':'')+
        ' : <span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span>'+
        ' <span class="muted">— bordereau '+esc(t.bordereauNumero||'—')+'</span>'+retourHtml+'</div>';
    }).join('') : '<span class="muted">Non transmis pour l’instant</span>';
    // V1.63 : budget horaire de CETTE revision (saisi depuis la fiche du
    // livrable, voir openLivrableFormModal/withHistoriqueIndices) - "—" si
    // pas encore renseigne (revision anterieure a la V1.63, ou laissee
    // vide).
    var budgetHtml = (typeof h.budgetHeures==='number') ? (h.budgetHeures+' h') : '<span class="muted">—</span>';
    return '<tr>'+
      '<td class="num" style="font-weight:600;vertical-align:top;white-space:nowrap;">'+esc(h.indice)+'</td>'+
      '<td class="muted" style="vertical-align:top;font-size:12.5px;white-space:nowrap;">'+
        (h.date?fmtDateTime(h.date):'—')+(h.par?'<div>par '+esc(h.par)+'</div>':'')+
        (h.ancien?'<div class="muted" style="font-style:italic;">(avant V1.60)</div>':'')+
      '</td>'+
      '<td class="num" style="vertical-align:top;white-space:nowrap;">'+budgetHtml+'</td>'+
      '<td style="font-size:12.5px;">'+transHtml+'</td>'+
    '</tr>';
  }).join('');

  // V1.63 : rappel de l'avancement courant du livrable (lu sur son Statut,
  // cense refleter sa derniere revision) et du budget total cumule de
  // toutes ses revisions - mêmes valeurs que celles utilisees dans le
  // calcul pondere par contrat/entreprise (voir avancementPondere()).
  var avDoc = livrableAvancement(l);
  var budgetTotal = livrableBudgetTotal(l);
  var avResumeHtml = '<p class="hint" style="margin:4px 0 10px;">Avancement actuel : <b>'+
    (avDoc===null? 'sans avancement défini pour ce statut' : (avDoc+'%')) +
    '</b> — Budget total cumulé (toutes révisions) : <b>'+budgetTotal+' h</b></p>';

  openModal({
    title: 'Historique du livrable',
    large: true,
    body:
      '<p class="hint" style="margin-top:0;"><b>'+esc(l.designation||'')+'</b>'+(l.ctrNumero?' — contrat '+esc(l.ctrNumero):'')+
        (codeLiveHist?' — <code>'+esc(codeLiveHist)+'</code>':'')+'</p>'+
      avResumeHtml+
      '<div class="table-wrap"><table><thead><tr><th>Indice</th><th>Enregistré</th><th>Budget (h)</th><th>Transmissions (bordereaux)</th></tr></thead><tbody>'+
        rows+
      '</tbody></table></div>',
    foot: '<button type="button" class="btn btn-primary" data-close-modal>Fermer</button>'
  });
}

function openLivrableFormModal(l){
  var f = l || {};
  var overlay = openModal({
    title: l ? 'Modifier le livrable' : 'Nouveau livrable technique',
    large: true,
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="lvf-ctr">Contrat / devis</label><select id="lvf-ctr" required'+(l?' disabled':'')+'>'+projetsOptionsHtml(projetIdDe(f), undefined, '', true)+'</select>'+
          (l? '<p class="hint">Non modifiable après création (un livrable de devis se rattache au contrat via le bouton de l’écran Livrables).</p>' : '<p class="hint">Contrat si le marché est gagné, sinon devis. Il pourra être rattaché au contrat plus tard.</p>')+
        '</div>'+
        '<div class="field" id="lvf-type-field"><label for="lvf-type">Type de document</label><select id="lvf-type"><option value="">—</option>'+LIVRABLE_TYPES.map(function(t){ return '<option value="'+esc(t)+'"'+(f.typeDocument===t?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div class="field"><label for="lvf-designation">Désignation</label><input id="lvf-designation" required value="'+esc(f.designation||'')+'" placeholder="ex. Plan d’implantation général"></div>'+
      // V1.66 : reference/code du CLIENT pour ce document (ex. un code de
      // nomenclature projet du type "QW2245-000-00-SOG-...-00035"), distincte
      // du code interne calcule plus bas (codification V1.58) - champ libre,
      // facultatif, qui ne remplace jamais ce dernier. Alimente automatique-
      // ment par l'import Excel (voir openImportLivrablesExcelModal) mais
      // saisissable aussi a la main. V1.82 : peut neanmoins ALIMENTER certains
      // segments personnalises du code interne si le contrat a explicitement
      // active "Recuperer automatiquement depuis la reference client" dans
      // son configurateur de codification (voir livrableSegmentValeur) -
      // reste sans effet sur tout contrat qui n'a pas coche cette case.
      '<div class="field"><label for="lvf-ref-client">Référence / code client (optionnel)</label><input id="lvf-ref-client" value="'+esc(f.referenceClient||'')+'" placeholder="ex. QW2245-000-00-SOG-24925024-EL-C102-00035">'+
        '<p class="hint">Code ou référence propre au client/projet, à ne pas confondre avec le code interne ci-dessous.</p>'+
      '</div>'+
      '<div class="field"><label for="lvf-categorie">Catégorie</label><select id="lvf-categorie"><option value="">—</option>'+LIVRABLE_CATEGORIES.map(function(c){ return '<option value="'+esc(c)+'"'+(f.categorie===c?' selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select>'+
        '<p class="hint">Classification plus fine que le Type de document ci-dessus ; n’entre pas dans le code calculé (ci-dessous).</p>'+
      '</div>'+
      // V1.73 : Zone/Niveau/Discipline (listes fixes depuis la V1.58) sont
      // remplaces par les segments personnalises PROPRES AU CONTRAT choisi
      // ci-dessus (voir segmentsPersonnalisesDuContrat, renderSegmentsDyn
      // plus bas) - un contrat qui n'a rien personnalise affiche encore
      // "Zone"/"Niveau"/"Discipline" (meme format qu'avant), mais ce ne
      // sont plus que 3 segments personnalises comme les autres.
      '<div id="lvf-segments-dyn" class="field-row grid-3"></div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="lvf-indice">Indice de révision</label><input id="lvf-indice" style="max-width:120px;" value="'+esc(f.indiceRevision||(l?'':'A'))+'"></div>'+
        '<div class="field"><label for="lvf-statut">Statut</label><select id="lvf-statut">'+LIVRABLE_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'NEE')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
        '<div class="field"><label for="lvf-date">Date d’émission</label><input type="date" id="lvf-date" value="'+esc(f.dateEmission||'')+'"></div>'+
      '</div>'+
      // V1.63 : budget horaire PAR REVISION (demande explicite : "chaque
      // revision doit avoir un budget horaire") - ce champ porte le budget
      // de la revision courante (celle de l'indice ci-dessus), pré-rempli
      // avec la valeur deja enregistree pour cette revision s'il y en a
      // une ; voir withHistoriqueIndices() pour la logique d'enregistrement
      // (nouvelle entree d'historique si l'indice change, simple correction
      // de l'entree courante sinon). L'avancement (%) est purement informatif
      // ici, lu depuis le Statut ci-dessus via le referentiel (recalcule en
      // direct si vous changez le Statut).
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="lvf-budget">Budget horaire (h) — pour cette révision (indice '+esc(f.indiceRevision||'A')+')</label><input type="number" id="lvf-budget" min="0" step="0.5" value="'+esc(budgetRevisionCourante(f)!==null?budgetRevisionCourante(f):'')+'" placeholder="ex. 8"></div>'+
        '<div class="field"><label>Avancement de ce livrable</label><p class="hint" id="lvf-avancement-preview" style="margin-top:8px;">—</p></div>'+
      '</div>'+
      // V1.65 : personnes affectees + dates planifiees - CONCERNE UNIQUEMENT
      // LA REVISION COURANTE (pas d'historique, a la difference du budget
      // horaire ci-dessus) : a chaque nouvel indice, l'affectation et les
      // dates sont simplement remplacees. Purement informatif depuis la
      // V1.70 : le module de planification manuelle (menu "Plan de
      // charge") a sa propre collection et n'en depend plus.
      // STATE.personnelLight vient de /api/personnel-light (jamais le
      // salaire), accessible au Conducteur de travaux meme sans acces au
      // registre Personnel complet.
      '<div class="field"><label>Personnes affectées <span class="muted" style="font-weight:400;">(révision courante uniquement — à réaffecter à chaque nouvel indice)</span></label>'+
        '<div id="lvf-affectations" style="border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;max-height:160px;overflow:auto;">'+
          (STATE.personnelLight.length ?
            STATE.personnelLight.map(function(p){
              var checked = (Array.isArray(f.affectations) ? f.affectations : []).some(function(a){ return a.id===p.id; });
              return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:3px 0;'+(p.actif===false?'opacity:.55;':'')+'">'+
                '<input type="checkbox" class="lvf-aff-chk" value="'+esc(p.id)+'" data-nom="'+esc(p.nom||'')+'" data-fonction="'+esc(p.fonction||'')+'" style="width:auto;"'+(checked?' checked':'')+'> '+
                esc(p.nom||'—')+(p.fonction?' <span class="muted" style="font-size:11.5px;">— '+esc(p.fonction)+'</span>':'')+(p.actif===false?' <span class="muted" style="font-size:11px;">(inactif)</span>':'')+
              '</label>';
            }).join('')
            : '<p class="hint" style="margin:0;">Aucune fiche dans le registre Personnel pour le moment.</p>')+
        '</div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="lvf-plan-debut">Date de début planifiée</label><input type="date" id="lvf-plan-debut" value="'+esc(f.datePlanifieeDebut||'')+'"></div>'+
        '<div class="field"><label for="lvf-plan-fin">Date de fin planifiée</label><input type="date" id="lvf-plan-fin" value="'+esc(f.datePlanifieeFin||'')+'"></div>'+
      '</div>'+
      // V1.60 : l'historique des indices et de leurs transmissions n'est
      // plus affiche ici (jugé peu pratique, repliable dans un formulaire
      // déjà chargé) - un bouton "Historique" dédié, depuis la liste des
      // livrables, ouvre désormais une fenêtre de consultation à part,
      // disponible même pour un livrable annulé (voir openLivrableHistoriqueModal).
      (l ? '<p class="hint" style="margin-top:-4px;">Pour consulter l’historique des indices et leurs transmissions, utilisez le bouton '+ic('journal',12)+' « Historique » depuis la liste des livrables.</p>' : '')+
      '<div class="field"><label for="lvf-dest">Destinataire</label><input id="lvf-dest" value="'+esc(f.destinataire||'')+'" placeholder="ex. JESA — Service études"></div>'+
      '<div class="field"><label for="lvf-notes">Notes</label><textarea id="lvf-notes">'+esc(f.notes||'')+'</textarea></div>'+
      '<div class="field" style="max-width:260px;"><label for="lvf-seq">Numéro séquentiel</label><input id="lvf-seq" value="'+esc(f.numeroSeqTexte||(f.numeroSeq?String(f.numeroSeq).padStart(3,'0'):''))+'" placeholder="automatique">'+
        '<p class="hint">Modifiable (ex. numéro de document du client) ; laissé vide, il est attribué automatiquement. Doit rester unique dans le contrat.</p></div>'+
      '<p class="hint">Code du livrable (calculé à partir des champs ci-dessus) : <code id="lvf-code-preview" style="font-weight:600;">—</code>'+
        (f.numeroSeq? '' : ' <span class="muted">(numéro séquentiel attribué à l’enregistrement)</span>')+'</p>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="lvf-save">Enregistrer</button>'
  });

  // Contrat actuellement choisi (verrouille en modification depuis la
  // V1.54) - resolu une seule fois ici, reutilise par renderSegmentsDyn()
  // et previewCode() ci-dessous.
  function ctrChoisi(){
    return projetParId((l?projetIdDe(f):byId('lvf-ctr').value));
  }
  // V1.73 : un champ <select> PAR SEGMENT PERSONNALISE du contrat choisi
  // (voir segmentsPersonnalisesDuContrat) - remplace les anciens champs fixes
  // Zone/Niveau/Discipline. Redessine a chaque changement de contrat (un
  // nouveau livrable seulement - le contrat est verrouille en modification),
  // puisque deux contrats peuvent avoir des segments totalement differents.
  // Rien n'est bloque si la valeur deja enregistree (f) n'est plus dans la
  // liste actuelle du segment (renomme/retire depuis l'enregistrement) :
  // elle est ajoutee en tete des options, pour ne jamais la perdre ni la
  // reinitialiser silencieusement a l'ouverture du formulaire.
  function renderSegmentsDyn(){
    var ctrSel = ctrChoisi();
    var segs = segmentsPersonnalisesDuContrat(ctrSel);
    byId('lvf-segments-dyn').innerHTML = segs.map(function(seg){
      var current = l ? livrableSegmentValeur(f, seg.id) : undefined;
      var opts = seg.valeurs.slice();
      if(current && opts.indexOf(current)<0) opts.unshift(current);
      return '<div class="field"><label>'+esc(seg.nom)+'</label><select class="lvf-seg-dyn" data-seg="'+esc(seg.id)+'"><option value="">—</option>'+
        opts.map(function(v){ return '<option value="'+esc(v)+'"'+(current===v?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+
      '</select></div>';
    }).join('');
    byId('lvf-segments-dyn').querySelectorAll('.lvf-seg-dyn').forEach(function(sel){ sel.addEventListener('change', previewCode); });
  }
  // Apercu du code (V1.58) : recalcule a chaque changement d'un des segments
  // - le numero sequentiel n'est connu qu'a l'enregistrement pour un nouveau
  // livrable (attribue par nextLocalSeq, voir saveLivrable), affiche en
  // "···" jusque-la.
  function previewCode(){
    var ctrSel = ctrChoisi();
    // V2.24 : champ Type de document masque quand le code du contrat ne
    // l'utilise pas (la valeur deja enregistree reste conservee).
    var tf = byId('lvf-type-field'); if(tf) tf.style.display = typeDansCodeContrat(ctrSel) ? '' : 'none';
    var ctrNumero = ctrSel ? ctrSel.numero : (l ? f.ctrNumero : '');
    var segVals = {};
    byId('lvf-segments-dyn').querySelectorAll('.lvf-seg-dyn').forEach(function(sel){ segVals[sel.getAttribute('data-seg')] = sel.value; });
    var draft = {ctrNumero: ctrNumero, typeDocument: byId('lvf-type').value, numeroSeq: f.numeroSeq, numeroSeqTexte: byId('lvf-seq').value.trim() || f.numeroSeqTexte, indiceRevision: byId('lvf-indice').value.trim(), segmentsValeurs: segVals};
    byId('lvf-code-preview').textContent = livrableCode(draft, ctrSel);
  }
  renderSegmentsDyn();
  byId('lvf-seq').addEventListener('input', previewCode);
  ['lvf-type','lvf-indice'].forEach(function(id){
    byId(id).addEventListener(id==='lvf-indice'?'input':'change', previewCode);
  });
  if(!l) byId('lvf-ctr').addEventListener('change', function(){ renderSegmentsDyn(); previewCode(); });
  previewCode();

  // V1.63 : apercu en direct de l'avancement (%) associe au Statut choisi -
  // purement informatif (le % reellement utilise pour le calcul pondere est
  // toujours relu depuis le referentiel au moment du calcul, jamais stocke
  // tel quel sur le livrable).
  function previewAvancement(){
    var sm = statutMeta(LIVRABLE_STATUTS, byId('lvf-statut').value);
    byId('lvf-avancement-preview').textContent = (sm && typeof sm.avancement==='number') ?
      (sm.avancement+'%') : 'Sans avancement défini pour ce statut (exclu du calcul pondéré)';
  }
  byId('lvf-statut').addEventListener('change', previewAvancement);
  previewAvancement();

  // V1.65 : rafraichit discretement la liste du Personnel pour la prochaine
  // ouverture de ce formulaire (une fiche creee a l'instant n'apparaitra pas
  // forcement dans CETTE ouverture-ci, deja construite avec l'etat connu au
  // moment du clic - compromis assume, voir chargerPersonnelLight()).
  chargerPersonnelLight();

  overlay.querySelector('#lvf-save').addEventListener('click', function(){
    var ctrId = l ? projetIdDe(l) : byId('lvf-ctr').value;
    if(!ctrId){ toast('Veuillez choisir un contrat ou un devis', 'danger'); return; }
    var designation = byId('lvf-designation').value.trim();
    if(!designation){ toast('La désignation est obligatoire', 'danger'); return; }
    // V1.65 : dates planifiees - soit les deux, soit aucune (une plage a
    // moitie renseignee ne peut pas alimenter le plan de charge), et fin
    // jamais avant debut.
    var planDebut = byId('lvf-plan-debut').value;
    var planFin = byId('lvf-plan-fin').value;
    if((planDebut && !planFin) || (!planDebut && planFin)){
      toast('Renseignez à la fois la date de début et la date de fin planifiées (ou laissez les deux vides)', 'danger'); return;
    }
    if(planDebut && planFin && planFin < planDebut){
      toast('La date de fin planifiée ne peut pas être antérieure à la date de début', 'danger'); return;
    }
    var ctr = projetParId(ctrId);
    var budgetTxt = byId('lvf-budget').value.trim();
    // V1.65 : personnes affectees a la revision courante - {id, nom,
    // fonction} capture au moment de l'enregistrement (meme esprit de
    // denormalisation que clientNom/ctrNumero), pour que le libelle reste
    // lisible meme si la fiche Personnel est plus tard renommee ou
    // desactivee.
    var affectations = Array.prototype.slice.call(overlay.querySelectorAll('.lvf-aff-chk:checked')).map(function(chk){
      return {id: chk.value, nom: chk.getAttribute('data-nom')||'', fonction: chk.getAttribute('data-fonction')||''};
    });
    // V1.73 : carte generique {segId: valeur} pour TOUS les segments
    // personnalises du contrat (remplace les anciens champs plats
    // zone/niveau/discipline, V1.58 - livrableSegmentValeur() continue de
    // lire ceux-ci en repli pour un livrable jamais reenregistre depuis).
    var segmentsValeurs = {};
    overlay.querySelectorAll('.lvf-seg-dyn').forEach(function(sel){ segmentsValeurs[sel.getAttribute('data-seg')] = sel.value; });
    var data = Object.assign(ctr ? champsProjet(ctr) : {ctrId:f.ctrId||null, ctrNumero:f.ctrNumero||null, devisId:f.devisId||null, devisNumero:f.devisNumero||null}, {
      clientId: ctr?ctr.clientId:(f.clientId||''), clientNom: ctr?ctr.clientNom:(f.clientNom||''),
      designation: designation, typeDocument: byId('lvf-type').value, categorie: byId('lvf-categorie').value,
      segmentsValeurs: segmentsValeurs,
      indiceRevision: byId('lvf-indice').value.trim(), statut: byId('lvf-statut').value,
      dateEmission: byId('lvf-date').value, destinataire: byId('lvf-dest').value.trim(),
      notes: byId('lvf-notes').value.trim(),
      // V1.65 : affectations + dates planifiees - CHAMPS PLATS, jamais
      // historises (a la difference du budget ci-dessous) : simplement
      // remplaces a chaque enregistrement, puisqu'ils ne concernent que la
      // revision courante ("les anciennes ne sont plus concernees").
      affectations: affectations, datePlanifieeDebut: planDebut||null, datePlanifieeFin: planFin||null,
      // V1.63 : budget horaire de la revision courante - transitoire, voir
      // withHistoriqueIndices() qui le range dans historiqueIndices puis le
      // retire de la racine du document.
      budgetHeuresRevision: budgetTxt ? Number(budgetTxt) : null,
      // V1.66 : reference/code client, voir le champ ci-dessus.
      referenceClient: byId('lvf-ref-client').value.trim()
    });
    // V2.22 : numero sequentiel modifiable - unique dans le contrat
    var seqTxt = byId('lvf-seq').value.trim();
    var seqActuel = l ? (f.numeroSeqTexte || (f.numeroSeq?String(f.numeroSeq).padStart(3,'0'):'')) : '';
    if(seqTxt && seqTxt!==seqActuel){
      var doublon = STATE.livrables.some(function(x){
        if(projetIdDe(x)!==ctrId || (l && x.id===l.id)) return false;
        var xs = x.numeroSeqTexte || (x.numeroSeq?String(x.numeroSeq).padStart(3,'0'):'');
        return xs.toLowerCase()===seqTxt.toLowerCase();
      });
      if(doublon){ toast('Ce numéro séquentiel est déjà utilisé dans ce contrat ou devis', 'danger'); return; }
      data.numeroSeqTexte = seqTxt;
    }
    saveLivrable(data, l?l.id:null).then(function(){
      closeModal(); toast('Livrable enregistré', 'success');
    }).catch(function(err){ console.error(err); toast(err && err.codeDoublon ? err.message : 'Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   IMPORT DU REGISTRE DES LIVRABLES DEPUIS UN CLASSEUR EXCEL REEL (V1.66)
   Voir claude/codification-livrables-futura-expertise.md, §16, et
   backend/routes/livrables_import.py (POST /api/livrables-import/parse,
   lecture seule). Meme principe general que l'import Excel Clients/
   Fournisseurs (V1.25, openImportExcelModal) : le backend ne fait que
   decoder le classeur, toutes les ecritures (livrables, historique des
   indices, Personnel cree a la volee, destinataire, bordereaux
   reconstitues) sont faites ici, via l'API generique /api/doc/...

   Trois decisions de l'utilisateur resolues DANS cet assistant, "au moment
   de l'import" plutot qu'en amont : le contrat de rattachement, la
   correspondance initiales -> fiche Personnel (Ressources du Plan de
   charge du classeur), et le destinataire generique des bordereaux
   reconstitues depuis "Gestion des versions" (le classeur ne precise
   jamais a qui chaque envoi a ete fait, seulement qu'il a eu lieu, avec
   son eventuel retour).
   ========================================================= */
var impLiv = null; // etat de l'assistant en cours (reinitialise a chaque ouverture)

// V2.20 : CORRESPONDANCE DES COLONNES. Le classeur n'a plus besoin d'avoir
// des en-tetes portant les noms attendus par l'application : l'assistant lit
// la feuille telle quelle (POST /api/livrables-import/table), puis
// l'utilisateur indique pour chaque champ (designation, code, indice,
// categorie, statut, budget, ressources, + un champ par segment de
// codification du contrat) quelle colonne du fichier lui correspond - une
// correspondance automatique (noms proches) est seulement PROPOSEE. Les
// feuilles "Gestion des versions"/"Plan de charge" restent facultatives et
// sont lues comme avant (/parse) quand elles existent.
var IMPL_CHAMPS = [
  {key:'designation', label:'Désignation du document', req:true, syn:['designation document','designation','libelle','intitule','titre']},
  {key:'code', label:'Code / référence client du document', req:true, syn:['code document','code','reference client','reference','ref','code doc'],
    hint:'Clé de mise à jour : un livrable déjà importé (même contrat, même référence) est mis à jour au lieu d’être dupliqué.'},
  {key:'indice', label:'Indice de révision', req:true, syn:['indice','revision','rev','ind']},
  {key:'categorie', label:'Catégorie', syn:['categorie','category']},
  {key:'statut', label:'Statut / état', syn:['etat','statut','status'],
    hint:'Laissez « Ne pas importer » : le statut reste vide. Valeurs reconnues : abréviations (NEE, DE, VSC…) ou libellés de l’application.'},
  {key:'budget', label:'Budget horaire', syn:['budget planifie','budget','heures','charge']},
  {key:'ressources', label:'Ressources (initiales)', syn:['ressources','ressource']}
];
function implNorm(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function implSegmentsContrat(ctrId){
  var ctr = projetParId(ctrId);
  return ctr ? segmentsPersonnalisesDuContrat(ctr) : [];
}
// Proposition automatique : une colonne n'est proposee qu'a UN champ.
function implProposerCorrespondance(conserver){
  var cols = impLiv.table.columns, used = {}, m = {};
  var anciens = conserver || {};
  Object.keys(anciens).forEach(function(k){ if(anciens[k]!=='' && anciens[k]!==undefined){ m[k] = anciens[k]; used[anciens[k]] = true; } });
  function trouver(noms){
    var normes = noms.map(implNorm).filter(Boolean), i, j;
    for(i=0;i<normes.length;i++) for(j=0;j<cols.length;j++){ if(!used[cols[j].idx] && implNorm(cols[j].name)===normes[i]) return cols[j].idx; }
    for(i=0;i<normes.length;i++) if(normes[i].length>=4) for(j=0;j<cols.length;j++){ if(!used[cols[j].idx] && implNorm(cols[j].name).indexOf(normes[i]+' ')===0) return cols[j].idx; }
    return '';
  }
  IMPL_CHAMPS.forEach(function(c){
    if(m[c.key]!==undefined) return;
    var idx = trouver(c.syn); m[c.key] = idx; if(idx!=='') used[idx] = true;
  });
  implSegmentsContrat(impLiv.ctrId).forEach(function(s){
    var k = 'seg:'+s.id; if(m[k]!==undefined) return;
    var idx = trouver([s.nom, s.id]); m[k] = idx; if(idx!=='') used[idx] = true;
  });
  return m;
}
function implValeurColonne(row, idx){
  if(idx==='' || idx===undefined || idx===null) return '';
  var pos = impLiv.table.columns.findIndex(function(c){ return c.idx===idx; });
  return pos<0 ? '' : (row[pos]||'');
}
function implStatutId(raw){
  if(!raw) return '';
  var n = implNorm(raw), found = null;
  LIVRABLE_STATUTS.forEach(function(s){ if(!found && (implNorm(s.id)===n || implNorm(s.label)===n)) found = s.id; });
  return found || null; // null = valeur non reconnue
}
// Construit impLiv.parsed.livrables depuis la feuille et la correspondance.
function implConstruireLivrables(){
  var t = impLiv.table, m = impLiv.mapping, legacy = impLiv.legacy;
  var seen = {}, out = [], ignores = {vides:0, doublons:0, statutInconnu:0, atypiques:0};
  var splitOn = implSplitActif(), sp = impLiv.split;
  if(splitOn){ implAttribuerIds(projetParId(impLiv.ctrId)); }
  var legRess = {};
  if(legacy && legacy.livrables) legacy.livrables.forEach(function(x){ if(x.ressourcesTexte) legRess[x.codeDocument] = x.ressourcesTexte; });
  var segs = splitOn ? [] : implSegmentsContrat(impLiv.ctrId).filter(function(s){ return m['seg:'+s.id]!=='' && m['seg:'+s.id]!==undefined; });
  var initiales = {};
  t.rows.forEach(function(row){
    var code = implValeurColonne(row, m.code), des = implValeurColonne(row, m.designation);
    if(!code || !des){ ignores.vides++; return; }
    if(seen[code]){ ignores.doublons++; return; }
    var tokens = null;
    if(splitOn){
      tokens = code.split('-');
      if(tokens.length!==sp.N){ ignores.atypiques++; return; }
    }
    seen[code] = true;
    var st = implStatutId(implValeurColonne(row, m.statut));
    if(st===null){ ignores.statutInconnu++; st = ''; }
    var bud = implValeurColonne(row, m.budget), budNum = null;
    if(bud!==''){ var f = parseFloat(String(bud).replace(',', '.')); budNum = isNaN(f) ? null : f; }
    var ress = m.ressources!=='' && m.ressources!==undefined ? implValeurColonne(row, m.ressources) : (legRess[code]||'');
    if(ress) ress.replace(/,/g,'/').split('/').forEach(function(x){ x = x.trim(); if(x) initiales[x] = true; });
    var sv = {};
    segs.forEach(function(s){ var v = implValeurColonne(row, m['seg:'+s.id]); if(v) sv[s.id] = v; });
    var indiceC = implValeurColonne(row, m.indice), seqTexte = '';
    if(splitOn){
      sp.positions.forEach(function(p, k){
        // colonne du classeur retrouvee -> sa valeur ; sinon, element du code
        var v = (p.colIdx!==null && p.colIdx!==undefined) ? implValeurColonne(row, p.colIdx).trim() : tokens[k].trim();
        if(p.role==='seg'){ if(v) sv[p.segId] = v; }
        else if(p.role==='indice') indiceC = v;
        else if(p.role==='seq') seqTexte = v;
      });
    }
    out.push({codeDocument:code, designation:des, categorie:implValeurColonne(row, m.categorie), statutAbr:st,
      indiceCourant:indiceC, budgetHeures:budNum, ressourcesTexte:ress, segments:sv, numeroSeqTexte:seqTexte});
  });
  impLiv.ignores = ignores;
  impLiv.parsed = {
    livrables: out,
    historique: (legacy && legacy.historique) ? legacy.historique : {},
    initiales: Object.keys(initiales).sort()
  };
}
// Valeurs de segment absentes de la liste du segment (pour l'avertissement).
function implValeursNouvelles(){
  var m = impLiv.mapping, t = impLiv.table, res = [];
  implSegmentsContrat(impLiv.ctrId).forEach(function(s){
    var k = 'seg:'+s.id; if(m[k]===''||m[k]===undefined) return;
    var connues = (s.valeurs||[]).map(function(v){ return String(v).toLowerCase(); }), nouvelles = [];
    t.rows.forEach(function(row){
      var v = implValeurColonne(row, m[k]);
      if(v && connues.indexOf(v.toLowerCase())<0 && nouvelles.indexOf(v)<0) nouvelles.push(v);
    });
    if(nouvelles.length) res.push({seg:s, valeurs:nouvelles});
  });
  return res;
}

// ---------------------------------------------------------------------------
// V2.21 : DECOUPAGE DU CODE CLIENT. Le « Code document » du classeur (ex.
// GSC-ATO-EXE-CA-CEN-RDC-PLN-670300-00) est decoupe au tiret ; le nombre de
// segments est VARIABLE (celui des lignes les plus nombreuses). Le NOM de
// chaque segment est lu dans l'en-tete de la colonne du classeur dont les
// valeurs sont, ligne par ligne, identiques a cet element du code (au moins
// 90 % des lignes) ; a defaut, « Segment k » a renommer a l'ecran. Roles :
// segment de codification (liste de valeurs), numero de document (numero
// sequentiel, conserve tel quel) ou indice de revision.
// ---------------------------------------------------------------------------
var IMPL_FIXES_NORM = ['numero de contrat','type de document','numero sequentiel','indice de revision'];
function implRoleParNom(nom){
  var n = implNorm(nom);
  if(/^(indice|revision|rev|ind)$/.test(n) || n.indexOf('indice')===0) return 'indice';
  if(n.indexOf('numero')>=0 || /^n( de)? document/.test(n) || /^n( de)? doc/.test(n) || n.indexOf('sequen')>=0 || n.indexOf('increment')>=0) return 'seq';
  return 'seg';
}
function implDetecterDecoupage(){
  var t = impLiv.table, m = impLiv.mapping;
  if(m.code==='' || m.code===undefined) return null;
  var codes = t.rows.map(function(r){ return implValeurColonne(r, m.code); }).filter(Boolean);
  if(!codes.length) return null;
  var cnt = {}; codes.forEach(function(c){ var n = c.split('-').length; cnt[n] = (cnt[n]||0)+1; });
  var N = 0, best = 0;
  Object.keys(cnt).forEach(function(k){ if(cnt[k]>best){ best = cnt[k]; N = parseInt(k,10); } });
  if(N<2) return {codeIdx:m.code, N:N, positions:[], atypiques:0, actif:false};
  var rowsN = t.rows.filter(function(r){ var c = implValeurColonne(r, m.code); return c && c.split('-').length===N; });
  var used = {}, prevPos = -1, positions = [], rolesPris = {};
  for(var k=0;k<N;k++){
    var tokens = rowsN.map(function(r){ return implValeurColonne(r, m.code).split('-')[k].trim(); });
    var meilleure = null, meilleurRatio = 0.8 - 1e-9, meilleurPos = -1;
    t.columns.forEach(function(c, pos){
      if(c.idx===m.code || used[c.idx]) return;
      var ok = 0;
      rowsN.forEach(function(r, i){ if(implValeurColonne(r, c.idx).trim()===tokens[i]) ok++; });
      var ratio = ok/rowsN.length;
      var apres = pos>prevPos;
      if(ratio>meilleurRatio+1e-9 || (Math.abs(ratio-meilleurRatio)<1e-9 && meilleure && apres && meilleurPos<=prevPos)){
        meilleure = c; meilleurRatio = ratio; meilleurPos = pos;
      }
    });
    // V2.22 : quand la colonne du classeur est retrouvee, ses VALEURS sont la
    // source des contenus de segment (et non le code) : le code peut differer
    // de la colonne (ex. code « GSC-... » mais colonne Code projet = AAA).
    var sources = meilleure ? rowsN.map(function(r){ return implValeurColonne(r, meilleure.idx).trim(); }) : tokens;
    var ecarts = meilleure ? sources.filter(function(v, i){ return v!==tokens[i]; }).length : 0;
    var vals = [], ordre = {};
    sources.forEach(function(v){ if(v==='') return; if(!(v in ordre)){ ordre[v] = vals.length; vals.push({v:v, n:0}); } vals[ordre[v]].n++; });
    var nom = meilleure ? meilleure.name : ('Segment '+(k+1));
    if(meilleure){ used[meilleure.idx] = true; prevPos = meilleurPos; }
    var role = meilleure ? implRoleParNom(nom) : 'seg';
    if(role!=='seg' && rolesPris[role]) role = 'seg';
    if(role!=='seg') rolesPris[role] = true;
    positions.push({nom:nom, role:role, colIdx:meilleure?meilleure.idx:null, valeurs:vals, trouve:!!meilleure, ecarts:ecarts});
  }
  // actif d'office seulement si le classeur permet vraiment de nommer les
  // segments (au moins 2 colonnes retrouvees) ; sinon proposition decochee.
  var nbTrouves = positions.filter(function(p){ return p.trouve; }).length;
  return {codeIdx:m.code, N:N, positions:positions, atypiques:codes.length-rowsN.length, actif:nbTrouves>=2};
}
function implNomSegmentFinal(nom){
  return IMPL_FIXES_NORM.indexOf(implNorm(nom))>=0 ? nom+' (client)' : nom;
}
// Attribue un identifiant a chaque segment de codification detecte : celui du
// segment existant du contrat portant le meme nom, sinon un nouvel identifiant.
function implAttribuerIds(ctr){
  var existants = segmentsPersonnalisesDuContrat(ctr);
  impLiv.split.positions.forEach(function(p){
    if(p.role!=='seg'){ p.segId = null; return; }
    var nomF = implNomSegmentFinal(p.nom);
    var ex = existants.find(function(s){ return implNorm(s.nom)===implNorm(nomF); });
    p.nomFinal = nomF;
    p.segId = ex ? ex.id : ('seg'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  });
}
function implSplitActif(){ return !!(impLiv.split && impLiv.split.actif && impLiv.split.positions.length); }
function implSplitValide(){
  var sp = impLiv.split, noms = {}, roles = {};
  for(var i=0;i<sp.positions.length;i++){
    var p = sp.positions[i];
    if(!p.nom.trim()) return 'Chaque élément du code doit avoir un nom.';
    if(p.role==='seg'){
      var n = implNorm(implNomSegmentFinal(p.nom));
      if(noms[n]) return 'Deux segments portent le même nom : « '+p.nom+' ».';
      noms[n] = true;
    } else {
      if(roles[p.role]) return 'Un seul élément peut être « '+(p.role==='seq'?'Numéro de document':'Indice de révision')+' ».';
      roles[p.role] = true;
    }
  }
  return '';
}
function implMessageCodification(ctr){
  var anciens = segmentsPersonnalisesDuContrat(ctr);
  var nbVal = anciens.reduce(function(n, s){ return n + (s.valeurs||[]).length; }, 0);
  var nbLiv = STATE.livrables.filter(function(x){ return projetIdDe(x)===ctr.id; }).length;
  var nouveaux = impLiv.split.positions.map(function(p){ return p.role==='seg' ? p.nom : (p.role==='seq' ? p.nom+' (n° de document)' : p.nom+' (indice)'); });
  return {
    anciens: 'Supprimés : '+anciens.length+' segment(s) ('+anciens.map(function(s){ return s.nom; }).join(', ')+') et leurs '+nbVal+' valeur(s).',
    nouveaux: 'Nouvelle composition du code : '+nouveaux.join(' – ')+'.',
    livrables: nbLiv ? nbLiv+' livrable(s) existant(s) sur ce contrat : ceux qui figurent dans ce classeur sont mis à jour ; les autres gardent leurs anciennes valeurs en mémoire, qui ne s’affichent plus dans le code.' : ''
  };
}
function implSplitHtml(){
  var sp = impLiv.split; if(!sp) return '';
  if(sp.N<2) return '<p class="hint">Le code sélectionné ne contient pas de tiret : aucun découpage possible.</p>';
  var roleOpts = [['seg','Segment de codification'],['seq','Numéro de document (séquentiel)'],['indice','Indice de révision']];
  return '<div class="field" style="margin-top:14px;"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="imps-actif"'+(sp.actif?' checked':'')+'> <strong>Découper le code client en '+sp.N+' segment(s) et mettre à jour la codification du contrat</strong></label>'+
    '<p class="hint" style="margin:4px 0 8px;">Les noms viennent des en-têtes du classeur et les <strong>contenus de chaque segment sont lus dans les colonnes</strong> correspondantes (pas dans le code). <strong>La codification actuelle du contrat sera remplacée</strong> (segments, valeurs et composition) par celle du code client ; un nom identique à un segment fixe de l’application reçoit le suffixe « (client) ».'+
    (sp.atypiques? ' <strong>'+sp.atypiques+' ligne(s) dont le code n’a pas '+sp.N+' éléments seront ignorées.</strong>':'')+'</p>'+
    (sp.actif ? '<div class="table-wrap"><table><thead><tr><th>#</th><th>Nom du segment</th><th>Rôle</th><th>Colonne source</th><th>Valeurs trouvées (occurrences)</th></tr></thead><tbody>'+
      sp.positions.map(function(p, k){
        var col = p.colIdx!==null ? impLiv.table.columns.find(function(c){ return c.idx===p.colIdx; }) : null;
        var vs = p.valeurs.slice(0,8).map(function(x){ return esc(x.v)+' ('+x.n+')'; }).join(', ') + (p.valeurs.length>8 ? ' … +'+(p.valeurs.length-8) : '');
        return '<tr><td class="num">'+(k+1)+'</td>'+
          '<td><input class="imps-nom" data-k="'+k+'" value="'+esc(p.nom)+'" style="min-width:170px;">'+(p.trouve?'':'<div class="hint" style="margin:2px 0 0;font-size:11.5px;">nom non trouvé dans le classeur — à saisir</div>')+'</td>'+
          '<td><select class="imps-role" data-k="'+k+'">'+roleOpts.map(function(o){ return '<option value="'+o[0]+'"'+(p.role===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></td>'+
          '<td class="muted">'+(col?esc(col.letter+' — '+col.name):'—')+(p.ecarts?'<div class="hint" style="margin:2px 0 0;font-size:11.5px;color:var(--warning-text,#b9770e);">'+p.ecarts+' ligne(s) où la colonne diffère du code : la colonne est retenue</div>':'')+'</td>'+
          '<td class="muted" style="font-size:12px;">'+(p.role==='seq' ? p.valeurs.length+' numéros distincts (ex. '+esc(p.valeurs.slice(0,3).map(function(x){return x.v;}).join(', '))+')' : vs)+'</td></tr>';
      }).join('')+'</tbody></table></div>' : '')+
    '</div>';
}

function openImportLivrablesExcelModal(){
  impLiv = {parsed: null, table: null, file: null, legacy: null, mapping: {}, split: null, ctrId: '', ajouterValeurs: true, ignores: null, destinatairesAjoutesSession: []};
  openModal({
    title: 'Importer le registre des livrables depuis un classeur Excel',
    large: true,
    body:
      '<p class="hint" style="margin-bottom:14px;">Sélectionnez un classeur .xlsx : vous indiquerez ensuite, à l’écran, <strong>quelle colonne du fichier correspond à quel champ</strong> de l’application, quels que soient les noms d’en-têtes utilisés par le client. Si le classeur contient aussi les feuilles « Gestion des versions » et « Plan de charge … », l’historique des indices et les ressources sont repris. Un livrable déjà importé précédemment (même contrat, même référence client) est mis à jour plutôt que dupliqué.</p>'+
      '<input type="file" id="impl-file" accept=".xlsx">'+
      '<div id="impl-zone" style="margin-top:16px;"></div>',
    foot: false
  });
  byId('impl-file').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    impLiv.file = file; impLiv.mapping = {};
    chargerTableImportLivrables('', true);
  });
}
function chargerTableImportLivrables(sheet, premier, headerRow){
  var zone = byId('impl-zone');
  zone.innerHTML = '<p class="hint">Lecture du fichier…</p>';
  function post(url, withSheet){
    var fd = new FormData(); fd.append('file', impLiv.file);
    if(withSheet && sheet) fd.append('sheet', sheet);
    if(withSheet && headerRow) fd.append('headerRow', String(headerRow));
    return fetch(url, {method:'POST', body:fd}).then(function(r){
      return r.text().then(function(text){
        var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
        if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
        return json;
      });
    });
  }
  var pTable = post('/api/livrables-import/table', true);
  // Lecture "classique" (feuilles Gestion des versions / Plan de charge) :
  // facultative, ses erreurs sont ignorees (un classeur client quelconque
  // n'a en general pas ces feuilles).
  var pLegacy = premier ? post('/api/livrables-import/parse', false).catch(function(){ return null; }) : Promise.resolve(impLiv.legacy);
  Promise.all([pTable, pLegacy]).then(function(res){
    impLiv.table = res[0]; impLiv.legacy = res[1]; impLiv.mapping = {}; impLiv.split = null;
    return chargerPersonnelLight();
  }).then(renderImportColonnesScreen).catch(function(err){
    console.error(err); zone.innerHTML=''; toast('Erreur de lecture du fichier : '+err.message, 'danger');
  });
}
function renderImportColonnesScreen(){
  var zone = byId('impl-zone'); if(!zone || !impLiv || !impLiv.table) return;
  var t = impLiv.table;
  if(!Object.keys(impLiv.mapping).length) impLiv.mapping = implProposerCorrespondance();
  var m = impLiv.mapping;
  // V2.21 : (re)detection du decoupage quand la colonne du code change
  if(!impLiv.split || impLiv.split.codeIdx!==m.code){
    var ancienActif = impLiv.split ? impLiv.split.actif : true;
    impLiv.split = implDetecterDecoupage();
    if(impLiv.split && !ancienActif && impLiv.split.positions.length) impLiv.split.actif = false;
  }
  var splitOn = implSplitActif();
  function apercu(idx){
    if(idx==='' || idx===undefined) return '<span class="muted">—</span>';
    var vals = [];
    for(var i=0;i<t.rows.length && vals.length<3;i++){ var v = implValeurColonne(t.rows[i], idx); if(v) vals.push(v); }
    return '<span class="muted" style="font-size:12px;">'+esc(vals.join('  ·  ')||'(vide)')+'</span>';
  }
  function selectHtml(key, req){
    return '<select class="impc-sel" data-key="'+esc(key)+'" style="min-width:230px;">'+
      '<option value="">'+(req?'— Choisir une colonne —':'— Ne pas importer —')+'</option>'+
      t.columns.map(function(c){ return '<option value="'+c.idx+'"'+(m[key]===c.idx?' selected':'')+'>'+esc(c.letter+' — '+c.name)+'</option>'; }).join('')+
    '</select>';
  }
  function ligne(label, key, req, hint){
    return '<tr><td style="vertical-align:top;"><strong>'+esc(label)+'</strong>'+(req?' <span style="color:var(--danger,#c0392b);" title="Obligatoire">*</span>':'')+
      (hint?'<div class="hint" style="margin:2px 0 0;font-size:11.5px;">'+esc(hint)+'</div>':'')+'</td>'+
      '<td>'+selectHtml(key, req)+'</td><td>'+apercu(m[key])+'</td></tr>';
  }
  var segs = implSegmentsContrat(impLiv.ctrId);
  var nouvelles = impLiv.ctrId ? implValeursNouvelles() : [];
  var indiceSplit = splitOn && impLiv.split.positions.some(function(p){ return p.role==='indice'; });
  var champsOk = m.designation!=='' && m.code!=='' && m.designation!==undefined && m.code!==undefined && (indiceSplit || (m.indice!=='' && m.indice!==undefined));
  var aperc = '';
  if(champsOk){
    var sg = splitOn ? [] : segs.filter(function(s){ return m['seg:'+s.id]!=='' && m['seg:'+s.id]!==undefined; });
    aperc = '<div class="field"><label>Aperçu des 5 premières lignes avec cette correspondance</label><div class="table-wrap"><table><thead><tr><th>Désignation</th><th>Code</th><th>Indice</th>'+
      (m.categorie!==''&&m.categorie!==undefined?'<th>Catégorie</th>':'')+(m.statut!==''&&m.statut!==undefined?'<th>Statut</th>':'')+
      sg.map(function(s){ return '<th>'+esc(s.nom)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      t.rows.slice(0,5).map(function(row){
        return '<tr><td>'+esc(implValeurColonne(row,m.designation))+'</td><td class="num">'+esc(implValeurColonne(row,m.code))+'</td><td>'+esc(implValeurColonne(row,m.indice))+'</td>'+
          (m.categorie!==''&&m.categorie!==undefined?'<td>'+esc(implValeurColonne(row,m.categorie))+'</td>':'')+
          (m.statut!==''&&m.statut!==undefined?'<td>'+esc(implValeurColonne(row,m.statut))+'</td>':'')+
          sg.map(function(s){ return '<td>'+esc(implValeurColonne(row,m['seg:'+s.id]))+'</td>'; }).join('')+'</tr>';
      }).join('')+'</tbody></table></div></div>';
  }
  var resume = '';
  if(champsOk && impLiv.ctrId){
    try {
      if(!splitOn || !implSplitValide()){
        implConstruireLivrables();
        resume = implResumeHtml(implCalculerPlan(impLiv.ctrId), t.rows.length);
      }
    } catch(e){ console.error(e); }
  }
  zone.innerHTML =
    '<p class="hint">Feuille « '+esc(t.sheet)+' » : <strong>'+t.rows.length+'</strong> ligne(s) de données, <strong>'+t.columns.length+'</strong> colonne(s) (en-têtes en ligne '+t.headerRow+')'+(t.truncated?' — <strong>fichier tronqué aux 5000 premières lignes</strong>':'')+'.</p>'+
    '<div class="field-row grid-2">'+
      '<div class="field"><label for="impc-hdr">Ligne des en-têtes (titres des colonnes)</label><div style="display:flex;gap:8px;"><input type="number" min="1" id="impc-hdr" value="'+t.headerRow+'" style="width:90px;"><button type="button" class="btn" id="impc-hdr-go">Relire</button></div><p class="hint">Détectée automatiquement ; indiquez un autre numéro de ligne si les titres ne sont pas là.</p></div>'+
      (t.sheets.length>1 ? '<div class="field"><label for="impc-sheet">Feuille à importer</label><select id="impc-sheet">'+t.sheets.map(function(n){ return '<option value="'+esc(n)+'"'+(n===t.sheet?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select></div>' : '')+
      '<div class="field"><label for="impc-ctr">Contrat de rattachement <span style="color:var(--danger,#c0392b);">*</span></label><select id="impc-ctr">'+projetsOptionsHtml(impLiv.ctrId, undefined, '', true)+'</select>'+
        '<p class="hint">Contrat, ou devis si le marché n’est pas encore gagné. Détermine les segments de codification proposés ci-dessous.</p></div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Champ de l’application</th><th>Colonne du fichier</th><th>Aperçu des valeurs</th></tr></thead><tbody>'+
      IMPL_CHAMPS.map(function(c){ return ligne(c.label, c.key, c.req, c.hint); }).join('')+
      (splitOn ? '<tr><td colspan="3" class="muted" style="font-size:12.5px;">Les segments de codification sont lus dans le découpage du code client (ci-dessous).</td></tr>'
        : (impLiv.ctrId ? segs.map(function(s){ return ligne('Segment « '+s.nom+' »', 'seg:'+s.id, false, ''); }).join('')
        : '<tr><td colspan="3" class="muted" style="font-size:12.5px;">Choisissez d’abord un contrat pour associer des colonnes à ses segments de codification (Zone, Niveau, Discipline…).</td></tr>'))+
    '</tbody></table></div>'+
    implSplitHtml()+
    (nouvelles.length ?
      '<div class="field" style="margin-top:12px;"><div class="hint" style="color:var(--warning-text,#b9770e);"><strong>Valeurs absentes des listes du contrat :</strong> '+
        nouvelles.map(function(x){ return esc(x.seg.nom)+' → '+x.valeurs.map(esc).join(', '); }).join(' ; ')+'</div>'+
      '<label style="display:flex;gap:8px;align-items:center;margin-top:6px;"><input type="checkbox" id="impc-ajout"'+(impLiv.ajouterValeurs?' checked':'')+'> Ajouter automatiquement ces valeurs aux listes du segment (sinon, elles ne sont pas importées)</label></div>' : '')+
    aperc+resume+
    '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">'+
      '<button type="button" class="btn" id="impc-cancel">Annuler</button>'+
      '<button type="button" class="btn btn-primary" id="impc-next">Continuer</button>'+
    '</div>';

  var sh = byId('impc-sheet');
  if(sh) sh.addEventListener('change', function(){ chargerTableImportLivrables(sh.value, false); });
  byId('impc-ctr').addEventListener('change', function(e){
    impLiv.ctrId = e.target.value;
    // les colonnes deja choisies pour les champs fixes sont conservees ; les
    // segments sont reproposes pour le nouveau contrat
    var garde = {}; Object.keys(impLiv.mapping).forEach(function(k){ if(k.indexOf('seg:')!==0) garde[k] = impLiv.mapping[k]; });
    impLiv.mapping = implProposerCorrespondance(garde);
    renderImportColonnesScreen();
  });
  zone.querySelectorAll('.impc-sel').forEach(function(sel){
    sel.addEventListener('change', function(){
      impLiv.mapping[sel.getAttribute('data-key')] = sel.value==='' ? '' : parseInt(sel.value, 10);
      renderImportColonnesScreen();
    });
  });
  var aj = byId('impc-ajout'); if(aj) aj.addEventListener('change', function(){ impLiv.ajouterValeurs = aj.checked; });
  var hg = byId('impc-hdr-go');
  if(hg) hg.addEventListener('click', function(){ chargerTableImportLivrables(t.sheet, false, parseInt(byId('impc-hdr').value,10)||0); });
  var sa = byId('imps-actif');
  if(sa) sa.addEventListener('change', function(){ impLiv.split.actif = sa.checked; renderImportColonnesScreen(); });
  zone.querySelectorAll('.imps-nom').forEach(function(inp){ inp.addEventListener('change', function(){ impLiv.split.positions[parseInt(inp.getAttribute('data-k'),10)].nom = inp.value; renderImportColonnesScreen(); }); });
  zone.querySelectorAll('.imps-role').forEach(function(sel){ sel.addEventListener('change', function(){ impLiv.split.positions[parseInt(sel.getAttribute('data-k'),10)].role = sel.value; renderImportColonnesScreen(); }); });
  byId('impc-cancel').addEventListener('click', closeModal);
  byId('impc-next').addEventListener('click', function(){
    if(!impLiv.ctrId){ toast('Veuillez choisir un contrat', 'danger'); return; }
    if(!champsOk){ toast('Associez une colonne à la désignation, au code et à l’indice', 'danger'); return; }
    if(implSplitActif()){ var errS = implSplitValide(); if(errS){ toast(errS, 'danger'); return; } }
    implConstruireLivrables();
    if(!impLiv.parsed.livrables.length){ toast('Aucune ligne exploitable avec cette correspondance (désignation et code non vides requis)', 'danger'); return; }
    renderImportMappingScreen();
  });
}

function renderImportMappingScreen(){
  var zone = byId('impl-zone');
  if(!zone || !impLiv || !impLiv.parsed) return;
  var p = impLiv.parsed;
  var nbHist = Object.keys(p.historique||{}).length;
  var nbRess = p.livrables.filter(function(l){ return l.ressourcesTexte; }).length;
  // V2.20 : le destinataire/l'etat de transmission ne servent qu'a
  // reconstituer des bordereaux depuis un historique d'envois (feuille
  // "Gestion des versions") - inutiles pour un classeur sans envois.
  var aEnvois = p.livrables.some(function(l){ return (p.historique[l.codeDocument]||[]).some(function(e){ return e.dateEnvoi; }); });

  function destinatairesDisponibles(ctrId){
    var ctr = projetParId(ctrId);
    var list = (ctr && Array.isArray(ctr.destinataires)) ? ctr.destinataires.slice() : [];
    impLiv.destinatairesAjoutesSession.filter(function(d){ return projetIdDe(d)===ctrId; }).forEach(function(d){
      if(!list.some(function(x){ return x.id===d.id; })) list.push(d);
    });
    return list;
  }

  function destSectionHtml(ctrId){
    if(!aEnvois) return '<p class="hint">Aucun envoi daté dans ce classeur : aucun bordereau ne sera reconstitué (pas de destinataire à choisir).</p>';
    var destinataires = ctrId ? destinatairesDisponibles(ctrId) : [];
    return '<div class="field-row grid-2">'+
        '<div class="field"><label for="impl-dest">Destinataire des envois reconstitués</label><select id="impl-dest" '+(ctrId?'':'disabled')+'><option value="">— Choisir —</option>'+
          destinataires.map(function(d){ return '<option value="'+d.id+'">'+esc(d.nom)+' — '+esc(d.categorie)+'</option>'; }).join('')+
          '<option value="__new__">+ Nouveau destinataire…</option>'+
        '</select></div>'+
        '<div class="field"><label for="impl-etat">État de transmission par défaut</label><select id="impl-etat">'+
          BORDEREAU_ETATS.map(function(s){ return '<option value="'+s.id+'">'+esc(s.label)+'</option>'; }).join('')+
        '</select><p class="hint">Le classeur ne précise jamais à qui un envoi a été fait ni à quel titre — seulement qu’il a eu lieu (et son éventuel retour) : ce destinataire et cet état par défaut s’appliquent à tous les envois reconstitués.</p></div>'+
      '</div>'+
      '<div class="field" id="impl-dest-new" style="display:none;">'+
        '<label for="impl-dest-nom">Nom du nouveau destinataire</label>'+
        '<div class="field-row grid-2" style="gap:6px;">'+
          '<input id="impl-dest-nom" placeholder="ex. JESA — Service études">'+
          '<select id="impl-dest-cat">'+DESTINATAIRE_CATEGORIES.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')+'</select>'+
        '</div>'+
      '</div>';
  }

  function codifWarnHtml(ctrId){
    if(!implSplitActif()) return '';
    var ctrW = projetParId(ctrId); if(!ctrW) return '';
    var mm = implMessageCodification(ctrW);
    return '<div class="field" style="border:1px solid var(--danger,#c0392b);border-radius:8px;padding:10px 12px;background:rgba(192,57,43,.06);">'+
      '<strong>La codification du contrat '+esc(ctrW.numero)+' va être remplacée par celle du code client.</strong>'+
      '<div class="hint" style="margin:4px 0 0;">'+esc(mm.anciens)+'<br>'+esc(mm.nouveaux)+(mm.livrables?'<br>'+esc(mm.livrables):'')+'</div>'+
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="checkbox" style="width:auto;margin:0;flex:none;" id="impl-confirm-codif"> Je confirme le remplacement de la codification de ce contrat</label></div>';
  }
  function personnelSectionHtml(){
    if(!p.initiales.length) return '<p class="hint">Aucune initiale de ressource trouvée dans ce classeur — aucune personne ne sera affectée à l’import.</p>';
    return '<div class="field"><label>Correspondance avec le registre Personnel</label>'+
      '<p class="hint" style="margin-top:0;">Pour chaque initiale trouvée dans la colonne « Ressources » du classeur, choisissez une fiche existante, créez-en une minimale à la volée, ou ignorez (aucune affectation pour cette initiale).</p>'+
      '<div class="table-wrap"><table><thead><tr><th>Initiale</th><th>Correspondance</th><th>Nom / Fonction (si nouvelle fiche)</th></tr></thead><tbody>'+
      p.initiales.map(function(ini){
        return '<tr>'+
          '<td class="num" style="font-weight:600;">'+esc(ini)+'</td>'+
          '<td><select class="impl-pers-sel" data-ini="'+esc(ini)+'" style="min-width:220px;">'+
            '<option value="">— Ignorer (aucune affectation) —</option>'+
            STATE.personnelLight.map(function(per){ return '<option value="'+esc(per.id)+'">'+esc(per.nom)+(per.fonction?' — '+esc(per.fonction):'')+'</option>'; }).join('')+
            '<option value="__new__">+ Nouvelle fiche minimale…</option>'+
          '</select></td>'+
          '<td><div class="field-row grid-2" style="gap:6px;display:none;" id="impl-pers-new-'+esc(ini)+'">'+
            '<input id="impl-pers-nom-'+esc(ini)+'" placeholder="Nom complet">'+
            '<input id="impl-pers-fct-'+esc(ini)+'" placeholder="Fonction (optionnel)">'+
          '</div></td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div></div>';
  }

  function render(){
    var ctrId = impLiv.ctrId;
    var ig = impLiv.ignores || {vides:0, doublons:0, statutInconnu:0};
    var ignTxt = [];
    if(ig.vides) ignTxt.push(ig.vides+' ligne(s) sans désignation ou sans code ignorée(s)');
    if(ig.doublons) ignTxt.push(ig.doublons+' doublon(s) de code ignoré(s)');
    if(ig.atypiques) ignTxt.push(ig.atypiques+' ligne(s) dont le code n’a pas le bon nombre d’éléments ignorée(s)');
    if(ig.statutInconnu) ignTxt.push(ig.statutInconnu+' statut(s) non reconnu(s) laissé(s) vide(s)');
    zone.innerHTML =
      '<p class="hint">'+p.livrables.length+' livrable(s) détecté(s), dont '+nbHist+' avec un historique de révisions reconstitué et '+nbRess+' avec au moins une ressource identifiée.'+(ignTxt.length?' <strong>'+esc(ignTxt.join(' ; '))+'.</strong>':'')+'</p>'+
      '<div class="field"><label for="impl-ctr">Contrat de rattachement</label><select id="impl-ctr" disabled>'+projetsOptionsHtml(ctrId, undefined, '', true)+'</select>'+
        '<p class="hint">Tous les livrables de ce classeur seront rattachés à ce contrat (choisi à l’étape précédente).</p>'+
      '</div>'+
      implPlanHtml(ctrId)+
      codifWarnHtml(ctrId)+
      destSectionHtml(ctrId)+
      personnelSectionHtml()+
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">'+
        '<button type="button" class="btn" id="impl-back" style="margin-right:auto;">← Correspondance des colonnes</button>'+
        '<button type="button" class="btn" id="impl-cancel">Annuler</button>'+
        '<button type="button" class="btn btn-primary" id="impl-confirm">Importer '+p.livrables.length+' livrable(s)</button>'+
      '</div>'+
      '<div id="impl-progress" class="hint" style="margin-top:10px;"></div>';

    byId('impl-back').addEventListener('click', renderImportColonnesScreen);
    var destSel = byId('impl-dest');
    if(destSel) destSel.addEventListener('change', function(){
      byId('impl-dest-new').style.display = destSel.value==='__new__' ? '' : 'none';
    });
    zone.querySelectorAll('.impl-pers-sel').forEach(function(sel){
      sel.addEventListener('change', function(){
        var ini = sel.getAttribute('data-ini');
        byId('impl-pers-new-'+ini).style.display = sel.value==='__new__' ? '' : 'none';
      });
    });
    byId('impl-cancel').addEventListener('click', closeModal);
    byId('impl-confirm').addEventListener('click', runImportLivrablesExcel);
  }
  render();
}


// V3.50 : cle de comparaison d'un code (un code ne doit exister qu'UNE fois) :
// espaces retires, majuscules, toutes les variantes d'apostrophe unifiees.
function implCle(c){
  return String(c==null?'':c).normalize('NFC').replace(/[’‘ʼ′´`ʹ]/g, "'").replace(/\s+/g,'').toUpperCase();
}
// Compare le fichier a ce qui existe deja pour le contrat/devis choisi.
// Retourne {aImporter (sans doublon), doublonsFichier, nouveaux, modifies, inchanges, absents, doublonsExistants, existantParCle, nbExistants}.
function implCalculerPlan(ctrId){
  var parsed = (impLiv && impLiv.parsed) ? impLiv.parsed.livrables : [];
  var existants = STATE.livrables.filter(function(x){ return projetIdDe(x)===ctrId; });
  var plan = {aImporter:[], doublonsFichier:[], nouveaux:[], modifies:[], inchanges:[], absents:[], doublonsExistants:[], existantParCle:{}, nbExistants: existants.length};
  // doublons deja presents en base : on garde la fiche la plus ancienne
  var groupes = {};
  existants.forEach(function(x){
    var k = implCle(x.referenceClient || x.codeComplet);
    if(!k) return;
    (groupes[k] = groupes[k] || []).push(x);
  });
  Object.keys(groupes).forEach(function(k){
    var g = groupes[k].slice().sort(function(a,b){ return String(a.createdAt||'').localeCompare(String(b.createdAt||'')); });
    plan.existantParCle[k] = g[0];
    for(var i=1;i<g.length;i++) plan.doublonsExistants.push({code: g[i].referenceClient||g[i].codeComplet, id: g[i].id, garde: g[0].id});
  });
  var vus = {};
  parsed.forEach(function(l){
    var k = implCle(l.codeDocument);
    if(vus[k]){ plan.doublonsFichier.push(l.codeDocument); return; }
    vus[k] = true;
    plan.aImporter.push(l);
    var ex = plan.existantParCle[k];
    if(!ex){ plan.nouveaux.push(l); return; }
    var ch = [];
    function cmp(label, ancien, nouveau){ if(String(ancien||'').trim()!==String(nouveau||'').trim()) ch.push({champ:label, de:ancien||'—', a:nouveau||'—'}); }
    cmp('Désignation', ex.designation, l.designation);
    cmp('Indice', ex.indiceRevision, l.indiceCourant);
    if(l.categorie) cmp('Catégorie', ex.categorie, l.categorie);
    if(l.statutAbr) cmp('Statut', ex.statut, l.statutAbr);
    if(implCle(ex.referenceClient)!==k || ex.referenceClient!==l.codeDocument) cmp('Référence client', ex.referenceClient, l.codeDocument);
    if(l.segments){
      var sv = ex.segmentsValeurs || {};
      var diffSeg = Object.keys(l.segments).filter(function(sid){ return l.segments[sid] && String(sv[sid]||'')!==String(l.segments[sid]); });
      if(diffSeg.length) ch.push({champ:'Segments du code', de:diffSeg.map(function(sid){ return sv[sid]||'—'; }).join(' · '), a:diffSeg.map(function(sid){ return l.segments[sid]; }).join(' · ')});
    }
    if(ch.length) plan.modifies.push({l:l, ex:ex, changes:ch}); else plan.inchanges.push(l);
  });
  Object.keys(plan.existantParCle).forEach(function(k){
    if(!vus[k] && (plan.existantParCle[k].referenceClient || plan.existantParCle[k].creePar==='Import Excel')) plan.absents.push(plan.existantParCle[k]);
  });
  return plan;
}
function implResumeHtml(pl, nbLignesFichier){
  var imp = pl.nouveaux.length + pl.modifies.length + pl.inchanges.length;
  return '<div class="field" style="border:1px solid var(--accent,#1f4e79);border-radius:8px;padding:10px 12px;background:rgba(31,78,121,.05);">'+
    '<strong>'+imp+' ligne(s) seront importées</strong> sur '+nbLignesFichier+' ligne(s) de données du fichier'+
    '<div style="margin-top:4px;">'+
      '<span class="pill pill-success">'+pl.nouveaux.length+' ajoutée(s)</span> '+
      '<span class="pill pill-warning">'+pl.modifies.length+' modifiée(s)</span> '+
      '<span class="pill pill-neutral">'+pl.inchanges.length+' inchangée(s)</span> '+
      '<span class="pill pill-danger" title="Supprimées uniquement si vous cochez la suppression à l’étape suivante">'+(pl.absents.length+pl.doublonsExistants.length)+' à supprimer ?</span>'+
    '</div>'+
    '<div class="hint" style="margin:6px 0 0;">'+
      (nbLignesFichier-imp-pl.doublonsFichier.length>0 ? (nbLignesFichier-imp-pl.doublonsFichier.length)+' ligne(s) ignorée(s) (désignation ou code vide, code hors format). ' : '')+
      (pl.doublonsFichier.length?pl.doublonsFichier.length+' doublon(s) de code dans le fichier ignoré(s). ':'')+
      (pl.absents.length?pl.absents.length+' livrable(s) existant(s) absent(s) du fichier ; ':'')+
      (pl.doublonsExistants.length?pl.doublonsExistants.length+' doublon(s) déjà en base. ':'')+
      'Rien n’est supprimé sans votre confirmation à l’étape suivante.</div>'+
  '</div>';
}
function implPlanHtml(ctrId){
  if(!ctrId) return '';
  var pl = implCalculerPlan(ctrId);
  impLiv.plan = pl;
  var dejaImporte = pl.nbExistants>0;
  function liste(titre, items, rendu, ouvert){
    if(!items.length) return '';
    return '<details'+(ouvert?' open':'')+' style="margin:6px 0;"><summary><strong>'+esc(titre)+' ('+items.length+')</strong></summary>'+
      '<div style="max-height:200px;overflow:auto;font-size:12px;margin-top:4px;">'+items.map(rendu).join('')+'</div></details>';
  }
  var html = implResumeHtml(pl, (impLiv.table && impLiv.table.rows ? impLiv.table.rows.length : pl.aImporter.length))+
    '<div class="field" style="border:1px solid var(--border,#ccc);border-radius:8px;padding:10px 12px;">'+
    '<strong>Comparaison avec les livrables déjà enregistrés pour ce contrat</strong>'+
    '<div class="hint" style="margin:4px 0 6px;">'+
      pl.nouveaux.length+' nouveau(x) · '+pl.modifies.length+' modifié(s) · '+pl.inchanges.length+' inchangé(s) · '+pl.absents.length+' absent(s) du fichier'+
      (pl.doublonsFichier.length?' · '+pl.doublonsFichier.length+' doublon(s) dans le fichier ignoré(s)':'')+
      (pl.doublonsExistants.length?' · '+pl.doublonsExistants.length+' doublon(s) déjà en base':'')+'</div>'+
    liste('Nouveaux', pl.nouveaux, function(l){ return '<div class="num">'+esc(l.codeDocument)+' — '+esc(l.designation)+'</div>'; }, !dejaImporte && false)+
    liste('Modifiés', pl.modifies, function(m){ return '<div style="margin-bottom:4px;"><span class="num"><b>'+esc(m.l.codeDocument)+'</b></span>'+m.changes.map(function(c){ return '<div class="muted">· '+esc(c.champ)+' : '+esc(c.de)+' → <b>'+esc(c.a)+'</b></div>'; }).join('')+'</div>'; }, true)+
    liste('Absents du fichier (présents en base)', pl.absents, function(x){ return '<div class="num">'+esc(x.referenceClient||x.codeComplet)+' — '+esc(x.designation)+'</div>'; }, true)+
    liste('Doublons ignorés dans le fichier', pl.doublonsFichier, function(c){ return '<div class="num">'+esc(c)+'</div>'; }, false)+
    liste('Doublons déjà en base (même code)', pl.doublonsExistants, function(d){ return '<div class="num">'+esc(d.code)+'</div>'; }, true);
  if(pl.doublonsExistants.length) html += '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;"><input type="checkbox" style="width:auto;margin:0;flex:none;" id="impl-del-dbl" checked> Supprimer les '+pl.doublonsExistants.length+' doublon(s) en base (on garde la fiche la plus ancienne de chaque code)</label>';
  if(pl.absents.length) html += '<label style="display:flex;gap:8px;align-items:center;margin-top:6px;"><input type="checkbox" style="width:auto;margin:0;flex:none;" id="impl-del-abs"> Supprimer les '+pl.absents.length+' livrable(s) absent(s) du fichier (laissé décoché : ils sont conservés)</label>';
  if(dejaImporte) html += '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:600;"><input type="checkbox" style="width:auto;margin:0;flex:none;" id="impl-confirm-plan"> J’ai vérifié les changements ci-dessus et je confirme l’import</label>';
  return html + '</div>';
}

function runImportLivrablesExcel(){
  var ctrId = byId('impl-ctr').value;
  if(!ctrId){ toast('Veuillez choisir un contrat ou un devis', 'danger'); return; }
  var ctr = projetParId(ctrId);
  if(!ctr){ toast('Contrat introuvable', 'danger'); return; }
  var destSel = byId('impl-dest');
  var destId = destSel ? destSel.value : '';
  if(destSel && !destId){ toast('Veuillez choisir (ou créer) un destinataire', 'danger'); return; }
  var etatDefaut = byId('impl-etat') ? byId('impl-etat').value : 'PI';
  var cbPlan = byId('impl-confirm-plan');
  if(cbPlan && !cbPlan.checked){ toast('Cochez la confirmation après vérification des changements', 'danger'); return; }
  impLiv.supprimerIds = [];
  if(impLiv.plan){
    if(byId('impl-del-dbl') && byId('impl-del-dbl').checked) impLiv.plan.doublonsExistants.forEach(function(d){ impLiv.supprimerIds.push(d.id); });
    if(byId('impl-del-abs') && byId('impl-del-abs').checked) impLiv.plan.absents.forEach(function(x){ impLiv.supprimerIds.push(x.id); });
  }
  var progress = byId('impl-progress');
  progress.textContent = 'Préparation…';

  function resolveDestinataire(){
    if(!destSel) return Promise.resolve(null); // aucun envoi a reconstituer (V2.20)
    if(destId !== '__new__'){
      var d = ((ctr.destinataires)||[]).concat(impLiv.destinatairesAjoutesSession.filter(function(x){ return projetIdDe(x)===ctrId; }))
        .find(function(x){ return x.id===destId; });
      return d ? Promise.resolve(d) : Promise.reject(new Error('Destinataire introuvable'));
    }
    var nom = byId('impl-dest-nom').value.trim();
    if(!nom) return Promise.reject(new Error('Nom du nouveau destinataire requis'));
    var categorie = byId('impl-dest-cat').value;
    return addDestinataireContrat(ctrId, nom, categorie).then(function(d){
      impLiv.destinatairesAjoutesSession.push(Object.assign({ctrId:ctrId}, d));
      return d;
    });
  }

  function resolvePersonnel(){
    var initiales = impLiv.parsed.initiales;
    return initiales.reduce(function(acc, ini){
      return acc.then(function(map){
        var selEl = document.querySelector('.impl-pers-sel[data-ini="'+ini+'"]');
        var val = selEl ? selEl.value : '';
        if(!val){ map[ini] = null; return map; }
        if(val === '__new__'){
          var nomInp = byId('impl-pers-nom-'+ini);
          var nom = nomInp ? nomInp.value.trim() : '';
          if(!nom){ map[ini] = null; return map; }
          var fctInp = byId('impl-pers-fct-'+ini);
          var fonction = fctInp ? fctInp.value.trim() : '';
          return savePersonnel({nom:nom, fonction:fonction, actif:true}, null).then(function(ref){
            map[ini] = {id:ref.id, nom:nom, fonction:fonction};
            return map;
          });
        }
        var per = STATE.personnelLight.find(function(x){ return x.id===val; });
        map[ini] = per ? {id:per.id, nom:per.nom, fonction:per.fonction} : null;
        return map;
      });
    }, Promise.resolve({}));
  }

  // V2.21 : remplacement de la codification du contrat -> confirmation
  // prealable (case a cocher affichee dans l'assistant lui-meme).
  function confirmerCodification(){
    if(!implSplitActif()) return Promise.resolve(true);
    var cb = byId('impl-confirm-codif');
    if(cb && cb.checked) return Promise.resolve(true);
    toast('Cochez la confirmation du remplacement de la codification du contrat', 'danger');
    return Promise.resolve(false);
  }
  confirmerCodification().then(function(okCodif){
    if(!okCodif){ progress.textContent = ''; return null; }
    return Promise.all([resolveDestinataire(), resolvePersonnel()]);
  }).then(function(results){
    if(!results) return;
    var dest = results[0], personnelParInitiale = results[1];
    chargerPersonnelLight();
    return preparerSegmentsImport(ctr).then(function(ctrMaj){
      return importerLivrablesEtBordereaux(ctrMaj, dest, etatDefaut, personnelParInitiale, progress);
    });
  }).catch(function(err){
    console.error(err); toast('Erreur : '+err.message, 'danger');
  });
}

// V2.20 : valeurs des segments de codification lues dans les colonnes
// associees. Une valeur deja presente dans la liste du segment (casse
// ignoree) est reprise sous sa forme canonique ; une valeur absente est
// ajoutee a la liste du segment du contrat (si la case a ete laissee
// cochee a l'ecran de correspondance), sinon elle n'est pas importee.
function preparerSegmentsImport(ctr){
  if(implSplitActif()){
    // V2.21 : la codification du contrat est REMPLACEE par celle du code
    // client (segments + valeurs + composition = code client uniquement).
    var sp = impLiv.split;
    var segsNew = sp.positions.filter(function(p){ return p.role==='seg'; }).map(function(p){
      return {id:p.segId, nom:p.nomFinal, valeurs:p.valeurs.map(function(x){ return x.v; })};
    });
    var compo = sp.positions.map(function(p){ return p.role==='seg' ? p.segId : p.role; });
    // V2.22 : les segments fixes absents du code client (numero de contrat,
    // type de document...) sont SUPPRIMES de la liste du contrat.
    var retires = CODIFICATION_SEGMENTS_FIXES.map(function(f){ return f.id; }).filter(function(id){ return compo.indexOf(id)<0; });
    impLiv.parsed.livrables.forEach(function(l){ l.segmentsValeurs = l.segments || {}; });
    return STATE.db.doc(projetDocPath(ctr)).update({segmentsPersonnalises: segsNew, codificationSegments: compo, segmentsFixesRetires: retires, updatedAt: nowISO()}).then(function(){
      return Object.assign({}, ctr, {segmentsPersonnalises: segsNew, codificationSegments: compo, segmentsFixesRetires: retires});
    });
  }
  var m = impLiv.mapping || {};
  var segs = segmentsPersonnalisesDuContrat(ctr).map(function(s){ return {id:s.id, nom:s.nom, valeurs:(s.valeurs||[]).slice()}; });
  var actifs = segs.filter(function(s){ return m['seg:'+s.id]!=='' && m['seg:'+s.id]!==undefined; });
  var ajouts = 0;
  impLiv.parsed.livrables.forEach(function(l){
    l.segmentsValeurs = {};
    actifs.forEach(function(s){
      var v = (l.segments && l.segments[s.id]) || '';
      if(!v) return;
      var connue = s.valeurs.find(function(x){ return String(x).toLowerCase()===v.toLowerCase(); });
      if(connue!==undefined){ l.segmentsValeurs[s.id] = connue; return; }
      if(!impLiv.ajouterValeurs) return;
      s.valeurs.push(v); ajouts++; l.segmentsValeurs[s.id] = v;
    });
  });
  if(!ajouts) return Promise.resolve(ctr);
  return STATE.db.doc(projetDocPath(ctr)).update({segmentsPersonnalises: segs, updatedAt: nowISO()}).then(function(){
    return Object.assign({}, ctr, {segmentsPersonnalises: segs});
  });
}

function importerLivrablesEtBordereaux(ctr, dest, etatDefaut, personnelParInitiale, progress){
  var planImp = impLiv.plan || implCalculerPlan(ctr.id);
  var livrablesParsed = planImp.aImporter;
  var historiqueParsed = impLiv.parsed.historique;
  var crees = 0, maj = 0;
  var initialesNonMappees = {};
  var transmissions = [];

  function entriesFor(l){
    var raw = historiqueParsed[l.codeDocument];
    if(!raw || !raw.length) return [{indice: l.indiceCourant||'A', dateEnvoi:null, dateRetour:null, statutRetour:null}];
    return raw.slice().sort(function(a,b){ return (a.indice||'').localeCompare(b.indice||''); });
  }
  function buildHistorique(l){
    return entriesFor(l).map(function(e){
      return {
        indice: e.indice, date: e.dateEnvoi||null, par: 'Import Excel',
        budgetHeures: (e.indice===l.indiceCourant && typeof l.budgetHeures==='number') ? l.budgetHeures : null
      };
    });
  }
  function registerTransmissions(l, livId, livCode){
    entriesFor(l).forEach(function(e){
      if(!e.dateEnvoi) return;
      transmissions.push({livId:livId, livCode:livCode, livDesignation:l.designation, indice:e.indice, dateEnvoi:e.dateEnvoi, dateRetour:e.dateRetour, statutRetour:e.statutRetour});
    });
  }
  function resolveAffectations(texte){
    if(!texte) return [];
    var out = [];
    texte.replace(/,/g, '/').split('/').forEach(function(part){
      part = part.trim();
      if(!part) return;
      var per = personnelParInitiale[part];
      if(per) out.push(per); else initialesNonMappees[part] = true;
    });
    return out;
  }

  function next(i){
    if(i >= livrablesParsed.length) return supprimerSelection().then(creerBordereaux);
    var l = livrablesParsed[i];
    progress.textContent = 'Import des livrables… ('+(i+1)+'/'+livrablesParsed.length+')';
    var existing = planImp.existantParCle[implCle(l.codeDocument)];
    var hist = buildHistorique(l);
    var affectations = resolveAffectations(l.ressourcesTexte);
    // V2.20 : statut laisse VIDE quand le classeur n'en fournit pas (decision
    // de l'utilisateur) ; a la mise a jour, un statut/une categorie vide dans
    // le classeur n'ecrase jamais la valeur deja saisie dans l'application.
    var statut = l.statutAbr || '';

    if(existing){
      var dataMaj = {
        designation: l.designation,
        indiceRevision: l.indiceCourant, referenceClient: l.codeDocument,
        historiqueIndices: hist, affectations: affectations,
        updatedAt: nowISO()
      };
      if(l.categorie) dataMaj.categorie = l.categorie;
      if(statut) dataMaj.statut = statut;
      if(implSplitActif()){
        dataMaj.segmentsValeurs = l.segmentsValeurs || {};
        if(l.numeroSeqTexte) dataMaj.numeroSeqTexte = l.numeroSeqTexte;
      } else if(l.segmentsValeurs && Object.keys(l.segmentsValeurs).length) dataMaj.segmentsValeurs = Object.assign({}, existing.segmentsValeurs||{}, l.segmentsValeurs);
      // V1.73 : signature objet - `existing` porte deja ses segments
      // personnalises eventuels (segmentsValeurs, ou l'ancien zone/niveau/
      // discipline en repli) ; seul l'indice change ici (celui qui vient
      // d'etre importe).
      dataMaj.codeComplet = livrableCode(Object.assign({}, existing, dataMaj, {indiceRevision: l.indiceCourant}), ctr);
      return STATE.db.doc('livrables/'+existing.id).update(dataMaj).then(function(){
        maj++;
        registerTransmissions(l, existing.id, dataMaj.codeComplet);
        return next(i+1);
      });
    }

    var dataNew = {
      ctrId: champsProjet(ctr).ctrId, ctrNumero: champsProjet(ctr).ctrNumero, devisId: champsProjet(ctr).devisId, devisNumero: champsProjet(ctr).devisNumero, clientId: ctr.clientId, clientNom: ctr.clientNom,
      designation: l.designation, categorie: l.categorie, statut: statut,
      // V1.73 : les segments personnalises (ex. anciens "Zone"/"Niveau"/
      // "Discipline") ne sont plus renseignes a l'import - le fichier
      // source ne donne aucune valeur fiable pour des segments desormais
      // propres a chaque contrat (meme principe que pour les dates
      // planifiees, V1.66 : ne jamais fabriquer de donnee absente de la
      // source). Le code compose affiche alors "—" pour ces positions,
      // modifiable ensuite depuis la fiche du livrable si besoin.
      typeDocument: 'Autre',
      segmentsValeurs: l.segmentsValeurs || {},
      indiceRevision: l.indiceCourant, referenceClient: l.codeDocument,
      historiqueIndices: hist, affectations: affectations,
      datePlanifieeDebut: null, datePlanifieeFin: null,
      createdAt: nowISO(), creePar: 'Import Excel'
    };
    if(l.numeroSeqTexte) dataNew.numeroSeqTexte = l.numeroSeqTexte;
    return nextLocalSeq(projetCollection(ctr), ctr.id, 'livSeq').then(function(seq){
      dataNew.numeroSeq = seq;
      dataNew.codeComplet = livrableCode(dataNew, ctr);
      return STATE.db.collection('livrables').add(dataNew);
    }).then(function(ref){
      crees++;
      registerTransmissions(l, ref.id, dataNew.codeComplet);
      return next(i+1);
    });
  }

  function supprimerSelection(){
    var ids = (impLiv.supprimerIds || []).slice();
    return ids.reduce(function(acc, id){ return acc.then(function(){ return deleteDoc('livrables', id); }); }, Promise.resolve());
  }
  function creerBordereaux(){
    var parDate = {};
    transmissions.forEach(function(t){ (parDate[t.dateEnvoi] = parDate[t.dateEnvoi] || []).push(t); });
    var dates = Object.keys(parDate).sort();
    var borCrees = 0, borMaj = 0;
    // Import rejouable (meme principe que pour les livrables, ci-dessus) : un
    // bordereau deja reconstitue par un import precedent pour ce contrat et
    // cette date d'envoi (identifie par creePar==='Import Excel') est mis a
    // jour plutot que recree a l'identique - sans quoi chaque reimport du
    // meme classeur dupliquerait indefiniment le Carnet d'envois.
    function existingBordereau(date){
      return (STATE.bordereaux||[]).find(function(b){ return projetIdDe(b)===ctr.id && b.date===date && b.creePar==='Import Excel'; });
    }
    function nextBor(j){
      if(j >= dates.length) return Promise.resolve();
      progress.textContent = 'Reconstitution des bordereaux… ('+(j+1)+'/'+dates.length+')';
      var date = dates[j];
      var lignes = parDate[date].map(function(t){
        return {livId:t.livId, livCode:t.livCode, livDesignation:t.livDesignation, indice:t.indice, etat:etatDefaut, dateRetour:t.dateRetour||'', statutRetour:t.statutRetour||''};
      });
      var existingBor = existingBordereau(date);
      if(existingBor){
        var dataMaj = {
          destId: dest.id, destNom: dest.nom, destCategorie: dest.categorie,
          lignes: lignes, notes: 'Importé depuis Excel (feuille « Gestion des versions »)',
          updatedAt: nowISO()
        };
        return STATE.db.doc('bordereaux/'+existingBor.id).update(dataMaj).then(function(){
          borMaj++;
          return nextBor(j+1);
        });
      }
      var data = {
        ctrId: champsProjet(ctr).ctrId, ctrNumero: champsProjet(ctr).ctrNumero, devisId: champsProjet(ctr).devisId, devisNumero: champsProjet(ctr).devisNumero, clientId: ctr.clientId, clientNom: ctr.clientNom,
        destId: dest.id, destNom: dest.nom, destCategorie: dest.categorie,
        date: date, lignes: lignes, notes: 'Importé depuis Excel (feuille « Gestion des versions »)',
        createdAt: nowISO(), creePar: 'Import Excel'
      };
      return nextLocalSeq(projetCollection(ctr), ctr.id, 'bordereauSeq').then(function(seq){
        data.numero = ctr.numero+'-BOR'+pad2(seq);
        return STATE.db.collection('bordereaux').add(data);
      }).then(function(){
        borCrees++;
        return nextBor(j+1);
      });
    }
    return nextBor(0).then(function(){ return {crees:crees, maj:maj, borCrees:borCrees, borMaj:borMaj, initialesNonMappees:Object.keys(initialesNonMappees)}; });
  }

  return next(0).then(function(res){
    var msg = res.crees+' livrable(s) créé(s), '+res.maj+' mis à jour, '+((impLiv.supprimerIds||[]).length?(impLiv.supprimerIds.length+' supprimé(s), '):'')+res.borCrees+' bordereau(x) créé(s), '+res.borMaj+' bordereau(x) mis à jour.';
    if(res.initialesNonMappees.length) msg += ' Initiales non affectées : '+res.initialesNonMappees.join(', ')+'.';
    if(implSplitActif()) msg += ' Codification du contrat mise à jour ('+impLiv.split.positions.length+' éléments de code).';
    closeModal();
    toast(msg, 'success');
  }).catch(function(err){
    console.error(err); toast('Erreur pendant l’import : '+err.message, 'danger');
  });
}

/* =========================================================
   MODULE DE PLANIFICATION MANUELLE (Plan de charge) ET TIMESHEET (V1.70/V1.71)
   Jusqu'en V1.69, le Plan de charge etait une vue DERIVEE en lecture seule,
   reconstituee automatiquement depuis les affectations/dates planifiees et
   le budget horaire des livrables (voir repartitionChargeLivrable()/
   calculerPlanDeCharge(), retirees en V1.70). A partir de la V1.70, a la
   demande explicite de l'utilisateur, il REMPLACE cet ecran et repose sur
   sa PROPRE collection generique ("planificationLignes" - voir
   COLLECTION_SECTION dans backend/access.py, meme mecanisme que
   "bordereaux"/"backlog") : un document = une ligne = un contrat + une
   personne + un livrable + une carte {jourISO: heures}. Les heures sont
   saisies directement dans chaque case de la grille et sont totalement
   INDEPENDANTES du budget horaire de la revision courante du livrable
   (V1.63) : aucune comparaison, aucune alerte. Les samedis/dimanches
   restent visibles dans la grille (fond different) mais restent
   modifiables.
   V1.71 ajoute trois points, tous demandes explicitement par l'utilisateur :
   - une case "journee entiere" par case jour, qui remplit 8h et VERROUILLE
     la case (il faut decocher pour corriger) ;
   - un filtre par personne, en plus du filtre par contrat existant ;
   - un second ecran "Timesheet", MECANIQUEMENT IDENTIQUE au Plan de
     charge (meme grille, meme case "journee entiere", memes filtres) mais
     adossé a sa PROPRE collection ("timesheetLignes"), totalement
     independante de "planificationLignes" : le Plan de charge reste le
     PREVISIONNEL (heures prevues), le Timesheet devient le REEL (heures
     reellement passees, pointage) - aucune reprise automatique des lignes
     de l'un vers l'autre, par decision explicite de l'utilisateur.
   Les deux ecrans partagent donc un seul moteur de rendu generique
   (renderLignesHeuresEcran) et un seul formulaire d'ajout de ligne
   generique (openLigneGrilleFormModal), parametres par la collection
   cible - seuls les libelles, les ids DOM (prefixe "pdc"/"plc" pour le
   Plan de charge, inchange depuis la V1.70 pour ne pas casser le test
   dedie existant ; prefixe "tms" pour le Timesheet, nouveau) et le filtre
   module-scope (planChargeFiltre / timesheetFiltre) different.
   ========================================================= */
var MOIS_LABELS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var planChargeFiltre = {ctrId:'', personneId:'', annee:(new Date()).getFullYear(), mois:(new Date()).getMonth()};
var timesheetFiltre = {ctrId:'', personneId:'', annee:(new Date()).getFullYear(), mois:(new Date()).getMonth()};

// Met a jour (optimiste cote client + PATCH cote serveur) les heures et/ou
// l'indicateur "journee entiere" d'UN SEUL jour d'une ligne (planification
// OU timesheet, selon stateKey/collection). Le store generique (voir
// backend/routes/api.py, update_doc() : current.update(patch), fusion de
// premier niveau seulement, PAS de notation "heures.2026-11-03") impose de
// toujours reenvoyer les cartes "heures"/"joursPleins" COMPLETES (clone +
// une seule cle modifiee), jamais un patch partiel sur une sous-cle.
// patch: {heures?: nombre (0/absent => case videe), journeeEntiere?: bool}.
function updateLigneJour(stateKey, collection, ligneId, jourISO, patch){
  var ligne = (STATE[stateKey]||[]).find(function(x){ return x.id===ligneId; });
  if(!ligne) return;
  var heures = Object.assign({}, ligne.heures||{});
  var joursPleins = Object.assign({}, ligne.joursPleins||{});
  if(patch.heures !== undefined){
    if(patch.heures>0) heures[jourISO] = patch.heures; else delete heures[jourISO];
  }
  if(patch.journeeEntiere !== undefined){
    if(patch.journeeEntiere) joursPleins[jourISO] = true; else delete joursPleins[jourISO];
  }
  ligne.heures = heures; ligne.joursPleins = joursPleins; // maj locale optimiste : totaux recalcules immediatement
  scheduleRender();
  STATE.db.doc(collection+'/'+ligneId).update({heures:heures, joursPleins:joursPleins, updatedAt:nowISO()})
    .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
}

// Moteur de rendu generique partage par le Plan de charge et le Timesheet
// (V1.71) - voir le commentaire d'en-tete ci-dessus. cfg = {stateKey,
// collection, filtre, idToolbar (prefixe des ids de la barre d'outils),
// idCell (prefixe des classes/attributs de la grille), addBtnLabel,
// hintHtml, kpiLignesLabel, kpiTotalLabel, emptyLabel, openModalFn}.
function renderLignesHeuresEcran(mount, actions, cfg){
  var t = cfg.idToolbar, p = cfg.idCell;
  var canEdit = canWrite(cfg.section);
  actions.innerHTML = canEdit ? '<button type="button" class="btn btn-primary" id="btn-new-'+p+'">'+ic('plus',15)+' '+esc(cfg.addBtnLabel)+'</button>' : '';
  if(canEdit) byId('btn-new-'+p).addEventListener('click', function(){ cfg.openModalFn(cfg.filtre.ctrId, cfg.filtre.personneId); });

  var lignes = (STATE[cfg.stateKey]||[]).slice();
  if(cfg.filtre.ctrId) lignes = lignes.filter(function(l){ return projetIdDe(l)===cfg.filtre.ctrId; });
  if(cfg.filtre.personneId) lignes = lignes.filter(function(l){ return l.personneId===cfg.filtre.personneId; });
  lignes.sort(function(a,b){ return (a.personneNom||'').localeCompare(b.personneNom||'') || (a.ctrNumero||'').localeCompare(b.ctrNumero||''); });

  var jours = joursDuMois(cfg.filtre.annee, cfg.filtre.mois);
  function arrondi(n){ return Math.round(n*10)/10; }
  function heuresLigneJour(l, jourISO){ return (l.heures && l.heures[jourISO]) || 0; }
  function journeeEstPleine(l, jourISO){ return !!(l.joursPleins && l.joursPleins[jourISO]); }
  function totalLigneMois(l){ return jours.reduce(function(s,j){ return s+heuresLigneJour(l,j.date); }, 0); }
  function totalJourToutesLignes(jourISO){ return lignes.reduce(function(s,l){ return s+heuresLigneJour(l,jourISO); }, 0); }
  var totalGeneral = lignes.reduce(function(s,l){ return s+totalLigneMois(l); }, 0);

  var moisPrecedent = cfg.filtre.mois===0 ? {annee:cfg.filtre.annee-1, mois:11} : {annee:cfg.filtre.annee, mois:cfg.filtre.mois-1};
  var moisSuivant = cfg.filtre.mois===11 ? {annee:cfg.filtre.annee+1, mois:0} : {annee:cfg.filtre.annee, mois:cfg.filtre.mois+1};

  var personnesTriees = STATE.personnelLight.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<select id="'+t+'-ctr">'+projetsOptionsHtml(cfg.filtre.ctrId, 'Tous les contrats et devis', '', true)+'</select>'+
      '<select id="'+t+'-personne"><option value="">Toutes les personnes</option>'+
        personnesTriees.map(function(per){
          return '<option value="'+per.id+'"'+(cfg.filtre.personneId===per.id?' selected':'')+'>'+esc(per.nom)+(per.fonction?' — '+esc(per.fonction):'')+'</option>';
        }).join('')+
      '</select>'+
      '<button type="button" class="iconbtn" id="'+t+'-prev" title="Mois précédent">'+ic('chevron',15)+'</button>'+
      '<span style="font-weight:600;min-width:150px;text-align:center;display:inline-block;">'+MOIS_LABELS_FR[cfg.filtre.mois]+' '+cfg.filtre.annee+'</span>'+
      '<button type="button" class="iconbtn" id="'+t+'-next" title="Mois suivant" style="transform:scaleX(-1);">'+ic('chevron',15)+'</button>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">'+cfg.hintHtml+'</p>'+
    '<div class="kpi-grid">'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">'+esc(cfg.kpiLignesLabel)+'</div><div class="kpi-value">'+lignes.length+'</div></div>'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">'+esc(cfg.kpiTotalLabel)+'</div><div class="kpi-value">'+arrondi(totalGeneral)+' h</div></div>'+
    '</div>';

  if(!lignes.length){
    body += emptyState('calendar', esc(cfg.emptyLabel)+(cfg.filtre.ctrId||cfg.filtre.personneId?' pour ce filtre':'')+'.',
      canEdit ? '<button type="button" class="btn btn-primary" id="empty-new-'+p+'">'+ic('plus',15)+' '+esc(cfg.addBtnLabel)+'</button>' : '<p class="hint">Aucun droit de modification sur ce module.</p>');
  } else {
    body += '<div class="table-wrap" style="overflow-x:auto;"><table><thead><tr>'+
      '<th style="position:sticky;left:0;background:var(--surface);z-index:1;min-width:190px;">Contrat / Personne / Livrable</th>'+
      '<th class="num">Total</th>'+
      jours.map(function(j){ return '<th class="num" style="min-width:46px;'+(j.weekend?'background:var(--surface-3);':'')+'">'+(new Date(j.date+'T00:00:00')).getDate()+'</th>'; }).join('')+
      (canEdit ? '<th></th>' : '')+
    '</tr></thead><tbody>'+
      lignes.map(function(l){
        return '<tr><td style="position:sticky;left:0;background:var(--surface);z-index:1;">'+
            '<div style="font-weight:600;">'+esc(l.personneNom||'—')+'</div>'+
            '<div class="muted" style="font-size:11px;">'+esc(projetNumeroDe(l)||'—')+' — '+esc(l.livDesignation||'—')+'</div>'+
          '</td>'+
          '<td class="num" style="font-weight:600;">'+arrondi(totalLigneMois(l))+'</td>'+
          jours.map(function(j){
            var h = heuresLigneJour(l, j.date);
            var plein = journeeEstPleine(l, j.date);
            return '<td class="num" style="padding:3px;'+(j.weekend?'background:var(--surface-3);':'')+'">'+
              (canEdit ?
                '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'+
                  '<input type="number" step="0.5" min="0" class="'+p+'-heure" data-ligne="'+l.id+'" data-jour="'+j.date+'"'+(plein?' disabled':'')+' value="'+(h?h:'')+'" style="width:40px;text-align:right;border:1px solid var(--border);border-radius:4px;padding:3px 4px;background:var(--surface);">'+
                  '<input type="checkbox" class="'+p+'-journee" data-ligne="'+l.id+'" data-jour="'+j.date+'"'+(plein?' checked':'')+' title="Journée entière (8h) — décochez pour corriger" style="width:auto;margin:0;">'+
                '</div>' :
                (h?arrondi(h):'<span class="muted">—</span>'))+
            '</td>';
          }).join('')+
          (canEdit ? '<td style="white-space:nowrap;"><button type="button" class="iconbtn" data-edit-'+p+'="'+l.id+'" title="Modifier cette ligne">'+ic('pencil',14)+'</button> <button type="button" class="iconbtn" data-del-'+p+'="'+l.id+'" title="Supprimer cette ligne">'+ic('trash',14)+'</button></td>' : '')+
        '</tr>';
      }).join('')+
      '<tr><td style="position:sticky;left:0;background:var(--surface);font-weight:600;">Total</td>'+
        '<td class="num" style="font-weight:600;">'+arrondi(totalGeneral)+'</td>'+
        jours.map(function(j){ var tot=totalJourToutesLignes(j.date); return '<td class="num muted" style="'+(j.weekend?'background:var(--surface-3);':'')+'">'+(tot?arrondi(tot):'—')+'</td>'; }).join('')+
        (canEdit ? '<td></td>' : '')+
      '</tr>'+
    '</tbody></table></div>';
  }

  mount.innerHTML = body;

  function reRender(){ cfg.renderFn(mount, actions); }
  byId(t+'-ctr').addEventListener('change', function(){ cfg.filtre.ctrId = byId(t+'-ctr').value; reRender(); });
  byId(t+'-personne').addEventListener('change', function(){ cfg.filtre.personneId = byId(t+'-personne').value; reRender(); });
  byId(t+'-prev').addEventListener('click', function(){ cfg.filtre.annee = moisPrecedent.annee; cfg.filtre.mois = moisPrecedent.mois; reRender(); });
  byId(t+'-next').addEventListener('click', function(){ cfg.filtre.annee = moisSuivant.annee; cfg.filtre.mois = moisSuivant.mois; reRender(); });
  var emptyNewBtn = byId('empty-new-'+p);
  if(emptyNewBtn) emptyNewBtn.addEventListener('click', function(){ cfg.openModalFn(cfg.filtre.ctrId, cfg.filtre.personneId); });

  mount.querySelectorAll('.'+p+'-heure').forEach(function(inp){
    inp.addEventListener('change', function(){
      var val = Number(inp.value);
      if(isNaN(val) || val<0) val = 0;
      updateLigneJour(cfg.stateKey, cfg.collection, inp.getAttribute('data-ligne'), inp.getAttribute('data-jour'), {heures: val});
    });
  });
  mount.querySelectorAll('.'+p+'-journee').forEach(function(chk){
    chk.addEventListener('change', function(){
      var ligneId = chk.getAttribute('data-ligne'), jourISO = chk.getAttribute('data-jour');
      if(chk.checked) updateLigneJour(cfg.stateKey, cfg.collection, ligneId, jourISO, {heures:8, journeeEntiere:true});
      else updateLigneJour(cfg.stateKey, cfg.collection, ligneId, jourISO, {journeeEntiere:false});
    });
  });
  mount.querySelectorAll('[data-edit-'+p+']').forEach(function(b){
    b.addEventListener('click', function(){
      var ligne = (STATE[cfg.stateKey]||[]).find(function(x){ return x.id===b.getAttribute('data-edit-'+p); });
      if(ligne) cfg.openModalFn('', '', ligne);
    });
  });
  mount.querySelectorAll('[data-del-'+p+']').forEach(function(b){
    b.addEventListener('click', function(){
      var id = b.getAttribute('data-del-'+p);
      confirmDialog('Supprimer définitivement cette ligne ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
        if(!ok) return;
        deleteDoc(cfg.collection, id).then(function(){ toast('Ligne supprimée', 'success'); })
          .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
      });
    });
  });
}

function renderPlanDeCharge(mount, actions){
  renderLignesHeuresEcran(mount, actions, {
    stateKey: 'planificationLignes', collection: 'planificationLignes', section: 'planification', filtre: planChargeFiltre,
    idToolbar: 'pdc', idCell: 'plc', renderFn: renderPlanDeCharge,
    addBtnLabel: 'Ajouter une ligne',
    hintHtml: 'Saisie manuelle : pour chaque ligne (contrat + personne + livrable), indiquez le nombre d’heures par jour directement dans la grille, ou cochez « journée entière » pour 8h d’un coup (décochez pour corriger). Ces heures sont indépendantes du budget horaire du livrable — aucune comparaison n’est faite. Samedis et dimanches sont visibles (fond grisé) mais restent modifiables.',
    kpiLignesLabel: 'Lignes de planification', kpiTotalLabel: 'Charge totale saisie ce mois',
    emptyLabel: 'Aucune ligne de planification',
    openModalFn: function(ctrId, personneId, ligne){ openLigneGrilleFormModal({collection:'planificationLignes', titre:ligne?'Modifier la ligne de planification':'Nouvelle ligne de planification', successLabel:ligne?'Ligne de planification modifiée':'Ligne de planification ajoutée', ctrId:ctrId, personneId:personneId, ligne:ligne}); }
  });
}

// Formulaire d'ajout d'une ligne (Plan de charge OU Timesheet, V1.71) :
// Contrat -> (filtre ensuite les livrables actifs de ce contrat) ->
// Personne (STATE.personnelLight) + Livrable. Meme enchainement que
// openBordereauFormModal (choix du contrat d'abord, zone dynamique
// ensuite). opts = {collection, titre, successLabel, ctrId, personneId}.
//
// V1.84 : demande explicite de l'utilisateur, faite une fois le Contrat et
// la Personne deja choisis dans les filtres de la barre d'outils de l'ecran
// (Plan de charge ou Timesheet, meme demande pour les deux) : « Lorsqu on
// choisit un contrat et une personne et on ajoute une ligne on ne demande
// plus ces info on demande uniquement le livrable ». Quand les DEUX filtres
// (ctrId ET personneId, passes ici via opts) sont deja renseignes au moment
// du clic sur "Ajouter une ligne" (voir renderLignesHeuresEcran, qui les
// transmet depuis cfg.filtre), le formulaire ne redemande plus ni l'un ni
// l'autre - seul le Livrable reste a choisir, deja filtre sur le bon
// contrat. Si l'un des deux filtres est encore sur "Tous/Toutes" (ctrId ou
// personneId vide), rien ne permet de deviner lequel choisir : le
// formulaire complet d'origine (Contrat puis Personne + Livrable) reste
// alors affiche sans changement.
function openLigneGrilleFormModal(opts){
  if(!projetsTries().length){
    toast('Créez d’abord un contrat ou un devis.', 'danger'); return;
  }
  // V3.48 : chaque filtre deja choisi (projet et/ou personne) devient la valeur
  // par defaut et n'est plus redemande ; seul ce qui reste sur « Tous » est demande.
  var edition = opts.ligne || null;
  var ctrFixe = (!edition && opts.ctrId) ? projetParId(opts.ctrId) : null;
  var persFixe = (!edition && opts.personneId) ? STATE.personnelLight.find(function(p){ return p.id===opts.personneId; }) : null;
  var infos = [];
  if(ctrFixe) infos.push('<b>'+esc(ctrFixe.numero)+(ctrFixe.clientNom?' — '+esc(ctrFixe.clientNom):'')+'</b>');
  if(persFixe) infos.push('<b>'+esc(persFixe.nom)+'</b>');
  var overlay = openModal({
    title: opts.titre,
    body:
      (infos.length ? '<p class="hint" style="margin-top:0;">Déjà choisi dans les filtres : '+infos.join(' · ')+'</p>' : '')+
      (ctrFixe ? '' : '<div class="field"><label for="plf-ctr">Contrat / devis</label><select id="plf-ctr" required>'+projetsOptionsHtml(edition?projetIdDe(edition):null, undefined, '', true)+'</select></div>')+
      (persFixe ? '' : '<div class="field"><label for="plf-personne">Personne</label><select id="plf-personne" required><option value="">— Choisir —</option>'+
        STATE.personnelLight.map(function(p){ return '<option value="'+esc(p.id)+'"'+(edition&&edition.personneId===p.id?' selected':'')+'>'+esc(p.nom)+(p.fonction?' — '+esc(p.fonction):'')+(p.actif===false?' (inactif)':'')+'</option>'; }).join('')+
      '</select></div>')+
      '<div id="plf-dynamic"></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="plf-save">Enregistrer</button>'
  });
  function ctrCourant(){ return ctrFixe ? ctrFixe.id : (byId('plf-ctr') ? byId('plf-ctr').value : ''); }
  function renderDynamic(){
    var ctrId = ctrCourant();
    var zone = byId('plf-dynamic');
    if(!ctrId){ zone.innerHTML = '<p class="hint">Choisissez d’abord un contrat.</p>'; return; }
    var livrablesCtr = STATE.livrables.filter(function(l){ return projetIdDe(l)===ctrId && l.statut!=='annule'; })
      .sort(function(a,b){ return (a.codeComplet||'').localeCompare(b.codeComplet||''); });
    var ctrL = projetParId(ctrId);
    zone.innerHTML = livrablesCtr.length ?
        '<div class="field"><label for="plf-livrable">Livrable</label><select id="plf-livrable" required><option value="">— Choisir —</option>'+
          livrablesCtr.map(function(l){ return '<option value="'+l.id+'"'+(edition&&edition.livId===l.id?' selected':'')+'>'+esc(livrableCodeDuLivrable(l, ctrL)+' — '+l.designation)+'</option>'; }).join('')+
        '</select></div>'
        : '<p class="hint">Ce contrat n’a aucun livrable (non annulé).</p>';
  }
  if(!ctrFixe) byId('plf-ctr').addEventListener('change', renderDynamic);
  renderDynamic();

  byId('plf-save').addEventListener('click', function(){
    var ctrId = ctrCourant();
    var personneId = persFixe ? persFixe.id : (byId('plf-personne') ? byId('plf-personne').value : '');
    var livrableSel = byId('plf-livrable');
    if(!ctrId || !personneId || !livrableSel || !livrableSel.value){
      toast('Contrat, personne et livrable sont obligatoires', 'danger'); return;
    }
    var ctr = projetParId(ctrId);
    var personne = persFixe || STATE.personnelLight.find(function(p){ return p.id===personneId; });
    enregistrerLigne(ctrId, ctr, personneId, personne, livrableSel.value);
  });

  // Factorise l'enregistrement, commun aux deux chemins (avec ou sans
  // preselection) du formulaire ci-dessus.
  function enregistrerLigne(ctrId, ctr, personneId, personne, livrableId){
    var livrable = STATE.livrables.find(function(l){ return l.id===livrableId; });
    var data = {
      ctrId: ctr?champsProjet(ctr).ctrId:ctrId, ctrNumero: ctr?champsProjet(ctr).ctrNumero:'', devisId: ctr?champsProjet(ctr).devisId:null, devisNumero: ctr?champsProjet(ctr).devisNumero:null, clientNom: ctr?ctr.clientNom:'',
      personneId: personneId, personneNom: personne?personne.nom:'',
      livId: livrable.id, livDesignation: livrable.designation, livCode: livrableCodeDuLivrable(livrable, ctr),
      heures: {}, joursPleins: {}, createdAt: nowISO(), creePar: currentUserName()
    };
    var op;
    if(edition){
      delete data.heures; delete data.joursPleins; delete data.createdAt; delete data.creePar;
      data.updatedAt = nowISO();
      op = STATE.db.doc(opts.collection+'/'+edition.id).update(data);
    } else op = STATE.db.collection(opts.collection).add(data);
    op.then(function(){
      toast(opts.successLabel, 'success');
      closeModal();
    }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  }
}

/* =========================================================
   TIMESHEET / POINTAGE REEL DES HEURES (V1.71)
   Demande explicite de l'utilisateur : "maintenant ajouter un timesheet
   par personne a l identique du planning mais separe du planning".
   Mecaniquement identique au Plan de charge (meme grille, memes filtres,
   meme case "journee entiere") mais adosse a sa PROPRE collection
   generique ("timesheetLignes" - COLLECTION_SECTION dans
   backend/access.py, meme mecanisme que "planificationLignes") :
   totalement INDEPENDANT du Plan de charge, aucune ligne reprise
   automatiquement de l'un vers l'autre - decision explicite de
   l'utilisateur. Le Plan de charge reste le PREVISIONNEL (heures
   prevues), le Timesheet devient le REEL (heures reellement passees,
   pointage).
   ========================================================= */
function renderTimesheet(mount, actions){
  renderLignesHeuresEcran(mount, actions, {
    stateKey: 'timesheetLignes', collection: 'timesheetLignes', section: 'timesheet', filtre: timesheetFiltre,
    idToolbar: 'tms', idCell: 'tms', renderFn: renderTimesheet,
    addBtnLabel: 'Ajouter une ligne',
    hintHtml: 'Pointage réel : pour chaque ligne (contrat + personne + livrable), indiquez le nombre d’heures réellement passées par jour, ou cochez « journée entière » pour 8h d’un coup (décochez pour corriger). Écran totalement indépendant du Planning (prévisionnel) — aucune ligne n’est reprise automatiquement de l’un vers l’autre.',
    kpiLignesLabel: 'Lignes de timesheet', kpiTotalLabel: 'Heures réelles saisies ce mois',
    emptyLabel: 'Aucune ligne de timesheet',
    openModalFn: function(ctrId, personneId, ligne){ openLigneGrilleFormModal({collection:'timesheetLignes', titre:ligne?'Modifier la ligne de timesheet':'Nouvelle ligne de timesheet', successLabel:ligne?'Ligne de timesheet modifiée':'Ligne de timesheet ajoutée', ctrId:ctrId, personneId:personneId, ligne:ligne}); }
  });
}

/* =========================================================
   CARNET D'ENVOIS / BORDEREAUX DE TRANSMISSION (V1.60)
   Pas de section ACCESS dediee (voir NAV, accessKey:'livrables', et
   backend/access.py, COLLECTION_SECTION["bordereaux"]="livrables") : memes
   droits et meme toggle de module que Livrables techniques.
   Un bordereau est cree une fois pour toutes (creation + consultation +
   impression uniquement) - jamais modifie ni annule en V1.60, a la
   difference des autres documents de l'application : une fois un envoi
   reellement effectue, le "retirer" du carnet n'aurait pas de sens metier.
   V2.02 : suppression DEFINITIVE ajoutee quand meme (demande explicite de
   l'utilisateur), mais restreinte aux bordereaux SANS AUCUN retour deja
   enregistre sur aucune de leurs lignes - un bordereau deja retourne reste
   figure, exactement comme avant - voir renderBordereaux() plus bas.
   ========================================================= */
function addDestinataireContrat(ctrId, nom, categorie){
  var ctr = projetParId(ctrId);
  var list = (ctr && Array.isArray(ctr.destinataires)) ? ctr.destinataires.slice() : [];
  var dest = {id:'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), nom:nom, categorie:categorie};
  list.push(dest);
  return STATE.db.doc(projetDocPath(ctr)).update({destinataires:list}).then(function(){ return dest; });
}

// V2.02 : filtres par contrat et par destinataire ajoutes (demande
// explicite de l'utilisateur), en plus de la recherche texte deja
// existante - ctrId et destNom tous deux optionnels ("" = pas de filtre).
// Le menu destinataire est DEPENDANT du contrat choisi (decision confirmee
// par l'utilisateur) : il ne propose que les destinataires deja utilises
// dans un bordereau DE CE CONTRAT (tous contrats confondus si ctrId est
// vide) - voir bordereauDestinatairesDisponibles() plus bas.
var bordereauxSel = {}; // V2.15 : selection multiple (id -> true)
var bordereauxFilter = {q:'', ctrId:'', destNom:''};
// Liste des destinataires distincts deja utilises dans au moins un
// bordereau, limitee au contrat choisi si bordereauxFilter.ctrId n'est pas
// vide (sinon tous contrats confondus).
function bordereauDestinatairesDisponibles(ctrId){
  var noms = [];
  STATE.bordereaux.forEach(function(b){
    if(ctrId && projetIdDe(b)!==ctrId) return;
    if(b.destNom && noms.indexOf(b.destNom)<0) noms.push(b.destNom);
  });
  return noms.sort(function(a,b){ return a.localeCompare(b); });
}
function renderBordereaux(mount, actions){
  var canEdit = canWrite('livrables');
  // V2.16 : export / import Excel avec listes deroulantes (excel-listes.js)
  actions.innerHTML = (canEdit ? '<button type="button" class="btn btn-primary" id="btn-new-bor">'+ic('plus',15)+' Nouveau bordereau</button>' : '')+
    '<button type="button" class="btn" id="btn-export-bor-xl" title="Fichier Excel avec listes déroulantes (destinataire, livrable, indice, état…)">'+ic('download',15)+' Exporter Excel</button>'+
    (canEdit ? '<button type="button" class="btn" id="btn-import-bor-xl" title="Importer un fichier Excel exporté puis complété">'+ic('upload',15)+' Importer un Excel</button>' : '');
  if(canEdit){
    byId('btn-new-bor').addEventListener('click', function(){ openBordereauFormModal(); });
    byId('btn-import-bor-xl').addEventListener('click', function(){ xlOpenImportModal('bordereaux'); });
  }
  byId('btn-export-bor-xl').addEventListener('click', function(){ xlOpenExportModal('bordereaux'); });
  var list = STATE.bordereaux.filter(function(b){
    if(bordereauxFilter.ctrId && projetIdDe(b)!==bordereauxFilter.ctrId) return false;
    if(bordereauxFilter.destNom && b.destNom!==bordereauxFilter.destNom) return false;
    if(bordereauxFilter.q){
      var q = bordereauxFilter.q.toLowerCase();
      if((b.numero||'').toLowerCase().indexOf(q)<0 && (projetNumeroDe(b)).toLowerCase().indexOf(q)<0 &&
         (b.clientNom||'').toLowerCase().indexOf(q)<0 && (b.destNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var destsDispo = bordereauDestinatairesDisponibles(bordereauxFilter.ctrId);

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="bor-search" placeholder="N°, contrat, client ou destinataire…" value="'+esc(bordereauxFilter.q)+'">'+
      '<select id="bor-filtre-ctr">'+projetsOptionsHtml(bordereauxFilter.ctrId, 'Tous les contrats et devis', '', true)+'</select>'+
      '<select id="bor-filtre-dest"><option value="">Tous les destinataires</option>'+
        destsDispo.map(function(n){ return '<option value="'+esc(n)+'"'+(bordereauxFilter.destNom===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+
      '</select>'+
      bulkToolbarHtml(canEdit, list.length)+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' bordereau(x)</span>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Bordereaux d’envois : historique de toutes les transmissions de livrables techniques à leurs destinataires (client, bureau d’études, bureau de contrôle, architecte…), avec l’indice et l’état de transmission de chaque document envoyé. Un bordereau, une fois créé, est en principe définitif (aucune modification) : il matérialise un envoi réellement effectué. Depuis la V2.02, un bordereau peut néanmoins être supprimé définitivement tant qu’aucun retour n’a encore été enregistré dessus (voir le bouton de suppression sur chaque ligne).</p>';

  if(!STATE.bordereaux.length){
    body += emptyState('journal', 'Aucun bordereau de transmission enregistré pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-bor">'+ic('plus',15)+' Créer un bordereau</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun bordereau ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr>'+bulkHeadCellHtml(canEdit)+'<th>N°</th><th>Contrat</th><th>Client</th><th>Destinataire</th><th>Date</th><th>Documents</th><th>Retours</th><th></th></tr></thead><tbody>'+
      list.map(function(b){
        var etats = (b.lignes||[]).map(function(l){ return statutMeta(BORDEREAU_ETATS, l.etat).label; });
        var etatsUniques = etats.filter(function(e,i){ return etats.indexOf(e)===i; });
        // V1.62 : visibilite des retours en attente (demande explicite de
        // l'utilisateur), un simple compteur recu/total sur chaque bordereau
        // - vert si tout est revenu, orange sinon (voir aussi le detail par
        // ligne dans viewBordereauModal()).
        var lignesRet = b.lignes||[];
        var recus = lignesRet.filter(function(l){ return l.statutRetour; }).length;
        var retourBadge = !lignesRet.length ? '<span class="muted">—</span>' :
          (recus===lignesRet.length ? '<span class="pill pill-success">'+recus+'/'+lignesRet.length+'</span>' : '<span class="pill pill-warning">'+recus+'/'+lignesRet.length+' en attente</span>');
        return '<tr>'+
          bulkRowCellHtml(canEdit, b.id, bordereauxSel)+
          '<td class="num">'+esc(b.numero)+'</td>'+
          '<td class="num muted">'+esc(projetNumeroDe(b)||'—')+'</td>'+
          '<td>'+esc(b.clientNom||'—')+'</td>'+
          '<td>'+esc(b.destNom||'—')+(b.destCategorie?' <span class="muted">('+esc(b.destCategorie)+')</span>':'')+'</td>'+
          '<td class="muted">'+(b.date?fmtDate(b.date):'—')+'</td>'+
          '<td class="muted" style="font-size:12px;">'+(b.lignes||[]).length+' doc. — '+esc(etatsUniques.join(', '))+'</td>'+
          '<td>'+retourBadge+'</td>'+
          '<td><div class="row-actions">'+
            '<button type="button" class="iconbtn" data-view-bor="'+b.id+'" title="Détail">'+ic('file',15)+'</button>'+
            '<button type="button" class="iconbtn" data-print-bor="'+b.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            // V2.02 : suppression definitive demandee explicitement par
            // l'utilisateur, en ecart assume au principe "bordereau
            // definitif" de la V1.60 (voir le commentaire en tete de ce
            // bloc) - restreinte, sur sa demande, aux bordereaux SANS
            // AUCUN retour deja enregistre (voir le gestionnaire de clic
            // plus bas), probablement une erreur de saisie plutot qu'un
            // envoi reel deja confirme/retourne.
            (canEdit? '<button type="button" class="iconbtn" data-delete-bor="'+b.id+'" title="Supprimer définitivement">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  bulkPruneSelection(bordereauxSel, list.map(function(b){ return b.id; }));
  mount.innerHTML = body;
  wireBulkSelection(mount, {
    sel: bordereauxSel, ids: list.map(function(b){ return b.id; }), canEdit: canEdit, collection: 'bordereaux',
    noun: 'bordereau', nounPlural: 'bordereaux',
    // Meme regle que la corbeille d'une ligne (V2.02) : un bordereau ayant
    // deja un retour enregistre materialise un envoi confirme.
    guard: function(id){
      var b = STATE.bordereaux.find(function(x){ return x.id===id; });
      var retour = b && (b.lignes||[]).some(function(l){ return l.statutRetour || l.dateRetour; });
      return retour ? 'au moins un retour déjà enregistré' : '';
    }
  });

  var s1 = byId('bor-search');
  if(s1) s1.addEventListener('input', debounce(function(){ bordereauxFilter.q = s1.value; renderBordereaux(mount, actions); s1.focus(); s1.setSelectionRange(s1.value.length, s1.value.length); }, 220));
  var fc1 = byId('bor-filtre-ctr');
  if(fc1) fc1.addEventListener('change', function(){
    bordereauxFilter.ctrId = fc1.value;
    // Le menu Destinataire depend du contrat choisi (decision confirmee
    // par l'utilisateur) : un destinataire selectionne qui ne correspond
    // plus au nouveau contrat choisi est reinitialise, plutot que de
    // rester actif en silence sur un filtre qui n'a plus de sens.
    if(bordereauxFilter.destNom && bordereauDestinatairesDisponibles(fc1.value).indexOf(bordereauxFilter.destNom)<0){
      bordereauxFilter.destNom = '';
    }
    renderBordereaux(mount, actions);
  });
  var fd1 = byId('bor-filtre-dest');
  if(fd1) fd1.addEventListener('change', function(){ bordereauxFilter.destNom = fd1.value; renderBordereaux(mount, actions); });
  var eb = byId('empty-new-bor'); if(eb) eb.addEventListener('click', function(){ openBordereauFormModal(); });
  mount.querySelectorAll('[data-view-bor]').forEach(function(btn){ btn.addEventListener('click', function(){
    viewBordereauModal(STATE.bordereaux.find(function(b){ return b.id===btn.getAttribute('data-view-bor'); }));
  }); });
  mount.querySelectorAll('[data-print-bor]').forEach(function(btn){ btn.addEventListener('click', function(){
    printDocument('bor', STATE.bordereaux.find(function(b){ return b.id===btn.getAttribute('data-print-bor'); }));
  }); });
  mount.querySelectorAll('[data-delete-bor]').forEach(function(btn){ btn.addEventListener('click', function(){
    var id = btn.getAttribute('data-delete-bor');
    var b = STATE.bordereaux.find(function(x){ return x.id===id; });
    var dejaRetourne = b && (b.lignes||[]).some(function(l){ return l.statutRetour || l.dateRetour; });
    if(dejaRetourne){
      toast('Suppression impossible : au moins un retour a déjà été enregistré sur ce bordereau. Il matérialise un envoi confirmé et ne peut plus être supprimé.', 'danger');
      return;
    }
    confirmDialog('Supprimer définitivement ce bordereau ? Cette action est irréversible — à n’utiliser que pour corriger une erreur de saisie (aucun retour n’a encore été enregistré dessus).', {danger:true, okLabel:'Supprimer définitivement'}).then(function(ok){
      if(!ok) return;
      deleteDoc('bordereaux', id).then(function(){ toast('Bordereau supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

// V1.62 : un bordereau reste figé (contrat, destinataire, documents, indice,
// état de transmission initial - RG de la V1.60, inchangée) MAIS chaque
// ligne peut desormais recevoir, apres coup, sa date et son statut de
// retour par destinataire (demande explicite de l'utilisateur : "seules la
// date et le statut de retour deviennent modifiables après coup oui"). On
// n'utilise donc plus printLignesTable() (figé, pensé pour l'impression)
// pour l'affichage ecran de ce modal : un tableau dedie, avec les retours en
// lecture seule pour qui n'a pas le droit d'ecriture sur Livrables, et en
// champs editables (date + select) pour qui l'a - le bouton d'impression
// continue lui a afficher le gabarit imprimable via printDocument().
function viewBordereauModal(b){
  if(!b) return;
  var canEdit = canWrite('livrables');
  var ctr = projetParId(projetIdDe(b));
  var codesClient = (ctr && ctr.codesRetourClient) || {};

  function lignesTableHtml(){
    var rows = (b.lignes||[]).map(function(l, idx){
      var codeClientTxt = l.statutRetour ? codesClient[l.statutRetour] : '';
      var codeClientHint = codeClientTxt ? ' <span class="muted" style="font-size:11px;">(code client : '+esc(codeClientTxt)+')</span>' : '';
      var retourCells;
      if(canEdit){
        retourCells =
          '<td><input type="date" class="bor-ret-date" data-idx="'+idx+'" value="'+esc(l.dateRetour||'')+'" style="width:130px;"></td>'+
          '<td><select class="bor-ret-statut" data-idx="'+idx+'" style="min-width:170px;">'+
            '<option value="">— en attente —</option>'+
            STATUT_RETOUR_REFERENTIEL.map(function(s){ return '<option value="'+s.id+'"'+(l.statutRetour===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+
          '</select><span class="bor-ret-code-hint" data-idx="'+idx+'">'+codeClientHint+'</span></td>';
      } else {
        retourCells =
          '<td class="muted">'+(l.dateRetour?fmtDate(l.dateRetour):'—')+'</td>'+
          '<td>'+(l.statutRetour? esc(statutMeta(STATUT_RETOUR_REFERENTIEL, l.statutRetour).label) : '<span class="muted">En attente de retour</span>')+codeClientHint+'</td>';
      }
      return '<tr>'+
        '<td style="font-size:12px;">'+esc(l.livCode||'')+'</td>'+
        '<td>'+esc(l.livDesignation||'')+'</td>'+
        '<td>'+esc(l.indice||'')+'</td>'+
        '<td>'+esc(statutMeta(BORDEREAU_ETATS, l.etat).label)+'</td>'+
        retourCells+
      '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>Code</th><th>Désignation</th><th>Indice</th><th>État de transmission</th><th>Date de retour</th><th>Statut de retour</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }

  openModal({
    title: 'Bordereau '+b.numero,
    large: true,
    body:
      printInfoRows([
        {label:(b.devisNumero&&!b.ctrNumero?'Devis':'Contrat'), value: (b.ctrNumero||b.devisNumero||'—')+' — '+(b.clientNom||'—')},
        {label:'Destinataire', value: (b.destNom||'—')+(b.destCategorie?' ('+b.destCategorie+')':'')},
        {label:'Date d’envoi', value: b.date?fmtDate(b.date):'—'},
        {label:'Créé par', value: (b.creePar||'—')+' le '+fmtDateTime(b.createdAt)}
      ])+
      lignesTableHtml()+
      (canEdit ? '<p class="hint" style="margin-top:8px;">Seules la date et le statut de retour peuvent être renseignés après coup : le reste du bordereau (contrat, destinataire, documents, état de transmission initial) reste figé.</p>' : '')+
      (b.notes? printNotesBlock(b.notes) : ''),
    foot: '<button type="button" class="btn" data-close-modal>Fermer</button>'+
      (canEdit? '<button type="button" class="btn btn-primary" id="bor-view-save-retours">Enregistrer les retours</button>' : '')+
      '<button type="button" class="btn btn-primary" id="bor-view-print">'+ic('print',15)+' Imprimer</button>'
  });
  var pb = byId('bor-view-print'); if(pb) pb.addEventListener('click', function(){ printDocument('bor', b); });
  if(canEdit){
    // Met a jour l'indice "code client" en direct quand on change le statut
    // de retour choisi, sans attendre l'enregistrement (le rendu initial ne
    // connait que l'ancienne valeur enregistree).
    document.querySelectorAll('.bor-ret-statut').forEach(function(sel){
      sel.addEventListener('change', function(){
        var hintSpan = document.querySelector('.bor-ret-code-hint[data-idx="'+sel.getAttribute('data-idx')+'"]');
        if(!hintSpan) return;
        var txt = sel.value ? codesClient[sel.value] : '';
        hintSpan.innerHTML = txt ? ' <span class="muted" style="font-size:11px;">(code client : '+esc(txt)+')</span>' : '';
      });
    });
  }
  var sb = byId('bor-view-save-retours');
  if(sb) sb.addEventListener('click', function(){
    var updatedLignes = (b.lignes||[]).map(function(l, idx){
      var dateInp = document.querySelector('.bor-ret-date[data-idx="'+idx+'"]');
      var statutSel = document.querySelector('.bor-ret-statut[data-idx="'+idx+'"]');
      var copy = Object.assign({}, l);
      copy.dateRetour = dateInp ? dateInp.value : (l.dateRetour||'');
      copy.statutRetour = statutSel ? statutSel.value : (l.statutRetour||'');
      return copy;
    });
    STATE.db.doc('bordereaux/'+b.id).update({lignes: updatedLignes, updatedAt: nowISO()}).then(function(){
      b.lignes = updatedLignes;
      closeModal(); toast('Retours enregistrés', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

function openBordereauFormModal(){
  if(!projetsTries().length){
    toast('Créez d’abord un contrat ou un devis.', 'danger'); return;
  }
  var overlay = openModal({
    title: 'Nouveau bordereau de transmission',
    large: true,
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="bof-ctr">Contrat / devis</label><select id="bof-ctr" required>'+projetsOptionsHtml(null, undefined, '', true)+'</select></div>'+
        '<div class="field"><label for="bof-date">Date d’envoi</label><input type="date" id="bof-date" value="'+todayISO()+'"></div>'+
      '</div>'+
      '<div id="bof-dynamic"><p class="hint">Choisissez d’abord un contrat.</p></div>'+
      '<div class="field"><label for="bof-notes">Notes</label><textarea id="bof-notes"></textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="bof-save">Enregistrer</button>'
  });

  // Destinataires ajoutes DURANT cette session de formulaire : le polling
  // (2s, voir local-db.js) peut ne pas avoir encore rafraichi STATE.ctr au
  // moment de l'enregistrement du bordereau qui suit immediatement leur
  // creation - on les garde ici en complement, pour ne jamais perdre un
  // destinataire qu'on vient nous-meme d'ajouter au contrat.
  var destinatairesAjoutesSession = [];

  function renderDynamic(){
    var ctrId = byId('bof-ctr').value;
    var zone = byId('bof-dynamic');
    if(!ctrId){ zone.innerHTML = '<p class="hint">Choisissez d’abord un contrat.</p>'; return; }
    var ctr = projetParId(ctrId);
    var destinataires = (ctr && Array.isArray(ctr.destinataires)) ? ctr.destinataires.slice() : [];
    destinatairesAjoutesSession.filter(function(d){ return projetIdDe(d)===ctrId; }).forEach(function(d){
      if(!destinataires.some(function(x){ return x.id===d.id; })) destinataires.push(d);
    });
    var livrablesCtr = STATE.livrables.filter(function(l){ return projetIdDe(l)===ctrId && l.statut!=='annule'; })
      .sort(function(a,b){ return (a.codeComplet||'').localeCompare(b.codeComplet||''); });

    zone.innerHTML =
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="bof-dest">Destinataire</label><select id="bof-dest"><option value="">— Choisir —</option>'+
          destinataires.map(function(d){ return '<option value="'+d.id+'">'+esc(d.nom)+' — '+esc(d.categorie)+'</option>'; }).join('')+
          '<option value="__new__">+ Nouveau destinataire…</option>'+
        '</select></div>'+
        '<div class="field" id="bof-dest-new" style="display:none;">'+
          '<label for="bof-dest-nom">Nom du nouveau destinataire</label>'+
          '<div class="field-row grid-2" style="gap:6px;">'+
            '<input id="bof-dest-nom" placeholder="ex. JESA — Service études">'+
            '<select id="bof-dest-cat">'+DESTINATAIRE_CATEGORIES.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')+'</select>'+
          '</div>'+
          '<button type="button" class="btn btn-sm" id="bof-dest-add" style="margin-top:6px;">Ajouter ce destinataire au contrat</button>'+
        '</div>'+
      '</div>'+
      (livrablesCtr.length ?
        '<div class="field"><label>Documents à transmettre</label>'+
        '<div class="table-wrap"><table><thead><tr><th></th><th>Code</th><th>Désignation</th><th>Indice</th><th>État</th></tr></thead><tbody>'+
          livrablesCtr.map(function(l){
            var hist = Array.isArray(l.historiqueIndices) && l.historiqueIndices.length ? l.historiqueIndices.map(function(h){return h.indice;}) : [l.indiceRevision||'A'];
            var indicesUniques = hist.filter(function(v,i){ return hist.indexOf(v)===i; });
            return '<tr>'+
              '<td><input type="checkbox" class="bof-liv-chk" data-liv="'+l.id+'"></td>'+
              '<td class="num muted" style="font-size:11px;">'+esc(livrableCodeDuLivrable(l, ctr))+'</td>'+
              '<td>'+esc(l.designation)+'</td>'+
              '<td><select class="bof-liv-indice" data-liv="'+l.id+'" style="min-width:70px;">'+indicesUniques.map(function(i){ return '<option value="'+esc(i)+'"'+(i===l.indiceRevision?' selected':'')+'>'+esc(i)+'</option>'; }).join('')+'</select></td>'+
              '<td><select class="bof-liv-etat" data-liv="'+l.id+'">'+BORDEREAU_ETATS.map(function(s){ return '<option value="'+s.id+'">'+esc(s.label)+'</option>'; }).join('')+'</select></td>'+
            '</tr>';
          }).join('')+
        '</tbody></table></div></div>'
        : '<p class="hint">Ce contrat n’a aucun livrable (non annulé) à transmettre.</p>');

    var destSel = byId('bof-dest');
    destSel.addEventListener('change', function(){
      byId('bof-dest-new').style.display = destSel.value==='__new__' ? '' : 'none';
    });
    var addBtn = byId('bof-dest-add');
    if(addBtn) addBtn.addEventListener('click', function(){
      var nom = byId('bof-dest-nom').value.trim();
      if(!nom){ toast('Nom du destinataire requis', 'danger'); return; }
      var categorie = byId('bof-dest-cat').value;
      addDestinataireContrat(ctrId, nom, categorie).then(function(dest){
        toast('Destinataire ajouté au contrat', 'success');
        // le contrat local (STATE.ctr) sera rafraichi par le polling (2s) ;
        // garde en memoire ici en attendant, pour que le destinataire reste
        // selectionnable (et que l'enregistrement du bordereau le retrouve)
        // meme si on l'utilise avant que le polling n'ait rattrape le retard.
        destinatairesAjoutesSession.push(Object.assign({ctrId:ctrId}, dest));
        renderDynamic();
        var sel = byId('bof-dest');
        if(sel) sel.value = dest.id;
      }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }
  byId('bof-ctr').addEventListener('change', renderDynamic);

  overlay.querySelector('#bof-save').addEventListener('click', function(){
    var ctrId = byId('bof-ctr').value;
    if(!ctrId){ toast('Veuillez choisir un contrat ou un devis', 'danger'); return; }
    var ctr = projetParId(ctrId);
    var destSel = byId('bof-dest');
    var destId = destSel ? destSel.value : '';
    if(!destId || destId==='__new__'){ toast('Veuillez choisir (ou ajouter) un destinataire', 'danger'); return; }
    var dest = ((ctr && ctr.destinataires) || []).find(function(d){ return d.id===destId; }) ||
      destinatairesAjoutesSession.filter(function(d){ return projetIdDe(d)===ctrId; }).find(function(d){ return d.id===destId; });
    if(!dest){ toast('Destinataire introuvable - réessayez', 'danger'); return; }
    var lignes = [];
    document.querySelectorAll('.bof-liv-chk').forEach(function(chk){
      if(!chk.checked) return;
      var livId = chk.getAttribute('data-liv');
      var liv = STATE.livrables.find(function(l){ return l.id===livId; });
      var indice = document.querySelector('.bof-liv-indice[data-liv="'+livId+'"]').value;
      var etat = document.querySelector('.bof-liv-etat[data-liv="'+livId+'"]').value;
      lignes.push({livId:livId, livCode: liv?livrableCodeDuLivrable(liv, ctr):'', livDesignation: liv?liv.designation:'', indice:indice, etat:etat});
    });
    if(!lignes.length){ toast('Sélectionnez au moins un document à transmettre', 'danger'); return; }
    var data = {
      ctrId: champsProjet(ctr).ctrId, ctrNumero: champsProjet(ctr).ctrNumero, devisId: champsProjet(ctr).devisId, devisNumero: champsProjet(ctr).devisNumero, clientId: ctr.clientId, clientNom: ctr.clientNom,
      destId: dest.id, destNom: dest.nom, destCategorie: dest.categorie,
      date: byId('bof-date').value || todayISO(),
      lignes: lignes, notes: byId('bof-notes').value.trim(),
      createdAt: nowISO(), creePar: currentUserName()
    };
    nextLocalSeq(projetCollection(ctr), ctrId, 'bordereauSeq').then(function(seq){
      data.numero = ctr.numero+'-BOR'+pad2(seq);
      return STATE.db.collection('bordereaux').add(data);
    }).then(function(){
      closeModal(); toast('Bordereau enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   PROPOSITIONS DE FACTURATION (PFA)
   ========================================================= */
// Pre-validation interne avant emission de facture (P-09/section 6.5 du
// CDC) : la PFA peut etre issue d'un attachement valide ou saisie librement,
// puis "convertie" en brouillon de facture une fois validee en interne.
var pfaFilter = {q:''};
function renderPFA(mount, actions){
  var canEdit = canWrite('pfa');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-pfa">'+ic('plus',15)+' Nouvelle proposition</button>';
    byId('btn-new-pfa').addEventListener('click', function(){ openPFAFormModal(null); });
  }
  var list = STATE.pfa.filter(function(p){
    if(pfaFilter.q){
      var q = pfaFilter.q.toLowerCase();
      if((p.numero||'').toLowerCase().indexOf(q)<0 && (p.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="pfa-search" placeholder="N° ou client…" value="'+esc(pfaFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' proposition(s)</span>'+
    '</div></div>';

  if(!STATE.pfa.length){
    body += emptyState('file', 'Aucune proposition de facturation.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-pfa">'+ic('plus',15)+' Créer une proposition</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucune proposition ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Client</th><th>Origine</th><th>Date</th><th class="r">Montant TTC</th><th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(p){
        var t = calcDocTotals(p.lignes, p.tauxTVA, 0);
        var sm = statutMeta(PFA_STATUTS, p.statut);
        return '<tr>'+
          '<td class="num">'+esc(p.numero)+'</td>'+
          '<td>'+esc(p.clientNom||'—')+'</td>'+
          '<td class="num muted">'+esc(p.attachementNumero||p.ctrNumero||'—')+'</td>'+
          '<td class="muted">'+fmtDate(p.date)+'</td>'+
          '<td class="r num">'+fmtMoney(t.ttc)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td><div class="row-actions">'+
            (canEdit && p.statut==='validee' && canWrite('fac') ? '<button type="button" class="btn btn-sm btn-accent" data-to-fac="'+p.id+'">Facturer</button>' : '')+
            '<button type="button" class="iconbtn" data-print="'+p.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+p.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && p.statut!=='annulee'? '<button type="button" class="iconbtn" data-cancel="'+p.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('pfa-search');
  if(s1) s1.addEventListener('input', debounce(function(){ pfaFilter.q = s1.value; renderPFA(mount, actions); }, 220));
  var eb = byId('empty-new-pfa'); if(eb) eb.addEventListener('click', function(){ openPFAFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openPFAFormModal(STATE.pfa.find(function(p){ return p.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('pfa', STATE.pfa.find(function(p){ return p.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-to-fac]').forEach(function(b){ b.addEventListener('click', function(){
    var p = STATE.pfa.find(function(x){ return x.id===b.getAttribute('data-to-fac'); });
    goTo('fac');
    setTimeout(function(){ openFactureFormModal(null, null, p); }, 0);
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler cette proposition de facturation ? Elle restera visible avec le statut « Annulée » (aucune suppression physique).', {danger:true, okLabel:'Annuler'}).then(function(ok){
      if(!ok) return;
      cancelDoc('propositionsFacturation', id, 'statut', 'annulee').then(function(){ toast('Proposition annulée', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function openPFAFormModal(pfa){
  var f = pfa ? Object.assign({}, pfa) : {date:todayISO(), tauxTVA:STATE.company.tauxTVA, statut:'brouillon'};
  var lignes = JSON.parse(JSON.stringify(f.lignes || [{designation:'', unite:'u', qte:1, pu:0}]));
  var tauxTVA = f.tauxTVA!==undefined ? f.tauxTVA : STATE.company.tauxTVA;

  var overlay = openModal({
    title: pfa ? 'Modifier la proposition '+pfa.numero : 'Nouvelle proposition de facturation',
    large: true,
    body:
      unitesDatalist()+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="pf-client">Client</label><select id="pf-client" required><option value="">— Choisir —</option>'+clientOptionsHtml(f.clientId)+'</select></div>'+
        '<div class="field"><label for="pf-cmd">Contrat (optionnel)</label><select id="pf-cmd">'+ctrOptionsHtml(f.ctrId, '— Aucun —', f.clientId)+'</select></div>'+
        '<div class="field"><label for="pf-date">Date</label><input type="date" id="pf-date" value="'+esc(f.date||todayISO())+'"></div>'+
      '</div>'+
      '<fieldset><legend>Lignes</legend>'+simpleLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="pf-tva">TVA (%)</label><input type="number" step="any" id="pf-tva" value="'+tauxTVA+'"></div>'+
        '<div class="field"><label for="pf-statut">Statut</label><select id="pf-statut">'+PFA_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'brouillon')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div id="pf-totals"></div>'+
      '<div class="field" style="margin-top:14px;"><label for="pf-notes">Notes</label><textarea id="pf-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="pf-save">Enregistrer</button>'
  });

  function refreshTotals(){
    var t = calcDocTotals(lignes, Number(byId('pf-tva').value), 0);
    byId('pf-totals').innerHTML = totalsBoxHtml(t);
  }
  wireSimpleLinesEditor(function(){ return lignes; }, function(v){ lignes = v; }, refreshTotals);
  byId('pf-tva').addEventListener('input', refreshTotals);
  byId('pf-client').addEventListener('change', function(){
    byId('pf-cmd').innerHTML = ctrOptionsHtml('', '— Aucun —', byId('pf-client').value);
  });
  refreshTotals();

  overlay.querySelector('#pf-save').addEventListener('click', function(){
    var clientId = byId('pf-client').value;
    if(!clientId){ toast('Veuillez choisir un client', 'danger'); return; }
    var client = STATE.clients.find(function(c){ return c.id===clientId; });
    var cmdSel = STATE.ctr.find(function(x){ return x.id===byId('pf-cmd').value; });
    var data = {
      clientId: clientId, clientNom: client?client.nom:'',
      ctrId: cmdSel?cmdSel.id:(f.ctrId||null), ctrNumero: cmdSel?cmdSel.numero:(f.ctrNumero||null),
      attachementId: f.attachementId||null, attachementNumero: f.attachementNumero||null,
      date: byId('pf-date').value || todayISO(),
      lignes: lignes, tauxTVA: Number(byId('pf-tva').value)||0,
      statut: byId('pf-statut').value, notes: byId('pf-notes').value.trim()
    };
    savePFA(data, pfa?pfa.id:null).then(function(){
      closeModal(); toast('Proposition de facturation enregistrée', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   FACTURES
   ========================================================= */
var facFilter = {q:'', statut:'', clientKey:'', annee:''};
// Persiste entre deux rendus (comme facFilter juste en dessous) : quelles
// annees sont actuellement repliees dans la liste des factures - sans cela,
// le cycle de synchronisation automatique (toutes les 2 secondes) qui
// reconstruit entierement l'ecran rouvrirait silencieusement toute annee
// que l'utilisateur vient de replier.
var facAnneesRepliees = {};

function anneeFacture(f){
  var m = /^(\d{4})/.exec(f.date || f.createdAt || '');
  return m ? m[1] : 'Sans date';
}

function facRowHtml(f, canEdit){
  var e = factureEtat(f);
  var locked = !!f.verrouillee;
  var fileUrl = factureClientFileUrl(f);
  return '<tr>'+
    '<td class="num">'+(f.numero? esc(f.numero) : '<span class="muted">(brouillon)</span>')+
      (f.referenceHistorique? ' <span class="pill pill-neutral" style="font-size:10px;" title="Facture déjà émise, importée depuis un PDF — numéro d’origine conservé tel quel (référence historique), aucun numéro FAC n’a été attribué (RG-009)">import</span>' : '')+
    '</td>'+
    '<td>'+esc(f.clientNom||'—')+'</td>'+
    '<td class="muted">'+fmtDate(f.date)+'</td>'+
    '<td class="muted">'+fmtDate(f.echeance)+'</td>'+
    '<td class="r num">'+fmtMoney(f.net)+'</td>'+
    '<td class="r num">'+fmtMoney(e.reste)+'</td>'+
    '<td><span class="pill pill-'+e.tone+'">'+esc(e.statut)+'</span></td>'+
    '<td><div class="row-actions">'+
      (canEdit && f.statut==='brouillon' ? '<button type="button" class="btn btn-sm btn-accent" data-validate="'+f.id+'">Valider</button>' : '')+
      (canWrite('reg') && f.statut!=='brouillon' && f.statut!=='annulee' && e.reste>0.009 ? '<button type="button" class="btn btn-sm btn-accent" data-to-reg="'+f.id+'">Encaisser</button>' : '')+
      (fileUrl? '<a class="iconbtn" href="'+fileUrl+'" target="_blank" title="Voir le PDF d’origine importé">'+ic('file',15)+'</a>' : '')+
      '<button type="button" class="iconbtn" data-print="'+f.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
      (canEdit && f.referenceHistorique? '<button type="button" class="btn btn-sm" data-edit-numero="'+f.id+'" title="Changer le numéro de cette facture importée (doit rester unique)">N°</button>' : '')+
      (canEdit? '<button type="button" class="iconbtn" data-edit="'+f.id+'" title="'+(locked?'Consulter':'Modifier')+'">'+ic('pencil',15)+'</button>' : '')+
      (canEdit && f.statut!=='annulee'? '<button type="button" class="iconbtn" data-cancel="'+f.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
    '</div></td>'+
  '</tr>';
}

function renderFactures(mount, actions){
  var canEdit = canWrite('fac');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-fac">'+ic('plus',15)+' Nouvelle facture</button>'+
      '<button type="button" class="btn" id="btn-import-fac" title="Enregistrer des factures déjà émises (PDF), à l’instar des factures fournisseurs">'+ic('upload',15)+' Importer des factures (PDF)</button>';
    byId('btn-new-fac').addEventListener('click', function(){ openFactureFormModal(null); });
    byId('btn-import-fac').addEventListener('click', function(){ getFcFilesInput().click(); });
  }

  if(factureClientEnCours){
    mount.innerHTML = renderFactureClientEnCoursHtml(factureClientEnCours, canEdit);
    wireFactureClientEnCours(mount, actions);
    return;
  }

  var list = STATE.fac.filter(function(f){
    if(!docPasseClientAnnee(f, facFilter)) return false;
    if(facFilter.q){
      var q = facFilter.q.toLowerCase();
      if((f.numero||'').toLowerCase().indexOf(q)<0 && (f.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="fac-search" placeholder="N° ou client…" value="'+esc(facFilter.q)+'">'+
      clientAnneeFilterHtml('fac', facFilter, STATE.fac)+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' facture(s)</span>'+
    '</div></div>';

  if(!STATE.fac.length){
    body += emptyState('receipt', 'Aucune facture émise.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-fac">'+ic('plus',15)+' Créer une facture</button>'+
      '<button type="button" class="btn" id="empty-import-fac" style="margin-left:8px;">'+ic('upload',15)+' Importer des factures (PDF)</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucune facture ne correspond à ce filtre.');
  } else {
    // Regroupement par annee (section repliable par annee) : la liste brute
    // est deja triee ci-dessus (numero decroissant), on la repartit ensuite
    // en groupes par annee de la date de facture, dans le meme ordre.
    var groupesAnnee = {};
    list.forEach(function(f){
      var an = anneeFacture(f);
      (groupesAnnee[an] = groupesAnnee[an]||[]).push(f);
    });
    var annees = Object.keys(groupesAnnee).sort(function(a,b){
      if(a==='Sans date') return 1;
      if(b==='Sans date') return -1;
      return b.localeCompare(a);
    });
    body += annees.map(function(an){
      var sousListe = groupesAnnee[an];
      var repliee = !!facAnneesRepliees[an];
      var totalNet = sousListe.reduce(function(s,f){ return s + (Number(f.net)||0); }, 0);
      return '<div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;">'+
        '<button type="button" class="linklike" data-toggle-annee-fac="'+esc(an)+'" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:var(--surface-2);border:none;cursor:pointer;text-align:left;color:inherit;">'+
          '<span style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;">'+
            '<span style="display:inline-flex;transition:transform .15s;transform:rotate('+(repliee?'0':'90')+'deg);">'+ic('chevron',14)+'</span>'+
            esc(an)+
          '</span>'+
          '<span class="muted" style="font-size:12.5px;font-weight:400;">'+sousListe.length+' facture(s) — net '+fmtMoney(totalNet)+'</span>'+
        '</button>'+
        '<div class="table-wrap"'+(repliee?' hidden':'')+'>'+
          '<table><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Échéance</th><th class="r">Net à payer</th><th class="r">Reste dû</th><th>Statut</th><th></th></tr></thead><tbody>'+
            sousListe.map(function(f){ return facRowHtml(f, canEdit); }).join('')+
          '</tbody></table>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  mount.innerHTML = body;

  var s1 = byId('fac-search');
  if(s1) s1.addEventListener('input', debounce(function(){ facFilter.q = s1.value; renderFactures(mount, actions); }, 220));
  wireClientAnneeFilter('fac', facFilter, function(){ renderFactures(mount, actions); });
  var eb = byId('empty-new-fac'); if(eb) eb.addEventListener('click', function(){ openFactureFormModal(null); });
  var ebi = byId('empty-import-fac'); if(ebi) ebi.addEventListener('click', function(){ getFcFilesInput().click(); });
  mount.querySelectorAll('[data-toggle-annee-fac]').forEach(function(b){ b.addEventListener('click', function(){
    var an = b.getAttribute('data-toggle-annee-fac');
    facAnneesRepliees[an] = !facAnneesRepliees[an];
    renderFactures(mount, actions);
  }); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openFactureFormModal(STATE.fac.find(function(f){ return f.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-edit-numero]').forEach(function(b){ b.addEventListener('click', function(){
    openFactureClientNumeroEditModal(STATE.fac.find(function(f){ return f.id===b.getAttribute('data-edit-numero'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('fac', STATE.fac.find(function(f){ return f.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-to-reg]').forEach(function(b){ b.addEventListener('click', function(){
    var f = STATE.fac.find(function(x){ return x.id===b.getAttribute('data-to-reg'); });
    goTo('reg');
    setTimeout(function(){ openReglementFormModal(null, f); }, 0);
  }); });
  // Validation (RG-003/P-09) : attribution atomique du numero definitif +
  // verrouillage, en une seule action depuis la liste.
  mount.querySelectorAll('[data-validate]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-validate');
    confirmDialog('Valider cette facture ? Un numéro définitif lui sera attribué et son contenu sera ensuite verrouillé (RG-003).', {okLabel:'Valider'}).then(function(ok){
      if(!ok) return;
      validateFacture(id).then(function(numero){ toast('Facture validée : '+numero, 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    var hasReg = STATE.reg.some(function(r){ return r.factureId===id; });
    confirmDialog((hasReg? 'Des encaissements sont liés à cette facture. ' : '')+'Annuler cette facture ? Elle restera visible avec le statut « Annulée » (aucune suppression physique).', {danger:true, okLabel:'Annuler la facture'}).then(function(ok){
      if(!ok) return;
      cancelDoc('factures', id, 'statut', 'annulee').then(function(){ genererContreEcritureSiExiste('facture', id); toast('Facture annulée', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function openFactureFormModal(facture, fromAtt, fromPfa){
  var f = facture ? Object.assign({}, facture) : {};
  var locked = !!(facture && (facture.verrouillee || facture.statut==='annulee'));
  var lignes;
  if(facture){ lignes = JSON.parse(JSON.stringify(facture.lignes||[])); }
  else if(fromAtt){
    lignes = (fromAtt.lignes||[]).filter(function(l){ return Number(l.qtePeriode)>0; }).map(function(l){
      return {designation:l.designation, unite:l.unite, qte:l.qtePeriode, pu:l.pu};
    });
    f.clientId = fromAtt.clientId; f.clientNom = fromAtt.clientNom;
    f.ctrId = fromAtt.ctrId; f.ctrNumero = fromAtt.ctrNumero;
    f.attachementId = fromAtt.id; f.attachementNumero = fromAtt.numero;
    f.tauxTVA = fromAtt.tauxTVA;
  } else if(fromPfa){
    lignes = JSON.parse(JSON.stringify(fromPfa.lignes||[]));
    f.clientId = fromPfa.clientId; f.clientNom = fromPfa.clientNom;
    f.ctrId = fromPfa.ctrId; f.ctrNumero = fromPfa.ctrNumero;
    f.attachementId = fromPfa.attachementId||null; f.attachementNumero = fromPfa.attachementNumero||null;
    f.pfaId = fromPfa.id; f.pfaNumero = fromPfa.numero;
    f.tauxTVA = fromPfa.tauxTVA;
  } else {
    lignes = [{designation:'', unite:'u', qte:1, pu:0}];
  }
  var tauxTVA = f.tauxTVA!==undefined ? f.tauxTVA : STATE.company.tauxTVA;
  var tauxRG = f.tauxRG!==undefined ? f.tauxRG : ((fromAtt||fromPfa) ? STATE.company.tauxRG : 0);
  var dis = locked ? ' disabled' : '';

  var overlay = openModal({
    title: facture ? (facture.numero?('Facture '+facture.numero):'Brouillon de facture') : (fromAtt ? 'Facturer l’attachement '+fromAtt.numero : (fromPfa ? 'Facturer la proposition '+fromPfa.numero : 'Nouvelle facture')),
    large: true,
    body:
      unitesDatalist()+
      (locked ? '<p class="hint" style="margin-bottom:12px;">'+ic('check',12)+' Facture validée et verrouillée (RG-003) : le contenu ne peut plus être modifié.</p>' : '')+
      (facture && !facture.numero ? '<p class="hint" style="margin-bottom:12px;">Brouillon : aucun numéro FAC n’est attribué tant que la facture n’est pas validée (P-09).</p>' : '')+
      (fromAtt ? '<p class="hint" style="margin-bottom:12px;">Lignes reprises de l’attachement <b>'+esc(fromAtt.numero)+'</b> (quantités de la période).</p>' : '')+
      (fromPfa ? '<p class="hint" style="margin-bottom:12px;">Lignes reprises de la proposition de facturation <b>'+esc(fromPfa.numero)+'</b>.</p>' : '')+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="ff-client">Client</label><select id="ff-client" required'+dis+'><option value="">— Choisir —</option>'+clientOptionsHtml(f.clientId)+'</select></div>'+
        '<div class="field"><label for="ff-date">Date de facture</label><input type="date" id="ff-date" value="'+esc(f.date||todayISO())+'"'+dis+'></div>'+
        '<div class="field"><label for="ff-echeance">Échéance</label><input type="date" id="ff-echeance" value="'+esc(f.echeance||'')+'"'+dis+'></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="ff-reference">Référence (impression)</label><input id="ff-reference" value="'+esc(f.reference||'')+'" placeholder="ex. Notre offre N° 2026 25"'+dis+'></div>'+
        '<div class="field"><label for="ff-revision">Rév.</label><input id="ff-revision" value="'+esc(f.revision||'00')+'"'+dis+'></div>'+
      '</div>'+
      '<fieldset'+(locked?' disabled':'')+'><legend>Lignes</legend>'+simpleLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="ff-tva">TVA (%)</label><input type="number" step="any" id="ff-tva" value="'+tauxTVA+'"'+dis+'></div>'+
        '<div class="field"><label for="ff-rg">Retenue de garantie (%)</label><input type="number" step="any" id="ff-rg" value="'+tauxRG+'"'+dis+'></div>'+
      '</div>'+
      '<div id="ff-totals"></div>'+
      '<div class="field" style="margin-top:14px;"><label for="ff-notes">Notes</label><textarea id="ff-notes"'+dis+'>'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>'+(locked?'Fermer':'Annuler')+'</button>'+
      (locked? '' : '<button type="button" class="btn btn-primary" id="ff-save">Enregistrer</button>'+(facture && facture.statut==='brouillon' ? '<button type="button" class="btn btn-accent" id="ff-validate">Valider</button>' : ''))
  });

  function refreshTotals(){
    var t = calcFactureTotals(lignes, Number(byId('ff-tva').value), Number(byId('ff-rg').value));
    byId('ff-totals').innerHTML =
      '<div class="lines-total"><div class="totals-box">'+
        '<div class="totals-row"><span>Total HT</span><span class="num">'+fmtMoney2(t.ht)+'</span></div>'+
        '<div class="totals-row"><span>TVA</span><span class="num">'+fmtMoney2(t.tva)+'</span></div>'+
        '<div class="totals-row"><span>Total TTC</span><span class="num">'+fmtMoney2(t.ttc)+'</span></div>'+
        (t.rg? '<div class="totals-row"><span>Retenue de garantie</span><span class="num">- '+fmtMoney2(t.rg)+'</span></div>' : '')+
        '<div class="totals-row grand"><span>Net à payer</span><span class="num">'+fmtMoney2(t.net)+'</span></div>'+
      '</div></div>';
  }
  if(!locked){
    wireSimpleLinesEditor(function(){ return lignes; }, function(v){ lignes = v; }, refreshTotals);
    byId('ff-tva').addEventListener('input', refreshTotals);
    byId('ff-rg').addEventListener('input', refreshTotals);
  }
  refreshTotals();

  function collectData(){
    var clientId = byId('ff-client').value;
    if(!clientId){ toast('Veuillez choisir un client', 'danger'); return null; }
    var client = STATE.clients.find(function(c){ return c.id===clientId; });
    var tva = Number(byId('ff-tva').value)||0, rg = Number(byId('ff-rg').value)||0;
    var t = calcFactureTotals(lignes, tva, rg);
    return {
      clientId: clientId, clientNom: client?client.nom:'',
      ctrId: f.ctrId||null, ctrNumero: f.ctrNumero||null,
      attachementId: f.attachementId||null, attachementNumero: f.attachementNumero||null,
      pfaId: f.pfaId||null, pfaNumero: f.pfaNumero||null,
      date: byId('ff-date').value || todayISO(), echeance: byId('ff-echeance').value || '',
      reference: byId('ff-reference').value.trim(), revision: byId('ff-revision').value.trim()||'00',
      lignes: lignes, tauxTVA: tva, tauxRG: rg,
      ht: t.ht, montantTVA: t.tva, ttc: t.ttc, montantRG: t.rg, net: t.net,
      notes: byId('ff-notes').value.trim()
    };
  }

  var saveBtn = overlay.querySelector('#ff-save');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    var data = collectData();
    if(!data) return;
    saveFacture(data, facture?facture.id:null).then(function(){
      if(fromPfa) STATE.db.doc('propositionsFacturation/'+fromPfa.id).update({statut:'convertie'});
      closeModal(); toast('Facture enregistrée', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
  var validateBtn = overlay.querySelector('#ff-validate');
  if(validateBtn) validateBtn.addEventListener('click', function(){
    var data = collectData();
    if(!data) return;
    saveFacture(data, facture.id).then(function(){
      return validateFacture(facture.id);
    }).then(function(numero){
      closeModal(); toast('Facture validée : '+numero, 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

// Modification du numero d'une facture client DEJA IMPORTEE (V1.50,
// demande explicite de l'utilisateur) : ces factures sont enregistrees
// verrouillees des l'import (RG-003) et leur "numero" est la reference
// d'origine du document, pas une sequence FAC-AAAA-NNNNN officielle (voir
// RG-009 plus haut) - une erreur de saisie/reconnaissance sur cette seule
// reference ne doit pas obliger a tout reimporter. Volontairement limite a
// CE seul champ (le reste - montants, lignes, client - reste verrouille,
// RG-003 inchange) : pas de bouton equivalent sur les factures creees
// normalement dans l'application, dont le numero est attribue et verrouille
// de façon atomique par validateFacture() (P-09) et ne doit jamais etre
// modifie a la main. Controle d'unicite obligatoire (findFactureClientDoublon,
// global a toutes les factures clients - voir sa docstring). Si un fichier
// d'origine est classe sur disque, il est re-deplace/renomme en consequence
// (meme principe que openFactureFournisseurEditModal) pour rester coherent
// avec le numero affiche. Comme pour la modification du numero d'une
// facture fournisseur deja existante, l'ecriture comptable deja generee
// (RG-004/005 : jamais modifiee) n'est PAS regeneree - elle garde le numero
// qui etait le sien au moment de sa creation.
function openFactureClientNumeroEditModal(f){
  if(!f) return;
  var overlay = openModal({
    title: 'Modifier le numéro de la facture',
    body:
      '<p class="hint" style="margin-bottom:12px;">Facture importée — seul le numéro (référence d’origine) peut être corrigé ici ; le reste du contenu reste verrouillé (RG-003). Le numéro doit être unique.</p>'+
      '<div class="field"><label for="fen-numero">N° facture</label><input id="fen-numero" value="'+esc(f.numero||'')+'" autofocus></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="fen-save">Enregistrer</button>'
  });
  overlay.querySelector('#fen-save').addEventListener('click', function(){
    var numero = byId('fen-numero').value.trim();
    if(!numero){ toast('Le numéro ne peut pas être vide', 'danger'); return; }
    var doublon = findFactureClientDoublon(numero, f.id);
    if(doublon){
      toast('Une autre facture porte déjà ce numéro ('+(doublon.clientNom||'client inconnu')+').', 'danger');
      return;
    }
    if(numero === (f.numero||'')){ closeModal(); return; }
    var majFichier = f.fileRelPath
      ? finalizeFactureClientFile(f.fileRelPath, f.clientNom, f.date, numero)
      : Promise.resolve(null);
    majFichier.then(function(res){
      return STATE.db.doc('factures/'+f.id).update({
        numero: numero,
        referenceHistorique: numero,
        fileRelPath: res ? res.fileRelPath : f.fileRelPath
      });
    }).then(function(){
      closeModal(); toast('Numéro de facture mis à jour', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); });
  });
}

/* =========================================================
   V2.05 — MODIFICATION MANUELLE DU NUMERO OFFICIEL (Devis / Contrat ;
   V2.14 : la Commande client a ete supprimee, fusionnee dans le Contrat),
   demande explicite de l'utilisateur.

   Normalement, le numero officiel (DEV-/CMD-/CTR-AAAA-NNNN) d'un de ces
   trois documents est attribue UNE SEULE FOIS, de facon atomique, par
   nextDocNumber() (RG-001/002/003 du CDC de nomenclature, voir
   claude/cdc-nomenclature-numerotation-analyse.md) et n'est jamais modifie
   ensuite. Decisions validees explicitement avec l'utilisateur avant
   implementation :
   - les 3 numeros deviennent modifiables (bouton "N°" sur chaque liste) ;
   - reserve a l'administrateur (voir isAdmin() cote frontend - masque
     simplement le bouton - et _is_numero_edit_request()/enforce_request()
     dans backend/access.py, qui est le controle qui fait reellement foi) ;
   - controle d'unicite obligatoire (findDevisDoublon/findBCDoublon/
     findCTRDoublon, meme principe que findFactureClientDoublon) ;
   - toutes les copies denormalisees de ce numero, ailleurs dans la base,
     sont mises a jour en meme temps (voir chaque fonction ci-dessous pour
     le detail exact des collections concernees - releve exhaustif par
     recherche dans tout le code).

   Cas particulier du Contrat : son numero est BAKE (recopie de facon
   definitive, pas seulement denormalise) dans le numero OFFICIEL de ses
   propres avenants/attachements/bordereaux (ex. CTR-2026-0001-AV01) par
   saveAV()/saveAtt()/openBordereauFormModal() au moment de leur creation -
   une fois cree, ce numero compose ne peut plus etre recalcule sans
   renumeroter un document deja officiellement attribue (interdit, RG-003).
   openCTRNumeroEditModal() bloque donc totalement la modification tant
   qu'au moins un avenant, attachement ou bordereau existe deja sur ce
   contrat (meme verification que le blocage de suppression definitive
   V2.01, a l'exception volontaire des livrables : eux ne portent qu'une
   simple reference d'affichage ctrNumero, jamais bakee dans leur propre
   numero officiel, donc leur presence seule ne bloque pas ce changement).
   ========================================================= */
function openDevisNumeroEditModal(d){
  if(!d) return;
  var overlay = openModal({
    title: 'Modifier le numéro du devis',
    body:
      '<p class="hint" style="margin-bottom:12px;">Réservé à l’administrateur. Ce numéro est normalement attribué une seule fois et jamais modifié (RG-003) — n’utilisez ceci que pour corriger une erreur. Le numéro doit rester unique.</p>'+
      '<div class="field"><label for="den-numero">N° devis</label><input id="den-numero" value="'+esc(d.numero||'')+'" autofocus></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="den-save">Enregistrer</button>'
  });
  overlay.querySelector('#den-save').addEventListener('click', function(){
    var numero = byId('den-numero').value.trim();
    if(!numero){ toast('Le numéro ne peut pas être vide', 'danger'); return; }
    if(numero === (d.numero||'')){ closeModal(); return; }
    var doublon = findDevisDoublon(numero, d.id);
    if(doublon){ toast('Un autre devis porte déjà ce numéro ('+(doublon.clientNom||'client inconnu')+').', 'danger'); return; }
    // Seule copie denormalisee connue de devisNumero : contrats.devisId
    // (V2.14 : la commande client a fusionne dans le contrat).
    var bcAMaj = STATE.ctr.filter(function(x){ return x.devisId===d.id; });
    var elD = elementsDuDevis(d.id);
    if(elD.bordereaux.length){
      toast('Modification impossible : des bordereaux existent déjà sur ce devis, leur numéro intègre celui du devis (RG-003).', 'danger'); return;
    }
    var majD = [];
    elD.livrables.forEach(function(x){ majD.push(STATE.db.doc('livrables/'+x.id).update({devisNumero: numero})); });
    elD.plan.forEach(function(x){ majD.push(STATE.db.doc('planificationLignes/'+x.id).update({devisNumero: numero})); });
    elD.pointage.forEach(function(x){ majD.push(STATE.db.doc('timesheetLignes/'+x.id).update({devisNumero: numero})); });
    Promise.all([
      STATE.db.doc('devis/'+d.id).update({numero: numero})
    ].concat(majD).concat(bcAMaj.map(function(x){ return STATE.db.doc('contrats/'+x.id).update({devisNumero: numero}); })))
    .then(function(){ closeModal(); toast('Numéro du devis mis à jour'+(bcAMaj.length? ' ('+bcAMaj.length+' contrat(s) lié(s) mis à jour)':'')+'.', 'success'); })
    .catch(function(err){ console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); });
  });
}

function openCTRNumeroEditModal(d){
  if(!d) return;
  var lie = (STATE.av||[]).some(function(a){ return a.ctrId===d.id; }) ||
    (STATE.att||[]).some(function(a){ return a.ctrId===d.id; }) ||
    (STATE.bordereaux||[]).some(function(bd){ return bd.ctrId===d.id; });
  if(lie){
    toast('Modification impossible : des avenants, attachements ou bordereaux existent déjà sur ce contrat. Leur propre numéro officiel intègre déjà celui du contrat et ne peut plus être recalculé (RG-003).', 'danger');
    return;
  }
  var overlay = openModal({
    title: 'Modifier le numéro du contrat',
    body:
      '<p class="hint" style="margin-bottom:12px;">Réservé à l’administrateur. Ce numéro est normalement attribué une seule fois et jamais modifié (RG-003) — n’utilisez ceci que pour corriger une erreur. Le numéro doit rester unique.</p>'+
      '<div class="field"><label for="cen-numero">N° contrat</label><input id="cen-numero" value="'+esc(d.numero||'')+'" autofocus></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="cen-save">Enregistrer</button>'
  });
  overlay.querySelector('#cen-save').addEventListener('click', function(){
    var numero = byId('cen-numero').value.trim();
    if(!numero){ toast('Le numéro ne peut pas être vide', 'danger'); return; }
    if(numero === (d.numero||'')){ closeModal(); return; }
    var doublon = findCTRDoublon(numero, d.id);
    if(doublon){ toast('Un autre contrat porte déjà ce numéro ('+(doublon.clientNom||'client inconnu')+').', 'danger'); return; }
    // Copies denormalisees connues de ctrNumero (releve exhaustif) :
    // livrables, planificationLignes, timesheetLignes, propositions de
    // facturation et factures (champ ctrId, V2.14). AV/ATT/bordereaux sont
    // exclus : leur presence bloque deja toute modification ci-dessus.
    var maj = [STATE.db.doc('contrats/'+d.id).update({numero: numero})];
    var n = 0;
    (STATE.livrables||[]).filter(function(x){ return x.ctrId===d.id; }).forEach(function(x){ n++; maj.push(STATE.db.doc('livrables/'+x.id).update({ctrNumero: numero})); });
    (STATE.planificationLignes||[]).filter(function(x){ return x.ctrId===d.id; }).forEach(function(x){ n++; maj.push(STATE.db.doc('planificationLignes/'+x.id).update({ctrNumero: numero})); });
    (STATE.timesheetLignes||[]).filter(function(x){ return x.ctrId===d.id; }).forEach(function(x){ n++; maj.push(STATE.db.doc('timesheetLignes/'+x.id).update({ctrNumero: numero})); });
    (STATE.pfa||[]).filter(function(x){ return x.ctrId===d.id; }).forEach(function(x){ n++; maj.push(STATE.db.doc('propositionsFacturation/'+x.id).update({ctrNumero: numero})); });
    (STATE.fac||[]).filter(function(x){ return x.ctrId===d.id; }).forEach(function(x){ n++; maj.push(STATE.db.doc('factures/'+x.id).update({ctrNumero: numero})); });
    Promise.all(maj).then(function(){
      closeModal(); toast('Numéro du contrat mis à jour'+(n? ' ('+n+' document(s) lié(s) mis à jour)':'')+'.', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); });
  });
}

/* =========================================================
   FACTURES CLIENTS — IMPORT PDF (factures deja emises a enregistrer dans le
   registre "Factures" existant, a l'instar du module Factures fournisseurs)

   Choix valides avec l'utilisateur avant implementation :
   - rejoint le registre "Factures" existant (pas de registre separe) ;
   - aucun numero FAC-AAAA-NNNNN officiel n'est attribue : le numero deja
     present sur le document (ex. "2026_01") est repris tel quel comme
     "numero" ET conserve explicitement dans un champ "referenceHistorique"
     dedie (RG-009 du CDC de nomenclature) pour etre toujours reconnaissable
     comme un numero d'origine externe, jamais une vraie sequence FAC ;
   - enregistree directement "Validee" et verrouillee (ces factures sont
     deja reellement emises) : ecriture comptable generee immediatement,
     comme une validation normale (genererEcritureFacture, V1.32) ;
   - perimetre volontairement reduit au coeur du besoin pour cette premiere
     version (pas d'editeur de zones, pas de detection de doublons, pas de
     dossier source "a traiter", pas de repertoire configurable - cf. module
     Factures fournisseurs, qui a accumule ces raffinements au fil de
     plusieurs versions ulterieures).
   ========================================================= */
var factureClientEnCours = null; // {batchId, lignes:[...]} - pas encore enregistre

var fcFilesInputEl = null;
function getFcFilesInput(){
  if(fcFilesInputEl && document.body.contains(fcFilesInputEl)) return fcFilesInputEl;
  fcFilesInputEl = document.createElement('input');
  fcFilesInputEl.type = 'file';
  fcFilesInputEl.accept = '.pdf,.jpg,.jpeg,.png';
  fcFilesInputEl.multiple = true;
  fcFilesInputEl.hidden = true;
  fcFilesInputEl.id = 'fc-files-input';
  document.body.appendChild(fcFilesInputEl);
  fcFilesInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if(files.length) importFacturesClientFiles(files, byId('view-content'), byId('topbar-actions'));
  });
  return fcFilesInputEl;
}

function importFacturesClientFiles(fileList, mount, actions){
  toast('Analyse des factures en cours…');
  var fd = new FormData();
  Array.prototype.forEach.call(fileList, function(f){ fd.append('files', f); });
  fetch('/api/facture-client/import-files', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    factureClientEnCours = {
      batchId: res.batchId,
      lignes: res.lignes.map(function(l){
        var first = (l.lignesGuess||[])[0];
        return Object.assign({
          garder:true, clientId:l.clientIdGuess||null,
          designation: (first&&first.designation) || 'Prestations facturées',
          qte: (first&&first.qte) || 1
        }, l);
      })
    };
    scheduleRender();
    toast(res.lignes.length+' fichier(s) analysé(s). Vérifiez les champs avant d’enregistrer.', 'success');
    if(res.skipped){ toast(res.skipped+' fichier(s) ignoré(s) (format non pris en charge)', 'warning'); }
  }).catch(function(err){ console.error(err); toast('Erreur d’analyse des fichiers : '+err.message, 'danger'); });
}

function finalizeFactureClientFile(currentRelPath, clientNom, date, reference){
  return fetch('/api/facture-client/finalize-file', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({currentRelPath:currentRelPath, clientNom:clientNom, date:date, reference:reference})
  }).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  });
}

// Enregistre directement une facture importee comme deja "Validee" et
// verrouillee (choix valide avec l'utilisateur) - a la difference de
// saveFacture() (brouillon, numero attribue seulement a la validation), et
// genere son ecriture comptable immediatement (meme mecanisme que
// validateFacture, sans l'etape nextDocNumber puisqu'aucun numero FAC
// officiel n'est attribue a une facture importee).
function saveFactureClientImportee(data){
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('factures').add(data).then(function(ref){
    var saved = Object.assign({id: ref.id}, data);
    genererEcritureFacture(saved);
    return saved;
  });
}

function renderFactureClientEnCoursHtml(enCours, canEdit){
  var rows = enCours.lignes.map(function(l, idx){
    var fileUrl = '/api/facture-client/file/'+l.fileRelPath.split('/').map(encodeURIComponent).join('/');
    return '<tr'+(l.garder===false?' style="opacity:.45;"':'')+'>'+
      '<td style="text-align:center;"><input type="checkbox" class="fc-garder" data-idx="'+idx+'" style="width:auto;" '+(l.garder!==false?'checked':'')+'></td>'+
      '<td><a href="'+fileUrl+'" target="_blank" title="Voir le fichier">'+ic('file',14)+'</a> <span class="muted" style="font-size:11.5px;">'+esc(l.fileName)+'</span>'+
        (l.ocrUtilise? ' <span class="pill pill-neutral" style="font-size:10px;">OCR</span>' : '')+
      '</td>'+
      '<td><select class="fc-client" data-idx="'+idx+'" style="min-width:150px;">'+'<option value=""'+(l.clientId?'':' selected')+'>— Choisir —</option>'+clientOptionsHtml(l.clientId, true)+'</select>'+
        (!l.clientId? '<button type="button" class="linklike fc-add-client" data-idx="'+idx+'" style="display:block;margin-top:4px;font-size:11.5px;text-align:left;">'+ic('plus',11)+' Ajouter'+(l.clientNomGuess? ' « '+esc(l.clientNomGuess)+' »' : ' ce client')+'</button>' : '')+
      '</td>'+
      '<td><input class="fc-numero" data-idx="'+idx+'" value="'+esc(l.numero||'')+'" title="Numéro déjà présent sur le document d’origine — conservé tel quel, aucun numéro FAC ne sera attribué" style="min-width:110px;"></td>'+
      '<td><input type="date" class="fc-date" data-idx="'+idx+'" value="'+esc(l.date||'')+'" style="min-width:130px;"></td>'+
      '<td><input class="fc-reference" data-idx="'+idx+'" value="'+esc(l.reference||'')+'" placeholder="BC / PO client" style="min-width:140px;"></td>'+
      '<td>'+((l.lignesGuess&&l.lignesGuess.length>1)?
          '<span class="pill pill-neutral" title="Facture a articles multiples : le detail complet ('+l.lignesGuess.length+' lignes) sera enregistre tel que detecte, modifiable ensuite via le bouton Modifier de la facture.">'+l.lignesGuess.length+' lignes detectees</span>'
          : '<input class="fc-designation" data-idx="'+idx+'" value="'+esc(l.designation||'')+'" style="min-width:160px;">')+'</td>'+
      '<td><input type="number" step="any" class="fc-ht" data-idx="'+idx+'" value="'+(l.montantHT!=null?l.montantHT:'')+'" style="width:95px;"></td>'+
      '<td><input type="number" step="any" class="fc-tva" data-idx="'+idx+'" value="'+(l.montantTVA!=null?l.montantTVA:'')+'" style="width:85px;"></td>'+
      '<td><input type="number" step="any" class="fc-ttc" data-idx="'+idx+'" value="'+(l.montantTTC!=null?l.montantTTC:'')+'" style="width:95px;"></td>'+
    '</tr>';
  }).join('');

  return '<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
      '<div><b>Factures importées</b><div class="muted" style="font-size:12.5px;margin-top:2px;">'+enCours.lignes.length+' fichier(s) détecté(s) — décochez ceux qui ne sont pas des factures. Une fois enregistrées, ces factures sont directement « Validées » et verrouillées (RG-003) : vérifiez bien chaque champ avant de confirmer.</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="fc-cancel">Annuler l’import</button>'+
        (canEdit? '<button type="button" class="btn btn-primary" id="fc-save-all">'+ic('check',14)+' Enregistrer les factures cochées</button>' : '')+
      '</div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr>'+
      '<th></th><th>Fichier</th><th>Client</th><th>N° (réf. historique)</th><th>Date</th><th>Référence BC/PO</th><th>Désignation</th><th>HT</th><th>TVA</th><th>TTC</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p class="hint" style="margin-top:10px;">Reconnaissance automatique à vérifier ligne par ligne — l’extraction est une aide à la saisie, pas une garantie. Client, date et numéro sont nécessaires pour classer le fichier d’origine et générer l’écriture comptable de vente.</p>';
}

function wireFactureClientEnCours(mount, actions){
  var enCours = factureClientEnCours;
  function bindField(selector, prop, isNumber){
    mount.querySelectorAll(selector).forEach(function(inp){
      inp.addEventListener('change', function(){
        var idx = Number(inp.getAttribute('data-idx'));
        enCours.lignes[idx][prop] = isNumber ? (inp.value===''?null:Number(inp.value)) : inp.value;
      });
    });
  }
  mount.querySelectorAll('.fc-garder').forEach(function(chk){
    chk.addEventListener('change', function(){
      enCours.lignes[Number(chk.getAttribute('data-idx'))].garder = chk.checked;
      renderFactures(mount, actions);
    });
  });
  function openNewClientFor(idx){
    openClientFormModal(null, {
      presetNom: enCours.lignes[idx].clientNomGuess||'',
      presetIce: enCours.lignes[idx].clientIceGuess||'',
      onSaved: function(saved){
        enCours.lignes[idx].clientId = saved.id;
        scheduleRender();
      }
    });
  }
  mount.querySelectorAll('.fc-client').forEach(function(sel){
    sel.addEventListener('change', function(){
      var idx = Number(sel.getAttribute('data-idx'));
      if(sel.value==='__new__'){
        openNewClientFor(idx);
        sel.value = enCours.lignes[idx].clientId||'';
        return;
      }
      enCours.lignes[idx].clientId = sel.value||null;
      scheduleRender();
    });
  });
  mount.querySelectorAll('.fc-add-client').forEach(function(btn){
    btn.addEventListener('click', function(){ openNewClientFor(Number(btn.getAttribute('data-idx'))); });
  });
  bindField('.fc-numero', 'numero', false);
  bindField('.fc-date', 'date', false);
  bindField('.fc-reference', 'reference', false);
  bindField('.fc-designation', 'designation', false);
  bindField('.fc-ht', 'montantHT', true);
  bindField('.fc-tva', 'montantTVA', true);
  bindField('.fc-ttc', 'montantTTC', true);

  byId('fc-cancel').addEventListener('click', function(){
    confirmDialog('Abandonner cet import ? Les fichiers importés seront supprimés.', {danger:true, okLabel:'Abandonner'}).then(function(ok){
      if(!ok) return;
      fetch('/api/facture-client/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})}).catch(function(e){ console.error(e); });
      factureClientEnCours = null;
      scheduleRender();
    });
  });
  var saveBtn = byId('fc-save-all');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    var aGarder = enCours.lignes.filter(function(l){ return l.garder!==false; });
    if(!aGarder.length){ toast('Aucune facture cochée à enregistrer', 'danger'); return; }
    var incomplet = aGarder.filter(function(l){ return !l.clientId || !l.date || !(l.numero||'').trim() || l.montantTTC==null; });
    if(incomplet.length){
      toast('Client, date, numéro et montant TTC sont obligatoires pour chaque facture cochée ('+incomplet.length+' ligne(s) à compléter)', 'danger');
      return;
    }
    saveBtn.disabled = true;
    Promise.all(aGarder.map(function(l){
      var client = STATE.clients.find(function(c){ return c.id===l.clientId; });
      var nom = client? client.nom : '';
      var numero = (l.numero||'').trim();
      var ht = Number(l.montantHT)||0, tva = Number(l.montantTVA)||0, ttc = Number(l.montantTTC)||0;
      var qte = Number(l.qte)||1;
      // Facture a articles multiples correctement detectee par le moteur
      // d'extraction (ex. decompte d'heures par intervenant) : on enregistre
      // le detail complet tel que detecte plutot qu'une seule ligne de
      // synthese - modifiable ensuite via le bouton Modifier (meme editeur
      // de lignes que pour une facture normale). Sinon (cas le plus
      // frequent), comportement inchange : une seule ligne construite a
      // partir du champ Designation/HT edites sur cet ecran.
      var lignes = (l.lignesGuess && l.lignesGuess.length>1)
        ? l.lignesGuess.map(function(x){
            return {
              designation: (x.designation||'Prestations facturées').trim(),
              unite: x.unite||'u',
              qte: Number(x.qte)||0,
              pu: Number(x.pu)||0
            };
          })
        : [{designation: (l.designation||'Prestations facturées').trim(), unite:'u', qte: qte, pu: n2(ht/qte)}];
      return finalizeFactureClientFile(l.fileRelPath, nom, l.date, numero).then(function(res){
        return saveFactureClientImportee({
          clientId: l.clientId, clientNom: nom,
          ctrId: null, ctrNumero: null, attachementId: null, attachementNumero: null, pfaId: null, pfaNumero: null,
          date: l.date, echeance: '',
          reference: (l.reference||'').trim(), revision: '00',
          lignes: lignes,
          tauxTVA: ht>0? n2(tva/ht*100) : STATE.company.tauxTVA, tauxRG: 0,
          ht: ht, montantTVA: tva, ttc: ttc, montantRG: 0, net: ttc,
          notes: '',
          numero: numero, referenceHistorique: numero,
          statut: 'validee', verrouillee: true, valideePar: currentUserName(), valideeAt: nowISO(),
          fileRelPath: res.fileRelPath, fileName: l.fileName, ocrUtilise: !!l.ocrUtilise
        }).then(function(){ l._savedOk = true; });
      });
    })).then(function(){
      return fetch('/api/facture-client/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})}).catch(function(){});
    }).then(function(){
      toast(aGarder.length+' facture(s) enregistrée(s) et validée(s)', 'success');
      factureClientEnCours = null;
      scheduleRender();
    }).catch(function(err){
      console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); saveBtn.disabled = false;
    });
  });
}

/* =========================================================
   AVOIRS
   ========================================================= */
var avoFilter = {q:''};
function renderAVO(mount, actions){
  var canEdit = canWrite('avo');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-avo">'+ic('plus',15)+' Nouvel avoir</button>';
    byId('btn-new-avo').addEventListener('click', function(){ openAVOFormModal(null); });
  }
  var list = STATE.avo.filter(function(a){
    if(avoFilter.q){
      var q = avoFilter.q.toLowerCase();
      if((a.numero||'').toLowerCase().indexOf(q)<0 && (a.clientNom||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="avo-search" placeholder="N° ou client…" value="'+esc(avoFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' avoir(s)</span>'+
    '</div></div>';

  if(!STATE.avo.length){
    body += emptyState('receipt', 'Aucun avoir émis.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-avo">'+ic('plus',15)+' Créer un avoir</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun avoir ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Client</th><th>Facture liée</th><th>Date</th><th class="r">Montant TTC</th><th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(a){
        var t = calcDocTotals(a.lignes, a.tauxTVA, 0);
        var sm = statutMeta(AVO_STATUTS, a.statut);
        return '<tr>'+
          '<td class="num">'+esc(a.numero)+'</td>'+
          '<td>'+esc(a.clientNom||'—')+'</td>'+
          '<td class="num muted">'+esc(a.factureNumero||'—')+'</td>'+
          '<td class="muted">'+fmtDate(a.date)+'</td>'+
          '<td class="r num">'+fmtMoney(t.ttc)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td><div class="row-actions">'+
            '<button type="button" class="iconbtn" data-print="'+a.id+'" title="Imprimer">'+ic('print',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+a.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && a.statut!=='annulee'? '<button type="button" class="iconbtn" data-cancel="'+a.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('avo-search');
  if(s1) s1.addEventListener('input', debounce(function(){ avoFilter.q = s1.value; renderAVO(mount, actions); }, 220));
  var eb = byId('empty-new-avo'); if(eb) eb.addEventListener('click', function(){ openAVOFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openAVOFormModal(STATE.avo.find(function(a){ return a.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-print]').forEach(function(b){ b.addEventListener('click', function(){
    printDocument('avo', STATE.avo.find(function(a){ return a.id===b.getAttribute('data-print'); }));
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler cet avoir ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler l’avoir'}).then(function(ok){
      if(!ok) return;
      cancelDoc('avoirs', id, 'statut', 'annulee').then(function(){ genererContreEcritureSiExiste('avoir', id); toast('Avoir annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function factureOptionsForAVO(selectedId, clientId){
  var list = STATE.fac.filter(function(f){ return f.numero && (!clientId || f.clientId===clientId); });
  return '<option value="">— Aucune (avoir autonome) —</option>'+list.sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); }).map(function(f){
    return '<option value="'+f.id+'"'+(selectedId===f.id?' selected':'')+'>'+esc(f.numero)+' — '+esc(f.clientNom||'')+'</option>';
  }).join('');
}

function openAVOFormModal(avo){
  var f = avo ? Object.assign({}, avo) : {date:todayISO(), tauxTVA:STATE.company.tauxTVA, statut:'brouillon'};
  var lignes = JSON.parse(JSON.stringify(f.lignes || [{designation:'', unite:'u', qte:1, pu:0}]));
  var tauxTVA = f.tauxTVA!==undefined ? f.tauxTVA : STATE.company.tauxTVA;

  var overlay = openModal({
    title: avo ? 'Modifier l’avoir '+avo.numero : 'Nouvel avoir',
    large: true,
    body:
      unitesDatalist()+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="avo-client">Client</label><select id="avo-client" required><option value="">— Choisir —</option>'+clientOptionsHtml(f.clientId)+'</select></div>'+
        '<div class="field"><label for="avo-facture">Facture liée (optionnel)</label><select id="avo-facture">'+factureOptionsForAVO(f.factureId, f.clientId)+'</select></div>'+
        '<div class="field"><label for="avo-date">Date</label><input type="date" id="avo-date" value="'+esc(f.date||todayISO())+'"></div>'+
      '</div>'+
      '<div class="field"><label for="avo-motif">Motif de l’avoir</label><input id="avo-motif" value="'+esc(f.motif||'')+'" placeholder="ex. Erreur de facturation, remise commerciale, retour…"></div>'+
      '<fieldset><legend>Lignes</legend>'+simpleLinesEditorHtml(lignes)+'</fieldset>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="avo-tva">TVA (%)</label><input type="number" step="any" id="avo-tva" value="'+tauxTVA+'"></div>'+
        '<div class="field"><label for="avo-statut">Statut</label><select id="avo-statut">'+AVO_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+((f.statut||'brouillon')===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select></div>'+
      '</div>'+
      '<div id="avo-totals"></div>'+
      '<div class="field" style="margin-top:14px;"><label for="avo-notes">Notes</label><textarea id="avo-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="avo-save">Enregistrer</button>'
  });

  function refreshTotals(){
    var t = calcDocTotals(lignes, Number(byId('avo-tva').value), 0);
    byId('avo-totals').innerHTML = totalsBoxHtml(t);
  }
  wireSimpleLinesEditor(function(){ return lignes; }, function(v){ lignes = v; }, refreshTotals);
  byId('avo-tva').addEventListener('input', refreshTotals);
  byId('avo-client').addEventListener('change', function(){
    byId('avo-facture').innerHTML = factureOptionsForAVO('', byId('avo-client').value);
  });
  refreshTotals();

  overlay.querySelector('#avo-save').addEventListener('click', function(){
    var clientId = byId('avo-client').value;
    if(!clientId){ toast('Veuillez choisir un client', 'danger'); return; }
    var client = STATE.clients.find(function(c){ return c.id===clientId; });
    var facSel = STATE.fac.find(function(x){ return x.id===byId('avo-facture').value; });
    var data = {
      clientId: clientId, clientNom: client?client.nom:'',
      factureId: facSel?facSel.id:null, factureNumero: facSel?facSel.numero:null,
      date: byId('avo-date').value || todayISO(), motif: byId('avo-motif').value.trim(),
      lignes: lignes, tauxTVA: Number(byId('avo-tva').value)||0,
      statut: byId('avo-statut').value, notes: byId('avo-notes').value.trim()
    };
    saveAVO(data, avo?avo.id:null).then(function(ref){
      // Comptabilite (V1.32) : ecriture de vente (inversee) generee
      // automatiquement quand l'avoir est enregistre avec le statut "Validé".
      if(data.statut==='validee'){
        var finalId = avo ? avo.id : (ref && ref.id);
        var numero = data.numero || (avo && avo.numero) || '';
        if(finalId && numero){
          var totaux = calcDocTotals(data.lignes, data.tauxTVA, 0);
          genererEcritureAvoir({id:finalId, numero:numero, clientNom:data.clientNom, date:data.date}, totaux);
        }
      }
      closeModal(); toast('Avoir enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   REGLEMENTS CLIENTS
   ========================================================= */
var regFilter = {q:''};
function renderReglements(mount, actions){
  var canEdit = canWrite('reg');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-reg">'+ic('plus',15)+' Nouvel encaissement</button>';
    byId('btn-new-reg').addEventListener('click', function(){ openReglementFormModal(null); });
  }
  var list = STATE.reg.filter(function(r){
    if(regFilter.q){
      var q = regFilter.q.toLowerCase();
      if((r.numero||'').toLowerCase().indexOf(q)<0 && (r.clientNom||'').toLowerCase().indexOf(q)<0 && (r.factureNumero||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="reg-search" placeholder="N°, facture ou client…" value="'+esc(regFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' encaissement(s)</span>'+
    '</div></div>';

  if(!STATE.reg.length){
    body += emptyState('coins', 'Aucun encaissement enregistré.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-reg">'+ic('plus',15)+' Enregistrer un encaissement</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun encaissement ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Facture</th><th>Client</th><th>Date</th><th>Mode</th><th>Référence</th><th class="r">Montant</th><th>Statut</th><th></th></tr></thead><tbody>'+
      list.map(function(r){
        var modeLabel = (REG_MODES.find(function(m){return m.id===r.mode;})||{label:r.mode}).label;
        var sm = statutMeta(REG_STATUTS, r.statut||'valide');
        return '<tr>'+
          '<td class="num">'+esc(r.numero)+'</td>'+
          '<td class="num muted">'+esc(r.factureNumero||'—')+'</td>'+
          '<td>'+esc(r.clientNom||'—')+'</td>'+
          '<td class="muted">'+fmtDate(r.date)+'</td>'+
          '<td><span class="pill pill-neutral">'+esc(modeLabel)+'</span></td>'+
          '<td class="muted">'+esc(r.reference||'—')+'</td>'+
          '<td class="r num">'+fmtMoney(r.montant)+'</td>'+
          '<td><span class="pill pill-'+sm.tone+'">'+esc(sm.label)+'</span></td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit="'+r.id+'" title="Modifier">'+ic('pencil',15)+'</button>' : '')+
            (canEdit && r.statut!=='annule'? '<button type="button" class="iconbtn" data-cancel="'+r.id+'" title="Annuler">'+ic('x',15)+'</button>' : '')+
            (canEdit? '' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('reg-search');
  if(s1) s1.addEventListener('input', debounce(function(){ regFilter.q = s1.value; renderReglements(mount, actions); }, 220));
  var eb = byId('empty-new-reg'); if(eb) eb.addEventListener('click', function(){ openReglementFormModal(null); });
  mount.querySelectorAll('[data-edit]').forEach(function(b){ b.addEventListener('click', function(){
    openReglementFormModal(STATE.reg.find(function(r){ return r.id===b.getAttribute('data-edit'); }));
  }); });
  mount.querySelectorAll('[data-cancel]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-cancel');
    confirmDialog('Annuler cet encaissement ? Il restera visible avec le statut « Annulé » (aucune suppression physique).', {danger:true, okLabel:'Annuler l’encaissement'}).then(function(ok){
      if(!ok) return;
      cancelDoc('reglements', id, 'statut', 'annule').then(function(){ genererContreEcritureSiExiste('encaissement', id); toast('Encaissement annulé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function factureOptionsForReg(selectedId){
  var open = STATE.fac.filter(function(f){ return f.statut!=='annulee' && (selectedId===f.id || factureEtat(f).reste>0.009); });
  return open.sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); }).map(function(f){
    var e = factureEtat(f);
    return '<option value="'+f.id+'"'+(selectedId===f.id?' selected':'')+'>'+esc(f.numero)+' — '+esc(f.clientNom||'')+' (reste '+fmtMoney2(e.reste)+')</option>';
  }).join('');
}

function openReglementFormModal(reg, fromFacture){
  var f = reg || {};
  var initialFactureId = f.factureId || (fromFacture?fromFacture.id:'');
  var overlay = openModal({
    title: reg ? 'Modifier l’encaissement '+reg.numero : 'Nouvel encaissement client',
    body:
      '<div class="field"><label for="rf-facture">Facture</label><select id="rf-facture" required><option value="">— Choisir —</option>'+factureOptionsForReg(initialFactureId)+'</select></div>'+
      '<div id="rf-facture-info" class="hint" style="margin-bottom:10px;"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="rf-date">Date</label><input type="date" id="rf-date" value="'+esc(f.date||todayISO())+'"></div>'+
        '<div class="field"><label for="rf-montant">Montant</label><input type="number" step="any" id="rf-montant" value="'+(f.montant!==undefined?f.montant:'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="rf-mode">Mode de règlement</label><select id="rf-mode">'+REG_MODES.map(function(m){ return '<option value="'+m.id+'"'+((f.mode||'virement')===m.id?' selected':'')+'>'+esc(m.label)+'</option>'; }).join('')+'</select></div>'+
        '<div class="field"><label for="rf-ref">Référence (n° chèque / virement)</label><input id="rf-ref" value="'+esc(f.reference||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="rf-banque">Banque</label><input id="rf-banque" value="'+esc(f.banque||'')+'"></div>'+
      '<div class="field"><label for="rf-notes">Notes</label><textarea id="rf-notes">'+esc(f.notes||'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="rf-save">Enregistrer</button>'
  });

  function refreshInfo(){
    var fac = STATE.fac.find(function(x){ return x.id===byId('rf-facture').value; });
    var info = byId('rf-facture-info');
    if(!fac){ info.textContent=''; return; }
    var e = factureEtat(fac);
    var already = reg ? n2(e.reste + (Number(reg.montant)||0)) : e.reste;
    info.innerHTML = 'Net à payer : <b>'+fmtMoney(fac.net)+'</b> · Déjà réglé : <b>'+fmtMoney(e.paye - (reg&&reg.factureId===fac.id?Number(reg.montant)||0:0))+'</b> · Reste dû : <b>'+fmtMoney(already)+'</b>';
    if(!reg && !byId('rf-montant').value) byId('rf-montant').value = already;
  }
  byId('rf-facture').addEventListener('change', refreshInfo);
  refreshInfo();

  overlay.querySelector('#rf-save').addEventListener('click', function(){
    var factureId = byId('rf-facture').value;
    if(!factureId){ toast('Veuillez choisir une facture', 'danger'); return; }
    var montant = Number(byId('rf-montant').value);
    if(!montant || montant<=0){ toast('Veuillez saisir un montant valide', 'danger'); return; }
    var fac = STATE.fac.find(function(x){ return x.id===factureId; });
    var data = {
      factureId: factureId, factureNumero: fac?fac.numero:'', clientId: fac?fac.clientId:'', clientNom: fac?fac.clientNom:'',
      date: byId('rf-date').value || todayISO(), montant: montant,
      mode: byId('rf-mode').value, reference: byId('rf-ref').value.trim(), banque: byId('rf-banque').value.trim(),
      notes: byId('rf-notes').value.trim()
    };
    saveReglement(data, reg?reg.id:null).then(function(){
      closeModal(); toast('Encaissement enregistré', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   RELEVES BANCAIRES (import PDF -> rapprochement TIERS -> export Excel)
   =========================================================
   Reprend le module Python fourni par l'utilisateur (001_Conversion7.py,
   tkinter + pdfplumber + pandas, fichier TIERS externe) : l'extraction PDF et
   le rapprochement se font maintenant cote serveur Flask
   (backend/routes/releve.py, meme regex/heuristiques), la liste TIERS est
   devenue la collection 'tiersBancaires' editable dans Parametres, les lignes
   non reconnues ("INCONNU") se corrigent directement dans ce tableau (avec
   possibilite de memoriser le mot-cle pour les prochains imports), et le
   rapprochement TVA (montant / 6) + les totaux Client/Fournisseur - jusqu'ici
   calcules a la main dans Excel - sont automatiques. */
var releveEnCours = null; // {nomFichier, lignes:[...], totalClient, totalFournisseur} - pas encore enregistre

function renderReleves(mount, actions){
  var canEdit = canWrite('releves');
  // V1.99 : bouton "Gérer les tiers bancaires / fournisseurs" ajoute ici,
  // demande explicite de l'utilisateur ("doit etre accessible a partir de
  // la page Relevés bancaires") pour remplacer l'ancienne carte fixe de
  // Parametres (voir openTiersBancairesModal plus bas) - gere par sa propre
  // section ACCESS ('tiersBancaires'), independante de 'releves' : dans la
  // pratique identique ici puisque seuls admin/comptable peuvent de toute
  // facon ouvrir cet ecran, mais plus correct si les droits venaient a
  // diverger plus tard.
  var canEditTiers = canWrite('tiersBancaires');
  if(canEdit || canEditTiers){
    actions.innerHTML =
      (canEditTiers? '<button type="button" class="btn" id="btn-gerer-tiers">'+ic('building',15)+' Gérer les tiers bancaires / fournisseurs</button>' : '')+
      (canEdit? '<input type="file" id="releve-file-input" accept="application/pdf" hidden>'+
        '<button type="button" class="btn btn-primary" id="btn-import-releve">'+ic('upload',15)+' Importer un relevé PDF</button>' : '');
    if(canEditTiers){
      byId('btn-gerer-tiers').addEventListener('click', function(){ openTiersBancairesModal(); });
    }
    if(canEdit){
      byId('btn-import-releve').addEventListener('click', function(){ byId('releve-file-input').click(); });
      byId('releve-file-input').addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if(file) importReleveFile(file, mount, actions);
      });
    }
  }

  if(releveEnCours){
    mount.innerHTML = renderReleveEnCoursHtml(releveEnCours, canEdit);
    wireReleveEnCours(mount, actions);
    return;
  }

  var list = STATE.releves.slice().sort(function(a,b){ return (b.createdAt||'')<(a.createdAt||'')?-1:1; });
  var body = '';
  if(!list.length){
    body += emptyState('upload', 'Aucun relevé bancaire importé pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-import-releve">'+ic('upload',15)+' Importer un relevé PDF</button>' : '');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Fichier</th><th>Importé le</th><th class="num">Lignes</th><th class="num">Inconnus</th><th class="r">Total Client (TVA)</th><th class="r">Total Fournisseur (TVA)</th><th></th></tr></thead><tbody>'+
      list.map(function(r){
        var nbInconnu = (r.lignes||[]).filter(function(l){ return l.inconnu; }).length;
        return '<tr>'+
          '<td>'+esc(r.nomFichier||'—')+'</td>'+
          '<td class="muted">'+fmtDateTime(r.createdAt)+'</td>'+
          '<td class="num">'+(r.lignes||[]).length+'</td>'+
          '<td class="num">'+(nbInconnu? '<span class="pill pill-warning">'+nbInconnu+'</span>' : '0')+'</td>'+
          '<td class="r num">'+fmtMoney(r.totalClient)+'</td>'+
          '<td class="r num">'+fmtMoney(r.totalFournisseur)+'</td>'+
          '<td><div class="row-actions">'+
            '<button type="button" class="iconbtn" data-reopen="'+r.id+'" title="Ouvrir">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-export="'+r.id+'" title="Exporter en Excel">'+ic('download',15)+'</button>'+
            (canEdit? '<button type="button" class="iconbtn" data-delete="'+r.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var eb = byId('empty-import-releve'); if(eb) eb.addEventListener('click', function(){ byId('releve-file-input').click(); });
  mount.querySelectorAll('[data-reopen]').forEach(function(b){ b.addEventListener('click', function(){
    var r = STATE.releves.find(function(x){ return x.id===b.getAttribute('data-reopen'); });
    if(!r) return;
    releveEnCours = {id:r.id, nomFichier:r.nomFichier, lignes:JSON.parse(JSON.stringify(r.lignes||[])), totalClient:r.totalClient, totalFournisseur:r.totalFournisseur};
    renderReleves(mount, actions);
  }); });
  mount.querySelectorAll('[data-export]').forEach(function(b){ b.addEventListener('click', function(){
    var r = STATE.releves.find(function(x){ return x.id===b.getAttribute('data-export'); });
    if(r) exportReleveXlsx(r.nomFichier, r.lignes);
  }); });
  mount.querySelectorAll('[data-delete]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete');
    confirmDialog('Supprimer cet import de relevé ? Cette action est définitive.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteReleve(id).then(function(){ toast('Relevé supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
}

function importReleveFile(file, mount, actions){
  toast('Analyse du relevé en cours…');
  var fd = new FormData();
  fd.append('file', file);
  fetch('/api/releve/parse', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    releveEnCours = {nomFichier: res.nomFichier, lignes: res.lignes, totalClient: res.totalClient, totalFournisseur: res.totalFournisseur};
    scheduleRender();
    toast(res.lignes.length+' ligne(s) extraite(s), dont '+res.nbInconnu+' à vérifier.', res.nbInconnu? 'warning' : 'success');
  }).catch(function(err){ console.error(err); toast('Erreur d’analyse du PDF : '+err.message, 'danger'); });
}

function recomputeReleveLigne(l){
  // Reproduit le calcul manuel observe dans les fichiers Excel existants :
  // montant de TVA = montant TTC / 6 (taux de 20%), affecte en colonne Client
  // si la ligne est au credit, Fournisseur si elle est au debit.
  var tvaApplicable = l.tva!==null && l.tva!==undefined && l.tva!=='' && l.tva!=='NA' && Number(l.tva)>0;
  l.client = undefined; l.fournisseur = undefined;
  if(tvaApplicable){
    var montant = (l.credit!==null && l.credit!==undefined) ? l.credit : l.debit;
    var vat = Math.round(((Number(montant)||0)/6)*100)/100;
    if(l.credit!==null && l.credit!==undefined) l.client = vat; else l.fournisseur = vat;
  }
}

function recomputeReleveTotals(enCours){
  enCours.totalClient = n2(enCours.lignes.reduce(function(s,l){ return s+(Number(l.client)||0); }, 0));
  enCours.totalFournisseur = n2(enCours.lignes.reduce(function(s,l){ return s+(Number(l.fournisseur)||0); }, 0));
}

function renderReleveEnCoursHtml(enCours, canEdit){
  var sortedTiers = STATE.tiersBancaires.slice().sort(function(a,b){return (a.tiers||'').localeCompare(b.tiers||'');});
  function tiersOptionsFor(l){
    var selectedId = findTiersIdByName(l.tiers);
    var html = '<option value=""'+(selectedId?'':' selected')+'>INCONNU</option>';
    html += sortedTiers.map(function(t){
      return '<option value="'+esc(t.id)+'"'+(t.id===selectedId?' selected':'')+'>'+esc(t.tiers)+'</option>';
    }).join('');
    return html;
  }

  var rows = enCours.lignes.map(function(l, idx){
    var warn = l.inconnu;
    return '<tr'+(warn?' class="row-warn"':'')+'>'+
      '<td class="muted" style="white-space:nowrap;">'+esc(l.dateOp)+'</td>'+
      '<td class="muted" style="white-space:nowrap;">'+esc(l.dateVal)+'</td>'+
      '<td style="max-width:260px;">'+esc(l.libelle1)+(l.libelle2? '<br><span class="muted" style="font-size:11.5px;">'+esc(l.libelle2)+'</span>' : '')+'</td>'+
      '<td class="r num">'+(l.debit!=null? fmtMoney2(l.debit) : '')+'</td>'+
      '<td class="r num">'+(l.credit!=null? fmtMoney2(l.credit) : '')+'</td>'+
      '<td>'+(canEdit?
        '<select class="rl-tiers" data-idx="'+idx+'" style="min-width:150px;">'+tiersOptionsFor(l)+'</select>'+
        (warn? '<input class="rl-tiers-new" data-idx="'+idx+'" placeholder="ou nouveau nom…" style="margin-top:4px;min-width:150px;">' : '')
        : (warn? '<span class="pill pill-warning">INCONNU</span>' : esc(l.tiers)))+
      '</td>'+
      '<td>'+(canEdit? '<input class="rl-type" data-idx="'+idx+'" value="'+esc(l.type||'')+'" style="min-width:120px;">' : esc(l.type||'—'))+'</td>'+
      '<td style="text-align:center;">'+(canEdit? '<input type="checkbox" class="rl-tva" data-idx="'+idx+'" style="width:auto;" '+(Number(l.tva)>0?'checked':'')+'>' : (Number(l.tva)>0?'20%':'—'))+'</td>'+
      '<td class="r num">'+(l.client!=null? fmtMoney2(l.client) : '—')+'</td>'+
      '<td class="r num">'+(l.fournisseur!=null? fmtMoney2(l.fournisseur) : '—')+'</td>'+
      '<td style="text-align:center;">'+factureCellHtml(l, idx, canEdit)+'</td>'+
    '</tr>';
  }).join('');

  var nbInconnu = enCours.lignes.filter(function(l){ return l.inconnu; }).length;

  return '<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
      '<div><b>'+esc(enCours.nomFichier)+'</b><div class="muted" style="font-size:12.5px;margin-top:2px;">'+enCours.lignes.length+' ligne(s)'+(nbInconnu? ', dont <span style="color:var(--warning);">'+nbInconnu+' à identifier</span>' : '')+'</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="rl-cancel">Annuler</button>'+
        '<button type="button" class="btn" id="rl-export">'+ic('download',14)+' Exporter en Excel</button>'+
        (canEdit? '<button type="button" class="btn btn-primary" id="rl-save">'+ic('check',14)+' Enregistrer le relevé</button>' : '')+
      '</div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr>'+
      '<th>Date opé.</th><th>Date val.</th><th>Libellé</th><th class="r">Débit</th><th class="r">Crédit</th>'+
      '<th>Tiers</th><th>Type</th><th>TVA 20%</th><th class="r">Client</th><th class="r">Fournisseur</th><th>Facture OK</th>'+
    '</tr></thead><tbody>'+rows+'</tbody><tfoot><tr>'+
      '<td colspan="8" class="r"><b>Totaux</b></td>'+
      '<td class="r num"><b>'+fmtMoney2(enCours.totalClient)+'</b></td>'+
      '<td class="r num"><b>'+fmtMoney2(enCours.totalFournisseur)+'</b></td>'+
      '<td></td>'+
    '</tr></tfoot></table></div>'+
    '<p class="hint" style="margin-top:10px;">Les lignes « INCONNU » peuvent être associées à un tiers existant ou à un nouveau nom : cochez « mémoriser » pour l’ajouter à la liste des mots-clés (Paramètres) et le reconnaître automatiquement sur les prochains relevés.</p>';
}

// Pour une ligne de debit "Fournisseur" (TVA calculee), propose le
// rapprochement avec le registre Factures fournisseurs plutot qu'une simple
// case a cocher ; les autres lignes (Client ou sans TVA) gardent la case
// manuelle d'origine.
function factureCellHtml(l, idx, canEdit){
  // Lignes debit (Fournisseur, TVA detectee) : association a une facture
  // fournisseur (historique). Lignes credit (Client, TVA detectee) :
  // association symetrique a une facture client (V1.33) - dans les deux
  // cas, optionnelle (une ligne "sans facture" s'enregistre normalement).
  var cote = l.fournisseur!=null ? 'fournisseur' : (l.client!=null ? 'client' : null);
  if(!cote){
    return canEdit
      ? '<input type="checkbox" class="rl-facture" data-idx="'+idx+'" style="width:auto;" '+(l.facture==='OK'?'checked':'')+'>'
      : (l.facture==='OK'? ic('check',14) : '—');
  }
  var linkField = cote==='fournisseur' ? 'factureFournisseurId' : 'factureClientId';
  if(l[linkField]){
    var f = cote==='fournisseur'
      ? STATE.facturesFournisseurs.find(function(x){ return x.id===l[linkField]; })
      : STATE.fac.find(function(x){ return x.id===l[linkField]; });
    var label = (f&&f.numero) || l.facture || 'liée';
    return '<span class="pill pill-success">'+ic('check',11)+' '+esc(label)+'</span>'+
      (canEdit? ' <button type="button" class="iconbtn" data-unlink-facture="'+idx+'" data-cote="'+cote+'" title="Dissocier">'+ic('x',12)+'</button>' : '');
  }
  if(!canEdit) return l.facture==='OK'? ic('check',14) : '—';
  return '<button type="button" class="btn btn-sm" data-link-facture="'+idx+'" data-cote="'+cote+'">Associer…</button>'+
    '<label style="display:flex;align-items:center;gap:4px;justify-content:center;margin-top:4px;font-size:11px;" class="muted">'+
      '<input type="checkbox" class="rl-facture" data-idx="'+idx+'" style="width:auto;" '+(l.facture==='OK'?'checked':'')+'> sans facture'+
    '</label>';
}

function findTiersIdByName(name){
  var t = STATE.tiersBancaires.find(function(x){ return x.tiers===name; });
  return t ? t.id : '';
}

function wireReleveEnCours(mount, actions){
  var enCours = releveEnCours;

  mount.querySelectorAll('.rl-tiers').forEach(function(sel){
    sel.addEventListener('change', function(){
      var idx = Number(sel.getAttribute('data-idx'));
      var l = enCours.lignes[idx];
      var t = STATE.tiersBancaires.find(function(x){ return x.id===sel.value; });
      if(t){ l.tiers = t.tiers; l.type = t.type; l.tva = t.tva; l.inconnu = false; }
      else { l.tiers = 'INCONNU'; l.inconnu = true; }
      recomputeReleveLigne(l); recomputeReleveTotals(enCours);
      renderReleves(mount, actions);
    });
  });
  mount.querySelectorAll('.rl-tiers-new').forEach(function(inp){
    inp.addEventListener('change', function(){
      var idx = Number(inp.getAttribute('data-idx'));
      var l = enCours.lignes[idx];
      var val = inp.value.trim();
      if(!val) return;
      l.tiers = val; l.inconnu = false; l._nouveauTiers = val;
      recomputeReleveLigne(l); recomputeReleveTotals(enCours);
      renderReleves(mount, actions);
    });
  });
  mount.querySelectorAll('.rl-type').forEach(function(inp){
    inp.addEventListener('change', function(){
      enCours.lignes[Number(inp.getAttribute('data-idx'))].type = inp.value.trim();
    });
  });
  mount.querySelectorAll('.rl-tva').forEach(function(chk){
    chk.addEventListener('change', function(){
      var l = enCours.lignes[Number(chk.getAttribute('data-idx'))];
      l.tva = chk.checked ? 0.2 : null;
      recomputeReleveLigne(l); recomputeReleveTotals(enCours);
      renderReleves(mount, actions);
    });
  });
  mount.querySelectorAll('.rl-facture').forEach(function(chk){
    chk.addEventListener('change', function(){
      enCours.lignes[Number(chk.getAttribute('data-idx'))].facture = chk.checked ? 'OK' : '';
    });
  });
  mount.querySelectorAll('[data-link-facture]').forEach(function(b){
    b.addEventListener('click', function(){
      var idx = Number(b.getAttribute('data-link-facture'));
      var cote = b.getAttribute('data-cote');
      if(cote==='client'){
        openAssocierFactureClientModal(enCours.lignes[idx], function(f){
          enCours.lignes[idx].factureClientId = f.id;
          enCours.lignes[idx].facture = f.numero || 'OK';
          scheduleRender();
          toast('Facture associée', 'success');
        });
      } else {
        openAssocierFactureModal(enCours.lignes[idx], function(f){
          enCours.lignes[idx].factureFournisseurId = f.id;
          enCours.lignes[idx].facture = f.numero || 'OK';
          scheduleRender();
          toast('Facture associée', 'success');
        });
      }
    });
  });
  mount.querySelectorAll('[data-unlink-facture]').forEach(function(b){
    b.addEventListener('click', function(){
      var idx = Number(b.getAttribute('data-unlink-facture'));
      var cote = b.getAttribute('data-cote');
      if(cote==='client') enCours.lignes[idx].factureClientId = null;
      else enCours.lignes[idx].factureFournisseurId = null;
      enCours.lignes[idx].facture = '';
      renderReleves(mount, actions);
    });
  });

  byId('rl-cancel').addEventListener('click', function(){
    confirmDialog('Abandonner cet import ? Les corrections en cours seront perdues.', {danger:true, okLabel:'Abandonner'}).then(function(ok){
      if(!ok) return;
      releveEnCours = null; scheduleRender();
    });
  });
  byId('rl-export').addEventListener('click', function(){ exportReleveXlsx(enCours.nomFichier, enCours.lignes); });
  var saveBtn = byId('rl-save');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    // Memorise dans Parametres > Tiers bancaires chaque nouveau nom saisi sur
    // une ligne qui etait INCONNU, pour le reconnaitre automatiquement la
    // prochaine fois (sans jamais ecraser un mot-cle deja memorise).
    var nouveaux = [];
    enCours.lignes.forEach(function(l){
      if(l._nouveauTiers && !STATE.tiersBancaires.some(function(t){ return t.tiers===l._nouveauTiers; })){
        nouveaux.push({motCle:l._nouveauTiers, tiers:l._nouveauTiers, type:l.type||'', tva: Number(l.tva)>0?0.2:null});
      }
    });
    Promise.all(nouveaux.map(function(t){ return saveTiersBancaire(t); })).then(function(){
      // V1.33 : transforme chaque ligne deja associee a une facture
      // (fournisseur ou client) en reglement/encaissement reel - une seule
      // fois (garde _reglementCree/_encaissementCree persistee sur la ligne
      // elle-meme, pour eviter tout doublon si le releve est rouvert puis
      // re-enregistre). L'association reste optionnelle (une ligne "sans
      // facture" s'enregistre normalement, sans generer de reglement).
      var actionsCompta = [];
      enCours.lignes.forEach(function(l){
        if(l.factureFournisseurId && !l._reglementCree && Number(l.debit)>0){
          var ff = STATE.facturesFournisseurs.find(function(x){ return x.id===l.factureFournisseurId; });
          if(ff){
            actionsCompta.push(ajouterReglementFactureFournisseur(ff, {
              date: l.dateOp || l.dateVal || todayISO(), montant: Number(l.debit),
              mode: 'virement', reference: 'Relevé '+enCours.nomFichier, releveId: enCours.id
            }).then(function(){ l._reglementCree = true; }));
          }
        }
        if(l.factureClientId && !l._encaissementCree && Number(l.credit)>0){
          var fc = STATE.fac.find(function(x){ return x.id===l.factureClientId; });
          if(fc){
            actionsCompta.push(saveReglement({
              factureId: fc.id, factureNumero: fc.numero, clientId: fc.clientId, clientNom: fc.clientNom,
              date: l.dateOp || l.dateVal || todayISO(), montant: Number(l.credit),
              mode: 'virement', reference: 'Relevé '+enCours.nomFichier, banque: '', notes: ''
            }).then(function(){ l._encaissementCree = true; }));
          }
        }
      });
      return Promise.all(actionsCompta);
    }).then(function(){
      var data = {nomFichier:enCours.nomFichier, lignes:enCours.lignes.map(function(l){ var c=Object.assign({},l); delete c._nouveauTiers; return c; }),
        totalClient:enCours.totalClient, totalFournisseur:enCours.totalFournisseur};
      return saveReleve(data, enCours.id);
    }).then(function(){
      toast('Relevé enregistré', 'success');
      releveEnCours = null;
      scheduleRender();
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

function exportReleveXlsx(nomFichier, lignes){
  toast('Génération du fichier Excel…');
  fetch('/api/releve/export', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({nomFichier: nomFichier, lignes: lignes})
  }).then(function(r){
    if(!r.ok) throw new Error('Erreur HTTP '+r.status);
    return r.blob();
  }).then(function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = (nomFichier||'releve').replace(/\.pdf$/i,'')+'.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }).catch(function(err){ console.error(err); toast('Erreur d’export : '+err.message, 'danger'); });
}

/* =========================================================
   FACTURES FOURNISSEURS (import en masse + reconnaissance assistee)
   =========================================================
   Chaque fournisseur a sa propre mise en page de facture (contrairement au
   releve bancaire, format unique) : il n'existe pas de regle d'extraction
   fiable a 100%. Le serveur (backend/facture_parser.py) ne fournit donc
   qu'une premiere estimation - texte natif ou OCR Tesseract pour les scans/
   photos - que l'utilisateur verifie et corrige ici avant tout
   enregistrement, exactement comme les lignes "INCONNU" des releves
   bancaires. Une fois enregistrees, ces factures servent aussi a
   automatiser le rapprochement "Facture" des lignes Fournisseur des
   relevés bancaires (voir findFactureFournisseurMatch ci-dessous).
   ========================================================= */
var factureFournisseurEnCours = null; // {batchId, nomFichier, lignes:[...]} - pas encore enregistre
var facturesFFilter = {q:''};

function fournisseurOptionsHtml(selectedId){
  // Ne liste que les fiches de type "Fournisseur" : le registre
  // 'tiersBancaires' est partage avec des mots-cles de rapprochement
  // bancaire qui n'en sont pas (Salarie, Impot, Projet, Compte courant...)
  // et n'ont rien a faire dans ce menu. Garde-fou : si la fiche deja
  // selectionnee ne correspond plus a ce filtre (cas rare), on l'ajoute
  // quand meme pour ne jamais perdre l'affichage d'une selection existante.
  var pool = STATE.tiersBancaires.filter(function(t){ return (t.type||'').trim().toLowerCase()==='fournisseur'; });
  if(selectedId && !pool.some(function(t){ return t.id===selectedId; })){
    var cur = STATE.tiersBancaires.find(function(t){ return t.id===selectedId; });
    if(cur) pool = pool.concat([cur]);
  }
  var sorted = pool.slice().sort(function(a,b){ return (a.tiers||'').localeCompare(b.tiers||''); });
  var html = '<option value=""'+(selectedId?'':' selected')+'>— Choisir un fournisseur —</option>';
  html += sorted.map(function(t){
    return '<option value="'+esc(t.id)+'"'+(t.id===selectedId?' selected':'')+'>'+esc(t.tiers)+'</option>';
  }).join('');
  html += '<option value="__new__">+ Nouveau fournisseur…</option>';
  return html;
}

// Input fichier cree UNE SEULE FOIS et attache a document.body (hors de
// l'arbre #app) plutot que recree a chaque rendu. Necessaire car render()
// remplace integralement #app a chaque synchronisation d'une collection
// (toutes les ~2s, pour une quinzaine de collections) : si le selecteur de
// fichiers natif du navigateur restait ouvert pendant qu'un tel rendu
// survient, l'ancien <input> etait detache du DOM et la selection de
// fichiers de l'utilisateur ne produisait plus aucun evenement "change"
// (echec silencieux, sans erreur JS ni requete reseau).
var ffFilesInputEl = null;
function getFfFilesInput(){
  if(ffFilesInputEl && document.body.contains(ffFilesInputEl)) return ffFilesInputEl;
  ffFilesInputEl = document.createElement('input');
  ffFilesInputEl.type = 'file';
  ffFilesInputEl.accept = '.pdf,.jpg,.jpeg,.png';
  ffFilesInputEl.multiple = true;
  ffFilesInputEl.hidden = true;
  ffFilesInputEl.id = 'ff-files-input';
  document.body.appendChild(ffFilesInputEl);
  ffFilesInputEl.addEventListener('change', function(e){
    // Important : e.target.files est une FileList "live" liee a l'input ;
    // la remettre a plat (slice) AVANT de reinitialiser e.target.value, car
    // vider l'input vide aussi, en place, la FileList deja capturee (sinon
    // files.length retombe silencieusement a 0 et rien ne se passe).
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if(files.length) importFacturesFiles(files, byId('view-content'), byId('topbar-actions'));
  });
  return ffFilesInputEl;
}

function renderFacturesFournisseurs(mount, actions){
  var canEdit = canWrite('facturesF');
  if(canEdit){
    // "Traitement" (dossier source "a traiter" cote serveur, Parametres) :
    // bouton distinct du bouton "Importer" ci-dessous (selecteur de
    // fichiers du navigateur, inchange) - lit directement les fichiers deja
    // presents dans ce dossier. Reste affiche meme sans dossier configure,
    // avec un message explicite au clic, pour que l'utilisateur decouvre
    // la fonctionnalite sans avoir deja visite les Parametres.
    var dossierTraitement = (STATE.company.facturesFournisseursSourceDir || '').trim();
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-import-ff">'+ic('upload',15)+' Importer des fichiers</button>'+
      '<button type="button" class="btn" id="btn-traiter-ff" title="'+(dossierTraitement? 'Analyser les fichiers déjà présents dans : '+esc(dossierTraitement) : 'Configurez d’abord ce dossier dans Paramètres')+'">'+ic('clipboard',15)+' Traitement</button>';
    byId('btn-import-ff').addEventListener('click', function(){ getFfFilesInput().click(); });
    byId('btn-traiter-ff').addEventListener('click', function(){
      if(!dossierTraitement){
        toast('Configurez d’abord le dossier des factures à traiter (Paramètres > Factures fournisseurs à traiter).', 'danger');
        return;
      }
      processFacturesSourceDir();
    });
  }

  if(factureFournisseurEnCours){
    mount.innerHTML = renderFactureFournisseurEnCoursHtml(factureFournisseurEnCours, canEdit);
    wireFactureFournisseurEnCours(mount, actions);
    return;
  }

  var list = STATE.facturesFournisseurs.filter(function(f){
    if(facturesFFilter.q){
      var q = facturesFFilter.q.toLowerCase();
      var nom = fournisseurNomById(f.fournisseurId);
      if((nom||'').toLowerCase().indexOf(q)<0 && (f.numero||'').toLowerCase().indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.date||b.createdAt||'')<(a.date||a.createdAt||'')?-1:1; });

  var body = '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="ff-search" placeholder="Fournisseur ou n° de facture…" value="'+esc(facturesFFilter.q)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' facture(s)</span>'+
    '</div></div>';

  var doublonsFactures = detecterDoublonsFactures();
  if(doublonsFactures.length){
    body += doublonsBannerHtml(
      doublonsFactures.length+' facture(s) en double détectée(s) (même fournisseur + même numéro, enregistrées avant l’activation de ce contrôle) :',
      doublonsFactures.map(function(g){
        return '<li>'+esc(fournisseurNomById(g[0].fournisseurId)||'—')+' — n° '+esc(g[0].numero||'—')+' ('+g.length+' fois)'+(canEdit? ' : vérifiez laquelle est la bonne et supprimez les autres.' : '.')+'</li>';
      }).join('')
    );
  }

  if(!STATE.facturesFournisseurs.length){
    body += emptyState('receipt', 'Aucune facture fournisseur importée pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-import-ff">'+ic('upload',15)+' Importer des fichiers</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucune facture ne correspond à ce filtre.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Fournisseur</th><th>N° facture</th><th>Date</th><th class="r">Montant TTC</th><th>Paiement</th><th></th></tr></thead><tbody>'+
      list.map(function(f){
        var fileUrl = factureFournisseurFileUrl(f);
        var e = factureFournisseurEtat(f);
        return '<tr>'+
          '<td>'+esc(fournisseurNomById(f.fournisseurId)||'—')+'</td>'+
          '<td class="num">'+esc(f.numero||'—')+'</td>'+
          '<td class="muted">'+fmtDate(f.date)+'</td>'+
          '<td class="r num">'+(f.montantTTC!=null? fmtMoney2(f.montantTTC)+' '+esc(f.devise||'MAD') : '—')+'</td>'+
          '<td><span class="pill pill-'+e.tone+'">'+esc(e.statut)+'</span>'+(e.reste!=null && e.reste>0.009 && e.paye>0.009? ' <span class="muted" style="font-size:11.5px;">(reste '+fmtMoney2(e.reste)+')</span>' : '')+'</td>'+
          '<td><div class="row-actions">'+
            (fileUrl? '<a class="iconbtn" href="'+fileUrl+'" target="_blank" title="Voir le fichier">'+ic('file',15)+'</a>' : '')+
            (canEdit? '<button type="button" class="iconbtn" data-regler-ff="'+f.id+'" title="Règlements">'+ic('coins',15)+'</button>' : '')+
            (canEdit? '<button type="button" class="iconbtn" data-edit-ff="'+f.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            '<button type="button" class="iconbtn" data-delete-ff="'+f.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var s1 = byId('ff-search'); if(s1) s1.addEventListener('input', debounce(function(){ facturesFFilter.q = s1.value; renderFacturesFournisseurs(mount, actions); }, 220));
  var eb = byId('empty-import-ff'); if(eb) eb.addEventListener('click', function(){ getFfFilesInput().click(); });
  mount.querySelectorAll('[data-edit-ff]').forEach(function(b){ b.addEventListener('click', function(){
    openFactureFournisseurEditModal(STATE.facturesFournisseurs.find(function(f){ return f.id===b.getAttribute('data-edit-ff'); }));
  }); });
  mount.querySelectorAll('[data-delete-ff]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete-ff');
    confirmDialog('Supprimer cette facture fournisseur ? Cette action est définitive.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteFactureFournisseur(id).then(function(){ toast('Facture supprimée', 'success'); }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
    });
  }); });
  mount.querySelectorAll('[data-regler-ff]').forEach(function(b){ b.addEventListener('click', function(){
    openReglerFactureFournisseurModal(STATE.facturesFournisseurs.find(function(f){ return f.id===b.getAttribute('data-regler-ff'); }));
  }); });
}

var REGLEMENT_FF_MODES = [
  {id:'virement', label:'Virement'},
  {id:'cheque', label:'Chèque'},
  {id:'espece', label:'Espèces'},
  {id:'effet', label:'Effet'},
  {id:'autre', label:'Autre'}
];
function openReglerFactureFournisseurModal(f){
  if(!f) return;
  function refresh(){
    var e = factureFournisseurEtat(f);
    var regs = (f.reglements || []).slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    var overlay = openModal({
      title: 'Règlements — Facture '+(f.numero||''),
      large: true,
      body:
        '<p class="hint" style="margin-top:0;">'+esc(fournisseurNomById(f.fournisseurId)||'')+' — Montant TTC : <b>'+(f.montantTTC!=null?fmtMoney(f.montantTTC):'—')+'</b>'+
        (e.reste!=null? ' — Déjà réglé : <b>'+fmtMoney2(e.paye)+'</b> — Reste dû : <b>'+fmtMoney2(e.reste)+'</b>' : '')+'</p>'+
        (regs.length?
          '<div class="table-wrap" style="margin-bottom:14px;"><table><thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="r">Montant</th><th></th></tr></thead><tbody>'+
          regs.map(function(r){
            var ml = (REGLEMENT_FF_MODES.find(function(m){return m.id===r.mode;})||{label:r.mode}).label;
            return '<tr><td class="muted">'+fmtDate(r.date)+'</td><td><span class="pill pill-neutral">'+esc(ml)+'</span></td><td class="muted">'+esc(r.reference||'—')+'</td>'+
              '<td class="r num">'+fmtMoney2(r.montant)+'</td>'+
              '<td><button type="button" class="iconbtn" data-del-reg-ff="'+r.id+'" title="Supprimer ce règlement">'+ic('trash',14)+'</button></td></tr>';
          }).join('')+'</tbody></table></div>'
          : '<p class="muted" style="font-size:13px;">Aucun règlement enregistré pour cette facture.</p>')+
        (e.reste==null || e.reste>0.009 ?
          '<fieldset><legend>Ajouter un règlement</legend>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="rg-date">Date</label><input type="date" id="rg-date" value="'+todayISO()+'"></div>'+
            '<div class="field"><label for="rg-montant">Montant</label><input type="number" step="any" id="rg-montant" value="'+(e.reste!=null?e.reste:'')+'"></div>'+
          '</div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="rg-mode">Mode</label><select id="rg-mode">'+REGLEMENT_FF_MODES.map(function(m){ return '<option value="'+m.id+'">'+esc(m.label)+'</option>'; }).join('')+'</select></div>'+
            '<div class="field"><label for="rg-ref">Référence</label><input id="rg-ref" placeholder="n° chèque / virement"></div>'+
          '</div></fieldset>' : '<p class="hint">Facture entièrement réglée.</p>'),
      foot: '<button type="button" class="btn" data-close-modal>Fermer</button>'+
        (e.reste==null || e.reste>0.009 ? '<button type="button" class="btn btn-primary" id="rg-save">Ajouter le règlement</button>' : '')
    });
    overlay.querySelectorAll('[data-del-reg-ff]').forEach(function(b){ b.addEventListener('click', function(){
      var regId = b.getAttribute('data-del-reg-ff');
      confirmDialog('Supprimer ce règlement ? Une contre-écriture sera générée (le règlement reste conservé dans l’historique comptable, jamais supprimé).', {danger:true, okLabel:'Supprimer'}).then(function(ok){
        if(!ok) return;
        supprimerReglementFactureFournisseur(f, regId).then(function(){
          f.reglements = (f.reglements||[]).filter(function(r){ return r.id!==regId; });
          toast('Règlement supprimé', 'success');
          refresh();
        }).catch(function(err){ console.error(err); toast('Erreur de suppression', 'danger'); });
      });
    }); });
    var saveBtn = overlay.querySelector('#rg-save');
    if(saveBtn) saveBtn.addEventListener('click', function(){
      var mt = Number(byId('rg-montant').value);
      if(!mt || mt<=0){ toast('Veuillez saisir un montant valide', 'danger'); return; }
      var data = {date: byId('rg-date').value || todayISO(), montant: mt, mode: byId('rg-mode').value, reference: byId('rg-ref').value.trim()};
      ajouterReglementFactureFournisseur(f, data).then(function(reglement){
        f.reglements = (f.reglements||[]).concat([reglement]);
        toast('Règlement enregistré', 'success');
        refresh();
      }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
    });
  }
  refresh();
}

function importFacturesFiles(fileList, mount, actions){
  toast('Analyse des factures en cours… (peut prendre un moment si des scans doivent être lus par OCR)');
  var fd = new FormData();
  Array.prototype.forEach.call(fileList, function(f){ fd.append('files', f); });
  fetch('/api/facture-fournisseur/import-files', {method:'POST', body:fd}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    factureFournisseurEnCours = {
      batchId: res.batchId, ocrDisponible: res.ocrDisponible,
      lignes: res.lignes.map(function(l){ return Object.assign({garder:true, fournisseurId:l.fournisseurIdGuess||null}, l); })
    };
    scheduleRender();
    var nbOcr = res.lignes.filter(function(l){ return l.ocrUtilise; }).length;
    toast(res.lignes.length+' fichier(s) analysé(s)'+(nbOcr? ', dont '+nbOcr+' par OCR' : '')+'. Vérifiez les champs avant d’enregistrer.', 'success');
    if(res.skipped){ toast(res.skipped+' fichier(s) ignoré(s) (format non pris en charge)', 'warning'); }
    if(!res.ocrDisponible && nbOcr===0 && res.lignes.some(function(l){return !l.ocrDisponible;})){
      toast('OCR (Tesseract) non détecté sur ce poste : les scans/photos devront être saisis à la main.', 'warning');
    }
  }).catch(function(err){ console.error(err); toast('Erreur d’analyse des fichiers : '+err.message, 'danger'); });
}

// Bouton "Traitement" : variante d'importFacturesFiles qui ne part pas d'un
// FormData/selecteur de fichiers du navigateur, mais demande au backend de
// lire directement les fichiers deja presents dans le dossier source "a
// traiter" configure (Parametres). Les lignes resultantes portent en plus
// sourceOriginalPath (recopie telle quelle par Object.assign ci-dessous),
// utilise par le bouton "Enregistrer" de l'ecran de relecture pour decider
// quels fichiers source supprimer une fois valides (voir
// wireFactureFournisseurEnCours).
function processFacturesSourceDir(){
  toast('Analyse des fichiers du dossier en cours… (peut prendre un moment si des scans doivent être lus par OCR)');
  fetch('/api/facture-fournisseur/process-source-dir', {method:'POST'}).then(function(r){
    return r.text().then(function(text){
      var json = null; try{ json = text? JSON.parse(text) : null; }catch(e){}
      if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
      return json;
    });
  }).then(function(res){
    factureFournisseurEnCours = {
      batchId: res.batchId, ocrDisponible: res.ocrDisponible,
      lignes: res.lignes.map(function(l){ return Object.assign({garder:true, fournisseurId:l.fournisseurIdGuess||null}, l); })
    };
    scheduleRender();
    var nbOcr = res.lignes.filter(function(l){ return l.ocrUtilise; }).length;
    toast(res.lignes.length+' fichier(s) analysé(s) depuis le dossier'+(nbOcr? ', dont '+nbOcr+' par OCR' : '')+'. Vérifiez les champs avant d’enregistrer.', 'success');
    if(res.skipped){ toast(res.skipped+' fichier(s) ignoré(s) (format non pris en charge)', 'warning'); }
    if(!res.ocrDisponible && nbOcr===0 && res.lignes.some(function(l){return !l.ocrDisponible;})){
      toast('OCR (Tesseract) non détecté sur ce poste : les scans/photos devront être saisis à la main.', 'warning');
    }
  }).catch(function(err){ console.error(err); toast('Erreur de traitement du dossier : '+err.message, 'danger'); });
}

function renderFactureFournisseurEnCoursHtml(enCours, canEdit){
  var rows = enCours.lignes.map(function(l, idx){
    var fileUrl = '/api/facture-fournisseur/file/'+l.fileRelPath.split('/').map(encodeURIComponent).join('/');
    return '<tr'+(l.garder===false?' style="opacity:.45;"':'')+'>'+
      '<td style="text-align:center;"><input type="checkbox" class="ff-garder" data-idx="'+idx+'" style="width:auto;" '+(l.garder!==false?'checked':'')+'></td>'+
      '<td><a href="'+fileUrl+'" target="_blank" title="Voir le fichier">'+ic('file',14)+'</a> <span class="muted" style="font-size:11.5px;">'+esc(l.fileName)+'</span>'+
        (l.ocrUtilise? ' <span class="pill pill-neutral" style="font-size:10px;">OCR</span>' : '')+
        (!l.ocrDisponible && !l.apercu ? ' <span class="pill pill-warning" style="font-size:10px;">OCR indisponible</span>' : '')+
      '</td>'+
      '<td><select class="ff-fournisseur" data-idx="'+idx+'" style="min-width:150px;">'+fournisseurOptionsHtml(l.fournisseurId)+'</select>'+
        (!l.fournisseurId? '<button type="button" class="linklike ff-add-fournisseur" data-idx="'+idx+'" style="display:block;margin-top:4px;font-size:11.5px;text-align:left;">'+ic('plus',11)+' Ajouter'+(l.fournisseurNomGuess? ' « '+esc(l.fournisseurNomGuess)+' »' : ' ce fournisseur')+'</button>' : '')+
        (l.fournisseurId && /\.pdf$/i.test(l.fileName||'')? '<button type="button" class="linklike ff-zones" data-idx="'+idx+'" style="display:block;margin-top:4px;font-size:11.5px;text-align:left;">'+ic('ruler',11)+' '+(fournisseurHasZonesModel(l.fournisseurId)?'Modifier le modèle de zones':'Définir un modèle de zones')+'</button>' : '')+
        (l.modeleApplique? ' <span class="pill pill-success" style="font-size:10px;display:inline-block;margin-top:4px;" title="Les champs de cette ligne ont été affinés à l’aide du modèle de zones enregistré pour ce fournisseur">Modèle appliqué</span>' : '')+
        (l.referenceFournisseurAppliquee? ' <span class="pill pill-success" style="font-size:10px;display:inline-block;margin-top:4px;" title="Fournisseur reconnu par ICE exact : nom et ICE repris de la fiche déjà enregistrée plutôt que de la lecture OCR">Fournisseur reconnu (ICE)</span>' : '')+
      '</td>'+
      '<td><input class="ff-numero" data-idx="'+idx+'" value="'+esc(l.numero||'')+'" style="min-width:120px;"></td>'+
      '<td><input type="date" class="ff-date" data-idx="'+idx+'" value="'+esc(l.date||'')+'" style="min-width:130px;"></td>'+
      '<td><input type="number" step="any" class="ff-ht" data-idx="'+idx+'" value="'+(l.montantHT!=null?l.montantHT:'')+'" style="width:95px;"></td>'+
      '<td><input type="number" step="any" class="ff-tva" data-idx="'+idx+'" value="'+(l.montantTVA!=null?l.montantTVA:'')+'" style="width:85px;"></td>'+
      '<td><input type="number" step="any" class="ff-ttc" data-idx="'+idx+'" value="'+(l.montantTTC!=null?l.montantTTC:'')+'" style="width:95px;"></td>'+
      '<td><input class="ff-devise" data-idx="'+idx+'" value="'+esc(l.devise||'MAD')+'" style="width:60px;"></td>'+
    '</tr>';
  }).join('');

  return '<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
      '<div><b>Factures importées</b><div class="muted" style="font-size:12.5px;margin-top:2px;">'+enCours.lignes.length+' fichier(s) détecté(s) — décochez ceux qui ne sont pas des factures.</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button type="button" class="btn" id="ff-cancel">Annuler l’import</button>'+
        (canEdit? '<button type="button" class="btn btn-primary" id="ff-save-all">'+ic('check',14)+' Enregistrer les factures cochées</button>' : '')+
      '</div>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr>'+
      '<th></th><th>Fichier</th><th>Fournisseur</th><th>N° facture</th><th>Date</th><th>HT</th><th>TVA</th><th>TTC</th><th>Devise</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p class="hint" style="margin-top:10px;">Reconnaissance automatique à vérifier ligne par ligne — chaque fournisseur a sa propre mise en page de facture, l’extraction est une aide à la saisie, pas une garantie. Fournisseur et date sont nécessaires pour classer et renommer le fichier d’origine à l’enregistrement. Une fois enregistrées, ces factures pourront être associées aux lignes « Fournisseur » des relevés bancaires.</p>';
}

function wireFactureFournisseurEnCours(mount, actions){
  var enCours = factureFournisseurEnCours;
  function bindField(selector, prop, isNumber){
    mount.querySelectorAll(selector).forEach(function(inp){
      inp.addEventListener('change', function(){
        var idx = Number(inp.getAttribute('data-idx'));
        enCours.lignes[idx][prop] = isNumber ? (inp.value===''?null:Number(inp.value)) : inp.value;
      });
    });
  }
  mount.querySelectorAll('.ff-garder').forEach(function(chk){
    chk.addEventListener('change', function(){
      enCours.lignes[Number(chk.getAttribute('data-idx'))].garder = chk.checked;
      renderFacturesFournisseurs(mount, actions);
    });
  });
  function openNewFournisseurFor(idx){
    openTiersFormModal(null, {
      forceType:'Fournisseur',
      presetNom: enCours.lignes[idx].fournisseurNomGuess||'',
      presetIce: enCours.lignes[idx].fournisseurIceGuess||'',
      // Permet d'enchainer directement sur l'editeur de modele de zones
      // depuis cette meme fenetre de creation du fournisseur (voir
      // openTiersFormModal) : on a deja sous la main la facture qui vient
      // d'etre importee, pas besoin de fermer cette fenetre et d'attendre
      // que le lien "Definir un modele de zones" apparaisse sur la ligne.
      zonesLigne: enCours.lignes[idx],
      onSaved: function(saved){
        enCours.lignes[idx].fournisseurId = saved.id;
        scheduleRender();
      }
    });
  }
  mount.querySelectorAll('.ff-fournisseur').forEach(function(sel){
    sel.addEventListener('change', function(){
      var idx = Number(sel.getAttribute('data-idx'));
      if(sel.value==='__new__'){
        openNewFournisseurFor(idx);
        sel.value = enCours.lignes[idx].fournisseurId||'';
        return;
      }
      enCours.lignes[idx].fournisseurId = sel.value||null;
      // Redessine immediatement (plutot que d'attendre un rafraichissement
      // du a un autre polling) : le bouton "+ Ajouter ce fournisseur" doit
      // disparaitre et le bouton "modele de zones" apparaitre des que le
      // fournisseur est choisi, sans attente perceptible.
      scheduleRender();
    });
  });
  // Bouton visible "+ Ajouter ce fournisseur" affiche sous le menu quand
  // aucune fiche ne correspond encore (en plus de l'option "+ Nouveau
  // fournisseur..." du menu, moins visible) - demande explicite de
  // l'utilisateur : proposer d'ajouter le fournisseur manquant juste apres
  // l'import, avec les informations deja relevees sur la facture (nom
  // devine, ICE si detecte) pre-remplies dans le formulaire.
  mount.querySelectorAll('.ff-add-fournisseur').forEach(function(btn){
    btn.addEventListener('click', function(){
      openNewFournisseurFor(Number(btn.getAttribute('data-idx')));
    });
  });
  // "Modele de zones" : permet de dessiner, sur la facture qui vient
  // d'etre importee, les zones ou se trouvent numero/date/montants/ICE
  // pour ce fournisseur, afin que les prochaines factures du meme
  // fournisseur soient lues directement a ces emplacements plutot que
  // par la devinette generique par mots-cles (voir openZonesEditorModal).
  mount.querySelectorAll('.ff-zones').forEach(function(btn){
    btn.addEventListener('click', function(){
      openZonesEditorModal(enCours.lignes[Number(btn.getAttribute('data-idx'))]);
    });
  });
  bindField('.ff-numero', 'numero', false);
  bindField('.ff-date', 'date', false);
  bindField('.ff-ht', 'montantHT', true);
  bindField('.ff-tva', 'montantTVA', true);
  bindField('.ff-ttc', 'montantTTC', true);
  bindField('.ff-devise', 'devise', false);

  byId('ff-cancel').addEventListener('click', function(){
    confirmDialog('Abandonner cet import ? Les fichiers importés seront supprimés.', {danger:true, okLabel:'Abandonner'}).then(function(ok){
      if(!ok) return;
      fetch('/api/facture-fournisseur/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})})
        .catch(function(e){ console.error(e); });
      factureFournisseurEnCours = null;
      scheduleRender();
    });
  });
  var saveBtn = byId('ff-save-all');
  if(saveBtn) saveBtn.addEventListener('click', function(){
    var aGarder = enCours.lignes.filter(function(l){ return l.garder!==false; });
    if(!aGarder.length){ toast('Aucune facture cochée à enregistrer', 'danger'); return; }
    var incomplete = aGarder.filter(function(l){ return !l.fournisseurId || !l.date; });
    if(incomplete.length){
      toast('Fournisseur et date sont obligatoires pour chaque facture cochée ('+incomplete.length+' ligne(s) à compléter)', 'danger');
      return;
    }
    // RG : une facture doit etre unique (meme fournisseur + meme numero).
    // Ecarte du lot (a) les lignes qui font double emploi avec une facture
    // DEJA enregistree, et (b) les lignes qui font double emploi ENTRE ELLES
    // dans ce meme lot (ex. un fichier multi-factures mal decoupe qui
    // extrairait deux fois la meme facture) - seules les lignes en doublon
    // sont bloquees, les autres s'enregistrent normalement.
    var vuDansLot = {};
    var bloquees = [];
    var aEnregistrer = [];
    aGarder.forEach(function(l){
      var cle = l.fournisseurId+'|'+normNumeroFacture(l.numero);
      var dejaExistante = findFactureFournisseurDoublon(l.fournisseurId, l.numero, null);
      if(dejaExistante || vuDansLot[cle]){
        bloquees.push(l);
      } else {
        vuDansLot[cle] = true;
        aEnregistrer.push(l);
      }
    });
    if(bloquees.length){
      var nomsBloquees = bloquees.map(function(l){ return (l.fileName||'')+' (n° '+(l.numero||'—')+')'; }).join(', ');
      toast(bloquees.length+' facture(s) non enregistrée(s) car déjà existante(s) pour ce fournisseur avec ce même numéro : '+nomsBloquees+'. Décochez-la(les) ou corrigez le numéro, puis réessayez.', 'danger');
    }
    if(!aEnregistrer.length){ saveBtn.disabled = false; return; }

    saveBtn.disabled = true;
    Promise.all(aEnregistrer.map(function(l){
      var nom = fournisseurNomById(l.fournisseurId);
      return finalizeFactureFournisseurFile(l.fileRelPath, nom, l.date, l.numero).then(function(res){
        return saveFactureFournisseur({
          fournisseurId: l.fournisseurId, numero: (l.numero||'').trim(), date: l.date,
          montantHT: l.montantHT, montantTVA: l.montantTVA, montantTTC: l.montantTTC, devise: l.devise||'MAD',
          fileRelPath: res.fileRelPath, fileName: l.fileName, ocrUtilise: !!l.ocrUtilise
        }).then(function(){ l._savedOk = true; });
      });
    })).then(function(){
      // Nettoie les eventuels fichiers du lot non coches (restes en attente).
      return fetch('/api/facture-fournisseur/cancel-batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({batchId:enCours.batchId})}).catch(function(){});
    }).then(function(){
      // Lot provenant du dossier source "a traiter" (bouton Traitement,
      // voir processFacturesSourceDir) : supprime, dans ce dossier source,
      // chaque fichier d'origine dont TOUTES les lignes issues de lui ont
      // ete cochees "garder" (et donc enregistrees ci-dessus avec succes).
      // Une ligne decochee, OU bloquee comme doublon ci-dessus, evite au
      // contraire la suppression de ce fichier, pour ne jamais perdre une
      // facture non reellement enregistree (on se base sur `_savedOk`, pose
      // uniquement sur les lignes qui ont ete effectivement sauvegardees
      // avec succes ci-dessus, et non sur la simple case "garder" cochee).
      var parOrigine = {};
      enCours.lignes.forEach(function(l){
        if(!l.sourceOriginalPath) return;
        (parOrigine[l.sourceOriginalPath] = parOrigine[l.sourceOriginalPath] || []).push(l);
      });
      var aSupprimer = Object.keys(parOrigine).filter(function(chemin){
        return parOrigine[chemin].every(function(l){ return l._savedOk === true; });
      });
      if(!aSupprimer.length) return;
      return fetch('/api/facture-fournisseur/delete-source-files', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:aSupprimer})
      }).catch(function(){});
    }).then(function(){
      toast(aEnregistrer.length+' facture(s) enregistrée(s)'+(bloquees.length? ' — '+bloquees.length+' ignorée(s) pour doublon':''), bloquees.length ? 'warning' : 'success');
      factureFournisseurEnCours = null;
      scheduleRender();
    }).catch(function(err){
      console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); saveBtn.disabled = false;
    });
  });
}

// Libelles affiches pour chaque champ pouvant faire l'objet d'une zone de
// lecture (voir openZonesEditorModal) - partage avec l'affichage de la
// liste des zones deja definies.
var MODELE_ZONES_CHAMP_LABELS = {
  numero: 'N° facture', date: 'Date', montantHT: 'Montant HT', montantTVA: 'Montant TVA',
  montantTTC: 'Montant TTC', devise: 'Devise', ice: 'ICE'
};

// Permet de CONSULTER (et au besoin modifier) le modele de zones d'un
// fournisseur depuis la page "Fournisseurs", sans etre au milieu d'un
// import - reutilise openZonesEditorModal telle quelle (meme fenetre,
// memes zones deja dessinees pre-chargees, meme bouton d'enregistrement),
// simplement avec une facture DEJA ENREGISTREE de ce fournisseur comme
// apercu de reference a la place d'une ligne d'import en cours (la route
// GET /page-image sait rendre aussi bien un fichier en attente qu'un
// fichier deja classe). Prend la plus recente facture PDF enregistree pour
// ce fournisseur ; si aucune n'est disponible (modele defini puis facture
// jamais enregistree, ou supprimee depuis), previent l'utilisateur plutot
// que d'ouvrir une fenetre sans apercu.
function openZonesEditorForFournisseur(fournisseurId){
  var factures = STATE.facturesFournisseurs.filter(function(f){
    return f.fournisseurId===fournisseurId && f.fileRelPath && /\.pdf$/i.test(f.fileName||'');
  }).sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  if(!factures.length){
    toast('Un modèle de zones existe pour ce fournisseur, mais aucune facture PDF enregistrée n’est disponible pour en afficher l’aperçu. Importez et enregistrez une facture de ce fournisseur pour pouvoir le consulter visuellement.', 'warning');
    return;
  }
  openZonesEditorModal({fournisseurId: fournisseurId, fileName: factures[0].fileName, fileRelPath: factures[0].fileRelPath});
}

// Editeur de "modele de zones" par fournisseur : repond a la demande
// "ajouter un editeur graphique pour designer les zones sur un nouveau
// modele de facture ou on va trouver les informations, une sorte
// d'apprentissage". Affiche la facture qui vient d'etre importee (rendue
// en image cote serveur - voir GET /page-image, PDF a texte natif
// uniquement dans cette version) et laisse l'utilisateur dessiner au
// clic-glisse un rectangle par champ a retrouver. Les zones sont
// enregistrees sur la FICHE FOURNISSEUR (champ modeleZones), et appliquees
// automatiquement par le backend a toute future facture reconnue comme
// venant de ce meme fournisseur (avec repli sur la devinette generique
// pour tout champ que la zone ne donnerait pas - voir
// backend.facture_parser.apply_zone_template).
function openZonesEditorModal(ligne){
  if(!ligne || !ligne.fournisseurId){
    toast('Choisissez d’abord un fournisseur pour cette ligne', 'danger');
    return;
  }
  if(!/\.pdf$/i.test(ligne.fileName||'')){
    toast('Le modèle de zones n’est disponible que pour les factures PDF', 'danger');
    return;
  }
  var fournisseurId = ligne.fournisseurId;
  var modeleExistant = fournisseurZonesModel(fournisseurId);
  var zones = modeleExistant ? modeleExistant.zones.slice() : [];
  var champOptions = Object.keys(MODELE_ZONES_CHAMP_LABELS).map(function(k){
    return '<option value="'+k+'">'+esc(MODELE_ZONES_CHAMP_LABELS[k])+'</option>';
  }).join('');

  var overlay = openModal({
    title: 'Modèle de zones — ' + (fournisseurNomById(fournisseurId) || 'fournisseur'),
    large: true,
    body:
      '<p class="hint" style="margin-top:0;">Dessinez un rectangle sur la facture pour chaque champ à retrouver '+
      'automatiquement sur les prochaines factures de ce fournisseur. Une seule zone par champ (la nouvelle '+
      'remplace l’ancienne) ; une zone vide ou une facture qui ne correspond pas à cette mise en page retombera '+
      'sur la reconnaissance habituelle.</p>'+
      '<div class="field" style="max-width:260px;margin-bottom:10px;"><label for="mz-champ">Champ à dessiner</label>'+
        '<select id="mz-champ">'+champOptions+'</select>'+
      '</div>'+
      '<div id="mz-canvas-wrap" style="position:relative;border:1px solid #d7dbe0;display:inline-block;max-width:100%;line-height:0;">'+
        '<img id="mz-img" style="display:block;max-width:100%;visibility:hidden;">'+
        '<canvas id="mz-canvas" style="position:absolute;top:0;left:0;cursor:crosshair;"></canvas>'+
      '</div>'+
      '<p id="mz-loading" class="muted" style="font-size:12.5px;">Chargement de l’aperçu de la facture…</p>'+
      '<div id="mz-zones-list" style="margin-top:10px;"></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button>'+
          '<button type="button" class="btn btn-primary" id="mz-save">Enregistrer le modèle</button>'
  });

  var img = overlay.querySelector('#mz-img');
  var canvas = overlay.querySelector('#mz-canvas');
  var ctx = canvas.getContext('2d');
  var loadingEl = overlay.querySelector('#mz-loading');
  var closed = false;
  overlay.addEventListener('mousedown', function(e){ if(e.target===overlay) closed = true; });
  overlay.querySelectorAll('[data-close-modal]').forEach(function(b){ b.addEventListener('click', function(){ closed = true; }); });

  function renderZonesList(){
    var listEl = overlay.querySelector('#mz-zones-list');
    if(!zones.length){
      listEl.innerHTML = '<p class="muted" style="font-size:12.5px;">Aucune zone définie pour l’instant.</p>';
      return;
    }
    listEl.innerHTML = zones.map(function(z, i){
      return '<span class="pill pill-neutral" style="margin:2px 6px 2px 0;display:inline-flex;align-items:center;gap:6px;">'+
        esc(MODELE_ZONES_CHAMP_LABELS[z.champ]||z.champ)+
        '<button type="button" class="iconbtn" data-del-zone="'+i+'" title="Supprimer cette zone" style="width:16px;height:16px;">'+ic('x',11)+'</button>'+
      '</span>';
    }).join('');
    listEl.querySelectorAll('[data-del-zone]').forEach(function(b){
      b.addEventListener('click', function(){
        zones.splice(Number(b.getAttribute('data-del-zone')), 1);
        renderZonesList();
        drawZones();
      });
    });
  }

  function drawZones(){
    if(!canvas.width) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    zones.forEach(function(z){
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x0*canvas.width, z.y0*canvas.height, (z.x1-z.x0)*canvas.width, (z.y1-z.y0)*canvas.height);
    });
  }

  img.onload = function(){
    if(closed) return;
    // Taille d'affichage plafonnee (lisibilite + perf), le canvas suit
    // exactement les memes dimensions que l'image affichee : les
    // fractions x/largeur restent donc justes quelle que soit cette
    // taille de rendu, aussi bien au moment de dessiner qu'a la relecture
    // cote serveur (qui raisonne en fractions de la page PDF reelle).
    // Plafonnee aussi par la largeur reellement disponible dans le corps
    // de la modale : sans ca, une image plus large que la modale deborde
    // visuellement par-dessus le fond (qui ferme la modale au clic), et la
    // partie droite de la facture (ou se trouvent souvent le n° de facture
    // et les montants) devient impossible a zoner. On retranche une marge
    // pour la barre de defilement verticale qui apparait toujours ici (la
    // page rendue depasse presque toujours les 72vh de hauteur visible).
    var modalBodyEl = overlay.querySelector('.modal-body');
    var mbStyle = modalBodyEl ? window.getComputedStyle(modalBodyEl) : null;
    var mbPad = mbStyle ? (parseFloat(mbStyle.paddingLeft)||0) + (parseFloat(mbStyle.paddingRight)||0) : 0;
    var availableW = modalBodyEl ? (modalBodyEl.clientWidth - mbPad - 18) : 1100;
    var dispW = Math.min(img.naturalWidth, Math.max(240, availableW), 1100);
    var scale = dispW / img.naturalWidth;
    var dispH = Math.round(img.naturalHeight * scale);
    canvas.width = dispW; canvas.height = dispH;
    img.style.width = dispW+'px'; img.style.height = dispH+'px';
    img.style.visibility = 'visible';
    loadingEl.style.display = 'none';
    drawZones();
  };
  img.onerror = function(){
    if(closed) return;
    loadingEl.textContent = 'Impossible de charger l’aperçu de cette facture (PDF natif requis).';
  };
  img.src = '/api/facture-fournisseur/page-image?relPath='+encodeURIComponent(ligne.fileRelPath)+'&page=0';

  var drawing = null;
  function posFromEvent(e){
    var rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(canvas.height, e.clientY - rect.top))
    };
  }
  function finishDrawing(){
    if(!drawing) return;
    var x0 = Math.min(drawing.x0, drawing.x1), x1 = Math.max(drawing.x0, drawing.x1);
    var y0 = Math.min(drawing.y0, drawing.y1), y1 = Math.max(drawing.y0, drawing.y1);
    drawing = null;
    if(x1-x0 < 6 || y1-y0 < 6){ drawZones(); return; } // trop petit : clic accidentel, ignore
    var champ = overlay.querySelector('#mz-champ').value;
    zones = zones.filter(function(z){ return z.champ!==champ; }); // une seule zone par champ
    zones.push({champ:champ, x0:x0/canvas.width, y0:y0/canvas.height, x1:x1/canvas.width, y1:y1/canvas.height});
    renderZonesList();
    drawZones();
  }
  canvas.addEventListener('mousedown', function(e){
    var p = posFromEvent(e);
    drawing = {x0:p.x, y0:p.y, x1:p.x, y1:p.y};
  });
  canvas.addEventListener('mousemove', function(e){
    if(!drawing) return;
    var p = posFromEvent(e);
    drawing.x1 = p.x; drawing.y1 = p.y;
    drawZones();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.min(drawing.x0,drawing.x1), Math.min(drawing.y0,drawing.y1), Math.abs(drawing.x1-drawing.x0), Math.abs(drawing.y1-drawing.y0));
  });
  canvas.addEventListener('mouseup', finishDrawing);
  canvas.addEventListener('mouseleave', finishDrawing);

  renderZonesList();

  overlay.querySelector('#mz-save').addEventListener('click', function(){
    if(!zones.length){ toast('Dessinez au moins une zone avant d’enregistrer', 'danger'); return; }
    STATE.db.doc('tiersBancaires/'+fournisseurId).update({modeleZones:{zones:zones}}).then(function(){
      closed = true;
      closeModal();
      toast('Modèle de zones enregistré pour ce fournisseur', 'success');
    }).catch(function(err){
      console.error(err); toast('Erreur d’enregistrement du modèle', 'danger');
    });
  });
}

// Modification d'une facture fournisseur deja enregistree (depuis
// l'historique) : memes champs que l'ecran de relecture a l'import. Si
// fournisseur/date/numero changent, le fichier d'origine est re-deplace et
// renomme en consequence (POST /finalize-file) pour rester coherent avec le
// classement par annee/mois.
function openFactureFournisseurEditModal(f){
  if(!f) return;
  var fileUrl = factureFournisseurFileUrl(f);
  var overlay = openModal({
    title: 'Modifier la facture fournisseur',
    large: true,
    body:
      (fileUrl? '<p style="margin-bottom:12px;"><a href="'+fileUrl+'" target="_blank" class="btn btn-sm">'+ic('file',13)+' Voir le fichier ('+esc(f.fileName||'')+')</a></p>' : '')+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="fe-fournisseur">Fournisseur</label><select id="fe-fournisseur">'+fournisseurOptionsHtml(f.fournisseurId)+'</select></div>'+
        '<div class="field"><label for="fe-numero">N° facture</label><input id="fe-numero" value="'+esc(f.numero||'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="fe-date">Date</label><input type="date" id="fe-date" value="'+esc(f.date||'')+'"></div>'+
        '<div class="field"><label for="fe-devise">Devise</label><input id="fe-devise" value="'+esc(f.devise||'MAD')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-3">'+
        '<div class="field"><label for="fe-ht">Montant HT</label><input type="number" step="any" id="fe-ht" value="'+(f.montantHT!=null?f.montantHT:'')+'"></div>'+
        '<div class="field"><label for="fe-tva">Montant TVA</label><input type="number" step="any" id="fe-tva" value="'+(f.montantTVA!=null?f.montantTVA:'')+'"></div>'+
        '<div class="field"><label for="fe-ttc">Montant TTC</label><input type="number" step="any" id="fe-ttc" value="'+(f.montantTTC!=null?f.montantTTC:'')+'"></div>'+
      '</div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="fe-save">Enregistrer</button>'
  });
  overlay.querySelector('#fe-fournisseur').addEventListener('change', function(){
    var el = overlay.querySelector('#fe-fournisseur');
    if(el.value==='__new__'){
      openTiersFormModal(null, {
        forceType:'Fournisseur',
        onSaved: function(saved){
          el.innerHTML = fournisseurOptionsHtml(saved.id);
        }
      });
    }
  });
  overlay.querySelector('#fe-save').addEventListener('click', function(){
    var fournisseurId = overlay.querySelector('#fe-fournisseur').value;
    var date = byId('fe-date').value;
    if(!fournisseurId || fournisseurId==='__new__' || !date){
      toast('Fournisseur et date sont obligatoires', 'danger'); return;
    }
    var numero = byId('fe-numero').value.trim();
    // RG : une facture doit etre unique (meme fournisseur + meme numero) -
    // exclut la facture en cours de modification (f.id) de la comparaison.
    var doublon = findFactureFournisseurDoublon(fournisseurId, numero, f.id);
    if(doublon){
      toast('Une facture avec ce numéro existe déjà pour ce fournisseur (n° '+(doublon.numero||'')+').', 'danger');
      return;
    }
    var nom = fournisseurNomById(fournisseurId);
    finalizeFactureFournisseurFile(f.fileRelPath, nom, date, numero).then(function(res){
      return saveFactureFournisseur({
        fournisseurId: fournisseurId, numero: numero, date: date,
        montantHT: byId('fe-ht').value===''?null:Number(byId('fe-ht').value),
        montantTVA: byId('fe-tva').value===''?null:Number(byId('fe-tva').value),
        montantTTC: byId('fe-ttc').value===''?null:Number(byId('fe-ttc').value),
        devise: byId('fe-devise').value.trim()||'MAD',
        fileRelPath: res.fileRelPath
      }, f.id);
    }).then(function(){
      closeModal(); toast('Facture mise à jour', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement : '+err.message, 'danger'); });
  });
}

// Rapprochement avec les relevés bancaires : recherche la/les factures
// fournisseurs dont le nom et le montant TTC sont proches de la ligne de
// releve (debit "Fournisseur"), sans se fier aux dates (le releve ne porte
// que "JJ MM", sans annee, donc une comparaison de date fiable n'est pas
// possible ici). Retourne la liste triee, meilleure correspondance en tete.
function findFactureFournisseurMatch(ligneReleve){
  if(!ligneReleve || ligneReleve.fournisseur==null) return [];
  var montantRef = ligneReleve.debit!=null ? ligneReleve.debit : ligneReleve.credit;
  var nomTiers = (ligneReleve.tiers||'').toLowerCase();
  return STATE.facturesFournisseurs.map(function(f){
    var nomF = (fournisseurNomById(f.fournisseurId)||'').toLowerCase();
    var nomOk = nomTiers && nomF && (nomF.indexOf(nomTiers)>=0 || nomTiers.indexOf(nomF)>=0);
    var ecart = (f.montantTTC!=null && montantRef!=null) ? Math.abs(f.montantTTC - montantRef) : Infinity;
    var montantOk = ecart < 1;
    var score = (nomOk?2:0) + (montantOk?1:0);
    return {facture:f, score:score, ecart:ecart, nomOk:nomOk, montantOk:montantOk};
  }).filter(function(x){ return x.score>0; })
    .sort(function(a,b){ return b.score-a.score || a.ecart-b.ecart; })
    .map(function(x){ return x.facture; });
}

function openAssocierFactureModal(ligneReleve, onPicked){
  var matches = findFactureFournisseurMatch(ligneReleve);
  var pool = matches.length ? matches : STATE.facturesFournisseurs;
  var rows = pool.slice(0, 30).map(function(f){
    return '<tr>'+
      '<td>'+esc(fournisseurNomById(f.fournisseurId)||'—')+'</td>'+
      '<td class="num">'+esc(f.numero||'—')+'</td>'+
      '<td class="muted">'+fmtDate(f.date)+'</td>'+
      '<td class="r num">'+(f.montantTTC!=null?fmtMoney2(f.montantTTC):'—')+' '+esc(f.devise||'')+'</td>'+
      '<td><button type="button" class="btn btn-sm btn-primary" data-pick="'+f.id+'">Associer</button></td>'+
    '</tr>';
  }).join('');
  var overlay = openModal({
    title: 'Associer une facture fournisseur',
    large: true,
    body: (matches.length? '<p class="hint">Suggestions basées sur le fournisseur et le montant (date non comparable sur un relevé bancaire).</p>' : '<p class="hint">Aucune correspondance évidente — voici toutes les factures enregistrées.</p>')+
      '<div class="table-wrap"><table><thead><tr><th>Fournisseur</th><th>N°</th><th>Date</th><th class="r">TTC</th><th></th></tr></thead><tbody>'+
      (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:18px;">Aucune facture fournisseur enregistrée pour le moment.</td></tr>')+
      '</tbody></table></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button>'
  });
  overlay.querySelectorAll('[data-pick]').forEach(function(b){ b.addEventListener('click', function(){
    var f = STATE.facturesFournisseurs.find(function(x){ return x.id===b.getAttribute('data-pick'); });
    closeModal();
    if(f) onPicked(f);
  }); });
}

// Symetrique de openAssocierFactureModal, cote client (V1.33) : seules les
// factures avec un reste du sont proposees (pas d'interet a associer une
// ligne de releve a une facture deja entierement reglee).
function openAssocierFactureClientModal(ligneReleve, onPicked){
  var pool = STATE.fac.filter(function(f){ return f.statut!=='annulee' && factureEtat(f).reste>0.009; })
    .sort(function(a,b){ return (b.numero||'').localeCompare(a.numero||''); });
  var rows = pool.slice(0, 30).map(function(f){
    var e = factureEtat(f);
    return '<tr>'+
      '<td>'+esc(f.clientNom||'—')+'</td>'+
      '<td class="num">'+esc(f.numero||'—')+'</td>'+
      '<td class="muted">'+fmtDate(f.date)+'</td>'+
      '<td class="r num">'+fmtMoney2(e.reste)+'</td>'+
      '<td><button type="button" class="btn btn-sm btn-primary" data-pick="'+f.id+'">Associer</button></td>'+
    '</tr>';
  }).join('');
  var overlay = openModal({
    title: 'Associer une facture client',
    large: true,
    body: '<p class="hint">Factures clients avec un reste dû.</p>'+
      '<div class="table-wrap"><table><thead><tr><th>Client</th><th>N°</th><th>Date</th><th class="r">Reste dû</th><th></th></tr></thead><tbody>'+
      (rows || '<tr><td colspan="5" class="muted" style="text-align:center;padding:18px;">Aucune facture client avec un reste dû pour le moment.</td></tr>')+
      '</tbody></table></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button>'
  });
  overlay.querySelectorAll('[data-pick]').forEach(function(b){ b.addEventListener('click', function(){
    var f = STATE.fac.find(function(x){ return x.id===b.getAttribute('data-pick'); });
    closeModal();
    if(f) onPicked(f);
  }); });
}

/* =========================================================
   BACKLOG DE DEVELOPPEMENT (V1.64) : suivi, a l'interieur meme de
   l'application, des pistes d'evolution de l'application elle-meme -
   priorite, statut d'implementation et statut de test. Reserve a
   l'Administrateur (voir access(), NAV et backend/access.py).

   Origine : analyse du classeur Excel de suivi des livrables d'un
   contrat (feuilles "Etat", "Registre des blocages", "Pointage heures
   (AC)", "Gestion des versions", "Pilotage mensuel EVM", "Vue par
   discipline", "Liste des jalons", "Plan de charge Juillet"...), qui a
   fait ressortir des pistes de developpement pour l'application
   (document "pistes-developpement-futura.md"). Demande explicite de
   l'utilisateur ensuite : un suivi de ces pistes avec priorite et statut
   d'implementation/test, d'abord livre comme page autonome (Artifact),
   puis integre directement dans l'application elle-meme ("integrer ceci
   dans l'application elle meme").

   Collection generique "backlog" (meme mecanisme que les autres modules,
   voir backend/db.py) : titre/source/description/priorite/notes +
   statutImplementation/statutTest. Suppression physique autorisee (ce
   n'est pas un document du perimetre CDC) - meme semantique que
   Personnel/Clients.
   ========================================================= */
var BACKLOG_PRIORITES = [
  {id:'P1', label:'P1 — Gain rapide', tone:'primary'},
  {id:'P2', label:'P2 — Brique EVM', tone:'primary'},
  {id:'P3', label:'P3 — Pilotage', tone:'primary'},
  {id:'P4', label:'P4 — Optionnel, plus lourd', tone:'neutral'},
  {id:'P5', label:'P5 — Complément mineur', tone:'neutral'},
  {id:'X', label:'À confirmer', tone:'warning'}
];
var BACKLOG_IMPL_STATUTS = [
  {id:'a_faire', label:'À faire', tone:'neutral'},
  {id:'en_cours', label:'En cours', tone:'warning'},
  {id:'fait', label:'Fait', tone:'success'}
];
var BACKLOG_TEST_STATUTS = [
  {id:'a_faire', label:'À faire', tone:'neutral'},
  {id:'en_cours', label:'En cours', tone:'warning'},
  {id:'valide', label:'Validé', tone:'success'}
];
function backlogPrioriteLabel(id){ return statutMeta(BACKLOG_PRIORITES, id).label; }

// Les 12 pistes identifiees lors de l'analyse du classeur de suivi des
// livrables (juin 2026) - voir claude/pistes-developpement-futura.md.
// Importees une seule fois (bouton explicite, pas une migration
// silencieuse) : voir importerBacklogDefauts().
var BACKLOG_SEED = [
  {priorite:'P1', titre:'Répartition des livrables par statut', source:'Feuille « Etat »', description:'Nombre de livrables, somme des budgets horaires et % du budget total pour chaque statut du référentiel — un petit tableau ou graphique sur la fiche Contrat ou le Tableau de bord. N\'exige aucun nouveau calcul (réutilise livrableBudgetTotal()).'},
  {priorite:'P1', titre:'Jalons du contrat', source:'Feuille « Liste des jalons »', description:'Registre indépendant des livrables : libellé du jalon, date de réception prévue, date réelle, état (reçu / non reçu) — avec visibilité des jalons à venir ou en retard sur le tableau de bord du contrat.'},
  {priorite:'P2', titre:'Registre des blocages structuré', source:'Feuille « Registre des blocages »', description:'Champs indépendants du statut : bloqué O/N, cause du blocage, en attente de qui, date de mise en blocage (ancienneté calculée automatiquement), action de levée attendue. Écran dédié + indicateur « heures gelées » sur le tableau de bord.'},
  {priorite:'P2', titre:'Pointage des heures réelles (coût réel)', source:'Feuille « Pointage heures (AC) »', description:'Saisie mensuelle des heures réellement passées par livrable, cumulée en coût réel (AC) et comparée au budget planifié (BAC) — « reste vs budget ».'},
  {priorite:'P2', titre:'Dates de début/fin planifiées par révision', source:'Feuille « Gestion des versions »', description:'Planning de référence au niveau de chaque révision — la pièce manquante pour savoir ce qui devait être fait à ce jour (valeur planifiée), indépendamment du budget tenu ou non.'},
  {priorite:'P3', titre:'Pilotage par valeur acquise (PV / EV / AC / SV / CV / SPI / CPI / EAC)', source:'Feuille « Pilotage mensuel EVM »', description:'Tableau de bord de pilotage de projet complet, combinant les trois briques de priorité 2. L\'EV est presque déjà calculé par l\'avancement pondéré (V1.63) ; il ne manque que PV et AC.'},
  {priorite:'P3', titre:'Vue par discipline du pilotage', source:'Feuille « Vue par discipline »', description:'Les mêmes indicateurs EVM (BAC/PV/EV/AC/SPI/CPI), regroupés par discipline (CFO/CFA/Autre) — une vue groupée en plus, une fois la priorité 3 ci-dessus construite.'},
  {priorite:'P4', titre:'Ressources affectées et plan de charge', source:'Feuille « Plan de charge Juillet »', description:'Version légère : un champ « ressource(s) affectée(s) » sur le livrable. Version complète : une grille de planification jour par jour par ressource — module nettement plus lourd, à ne considérer que si le besoin se confirme.'},
  {priorite:'P5', titre:'Type de budget (Initial / Modifié)', source:'Feuille « Gestion des versions »', description:'Distinguer un budget d\'origine d\'un budget révisé en cours de route, sur chaque révision.'},
  {priorite:'P5', titre:'Référence de fiche de modification (FM)', source:'Feuille « Gestion des versions » / « Liste des FM »', description:'Champ de référence à une fiche de modification formelle sur la révision. Pas de registre séparé pour l\'instant : la feuille « Liste des FM » dédiée est trop peu remplie pour juger qu\'elle est vraiment utilisée.'},
  {priorite:'P5', titre:'Support d\'envoi sur le bordereau', source:'Feuille « Gestion des versions »', description:'Mail / Papier / USB-CD / Partage (ou combinaisons) sur chaque ligne du Carnet d\'envois — la place existe déjà dans la structure de ligne, le champ n\'y est pas encore.'},
  {priorite:'X', titre:'Bon pour tirage et registres associés', source:'Feuilles « Bon pour tirage », « Liste des Bons pour tirage », « Liste des Bordereaux d\'Envoi »', description:'Restées vides pour ce projet dans le classeur fourni — à confirmer si Futura Expertise s\'en sert encore en pratique avant de construire quoi que ce soit.', notes:'À confirmer avec l\'utilisateur avant de démarrer.'}
];

function importerBacklogDefauts(){
  var lot = BACKLOG_SEED.map(function(it){
    return Object.assign({
      statutImplementation:'a_faire', statutTest:'a_faire', notes:'',
      createdAt: nowISO(), creePar: currentUserName()
    }, it);
  });
  return Promise.all(lot.map(function(it){ return STATE.db.collection('backlog').add(it); }));
}

function saveBacklogItem(data, id){
  if(id) return STATE.db.doc('backlog/'+id).update(data);
  data.createdAt = nowISO(); data.creePar = currentUserName();
  return STATE.db.collection('backlog').add(data);
}

var backlogFilter = {q:'', priorite:'', impl:''};

function renderBacklog(mount, actions){
  var canEdit = canWrite('backlog');
  if(canEdit){
    actions.innerHTML = '<button type="button" class="btn btn-primary" id="btn-new-backlog">'+ic('plus',15)+' Nouvelle piste</button>';
    byId('btn-new-backlog').addEventListener('click', function(){ openBacklogFormModal(null); });
  }

  var total = STATE.backlog.length;
  var implCounts = {a_faire:0, en_cours:0, fait:0};
  var testCounts = {a_faire:0, en_cours:0, valide:0};
  STATE.backlog.forEach(function(it){
    implCounts[it.statutImplementation] = (implCounts[it.statutImplementation]||0)+1;
    testCounts[it.statutTest] = (testCounts[it.statutTest]||0)+1;
  });

  var body = '';
  if(total){
    body += '<div class="kpi-grid">'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">Pistes au total</div><div class="kpi-value">'+total+'</div></div>'+
      '<div class="card kpi kpi-accent ok"><div class="kpi-label">Implémentées</div><div class="kpi-value">'+implCounts.fait+'</div></div>'+
      '<div class="card kpi kpi-accent warn"><div class="kpi-label">En cours</div><div class="kpi-value">'+implCounts.en_cours+'</div></div>'+
      '<div class="card kpi kpi-accent"><div class="kpi-label">À faire</div><div class="kpi-value">'+implCounts.a_faire+'</div></div>'+
      '<div class="card kpi kpi-accent ok"><div class="kpi-label">Tests validés</div><div class="kpi-value">'+testCounts.valide+'</div></div>'+
    '</div>';
  }

  body += '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="backlog-search" placeholder="Rechercher par titre ou source…" value="'+esc(backlogFilter.q)+'">'+
      '<select id="backlog-filter-priorite"><option value="">Toutes priorités</option>'+
        BACKLOG_PRIORITES.map(function(p){ return '<option value="'+p.id+'"'+(backlogFilter.priorite===p.id?' selected':'')+'>'+esc(p.label)+'</option>'; }).join('')+
      '</select>'+
      '<select id="backlog-filter-impl"><option value="">Toute implémentation</option>'+
        BACKLOG_IMPL_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(backlogFilter.impl===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+
      '</select>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Pistes d’évolution de l’application elle-même, identifiées lors de l’analyse d’un classeur de suivi des livrables. Réservé à l’Administrateur.</p>';

  if(!total){
    body += emptyState('clipboard', 'Aucune piste de développement enregistrée pour le moment.',
      canEdit? '<button type="button" class="btn btn-primary" id="empty-import-backlog">'+ic('download',15)+' Importer les 12 pistes identifiées</button>'+
               '<button type="button" class="btn" id="empty-new-backlog" style="margin-left:8px;">'+ic('plus',15)+' Nouvelle piste</button>' : '');
  } else {
    var list = STATE.backlog.filter(function(it){
      if(backlogFilter.priorite && it.priorite!==backlogFilter.priorite) return false;
      if(backlogFilter.impl && it.statutImplementation!==backlogFilter.impl) return false;
      if(backlogFilter.q){
        var q = backlogFilter.q.toLowerCase();
        if((it.titre||'').toLowerCase().indexOf(q)<0 && (it.source||'').toLowerCase().indexOf(q)<0) return false;
      }
      return true;
    }).sort(function(a,b){
      if(a.priorite!==b.priorite) return (a.priorite||'').localeCompare(b.priorite||'');
      return (a.titre||'').localeCompare(b.titre||'');
    });
    if(!list.length){
      body += emptyState('search', 'Aucun résultat pour ces filtres.');
    } else {
      body += '<div class="table-wrap"><table><thead><tr><th>Priorité</th><th>Titre</th><th>Source</th><th>Implémentation</th><th>Test</th><th>Notes</th><th></th></tr></thead><tbody>'+
        list.map(function(it){
          var pri = statutMeta(BACKLOG_PRIORITES, it.priorite);
          return '<tr>'+
            '<td><span class="pill pill-'+pri.tone+'">'+esc(pri.label)+'</span></td>'+
            '<td><b>'+esc(it.titre)+'</b><div class="muted" style="font-size:12px;margin-top:2px;">'+esc(it.description||'')+'</div></td>'+
            '<td class="muted" style="font-size:12.5px;">'+esc(it.source||'—')+'</td>'+
            '<td>'+(canEdit?
              '<select class="backlog-impl-select" data-id="'+it.id+'">'+BACKLOG_IMPL_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(it.statutImplementation===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select>' :
              '<span class="pill pill-'+statutMeta(BACKLOG_IMPL_STATUTS, it.statutImplementation).tone+'">'+esc(statutMeta(BACKLOG_IMPL_STATUTS, it.statutImplementation).label)+'</span>')+
            '</td>'+
            '<td>'+(canEdit?
              '<select class="backlog-test-select" data-id="'+it.id+'">'+BACKLOG_TEST_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(it.statutTest===s.id?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')+'</select>' :
              '<span class="pill pill-'+statutMeta(BACKLOG_TEST_STATUTS, it.statutTest).tone+'">'+esc(statutMeta(BACKLOG_TEST_STATUTS, it.statutTest).label)+'</span>')+
            '</td>'+
            '<td class="muted" style="font-size:12.5px;max-width:160px;">'+esc(it.notes||'—')+'</td>'+
            '<td><div class="row-actions">'+
              (canEdit? '<button type="button" class="iconbtn" data-edit-backlog="'+it.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
              '<button type="button" class="iconbtn" data-del-backlog="'+it.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
            '</div></td>'+
          '</tr>';
        }).join('')+'</tbody></table></div>';
    }
  }
  mount.innerHTML = body;

  var searchEl = byId('backlog-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){
    backlogFilter.q = searchEl.value; renderBacklog(mount, actions);
    searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }, 220));
  var priEl = byId('backlog-filter-priorite');
  if(priEl) priEl.addEventListener('change', function(){ backlogFilter.priorite = priEl.value; renderBacklog(mount, actions); });
  var implEl = byId('backlog-filter-impl');
  if(implEl) implEl.addEventListener('change', function(){ backlogFilter.impl = implEl.value; renderBacklog(mount, actions); });

  var importBtn = byId('empty-import-backlog');
  if(importBtn) importBtn.addEventListener('click', function(){
    importBtn.disabled = true;
    importerBacklogDefauts().then(function(){
      toast('12 pistes importées', 'success');
    }).catch(function(e){ console.error(e); toast('Erreur d’import', 'danger'); importBtn.disabled = false; });
  });
  var emptyNewBtn = byId('empty-new-backlog');
  if(emptyNewBtn) emptyNewBtn.addEventListener('click', function(){ openBacklogFormModal(null); });

  mount.querySelectorAll('.backlog-impl-select').forEach(function(sel){
    sel.addEventListener('change', function(){
      STATE.db.doc('backlog/'+sel.getAttribute('data-id')).update({statutImplementation: sel.value})
        .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
    });
  });
  mount.querySelectorAll('.backlog-test-select').forEach(function(sel){
    sel.addEventListener('change', function(){
      STATE.db.doc('backlog/'+sel.getAttribute('data-id')).update({statutTest: sel.value})
        .catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
    });
  });
  mount.querySelectorAll('[data-edit-backlog]').forEach(function(b){ b.addEventListener('click', function(){
    openBacklogFormModal(STATE.backlog.find(function(it){ return it.id===b.getAttribute('data-edit-backlog'); }));
  }); });
  mount.querySelectorAll('[data-del-backlog]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-del-backlog');
    confirmDialog('Supprimer définitivement cette piste du backlog ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteDoc('backlog', id).then(function(){ toast('Piste supprimée', 'success'); })
        .catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
}

function openBacklogFormModal(it){
  var overlay = openModal({
    title: it ? 'Modifier la piste' : 'Nouvelle piste de développement',
    large: true,
    body:
      '<div class="field"><label for="blf-titre">Titre</label><input id="blf-titre" required value="'+esc(it?it.titre||'':'')+'"></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="blf-priorite">Priorité</label><select id="blf-priorite">'+
          BACKLOG_PRIORITES.map(function(p){ return '<option value="'+p.id+'"'+(it&&it.priorite===p.id?' selected':'')+'>'+esc(p.label)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label for="blf-source">Source (feuille, document…)</label><input id="blf-source" value="'+esc(it?it.source||'':'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="blf-description">Description</label><textarea id="blf-description">'+esc(it?it.description||'':'')+'</textarea></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="blf-impl">Statut d’implémentation</label><select id="blf-impl">'+
          BACKLOG_IMPL_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(it&&it.statutImplementation===s.id?' selected':(!it&&s.id==='a_faire'?' selected':''))+'>'+esc(s.label)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label for="blf-test">Statut de test</label><select id="blf-test">'+
          BACKLOG_TEST_STATUTS.map(function(s){ return '<option value="'+s.id+'"'+(it&&it.statutTest===s.id?' selected':(!it&&s.id==='a_faire'?' selected':''))+'>'+esc(s.label)+'</option>'; }).join('')+
        '</select></div>'+
      '</div>'+
      '<div class="field"><label for="blf-notes">Notes</label><textarea id="blf-notes">'+esc(it?it.notes||'':'')+'</textarea></div>',
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="blf-save">Enregistrer</button>'
  });
  overlay.querySelector('#blf-save').addEventListener('click', function(){
    var titre = byId('blf-titre').value.trim();
    if(!titre){ toast('Le titre est obligatoire', 'danger'); return; }
    var data = {
      titre: titre,
      priorite: byId('blf-priorite').value,
      source: byId('blf-source').value.trim(),
      description: byId('blf-description').value.trim(),
      statutImplementation: byId('blf-impl').value,
      statutTest: byId('blf-test').value,
      notes: byId('blf-notes').value.trim()
    };
    saveBacklogItem(data, it?it.id:null).then(function(){
      closeModal(); toast('Piste enregistrée', 'success');
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  });
}

/* =========================================================
   PARAMETRES (societe + utilisateurs)
   ========================================================= */
// Emplacement de la base de donnees (V1.38, Parametres) : etat charge de
// facon asynchrone (pas via le polling STATE habituel, puisqu'il s'agit du
// fichier de base de donnees lui-meme - voir backend/routes/db_admin.py),
// mis en cache ici et rafraichi apres chaque action (changement de
// repertoire, adoption d'une version precedente).
var DB_INFO = {loading:false, loaded:false, data:null, error:null};
function loadDbInfo(force){
  if(DB_INFO.loading) return;
  if(DB_INFO.loaded && !force) return;
  DB_INFO.loading = true;
  fetch('/api/db/info').then(function(r){ return r.json(); }).then(function(d){
    DB_INFO.data = d; DB_INFO.error = null; DB_INFO.loaded = true; DB_INFO.loading = false;
    scheduleRender();
  }).catch(function(e){
    DB_INFO.error = String(e && e.message || e); DB_INFO.loaded = true; DB_INFO.loading = false;
    scheduleRender();
  });
}
// Modules desactivables par installation (V1.57, Parametres) : meme
// principe de cache que DB_INFO ci-dessus - voir backend/modules.py et
// claude/architecture-cloud-securite.md.
var MODULES_INFO = {loading:false, loaded:false, data:null, error:null};
function loadModulesInfo(force){
  if(MODULES_INFO.loading) return;
  if(MODULES_INFO.loaded && !force) return;
  MODULES_INFO.loading = true;
  fetch('/api/modules').then(function(r){ return r.json(); }).then(function(d){
    MODULES_INFO.data = d.modules; MODULES_INFO.error = null; MODULES_INFO.loaded = true; MODULES_INFO.loading = false;
    scheduleRender();
  }).catch(function(e){
    MODULES_INFO.error = String(e && e.message || e); MODULES_INFO.loaded = true; MODULES_INFO.loading = false;
    scheduleRender();
  });
}
function fmtOctets(n){
  if(!n) return '0 Ko';
  if(n < 1024*1024) return (n/1024).toFixed(0)+' Ko';
  return (n/(1024*1024)).toFixed(1)+' Mo';
}

function renderSettings(mount){
  var c = STATE.company;
  loadDbInfo();
  var dbi = DB_INFO.data;
  mount.innerHTML =
    '<div class="field-row grid-2" style="align-items:start;">'+
      '<div class="card card-pad">'+
        '<h3 style="font-size:14px;margin-bottom:14px;">Informations société</h3>'+
        '<div id="settings-company-form">'+
          '<div class="field"><label>Logo (impression des documents)</label>'+
            '<div style="display:flex;align-items:center;gap:14px;">'+
              '<div id="sf-logo-preview" style="min-width:120px;max-width:200px;min-height:46px;display:flex;align-items:center;">'+
                (c.logo? '<img src="'+c.logo+'" alt="Logo" style="max-height:46px;max-width:200px;">' : '<span class="muted" style="font-size:12px;">Aucun logo</span>')+
              '</div>'+
              '<input type="file" id="sf-logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;">'+
              '<button type="button" class="btn btn-sm" id="sf-logo-pick">'+ic('image',13)+' Choisir…</button>'+
              '<button type="button" class="btn btn-sm" id="sf-logo-clear"'+(c.logo?'':' hidden')+'>'+ic('trash',13)+' Supprimer</button>'+
            '</div>'+
            '<p class="hint" style="margin-top:6px;">Image PNG/JPG/SVG, affichée en haut à gauche des documents imprimés (devis, contrats, attachements, factures).</p>'+
          '</div>'+
          '<div class="field"><label for="sf-nom">Raison sociale</label><input id="sf-nom" value="'+esc(c.nom||'')+'"></div>'+
          '<div class="field-row grid-3">'+
            '<div class="field"><label for="sf-ice">ICE</label><input id="sf-ice" value="'+esc(c.ice||'')+'"></div>'+
            '<div class="field"><label for="sf-if">Identifiant fiscal</label><input id="sf-if" value="'+esc(c.identifiantFiscal||'')+'"></div>'+
            '<div class="field"><label for="sf-rc">RC</label><input id="sf-rc" value="'+esc(c.rc||'')+'"></div>'+
          '</div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="sf-cnss">CNSS</label><input id="sf-cnss" value="'+esc(c.cnss||'')+'"></div>'+
            '<div class="field"><label for="sf-patente">Patente</label><input id="sf-patente" value="'+esc(c.patente||'')+'"></div>'+
          '</div>'+
          '<div class="field"><label for="sf-adresse">Adresse</label><textarea id="sf-adresse">'+esc(c.adresse||'')+'</textarea></div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="sf-ville">Ville</label><input id="sf-ville" value="'+esc(c.ville||'')+'"></div>'+
            '<div class="field"><label for="sf-telephone">Téléphone</label><input id="sf-telephone" value="'+esc(c.telephone||'')+'"></div>'+
          '</div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="sf-email">Email</label><input id="sf-email" type="email" value="'+esc(c.email||'')+'"></div>'+
            '<div class="field"><label for="sf-devise">Devise</label><input id="sf-devise" value="'+esc(c.devise||'MAD')+'"></div>'+
          '</div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="sf-rib">RIB</label><input id="sf-rib" value="'+esc(c.rib||'')+'"></div>'+
            '<div class="field"><label for="sf-banque">Banque</label><input id="sf-banque" value="'+esc(c.banque||'')+'"></div>'+
          '</div>'+
          '<button type="button" class="btn btn-primary" id="sf-save-company">Enregistrer</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:18px;">'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:14px;">Numérotation et taux par défaut</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Préfixe et nombre de chiffres de chaque type de document (RG-010 du CDC de nomenclature : ces réglages ne nécessitent aucune modification de code). Format : PRÉFIXE-AAAA-NNNN (le nombre de chiffres est configurable ci-dessous).</p>'+
          '<div class="field-row grid-3">'+
            SEQ_NUMBERING_FIELDS.map(function(f){
              return '<div class="field"><label for="sf-pfx-'+f.type+'">Préfixe '+esc(f.label)+'</label>'+
                '<div style="display:flex;gap:6px;">'+
                  '<input id="sf-pfx-'+f.type+'" style="flex:1;" value="'+esc(seqPrefix(f.type))+'">'+
                  '<input id="sf-wid-'+f.type+'" type="number" min="1" max="8" style="width:64px;" title="Nombre de chiffres" value="'+seqWidth(f.type)+'">'+
                '</div></div>';
            }).join('')+
          '</div>'+
          '<div class="field-row grid-2">'+
            '<div class="field"><label for="sf-tva">TVA par défaut (%)</label><input type="number" step="any" id="sf-tva" value="'+(c.tauxTVA!==undefined?c.tauxTVA:20)+'"></div>'+
            '<div class="field"><label for="sf-rg">Retenue de garantie par défaut (%)</label><input type="number" step="any" id="sf-rg" value="'+(c.tauxRG!==undefined?c.tauxRG:10)+'"></div>'+
          '</div>'+
          '<button type="button" class="btn btn-primary" id="sf-save-numbering">Enregistrer</button>'+
        '</div>'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Emplacement de la base de données</h3>'+
          (!dbi ?
            '<p class="hint">'+(DB_INFO.error? 'Erreur de chargement : '+esc(DB_INFO.error) : 'Chargement…')+'</p>'
          :
            '<p class="hint" style="margin-bottom:10px;">Répertoire où est enregistré le fichier de base de données de l’application (toutes les données : clients, factures, comptabilité…) — utile par exemple pour pointer vers un disque ou un partage réseau commun à plusieurs postes. Le fichier porte le numéro de version de l’application en suffixe ('+esc(dbi.fichierActuel)+') : une mise à jour de version n’écrase donc jamais la base d’une version précédente, qui reste disponible pour une reprise explicite ci-dessous.</p>'+
            '<div class="field"><label for="sf-db-dir">Répertoire (chemin complet sur ce poste/serveur)</label>'+
              '<div style="display:flex;gap:8px;">'+
                '<input id="sf-db-dir" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(dbi.parDefaut? '' : dbi.repertoire)+'">'+
                '<button type="button" class="btn" id="sf-parcourir-db-dir">Parcourir…</button>'+
              '</div></div>'+
            '<p class="hint" id="sf-db-actuel" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(dbi.repertoire)+(dbi.parDefaut?' (répertoire par défaut de l’application)':'')+' — fichier « '+esc(dbi.fichierActuel)+' », '+fmtOctets(dbi.taille)+', modifié le '+fmtDateTime(dbi.modifie)+'.</p>'+
            (dbi.rapportMigration ?
              '<details style="margin:12px 0;"><summary style="cursor:pointer;"><strong>Dernier rapport de migration des données (JSON → tables SQL)</strong> — '+(dbi.rapportMigration.indexOf('MIGRATION COMPLÈTE ET VÉRIFIÉE')>=0?'complète et vérifiée':'À CORRIGER')+'</summary>'+
              '<pre style="white-space:pre-wrap;font-size:12px;max-height:320px;overflow:auto;margin-top:8px;">'+esc(dbi.rapportMigration)+'</pre></details>' : '')+
            '<button type="button" class="btn btn-primary" id="sf-save-db-dir">Enregistrer</button>'+
            (dbi.versionsPrecedentesDisponibles && dbi.versionsPrecedentesDisponibles.length ?
              '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">'+
                '<p class="hint" style="margin-bottom:10px;"><strong>Base(s) de données d’une version précédente trouvée(s) dans ce répertoire</strong> — probablement laissée(s) par une mise à jour de l’application : les données n’ont pas disparu, elles sont simplement restées sous l’ancien nom de fichier. Cliquez sur « Utiliser cette base » pour reprendre son contenu dans cette version.</p>'+
                '<div class="table-wrap"><table><thead><tr><th>Fichier</th><th>Version</th><th>Taille</th><th>Modifié</th><th></th></tr></thead><tbody>'+
                  dbi.versionsPrecedentesDisponibles.map(function(f){
                    return '<tr>'+
                      '<td class="muted">'+esc(f.fichier)+'</td>'+
                      '<td><span class="pill pill-neutral">'+esc(f.version)+'</span></td>'+
                      '<td>'+fmtOctets(f.taille)+'</td>'+
                      '<td>'+fmtDateTime(f.modifie)+'</td>'+
                      '<td><button type="button" class="btn btn-sm" data-adopter-db="'+esc(f.fichier)+'">Utiliser cette base</button></td>'+
                    '</tr>';
                  }).join('')+
                '</tbody></table></div>'+
              '</div>'
            : '')+
            '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">'+
              '<p class="hint" style="margin-bottom:10px;"><strong>Reprendre une base située ailleurs</strong> — indiquez (ou parcourez) le chemin complet d’un fichier de base de données d’une version antérieure, où qu’il se trouve (clé USB, disque externe, copie reçue d’un autre poste…).</p>'+
              '<div class="field"><label for="sf-db-chemin-externe">Chemin complet du fichier</label>'+
                '<div style="display:flex;gap:8px;">'+
                  '<input id="sf-db-chemin-externe" style="flex:1;" placeholder="ex. C:\\sauvegardes\\chantier_erp_V1.20.db">'+
                  '<button type="button" class="btn" id="sf-parcourir-db-fichier">Parcourir…</button>'+
                  '<button type="button" class="btn" id="sf-adopter-externe">Récupérer ce fichier</button>'+
                '</div>'+
              '</div>'+
            '</div>'
          )+
        '</div>'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Stockage des factures fournisseurs</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Répertoire où sont enregistrés les fichiers d’origine des factures fournisseurs (PDF/scans), classés par année/mois — utile par exemple pour pointer vers un disque ou un partage réseau commun à plusieurs postes. Les modèles de zones par fournisseur restent, eux, toujours enregistrés dans la base de données (fiche du fournisseur), pas sous forme de fichiers.</p>'+
          '<div class="field"><label for="sf-stockage-dir">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<div style="display:flex;gap:8px;">'+
              '<input id="sf-stockage-dir" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(c.facturesFournisseursDir||'')+'">'+
              '<button type="button" class="btn" id="sf-parcourir-stockage">Parcourir…</button>'+
            '</div></div>'+
          '<p class="hint" id="sf-stockage-actuel" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(c.facturesFournisseursDir||'(répertoire par défaut de l’application)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-stockage">Enregistrer</button>'+
        '</div>'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Stockage des factures clients</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Répertoire où sont enregistrés les fichiers d’origine des factures clients importées (PDF/scans), classés par année/mois — distinct du répertoire des factures fournisseurs ci-dessus. Les fichiers y sont nommés « Facture_AAAA_MM_JJ_NomClient_Référence », précédés du mot « Facture » pour les distinguer au premier coup d’œil des factures fournisseurs (nommées sans ce préfixe) en cas de support partagé.</p>'+
          '<div class="field"><label for="sf-stockage-dir-clients">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<div style="display:flex;gap:8px;">'+
              '<input id="sf-stockage-dir-clients" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(c.facturesClientsDir||'')+'">'+
              '<button type="button" class="btn" id="sf-parcourir-stockage-clients">Parcourir…</button>'+
            '</div></div>'+
          '<p class="hint" id="sf-stockage-actuel-clients" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(c.facturesClientsDir||'(répertoire par défaut de l’application)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-stockage-clients">Enregistrer</button>'+
        '</div>'+
        // V2.04 : la piece jointe (scan BC/contrat) du formulaire Commande
        // client etait jusqu'ici stockee en base64 directement dans
        // l'enregistrement de la commande - demande explicite de
        // l'utilisateur de l'enregistrer "de la meme maniere que les
        // autres documents" : desormais un vrai fichier sur le disque,
        // dans ce repertoire configurable (meme principe exact que les
        // deux cartes de stockage ci-dessus, perimetre volontairement
        // reduit : pas de dossier "a traiter"/OCR, un seul fichier deja
        // choisi dans le formulaire).
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Stockage des pièces jointes de contrats</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Répertoire où est enregistrée la pièce jointe (scan du BC / contrat client) des contrats (anciennement commandes clients), classée par année/mois — distinct des répertoires de factures ci-dessus. Les fichiers y sont nommés « Commande_AAAA_MM_JJ_NomClient_NumeroCommande ».</p>'+
          '<div class="field"><label for="sf-stockage-dir-cmd">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<div style="display:flex;gap:8px;">'+
              '<input id="sf-stockage-dir-cmd" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(c.commandesPiecesJointesDir||'')+'">'+
              '<button type="button" class="btn" id="sf-parcourir-stockage-cmd">Parcourir…</button>'+
            '</div></div>'+
          '<p class="hint" id="sf-stockage-actuel-cmd" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(c.commandesPiecesJointesDir||'(répertoire par défaut de l’application)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-stockage-cmd">Enregistrer</button>'+
        '</div>'+
        // V3.43 : répertoire des fiches techniques du matériel (Étude électrique)
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Répertoire des fiches techniques (Étude électrique)</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Répertoire où sont rangées les fiches techniques des protections (une page par fiche), nommées « Constructeur_Categorie_Gamme_Données ». Le changer déplace les fiches déjà enregistrées.</p>'+
          '<div class="field"><label for="sf-stockage-dir-fiches">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<div style="display:flex;gap:8px;">'+
              '<input id="sf-stockage-dir-fiches" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(c.fichesTechniquesDir||'')+'">'+
              '<button type="button" class="btn" id="sf-parcourir-stockage-fiches">Parcourir…</button>'+
            '</div></div>'+
          '<p class="hint" id="sf-stockage-actuel-fiches" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(c.fichesTechniquesDir||'(répertoire par défaut de l’application)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-stockage-fiches">Enregistrer</button>'+
        '</div>'+
        // V2.11 : import de devis deja emis (PDF), a l'identique du module
        // Factures clients - meme principe exact de carte de stockage
        // configurable que les trois ci-dessus.
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Stockage des devis importés</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Répertoire où sont enregistrés les fichiers d’origine des devis déjà émis et importés (PDF/scans), classés par année/mois — distinct des répertoires ci-dessus. Les fichiers y sont nommés « Devis_AAAA_MM_JJ_NomClient_Référence ».</p>'+
          '<div class="field"><label for="sf-stockage-dir-devis">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<div style="display:flex;gap:8px;">'+
              '<input id="sf-stockage-dir-devis" style="flex:1;" placeholder="Laisser vide pour le répertoire par défaut de l’application" value="'+esc(c.devisImportesDir||'')+'">'+
              '<button type="button" class="btn" id="sf-parcourir-stockage-devis">Parcourir…</button>'+
            '</div></div>'+
          '<p class="hint" id="sf-stockage-actuel-devis" style="margin:-2px 0 10px;">Répertoire actuellement utilisé : '+esc(c.devisImportesDir||'(répertoire par défaut de l’application)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-stockage-devis">Enregistrer</button>'+
        '</div>'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Factures fournisseurs à traiter</h3>'+
          '<p class="hint" style="margin-bottom:10px;">Dossier où sont déposées les factures fournisseurs (PDF/scans) en attente de reconnaissance — par exemple la sortie d’un scanner réseau, ou une archive déjà organisée par année/fournisseur. Le bouton « Traitement » (écran Factures fournisseurs) lit directement les fichiers présents dans ce dossier ET dans la totalité de ses sous-dossiers, à n’importe quelle profondeur, sans passer par le sélecteur de fichiers du navigateur ; le bouton « Importer » habituel reste disponible et inchangé. Une fois qu’une facture issue de ce dossier est validée, son fichier d’origine y est supprimé (après avoir été classé normalement dans le répertoire de stockage ci-dessus) — pour qu’il ne reste, au fil du temps, que les factures pas encore traitées. <strong>Ce dossier doit donc toujours être distinct du répertoire de Stockage ci-dessus</strong> (jamais le même, ni l’un dans l’autre) : l’application refuse de l’enregistrer ou de lancer le Traitement si un chevauchement est détecté, pour ne jamais supprimer par erreur une facture déjà classée.</p>'+
          '<div class="field"><label for="sf-source-dir">Répertoire (chemin complet sur ce poste/serveur)</label>'+
            '<input id="sf-source-dir" placeholder="Laisser vide pour désactiver le bouton Traitement" value="'+esc(c.facturesFournisseursSourceDir||'')+'"></div>'+
          '<p class="hint" id="sf-source-actuel" style="margin:-2px 0 10px;">Dossier actuellement utilisé : '+esc(c.facturesFournisseursSourceDir||'(aucun — bouton Traitement désactivé)')+'</p>'+
          '<button type="button" class="btn btn-primary" id="sf-save-source">Enregistrer</button>'+
        '</div>'+
        '<div class="card card-pad">'+
          '<h3 style="font-size:14px;margin-bottom:10px;">Modèles de zones (factures fournisseurs)</h3>'+
          '<p class="hint" style="margin-bottom:12px;">Sauvegardez ou transférez vers une autre installation l’ensemble des modèles de zones déjà dessinés (un par fournisseur, voir le bouton « Modèle de zones » depuis Factures fournisseurs). Fichier technique (JSON) : ces modèles restent toujours enregistrés dans la base de données, ce fichier n’est qu’une copie exportable.</p>'+
          '<div style="display:flex;gap:10px;flex-wrap:wrap;">'+
            '<button type="button" class="btn" id="btn-export-zones-modeles">'+ic('download',13)+' Exporter les modèles de zones</button>'+
            '<button type="button" class="btn" id="btn-import-zones-modeles">'+ic('upload',13)+' Importer les modèles de zones</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';

  var pendingLogo = c.logo || '';
  byId('sf-logo-pick').addEventListener('click', function(){ byId('sf-logo-file').click(); });
  byId('sf-logo-file').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    if(file.size > 900*1024){ toast('Image trop lourde (max ~900 Ko) : choisissez un fichier plus léger', 'danger'); e.target.value=''; return; }
    var reader = new FileReader();
    reader.onload = function(){
      pendingLogo = reader.result;
      byId('sf-logo-preview').innerHTML = '<img src="'+pendingLogo+'" alt="Logo" style="max-height:46px;max-width:200px;">';
      byId('sf-logo-clear').hidden = false;
    };
    reader.readAsDataURL(file);
  });
  byId('sf-logo-clear').addEventListener('click', function(){
    pendingLogo = '';
    byId('sf-logo-file').value = '';
    byId('sf-logo-preview').innerHTML = '<span class="muted" style="font-size:12px;">Aucun logo</span>';
    byId('sf-logo-clear').hidden = true;
  });
  byId('sf-save-company').addEventListener('click', function(){
    saveCompany({
      nom: byId('sf-nom').value.trim(), logo: pendingLogo, ice: byId('sf-ice').value.trim(), identifiantFiscal: byId('sf-if').value.trim(),
      rc: byId('sf-rc').value.trim(), cnss: byId('sf-cnss').value.trim(), patente: byId('sf-patente').value.trim(),
      adresse: byId('sf-adresse').value.trim(), ville: byId('sf-ville').value.trim(), telephone: byId('sf-telephone').value.trim(),
      email: byId('sf-email').value.trim(), devise: byId('sf-devise').value.trim()||'MAD',
      rib: byId('sf-rib').value.trim(), banque: byId('sf-banque').value.trim()
    }).then(function(){ toast('Informations société enregistrées', 'success'); }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  });
  byId('sf-save-numbering').addEventListener('click', function(){
    var seqPrefixes = Object.assign({}, c.seqPrefixes);
    var seqWidths = Object.assign({}, c.seqWidths);
    SEQ_NUMBERING_FIELDS.forEach(function(f){
      seqPrefixes[f.type] = (byId('sf-pfx-'+f.type).value.trim()||f.def).toUpperCase();
      seqWidths[f.type] = Math.min(8, Math.max(1, Number(byId('sf-wid-'+f.type).value)||4));
    });
    saveCompany({
      seqPrefixes: seqPrefixes, seqWidths: seqWidths,
      tauxTVA: Number(byId('sf-tva').value)||0, tauxRG: Number(byId('sf-rg').value)||0
    }).then(function(){ toast('Paramètres enregistrés', 'success'); }).catch(function(e){ console.error(e); toast('Erreur d’enregistrement', 'danger'); });
  });
  byId('btn-export-zones-modeles').addEventListener('click', function(){ exportZonesModeles(); });
  byId('btn-import-zones-modeles').addEventListener('click', function(){ openImportZonesModelesModal(); });
  if(dbi){
    byId('sf-parcourir-db-dir').addEventListener('click', function(){
      parcourirChemin({
        titre: 'Choisir le répertoire de stockage',
        mode: 'dossier',
        cheminInitial: byId('sf-db-dir').value.trim() || dbi.repertoire,
        onChoisirDossier: function(chemin){ byId('sf-db-dir').value = chemin; }
      });
    });
    byId('sf-parcourir-db-fichier').addEventListener('click', function(){
      parcourirChemin({
        titre: 'Choisir le fichier de base de données à récupérer',
        mode: 'fichier',
        cheminInitial: byId('sf-db-dir').value.trim() || dbi.repertoire,
        onChoisirFichier: function(chemin){ byId('sf-db-chemin-externe').value = chemin; }
      });
    });
    byId('sf-adopter-externe').addEventListener('click', function(){
      var chemin = byId('sf-db-chemin-externe').value.trim();
      if(!chemin){ toast('Indiquez le chemin complet du fichier à récupérer', 'danger'); return; }
      confirmDialog(
        'Le contenu de ce fichier remplacera les données actuellement utilisées par l’application (« '+dbi.fichierActuel+' »). '+
        (dbi.existeDeja ? 'Par sécurité, le fichier actuel sera renommé (jamais supprimé) avant ce remplacement.' : '')+
        ' La page sera rechargée une fois l’opération terminée. Continuer ?',
        {okLabel:'Récupérer ce fichier', danger:true}
      ).then(function(ok){
        if(!ok) return;
        var btn = byId('sf-adopter-externe');
        btn.disabled = true; btn.textContent = 'Reprise en cours…';
        fetch('/api/db/adopter', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cheminSource: chemin})
        }).then(function(r){
          return r.text().then(function(text){
            var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
            if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
            return json;
          });
        }).then(function(){
          toast('Base de données reprise avec succès — rechargement…', 'success');
          setTimeout(function(){ location.reload(); }, 900);
        }).catch(function(err){
          console.error(err); toast('Erreur : '+err.message, 'danger');
          btn.disabled = false; btn.textContent = 'Récupérer ce fichier';
        });
      });
    });
    byId('sf-save-db-dir').addEventListener('click', function(){
      var nouveauDir = byId('sf-db-dir').value.trim();
      var ancienDir = dbi.parDefaut ? '' : dbi.repertoire;
      if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
      confirmDialog(
        'Le fichier de base de données (« '+dbi.fichierActuel+' », toutes les données de l’application) sera déplacé vers ce nouveau répertoire. Continuer ?',
        {okLabel:'Changer le répertoire'}
      ).then(function(ok){
        if(!ok) return;
        var btn = byId('sf-save-db-dir');
        btn.disabled = true; btn.textContent = 'Déplacement en cours…';
        fetch('/api/db/location', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
        }).then(function(r){
          return r.text().then(function(text){
            var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
            if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
            return json;
          });
        }).then(function(){
          toast('Répertoire de la base de données mis à jour', 'success');
          loadDbInfo(true);
        }).catch(function(err){
          console.error(err); toast('Erreur : '+err.message, 'danger');
          btn.disabled = false; btn.textContent = 'Enregistrer';
        });
      });
    });
    mount.querySelectorAll('[data-adopter-db]').forEach(function(b){
      b.addEventListener('click', function(){
        var fichier = b.getAttribute('data-adopter-db');
        confirmDialog(
          'Le contenu de « '+fichier+' » remplacera les données actuellement utilisées par l’application (« '+dbi.fichierActuel+' »). '+
          (dbi.existeDeja ? 'Par sécurité, le fichier actuel sera renommé (jamais supprimé) avant ce remplacement.' : '')+
          ' La page sera rechargée une fois l’opération terminée. Continuer ?',
          {okLabel:'Utiliser cette base', danger:true}
        ).then(function(ok){
          if(!ok) return;
          b.disabled = true; b.textContent = 'Reprise en cours…';
          fetch('/api/db/adopter', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fichier: fichier})
          }).then(function(r){
            return r.text().then(function(text){
              var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
              if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
              return json;
            });
          }).then(function(){
            toast('Base de données reprise avec succès — rechargement…', 'success');
            setTimeout(function(){ location.reload(); }, 900);
          }).catch(function(err){
            console.error(err); toast('Erreur : '+err.message, 'danger');
            b.disabled = false; b.textContent = 'Utiliser cette base';
          });
        });
      });
    });
  }
  byId('sf-parcourir-stockage').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire de stockage des factures fournisseurs',
      mode: 'dossier',
      cheminInitial: byId('sf-stockage-dir').value.trim(),
      onChoisirDossier: function(chemin){ byId('sf-stockage-dir').value = chemin; }
    });
  });
  byId('sf-parcourir-stockage-clients').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire de stockage des factures clients',
      mode: 'dossier',
      cheminInitial: byId('sf-stockage-dir-clients').value.trim(),
      onChoisirDossier: function(chemin){ byId('sf-stockage-dir-clients').value = chemin; }
    });
  });
  byId('sf-parcourir-stockage-fiches').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire des fiches techniques',
      mode: 'dossier',
      cheminInitial: byId('sf-stockage-dir-fiches').value.trim(),
      onChoisirDossier: function(chemin){ byId('sf-stockage-dir-fiches').value = chemin; }
    });
  });
  byId('sf-save-stockage-fiches').addEventListener('click', function(){
    var nouveauDir = byId('sf-stockage-dir-fiches').value.trim();
    var ancienDir = c.fichesTechniquesDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    confirmDialog('Les fiches techniques déjà enregistrées seront déplacées vers ce nouveau répertoire. Continuer ?', {okLabel:'Changer le répertoire'}).then(function(ok){
      if(!ok) return;
      var btn = byId('sf-save-stockage-fiches');
      btn.disabled = true; btn.textContent = 'Déplacement en cours…';
      fetch('/api/etude-elec/docs/dir', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})}).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){
        c.fichesTechniquesDir = nouveauDir;
        toast('Répertoire des fiches techniques mis à jour', 'success');
        var actuel = byId('sf-stockage-actuel-fiches');
        if(actuel) actuel.textContent = 'Répertoire actuellement utilisé : '+(res.dir||'(répertoire par défaut de l’application)');
        scheduleRender();
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
      }).then(function(){
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  });
  byId('sf-parcourir-stockage-cmd').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire de stockage des pièces jointes de contrats',
      mode: 'dossier',
      cheminInitial: byId('sf-stockage-dir-cmd').value.trim(),
      onChoisirDossier: function(chemin){ byId('sf-stockage-dir-cmd').value = chemin; }
    });
  });
  byId('sf-parcourir-stockage-devis').addEventListener('click', function(){
    parcourirChemin({
      titre: 'Choisir le répertoire de stockage des devis importés',
      mode: 'dossier',
      cheminInitial: byId('sf-stockage-dir-devis').value.trim(),
      onChoisirDossier: function(chemin){ byId('sf-stockage-dir-devis').value = chemin; }
    });
  });
  byId('sf-save-stockage').addEventListener('click', function(){
    var nouveauDir = byId('sf-stockage-dir').value.trim();
    var ancienDir = c.facturesFournisseursDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    confirmDialog(
      'Les factures fournisseurs déjà enregistrées (et le dossier d’attente des imports en cours) seront déplacées vers ce nouveau répertoire. Continuer ?',
      {okLabel:'Changer le répertoire'}
    ).then(function(ok){
      if(!ok) return;
      var btn = byId('sf-save-stockage');
      btn.disabled = true; btn.textContent = 'Déplacement en cours…';
      fetch('/api/facture-fournisseur/storage-dir', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){
        toast('Répertoire de stockage mis à jour', 'success');
        var actuel = byId('sf-stockage-actuel');
        if(actuel) actuel.textContent = 'Répertoire actuellement utilisé : '+(res.dir||'(répertoire par défaut de l’application)');
        scheduleRender();
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
      }).then(function(){
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  });
  byId('sf-save-stockage-clients').addEventListener('click', function(){
    var nouveauDir = byId('sf-stockage-dir-clients').value.trim();
    var ancienDir = c.facturesClientsDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    confirmDialog(
      'Les factures clients déjà importées (et le dossier d’attente des imports en cours) seront déplacées vers ce nouveau répertoire. Continuer ?',
      {okLabel:'Changer le répertoire'}
    ).then(function(ok){
      if(!ok) return;
      var btn = byId('sf-save-stockage-clients');
      btn.disabled = true; btn.textContent = 'Déplacement en cours…';
      fetch('/api/facture-client/storage-dir', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){
        toast('Répertoire de stockage mis à jour', 'success');
        var actuel = byId('sf-stockage-actuel-clients');
        if(actuel) actuel.textContent = 'Répertoire actuellement utilisé : '+(res.dir||'(répertoire par défaut de l’application)');
        scheduleRender();
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
      }).then(function(){
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  });
  byId('sf-save-stockage-cmd').addEventListener('click', function(){
    var nouveauDir = byId('sf-stockage-dir-cmd').value.trim();
    var ancienDir = c.commandesPiecesJointesDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    confirmDialog(
      'Les pièces jointes de contrats déjà enregistrées seront déplacées vers ce nouveau répertoire. Continuer ?',
      {okLabel:'Changer le répertoire'}
    ).then(function(ok){
      if(!ok) return;
      var btn = byId('sf-save-stockage-cmd');
      btn.disabled = true; btn.textContent = 'Déplacement en cours…';
      fetch('/api/commande-client/piece-jointe-storage-dir', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){
        toast('Répertoire de stockage mis à jour', 'success');
        var actuel = byId('sf-stockage-actuel-cmd');
        if(actuel) actuel.textContent = 'Répertoire actuellement utilisé : '+(res.dir||'(répertoire par défaut de l’application)');
        scheduleRender();
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
      }).then(function(){
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  });
  byId('sf-save-stockage-devis').addEventListener('click', function(){
    var nouveauDir = byId('sf-stockage-dir-devis').value.trim();
    var ancienDir = c.devisImportesDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    confirmDialog(
      'Les devis déjà importés (et le dossier d’attente des imports en cours) seront déplacés vers ce nouveau répertoire. Continuer ?',
      {okLabel:'Changer le répertoire'}
    ).then(function(ok){
      if(!ok) return;
      var btn = byId('sf-save-stockage-devis');
      btn.disabled = true; btn.textContent = 'Déplacement en cours…';
      fetch('/api/devis-import/storage-dir', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(res){
        toast('Répertoire de stockage mis à jour', 'success');
        var actuel = byId('sf-stockage-actuel-devis');
        if(actuel) actuel.textContent = 'Répertoire actuellement utilisé : '+(res.dir||'(répertoire par défaut de l’application)');
        scheduleRender();
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
      }).then(function(){
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  });
  byId('sf-save-source').addEventListener('click', function(){
    var nouveauDir = byId('sf-source-dir').value.trim();
    var ancienDir = c.facturesFournisseursSourceDir || '';
    if(nouveauDir === ancienDir){ toast('Aucun changement à enregistrer', ''); return; }
    var btn = byId('sf-save-source');
    btn.disabled = true;
    fetch('/api/facture-fournisseur/source-dir', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dir: nouveauDir})
    }).then(function(r){
      return r.text().then(function(text){
        var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
        if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
        return json;
      });
    }).then(function(res){
      toast('Dossier des factures à traiter mis à jour', 'success');
      var actuel = byId('sf-source-actuel');
      if(actuel) actuel.textContent = 'Dossier actuellement utilisé : '+(res.dir||'(aucun — bouton Traitement désactivé)');
      scheduleRender();
    }).catch(function(err){
      console.error(err); toast('Erreur : '+err.message, 'danger');
    }).then(function(){
      btn.disabled = false;
    });
  });
}

// V1.99 : "Utilisateurs" devient un ecran autonome (menu Administration,
// voir NAV/NAV_GROUPS) - reprend exactement le tableau et le bouton
// "Ajouter" qui vivaient jusqu'ici dans la carte "Utilisateurs" de
// l'ecran Parametres (renderSettings), simplement deplaces ici. Memes
// droits qu'avant (accessKey:'settings' sur l'entree NAV correspondante).
function renderUtilisateurs(mount, actions){
  actions.innerHTML = '<button type="button" class="btn btn-primary" id="util-add-user">'+ic('plus',15)+' Ajouter</button>';
  var usersRows = STATE.users.slice().sort(function(a,b){ return (a.nom||'').localeCompare(b.nom||''); }).map(function(u){
    return '<tr>'+
      '<td><div style="display:flex;align-items:center;gap:9px;"><div class="avatar" style="width:26px;height:26px;font-size:11px;">'+esc(initials(u.nom))+'</div>'+esc(u.nom)+'</div></td>'+
      '<td><span class="pill pill-primary">'+esc(roleLabel(u.role))+'</span></td>'+
      '<td class="muted">'+esc(u.email||'—')+'</td>'+
      '<td>'+(u.actif!==false? '<span class="pill pill-success">Actif</span>' : '<span class="pill pill-neutral">Inactif</span>')+'</td>'+
      '<td><div class="row-actions"><button type="button" class="iconbtn" data-edit-user="'+u.id+'">'+ic('pencil',15)+'</button></div></td>'+
    '</tr>';
  }).join('');
  mount.innerHTML =
    '<div class="card card-pad">'+
      '<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Profil</th><th>Email</th><th>Statut</th><th></th></tr></thead><tbody>'+
        (usersRows||'<tr><td colspan="5" class="muted" style="text-align:center;padding:18px;">Aucun utilisateur.</td></tr>')+
      '</tbody></table></div>'+
      '<p class="hint" style="margin-top:10px;">Le rôle contrôle l’accès aux données (vérifié par le serveur à chaque requête, pas seulement par l’affichage des menus, voir claude/architecture-cloud-securite.md). Chaque utilisateur se connecte avec son email et son mot de passe personnel.</p>'+
    '</div>';
  byId('util-add-user').addEventListener('click', function(){ openUserFormModal(null); });
  mount.querySelectorAll('[data-edit-user]').forEach(function(b){ b.addEventListener('click', function(){
    openUserFormModal(STATE.users.find(function(u){ return u.id===b.getAttribute('data-edit-user'); }));
  }); });
}


/* =========================================================
   DROITS D'ACCES (V3.54) : matrice profils x menus/donnees
   Niveaux : Aucun (menu invisible, donnees inaccessibles) / Lecture / Lecture-écriture.
   Le serveur applique la matrice a chaque requete (backend/access.py).
   ========================================================= */
var DROITS = {profiles:null, sections:null, dirty:false, erreur:null};
function chargerDroits(){
  DROITS.erreur = null;
  return fetch('/api/auth/access-profiles').then(function(r){
    return r.json().then(function(b){ if(!r.ok) throw new Error(b.error||('HTTP '+r.status)); return b; });
  }).then(function(b){
    DROITS.profiles = b.profiles; DROITS.sections = b.sections; DROITS.dirty = false;
  }).catch(function(e){ DROITS.erreur = e.message; });
}
function recharcherMatriceCourante(){
  return fetch('/api/auth/access-matrix').then(function(r){ return r.json(); }).then(function(res){
    Object.keys(ACCESS).forEach(function(k){ delete ACCESS[k]; });
    Object.assign(ACCESS, (res && res.access) || {});
    chargerProfilsRoles(res);
  });
}
function renderDroitsAcces(mount, actions){
  if(!isAdmin()){ mount.innerHTML = '<p class="hint">Réservé à l’administrateur.</p>'; return; }
  if(!DROITS.profiles && !DROITS.erreur){
    mount.innerHTML = '<p class="hint">Chargement…</p>';
    chargerDroits().then(function(){ scheduleRender(); });
    return;
  }
  if(DROITS.erreur){ mount.innerHTML = '<div class="card card-pad"><p class="hint">Erreur : '+esc(DROITS.erreur)+'</p></div>'; return; }
  var profils = DROITS.profiles, sections = DROITS.sections;
  actions.innerHTML =
    '<button type="button" class="btn" id="dr-reset">Valeurs par défaut</button> '+
    '<button type="button" class="btn" id="dr-add">'+ic('plus',15)+' Nouveau profil</button> '+
    '<button type="button" class="btn btn-primary" id="dr-save"'+(DROITS.dirty?'':' disabled')+'>Enregistrer</button>';
  var colonnes = profils;
  var html = '<div class="card card-pad"><p class="hint" style="margin-top:0;">Pour chaque menu, choisissez le niveau d’accès de chaque profil : <b>Aucun</b> (le menu n’apparaît pas et le serveur refuse l’accès aux données), <b>Lecture</b> (consultation seule, tous les boutons de modification sont masqués) ou <b>Écriture</b> (lecture et modification). Le profil Administrateur a toujours tous les droits. Les changements s’appliquent à la prochaine connexion des utilisateurs concernés.</p>'+
    '<div class="table-wrap" style="overflow-x:auto;"><table><thead><tr><th style="min-width:230px;">Menu / donnée</th>'+
    colonnes.map(function(p){
      var fixe = p.id==='admin';
      return '<th style="min-width:120px;text-align:center;">'+esc(p.label)+
        (fixe ? '<div class="hint" style="margin:0;font-weight:400;">non modifiable</div>' :
          '<div style="margin-top:3px;"><button type="button" class="iconbtn" data-dr-ren="'+esc(p.id)+'" title="Renommer">'+ic('pencil',13)+'</button>'+
          (p.builtin ? '' : ' <button type="button" class="iconbtn" data-dr-del="'+esc(p.id)+'" title="Supprimer ce profil">'+ic('trash',13)+'</button>')+'</div>')+'</th>';
    }).join('')+'</tr></thead><tbody>';
  var groupe = '';
  sections.forEach(function(sec){
    if(sec.group!==groupe){
      groupe = sec.group;
      html += '<tr><td colspan="'+(colonnes.length+1)+'" style="background:var(--surface-3);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;">'+esc(groupe)+'</td></tr>';
    }
    html += '<tr><td>'+esc(sec.label)+'</td>'+colonnes.map(function(p){
      var v = (p.levels && p.levels[sec.id]) || 'none';
      if(p.id==='admin') return '<td style="text-align:center;"><span class="pill pill-success">Écriture</span></td>';
      var couleur = v==='full' ? 'var(--success-soft)' : (v==='read' ? 'var(--warning-soft)' : 'var(--surface-3)');
      return '<td style="text-align:center;padding:4px;"><select class="dr-sel" data-p="'+esc(p.id)+'" data-s="'+esc(sec.id)+'" style="width:auto;min-width:100px;background:'+couleur+';">'+
        '<option value="none"'+(v==='none'?' selected':'')+'>Aucun</option>'+
        '<option value="read"'+(v==='read'?' selected':'')+'>Lecture</option>'+
        '<option value="full"'+(v==='full'?' selected':'')+'>Écriture</option></select></td>';
    }).join('')+'</tr>';
  });
  html += '</tbody></table></div>'+
    '<p class="hint" style="margin-top:10px;">À savoir : une section en lecture seule masque les boutons d’ajout, de modification et de suppression ; une section sans accès retire le menu. Le numéro officiel d’un devis, contrat ou commande ne reste modifiable que par l’administrateur. Quand l’application tourne en mode mono-poste sans connexion, ces droits ne s’appliquent pas (voir la documentation de mise en production).</p></div>';
  mount.innerHTML = html;
  function marquerModifie(){ DROITS.dirty = true; var b = byId('dr-save'); if(b) b.disabled = false; }
  mount.querySelectorAll('.dr-sel').forEach(function(sel){
    sel.addEventListener('change', function(){
      var p = DROITS.profiles.find(function(x){ return x.id===sel.getAttribute('data-p'); });
      if(!p) return; p.levels = p.levels || {}; p.levels[sel.getAttribute('data-s')] = sel.value;
      sel.style.background = sel.value==='full' ? 'var(--success-soft)' : (sel.value==='read' ? 'var(--warning-soft)' : 'var(--surface-3)');
      marquerModifie();
    });
  });
  mount.querySelectorAll('[data-dr-ren]').forEach(function(b){ b.addEventListener('click', function(){
    var p = DROITS.profiles.find(function(x){ return x.id===b.getAttribute('data-dr-ren'); });
    var nom = window.prompt('Nom du profil', p.label);
    if(nom && nom.trim()){ p.label = nom.trim(); DROITS.dirty = true; scheduleRender(); }
  }); });
  mount.querySelectorAll('[data-dr-del]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-dr-del');
    var utilise = STATE.users.some(function(u){ return u.role===id; });
    if(utilise){ toast('Des utilisateurs ont ce profil : changez leur profil avant de le supprimer', 'danger'); return; }
    confirmDialog('Supprimer ce profil ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      DROITS.profiles = DROITS.profiles.filter(function(x){ return x.id!==id; }); DROITS.dirty = true; scheduleRender();
    });
  }); });
  byId('dr-add').addEventListener('click', function(){
    var overlay = openModal({
      title: 'Nouveau profil',
      body: '<div class="field"><label for="drn-nom">Nom du profil</label><input id="drn-nom" placeholder="ex. Dessinateur"></div>'+
        '<div class="field"><label for="drn-copie">Copier les droits de</label><select id="drn-copie"><option value="">— Aucun droit au départ —</option>'+
        DROITS.profiles.filter(function(p){ return p.id!=='admin'; }).map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.label)+'</option>'; }).join('')+'</select></div>',
      foot: '<button type="button" class="btn" data-close-modal>Annuler</button><button type="button" class="btn btn-primary" id="drn-ok">Créer</button>'
    });
    overlay.querySelector('#drn-ok').addEventListener('click', function(){
      var nom = byId('drn-nom').value.trim();
      if(!nom){ toast('Le nom est obligatoire', 'danger'); return; }
      var id = nom.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'profil';
      var base = id, n = 2; while(DROITS.profiles.some(function(p){ return p.id===id; })) id = base+'_'+(n++);
      var src = DROITS.profiles.find(function(p){ return p.id===byId('drn-copie').value; });
      DROITS.profiles.push({id:id, label:nom, builtin:false, levels: src ? JSON.parse(JSON.stringify(src.levels)) : {}});
      DROITS.dirty = true; closeModal(); scheduleRender();
    });
  });
  byId('dr-save').addEventListener('click', function(){
    fetch('/api/auth/access-profiles', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({profiles:DROITS.profiles})})
      .then(function(r){ return r.json().then(function(b){ if(!r.ok) throw new Error(b.error||('HTTP '+r.status)); return b; }); })
      .then(function(b){
        DROITS.profiles = b.profiles; DROITS.dirty = false;
        return recharcherMatriceCourante();
      }).then(function(){ toast('Droits d’accès enregistrés', 'success'); scheduleRender(); })
      .catch(function(e){ console.error(e); toast('Erreur : '+e.message, 'danger'); });
  });
  byId('dr-reset').addEventListener('click', function(){
    confirmDialog('Revenir aux profils et droits par défaut de l’application ? Vos profils personnalisés seront perdus.', {danger:true, okLabel:'Réinitialiser'}).then(function(ok){
      if(!ok) return;
      fetch('/api/auth/access-profiles/reset', {method:'POST'})
        .then(function(r){ return r.json().then(function(b){ if(!r.ok) throw new Error(b.error||('HTTP '+r.status)); return b; }); })
        .then(function(){ return chargerDroits(); }).then(recharcherMatriceCourante)
        .then(function(){ toast('Droits réinitialisés', 'success'); scheduleRender(); })
        .catch(function(e){ toast('Erreur : '+e.message, 'danger'); });
    });
  });
}

// V1.99 : "Modules installés sur ce poste" devient aussi un ecran autonome
// du menu Administration - reprend exactement le contenu et la logique qui
// vivaient dans la carte du meme nom dans Parametres (renderSettings),
// simplement deplaces ici (meme cache MODULES_INFO/loadModulesInfo).
function renderModulesInstalles(mount, actions){
  loadModulesInfo();
  var modulesInfo = MODULES_INFO.data;
  mount.innerHTML =
    '<div class="card card-pad">'+
      (!modulesInfo ?
        '<p class="hint">'+(MODULES_INFO.error? 'Erreur de chargement : '+esc(MODULES_INFO.error) : 'Chargement…')+'</p>'
      :
        '<p class="hint" style="margin-bottom:12px;">Décochez un module pour le retirer entièrement de cette installation : son menu disparaît et ses données ne sont plus accessibles, y compris pour un administrateur, y compris par un appel direct à l’API — aussi strict qu’un refus de rôle. Rien n’est supprimé : les données déjà saisies restent en base, invisibles tant que le module reste décoché. Tableau de bord et Paramètres restent toujours accessibles, pour pouvoir revenir ici réactiver un module à tout moment.</p>'+
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">'+
          modulesInfo.map(function(m){
            return '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">'+
              // width:auto/flex force ici : la regle globale "input,select,
              // textarea{width:100%}" (style.css) s'appliquait sinon aussi a
              // cette case a cocher, qui se retrouvait etiree sur presque
              // toute la largeur de la ligne flex (repoussant le libelle
              // tout a droite) - invisible dans l'ancienne carte etroite de
              // Parametres (grille a 2 colonnes), mais flagrant maintenant
              // que cet ecran occupe toute la largeur de la page.
              '<input type="checkbox" data-module-toggle="'+esc(m.id)+'" '+(m.actif?'checked':'')+((m.bloquePar&&m.bloquePar.length)?' disabled':'')+' style="margin-top:3px;width:auto;flex:0 0 auto;">'+
              '<span>'+esc(m.label)+
                ((m.requiert&&m.requiert.length)? '<br><span class="hint" style="font-size:12px;">Nécessite : '+m.requiert.map(function(r){ return esc(r.label); }).join(', ')+'</span>' : '')+
                ((m.bloquePar&&m.bloquePar.length)? '<br><span class="hint" style="font-size:12px;color:var(--danger,#b42318);">Inactif : un module nécessaire est désactivé.</span>' : '')+
              '</span>'+
            '</label>';
          }).join('')+
        '</div>'+
        '<button type="button" class="btn btn-primary" id="sf-save-modules">Enregistrer</button>'
      )+
    '</div>';
  if(modulesInfo){
    byId('sf-save-modules').addEventListener('click', function(){
      var actifs = {};
      mount.querySelectorAll('[data-module-toggle]').forEach(function(cb){
        if(cb.disabled) return;
        actifs[cb.getAttribute('data-module-toggle')] = cb.checked;
      });
      var btn = byId('sf-save-modules');
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      fetch('/api/modules', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({modulesActifs: actifs})
      }).then(function(r){
        return r.text().then(function(text){
          var json = null; try{ json = text? JSON.parse(text) : null; }catch(ex){}
          if(!r.ok) throw new Error((json&&json.error) || ('Erreur HTTP '+r.status));
          return json;
        });
      }).then(function(){
        toast('Modules mis à jour — rechargement…', 'success');
        setTimeout(function(){ location.reload(); }, 900);
      }).catch(function(err){
        console.error(err); toast('Erreur : '+err.message, 'danger');
        btn.disabled = false; btn.textContent = 'Enregistrer';
      });
    });
  }
}

// V1.99 : gestion des tiers bancaires / fournisseurs, retiree de Parametres
// et deplacee derriere un bouton de l'ecran Relevés bancaires (demande
// explicite de l'utilisateur : "doit etre accessible a partir de la page
// Relevés bancaires"). Fenetre modale plutot que carte fixe (choix explicite
// de l'utilisateur, l'ecran Relevés bancaires ayant deja son propre tableau
// + un mode d'edition de rapprochement). Reprend exactement le tableau et
// les actions qui vivaient dans l'ancienne carte de Parametres. Chaque
// ajout/modification/suppression referme puis rouvre cette meme fenetre
// (via opts.onSaved sur openTiersFormModal, deja prevu pour ce genre
// d'enchainement) pour refleter l'etat a jour - voir le commentaire sur le
// setTimeout(...,0) dans onMount ci-dessous, necessaire car openTiersFormModal
// ferme sa propre fenetre juste APRES avoir appele onSaved.
function openTiersBancairesModal(){
  var tiersRows = STATE.tiersBancaires.slice().sort(function(a,b){ return (a.tiers||'').localeCompare(b.tiers||''); }).map(function(t){
    return '<tr>'+
      '<td class="muted">'+esc(t.motCle)+'</td>'+
      '<td>'+esc(t.tiers)+'</td>'+
      '<td>'+esc(t.type||'—')+'</td>'+
      '<td>'+(Number(t.tva)>0? '<span class="pill pill-primary">20%</span>' : '<span class="muted">Non assujetti</span>')+'</td>'+
      '<td><div class="row-actions">'+
        '<button type="button" class="iconbtn" data-edit-tiers="'+t.id+'">'+ic('pencil',15)+'</button>'+
        '<button type="button" class="iconbtn" data-delete-tiers="'+t.id+'">'+ic('trash',15)+'</button>'+
      '</div></td>'+
    '</tr>';
  }).join('');
  var overlay = openModal({
    title: 'Tiers bancaires / Fournisseurs',
    large: true,
    body:
      '<p class="hint" style="margin-bottom:10px;">Registre unique utilisé à la fois pour reconnaître automatiquement les lignes des relevés bancaires importés (mot-clé + type + TVA) et comme liste de fournisseurs pour le module Factures fournisseurs (raison sociale, ICE, adresse…) — une même fiche peut servir aux deux. Depuis la V1.53, chaque nouveau client ou membre du personnel est aussi ajouté ici automatiquement (type « Client »/« Salarié », nom seul — jamais le salaire), pour pouvoir reconnaître leurs mouvements dans les relevés bancaires.</p>'+
      '<div class="table-wrap"><table><thead><tr><th>Mot-clé</th><th>Tiers</th><th>Type</th><th>TVA</th><th></th></tr></thead><tbody>'+
        (tiersRows||'<tr><td colspan="5" class="muted" style="text-align:center;padding:18px;">Aucun tiers bancaire.</td></tr>')+
      '</tbody></table></div>',
    foot: '<button type="button" class="btn" data-close-modal>Fermer</button>'+
          '<button type="button" class="btn btn-primary" id="tb-add-tiers">'+ic('plus',13)+' Ajouter</button>',
    onMount: function(overlay){
      // Note : openTiersFormModal() ferme sa propre fenetre juste APRES avoir
      // appele opts.onSaved (voir doSaveTiers plus bas : onSaved puis
      // onDone -> closeModal()) - rouvrir cette liste de facon synchrone dans
      // onSaved serait donc immediatement refermé par ce closeModal() qui
      // suit. D'ou le setTimeout(...,0) : on attend que cette fermeture ait
      // deja eu lieu avant de rouvrir la liste a jour.
      // Par ailleurs, STATE.tiersBancaires n'est tenu a jour que par le
      // polling de 2s de subscribeCollection (voir plus haut) - a la
      // difference d'un ecran NAV normal (qui se re-affiche tout seul a
      // chaque nouveau polling tant qu'il reste ouvert), cette fenetre ne se
      // reconstruit pas toute seule une fois refermee/rouverte : sans ceci,
      // la liste rouverte juste apres un ajout/modif pourrait briévement
      // paraitre ne pas avoir pris en compte le changement. On fusionne donc
      // nous-memes la fiche renvoyee par le serveur (deja confirmee) dans
      // STATE.tiersBancaires avant de reconstruire cette fenetre - le
      // prochain polling se contentera de confirmer la meme chose.
      function fusionnerTiersLocal(saved){
        var idx = STATE.tiersBancaires.findIndex(function(t){ return t.id===saved.id; });
        if(idx>-1) STATE.tiersBancaires[idx] = saved; else STATE.tiersBancaires.push(saved);
      }
      overlay.querySelector('#tb-add-tiers').addEventListener('click', function(){
        openTiersFormModal(null, {onSaved: function(saved){ fusionnerTiersLocal(saved); setTimeout(openTiersBancairesModal, 0); }});
      });
      overlay.querySelectorAll('[data-edit-tiers]').forEach(function(b){ b.addEventListener('click', function(){
        openTiersFormModal(STATE.tiersBancaires.find(function(t){ return t.id===b.getAttribute('data-edit-tiers'); }), {onSaved: function(saved){ fusionnerTiersLocal(saved); setTimeout(openTiersBancairesModal, 0); }});
      }); });
      overlay.querySelectorAll('[data-delete-tiers]').forEach(function(b){ b.addEventListener('click', function(){
        var id = b.getAttribute('data-delete-tiers');
        confirmDialog('Supprimer ce tiers bancaire ? Les relevés déjà enregistrés ne sont pas modifiés.', {danger:true, okLabel:'Supprimer'}).then(function(ok){
          if(!ok) return;
          deleteTiersBancaire(id).then(function(){
            toast('Tiers supprimé', 'success');
            var idx = STATE.tiersBancaires.findIndex(function(t){ return t.id===id; });
            if(idx>-1) STATE.tiersBancaires.splice(idx, 1);
            openTiersBancairesModal();
          }).catch(function(e){ console.error(e); toast('Erreur', 'danger'); });
        });
      }); });
    }
  });
  return overlay;
}

// Repertoire "Fournisseurs" (menu principal, a l'instar de "Clients") :
// ajouter/modifier/supprimer un fournisseur directement, sans passer par
// Parametres. Vue filtree (type === 'Fournisseur') du meme registre fusionne
// Tiers bancaires / Fournisseurs que celui gere dans Parametres > Tiers
// bancaires (les deux ecrans lisent/ecrivent la meme collection
// 'tiersBancaires' ; une fiche creee ici y apparait aussi, et inversement).
var fournisseursFilter = '';
function renderFournisseurs(mount, actions){
  var canEdit = canWrite('fournisseurs');
  if(canEdit){
    actions.innerHTML =
      '<button type="button" class="btn btn-ghost" id="btn-export-fournisseurs">'+ic('download',15)+' Exporter Excel</button>'+
      '<button type="button" class="btn btn-ghost" id="btn-import-fournisseurs">'+ic('upload',15)+' Importer Excel</button>'+
      '<button type="button" class="btn btn-primary" id="btn-new-fournisseur">'+ic('plus',15)+' Nouveau fournisseur</button>';
    byId('btn-new-fournisseur').addEventListener('click', function(){ openTiersFormModal(null, {forceType:'Fournisseur'}); });
    byId('btn-export-fournisseurs').addEventListener('click', function(){ exportExcelList('fournisseurs'); });
    byId('btn-import-fournisseurs').addEventListener('click', function(){ openImportExcelModal('fournisseurs'); });
  }
  var allFournisseurs = STATE.tiersBancaires.filter(function(t){ return (t.type||'').trim().toLowerCase()==='fournisseur'; });
  var list = allFournisseurs.filter(function(t){
    if(!fournisseursFilter) return true;
    var q = fournisseursFilter.toLowerCase();
    return (t.tiers||'').toLowerCase().indexOf(q)>-1 || (t.ice||'').toLowerCase().indexOf(q)>-1 || (t.ville||'').toLowerCase().indexOf(q)>-1;
  }).sort(function(a,b){ return (a.tiers||'').localeCompare(b.tiers||''); });

  var doublonsFournisseurs = detecterDoublonsFournisseurs();

  var body =
    '<div class="section-head"><div class="toolbar">'+
      '<input type="search" id="fournisseur-search" placeholder="Rechercher un fournisseur…" value="'+esc(fournisseursFilter)+'">'+
      '<span class="muted" style="font-size:12.5px;">'+list.length+' fournisseur(s)</span>'+
    '</div></div>'+
    '<p class="hint" style="margin:-4px 0 12px;">Ce répertoire fait partie du registre partagé avec les mots-clés de rapprochement des relevés bancaires (visible aussi dans Paramètres > Tiers bancaires / Fournisseurs) : une fiche créée ici y apparaît également, et inversement.</p>';

  if(doublonsFournisseurs.length){
    body += doublonsBannerHtml(
      doublonsFournisseurs.length+' fournisseur(s) en double détecté(s) (même nom, créés avant l’activation de ce contrôle) :',
      doublonsFournisseurs.map(function(g){
        return '<li>« '+esc(g[0].tiers)+' » — '+g.length+' fiches'+(canEdit? ' : à fusionner manuellement (modifier chaque facture concernée pour les rattacher à une seule fiche, puis supprimer les autres).' : '.')+'</li>';
      }).join('')
    );
  }

  if(!allFournisseurs.length){
    body += emptyState('building', 'Aucun fournisseur enregistré pour le moment.', canEdit? '<button type="button" class="btn btn-primary" id="empty-new-fournisseur">'+ic('plus',15)+' Créer un fournisseur</button>' : '');
  } else if(!list.length){
    body += emptyState('search', 'Aucun résultat pour cette recherche.');
  } else {
    body += '<div class="table-wrap"><table><thead><tr><th>Fournisseur</th><th>ICE</th><th>Ville</th><th>Téléphone</th><th class="r">TVA</th><th></th></tr></thead><tbody>'+
      list.map(function(t){
        var nbFactures = STATE.facturesFournisseurs.filter(function(f){ return f.fournisseurId===t.id; }).length;
        return '<tr>'+
          '<td><b>'+esc(t.tiers)+'</b>'+(nbFactures?' <span class="muted" style="font-size:11.5px;">('+nbFactures+' facture(s))</span>':'')+'</td>'+
          '<td class="num muted">'+esc(t.ice||'—')+'</td>'+
          '<td>'+esc(t.ville||'—')+'</td>'+
          '<td class="num">'+esc(t.telephone||'—')+'</td>'+
          '<td class="r">'+(Number(t.tva)>0? '<span class="pill pill-primary">20%</span>' : '<span class="muted">—</span>')+'</td>'+
          '<td><div class="row-actions">'+
            (canEdit? '<button type="button" class="iconbtn" data-edit-fournisseur="'+t.id+'" title="Modifier">'+ic('pencil',15)+'</button>'+
            (fournisseurHasZonesModel(t.id)? '<button type="button" class="iconbtn" data-zones-fournisseur="'+t.id+'" title="Consulter le modèle de zones">'+ic('ruler',15)+'</button>' : '')+
            '<button type="button" class="iconbtn" data-delete-fournisseur="'+t.id+'" title="Supprimer">'+ic('trash',15)+'</button>' : '<span class="muted">—</span>')+
          '</div></td>'+
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  mount.innerHTML = body;

  var searchEl = byId('fournisseur-search');
  if(searchEl) searchEl.addEventListener('input', debounce(function(){
    fournisseursFilter = searchEl.value; renderFournisseurs(mount, actions);
    searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
  }, 220));
  var emptyBtn = byId('empty-new-fournisseur');
  if(emptyBtn) emptyBtn.addEventListener('click', function(){ openTiersFormModal(null, {forceType:'Fournisseur'}); });
  mount.querySelectorAll('[data-edit-fournisseur]').forEach(function(b){ b.addEventListener('click', function(){
    openTiersFormModal(STATE.tiersBancaires.find(function(t){ return t.id===b.getAttribute('data-edit-fournisseur'); }));
  }); });
  mount.querySelectorAll('[data-zones-fournisseur]').forEach(function(b){ b.addEventListener('click', function(){
    openZonesEditorForFournisseur(b.getAttribute('data-zones-fournisseur'));
  }); });
  mount.querySelectorAll('[data-delete-fournisseur]').forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-delete-fournisseur');
    var used = STATE.facturesFournisseurs.some(function(f){ return f.fournisseurId===id; });
    confirmDialog(used? 'Ce fournisseur est référencé sur des factures déjà enregistrées. Le supprimer quand même ?' : 'Supprimer définitivement ce fournisseur ?', {danger:true, okLabel:'Supprimer'}).then(function(ok){
      if(!ok) return;
      deleteTiersBancaire(id).then(function(){ toast('Fournisseur supprimé', 'success'); }).catch(function(e){ console.error(e); toast('Erreur de suppression', 'danger'); });
    });
  }); });
}

// Registre fusionne Tiers bancaires / Fournisseurs : le mot-cle/type/TVA
// servent au rapprochement des relevés bancaires, les champs societe
// (ICE, adresse...) a la fiche fournisseur utilisee par le module Factures
// fournisseurs - une meme fiche peut n'utiliser que l'un ou l'autre groupe.
// `opts.onSaved` (optionnel) est appele avec la fiche enregistree {id,...}
// juste apres la sauvegarde, pour une creation a la volee (ex. depuis
// l'écran d'import de factures) sans quitter l'écran en cours.
// `opts.presetNom` pre-remplit le nom/mot-clé, `opts.presetIce` pre-remplit
// l'ICE (ex. valeurs devinees depuis le contenu d'une facture importee).
function openTiersFormModal(t, opts){
  opts = opts || {};
  // Quand cette fenetre est ouverte depuis l'ecran de relecture d'import
  // (creation du fournisseur manquant pour une ligne), on a deja sous la
  // main la facture concernee : on peut alors proposer d'enchainer
  // directement sur l'editeur de modele de zones pour ce fournisseur, sans
  // repasser par l'ecran de relecture (voir openZonesEditorModal plus bas,
  // qui reste la seule logique d'extraction/sauvegarde des zones - cette
  // fenetre ne fait qu'enregistrer le fournisseur puis l'ouvrir a sa suite).
  var zonesLigne = opts.zonesLigne;
  var showZonesBtn = !!(zonesLigne && /\.pdf$/i.test(zonesLigne.fileName||''));
  var overlay = openModal({
    title: t ? 'Modifier le tiers / fournisseur' : 'Nouveau tiers / fournisseur',
    large: true,
    body:
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-tiers">Nom (raison sociale)</label><input id="tf-tiers" required value="'+esc(t?t.tiers:(opts.presetNom||''))+'"></div>'+
        '<div class="field"><label for="tf-motcle">Mot-clé de reconnaissance (relevés bancaires)</label><input id="tf-motcle" value="'+esc(t?t.motCle||'':'')+'" placeholder="laisser vide pour reprendre le nom"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-type">Type</label><input id="tf-type" value="'+esc(t?t.type||'':(opts.forceType||'Fournisseur'))+'"></div>'+
        '<div class="field" style="display:flex;align-items:flex-end;">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:9px;"><input type="checkbox" id="tf-tva" style="width:auto;" '+(t? (Number(t.tva)>0?'checked':'') : 'checked')+'> Soumis à la TVA à 20%</label>'+
        '</div>'+
      '</div>'+
      '<p class="hint" style="margin:4px 0 10px;">Le mot-clé et la TVA ci-dessus servent au rapprochement automatique des relevés bancaires. Les champs ci-dessous (facultatifs) servent de fiche fournisseur pour le module Factures fournisseurs.</p>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-ice">ICE</label><input id="tf-ice" value="'+esc(t?t.ice||'':(opts.presetIce||''))+'"></div>'+
        '<div class="field"><label for="tf-if">Identifiant fiscal (IF)</label><input id="tf-if" value="'+esc(t?t.identifiantFiscal||'':'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-rc">RC</label><input id="tf-rc" value="'+esc(t?t.rc||'':'')+'"></div>'+
        '<div class="field"><label for="tf-patente">Patente</label><input id="tf-patente" value="'+esc(t?t.patente||'':'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="tf-adresse">Adresse</label><textarea id="tf-adresse">'+esc(t?t.adresse||'':'')+'</textarea></div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-ville">Ville</label><input id="tf-ville" value="'+esc(t?t.ville||'':'')+'"></div>'+
        '<div class="field"><label for="tf-telephone">Téléphone</label><input id="tf-telephone" value="'+esc(t?t.telephone||'':'')+'"></div>'+
      '</div>'+
      '<div class="field-row grid-2">'+
        '<div class="field"><label for="tf-email">Email</label><input id="tf-email" type="email" value="'+esc(t?t.email||'':'')+'"></div>'+
        '<div class="field"><label for="tf-contact">Personne à contacter</label><input id="tf-contact" value="'+esc(t?t.contact||'':'')+'"></div>'+
      '</div>'+
      '<div class="field"><label for="tf-notes">Notes</label><textarea id="tf-notes">'+esc(t?t.notes||'':'')+'</textarea></div>'+
      (showZonesBtn? '<p class="hint" style="margin:10px 0 0;">Vous pouvez aussi enregistrer ce fournisseur et définir dans la foulée, sur la facture « '+esc(zonesLigne.fileName||'')+' » déjà importée, les zones où se trouvent ses champs (numéro, date, montants...) — voir le bouton ci-dessous.</p>' : ''),
    foot: '<button type="button" class="btn" data-close-modal>Annuler</button>'+
          (showZonesBtn? '<button type="button" class="btn" id="tf-save-zones">'+ic('ruler',13)+' Enregistrer et définir un modèle de zones</button>' : '')+
          '<button type="button" class="btn btn-primary" id="tf-save">Enregistrer</button>'
  });

  function readTiersForm(){
    var tiers = byId('tf-tiers').value.trim();
    if(!tiers) return null;
    var motCle = byId('tf-motcle').value.trim() || tiers;
    return {
      motCle:motCle, tiers:tiers, type:byId('tf-type').value.trim(), tva: byId('tf-tva').checked?0.2:null,
      ice:byId('tf-ice').value.trim(), identifiantFiscal:byId('tf-if').value.trim(),
      rc:byId('tf-rc').value.trim(), patente:byId('tf-patente').value.trim(),
      adresse:byId('tf-adresse').value.trim(), ville:byId('tf-ville').value.trim(),
      telephone:byId('tf-telephone').value.trim(), email:byId('tf-email').value.trim(),
      contact:byId('tf-contact').value.trim(), notes:byId('tf-notes').value.trim()
    };
  }
  // Enregistre le fournisseur (creation ou modification) puis appelle
  // `onDone(saved)` avec l'enregistrement complet (id inclus) - factorise
  // pour etre utilise aussi bien par le bouton "Enregistrer" normal que par
  // "Enregistrer et definir un modele de zones" ci-dessous.
  function doSaveTiers(onDone){
    var data = readTiersForm();
    if(!data){ toast('Le nom est obligatoire', 'danger'); return; }
    // RG : un fournisseur doit etre unique (meme nom, insensible a la casse
    // et aux accents) - verifie uniquement parmi les autres fiches de type
    // "Fournisseur" (une fiche "Client" homonyme reste autorisee).
    if((data.type||'').trim().toLowerCase()==='fournisseur'){
      var nomNorm = normNomTiers(data.tiers);
      var doublon = STATE.tiersBancaires.find(function(x){
        return (!t || x.id!==t.id) && (x.type||'').trim().toLowerCase()==='fournisseur' && normNomTiers(x.tiers)===nomNorm;
      });
      if(doublon){
        toast('Un fournisseur du même nom existe déjà : « '+doublon.tiers+' ». Sélectionnez-le au lieu d’en créer un autre.', 'danger');
        return;
      }
    }
    saveTiersBancaire(data, t?t.id:null).then(function(res){
      var saved = Object.assign({id: t?t.id:(res&&res.id)}, data);
      if(opts.onSaved) opts.onSaved(saved);
      onDone(saved);
    }).catch(function(err){ console.error(err); toast('Erreur d’enregistrement', 'danger'); });
  }

  overlay.querySelector('#tf-save').addEventListener('click', function(){
    doSaveTiers(function(){ closeModal(); toast('Tiers / fournisseur enregistré', 'success'); });
  });
  var zonesBtn = overlay.querySelector('#tf-save-zones');
  if(zonesBtn){
    zonesBtn.addEventListener('click', function(){
      doSaveTiers(function(saved){
        toast('Tiers / fournisseur enregistré', 'success');
        // openZonesEditorModal ouvre sa propre fenetre, ce qui ferme
        // automatiquement celle-ci (openModal() ferme toujours la fenetre
        // active avant d'en ouvrir une nouvelle) - le fournisseur venant
        // d'etre enregistre, le modele de zones dessine ensuite s'enregistre
        // directement sur sa fiche.
        openZonesEditorModal(Object.assign({}, zonesLigne, {fournisseurId: saved.id}));
      });
    });
  }
}

/* =========================================================
   IMPRESSION / EXPORT PDF (via impression navigateur)
   ========================================================= */
// En-tete complet : logo + mentions legales + reference (colonne gauche) /
// date + titre + numero + bloc client avec adresse (colonne droite), suivis
// d'un filet horizontal avant le tableau des lignes. Structure calee sur un
// modele reel fourni par l'utilisateur (facture Futura Expertise -> JESA) :
// la reference et le bloc client ne sont plus sur une ligne separee, mais
// integres directement dans les 2 colonnes de l'en-tete.
function printLetterhead(docTitle, numero, revision, dateStr, referenceValue, referenceLabel, client){
  var c = STATE.company;
  var legal1 = [c.rc?'RC: '+c.rc:'', c.ice?'ICE: '+c.ice:''].filter(Boolean).join('   ');
  var legal2 = [c.identifiantFiscal?'IF: '+c.identifiantFiscal:'', c.patente?'Patente: '+c.patente:'', c.cnss?'CNSS '+c.cnss:''].filter(Boolean).join('   ');
  var adresseLignes = (c.adresse||'').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  var adresseHtml = adresseLignes.map(function(ligne, i){ return '<div>'+(i===0?'Adresse: ':'')+esc(ligne)+'</div>'; }).join('');
  // La ville n'est ajoutee que si elle n'est pas deja presente dans la derniere
  // ligne de l'adresse (evite le doublon "...CASABLANCA" / "CASABLANCA").
  var adresseLastLine = adresseLignes.length ? adresseLignes[adresseLignes.length-1].toLowerCase() : '';
  var villeHtml = (c.ville && adresseLastLine.indexOf(c.ville.toLowerCase())===-1) ? '<div>'+esc(c.ville)+'</div>' : '';
  var logoHtml = c.logo
    ? '<img class="print-logo-img" src="'+c.logo+'" alt="'+esc(c.nom||'')+'">'
    : '<div class="print-logo-text">'+esc(c.nom||'Chantier ERP')+'</div>';

  var refLbl = referenceLabel ? (referenceLabel+' : ') : 'Référence: ';
  var refHtml = referenceValue ? '<div class="print-ref"><span class="lbl">'+esc(refLbl)+'</span><span class="val">'+esc(referenceValue)+'</span></div>' : '';

  client = client || {};
  var clientAdresseLignes = (client.adresse||'').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  var clientLastLine = clientAdresseLignes.length ? clientAdresseLignes[clientAdresseLignes.length-1].toLowerCase() : '';
  var clientVilleHtml = (client.ville && clientLastLine.indexOf(client.ville.toLowerCase())===-1) ? '<div>'+esc(client.ville)+'</div>' : '';
  var clientHtml = '';
  if(client.nom){
    clientHtml = '<div class="print-client">'+
      '<div><span class="lbl">Client : </span><span class="val">'+esc(client.nom)+'</span></div>'+
      clientAdresseLignes.map(function(l){ return '<div>'+esc(l)+'</div>'; }).join('')+
      clientVilleHtml+
      (client.ice?'<div><span class="lbl">ICE : </span><span class="val">'+esc(client.ice)+'</span></div>':'')+
    '</div>';
  }

  return '<div class="print-head">'+
      '<div class="print-head-left">'+
        '<div class="print-logo">'+logoHtml+'</div>'+
        '<div class="print-legal">'+
          (legal1?'<div>'+esc(legal1)+'</div>':'')+
          (legal2?'<div>'+esc(legal2)+'</div>':'')+
          adresseHtml + villeHtml+
        '</div>'+
        refHtml+
      '</div>'+
      '<div class="print-head-right">'+
        '<div class="print-date">'+esc(c.ville||'Casablanca')+' le : <b>'+fmtDate(dateStr)+'</b></div>'+
        '<div class="print-doctitle">'+esc(docTitle)+'</div>'+
        '<div class="print-docnum">Numéro: <b>'+esc(numero)+'</b></div>'+
        ((revision && revision!=='00' && revision!=='0')?'<div class="print-docrev">Rév. '+esc(revision)+'</div>':'')+
        clientHtml+
      '</div>'+
    '</div>'+
    '<div class="print-head-sep"></div>';
}
function printColgroup(cols){
  return '<colgroup>'+cols.map(function(c){ return '<col style="width:'+(c.width||0)+'%;">'; }).join('')+'</colgroup>';
}
function printLastColsWidth(cols, n){
  return cols.slice(-n).reduce(function(sum, c){ return sum+(c.width||0); }, 0);
}
// Repartition interne (%) du bloc totaux entre sa colonne "libelle" et sa
// colonne "valeur", proportionnelle aux largeurs reelles des 2 dernieres
// colonnes du tableau des lignes (elles ne sont pas toujours egales, ex.
// l'attachement) afin que le trait vertical interne tombe exactement sur
// la frontiere entre ces 2 colonnes.
function printLastColsSplit(cols, n){
  var last = cols.slice(-n);
  var total = last.reduce(function(sum, c){ return sum+(c.width||0); }, 0) || 1;
  return last.map(function(c){ return (c.width||0)/total*100; });
}
function printLignesTable(lignes, cols){
  var head = cols.map(function(c){ return '<th>'+esc(c.label)+'</th>'; }).join('');
  var rows = (lignes||[]).map(function(l){
    return '<tr>'+cols.map(function(c){ return '<td>'+c.value(l)+'</td>'; }).join('')+'</tr>';
  }).join('');
  return '<table>'+printColgroup(cols)+'<thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';
}
function printDesignation(v){
  return esc(v||'').split('\n').join('<br>');
}
function printTotalsRows(rows){
  return rows.map(function(r){
    return '<tr'+(r.cls?' class="'+r.cls+'"':'')+'><td>'+esc(r.label)+'</td><td>'+r.value+'</td></tr>';
  }).join('');
}
// Bloc "cle/valeur" pour les documents non itemises (Contrat, Avenant) : pas
// de tableau de lignes ni de totaux, juste une liste d'informations suivie
// des notes, dans le meme gabarit d'en-tete/pied que les autres documents.
function printInfoRows(rows){
  return '<table class="print-info-table"><colgroup><col style="width:32%;"><col style="width:68%;"></colgroup><tbody>'+
    rows.filter(function(r){ return r && r.value; }).map(function(r){
      return '<tr><td class="lbl">'+esc(r.label)+'</td><td>'+esc(r.value)+'</td></tr>';
    }).join('')+
  '</tbody></table>';
}
function printNotesBlock(notes){
  var body = (notes||'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean)
    .map(function(l){ return '<div>- '+esc(l)+'</div>'; }).join('');
  if(!body) return '';
  return '<div class="print-conditions" style="margin-top:16px;"><div class="cond-title">Notes :</div><div class="cond-body">'+body+'</div></div>';
}
function printBottom(notes, totalsRowsHtml, totalsWidthPct, colSplit){
  var body = (notes||'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean)
    .map(function(l){ return '<div>- '+esc(l)+'</div>'; }).join('');
  // La largeur (%) est posée sur le conteneur (.print-totals), pas sur le
  // <table> : un % sur le <table> lui-même se résout contre un parent flex
  // sans largeur propre (indéterminée), ce qui l'ignore. Le conteneur, lui,
  // a une largeur déterminée (celle de .print-bottom), donc son flex-basis
  // en % s'applique correctement.
  var widthStyle = totalsWidthPct ? ' style="flex:0 0 '+totalsWidthPct+'%; width:'+totalsWidthPct+'%;"' : '';
  var split = (colSplit && colSplit.length===2) ? colSplit : [50,50];
  return '<div class="print-bottom">'+
    '<div class="print-conditions">'+
      '<div class="cond-title">Conditions et modalités de paiement :</div>'+
      (body?'<div class="cond-body">'+body+'</div>':'')+
    '</div>'+
    '<div class="print-totals"'+widthStyle+'><table>'+
      '<colgroup><col style="width:'+split[0]+'%;"><col style="width:'+split[1]+'%;"></colgroup>'+
      totalsRowsHtml+
    '</table></div>'+
  '</div>';
}
// Largeurs de colonnes (%) calées sur le modèle fourni par l'utilisateur : le
// bloc totaux (voir printLastColsWidth) doit occuper exactement la largeur
// cumulée des 2 dernières colonnes, pour que ses traits verticaux tombent en
// face de ceux du tableau.
var PRINT_COLS_SIMPLE = [
  {label:'Qté', width:6, value:function(l){return fmtQty(l.qte);}},
  {label:'U', width:6, value:function(l){return esc(l.unite);}},
  {label:'DESIGNATION', width:50, value:function(l){return printDesignation(l.designation);}},
  {label:'PRIX UNIT HT', width:19, value:function(l){return fmtMoney2(l.pu);}},
  {label:'MONTANT HT', width:19, value:function(l){return fmtMoney2(ligneMontant(l));}}
];
var PRINT_COLS_ATT = [
  {label:'Qté marché', width:9, value:function(l){return fmtQty(l.qteMarche);}},
  {label:'U', width:5, value:function(l){return esc(l.unite);}},
  {label:'DESIGNATION', width:27, value:function(l){return printDesignation(l.designation);}},
  {label:'P.U.', width:10, value:function(l){return fmtMoney2(l.pu);}},
  {label:'Qté antér.', width:10, value:function(l){return fmtQty(l.qteAnterieure);}},
  {label:'Qté période', width:10, value:function(l){return fmtQty(l.qtePeriode);}},
  {label:'Qté cumulée', width:10, value:function(l){return fmtQty(attLigneCumul(l).qteCumulee);}},
  {label:'Mnt période', width:19, value:function(l){return fmtMoney2(attLigneCumul(l).montantPeriode);}}
];
var PRINT_COLS_BORDEREAU = [
  {label:'Code', width:22, value:function(l){return esc(l.livCode||'');}},
  {label:'Désignation', width:38, value:function(l){return printDesignation(l.livDesignation);}},
  {label:'Indice', width:12, value:function(l){return esc(l.indice||'');}},
  {label:'État de transmission', width:28, value:function(l){return esc(statutMeta(BORDEREAU_ETATS, l.etat).label);}}
];

function buildPrintHTML(type, doc){
  if(type==='devis'){
    var client = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    var t = calcDocTotals(doc.lignes, doc.tauxTVA, doc.remise);
    var totalsRows = [{label:'TOTAL HT', value:fmtMoney(t.ht), cls:'tot-first'}];
    if(t.remise) totalsRows.push({label:'Remise', value:'- '+fmtMoney(t.remise)});
    totalsRows.push({label:'TVA', value:fmtMoney(t.tva)});
    totalsRows.push({label:'TOTAL TTC', value:fmtMoney(t.ttc), cls:'tot-last'});
    return '<div class="print-doc">'+
      printLetterhead('Devis', doc.numero, doc.revision, doc.date, doc.reference, null, client.nom?client:{nom:doc.clientNom||''})+
      printLignesTable(doc.lignes, PRINT_COLS_SIMPLE)+
      printBottom(doc.notes, printTotalsRows(totalsRows), printLastColsWidth(PRINT_COLS_SIMPLE, 2), printLastColsSplit(PRINT_COLS_SIMPLE, 2))+
    '</div>';
  }
  if(type==='ctr'){
    var clientCtr = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    var clientCtrObj = clientCtr.nom?clientCtr:{nom:doc.clientNom||''};
    if(doc.lignes && doc.lignes.length){
      // V2.14 : le contrat reprend le gabarit chiffre de l'ancienne Commande
      // client (lignes + totaux), puisqu'il en porte desormais les lignes.
      var tc = calcDocTotals(doc.lignes, doc.tauxTVA, 0);
      var totalsRowsCtr = [
        {label:'TOTAL HT', value:fmtMoney(tc.ht), cls:'tot-first'},
        {label:'TVA', value:fmtMoney(tc.tva)},
        {label:'TOTAL TTC', value:fmtMoney(tc.ttc), cls:'tot-last'}
      ];
      return '<div class="print-doc">'+
        printLetterhead('Contrat', doc.numero, doc.revision, doc.date, doc.referenceContrat, 'Réf. client', clientCtrObj)+
        printLignesTable(doc.lignes, PRINT_COLS_SIMPLE)+
        printBottom(doc.notes, printTotalsRows(totalsRowsCtr), printLastColsWidth(PRINT_COLS_SIMPLE, 2), printLastColsSplit(PRINT_COLS_SIMPLE, 2))+
      '</div>';
    }
    // Contrat anterieur a la V2.14, sans lignes : ancien gabarit compact.
    return '<div class="print-doc print-doc-compact">'+
      printLetterhead('Contrat', doc.numero, doc.revision, doc.date, doc.referenceContrat, 'Réf. client', clientCtrObj)+
      printInfoRows([
        {label:'Objet', value:doc.objet},
        {label:'Montant contractuel', value:(doc.montant!==undefined&&doc.montant!==null&&doc.montant!=='')?fmtMoney(doc.montant):''},
        {label:'Statut', value:statutMeta(CTR_STATUTS, doc.statut).label},
        {label:'Avenants émis', value:String(doc.avSeq||0)},
        {label:'Attachements émis', value:String(doc.attSeq||0)}
      ])+
      printNotesBlock(doc.notes)+
    '</div>';
  }
  if(type==='av'){
    var clientAv = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    return '<div class="print-doc print-doc-compact">'+
      printLetterhead('Avenant', doc.numero, null, doc.date, doc.ctrNumero, 'Contrat', clientAv.nom?clientAv:{nom:doc.clientNom||''})+
      printInfoRows([
        {label:'Objet', value:doc.objet},
        {label:'Impact montant HT', value:doc.montantImpact?fmtMoney(doc.montantImpact):''},
        {label:'Impact délai', value:doc.delaiImpactJours?(doc.delaiImpactJours+' jour(s)'):''},
        {label:'Statut', value:statutMeta(AV_STATUTS, doc.statut).label}
      ])+
      printNotesBlock(doc.notes)+
    '</div>';
  }
  if(type==='bor'){
    // V1.60 : pas de montants/totaux (document non commercial) - gabarit
    // "compact" comme Contrat/Avenant, infos cle/valeur + tableau des
    // documents transmis, sans printBottom (son "Conditions et modalites de
    // paiement" ne conviendrait pas ici).
    var clientBor = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    return '<div class="print-doc print-doc-compact">'+
      printLetterhead('Bordereau de transmission', doc.numero, null, doc.date, doc.ctrNumero, 'Contrat', clientBor.nom?clientBor:{nom:doc.clientNom||''})+
      printInfoRows([
        {label:'Destinataire', value: doc.destNom},
        {label:'Catégorie destinataire', value: doc.destCategorie}
      ])+
      printLignesTable(doc.lignes, PRINT_COLS_BORDEREAU)+
      printNotesBlock(doc.notes)+
    '</div>';
  }
  if(type==='att'){
    var t3 = attTotals(doc);
    var totalsRows3 = [
      {label:'MONTANT HT (période)', value:fmtMoney(t3.periodeHT), cls:'tot-first'},
      {label:'TVA', value:fmtMoney(t3.tva)},
      {label:'TOTAL TTC (période)', value:fmtMoney(t3.ttc), cls:'tot-last'}
    ];
    var clientAtt = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    return '<div class="print-doc">'+
      printLetterhead('Attachement de chantier', doc.numero, doc.revision, doc.date, doc.ctrNumero, 'Contrat', clientAtt.nom?clientAtt:{nom:doc.clientNom||''})+
      printLignesTable(doc.lignes, PRINT_COLS_ATT)+
      printBottom(doc.notes, printTotalsRows(totalsRows3), printLastColsWidth(PRINT_COLS_ATT, 2), printLastColsSplit(PRINT_COLS_ATT, 2))+
    '</div>';
  }
  if(type==='pfa'){
    var clientPfa = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    var t5 = calcDocTotals(doc.lignes, doc.tauxTVA, 0);
    var totalsRows5 = [
      {label:'TOTAL HT', value:fmtMoney(t5.ht), cls:'tot-first'},
      {label:'TVA', value:fmtMoney(t5.tva)},
      {label:'TOTAL TTC', value:fmtMoney(t5.ttc), cls:'tot-last'}
    ];
    var reference5 = doc.attachementNumero ? ('Attachement '+doc.attachementNumero) : (doc.ctrNumero ? ('Contrat '+doc.ctrNumero) : (doc.cmdNumero ? ('Commande '+doc.cmdNumero) : ''));
    return '<div class="print-doc">'+
      printLetterhead('Proposition de facturation', doc.numero, null, doc.date, reference5, null, clientPfa.nom?clientPfa:{nom:doc.clientNom||''})+
      printLignesTable(doc.lignes, PRINT_COLS_SIMPLE)+
      printBottom(doc.notes, printTotalsRows(totalsRows5), printLastColsWidth(PRINT_COLS_SIMPLE, 2), printLastColsSplit(PRINT_COLS_SIMPLE, 2))+
    '</div>';
  }
  if(type==='fac'){
    var client4 = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    var totalsRows4 = [{label:'TOTAL HT', value:fmtMoney(doc.ht), cls:'tot-first'}];
    totalsRows4.push({label:'TVA', value:fmtMoney(doc.montantTVA)});
    totalsRows4.push({label:'TOTAL TTC', value:fmtMoney(doc.ttc)});
    if(doc.montantRG) totalsRows4.push({label:'Retenue de garantie', value:'- '+fmtMoney(doc.montantRG)});
    totalsRows4.push({label:'NET À PAYER', value:fmtMoney(doc.net), cls:'tot-last'});
    var reference4 = doc.reference || (doc.attachementNumero?'Attachement '+doc.attachementNumero:'') || (doc.pfaNumero?'Proposition '+doc.pfaNumero:'') || (doc.ctrNumero?'Contrat '+doc.ctrNumero:(doc.cmdNumero?'Commande '+doc.cmdNumero:''));
    return '<div class="print-doc">'+
      printLetterhead('Facture', doc.numero||'BROUILLON', doc.revision, doc.date, reference4, null, client4.nom?client4:{nom:doc.clientNom||''})+
      printLignesTable(doc.lignes, PRINT_COLS_SIMPLE)+
      printBottom(doc.notes, printTotalsRows(totalsRows4), printLastColsWidth(PRINT_COLS_SIMPLE, 2), printLastColsSplit(PRINT_COLS_SIMPLE, 2))+
    '</div>';
  }
  if(type==='avo'){
    var clientAvo = STATE.clients.find(function(c){ return c.id===doc.clientId; }) || {};
    var t6 = calcDocTotals(doc.lignes, doc.tauxTVA, 0);
    var totalsRows6 = [
      {label:'TOTAL HT', value:fmtMoney(t6.ht), cls:'tot-first'},
      {label:'TVA', value:fmtMoney(t6.tva)},
      {label:'TOTAL TTC', value:fmtMoney(t6.ttc), cls:'tot-last'}
    ];
    var reference6 = doc.motif || (doc.factureNumero?('Facture '+doc.factureNumero):'');
    return '<div class="print-doc">'+
      printLetterhead('Avoir', doc.numero, null, doc.date, reference6, 'Motif', clientAvo.nom?clientAvo:{nom:doc.clientNom||''})+
      printLignesTable(doc.lignes, PRINT_COLS_SIMPLE)+
      printBottom(doc.notes, printTotalsRows(totalsRows6), printLastColsWidth(PRINT_COLS_SIMPLE, 2), printLastColsSplit(PRINT_COLS_SIMPLE, 2))+
    '</div>';
  }
  return '<div class="print-doc">Document indisponible.</div>';
}

// Etire la derniere ligne du tableau des lignes pour que le document occupe
// toute la hauteur imprimable de la page (comme le modele fourni par
// l'utilisateur), quelle que soit la quantite de contenu. Pour mesurer les
// hauteurs reelles (nécessaire car #print-area est display:none hors
// impression), on rend temporairement la zone visible a la largeur imprimable
// exacte (A4 moins les marges @page de 14mm de chaque cote), on calcule
// l'espace vide restant, on l'ajoute a la derniere ligne, puis on restaure
// l'etat initial : l'impression elle-meme applique ensuite ses propres
// regles CSS (@media print) par-dessus ce resultat deja mesure.
function preparePrintStretch(){
  var area = byId('print-area');
  var root = area.querySelector('.print-doc');
  if(!root) return;
  // Documents non itemises (Contrat, Avenant : bloc cle/valeur via
  // printInfoRows, pas de tableau de lignes) : pas d'etirement de derniere
  // ligne, le contenu reste naturellement en haut de page.
  if(root.classList.contains('print-doc-compact')) return;
  var table = root.querySelector(':scope > table');
  if(!table) return;
  var tbody = table.querySelector('tbody');
  if(!tbody || !tbody.rows.length) return;
  var lastRow = tbody.rows[tbody.rows.length - 1];
  lastRow.style.height = '';

  var prev = {display:area.style.display, position:area.style.position, width:area.style.width, top:area.style.top, left:area.style.left};
  area.style.display = 'block';
  area.style.position = 'static';
  area.style.width = '182mm'; // largeur imprimable A4 (210mm - 2x14mm de marge @page)

  var available = root.getBoundingClientRect().height;
  // Hauteur naturelle du contenu (mesuree directement, min-height desactivee
  // temporairement) plutot que la somme des hauteurs de chaque enfant : cette
  // derniere ignore les marges verticales *entre* les enfants (margin-bottom
  // de l'entete, de la ligne reference/client, margin-top du bloc du bas),
  // ce qui sous-estimait l'espace deja utilise et faisait deborder le
  // document sur une 2e page (l'ecart mesure correspondait exactement a ces
  // marges non comptees).
  var prevMinHeight = root.style.minHeight;
  root.style.minHeight = '0px';
  var used = root.getBoundingClientRect().height;
  root.style.minHeight = prevMinHeight;
  // Petite marge de securite pour absorber les ecarts d'arrondi entre cette
  // mesure (a l'ecran, zone forcee visible) et la pagination reelle a
  // l'impression : mieux vaut un leger espace blanc en bas de page qu'un
  // debordement sur une 2e page.
  var SAFETY_MARGIN = 20;
  var gap = available - used - SAFETY_MARGIN;
  if(gap > 4){
    var cur = lastRow.getBoundingClientRect().height;
    lastRow.style.height = (cur + gap) + 'px';
  }

  area.style.display = prev.display;
  area.style.position = prev.position;
  area.style.width = prev.width;
  area.style.top = prev.top;
  area.style.left = prev.left;
}

var PRINT_TITLES = {devis:'Devis', ctr:'Contrat', av:'Avenant', att:'Attachement', bor:'Bordereau de transmission', pfa:'Proposition de facturation', fac:'Facture', avo:'Avoir'};
function printDocument(type, doc){
  if(!doc){ toast('Document introuvable', 'danger'); return; }
  byId('print-area').innerHTML = buildPrintHTML(type, doc);
  preparePrintStretch();
  // Le titre de la page est repris par certains navigateurs dans l'en-tête
  // d'impression (si l'option "En-têtes et pieds de page" est active côté
  // navigateur) : on le remplace temporairement par le nom du document
  // plutôt que le nom de l'application, le temps de l'impression.
  var prevTitle = document.title;
  document.title = (PRINT_TITLES[type]||'Document')+(doc.numero?' '+doc.numero:'');
  var restored = false;
  function restore(){
    if(restored) return;
    restored = true;
    document.title = prevTitle;
    window.removeEventListener('afterprint', restore);
  }
  window.addEventListener('afterprint', restore);
  setTimeout(restore, 15000); // filet de sécurité si l'evenement afterprint n'est pas déclenché
  window.print();
}

/* =========================================================
   DEMARRAGE
   ========================================================= */
boot();
