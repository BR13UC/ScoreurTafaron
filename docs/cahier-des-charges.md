# Cahier des charges — Application locale de comptage des points du Tafaron

## 1. Résumé du besoin

Développer une petite application web locale pour gérer une partie de **Tafaron**, avec une expérience proche de **Kahoot** : un grand écran central visible par tout le monde, et des téléphones utilisés comme petites interfaces de commande et de saisie.

Un ordinateur principal sert à la fois :

- de serveur local ;
- d'écran principal affiché aux joueurs ;
- d'interface organisateur pour configurer, saisir, valider et corriger la partie.

Les joueurs se connectent avec leur téléphone via un lien local ou un QR code, saisissent leur nom, puis utilisent leur téléphone comme interface de jeu. L'application ne doit pas dépendre d'un cloud, d'un compte utilisateur ou d'un vrai mode multijoueur distant. Tout tourne sur l'ordinateur principal et sur le même réseau local.

## 2. Objectifs

- Remplacer le fichier Excel actuel par une interface propre et plus robuste.
- Permettre aux téléphones de se connecter simplement à la partie locale.
- Configurer la partie avant le démarrage : joueurs, contrats, cartes, points, bonus, ordre de jeu.
- Calculer automatiquement les cartes à garder pour que la distribution soit équitable.
- Afficher la carte de départ de la réussite.
- Gérer les contrats : réussite, pas de cœur, pas de dames, pas le roi de cœur, pas de plis, pas le dernier pli, Tafaron et Joker.
- Gérer le Joker comme un contrat spécial qui imite un autre contrat au choix du joueur.
- Gérer un bonus configurable, attribué uniquement au joueur qui a choisi le contrat s'il réussit ce contrat.
- Proposer deux modes de saisie des résultats : saisie par l'organisateur ou saisie par les joueurs.
- Vérifier les erreurs de saisie avant validation.
- Afficher en temps réel une page de jeu visuelle : graphique des scores, classement, contrats, manches restantes et état de la manche.
- Autoriser la correction d'une manche validée.
- Sauvegarder localement la partie et permettre un export simple.

## 3. Périmètre MVP

Le MVP doit couvrir :

1. Création d'une partie locale.
2. Affichage d'un lien local et d'un QR code.
3. Connexion des joueurs depuis téléphone.
4. Saisie du nom des joueurs.
5. Sélection du nombre de joueurs.
6. Calcul des cartes à garder pour une distribution équitable.
7. Affichage de l'instruction de cartes à garder, par exemple `garder de l'As au 6`.
8. Détermination de la carte de départ de la réussite.
9. Sélection des contrats/modes joués.
10. Configuration des points, y compris la valeur du bonus.
11. Sélection de l'ordre de jeu.
12. Choix du contrat par le joueur actif sur son téléphone.
13. Gestion du Joker à n'importe quel moment, s'il est encore disponible pour le joueur.
14. Saisie des résultats selon le contrat.
15. Mode de saisie des résultats par l'organisateur.
16. Mode de saisie des résultats par les joueurs sur téléphone.
17. Validation des résultats et gestion d'erreurs.
18. Calcul des scores de manche et des scores cumulés.
19. Affichage de la page de jeu plein écran sur l'ordinateur.
20. Correction d'une manche validée et annulation de la dernière manche depuis l'admin.
21. Sauvegarde locale automatique.
22. Export JSON et CSV.

Hors MVP : application mobile native, comptes utilisateurs, cloud, classement en ligne, paiement, matchmaking, gestion de plusieurs tables distantes, notifications système mobiles natives.

## 4. Vocabulaire fonctionnel

- **Ordinateur principal** : machine qui lance le serveur local et affiche l'écran principal.
- **Écran principal / page de jeu** : interface plein écran affichée sur l'ordinateur, lisible par tout le monde, avec les éléments visuels de partie.
- **Téléphone joueur** : interface web mobile utilisée par chaque joueur comme manette/formulaire personnel. Le téléphone ne doit pas afficher les scores, le classement ou le tableau complet ; ces informations restent sur l'écran principal.
- **Organisateur** : personne qui configure la partie, valide les joueurs, définit l'ordre, lance la partie, peut saisir les résultats, valider, corriger et annuler la dernière manche.
- **Partie** : session complète avec paramètres, joueurs, manches et scores.
- **Manche / tour** : unité de jeu pendant laquelle un joueur choisit un contrat, la manche est jouée, puis les résultats sont saisis.
- **Contrat / mode** : type de manche sélectionnable.
- **Joueur actif / choisisseur** : joueur dont c'est le tour de choisir un contrat.
- **Joker** : contrat spécial qui imite un autre contrat choisi par le joueur actif.
- **Bonus** : valeur configurable attribuée uniquement au joueur actif s'il réussit le contrat qu'il a choisi.
- **Score de manche** : points ajoutés ou retirés à la fin d'une manche.
- **Score cumulé** : total des scores de toutes les manches validées.
- **Règle de victoire** : le score le plus bas gagne.

## 5. Modes de jeu à gérer

L'application doit permettre d'activer ou désactiver les modes suivants au début de la partie.

| Code | Mode | Description | Saisie attendue |
|---|---|---|---|
| `R` | Réussite | Récompense les premiers joueurs sortis | 1er joueur, 2e joueur |
| `C` | Pas de cœur | Pénalise les cœurs pris | Nombre de cœurs par joueur |
| `D` | Pas de dames | Pénalise les dames prises | Nombre de dames par joueur |
| `K` | Pas le roi de cœur | Pénalise le joueur qui prend le roi de cœur | Joueur concerné |
| `P` | Pas de plis | Pénalise chaque pli gagné | Nombre de plis par joueur |
| `L` | Pas le dernier pli | Pénalise le joueur qui prend le dernier pli | Joueur concerné |
| `T` | Tafaron | Manche combinée avec plusieurs pénalités | Cœurs, dames, roi de cœur, plis, dernier pli |
| `J` | Joker | Contrat qui imite un autre contrat au choix du joueur | Sous-contrat choisi + saisie du sous-contrat |

Les codes doivent rester stables pour simplifier les exports et les tests. Les libellés affichés peuvent être configurables plus tard, mais ce n'est pas nécessaire pour le MVP.

## 6. Configuration initiale de partie

### 6.1 Création de la partie

L'écran principal propose :

- nom optionnel de la partie ;
- bouton `Créer une partie` ;
- adresse locale du serveur ;
- QR code de connexion ;
- lien partageable, par exemple : `http://192.168.1.34:3000/join/ABC123`.

### 6.2 Connexion des joueurs

