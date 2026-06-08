import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <!-- Aurora background -->
      <div class="auth-bg">
        <div class="aurora-blob auth-blob-1"></div>
        <div class="aurora-blob auth-blob-2"></div>
        <div class="aurora-blob auth-blob-3"></div>
        <div class="auth-grid-overlay"></div>
        <div class="auth-vignette"></div>
      </div>

      <!-- Auth Card -->
      <div class="auth-container">
        <!-- Logo -->
        <div class="auth-logo">
          <h1 class="auth-logo-text">BingeTime</h1>
          <p class="auth-logo-subtitle">TV-Show time calculator</p>
        </div>

        <div class="auth-card glass-strong animate-fade-in-scale relative">
          <!-- Close Modal Button -->
          <button (click)="closeAuth()" class="absolute top-2 right-2 p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Cerrar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>

          <!-- Tab Toggle -->
          <div class="auth-tabs pr-8">
            <button
              (click)="mode.set('login'); acceptTerms.set(false); error.set('')"
              [class.auth-tab-active]="mode() === 'login'"
              class="auth-tab">
              Iniciar sesión
            </button>
            <button
              (click)="mode.set('signup'); acceptTerms.set(false); error.set('')"
              [class.auth-tab-active]="mode() === 'signup'"
              class="auth-tab">
              Registrarse
            </button>
          </div>

          <!-- Success Message (after signup) -->
          @if (successMessage()) {
            <div class="auth-success animate-fade-in">
              <div class="auth-success-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <p class="auth-success-text">{{ successMessage() }}</p>
              <button (click)="successMessage.set(''); mode.set('login')" class="auth-success-btn">
                Ir a iniciar sesión
              </button>
            </div>
          }

          <!-- Form -->
          @if (!successMessage()) {
            <form (ngSubmit)="onSubmit()" class="auth-form">
              <!-- Email -->
              <div class="auth-field">
                <label for="auth-email" class="auth-label">Correo electrónico</label>
                <div class="auth-input-wrapper">
                  <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <input
                    id="auth-email"
                    type="email"
                    [ngModel]="email()"
                    (ngModelChange)="email.set($event)"
                    name="email"
                    placeholder="tu@email.com"
                    class="auth-input"
                    [class.auth-input-invalid]="emailBlurred() && !emailIsValid()"
                    required
                    autocomplete="email"
                    (blur)="emailBlurred.set(true)"
                    (input)="emailBlurred.set(false)" />
                </div>
                @if (emailBlurred() && !emailIsValid()) {
                  <p class="auth-field-error animate-fade-in">
                    @if (email().length === 0) {
                      El correo electrónico es obligatorio.
                    } @else {
                      Introduce un correo electrónico válido.
                    }
                  </p>
                }
              </div>

              <!-- Password -->
              <div class="auth-field">
                <label for="auth-password" class="auth-label">Contraseña</label>
                <div class="auth-input-wrapper">
                  <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <input
                    id="auth-password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [ngModel]="password()"
                    (ngModelChange)="password.set($event)"
                    name="password"
                    [placeholder]="mode() === 'signup' ? 'Tu contraseña' : 'Tu contraseña'"
                    class="auth-input"
                    [class.auth-input-invalid]="mode() === 'signup' && passwordBlurred() && (!passwordHasMinLength() || !passwordHasUppercase() || !passwordHasSymbol())"
                    required
                    [autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'"
                    minlength="6"
                    (blur)="passwordBlurred.set(true)"
                    (input)="passwordBlurred.set(false)" />
                  <button type="button" (click)="showPassword.set(!showPassword())" class="auth-toggle-password">
                    @if (showPassword()) {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    }
                  </button>
                </div>

                <!-- Live requirements checklist for signup -->
                @if (mode() === 'signup') {
                  <div class="auth-requirements animate-fade-in">
                    <!-- Min length requirement -->
                    <div class="auth-requirement-item"
                         [class.requirement-success]="passwordHasMinLength()"
                         [class.requirement-error]="passwordBlurred() && !passwordHasMinLength()"
                         [class.requirement-default]="!passwordHasMinLength() && !passwordBlurred()">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        @if (passwordHasMinLength()) {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                        } @else {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                        }
                      </svg>
                      <span>Mínimo 6 caracteres</span>
                    </div>

                    <!-- Uppercase requirement -->
                    <div class="auth-requirement-item"
                         [class.requirement-success]="passwordHasUppercase()"
                         [class.requirement-error]="passwordBlurred() && !passwordHasUppercase()"
                         [class.requirement-default]="!passwordHasUppercase() && !passwordBlurred()">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        @if (passwordHasUppercase()) {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                        } @else {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                        }
                      </svg>
                      <span>Al menos una letra mayúscula</span>
                    </div>

                    <!-- Special symbol requirement -->
                    <div class="auth-requirement-item"
                         [class.requirement-success]="passwordHasSymbol()"
                         [class.requirement-error]="passwordBlurred() && !passwordHasSymbol()"
                         [class.requirement-default]="!passwordHasSymbol() && !passwordBlurred()">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        @if (passwordHasSymbol()) {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                        } @else {
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                        }
                      </svg>
                      <span>Al menos un símbolo especial</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Confirm Password (Only Signup) -->
              @if (mode() === 'signup') {
                <div class="auth-field animate-fade-in">
                  <label for="auth-confirm-password" class="auth-label">Confirmar contraseña</label>
                  <div class="auth-input-wrapper">
                    <!-- Custom Key Icon SVG -->
                    <svg class="auth-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m-3.436-5.844a2 2 0 112.828 2.828L11.828 10H9v3H6v3H3v3H2a1 1 0 01-1-1v-2l8.586-8.586a5 5 0 017.072-7.072z"/>
                    </svg>
                    <input
                      id="auth-confirm-password"
                      [type]="showConfirmPassword() ? 'text' : 'password'"
                      [ngModel]="confirmPassword()"
                      (ngModelChange)="confirmPassword.set($event)"
                      name="confirmPassword"
                      placeholder="Repite tu contraseña"
                      class="auth-input"
                      required
                      autocomplete="new-password"
                      minlength="6" />
                    <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())" class="auth-toggle-password">
                      @if (showConfirmPassword()) {
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                      } @else {
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      }
                    </button>
                  </div>
                </div>
              }
              
              <!-- Terms and Conditions checkbox -->
              @if (mode() === 'signup') {
                <div class="auth-terms animate-fade-in">
                  <label class="auth-terms-label">
                    <input
                      type="checkbox"
                      [ngModel]="acceptTerms()"
                      (ngModelChange)="acceptTerms.set($event)"
                      name="acceptTerms"
                      required
                      class="auth-terms-checkbox" />
                    <span class="auth-terms-text">
                      Acepto que se guarde mi correo electrónico, mi lista de series (series vistas, temporadas, episodios, minutos calculados y valoraciones) y mi lista de series pendientes de forma segura para la sincronización de mi cuenta en la nube.
                    </span>
                  </label>
                </div>
              }

              <!-- Error message -->
              @if (error()) {
                <div class="auth-error animate-fade-in">
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>{{ error() }}</span>
                </div>
              }

              <!-- Submit Button -->
              <button
                type="submit"
                [disabled]="loading()"
                class="auth-submit-btn">
                @if (loading()) {
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                } @else {
                  {{ mode() === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
                }
              </button>
            </form>

            <!-- Divider -->
            <div class="auth-divider">
              <span class="auth-divider-line"></span>
              <span class="auth-divider-text">o</span>
              <span class="auth-divider-line"></span>
            </div>

            <!-- Google Button -->
            <button (click)="loginWithGoogle()" [disabled]="loading()" class="auth-google-btn">
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>
          }
        </div>

        <!-- Footer -->
        <p class="auth-footer">
          Data from <a href="https://www.tvmaze.com/" target="_blank" rel="noopener noreferrer">TVMaze</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      z-index: 9999;
      padding: 1.5rem;
    }

    /* Background (aurora blobs inside the backdrop) */
    .auth-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: -1;
    }
    .auth-blob-1 {
      position: absolute;
      top: -8rem;
      left: 25%;
      width: 40rem;
      height: 40rem;
      background: rgba(244, 63, 94, 0.12);
      border-radius: 9999px;
      filter: blur(120px);
    }
    .auth-blob-2 {
      position: absolute;
      top: 33%;
      right: -8rem;
      width: 36rem;
      height: 36rem;
      background: rgba(59, 130, 246, 0.10);
      border-radius: 9999px;
      filter: blur(120px);
      animation-delay: -6s;
    }
    .auth-blob-3 {
      position: absolute;
      bottom: 0;
      left: 33%;
      width: 32rem;
      height: 32rem;
      background: rgba(245, 158, 11, 0.06);
      border-radius: 9999px;
      filter: blur(120px);
      animation-delay: -12s;
    }
    .auth-grid-overlay {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    .auth-vignette {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.85) 50%, rgb(15,23,42) 100%);
    }

    /* Container */
    .auth-container {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      padding: 1rem;
    }

    /* Logo */
    .auth-logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    .auth-logo-text {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #ffffff 30%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.25rem;
    }
    .auth-logo-subtitle {
      color: rgba(161, 161, 170, 0.8);
      font-size: 0.875rem;
      letter-spacing: 0.05em;
    }

    /* Card */
    .auth-card {
      border-radius: 1.25rem;
      padding: 2rem;
    }

    /* Tabs */
    .auth-tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: 0.75rem;
      background: rgba(255,255,255,0.04);
      margin-bottom: 1.75rem;
    }
    .auth-tab {
      flex: 1;
      padding: 0.625rem 1rem;
      border-radius: 0.625rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: rgba(161,161,170,0.8);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .auth-tab:hover {
      color: rgba(255,255,255,0.8);
    }
    .auth-tab-active {
      background: rgba(255,255,255,0.08);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    /* Form */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .auth-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .auth-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: rgba(161,161,170,0.8);
      letter-spacing: 0.02em;
      padding-left: 0.25rem;
    }

    .auth-field-error {
      color: #fca5a5;
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 0.25rem;
      padding-left: 0.25rem;
    }

    .auth-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .auth-input-icon {
      position: absolute;
      left: 0.875rem;
      width: 1.125rem;
      height: 1.125rem;
      color: rgba(161,161,170,0.5);
      pointer-events: none;
    }

    .auth-input {
      width: 100%;
      padding: 0.75rem 0.875rem 0.75rem 2.75rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.75rem;
      color: #ffffff;
      font-size: 0.9375rem;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    .auth-input::placeholder {
      color: rgba(161,161,170,0.4);
    }
    .auth-input:focus {
      outline: none;
      border-color: rgba(59,130,246,0.5);
      background: rgba(255,255,255,0.06);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
    }
    .auth-input-invalid {
      border-color: rgba(239, 68, 68, 0.4) !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }

    /* Requirements Checklist */
    .auth-requirements {
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-left: 0.25rem;
    }
    .auth-requirement-item {
      font-size: 0.75rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    .requirement-default {
      color: rgba(161, 161, 170, 0.4);
    }
    .requirement-success {
      color: #34d399; /* Green */
    }
    .requirement-error {
      color: #fca5a5; /* Red */
    }

    .auth-toggle-password {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      color: rgba(161,161,170,0.5);
      cursor: pointer;
      padding: 0.25rem;
      transition: color 0.2s;
      display: flex;
      align-items: center;
    }
    .auth-toggle-password:hover {
      color: rgba(255,255,255,0.7);
    }

    /* Error */
    .auth-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.15);
      color: #fca5a5;
      font-size: 0.8125rem;
    }

    /* Success */
    .auth-success {
      text-align: center;
      padding: 1.5rem 1rem;
    }
    .auth-success-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 9999px;
      background: rgba(52,211,153,0.1);
      color: #34d399;
      margin-bottom: 1rem;
    }
    .auth-success-text {
      color: rgba(228,228,231,0.9);
      font-size: 0.9375rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .auth-success-btn {
      display: inline-block;
      padding: 0.625rem 1.5rem;
      background: rgba(59,130,246,0.15);
      border: 1px solid rgba(59,130,246,0.25);
      border-radius: 0.75rem;
      color: #93c5fd;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .auth-success-btn:hover {
      background: rgba(59,130,246,0.25);
      color: #bfdbfe;
    }

    /* Submit button */
    .auth-submit-btn {
      width: 100%;
      padding: 0.8125rem;
      background: #ffffff;
      color: #0f172a;
      border: none;
      border-radius: 0.75rem;
      font-size: 0.9375rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .auth-submit-btn:hover:not(:disabled) {
      background: #e4e4e7;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255,255,255,0.1);
    }
    .auth-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Divider */
    .auth-divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .auth-divider-line {
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.08);
    }
    .auth-divider-text {
      color: rgba(161,161,170,0.5);
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* Google button */
    .auth-google-btn {
      width: 100%;
      padding: 0.75rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem;
      color: #e4e4e7;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .auth-google-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.15);
      transform: translateY(-1px);
    }
    .auth-google-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Footer */
    .auth-footer {
      text-align: center;
      margin-top: 2rem;
      font-size: 0.75rem;
      color: rgba(161,161,170,0.4);
    }
    .auth-footer a {
      color: rgba(161,161,170,0.6);
      text-decoration: none;
      transition: color 0.2s;
    }
    .auth-footer a:hover {
      color: #ffffff;
    }

    /* Terms & Conditions */
    .auth-terms {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      margin-top: 0.25rem;
      padding: 0 0.25rem;
    }
    .auth-terms-label {
      display: flex;
      gap: 0.625rem;
      cursor: pointer;
      align-items: flex-start;
    }
    .auth-terms-checkbox {
      margin-top: 0.2rem;
      accent-color: #3b82f6;
      cursor: pointer;
      width: 1rem;
      height: 1rem;
      border-radius: 0.25rem;
    }
    .auth-terms-text {
      font-size: 0.75rem;
      line-height: 1.4;
      color: rgba(161, 161, 170, 0.7);
    }

    /* Utility */
    .w-4 { width: 1rem; height: 1rem; }
    .w-5 { width: 1.25rem; height: 1.25rem; }
    .shrink-0 { flex-shrink: 0; }
  `]
})
export class AuthComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'login' | 'signup'>('login');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  loading = signal(false);
  error = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  acceptTerms = signal(false);

  // Email validation signals
  emailBlurred = signal(false);
  emailIsValid = computed(() => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(this.email()));

  // Password validation signals
  passwordBlurred = signal(false);
  passwordHasMinLength = computed(() => this.password().length >= 6);
  passwordHasUppercase = computed(() => /[A-Z]/.test(this.password()));
  passwordHasSymbol = computed(() => /[^A-Za-z0-9]/.test(this.password()));

  async onSubmit() {
    if (!this.email() || !this.password()) {
      this.error.set('Por favor, rellena todos los campos.');
      return;
    }

    if (!this.emailIsValid()) {
      this.error.set('Por favor, introduce un correo electrónico válido.');
      return;
    }

    if (this.mode() === 'signup') {
      if (!this.acceptTerms()) {
        this.error.set('Debes aceptar los términos y la política de privacidad para crear tu cuenta.');
        return;
      }

      if (this.password().length < 6) {
        this.error.set('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      
      const hasUppercase = /[A-Z]/.test(this.password());
      const hasSymbol = /[^A-Za-z0-9]/.test(this.password());
      
      if (!hasUppercase) {
        this.error.set('La contraseña para registrarse debe incluir al menos una letra mayúscula.');
        return;
      }
      
      if (!hasSymbol) {
        this.error.set('La contraseña para registrarse debe incluir al menos un símbolo (ej: @, !, #, $, etc.).');
        return;
      }

      if (this.password() !== this.confirmPassword()) {
        this.error.set('Las contraseñas no coinciden. Por favor, compruébalas.');
        return;
      }
    }

    this.loading.set(true);
    this.error.set('');

    try {
      if (this.mode() === 'signup') {
        await this.auth.signup(this.email(), this.password());
        this.successMessage.set(
          '¡Cuenta creada! Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.'
        );
      } else {
        await this.auth.login(this.email(), this.password());
        this.router.navigate(['/']);
      }
    } catch (err: any) {
      this.error.set(this.getErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  loginWithGoogle() {
    this.auth.loginWithGoogle();
  }

  closeAuth() {
    this.router.navigate(['/']);
  }

  private getErrorMessage(err: any): string {
    const msg = err?.json?.msg || err?.json?.error_description || err?.message || '';
    const lower = msg.toLowerCase();

    if (lower.includes('invalid_grant') || lower.includes('invalid login')) {
      return 'Email o contraseña incorrectos.';
    }
    if (lower.includes('email_exists') || lower.includes('already been registered') || lower.includes('already registered')) {
      return 'Este correo electrónico ya está registrado.';
    }
    if (lower.includes('email not confirmed') || lower.includes('confirm')) {
      return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
    }
    if (lower.includes('rate limit') || lower.includes('too many')) {
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }
    if (msg) {
      return msg;
    }
    return 'Ha ocurrido un error. Inténtalo de nuevo.';
  }
}
