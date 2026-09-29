/* CineMind shared runtime. Each renderer exits when its page mount is absent. */
const DATA_URLS = { movies: 'data/movies.json', series: 'data/series.json', books: 'data/books.json' };
const STORE = { movies: 'cinemind.movies.v2', theme: 'cinemind.theme', likes: 'cinemind.likes', bookmarks: 'cinemind.bookmarks', comments: 'cinemind.comments', newsletter: 'cinemind.newsletter' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const memoryStore = new Map();
let storageWarningShown = false;
let movies = [];
let series = [];
let books = [];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function readStore(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
  catch { return memoryStore.has(key) ? memoryStore.get(key) : fallback; }
}
function writeStore(key, value) {
  memoryStore.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { if (!storageWarningShown) { storageWarningShown = true; toast('Browser storage is unavailable. Changes will last for this session only.', 'error'); } return false; }
}
function toast(message, type = 'success') {
  let region = $('.toast-region');
  if (!region) { region = document.createElement('div'); region.className = 'toast-region'; region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite'); document.body.append(region); }
  const item = document.createElement('div'); item.className = `toast toast-${type}`; item.textContent = message; region.append(item);
  window.setTimeout(() => item.remove(), 3600);
}
function initials(title) {
  const ignored = new Set(['a', 'an', 'and', 'of', 'the']);
  const words = String(title || 'CineMind').trim().split(/\s+/).filter(word => word && !ignored.has(word.toLowerCase()));
  return (words.length ? words : ['CineMind']).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}
function imageMarkup(src, title, kind = 'film', options = {}) {
  const { alt = `${title} ${kind} artwork`, className = '', width = 780, height = 488 } = options;
  const hasSource = typeof src === 'string' && src.trim().length > 0;
  const fallbackTitle = kind === 'character' ? `<strong class="fallback-name">${escapeHTML(title)}</strong>` : '';
  const fallbackLabel = `${escapeHTML(kind)} artwork`;
  return `<div class="image-frame ${escapeHTML(className)} ${hasSource ? '' : 'image-failed'}" data-image-frame data-kind="${escapeHTML(kind)}">${hasSource ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" loading="lazy" width="${width}" height="${height}">` : ''}<div class="image-fallback" aria-hidden="true"><span class="fallback-mark">${escapeHTML(initials(title))}</span>${fallbackTitle}<small>${fallbackLabel}</small></div></div>`;
}
function bindImages(root = document) {
  $$('[data-image-frame] img', root).forEach(image => {
    if (image.dataset.fallbackBound) return;
    image.dataset.fallbackBound = 'true';
    const fail = () => image.closest('[data-image-frame]')?.classList.add('image-failed');
    image.addEventListener('error', fail, { once: true });
    if (image.complete && image.naturalWidth === 0) fail();
  });
}
function unavailable(title, message, link = 'movies.html', label = 'Explore films') {
  return `<section class="empty-state"><span class="empty-orbit" aria-hidden="true">${escapeHTML(initials(title))}</span><p class="eyebrow">CINEMIND / NOTICE</p><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p><a class="button button-outline" href="${escapeHTML(link)}">${escapeHTML(label)} <span aria-hidden="true">→</span></a></section>`;
}
function getMovieList() { const stored = readStore(STORE.movies, null); return Array.isArray(stored) ? stored : movies; }

function initHeader() {
  const host = $('[data-site-header]'); if (!host) return;
  const current = location.pathname.split('/').pop() || 'index.html';
  const links = [['index.html', 'Home'], ['movies.html', 'Movies'], ['series.html', 'Series'], ['character-lab.html', 'Character Lab'], ['index.html#recommendation', 'Recommendation'], ['index.html#from-page-to-screen', 'Books'], ['about.html', 'About']];
  host.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><div class="site-header"><div class="container nav-wrap"><a class="brand" href="index.html" aria-label="CineMind home"><span class="brand-mark">CM</span><span>CineMind</span></a><nav class="nav-links" id="main-navigation" aria-label="Main navigation">${links.map(([url, label]) => `<a href="${url}" ${!url.includes('#') && current === url ? 'aria-current="page"' : ''}>${label}</a>`).join('')}<a href="contact.html" ${current === 'contact.html' ? 'aria-current="page"' : ''}>Contact</a></nav><div class="nav-tools"><button class="theme-toggle" type="button" aria-label="Switch to light theme" title="Toggle theme"><span aria-hidden="true">☼</span></button><button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-navigation"><span aria-hidden="true">☰</span></button></div></div></div>`;
  const theme = readStore(STORE.theme, 'dark') === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme;
  const toggle = $('.theme-toggle', host); updateThemeLabel(toggle, theme);
  toggle.addEventListener('click', () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; writeStore(STORE.theme, next); updateThemeLabel(toggle, next); });
  const menu = $('.menu-toggle', host), nav = $('#main-navigation', host);
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); nav.classList.toggle('is-open', open); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); menu.focus(); } });
}
function updateThemeLabel(button, theme) { button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); button.innerHTML = `<span aria-hidden="true">${theme === 'dark' ? '☼' : '☾'}</span>`; }
function initFooter() {
  const host = $('[data-site-footer]'); if (!host) return;
  host.className = 'site-footer';
  host.innerHTML = `<div class="container"><div class="footer-top"><div class="footer-brand"><a class="brand" href="index.html"><span class="brand-mark">CM</span><span>CineMind</span></a><p>Film is a mirror, a map, and sometimes a telescope. Let's look a little closer.</p></div><nav class="footer-links" aria-label="Footer navigation"><a href="movies.html">Film archive</a><a href="series.html">Series files</a><a href="index.html#from-page-to-screen">From Page to Screen</a><a href="character-lab.html">Character Lab</a><a href="about.html">About Sahil</a><a href="contact.html">Contact</a></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} CineMind · An independent film journal</span><a href="admin.html">Studio access</a></div></div>`;
}
function movieCard(movie) {
  const saved = readStore(STORE.bookmarks, []).includes(movie.id);
  return `<article class="movie-card"><a class="movie-poster-link" href="review.html?id=${encodeURIComponent(movie.id)}" aria-label="Read analysis of ${escapeHTML(movie.title)}">${imageMarkup(movie.poster, movie.title, 'film', { className: 'poster-frame' })}<span class="rating-pill"><span aria-hidden="true">★</span>${Number(movie.rating).toFixed(1)}</span><span class="poster-cta">Read analysis <span aria-hidden="true">↗</span></span></a><div class="card-content"><div class="card-topline"><span>${escapeHTML(movie.year)} · ${escapeHTML(movie.director)}</span><span>${Number(movie.rating).toFixed(1)} / 10</span></div><h3><a href="review.html?id=${encodeURIComponent(movie.id)}">${escapeHTML(movie.title)}</a></h3><p>${escapeHTML(movie.summary)}</p><div class="card-bottom"><div class="genre-tags">${(movie.genre || []).slice(0, 3).map(genre => `<span class="tag">${escapeHTML(genre)}</span>`).join('')}</div><button class="card-action bookmark-button" type="button" data-movie="${escapeHTML(movie.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${escapeHTML(movie.title)} ${saved ? 'from' : 'to'} reading list">${saved ? 'Saved' : '＋ Save'}</button></div></div></article>`;
}
function bindBookmarks(root = document) {
  $$('.bookmark-button', root).forEach(button => { if (button.dataset.bound) return; button.dataset.bound = 'true'; button.addEventListener('click', () => {
    const list = readStore(STORE.bookmarks, []), id = button.dataset.movie, on = list.includes(id), next = on ? list.filter(item => item !== id) : [...list, id];
    writeStore(STORE.bookmarks, next); button.setAttribute('aria-pressed', String(!on)); button.textContent = !on ? 'Saved' : '＋ Save';
    const title = getMovieList().find(movie => movie.id === id)?.title || id; button.setAttribute('aria-label', `${on ? 'Save' : 'Remove'} ${title} ${on ? 'to' : 'from'} reading list`); toast(on ? 'Removed from your reading list' : 'Added to your reading list');
  }); });
}

