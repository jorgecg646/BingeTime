/** Common TV genre tags used across filters. */
export const ALL_GENRES: string[] = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Science-Fiction',
  'Thriller', 'War', 'Western'
];

/** Popular streaming providers for quick platform filtering across the application. */
export const POPULAR_PROVIDERS = [
  { id: 0, name: 'All Platforms', logo: null, color: 'text-white' },
  { id: 8, name: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  { id: 1899, name: 'Max', logo: 'https://image.tmdb.org/t/p/w92/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
  { id: 337, name: 'Disney+', logo: 'https://image.tmdb.org/t/p/w92/97yvRBw1GzX7fXprcF80er19ot.jpg' },
  { id: 9, name: 'Prime Video', logo: 'https://image.tmdb.org/t/p/w92/pvske1MyAoymrs5bguRfVqYiM9a.jpg' },
  { id: 350, name: 'Apple TV+', logo: 'https://image.tmdb.org/t/p/w92/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg' },
  { id: 531, name: 'Paramount+', logo: 'https://image.tmdb.org/t/p/w92/fts6X10Jn4QT0X6ac3udKEn2tJA.jpg' },
  { id: 15, name: 'Hulu', logo: 'https://image.tmdb.org/t/p/w92/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg' },
  { id: 386, name: 'Peacock', logo: 'https://image.tmdb.org/t/p/w92/2aGrp1xw3qhwCYvNGAJZPdjfeeX.jpg' },
  { id: 283, name: 'Crunchyroll', logo: 'https://image.tmdb.org/t/p/w92/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg' },
  { id: 149, name: 'Movistar Plus+', logo: 'https://image.tmdb.org/t/p/w92/f6TRLB3H4jDpFEZ0z2KWSSvu1SB.jpg' },
  { id: 1773, name: 'SkyShowtime', logo: 'https://image.tmdb.org/t/p/w92/h0ZYcYHicKQ4Ixm5nOjqvwni5NG.jpg' }
];

/** Shared helper to check if a release date matches a decade filter. */
export function matchesDecade(firstAirDate?: string | null, decade?: string | null): boolean {
  if (!decade) return true;
  if (!firstAirDate) return false;
  const year = parseInt(firstAirDate.slice(0, 4), 10);
  if (isNaN(year)) return false;
  if (decade === '2020s') return year >= 2020;
  if (decade === '2010s') return year >= 2010 && year < 2020;
  if (decade === '2000s') return year >= 2000 && year < 2010;
  if (decade === '1990s') return year >= 1990 && year < 2000;
  if (decade === '1980s') return year >= 1980 && year < 1990;
  if (decade === 'Pre-80s' || decade === 'Older') return year < 1980;
  return true;
}

/** Formats multi-selected genre labels into a compact display string. */
export function formatGenresLabel(genres: string[]): string {
  if (!genres || genres.length === 0) return 'ALL';
  if (genres.length === 1) return genres[0];
  if (genres.length === 2) return `${genres[0]}, ${genres[1]}`;
  return `${genres.length} Selected`;
}

/** Represents a TV show with its metadata and season information. */
export interface TVShow {
  /** Unique identifier from TMDB. */
  id: number;
  /** Display name of the show (English by default). */
  name: string;
  /** Original name in language of origin. */
  original_name?: string;
  /** Localized/Spanish name if different from English. */
  localized_name?: string;
  /** Popularity metric from TMDB. */
  popularity?: number;
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

/** Full detailed episode information from TMDB season endpoint. */
export interface EpisodeDetail {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number | null;
  vote_count: number;
  episode_type?: string;
}

/** Full season details including episode list from TMDB. */
export interface SeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: EpisodeDetail[];
}

/** Item representing a show release in the calendar schedule. */
export interface CalendarScheduleItem {
  showId: number;
  showName: string;
  posterPath: string | null;
  backdropPath?: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  overview?: string;
  airDate: string;
  isUserShow: boolean;
  networks?: { id: number; name: string; logo_path: string | null }[];
  watchProviders?: WatchProvider[];
  rating?: number | null;
}

/** External social & database IDs for a person (actor/crew). */
export interface PersonExternalIds {
  imdb_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
  facebook_id?: string | null;
  tiktok_id?: string | null;
  wikidata_id?: string | null;
}

/** TV show credit for an actor or crew member. */
export interface PersonTvCreditShow {
  id: number;
  name: string;
  character?: string;
  job?: string;
  department?: string;
  episode_count?: number;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average: number | null;
  vote_count: number;
  popularity: number;
  overview?: string;
  genre_ids?: number[];
}

/** TV credits summary for a person. */
export interface PersonTvCredits {
  cast: PersonTvCreditShow[];
  crew: PersonTvCreditShow[];
}

/** Detailed biographical profile and filmography for an actor/creator. */
export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  homepage: string | null;
  external_ids?: PersonExternalIds;
  tv_credits?: PersonTvCredits;
}

