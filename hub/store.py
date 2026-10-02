"""Persistence: small JSON files a parent could open and read.

rules.json      family rules
quests.json     quests and their proof
decisions.jsonl one line per Brain decision, with the reason
profile.json    child profile, budget, rewards, interest map
"""
from __future__ import annotations

import json
import shutil
import time
import uuid
from pathlib import Path

from . import config
from .budget import AnnoyanceBudget, Rewards
from .policy import Rule


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class Store:
    def __init__(self, root: Path = config.RUNTIME, persist: bool = True) -> None:
        self.root = root
        self.persist = persist
        self.rules: dict[str, Rule] = {}
        self.quests: dict[str, dict] = {}
        self.decisions: list[dict] = []
        self.profile = {"name": config.CHILD_NAME, "age": config.CHILD_AGE, "companion": config.COMPANION}
        self.budget = AnnoyanceBudget()
        self.rewards = Rewards()
        self.genome: dict[str, dict] = {}
        self.extensions_today = 0
        if persist:
            self.root.mkdir(parents=True, exist_ok=True)
            self._load()

    # --- rules ---
    def put_rule(self, rule: Rule) -> Rule:
        if not rule.id:
            rule.id = new_id("rule")
        self.rules[rule.id] = rule
        self._save("rules")
        return rule

    def delete_rule(self, rule_id: str) -> None:
        self.rules.pop(rule_id, None)
        self._save("rules")

    def active_rules(self) -> list[Rule]:
        return [r for r in self.rules.values() if r.status == "active"]

    # --- quests ---
    def put_quest(self, quest: dict) -> dict:
        self.quests[quest["id"]] = quest
        self._save("quests")
        return quest

    # --- decision log ---
    def log(self, entry: dict) -> dict:
        entry = {"id": new_id("dec"), "ts": time.time(), **entry}
        self.decisions.append(entry)
        if self.persist:
            with (self.root / "decisions.jsonl").open("a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return entry

    def update_decision(self, decision_id: str, **fields) -> dict | None:
        for entry in reversed(self.decisions):
            if entry["id"] == decision_id:
                entry.update(fields)
                self._rewrite_decisions()
                return entry
        return None

    # --- interest map ---
    def note_interest(self, topics: list[str], watched_min: float = 0.0, did: int = 0, made: int = 0,
                      save: bool = True) -> None:
        for topic in topics:
            node = self.genome.setdefault(topic, {"watched_min": 0.0, "did": 0, "made": 0})
            node["watched_min"] = round(node["watched_min"] + watched_min, 4)
            node["did"] += did
            node["made"] += made
        if save:
            self.save_profile()

    def save_profile(self) -> None:
        self._save("profile")

    def reset(self) -> None:
        if self.persist and self.root.exists():
            shutil.rmtree(self.root)
        self.__init__(self.root, self.persist)

    # --- files ---
    def _save(self, which: str) -> None:
        if not self.persist:
            return
        if which == "rules":
            data = [r.model_dump() for r in self.rules.values()]
        elif which == "quests":
            data = [{k: v for k, v in q.items() if k != "photos"} | {"photo_count": len(q.get("photos", []))}
                    for q in self.quests.values()]
        else:
            data = {"profile": self.profile, "gap_min": self.budget.gap_min, "sparks": self.rewards.sparks,
                    "genome": self.genome}
        (self.root / f"{which}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _rewrite_decisions(self) -> None:
        if self.persist:
            with (self.root / "decisions.jsonl").open("w", encoding="utf-8") as f:
                for entry in self.decisions:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _load(self) -> None:
        def read(name: str):
            path = self.root / name
            return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

        for raw in read("rules.json") or []:
            self.rules[raw["id"]] = Rule(**raw)
        saved = read("profile.json")
        if saved:
            self.profile.update(saved.get("profile", {}))
            self.budget.gap_min = saved.get("gap_min", self.budget.gap_min)
            self.rewards.sparks = saved.get("sparks", 0.0)
            self.genome = saved.get("genome", {})
        path = self.root / "decisions.jsonl"
        if path.exists():
            self.decisions = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
