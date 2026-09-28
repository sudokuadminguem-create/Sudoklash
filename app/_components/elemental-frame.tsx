type Element = "angel" | "demon" | "warrior" | "samurai" | "ninja" | "pirate" | "dragon" | "phoenix" | "mage" | "guardian" | "leaf" | "fire" | "water" | "steel" | "frost" | "lightning" | "splash" | "meteor" | "aurora" | "solar" | "crown" | "lotus" | "nebula" | "onyx" | "prism";

// Vector ornaments stay crisp from the account button to the collection preview.
const motifs: Record<Element, string> = {
  angel: "M-12 4 Q-7 -6 -2 0 L0 4 L2 0 Q7 -6 12 4 Q7 2 5 8 L0 5 L-5 8 Q-7 2 -12 4 Z M-7 -6 Q0 -10 7 -6",
  demon: "M-10 7 Q-12 -6 -6 -11 L-4 -4 Q0 -7 4 -4 L6 -11 Q12 -6 10 7 L5 3 L0 10 L-5 3 Z",
  warrior: "M0 -11 L9 -7 L8 4 L0 11 L-8 4 L-9 -7 Z M-5 -4 L5 -4 M0 -7 V7 M-5 2 L5 2",
  samurai: "M-10 -4 Q0 -11 10 -4 L7 2 Q0 -2 -7 2 Z M-9 4 L9 4 M-7 8 L7 8 M-7 -7 L-11 -10 M7 -7 L11 -10",
  ninja: "M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3 Z M0 -5 V5 M-5 0 H5",
  pirate: "M-10 1 Q0 -11 10 1 L7 6 H-7 Z M-7 -1 L-10 -6 M7 -1 L10 -6 M-3 4 H3 M0 6 V10",
  dragon: "M-9 6 Q-9 -7 -3 -6 L0 -11 L3 -6 Q9 -7 9 6 L4 2 L0 10 L-4 2 Z M-4 -2 L-2 0 M4 -2 L2 0",
  phoenix: "M0 -11 Q5 -3 9 -8 Q7 0 3 2 L11 6 Q4 10 0 5 Q-4 10 -11 6 L-3 2 Q-7 0 -9 -8 Q-5 -3 0 -11 Z",
  mage: "M0 -11 L3 -4 L11 -3 L5 2 L7 10 L0 6 L-7 10 L-5 2 L-11 -3 L-3 -4 Z M0 -4 V3 M-3 0 H3",
  guardian: "M0 -11 L9 -7 L9 2 Q6 9 0 11 Q-6 9 -9 2 L-9 -7 Z M-5 -5 V2 L0 6 L5 2 V-5 M0 -8 V6",
  leaf: "M0 -9 C8 -8 9 0 0 9 C-8 4 -8 -5 0 -9 Z M0 8 C0 0 3 -4 6 -6",
  fire: "M0 -10 C4 -6 2 -4 5 -2 C9 3 5 9 0 9 C-7 9 -9 3 -5 -2 C-4 2 -1 2 0 -10 Z",
  water: "M0 -10 C3 -4 8 1 8 4 A8 8 0 0 1 -8 4 C-8 1 -3 -4 0 -10 Z",
  steel: "M-8 -7 L0 -10 L8 -7 L8 6 L0 10 L-8 6 Z M-5 -4 L5 -4 M-5 5 L5 5",
  frost: "M0 -10 V10 M-9 -5 L9 5 M-9 5 L9 -5 M-3 -7 L0 -4 L3 -7 M-3 7 L0 4 L3 7",
  lightning: "M3 -11 L-6 0 L-1 0 L-4 11 L8 -3 L2 -3 Z",
  splash: "M0 -11 C2 -2 9 -2 8 5 C7 11 -7 11 -8 5 C-9 -2 -2 -2 0 -11 Z M-9 -8 L-11 -5 M9 -8 L11 -5",
  meteor: "M-10 8 L-3 -7 L4 -10 L10 -4 L8 4 L-5 10 Z M-10 -6 L-5 -9 M-11 0 L-7 -2",
  aurora: "M-10 8 C-7 -10 -4 -10 0 8 C3 -10 7 -10 10 8 M-8 5 C-2 1 3 1 8 5",
  solar: "M0 -6 A6 6 0 1 0 0 6 A6 6 0 1 0 0 -6 M0 -12 V-9 M0 9 V12 M-12 0 H-9 M9 0 H12 M-9 -9 L-7 -7 M7 7 L9 9 M-9 9 L-7 7 M7 -7 L9 -9",
  crown: "M-10 -6 L-7 5 L0 9 L7 5 L10 -6 L5 -2 L0 -9 L-5 -2 Z",
  lotus: "M0 -10 Q7 -4 0 5 Q-7 -4 0 -10 Z M-9 -4 Q-7 6 0 9 Q7 6 9 -4 M-10 5 Q0 11 10 5",
  nebula: "M-10 3 Q-1 -12 7 -6 Q12 -1 2 5 Q-5 10 -8 5 M1 -2 L2 -2 M-5 4 L-4 4",
  onyx: "M0 -11 L9 -5 L7 6 L0 11 L-7 6 L-9 -5 Z M0 -11 L0 11 M-9 -5 L7 6 M9 -5 L-7 6",
  prism: "M0 -11 L10 4 L0 10 L-10 4 Z M0 -11 L0 10 M-10 4 H10",
};

