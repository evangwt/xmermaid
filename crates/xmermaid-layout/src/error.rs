use thiserror::Error;

#[derive(Error, Debug, serde::Serialize)]
pub enum LayoutError {
    #[error("Unsupported diagram type: {0}")]
    UnsupportedDiagramType(String),

    #[error("Layout computation failed: {0}")]
    ComputationFailed(String),
}
