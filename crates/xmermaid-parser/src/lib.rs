//! xmermaid-parser: Mermaid DSL parser
//!
//! Converts Mermaid DSL text to structured AST.

pub mod ast;
pub mod error;

pub fn parse(input: &str) -> Result<ast::DiagramAst, error::ParseError> {
    Err(error::ParseError::UnsupportedDiagramType("placeholder".to_string()))
}