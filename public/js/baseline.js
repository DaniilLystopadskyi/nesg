const wikidataMapping = {
    "event": "http://www.wikidata.org/entity/Q1190554",
    "whoProp": ["http://www.wikidata.org/prop/direct/P710", "http://www.wikidata.org/prop/direct/P664", "http://www.wikidata.org/prop/direct/P112"],
    "whereProp": ["http://www.wikidata.org/prop/direct/P276", "http://www.wikidata.org/prop/direct/P17", "http://www.wikidata.org/prop/direct/P625", "http://www.wikidata.org/prop/direct/P131", "http://www.wikidata.org/prop/direct/P30"],
    "whenProp": ["http://www.wikidata.org/prop/direct/P585", "wdt:P580", "wdt:P582", "wdt:P571", "wdt:P576", "wdt:P577"],
    "causalProp": ["http://www.wikidata.org/prop/direct/P828", "http://www.wikidata.org/prop/direct/P1542", "http://www.wikidata.org/prop/direct/P361", "http://www.wikidata.org/prop/direct/P156", "http://www.wikidata.org/prop/direct/P155"]
}

const baselineNarrativeData = {
    entityEventCount: 0,
    propertyEventCount: 0,
    extractionStartTime: null,
    extractionEndTime: null
}

async function generateBaselineNarratives() {
    baselineNarrativeData.extractionStartTime = new Date();
    const baseline_topic_data = {};

    let narrative_id = 0;
    for (const topic in topic_data) {
        const currentEntities = [formatURI(topic_data[topic].entity)];

        const data = {};
        const labels =  {};
        await gatherData(currentEntities, 1, data, labels, new Set());
        console.log("baseline data: ", data);

        const narrative = parsebaselineData(data, labels);
        baseline_topic_data[topic] = narrative;
        console.log("baseline: ", narrative);

        if (narrative_data.graph_name === "Wikidata") {
            current_event = 0;
            current_character = 0;
            current_location = 0;
            current_related_event = 0;

            const turtle = formatNarrative(narrative_id, topic_data[topic], narrative);
            storeNarrative(`baseline/${topic}_d${narrative_data.depth}.ttl`, turtle);
        }

        narrative_id++;
    }

    baselineNarrativeData.extractionEndTime = new Date();
    return baseline_topic_data;
}

function parsebaselineData(data, labels) {
    const narrative = [];

    for (const eventEntity in data) {
        const event = {
            'who': [],
            'what': "",
            'when': "",
            'where': [],
            'related_to': []
        };

        baselineNarrativeData.entityEventCount++;

        for (const eventData of data[eventEntity]) {
            switch (eventData.relationType) {
                case "whoProp":
                    event.who.push({ entity: eventData.object, label: eventData.objectLabel, role: eventData.predicate });
                    break;
                case "whereProp":
                    event.where.push({ entity: eventData.object, label: eventData.objectLabel, setting: eventData.predicate });
                    break;
                case "whenProp":
                    event.when = eventData.objectLabel != "" ? eventData.objectLabel : eventData.object;
                    break;
                case "causalProp":
                    event.related_to.push({ entity: eventData.object, label: eventData.objectLabel, relation: eventData.predicate });
                    break;
            }
        }

        event.what = labels[eventEntity];

        narrative.push(event);
    }

    return narrative;
}

async function gatherData(currentEntities, curr_depth, data, eventLabels, visited) {
    if (curr_depth > narrative_data.depth || currentEntities.length <= 0) {
        return;
    }

    const newEntities = [];

    // First, Collect all linked event entities
    // Then, collect data from those entities
    const sparqlQuery = `SELECT ?s ?l ?prop ?o ?ol WHERE {
        VALUES ?t {${formatURI(wikidataMapping.event)}}
        VALUES ?e {${currentEntities.join(" ")}}

        { ?s ?p ?e. }
        UNION
        { ?e ?p ?s. }

        ?s rdfs:label ?l.
        ?s ?prop ?o.

        OPTIONAL {
          ?o rdfs:label ?ol.
          FILTER(lang(?ol) = "en")
        }

        FILTER(lang(?l) = "en")
        FILTER(ISIRI(?o) || lang(?o) = "en" || DATATYPE(?o) = xsd:dateTime)
        FILTER(EXISTS {?s wdt:P31/wdt:P279* ?t})
    }`;

    let results = await query(sparqlQuery, "Gathering baseline data...");

    results.forEach((result) => {
        const subject = result.s.value;
        const property = result.prop.value;
        const object = result.o.value;
        const subjectLabel = result.l != undefined ? result.l.value : "";
        const objectLabel = result.ol != undefined ? result.ol.value : "";

        if (subject != "") {
            if (!visited.has(subject)) {
                newEntities.push(formatURI(subject));
                visited.add(subject);
            }

            eventLabels[subject] = subjectLabel;

            const relationType = getRelationType(property);

            if (relationType != null) {
                if (data[subject]) {
                    data[subject].push({ predicate: property, object: object, objectLabel: objectLabel, relationType: relationType });
                } else {
                    data[subject] = [ {predicate: property, object: object, objectLabel: objectLabel, relationType: relationType} ];
                }
            }
        }
    });

    await gatherData(newEntities, curr_depth + 1, data, eventLabels, visited);
}

function getRelationType(predicate) {
    for (const category in wikidataMapping) {
        if  (category !== "event" && wikidataMapping[category].includes(predicate)) {
            return category;
        }
    }

    return null;
}