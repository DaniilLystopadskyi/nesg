tabActions['evaluation'] = {
    'init': displayStatistics,
    'transition': storeTripleData
}

const narrStatistics = {};

async function displayStatistics() {
    // Call the functions to populate sets and attach checkbox listeners
    await populateSetsAndCheckboxes();
    attachCheckboxListeners();

    const statContainer = document.getElementById('statistics-container');
    const baselineContainer = document.getElementById('baseline-statistics-container');

    let baselines = {};

    if (narrative_data.graph_name === "Wikidata") {
        baselines = await generateBaselineNarratives();
    }

    for (const topic in topic_data) {
        await retrieveWikipediaContents(topic);

        generateStatistics(topic, topic_data[topic].narrative, narrative_data, statContainer);

        /*if (narrative_data.graph_name === "Wikidata") {
            generateStatistics(`${topic} - Baseline`, baselines[topic], baselineNarrativeData, baselineContainer);
        }*/

        const statistics = narrStatistics[topic];
        const baselineStatistics = narrStatistics[`${topic} - Baseline`];
        console.log(baselineStatistics);

        //gatherTopicData(topic, statistics, narrative_data, "narratives.csv");

        /*if (narrative_data.graph_name === "Wikidata") {
            gatherTopicData(topic, baselineStatistics, narrative_data, "baseline.csv");
        }*/
    }
}

async function storeTripleData() {
    for (const topic in topic_data) {
        const table = document.getElementById(topic + "-triples");

        if (table) {
            const rows = table.getElementsByTagName("tr");

            // Iterate over the rows
            for (let i = 1; i < rows.length; i++) {
                const checkbox = rows[i].querySelector(".checkbox");

                const entity = checkbox.getAttribute("entity");
                const neighborId = parseInt(checkbox.getAttribute("neighbor"));
                const isRelevant = checkbox.checked;

                if (topic_data[topic].graph[entity] && neighborId < topic_data[topic].graph[entity].neighbors.length && neighborId >= 0) {
                    const neighbor = topic_data[topic].graph[entity].neighbors[neighborId];

                    if (true) {

                        const triple = {
                            'subject': entity,
                            'predicate': neighbor.relationship,
                            'object': neighbor.entity,
                            'statement': neighbor.statement,
                            'qualifier': neighbor.qualifier,
                            'isEvent': neighbor.is_event,
                            'distance': neighbor.distance,
                            'used': neighbor.used,
                            'relevant': isRelevant
                        };

                        const tripleFeatures = await getTripleFeatures(triple, topic);
                        sendStatistics(tripleFeatures, "triples_redux.csv");
                    }
                }
            }
        }
    }

    return true;
}

function gatherTopicData(topic, statistics, narrative_data, filename) {
    const dataToSend = [
        narrative_data.graph_name,
        topic,
        narrative_data.topic_type,
        narrative_data.depth,
        narrative_data.size,
        narrative_data.max_degree,
        narrative_data.similarityThreshold,
        statistics['Complexity']['Number of events'],
        statistics['Complexity']['Events with "Who" attribute'],
        statistics['Complexity']['Events with "Where" attribute'],
        statistics['Complexity']['Events with "Why" attribute'],
        statistics['Complexity']['Events with "How" attribute'],
        statistics['Complexity']['Events with "Related To" attribute'],
        statistics['Complexity']['Mean event completeness'],
        statistics['Complexity']['Number of complete events'],
        statistics['Complexity']['Number of events with no optional attributes'],
        statistics['Complexity']['Average word count for "What" attribute'],
        statistics['Coherence']['Number of event chains'],
        statistics['Coherence']['Largest event chain'],
        statistics['Coherence']['Smallest event chain'],
        statistics['Coherence']['Average event chain length'],
        statistics['Coherence']['Number of unique events'],
        statistics['Coherence']['Max number of occurrences of the same event'],
        statistics['Coherence']['Min number of occurrences of the same event'],
        statistics['Coherence']['Average number of occurrences of the same event'],
        statistics['Coherence']['Average number of characters per event'],
        statistics['Coherence']['Average number of locations per event'],
        statistics['Coherence']['Average number of related events per event'],
        statistics['Complexity']['Number of unique characters'],
        statistics['Character Development']['Main character presence'],
        statistics['Character Development']['Side characters presence'],
        statistics['Character Development']['Main character relevance'],
        statistics['Character Development']['Mean character persistence'],
        statistics['Complexity']['Number of unique locations'],
        statistics['Coherence']['Mean location persistence'],
        statistics['Pacing']['Narrative duration (days)'],
        statistics['Pacing']['Time interval standart deviation (h)'],
        statistics['Technical']['Number of event entities'],
        statistics['Technical']['Number of event properties'],
        statistics['Technical']['Extraction duration'],
        topic_data[topic].score
    ];
    sendStatistics(dataToSend, filename);
}

