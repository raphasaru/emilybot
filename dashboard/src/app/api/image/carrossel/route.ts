import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';

export const runtime = 'nodejs';

const require = createRequire(import.meta.url);
const { generateCarouselImages, parseCarouselCards } = require(
  path.resolve(process.cwd(), '..', 'src', 'services', 'imageGenerator')
);

export async function POST(req: NextRequest) {
  const { final_content } = await req.json();
  if (!final_content) return NextResponse.json({ error: 'final_content required' }, { status: 400 });

  try {
    const cards = parseCarouselCards(final_content);
    const images: { buf: Buffer; caption: string }[] = await generateCarouselImages(cards);

    // Build ZIP in memory
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', resolve);
      archive.on('error', reject);
      for (const { buf, caption } of images) {
        const readable = Readable.from(buf);
        archive.append(readable, { name: `card-${caption}.png` });
      }
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="carrossel.zip"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
