# Prisma Database Seeding

Ce dossier contient le script de seed pour peupler la base de données avec des données de test.

## Prérequis

1. Base de données PostgreSQL configurée
2. Variables d'environnement dans `.env`:
   ```env
   DATABASE_URL="postgresql://..."
   JWT_SECRET="your_secret_here"
   ```

## Utilisation

### Exécuter le seed complet

```bash
npm run seed
# ou
npm run db:seed
# ou avec Prisma directement
npx prisma db seed
```

### Reset + Seed (⚠️ ATTENTION: Efface toutes les données)

```bash
npx prisma migrate reset
```

Cette commande va:
1. Supprimer toutes les données
2. Réappliquer toutes les migrations
3. Exécuter automatiquement le seed

## Données créées

### 🏢 Organisations (3)
- **Ville de Lyon** (orgDemo) - Organisation de démonstration complète
- **SAGE** (orgSage) - Organisation test
- **TEPI** (orgTepi) - Organisation test

### 👥 Utilisateurs (6)

| Email | Role | Organisation | Password |
|-------|------|--------------|----------|
| `admin@myxploit.fr` | SUPER_ADMIN | Ville de Lyon | password123 |
| `admin@lyon.fr` | ADMIN | Ville de Lyon | password123 |
| `technicien@lyon.fr` | EDITOR | Ville de Lyon | password123 |
| `consultant@lyon.fr` | READER | Ville de Lyon | password123 |
| `admin@sage.fr` | ADMIN | SAGE | password123 |
| `admin@tepi.fr` | ADMIN | TEPI | password123 |

### 🏗️ Sites (4)
- Lycée Louis-le-Grand (Paris)
- Piscine Municipale des Gratte-Ciel (Villeurbanne)
- Mairie de Quartier Part-Dieu (Lyon)
- Gymnase Jean Macé (Lyon)

### 📋 Contrats (2)
- CONT-2024-001: Maintenance Chauffage Lyon Centre (Engie Solutions)
- CONT-2024-002: Multi-technique Équipements Sportifs (SPIE Facilities)

### 🔧 Équipements (3)
- Chaudière gaz Viessmann Vitodens 200
- Pompe à chaleur Daikin
- CTA double flux Aldes

### 💰 Factures (3)
- FACT-2024-001: 12 450€ (Payée)
- FACT-2024-002: 8 750€ (Payée)
- FACT-2024-003: 15 200€ (En attente)

### 📄 Devis (2)
- DEV-2024-001: Remplacement chaudière (45 000€)
- DEV-2024-002: Installation système GTC (28 500€)

### 🚨 Alertes (2)
- Température anormale chaudière (HIGH)
- Échéance contrat dans 3 mois (MEDIUM)

### 📅 Réunions (2)
- Point mensuel maintenance (15/04/2024)
- Présentation projet renovation énergétique (22/04/2024)

### 🔧 Modules
Tous les 7 modules sont activés pour toutes les organisations:
- ENERGY (Suivi énergétique)
- FINANCIER (Suivi financier)
- ADMINISTRATIF (Suivi administratif)
- EXPLOITATION (Suivi exploitation)
- OUTILS (Boîte à outils)
- CONTRACTS (Gestion contrats)
- PRICING (Tarification)

## Développement

### Modifier le seed

Le fichier `seed.ts` est en TypeScript et peut être modifié pour:
- Ajouter plus de données
- Créer d'autres organisations
- Ajuster les données de test

### Structure des données

Le script suit cet ordre pour respecter les contraintes de clés étrangères:
1. Organizations
2. OrganizationModules
3. Users
4. Sites
5. Contracts
6. ContractSites
7. Equipments
8. Invoices
9. Quotes
10. Alerts
11. Meetings

### Nettoyer les données sans migrations

Si vous voulez juste nettoyer les données sans toucher au schéma:

```bash
# Exécuter le seed (qui nettoie d'abord)
npm run seed
```

## Troubleshooting

### Erreur: "JWT_SECRET is not defined"
Ajoutez `JWT_SECRET` dans votre `.env`:
```bash
# Générer un secret sécurisé
openssl rand -base64 32
# Ajouter au .env
echo "JWT_SECRET=your_generated_secret" >> .env
```

### Erreur: "Cannot connect to database"
Vérifiez que `DATABASE_URL` est correct dans `.env` et que PostgreSQL est démarré.

### Erreur: "Foreign key constraint failed"
Le seed nettoie les données dans le bon ordre. Si vous voyez cette erreur:
1. Faites un reset complet: `npx prisma migrate reset`
2. Ou supprimez manuellement les données via Prisma Studio: `npx prisma studio`

## Prisma Studio

Pour visualiser les données créées:

```bash
npx prisma studio
```

Ouvre une interface web sur http://localhost:5555 pour explorer la base de données.
