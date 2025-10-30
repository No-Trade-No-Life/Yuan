#!/usr/bin/env python3
"""
Script to sync package documentation from project directories to docs directories.
"""

import json
import os
import shutil
import re
from pathlib import Path


def load_rush_json(file_path):
    """Load rush.json file, skipping comments."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Remove multiline comments (/* ... */) - be careful not to remove newlines
    # We replace the comment block with a single space to preserve structure
    content = re.sub(r'/\*.*?\*/', ' ', content, flags=re.DOTALL)
    
    # Remove single-line comments (// ...)
    # Only remove if // is not inside a string
    lines = content.split('\n')
    processed_lines = []
    for line in lines:
        # Check if the // is inside a string by counting quotes
        parts = line.split('//')
        if len(parts) > 1:
            before_comment = parts[0]
            quote_count = before_comment.count('"')
            if quote_count % 2 == 0:  # Even number of quotes means // is not in a string
                line = before_comment.rstrip()
        processed_lines.append(line)
    
    content = '\n'.join(processed_lines)
    
    # Parse JSON
    return json.loads(content)

def main():
    # Define paths
    project_root = Path("/root/Yuan")
    rush_json_path = project_root / "rush.json"
    docs_en_packages = project_root / "docs" / "en" / "packages"
    docs_zh_packages = project_root / "docs" / "zh-Hans" / "packages"
    
    # Ensure target directories exist
    docs_en_packages.mkdir(parents=True, exist_ok=True)
    docs_zh_packages.mkdir(parents=True, exist_ok=True)
    
    # Read rush.json
    rush_config = load_rush_json(rush_json_path)
    
    # Process each project
    for project in rush_config.get("projects", []):
        package_name = project["packageName"]
        project_folder = project["projectFolder"]
        project_path = project_root / project_folder
        
        # Check if README.md exists in project directory
        readme_path = project_path / "README.md"
        if readme_path.exists():
            # Read the original README content
            with open(readme_path, "r", encoding="utf-8") as f:
                original_content = f.read()
            
            # Add package name as title only if the file doesn't already start with a title
            if original_content.strip().startswith("# "):
                new_content = original_content
            else:
                new_content = f"# {package_name}\n\n{original_content}"
            
            # Copy to English docs directory
            target_en_path = docs_en_packages / f"{package_name.replace('/', '-')}.md"
            with open(target_en_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            
            # Copy to Chinese docs directory
            target_zh_path = docs_zh_packages / f"{package_name.replace('/', '-')}.md"
            with open(target_zh_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            
            print(f"Copied README.md for {package_name}")
        else:
            print(f"No README.md found for {package_name}")


if __name__ == "__main__":
    main()