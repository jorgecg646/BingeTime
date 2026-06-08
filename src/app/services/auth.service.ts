import { Injectable, signal, computed } from '@angular/core';
import GoTrue, { User } from 'gotrue-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: GoTrue;

  /** Reactive signal holding the currently authenticated user, or null. */
  user = signal<User | null>(null);

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

  constructor() {
    // Determine the Netlify site URL dynamically or via environment properties
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // When running locally, use the local origin (which will proxy requests to avoid CORS).
    // In production, use environment.netlifyUrl or fallback to window.location.origin
    const siteUrl = isLocalhost ? window.location.origin : (environment.netlifyUrl || window.location.origin);
    
    this.auth = new GoTrue({
      APIUrl: `${siteUrl}/.netlify/identity`,
      // Disable cookie storage on localhost to avoid security policies / CORS problems
      setCookie: !isLocalhost,
    });

    // Restore user from persisted session
    const currentUser = this.auth.currentUser();
    if (currentUser) {
      this.user.set(currentUser);
    }
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
   * @returns True if a user was authenticated from the URL hash
   */
  handleExternalLogin(): boolean {
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
        // Use createUser to restore the session from the access token
        this.auth.createUser({ access_token: accessToken } as any, true)
          .then((user: User) => {
            this.user.set(user);
            // Clean up the URL hash
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          })
          .catch((err: any) => {
            console.error('Error processing OAuth callback:', err);
          });
        return true;
      }

      if (confirmationToken) {
        // Confirm the email address
        this.confirmEmail(confirmationToken)
          .then((user: User) => {
            console.log('Email confirmed successfully:', user.email);
            // Clean up the URL hash
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          })
          .catch((err: any) => {
            console.error('Error confirming email:', err);
          });
        return true;
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
    return user;
  }
}
