# Type for Treat: website

`index.html` + `main.js` load `game.riv` (the signed game) with the Rive web runtime in `vendor/`.
Saves (candies, highscores, purchases) live in each player's browser (localStorage).

## Update the game
In the game project (`TFT-CLI`): `scripts/build-web.sh` -> copies a fresh signed `game.riv` here.
Then publish (below).

## Test locally
`./serve.sh`, open http://localhost:8000 (do not double-click index.html).

## Publish (GitHub Pages)
First time: create an empty repo on github.com named `type-for-treat`, then in this folder:
    git remote add origin https://github.com/<your-username>/type-for-treat.git
    git push -u origin main
Then on GitHub: Settings > Pages > Deploy from branch > `main` / root.
The game lives at https://<your-username>.github.io/type-for-treat/

Every update after that:
    git add -A && git commit -m "new version" && git push

## Embed in Framer
Add an Embed element > URL, paste the game link. Use Framer for the landing page, not the game itself.
