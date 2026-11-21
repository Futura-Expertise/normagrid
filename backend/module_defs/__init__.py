# -*- coding: utf-8 -*-
"""Registre des modules : un fichier de description par module (ordre = ordre des menus ;
un module vient toujours après ceux dont il dépend)."""
import importlib

ORDRE = ["commercial", "contrat", "livrables", "planification", "etude_electrique", "facturation", "fournisseurs", "personnel", "compta"]

NOYAU = importlib.import_module(__name__ + ".noyau").MODULE
DEFS = {m: importlib.import_module("%s.%s" % (__name__, m)).MODULE for m in ORDRE}
