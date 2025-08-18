// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href={`favicon.png`} />
          <link rel="icon" type="image/png" sizes="32x32" href={`./favicon-32x32.png`} />
          <link rel="icon" type="image/png" sizes="16x16" href={`./favicon-16x16.png`} />
          <link rel="apple-touch-icon" href={`./apple-touch-icon.png`} />
          <link rel="icon" type="image/png" sizes="192x192" href={`./android-chrome-192x192.png`} />
          <link rel="icon" type="image/png" sizes="512x512" href={`./android-chrome-512x512.png`} />
          <title>Expressions</title>
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
          <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "1f83056651704bc6a1123ad767ae30ac"}'></script>
        </body>
      </html>
    )}
  />
)); 