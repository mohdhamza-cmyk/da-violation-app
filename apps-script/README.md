# Apps Script backend

`Code.gs` is the Google Apps Script web app behind the noon Minutes uploader.
Deploy it as a Web App (Execute as: Me; Access: Anyone) and paste the `/exec`
URL into `GOOGLE_SCRIPT_URL` in `frontend/src/App.tsx`.

Endpoints:
- `POST` actions: `addFile`, `addChunk`, `assembleFile`, `finalize`, `logFailed`
- `GET`: `?stores`, `?fileCount`, `?check`, and the dashboard data fetch