Sur téléphone :

1. Le joueur ouvre le lien ou scanne le QR code.
2. Il saisit son nom.
3. Il rejoint la salle d'attente.
4. Il voit un écran d'attente jusqu'au démarrage.

Sur l'écran principal :

- liste des joueurs connectés ;
- statut de connexion ;
- possibilité de renommer un joueur ;
- possibilité de supprimer un joueur avant le démarrage.

### 6.3 Nombre de joueurs

L'organisateur sélectionne le nombre de joueurs attendus.

Contraintes proposées :

- minimum : 3 joueurs ;
- maximum conseillé MVP : 10 joueurs, configurable dans le code ;
- la partie peut démarrer quand le nombre de joueurs connectés correspond au nombre choisi ;
- option possible hors MVP : démarrer même si tous les téléphones ne sont pas connectés.

### 6.4 Cartes à garder

La variante à implémenter par défaut utilise les **cartes de couleur du tarot français**, sans les atouts ni l'Excuse.

Les 4 couleurs ont la même liste de rangs, du haut vers le bas :

```txt
As, Roi, Dame, Cavalier, Valet, 10, 9, 8, 7, 6, 5, 4, 3, 2
```

Règle par défaut :

- garder le même nombre de cartes dans chaque couleur ;
- garder les cartes du haut vers le bas ;
- choisir automatiquement le plus grand nombre de rangs possible pour que le total soit divisible équitablement entre les joueurs ;
- afficher simplement quelles cartes garder, par exemple `garder de l'As au 6` ;
- ne pas afficher une longue liste de cartes à retirer.

Calcul :

```txt
rangs_possibles = 14
couleurs = 4
rangs_gardés = plus grand nombre entre 1 et 14 tel que (rangs_gardés * 4) % nombre_joueurs == 0
cartes_utilisées = rangs_gardés * 4
cartes_par_joueur = cartes_utilisées / nombre_joueurs
instruction = "garder de l'As au <dernier rang gardé>"
```

Exemples proposés avec cette règle :

| Joueurs | Rangs gardés par couleur | Cartes utilisées | Cartes par joueur / plis | Instruction affichée |
|---:|---:|---:|---:|---|
| 3 | 12 | 48 | 16 | Garder de l'As au 4 |
| 4 | 14 | 56 | 14 | Garder de l'As au 2 |
| 5 | 10 | 40 | 8 | Garder de l'As au 6 |
| 6 | 12 | 48 | 8 | Garder de l'As au 4 |
| 7 | 14 | 56 | 8 | Garder de l'As au 2 |
| 8 | 14 | 56 | 7 | Garder de l'As au 2 |
| 9 | 9 | 36 | 4 | Garder de l'As au 7 |
| 10 | 10 | 40 | 4 | Garder de l'As au 6 |

L'application doit aussi permettre un **mode personnalisé** :

```txt
rangs_gardés = valeur saisie par l'organisateur
cartes_utilisées = rangs_gardés * 4
cartes_par_joueur = cartes_utilisées / nombre_joueurs si divisible
```

Validation du mode personnalisé :

- `rangs_gardés` doit être entre 1 et 14 ;
- `rangs_gardés * 4` doit être divisible par le nombre de joueurs ;
- si ce n'est pas divisible, afficher une erreur claire.

Exemple :

```txt
5 joueurs, 10 rangs gardés par couleur = 40 cartes utilisées = 8 cartes par joueur
Instruction : garder de l'As au 6
```

### 6.5 Carte de départ pour la réussite

Pour le contrat **Réussite**, l'application doit afficher la carte de départ à placer au centre.

La carte de départ est choisie dans la liste des rangs gardés par couleur.

Règle confirmée :

- prendre la carte du milieu ;
- si le nombre de rangs gardés est pair, prendre la carte du milieu côté bas, c'est-à-dire celle qui est la plus proche des petites cartes dans la liste gardée.

Exemple confirmé :

```txt
Rangs gardés : As, Roi, Dame, Cavalier, Valet, 10
Nombre de rangs : 6
Cartes du milieu : Dame / Cavalier
Carte choisie : Cavalier, car elle est plus proche du bas
```

Formule, avec une position en base 1 :

```txt
position_carte_depart = floor(rangs_gardés / 2) + 1
```

Exemples :

| Rangs gardés | Liste gardée | Position | Carte de départ |
|---:|---|---:|---|
| 6 | As, Roi, Dame, Cavalier, Valet, 10 | 4 | Cavalier |
| 8 | As, Roi, Dame, Cavalier, Valet, 10, 9, 8 | 5 | Valet |
| 10 | As, Roi, Dame, Cavalier, Valet, 10, 9, 8, 7, 6 | 6 | 10 |
| 12 | As, Roi, Dame, Cavalier, Valet, 10, 9, 8, 7, 6, 5, 4 | 7 | 9 |
| 14 | As, Roi, Dame, Cavalier, Valet, 10, 9, 8, 7, 6, 5, 4, 3, 2 | 8 | 8 |

L'écran doit afficher la carte sous forme lisible, par exemple :

```txt
Réussite : carte de départ = 10
```

### 6.6 Sélection des contrats joués

L'organisateur coche les contrats utilisés dans la partie :

- Réussite ;
- Pas de cœur ;
- Pas de dames ;
- Pas le roi de cœur ;
- Pas de plis ;
- Pas le dernier pli ;
- Tafaron ;
- Joker.

Le nombre total de manches théorique est :

```txt
nombre_manches = nombre_joueurs * nombre_contrats_actifs
```

Le Joker compte comme un contrat s'il est activé. Quand il est choisi, le joueur doit ensuite choisir quel contrat il imite.

### 6.7 Configuration des points et du bonus

L'organisateur configure toutes les valeurs au début de la partie, y compris la valeur du bonus.

| Paramètre | Type | Valeur par défaut proposée | Remarque |
|---|---:|---:|---|
| Réussite — 1er | nombre | `-100` | Configurable |
| Réussite — 2e | nombre | `-50` | Configurable |
| Cœur | nombre | `20` | Configurable |
| Dame | nombre | `50` | Configurable |
| Roi de cœur | nombre | `100` | Configurable |
| Pli | nombre | `40` | Configurable |
| Dernier pli | nombre | `100` | Configurable |
| Bonus de contrat réussi | nombre | `-25` | Configurable dès le départ |
| Tafaron | calculé ou manuel | `920` avec l'exemple 5 joueurs / 8 plis | Peut être calculé depuis les autres valeurs |

L'application doit autoriser :

