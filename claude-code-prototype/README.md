# HammerIT for Claude Code

A Claude Code mod: a bar of circles above the prompt and a pane that show how each of your replies was read, let you
confirm or change each reading, and generate the record of the session.

One engine. The mod does no reading itself. It sends the session to the HammerIT lite app on this computer
(127.0.0.1:4333), the same engine, store and record as the Chrome panel. HammerIT lite must be running.

- The bar: one mark per reply of yours. Colour is what you did with the answer (kept, questioned, corrected,
  rejected). A ringed mark means you gave the next task. Key 1 opens the pane.
- The pane: one reading at a time in two lines, Right to confirm, Change or the next task button to change it, the
  strip of every reply, insights after five checked readings, and one line of what Claude Code itself counted
  (requests, AI actions, tool calls refused).
- Hammer it: asks for any readings still unchecked, then builds the light record and opens it in the browser. When
  the AI wrote several files it asks which output you are handing over.

Load it for a session with `claude --plugin-dir <this folder>`.
