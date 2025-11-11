pub mod install;
pub mod package;
pub mod search;
pub mod system;

pub use install::{install_package, remove_package};
pub use package::{get_app_icon, get_package_info};
pub use search::{
    get_installed_packages, search_aur_packages, search_flatpak_packages, search_official_packages,
};
pub use system::{check_updates, enable_multilib, update_system};
