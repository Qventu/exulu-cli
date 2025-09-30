#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const https = require('https');
const http = require('http');
const { gql, GraphQLClient } = require('graphql-request')

const tips = [
    "Install the **Claude Code extension** in your IDE so Claude Code can recognize your current open file, and selected code.",
    "In the **terminal UI**: you can @-tag files, use slash commands, and explicitly select the context to include.",
    "Run `/clear` frequently when switching tasks to trim history and reduce token usage overhead.",
    "Use **`claude --dangerously-skip-permissions`** (or similar config) to bypass repetitive permission prompts if you trust your project context.",
    "Customize your PR review prompt via `claude-code-review.yml` — e.g. tell Claude to *only* report bugs or security issues, and keep it concise.",
    "Set up **terminal mode properly** (e.g. `/terminal-setup`) so that Shift+Enter and input behavior work as expected.",
    "Remember: **Escape** stops the current run; pressing Escape twice shows a list of past messages you can navigate back to.",
    "Define and use **hooks** (e.g. PreToolUse, PostToolUse) and custom slash commands to integrate Claude into your dev workflow.",
    "Feed console/terminal errors, log traces, or screenshots directly into Claude rather than translating them yourself. It helps it debug more precisely.",
    "Favor **small diffs** over sprawling edits — it makes review easier and reduces risk of unintended changes.",
    "Prompt Claude to write tests first (TDD style) then implement code to satisfy those tests.",
    "Be specific in your prompt: mention exactly which files, modules, or functions to operate on. Vague prompts cause more back-and-forth."
]

class ExuluCLI {
    constructor() {
        this.claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    }

