# SprachKlang — German Pronunciation Lab

A React + FastAPI capstone website for German pronunciation practice. It is designed around the existing `German_Vocabulary_Dataset` shown in the project brief and does **not** regenerate the vocabulary or audio.

## Expected folders

Your existing dataset should remain here:

```text
D:\German Project\German_Vocabulary_Dataset\
├── Phonetics_Practice\
├── Sem3_GDD_DailyDiscourse\
├── Sem4_GTP_TechnicalPurposes\
├── Sem5_GII_InventionsEnvironment\
├── Sem6_EG_ExploringGermany\
├── Sem7_GE_Engineers\
└── reference audio\
    ├── Phonetics_Practice\
    ├── Sem3_GDD_DailyDiscourse\
    ├── Sem4_GTP_TechnicalPurposes\
    ├── Sem5_GII_InventionsEnvironment\
    ├── Sem6_EG_ExploringGermany\
    └── Sem7_GE_Engineers\
```

Create this project separately:

```text
D:\German Project\SprachKlang\
├── backend\
└── frontend\
```

The backend defaults to the dataset path above. If your actual path is different, set the `DATASET_ROOT` environment variable.

## 1. Backend

Open PowerShell:

```powershell
cd "D:\German Project\SprachKlang\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
```

Check the dataset:

- http://localhost:8000/api/health
- http://localhost:8000/api/categories

`/api/health` reports whether the dataset and `reference audio` folders were found and how many CSV rows were loaded.

## 2. Frontend

Open a second PowerShell:

```powershell
cd "D:\German Project\SprachKlang\frontend"
npm install
npm run dev
```

Open the URL Vite prints, normally:

http://localhost:5173

Allow microphone access when Chrome/Edge asks.

## Architecture

```text
React UI
  ├── Home
  ├── Word Bank
  ├── Practice Studio
  ├── Minimal Pairs
  └── Progress
       |
       | REST /api
       v
FastAPI
  ├── CSV loader
  ├── reference audio lookup
  └── POST /api/score
       |
       v
mock scorer (replaceable)
       |
       +----> future Charsiu / wav2vec2 forced alignment
```

## Scoring API contract

```text
POST /api/score
multipart/form-data:
  audio: recording.webm
  word_id: string
  category: string
```

Response:

```json
{
  "overall_score": 82,
  "phoneme_scores": [
    {"phone": "/y/ · ü", "score": 85},
    {"phone": "/ø/ · ö", "score": 79}
  ],
  "weak_category": "Rounded front vowels (ü/ö)",
  "feedback": "...",
  "mode": "mock"
}
```

The mock scorer is intentionally isolated in `backend/main.py` so it can be replaced later by a real Charsiu/wav2vec2 pipeline without changing the frontend.

## Dataset assumptions

Each category has a CSV with at least:

```text
id,word,english,example_sentence
```

The phonetics CSV can additionally have:

```text
ipa,sound_category,minimal_pair_partner,note
```

Reference MP3s are searched using the supplied ID and the naming convention `{id}_{word}.mp3`, with a few safe fallbacks.

## Progress

Practice attempts are stored in browser `localStorage` so the capstone demo needs no account system or database.

## Important

Do not copy the dataset into this repository. Keeping it outside the app makes the project easier to maintain and prevents accidentally committing all MP3 files to Git.
