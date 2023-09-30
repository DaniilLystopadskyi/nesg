tabActions['configuration'] = {
    'init': loadGraphs,
    'transition': function () { return true; }
}

async function applyChanges() {
    const graphSelect = document.getElementById('graph-config-select');

    const graph_name = await addNewGraph();
    graphSelect.value = graph_name;
}

async function deleteGraph() {
    const graphSelect = document.getElementById('graph-config-select');
    const selectedGraph = graphSelect.value;

    if (selectedGraph == "new_graph") {
        console.log("Must select graph first");
        return;
    }

    delete graphs[selectedGraph];

    try {
        const response = await fetch("/graphs/delete_graph", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ graph_name: selectedGraph }),
        });
    } catch (error) {
        console.error(error);
    }
}

async function wipeData() {
    const graphSelect = document.getElementById('graph-config-select');
    const selectedGraph = graphSelect.value;

    if (selectedGraph == "new_graph") {
        console.log("Must select graph first");
        return;
    }

    graphs[selectedGraph].entityClasses = {};
    graphs[selectedGraph].entityCentrality = {};

    try {
        const response = await fetch("/graphs/update_graph", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ graph_name: selectedGraph, graph: graphs[selectedGraph] }),
        });
    } catch (error) {
        console.error(error);
    }
}

function onSelectionChange() {
    const applyBtn = document.getElementById('apply-btn');
    const graphNameInput = document.getElementById('graph-name');
    const graphSelect = document.getElementById('graph-config-select');
    const newValue = graphSelect.value;

    if (newValue == "new_graph") {
        clear();
        applyBtn.innerHTML = "Add Graph";
        graphNameInput.readOnly = false;
    } else {
        loadGraphData(graphSelect.value);
        narrative_data.graph_data = graphs[graphSelect.value];
        applyBtn.innerHTML = "Update Graph";
        graphNameInput.readOnly = true;
    }
}

function loadGraphs() {
    const graphSelect = document.getElementById('graph-config-select');

    for (const graphName in graphs) {
        const opt = document.createElement('option');
        opt.value = graphName;
        opt.textContent = graphName;
        graphSelect.appendChild(opt);
    }
}

function loadGraphData(graphName) {
    const graphData = graphs[graphName];
    const graphNameInput = document.getElementById('graph-name');
    const endpointInput = document.getElementById('endpoint');
    const typeInput = document.getElementById('type');
    const subclassInput = document.getElementById('subclass');
    const descriptionInput = document.getElementById('description');

    clear();

    graphNameInput.value = graphName;
    endpointInput.value = graphData.endpoint;
    typeInput.value = graphData.type;
    subclassInput.value = graphData.subclass;
    descriptionInput.value = graphData.description;

    loadExcludedTypes(graphData.excludedTypes);

    for (const className in graphData.classes) {
        loadClasses(className, graphData.classes[className]);
    }

    loadPrefixes(graphData.prefixes);
}

function loadClasses(className, classes) {
    const selectedClasses = document.getElementById(`selected-${className}-classes`);

    for (classID of classes) {
        const availableClasses = document.querySelectorAll(`#${className}-classes button[value="${classID}"]`);

        // If there are already buttons for this class, move them to selected classes
        if (availableClasses.length > 0) {
            for (const button of availableClasses) {
                moveButton(button, className);
            }
        } else {
            // Otherwise, add the button for this class
            addClass(classID, selectedClasses, className);
        }
    }
}

function loadExcludedTypes(excludedTypes) {
    const container = document.getElementById('excluded-types');

    for (const type of excludedTypes) {
        const button = document.createElement('button');

        button.type = "button";
        button.value = type;
        button.textContent = type;
        button.onclick = function() { button.remove(); };
        container.appendChild(button);
    }
}

function loadPrefixes(prefixes) {
    const container = document.querySelector("#prefixes-container");
    const inputGroupTemplate = document.querySelector(".namespace-container");

    for (const uri in prefixes) {
        const inputGroup = inputGroupTemplate.cloneNode(true);
        const prefixInput = inputGroup.querySelector(".prefix-input");
        const uriInput = inputGroup.querySelector(".uri-input");

        prefixInput.value = prefixes[uri];
        uriInput.value = uri;

        prefixInput.setAttribute("readonly", true);
        uriInput.setAttribute("readonly", true);

        container.prepend(inputGroup);
    }
}

function clear() {
    const graphNameInput = document.getElementById('graph-name');
    const endpointInput = document.getElementById('endpoint');
    const typeInput = document.getElementById('type');
    const subclassInput = document.getElementById('subclass');
    const descriptionInput = document.getElementById('description');
    const classFields = ["selected-person-classes", "selected-location-classes", "selected-event-classes", "selected-reason-classes", "selected-manner-classes"];

    graphNameInput.value = "";
    endpointInput.value = "";
    typeInput.value = "";
    subclassInput.value = "";
    descriptionInput.value = "";

    for (const classField of classFields) {
        const fieldButtons = document.querySelectorAll(`#${classField} button`);

        for (const button of fieldButtons) {
            moveButton(button, classField);
        }
    }

    clearPrefixes();
}

