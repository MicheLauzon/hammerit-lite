# HammerIT lite: Trinity's panel prototype (0.14.0.1)

Functional specification of the changes to the HammerIT lite 0.14.0 Chrome extension.
Branch: `trinity-panel-prototype`. Folder: `extension/`.

## Scope

**Only the user interface changed.**

| File | Changed? | What changed |
|---|---|---|
| `extension/content.js` | Yes | The closed button, the panel layout, placement and the engine-off message |
| `extension/manifest.json` | Yes | Name, version, one new permission (`storage`) |
| `extension/sync.js` | No | Unchanged |
| `extension/background.js` | No | Unchanged |
| Engine, model, adapter | No | Not touched |

**Engine contract is unchanged.** The panel calls the same endpoints with the same bodies: `POST /capture`, `GET /state/{conversation}` and `POST /answer`, all through `background.js` to `127.0.0.1:4333`. The reading words, `rowMessages()`, `wordsOf()`, the answer flow (Yes, "No, I...", Save, change) and the chat-insight rules (`engagement()`, `MIN_LINES = 5`) are unchanged. All existing panel wording is kept. The only new wording is the engine-off message (section 6).

## Install for testing

1. `git fetch origin && git checkout trinity-panel-prototype`
2. `chrome://extensions`: turn on Developer mode and switch off the official HammerIT lite.
3. Click **Load unpacked** and choose the `extension` folder.
4. With the Hammerit Lite app running, open a claude.ai chat and reload the page.

## Changes

### 1. The closed button is a reply ring (replaces the "badge" pill)

- **What you see:** a 60 px round button holding the Hammer H logo (two bars and an oval, as on the HammerAI website), inside a ring of six segments.
- **Segments:** your last six messages that get a reading, oldest at 12 o'clock going clockwise. Each segment takes the reading's existing colour token (`--acc`, `--que`, `--cor`, `--rej`). A message that isn't read yet is `--hollow`. An empty slot is `--line`.
- **The H:** takes the colour of the latest read message. Orange uses a new token `--cor-h` (`#b5770f` light, `#e8b04b` dark), so the H stays readable on white.
- **Purple outer ring:** shown when the latest read message has `steering === 'directed'` (uses `--dir`).
- **States:**
  - the segments pulse while any message is being read (`.hbtn.reading`)
  - a small green dot appears when every reading is answered (`.hbtn.done`, the same rule as the old `b.done`)
  - the ring is all grey when the engine is off
- **Tooltip and aria-label:** "HammerIT", "HammerIT · reading", or "HammerIT · Hammer's model is off".
- **Code:**
  - `ringItems(V)` builds the slot list from `rowMessages(V)` and `wordsOf(row)`
  - `ring(items, px)` returns the SVG
  - `draw()` sets `#bring` and the button's classes
  - the old `#bdisc`, `#bstrip` and `#blabel` elements are gone
- **Hit area:** each segment has a wider, invisible copy (`circle.hit`, `pointer-events="stroke"`) carrying the same `data-go`, so it's easy to hover and click.

### 2. Drag and remembered position (replaces placing the badge next to Share)

- **Default:** the button starts top right, 24 px from the right edge and 68 px from the top.
- **Dragging:** drag it anywhere with the mouse. It is clamped 8 px inside the window. A press that moves less than 5 px counts as a click and opens or closes the panel as before. A real drag never toggles the panel.
- **Remembering:**
  - on release, the position is saved as the distance from the nearer side, `{ side: 'left' | 'right', x, y }`, so it stays put when the window resizes
  - it's stored in `chrome.storage.local` under `hammeritButtonPos` (this needs the new `storage` permission)
  - one position is shared by all conversations
- **Code:** `loadPos()`, `savePos()`, `placeFixed()` (rewritten: it now reads `POS` instead of finding the Share button, and does nothing while dragging), plus `pointerdown`, `pointermove`, `pointerup` and `pointercancel` handlers on the button. `shareButton()` is left in place but no longer used.