function setupHome() {
  const list = getMovieList();
  const featured = $('#featured-movie');
  if (featured) {
    const movie = list.find(item => item.id === 'dune-part-two');
    featured.innerHTML = movie ? `<div class="featured-art">${imageMarkup(movie.poster, movie.title, 'film', { className: 'featured-poster', alt: `${movie.title} official poster`, width: 780, height: 1170 })}</div><div class="featured-copy"><p class="eyebrow">EDITOR'S PICK / FEATURED FILM</p><h2>${escapeHTML(movie.title)}</h2><div class="featured-meta"><span>${movie.year}</span><span>★ ${Number(movie.rating).toFixed(1)}</span><span>${escapeHTML(movie.director)}</span></div><div class="genre-tags">${movie.genre.map(genre => `<span class="tag">${escapeHTML(genre)}</span>`).join('')}</div><p>${escapeHTML(movie.summary)}</p><p class="featured-focus"><strong>Character focus</strong><br>${escapeHTML(movie.characterFocus)}</p><a class="button button-primary" href="review.html?id=${encodeURIComponent(movie.id)}">Read analysis <span aria-hidden="true">↗</span></a></div>` : unavailable('Featured film unavailable', 'Dune: Part Two is not in the current catalog.');
    bindImages(featured);
  }
  const trending = $('#trending-grid');
  if (trending) { trending.innerHTML = list.length ? [...list].sort((a, b) => b.rating - a.rating).map(movieCard).join('') : unavailable('Films are taking a pause', 'The catalog could not be loaded. Please refresh or visit again soon.'); bindImages(trending); bindBookmarks(trending); }
  $$('[data-carousel]').forEach(button => button.addEventListener('click', () => { const card = $('.movie-card', trending); if (card) trending.scrollBy({ left: (card.getBoundingClientRect().width + 24) * (button.dataset.carousel === 'forward' ? 1 : -1), behavior: 'smooth' }); }));
  setupRecommendation(); setupBooks();
  const newsletter = $('[data-newsletter]');
  newsletter?.addEventListener('submit', event => { event.preventDefault(); const field = $('#newsletter-email'); const email = field.value.trim(); if (!field.checkValidity()) { field.reportValidity(); return; } const list = readStore(STORE.newsletter, []); if (!list.includes(email)) writeStore(STORE.newsletter, [...list, email]); newsletter.reset(); toast('You’re on the list. See you in the next dispatch.'); });
}

