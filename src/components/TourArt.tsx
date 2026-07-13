// Inline SVG illustrations for the onboarding tour. Self-contained (no external
// images → works offline, no CSP issues), theme-aware via CSS variables, and
// RTL-safe (purely decorative, centered). Each one visually shows *how* to do
// the thing the slide describes rather than just decorating it.

type Props = { name: string };

const VB = "0 0 300 172";
const S = {
  card: "var(--surface)", alt: "var(--surface-alt)", border: "var(--border)",
  text: "var(--text)", muted: "var(--muted)", blue: "var(--blue)", green: "var(--green)",
  gold: "var(--gold)", coral: "var(--coral)",
};

// A subtle app-window frame every illustration sits in.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={VB} className="tour-art" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect x="6" y="6" width="288" height="160" rx="12" fill={S.card} stroke={S.border} strokeWidth="1.5" />
      <circle cx="20" cy="19" r="2.4" fill={S.coral} opacity="0.6" />
      <circle cx="29" cy="19" r="2.4" fill={S.gold} opacity="0.6" />
      <circle cx="38" cy="19" r="2.4" fill={S.green} opacity="0.6" />
      <line x1="6" y1="30" x2="294" y2="30" stroke={S.border} strokeWidth="1" />
      {children}
    </svg>
  );
}

