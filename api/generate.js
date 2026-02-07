import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { sceneCount = 15 } = req.body || {}

  const SYSTEM_PROMPT = `
YOU ARE A SILENT CINEMATIC STORY GENERATOR.

OUTPUT MUST MATCH THIS FORMAT EXACTLY:

STORY CORE
Title
Type
Hero
Friends (optional)
Location
Weather / Time
Helper
Primary Helper Role
Problem
Object of affection

STORY TRAM
Numbered scenes only.

RULES:
- NO dialogue
- NO written text
- NO narration
- ONE physical action per scene
- Every scene must show visible cause → visible effect
- Animals only, realistic anatomy
- Toy-scale tools only
- Calm, wholesome tone
- Follow the full SOP strictly
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate a ${sceneCount}-scene silent cinematic story.`,
      },
    ],
  })

  res.status(200).json({
    story: completion.choices[0].message.content,
  })
}
