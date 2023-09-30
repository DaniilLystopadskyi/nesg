tabActions['results'] = {
    'init': showResults,
    'transition': saveEventData
}

const ontology_prefix = "nrtv";
let current_event = 0;
let current_character = 0;
let current_location = 0;
let current_related_event = 0;

function showResults() {
    current_event = 0;
    console.log(topic_data);
    drawTable();
    convertToTurtle();
}

function saveEventData() {
    return true;

    for (const topic in topic_data) {
        const score = parseInt(document.getElementById(topic + '_score').value);
        topic_data[topic].score = score;

        const table = document.getElementById(topic + "_table");

        if (table) {
            const characterData = extractCharacterData(topic_data[topic].narrative);
            const locationData = extractLocationData(topic_data[topic].narrative);
            const rows = table.getElementsByTagName("tr");

            // Iterate over the rows
            for (let i = 1; i < rows.length; i++) {
                console.log(rows[i]);
                const cells = rows[i].getElementsByTagName("td");
                const checkbox = rows[i].querySelector(".checkbox");
                const numCorrect = rows[i].querySelector("input");

                const eventId = parseInt(cells[0].textContent);
                const isRelevant = checkbox.checked;

                if (eventId >= 0 && eventId < topic_data[topic].narrative.length) {
                    const eventFeatures = getEventFeatures(topic, eventId, characterData, locationData, isRelevant, parseInt(numCorrect.value));
                    sendStatistics(eventFeatures, "events.csv");
                }
            }
        }
    }

    return true;
}

/*Event features:

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
    is entity event
    mean character presence
    mean location presence
    number of unique roles
    number of unique settings
    number of unique relations
    number of related events in the same narrative
    number of unique roles / number of characters
    number of unique settings / number of locations
    number of unique relations / number of related events
    number of related events in the same narrative / total number of related events*/

function getEventFeatures(topic, eventId, characterData, locationData, isRelevant, correctAttrs) {
    const features = [];
    const event = topic_data[topic].narrative[eventId];

    if (!event) {
        console.log("Invalid event id: " + eventId);
        return features;
    }

    features.push(narrative_data.graph_name);
    features.push(topic);
    features.push(narrative_data.topic_type);
    features.push(narrative_data.depth);
    features.push(narrative_data.size);
    features.push(narrative_data.max_degree);
    features.push(narrative_data.similarityThreshold);

    features.push(event.what);
    features.push(event.when);
    features.push(event.who.length);
    features.push(event.where.length);
    features.push(event.related_to.length);
    features.push(event.why !== "" ? 1 : 0);
    features.push(event.how !== "" ? 1 : 0);
    features.push(event.what.trim().split(/\s+/).length);

    const eventTime = new Date(event.when);
    features.push(((eventTime - (new Date(topic_data[topic].narrative[0].when))) / (1000 * 60 * 60 * 24)).toFixed(2));
    features.push((((new Date(topic_data[topic].narrative[topic_data[topic].narrative.length-1].when)) - eventTime) / (1000 * 60 * 60 * 24)).toFixed(2));
    features.push(eventId > 0 ? (Math.abs(eventTime - (new Date(topic_data[topic].narrative[eventId-1].when))) / (1000 * 60 * 60 * 24)).toFixed(2) : 0.0);
    features.push(eventId < topic_data[topic].narrative.length - 1 ? (Math.abs((new Date(topic_data[topic].narrative[eventId+1].when)) - eventTime) / (1000 * 60 * 60 * 24)).toFixed(2) : 0.0);

    features.push(event.isEntityEvent ? 1 : 0);

    let totalCharPresence = 0.0;
    const roles = new Set();
    for (const char of event.who) {
        roles.add(char.role);

        if (characterData[char.entity]) {
            totalCharPresence += characterData[char.entity].occurrences;
        }
    }
    features.push(event.who.length > 0 ? (totalCharPresence / event.who.length).toFixed(2) : 0.0);

    let totalLocPresence = 0.0;
    const settings = new Set();
    for (const loc of event.where) {
        settings.add(loc.setting);

        if (locationData.locationOccurrences[loc.entity]) {
            totalLocPresence += locationData.locationOccurrences[loc.entity];
        }
    }
    features.push(event.where.length > 0 ? (totalLocPresence / event.where.length).toFixed(2) : 0.0);

    const relations = new Set();
    const numSameNarr = 0;
    for (const evn of event.related_to) {
        relations.add(evn.relation);
        
        if (evn.sameNarrative) {
            numSameNarr++;
        }
    }

    features.push(roles.size);
    features.push(settings.size);
    features.push(relations.size);
    features.push(numSameNarr);

    features.push(event.who.length > 0 ? (roles.size / event.who.length).toFixed(2) : 0);
    features.push(event.where.length > 0 ? (settings.size / event.where.length).toFixed(2) : 0);
    features.push(event.related_to.length > 0 ? (relations.size / event.related_to.length).toFixed(2) : 0);
    features.push(event.related_to.length > 0 ? (numSameNarr / event.related_to.length).toFixed(2) : 0);

    features.push(correctAttrs);
    features.push(isRelevant ? 1 : 0);

    return features;
}

