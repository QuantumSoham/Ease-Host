const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const fetch = require('node-fetch'); // npm install node-fetch@2
const simpleGit = require('simple-git'); // npm install simple-git
const fsExtra = require('fs-extra'); // npm install fs-extra
require('dotenv').config();

// Helper to recursively list files and folders
function getFileTree(dir, prefix = '') {
    let tree = '';
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.lstatSync(fullPath).isDirectory()) {
            tree += `${prefix}${item}/\n`;
            tree += getFileTree(fullPath, prefix + '  ');
        } else {
            tree += `${prefix}${item}\n`;
        }
    }
    return tree;
}

// Collect key file contents
function collectKeyFiles(dir) {
    const keyFiles = ['README.md', 'Makefile', 'Dockerfile', 'package.json', 'requirements.txt', 'pyproject.toml', 'pom.xml', 'CMakeLists.txt'];
    let context = '';
    for (const file of keyFiles) {
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
            context += `--- ${file} ---\n${fs.readFileSync(filePath, 'utf-8')}\n\n`;
        }
    }
    return context;
}

// AI prompt and call (Groq API)
async function getAIBuildInstructions(projectTree, keyFilesContext) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set in environment variables.');
    const prompt = `\nYou are an expert in software project automation.\nGiven the following file/folder structure and key files, determine:\n1. The project type (Node, Python, Java, etc.)\n2. The correct shell commands to install dependencies and build the project.\n3. The directory where the build artifacts will be located.\n4. The shell command to move/copy the build artifacts to a folder named 'build-output' in the project root.\n\nRespond ONLY with a JSON object:\n{\n  "project_type": "...",\n  "build_commands": ["..."],\n  "build_output_dir": "...",\n  "move_command": "..."\n}\n\n--- FILE TREE ---\n${projectTree}\n\n--- KEY FILES ---\n${keyFilesContext}\n`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama3-70b-8192',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 512,
            temperature: 0.2
        })
    });

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    let result;
    try {
        result = JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            result = JSON.parse(match[0]);
        } else {
            throw new Error('Could not parse AI response: ' + text);
        }
    }
    return result;
}

// Main
(async () => {
    const repoUrl = process.argv[2];
    if (!repoUrl) {
        console.error('Usage: node ai-build-groq.js <github-repo-url>');
        process.exit(1);
    }

    const repoName = repoUrl.split('/').pop().replace(/\.git$/, '');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
    const repoPath = path.join(tempDir, repoName);
    console.log('Cloning repo to', repoPath);
    await simpleGit().clone(repoUrl, repoPath);

    const projectTree = getFileTree(repoPath);
    const keyFilesContext = collectKeyFiles(repoPath);
    const aiResult = await getAIBuildInstructions(projectTree, keyFilesContext);
    console.log('AI result:', aiResult);

    // Build commands
    for (let cmd of aiResult.build_commands) {
        console.log('Running:', cmd);
        execSync(cmd, { cwd: repoPath, stdio: 'inherit', shell: true });
    }

    // Move/copy build artifacts to ./build-outputs/<repo-name>
    const outputDir = path.join(__dirname, 'build-outputs', repoName);
    console.log('Moving build artifacts...');

    const sourceDir = path.join(repoPath, aiResult.build_output_dir);
    fsExtra.ensureDirSync(outputDir);
    fsExtra.copySync(sourceDir, outputDir);

    console.log('Artifacts moved to', outputDir);

    // Optional cleanup
    // fs.rmSync(tempDir, { recursive: true, force: true });
})();
