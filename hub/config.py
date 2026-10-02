"""All tunables in one place. Every value can be overridden with an environment variable."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DATA = ROOT / "data"
VIDEOS = DATA / "videos"
RUNTIME = Path(os.getenv("PORTAL_RUNTIME", str(DATA / "runtime")))
PROMPTS = Path(__file__).resolve().parent / "prompts"


def _f(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _i(name: str, default: int) -> int:
    return int(os.getenv(name, default))


# --- Local LLM (Ollama). Empty model = pick the best one that is installed. ---
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("PORTAL_MODEL", "")
LLM_TIMEOUT_S = _f("PORTAL_LLM_TIMEOUT_S", 20)

# --- Demo clock: 1 real second of watching counts as DEMO_SPEED session seconds. ---
DEMO_SPEED = _f("PORTAL_DEMO_SPEED", 1)

# --- Drift ---
DRIFT_THRESHOLD = _f("PORTAL_DRIFT_THRESHOLD", 0.5)
DRIFT_WEIGHTS = {"session": 0.35, "short_form": 0.25, "passivity": 0.20, "stillness": 0.20}
SESSION_FULL_MIN = 60      # session term saturates here
STILL_FULL_MIN = 45        # stillness term saturates here
ACTIVE_PER_10_MIN = 2      # this many meaningful interactions per 10 min = "not passive"

# --- Breakpoints (video seconds) ---
BREAKPOINT_LEAD_S = _f("PORTAL_BREAKPOINT_LEAD_S", 2)
BREAKPOINT_LOOKAHEAD_S = _f("PORTAL_BREAKPOINT_LOOKAHEAD_S", 45)

# --- Annoyance budget (session minutes) ---
BUDGET_MAX_PER_HOUR = _i("PORTAL_BUDGET_MAX_PER_HOUR", 3)
BUDGET_GAP_MIN = _f("PORTAL_BUDGET_GAP_MIN", 10)
BUDGET_GAP_FLOOR = 5
BUDGET_GAP_CEIL = 30

# --- Escalation and arguing ---
HOUSE_AFTER_MIN = _f("PORTAL_HOUSE_AFTER_MIN", 45)
MAX_EXTENSIONS_PER_DAY = _i("PORTAL_MAX_EXTENSIONS", 2)
MAX_EXTENSION_MIN = _i("PORTAL_MAX_EXTENSION_MIN", 10)
VOICE_REPLY_TIMEOUT_S = _f("PORTAL_VOICE_REPLY_TIMEOUT_S", 25)   # real seconds
HOUSE_REPLY_TIMEOUT_S = _f("PORTAL_HOUSE_REPLY_TIMEOUT_S", 60)   # real seconds

# --- Rewards: capped and decaying so NEST never becomes the new habit loop ---
REWARD_BASE = 10
REWARD_DAILY_CAP = 20
REWARD_DECAY_PER_DAY = 0.10

# --- SmartThings. No token = simulator only. ---
ST_TOKEN = os.getenv("SMARTTHINGS_TOKEN", "")
ST_LIGHT_IDS = [d for d in os.getenv("SMARTTHINGS_LIGHT_IDS", "").split(",") if d.strip()]
ST_SPEAKER_ID = os.getenv("SMARTTHINGS_SPEAKER_ID", "")
ST_BIRDSONG_URL = os.getenv("SMARTTHINGS_BIRDSONG_URL", "")
ST_BASE = "https://api.smartthings.com/v1"

# --- Child profile defaults (editable from the parent page) ---
CHILD_NAME = os.getenv("PORTAL_CHILD_NAME", "Aarav")
CHILD_AGE = _i("PORTAL_CHILD_AGE", 9)
COMPANION = os.getenv("PORTAL_COMPANION", "Pixel")


def age_mode(age: int) -> str:
    if age <= 7:
        return "explorer"
    if age <= 12:
        return "adventurer"
    return "pilot"
