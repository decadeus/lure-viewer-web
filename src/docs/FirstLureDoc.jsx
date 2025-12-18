import React from "react";

export default function FirstLureDoc() {
  return (
    <>
      <h2 className="docs-blender-title">Create first lure</h2>
      <p className="docs-blender-intro">
        Cette section décrit le workflow complet pour préparer ton premier
        leurre Blender pour Peskan.
      </p>

      {/* Étape 1 : vue de départ d'un nouveau projet Blender */}
      <h3 className="docs-blender-section-title">
        Étape 1 — Vue de départ d&apos;un nouveau projet
      </h3>
      <p className="docs-blender-text">
        Quand tu ouvres Blender sur un nouveau projet, tu arrives sur cette
        vue&nbsp;: un cube, une caméra et une lampe au centre de la scène.
      </p>

      <figure className="docs-blender-figure">
        {/* Capture d'écran stockée dans public/Document/First_Lure-1.png.
            Garde la même résolution pour toutes les étapes pour un rendu homogène. */}
        <img
          src="/Document/First_Lure-1.png"
          alt="Vue de départ d'un nouveau projet Blender (cube, caméra, lumière)"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Vue de départ d&apos;un nouveau projet Blender (cube par défaut,
          caméra, lumière).
        </figcaption>
      </figure>
      <figure className="docs-blender-inline-figure">
        <img
          src="/Document/Light.png"
          alt="Suppression de la caméra et de la lumière dans Blender"
          className="docs-blender-inline-image"
        />
      </figure>
      <p className="docs-blender-text">
        Pour notre premier leurre, on va repartir d&apos;une scène
        propre&nbsp;: dans la colonne de droite, sélectionne d&apos;abord
        l&apos;objet <strong>Camera</strong> puis clique sur l&apos;icône
        <strong> X</strong> pour le supprimer, puis fais la même chose avec
        <strong> Light</strong>. Il ne restera plus que le cube.
      </p>

      <p className="docs-blender-text">
        L&apos;app Peskan lit la taille réelle du leurre à partir du
        <strong> bounding box</strong> du modèle Blender. Il faut donc que 1
        unité Blender corresponde à 1&nbsp;cm pour que la longueur affichée
        dans l&apos;app soit correcte.
      </p>
      <figure className="docs-blender-inline-figure">
        <img
          src="/Document/Units.png"
          alt="Réglage des unités en centimètres dans Blender"
          className="docs-blender-inline-image"
        />
      </figure>
      <p className="docs-blender-text">
        Dans Blender&nbsp;5, ouvre l&apos;onglet
        <strong> Scene Properties</strong> (icône Triangle/rond/point dans la
        colonne de droite), puis la section <strong>Units</strong> et
        règle&nbsp;:
      </p>
      <ul className="docs-blender-list">
        <li>
          <strong>Unit System</strong> = <strong>Metric</strong>
        </li>
        <li>
          <strong>Unit Scale</strong> = <strong>0.01</strong> (1 unité Blender
          = 1&nbsp;cm)
        </li>
        <li>
          <strong>Length</strong> = <strong>Centimeters</strong>
        </li>
      </ul>
      <p className="docs-blender-text">
        Ensuite, adapte la forme du leurre pour que sa longueur corresponde à ce
        que tu veux (8&nbsp;cm, 10&nbsp;cm, etc.)&nbsp;: Peskan utilisera
        directement cette valeur pour tous les affichages et calculs liés à la
        taille.
      </p>

      <p className="docs-blender-text">
        Renomme ensuite ce cube en <strong>Body</strong> dans le champ de nom en
        haut à droite (onglet Object). Ce sera le mesh principal du corps du
        leurre dans Peskan.
      </p>

      <p className="docs-blender-text">
        Rappel important&nbsp;: avant de modifier quoi que ce soit, pense
        toujours à <strong>sélectionner l&apos;objet</strong> concerné dans la
        vue 3D ou dans l&apos;outliner (liste des objets en haut à droite). Pour
        sélectionner <strong>tous</strong> les objets visibles, appuie sur
        <strong> A</strong>.
      </p>

      <p className="docs-blender-text">
        Pour ce premier exemple, on va partir d&apos;un leurre très simple de
        <strong> 5&nbsp;cm</strong> de long, <strong>2&nbsp;cm</strong> de large
        et <strong>2&nbsp;cm</strong> de haut. Avec l&apos;objet
        <strong> Body</strong> sélectionné, ouvre l&apos;onglet
        <strong> Item</strong> (en haut à droite de la colonne des propriétés)
        et saisis ces valeurs dans le bloc <strong>Dimensions</strong> (X, Y,
        Z).
      </p>
      <figure className="docs-blender-figure">
        <img
          src="/Document/First_Lure-7.png"
          alt="Réglage des dimensions du leurre à 5 cm x 2 cm x 2 cm"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Réglage des <strong>Dimensions</strong> du mesh
          <strong> Body</strong> à 5&nbsp;cm × 2&nbsp;cm × 2&nbsp;cm après être
          passé en unités métriques (centimètres).
        </figcaption>
      </figure>

      {/* Étape 2 : ajouter un Subdivision Surface */}
      <h3 className="docs-blender-section-title">
        Étape 2 — Lisser le corps avec un Subdivision Surface
      </h3>
      <p className="docs-blender-text">
        Dans la colonne de droite, va dans l&apos;onglet
        <strong> Modifiers</strong> (icône de clé bleue), clique sur
        <strong> Add Modifier &gt; Generate &gt; Subdivision Surface</strong>.
        Dans les réglages du modificateur, augmente
        <strong> Levels Viewport</strong> à <strong>3</strong> pour obtenir un
        corps plus lisse.
      </p>
      <figure className="docs-blender-figure">
        <img
          src="/Document/First_Lure-21.png"
          alt="Ajouter un Subdivision Surface au mesh Body avec Levels Viewport à 3"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Onglet Modifiers (clé bleue) avec un Subdivision Surface sur
          <strong> Body</strong> et <strong>Levels Viewport = 3</strong>.
        </figcaption>
      </figure>

      {/* Étape 3 : mise en forme de base sur l'axe X */}
      <h3 className="docs-blender-section-title">
        Étape 3 — Mise en forme de base sur l&apos;axe X
      </h3>
      <p className="docs-blender-text">
        Sélectionne toujours l&apos;objet <strong>Body</strong>, puis en haut à
        gauche passe de <strong>Object Mode</strong> à
        <strong> Edit Mode</strong>. Le leurre doit être orienté le long de
        l&apos;axe <strong>X</strong>, on va donc commencer à l&apos;aplatir et
        lui donner une forme de poisson.
      </p>
      <p className="docs-blender-text">
        Pour être sûr de manipuler des <strong>faces</strong> et non des arêtes
        ou des sommets, active le mode de sélection de faces (icône avec
        <strong> deux carrés superposés</strong>, dont un en blanc, en haut à
        gauche de la vue 3D). Ensuite, dans le menu du haut, active
        <strong> Mesh &gt; Symmetry</strong> et choisis l&apos;axe
        <strong> Y</strong> pour que les modifications soient symétriques
        gauche/droite.
      </p>
      <p className="docs-blender-text">
        Clique sur une face à l&apos;avant du cube, puis utilise l&apos;outil
        <strong> Move</strong> (icône avec quatre flèches à droite) et déplace
        cette face avec la flèche <strong>verte</strong> (axe Y) pour étirer le
        corps. Répète l&apos;opération sur quelques faces pour commencer la
        forme. Si ton objet n&apos;est plus centré, repasse en
        <strong> Object Mode</strong> puis va dans
        <strong> Object &gt; Set Origin &gt; Geometry to Origin</strong>.
      </p>
      <figure className="docs-blender-figure">
        <img
          src="/Document/First_Lure-3.png"
          alt="Mise en forme du mesh Body en Edit Mode avec sélection de faces et symétrie"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Edit Mode sur <strong>Body</strong> avec sélection de faces, symétrie
          activée et déplacement des faces pour donner la forme de base du
          leurre.
        </figcaption>
      </figure>

      {/* Étape 4 : allonger le leurre et ajouter des découpes */}
      <h3 className="docs-blender-section-title">
        Étape 4 — Allonger le leurre et ajouter des découpes
      </h3>
      <p className="docs-blender-text">
        Repasse en <strong>Edit Mode</strong> si nécessaire. Sélectionne une
        face à l&apos;avant du leurre, mais cette fois
        <strong> sans utiliser la symétrie</strong> pour garder un peu
        d&apos;asymétrie naturelle. Avec l&apos;outil
        <strong> Move</strong>, déplace cette face le long de la flèche
        <strong> rouge</strong> (axe X) pour allonger le corps.
      </p>

      <p className="docs-blender-text">
        On va maintenant découper le leurre en plusieurs segments pour mieux
        contrôler la forme. Appuie sur <strong>A</strong> pour sélectionner tout
        le mesh, puis choisis l&apos;outil <strong>Loop Cut</strong>. En
        survolant le leurre, tu vois des traits jaunes&nbsp;: clique quand ces
        traits sont <strong>verticaux</strong> par rapport au leurre. En bas à
        gauche, ouvre le panneau <strong>Loop Cut and Slide</strong> et règle
        <strong> Number of Cuts</strong> sur <strong>4</strong>.
      </p>
      <figure className="docs-blender-figure">
        <img
          src="/Document/First_Lure-4.png"
          alt="Allongement du leurre et ajout de plusieurs loop cuts"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Le mesh <strong>Body</strong> allongé sur l&apos;axe X avec plusieurs
          <em> loop cuts</em> pour pouvoir détailler la forme du leurre.
        </figcaption>
      </figure>

      {/* Étape 5 : déformation sur l'axe Z */}
      <h3 className="docs-blender-section-title">
        Étape 5 — Déformer le profil sur l&apos;axe Z
      </h3>
      <p className="docs-blender-text">
        Pour travailler le profil (bosse, dos, ventre), reste en
        <strong> Edit Mode</strong> et repasse sur l&apos;outil
        <strong> Select Box</strong> (première icône). Sélectionne deux faces
        sur le dessus du leurre, <strong>sans symétrie</strong> cette fois.
      </p>
      <p className="docs-blender-text">
        Choisis ensuite l&apos;outil <strong>Rotate</strong> et fais tourner ces
        faces en utilisant l&apos;arc <strong>vert</strong> pour les déformer sur
        l&apos;axe <strong>Z</strong>. Quand une bosse se forme, repasse sur
        <strong> Move</strong> pour affiner la position des faces. Quand tu
        modifies l&apos;épaisseur du leurre, pense à réactiver la
        <strong> symétrie Y</strong> pour garder un volume identique à gauche
        et à droite.
      </p>
      <p className="docs-blender-text">
        Les outils <strong>Move</strong> et <strong>Rotate</strong> sont les
        mouvements principaux à maîtriser pour sculpter la forme générale.
        N&apos;hésite pas à t&apos;exercer plusieurs fois sur un cube de test avant de
        passer à un leurre réel.
      </p>
      <figure className="docs-blender-figure">
        <img
          src="/Document/First_Lure-5.png"
          alt="Déformation du profil du leurre sur l'axe Z avec Rotate et Move"
          className="docs-blender-image"
        />
        <figcaption className="docs-blender-figcaption">
          Déformation du profil sur l&apos;axe Z en sélectionnant quelques faces,
          puis en combinant <strong>Rotate</strong> et <strong>Move</strong>.
        </figcaption>
      </figure>

      {/* Étape 6 : préparer l'export vers Peskan */}
      <h3 className="docs-blender-section-title">
        Étape 6 — Exporter le leurre au format glb pour Peskan
      </h3>
      <p className="docs-blender-text">
        Quand la forme de ton leurre te convient, repasse en
        <strong> Object Mode</strong>. Appuie sur <strong>A</strong> pour
        sélectionner ton objet <strong>Body</strong>, puis fais un
        <strong> clic droit</strong> et choisis <strong>Shade Auto Smooth</strong>
        pour adoucir le rendu des faces.
      </p>
      <p className="docs-blender-text">
        Ensuite, va dans <strong>File &gt; Export &gt; glTF 2.0 (.glb)</strong>.
        Dans le panneau d&apos;export à droite, dans la section
        <strong> Include</strong>, coche <strong>Selected Objects</strong> pour
        n&apos;exporter que ton leurre. Plus bas, dans la section
        <strong> Mesh</strong>, coche <strong>Apply Modifiers</strong> pour que
        le Subdivision Surface et les autres modificateurs soient appliqués dans
        le fichier final.
      </p>
      <p className="docs-blender-text">
        Choisis un nom explicite (par exemple <code>MyFirstLure.glb</code>) et
        un dossier de sortie que tu retrouveras facilement, puis clique sur
        <strong> Export glTF 2.0</strong>. Tu peux maintenant importer ce
        fichier <code>.glb</code> dans Peskan.
      </p>

    
    </>
  );
}
