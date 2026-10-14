import localFont from "next/font/local";

// Self-hosted Montserrat (variable, covers 500/700/900) so builds never need the network.
// One face per subset: the browser falls through the stack glyph by glyph, so Kyrgyz
// letters (ң ө ү) come from the cyrillic-ext face. Files: @fontsource-variable/montserrat (OFL).
// next/font needs literal options, so they are repeated on purpose.

const latin = localFont({
  src: "./montserrat-latin-wght-normal.woff2",
  variable: "--font-montserrat-latin",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
});

const cyrillic = localFont({
  src: "./montserrat-cyrillic-wght-normal.woff2",
  variable: "--font-montserrat-cyrillic",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
});

const cyrillicExt = localFont({
  src: "./montserrat-cyrillic-ext-wght-normal.woff2",
  variable: "--font-montserrat-cyrillic-ext",
  weight: "100 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
});

export const montserratVariables = [latin.variable, cyrillic.variable, cyrillicExt.variable].join(" ");
