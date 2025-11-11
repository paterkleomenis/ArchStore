use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Package {
    pub name: String,
    pub version: String,
    pub description: String,
    pub source: String, // "aur", "flatpak", "official"
    pub installed: bool,
    pub category: String,
    pub downloads: u64,
    pub rating: f32,
    pub maintainer: String,
    pub size: String,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallProgress {
    pub percentage: u32,
    pub message: String,
    pub completed: bool,
}
