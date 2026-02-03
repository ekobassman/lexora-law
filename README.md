# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Vercel – Environment variables (admin / server-side)

For admin protection and server-side Supabase (e.g. API routes), set in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon (publishable) key
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (**server-side only**, never expose to client)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` – Full JSON string of the Google Cloud service account key for OCR (**server-side only**). Used by `/api/ocr` and `/api/ocr/ping`. Do not put the JSON file in the repo.

Admin is enforced via `profiles.is_admin = true` (no client trust). Use `requireAdmin(req)` in server-side endpoints.

## OCR (Google Cloud Vision)

OCR runs on Vercel serverless (Node runtime) using **Google Cloud Vision** and credentials from `GOOGLE_APPLICATION_CREDENTIALS_JSON` only (no file path, no other env vars).

**Verification:**

1. **Ping:** Open `GET /api/ocr/ping`. You should see `ok: true`, `hasKey: true`, and `projectIdFromKey` matching your GCP project ID. If `hasKey` is false, the env var is missing or invalid.
2. **OCR:** `POST /api/ocr` with body `{ "base64": "<raw base64 string>", "mimeType": "image/jpeg" }` (or `image/png`, `image/webp`, `application/pdf`) returns `{ "text": "...", "pages"?: number }`. On error: `{ "error": "OCR failed", "details": "..." }`.

The frontend uses a single OCR client (`src/lib/ocrClient.ts`) that calls `/api/ocr`. On Vercel, `/api/ocr` is served by the same origin. For **local dev** (Vite only, no Vercel dev), set `VITE_OCR_API_ORIGIN` in `.env` to your deployed Vercel URL (e.g. `https://your-app.vercel.app`) so OCR requests go to the deployed API.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
