"""Annoyance budget and reward cap: the two limits NEST puts on itself."""
from __future__ import annotations

from dataclasses import dataclass, field

from . import config


@dataclass
class AnnoyanceBudget:
    """How often NEST may interrupt this child. The gap between interruptions is
    learned: it shrinks a little when the child says yes and grows when they say no."""
    gap_min: float = config.BUDGET_GAP_MIN
    max_per_hour: int = config.BUDGET_MAX_PER_HOUR
    history: list[float] = field(default_factory=list)   # session-clock minutes

    def left_this_hour(self, now_min: float) -> int:
        recent = [t for t in self.history if now_min - t < 60]
        return max(0, self.max_per_hour - len(recent))

    def check(self, now_min: float, promised: bool = False) -> tuple[bool, str]:
        if self.left_this_hour(now_min) <= 0:
            return False, f"already interrupted {self.max_per_hour} times in the last hour"
        if not promised and self.history and now_min - self.history[-1] < self.gap_min:
            wait = self.gap_min - (now_min - self.history[-1])
            return False, f"last interruption was {now_min - self.history[-1]:.0f} min ago; waiting {wait:.0f} more"
        return True, "ok"

    def spend(self, now_min: float) -> None:
        self.history.append(now_min)

    def learn(self, outcome: str) -> None:
        factor = {"accepted": 0.85, "extended": 1.0, "declined": 1.5, "ignored": 1.5, "bad_timing": 2.0}.get(outcome, 1.0)
        self.gap_min = round(min(config.BUDGET_GAP_CEIL, max(config.BUDGET_GAP_FLOOR, self.gap_min * factor)), 1)


@dataclass
class Rewards:
    """Sparks for finished quests. Each quest in a day is worth less than the last, there
    is a hard daily cap, and unspent sparks fade. No streaks, no loss aversion."""
    sparks: float = 0.0
    earned_today: float = 0.0
    quests_today: int = 0

    def award(self) -> int:
        self.quests_today += 1
        amount = config.REWARD_BASE / self.quests_today
        amount = max(0.0, min(amount, config.REWARD_DAILY_CAP - self.earned_today))
        amount = int(round(amount))
        self.earned_today += amount
        self.sparks += amount
        return amount

    def new_day(self) -> None:
        self.sparks = round(self.sparks * (1 - config.REWARD_DECAY_PER_DAY), 1)
        self.earned_today = 0.0
        self.quests_today = 0
