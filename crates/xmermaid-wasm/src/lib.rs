//! xmermaid-wasm: WASM bindings for xmermaid

use wasm_bindgen::prelude::*;
use xmermaid_parser::DiagramAst;

/// Initialize the WASM module. Must be called before any other function.
/// Sets up the panic hook so Rust panics produce useful error messages in JS.
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Parse DSL and return JSON AST
#[wasm_bindgen]
pub fn parse_dsl(input: &str) -> Result<String, JsValue> {
    let ast = xmermaid_parser::parse(input)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;
    serde_json::to_string(&ast)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Get diagram type from parsed AST JSON
#[wasm_bindgen]
pub fn get_diagram_type(ast_json: &str) -> Result<String, JsValue> {
    let ast: DiagramAst = serde_json::from_str(ast_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let type_str = match ast {
        DiagramAst::Flowchart(_) => "flowchart",
        DiagramAst::Sequence(_) => "sequence",
    };

    Ok(type_str.to_string())
}

/// Parse DSL and compute layout, returning the result as a JS object.
/// This is the primary high-level API: parse + layout in one call,
/// with the layout result returned as a native JS value (no JSON string parsing needed).
#[wasm_bindgen]
pub fn render(input: &str) -> Result<JsValue, JsValue> {
    render_with_config(input, None)
}

/// Parse DSL and compute layout with an optional config override.
/// If `config_json` is None, a default config is used with the direction
/// inferred from the parsed AST.
#[wasm_bindgen]
pub fn render_with_config(input: &str, config_json: Option<String>) -> Result<JsValue, JsValue> {
    let ast = xmermaid_parser::parse(input)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    let config = build_config(&ast, config_json)?;
    let result = xmermaid_layout::compute_layout(&ast, &config);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Return the default LayoutConfig as a JSON string.
/// Useful for inspecting defaults or as a starting point for custom configs.
#[wasm_bindgen]
pub fn default_config() -> Result<String, JsValue> {
    let config = xmermaid_layout::LayoutConfig::default();
    serde_json::to_string(&config)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Compute layout for a diagram given its AST JSON (returns JSON string).
/// This is kept for backward compatibility; prefer `render` or `render_with_config`
/// which return native JS objects.
#[wasm_bindgen]
pub fn compute_layout(ast_json: &str) -> Result<String, JsValue> {
    let ast: DiagramAst = serde_json::from_str(ast_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid AST JSON: {}", e)))?;

    let config = xmermaid_layout::LayoutConfig::default();
    let result = xmermaid_layout::compute_layout(&ast, &config);

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Build a LayoutConfig, optionally deserializing from JSON.
/// When no config JSON is provided, the default config is used with direction
/// set from the AST (for flowcharts).
fn build_config(
    ast: &DiagramAst,
    config_json: Option<String>,
) -> Result<xmermaid_layout::LayoutConfig, JsValue> {
    let mut config = match config_json {
        Some(json) => serde_json::from_str(&json)
            .map_err(|e| JsValue::from_str(&format!("Invalid config JSON: {}", e)))?,
        None => xmermaid_layout::LayoutConfig::default(),
    };

    // Map direction from parser AST to layout config when no custom config provided
    if let DiagramAst::Flowchart(fc) = ast {
        config.direction = match fc.direction {
            xmermaid_parser::ast::FlowDirection::TD => xmermaid_layout::FlowDirection::TB,
            xmermaid_parser::ast::FlowDirection::BT => xmermaid_layout::FlowDirection::BT,
            xmermaid_parser::ast::FlowDirection::LR => xmermaid_layout::FlowDirection::LR,
            xmermaid_parser::ast::FlowDirection::RL => xmermaid_layout::FlowDirection::RL,
        };
    }

    Ok(config)
}
