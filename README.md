# ArchStore - Modern Package Manager GUI for Arch Linux

A beautiful, modern desktop application for managing packages on Arch Linux. Built with Tauri, Rust, and JavaScript.

![ArchStore](arch-icon.png)

## Features

- 🔍 **Unified Search** - Search across official repositories, AUR, and Flatpak simultaneously
- 📦 **Multiple Sources** - Install packages from official repos, AUR (via yay/paru), and Flatpak
- 🎨 **Modern UI** - Clean, intuitive interface with dark theme
- 🔄 **System Updates** - Check and install updates for all package sources
- 📊 **Package Details** - View detailed information about packages before installing
- 🏷️ **Categories** - Browse popular applications by category
- ⚡ **Fast & Native** - Built with Tauri for minimal resource usage
- 🔐 **Secure Password Handling** - Custom password prompt for privileged operations

## Screenshots

Browse popular applications organized by category, search across all package sources, and manage installations with real-time progress tracking.

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
git clone https://github.com/yourusername/archstore.git
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

### Package Sources

- **Official Repositories**: Uses `pacman` to search and install packages from core, extra, and multilib repos
- **AUR**: Uses `yay` or `paru` to search and build packages from the Arch User Repository
- **Flatpak**: Uses `flatpak` to search and install applications from Flathub

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
