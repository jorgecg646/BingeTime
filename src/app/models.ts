export interface TVShow {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  episode_run_time: number;
  rating: number | null;
  seasons: Season[];
  summary?: string;
}

export interface Season {
  season_number: number;
  episode_count: number;
}

export interface WatchedShow {
  instanceId: string;
  show: TVShow;
  seasonsWatched: number;
  totalMinutes: number;
  episodesWatched: number;
  userRating: number;
}
