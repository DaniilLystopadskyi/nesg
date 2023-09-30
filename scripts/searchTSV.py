import sys
import pandas as pd

file_path = 'public/data/benchmark.tsv'

# Extract the provided entity_label from command line arguments
provided_entity_label = sys.argv[1]

# Read the TSV file into a pandas DataFrame
df = pd.read_csv(file_path, delimiter='\t')  # Assuming tab-separated values

# Filter rows where entity_label matches the provided value and bio_score and wiki_score are both 1
matching_rows = df[(df['entity_label'].str.contains(provided_entity_label, case=False))]

# Convert the matching rows to a JSON array
matching_rows_json = matching_rows.to_json(orient='records')

# Print the JSON array to stdout
print(matching_rows_json)