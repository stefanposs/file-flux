/**
 * Design Tokens — Zentrale CSS-Variablen als Lit CSSResult.
 *
 * Wird einmal in der App-Shell geladen und von allen Komponenten
 * über CSS Custom Properties konsumiert.
 *
 * Kein Komponent definiert eigene Farben/Schatten/Radien mehr.
 */

import { css } from 'lit';

export const designTokens = css`
  :host {
    /* ── Primärfarben ────────────────────────────── */
    --ff-primary: #4f46e5;
    --ff-primary-hover: #4338ca;
    --ff-primary-light: #eef2ff;
    --ff-primary-dark: #3730a3;

    /* ── Sekundär ────────────────────────────────── */
    --ff-secondary: #06b6d4;
    --ff-secondary-hover: #0891b2;

    /* ── Status ──────────────────────────────────── */
    --ff-success: #10b981;
    --ff-success-light: #ecfdf5;
    --ff-warning: #f59e0b;
    --ff-warning-light: #fffbeb;
    --ff-error: #ef4444;
    --ff-error-light: #fef2f2;
    --ff-info: #3b82f6;
    --ff-info-light: #eff6ff;

    /* ── Grautöne ────────────────────────────────── */
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

    /* ── Oberflächen ─────────────────────────────── */
    --ff-bg: #f9fafb;
    --ff-surface: #ffffff;
    --ff-border: #e5e7eb;

    /* ── Schatten ─────────────────────────────────── */
    --ff-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --ff-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
    --ff-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);

    /* ── Radien ───────────────────────────────────── */
    --ff-radius-sm: 6px;
    --ff-radius-md: 8px;
    --ff-radius-lg: 12px;
    --ff-radius-full: 9999px;

    /* ── Typografie ───────────────────────────────── */
    --ff-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --ff-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

    /* ── Abstände ─────────────────────────────────── */
    --ff-space-xs: 4px;
    --ff-space-sm: 8px;
    --ff-space-md: 16px;
    --ff-space-lg: 24px;
    --ff-space-xl: 32px;
    --ff-space-2xl: 48px;

    /* ── Layout ───────────────────────────────────── */
    --ff-sidebar-width: 240px;
    --ff-sidebar-collapsed: 64px;
    --ff-header-height: 56px;
    --ff-content-max: 1400px;

    /* ── Transition ───────────────────────────────── */
    --ff-transition: 0.2s ease;
  }
`;

/**
 * Gemeinsame Basis-Styles für alle Komponenten.
 * Wird in `static styles` jeder Komponente eingebunden.
 */
export const baseStyles = css`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
`;
