/**
 * Calls the Featherless AI API directly from the frontend to parse expense transcripts.
 * WARNING: The API key is embedded at build time and visible in the client bundle.
 */

// The Featherless API key — set via VITE_FEATHERLESS_API_KEY in your build environment
const FEATHERLESS_API_KEY = import.meta.env.VITE_FEATHERLESS_API_KEY ?? '';
const FEATHERLESS_API_URL = 'https://api.featherless.ai/v1/chat/completions';

export interface FeatherlessParseResult {
  amount: number | null;
  category: string;
  note: string;
  splitType: 'equal' | 'usage';
  scope: 'individual' | 'collective';
  usageAmount: number | null;
  usageUnit: string | null;
  usageHours: number | null;
}

export async function parseWithFeatherless(transcript: string): Promise<FeatherlessParseResult> {
  if (!FEATHERLESS_API_KEY) {
    throw new Error('Featherless API key is not configured. Set VITE_FEATHERLESS_API_KEY in your environment.');
  }

  const systemPrompt =
    'Parse the Urdu/English voice text to JSON with keys: category, amount, note, scope, usageHours. DO NOT include raw math expressions in note/title. Output only clean JSON.';

  const response = await fetch(FEATHERLESS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FEATHERLESS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.2-3B-Instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  // Log the direct response status for debugging
  console.log('[FeatherlessParser] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Featherless AI returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from Featherless AI.');
  }

  // Extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON.');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    category: parsed.category || 'other',
    note: parsed.note || transcript,
    splitType: parsed.splitType === 'usage' ? 'usage' : 'equal',
    scope: parsed.scope === 'individual' ? 'individual' : 'collective',
    usageAmount: typeof parsed.usageAmount === 'number' ? parsed.usageAmount : null,
    usageUnit: parsed.usageUnit || null,
    usageHours: typeof parsed.usageHours === 'number' ? parsed.usageHours : null,
  };
}