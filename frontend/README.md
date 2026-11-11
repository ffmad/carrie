# Carrie frontend

Vue 3 + Vite + TypeScript PWA (vue-router, Pinia, Supabase). Mobile-first; desktop shows it inside `PhoneFrame`.

- `npm run dev` serves http://localhost:5240 and proxies `/api` to the backend on :3050. `npm run build` type-checks (vue-tsc) then builds.
- `src/views/`: one file per route: `/` Home, `/call` Call, `/family` Family, `/fact/:id` Fact, `/doctor` Doctor.
- `src/stores/`: `circle` (people, viewing as), `call` (live call state machine), `facts`, `voiceNotes`.
- `src/lib/`: `supabase` (client + row mappers), `api`, `recorder`, `speech`, `format`, `demoData` (bundled seed).
- `src/components/`: `CarrieAvatar` is the single swap point for the character; the rest are small UI pieces.
- `src/styles/tokens.css` holds every color, radius, font and spacing; components use only those variables.
- Data: copy `.env.example` to `.env.local` to use Supabase; unset or failing requests fall back to `demoData.ts`.
