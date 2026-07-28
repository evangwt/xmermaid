use crate::ast::*;
use crate::error::ParseError;
use crate::lexer::Lexer;
use crate::token::{Token, TokenType};

pub struct Parser<'a> {
    input: &'a str,
    tokens: Vec<Token>,
    pos: usize,
    _input: std::marker::PhantomData<&'a str>,
}

impl<'a> Parser<'a> {
    pub fn new(input: &'a str) -> Self {
        let lexer = Lexer::new(input);
        let mut tokens: Vec<Token> = lexer.collect();
        if tokens.is_empty()
            || tokens
                .last()
                .map(|t| t.ty != TokenType::Eof)
                .unwrap_or(true)
        {
            tokens.push(Token {
                ty: TokenType::Eof,
                value: String::new(),
                line: 0,
            });
        }
        Self {
            input,
            tokens,
            pos: 0,
            _input: std::marker::PhantomData,
        }
    }

    fn current(&self) -> &Token {
        &self.tokens[self.pos.min(self.tokens.len() - 1)]
    }

    fn advance(&mut self) {
        if self.pos < self.tokens.len() - 1 {
            self.pos += 1;
        }
    }

    fn expect(&mut self, ty: TokenType) -> Result<String, ParseError> {
        let token = self.current();
        if token.ty != ty {
            return Err(ParseError::UnexpectedToken(format!(
                "Expected {:?}, got {:?} ('{}') at line {}",
                ty, token.ty, token.value, token.line
            )));
        }
        let value = token.value.clone();
        self.advance();
        Ok(value)
    }

    pub fn parse(&mut self) -> Result<DiagramAst, ParseError> {
        if self.input.trim_start().starts_with("sequenceDiagram") {
            return self.parse_sequence();
        }
        if self.input.trim_start().starts_with("classDiagram") {
            return self.parse_class();
        }
        if self.input.trim_start().starts_with("stateDiagram") { return self.parse_state(); }
        let keyword = self.expect(TokenType::Keyword)?;

        match keyword.as_str() {
            "graph" | "flowchart" => self.parse_flowchart(),
            _ => Err(ParseError::UnsupportedDiagramType(keyword)),
        }
    }

