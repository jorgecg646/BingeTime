const { createClient } = require('@supabase/supabase-js');

// Read database config from environment variables securely in the serverless environment
let supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// If Netlify integration only created SUPABASE_DATABASE_URL, extract the REST URL from it
if (!supabaseUrl && process.env.SUPABASE_DATABASE_URL) {
  const match = process.env.SUPABASE_DATABASE_URL.match(/db\.(.+?)\.supabase/);
  if (match && match[1]) {
    supabaseUrl = `https://${match[1]}.supabase.co`;
  }
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  // 1. Authenticate user via Netlify Identity context
  // Netlify automatically populates context.clientContext.user when the user sends an Authorization header
  const { user } = context.clientContext || {};
  if (!user) {
    return sendResponse(401, { error: 'Unauthorized' });
  }

  const userId = user.sub; // Netlify user UUID

  try {
    if (method === 'GET') {
      // Fetch both watched and pending shows for the user
      const [watchedRes, pendingRes] = await Promise.all([
        supabase
          .from('watched_shows')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pending_shows')
          .select('*')
          .eq('user_id', userId)
          .order('added_at', { ascending: false }),
      ]);

      if (watchedRes.error) throw watchedRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const watched = (watchedRes.data || []).map(row => ({
        instanceId: row.instance_id,
        show: row.show_data,
        seasonsWatched: row.seasons_watched,
        totalMinutes: row.total_minutes,
        episodesWatched: row.episodes_watched,
        userRating: row.user_rating
      }));

      const pending = (pendingRes.data || []).map(row => ({
        id: row.pending_id,
        show: row.show_data,
        addedAt: Number(row.added_at)
      }));

      return sendResponse(200, { watched, pending });
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // Handle full user data reset
      if (body.action === 'reset') {
        const deleteWatched = supabase
          .from('watched_shows')
          .delete()
          .eq('user_id', userId);

        const deletePending = supabase
          .from('pending_shows')
          .delete()
          .eq('user_id', userId);

        const [resW, resP] = await Promise.all([deleteWatched, deletePending]);
        if (resW.error) throw resW.error;
        if (resP.error) throw resP.error;

        return sendResponse(200, { success: true });
      }

      // Handle single upsert of watched or pending show
      const { type, item } = body;
      if (type === 'watched') {
        const { error } = await supabase
          .from('watched_shows')
          .upsert({
            user_id: userId,
            instance_id: item.instanceId,
            show_id: item.show.id,
            show_data: item.show,
            seasons_watched: item.seasonsWatched,
            total_minutes: item.totalMinutes,
            episodes_watched: item.episodesWatched,
            user_rating: item.userRating
          }, {
            onConflict: 'user_id,instance_id'
          });

        if (error) throw error;
      } else if (type === 'pending') {
        const { error } = await supabase
          .from('pending_shows')
          .upsert({
            user_id: userId,
            pending_id: item.id,
            show_id: item.show.id,
            show_data: item.show,
            added_at: item.addedAt
          }, {
            onConflict: 'user_id,pending_id'
          });

        if (error) throw error;
      }

      return sendResponse(200, { success: true });
    }

    if (method === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { type, instanceId, pendingId } = body;

      // Handle single deletions
      if (type === 'watched') {
        const { error } = await supabase
          .from('watched_shows')
          .delete()
          .eq('user_id', userId)
          .eq('instance_id', instanceId);

        if (error) throw error;
      } else if (type === 'pending') {
        const { error } = await supabase
          .from('pending_shows')
          .delete()
          .eq('user_id', userId)
          .eq('pending_id', pendingId);

        if (error) throw error;
      }

      return sendResponse(200, { success: true });
    }

    return sendResponse(405, { error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Error in Netlify Function:', error);
    return sendResponse(500, { error: error.message || 'Internal Server Error' });
  }
};
