# Fonts

`public/fonts` contains the exact WOFF2 assets already fetched by the original Credit font configuration during the initial successful production build. `app/fonts.css` retains those font-face declarations, Unicode ranges, fallback metrics and family names. Assets are served locally so development and production do not depend on Google Fonts availability or the development font loader.

- Noto Sans SC — https://github.com/notofonts/noto-cjk — SIL Open Font License 1.1.
- Inter — https://github.com/rsms/inter — SIL Open Font License 1.1.
- Geist Mono — https://github.com/vercel/geist-font — SIL Open Font License 1.1.

Full licenses and copyright notices are preserved in the adjacent `FONTS-*-OFL.txt` files. No font binaries were modified.