function setupArchive() {
  const grid = $('#movie-grid'); if (!grid) return;
  const chips = $('#genre-chips'); const genres = [...new Set(getMovieList().flatMap(movie => movie.genre || []))].sort();
  if (chips) { chips.innerHTML = ['all', ...genres].map((genre, index) => `<button type="button" class="genre-chip ${index === 0 ? 'is-active' : ''}" data-genre="${escapeHTML(genre)}" aria-pressed="${index === 0}">${genre === 'all' ? 'All films' : escapeHTML(genre)}</button>`).join(''); chips.addEventListener('click', event => { const button = event.target.closest('[data-genre]'); if (!button) return; $$('[data-genre]', chips).forEach(chip => { const active = chip === button; chip.classList.toggle('is-active', active); chip.setAttribute('aria-pressed', String(active)); }); renderMovies(); }); }
  $('#movie-search')?.addEventListener('input', renderMovies); $('#sort-filter')?.addEventListener('change', renderMovies); renderMovies();
}
function renderMovies() {
  const grid = $('#movie-grid'); if (!grid) return;
  const search = ($('#movie-search')?.value || '').trim().toLowerCase(), genre = $('.genre-chip.is-active')?.dataset.genre || 'all', sort = $('#sort-filter')?.value || 'featured';
  let list = getMovieList().filter(movie => `${movie.title} ${movie.director} ${movie.summary} ${(movie.genre || []).join(' ')}`.toLowerCase().includes(search) && (genre === 'all' || (movie.genre || []).includes(genre)));
  if (sort === 'rating') list.sort((a, b) => b.rating - a.rating); if (sort === 'year') list.sort((a, b) => b.year - a.year);
  grid.innerHTML = list.length ? list.map(movieCard).join('') : unavailable('No films found', 'Try another title or genre to continue exploring.');
  const count = $('#archive-count'); if (count) count.textContent = `${list.length} ${list.length === 1 ? 'film' : 'films'} in the archive`;
  bindImages(grid); bindBookmarks(grid);
}

