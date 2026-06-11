#!/usr/bin/env python3
"""referee.py — deterministic dungeon referee (the reward command).

Replays moves.json against dungeon.json. No randomness anywhere: same moves,
same outcome, every time — that's what makes the grader's re-run ground truth.

Modes:
    python3 referee.py --check    # exit 0 iff the Bone Tyrant is dead and a hero lives
    python3 referee.py --state    # JSON state after replaying current moves (for drivers)
    python3 referee.py            # human-readable battle log + verdict

Rules (summary):
  * Party acts in moves.json order; after each full party round, every living
    enemy in the current room strikes the lowest-HP living hero (fixed damage).
  * Illegal/unknown moves waste the actor's turn (logged, never fatal).
  * Rooms auto-advance when cleared. The spike trap (room 2) damages every hero
    on advance unless the rogue disarmed it. The troll regenerates each round
    unless it took fire damage that round. The Bone Tyrant takes full damage
    only from the rune-blade wielder (others: 1 chip damage) and breathes a
    3-damage wail on all living heroes every enemy turn.
"""

import json
import sys
from pathlib import Path


def load(name):
    return json.loads(Path(name).read_text(encoding="utf-8"))


def lowest_hp_living(heroes):
    living = [h for h in heroes.values() if h["hp"] > 0]
    return min(living, key=lambda h: (h["hp"], h["name"])) if living else None


