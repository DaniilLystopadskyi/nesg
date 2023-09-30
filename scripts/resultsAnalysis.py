import pandas as pd
import numpy as np

dataset_dir = "public/data/datasets/"

# Load the data
narratives_data = pd.read_csv(dataset_dir+'narratives.csv', sep='\t')
events_data = pd.read_csv(dataset_dir+'events.csv', sep='\t')
baseline_data = pd.read_csv(dataset_dir+'baseline.csv', sep='\t')

# Filter out rows with reference topics
topics_to_exclude = ["Barack Obama", "Vienna", "World War II", "Cubism"]

columns_to_ignore = ['graph_name', 'topic', 'size', 'centrality_degree', 'similarity_threshold']

# Define the columns for which we want to calculate statistics
narr_columns_to_analyze = [col for col in narratives_data.columns if col not in columns_to_ignore]
event_columns_to_analyze = [col for col in events_data.columns if col not in columns_to_ignore]

#narratives_data = narratives_data[~narratives_data['topic'].isin(topics_to_exclude)]
#events_data = events_data[~events_data['topic'].isin(topics_to_exclude)]
#baseline_data = baseline_data[~baseline_data['topic'].isin(topics_to_exclude)]

# Replace NaN values with zeros
narratives_data = narratives_data.fillna(0)
events_data = events_data.fillna(0)
baseline_data = baseline_data.fillna(0)

def getNarrTable(dataset):
    # Group the data by depth, topic type, and graph, and calculate mean values
    summary_table = dataset.drop(columns_to_ignore, axis=1).groupby(['depth', 'topic_type']).mean().reset_index()
    summary_table['narr_duration'] = summary_table['narr_duration'] * 0.000114
    summary_table['time_sd'] = summary_table['time_sd'] * 0.000114
    summary_table = summary_table.round(2)

    # Rename the columns for clarity
    summary_table.rename(columns={
        'depth': 'Depth',
        'topic_type': 'Topic Type',
        'num_events': 'NUM-E',
        'num_events_who': 'NUM-WHO',
        'num_events_where': 'NUM-WHERE',
        'num_events_why': 'NUM-WHY',
        'num_events_how': 'NUM-HOW',
        'num_events_related': 'NUM-RELATED',
        'event_completeness': 'E-COMP',
        'num_complete_events': 'M-COMP',
        'num_no_opt_events': 'NO-OPT',
        'avg_what_word_count': 'WHAT-WC',
        'num_event_chains': 'NUM-EC',
        'longest_event_chain': 'LONG-EC',
        'smallest_event_chain': 'SHORT-EC',
        'avg_event_chain_length': 'AVG-EC',
        'num_unique_events': 'NUM-UE',
        'event_min_occur': 'E-MINO',
        'event_max_occur': 'E-MAXO',
        'avg_occur': 'AVG-OCR',
        'avg_num_chars': 'AVG-NUMC',
        'avg_num_locs': 'AVG-NUML',
        'avg_num_rel': 'AVG-NUMR',
        'num_unique_chars': 'NUM-UC',
        'main_char_pres': 'MC-PRES',
        'side_char_pres': 'SC-PRES',
        'main_char_rel': 'MC-REL',
        'avg_char_pers': 'CHAR-PERS',
        'num_unique_locs': 'NUM-UL',
        'avg_loc_pers': 'LOC-PERS',
        'narr_duration': 'NARR-DURR',
        'time_sd': 'TIME-STD',
        'num_event_ent': 'NUM-EE',
        'num_event_prop': 'NUM-EP',
        'extr_duration': 'EXTR-DUR',
        'score': 'SCORE'
    }, inplace=True)

    return summary_table.transpose()

def getEventTable():
    # Group the data by depth, topic type, and graph, and calculate mean values
    summary_table = events_data.drop(columns_to_ignore, axis=1).groupby(['depth', 'topic_type']).mean().reset_index()
    summary_table = summary_table.round(2)

    # Rename the columns for clarity
    summary_table.rename(columns={
        'depth': 'Depth',
        'topic_type': 'Topic Type',
        'num_chars': 'Mean Number of Characters',
        'num_locs': 'Mean Number of Locations',
        'num_rel_events': 'Mean Number of Relevant Events',
        'has_why': 'Mean "Has Why" Attribute',
        'has_how': 'Mean "Has How" Attribute',
        'what_word_count': 'Mean What Word Count',
        'temp_dist_start': 'Mean Temporal Distance from Start',
        'temp_dist_end': 'Mean Temporal Distance from End',
        'temp_dist_prev': 'Mean Temporal Distance from Previous Event',
        'temp_dist_next': 'Mean Temporal Distance from Next Event',
        'is_ent_event': 'Mean Entity Event',
        'mean_char_pres': 'Mean Mean Character Presence',
        'mean_loc_pres': 'Mean Mean Location Presence',
        'num_unique_roles': 'Mean Number of Unique Roles',
        'num_unique_settings': 'Mean Number of Unique Settings',
        'num_unique_relations': 'Mean Number of Unique Relations',
        'num_rel_narr_events': 'Mean Number of Relevant Narrative Events',
        'role_dens': 'Mean Role Density',
        'setting_dens': 'Mean Setting Density',
        'relation_dens': 'Mean Relation Density',
        'same_narr_dens': 'Mean Same Narrative Density',
        'num_corr_attr': 'Mean Number of Correct Attributes',
        'relevant': 'Mean Relevance'
    }, inplace=True)

    return summary_table.transpose()

print("******************************** WIKDIATA NARRATIVES ********************************")
print(getNarrTable(narratives_data[narratives_data['graph_name'] == "Wikidata"]))

print("******************************** DBPEDIA NARRATIVES ********************************")
print(getNarrTable(narratives_data[narratives_data['graph_name'] == "DBpedia"]))

print("******************************** BASELINE NARRATIVES ********************************")
print(getNarrTable(baseline_data))

print("******************************** EVENTS ********************************")
print(getEventTable())