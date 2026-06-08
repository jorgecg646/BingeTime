import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WatchedShow, PendingShow } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = '/api/shows';

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Fetches all watched shows for a user from the Serverless API.
   * @param userId - ID of the authenticated user
   */
  async getWatchedShows(userId: string): Promise<WatchedShow[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ watched: WatchedShow[]; pending: PendingShow[] }>(this.apiUrl, {
          headers: this.getHeaders()
        })
      );
      return res?.watched || [];
    } catch (error) {
      console.error('Error fetching watched shows:', error);
      throw error;
    }
  }

  /**
   * Upserts a watched show record in Supabase.
   * @param userId - ID of the authenticated user
   * @param item - The WatchedShow object to save
   */
  async upsertWatchedShow(userId: string, item: WatchedShow): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<any>(
          this.apiUrl,
          { type: 'watched', item },
          { headers: this.getHeaders() }
        )
      );
    } catch (error) {
      console.error('Error saving watched show:', error);
      throw error;
    }
  }

  /**
   * Deletes a watched show record from Supabase.
   * @param userId - ID of the authenticated user
   * @param instanceId - The unique watch instance ID
   */
  async deleteWatchedShow(userId: string, instanceId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<any>(this.apiUrl, {
          headers: this.getHeaders(),
          body: { type: 'watched', instanceId }
        })
      );
    } catch (error) {
      console.error('Error deleting watched show:', error);
      throw error;
    }
  }

  /**
   * Fetches all pending shows for a user from Supabase.
   * @param userId - ID of the authenticated user
   */
  async getPendingShows(userId: string): Promise<PendingShow[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ watched: WatchedShow[]; pending: PendingShow[] }>(this.apiUrl, {
          headers: this.getHeaders()
        })
      );
      return res?.pending || [];
    } catch (error) {
      console.error('Error fetching pending shows:', error);
      throw error;
    }
  }

  /**
   * Upserts a pending show record in Supabase.
   * @param userId - ID of the authenticated user
   * @param item - The PendingShow object to save
   */
  async upsertPendingShow(userId: string, item: PendingShow): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<any>(
          this.apiUrl,
          { type: 'pending', item },
          { headers: this.getHeaders() }
        )
      );
    } catch (error) {
      console.error('Error saving pending show:', error);
      throw error;
    }
  }

  /**
   * Deletes a pending show record from Supabase.
   * @param userId - ID of the authenticated user
   * @param pendingId - The unique pending list entry ID
   */
  async deletePendingShow(userId: string, pendingId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<any>(this.apiUrl, {
          headers: this.getHeaders(),
          body: { type: 'pending', pendingId }
        })
      );
    } catch (error) {
      console.error('Error deleting pending show:', error);
      throw error;
    }
  }

  /**
   * Deletes all records for a user from Supabase tables (Reset All).
   * @param userId - ID of the authenticated user
   */
  async resetAllUserData(userId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<any>(
          this.apiUrl,
          { action: 'reset' },
          { headers: this.getHeaders() }
        )
      );
    } catch (error) {
      console.error('Error resetting user data:', error);
      throw error;
    }
  }
}
