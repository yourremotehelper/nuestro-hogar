# Nuestro Hogar: puesta en marcha

PWA en HTML/CSS/JS sin compilación. Usa Firebase (Auth con Google y Firestore, plan gratuito Spark) y se publica en GitHub Pages.
Todo se hace desde el navegador.

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Lo de hoy y lo atrasado, vencimientos cercanos, semanas de embarazo, deuda entre los dos y reparto de la carga |
| **Tareas** | Cada tarea tiene un responsable de principio a fin, una fecha y puede repetirse (diaria, semanal, mensual…). Se filtran por área y por persona |
| **Compra** | Lista compartida en tiempo real, agrupada por secciones del súper |
| **Dinero** | Gastos compartidos, quién debe a quién, opción de saldar cuentas, gasto del mes por categoría y pagos recurrentes |
| **Bebé y crianza** | Fecha prevista de parto con semana y trimestre, citas, lista de preparativos (canastilla, bolsa del hospital, trámites) repartida entre los dos, y fichas de los hijos |
| **Mascotas** | Ficha de cada mascota y cuidados periódicos (vacunas, desparasitación, veterinario, pienso) |
| **Papeleo** | DNI, seguros, ITV, IBI, renta… con aviso de caducidad configurable |
| **Reparto de carga** | Quién tiene más responsabilidades activas y quién ha hecho más en los últimos 30 días, por áreas |

Si `config.js` no tiene la configuración de Firebase, la app funciona en **modo demo**: los datos se guardan solo en ese navegador.

---

## 1. Crear el proyecto de Firebase (unos 10 minutos)

1. Entra en https://console.firebase.google.com y pulsa **Añadir proyecto** (por ejemplo, `nuestro-hogar`). Google Analytics no hace falta.
2. **Compilación > Authentication > Comenzar > Google** → actívalo y guarda.
3. **Compilación > Firestore Database > Crear base de datos**
   - Ubicación: `europe-southwest1 (Madrid)` o `eur3`.
   - Elige **modo de producción**.
4. Pestaña **Reglas**: borra lo que haya, pega el contenido de `firestore.rules` y pulsa **Publicar**.
5. **Configuración del proyecto (⚙️) > Tus apps > `</>` (Web)**: regístrala con el nombre que quieras (no marques Hosting).
   Copia el objeto `firebaseConfig` y pégalo en `config.js`:
   ```js
   window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" };
   ```
   > La `apiKey` de Firebase no es secreta. Lo que protege los datos son las reglas de Firestore.

## 2. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo, `nuestro-hogar`).
   *Con la cuenta gratuita, GitHub Pages solo funciona con repositorios públicos. El código queda visible, pero vuestros datos no, porque están en Firestore y protegidos por las reglas.*
2. **Add file > Upload files**: sube todo el contenido de esta carpeta (`index.html`, `app.js`, `styles.css`, `config.js`, `manifest.json`, `sw.js` y la carpeta `icons`).
3. **Settings > Pages > Branch: `main` / `(root)` > Save**. En un par de minutos estará en `https://TU-USUARIO.github.io/nuestro-hogar/`.
4. En Firebase: **Authentication > Configuración > Dominios autorizados > Añadir dominio** → `TU-USUARIO.github.io`.

## 3. Instalarla en los dos móviles

1. Abre la URL en **Chrome para Android** → menú ⋮ → **Instalar aplicación**.
2. Entra con Google → **Crear** → ponle nombre al hogar.
3. **Más > Ajustes > Compartir enlace** y envíaselo a tu pareja por WhatsApp. Al abrirlo y entrar con su cuenta de Google, quedará unida a vuestro hogar.
4. En **Ajustes > Activar avisos**, cada uno activa sus notificaciones.

## Cómo usarla bien (recomendación)

- Al crear algo, el **responsable** es quien se encarga de todo: acordarse, organizarlo y hacerlo. No vale "ayudar".
- Usad **"Ambos"** solo para lo que de verdad hacéis juntos (por ejemplo, las citas del embarazo).
- Una vez por semana, 5 minutos juntos en **Reparto de carga** para reequilibrar.

## Actualizar la app

Cambia los archivos en GitHub y **sube el número de versión** en `sw.js` (`hogar-v1` → `hogar-v2`) para que los móviles descarguen la nueva versión.

## Limitaciones de esta primera versión

- **Avisos:** salen al abrir la app (una vez al día). Las notificaciones push con la app cerrada necesitan Cloud Functions, que requieren el plan Blaze de Firebase (de pago por uso, normalmente 0 € con este volumen). Se puede añadir más adelante.
- Sin adjuntar archivos (fotos de pólizas, ecografías…). Se podría hacer con Firebase Storage.

## Más adelante: Google Play

Cuando esté probada, se puede empaquetar sin reescribirla con **PWABuilder** (https://www.pwabuilder.com). Le das la URL y genera el paquete de Android.
Con una cuenta personal nueva de Google Play hay que hacer una **prueba cerrada con 12 testers durante 14 días** antes de publicar.
