function getMentions(subject = null, predicate = null, object = null, graph) {
    let mentions = 0;

    for (const entity in graph) {
        for (const neighbor of graph[entity].neighbors) {
            const neighborEntity = neighbor.entity;
            const neighborRelationship = neighbor.relationship;

            // Check if subject, predicate, and object match conditions
            const subjectMatches = subject === null || entity === subject || neighborEntity === subject;
            const predicateMatches = predicate === null || predicate === neighborRelationship;
            const objectMatches = object === null || entity === object || neighborEntity === object;

            if (subjectMatches && predicateMatches && objectMatches) {
                mentions++;
            }
        }
    }

    return mentions;
}

function calculateAttributeData(narrative) {
    const attributeData = {
        whoOccurrences: 0,
        whereOccurrences: 0,
        whyOccurrences: 0,
        howOccurrences: 0,
        relatedToOccurrences: 0,
        meanEventCompleteness: 0,
        numCompleteEvents: 0,
        numNoOptionalAttributes: 0,
        meanWhatWordCount: 0
    }

    const numAttributes = 7.0;
    let totalMeanCompleteness = 0;
    let totalWhatWordCount = 0;

    // Iterate through the narrative array
    for (const event of narrative) {
        let eventCompleteness = 0.0;
        let hasAttributes = 0;
        let hasOptional = false;

        // Calculate number of attributes with values
        if (event.what && event.what != "") {
            eventCompleteness += 1.0;
            totalWhatWordCount += event.what.trim().split(/\s+/).length;
            hasAttributes += 1;
        }
        if (event.when && event.when != "") {
            eventCompleteness += 1.0;
            hasAttributes += 1;
        }
        if (event.who && event.who.length > 0) {
            eventCompleteness += 1.0;
            attributeData.whoOccurrences += 1;
            hasAttributes += 1;
            hasOptional = true;
        }
        if (event.where && event.where.length > 0) {
            eventCompleteness += 1.0;
            attributeData.whereOccurrences += 1;
            hasAttributes += 1;
            hasOptional = true;
        }
        if (event.why && event.why != "") {
            eventCompleteness += 1.0;
            attributeData.whyOccurrences += 1;
            hasAttributes += 1;
            hasOptional = true;
        }
        if (event.how && event.how != "") {
            eventCompleteness += 1.0;
            attributeData.howOccurrences += 1;
            hasAttributes += 1;
            hasOptional = true;
        }
        if (event.related_to && event.related_to.length > 0) {
            eventCompleteness += 1.0;
            attributeData.relatedToOccurrences += 1;
            hasAttributes += 1;
            hasOptional = true;
        }
        // Get mean completeness
        totalMeanCompleteness += eventCompleteness / numAttributes;

        if (hasAttributes === numAttributes) {
            attributeData.numCompleteEvents += 1;
        }

        if (!hasOptional) {
            attributeData.numNoOptionalAttributes += 1;
        }
    }

    attributeData.meanWhatWordCount = (totalWhatWordCount / narrative.length).toFixed(2);
    attributeData.meanEventCompleteness = (totalMeanCompleteness / narrative.length).toFixed(2);

    return attributeData;
}

function calculateEventSequences(narrative) {
    const eventSequences = [];
    let currentSequence = [];

    // Sort the events by their "when" attribute (assuming "when" is in a format that can be compared)
    narrative.sort((a, b) => new Date(a.when) - new Date(b.when));

    // Function to check if two events share at least one location or person
    function shareLocationOrPerson(event1, event2) {
        return haveCommongEntity(event1.who, event2.who) || haveCommongEntity(event1.where, event2.where);
    }

    // Iterate through the sorted events to find sequences
    for (let i = 0; i < narrative.length; i++) {
        if (currentSequence.length === 0) {
            // Start a new sequence with the first event
            currentSequence.push(narrative[i]);
        } else {
            // Check if the current event shares at least one location or person with the last event in the sequence
            if (shareLocationOrPerson(currentSequence[currentSequence.length - 1], narrative[i])) {
                currentSequence.push(narrative[i]);
            } else {
                // Start a new sequence if there's no sharing
                eventSequences.push([...currentSequence]); // Copy the current sequence
                currentSequence = [narrative[i]];
            }
        }
    }

    // Add the last sequence, if any
    if (currentSequence.length > 0) {
        eventSequences.push([...currentSequence]); // Copy the last sequence
    }

    return eventSequences;
}

