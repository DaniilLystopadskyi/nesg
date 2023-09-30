tabActions['start'] = {
  'init': getData,
  'transition': beginExtraction
}

let possibleEntities = [];

async function beginExtraction() {
  narrative_data.extractionStartTime = new Date();

  const topicInput = document.getElementById('topic');
  const depthInput = document.getElementById('depth');
  const sizeInput = document.getElementById('size');
  const degreeInput = document.getElementById('max_degree');
  const minTimeInput = document.getElementById('min_time');
  const maxTimeInput = document.getElementById('max_time');

  const plResolution = document.getElementById('pl-resolution');
  const peResolution = document.getElementById('pe-resolution');
  const elResolution = document.getElementById('el-resolution');
  const pleResolution = document.getElementById('ple-resolution');
  const graphSelect = document.getElementById('graph-select');
  const classTypeSelect = document.getElementById('classification-type');

  if(graphSelect.value == "none") {
    console.error("Graph not selected");
    return;
  }

  narrative_data.graph_data = graphs[graphSelect.value];

  const topics = topicInput.value.split(",");

  let topic_string = " ";
  topics.forEach((topic) => {
    topic_string += `"${topic}"@en `;
  });

  const sparqlQuery = `SELECT ?s (SAMPLE(?d) as ?d) ((GROUP_CONCAT(DISTINCT ?type; separator=", ")) as ?t) (SAMPLE(?topic) as ?topic) WHERE {
    VALUES ?topic {${topic_string}}
    ?s rdfs:label ?topic.
    ?s ${narrative_data.graph_data.type} ?type.

    OPTIONAL {
      ?s ${narrative_data.graph_data.description} ?d.
      FILTER (lang(?d) = "en")
    }
  } GROUP BY ?s`;

  possibleEntities = await query(sparqlQuery, "Searching for entities...");

  if (possibleEntities != null) {
    narrative_data.graph_name = graphSelect.value;
    narrative_data.topics = topics;
    narrative_data.topic_type = document.getElementById('topic-type').value;
    narrative_data.depth = parseInt(depthInput.value);
    narrative_data.size = parseInt(sizeInput.value);
    narrative_data.max_degree = parseInt(degreeInput.value);
    narrative_data.classification_type = classTypeSelect.value;

    pl_resolution = plResolution.value;
    pe_resolution = peResolution.value;
    el_resolution = elResolution.value;
    ple_resolution = pleResolution.value;

    narrative_data.min_date = minTimeInput.value ? new Date(minTimeInput.value) : null;
    narrative_data.max_date = maxTimeInput.value ? new Date(maxTimeInput.value) : null;
    
    return true;
  }

  return false;
}

async function getData() {
  const graphSelect = document.getElementById('graph-select');

  try {
      const response = await fetch("/data/graphs.json");
      graphs = await response.json();
  
      for (const graphName in graphs) {
          const opt = document.createElement('option');
          opt.value = graphName;
          opt.textContent = graphName;
          graphSelect.appendChild(opt);
      }
  } catch (error) {
      console.error(error);
  }
}

function onClassificationTypeChange() {
  const classParameters = document.getElementById('classification-parameters');
  const classTypeSelect = document.getElementById('classification-type');
  const classType = classTypeSelect.value;

  if (classType === "new" || classType === "all") {
    classParameters.style.display = "block";
  } else {
    classParameters.style.display = "none";
  }
}

function onGraphSelectChange() {
  const params = document.getElementById('params');
  const graphSelect = document.getElementById('graph-select');
  const newValue = graphSelect.value;

  if (newValue == "none") {
    params.style.display = "none";
  } else {
    params.style.display = "block";
  }
}