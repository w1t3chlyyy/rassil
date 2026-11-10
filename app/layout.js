import Script from 'next/script';
export const metadata={title:'Telegram Group Finder',description:'Find public Telegram groups by topic'};
export default function RootLayout({children}){return <html lang="ru"><head><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive"/></head><body>{children}</body></html>;}