async function retrieveWikipediaContents(topic) {
    const entities = Object.keys(topic_data[topic].graph).filter(entity => topic_data[topic].graph[entity].data.label !== "" && topic_data[topic].graph[entity].data.label !== undefined);

    try {
        const response = await fetch(`/evaluation/wikipedia/${topic}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const content = await response.text();

        // Convert the content and names to lowercase for case-insensitive matching
        const lowercaseContent = content.toLowerCase();

        entities.forEach(entity => {
            const entityLabel = topic_data[topic].graph[entity].data.label.toLowerCase().replace(/[-!$%^&*()_+|~=`{}\[\]:";'<>?,.\/]/g, "\\$&");
            const regex = new RegExp(entityLabel, 'g');
            const count = (lowercaseContent.match(regex) || []).length;
            topic_data[topic].wikipediaOccurrences[entity] = count;
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to dynamically populate the sets and checkboxes
async function populateSetsAndCheckboxes() {
    const container = document.getElementById('relevant-triples-container');

    for (const topic in topic_data) {
        if (topic_data.hasOwnProperty(topic)) {
            const module = document.createElement('div');
            module.classList.add("module");
            container.appendChild(module);

            const title = document.createElement('div');
            title.classList.add("label");
            title.onclick = function() { toggleModule(title); };
            title.textContent = topic;
            module.appendChild(title);

            const contents = document.createElement('div');
            contents.classList.add("contents");
            module.appendChild(contents);

            contents.innerHTML = `<table id='${topic}-triples'><thead><tr><th>Subject</th><th>Predicate</th><th>Object</th><th>Qualifier</th><th>Relevant</th><th>Benchmark</th></tr></thead><tbody></tbody></table>`;
            const tableBody = contents.querySelector('tbody');

            for (const entity in topic_data[topic].graph) {
                if (topic_data[topic].graph.hasOwnProperty(entity)) {
                    if (narrative_data.graph_data.entityClasses[entity] && narrative_data.graph_data.entityClasses[entity] === "person") {
                        //await getBenchmarkData(topic, entity);
                    }

                    let i = 0;
                    topic_data[topic].graph[entity].neighbors.forEach(async (neighbor) => {
                        const row = document.createElement('tr');
                        const propertyLabel = narrative_data.graph_data.propertyData[getSuffix(neighbor.relationship)] ? narrative_data.graph_data.propertyData[getSuffix(neighbor.relationship)].label : "";
                        const qualifierLabel = neighbor.qualifier !== "" && neighbor.qualifier !== null ? (narrative_data.graph_data.propertyData[getSuffix(neighbor.qualifier)] ? narrative_data.graph_data.propertyData[getSuffix(neighbor.qualifier)].label : "") : "";

                        let bmRelevancy = "Unknown";

                        row.innerHTML = `<td>${entity}(${topic_data[topic].graph[entity].data.label})</td><td>${neighbor.relationship} (${propertyLabel})</td><td>${neighbor.entity} (${topic_data[topic].graph[neighbor.entity].data.label})</td><td>${neighbor.qualifier !== "" ? neighbor.qualifier : ""} (${qualifierLabel})</td><td><input type="checkbox" class="checkbox" entity="${entity}" neighbor="${i}"></td><td>${bmRelevancy}</td>`;
                        tableBody.appendChild(row);

                        i++;
                    });
                }
            }
        }
    }
}

async function getBenchmarkRelevancy(topic, entity, predicate, object) {
    const narrative_graph = topic_data[topic].graph;

    if (!topic_data[topic].benchmark.relevancy.data[entity]) {
        return "Unknown";
    }

    for (const entry of topic_data[topic].benchmark.relevancy.data[entity]) {
        if (
            entry.property.includes(getSuffix(predicate)) &&
            entry.connected_entity_label.toLowerCase().includes(narrative_graph[object].data.label.toLowerCase().replace(/ /g,"_"))
        ) {
            console.log("Found match: ", entity, predicate, object)
            if (entry.biography_score === 1.0 || entry.wikipedia_score === 1.0) {
                topic_data[topic].benchmark.relevancy.num_relevant += 1;
                console.log("Relevant");
                return "Relevant";
            } else {
                console.log("Irrelevant");
                return 'Irrelevant';
            }
        }
    }

    return "Unknown";
}

// Attach a click event listener to checkboxes to highlight rows
function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.checkbox');
    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', function () {
            const row = this.parentElement.parentElement;
            row.classList.toggle('highlighted', this.checked);
        });
    });
}

