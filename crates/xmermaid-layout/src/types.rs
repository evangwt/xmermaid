use serde::{Deserialize, Serialize};

/// Direction of flowchart layout
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlowDirection {
    TB,
    BT,
    LR,
    RL,
}

/// Configuration for layout computation, replacing hardcoded constants
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub node_width: f64,
    pub node_height: f64,
    pub h_spacing: f64,
    pub v_spacing: f64,
    pub padding: f64,
    pub direction: FlowDirection,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            node_width: 120.0,
            node_height: 40.0,
            v_spacing: 60.0,
            h_spacing: 60.0,
            padding: 40.0,
            direction: FlowDirection::TB,
        }
    }
}

/// A 2D point
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Axis-aligned bounding box
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Bounds {
    pub fn from_center(center: Point, width: f64, height: f64) -> Self {
        Self {
            x: center.x - width / 2.0,
            y: center.y - height / 2.0,
            width,
            height,
        }
    }

    pub fn center(&self) -> Point {
        Point {
            x: self.x + self.width / 2.0,
            y: self.y + self.height / 2.0,
        }
    }

    pub fn left(&self) -> f64 {
        self.x
    }
    pub fn right(&self) -> f64 {
        self.x + self.width
    }
    pub fn top(&self) -> f64 {
        self.y
    }
    pub fn bottom(&self) -> f64 {
        self.y + self.height
    }
}

/// Shape of a node, forwarded from AST
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeShape {
    Rectangle,
    RoundedRect,
    Stadium,
    Diamond,
    Circle,
    Hexagon,
    Parallelogram,
    Trapezoid,
}

/// A positioned node in the layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutNode {
    pub id: String,
    pub center: Point,
    pub bounds: Bounds,
    pub shape: NodeShape,
    pub label: String,
    #[serde(default)]
    pub label_lines: Vec<String>,
}

/// Style of an edge, forwarded from AST
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", into = "String", try_from = "String")]
pub enum EdgeStyle {
    Arrow,
    Line,
    Dotted,
    Thick,
    Invisible,
}

impl From<EdgeStyle> for String {
    fn from(style: EdgeStyle) -> Self {
        match style {
            EdgeStyle::Arrow => "arrow".to_string(),
            EdgeStyle::Line => "line".to_string(),
            EdgeStyle::Dotted => "dotted".to_string(),
            EdgeStyle::Thick => "thick".to_string(),
            EdgeStyle::Invisible => "invisible".to_string(),
        }
    }
}

impl TryFrom<String> for EdgeStyle {
    type Error = String;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.as_str() {
            "arrow" => Ok(EdgeStyle::Arrow),
            "line" => Ok(EdgeStyle::Line),
            "dotted" => Ok(EdgeStyle::Dotted),
            "thick" => Ok(EdgeStyle::Thick),
            "invisible" => Ok(EdgeStyle::Invisible),
            _ => Err(format!("Unknown EdgeStyle: {}", s)),
        }
    }
}

/// A positioned edge in the layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutEdge {
    pub from: String,
    pub to: String,
    pub waypoints: Vec<Point>,
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_lines: Option<Vec<String>>,
    pub label_position: Option<Point>,
    pub style: EdgeStyle,
    pub source_boundary: Option<Point>,
    pub target_boundary: Option<Point>,
    pub path_end: Option<Point>,
    pub final_tangent_angle: Option<f64>,
    pub label_anchor: Option<Point>,
    #[serde(default = "default_geometry_version")]
    pub geometry_version: u8,
}

fn default_geometry_version() -> u8 {
    1
}

/// Overall dimensions of the layout
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PieSlice { pub label: String, pub value: f64, pub start_angle: f64, pub end_angle: f64 }
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum XySeriesKind { Bar, Line }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XyChartSeries { pub kind: XySeriesKind, #[serde(default, skip_serializing_if = "Vec::is_empty")] pub bars: Vec<Bounds>, #[serde(default, skip_serializing_if = "Vec::is_empty")] pub points: Vec<Point> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XyChartLayout { pub title: String, pub plot: Bounds, pub x_labels: Vec<String>, pub y_min: f64, pub y_max: f64, pub series: Vec<XyChartSeries> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyNode { pub id: String, pub bounds: Bounds, pub value: f64, pub column: usize }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyLink { pub source: String, pub target: String, pub value: f64, pub source_y: f64, pub target_y: f64, pub thickness: f64 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyLayout { pub nodes: Vec<SankeyNode>, pub links: Vec<SankeyLink> }

/// Complete layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutResult {
    pub nodes: Vec<LayoutNode>,
    pub edges: Vec<LayoutEdge>,
    pub dimensions: Dimensions,
    #[serde(default)] pub pie_slices: Vec<PieSlice>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub xy_chart: Option<XyChartLayout>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub sankey: Option<SankeyLayout>,
}
