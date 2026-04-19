//! xmermaid-wasm: WASM bindings for xmermaid

use wasm_bindgen::prelude::*;
use xmermaid_parser::DiagramAst;

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

/// Compute layout for a diagram given its AST JSON
#[wasm_bindgen]
pub fn compute_layout(ast_json: &str) -> Result<String, JsValue> {
    let ast: DiagramAst = serde_json::from_str(ast_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid AST JSON: {}", e)))?;

    let result = xmermaid_layout::compute_flowchart_layout(&ast)
        .map_err(|e| JsValue::from_str(&format!("Layout error: {}", e)))?;

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
