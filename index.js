#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
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
        console.log(chalk.gray('Welcome to the Exulu development environment\n'));

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '🤖 Start Claude Code!!', value: 'start-claude' },
                    { name: '🔧 Update Claude Code Hooks', value: 'update-hooks' }
                ]
            }
        ]);

        switch (action) {
            case 'start-claude':
                await this.startClaude();
                break;
            case 'update-hooks':
                await this.updateHooks();
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

        // Validate or create settings.json
        await this.validateClaudeSettings();

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

    async validateClaudeSettings() {
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

        // Validate and set environment configuration
        if (!settings.env || !settings.env.ANTHROPIC_BASE_URL) {
            const { baseUrl } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'baseUrl',
                    message: 'Enter your ANTHROPIC_BASE_URL:',
                    default: 'http://localhost:9001/gateway/anthropic'
                }
            ]);

            settings.env = {
                ANTHROPIC_BASE_URL: baseUrl,
                DISABLE_AUTOUPDATER: 1
            };
        }

        // Validate API key
        if (!settings.apiKeyHelper || settings.apiKeyHelper === 'echo PLACEHOLDER' || settings.apiKeyHelper.trim() === '') {
            await this.setupApiKey(settings);
        } else {
            // Check if existing API key is still valid
            const existingApiKey = settings.apiKeyHelper.replace('echo ', '').trim();
            const baseUrl = settings.env.ANTHROPIC_BASE_URL.replace('/gateway/anthropic', '');
            
            console.log(chalk.yellow('🔐 Validating existing token...'));
            const isValid = await this.validateApiKey(baseUrl, existingApiKey);
            
            if (!isValid) {
                console.log(chalk.red('❌ Existing API key is invalid or expired'));
                await this.setupApiKey(settings);
            } else {
                console.log(chalk.green('✅ API key is valid'));
            }
        }

        // Save settings
        fs.writeFileSync(this.claudeSettingsPath, JSON.stringify(settings, null, 4));
        console.log(chalk.green('✅ Claude settings configured\n'));
    }

    async setupApiKey(settings) {
        const baseUrl = settings.env.ANTHROPIC_BASE_URL.replace('/gateway/anthropic', '');
        const authUrl = `${baseUrl}/token`;

        console.log(chalk.yellow('🔐 API Key setup required'));
        console.log(chalk.bgBlue.white.bold('\n=== Access token setup ==='));
        console.log(chalk.blueBright.bold('👉 Please open the following URL in your browser to authenticate:'));
        console.log(chalk.bgWhite.black(`\n  ${authUrl}\n`));
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

    async updateHooks() {
        console.log(chalk.blue('🔧 Update Claude Code Hooks'));
        console.log(chalk.gray('This feature is coming soon!\n'));
        
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