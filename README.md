# CareerScout-AI
AI-Based Student Career, Learning and Opportunity Recommendation System

CareerScout AI is a student-focused project for exploring career paths, identifying skill gaps, and getting AI-generated career recommendations. The frontend uses Firebase AI Logic for Gemini recommendations. The Student Profile is saved in the current browser using `localStorage`; it is not saved to Firebase.

## Prerequisites

- Node.js 18 or newer and npm
- Python 3.10 or newer
- A Firebase project that you own or are authorized to use

## Configure Firebase and Gemini

Each developer must create their own `frontend/.env.local` using their own Firebase project's web app configuration. Do not copy another developer's Firebase values, commit this file, or put a Firebase service-account private key in the frontend.

1. Create a Firebase project in the [Firebase console](https://console.firebase.google.com/). Follow the console's prompts for project creation; this project does not enable billing or change Firebase settings automatically.
2. In the project, add a Web app and open its Firebase SDK configuration.
3. In the Firebase console, open **AI Logic** and set up the **Gemini Developer API** backend. The frontend uses Firebase AI Logic's `GoogleAIBackend` and the `gemini-2.5-flash` model. Complete any console setup or terms prompts required for your project. Do not enable billing unless you have reviewed and chosen to do so.
4. From the `frontend` directory, create your private environment file by copying the example:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   On macOS or Linux, use `cp .env.example .env.local` instead. Edit `frontend/.env.local` and replace each placeholder with the matching value from your own Firebase Web app configuration:

   | Environment variable | Firebase Web app field |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   These are Firebase Web app configuration values, not a service-account key. Vite exposes `VITE_` variables to the browser, so use your own project's configuration and never put private server credentials in them.

There is no separate Gemini API key or Gemini environment variable in this code. Gemini access is configured through Firebase AI Logic and the Firebase project selected by the six `VITE_FIREBASE_*` values. No backend environment variable is currently required. Firestore is initialized by the frontend SDK but is not currently used for profile reads or writes; Authentication and Storage are not used by the current app, so no database, sign-in provider, or storage bucket setup is required for its current features. The Student Profile remains local to the browser.

## Install and run

Run the backend in one terminal. From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On macOS or Linux, create/activate the environment with `python3 -m venv .venv` and `source .venv/bin/activate`.

Run the frontend in a second terminal. From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The backend health endpoint is `http://127.0.0.1:8000/api/health`. Restart Vite after creating or changing `.env.local` so it loads the updated values. A correctly configured Firebase project and Firebase AI Logic are required for the Gemini career recommendation workflow.

## Project structure

```text
CareerScout-AI/
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── StudentProfile.jsx
│       ├── ai.js
│       ├── firebase.js
│       ├── main.jsx
│       └── style.css
├── backend/
│   ├── main.py
│   └── requirements.txt
├── .gitignore
└── README.md
```
