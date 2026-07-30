use std::collections::HashMap;

use crate::types::{
    Bounds, Dimensions, LayoutConfig, LayoutResult, Point, SequenceActivationLayout,
    SequenceBlockDividerLayout, SequenceBlockLayout, SequenceLayout, SequenceLifelineLayout,
    SequenceMessageLayout, SequenceNoteLayout, SequenceNotePlacementLayout,
    SequenceParticipantLayout,
};
use xmermaid_parser::ast::{
    SequenceAst, SequenceBlockKind, SequenceEvent, SequenceMessageEnd, SequenceMessageLineStyle,
    SequenceNotePlacement, SequenceParticipantKind,
};

const HEADER_HEIGHT: f64 = 44.0;
const ROW_HEIGHT: f64 = 54.0;
const ACTIVATION_WIDTH: f64 = 12.0;
const ACTIVATION_OFFSET: f64 = 8.0;
const MIN_HEADER_WIDTH: f64 = 96.0;
const MAX_HEADER_WIDTH: f64 = 280.0;
const MIN_PARTICIPANT_GAP: f64 = 80.0;
const MESSAGE_LABEL_PADDING: f64 = 28.0;
const SELF_LOOP_PADDING: f64 = 24.0;
const SELF_LOOP_CLEARANCE: f64 = 16.0;
const BLOCK_PADDING: f64 = 24.0;
const NOTE_TEXT_MAX_WIDTH: f64 = 260.0;

