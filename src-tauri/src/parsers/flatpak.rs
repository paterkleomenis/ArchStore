use crate::models::Package;

// Parse Flatpak search output
pub fn parse_flatpak_search(output: &str) -> Vec<Package> {
    let mut packages = Vec::new();

    for line in output.lines().skip(1) {
        // Skip header
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let display_name = parts[0].trim();
            let app_id = parts[2].trim();
            let version = parts.get(3).unwrap_or(&"").trim();

            packages.push(Package {
                name: app_id.to_string(),
                version: version.to_string(),
                description: format!("{} - {}", display_name, parts.get(1).unwrap_or(&"").trim()),
                source: "flatpak".to_string(),
                installed: false,
                category: String::new(),
                downloads: 0,
                rating: 0.0,
                maintainer: String::new(),
                size: String::new(),
                last_updated: String::new(),
            });
        }
    }

    packages
}
