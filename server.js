const express = require('express')
const puppeteer = require('puppeteer')
const axios = require('axios')
require('dotenv').config()
const { MongoClient } = require('mongodb')

const app = express();
const port = 3001;
app.use(express.json())
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD
const uri = `mongodb+srv://brett:${MONGODB_PASSWORD}@scrapedjobs.j29cj.mongodb.net/?retryWrites=true&w=majority&appName=ScrapedJobs`
const client = new MongoClient(uri)
async function connectToDatabase() {
  try {
    await client.connect();
  } catch (error) {
    console.error(`Error connecting to MongoDB`, error)
  }
}
connectToDatabase()

// Puppeteer function to scrape data
async function scrapeWebsite(url) {
  try {
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
  } catch (error) {
    console.error({'scrapeURL error:': error.message})
    return false
  }
}

process.on('SIGINT', async () => {
  await client.close()
  console.log('MongoDB Connection Closed')
  process.exit(0)
})

async function scrapeJob(url) {
  let usOnly = false
  console.log(`job url = ${url}`)
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();


  //await page.setCookie(...cookies)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');
  await page.goto(url);
  const pageContent = await page.content()
  const textContent = await page.evaluate(()=>{
    const elements = document.querySelectorAll('span.text-light-on-muted')
    return Array.from(elements).map(el => el.innerText)
  })
  if (textContent.includes('Only freelancers located in the U.S. may apply.')){
    usOnly = true
  }

  await browser.close();
  if (!usOnly && textContent){
    return true
  } else {
    return false
  }
}

async function processUrl(url) {
  try {
    const dbName = 'ScrapedJobUrls'
    const collectionName = 'urls'
    const collection = client.db(dbName).collection(collectionName)
    const result = await collection.updateOne({ url: url },
      { $setOnInsert: { url: url, processed: true }},
      { upsert: true }
      )
    const isNewRecord = result.upsertedCount > 0
    console.log(`Database: ${dbName}, Collection: ${collectionName}`);
    console.log(isNewRecord ? 'New record created' : 'Existing record found');
    return isNewRecord
  } catch (error) {
    console.error('Error processing URL:', error)
    throw error
  }
}

app.post('/process-url', async (req, res) => {
  const { url } = req.body
  try {
    const isNewRecord = await processUrl(url)
    res.json({ success: true, isNewRecord})
  } catch (error) {
    res.status(500).json({ success: false, error: error.message})
  }
})

// REST endpoint
app.get('/scrape', async (req, res) => {
  //const url = req.query.url; // Get URL from query parameter
  const url = 'https://www.upwork.com/nx/search/jobs/?amount=500-999,1000-4999,5000-&contractor_tier=2,3&hourly_rate=40-&nbs=1&q=make.com&sort=recency'
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    let scrapedData = await scrapeWebsite(url);
    if (!scrapedData) {
      setTimeout(async ()=>{
        scrapedData = await scrapeWebsite(url);
      },2000)
    }
    if (!scrapedData) {
      res.status(500).json({error: "Unable to fetch Jobs from Upwork Search Page"})
    }
    connectToDatabase()
    let jobPageContent
    for (let i = 0; i <= scrapedData.length; i++) {
      if(scrapedData[i]?.link) {
        const isNewRecord = await processUrl(scrapedData[i].link)
        if(isNewRecord) {
          jobPageContent = await scrapeJob(scrapedData[i].link)
        } else {
          jobPageContent = false
        }
        if (jobPageContent != false) {
          const response = axios.post('https://hook.us1.make.com/by52fkg8egfciwmtbt4ungsgrut48ufj', {
            url: scrapedData[i].link,
            description: scrapedData[i].innerText,
            timestamp: new Date().toISOString()
          })
          //console.log('response =', response)
        }
      }
    }

    res.json({ data: scrapedData });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while scraping', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});