async function getTripleFeatures(triple, topic) {
    const features = [];

    features.push(narrative_data.graph_name);
    features.push(topic);
    features.push(narrative_data.topic_type);
    features.push(narrative_data.depth);
    features.push(narrative_data.size);
    features.push(narrative_data.max_degree);
    features.push(narrative_data.similarityThreshold);

    features.push(triple.subject);
    features.push(triple.predicate);
    features.push(triple.object);
    features.push(triple.statement !== "" ? triple.statement : "none");
    features.push(triple.qualifier !== "" ? triple.qualifier : "none");

    features.push(narrative_data.graph_data.entityClasses[triple.subject] ? (narrative_data.graph_data.entityClasses[triple.subject] === 'person' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.subject] ? (narrative_data.graph_data.entityClasses[triple.subject] === 'location' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.subject] ? (narrative_data.graph_data.entityClasses[triple.subject] === 'event' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.subject] ? (narrative_data.graph_data.entityClasses[triple.subject] === 'reason' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.subject] ? (narrative_data.graph_data.entityClasses[triple.subject] === 'manner' ? 1 : 0) : 0);

    features.push(narrative_data.graph_data.entityClasses[triple.object] ? (narrative_data.graph_data.entityClasses[triple.object] === 'person' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.object] ? (narrative_data.graph_data.entityClasses[triple.object] === 'location' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.object] ? (narrative_data.graph_data.entityClasses[triple.object] === 'event' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.object] ? (narrative_data.graph_data.entityClasses[triple.object] === 'reason' ? 1 : 0) : 0);
    features.push(narrative_data.graph_data.entityClasses[triple.object] ? (narrative_data.graph_data.entityClasses[triple.object] === 'manner' ? 1 : 0) : 0);

    features.push(getMentions(triple.subject, null, null, graph = topic_data[topic].graph));
    features.push(getMentions(null, triple.predicate, null, graph = topic_data[topic].graph));
    features.push(getMentions(null, null, triple.object, graph = topic_data[topic].graph));

    features.push(getMentions(triple.subject, triple.predicate, null, graph = topic_data[topic].graph));
    features.push(getMentions(triple.subject, null, triple.object, graph = topic_data[topic].graph));
    features.push(getMentions(null, triple.predicate, triple.object, graph = topic_data[topic].graph));
    features.push(getMentions(subject = triple.subject, predicate = triple.predicate, object = triple.object, graph = topic_data[topic].graph));

    features.push(triple.isEvent ? 1 : 0);
    features.push(triple.distance);
    features.push(narrative_data.graph_data.entityCentrality[triple.subject] ? narrative_data.graph_data.entityCentrality[triple.subject] : 0);
    features.push(narrative_data.graph_data.entityCentrality[triple.object] ? narrative_data.graph_data.entityCentrality[triple.object] : 0);

    features.push(topic_data[topic].wikipediaOccurrences[triple.subject] ? topic_data[topic].wikipediaOccurrences[triple.subject] : 0);
    features.push(topic_data[topic].wikipediaOccurrences[triple.object] ? topic_data[topic].wikipediaOccurrences[triple.object] : 0);

    features.push(triple.used ? 1 : 0);
    features.push(triple.relevant ? 1 : 0);

    /*if (narrative_data.graph_data.entityClasses[topic_data[topic].entity] === 'person') {
        const benchmarkRelevancy = await getBenchmarkRelevancy(topic, triple.subject, triple.predicate, triple.object);
        features.push(benchmarkRelevancy === "Relevant" ? 1 : (benchmarkRelevancy === "Irrelevant" ? 0 : 2));
    } else {
        features.push(3);
    }*/

    return features;
}

