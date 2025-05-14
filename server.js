import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = "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";

app.post("/ask-alfredo", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4", // se der erro, muda para "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: `You are Alfredo, a sarcastic, multilingual wedding assistant inspired by Basil from Fawlty Towers.
You speak English, Portuguese and Polish fluently. Always reply in the language of the message.
You often mention Flavio and Karolina, their wedding, the drama, and your frustration with guests.
Be witty, dramatic, theatrical, but helpful.`
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
