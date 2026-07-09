const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:/Users/Aswin J/.gemini/antigravity-ide/brain/149e36db-958b-401c-bfff-5b1f0cf24698/.system_generated/logs/transcript_full.jsonl';
const basePath = 'C:/Users/Aswin J/Videos/CIR/frontend';

const targetFiles = [
    'src/app/(dashboard)/staff/page.tsx',
    'src/app/(dashboard)/staff/analytics/page.tsx',
    'src/app/(dashboard)/manager/page.tsx',
    'src/app/(dashboard)/manager/analytics/page.tsx',
    'src/app/(dashboard)/manager/staff/[staffId]/page.tsx',
    'src/app/(dashboard)/admin/page.tsx',
    'src/app/(dashboard)/admin/analytics/page.tsx',
    'src/app/(dashboard)/admin/departments/subdepartments/staff/[staffId]/page.tsx'
].map(f => path.resolve(basePath, f).toLowerCase());

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
const patches = [];

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
            for (const tc of step.tool_calls) {
                if (tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
                    let args = tc.args;
                    let targetFile = args.TargetFile;
                    if (targetFile) {
                        // Unescape escaped quotes if args were passed as string
                        if (typeof targetFile === 'string' && targetFile.startsWith('"')) {
                            targetFile = JSON.parse(targetFile);
                        }
                    }
                    if (!targetFile) continue;
                    
                    if (targetFiles.includes(targetFile.toLowerCase())) {
                        patches.push(args);
                    }
                }
            }
        }
    } catch (e) {}
}

console.log('Found ' + patches.length + ' patches for the target files.');
fs.writeFileSync('patches.json', JSON.stringify(patches, null, 2));
