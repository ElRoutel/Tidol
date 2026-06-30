import os

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if "println!(" not in content and "eprintln!(" not in content:
        return

    # Add tracing import if not present
    if "use tracing::" not in content:
        # insert after first line or after first use
        if "use " in content:
            content = content.replace("use ", "use tracing::{info, error, warn, debug};\nuse ", 1)
        else:
            content = "use tracing::{info, error, warn, debug};\n" + content

    # Replace specific prefixes to use warn or error
    content = content.replace('println!("[WARN]', 'warn!("[WARN]')
    content = content.replace('eprintln!("[WARN]', 'warn!("[WARN]')
    content = content.replace('println!("[ERROR]', 'error!("[ERROR]')
    content = content.replace('eprintln!("[ERROR]', 'error!("[ERROR]')
    content = content.replace('println!("❌', 'error!("❌')
    content = content.replace('eprintln!("❌', 'error!("❌')
    
    # Replace the rest
    content = content.replace('println!(', 'info!(')
    content = content.replace('eprintln!(', 'error!(')

    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.rs'):
            process_file(os.path.join(root, file))

print("Done replacing println! and eprintln!")
