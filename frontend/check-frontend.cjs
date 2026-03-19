const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure()?.errorText || 'Unknown'));
        
        await page.goto('http://localhost:9000/docs/tutorial', {waitUntil: 'networkidle2'});
        
        await browser.close();
    } catch (e) {
        console.error("Puppeteer script failed:", e);
    }
})();
