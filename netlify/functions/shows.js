const { neon } = require('@neondatabase/serverless');

let sql;

// Lazy initialization to avoid crashes on cold start if env var is missing
const getDb = () => {
  if (sql) return sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable. Set it to your Neon connection string.');
  }

  sql = neon(databaseUrl);
  return sql;
};

const normalizeOrigin = value => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
};

const isAllowedOrigin = origin => {
  const allowedOrigins = [
    process.env.URL,
    'https://bingetimes.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ].map(normalizeOrigin).filter(Boolean);

  return allowedOrigins.includes(normalizeOrigin(origin));
};

const getCorsHeaders = origin => {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = normalizeOrigin(origin);
  }
  return headers;
};

// Helper function to return JSON responses with restricted CORS headers
const sendResponse = (statusCode, bodyObj, origin) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...getCorsHeaders(origin)
    },
    body: JSON.stringify(bodyObj)
  };
};

const MAX_REQUEST_BODY_BYTES = 256 * 1024;
const MAX_SHOW_ID = 2_147_483_647;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const rateLimitBuckets = new Map();
let lastRateLimitCleanup = 0;

const checkRateLimit = (userId, now = Date.now()) => {
  if (now - lastRateLimitCleanup >= RATE_LIMIT_WINDOW_MS) {
    for (const [id, timestamps] of rateLimitBuckets) {
      const activeRequests = timestamps.filter(timestamp => timestamp > now - RATE_LIMIT_WINDOW_MS);
      if (activeRequests.length === 0) {
        rateLimitBuckets.delete(id);
      } else {
        rateLimitBuckets.set(id, activeRequests);
      }
    }
    lastRateLimitCleanup = now;
  }

  const activeRequests = (rateLimitBuckets.get(userId) || [])
    .filter(timestamp => timestamp > now - RATE_LIMIT_WINDOW_MS);
  if (activeRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(userId, activeRequests);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(
        (activeRequests[0] + RATE_LIMIT_WINDOW_MS - now) / 1000
      ))
    };
  }

  activeRequests.push(now);
  rateLimitBuckets.set(userId, activeRequests);
  return { allowed: true };
};

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const isBoundedString = (value, maxLength) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= maxLength &&
  !/[\u0000-\u001f\u007f]/.test(value);

const isIntegerInRange = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

const readJsonBody = event => {
  const rawBody = typeof event.body === 'string' ? event.body : '';
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BODY_BYTES) {
    return { error: 'Request body is too large.' };
  }

  try {
    const body = JSON.parse(rawBody || '{}');
    return isRecord(body) ? { body } : { error: 'Request body must be a JSON object.' };
  } catch {
    return { error: 'Invalid JSON body.' };
  }
};

