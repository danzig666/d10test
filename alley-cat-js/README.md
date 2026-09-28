# Alley Cat (JavaScript remake)

A browser remake of *Alley Cat*, the 1984 IBM PC game. It keeps the original's
CGA look (black, cyan, magenta and white at 320×200) and its gameplay: climb the
alley, dodge the junk the neighbours throw, jump through open windows, finish the
challenge in each room and win your sweetheart's heart to reach the next level.

This is a clean-room rewrite. No code, graphics or music were taken from the
original `CAT.EXE`. All sprites, the pixel font and the tunes were made for
this project.

## Play

Open `index.html` in any modern browser. It's plain HTML, canvas and JavaScript,
with no build step or server needed.

To get the whole game as a single file you can share:

```sh
node tools/bundle.js            # writes dist/alley-cat.html
```

### Controls

| Key | Action |
| --- | --- |
| ← → / A D | Walk |
| ↑ / W / Space | Jump (swim up in the fishbowl) |
| ↓ / S | Drop through a ledge, drink milk (hold), swim down |
| P / Esc | Pause |
| M | Sound on/off |
| Enter | Start |

On touch screens, on-screen buttons appear under the game.

## How it plays

**The alley.** Hop from the street onto the trash cans, then the fence, then up
the three moving clotheslines. Neighbours open their windows and throw boots,
bottles, clocks and cans at you. A bulldog runs along the street every so often,
but you're safe from him once you're off the ground. Catch the mouse that
scurries along the fence for a bonus. Jump into any **open** window to enter a
room.

**The rooms.** Each window leads to one of five challenges. A broom shows up
when the timer bar runs out and sweeps you back outside.

| Room | Goal |
| --- | --- |
| The Cheese | Catch mice as they pop out of the holes in a giant cheese. |
| The Fishbowl | Jump in from the chair, eat fish, avoid the electric eels and leap out before your air runs out. |
| The Birdcage | Knock the cage off the table, then catch the bird that escapes. |
| The Bulldog | Hold ↓ on each bowl to drink the milk. Hard landings near the sleeping dog make noise, and if it wakes it chases you. |
| The Houseplant | Stop the spiders dropping from the ceiling before they eat every leaf. |

**Your sweetheart.** Finish enough rooms (the hearts in the status bar) and your
sweetheart waits at the top of a tower of drifting heart ledges. Climb up past
the rival toms before the clock runs out. That ends the level, and the next one
is faster and busier.

You start with 4 lives and get an extra life every 10,000 points. The high score
is saved in your browser.

## Code layout

| File | Contents |
| --- | --- |
| `js/engine.js` | Screen, CGA palette, drawing primitives, 5×7 pixel font, sprite builder, keyboard and touch input, Web Audio "PC speaker" sounds |
| `js/sprites.js` | Pixel-art definitions (cats, dog, mice, fish, bird, spiders, junk) |
| `js/cat.js` | The player cat: walking, jumping, one-way platforms, conveyors |
| `js/alley.js` | The alley scene: windows, neighbours, junk, dog, clotheslines |
| `js/rooms.js` | Shared room logic (the broom) and the five rooms |
| `js/love.js` | The sweetheart stage |
| `js/game.js` | Game states, scoring, lives, levels, HUD, transitions, main loop |

The game runs a fixed 60 Hz simulation. `window.AlleyCat` exposes the game object
for debugging, for example `AlleyCat.game.enterRoom('fish')`.
