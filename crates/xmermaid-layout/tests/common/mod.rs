use xmermaid_layout::{FlowDirection, LayoutConfig};
use xmermaid_parser::DiagramAst;

pub fn config_for_ast(ast: &DiagramAst) -> LayoutConfig {
    let mut config = LayoutConfig::default();
    if let DiagramAst::Flowchart(fc) = ast {
        config.direction = match fc.direction {
            xmermaid_parser::ast::FlowDirection::TD => FlowDirection::TB,
            xmermaid_parser::ast::FlowDirection::BT => FlowDirection::BT,
            xmermaid_parser::ast::FlowDirection::LR => FlowDirection::LR,
            xmermaid_parser::ast::FlowDirection::RL => FlowDirection::RL,
        };
    }
    config
}
