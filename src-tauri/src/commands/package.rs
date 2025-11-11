use crate::models::Package;
use crate::parsers::parse_package_info;
use std::path::PathBuf;
use std::process::Command;

// Get package details
#[tauri::command]
pub async fn get_package_info(package_name: String, source: String) -> Result<Package, String> {
    let output = match source.as_str() {
        "official" => Command::new("pacman")
            .args(&["-Si", &package_name])
            .output()
            .map_err(|e| e.to_string())?,
        "aur" => {
            // Try yay first, fall back to paru
            let helper = if Command::new("yay").arg("--version").output().is_ok() {
                "yay"
            } else if Command::new("paru").arg("--version").output().is_ok() {
                "paru"
            } else {
                return Err("No AUR helper found. Please install yay or paru.".to_string());
            };

            Command::new(helper)
                .args(&["-Si", &package_name])
                .output()
                .map_err(|e| e.to_string())?
        }
        "flatpak" => Command::new("flatpak")
            .args(&["info", &package_name])
            .output()
            .map_err(|e| e.to_string())?,
        _ => return Err("Unknown package source".to_string()),
    };

    if !output.status.success() {
        return Err("Failed to get package info".to_string());
    }

    let result = String::from_utf8_lossy(&output.stdout);
    let mut package = parse_package_info(&result)?;

    // Check if package is installed
    package.installed = match source.as_str() {
        "official" => {
            if let Ok(check) = Command::new("pacman")
                .args(&["-Qs", &format!("^{}$", package_name)])
                .output()
            {
                check.status.success()
            } else {
                false
            }
        }
        "aur" => {
            // Use AUR helper -Ss to check if package is from AUR and installed
            // We need to verify it's actually from aur/ not extra/ or other repos
            let helper = if Command::new("yay").arg("--version").output().is_ok() {
                "yay"
            } else if Command::new("paru").arg("--version").output().is_ok() {
                "paru"
            } else {
                return Ok(package);
            };

            if let Ok(check) = Command::new(helper).args(&["-Ss", &package_name]).output() {
                if check.status.success() {
                    let output_str = String::from_utf8_lossy(&check.stdout);
                    // Look for lines starting with "aur/" and containing the package name
                    output_str.lines().any(|line| {
                        line.starts_with(&format!("aur/{}", package_name))
                            && line.to_lowercase().contains("[installed]")
                    })
                } else {
                    false
                }
            } else {
                false
            }
        }
        "flatpak" => {
            if let Ok(check) = Command::new("flatpak").args(&["list", "--app"]).output() {
                if check.status.success() {
                    let installed = String::from_utf8_lossy(&check.stdout);
                    installed.lines().any(|line| line.contains(&package_name))
                } else {
                    false
                }
            } else {
                false
            }
        }
        _ => false,
    };

    Ok(package)
}

// Get app icon path from system
#[tauri::command]
pub async fn get_app_icon(app_name: String) -> Result<String, String> {
    let home_dir = std::env::var("HOME").unwrap_or_default();

    // Build comprehensive list of icon directories in order of preference (larger sizes first)
    let mut icon_dirs: Vec<PathBuf> = vec![
        // Standard system icon directories
        PathBuf::from("/usr/share/pixmaps"),
        PathBuf::from("/usr/share/icons/hicolor/scalable/apps"),
        PathBuf::from("/usr/share/icons/hicolor/256x256/apps"),
        PathBuf::from("/usr/share/icons/hicolor/128x128/apps"),
        PathBuf::from("/usr/share/icons/hicolor/96x96/apps"),
        PathBuf::from("/usr/share/icons/hicolor/64x64/apps"),
        PathBuf::from("/usr/share/icons/hicolor/48x48/apps"),
        PathBuf::from("/usr/share/icons/hicolor/32x32/apps"),
        // Additional theme paths
        PathBuf::from("/usr/share/icons/Adwaita/256x256/apps"),
        PathBuf::from("/usr/share/icons/Adwaita/128x128/apps"),
        PathBuf::from("/usr/share/icons/Adwaita/96x96/apps"),
        PathBuf::from("/usr/share/icons/Adwaita/64x64/apps"),
        PathBuf::from("/usr/share/icons/Adwaita/48x48/apps"),
        PathBuf::from("/usr/share/icons/breeze/apps/256"),
        PathBuf::from("/usr/share/icons/breeze/apps/128"),
        PathBuf::from("/usr/share/icons/breeze/apps/64"),
        PathBuf::from("/usr/share/icons/breeze/apps/48"),
    ];

    // Add user-local icon directories
    if !home_dir.is_empty() {
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/scalable/apps"
        )));
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/256x256/apps"
        )));
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/128x128/apps"
        )));
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/96x96/apps"
        )));
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/64x64/apps"
        )));
        icon_dirs.push(PathBuf::from(format!(
            "{home_dir}/.local/share/icons/hicolor/48x48/apps"
        )));
        icon_dirs.push(PathBuf::from(format!("{home_dir}/.icons")));
        icon_dirs.push(PathBuf::from(format!("{home_dir}/.local/share/pixmaps")));
    }

    // File extensions to try
    let possible_extensions = vec!["svg", "png", "xpm", "jpg", "jpeg"];

    // Generate name variations to search
    let mut name_variations = vec![app_name.clone()];

    // Add common name transformations
    if app_name.contains("-bin") {
        name_variations.push(app_name.replace("-bin", ""));
    }
    if app_name.contains("-desktop") {
        name_variations.push(app_name.replace("-desktop", ""));
    }
    if app_name.contains("_") {
        name_variations.push(app_name.replace("_", "-"));
    }
    if app_name.contains("-") {
        name_variations.push(app_name.replace("-", "_"));
    }

    // Special case mappings for common apps
    match app_name.as_str() {
        "code" => {
            name_variations.push("vscode".to_string());
            name_variations.push("visual-studio-code".to_string());
            name_variations.push("com.visualstudio.code".to_string());
        }
        "brave-bin" => {
            name_variations.push("brave".to_string());
            name_variations.push("brave-browser".to_string());
        }
        "obs-studio" => {
            name_variations.push("obs".to_string());
            name_variations.push("com.obsproject.Studio".to_string());
        }
        "libreoffice-fresh" | "libreoffice-still" => {
            name_variations.push("libreoffice".to_string());
            name_variations.push("libreoffice-startcenter".to_string());
        }
        "telegram-desktop" => {
            name_variations.push("telegram".to_string());
        }
        "slack-desktop" => {
            name_variations.push("slack".to_string());
        }
        _ => {}
    }

    // Search for icon in all directories with all name variations
    for dir in &icon_dirs {
        if !dir.exists() {
            continue;
        }

        for name in &name_variations {
            for ext in &possible_extensions {
                let icon_path = dir.join(format!("{}.{}", name, ext));
                if icon_path.exists() {
                    return Ok(icon_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Return empty if not found
    Ok(String::new())
}
