import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

export const runtime = 'nodejs';

const require = createRequire(import.meta.url);
const { generatePostUnico } = require(
  path.resolve(process.cwd(), '..', 'src', 'services', 'imageGenerator')
);

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  try {
    const buf: Buffer = await generatePostUnico(text);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline; filename="post.png"',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
