import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Facts, Job, Row } from '../types'

// HammerIT for Claude Code, 0.15. One engine: the HammerIT lite app on this computer (127.0.0.1:4333) reads each of
// the person's replies with the local model, keeps the record and builds it. This mod sends the session to it, shows
// the readings in the bar and the pane, takes the person's check of each reading, and asks for the record.
const PANE = 'hammerit'
// prototype: a small pane, like the Chrome panel (dock width / inline height the pane asks for)
const SIZE = { columns: 34, rows: 14 }
const ENGINE = 'http://127.0.0.1:4333'
const HEAD = { 'content-type': 'application/json', 'X-Hammerit-Local': '1' }
const VL: Record<string, string> = { accepted: 'kept it', questioned: 'questioned it', corrected: 'corrected it', rejected: 'rejected it' }
const SHORT: Record<string, string> = { accepted: 'Kept', questioned: 'Questioned', corrected: 'Corrected', rejected: 'Rejected' }
const SL: Record<string, string> = { directed: 'gave the next task', none: 'gave nothing to do' }
const COL: Record<string, string> = { accepted: '#3f9a5a', questioned: '#4f8fd6', corrected: '#d39a2a', rejected: '#c0553f' }
const VWORDS = ['accepted', 'questioned', 'corrected', 'rejected']
const FOLD_V: Record<string, string> = { checked: 'questioned', deferred: 'accepted', none: 'accepted' }
const FOLD_S: Record<string, string> = { selected: 'directed', brainstorm: 'directed', selfcorrect: 'directed' }

const rows = atom({ plugin: 'hammerit', key: 'rows' } as const, [] as Row[], { shape: 'rows-1' })
const sel = atom({ plugin: 'hammerit', key: 'sel' } as const, -1)
const fixing = atom({ plugin: 'hammerit', key: 'fixing' } as const, false)
const facts = atom({ plugin: 'hammerit', key: 'facts' } as const, { requests: 0, actions: 0, refused: 0 } as Facts, { shape: 'facts-1' })
const outputs = atom({ plugin: 'hammerit', key: 'outputs' } as const, [] as string[])
const job = atom({ plugin: 'hammerit', key: 'job' } as const, { busy: false, line: '' } as Job, { shape: 'job-1' })
const picking = atom({ plugin: 'hammerit', key: 'picking' } as const, false)
const engineState = atom({ plugin: 'hammerit', key: 'engine' } as const, 'unknown')
const fullOk = atom({ plugin: 'hammerit', key: 'full' } as const, false)
const note = atom({ plugin: 'hammerit', key: 'note' } as const, '')

const call = async ($: any, method: string, path: string, body?: unknown): Promise<any | null> => {
  try {
    const go = () => $.http.fetch(ENGINE + path, { method, headers: HEAD, body: body === undefined ? undefined : JSON.stringify(body) })
    let r = await go()
    // prototype: an error inside the app (it is running) is tried once more, not shown as 'not running'
    if (!r.ok) { await $.clock.sleep(1500); r = await go() }
    return r.ok ? JSON.parse(r.text) : null
  } catch {
    return null
  }
}

// ---- the session's own log, split into exchanges: one per typed prompt, with the AI's text and what it ran ----
const textOf = (content: any): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.filter(b => b && b.type === 'text').map(b => String(b.text || '')).join('\n') : ''