    fn parse_sequence(&self) -> Result<DiagramAst, ParseError> {
        let mut participants = Vec::new();
        let mut messages = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }
            let (from, rest) = statement
                .split_once("-->>")
                .or_else(|| statement.split_once("->>"))
                .or_else(|| statement.split_once("-->"))
                .ok_or_else(|| {
                    ParseError::UnexpectedToken(format!(
                        "Invalid sequence statement: {}",
                        statement
                    ))
                })?;
            let (to, label) = rest.split_once(':').ok_or_else(|| {
                ParseError::UnexpectedToken(format!(
                    "Sequence messages require a label: {}",
                    statement
                ))
            })?;
            let (from, to, label) = (from.trim(), to.trim(), label.trim());
            if from.is_empty() || to.is_empty() || label.is_empty() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Invalid sequence statement: {}",
                    statement
                )));
            }
            if !participants.iter().any(|participant| participant == from) {
                participants.push(from.to_string());
            }
            if !participants.iter().any(|participant| participant == to) {
                participants.push(to.to_string());
            }
            messages.push(SequenceMessage {
                from: from.to_string(),
                to: to.to_string(),
                label: label.to_string(),
            });
        }
        if participants.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Sequence(SequenceAst {
            participants,
            messages,
        }))
    }

    fn parse_class(&self) -> Result<DiagramAst, ParseError> {
        let mut classes = Vec::new();
        let mut relations = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") || statement == "{" || statement == "}" {
                continue;
            }
            if let Some(class) = statement.strip_prefix("class ") {
                let id = class.trim().split_whitespace().next().unwrap_or("");
                if id.is_empty() {
                    return Err(ParseError::UnexpectedToken("Class declarations require a name.".to_string()));
                }
                Self::add_class_if_new(&mut classes, id);
                continue;
            }
            if let Some((parent, child)) = statement.split_once("<|--") {
                let (parent, child) = (parent.trim(), child.trim());
                if parent.is_empty() || child.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Invalid class relation: {}", statement)));
                }
                Self::add_class_if_new(&mut classes, parent);
                Self::add_class_if_new(&mut classes, child);
                relations.push(ClassRelation { from: child.to_string(), to: parent.to_string() });
                continue;
            }
            if let Some((from, to)) = statement.split_once("-->") {
                let (from, to) = (from.trim(), to.trim());
                if from.is_empty() || to.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Invalid class relation: {}", statement)));
                }
                Self::add_class_if_new(&mut classes, from);
                Self::add_class_if_new(&mut classes, to);
                relations.push(ClassRelation { from: from.to_string(), to: to.to_string() });
                continue;
            }
            return Err(ParseError::UnexpectedToken(format!("Invalid class statement: {}", statement)));
        }
        if classes.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Class(ClassAst { classes, relations }))
    }

    fn parse_state(&self) -> Result<DiagramAst, ParseError> {
        let mut states = Vec::new(); let mut transitions = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim(); if statement.is_empty() || statement.starts_with("%%") { continue; }
            let (from, rest) = statement.split_once("-->").ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid state statement: {}", statement)))?;
            let (to, label) = rest.split_once(':').map_or((rest, ""), |(to, label)| (to, label));
            let (from, to) = (from.trim(), to.trim());
            if from.is_empty() || to.is_empty() { return Err(ParseError::UnexpectedToken(format!("Invalid state statement: {}", statement))); }
            if from == "[*]" || to == "[*]" { return Err(ParseError::UnexpectedToken("State start/end pseudostates are not supported yet.".to_string())); }
            for state in [from, to] { if !states.iter().any(|item| item == state) { states.push(state.to_string()); } }
            transitions.push(StateTransition { from: from.to_string(), to: to.to_string(), label: label.trim().to_string() });
        }
        if states.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::State(StateAst { states, transitions }))
    }

    fn add_class_if_new(classes: &mut Vec<ClassDefinition>, id: &str) {
        if !classes.iter().any(|class| class.id == id) {
            classes.push(ClassDefinition { id: id.to_string(), label: id.to_string() });
        }
    }

    fn parse_flowchart(&mut self) -> Result<DiagramAst, ParseError> {
        let dir_value = self.expect(TokenType::Direction)?;
        let direction = match dir_value.as_str() {
            "TD" | "TB" => FlowDirection::TD,
            "BT" => FlowDirection::BT,
            "LR" => FlowDirection::LR,
            "RL" => FlowDirection::RL,
            _ => FlowDirection::TD,
        };

        let mut nodes: Vec<Node> = Vec::new();
        let mut edges: Vec<Edge> = Vec::new();
        let mut subgraphs: Vec<Subgraph> = Vec::new();
        let mut seen_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();

        while self.current().ty != TokenType::Eof {
            self.skip_newlines_and_semicolons();
            if self.current().ty == TokenType::Eof {
                break;
            }

            match self.current().ty {
                TokenType::Keyword => {
                    match self.current().value.as_str() {
                        "subgraph" => {
                            let sg =
                                self.parse_subgraph(&mut nodes, &mut edges, &mut seen_nodes)?;
                            subgraphs.push(sg);
                        }
                        "classDef" | "class" | "style" | "click" => {
                            // Skip style-related statements (not yet fully supported)
                            self.skip_statement();
                        }
                        "end" => {
                            // end outside subgraph — skip
                            self.advance();
                        }
                        _ => {
                            return Err(ParseError::UnexpectedToken(format!(
                                "Unexpected keyword '{}' in flowchart body",
                                self.current().value
                            )));
                        }
                    }
                }
                TokenType::NodeId => {
                    self.parse_flowchart_statement(&mut nodes, &mut edges, &mut seen_nodes)?;
                }
                _ => {
                    // Skip unknown tokens
                    self.advance();
                }
            }
        }

        Ok(DiagramAst::Flowchart(FlowchartAst {
            direction,
            nodes,
            edges,
            subgraphs,
        }))
    }

    fn skip_statement(&mut self) {
        // Consume tokens until newline, semicolon, or EOF
        while self.current().ty != TokenType::Newline
            && self.current().ty != TokenType::Semicolon
            && self.current().ty != TokenType::Eof
        {
            self.advance();
        }
    }

    fn parse_subgraph(
        &mut self,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        seen_nodes: &mut std::collections::HashSet<String>,
    ) -> Result<Subgraph, ParseError> {
        self.expect(TokenType::Keyword)?; // consume "subgraph"

        // Subgraph title: could be a NodeId, or a NodeId followed by bracketed label
        let title = if self.current().ty == TokenType::NodeId {
            let id = self.current().value.clone();
            self.advance();
            // Check for bracketed title: subgraph myId [My Title]
            if self.current().ty == TokenType::BracketOpen {
                self.advance();
                let label = if self.current().ty == TokenType::Label {
                    let v = self.current().value.clone();
                    self.advance();
                    v
                } else {
                    String::new()
                };
                if self.current().ty == TokenType::BracketClose {
                    self.advance();
                }
                // If bracketed label exists, use it as title; otherwise use id
                if label.is_empty() {
                    id
                } else {
                    label
                }
            } else {
                id
            }
        } else if self.current().ty == TokenType::BracketOpen {
            self.advance();
            let t = if self.current().ty == TokenType::Label {
                let v = self.current().value.clone();
                self.advance();
                v
            } else {
                String::new()
            };
            if self.current().ty == TokenType::BracketClose {
                self.advance();
            }
            t
        } else {
            String::new()
        };

        // Optional direction after title
        if self.current().ty == TokenType::Direction {
            self.advance();
        }

        self.skip_newlines_and_semicolons();

        let mut sg_nodes: Vec<String> = Vec::new();
        let mut sg_subgraphs: Vec<Subgraph> = Vec::new();

        while self.current().ty != TokenType::Eof {
            self.skip_newlines_and_semicolons();
            if self.current().ty == TokenType::Eof {
                break;
            }
            if self.current().ty == TokenType::Keyword && self.current().value == "end" {
                self.advance();
                break;
            }

            match self.current().ty {
                TokenType::Keyword => {
                    if self.current().value == "subgraph" {
                        let nested = self.parse_subgraph(nodes, edges, seen_nodes)?;
                        sg_subgraphs.push(nested);
                    } else if self.current().value == "direction" {
                        // direction LR inside subgraph — consume and skip
                        self.advance(); // consume "direction"
                        if self.current().ty == TokenType::Direction {
                            self.advance(); // consume direction value
                        }
                    } else {
                        self.skip_statement();
                    }
                }
                TokenType::NodeId => {
                    self.parse_flowchart_statement(nodes, edges, seen_nodes)?;
                    // Track nodes added in this subgraph
                    // We add all node IDs that were just added
                    // Simple approach: track the last node added
                    if let Some(last) = nodes.last() {
                        if !sg_nodes.contains(&last.id) {
                            sg_nodes.push(last.id.clone());
                        }
                    }
                }
                _ => {
                    self.advance();
                }
            }
        }

        Ok(Subgraph {
            title,
            nodes: sg_nodes,
            subgraphs: sg_subgraphs,
        })
    }

    fn skip_newlines_and_semicolons(&mut self) {
        while self.current().ty == TokenType::Newline || self.current().ty == TokenType::Semicolon {
            self.advance();
        }
    }

    fn add_node_if_new(
        nodes: &mut Vec<Node>,
        seen: &mut std::collections::HashSet<String>,
        id: String,
        label: Option<String>,
        shape: NodeShape,
    ) {
        if !seen.contains(&id) {
            nodes.push(Node {
                id: id.clone(),
                label,
                shape,
                classes: Vec::new(),
                styles: Vec::new(),
            });
            seen.insert(id);
        }
    }

    fn parse_node_shape_and_label(&mut self) -> (NodeShape, Option<String>) {
        // Asymmetric shape: >text] — in Mermaid, > opens and ] closes
        if self.current().ty == TokenType::AngleClose {
            self.advance(); // consume >
                            // Read label content until ]
            let label = if self.current().ty == TokenType::Label {
                let v = self.current().value.clone();
                self.advance();
                Some(v)
            } else {
                None
            };
            if self.current().ty == TokenType::BracketClose {
                self.advance();
            }
            return (NodeShape::Asymmetric, label);
        }

        // Parallelogram: [/text/]
        if self.current().ty == TokenType::BracketOpen {
            self.advance(); // consume [
                            // The lexer enters InLabel(']') after [, so the next token is either
                            // a Label (content inside brackets) or BracketClose (empty brackets).
                            // We inspect the label content for [/.../], [\...\], [[...]] patterns.
            if self.current().ty == TokenType::Label {
                let label_val = self.current().value.clone();
                // Check for parallelogram: label starts with /
                if label_val.starts_with('/') {
                    self.advance(); // consume the Label token
                    let inner_label = label_val[1..].trim().to_string();
                    // Check for trailing /
                    let inner_label = if inner_label.ends_with('/') {
                        inner_label[..inner_label.len() - 1].trim().to_string()
                    } else {
                        inner_label
                    };
                    if self.current().ty == TokenType::BracketClose {
                        self.advance();
                    }
                    let label = if inner_label.is_empty() {
                        None
                    } else {
                        Some(inner_label)
                    };
                    return (NodeShape::Parallelogram, label);
                }
                // Check for trapezoid: label starts with \
                if label_val.starts_with('\\') {
                    self.advance(); // consume the Label token
                    let inner_label = label_val[1..].trim().to_string();
                    // Check for trailing \
                    let inner_label = if inner_label.ends_with('\\') {
                        inner_label[..inner_label.len() - 1].trim().to_string()
                    } else {
                        inner_label
                    };
                    if self.current().ty == TokenType::BracketClose {
                        self.advance();
                    }
                    let label = if inner_label.is_empty() {
                        None
                    } else {
                        Some(inner_label)
                    };
                    return (NodeShape::Trapezoid, label);
                }
                // Check for subroutine: label starts with [
                if label_val.starts_with('[') {
                    self.advance(); // consume the Label token
                    let inner_label = label_val[1..].trim().to_string();
                    if self.current().ty == TokenType::BracketClose {
                        self.advance(); // first ]
                    }
                    // Subroutine has two closing brackets: [[text]] — the lexer
                    // produces Label("[text") then BracketClose then BracketClose
                    if self.current().ty == TokenType::BracketClose {
                        self.advance(); // second ]
                    }
                    let label = if inner_label.is_empty() {
                        None
                    } else {
                        Some(inner_label)
                    };
                    return (NodeShape::Subroutine, label);
                }
                // Regular rect: [text]
                self.advance(); // consume the Label token
                let label = if label_val.is_empty() {
                    None
                } else {
                    Some(label_val)
                };
                if self.current().ty == TokenType::BracketClose {
                    self.advance();
                }
                return (NodeShape::Rect, label);
            }
            // Empty brackets: []
            if self.current().ty == TokenType::BracketClose {
                self.advance();
            }
            return (NodeShape::Rect, None);
        }

        // Parentheses: (text) or ((text)) for circle or (((text))) for double circle
        if self.current().ty == TokenType::ParenOpen {
            self.advance(); // consume first (

            // The lexer's InLabel state for ( may produce a Label that starts
            // with ( or (( for nested parens like ((circle)) or (((triple)))
            let mut paren_depth: usize = 0;
            let label_val = if self.current().ty == TokenType::Label {
                let v = self.current().value.clone();
                self.advance();
                // Count leading ( chars in label value
                paren_depth = v.chars().take_while(|c| *c == '(').count();
                let trimmed = v[paren_depth..].trim().to_string();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            } else {
                None
            };

            // Count closing parens
            let close_count = self.count_and_consume_paren_closes();

            let shape = if paren_depth >= 2 && close_count >= 3 {
                NodeShape::DoubleCircle
            } else if paren_depth >= 1 && close_count >= 2 {
                NodeShape::Circle
            } else {
                NodeShape::Rounded
            };

            return (shape, label_val);
        }

        // Curly braces: {text} for diamond or {{text}} for hexagon
        if self.current().ty == TokenType::BraceOpen {
            self.advance(); // consume first {

            // Similar to parens: lexer InLabel may produce Label starting with {
            let mut brace_depth: usize = 0;
            let label_val = if self.current().ty == TokenType::Label {
                let v = self.current().value.clone();
                self.advance();
                brace_depth = v.chars().take_while(|c| *c == '{').count();
                let trimmed = v[brace_depth..].trim().to_string();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            } else {
                None
            };

            let close_count = self.count_and_consume_brace_closes();

            let shape = if brace_depth >= 1 && close_count >= 2 {
                NodeShape::Hexagon
            } else {
                NodeShape::Diamond
            };

            return (shape, label_val);
        }

        (NodeShape::Rect, None)
    }

    fn count_and_consume_paren_closes(&mut self) -> usize {
        let mut count = 0;
        while self.current().ty == TokenType::ParenClose {
            self.advance();
            count += 1;
        }
        count
    }

    fn count_and_consume_brace_closes(&mut self) -> usize {
        let mut count = 0;
        while self.current().ty == TokenType::BraceClose {
            self.advance();
            count += 1;
        }
        count
    }

    fn parse_edge_label(&mut self) -> Option<String> {
        // Edge label: |text| between arrow parts
        if self.current().ty == TokenType::Pipe {
            self.advance(); // consume opening |
            let mut label_parts: Vec<String> = Vec::new();
            while self.current().ty != TokenType::Pipe
                && self.current().ty != TokenType::Eof
                && self.current().ty != TokenType::Newline
            {
                label_parts.push(self.current().value.clone());
                self.advance();
            }
            if self.current().ty == TokenType::Pipe {
                self.advance(); // consume closing |
            }
            let label = label_parts.join(" ").trim().to_string();
            if label.is_empty() {
                None
            } else {
                Some(label)
            }
        } else {
            None
        }
    }

    fn parse_flowchart_statement(
        &mut self,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        seen_nodes: &mut std::collections::HashSet<String>,
    ) -> Result<(), ParseError> {
        let node_id = self.expect(TokenType::NodeId)?;
        let (shape, label) = self.parse_node_shape_and_label();

        Self::add_node_if_new(nodes, seen_nodes, node_id.clone(), label, shape);

        // Parse chain of edges: A-->B-->C
        let mut current_id = node_id;
        while self.current().ty == TokenType::Arrow {
            let arrow = self.current().value.clone();
            self.advance();

            let style = match arrow.as_str() {
                "-->" => EdgeStyle::Arrow,
                "---" => EdgeStyle::Line,
                "-.->" | "-.-" => EdgeStyle::Dotted,
                "==>" => EdgeStyle::Thick,
                "~~~" => EdgeStyle::Invisible,
                _ => EdgeStyle::Arrow,
            };

            // Optional edge label: |text|
            let edge_label = self.parse_edge_label();

            let target_id = self.expect(TokenType::NodeId)?;
            let (target_shape, target_label) = self.parse_node_shape_and_label();

            Self::add_node_if_new(
                nodes,
                seen_nodes,
                target_id.clone(),
                target_label,
                target_shape,
            );

            edges.push(Edge {
                from: current_id,
                to: target_id.clone(),
                style,
                label: edge_label,
                min_length: 1,
            });

            current_id = target_id;
        }

        // Handle & operator: A & B means both on same line
        while self.current().ty == TokenType::Ampersand {
            self.advance(); // consume &
            if self.current().ty == TokenType::NodeId {
                let next_id = self.current().value.clone();
                self.advance();
                let (next_shape, next_label) = self.parse_node_shape_and_label();
                Self::add_node_if_new(nodes, seen_nodes, next_id, next_label, next_shape);
            }
        }

        Ok(())
    }
}

