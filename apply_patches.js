const fs = require('fs');

const patches = JSON.parse(fs.readFileSync('patches.json', 'utf8'));

let failures = 0;
let successes = 0;

for (const args of patches) {
    let targetFile = args.TargetFile;
    if (typeof targetFile === 'string' && targetFile.startsWith('"')) {
        targetFile = JSON.parse(targetFile);
    }
    
    if (!fs.existsSync(targetFile)) {
        console.log("File not found: " + targetFile);
        continue;
    }
    
    let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');
    
    let chunksRaw = args.ReplacementChunks || [args];
    if (typeof chunksRaw === 'string') {
        try {
            chunksRaw = JSON.parse(chunksRaw);
        } catch(e) {
            console.log("Failed to parse chunks for " + targetFile);
            continue;
        }
    }
    
    let chunkFailures = 0;
    
    for (const chunk of chunksRaw) {
        let targetContent = chunk.TargetContent;
        if (typeof targetContent === 'string' && targetContent.startsWith('"') && targetContent.endsWith('"') && targetContent.includes('\\n')) {
             targetContent = JSON.parse(targetContent);
        }
        targetContent = targetContent.replace(/\r\n/g, '\n');
        
        let replacementContent = chunk.ReplacementContent;
        if (typeof replacementContent === 'string' && replacementContent.startsWith('"') && replacementContent.endsWith('"') && replacementContent.includes('\\n')) {
             replacementContent = JSON.parse(replacementContent);
        }
        replacementContent = replacementContent.replace(/\r\n/g, '\n');
        
        if (content.includes(targetContent)) {
            const split = content.split(targetContent);
            if (!chunk.AllowMultiple && split.length > 2) {
                console.log("Multiple matches found for chunk in " + targetFile + " but AllowMultiple is false");
                chunkFailures++;
            } else {
                content = content.split(targetContent).join(replacementContent);
            }
        } else {
            console.log("Target content not found in " + targetFile + " for chunk starting with: " + targetContent.substring(0, 50));
            chunkFailures++;
        }
    }
    
    if (chunkFailures === 0) {
        fs.writeFileSync(targetFile, content);
        successes++;
    } else {
        failures++;
    }
}

console.log(`Successfully applied ${successes} patches, ${failures} failed.`);
