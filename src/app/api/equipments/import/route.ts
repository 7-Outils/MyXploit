import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Synonymes et alias pour les types d'équipements
// Permet de matcher "pompe" → "CIRCULATEUR", "clim" → "CLIMATISEUR", etc.
const TYPE_SYNONYMS: Record<string, string> = {
  // Chauffage - Générateurs
  "chaudière": "CHAUDIERE",
  "chaudiere": "CHAUDIERE",
  "chaudière gaz": "CHAUDIERE",
  "chaudiere gaz": "CHAUDIERE",
  "chaudière fioul": "CHAUDIERE",
  "chaudiere fioul": "CHAUDIERE",
  "chaudière condensation": "CHAUDIERE_CONDENSATION",
  "chaudiere condensation": "CHAUDIERE_CONDENSATION",
  "chaudière à condensation": "CHAUDIERE_CONDENSATION",
  "pac": "PAC",
  "pompe à chaleur": "PAC",
  "pompe a chaleur": "PAC",
  "pac air eau": "PAC_AIR_EAU",
  "pac air/eau": "PAC_AIR_EAU",
  "pac eau eau": "PAC_EAU_EAU",
  "pac eau/eau": "PAC_EAU_EAU",
  "pac air air": "PAC_AIR_AIR",
  "pac air/air": "PAC_AIR_AIR",
  "brûleur": "BRULEUR",
  "bruleur": "BRULEUR",

  // Chauffage - Émetteurs
  "radiateur": "RADIATEUR",
  "radiateurs": "RADIATEUR",
  "plancher chauffant": "PLANCHER_CHAUFFANT",
  "convecteur": "CONVECTEUR",
  "convecteurs": "CONVECTEUR",
  "aérotherme": "AEROTERME",
  "aerotherme": "AEROTERME",
  "aérothermes": "AEROTERME",
  "radiant": "RADIANT_GAZ",
  "radiant gaz": "RADIANT_GAZ",
  "tube radiant": "RADIANT_GAZ",
  "panneau rayonnant": "PANNEAU_RAYONNANT",
  "panneaux rayonnants": "PANNEAU_RAYONNANT",

  // Chauffage - Distribution
  "pompe": "CIRCULATEUR",
  "pompe de circulation": "CIRCULATEUR",
  "circulateur": "CIRCULATEUR",
  "circulateurs": "CIRCULATEUR",
  "pompe chauffage": "POMPE_CHAUFFAGE",
  "vanne 3 voies": "VANNE_3_VOIES",
  "v3v": "VANNE_3_VOIES",
  "vanne trois voies": "VANNE_3_VOIES",
  "vanne motorisée": "VANNE_MOTORISEE",
  "vanne motorisee": "VANNE_MOTORISEE",
  "vase expansion": "VASE_EXPANSION",
  "vase d'expansion": "VASE_EXPANSION",
  "échangeur": "ECHANGEUR_THERMIQUE",
  "echangeur": "ECHANGEUR_THERMIQUE",
  "échangeur thermique": "ECHANGEUR_THERMIQUE",
  "echangeur thermique": "ECHANGEUR_THERMIQUE",

  // Chauffage - Régulation
  "régulateur": "REGULATEUR",
  "regulateur": "REGULATEUR",
  "régulation": "REGULATEUR",
  "sonde": "SONDE_TEMPERATURE",
  "sonde température": "SONDE_TEMPERATURE",
  "sonde temperature": "SONDE_TEMPERATURE",
  "sonde extérieure": "SONDE_EXTERIEURE",
  "sonde exterieure": "SONDE_EXTERIEURE",
  "sonde ext": "SONDE_EXTERIEURE",

  // ECS
  "ballon": "BALLON_ECS",
  "ballon ecs": "BALLON_ECS",
  "ballon eau chaude": "BALLON_ECS",
  "cumulus": "BALLON_ECS",
  "chauffe-eau": "BALLON_ECS",
  "chauffe eau": "BALLON_ECS",
  "ballon thermodynamique": "BALLON_THERMODYNAMIQUE",
  "ballon thermo": "BALLON_THERMODYNAMIQUE",
  "préparateur ecs": "PREPARATEUR_ECS_GAZ",
  "preparateur ecs": "PREPARATEUR_ECS_GAZ",
  "préparateur ecs gaz": "PREPARATEUR_ECS_GAZ",
  "preparateur ecs gaz": "PREPARATEUR_ECS_GAZ",
  "échangeur ecs": "ECHANGEUR_ECS",
  "echangeur ecs": "ECHANGEUR_ECS",
  "pompe bouclage": "POMPE_BOUCLAGE",
  "pompe de bouclage": "POMPE_BOUCLAGE",
  "bouclage": "POMPE_BOUCLAGE",
  "mitigeur": "MITIGEUR_THERMOSTATIQUE",
  "mitigeur thermostatique": "MITIGEUR_THERMOSTATIQUE",
  "résistance": "RESISTANCE_ELECTRIQUE",
  "resistance": "RESISTANCE_ELECTRIQUE",
  "résistance électrique": "RESISTANCE_ELECTRIQUE",
  "resistance electrique": "RESISTANCE_ELECTRIQUE",

  // Ventilation
  "vmc": "VMC",
  "vmc simple flux": "VMC_SIMPLE_FLUX",
  "vmc sf": "VMC_SIMPLE_FLUX",
  "vmc double flux": "VMC_DOUBLE_FLUX",
  "vmc df": "VMC_DOUBLE_FLUX",
  "cta": "CTA",
  "centrale traitement air": "CTA",
  "centrale de traitement d'air": "CTA",
  "caisson extraction": "CAISSON_EXTRACTION",
  "caisson d'extraction": "CAISSON_EXTRACTION",
  "extraction": "CAISSON_EXTRACTION",
  "caisson soufflage": "CAISSON_SOUFFLAGE",
  "caisson de soufflage": "CAISSON_SOUFFLAGE",
  "soufflage": "CAISSON_SOUFFLAGE",
  "ventilateur": "VENTILATEUR",
  "ventilo": "VENTILATEUR",
  "registre": "REGISTRE",
  "batterie chaude": "BATTERIE_CHAUDE",
  "bc": "BATTERIE_CHAUDE",
  "batterie froide": "BATTERIE_FROIDE",
  "bf": "BATTERIE_FROIDE",
  "récupérateur": "RECUPERATEUR_CHALEUR",
  "recuperateur": "RECUPERATEUR_CHALEUR",
  "récupérateur chaleur": "RECUPERATEUR_CHALEUR",
  "recuperateur chaleur": "RECUPERATEUR_CHALEUR",

  // Climatisation
  "groupe froid": "GROUPE_FROID",
  "gf": "GROUPE_FROID",
  "groupe eau glacée": "GROUPE_FROID",
  "climatisation": "CLIMATISATION",
  "clim": "CLIMATISEUR",
  "climatiseur": "CLIMATISEUR",
  "split": "SPLIT",
  "split system": "SPLIT",
  "multi split": "MULTI_SPLIT",
  "multi-split": "MULTI_SPLIT",
  "cassette": "CASSETTE",
  "gainable": "GAINABLE",
  "rooftop": "ROOFTOP",
  "roof top": "ROOFTOP",

  // Traitement eau
  "adoucisseur": "ADOUCISSEUR",
  "disconnecteur": "DISCONNECTEUR",
  "filtre": "FILTRE",
  "pot à boue": "POT_BOUE",
  "pot a boue": "POT_BOUE",
  "pot boue": "POT_BOUE",
  "dégazeur": "DEGAZEUR",
  "degazeur": "DEGAZEUR",
  "doseur": "DOSEUR",

  // Plomberie
  "compteur eau": "COMPTEUR_EAU",
  "compteur d'eau": "COMPTEUR_EAU",
  "vanne générale": "VANNE_GENERALE",
  "vanne generale": "VANNE_GENERALE",
  "vg": "VANNE_GENERALE",
  "surpresseur": "SURPRESSEUR",
  "bâche": "BACHE_EAU",
  "bache": "BACHE_EAU",
  "bâche à eau": "BACHE_EAU",
  "bache a eau": "BACHE_EAU",
  "réducteur pression": "REDUCTION_PRESSION",
  "reducteur pression": "REDUCTION_PRESSION",
  "détendeur": "REDUCTION_PRESSION",
  "detendeur": "REDUCTION_PRESSION",

  // CFO/CFA
  "armoire électrique": "ARMOIRE_ELECTRIQUE",
  "armoire electrique": "ARMOIRE_ELECTRIQUE",
  "armoire elec": "ARMOIRE_ELECTRIQUE",
  "tgbt": "ARMOIRE_TGBT",
  "tableau général": "ARMOIRE_TGBT",
  "tableau general": "ARMOIRE_TGBT",
  "td": "ARMOIRE_TD",
  "tableau divisionnaire": "ARMOIRE_TD",
  "onduleur": "ONDULEUR",
  "ups": "ONDULEUR",
  "groupe électrogène": "GROUPE_ELECTROGENE",
  "groupe electrogene": "GROUPE_ELECTROGENE",
  "ge": "GROUPE_ELECTROGENE",
  "transformateur": "TRANSFORMATEUR",
  "transfo": "TRANSFORMATEUR",
  "baie informatique": "BAIE_INFORMATIQUE",
  "baie info": "BAIE_INFORMATIQUE",
  "rack": "BAIE_INFORMATIQUE",

  // Comptage
  "compteur énergie": "COMPTEUR_ENERGIE",
  "compteur energie": "COMPTEUR_ENERGIE",
  "compteur thermique": "COMPTEUR_ENERGIE",
  "compteur calories": "COMPTEUR_CALORIES",
  "compteur de calories": "COMPTEUR_CALORIES",
  "calorimètre": "COMPTEUR_CALORIES",
  "calorimetre": "COMPTEUR_CALORIES",
  "compteur frigories": "COMPTEUR_FRIGORIES",
  "compteur de frigories": "COMPTEUR_FRIGORIES",
  "frigorimètre": "COMPTEUR_FRIGORIES",
  "frigorimetre": "COMPTEUR_FRIGORIES",
  "compteur ecs": "COMPTEUR_ECS",
  "compteur gaz": "COMPTEUR_GAZ",
  "compteur électrique": "COMPTEUR_ELECTRIQUE",
  "compteur electrique": "COMPTEUR_ELECTRIQUE",
  "sous-compteur": "SOUS_COMPTEUR_ELEC",
  "sous compteur": "SOUS_COMPTEUR_ELEC",
  "sous-compteur électrique": "SOUS_COMPTEUR_ELEC",
  "compteur horaire": "COMPTEUR_HORAIRE",
  "analyseur réseau": "ANALYSEUR_RESEAU",
  "analyseur reseau": "ANALYSEUR_RESEAU",
  "analyseur": "ANALYSEUR_RESEAU",
  "sonde ambiante": "SONDE_TEMPERATURE_AMB",
  "sonde température ambiante": "SONDE_TEMPERATURE_AMB",
  "sonde hygrométrie": "SONDE_HYGROMETRIE",
  "sonde hygrometrie": "SONDE_HYGROMETRIE",
  "hygromètre": "SONDE_HYGROMETRIE",
  "hygrometre": "SONDE_HYGROMETRIE",
  "capteur co2": "CAPTEUR_CO2",
  "sonde co2": "CAPTEUR_CO2",
  "capteur qualité air": "CAPTEUR_QUALITE_AIR",
  "capteur qualite air": "CAPTEUR_QUALITE_AIR",

  // Piscine
  "filtre piscine": "FILTRE_PISCINE",
  "filtre à sable": "FILTRE_PISCINE",
  "filtre a sable": "FILTRE_PISCINE",
  "filtre diatomée": "FILTRE_PISCINE",
  "filtre diatomee": "FILTRE_PISCINE",
  "pompe filtration": "POMPE_FILTRATION",
  "pompe de filtration": "POMPE_FILTRATION",
  "pompe piscine": "POMPE_FILTRATION",
  "pac piscine": "PAC_PISCINE",
  "pompe chaleur piscine": "PAC_PISCINE",
  "échangeur piscine": "ECHANGEUR_PISCINE",
  "echangeur piscine": "ECHANGEUR_PISCINE",
  "échangeur bassin": "ECHANGEUR_PISCINE",
  "chaudière piscine": "CHAUDIERE_PISCINE",
  "chaudiere piscine": "CHAUDIERE_PISCINE",
  "électrolyseur": "ELECTROLYSEUR_SEL",
  "electrolyseur": "ELECTROLYSEUR_SEL",
  "électrolyseur sel": "ELECTROLYSEUR_SEL",
  "electrolyseur sel": "ELECTROLYSEUR_SEL",
  "électrolyse": "ELECTROLYSEUR_SEL",
  "traitement chlore": "TRAITEMENT_CHLORE",
  "chloration": "TRAITEMENT_CHLORE",
  "chlorateur": "TRAITEMENT_CHLORE",
  "traitement uv": "TRAITEMENT_UV",
  "lampe uv": "TRAITEMENT_UV",
  "uv piscine": "TRAITEMENT_UV",
  "traitement ozone": "TRAITEMENT_OZONE",
  "ozonateur": "TRAITEMENT_OZONE",
  "ozone": "TRAITEMENT_OZONE",
  "régulateur ph": "REGULATEUR_PH",
  "regulateur ph": "REGULATEUR_PH",
  "contrôleur ph": "REGULATEUR_PH",
  "régulateur chlore": "REGULATEUR_CHLORE",
  "regulateur chlore": "REGULATEUR_CHLORE",
  "régulateur redox": "REGULATEUR_CHLORE",
  "pompe doseuse": "POMPE_DOSEUSE",
  "pompe doseuse ph": "POMPE_DOSEUSE",
  "pompe doseuse chlore": "POMPE_DOSEUSE",
  "sonde ph": "SONDE_PH",
  "sonde redox": "SONDE_REDOX",
  "sonde orp": "SONDE_REDOX",
  "sonde température eau": "SONDE_TEMPERATURE_EAU",
  "sonde temperature eau": "SONDE_TEMPERATURE_EAU",
  "sonde bassin": "SONDE_TEMPERATURE_EAU",
  "déshumidificateur": "DESHUMIDIFICATEUR",
  "deshumidificateur": "DESHUMIDIFICATEUR",
  "déshum": "DESHUMIDIFICATEUR",
  "deshum": "DESHUMIDIFICATEUR",
  "cta piscine": "CTA_PISCINE",
  "centrale piscine": "CTA_PISCINE",
  "centrale air piscine": "CTA_PISCINE",
  "bâche tampon": "BACHE_TAMPON",
  "bache tampon": "BACHE_TAMPON",
  "bac tampon": "BACHE_TAMPON",
  "nage contre courant": "NAGE_CONTRE_COURANT",
  "nage contre-courant": "NAGE_CONTRE_COURANT",
  "ncc": "NAGE_CONTRE_COURANT",
  "robot piscine": "ROBOT_NETTOYAGE",
  "robot nettoyage": "ROBOT_NETTOYAGE",
  "robot": "ROBOT_NETTOYAGE",

  // Régulation / Automatisme
  "automate": "AUTOMATE",
  "automate programmable": "AUTOMATE",
  "gtb": "AUTOMATE",
  "gtc": "AUTOMATE",
  "gestion technique": "AUTOMATE",
  "supervision": "AUTOMATE",
  "bms": "AUTOMATE",

  // Climatisation - VRV/DRV
  "drv": "DRV",
  "vrv": "DRV",
  "vrf": "DRV",
  "débit réfrigérant variable": "DRV",
  "debit refrigerant variable": "DRV",

  // Distribution / Réseau
  "distribution": "RESEAU_DISTRIBUTION",
  "réseau distribution": "RESEAU_DISTRIBUTION",
  "reseau distribution": "RESEAU_DISTRIBUTION",
  "réseau enterré": "RESEAU_ENTERRE",
  "reseau enterre": "RESEAU_ENTERRE",
  "canalisation enterrée": "RESEAU_ENTERRE",
  "canalisation enterree": "RESEAU_ENTERRE",
  "tuyauterie enterrée": "RESEAU_ENTERRE",

  // Comptage spécifique
  "compteur appoint": "COMPTEUR_APPOINT",
  "compteur d'appoint": "COMPTEUR_APPOINT",
  "appoint eau": "COMPTEUR_APPOINT",

  // Pot d'injection / Traitement réseau
  "pot d'injection": "POT_INJECTION",
  "pot d injection": "POT_INJECTION",
  "pot injection": "POT_INJECTION",

  // Télésurveillance / Alarme
  "télésurveillance": "TELESURVEILLANCE",
  "telesurveillance": "TELESURVEILLANCE",
  "alarme": "TELESURVEILLANCE",
  "alarme technique": "TELESURVEILLANCE",
  "détecteur fuite": "TELESURVEILLANCE",
  "detecteur fuite": "TELESURVEILLANCE",

  // Pressostats / Capteurs pression
  "pressostat": "PRESSOSTAT",
  "pressostat différentiel": "PRESSOSTAT",
  "pressostat differentiel": "PRESSOSTAT",
  "capteur pression": "PRESSOSTAT",
  "sonde pression": "PRESSOSTAT",
  "manomètre": "MANOMETRE",
  "manometre": "MANOMETRE",

  // Thermostats / Aquastats
  "thermostat": "THERMOSTAT",
  "thermostat ambiance": "THERMOSTAT_AMBIANCE",
  "thermostat d'ambiance": "THERMOSTAT_AMBIANCE",
  "aquastat": "AQUASTAT",
  "thermostat chaudière": "AQUASTAT",
  "thermostat eau": "AQUASTAT",
  "thermomètre": "THERMOMETRE",
  "thermometre": "THERMOMETRE",

  // Sécurités
  "soupape": "SOUPAPE_SECURITE",
  "soupape sécurité": "SOUPAPE_SECURITE",
  "soupape securite": "SOUPAPE_SECURITE",
  "soupape de sécurité": "SOUPAPE_SECURITE",
  "clapet": "CLAPET_ANTI_RETOUR",
  "clapet anti-retour": "CLAPET_ANTI_RETOUR",
  "clapet anti retour": "CLAPET_ANTI_RETOUR",

  // Hydraulique / Distribution
  "bouteille mélange": "BOUTEILLE_MELANGE",
  "bouteille melange": "BOUTEILLE_MELANGE",
  "bouteille casse-pression": "BOUTEILLE_MELANGE",
  "bouteille de mélange": "BOUTEILLE_MELANGE",
  "collecteur": "COLLECTEUR",
  "nourrice": "COLLECTEUR",
  "séparateur air": "SEPARATEUR_AIR",
  "separateur air": "SEPARATEUR_AIR",
  "purgeur": "PURGEUR",
  "purgeur automatique": "PURGEUR",
  "robinet vidange": "ROBINET_VIDANGE",
  "robinet de vidange": "ROBINET_VIDANGE",
  "vanne d'isolement": "VANNE_ISOLEMENT",
  "vanne isolement": "VANNE_ISOLEMENT",
  "vanne d'arrêt": "VANNE_ISOLEMENT",
  "vanne arret": "VANNE_ISOLEMENT",
  "vanne équilibrage": "VANNE_EQUILIBRAGE",
  "vanne equilibrage": "VANNE_EQUILIBRAGE",
  "vanne d'équilibrage": "VANNE_EQUILIBRAGE",
  "équilibreur": "VANNE_EQUILIBRAGE",
  "equilibreur": "VANNE_EQUILIBRAGE",

  // Robinetterie
  "robinet thermostatique": "ROBINET_THERMOSTATIQUE",
  "tête thermostatique": "TETE_THERMOSTATIQUE",
  "tete thermostatique": "TETE_THERMOSTATIQUE",

  // Générateurs air chaud
  "générateur air chaud": "GENERATEUR_AIR_CHAUD",
  "generateur air chaud": "GENERATEUR_AIR_CHAUD",
  "gac": "GENERATEUR_AIR_CHAUD",
  "aérotherme gaz": "AEROTHERME_GAZ",
  "aerotherme gaz": "AEROTHERME_GAZ",
  "unit heater": "UNIT_HEATER",
  "unit-heater": "UNIT_HEATER",

  // Ventilation avancée
  "bouche extraction": "BOUCHE_EXTRACTION",
  "bouche d'extraction": "BOUCHE_EXTRACTION",
  "bouche soufflage": "BOUCHE_SOUFFLAGE",
  "bouche de soufflage": "BOUCHE_SOUFFLAGE",
  "diffuseur": "DIFFUSEUR",
  "diffuseur plafond": "DIFFUSEUR",
  "grille ventilation": "GRILLE_VENTILATION",
  "grille de ventilation": "GRILLE_VENTILATION",
  "grille": "GRILLE_VENTILATION",
  "plénum": "PLENUM",
  "plenum": "PLENUM",
  "silencieux": "SILENCIEUX",
  "silencieux acoustique": "SILENCIEUX",
  "clapet coupe-feu": "CLAPET_COUPE_FEU",
  "clapet coupe feu": "CLAPET_COUPE_FEU",
  "volet coupe-feu": "CLAPET_COUPE_FEU",
  "volet coupe feu": "CLAPET_COUPE_FEU",
  "humidificateur": "HUMIDIFICATEUR",
  "humidification": "HUMIDIFICATEUR",

  // Rideau d'air
  "rideau air": "RIDEAU_AIR",
  "rideau d'air": "RIDEAU_AIR",
  "rideau d air": "RIDEAU_AIR",

  // Refroidissement
  "tour refroidissement": "TOUR_REFROIDISSEMENT",
  "tour de refroidissement": "TOUR_REFROIDISSEMENT",
  "aéroréfrigérant": "AEROREFRIGERANT",
  "aerorefrigerant": "AEROREFRIGERANT",
  "dry cooler": "DRY_COOLER",
  "drycooler": "DRY_COOLER",
  "refroidisseur adiabatique": "REFROIDISSEUR_ADIABATIQUE",
  "refroidisseur sec": "DRY_COOLER",

  // Unités intérieur/extérieur (VRV/Split)
  "unité intérieure": "UNITE_INTERIEURE",
  "unite interieure": "UNITE_INTERIEURE",
  "ui": "UNITE_INTERIEURE",
  "unité extérieure": "UNITE_EXTERIEURE",
  "unite exterieure": "UNITE_EXTERIEURE",
  "ue": "UNITE_EXTERIEURE",
  "groupe extérieur": "UNITE_EXTERIEURE",
  "groupe exterieur": "UNITE_EXTERIEURE",
  "console": "CONSOLE_CLIMATISATION",
  "console clim": "CONSOLE_CLIMATISATION",
  "mural": "MURAL_CLIMATISATION",
  "mural clim": "MURAL_CLIMATISATION",
  "armoire climatisation": "ARMOIRE_CLIMATISATION",
  "armoire clim": "ARMOIRE_CLIMATISATION",

  // Comptage / Mesure
  "débitmètre": "DEBITMETRE",
  "debitmetre": "DEBITMETRE",
  "compteur volumétrique": "DEBITMETRE",
  "compteur volumetrique": "DEBITMETRE",
  "variateur": "VARIATEUR_FREQUENCE",
  "variateur fréquence": "VARIATEUR_FREQUENCE",
  "variateur frequence": "VARIATEUR_FREQUENCE",
  "variateur de fréquence": "VARIATEUR_FREQUENCE",
  "vfd": "VARIATEUR_FREQUENCE",

  // Détection / Sécurité incendie
  "détecteur fumée": "DETECTEUR_FUMEE",
  "detecteur fumee": "DETECTEUR_FUMEE",
  "détecteur de fumée": "DETECTEUR_FUMEE",
  "détecteur co": "DETECTEUR_CO",
  "detecteur co": "DETECTEUR_CO",
  "détecteur monoxyde": "DETECTEUR_CO",

  // Module / Station
  "module hydraulique": "MODULE_HYDRAULIQUE",
  "groupe transfert": "MODULE_HYDRAULIQUE",
  "groupe de transfert": "MODULE_HYDRAULIQUE",
  "station relevage": "STATION_RELEVAGE",
  "station de relevage": "STATION_RELEVAGE",
  "pompe relevage": "STATION_RELEVAGE",
  "pompe de relevage": "STATION_RELEVAGE",

  // Solaire thermique
  "panneau solaire": "PANNEAU_SOLAIRE_THERMIQUE",
  "capteur solaire": "PANNEAU_SOLAIRE_THERMIQUE",
  "panneau solaire thermique": "PANNEAU_SOLAIRE_THERMIQUE",
  "ballon solaire": "BALLON_SOLAIRE",
  "station solaire": "STATION_SOLAIRE",

  // Electrovannes / Vannes
  "électrovanne": "ELECTROVANNE",
  "electrovanne": "ELECTROVANNE",
  "électrovanne gaz": "ELECTROVANNE_GAZ",
  "electrovanne gaz": "ELECTROVANNE_GAZ",
  "vanne gaz": "ELECTROVANNE_GAZ",
  "vanne 2 voies": "VANNE_2_VOIES",
  "v2v": "VANNE_2_VOIES",
  "vanne deux voies": "VANNE_2_VOIES",
  "vanne 2 voies + servomoteur": "VANNE_2_VOIES",
  "vanne 2 voies servomoteur": "VANNE_2_VOIES",
  "servomoteur": "SERVOMOTEUR",
  "servo": "SERVOMOTEUR",
  "actionneur": "SERVOMOTEUR",

  // Détection gaz
  "centrale détection gaz": "CENTRALE_DETECTION_GAZ",
  "centrale detection gaz": "CENTRALE_DETECTION_GAZ",
  "centrale de détection gaz": "CENTRALE_DETECTION_GAZ",
  "détecteur gaz": "DETECTEUR_GAZ",
  "detecteur gaz": "DETECTEUR_GAZ",

  // Extracteurs / Caissons ventilation
  "extracteur": "EXTRACTEUR",
  "extracteur air": "EXTRACTEUR",
  "caisson ventilation": "CAISSON_VENTILATION",
  "caisson de ventilation": "CAISSON_VENTILATION",

  // Cuves / Réservoirs
  "cuve": "CUVE",
  "cuve fioul": "CUVE_FIOUL",
  "cuve fuel": "CUVE_FIOUL",
  "réservoir": "CUVE",
  "reservoir": "CUVE",
  "cuve gaz": "CUVE_GAZ",
  "citerne": "CUVE",
  "citerne gaz": "CUVE_GAZ",

  // Interface / Commande
  "écran tactile": "ECRAN_TACTILE",
  "ecran tactile": "ECRAN_TACTILE",
  "interface": "ECRAN_TACTILE",
  "ihm": "ECRAN_TACTILE",
  "télécommande": "TELECOMMANDE",
  "telecommande": "TELECOMMANDE",
  "télécommande filaire": "TELECOMMANDE",
  "telecommande filaire": "TELECOMMANDE",
  "commande déportée": "TELECOMMANDE",
  "commande deportee": "TELECOMMANDE",

  // ECS - variantes orthographiques
  "balon d'eau chaude": "BALLON_ECS",
  "balon d eau chaude": "BALLON_ECS",
  "balon eau chaude": "BALLON_ECS",
  "ballon d'eau chaude": "BALLON_ECS",

  // Comptage énergie (variantes)
  "compteur d'énergie": "COMPTEUR_ENERGIE",
  "compteur d energie": "COMPTEUR_ENERGIE",

  // Typos courants comptage
  "comtpeur ecs": "COMPTEUR_ECS",
  "comptuer ecs": "COMPTEUR_ECS",
  "competur ecs": "COMPTEUR_ECS",

  // Gaines / Conduits
  "gaine": "GAINE",
  "gaines": "GAINE",
  "gaine ventilation": "GAINE",
  "conduit": "GAINE",
  "conduits": "GAINE",

  // Traitement eau - Bac à sel
  "bac à sel": "BAC_SEL",
  "bac a sel": "BAC_SEL",
  "bac sel": "BAC_SEL",
  "réservoir sel": "BAC_SEL",
  "reservoir sel": "BAC_SEL",

  // Typos courants chauffage
  "radiatnt gaz": "RADIANT_GAZ",
  "radiants gaz": "RADIANT_GAZ",

  // Émission / Émetteurs
  "émission": "EMETTEUR",
  "emission": "EMETTEUR",
  "émetteur": "EMETTEUR",
  "emetteur": "EMETTEUR",
  "émetteurs": "EMETTEUR",
  "emetteurs": "EMETTEUR",
  "corps de chauffe": "EMETTEUR",

  // Autre
  "autre": "AUTRE",
};

