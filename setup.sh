#!/bin/bash

# ArchStore Setup Script
# This script helps set up the development environment and build the application

set -e

echo "======================================"
echo "  ArchStore Setup"
echo "======================================"
echo ""

# Check if running on Arch Linux
if [ ! -f /etc/arch-release ]; then
    echo "⚠️  Warning: This application is designed for Arch Linux"
    echo "   It may not work correctly on other distributions"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for required dependencies
echo "Checking dependencies..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Install it with: sudo pacman -S nodejs npm"
    exit 1
else
    echo "✅ Node.js $(node --version)"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    echo "   Install it with: sudo pacman -S npm"
    exit 1
else
    echo "✅ npm $(npm --version)"
fi

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed"
    echo "   Install it with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
else
    echo "✅ Rust $(rustc --version)"
fi

# Check for pacman
if ! command -v pacman &> /dev/null; then
    echo "❌ pacman is not installed (required)"
    exit 1
else
    echo "✅ pacman"
fi

# Check for AUR helper (optional)
if command -v yay &> /dev/null; then
    echo "✅ yay (AUR helper)"
elif command -v paru &> /dev/null; then
    echo "✅ paru (AUR helper)"
else
    echo "⚠️  No AUR helper found (yay or paru)"
    echo "   AUR support will be disabled"
    echo "   Install yay: git clone https://aur.archlinux.org/yay.git && cd yay && makepkg -si"
fi

# Check for flatpak (optional)
if command -v flatpak &> /dev/null; then
    echo "✅ flatpak"
else
    echo "⚠️  flatpak not found (optional)"
    echo "   Flatpak support will be disabled"
    echo "   Install it with: sudo pacman -S flatpak"
fi

echo ""
echo "Installing npm dependencies..."
npm install

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Available commands:"
echo "  npm run tauri dev    - Run in development mode"
echo "  npm run tauri build  - Build production binary"
echo ""
echo "The production binary will be located in:"
echo "  src-tauri/target/release/archstore"
echo ""
echo "Enjoy using ArchStore! 🎉"
