use crate::types::{BlockDiagramLayout, BlockLayout, Bounds, Dimensions, EdgeStyle, LayoutConfig, LayoutEdge, LayoutResult};
use xmermaid_parser::ast::BlockAst;

const CELL_WIDTH: f64 = 132.0;
const CELL_HEIGHT: f64 = 72.0;
const CELL_GAP: f64 = 20.0;

pub fn layout(diagram: &BlockAst, config: &LayoutConfig) -> LayoutResult {
    let row_count = diagram.blocks.iter().map(|block| block.row + 1).max().unwrap_or(0);
    let width = diagram.columns as f64 * CELL_WIDTH + diagram.columns.saturating_sub(1) as f64 * CELL_GAP;
    let height = row_count as f64 * CELL_HEIGHT + row_count.saturating_sub(1) as f64 * CELL_GAP;
    let blocks = diagram.blocks.iter().map(|block| {
        let x = config.padding + block.column as f64 * (CELL_WIDTH + CELL_GAP);
        let y = config.padding + block.row as f64 * (CELL_HEIGHT + CELL_GAP);
        let span_width = block.span as f64 * CELL_WIDTH + block.span.saturating_sub(1) as f64 * CELL_GAP;
        BlockLayout { id: block.id.clone(), label: block.label.clone(), span: block.span, bounds: Bounds { x, y, width: span_width, height: CELL_HEIGHT } }
    }).collect::<Vec<_>>();
    let lookup = blocks.iter().map(|block| (block.id.as_str(), block.bounds)).collect::<std::collections::HashMap<_, _>>();
    let edges = diagram.relationships.iter().filter_map(|relationship| {
        let from = lookup.get(relationship.from.as_str())?;
        let to = lookup.get(relationship.to.as_str())?;
        Some(LayoutEdge {
            from: relationship.from.clone(), to: relationship.to.clone(),
            waypoints: vec![from.center(), to.center()], label: None, label_lines: None, label_position: None,
            style: if relationship.arrow_at_target { EdgeStyle::Arrow } else { EdgeStyle::Line },
            source_boundary: None, target_boundary: None, path_end: None, final_tangent_angle: None,
            label_anchor: None, geometry_version: 1,
        })
    }).collect();
    LayoutResult {
        nodes: vec![], edges,
        dimensions: Dimensions { width: width + config.padding * 2.0, height: height + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None,
        block_diagram: Some(BlockDiagramLayout { columns: diagram.columns, blocks }),
        kanban_board: None,
    }
}
