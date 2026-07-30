# CLICK! — Retro Arcade

Juego incremental retro desarrollado con TypeScript, HTML y CSS, preparado para ejecutarse localmente y publicarse como sitio estático en GitHub Pages.

## Funciones

- Conteo real de clics manuales separado de la producción automática.
- Monedas, CPS, clics críticos, combo rápido y progreso offline.
- Ocho mejoras permanentes, consumibles, prestigio y eventos temporales.
- Misiones diarias, 100 logros y tres minijuegos.
- Guardado local, exportación e importación de partidas.
- Diseño retro gamer responsive para escritorio, tablet y móvil.
- Easter egg Image Lab desbloqueable al verificar una estrella en GitHub.
- Conversión local de imágenes a PNG, JPG o WebP.

## Desarrollo local

```bash
npm install
npm run check
npm run build
npm run dev
```

El servidor local se abre en `http://127.0.0.1:4173`.

## GitHub Pages

El archivo `index.html` permanece en la raíz y los recursos compilados se publican desde `assets`. El workflow incluido en `.github/workflows/pages.yml` despliega el sitio automáticamente.
