import { TestBed } from '@angular/core/testing';
import { User } from 'gotrue-js';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AuthService] });
    service = TestBed.inject(AuthService);
  });

  it('derives login state and display name from the current user', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.displayName()).toBe('');

    const user = Object.assign(Object.create(User.prototype), {
      user_metadata: { full_name: 'Jorge' },
      email: 'jorge@example.com'
    }) as User;
    service.user.set(user);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.displayName()).toBe('Jorge');
    expect(service.email()).toBe('jorge@example.com');
  });
});
