# 🌐 Integración con la API de The Movie Database (TMDB)

BingeTime utiliza la API de **The Movie Database (TMDB)** (`https://api.themoviedb.org/3`) para consultar catálogos de series, pósters, sinopsis, fechas de emisión, temporadas, episodios y proveedores de streaming.

> **Atribución Requerida:**  
> *Data provided by [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.*

Volver al índice: [[BingeTime]].

---

## 📡 Endpoints Consumidos

1. **Búsqueda y Tendencias:**
   * `/search/tv?query={query}`: Búsqueda en tiempo real de títulos.
   * `/trending/tv/week` y `/tv/popular`: Series populares y tendencias para la pantalla principal.

2. **Detalles de la Serie y Temporadas:**
   * `/tv/{series_id}`: Información general, número de temporadas, episodios, estado y duración media (`episode_run_time`).
   * `/tv/{series_id}/season/{season_number}`: Detalle de cada temporada con listado de episodios, duración real por capítulo y fecha de emisión (`air_date`).

3. **Plataformas de Streaming (*Watch Providers*):**
   * `/tv/{series_id}/watch/providers`: Filtro por plataformas (Netflix, Max, Disney+, Prime Video, Apple TV+, Movistar Plus+, etc.).

4. **Reparto y Créditos:**
   * `/tv/{series_id}/credits`: Actores, personajes y fotos.

---

## 📦 Modelos y Proveedores (`src/app/models.ts`)

* **Imágenes de TMDB:** Construcción de URLs utilizando `https://image.tmdb.org/t/p/{size}/...` (w92, w185, w500, original).
* **Filtros por Década y Géneros:** Filtrado local asistido (`2020s`, `2010s`, `1990s`...) y lista estándar de géneros (`ALL_GENRES`).

---

## Enlaces Relacionados
* [[Calculadora-de-Tiempo]] — Procesamiento de minutos provistos por TMDB.
* [[Seguimiento-y-Estadisticas]] — Calendario de emisiones y seguimiento de episodios.
* [[Arquitectura]] — Servicios Angular y llamadas HTTP.
