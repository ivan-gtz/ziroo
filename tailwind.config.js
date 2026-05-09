
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./context/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: { "50": "#e6f9ef", "100": "#ccefdc", "200": "#99dfb9", "300": "#66d096", "400": "#33c073", "500": "#06c167", "600": "#05ae5d", "700": "#048a4a", "800": "#036738", "900": "#024325", "950": "#012a19" },
                accent: { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f", "950": "#451a03" },
                'pending': '#f59e0b',      // Amber
                'preparing': '#0ea5e9',   // Sky
                'ready': '#06c167',       // New Primary Green
            },
            animation: {
                'bell-ring': 'bell-ring 1s ease-in-out infinite',
                'fade-in': 'fade-in 0.5s ease-out',
                'fade-out': 'fade-out 0.5s ease-in',
                'fly-to-cart': 'fly-to-cart 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
            },
            keyframes: {
                'bell-ring': {
                    '0%, 100%': { transform: 'rotate(0)' },
                    '10%, 30%, 50%, 70%, 90%': { transform: 'rotate(-10deg)' },
                    '20%, 40%, 60%, 80%': { transform: 'rotate(10deg)' },
                },
                'fade-in': {
                    '0%': { opacity: 0 },
                    '100%': { opacity: 1 },
                },
                'fade-out': {
                    '0%': { opacity: 1 },
                    '100%': { opacity: 0 },
                },
                'fly-to-cart': {
                    '0%': {
                        transform: 'translate(-50%, -50%) scale(1)',
                        opacity: 1,
                    },
                    '100%': {
                        top: 'var(--target-y)',
                        left: 'var(--target-x)',
                        transform: 'translate(-50%, -50%) scale(0.2)',
                        opacity: 0.5,
                    }
                }
            },
            fontFamily: {
                'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
                'barcode': ['"Libre Barcode 39"', 'cursive'],
            }
        }
    },
    plugins: [],
}
