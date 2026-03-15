# Ripple CLI

Install and manage AI skills from the Ripple platform.

## Quick Start

```bash
npx @anthropic-ai/ripple-cli install skill-porting-engineer
```

## Install Globally

```bash
npm install -g @anthropic-ai/ripple-cli
ripple install skill-porting-engineer
```

## Commands

| Command | Description |
|---------|-------------|
| `ripple install <name>` | Install a skill into `.skills/` |
| `ripple list` | List all available skills |
| `ripple search <query>` | Search skills by keyword |
| `ripple info <name>` | Show skill details |
| `ripple config` | Show current configuration |

## Configuration

Priority (highest to lowest):

1. **CLI flags**: `--server`, `--dir`, `--token`
2. **Project file**: `.ripplerc` (JSON) in current directory
3. **Environment variables**: `RIPPLE_SERVER`, `RIPPLE_DIR`, `RIPPLE_TOKEN`
4. **Defaults**: server `http://localhost:8000`, dir `.skills`

### `.ripplerc` example

```json
{
  "server": "https://ripple.patpat.com",
  "dir": ".skills",
  "token": "your-jwt-token"
}
```
