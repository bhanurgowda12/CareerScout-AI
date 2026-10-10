# CareerScout-AI
AI-Based Student Career, Learning and Opportunity Recommendation System

CareerScout AI is a student-focused project for exploring career paths, identifying skill gaps, discovering learning resources, and finding relevant opportunities. This initial version provides a responsive frontend and a small API foundation. Recommendation, AI, and account features are not implemented yet.

## Prerequisites

- Node.js 18 or newer and npm
- Python 3.10 or newer

## Run the frontend

In a terminal, run:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Run the backend

In a separate terminal, run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`; its health endpoint is `http://localhost:8000/api/health`. On macOS or Linux, activate the virtual environment with `source .venv/bin/activate` instead.

## Project structure

```text
CareerScout-AI/
├── frontend/
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── style.css
├── backend/
│   ├── main.py
│   └── requirements.txt
├── .gitignore
└── README.md
```
