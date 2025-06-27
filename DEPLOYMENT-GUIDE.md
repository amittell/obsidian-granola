# 🚀 Deployment Guide

Two deployment options are available to deploy your Granola Importer plugin to your Obsidian vault.

## 🎪 Option 1: Ultra Fancy Deployment (Recommended for Fun)

For maximum entertainment and ASCII art overload:

```bash
# Live deployment
./deploy-fancy.sh

# Dry run simulation (no actual deployment)
./deploy-fancy.sh --dry-run
# or
./deploy-fancy.sh -d
```

**Features:**

- 🌈 Rainbow ASCII art banners
- ✨ Animated loading sequences
- 🎆 Fireworks celebration on success
- 🎭 Dramatic typewriter effects
- 🎨 Full spectrum color experience
- 🏆 Epic success/failure announcements

## 📦 Option 2: Simple Deployment (Professional)

For a clean, straightforward deployment:

```bash
# Live deployment
./deploy.sh

# Dry run simulation (no actual deployment)
./deploy.sh --dry-run
# or
./deploy.sh -d
```

**Features:**

- Clean, minimal output
- Essential status information
- Fast execution
- Professional appearance

## 🧪 Dry Run Mode

Both scripts support dry run mode for testing without actual deployment:

```bash
# Test deployment without making changes
./deploy.sh --dry-run
./deploy-fancy.sh --dry-run

# Short flag also works
./deploy.sh -d
./deploy-fancy.sh -d
```

**Dry Run Features:**

- ✅ Simulates all deployment steps
- ✅ Shows expected file paths and sizes
- ✅ No actual files created or modified
- ✅ Perfect for testing configuration
- ✅ Uses example vault path (/example/path/to/ObsidianVault)

## ⚙️ Configuration

Before running either script for real deployment, update the configuration in the script file:

```bash
# Set your Obsidian vault path
VAULT_PATH="$HOME/Documents/ObsidianVault"
```

Common vault locations:

- **macOS**: `$HOME/Documents/ObsidianVault`
- **Windows**: `$HOME/Documents/ObsidianVault`
- **Linux**: `$HOME/Documents/ObsidianVault`

## 🎯 What the Scripts Do

Both scripts perform the same core actions:

1. **Build** the plugin using `npm run build`
2. **Verify** bundle size and build success
3. **Create** plugin directory in your vault
4. **Deploy** the three essential files:
    - `main.js` (plugin code)
    - `manifest.json` (plugin metadata)
    - `styles.css` (plugin styles)
5. **Verify** successful deployment

## 🔧 Manual Deployment

If you prefer manual deployment:

1. Build the plugin:

    ```bash
    npm run build
    ```

2. Create the plugin directory:

    ```bash
    mkdir -p "$VAULT_PATH/.obsidian/plugins/granola-importer"
    ```

3. Copy the files:
    ```bash
    cp main.js manifest.json styles.css "$VAULT_PATH/.obsidian/plugins/granola-importer/"
    ```

## 🚨 Troubleshooting

### "Cannot access vault" error

- Verify your `VAULT_PATH` is correct
- Ensure the vault directory exists
- Check that you have write permissions

### "Build failed" error

- Run `npm install` to ensure dependencies are installed
- Check for TypeScript errors with `npm run type-check`
- Verify all source files are present

### Plugin not appearing in Obsidian

- Restart Obsidian after deployment
- Check that the plugin directory was created correctly
- Ensure all three files (main.js, manifest.json, styles.css) are present

## 🎊 Success!

After successful deployment:

1. Open Obsidian
2. Go to **Settings** → **Community Plugins**
3. Find **Granola Importer** in the list
4. Click the toggle to **Enable** it
5. Access via **Command Palette**: `Granola Importer: Import Granola Notes`

Enjoy your beautifully formatted Granola notes in Obsidian! ✨
