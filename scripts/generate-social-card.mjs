import sharp from "sharp";

const background = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="background" cx="76%" cy="36%" r="70%">
        <stop offset="0" stop-color="#29183a"/>
        <stop offset=".58" stop-color="#120b1d"/>
        <stop offset="1" stop-color="#080711"/>
      </radialGradient>
      <linearGradient id="accent" x1="0" x2="1">
        <stop stop-color="#ad70ff"/>
        <stop offset="1" stop-color="#d7b6ff"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#background)"/>
    <circle cx="1015" cy="210" r="190" fill="none" stroke="#ad70ff" stroke-opacity=".18"/>
    <circle cx="1015" cy="210" r="125" fill="none" stroke="#d7b6ff" stroke-opacity=".12"/>
    <path d="M80 532 H1120" stroke="#d7b6ff" stroke-opacity=".22"/>
    <text x="86" y="486" fill="url(#accent)" font-family="Arial, sans-serif" font-size="22" letter-spacing="7">TARGET THE GROWTH.</text>
    <text x="1118" y="486" text-anchor="end" fill="#d5c9dd" font-family="Arial, sans-serif" font-size="15" letter-spacing="4">CYCLE. PHASE. ONE.</text>
  </svg>
`);

const logo = await sharp("public/brand/generated/cyph1-lockup-clean-metallic.svg")
  .resize({ width: 760, fit: "inside" })
  .png()
  .toBuffer();

await sharp(background)
  .composite([{ input: logo, top: 128, left: 80 }])
  .png({ compressionLevel: 9 })
  .toFile("public/brand/social/cyph1-social-card.png");
