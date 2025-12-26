import re

#Read the file
with open(r'c:\Users\CATLO\Desktop\Tidol\tidol-ui\src\context\PlayerContext.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Read the new toggleVox
with open(r'c:\Users\CATLO\Desktop\Tidol\.temp_toggleVox.js', 'r', encoding='utf-8') as f:
    new_toggleVox = f.read()

# Pattern to find the old toggleVox function
# Matches from "const toggleVox = useCallback" to the end of the callback with its dependencies
pattern = r'(  const toggleVox = useCallback\(async \(\) => \{[\s\S]*?\}, \[currentSong, voxMode, voxTracks, spectraData\]\);)'

# Replace with new implementation
content = re.sub(pattern, new_toggleVox, content)

# Write back
with open(r'c:\Users\CATLO\Desktop\Tidol\tidol-ui\src\context\PlayerContext.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully!")
