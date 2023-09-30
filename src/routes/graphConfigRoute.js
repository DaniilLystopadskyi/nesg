const express = require('express');
const router = express.Router();
const fs = require('fs');

// Define a route for serving the graph configuration page
router.get('/', (req, res) => {
    res.sendFile('configuration.html', { root: 'public' });
});

// Define a route for handling POST requests to update the graph configuration
router.post('/update_graph', (req, res) => {
    // Parse data from the request body
    const { graph_name, graph } = req.body;

    // Load the existing graphs data from the file
    const graphsFilePath = 'public/data/graphs.json';

    fs.readFile(graphsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read graphs data.' });
        }

        // Parse the existing JSON data
        let graphsData = {};
        try {
            graphsData = JSON.parse(data);
        } catch (parseError) {
            console.error(parseError);
            return res.status(500).json({ error: 'Failed to parse graphs data.' });
        }

        // Update the configuration for the specified graph
        graphsData[graph_name] = graph;

        // Write the updated data back to the file
        fs.writeFile(graphsFilePath, JSON.stringify(graphsData, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
                console.error(writeErr);
                return res.status(500).json({ error: 'Failed to update graphs data.' });
            }

            console.log('Graph configuration updated:', graph_name);
            res.status(200).json({ message: 'Graph configuration updated successfully.' });
        });
    });
});

// Define a route for handling POST requests to delete a graph
router.post('/delete_graph', (req, res) => {
    // Parse data from the request body
    const { graph_name } = req.body;

    // Load the existing graphs data from the file
    const graphsFilePath = 'public/data/graphs.json';

    fs.readFile(graphsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read graphs data.' });
        }

        // Parse the existing JSON data
        let graphsData = {};
        try {
            graphsData = JSON.parse(data);
        } catch (parseError) {
            console.error(parseError);
            return res.status(500).json({ error: 'Failed to parse graphs data.' });
        }

        // Check if the graph to delete exists
        if (!graphsData.hasOwnProperty(graph_name)) {
            return res.status(400).json({ error: 'Graph not found.' });
        }

        // Delete the graph
        delete graphsData[graph_name];

        // Write the updated data back to the file
        fs.writeFile(graphsFilePath, JSON.stringify(graphsData, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
                console.error(writeErr);
                return res.status(500).json({ error: 'Failed to update graphs data.' });
            }

            console.log('Graph deleted:', graph_name);
            res.status(200).json({ message: 'Graph deleted successfully.' });
        });
    });
});

module.exports = router;