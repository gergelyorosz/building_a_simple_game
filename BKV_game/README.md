# BKV Game: Catch the 4/6, Make It to BME

Five concepts for a simple, one-thumb tap game set on Budapest's **tram 4/6**,
the yellow Siemens Combinos that run around the Nagykörút (Grand Boulevard).
In every concept the goal is the same: **get to class at BME on time.**

The route is the backbone of all five ideas. Coming from Pest, you ride the
körút through Nyugati, Oktogon, Blaha Lujza tér, Corvin-negyed and Boráros tér,
cross the Petőfi híd, and hop off at **Petőfi híd, budai hídfő** or
**Budafoki út**, a short walk from BME's buildings.

---

## 1. Doors Closing! (reflex / timing)

**Pitch:** The doors are closing, *"Vigyázat, az ajtók záródnak!"* Tap at the
right moment to slip through.

- **Core tap:** A timing bar sweeps back and forth while the doors slide shut.
  Tap inside the green zone to squeeze on. Too early and you bump into the
  crowd. Too late and the doors close on your backpack.
- **Loop:** Each successful boarding moves you one stop down the line. A miss
  sends you to wait for the next tram, which costs minutes on the class clock.
- **Difficulty:** Busier stops like Oktogon and Blaha have narrower green
  zones and more people pushing in front of you.
- **Win:** Reach Petőfi híd, budai hídfő before 8:15 and sprint into the
  lecture hall.
- **Why it works:** One tap, and a two-second rhythm that everyone who has
  ridden the 4/6 recognizes.

## 2. Combino Rush (endless runner along the tram)

**Pitch:** The tram is packed. Run from the back of the 54-metre Combino to the
front door before your stop.

- **Core tap:** Tap to hop over obstacles inside the carriage: shopping bags,
  a sleeping night-shift worker, a stroller, a tourist holding a giant map.
  Hold to duck under backpacks.
- **Loop:** Each carriage section is one "screen". The stop announcement plays
  and a countdown starts, and you must reach an open door before it runs out.
- **Twist:** Ticket inspectors (*ellenőrök*) walk toward you. Grab a validated
  ticket or a student pass pickup to pass them safely.
- **Win:** Get off at Budafoki út with seconds to spare. Your score is how many
  minutes early you arrive.
- **Why it works:** It's a classic runner, but the setting is very local and
  easy to recognize.

## 3. Grab a Seat (tap-to-claim puzzle)

**Pitch:** The ride is long and your legs are tired. Tap free seats before
anyone else takes them, and don't forget to give them up to grannies.

- **Core tap:** A top-down view of the tram interior. Seats open up at each
  stop, and you tap one to claim it before the other passengers do.
- **Rules:** When an elderly passenger or a parent with a child gets on, tap to
  stand up. Doing so earns **karma**. Keeping your seat loses karma and draws
  glares.
- **Energy:** Standing drains stamina. Low stamina means you walk slower from
  the stop to BME, and you might miss the start of class.
- **Win:** Arrive at BME with enough stamina and karma to make it through
  your 8:15 lecture.
- **Why it works:** Short sessions, a small moral dilemma, and a lot of dry
  humour.

## 4. Which Tram? (quick decisions / route planning)

**Pitch:** A 4, a 6, or a tram marked "only to Boráros tér"? Tap the right tram
before it leaves.

- **Core tap:** Trams arrive from both directions with signs on the front.
  Tap only the ones that get you to BME, and do it quickly.
- **Traps:** Trams running in the wrong direction, trams that terminate
  early, a replacement bus (*pótlóbusz*) during track work, and a packed tram
  you *could* board but maybe shouldn't.
- **Clock:** Morning time runs quickly, 7:40 → 8:15. Each wrong choice or
  hesitation costs minutes.
- **Modes:** "Normal morning", "Rainy Monday" (more crowds, more delays),
  and "Night 6", since the 6 runs all night. That mode is about getting home
  from a party in time for a morning exam.
- **Why it works:** Fast, readable decisions, and the traps can be taken from
  real everyday BKV situations.

## 5. Bridge Sprint (rhythm / stop-to-stop tapping)

> ▶️ **Playable browser prototype:** [`bridge_sprint/`](bridge_sprint/). Open `bridge_sprint/index.html`.

**Pitch:** The tram stopped on the Petőfi híd and the doors won't open. Walk
the last stretch to BME by tapping to the beat.

- **Core tap:** Alternate left and right taps to run. Keep a steady rhythm to
  build speed, and mistimed taps make you stumble.
- **Stages:** Board the tram at Nyugati → ride (short tap events: hold the
  handrail on sharp curves, press the stop button in time) → jump off early
  when the tram gets stuck → sprint across the bridge past the Danube → climb
  the stairs of BME's main building.
- **Rewards:** Collect coins, lángos, and *Túró Rudi* along the way for
  power-ups: a speed boost, stamina, or a "professor is also late" skip.
- **Win:** Burst into the lecture hall before the professor closes the door.
- **Why it works:** Several mini-games tied together by one very clear goal:
  **don't be late.**

---

## Quick comparison

| # | Concept          | Core mechanic          | Session length | Build effort |
|---|------------------|------------------------|----------------|--------------|
| 1 | Doors Closing!   | Single timed tap       | 30–60 s        | Low          |
| 2 | Combino Rush     | Tap-to-jump runner     | 1–3 min        | Medium       |
| 3 | Grab a Seat      | Tap-to-claim + choices | 1–2 min        | Low–Medium   |
| 4 | Which Tram?      | Fast tap decisions     | 1–2 min        | Low          |
| 5 | Bridge Sprint    | Rhythm taps + minigames| 2–4 min        | Medium–High  |

**Suggested starting point:** **#1 Doors Closing!** or **#4 Which Tram?**.
Both need only one input and a handful of sprites (tram, doors, stop sign,
clock), and they could be built in Unity alongside the existing scripts in this
repo. The other concepts could later become levels inside the same game.
