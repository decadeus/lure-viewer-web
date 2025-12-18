import React from "react";

export default function InstallBlender() {
  return (
    <>
      <h2 className="docs-blender-title">How to install Blender</h2>
      <p className="docs-blender-intro">
        Peskan est pensé pour fonctionner avec Blender 3.x ou 4.x. Voici la
        configuration recommandée pour démarrer.
      </p>
      <ul className="docs-blender-list">
        <li>
          Télécharge Blender depuis le site officiel (
          <code>blender.org</code>).
        </li>
        <li>
          Installe la version LTS si tu veux une version stable pour la
          production.
        </li>
        <li>
          Vérifie que l&apos;export <code>.glb</code> / <code>gltf</code> est bien
          activé (Add-ons &gt; Import-Export &gt; glTF 2.0).
        </li>
      </ul>
    </>
  );
}