// Synonymes pour les domaines
const DOMAIN_SYNONYMS: Record<string, string> = {
  "chauffage": "CHAUFFAGE",
  "chauf": "CHAUFFAGE",
  "ecs": "ECS",
  "eau chaude": "ECS",
  "eau chaude sanitaire": "ECS",
  "ventilation": "VENTILATION",
  "ventil": "VENTILATION",
  "vent": "VENTILATION",
  "climatisation": "CLIMATISATION",
  "clim": "CLIMATISATION",
  "froid": "CLIMATISATION",
  "traitement eau": "TRAITEMENT_EAU",
  "traitement d'eau": "TRAITEMENT_EAU",
  "plomberie": "PLOMBERIE",
  "plomb": "PLOMBERIE",
  "sanitaire": "PLOMBERIE",
  "cfo": "CFO_CFA",
  "cfa": "CFO_CFA",
  "cfo/cfa": "CFO_CFA",
  "électricité": "CFO_CFA",
  "electricite": "CFO_CFA",
  "elec": "CFO_CFA",
  "comptage": "COMPTAGE",
  "mesure": "COMPTAGE",
  "instrumentation": "COMPTAGE",
  "piscine": "PISCINE",
  "bassin": "PISCINE",
  "traitement eau piscine": "PISCINE",
  "filtration piscine": "PISCINE",
  "autre": "AUTRE",
};

