import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NavigationService, UserRole } from '../../services/navigation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface RoleOption {
  value: string;
  label: string;
  icon: string;
}

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit, OnDestroy {
  // Tabs
  activeTab: 'login' | 'register' = 'login';

  // Forms
  loginForm!: FormGroup;
  registerForm!: FormGroup;

  // UI State
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  loginError: string | null = null;
  registerError: string | null = null;
  passwordMismatch = false;
  passwordStrength: PasswordStrength = 'weak';

  // Roles
  roles: RoleOption[] = [
    { value: 'patient', label: 'Patient', icon: 'fa-user' },
    { value: 'doctor', label: 'Médecin', icon: 'fa-stethoscope' },
    { value: 'lab', label: 'Technicien Labo', icon: 'fa-flask' },
    { value: 'pharmacy', label: 'Pharmacien', icon: 'fa-pills' },
    { value: 'admin', label: 'Admin', icon: 'fa-shield-alt' },
  ];

  // Destroy subject
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private navService: NavigationService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const tab = params.get('tab');
        this.activeTab = tab === 'register' ? 'register' : 'login';
      });

    // Check if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize reactive forms
   */
  private initializeForms(): void {
    // Login Form
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      role: ['patient', Validators.required],
      rememberMe: [false],
    });

    // Register Form
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
      role: ['patient', Validators.required],
      agreeTerms: [false, Validators.requiredTrue],
    });

    // Listen to password changes for mismatch detection
    this.registerForm.get('confirmPassword')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.checkPasswordMatch());
  }

  /**
   * Switch between login and register tabs
   */
  switchTab(tab: 'login' | 'register'): void {
    this.activeTab = tab;
    this.clearErrors();
    this.resetPasswordFields();
  }

  /**
   * Handle login submission
   */
  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginError = 'Veuillez remplir tous les champs correctement';
      return;
    }

    this.isLoading = true;
    this.loginError = null;

    const { email, password, role, rememberMe } = this.loginForm.value;

    this.authService.login(email, password, role as UserRole, rememberMe)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          // setRole() already navigates to the role-specific home page
          this.navService.setRole(role as UserRole);
        },
        error: (error: any) => {
          this.isLoading = false;
          this.loginError = error.message || 'Erreur de connexion. Vérifiez vos identifiants.';
        }
      });
  }

  /**
   * Handle registration submission
   */
  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerError = 'Veuillez remplir tous les champs correctement';
      return;
    }

    if (this.passwordMismatch) {
      this.registerError = 'Les mots de passe ne correspondent pas';
      return;
    }

    this.isLoading = true;
    this.registerError = null;

    const { firstName, lastName, email, password, role } = this.registerForm.value;

    this.authService.register(firstName, lastName, email, password, role as UserRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          // setRole() already navigates to the role-specific home page
          this.navService.setRole(role as UserRole);
        },
        error: (error: any) => {
          this.isLoading = false;
          this.registerError = error.message || 'Erreur lors de l\'inscription. Veuillez réessayer.';
        }
      });
  }

  /**
   * Toggle password visibility for login
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Toggle confirm password visibility for register
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Check if passwords match
   */
  private checkPasswordMatch(): void {
    const password = this.registerForm.get('password')?.value;
    const confirmPassword = this.registerForm.get('confirmPassword')?.value;
    this.passwordMismatch = password !== confirmPassword && confirmPassword !== '';
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(): void {
    const password = this.registerForm.get('password')?.value || '';

    if (password.length < 8) {
      this.passwordStrength = 'weak';
    } else if (password.length < 12 || !this.hasPasswordVariety(password)) {
      this.passwordStrength = 'fair';
    } else if (password.length < 16 || !this.hasStrongPasswordVariety(password)) {
      this.passwordStrength = 'good';
    } else {
      this.passwordStrength = 'strong';
    }
  }

  /**
   * Check if password has variety (uppercase, lowercase, numbers)
   */
  private hasPasswordVariety(password: string): boolean {
    return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  }

  /**
   * Check if password has strong variety (uppercase, lowercase, numbers, special chars)
   */
  private hasStrongPasswordVariety(password: string): boolean {
    return this.hasPasswordVariety(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
  }

  /**
   * Get password strength percentage
   */
  getPasswordStrengthPercent(): number {
    switch (this.passwordStrength) {
      case 'weak':
        return 25;
      case 'fair':
        return 50;
      case 'good':
        return 75;
      case 'strong':
        return 100;
    }
  }

  /**
   * Get password strength label
   */
  getPasswordStrengthLabel(): string {
    switch (this.passwordStrength) {
      case 'weak':
        return 'Faible';
      case 'fair':
        return 'Moyen';
      case 'good':
        return 'Bon';
      case 'strong':
        return 'Très fort';
    }
  }

  /**
   * Check if a field is invalid and touched
   */
  isFieldInvalid(formName: 'loginForm' | 'registerForm', fieldName: string): boolean {
    const form = formName === 'loginForm' ? this.loginForm : this.registerForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  /**
   * Get error message for a form control
   */
  getErrorMessage(control: AbstractControl | null): string {
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Ce champ est requis';
    }

    if (control.errors['email']) {
      return 'Veuillez entrer une adresse email valide';
    }

    if (control.errors['minlength']) {
      const minLength = control.errors['minlength'].requiredLength;
      return `Le minimum est ${minLength} caractères`;
    }

    if (control.errors['pattern']) {
      return 'Format invalide';
    }

    return 'Erreur de validation';
  }

  /**
   * Clear all errors
   */
  private clearErrors(): void {
    this.loginError = null;
    this.registerError = null;
  }

  /**
   * Reset password fields
   */
  private resetPasswordFields(): void {
    this.showPassword = false;
    this.showConfirmPassword = false;
  }
}