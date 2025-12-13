### Lure Viewer – Rappels de commandes

#### 1. Installer les dépendances (une fois)

```bash
cd "/Users/macbookprojohann/Documents/Lure-App/Lure create/Lure-Viewer-Web"
npm install
```

#### 2. Lancer en mode web (Vite)

```bash
node node_modules/vite/bin/vite.js
```

Puis ouvrir `http://localhost:5173`.

#### 3. Lancer en mode desktop (dev Electron)

Terminal 1 :

```bash
node node_modules/vite/bin/vite.js
```

Terminal 2 :

```bash
node node_modules/electron/cli.js electron/main.cjs
```

#### 4. Build web (pour Vercel ou autre)

```bash
node node_modules/vite/bin/vite.js build
```

#### 5. Build desktop macOS (.dmg)

```bash
node node_modules/vite/bin/vite.js build
node node_modules/electron-builder/out/cli/cli.js --mac
```

Le fichier généré se trouve dans `release/LureViewer-…-arm64.dmg`.

#### 6. Publier une nouvelle version desktop

1. Aller sur GitHub → dépôt `lure-viewer-web` → **Releases**.  
2. Créer / éditer la release (ex : `v0.1.0`).  
3. Glisser le nouveau `.dmg` dans la section **Assets**, puis **Publish release**.  
4. Copier l’URL du `.dmg` (clic droit → *Copy link address*) pour l’utiliser comme lien de téléchargement.

---

### Guide Blender – Ajouter un nouveau leurre à l’app

#### 1. Objectif

L’idée est que n’importe quel créateur puisse ajouter un `.glb` dans l’app **sans toucher au code**, simplement en respectant quelques règles :

- choisir un **type de leurre** dans une liste fournie (ex : `LurePret5`, `Shad`, `Spinnerbait`…),  
- créer les **points d’attache** des triples (et autres accessoires) avec des noms normalisés,  
- éventuellement définir plusieurs **tailles** pour un même modèle.

#### 2. Structure générale du modèle

- 1 fichier = **1 leurre** (tous les objets doivent être sous un même root).  
- L’origine (`0,0,0`) doit être proche du **centre** du leurre.  
- Orientation recommandée :
  - axe **X** = longueur du leurre (tête → queue),  
  - axe **Y** = vertical,  
  - axe **Z** = profondeur.  
- Appliquer les transforms avant export : `Ctrl+A` → **All Transforms** (Location/Rotation/Scale).

#### 3. Tailles du leurre

On indexe les tailles par un **chiffre** placé au début du nom d’attache :

- `1` → Taille 1 (par exemple M)  
- `2` → Taille 2 (L)  
- `3` → Taille 3 (XL)  

L’app fera la correspondance entre ce chiffre et les tailles affichées (M / L / XL).

#### 4. Nommage des points d’attache (triples / palettes)

Chaque point d’attache est un **Empty** (type “Plain Axes” recommandé) placé à l’endroit où la boucle du triple ou de la palette vient se coller.

Format général du nom :

```text
[IndiceTaille][Type][CodeAttache]
```

- `IndiceTaille` : `1`, `2`, `3`… (taille du leurre)  
- `Type` :
  - `T` = Triple uniquement
  - `P` = Palette uniquement
  - `PT` = point qui peut recevoir **palette ou triple**  
- `CodeAttache` : `A`, `B`, `C`… (position : avant / milieu / arrière, etc.)

Exemples :

- `1TA` : taille 1, **Triple** position A (par ex. triple avant)  
- `1TC` : taille 1, **Triple** position C (par ex. triple arrière)  
- `1PA` : taille 1, **Palette** position A  
- `1PTA` : taille 1, point A qui peut recevoir **Palette ou Triple**  
- `2TB` : taille 2, Triple position B, etc.

Quelques règles pratiques :

- Un leurre simple avec **1 seul triple** peut n’utiliser que `1TA` / `2TA` / `3TA`.  
- Un leurre avec **palette arrière** seulement peut utiliser `1PA`, `2PA`, etc.  
- Si le même point peut accueillir palette ou triple, utiliser `PT` : `1PTA`, `2PTA`…
- Si **aucun accessoire n’est prévu** sur une attache donnée (pas de triple, pas de palette), **le nom de l’Empty n’a pas d’importance** pour l’app : il sera simplement ignoré.

#### 5. Conseils pour les attaches dans Blender

- Crée un **anneau / support** (par ex. un petit torus) là où la jupe ou l’anneau du triple vient se fixer.  
- Place l’Empty **au centre de cet anneau**, légèrement à l’extérieur du corps.  
- Fais de l’Empty un **enfant** du mesh principal du leurre, pour qu’il suive bien les mouvements / l’échelle.

#### 6. Export en glTF (.glb)

1. Sélectionner le root du leurre (et s’assurer que tout est bien parenté).  
2. `File → Export → glTF 2.0 (.glb)`.  
3. Options importantes :
   - **Format** : `glTF Binary (.glb)`  
   - **Include** : `Selected Objects` (si tu ne veux exporter que le leurre)  
   - `Apply Modifiers` activé  
4. Sauvegarder le fichier dans `public/models/` (par exemple `Spinnerbait.glb`).

Ensuite, l’app pourra être mise à jour pour reconnaître ce nouveau modèle (type + sockets `1TA`, `2TA`, etc.) et y attacher automatiquement les triples / palettes aux bons endroits.

---

### Guide textures – Créer une texture compatible pour l’app

Pour que les textures fonctionnent bien dans l’app (mode “mask” type pike, etc.), le créateur doit respecter ces règles :

- **Format** : `PNG`  
- **Taille minimale** : **2048 × 2048** (carré).  
- **Fond** : complètement **blanc** `#ffffff` (zones où la couleur du leurre reste visible).  
- **Motif** : en **noir** `#000000` (zones où la texture doit s’appliquer).  
- Facultatif : tu peux utiliser des gris pour des intensités intermédiaires, mais le contraste principal doit rester **noir sur blanc**.

Les fichiers doivent être placés dans `public/textures/` (par exemple : `Pike-002.png`, `Pike_003.png`) et pourront être référencés dans l’app via leur chemin relatif (`textures/MonMotif.png`).