- valeurs positives ou négatives ;
- modification de la valeur du bonus au même écran que les autres points ;
- réinitialisation aux valeurs par défaut ;
- sauvegarde des valeurs dans la partie ;
- export des valeurs avec l'historique.

### 6.8 Règle du bonus

Règle confirmée : le bonus est attribué uniquement au joueur qui a choisi le contrat, et seulement s'il réussit ce contrat.

Par défaut :

```txt
bonus = -25
```

Le bonus n'est pas attribué à tous les joueurs qui ont 0 point. Il ne revient pas non plus à un joueur choisi librement. Il est lié au joueur actif de la manche.

Conditions de réussite proposées :

| Contrat choisi | Le joueur actif réussit si... |
|---|---|
| `R` Réussite | il finit 1er à la réussite |
| `C` Pas de cœur | il prend 0 cœur |
| `D` Pas de dames | il prend 0 dame |
| `K` Pas le roi de cœur | il ne prend pas le roi de cœur |
| `P` Pas de plis | il fait 0 pli |
| `L` Pas le dernier pli | il ne prend pas le dernier pli |
| `T` Tafaron | il ne prend aucune pénalité : 0 cœur, 0 dame, pas le roi de cœur, 0 pli, pas le dernier pli |
| `J` Joker | même condition que le contrat imité |

Le bonus doit être calculé automatiquement à partir des résultats saisis. L'interface peut afficher clairement :

```txt
Bonus appliqué au joueur actif : oui / non
```

### 6.9 Calcul théorique du Tafaron

Par défaut, le Tafaron doit pouvoir être calculé depuis les autres valeurs :

```txt
tafaron_total =
    nb_coeurs * points_par_coeur
    + nb_dames * points_par_dame
    + points_roi_de_coeur
    + nb_plis * points_par_pli
    + points_dernier_pli
```

Avec les valeurs proposées et 8 plis :

```txt
10 * 20 + 4 * 50 + 100 + 8 * 40 + 100 = 920
```

Dans la variante de cartes gardées par couleur :

```txt
nb_coeurs = rangs_gardés
nb_dames = 4 si la Dame est gardée, sinon 0
nb_plis = cartes_par_joueur
```

Pour les configurations normales, la Dame, le Roi et le Cavalier sont gardés, car ils sont dans le haut de la liste.

L'organisateur doit pouvoir choisir :

- Tafaron calculé automatiquement ;
- Tafaron saisi manuellement.

## 7. Ordre de jeu

Avant le démarrage, l'organisateur choisit l'ordre des joueurs.

Fonctionnalités attendues :

- afficher tous les joueurs connectés ;
- permettre le drag-and-drop ;
- permettre un ordre aléatoire ;
- permettre de modifier l'ordre avant le début ;
- afficher clairement le premier joueur.

L'ordre détermine :

- qui choisit le contrat à chaque manche ;
- l'ordre d'affichage des colonnes dans les tableaux ;
- le prochain joueur actif après validation d'une manche.

## 8. Déroulement d'une partie

### 8.1 Salle d'attente / page admin avant partie

Avant le lancement, l'ordinateur principal affiche une page `Admin / Lobby`.

Côté téléphone :

1. Le joueur scanne le QR code ou ouvre le lien local.
2. Il saisit son nom dans l'application.
3. Il rejoint la salle d'attente.
4. Son téléphone affiche un message d'attente, sans score ni classement.

Côté admin :

- QR code de connexion ;
- lien local ;
- liste des joueurs connectés en temps réel ;
- possibilité de renommer ou retirer un joueur ;
- paramètres de partie ;
- choix des contrats ;
- choix des points et du bonus ;
- choix de la distribution ;
- définition de l'ordre des joueurs ;
- bouton `Lancer la partie`.

Règle confirmée : l'organisateur valide le démarrage depuis cette page après avoir vu les joueurs connectés et défini l'ordre de jeu. Il n'y a pas besoin de code PIN local pour protéger l'interface organisateur dans le MVP.

### 8.2 Début d'une manche

À chaque manche :

1. L'application détermine le joueur actif selon l'ordre.
2. L'écran principal affiche le joueur actif.
3. Le téléphone du joueur actif passe sur l'écran `Choix du contrat`.
4. Les autres téléphones affichent `En attente du choix de X`.

Le terme `notification` signifie ici une mise à jour temps réel de l'écran mobile via WebSocket. Les vraies notifications système mobiles sont hors MVP.

### 8.3 Choix du contrat

Le joueur actif voit uniquement les contrats qu'il peut encore choisir.

Règles :

- chaque joueur ne peut choisir chaque contrat actif qu'une seule fois ;
- les contrats déjà choisis par ce joueur disparaissent de sa liste ;
- les contrats choisis par les autres joueurs restent disponibles pour lui ;
- le Joker peut être choisi à n'importe quel moment de la partie, tant que le joueur actif n'a pas déjà utilisé son contrat Joker ;
- si le joueur choisit Joker, il doit ensuite choisir le contrat que le Joker imite ;
- le Joker ne peut pas imiter Joker ;
- par défaut, le Joker peut imiter tous les autres contrats actifs ;
- choisir `J → C` n'empêche pas le joueur de choisir `C` plus tard comme contrat normal.

Après sélection :

- le choix est envoyé au serveur ;
- l'écran principal met à jour le tableau des choix ;
- tous les téléphones passent en mode `manche en cours`.

### 8.4 Fin de manche et saisie des résultats

L'application doit proposer deux modes de saisie configurables au début ou dans les paramètres.

#### Mode A — Saisie par l'organisateur

- L'organisateur saisit tous les résultats sur l'ordinateur principal.
- Les téléphones affichent un écran d'attente ou de résumé.
- C'est le mode le plus simple et le plus robuste.

#### Mode B — Saisie par les joueurs

- Chaque joueur saisit uniquement sa propre main / son propre résultat depuis son téléphone.
- Aucun joueur ne saisit le résultat complet des autres joueurs depuis son téléphone.
- L'écran principal affiche l'état des saisies reçues : `en attente`, `reçu`, `erreur`, `à corriger`.
- Le serveur agrège les saisies individuelles et vérifie les totaux.
- L'organisateur garde la validation finale sur l'ordinateur principal.
- L'organisateur peut corriger une saisie individuelle ou une manche complète avant validation.

Exemples de saisie individuelle :