### 3. Panel placement follows the button

- **Left or right:** if the button's centre is in the left half of the window, the panel's left edge lines up with the button. Otherwise its right edge does.
- **Below or above:** it opens below the button. If there's no room it opens above. If neither fits, it opens beside the button (left of it on the right side, right of it on the left side), so it never covers the button.
- **During a drag:** the panel moves with the button.
- **Code:** `placePanel()` (rewritten).

### 4. Panel header shows the ring, linked to the rows

- **Header:** a 64 px ring sits to the left of the existing eyebrow, "Hammer this chat" and "HammerIT. Verify your AI record." The Key button is unchanged.
- **The dot strip** below the header is unchanged.
- **Linked highlighting:** pointing at a ring segment, a strip dot or a row highlights the others for the same message:
  - the segment gets thicker (`.seg.hl`)
  - the dot gets bigger (`.d.hl`)
  - the row gets a background (`.row.hl`)
- Clicking a segment jumps to the message through the existing `data-go`, so `goTo()` is unchanged.
- **Code:**
  - rows now carry `data-mi="<message index>"`
  - `setHL(i)` and a `mouseover` listener on the shadow root do the highlighting
  - `panel()` builds the `.phead` header

### 5. Readings waiting for an answer stand out

- **Borders:** rows still waiting for Yes / "No, I..." get a border (`.row.ask`). The first one gets a 2 px accent border and a soft background (`.row.ask.first`). Its Yes / "No, I..." buttons are slightly larger.
- **Order is unchanged:** chronological. The wording is unchanged.
- **Code:** `FIRST_ASK` (worked out in `panel()`), used in `line()`.

### 6. Engine-off message (new wording, approved by Trinity)

- **Replaces** the old developer line ("HammerIT is not running on this machine. Start HammerTest/hammerit_0_9/server.py and reload.").
- **New text:**
  - Hammer's model is off
  - To start it:
    1. Open **Hammerit Lite** from your Applications folder, or press **⌘ Space**, type **Hammerit Lite** and press **Return**.
    2. Nothing opens on screen. It runs quietly in the background, and that's normal.
    3. Click **Check again** below.
- **Check again** resets `lastHash` and `VIEW` and calls `render()` again, using the same requests as before. If the engine still doesn't answer, it shows "Still not answering. Give it a few seconds after opening it, then try again."
- **Code:** `offPanel()`, plus the `#recheck` branch in the panel click handler.

### 7. Progress towards chat insights

- Five small bars sit above the unchanged line "Insights after 5 confirmed lines. N so far." One bar fills for each answered line. The rule is the same `MIN_LINES` and `r.answer` count.
- **Code:** `insights()`, the `.pips` markup.

### 8. Manifest

- `name`: "HammerIT lite (Trinity prototype)", so it can be installed beside the official one
- `version`: 0.14.0.1
- `permissions`: `["storage"]`, only for the button position
- `VERSION` in `content.js`: `0.14.0-trinity.1`, which only affects the console log line

## Not changed

- Reading conversations, the `/capture` and `/state` polling and the four-second re-poll while reading
- The answer flow and its chips
- The Key view
- Stats bars, the insight rules and wording, "Upgrade for the full record"
- `sync.js` (phone and Desktop chats picked up every five minutes)
- Dark mode tokens (plus the one new `--cor-h`)

## Tested

- On a mock claude.ai page with a stand-in engine on a separate port, so nothing went into a real record:
  - engine off, then **Check again** after the stand-in engine started
  - ring colours and the latest-reading H
  - the next-task purple ring
  - dragging and clicking
  - panel placement on the left and right
  - hover linking
  - Yes moving the highlight to the next row and filling the progress bars
- **Not yet tested** on live claude.ai, or with `chrome.storage` (the mock page had no extension context).
