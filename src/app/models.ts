/** Represents a TV show with its metadata and season information. */
export interface TVShow {
  /** Unique identifier from TMDB. */
  id: number;
  /** Display name of the show. */
  name: string;
  /** URL to the show's poster image, or null if unavailable. */
  poster_path: string | null;
  /** URL to the show's backdrop image, or null if unavailable. */
  backdrop_path?: string | null;
  /** Premiere date string (e.g. "2020-01-15"). */
  first_air_date: string;
  /** Total number of seasons available. */
  number_of_seasons: number;
  /** Average runtime per episode in minutes. */
  episode_run_time: number;
  /** TMDB community rating (0-10), or null if unrated. */
  rating: number | null;
  /** Array of season details with episode counts. */
  seasons: Season[];
  /** Summary/description of the show. */
  summary?: string;
  /** Genre tags associated with the show. */
  genres?: string[];
  /** Streaming platforms where the show is available for the current country. */
  watch_providers?: WatchProvider[];
  /** Streaming platforms organized by country code (e.g. { ES: [...], US: [...], MX: [...] }). */
  all_watch_providers?: Record<string, WatchProvider[]>;
  /** Official videos / trailers. */
  videos?: VideoTrailer[];
  /** Recommended / similar shows. */
  recommendations?: TVShow[];
  /** User reviews from TMDB. */
  reviews?: Review[];
  /** Cast members / actors. */
  cast?: CastMember[];
  /** Production status (e.g. "Ended", "Returning Series"). */
  status?: string;
  /** Networks / TV channels. */
  networks?: { id: number; name: string; logo_path: string | null }[];
  /** Ranking position in Top 250 (1..250). */
  rank?: number;
}

/** Actor and character info. */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

/** Streaming provider information (e.g. Netflix, HBO Max). */
export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority?: number;
}

/** YouTube video / trailer information from TMDB. */
export interface VideoTrailer {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

/** User review from TMDB. */
export interface Review {
  id: string;
  author: string;
  content: string;
  created_at: string;
  rating?: number | null;
  avatar_path?: string | null;
}

/** Represents a single season with its number and episode count. */
export interface Season {
  /** Sequential season number (1-based). */
  season_number: number;
  /** Number of episodes in this season. */
  episode_count: number;
  /** Air date of the season if available. */
  air_date?: string | null;
  /** True if this season has already aired. */
  is_aired?: boolean;
}

/** Represents a show the user has watched, with tracking metadata. */
export interface WatchedShow {
  /** Unique identifier for this watch instance (allows duplicate show entries). */
  instanceId: string;
  /** The TV show that was watched. */
  show: TVShow;
  /** Number of seasons the user has watched. */
  seasonsWatched: number;
  /** Total watch time in minutes for this instance. */
  totalMinutes: number;
  /** Total number of episodes watched across selected seasons. */
  episodesWatched: number;
  /** User's personal rating (1-10), or 0 if not rated. */
  userRating: number;
  /** Timestamp (ms) when the show was added to the watchlist. */
  addedAt?: number;
}

/** Represents a show saved to the user's "to watch" pending list. */
export interface PendingShow {
  /** Unique identifier for this pending entry. */
  id: string;
  /** The TV show marked as pending. */
  show: TVShow;
  /** Timestamp (ms) when the show was added to pending. */
  addedAt: number;
}

/** Alert data when a show in the user's watchlist has recent or upcoming episodes. */
export interface NewEpisodeAlert {
  /** TMDB show ID this alert refers to. */
  showId: number;
  /** Display name of the show. */
  showName: string;
  /** URL to the show's poster image, or null if unavailable. */
  posterPath: string | null;
  /** Number of new episodes or 1 if upcoming. */
  newEpisodeCount: number;
  /** Details of the episodes (season, episode number, name, air date). */
  newEpisodes: NewEpisodeInfo[];
  /** True if this is an upcoming release. */
  isUpcoming?: boolean;
}

/** Brief info about a single recently-aired or upcoming episode. */
export interface NewEpisodeInfo {
  /** Season number the episode belongs to. */
  season: number;
  /** Episode number within the season. */
  number: number;
  /** Episode title. */
  name: string;
  /** Air date string (YYYY-MM-DD). */
  airdate: string;
  /** Brief overview/synopsis if available. */
  overview?: string;
  /** True if this episode airs in the future. */
  isUpcoming?: boolean;
}
