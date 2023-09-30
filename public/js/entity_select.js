tabActions['entity_select'] = {
  'init': entitySelection,
  'transition': extractData
}

const matching_entities = {};
const unique_entities = {};
const event_properties = new Set();
const entity_classes = {};

const degree_limit = 10000;

function entitySelection() {
  const container = document.getElementById('entity-select-container');

  container.innerHTML = '';

  narrative_data.topics.forEach((topic) => {
    const topic_triples = possibleEntities.filter((result) => result.topic.value === topic);
    if (topic_triples.length > 0) {
      createTopicModule(container, topic, topic_triples);
    }
  });
}

function createTopicModule(container, topic, topic_triples) {
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

  contents.innerHTML = `<table><tbody></tbody></table>`;
  const tableBody = contents.querySelector('tbody');

  topic_triples.forEach((triple) => {
    const subject = triple.s.value;
    const description = triple.d ? triple.d.value : "";
    const types = triple.t.value;

    if (!matching_entities[subject]) {
      matching_entities[subject] = {
        'description': description,
        'type': types
      };
    }

    const radioInput = document.createElement('input');
    radioInput.setAttribute('type', 'radio');
    radioInput.setAttribute('id', subject);
    radioInput.setAttribute('name', topic);
    radioInput.setAttribute('value', subject);
    radioInput.classList.add('checkbox');

    const radioLabel = document.createElement('label');
    radioLabel.setAttribute('for', subject);
    radioLabel.textContent = `${description} (${subject})`;

    const row = document.createElement('tr');

    const radioCell = document.createElement('td');
    radioCell.appendChild(radioInput);
    row.appendChild(radioCell);

    const labelCell = document.createElement('td');
    labelCell.appendChild(radioLabel);
    row.appendChild(labelCell);

    tableBody.appendChild(row);
  });
}

async function extractData() {
  const container = document.getElementById('entity-select-container');

  for (const topic of narrative_data.topics) {
    const selectedEntity = container.querySelector(`input[name="${topic}"]:checked`).id;

    topic_data[topic] = {
      'entity': selectedEntity,
      'description': matching_entities[selectedEntity].description,
      'types': matching_entities[selectedEntity].type,
      'graph': new Graph(),
      'relevant_entities': [],
      'narrative': [],
      'wikipediaOccurrences': {},
      'score': 0,
      'benchmark': {
        'relevancy': {
          'data': {},
          'num_relevant': 0,
          'total': 0
        },
        'attributes': []
      }
    };
    topic_data[topic].graph.addNode(selectedEntity, topic, matching_entities[selectedEntity].description, true, matching_entities[selectedEntity].type);

    let entity_set = new Set();
    entity_set.add(selectedEntity);

    console.log("Starting graph: ", selectedEntity, topic_data[topic].graph);

    await extractRelevantEntities(entity_set, 1, topic_data[topic].graph);

    console.log("End graph: ", selectedEntity, topic_data[topic].graph);

    topic_data[topic].graph = topic_data[topic].graph.nodes;

    unique_entities[selectedEntity] = {
      'label': topic,
      'description': matching_entities[selectedEntity].description
    };
  }

  return true;
}

