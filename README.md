# Exulu CLI

A CLI tool for the Exulu Intelligence Management Platform.

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

- **Start Claude Code**: Automatically installs a Claude Code instance connected to your Exulu IMP.
- **Setup Agent OS**: Install and configure Agent OS with coding standards from your Exulu instance.
- **List agents**: Lists all agents configured in your Exulu IMP instance.
- **List contexts**: Lists all knowledge contexts configured in your Exulu IMP instance.
- **Change settings**: Update your connection settings and API key.

## Architecture

The CLI is built around the `ExuluCLI` class defined in `index.js`, which provides a comprehensive interface for managing your Exulu Intelligence Management Platform integration.

### Main Components

#### ExuluCLI Class (`index.js`)

The main class that handles all CLI operations:

**Constructor**
- Sets up the Claude settings path at `.claude/settings.json` in the current working directory

**Core Methods**

##### `run()`
The main entry point that displays the ASCII art logo and presents the main menu with options:
- Start Claude Code
- Setup Agent OS  
- List agents
- List contexts
- Change settings

##### `startClaude()`
Handles the complete Claude Code setup process:
1. Selects an Exulu IMP agent
2. Checks if Claude Code is installed (calls `isClaudeInstalled()`)
3. Installs Claude Code if needed (calls `installClaude()`)
4. Allows selection of local MCP servers (calls `selectMCPServers()`)
5. Launches Claude Code (calls `launchClaude()`)

##### `setupAgentOS()`
Comprehensive Agent OS setup that:
1. Validates settings and authentication
2. Installs Agent OS if `.agent-os` folder doesn't exist
3. Fetches available coding standards from your Exulu backend
4. Downloads and installs selected coding standards to `.agent-os/standards/`
5. Creates language-specific code style files

##### Settings Management

**`validateSettings()`**
- Creates `.claude` directory if needed
- Validates existing API key or prompts for new credentials
- Handles base URL configuration
- Manages `.gitignore` entries for security

**`setupApiKey(tokenUrl, settings)`**
- Prompts user to authenticate via browser
- Securely stores API key in settings

**`manageGitignore()`**
- Intelligently manages `.gitignore` entries
- Prevents accidental commit of sensitive settings
- Offers to replace broad `.claude` exclusion with specific `.claude/settings.json` exclusion

##### API Operations

**`listAgents({ backend, token })`**
Fetches and displays all agents from your Exulu backend in a formatted table

**`listContexts({ backend, token })`**
Fetches and displays all knowledge contexts from your Exulu backend in a formatted table

**`validateApiKey(baseUrl, apiKey)`**
Validates API key by making a ping request to the backend

##### MCP Server Management

**`selectMCPServers()`**
Interactive menu for installing local MCP servers:
- Currently supports shadcn/ui MCP server
- Extensible for additional servers

**`installMCPServer(server)`**
Executes the installation command for selected MCP servers

##### Utility Methods

**`isClaudeInstalled()`** - Checks if Claude Code is available
**`installClaude()`** - Installs Claude Code via npm
**`launchClaude()`** - Starts Claude Code
**`cleanup()`** - Cleanup method for graceful shutdown

### Security Features

- **API Key Protection**: Automatically manages `.gitignore` to prevent accidental commits
- **Secure Storage**: API keys are stored in `.claude/settings.json` 
- **Token Validation**: Validates existing tokens before use
- **Browser Authentication**: Uses secure browser-based auth flow

### Error Handling

The CLI includes comprehensive error handling:
- Network connectivity issues
- Invalid API keys
- Missing dependencies
- File system permissions
- Installation failures

### Configuration Files

**`.claude/settings.json`**
Contains:
- `apiKeyHelper`: Encrypted API key storage
- `env.ANTHROPIC_BASE_URL`: Backend endpoint configuration
- `env.DISABLE_AUTOUPDATER`: Claude Code configuration

### Dependencies

- `inquirer`: Interactive CLI prompts
- `chalk`: Terminal styling and colors
- `fs`: File system operations
- `path`: Path manipulation
- `child_process`: System command execution
- `https/http`: HTTP requests for API calls