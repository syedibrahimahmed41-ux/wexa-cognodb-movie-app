/* =========================================================
   CineGraph Frontend
   Browser-only JavaScript
========================================================= */

(() => {
  'use strict';

  const API = '/api';

  const state = {
    users: [],
    currentUserId: null,
    dbOnline: null
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

    recommendationsBody:
      document.getElementById('recommendations-body'),

    discoverBody:
      document.getElementById('discover-body'),

    searchForm:
      document.getElementById('search-form'),

    searchInput:
      document.getElementById('search-input'),

    searchBody:
      document.getElementById('search-body'),

    graphCanvas:
      document.getElementById('graph-canvas'),

    degreesForm:
      document.getElementById('degrees-form'),

    degreesFrom:
      document.getElementById('degrees-from'),

    degreesTo:
      document.getElementById('degrees-to'),

    degreesBody:
      document.getElementById('degrees-body')
  };

  const GENRE_GRADIENTS = {
    'Sci-Fi': 'linear-gradient(135deg,#3a2f6b,#7a4fb0)',
    'Action': 'linear-gradient(135deg,#6b2f2f,#b85454)',
    'Crime': 'linear-gradient(135deg,#4a3b1f,#8c6a2f)',
    'Drama': 'linear-gradient(135deg,#2f3f4a,#4f7a8c)',
    'Mystery': 'linear-gradient(135deg,#332946,#5c4a80)',
    default: 'linear-gradient(135deg,#3a3128,#6b5a3f)'
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  async function api(url) {
    const response = await fetch(`${API}${url}`);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data.error || `Request failed (${response.status})`
      );

      error.status = response.status;

      throw error;
    }

    return data;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function stars(rating) {
    const number = Math.max(
      0,
      Math.min(5, Math.round(Number(rating) || 0))
    );

    return (
      '★★★★★'.slice(0, number) +
      '☆☆☆☆☆'.slice(0, 5 - number)
    );
  }

  function loadingBlock() {
    return `
      <div class="state-block">
        <div class="spinner"></div>
        Loading...
      </div>
    `;
  }

  function stateBlock(title, body, error = false) {
    return `
      <div class="state-block ${error ? 'is-error' : ''}">
        <strong>${escapeHtml(title)}</strong>
        <div>${escapeHtml(body)}</div>
      </div>
    `;
  }

  /* =========================================================
     DATABASE STATUS
  ========================================================= */

  async function checkHealth() {
    try {
      const data = await api('/health');

      setDbStatus(data.status === 'ok');
    } catch (error) {
      console.error('Health check failed:', error);

      setDbStatus(false);
    }
  }

  function setDbStatus(online) {
    if (!els.dbStatus) {
      return;
    }

    const wasOffline = state.dbOnline === false;

    state.dbOnline = online;

    els.dbStatus.classList.toggle('is-ok', online);
    els.dbStatus.classList.toggle('is-down', !online);

    const text =
      els.dbStatus.querySelector('.db-status-text');

    if (text) {
      text.textContent = online
        ? 'CognoDB connected'
        : 'CognoDB unreachable';
    }

    if (els.offlineBanner) {
      els.offlineBanner.classList.toggle(
        'hidden',
        online
      );
    }

    if (
      online &&
      wasOffline &&
      state.currentUserId
    ) {
      loadForUser(state.currentUserId);
    }
  }

  /* =========================================================
     USERS
  ========================================================= */

  function renderViewerTickets() {
    if (!els.viewerTickets) {
      return;
    }

    els.viewerTickets.innerHTML = '';

    state.users.forEach(user => {
      const button = document.createElement('button');

      button.type = 'button';

      button.className =
        'user-chip' +
        (
          user.id === state.currentUserId
            ? ' is-active'
            : ''
        );

      button.innerHTML = `
        <span class="user-chip-initials">
          ${escapeHtml(initials(user.name))}
        </span>

        <span class="user-chip-name">
          ${escapeHtml(
            String(user.name || '').split(' ')[0]
          )}
        </span>
      `;

      button.addEventListener('click', () => {
        selectUser(user.id);
      });

      els.viewerTickets.appendChild(button);
    });
  }

  function selectUser(userId) {
    state.currentUserId = userId;

    renderViewerTickets();

    loadForUser(userId);
  }

  /* =========================================================
     TABS
  ========================================================= */

  function setupTabs() {
    els.tabs.forEach(button => {
      button.addEventListener('click', () => {
        const target = button.dataset.tab;

        els.tabs.forEach(tab => {
          const active = tab === button;

          tab.classList.toggle(
            'is-active',
            active
          );

          tab.setAttribute(
            'aria-selected',
            active ? 'true' : 'false'
          );
        });

        els.panels.forEach(panel => {
          panel.classList.toggle(
            'is-active',
            panel.id === `panel-${target}`
          );
        });

        if (
          target === 'graph' &&
          state.currentUserId
        ) {
          renderGraph(state.currentUserId);
        }
      });
    });
  }

  /* =========================================================
     PROFILE
  ========================================================= */

  async function loadProfile(userId) {
    if (!els.profileBody) return;

    els.profileBody.innerHTML =
      loadingBlock();

    try {
      const user =
        await api(`/users/${encodeURIComponent(userId)}`);

      els.profileBody.innerHTML = `
        <div
          class="person-card"
          style="border:none;padding:0;box-shadow:none;"
        >
          <div class="person-avatar">
            ${escapeHtml(initials(user.name))}
          </div>

          <div>
            <h3>${escapeHtml(user.name)}</h3>

            <p>
              ${escapeHtml(user.email)}
            </p>

            <p
              class="sub"
              style="
                font-family:var(--font-mono);
                color:var(--text-faint);
                margin-top:4px;
              "
            >
              ${escapeHtml(user.id)}
            </p>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Profile error:', error);

      els.profileBody.innerHTML =
        stateBlock(
          "Can't load profile",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     FRIENDS
  ========================================================= */

  async function loadFriends(userId) {
    if (!els.friendsBody) return;

    els.friendsBody.innerHTML =
      loadingBlock();

    try {
      const friends =
        await api(
          `/users/${encodeURIComponent(userId)}/friends`
        );

      if (!Array.isArray(friends) || friends.length === 0) {
        els.friendsBody.innerHTML =
          stateBlock(
            'No friends yet',
            'This person has no connections in the network.'
          );

        return;
      }

      els.friendsBody.innerHTML =
        friends.map(friend => `
          <div class="list-row">
            <span class="name">
              ${escapeHtml(friend.name)}
            </span>

            <span class="sub">
              ${escapeHtml(friend.email)}
            </span>
          </div>
        `).join('');
    } catch (error) {
      console.error('Friends error:', error);

      els.friendsBody.innerHTML =
        stateBlock(
          "Can't load friends",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     RATINGS
  ========================================================= */

  async function loadRatings(userId) {
    if (!els.ratingsBody) return;

    els.ratingsBody.innerHTML =
      loadingBlock();

    try {
      const ratings =
        await api(
          `/users/${encodeURIComponent(userId)}/ratings`
        );

      if (!Array.isArray(ratings) || ratings.length === 0) {
        els.ratingsBody.innerHTML =
          stateBlock(
            'No ratings yet',
            "This person hasn't rated any movies."
          );

        return;
      }

      els.ratingsBody.innerHTML =
        ratings.map(rating => `
          <div class="list-row">

            <span class="name">
              ${escapeHtml(rating.title)}

              <span class="sub">
                (${escapeHtml(rating.year)})
              </span>
            </span>

            <span class="stars">
              ${stars(rating.rating)}
            </span>

          </div>
        `).join('');
    } catch (error) {
      console.error('Ratings error:', error);

      els.ratingsBody.innerHTML =
        stateBlock(
          "Can't load ratings",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     RECOMMENDATIONS
  ========================================================= */

  async function loadRecommendations(userId) {
    if (!els.recommendationsBody) return;

    els.recommendationsBody.innerHTML =
      loadingBlock();

    try {
      const recommendations =
        await api(
          `/recommendations/smart/${encodeURIComponent(userId)}`
        );

      if (
        !Array.isArray(recommendations) ||
        recommendations.length === 0
      ) {
        els.recommendationsBody.innerHTML =
          stateBlock(
            'Nothing new to recommend',
            'Once friends rate more movies you have not seen, they will appear here.'
          );

        return;
      }

      els.recommendationsBody.innerHTML =
        recommendations.map(movie => `
          <article class="rec-card">

            <div
              class="rec-card-poster"
              style="
                background:
                ${
                  GENRE_GRADIENTS[movie.genre] ||
                  GENRE_GRADIENTS.default
                };
              "
            >
              ${escapeHtml(initials(movie.title))}
            </div>

            <h3>
              ${escapeHtml(movie.title)}
            </h3>

            <div class="meta">
              ${escapeHtml(movie.year)}
              ·
              ${escapeHtml(movie.genre)}
            </div>

            <div class="stat-row">

              <span>
                ${escapeHtml(
                  `${movie.connections || 0} connection${
                    Number(movie.connections) === 1
                      ? ''
                      : 's'
                  }`
                )}

                ${
                  movie.sampleFriends &&
                  movie.sampleFriends.length
                    ? ` · via ${movie.sampleFriends
                        .map(name => escapeHtml(name))
                        .join(', ')}`
                    : ''
                }
              </span>

              <span class="stars">
                ${stars(movie.averageRating)}
              </span>

            </div>

          </article>
        `).join('');
    } catch (error) {
      console.error(
        'Recommendations error:',
        error
      );

      els.recommendationsBody.innerHTML =
        stateBlock(
          "Can't load recommendations",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     DISCOVER PEOPLE
  ========================================================= */

  async function loadDiscover(userId) {
    if (!els.discoverBody) return;

    els.discoverBody.innerHTML =
      loadingBlock();

    try {
      const people =
        await api(
          `/recommendations/friends/${encodeURIComponent(userId)}`
        );

      if (!Array.isArray(people) || people.length === 0) {
        els.discoverBody.innerHTML =
          stateBlock(
            'No new suggestions',
            'This person is already connected to everyone nearby in the network.'
          );

        return;
      }

      els.discoverBody.innerHTML =
        people.map(person => `
          <div class="person-card">

            <div class="person-avatar">
              ${escapeHtml(initials(person.name))}
            </div>

            <div>
              <h3>
                ${escapeHtml(person.name)}
              </h3>

              <p>
                ${escapeHtml(person.email)}
              </p>
            </div>

          </div>
        `).join('');
    } catch (error) {
      console.error('Discover error:', error);

      els.discoverBody.innerHTML =
        stateBlock(
          "Can't load suggestions",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     MOVIE SEARCH
  ========================================================= */

  let currentSearchQuery = '';
  let currentSearchPage = 1;

  async function runSearch(query, page = 1) {
    if (!els.searchBody) return;

    query = String(query || '').trim();

    if (!query) {
      els.searchBody.innerHTML = '';
      return;
    }

    currentSearchQuery = query;
    currentSearchPage = page;

    els.searchBody.innerHTML =
      loadingBlock();

    try {
      const data =
        await api(
          `/movies/search?q=${encodeURIComponent(query)}&page=${page}`
        );

      const movies =
        Array.isArray(data)
          ? data
          : (data.movies || []);

      if (movies.length === 0) {
        els.searchBody.innerHTML =
          stateBlock(
            'No matches',
            `Nothing in the catalog matches "${query}".`
          );

        return;
      }

      els.searchBody.innerHTML =
        movies.map(movie => `
          <article
            class="rec-card"
            data-movie-id="${escapeHtml(movie.id)}"
          >

            <div
              class="rec-card-poster"
              style="
                background:
                ${
                  GENRE_GRADIENTS[movie.genre] ||
                  GENRE_GRADIENTS.default
                };
              "
            >
              ${escapeHtml(initials(movie.title))}
            </div>

            <h3>
              ${escapeHtml(movie.title)}
            </h3>

            <div class="meta">
              ${escapeHtml(movie.year)}
              ·
              ${escapeHtml(movie.genre)}
            </div>

            <div class="movie-ratings">
              Click to view ratings
            </div>

          </article>
        `).join('');

      /* Pagination */

      if (!Array.isArray(data)) {
        const pagination =
          document.createElement('div');

        pagination.className =
          'movie-pagination';

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

        els.searchBody.appendChild(
          pagination
        );

        const previous =
          document.getElementById(
            'previous-page'
          );

        const next =
          document.getElementById(
            'next-page'
          );

        if (previous) {
          previous.addEventListener(
            'click',
            () => {
              if (page > 1) {
                runSearch(
                  currentSearchQuery,
                  page - 1
                );
              }
            }
          );
        }

        if (next) {
          next.addEventListener(
            'click',
            () => {
              if (data.hasNext) {
                runSearch(
                  currentSearchQuery,
                  page + 1
                );
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Search error:', error);

      els.searchBody.innerHTML =
        stateBlock(
          'Search failed',
          error.message,
          true
        );
    }
  }

  /* =========================================================
     SIX DEGREES
  ========================================================= */

  function populateDegreesSelects() {
    if (!els.degreesFrom || !els.degreesTo) {
      return;
    }

    const options =
      state.users.map(user => `
        <option value="${escapeHtml(user.id)}">
          ${escapeHtml(user.name)}
        </option>
      `).join('');

    els.degreesFrom.innerHTML = options;
    els.degreesTo.innerHTML = options;

    if (state.users.length > 1) {
      els.degreesTo.value =
        state.users[1].id;
    }
  }

  async function findPath(fromId, toId) {
    if (!els.degreesBody) return;

    els.degreesBody.innerHTML =
      loadingBlock();

    if (fromId === toId) {
      els.degreesBody.innerHTML =
        stateBlock(
          'Same person',
          'Pick two different people to trace a path.'
        );

      return;
    }

    try {
      const result =
        await api(
          `/path/${encodeURIComponent(fromId)}/${encodeURIComponent(toId)}`
        );

      if (!result.connected) {
        els.degreesBody.innerHTML =
          stateBlock(
            'No connection found',
            "These two people aren't linked through friendships."
          );

        return;
      }

      const people =
        Array.isArray(result.people)
          ? result.people
          : [];

      const chain =
        people.map((person, index) => `
          ${
            index > 0
              ? '<span class="path-arrow">→</span>'
              : ''
          }

          <span class="path-node">
            ${escapeHtml(person.name)}
          </span>
        `).join('');

      els.degreesBody.innerHTML = `
        <div class="path-chain">
          ${chain}
        </div>

        <p class="hop-count">
          ${escapeHtml(result.hops)}
          hop${Number(result.hops) === 1 ? '' : 's'}
          apart
        </p>
      `;
    } catch (error) {
      console.error('Path error:', error);

      els.degreesBody.innerHTML =
        stateBlock(
          "Can't compute path",
          error.message,
          true
        );
    }
  }

  /* =========================================================
     GRAPH
  ========================================================= */

  async function renderGraph(userId) {
    if (!els.graphCanvas) return;

    els.graphCanvas.innerHTML =
      loadingBlock();

    try {
      const data =
        await api(
          `/graph/${encodeURIComponent(userId)}`
        );

      if (
        typeof d3 === 'undefined'
      ) {
        els.graphCanvas.innerHTML =
          stateBlock(
            'Graph unavailable',
            'D3 could not be loaded.',
            true
          );

        return;
      }

      renderD3Graph(data);
    } catch (error) {
      console.error('Graph error:', error);

      els.graphCanvas.innerHTML =
        stateBlock(
          "Can't load graph",
          error.message,
          true
        );
    }
  }

  function renderD3Graph(data) {
    if (!els.graphCanvas) return;

    els.graphCanvas.innerHTML = '';

    const width =
      els.graphCanvas.clientWidth || 800;

    const height = 520;

    const nodes =
      Array.isArray(data.nodes)
        ? data.nodes.map(node => ({
            ...node
          }))
        : [];

    const links =
      Array.isArray(data.links)
        ? data.links.map(link => ({
            ...link
          }))
        : [];

    if (nodes.length === 0) {
      els.graphCanvas.innerHTML =
        stateBlock(
          'No graph data',
          'There are no graph connections to display.'
        );

      return;
    }

    const svg =
      d3.select(els.graphCanvas)
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr(
          'viewBox',
          `0 0 ${width} ${height}`
        );

    const simulation =
      d3.forceSimulation(nodes)
        .force(
          'link',
          d3.forceLink(links)
            .id(d => d.id)
            .distance(130)
        )
        .force(
          'charge',
          d3.forceManyBody()
            .strength(-350)
        )
        .force(
          'center',
          d3.forceCenter(
            width / 2,
            height / 2
          )
        );

    const link =
      svg.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr(
          'stroke',
          d => d.type === 'friend'
            ? '#d6a43a'
            : '#b94a48'
        )
        .attr(
          'stroke-width',
          d => d.rating
            ? Math.max(
                1,
                Number(d.rating)
              )
            : 2
        );

    const node =
      svg.append('g')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .call(
          d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended)
        );

    node.append('circle')
      .attr(
        'r',
        d => d.type === 'movie'
          ? 22
          : 18
      )
      .attr(
        'fill',
        d => d.type === 'movie'
          ? '#8c6a2f'
          : '#6b2f2f'
      );

    node.append('text')
      .text(
        d => String(
          d.name ||
          d.title ||
          d.id ||
          ''
        ).slice(0, 14)
      )
      .attr('x', 0)
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e8dfd3')
      .style('font-size', '11px');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr(
        'transform',
        d =>
          `translate(${d.x},${d.y})`
      );
    });

    function dragstarted(event, d) {
      if (!event.active) {
        simulation.alphaTarget(0.3).restart();
      }

      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) {
        simulation.alphaTarget(0);
      }

      d.fx = null;
      d.fy = null;
    }
  }

  /* =========================================================
     LOAD EVERYTHING FOR USER
  ========================================================= */

  function loadForUser(userId) {
    loadProfile(userId);
    loadFriends(userId);
    loadRatings(userId);
    loadRecommendations(userId);
    loadDiscover(userId);

    const graphPanel =
      document.getElementById(
        'panel-graph'
      );

    if (
      graphPanel &&
      graphPanel.classList.contains(
        'is-active'
      )
    ) {
      renderGraph(userId);
    }
  }

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  async function init() {
    console.log('CineGraph frontend starting...');

    setupTabs();

    if (els.searchForm) {
      els.searchForm.addEventListener(
        'submit',
        event => {
          event.preventDefault();

          runSearch(
            els.searchInput
              ? els.searchInput.value
              : ''
          );
        }
      );
    }

    if (els.degreesForm) {
      els.degreesForm.addEventListener(
        'submit',
        event => {
          event.preventDefault();

          findPath(
            els.degreesFrom.value,
            els.degreesTo.value
          );
        }
      );
    }

    /* Check database */

    await checkHealth();

    setInterval(
      checkHealth,
      15000
    );

    /* Load users */

    try {
      const users =
        await api('/users');

      state.users =
        Array.isArray(users)
          ? users
          : [];
    } catch (error) {
      console.error(
        'Could not load users:',
        error
      );

      state.users = [];
    }

    /* No users */

    if (state.users.length === 0) {
      if (els.viewerTickets) {
        els.viewerTickets.innerHTML =
          stateBlock(
            'No users found',
            state.dbOnline === false
              ? 'CognoDB is unreachable. Please try again.'
              : 'No users were returned by the API.',
            true
          );
      }

      return;
    }

    /* Users found */

    renderViewerTickets();

    populateDegreesSelects();

    selectUser(
      state.users[0].id
    );

    console.log(
      'CineGraph initialized successfully.'
    );
  }

  /* =========================================================
     START
  ========================================================= */

  init().catch(error => {
    console.error(
      'CineGraph initialization failed:',
      error
    );

    if (els.viewerTickets) {
      els.viewerTickets.innerHTML =
        stateBlock(
          'Application error',
          error.message,
          true
        );
    }
  });

})();
