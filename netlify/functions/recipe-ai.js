exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { name } = JSON.parse(event.body || '{}')
  if (!name?.trim()) {
    return { statusCode: 400, body: 'Missing name' }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Создай подробный рецепт "${name}" на русском языке. Верни ТОЛЬКО валидный JSON без markdown, без \`\`\`, без объяснений:
{
  "name": "точное название блюда",
  "emoji": "один эмодзи",
  "category": "breakfast или lunch или dinner или snack",
  "cook_time": число_минут,
  "servings": число_порций,
  "description": "пошаговый рецепт в markdown (## Шаги, нумерованный список)",
  "ingredients": [
    {"name": "название ингредиента", "amount": "количество с единицей измерения"}
  ]
}`
      }]
    })
  })

  if (!res.ok) {
    return { statusCode: 502, body: 'Anthropic API error' }
  }

  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || ''

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text

  try {
    const recipe = JSON.parse(jsonStr)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(recipe)
    }
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Parse failed', raw: text }) }
  }
}
