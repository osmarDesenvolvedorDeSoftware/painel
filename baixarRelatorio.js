const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const email = 'scrap@casadomedico.com.br';
  const password = 'Pingcdm24!!!';
  const jobId = moment().tz("America/Sao_Paulo").format('DD-MM-YYYY_HH-mm-ss');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.goto('https://erp.tiny.com.br/login/', { timeout: 180000 });

    try {
      const botaoLoginDireto = await page.waitForSelector('button.btn.btn-primary', { timeout: 3000 });
      if (botaoLoginDireto) {
        await botaoLoginDireto.click();
        await page.waitForNavigation({ timeout: 10000 });
      }
    } catch {}

    await page.waitForSelector('#username', { timeout: 120000 });
    await page.type('#username', email);
    await page.click('button.sc-dAlyuH');
    await sleep(2000);

    await page.waitForSelector('#password', { timeout: 120000 });
    await page.type('#password', password);
    await page.click('button.sc-dAlyuH');
    await sleep(3000);

    const botaoOutroDispositivo = await page.$('button.btn.btn-primary');
    if (botaoOutroDispositivo) {
      await botaoOutroDispositivo.click();
      await page.waitForNavigation({ timeout: 15000 });
    }

    await page.goto('https://erp.tiny.com.br/relatorio_produtos_lista_precos', { timeout: 180000 });
    await page.waitForSelector('#filtro1', { timeout: 120000 });
    await page.select('#filtro1', '788991499');
    await page.click('#btn-visualizar');

    await page.waitForFunction(() => {
      const btn = document.querySelector('#btn-download');
      return btn && !btn.disabled && btn.offsetParent !== null;
    }, { timeout: 30000 });

    await page.click('#btn-download');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
    await sleep(1000);

    const downloadPath = path.resolve('/tmp/n8n-downloads');
    fs.mkdirSync(downloadPath, { recursive: true });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath
    });

    await page.click('#btnExportarRelatorio');

    const nomeEsperado = 'lista-de-precos';
    const nomeFinal = `relatorio_tiny_fator_conversao_${jobId}.xls`;
    const caminhoFinal = path.join(downloadPath, nomeFinal);

    for (let i = 0; i < 30; i++) {
      const arquivos = fs.readdirSync(downloadPath);
      const achado = arquivos.find(arq =>
        arq.startsWith(nomeEsperado) && arq.endsWith('.xls')
      );
      if (achado) {
        const caminhoOrigem = path.join(downloadPath, achado);
        fs.renameSync(caminhoOrigem, caminhoFinal);
        console.log(caminhoFinal);
        await browser.close();
        process.exit(0);
      }
      await sleep(1000);
    }

    throw new Error('❌ Arquivo não foi baixado a tempo.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    await browser.close();
    process.exit(1);
  }
})();
