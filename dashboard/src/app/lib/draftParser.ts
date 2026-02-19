// Parses final_content JSON into human-readable text for editing,
// and serializes it back to JSON on save.

interface FormattedDraft {
  format: string;
  content: unknown;
  publishing_notes?: string;
}

// Portuguese labels for carousel card fields
const PT_TO_EN: Record<string, string> = {
  título: 'title',
  corpo: 'body',
  label: 'label',
  métrica: 'metric',
  contexto: 'context',
  esquerda: 'left',
  direita: 'right',
  questão: 'question',
  ação: 'action',
};
const EN_TO_PT: Record<string, string> = Object.fromEntries(
  Object.entries(PT_TO_EN).map(([pt, en]) => [en, pt])
);

// ─── CARD HELPERS ────────────────────────────────────────────────────────────

function cardToText(card: Record<string, unknown>): string {
  const header = `[${card.slide ?? '?'} · ${card.type ?? 'slide'}]`;
  const fields: string[] = [];
  for (const [en, pt] of Object.entries(EN_TO_PT)) {
    if (card[en] !== undefined && card[en] !== '') {
      fields.push(`${pt}: ${card[en]}`);
    }
  }
  return header + (fields.length ? '\n' + fields.join('\n') : '');
}

function textToCard(block: string, original: Record<string, unknown>): Record<string, unknown> {
  const lines = block.split('\n');
  const headerMatch = lines[0].match(/^\[(.+?)\s*·\s*(.+?)\]$/);
  const card: Record<string, unknown> = { ...original };
  if (headerMatch) {
    card.slide = headerMatch[1].trim();
    card.type = headerMatch[2].trim();
  }
  for (const line of lines.slice(1)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const pt = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    const en = PT_TO_EN[pt];
    if (en) card[en] = value;
  }
  return card;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export interface EditableContent {
  text: string;
  notes: string;
  parsed: FormattedDraft | null;
}

export function parseForEdit(rawContent: string | null | undefined): EditableContent {
  if (!rawContent) return { text: '', notes: '', parsed: null };

  let parsed: FormattedDraft;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Not JSON — show as plain text
    return { text: rawContent, notes: '', parsed: null };
  }

  const { content, publishing_notes = '' } = parsed;
  let text: string;

  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    if (content.length === 0) {
      text = '';
    } else if (typeof content[0] === 'string') {
      // Thread: array of tweet strings
      text = (content as string[]).join('\n\n---\n\n');
    } else {
      // Carousel: array of card objects
      text = (content as Record<string, unknown>[]).map(cardToText).join('\n\n');
    }
  } else {
    text = JSON.stringify(content, null, 2);
  }

  return { text, notes: String(publishing_notes), parsed };
}

export function buildForSave(
  editedText: string,
  editedNotes: string,
  parsed: FormattedDraft | null,
  fallbackRaw: string
): string {
  if (!parsed) {
    // Was plain text to begin with — wrap minimally
    return editedText;
  }

  let newContent: unknown;
  const original = parsed.content;

  if (typeof original === 'string') {
    newContent = editedText;
  } else if (Array.isArray(original)) {
    if (original.length > 0 && typeof original[0] === 'string') {
      // Thread
      newContent = editedText
        .split(/\n\n---\n\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Carousel: split back into blocks by header line
      const blocks = editedText
        .split(/\n(?=\[)/)
        .map((b) => b.trim())
        .filter(Boolean);
      const originalCards = original as Record<string, unknown>[];
      newContent = blocks.map((block, i) => textToCard(block, originalCards[i] ?? {}));
    }
  } else {
    newContent = editedText;
  }

  return JSON.stringify({ ...parsed, content: newContent, publishing_notes: editedNotes });
}

// Extract plain text for post_unico image generation (strip JSON wrapper)
export function extractPostText(rawContent: string | null | undefined): string {
  const { text } = parseForEdit(rawContent);
  return text;
}
