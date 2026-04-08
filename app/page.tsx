"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { StatsCard } from "@/components/stats-card"
import { RankingsCard } from "@/components/rankings-card"
import { StrategyStats } from "@/components/strategy-stats"
import { RoundsCard } from "@/components/rounds-card"
import { WhitepaperModal } from "@/components/whitepaper-modal"
import { ExperimentDesign } from "@/components/experiment-design"
import { Footer } from "@/components/footer"
import { ScrambleText, ScrambleTextOnHover } from "@/components/animations/ScrambleText"
import { MODEL_COUNT } from "@/lib/models"
import { STATIC_GAME_STATS, STATIC_RANKINGS, STATIC_STRATEGY_STATS } from "@/lib/static-data"

const rankings = STATIC_RANKINGS.map((r, i) => ({
  rank: i + 1,
  modelId: r.modelId,
  totalPoints: r.totalPoints,
  wins: r.wins,
  losses: r.losses,
}))

export default function Home() {
  const [whitepaperOpen, setWhitepaperOpen] = useState(false)

  const downloadDataset = () => {
    window.open("https://modelsdilemma.ai/game_rounds_rows.csv", "_blank")
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="relative top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6">
        <div className="font-mono text-xs sm:text-sm tracking-wider flex items-center gap-4">
          <ScrambleTextOnHover
            text="The Model's Dilemma"
            className="opacity-80 cursor-default"
            duration={0.5}
          />
        </div>
      </header>

      <div className="flex flex-col min-h-screen">
        <div className="w-full max-w-6xl mx-auto flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-8 lg:pb-12 overflow-visible">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-mono text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-white leading-tight mb-4 sm:mb-6 text-balance">
              <ScrambleText text="The Model's Dilemma" delayMs={200} duration={1.2} />
            </h1>
            <p className="text-white/80 max-w-lg mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
              A recreation of Robert Axelrod&apos;s 1984 experiment on Game Theory&apos;s classic thought experiment the
              Prisoner&apos;s Dilemma.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <ScrambleTextOnHover
                as="button"
                text="Experiment Design"
                duration={0.4}
                onClick={() => {
                  document.getElementById("experiment-design")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="font-mono text-xs sm:text-sm uppercase tracking-wider border border-white/15 bg-transparent text-white hover:bg-white/5 px-4 sm:px-6 py-4 sm:py-5 rounded-md cursor-pointer transition-colors"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-8 sm:mt-12 lg:mt-16 overflow-visible"
          >
            <div className="col-span-2 flex">
              <RankingsCard rankings={rankings} onExport={downloadDataset} />
            </div>
            <div className="flex flex-col gap-2">
              <StatsCard label="Games Played" value={STATIC_GAME_STATS.totalGames} />
              <StatsCard label="Models Available" value={MODEL_COUNT} />
              <RoundsCard controlRounds={STATIC_GAME_STATS.controlRounds} hiddenAgendaRounds={STATIC_GAME_STATS.hiddenAgendaRounds} />
            </div>
            <div className="flex">
              <StrategyStats stats={STATIC_STRATEGY_STATS} />
            </div>
          </motion.div>
        </div>
      </div>

      <WhitepaperModal isOpen={whitepaperOpen} onClose={() => setWhitepaperOpen(false)} />

      <ExperimentDesign />

      <Footer />
    </div>
  )
}
