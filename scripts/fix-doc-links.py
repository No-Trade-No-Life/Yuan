#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import re


def load_rush_projects(rush_json_path):
    """Load project information from rush.json"""
    with open(rush_json_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove comments from JSON content
    # This is a simple implementation that removes // and /* */ style comments
    # It may not handle all edge cases but should work for rush.json
    content = remove_comments(content)
    
    # Parse JSON
    rush_data = json.loads(content)
    
    # Create a mapping from package name to project folder path
    package_mapping = {}
    for project in rush_data.get('projects', []):
        package_name = project.get('packageName')
        project_folder = project.get('projectFolder')
        if package_name and project_folder:
            # Convert package name to filename format:
            # @yuants/data-series -> @yuants-data-series
            # Keep @ symbol and replace / with -
            filename = package_name.replace('/', '-')
            package_mapping[package_name] = filename
    
    return package_mapping


def remove_comments(json_string):
    """Remove comments from a JSON string"""
    # Remove single line comments (// ...)
    lines = json_string.split('\n')
    new_lines = []
    for line in lines:
        # Find // that is not inside a string
        in_string = False
        escape_next = False
        for i, char in enumerate(line):
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue
            if char == '"' or char == "'":
                in_string = not in_string
            if char == '/' and not in_string and i + 1 < len(line) and line[i+1] == '/':
                line = line[:i]
                break
        new_lines.append(line)
    
    # Join lines and remove multi-line comments (/* ... */)
    content = '\n'.join(new_lines)
    
    # Simple approach for /* */ comments - may not handle all edge cases
    import re
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    return content


def find_markdown_files(docs_dir):
    """Find all markdown files in the docs directory recursively"""
    markdown_files = []
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.md'):
                markdown_files.append(os.path.join(root, file))
    return markdown_files


def fix_links_in_file(file_path, package_mapping):
    """Fix links in a markdown file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match [@yuants/package-name](path) or [@yuants/package-name](path) format
        # This pattern captures the package name and the path
        pattern = r'\[(@?yuants/[^@\[\]\(\)]+)\]\([^)]*\)'
        
        def replace_link(match):
            package_name = match.group(1)
            # Add @ prefix if it's missing
            if not package_name.startswith('@'):
                package_name = '@' + package_name
            if package_name in package_mapping:
                new_filename = package_mapping[package_name]
                return f'[{package_name}](./packages/{new_filename}.md)'
            else:
                # If package not found in mapping, return original
                return match.group(0)
        
        # Replace all occurrences
        new_content = re.sub(pattern, replace_link, content)
        
        # Also handle the case where the package name already has @
        pattern_with_at = r'\[@(yuants/[^@\[\]\(\)]+)\]\([^)]*\)'
        def replace_link_with_at(match):
            package_name = '@' + match.group(1)
            if package_name in package_mapping:
                new_filename = package_mapping[package_name]
                return f'[{package_name}](./packages/{new_filename}.md)'
            else:
                # If package not found in mapping, return original
                return match.group(0)
        
        # Apply both patterns
        new_content = re.sub(pattern_with_at, replace_link_with_at, new_content)
        
        # Only write if content has changed
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated links in {file_path}")
            return True
        else:
            print(f"No changes needed in {file_path}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False


def main():
    # Paths
    rush_json_path = '/root/Yuan/rush.json'
    docs_dir = '/root/Yuan/docs'
    
    # Load package mapping
    print("Loading package mapping from rush.json...")
    package_mapping = load_rush_projects(rush_json_path)
    print(f"Found {len(package_mapping)} packages")
    
    # Find all markdown files
    print("Finding markdown files...")
    markdown_files = find_markdown_files(docs_dir)
    print(f"Found {len(markdown_files)} markdown files")
    
    # Process each file
    updated_files = 0
    for file_path in markdown_files:
        if fix_links_in_file(file_path, package_mapping):
            updated_files += 1
    
    print(f"\nFinished processing. Updated {updated_files} files.")


if __name__ == '__main__':
    main()