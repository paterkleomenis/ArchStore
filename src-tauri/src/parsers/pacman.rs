use crate::models::Package;

// Parse pacman search output
pub fn parse_pacman_search(output: &str) -> Vec<Package> {
    let mut packages = Vec::new();
    let lines: Vec<&str> = output.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        if line.starts_with("    ") || line.is_empty() {
            i += 1;
            continue;
        }

        // First line: repo/name version [installed]
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            i += 1;
            continue;
        }

        let name_part = parts[0].split('/').last().unwrap_or(parts[0]);
        let version = parts.get(1).unwrap_or(&"").to_string();
        let installed = line.to_lowercase().contains("[installed]");

        // Second line: description
        let description = if i + 1 < lines.len() && lines[i + 1].starts_with("    ") {
            i += 1;
            lines[i].trim().to_string()
        } else {
            String::new()
        };

        packages.push(Package {
            name: name_part.to_string(),
            version,
            description,
            source: "official".to_string(),
            installed,
            category: String::new(),
            downloads: 0,
            rating: 0.0,
            maintainer: String::new(),
            size: String::new(),
            last_updated: String::new(),
        });

        i += 1;
    }

    packages
}

// Parse package info output
pub fn parse_package_info(output: &str) -> Result<Package, String> {
    let mut name = String::new();
    let mut version = String::new();
    let mut description = String::new();
    let mut size = String::new();

    for line in output.lines() {
        if line.starts_with("Name") {
            name = line.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if line.starts_with("Version") {
            version = line.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if line.starts_with("Description") {
            description = line.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if line.starts_with("Installed Size") || line.starts_with("Download Size") {
            size = line.split(':').nth(1).unwrap_or("").trim().to_string();
        }
    }

    Ok(Package {
        name,
        version,
        description,
        source: "official".to_string(),
        installed: false,
        category: String::new(),
        downloads: 0,
        rating: 0.0,
        maintainer: String::new(),
        size,
        last_updated: String::new(),
    })
}
