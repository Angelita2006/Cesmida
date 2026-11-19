# Cesmida

Aplicación personal para despensa, compras semanales, recetas y finanzas. Usa Expo/React Native para Android y web, FastAPI para la API y PostgreSQL para los datos.

## Producción autoalojada con Docker

La instalación despliega tres servicios: web con Nginx, API y PostgreSQL. La base vive en un volumen Docker persistente y se inicializa con tablas, tipos, vistas e informes; el puerto PostgreSQL solo queda dentro de la red privada de Docker.

En **Despensa**, registra cada alimento con una cantidad actual, una unidad base (por ejemplo, latas, rebanadas, g o ml) y, si quieres, una cantidad ideal. En **Recetas**, elige alimentos de tu despensa y define cantidades con esas mismas unidades. Al marcar una receta como cocinada se descuentan sus ingredientes. **Compra** genera la diferencia entre la cantidad ideal y lo que tienes.

1. Instala Docker Desktop en Windows o Docker Engine en tu servidor Linux.
2. Copia .env.example como .env y cambia POSTGRES_PASSWORD por una clave aleatoria larga.
3. Arranca en la carpeta Cesmida con el comando: docker compose up -d --build
4. Abre http://localhost:8088. La API está disponible bajo /api; su estado se consulta en /api/health.

La versión web se puede instalar como aplicación de escritorio desde Microsoft Edge o Chrome: abre Cesmida por HTTPS en el dominio del servidor y elige Instalar Cesmida en el menú del navegador. En Android, abre la dirección del PC desde el móvil conectado a la misma red. Para instalar la PWA, sirve la web por HTTPS y elige **Añadir a pantalla de inicio**; la sincronización requiere que el PC y el servidor estén encendidos.

Para generar el instalador de escritorio Windows: desde `frontend`, ejecuta `npm run build:desktop`. El instalador `.exe` aparece en `frontend/desktop-release`; al abrir Cesmida, iniciará Docker Compose y la API cuando Docker Desktop y su motor Linux estén disponibles. El instalador se configura para iniciarse al iniciar sesión en Windows.

Para generar una APK Android instalable: desde `frontend`, ejecuta primero `npx eas-cli login` y después `npm run build:android`. La APK se construye con Expo Application Services y requiere una cuenta Expo. Para usar el backend del PC desde la app Android nativa, configura `EXPO_PUBLIC_API_URL` con `http://IP-LOCAL-DEL-PC:8001` durante la compilación. La APK y la PWA móvil se conectan al servidor del PC; ese servidor debe estar funcionando en la misma red.

Para publicarla en Internet, apunta el dominio del servidor a Docker y termina HTTPS con Caddy, Nginx o un proxy TLS equivalente. Añade el origen HTTPS a ALLOWED_ORIGINS. No expongas el puerto 5432 de PostgreSQL.

## Android y desarrollo local

Desde `frontend`, ejecuta `npm install` y `npm run android` o `npm run web`. Con Docker Compose, la API queda disponible en `http://localhost:8001`, y Expo Web puede abrirse en `http://localhost:8081`. Si ejecutas la API manualmente desde `backend`, usa Python 3.12, instala `requirements.txt` y ejecuta `uvicorn app.main:app --reload --host 0.0.0.0 --port 8001`. En un móvil físico, configura `EXPO_PUBLIC_API_URL` con `http://IP-LOCAL-DEL-PC:8001`.

## Datos y copias de seguridad

La base Docker se llama houseStore, es independiente de cualquier PostgreSQL instalado en Windows, y guarda tus datos en el volumen cesmida_postgres. La primera inicialización crea la estructura y categorías de finanzas. Las tablas vacías no inventan alimentos ni movimientos.

Copia de seguridad manual desde PowerShell: docker compose exec -T db pg_dump -U cesmida houseStore > cesmida-backup.sql

Al restaurar, conserva el volumen anterior o restaura el volcado. El script de inicialización solo se ejecuta cuando Docker crea un volumen vacío.