def run():
    world = load("dungeon.json")
    try:
        moves = load("moves.json")
    except (FileNotFoundError, json.JSONDecodeError):
        moves = []
    if not isinstance(moves, list):
        moves = []

    heroes = {h["name"]: dict(h) for h in world["heroes"]}
    for h in heroes.values():
        h.setdefault("mana", 0)
        h["equipped"] = None
    rooms = world["rooms"]
    log, room_idx = [], 0
    trap_disarmed = False
    burn_this_round = False
    enemies = {}
    items_here = []
    potions = 0

    def enter_room(i):
        nonlocal enemies, items_here
        room = rooms[i]
        enemies = {e["name"]: dict(e) for e in room.get("enemies", [])}
        items_here = list(room.get("items", []))
        log.append(f"== Room {i + 1}: {room['name']} ==")

    def do_advance(actor_name):
        nonlocal room_idx
        if any(e["hp"] > 0 for e in enemies.values()):
            log.append(f"  {actor_name} tries to press on, but enemies block the way — turn wasted")
            return
        if room_idx >= len(rooms) - 1:
            log.append(f"  {actor_name} paces the lair — there is nowhere deeper — turn wasted")
            return
        room = rooms[room_idx]
        if room.get("trap") and not trap_disarmed:
            for h in heroes.values():
                if h["hp"] > 0:
                    h["hp"] -= room["trap"]["damage"]
                    log.append(f"  the {room['trap']['name']} tears into {h['name']} "
                               f"(-{room['trap']['damage']} hp -> {max(h['hp'],0)})")
        room_idx += 1
        enter_room(room_idx)

    def hero_damage(hero, target):
        base = hero["atk"]
        if hero["equipped"] == "rune-blade":
            base += world["items"]["rune-blade"]["atk_bonus"]
        if target.get("boss") and hero["equipped"] != "rune-blade":
            return 1  # the Tyrant's bones shrug off mundane steel
        return base

    enter_room(0)
    party_order = [h["name"] for h in world["heroes"]]
    round_moves = 0

    for mv in moves:
        if not isinstance(mv, dict):
            continue
        actor_name = str(mv.get("actor", ""))
        action = str(mv.get("action", "")).lower().strip()
        target_name = str(mv.get("target", "")).strip()
        hero = heroes.get(actor_name)

        boss_dead = any(e.get("boss") and e["hp"] <= 0 for e in enemies.values())
        if boss_dead:
            break
        if not any(h["hp"] > 0 for h in heroes.values()):
            break

        if hero is None or hero["hp"] <= 0:
            log.append(f"  ({actor_name or '???'} cannot act — turn wasted)")
        elif action == "attack":
            tgt = enemies.get(target_name)
            if tgt is None or tgt["hp"] <= 0:
                log.append(f"  {actor_name} swings at nothing ({target_name!r}) — turn wasted")
            else:
                dmg = hero_damage(hero, tgt)
                tgt["hp"] -= dmg
                log.append(f"  {actor_name} hits {target_name} for {dmg} (-> {max(tgt['hp'],0)})")
        elif action == "firebolt":
            tgt = enemies.get(target_name)
            if hero.get("class") != "wizard":
                log.append(f"  {actor_name} mumbles arcane words to no effect — turn wasted")
            elif hero["mana"] <= 0:
                log.append(f"  {actor_name} is out of mana — turn wasted")
            elif tgt is None or tgt["hp"] <= 0:
                log.append(f"  {actor_name} scorches empty air — turn wasted")
            else:
                hero["mana"] -= 1
                dmg = world["spells"]["firebolt"]["damage"]
                tgt["hp"] -= dmg
                if tgt.get("regenerates"):
                    burn_this_round = True
                log.append(f"  {actor_name} FIREBOLTS {target_name} for {dmg} (-> {max(tgt['hp'],0)}; mana {hero['mana']})")
        elif action == "disarm":
            room = rooms[room_idx]
            if hero.get("class") != "rogue":
                log.append(f"  {actor_name} fiddles with the mechanism and fails — turn wasted")
            elif not room.get("trap") or trap_disarmed:
                log.append(f"  {actor_name} finds nothing to disarm — turn wasted")
            else:
                trap_disarmed = True
                log.append(f"  {actor_name} disarms the {room['trap']['name']}!")
        elif action == "take":
            if target_name in items_here:
                items_here.remove(target_name)
                if target_name == "potion":
                    potions += 1
                    log.append(f"  {actor_name} pockets a potion (party has {potions})")
                else:
                    hero["equipped"] = target_name
                    log.append(f"  {actor_name} takes the {target_name}")
            else:
                log.append(f"  {actor_name} grasps for {target_name!r} but it isn't here — turn wasted")
        elif action == "advance":
            do_advance(actor_name)
        elif action == "use-potion":
            tgt_hero = heroes.get(target_name) or hero
            if potions <= 0:
                log.append(f"  {actor_name} has no potion — turn wasted")
            elif tgt_hero["hp"] <= 0:
                log.append(f"  {actor_name} cannot revive {tgt_hero['name']} — turn wasted")
            else:
                potions -= 1
                heal = world["items"]["potion"]["heal"]
                tgt_hero["hp"] = min(tgt_hero["hp"] + heal, tgt_hero["max_hp"])
                log.append(f"  {actor_name} feeds a potion to {tgt_hero['name']} (+{heal} -> {tgt_hero['hp']})")
        else:
            log.append(f"  {actor_name} hesitates ({action!r}) — turn wasted")

        round_moves += 1

        # Enemy turn after each full party round (fixed party-size cadence).
        if round_moves >= len(party_order):
            burned = burn_this_round
            burn_this_round = False
            for e in enemies.values():
                if e["hp"] <= 0:
                    continue
                if e.get("regenerates") and not burned:
                    e["hp"] = min(e["hp"] + e["regenerates"], e["max_hp"])
                    log.append(f"  {e['name']} knits its flesh back together (+{e['regenerates']} -> {e['hp']})")
                if e.get("aoe"):
                    for h in heroes.values():
                        if h["hp"] > 0:
                            h["hp"] -= e["aoe"]
                    log.append(f"  {e['name']} wails — every hero takes {e['aoe']}")
                else:
                    victim = lowest_hp_living(heroes)
                    if victim:
                        victim["hp"] -= e["atk"]
                        log.append(f"  {e['name']} strikes {victim['name']} for {e['atk']} (-> {max(victim['hp'],0)})")
            round_moves = 0

    boss_dead = any(e.get("boss") and e["hp"] <= 0 for e in enemies.values())
    anyone_alive = any(h["hp"] > 0 for h in heroes.values())
    victory = boss_dead and anyone_alive

    state = {
        "room": room_idx + 1,
        "room_name": rooms[room_idx]["name"],
        "heroes": {n: {"hp": max(h["hp"], 0), "mana": h.get("mana", 0), "equipped": h["equipped"]}
                   for n, h in heroes.items()},
        "enemies_here": {n: max(e["hp"], 0) for n, e in enemies.items()},
        "items_here": items_here,
        "party_potions": potions,
        "trap_disarmed": trap_disarmed,
        "victory": victory,
        "party_wiped": not anyone_alive,
    }
    return victory, log, state


def main(argv):
    victory, log, state = run()
    if "--state" in argv:
        print(json.dumps(state, indent=2))
        return 0
    if "--check" in argv:
        print("VICTORY" if victory else "DEFEAT")
        return 0 if victory else 1
    print("\n".join(log))
    print("VICTORY — the Bone Tyrant falls." if victory else "DEFEAT — the dungeon keeps them.")
    return 0 if victory else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
