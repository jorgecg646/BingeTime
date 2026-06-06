/** Represents a TV show with its metadata and season information. */
export interface TVShow {
  /** Unique identifier from TVMaze. */
  id: number;
  /** Display name of the show. */
  name: string;
  /** URL to the show's poster image, or null if unavailable. */
  poster_path: string | null;
  /** Premiere date string (e.g. "2020-01-15"). */
  first_air_date: string;
  /** Total number of seasons available. */
  number_of_seasons: number;
  /** Average runtime per episode in minutes. */
  episode_run_time: number;
  /** TVMaze community rating (0-10), or null if unrated. */
  rating: number | null;
  /** Array of season details with episode counts. */
  seasons: Season[];
  /** HTML-formatted summary/description of the show. */
  summary?: string;
  /** Genre tags associated with the show. */
  genres?: string[];
}

/** Represents a single season with its number and episode count. */
export interface Season {
  /** Sequential season number (1-based). */
  season_number: number;
  /** Number of episodes in this season. */
  episode_count: number;
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

/** Alert data when a show in the user's watchlist has new seasons available. */
export interface NewSeasonAlert {
  /** TVMaze show ID this alert refers to. */
  showId: number;
  /** Display name of the show. */
  showName: string;
  /** URL to the show's poster image, or null if unavailable. */
  posterPath: string | null;
  /** Number of seasons the user previously had recorded. */
  previousSeasons: number;
  /** Current total number of seasons available. */
  currentSeasons: number;
  /** Array of the newly detected season numbers. */
  newSeasonNumbers: number[];
}
