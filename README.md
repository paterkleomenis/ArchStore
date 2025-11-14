# ArchStore - Modern Package Manager GUI for Arch Linux

A beautiful, modern desktop application for managing packages on Arch Linux. Built with Tauri, Rust, and JavaScript.

![ArchStore](arch-icon.png)

## Features

- 🔍 **Unified Search** - Search across official repositories, AUR, and Flatpak simultaneously
- 📦 **Multiple Sources** - Install packages from official repos, AUR (via yay/paru), and Flatpak
- 🎨 **Modern UI** - Clean, intuitive interface with dark theme
- 🔄 **System Updates** - Check and install updates with individual package selection
- 📺 **Live Terminal Output** - Real-time terminal window shows exactly what's happening during installations and updates with color-coded output
- 📊 **Package Details** - View detailed information about packages before installing
- 🏷️ **Categories** - Browse popular applications by category
- ⚡ **Fast & Native** - Built with Tauri for minimal resource usage
- 🔐 **Secure Password Handling** - Custom password prompt for privileged operations

## Installation

### Prerequisites

- Arch Linux (or Arch-based distribution)
- Node.js and npm
- Rust and Cargo
- AUR helper (yay or paru) - optional but recommended
- Flatpak - optional for Flatpak support

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/paterkleomenis/archstore.git
cd archstore/archstore-native
```

2. Install dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run tauri build
```

4. The compiled binary will be in `src-tauri/target/release/`

### Development

Run the app in development mode:
```bash
npm run tauri dev
```

## Usage

### Search Packages

Simply type in the search bar to find packages across all enabled sources (official repos, AUR, Flatpak).

### Install Packages

1. Search for a package
2. Click on the package to view details
3. Choose your preferred source (official, AUR, or Flatpak)
4. Click "Install" and enter your sudo password when prompted

### Update System

1. Click the settings icon (gear) in the top right
2. Click "Check for Updates"
3. Review available updates
4. Click "Update All Packages" to install all updates

### Browse Categories

On the home screen, browse popular applications organized by:
- Web Browsers
- Development Tools
- Graphics & Design
- Gaming
- Multimedia
- Office
- Internet
- System Tools

## How It Works

### System Updates

ArchStore provides flexible update management with real-time feedback:

#### Update Options

- **Individual Package Selection** - Choose exactly which packages to update using checkboxes
- **Organized by Source** - Updates are grouped by Official, AUR, and Flatpak for easy review
- **Check All / Uncheck All** - Quickly toggle all packages (all checked by default)
- **Update Selected** - Single button updates only the packages you've checked

#### Update Display

When you click "Check for Updates" in Settings, the app:

1. Shows total number of available updates
2. Lists all packages organized by source (Official, AUR, Flatpak)
3. Each package has its own checkbox (all checked by default)
4. Shows package name, version, source badge, and description
5. Simply uncheck specific packages you don't want to update
6. Use "Check All" / "Uncheck All" to quickly toggle all packages
7. Click "Update Selected" to update only the checked packages

#### Real-time Terminal Output

**Immediate Feedback:** As soon as you enter your password and press Enter, a professional terminal window appears showing live output from package operations.

The terminal features:

- **Authentic Terminal Look** - macOS-style window with colored buttons, monospace font, and blinking cursor
- **Timestamped Output** - Every line shows exactly when it occurred `[HH:MM:SS]`
- **Color-Coded Messages**:
  - 🟣 **Purple** - Section headers and progress indicators (::)
  - 🔵 **Blue** - Downloads, fetching, and network operations
  - 🟢 **Green** - Success messages, completions (✓)
  - 🟡 **Yellow** - Warnings and notices
  - 🔴 **Red** - Errors and failures (✗)
  - 🔷 **Cyan** - Package counts and statistics
- **Live Streaming** - See each command's output as it happens:
  - Package downloads with progress
  - Dependency resolution
  - Build output from AUR packages
  - Installation/upgrade operations
- **Progress Tracking** - Visual progress bar + package counter (e.g., `[5/20]`)
- **Smooth Animations** - Terminal lines fade in smoothly, cursor blinks
- **Custom Scrollbar** - Terminal-styled scrollbar for navigation
- **Package-by-Package Updates** - Each selected package shows:
  - Start message with source
  - Live output during installation
  - Success/failure status with checkmark/cross
  
**Example Terminal Output:**
```
============================================================
  UPDATING 3 PACKAGE(S)
============================================================

:: Selected 3 package(s) for update:
   - Official: 2 package(s)
   - AUR: 1 package(s)

[14:32:15] :: Updating 2 official package(s)...

[14:32:16] [1/3] Updating linux from official repositories...
[14:32:17] downloading linux-6.7.4-arch1...
[14:32:20] upgrading linux...
[14:32:25] ✓ Successfully updated linux

[14:32:26] [2/3] Updating firefox from official repositories...
[14:32:27] downloading firefox-122.0-1...
[14:32:30] ✓ Successfully updated firefox

[14:32:31] :: Updating 1 AUR package(s)...

[14:32:32] [3/3] Updating yay from AUR...
[14:32:33] ==> Making package: yay 12.2.0-1
[14:32:45] ✓ Successfully updated yay

============================================================
:: Update complete! 3 package(s) processed.
============================================================
```

This transparency helps you understand what's being updated, catch any issues immediately, and see exactly what commands are running on your system.

**Example Use Cases:**
- Skip updating a specific kernel version while updating everything else
- Update only security packages from official repos
- Try AUR updates one at a time to test stability
- Update all Flatpak apps except one that has issues

### Package Sources & System Detection

- **Official Repositories**: Uses `pacman` to search and install packages from core, extra, and multilib repos
- **AUR**: Uses `yay` or `paru` to search and build packages from the Arch User Repository
  - Automatically detected - checkbox disabled if neither `yay` nor `paru` is installed
- **Flatpak**: Uses `flatpak` to search and install applications from Flathub
  - Automatically detected - checkbox disabled if `flatpak` is not installed
- **Multilib**: 32-bit package support on 64-bit systems
  - Automatically detected - checkbox reflects current `/etc/pacman.conf` status

The settings modal automatically checks your system and disables package sources that aren't available, guiding you to install the necessary tools (like `yay`, `paru`, or `flatpak`) before enabling those sources.

### Password Handling

Instead of relying on polkit, ArchStore uses a custom password prompt:
- Password is requested once before privileged operations
- For AUR packages: Pre-authenticates sudo, then runs the AUR helper as regular user
- This solves the "cannot run as root" issue with AUR helpers
- Password is never stored and is immediately discarded after use

### Architecture

- **Frontend**: Vite + JavaScript for the UI
- **Backend**: Rust (Tauri) for system operations
- **IPC**: Tauri's secure inter-process communication
- **Package Detection**: Parses output from pacman, yay/paru, and flatpak commands

## Configuration

Settings are stored locally and include:
- Enable/disable AUR support
- Enable/disable Flatpak support
- Multilib repository support

## Project Structure

```
archstore-native/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # Tauri commands (search, install, remove, etc.)
│   │   ├── parsers/     # Output parsers for pacman, AUR, flatpak
│   │   ├── models.rs    # Data structures
│   │   └── main.rs      # Entry point
│   └── Cargo.toml
├── index.html           # Main HTML file
├── main.js              # Frontend logic
├── package.json
└── vite.config.js
```

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---
