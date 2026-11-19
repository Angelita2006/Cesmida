import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#286B4D" />
        <meta name="description" content="Organiza tu despensa, recetas, compras y finanzas." />
        <title>Cesmida</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon-48.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script src="/register-sw.js" defer />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
