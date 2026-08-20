export const brandAssets = {
  logo: {
    lockup: {
      presentation: "/brand/generated/cyph1-lockup-presentation.svg",
      metallic: "/brand/generated/cyph1-lockup-metallic.svg",
      flat: "/brand/generated/cyph1-lockup-flat.svg",
    },
    wordmark: {
      metallic: "/brand/generated/cyph1-wordmark-metallic.svg",
      light: "/brand/generated/cyph1-wordmark-light.svg",
      dark: "/brand/generated/cyph1-wordmark-dark.svg",
    },
    mark: {
      metallic: "/brand/generated/cyph1-mark-metallic.svg",
      light: "/brand/generated/cyph1-mark-light.svg",
      dark: "/brand/generated/cyph1-mark-dark.svg",
    },
    favicon: "/brand/generated/cyph1-favicon.svg",
  },
  teaser: {
    productDirection: "/brand/teaser/cyph1-product-direction-v2.webp",
  },
} as const;

export type BrandAssets = typeof brandAssets;
