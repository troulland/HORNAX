import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hx: {
          bg: {
            primary: '#080A10',
            secondary: '#0D1018',
            card: '#111520',
            elevated: '#161B28',
            border: '#1A1F2E',
          },
          orange: {
            DEFAULT: '#FF6B1A',
            light: '#FF8C42',
            dim: '#3D1F0A',
          },
          blue: {
            DEFAULT: '#2196F3',
            light: '#64B5F6',
            dim: '#0D2840',
          },
          text: {
            primary: '#EEF2FF',
            secondary: '#8892B0',
            muted: '#3D4460',
          },
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
        }
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'orange-glow': '0 0 20px rgba(255, 107, 26, 0.4)',
        'orange-glow-sm': '0 0 10px rgba(255, 107, 26, 0.3)',
        'blue-glow': '0 0 20px rgba(33, 150, 243, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231A1F2E' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-orange': 'pulseOrange 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'glow-in': 'glowIn 1s ease-out forwards',
      },
      keyframes: {
        pulseOrange: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(255, 107, 26, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 107, 26, 0.7)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowIn: {
          from: { opacity: '0', transform: 'scale(0.8)', filter: 'blur(10px)' },
          to: { opacity: '1', transform: 'scale(1)', filter: 'blur(0)' },
        },
      }
    },
  },
  plugins: [],
} satisfies Config
