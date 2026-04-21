use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("Unexpected token: {0}")]
    UnexpectedToken(String),
    #[error("Unsupported diagram type: {0}")]
    UnsupportedDiagramType(String),
    #[error("Empty input")]
    EmptyInput,
}
