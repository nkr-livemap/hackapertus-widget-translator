#!/usr/bin/env node
// Ari Widget Translator, standalone Apertus runner (Hack Apertus 2026, Track 2B).
// Translates one widget string catalog from English into French or Italian with
// Apertus over an OpenAI-compatible endpoint, then runs the same deterministic
// checks the in-product Mastra workflow uses (placeholders, plural branches,
// widget markers, Swiss spelling). No dependencies beyond Node 22.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'] : []).filter(Boolean))
const catalogId = args.catalog ?? 'widgets/welcome/strings'
const locale = args.locale ?? 'fr'
const limit = Number(args.limit ?? 0)
const dryRun = args['dry-run'] === 'true' || !process.env.LLM_API_KEY
const LLM_NAME = process.env.LLM_NAME ?? 'swiss-ai/Apertus-v1.5-8B'
const LLM_BASE_URL = (process.env.LLM_BASE_URL ?? 'https://hackapertus.livemap.sh/v1').replace(/\/$/, '')
const LANG = { fr: 'French (Swiss, fr-CH, informal "tu")', it: 'Italian (Swiss, it-CH, informal "tu")' }[locale]
if (!LANG) { console.error(`unsupported locale ${locale}, use fr or it`); process.exit(2) }

const artifact = JSON.parse(readFileSync(new URL('../data/catalogs.json', import.meta.url), 'utf8'))
const catalog = artifact.catalogs.find((c) => c.id === catalogId)
if (!catalog) { console.error(`unknown catalog ${catalogId}. Known: ${artifact.catalogs.map((c) => c.id).join(', ')}`); process.exit(2) }
let keys = catalog.keys.filter((k) => k.kind !== 'code')
if (limit) keys = keys.slice(0, limit)

// --- deterministic checks (mirror of the product workflow's check step) ---
const placeholders = (s) => [...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]).sort().join(',')
const pluralOther = (s) => /\bplural\b/.test(s) ? /other\s*\{/.test(s) : true
const markers = (s) => [(s.match(/\|/g) ?? []).length, (s.match(/\[/g) ?? []).length, (s.match(/\]/g) ?? []).length].join('/')
function check(src, out) {
  const issues = []
  if (!out || !out.trim()) return ['error: empty']
  if (placeholders(src) !== placeholders(out)) issues.push(`error: placeholders ${placeholders(src) || '-'} vs ${placeholders(out) || '-'}`)
  if (!pluralOther(out)) issues.push('error: plural without other branch')
  if (markers(src) !== markers(out)) issues.push(`warning: markers |/[/] ${markers(src)} vs ${markers(out)}`)
  if (/ß/.test(out)) issues.push('warning: ß is not Swiss spelling')
  if (out.trim() === src.trim() && src.length > 3) issues.push('warning: unchanged from English')
  return issues
}

const system = `You translate user interface strings of "Ari", a Swiss city companion app, from English into ${LANG}.
Rules: keep every {placeholder} name exactly; keep ICU plural/select syntax and always include an "other" branch; keep widget markers |underlined text| and [link label] around the same words; use ss, never ß; keep the register informal and short, as in the German reference; proper nouns and brand names stay.
Answer with JSON only: {"translations":[{"key":"...","value":"...","uncertain":false,"note":""}]}. Set "uncertain": true when a native speaker should check the wording.`

async function translateChunk(chunk) {
  const user = JSON.stringify({ widget: catalogId, context: catalog.context, items: chunk.map((k) => ({ key: k.key, kind: k.kind, params: k.params, en: k.en, de: k.de })) })
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model: LLM_NAME, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const start = json.indexOf('{')
  return JSON.parse(json.slice(start)).translations ?? []
}

const results = []
console.log(`${dryRun ? 'DRY RUN (no LLM_API_KEY): checks only, German reference as stand-in' : `model ${LLM_NAME} at ${LLM_BASE_URL}`}`)
console.log(`catalog ${catalogId}, ${keys.length} keys -> ${locale}\n`)
for (let i = 0; i < keys.length; i += 12) {
  const chunk = keys.slice(i, i + 12)
  let got = []
  if (dryRun) got = chunk.map((k) => ({ key: k.key, value: k.de, uncertain: false }))
  else {
    try { got = await translateChunk(chunk) } catch (e) { console.error(`chunk ${i / 12 + 1} failed: ${e.message}`); got = [] }
  }
  for (const k of chunk) {
    const t = got.find((g) => g.key === k.key)
    const issues = check(k.en, t?.value)
    const status = issues.some((x) => x.startsWith('error')) ? 'ERROR' : issues.length ? 'WARN ' : t?.uncertain ? 'UNSURE' : 'OK   '
    results.push({ key: k.key, en: k.en, [locale]: t?.value ?? '', uncertain: !!t?.uncertain, note: t?.note ?? '', issues })
    console.log(`${status}  ${k.key.padEnd(40)} ${(t?.value ?? '').slice(0, 70)}${issues.length ? '   <- ' + issues.join('; ') : ''}`)
  }
}
const n = (f) => results.filter(f).length
const summary = { model: dryRun ? 'dry-run' : LLM_NAME, catalog: catalogId, locale, keys: results.length, ok: n((r) => !r.issues.length && !r.uncertain), uncertain: n((r) => r.uncertain && !r.issues.length), warning: n((r) => r.issues.length && !r.issues.some((x) => x.startsWith('error'))), error: n((r) => r.issues.some((x) => x.startsWith('error'))) }
console.log('\n' + JSON.stringify(summary))
mkdirSync(new URL('../out/', import.meta.url), { recursive: true })
const file = new URL(`../out/${catalogId.replace(/\//g, '_')}.${locale}.json`, import.meta.url)
writeFileSync(file, JSON.stringify({ summary, translations: results }, null, 2))
console.log(`written ${file.pathname}`)