pub fn layout(diagram: &SequenceAst, config: &LayoutConfig) -> LayoutResult {
    let events = fallback_events(diagram);
    let left_note_space = events
        .iter()
        .filter_map(|event| match event {
            SequenceEvent::Note {
                placement: SequenceNotePlacement::LeftOf,
                text,
                ..
            } => Some(note_width(text)),
            _ => None,
        })
        .fold(0.0_f64, f64::max);
    let right_note_space = events
        .iter()
        .filter_map(|event| match event {
            SequenceEvent::Note {
                placement: SequenceNotePlacement::RightOf,
                text,
                ..
            } => Some(note_width(text)),
            _ => None,
        })
        .fold(0.0_f64, f64::max);
    let participant_indices = diagram
        .participants
        .iter()
        .enumerate()
        .map(|(index, participant)| (participant.id.as_str(), index))
        .collect::<HashMap<_, _>>();
    let header_widths = diagram
        .participants
        .iter()
        .map(|participant| participant_width(&participant.label))
        .collect::<Vec<_>>();
    let (participant_gaps, right_self_space) = participant_spacing_requirements(
        diagram,
        &events,
        &participant_indices,
        &header_widths,
        config.h_spacing.max(MIN_PARTICIPANT_GAP),
    );
    let mut cursor_x = config.padding + left_note_space + 28.0;
    let mut participant_x = HashMap::new();
    let participants = diagram
        .participants
        .iter()
        .enumerate()
        .map(|(index, participant)| {
            let header_width = header_widths[index];
            let center_x = cursor_x + header_width / 2.0;
            participant_x.insert(participant.id.as_str(), center_x);
            cursor_x += header_width + participant_gaps.get(index).copied().unwrap_or(0.0);
            SequenceParticipantLayout {
                id: participant.id.clone(),
                label: participant.label.clone(),
                kind: match participant.kind {
                    SequenceParticipantKind::Participant => "participant".to_string(),
                    SequenceParticipantKind::Actor => "actor".to_string(),
                },
                header: Bounds {
                    x: center_x - header_width / 2.0,
                    y: config.padding,
                    width: header_width,
                    height: HEADER_HEIGHT,
                },
            }
        })
        .collect::<Vec<_>>();
    let width = (cursor_x - participant_gaps.last().copied().unwrap_or(0.0))
        + right_note_space
        + right_self_space
        + config.padding
        + 28.0;

    let mut y = config.padding + HEADER_HEIGHT + ROW_HEIGHT;
    let mut messages = Vec::new();
    let mut notes = Vec::new();
    let mut activations = Vec::new();
    let mut open_activations: HashMap<String, Vec<OpenActivation>> = HashMap::new();
    let mut blocks = Vec::new();
    let mut open_blocks = Vec::new();
    let mut autonumber = false;
    let mut next_message_number = 1_u32;

    for event in events {
        match event {
            SequenceEvent::Message { message_index } => {
                let Some(message) = diagram.messages.get(message_index) else {
                    continue;
                };
                let Some(&from_x) = participant_x.get(message.from.as_str()) else {
                    continue;
                };
                let Some(&to_x) = participant_x.get(message.to.as_str()) else {
                    continue;
                };
                let self_width =
                    (message.from == message.to).then(|| self_loop_width(&message.label));
                let label_position = Point {
                    x: self_width
                        .map(|width| from_x + width / 2.0)
                        .unwrap_or((from_x + to_x) / 2.0),
                    y: y - 9.0,
                };
                let label_width = text_width(&message.label);
                let line_left = from_x.min(to_x);
                let line_right = self_width
                    .map(|width| from_x + width)
                    .unwrap_or_else(|| from_x.max(to_x));
                include_open_blocks(
                    &mut open_blocks,
                    line_left.min(label_position.x - label_width / 2.0),
                    line_right.max(label_position.x + label_width / 2.0),
                );
                messages.push(SequenceMessageLayout {
                    from: message.from.clone(),
                    to: message.to.clone(),
                    from_x,
                    to_x,
                    y,
                    label: message.label.clone(),
                    label_position,
                    self_width,
                    dashed: matches!(message.line_style, SequenceMessageLineStyle::Dashed),
                    number: autonumber.then(|| {
                        let number = next_message_number;
                        next_message_number += 1;
                        number
                    }),
                    end_marker: match message.end_marker {
                        SequenceMessageEnd::Arrow => "arrow".to_string(),
                        SequenceMessageEnd::Cross => "cross".to_string(),
                    },
                });
                if message.activate_target {
                    open_activation(&mut open_activations, &message.to, y);
                }
                if message.deactivate_source {
                    close_activation(
                        &mut open_activations,
                        &message.from,
                        y,
                        &participant_x,
                        &mut activations,
                    );
                }
                y += ROW_HEIGHT;
            }
            SequenceEvent::Autonumber => {
                autonumber = true;
            }
            SequenceEvent::Activation {
                participant,
                active,
            } => {
                if active {
                    open_activation(&mut open_activations, &participant, y);
                } else {
                    close_activation(
                        &mut open_activations,
                        &participant,
                        y,
                        &participant_x,
                        &mut activations,
                    );
                }
                y += ROW_HEIGHT;
            }
            SequenceEvent::Note {
                placement,
                participants: note_participants,
                text,
            } => {
                let (bounds, lines) =
                    note_bounds(placement, &note_participants, &text, &participant_x, y);
                include_open_blocks(&mut open_blocks, bounds.left(), bounds.right());
                notes.push(SequenceNoteLayout {
                    placement: map_note_placement(placement),
                    participants: note_participants,
                    bounds,
                    text,
                    lines,
                });
                y += bounds.height.max(ROW_HEIGHT);
            }
            SequenceEvent::BlockStart {
                block,
                label,
                color,
            } => {
                let depth = open_blocks.len();
                open_blocks.push(OpenBlock {
                    kind: block,
                    labels: vec![label.clone()],
                    label,
                    color,
                    start_y: y - 18.0,
                    depth,
                    dividers: vec![],
                    content_left: None,
                    content_right: None,
                });
                y += ROW_HEIGHT;
            }
            SequenceEvent::BlockDivider { label, .. } => {
                if let Some(block) = open_blocks.last_mut() {
                    block.labels.push(label.clone());
                    block.dividers.push(SequenceBlockDividerLayout { label, y });
                }
                y += ROW_HEIGHT;
            }
            SequenceEvent::BlockEnd => {
                if let Some(block) = open_blocks.pop() {
                    let bounds = block_bounds(&block, config.padding);
                    include_open_blocks(&mut open_blocks, bounds.left(), bounds.right());
                    blocks.push(SequenceBlockLayout {
                        kind: block_name(block.kind).to_string(),
                        label: block.label,
                        color: block.color,
                        bounds: Bounds {
                            height: (y + 18.0 - block.start_y).max(ROW_HEIGHT),
                            ..bounds
                        },
                        dividers: block.dividers,
                    });
                }
                y += ROW_HEIGHT / 2.0;
            }
        }
    }

    let timeline_end = y + 18.0;
    for (participant, pending) in open_activations {
        for activation in pending {
            add_activation(
                &participant,
                activation,
                timeline_end,
                &participant_x,
                &mut activations,
            );
        }
    }
    blocks.sort_by_key(|block| (block.bounds.y as i64, block.bounds.x as i64));
    let lifelines = participants
        .iter()
        .map(|participant| {
            let x = participant.header.center().x;
            SequenceLifelineLayout {
                participant: participant.id.clone(),
                start: Point {
                    x,
                    y: participant.header.bottom(),
                },
                end: Point { x, y: timeline_end },
            }
        })
        .collect();

    LayoutResult {
        nodes: vec![],
        edges: vec![],
        dimensions: Dimensions {
            width,
            height: timeline_end + config.padding,
        },
        pie_slices: vec![],
        xy_chart: None,
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None,
        treemap: None,
        radar: None,
        packet: None,
        venn: None,
        swimlanes: None,
        sequence: Some(SequenceLayout {
            participants,
            lifelines,
            messages,
            activations,
            notes,
            blocks,
        }),
        ishikawa: None,
        wardley: None,
        cynefin: None,
    }
}

