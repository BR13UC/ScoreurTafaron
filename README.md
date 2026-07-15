# Tafaron

Application web locale de comptage des points du Tafaron. Un ordinateur Windows héberge la partie et affiche le tableau principal ; les joueurs rejoignent la partie avec leur téléphone sur le même réseau Wi-Fi.

## Prérequis

- Windows 10 ou 11.
- `winget`, inclus dans les versions récentes de Windows 10 et 11. Le script installe automatiquement [Node.js 24 LTS](https://nodejs.org/) et npm s’ils sont absents ou trop anciens.
- Une connexion Internet uniquement pour la première installation.
- L’ordinateur et les téléphones connectés au même réseau local.

## Installation sous Windows

1. Double-cliquer sur `tafaron.bat`.
2. Accepter la demande administrateur si Node.js 24 doit être installé ou mis à jour.
3. Attendre la préparation automatique des dépendances et de la compilation au premier lancement.
4. En cas de demande du pare-feu Windows, autoriser Node.js sur les **réseaux privés** uniquement.

Le lanceur calcule une empreinte des sources et recompile automatiquement après une mise à jour. Les lancements suivants réutilisent la compilation tant que les sources n’ont pas changé.

## Lancement

1. Double-cliquer sur `tafaron.bat`.
2. Ouvrir `http://localhost:3000/admin` si le navigateur ne s’ouvre pas automatiquement.
3. Créer ou reprendre une partie.
4. Choisir l’adresse Wi-Fi correcte dans le lobby.
5. Faire scanner le QR code aux joueurs.

L’administration suit trois étapes sauvegardées : **Paramètres + lobby**, **Cartes**, puis **Admin en jeu**. Les paramètres restent modifiables avant le lancement. Pendant une manche, les saisies des téléphones et les corrections admin se reflètent en temps réel dans la matrice de score.

Le terminal doit rester ouvert pendant toute la partie. Pour arrêter le serveur, fermer sa fenêtre ou utiliser `Ctrl+C`.

## Développement

```bash
npm install
npm run dev
```

- Interface de développement : `http://localhost:5173/admin`
- Serveur/API : `http://localhost:3000`
- Tests : `npm test`
- Vérification des types : `npm run typecheck`
- Compilation : `npm run build`
- Tests navigateur : `npx playwright install chromium`, puis `npm run test:e2e`

## Données et exports

- Les sauvegardes locales sont écrites dans `data/games/` après chaque modification.
- Cette arborescence n’est pas envoyée dans Git.
- L’admin peut exporter le JSON complet, le CSV des manches et le CSV des scores.
- Le suivi de carrière local rapproche les joueurs par leur nom et agrège uniquement les parties terminées naturellement. Il est accessible depuis **Statistiques** sur l’ordinateur principal.
- Les profils et corrections d’identité sont écrits dans `data/player-profiles.json` ; les agrégats restent calculés depuis les parties.
- Les CSV utilisent le séparateur `;` et l’encodage UTF-8 avec BOM pour Excel en français.

Pour sauvegarder les parties sur un autre support, copier le dossier `data/games/` lorsque le serveur est arrêté.

## Dépannage réseau

- Vérifier que le téléphone et l’ordinateur utilisent le même Wi-Fi, sans réseau invité isolé.
- Choisir l’adresse commençant généralement par `192.168.`, `10.` ou `172.16`–`172.31`.
- Tester le lien affiché sous le QR code directement dans le navigateur du téléphone.
- Autoriser Node.js dans le pare-feu Windows pour les réseaux privés.
- Désactiver temporairement un VPN s’il place sa propre adresse avant l’adresse Wi-Fi.
- Ne pas utiliser `localhost` sur le téléphone : cette adresse désignerait le téléphone lui-même.

## Ergonomie de partie

### Résumé

Ces fonctions améliorent l’ergonomie pendant une partie tout en restant compatibles avec les sauvegardes existantes.

### Fonctions et impact sur une partie en cours

| Fonctionnalité | Comportement | Impact sur une partie déjà commencée |
|---|---|---|
| Ordre de jeu | Dans le lobby, préciser : « Renseignez les joueurs dans le sens horaire, en commençant par le premier joueur qui choisira. » | **Non.** L’ordre d’une partie lancée reste inchangé. |
| QR entre les manches | Dans le panneau Actions de l’admin, pendant le choix du contrat, ajouter un bouton ouvrant le QR et les demandes de récupération de session. | **Oui.** Disponible dès la prochaine période de choix. |
| Récupération d’un joueur | Le QR commun permet à un nouveau téléphone de sélectionner un joueur et d’envoyer une demande. L’admin accepte ou refuse ; après acceptation, le nouveau téléphone remplace l’ancien. | **Oui.** Compatible avec les joueurs d’une partie existante. L’ancienne session est déconnectée. |
| Noms fixes pendant la saisie | Donner à la matrice admin une zone défilable et garder sa ligne d’en-tête, avec les noms des joueurs, fixée en haut. | **Oui.** Pure modification d’affichage. |
| Calcul des points depuis l’écran de jeu | Attendre la réussite du passage en saisie, puis naviguer directement vers `/admin?from=game`. Afficher une erreur si l’action échoue. | **Oui.** Dès la manche en cours si elle est encore en jeu. |
| Graphique et classement | Afficher chaque score à droite de l’extrémité de sa courbe, réserver une marge pour les libellés, retirer les scores du classement, compacter ses lignes et ajouter la couleur correspondante à chaque joueur. | **Oui.** Tous les scores déjà enregistrés sont réutilisés. |
| Options du Joker | Une fois le Joker sélectionné, proposer tous les contrats actifs non-Joker, même ceux déjà utilisés par ce joueur. Le Joker lui-même reste utilisable une seule fois. | **Oui, pour les prochains choix.** Aucun contrat déjà choisi ou validé n’est modifié. |
| Validation sans zéros manquants | Pour les cœurs, dames et plis, considérer les valeurs absentes comme zéro dès que les valeurs saisies atteignent exactement le total attendu. Pour Tafaron, appliquer cette règle séparément à chaque ligne. Une correction ultérieure annule toujours le compte à rebours et relance la validation. | **Oui.** Applicable à la manche en saisie après sa prochaine modification ; les manches validées restent intactes. |
| Compteur de manches | Remplacer « X manches restantes » par « Manche X / total ». Avant la première manche afficher `0 / total`, et après une fin naturelle `total / total`. | **Oui.** Le total est calculé depuis les joueurs et contrats déjà sauvegardés. |
| Réussite | Attendre exactement un premier, un deuxième et `nombre de joueurs − 2` joueurs « Autre ». Dès que les deux premiers sont connus, déduire « Autre » pour les joueurs sans valeur. | **Oui.** Applicable à une Réussite actuellement en saisie ; les résultats validés ne changent pas. |
| Taille des cartes | Sur l’écran de choix, calculer les lignes depuis le nombre de contrats et dimensionner cartes, icônes et textes selon l’espace disponible. Conserver 4 colonnes sur grand écran et 2 sur téléphone afin que la grille complète, y compris les choix du Joker et Retour, tienne sans défilement. | **Oui.** Visible dès le prochain écran de choix. |

Aucune migration des sauvegardes n’est requise. Un redémarrage interrompt brièvement les connexions, puis la partie sauvegardée peut être reprise.

### Interfaces et règles techniques

- Le parcours de récupération crée publiquement une demande, permet sa consultation et son acceptation/refus par l’admin, la fait suivre par le téléphone, puis l’échange contre un nouveau jeton.
- Les demandes sont secrètes, à usage unique et expirent après cinq minutes. Elles sont refusées hors partie en cours et une seule demande peut être active par joueur.
- Lors de l’échange accepté, le serveur remplace le `tokenHash`, ferme la socket de l’ancien téléphone et connecte le nouveau sans modifier l’identité, l’ordre, les scores ou les manches.
- Les demandes ne sont pas persistées dans la sauvegarde de partie et expirent également lors d’un redémarrage.
- La palette joueur est centralisée afin que graphique, libellés de fin de courbe et classement utilisent exactement la même couleur.
- Les agrégateurs produisent un résultat complet avec les zéros et rangs « Autre » déduits avant la validation et le calcul des scores.

### Tests et critères d’acceptation

- Vérifier l’instruction horaire et la conservation exacte de l’ordre choisi.
- Tester une récupération acceptée, refusée, expirée et concurrente ; confirmer que le nouveau téléphone fonctionne et que l’ancien jeton est refusé.
- Vérifier le retour automatique vers l’admin après « Calcul des points », ainsi que le maintien sur l’écran de jeu avec message d’erreur en cas d’échec.
- Tester Joker avec un contrat actif déjà utilisé et confirmer qu’un contrat désactivé reste absent.
- Tester la déduction des zéros pour Cœurs, Dames, Plis et Tafaron, y compris un total insuffisant, dépassé et une correction pendant le compte à rebours.
- Tester Réussite à plusieurs nombres de joueurs : un premier, un deuxième et exactement `joueurs − 2` autres.
- Vérifier `Manche X / total` au début, pendant une partie, après annulation d’une manche et à la fin.
- Vérifier visuellement à 1920×1080, 1366×768 et sur téléphone que les noms restent visibles, que les scores de courbe ne sont pas coupés, que le classement est compact et que toutes les cartes tiennent sans défilement.
- Exécuter les tests unitaires, le contrôle TypeScript, la compilation et les scénarios Playwright ciblés.

### Hypothèses retenues

- « Toutes les options du Joker » signifie tous les contrats actifs, pas les contrats désactivés.
- Le QR est accessible depuis les Actions de l’admin uniquement entre les manches.
- Le QR reste commun ; le choix d’un joueur exige une validation explicite de l’admin.
- Une récupération remplace toujours l’ancien téléphone.
- Le compteur demandé représente la manche actuelle sur le nombre total, et non les manches restantes.

## Documentation du projet

- [Plan d’implémentation](IMPLEMENTATION_PLAN.md)
- [Checklist d’acceptation](ACCEPTANCE_CHECKLIST.md)
- [Cahier des charges](docs/cahier-des-charges.md)
