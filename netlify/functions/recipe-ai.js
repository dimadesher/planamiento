exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { name, mode, recipe, instruction, image } = JSON.parse(event.body || '{}')
  if (!name?.trim()) {
    return { statusCode: 400, body: 'Missing name' }
  }

  const descriptionOnly = mode === 'description'
  const refineRecipe = mode === 'refine'
  const currentRecipeText = recipe ? JSON.stringify(recipe, null, 2) : '{}'
  const hasImage = image?.data && image?.mediaType
  const prompt = refineRecipe
    ? `Пользователь хочет скорректировать уже сгенерированный рецепт "${name}".
Текущая версия рецепта:
${currentRecipeText}

Просьба пользователя: ${instruction || 'улучши рецепт'}

Верни обновленный рецепт на русском языке. Сохрани уже подходящие поля, измени только то, что нужно по просьбе.
Верни ТОЛЬКО валидный JSON без markdown, без \`\`\`, без объяснений:
{
  "name": "точное название блюда",
  "emoji": "один эмодзи",
  "category": "breakfast или lunch или dinner или snack",
  "cook_time": число_минут,
  "servings": число_порций,
  "description": "пошаговый рецепт в markdown (## Шаги, нумерованный список)",
  "ingredients": [
    {"name": "название ингредиента", "amount": "количество и единица"}
  ]
}
Правила для amount: только единицы г, кг, мл, л, шт., ст.л., ч.л., щепотка, по вкусу.`
    : descriptionOnly
    ? `Создай пошаговый способ приготовления для блюда "${name}" на русском языке.
Учитывай данные формы:
- категория: ${recipe?.category || 'не указана'}
- время: ${recipe?.cook_time || 'не указано'} минут
- порций: ${recipe?.servings || 'не указано'}
- ингредиенты: ${(recipe?.ingredients || []).map(i => `${i.name}${i.amount ? ` — ${i.amount}` : ''}`).join(', ') || 'не указаны'}
${hasImage ? '\nК запросу приложено изображение рецепта, страницы книги, заметки или упаковки. Прочитай видимый текст и используй его как главный источник для шагов приготовления. Если часть текста неразборчива, аккуратно восстанови по контексту и ингредиентам.' : ''}

Верни ТОЛЬКО валидный JSON без markdown, без \`\`\`, без объяснений:
{
  "description": "пошаговый рецепт в markdown (## Шаги, нумерованный список)"
}`
    : `Создай подробный рецепт "${name}" на русском языке. Верни ТОЛЬКО валидный JSON без markdown, без \`\`\`, без объяснений:
{
  "name": "точное название блюда",
  "emoji": "один эмодзи",
  "category": "breakfast или lunch или dinner или snack",
  "cook_time": число_минут,
  "servings": число_порций,
  "description": "пошаговый рецепт в markdown (## Шаги, нумерованный список)",
  "ingredients": [
    {"name": "название ингредиента", "amount": "количество и единица"}
  ]
}
Правила для поля amount: используй ТОЛЬКО эти единицы измерения: г, кг, мл, л, шт., ст.л., ч.л., щепотка, по вкусу.
Формат: "число единица" (например: "200 г", "2 ст.л.", "1 шт."). Для щепотка и по вкусу — только само слово без числа.`

  const messageContent = hasImage
    ? [
        { type: 'text', text: prompt },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mediaType,
            data: image.data
          }
        }
      ]
    : prompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: refineRecipe ? 1200 : descriptionOnly ? 900 : 1024,
      messages: [{
        role: 'user',
        content: messageContent
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
