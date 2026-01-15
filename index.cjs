const express = require("express");
const cors = require("cors");
const { print } = require("pdf-to-printer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3333;

app.post("/print", async (req, res) => {
    const { url, printer } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL do PDF não informada" });
    }

    try {
        const filePath = path.join(__dirname, "temp.pdf");

        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        fs.writeFileSync(filePath, Buffer.from(buffer));

        await print(filePath, printer ? { printer } : undefined);

        fs.unlinkSync(filePath);

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao imprimir" });
    }
});

app.get("/health", (req, res) => {
    res.json({ ok: true, service: "node-printer" });
});
app.listen(PORT, () => {
    console.log("🖨️ Node Printer rodando na porta 3333");
});