function generateStatistics(topic, narrative, narrativeData, container) {
    if (!narrative) {
        return;
    }

    const module = document.createElement('div');
    module.classList.add("module");
    container.appendChild(module);

    const title = document.createElement('div');
    title.classList.add("label");
    title.onclick = function () { toggleModule(title); };
    title.textContent = topic;
    module.appendChild(title);

    const contents = document.createElement('div');
    contents.classList.add("contents");
    module.appendChild(contents);

    if (!narrStatistics[topic]) {
        narrStatistics[topic] = calculateStatistics(narrative, narrativeData);
    }

    for (const section in narrStatistics[topic]) {
        const subModule = document.createElement('div');
        subModule.classList.add("module");
        contents.appendChild(subModule);

        const subTitle = document.createElement('div');
        subTitle.classList.add("label");
        subTitle.onclick = function () { toggleModule(subTitle); };
        subTitle.textContent = section;
        subModule.appendChild(subTitle);

        const subContents = document.createElement('div');
        subContents.classList.add("contents");
        subModule.appendChild(subContents);

        const list = document.createElement('ul');

        for (const metric in narrStatistics[topic][section]) {
            const listItem = document.createElement('li');

            listItem.innerHTML = `${metric}: ${narrStatistics[topic][section][metric]}`;

            list.appendChild(listItem);
        }

        subContents.appendChild(list);
    }
}

// Function to calculate statistics
function calculateStatistics(narrative, narrativeData) {
    const statistics = {
        'Complexity': {},
        'Coherence': {},
        'Pacing': {},
        'Character Development': {},
        'Technical': {}
    };

    // General statistics
    const attributeData = calculateAttributeData(narrative);
    statistics['Complexity']['Number of events'] = narrative.length;
    statistics['Complexity']['Events with "Who" attribute'] = attributeData.whoOccurrences;
    statistics['Complexity']['Events with "Where" attribute'] = attributeData.whereOccurrences;
    statistics['Complexity']['Events with "Why" attribute'] = attributeData.whyOccurrences;
    statistics['Complexity']['Events with "How" attribute'] = attributeData.howOccurrences;
    statistics['Complexity']['Events with "Related To" attribute'] = attributeData.relatedToOccurrences;
    statistics['Complexity']['Mean event completeness'] = attributeData.meanEventCompleteness;
    statistics['Complexity']['Number of complete events'] = attributeData.numCompleteEvents;
    statistics['Complexity']['Number of events with no optional attributes'] = attributeData.numNoOptionalAttributes;
    statistics['Complexity']['Average word count for "What" attribute'] = attributeData.meanWhatWordCount;

    // Event sequence statistics
    const eventSequences = calculateEventSequences(narrative);
    statistics['Coherence']['Number of event chains'] = eventSequences.length;
    statistics['Coherence']['Largest event chain'] = Math.max(...eventSequences.map(seq => seq.length));
    statistics['Coherence']['Smallest event chain'] = Math.min(...eventSequences.map(seq => seq.length));
    statistics['Coherence']['Average event chain length'] = calculateAverageEventSequenceLength(eventSequences);

    // Events statistics
    const eventData = extractEventData(narrative);
    statistics['Coherence']['Number of unique events'] = Object.keys(eventData.eventOccurrences).length;
    statistics['Coherence']['Max number of occurrences of the same event'] = Math.max(...Object.values(eventData.eventOccurrences));
    statistics['Coherence']['Min number of occurrences of the same event'] = Math.min(...Object.values(eventData.eventOccurrences));
    statistics['Coherence']['Average number of occurrences of the same event'] = (Object.values(eventData.eventOccurrences).reduce((total, value) => total + value, 0) / Object.values(eventData.eventOccurrences).length).toFixed(2);
    statistics['Coherence']['Most recurring event'] = eventData.mostReocurrentEvent;
    statistics['Coherence']['Average number of characters per event'] = eventData.meanNumCharacters;
    statistics['Coherence']['Average number of locations per event'] = eventData.meanNumLocations;
    statistics['Coherence']['Average number of related events per event'] = eventData.meanNumRelatedEvents;

    // Characters statistics
    const characterData = extractCharacterData(narrative);
    statistics['Complexity']['Number of unique characters'] = Object.keys(characterData).length;
    statistics['Character Development']['Most reccurring character'] = calculateMostRecurringCharacter(characterData);

    const characterPresence = calculateCharacterPresence(narrative, characterData, statistics['Character Development']['Most reccurring character']);
    statistics['Character Development']['Main character presence'] = characterPresence.mainCharacter;
    statistics['Character Development']['Side characters presence'] = characterPresence.sideCharacters;
    statistics['Character Development']['Main character relevance'] = calculateMainCharacterRelevance(characterData);
    statistics['Character Development']['Mean character persistence'] = calculateMeanCharacterPersistence(narrative, characterData);

    // Locations statistics
    const locationData = extractLocationData(narrative);
    statistics['Complexity']['Number of unique locations'] = locationData.uniqueLocations.length;
    statistics['Coherence']['Mean location persistence'] = calculateMeanLocationPersistence(locationData);
    statistics['Coherence']['Most recurring location'] = locationData.mostRecurringLocation;

    // Timeline statistics
    statistics['Pacing']['Narrative start time'] = narrative.length > 0 ? (narrative[0].when !== "" ? narrative[0].when : "") : "no start time";
    statistics['Pacing']['Narrative end time'] = narrative.length > 0 ? (narrative[narrative.length - 1].when !== "" ? narrative[narrative.length - 1].when : "") : "no end time";
    statistics['Pacing']['Narrative duration (days)'] = calculateNarrativeDuration(statistics['Pacing']['Narrative start time'], statistics['Pacing']['Narrative end time']);
    statistics['Pacing']['Time interval standart deviation (h)'] = calculateTimeIntervalStandardDeviation(narrative);

    statistics['Technical']['Extraction started at'] = narrativeData.extractionStartTime.toString();
    statistics['Technical']['Extraction ended at'] = narrativeData.extractionEndTime.toString();
    statistics['Technical']['Extraction duration'] = (narrativeData.extractionEndTime - narrativeData.extractionStartTime) / 1000;
    statistics['Technical']['Number of event entities'] = narrativeData.entityEventCount.toString();
    statistics['Technical']['Number of event properties'] = narrativeData.propertyEventCount.toString();

    return statistics;
}

