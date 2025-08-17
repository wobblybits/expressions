// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

// Get baseURL from environment or config
const baseURL = process.env.NODE_ENV === "production" ? "/expressions" : "";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href={`${baseURL}/favicon.png`} />
          <link rel="icon" type="image/png" sizes="32x32" href={`${baseURL}/favicon-32x32.png`} />
          <link rel="icon" type="image/png" sizes="16x16" href={`${baseURL}/favicon-16x16.png`} />
          <link rel="apple-touch-icon" href={`${baseURL}/apple-touch-icon.png`} />
          <link rel="icon" type="image/png" sizes="192x192" href={`${baseURL}/android-chrome-192x192.png`} />
          <link rel="icon" type="image/png" sizes="512x512" href={`${baseURL}/android-chrome-512x512.png`} />
          
          {assets}
        </head>
        <body>
          <div id="App">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
)); 