const sanitizeShow = show => {
  if (!isRecord(show) || !isIntegerInRange(show.id, 1, MAX_SHOW_ID) ||
      !isBoundedString(show.name, 300)) {
    return null;
  }

  const sanitized = { id: show.id, name: show.name.trim() };
  const addString = (key, maxLength) => {
    if (typeof show[key] === 'string' && show[key].length <= maxLength &&
        !/[\u0000-\u001f\u007f]/.test(show[key])) {
      sanitized[key] = show[key];
    } else if (show[key] === null && ['poster_path', 'backdrop_path'].includes(key)) {
      sanitized[key] = null;
    }
  };
  const addNumber = (key, min, max) => {
    if (typeof show[key] === 'number' && Number.isFinite(show[key]) &&
        show[key] >= min && show[key] <= max) {
      sanitized[key] = show[key];
    }
  };
  const sanitizeProviders = providers => {
    if (!Array.isArray(providers)) return [];
    return providers.slice(0, 20).flatMap(provider => {
      if (!isRecord(provider) || !isIntegerInRange(provider.provider_id, 0, MAX_SHOW_ID) ||
          !isBoundedString(provider.provider_name, 100)) {
        return [];
      }

      const cleanProvider = {
        provider_id: provider.provider_id,
        provider_name: provider.provider_name.trim()
      };
      if (typeof provider.logo_path === 'string' && provider.logo_path.length <= 2048) {
        cleanProvider.logo_path = provider.logo_path;
      }
      if (isIntegerInRange(provider.display_priority, 0, 10000)) {
        cleanProvider.display_priority = provider.display_priority;
      }
      return [cleanProvider];
    });
  };

  addString('original_name', 300);
  addString('localized_name', 300);
  addString('poster_path', 2048);
  addString('backdrop_path', 2048);
  addString('first_air_date', 20);
  addString('summary', 2000);
  addString('status', 100);
  addNumber('popularity', 0, 1_000_000_000);
  addNumber('rating', 0, 10);
  if (show.rating === null) sanitized.rating = null;
  addNumber('number_of_seasons', 0, 1000);

  if (typeof show.episode_run_time === 'number' &&
      Number.isFinite(show.episode_run_time) && show.episode_run_time >= 0 &&
      show.episode_run_time <= 1000) {
    sanitized.episode_run_time = show.episode_run_time;
  } else if (Array.isArray(show.episode_run_time)) {
    sanitized.episode_run_time = show.episode_run_time
      .filter(runtime => Number.isInteger(runtime) && runtime >= 0 && runtime <= 1000)
      .slice(0, 10);
  }

  if (Array.isArray(show.seasons)) {
    sanitized.seasons = show.seasons.slice(0, 100).flatMap(season => {
      if (!isRecord(season) ||
          !isIntegerInRange(season.season_number, 0, 1000) ||
          !isIntegerInRange(season.episode_count, 0, 10000)) {
        return [];
      }

      const cleanSeason = {
        season_number: season.season_number,
        episode_count: season.episode_count
      };
      if (typeof season.air_date === 'string' && season.air_date.length <= 20) {
        cleanSeason.air_date = season.air_date;
      } else if (season.air_date === null) {
        cleanSeason.air_date = null;
      }
      if (typeof season.is_aired === 'boolean') {
        cleanSeason.is_aired = season.is_aired;
      }
      return [cleanSeason];
    });
  }

  if (Array.isArray(show.genres)) {
    sanitized.genres = show.genres
      .filter(genre => typeof genre === 'string' && genre.length <= 100)
      .slice(0, 20);
  }
  if (Array.isArray(show.watch_providers)) {
    sanitized.watch_providers = sanitizeProviders(show.watch_providers);
  }
  if (isRecord(show.all_watch_providers)) {
    sanitized.all_watch_providers = Object.entries(show.all_watch_providers)
      .filter(([country]) => /^[A-Z]{2}$/.test(country))
      .slice(0, 50)
      .reduce((all, [country, providers]) => {
        all[country] = sanitizeProviders(providers);
        return all;
      }, {});
  }
  if (Array.isArray(show.networks)) {
    sanitized.networks = show.networks.slice(0, 30).flatMap(network => {
      if (!isRecord(network) ||
          !isIntegerInRange(network.id, 0, MAX_SHOW_ID) ||
          !isBoundedString(network.name, 100)) {
        return [];
      }
      return [{
        id: network.id,
        name: network.name.trim(),
        logo_path: typeof network.logo_path === 'string' && network.logo_path.length <= 2048
          ? network.logo_path
          : null
      }];
    });
  }
  if (Array.isArray(show.cast)) {
    sanitized.cast = show.cast.slice(0, 50).flatMap(member => {
      if (!isRecord(member) ||
          !isIntegerInRange(member.id, 0, MAX_SHOW_ID) ||
          !isBoundedString(member.name, 150)) {
        return [];
      }

      const cleanMember = {
        id: member.id,
        name: member.name.trim(),
        character: typeof member.character === 'string' && member.character.length <= 200
          ? member.character
          : ''
      };
      cleanMember.profile_path = typeof member.profile_path === 'string' &&
        member.profile_path.length <= 2048
        ? member.profile_path
        : null;
      return [cleanMember];
    });
  }
  if (isIntegerInRange(show.rank, 1, 250)) {
    sanitized.rank = show.rank;
  }

  return sanitized;
};