function drawTable() {
    const container = document.getElementById('results-table-container');

    for (const [topic, data] of Object.entries(topic_data)) {
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

        const table = document.createElement("table");
        table.id = topic + "_table";

        const thead = document.createElement("thead");
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        table.appendChild(tbody);

        let row = document.createElement("tr");
        const eventHead = document.createElement("th");
        eventHead.textContent = "Event ID";
        const whoHead = document.createElement("th");
        whoHead.textContent = "Who";
        const whatHead = document.createElement("th");
        whatHead.textContent = "What";
        const whenHead = document.createElement("th");
        whenHead.textContent = "When";
        const whereHead = document.createElement("th");
        whereHead.textContent = "Where";
        const whyHead = document.createElement("th");
        whyHead.textContent = "Why";
        const howHead = document.createElement("th");
        howHead.textContent = "How";
        const relatedHead = document.createElement("th");
        relatedHead.textContent = "Related To";
        const correctHead = document.createElement("th");
        correctHead.textContent = "Correct Attributes";
        const validHead = document.createElement("th");
        validHead.textContent = "Valid";

        row.appendChild(eventHead);
        row.appendChild(whenHead);
        row.appendChild(whoHead);
        row.appendChild(whatHead);
        row.appendChild(whereHead);
        row.appendChild(whyHead);
        row.appendChild(howHead);
        row.appendChild(relatedHead);
        row.appendChild(validHead);
        row.appendChild(correctHead);

        thead.appendChild(row);

        let eventId = 0;
        const narrative = data.narrative;
        for (const event of narrative) {
            row = document.createElement("tr");

            let eventCell = document.createElement("td");
            eventCell.textContent = eventId;
            let whoCell = document.createElement("td");
            for (const character of event.who) {
                const context = narrative_data.graph_data.propertyData[getSuffix(character.role)] ? narrative_data.graph_data.propertyData[getSuffix(character.role)].label : "";
                whoCell.innerHTML += `${character.label} (${context}) `;
            }
            let whatCell = document.createElement("td");
            whatCell.textContent = event.what;
            let whenCell = document.createElement("td");
            whenCell.textContent = event.when;
            let whereCell = document.createElement("td");
            for (const place of event.where) {
                const context = narrative_data.graph_data.propertyData[getSuffix(place.setting)] ? narrative_data.graph_data.propertyData[getSuffix(place.setting)].label : "";
                whereCell.innerHTML += `${place.label} (${context}) `;
            }
            let whyCell = document.createElement("td");
            whyCell.textContent = event.why;
            let howCell = document.createElement("td");
            howCell.textContent = event.how;
            let relatedCell = document.createElement("td");
            for (const related_event of event.related_to) {
                const context = narrative_data.graph_data.propertyData[getSuffix(related_event.relation)] ? narrative_data.graph_data.propertyData[getSuffix(related_event.relation)].label : "";
                relatedCell.innerHTML += `${related_event.label} (${context}) `;
            }

            let validCell = document.createElement("td");
            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("checkbox");
            validCell.appendChild(checkbox);

            let inputCell = document.createElement("td");
            let input = document.createElement("input");
            const numAttrs = ((event.why !== "" ? 1 : 0) + (event.how !== "" ? 1 : 0) + event.who.length + event.where.length + event.related_to.length).toString();
            input.type = "number";
            input.min = "0";
            input.max = numAttrs;
            input.value = numAttrs;
            inputCell.appendChild(input);

            row.appendChild(eventCell);
            row.appendChild(whenCell);
            row.appendChild(whoCell);
            row.appendChild(whatCell);
            row.appendChild(whereCell);
            row.appendChild(whyCell);
            row.appendChild(howCell);
            row.appendChild(relatedCell);
            row.appendChild(inputCell);
            row.appendChild(validCell);

            tbody.appendChild(row);

            eventId += 1;
        }

        contents.appendChild(table);

        createScoreModule(topic, contents);
    }
}

function createScoreModule(topic, parent) {
    const module = document.createElement('div');
    module.classList.add("module");
    parent.appendChild(module);

    const title = document.createElement('div');
    title.classList.add("label");
    title.onclick = function () { toggleModule(title); };
    title.textContent = "Rate this narrative";
    module.appendChild(title);

    const contents = document.createElement('div');
    contents.classList.add("contents");
    module.appendChild(contents);

    const input = document.createElement('input');
    input.type = "number";
    input.id = topic + "_score";
    input.name = "score";
    input.min = "0";
    input.max = "10";
    input.value = "0";

    contents.appendChild(input);
}

