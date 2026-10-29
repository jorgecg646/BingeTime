const assert = require('node:assert/strict');
const Module = require('node:module');
const { afterEach, beforeEach, test } = require('node:test');

const database = { calls: [], error: null };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@neondatabase/serverless') {
    return {
      neon: () => async (strings, ...values) => {
        database.calls.push({ strings, values });
        if (database.error) throw database.error;
        return [];
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.DATABASE_URL = 'postgresql://test.invalid/database';
const { handler } = require('./shows');
Module._load = originalLoad;

const context = { clientContext: { user: { sub: 'test-user' } } };
const request = (httpMethod, body, origin, userId = 'test-user') => handler({
  httpMethod,
  headers: origin ? { origin } : {},
  body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body)
}, { clientContext: { user: { sub: userId } } });

const validWatchedItem = overrides => ({
  instanceId: '42_1234567890123_abcd',
  show: { id: 42, name: 'Example show' },
  seasonsWatched: 1,
  totalMinutes: 45,
  episodesWatched: 1,
  userRating: 0,
  addedAt: 1234567890123,
  ...overrides
});

beforeEach(() => {
  database.calls.length = 0;
  database.error = null;
});

afterEach(() => {
  database.error = null;
});

test('requires an authenticated Netlify user', async () => {
  const response = await handler({ httpMethod: 'GET', headers: {} }, {});
  assert.equal(response.statusCode, 401);
  assert.equal(database.calls.length, 0);
});

test('rejects malformed, oversized, and non-object JSON before SQL', async () => {
  const malformed = await request('POST', '{bad json');
  const oversized = await request('POST', ' '.repeat(256 * 1024 + 1));
  const nonObject = await request('POST', '[]');

  assert.deepEqual([malformed.statusCode, oversized.statusCode, nonObject.statusCode], [400, 400, 400]);
  assert.equal(database.calls.length, 0);
});

test('rejects invalid action, show ID, and watched counts before SQL', async () => {
  const invalidAction = await request('POST', { action: 'purge' });
  const invalidShow = await request('POST', {
    type: 'watched',
    item: validWatchedItem({ show: { id: '42', name: 'Example show' } })
  });
  const invalidCounts = await request('POST', {
    type: 'watched',
    item: validWatchedItem({ seasonsWatched: 0 })
  });

  assert.deepEqual([invalidAction.statusCode, invalidShow.statusCode, invalidCounts.statusCode], [400, 400, 400]);
  assert.equal(database.calls.length, 0);
});

test('clamps watched ratings and stores only whitelisted show metadata', async () => {
  const response = await request('POST', {
    type: 'watched',
    item: validWatchedItem({
      userRating: 15,
      show: {
        id: 42,
        name: 'Example show',
        poster_path: null,
        seasons: [{ season_number: 1, episode_count: 8, extra: 'discarded' }],
        cast: [{ id: 7, name: 'Example actor', character: 'Lead', profile_path: null, extra: true }],
        recommendations: [{ id: 99 }],
        unexpected: { nested: true }
      }
    })
  });

  assert.equal(response.statusCode, 200);
  const savedShow = JSON.parse(database.calls[0].values[3]);
  assert.equal(database.calls[0].values[7], 10);
  assert.equal(savedShow.poster_path, null);
  assert.equal(savedShow.seasons[0].extra, undefined);
  assert.equal(savedShow.cast[0].name, 'Example actor');
  assert.equal(savedShow.cast[0].extra, undefined);
  assert.equal(savedShow.recommendations, undefined);
  assert.equal(savedShow.unexpected, undefined);

  const lowerRating = await request('POST', {
    type: 'watched',
    item: validWatchedItem({ instanceId: '42_1234567890124_abcd', userRating: -3 })
  });
  assert.equal(lowerRating.statusCode, 200);
  assert.equal(database.calls[1].values[7], 0);
});

test('rejects preflights from unapproved origins and allows configured site origins', async () => {
  const allowed = await handler({
    httpMethod: 'OPTIONS',
    headers: { origin: 'https://bingetimes.netlify.app' }
  }, {});
  const denied = await handler({
    httpMethod: 'OPTIONS',
    headers: { origin: 'https://attacker.example' }
  }, {});

  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://bingetimes.netlify.app');
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.headers['Access-Control-Allow-Origin'], undefined);
});

test('does not expose database error details in HTTP responses', async () => {
  database.error = new Error('private SQL connection detail');
  const originalError = console.error;
  let serverLog = '';
  console.error = (...args) => { serverLog += args.join(' '); };

  try {
    const response = await request('GET', undefined, 'http://localhost:3000');
    assert.equal(response.statusCode, 500);
    assert.equal(JSON.parse(response.body).error, 'Internal Server Error');
    assert.equal(JSON.parse(response.body).error.includes('private SQL'), false);
    assert.match(serverLog, /private SQL connection detail/);
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
  } finally {
    console.error = originalError;
  }
});

test('throttles user bursts with 429 and allows requests again after the window', async () => {
  const originalNow = Date.now;
  let now = 1_800_000_000_000;
  Date.now = () => now;

  try {
    for (let index = 0; index < 300; index++) {
      const response = await request('POST', { action: 'invalid' }, undefined, 'burst-test-user');
      assert.equal(response.statusCode, 400);
    }

    const limited = await request('POST', { action: 'invalid' }, undefined, 'burst-test-user');
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['Retry-After'], '60');

    now += 60_000;
    const resumed = await request('POST', { action: 'invalid' }, undefined, 'burst-test-user');
    assert.equal(resumed.statusCode, 400);
  } finally {
    Date.now = originalNow;
  }
});