// Mapping type -> domain automatique
const TYPE_TO_DOMAIN: Record<string, string> = {
  CHAUDIERE: "CHAUFFAGE",
  CHAUDIERE_CONDENSATION: "CHAUFFAGE",
  PAC: "CHAUFFAGE",
  PAC_AIR_EAU: "CHAUFFAGE",
  PAC_EAU_EAU: "CHAUFFAGE",
  PAC_AIR_AIR: "CHAUFFAGE",
  RADIATEUR: "CHAUFFAGE",
  PLANCHER_CHAUFFANT: "CHAUFFAGE",
  CONVECTEUR: "CHAUFFAGE",
  AEROTERME: "CHAUFFAGE",
  RADIANT_GAZ: "CHAUFFAGE",
  VANNE_3_VOIES: "CHAUFFAGE",
  VANNE_MOTORISEE: "CHAUFFAGE",
  POMPE_CHAUFFAGE: "CHAUFFAGE",
  CIRCULATEUR: "CHAUFFAGE",
  VASE_EXPANSION: "CHAUFFAGE",
  ECHANGEUR_THERMIQUE: "CHAUFFAGE",
  BRULEUR: "CHAUFFAGE",
  REGULATEUR: "CHAUFFAGE",
  SONDE_TEMPERATURE: "CHAUFFAGE",
  SONDE_EXTERIEURE: "CHAUFFAGE",
  BALLON_ECS: "ECS",
  BALLON_THERMODYNAMIQUE: "ECS",
  PREPARATEUR_ECS_GAZ: "ECS",
  ECHANGEUR_ECS: "ECS",
  POMPE_BOUCLAGE: "ECS",
  MITIGEUR_THERMOSTATIQUE: "ECS",
  RESISTANCE_ELECTRIQUE: "ECS",
  VMC: "VENTILATION",
  VMC_SIMPLE_FLUX: "VENTILATION",
  VMC_DOUBLE_FLUX: "VENTILATION",
  CTA: "VENTILATION",
  CAISSON_EXTRACTION: "VENTILATION",
  CAISSON_SOUFFLAGE: "VENTILATION",
  VENTILATEUR: "VENTILATION",
  REGISTRE: "VENTILATION",
  BATTERIE_CHAUDE: "VENTILATION",
  BATTERIE_FROIDE: "VENTILATION",
  RECUPERATEUR_CHALEUR: "VENTILATION",
  GROUPE_FROID: "CLIMATISATION",
  CLIMATISATION: "CLIMATISATION",
  CLIMATISEUR: "CLIMATISATION",
  SPLIT: "CLIMATISATION",
  MULTI_SPLIT: "CLIMATISATION",
  CASSETTE: "CLIMATISATION",
  GAINABLE: "CLIMATISATION",
  ROOFTOP: "CLIMATISATION",
  ADOUCISSEUR: "TRAITEMENT_EAU",
  DISCONNECTEUR: "TRAITEMENT_EAU",
  FILTRE: "TRAITEMENT_EAU",
  POT_BOUE: "TRAITEMENT_EAU",
  DEGAZEUR: "TRAITEMENT_EAU",
  DOSEUR: "TRAITEMENT_EAU",
  COMPTEUR_EAU: "PLOMBERIE",
  VANNE_GENERALE: "PLOMBERIE",
  SURPRESSEUR: "PLOMBERIE",
  BACHE_EAU: "PLOMBERIE",
  REDUCTION_PRESSION: "PLOMBERIE",
  ARMOIRE_ELECTRIQUE: "CFO_CFA",
  ARMOIRE_TGBT: "CFO_CFA",
  ARMOIRE_TD: "CFO_CFA",
  ONDULEUR: "CFO_CFA",
  GROUPE_ELECTROGENE: "CFO_CFA",
  TRANSFORMATEUR: "CFO_CFA",
  BAIE_INFORMATIQUE: "CFO_CFA",
  COMPTEUR_ENERGIE: "COMPTAGE",
  COMPTEUR_CALORIES: "COMPTAGE",
  COMPTEUR_FRIGORIES: "COMPTAGE",
  COMPTEUR_ECS: "COMPTAGE",
  COMPTEUR_GAZ: "COMPTAGE",
  COMPTEUR_ELECTRIQUE: "COMPTAGE",
  SOUS_COMPTEUR_ELEC: "COMPTAGE",
  COMPTEUR_HORAIRE: "COMPTAGE",
  ANALYSEUR_RESEAU: "COMPTAGE",
  SONDE_TEMPERATURE_AMB: "COMPTAGE",
  SONDE_HYGROMETRIE: "COMPTAGE",
  CAPTEUR_CO2: "COMPTAGE",
  CAPTEUR_QUALITE_AIR: "COMPTAGE",
  // PISCINE
  FILTRE_PISCINE: "PISCINE",
  POMPE_FILTRATION: "PISCINE",
  PAC_PISCINE: "PISCINE",
  ECHANGEUR_PISCINE: "PISCINE",
  CHAUDIERE_PISCINE: "PISCINE",
  ELECTROLYSEUR_SEL: "PISCINE",
  TRAITEMENT_CHLORE: "PISCINE",
  TRAITEMENT_UV: "PISCINE",
  TRAITEMENT_OZONE: "PISCINE",
  REGULATEUR_PH: "PISCINE",
  REGULATEUR_CHLORE: "PISCINE",
  POMPE_DOSEUSE: "PISCINE",
  SONDE_PH: "PISCINE",
  SONDE_REDOX: "PISCINE",
  SONDE_TEMPERATURE_EAU: "PISCINE",
  DESHUMIDIFICATEUR: "PISCINE",
  CTA_PISCINE: "PISCINE",
  BACHE_TAMPON: "PISCINE",
  NAGE_CONTRE_COURANT: "PISCINE",
  ROBOT_NETTOYAGE: "PISCINE",
  // Automatisme / Régulation
  AUTOMATE: "CFO_CFA",
  // Climatisation VRV/DRV
  DRV: "CLIMATISATION",
  // Réseaux
  RESEAU_DISTRIBUTION: "CHAUFFAGE",
  RESEAU_ENTERRE: "CHAUFFAGE",
  // Comptage
  COMPTEUR_APPOINT: "COMPTAGE",
  // Pot d'injection / Traitement réseau
  POT_INJECTION: "TRAITEMENT_EAU",
  // Télésurveillance
  TELESURVEILLANCE: "CFO_CFA",
  // Pressostats / Capteurs
  PRESSOSTAT: "CHAUFFAGE",
  MANOMETRE: "COMPTAGE",
  // Thermostats
  THERMOSTAT: "CHAUFFAGE",
  THERMOSTAT_AMBIANCE: "CHAUFFAGE",
  AQUASTAT: "CHAUFFAGE",
  THERMOMETRE: "COMPTAGE",
  // Sécurités hydrauliques
  SOUPAPE_SECURITE: "CHAUFFAGE",
  CLAPET_ANTI_RETOUR: "CHAUFFAGE",
  // Hydraulique / Distribution
  BOUTEILLE_MELANGE: "CHAUFFAGE",
  COLLECTEUR: "CHAUFFAGE",
  SEPARATEUR_AIR: "TRAITEMENT_EAU",
  PURGEUR: "CHAUFFAGE",
  ROBINET_VIDANGE: "CHAUFFAGE",
  VANNE_ISOLEMENT: "CHAUFFAGE",
  VANNE_EQUILIBRAGE: "CHAUFFAGE",
  // Robinetterie
  ROBINET_THERMOSTATIQUE: "CHAUFFAGE",
  TETE_THERMOSTATIQUE: "CHAUFFAGE",
  // Générateurs air chaud
  GENERATEUR_AIR_CHAUD: "CHAUFFAGE",
  AEROTHERME_GAZ: "CHAUFFAGE",
  UNIT_HEATER: "CHAUFFAGE",
  PANNEAU_RAYONNANT: "CHAUFFAGE",
  // Ventilation avancée
  BOUCHE_EXTRACTION: "VENTILATION",
  BOUCHE_SOUFFLAGE: "VENTILATION",
  DIFFUSEUR: "VENTILATION",
  GRILLE_VENTILATION: "VENTILATION",
  PLENUM: "VENTILATION",
  SILENCIEUX: "VENTILATION",
  CLAPET_COUPE_FEU: "VENTILATION",
  HUMIDIFICATEUR: "VENTILATION",
  RIDEAU_AIR: "VENTILATION",
  // Refroidissement
  TOUR_REFROIDISSEMENT: "CLIMATISATION",
  AEROREFRIGERANT: "CLIMATISATION",
  DRY_COOLER: "CLIMATISATION",
  REFROIDISSEUR_ADIABATIQUE: "CLIMATISATION",
  // Unités clim
  UNITE_INTERIEURE: "CLIMATISATION",
  UNITE_EXTERIEURE: "CLIMATISATION",
  CONSOLE_CLIMATISATION: "CLIMATISATION",
  MURAL_CLIMATISATION: "CLIMATISATION",
  ARMOIRE_CLIMATISATION: "CLIMATISATION",
  // Comptage / Mesure
  DEBITMETRE: "COMPTAGE",
  VARIATEUR_FREQUENCE: "CFO_CFA",
  // Détection / Sécurité
  DETECTEUR_FUMEE: "CFO_CFA",
  DETECTEUR_CO: "CFO_CFA",
  // Module / Station
  MODULE_HYDRAULIQUE: "CHAUFFAGE",
  STATION_RELEVAGE: "PLOMBERIE",
  // Solaire thermique
  PANNEAU_SOLAIRE_THERMIQUE: "CHAUFFAGE",
  BALLON_SOLAIRE: "ECS",
  STATION_SOLAIRE: "CHAUFFAGE",
  // Electrovannes / Vannes
  ELECTROVANNE: "CHAUFFAGE",
  ELECTROVANNE_GAZ: "CHAUFFAGE",
  VANNE_2_VOIES: "CHAUFFAGE",
  SERVOMOTEUR: "CHAUFFAGE",
  // Détection gaz
  CENTRALE_DETECTION_GAZ: "CFO_CFA",
  DETECTEUR_GAZ: "CFO_CFA",
  // Extracteurs / Ventilation
  EXTRACTEUR: "VENTILATION",
  CAISSON_VENTILATION: "VENTILATION",
  // Cuves
  CUVE: "CHAUFFAGE",
  CUVE_FIOUL: "CHAUFFAGE",
  CUVE_GAZ: "CHAUFFAGE",
  // Interface / Commande
  ECRAN_TACTILE: "CFO_CFA",
  TELECOMMANDE: "CFO_CFA",
  // Gaines / Conduits
  GAINE: "VENTILATION",
  // Traitement eau
  BAC_SEL: "TRAITEMENT_EAU",
  // Émetteurs
  EMETTEUR: "CHAUFFAGE",
  AUTRE: "AUTRE",
};

