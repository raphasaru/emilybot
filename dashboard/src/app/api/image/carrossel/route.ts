import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';
import { uploadImage, saveImageUrls } from '../../../lib/storageUpload';

export const runtime = 'nodejs';

const require = createRequire(import.meta.url);
const { generateCarouselImages, parseCarouselCards } = require(
  path.resolve(process.cwd(), '..', 'src', 'services', 'imageGenerator')
);

export async function POST(req: NextRequest) {
  const { final_content, draft_id } = await req.json();
  if (!final_content) return NextResponse.json({ error: 'final_content required' }, { status: 400 });

  try {
    const cards = parseCarouselCards(final_content);
    const images: { buf: Buffer; caption: string }[] = await generateCarouselImages(cards);

    if (draft_id) {
      const urls = await Promise.all(
        images.map(({ buf, caption }, i) => {
          const idx = String(i + 1).padStart(2, '0');
          return uploadImage(`${draft_id}/slide-${idx}-${caption}.png`, buf);
        })
      );
      await saveImageUrls(draft_id, urls);
      return NextResponse.json({ urls });
    }

    // Fallback sem draft_id: retorna zip
    const { Readable } = await import('stream');
    const archiver = (await import('archiver')).default;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', resolve);
      archive.on('error', reject);
      for (const { buf, caption } of images) {
        archive.append(Readable.from(buf), { name: `card-${caption}.png` });
      }
      archive.finalize();
    });
    return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="carrossel.zip"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
