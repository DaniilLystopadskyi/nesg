tabActions['classification'] = {
    'init': createClassOptions,
    'transition': generateResults
}

async function createClassOptions() {
    const multi_class_container = document.getElementById('multi-class-container');
    const entity_container = document.getElementById('entity-container');

    for (const [entity, value] of Object.entries(unique_entities)) {
        if (entity_classes[entity] && entity_classes[entity].length > 1) {
            createOptions(multi_class_container, entity, value.label, value.description, "entity");
        } else {
            createOptions(entity_container, entity, value.label, value.description, "entity");
        }
    }
}

function createOptions(sub_container, entity, entity_label, description, type) {
    const entity_container = document.getElementById('entity-container');
    const select = document.createElement('select');
    select.setAttribute('name', entity);
    const options = ['event', 'location', 'person', 'reason', 'manner', 'other'];

    // Create an option element for each choice and add it to the select element
    options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });

    const assignedClasses = entity_classes[entity] ? entity_classes[entity].toString() : "";

    const label = document.createElement('label');
    label.textContent = `${entity_label} (${entity}) ASSIGNED CLASSES: ${assignedClasses}`;
    sub_container.appendChild(label);
    sub_container.appendChild(select);

    select.value = 'other';
    if (narrative_data.classification_type === "new") {
        if (narrative_data.graph_data.entityClasses[entity]) {
            select.value = narrative_data.graph_data.entityClasses[entity];
        } else if (entity_classes[entity]) {
            if (entity_classes[entity].length == 1) {
                select.value = entity_classes[entity][0];
            } else if (entity_classes[entity].length > 1) {
                select.value = resolveConflict(entity_classes[entity]);
                if (select.value != "other") {
                    entity_container.appendChild(select);
                    entity_container.appendChild(label);
                    entity_container.appendChild(br);
                }
            }
        }
    } else if (narrative_data.classification_type === "all") {
        if (entity_classes[entity]) {
            if (entity_classes[entity].length == 1) {
                select.value = entity_classes[entity][0];
            } else if (entity_classes[entity].length > 1) {
                select.value = resolveConflict(entity_classes[entity]);
                if (select.value != "other") {
                    entity_container.appendChild(select);
                    entity_container.appendChild(label);
                    entity_container.appendChild(br);
                }
            }
        }
    } else {
        if (narrative_data.graph_data.entityClasses[entity]) {
            select.value = narrative_data.graph_data.entityClasses[entity];
        }
    }
}

function resolveConflict(classes) {
    const hasPerson = classes.includes("person");
    const hasLocation = classes.includes("location");
    const hasEvent = classes.includes("event");

    const isPLE = hasPerson && hasLocation && hasEvent;
    const isEL = hasEvent && hasLocation;
    const isPE = hasPerson && hasEvent;
    const isPL = hasPerson && hasLocation;

    if (isPLE) {
        if (ple_resolution == "ignore") {
            return "other";
        } else {
            return ple_resolution;
        }
    } else if (isEL) {
        if (el_resolution == "ignore") {
            return "other";
        } else {
            return el_resolution;
        }
    } else if (isPE) {
        if (pe_resolution == "ignore") {
            return "other";
        } else {
            return pe_resolution;
        }
    } else if (isPL) {
        if (pl_resolution == "ignore") {
            return "other";
        } else {
            return pl_resolution;
        }
    }

    return "other";
}

function resolveAll(assignedClass) {
    const multiEntitySelects = document.getElementById('multi-class-container').querySelectorAll("select");

    multiEntitySelects.forEach((select) => {
        select.value = assignedClass;
    });
}