// Durée de vie par défaut
const DEFAULT_LIFESPAN: Record<string, number> = {
  CHAUDIERE: 20, CHAUDIERE_CONDENSATION: 20, PAC: 20, PAC_AIR_EAU: 20, PAC_EAU_EAU: 25, PAC_AIR_AIR: 15,
  BRULEUR: 15, RADIATEUR: 30, PLANCHER_CHAUFFANT: 50, CONVECTEUR: 20, AEROTERME: 15, RADIANT_GAZ: 15,
  VANNE_3_VOIES: 15, VANNE_MOTORISEE: 15, POMPE_CHAUFFAGE: 15, CIRCULATEUR: 15, VASE_EXPANSION: 15,
  ECHANGEUR_THERMIQUE: 20, REGULATEUR: 15, SONDE_TEMPERATURE: 10, SONDE_EXTERIEURE: 10,
  BALLON_ECS: 15, BALLON_THERMODYNAMIQUE: 15, PREPARATEUR_ECS_GAZ: 15, ECHANGEUR_ECS: 20,
  POMPE_BOUCLAGE: 15, MITIGEUR_THERMOSTATIQUE: 10, RESISTANCE_ELECTRIQUE: 10,
  VMC: 15, VMC_SIMPLE_FLUX: 15, VMC_DOUBLE_FLUX: 15, CTA: 20, CAISSON_EXTRACTION: 15, CAISSON_SOUFFLAGE: 15,
  VENTILATEUR: 15, REGISTRE: 20, BATTERIE_CHAUDE: 20, BATTERIE_FROIDE: 20, RECUPERATEUR_CHALEUR: 15,
  GROUPE_FROID: 20, CLIMATISATION: 15, CLIMATISEUR: 15, SPLIT: 12, MULTI_SPLIT: 12, CASSETTE: 12, GAINABLE: 15, ROOFTOP: 20,
  ADOUCISSEUR: 15, DISCONNECTEUR: 20, FILTRE: 10, POT_BOUE: 20, DEGAZEUR: 20, DOSEUR: 10,
  COMPTEUR_EAU: 15, VANNE_GENERALE: 30, SURPRESSEUR: 15, BACHE_EAU: 25, REDUCTION_PRESSION: 15,
  ARMOIRE_ELECTRIQUE: 30, ARMOIRE_TGBT: 30, ARMOIRE_TD: 30, ONDULEUR: 10, GROUPE_ELECTROGENE: 25, TRANSFORMATEUR: 35, BAIE_INFORMATIQUE: 15,
  COMPTEUR_ENERGIE: 15, COMPTEUR_CALORIES: 15, COMPTEUR_FRIGORIES: 15, COMPTEUR_ECS: 15, COMPTEUR_GAZ: 15,
  COMPTEUR_ELECTRIQUE: 15, SOUS_COMPTEUR_ELEC: 15, COMPTEUR_HORAIRE: 10, ANALYSEUR_RESEAU: 15,
  SONDE_TEMPERATURE_AMB: 10, SONDE_HYGROMETRIE: 10, CAPTEUR_CO2: 10, CAPTEUR_QUALITE_AIR: 10,
  // PISCINE
  FILTRE_PISCINE: 15, POMPE_FILTRATION: 10, PAC_PISCINE: 12, ECHANGEUR_PISCINE: 15, CHAUDIERE_PISCINE: 20,
  ELECTROLYSEUR_SEL: 5, TRAITEMENT_CHLORE: 10, TRAITEMENT_UV: 8, TRAITEMENT_OZONE: 10,
  REGULATEUR_PH: 8, REGULATEUR_CHLORE: 8, POMPE_DOSEUSE: 8, SONDE_PH: 2, SONDE_REDOX: 2, SONDE_TEMPERATURE_EAU: 10,
  DESHUMIDIFICATEUR: 15, CTA_PISCINE: 20, BACHE_TAMPON: 25, NAGE_CONTRE_COURANT: 15, ROBOT_NETTOYAGE: 5,
  // Automatisme / Régulation
  AUTOMATE: 15,
  // Climatisation VRV/DRV
  DRV: 15,
  // Réseaux
  RESEAU_DISTRIBUTION: 30, RESEAU_ENTERRE: 40,
  // Comptage
  COMPTEUR_APPOINT: 15,
  // Pot d'injection / Traitement réseau
  POT_INJECTION: 20,
  // Télésurveillance
  TELESURVEILLANCE: 10,
  // Pressostats / Capteurs
  PRESSOSTAT: 10, MANOMETRE: 10,
  // Thermostats
  THERMOSTAT: 10, THERMOSTAT_AMBIANCE: 10, AQUASTAT: 10, THERMOMETRE: 10,
  // Sécurités hydrauliques
  SOUPAPE_SECURITE: 15, CLAPET_ANTI_RETOUR: 20,
  // Hydraulique / Distribution
  BOUTEILLE_MELANGE: 25, COLLECTEUR: 30, SEPARATEUR_AIR: 20, PURGEUR: 10,
  ROBINET_VIDANGE: 20, VANNE_ISOLEMENT: 25, VANNE_EQUILIBRAGE: 20,
  // Robinetterie
  ROBINET_THERMOSTATIQUE: 15, TETE_THERMOSTATIQUE: 8,
  // Générateurs air chaud
  GENERATEUR_AIR_CHAUD: 20, AEROTHERME_GAZ: 15, UNIT_HEATER: 15, PANNEAU_RAYONNANT: 20,
  // Ventilation avancée
  BOUCHE_EXTRACTION: 20, BOUCHE_SOUFFLAGE: 20, DIFFUSEUR: 25, GRILLE_VENTILATION: 30,
  PLENUM: 25, SILENCIEUX: 25, CLAPET_COUPE_FEU: 20, HUMIDIFICATEUR: 10, RIDEAU_AIR: 15,
  // Refroidissement
  TOUR_REFROIDISSEMENT: 20, AEROREFRIGERANT: 20, DRY_COOLER: 20, REFROIDISSEUR_ADIABATIQUE: 15,
  // Unités clim
  UNITE_INTERIEURE: 12, UNITE_EXTERIEURE: 15, CONSOLE_CLIMATISATION: 12,
  MURAL_CLIMATISATION: 12, ARMOIRE_CLIMATISATION: 15,
  // Comptage / Mesure
  DEBITMETRE: 15, VARIATEUR_FREQUENCE: 15,
  // Détection / Sécurité
  DETECTEUR_FUMEE: 10, DETECTEUR_CO: 7,
  // Module / Station
  MODULE_HYDRAULIQUE: 20, STATION_RELEVAGE: 15,
  // Solaire thermique
  PANNEAU_SOLAIRE_THERMIQUE: 25, BALLON_SOLAIRE: 20, STATION_SOLAIRE: 15,
  // Electrovannes / Vannes
  ELECTROVANNE: 15, ELECTROVANNE_GAZ: 15, VANNE_2_VOIES: 15, SERVOMOTEUR: 12,
  // Détection gaz
  CENTRALE_DETECTION_GAZ: 15, DETECTEUR_GAZ: 10,
  // Extracteurs / Ventilation
  EXTRACTEUR: 15, CAISSON_VENTILATION: 20,
  // Cuves
  CUVE: 30, CUVE_FIOUL: 30, CUVE_GAZ: 30,
  // Interface / Commande
  ECRAN_TACTILE: 10, TELECOMMANDE: 10,
  // Gaines / Conduits
  GAINE: 30,
  // Traitement eau
  BAC_SEL: 15,
  // Émetteurs
  EMETTEUR: 25,
  AUTRE: 15,
};

