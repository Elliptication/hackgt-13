# Design backup (before the home page redesign)

Copies of every file the redesign changed, exactly as they were.
Saved as .txt so Next.js and TypeScript ignore them.

To restore one, copy it back over the live file and drop the .txt:

| Backup | Restores |
|---|---|
| home-Hero.tsx.txt | app/(home)/_components/Hero.tsx |
| fonts.ts.txt | lib/fonts.ts |
| root-layout.tsx.txt | app/layout.tsx |
| globals.css.txt | styles/globals.css |
| Button.tsx.txt | components/Button.tsx |
| Footer.tsx.txt | components/Footer.tsx |

New files the redesign added (delete them after restoring):
app/(home)/_components/HomeMap.tsx, app/(home)/_components/HomeMapView.tsx, app/(home)/_components/dotColors.ts

Git also has the old versions: git checkout HEAD -- <file> before you commit.
