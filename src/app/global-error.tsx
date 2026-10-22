"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout. It replaces the whole
 * document, so it must render <html> and <body> and avoid anything that could
 * itself fail (no data fetching).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body className="surface-dark flex min-h-dvh items-center justify-center p-6 text-center">
        <main>
          <h1 className="text-3xl font-semibold">NAV Dental Clinic</h1>
          <p className="mt-4 text-silver-300">Sorry, the website is having a problem. Please try again shortly.</p>
          <p className="mt-2 text-silver-300">
            To book an appointment, call{" "}
            <a href="tel:+918006606001" className="font-semibold text-platinum-100 underline">
              +91 80066 06001
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 min-h-11 rounded-md bg-platinum-100 px-5 font-semibold text-ink-900"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