function clearPrefixes() {
    const inputGroups = document.querySelectorAll(".namespace-container");

    inputGroups.forEach(function (inputGroup, index) {
        if (index > 0) {
            inputGroup.remove();
        } else {
            const prefixInput = inputGroup.querySelector(".prefix-input");
            const uriInput = inputGroup.querySelector(".uri-input");

            prefixInput.value = "";
            uriInput.value = "";

            prefixInput.removeAttribute("readonly");
            uriInput.removeAttribute("readonly");
        }
    });
}

async function addNewGraph() {
    const graphSelect = document.getElementById('graph-config-select');
    const personClasses = document.getElementById('selected-person-classes');
    const locationClasses = document.getElementById('selected-location-classes');
    const eventClasses = document.getElementById('selected-event-classes');
    const reasonClasses = document.getElementById('selected-reason-classes');
    const mannerClasses = document.getElementById('selected-manner-classes');

    const graphNameInput = document.getElementById('graph-name');
    const endpointInput = document.getElementById('endpoint');
    const typeInput = document.getElementById('type');
    const subclassInput = document.getElementById('subclass');
    const descriptionInput = document.getElementById('description');
    const graph_name = graphNameInput.value;
    const data = {};

    data.classes = {};
    data.entityClasses = {};
    data.entityCentrality = {};
    data.propertyData = {};

    confirmClasses(personClasses, "person", data);
    confirmClasses(locationClasses, "location", data);
    confirmClasses(eventClasses, "event", data);
    confirmClasses(reasonClasses, "reason", data);
    confirmClasses(mannerClasses, "manner", data);

    confirmExclusions(data);

    data.prefixes = getPrefixes();

    data['endpoint'] = endpointInput.value;
    data['type'] = typeInput.value;
    data['subclass'] = subclassInput.value;
    data['description'] = descriptionInput.value;

    try {
        const response = await fetch("/graphs/update_graph", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ graph_name: graph_name, graph: data }),
        });
    } catch (error) {
        console.error(error);
    }

    graphs[graph_name] = data;

    if (graphSelect.value == 'new_graph') {
        const opt = document.createElement('option');
        opt.value = graph_name;
        opt.textContent = graph_name;
        graphSelect.appendChild(opt);
    }

    return graph_name;
}

function getPrefixes() {
    const inputGroups = document.querySelectorAll(".namespace-container");
    const data = {};

    for (const inputGroup of inputGroups) {
        const prefixInput = inputGroup.querySelector(".prefix-input");
        const uriInput = inputGroup.querySelector(".uri-input");
        const prefix = prefixInput.value;
        const uri = uriInput.value;

        if (prefix && uri) {
            data[uri] = prefix;
        }
    }

    return data;
}

function confirmClasses(container, type, data) {
    data.classes[type] = [];
    const children = container.children;

    for (var i = 0; i < children.length; i++) {
        const child = children[i];
        const className = child.textContent;
        data.classes[type].push(className);
    }
}

function confirmExclusions(data) {
    const container = document.getElementById('excluded-types');

    data.excludedTypes = [];
    const children = container.children;

    for (var i = 0; i < children.length; i++) {
        const child = children[i];
        const typeName = child.textContent;
        data.excludedTypes.push(typeName);
    }
}

function addExclusion() {
    const button = document.createElement('button');
    const type = document.getElementById('new-exclusion').value;
    const container = document.getElementById('excluded-types');

    button.type = "button";
    button.value = type;
    button.textContent = type;
    button.onclick = function() { button.remove(); };
    container.appendChild(button);
}

function addClass(class_string, parent_field, classType) {
    const button = document.createElement('button');
    button.type = "button";
    button.value = class_string;
    button.textContent = class_string;
    button.onclick = function() { moveButton(button, classType); };
    parent_field.appendChild(button);
}

function moveButton(button, classType) {
    const sourceField = button.parentElement.id;

    if (sourceField === `selected-${classType}-classes`) {
        document.getElementById(`${classType}-classes`).appendChild(button);
    } else if (sourceField === `${classType}-classes`) {
        document.getElementById(`selected-${classType}-classes`).appendChild(button);
    }
}

function addCustomClass(class_type) {
    const selectedClasses = document.getElementById(`selected-${class_type}-classes`);
    const newClass = document.getElementById(`new_${class_type}`).value;

    addClass(newClass, selectedClasses, class_type);
}

function addNamespace() {
    const container = document.querySelector("#prefixes-container");
    const inputGroup = document.querySelector(".namespace-container").cloneNode(true);
    const prefixInput = inputGroup.querySelector(".prefix-input");
    const uriInput = inputGroup.querySelector(".uri-input");

    prefixInput.value = "";
    uriInput.value = "";

    prefixInput.removeAttribute("readonly");
    uriInput.removeAttribute("readonly");

    container.appendChild(inputGroup);
}