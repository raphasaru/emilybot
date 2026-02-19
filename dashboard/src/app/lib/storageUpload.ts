import { getSupabase } from './supabase';

const BUCKET = 'draft-images';

export async function uploadImage(storagePath: string, buffer: Buffer): Promise<string> {
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function saveImageUrls(draftId: string, urls: string[]): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('content_drafts')
    .update({ image_urls: urls })
    .eq('id', draftId);
  if (error) throw new Error(`DB update failed: ${error.message}`);
}
