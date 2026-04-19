use thiserror::Error;

#[derive(Error, Debug, serde::Serialize)]
pub enum LayoutError {
    #[error("Unsupported diagram type for layout")]
    UnsupportedDiagramType,

    #[error("Layout computation failed: {0}")]
    ComputationFailed(String),
}
