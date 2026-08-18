/* CineGraph frontend — no build step, just fetch() + DOM + D3. */
(() => {
  'use strict';

  const API = '/api';

  const state = {
    users: [],
    currentUserId: null,
    dbOnline: null // null = unknown yet, true/false once we've checked
  };

  const els = {
    dbStatus: document.getElementById('db-status'),
    offlineBanner: document.getElementById('offline-banner'),
    viewerTickets: document.getElementById('viewer-tickets'),
    tabs: document.querySelectorAll('.tab-btn'),
    panels: document.querySelectorAll('.tab-panel'),
    profileBody: document.getElementById('profile-body'),
    friendsBody: document.getElementById('friends-body'),
    ratingsBody: document.getElementById('ratings-body'),
    recommendationsBody: document.getElementById('recommendations-body'),
    discoverBody: document.getElementById('discover-body'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    searchBody: document.getElementById('search-body'),
    graphCanvas: document.getElementById('graph-canvas'),
    degreesForm: document.getElementById('degrees-form'),
    degreesFrom: document.getElementById('degrees-from'),
    degreesTo: document.getElementById('degrees-to'),
    degreesBody: document.getElementById('degrees-body')
  };

  const GENRE_GRADIENTS = {
    'Sci-Fi': 'linear-gradient(135deg,#3a2f6b,#7a4fb0)',
    'Action': 'linear-gradient(135deg,#6b2f2f,#b85454)',
    'Crime': 'linear-gradient(135deg,#4a3b1f,#8c6a2f)',
    'Drama': 'linear-gradient(135deg,#2f3f4a,#4f7a8c)',
    'Mystery': 'linear-gradient(135deg,#332946,#5c4a80)',
    default: 'linear-gradient(135deg,#3a3128,#6b5a3f)'
  };

  // ---------- tiny fetch helper ----------
  async function api(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function initials(name) {
    return name
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function stars(rating) {
    const n = Math.round(rating);
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  function stateBlock({ title, body, isError = false }) {
    return `<div class="state-block ${isError ? 'is-error' : ''}"><strong>${escapeHtml(title)}</strong>${escapeHtml(body)}</div>`;
  }

  function loadingBlock() {
    return `<div class="state-block"><div class="spinner"></div>Loading…</div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ---------- health / connectivity ----------
  async function checkHealth() {
    try {
      const res = await fetch(`${API}/health`);
      const body = await res.json();
      setDbStatus(body.status === 'ok');
    } catch {
      setDbStatus(false);
    }
  }

  function setDbStatus(online) {
    const wasOffline = state.dbOnline === false;
    state.dbOnline = online;
    els.dbStatus.classList.toggle('is-ok', online);
    els.dbStatus.classList.toggle('is-down', !online);
    els.dbStatus.querySelector('.db-status-text').textContent = online
      ? 'CognoDB connected'
      : 'CognoDB unreachable';
    els.offlineBanner.classList.toggle('hidden', online);

    // If we just came back online after being down, refresh the current view.
    if (online && wasOffline && state.currentUserId) {
      loadForUser(state.currentUserId);
    }
  }

  // ---------- viewer switcher ----------
  function renderViewerTickets() {
    els.viewerTickets.innerHTML = '';
    state.users.forEach(user => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'user-chip' + (user.id === state.currentUserId ? ' is-active' : '');
      btn.innerHTML = `<span class="user-chip-initials">${escapeHtml(initials(user.name))}</span><span class="user-chip-name">${escapeHtml(user.name.split(' ')[0])}</span>`;
      btn.addEventListener('click', () => selectUser(user.id));
      els.viewerTickets.appendChild(btn);
    });
  }

  function selectUser(userId) {
    state.currentUserId = userId;
    renderViewerTickets();
    loadForUser(userId);
  }

  // ---------- tabs ----------
  function setupTabs() {
    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        els.tabs.forEach(b => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        els.panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
        if (target === 'graph' && state.currentUserId) renderGraph(state.currentUserId);
      });
    });
  }

  // ---------- overview ----------
  async function loadProfile(userId) {
    els.profileBody.innerHTML = loadingBlock();
    try {
      const user = await api(`/users/${userId}`);
      els.profileBody.innerHTML = `
        <div class="person-card" style="border:none;padding:0;box-shadow:none;">
          <div class="person-avatar">${escapeHtml(initials(user.name))}</div>
          <div>
            <h3>${escapeHtml(user.name)}</h3>
            <p>${escapeHtml(user.email)}</p>
            <p class="sub" style="font-family:var(--font-mono);color:var(--text-faint);margin-top:4px;">${escapeHtml(user.id)}</p>
          </div>
        </div>`;
    } catch (err) {
      els.profileBody.innerHTML = stateBlock({ title: "Can't load profile", body: err.message, isError: true });
    }
  }

  async function loadFriends(userId) {
    els.friendsBody.innerHTML = loadingBlock();
    try {
      const friends = await api(`/users/${userId}/friends`);
      if (friends.length === 0) {
        els.friendsBody.innerHTML = stateBlock({ title: 'No friends yet', body: 'This person has no connections in the network.' });
        return;
      }
      els.friendsBody.innerHTML = friends.map(f => `
        <div class="list-row">
          <span class="name">${escapeHtml(f.name)}</span>
          <span class="sub">${escapeHtml(f.email)}</span>
        </div>`).join('');
    } catch (err) {
      els.friendsBody.innerHTML = stateBlock({ title: "Can't load friends", body: err.message, isError: true });
    }
  }

  async function loadRatings(userId) {
    els.ratingsBody.innerHTML = loadingBlock();
    try {
      const ratings = await api(`/users/${userId}/ratings`);
      if (ratings.length === 0) {
        els.ratingsBody.innerHTML = stateBlock({ title: 'No ratings yet', body: 'This person hasn\u2019t rated any movies.' });
        return;
      }
      els.ratingsBody.innerHTML = ratings.map(r => `
        <div class="list-row">
          <span class="name">${escapeHtml(r.title)} <span class="sub">(${r.year})</span></span>
          <span class="stars">${stars(r.rating)}</span>
        </div>`).join('');
    } catch (err) {
      els.ratingsBody.innerHTML = stateBlock({ title: "Can't load ratings", body: err.message, isError: true });
    }
  }

  // ---------- recommendations ----------
  async function loadRecommendations(userId) {
    els.recommendationsBody.innerHTML = loadingBlock();
    try {
      const recs = await api(`/recommendations/smart/${userId}`);
      if (recs.length === 0) {
        els.recommendationsBody.innerHTML = stateBlock({
          title: 'Nothing new to recommend',
          body: 'Once friends up to two hops away rate more movies you haven\u2019t seen, they\u2019ll show up here.'
        });
        return;
      }
      els.recommendationsBody.innerHTML = recs.map(rec => `
        <article class="rec-card">
          <div class="rec-card-poster" style="background:${GENRE_GRADIENTS[rec.genre] || GENRE_GRADIENTS.default}">${escapeHtml(initials(rec.title))}</div>
          <h3>${escapeHtml(rec.title)}</h3>
          <div class="meta">${rec.year} · ${escapeHtml(rec.genre)}</div>
          <div class="stat-row">
            <span>${rec.connections} connection${rec.connections === 1 ? '' : 's'}${rec.sampleFriends && rec.sampleFriends.length ? ` · via ${rec.sampleFriends.map(escapeHtml).join(', ')}` : ''}</span>
            <span class="stars">${stars(rec.averageRating)}</span>
          </div>
        </article>`).join('');
    } catch (err) {
      els.recommendationsBody.innerHTML = stateBlock({ title: "Can't load recommendations", body: err.message, isError: true });
    }
  }

  // ---------- discover people ----------
  async function loadDiscover(userId) {
    els.discoverBody.innerHTML = loadingBlock();
    try {
      const people = await api(`/recommendations/friends/${userId}`);
      if (people.length === 0) {
        els.discoverBody.innerHTML = stateBlock({ title: 'No new suggestions', body: 'This person is already connected to everyone nearby in the network.' });
        return;
      }
      els.discoverBody.innerHTML = people.map(p => `
        <div class="person-card">
          <div class="person-avatar">${escapeHtml(initials(p.name))}</div>
          <div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.email)}</p></div>
        </div>`).join('');
    } catch (err) {
      els.discoverBody.innerHTML = stateBlock({ title: "Can't load suggestions", body: err.message, isError: true });
    }
  }

  // ---------- movie search ----------
 let currentSearchQuery = '';
let currentSearchPage = 1;

async function runSearch(query, page = 1) {
  if (!query) {
    els.searchBody.innerHTML = '';
    return;
  }

  currentSearchQuery = query;
  currentSearchPage = page;

  els.searchBody.innerHTML = loadingBlock();

  try {
    const data = await api(
      `/movies/search?q=${encodeURIComponent(query)}&page=${page}`
    );

    const movies = data.movies || [];

    if (movies.length === 0) {
      els.searchBody.innerHTML = stateBlock({
        title: 'No matches',
        body: `Nothing in the catalog matches "${query}".`
      });
      return;
    }

    els.searchBody.innerHTML = movies.map(m => `
      <article class="rec-card" data-movie-id="${escapeHtml(m.id)}">
        <div
          class="rec-card-poster"
          style="background:${GENRE_GRADIENTS[m.genre] || GENRE_GRADIENTS.default}"
        >
          ${escapeHtml(initials(m.title))}
        </div>

        <h3>${escapeHtml(m.title)}</h3>

        <div class="meta">
          ${m.year} · ${escapeHtml(m.genre)}
        </div>

        <div class="movie-ratings" data-loaded="false"></div>
      </article>
    `).join('');

    els.searchBody.querySelectorAll('.rec-card').forEach(card => {
      card.style.cursor = 'pointer';

      card.addEventListener('click', () => {
        toggleMovieRatings(card);
      });
    });

    // Pagination
    const pagination = document.createElement('div');
    pagination.className = 'movie-pagination';

    pagination.innerHTML = `
      <button
        class="btn btn-primary"
        id="previous-page"
        ${page <= 1 ? 'disabled' : ''}
      >
        ← Previous
      </button>

      <span class="movie-page-number">
        Page ${page}
      </span>

      <button
        class="btn btn-primary"
        id="next-page"
        ${!data.hasNext ? 'disabled' : ''}
      >
        Next →
      </button>
    `;

    els.searchBody.appendChild(pagination);

    document.getElementById('previous-page')
      .addEventListener('click', () => {
        if (page > 1) {
          runSearch(currentSearchQuery, page - 1);
        }
      });

    document.getElementById('next-page')
      .addEventListener('click', () => {
        if (data.hasNext) {
          runSearch(currentSearchQuery, page + 1);
        }
      });

  } catch (err) {
    els.searchBody.innerHTML = stateBlock({
      title: 'Search failed',
      body: err.message,
      isError: true
    });
  }
}
  // ---------- six degrees ----------
  function populateDegreesSelects() {
    const options = state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('');
    els.degreesFrom.innerHTML = options;
    els.degreesTo.innerHTML = options;
    if (state.users.length > 1) els.degreesTo.value = state.users[1].id;
  }

  async function findPath(fromId, toId) {
    els.degreesBody.innerHTML = loadingBlock();
    if (fromId === toId) {
      els.degreesBody.innerHTML = stateBlock({ title: 'Same person', body: 'Pick two different people to trace a path between them.' });
      return;
    }
    try {
      const result = await api(`/path/${fromId}/${toId}`);
      if (!result.connected) {
        els.degreesBody.innerHTML = stateBlock({ title: 'No connection found', body: 'These two people aren\u2019t linked through friendships in the network.' });
        return;
      }
      const chain = result.people.map((p, i) => `
        ${i > 0 ? '<span class="path-arrow">→</span>' : ''}
        <span class="path-node">${escapeHtml(p.name)}</span>
      `).join('');
      els.degreesBody.innerHTML = `<div class="path-chain">${chain}</div><p class="hop-count">${result.hops} hop${result.hops === 1 ? '' : 's'} apart</p>`;
    } catch (err) {
      els.degreesBody.innerHTML = stateBlock({ title: "Can't compute path", body: err.message, isError: true });
    }
  }

  // ---------- orchestration ----------
  function loadForUser(userId) {
    loadProfile(userId);
    loadFriends(userId);
    loadRatings(userId);
    loadRecommendations(userId);
    loadDiscover(userId);
    const graphPanel = document.getElementById('panel-graph');
    if (graphPanel.classList.contains('is-active')) renderGraph(userId);
  }

  async function init() {
    setupTabs();

    els.searchForm.addEventListener('submit', e => {
      e.preventDefault();
      runSearch(els.searchInput.value.trim());
    });

    els.degreesForm.addEventListener('submit', e => {
      e.preventDefault();
      findPath(els.degreesFrom.value, els.degreesTo.value);
    });

    await checkHealth();
    setInterval(checkHealth, 15000);

    try {
      state.users = await api('/users');
    } catch {
      state.users = [];
    }

    if (state.users.length === 0) {
      els.viewerTickets.innerHTML = stateBlock({
        title: 'No users found',
        body: state.dbOnline === false
          ? 'CognoDB is unreachable. Once it\u2019s back, refresh this page.'
          : 'Run the seed script (npm run seed) to populate the database, then refresh.'
      });
      return;
    }

    renderViewerTickets();
    populateDegreesSelects();
    selectUser(state.users[0].id);
  }

  init();
})();
