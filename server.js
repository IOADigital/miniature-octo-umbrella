const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

// Puppeteer function to scrape data
async function scrapeWebsite(url) {
    console.log(url)
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const pageContent = page.content()
  await page.waitForSelector(' .job-tile-title')
  let element = await page.$(' .job-tile-title')
  let value = await page.evaluate(el => el.textContent, element)
  console.log('value=', value)
  /*
    await page.type('#job-search-bar', 'make.com');
  await page.click('button[type="submit"]');

  const jobs = await page.evaluate(() => {
    const jobListings = document.querySelectorAll('.job-tile');
    return Array.from(jobListings).map(job => ({
      title: job.querySelector('.job-title').innerText,
      description: job.querySelector('.job-description').innerText,
      // Extract other relevant data
    }));
  });

  await browser.close();
  */
  return pageContent;
}

// REST endpoint
app.get('/scrape', async (req, res) => {
  const url = req.query.url; // Get URL from query parameter
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const scrapedData = await scrapeWebsite(url);
    res.json({ data: scrapedData });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while scraping', data: error });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});