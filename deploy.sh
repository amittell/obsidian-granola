#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 GRANOLA IMPORTER DEPLOYMENT SCRIPT (Simple Version)
# ═══════════════════════════════════════════════════════════════════════════

# Configuration - Update this path to your Obsidian vault
VAULT_PATH="$HOME/Documents/ObsidianVault"

# Plugin configuration
PLUGIN_NAME="granola-importer"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_NAME"
BUILD_FILES=("main.js" "manifest.json" "styles.css")

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Granola Importer Deployment${NC}"
echo "═══════════════════════════════"

# Build the plugin
echo -e "${YELLOW}📦 Building plugin...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
    
    # Check bundle size
    BUNDLE_SIZE=$(wc -c < main.js)
    echo -e "Bundle size: ${BUNDLE_SIZE} bytes"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Create plugin directory
echo -e "\n${YELLOW}📂 Creating plugin directory...${NC}"
mkdir -p "$PLUGIN_DIR"

if [ ! -d "$PLUGIN_DIR" ]; then
    echo -e "${RED}❌ Cannot access vault at: $VAULT_PATH${NC}"
    echo -e "${YELLOW}💡 Please update VAULT_PATH in this script${NC}"
    exit 1
fi

# Deploy files
echo -e "\n${YELLOW}🚢 Deploying files...${NC}"
for file in "${BUILD_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$PLUGIN_DIR/"
        echo -e "${GREEN}✅ Deployed $file${NC}"
    else
        echo -e "${RED}⚠️  Warning: $file not found${NC}"
    fi
done

# Verify deployment
echo -e "\n${YELLOW}🔍 Verifying deployment...${NC}"
all_good=true
for file in "${BUILD_FILES[@]}"; do
    if [ -f "$PLUGIN_DIR/$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        all_good=false
    fi
done

if [ "$all_good" = true ]; then
    echo -e "\n${GREEN}🎉 Deployment successful!${NC}"
    echo -e "Plugin location: ${PLUGIN_DIR}"
    echo -e "\nNext steps:"
    echo -e "1. Open Obsidian"
    echo -e "2. Go to Settings → Community Plugins"
    echo -e "3. Enable 'Granola Importer'"
    echo -e "4. Start importing your notes! ✨"
else
    echo -e "\n${RED}❌ Deployment failed${NC}"
    exit 1
fi