function formatEvents(start_event_id, events) {
    let turtle = '';
    const characters = [];
    const locations = [];
    const relatedEvents = [];

    let event_id = start_event_id;
    for (const event of events) {
        const eventId = `event_${event_id+1}`;

        turtle += `${eventId} a ${ontology_prefix}:Event`;

        if (event.what) {
            turtle += `;\n    ${ontology_prefix}:what "${event.what}"`;
        }
        if (event.when) {
            turtle += `;\n    ${ontology_prefix}:when "${event.when}"`;
        }
        if (event.who.length > 0) {
            for (const character of event.who) {
                turtle += `;\n    ${ontology_prefix}:who ${ontology_prefix}:character_${current_character}`;
                characters.push({ id: current_character, entity: character.entity, role: character.role});
                current_character++;
            }
        }
        if (event.where.length > 0) {
            for (const place of event.where) {
                turtle += `;\n    ${ontology_prefix}:where ${ontology_prefix}:location_${current_location}`;
                locations.push({ id: current_location, entity: place.entity, setting: place.setting});
                current_location++;
            }
        }
        if (event.why) {
            turtle += `;\n    ${ontology_prefix}:why "${event.why}"`;
        }
        if (event.how) {
            turtle += `;\n    ${ontology_prefix}:how "${event.how}"`;
        }
        if (event.related_to.length > 0) {
            for (const related_event of event.related_to) {
                turtle += `;\n    ${ontology_prefix}:related_to ${ontology_prefix}:related_event_${current_related_event}`;
                relatedEvents.push({ id: current_related_event, entity: related_event.entity, relation: related_event.relation});
                current_related_event++;
            }
        }
        turtle += `.\n\n`;
        event_id += 1;
    }

    for (const character of characters) {
        turtle += `character_${character.id} a ${ontology_prefix}:Character;\n`;
        turtle += `    ${ontology_prefix}:entity ${character.entity};\n`;
        turtle += `    ${ontology_prefix}:role ${character.role}.\n\n`;
    }
    for (const location of locations) {
        turtle += `location_${location.id} a ${ontology_prefix}:Location;\n`;
        turtle += `    ${ontology_prefix}:entity ${location.entity};\n`;
        turtle += `    ${ontology_prefix}:setting ${location.setting}.\n\n`;
    }
    for (const event of relatedEvents) {
        turtle += `related_event_${event.id} a ${ontology_prefix}:RelatedEvent;\n`;
        turtle += `    ${ontology_prefix}:entity ${event.entity};\n`;
        turtle += `    ${ontology_prefix}:relation ${event.relation}.\n\n`;
    }

    return turtle;
}

function formatNarrative(narrative_id, data, narrative) {
    const themes = data.types.split(',');
    let turtle = '';

    turtle += `narrative_${narrative_id} a ${ontology_prefix}:Narrative;\n`;
    turtle += `    ${ontology_prefix}:about "${data.title}";\n`;

    for (const theme of themes) {
        turtle += `    ${ontology_prefix}:has_theme ${theme};\n`;
    }

    if (narrative.length > 0) {
        turtle += `    ${ontology_prefix}:event_sequence event_sequence_${narrative_id}.\n\n`;

        turtle += `event_sequence_${narrative_id} a rdf:Seq;\n`;
    }

    let start_event = current_event;
    for (let i = 0; i < narrative.length; i++) {
        turtle += `    rdf:_${i+1} event_${current_event+1}`;

        if (i == narrative.length - 1) {
            turtle += '.\n\n'
        } else {
            turtle += ';\n'
        }

        current_event += 1;
    }

    turtle += formatEvents(start_event, narrative);

    return turtle;
}

function convertToTurtle() {
    const container = document.getElementById('results-turtle-container');

    let narrative_id = 0;
    for (const [topic, data] of Object.entries(topic_data)) {
        let output = formatNarrative(narrative_id, data, data.narrative);
        narrative_id += 1;

        container.innerHTML += output;
        storeNarrative(`${narrative_data.graph_name}/${topic}_d${narrative_data.depth}.ttl`, output);
    }
}

async function saveToFile() {
    const container = document.getElementById('results-turtle-container');
    const fileNameInput = document.getElementById('file-name');

    if (fileNameInput.value.trim().length === 0) {
        const file_name = fileNameInput.value;

        try {
            const response = await fetch("/save_turtle", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ file_name: file_name, data: container.innerHTML }),
            });
        } catch (error) {
            console.error(error);
        }
    }
}