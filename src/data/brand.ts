export const brand = { name: "CYPH/1", descriptor: "CYCLE. PHASE. ONE.", proposition: "TARGET THE GROWTH." } as const;
export const growthPhases = [
  { number: "01", name: "Anagen", label: "Active growth", active: true },
  { number: "02", name: "Catagen", label: "Transition", active: false },
  { number: "03", name: "Telogen", label: "Rest", active: false },
  { number: "04", name: "Exogen", label: "Shedding", active: false },
] as const;