const isValidIdentifier = value => isBoundedString(value, 128);

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const origin = event.headers?.origin || event.headers?.Origin;
  const respond = (statusCode, bodyObj) => sendResponse(statusCode, bodyObj, origin);

  // Handle CORS preflight request
  if (method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return respond(403, { error: 'Origin not allowed.' });
    }

    return {
      statusCode: 200,
      headers: {
        ...getCorsHeaders(origin)
      },
      body: '',
    };
  }

  // Authenticate user via Netlify Identity context
  // Netlify automatically populates context.clientContext.user when the user sends an Authorization header
  const { user } = context.clientContext || {};
  if (!user) {
    return respond(401, { error: 'Unauthorized' });
  }

  const userId = user.sub; // Netlify user UUID
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    const response = respond(429, { error: 'Too many requests. Please retry later.' });
    response.headers['Retry-After'] = String(rateLimit.retryAfterSeconds);
    return response;
  }

  try {
    if (method === 'GET') {
      const db = getDb();
      // Fetch both watched and pending shows for the user
      const [watchedRows, pendingRows] = await Promise.all([
        db`
          SELECT instance_id, show_data, seasons_watched, total_minutes, episodes_watched, user_rating, created_at
          FROM watched_shows
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `,
        db`
          SELECT pending_id, show_data, added_at
          FROM pending_shows
          WHERE user_id = ${userId}
          ORDER BY added_at DESC
        `,
      ]);

      const watched = watchedRows.map(row => ({
        instanceId: row.instance_id,
        show: typeof row.show_data === 'string' ? JSON.parse(row.show_data) : row.show_data,
        seasonsWatched: row.seasons_watched,
        totalMinutes: row.total_minutes,
        episodesWatched: row.episodes_watched,
        userRating: row.user_rating,
        addedAt: row.created_at ? new Date(row.created_at).getTime() : undefined
      }));

      const pending = pendingRows.map(row => ({
        id: row.pending_id,
        show: typeof row.show_data === 'string' ? JSON.parse(row.show_data) : row.show_data,
        addedAt: Number(row.added_at)
      }));

      return respond(200, { watched, pending });
    }

    if (method === 'POST') {
      const parsed = readJsonBody(event);
      if (parsed.error) {
        return respond(400, { error: parsed.error });
      }
      const body = parsed.body;

      // Handle full user data reset
      if (body.action === 'reset') {
        const db = getDb();
        await Promise.all([
          db`DELETE FROM watched_shows WHERE user_id = ${userId}`,
          db`DELETE FROM pending_shows WHERE user_id = ${userId}`,
        ]);
        return respond(200, { success: true });
      }

      // Handle delete action sent via POST for maximum proxy/gateway compatibility
      if (body.action === 'delete') {
        const { type, instanceId, pendingId } = body;
        if (type === 'watched' && isValidIdentifier(instanceId)) {
          const db = getDb();
          await db`
            DELETE FROM watched_shows
            WHERE user_id = ${userId} AND instance_id = ${instanceId}
          `;
        } else if (type === 'pending' && isValidIdentifier(pendingId)) {
          const db = getDb();
          await db`
            DELETE FROM pending_shows
            WHERE user_id = ${userId} AND pending_id = ${pendingId}
          `;
        } else {
          return respond(400, { error: 'Invalid delete request.' });
        }
        return respond(200, { success: true });
      }

      // Handle single upsert of watched or pending show
      const { type, item } = body;
      if (body.action !== undefined || !isRecord(item)) {
        return respond(400, { error: 'Invalid show request.' });
      }

      const show = sanitizeShow(item.show);
      if (!show) {
        return respond(400, { error: 'Invalid show data.' });
      }

      if (type === 'watched') {
        if (!isValidIdentifier(item.instanceId) ||
            !isIntegerInRange(item.seasonsWatched, 1, 1000) ||
            !isIntegerInRange(item.totalMinutes, 0, 100_000_000) ||
            !isIntegerInRange(item.episodesWatched, 1, 100_000) ||
            typeof item.userRating !== 'number' || !Number.isFinite(item.userRating) ||
            (item.addedAt !== undefined &&
              (!Number.isSafeInteger(item.addedAt) || item.addedAt <= 0 ||
                !Number.isFinite(new Date(item.addedAt).getTime())))) {
          return respond(400, { error: 'Invalid watched show data.' });
        }

        const createdAt = item.addedAt ? new Date(item.addedAt).toISOString() : new Date().toISOString();
        const userRating = Math.round(Math.min(10, Math.max(0, item.userRating)));
        const db = getDb();
        await db`
          INSERT INTO watched_shows (user_id, instance_id, show_id, show_data, seasons_watched, total_minutes, episodes_watched, user_rating, created_at)
          VALUES (
            ${userId},
            ${item.instanceId},
            ${show.id},
            ${JSON.stringify(show)},
            ${item.seasonsWatched},
            ${item.totalMinutes},
            ${item.episodesWatched},
            ${userRating},
            ${createdAt}
          )
          ON CONFLICT (user_id, instance_id) DO UPDATE SET
            show_data        = EXCLUDED.show_data,
            seasons_watched  = EXCLUDED.seasons_watched,
            total_minutes    = EXCLUDED.total_minutes,
            episodes_watched = EXCLUDED.episodes_watched,
            user_rating      = EXCLUDED.user_rating
        `;
      } else if (type === 'pending') {
        if (!isValidIdentifier(item.id) ||
            !Number.isSafeInteger(item.addedAt) || item.addedAt <= 0 ||
            !Number.isFinite(new Date(item.addedAt).getTime())) {
          return respond(400, { error: 'Invalid pending show data.' });
        }

        const db = getDb();
        await db`
          INSERT INTO pending_shows (user_id, pending_id, show_id, show_data, added_at)
          VALUES (
            ${userId},
            ${item.id},
            ${show.id},
            ${JSON.stringify(show)},
            ${item.addedAt}
          )
          ON CONFLICT (user_id, pending_id) DO UPDATE SET
            show_data = EXCLUDED.show_data,
            added_at  = EXCLUDED.added_at
        `;
      } else {
        return respond(400, { error: 'Invalid show type.' });
      }

      return respond(200, { success: true });
    }

    if (method === 'DELETE') {
      if (Buffer.byteLength(typeof event.body === 'string' ? event.body : '', 'utf8') >
          MAX_REQUEST_BODY_BYTES) {
        return respond(400, { error: 'Request body is too large.' });
      }

      let type, instanceId, pendingId;
      try {
        const parsed = JSON.parse(event.body || '{}');
        if (isRecord(parsed)) {
          type = parsed.type;
          instanceId = parsed.instanceId;
          pendingId = parsed.pendingId;
        }
      } catch (_) {}

      // Fallback to query string parameters if body was stripped by gateway
      const query = event.queryStringParameters || {};
      type = type || query.type;
      instanceId = instanceId || query.instanceId;
      pendingId = pendingId || query.pendingId;

      if (type === 'watched' && isValidIdentifier(instanceId)) {
        const db = getDb();
        await db`
          DELETE FROM watched_shows
          WHERE user_id = ${userId} AND instance_id = ${instanceId}
        `;
      } else if (type === 'pending' && isValidIdentifier(pendingId)) {
        const db = getDb();
        await db`
          DELETE FROM pending_shows
          WHERE user_id = ${userId} AND pending_id = ${pendingId}
        `;
      } else {
        return respond(400, { error: 'Invalid delete request.' });
      }

      return respond(200, { success: true });
    }

    return respond(405, { error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Error in Netlify Function:', error);
    return respond(500, { error: 'Internal Server Error' });
  }
};
