"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Relevé de consommation façon planche technique : réel vs objectif corrigé DJU */
function ReleveTechnique() {
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <figure className="border border-ink/15 bg-white">
      {/* Cartouche haut */}
      <figcaption className="flex items-center justify-between border-b border-ink/15 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">
          Fig. 01 — Consommation corrigée DJU
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
          Gaz · kWh PCS
        </span>
      </figcaption>

      <div className="p-4 sm:p-6">
        <svg
          viewBox="0 0 520 300"
          className="w-full"
          role="img"
          aria-label="Courbe de consommation réelle comparée à l'objectif contractuel corrigé DJU"
        >
          {/* Grille */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`h${i}`}
              x1="40"
              x2="512"
              y1={30 + i * 55}
              y2={30 + i * 55}
              stroke="#14181D"
              strokeOpacity="0.08"
            />
          ))}
          {months.map((_, i) => (
            <line
              key={`v${i}`}
              x1={40 + i * 39.3}
              x2={40 + i * 39.3}
              y1="30"
              y2="250"
              stroke="#14181D"
              strokeOpacity="0.05"
            />
          ))}

          {/* Axe Y */}
          {["120", "90", "60", "30", "0"].map((v, i) => (
            <text
              key={v}
              x="32"
              y={34 + i * 55}
              textAnchor="end"
              className="fill-ink/40"
              style={{ font: "10px var(--font-mono, monospace)" }}
            >
              {v}
            </text>
          ))}

          {/* Axe X */}
          {months.map((m, i) => (
            <text
              key={i}
              x={40 + i * 39.3}
              y="268"
              textAnchor="middle"
              className="fill-ink/40"
              style={{ font: "10px var(--font-mono, monospace)" }}
            >
              {m}
            </text>
          ))}

          {/* Objectif contractuel (tireté teal) */}
          <path
            d="M40 90 C 120 70, 160 60, 236 100 S 380 215, 433 205 S 495 130, 512 105"
            fill="none"
            stroke="#3A7E85"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            className="animate-fade-in"
            style={{ animationDuration: "1.5s" }}
          />

          {/* Réel (trait plein encre, dessiné) */}
          <path
            d="M40 82 C 110 58, 170 66, 236 112 S 350 232, 420 210 S 490 118, 512 88"
            fill="none"
            stroke="#14181D"
            strokeWidth="2"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset="1"
            className="animate-draw"
          />

          {/* Point de dérive annoté */}
          <circle cx="512" cy="88" r="3.5" fill="#14181D" />
          <line
            x1="512"
            x2="512"
            y1="88"
            y2="105"
            stroke="#3A7E85"
            strokeWidth="1"
          />
          <text
            x="508"
            y="52"
            textAnchor="end"
            className="fill-accent"
            style={{ font: "10px var(--font-mono, monospace)" }}
          >
            +8,2 % vs objectif
          </text>
          <text
            x="508"
            y="66"
            textAnchor="end"
            className="fill-ink/40"
            style={{ font: "10px var(--font-mono, monospace)" }}
          >
            alerte émise
          </text>
        </svg>
      </div>

      {/* Cartouche bas : légende */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink/15 px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] text-ink/60">
          <span className="inline-block h-px w-6 bg-ink" /> Réel relevé
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-ink/60">
          <span
            className="inline-block h-px w-6"
            style={{
              backgroundImage:
                "linear-gradient(to right, #3A7E85 60%, transparent 40%)",
              backgroundSize: "8px 1px",
            }}
          />
          Objectif contractuel corrigé DJU
        </span>
      </div>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-36 pb-16">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-end">
          {/* Colonne texte */}
          <div className="lg:col-span-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-8 animate-slide-up">
              Plateforme de suivi d&apos;exploitation — P1 · P2 · P3
            </p>

            <h1
              className="font-display text-[2.75rem] sm:text-6xl lg:text-[4.25rem] font-medium leading-[1.05] tracking-tight text-ink mb-8 animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              Vos marchés d&apos;exploitation CVC, suivis au kWh et à
              l&apos;euro près.
            </h1>

            <p
              className="text-lg text-text-secondary leading-relaxed max-w-xl mb-10 animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              MyXploit centralise contrats, relevés, factures et réunions
              d&apos;exploitation de votre patrimoine public — avec la rigueur
              d&apos;un bureau d&apos;études : correction DJU, intéressement,
              décomptes et rapports à l&apos;appui.
            </p>

            <div
              className="flex flex-wrap items-center gap-6 animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-3 bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
              >
                Demander une démo
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <a
                href="#features"
                className="font-mono text-xs uppercase tracking-widest text-ink underline decoration-ink/30 underline-offset-8 transition-colors hover:decoration-accent hover:text-accent"
              >
                Voir les modules
              </a>
            </div>
          </div>

          {/* Colonne planche technique */}
          <div
            className="lg:col-span-6 animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <ReleveTechnique />
          </div>
        </div>
      </div>

      {/* Bandeau de faits métier */}
      <div className="border-y border-ink/15">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-ink/15">
            {[
              ["Postes suivis", "P1 · P2 · P3 · P5"],
              ["Correction climatique", "DJU contractuels & réels"],
              ["Énergies", "Gaz · Élec · Chaleur · Eau"],
            ].map(([label, value]) => (
              <div key={label} className="py-5 sm:px-8 first:sm:pl-0">
                <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50 mb-1">
                  {label}
                </p>
                <p className="text-sm font-medium text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
