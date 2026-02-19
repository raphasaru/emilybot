import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { urls, topic } = await req.json() as { urls: string[]; topic?: string };
  if (!urls?.length) return NextResponse.json({ error: 'urls required' }, { status: 400 });

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', resolve);
    archive.on('error', reject);

    const work = urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const idx = String(i + 1).padStart(2, '0');
      archive.append(Readable.from(buf), { name: `slide-${idx}.png` });
    });

    Promise.all(work).then(() => archive.finalize()).catch(reject);
  });

  const slug = (topic ?? 'carrossel').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);

  return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}.zip"`,
    },
  });
}