// Normalise un texte pour la recherche (minuscules, sans accents, sans apostrophes)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[''`´]/g, " ")          // Remplace apostrophes par espace
    .replace(/[-]/g, " ")             // Remplace tirets par espace
    .replace(/\s+/g, " ")             // Normalise les espaces multiples
    .trim();
}

// Calculate similarity between two strings (0 to 1)
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  // Check for containment (partial match)
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return 0.7 + 0.3 * (minLen / maxLen);
  }

  // Word-based similarity
  const wordsA = a.split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.split(/\s+/).filter(w => w.length > 2);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  let matchedWords = 0;
  for (const wordA of wordsA) {
    for (const wordB of wordsB) {
      if (wordA === wordB || wordA.startsWith(wordB) || wordB.startsWith(wordA)) {
        matchedWords++;
        break;
      }
    }
  }

  return matchedWords / Math.max(wordsA.length, wordsB.length);
}

// Crée un index normalisé des synonymes pour recherche rapide
const NORMALIZED_TYPE_SYNONYMS: Record<string, string> = {};
for (const [key, value] of Object.entries(TYPE_SYNONYMS)) {
  NORMALIZED_TYPE_SYNONYMS[normalize(key)] = value;
}

// Trouve le type d'équipement le plus proche
function findEquipmentType(input: string): string | null {
  const normalized = normalize(input);

  // Essai direct avec le nom uppercase (si déjà au bon format)
  if (TYPE_TO_DOMAIN[input.toUpperCase()]) {
    return input.toUpperCase();
  }

  // Recherche dans les synonymes normalisés
  if (NORMALIZED_TYPE_SYNONYMS[normalized]) {
    return NORMALIZED_TYPE_SYNONYMS[normalized];
  }

  // Recherche partielle (si le texte contient un synonyme)
  for (const [synonym, type] of Object.entries(NORMALIZED_TYPE_SYNONYMS)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return type;
    }
  }

  return null;
}