/*
METRICS:

Complexity:

    Number of subplots/narratives.
    Number of events with no optional attributes (only nrtv:when and nrtv:what).
    Number of events with all attributes.
    Number of events that have multiple occurrences.
    Average word count for "what" attribute (indicating the level of detail).
    Average number of related events per event.
    Average number of characters per event.
    Average number of locations per event.
    Average number of roles per character.
    Average number of sequential roles per character.
    Number of unique characters.
    Number of unique locations.

Coherence:

    Mean event completeness.
    Most recurring event.
    Number of events that have only 1 occurrence.
    Number of event sequences (An event sequence is a set of events that share at least one location or person and appear consecutively in the timeline).
    The size of the largest event sequence.
    The size of the smallest event sequence.

Pacing:

    Narrative range in days (Last event time - first event time).
    Standard deviation of time intervals between events (High variability may indicate moments of tension or surprise, while low variability suggests a more even narrative flow).

Character Development:

    Main character presence (max(number of character occurrences/total number of events)).
    Side character presence (main character presence - total number of events).
    Difference between nº1 character presence and nº2 character presence (main character relevance).
    Mean character persistence (number of consecutive events that contain the character, for each character).
    Most recurring character.
    Most recurring location.
    Maximum time between a character/location's first mention and the last (foreshadowing).

Technical:

    Number of entity events.
    Number of property events.
*/

/*

Triple features:

    subject class (1 hot encoding)
    object class (1 hot encoding)
    subject mentions in narrative
    predicate mentions in narrative
    object mentions in narrative
    number of co mentions of both subject and object
    number of co mentions of both subject and predicate
    number of co mentions of both predicate and object
    number of co mentions of subject, predicate and object
    has qualifier
    is an event triple
    distance to main entity
    subject in-degree centrality
    object in-degree centrality
    subject mentions in topic's wikipedia page
    object mentions in topic's wikipedia page

Event features:

    number of who instances
    number of where instances
    number of related to instances
    has why
    has how
    "What" word count
    temporal distance (start)
    Temporal distance (end)
    temporal distance (previous event)
    temporal distance (next event)
    is property event
    is entity event
    number of occurrences
    mean character presence
    mean location presence
    number of unique roles
    number of unique settings
    number of unique relations
    number of related events in the same narrative
    number of unique roles / number of characters
    number of unique settings / number of locations
    number of unique relations / number of related events
    number of related events in the same narrative / total number of related events
*/