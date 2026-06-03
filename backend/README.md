# ChatDock Backend

Backend API for connecting ChatDock to an existing TrueFoundry tenant.

## Run

```bash
cd backend
npm install
npm run dev
```

The server listens on `http://localhost:4000` by default.

## Endpoints

- `GET /api/health`
- `POST /api/existing-foundry-user/connect`

The existing-user connect endpoint accepts a TrueFoundry control plane URL and a PAT or VAT. Credentials are used only for the current request and are never stored by this backend.