// Crée un index normalisé des domaines pour recherche rapide
const NORMALIZED_DOMAIN_SYNONYMS: Record<string, string> = {};
for (const [key, value] of Object.entries(DOMAIN_SYNONYMS)) {
  NORMALIZED_DOMAIN_SYNONYMS[normalize(key)] = value;
}

// Trouve le domaine le plus proche
function findDomain(input: string): string | null {
  const normalized = normalize(input);

  if (NORMALIZED_DOMAIN_SYNONYMS[normalized]) {
    return NORMALIZED_DOMAIN_SYNONYMS[normalized];
  }

  // Recherche partielle
  for (const [synonym, domain] of Object.entries(NORMALIZED_DOMAIN_SYNONYMS)) {
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      return domain;
    }
  }

  return null;
}

// Valid audit ratings
const VALID_RATINGS = ["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"];

// Synonymes pour les notes d'audit (incluant les labels contextuels)
const RATING_SYNONYMS: Record<string, string> = {
  // Non évalué
  "non évalué": "NON_EVALUE",
  "non evalue": "NON_EVALUE",
  "non evalué": "NON_EVALUE",
  "n/a": "NON_EVALUE",
  "-": "NON_EVALUE",
  "": "NON_EVALUE",
  // Critique (1)
  "critique": "CRITIQUE",
  "crit": "CRITIQUE",
  "1": "CRITIQUE",
  "degradation majeure": "CRITIQUE",
  "dégradation majeure": "CRITIQUE",
  "defaillant": "CRITIQUE",
  "défaillant": "CRITIQUE",
  "danger immediat": "CRITIQUE",
  "danger immédiat": "CRITIQUE",
  "inaccessible": "CRITIQUE",
  "non conformite majeure": "CRITIQUE",
  "non-conformite majeure": "CRITIQUE",
  "non conformité majeure": "CRITIQUE",
  "non-conformité majeure": "CRITIQUE",
  // Mauvais (2)
  "mauvais": "MAUVAIS",
  "mauv": "MAUVAIS",
  "2": "MAUVAIS",
  "usure importante": "MAUVAIS",
  "sous performant": "MAUVAIS",
  "sous-performant": "MAUVAIS",
  "risques importants": "MAUVAIS",
  "difficile": "MAUVAIS",
  "non conformite mineure": "MAUVAIS",
  "non-conformite mineure": "MAUVAIS",
  "non conformité mineure": "MAUVAIS",
  "non-conformité mineure": "MAUVAIS",
  // Moyen (3)
  "moyen": "MOYEN",
  "moy": "MOYEN",
  "3": "MOYEN",
  "usure normale": "MOYEN",
  "acceptable": "MOYEN",
  "a surveiller": "MOYEN",
  "à surveiller": "MOYEN",
  "limite": "MOYEN",
  "limité": "MOYEN",
  "a verifier": "MOYEN",
  "à vérifier": "MOYEN",
  "a verifer": "MOYEN",
  // Bon (4)
  "bon": "BON",
  "4": "BON",
  "bon etat": "BON",
  "bon état": "BON",
  "performant": "BON",
  "conforme": "BON",
  "accessible": "BON",
  // Excellent (5)
  "excellent": "EXCELLENT",
  "exc": "EXCELLENT",
  "5": "EXCELLENT",
  "etat neuf": "EXCELLENT",
  "état neuf": "EXCELLENT",
  "optimal": "EXCELLENT",
  "securise": "EXCELLENT",
  "sécurisé": "EXCELLENT",
  "certifie": "EXCELLENT",
  "certifié": "EXCELLENT",
};