| Contrat | Ce que chaque joueur saisit sur son téléphone |
|---|---|
| `R` Réussite | son rang ou une réponse simple : `1er`, `2e`, `autre` |
| `C` Pas de cœur | le nombre de cœurs dans sa main / pris pendant la manche |
| `D` Pas de dames | le nombre de dames dans sa main / prises pendant la manche |
| `K` Pas le roi de cœur | s'il a pris le roi de cœur : `oui` / `non` |
| `P` Pas de plis | son nombre de plis |
| `L` Pas le dernier pli | s'il a pris le dernier pli : `oui` / `non` |
| `T` Tafaron | ses cœurs, ses dames, ses plis, puis `roi de cœur oui/non`, `dernier pli oui/non` |
| `J` Joker | même saisie que le contrat imité |

Le mode B doit rester simple : pas besoin de vote complexe dans le MVP. En cas de contradiction, l'ordinateur principal affiche l'erreur et l'organisateur tranche ou corrige.

## 9. Saisie par type de contrat

Dans tous les contrats, le bonus est calculé uniquement pour le joueur actif et seulement si sa condition de réussite est remplie.

### 9.1 Réussite

Champs :

- joueur arrivé 1er ;
- joueur arrivé 2e.

Validation :

- le 1er et le 2e doivent être différents.

Calcul :

```txt
score[1er] += points_reussite_1er
score[2e] += points_reussite_2e
si joueur_actif == 1er : score[joueur_actif] += points_bonus
```

### 9.2 Pas de cœur

Champs :

- nombre de cœurs pris par chaque joueur.

Validation :

```txt
somme_coeurs == nb_coeurs_en_jeu
```

Calcul :

```txt
score[joueur] += coeurs_du_joueur * points_par_coeur
si coeurs_du_joueur_actif == 0 : score[joueur_actif] += points_bonus
```

### 9.3 Pas de dames

Champs :

- nombre de dames prises par chaque joueur.

Validation :

```txt
somme_dames == nb_dames_en_jeu
```

Calcul :

```txt
score[joueur] += dames_du_joueur * points_par_dame
si dames_du_joueur_actif == 0 : score[joueur_actif] += points_bonus
```

### 9.4 Pas le roi de cœur

Champs :

- joueur qui prend le roi de cœur.

Validation :

- un seul joueur doit être sélectionné.

Calcul :

```txt
score[joueur_roi] += points_roi_de_coeur
si joueur_actif != joueur_roi : score[joueur_actif] += points_bonus
```

### 9.5 Pas de plis

Champs :

- nombre de plis gagnés par chaque joueur.

Validation :

```txt
somme_plis == nombre_de_plis_de_la_manche
```

Par défaut :

```txt
nombre_de_plis_de_la_manche = cartes_par_joueur
```

Calcul :

```txt
score[joueur] += plis_du_joueur * points_par_pli
si plis_du_joueur_actif == 0 : score[joueur_actif] += points_bonus
```

### 9.6 Pas le dernier pli

Champs :

- joueur qui prend le dernier pli.

Validation :

- un seul joueur doit être sélectionné.

Calcul :

```txt
score[joueur_dernier_pli] += points_dernier_pli
si joueur_actif != joueur_dernier_pli : score[joueur_actif] += points_bonus
```

### 9.7 Tafaron

Champs :

- nombre de cœurs par joueur ;
- nombre de dames par joueur ;
- joueur qui prend le roi de cœur ;
- nombre de plis par joueur ;
- joueur qui prend le dernier pli.

Validations :

```txt
somme_coeurs == nb_coeurs_en_jeu
somme_dames == nb_dames_en_jeu
somme_plis == nombre_de_plis_de_la_manche
roi_de_coeur attribué à un seul joueur
dernier_pli attribué à un seul joueur
```

Calcul :

```txt
score[joueur] += coeurs * points_par_coeur
score[joueur] += dames * points_par_dame
score[joueur_roi] += points_roi_de_coeur
score[joueur] += plis * points_par_pli
score[joueur_dernier_pli] += points_dernier_pli

si joueur_actif a 0 coeur
et joueur_actif a 0 dame
et joueur_actif != joueur_roi
et plis_du_joueur_actif == 0
et joueur_actif != joueur_dernier_pli :
    score[joueur_actif] += points_bonus
```

### 9.8 Joker

Règle confirmée : le Joker est un contrat qui imite un autre contrat au choix du joueur.

Comportement attendu :

1. Le joueur actif choisit `Joker`.
2. L'application affiche une seconde sélection : `Quel contrat le Joker imite ?`.
3. Le joueur choisit un contrat parmi les contrats autorisés.
4. La saisie des résultats et le calcul utilisent la même logique que le contrat imité.
5. La condition de bonus est aussi celle du contrat imité.
6. L'historique affiche par exemple `J → C`, `J → P` ou `J → R`.

Règles confirmées :

- Joker ne peut pas imiter Joker.
- Joker peut être utilisé à n'importe quel moment, tant qu'il est encore disponible pour le joueur actif.
- Le contrat imité ne consomme pas le contrat original du joueur.
- Exemple : choisir `J → C` ne doit pas empêcher le joueur de choisir `C` plus tard.

## 10. Gestion des erreurs

L'application doit bloquer la validation si :

- un joueur actif choisit un contrat déjà choisi par lui-même ;
- un joueur non actif essaie de choisir un contrat ;
- le Joker tente d'imiter Joker ;
- le Joker tente d'imiter un contrat non autorisé ;
- le nombre total de cœurs est incorrect ;
- le nombre total de dames est incorrect ;
- le nombre total de plis est incorrect ;
- le même joueur est sélectionné comme 1er et 2e en réussite ;
- une manche est validée sans contrat choisi ;
- une saisie joueur est incomplète ;
- la configuration de cartes personnalisée n'est pas divisible entre les joueurs ;
- un téléphone se déconnecte pendant une saisie ou un choix.

Messages d'erreur attendus :

- clairs ;
- non techniques ;
- avec la valeur attendue et la valeur saisie.

Exemples :

```txt
Erreur : le total des plis doit être 8, mais la saisie donne 7.
Erreur : le total des cœurs doit être 10, mais la saisie donne 9.
Erreur : Axelle a déjà choisi “Pas de cœur”.
Erreur : le Joker ne peut pas imiter le Joker.
Erreur : avec 5 joueurs, 9 rangs par couleur donnent 36 cartes, ce qui n'est pas divisible par 5.
```

## 11. Correction et annulation

L'organisateur doit pouvoir corriger une manche déjà validée et annuler rapidement la dernière manche depuis l'interface admin.

### 11.1 Correction d'une manche validée

Fonctionnalités attendues :

- ouvrir l'historique des manches ;
- cliquer sur `Modifier` sur une manche ;
- revenir sur le formulaire de résultat de cette manche ;
- modifier les valeurs ;
- revalider avec les mêmes règles de validation ;
- recalculer tous les scores cumulés à partir de l'historique complet.