async function generateResults() {
    const multiEntitySelects = document.getElementById('multi-class-container').querySelectorAll("select");
    multiEntitySelects.forEach((select) => {
        const entity = select.name;
        const value = select.value;
        narrative_data.graph_data.entityClasses[entity] = value;
    });

    const entitySelects = document.getElementById('entity-container').querySelectorAll("select");
    entitySelects.forEach((select) => {
        const entity = select.name;
        const value = select.value;
        narrative_data.graph_data.entityClasses[entity] = value;
    });

    try {
        const response = await fetch("/graphs/update_graph", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ graph_name: narrative_data.graph_name, graph: narrative_data.graph_data }),
        });
    } catch (error) {
        console.error(error);
        return false;
    }

    for (const [topic, data] of Object.entries(topic_data)) {
        if (!data.relevant_entities[data.entity]) {
            data.relevant_entities.push(data.entity);
        }

        for (const [key, value] of Object.entries(data.graph)) {
            if (narrative_data.graph_data.entityClasses[key] === 'event' && !data.relevant_entities[key]) {
                data.relevant_entities.push(key);
            }
        }

        console.log("relevant_entities: ", data.relevant_entities);
        data.title = topic;
        data.narrative = buildNarrative(data, data.relevant_entities);
        console.log("narrative: ", data.narrative);
    }

    const topics_to_remove = new Set();
    for (const [topic1, data1] of Object.entries(topic_data)) {
        if (topics_to_remove.has(topic1)) {
            continue;
        }
        for (const [topic2, data2] of Object.entries(topic_data)) {
            if (!topics_to_remove.has(topic2) && topic2 != topic1 && data2.graph[data1.entity]) {
                data1.narrative = data1.narrative.concat(data2.narrative);
                data1.title += " and " + topic2;
                topics_to_remove.add(topic2);
            }
        }
    }

    topics_to_remove.forEach((topic) => {
        delete topic_data[topic];
    });

    for (const [topic, data] of Object.entries(topic_data)) {
        data.narrative.sort((a, b) => {
            if (a.when < b.when) {
                return -1;
            }
            if (a.when > b.when) {
                return 1;
            }
            return 0;
        });
    }

    narrative_data.extractionEndTime = new Date();
    return true;
}

function buildNarrative(topic, relevant_entities) {
    let events = [];

    for (const entity of relevant_entities) {
        const entity_data = topic.graph[entity];
        if (entity_data && narrative_data.graph_data.entityClasses[entity] && entity_data.neighbors.length > 0) {
            if (narrative_data.graph_data.entityClasses[entity] === 'event') {
                entity_data.neighbors.forEach((neighbor) => {
                    console.log("Found neighbor: ", neighbor);
                    if (neighbor.is_event && neighbor.qualifier === "") {
                        const event = buildEntityEvent(topic, entity, entity_data, neighbor);
                        if (!events.some((x) => x.what === event.what && x.when === event.when &&  JSON.stringify(x.who) ===  JSON.stringify(event.who) &&  JSON.stringify(x.where) ===  JSON.stringify(event.where))) {
                            events.push(event);
                            neighbor.used = true;
                        }
                    }
                });
            } else {
                entity_data.neighbors.forEach((neighbor) => {
                    if (neighbor.is_event) {
                        const event = buildPropertyEvent(topic, entity, entity_data, neighbor);
                        if (!events.some((x) => x.what === event.what && x.when === event.when &&  JSON.stringify(x.who) ===  JSON.stringify(event.who) &&  JSON.stringify(x.where) ===  JSON.stringify(event.where))) {
                            events.push(event);
                            neighbor.used = true;
                        }
                    }
                });
            }
        }
    }

    events = events.filter((event) => {
        let eventDate = new Date(event.when);
        let result = true;
        if (narrative_data.min_date != null && eventDate != null) {
            result = result && eventDate >= narrative_data.min_date;
        }
        if (narrative_data.max_date != null && eventDate != null) {
            result = result && eventDate <= narrative_data.max_date;
        }
        return result;
    });

    return events;
}

function getLinkedEntities(topic, entity) {
    const entities = {};

    for (const [key, data] of Object.entries(topic.graph)) {
        const triples = data.neighbors.filter(neighbor => neighbor.entity === entity);
        if (triples.length > 0) {
            entities[key] = triples;
        }
    }

    return entities;
}

function buildEntityEvent(topic, entity, entity_data, triple_data) {
    const event = {
        'who': [],
        'what': "",
        'when': "",
        'where': [],
        'why': "",
        'how': "",
        'related_to': [],
        'isRelevant': false,
        'isEntityEvent': true
    };

    narrative_data.entityEventCount++;

    event.what = entity_data.data.label + " " + (narrative_data.graph_data.propertyData[getSuffix(triple_data.relationship)] ? narrative_data.graph_data.propertyData[getSuffix(triple_data.relationship)].label : "");
    if (triple_data.qualifier != "" && getSuffix(triple_data.qualifier) != getSuffix(triple_data.relationship)) {
        event.what += " " + narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)] ? narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label : "";
    }
    event.when = triple_data.entity;

    entity_data.neighbors.forEach((neighbor) => {
        if (!neighbor.is_event) {
            assignOutgoingTriple(topic, event, neighbor);
        }
    });

    const linked_entities = getLinkedEntities(topic, entity);
    for (const [key, list] of Object.entries(linked_entities)) {
        list.forEach((triple) => {
            assignIncomingTriple(topic, event, key, triple);
        });
    }

    triple_data.used = true;

    return event;
}

