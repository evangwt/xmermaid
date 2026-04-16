use thiserror::Error;

#[derive(Error, Debug, serde::Serialize)]
pub enum ParseError {
    #[error("Syntax error at line {line}, column {column}: {message}")]
    SyntaxError {
        line: usize,
        column: usize,
        message: String,
    },

    #[error("Unsupported diagram type: {0}")]
    UnsupportedDiagramType(String),

    #[error("Unexpected token: {0}")]
    UnexpectedToken(String),
}
