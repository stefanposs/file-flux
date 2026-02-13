import { css } from 'lit';

/**
 * FileFlux Design System Theme
 * Zentrale Farbpalette und Design-Tokens für alle Komponenten
 */
export const theme = css`
  :host {
    /* Primary Colors */
    --ff-primary: #4f46e5;
    --ff-primary-hover: #4338ca;
    --ff-primary-light: #eef2ff;
    --ff-primary-dark: #3730a3;

    /* Secondary Colors */
    --ff-secondary: #06b6d4;
    --ff-secondary-hover: #0891b2;
    --ff-secondary-light: #ecfeff;

    /* Neutral Colors */
    --ff-gray-50: #f9fafb;
    --ff-gray-100: #f3f4f6;
    --ff-gray-200: #e5e7eb;
    --ff-gray-300: #d1d5db;
    --ff-gray-400: #9ca3af;
    --ff-gray-500: #6b7280;
    --ff-gray-600: #4b5563;
    --ff-gray-700: #374151;
    --ff-gray-800: #1f2937;
    --ff-gray-900: #111827;

    /* Status Colors */
    --ff-success: #10b981;
    --ff-success-light: #ecfdf5;
    --ff-warning: #f59e0b;
    --ff-warning-light: #fffbeb;
    --ff-error: #ef4444;
    --ff-error-light: #fef2f2;
    --ff-info: #3b82f6;
    --ff-info-light: #eff6ff;

    /* Sidebar */
    --ff-sidebar-bg: #1e293b;
    --ff-sidebar-text: #94a3b8;
    --ff-sidebar-active: #4f46e5;
    --ff-sidebar-hover: rgba(255, 255, 255, 0.05);

    /* Spacing */
    --ff-spacing-xs: 4px;
    --ff-spacing-sm: 8px;
    --ff-spacing-md: 16px;
    --ff-spacing-lg: 24px;
    --ff-spacing-xl: 32px;

    /* Border Radius */
    --ff-radius-sm: 4px;
    --ff-radius-md: 8px;
    --ff-radius-lg: 12px;

    /* Shadows */
    --ff-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --ff-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --ff-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

    /* Font */
    --ff-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --ff-font-size-xs: 0.75rem;
    --ff-font-size-sm: 0.875rem;
    --ff-font-size-base: 1rem;
    --ff-font-size-lg: 1.125rem;
    --ff-font-size-xl: 1.25rem;
    --ff-font-size-2xl: 1.5rem;
  }
`;
