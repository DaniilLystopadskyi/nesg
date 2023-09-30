const express = require('express');
const router = express.Router();
const fs = require('fs');
const { spawn } = require('child_process');

const datasetsPath = 'public/data/datasets/';

// Route to search the TSV file
router.get('/search', (req, res) => {
    const { entity_label } = req.query;

    console.log("*********************PROCESSING LABEL************************* ", entity_label)

    // Replace 'pythonScript.py' with the path to your Python script
    const pythonProcess = spawn('python', ['scripts/searchTSV.py', entity_label]);

    let result = '';

    pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            res.status(500).send('Internal Server Error');
        } else {
            // Send the JSON response to the client
            try {
                console.log(result);
                const jsonResult = JSON.parse(result);
                res.json(jsonResult);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                res.status(500).send('Internal Server Error');
            }
        }
    });
});

// Route to append data to the CSV file
router.post('/append_data', (req, res) => {
    const { fileName, data } = req.body;

    if (!fileName || !data || !Array.isArray(data)) {
        return res.status(400).json({ error: 'Invalid data format.' });
    }

    // Convert the data to a CSV format
    const csvData = data.join('\t');

    // Append the CSV data to the file (create the file if it doesn't exist)
    fs.appendFileSync(datasetsPath + fileName, csvData + '\n');

    console.log('Data has been appended to the CSV file.');

    return res.status(200).json({ message: 'Data appended to CSV file.' });
});

router.post('/save_narrative', (req, res) => {
    const { filename, content } = req.body;

    if (!filename || !content) {
        return res.status(400).json({ error: 'Both filename and content are required.' });
    }

    // Write the content to the specified file
    fs.writeFile("public/data/narratives/" + filename, content, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
            return res.status(500).json({ error: 'Error writing to file.' });
        }

        console.log(`Narrative written to ${filename}`);
        res.status(200).json({ message: `Narrative written to ${filename}` });
    });
});

// Route to retrieve the Wikipedia page content for a given subject
router.get('/wikipedia/:subject', (req, res) => {
    const subject = req.params.subject;
    // Replace spaces with underscores in the subject for the API request
    const formattedSubject = subject.replace(/ /g, '_');

    // Wikipedia API URL
    const apiUrl = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&titles=${formattedSubject}`;

    // Fetch data from the Wikipedia API
    fetch(apiUrl)
        .then(response => {
            // Check if the response is successful
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Extract the page content from the API response
            const page = Object.values(data.query.pages)[0];
            if (page) {
                const content = page.extract;
                res.send(content); // Send the content as a response
            } else {
                res.status(404).send('Page not found.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).send('An error occurred while fetching data from Wikipedia.');
        });
});

module.exports = router;