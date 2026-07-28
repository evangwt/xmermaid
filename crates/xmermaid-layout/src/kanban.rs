use crate::types::{Bounds, Dimensions, KanbanBoardLayout, KanbanColumnLayout, KanbanTaskLayout, LayoutConfig, LayoutResult};
use xmermaid_parser::ast::KanbanAst;

const COLUMN_WIDTH: f64 = 220.0;
const HEADER_HEIGHT: f64 = 46.0;
const TASK_HEIGHT: f64 = 64.0;
const GAP: f64 = 18.0;

pub fn layout(board: &KanbanAst, config: &LayoutConfig) -> LayoutResult {
    let tallest_column = board.columns.iter().map(|column| column.tasks.len()).max().unwrap_or(0);
    let content_height = HEADER_HEIGHT + if tallest_column == 0 { 0.0 } else { GAP + tallest_column as f64 * TASK_HEIGHT + tallest_column.saturating_sub(1) as f64 * GAP };
    let columns = board.columns.iter().enumerate().map(|(index, column)| {
        let x = config.padding + index as f64 * (COLUMN_WIDTH + GAP);
        let header = Bounds { x, y: config.padding, width: COLUMN_WIDTH, height: HEADER_HEIGHT };
        let tasks = column.tasks.iter().enumerate().map(|(task_index, task)| KanbanTaskLayout {
            id: task.id.clone(), label: task.label.clone(),
            bounds: Bounds { x, y: header.bottom() + GAP + task_index as f64 * (TASK_HEIGHT + GAP), width: COLUMN_WIDTH, height: TASK_HEIGHT },
        }).collect();
        KanbanColumnLayout { id: column.id.clone(), label: column.label.clone(), header, tasks }
    }).collect();
    LayoutResult {
        nodes: vec![], edges: vec![],
        dimensions: Dimensions { width: board.columns.len() as f64 * COLUMN_WIDTH + board.columns.len().saturating_sub(1) as f64 * GAP + config.padding * 2.0, height: content_height + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None,
        kanban_board: Some(KanbanBoardLayout { columns }), treemap: None,
    }
}
