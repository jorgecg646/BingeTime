import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional route guard that prevents unauthenticated users from accessing
 * protected routes. Redirects to the /auth page when no active session exists.
 *
 * Waits for any in-progress session restoration (token refresh on startup) to
 * complete before making the decision, so the user is not kicked to /auth
 * while the silent refresh is still running.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If we are currently restoring the session, wait until it finishes
  // before evaluating whether the user is logged in.
  if (authService.isRestoringSession()) {
    return toObservable(authService.isRestoringSession).pipe(
      // Wait until the restoration flag goes false
      filter(restoring => !restoring),
      take(1),
      map(() => {
        if (authService.isLoggedIn()) {
          return true;
        }
        return router.createUrlTree(['/auth']);
      })
    );
  }

  if (authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/auth']);
};
