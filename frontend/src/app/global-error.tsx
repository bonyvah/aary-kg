"use client";

import { Button } from "@/components/ui/Button";
import { montserratVariables } from "@/fonts/montserrat";
import ky from "../../messages/ky.json";
import ru from "../../messages/ru.json";
import "./globals.css";

/**
 * The root layout itself crashed, so there is no language provider. The texts still come from the
 * message files: both languages are shown, since the player's choice is unknown here.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const messages = [ky.errorPage, ru.errorPage];
  return (
    <html lang="ky" className={montserratVariables}>
      <body>
        <main data-theme="game" className="grid min-h-dvh place-items-center bg-surface p-4 text-center text-ink">
          <div className="flex flex-col items-center gap-6">
            {messages.map((m) => (
              <section key={m.error.title} className="flex flex-col gap-2">
                <h1 className="text-h2 font-bold">{m.error.title}</h1>
                <p className="text-body-lg text-ink-muted">{m.error.description}</p>
              </section>
            ))}
            <Button onClick={reset}>
              {ky.errorPage.retry} / {ru.errorPage.retry}
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
