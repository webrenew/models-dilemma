/**
 * One-time script to pre-compute all statistics from the CSV export.
 * Run: npx tsx scripts/compute-static-data.ts
 * Outputs: lib/static-data.ts
 */

import { createReadStream } from "fs"
import { writeFileSync } from "fs"
import { parse } from "csv-parse"
import path from "path"

const CSV_PATH = path.join(process.env.HOME!, "Downloads", "game_rounds_rows.csv")

const ACTIVE_MODEL_IDS = new Set([
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.1-thinking",
  "xai/grok-4.1-fast-reasoning",
  "google/gemini-3-pro-preview",
  "perplexity/sonar-pro",
  "moonshotai/kimi-k2-thinking-turbo",
  "deepseek/deepseek-v3.2-thinking",
])

const DISPLAY_NAMES: Record<string, string> = {
  "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5",
  "anthropic/claude-opus-4.5": "Claude Opus 4.5",
  "openai/gpt-5.1-thinking": "GPT-5.1 Thinking",
  "xai/grok-4.1-fast-reasoning": "Grok 4.1 Fast Reasoning",
  "google/gemini-3-pro-preview": "Gemini 3 Pro Preview",
  "perplexity/sonar-pro": "Sonar Pro",
  "moonshotai/kimi-k2-thinking-turbo": "Kimi K2 Thinking Turbo",
  "deepseek/deepseek-v3.2-thinking": "DeepSeek V3.2 Thinking",
}

interface Row {
  game_id: string
  round_number: string
  agent1_model_id: string
  agent1_display_name: string
  agent1_decision: string
  agent1_cumulative_score: string
  agent2_model_id: string
  agent2_display_name: string
  agent2_decision: string
  agent2_cumulative_score: string
  game_type: string
  game_winner: string
  is_final_round: string
  scenario: string
}

// Accumulators
let totalGames = 0
let controlRounds = 0
let hiddenAgendaRounds = 0

// Model rankings (keyed by model ID)
const modelStats = new Map<string, {
  modelId: string
  displayName: string
  totalPoints: number
  gamesPlayed: number
  wins: number
  losses: number
  ties: number
  totalErrors: number
}>()

// Scenario stats
const scenarioStats = {
  overt: { cooperate: 0, defect: 0, total: 0 },
  sales: { cooperate: 0, defect: 0, total: 0 },
  research: { cooperate: 0, defect: 0, total: 0 },
  creator: { cooperate: 0, defect: 0, total: 0 },
}

// For strategy stats, we need rounds grouped by game_id
const gameRoundsMap = new Map<string, Array<{
  round_number: number
  agent1_decision: string
  agent2_decision: string
  agent1_model_id: string
  agent2_model_id: string
}>>()

// Per-model behavior (keyed by model ID)
const modelBehavior = new Map<string, {
  forgiving: number
  forgivingTotal: number
  retaliating: number
  retaliatingTotal: number
  nice: number
  niceTotal: number
  nonEnvious: number
  nonEnviousTotal: number
}>()

function ensureModelStats(modelId: string, displayName: string) {
  if (!modelStats.has(modelId)) {
    modelStats.set(modelId, {
      modelId,
      displayName,
      totalPoints: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      totalErrors: 0,
    })
  }
}

function ensureModelBehavior(modelId: string) {
  if (!modelBehavior.has(modelId)) {
    modelBehavior.set(modelId, {
      forgiving: 0, forgivingTotal: 0,
      retaliating: 0, retaliatingTotal: 0,
      nice: 0, niceTotal: 0,
      nonEnvious: 0, nonEnviousTotal: 0,
    })
  }
}

function getScenarioBucket(gameType: string, scenario: string): "overt" | "sales" | "research" | "creator" {
  if (gameType === "control") return "overt"
  if (scenario === "sales") return "sales"
  if (scenario === "research") return "research"
  if (scenario === "creator") return "creator"
  return "sales" // default cloaked to sales
}

