import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'sans-serif'],
      },
      colors: {
        notion: {
          purple:       '#7C3AED',
          'purple-hover': '#6D28D9',
          navy:         '#0F172A',
          'navy-mid':   '#1E293B',
          charcoal:     '#37352F',
          hairline:     '#E5E7EB',
          'hairline-soft': '#F3F4F6',
          'hairline-strong': '#D1D5DB',
          canvas:       '#FFFFFF',
          surface:      '#F7F7F5',
          ink:          '#1A1A1A',
          slate:        '#6B6B6B',
          steel:        '#9B9B9B',
          muted:        '#C7C7C7',
          // pastel card tints
          'tint-peach':   '#FFF7ED',
          'tint-rose':    '#FFF1F2',
          'tint-mint':    '#F0FDF4',
          'tint-lavender':'#F5F3FF',
          'tint-sky':     '#F0F9FF',
          'tint-yellow':  '#FEFCE8',
          'tint-yellow-bold': '#FEF08A',
          'tint-cream':   '#FAFAF5',
        },
      },
      boxShadow: {
        'notion-subtle': '0px 1px 2px 0px rgba(15, 15, 15, 0.04)',
        'notion-card':   '0px 4px 12px 0px rgba(15, 15, 15, 0.08)',
        'notion-hero':   '0px 24px 48px -8px rgba(15, 15, 15, 0.20)',
        'notion-modal':  '0px 16px 48px -8px rgba(15, 15, 15, 0.16)',
      },
      borderRadius: {
        'notion-btn':  '8px',
        'notion-card': '12px',
        'notion-lg':   '16px',
        'notion-xl':   '20px',
      },
    },
  },
  plugins: [],
} satisfies Config;
