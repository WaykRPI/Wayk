import requests
import json
from datetime import datetime
import time
from typing import List, Dict, Any
from dataclasses import dataclass
import pandas as pd

@dataclass
class Node:
    id: int
    lat: float
    lon: float
    tags: Dict[str, str]
    type: str = "node"

class TroyMapDataFetcher:
    def __init__(self):
        self.overpass_url = "http://overpass-api.de/api/interpreter"
        self.area_name = "Troy, New York"
        
    def build_query(self, node_type: str = None) -> str:
        """
        Build Overpass QL query for Troy, NY.
        If node_type is specified, filter for those specific nodes.
        """
        # Base query to get area ID for Troy, NY
        base_query = """
        area["name"="Troy"]["place"="city"]["state"="New York"]->.troy;
        ("""
        
        # If node_type is specified, add it to the query
        if node_type:
            node_filter = f'node["{node_type}"](area.troy);'
        else:
            # Get all nodes with any tags
            node_filter = """
            node["amenity"](area.troy);
            node["shop"](area.troy);
            node["leisure"](area.troy);
            node["highway"="bus_stop"](area.troy);
            node["historic"](area.troy);
            node["tourism"](area.troy);
            """
        
        # Complete the query
        query = f"""
        {base_query}
        {node_filter}
        );
        out body;
        >;
        out skel qt;
        """
        return query

    def fetch_nodes(self, node_type: str = None) -> List[Node]:
        """Fetch nodes from Overpass API."""
        query = self.build_query(node_type)
        
        try:
            response = requests.post(self.overpass_url, data={"data": query})
            response.raise_for_status()
            data = response.json()
            
            nodes = []
            for element in data.get("elements", []):
                if element.get("type") == "node":
                    nodes.append(Node(
                        id=element.get("id"),
                        lat=element.get("lat"),
                        lon=element.get("lon"),
                        tags=element.get("tags", {})
                    ))
            
            return nodes
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}")
            return []

    def save_to_json(self, nodes: List[Node], filename: str = "troy_nodes.json"):
        """Save nodes to JSON file."""
        data = [{
            "id": node.id,
            "lat": node.lat,
            "lon": node.lon,
            "tags": node.tags,
            "type": node.type
        } for node in nodes]
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
            
    def save_to_csv(self, nodes: List[Node], filename: str = "troy_nodes.csv"):
        """Save nodes to CSV file."""
        # Flatten the tags dictionary into columns
        rows = []
        for node in nodes:
            row = {
                "id": node.id,
                "lat": node.lat,
                "lon": node.lon
            }
            row.update(node.tags)
            rows.append(row)
            
        df = pd.DataFrame(rows)
        df.to_csv(filename, index=False)

    def analyze_nodes(self, nodes: List[Node]) -> Dict[str, int]:
        """Analyze the types of nodes found."""
        node_types = {}
        for node in nodes:
            for tag_key in node.tags.keys():
                node_types[tag_key] = node_types.get(tag_key, 0) + 1
        return dict(sorted(node_types.items(), key=lambda x: x[1], reverse=True))

def main():
    fetcher = TroyMapDataFetcher()
    
    print(f"Fetching nodes in Troy, NY...")
    nodes = fetcher.fetch_nodes()
    
    print(f"\nFound {len(nodes)} nodes")
    
    # Save data
    fetcher.save_to_json(nodes)
    fetcher.save_to_csv(nodes)
    print("\nSaved data to troy_nodes.json and troy_nodes.csv")
    
    # Analyze node types
    node_types = fetcher.analyze_nodes(nodes)
    print("\nNode type distribution:")
    for tag_type, count in node_types.items():
        print(f"{tag_type}: {count} nodes")
    
    # Print sample nodes
    print("\nSample nodes:")
    for node in nodes[:5]:
        print(f"\nNode {node.id}:")
        print(f"Location: {node.lat}, {node.lon}")
        print("Tags:", node.tags)

if __name__ == "__main__":
    main()