function buildPropertyEvent(topic, entity, entity_data, triple_data) {
    const event = {
        'who': [],
        'what': "",
        'when': "",
        'where': [],
        'why': "",
        'how': "",
        'related_to': [],
        'isRelevant': false,
        'isEntityEvent': false
    };

    narrative_data.propertyEventCount++;

    const object_class = narrative_data.graph_data.entityClasses[triple_data.entity];
    const object_data = topic.graph[triple_data.entity];

    event.what = narrative_data.graph_data.propertyData[getSuffix(triple_data.relationship)] ? narrative_data.graph_data.propertyData[getSuffix(triple_data.relationship)].label : "";
    event.when = object_data.data.label;

    switch (narrative_data.graph_data.entityClasses[entity]) {
        case 'event':
            event.related_to.push({entity: entity, label: entity_data.data.label, relation: "initiator", sameNarrative: topic.relevant_entities[entity] ? true : false});
            break;
        case 'location':
            event.where.push({entity: entity, label: entity_data.data.label, setting: "origin"});
            break;
        case 'person':
            event.who.push({entity: entity, label: entity_data.data.label, role: "perpetrator"});
            break;
        default:
            break;
    }

    const related_triples = clusterTriples(topic, entity, triple_data);
    console.log(entity, triple_data, related_triples);
    related_triples.forEach((triple) => {
        assignOutgoingTriple(topic, event, triple);
    });

    if (triple_data.qualifier != "" && getSuffix(triple_data.qualifier) != getSuffix(triple_data.relationship)) {
        event.what += ' ' + (narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)] ? narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label : "");
    }

    triple_data.used = true;

    return event;
}

function clusterTriples(topic, entity, central_triple) {
    const triples = topic.graph[entity].neighbors;
    //const clustered_triples = triples.filter((triple) => triple.statement === central_triple.statement);
    let clustered_triples = [];
    if (central_triple.statement != "") {
        clustered_triples = triples.filter((triple) => triple.statement === central_triple.statement && !triple.is_event);
    }

    if (narrative_data.graph_data.propertyData[getSuffix(central_triple.relationship)]) {
        const property_label = narrative_data.graph_data.propertyData[getSuffix(central_triple.relationship)].label;
        const filtered_triples = triples.filter((triple) => !clustered_triples.includes(triple));
        filtered_triples.forEach((triple) => {
            //let dist = levenshteinDistance(event.predicate_label, d.predicate_label);
            if (narrative_data.graph_data.propertyData[getSuffix(triple.relationship)] && !triple.is_event && (triple.statement === central_triple.statement || (central_triple.statement != triple.statement && !event_properties.has(getSuffix(triple.relationship))))) {
                let sim = ratcliffObershelp(property_label, narrative_data.graph_data.propertyData[getSuffix(triple.relationship)].label);
                if (sim > narrative_data.similarityThreshold) {
                    clustered_triples.push(triple);
                }
            }
        });
    }

    return clustered_triples;
}

function assignOutgoingTriple(topic, event_data, triple_data) {
    const object_data = topic.graph[triple_data.entity];
    const pure_property = triple_data.qualifier === "" ? getSuffix(triple_data.relationship) : getSuffix(triple_data.qualifier);

    if (object_data && object_data.is_entity) {
        switch (narrative_data.graph_data.entityClasses[triple_data.entity]) {
            case 'event':
                if (!event_data.related_to.some(e => e.entity === triple_data.entity && e.label === object_data.data.label && getSuffix(e.relation) === pure_property)) {
                    event_data.related_to.push({entity: triple_data.entity, label: object_data.data.label, relation: triple_data.relationship, sameNarrative: topic.relevant_entities[triple_data.entity] ? true : false});
                    triple_data.used = true;
                }
                break;
            case 'location':
                if (!event_data.where.some(e => e.entity === triple_data.entity && e.label === object_data.data.label && getSuffix(e.setting) === pure_property)) {
                    event_data.where.push({entity: triple_data.entity, label: object_data.data.label, setting: triple_data.relationship});
                    triple_data.used = true;
                }
                break;
            case 'person':
                if (!event_data.who.some(e => e.entity === triple_data.entity && e.label === object_data.data.label && getSuffix(e.role) === pure_property)) {
                    event_data.who.push({entity: triple_data.entity, label: object_data.data.label, role: triple_data.relationship});
                    triple_data.used = true;
                }
                break;
            case 'time':
                event_data.when = object_data.data.label;
                triple_data.used = true;
                break;
            case 'reason':
                if (triple_data.qualifier != "" && narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label) {
                    event_data.why = narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label + ": ";
                }
                event_data.why += object_data.data.label;
                triple_data.used = true;
                break;
            case 'manner':
                if (triple_data.qualifier != "" && narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label) {
                    event_data.how = narrative_data.graph_data.propertyData[getSuffix(triple_data.qualifier)].label + ": ";
                }
                event_data.how += object_data.data.label;
                triple_data.used = true;
                break;
            default:
                if (triple_data.qualifier != "" && getSuffix(triple_data.qualifier) === getSuffix(triple_data.relationship) && event_properties.has(getSuffix(triple_data.relationship))) {
                    event_data.what += ' ' + object_data.data.label;
                    triple_data.used = true;
                }
                return;
        }
    }
}