Principe technique recommandé :

- ne pas modifier uniquement le total cumulé ;
- stocker chaque manche comme source de vérité ;
- après correction, recalculer les scores depuis la première manche jusqu'à la dernière.

### 11.2 Annuler la dernière manche

Règle confirmée : ajouter un bouton `Annuler la dernière manche` dans l'interface admin.

Comportement attendu :

1. L'organisateur clique sur `Annuler la dernière manche`.
2. L'application demande une confirmation, par exemple `Annuler la manche 7 ?`.
3. La dernière manche validée est retirée de l'historique actif ou marquée comme annulée.
4. Les scores cumulés sont recalculés depuis les manches restantes.
5. Le contrat redevient disponible pour le joueur qui l'avait choisi.
6. L'écran de jeu et les téléphones sont resynchronisés.

Implémentation recommandée :

- soit supprimer réellement la dernière manche de la liste `rounds` ;
- soit la garder avec un statut `cancelled` pour conserver une trace technique ;
- dans les deux cas, les calculs de scores ne doivent tenir compte que des manches `validated`.

## 12. Interfaces ordinateur principal

L'ordinateur principal a trois vues importantes :

1. page `Admin / Lobby` ;
2. page de jeu plein écran ;
3. page plein écran des tableaux complets.

### 12.1 Page Admin / Lobby

Cette page sert à préparer et administrer la partie. Elle n'est pas forcément affichée aux joueurs pendant le jeu.

Fonctions attendues :

- afficher le QR code et le lien local ;
- afficher les joueurs connectés en temps réel ;
- renommer ou supprimer un joueur avant le lancement ;
- configurer les contrats actifs ;
- configurer les points, y compris le bonus ;
- configurer la distribution des cartes ;
- afficher `Garder de l'As au X` ;
- afficher la carte de départ de la réussite ;
- choisir le mode de saisie : organisateur ou joueurs ;
- définir l'ordre des joueurs, idéalement par drag-and-drop ;
- lancer la partie ;
- corriger une manche ;
- annuler la dernière manche ;
- revenir à la page de jeu.

Il n'y a pas de code PIN local à prévoir dans le MVP.

### 12.2 Page de jeu plein écran

Règle confirmée : après lancement, l'ordinateur affiche une vraie page de jeu plein écran, pensée pour être visible par tout le monde, comme un écran Kahoot.

Cette page doit être visuelle et ne pas ressembler à un tableau Excel complet.

Éléments à afficher :

- titre ou nom de la partie ;
- joueur actif ;
- contrat en cours ou dernier contrat choisi ;
- nombre de manches restantes ;
- graphique d'évolution des scores cumulés ;
- classement actuel, avec score le plus bas en tête ;
- matrice/tableau compact des contrats par joueur ;
- contrats réussis affichés en vert ;
- contrats échoués affichés dans une couleur neutre ou négative ;
- contrats non joués laissés vides ou grisés ;
- résumé de la dernière manche ;
- messages d'état : attente du choix, manche en cours, attente des résultats, erreur de saisie ;
- bouton `Retour admin`.

Le bouton `Retour admin` permet à l'organisateur de revenir rapidement à la page admin pour corriger, annuler, modifier un paramètre autorisé ou reprendre la main.

### 12.3 Matrice des contrats

La page de jeu affiche une matrice simple :

- lignes : joueurs ;
- colonnes : contrats actifs ;
- cellule vide : contrat non choisi ;
- cellule remplie : contrat choisi ;
- cellule verte : contrat réussi par le joueur qui l'a choisi ;
- cellule avec libellé `J → C`, `J → P`, etc. pour les Jokers.

La réussite d'un contrat correspond à la même règle que celle utilisée pour le bonus : le joueur actif réussit si `hasChooserSucceededContract(...)` vaut `true`.

### 12.4 Page plein écran des tableaux complets

Règle confirmée : ne pas surcharger la page de jeu avec tous les détails type Excel. Prévoir plutôt une option vers une autre page plein écran.

Cette page affiche deux tableaux complets côte à côte :

- à gauche : points par manche ;
- à droite : points cumulés par manche.

Objectif : reproduire les deux tableaux utiles de l'Excel d'exemple, mais dans une vue dédiée.

Comportement attendu :

- bouton depuis la page de jeu : `Voir les tableaux complets` ;
- bouton pour revenir à la page de jeu ;
- affichage plein écran ;
- colonnes dans l'ordre de jeu ;
- lignes par manche ;
- mise en évidence de la dernière manche ;
- compatibilité avec les corrections et l'annulation de la dernière manche.

### 12.5 Style attendu

La page de jeu doit privilégier :

- grosses typographies ;
- cartes visuelles ;
- graphique lisible ;
- peu de colonnes ;
- peu de texte ;
- contraste suffisant ;
- fonctionnement correct en plein écran navigateur.

Les tableaux détaillés restent accessibles, mais pas sur l'écran principal de jeu.

## 13. Écrans téléphone

Principe général : les téléphones servent uniquement à rejoindre la partie, choisir un contrat quand c'est le tour du joueur, et saisir une information personnelle quand le mode `saisie par les joueurs` est actif. Ils ne doivent pas afficher les scores cumulés, le classement, le tableau des choix complet ou l'historique détaillé. Toute la lecture de partie se fait sur l'écran principal, comme dans une expérience type Kahoot.

### 13.1 Connexion

- Champ nom.
- Bouton rejoindre.
- Message d'erreur si le nom est vide ou déjà utilisé.

### 13.2 Attente

- Nom du joueur.
- Statut connecté.
- Message : `En attente de la configuration` ou `En attente de ton tour`.

### 13.3 Choix du contrat

Visible uniquement pour le joueur actif.

- Message : `C'est à toi de choisir`.
- Liste des contrats disponibles.
- Si Joker choisi : liste des contrats imitables.
- Confirmation avant envoi.

### 13.4 Manche en cours

- Contrat choisi.
- Joueur qui a choisi.
- Message d'attente.

### 13.5 Saisie des résultats

Selon le mode choisi :

- mode organisateur : le téléphone affiche seulement une attente ou un message court du type `Résultats saisis par l'organisateur` ;
- mode joueurs : chaque joueur saisit uniquement sa propre main / son propre résultat ;
- le téléphone confirme que la saisie a été envoyée, sans afficher le score calculé.

### 13.6 Fin de partie

- Message simple : `Partie terminée`.
- Message : `Regarde l'écran principal pour les scores et le classement`.
- Aucun classement final détaillé sur téléphone dans le MVP.

