# da-violation-app — frontend (noon Minutes)

Single-file React + TypeScript app deployed via CodeSandbox → Netlify.

- `src/App.tsx` — the entire app: login, hourly photo/video upload with a
  chunked + idempotent uploader and an IndexedDB offline retry queue, and a
  role-scoped dashboard.

The backend is a Google Apps Script web app (see `../apps-script/Code.gs`) that
stores files in Drive and rows in a Google Sheet.
