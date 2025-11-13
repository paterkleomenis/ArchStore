// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod parsers;

use commands::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            search_official_packages,
            search_aur_packages,
            search_flatpak_packages,
            get_installed_packages,
            install_package,
            remove_package,
            get_package_info,
            update_system,
            check_updates,
            enable_multilib,
            get_app_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
