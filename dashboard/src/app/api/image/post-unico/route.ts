import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { uploadImage, saveImageUrls } from '../../../lib/storageUpload';

export const runtime = 'nodejs';

// eslint-disable-next-line no-eval
const nativeRequire = eval('require');
const { generatePostUnico } = nativeRequire(
  path.resolve(process.cwd(), '..', 'src', 'services', 'imageGenerator')
);

export async function POST(req: NextRequest) {
  const { text, draft_id } = await req.json();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  try {
    const buf: Buffer = await generatePostUnico(text);

    if (draft_id) {
      const storagePath = `${draft_id}/post.png`;
      const url = await uploadImage(storagePath, buf);
      await saveImageUrls(draft_id, [url]);
      return NextResponse.json({ urls: [url] });
    }

    // Fallback: sem draft_id, retorna blob direto
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
