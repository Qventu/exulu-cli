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
        console.log(chalk.cyanBright(`
███████╗██╗  ██╗██╗   ██╗██╗      ██╗   ██╗
██╔════╝╚██╗██╔╝██║   ██║██║      ██║   ██║
█████╗   ╚███╔╝ ██║   ██║██║      ██║   ██║
██╔══╝   ██╔██╗ ██║   ██║██║      ██║   ██║
███████╗██╔╝ ██╗╚██████╔╝███████╗╚██████╔╝
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ 
Intelligence Management Platform`));
        console.log(chalk.cyan('\n┌─────────────────────────────────────────────────────────────────────────────┐'));
        console.log(chalk.cyan('│') + chalk.bgCyan.black.bold(' 💡 PRO TIP OF THE DAY: ') + chalk.cyan('                                                     │'));
        console.log(chalk.cyan('├─────────────────────────────────────────────────────────────────────────────┤'));
        console.log(chalk.cyan('│ ') + chalk.cyan.bold('Did you know that on Mac, you can enable "Dictation" in System Settings') + chalk.cyan('     │'));
        console.log(chalk.cyan('│ ') + chalk.cyan('and map it to a shortcut. This allows you to speak to Claude directly') + chalk.cyan('       │'));
        console.log(chalk.cyan('│ ') + chalk.cyan('in the terminal!') + chalk.cyan('                                                            │'));
        console.log(chalk.cyan('└─────────────────────────────────────────────────────────────────────────────┘\n'));


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
                    { name: '⚙️ Change settings', value: 'change-settings' },
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

        const response = await fetch(`${baseUrl}/agents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status !== 200) {
            console.log(chalk.red('❌  Failed to get agents, please check your API key or try restarting the CLI\n'));
            process.exit(1);
        }

        const data = await response.json();

        const agents = data.filter(agent => agent.type === 'custom');

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
                DISABLE_AUTOUPDATER: 1
            };

            await this.setupApiKey(baseUrl + "/token", settings);

        } else {
            // Check if existing API key is still valid
            const existingApiKey = settings.apiKeyHelper.replace('echo ', '').trim();
            // Always extract the protocol and host (TLD), removing any path/query/fragment
            const urlObj = new URL(settings.env.ANTHROPIC_BASE_URL);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

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

        const urlObj = new URL(settings.env.ANTHROPIC_BASE_URL);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));
        console.log(chalk.green('✅ Settings configured\n'));
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
    // Default CLI behavior
    const cli = new ExuluCLI();
    cli.run().catch(error => {
        console.error(chalk.red('❌ An error occurred:'), error.message);
        process.exit(1);
    });
}

module.exports = ExuluCLI;