async function extractRelevantEntities(last_entities, curr_depth, graph) {
  if (curr_depth > narrative_data.depth || last_entities.size <= 0) {
    return;
  }

  const unique_properties = [];
  let new_entities = new Set();

  const batches = [];
  for (let i = 0; i < last_entities.size; i += batchSize) {
    batches.push(Array.from(last_entities).slice(i, i + batchSize));
  }

  for (const batch of batches) {
    let sparql_query = `SELECT ?s ?l ?d ?t ?p ?o WHERE {`;
    let query_foot = `OPTIONAL {
        ?s rdfs:label ?l.
        FILTER (lang(?l) = "en")
      }
      OPTIONAL {
        ?s ${narrative_data.graph_data.description} ?d.
        FILTER (lang(?d) = "en")
      }
      FILTER(BOUND(?d) || BOUND(?l))
    }`;

    let count = 0;
    for (const e of batch) {
      let query_body = `{
            SELECT DISTINCT ?s ?p ?o WHERE {
              ${narrative_data.graph_data.excludedTypes.length > 0 ? `VALUES ?excl {${narrative_data.graph_data.excludedTypes.map(property => formatURI(property)).join(' ')}}` : ''}
              VALUES ?o {${formatURI(e)}}
              ?s ?p ?o .
              FILTER ISIRI(?s)
              ${narrative_data.graph_data.excludedTypes.length > 0 ? `FILTER (?p NOT IN (${narrative_data.graph_data.excludedTypes.map(property => formatURI(property)).join(', ')}))` : ''}
              ${narrative_data.graph_data.excludedTypes.length > 0 ? `FILTER ( NOT EXISTS {?p ${narrative_data.graph_data.type}/${narrative_data.graph_data.subclass}* ?excl})` : ''}
            } 
            LIMIT ${narrative_data.size}
          }`
      if (count < batch.length - 1) {
        query_body += ` UNION `;
      }
      sparql_query += query_body;
      count += 1;
    }
    sparql_query += query_foot;

    const results = await query(sparql_query, "Getting relevant entities for depth " + curr_depth + " ...");

    for (const result of results) {
      const subject = result.s.value;
      const property = result.p.value;
      const object = result.o.value;
      const label = result.l != undefined ? result.l.value : "";
      const description = result.d != undefined ? result.d.value : "";
      const pure_property = getSuffix(property);

      if (subject != null) {
        new_entities.add(subject);
        if (!unique_entities[subject]) {
          unique_entities[subject] = {
            'label': label,
            'description': description
          };
        }

        graph.addNode(subject, label, description, true);
        graph.addEdge(subject, property, object, "", "", false, (curr_depth - 1));

        if (property != null) {
          if (!narrative_data.graph_data.propertyData[pure_property] && !unique_properties.some((p) => getSuffix(p) === pure_property)) {
            unique_properties.push(property);
          }
        }
      }
    }
  }

  for (const batch of batches) {
    let sparql_query = `SELECT ?s ?p ?o ?ol ?od ?pq ?st ?is_event WHERE {
      ${narrative_data.graph_data.excludedTypes.length > 0 ? `VALUES ?excl {${narrative_data.graph_data.excludedTypes.map(property => formatURI(property)).join(' ')}}` : ''}`;
  
    let query_foot = `OPTIONAL {
        ?o1 ?pq ?o2.
        OPTIONAL {
          ?o2 rdfs:label ?o2l.
          FILTER(lang(?o2l) = "en")
        }
        OPTIONAL {
          ?o2 ${narrative_data.graph_data.description} ?o2d.
          FILTER(lang(?o2d) = "en")
        }
        FILTER(ISLITERAL(?o2) || BOUND(?o2l) || BOUND(?o2d))
        FILTER NOT EXISTS { {?o1 ${narrative_data.graph_data.type} ?t.} UNION {?o1 ${narrative_data.graph_data.subclass} ?t.} }
        BIND(?o1 as ?st)
      }
      OPTIONAL {
        ?o1 rdfs:label ?o1l.
        FILTER(lang(?o1l) = "en")
      }
      OPTIONAL {
        ?o1 ${narrative_data.graph_data.description} ?o1d.
        FILTER(lang(?o1d) = "en")
      }
  
      BIND(coalesce(?o2, ?o1) as ?o)
      BIND(coalesce(?o2l, ?o1l) as ?ol)
      BIND(coalesce(?o2d, ?o1d) as ?od)
  
      FILTER(?p NOT IN (skos:altLabel, rdfs:label, ${narrative_data.graph_data.type}, ${narrative_data.graph_data.description}, schema:dateModified))
      FILTER((ISIRI(?o) && (BOUND(?ol) || BOUND(?od))) || lang(?o) = "en" || (DATATYPE(?o) = xsd:dateTime || DATATYPE(?o) = xsd:date ))
      ${narrative_data.graph_data.excludedTypes.length > 0 ? `FILTER (?p NOT IN (${narrative_data.graph_data.excludedTypes.map(property => formatURI(property)).join(', ')}))` : ''}
      ${narrative_data.graph_data.excludedTypes.length > 0 ? `FILTER ( NOT EXISTS {?p ${narrative_data.graph_data.type}/${narrative_data.graph_data.subclass}* ?excl})` : ''}
      BIND((DATATYPE(?o) = xsd:dateTime || DATATYPE(?o) = xsd:date) as ?is_event)
    }`

    let count = 0;
    for (const e of batch) {
      let query_body = `{
          SELECT DISTINCT ?s ?p ?o1 WHERE {
            VALUES ?s {${formatURI(e)}}
            ?s ?p ?o1.
          }
        }`
      if (count < batch.length - 1) {
        query_body += ` UNION `;
      }
      sparql_query += query_body;
      count += 1;
    }
    sparql_query += query_foot;

    const results = await query(sparql_query, "Getting relevant entities for depth " + curr_depth + " ...");

    for (const result of results) {
      const subject = result.s.value;

      const property = result.p.value;
      const pure_property = property !== "" ? getSuffix(property) : "";

      const is_entity = result.o.type === "uri" ? true : false;
      const object = result.o ? result.o.value.replace(/(\r\n|\n|\r)/gm, "") : "";
      const object_label = result.ol != undefined ? result.ol.value.replace(/(\r\n|\n|\r)/gm, "") : (!is_entity ? result.o.value.replace(/(\r\n|\n|\r)/gm, "") : "");
      const description = result.od != undefined ? result.od.value.replace(/(\r\n|\n|\r)/gm, "") : "";

      const qualifier = result.pq != undefined ? result.pq.value : "";
      const pure_qualifier = qualifier !== "" ? getSuffix(qualifier) : "";

      const statement = result.st != undefined ? result.st.value : "";
      const is_event = result.is_event != undefined ? (result.is_event.value.toLowerCase() === "true" || result.is_event.value.toLowerCase() === "1") : false;

      if (object != "") {
        if (is_entity) {
          new_entities.add(object);

          if (!unique_entities[object]) {
            unique_entities[object] = {
              'label': object_label,
              'description': description
            };
          }
        }

        graph.addNode(object, object_label, description, is_entity);
        graph.addEdge(subject, property, object, qualifier, statement, is_event, distance = (curr_depth - 1));

        if (property !== "") {
          if (!narrative_data.graph_data.propertyData[pure_property] && !unique_properties.some((property) => getSuffix(property) === pure_property)) {
            unique_properties.push(property);
          }
        }
        if (qualifier !== "") {
          if (!narrative_data.graph_data.propertyData[pure_qualifier] && !unique_properties.some((property) => getSuffix(property) === pure_qualifier)) {
            unique_properties.push(qualifier);
          }
        }
        if (is_event) {
          event_properties.add(pure_property);
        }
      }
    }
  }

  const pruned_entities = await pruneEntities(new_entities);
  await getPropertyData(unique_properties);

  if (narrative_data.classification_type === "new" || narrative_data.classification_type === "all") {
    await classifyEntities(new_entities);
  }

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

  await extractRelevantEntities(pruned_entities, curr_depth + 1, graph);
}

