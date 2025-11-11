use crate::models::Package;
use crate::parsers::{parse_aur_search, parse_flatpak_search, parse_pacman_search};
use std::process::Command;

// Search packages from official repos using pacman
#[tauri::command]
pub async fn search_official_packages(query: String) -> Result<Vec<Package>, String> {
    let output = Command::new("pacman")
        .args(&["-Ss", &query])
        .output()
        .map_err(|e| format!("Failed to execute pacman: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let result = String::from_utf8_lossy(&output.stdout);
    let mut packages = parse_pacman_search(&result);

    // Get installed packages to mark them
    if let Ok(installed_output) = Command::new("pacman").args(&["-Q"]).output() {
        if installed_output.status.success() {
            let installed_result = String::from_utf8_lossy(&installed_output.stdout);
            let installed_names: Vec<&str> = installed_result
                .lines()
                .filter_map(|line| line.split_whitespace().next())
                .collect();

            for pkg in &mut packages {
                if installed_names.contains(&pkg.name.as_str()) {
                    pkg.installed = true;
                }
            }
        }
    }

    Ok(packages)
}

// Search AUR packages using yay or paru
#[tauri::command]
pub async fn search_aur_packages(query: String) -> Result<Vec<Package>, String> {
    // Try yay first, fall back to paru
    let helper = if Command::new("yay").arg("--version").output().is_ok() {
        "yay"
    } else if Command::new("paru").arg("--version").output().is_ok() {
        "paru"
    } else {
        return Err("No AUR helper found. Please install yay or paru.".to_string());
    };

    let output = Command::new(helper)
        .args(&["-Ss", &query])
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", helper, e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let result = String::from_utf8_lossy(&output.stdout);
    let packages = parse_aur_search(&result);

    Ok(packages)
}

// Search Flatpak packages
#[tauri::command]
pub async fn search_flatpak_packages(query: String) -> Result<Vec<Package>, String> {
    let output = Command::new("flatpak")
        .args(&["search", &query])
        .output()
        .map_err(|e| format!("Failed to execute flatpak: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let result = String::from_utf8_lossy(&output.stdout);
    let mut packages = parse_flatpak_search(&result);

    // Get installed Flatpak packages to mark them
    if let Ok(installed_output) = Command::new("flatpak").args(&["list", "--app"]).output() {
        if installed_output.status.success() {
            let installed_result = String::from_utf8_lossy(&installed_output.stdout);
            let installed_ids: Vec<&str> = installed_result
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 2 {
                        Some(parts[1]) // App ID is in second column
                    } else {
                        None
                    }
                })
                .collect();

            for pkg in &mut packages {
                if installed_ids.contains(&pkg.name.as_str()) {
                    pkg.installed = true;
                }
            }
        }
    }

    Ok(packages)
}

// Get installed packages
#[tauri::command]
pub async fn get_installed_packages() -> Result<Vec<Package>, String> {
    let mut all_packages = Vec::new();

    // Get pacman packages
    if let Ok(output) = Command::new("pacman").args(&["-Q"]).output() {
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            for line in result.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    all_packages.push(Package {
                        name: parts[0].to_string(),
                        version: parts[1].to_string(),
                        description: String::new(),
                        source: "official".to_string(),
                        installed: true,
                        category: String::new(),
                        downloads: 0,
                        rating: 0.0,
                        maintainer: String::new(),
                        size: String::new(),
                        last_updated: String::new(),
                    });
                }
            }
        }
    }

    // Get AUR packages using AUR helper -Qm (lists AUR packages with versions)
    // Detect AUR helper first
    let aur_helper = if Command::new("yay").arg("--version").output().is_ok() {
        Some("yay")
    } else if Command::new("paru").arg("--version").output().is_ok() {
        Some("paru")
    } else {
        None
    };

    if let Some(helper) = aur_helper {
        if let Ok(output) = Command::new(helper).args(&["-Qm"]).output() {
            if output.status.success() {
                let result = String::from_utf8_lossy(&output.stdout);
                for line in result.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        all_packages.push(Package {
                            name: parts[0].to_string(),
                            version: parts[1].to_string(),
                            description: String::new(),
                            source: "aur".to_string(),
                            installed: true,
                            category: String::new(),
                            downloads: 0,
                            rating: 0.0,
                            maintainer: String::new(),
                            size: String::new(),
                            last_updated: String::new(),
                        });
                    }
                }
            }
        }
    }

    // Get Flatpak packages
    if let Ok(output) = Command::new("flatpak").args(&["list", "--app"]).output() {
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            for line in result.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    all_packages.push(Package {
                        name: parts[1].to_string(),
                        version: parts.get(2).unwrap_or(&"").to_string(),
                        description: parts[0].to_string(),
                        source: "flatpak".to_string(),
                        installed: true,
                        category: String::new(),
                        downloads: 0,
                        rating: 0.0,
                        maintainer: String::new(),
                        size: String::new(),
                        last_updated: String::new(),
                    });
                }
            }
        }
    }

    Ok(all_packages)
}