async function main() {
console.log("Reading CSV...")
let rowCount = 0

const parser = createReadStream(CSV_PATH).pipe(
  parse({ columns: true, skip_empty_lines: true, relax_column_count: true })
)

for await (const row of parser as AsyncIterable<Row>) {
  rowCount++
  if (rowCount % 500000 === 0) console.log(`  Processed ${rowCount} rows...`)

  const isFinal = row.is_final_round === "true" || row.is_final_round === "t"
  const roundNum = parseInt(row.round_number, 10)

  // Accumulate rounds per game for strategy stats
  let gameRounds = gameRoundsMap.get(row.game_id)
  if (!gameRounds) {
    gameRounds = []
    gameRoundsMap.set(row.game_id, gameRounds)
  }
  gameRounds.push({
    round_number: roundNum,
    agent1_decision: row.agent1_decision,
    agent2_decision: row.agent2_decision,
    agent1_model_id: row.agent1_model_id,
    agent2_model_id: row.agent2_model_id,
  })

  // Scenario stats: count each agent's decision
  const bucket = getScenarioBucket(row.game_type, row.scenario)
  scenarioStats[bucket].total += 2
  if (row.agent1_decision === "cooperate") scenarioStats[bucket].cooperate++
  else if (row.agent1_decision === "defect") scenarioStats[bucket].defect++
  if (row.agent2_decision === "cooperate") scenarioStats[bucket].cooperate++
  else if (row.agent2_decision === "defect") scenarioStats[bucket].defect++

  // Count errors for per-model stats
  ensureModelStats(row.agent1_model_id, row.agent1_display_name)
  ensureModelStats(row.agent2_model_id, row.agent2_display_name)
  if (row.agent1_decision === "error") modelStats.get(row.agent1_model_id)!.totalErrors++
  if (row.agent2_decision === "error") modelStats.get(row.agent2_model_id)!.totalErrors++

  // Final round stats
  if (isFinal) {
    totalGames++
    if (row.game_type === "control") controlRounds++
    else if (row.game_type === "hidden_agenda") hiddenAgendaRounds++

    const a1 = modelStats.get(row.agent1_model_id)!
    const a2 = modelStats.get(row.agent2_model_id)!

    a1.totalPoints += parseInt(row.agent1_cumulative_score, 10) || 0
    a1.gamesPlayed++
    a2.totalPoints += parseInt(row.agent2_cumulative_score, 10) || 0
    a2.gamesPlayed++

    if (row.game_winner === "agent1") {
      a1.wins++
      a2.losses++
    } else if (row.game_winner === "agent2") {
      a2.wins++
      a1.losses++
    } else {
      a1.ties++
      a2.ties++
    }
  }
}

console.log(`Processed ${rowCount} rows total, ${totalGames} games, ${gameRoundsMap.size} unique game_ids`)

// Now compute strategy stats from grouped rounds
console.log("Computing strategy stats...")

let globalForgiving = 0, globalForgivingTotal = 0
let globalRetaliating = 0, globalRetaliatingTotal = 0
let globalNice = 0, globalNiceTotal = 0
let globalNonEnvious = 0, globalNonEnviousTotal = 0

for (const [, rounds] of gameRoundsMap) {
  if (rounds.length === 0) continue
  // Sort by round number
  rounds.sort((a, b) => a.round_number - b.round_number)

  const a1id = rounds[0].agent1_model_id
  const a2id = rounds[0].agent2_model_id

  // Nice: first move cooperate (global)
  globalNiceTotal += 2
  if (rounds[0].agent1_decision === "cooperate") globalNice++
  if (rounds[0].agent2_decision === "cooperate") globalNice++

  // Per-model nice
  ensureModelBehavior(a1id)
  ensureModelBehavior(a2id)
  const b1 = modelBehavior.get(a1id)!
  const b2 = modelBehavior.get(a2id)!
  b1.niceTotal++
  b2.niceTotal++
  if (rounds[0].agent1_decision === "cooperate") b1.nice++
  if (rounds[0].agent2_decision === "cooperate") b2.nice++

  // Forgiving + retaliating
  for (let i = 1; i < rounds.length; i++) {
    const prev = rounds[i - 1]
    const curr = rounds[i]

    // Agent 1's response to agent2's previous defection
    if (prev.agent2_decision === "defect") {
      globalForgivingTotal++
      globalRetaliatingTotal++
      b1.forgivingTotal++
      b1.retaliatingTotal++
      if (curr.agent1_decision === "cooperate") { globalForgiving++; b1.forgiving++ }
      else if (curr.agent1_decision === "defect") { globalRetaliating++; b1.retaliating++ }
    }
    // Agent 2's response to agent1's previous defection
    if (prev.agent1_decision === "defect") {
      globalForgivingTotal++
      globalRetaliatingTotal++
      b2.forgivingTotal++
      b2.retaliatingTotal++
      if (curr.agent2_decision === "cooperate") { globalForgiving++; b2.forgiving++ }
      else if (curr.agent2_decision === "defect") { globalRetaliating++; b2.retaliating++ }
    }
  }

  // Non-envious
  globalNonEnviousTotal += 2
  b1.nonEnviousTotal++
  b2.nonEnviousTotal++
  const a1Defects = rounds.filter(r => r.agent1_decision === "defect").length
  const a2Defects = rounds.filter(r => r.agent2_decision === "defect").length
  if (a1Defects <= a2Defects) { globalNonEnvious++; b1.nonEnvious++ }
  if (a2Defects <= a1Defects) { globalNonEnvious++; b2.nonEnvious++ }
}

// Build rankings (active models only, sorted)
const rankings = [...modelStats.values()]
  .filter(m => ACTIVE_MODEL_IDS.has(m.modelId))
  .sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.losses - b.losses
  })