async function pruneEntities(entities) {
  if (entities.size <= 0) {
    return;
  }

  const pruned_entities = new Set();
  const unknown_entities = [];

  entities.forEach((entity) => {
    if (narrative_data.graph_data.entityCentrality[entity]) {
      if (narrative_data.graph_data.entityCentrality[entity] <= narrative_data.max_degree) {
        pruned_entities.add(entity);
      }
    } else {
      unknown_entities.push(entity);
    }
  });

  if (unknown_entities.length > 0) {
    const batches = [];
    for (let i = 0; i < unknown_entities.length; i += batchSize) {
      batches.push(unknown_entities.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      let sparql_query = "SELECT ?x (COUNT(DISTINCT ?s) as ?count) WHERE {";
      let count = 0;
      batch.forEach((e) => {
        let query_body = `{
        SELECT DISTINCT ?s ?p ?x WHERE {
          VALUES ?x {${formatURI(e)}}
          ?s ?p ?x
        } LIMIT ${degree_limit}
      }`
        if (count < batch.length - 1) {
          query_body += `UNION`;
        }
        sparql_query += query_body;
        count += 1;
      });
      sparql_query += "} GROUP BY ?x";

      let results = await query(sparql_query, "Pruning entities...");

      if (results != null) {
        results.forEach((result) => {
          const entity = result.x.value;
          const degree = parseInt(result.count.value);

          if (degree <= narrative_data.max_degree) {
            pruned_entities.add(entity);
          }

          narrative_data.graph_data.entityCentrality[entity] = parseInt(degree);
        });
      }
    }
  }

  return pruned_entities;
}

async function getPropertyData(properties) {
  if (properties.length <= 0) {
    return;
  }

  const batches = [];
  for (let i = 0; i < properties.length; i += batchSize) {
    batches.push(properties.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batch_string = batch.map(property => formatURI(property)).join(" ");
    const sparql_query = `SELECT ?o (SAMPLE(?lab) as ?label) (SAMPLE(?ds) as ?desc) WHERE {
      VALUES ?o {${batch_string}}
      OPTIONAL {
        ?o rdfs:label ?l.
        FILTER(lang(?l) = "en")
      }
      OPTIONAL {
        ?s ?p ?o .
        ?s rdfs:label ?sl.
        FILTER(lang(?sl) = "en")
        FILTER(replace(str(?o), "^.*/", "") = replace(str(?s), "^.*/", ""))
      }
      OPTIONAL {
        ?o ${narrative_data.graph_data.description} ?d.
        FILTER(lang(?d) = "en")
      }
      OPTIONAL {
        ?s ?p ?o .
        ?s ${narrative_data.graph_data.description} ?sd.
        FILTER(lang(?sd) = "en")
        FILTER(replace(str(?o), "^.*/", "") = replace(str(?s), "^.*/", ""))
      }
      FILTER(BOUND(?l) || BOUND(?sl))
      BIND(COALESCE(?l, ?sl) as ?lab)
      BIND(COALESCE(?d, ?sd) as ?ds)
    } GROUP BY ?o`

    const results = await query(sparql_query, "Getting property labels...");

    if (results != null) {
      results.forEach((result) => {
        const property = result.o.value;
        const pure_property = getSuffix(property);
        const label = result.label ? result.label.value.replace(/(\r\n|\n|\r)/gm, "") : "";
        const description = result.desc != undefined ? result.desc.value.replace(/(\r\n|\n|\r)/gm, "") : "";
        narrative_data.graph_data.propertyData[pure_property] = { 'label': label, 'description': description };
      });
    }
  }
}

async function classifyEntities(entities) {
  const unclassified_entities = [];

  entities.forEach((entity) => {
    if (narrative_data.classification_type === "all") {
      unclassified_entities.push(formatURI(entity));
    } else if (narrative_data.classification_type === "new") {
      if (!narrative_data.graph_data.entityClasses[entity]) {
        unclassified_entities.push(formatURI(entity));
      }
    }
  });

  const batches = [];
  for (let i = 0; i < unclassified_entities.length; i += batchSize) {
    batches.push(unclassified_entities.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batch_string = batch.join(" ");
    const sparql_query = `SELECT ?s ?t {
      VALUES ?s { ${batch_string} }
      VALUES ?t { ${narrative_data.graph_data.classes.person.map(type => formatURI(type)).join(" ")} ${narrative_data.graph_data.classes.location.map(type => formatURI(type)).join(" ")} ${narrative_data.graph_data.classes.event.map(type => formatURI(type)).join(" ")} ${narrative_data.graph_data.classes.reason.map(type => formatURI(type)).join(" ")} ${narrative_data.graph_data.classes.manner.map(type => formatURI(type)).join(" ")}}
      FILTER EXISTS {?s ${narrative_data.graph_data.type}/${narrative_data.graph_data.subclass}* ?t}
    } ORDER BY ?s ?t`

    const results = await query(sparql_query, "Gathering entity classes...");

    if (results != null) {
      results.forEach((result) => {
        const entity = result.s.value;
        const type = result.t.value;

        if (!entity_classes[entity]) {
          entity_classes[entity] = [];
        }

        for (const [cls, list] of Object.entries(narrative_data.graph_data.classes)) {
          if (list.includes(type) && !entity_classes[entity].includes(cls)) {
            entity_classes[entity].push(cls);
          }
        }
      });

      batch.forEach((e) => {
        if (!entity_classes[e] || entity_classes[e].length === 0) {
          entity_classes[e] = ["other"];
        }
      });
    }
  }
}

// Relevant incoming entity extraction query:

/*
SELECT
?s
(GROUP_CONCAT(DISTINCT ?l; separator=", ") as ?label)
(GROUP_CONCAT(DISTINCT ?d; separator=", ") as ?desc)
(GROUP_CONCAT(DISTINCT ?td; separator=", ") as ?tdesc)
(GROUP_CONCAT(DISTINCT ?o; separator=", ") as ?out)
WHERE {
  {
    SELECT DISTINCT ?s ?o WHERE {
      VALUES ?o {wd:Q7186}
      ?s ?p ?o .
      FILTER ISIRI(?s)
      FILTER NOT EXISTS {?s wdt:P31/wdt:P279* wd:Q19847637}
    }
    LIMIT 10
  }
  UNION
  {
    SELECT DISTINCT ?s ?o WHERE {
      VALUES ?o {wd:Q42}
      ?s ?p ?o .
      FILTER ISIRI(?s)
      FILTER NOT EXISTS {?s wdt:P31/wdt:P279* wd:Q19847637}
    }
    LIMIT 10
  }
  OPTIONAL {
    ?s wdt:P31 ?type.
    ?type ${narrative_data.graph_data.description} ?td.
    FILTER (lang(?td) = "en")
  }
  OPTIONAL {
    ?s rdfs:label ?l.
    FILTER (lang(?l) = "en")
  }
  OPTIONAL {
    ?s ${narrative_data.graph_data.description} ?d.
    FILTER (lang(?d) = "en")
  }
  FILTER(BOUND(?td) || BOUND(?d) || BOUND(?l))
}
GROUP BY ?s
ORDER BY ?out*/

// In-degree centrality query

/*
SELECT ?x (COUNT(DISTINCT ?s) as ?count) WHERE { 
  {
    SELECT DISTINCT ?s ?x WHERE {
      VALUES ?x {wd:Q7186}
      ?s ?p ?x
    } LIMIT 10000
  } 
  UNION
  {
    SELECT DISTINCT ?s ?x WHERE {
      VALUES ?x {wd:Q5}
      ?s ?p ?x
    } LIMIT 10000
  }
}
GROUP BY ?x*/

// Outgoing entity extraction query:

/*
SELECT ?s ?p ?o ?ol ?od ?pq WHERE {
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
    OPTIONAL {
      ?o2 ${narrative_data.graph_data.description} ?o2d.
      FILTER(lang(?o2d) = "en")
    }
    FILTER(ISLITERAL(?o2) || BOUND(?o2l) || BOUND(?o2d))
    FILTER NOT EXISTS { {?o1 wdt:P31 ?t.} UNION {?o1 wdt:P279 ?t.} }
  }
  OPTIONAL {
    ?o1 rdfs:label ?o1l.
    FILTER(lang(?o1l) = "en")
  }
  OPTIONAL {
    ?o1 ${narrative_data.graph_data.description} ?o1d.
    FILTER(lang(?o1d) = "en")
  }
  BIND(coalesce(?o2, ?o1) as ?o)
  BIND(coalesce(?o2l, ?o1l) as ?ol)
  BIND(coalesce(?o2d, ?o1d) as ?od)
  FILTER(?p NOT IN (skos:altLabel, rdfs:label, wdt:P31, ${narrative_data.graph_data.description}, schema:dateModified))
  FILTER((ISIRI(?o) && (BOUND(?ol) || BOUND(?od))) || lang(?o) = "en" || DATATYPE(?o) = xsd:dateTime)
  FILTER NOT EXISTS {?p wdt:P31/wdt:P279* wd:Q19847637}
}*/

// Property label extraction query:

`SELECT ?o (SAMPLE(?l) as ?label) WHERE {
  {
    SELECT ?s ?o WHERE {
      VALUES ?o {pq:P585}
      ?s ?p ?intermediate .
      ?intermediate (<>|^<>)* ?o .
      ?s ?p ?o .
    }
  } UNION
  {
    SELECT ?s ?o WHERE {
      VALUES ?o {ps:P734}
      ?s ?p ?intermediate .
      ?intermediate (<>|^<>)* ?o .
      ?s ?p ?o .
    }
  }
  OPTIONAL {
    ?o rdfs:label ?l.
    FILTER(lang(?l) = "en")
  }
  OPTIONAL {
    ?s rdfs:label ?sl.
    FILTER(lang(?sl) = "en")
  }
  FILTER(BOUND(?l) || ((replace(str(?o), "^.*/", "") = replace(str(?s), "^.*/", "")) && BOUND(?sl)))
  BIND(COALESCE(?l, ?sl) as ?l)
} GROUP BY ?o`


// Type check query

/*SELECT ?s ?t ?is_type {
  VALUES ?t { wd:Q5 wd:Q115095765 }
  {
      SELECT ?s ?t ?is_type {
        VALUES ?s { wd:Q142 }
        BIND((EXISTS {?s wdt:P31/wdt:P279* ?t}) as ?is_type)
      }
  }
  UNION
  {
      SELECT ?s ?t ?is_type {
        VALUES ?s { wd:Q7186 }
        BIND((EXISTS {?s wdt:P31/wdt:P279* ?t}) as ?is_type)
      }
   }
}*/