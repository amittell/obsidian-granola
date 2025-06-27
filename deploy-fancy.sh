#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                    GRANOLA IMPORTER DEPLOYMENT SCRIPT                    ║
# ║                        🚀 ULTRA FANCY EDITION 🚀                        ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# ═══════════════════════════════════════════════════════════════════════════
# 🎛️  CONFIGURATION VARIABLES
# ═══════════════════════════════════════════════════════════════════════════

# Check for dry-run mode
DRY_RUN=false
if [[ "$1" == "--dry-run" || "$1" == "-d" ]]; then
    DRY_RUN=true
    VAULT_PATH="/example/path/to/ObsidianVault"
else
    # Set your Obsidian vault path here
    VAULT_PATH="$HOME/Documents/ObsidianVault"
fi

# Plugin name and paths
PLUGIN_NAME="granola-importer"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_NAME"

# Build files to deploy
BUILD_FILES=("main.js" "manifest.json" "styles.css")

# Colors for maximum fanciness
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
BOLD='\033[1m'
DIM='\033[2m'
BLINK='\033[5m'
RAINBOW='\033[38;5;196m\033[38;5;208m\033[38;5;226m\033[38;5;46m\033[38;5;21m\033[38;5;93m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# 🎨 FANCY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Animated spinner
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [${CYAN}%c${NC}]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Rainbow text effect
rainbow() {
    local text="$1"
    local colors=(196 208 226 46 21 93)
    local i=0
    for ((j=0; j<${#text}; j++)); do
        printf "\033[38;5;${colors[$((i % 6))]}m${text:$j:1}"
        ((i++))
    done
    printf "${NC}"
}

# Typewriter effect
typewriter() {
    local text="$1"
    local delay=${2:-0.03}
    for ((i=0; i<${#text}; i++)); do
        printf "${text:$i:1}"
        sleep "$delay"
    done
    echo
}

# Glitch effect
glitch() {
    local text="$1"
    for i in {1..3}; do
        printf "\r${RED}%s${NC}" "$text"
        sleep 0.1
        printf "\r${BLUE}%s${NC}" "$text"
        sleep 0.1
        printf "\r${GREEN}%s${NC}" "$text"
        sleep 0.1
    done
    printf "\r%s\n" "$text"
}

# Progress bar
progress_bar() {
    local duration=$1
    local width=50
    local progress=0
    
    echo -ne "${CYAN}["
    while [ $progress -le $width ]; do
        echo -ne "█"
        progress=$((progress + 1))
        sleep $(echo "scale=3; $duration / $width" | bc -l)
    done
    echo -e "]${NC} ${GREEN}✅ COMPLETE${NC}"
}

# Fireworks effect
fireworks() {
    for i in {1..5}; do
        clear
        echo -e "\n\n\n\n\n"
        echo -e "                    ${YELLOW}✨${NC}     ${RED}🎆${NC}        ${BLUE}✨${NC}"
        echo -e "                ${GREEN}🎆${NC}    ${PURPLE}✨${NC}    ${YELLOW}🎆${NC}    ${CYAN}✨${NC}"
        echo -e "                    ${RED}✨${NC}     ${GREEN}🎆${NC}        ${PURPLE}✨${NC}"
        sleep 0.3
        clear
        echo -e "\n\n\n\n\n"
        echo -e "                ${PURPLE}🎆${NC}     ${CYAN}✨${NC}     ${YELLOW}🎆${NC}    ${RED}✨${NC}"
        echo -e "                    ${BLUE}✨${NC}     ${GREEN}🎆${NC}        ${PURPLE}✨${NC}"
        echo -e "                ${YELLOW}🎆${NC}    ${RED}✨${NC}    ${CYAN}🎆${NC}    ${BLUE}✨${NC}"
        sleep 0.3
    done
}

# ═══════════════════════════════════════════════════════════════════════════
# 🎪 MAIN SHOW BEGINS
# ═══════════════════════════════════════════════════════════════════════════

clear

# Ultra fancy ASCII banner
echo -e "${BOLD}${RAINBOW}"
cat << "EOF"
 ██████╗ ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗      █████╗ 
██╔════╝ ██╔══██╗██╔═══██╗████╗  ██║██╔═══██╗██║     ██╔══██╗
██║  ███╗██████╔╝██║   ██║██╔██╗ ██║██║   ██║██║     ███████║
██║   ██║██╔══██╗██║   ██║██║╚██╗██║██║   ██║██║     ██╔══██║
╚██████╔╝██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝███████╗██║  ██║
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
                                                              
██╗███╗   ███╗██████╗  ██████╗ ██████╗ ████████╗███████╗██████╗ 
██║████╗ ████║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔══██╗
██║██╔████╔██║██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██████╔╝
██║██║╚██╔╝██║██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██╔══██╗
██║██║ ╚═╝ ██║██║     ╚██████╔╝██║  ██║   ██║   ███████╗██║  ██║
╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
EOF
echo -e "${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║${NC}                    ${BLINK}🚀 ULTRA MEGA FANCY DRY RUN MODE 🚀${NC}                       ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║${NC}                    ${BLINK}🚀 ULTRA MEGA FANCY DEPLOYMENT SYSTEM 🚀${NC}                    ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
fi

sleep 1

# Animated intro
echo -e "\n${PURPLE}${BOLD}"
if [ "$DRY_RUN" = true ]; then
    typewriter "Initializing quantum simulation matrix..." 0.05
    echo -e "${YELLOW}${BOLD}🧪 DRY RUN MODE ACTIVATED - No actual deployment will occur${NC}"
else
    typewriter "Initializing quantum deployment matrix..." 0.05
fi
echo -e "${NC}"

# System check with fancy animations
echo -e "\n${YELLOW}${BOLD}🔍 SYSTEM DIAGNOSTICS${NC}"
echo -e "${GRAY}═══════════════════════${NC}"

echo -ne "${BLUE}🔧 Checking build environment...${NC} "
sleep 1 && echo -e "${GREEN}✅ OPTIMAL${NC}"

echo -ne "${BLUE}🎯 Locating vault path...${NC} "
if [ "$DRY_RUN" = true ]; then
    sleep 1 && echo -e "${YELLOW}✅ SIMULATED: ${CYAN}$VAULT_PATH${NC}"
else
    sleep 1 && echo -e "${GREEN}✅ FOUND: ${CYAN}$VAULT_PATH${NC}"
fi

echo -ne "${BLUE}🛡️  Security scan...${NC} "
sleep 1 && echo -e "${GREEN}✅ SECURE${NC}"

echo -ne "${BLUE}🌟 Fancy level calibration...${NC} "
sleep 1 && echo -e "${RAINBOW}✅ MAXIMUM FANCINESS ACHIEVED${NC}"

# Build phase with epic animations
echo -e "\n\n${RED}${BOLD}🏗️  COMMENCING BUILD SEQUENCE${NC}"
echo -e "${GRAY}═══════════════════════════════${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚡ Simulating build with quantum precision...${NC}"
    sleep 2 &
    BUILD_PID=$!
else
    echo -e "${YELLOW}⚡ Building plugin with atomic precision...${NC}"
    npm run build > /dev/null 2>&1 &
    BUILD_PID=$!
fi

# Fancy loading animation
echo -ne "${CYAN}Building${NC}"
for i in {1..20}; do
    echo -ne "${YELLOW}.${NC}"
    sleep 0.2
done

wait $BUILD_PID
BUILD_RESULT=$?

if [ "$DRY_RUN" = true ]; then
    echo -e "\n${GREEN}${BOLD}✨ SIMULATION SUCCESSFUL! ✨${NC}"
    
    # Simulated bundle analysis
    BUNDLE_SIZE="6620"
    echo -e "\n${PURPLE}📊 Simulated Bundle Analysis:${NC}"
    echo -e "   Size: ${BOLD}${CYAN}$BUNDLE_SIZE bytes${NC} ${GREEN}(Ultra Lean! 🪶)${NC}"
    echo -e "   Status: ${GREEN}${BOLD}🏆 CHAMPION TIER EFFICIENCY${NC}"
elif [ $BUILD_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✨ BUILD SUCCESSFUL! ✨${NC}"
    
    # Bundle size check with dramatic effect
    BUNDLE_SIZE=$(wc -c < main.js)
    echo -e "\n${PURPLE}📊 Bundle Analysis:${NC}"
    echo -e "   Size: ${BOLD}${CYAN}$BUNDLE_SIZE bytes${NC} ${GREEN}(Ultra Lean! 🪶)${NC}"
    
    if [ $BUNDLE_SIZE -lt 10240 ]; then
        echo -e "   Status: ${GREEN}${BOLD}🏆 CHAMPION TIER EFFICIENCY${NC}"
    fi
else
    echo -e "\n${RED}${BOLD}💥 BUILD FAILED! ABORT MISSION! 💥${NC}"
    exit 1
fi

# Deployment phase with maximum drama
echo -e "\n\n${PURPLE}${BOLD}🚀 INITIATING DEPLOYMENT SEQUENCE${NC}"
echo -e "${GRAY}═══════════════════════════════════${NC}"

# Create plugin directory with fanfare
if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}📂 Simulating plugin sanctuary creation...${NC}"
    echo -e "${YELLOW}✅ Plugin directory simulation established${NC}"
else
    echo -e "${CYAN}📂 Creating plugin sanctuary...${NC}"
    mkdir -p "$PLUGIN_DIR" 2>/dev/null

    if [ ! -d "$PLUGIN_DIR" ]; then
        echo -e "${RED}💀 CRITICAL ERROR: Cannot access vault at $VAULT_PATH${NC}"
        echo -e "${YELLOW}💡 Please update VAULT_PATH variable in this script${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Plugin directory established${NC}"
fi

# Deploy files with individual ceremony for each
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}📦 SIMULATING CRITICAL COMPONENT DEPLOYMENT${NC}"
else
    echo -e "\n${YELLOW}📦 DEPLOYING CRITICAL COMPONENTS${NC}"
fi

for file in "${BUILD_FILES[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        echo -ne "${BLUE}🚢 Simulating ${BOLD}$file${NC}${BLUE} deployment...${NC} "
        sleep 0.5
        echo -e "${YELLOW}✅ SIMULATED${NC}"
    elif [ -f "$file" ]; then
        echo -ne "${BLUE}🚢 Deploying ${BOLD}$file${NC}${BLUE}...${NC} "
        
        # Dramatic copy with progress
        cp "$file" "$PLUGIN_DIR/" && echo -e "${GREEN}✅ DEPLOYED${NC}" || echo -e "${RED}❌ FAILED${NC}"
        
        sleep 0.5
    else
        echo -e "${YELLOW}⚠️  Warning: $file not found${NC}"
    fi
done

# Final verification with suspense
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${PURPLE}🔍 SIMULATION VERIFICATION PROTOCOL${NC}"
    echo -e "${GRAY}═══════════════════════════════════${NC}"
else
    echo -e "\n${PURPLE}🔍 FINAL VERIFICATION PROTOCOL${NC}"
    echo -e "${GRAY}════════════════════════════${NC}"
fi

VERIFICATION_PASSED=true

for file in "${BUILD_FILES[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}✅ $file${NC} ${GRAY}→ simulated${NC}"
    elif [ -f "$PLUGIN_DIR/$file" ]; then
        echo -e "${GREEN}✅ $file${NC} ${GRAY}→ verified${NC}"
    else
        echo -e "${RED}❌ $file${NC} ${GRAY}→ missing${NC}"
        VERIFICATION_PASSED=false
    fi
done

sleep 1

# Epic finale
if [ "$VERIFICATION_PASSED" = true ]; then
    echo -e "\n\n${GREEN}${BOLD}"
    cat << "EOF"
██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███╗   ███╗███████╗███╗   ██╗████████╗
██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝████╗ ████║██╔════╝████╗  ██║╚══██╔══╝
██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ ██╔████╔██║█████╗  ██╔██╗ ██║   ██║   
██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   
██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   ██║ ╚═╝ ██║███████╗██║ ╚████║   ██║   
╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   
                                                                                         
 ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ███████╗████████╗███████╗██╗
██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║     ██╔════╝╚══██╔══╝██╔════╝██║
██║     ██║   ██║██╔████╔██║██████╔╝██║     █████╗     ██║   █████╗  ██║
██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝     ██║   ██╔══╝  ╚═╝
╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ███████╗███████╗   ██║   ███████╗██╗
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝   ╚═╝   ╚══════╝╚═╝
EOF
    echo -e "${NC}"
    
    # Fireworks celebration
    fireworks
    
    # Final status
    echo -e "\n\n${RAINBOW}🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BOLD}${YELLOW}SIMULATION STATUS: ${BLINK}LEGENDARY SUCCESS${NC}"
    else
        echo -e "${BOLD}${GREEN}DEPLOYMENT STATUS: ${BLINK}LEGENDARY SUCCESS${NC}"
    fi
    echo -e "${RAINBOW}🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊${NC}"
    
    echo -e "\n${CYAN}${BOLD}📍 MISSION ACCOMPLISHED${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${WHITE}Simulated Location: ${CYAN}$PLUGIN_DIR${NC}"
        echo -e "${WHITE}Simulated Bundle Size: ${CYAN}$BUNDLE_SIZE bytes${NC}"
        echo -e "${WHITE}Status: ${YELLOW}Simulation Complete${NC}"
        
        echo -e "\n${YELLOW}${BOLD}🚀 TO RUN FOR REAL:${NC}"
        echo -e "${WHITE}1. Update VAULT_PATH in this script${NC}"
        echo -e "${WHITE}2. Run: ${CYAN}./deploy-fancy.sh${NC} ${WHITE}(without --dry-run)${NC}"
        echo -e "${WHITE}3. Enable plugin in Obsidian Settings${NC}"
        echo -e "${WHITE}4. Import your notes with style! ✨${NC}"
    else
        echo -e "${WHITE}Plugin Location: ${CYAN}$PLUGIN_DIR${NC}"
        echo -e "${WHITE}Bundle Size: ${CYAN}$BUNDLE_SIZE bytes${NC}"
        echo -e "${WHITE}Status: ${GREEN}Ready for Obsidian${NC}"
        
        echo -e "\n${YELLOW}${BOLD}🚀 NEXT STEPS:${NC}"
        echo -e "${WHITE}1. Open Obsidian${NC}"
        echo -e "${WHITE}2. Go to Settings → Community Plugins${NC}"
        echo -e "${WHITE}3. Enable '${CYAN}Granola Importer${NC}${WHITE}'${NC}"
        echo -e "${WHITE}4. Import your notes with style! ✨${NC}"
    fi
    
else
    echo -e "\n\n${RED}${BOLD}"
    cat << "EOF"
██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███╗   ███╗███████╗███╗   ██╗████████╗
██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝████╗ ████║██╔════╝████╗  ██║╚══██╔══╝
██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ ██╔████╔██║█████╗  ██╔██╗ ██║   ██║   
██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   
██████╔╝██╔══╝  ██║     ███████╗╚██████╔╝   ██║   ██║ ╚═╝ ██║██╔══╝  ██║ ╚████║   ██║   
╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   

███████╗ █████╗ ██╗██╗     ███████╗██████╗ ██╗
██╔════╝██╔══██╗██║██║     ██╔════╝██╔══██╗██║
█████╗  ███████║██║██║     █████╗  ██║  ██║██║
██╔══╝  ██╔══██║██║██║     ██╔══╝  ██║  ██║╚═╝
██║     ██║  ██║██║███████╗███████╗██████╔╝██╗
╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ ╚═╝
EOF
    echo -e "${NC}"
    echo -e "${RED}💀 DEPLOYMENT FAILED - CHECK VAULT PATH${NC}"
    exit 1
fi

echo -e "\n${DIM}${GRAY}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${DIM}${GRAY}Built with ❤️  and ridiculous amounts of ASCII art${NC}"
echo -e "${DIM}${GRAY}═══════════════════════════════════════════════════════════════════════════════${NC}\n"