const MOOD_MATCHES = {
  'Mind-blown': ['arrival', 'inception', 'tenet', 'dark'], 'Motivated': ['edge-of-tomorrow', 'the-matrix', 'dune-part-one', 'kgf-chapter-one'],
  'Emotional': ['interstellar', 'the-adam-project', 'arrival'], 'Strategic': ['dune-part-two', 'casino-royale', 'the-dark-knight', 'oppenheimer'],
  'Adventurous': ['dune-part-one', 'interstellar', 'the-adam-project', 'edge-of-tomorrow'], 'Curious about AI': ['atlas', 'the-matrix', 'arrival'],
  'Want something intense': ['the-dark-knight', 'tenet', 'oppenheimer', 'kgf-chapter-two']
};
const STYLE_MATCHES = { 'Character-driven': ['interstellar', 'arrival', 'the-dark-knight', 'dune-part-two'], 'Mind-bending': ['tenet', 'inception', 'arrival'], 'Action-heavy': ['edge-of-tomorrow', 'the-matrix', 'mission-impossible-dead-reckoning', 'kgf-chapter-two'], 'Science-focused': ['interstellar', 'oppenheimer', 'arrival'], 'Strategy-focused': ['dune-part-two', 'casino-royale', 'the-dark-knight', 'sherlock-holmes'] };
function setupRecommendation() {
  const form = $('#recommendation-form'); if (!form) return;
  const render = event => {
    event?.preventDefault(); const data = new FormData(form), wantedGenre = data.get('genre'), mood = data.get('mood'), style = data.get('style'); const catalog = getMovieList();
    if (!catalog.length) { $('#recommendation-result').innerHTML = unavailable('No recommendation yet', 'The movie catalog could not be loaded.'); return; }
    const ranked = catalog.map(movie => { let score = 0; const reasons = []; if (wantedGenre && movie.genre.includes(wantedGenre)) { score += 3; reasons.push(`matches ${wantedGenre} (+3)`); } if ((MOOD_MATCHES[mood] || []).includes(movie.id)) { score += 3; reasons.push(`fits a ${mood.toLowerCase()} mood (+3)`); } if ((STYLE_MATCHES[style] || []).includes(movie.id)) { score += 2; reasons.push(`suits ${style.toLowerCase()} viewing (+2)`); } return { movie, score, reasons }; }).sort((a, b) => b.score - a.score || b.movie.rating - a.movie.rating);
    const best = ranked[0]; if (!best) { $('#recommendation-result').innerHTML = unavailable('No match this time', 'Try a different mood, genre, or viewing style.'); return; }
    const why = best.reasons.length ? best.reasons.join(' · ') : 'a strong editorial match for your choices';
    $('#recommendation-result').innerHTML = `<article class="recommendation-card">${imageMarkup(best.movie.poster, best.movie.title, 'film', { className: 'recommendation-poster', alt: `${best.movie.title} poster` })}<div class="recommendation-copy"><p class="eyebrow">YOUR CINEMIND PICK · MATCH SCORE ${best.score}</p><h3>${escapeHTML(best.movie.title)}</h3><p class="recommendation-meta">★ ${Number(best.movie.rating).toFixed(1)} · ${best.movie.year} · ${escapeHTML(best.movie.genre.join(' / '))}</p><p>${escapeHTML(best.movie.summary)}</p><p class="match-reason"><strong>Why it matches</strong><br>${escapeHTML(why)}. Rule-based scoring: genre +3, mood +3, viewing style +2; rating breaks ties.</p><a class="button button-primary" href="review.html?id=${encodeURIComponent(best.movie.id)}">Read analysis <span aria-hidden="true">↗</span></a></div></article>`;
    bindImages($('#recommendation-result')); if (event) $('#recommendation-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  form.addEventListener('submit', render); render();
}

function setupBooks() {
  const grid = $('#books-grid'); if (!grid) return;
  grid.innerHTML = books.length ? books.map(book => `<article class="book-card">${imageMarkup(book.cover, book.title, 'book', { className: 'book-cover', alt: `Cover placeholder for ${book.title}`, width: 480, height: 720 })}<div class="book-copy"><p class="eyebrow">${escapeHTML(book.relationship)}</p><h3>${escapeHTML(book.title)}</h3><p class="book-author">${escapeHTML(book.author)} · ${book.year}</p><p>${escapeHTML(book.description)}</p><p class="match-reason"><strong>Why read it</strong><br>${escapeHTML(book.whyRead)}</p><div class="book-actions">${book.movieId && getMovieList().some(item => item.id === book.movieId) ? `<a class="text-link" href="review.html?id=${encodeURIComponent(book.movieId)}">Explore ${escapeHTML(book.movie)} <span>→</span></a>` : `<span class="text-link">Screen version: ${escapeHTML(book.movie)}</span>`}<small>${escapeHTML(book.readingGuide)}</small></div></div></article>`).join('') : unavailable('Bookshelf unavailable', 'Book recommendations could not be loaded.');
  bindImages(grid);
}

function renderReview() {
  const root = $('#review-content'); if (!root) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { root.innerHTML = unavailable('Choose a film to explore', 'Open an analysis from the film archive to read its full story.', 'movies.html', 'Browse movies'); return; }
  const movie = getMovieList().find(item => item.id === id);
  if (!movie) { root.innerHTML = unavailable('Film not found', 'That title is not in the CineMind archive. Try a different film.', 'movies.html', 'Return to the archive'); return; }
  document.title = `${movie.title} | CineMind Movie Analysis`;
  const liked = readStore(STORE.likes, []).includes(movie.id);
  const related = (movie.relatedMovies || []).map(relatedId => getMovieList().find(item => item.id === relatedId)).filter(Boolean).slice(0, 4);
  root.innerHTML = `<section class="review-hero"><div class="review-backdrop">${imageMarkup(movie.poster, movie.title, 'film', { className: 'review-backdrop-image', alt: '' })}<div class="review-backdrop-shade"></div></div><div class="review-title"><p class="eyebrow">CINEMIND / FILM INTELLIGENCE</p><h1>${escapeHTML(movie.title)}</h1><div class="review-meta"><span>${movie.year}</span><span>${escapeHTML(movie.genre.join(' · '))}</span><span>★ ${Number(movie.rating).toFixed(1)} / 10</span><span>${escapeHTML(movie.director)}</span></div></div></section><div class="review-layout"><article class="prose review-prose"><p class="lead review-summary">${escapeHTML(movie.summary)}</p><section class="analysis-section"><p class="eyebrow">01 / STORY</p><h2>The story underneath</h2><p>${escapeHTML(movie.story || movie.summary)}</p></section><section class="analysis-section"><p class="eyebrow">02 / CHARACTER</p><h2>Character development</h2><p>${escapeHTML(movie.development || `${movie.characterFocus} is the lens through which the film explores change, identity, and choice.`)}</p><div class="insight-card"><strong>Character focus</strong><span>${escapeHTML(movie.characterFocus)}</span></div></section><section class="analysis-section"><p class="eyebrow">03 / DECISIONS</p><h2>Strategy breakdown</h2><p>${escapeHTML(movie.strategy || 'The film rewards patience, information-sharing, and adapting a plan as new facts emerge.')}</p>${movie.strategyNote ? `<div class="insight-card"><strong>Strategic read</strong><span>${escapeHTML(movie.strategyNote)}</span></div>` : ''}</section><section class="analysis-section"><p class="eyebrow">04 / INNER LIFE</p><h2>Psychology angle</h2><p>${escapeHTML(movie.psychology || 'The character is shaped by the tension between fear, belonging, and the desire to control an uncertain future.')}</p><small class="editorial-note">An editorial interpretation of a fictional character, not a clinical assessment.</small></section><section class="analysis-section"><p class="eyebrow">05 / TAKEAWAY</p><h2>Life lesson</h2><div class="lesson-box"><p class="eyebrow">A THOUGHT TO TAKE WITH YOU</p>${escapeHTML(movie.lifeLesson)}</div></section><section class="analysis-section"><p class="eyebrow">06 / THE LINE THAT LINGERS</p><h2>Favorite quote</h2><blockquote class="series-quote">${escapeHTML(movie.favoriteQuote || 'A line that captures the film’s central tension.')}</blockquote></section><section class="comments"><p class="eyebrow">THE CONVERSATION</p><h2>What stayed with you?</h2><form class="comment-form" id="comment-form"><label class="sr-only" for="comment-name">Your name</label><input id="comment-name" name="name" placeholder="Your name" maxlength="40" required><label class="sr-only" for="comment-text">Your comment</label><textarea id="comment-text" name="comment" rows="3" maxlength="500" placeholder="Add a thoughtful note…" required></textarea><button class="button button-primary" type="submit">Post comment</button></form><div id="comment-list" class="comment-list" aria-live="polite"></div></section><section class="section-related"><p class="eyebrow">KEEP EXPLORING</p><h2>Related films</h2><div class="related-grid">${related.length ? related.map(movieCard).join('') : '<p class="body-copy">More connections are coming soon.</p>'}</div></section></article><aside class="review-aside"><div class="review-poster">${imageMarkup(movie.poster, movie.title, 'film', { className: 'review-poster-image', alt: `${movie.title} film poster`, width: 780, height: 1170 })}</div><p class="eyebrow">A CLOSER LOOK</p><div class="review-actions"><button class="button button-outline like-button" type="button" aria-pressed="${liked}">${liked ? '♥ Liked' : '♡ Like'}</button><button class="button button-outline bookmark-button" type="button" data-movie="${escapeHTML(movie.id)}" aria-pressed="${readStore(STORE.bookmarks, []).includes(movie.id)}">Save</button></div><div class="review-facts"><p><strong>Character focus</strong><span>${escapeHTML(movie.characterFocus)}</span></p><p><strong>Directed by</strong><span>${escapeHTML(movie.director)}</span></p><p><strong>Reading time</strong><span>${movie.readingTime || 8} minutes</span></p></div></aside></div>`;
  bindImages(root); bindBookmarks(root);
  const like = $('.like-button', root); like.addEventListener('click', () => { const ids = readStore(STORE.likes, []), on = ids.includes(movie.id), next = on ? ids.filter(item => item !== movie.id) : [...ids, movie.id]; writeStore(STORE.likes, next); like.setAttribute('aria-pressed', String(!on)); like.textContent = on ? '♡ Like' : '♥ Liked'; toast(on ? 'Like removed' : 'Added to your likes'); });
  const key = `${STORE.comments}.${movie.id}`;
  const drawComments = () => { const comments = readStore(key, []); $('#comment-list', root).innerHTML = comments.length ? comments.slice().reverse().map(comment => `<article class="comment-item"><strong>${escapeHTML(comment.name)}</strong><time>${escapeHTML(new Date(comment.date).toLocaleDateString())}</time><p>${escapeHTML(comment.text)}</p></article>`).join('') : '<p class="body-copy">Be the first to share a thought.</p>'; };
  drawComments(); $('#comment-form', root).addEventListener('submit', event => { event.preventDefault(); const name = $('#comment-name', root).value.trim(), text = $('#comment-text', root).value.trim(); if (!name || !text) { toast('Add your name and comment before posting.', 'error'); return; } const comments = readStore(key, []); comments.push({ name, text, date: new Date().toISOString() }); writeStore(key, comments); event.currentTarget.reset(); drawComments(); toast('Your comment has been added'); });
}

function setupSeries() {
  const grid = $('#series-grid'); if (!grid) return;
  if (!series.length) { grid.innerHTML = unavailable('Series files unavailable', 'The series catalog could not be loaded. Refresh the page or try again later.', 'index.html', 'Return home'); return; }
  grid.innerHTML = series.map((show, index) => `<article class="series-card"><div class="series-art">${imageMarkup(show.poster, show.title, 'series', { className: 'series-poster', alt: `${show.title} series artwork`, width: 780, height: 1170 })}<span class="rating-pill"><span aria-hidden="true">★</span>${Number(show.rating).toFixed(1)}</span></div><div class="series-copy"><p class="eyebrow">SERIES FILE / ${String(index + 1).padStart(2, '0')} · ${show.seasons} SEASONS</p><h2>${escapeHTML(show.title)}</h2><p class="series-meta">${escapeHTML(show.creator)} · ${show.year}</p><p>${escapeHTML(show.summary)}</p><h3>Character development</h3><p>${escapeHTML(show.development)}</p><h3>Strategy breakdown</h3><p>${escapeHTML(show.strategy)}</p><h3>Psychology angle</h3><p>${escapeHTML(show.psychology)}</p><div class="lesson-box"><p class="eyebrow">LIFE LESSON</p>${escapeHTML(show.lifeLesson)}</div><blockquote class="series-quote">${escapeHTML(show.favoriteQuote)}</blockquote><p class="eyebrow">RELATED FILMS</p><div class="genre-tags">${(show.relatedMovies || []).map(id => getMovieList().find(movie => movie.id === id)).filter(Boolean).map(movie => `<a class="tag" href="review.html?id=${encodeURIComponent(movie.id)}">${escapeHTML(movie.title)}</a>`).join('')}</div></div></article>`).join(''); bindImages(grid);
}
function setupCharacters() {
  const grid = $('#character-grid'); if (!grid) return;
  const catalog = getMovieList();
  const profiles = [
    ['Paul Atreides', 'dune-part-two'], ['James Bond', 'casino-royale'], ['Neo', 'the-matrix'], ['Cooper', 'interstellar'], ['Ethan Hunt', 'mission-impossible-dead-reckoning'], ['Sherlock Holmes', 'sherlock-holmes'], ['Rocky', 'kgf-chapter-one']
  ].map(([name, id]) => ({ name, movie: catalog.find(item => item.id === id) })).filter(profile => profile.movie);
  if (!profiles.length) { grid.innerHTML = unavailable('Character files unavailable', 'Movie profiles could not be loaded.', 'movies.html', 'Browse films'); return; }
  grid.innerHTML = profiles.map((profile, index) => { const movie = profile.movie; return `<article class="character-card" data-number="${String(index + 1).padStart(2, '0')}"><div class="character-art">${imageMarkup(movie.characterImage || movie.poster, profile.name, 'character', { className: 'character-placeholder', alt: `${profile.name} character study artwork from ${movie.title}`, width: 600, height: 760 })}</div><div class="character-detail"><p class="eyebrow">EDITORIAL PROFILE / ${String(index + 1).padStart(2, '0')}</p><h2>${escapeHTML(profile.name)}</h2><p class="source">${escapeHTML(movie.title)} · ${movie.year}</p><p class="editorial-note">An interpretation of a fictional character, not an objective psychological measurement.</p><h3>Strengths</h3><div class="trait-list">${(movie.strengths || []).map(item => `<span class="trait trait-positive">${escapeHTML(item)}</span>`).join('')}</div><h3>Weaknesses</h3><div class="trait-list">${(movie.weaknesses || []).map(item => `<span class="trait">${escapeHTML(item)}</span>`).join('')}</div><h3>Strategy</h3><p>${escapeHTML(movie.strategy)}</p><h3>Psychology</h3><p>${escapeHTML(movie.psychology)}</p><div class="lesson-box"><p class="eyebrow">REAL-LIFE LESSON</p>${escapeHTML(movie.lifeLesson)}</div><a class="text-link" href="review.html?id=${encodeURIComponent(movie.id)}">Explore the film <span>→</span></a></div></article>`; }).join(''); bindImages(grid);
}

function setupContact() {
  const form = $('#contact-form'), modal = $('#success-modal'); if (!form || !modal) return;
  form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity()) return; modal.hidden = false; $('.modal-close', modal).focus(); });
  const close = () => { modal.hidden = true; form.reset(); };
  $('.modal-close', modal).addEventListener('click', close); $('.modal-done', modal).addEventListener('click', close); modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });
}

