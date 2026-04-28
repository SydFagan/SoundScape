# SoundScape Mood Map

An interactive web application that responds to your mood. Pick **Calm**, **Focus**,
or **Unwind**, an atmosphere drifts in,
ambient audio, and a small message appears.

---

## File structure

```
soundscape-mood-map/
├── index.html                 ← the page
├── styles/
│   └── style.css              ← all visuals, layout, animations
├── scripts/
│   └── script.js              ← all behavior and logic
├── audio/
│   ├── calm-rain.wav          ← soft rain
│   ├── focus-room.wav         ← warm room
│   └── unwind-wind.wav        ← long wind
└── README.md
```

---

### HTML — the structure

**HTML**
defines _what is on the page_. It's a gorup
of nested elements; a `<header>` that contains an `<h1>`, a `<main>` that
contains `<section>`s, a `<button>` with a `data-mood="calm"` attribute.

### CSS — the styling

**CSS** _how the page looks_. It selects
elements (`.orb`, `#mood-overlay`, `body::before`), applies visual rules
to them; colors, sizes, fonts, spacing, gradients, and animations.

`style.css` does several things at once:

1. **Defines a design system.** At the top of the file, the `:root { … }`
   block declares CSS custom properties (variables) like `--calm-1`,
   `--ink-mute`, `--serif`. Every component refers back to these, so changing
   one variable updates the whole site consistently.
2. **Lays out the page.** CSS Grid and Flexbox handle the structure: the
   `.app` is a 3-row grid (header / main / footer); `.orbs` is a 3-column
   grid that collapses to 1 column on mobile.
3. **Paints the atmosphere.** The backdrop is built with
   `radial-gradient`s on `body::before`. A film-grain SVG is layered on
   `body::after` for organic texture. No needed image file.
4. **Animates the mood orbs.** The `@keyframes pulse` rule makes each orb's
   glow breathe in and out forever. CSS handles this with no JavaScript at all!!
5. **Adapts to the viewport.** The `@media (max-width: 720px)` block
   restructures the layout for phones

### JavaScript — the behavior

**JavaScript** _what happens_. When you click an orb, when an animation runs at exactly the right moment, when an external API
gets called.

---

## How the three languages cooperate, in one click

1. **HTML** has already declared the button: `<button class="orb" data-mood="calm">`.
2. **CSS** has already given that button its visual: a glowing blue gradient
   ball that pulses, hover-scales, and is centered in a grid.
3. **JavaScript** ran on page load and attached a click listener to every
   `.orb`. When you click, JS reads `data-mood="calm"` from the HTML
   and calls `controller.setMood('calm')`.
4. `setMood` does four things:
   - Tells **HTML** `<audio id="audio-calm">` element to play, using JS.
   - Updates **CSS** custom properties on the overlay (`--mood-c1`, `--mood-c2`)
     to switch the gradient color.
   - Uses GSAP (JS animation library) to fade the overlay's CSS
     opacity from 0 to 1 over 1.4 seconds.
   - Calls the Advice Slip API over HTTP, gets a JSON response, and writes
     the text into the HTML `<p id="quote-text">` element.

---

## The JavaScript architecture (object-oriented design)

`Mood` and `MoodController`.
The implementation follows that spec, plus an extra `Atmosphere` class that
handles the drifting particle canvas (which wasn't in the original plan but
turned out to be a clean separation).

### `Mood`

A `Mood` represents one emotional state. It holds:

| `name` | the lookup key — `'calm'`, `'focus'`, `'unwind'` |
| `label` | the display name — `'Calm'`, etc. |
| `palette` | three colors used by the overlay and particles |
| `audio` | a reference to the corresponding `<audio>` element |

And it has these methods:

- `applyVisuals()` — sets the CSS variables on the mood overlay and tells the
  particle system to use this mood's palette. If a different mood is already
  showing, it crossfades smoothly (fade out, swap colors, fade in).
- `startSound(volume)` — calls `.play()` on the audio element and fades the
  volume up over 1.5 seconds using `requestAnimationFrame`.
- `stopSound()` — fades volume down over 0.7 seconds, then pauses the audio.
- `_fadeTo(target, duration, callback)` — internal helper for smooth volume
  fades. (The leading underscore is a convention meaning "this is internal,
  don't call it from outside.")

This matches the original class diagram cleanly: a `Mood` knows how to apply
itself, and that's all.

### `MoodController`

The controller is the brain. It holds the registered moods and
tracks which one is currently active. Its key public methods:

- `register(mood)` — adds a mood to its registry.
- `setMood(name)` — the main user-facing action. Stops any previous mood,
  starts the new one, transitions screens if necessary, and triggers a fresh
  advice fetch.
- `setVolume(v)` — updates the master volume on whichever mood is playing.
- `transitionToActive()` / `transitionToSelection()` — orchestrate the
  GSAP animations that swap between the two main screens.
- `refreshAdvice()` — fetches a new piece of text from the Advice Slip API,
  with a fallback to local mood-appropriate messages if the API is unreachable.

This separation between `Mood` (data + per-instance behavior) and
`MoodController` (system-wide orchestration) is exactly the structure the
project plan called for, and it makes the code easy to extend, adding a
fourth mood is now just one `controller.register(new Mood({…}))` call plus a
new audio file.

### `Atmosphere`

The drifting particles in the background are managed by a small canvas
animator. It holds an array of particles. on every animation frame it moves them, wraps them at screen
edges, and redraws them. When a mood is engaged, the controller calls
`atmosphere.setPalette(mood.palette)`, and the particles take on that mood's
highlight color.

---

## Tools and libraries used

- **HTML5** — page structure, `<audio>` elements for native looping playback.
- **CSS** — custom properties, Grid, Flexbox, `@keyframes`, media queries,
  radial gradients, SVG-data-URL grain texture.
- **Vanilla JavaScript** — classes, `async/await`, `fetch`,
  `requestAnimationFrame`, the Canvas 2D API.
- **GSAP 3.12** — JavaScript animation library, loaded from CDN. Used for
  every screen-level transition (the snappy ease curves are hard to
  reproduce in plain CSS).
- **Google Fonts** — _Fraunces_ (a variable serif used for display text)
  and _DM Sans_ (used for body and UI labels).
- **Advice Slip API** (`api.adviceslip.com`) free public API, returns one
  short reflective sentence per call. No key required.

---

## Possible extensions

- **`localStorage`** for remembering the last selected mood between visits

- A **fourth mood** (e.g. "Spark", bright energy, with upbeat vibes).

- A **personalized AI message** instead of a generic Advice Slip
