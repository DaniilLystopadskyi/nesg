class Graph {
  constructor() {
    this.nodes = {};
  }

  addNode(entity, label = null, description = null, is_entity = false, type = null, entity_class = "other") {
    if (!this.nodes[entity]) {
      this.nodes[entity] = {
        'is_entity': is_entity,
        'data': {
          'label': label,
          'description': description,
          'types': type,
          'class': entity_class
        },
        'neighbors': []
      };
    }
  }

  addEdge(subject, property, object, qualifier = "", statement = "", is_event = false, distance = 0) {
    if (this.nodes[subject] && this.nodes[object]) {
      const prop_suffix = getSuffix(property);
      const node_data = this.nodes[subject];
      const found = node_data.neighbors.findIndex(neighbor => getSuffix(neighbor.relationship) === prop_suffix && neighbor.entity === object && neighbor.qualifier === qualifier && neighbor.statement === statement && neighbor.is_event === is_event && neighbor.distance === distance);
      if (found < 0) {
        node_data.neighbors.push({ 'relationship': property, 'entity': object, 'qualifier': qualifier, 'statement': statement, 'is_event': is_event, 'distance': distance, 'used': false });
      }
    }
  }

  removeNode(entity) {
    if (this.nodes[entity]) {
      delete this.nodes[entity];
    }
  }

  printGraph() {
    for (const [key, value] of Object.entries(this.nodes)) {
      value.neighbors.forEach((neighbor) => {
        console.log(key, neighbor.entity);
      });
    }
  }
}