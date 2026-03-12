import './globals.css';

export const metadata = {
  title: 'Heard',
  description: 'A space to be heard.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sky-50">
        <div className="mx-auto max-w-[480px] min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
