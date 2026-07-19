const puppeteer = require('puppeteer');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const ARCHIVE_DIR = process.env.ARCHIVE_DIR || './archives';

async function ensureArchiveDir() {
  try {
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    await fs.mkdir(path.join(ARCHIVE_DIR, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(ARCHIVE_DIR, 'pdfs'), { recursive: true });
    await fs.mkdir(path.join(ARCHIVE_DIR, 'html'), { recursive: true });
  } catch (error) {
    logger.error('Error creating archive directories:', error);
  }
}

async function archivePage(url) {
  let browser;
  
  try {
    await ensureArchiveDir();
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get HTML content
    const htmlContent = await page.content();
    
    // Generate unique filename
    const timestamp = Date.now();
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '_').substring(0, 20);
    const basename = `${urlHash}_${timestamp}`;
    
    // Save HTML
    const htmlPath = path.join(ARCHIVE_DIR, 'html', `${basename}.html`);
    await fs.writeFile(htmlPath, htmlContent);
    
    // Take screenshot
    const screenshotPath = path.join(ARCHIVE_DIR, 'screenshots', `${basename}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Generate PDF
    const pdfPath = path.join(ARCHIVE_DIR, 'pdfs', `${basename}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4' });
    
    await browser.close();
    
    // Save to database
    const result = await pool.query(
      'INSERT INTO archived_pages (url, html_content, screenshot_path, pdf_path) VALUES ($1, $2, $3, $4) RETURNING *',
      [url, htmlContent, screenshotPath, pdfPath]
    );
    
    logger.info(`Successfully archived page: ${url}`);
    return result.rows[0];
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    logger.error(`Error archiving page ${url}:`, error);
    throw error;
  }
}

module.exports = { archivePage };
