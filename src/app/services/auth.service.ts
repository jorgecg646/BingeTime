import { Injectable, signal, computed } from '@angular/core';
import GoTrue, { User } from 'gotrue-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: GoTrue;
  private refreshTimer: any = null;
  private readonly backupKey = 'binge_auth_user_backup';
  private isRefreshing = false;

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

  /** Normalizes token expiration timestamp to milliseconds regardless of whether GoTrue provided ms or seconds */
  private getExpiresAtMs(token: any): number {
    const raw = token?.expires_at ?? 0;
    if (!raw) return 0;
    return raw > 1e11 ? raw : raw * 1000;
  }

  /** Saves a durable backup copy of the session in localStorage */
  private saveSessionBackup(user: User | null) {
    if (!user || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('gotrue.user');
      if (raw) {
        localStorage.setItem(this.backupKey, raw);
      }
    } catch (e) {
      console.warn('Could not save session backup:', e);
    }
  }

  /** Removes the backup copy only when the user explicitly logs out or token is permanently revoked */
  private clearSessionBackup() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(this.backupKey);
    } catch (e) {}
  }

  /** Restores gotrue.user from backup if gotrue-js cleared it due to a transient network error */
  private restoreSessionFromBackupIfNeeded(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const active = localStorage.getItem('gotrue.user');
      if (!active) {
        const backup = localStorage.getItem(this.backupKey);
        if (backup) {
          localStorage.setItem('gotrue.user', backup);
          const recovered = this.auth.currentUser();
          if (recovered) {
            this.user.set(recovered);
            return recovered;
          }
        }
      }
    } catch (e) {
      console.warn('Error restoring session from backup:', e);
    }
    return null;
  }

  /**
   * Refreshes the token safely. If it fails due to a network glitch or laptop sleep,
   * it preserves the session instead of wiping user credentials.
   */
  private async silentRefresh(user: User): Promise<User | null> {
    if (this.isRefreshing) {
      return this.user();
    }
    this.isRefreshing = true;

    try {
      // If token does not have a refresh_token (e.g. legacy login before this fix),
      // we cannot refresh with grant_type=refresh_token
      if (!user.token?.refresh_token) {
        console.warn('Cannot refresh token: missing refresh_token in user credentials');
        return user;
      }

      await user.jwt(true);
      const refreshed = this.auth.currentUser();
      if (refreshed) {
        this.user.set(refreshed);
        this.saveSessionBackup(refreshed);
        this.scheduleNextRefresh(refreshed);
        return refreshed;
      }
      return null;
    } catch (err: any) {
      console.warn('Token refresh error:', err);
      const msg = (err?.message || '').toLowerCase();
      const isPermanentlyInvalid =
        msg.includes('invalid refresh token') ||
        msg.includes('token has been revoked') ||
        msg.includes('no user found') ||
        (msg.includes('invalid') && msg.includes('grant'));

      if (isPermanentlyInvalid) {
        console.warn('Refresh token is permanently invalid or revoked. Clearing session.');
        this.clearSessionBackup();
        this.user.set(null);
        return null;
      } else {
        // Transient network failure or offline: Gotrue-js may have called clearSession().
        // Restore session from backup immediately!
        const restored = this.restoreSessionFromBackupIfNeeded();
        if (restored) {
          this.user.set(restored);
        }

        // Retry in 1 minute if network recovers
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
          const current = this.user() || this.auth.currentUser();
          if (current) {
            this.silentRefresh(current);
          }
        }, 60 * 1000);
        return this.user();
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Returns a valid JWT token, refreshing it first if it has expired or is close to expiring.
   * Use this before making authenticated API calls to avoid 401 errors.
   */
  async getValidToken(): Promise<string | null> {
    let u = this.user();
    if (!u) {
      u = this.auth.currentUser() || this.restoreSessionFromBackupIfNeeded();
      if (!u) return null;
    }

    try {
      const expiresAt = this.getExpiresAtMs(u.token);
      // If token expires in less than 5 minutes or is already expired, refresh proactively
      const needsRefresh = Date.now() >= (expiresAt - 5 * 60 * 1000);

      if (needsRefresh) {
        const refreshed = await this.silentRefresh(u);
        if (refreshed?.token?.access_token) {
          return refreshed.token.access_token;
        }
      }
      return u.token?.access_token || null;
    } catch {
      console.warn('Could not refresh the session before an authenticated API request.');
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

    // Restore persisted session from localStorage or backup on startup.
    let currentUser = this.auth.currentUser();
    if (!currentUser) {
      currentUser = this.restoreSessionFromBackupIfNeeded();
    }

    if (currentUser) {
      this.saveSessionBackup(currentUser);
      const expiresAt = this.getExpiresAtMs(currentUser.token);
      const tokenIsValid = Date.now() < (expiresAt - 60 * 1000);

      if (tokenIsValid) {
        this.user.set(currentUser);
        this.scheduleNextRefresh(currentUser);
      } else {
        // Token expired while the browser was closed; refresh silently using refresh_token
        this.isRestoringSession.set(true);
        this.silentRefresh(currentUser)
          .catch((err) => {
            console.warn('Initial session refresh warning:', err);
          })
          .finally(() => {
            this.isRestoringSession.set(false);
          });
      }
    }

    this.setupLifecycleListeners();
  }

  /**
   * Sets up listeners for browser visibility, focus, and network reconnection
   * to guarantee tokens stay fresh when waking from sleep or returning to the tab.
   */
  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    // Refresh when user returns to the tab after sleep or backgrounding
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkAndRefreshToken();
      }
    });

    // Refresh when window receives focus
    window.addEventListener('focus', () => {
      this.checkAndRefreshToken();
    });

    // Refresh when internet connection returns
    window.addEventListener('online', () => {
      this.checkAndRefreshToken();
    });
  }

  /**
   * Checks if the active token needs refresh and initiates a silent refresh if needed.
   */
  private async checkAndRefreshToken(): Promise<void> {
    if (this.isRestoringSession()) return;
    const u = this.user() || this.auth.currentUser() || this.restoreSessionFromBackupIfNeeded();
    if (!u || !u.token) return;

    const expiresAt = this.getExpiresAtMs(u.token);
    const now = Date.now();
    // If token expires in less than 5 minutes or is already expired
    if (now >= expiresAt - (5 * 60 * 1000)) {
      await this.silentRefresh(u);
    }
  }

  /**
   * Schedules a silent token refresh before the current token expires.
   * Netlify Identity tokens expire in 60 minutes; we refresh at ~55 minutes.
   */
  private scheduleNextRefresh(user: User) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiresAt = this.getExpiresAtMs(user.token);
    const now = Date.now();
    // Refresh 5 minutes before expiry, with a minimum delay of 15 seconds
    const delay = Math.max(expiresAt - now - (5 * 60 * 1000), 15 * 1000);

    this.refreshTimer = setTimeout(async () => {
      const current = this.user() || this.auth.currentUser() || this.restoreSessionFromBackupIfNeeded();
      if (!current) return;
      await this.silentRefresh(current);
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
    this.saveSessionBackup(user);
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
   * Handles the OAuth callback by parsing tokens from the URL hash.
   * Captures access_token, refresh_token, token_type, and expires_in.
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
      const refreshToken = params.get('refresh_token');
      const expiresIn = params.get('expires_in');
      const tokenType = params.get('token_type');
      const confirmationToken = params.get('confirmation_token');

      if (accessToken) {
        this.isRestoringSession.set(true);
        try {
          const tokenObj: any = {
            access_token: accessToken,
            token_type: tokenType || 'bearer',
            expires_in: expiresIn ? Number(expiresIn) : 3600
          };
          if (refreshToken) {
            tokenObj.refresh_token = refreshToken;
          }

          // Use createUser with complete token object to store the session and remember it in localStorage
          const user = await this.auth.createUser(tokenObj, true);
          this.user.set(user);
          this.saveSessionBackup(user);
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
          // Confirm email address with persistent session
          const user = await this.confirmEmail(confirmationToken);
          console.log('Email confirmed successfully:', user.email);
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
    this.clearSessionBackup();
    const currentUser = this.auth.currentUser();
    if (currentUser) {
      try {
        await currentUser.logout();
      } catch (err) {
        console.warn('Logout request warning:', err);
        try {
          localStorage.removeItem('gotrue.user');
        } catch (e) {}
      }
    }
    this.user.set(null);
  }

  /**
   * Confirms a user's email using the confirmation token from the email link.
   * Persists session to localStorage (remember: true).
   * @param token - The confirmation token from the email URL
   * @returns Promise resolving with the confirmed User
   */
  async confirmEmail(token: string): Promise<User> {
    const user = await this.auth.confirm(token, true);
    this.user.set(user);
    this.saveSessionBackup(user);
    this.scheduleNextRefresh(user);
    return user;
  }
}

