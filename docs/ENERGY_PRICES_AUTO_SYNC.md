# Synchronisation automatique des prix de l'énergie

## Vue d'ensemble

Le système de synchronisation automatique récupère quotidiennement les prix de référence du gaz naturel depuis des sources publiques gratuites.

## Sources de données

### 1. CEE (Certificats d'Économies d'Énergie)
- **Source**: EMMY (Registre national des CEE)
- **URL**: https://www.emmy.fr/public/donnees-mensuelles
- **Fréquence de mise à jour**: Mensuelle
- **Méthode**: Web scraping HTML

### 2. PEG (Point d'Échange de Gaz)
- **Source**: JeChange.fr
- **URL**: https://www.jechange.fr/energie/gaz/guides/prix-peg
- **Fréquence de mise à jour**: Quotidienne
- **Méthode**: Web scraping HTML

### 3. TICGN (Taxe Intérieure Consommation Gaz Naturel)
- **Source**: Valeurs codées en dur (mises à jour annuellement)
- **Fréquence de mise à jour**: Annuelle (1er février)
- **Méthode**: Valeurs statiques dans le code

### 4. TVD (Tarif de Distribution)
- **Source**: Saisie manuelle recommandée
- **Raison**: Variable selon zone géographique et profil de consommation
- **Fréquence de mise à jour**: Manuel

## Configuration

### Variables d'environnement

Ajoutez dans votre fichier `.env.local` :

```bash
# Cron job secret pour la synchronisation automatique
CRON_SECRET=votre_secret_unique_ici
```

⚠️ **Important**: Changez cette valeur en production pour sécuriser l'endpoint.

### Vercel Cron (Automatique)

Le fichier `vercel.json` configure un cron job Vercel qui s'exécute automatiquement:

```json
{
  "crons": [
    {
      "path": "/api/energy-prices/sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule**: Tous les jours à 2h00 du matin (UTC)

## Utilisation

### Synchronisation manuelle via l'interface

1. Accédez à l'onglet "Prix de référence" dans la section "Suivi énergétique"
2. Cliquez sur le bouton "Synchroniser"
3. Les prix seront automatiquement récupérés et mis à jour

### Synchronisation via API

```bash
# Avec authentification utilisateur
curl -X POST https://votre-domaine.com/api/energy-prices/sync \
  -H "Cookie: your-session-cookie"

# Avec le secret cron (pour automatisation)
curl -X POST https://votre-domaine.com/api/energy-prices/sync \
  -H "Authorization: Bearer votre_cron_secret"
```

### Réponse API

```json
{
  "success": true,
  "message": "Synchronisation des prix terminée",
  "results": {
    "updated": ["CEE", "PEG", "TICGN"],
    "failed": [],
    "errors": []
  },
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

## Architecture

### Endpoint de synchronisation

**Fichier**: `/src/app/api/energy-prices/sync/route.ts`

**Fonctionnalités**:
- Authentification double: Secret cron OU utilisateur connecté
- Récupération automatique depuis sources publiques
- Gestion d'erreurs robuste
- Logging détaillé des succès/échecs

### Fonctions de scraping

#### `fetchCEEPrice()`
Récupère le prix CEE depuis EMMY en parsant le HTML de la page publique.

**Fallback**: 8.49 €/MWh si le scraping échoue

#### `fetchPEGPrice()`
Récupère le prix PEG depuis JeChange.fr en parsant le HTML.

**Fallback**: 27.0 €/MWh si le scraping échoue

## Mise à jour des valeurs TICGN

Pour ajouter une nouvelle année:

1. Éditez `/src/app/api/energy-prices/sync/route.ts`
2. Ajoutez l'année dans l'objet `ticgnValues`:

```typescript
const ticgnValues: Record<number, number> = {
  2024: 16.37,
  2025: 19.83,
  2026: 19.83,
  2027: 20.50, // Nouvelle valeur à ajouter
};
```

3. Redéployez l'application

## Monitoring

### Logs Vercel

Les logs de synchronisation sont disponibles dans:
- Vercel Dashboard > Votre projet > Logs
- Filtrez par `/api/energy-prices/sync`

### Vérification manuelle

1. Accédez à l'interface des prix de référence
2. Vérifiez les dates de dernière mise à jour
3. Vérifiez la source indiquée pour chaque prix

## Dépannage

### La synchronisation échoue

1. **Vérifier les logs**: Consultez les erreurs dans Vercel
2. **Tester manuellement**: Appelez l'endpoint via curl
3. **Vérifier les sources**: Les sites EMMY ou JeChange peuvent avoir changé de structure

### Les prix ne se mettent pas à jour

1. **Vérifier le cron**: Dans Vercel Dashboard > Cron Jobs
2. **Vérifier CRON_SECRET**: Doit être défini dans les variables d'environnement
3. **Vérifier les permissions**: L'utilisateur doit être ADMIN ou MANAGER

### Problèmes de scraping

Si les sources changent de structure HTML:

1. Inspectez manuellement la page source
2. Mettez à jour les regex dans `fetchCEEPrice()` ou `fetchPEGPrice()`
3. Testez localement avant de déployer

## Limites et considérations

### Légales
- Le scraping est utilisé uniquement sur des données publiques
- Respecte les conditions d'utilisation des sites sources
- Pas de sollicitation excessive (1 requête/jour maximum)

### Techniques
- Dépend de la structure HTML des sites tiers
- Peut nécessiter des mises à jour si les sites changent
- Fallback sur des valeurs raisonnables en cas d'échec

### Alternatives futures

Envisager l'utilisation d'APIs officielles si elles deviennent disponibles:
- API EMMY (si déployée)
- API gouvernementale pour les taxes
- Flux de données open data

## Sécurité

### Protection de l'endpoint

L'endpoint `/api/energy-prices/sync` est protégé par:
1. Secret cron (pour automatisation)
2. OU authentification utilisateur avec rôle >= MANAGER

### Recommandations

- Changez `CRON_SECRET` en production
- Utilisez un générateur de secrets aléatoires
- Ne commitez jamais le secret dans Git
- Rotez le secret régulièrement

## Maintenance

### Mensuelle
- Vérifier que les prix sont à jour
- Comparer avec les sources officielles

### Annuelle
- Mettre à jour la valeur TICGN (février)
- Vérifier la validité des sources de scraping
- Tester la synchronisation complète

## Support

En cas de problème:
1. Consultez les logs Vercel
2. Vérifiez ce document
3. Testez manuellement via l'interface
4. Contactez l'équipe technique si nécessaire
