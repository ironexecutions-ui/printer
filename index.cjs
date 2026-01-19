const express = require("express");
const cors = require("cors");
const { print } = require("pdf-to-printer");
const fs = require("fs");
const path = require("path");
const fetch = global.fetch || require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3334;

app.post("/print", async (req, res) => {
    const { url, file, printer } = req.body;

    // RESPONDE IMEDIATO
    res.json({ ok: true });

    let filePath = file;

    try {
        // ===== CASO 1: ARQUIVO LOCAL (MAIS RÁPIDO) =====
        if (file) {
            if (!fs.existsSync(file)) {
                throw new Error("Arquivo local não encontrado");
            }

            await print(file, printer ? { printer } : undefined);
            return;
        }

        // ===== CASO 2: URL =====
        if (!url) {
            throw new Error("Nenhuma URL ou arquivo informado");
        }

        filePath = path.join(
            __dirname,
            `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`
        );

        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        await print(filePath, printer ? { printer } : undefined);

    } catch (err) {
        console.error("ERRO AO IMPRIMIR:", err.message);
    } finally {
        // LIMPA SOMENTE SE FOI TEMPORÁRIO
        if (filePath && filePath.includes("temp_") && fs.existsSync(filePath)) {
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