fn participant_width(label: &str) -> f64 {
    (text_width(label) + 28.0).clamp(MIN_HEADER_WIDTH, MAX_HEADER_WIDTH)
}

fn participant_spacing_requirements(
    diagram: &SequenceAst,
    events: &[SequenceEvent],
    participant_indices: &HashMap<&str, usize>,
    header_widths: &[f64],
    minimum_gap: f64,
) -> (Vec<f64>, f64) {
    let mut gaps = vec![minimum_gap; header_widths.len().saturating_sub(1)];
    let mut right_self_space: f64 = 0.0;

    for event in events {
        let SequenceEvent::Message { message_index } = event else {
            continue;
        };
        let Some(message) = diagram.messages.get(*message_index) else {
            continue;
        };
        let Some(&from) = participant_indices.get(message.from.as_str()) else {
            continue;
        };
        let Some(&to) = participant_indices.get(message.to.as_str()) else {
            continue;
        };

        if from == to {
            let loop_width = self_loop_width(&message.label);
            if let Some(gap) = gaps.get_mut(from) {
                *gap = gap.max(loop_width + SELF_LOOP_CLEARANCE - header_widths[from] / 2.0);
            } else {
                right_self_space = right_self_space
                    .max(loop_width + SELF_LOOP_CLEARANCE - header_widths[from] / 2.0);
            }
            continue;
        }

        let start = from.min(to);
        let end = from.max(to);
        let required = text_width(&message.label) + MESSAGE_LABEL_PADDING;
        let current = participant_center_distance(header_widths, &gaps, start, end);
        if required > current {
            let extra = (required - current) / (end - start) as f64;
            for gap in &mut gaps[start..end] {
                *gap += extra;
            }
        }
    }

    (gaps, right_self_space.max(0.0))
}

fn participant_center_distance(widths: &[f64], gaps: &[f64], start: usize, end: usize) -> f64 {
    let between_widths = widths[start + 1..end].iter().sum::<f64>();
    widths[start] / 2.0 + between_widths + widths[end] / 2.0 + gaps[start..end].iter().sum::<f64>()
}

fn self_loop_width(label: &str) -> f64 {
    (text_width(label) + SELF_LOOP_PADDING).max(34.0)
}

fn fallback_events(diagram: &SequenceAst) -> Vec<SequenceEvent> {
    if diagram.events.is_empty() {
        (0..diagram.messages.len())
            .map(|message_index| SequenceEvent::Message { message_index })
            .collect()
    } else {
        diagram.events.clone()
    }
}

fn note_width(text: &str) -> f64 {
    note_geometry(text).0
}

fn note_bounds(
    placement: SequenceNotePlacement,
    participants: &[String],
    text: &str,
    positions: &HashMap<&str, f64>,
    y: f64,
) -> (Bounds, Vec<String>) {
    let (width, height, lines) = note_geometry(text);
    let first_x = participants
        .first()
        .and_then(|participant| positions.get(participant.as_str()))
        .copied()
        .unwrap_or(0.0);
    let second_x = participants
        .get(1)
        .and_then(|participant| positions.get(participant.as_str()))
        .copied()
        .unwrap_or(first_x);
    let x = match placement {
        SequenceNotePlacement::LeftOf => first_x - width - 24.0,
        SequenceNotePlacement::RightOf => first_x + 24.0,
        SequenceNotePlacement::Over => (first_x + second_x) / 2.0 - width / 2.0,
    };
    (
        Bounds {
            x,
            y: y - height / 2.0,
            width,
            height,
        },
        lines,
    )
}

fn note_geometry(text: &str) -> (f64, f64, Vec<String>) {
    let lines = wrap_text(text, NOTE_TEXT_MAX_WIDTH);
    let content_width = lines
        .iter()
        .map(|line| text_width(line))
        .fold(0.0_f64, f64::max);
    let width = (content_width + 28.0).clamp(110.0, NOTE_TEXT_MAX_WIDTH + 28.0);
    let height = lines.len().max(1) as f64 * 16.0 + 20.0;
    (width, height, lines)
}

