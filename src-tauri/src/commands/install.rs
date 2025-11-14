use crate::models::InstallProgress;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;

// Install package
#[tauri::command]
pub async fn install_package(
    package_name: String,
    source: String,
    password: String,
    window: tauri::Window,
) -> Result<(), String> {
    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "install-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    emit_progress(
        10,
        format!("Starting installation of {}...", package_name),
        false,
    );

    let result = match source.as_str() {
        "official" => {
            emit_progress(
                30,
                "Installing from official repositories...".to_string(),
                false,
            );
            use std::io::Write;
            use std::thread;

            let mut child = Command::new("sudo")
                .arg("-S")
                .args(&["pacman", "-S", "--noconfirm", &package_name])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn sudo: {}", e))?;

            if let Some(mut stdin) = child.stdin.take() {
                writeln!(stdin, "{}", password)
                    .map_err(|e| format!("Failed to write password: {}", e))?;
            }

            // Stream both stdout and stderr in real-time using separate threads
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() && !line.contains("[sudo] password") {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            child.wait_with_output()
        }
        "aur" => {
            emit_progress(30, "Installing from AUR...".to_string(), false);
            // Detect available AUR helper
            let helper = if Command::new("yay").arg("--version").output().is_ok() {
                "yay"
            } else if Command::new("paru").arg("--version").output().is_ok() {
                "paru"
            } else {
                emit_progress(
                    0,
                    "No AUR helper found. Please install yay or paru.".to_string(),
                    true,
                );
                return Err("No AUR helper found. Please install yay or paru.".to_string());
            };
            emit_progress(
                40,
                format!("Using {} to install {}...", helper, package_name),
                false,
            );

            // Create a wrapper script that handles password input for sudo
            // First authenticate sudo, then run AUR helper as regular user
            let script_content = format!(
                r#"#!/bin/bash
echo '{}' | sudo -S -v
{} -S --noconfirm {}
"#,
                password, helper, package_name
            );

            // Write script to temporary file
            let script_path = format!(
                "/tmp/archstore_install_{}.sh",
                package_name.replace("/", "_")
            );
            std::fs::write(&script_path, script_content)
                .map_err(|e| format!("Failed to write temp script: {}", e))?;

            // Make script executable
            Command::new("chmod")
                .args(&["+x", &script_path])
                .output()
                .map_err(|e| format!("Failed to make script executable: {}", e))?;

            // Execute the script with real-time streaming
            use std::thread;

            let mut child = Command::new(&script_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn AUR helper: {}", e))?;

            // Stream both stdout and stderr in real-time
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 60,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() && !line.contains("[sudo] password") {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 60,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            let result = child.wait_with_output();

            // Clean up script
            let _ = std::fs::remove_file(&script_path);

            result
        }
        "flatpak" => {
            emit_progress(30, "Installing from Flatpak...".to_string(), false);
            use std::thread;

            let mut child = Command::new("flatpak")
                .args(&["install", "-y", &package_name])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn flatpak: {}", e))?;

            // Stream both stdout and stderr in real-time
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "install-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            child.wait_with_output()
        }
        _ => return Err("Unknown package source".to_string()),
    };

    match result {
        Ok(output) => {
            if output.status.success() {
                emit_progress(
                    100,
                    "Installation completed successfully!".to_string(),
                    true,
                );
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let error_msg = if !stderr.is_empty() {
                    stderr.to_string()
                } else if !stdout.is_empty() {
                    stdout.to_string()
                } else {
                    "Installation failed with unknown error".to_string()
                };
                emit_progress(0, format!("Installation failed: {}", error_msg), true);
                Err(format!("Installation failed: {}", error_msg))
            }
        }
        Err(e) => {
            let error_msg = format!("Failed to execute installer: {} ({})", e, source);
            emit_progress(0, error_msg.clone(), true);
            Err(error_msg)
        }
    }
}

// Remove package
#[tauri::command]
pub async fn remove_package(
    package_name: String,
    source: String,
    remove_mode: String,
    password: String,
    window: tauri::Window,
) -> Result<(), String> {
    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "remove-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    emit_progress(
        10,
        format!("Starting removal of {}...", package_name),
        false,
    );

    let result = match source.as_str() {
        "official" => {
            emit_progress(
                30,
                "Removing from official repositories...".to_string(),
                false,
            );
            use std::io::Write;
            use std::process::Stdio;
            use std::thread;

            let args = if remove_mode == "recursive" {
                vec!["pacman", "-Rns", "--noconfirm", &package_name]
            } else {
                vec!["pacman", "-R", "--noconfirm", &package_name]
            };

            let mut child = Command::new("sudo")
                .arg("-S")
                .args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn sudo: {}", e))?;

            if let Some(mut stdin) = child.stdin.take() {
                writeln!(stdin, "{}", password)
                    .map_err(|e| format!("Failed to write password: {}", e))?;
            }

            // Stream both stdout and stderr in real-time
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() && !line.contains("[sudo] password") {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            child.wait_with_output()
        }
        "aur" => {
            emit_progress(30, "Removing AUR package...".to_string(), false);
            use std::io::Write;
            use std::process::Stdio;
            use std::thread;

            // AUR packages are removed using pacman with sudo for permissions
            let args = if remove_mode == "recursive" {
                vec!["pacman", "-Rns", "--noconfirm", &package_name]
            } else {
                vec!["pacman", "-R", "--noconfirm", &package_name]
            };

            let mut child = Command::new("sudo")
                .arg("-S")
                .args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn sudo: {}", e))?;

            if let Some(mut stdin) = child.stdin.take() {
                writeln!(stdin, "{}", password)
                    .map_err(|e| format!("Failed to write password: {}", e))?;
            }

            // Stream both stdout and stderr in real-time
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() && !line.contains("[sudo] password") {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            child.wait_with_output()
        }
        "flatpak" => {
            emit_progress(30, "Removing Flatpak package...".to_string(), false);
            use std::thread;

            let mut child = Command::new("flatpak")
                .args(&["uninstall", "-y", &package_name])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn flatpak: {}", e))?;

            // Stream both stdout and stderr in real-time
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let window_clone = window.clone();
            let stdout_handle = stdout.map(|stdout| {
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            let window_clone = window.clone();
            let stderr_handle = stderr.map(|stderr| {
                thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if !line.trim().is_empty() {
                                let _ = window_clone.emit(
                                    "remove-progress",
                                    InstallProgress {
                                        percentage: 50,
                                        message: line,
                                        completed: false,
                                    },
                                );
                            }
                        }
                    }
                })
            });

            // Wait for streaming threads to complete
            if let Some(handle) = stdout_handle {
                let _ = handle.join();
            }
            if let Some(handle) = stderr_handle {
                let _ = handle.join();
            }

            child.wait_with_output()
        }
        _ => return Err("Unknown package source".to_string()),
    };

    match result {
        Ok(output) => {
            if output.status.success() {
                emit_progress(100, "Removal completed successfully!".to_string(), true);
                Ok(())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                emit_progress(0, format!("Removal failed: {}", error), true);
                Err(format!("Removal failed: {}", error))
            }
        }
        Err(e) => {
            emit_progress(0, format!("Failed to execute removal: {}", e), true);
            Err(format!("Failed to execute removal: {}", e))
        }
    }
}
