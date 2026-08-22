const express = require("express");
const cors = require("cors");
const { print } = require("pdf-to-printer");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const fetch = global.fetch || require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3334;


// ============================================================
// CONFIGURAÇÕES PRINCIPAIS
// ============================================================
//
// ESSAS SÃO AS PRINCIPAIS CONFIGURAÇÕES QUE VOCÊ PODE
// ALTERAR EM CADA COMPUTADOR.
//
// Cada impressora pode precisar de valores diferentes.
// ============================================================


// ============================================================
// 1. NOME DA IMPRESSORA
// ============================================================
//
// Precisa ser EXATAMENTE o nome que aparece no Windows.
//
// Para descobrir os nomes das impressoras:
// PowerShell:
//
// Get-Printer | Select Name
//
// Exemplo atual:
// POS-80C
//
const DEFAULT_PRINTER = "POS-80C";


// ============================================================
// 2. ESCALA DA COMANDA
// ============================================================
//
// 1.00 = 100%
// 0.90 = 90%
// 0.80 = 80%
// 0.75 = 77%
// 0.70 = 70%
//
// Atualmente estamos usando 77%.
//
const ESCALA_IMPRESSAO = 0.75;


// ============================================================
// 3. DESLOCAMENTO PARA A ESQUERDA
// ============================================================
//
// Move TODO o conteúdo da comanda horizontalmente.
//
// Quanto MAIOR o número,
// mais para a ESQUERDA o conteúdo vai.
//
// Exemplos:
//
// 0  = nenhum deslocamento
// 10 = pouco
// 20 = médio
// 30 = mais
// 50 = deslocamento atual
//
// ATENÇÃO:
// Este valor é em pontos do PDF, não milímetros.
//
const DESLOCAMENTO_ESQUERDA = 50;


// ============================================================
// 4. PAPEL EXTRA DEPOIS DA COMANDA
// ============================================================
//
// Essa configuração faz a impressora avançar mais papel
// depois do último conteúdo.
//
// Isso serve para impedir que o último texto fique muito
// próximo da guilhotina/cortador.
//
// Exemplos:
//
// 5  = 5 mm extras
// 8  = 8 mm extras
// 10 = 10 mm extras
// 15 = 15 mm extras
//
// Atualmente:
// 8 mm de papel vazio no final.
//
const PAPEL_EXTRA_FINAL_MM = 8;


// ============================================================
// CONVERSÃO DE MILÍMETROS PARA PONTOS
// ============================================================
//
// O pdf-lib trabalha internamente em pontos.
//
// Aproximadamente:
//
// 1 mm = 2.83465 pontos
//
const MM_PARA_PONTOS = 2.83465;


// Converte os 8 mm configurados acima
// para a unidade utilizada pelo PDF.
const PAPEL_EXTRA_FINAL =
    PAPEL_EXTRA_FINAL_MM * MM_PARA_PONTOS;


// ============================================================
// OPÇÕES DO PDF-TO-PRINTER
// ============================================================

function criarOpcoesImpressao(printer) {

    return {

        // Se vier uma impressora na requisição,
        // utiliza ela.
        //
        // Caso contrário, usa DEFAULT_PRINTER.
        printer: printer || DEFAULT_PRINTER,

        // Não queremos que o pdf-to-printer
        // aplique outra escala.
        //
        // A escala de 77% já será aplicada
        // diretamente no PDF.
        scale: "noscale"
    };
}


// ============================================================
// CRIAR PDF PREPARADO PARA A IMPRESSORA
// ============================================================
//
// Essa função:
//
// 1. Abre o PDF original.
// 2. Reduz o conteúdo para 77%.
// 3. Move o conteúdo para a esquerda.
// 4. Adiciona 8 mm extras no final.
// 5. Salva um PDF temporário.
// 6. Esse PDF temporário é enviado para a POS-80C.
//
// O PDF original NÃO é alterado.
// ============================================================

