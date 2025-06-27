#!/bin/bash

# Setup script for git hooks in obsidian-granola project
# Run once after cloning: ./setup-hooks.sh

echo "🔧 Setting up git hooks for obsidian-granola..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Run this script from the project root."
    exit 1
fi

# Check if .githooks directory exists
if [ ! -d ".githooks" ]; then
    echo "❌ .githooks directory not found. Are you in the right project?"
    exit 1
fi

# Configure git to use our custom hooks directory
echo "📁 Configuring git hooks path..."
git config core.hooksPath .githooks

# Make hooks executable
echo "🔑 Making hooks executable..."
chmod +x .githooks/*

# Install dependencies if not present
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

echo "✅ Git hooks setup complete!"
echo ""
echo "📋 What happens now:"
echo "  • Pre-commit hook will run on every commit"
echo "  • Catches formatting, TypeScript, and build issues locally"
echo "  • Saves GitHub Actions minutes by preventing broken pushes"
echo ""
echo "🛠️  Useful commands:"
echo "  npm run format      - Auto-fix formatting issues"
echo "  npm run lint:fix    - Auto-fix linting issues"
echo "  npm run build       - Full production build"
echo ""
echo "💡 To disable hooks temporarily: git commit --no-verify"