const archetypeCrowns: Partial<Record<Element, string>> = {
  angel: "M-43 -6 Q-52 -24 -46 -34 Q-37 -26 -35 -16 M43 -6 Q52 -24 46 -34 Q37 -26 35 -16 M-19 -42 Q0 -53 19 -42",
  demon: "M-39 -19 L-49 -43 L-27 -34 M39 -19 L49 -43 L27 -34 M-8 -43 L0 -50 L8 -43",
  warrior: "M-42 -19 L-51 -28 L-37 -33 M42 -19 L51 -28 L37 -33 M-13 -42 L0 -50 L13 -42",
  samurai: "M-42 -21 Q0 -59 42 -21 M-34 -33 Q0 -43 34 -33 M-48 9 L-41 -6 M48 9 L41 -6",
  ninja: "M-43 -30 L-34 -28 M43 -30 L34 -28 M-8 -43 L0 -52 L8 -43 M-48 0 L-40 -8 M48 0 L40 -8",
  pirate: "M-37 -30 Q0 -55 37 -30 L46 -23 L34 -23 M-46 -23 L-34 -23 M-12 -45 L0 -52 L12 -45",
  dragon: "M-36 -31 L-48 -47 L-43 -25 M36 -31 L48 -47 L43 -25 M-16 -40 L-9 -50 L0 -42 L9 -50 L16 -40",
  phoenix: "M-39 -20 Q-55 -35 -46 -49 L-30 -35 M39 -20 Q55 -35 46 -49 L30 -35 M-9 -43 L0 -55 L9 -43",
  mage: "M-42 -16 L-51 -18 M42 -16 L51 -18 M-18 -41 L-23 -49 M18 -41 L23 -49 M0 -44 V-53",
  guardian: "M-42 -26 L-49 -35 L-40 -42 M42 -26 L49 -35 L40 -42 M-12 -43 L0 -52 L12 -43",
};

// Twenty recognisable engravings for the hundred classic frames. Each engraving
// comes in five different crown constructions, rather than five colour swaps.
const classicMotifs = [
  "M0 -9 L7 8 L0 4 L-7 8 Z", // pennant
  "M-8 -7 H8 V7 H-8 Z M-4 -3 H4 M-4 1 H4", // manuscript
  "M-8 6 L4 -7 L8 -3 L-4 9 Z", // quill
  "M-8 -5 Q0 -10 8 -5 L8 5 Q0 10 -8 5 Z", // shield
  "M0 -9 C8 -8 9 0 0 9 C-8 4 -8 -5 0 -9 Z", // petal
  "M-9 -7 H-3 V-3 H3 V-7 H9 V-1 H5 V5 H9 V9 H3 V5 H-3 V9 H-9 V3 H-5 V-3 H-9 Z", // tiles
  "M0 -10 L3 -4 L9 -4 L5 1 L7 8 L0 5 L-7 8 L-5 1 L-9 -4 L-3 -4 Z", // star
  "M-8 2 L-4 -8 L3 -9 L9 -2 L6 7 L-2 9 Z M-5 2 L5 -3", // stone
  "M-8 8 L-8 -7 L8 -7 L8 8 Z M-8 -1 H8 M-2 -7 V8", // pillar
  "M0 -9 A9 9 0 1 1 -1 9 M0 -9 L4 -5 M-1 9 L-5 5", // spiral
  "M-9 6 Q-4 -9 0 4 Q4 -9 9 6 M-8 8 Q0 2 8 8", // waves
  "M-9 5 L-2 -8 L4 -2 L9 8 L-2 4 Z", // mountain
  "M-9 -2 L-3 -8 L3 -8 L9 -2 L6 6 L0 9 L-6 6 Z M-3 -8 L0 9 L3 -8", // gem
  "M0 -9 V9 M-9 0 H9 M-6 -6 L6 6 M6 -6 L-6 6", // compass
  "M0 -9 C9 -9 9 -3 0 0 C-9 3 -9 9 0 9 C9 9 9 3 0 0", // ribbon
  "M-7 -8 L0 -5 L7 -8 L9 0 L7 8 L0 5 L-7 8 L-9 0 Z M0 -5 V5", // crest
  "M0 -9 L2 -3 L8 -4 L4 1 L7 7 L0 5 L-7 7 L-4 1 L-8 -4 L-2 -3 Z", // bloom
  "M-7 -7 Q0 -10 7 -7 Q10 0 7 7 Q0 10 -7 7 Q-10 0 -7 -7 Z M-5 0 H5", // clock
  "M-8 -7 L0 -10 L8 -7 L8 6 L0 10 L-8 6 Z M-4 -4 L4 4 M4 -4 L-4 4", // rune
  "M-9 8 L-5 -7 L0 -3 L5 -7 L9 8 L0 4 Z", // crown
] as const;