async function criarPdfEscalado75(caminhoOriginal) {

    console.log("");
    console.log("=======================================");
    console.log(" PREPARANDO PDF PARA IMPRESSÃO");
    console.log("=======================================");

    console.log(
        `Escala: ${ESCALA_IMPRESSAO * 100}%`
    );

    console.log(
        `Deslocamento esquerda: ${DESLOCAMENTO_ESQUERDA} pontos`
    );

    console.log(
        `Papel extra final: ${PAPEL_EXTRA_FINAL_MM} mm`
    );


    // ========================================================
    // LER PDF ORIGINAL
    // ========================================================

    const bytesOriginal =
        fs.readFileSync(caminhoOriginal);


    // ========================================================
    // CARREGAR PDF ORIGINAL
    // ========================================================

    const pdfOriginal =
        await PDFDocument.load(bytesOriginal);


    // ========================================================
    // CRIAR NOVO PDF
    // ========================================================

    const pdfNovo =
        await PDFDocument.create();


    // ========================================================
    // PEGAR TODAS AS PÁGINAS
    // ========================================================

    const paginasOriginais =
        pdfOriginal.getPages();


    // ========================================================
    // PROCESSAR CADA PÁGINA
    // ========================================================

    for (
        let i = 0;
        i < paginasOriginais.length;
        i++
    ) {

        const paginaOriginal =
            paginasOriginais[i];


        // ====================================================
        // TAMANHO ORIGINAL
        // ====================================================

        const {
            width,
            height
        } = paginaOriginal.getSize();


        console.log("");
        console.log(
            `Página ${i + 1}`
        );

        console.log(
            `Tamanho original: ${width.toFixed(2)} x ${height.toFixed(2)}`
        );


        // ====================================================
        // INCORPORAR PÁGINA ORIGINAL
        // ====================================================

        const [paginaIncorporada] =
            await pdfNovo.embedPdf(
                bytesOriginal,
                [i]
            );


        // ====================================================
        // CALCULAR PAPEL EXTRA
        // ====================================================
        //
        // Aqui está a alteração que faz a impressora
        // liberar mais papel no final.
        //
        // Antes:
        //
        // height
        //
        // Agora:
        //
        // height + 8 mm
        //

        const alturaComPapelExtra =
            height + PAPEL_EXTRA_FINAL;


        console.log(
            `Altura com papel extra: ${alturaComPapelExtra.toFixed(2)} pontos`
        );


        // ====================================================
        // CRIAR NOVA PÁGINA
        // ====================================================
        //
        // A largura continua exatamente igual.
        //
        // Somente a altura recebe os 8 mm adicionais.
        //

        const paginaNova =
            pdfNovo.addPage([
                width,
                alturaComPapelExtra
            ]);


        // ====================================================
        // CALCULAR ESCALA
        // ====================================================
        //
        // ESCALA_IMPRESSAO = 0.75
        //
        // Portanto:
        //
        // conteúdo = 77% do tamanho original
        //

        const larguraEscalada =
            width * ESCALA_IMPRESSAO;

        const alturaEscalada =
            height * ESCALA_IMPRESSAO;


        // ====================================================
        // POSIÇÃO HORIZONTAL
        // ====================================================
        //
        // Primeiro centralizamos.
        //
        // Depois subtraímos DESLOCAMENTO_ESQUERDA.
        //
        // Isso move TODO o conteúdo para esquerda.
        //

        const x =
            (
                (width - larguraEscalada) / 2
            )
            - DESLOCAMENTO_ESQUERDA;


        // ====================================================
        // POSIÇÃO VERTICAL
        // ====================================================
        //
        // IMPORTANTE:
        //
        // Agora usamos alturaComPapelExtra.
        //
        // Isso mantém o conteúdo no topo e deixa
        // os 8 mm extras NA PARTE DE BAIXO.
        //
        // Se usássemos apenas "height" aqui,
        // poderíamos colocar o espaço extra no lugar errado.
        //

        const y =
            alturaComPapelExtra
            - alturaEscalada;


        // ====================================================
        // DESENHAR PDF ORIGINAL DENTRO DO NOVO PDF
        // ====================================================

        paginaNova.drawPage(
            paginaIncorporada,
            {
                x,
                y,
                width: larguraEscalada,
                height: alturaEscalada
            }
        );


        // ====================================================
        // LOGS
        // ====================================================

        console.log(
            `Conteúdo escalado: ${larguraEscalada.toFixed(2)} x ${alturaEscalada.toFixed(2)}`
        );

        console.log(
            `Posição X: ${x.toFixed(2)}`
        );

        console.log(
            `Posição Y: ${y.toFixed(2)}`
        );

        console.log(
            `Papel extra: ${PAPEL_EXTRA_FINAL_MM} mm`
        );
    }


    // ========================================================
    // SALVAR NOVO PDF
    // ========================================================

    const bytesNovo =
        await pdfNovo.save();


    // ========================================================
    // NOME DO PDF TEMPORÁRIO
    // ========================================================

    const caminhoEscalado =
        path.join(
            __dirname,
            `print_75_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}.pdf`
        );


    // ========================================================
    // GRAVAR NO COMPUTADOR
    // ========================================================

    fs.writeFileSync(
        caminhoEscalado,
        bytesNovo
    );


    console.log("");
    console.log(
        "PDF preparado:",
        caminhoEscalado
    );

    console.log(
        `Escala final: ${ESCALA_IMPRESSAO * 100}%`
    );

    console.log(
        `Papel extra final: ${PAPEL_EXTRA_FINAL_MM} mm`
    );


    // ========================================================
    // RETORNAR ARQUIVO PREPARADO
    // ========================================================

    return caminhoEscalado;
}


