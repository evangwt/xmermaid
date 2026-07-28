use crate::types::{Bounds, Dimensions, LayoutConfig, LayoutResult, PacketFieldLayout, PacketLayout};
use xmermaid_parser::ast::PacketAst;

const BITS_PER_ROW: u32 = 32;
const BIT_WIDTH: f64 = 18.0;
const ROW_HEIGHT: f64 = 56.0;
const TITLE_HEIGHT: f64 = 34.0;

pub fn layout(packet: &PacketAst, config: &LayoutConfig) -> LayoutResult {
    let row_count = packet.fields.iter().map(|field| field.end / BITS_PER_ROW + 1).max().unwrap_or(1);
    let fields = packet.fields.iter().map(|field| {
        let segments = (field.start / BITS_PER_ROW..=field.end / BITS_PER_ROW).map(|row| {
            let start = if row == field.start / BITS_PER_ROW { field.start % BITS_PER_ROW } else { 0 };
            let end = if row == field.end / BITS_PER_ROW { field.end % BITS_PER_ROW } else { BITS_PER_ROW - 1 };
            Bounds {
                x: config.padding + start as f64 * BIT_WIDTH,
                y: config.padding + TITLE_HEIGHT + row as f64 * ROW_HEIGHT,
                width: (end - start + 1) as f64 * BIT_WIDTH,
                height: ROW_HEIGHT - 12.0,
            }
        }).collect();
        PacketFieldLayout { start: field.start, end: field.end, label: field.label.clone(), segments }
    }).collect();

    LayoutResult {
        nodes: vec![],
        edges: vec![],
        dimensions: Dimensions {
            width: BITS_PER_ROW as f64 * BIT_WIDTH + config.padding * 2.0,
            height: TITLE_HEIGHT + row_count as f64 * ROW_HEIGHT + config.padding * 2.0,
        },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None,
        block_diagram: None, kanban_board: None, treemap: None, radar: None,
        packet: Some(PacketLayout { title: packet.title.clone(), fields }), venn: None,
    }
}
