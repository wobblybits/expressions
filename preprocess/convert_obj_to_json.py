import json
import re

def parse_obj_file(file_path):
    vertices = []
    indices = []
    
    with open(file_path, 'r') as file:
        for line in file:
            line = line.strip()
            if line.startswith('v '):
                # Parse vertex line: v x y z
                parts = line.split()
                if len(parts) == 4:
                    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                    vertices.extend([x, y, z])
            elif line.startswith('f '):
                # Parse face line: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
                parts = line.split()
                if len(parts) == 4:  # Triangle face
                    for i in range(1, 4):
                        # Extract vertex index (first number before slash)
                        vertex_part = parts[i]
                        if '/' in vertex_part:
                            vertex_index = int(vertex_part.split('/')[0])
                        else:
                            vertex_index = int(vertex_part)
                        # OBJ indices are 1-based, convert to 0-based
                        indices.append(vertex_index - 1)
    
    return {
        "vertices": vertices,
        "indices": indices
    }

# Parse the OBJ file
obj_data = parse_obj_file('../data/mediapipe478_clip.obj')

# Write to JSON file
with open('../data/mediapipe478.json', 'w') as json_file:
    json.dump(obj_data, json_file, indent=2)

print(f"Converted {len(obj_data['vertices']) // 3} vertices and {len(obj_data['indices'])} indices") 