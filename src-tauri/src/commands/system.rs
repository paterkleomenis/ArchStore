use crate::models::Package;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tauri::Emitter;

// Check for available updates
#[tauri::command]
pub async fn check_updates() -> Result<Vec<Package>, String> {
    let output = Command::new("checkupdates")
        .output()
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    let mut updates = Vec::new();

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout);
        for line in result.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                updates.push(Package {
                    name: parts[0].to_string(),
                    version: parts[3].to_string(),
                    description: format!("Update available: {} -> {}", parts[1], parts[3]),
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

    // Also check AUR updates if yay/paru is available
    if let Ok(helper) = get_aur_helper() {
        if let Ok(aur_output) = Command::new(helper).args(&["-Qua"]).output() {
            if aur_output.status.success() {
                let result = String::from_utf8_lossy(&aur_output.stdout);
                for line in result.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        updates.push(Package {
                            name: parts[0].to_string(),
                            version: parts[3].to_string(),
                            description: format!(
                                "AUR update available: {} -> {}",
                                parts[1], parts[3]
                            ),
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

    // Check Flatpak updates
    if let Ok(flatpak_output) = Command::new("flatpak")
        .args(&["remote-ls", "--updates", "--app"])
        .output()
    {
        if flatpak_output.status.success() {
            let result = String::from_utf8_lossy(&flatpak_output.stdout);
            for line in result.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    updates.push(Package {
                        name: parts[1].to_string(),
                        version: parts.get(2).unwrap_or(&"").to_string(),
                        description: format!("{} - Update available", parts[0]),
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

    Ok(updates)
}

// Get available AUR helper
fn get_aur_helper() -> Result<&'static str, String> {
    if Command::new("yay").arg("--version").output().is_ok() {
        Ok("yay")
    } else if Command::new("paru").arg("--version").output().is_ok() {
        Ok("paru")
    } else {
        Err("No AUR helper found".to_string())
    }
}

// Update system packages
#[tauri::command]
pub async fn update_system(password: String, window: tauri::Window) -> Result<String, String> {
    use crate::models::InstallProgress;

    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "update-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    emit_progress(10, "Starting system update...".to_string(), false);

    // Update official packages
    emit_progress(20, ":: Updating official packages...".to_string(), false);

    let mut child = Command::new("sudo")
        .arg("-S")
        .args(&["pacman", "-Syu", "--noconfirm"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sudo: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        writeln!(stdin, "{}", password).map_err(|e| format!("Failed to write password: {}", e))?;
    }

    // Stream both stdout and stderr in real-time using separate threads
    use std::thread;

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
                            "update-progress",
                            InstallProgress {
                                percentage: 30,
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
                            "update-progress",
                            InstallProgress {
                                percentage: 30,
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

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update official packages: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        emit_progress(
            0,
            format!("Official packages update failed: {}", error),
            true,
        );
        return Err(error.to_string());
    }

    // Update AUR packages if helper is available
    if let Ok(helper) = get_aur_helper() {
        emit_progress(50, ":: Updating AUR packages...".to_string(), false);

        // Create a wrapper script that handles password input for sudo
        // First authenticate sudo, then run AUR helper as regular user
        let script_content = format!(
            r#"#!/bin/bash
echo '{}' | sudo -S -v
{} -Sua --noconfirm
"#,
            password, helper
        );

        // Write script to temporary file
        let script_path = "/tmp/archstore_update_aur.sh";
        if let Ok(_) = std::fs::write(&script_path, script_content) {
            // Make script executable
            let _ = Command::new("chmod").args(&["+x", script_path]).output();

            // Execute the script with streaming output
            let aur_child = Command::new(script_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn();

            if let Ok(mut child) = aur_child {
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
                                        "update-progress",
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
                                        "update-progress",
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

                let aur_output = child.wait_with_output();
                if let Ok(output) = aur_output {
                    if !output.status.success() {
                        emit_progress(
                            60,
                            "AUR update completed with warnings (continuing...)".to_string(),
                            false,
                        );
                    }
                }
            }

            // Clean up script
            let _ = std::fs::remove_file(&script_path);
        }
    }

    // Update Flatpak packages
    emit_progress(75, ":: Updating Flatpak packages...".to_string(), false);

    let flatpak_child = Command::new("flatpak")
        .args(&["update", "-y"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    if let Ok(mut child) = flatpak_child {
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
                                "update-progress",
                                InstallProgress {
                                    percentage: 85,
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
                                "update-progress",
                                InstallProgress {
                                    percentage: 85,
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

        let flatpak_output = child.wait_with_output();
        if let Ok(output) = flatpak_output {
            if !output.status.success() {
                emit_progress(
                    85,
                    "Flatpak update completed with warnings (continuing...)".to_string(),
                    false,
                );
            }
        }
    }

    emit_progress(100, ":: System updated successfully!".to_string(), true);
    Ok("System updated successfully".to_string())
}

// Enable multilib repository
#[tauri::command]
pub async fn enable_multilib(password: String) -> Result<String, String> {
    println!("Attempting to enable multilib...");

    // Check if multilib is already enabled
    let check = Command::new("grep")
        .args(&["-A1", "^\\[multilib\\]$", "/etc/pacman.conf"])
        .output()
        .map_err(|e| format!("Failed to check pacman.conf: {}", e))?;

    let check_str = String::from_utf8_lossy(&check.stdout);
    if check_str.contains("[multilib]") && check_str.contains("Include") {
        println!("Multilib already enabled");
        return Ok("Multilib is already enabled".to_string());
    }

    println!("Multilib not enabled, proceeding with sed commands...");

    // Use sed to uncomment [multilib] section
    let mut sed1 = Command::new("sudo")
        .arg("-S")
        .args(&["sed", "-i", "/^#\\[multilib\\]/s/^#//", "/etc/pacman.conf"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sed command 1: {}", e))?;

    if let Some(mut stdin) = sed1.stdin.take() {
        writeln!(stdin, "{}", password).map_err(|e| format!("Failed to write password: {}", e))?;
    }

    let output1 = sed1
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for sed 1: {}", e))?;
    println!("Sed 1 exit status: {}", output1.status);
    println!("Sed 1 stderr: {}", String::from_utf8_lossy(&output1.stderr));

    if !output1.status.success() {
        return Err(format!(
            "Failed to uncomment [multilib]: {}",
            String::from_utf8_lossy(&output1.stderr)
        ));
    }

    // Use sed to uncomment Include line after [multilib]
    let mut sed2 = Command::new("sudo")
        .arg("-S")
        .args(&[
            "sed",
            "-i",
            "/^\\[multilib\\]$/,/^#Include/ s/^#Include/Include/",
            "/etc/pacman.conf",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sed command 2: {}", e))?;

    if let Some(mut stdin) = sed2.stdin.take() {
        writeln!(stdin, "{}", password).map_err(|e| format!("Failed to write password: {}", e))?;
    }

    let output2 = sed2
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for sed 2: {}", e))?;
    println!("Sed 2 exit status: {}", output2.status);
    println!("Sed 2 stderr: {}", String::from_utf8_lossy(&output2.stderr));

    if !output2.status.success() {
        return Err(format!(
            "Failed to uncomment Include line: {}",
            String::from_utf8_lossy(&output2.stderr)
        ));
    }

    // Sync package databases
    println!("Running pacman -Sy...");
    let mut sync = Command::new("sudo")
        .arg("-S")
        .args(&["pacman", "-Sy"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sync command: {}", e))?;

    if let Some(mut stdin) = sync.stdin.take() {
        writeln!(stdin, "{}", password).map_err(|e| format!("Failed to write password: {}", e))?;
    }

    let output3 = sync
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for sync: {}", e))?;
    println!("Sync exit status: {}", output3.status);
    println!("Sync stderr: {}", String::from_utf8_lossy(&output3.stderr));

    if !output3.status.success() {
        return Err(format!(
            "Failed to sync databases: {}",
            String::from_utf8_lossy(&output3.stderr)
        ));
    }

    Ok("Multilib enabled and databases synced successfully".to_string())
}

// Update only official packages
#[tauri::command]
pub async fn update_official(password: String, window: tauri::Window) -> Result<String, String> {
    use crate::models::InstallProgress;

    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "update-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    emit_progress(
        10,
        ":: Starting official packages update...".to_string(),
        false,
    );

    let mut child = Command::new("sudo")
        .arg("-S")
        .args(&["pacman", "-Syu", "--noconfirm"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sudo: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        writeln!(stdin, "{}", password).map_err(|e| format!("Failed to write password: {}", e))?;
    }

    // Stream output in real-time
    use std::thread;

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
                            "update-progress",
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
                            "update-progress",
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

    if let Some(handle) = stdout_handle {
        let _ = handle.join();
    }
    if let Some(handle) = stderr_handle {
        let _ = handle.join();
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update official packages: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        emit_progress(
            0,
            format!("Official packages update failed: {}", error),
            true,
        );
        return Err(error.to_string());
    }

    emit_progress(
        100,
        ":: Official packages updated successfully!".to_string(),
        true,
    );
    Ok("Official packages updated successfully".to_string())
}

// Update only AUR packages
#[tauri::command]
pub async fn update_aur(password: String, window: tauri::Window) -> Result<String, String> {
    use crate::models::InstallProgress;

    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "update-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    let helper = get_aur_helper().map_err(|e| format!("No AUR helper found: {}", e))?;

    emit_progress(10, ":: Starting AUR packages update...".to_string(), false);

    // Create a wrapper script that handles password input for sudo
    let script_content = format!(
        r#"#!/bin/bash
echo '{}' | sudo -S -v
{} -Sua --noconfirm
"#,
        password, helper
    );

    let script_path = "/tmp/archstore_update_aur.sh";
    std::fs::write(&script_path, script_content)
        .map_err(|e| format!("Failed to create update script: {}", e))?;

    let _ = Command::new("chmod").args(&["+x", script_path]).output();

    let mut child = Command::new(script_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn AUR update: {}", e))?;

    // Stream output in real-time
    use std::thread;

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
                            "update-progress",
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
                            "update-progress",
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

    if let Some(handle) = stdout_handle {
        let _ = handle.join();
    }
    if let Some(handle) = stderr_handle {
        let _ = handle.join();
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update AUR packages: {}", e))?;

    let _ = std::fs::remove_file(&script_path);

    if !output.status.success() {
        emit_progress(
            100,
            ":: AUR update completed with warnings".to_string(),
            true,
        );
    } else {
        emit_progress(
            100,
            ":: AUR packages updated successfully!".to_string(),
            true,
        );
    }

    Ok("AUR packages updated successfully".to_string())
}

// Update only Flatpak packages
#[tauri::command]
pub async fn update_flatpak(window: tauri::Window) -> Result<String, String> {
    use crate::models::InstallProgress;

    let emit_progress = |percentage: u32, message: String, completed: bool| {
        let _ = window.emit(
            "update-progress",
            InstallProgress {
                percentage,
                message,
                completed,
            },
        );
    };

    emit_progress(
        10,
        ":: Starting Flatpak packages update...".to_string(),
        false,
    );

    let mut child = Command::new("flatpak")
        .args(&["update", "-y"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn flatpak update: {}", e))?;

    // Stream output in real-time
    use std::thread;

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
                            "update-progress",
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
                            "update-progress",
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

    if let Some(handle) = stdout_handle {
        let _ = handle.join();
    }
    if let Some(handle) = stderr_handle {
        let _ = handle.join();
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to update Flatpak packages: {}", e))?;

    if !output.status.success() {
        emit_progress(
            100,
            ":: Flatpak update completed with warnings".to_string(),
            true,
        );
    } else {
        emit_progress(
            100,
            ":: Flatpak packages updated successfully!".to_string(),
            true,
        );
    }

    Ok("Flatpak packages updated successfully".to_string())
}

// Check which package sources are available on the system
#[tauri::command]
pub fn check_system_capabilities() -> Result<serde_json::Value, String> {
    let mut capabilities = serde_json::json!({});

    // Check for AUR helper (yay or paru)
    let has_aur = Command::new("yay").arg("--version").output().is_ok()
        || Command::new("paru").arg("--version").output().is_ok();
    capabilities["has_aur_helper"] = serde_json::json!(has_aur);

    // Check for Flatpak
    let has_flatpak = Command::new("flatpak").arg("--version").output().is_ok();
    capabilities["has_flatpak"] = serde_json::json!(has_flatpak);

    // Check if multilib is already enabled
    let multilib_enabled = std::fs::read_to_string("/etc/pacman.conf")
        .map(|content| {
            let lines: Vec<&str> = content.lines().collect();
            let mut found_multilib = false;
            for line in lines {
                let trimmed = line.trim();
                if trimmed == "[multilib]" {
                    found_multilib = true;
                } else if found_multilib && trimmed.starts_with("Include") {
                    return true;
                }
            }
            false
        })
        .unwrap_or(false);
    capabilities["multilib_enabled"] = serde_json::json!(multilib_enabled);

    Ok(capabilities)
}
