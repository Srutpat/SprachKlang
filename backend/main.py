from pathlib import Path
import csv
import random
import re
import unicodedata
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


# ============================================================
# PATHS
# ============================================================

# Your actual dataset root
DATASET_ROOT = Path(r"D:\German Project\German_Vocabulary_Dataset")

# CSVs are inside /dataset/<category>/words.csv
CSV_ROOT = DATASET_ROOT / "dataset"

# MP3s are inside /reference_audio/<category>/
AUDIO_ROOT = DATASET_ROOT / "reference_audio"


# ============================================================
# CATEGORY CONFIGURATION
# ============================================================

CATEGORIES = {
    "Phonetics_Practice": {
        "name": "Phonetics Practice",
        "description": "Target German pronunciation sounds",
    },
    "Sem3_GDD_DailyDiscourse": {
        "name": "Sem 3 · Daily Discourse",
        "description": "Routine, weather & health",
    },
    "Sem4_GTP_TechnicalPurposes": {
        "name": "Sem 4 · Technical German",
        "description": "Devices, apps & internet",
    },
    "Sem5_GII_InventionsEnvironment": {
        "name": "Sem 5 · Inventions & Environment",
        "description": "Innovation & sustainability",
    },
    "Sem6_EG_ExploringGermany": {
        "name": "Sem 6 · Exploring Germany",
        "description": "Education & German landmarks",
    },
    "Sem7_GE_Engineers": {
        "name": "Sem 7 · German for Engineers",
        "description": "Interviews & business German",
    },
}


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="SprachKlang API",
    description="German pronunciation practice backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HELPERS
# ============================================================

def normalize_filename(text: str) -> str:
    """
    Normalize Unicode text so filenames containing German characters
    such as ü, ö, ä, ß can be compared safely.
    """
    return unicodedata.normalize("NFC", text).strip()


def find_csv(category: str) -> Optional[Path]:
    """
    Find the words.csv file for a category.
    """
    category_dir = CSV_ROOT / category

    exact_file = category_dir / "words.csv"

    if exact_file.exists():
        return exact_file

    # Fallback: find any CSV inside the category directory
    if category_dir.exists():
        csv_files = list(category_dir.glob("*.csv"))

        if csv_files:
            return csv_files[0]

    return None


def load_words(category: str):
    """
    Load vocabulary records from the category CSV.
    """
    csv_path = find_csv(category)

    if not csv_path:
        return []

    words = []

    try:
        with open(
            csv_path,
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                # Normalize keys
                clean_row = {
                    str(key).strip(): (
                        value.strip() if isinstance(value, str) else value
                    )
                    for key, value in row.items()
                    if key is not None
                }

                word_id = clean_row.get("id", "")
                word = clean_row.get("word", "")

                if not word:
                    continue

                item = {
                    "id": word_id,
                    "word": word,
                    "english": clean_row.get("english", ""),
                    "example_sentence": clean_row.get(
                        "example_sentence", ""
                    ),
                    "ipa": clean_row.get("ipa", ""),
                    "sound_category": clean_row.get(
                        "sound_category", ""
                    ),
                    "minimal_pair_partner": clean_row.get(
                        "minimal_pair_partner", ""
                    ),
                    "note": clean_row.get("note", ""),
                    "category": category,
                }

                words.append(item)

    except Exception as exc:
        print(f"Error reading {csv_path}: {exc}")
        return []

    return words


def find_audio(category: str, word_id: str, word: str) -> Optional[Path]:
    """
    Find matching MP3.

    Expected examples:
        1_über.mp3
        2_Übung.mp3
        3_Tür.mp3
    """

    category_audio_dir = AUDIO_ROOT / category

    if not category_audio_dir.exists():
        return None

    word_id = str(word_id).strip()
    word = normalize_filename(word)

    # Exact expected filename
    exact = category_audio_dir / f"{word_id}_{word}.mp3"

    if exact.exists():
        return exact

    # Case-insensitive fallback
    expected_lower = exact.name.lower()

    for file in category_audio_dir.iterdir():

        if not file.is_file():
            continue

        if file.suffix.lower() != ".mp3":
            continue

        if file.name.lower() == expected_lower:
            return file

    # ID-based fallback
    if word_id:
        pattern = re.compile(
            rf"^{re.escape(word_id)}_.*\.mp3$",
            re.IGNORECASE,
        )

        for file in category_audio_dir.iterdir():

            if not file.is_file():
                continue

            if pattern.match(file.name):
                return file

    return None


def enrich_word(item: dict):
    """
    Add reference audio URL to a word.
    """
    audio = find_audio(
        item["category"],
        item["id"],
        item["word"],
    )

    item = dict(item)

    if audio:
        item["audio_url"] = (
            f"/api/audio/"
            f"{item['category']}/"
            f"{audio.name}"
        )
        item["audio_found"] = True
    else:
        item["audio_url"] = None
        item["audio_found"] = False

    return item


def feedback_for_category(category: str, score: int):
    feedback = {
        "rounded_vowels": (
            "Keep the tongue forward and round the lips carefully "
            "for German ü/ö sounds."
        ),
        "ich_ach": (
            "For ich-Laut, keep the sound soft and forward. "
            "For ach-Laut, the constriction moves farther back."
        ),
        "uvular_r": (
            "Try producing the German r farther back in the throat "
            "rather than using a strong tongue-tip r."
        ),
        "final_devoicing": (
            "German final consonants are often devoiced. "
            "Keep the final sound crisp and unvoiced."
        ),
    }

    if category in feedback:
        return feedback[category]

    if score >= 85:
        return "Very good pronunciation. Keep the same articulation and rhythm."

    if score >= 70:
        return "Good attempt. Listen once more and focus on the target sound."

    return "Try again slowly and pay special attention to the highlighted sound."


# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "name": "SprachKlang API",
        "status": "running",
        "dataset_root": str(DATASET_ROOT),
    }