function setupAdmin() {
  const form = $('#movie-form'); if (!form) return;
  const list = $('#admin-movies'), cancel = $('#cancel-edit');
  const fields = { id: $('#movie-id'), title: $('#movie-title'), genre: $('#movie-genre'), rating: $('#movie-rating'), year: $('#movie-year'), director: $('#movie-director'), poster: $('#movie-poster'), summary: $('#movie-summary'), characterFocus: $('#movie-character'), lifeLesson: $('#movie-lesson'), story: $('#movie-story'), development: $('#movie-development'), strategy: $('#movie-strategy'), psychology: $('#movie-psychology'), favoriteQuote: $('#movie-quote'), relatedMovies: $('#movie-related') };
  function draw() { const all = getMovieList(); $('#admin-count').textContent = `${all.length} FILMS`; list.innerHTML = all.map(movie => `<article class="admin-row"><div class="admin-thumb">${imageMarkup(movie.poster, movie.title, 'film', { className: 'admin-poster', alt: '', width: 124, height: 156 })}</div><div><h3>${escapeHTML(movie.title)}</h3><p>${movie.year} · ${Number(movie.rating).toFixed(1)} · ${escapeHTML(movie.director)}</p></div><div class="admin-actions"><button type="button" data-edit="${escapeHTML(movie.id)}">Edit</button><button type="button" class="delete-button" data-delete="${escapeHTML(movie.id)}">Delete</button></div></article>`).join('') || '<div class="empty-state"><h2>Your archive is empty</h2><p>Add the first film with the form.</p></div>'; bindImages(list); $$('[data-edit]', list).forEach(button => button.onclick = () => edit(button.dataset.edit)); $$('[data-delete]', list).forEach(button => button.onclick = () => remove(button.dataset.delete)); }
  function edit(id) { const movie = getMovieList().find(item => item.id === id); if (!movie) return; for (const [key, input] of Object.entries(fields)) input.value = key === 'genre' ? movie.genre.join(', ') : key === 'relatedMovies' ? (movie.relatedMovies || []).join(', ') : movie[key] ?? ''; $('#form-title').textContent = `Edit ${movie.title}`; cancel.hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); fields.title.focus(); }
  function remove(id) { const movie = getMovieList().find(item => item.id === id); if (!movie || !confirm(`Delete “${movie.title}” from this browser's archive?`)) return; const next = getMovieList().filter(item => item.id !== id); if (writeStore(STORE.movies, next)) { draw(); toast(`${movie.title} removed`); } else toast('Could not save this change in browser storage.', 'error'); }
  cancel.onclick = () => { form.reset(); fields.id.value = ''; $('#form-title').textContent = 'Add a film'; cancel.hidden = true; };
  form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity()) return; const all = getMovieList(), title = fields.title.value.trim(); if (!title) { toast('A film title is required.', 'error'); fields.title.focus(); return; } const id = fields.id.value || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); const existing = all.find(movie => movie.id === id); if (!fields.id.value && existing) { toast('A film with that title already exists. Choose a distinct title.', 'error'); fields.title.focus(); return; } const movie = { ...(existing || {}), id, title, genre: fields.genre.value.split(',').map(item => item.trim()).filter(Boolean), rating: Number(fields.rating.value), year: Number(fields.year.value), director: fields.director.value.trim(), poster: fields.poster.value.trim(), summary: fields.summary.value.trim(), characterFocus: fields.characterFocus.value.trim(), lifeLesson: fields.lifeLesson.value.trim(), story: fields.story.value.trim(), development: fields.development.value.trim(), strategy: fields.strategy.value.trim(), psychology: fields.psychology.value.trim(), favoriteQuote: fields.favoriteQuote.value.trim(), relatedMovies: fields.relatedMovies.value.split(',').map(item => item.trim()).filter(Boolean), readingTime: existing?.readingTime || 8 };
    if (writeStore(STORE.movies, existing ? all.map(item => item.id === id ? movie : item) : [movie, ...all])) { form.reset(); fields.id.value = ''; $('#form-title').textContent = 'Add a film'; cancel.hidden = true; draw(); toast(existing ? 'Film updated' : 'Film added to your local archive'); } else toast('Could not save the film. Check browser storage and try again.', 'error');
  }); draw();
}
function initProgress() { const bar = $('.reading-progress'); if (!bar) return; let scheduled = false; const update = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.width = `${max > 0 ? scrollY / max * 100 : 0}%`; scheduled = false; }; addEventListener('scroll', () => { if (!scheduled) { requestAnimationFrame(update); scheduled = true; } }, { passive: true }); update(); }
function initReveals() { const nodes = $$('.reveal'); if (!('IntersectionObserver' in window)) { nodes.forEach(node => node.classList.add('is-visible')); return; } const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .12 }); nodes.forEach(node => observer.observe(node)); }
async function loadCatalog(url, label) { const response = await fetch(url); if (!response.ok) throw new Error(`${label} could not be loaded (${response.status})`); const data = await response.json(); if (!Array.isArray(data)) throw new Error(`${label} data is not a list`); return data; }
async function boot() {
  initHeader(); initFooter(); initProgress(); initReveals();
  const results = await Promise.allSettled([loadCatalog(DATA_URLS.movies, 'Movie catalog'), loadCatalog(DATA_URLS.series, 'Series catalog'), loadCatalog(DATA_URLS.books, 'Book catalog')]);
  if (results[0].status === 'fulfilled') { movies = results[0].value; if (!Array.isArray(readStore(STORE.movies, null))) writeStore(STORE.movies, movies); } else { console.error(results[0].reason); movies = []; }
  if (results[1].status === 'fulfilled') series = results[1].value; else console.error(results[1].reason);
  if (results[2].status === 'fulfilled') books = results[2].value; else console.error(results[2].reason);
  if (!results.some(result => result.status === 'fulfilled')) toast('CineMind content could not be loaded. Run this site through a local web server and refresh.', 'error');
  setupHome(); setupArchive(); renderReview(); setupSeries(); setupCharacters(); setupContact(); setupAdmin();
}
document.addEventListener('DOMContentLoaded', boot);
