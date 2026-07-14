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
- Les CSV utilisent le séparateur `;` et l’encodage UTF-8 avec BOM pour Excel en français.

Pour sauvegarder les parties sur un autre support, copier le dossier `data/games/` lorsque le serveur est arrêté.

## Dépannage réseau

- Vérifier que le téléphone et l’ordinateur utilisent le même Wi-Fi, sans réseau invité isolé.
- Choisir l’adresse commençant généralement par `192.168.`, `10.` ou `172.16`–`172.31`.
- Tester le lien affiché sous le QR code directement dans le navigateur du téléphone.
- Autoriser Node.js dans le pare-feu Windows pour les réseaux privés.
- Désactiver temporairement un VPN s’il place sa propre adresse avant l’adresse Wi-Fi.
- Ne pas utiliser `localhost` sur le téléphone : cette adresse désignerait le téléphone lui-même.

## Documentation du projet

- [Plan d’implémentation](IMPLEMENTATION_PLAN.md)
- [Checklist d’acceptation](ACCEPTANCE_CHECKLIST.md)
- [Cahier des charges](docs/cahier-des-charges.md)