// Helper function to check if two events entity lists share at least one entity
function haveCommongEntity(event1Entities, event2Entities) {
    const entities1 = new Set(event1Entities.map(obj => obj.entity));
    return event2Entities.some(obj => entities1.has(obj.entity));
}

function calculateAverageEventSequenceLength(eventSequences) {
    if (eventSequences.length === 0) {
        return 0; // Return 0 if there are no event sequences
    }

    const totalLength = eventSequences.reduce((sum, sequence) => sum + sequence.length, 0);
    const averageLength = (totalLength / eventSequences.length).toFixed(2);

    return averageLength;
}

function extractEventData(narrative) {
    const eventData = {
        eventOccurrences: {},
        meanNumCharacters: 0.0,
        meanNumLocations: 0.0,
        meanNumRelatedEvents: 0.0,
        mostReocurrentEvent: null,
    };

    let mostReocurrentEvent = null;
    let mostOccurrences = 0;

    // Iterate through the narrative data
    for (const event of narrative) {
        // Create a signature for the event based on all properties except "when"
        const eventSignature = JSON.stringify({
            what: event.what,
            who: event.who,
            where: event.where,
            why: event.why,
            how: event.how,
            related_to: event.related_to
        });

        if (!eventData.eventOccurrences[eventSignature]) {
            eventData.eventOccurrences[eventSignature] = 1;
        } else {
            eventData.eventOccurrences[eventSignature] += 1;
        }

        if (eventData.eventOccurrences[eventSignature] > mostOccurrences) {
            mostReocurrentEvent = eventSignature;
            mostOccurrences = eventData.eventOccurrences[eventSignature];
        }

        if (event.who) {
            eventData.meanNumCharacters += event.who.length;
        }
        if (event.where) {
            eventData.meanNumLocations += event.where.length;
        }
        if (event.related_to) {
            eventData.meanNumRelatedEvents += event.related_to.length;
        }
    }

    eventData.meanNumCharacters = (eventData.meanNumCharacters / narrative.length).toFixed(2);
    eventData.meanNumLocations = (eventData.meanNumCharacters / narrative.length).toFixed(2);
    eventData.meanNumRelatedEvents = (eventData.meanNumCharacters /narrative.length).toFixed(2);

    eventData.mostReocurrentEvent = mostReocurrentEvent;

    return eventData;
}

function extractCharacterData(narrative) {
    const characterData = {};

    // Iterate through each event in the narrative data
    narrative.forEach(event => {
        if (event.who && Array.isArray(event.who)) {
            event.who.forEach(character => {
                const { entity, label, role } = character;

                // Store the character
                if (!characterData[entity]) {
                    characterData[entity] = {
                        label: label,
                        occurrences: 1,
                        roles: new Set()
                    };
                } else {
                    // Update the character occurrence count and roles
                    characterData[entity].occurrences += 1;
                    characterData[entity].roles.add(role);
                }
            });
        }
    });

    return characterData;
}

function calculateMostRecurringCharacter(characterData) {
    // Find the character with the highest occurrence count (most recurring character)
    let mostRecurringCharacter = null;
    let mostOccurrences = 0;

    for (const character in characterData) {
        const occurrences = characterData[character].occurrences;
        if (occurrences > mostOccurrences) {
            mostRecurringCharacter = character;
            mostOccurrences = occurrences;
        }
    }

    return mostRecurringCharacter;
}

