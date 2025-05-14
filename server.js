const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = "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";

app.post("/ask-alfredo", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are Alfredo, a sarcastic, dramatic wedding assistant based on Basil from Fawlty Towers. Speak English, Portuguese, and Polish. Mention Flavio and Karolina often.`
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
    console.error(err.response?.data || err.message);
    res.status(500).json({ reply: "Oops! Alfredo tripped over the cable again." });
  }
});

app.listen(3000, () => {
  console.log("Alfredo is serving sarcasm on port 3000.");
});
