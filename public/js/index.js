// Global meta variables
const tabNames = ["configuration", "start", "entity_select", "classification", "results", "evaluation"];
const tabActions = {};
let currentTab = 0;

// Global narrative related variables
let graphs = {};
const topic_data = {};
let narrative_data = {
    'graph_name': null,
    'graph_data': null,
    'topic_type': null,
    'topics': [],
    'depth': 0,
    'size': 0,
    'max_degree': 0,
    'similarityThreshold': 0.5,
    'calssification_type': '',
    'min_date': '',
    'max_date': '',
    'entityEventCount': 0,
    'propertyEventCount': 0,
    'extractionStartTime': null,
    'extractionEndTime': null
};

const batchSize = 10;

let pl_resolution = "";
let pe_resolution = "";
let el_resolution = "";
let ple_resolution = "";

// Load the starting tab page
switchTab('start');

async function query(sparqlQuery, loading_text) {
    const loadingContainer = document.getElementById('loading-container');
    const loadingText = document.getElementById('loading-text');
    const back = document.getElementById('back-btn');
    const next = document.getElementById('next-btn');

    console.log(sparqlQuery);
    back.disabled = true;
    next.disabled = true;

    loadingContainer.style.display = 'block';
    loadingText.textContent = loading_text;
    try {
        const response = await fetch("/sparql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                'Accept': 'application/sparql-results+json'
            },
            body: JSON.stringify({
                endpoint: narrative_data.graph_data.endpoint,
                query: sparqlQuery
            })
        });
        const data = await response.json();

        back.disabled = false;
        next.disabled = false;
        loadingContainer.style.display = 'none';
        console.log(data);

        return data.results.bindings;
    } catch (error) {
        back.disabled = false;
        next.disabled = false;
        loadingContainer.style.display = 'none';
        console.error(error);
    }

    return null;
}

function getSuffix(url, delimiter = "/") {
    const lastIndex = url.lastIndexOf(delimiter);
    const suffix = url.substring(lastIndex + 1);
    return suffix;
}

function formatURI(url) {
    return `<${url}>`;
}

document.addEventListener('DOMContentLoaded', function () {
    // Get all tab items
    const tabItems = document.querySelectorAll('#main-tabs li');

    // Add click event listener to each tab
    tabItems.forEach(tabItem => {
        tabItem.addEventListener('click', function (e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Get all sub tab items
    const subTabItems = document.querySelectorAll('.sub-tabs li');

    // Add click event listener to each tab
    subTabItems.forEach(tabItem => {
        tabItem.addEventListener('click', function (e) {
            e.preventDefault();
            switchSubTab(this);
        });
    });
});

function switchTab(tabId) {
    // Hide currently active tab
    document.querySelector('#main-tabs li.active').classList.remove('active');

    // Activate the clicked tab
    const tabItem = document.querySelector(`[data-tab=${tabId}]`);
    tabItem.classList.add('active');

    // Enable the tab if it is still disabled
    if (tabItem.classList.contains("disabled")) {
        tabItem.classList.remove("disabled")
    }

    // Hide all sub-tabs
    const subTabs = document.querySelectorAll('.sub-tabs');
    subTabs.forEach((subTab) => {
        subTab.style.display = 'none';
    });

    // Show the selected sub-tabs
    const tabSubTabs = document.querySelector(`#${tabId}-sub-tabs`);
    if (tabSubTabs) {
        tabSubTabs.style.display = 'flex';
    }

    // Load the tab's contents from an external HTML file
    loadTabContent(tabId);

    currentTab = Array.from(tabItem.parentNode.children).indexOf(tabItem);
    console.log(currentTab);
}

function switchSubTab(subTab) {
    // Hide currently active sub tab
    subTab.parentNode.querySelector('li.active').classList.remove('active');

    // Activate the clicked tab
    subTab.classList.add('active');

    // Enable the tab if it is still disabled
    if (subTab.classList.contains("disabled")) {
        subTab.classList.remove("disabled")
    }

    // Hide currently active sub tabs contents
    document.querySelector('.tab-content.active').classList.remove('active');

    // Show the clicked sub tab
    document.querySelector(`#t${Array.from(subTab.parentNode.children).indexOf(subTab) + 1}`).classList.add('active');
}

function loadTabContent(tabId) {
    fetch(`${tabId}.html`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('content-container').innerHTML = data;

            // Initialize the tab
            if (tabActions[tabId].init != undefined) {
                tabActions[tabId].init();
            }
        });
}

async function switchPage(step) {
    // Check if switching to an existing page
    if ((step > 0 && currentTab + step < tabNames.length) || (step < 0 && currentTab + step >= 0)) {
        // Tab must have a transition action defined when going forward
        if (step > 0) {
            const currentTabName = tabNames[currentTab];

            if (tabActions[currentTabName].transition != undefined) {
                // Do the transition action
                const success = await tabActions[currentTabName].transition();

                // If transition fails, do not change tabs
                if (!success) {
                    return;
                }
            }
        }

        currentTab += step;
        switchTab(tabNames[currentTab]);
    } 
}

function toggleModule(labelElement) {
    // Find the contents container for this module
    const contentsContainer = labelElement.parentElement.querySelector('.contents');

    // Toggle the visibility of the contents container
    if (contentsContainer.style.display === 'none' || contentsContainer.style.display === '') {
        contentsContainer.style.display = 'block';
    } else {
        contentsContainer.style.display = 'none';
    }
}

async function getBenchmarkData(topic, entity) {
    const narrative_graph = topic_data[topic].graph;
    const response = await fetch(`/evaluation/search?entity_label=${encodeURIComponent(narrative_graph[entity].data.label.toLowerCase().replace(/ /g,"_"))}`);
    const data = await response.json();

    topic_data[topic].benchmark.relevancy.data[entity] = data;
}

function sendStatistics(data, filename) {
    fetch("/evaluation/append_data", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: filename, data: data }),
    })
        .then(response => {
            if (response.ok) {
                console.log('Data appended successfully.');
            } else {
                console.error('Error appending data:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function storeNarrative(path, narrative) {
    // Create a POST request to send the data
    fetch("/evaluation/save_narrative", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: path, content: narrative }),
    })
        .then(response => {
            if (response.ok) {
                console.log('Data sent successfully.');
            } else {
                console.error('Error sending data:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}