function calculateCharacterPresence(narrative, characterData, mostRecurringCharacter) {
    if (narrative.length === 0 || !characterData || Object.keys(characterData).length === 0) {
        return 0; // Return 0 presence if no narrative data or character data is available
    }

    if (!mostRecurringCharacter) {
        return 0; // Return 0 presence if no recurring character is found
    }

    const charPresence = {
        mainCharacter: 0,
        sideCharacters: 0
    };

    // Calculate the main character presence (percentage of events involving the most recurring character)
    const eventsWithMainCharacter = narrative.filter(event =>
        event.who && Array.isArray(event.who) &&
        event.who.some(character => character.entity === mostRecurringCharacter)
    );

    // Calculate the side characters presence
    const eventsWithSideCharacters = narrative.filter(event =>
        event.who && Array.isArray(event.who) &&
        !event.who.every(character => character.entity === mostRecurringCharacter)
    );

    charPresence.mainCharacter = (eventsWithMainCharacter.length / narrative.length).toFixed(2);
    charPresence.sideCharacters = (eventsWithSideCharacters.length / narrative.length).toFixed(2);

    return charPresence;
}

function calculateMainCharacterRelevance(characterData) {
    // Convert characterData into an array of character objects
    const characterArray = Object.values(characterData);

    // Sort characters by the number of occurrences (in descending order)
    characterArray.sort((a, b) => b.occurrences - a.occurrences);

    // Check if there are at least two characters
    if (characterArray.length >= 2) {
        // Calculate the difference in presence between the top two characters
        const mainCharacterRelevance = characterArray[0].occurrences - characterArray[1].occurrences;

        return mainCharacterRelevance;
    } else {
        // If there are fewer than two characters, the relevance is undefined
        return 0;
    }
}

function calculateMeanCharacterPersistence(narrative, characterData) {
    // Create a map to store the persistence of each character
    const characterPersistence = {};

    // Initialize character persistence for each character
    for (const entity in characterData) {
        characterPersistence[entity] = {
            label: characterData[entity].label,
            persistence: 0, // Initialize to zero
        };
    }

    // Initialize variables to keep track of consecutive events
    let currentCharacter = null;
    let consecutiveCount = 0;

    // Iterate through the narrative events
    for (const event of narrative) {
        const charactersInEvent = event.who || [];

        if (charactersInEvent.length > 0) {
            for (const character of charactersInEvent) {
                const entity = character.entity;

                // Check if the character is in the characterData
                if (characterPersistence.hasOwnProperty(entity)) {
                    // If the character is the same as the previous event, increment the consecutive count
                    if (entity === currentCharacter) {
                        consecutiveCount++;
                    } else {
                        // If it's a different character, reset the consecutive count
                        currentCharacter = entity;
                        consecutiveCount = 1;
                    }

                    if (currentCharacter !== null) {
                        // Update the character's maximum persistence
                        characterPersistence[entity].persistence = Math.max(
                            characterPersistence[entity].persistence,
                            consecutiveCount
                        );
                    }
                }
            }
        } else {
            // If the event has no character information, reset the current character and persistence count
            currentCharacter = null;
            consecutiveCount = 0;
        }
    }

    // Calculate the mean character persistence
    let totalPersistence = 0;
    let characterCount = 0;
    for (const entity in characterPersistence) {
        const persistence = characterPersistence[entity].persistence;
        if (persistence > 0) {
            totalPersistence += persistence;
            characterCount++;
        }
    }

    const meanPersistence = characterCount > 0 ? totalPersistence / characterCount : 0;

    return meanPersistence.toFixed(2);
}

