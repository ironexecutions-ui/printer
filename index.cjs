const express = require("express");
const cors = require("cors");
const { print } = require("pdf-to-printer");
const fs = require("fs");
const path = require("path");

// instruções  ----  https://chatgpt.com/s/t_694eed8e49dc81918b0d2b8eedd9dd9b
const fetch = global.fetch || require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3334;

app.post("/print", async (req, res) => {
    const { url, printer } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL do PDF não informada" });
    }

    // NOME ÚNICO PRA EVITAR CONFLITO
    const filePath = path.join(
        __dirname,
        `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
    );

    try {
        // RESPONDE IMEDIATO (EVITA TIMEOUT NO FASTAPI)
        res.json({ ok: true });

        // BAIXAR PDF
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        fs.writeFileSync(filePath, Buffer.from(buffer));

        // IMPRIMIR EM BACKGROUND
        await print(filePath, printer ? { printer } : undefined);

    } catch (err) {
        console.error("ERRO AO IMPRIMIR:", err);
    } finally {
        // LIMPEZA
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

app.get("/health", (req, res) => {
    res.json({ ok: true, service: "node-printer" });
});

app.listen(PORT, () => {
    console.log("🖨️ Node Printer rodando na porta 3334");
});