pub fn parse_input(input: &str) -> Result<DiagramAst, ParseError> {
    let mut parser = Parser::new(input);
    parser.parse()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse;

    #[test]
    fn test_parse_simple_flowchart() {
        let ast = parse("graph TD\n  A-->B").unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes.len(), 2);
                assert_eq!(fc.edges.len(), 1);
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_node_shapes() {
        let ast = parse("graph TD\n  A[Rect]-->B(Rounded)").unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
                assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_edge_with_label() {
        let ast = parse("graph TD\n  A-->|yes|B").unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.edges[0].label, Some("yes".to_string()));
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_invalid_syntax() {
        assert!(parse("not a diagram").is_err());
    }

    #[test]
    fn test_parse_empty_flowchart() {
        let ast = parse("graph TD").unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert!(fc.nodes.is_empty());
                assert!(fc.edges.is_empty());
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_directions() {
        let td = parse("graph TD\n  A-->B").unwrap();
        let lr = parse("graph LR\n  A-->B").unwrap();
        match (td, lr) {
            (DiagramAst::Flowchart(fc_td), DiagramAst::Flowchart(fc_lr)) => {
                assert_eq!(fc_td.direction, FlowDirection::TD);
                assert_eq!(fc_lr.direction, FlowDirection::LR);
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}
