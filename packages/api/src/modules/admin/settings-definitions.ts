/**
 * Settings Definitions
 *
 * Single source of truth for all system settings in the admin dashboard.
 * Used for seeding the database and validating setting values at runtime.
 */

export type SettingCategory =
  | 'general'
  | 'branding'
  | 'appearance'
  | 'auth'
  | 'security'
  | 'uploads'
  | 'notifications'
  | 'email'
  | 'api'
  | 'integrations'
  | 'localization'
  | 'backups'
  | 'ai';

export interface SettingDefaultValue {
  key: string;
  value: string;
  category: SettingCategory;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'url' | 'email' | 'json';
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export const SETTINGS_VERSION = 1;

export const SETTINGS_DEFINITIONS: SettingDefaultValue[] = [
  // ---------------------------------------------------------------------------
  // General
  // ---------------------------------------------------------------------------
  {
    key: 'workspace.name',
    value: 'Vellum',
    category: 'general',
    description: 'The display name of your workspace',
    type: 'text',
    validation: { required: true, min: 1, max: 100 },
  },
  {
    key: 'workspace.description',
    value: 'A modern content publishing platform',
    category: 'general',
    description: 'Short description shown in meta tags and emails',
    type: 'textarea',
    validation: { max: 500 },
  },
  {
    key: 'workspace.url',
    value: 'http://localhost:3000',
    category: 'general',
    description: 'The canonical URL of your workspace',
    type: 'url',
    validation: { required: true, pattern: '^https?://' },
  },
  {
    key: 'workspace.timezone',
    value: 'UTC',
    category: 'general',
    description: 'Default timezone for the workspace',
    type: 'text',
    validation: { required: true },
  },
  {
    key: 'workspace.language',
    value: 'en',
    category: 'general',
    description: 'Default language code',
    type: 'text',
    validation: { required: true, pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
  },
  {
    key: 'maintenance.mode',
    value: 'false',
    category: 'general',
    description: 'When enabled, only admins can access the platform',
    type: 'boolean',
  },
  {
    key: 'maintenance.message',
    value: "We'll be right back!",
    category: 'general',
    description: 'Message shown to users during maintenance',
    type: 'textarea',
    validation: { max: 500 },
  },

  // ---------------------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------------------
  {
    key: 'branding.logo_url',
    value: '',
    category: 'branding',
    description: 'URL to your workspace logo',
    type: 'url',
  },
  {
    key: 'branding.favicon_url',
    value: '',
    category: 'branding',
    description: 'URL to your favicon',
    type: 'url',
  },
  {
    key: 'branding.primary_color',
    value: '#6366f1',
    category: 'branding',
    description: 'Primary brand color in hex',
    type: 'text',
    validation: { pattern: '^#([A-Fa-f0-9]{3}){1,2}$' },
  },
  {
    key: 'branding.secondary_color',
    value: '#8b5cf6',
    category: 'branding',
    description: 'Secondary brand color in hex',
    type: 'text',
    validation: { pattern: '^#([A-Fa-f0-9]{3}){1,2}$' },
  },
  {
    key: 'branding.accent_color',
    value: '#ec4899',
    category: 'branding',
    description: 'Accent color for highlights',
    type: 'text',
    validation: { pattern: '^#([A-Fa-f0-9]{3}){1,2}$' },
  },
  {
    key: 'branding.custom_css',
    value: '',
    category: 'branding',
    description: 'Custom CSS injected into the admin dashboard',
    type: 'textarea',
  },

  // ---------------------------------------------------------------------------
  // Appearance
  // ---------------------------------------------------------------------------
  {
    key: 'appearance.default_theme',
    value: 'system',
    category: 'appearance',
    description: 'Default theme: light, dark, or system',
    type: 'text',
    validation: { pattern: '^(light|dark|system)$' },
  },
  {
    key: 'appearance.density',
    value: 'comfortable',
    category: 'appearance',
    description: 'UI density: compact or comfortable',
    type: 'text',
    validation: { pattern: '^(compact|comfortable)$' },
  },
  {
    key: 'appearance.sidebar_collapsed',
    value: 'false',
    category: 'appearance',
    description: 'Whether sidebar starts collapsed',
    type: 'boolean',
  },
  {
    key: 'appearance.font_family',
    value: 'Inter',
    category: 'appearance',
    description: 'Default font family for the dashboard',
    type: 'text',
    validation: { required: true, max: 100 },
  },

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  {
    key: 'auth.allow_signups',
    value: 'true',
    category: 'auth',
    description: 'Whether new users can self-register',
    type: 'boolean',
  },
  {
    key: 'auth.allow_oauth',
    value: 'true',
    category: 'auth',
    description: 'Allow OAuth providers like Google, GitHub',
    type: 'boolean',
  },
  {
    key: 'auth.require_email_verification',
    value: 'true',
    category: 'auth',
    description: 'Require email verification before login',
    type: 'boolean',
  },
  {
    key: 'auth.session_timeout',
    value: '604800',
    category: 'auth',
    description: 'Session timeout in seconds, default 7 days',
    type: 'number',
    validation: { min: 60, max: 2592000 },
  },
  {
    key: 'auth.allowed_domains',
    value: '',
    category: 'auth',
    description: 'Comma-separated list of allowed email domains, empty = all',
    type: 'text',
  },

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  {
    key: 'security.require_2fa',
    value: 'false',
    category: 'security',
    description: 'Require two-factor authentication for all users',
    type: 'boolean',
  },
  {
    key: 'security.min_password_length',
    value: '8',
    category: 'security',
    description: 'Minimum password length',
    type: 'number',
    validation: { min: 8, max: 128 },
  },
  {
    key: 'security.password_complexity',
    value: 'true',
    category: 'security',
    description: 'Require uppercase, lowercase, number, and special char',
    type: 'boolean',
  },
  {
    key: 'security.audit_log_retention',
    value: '90',
    category: 'security',
    description: 'Days to retain audit logs',
    type: 'number',
    validation: { min: 1, max: 3650 },
  },
  {
    key: 'security.rate_limit_enabled',
    value: 'true',
    category: 'security',
    description: 'Enable API rate limiting',
    type: 'boolean',
  },
  {
    key: 'security.max_login_attempts',
    value: '5',
    category: 'security',
    description: 'Max failed login attempts before lockout',
    type: 'number',
    validation: { min: 1, max: 50 },
  },
  {
    key: 'security.lockout_duration',
    value: '900',
    category: 'security',
    description: 'Account lockout duration in seconds, default 15 min',
    type: 'number',
    validation: { min: 60, max: 86400 },
  },

  // ---------------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------------
  {
    key: 'uploads.max_file_size',
    value: '52428800',
    category: 'uploads',
    description: 'Max file size in bytes, default 50MB',
    type: 'number',
    validation: { min: 1, max: 10737418240 },
  },
  {
    key: 'uploads.allowed_types',
    value:
      'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf',
    category: 'uploads',
    description: 'Allowed MIME types',
    type: 'textarea',
    validation: { required: true },
  },
  {
    key: 'uploads.storage_provider',
    value: 'local',
    category: 'uploads',
    description: 'Storage provider: local, s3, or cloudinary',
    type: 'text',
    validation: { pattern: '^(local|s3|cloudinary)$' },
  },
  {
    key: 'uploads.max_storage_per_user',
    value: '1073741824',
    category: 'uploads',
    description: 'Max storage per user in bytes, default 1GB',
    type: 'number',
    validation: { min: 1, max: 1099511627776 },
  },
  {
    key: 'uploads.image_max_dimensions',
    value: '4096',
    category: 'uploads',
    description: 'Max image dimension in pixels',
    type: 'number',
    validation: { min: 64, max: 32768 },
  },

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  {
    key: 'notifications.push_enabled',
    value: 'true',
    category: 'notifications',
    description: 'Enable push notifications',
    type: 'boolean',
  },
  {
    key: 'notifications.email_enabled',
    value: 'true',
    category: 'notifications',
    description: 'Enable email notifications',
    type: 'boolean',
  },
  {
    key: 'notifications.in_app_enabled',
    value: 'true',
    category: 'notifications',
    description: 'Enable in-app notifications',
    type: 'boolean',
  },
  {
    key: 'notifications.digest_frequency',
    value: 'daily',
    category: 'notifications',
    description: 'Digest frequency: none, daily, or weekly',
    type: 'text',
    validation: { pattern: '^(none|daily|weekly)$' },
  },
  {
    key: 'notifications.retention_days',
    value: '30',
    category: 'notifications',
    description: 'Days to retain read notifications',
    type: 'number',
    validation: { min: 1, max: 365 },
  },

  // ---------------------------------------------------------------------------
  // Email
  // ---------------------------------------------------------------------------
  {
    key: 'email.smtp_host',
    value: '',
    category: 'email',
    description: 'SMTP server hostname',
    type: 'text',
  },
  {
    key: 'email.smtp_port',
    value: '587',
    category: 'email',
    description: 'SMTP server port',
    type: 'number',
    validation: { min: 1, max: 65535 },
  },
  {
    key: 'email.smtp_user',
    value: '',
    category: 'email',
    description: 'SMTP username',
    type: 'text',
  },
  {
    key: 'email.smtp_password',
    value: '',
    category: 'email',
    description: 'SMTP password - stored encrypted',
    type: 'text',
  },
  {
    key: 'email.smtp_secure',
    value: 'false',
    category: 'email',
    description: 'Use TLS for SMTP connection',
    type: 'boolean',
  },
  {
    key: 'email.from_address',
    value: 'noreply@vellum.com',
    category: 'email',
    description: 'Default from email address',
    type: 'email',
    validation: { required: true, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  },
  {
    key: 'email.from_name',
    value: 'Vellum',
    category: 'email',
    description: 'Default from display name',
    type: 'text',
    validation: { required: true, max: 100 },
  },

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  {
    key: 'api.rate_limit',
    value: '100',
    category: 'api',
    description: 'API requests per minute per user',
    type: 'number',
    validation: { min: 1, max: 100000 },
  },
  {
    key: 'api.rate_limit_window',
    value: '60',
    category: 'api',
    description: 'Rate limit window in seconds',
    type: 'number',
    validation: { min: 1, max: 3600 },
  },
  {
    key: 'api.max_api_keys',
    value: '5',
    category: 'api',
    description: 'Maximum API keys per user',
    type: 'number',
    validation: { min: 0, max: 100 },
  },
  {
    key: 'api.webhook_timeout',
    value: '30',
    category: 'api',
    description: 'Webhook request timeout in seconds',
    type: 'number',
    validation: { min: 1, max: 300 },
  },
  {
    key: 'api.cors_origins',
    value: '*',
    category: 'api',
    description: 'Comma-separated allowed CORS origins',
    type: 'text',
  },

  // ---------------------------------------------------------------------------
  // Integrations
  // ---------------------------------------------------------------------------
  {
    key: 'integrations.analytics_enabled',
    value: 'false',
    category: 'integrations',
    description: 'Enable analytics tracking',
    type: 'boolean',
  },
  {
    key: 'integrations.sentry_dsn',
    value: '',
    category: 'integrations',
    description: 'Sentry DSN for error tracking',
    type: 'url',
  },
  {
    key: 'integrations.stripe_key',
    value: '',
    category: 'integrations',
    description: 'Stripe API key for payments',
    type: 'text',
  },
  {
    key: 'integrations.slack_webhook',
    value: '',
    category: 'integrations',
    description: 'Slack webhook URL for notifications',
    type: 'url',
  },
  {
    key: 'integrations.google_analytics_id',
    value: '',
    category: 'integrations',
    description: 'Google Analytics tracking ID',
    type: 'text',
  },

  // ---------------------------------------------------------------------------
  // Localization
  // ---------------------------------------------------------------------------
  {
    key: 'localization.default_language',
    value: 'en',
    category: 'localization',
    description: 'Default language code',
    type: 'text',
    validation: { required: true, pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
  },
  {
    key: 'localization.supported_languages',
    value: 'en,fr,es,de,ja,zh',
    category: 'localization',
    description: 'Comma-separated supported language codes',
    type: 'text',
    validation: { required: true },
  },
  {
    key: 'localization.date_format',
    value: 'YYYY-MM-DD',
    category: 'localization',
    description: 'Default date format',
    type: 'text',
    validation: { required: true },
  },
  {
    key: 'localization.currency',
    value: 'USD',
    category: 'localization',
    description: 'Default currency code',
    type: 'text',
    validation: { required: true, pattern: '^[A-Z]{3}$' },
  },
  {
    key: 'localization.number_format',
    value: 'en-US',
    category: 'localization',
    description: 'Default number formatting locale',
    type: 'text',
    validation: { required: true },
  },

  // ---------------------------------------------------------------------------
  // Backups
  // ---------------------------------------------------------------------------
  {
    key: 'backups.enabled',
    value: 'false',
    category: 'backups',
    description: 'Enable automatic database backups',
    type: 'boolean',
  },
  {
    key: 'backups.frequency',
    value: 'daily',
    category: 'backups',
    description: 'Backup frequency: hourly, daily, or weekly',
    type: 'text',
    validation: { pattern: '^(hourly|daily|weekly)$' },
  },
  {
    key: 'backups.retention_days',
    value: '30',
    category: 'backups',
    description: 'Days to retain backups',
    type: 'number',
    validation: { min: 1, max: 3650 },
  },
  {
    key: 'backups.storage_location',
    value: 'local',
    category: 'backups',
    description: 'Backup storage location: local or s3',
    type: 'text',
    validation: { pattern: '^(local|s3)$' },
  },
  {
    key: 'backups.include_uploads',
    value: 'true',
    category: 'backups',
    description: 'Include uploaded files in backups',
    type: 'boolean',
  },

  // ---------------------------------------------------------------------------
  // AI
  // ---------------------------------------------------------------------------
  {
    key: 'ai.enabled',
    value: 'true',
    category: 'ai',
    description: 'Enable AI-powered moderation',
    type: 'boolean',
  },
  {
    key: 'ai.auto_flag',
    value: 'true',
    category: 'ai',
    description: 'Automatically flag content above risk threshold',
    type: 'boolean',
  },
  {
    key: 'ai.auto_resolve',
    value: 'false',
    category: 'ai',
    description: 'Automatically resolve low-risk reports',
    type: 'boolean',
  },
  {
    key: 'ai.risk_threshold_high',
    value: '80',
    category: 'ai',
    description: 'Risk score threshold for high priority, 0-100',
    type: 'number',
    validation: { min: 0, max: 100 },
  },
  {
    key: 'ai.risk_threshold_medium',
    value: '50',
    category: 'ai',
    description: 'Risk score threshold for medium priority, 0-100',
    type: 'number',
    validation: { min: 0, max: 100 },
  },
  {
    key: 'ai.model',
    value: 'gpt-4o-mini',
    category: 'ai',
    description: 'AI model to use for moderation',
    type: 'text',
    validation: { required: true },
  },
  {
    key: 'ai.confidence_threshold',
    value: '0.85',
    category: 'ai',
    description: 'Minimum confidence score for auto-actions',
    type: 'number',
    validation: { min: 0, max: 1 },
  },
];

const CATEGORIES: SettingCategory[] = [
  'general',
  'branding',
  'appearance',
  'auth',
  'security',
  'uploads',
  'notifications',
  'email',
  'api',
  'integrations',
  'localization',
  'backups',
  'ai',
];

export const SETTINGS_BY_CATEGORY: Record<SettingCategory, SettingDefaultValue[]> =
  CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = SETTINGS_DEFINITIONS.filter((s) => s.category === category);
      return acc;
    },
    {} as Record<SettingCategory, SettingDefaultValue[]>,
  );

/**
 * Returns all setting definitions for a given category.
 */
export function getSettingsForCategory(
  cat: SettingCategory,
): SettingDefaultValue[] {
  return SETTINGS_BY_CATEGORY[cat] ?? [];
}

/**
 * Finds a setting definition by its key. Returns null when not found.
 */
export function getSettingByKey(key: string): SettingDefaultValue | null {
  return SETTINGS_DEFINITIONS.find((s) => s.key === key) ?? null;
}

/**
 * Validates a value against its definition's validation rules.
 * Returns `{ valid: true }` on success, or `{ valid: false, error }` on failure.
 * Unknown keys are considered invalid.
 */
export function validateSettingValue(
  key: string,
  value: string,
): { valid: boolean; error?: string } {
  const definition = getSettingByKey(key);
  if (!definition) {
    return { valid: false, error: `Unknown setting key: "${key}"` };
  }

  const { validation, type } = definition;
  const rules = validation ?? {};

  if (rules.required && value.trim() === '') {
    return { valid: false, error: `"${key}" is required` };
  }

  // Booleans must be parseable.
  if (type === 'boolean') {
    if (!/^(true|false)$/i.test(value)) {
      return {
        valid: false,
        error: `"${key}" must be a boolean ("true" or "false")`,
      };
    }
    return { valid: true };
  }

  // Numbers must be numeric and within bounds.
  if (type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return { valid: false, error: `"${key}" must be a valid number` };
    }
    if (rules.min !== undefined && numeric < rules.min) {
      return {
        valid: false,
        error: `"${key}" must be greater than or equal to ${rules.min}`,
      };
    }
    if (rules.max !== undefined && numeric > rules.max) {
      return {
        valid: false,
        error: `"${key}" must be less than or equal to ${rules.max}`,
      };
    }
    return { valid: true };
  }

  // JSON must be parseable.
  if (type === 'json') {
    try {
      JSON.parse(value);
    } catch {
      return { valid: false, error: `"${key}" must be valid JSON` };
    }
    return { valid: true };
  }

  // String-like types: enforce length and pattern rules.
  if (rules.min !== undefined && value.length < rules.min) {
    return {
      valid: false,
      error: `"${key}" must be at least ${rules.min} characters`,
    };
  }
  if (rules.max !== undefined && value.length > rules.max) {
    return {
      valid: false,
      error: `"${key}" must be at most ${rules.max} characters`,
    };
  }
  if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
    return {
      valid: false,
      error: `"${key}" does not match the required format`,
    };
  }

  return { valid: true };
}