function assignIncomingTriple(topic, event_data, incoming_entity, triple_data) {
    const subject_data = topic.graph[incoming_entity];
    const pure_property = getSuffix(triple_data.relationship);

    if (subject_data && subject_data.is_entity && narrative_data.graph_data.entityClasses[incoming_entity]) {
        switch (narrative_data.graph_data.entityClasses[incoming_entity]) {
            case 'event':
                if (!event_data.related_to.some(e => e.entity === incoming_entity && e.label === subject_data.data.label && getSuffix(e.relation) === pure_property)) {
                    event_data.related_to.push({entity: incoming_entity, label: subject_data.data.label, relation: triple_data.relationship, sameNarrative: topic.relevant_entities[incoming_entity] ? true : false});
                    triple_data.used = true;
                }
                break;
            case 'location':
                if (!event_data.where.some(e => e.entity === incoming_entity && e.label === subject_data.data.label && getSuffix(e.setting) === pure_property)) {
                    event_data.where.push({entity: incoming_entity, label: subject_data.data.label, setting: triple_data.relationship});
                    triple_data.used = true;
                }
                break;
            case 'person':
                if (!event_data.who.some(e => e.entity === incoming_entity && e.label === subject_data.data.label && getSuffix(e.role) === pure_property)) {
                    event_data.who.push({entity: incoming_entity, label: subject_data.data.label, role: triple_data.relationship});
                    triple_data.used = true;
                }
                break;
            case 'time':
                event_data.when = subject_data.data.label;
                triple_data.used = true;
                break;
            case 'reason':
                event_data.why += " " + subject_data.data.label;
                triple_data.used = true;
                break;
            case 'manner':
                event_data.how += " " + subject_data.data.label;
                triple_data.used = true;
                break;
            default:
                return;
        }
    }
}

function ratcliffObershelp(s1, s2) {
    if (s1.length === 0 || s2.length === 0) {
        return 0;
    }

    const lcs = longestCommonSubstring(s1, s2);
    const similarity =
        (2.0 * lcs.length) / (s1.length + s2.length);

    return similarity;
}

function longestCommonSubstring(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const matrix = Array.from(Array(m + 1), () =>
        Array(n + 1).fill(0)
    );

    let maxLength = 0;
    let endIndex = 0;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
                if (matrix[i][j] > maxLength) {
                    maxLength = matrix[i][j];
                    endIndex = i - 1;
                }
            } else {
                matrix[i][j] = 0;
            }
        }
    }

    return s1.substring(endIndex - maxLength + 1, endIndex + 1);
}

// Data extraction query:

/*
SELECT ?s ?p ?o ?ol ?pq WHERE {
  {
    SELECT ?s ?p ?o1 WHERE {
      VALUES ?s {wd:Q7186}
      ?s ?p ?o1.
    }
  } UNION
  {
    SELECT ?s ?p ?o1 WHERE {
      VALUES ?s {wd:Q76}
      ?s ?p ?o1.
    }
  }
  OPTIONAL {
    ?o1 ?pq ?o2.
    OPTIONAL {
      ?o2 rdfs:label ?o2l.
      FILTER(lang(?o2l) = "en")
    }
    FILTER(ISLITERAL(?o2) || BOUND(?o2l))
    FILTER NOT EXISTS { {?o1 wdt:P31 ?t.} UNION {?o1 wdt:P279 ?t.} }
  }
  OPTIONAL {
    ?o1 rdfs:label ?o1l.
    FILTER(lang(?o1l) = "en")
  }
  BIND(coalesce(?o2, ?o1) as ?o)
  BIND(coalesce(?o2l, ?o1l) as ?ol)
  FILTER(?p NOT IN (skos:altLabel, rdfs:label, wdt:P31, schema:description, schema:dateModified))
  FILTER((ISIRI(?o) && BOUND(?ol)) || lang(?o) = "en" || DATATYPE(?o) = xsd:dateTime)
  FILTER NOT EXISTS {?p wdt:P31/wdt:P279* wd:Q19847637}
}*/