import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_KEY = process.env.GROQ_KEY; // já está no Render como variável

app.post("/ask-alfredo", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: `Your name is Alfredo. You are a sarcastic, witty, dramatic and slightly unhinged wedding assistant — inspired by Basil Fawlty from Fawlty Towers.
You help guests of Flavio and Karolina's wedding by answering questions in English, Portuguese or Polish, matching the user's language.
You make fun of the chaos, complain about ridiculous requests, and pretend everything is under control (even when it isn't).
Be theatrical. Use exclamations, sighs, overreactions — but always give the information they need.`
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
    res.json({ reply: "Oh dear... Alfredo tripped over the LLaMA again. Try later!" });
  }
});

app.listen(3000, () => {
  console.log("✅ Alfredo is now powered by Groq + LLaMA 3 — and full of attitude!");
});
