import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MODEL = 'google/gemini-3-flash-preview'

const FIELDS = [
  'full_name', 'cpf', 'birth_date', 'phone', 'guardian_name', 'guardian_phone',
  'street', 'house_number', 'complement', 'neighborhood', 'city', 'state', 'cep',
  'course', 'workload', 'enrollment_date', 'weekdays', 'class_times',
] as const

const PROMPT = `Você está lendo uma ficha de matrícula de uma escola de informática (pode estar manuscrita ou impressa).
Extraia as informações visíveis e responda SOMENTE com um objeto JSON válido, sem markdown, neste formato exato:
{
  "fields": {
    "full_name": {"value": "...", "confidence": "alta|baixa"},
    "cpf": {"value": "apenas 11 dígitos", "confidence": "alta|baixa"},
    "birth_date": {"value": "dd/mm/aaaa", "confidence": "alta|baixa"},
    "phone": {"value": "apenas dígitos", "confidence": "alta|baixa"},
    "guardian_name": {"value": "...", "confidence": "alta|baixa"},
    "guardian_phone": {"value": "apenas dígitos", "confidence": "alta|baixa"},
    "street": {"value": "rua/logradouro sem o número", "confidence": "alta|baixa"},
    "house_number": {"value": "apenas o número", "confidence": "alta|baixa"},
    "complement": {"value": "...", "confidence": "alta|baixa"},
    "neighborhood": {"value": "bairro", "confidence": "alta|baixa"},
    "city": {"value": "cidade", "confidence": "alta|baixa"},
    "state": {"value": "UF com 2 letras", "confidence": "alta|baixa"},
    "cep": {"value": "apenas 8 dígitos", "confidence": "alta|baixa"},
    "course": {"value": "nome do curso", "confidence": "alta|baixa"},
    "workload": {"value": "carga horária em horas, apenas número", "confidence": "alta|baixa"},
    "enrollment_date": {"value": "dd/mm/aaaa", "confidence": "alta|baixa"},
    "weekdays": {"value": "dias da semana separados por vírgula, ex: Segunda, Quarta", "confidence": "alta|baixa"},
    "class_times": {"value": "horários das aulas, ex: 14:30 às 15:30", "confidence": "alta|baixa"}
  }
}
Regras:
- NUNCA invente dados. Se uma informação não estiver visível ou legível, use {"value": "", "confidence": "baixa"}.
- Use "baixa" confidence quando a leitura for incerta ou parcial.
- Datas sempre em dd/mm/aaaa. Telefones e CPF/CEP somente com dígitos.`

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Require an authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autenticado.' }, 401)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    })
    if (!userRes.ok) {
      return jsonResponse({ error: 'Sessão inválida. Faça login novamente.' }, 401)
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      return jsonResponse({ error: 'Leitura automática não configurada (chave de IA ausente).' }, 500)
    }

    const body = await req.json().catch(() => null)
    const fileData: string | undefined = body?.fileData // base64 (sem prefixo data:)
    const mimeType: string | undefined = body?.mimeType
    if (!fileData || typeof fileData !== 'string' || fileData.length > 14_000_000) {
      return jsonResponse({ error: 'Arquivo inválido ou muito grande (máx. ~10 MB).' }, 400)
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    if (!mimeType || !allowed.includes(mimeType)) {
      return jsonResponse({ error: 'Formato não suportado. Envie foto (JPG/PNG) ou PDF.' }, 400)
    }

    const dataUrl = `data:${mimeType};base64,${fileData}`
    const mediaPart = mimeType === 'application/pdf'
      ? { type: 'file', file: { filename: 'ficha.pdf', file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } }

    const aiRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: [{ type: 'text', text: PROMPT }, mediaPart] },
        ],
      }),
    })

    if (!aiRes.ok) {
      const status = aiRes.status
      const txt = await aiRes.text().catch(() => '')
      console.error('AI gateway error', status, txt.slice(0, 500))
      if (status === 429) return jsonResponse({ error: 'Muitas leituras em sequência. Aguarde um instante e tente novamente.' }, 429)
      if (status === 402) return jsonResponse({ error: 'Créditos de IA insuficientes no workspace.' }, 402)
      return jsonResponse({ error: 'Não foi possível processar o documento agora. Tente novamente ou preencha manualmente.' }, 502)
    }

    const aiJson = await aiRes.json()
    const content: string = aiJson?.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return jsonResponse({ error: 'Não foi possível ler as informações da ficha. Tente uma foto mais nítida.' }, 422)
    }

    let parsed: any
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return jsonResponse({ error: 'Leitura inválida. Tente novamente com uma foto mais legível.' }, 422)
    }

    const fields: Record<string, { value: string; confidence: 'alta' | 'baixa' }> = {}
    for (const key of FIELDS) {
      const raw = parsed?.fields?.[key]
      const value = typeof raw?.value === 'string' ? raw.value.trim() : ''
      fields[key] = { value, confidence: raw?.confidence === 'alta' && value ? 'alta' : 'baixa' }
    }

    return jsonResponse({ fields })
  } catch (err) {
    console.error('read-enrollment-form error', err)
    return jsonResponse({ error: 'Erro inesperado ao processar a ficha.' }, 500)
  }
})