// ============================================================
// ROTA DE IMPRESSÃO
// ============================================================

app.post(
    "/print",
    async (req, res) => {

        const {
            url,
            file,
            printer
        } = req.body;


        console.log("");
        console.log("=======================================");
        console.log("        NOVA IMPRESSÃO");
        console.log("=======================================");


        console.log(
            "Printer recebido:",
            printer || "não informado"
        );


        console.log(
            "Printer utilizado:",
            printer || DEFAULT_PRINTER
        );


        console.log(
            "URL:",
            url || "não informada"
        );


        console.log(
            "Arquivo:",
            file || "não informado"
        );


        // ====================================================
        // RESPONDER IMEDIATAMENTE
        // ====================================================
        //
        // O sistema não precisa esperar a impressora
        // terminar fisicamente para receber resposta.
        //

        res.json({
            ok: true,

            printer:
                printer || DEFAULT_PRINTER,

            escala:
                `${ESCALA_IMPRESSAO * 100}%`,

            deslocamento_esquerda:
                DESLOCAMENTO_ESQUERDA,

            papel_extra_mm:
                PAPEL_EXTRA_FINAL_MM
        });


        // ====================================================
        // VARIÁVEIS DOS ARQUIVOS
        // ====================================================

        let filePath = null;

        let arquivoBaixado = null;

        let arquivoEscalado = null;


        try {

            // =================================================
            // OPÇÕES DA IMPRESSORA
            // =================================================

            const opcoes =
                criarOpcoesImpressao(
                    printer
                );


            // =================================================
            // CASO 1
            // ARQUIVO LOCAL
            // =================================================

            if (file) {

                console.log(
                    "Usando arquivo local..."
                );


                // =============================================
                // VERIFICAR SE EXISTE
                // =============================================

                if (!fs.existsSync(file)) {

                    throw new Error(
                        `Arquivo local não encontrado: ${file}`
                    );
                }


                // =============================================
                // USAR ARQUIVO
                // =============================================

                filePath = file;


                console.log(
                    "Arquivo local encontrado."
                );
            }


            // =================================================
            // CASO 2
            // PDF RECEBIDO POR URL
            // =================================================

            else if (url) {

                console.log(
                    "Baixando PDF..."
                );


                // =============================================
                // CRIAR NOME TEMPORÁRIO
                // =============================================

                arquivoBaixado =
                    path.join(
                        __dirname,

                        `temp_${Date.now()}_${Math.random()
                            .toString(36)
                            .slice(2)}.pdf`
                    );


                // =============================================
                // BAIXAR PDF
                // =============================================

                const response =
                    await fetch(url);


                console.log(
                    "Status download:",
                    response.status
                );


                // =============================================
                // VERIFICAR DOWNLOAD
                // =============================================

                if (!response.ok) {

                    throw new Error(
                        `Erro ao baixar PDF. HTTP ${response.status}`
                    );
                }


                // =============================================
                // CONVERTER RESPOSTA
                // =============================================

                const buffer =
                    await response.arrayBuffer();


                // =============================================
                // SALVAR PDF
                // =============================================

                fs.writeFileSync(
                    arquivoBaixado,
                    Buffer.from(buffer)
                );


                // =============================================
                // DEFINIR PDF PARA PROCESSAMENTO
                // =============================================

                filePath =
                    arquivoBaixado;


                console.log(
                    "PDF baixado:",
                    arquivoBaixado
                );


                console.log(
                    "Tamanho:",
                    fs.statSync(
                        arquivoBaixado
                    ).size,
                    "bytes"
                );
            }


            // =================================================
            // NENHUM PDF INFORMADO
            // =================================================

            else {

                throw new Error(
                    "Nenhuma URL ou arquivo informado"
                );
            }


            // =================================================
            // PREPARAR PDF
            // =================================================
            //
            // Aqui:
            //
            // 1. reduz para 77%
            // 2. move para esquerda
            // 3. adiciona 8 mm no final
            //

            arquivoEscalado =
                await criarPdfEscalado75(
                    filePath
                );


            // =================================================
            // ENVIAR PARA IMPRESSORA
            // =================================================

            console.log("");
            console.log(
                `Enviando PDF ${ESCALA_IMPRESSAO * 100}% para ${printer || DEFAULT_PRINTER}...`
            );


            await print(
                arquivoEscalado,
                opcoes
            );


            // =================================================
            // SUCESSO
            // =================================================

            console.log("");
            console.log("=======================================");
            console.log(" IMPRESSÃO ENVIADA COM SUCESSO");
            console.log(
                ` Escala: ${ESCALA_IMPRESSAO * 100}%`
            );
            console.log(
                ` Deslocamento esquerda: ${DESLOCAMENTO_ESQUERDA}`
            );
            console.log(
                ` Papel extra: ${PAPEL_EXTRA_FINAL_MM} mm`
            );
            console.log("=======================================");
        }

        catch (err) {

            // =================================================
            // ERRO
            // =================================================

            console.error("");
            console.error("=======================================");
            console.error(" ERRO AO IMPRIMIR");
            console.error("=======================================");


            console.error(
                "Mensagem:",
                err.message
            );


            console.error(
                "Erro completo:",
                err
            );
        }

        finally {

            // =================================================
            // APAGAR PDF BAIXADO
            // =================================================
            //
            // Só apagamos o arquivo criado pelo próprio
            // serviço.
            //
            // Um arquivo local enviado pelo usuário
            // NÃO é apagado.
            //

            if (
                arquivoBaixado &&
                fs.existsSync(
                    arquivoBaixado
                )
            ) {

                try {

                    fs.unlinkSync(
                        arquivoBaixado
                    );


                    console.log(
                        "PDF baixado removido."
                    );
                }

                catch (erro) {

                    console.error(
                        "Erro removendo PDF baixado:",
                        erro.message
                    );
                }
            }


            // =================================================
            // APAGAR PDF PREPARADO
            // =================================================

            if (
                arquivoEscalado &&
                fs.existsSync(
                    arquivoEscalado
                )
            ) {

                try {

                    fs.unlinkSync(
                        arquivoEscalado
                    );


                    console.log(
                        "PDF preparado temporário removido."
                    );
                }

                catch (erro) {

                    console.error(
                        "Erro removendo PDF preparado:",
                        erro.message
                    );
                }
            }
        }
    }
);


// ============================================================
// HEALTH
// ============================================================
//
// Permite verificar se o serviço local está funcionando.
//
// Abra:
//
// http://localhost:3334/health
//
// Se estiver funcionando, retornará JSON.
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "node-printer",

            printer:
                DEFAULT_PRINTER,

            escala:
                `${ESCALA_IMPRESSAO * 100}%`,

            deslocamento_esquerda:
                DESLOCAMENTO_ESQUERDA,

            papel_extra_mm:
                PAPEL_EXTRA_FINAL_MM
        });
    }
);


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log("=======================================");
        console.log(" NODE PRINTER INICIADO");
        console.log("=======================================");

        console.log(
            `Porta: ${PORT}`
        );

        console.log(
            `Impressora: ${DEFAULT_PRINTER}`
        );

        console.log(
            `Escala automática: ${ESCALA_IMPRESSAO * 100}%`
        );

        console.log(
            `Deslocamento esquerda: ${DESLOCAMENTO_ESQUERDA}`
        );

        console.log(
            `Papel extra final: ${PAPEL_EXTRA_FINAL_MM} mm`
        );

        console.log("=======================================");
        console.log("");
    }
);