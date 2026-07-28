use crate::types::{Bounds, Dimensions, LayoutConfig, LayoutNode, LayoutResult, NodeShape, Point};
use xmermaid_parser::ast::GanttAst;

const DAY_WIDTH: f64 = 40.0;
const ROW_HEIGHT: f64 = 70.0;
const TASK_HEIGHT: f64 = 36.0;

pub fn layout(gantt: &GanttAst, config: &LayoutConfig) -> LayoutResult {
    let starts: Vec<i32> = gantt.tasks.iter().map(|task| date_key(&task.start)).collect();
    let first_day = *starts.iter().min().unwrap_or(&0);
    let mut width: f64 = config.padding * 2.0;
    let nodes = gantt.tasks.iter().enumerate().map(|(index, task)| {
        let task_width = (f64::from(task.duration_days) * DAY_WIDTH).max(80.0);
        let x = config.padding + f64::from(date_key(&task.start) - first_day) * DAY_WIDTH + task_width / 2.0;
        let y = config.padding + index as f64 * ROW_HEIGHT + TASK_HEIGHT / 2.0;
        width = width.max(x + task_width / 2.0 + config.padding);
        let label = if task.section.is_empty() { task.label.clone() } else { format!("{} · {}", task.section, task.label) };
        LayoutNode {
            id: format!("gantt-{}", index),
            center: Point { x, y },
            bounds: Bounds::from_center(Point { x, y }, task_width, TASK_HEIGHT),
            shape: NodeShape::RoundedRect,
            label: label.clone(),
            label_lines: vec![label],
        }
    }).collect();

    LayoutResult {
        nodes,
        edges: vec![],
        dimensions: Dimensions { width, height: config.padding * 2.0 + gantt.tasks.len() as f64 * ROW_HEIGHT },
        pie_slices: vec![],
    }
}

fn date_key(value: &str) -> i32 {
    let year = value[0..4].parse::<i32>().unwrap_or_default();
    let month = value[5..7].parse::<i32>().unwrap_or_default();
    let day = value[8..10].parse::<i32>().unwrap_or_default();
    year * 372 + month * 31 + day
}
