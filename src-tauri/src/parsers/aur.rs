use crate::models::Package;

// Parse AUR search output
pub fn parse_aur_search(output: &str) -> Vec<Package> {
    let mut packages = Vec::new();
    let lines: Vec<&str> = output.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        if line.starts_with("    ") || line.is_empty() {
            i += 1;
            continue;
        }

        // First line: aur/name version [installed]
        // Only parse lines that start with "aur/" to filter out official repo packages
        if !line.starts_with("aur/") {
            i += 1;
            continue;
        }

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
            source: "aur".to_string(),
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
