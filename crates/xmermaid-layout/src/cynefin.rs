use crate::types::{Bounds, CynefinDomainLayout, CynefinItemLayout, CynefinLayout, CynefinTransitionLayout, Dimensions, LayoutConfig, LayoutResult};
use xmermaid_parser::ast::CynefinAst;

const WIDTH: f64 = 900.0;
const HEIGHT: f64 = 620.0;
const DOMAIN_WIDTH: f64 = 406.0;
const DOMAIN_HEIGHT: f64 = 226.0;
const DOMAIN_GAP: f64 = 48.0;
const TITLE_SPACE: f64 = 72.0;

pub fn layout(diagram: &CynefinAst, config: &LayoutConfig) -> LayoutResult {
    let origin = config.padding;
    let top = origin + TITLE_SPACE;
    let left = origin + 20.0;
    let right = left + DOMAIN_WIDTH + DOMAIN_GAP;
    let bottom = top + DOMAIN_HEIGHT + 66.0;
    let domain_bounds = |id: &str| match id {
        "complex" => Bounds { x: left, y: top, width: DOMAIN_WIDTH, height: DOMAIN_HEIGHT },
        "complicated" => Bounds { x: right, y: top, width: DOMAIN_WIDTH, height: DOMAIN_HEIGHT },
        "chaotic" => Bounds { x: left, y: bottom, width: DOMAIN_WIDTH, height: DOMAIN_HEIGHT },
        "clear" => Bounds { x: right, y: bottom, width: DOMAIN_WIDTH, height: DOMAIN_HEIGHT },
        "confusion" => Bounds { x: origin + WIDTH / 2.0 - 98.0, y: origin + HEIGHT / 2.0 - 50.0, width: 196.0, height: 100.0 },
        _ => Bounds { x: left, y: top, width: DOMAIN_WIDTH, height: DOMAIN_HEIGHT },
    };

    let domains = diagram.domains.iter().map(|domain| {
        let bounds = domain_bounds(&domain.id);
        let items = domain.items.iter().map(|label| CynefinItemLayout { label: label.clone() }).collect();
        CynefinDomainLayout { id: domain.id.clone(), label: title_case(&domain.id), bounds, items }
    }).collect();
    let transitions = diagram.transitions.iter().map(|transition| CynefinTransitionLayout {
        from: transition.from.clone(), to: transition.to.clone(), label: transition.label.clone(),
    }).collect();

    LayoutResult {
        nodes: vec![], edges: vec![], dimensions: Dimensions { width: WIDTH + config.padding * 2.0, height: HEIGHT + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None,
        treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None, wardley: None,
        cynefin: Some(CynefinLayout { title: diagram.title.clone(), domains, transitions }),
    }
}

fn title_case(id: &str) -> String {
    let mut characters = id.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
        None => String::new(),
    }
}
