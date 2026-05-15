use std::fs;
use std::path::Path;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Checks %TEMP%/siimpli-graph-launch.json, reads it, deletes it, and returns the content.
/// Returns None if no payload is waiting. Called by the frontend on startup.
#[tauri::command]
fn get_launch_payload() -> Option<String> {
    let launch_file = std::env::temp_dir().join("siimpli-graph-launch.json");
    if !launch_file.exists() {
        return None;
    }
    let content = fs::read_to_string(&launch_file).ok()?;
    let _ = fs::remove_file(&launch_file);
    Some(content)
}

/// Reads a file from an absolute path and returns its text content.
/// Used by the frontend to read a CSV file that was written by Query-It.
#[tauri::command]
fn read_file_as_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read '{path}': {e}"))
}

/// Saves a graph config JSON as a reusable template in the given directory.
/// The templates_dir is provided by Query-It in the launch payload so Graph-It
/// never needs to know Query-It's app data path directly.
#[tauri::command]
fn save_graph_template(name: String, content: String, templates_dir: String) -> Result<(), String> {
    let dir = Path::new(&templates_dir);
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create templates dir: {e}"))?;
    let safe_name = slugify_name(&name);
    let path = dir.join(format!("{safe_name}.json"));
    fs::write(&path, content).map_err(|e| format!("Failed to write template '{name}': {e}"))
}

fn slugify_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c.to_lowercase().next().unwrap_or(c) } else { '_' })
        .collect::<String>()
        .split('_')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_launch_payload,
            read_file_as_text,
            save_graph_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
