#!/usr/bin/env python3
"""
OBJ Face Filter Script

This script removes faces from an OBJ file that are fully defined by vertices
within a specified list. A face is removed only if ALL of its vertices are
in the provided vertex index list.

Usage:
    python filter_obj_faces.py

The script will process data/mediapipe478.obj and create a filtered version.
"""

def remove_faces_by_vertex_indices(obj_file_path, vertex_indices_to_remove, output_file_path=None):
    """
    Remove faces that are fully defined by vertices within the given list.
    
    Args:
        obj_file_path (str): Path to the input OBJ file
        vertex_indices_to_remove (list): List of vertex indices (1-based) to consider for removal
        output_file_path (str): Path for the output file (if None, overwrites input file)
    
    Returns:
        tuple: (vertices_kept, faces_kept, faces_removed)
    """
    if output_file_path is None:
        output_file_path = obj_file_path
    
    vertices = []
    faces = []
    faces_removed = 0
    
    # Convert to set for faster lookup
    vertex_indices_to_remove = set(vertex_indices_to_remove)
    
    with open(obj_file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('v '):
                vertices.append(line)
            elif line.startswith('f '):
                # Parse face definition
                parts = line.split()
                if len(parts) >= 4:  # At least 3 vertices
                    face_vertices = []
                    for part in parts[1:]:  # Skip 'f'
                        # Extract vertex index (before the first '/')
                        vertex_part = part.split('/')[0]
                        try:
                            vertex_index = int(vertex_part)
                            face_vertices.append(vertex_index - 1)
                        except ValueError:
                            # Skip malformed lines
                            continue
                    
                    # Check if ALL vertices in this face are in the removal list
                    if all(v in vertex_indices_to_remove for v in face_vertices):
                        faces_removed += 1
                        continue  # Skip this face
                    
                    faces.append(line)
    
    # Write the filtered OBJ file
    with open(output_file_path, 'w') as f:
        for vertex in vertices:
            f.write(vertex + '\n')
        for face in faces:
            f.write(face + '\n')
    
    return len(vertices), len(faces), faces_removed

def main():
    """Main function to process the OBJ file."""
    
    # Your vertex indices
    mouth_indices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 95, 88, 178, 87, 14, 317, 402, 318, 324]
    right_eye_indices = [246, 161, 160, 159, 158, 157, 173, 33, 7, 163, 144, 145, 153, 154, 155, 133]
    left_eye_indices = [466, 388, 387, 386, 385, 384, 398, 263, 249, 390, 373, 374, 380, 381, 382, 362]

    vertex_indices = mouth_indices + right_eye_indices + left_eye_indices

    # File paths
    input_file = '../data/mediapipe478_noclip.obj'
    output_file = '../data/mediapipe478.obj'
    
    print("OBJ Face Filter Script")
    print("=" * 50)
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print(f"Vertex indices to check: {vertex_indices}")
    print()
    
    try:
        # Process the file
        print("Processing OBJ file...")
        vertices_kept, faces_kept, faces_removed = remove_faces_by_vertex_indices(
            input_file, 
            vertex_indices, 
            output_file
        )
        
        print("\nResults:")
        print(f"Vertices in file: {vertices_kept}")
        print(f"Faces kept: {faces_kept}")
        print(f"Faces removed: {faces_removed}")
        print(f"Output saved to: {output_file}")
        
        if faces_removed > 0:
            print(f"\nSuccessfully removed {faces_removed} faces that were fully defined by the specified vertices.")
        else:
            print("\nNo faces were removed. No faces were found where all vertices are in the specified list.")
            
    except FileNotFoundError:
        print(f"Error: Could not find input file '{input_file}'")
        print("Make sure the file exists in the data/ directory.")
    except Exception as e:
        print(f"Error processing file: {e}")

if __name__ == "__main__":
    main() 