    async run() {
        console.log(chalk.blue.bold('🚀 Exulu CLI'));
        console.log(chalk.cyanBright(`
███████╗██╗  ██╗██╗   ██╗██╗      ██╗   ██╗
██╔════╝╚██╗██╔╝██║   ██║██║      ██║   ██║
█████╗   ╚███╔╝ ██║   ██║██║      ██║   ██║
██╔══╝   ██╔██╗ ██║   ██║██║      ██║   ██║
███████╗██╔╝ ██╗╚██████╔╝███████╗╚██████╔╝
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ 
Intelligence Management Platform \n\n`));
        console.log(chalk.bgCyan.black.bold(' 💡 PRO TIP OF THE DAY: '))
        console.log(chalk.cyan.bold(tips[Math.floor(Math.random() * tips.length)]) + '\n\n');


        // Validate or create settings.json
        const settings = await this.validateSettings();

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '> Start Claude Code', value: 'start-claude' },
                    { name: '> Setup Agent OS', value: 'setup-agent-os' },
                    { name: '> List agents', value: 'list-agents' },
                    { name: '> List contexts', value: 'list-contexts' },
                    { name: '> Change settings', value: 'change-settings' },
                ]
            }
        ]);

        switch (action) {
            case 'start-claude':
                await this.startClaude();
                break;
            case 'setup-agent-os':
                await this.setupAgentOS();
                break;
            case 'list-agents':
                await this.listAgents({
                    backend: settings.backend,
                    token: settings.token
                });
                break;
            case 'list-contexts':
                await this.listContexts({
                    backend: settings.backend,
                    token: settings.token
                });
                break;
            case 'change-settings':
                await this.changeSettings();
                break;
        }
    }

    async startClaude() {
        console.log(chalk.yellow('Starting Claude Code setup...\n'));

        await this.selectClaudeCodeIMPAgent();

        // Check if Claude Code is installed
        if (!this.isClaudeInstalled()) {
            console.log(chalk.red('Claude Code not found. Installing...'));
            await this.installClaude();
        }

        // Start Claude Code
        console.log(chalk.green('✅ Setup complete! Starting Claude Code...\n'));
        this.launchClaude();
    }

    isClaudeInstalled() {
        try {
            execSync('claude --version', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    async installClaude() {
        try {
            console.log(chalk.blue('Installing @anthropic-ai/claude-code...'));
            execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' });
            console.log(chalk.green('✅ Claude Code installed successfully\n'));
        } catch (error) {
            console.error(chalk.red('❌ Failed to install Claude Code:'), error.message);
            process.exit(1);
        }
    }

    async selectClaudeCodeIMPAgent() {
        const claudeDir = path.dirname(this.claudeSettingsPath);

        // Create .claude directory if it doesn't exist
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
        }

        let settings = {};

        // Load existing settings if they exist
        if (fs.existsSync(this.claudeSettingsPath)) {
            try {
                settings = JSON.parse(fs.readFileSync(this.claudeSettingsPath, 'utf8'));
            } catch (error) {
                console.log(chalk.red('❌  Invalid settings.json found, please restart the CLI\n'));
                process.exit(1);
            }
        }

        const token = settings.apiKeyHelper.replace('echo ', '').trim();
        const urlObj = new URL(settings.env.ANTHROPIC_BASE_URL);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

        const document = gql`
            {
                agentsPagination(page: 1, limit: 30, filters: {
                    category: {
                        eq: "coding"
                    }
                }) {
                    items {
                        id
                        name
                        description
                    }
                }
            }
        `
        const client = new GraphQLClient(`${baseUrl}/graphql`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const response = await client.request(document);

        console.log("response", response)

        const agents = await response.agentsPagination.items;

        console.log(chalk.blue('✅ Agents:'));
        console.table(agents.map(agent => ({
            id: agent.id?.slice(0, 8) + '...',
            name: agent.name,
            description: agent.description?.slice(0, 40) + '...',
        })));
        console.log(chalk.gray('Total agents: ' + agents.length));

        const { agent } = await inquirer.prompt([
            {
                type: 'list',
                name: 'agent',
                message: 'Select an agent:',
                choices: agents.map(agent => ({
                    name: agent.name,
                    value: agent.id
                }))
            }
        ]);

        settings.env.ANTHROPIC_BASE_URL = `${baseUrl}/gateway/anthropic/${agent}`;
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));

        console.log(chalk.green(`✅ Agent ${agent} selected\n`));
        return agent;
    }

    async validateSettings() {
        const claudeDir = path.dirname(this.claudeSettingsPath);

        // Create .claude directory if it doesn't exist
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
        }

        let settings = {};

        // Load existing settings if they exist
        if (fs.existsSync(this.claudeSettingsPath)) {
            try {
                settings = JSON.parse(fs.readFileSync(this.claudeSettingsPath, 'utf8'));
            } catch (error) {
                console.log(chalk.yellow('⚠️  Invalid settings.json found, creating new one...'));
                settings = {};
            }
        }

        // Validate API key
        if (
            !settings.env ||
            !settings.env.ANTHROPIC_BASE_URL ||
            !settings.apiKeyHelper ||
            settings.apiKeyHelper === 'echo PLACEHOLDER' ||
            settings.apiKeyHelper.trim() === ''
        ) {
            const { baseUrl } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'baseUrl',
                    message: 'Enter your Exulu IMP base url:',
                    default: 'https://<your_domain>'
                }
            ]);

            const response = await fetch(`${baseUrl}/api/config`);
            const data = await response.json();

            if (!data.backend) {
                console.log(chalk.red('❌ Failed to get backend url from the application, are you sure you provided the correct url?'));
                process.exit(1);
            }

            settings.env = {
                ANTHROPIC_BASE_URL: data.backend + "/gateway/anthropic",
                DISABLE_AUTOUPDATER: 0
            };

            await this.setupApiKey(baseUrl + "/token", settings);

        } else {
            // Check if existing API key is still valid
            const existingApiKey = settings.apiKeyHelper.replace('echo ', '').trim();
            // Always extract the protocol and host (TLD), removing any path/query/fragment
            const urlObj = new URL(settings.env.ANTHROPIC_BASE_URL);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            const isValid = await this.validateApiKey(baseUrl, existingApiKey);

            if (!isValid) {
                console.log(chalk.red('❌ Existing API key is invalid or expired'));
                await this.setupApiKey(baseUrl + "/token", settings);
            } else {
                console.log(chalk.green('✅ API key is valid'));
            }
        }

        // Save settings

        const urlObj = new URL(settings.env.ANTHROPIC_BASE_URL);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));
        console.log(chalk.green('✅ Settings are configured'));

        // Ask about adding .claude/settings.json to .gitignore
        await this.manageGitignore();

        return {
            backend: baseUrl,
            token: settings.apiKeyHelper.replace('echo ', '').trim()
        };
    }

    async setupApiKey(tokenUrl, settings) {
        console.log(chalk.yellow('🔐 API Key setup required'));
        console.log(chalk.bgBlue.white.bold('\n=== Access token setup ==='));
        console.log(chalk.blueBright.bold('👉 Please open the following URL in your browser to authenticate:'));
        console.log(chalk.bgWhite.black(`\n  ${tokenUrl}\n`));
        console.log(chalk.gray('Authenticate and copy your access token\n'));

        const { apiKey } = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'Paste your API key:',
                mask: '*'
            }
        ]);

        if (!apiKey || apiKey.trim() === '') {
            console.error(chalk.red('❌ API key is required'));
            process.exit(1);
        }

        settings.apiKeyHelper = `echo ${apiKey.trim()}`;
    }

    async manageGitignore() {
        const gitignorePath = path.join(process.cwd(), '.gitignore');
        const claudeSettingsEntry = '.claude/settings.json';
        const claudeDirEntry = '.claude';

        // Check if .gitignore exists and analyze its content
        let gitignoreContent = '';
        let hasClaudeSettingsJson = false;
        let hasClaudeDir = false;

        if (fs.existsSync(gitignorePath)) {
            gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            const lines = gitignoreContent.split('\n').map(line => line.trim());

            hasClaudeSettingsJson = lines.includes(claudeSettingsEntry);
            hasClaudeDir = lines.includes(claudeDirEntry);
        }

        // If .claude/settings.json is already there, we're good
        if (hasClaudeSettingsJson) {
            console.log(chalk.green('✅ .claude/settings.json is already in .gitignore \n'));
            return;
        }

        // If .claude directory is ignored, suggest changing to specific file
        if (hasClaudeDir) {
            console.log(chalk.yellow('⚠️  Found ".claude" in .gitignore'));
            console.log(chalk.gray('This ignores the entire .claude directory, including hooks, commands, and agents.'));
            console.log(chalk.gray('We recommend changing this to ".claude/settings.json" to only ignore sensitive settings.\n'));

            const { replaceEntry } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'replaceEntry',
                    message: 'Would you like to replace ".claude" with ".claude/settings.json" in .gitignore?',
                    default: true
                }
            ]);

            if (replaceEntry) {
                try {
                    // Replace .claude with .claude/settings.json
                    const updatedContent = gitignoreContent.replace(
                        new RegExp(`^${claudeDirEntry}$`, 'm'),
                        claudeSettingsEntry
                    );

                    fs.writeFileSync(gitignorePath, updatedContent);
                    console.log(chalk.green('✅ Updated .gitignore: replaced ".claude" with ".claude/settings.json"'));

                } catch (error) {
                    console.log(chalk.red('❌ Failed to update .gitignore:'), error.message);
                    console.log(chalk.yellow('You may want to manually change ".claude" to ".claude/settings.json" in your .gitignore file'));
                }
            } else {
                console.log(chalk.yellow('⚠️  Keeping existing ".claude" entry in .gitignore'));
                console.log(chalk.gray('Note: This will prevent committing hooks, commands, and agents from the .claude directory'));
            }
            return;
        }

        // If neither entry exists, ask to add .claude/settings.json
        const { addToGitignore } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'addToGitignore',
                message: 'Would you like to add .claude/settings.json to .gitignore to keep your API key private?',
                default: true
            }
        ]);

        if (!addToGitignore) {
            console.log(chalk.yellow('⚠️  Remember to keep your .claude/settings.json file private'));
            return;
        }

        try {
            // Add entry to .gitignore
            const entryToAdd = gitignoreContent.endsWith('\n') || gitignoreContent === ''
                ? claudeSettingsEntry + '\n'
                : '\n' + claudeSettingsEntry + '\n';

            fs.appendFileSync(gitignorePath, entryToAdd);

            const action = fs.existsSync(gitignorePath) && gitignoreContent ? 'updated' : 'created';
            console.log(chalk.green(`✅ .gitignore ${action} with .claude/settings.json entry`));

        } catch (error) {
            console.log(chalk.red('❌ Failed to update .gitignore:'), error.message);
            console.log(chalk.yellow('You may want to manually add .claude/settings.json to your .gitignore file'));
        }
    }

    async validateApiKey(baseUrl, apiKey) {
        return new Promise((resolve) => {
            const url = new URL(`${baseUrl}/ping`);
            const client = url.protocol === 'https:' ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            };

            const req = client.request(options, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.on('timeout', () => {
                resolve(false);
            });

            req.end();
        });
    }

    isDockerInstalled() {
        try {
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    cleanup() {
        // Stop any ongoing recording
        if (this.currentMic) {
            this.currentMic.stop();
        }

        // Clear recording timer
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }

        // Terminate Claude process if it exists (for backward compatibility)
        if (this.claudeProcess && !this.claudeProcess.killed) {
            try {
                this.claudeProcess.kill();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }

    launchClaude() {
        try {
            // Replace current process with Claude Code
            execSync('claude --output-format stream-json', { stdio: 'inherit' });
        } catch (error) {
            console.error(chalk.red('❌ Failed to start Claude Code:'), error.message);
            process.exit(1);
        }
    }

    async setupAgentOS() {
        console.log(chalk.blue.bold('🏗️ Setting up Agent OS...'));
        console.log(chalk.gray('Agent OS provides AI-powered development environment with coding standards integration.\n'));

        // Validate settings first
        const settings = await this.validateSettings();

        // Step 1: Check if .agent-os folder exists
        const agentOsPath = path.join(process.cwd(), '.agent-os');
        const agentOsExists = fs.existsSync(agentOsPath);

        if (!agentOsExists) {
            console.log(chalk.yellow('📁 .agent-os folder not found. Installing Agent OS...'));
            console.log(chalk.gray('Running: curl -sSL https://raw.githubusercontent.com/buildermethods/agent-os/main/setup/project.sh | bash -s -- --no-base --claude-code\n'));

            try {
                execSync('curl -sSL https://raw.githubusercontent.com/buildermethods/agent-os/main/setup/project.sh | bash -s -- --no-base --claude-code', {
                    stdio: 'inherit',
                    cwd: process.cwd()
                });
                console.log(chalk.green('✅ Agent OS installed successfully!\n'));
            } catch (error) {
                console.error(chalk.red('❌ Failed to install Agent OS:'), error.message);
                console.log(chalk.yellow('You may need to install Agent OS manually or check your internet connection.'));
                return;
            }
        } else {
            console.log(chalk.green('✅ .agent-os folder found, skipping installation.\n'));
        }

        // Step 2: Fetch available coding standards
        console.log(chalk.blue('📋 Fetching available coding standards...'));

        let codingStandards;
        try {
            const document = gql`
            {
                code_standards_itemsPagination(page: 1, limit: 25) {
                    items {
                        id
                        name
                        description
                        updatedAt
                        createdAt
                    }
                }
            }
            `
            const client = new GraphQLClient(`${baseUrl}/graphql`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const response = await client.request(document);

            const codingStandards = await response.code_standards_itemsPagination.items;

            if (!Array.isArray(codingStandards) || codingStandards.length === 0) {
                console.log(chalk.yellow('⚠️  No coding standards found in your Exulu instance.'));
                console.log(chalk.gray('You can create coding standards in your Exulu web interface first.\n'));
                return;
            }

            console.log(chalk.green(`✅ Found ${codingStandards.length} coding standard(s)\n`));

        } catch (error) {
            console.error(chalk.red('❌ Failed to fetch coding standards:'), error.message);
            console.log(chalk.gray('Please check your connection to the Exulu backend.\n'));
            return;
        }

        // Step 3: Let user select a coding standard
        const { selectedStandardId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedStandardId',
                message: 'Select a coding standard to apply:',
                choices: [
                    ...codingStandards.map(standard => ({
                        name: standard.name,
                        value: standard.id
                    })),
                    { name: chalk.gray('Cancel'), value: 'cancel' }
                ]
            }
        ]);

        if (selectedStandardId === 'cancel') {
            console.log(chalk.yellow('Operation cancelled.\n'));
            await this.run();
        }

        // Step 4: Fetch detailed coding standard content
        console.log(chalk.blue('📄 Fetching coding standard details...'));

        let standardDetails;
        try {

            const document = gql`
            {
                code_standards_itemsById(id: "${selectedStandardId}") {
                    id
                    name
                    description
                    best_practices
                    code_style
                    tech_stack
                }
            }
            `
            const client = new GraphQLClient(`${baseUrl}/graphql`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const response = await client.request(document);;
            standardDetails = response.code_standards_itemsById;
            console.log(chalk.green('✅ Coding standard details retrieved\n'));

        } catch (error) {
            console.error(chalk.red('❌ Failed to fetch coding standard details:'), error.message);
            return;
        }

        // Step 5: Show what will be overwritten and ask for confirmation
        const standardsDir = path.join(agentOsPath, 'standards');
        const codeStyleDir = path.join(standardsDir, 'code-style');

        const filesToOverwrite = [];

        // Check which files will be overwritten
        const bestPracticesPath = path.join(standardsDir, 'best-practices.md');
        const codeStylePath = path.join(standardsDir, 'code-style.md');
        const techStackPath = path.join(standardsDir, 'tech-stack.md');

        if (fs.existsSync(bestPracticesPath)) filesToOverwrite.push('best-practices.md');
        if (fs.existsSync(codeStylePath)) filesToOverwrite.push('code-style.md');
        if (fs.existsSync(techStackPath)) filesToOverwrite.push('tech-stack.md');

        console.log(chalk.yellow.bold('⚠️  File Overwrite Warning'));
        console.log(chalk.gray('The following files will be created/overwritten:\n'));

        const allFiles = [];

        allFiles.push('best-practices.md');
        allFiles.push('code-style.md');
        allFiles.push('tech-stack.md');

        if (allFiles.length === 0) {
            console.log(chalk.yellow('⚠️ No files with content found in this coding standard.'));
            console.log(chalk.gray('Nothing will be written to your .agent-os folder.\n'));
            // Go back to main menu
            const { goBack } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'goBack',
                    message: 'Go back to main menu?',
                    default: true
                }
            ]);
            if (goBack) {
                await this.run();
            }
            return;
        }

        allFiles.forEach(file => {
            const willOverwrite = filesToOverwrite.includes(file);
            const icon = willOverwrite ? chalk.red('🔄 OVERWRITE') : chalk.green('📝 CREATE');
            console.log(`  ${icon} .agent-os/standards/${file}`);
        });

        console.log(chalk.gray(`\nCoding Standard: ${chalk.white.bold(standardDetails.name)}`));
        console.log(chalk.gray(`Total files: ${allFiles.length}`));

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Do you want to proceed with downloading the coding standards?',
                default: false
            }
        ]);

        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled.\n'));
            // Go back to main menu
            const { goBack } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'goBack',
                    message: 'Go back to main menu?',
                    default: true
                }
            ]);
            if (goBack) {
                await this.run();
            }
        }

        // Step 6: Create directories and write files
        console.log(chalk.blue('📁 Creating directories...'));

        try {
            // Create directories if they don't exist
            if (!fs.existsSync(standardsDir)) {
                fs.mkdirSync(standardsDir, { recursive: true });
            }
            if (!fs.existsSync(codeStyleDir)) {
                fs.mkdirSync(codeStyleDir, { recursive: true });
            }

            console.log(chalk.green('✅ Directories created\n'));

            // Step 7: Clear contents from code-style directory
            console.log(chalk.blue('🧹 Clearing contents from .agent-os/standards/code-style...'));

            try {
                if (fs.existsSync(codeStyleDir)) {
                    const files = fs.readdirSync(codeStyleDir);
                    for (const file of files) {
                        const filePath = path.join(codeStyleDir, file);
                        if (fs.statSync(filePath).isFile()) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    console.log(chalk.green('✅ Code-style directory cleared\n'));
                } else {
                    console.log(chalk.yellow('⚠️ Code-style directory not found, skipping clear operation\n'));
                }
            } catch (error) {
                console.log(chalk.red('❌ Failed to clear code-style directory:'), error.message);
            }

            // Step 8: Write main content files
            console.log(chalk.blue('📝 Writing standard files...'));

            const writeFile = (filePath, content, description) => {
                // Skip writing if content is empty or only whitespace
                if (!content || content.trim() === '') {
                    console.log(chalk.yellow(`  ⚠️ Skipping ${description} - no content available`));
                    return;
                }
                fs.writeFileSync(filePath, content);
                console.log(chalk.green(`  ✅ ${description}`));
            };

            writeFile(bestPracticesPath, standardDetails.best_practices?.length > 2 ? standardDetails.best_practices : "No best practices defined.", 'best-practices.md');
            writeFile(codeStylePath, standardDetails.code_style?.length > 2 ? standardDetails.code_style : "No code styles defined.", 'code-style.md');
            writeFile(techStackPath, standardDetails.tech_stack?.length > 2 ? standardDetails.tech_stack : "No tech stack defined.", 'tech-stack.md');

            console.log(chalk.green.bold('\n🎉 Coding standards setup complete!'));
            console.log(chalk.gray('Your Agent OS environment now has the following structure:'));
            console.log(chalk.cyan(`
📂 .agent-os/standards/
├── 📄 best-practices.md
├── 📄 code-style.md
└── 📄 tech-stack.md
            `));

            console.log(chalk.blue('💡 These files will help AI assistants understand your coding standards and best practices.\n'));

        } catch (error) {
            console.error(chalk.red('❌ Failed to write files:'), error.message);
            return;
        }

        // Return to main menu
        const { goBack } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'goBack',
                message: 'Go back to main menu?',
                default: true
            }
        ]);

        if (goBack) {
            await this.run();
        }
    }

    async listContexts({ backend, token }) {

        const document = gql`
        {
            contexts {
                items {
                    id
                    name
                    description
                }
            }
        }
        `
        const client = new GraphQLClient(`${backend}/graphql`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const response = await client.request(document);
        const contexts = await response.contexts.items;

        console.log(chalk.blue('✅ Contexts:'));
        console.table(contexts.map(context => ({
            id: context.id?.slice(0, 8) + '...',
            name: context.name,
            description: context.description?.slice(0, 40) + '...',
        })));
        console.log(chalk.gray('Total contexts: ' + contexts.length));

        const { goBack } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'goBack',
                message: 'Go back to main menu?',
                default: true
            }
        ]);

        if (goBack) {
            await this.run();
        }
    }

    async changeSettings() {
        console.log(chalk.yellow('🔄 Changing settings...\n'));

        // Delete existing settings file to force recreation
        if (fs.existsSync(this.claudeSettingsPath)) {
            fs.unlinkSync(this.claudeSettingsPath);
        }

        // Re-run the settings validation which will prompt for new values
        await this.validateSettings();

        console.log(chalk.green('✅ Settings updated successfully!\n'));

        // Go back to main menu
        await this.run();
    }

    async listAgents({ backend, token }) {

        const document = gql`
        {
            agentsPagination(page: 1, limit: 50) {
                items {
                id
                name
                description
                modelName
                }
            }
        }
        `
        const client = new GraphQLClient(`${backend}/graphql`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const response = await client.request(document);
        const agents = await response.agentsPagination.items;

        console.log(chalk.blue('✅ Agents:'));
        console.table(agents.map(agent => ({
            id: agent.id?.slice(0, 8) + '...',
            name: agent.name,
            description: agent.description?.slice(0, 40) + '...',
        })));
        console.log(chalk.gray('Total agents: ' + agents.length));

        const { goBack } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'goBack',
                message: 'Go back to main menu?',
                default: true
            }
        ]);

        if (goBack) {
            await this.run();
        }
    }
}

// Run the CLI
if (require.main === module) {
    // Default CLI behavior
    const cli = new ExuluCLI();
    cli.run().catch(error => {
        console.error(chalk.red('❌ An error occurred:'), error.message);
        process.exit(1);
    });
}

module.exports = ExuluCLI;