// Build per-model detailed stats
const modelDetails: Record<string, object> = {}
for (const m of modelStats.values()) {
  if (!ACTIVE_MODEL_IDS.has(m.modelId)) continue
  const b = modelBehavior.get(m.modelId) || {
    forgiving: 0, forgivingTotal: 0,
    retaliating: 0, retaliatingTotal: 0,
    nice: 0, niceTotal: 0,
    nonEnvious: 0, nonEnviousTotal: 0,
  }
  modelDetails[m.modelId] = {
    modelId: m.modelId,
    displayName: DISPLAY_NAMES[m.modelId] || m.displayName,
    totalGames: m.gamesPlayed,
    totalPoints: m.totalPoints,
    totalErrors: m.totalErrors,
    wins: m.wins,
    losses: m.losses,
    ties: m.ties,
    behavior: { ...b },
  }
}

// Generate TypeScript output
console.log("Writing lib/static-data.ts...")

const output = `// Auto-generated by scripts/compute-static-data.ts — do not edit manually

export const STATIC_GAME_STATS = ${JSON.stringify({ totalGames, controlRounds, hiddenAgendaRounds }, null, 2)} as const

export const STATIC_RANKINGS = ${JSON.stringify(
  rankings.map(r => ({
    modelId: r.modelId,
    displayName: DISPLAY_NAMES[r.modelId] || r.displayName,
    totalPoints: r.totalPoints,
    gamesPlayed: r.gamesPlayed,
    wins: r.wins,
    losses: r.losses,
  })),
  null,
  2
)} as const

export const STATIC_STRATEGY_STATS = ${JSON.stringify({
  forgiving: globalForgiving,
  forgivingTotal: globalForgivingTotal,
  retaliating: globalRetaliating,
  retaliatingTotal: globalRetaliatingTotal,
  nice: globalNice,
  niceTotal: globalNiceTotal,
  nonEnvious: globalNonEnvious,
  nonEnviousTotal: globalNonEnviousTotal,
}, null, 2)} as const

export const STATIC_SCENARIO_STATS = ${JSON.stringify(scenarioStats, null, 2)} as const

export interface StaticModelDetailedStats {
  modelId: string
  displayName: string
  totalGames: number
  totalPoints: number
  totalErrors: number
  wins: number
  losses: number
  ties: number
  behavior: {
    forgiving: number
    forgivingTotal: number
    retaliating: number
    retaliatingTotal: number
    nice: number
    niceTotal: number
    nonEnvious: number
    nonEnviousTotal: number
  }
}

export const STATIC_MODEL_DETAILS: Record<string, StaticModelDetailedStats> = ${JSON.stringify(modelDetails, null, 2)} as const
`

const scriptDir = path.dirname(new URL(import.meta.url).pathname)
writeFileSync(path.join(scriptDir, "..", "lib", "static-data.ts"), output)
console.log("Done!")
}

main().catch(console.error)
