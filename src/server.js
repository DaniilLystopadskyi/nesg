const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const indexRoute = require('./routes/indexRoute.js');
const graphConfigRoute = require('./routes/graphConfigRoute.js');
const entitySelectRoute = require('./routes/entitySelectRoute.js');
const entityClassificationRoute = require('./routes/entityClassificationRoute.js');
const resultsRoute = require('./routes/resultsRoute.js');
const evaluationRoute = require('./routes/evaluationRoute.js');
const relevancyRoute = require('./routes/relevancyRoute.js');

const PORT = process.env.PORT || 8080;


// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// parse application/json
app.use(express.json());
app.use(bodyParser.json());

app.use(express.static('public'));

// Routes
app.use('/', indexRoute);
app.use('/graphs', graphConfigRoute);
app.use('/entity_select', entitySelectRoute);
app.use('/entity_classification', entityClassificationRoute);
app.use('/results', resultsRoute);
app.use('/evaluation', evaluationRoute);
app.use('/relevancy', relevancyRoute);

// Endpoint to handle SPARQL queries
app.post('/sparql', async (req, res) => {
  const endpoint = req.body.endpoint;
  const sparqlQuery = req.body.query;

  console.log(endpoint);
  console.log(sparqlQuery);

  try {
    let retryAfter = 0;
    while (true) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Accept': 'application/sparql-results+json'
        },
        body: new URLSearchParams({
          query: sparqlQuery,
        })
      });

      if (response.status === 200) {
        const data = await response.json();
        res.json(data);
        break;
      } else if (response.status === 429) {
        retryAfter = parseInt(response.headers.get('Retry-After')) || 1;
        console.log(`Received 429, waiting for ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        console.error('Error executing SPARQL query ', response.status, response);
        res.status(500).json({ error: 'Error executing SPARQL query' });
        break;
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error executing SPARQL query' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