type Exchange = { ask: string; ai: string[]; actions: string[]; refused: string[] }
// The log is read as it grows: a long session's log passes the 4 MiB one read may return, so it is taken in ranges,
// and only the part added since the last read. Kept in the module, so a reload reads the log once from the start.
const LOG = { path: '', offset: 0, rest: '', ex: [] as Exchange[], cur: null as Exchange | null, names: {} as Record<string, string> }
const CHUNK = 3 * 1024 * 1024
const feed = (line: string) => {
  if (!line.trim()) return
  let r: any
  try { r = JSON.parse(line) } catch { return }
  if (r.isSidechain) return
  const content = (r.message || {}).content
  if (r.type === 'user' && !r.isMeta) {
    const results = Array.isArray(content) ? content.filter((b: any) => b && b.type === 'tool_result') : []
    if (results.length) {
      for (const b of results) {
        const body = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '').slice(0, 400)
        // Claude Code's own words for a call the person turned down, at the start of an error result; never matched inside a tool's output
        if (LOG.cur && b.is_error === true && /^\s*(The user doesn't want to proceed|\[Request interrupted by user for tool use)/.test(body)) LOG.cur.refused.push(LOG.names[b.tool_use_id] || 'a tool call')
      }
      return
    }
    const ask = textOf(content).trim()
    if (!ask || (ask.startsWith('<') && ask.endsWith('>'))) return
    LOG.cur = { ask, ai: [], actions: [], refused: [] }
    LOG.ex.push(LOG.cur)
  } else if (r.type === 'assistant' && LOG.cur && Array.isArray(content)) {
    for (const b of content) {
      if (b.type === 'text' && String(b.text || '').trim()) LOG.cur.ai.push(String(b.text))
      else if (b.type === 'tool_use') {
        const inp = b.input || {}
        const what = String(inp.command || inp.file_path || inp.description || '').replace(/\s+/g, ' ').slice(0, 90)
        LOG.names[b.id] = `${b.name}: ${what}`
        LOG.cur.actions.push(`${b.name}: ${what}`)
      }
    }
  }
}
const readLog = async ($: any): Promise<Exchange[]> => {
  const path = String((await $.session.info()).transcriptPath || '')
  if (!path) return []
  const { size } = await $.fs.stat(path)
  if (path !== LOG.path || size < LOG.offset) Object.assign(LOG, { path, offset: 0, rest: '', ex: [], cur: null, names: {} })
  while (LOG.offset < size) {
    const length = Math.min(CHUNK, size - LOG.offset)
    const text = LOG.rest + String(await $.fs.read(path, { offset: LOG.offset, length }))
    LOG.offset += length
    const lines = text.split('\n')
    LOG.rest = lines.pop() ?? ''
    for (const line of lines) feed(line)
  }
  return LOG.ex
}
// What goes to the engine: the person's message, then the reply as the list of what the AI ran and its text.
const messagesOf = (ex: Exchange[]) => {
  const out: { i: number; who: string; text: string }[] = []
  let i = 0
  for (const e of ex) {
    out.push({ i: i++, who: 'you', text: e.ask })
    const acts = e.actions.length
      ? `[The AI took ${e.actions.length} ${e.actions.length === 1 ? 'action' : 'actions'}]\n` + e.actions.slice(0, 30).map(a => `- ${a}`).join('\n') +
        (e.actions.length > 30 ? `\n- and ${e.actions.length - 30} more` : '') +
        (e.refused.length ? '\n' + e.refused.map(a => `- Refused by the person: ${a}`).join('\n') : '')
      : ''
    const reply = [acts, e.ai.join('\n\n')].filter(Boolean).join('\n\n')
    if (reply) out.push({ i: i++, who: 'claude', text: reply })
  }
  return out
}

const toRows = (view: any): Row[] =>
  (view?.rows || []).filter((r: any) => r.key).map((r: any) => {
    const a = r.answer
    const v = String((a && a.verification) || r.verification || '')
    const s = String((a && a.steering) || r.steering || '')
    return { n: r.n, key: r.key, state: r.state || 'reading', v: FOLD_V[v] || v, s: FOLD_S[s] || s, done: !!a, ask: String(r.ask || '').replace(/\s+/g, ' ').slice(0, 160) }
  })

const conv = async ($: any) => 'cc-' + String(await $.session.id())
const take = async ($: any, view: any) => {
  if (!view) { await update($, engineState, () => 'down'); return false }
  await update($, engineState, () => 'up')
  await update($, fullOk, () => !!view.full)
  const before = (await read($, rows)).length
  const now = toRows(view)
  await update($, rows, () => now)
  if (now.length > before) { await update($, sel, () => -1); await update($, fixing, () => false) }   // a new reply of the person: the card follows it
  return (view.rows || []).some((r: any) => r.state === 'reading')
}
// Send the session as it stands, then follow the readings until the engine has read every reply.
// One at a time: the start of the session, a message sent and the end of a turn can all ask for it at once, and two
// readers of the log at the same moment would feed its lines twice.
let chain: Promise<void> = Promise.resolve()
const sync = ($: any): Promise<void> => (chain = chain.then(() => syncOnce($)).catch(() => {}))
const syncOnce = async ($: any) => {
  let ex: Exchange[] = []
  try { ex = await readLog($) } catch (x) { await update($, note, () => 'The session log could not be read: ' + String((x as Error).message || x).slice(0, 120)); return }
  const msgs = messagesOf(ex)
  if (!msgs.length) { await update($, note, () => 'No messages found in the session log yet.'); return }
  const c = await conv($)
  let reading = await take($, await call($, 'POST', '/capture', { conversation: c, url: 'claude-code', live: true, tool: 'Claude Code', facts: await read($, facts), messages: msgs }))
  for (let k = 0; reading && k < 40; k++) {
    await $.clock.sleep(2500)
    reading = await take($, await call($, 'GET', `/state/${c}`))
  }
  const got = await read($, rows)
  await update($, note, () => `${ex.length} messages of yours in the log · ${got.filter(r => r.state === 'read').length} replies read${reading ? ' · still reading' : ''}`)
}
const answer = async ($: any, body: Record<string, unknown>) => {
  await take($, await call($, 'POST', '/answer', { conversation: await conv($), ...body }))
  await update($, fixing, () => false)
}

const grade = (list: Row[]): string[] | null => {
  const k = list.length
  if (k < 5) return null
  const q = list.filter(r => r.v === 'questioned').length / k
  const c = list.filter(r => r.v === 'corrected' || r.v === 'rejected').length / k
  const d = list.filter(r => r.s === 'directed').length / k
  const depth = c > 0 && d >= 0.75 ? 'Rigorous' : c > 0 && d >= 0.5 ? 'Deliberate' : (q > 0 || c > 0) && d > 0 ? 'Attentive' : q > 0 || c > 0 || d > 0 ? 'Light' : 'Passive'
  const reasoning = c > 0 && d >= 0.5 ? 'Your reasoning' : (q > 0 || c > 0) && d >= 0.5 ? 'Shared reasoning' : 'AI reasoning'
  const loop = c > 0 && d >= 0.75 ? 'In command' : c > 0 && d >= 0.5 ? 'In the loop' : c > 0 || d >= 0.5 ? 'On the loop' : 'Out of the loop'
  return [depth, reasoning, loop]
}
const glyph = (r: Row) => (r.state !== 'read' ? '◌' : r.s === 'directed' ? '◉' : '●')
const tone = (r: Row) => (r.state !== 'read' ? '#8a949e' : COL[r.v] || '#8a949e')
const nameOf = (f: string) => f.replace(/^.*\//, '')

// The record: the light record on this computer, or the full record where this computer can make one.
const record = async ($: any, kind: 'light' | 'full', file: string | null) => {
  const list = (await read($, rows)).filter(r => r.state === 'read')
  const todo = list.filter(r => !r.done)
  await update($, picking, () => false)
  await update($, job, () => ({ busy: true, line: kind === 'full' ? 'Writing the full record, about a minute.' : 'Building the record.' }))
  let output: Record<string, string> | undefined
  if (file) {
    let sha = ''
    try { sha = String((await $.process.run(['shasum', '-a', '256', file])).stdout || '').split(' ')[0] ?? '' } catch {}
    output = { name: nameOf(file), sha256: sha, basis: 'written' }
  }
  const c = await conv($)
  let j = await call($, 'POST', '/record', { conversation: c, kind, consent: kind === 'full', output })
  for (let k = 0; j && j.state === 'working' && k < 60; k++) {
    await $.clock.sleep(4000)
    j = await call($, 'GET', `/record_state/${c}`)
  }
  if (j && j.state === 'done') {
    const url = `${ENGINE}/record/${j.name}.${j.pdf ? 'pdf' : 'html'}`
    try { await $.process.run(['open', url]) } catch {}
    await update($, job, () => ({ busy: false, line: `Record opened in your browser. ${j.status}.${todo.length ? ` ${todo.length} of your readings were not checked, and the record says so.` : ''}` }))
  } else {
    await update($, job, () => ({ busy: false, line: 'The record could not be made' + (j && j.error ? ': ' + j.error : '. Is HammerIT lite running?') }))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, job, () => ({ busy: false, line: '' }))
    await update($, picking, () => false)
    try {
      await $.command.register({ name: 'hammerit-panel', description: 'Show the HammerIT pane for this session' })
    } catch {}
    void sync($)

    return next(e)
  })

  on('command.run', { command: 'hammerit-panel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'HammerIT', ...SIZE })
    void sync($)

    return { text: 'HammerIT pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, facts, f => ({ ...f, requests: f.requests + 1 }))
    // read the message just sent while the AI works, without waiting for the end of its turn
    void (async () => { try { await $.clock.sleep(2000); await sync($) } catch {} })()

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const written = e.tool === 'Write' || e.tool === 'Edit' ? String((e as unknown as { file_path?: string }).file_path || '') : ''
    const ran = await next(e)
    const refused = ran.deny !== undefined
    await update($, facts, f => ({ ...f, actions: f.actions + 1, refused: f.refused + (refused ? 1 : 0) }))
    if (written && !refused && ran.isError !== true) await update($, outputs, list => [written, ...list.filter(f => f !== written)].slice(0, 12))

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    void sync($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const list = await read($, rows)
    const { Box, Button, Text } = $.ui.resolve(e)
    if (await read($, engineState) === 'down') return <Box gap={1}><Text dimColor>HammerIT is off · open Hammerit Lite, then send a message</Text></Box>
    const todo = list.filter(r => r.state === 'read' && !r.done).length
    // neighbours of one colour are drawn as one piece of text: a long session stays a small tree, inside the band's limits
    const runs: { c: string; t: string }[] = []
    for (const r of list.slice(-36)) {
      const c = tone(r), last = runs[runs.length - 1]
      if (last && last.c === c) last.t += glyph(r) + ' '
      else runs.push({ c, t: glyph(r) + ' ' })
    }

    return (
      <Box gap={1}>
        <Text dimColor>HammerIT</Text>
        <Text>{runs.map(x => <Text color={x.c}>{x.t}</Text>)}</Text>
        {todo > 0 && <Text dimColor>{todo} to check</Text>}
        <Button key="open" hotkey="1" label="Open" plain onPress={() => { void $.ui.open({ id: PANE, title: 'HammerIT', ...SIZE }) }} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const up = await read($, engineState)
    const f = await read($, facts)
    const j = await read($, job)
    const files = await read($, outputs)
    const pick = await read($, picking)
    const fix = await read($, fixing)
    const canFull = await read($, fullOk)
    const readRows = list.filter(r => r.state === 'read')
    const todo = readRows.filter(r => !r.done)
    const chosen = await read($, sel)
    const cur = list.find(r => r.n === chosen) || list[list.length - 1]
    const at = cur ? list.indexOf(cur) : -1
    const words = grade(readRows)
    const checked = readRows.filter(r => r.done).length
    const last = await read($, note)
    const go = (n: number) => { void update($, sel, () => n); void update($, fixing, () => false) }
    const start = (kind: 'light' | 'full') => {
      if (files.length <= 1) void record($, kind, files[0] ?? null)
      else void update($, picking, () => true)
    }

    if (up === 'down') {
      return (
        <Box flexDirection="column">
          <Text bold>HammerIT</Text>
          <Text dimColor>HammerIT lite is not running on this computer.</Text>
          <Text dimColor>Open Hammerit Lite from Applications, then send a message.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text bold>HammerIT</Text>
        <Text dimColor>{readRows.length} of your replies read · {todo.length ? `${todo.length} to check` : readRows.length ? 'all checked' : 'reply to an answer to start'}</Text>
        <Text> </Text>
        {cur && cur.state === 'read' && (
          <Box flexDirection="column">
            <Text><Text color={tone(cur)}>{glyph(cur)} </Text><Text bold>You {VL[cur.v] || cur.v}.</Text></Text>
            <Text>{'  '}<Text bold>You {SL[cur.s] || cur.s}.</Text>{cur.done ? <Text color="success">{'  '}✓ checked</Text> : null}</Text>
            <Text dimColor>{'  '}“{cur.ask}”</Text>
            <Box gap={1}>
              {!cur.done && <Button key="ok" hotkey="y" label="✓ Right" variant="primary" onPress={() => { void answer($, { key: cur.key, choice: 'accept' }) }} />}
              <Button key="chg" hotkey="c" label={fix ? 'Cancel' : 'Change'} plain onPress={() => { void update($, fixing, x => !x) }} />
              <Button key="flip" hotkey="t" label={cur.s === 'directed' ? 'No next task' : 'Gave next task'} plain onPress={() => { void answer($, { key: cur.key, choice: 'refuse', verification: cur.v, steering: cur.s === 'directed' ? 'none' : 'directed' }) }} />
            </Box>
            {fix && (
              <Box gap={1}>
                {VWORDS.map(w => <Button key={`v-${w}`} label={SHORT[w]} plain onPress={() => { void answer($, { key: cur.key, choice: 'refuse', verification: w, steering: cur.s }) }} />)}
              </Box>
            )}
          </Box>
        )}
        {cur && cur.state !== 'read' && <Text dimColor>◌ {cur.state === 'reading' ? 'Being read.' : 'Not read.'} “{cur.ask}”</Text>}
        {list.length > 0 && (
          <Box gap={1}>
            <Button key="prev" hotkey="e" label="‹ Earlier" plain onPress={() => { if (at > 0) go(list[at - 1]!.n) }} />
            <Button key="next" hotkey="l" label="Later ›" plain onPress={() => { if (at >= 0 && at < list.length - 1) go(list[at + 1]!.n) }} />
            {todo.length > 0 && <Button key="todo" hotkey="n" label={`Next to check (${todo.length})`} plain onPress={() => { go((todo.find(r => !cur || r.n > cur.n) || todo[0]!).n) }} />}
          </Box>
        )}
        <Text> </Text>
        <Text>{list.slice(-60).map(r => <Text color={tone(r)} bold={!!cur && r.n === cur.n} underline={r.state === 'read' && !r.done}>{glyph(r)} </Text>)}</Text>
        <Text dimColor>
          <Text color={COL.accepted}>●</Text> kept  <Text color={COL.questioned}>●</Text> questioned{'\n'}<Text color={COL.corrected}>●</Text> corrected  <Text color={COL.rejected}>●</Text> rejected
        </Text>
        <Text dimColor>◉ gave the next task · underlined: to check</Text>
        <Text> </Text>
        {words
          ? <Text>Insights: <Text bold>{words.join(' · ')}</Text><Text dimColor>{'  '}from {readRows.length} readings, {checked} checked by you</Text></Text>
          : <Text dimColor>Insights after 5 replies are read. {readRows.length} so far.</Text>}
        <Text> </Text>
        <Box gap={1}>
          {!j.busy && !pick && <Button key="hammerit" hotkey="h" label="Hammer it" variant="primary" onPress={() => start('light')} />}
          {!j.busy && !pick && canFull && <Button key="full" hotkey="f" label="Full record" plain onPress={() => { void record($, 'full', files[0] ?? null) }} />}
        </Box>
        {pick && <Text dimColor>Which output are you handing over?</Text>}
        {pick && files.map(file => <Button key={`out-${file}`} label={nameOf(file)} plain onPress={() => { void record($, 'light', file) }} />)}
        {pick && <Button key="out-all" label="The whole session" plain onPress={() => { void record($, 'light', null) }} />}
        {j.line ? <Text>{j.line}</Text> : null}
        {last ? <Text dimColor>{last}</Text> : null}
      </Box>
    )
  })
}
