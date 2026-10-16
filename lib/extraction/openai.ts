import { extractionSchema, type Extraction } from '@/lib/validation';
import { EXTRACTION_PROMPT } from './prompt';

type DocumentInput = { bytes: Uint8Array; mimeType: string; filename: string };
export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly rawOutput?: string,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export async function extractInvoice(
  { bytes, mimeType, filename }: DocumentInput,
  fetcher: typeof fetch = fetch,
): Promise<{ extraction: Extraction; raw: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ExtractionError('OPENAI_API_KEY is not configured.');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const fileData = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
  const content =
    mimeType === 'application/pdf'
      ? { type: 'input_file', filename, file_data: fileData }
      : { type: 'input_image', detail: 'high', image_url: fileData };
  let response: Response;
  try {
    response = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: EXTRACTION_PROMPT,
        input: [
          {
            role: 'user',
            content: [
              content,
              {
                type: 'input_text',
                text: 'Extract every requested field. Return one JSON object only. Use null for unsupported values.',
              },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 4000,
        store: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new ExtractionError('The extraction service could not be reached. Retry processing later.');
  }
  if (!response.ok) {
    throw new ExtractionError(`The extraction service returned HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  const raw =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
  if (!raw) throw new ExtractionError('The extraction service returned no structured output.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExtractionError('The extraction service returned invalid JSON.', raw);
  }
  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success)
    throw new ExtractionError('The extracted fields did not match the required invoice schema.', raw);
  return { extraction: validated.data, raw, model };
}
