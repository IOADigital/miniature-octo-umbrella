const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

// Puppeteer function to scrape data
async function scrapeWebsite(url) {
    console.log(url)
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');
  await page.goto(url);
  const pageContent = await page.content()
  //console.log('page content', pageContent)
  //await page.waitForSelector(' .job-tile-title')
  console.log('waiting...')
  const titleNode = await page.$$('article')
  console.log('titleNode', titleNode)
  const listOfText = []
  for (let i = 0; i < titleNode.length; i++) {
    const innerText = await page.evaluate(el => el.innerText, titleNode[i])
    const link = await titleNode[i].$eval('a', el => el.href).catch(()=>'No link found')
    listOfText.push({innerText,link})
  }
  //const title = await page.evaluate(el => el.innerText, titleNode)
  console.log('text', listOfText)
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
 await browser.close();
  return listOfText;
}

// REST endpoint
app.get('/scrape', async (req, res) => {
  //const url = req.query.url; // Get URL from query parameter
  const url = 'https://www.upwork.com/nx/search/jobs/?amount=500-999,1000-4999,5000-&contractor_tier=2,3&hourly_rate=40-&nbs=1&q=make.com&sort=recency'
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