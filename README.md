# Exulu CLI

A CLI tool for managing Claude Code in the Exulu development environment.

## Installation

```bash
npm install -g @exulu/cli
```

## Usage

Run the CLI tool:

```bash
exulu
```

### Features

- **Start Claude Code**: Automatically installs Claude Code if not present, configures settings, and launches the tool
- **Update Claude Code Hooks**: Manage Claude Code hooks (coming soon)

### What it does

1. Checks if `@anthropic-ai/claude-code` is installed globally, installs if missing
2. Validates or creates `.claude/settings.json` with proper configuration
3. Prompts for ANTHROPIC_BASE_URL if not configured
4. Handles API key authentication flow
5. Launches Claude Code and hands over control

### Configuration

The tool manages a `.claude/settings.json` file with the following structure:

```json
{
    "env": {
        "ANTHROPIC_BASE_URL": "http://localhost:9001/gateway/anthropic",
        "DISABLE_AUTOUPDATER": 1
    },
    "apiKeyHelper": "echo <your_api_key>"
}
```

## Development

To test locally:

```bash
cd CLI
npm install
node index.js
```# exulu-cli
