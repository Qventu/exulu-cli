#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const autocompletePrompt = require('inquirer-autocomplete-prompt');
const chalk = require('chalk');
const https = require('https');
const http = require('http');
const { gql, GraphQLClient } = require('graphql-request');

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', autocompletePrompt)

const tips = [
    "Install the **Claude Code extension** in your IDE so Claude Code can recognize your current open file, and selected code.",
    "In the **terminal UI**: you can @-tag files, use slash commands, and explicitly select the context to include.",
    "Run `/clear` frequently when switching tasks to trim history and reduce token usage overhead.",
    "Use **`claude --dangerously-skip-permissions`** (or similar config) to bypass repetitive permission prompts if you trust your project context.",
    "Customize your PR review prompt via `claude-code-review.yml` — e.g. tell Claude to *only* report bugs or security issues, and keep it concise.",
    "Set up **terminal mode properly** (e.g. `/terminal-setup`) so that Shift+Enter and input behavior work as expected.",
    "Remember: **Escape** stops the current run; pressing Escape twice shows a list of past messages you can navigate back to.",
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

    async selectFromPaginatedList(client, queryName, itemType, filters = {}, additionalChoices = []) {
        let page = 1;
        const limit = 10;
        let selectedItem = null;

        // Create a function to fetch items based on search input
        const fetchItems = async (searchTerm = '') => {
            const mergedFilters = { ...filters };

            if (searchTerm && searchTerm.trim()) {
                mergedFilters.name = { contains: searchTerm.trim() };
            }

            const filterString = Object.keys(mergedFilters).length > 0
                ? `, filters: ${JSON.stringify(mergedFilters).replace(/"([^"]+)":/g, '$1:')}`
                : '';

            const document = gql`
                {
                    ${queryName}(page: ${page}, limit: ${limit}${filterString}) {
                        items {
                            id
                            name
                            description
                        }
                        pageInfo {
                            pageCount
                            itemCount
                            currentPage
                            hasPreviousPage
                            hasNextPage
                        }
                    }
                }
            `;

            try {
                const response = await client.request(document);
                const data = response[queryName];
                return data;
            } catch (error) {
                console.error(chalk.red('Error fetching items:'), error.message);
                return { items: [], pageInfo: { pageCount: 1, itemCount: 0 } };
            }
        };

        while (!selectedItem) {
            const searchSource = async (answersSoFar, input) => {
                const data = await fetchItems(input);
                const items = data.items;
                const totalPages = data.pageInfo.pageCount || 1;
                const hasNextPage = data.pageInfo.hasNextPage;
                const hasPreviousPage = data.pageInfo.hasPreviousPage;
                const choices = [
                    ...items.map(item => {
                        const name = `${item.name}${item.description ? ` - ${item.description.slice(0, 60)}` : ''}`;
                        const short = name.slice(0, 30) + (name.length > 30 ? '...' : '');
                        return {
                            name: short,
                            value: item.id,
                        }
                    }),
                    ...additionalChoices
                ];

                // Add navigation options
                if (choices.length > 0) {
                    choices.push(new inquirer.Separator());
                }

                if (hasPreviousPage) {
                    choices.push({ name: '⬅️  Previous page', value: '__PREV__' });
                }
                if (hasNextPage) {
                    choices.push({ name: '➡️  Next page', value: '__NEXT__' });
                }

                return choices;
            };

            const { selection } = await inquirer.prompt([
                {
                    type: 'autocomplete',
                    name: 'selection',
                    message: `Search and select a ${itemType.toLowerCase().replace(/s$/, '')} (page ${page}):`,
                    source: searchSource,
                    pageSize: 15
                }
            ]);

            if (selection === '__PREV__') {
                page--;
            } else if (selection === '__NEXT__') {
                page++;
            } else {
                selectedItem = selection;
            }
        }

        return selectedItem;
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

        console.log("[EXULU] Base URL: " + baseUrl);
        console.log("[EXULU] Token: " + token);

        const client = new GraphQLClient(`${baseUrl}/graphql`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        // Select agent with pagination and search
        const agent = await this.selectFromPaginatedList(
            client,
            'agentsPagination',
            'Agents',
            { category: { eq: 'coding' } }
        );

        // Get agent details for MCP config
        const agentDocument = gql`
            {
                agentById(id: "${agent}") {
                    id
                    name
                    description
                }
            }
        `;
        const agentResponse = await client.request(agentDocument);
        const selectedAgent = agentResponse.agentById;

        // Select project with pagination and search
        const project = await this.selectFromPaginatedList(
            client,
            'projectsPagination',
            'Projects',
            {},
            [{ name: 'No project', value: 'DEFAULT' }]
        );

        settings.env.ANTHROPIC_BASE_URL = `${baseUrl}/gateway/anthropic/${agent}/${project}`;
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));

        // Create MCP config
        await this.updateMcpConfig(baseUrl, agent, selectedAgent.name);

        console.log(chalk.green(`✅ Agent ${agent} and project ${project} selected\n`));
        return { agent, project };
    }

    async updateMcpConfig(baseUrl, agentId, agentName) {
        const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

        // Create the agent entry key
        const agentKey = `exulu-mcp-server-${agentName.toLowerCase().replace(/\s+/g, '-')}`;

        // Create the new agent configuration
        const agentConfig = {
            type: "http",
            url: `${baseUrl}/mcp/${agentId}`,
            headers: {
                Authorization: "Bearer ${EXULU_TOKEN}"
            }
        };

        let mcpConfig = {};

        // Load existing .mcp.json if it exists
        if (fs.existsSync(mcpConfigPath)) {
            try {
                const fileContent = fs.readFileSync(mcpConfigPath, 'utf8');
                mcpConfig = JSON.parse(fileContent);
            } catch (error) {
                console.log(chalk.yellow('⚠️  Invalid .mcp.json found, creating new one...'));
                mcpConfig = {};
            }
        }

        // Ensure mcpServers object exists
        if (!mcpConfig.mcpServers) {
            mcpConfig.mcpServers = {};
        }

        // Add or update the agent entry
        mcpConfig.mcpServers[agentKey] = agentConfig;

        // Write the updated config back to file
        try {
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
            console.log(chalk.green(`✅ MCP configuration updated: ${agentKey}\n`));
        } catch (error) {
            console.log(chalk.red('❌ Failed to update .mcp.json:'), error.message);
        }
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

            // Remove trailing slash if present
            const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

            const response = await fetch(`${cleanBaseUrl}/api/config`);
            const data = await response.json();

            if (!data.backend) {
                console.log(chalk.red('❌ Failed to get backend url from the application, are you sure you provided the correct url?'));
                process.exit(1);
            }

            settings.env = {
                ANTHROPIC_BASE_URL: data.backend + "/gateway/anthropic",
                DISABLE_AUTOUPDATER: 0
            };

            await this.setupApiKey(cleanBaseUrl + "/token", settings);

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
            // Load settings to get the token
            if (fs.existsSync(this.claudeSettingsPath)) {
                const settings = JSON.parse(fs.readFileSync(this.claudeSettingsPath, 'utf8'));
                const token = settings.apiKeyHelper.replace('echo ', '').trim();

                // Add EXULU_TOKEN to environment for MCP servers
                process.env.EXULU_TOKEN = token;
            }

            // Replace current process with Claude Code
            // Explicitly pass environment variables including those from .env
            execSync('claude --output-format stream-json', {
                stdio: 'inherit',
                env: process.env
            });
        } catch (error) {
            console.error(chalk.red('❌ Failed to start Claude Code:'), error.message);
            process.exit(1);
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
        console.log("[EXULU] Backend: " + backend);
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