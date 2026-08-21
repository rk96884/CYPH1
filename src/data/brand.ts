export const brand = { name: "CYPH/1", descriptor: "CYCLE. PHASE. ONE.", proposition: "TARGET THE GROWTH." } as const;
export const growthPhases = [
  { number: "01", name: "Anagen", label: "Active growth", description: "The follicle is actively producing and growing the hair shaft.", active: true },
  { number: "02", name: "Catagen", label: "Transition", description: "Hair growth stops as the follicle enters a short regression phase.", active: false },
  { number: "03", name: "Telogen", label: "Rest", description: "The follicle rests and the existing hair is no longer actively growing.", active: false },
  { number: "04", name: "Exogen", label: "Shedding", description: "The existing hair is released and shed as the cycle continues.", active: false },
] as const;

