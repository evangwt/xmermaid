use crate::{flowchart::label_size, types::{Bounds, Dimensions, LayoutConfig, LayoutNode, LayoutResult, NodeShape, Point}};
use xmermaid_parser::ast::NodeStyle;
use xmermaid_parser::ast::{GanttAst, GanttStart, GanttTask, GanttTaskState};

const DAY_WIDTH: f64 = 40.0;
const ROW_HEIGHT: f64 = 70.0;
const TASK_HEIGHT: f64 = 36.0;
const TITLE_HEIGHT: f64 = 42.0;

/// Fill colors for Gantt task states, kept as six-digit hex values so the
/// renderer applies them through the safe node-style path.
fn state_fill(state: GanttTaskState, milestone: bool) -> Option<&'static str> {
    if milestone {
        return Some("#fbbf24");
    }
    match state {
        GanttTaskState::Todo => None,
        GanttTaskState::Done => Some("#a3a3a3"),
        GanttTaskState::Active => Some("#60a5fa"),
        GanttTaskState::Crit => Some("#f87171"),
    }
}

pub fn layout(gantt: &GanttAst, config: &LayoutConfig) -> LayoutResult {
    let first_day = gantt
        .tasks
        .iter()
        .map(|task| task_offset(gantt, &task.start, &mut Vec::new()))
        .fold(f64::INFINITY, f64::min);
    let first_day = if first_day.is_finite() { first_day } else { 0.0 };

    let title_offset = if gantt.title.is_empty() { 0.0 } else { TITLE_HEIGHT };
    let mut width: f64 = config.padding * 2.0;
    let nodes = gantt.tasks.iter().enumerate().map(|(index, task)| {
        let label = if task.section.is_empty() { task.label.clone() } else { format!("{} · {}", task.section, task.label) };
        let (label_width, _) = label_size(&[label.clone()], 14.0, 18.0, 28.0, 20.0);
        let length = task_length_days(gantt, task);
        let task_width = if task.milestone {
            TASK_HEIGHT
        } else {
            (length * DAY_WIDTH).max(80.0).max(label_width)
        };
        let start_offset = task_offset(gantt, &task.start, &mut Vec::new());
        let x = config.padding + (start_offset - first_day) * DAY_WIDTH + task_width / 2.0;
        let y = config.padding + title_offset + index as f64 * ROW_HEIGHT + TASK_HEIGHT / 2.0;
        width = width.max(x + task_width / 2.0 + config.padding);
        let shape = if task.milestone { NodeShape::Diamond } else { NodeShape::RoundedRect };
        let style = state_fill(task.state, task.milestone).map(|fill| NodeStyle {
            fill: Some(fill.to_string()),
            ..NodeStyle::default()
        });
        LayoutNode {
           hidden: false,
            id: format!("gantt-{}", index),
            center: Point { x, y },
            bounds: Bounds::from_center(Point { x, y }, task_width, TASK_HEIGHT),
            shape,
            label: label.clone(),
            label_lines: vec![label],
            style,
        }
    }).collect();

    LayoutResult { pie_show_data: false, pie_title: None, subgraph_boxes: Vec::new(),
        nodes,
        edges: vec![],
        dimensions: Dimensions {
            width,
            height: config.padding * 2.0 + title_offset + gantt.tasks.len() as f64 * ROW_HEIGHT,
        },
        pie_slices: vec![],
        xy_chart: None,
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None, treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None, wardley: None, cynefin: None,
    }
}

/// Task length in calendar days: the explicit duration expanded over the
/// exclusion calendar, or the span between the start and an explicit end date.
fn task_length_days(gantt: &GanttAst, task: &GanttTask) -> f64 {
    if let (Some(end_date), GanttStart::Date { date }) = (&task.end_date, &task.start) {
        let start = date_key(date);
        let end = date_key(end_date);
        return (end - start).max(0) as f64;
    }
    if gantt.excludes.is_empty() || task.milestone || task.duration_days <= 0.0 {
        return task.duration_days;
    }
    // Walk the calendar from the start day, counting only working days until
    // the requested duration is consumed; the calendar span is what the bar
    // occupies on screen.
    let start_day = match &task.start {
        GanttStart::Date { date } => date_key(date),
        GanttStart::After { task_ids } => {
            let mut earliest = i64::MAX;
            for task_id in task_ids {
                if let Some(dependency) = gantt
                    .tasks
                    .iter()
                    .find(|candidate| &candidate.id == task_id || &candidate.label == task_id)
                {
                    let offset = task_offset(gantt, &dependency.start, &mut Vec::new());
                    earliest = earliest.min(offset as i64);
                }
            }
            if earliest == i64::MAX { 0 } else { earliest }
        }
    };
    let mut calendar = 0_i64;
    let mut counted = 0.0_f64;
    while counted < task.duration_days && calendar < 100_000 {
        if !is_excluded_day(start_day + calendar, &gantt.excludes) {
            counted += 1.0;
        }
        calendar += 1;
    }
    calendar as f64
}

fn is_excluded_day(day: i64, excludes: &[xmermaid_parser::ast::GanttExclusion]) -> bool {
    // 1970-01-01 (day 0) was a Thursday; Monday-based weekday = (day + 3) % 7.
    let weekday = ((day % 7) + 3 + 7) % 7;
    excludes.iter().any(|exclusion| match exclusion {
        xmermaid_parser::ast::GanttExclusion::Weekend => weekday == 5 || weekday == 6,
        xmermaid_parser::ast::GanttExclusion::Weekday { index } => weekday == *index as i64,
        xmermaid_parser::ast::GanttExclusion::Date { date } => date_key(date) == day,
    })
}

/// Resolve a task's start position in absolute day offsets, following `after`
/// dependencies through previously declared tasks.
fn task_offset(gantt: &GanttAst, start: &GanttStart, visiting: &mut Vec<String>) -> f64 {
    match start {
        GanttStart::Date { date } => date_key(date) as f64,
        GanttStart::After { task_ids } => {
            let mut latest = 0.0_f64;
            for task_id in task_ids {
                let needle = task_id.trim();
                if needle.is_empty() || visiting.iter().any(|id| id == needle) {
                    continue;
                }
                let dependency = gantt
                    .tasks
                    .iter()
                    .find(|candidate| &candidate.id == needle || &candidate.label == needle);
                let Some(dependency) = dependency else {
                    continue;
                };
                visiting.push(needle.to_string());
                let offset = task_offset(gantt, &dependency.start, visiting)
                    + task_length_days(gantt, dependency);
                visiting.pop();
                latest = latest.max(offset);
            }
            latest
        }
    }
}

fn date_key(value: &str) -> i64 {
    let year = value.get(0..4).and_then(|part| part.parse::<i64>().ok()).unwrap_or_default();
    let month = value.get(5..7).and_then(|part| part.parse::<i64>().ok()).unwrap_or_default();
    let day = value.get(8..10).and_then(|part| part.parse::<i64>().ok()).unwrap_or_default();
    days_from_civil(year, month, day)
}

/// Howard Hinnant's days_from_civil algorithm: exact calendar-day arithmetic
/// so `after` dependencies and week durations stay aligned across months.
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_shift = if month > 2 { month - 3 } else { month + 9 };
    let day_of_year = (153 * month_shift + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}
