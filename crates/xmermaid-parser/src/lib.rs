//! xmermaid-parser: Mermaid DSL parser
//!
//! Converts Mermaid DSL text to structured AST.

pub mod ast;
pub mod error;
pub mod lexer;
pub mod parser;

pub use ast::*;
pub use error::ParseError;
pub use parser::{parse_input, Parser};

/// Parse Mermaid DSL text into AST
pub fn parse(input: &str) -> Result<ast::DiagramAst, error::ParseError> {
    parse_input(input)
}