function extractLocationData(narrative) {
    const locationData = {
        uniqueLocations: [], // Array to store unique locations
        locationPersistence: {}, // Object to store location persistence counts
        locationOccurrences: {}, // Array to store location occurrence counts
        mostRecurringLocation: null,
    };

    let currentLocation = null;
    let currentLocationPersistence = 0;

    // Iterate through the narrative data to extract location information
    for (const event of narrative) {
        const eventLocations = event.where || [];

        // Check if the event has location information
        if (eventLocations.length > 0) {
            // Assuming an event can have multiple locations, loop through each location in the event
            for (const locationObj of eventLocations) {
                const location = locationObj.entity;

                // Check if the location is not already in the uniqueLocations array
                if (!locationData.uniqueLocations.includes(location)) {
                    locationData.uniqueLocations.push(location);
                }

                // Check if the location is the same as the previous event's location
                if (location === currentLocation) {
                    currentLocationPersistence++;
                } else {
                    // Update location persistence count for the previous location
                    if (currentLocation !== null) {
                        locationData.locationPersistence[currentLocation] = currentLocationPersistence;
                    }

                    // Reset location and persistence count for the current event's location
                    currentLocation = location;
                    currentLocationPersistence = 1;
                }

                // Update location occurrence data
                if (!locationData.locationOccurrences[location]) {
                    locationData.locationOccurrences[location] = 1;
                } else {
                    locationData.locationOccurrences[location]++;
                }

                // Check if this location is the most recurring so far
                if (!locationData.mostRecurringLocation || locationData.locationOccurrences[location] > locationData.locationOccurrences[locationData.mostRecurringLocation]) {
                    locationData.mostRecurringLocation = location;
                }
            }
        } else {
            // If the event has no location information, reset the current location and persistence count
            currentLocation = null;
            currentLocationPersistence = 0;
        }
    }

    // Update location persistence for the last location encountered in the narrative
    if (currentLocation !== null) {
        locationData.locationPersistence[currentLocation] = currentLocationPersistence;
    }

    return locationData;
}

function calculateMeanLocationPersistence(locationData) {
    // Check if there are no locations or location persistence data
    if (!locationData.locationPersistence || Object.keys(locationData.locationPersistence).length === 0) {
        return 0; // Return 0 if there are no location persistence data
    }

    // Calculate the sum of location persistence values
    const sumLocationPersistence = Object.values(locationData.locationPersistence).reduce(
        (sum, persistence) => sum + persistence,
        0
    );

    // Calculate the mean location persistence
    const meanLocationPersistence = sumLocationPersistence / Object.keys(locationData.locationPersistence).length;

    return meanLocationPersistence.toFixed(2);
}

function calculateNarrativeDuration(narrativeStartTime, narrativeEndTime) {
    if (narrativeStartTime === "" || narrativeEndTime === "") {
        return 0;
    }
    const date1 = new Date(narrativeStartTime);
    const date2 = new Date(narrativeEndTime);
    const diffTime = Math.abs(date2 - date1);

    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateTimeIntervalStandardDeviation(narrative) {
    // Extract and sort the event times
    const eventTimes = narrative.map(event => new Date(event.when)).filter(date => !isNaN(date));
    eventTimes.sort((a, b) => a - b);

    console.log(eventTimes);

    // Calculate time intervals between consecutive events
    const timeIntervals = [];
    for (let i = 1; i < eventTimes.length; i++) {
        const interval = eventTimes[i] - eventTimes[i - 1];
        timeIntervals.push(interval);
    }

    console.log(timeIntervals);

    // Calculate the mean (average) time interval
    const meanInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;

    // Calculate the squared differences from the mean
    const squaredDifferences = timeIntervals.map(interval => Math.pow(interval - meanInterval, 2));

    // Calculate the variance (average of squared differences)
    const variance = squaredDifferences.reduce((sum, squaredDiff) => sum + squaredDiff, 0) / timeIntervals.length;

    // Calculate the standard deviation (square root of variance)
    const standardDeviation = Math.sqrt(variance);

    console.log(standardDeviation);

    // Convert from milliseconds to hours
    return (standardDeviation / 3600000.0).toFixed(2);
}
