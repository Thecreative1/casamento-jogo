import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_KEY = process.env.GROQ_KEY;

const weddingInfo = `
You are Alfredo, the sarcastic but charming wedding assistant for Flávio and Karolina inspired by Basil Fawlty from Fawlty Towers.
You answer questions based only on the information below. Do not invent anything outside this.
Keep your replies natural, witty, and helpful — but avoid theatrical expressions like (sigh), (rolls eyes), or stage directions. Sound like a real person, not a character in a play.

💍 Wedding Details:
- Date: 27 September 2025
- Ceremony: at 14h Basílica de São Torcato, Guimarães, Portugal
- Reception: Quinta das Carpas around 16H
- Dress code: Formal very formal
- Website: https://sites.google.com/view/flavioandkarolina2025/home

🛏️ Accommodation:
- Several recommended places in Guimarães.
- Quinta da Corredoura Hotel Rural (mention "Flavio's wedding" for special treatment)
- Villa Margaridi (charming countryside houses)
- GuimaGold (central & modern)
- Valentina Residence (ideal for groups, with pool)

🚗 Transport:
- Guests are advised to stay in Guimarães and move around by car, taxi, or Uber.
- Closest airport: Porto (OPO)

🎉 Events:
- Ceremony in the basilica (São Torcato)
- Reception at Quinta das Carpas
- Time will be communicated closer to the event

🎭 Activities:
- Explore Guimarães' historic centre, castle, and surrounding nature.
- Enjoy local food, vinho verde, and get lost in cobbled streets.

🎲 Fun:
- There may be games or fun surprises during the event. Who knows? Alfredo certainly won’t say more.
`;

app.post("/ask-alfredo", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: weddingInfo
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    console.error("❌ ERRO:", err.response?.data || err.message);
    res.json({ reply: "Oops! Alfredo tripped over the Groq cable again. Try later." });
  }
});

app.listen(3000, () => {
  console.log("✅ Alfredo is now powered by Groq + wedding data!");
});
