// One response of the person: the reply it answers, the two lines read by the engine or set by the person.
export type Row = {
  n: number
  key: string
  state: string            // read | reading | not read
  v: string                // accepted | questioned | corrected | rejected
  s: string                // directed | none
  done: boolean            // the person confirmed or changed it
  ask: string              // the person's message, first words
}

// What Claude Code itself counted in this session.
export type Facts = { requests: number; actions: number; refused: number }

// The state of a record request.
export type Job = { busy: boolean; line: string }

declare module 'claude-code' {
  interface PluginState {
    hammerit: {
      rows: Shaped<Row[]>
      sel: number
      fixing: boolean
      facts: Shaped<Facts>
      outputs: string[]
      job: Shaped<Job>
      picking: boolean
      engine: string        // up | down | unknown
      full: boolean
      note: string          // what the last read of the session did, for the pane
    }
  }
}
