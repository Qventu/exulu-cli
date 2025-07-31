#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const https = require('https');
const http = require('http');

class ExuluCLI {
    constructor() {
        this.claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    }

    async run() {
        console.log(chalk.blue.bold('🚀 Exulu CLI'));
        console.log(chalk.gray(`
            ███████╗██╗  ██╗██╗   ██╗██╗      ██╗   ██╗
            ██╔════╝╚██╗██╔╝██║   ██║██║      ██║   ██║
            █████╗   ╚███╔╝ ██║   ██║██║      ██║   ██║
            ██╔══╝   ██╔██╗ ██║   ██║██║      ██║   ██║
            ███████╗██╔╝ ██╗╚██████╔╝███████╗╚██████╔╝
            ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ 
            Intelligence Management Platform
        
            `));
        console.log(chalk.gray('Welcome 🤘 \n'));


        // Validate or create settings.json
        const settings = await this.validateSettings();

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '🤖 Start Claude Code', value: 'start-claude' },
                    { name: '🔧 List agents', value: 'list-agents' },
                    { name: '🔧 List contexts', value: 'list-contexts' },
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
        }
    }

    async startClaude() {
        console.log(chalk.yellow('Starting Claude Code setup...\n'));

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
                DISABLE_AUTOUPDATER: 1
            };

            await this.setupApiKey(baseUrl + "/token", settings);

        } else {
            // Check if existing API key is still valid
            const existingApiKey = settings.apiKeyHelper.replace('echo ', '').trim();
            const baseUrl = settings.env.ANTHROPIC_BASE_URL.replace('/gateway/anthropic', '');

            console.log(chalk.yellow('🔐 Validating existing token...'));
            const isValid = await this.validateApiKey(baseUrl, existingApiKey);

            if (!isValid) {
                console.log(chalk.red('❌ Existing API key is invalid or expired'));
                await this.setupApiKey(baseUrl + "/token", settings);
            } else {
                console.log(chalk.green('✅ API key is valid'));
            }
        }

        // Save settings
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));
        console.log(chalk.green('✅ Settings configured\n'));
        return {
            backend: settings.env.ANTHROPIC_BASE_URL.replace('/gateway/anthropic', ''),
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

    launchClaude() {
        try {
            // Replace current process with Claude Code
            const { execSync } = require('child_process');
            execSync('claude', { stdio: 'inherit' });
        } catch (error) {
            console.error(chalk.red('❌ Failed to start Claude Code:'), error.message);
            process.exit(1);
        }
    }

    async listContexts({ backend, token }) {
        const response = await fetch(`${backend}/contexts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        console.log(chalk.blue('✅ Contexts:'));
        console.table(data.map(context => ({
            id: context.id?.slice(0, 8) + '...',
            name: context.name,
            description: context.description?.slice(0, 40) + '...',
        })));
        console.log(chalk.gray('Total contexts: ' + data.length));

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

    async listAgents({ backend, token }) {
        const response = await fetch(`${backend}/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        console.log(chalk.blue('✅ Agents:'));
        console.table(data.map(agent => ({
            id: agent.id?.slice(0, 8) + '...',
            name: agent.name,
            description: agent.description?.slice(0, 40) + '...',
        })));
        console.log(chalk.gray('Total agents: ' + data.length));

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
    const cli = new ExuluCLI();
    cli.run().catch(error => {
        console.error(chalk.red('❌ An error occurred:'), error.message);
        process.exit(1);
    });
}

module.exports = ExuluCLI;