## 14. Données à stocker

### 14.1 Type `ContractCode`

```ts
type ContractCode = 'R' | 'C' | 'D' | 'K' | 'P' | 'L' | 'T' | 'J';
```

### 14.2 Type `RankLabel`

```ts
type RankLabel = 'As' | 'Roi' | 'Dame' | 'Cavalier' | 'Valet' | '10' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
```

### 14.3 Type `Game`

```ts
type Game = {
    id: string;
    name?: string;
    status: 'setup' | 'waiting_players' | 'playing' | 'finished';
    mainView: 'admin' | 'game' | 'full_tables';
    createdAt: string;
    settings: GameSettings;
    players: Player[];
    rounds: Round[];
};
```

### 14.4 Type `GameSettings`

```ts
type GameSettings = {
    playerCount: number;
    enabledContracts: ContractCode[];
    deck: DeckSettings;
    scoring: ScoringSettings;
    turnOrder: string[];
    resultEntryMode: 'organizer' | 'players';
    lowestScoreWins: true;
};
```

### 14.5 Type `DeckSettings`

```ts
type DeckSettings = {
    mode: 'tarot_suits_auto' | 'custom_ranks_per_suit';
    suitsCount: 4;
    ranksPerSuit: number;
    keptRanks: RankLabel[];
    keepInstruction: string;
    cardsUsed: number;
    cardsPerPlayer: number;
    heartsInPlay: number;
    queensInPlay: number;
    successStartRank: RankLabel;
    successStartRankPosition: number;
    successStartCardRule: 'middle_towards_low_cards';
};
```

### 14.6 Type `ScoringSettings`

```ts
type ScoringSettings = {
    successFirst: number;
    successSecond: number;
    heart: number;
    queen: number;
    kingOfHearts: number;
    trick: number;
    lastTrick: number;
    bonus: number;
    bonusRule: 'chooser_only_if_contract_succeeded';
    tafaronMode: 'computed' | 'manual';
    tafaronManualValue?: number;
};
```

### 14.7 Type `Player`

```ts
type Player = {
    id: string;
    name: string;
    joinedAt: string;
    connected: boolean;
};
```

### 14.8 Type `Round`

```ts
type Round = {
    id: string;
    index: number;
    chooserPlayerId: string;
    contract: ContractCode;
    jokerContract?: Exclude<ContractCode, 'J'>;
    status: 'choosing' | 'in_progress' | 'scoring' | 'validated' | 'cancelled';
    result?: RoundResult;
    scoreDelta: Record<string, number>;
    bonusApplied: boolean;
    chooserSucceeded: boolean;
    validationErrors: string[];
    createdAt: string;
    validatedAt?: string;
    correctedAt?: string;
    cancelledAt?: string;
};
```

### 14.9 Type `RoundResult`

```ts
type RoundResult = {
    firstPlayerId?: string;
    secondPlayerId?: string;
    heartsByPlayer?: Record<string, number>;
    queensByPlayer?: Record<string, number>;
    tricksByPlayer?: Record<string, number>;
    kingOfHeartsPlayerId?: string;
    lastTrickPlayerId?: string;
};

type PlayerRoundSubmission = {
    roundId: string;
    playerId: string;
    values: Partial<RoundResult>;
    status: 'draft' | 'confirmed' | 'needs_correction';
    submittedAt?: string;
};
```

## 15. Persistance locale

Le MVP doit sauvegarder l'état de partie localement sur l'ordinateur principal.

Options acceptables :

1. fichier JSON dans `data/games/` ;
2. SQLite local.

Pour un projet rapide, JSON suffit.

Exemples :

```txt
data/games/current-game.json
data/games/2026-07-13-tafaron-famille.json
```

Déclencheurs de sauvegarde :

- joueur rejoint ;
- configuration modifiée ;
- partie démarrée ;
- contrat choisi ;
- résultats saisis ;
- manche validée ;
- manche corrigée ;
- dernière manche annulée ;
- partie terminée.

## 16. Export

Prévoir au minimum :

- export JSON complet ;
- export CSV des manches ;
- export CSV des scores cumulés.

Format CSV des manches :

```csv
round,index,chooser,contract,jokerContract,player,delta,cumulativeScore,bonusApplied,correctedAt
```

Format CSV des scores finaux :

```csv
rank,player,totalScore,bonusCount
```

Export Excel optionnel hors MVP.

## 17. Architecture technique proposée

L'objectif produit est une expérience **type Kahoot local** :

- un écran principal toujours synchronisé ;
- des téléphones qui changent d'écran en temps réel ;
- un joueur actif qui reçoit les actions à effectuer ;
- des autres joueurs qui voient seulement un écran d'attente ou un formulaire personnel ;
- aucune dépendance cloud ;
- une tolérance correcte aux reconnexions de téléphone.

### 17.1 Option A — Node.js + Express + Socket.IO + React

Stack :

- Frontend : React + Vite + TypeScript.
- Backend : Node.js + Express + TypeScript.
- Temps réel : Socket.IO.
- Stockage : JSON local dans `data/games/`, SQLite possible plus tard.
- QR code : package npm `qrcode`.
- Style : CSS simple, CSS modules ou Tailwind.

Pourquoi c'est adapté :

- Socket.IO gère très bien les usages type Kahoot : salles, événements, reconnexion, état de connexion, diffusion à tous ou à un joueur précis.
- Un seul écosystème JavaScript/TypeScript pour le front, le serveur, les types et les tests.
- Très pratique pour pousser un nouvel écran sur un téléphone : `round:started`, `contract:selected`, `round:scoring_started`, etc.
- Bon choix si Codex doit générer rapidement une app complète avec React, serveur local, QR code et WebSocket.

Inconvénients :

- Les calculs métier doivent être bien testés pour éviter de mélanger logique serveur et logique UI.
- Pour créer un exécutable simple, il faudra ajouter plus tard une couche de packaging, par exemple Electron ou un script de lancement.

Conclusion : très bon choix pour le MVP, surtout si Codex privilégie la simplicité temps réel et l'écosystème TypeScript complet.

### 17.2 Option B — Python FastAPI + WebSocket + React ou HTML simple

Stack :

- Frontend : React + Vite + TypeScript, ou HTML/CSS/JS simple.
- Backend : Python + FastAPI.
- Temps réel : WebSocket natif FastAPI.
- Stockage : JSON local, ou SQLite via `sqlite3` / SQLModel.
- QR code : librairie Python `qrcode` ou génération côté frontend.

Pourquoi c'est adapté :

