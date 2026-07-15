# Suivi des statistiques joueurs — conception et implémentation

Ce document décrit le suivi de carrière local des joueurs du Tafaron. Il sert de référence fonctionnelle, technique et de recette.

## Périmètre

- Les statistiques sont disponibles uniquement depuis le navigateur de l’ordinateur principal, via `/stats`.
- Seules les parties terminées naturellement avec `finishedReason: "complete"` sont comptées.
- Les parties en préparation, en cours, terminées plus tôt ou supprimées ne contribuent pas aux statistiques.
- Les fichiers JSON de `data/games/` restent la source de vérité et ne sont jamais réécrits par le suivi statistique.
- Il n’existe ni compte cloud, ni accès téléphone, ni comparaison directe entre joueurs, ni export des agrégats dans cette version.

## Identité des joueurs

Les identifiants de joueurs étant propres à chaque partie, les carrières sont rapprochées par le nom. La clé normalisée supprime les espaces superflus, la casse et les accents : `Émile`, `emile` et ` ÉMILE ` désignent donc le même profil par défaut.

Le fichier versionné `data/player-profiles.json` contient :

- un UUID, un nom canonique modifiable, des alias normalisés et des dates pour chaque profil ;
- les affectations explicites d’une apparition `{gameId}:{playerId}` à un profil ;
- aucun score ni agrégat calculé.

Le fichier est créé et mis à jour atomiquement. Au premier lancement, toutes les apparitions des sauvegardes existantes amorcent automatiquement les profils. Une affectation explicite est prioritaire sur un alias : elle permet de séparer deux personnes portant le même nom. L’admin local peut aussi renommer un profil, ajouter un alias, fusionner deux profils ou réaffecter plusieurs apparitions sans toucher aux parties sources.

Un profil sans partie admissible reste visible comme inactif dans la gestion des identités. Il ne peut être supprimé que lorsqu’aucune sauvegarde ne le référence encore. Si le fichier des profils est illisible, le serveur ne l’écrase pas et renvoie une erreur explicite dans l’interface admin.

## Règles de calcul

La date d’une partie est la date de validation de sa dernière manche, avec `updatedAt` comme repli pour les anciennes sauvegardes.

Le score le plus bas gagne. Les égalités utilisent le classement compétition (`1, 1, 3`) : tous les premiers ex æquo reçoivent une victoire partagée. Une place de 1 à 3 compte comme podium.

Chaque profil expose :

- parties, victoires, pourcentage de victoire ;
- podiums, pourcentage de podium et place moyenne ;
- score final moyen, meilleur et pire score ;
- évolution chronologique de la place et du score ;
- historique des parties, participants, paramètres de score et contrats actifs.

Les scores bruts issus de nombres de joueurs ou de barèmes différents sont affichés avec un avertissement de non-comparabilité.

Pour chaque contrat, deux perspectives sont calculées :

- **Choisisseur** : tentatives, réussites, taux de réussite, bonus, delta total et delta moyen ;
- **Toutes les manches** : participations, delta total et delta moyen, même lorsque le joueur n’est pas choisisseur.

Le Joker conserve sa propre ligne et détaille les contrats qu’il a imités.

## Filtres et classement

Le classement accepte toute la carrière, l’année civile courante ou une période personnalisée inclusive. Le profil individuel ajoute les dix dernières parties admissibles de ce joueur.

Tous les joueurs sont classés dès leur première partie admissible. L’ordre initial est : taux de victoire décroissant, nombre de victoires décroissant, place moyenne croissante, puis nom canonique. Le tableau peut ensuite être recherché et trié par colonne.

## Architecture et API

- `shared/player-identity.ts` normalise et résout les identités sans dépendance serveur ou React.
- `shared/player-stats.ts` filtre les parties et calcule classements, historiques et contrats.
- `shared/stats-types.ts` définit les DTO stables partagés.
- `server/profile-storage.ts` assure la lecture et l’écriture atomiques.
- `server/profile-manager.ts` orchestre amorçage, alias, fusions, séparations et suppressions.
- `client/src/pages/StatsPage.tsx` contient le classement, les profils et la gestion locale des identités.

Routes de lecture, limitées à l’adresse loopback :

- `GET /api/stats/players?preset=all|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/stats/players/:profileId?preset=all|year|custom|last10`

Routes de gestion, limitées à loopback et protégées par le jeton admin :

- `GET /api/stats/identity`
- `PATCH /api/stats/profiles/:profileId`
- `POST /api/stats/profiles/:profileId/aliases`
- `POST /api/stats/profiles/merge`
- `POST /api/stats/profiles/reassign`
- `DELETE /api/stats/profiles/:profileId`

Les agrégats sont recalculés depuis les sauvegardes actuelles. Corriger ou supprimer une partie modifie donc immédiatement les statistiques suivantes, sans migration de données.

## Parcours utilisateur

1. Ouvrir **Statistiques** depuis l’accueil, l’administration ou l’historique.
2. Rechercher un joueur, trier le classement ou choisir une période.
3. Ouvrir un profil pour consulter les indicateurs, basculer le graphique place/score, examiner les contrats et parcourir les parties.
4. Déplier **Gérer les identités et alias** sur le classement pour corriger un nom, fusionner des variantes ou séparer des apparitions homonymes.

Le graphique des places affiche la première place en haut. Les tableaux restent défilables et les indicateurs se réorganisent sur une fenêtre étroite.

## Recette

- Vérifier la normalisation casse/accents/espaces, l’amorçage, la fusion, la séparation et le rechargement du fichier.
- Vérifier l’exclusion des fins anticipées, les victoires partagées, le classement compétition, les podiums et les bornes de dates inclusives.
- Vérifier les dix dernières parties par profil, les corrections de manche, la suppression d’une partie et les barèmes différents.
- Vérifier les deux perspectives de contrat et le détail du Joker.
- Vérifier le refus des API depuis le réseau local, le jeton admin pour toute mutation et la conservation d’un fichier de profils corrompu.
- Vérifier navigation, recherche, tri, filtres, graphiques, tableaux et gestion des identités à largeur normale et étroite.
- Exécuter `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` et `npm run test:e2e` avant livraison.