export function TourArt({ name }: Props) {
  switch (name) {
    case "welcome":
      return (
        <Frame>
          {/* dashboard: stat tiles + a little chart */}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={22 + i * 88} y="44" width="76" height="40" rx="7" fill={S.alt} />
              <rect x={30 + i * 88} y="52" width="34" height="6" rx="3" fill={S.blue} opacity="0.85" />
              <rect x={30 + i * 88} y="64" width="52" height="5" rx="2.5" fill={S.muted} opacity="0.5" />
            </g>
          ))}
          <rect x="22" y="96" width="252" height="58" rx="8" fill={S.alt} />
          {[38, 60, 44, 72, 52, 84, 66].map((h, i) => (
            <rect key={i} x={36 + i * 34} y={148 - h * 0.55} width="16" height={h * 0.55} rx="3" fill={i % 2 ? S.green : S.blue} opacity="0.85" />
          ))}
        </Frame>
      );

    case "agenda":
      return (
        <Frame>
          {/* week grid with an appointment + a floating New button */}
          {[0, 1, 2, 3, 4].map((d) => (
            <g key={d}>
              <text x={38 + d * 46} y="46" fontSize="8" fill={S.muted} textAnchor="middle">{["Lun", "Mar", "Mer", "Jeu", "Ven"][d]}</text>
              <line x1={20 + d * 46} y1="52" x2={20 + d * 46} y2="160" stroke={S.border} strokeWidth="0.75" />
            </g>
          ))}
          <rect x="24" y="62" width="38" height="26" rx="5" fill={S.blue} opacity="0.9" />
          <rect x="30" y="68" width="26" height="4" rx="2" fill="#fff" opacity="0.9" />
          <rect x="30" y="76" width="18" height="4" rx="2" fill="#fff" opacity="0.6" />
          <rect x="116" y="96" width="38" height="30" rx="5" fill={S.green} opacity="0.9" />
          <rect x="208" y="74" width="38" height="22" rx="5" fill={S.gold} opacity="0.9" />
          {/* + New appointment */}
          <circle cx="256" cy="150" r="15" fill={S.blue} />
          <path d="M256 143v14M249 150h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M232 140q-8 -6 -14 -2" stroke={S.muted} strokeWidth="1.4" fill="none" markerEnd="url(#ah)" />
          <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0 0l6 3.5L0 7z" fill={S.muted} /></marker></defs>
        </Frame>
      );

    case "waiting":
      return (
        <Frame>
          {[["Arrivé", S.green, 44], ["En consultation", S.blue, 82], ["Arrivé", S.green, 120]].map(([label, col, y], i) => (
            <g key={i}>
              <rect x="22" y={y as number} width="256" height="30" rx="7" fill={S.alt} />
              <circle cx="40" cy={(y as number) + 15} r="9" fill={col as string} opacity="0.25" />
              <circle cx="40" cy={(y as number) + 15} r="4.5" fill={col as string} />
              <rect x="56" y={(y as number) + 8} width="80" height="6" rx="3" fill={S.text} opacity="0.7" />
              <rect x="56" y={(y as number) + 18} width="48" height="5" rx="2.5" fill={S.muted} opacity="0.5" />
              <rect x="188" y={(y as number) + 9} width="80" height="13" rx="6.5" fill={col as string} opacity="0.18" />
              <text x="228" y={(y as number) + 18} fontSize="7.5" fill={col as string} textAnchor="middle" fontWeight="700">{label as string}</text>
            </g>
          ))}
        </Frame>
      );

    case "patients":
      return (
        <Frame>
          <circle cx="46" cy="70" r="20" fill={S.blue} opacity="0.15" />
          <circle cx="46" cy="63" r="8" fill={S.blue} opacity="0.8" />
          <path d="M32 84a14 12 0 0 1 28 0z" fill={S.blue} opacity="0.8" />
          <rect x="80" y="48" width="120" height="8" rx="4" fill={S.text} opacity="0.75" />
          <rect x="80" y="64" width="90" height="6" rx="3" fill={S.muted} opacity="0.55" />
          <rect x="80" y="78" width="70" height="6" rx="3" fill={S.muted} opacity="0.55" />
          {/* dossier tabs */}
          {["Dossier", "Consultations", "Finances"].map((tab, i) => (
            <g key={i}>
              <rect x={22 + i * 88} y="108" width="80" height="18" rx="6" fill={i === 0 ? S.blue : S.alt} opacity={i === 0 ? 0.9 : 1} />
              <text x={62 + i * 88} y="120" fontSize="7.5" fill={i === 0 ? "#fff" : S.muted} textAnchor="middle" fontWeight="600">{tab}</text>
            </g>
          ))}
          <rect x="22" y="134" width="252" height="8" rx="4" fill={S.alt} />
          <rect x="22" y="147" width="180" height="8" rx="4" fill={S.alt} />
        </Frame>
      );

    case "consult":
      return (
        <Frame>
          {/* left: note sections */}
          {["Motif", "Examen", "Diagnostic", "Traitement"].map((sec, i) => (
            <g key={i}>
              <rect x="20" y={42 + i * 30} width="150" height="24" rx="6" fill={S.alt} />
              <text x="28" y={57 + i * 30} fontSize="7.5" fill={S.blue} fontWeight="700">{sec}</text>
              <rect x="66" y={51 + i * 30} width={90 - i * 12} height="5" rx="2.5" fill={S.muted} opacity="0.5" />
            </g>
          ))}
          {/* right: vitals + history */}
          <rect x="180" y="42" width="98" height="52" rx="7" fill={S.blue} opacity="0.1" />
          <text x="188" y="55" fontSize="7.5" fill={S.blue} fontWeight="700">Signes vitaux</text>
          {["TA 128/82", "IMC 26.4", "eGFR auto"].map((v, i) => (
            <text key={i} x="188" y={68 + i * 9} fontSize="7" fill={S.text} opacity="0.8">{v}</text>
          ))}
          <rect x="180" y="100" width="98" height="54" rx="7" fill={S.alt} />
          <text x="188" y="113" fontSize="7.5" fill={S.gold} fontWeight="700">Historique</text>
          {[0, 1, 2].map((i) => <rect key={i} x="188" y={120 + i * 11} width={82 - i * 16} height="5" rx="2.5" fill={S.muted} opacity="0.5" />)}
        </Frame>
      );

    case "prescribe":
      return (
        <Frame>
          {/* Rx sheet */}
          <rect x="70" y="40" width="160" height="120" rx="8" fill="#fff" stroke={S.border} strokeWidth="1.2" />
          <text x="82" y="58" fontSize="10" fill={S.blue} fontWeight="800">℞ Ordonnance</text>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="86" cy={74 + i * 18} r="2" fill={S.text} />
              <rect x="94" y={71 + i * 18} width="122" height="5" rx="2.5" fill={S.text} opacity="0.6" />
              <rect x="94" y={80 + i * 18} width="80" height="4" rx="2" fill={S.muted} opacity="0.45" />
            </g>
          ))}
          <rect x="150" y="132" width="70" height="18" rx="5" fill={S.blue} />
          <text x="185" y="144" fontSize="7.5" fill="#fff" textAnchor="middle" fontWeight="700">Imprimer</text>
          {/* side badges */}
          {[["Certificat", S.green, 48], ["Examens", S.gold, 90], ["Facture", S.blue, 132]].map(([l, c, y], i) => (
            <g key={i}>
              <rect x="16" y={y as number} width="46" height="24" rx="6" fill={c as string} opacity="0.16" />
              <text x="39" y={(y as number) + 15} fontSize="7" fill={c as string} textAnchor="middle" fontWeight="700">{l as string}</text>
            </g>
          ))}
        </Frame>
      );

    case "billing":
      return (
        <Frame>
          {[["Consultation", "300"], ["Impédancemétrie", "150"]].map(([act, price], i) => (
            <g key={i}>
              <rect x="22" y={44 + i * 26} width="256" height="22" rx="6" fill={S.alt} />
              <text x="30" y={58 + i * 26} fontSize="8" fill={S.text} opacity="0.8">{act}</text>
              <rect x="176" y={49 + i * 26} width="20" height="12" rx="3" fill={S.blue} opacity="0.85" />
              <text x="186" y={58 + i * 26} fontSize="7" fill="#fff" textAnchor="middle" fontWeight="700">%</text>
              <text x="266" y={58 + i * 26} fontSize="8.5" fill={S.text} textAnchor="end" fontWeight="700">{price} DH</text>
            </g>
          ))}
          {/* emphasised total */}
          <rect x="22" y="102" width="256" height="30" rx="7" fill={S.green} opacity="0.14" />
          <text x="30" y="121" fontSize="10" fill={S.green} fontWeight="800">TOTAL</text>
          <text x="266" y="122" fontSize="13" fill={S.green} textAnchor="end" fontWeight="800">450 DH</text>
          <circle cx="40" cy="150" r="8" fill={S.green} opacity="0.2" />
          <path d="M36 150l3 3 6-6" stroke={S.green} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="54" y="153" fontSize="8" fill={S.muted}>Payé / encaissé</text>
        </Frame>
      );

    case "finances":
      return (
        <Frame>
          <text x="22" y="46" fontSize="8" fill={S.muted} fontWeight="700">Caisse du jour</text>
          <rect x="22" y="52" width="118" height="44" rx="8" fill={S.green} opacity="0.14" />
          <text x="34" y="74" fontSize="15" fill={S.green} fontWeight="800">2 350 DH</text>
          <text x="34" y="88" fontSize="7" fill={S.muted}>+ 8 encaissements</text>
          {/* recettes vs charges bars */}
          <rect x="152" y="52" width="126" height="104" rx="8" fill={S.alt} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={166 + i * 28} y={140 - (28 + i * 6)} width="10" height={28 + i * 6} rx="2" fill={S.green} opacity="0.85" />
              <rect x={178 + i * 28} y={140 - (16 + i * 3)} width="10" height={16 + i * 3} rx="2" fill={S.coral} opacity="0.8" />
            </g>
          ))}
          <text x="215" y="152" fontSize="7" fill={S.muted} textAnchor="middle">Recettes · Charges</text>
        </Frame>
      );

    case "documents":
      return (
        <Frame>
          {/* A4 page with draggable blocks */}
          <rect x="104" y="40" width="92" height="122" rx="4" fill="#fff" stroke={S.border} strokeWidth="1.2" />
          <rect x="112" y="48" width="50" height="16" rx="3" fill={S.blue} opacity="0.85" />
          <rect x="168" y="50" width="20" height="12" rx="3" fill={S.gold} opacity="0.7" />
          <rect x="112" y="72" width="76" height="5" rx="2.5" fill={S.muted} opacity="0.5" />
          <rect x="112" y="84" width="76" height="30" rx="3" fill={S.alt} />
          <rect x="112" y="120" width="50" height="5" rx="2.5" fill={S.muted} opacity="0.5" />
          {/* drag handles */}
          <g stroke={S.blue} strokeWidth="1.4" fill={S.card}>
            <rect x="108" y="80" width="7" height="7" rx="1.5" />
            <rect x="185" y="80" width="7" height="7" rx="1.5" />
            <rect x="108" y="111" width="7" height="7" rx="1.5" />
            <rect x="185" y="111" width="7" height="7" rx="1.5" />
          </g>
          <path d="M204 96q18 0 26 8" stroke={S.muted} strokeWidth="1.4" fill="none" markerEnd="url(#ah2)" />
          <text x="214" y="120" fontSize="7" fill={S.muted}>glisser</text>
          <defs><marker id="ah2" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0 0l6 3.5L0 7z" fill={S.muted} /></marker></defs>
          <text x="52" y="80" fontSize="8" fill={S.muted} textAnchor="middle">Votre</text>
          <text x="52" y="92" fontSize="8" fill={S.muted} textAnchor="middle">en-tête</text>
        </Frame>
      );

    case "team":
      return (
        <Frame>
          {/* doctor panel (full) */}
          <rect x="20" y="42" width="120" height="114" rx="8" fill={S.alt} />
          <text x="30" y="56" fontSize="7.5" fill={S.blue} fontWeight="700">Médecin</text>
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="30" y={64 + i * 16} width={100 - (i % 2) * 20} height="7" rx="3.5" fill={S.blue} opacity="0.55" />)}
          {/* secretary panel (limited) + toggles */}
          <rect x="160" y="42" width="120" height="114" rx="8" fill={S.alt} />
          <text x="170" y="56" fontSize="7.5" fill={S.green} fontWeight="700">Secrétaire</text>
          {[["Agenda", true], ["Encaissement", true], ["Clinique", false], ["Finances", false]].map(([l, on], i) => (
            <g key={i}>
              <text x="170" y={72 + i * 20} fontSize="7" fill={S.text} opacity="0.75">{l as string}</text>
              <rect x="248" y={65 + i * 20} width="22" height="11" rx="5.5" fill={on ? S.green : S.border} />
              <circle cx={on ? 264 : 254} cy={70.5 + i * 20} r="4" fill="#fff" />
            </g>
          ))}
        </Frame>
      );

    case "sync":
      return (
        <Frame>
          {/* laptop */}
          <rect x="30" y="58" width="96" height="60" rx="5" fill={S.alt} stroke={S.border} strokeWidth="1" />
          <rect x="38" y="66" width="80" height="44" rx="3" fill={S.blue} opacity="0.15" />
          <rect x="22" y="120" width="112" height="7" rx="3.5" fill={S.border} />
          {/* phone */}
          <rect x="204" y="52" width="40" height="72" rx="7" fill={S.alt} stroke={S.border} strokeWidth="1" />
          <rect x="210" y="60" width="28" height="52" rx="3" fill={S.green} opacity="0.18" />
          {/* sync arrows */}
          <path d="M138 78q22 -10 58 -6" stroke={S.blue} strokeWidth="1.8" fill="none" markerEnd="url(#s1)" />
          <path d="M196 100q-34 10 -58 -2" stroke={S.green} strokeWidth="1.8" fill="none" markerEnd="url(#s2)" />
          <defs>
            <marker id="s1" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0 0l6 3.5L0 7z" fill={S.blue} /></marker>
            <marker id="s2" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0 0l6 3.5L0 7z" fill={S.green} /></marker>
          </defs>
          {/* language chips */}
          {["FR", "EN", "ع"].map((l, i) => (
            <g key={i}>
              <rect x={100 + i * 34} y="140" width="28" height="16" rx="8" fill={S.blue} opacity={i === 0 ? 0.9 : 0.15} />
              <text x={114 + i * 34} y="151" fontSize="8" fill={i === 0 ? "#fff" : S.blue} textAnchor="middle" fontWeight="700">{l}</text>
            </g>
          ))}
        </Frame>
      );

    case "help":
    default:
      return (
        <Frame>
          <circle cx="150" cy="92" r="42" fill={S.blue} opacity="0.12" />
          <circle cx="150" cy="92" r="30" fill={S.blue} opacity="0.9" />
          <text x="150" y="104" fontSize="34" fill="#fff" textAnchor="middle" fontWeight="800">?</text>
          <rect x="70" y="146" width="160" height="10" rx="5" fill={S.alt} />
          <path d="M96 60q10 -14 26 -6" stroke={S.gold} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M204 60q-10 -14 -26 -6" stroke={S.green} strokeWidth="2" fill="none" strokeLinecap="round" />
        </Frame>
      );
  }
}
