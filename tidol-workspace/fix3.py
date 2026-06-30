import sys
import re

def process():
    path = "tidol-core/src/main.rs"
    with open(path, "r") as f:
        content = f.read()

    # 1. Remove DynamicAIProvider struct and impls
    # The regex was too specific. We can just replace the whole block by lines.
    lines = content.splitlines()
    
    # We will build a new list of lines
    new_lines = []
    skip = False
    for line in lines:
        if "struct DynamicAIProvider {" in line:
            skip = True
        elif "impl DynamicAIProvider {" in line:
            skip = True
        elif "impl Drop for DynamicAIProvider {" in line:
            skip = True
        
        if not skip:
            new_lines.append(line)
            
        if skip and line.startswith("}"):
            # We need to make sure we only stop skipping when the top-level block ends.
            # actually this is tricky to do line by line.
            pass
            
    # Let's use regex again but be robust
    content = re.sub(r'struct DynamicAIProvider \{.*?\n\}\n', '', content, flags=re.DOTALL)
    content = re.sub(r'impl DynamicAIProvider \{.*?\n\}\n', '', content, flags=re.DOTALL)
    content = re.sub(r'impl Drop for DynamicAIProvider \{.*?\n\}\n', '', content, flags=re.DOTALL)
    
    # Let's remove from AppState
    content = re.sub(r'\s*ai_provider:\s*Arc<Option<DynamicAIProvider>>,\n', '\n', content)
    
    # ai_worker_loop signature
    content = re.sub(r'\s*ai_engine:\s*Arc<Option<DynamicAIProvider>>,\n', '\n', content)
    
    # initialization in main
    # from `let ai_provider = match DynamicAIProvider::new(ai_path) {`
    # up to `};`
    content = re.sub(r'let ai_provider = match DynamicAIProvider::new\(ai_path\).*?\n\s*};\n', '', content, flags=re.DOTALL)
    
    # AppState initialization in main
    content = re.sub(r'\s*ai_provider:\s*Arc::new\(ai_provider\),\n', '\n', content)
    
    # worker loop invocation in main
    content = re.sub(r'\s*let ai_for_worker = app_state\.ai_provider\.clone\(\);\n', '\n', content)
    
    # worker loop arguments
    # find `ai_for_worker,` in `ai_worker_loop(` invocation
    content = re.sub(r'\s*ai_for_worker,\n', '\n', content)
    
    with open(path, "w") as f:
        f.write(content)

if __name__ == "__main__":
    process()
