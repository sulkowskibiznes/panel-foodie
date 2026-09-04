import sharp from "sharp";

/** Grafika testowa do uploadu (PNG z napisem), generowana w locie: żadnych binariów w repo. */
export async function grafikaTestowa(tekst: string, kolor = "#7600F4", width = 1080, height = 1350): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${kolor}"/><text x="50%" y="50%" fill="#fff" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(Math.min(width, height) / 9)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${tekst}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
