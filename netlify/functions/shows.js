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

// Helper function to return JSON responses with correct CORS headers
const sendResponse = (statusCode, bodyObj) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    },
    body: JSON.stringify(bodyObj)
  };
};

exports.handler = async (event, context) => {
  const method = event.httpMethod;

  // Handle CORS preflight request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      },
      body: '',
    };
  }

  // Authenticate user via Netlify Identity context
  // Netlify automatically populates context.clientContext.user when the user sends an Authorization header
  const { user } = context.clientContext || {};
  if (!user) {
    return sendResponse(401, { error: 'Unauthorized' });
  }

  const userId = user.sub; // Netlify user UUID

  try {
    const db = getDb();

    if (method === 'GET') {
      // Fetch both watched and pending shows for the user
      const [watchedRows, pendingRows] = await Promise.all([
        db`
          SELECT instance_id, show_data, seasons_watched, total_minutes, episodes_watched, user_rating
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
        userRating: row.user_rating
      }));

      const pending = pendingRows.map(row => ({
        id: row.pending_id,
        show: typeof row.show_data === 'string' ? JSON.parse(row.show_data) : row.show_data,
        addedAt: Number(row.added_at)
      }));

      return sendResponse(200, { watched, pending });
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // Handle full user data reset
      if (body.action === 'reset') {
        await Promise.all([
          db`DELETE FROM watched_shows WHERE user_id = ${userId}`,
          db`DELETE FROM pending_shows WHERE user_id = ${userId}`,
        ]);
        return sendResponse(200, { success: true });
      }

      // Handle delete action sent via POST for maximum proxy/gateway compatibility
      if (body.action === 'delete') {
        const { type, instanceId, pendingId } = body;
        if (type === 'watched' && instanceId) {
          await db`
            DELETE FROM watched_shows
            WHERE user_id = ${userId} AND instance_id = ${instanceId}
          `;
        } else if (type === 'pending' && pendingId) {
          await db`
            DELETE FROM pending_shows
            WHERE user_id = ${userId} AND pending_id = ${pendingId}
          `;
        }
        return sendResponse(200, { success: true });
      }

      // Handle single upsert of watched or pending show
      const { type, item } = body;

      if (type === 'watched') {
        const now = new Date().toISOString();
        await db`
          INSERT INTO watched_shows (user_id, instance_id, show_id, show_data, seasons_watched, total_minutes, episodes_watched, user_rating, created_at)
          VALUES (
            ${userId},
            ${item.instanceId},
            ${item.show.id},
            ${JSON.stringify(item.show)},
            ${item.seasonsWatched},
            ${item.totalMinutes},
            ${item.episodesWatched},
            ${item.userRating},
            ${now}
          )
          ON CONFLICT (user_id, instance_id) DO UPDATE SET
            show_data        = EXCLUDED.show_data,
            seasons_watched  = EXCLUDED.seasons_watched,
            total_minutes    = EXCLUDED.total_minutes,
            episodes_watched = EXCLUDED.episodes_watched,
            user_rating      = EXCLUDED.user_rating
        `;
      } else if (type === 'pending') {
        await db`
          INSERT INTO pending_shows (user_id, pending_id, show_id, show_data, added_at)
          VALUES (
            ${userId},
            ${item.id},
            ${item.show.id},
            ${JSON.stringify(item.show)},
            ${item.addedAt}
          )
          ON CONFLICT (user_id, pending_id) DO UPDATE SET
            show_data = EXCLUDED.show_data,
            added_at  = EXCLUDED.added_at
        `;
      }

      return sendResponse(200, { success: true });
    }

    if (method === 'DELETE') {
      let type, instanceId, pendingId;
      try {
        const parsed = JSON.parse(event.body || '{}');
        type = parsed.type;
        instanceId = parsed.instanceId;
        pendingId = parsed.pendingId;
      } catch (_) {}

      // Fallback to query string parameters if body was stripped by gateway
      const query = event.queryStringParameters || {};
      type = type || query.type;
      instanceId = instanceId || query.instanceId;
      pendingId = pendingId || query.pendingId;

      if (type === 'watched' && instanceId) {
        await db`
          DELETE FROM watched_shows
          WHERE user_id = ${userId} AND instance_id = ${instanceId}
        `;
      } else if (type === 'pending' && pendingId) {
        await db`
          DELETE FROM pending_shows
          WHERE user_id = ${userId} AND pending_id = ${pendingId}
        `;
      }

      return sendResponse(200, { success: true });
    }

    return sendResponse(405, { error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Error in Netlify Function:', error);
    return sendResponse(500, { error: error.message || 'Internal Server Error' });
  }
};