fn wrap_text(text: &str, max_width: f64) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    let mut width = 0.0;

    for character in text.chars() {
        let character_width = char_width(character);
        if !line.is_empty() && width + character_width > max_width {
            lines.push(line.trim_end().to_string());
            line.clear();
            width = 0.0;
        }
        line.push(character);
        width += character_width;
    }
    if !line.is_empty() || lines.is_empty() {
        lines.push(line.trim_end().to_string());
    }
    lines
}

fn text_width(text: &str) -> f64 {
    text.chars().map(char_width).sum()
}

fn char_width(character: char) -> f64 {
    if character.is_ascii() {
        6.5
    } else {
        12.0
    }
}

fn include_open_blocks(open_blocks: &mut [OpenBlock], left: f64, right: f64) {
    for block in open_blocks {
        block.include_horizontal(left, right);
    }
}

fn block_bounds(block: &OpenBlock, padding: f64) -> Bounds {
    let frame_padding = (BLOCK_PADDING - (block.depth as f64 * 4.0)).max(12.0);
    let content_left = block.content_left.unwrap_or(padding + frame_padding);
    let content_right = block.content_right.unwrap_or(content_left + 32.0);
    let content_width = content_right - content_left + frame_padding * 2.0;
    let label_width = block
        .labels
        .iter()
        .map(|label| text_width(label))
        .fold(0.0_f64, f64::max)
        + 20.0;
    Bounds {
        x: content_left - frame_padding,
        y: block.start_y,
        width: content_width.max(label_width).max(80.0),
        height: 0.0,
    }
}

fn map_note_placement(placement: SequenceNotePlacement) -> SequenceNotePlacementLayout {
    match placement {
        SequenceNotePlacement::LeftOf => SequenceNotePlacementLayout::LeftOf,
        SequenceNotePlacement::RightOf => SequenceNotePlacementLayout::RightOf,
        SequenceNotePlacement::Over => SequenceNotePlacementLayout::Over,
    }
}

fn open_activation(
    open: &mut HashMap<String, Vec<OpenActivation>>,
    participant: &str,
    start_y: f64,
) {
    let depth = open.get(participant).map_or(0, Vec::len);
    open.entry(participant.to_string())
        .or_default()
        .push(OpenActivation { start_y, depth });
}

fn close_activation(
    open: &mut HashMap<String, Vec<OpenActivation>>,
    participant: &str,
    end_y: f64,
    positions: &HashMap<&str, f64>,
    activations: &mut Vec<SequenceActivationLayout>,
) {
    if let Some(activation) = open.get_mut(participant).and_then(Vec::pop) {
        add_activation(participant, activation, end_y, positions, activations);
    }
}

fn add_activation(
    participant: &str,
    activation: OpenActivation,
    end_y: f64,
    positions: &HashMap<&str, f64>,
    activations: &mut Vec<SequenceActivationLayout>,
) {
    let Some(&x) = positions.get(participant) else {
        return;
    };
    activations.push(SequenceActivationLayout {
        participant: participant.to_string(),
        bounds: Bounds {
            x: x - ACTIVATION_WIDTH / 2.0 + activation.depth as f64 * ACTIVATION_OFFSET,
            y: activation.start_y,
            width: ACTIVATION_WIDTH,
            height: (end_y - activation.start_y).max(16.0),
        },
    });
}

fn block_name(block: SequenceBlockKind) -> &'static str {
    match block {
        SequenceBlockKind::Rect => "rect",
        SequenceBlockKind::Loop => "loop",
        SequenceBlockKind::Alt => "alt",
        SequenceBlockKind::Opt => "opt",
        SequenceBlockKind::Par => "par",
        SequenceBlockKind::Critical => "critical",
        SequenceBlockKind::Break => "break",
    }
}

struct OpenActivation {
    start_y: f64,
    depth: usize,
}

struct OpenBlock {
    kind: SequenceBlockKind,
    label: String,
    color: Option<String>,
    start_y: f64,
    depth: usize,
    dividers: Vec<SequenceBlockDividerLayout>,
    labels: Vec<String>,
    content_left: Option<f64>,
    content_right: Option<f64>,
}

impl OpenBlock {
    fn include_horizontal(&mut self, left: f64, right: f64) {
        self.content_left = Some(self.content_left.map_or(left, |current| current.min(left)));
        self.content_right = Some(
            self.content_right
                .map_or(right, |current| current.max(right)),
        );
    }
}
