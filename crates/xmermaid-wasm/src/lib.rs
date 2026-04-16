//! xmermaid-wasm: WASM bindings for xmermaid

use wasm_bindgen::prelude::*;

/// Parse DSL and return JSON AST
#[wasm_bindgen]
pub fn parse_dsl(input: &str) -> Result<String, JsValue> {
    let ast = xmermaid_parser::parse(input).map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_json::to_string(&ast).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Compute layout and return JSON result
#[wasm_bindgen]
pub fn compute_layout() -> Result<String, JsValue> {
    let result = xmermaid_layout::layout();
    serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}
