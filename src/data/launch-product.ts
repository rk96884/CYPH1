export const launchProduct = Object.freeze({
  name: "CYPH/1 IPL Hair Removal Device",
  intendedPrice: { amount: 74.99, currency: "GBP" },
  state: "pre-launch" as const,
});

// Approved for Product Page v1 visual development; artwork is not specification evidence.
export const productGallery = [
  { key: "hero", label: "Primary Product Hero", filename: "cyph1-ipl-hero-v1.webp", alt: "CYPH/1 IPL Hair Removal Device with accessories" },
  { key: "included", label: "What's Included", filename: "cyph1-ipl-whats-included.webp", alt: "CYPH/1 IPL device with included accessories" },
  { key: "cooling", label: "Ice Cooling Comfort", filename: "cyph1-ipl-cooling.webp", alt: "CYPH/1 IPL device cooling treatment window" },
  { key: "areas", label: "Treatment Areas", filename: "cyph1-ipl-treatment-areas.webp", alt: "At-home IPL treatment areas" },
  { key: "technology", label: "IPL Technology", filename: "cyph1-ipl-technology.webp", alt: "IPL and hair-growth-cycle illustration" },
  { key: "lifestyle", label: "At-Home Convenience", filename: "cyph1-ipl-at-home.png", alt: "At-home IPL hair removal" },
  { key: "detail", label: "Premium Design", filename: "cyph1-ipl-design.png", alt: "CYPH/1 IPL device rose-gold detail" },
] as const;
