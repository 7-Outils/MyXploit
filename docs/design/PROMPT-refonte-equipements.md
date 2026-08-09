# Refonte de l'onglet Synthèse — Exploitation › Équipements

## Référence visuelle

Le mockup validé est dans `docs/design/equipements-synthese-mockup.html`. **Ouvre-le d'abord** : c'est la source de vérité pour la structure, la hiérarchie, le wording et les interactions. Reproduis-le fidèlement en React — ne réinterprète pas le design.

## Contexte code

- Onglet actuel : `src/components/exploitation/tabs/EquipementsTab.tsx` (à refondre) ; page hôte : `src/app/(dashboard)/exploitation/page.tsx`.
- Thème : couleurs de `tailwind.config.ts` (`primary #0F1E33`, `accent #2563EB`, fonds `#FFFFFF`/`#F8FAFB`). Style « éditorial bureau d'études » comme la landing : **angles droits** (pas de rounded sur cartes/boutons), titres de cartes en **mono uppercase letter-spacing large** (même pattern que les `figcaption` de `components/landing/hero.tsx`), Inter en corps.
- Data fetching : utiliser **SWR** (déjà en dépendance), pas de fetch dans useEffect.
- Feedback utilisateur : le système de toasts de `components/ui/toast.tsx` — **aucun `alert()`/`confirm()`**.

## Écran cible : 4 cartes, rien d'autre

### 1. État du parc (colonne gauche, EN PREMIER — c'est l'info principale)
- Barre empilée « Ensemble du parc » (Bon/Moyen/Dégradé/Critique) + légende chiffrée (compte par état).
- Détail par domaine (`EquipmentDomain`) replié derrière un `<details>` natif « Détail par domaine » (chevron qui pivote).
- Source : dernière notation par équipement (`EquipmentAudit` / `TechnicalAudit`).
- Pied de carte « couverture d'audit », formulé en reste-à-faire : « N équipements à visiter pour boucler la campagne annuelle (obligation CCTP), dont X jamais audités — dernière campagne : {mois année} · Planifier → ». Source : dates des derniers audits par équipement.

### 2. Renouvellement du parc (colonne droite)
- Entonnoir 2 chiffres : « N au-delà de leur durée de vie théorique → dont M non couverts par le plan de renouvellement P3 (≈ X k€) ». Seul le second chiffre est en rouge.
- Graphique en colonnes empilées replié derrière `<details>` « Programmation par année — pic {année} : X k€, dont Y hors plan » : par année, bleu accent = **prévu au plan de renouvellement contractuel (P3)**, orange = **en dépassement de durée de vie, absent du plan** (tooltip « Hors plan : X k€ »).
- ⚠️ Sémantique métier : la référence est **le plan de renouvellement du contrat**, jamais la fin de vie théorique seule (en garantie totale, l'exploitant remplace souvent sur panne). La théorie ne sert qu'à détecter ce qui MANQUE au plan.
- Durées de vie théoriques par type : réutiliser celles de `src/lib/pricing/equipment-pricing.ts`.

### 3. Actions prioritaires (rangée bas, large)
- Tableau : équipement (+ site, année, âge), constat (badge Critique/Dégradé/Moyen avec pastille), action proposée (verbe métier : « Remplacement à programmer », « Devis P3 à exiger de l'exploitant », « Action corrective exploitant sous 15 j »), coût estimé. 5 lignes max + « Tout voir (N) → ».
- Source : audits critiques/dégradés + leurs recommandations (`AuditRecommendation`).

### 4. Conformité réglementaire (rangée bas, étroite)
- Jauge « Contrôles à jour : N % » (fill vert, track vert 15 %).
- Liste des contrôles en retard/à venir : pastille couleur statut + type + périodicité + sites concernés + échéance (« +42 j » = dépassement vs périodicité réglementaire depuis le dernier contrôle). Source : `RegulatoryControl` + `RegulatoryControlType.frequency`.
- Lien d'action « Relancer l'exploitant (courrier type) → » (peut être un stub).

### Chrome de page
- En-tête : titre + sous-titre (« N équipements suivis sur M sites · dernière mise à jour inventaire »), boutons Exporter / Importer / Nouvel équipement.
- Onglets avec compteurs d'alerte : Synthèse · Inventaire (N) · État & audits · Renouvellement · Conformité (badge rouge si retards).
- Filtres : Site, Domaine, recherche. **PAS de sélecteur de contrat** (déjà porté par la nav).

## Règles de design (non négociables — issues de la revue)

1. **Un chiffre n'apparaît que s'il déclenche un geste métier.** Pas de « total équipements » en KPI, pas d'« âge moyen », pas de « fin de vie sous 3 ans ».
2. **Une info n'existe qu'à UN seul endroit de l'écran.** Aucun doublon entre tuiles, cartes et notes.
3. **La référence est toujours le contrat, pas la théorie** (plan de renouvellement P3, périodicités réglementaires).
4. Détail derrière `<details>` natif ; l'état replié doit rester porteur des chiffres clés.
5. Pas d'emoji, pas d'encadrés d'alerte décoratifs — pastilles CSS et texte sobre.
6. Tooltips au survol sur toutes les barres (valeurs + libellés), textes en couleurs d'encre (jamais la couleur de série sur du texte).

## Étapes demandées

1. Lis le mockup HTML, `EquipementsTab.tsx` actuel, et les modèles Prisma concernés (`Equipment`, `EquipmentAudit`, `TechnicalAudit`, `AuditRecommendation`, `RegulatoryControl`, `Quote`, `WorkOrder`).
2. **Avant de coder**, liste ce qui manque en base pour alimenter l'écran — notamment : durée de vie théorique par type d'équipement (si absente du schéma, réutiliser/déplacer les constantes de `equipment-pricing.ts`) et la notion de **plan de renouvellement contractuel** (probablement un nouveau modèle ou des champs `plannedReplacementYear` / `coveredByP3` — propose la migration Prisma et attends validation).
3. Crée UN endpoint de synthèse agrégée (ex. `GET /api/equipments/synthesis?siteId=&domain=`) qui renvoie tout l'écran en une requête — pas 6 fetchs.
4. Implémente les composants en découpant : `EquipmentsSynthesis.tsx` + un composant par carte. Réutilise `components/ui/` existants.
5. Vérifie à la fin : zéro info dupliquée, états vides gérés (« aucun audit », « aucun plan de renouvellement saisi »), responsive 1 colonne < 980 px.
