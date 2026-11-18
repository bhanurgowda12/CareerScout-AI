# Contributing to CareerScout AI

Thanks for your interest in improving CareerScout AI. Contributions of code, tests, documentation, bug reports, and thoughtful feature ideas are welcome.

## Prerequisites

- Git.
- Python 3.10 or later for the backend.
- Node.js 24.12 or later and npm for the frontend.
- A Firebase project configured for the features you want to exercise. Local Firebase Admin verification uses Google Application Default Credentials.
- Java 21 or later for Firebase emulator tests.

The README's [prerequisites and Firebase setup](README.md#10-prerequisites) describe the services needed by each feature.

## Fork and clone

1. Fork [the original CareerScout AI repository](https://github.com/dileepvgowda18/CareerScout-AI) on GitHub.
2. Clone your fork. This sets your fork as `origin`; add the original repository as `upstream`:

   ```powershell
   git clone https://github.com/YOUR_GITHUB_USERNAME/CareerScout-AI.git
   Set-Location .\CareerScout-AI
   git remote add upstream https://github.com/dileepvgowda18/CareerScout-AI.git
   git remote -v
   ```

Replace `YOUR_GITHUB_USERNAME` with your GitHub username.

## Install dependencies

Install backend dependencies in a virtual environment:

```powershell
Set-Location .\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

In a separate terminal, install frontend dependencies:

```powershell
Set-Location .\frontend
npm ci
```

## Configure environment and Firebase

For the frontend, copy the tracked example configuration and replace its Firebase Web app placeholders:

```powershell
Set-Location .\frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

For the backend, create `backend\.env` (ignored by Git) with the development settings and values needed for your work:

```dotenv
CAREERSCOUT_ENV=development
RATE_LIMIT_STORAGE=memory
FIREBASE_PROJECT_ID=your-firebase-project-id
YOUTUBE_API_KEY=your-restricted-youtube-data-api-key
```

`YOUTUBE_API_KEY` is only needed to exercise YouTube video search. Learning Resources token verification also needs Firebase Admin credentials. For local Application Default Credentials, run:

```powershell
gcloud auth application-default login
```

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file kept outside the repository. Never commit credentials or populated environment files. Vite `VITE_` variables are included in browser code; do not put private secrets in them.

Enable the Firebase Authentication providers and Firebase services used by the features under test. Follow the [README Firebase setup](README.md#112-firebase-project-setup), [environment variable reference](README.md#12-environment-variables), and [emulator instructions](README.md#firebase-emulator-suite) for the full configuration and safe local test options.

## Run frontend and backend locally

Start the backend from the `backend` directory in one terminal:

```powershell
Set-Location .\backend
.\.venv\Scripts\Activate.ps1
$env:CAREERSCOUT_ENV = "development"
$env:RATE_LIMIT_STORAGE = "memory"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend from the `frontend` directory in a second terminal:

```powershell
Set-Location .\frontend
npm run dev
```

Open the local address printed by Vite. The frontend's local API default is `http://127.0.0.1:8000`; the backend health check is at `http://127.0.0.1:8000/api/health`. Memory-based limits are for local development and tests only, not production.

## Create a focused branch

Update your local main branch and create a descriptive branch before making changes:

```powershell
git fetch upstream
git switch main
git merge --ff-only upstream/main
git switch -c feature/short-description
```

Use a branch prefix that describes the work, such as `feature/`, `fix/`, or `docs/`. Keep each change focused and avoid including unrelated edits.

## Coding guidelines

- Follow the existing React, JavaScript, Python, and Markdown style in the files you change.
- Prefer small, focused changes that preserve existing behavior.
- Add or update tests for behavior changes and documentation when the instructions or workflows change.
- Keep user data and credentials out of code, tests, logs, screenshots, and commits. Use synthetic data for tests.
- Treat job match and career scores as evidence-based estimates; do not describe them as hiring predictions.
- Update relevant documentation when setup, behavior, or contributor workflows change.
- Do not add a new formatter, linter, dependency, or test command unless the change requires it and the need is explained.

## Testing requirements

Run the relevant checks for the files you changed. Frontend unit tests:

```powershell
Set-Location .\frontend
npm test
```

Backend tests:

```powershell
Set-Location .\backend
python -m unittest discover -v
```

For frontend build-related changes, configure the required frontend environment values and run:

```powershell
Set-Location .\frontend
npm run build
npm run check:bundle
```

For Firebase rules or browser-flow changes, the repository also provides:

```powershell
Set-Location .\frontend
npx playwright install chromium
npm run test:emulator
npm run test:e2e
```

These emulator-backed suites use the demo-only `demo-careerscout-ai` project and synthetic data; they require Firebase CLI, Java 21 or later, and (for E2E tests) the Playwright Chromium browser. See the [README testing guide](README.md#15-testing-and-validation) before running them. From the repository root, check whitespace and review the final diff:

```powershell
git diff --check
git status --short
git diff
```

Report checks that could not be run and why; do not claim a blocked check passed.

## Commit messages

Use the Conventional Commits style so the purpose of each commit is clear. A typical format is:

```text
<type>: <short imperative description>
```

Common types include `feat`, `fix`, `docs`, `test`, `refactor`, and `chore`. For example:

```text
docs: add contributor setup guide
```

Keep commits focused and avoid including generated output, local environment files, or unrelated formatting changes.

## Open a Pull Request

Push your feature branch to your fork and open a pull request against `main` in the main repository:

```powershell
git add path\to\changed-file
git commit -m "docs: describe your change"
git push -u origin feature/short-description
```

Replace `path\to\changed-file` with the path or paths you intend to stage. In the pull request description:

- Explain the problem and the change.
- Link related issues, if any.
- List the tests and checks you ran, including any that were blocked.
- Include screenshots only when they help explain a user-visible change, and ensure they contain no private data.

## Pull request review

Maintainers review changes for correctness, scope, maintainability, test coverage, security, and documentation. They may request changes or ask clarifying questions. Please respond constructively, make follow-up commits on the same branch, and rerun relevant tests. Merge decisions and timing are at the maintainers' discretion; no review turnaround time is guaranteed.

## Report bugs

Open a [GitHub issue](https://github.com/dileepvgowda18/CareerScout-AI/issues/new) with a concise title and enough detail to reproduce the problem. Include the affected area, expected and actual behavior, reproduction steps, relevant error output, and environment details where useful. Remove credentials, tokens, personal information, and private user data before posting logs or screenshots. For suspected security issues, do not publish exploit details in a public issue; contact the repository maintainers privately through GitHub.

## Suggest features

Open a [GitHub issue](https://github.com/dileepvgowda18/CareerScout-AI/issues/new) describing the user need, the proposed behavior, and relevant use cases. Note trade-offs or alternatives if you have considered them. Feature suggestions are welcome, but an issue does not guarantee that the feature will be implemented.

## Code of Conduct and respectful collaboration

Be welcoming, patient, and respectful. Focus feedback on the work rather than the person; explain disagreements constructively; and respect different backgrounds and experience levels. Harassment, discrimination, personal attacks, and abusive or disruptive behavior are not acceptable. If a conversation becomes uncomfortable, pause and contact the repository maintainers privately through GitHub.