function crownPath(variant: number) {
  const points = [24, 8, 32, 12, 20][variant];
  return Array.from({ length: points }, (_, i) => {
    const angle = (2 * Math.PI * i) / points - Math.PI / 2;
    const radius = variant === 0 ? (i % 3 === 0 ? 43 : 39)
      : variant === 1 ? 41
      : variant === 2 ? (i % 2 ? 38 : 44)
      : variant === 3 ? (i % 3 === 0 ? 44 : 39)
      : (i % 4 === 0 ? 45 : i % 2 ? 38 : 41);
    return `${i ? "L" : "M"}${(radius * Math.cos(angle)).toFixed(2)} ${(radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ") + " Z";
}

export function ElementalFrame({ element, variant, motif, legendary }: { element: Element | null; variant: number; motif: number; legendary: boolean }) {
  const ornaments = [3, 4, 6, 8, 10][variant];
  const simple = element === null;
  const engraving = element ? motifs[element] : classicMotifs[motif];
  const archetype = element && archetypeCrowns[element];
  return (
    <svg className={`elemental-art ${simple ? "element-classic" : `element-${element}`} ${archetype ? "archetype-art" : ""} crown-${variant}`} viewBox="-56 -56 112 112" aria-hidden="true" focusable="false">
      {archetype && <path className="archetype-crown" d={archetype} fill="none" stroke="var(--frame-highlight)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />}
      {!simple && <circle className="element-halo" r="47" fill="none" stroke="currentColor" strokeWidth="1" />}
      <path className="element-base" d={crownPath(variant)} fill="none" stroke="var(--frame-accent)" strokeWidth={simple ? 5 : 7} strokeLinejoin="round" />
      <path className="element-metal" d={crownPath(variant)} fill="none" stroke="var(--frame-highlight)" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray={`${3 + variant} ${14 - variant}`} />
      <circle className="element-inner" r="34" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g className="element-ornaments">
        {Array.from({ length: ornaments }, (_, i) => {
          const angle = ((i + (variant % 2) / 2) * 360) / ornaments;
          const radians = ((angle - 90) * Math.PI) / 180;
          return (
            <g key={i} className="element-ornament" style={{ animationDelay: `${i * -0.21}s` }} transform={`translate(${(41 * Math.cos(radians)).toFixed(2)} ${(41 * Math.sin(radians)).toFixed(2)}) rotate(${angle - 90}) scale(${simple ? 0.57 : i % 2 ? 0.79 : 1})`}>
              <path d={engraving} fill={element === "frost" || element === "aurora" || element === "solar" ? "none" : "var(--frame-accent)"} stroke="var(--frame-highlight)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
      </g>
      {!simple && <path className="element-signature" d={engraving} transform={`translate(0 -43) scale(${archetype ? 0.85 : legendary ? 1.15 : 0.9})`} fill="var(--frame-accent)" stroke="var(--frame-highlight)" strokeWidth="1.5" strokeLinejoin="round" />}
      {legendary && <g className="element-particles">
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4;
          return <circle key={i} className="element-particle" cx={(48 * Math.cos(angle)).toFixed(2)} cy={(48 * Math.sin(angle)).toFixed(2)} r={i % 2 ? 1.15 : 1.8} fill="var(--frame-highlight)" style={{ animationDelay: `${i * -0.29}s` }} />;
        })}
      </g>}
    </svg>
  );
}
