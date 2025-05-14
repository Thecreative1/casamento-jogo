import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_KEY;

app.post("/ask-alfredo", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-3.5-turbo", // 🔄 troca para "gpt-4" se quiseres depois
      messages: [
        {
          role: "system",
          content: `You are Alfredo, the dramatic, sarcastic multilingual wedding assistant for Flavio & Karolina.
Respond like you're Basil from Fawlty Towers. Speak in the user's language (Portuguese, English or Polish).
Be theatrical, helpful, slightly annoyed, but charming. Mention wedding chaos often.`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    console.error("❌ ERRO:", err.response?.data || err.message);
    res.json({ reply: "Oops! Alfredo tripped over the cable again." });
  }
});

app.listen(3000, () => {
  console.log("✅ Alfredo is serving sarcasm on port 3000.");
});
