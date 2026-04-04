import re
import json

def parse_languages(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract the TRANSLATIONS object content
    # This is a simplified parser for the specific structure of languages.js
    translations_match = re.search(r'export const TRANSLATIONS = \{(.*?)\};', content, re.DOTALL)
    if not translations_match:
        return None
    
    translations_text = translations_match.group(1)
    
    # Split by top-level language codes (e.g., EN: {, FR: {)
    langs = re.findall(r'(\w+): \{(.*?)\n    \},', translations_text + '\n    },', re.DOTALL)
    
    parsed_langs = {}
    for code, lang_body in langs:
        blocks = re.findall(r'(\w+): \{(.*?)\n        \}', lang_body, re.DOTALL)
        parsed_langs[code] = {}
        for block_name, block_body in blocks:
            keys = re.findall(r'^\s{12}(\w+):', block_body, re.MULTILINE)
            parsed_langs[code][block_name] = set(keys)
            
    return parsed_langs

def compare():
    langs = parse_languages('src/constants/languages.js')
    if not langs:
        print("Failed to parse languages.js")
        return
    
    master_lang = 'EN'
    if master_lang not in langs:
        print("EN not found")
        return
        
    for code in langs:
        if code == master_lang:
            continue
            
        print(f"--- Comparing {code} to {master_lang} ---")
        for block_name in langs[master_lang]:
            if block_name not in langs[code]:
                print(f"  Missing block: {block_name}")
                continue
                
            missing_keys = langs[master_lang][block_name] - langs[code][block_name]
            if missing_keys:
                print(f"  Missing keys in {block_name}: {', '.join(missing_keys)}")
            
            extra_keys = langs[code][block_name] - langs[master_lang][block_name]
            if extra_keys:
                print(f"  Extra keys in {block_name}: {', '.join(extra_keys)}")

if __name__ == "__main__":
    compare()
