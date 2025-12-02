# MyExploit

Plateforme SaaS de pilotage des marchés d'exploitation CVC et suivi de performance énergétique des bâtiments publics.

## Stack technique

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + composants custom
- **Icons**: Lucide React

## Installation

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev

# Build pour production
npm run build

# Lancer en production
npm start
```

## Structure du projet

```
src/
├── app/                    # App Router Next.js
│   ├── globals.css        # Styles globaux + Tailwind
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Page d'accueil (landing)
├── components/
│   ├── landing/           # Composants de la landing page
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── modules.tsx
│   │   ├── stats.tsx
│   │   ├── pricing.tsx
│   │   ├── testimonials.tsx
│   │   └── cta.tsx
│   ├── layout/            # Composants de layout
│   │   ├── header.tsx
│   │   └── footer.tsx
│   └── ui/                # Composants UI réutilisables
│       ├── button.tsx
│       └── logo.tsx
├── lib/
│   └── utils.ts           # Utilitaires (cn, etc.)
└── types/                 # Types TypeScript
```

## Branding

- **Primary dark**: #12161F (navy profond)
- **Primary accent**: #3A7E85 (teal)
- **Secondary accent**: #65C2C9 (teal clair)
- **Background**: #FFFFFF et #F8FAFB
- **Text**: #12161F (titres), #4A5568 (corps)

## Prochaines étapes

1. [ ] Auth (NextAuth.js ou Clerk)
2. [ ] Base de données (PostgreSQL + Prisma)
3. [ ] Dashboard principal
4. [ ] Module Sites/Patrimoine
5. [ ] Module Suivi énergétique
6. [ ] Module Facturation
