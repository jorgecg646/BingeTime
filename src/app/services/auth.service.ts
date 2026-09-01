import { Injectable, signal, computed } from '@angular/core';
import GoTrue, { User } from 'gotrue-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: GoTrue;
  private refreshTimer: any = null;

  /** Reactive signal holding the currently authenticated user, or null. */
  user = signal<User | null>(null);

  /**
   * True while the app is restoring a persisted session and refreshing its token.
   * Use this to avoid rendering the "not logged in" state during startup.
   */
  isRestoringSession = signal<boolean>(false);

  /** Whether a user is currently logged in. */
  isLoggedIn = computed(() => !!this.user());

  /** Display name derived from user metadata or email. */
  displayName = computed<string>(() => {
    const u = this.user();
    if (!u) return '';
    return (u.user_metadata?.['full_name'] as string) || (u.user_metadata?.['name'] as string) || u.email || '';
  });

  /** Avatar URL from user metadata (Google provides this). */
  avatarUrl = computed(() => {
    const u = this.user();
    if (!u) return '';
    return u.user_metadata?.['avatar_url'] || '';
  });

  /** User's email address. */
  email = computed(() => this.user()?.email || '');

  /** Returns the current active JWT token for the user, or null. */
  getToken(): string | null {
    const u = this.user();
    return u?.token?.access_token || null;
  }

  /**
   * Returns a valid JWT token, refreshing it first if it has expired or is close to expiring.
   * Use this before making authenticated API calls to avoid 401 errors.
   */
  async getValidToken(): Promise<string | null> {
    let u = this.user();
    if (!u) return null;

    try {
      const expiresAt = (u.token?.expires_at ?? 0) * 1000;
      // If token expires in less than 2 minutes or is already expired, refresh it proactively
      const needsRefresh = Date.now() >= (expiresAt - 2 * 60 * 1000);

      if (needsRefresh) {
        await u.jwt(true);
        const updated = this.auth.currentUser();
        if (updated) {
          this.user.set(updated);
          this.scheduleNextRefresh(updated);
          u = updated;
        }
      }
      return u.token?.access_token || null;
    } catch (err) {
      console.warn('Could not refresh token before API call:', err);
      return u.token?.access_token || null;
    }
  }

  constructor() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Use the secure HTTPS production Netlify Identity endpoint in development/production
    const siteUrl = (isLocalhost && environment.netlifyUrl) ? environment.netlifyUrl : (environment.netlifyUrl || window.location.origin);
    
    // Always use localStorage persistence (setCookie: false) so sessions
    // survive indefinitely across all devices/browsers without cookie policy issues.
    this.auth = new GoTrue({
      APIUrl: `${siteUrl}/.netlify/identity`,
      setCookie: false,
    });

    // Check if there is an OAuth hash returning in the URL
    const hasAuthHash = window.location.hash && (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('confirmation_token=')
    );

    if (hasAuthHash) {
      this.isRestoringSession.set(true);
    }

    // Restore persisted session from localStorage on startup.
    const currentUser = this.auth.currentUser();
    if (currentUser) {
      const expiresAt = (currentUser.token?.expires_at ?? 0) * 1000;
      const tokenIsValid = Date.now() < expiresAt;

      if (tokenIsValid) {
        this.user.set(currentUser);
        this.scheduleNextRefresh(currentUser);
      } else {
        // Token expired while the browser was closed; refresh silently using refresh_token
        this.isRestoringSession.set(true);
        currentUser.jwt(true)
          .then(() => {
            const refreshedUser = this.auth.currentUser();
            this.user.set(refreshedUser ?? currentUser);
            if (refreshedUser) {
              this.scheduleNextRefresh(refreshedUser);
            }
          })
          .catch((err: any) => {
            console.warn('Could not refresh expired token on startup:', err);
            // If the refresh token itself is invalid/revoked, clear user; otherwise keep local state
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('invalid') || msg.includes('revoked')) {
              this.user.set(null);
            } else {
              this.user.set(currentUser);
            }
          })
          .finally(() => {
            this.isRestoringSession.set(false);
          });
      }
    }
  }

  /**
   * Schedules a silent token refresh before the current token expires.
   * Netlify Identity tokens expire in 60 minutes; we refresh at ~50 minutes.
   */
  private scheduleNextRefresh(user: User) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiresAt = (user.token?.expires_at ?? 0) * 1000;
    const now = Date.now();
    // Refresh 5 minutes before expiry, with a minimum delay of 30 seconds
    const delay = Math.max(expiresAt - now - (5 * 60 * 1000), 30 * 1000);

    this.refreshTimer = setTimeout(async () => {
      const current = this.auth.currentUser();
      if (!current) return;

      try {
        await current.jwt(true);
        const refreshed = this.auth.currentUser();
        if (refreshed) {
          this.user.set(refreshed);
          this.scheduleNextRefresh(refreshed);
        }
      } catch (err) {
        console.warn('Silent token refresh failed, will retry on next API call:', err);
        // Retry in 2 minutes
        this.refreshTimer = setTimeout(() => {
          if (this.auth.currentUser()) {
            this.scheduleNextRefresh(this.auth.currentUser()!);
          }
        }, 2 * 60 * 1000);
      }
    }, delay);
  }

  /**
   * Registers a new user with email and password.
   * The user will receive a confirmation email before they can log in.
   * @param email - User email address
   * @param password - User password (min 6 characters)
   * @returns Promise resolving on success
   */
  async signup(email: string, password: string): Promise<void> {
    await this.auth.signup(email, password);
  }

  /**
   * Logs in an existing user with email and password.
   * @param email - User email address
   * @param password - User password
   * @returns Promise resolving with the authenticated User
   */
  async login(email: string, password: string): Promise<User> {
    const user = await this.auth.login(email, password, true);
    this.user.set(user);
    this.scheduleNextRefresh(user);
    return user;
  }

  /**
   * Initiates the Google OAuth login flow by redirecting the user
   * to the Netlify Identity Google authorization URL.
   */
  loginWithGoogle(): void {
    const url = this.auth.loginExternalUrl('google');
    window.location.href = url;
  }

  /**
   * Handles the OAuth callback by parsing the access_token from the URL hash.
   * Should be called during app initialization to catch returning OAuth flows.
   * @returns Promise resolving to true if a user was authenticated from the URL hash
   */
  async handleExternalLogin(): Promise<boolean> {
    const hash = window.location.hash;
    if (!hash) {
      return false;
    }

    try {
      // Parse hash parameters: #access_token=... or #confirmation_token=...
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const confirmationToken = params.get('confirmation_token');

      if (accessToken) {
        this.isRestoringSession.set(true);
        try {
          // Use createUser to restore the session from the access token and remember it in localStorage
          const user = await this.auth.createUser({ access_token: accessToken } as any, true);
          this.user.set(user);
          this.scheduleNextRefresh(user);
          // Clean up the URL hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return true;
        } catch (err: any) {
          console.error('Error processing OAuth callback:', err);
          return false;
        } finally {
          this.isRestoringSession.set(false);
        }
      }

      if (confirmationToken) {
        this.isRestoringSession.set(true);
        try {
          // Confirm the email address
          const user = await this.confirmEmail(confirmationToken);
          console.log('Email confirmed successfully:', user.email);
          this.scheduleNextRefresh(user);
          // Clean up the URL hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return true;
        } catch (err: any) {
          console.error('Error confirming email:', err);
          return false;
        } finally {
          this.isRestoringSession.set(false);
        }
      }
    } catch (err) {
      console.error('Error parsing OAuth/Confirmation hash:', err);
    }
    return false;
  }

  /**
   * Logs out the current user and clears the session.
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    const currentUser = this.auth.currentUser();
    if (currentUser) {
      await currentUser.logout();
    }
    this.user.set(null);
  }

  /**
   * Confirms a user's email using the confirmation token from the email link.
   * @param token - The confirmation token from the email URL
   * @returns Promise resolving with the confirmed User
   */
  async confirmEmail(token: string): Promise<User> {
    const user = await this.auth.confirm(token);
    this.user.set(user);
    this.scheduleNextRefresh(user);
    return user;
  }
}

