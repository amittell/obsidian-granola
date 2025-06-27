#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 GRANOLA IMPORTER DEPLOYMENT SCRIPT (Simple Version)
# ═══════════════════════════════════════════════════════════════════════════

# Check for dry-run mode
DRY_RUN=false
if [[ "$1" == "--dry-run" || "$1" == "-d" ]]; then
    DRY_RUN=true
    VAULT_PATH="/example/path/to/ObsidianVault"
else
    # Configuration - Update this path to your Obsidian vault
    VAULT_PATH="$HOME/Documents/ObsidianVault"
fi

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

if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}🚀 Granola Importer Deployment ${YELLOW}(DRY RUN)${NC}"
    echo "════════════════════════════════════════"
    echo -e "${YELLOW}🧪 DRY RUN MODE - No actual deployment will occur${NC}"
else
    echo -e "${BLUE}🚀 Granola Importer Deployment${NC}"
    echo "═══════════════════════════════"
fi

# Build the plugin
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}📦 Simulating build...${NC}"
    echo -e "${GREEN}✅ Build simulation successful${NC}"
    BUNDLE_SIZE="6620"
    echo -e "Simulated bundle size: ${BUNDLE_SIZE} bytes"
else
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
fi

# Create plugin directory
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}📂 Simulating plugin directory creation...${NC}"
    echo -e "${GREEN}✅ Plugin directory simulation complete${NC}"
else
    echo -e "\n${YELLOW}📂 Creating plugin directory...${NC}"
    mkdir -p "$PLUGIN_DIR"

    if [ ! -d "$PLUGIN_DIR" ]; then
        echo -e "${RED}❌ Cannot access vault at: $VAULT_PATH${NC}"
        echo -e "${YELLOW}💡 Please update VAULT_PATH in this script${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Plugin directory created${NC}"
fi

# Deploy files
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}🚢 Simulating file deployment...${NC}"
    for file in "${BUILD_FILES[@]}"; do
        echo -e "${YELLOW}✅ Simulated $file${NC}"
    done
else
    echo -e "\n${YELLOW}🚢 Deploying files...${NC}"
    for file in "${BUILD_FILES[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$PLUGIN_DIR/"
            echo -e "${GREEN}✅ Deployed $file${NC}"
        else
            echo -e "${RED}⚠️  Warning: $file not found${NC}"
        fi
    done
fi

# Verify deployment
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}🔍 Verifying simulation...${NC}"
    for file in "${BUILD_FILES[@]}"; do
        echo -e "${YELLOW}✅ $file (simulated)${NC}"
    done
    
    echo -e "\n${YELLOW}🎉 Simulation successful!${NC}"
    echo -e "Simulated location: ${PLUGIN_DIR}"
    echo -e "\nTo run for real:"
    echo -e "1. Update VAULT_PATH in this script"
    echo -e "2. Run: ${BLUE}./deploy.sh${NC} (without --dry-run)"
    echo -e "3. Enable plugin in Obsidian Settings"
    echo -e "4. Start importing your notes! ✨"
else
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
fi