pub mod aur;
pub mod flatpak;
pub mod pacman;

pub use aur::parse_aur_search;
pub use flatpak::parse_flatpak_search;
pub use pacman::{parse_package_info, parse_pacman_search};