@app.get("/api/health")
def health():
    csv_exists = CSV_ROOT.exists()
    audio_exists = AUDIO_ROOT.exists()

    category_status = {}

    for category in CATEGORIES:
        csv_path = find_csv(category)

        words = load_words(category)

        audio_dir = AUDIO_ROOT / category

        audio_count = (
            len(list(audio_dir.glob("*.mp3")))
            if audio_dir.exists()
            else 0
        )

        category_status[category] = {
            "csv": str(csv_path) if csv_path else None,
            "word_count": len(words),
            "audio_count": audio_count,
        }

    return {
        "status": "ok",
        "dataset_root": str(DATASET_ROOT),
        "csv_root": str(CSV_ROOT),
        "audio_root": str(AUDIO_ROOT),
        "csv_root_exists": csv_exists,
        "audio_root_exists": audio_exists,
        "categories": category_status,
    }


@app.get("/api/categories")
def get_categories():

    result = []

    for category_id, info in CATEGORIES.items():

        words = load_words(category_id)

        result.append({
            "id": category_id,
            "name": info["name"],
            "description": info["description"],
            "count": len(words),
        })

    return result


@app.get("/api/words")
def get_words(category: str):

    if category not in CATEGORIES:
        return []

    words = load_words(category)

    return [
        enrich_word(word)
        for word in words
    ]


@app.get("/api/word/{category}/{word_id}")
def get_word(category: str, word_id: str):

    words = load_words(category)

    for word in words:

        if str(word["id"]) == str(word_id):
            return enrich_word(word)

    return {
        "error": "Word not found"
    }


@app.get("/api/audio/{category}/{filename}")
def get_audio(category: str, filename: str):

    if category not in CATEGORIES:
        return {
            "error": "Invalid category"
        }

    audio_dir = AUDIO_ROOT / category

    # Security: only use the filename itself
    safe_filename = Path(filename).name

    audio_path = audio_dir / safe_filename

    if not audio_path.exists():
        return {
            "error": "Audio file not found",
            "path": str(audio_path),
        }

    return FileResponse(
        audio_path,
        media_type="audio/mpeg",
        filename=audio_path.name,
    )


@app.post("/api/score")
async def score_audio(
    audio: UploadFile = File(...),
    word_id: str = Form(""),
    category: str = Form(""),
):
    """
    Mock pronunciation scoring endpoint.

    This is intentionally isolated so that the mock scorer can later
    be replaced with Charsiu/wav2vec2 forced alignment.
    """

    # Read uploaded audio so the endpoint genuinely receives it.
    audio_bytes = await audio.read()

    # Prevent unused-variable warnings and make it clear that
    # the audio has reached the backend.
    audio_size = len(audio_bytes)

    words = load_words(category)

    target_word = None

    for word in words:
        if str(word["id"]) == str(word_id):
            target_word = word
            break

    sound_category = ""

    if target_word:
        sound_category = target_word.get(
            "sound_category",
            "",
        )

    # Reasonable demo score
    overall_score = random.randint(68, 94)

    # If a hard sound is identified, make it slightly lower.
    hard_categories = [
        "ü",
        "ö",
        "ich",
        "ach",
        "r",
        "devoicing",
        "final",
    ]

    if any(
        term.lower() in sound_category.lower()
        for term in hard_categories
    ):
        overall_score = random.randint(58, 86)

    # Example phoneme-level breakdown
    phoneme_scores = []

    if target_word and target_word.get("ipa"):

        ipa = target_word["ipa"]

        # Very lightweight demo breakdown.
        phoneme_scores.append({
            "phone": ipa,
            "score": overall_score,
        })

    else:

        phoneme_scores = [
            {
                "phone": "target sound",
                "score": overall_score,
            },
            {
                "phone": "rhythm",
                "score": min(
                    100,
                    overall_score + random.randint(-5, 8),
                ),
            },
        ]

    weak_category = (
        sound_category
        if sound_category
        else "target pronunciation"
    )

    return {
        "overall_score": overall_score,
        "phoneme_scores": phoneme_scores,
        "weak_category": weak_category,
        "feedback": feedback_for_category(
            sound_category.lower(),
            overall_score,
        ),
        "mode": "mock",
        "audio_received": True,
        "audio_bytes": audio_size,
    }


# ============================================================
# STARTUP DIAGNOSTICS
# ============================================================

@app.on_event("startup")
def startup_diagnostics():

    print("")
    print("=" * 60)
    print("SprachKlang Backend")
    print("=" * 60)

    print(f"Dataset root : {DATASET_ROOT}")
    print(f"CSV root     : {CSV_ROOT}")
    print(f"Audio root   : {AUDIO_ROOT}")

    print("")

    if not DATASET_ROOT.exists():
        print("WARNING: Dataset root does not exist!")

    if not CSV_ROOT.exists():
        print("WARNING: CSV root does not exist!")

    if not AUDIO_ROOT.exists():
        print("WARNING: Audio root does not exist!")

    print("")
    print("Category status:")

    for category in CATEGORIES:

        csv_path = find_csv(category)
        words = load_words(category)
        audio_dir = AUDIO_ROOT / category

        audio_count = (
            len(list(audio_dir.glob("*.mp3")))
            if audio_dir.exists()
            else 0
        )

        print(
            f"  {category}: "
            f"{len(words)} words, "
            f"{audio_count} mp3 files"
        )

    print("=" * 60)
    print("")