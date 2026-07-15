# Checklist d’acceptation — Tafaron

## Installation et réseau

- [ ] `tafaron.bat` installe/prépare Node.js 24 LTS et les dépendances si nécessaire.
- [ ] `tafaron.bat` ouvre l’admin et le serveur écoute sur le port 3000.
- [ ] Le lobby détecte les interfaces réseau et permet de choisir l’adresse Wi-Fi.
- [ ] Deux téléphones réels rejoignent via le QR code sur le même réseau privé.
- [ ] Une reconnexion récupère automatiquement le même joueur.

## Lobby

- [ ] Une partie accepte de 3 à 10 joueurs.
- [ ] Joueurs téléphone et joueurs locaux peuvent coexister.
- [ ] Les noms vides ou en doublon sont refusés.
- [ ] Renommer, retirer, réordonner et mélanger les joueurs fonctionne avant le lancement.
- [ ] Les huit contrats, le barème, le bonus, le mode de saisie et les cartes sont configurables.
- [ ] L’instruction de cartes, le nombre de cartes par joueur et la carte de départ sont corrects.
- [ ] Le lancement est bloqué tant que le nombre total de joueurs est incorrect.
- [ ] L’étape Paramètres/lobby, l’étape Cartes et l’étape Admin en jeu sont persistées après rechargement.
- [ ] Les distributions proposées affichent à la fois les rangs par couleur et les cartes par joueur, uniquement pour le nombre de joueurs choisi.
- [ ] Retour depuis l’étape Cartes permet de modifier tous les paramètres avant le lancement.

## Manche et scores

- [ ] Seul le choisisseur peut choisir un contrat encore disponible pour lui.
- [ ] Joker imite un contrat actif sans consommer le contrat original.
- [ ] Les formulaires R, C, D, K, P, L, T et Joker valident les totaux attendus.
- [ ] Chaque téléphone ne saisit que son propre résultat et ne reçoit aucun score.
- [ ] Les joueurs locaux peuvent être pris en charge depuis l’admin.
- [ ] Une agrégation correcte lance le compte à rebours de cinq secondes.
- [ ] La matrice affiche les noms en colonnes, les critères en lignes et des boutons de 0 au maximum métier.
- [ ] Chaque ligne affiche reçu/attendu en vert ou rouge ; la validation globale est bloquée si une ligne est incorrecte.
- [ ] Une correction joueur avant validation met à jour l’admin en temps réel ; une saisie invalide arrête le compte à rebours.
- [ ] Les valeurs indiquent leur source joueur/admin et la dernière mise à jour.
- [ ] L’admin peut annuler le compte à rebours et corriger une erreur.
- [ ] Le bonus est appliqué uniquement au choisisseur qui réussit.
- [ ] Une modification du barème entre deux manches recalcule les cumuls.
- [ ] Corriger une manche et annuler la dernière manche recalculent tous les scores.
- [ ] La partie se termine automatiquement après toutes les manches ou manuellement après confirmation.

## Affichages et historique

- [ ] L’écran 1920×1080 affiche joueur actif, contrat, manches restantes, graphique, classement et matrice.
- [ ] Réussite et échec utilisent une couleur, un symbole et un texte accessibles.
- [ ] Les tableaux détaillés affichent deltas et cumuls côte à côte.
- [ ] Les interfaces restent utilisables en 1366×768 et 360×800.
- [ ] Créer une nouvelle partie archive l’ancienne.
- [ ] Le bouton Accueil après une partie terminée archive la partie et revient à la création.
- [ ] Le graphique place Départ à x=0, à gauche, même sans manche validée.
- [ ] Une sauvegarde persiste après redémarrage et peut être réactivée.
- [ ] Les exports JSON, CSV manches et CSV scores s’ouvrent correctement.

## Vérifications automatiques

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test:e2e` après installation du navigateur Playwright
