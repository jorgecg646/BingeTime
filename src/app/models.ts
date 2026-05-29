export interface TVShow {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string;
  number_of_seasons: number;
  episode_run_time: number;
  rating: number | null;
  seasons: Season[];
}

export interface Season {
  season_number: number;
  episode_count: number;
}

export interface WatchedShow {
  show: TVShow;
  seasonsWatched: number;
  totalMinutes: number;
  episodesWatched: number;
  userRating: number;
}
