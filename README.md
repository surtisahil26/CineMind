# CineMind

CineMind is a frontend-only editorial film journal built with semantic HTML, CSS, vanilla JavaScript, JSON catalogs, and browser localStorage. It does not use a framework or backend.

## Run locally

The catalogs load with `fetch`, so serve this folder over HTTP instead of opening an HTML file with `file://`.

```powershell
cd outputs/CineMind
python -m http.server 8000
```

Open `http://localhost:8000` in a browser.

## Catalogs and browser data

- `data/movies.json` contains the public starter catalog. Admin create, edit, and delete actions are saved in this browser's localStorage and do not write to the JSON file.
- `data/series.json` contains the series profiles.
- `data/books.json` contains book recommendations with an explicit relationship label such as “Adapted from” or “Inspired by.”
- Likes, bookmarks, comments, theme preference, and newsletter demo signups use localStorage. If browser storage is disabled, the current page session uses an in-memory fallback.
- Contact and newsletter forms are frontend demos and do not send messages or email.

## Image sources and fallbacks

Movie and series posters use TMDB artwork, with the two previously broken series posters stored locally in `assets/series/`. The six book entries include local cover files in `assets/books/` sourced through the Open Library Covers API. Character profiles use their associated movie poster when a character-specific image is unavailable. Arrival and Interstellar field-note cards use local TMDB backdrops in `assets/heroes/`. If any future image cannot load, the shared renderer keeps the media frame intact and displays a cinematic fallback.

## Pages and features

- `index.html` — cinematic CSS hero, featured Dune: Part Two, trending carousel, recommendation widget, book shelf, newsletter
- `movies.html` — live search, genre chips, sorting, archive cards
- `review.html?id=arrival` — story and character analysis, strategy, psychology, lessons, quote, related films, likes, bookmarks, and comments
- `series.html` — eight series analysis profiles
- `character-lab.html` — editorial profiles for seven film characters
- `about.html` and `contact.html` — Sahil Surti's editorial note and local form confirmation
- `admin.html` — browser-local film create, read, update, and delete dashboard
