//! xmermaid-wasm: WASM bindings for xmermaid

use wasm_bindgen::prelude::*;
use serde::Deserialize;
use xmermaid_parser::DiagramAst;

#[derive(Debug, Default, Deserialize)]
struct LayoutConfigPatch {
    node_width: Option<f64>,
    node_height: Option<f64>,
    h_spacing: Option<f64>,
    v_spacing: Option<f64>,
    padding: Option<f64>,
    direction: Option<xmermaid_layout::FlowDirection>,
}

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
        DiagramAst::Class(_) => "class",
        DiagramAst::State(_) => "state",
        DiagramAst::Er(_) => "er",
        DiagramAst::Gantt(_) => "gantt",
        DiagramAst::Pie(_) => "pie",
        DiagramAst::UserJourney(_) => "user-journey",
        DiagramAst::Timeline(_) => "timeline",
        DiagramAst::Mindmap(_) => "mindmap",
        DiagramAst::Requirement(_) => "requirement",
        DiagramAst::GitGraph(_) => "gitgraph",
        DiagramAst::C4(_) => "c4",
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

    let config = build_config(&ast, None)?;
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
    let mut config = xmermaid_layout::LayoutConfig::default();

    if let DiagramAst::Flowchart(fc) = ast {
        config.direction = match fc.direction {
            xmermaid_parser::ast::FlowDirection::TD => xmermaid_layout::FlowDirection::TB,
            xmermaid_parser::ast::FlowDirection::BT => xmermaid_layout::FlowDirection::BT,
            xmermaid_parser::ast::FlowDirection::LR => xmermaid_layout::FlowDirection::LR,
            xmermaid_parser::ast::FlowDirection::RL => xmermaid_layout::FlowDirection::RL,
        };
    }

    if let Some(json) = config_json {
        let patch: LayoutConfigPatch = serde_json::from_str(&json)
            .map_err(|e| JsValue::from_str(&format!("Invalid config JSON: {}", e)))?;

        if let Some(value) = patch.node_width {
            config.node_width = value;
        }
        if let Some(value) = patch.node_height {
            config.node_height = value;
        }
        if let Some(value) = patch.h_spacing {
            config.h_spacing = value;
        }
        if let Some(value) = patch.v_spacing {
            config.v_spacing = value;
        }
        if let Some(value) = patch.padding {
            config.padding = value;
        }
        if let Some(value) = patch.direction {
            config.direction = value;
        }
    }

    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_config_preserves_ast_direction_when_direction_is_omitted() {
        let ast = xmermaid_parser::parse("graph LR\n  A-->B").unwrap();
        let config = build_config(&ast, Some(r#"{"h_spacing":100}"#.to_string())).unwrap();

        assert_eq!(config.direction, xmermaid_layout::FlowDirection::LR);
        assert_eq!(config.h_spacing, 100.0);
    }

    #[test]
    fn partial_config_can_override_ast_direction() {
        let ast = xmermaid_parser::parse("graph LR\n  A-->B").unwrap();
        let config = build_config(&ast, Some(r#"{"direction":"TB"}"#.to_string())).unwrap();

        assert_eq!(config.direction, xmermaid_layout::FlowDirection::TB);
    }

    #[test]
    fn compute_layout_compat_preserves_ast_direction() {
        let ast = xmermaid_parser::parse("graph LR\n  A-->B").unwrap();
        let ast_json = serde_json::to_string(&ast).unwrap();
        let layout_json = compute_layout(&ast_json).unwrap();
        let layout: xmermaid_layout::LayoutResult = serde_json::from_str(&layout_json).unwrap();
        let a = layout.nodes.iter().find(|node| node.id == "A").unwrap();
        let b = layout.nodes.iter().find(|node| node.id == "B").unwrap();

        assert!(
            b.center.x > a.center.x,
            "LR flowcharts should place B to the right of A in the compatibility compute_layout API"
        );
        assert_eq!(a.center.y, b.center.y);
    }

    #[test]
    fn requirement_diagrams_report_their_own_wasm_type() {
        let ast = xmermaid_parser::parse(
            "requirementDiagram\n  requirement Login {\n    text: User must log in\n  }",
        )
        .unwrap();
        let ast_json = serde_json::to_string(&ast).unwrap();

        assert_eq!(get_diagram_type(&ast_json).unwrap(), "requirement");
    }

    #[test]
    fn gitgraph_diagrams_report_their_own_wasm_type() {
        let ast = xmermaid_parser::parse("gitGraph\n  commit id: \"ZERO\"").unwrap();
        let ast_json = serde_json::to_string(&ast).unwrap();

        assert_eq!(get_diagram_type(&ast_json).unwrap(), "gitgraph");
    }

    #[test]
    fn c4_diagrams_report_their_own_wasm_type() {
        let ast = xmermaid_parser::parse("C4Context\n  Person(customer, \"Customer\")").unwrap();
        let ast_json = serde_json::to_string(&ast).unwrap();

        assert_eq!(get_diagram_type(&ast_json).unwrap(), "c4");
    }
}
