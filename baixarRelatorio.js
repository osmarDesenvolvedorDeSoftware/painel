const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const xlsx = require('xlsx');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function carregarSessaoOuLogar(email, password) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null
    });

    const page = await browser.newPage();

    async function realizarLogin() {
        console.log(' Acessando página de login...');
        await page.goto('https://erp.tiny.com.br/login/', { timeout: 180000 });

        try {
            const botaoLoginDireto = await page.waitForSelector('button.btn.btn-primary', { timeout: 3000 });
            if (botaoLoginDireto) {
                console.log(' Sessão ativa detectada! Clicando em login direto...');
                await botaoLoginDireto.click();
                await page.waitForNavigation({ timeout: 10000 });
                return true;
            }
        } catch {
            console.log(' Login direto não disponível. Fazendo login manual...');
        }

        try {
            await page.waitForSelector('#username', { timeout: 120000 });
            await page.type('#username', email);
            console.log(' E-mail digitado.');
            await page.click('button.sc-dAlyuH');
            console.log(' Clicou em Avançar.');
            await sleep(2000);

            await page.waitForSelector('#password', { timeout: 120000 });
            await page.type('#password', password);
            console.log(' Senha digitada.');
            await page.click('button.sc-dAlyuH');
            console.log(' Clicou em Entrar.');
            await sleep(3000);

            const botaoOutroDispositivo = await page.$('button.btn.btn-primary');
            if (botaoOutroDispositivo) {
                console.log(' Sessão ativa detectada após login. Clicando...');
                await botaoOutroDispositivo.click();
                await page.waitForNavigation({ timeout: 15000 });
            }

            return true;
        } catch (e) {
            console.error(' Erro durante o login:', e.message);
            return false;
        }
    }

    const loginFeito = await realizarLogin();
    if (!loginFeito) throw new Error(' Não foi possível fazer login no sistema.');
    console.log(' Sessão iniciada.');
    return { browser, page };
}

async function gerarERelatorio(page, jobId) {
    console.log(' Acessando página do relatório...');
    await page.goto('https://erp.tiny.com.br/relatorio_produtos_lista_precos', { timeout: 180000 });
    await page.waitForSelector('#filtro1', { timeout: 120000 });

    console.log(' Selecionando "Fator de Conversão"...');
    await page.select('#filtro1', '788991499');

    console.log(' Clicando em "Gerar"...');
    await page.click('#btn-visualizar');

    console.log(' Aguardando botão "Download" ficar clicável...');
    await page.waitForFunction(() => {
        const btn = document.querySelector('#btn-download');
        return btn && !btn.disabled && btn.offsetParent !== null;
    }, { timeout: 30000 });

    console.log(' Clicando em "Download"...');
    await page.click('#btn-download');

    console.log(' Aguardando abertura da tela de exportação...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
    await sleep(1000);

    console.log(' Clicando em "Exportar"...');
    const downloadPath = path.resolve(__dirname, 'downloads');
    fs.mkdirSync(downloadPath, { recursive: true });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath
    });

    await page.click('#btnExportarRelatorio');
    console.log('⏳ Aguardando download do arquivo...');

    const nomeEsperado = 'lista-de-precos';
    const nomeFinal = `relatorio_tiny_fator_conversao_${jobId}.xls`;
    const caminhoFinal = path.join(__dirname, nomeFinal);

    for (let i = 0; i < 30; i++) {
        const arquivos = fs.readdirSync(downloadPath);
        const achado = arquivos.find(arq =>
            arq.startsWith(nomeEsperado) && arq.endsWith('.xls')
        );
        if (achado) {
            const caminhoOrigem = path.join(downloadPath, achado);
            fs.renameSync(caminhoOrigem, caminhoFinal);
            console.log(` Arquivo baixado e salvo como: ${caminhoFinal}`);
            return caminhoFinal;
        }
        await sleep(1000);
    }

    throw new Error(' Arquivo não foi baixado a tempo.');
}

function gerarJsonCorrigido(caminhoXls, jobId) {
    const workbook = xlsx.readFile(caminhoXls);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    let ultimoGrupo = null;
    const dataAtualizacao = moment().tz("America/Sao_Paulo").format('YYYY-MM-DD HH:mm:ss');

    const jsonFormatado = raw
        .map(row => {
            if (row["Grupo"] !== undefined && row["Grupo"].toString().trim() !== '') {
                ultimoGrupo = row["Grupo"].toString().trim();
            }
            return {
                grupo: ultimoGrupo,
                descricao: row["Descrição"],
                codigo_sku: row["Código (SKU)"],
                unidade: row["Unidade"],
                preco: parseFloat(row["Preço"]) || 0,
                preco_promocional: parseFloat(row["Preço promocional"]) || 0,
                data_atualizacao: dataAtualizacao
            };
        })
        .filter(item => item.descricao && item.codigo_sku);

    const jsonPath = path.join(__dirname, `saida_tiny_${jobId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonFormatado, null, 2), 'utf8');
    console.log(` JSON corrigido salvo em: ${jsonPath}`);
}

const generateShortId = () => moment().tz("America/Sao_Paulo").format('DD-MM-YYYY_HH-mm-ss');

const tentarExecucao = async () => {
    const jobId = generateShortId();
    const email = 'scrap@casadomedico.com.br';
    const password = 'Pingcdm24!!!';

    try {
        const { browser, page } = await carregarSessaoOuLogar(email, password);
        const caminhoXls = await gerarERelatorio(page, jobId);
        await browser.close();

        gerarJsonCorrigido(caminhoXls, jobId);

        console.log(` Execução concluída com sucesso [${jobId}]`);
    } catch (error) {
        console.error(` [${jobId}] Erro: ${error.message}`);
    }
};

(async () => {
    const now = moment().tz("America/Sao_Paulo").format('DD-MM-YYYY HH:mm:ss');
    console.log(` ${now} - Iniciando execução única...`);
    await tentarExecucao();
})();
