# Estructura del backend

El backend usa capas habituales de Spring Boot. Cada paquete tiene una responsabilidad:

| Paquete | Responsabilidad | Ejemplo |
| --- | --- | --- |
| `controller` | Recibir peticiones HTTP, validar DTOs y devolver respuestas | `ProjectController`, `HealthController` |
| `dto/request` | Definir los datos que acepta la API | `ScanProjectRequest` |
| `dto/response` | Definir los datos que devuelve la API | `ProjectResponse`, `ComponentResponse` |
| `service` | Coordinar operaciones y aplicar la lógica del análisis | `ProjectService`, `ScanService` |
| `repository` | Guardar y consultar los resultados de la sesión | `ProjectRepository` |
| `model` | Representar los datos internos de la aplicación | `ProjectMap`, `ProjectComponent`, `ProjectConnection`, `Evidence` |
| `mapper` | Convertir modelos internos a DTOs de respuesta | `ProjectMapper` |
| `detector` | Interpretar manifiestos y detectar tecnologías | `ManifestDetector`, `ComposeDetector`, `TechnologyDetector` |
| `exception` | Definir errores de aplicación y convertirlos en respuestas HTTP | `ScanException`, `ProjectNotFoundException`, `GlobalExceptionHandler` |
| `config` | Configurar las restricciones de acceso local | `LocalAccessFilter` |

## Ejemplo: analizar un proyecto

1. Llega `POST /api/projects/scan` con `{"path":"."}` para analizar la carpeta configurada.
2. `ProjectController` recibe un `ScanProjectRequest`; Spring comprueba que la ruta no esté vacía ni supere el tamaño permitido.
3. `ProjectService` pide a `ScanService` que analice esa carpeta.
4. `ScanService` verifica la ruta, recorre archivos con límites de seguridad y entrega texto a los detectores. Devuelve un `ProjectMap`.
5. `ProjectService` guarda ese resultado en `ProjectRepository`. El repositorio conserva hasta 20 proyectos en memoria, reemplaza los reanalizados y permite recuperarlos por ID.
6. El controlador utiliza `ProjectMapper` para convertir el resultado en `ProjectResponse` y devolver JSON al frontend.

Los servicios no conocen los controladores, DTOs HTTP ni códigos de estado. Si aparece un error de dominio, `GlobalExceptionHandler` devuelve 400 para un análisis inválido o 404 para un proyecto inexistente.

## Qué significaba graph

Un grafo es un conjunto de componentes y relaciones. En DevMap, un componente puede ser una aplicación Spring Boot o Redis; una relación puede indicar que la aplicación posiblemente utiliza Redis.

El antiguo paquete `graph` contenía únicamente esos datos. Ahora están en `model`, con nombres como `ProjectComponent` y `ProjectConnection`. No hace falta aprender otra arquitectura o instalar una base de datos de grafos.

La API sigue usando los campos JSON `nodes` y `edges` porque el frontend ya los consume. El mapper traduce `components` a `nodes` y `connections` a `edges`, conservando evidencias, avisos y estado desconocido. Así se puede modificar el modelo interno sin cambiar automáticamente la API.

## Por qué no hay entity o implementaciones duplicadas

No hay base de datos ni JPA en esta V1, así que los modelos son records de Java y no entidades persistentes. `ProjectRepository` es una clase concreta de almacenamiento en memoria. Los servicios también son clases concretas, sin parejas `Service`/`ServiceImpl` innecesarias.

`TechnologyDetector` sí es una interfaz porque ya hay varios detectores intercambiables. Sus records internos describen hallazgos del detector y no son DTOs de la API.

El análisis mantiene su comportamiento local: no ejecuta el código de los repositorios, no resuelve URLs y no añade nube ni telemetría.