- Très agréable pour écrire et tester la logique métier : calcul des cartes, validation des totaux, score, bonus, correction.
- Backend lisible et rapide à prototyper si tu veux garder la logique principale en Python.
- FastAPI expose facilement des routes HTTP pour créer, sauvegarder, exporter et restaurer une partie.

Inconvénients :

- Les WebSockets natifs demandent un peu plus de plomberie que Socket.IO pour les salles, la reconnexion et les envois ciblés à un téléphone.
- Il faut définir soi-même une couche d'événements fiable : `broadcast`, `send_to_player`, `reconnect`, `resync_state`.
- Si le frontend est en React/TypeScript, il y aura deux écosystèmes à maintenir : Python côté serveur, TypeScript côté client.

Conclusion : très bonne alternative si Codex privilégie la lisibilité de la logique métier en Python. Le choix final de stack est laissé à Codex ; les deux approches sont acceptées.

### 17.3 Comparaison rapide

| Critère | Node.js + Socket.IO | Python FastAPI + WebSocket |
|---|---|---|
| Expérience type Kahoot | Très adaptée | Possible, mais plus manuel |
| Événements temps réel | Très simple | À structurer soi-même |
| Reconnexion mobile | Intégrée dans Socket.IO | À gérer explicitement |
| Types partagés front/back | Très simple avec TypeScript | Possible mais moins direct |
| Logique de scoring | Très bien si testée | Très confortable en Python |
| Vitesse pour Codex | Très bonne | Bonne |
| Packaging futur | Electron possible | PyInstaller/Electron possible |
| Choix final | Laissé à Codex | Laissé à Codex |

### 17.4 Rôle du serveur local

Le serveur doit :

- créer et maintenir l'état de la partie ;
- servir l'interface principale ;
- servir l'interface téléphone ;
- émettre les mises à jour temps réel ;
- recevoir les choix et les résultats ;
- valider les actions ;
- recalculer les scores ;
- sauvegarder l'état localement.

### 17.5 Communication temps réel

Utiliser WebSocket ou Socket.IO.

Événements principaux :

```txt
game:created
player:joined
player:left
settings:updated
game:started
round:started
contract:selected
round:scoring_started
round:result_submitted
round:result_confirmed
round:validated
round:corrected
round:undone
main_view:changed
score:updated
game:finished
error
```

## 18. Structure de projet proposée

```txt
tafaron-score/
    README.md
    package.json
    server/
        index.ts
        gameState.ts
        scoring.ts
        validation.ts
        storage.ts
        localNetwork.ts
    client/
        index.html
        src/
            main.tsx
            App.tsx
            screens/
                AdminScreen.tsx
                GameScreen.tsx
                FullTablesScreen.tsx
                JoinScreen.tsx
                WaitingScreen.tsx
                ChooseContractScreen.tsx
                ScoringScreen.tsx
                ResultsScreen.tsx
            components/
                Scoreboard.tsx
                ScoreGraph.tsx
                ContractMatrix.tsx
                FullRoundTables.tsx
                PlayerList.tsx
                QRCodeBlock.tsx
                DeckSummary.tsx
                FullscreenLayout.tsx
            lib/
                socket.ts
                api.ts
                types.ts
    data/
        games/
    docs/
        cahier_des_charges.md
```

## 19. Fonctions métier prioritaires

### 19.1 Constante des rangs

```ts
const RANKS = [
    'As',
    'Roi',
    'Dame',
    'Cavalier',
    'Valet',
    '10',
    '9',
    '8',
    '7',
    '6',
    '5',
    '4',
    '3',
    '2',
] as const;
```

### 19.2 Calcul des cartes à garder

```ts
function computeDeckDistribution(playerCount: number) {
    for (let ranksPerSuit = RANKS.length; ranksPerSuit >= 1; ranksPerSuit--) {
        const cardsUsed = ranksPerSuit * 4;

        if (cardsUsed % playerCount !== 0) {
            continue;
        }

        const keptRanks = RANKS.slice(0, ranksPerSuit);
        const lastRank = keptRanks[keptRanks.length - 1];
        const cardsPerPlayer = cardsUsed / playerCount;

        return {
            ranksPerSuit,
            keptRanks,
            cardsUsed,
            cardsPerPlayer,
            heartsInPlay: ranksPerSuit,
            queensInPlay: keptRanks.includes('Dame') ? 4 : 0,
            keepInstruction: `Garder de l'As au ${lastRank}`,
        };
    }

    throw new Error(`Impossible de trouver une distribution équitable pour ${playerCount} joueurs.`);
}
```

### 19.3 Carte de départ de la réussite

```ts
function computeSuccessStartRank(keptRanks: readonly RankLabel[]) {
    const index = Math.floor(keptRanks.length / 2);

    return {
        successStartRank: keptRanks[index],
        successStartRankPosition: index + 1,
    };
}
```

Exemple :

```txt
As, Roi, Dame, Cavalier, Valet, 10 => index 3 => Cavalier
```

### 19.4 Contrats disponibles pour un joueur

```ts
function getAvailableContractsForPlayer(game: Game, playerId: string): ContractCode[] {
    const alreadyChosen = new Set(
        game.rounds
            .filter(round => round.chooserPlayerId === playerId && round.status === 'validated')
            .map(round => round.contract)
    );

    return game.settings.enabledContracts.filter(contract => !alreadyChosen.has(contract));
}
```

### 19.5 Contrats imitables par le Joker

```ts
function getJokerEligibleContracts(game: Game): Exclude<ContractCode, 'J'>[] {
    return game.settings.enabledContracts.filter(
        (contract): contract is Exclude<ContractCode, 'J'> => contract !== 'J'
    );
}
```

### 19.6 Validation de total

```ts
function validateTotal(label: string, entered: number, expected: number): string[] {
    if (entered !== expected) {
        return [`Le total ${label} doit être ${expected}, mais vaut ${entered}.`];
    }

    return [];
}
```

### 19.7 Détermination du bonus

```ts
function hasChooserSucceededContract(round: Round, result: RoundResult): boolean {
    const chooserId = round.chooserPlayerId;
    const effectiveContract = round.contract === 'J' ? round.jokerContract : round.contract;

    switch (effectiveContract) {
        case 'R':
            return result.firstPlayerId === chooserId;
        case 'C':
            return (result.heartsByPlayer?.[chooserId] ?? 0) === 0;
        case 'D':
            return (result.queensByPlayer?.[chooserId] ?? 0) === 0;
        case 'K':
            return result.kingOfHeartsPlayerId !== chooserId;
        case 'P':
            return (result.tricksByPlayer?.[chooserId] ?? 0) === 0;
        case 'L':
            return result.lastTrickPlayerId !== chooserId;
        case 'T':
            return (result.heartsByPlayer?.[chooserId] ?? 0) === 0
                && (result.queensByPlayer?.[chooserId] ?? 0) === 0
                && result.kingOfHeartsPlayerId !== chooserId
                && (result.tricksByPlayer?.[chooserId] ?? 0) === 0
                && result.lastTrickPlayerId !== chooserId;
        default:
            return false;
    }
}
```

### 19.8 Calcul de score

Créer une fonction unique testable :

```ts
function computeRoundScore(round: Round, result: RoundResult, settings: GameSettings): Record<string, number> {
    // Retour attendu : { [playerId]: scoreDelta }
    // 1. Calculer les points du contrat effectif.
    // 2. Tester hasChooserSucceededContract.
    // 3. Si true, ajouter settings.scoring.bonus au chooserPlayerId.
    return {};
}
```

### 19.9 Recalcul après correction

```ts
function recomputeGameScores(rounds: Round[], players: Player[]): Record<string, number> {
    const totals = Object.fromEntries(players.map(player => [player.id, 0]));

    for (const round of rounds) {
        if (round.status !== 'validated') {
            continue;
        }

        for (const [playerId, delta] of Object.entries(round.scoreDelta)) {
            totals[playerId] += delta;
        }
    }

    return totals;
}
```

## 20. Tests attendus

### 20.1 Tests unitaires

- Calcul des cartes à garder.
- Affichage de l'instruction `Garder de l'As au X`.
- Calcul de la carte de départ de la réussite.
- Contrats disponibles par joueur.
- Contrats imitables par le Joker.
- Calcul réussite.
- Calcul cœurs.
- Calcul dames.
- Calcul roi de cœur.
- Calcul plis.
- Calcul dernier pli.
- Calcul Tafaron.
- Application du bonus uniquement au joueur actif.
- Validation des totaux.
- Recalcul après correction.
- Annulation de la dernière manche.
- Calcul du nombre de manches restantes.
- Statut de réussite des contrats pour affichage vert dans la matrice.