// Parse rating from input
function parseRating(input: string | undefined): string {
  if (!input || input.trim() === "") return "NON_EVALUE";

  const normalized = normalize(input.trim());

  // Check if already a valid rating
  if (VALID_RATINGS.includes(input.toUpperCase())) {
    return input.toUpperCase();
  }

  // Check synonyms
  if (RATING_SYNONYMS[normalized]) {
    return RATING_SYNONYMS[normalized];
  }

  return "NON_EVALUE";
}

// Parse date from various formats
function parseDate(input: string | undefined): Date | null {
  if (!input || input.trim() === "") return null;

  const trimmed = input.trim();

  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  // Try French format (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try French format (DD-MM-YYYY)
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

interface ImportRow {
  site?: string;
  nom_du_site?: string; // CCTP format (normalized)
  type?: string;
  type_d_equipement?: string; // CCTP format (normalized from "Type d'équipement")
  domaine?: string;
  domain?: string;
  nom?: string;
  name?: string;
  marque?: string;
  brand?: string;
  modele?: string;
  model?: string;
  modèle?: string; // French accent
  numero_serie?: string;
  serial_number?: string;
  annee?: string;
  year?: string;
  année?: string; // French accent
  puissance?: string;
  power?: string;
  quantite?: string;
  quantity?: string;
  quantité?: string; // French accent
  local?: string;
  location?: string;
  niveau?: string;
  level?: string;
  duree_vie?: string;
  lifespan?: string;
  etat?: string; // Equipment status (CCTP format)
  // Audit fields
  date_audit?: string;
  audit_date?: string;
  auditeur?: string;
  auditor?: string;
  etat_visuel?: string;
  visual_state?: string;
  performance?: string;
  securite?: string;
  security?: string;
  accessibilite?: string;
  accessibility?: string;
  conformite?: string;
  compliance?: string;
  notes?: string;
  general_notes?: string;
  [key: string]: string | undefined; // Allow any other columns
}

// POST /api/equipments/import - Preview import
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { rows, contractId, preview = true, siteMappings = {}, saveAliases = false } = body as {
      rows: ImportRow[];
      contractId: string;
      preview?: boolean;
      siteMappings?: Record<string, string>; // Excel site name -> siteId
      saveAliases?: boolean; // Save mappings as aliases for future imports
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée à importer" },
        { status: 400 }
      );
    }

    if (!contractId) {
      return NextResponse.json(
        { error: "ID du contrat requis" },
        { status: 400 }
      );
    }

    // Get sites for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: { site: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json(
        { error: "Aucun site associé à ce contrat" },
        { status: 400 }
      );
    }

    // Get site aliases for this organization
    const siteAliases = await prisma.siteAlias.findMany({
      where: { organizationId: user.organizationId },
      select: { alias: true, siteId: true },
    });

    // Build alias map (normalized alias -> siteId)
    const aliasMap = new Map<string, string>();
    for (const alias of siteAliases) {
      aliasMap.set(normalize(alias.alias), alias.siteId);
    }

    // Build site name -> id mapping
    const siteMap = new Map<string, string>();
    for (const cs of contractSites) {
      const name = normalize(cs.site.name);
      siteMap.set(name, cs.siteId);
      // Also try with city
      const nameWithCity = normalize(`${cs.site.name} ${cs.site.city || ""}`);
      siteMap.set(nameWithCity, cs.siteId);
    }

    // Set of valid site IDs for this contract (for alias validation)
    const contractSiteIds = new Set(contractSites.map(cs => cs.siteId));

    // Get existing equipment for duplicate detection
    const siteIds = contractSites.map((cs) => cs.siteId);
    const existingEquipments = await prisma.equipment.findMany({
      where: {
        siteId: { in: siteIds },
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        serialNumber: true,
        siteId: true,
        type: true,
        brand: true,
        model: true,
      },
    });

    // Build duplicate detection indexes
    const serialNumberSet = new Set<string>();
    const equipmentSignatureSet = new Set<string>();
    for (const eq of existingEquipments) {
      if (eq.serialNumber) {
        serialNumberSet.add(normalize(eq.serialNumber));
      }
      // Signature: siteId + type + brand + model (normalized)
      const signature = `${eq.siteId}|${eq.type}|${normalize(eq.brand || "")}|${normalize(eq.model || "")}`;
      equipmentSignatureSet.add(signature);
    }

    // Build list of available sites for suggestions
    const availableSites = contractSites.map(cs => ({
      id: cs.siteId,
      name: cs.site.name,
      city: cs.site.city,
    }));

    // Track unmatched sites for mapping UI
    const unmatchedSites = new Map<string, {
      excelName: string;
      rowCount: number;
      suggestions: Array<{ id: string; name: string; city: string | null; score: number }>;
    }>();

    // Process rows
    const results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      type?: string;
      typeParsed?: string;
      domain?: string;
      site?: string;
      siteId?: string;
      name?: string;
      brand?: string;
      model?: string;
      serialNumber?: string;
      year?: number;
      power?: number;
      quantity?: number;
      location?: string;
      level?: string;
      lifespan?: number;
      message?: string;
      isDuplicate?: boolean;
      // Site mapping
      needsSiteMapping?: boolean;
      siteSuggestions?: Array<{ id: string; name: string; city: string | null; score: number }>;
      // Audit fields
      hasAudit?: boolean;
      auditDate?: string;
      auditor?: string;
      visualState?: string;
      performance?: string;
      security?: string;
      accessibility?: string;
      compliance?: string;
      generalNotes?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result: typeof results[0] = {
        row: i + 1,
        status: "ok",
      };

      // Find site (support multiple column names)
      const siteName = (row.site || row.nom_du_site)?.trim();
      if (!siteName) {
        result.status = "error";
        result.message = "Nom du site manquant";
        results.push(result);
        continue;
      }

      // Try to match site
      let siteId: string | undefined;
      const normalizedSite = normalize(siteName);

      // 0. Try user-provided site mapping first (from UI)
      if (siteMappings[siteName] && contractSiteIds.has(siteMappings[siteName])) {
        siteId = siteMappings[siteName];
      }
      // Also try with normalized name
      if (!siteId && siteMappings[normalizedSite] && contractSiteIds.has(siteMappings[normalizedSite])) {
        siteId = siteMappings[normalizedSite];
      }

      // 1. Try alias match (priority)
      if (!siteId && aliasMap.has(normalizedSite)) {
        const aliasedSiteId = aliasMap.get(normalizedSite)!;
        // Only use alias if site is in this contract
        if (contractSiteIds.has(aliasedSiteId)) {
          siteId = aliasedSiteId;
        }
      }

      // 2. Try exact match on site name
      if (!siteId && siteMap.has(normalizedSite)) {
        siteId = siteMap.get(normalizedSite);
      }

      // 3. Try partial match
      if (!siteId) {
        for (const [name, id] of siteMap.entries()) {
          if (name.includes(normalizedSite) || normalizedSite.includes(name)) {
            siteId = id;
            break;
          }
        }
      }

      // 4. Try prefix match (for truncated names)
      if (!siteId) {
        const normalizedNoSpace = normalizedSite.replace(/\s+/g, "");
        for (const [name, id] of siteMap.entries()) {
          const siteNameNoSpace = name.replace(/\s+/g, "");
          if (siteNameNoSpace.startsWith(normalizedNoSpace) && normalizedNoSpace.length >= 6) {
            siteId = id;
            break;
          }
        }
      }

      if (!siteId) {
        // Calculate suggestions for this unmatched site
        const suggestions = availableSites.map(s => {
          const siteNorm = normalize(s.name);
          const score = calculateSimilarity(normalizedSite, siteNorm);
          return { ...s, score };
        }).sort((a, b) => b.score - a.score).slice(0, 5);

        // Track unmatched site for summary
        if (!unmatchedSites.has(normalizedSite)) {
          unmatchedSites.set(normalizedSite, {
            excelName: siteName,
            rowCount: 1,
            suggestions,
          });
        } else {
          unmatchedSites.get(normalizedSite)!.rowCount++;
        }

        result.status = "error";
        result.message = `Site "${siteName}" non trouvé dans le contrat`;
        result.site = siteName;
        result.needsSiteMapping = true;
        result.siteSuggestions = suggestions;
        results.push(result);
        continue;
      }

      result.site = siteName;
      result.siteId = siteId;

      // Find type (support multiple column names including CCTP format)
      const typeInput = (row.type || row.type_d_equipement)?.trim();
      if (!typeInput) {
        result.status = "error";
        result.message = "Type d'équipement manquant";
        results.push(result);
        continue;
      }

      const parsedType = findEquipmentType(typeInput);
      if (!parsedType) {
        result.status = "error";
        result.message = `Type "${typeInput}" non reconnu`;
        result.type = typeInput;
        results.push(result);
        continue;
      }

      result.type = typeInput;
      result.typeParsed = parsedType;

      // Domain (auto from type or from input)
      const domainInput = row.domaine || row.domain;
      if (domainInput) {
        const parsedDomain = findDomain(domainInput);
        result.domain = parsedDomain || TYPE_TO_DOMAIN[parsedType] || "AUTRE";
        if (!parsedDomain) {
          result.status = "warning";
          result.message = `Domaine "${domainInput}" non reconnu, utilisation de ${result.domain}`;
        }
      } else {
        result.domain = TYPE_TO_DOMAIN[parsedType] || "AUTRE";
      }

      // Other fields
      result.name = row.nom || row.name || undefined;
      result.brand = row.marque || row.brand || undefined;
      result.model = row.modele || row.model || row.modèle || undefined;
      result.serialNumber = row.numero_serie || row.serial_number || undefined;
      result.location = row.local || row.location || undefined;
      result.level = row.niveau || row.level || undefined;

      // Numeric fields
      const yearStr = row.annee || row.year || row.année;
      if (yearStr) {
        const year = parseInt(yearStr);
        if (!isNaN(year) && year >= 1950 && year <= new Date().getFullYear()) {
          result.year = year;
        }
      }

      const powerStr = row.puissance || row.power;
      if (powerStr) {
        const power = parseFloat(powerStr.replace(",", "."));
        if (!isNaN(power) && power > 0) {
          result.power = power;
        }
      }

      const quantityStr = row.quantite || row.quantity || row.quantité;
      if (quantityStr) {
        const quantity = parseInt(quantityStr);
        if (!isNaN(quantity) && quantity > 0) {
          result.quantity = quantity;
        }
      }

      const lifespanStr = row.duree_vie || row.lifespan;
      if (lifespanStr) {
        const lifespan = parseInt(lifespanStr);
        if (!isNaN(lifespan) && lifespan > 0) {
          result.lifespan = lifespan;
        }
      } else {
        result.lifespan = DEFAULT_LIFESPAN[parsedType] || 15;
      }

      // Parse audit fields if present
      const auditDateStr = row.date_audit || row.audit_date;
      const hasAuditData = auditDateStr || row.etat_visuel || row.visual_state || row.etat ||
                          row.performance || row.securite || row.security ||
                          row.accessibilite || row.accessibility || row.conformite || row.compliance;

      if (hasAuditData) {
        result.hasAudit = true;
        const auditDate = parseDate(auditDateStr);
        result.auditDate = auditDate ? auditDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        result.auditor = row.auditeur || row.auditor || undefined;
        result.visualState = parseRating(row.etat_visuel || row.visual_state || row.etat);
        result.performance = parseRating(row.performance);
        result.security = parseRating(row.securite || row.security);
        result.accessibility = parseRating(row.accessibilite || row.accessibility);
        result.compliance = parseRating(row.conformite || row.compliance);
        result.generalNotes = row.notes || row.general_notes || undefined;
      }

      // Duplicate detection
      let isDuplicate = false;
      let duplicateReason = "";

      // Check by serial number first (if provided)
      if (result.serialNumber) {
        const normalizedSerial = normalize(result.serialNumber);
        if (serialNumberSet.has(normalizedSerial)) {
          isDuplicate = true;
          duplicateReason = `N° série "${result.serialNumber}" existe déjà`;
        }
      }

      // Check by signature (site + type + brand + model) if no serial number match
      if (!isDuplicate && result.siteId && result.typeParsed) {
        const signature = `${result.siteId}|${result.typeParsed}|${normalize(result.brand || "")}|${normalize(result.model || "")}`;
        if (equipmentSignatureSet.has(signature)) {
          isDuplicate = true;
          duplicateReason = `Équipement similaire existe déjà (même site, type, marque, modèle)`;
        }
      }

      if (isDuplicate) {
        result.status = "warning";
        result.isDuplicate = true;
        result.message = duplicateReason;
      }

      results.push(result);
    }

    // If preview, just return results
    if (preview) {
      const validCount = results.filter((r) => r.status !== "error").length;
      const errorCount = results.filter((r) => r.status === "error").length;
      const warningCount = results.filter((r) => r.status === "warning").length;

      return NextResponse.json({
        preview: true,
        total: rows.length,
        valid: validCount,
        errors: errorCount,
        warnings: warningCount,
        results,
        // Site mapping data for UI
        unmatchedSites: Array.from(unmatchedSites.values()),
        availableSites,
      });
    }

    // Save site mappings as aliases if requested
    if (saveAliases && Object.keys(siteMappings).length > 0) {
      for (const [excelName, siteId] of Object.entries(siteMappings)) {
        if (contractSiteIds.has(siteId)) {
          // Check if alias already exists
          const existingAlias = await prisma.siteAlias.findFirst({
            where: {
              organizationId: user.organizationId,
              alias: excelName,
            },
          });

          if (!existingAlias) {
            await prisma.siteAlias.create({
              data: {
                alias: excelName,
                siteId,
                organizationId: user.organizationId,
              },
            });
          }
        }
      }
    }

    // Import valid rows (exclude errors and duplicates)
    const validRows = results.filter((r) => r.status === "ok" && r.siteId && r.typeParsed);
    const duplicateRows = results.filter((r) => r.isDuplicate);
    let created = 0;

    for (const row of validRows) {
      try {
        // Create equipment with optional audit
        const equipment = await prisma.equipment.create({
          data: {
            name: row.name || undefined,
            domain: row.domain as "CHAUFFAGE" | "ECS" | "VENTILATION" | "CLIMATISATION" | "TRAITEMENT_EAU" | "PLOMBERIE" | "CFO_CFA" | "COMPTAGE" | "AUTRE",
            type: row.typeParsed as "CHAUDIERE" | "CIRCULATEUR", // Type assertion for Prisma
            brand: row.brand || undefined,
            model: row.model || undefined,
            serialNumber: row.serialNumber || undefined,
            year: row.year || undefined,
            power: row.power || undefined,
            quantity: row.quantity || undefined,
            location: row.location || undefined,
            level: row.level || undefined,
            theoreticalLifespan: row.lifespan || undefined,
            siteId: row.siteId!,
            organizationId: user.organizationId,
          },
        });

        // Create audit if audit data is present
        if (row.hasAudit && equipment.id) {
          await prisma.equipmentAudit.create({
            data: {
              equipmentId: equipment.id,
              auditDate: row.auditDate ? new Date(row.auditDate) : new Date(),
              auditor: row.auditor || null,
              visualState: row.visualState as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
              performance: row.performance as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
              security: row.security as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
              accessibility: row.accessibility as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
              compliance: row.compliance as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
              generalNotes: row.generalNotes || null,
            },
          });
        }

        created++;
      } catch (err) {
        console.error(`Error creating equipment for row ${row.row}:`, err);
      }
    }

    return NextResponse.json({
      preview: false,
      total: rows.length,
      created,
      skipped: duplicateRows.length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    console.error("Error importing equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des équipements" },
      { status: 500 }
    );
  }
}
