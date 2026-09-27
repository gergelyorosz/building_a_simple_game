# Bridge Sprint (browser prototype of concept #5)

A tap game that runs in the browser: ride tram 6 from Nyugati along the Nagykörút,
get stuck on the Petőfi híd, then sprint across the Danube and up the stairs of
BME's K building before the professor closes the door at **08:15**.

## Play

Open `index.html` in any modern browser. There is no build step and no
dependencies: just `index.html` and `game.js`, drawn on a `<canvas>`.

To play on a phone on the same network, serve the folder:

```sh
cd BKV_game/bridge_sprint
python3 -m http.server 8000
# then open http://<your-computer-ip>:8000 on the phone
```

## Stages

| Stage | What you do | Touch | Keyboard |
|-------|-------------|-------|----------|
| 🚋 Ride (9 stops) | **Hold** during sharp curves, or you fall and lose stamina. **Tap** when the ticket inspector reaches you, or you're fined and lose 2:00. | hold / tap anywhere | hold / press Space |
| 🚪 Stuck on the bridge | Tap when the door button turns **green**. | tap | Space |
| 🏃 Bridge sprint | **Alternate** left and right to run. Tapping the same side twice makes you trip. Jump over pigeons, suitcases and track-works barriers. | bottom-left / bottom-right, top half to jump | ← / →, Space or ↑ to jump |
| 🏛️ BME stairs | Alternate left and right to climb 16 steps. | bottom-left / bottom-right | ← / → |

Pickups on the bridge:

- **Coins:** add to your score
- **Lángos:** +35 stamina (at low stamina your top speed is capped)
- **Túró Rudi:** 4-second speed boost
- **"+2:00" text from the prof:** the professor is running late too, so the deadline moves to 08:17

Score is 1000 for arriving on time, plus 5 per second early, plus 10 per coin.
Your best score is saved in `localStorage`. Press **M** to mute.