### 20.2 Tests d'intégration

- Création de partie.
- Connexion de plusieurs joueurs.
- Démarrage avec ordre personnalisé.
- Choix d'un contrat par le bon joueur.
- Refus d'un choix par un mauvais joueur.
- Choix d'un Joker puis d'un contrat imité.
- Possibilité de choisir le contrat imité plus tard comme contrat normal.
- Saisie des résultats par l'organisateur.
- Saisie des résultats par les joueurs, avec chaque joueur qui saisit uniquement sa propre main / son propre résultat.
- Validation d'une manche.
- Correction d'une manche.
- Annulation de la dernière manche.
- Mise à jour du score sur l'écran principal.
- Navigation admin / page de jeu / tableaux complets.
- Rechargement du serveur avec restauration de la partie.

## 21. Critères d'acceptation MVP

Le projet est considéré comme fonctionnel si :

- un ordinateur lance l'application en local ;
- les téléphones du même réseau peuvent rejoindre la partie via lien ou QR code ;
- les joueurs peuvent saisir leur nom ;
- les joueurs connectés apparaissent sur la page admin ;
- l'organisateur peut configurer joueurs, contrats, cartes, points, bonus et ordre ;
- l'organisateur peut définir l'ordre des joueurs avant de lancer la partie ;
- l'application affiche quelles cartes garder, par exemple `Garder de l'As au 6` ;
- l'application affiche le nombre de cartes par joueur ;
- l'application affiche la carte de départ de la réussite ;
- le joueur actif reçoit l'écran de choix sur son téléphone ;
- les autres joueurs voient un écran d'attente ;
- les contrats déjà choisis par le joueur actif ne sont plus proposés ;
- le Joker peut être utilisé à n'importe quel moment s'il est disponible ;
- le Joker permet de choisir un contrat imité ;
- choisir `J → C` n'empêche pas de choisir `C` plus tard ;
- une manche peut être jouée, saisie, validée et ajoutée au score ;
- le bonus est configurable au départ ;
- le bonus est appliqué uniquement au joueur actif si son contrat est réussi ;
- les deux modes de saisie existent : organisateur et joueurs ;
- en mode joueurs, chaque joueur saisit uniquement sa propre main / son propre résultat ;
- les erreurs de saisie sont détectées avant validation ;
- l'écran principal affiche une page de jeu plein écran ;
- la page de jeu affiche un graphique des scores cumulés ;
- la page de jeu affiche le nombre de manches restantes ;
- la page de jeu affiche la matrice des contrats ;
- les contrats réussis sont affichés en vert ;
- la page de jeu contient un bouton `Retour admin` ;
- une page plein écran séparée affiche les points par manche et les points cumulés par manche ;
- les téléphones n'affichent pas les scores ni le classement ;
- le score le plus bas est gagnant ;
- une manche validée peut être corrigée ;
- la dernière manche peut être annulée depuis l'admin ;
- la partie est sauvegardée localement ;
- un export JSON ou CSV est possible.

## 22. Décisions confirmées et points optionnels

### Décisions confirmées

- Nom du jeu dans l'application : **Tafaron**.
- Le score le plus bas gagne.
- Les joueurs saisissent leur nom sur téléphone et apparaissent sur la page admin.
- L'organisateur définit l'ordre des joueurs avant de lancer la partie.
- Après lancement, l'ordinateur affiche une page de jeu plein écran.
- La page de jeu affiche un graphique des scores, la matrice des contrats, les contrats réussis en vert et le nombre de manches restantes.
- La page de jeu contient un bouton `Retour admin`.
- Les tableaux complets type Excel sont disponibles dans une page plein écran séparée.
- Cette page dédiée affiche à gauche les points par manche et à droite les points cumulés par manche.
- En mode joueurs, chaque joueur saisit uniquement sa propre main / son propre résultat.
- L'organisateur garde la validation finale des résultats.
- Un bouton `Annuler la dernière manche` doit être présent dans l'admin.
- Une correction de manche validée doit aussi rester possible.
- Les téléphones ne doivent pas afficher les scores ni les tableaux complets.
- Pas de code PIN local pour l'interface organisateur dans le MVP.
- Le choix final de stack technique est laissé à Codex : Node.js/Socket.IO ou Python/FastAPI sont tous les deux acceptés.

### Points optionnels pour plus tard

- Mode reprise automatique de la dernière partie au démarrage.
- Export Excel natif.
- Packaging en application desktop.
- Gestion de plusieurs parties sauvegardées avec une interface de sélection.
