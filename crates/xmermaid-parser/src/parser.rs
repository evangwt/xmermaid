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

    fn expect_flowchart_class_identifier(&mut self) -> Result<String, ParseError> {
        if !matches!(self.current().ty, TokenType::NodeId | TokenType::Direction) {
            return Err(ParseError::UnexpectedToken(format!(
                "Expected flowchart class identifier, got {:?} ('{}') at line {}",
                self.current().ty,
                self.current().value,
                self.current().line,
            )));
        }
        let value = self.current().value.clone();
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
        if self.input.trim_start().starts_with("erDiagram") { return self.parse_er(); }
        if self.input.trim_start().starts_with("gantt") { return self.parse_gantt(); }
        if self.input.trim_start().starts_with("pie") { return self.parse_pie(); }
        if self.input.trim_start().starts_with("journey") { return self.parse_user_journey(); }
        if self.input.trim_start().starts_with("timeline") { return self.parse_timeline(); }
        if self.input.trim_start().starts_with("mindmap") { return self.parse_mindmap(); }
        if self.input.trim_start().split_once('\n').map(|(line, _)| line.trim()).unwrap_or_else(|| self.input.trim()) == "tree" { return self.parse_treeview(); }
        if self.input.trim_start().starts_with("requirementDiagram") { return self.parse_requirement(); }
        if self.input.trim_start().starts_with("gitGraph") { return self.parse_gitgraph(); }
        if self.input.trim_start().starts_with("C4") { return self.parse_c4(); }
        if self.input.trim_start().starts_with("zenuml") { return self.parse_zenuml(); }
        if self.input.trim_start().starts_with("xychart") { return self.parse_xychart(); }
        if self.input.trim_start().starts_with("sankey") { return self.parse_sankey(); }
        if self.input.trim_start().starts_with("quadrantChart") { return self.parse_quadrant(); }
        if self.input.trim_start().starts_with("architecture") { return self.parse_architecture(); }
        if self.input.trim_start().starts_with("block") { return self.parse_block(); }
        if self.input.trim_start().starts_with("kanban") { return self.parse_kanban(); }
        if self.input.trim_start().starts_with("treemap") { return self.parse_treemap(); }
        if self.input.trim_start().starts_with("radar") { return self.parse_radar(); }
        if self.input.trim_start().starts_with("packet") { return self.parse_packet(); }
        if self.input.trim_start().starts_with("venn") { return self.parse_venn(); }
        if self.input.trim_start().starts_with("swimlane") { return self.parse_swimlanes(); }
        if self.input.trim_start().starts_with("ishikawa") { return self.parse_ishikawa(); }
        if self.input.trim_start().lines().next().map(str::trim).is_some_and(|line| line.eq_ignore_ascii_case("eventmodeling")) { return self.parse_event_modeling(); }
        if self.input.trim_start().starts_with("wardley") { return self.parse_wardley(); }
        if self.input.trim_start().starts_with("cynefin") { return self.parse_cynefin(); }
        let keyword = self.expect(TokenType::Keyword)?;

        match keyword.as_str() {
            "graph" | "flowchart" => self.parse_flowchart(),
            _ => Err(ParseError::UnsupportedDiagramType(keyword)),
        }
    }

    fn parse_sequence(&self) -> Result<DiagramAst, ParseError> {
        let mut participants = Vec::new();
        let mut messages = Vec::new();
        let mut events = Vec::new();
        let mut blocks = Vec::new();
        let mut boxes = Vec::<SequenceBox>::new();
        let mut open_activations = std::collections::HashMap::<String, usize>::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }

            // `box [color] [label]` opens a participant group; `end` closes it
            // when no control block is open.
            if let Some(box_group) = parse_sequence_box_start(statement)? {
                boxes.push(box_group);
                continue;
            }
            if statement.eq_ignore_ascii_case("end") && blocks.is_empty() && !boxes.is_empty() {
                continue; // box group closed; membership was recorded on the fly
            }

            // `create participant X` / `create actor X` / `destroy X`
            if let Some(created) = parse_sequence_create(statement)? {
                let created_id = created.participant.id.clone();
                upsert_sequence_participant(&mut participants, created.participant);
                register_box_membership(&mut boxes, &participants);
                events.push(SequenceEvent::Create { participant: created_id });
                continue;
            }
            if let Some(destroyed) = parse_sequence_destroy(statement)? {
                add_inferred_sequence_participant(&mut participants, &destroyed);
                register_box_membership(&mut boxes, &participants);
                events.push(SequenceEvent::Destroy { participant: destroyed });
                continue;
            }

            if let Some(participant) = parse_sequence_participant(statement)? {
                upsert_sequence_participant(&mut participants, participant);
                register_box_membership(&mut boxes, &participants);
                continue;
            }
            if let Some(note) = parse_sequence_note(statement)? {
                for participant in &note.participants {
                    add_inferred_sequence_participant(&mut participants, participant);
                }
                register_box_membership(&mut boxes, &participants);
                events.push(note.into_event());
                continue;
            }
            if let Some(activation) = parse_sequence_activation(statement)? {
                add_inferred_sequence_participant(&mut participants, &activation.participant);
                register_box_membership(&mut boxes, &participants);
                if activation.active {
                    open_sequence_activation(&mut open_activations, &activation.participant);
                } else {
                    close_sequence_activation(&mut open_activations, &activation.participant, statement)?;
                }
                events.push(SequenceEvent::Activation {
                    participant: activation.participant,
                    active: activation.active,
                });
                continue;
            }
            if statement.to_ascii_lowercase().starts_with("autonumber") {
                let remainder = statement[10..].trim();
                let (start, increment) = if remainder.is_empty() {
                    (1, 1)
                } else {
                    let mut values = remainder.split_whitespace().map(|value| {
                        value.parse::<u32>().ok().filter(|value| *value > 0).ok_or_else(|| {
                            ParseError::UnexpectedToken(format!(
                                "Sequence autonumber offsets must be positive integers: {}",
                                statement
                            ))
                        })
                    });
                    let start = values.next().transpose()?.unwrap_or(1);
                    let increment = values.next().transpose()?.unwrap_or(1);
                    if values.next().is_some() {
                        return Err(ParseError::UnexpectedToken(format!(
                            "Sequence autonumber accepts at most two integers: {}", statement
                        )));
                    }
                    (start, increment)
                };
                events.push(SequenceEvent::Autonumber { start, increment });
                continue;
            }
            if let Some(event) = parse_sequence_control(statement, &mut blocks)? {
                events.push(event);
                continue;
            }
            if let Some(message) = parse_sequence_message(statement)? {
                add_inferred_sequence_participant(&mut participants, &message.from);
                add_inferred_sequence_participant(&mut participants, &message.to);
                register_box_membership(&mut boxes, &participants);
                if message.activate_target {
                    open_sequence_activation(&mut open_activations, &message.to);
                }
                if message.deactivate_source {
                    close_sequence_activation(&mut open_activations, &message.from, statement)?;
                }
                let message_index = messages.len();
                messages.push(message);
                events.push(SequenceEvent::Message { message_index });
                continue;
            }
            return Err(ParseError::UnexpectedToken(format!(
                "Invalid sequence statement: {}",
                statement
            )));
        }
        if participants.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        if let Some(block) = blocks.last() {
            return Err(ParseError::UnexpectedToken(format!(
                "Sequence control block {:?} is missing end",
                block
            )));
        }
        Ok(DiagramAst::Sequence(SequenceAst {
            participants,
            messages,
            events,
            boxes,
        }))
    }

    fn parse_class(&self) -> Result<DiagramAst, ParseError> {
        let mut classes: Vec<ClassDefinition> = Vec::new();
        let mut relations = Vec::new();
        let mut namespaces = Vec::new();
        let mut styles = Vec::new();
        let mut member_target: Option<String> = None;

        let mut lines = self.input.lines().skip(1).peekable();
        while let Some(line) = lines.next() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") || statement == "{" || statement == "}" {
                continue;
            }

            // Members on an open class block continue until the closing brace.
            if let Some(id) = &member_target {
                if let Some(annotation) = statement.strip_prefix("<<").and_then(|rest| rest.strip_suffix(">>")) {
                    if let Some(class) = classes.iter_mut().find(|class| &class.id == id) {
                        class.annotation = Some(format!("<<{}>>", annotation.trim()));
                    }
                    continue;
                }
                if let Some(class) = classes.iter_mut().find(|class| &class.id == id) {
                    class.members.push(statement.to_string());
                }
                continue;
            }

            // `class Foo {` opens a member block; `class Foo` declares an empty class.
            if let Some(rest) = statement.strip_prefix("class ") {
                let rest = rest.trim();
                if rest.ends_with('{') {
                    let id = rest[..rest.len() - 1].trim();
                    if id.is_empty() {
                        return Err(ParseError::UnexpectedToken("Class declarations require a name.".to_string()));
                    }
                    Self::upsert_class(&mut classes, id);
                    member_target = Some(id.to_string());
                    continue;
                }
                let id = rest.split_whitespace().next().unwrap_or("");
                if id.is_empty() {
                    return Err(ParseError::UnexpectedToken("Class declarations require a name.".to_string()));
                }
                Self::upsert_class(&mut classes, id);
                continue;
            }

            if let Some(relation) = parse_class_relation(statement)? {
                Self::upsert_class(&mut classes, &relation.from);
                Self::upsert_class(&mut classes, &relation.to);
                relations.push(relation);
                continue;
            }

            // Member shorthand: `Foo : +int size` (repeats append to the same class).
            if let Some((id, member)) = statement.split_once(" : ") {
                let id = id.trim();
                if member.trim().is_empty() || id.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Invalid class member: {}", statement)));
                }
                Self::upsert_class(&mut classes, id);
                if let Some(class) = classes.iter_mut().find(|class| class.id == id) {
                    class.members.push(member.trim().to_string());
                }
                continue;
            }

            // Namespace container: `namespace Foo {` … `}`.
            if let Some(rest) = statement.strip_prefix("namespace ") {
                let (id, inline) = rest.trim().split_once('{').ok_or_else(|| {
                    ParseError::UnexpectedToken(format!(
                        "Class namespaces require braces: {}", statement
                    ))
                })?;
                let id = id.trim();
                if id.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Class namespaces require an identifier: {}", statement
                    )));
                }
                let mut namespace = ClassNamespace { id: id.to_string(), classes: Vec::new() };
                let mut body = inline.trim().to_string();
                if !body.ends_with('}') {
                    let mut closed = false;
                    for inner in lines.by_ref() {
                        let inner_statement = inner.trim();
                        if inner_statement == "}" {
                            closed = true;
                            break;
                        }
                        if !body.is_empty() {
                            body.push('\n');
                        }
                        body.push_str(inner_statement);
                    }
                    if !closed {
                        return Err(ParseError::UnexpectedToken(format!(
                            "Class namespace is missing a closing brace: {}", id
                        )));
                    }
                }
                for inner_statement in body.lines() {
                    let inner_statement = inner_statement.trim();
                    if inner_statement.is_empty() || inner_statement.starts_with("%%") {
                        continue;
                    }
                    if let Some(class_source) = inner_statement.strip_prefix("class ") {
                        let class_id = class_source.trim().split_whitespace().next().unwrap_or_default();
                        if class_id.is_empty() {
                            return Err(ParseError::UnexpectedToken(format!(
                                "Class declarations require a name: {}", inner_statement
                            )));
                        }
                        Self::upsert_class_in_namespace(&mut classes, class_id, &namespace.id);
                        namespace.classes.push(class_id.to_string());
                        continue;
                    }
                    if let Some(relation) = parse_class_relation(inner_statement)? {
                        Self::upsert_class_in_namespace(&mut classes, &relation.from, &namespace.id);
                        Self::upsert_class_in_namespace(&mut classes, &relation.to, &namespace.id);
                        relations.push(relation);
                        continue;
                    }
                    return Err(ParseError::UnexpectedToken(format!(
                        "Invalid class namespace statement: {}", inner_statement
                    )));
                }
                namespaces.push(namespace);
                continue;
            }

            // Style directive: `style Foo fill:#f00, color: white`
            if let Some(rest) = statement.strip_prefix("style ") {
                let (class_id, properties) = rest.trim().split_once(char::is_whitespace).ok_or_else(|| {
                    ParseError::UnexpectedToken(format!("Class style requires properties: {}", statement))
                })?;
                let class_id = class_id.trim();
                if class_id.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Class style requires a class name: {}", statement)));
                }
                let style = parse_class_style_properties(properties.trim())?;
                styles.push(ClassStyleAssignment { class: class_id.to_string(), style });
                continue;
            }

            // Classifier annotation: `<<interface>> Shape`
            if let Some((_, rest)) = statement.split_once("<<").and_then(|(head, tail)| tail.strip_suffix(">>").map(|inner| (head, inner))) {
                let id = statement.split_once("<<").map(|(head, _)| head.trim()).unwrap_or_default();
                if id.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Invalid class annotation: {}", statement)));
                }
                Self::upsert_class(&mut classes, id);
                if let Some(class) = classes.iter_mut().find(|class| class.id == id) {
                    class.annotation = Some(format!("<<{}>>", rest.trim()));
                }
                continue;
            }

            return Err(ParseError::UnexpectedToken(format!("Invalid class statement: {}", statement)));
        }
        if classes.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Class(ClassAst { classes, relations, namespaces, styles }))
    }

    fn parse_state(&self) -> Result<DiagramAst, ParseError> {
        let mut states: Vec<StateNode> = Vec::new();
        let mut transitions = Vec::new();
        let mut notes = Vec::new();
        let mut active_composite: Option<String> = None;

        let mut ensure_state = |states: &mut Vec<StateNode>, id: &str, composite: bool, parent: Option<&str>| {
            if let Some(existing) = states.iter_mut().find(|state| state.id == id) {
                if composite {
                    existing.composite = true;
                }
                if existing.parent.is_none() {
                    existing.parent = parent.map(str::to_string);
                }
            } else {
                states.push(StateNode {
                    id: id.to_string(),
                    label: None,
                    pseudostate: None,
                    composite,
                    parent: parent.map(str::to_string),
                });
            }
        };

        let mut lines = self.input.lines().skip(1).peekable();
        while let Some(line) = lines.next() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }

            // Notes: `note right of X : text`, or a block `note left of X` … `end note`.
            if let Some(note) = parse_state_note_prefix(statement)? {
                if let Some(text) = note.inline_text {
                    notes.push(StateNote {
                        target: note.target,
                        placement: note.placement,
                        text,
                    });
                } else {
                    let mut body = String::new();
                    let mut closed = false;
                    for inner in lines.by_ref() {
                        let inner_statement = inner.trim();
                        if inner_statement.eq_ignore_ascii_case("end note") {
                            closed = true;
                            break;
                        }
                        if !body.is_empty() {
                            body.push(' ');
                        }
                        body.push_str(inner_statement);
                    }
                    if !closed {
                        return Err(ParseError::UnexpectedToken(format!(
                            "State note block is missing `end note`: {}", statement
                        )));
                    }
                    if body.is_empty() {
                        return Err(ParseError::UnexpectedToken(format!(
                            "State notes require text: {}", statement
                        )));
                    }
                    notes.push(StateNote { target: note.target, placement: note.placement, text: body });
                }
                continue;
            }

            // Composite state: `state s2 { ... }` on a single line, or a block
            // of `state s2 {` … `}` lines whose transitions are flattened.
            let composite_body = if let Some(rest) = statement.strip_prefix("state ") {
                if let Some(open) = rest.strip_suffix('{') {
                    let id = open.trim();
                    if id.is_empty() {
                        return Err(ParseError::UnexpectedToken(format!("Invalid state declaration: {}", statement)));
                    }
                    ensure_state(&mut states, id, true, active_composite.as_deref());
                    let enclosing = active_composite.take();
                    active_composite = Some(id.to_string());
                    let mut body = String::new();
                    let mut closed = false;
                    for inner in lines.by_ref() {
                        if inner.trim() == "}" {
                            closed = true;
                            break;
                        }
                        body.push_str(inner);
                        body.push('\n');
                    }
                    active_composite = enclosing;
                    if !closed {
                        return Err(ParseError::UnexpectedToken(format!("State composite is missing a closing brace: {}", id)));
                    }
                    Some((id.to_string(), body))
                } else if rest.contains('{') {
                    // Single-line composite: `state s2 { [*] --> s2a }`
                    let (id, body) = rest.split_once('{').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid state declaration: {}", statement)))?;
                    let body = body.strip_suffix('}').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid state declaration: {}", statement)))?;
                    ensure_state(&mut states, id.trim(), true, active_composite.as_deref());
                    Some((id.trim().to_string(), body.to_string()))
                } else {
                    None
                }
            } else {
                None
            };

            if let Some((_id, body)) = composite_body {
                let parent_id = _id;
                for inner_line in body.lines() {
                    let inner_statement = inner_line.trim();
                    if inner_statement.is_empty() || inner_statement.starts_with("%%") {
                        continue;
                    }
                    if let Some(rest) = inner_statement.strip_prefix("state ") {
                        if rest.contains("<<") {
                            if let Some((alias_id, classifier)) = parse_state_classifier(rest)? {
                                ensure_state(&mut states, &alias_id, false, Some(&parent_id));
                                if let Some(existing) = states.iter_mut().find(|state| state.id == alias_id) {
                                    existing.pseudostate = classifier;
                                    existing.label = None;
                                }
                                continue;
                            }
                        } else {
                            let (alias_id, alias_label) = parse_state_alias(rest)?;
                            ensure_state(&mut states, &alias_id, false, Some(&parent_id));
                            if let Some(label) = alias_label {
                                if let Some(existing) = states.iter_mut().find(|state| state.id == alias_id) {
                                    existing.label = Some(label);
                                }
                            }
                            continue;
                        }
                    }
                    if let Some(note) = parse_state_note_prefix(inner_statement)? {
                        if let Some(text) = note.inline_text {
                            notes.push(StateNote { target: note.target, placement: note.placement, text });
                        }
                        continue;
                    }
                    // Concurrent region separators (`--`) are accepted; regions
                    // are flattened into one graph (surfaced as a diagnostic).
                    if inner_statement == "--" {
                        continue;
                    }
                    let (from, to, label) = parse_state_transition(inner_statement)?;
                    let from = resolve_state_id(&from, TransitionSide::From);
                    let to = resolve_state_id(&to, TransitionSide::To);
                    ensure_state(&mut states, &from, false, Some(&parent_id));
                    ensure_state(&mut states, &to, false, Some(&parent_id));
                    transitions.push(StateTransition { from, to, label });
                }
                continue;
            }

            // Named state declaration with optional display name:
            // `state "Long name" as s2`, `state s2`, or `state s2 <<choice>>`
            if let Some(rest) = statement.strip_prefix("state ") {
                if let Some((id, classifier)) = parse_state_classifier(rest)? {
                    ensure_state(&mut states, &id, false, active_composite.as_deref());
                    if let Some(existing) = states.iter_mut().find(|state| state.id == id) {
                        existing.pseudostate = classifier;
                        existing.label = None;
                    }
                    continue;
                }
                let (id, label) = parse_state_alias(rest)?;
                ensure_state(&mut states, &id, false, active_composite.as_deref());
                if let Some(label) = label {
                    if let Some(existing) = states.iter_mut().find(|state| state.id == id) {
                        existing.label = Some(label);
                    }
                }
                continue;
            }

            let (from, to, label) = parse_state_transition(statement)?;
            let from = resolve_state_id(&from, TransitionSide::From);
            let to = resolve_state_id(&to, TransitionSide::To);
            ensure_state(&mut states, &from, false, active_composite.as_deref());
            ensure_state(&mut states, &to, false, active_composite.as_deref());
            transitions.push(StateTransition { from, to, label });
        }

        if states.is_empty() {
            return Err(ParseError::EmptyInput);
        }

        // Classify pseudostate nodes so layout can draw start/end markers.
        for state in states.iter_mut() {
            if state.id == "__start__" {
                state.pseudostate = Some(StatePseudostate::Start);
                state.label = None;
            } else if state.id == "__end__" {
                state.pseudostate = Some(StatePseudostate::End);
                state.label = None;
            }
        }

        Ok(DiagramAst::State(StateAst { states, transitions, notes }))
    }
    fn parse_er(&self) -> Result<DiagramAst, ParseError> {
        let mut entities: Vec<ErEntity> = Vec::new();
        let mut relationships = Vec::new();

        let mut upsert_entity = |entities: &mut Vec<ErEntity>, name: &str, attributes: Vec<ErAttribute>| {
            if let Some(existing) = entities.iter_mut().find(|entity| entity.name == name) {
                if !attributes.is_empty() {
                    existing.attributes = attributes;
                }
            } else {
                entities.push(ErEntity { name: name.to_string(), attributes });
            }
        };

        let mut lines = self.input.lines().skip(1).peekable();
        while let Some(line) = lines.next() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }

            // Attribute block: `ENTITY {` … `}` (multi-line) or a single-line
            // `ENTITY { int id PK "comment" }` declaration.
            if statement.contains('{') && !statement.contains("--") && !statement.contains("..") {
                let (name, inline_body) = statement.split_once('{').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid ER entity: {}", statement)))?;
                let name = name.trim();
                if name.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Invalid ER entity: {}", statement)));
                }
                let mut body = inline_body.to_string();
                if !body.trim_end().ends_with('}') {
                    let mut closed = false;
                    for inner in lines.by_ref() {
                        if inner.trim() == "}" {
                            closed = true;
                            break;
                        }
                        body.push_str(inner);
                        body.push('\n');
                    }
                    if !closed {
                        return Err(ParseError::UnexpectedToken(format!("ER entity block is missing a closing brace: {}", name)));
                    }
                }
                let trimmed = body.trim();
                let body = trimmed.strip_suffix('}').unwrap_or(trimmed);
                let attributes = parse_er_attributes(body)?;
                upsert_entity(&mut entities, name, attributes);
                continue;
            }

            let Some(relationship) = parse_er_relationship(statement) else {
                return Err(ParseError::UnexpectedToken(format!(
                    "Invalid ER statement: {}",
                    statement
                )));
            };
            upsert_entity(&mut entities, &relationship.from, Vec::new());
            upsert_entity(&mut entities, &relationship.to, Vec::new());
            relationships.push(relationship);
        }

        if entities.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Er(ErAst {
            entities,
            relationships,
        }))
    }

    fn parse_gantt(&self) -> Result<DiagramAst, ParseError> {
        let mut section = String::new();
        let mut title = String::new();
        let mut date_format = "YYYY-MM-DD".to_string();
        let mut excludes = Vec::new();
        let mut tasks = Vec::new();

        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }
            if let Some(value) = statement.strip_prefix("section ") {
                section = value.trim().to_string();
                continue;
            }
            if let Some(value) = statement.strip_prefix("title ") {
                title = value.trim().trim_matches('"').to_string();
                continue;
            }
            if let Some(value) = statement.strip_prefix("dateFormat ") {
                date_format = parse_gantt_date_format(value.trim())?;
                continue;
            }
            if let Some(value) = statement.strip_prefix("excludes ") {
                for token in value.split(',') {
                    let token = token.trim();
                    let exclusion = parse_gantt_exclusion(token, &date_format)?;
                    excludes.push(exclusion);
                }
                continue;
            }
            if statement.starts_with("axisFormat ")
                || statement.starts_with("todayMarker ")
                || statement.starts_with("inclusive ")
            {
                continue;
            }

            let task = parse_gantt_task(statement, &section, &date_format, tasks.len())?;
            tasks.push(task);
        }

        if tasks.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Gantt(GanttAst { title, tasks, excludes }))
    }

    fn parse_pie(&self) -> Result<DiagramAst, ParseError> {
        let mut title = String::new();
        let mut show_data = false;
        let mut slices = Vec::new();
        for line in self.input.lines() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("pie title ") { title = value.trim().to_string(); continue; }
            if statement.eq_ignore_ascii_case("pie") { continue; }
            if statement.eq_ignore_ascii_case("pie showdata") { show_data = true; continue; }
            if statement.eq_ignore_ascii_case("showdata") { show_data = true; continue; }
            let (label, value) = statement.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid Pie slice: {}", statement)))?;
            let label = label.trim().trim_matches('"');
            let value = value.trim().parse::<f64>().map_err(|_| ParseError::UnexpectedToken(format!("Pie values must be numeric: {}", statement)))?;
            if label.is_empty() || value <= 0.0 { return Err(ParseError::UnexpectedToken(format!("Invalid Pie slice: {}", statement))); }
            slices.push(PieSlice { label: label.to_string(), value });
        }
        if slices.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Pie(PieAst { title, slices, show_data }))
    }
    fn parse_user_journey(&self) -> Result<DiagramAst, ParseError> {
        let mut title = String::new(); let mut section = String::new(); let mut tasks = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("title ") { title = value.trim().to_string(); continue; }
            if let Some(value) = statement.strip_prefix("section ") { section = value.trim().to_string(); continue; }
            let mut parts = statement.split(':').map(str::trim);
            let label = parts.next().unwrap_or_default();
            let score = parts.next().and_then(|value| value.parse::<u8>().ok());
            let actors = parts.next().map(|value| value.split(',').map(str::trim).filter(|actor| !actor.is_empty()).map(ToString::to_string).collect()).unwrap_or_default();
            if label.is_empty() || section.is_empty() || parts.next().is_some() || !matches!(score, Some(1..=5)) { return Err(ParseError::UnexpectedToken(format!("Journey tasks require a section, label, and score 1-5: {}", statement))); }
            tasks.push(UserJourneyTask { section: section.clone(), label: label.to_string(), score: score.unwrap(), actors });
        }
        if tasks.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::UserJourney(UserJourneyAst { title, tasks }))
    }
    fn parse_timeline(&self) -> Result<DiagramAst, ParseError> {
        let mut title = String::new(); let mut section = String::new(); let mut entries: Vec<TimelineEntry> = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("title ") { title = value.trim().to_string(); continue; }
            if let Some(value) = statement.strip_prefix("section ") { section = value.trim().to_string(); continue; }
            let (period, event) = statement.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Timeline entries require period : event syntax: {}", statement)))?;
            let period = period.trim(); let event = event.trim();
            if event.is_empty() { return Err(ParseError::UnexpectedToken(format!("Timeline events cannot be empty: {}", statement))); }
            if period.is_empty() { if let Some(entry) = entries.last_mut() { entry.events.push(event.to_string()); } else { return Err(ParseError::UnexpectedToken(format!("Timeline event has no preceding period: {}", statement))); } } else { entries.push(TimelineEntry { period: period.to_string(), events: vec![event.to_string()], section: section.clone() }); }
        }
        if entries.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Timeline(TimelineAst { title, entries }))
    }
    fn parse_mindmap(&self) -> Result<DiagramAst, ParseError> {
        let mut nodes: Vec<MindmapNode> = Vec::new(); let mut parents: Vec<String> = Vec::new(); let mut base_indent = None;
        for line in self.input.lines().skip(1) { let raw = line.trim_end(); if raw.trim().is_empty() { continue; }
            let trimmed = raw.trim();
            // Icon declarations attach to the previous node.
            if let Some(icon) = trimmed.strip_prefix("::icon(").and_then(|rest| rest.strip_suffix(')')) {
                let name = icon.trim();
                let name = name.strip_prefix("fa ").unwrap_or(name);
                let name = name.strip_prefix("fa:").unwrap_or(name);
                let name = name.strip_prefix("fa-").unwrap_or(name);
                if name.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Mindmap icons require a name: {}", trimmed)));
                }
                let Some(previous) = nodes.last_mut() else {
                    return Err(ParseError::UnexpectedToken(format!("Mindmap icons require a preceding node: {}", trimmed)));
                };
                previous.icon = Some(name.to_string());
                continue;
            }
            let depth = raw.len() - raw.trim_start().len(); let base = *base_indent.get_or_insert(depth); let level = (depth.saturating_sub(base)) / 2;
            if level > parents.len() || trimmed.is_empty() { return Err(ParseError::UnexpectedToken(format!("Invalid Mindmap indentation: {}", raw))); }
            let (label, shape) = parse_mindmap_node_text(trimmed)?;
            let id = format!("mindmap-{}", nodes.len()); let parent = if level == 0 { None } else { Some(parents[level - 1].clone()) };
            parents.truncate(level); parents.push(id.clone()); nodes.push(MindmapNode { id, label, parent, shape, icon: None }); }
        if nodes.is_empty() { return Err(ParseError::EmptyInput); } Ok(DiagramAst::Mindmap(MindmapAst { nodes }))
    }
    fn parse_treeview(&self) -> Result<DiagramAst, ParseError> {
        let mut nodes = Vec::new(); let mut parents: Vec<String> = Vec::new(); let mut base_indent = None;
        for line in self.input.lines().skip(1) { let raw = line.trim_end(); if raw.trim().is_empty() { continue; }
            let depth = raw.len() - raw.trim_start().len(); let base = *base_indent.get_or_insert(depth); let level = (depth.saturating_sub(base)) / 2; let label = raw.trim();
            if level > parents.len() || label.is_empty() { return Err(ParseError::UnexpectedToken(format!("Invalid Treeview indentation: {}", raw))); }
            if label.contains(['(', ')', '[', ']', '{', '}']) { return Err(ParseError::UnexpectedToken(format!("Treeview node shapes are not supported: {}", label))); }
            let id = format!("tree-{}", nodes.len()); let parent = if level == 0 { None } else { Some(parents[level - 1].clone()) };
            parents.truncate(level); parents.push(id.clone()); nodes.push(MindmapNode { id, label: label.to_string(), parent, shape: NodeShape::Rounded, icon: None }); }
        if nodes.is_empty() { return Err(ParseError::EmptyInput); } Ok(DiagramAst::Treeview(MindmapAst { nodes }))
    }
    fn parse_requirement(&self) -> Result<DiagramAst, ParseError> {
        let mut requirements = Vec::new();
        let mut relationships = Vec::new();
        let mut lines = self.input.lines().skip(1).peekable();

        while let Some(line) = lines.next() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some((from, rest)) = statement.split_once(" - ") {
                let (label, to) = rest.split_once(" -> ").ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid requirement relationship: {}", statement)))?;
                let (from, label, to) = (from.trim(), label.trim(), to.trim());
                if from.is_empty() || label.is_empty() || to.is_empty() { return Err(ParseError::UnexpectedToken(format!("Invalid requirement relationship: {}", statement))); }
                relationships.push(RequirementRelationship { from: from.to_string(), to: to.to_string(), label: label.to_string() });
                continue;
            }

            let header = statement.strip_suffix('{').map(str::trim).ok_or_else(|| ParseError::UnexpectedToken(format!("Requirement declarations must end with '{{': {}", statement)))?;
            let mut header_parts = header.split_whitespace();
            let kind = header_parts.next().unwrap_or_default();
            let name = header_parts.next().unwrap_or_default();
            if !matches!(kind, "requirement" | "functionalRequirement" | "interfaceRequirement" | "performanceRequirement" | "physicalRequirement" | "designConstraint") || name.is_empty() || header_parts.next().is_some() {
                return Err(ParseError::UnexpectedToken(format!("Invalid requirement declaration: {}", statement)));
            }

            let mut id = None;
            let mut text = None;
            let mut risk = None;
            let mut verify_method = None;
            let mut closed = false;
            for property_line in lines.by_ref() {
                let property = property_line.trim();
                if property.is_empty() || property.starts_with("%%") { continue; }
                if property == "}" { closed = true; break; }
                let (key, value) = property.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Requirement properties require key: value syntax: {}", property)))?;
                let value = value.trim();
                if value.is_empty() { return Err(ParseError::UnexpectedToken(format!("Requirement property cannot be empty: {}", property))); }
                let target = match key.trim() {
                    "id" => &mut id,
                    "text" => &mut text,
                    "risk" => &mut risk,
                    "verifymethod" => &mut verify_method,
                    _ => return Err(ParseError::UnexpectedToken(format!("Unsupported requirement property: {}", key.trim()))),
                };
                if target.replace(value.to_string()).is_some() { return Err(ParseError::UnexpectedToken(format!("Duplicate requirement property: {}", key.trim()))); }
            }
            if !closed { return Err(ParseError::UnexpectedToken(format!("Requirement block is missing a closing brace: {}", name))); }
            requirements.push(Requirement { kind: kind.to_string(), name: name.to_string(), id, text, risk, verify_method });
        }

        if requirements.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Requirement(RequirementAst { requirements, relationships }))
    }

    fn parse_gitgraph(&self) -> Result<DiagramAst, ParseError> {
        let mut commits = Vec::new();
        let mut heads = std::collections::HashMap::<String, Option<String>>::new();
        heads.insert("main".to_string(), None);
        let mut current_branch = "main".to_string();

        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(name) = statement.strip_prefix("branch ") {
                let name = name.split_whitespace().next().unwrap_or_default();
                if name.is_empty() || heads.contains_key(name) { return Err(ParseError::UnexpectedToken(format!("Invalid GitGraph branch: {}", statement))); }
                heads.insert(name.to_string(), heads.get(&current_branch).cloned().flatten());
                continue;
            }
            if let Some(name) = statement.strip_prefix("checkout ") {
                let name = name.trim();
                if !heads.contains_key(name) { return Err(ParseError::UnexpectedToken(format!("GitGraph branch does not exist: {}", name))); }
                current_branch = name.to_string();
                continue;
            }
            if let Some(attributes) = statement.strip_prefix("commit") {
                let attributes = parse_gitgraph_attributes(attributes)?;
                let id = attributes.get("id").cloned().unwrap_or_else(|| format!("commit-{}", commits.len() + 1));
                if commits.iter().any(|commit: &GitCommit| commit.id == id) { return Err(ParseError::UnexpectedToken(format!("Duplicate GitGraph commit id: {}", id))); }
                let parents = heads.get(&current_branch).and_then(Clone::clone).into_iter().collect();
                heads.insert(current_branch.clone(), Some(id.clone()));
                commits.push(GitCommit { id, branch: current_branch.clone(), tag: attributes.get("tag").cloned(), commit_type: attributes.get("type").cloned(), parents });
                continue;
            }
            if let Some(merge) = statement.strip_prefix("merge ") {
                let mut parts = merge.splitn(2, char::is_whitespace);
                let source_branch = parts.next().unwrap_or_default();
                let attributes = parse_gitgraph_attributes(parts.next().unwrap_or_default())?;
                let source_head = heads.get(source_branch).ok_or_else(|| ParseError::UnexpectedToken(format!("GitGraph branch does not exist: {}", source_branch)))?.clone();
                let target_head = heads.get(&current_branch).and_then(Clone::clone);
                let mut parents = target_head.into_iter().collect::<Vec<_>>();
                if let Some(source_head) = source_head { parents.push(source_head); }
                if parents.is_empty() { return Err(ParseError::UnexpectedToken(format!("GitGraph merge requires a commit on either branch: {}", statement))); }
                let id = attributes.get("id").cloned().unwrap_or_else(|| format!("merge-{}", commits.len() + 1));
                if commits.iter().any(|commit: &GitCommit| commit.id == id) { return Err(ParseError::UnexpectedToken(format!("Duplicate GitGraph commit id: {}", id))); }
                heads.insert(current_branch.clone(), Some(id.clone()));
                commits.push(GitCommit { id, branch: current_branch.clone(), tag: attributes.get("tag").cloned(), commit_type: attributes.get("type").cloned(), parents });
                continue;
            }
            if let Some(attributes) = statement.strip_prefix("cherry-pick") {
                let attributes = parse_gitgraph_attributes(attributes)?;
                let target_id = attributes.get("id").cloned().ok_or_else(|| {
                    ParseError::UnexpectedToken(format!("GitGraph cherry-pick requires a target id: {}", statement))
                })?;
                let target = commits.iter().find(|commit| commit.id == target_id).ok_or_else(|| {
                    ParseError::UnexpectedToken(format!("GitGraph cherry-pick target does not exist: {}", target_id))
                })?;
                let parent = target.parents.last().cloned();
                let id = attributes.get("tag").cloned().unwrap_or_else(|| format!("cherry-{}-{}", target_id, commits.len() + 1));
                if commits.iter().any(|commit: &GitCommit| commit.id == id) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate GitGraph commit id: {}", id)));
                }
                let mut parents = heads.get(&current_branch).and_then(Clone::clone).into_iter().collect::<Vec<_>>();
                if let Some(parent) = parent {
                    if !parents.contains(&parent) {
                        parents.push(parent);
                    }
                }
                heads.insert(current_branch.clone(), Some(id.clone()));
                commits.push(GitCommit {
                    id,
                    branch: current_branch.clone(),
                    tag: target.tag.clone(),
                    commit_type: target.commit_type.clone(),
                    parents,
                });
                continue;
            }
            return Err(ParseError::UnexpectedToken(format!("Unsupported GitGraph statement: {}", statement)));
        }

        if commits.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::GitGraph(GitGraphAst { commits }))
    }

    fn parse_c4(&self) -> Result<DiagramAst, ParseError> {
        let mut header = self.input.lines();
        let first_line = header.next().unwrap_or_default().trim();
        let diagram_kind = first_line.strip_prefix("C4").filter(|kind| matches!(*kind, "Context" | "Container" | "Component" | "Dynamic" | "Deployment")).ok_or_else(|| ParseError::UnexpectedToken(format!("Unsupported C4 diagram declaration: {}", first_line)))?;
        let mut title = String::new();
        let mut elements = Vec::new();
        let mut relationships = Vec::new();
        let mut boundaries = Vec::new();
        let mut open_boundaries: Vec<(String, String)> = Vec::new();

        for line in header {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("title ") { title = value.trim().to_string(); continue; }

            // Close the innermost boundary block.
            if statement == "}" {
                open_boundaries.pop();
                continue;
            }

            let (kind, arguments) = split_c4_call(statement)?;
            let values = parse_c4_arguments(arguments)?;

            // Boundary and deployment-node containers own a braced block.
            if matches!(kind, "System_Boundary" | "Container_Boundary" | "Enterprise_Boundary" | "Deployment_Node" | "Deployment_Node_L" | "Deployment_Node_R") {
                if values.len() != 2 || values[0].is_empty() || values[1].is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("C4 boundary requires id and label: {}", statement)));
                }
                if elements.iter().any(|element: &C4Element| element.id == values[0])
                    || boundaries.iter().any(|boundary: &C4Boundary| boundary.id == values[0])
                {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate C4 boundary id: {}", values[0])));
                }
                let boundary = C4Boundary {
                    kind: kind.to_string(),
                    id: values[0].clone(),
                    label: values[1].clone(),
                    elements: Vec::new(),
                    boundaries: Vec::new(),
                };
                if let Some(parent) = open_boundaries.last() {
                    let parent_id = parent.1.clone();
                    if let Some(parent_boundary) = boundaries.iter_mut().find(|boundary| boundary.id == parent_id) {
                        parent_boundary.boundaries.push(boundary);
                    }
                } else {
                    boundaries.push(boundary);
                }
                open_boundaries.push((kind.to_string(), values[0].clone()));
                continue;
            }

            if kind == "Rel" || kind.starts_with("Rel_") || kind == "BiRel" {
                if values.len() != 3 || values.iter().any(|value| value.is_empty()) { return Err(ParseError::UnexpectedToken(format!("C4 {} requires from, to, and label: {}", kind, statement))); }
                relationships.push(C4Relationship {
                    from: values[0].clone(),
                    to: values[1].clone(),
                    label: values[2].clone(),
                    bidirectional: kind == "BiRel",
                });
                continue;
            }
            if !matches!(kind, "Person" | "Person_Ext" | "System" | "System_Ext" | "Container" | "Container_Ext" | "SystemDb" | "SystemDb_Ext" | "ContainerDb" | "ContainerDb_Ext" | "Component" | "Component_Ext" | "ComponentDb" | "ComponentDb_Ext" | "Node" | "Node_L" | "Node_R") || !(2..=3).contains(&values.len()) || values[0].is_empty() || values[1].is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Unsupported C4 element: {}", statement)));
            }
            if elements.iter().any(|element: &C4Element| element.id == values[0]) { return Err(ParseError::UnexpectedToken(format!("Duplicate C4 element id: {}", values[0]))); }
            let container = open_boundaries.last().map(|(_, id)| id.clone());
            if let (Some(top), Some(container_id)) = (open_boundaries.last(), &container) {
                let parent_id = top.1.clone();
                if let Some(parent_boundary) = boundaries.iter_mut().find(|boundary| boundary.id == parent_id) {
                    parent_boundary.elements.push(values[0].clone());
                }
            }
            elements.push(C4Element { kind: kind.to_string(), id: values[0].clone(), label: values[1].clone(), description: values.get(2).cloned(), container });
        }
        if elements.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::C4(C4Ast { diagram_kind: diagram_kind.to_string(), title, elements, relationships, boundaries }))
    }

    fn parse_zenuml(&self) -> Result<DiagramAst, ParseError> {
        let mut participants = Vec::new();
        let mut messages = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }
            // Participant and actor declarations pre-register columns.
            if let Some(rest) = statement.strip_prefix("participant ").or_else(|| statement.strip_prefix("actor ")) {
                let id = rest.trim().split_whitespace().next().unwrap_or_default();
                if id.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!(
                        "ZenUML declarations require a participant name: {}", statement
                    )));
                }
                if !participants.iter().any(|known| known == id) {
                    participants.push(id.to_string());
                }
                continue;
            }
            let (from, rest, kind) = if let Some((from, rest)) = statement.split_once("-->") {
                (from, rest, "return")
            } else if let Some((from, rest)) = statement.split_once("->") {
                (from, rest, "call")
            } else {
                return Err(ParseError::UnexpectedToken(format!(
                    "Invalid ZenUML message: {}",
                    statement
                )));
            };
            let (to, label) = rest.split_once(':').ok_or_else(|| {
                ParseError::UnexpectedToken(format!(
                    "ZenUML messages require a label: {}",
                    statement
                ))
            })?;
            let (from, to, label) = (from.trim(), to.trim(), label.trim());
            if from.is_empty() || to.is_empty() || label.is_empty() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Invalid ZenUML message: {}",
                    statement
                )));
            }
            for participant in [from, to] {
                if !participants.iter().any(|known| known == participant) {
                    participants.push(participant.to_string());
                }
            }
            messages.push(ZenUmlMessage {
                from: from.to_string(),
                to: to.to_string(),
                label: label.to_string(),
                kind: kind.to_string(),
            });
        }
        if messages.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::ZenUml(ZenUmlAst {
            participants,
            messages,
        }))
    }

    fn parse_xychart(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        let header = lines.next().unwrap_or_default();
        if !matches!(header, "xychart" | "xychart-beta") { return Err(ParseError::UnexpectedToken(format!("Unsupported XY chart declaration: {}", header))); }
        let mut title = String::new(); let mut x_labels = None; let mut x_range = None; let mut x_title = String::new(); let mut y_range = None; let mut series = Vec::new();
        for statement in lines {
            if let Some(value) = statement.strip_prefix("title ") { if !title.is_empty() { return Err(ParseError::UnexpectedToken("XY chart title may only be declared once.".to_string())); } title = parse_xy_quoted(value, "XY chart titles must be quoted")?; continue; }
            if let Some(value) = statement.strip_prefix("x-axis ") {
                if x_labels.is_some() || x_range.is_some() { return Err(ParseError::UnexpectedToken("XY chart x-axis may only be declared once.".to_string())); }
                match parse_xy_axis_declaration(value)? {
                    XyAxisDeclaration::Labels(labels) => x_labels = Some(labels),
                    XyAxisDeclaration::Numeric(range, axis_title) => { x_range = Some(range); x_title = axis_title; }
                }
                continue;
            }
            if let Some(value) = statement.strip_prefix("y-axis ") { if y_range.is_some() { return Err(ParseError::UnexpectedToken("XY chart y-axis may only be declared once.".to_string())); } y_range = Some(parse_xy_range(value)?); continue; }
            let (kind, values) = if let Some(value) = statement.strip_prefix("bar ") { (XySeriesKind::Bar, parse_xy_values(value)?) } else if let Some(value) = statement.strip_prefix("line ") { (XySeriesKind::Line, parse_xy_values(value)?) } else { return Err(ParseError::UnexpectedToken(format!("Unsupported XY chart statement: {}", statement))); };
            series.push(XySeries { kind, values });
        }
        let (x_labels, x_range) = match (x_labels, x_range) {
            (Some(labels), None) => (labels, None),
            (None, Some(range)) => (Vec::new(), Some(range)),
            _ => return Err(ParseError::UnexpectedToken("XY charts require exactly one x-axis declaration.".to_string())),
        };
        let (y_min, y_max) = y_range.ok_or_else(|| ParseError::UnexpectedToken("XY charts require a numeric y-axis range.".to_string()))?;
        if series.is_empty() { return Err(ParseError::EmptyInput); }
        if x_range.is_none() && series.iter().any(|item| item.values.len() != x_labels.len()) {
            return Err(ParseError::UnexpectedToken("Each XY chart series must contain one value per x-axis label.".to_string()));
        }
        Ok(DiagramAst::XyChart(XyChartAst { title, x_labels, x_range, x_title, y_min, y_max, series }))
    }

    fn parse_sankey(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines();
        let header = lines.next().unwrap_or_default().trim();
        if !matches!(header, "sankey" | "sankey-beta") {
            return Err(ParseError::UnexpectedToken(format!("Unsupported Sankey declaration: {}", header)));
        }

        let mut nodes = Vec::new();
        let mut links = Vec::new();
        for line in lines {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }
            let fields = parse_sankey_csv_record(line)?;
            if fields.len() != 3 {
                return Err(ParseError::UnexpectedToken(format!(
                    "Sankey rows require exactly source,target,value columns: {}",
                    line
                )));
            }
            let source = fields[0].trim();
            let target = fields[1].trim();
            let value = fields[2].trim().parse::<f64>().ok().filter(|value| value.is_finite() && *value > 0.0)
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Sankey values must be finite and positive: {}", line)))?;
            if source.is_empty() || target.is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Sankey source and target cannot be empty: {}", line)));
            }
            for node in [source, target] {
                if !nodes.iter().any(|known| known == node) {
                    nodes.push(node.to_string());
                }
            }
            links.push(SankeyLink { source: source.to_string(), target: target.to_string(), value });
        }

        if links.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        if sankey_contains_cycle(&nodes, &links) {
            return Err(ParseError::UnexpectedToken("Sankey diagrams cannot contain a cycle.".to_string()));
        }
        Ok(DiagramAst::Sankey(SankeyAst { nodes, links }))
    }

    fn parse_quadrant(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        if lines.next() != Some("quadrantChart") {
            return Err(ParseError::UnexpectedToken("Quadrant charts must start with quadrantChart.".to_string()));
        }
        let mut title = String::new();
        let mut x_axis = None;
        let mut y_axis = None;
        let mut quadrants: [String; 4] = std::array::from_fn(|_| String::new());
        let mut points = Vec::new();
        for statement in lines {
            if let Some(value) = statement.strip_prefix("title ") {
                if !title.is_empty() || value.trim().is_empty() { return Err(ParseError::UnexpectedToken("Quadrant charts allow one non-empty title.".to_string())); }
                title = value.trim().to_string();
            } else if let Some(value) = statement.strip_prefix("x-axis ") {
                if x_axis.is_some() { return Err(ParseError::UnexpectedToken("Quadrant charts allow one x-axis declaration.".to_string())); }
                x_axis = Some(parse_quadrant_axis(value, "x-axis")?);
            } else if let Some(value) = statement.strip_prefix("y-axis ") {
                if y_axis.is_some() { return Err(ParseError::UnexpectedToken("Quadrant charts allow one y-axis declaration.".to_string())); }
                y_axis = Some(parse_quadrant_axis(value, "y-axis")?);
            } else if let Some(value) = statement.strip_prefix("quadrant-") {
                let (number, label) = value.split_once(char::is_whitespace).ok_or_else(|| ParseError::UnexpectedToken(format!("Quadrant labels require text: {}", statement)))?;
                let index = number.parse::<usize>().ok().filter(|number| (1..=4).contains(number)).ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid quadrant label: {}", statement)))? - 1;
                if !quadrants[index].is_empty() || label.trim().is_empty() { return Err(ParseError::UnexpectedToken(format!("Duplicate or empty quadrant label: {}", statement))); }
                quadrants[index] = label.trim().to_string();
            } else {
                points.push(parse_quadrant_point(statement)?);
            }
        }
        Ok(DiagramAst::Quadrant(QuadrantAst { title, x_axis, y_axis, quadrants, points }))
    }

    fn parse_architecture(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        if !matches!(lines.next(), Some("architecture") | Some("architecture-beta")) {
            return Err(ParseError::UnexpectedToken("Architecture diagrams must start with architecture or architecture-beta.".to_string()));
        }
        let mut services = Vec::new();
        let mut relationships = Vec::new();
        let mut groups = Vec::new();
        let mut junctions = Vec::new();
        for statement in lines {
            if let Some(value) = statement.strip_prefix("group ") {
                let group = parse_architecture_service(value)?;
                if groups.iter().any(|known: &ArchitectureGroup| known.id == group.id) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate architecture group id: {}", group.id)));
                }
                groups.push(ArchitectureGroup { id: group.id, icon: group.icon, label: group.label });
                continue;
            }
            if let Some(value) = statement.strip_prefix("junction ") {
                let id = value.trim();
                if !architecture_identifier(id) {
                    return Err(ParseError::UnexpectedToken(format!("Architecture junctions require an identifier: {}", statement)));
                }
                if junctions.iter().any(|known: &ArchitectureJunction| known.id == id) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate architecture junction id: {}", id)));
                }
                junctions.push(ArchitectureJunction { id: id.to_string() });
                continue;
            }
            if let Some(value) = statement.strip_prefix("service ") {
                // `service id(icon)[label] in <group>`
                let (declaration, group) = match value.split_once(" in ") {
                    Some((declaration, group_id)) => {
                        let group_id = group_id.trim();
                        if !groups.iter().any(|group: &ArchitectureGroup| group.id == group_id) {
                            return Err(ParseError::UnexpectedToken(format!("Architecture service references an undeclared group: {}", statement)));
                        }
                        (declaration, Some(group_id.to_string()))
                    }
                    None => (value, None),
                };
                let mut service = parse_architecture_service(declaration)?;
                service.group = group;
                if services.iter().any(|known: &ArchitectureService| known.id == service.id) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate architecture service id: {}", service.id)));
                }
                services.push(service);
                continue;
            }
            let relationship = parse_architecture_relationship(statement)?;
            let resolves = |endpoint: &str| {
                services.iter().any(|service: &ArchitectureService| service.id == endpoint)
                    || junctions.iter().any(|junction: &ArchitectureJunction| junction.id == endpoint)
                    || groups.iter().any(|group: &ArchitectureGroup| group.id == endpoint)
            };
            if !resolves(&relationship.from) || !resolves(&relationship.to) {
                return Err(ParseError::UnexpectedToken(format!("Architecture relationships require previously declared services, junctions, or groups: {}", statement)));
            }
            relationships.push(relationship);
        }
        if services.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Architecture(ArchitectureAst { services, relationships, groups, junctions }))
    }

    fn parse_block(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        if !matches!(lines.next(), Some("block") | Some("block-beta")) {
            return Err(ParseError::UnexpectedToken("Block diagrams must start with block or block-beta.".to_string()));
        }
        let mut columns = 1_usize;
        let mut columns_seen = false;
        let mut blocks = Vec::new();
        let mut relationships = Vec::new();
        let mut row = 0_usize;
        for statement in lines {
            if let Some(value) = statement.strip_prefix("columns ") {
                if columns_seen || !blocks.is_empty() || !relationships.is_empty() {
                    return Err(ParseError::UnexpectedToken("Block diagrams allow one columns declaration before blocks.".to_string()));
                }
                columns = value.trim().parse::<usize>().ok().filter(|value| *value > 0)
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Block columns must be a positive integer: {}", statement)))?;
                columns_seen = true;
                continue;
            }
            if statement.contains("-->") || statement.contains("--") {
                relationships.push(parse_block_relationship(statement)?);
                continue;
            }
            let mut column = 0_usize;
            let cells = split_block_cells(statement)?;
            if cells.is_empty() {
                return Err(ParseError::UnexpectedToken("Block rows cannot be empty.".to_string()));
            }
            for cell in cells {
                let (id, label, span, is_space) = parse_block_cell(&cell)?;
                if column + span > columns {
                    return Err(ParseError::UnexpectedToken(format!("Block row exceeds {} columns: {}", columns, statement)));
                }
                if !is_space {
                    if blocks.iter().any(|known: &Block| known.id == id) {
                        return Err(ParseError::UnexpectedToken(format!("Duplicate block id: {}", id)));
                    }
                    blocks.push(Block { id, label, span, row, column });
                }
                column += span;
            }
            row += 1;
        }
        if blocks.is_empty() { return Err(ParseError::EmptyInput); }
        for relationship in &relationships {
            if !blocks.iter().any(|block| block.id == relationship.from)
                || !blocks.iter().any(|block| block.id == relationship.to)
            {
                return Err(ParseError::UnexpectedToken(format!("Block relationships require declared blocks: {} --> {}", relationship.from, relationship.to)));
            }
        }
        Ok(DiagramAst::Block(BlockAst { columns, blocks, relationships }))
    }

    fn parse_treemap(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if !matches!(lines.next().map(str::trim), Some("treemap") | Some("treemap-beta")) {
            return Err(ParseError::UnexpectedToken("Treemap diagrams must start with treemap or treemap-beta.".to_string()));
        }

        let mut nodes: Vec<TreemapNode> = Vec::new();
        let mut parents: Vec<String> = Vec::new();
        let mut base_indent = None;
        for line in lines {
            if line.contains('\t') {
                return Err(ParseError::UnexpectedToken("Treemap indentation must use spaces.".to_string()));
            }
            let indent = line.len() - line.trim_start().len();
            let base = *base_indent.get_or_insert(indent);
            if indent < base || (indent - base) % 4 != 0 {
                return Err(ParseError::UnexpectedToken(format!("Treemap entries must use four-space indentation: {}", line.trim())));
            }
            let depth = (indent - base) / 4;
            if depth > parents.len() {
                return Err(ParseError::UnexpectedToken(format!("Treemap entries cannot skip hierarchy levels: {}", line.trim())));
            }

            let (label, value) = parse_treemap_entry(line.trim())?;
            if nodes.iter().any(|node| node.label == label) {
                return Err(ParseError::UnexpectedToken(format!("Treemap labels must be unique: {}", label)));
            }
            let parent = if depth == 0 { None } else { Some(parents[depth - 1].clone()) };
            if let Some(parent_label) = &parent {
                if nodes.iter().any(|node| node.label == *parent_label && node.value.is_some()) {
                    return Err(ParseError::UnexpectedToken(format!("Treemap leaves cannot contain children: {}", parent_label)));
                }
            }
            parents.truncate(depth);
            parents.push(label.clone());
            nodes.push(TreemapNode { label, value, parent });
        }

        if nodes.is_empty() || !nodes.iter().any(|node| node.value.is_some()) {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Treemap(TreemapAst { nodes }))
    }

    fn parse_radar(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if !matches!(lines.next().map(str::trim), Some("radar") | Some("radar-beta")) {
            return Err(ParseError::UnexpectedToken("Radar diagrams must start with radar or radar-beta.".to_string()));
        }

        let mut title = String::new();
        let mut axes = Vec::new();
        let mut curves = Vec::new();
        let mut min = 0.0;
        let mut max: Option<f64> = None;

        for line in lines {
            let statement = line.trim();
            if let Some(value) = statement.strip_prefix("title ") {
                if value.trim().is_empty() {
                    return Err(ParseError::UnexpectedToken("Radar titles cannot be empty.".to_string()));
                }
                title = value.trim().trim_matches('"').to_string();
            } else if let Some(value) = statement.strip_prefix("axis ") {
                for item in value.split(',') {
                    let (id, label) = parse_radar_named_item(item.trim(), "axis")?;
                    if axes.iter().any(|axis: &RadarAxis| axis.id == id) {
                        return Err(ParseError::UnexpectedToken(format!("Duplicate Radar axis: {}", id)));
                    }
                    axes.push(RadarAxis { id, label });
                }
            } else if let Some(value) = statement.strip_prefix("curve ") {
                let (head, values) = value.rsplit_once('{')
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Radar curves require values in braces: {}", statement)))?;
                let values = values.strip_suffix('}')
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Radar curves require a closing brace: {}", statement)))?;
                let (id, label) = parse_radar_named_item(head.trim(), "curve")?;
                if curves.iter().any(|curve: &RadarCurve| curve.id == id) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate Radar curve: {}", id)));
                }
                let values = values.split(',').map(|entry| entry.trim().parse::<f64>().ok().filter(|value| value.is_finite())
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Radar curve values must be finite numbers: {}", statement))))
                    .collect::<Result<Vec<_>, _>>()?;
                if values.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Radar curves require at least one value: {}", statement)));
                }
                curves.push(RadarCurve { id, label, values });
            } else if let Some(value) = statement.strip_prefix("min ") {
                min = parse_radar_bound(value, "min")?;
            } else if let Some(value) = statement.strip_prefix("max ") {
                max = Some(parse_radar_bound(value, "max")?);
            } else {
                return Err(ParseError::UnexpectedToken(format!("Unsupported Radar statement: {}", statement)));
            }
        }

        if axes.len() < 3 {
            return Err(ParseError::UnexpectedToken("Radar diagrams require at least three axes.".to_string()));
        }
        if curves.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        if curves.iter().any(|curve| curve.values.len() != axes.len()) {
            return Err(ParseError::UnexpectedToken("Every Radar curve must contain one value for each axis.".to_string()));
        }
        let max = max.unwrap_or_else(|| curves.iter().flat_map(|curve| curve.values.iter()).copied().fold(min, f64::max));
        if max <= min {
            return Err(ParseError::UnexpectedToken("Radar max must be greater than min.".to_string()));
        }
        Ok(DiagramAst::Radar(RadarAst { title, axes, curves, min, max }))
    }

    fn parse_packet(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if !matches!(lines.next().map(str::trim), Some("packet") | Some("packet-beta")) {
            return Err(ParseError::UnexpectedToken("Packet diagrams must start with packet or packet-beta.".to_string()));
        }

        let mut title = String::new();
        let mut fields = Vec::new();
        let mut next_bit: u32 = 0;
        for line in lines {
            let statement = line.trim();
            if let Some(value) = statement.strip_prefix("title ") {
                if value.trim().is_empty() || !title.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Packet titles must be non-empty and declared once: {}", statement)));
                }
                title = value.trim().trim_matches('"').to_string();
                continue;
            }

            let (range, label) = statement.split_once(':')
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet fields require a bit range and quoted label: {}", statement)))?;
            let label = parse_packet_label(label.trim(), statement)?;
            let (start, end) = if let Some(width) = range.trim().strip_prefix('+') {
                let width = width.parse::<u32>().ok().filter(|value| *value > 0)
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet sequential field widths must be positive integers: {}", statement)))?;
                let end = next_bit.checked_add(width - 1)
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet field range exceeds supported bit positions: {}", statement)))?;
                (next_bit, end)
            } else {
                let (start, end) = range.trim().split_once('-')
                    .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet ranges must use start-end or +width syntax: {}", statement)))?;
                let start = start.trim().parse::<u32>().map_err(|_| ParseError::UnexpectedToken(format!("Packet range starts must be non-negative integers: {}", statement)))?;
                let end = end.trim().parse::<u32>().map_err(|_| ParseError::UnexpectedToken(format!("Packet range ends must be non-negative integers: {}", statement)))?;
                if end < start {
                    return Err(ParseError::UnexpectedToken(format!("Packet range end must not precede its start: {}", statement)));
                }
                (start, end)
            };

            if start < next_bit {
                return Err(ParseError::UnexpectedToken(format!("Packet fields must be ordered and non-overlapping: {}", statement)));
            }
            next_bit = end.checked_add(1)
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet field range exceeds supported bit positions: {}", statement)))?;
            fields.push(PacketField { start, end, label });
        }

        if fields.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Packet(PacketAst { title, fields }))
    }

    fn parse_venn(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if !matches!(lines.next().map(str::trim), Some("venn") | Some("venn-beta")) { return Err(ParseError::UnexpectedToken("Venn diagrams must start with venn or venn-beta.".to_string())); }
        let mut title = String::new(); let mut sets = Vec::new(); let mut unions = Vec::new();
        for line in lines {
            let statement = line.trim();
            if let Some(value) = statement.strip_prefix("title ") { if value.trim().is_empty() || !title.is_empty() { return Err(ParseError::UnexpectedToken(format!("Venn titles must be non-empty and declared once: {}", statement))); } title = value.trim().trim_matches('"').to_string(); continue; }
            if let Some(value) = statement.strip_prefix("set ") {
                let (id, label) = parse_venn_named(value, "set")?;
                if sets.iter().any(|set: &VennSet| set.id == id) { return Err(ParseError::UnexpectedToken(format!("Duplicate Venn set: {}", id))); }
                sets.push(VennSet { id, label }); continue;
            }
            if let Some(value) = statement.strip_prefix("union ") {
                let (names, label) = parse_venn_named(value, "union")?;
                let names = names.split(',').map(str::trim).filter(|name| !name.is_empty()).map(ToString::to_string).collect::<Vec<_>>();
                if names.len() < 2 || names.iter().any(|name| !block_identifier(name)) || names.iter().any(|name| !sets.iter().any(|set| set.id == *name)) { return Err(ParseError::UnexpectedToken(format!("Venn unions require two or more declared set identifiers: {}", statement))); }
                unions.push(VennUnion { sets: names, label }); continue;
            }
            return Err(ParseError::UnexpectedToken(format!("Unsupported Venn statement: {}", statement)));
        }
        if sets.len() < 2 { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Venn(VennAst { title, sets, unions }))
    }

    fn parse_swimlanes(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        let header = lines.next().map(str::trim).ok_or(ParseError::EmptyInput)?;
        let direction = match header
            .strip_prefix("swimlane")
            .map(str::trim)
            .map(|rest| rest.strip_prefix("-beta").map(str::trim).unwrap_or(rest))
        {
            Some("") | Some("TD") | Some("TB") => FlowDirection::TD,
            Some("BT") => FlowDirection::BT,
            Some("LR") => FlowDirection::LR,
            Some("RL") => FlowDirection::RL,
            _ => return Err(ParseError::UnexpectedToken("Swimlane diagrams must start with swimlane or swimlane-beta followed by an optional direction.".to_string())),
        };
        let (mut lanes, mut nodes, mut edges) = (Vec::new(), Vec::new(), Vec::new());
        let mut active_lane = None;
        for line in lines {
            let statement = line.trim();
            if let Some(value) = statement.strip_prefix("subgraph ") {
                if active_lane.is_some() { return Err(ParseError::UnexpectedToken("Swimlane lanes cannot be nested.".to_string())); }
                let (id, label) = parse_swimlane_lane(value)?;
                if lanes.iter().any(|lane: &Swimlane| lane.id == id) { return Err(ParseError::UnexpectedToken(format!("Duplicate swimlane: {}", id))); }
                lanes.push(Swimlane { id, label, nodes: vec![] }); active_lane = Some(lanes.len() - 1); continue;
            }
            if statement == "end" { if active_lane.take().is_none() { return Err(ParseError::UnexpectedToken("Swimlane end must close an open lane.".to_string())); } continue; }
            if let Some(index) = active_lane {
                let (id, label) = parse_swimlane_node(statement)?;
                if nodes.iter().any(|node: &Node| node.id == id) { return Err(ParseError::UnexpectedToken(format!("Duplicate swimlane node: {}", id))); }
                lanes[index].nodes.push(id.clone()); nodes.push(Node { id, label: Some(label), shape: NodeShape::Rounded, classes: vec![], styles: vec![], style: None }); continue;
            }
            edges.push(parse_swimlane_edge(statement)?);
        }
        if active_lane.is_some() { return Err(ParseError::UnexpectedToken("Swimlane lanes must end with end.".to_string())); }
        if lanes.is_empty() || nodes.is_empty() { return Err(ParseError::EmptyInput); }
        if edges.iter().any(|edge: &Edge| !nodes.iter().any(|node: &Node| node.id == edge.from) || !nodes.iter().any(|node: &Node| node.id == edge.to)) { return Err(ParseError::UnexpectedToken("Swimlane edges must reference declared lane nodes.".to_string())); }
        Ok(DiagramAst::Swimlanes(SwimlaneAst { direction, lanes, nodes, edges }))
    }

    fn parse_ishikawa(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if !matches!(lines.next().map(str::trim), Some("ishikawa") | Some("ishikawa-beta")) {
            return Err(ParseError::UnexpectedToken("Ishikawa diagrams must start with ishikawa or ishikawa-beta.".to_string()));
        }
        let effect_line = lines.next().ok_or(ParseError::EmptyInput)?;
        if effect_line.contains('\t') {
            return Err(ParseError::UnexpectedToken("Ishikawa indentation must use spaces.".to_string()));
        }
        let effect_indent = effect_line.len() - effect_line.trim_start().len();
        let effect = effect_line.trim();
        if effect.is_empty() {
            return Err(ParseError::EmptyInput);
        }

        let mut causes = Vec::new();
        let mut parents: Vec<String> = Vec::new();
        let mut indent_unit = None;
        for line in lines {
            if line.contains('\t') {
                return Err(ParseError::UnexpectedToken("Ishikawa indentation must use spaces.".to_string()));
            }
            let indent = line.len() - line.trim_start().len();
            let label = line.trim();
            if indent < effect_indent || label.is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Ishikawa causes must share or extend the effect indentation: {}", label)));
            }
            let relative_indent = indent - effect_indent;
            let depth = if relative_indent == 0 {
                0
            } else {
                let unit = *indent_unit.get_or_insert(relative_indent);
                if relative_indent % unit != 0 {
                    return Err(ParseError::UnexpectedToken(format!("Ishikawa causes must use consistent indentation: {}", label)));
                }
                relative_indent / unit
            };
            if depth > parents.len() {
                return Err(ParseError::UnexpectedToken(format!("Ishikawa causes cannot skip hierarchy levels: {}", label)));
            }
            if causes.iter().any(|cause: &IshikawaCause| cause.label == label) {
                return Err(ParseError::UnexpectedToken(format!("Ishikawa cause labels must be unique: {}", label)));
            }
            let parent = if depth == 0 { None } else { Some(parents[depth - 1].clone()) };
            parents.truncate(depth);
            parents.push(label.to_string());
            causes.push(IshikawaCause { label: label.to_string(), parent, depth });
        }
        if causes.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Ishikawa(IshikawaAst { effect: effect.to_string(), causes }))
    }

    fn parse_event_modeling(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        let header = lines.next().ok_or(ParseError::EmptyInput)?;
        if !header.eq_ignore_ascii_case("eventmodeling") {
            return Err(ParseError::UnexpectedToken("Event Modeling diagrams must start with eventmodeling.".to_string()));
        }

        let mut frames = Vec::new();
        for line in lines {
            // Data blocks are intentionally outside this first native subset. Their frame
            // references have already been consumed, so they do not affect the timeline layout.
            if line.starts_with("data ") {
                break;
            }
            let statement = line.split_once('{').map(|(prefix, _)| prefix).unwrap_or(line);
            let statement = statement.split_once("[[").map(|(prefix, _)| prefix).unwrap_or(statement).trim();
            let mut parts = statement.split_whitespace();
            let keyword = parts.next().unwrap_or_default().to_ascii_lowercase();
            let reset = match keyword.as_str() {
                "tf" | "timeframe" => false,
                "rf" | "resetframe" => true,
                _ => return Err(ParseError::UnexpectedToken(format!("Event Modeling statements must start with tf, timeframe, rf, or resetframe: {}", line))),
            };
            let id = parts.next().ok_or_else(|| ParseError::UnexpectedToken(format!("Event Modeling time frames require an id, entity type, and entity: {}", line)))?;
            let entity_type = match parts.next().unwrap_or_default().to_ascii_lowercase().as_str() {
                "ui" => "ui",
                "pcr" | "processor" => "pcr",
                "cmd" | "command" => "cmd",
                "rmo" | "readmodel" => "rmo",
                "evt" | "event" => "evt",
                _ => return Err(ParseError::UnexpectedToken(format!("Unsupported Event Modeling entity type: {}", line))),
            };
            let entity = parts.collect::<Vec<_>>().join(" ");
            if entity.is_empty() || frames.iter().any(|frame: &EventFrame| frame.id == id) {
                return Err(ParseError::UnexpectedToken(format!("Event Modeling time frames require unique ids and non-empty entities: {}", line)));
            }
            frames.push(EventFrame { id: id.to_string(), entity_type: entity_type.to_string(), entity, reset });
        }

        if frames.is_empty() {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::EventModeling(EventModelingAst { frames }))
    }

    fn parse_wardley(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        if !matches!(lines.next(), Some("wardley") | Some("wardley-beta")) {
            return Err(ParseError::UnexpectedToken("Wardley maps must start with wardley or wardley-beta.".to_string()));
        }

        let mut title = String::new();
        let mut components = Vec::new();
        let mut dependencies = Vec::new();
        for line in lines {
            if let Some(value) = line.strip_prefix("title ") {
                title = value.trim().trim_matches('"').to_string();
                continue;
            }
            let (kind, value) = if let Some(value) = line.strip_prefix("anchor ") {
                (true, value)
            } else if let Some(value) = line.strip_prefix("component ") {
                (false, value)
            } else if let Some((from, to)) = line.split_once("->") {
                dependencies.push(WardleyDependency { from: wardley_name(from), to: wardley_name(to) });
                continue;
            } else {
                return Err(ParseError::UnexpectedToken(format!("Unsupported Wardley statement: {}", line)));
            };

            let (name, coordinates) = value.rsplit_once('[')
                .and_then(|(name, coordinates)| coordinates.strip_suffix(']').map(|coordinates| (name.trim(), coordinates)))
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Wardley components require [evolution, visibility] coordinates: {}", line)))?;
            let coordinates = coordinates.split(',').map(str::trim).collect::<Vec<_>>();
            if coordinates.len() != 2 {
                return Err(ParseError::UnexpectedToken(format!("Wardley components require [evolution, visibility] coordinates: {}", line)));
            }
            let x = coordinates[0].parse::<f64>().ok().filter(|value| value.is_finite() && (0.0..=1.0).contains(value))
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Wardley evolution must be between 0 and 1: {}", line)))?;
            let y = coordinates[1].parse::<f64>().ok().filter(|value| value.is_finite() && (0.0..=1.0).contains(value))
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Wardley visibility must be between 0 and 1: {}", line)))?;
            let id = wardley_name(name);
            if id.is_empty() || components.iter().any(|component: &WardleyComponent| component.id == id) {
                return Err(ParseError::UnexpectedToken(format!("Wardley component names must be unique and non-empty: {}", line)));
            }
            components.push(WardleyComponent { id: id.clone(), label: id, x, y, anchor: kind });
        }

        if components.is_empty() || dependencies.iter().any(|dependency: &WardleyDependency| !components.iter().any(|component| component.id == dependency.from) || !components.iter().any(|component| component.id == dependency.to)) {
            return Err(ParseError::EmptyInput);
        }
        Ok(DiagramAst::Wardley(WardleyAst { title, components, dependencies }))
    }

    fn parse_cynefin(&self) -> Result<DiagramAst, ParseError> {
        const DOMAIN_IDS: [&str; 5] = ["complex", "complicated", "clear", "chaotic", "confusion"];
        let mut lines = self.input.lines().map(str::trim).filter(|line| !line.is_empty() && !line.starts_with("%%"));
        if !matches!(lines.next(), Some("cynefin") | Some("cynefin-beta")) {
            return Err(ParseError::UnexpectedToken("Cynefin diagrams must start with cynefin or cynefin-beta.".to_string()));
        }

        let mut title = String::new();
        let mut domains = DOMAIN_IDS
            .iter()
            .map(|id| CynefinDomain { id: (*id).to_string(), items: vec![] })
            .collect::<Vec<_>>();
        let mut transitions = Vec::new();
        let mut active_domain = None;

        for line in lines {
            if let Some(value) = line.strip_prefix("title ") {
                if !title.is_empty() {
                    return Err(ParseError::UnexpectedToken("Cynefin diagrams can only declare one title.".to_string()));
                }
                title = value.trim().trim_matches('"').to_string();
                if title.is_empty() {
                    return Err(ParseError::UnexpectedToken("Cynefin titles cannot be empty.".to_string()));
                }
                continue;
            }
            if let Some((from, rest)) = line.split_once("-->") {
                let (to, label) = rest.split_once(':').map(|(to, label)| (to.trim(), label.trim().trim_matches('"'))).unwrap_or((rest.trim(), ""));
                let from = from.trim();
                if !DOMAIN_IDS.contains(&from) || !DOMAIN_IDS.contains(&to) || from == to {
                    return Err(ParseError::UnexpectedToken(format!("Cynefin transitions must connect distinct fixed domains: {}", line)));
                }
                transitions.push(CynefinTransition { from: from.to_string(), to: to.to_string(), label: label.to_string() });
                active_domain = None;
                continue;
            }
            if let Some(index) = DOMAIN_IDS.iter().position(|id| *id == line) {
                active_domain = Some(index);
                continue;
            }
            let item = line.strip_prefix('"').and_then(|value| value.strip_suffix('"'))
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Cynefin items must be quoted and appear within a fixed domain: {}", line)))?;
            if item.is_empty() {
                return Err(ParseError::UnexpectedToken("Cynefin items cannot be empty.".to_string()));
            }
            let index = active_domain.ok_or_else(|| ParseError::UnexpectedToken(format!("Cynefin items must appear within a fixed domain: {}", line)))?;
            domains[index].items.push(item.to_string());
        }

        Ok(DiagramAst::Cynefin(CynefinAst { title, domains, transitions }))
    }

    fn parse_kanban(&self) -> Result<DiagramAst, ParseError> {
        let mut lines = self.input.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("%%"));
        if lines.next().map(str::trim) != Some("kanban") {
            return Err(ParseError::UnexpectedToken("Kanban diagrams must start with kanban.".to_string()));
        }
        let mut columns: Vec<KanbanColumn> = Vec::new();
        let mut column_indent = None;
        let mut task_indent = None;
        let mut ids = std::collections::HashSet::new();
        for line in lines {
            if line.contains('\t') {
                return Err(ParseError::UnexpectedToken("Kanban indentation must use spaces.".to_string()));
            }
            let indent = line.len() - line.trim_start().len();
            let statement = line.trim();
            if statement.starts_with("---") {
                return Err(ParseError::UnexpectedToken(format!("Kanban configuration blocks are not supported: {}", statement)));
            }
            let base_indent = *column_indent.get_or_insert(indent);
            if indent < base_indent {
                return Err(ParseError::UnexpectedToken(format!("Kanban columns must share one indentation level: {}", statement)));
            }
            if indent == base_indent {
                let (id, label) = parse_kanban_item(statement, "column", ids.len() + 1)?;
                if !ids.insert(id.clone()) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate Kanban id: {}", id)));
                }
                columns.push(KanbanColumn { id, label, tasks: vec![] });
            } else {
                let expected_task_indent = *task_indent.get_or_insert(indent);
                if indent != expected_task_indent {
                    return Err(ParseError::UnexpectedToken(format!("Kanban tasks must share one indentation level: {}", statement)));
                }
                let column = columns.last_mut().ok_or_else(|| ParseError::UnexpectedToken(format!("Kanban tasks require a preceding column: {}", statement)))?;
                let (base_statement, ticket) = split_kanban_metadata(statement)?;
                let (id, label) = parse_kanban_item(base_statement, "task", ids.len() + 1)?;
                if !ids.insert(id.clone()) {
                    return Err(ParseError::UnexpectedToken(format!("Duplicate Kanban id: {}", id)));
                }
                column.tasks.push(KanbanTask { id, label, ticket });
            }
        }
        if columns.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Kanban(KanbanAst { columns }))
    }

    fn add_class_if_new(classes: &mut Vec<ClassDefinition>, id: &str) {
        if !classes.iter().any(|class| class.id == id) {
            classes.push(ClassDefinition { id: id.to_string(), label: id.to_string(), members: Vec::new(), annotation: None, namespace: None });
        }
    }

    fn upsert_class(classes: &mut Vec<ClassDefinition>, id: &str) {
        if !classes.iter().any(|class| class.id == id) {
            classes.push(ClassDefinition { id: id.to_string(), label: id.to_string(), members: Vec::new(), annotation: None, namespace: None });
        }
    }

    fn upsert_class_in_namespace(classes: &mut Vec<ClassDefinition>, id: &str, namespace: &str) {
        if let Some(existing) = classes.iter_mut().find(|class| class.id == id) {
            if existing.namespace.is_none() {
                existing.namespace = Some(namespace.to_string());
            }
            return;
        }
        classes.push(ClassDefinition {
            id: id.to_string(),
            label: id.to_string(),
            members: Vec::new(),
            annotation: None,
            namespace: Some(namespace.to_string()),
        });
    }

    fn parse_flowchart(&mut self) -> Result<DiagramAst, ParseError> {
        if let Some(token) = self.tokens[self.pos..]
            .iter()
            .find(|token| token.ty == TokenType::UnterminatedLabel)
        {
            return Err(ParseError::UnexpectedToken(format!(
                "Unterminated flowchart label; expected '{}' before end of input at line {}",
                token.value, token.line
            )));
        }

        let subgraph_ids = collect_subgraph_ids(self.input);
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
        let mut class_definitions = std::collections::HashMap::<String, NodeStyle>::new();
        let mut class_assignments = Vec::<(Vec<String>, String, bool)>::new();
        let mut link_styles = Vec::<LinkStyle>::new();
        let mut previous_was_class_definition = false;

        while self.current().ty != TokenType::Eof {
            let has_statement_boundary = self.skip_newlines_and_semicolons();
            if self.current().ty == TokenType::Eof {
                break;
            }
            if previous_was_class_definition && self.starts_flowchart_class_property() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Flowchart class definitions require comma-separated properties: {}",
                    self.current().value
                )));
            }
            let current_is_class_definition = self.current().ty == TokenType::Keyword
                && self.current().value == "classDef";
            let current_is_class_assignment = self.current().ty == TokenType::Keyword
                && self.current().value == "class";
            if !has_statement_boundary && (current_is_class_definition || current_is_class_assignment) {
                return Err(ParseError::UnexpectedToken(
                    "Flowchart class statements require a newline or semicolon boundary".to_string(),
                ));
            }

            match self.current().ty {
                TokenType::Keyword => {
                    match self.current().value.as_str() {
                        "subgraph" => {
                            let sg =
                                self.parse_subgraph(&mut nodes, &mut edges, &mut seen_nodes, &mut class_definitions, &mut class_assignments)?;
                            subgraphs.push(sg);
                        }
                        "classDef" => {
                            self.parse_flowchart_class_definition(&mut class_definitions)?;
                        }
                        "class" => {
                            self.parse_flowchart_class_assignment(&mut class_assignments)?;
                        }
                        "style" => {
                            self.parse_flowchart_style_statement(&mut nodes, &mut seen_nodes)?;
                        }
                        "linkStyle" => {
                            self.parse_flowchart_link_style(&mut link_styles)?;
                        }
                        "click" => {
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
                    self.parse_flowchart_statement(&mut nodes, &mut edges, &mut seen_nodes, &mut class_assignments)?;
                }
                _ => {
                    // Skip unknown tokens
                    self.advance();
                }
            }
            previous_was_class_definition = current_is_class_definition;
        }

        // Subgraph ids act as containers, never as concrete nodes: drop any
        // node auto-created by an edge referencing a subgraph id.
        nodes.retain(|node| !subgraph_ids.contains(&node.id));

        let mut flowchart = FlowchartAst {
            direction,
            nodes,
            edges,
            subgraphs,
            link_styles,
        };
        apply_flowchart_class_styles(&mut flowchart.nodes, &class_definitions, &class_assignments)?;
        Ok(DiagramAst::Flowchart(flowchart))
    }

    fn parse_flowchart_class_definition(
        &mut self,
        definitions: &mut std::collections::HashMap<String, NodeStyle>,
    ) -> Result<(), ParseError> {
        self.advance();
        let name = self.expect_flowchart_class_identifier()?;
        let style = self.parse_flowchart_style_properties("classDef")?;

        if definitions.insert(name.clone(), style).is_some() {
            return Err(ParseError::UnexpectedToken(format!(
                "Duplicate flowchart class definition: {}", name
            )));
        }
        Ok(())
    }

    /// Parse `property: value` pairs until the statement boundary, validating
    /// colors (hexadecimal or CSS names) and length properties.
    fn parse_flowchart_style_properties(&mut self, context: &str) -> Result<NodeStyle, ParseError> {
        let mut style = NodeStyle::default();
        loop {
            let property = self.expect(TokenType::NodeId)?;
            self.expect(TokenType::Colon)?;
            let mut parts: Vec<String> = Vec::new();
            if self.current().ty == TokenType::Hash {
                self.advance();
                parts.push(format!("#{}", self.expect(TokenType::NodeId)?));
            } else {
                while self.current().ty == TokenType::NodeId {
                    parts.push(self.current().value.clone());
                    self.advance();
                    // `5,5` dash arrays lex the comma as a separator; keep it.
                    if self.current().ty == TokenType::Comma
                        && self.tokens.get(self.pos + 1).is_some_and(|t| t.ty == TokenType::NodeId)
                        && property == "stroke-dasharray"
                    {
                        self.advance();
                        parts.push(",".to_string());
                    }
                }
            }
            let value = parts.join(" ");
            if value.is_empty() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Flowchart {} property {} requires a value", context, property
                )));
            }
            let slot = match property.as_str() {
                "fill" | "stroke" | "color" => {
                    if !is_safe_color(&value) {
                        return Err(ParseError::UnexpectedToken(format!(
                            "Flowchart {} colors must be three- or six-digit hexadecimal or CSS named values: {}",
                            context, value
                        )));
                    }
                    match property.as_str() {
                        "fill" => &mut style.fill,
                        "stroke" => &mut style.stroke,
                        _ => &mut style.color,
                    }
                }
                "stroke-width" => {
                    if !is_safe_length(&value) {
                        return Err(ParseError::UnexpectedToken(format!(
                            "Flowchart {} stroke-width must be a positive number with an optional px unit: {}",
                            context, value
                        )));
                    }
                    &mut style.stroke_width
                }
                "stroke-dasharray" => {
                    if !is_safe_dasharray(&value) {
                        return Err(ParseError::UnexpectedToken(format!(
                            "Flowchart {} stroke-dasharray must be space- or comma-separated positive numbers: {}",
                            context, value
                        )));
                    }
                    &mut style.stroke_dasharray
                }
                unsupported => {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Unsupported flowchart {} property: {}", context, unsupported
                    )));
                }
            };
            if slot.replace(value).is_some() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Duplicate flowchart {} property: {}", context, property
                )));
            }

            if self.current().ty == TokenType::Comma {
                self.advance();
                continue;
            }
            if matches!(self.current().ty, TokenType::Newline | TokenType::Semicolon | TokenType::Eof) {
                break;
            }
            return Err(ParseError::UnexpectedToken(format!(
                "Invalid flowchart {} statement: {}", context, self.current().value
            )));
        }
        Ok(style)
    }

    fn parse_flowchart_class_assignment(
        &mut self,
        assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<(), ParseError> {
        self.advance();
        let mut nodes = vec![self.expect_flowchart_class_identifier()?];
        while self.current().ty == TokenType::Comma {
            self.advance();
            nodes.push(self.expect_flowchart_class_identifier()?);
        }
        let class_name = self.expect_flowchart_class_identifier()?;
        if !matches!(self.current().ty, TokenType::Newline | TokenType::Semicolon | TokenType::Eof) {
            return Err(ParseError::UnexpectedToken(format!(
                "Invalid flowchart class assignment: {}", self.current().value
            )));
        }
        assignments.push((nodes, class_name, true));
        Ok(())
    }

    fn parse_flowchart_style_statement(
        &mut self,
        nodes: &mut [Node],
        seen_nodes: &mut std::collections::HashSet<String>,
    ) -> Result<(), ParseError> {
        self.advance(); // consume "style"
        let node_id = self.expect(TokenType::NodeId)?;
        let style = self.parse_flowchart_style_properties("style")?;

        if !seen_nodes.contains(&node_id) || !nodes.iter().any(|node| node.id == node_id) {
            return Err(ParseError::UnexpectedToken(format!("Unknown flowchart style node: {}", node_id)));
        }
        let node = nodes.iter_mut().find(|node| node.id == node_id).unwrap();
        let node_style = node.style.get_or_insert(NodeStyle::default());
        if style.fill.is_some() { node_style.fill = style.fill; }
        if style.stroke.is_some() { node_style.stroke = style.stroke; }
        if style.color.is_some() { node_style.color = style.color; }
        if style.stroke_width.is_some() { node_style.stroke_width = style.stroke_width; }
        if style.stroke_dasharray.is_some() { node_style.stroke_dasharray = style.stroke_dasharray; }
        Ok(())
    }

    /// Parse a `linkStyle` statement: `linkStyle 0,2 stroke:#ff3` or
    /// `linkStyle default stroke-width:2px`.
    fn parse_flowchart_link_style(
        &mut self,
        link_styles: &mut Vec<LinkStyle>,
    ) -> Result<(), ParseError> {
        self.advance(); // consume "linkStyle"
        let mut indices = Vec::new();
        let mut targets_default = false;
        loop {
            if self.current().ty == TokenType::NodeId {
                if self.current().value.eq_ignore_ascii_case("default") {
                    targets_default = true;
                    self.advance();
                    break;
                }
                if let Ok(index) = self.current().value.parse::<usize>() {
                    indices.push(index);
                    self.advance();
                    if self.current().ty == TokenType::Comma {
                        self.advance();
                        continue;
                    }
                    continue;
                }
            }
            break;
        }
        if indices.is_empty() && !targets_default {
            return Err(ParseError::UnexpectedToken(
                "linkStyle requires edge indexes or the default keyword".to_string(),
            ));
        }
        let style = self.parse_flowchart_style_properties("linkStyle")?;
        link_styles.push(LinkStyle { indices, targets_default, style });
        Ok(())
    }

    fn starts_flowchart_class_property(&self) -> bool {
        matches!(self.current().value.as_str(), "fill" | "stroke" | "color")
            && self
                .tokens
                .get(self.pos + 1)
                .is_some_and(|token| token.ty == TokenType::Colon)
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
        class_definitions: &mut std::collections::HashMap<String, NodeStyle>,
        class_assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<Subgraph, ParseError> {
        self.expect(TokenType::Keyword)?; // consume "subgraph"

        // Subgraph title: could be a NodeId, or a NodeId followed by bracketed label
        let mut declared_id: Option<String> = None;
        let title = if self.current().ty == TokenType::NodeId {
            let id = self.current().value.clone();
            declared_id = Some(id.clone());
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

        let mut sg_nodes: Vec<String> = Vec::new();
        let mut sg_subgraphs: Vec<Subgraph> = Vec::new();
        let mut previous_was_class_definition = false;

        while self.current().ty != TokenType::Eof {
            let has_statement_boundary = self.skip_newlines_and_semicolons();
            if self.current().ty == TokenType::Eof {
                break;
            }
            if previous_was_class_definition && self.starts_flowchart_class_property() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Flowchart class definitions require comma-separated properties: {}",
                    self.current().value
                )));
            }
            let current_is_class_definition = self.current().ty == TokenType::Keyword
                && self.current().value == "classDef";
            let current_is_class_assignment = self.current().ty == TokenType::Keyword
                && self.current().value == "class";
            if !has_statement_boundary && (current_is_class_definition || current_is_class_assignment) {
                return Err(ParseError::UnexpectedToken(
                    "Flowchart class statements require a newline or semicolon boundary".to_string(),
                ));
            }
            if self.current().ty == TokenType::Keyword && self.current().value == "end" {
                self.advance();
                break;
            }

            match self.current().ty {
                TokenType::Keyword => {
                    if self.current().value == "subgraph" {
                        let nested = self.parse_subgraph(nodes, edges, seen_nodes, class_definitions, class_assignments)?;
                        sg_subgraphs.push(nested);
                    } else if self.current().value == "classDef" {
                        self.parse_flowchart_class_definition(class_definitions)?;
                    } else if self.current().value == "class" {
                        self.parse_flowchart_class_assignment(class_assignments)?;
                    } else if self.current().value == "style" {
                        self.parse_flowchart_style_statement(nodes, seen_nodes)?;
                    } else if self.current().value == "linkStyle" {
                        // linkStyle inside subgraphs applies globally anyway.
                        self.skip_statement();
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
                    let referenced =
                        self.parse_flowchart_statement(nodes, edges, seen_nodes, class_assignments)?;
                    // Track every node id referenced by statements in this
                    // subgraph so container membership is complete.
                    for id in referenced {
                        if !sg_nodes.contains(&id) {
                            sg_nodes.push(id);
                        }
                    }
                }
                _ => {
                    self.advance();
                }
            }
            previous_was_class_definition = current_is_class_definition;
        }

        Ok(Subgraph {
            title,
            id: declared_id,
            nodes: sg_nodes,
            subgraphs: sg_subgraphs,
        })
    }

    fn skip_newlines_and_semicolons(&mut self) -> bool {
        let mut skipped = false;
        while self.current().ty == TokenType::Newline || self.current().ty == TokenType::Semicolon {
            skipped = true;
            self.advance();
        }
        skipped
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
                style: None,
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

        // Square brackets: [text], [[subroutine]], [(cylinder)], [/parallelogram/], [\trapezoid\]
        if self.current().ty == TokenType::BracketOpen {
            self.advance(); // consume [
            if self.current().ty == TokenType::Label {
                let label_val = self.current().value.clone();
                // Cylinder/database: [(text)] — lexer folds the ( into the label
                if let Some(inner) = label_val.strip_prefix('(') {
                    self.advance();
                    let mut inner_label = inner.trim().to_string();
                    if self.current().ty == TokenType::ParenClose {
                        self.advance();
                    }
                    if let Some(stripped) = inner_label.strip_suffix(')') {
                        inner_label = stripped.trim().to_string();
                    }
                    if self.current().ty == TokenType::BracketClose {
                        self.advance();
                    }
                    let label = (!inner_label.is_empty()).then_some(inner_label);
                    return (NodeShape::Cylinder, label);
                }
                // Parallelogram: label starts with /
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

        // Parentheses: (text) rounded, ((text)) circle, (((text))) double circle,
        // ([text]) stadium
        if self.current().ty == TokenType::ParenOpen {
            self.advance(); // consume first (

            // The lexer's InLabel state for ( may produce a Label that starts
            // with [ for stadium shapes like ([stadium]) or ( for nested parens.
            let label_val = if self.current().ty == TokenType::Label {
                let v = self.current().value.clone();
                Some(v)
            } else {
                None
            };

            // Stadium: ([text]) — label starts with [
            if let Some(v) = &label_val {
                if let Some(inner) = v.strip_prefix('[') {
                    self.advance();
                    let mut inner_label = inner.trim().to_string();
                    if self.current().ty == TokenType::BracketClose {
                        self.advance();
                    }
                    if let Some(stripped) = inner_label.strip_suffix(']') {
                        inner_label = stripped.trim().to_string();
                    }
                    if self.current().ty == TokenType::ParenClose {
                        self.advance();
                    }
                    let label = (!inner_label.is_empty()).then_some(inner_label);
                    return (NodeShape::Stadium, label);
                }
            }

            let mut paren_depth: usize = 0;
            let label_val = if let Some(v) = label_val {
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
            let label = decode_label_entities(&label_parts.join(" "));
            let label = label.trim().to_string();
            if label.is_empty() {
                None
            } else {
                Some(label)
            }
        } else {
            None
        }
    }

    /// True when the token is a bare `o` / `x` used as an edge endpoint marker.
    fn peek_edge_marker(&self) -> Option<EdgeMarker> {
        if self.current().ty != TokenType::NodeId {
            return None;
        }
        match self.current().value.as_str() {
            "o" => Some(EdgeMarker::Circle),
            "x" => Some(EdgeMarker::Cross),
            _ => None,
        }
    }

    /// True when a bare `o`/`x` token precedes an arrow (start marker position).
    fn marker_starts_edge(&self) -> bool {
        let next = self.tokens.get(self.pos + 1);
        matches!(next.map(|t| &t.ty), Some(TokenType::Arrow) | Some(TokenType::AngleOpen))
    }

    fn marker_ends_edge(&self) -> bool {
        let next = self.tokens.get(self.pos + 1);
        matches!(next.map(|t| &t.ty), Some(TokenType::NodeId))
    }

    /// Parse a node id with its optional shape/label, registering the node.
    /// Also consumes `:::className` inline class assignments.
    fn parse_node_occurrence(
        &mut self,
        nodes: &mut Vec<Node>,
        seen_nodes: &mut std::collections::HashSet<String>,
        class_assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<String, ParseError> {
        let node_id = self.expect(TokenType::NodeId)?;

        // Expanded shape syntax: `A@{ shape: stadium, label: "Start" }`
        if self.current().ty == TokenType::Unknown && self.current().value == "@" {
            let (shape, label) = self.parse_expanded_shape()?;
            Self::add_node_if_new(nodes, seen_nodes, node_id.clone(), label, shape);
            self.parse_inline_class_assignment(&node_id, class_assignments)?;
            return Ok(node_id);
        }

        let (shape, label) = self.parse_node_shape_and_label();
        let label = label.map(|text| decode_label_entities(&text));
        Self::add_node_if_new(nodes, seen_nodes, node_id.clone(), label, shape);
        self.parse_inline_class_assignment(&node_id, class_assignments)?;
        Ok(node_id)
    }

    /// Consume a trailing `:::className` inline class assignment.
    fn parse_inline_class_assignment(
        &mut self,
        node_id: &str,
        class_assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<(), ParseError> {
        if self.current().ty == TokenType::Colon
            && self
                .tokens
                .get(self.pos + 1)
                .is_some_and(|token| token.ty == TokenType::Colon)
        {
            self.advance();
            self.advance();
            self.advance(); // consume the third colon of `:::`
            let class_name = self.expect_flowchart_class_identifier()?;
            class_assignments.push((vec![node_id.to_string()], class_name, false));
        }
        Ok(())
    }

    /// Parse `@{ key: value, ... }` shape declarations. Supports `shape`,
    /// `label`, and safe style properties; unknown keys are rejected.
    fn parse_expanded_shape(&mut self) -> Result<(NodeShape, Option<String>), ParseError> {
        self.advance(); // consume '@'
        self.expect(TokenType::BraceOpen)?;
        let content = if self.current().ty == TokenType::Label {
            let value = self.current().value.clone();
            self.advance();
            value
        } else {
            String::new()
        };
        if self.current().ty == TokenType::BraceClose {
            self.advance();
        }

        let mut shape = NodeShape::Rect;
        let mut label: Option<String> = None;
        let mut saw_shape = false;
        for part in content.split(',') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            let Some((key, value)) = part.split_once(':') else {
                return Err(ParseError::UnexpectedToken(format!(
                    "Expanded shape declarations require key: value pairs: {}", part
                )));
            };
            let value = value.trim().trim_matches('"').trim();
            match key.trim() {
                "shape" => {
                    shape = expanded_shape_name(value)
                        .ok_or_else(|| ParseError::UnexpectedToken(format!(
                            "Unsupported expanded shape name: {}", value
                        )))?;
                    saw_shape = true;
                }
                "label" => {
                    if value.is_empty() {
                        return Err(ParseError::UnexpectedToken(
                            "Expanded shape labels cannot be empty".to_string(),
                        ));
                    }
                    label = Some(decode_label_entities(value));
                }
                other => {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Unsupported expanded shape property: {}", other
                    )));
                }
            }
        }
        if !saw_shape {
            return Err(ParseError::UnexpectedToken(
                "Expanded shape declarations require a shape property".to_string(),
            ));
        }
        Ok((shape, label))
    }

    /// Parse `A & B & C` returning every node in the list.
    fn parse_node_list(
        &mut self,
        nodes: &mut Vec<Node>,
        seen_nodes: &mut std::collections::HashSet<String>,
        class_assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<Vec<String>, ParseError> {
        let mut list = vec![self.parse_node_occurrence(nodes, seen_nodes, class_assignments)?];
        while self.current().ty == TokenType::Ampersand {
            self.advance();
            list.push(self.parse_node_occurrence(nodes, seen_nodes, class_assignments)?);
        }
        Ok(list)
    }

    /// Classify an arrow token into line style, arrowhead presence, and min
    /// length (extra dash runs request more layout spacing, as in Mermaid).
    fn classify_arrow(arrow: &str) -> (EdgeStyle, bool, usize) {
        if arrow.starts_with('~') {
            return (EdgeStyle::Invisible, false, 1);
        }
        let ends_arrow = arrow.ends_with('>');
        let body = if ends_arrow { &arrow[..arrow.len() - 1] } else { arrow };
        let min_length = body.chars().filter(|c| *c == '-' || *c == '=').count().saturating_sub(1).max(1);
        if body.contains('.') {
            return (EdgeStyle::Dotted, ends_arrow, min_length);
        }
        if body.contains('=') {
            return (EdgeStyle::Thick, ends_arrow, min_length);
        }
        (
            if ends_arrow { EdgeStyle::Arrow } else { EdgeStyle::Line },
            ends_arrow,
            min_length,
        )
    }

    /// Decide whether `arrow1 label-text arrow2` is Mermaid's inline edge label
    /// form (e.g. `A -- text --> B`) rather than a chained edge via a real node.
    fn is_inline_edge_label(arrow1: &str, arrow2: &str) -> bool {
        if arrow1.ends_with('>') {
            return false;
        }
        match arrow1 {
            "--" => matches!(arrow2, "--" | "-->"),
            "==" => matches!(arrow2, "==" | "==>"),
            "-." => arrow2.starts_with('.'),
            _ => {
                // Extended line forms keep the label only when both sides match,
                // e.g. `A --- text --- B`.
                arrow1.len() > 2 && arrow1.chars().all(|c| c == '-') && arrow2 == arrow1
                    || arrow1.len() > 2 && arrow1.chars().all(|c| c == '=') && arrow2 == arrow1
            }
        }
    }

    fn parse_flowchart_statement(
        &mut self,
        nodes: &mut Vec<Node>,
        edges: &mut Vec<Edge>,
        seen_nodes: &mut std::collections::HashSet<String>,
        class_assignments: &mut Vec<(Vec<String>, String, bool)>,
    ) -> Result<Vec<String>, ParseError> {
        let mut referenced = self.parse_node_list(nodes, seen_nodes, class_assignments)?;
        let mut sources = referenced.clone();

        loop {
            // Optional start marker between the source list and the arrow: `A o-- B`.
            let start_marker = if self.peek_edge_marker().is_some() && self.marker_starts_edge() {
                let marker = self.peek_edge_marker();
                self.advance();
                marker
            } else {
                None
            };

            // Optional bidirectional head: `<` before the arrow run.
            let bidirectional = self.current().ty == TokenType::AngleOpen;
            if bidirectional {
                self.advance();
            }
            if self.current().ty != TokenType::Arrow {
                if start_marker.is_some() {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Edge marker '{}' must precede an arrow",
                        self.current().value
                    )));
                }
                break;
            }

            let mut arrow = if self.current().ty == TokenType::Arrow {
                let value = self.current().value.clone();
                self.advance();
                value
            } else {
                return Err(ParseError::UnexpectedToken(format!(
                    "Expected edge arrow after '<', got '{}'",
                    self.current().value
                )));
            };

            // End marker: a bare `o` / `x` before the target list (`A --o B`)
            // or one attached to the arrow run by the lexer (`A --oB`).
            let end_marker = if self.peek_edge_marker().is_some() && self.marker_ends_edge() {
                let marker = self.peek_edge_marker();
                self.advance();
                marker
            } else {
                None
            };
            let attached_marker = match arrow_marker(&arrow) {
                Some((marker, stripped)) => {
                    if end_marker.is_none() {
                        arrow = stripped;
                        Some(marker)
                    } else {
                        None
                    }
                }
                None => None,
            };
            let end_marker = end_marker.or(attached_marker);

            let edge_label = self.parse_edge_label();

            // Inline label form: `A -- text --> B` — the words between the two
            // arrow runs are the label, not a node. The closing arrow run
            // decides the line style and arrowhead.
            if self.current().ty == TokenType::NodeId
                && self
                    .tokens
                    .get(self.pos + 1)
                    .is_some_and(|token| token.ty == TokenType::Arrow)
                && Self::is_inline_edge_label(&arrow, &self.tokens[self.pos + 1].value)
            {
                let text = decode_label_entities(self.current().value.trim());
                self.advance(); // consume label word
                let closing_arrow = self.current().value.clone();
                self.advance(); // consume closing arrow run
                let edge_label = Some(match edge_label {
                    Some(pipe_label) => format!("{} {}", pipe_label, text),
                    None => text,
                });
                let (_, _, min_length) = Self::classify_arrow(&arrow);
                let (style, closing_ends_arrow) = {
                    let classified = Self::classify_arrow(&closing_arrow);
                    (classified.0, classified.1)
                };
                let arrow_end = arrow_end_marker(closing_ends_arrow, &style);
                let targets = self.parse_node_list(nodes, seen_nodes, class_assignments)?;
                referenced.extend(targets.iter().cloned());
                for from in &sources {
                    for to in &targets {
                        edges.push(
                            Edge::new(from.clone(), to.clone(), style.clone())
                                .with_label(edge_label.clone())
                                .with_min_length(min_length)
                                .with_markers(
                                    start_marker.or(if bidirectional { Some(EdgeMarker::Arrow) } else { None }),
                                    end_marker.or(arrow_end).or(if bidirectional { Some(EdgeMarker::Arrow) } else { None }),
                                ),
                        );
                    }
                }
                sources = targets;
                continue;
            }

            let (style, ends_arrow, min_length) = Self::classify_arrow(&arrow);
            let bidirectional_marker = if bidirectional { Some(EdgeMarker::Arrow) } else { None };
            let arrow_end = arrow_end_marker(ends_arrow, &style);
            let targets = self.parse_node_list(nodes, seen_nodes, class_assignments)?;
            referenced.extend(targets.iter().cloned());
            for from in &sources {
                for to in &targets {
                    edges.push(
                        Edge::new(from.clone(), to.clone(), style.clone())
                            .with_label(edge_label.clone())
                            .with_min_length(min_length)
                            .with_markers(
                                start_marker.or(bidirectional_marker),
                                end_marker.or(arrow_end).or(bidirectional_marker),
                            ),
                    );
                }
            }
            sources = targets;
        }

        Ok(referenced)
    }
}

struct StateNoteDraft {
    target: String,
    placement: StateNotePlacement,
    inline_text: Option<String>,
}

/// Parse the prefix of a state note statement.
fn parse_state_note_prefix(statement: &str) -> Result<Option<StateNoteDraft>, ParseError> {
    let lowercase = statement.to_ascii_lowercase();
    let placement = if lowercase.starts_with("note right of ") {
        StateNotePlacement::Right
    } else if lowercase.starts_with("note left of ") {
        StateNotePlacement::Left
    } else {
        return Ok(None);
    };
    let rest = if lowercase.starts_with("note right of ") {
        &statement[14..]
    } else {
        &statement[13..]
    };
    let (target, inline_text) = match rest.split_once(':') {
        Some((target, text)) => (target.trim(), Some(text.trim().to_string())),
        None => (rest.trim(), None),
    };
    if target.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "State notes require a target state: {}", statement
        )));
    }
    if let Some(text) = &inline_text {
        if text.is_empty() {
            return Err(ParseError::UnexpectedToken(format!(
                "State notes require text: {}", statement
            )));
        }
    }
    Ok(Some(StateNoteDraft { target: target.to_string(), placement, inline_text }))
}

/// Parse `state s2 <<choice>>` classifier declarations.
fn parse_state_classifier(rest: &str) -> Result<Option<(String, Option<StatePseudostate>)>, ParseError> {
    let Some((id, classifier)) = rest.split_once("<<") else {
        return Ok(None);
    };
    let Some(classifier) = classifier.strip_suffix(">>") else {
        return Ok(None);
    };
    let id = id.trim();
    if id.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "State classifier declarations require an id: {}", rest
        )));
    }
    let pseudostate = match classifier.trim().to_ascii_lowercase().as_str() {
        "choice" => Some(StatePseudostate::Choice),
        "fork" => Some(StatePseudostate::Fork),
        "join" => Some(StatePseudostate::Join),
        "start" => Some(StatePseudostate::Start),
        "end" => Some(StatePseudostate::End),
        other => {
            return Err(ParseError::UnexpectedToken(format!(
                "Unsupported state classifier: <<{}>>", other
            )));
        }
    };
    Ok(Some((id.to_string(), pseudostate)))
}

/// Split a state transition `A --> B : label`, returning the raw endpoint text.
fn parse_state_transition(statement: &str) -> Result<(String, String, String), ParseError> {
    let (from, rest) = statement
        .split_once("-->")
        .ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid state statement: {}", statement)))?;
    let (to, label) = rest.split_once(':').map_or((rest, ""), |(to, label)| (to, label));
    let from = from.trim();
    let to = to.trim();
    if from.is_empty() || to.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid state statement: {}", statement)));
    }
    Ok((from.to_string(), to.to_string(), label.trim().to_string()))
}

/// Map a raw state endpoint to its node id; `[*]` becomes a dedicated
/// pseudostate id depending on which side of the transition it appears.
fn resolve_state_id(raw: &str, side: TransitionSide) -> String {
    if raw == "[*]" {
        match side {
            TransitionSide::From => "__start__".to_string(),
            TransitionSide::To => "__end__".to_string(),
        }
    } else {
        raw.to_string()
    }
}

enum TransitionSide {
    From,
    To,
}

/// Parse `state "Display name" as id` or `state id`, returning the id and optional label.
fn parse_state_alias(rest: &str) -> Result<(String, Option<String>), ParseError> {
    let rest = rest.trim();
    if let Some(quoted) = rest.strip_prefix('"') {
        let (label, remainder) = quoted
            .split_once('"')
            .ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid state declaration: {}", rest)))?;
        let remainder = remainder.trim();
        let id = remainder
            .strip_prefix("as ")
            .map(str::trim)
            .unwrap_or(label);
        if id.is_empty() {
            return Err(ParseError::UnexpectedToken(format!("Invalid state declaration: {}", rest)));
        }
        return Ok((id.to_string(), Some(label.trim().to_string())));
    }
    if rest.is_empty() || rest.contains(char::is_whitespace) {
        return Err(ParseError::UnexpectedToken(format!("Invalid state declaration: {}", rest)));
    }
    Ok((rest.to_string(), None))
}

fn apply_flowchart_class_styles(
    nodes: &mut [Node],
    definitions: &std::collections::HashMap<String, NodeStyle>,
    assignments: &[(Vec<String>, String, bool)],
) -> Result<(), ParseError> {
    for (node_ids, class_name, require_defined) in assignments {
        let Some(style) = definitions.get(class_name) else {
            if *require_defined {
                return Err(ParseError::UnexpectedToken(format!(
                    "Unknown flowchart class definition: {}", class_name
                )));
            }
            // `:::name` referencing an undeclared class is tolerated, as in Mermaid.
            continue;
        };
        let style = style.clone();

        for node_id in node_ids {
            let node = nodes.iter_mut().find(|node| node.id == *node_id).ok_or_else(|| {
                ParseError::UnexpectedToken(format!("Unknown flowchart class node: {}", node_id))
            })?;
            node.classes.push(class_name.to_string());
            let node_style = node.style.get_or_insert(NodeStyle::default());
            if style.fill.is_some() { node_style.fill = style.fill.clone(); }
            if style.stroke.is_some() { node_style.stroke = style.stroke.clone(); }
            if style.color.is_some() { node_style.color = style.color.clone(); }
        }
    }

    Ok(())
}

/// Explicit end-arrow marker for arrowheads not implied by `EdgeStyle::Arrow`,
/// e.g. thick `==>` and dotted `-.->` endings.
fn arrow_end_marker(ends_arrow: bool, style: &EdgeStyle) -> Option<EdgeMarker> {
    if ends_arrow && !matches!(style, EdgeStyle::Arrow) {
        Some(EdgeMarker::Arrow)
    } else {
        None
    }
}

/// Split a trailing circle/cross edge marker from an arrow token, e.g.
/// `--o` → `(Circle, "--")`.
fn arrow_marker(arrow: &str) -> Option<(EdgeMarker, String)> {
    let marker = match arrow.chars().last()? {
        'o' => EdgeMarker::Circle,
        'x' => EdgeMarker::Cross,
        _ => return None,
    };
    let stripped = &arrow[..arrow.len() - 1];
    if stripped.is_empty() || !stripped.ends_with(['-', '=']) {
        return None;
    }
    Some((marker, stripped.to_string()))
}

/// Scan raw flowchart source for declared `subgraph <id>` identifiers so
/// container ids are known before statements are parsed.
fn collect_subgraph_ids(input: &str) -> std::collections::HashSet<String> {
    let mut ids = std::collections::HashSet::new();
    for line in input.lines() {
        let trimmed = line.trim();
        let Some(rest) = trimmed.strip_prefix("subgraph ") else {
            continue;
        };
        if let Some(id) = rest.split_whitespace().next() {
            ids.insert(id.to_string());
        }
    }
    ids
}

fn is_hex_color(value: &str) -> bool {
    let hex = value.strip_prefix('#').unwrap_or("");
    matches!(hex.len(), 3 | 6) && hex.bytes().all(|character| character.is_ascii_hexdigit())
}

/// CSS named colors accepted alongside hexadecimal values in flowchart styles.
const CSS_NAMED_COLORS: &[&str] = &[
    "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black",
    "blanchedalmond","blue","blueviolet","brown","burlywood","cadetblue","chartreuse",
    "chocolate","coral","cornflowerblue","cornsilk","crimson","cyan","darkblue",
    "darkcyan","darkgoldenrod","darkgray","darkgreen","darkgrey","darkkhaki",
    "darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon",
    "darkseagreen","darkslateblue","darkslategray","darkslategrey","darkturquoise",
    "darkviolet","deeppink","deepskyblue","dimgray","dimgrey","dodgerblue",
    "firebrick","floralwhite","forestgreen","fuchsia","gainsboro","ghostwhite",
    "gold","goldenrod","gray","green","greenyellow","grey","honeydew","hotpink",
    "indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen",
    "lemonchiffon","lightblue","lightcoral","lightcyan","lightgoldenrodyellow",
    "lightgray","lightgreen","lightgrey","lightpink","lightsalmon","lightseagreen",
    "lightskyblue","lightslategray","lightslategrey","lightsteelblue","lightyellow",
    "lime","limegreen","linen","magenta","maroon","mediumaquamarine","mediumblue",
    "mediumorchid","mediumpurple","mediumseagreen","mediumslateblue",
    "mediumspringgreen","mediumturquoise","mediumvioletred","midnightblue",
    "mintcream","mistyrose","moccasin","navajowhite","navy","oldlace","olive",
    "olivedrab","orange","orangered","orchid","palegoldenrod","palegreen",
    "paleturquoise","palevioletred","papayawhip","peachpuff","peru","pink","plum",
    "powderblue","purple","rebeccapurple","red","rosybrown","royalblue",
    "saddlebrown","salmon","sandybrown","seagreen","seashell","sienna","silver",
    "skyblue","slateblue","slategray","slategrey","snow","springgreen","steelblue",
    "tan","teal","thistle","tomato","turquoise","violet","wheat","white",
    "whitesmoke","yellow","yellowgreen",
];

/// Colors allowed in flowchart style values: safe hexadecimal or CSS named
/// colors plus the three keywords that never reference external resources.
fn is_safe_color(value: &str) -> bool {
    if is_hex_color(value) {
        return true;
    }
    let lowered = value.to_ascii_lowercase();
    matches!(lowered.as_str(), "transparent" | "none" | "currentcolor")
        || CSS_NAMED_COLORS.contains(&lowered.as_str())
}

fn is_safe_length(value: &str) -> bool {
    let numeric = value.strip_suffix("px").unwrap_or(value);
    numeric.parse::<f64>().ok().is_some_and(|length| length.is_finite() && length >= 0.0)
}

fn is_safe_dasharray(value: &str) -> bool {
    value
        .split([',', ' '])
        .filter(|part| !part.is_empty())
        .all(|part| part.parse::<f64>().ok().is_some_and(|length| length.is_finite() && length >= 0.0))
}

/// Map Mermaid expanded `@{ shape: ... }` names onto native shapes.
fn expanded_shape_name(name: &str) -> Option<NodeShape> {
    match name.trim().to_ascii_lowercase().as_str() {
        "rect" | "rectangle" => Some(NodeShape::Rect),
        "round" | "rounded" => Some(NodeShape::Rounded),
        "stadium" => Some(NodeShape::Stadium),
        "circle" => Some(NodeShape::Circle),
        "dbl-circle" | "double-circle" => Some(NodeShape::DoubleCircle),
        "diamond" => Some(NodeShape::Diamond),
        "hexagon" | "hex" => Some(NodeShape::Hexagon),
        "parallelogram" | "para" | "para-le" => Some(NodeShape::Parallelogram),
        "trapezoid" | "trap" | "trap-te" => Some(NodeShape::Trapezoid),
        "subroutine" => Some(NodeShape::Subroutine),
        "asymmetric" | "asym" => Some(NodeShape::Asymmetric),
        "cylinder" | "db" | "database" => Some(NodeShape::Cylinder),
        _ => None,
    }
}

/// Decode Mermaid entity codes in labels: `#9829;`, `#x2665;`, and the named
/// forms `#quot;`, `#amp;`, `#lt;`, `#gt;`, `#apos;`.
fn decode_label_entities(text: &str) -> String {
    if !text.contains('#') {
        return text.to_string();
    }
    let mut output = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(hash) = rest.find('#') {
        output.push_str(&rest[..hash]);
        rest = &rest[hash + 1..];
        let Some(semicolon) = rest.find(';') else {
            output.push('#');
            break;
        };
        let (code, remainder) = rest.split_at(semicolon);
        let decoded = if let Some(hex) = code.strip_prefix('x').or_else(|| code.strip_prefix('X')) {
            u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
        } else if let Ok(number) = code.parse::<u32>() {
            char::from_u32(number)
        } else {
            match code {
                "quot" => Some('"'),
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "apos" => Some('\''),
                _ => None,
            }
        };
        match decoded {
            Some(character) => output.push(character),
            None => {
                output.push('#');
                output.push_str(code);
                output.push(';');
            }
        }
        rest = &remainder[1..];
    }
    output.push_str(rest);
    output
}

/// Parse one Mermaid class relation statement, e.g.
/// `Animal <|-- Dog`, `Company "1" *-- "1..n" Department : has`, `Order ..> Customer`.
///
/// Returns the relation with `from`/`to` normalized so `to` is the decorated
/// head (where the triangle, arrow, or owner diamond points).
/// Parse class-diagram style properties from a plain string:
/// `fill:#f00, stroke: seagreen, stroke-width: 2px`.
fn parse_class_style_properties(value: &str) -> Result<NodeStyle, ParseError> {
    let mut style = NodeStyle::default();
    for property in value.split(',') {
        let property = property.trim();
        if property.is_empty() {
            continue;
        }
        let (key, raw_value) = property.split_once(':').ok_or_else(|| {
            ParseError::UnexpectedToken(format!(
                "Class style properties require key: value pairs: {}", property
            ))
        })?;
        let key = key.trim();
        let raw_value = raw_value.trim();
        let slot = match key {
            "fill" | "stroke" | "color" => {
                if !is_safe_color(raw_value) {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Class style colors must be hexadecimal or CSS named values: {}", raw_value
                    )));
                }
                match key {
                    "fill" => &mut style.fill,
                    "stroke" => &mut style.stroke,
                    _ => &mut style.color,
                }
            }
            "stroke-width" => {
                if !is_safe_length(raw_value) {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Class style stroke-width must be a number with an optional px unit: {}", raw_value
                    )));
                }
                &mut style.stroke_width
            }
            "stroke-dasharray" => {
                if !is_safe_dasharray(raw_value) {
                    return Err(ParseError::UnexpectedToken(format!(
                        "Class style stroke-dasharray must be positive numbers: {}", raw_value
                    )));
                }
                &mut style.stroke_dasharray
            }
            other => {
                return Err(ParseError::UnexpectedToken(format!(
                    "Unsupported class style property: {}", other
                )));
            }
        };
        slot.replace(raw_value.to_string());
    }
    Ok(style)
}

fn parse_class_relation(statement: &str) -> Result<Option<ClassRelation>, ParseError> {
    // Relation tokens; earlier entries win ties via leftmost position matching.
    const TOKENS: [(&str, ClassRelationKind, ArrowSide); 11] = [
        ("<|--", ClassRelationKind::Inheritance, ArrowSide::Left),
        ("--|>", ClassRelationKind::Inheritance, ArrowSide::Right),
        ("<|..", ClassRelationKind::Realization, ArrowSide::Left),
        ("..|>", ClassRelationKind::Realization, ArrowSide::Right),
        ("*--", ClassRelationKind::Composition, ArrowSide::Left),
        ("o--", ClassRelationKind::Aggregation, ArrowSide::Left),
        ("..>", ClassRelationKind::Dependency, ArrowSide::Right),
        ("..", ClassRelationKind::Dependency, ArrowSide::Right), // `A .. B` undirected dependency
        ("-->", ClassRelationKind::Association, ArrowSide::Right),
        ("<--", ClassRelationKind::Association, ArrowSide::Left),
        ("--", ClassRelationKind::Link, ArrowSide::None),
    ];

    let (body, label) = match statement.split_once(" : ") {
        Some((body, label)) => (body.trim(), label.trim().to_string()),
        None => (statement.trim(), String::new()),
    };

    let mut found: Option<(&str, ClassRelationKind, ArrowSide, usize)> = None;
    for (token, kind, side) in TOKENS.iter() {
        if let Some(position) = body.find(token) {
            let better = match found {
                None => true,
                Some((_, _, _, previous_position)) => position < previous_position,
            };
            if better {
                found = Some((token, *kind, *side, position));
            }
        }
    }
    let Some((token, kind, side, position)) = found else {
        return Ok(None);
    };

    let mut left = body[..position].trim();
    let mut right = body[position + token.len()..].trim();

    // Cardinalities are double-quoted: `Parent "1" *-- "0..n" Child`
    let mut from_cardinality = None;
    let mut to_cardinality = None;
    if let Some((card, head)) = split_leading_quoted_cardinality(right) {
        right = head;
        to_cardinality = card;
    }
    if let Some((tail, card)) = split_trailing_quoted_cardinality(left) {
        left = tail;
        from_cardinality = card;
    }

    if left.is_empty() || right.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid class relation: {}", statement)));
    }

    // Normalize direction: arrowhead kinds point at the decorated side (`to`),
    // while composition/aggregation decorations sit on the owner (`from`) side.
    let flips = matches!(side, ArrowSide::Left)
        && matches!(
            kind,
            ClassRelationKind::Inheritance | ClassRelationKind::Realization | ClassRelationKind::Association
        );
    let (from, to) = if flips {
        (right.to_string(), left.to_string())
    } else {
        (left.to_string(), right.to_string())
    };

    Ok(Some(ClassRelation {
        from,
        to,
        kind,
        label,
        from_cardinality,
        to_cardinality,
    }))
}

#[derive(Clone, Copy)]
enum ArrowSide {
    Left,
    Right,
    None,
}

/// Split a leading `"1..n"` cardinality from the right-hand entity name.
fn split_leading_quoted_cardinality(value: &str) -> Option<(Option<String>, &str)> {
    if !value.starts_with('"') {
        return None;
    }
    let end = value[1..].find('"')? + 2;
    let card = &value[1..end - 1];
    let tail = value[end..].trim();
    if card.is_empty() || tail.is_empty() {
        return None;
    }
    Some((Some(card.to_string()), tail))
}

/// Split a trailing `"1"` cardinality from the left-hand entity name.
fn split_trailing_quoted_cardinality(value: &str) -> Option<(&str, Option<String>)> {
    if !value.ends_with('"') {
        return None;
    }
    let opening = value[..value.len() - 1].rfind('"')?;
    let card = &value[opening + 1..value.len() - 1];
    let head = value[..opening].trim();
    if card.is_empty() || head.is_empty() {
        return None;
    }
    Some((head, Some(card.to_string())))
}


/// Parse one mindmap node text into a label and shape, accepting the Mermaid
/// shape delimiters `text`, `(text)`, `[text]`, `((text))`, `([text])`,
/// `[(text)]`, `{{text}}`, and `)text(`.
fn parse_mindmap_node_text(text: &str) -> Result<(String, NodeShape), ParseError> {
    let shapes: [(&str, &str, NodeShape); 7] = [
        ("((", "))", NodeShape::Circle),
        ("([", "])", NodeShape::Stadium),
        ("[(", ")]", NodeShape::Cylinder),
        ("{{", "}}", NodeShape::Hexagon),
        ("(", ")", NodeShape::Rounded),
        ("[", "]", NodeShape::Rect),
        (")", "(", NodeShape::Asymmetric),
    ];
    // A leading bare identifier may precede the shape: `root((mindmap))`.
    let shaped = match text.find(['(', '[', ']', ')', '{', '}']) {
        Some(index) if index > 0 => &text[index..],
        _ => text,
    };
    for (open, close, shape) in shapes {
        if let Some(inner) = shaped.strip_prefix(open) {
            if let Some(label) = inner.strip_suffix(close) {
                let label = label.trim();
                if label.is_empty() {
                    return Err(ParseError::UnexpectedToken(format!("Mindmap node labels cannot be empty: {}", text)));
                }
                return Ok((label.to_string(), shape));
            }
        }
    }
    if text.contains(['(', ')', '[', ']', '{', '}']) {
        return Err(ParseError::UnexpectedToken(format!(
            "Unbalanced or unsupported mindmap shape delimiters: {}", text
        )));
    }
    Ok((text.to_string(), NodeShape::Rounded))
}

fn parse_gitgraph_attributes(input: &str) -> Result<std::collections::HashMap<String, String>, ParseError> {
    let mut attributes = std::collections::HashMap::new();
    let mut rest = input.trim();
    while !rest.is_empty() {
        let colon = rest.find(':').ok_or_else(|| ParseError::UnexpectedToken(format!("GitGraph attributes require key: value syntax: {}", rest)))?;
        let key = rest[..colon].trim();
        if !matches!(key, "id" | "tag" | "type") || attributes.contains_key(key) {
            return Err(ParseError::UnexpectedToken(format!("Unsupported or duplicate GitGraph attribute: {}", key)));
        }
        rest = rest[colon + 1..].trim_start();
        let (value, next) = if let Some(quoted) = rest.strip_prefix('"') {
            let end = quoted.find('"').ok_or_else(|| ParseError::UnexpectedToken(format!("Unterminated GitGraph attribute value: {}", rest)))?;
            (&quoted[..end], &quoted[end + 1..])
        } else {
            let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
            (&rest[..end], &rest[end..])
        };
        if value.is_empty() { return Err(ParseError::UnexpectedToken(format!("GitGraph attribute cannot be empty: {}", key))); }
        attributes.insert(key.to_string(), value.to_string());
        rest = next.trim_start();
    }
    Ok(attributes)
}

fn split_c4_call(statement: &str) -> Result<(&str, &str), ParseError> {
    let open = statement.find('(').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid C4 statement: {}", statement)))?;
    if !statement.ends_with(')') { return Err(ParseError::UnexpectedToken(format!("C4 statements must close their argument list: {}", statement))); }
    Ok((statement[..open].trim(), &statement[open + 1..statement.len() - 1]))
}

fn parse_c4_arguments(input: &str) -> Result<Vec<String>, ParseError> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for character in input.chars() {
        match character {
            '"' => quoted = !quoted,
            ',' if !quoted => { values.push(current.trim().trim_matches('"').to_string()); current.clear(); }
            _ => current.push(character),
        }
    }
    if quoted { return Err(ParseError::UnexpectedToken(format!("Unterminated C4 quoted value: {}", input))); }
    values.push(current.trim().trim_matches('"').to_string());
    Ok(values)
}


/// Parse a full Mermaid ER relationship, e.g.
/// `PERSON ||--o{ CAR : owns`, `ALBUM |o..|{ TRACK : contains`.
///
/// Cardinality symbols: left `|o`, `||`, `}o`, `}|`; right `o|`, `||`, `o{`, `|{`.
/// The connector is `--` (identifying) or `..` (non-identifying).
fn parse_er_relationship(statement: &str) -> Option<ErRelationship> {
    let (body, label) = match statement.split_once(':') {
        Some((body, label)) => (body.trim(), label.trim().to_string()),
        None => (statement.trim(), String::new()),
    };

    // Locate the connector that has two cardinality characters on each side.
    let bytes = body.as_bytes();
    let mut connector: Option<(usize, bool)> = None; // (position, non_identifying)
    for index in 0..bytes.len().saturating_sub(1) {
        if bytes[index] == b'-' && bytes[index + 1] == b'-' {
            if index >= 2 && bytes[index - 1] != b'-' && bytes[index - 2] != b'-' {
                connector = Some((index, false));
            }
            break;
        }
        if bytes[index] == b'.' && bytes[index + 1] == b'.' {
            connector = Some((index, true));
            break;
        }
    }
    let (position, non_identifying) = connector?;

    let left = body.get(position.saturating_sub(2)..position)?;
    let right = body.get(position + 2..position + 4)?;
    let from = body[..position.saturating_sub(2)].trim();
    let to = body[position + 4..].trim();
    if from.is_empty() || to.is_empty() {
        return None;
    }
    let from_cardinality = match left {
        "|o" => ErCardinality::ZeroOrOne,
        "||" => ErCardinality::ExactlyOne,
        "}o" => ErCardinality::ZeroOrMore,
        "}|" => ErCardinality::OneOrMore,
        _ => return None,
    };
    let to_cardinality = match right {
        "o|" => ErCardinality::ZeroOrOne,
        "||" => ErCardinality::ExactlyOne,
        "o{" | "o}" => ErCardinality::ZeroOrMore,
        "|{" | "}|" => ErCardinality::OneOrMore,
        _ => return None,
    };
    Some(ErRelationship {
        from: from.to_string(),
        to: to.to_string(),
        label,
        from_cardinality,
        to_cardinality,
        non_identifying,
    })
}

/// Parse the attribute rows of an ER entity block:
/// `int id PK "comment"` → kind `int`, name `id`, keys `[PK]`, comment.
fn parse_er_attributes(body: &str) -> Result<Vec<ErAttribute>, ParseError> {
    let mut attributes = Vec::new();
    for line in body.lines() {
        let statement = line.trim();
        if statement.is_empty() || statement.starts_with("%%") {
            continue;
        }
        let mut parts = statement.split_whitespace();
        let kind = parts.next().unwrap_or_default();
        let name = parts.next().unwrap_or_default();
        if kind.is_empty() || name.is_empty() {
            return Err(ParseError::UnexpectedToken(format!(
                "ER attributes require a type and a name: {}", statement
            )));
        }
        let mut keys = Vec::new();
        let mut comment = None;
        for part in parts {
            if comment.is_some() {
                comment = Some(format!("{} {}", comment.take().unwrap_or_default(), part));
            } else if matches!(part, "PK" | "FK" | "UK") {
                keys.push(part.to_string());
            } else if part.starts_with('"') {
                comment = Some(part.trim_matches('"').to_string());
            } else {
                // Reference-style name used by some authors; keep as key text.
                keys.push(part.to_string());
            }
        }
        let comment = comment.filter(|comment| !comment.is_empty());
        attributes.push(ErAttribute { kind: kind.to_string(), name: name.to_string(), keys, comment });
    }
    Ok(attributes)
}


/// Parse one `excludes` entry: `weekends`, a weekday name, or a date.
fn parse_gantt_exclusion(token: &str, date_format: &str) -> Result<GanttExclusion, ParseError> {
    let lowered = token.to_ascii_lowercase();
    if lowered == "weekends" {
        return Ok(GanttExclusion::Weekend);
    }
    const WEEKDAYS: [(&str, u32); 7] = [
        ("monday", 0), ("tuesday", 1), ("wednesday", 2), ("thursday", 3),
        ("friday", 4), ("saturday", 5), ("sunday", 6),
    ];
    if let Some((_, index)) = WEEKDAYS.iter().find(|(name, _)| *name == lowered) {
        return Ok(GanttExclusion::Weekday { index: *index });
    }
    let date = parse_gantt_date(token, date_format).ok_or_else(|| {
        ParseError::UnexpectedToken(format!(
            "Gantt excludes entries must be weekends, a weekday name, or a valid date: {}", token
        ))
    })?;
    Ok(GanttExclusion::Date { date })
}

/// Validate a Gantt `dateFormat` directive. Supported tokens are YYYY, MM, and
/// DD joined by `-`, `/`, or `.`; the normalized pattern is used to parse dates.
fn parse_gantt_date_format(value: &str) -> Result<String, ParseError> {
    if value == "unix" {
        return Err(ParseError::UnexpectedToken(
            "Gantt unix dateFormat is not supported yet.".to_string(),
        ));
    }
    let mut separator = None;
    let mut tokens = Vec::new();
    let mut current = String::new();
    for character in value.chars() {
        if character == '-' || character == '/' || character == '.' {
            if current.is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Invalid Gantt dateFormat: {}", value)));
            }
            if separator.is_some_and(|previous| previous != character) {
                return Err(ParseError::UnexpectedToken(format!("Gantt dateFormat must use one separator: {}", value)));
            }
            separator = Some(character);
            tokens.push(std::mem::take(&mut current));
        } else {
            current.push(character);
        }
    }
    tokens.push(current);
    if tokens.iter().any(|token| !matches!(token.as_str(), "YYYY" | "MM" | "DD")) {
        return Err(ParseError::UnexpectedToken(format!(
            "Gantt dateFormat supports YYYY, MM, and DD tokens: {}", value
        )));
    }
    Ok(tokens.join("-"))
}

/// Parse a date according to a normalized pattern and return an ISO `yyyy-mm-dd`.
fn parse_gantt_date(value: &str, pattern: &str) -> Option<String> {
    let separator = pattern.chars().find(|c| *c == '-' || *c == '/' || *c == '.');
    let parts: Vec<&str> = match separator {
        Some(sep) => value.split(sep).collect(),
        None => {
            // Compact pattern such as YYYYMMDD; slice by token widths.
            let mut parts = Vec::new();
            let mut offset = 0;
            for token in pattern.split('-') {
                parts.push(value.get(offset..offset + token.len())?);
                offset += token.len();
            }
            if offset != value.len() { return None; }
            parts
        }
    };
    let tokens: Vec<&str> = pattern.split('-').collect();
    if parts.len() != tokens.len() {
        return None;
    }
    let mut year = String::new();
    let mut month = String::new();
    let mut day = String::new();
    for (token, part) in tokens.iter().zip(parts.iter()) {
        match *token {
            "YYYY" => year = (*part).to_string(),
            "MM" => month = (*part).to_string(),
            "DD" => day = (*part).to_string(),
            _ => return None,
        }
    }
    if year.len() != 4 || month.len() != 2 || day.len() != 2 {
        return None;
    }
    if !year.bytes().all(|b| b.is_ascii_digit())
        || !month.bytes().all(|b| b.is_ascii_digit())
        || !day.bytes().all(|b| b.is_ascii_digit())
    {
        return None;
    }
    let month_number: u32 = month.parse().ok()?;
    let day_number: u32 = day.parse().ok()?;
    if !(1..=12).contains(&month_number) || !(1..=31).contains(&day_number) {
        return None;
    }
    Some(format!("{}-{}-{}", year, month, day))
}

/// Parse a Gantt duration token: `Nd`, `Nw`, or `Nh` days.
fn parse_gantt_duration(value: &str) -> Option<f64> {
    let value = value.trim();
    let (number, unit) = value.split_at(value.len().saturating_sub(1));
    let multiplier = match unit {
        "d" => 1.0,
        "w" => 7.0,
        "h" => 1.0 / 24.0,
        _ => return None,
    };
    let number = number.trim().parse::<f64>().ok()?;
    (number > 0.0 && number.is_finite()).then(|| number * multiplier)
}

fn parse_gantt_task(
    statement: &str,
    section: &str,
    date_format: &str,
    index: usize,
) -> Result<GanttTask, ParseError> {
    let (label, schedule) = statement.split_once(':').ok_or_else(|| {
        ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement))
    })?;
    let label = label.trim();
    if label.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
    }

    let tokens: Vec<String> = schedule
        .split(',')
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty())
        .collect();
    if tokens.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
    }

    // Leading metadata tags: done / active / crit / milestone.
    let mut position = 0;
    let mut state = GanttTaskState::Todo;
    let mut milestone = false;
    while position < tokens.len() {
        match tokens[position].to_ascii_lowercase().as_str() {
            "done" => {
                state = GanttTaskState::Done;
                position += 1;
            }
            "active" => {
                state = GanttTaskState::Active;
                position += 1;
            }
            "crit" => {
                state = GanttTaskState::Crit;
                position += 1;
            }
            "milestone" => {
                milestone = true;
                position += 1;
            }
            "cancelled" | "canceled" => {
                state = GanttTaskState::Done;
                position += 1;
            }
            _ => break,
        }
    }
    let metadata = &tokens[position..];
    if metadata.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
    }

    // Optional explicit id before the schedule: `task : id, start, duration`.
    let mut id: Option<String> = None;
    let mut schedule_tokens = &metadata[..];
    if metadata.len() >= 3
        && !metadata[0].starts_with("after ")
        && parse_gantt_date(&metadata[0], date_format).is_none()
        && parse_gantt_duration(&metadata[0]).is_none()
    {
        id = Some(metadata[0].clone());
        schedule_tokens = &metadata[1..];
    }
    if schedule_tokens.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
    }

    // Start anchor: `after <id...>` or a date.
    let mut schedule_position = 0;
    let start = if let Some(after_ids) = schedule_tokens[schedule_position].strip_prefix("after ") {
        schedule_position += 1;
        let ids = after_ids
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        if ids.is_empty() {
            return Err(ParseError::UnexpectedToken(format!("Gantt after requires a task id: {}", statement)));
        }
        GanttStart::After { task_ids: ids }
    } else {
        let date = parse_gantt_date(&schedule_tokens[schedule_position], date_format).ok_or_else(|| {
            ParseError::UnexpectedToken(format!("Invalid Gantt task start date: {}", statement))
        })?;
        schedule_position += 1;
        GanttStart::Date { date }
    };

    // End anchor: a duration or an explicit end date.
    let rest = &schedule_tokens[schedule_position..];
    if rest.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "Gantt tasks require a duration or end date: {}", statement
        )));
    }
    let milestone = milestone || rest[0].trim().parse::<f64>().ok() == Some(0.0);
    if let Some(duration) = parse_gantt_duration(&rest[0]) {
        return Ok(GanttTask {
            section: section.to_string(),
            label: label.to_string(),
            id: id.unwrap_or_else(|| format!("gantt-task-{}", index + 1)),
            state,
            milestone: milestone || duration == 0.0,
            start,
            duration_days: duration,
            end_date: None,
        });
    }
    if milestone {
        // Milestones may declare `0d` implicitly through the milestone tag.
        return Ok(GanttTask {
            section: section.to_string(),
            label: label.to_string(),
            id: id.unwrap_or_else(|| format!("gantt-task-{}", index + 1)),
            state,
            milestone,
            start,
            duration_days: 0.0,
            end_date: None,
        });
    }
    let end_date = parse_gantt_date(&rest[0], date_format).ok_or_else(|| {
        ParseError::UnexpectedToken(format!(
            "Gantt duration must use Nd/Nw/Nh syntax or an end date: {}", statement
        ))
    })?;
    if rest.len() > 1 {
        return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
    }
    Ok(GanttTask {
        section: section.to_string(),
        label: label.to_string(),
        id: id.unwrap_or_else(|| format!("gantt-task-{}", index + 1)),
        state,
        milestone,
        start,
        duration_days: 0.0,
        end_date: Some(end_date),
    })
}

fn is_iso_date(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes()[4] == b'-'
        && value.as_bytes()[7] == b'-'
        && value.chars().enumerate().all(|(index, character)| index == 4 || index == 7 || character.is_ascii_digit())
}

fn parse_xy_quoted(value: &str, message: &str) -> Result<String, ParseError> { value.trim().strip_prefix('"').and_then(|text| text.strip_suffix('"')).map(str::trim).filter(|text| !text.is_empty()).map(ToString::to_string).ok_or_else(|| ParseError::UnexpectedToken(message.to_string())) }
enum XyAxisDeclaration {
    Labels(Vec<String>),
    Numeric((f64, f64), String),
}

/// Parse an `x-axis` declaration: categorical `[a, b]`, numeric `min --> max`,
/// or numeric with a quoted title: `"Title" min --> max`.
fn parse_xy_axis_declaration(value: &str) -> Result<XyAxisDeclaration, ParseError> {
    let value = value.trim();
    if value.starts_with('[') {
        return Ok(XyAxisDeclaration::Labels(parse_xy_labels(value)?));
    }
    let (title, rest) = if value.starts_with('"') {
        let end = value[1..].find('"').ok_or_else(|| {
            ParseError::UnexpectedToken("XY chart x-axis title must close its quote.".to_string())
        })? + 2;
        (value[1..end - 1].trim().to_string(), value[end..].trim())
    } else {
        (String::new(), value)
    };
    Ok(XyAxisDeclaration::Numeric(parse_xy_range(rest)?, title))
}

fn parse_xy_labels(value: &str) -> Result<Vec<String>, ParseError> { let content = value.trim().strip_prefix('[').and_then(|text| text.strip_suffix(']')).ok_or_else(|| ParseError::UnexpectedToken("XY chart x-axis must use [label, ...] syntax.".to_string()))?; let labels = content.split(',').map(str::trim).map(|label| label.trim_matches('"').trim().to_string()).collect::<Vec<_>>(); if labels.is_empty() || labels.iter().any(|label| label.is_empty()) { return Err(ParseError::UnexpectedToken("XY chart x-axis labels cannot be empty.".to_string())); } Ok(labels) }
fn parse_xy_range(value: &str) -> Result<(f64, f64), ParseError> { let value = value.trim(); let value = if value.starts_with('"') { let end = value[1..].find('"').ok_or_else(|| ParseError::UnexpectedToken("XY chart y-axis label must close its quote.".to_string()))? + 1; value[end + 1..].trim() } else { value }; let (minimum, maximum) = value.split_once("-->").ok_or_else(|| ParseError::UnexpectedToken("XY chart y-axis must use min --> max syntax.".to_string()))?; let minimum = parse_xy_number(minimum, "XY chart y-axis minimum must be finite.")?; let maximum = parse_xy_number(maximum, "XY chart y-axis maximum must be finite.")?; if minimum >= maximum { return Err(ParseError::UnexpectedToken("XY chart y-axis maximum must exceed its minimum.".to_string())); } Ok((minimum, maximum)) }
fn parse_xy_values(value: &str) -> Result<Vec<f64>, ParseError> { let content = value.trim().strip_prefix('[').and_then(|text| text.strip_suffix(']')).ok_or_else(|| ParseError::UnexpectedToken("XY chart series must use [value, ...] syntax.".to_string()))?; let values = content.split(',').map(|value| parse_xy_number(value, "XY chart series values must be finite.")).collect::<Result<Vec<_>, _>>()?; if values.is_empty() { return Err(ParseError::UnexpectedToken("XY chart series cannot be empty.".to_string())); } Ok(values) }
fn parse_xy_number(value: &str, message: &str) -> Result<f64, ParseError> { value.trim().parse::<f64>().ok().filter(|number| number.is_finite()).ok_or_else(|| ParseError::UnexpectedToken(message.to_string())) }

fn parse_sankey_csv_record(line: &str) -> Result<Vec<String>, ParseError> {
    let mut fields = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = line.trim().chars().peekable();

    while let Some(character) = chars.next() {
        match character {
            '"' if quoted && chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => {
                fields.push(field.trim().to_string());
                field.clear();
            }
            _ => field.push(character),
        }
    }
    if quoted {
        return Err(ParseError::UnexpectedToken(format!("Unterminated Sankey CSV quoted field: {}", line)));
    }
    fields.push(field.trim().to_string());
    Ok(fields)
}

fn sankey_contains_cycle(nodes: &[String], links: &[SankeyLink]) -> bool {
    let mut neighbors = std::collections::HashMap::<&str, Vec<&str>>::new();
    for link in links {
        neighbors.entry(link.source.as_str()).or_default().push(link.target.as_str());
    }
    let mut state = std::collections::HashMap::<&str, u8>::new();
    fn visit<'a>(node: &'a str, neighbors: &std::collections::HashMap<&'a str, Vec<&'a str>>, state: &mut std::collections::HashMap<&'a str, u8>) -> bool {
        match state.get(node).copied().unwrap_or_default() {
            1 => return true,
            2 => return false,
            _ => {}
        }
        state.insert(node, 1);
        if neighbors.get(node).into_iter().flatten().any(|target| visit(target, neighbors, state)) {
            return true;
        }
        state.insert(node, 2);
        false
    }
    nodes.iter().any(|node| visit(node, &neighbors, &mut state))
}

fn parse_quadrant_axis(value: &str, axis: &str) -> Result<(String, String), ParseError> {
    let (first, second) = value.split_once("-->").unwrap_or((value, ""));
    let first = first.trim();
    let second = second.trim();
    if first.is_empty() { return Err(ParseError::UnexpectedToken(format!("Quadrant {} labels cannot be empty.", axis))); }
    Ok((first.to_string(), second.to_string()))
}

fn parse_quadrant_point(statement: &str) -> Result<QuadrantPoint, ParseError> {
    let (label, value) = statement.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid quadrant point: {}", statement)))?;
    let label = label.trim();
    let values = value.trim().strip_prefix('[').and_then(|value| value.strip_suffix(']')).ok_or_else(|| ParseError::UnexpectedToken(format!("Quadrant points require [x, y] coordinates: {}", statement)))?;
    let coordinates = values.split(',').map(str::trim).collect::<Vec<_>>();
    if label.is_empty() || coordinates.len() != 2 { return Err(ParseError::UnexpectedToken(format!("Invalid quadrant point: {}", statement))); }
    let x = coordinates[0].parse::<f64>().ok().filter(|value| value.is_finite() && (0.0..=1.0).contains(value)).ok_or_else(|| ParseError::UnexpectedToken(format!("Quadrant point x must be between 0 and 1: {}", statement)))?;
    let y = coordinates[1].parse::<f64>().ok().filter(|value| value.is_finite() && (0.0..=1.0).contains(value)).ok_or_else(|| ParseError::UnexpectedToken(format!("Quadrant point y must be between 0 and 1: {}", statement)))?;
    Ok(QuadrantPoint { label: label.to_string(), x, y })
}

fn parse_architecture_service(value: &str) -> Result<ArchitectureService, ParseError> {
    let (id, rest) = value.split_once('(').ok_or_else(|| ParseError::UnexpectedToken(format!("Architecture services require id(icon)[label] syntax: {}", value)))?;
    let (icon, label) = rest.split_once(')').ok_or_else(|| ParseError::UnexpectedToken(format!("Architecture services require a closing icon delimiter: {}", value)))?;
    let id = id.trim();
    let icon = icon.trim();
    let label = label.trim().strip_prefix('[').and_then(|item| item.strip_suffix(']')).map(str::trim).unwrap_or("");
    if !architecture_identifier(id) || !architecture_identifier(icon) || label.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Architecture services require id(icon)[label] syntax: {}", value)));
    }
    Ok(ArchitectureService { id: id.to_string(), icon: icon.to_string(), label: label.to_string(), group: None })
}

fn parse_architecture_relationship(statement: &str) -> Result<ArchitectureRelationship, ParseError> {
    let (from, to, arrow_at_target, arrow_at_source) = if let Some((from, to)) = statement.split_once("<-->") {
        (from, to, true, true)
    } else if let Some((from, to)) = statement.split_once("-->") {
        (from, to, true, false)
    } else if let Some((from, to)) = statement.split_once("--") {
        (from, to, false, false)
    } else {
        return Err(ParseError::UnexpectedToken(format!("Architecture relationships require --, -->, or <--> syntax: {}", statement)));
    };
    let from = parse_architecture_source_endpoint(from)?;
    let to = parse_architecture_target_endpoint(to)?;
    Ok(ArchitectureRelationship { from, to, arrow_at_target, arrow_at_source })
}

fn parse_architecture_source_endpoint(value: &str) -> Result<String, ParseError> {
    let (id, side) = value.trim().split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Architecture relationship endpoints require id:T|B|L|R syntax: {}", value)))?;
    let id = id.trim();
    if !architecture_identifier(id) || !matches!(side.trim(), "T" | "B" | "L" | "R") {
        return Err(ParseError::UnexpectedToken(format!("Architecture relationship endpoints require id:T|B|L|R syntax: {}", value)));
    }
    Ok(id.to_string())
}

fn parse_architecture_target_endpoint(value: &str) -> Result<String, ParseError> {
    let (side, id) = value.trim().split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Architecture relationship targets require T|B|L|R:id syntax: {}", value)))?;
    let id = id.trim();
    if !matches!(side.trim(), "T" | "B" | "L" | "R") || !architecture_identifier(id) {
        return Err(ParseError::UnexpectedToken(format!("Architecture relationship targets require T|B|L|R:id syntax: {}", value)));
    }
    Ok(id.to_string())
}

fn architecture_identifier(value: &str) -> bool {
    !value.is_empty() && value.chars().all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn split_block_cells(statement: &str) -> Result<Vec<String>, ParseError> {
    let mut cells = Vec::new();
    let mut cell = String::new();
    let mut bracket_depth = 0_usize;
    let mut quoted = false;
    for character in statement.chars() {
        match character {
            '"' if bracket_depth > 0 => {
                quoted = !quoted;
                cell.push(character);
            }
            '[' if !quoted => {
                bracket_depth += 1;
                cell.push(character);
            }
            ']' if !quoted => {
                if bracket_depth == 0 {
                    return Err(ParseError::UnexpectedToken(format!("Unexpected block label delimiter: {}", statement)));
                }
                bracket_depth -= 1;
                cell.push(character);
            }
            character if character.is_whitespace() && bracket_depth == 0 && !quoted => {
                if !cell.is_empty() {
                    cells.push(std::mem::take(&mut cell));
                }
            }
            _ => cell.push(character),
        }
    }
    if bracket_depth != 0 || quoted {
        return Err(ParseError::UnexpectedToken(format!("Unclosed block label: {}", statement)));
    }
    if !cell.is_empty() {
        cells.push(cell);
    }
    Ok(cells)
}

fn parse_treemap_entry(statement: &str) -> Result<(String, Option<f64>), ParseError> {
    let (label, value) = match statement.rsplit_once(':') {
        Some((label, value)) => {
            let value = value.trim().parse::<f64>().ok().filter(|value| value.is_finite() && *value > 0.0)
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Treemap leaf values must be positive numbers: {}", statement)))?;
            (label.trim(), Some(value))
        }
        None => (statement.trim(), None),
    };
    let label = label.strip_prefix('"').and_then(|value| value.strip_suffix('"'))
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ParseError::UnexpectedToken(format!("Treemap labels must use double quotes: {}", statement)))?;
    Ok((label.to_string(), value))
}

fn parse_radar_named_item(statement: &str, kind: &str) -> Result<(String, String), ParseError> {
    let (id, label) = match statement.split_once("[") {
        Some((id, label)) => {
            let label = label.strip_suffix(']').and_then(|value| value.strip_prefix('"')).and_then(|value| value.strip_suffix('"'))
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| ParseError::UnexpectedToken(format!("Radar {} labels must use id[\"Label\"] syntax: {}", kind, statement)))?;
            (id.trim(), label.to_string())
        }
        None => (statement.trim(), statement.trim().to_string()),
    };
    if !block_identifier(id) {
        return Err(ParseError::UnexpectedToken(format!("Radar {} ids must be identifiers: {}", kind, statement)));
    }
    Ok((id.to_string(), label))
}

fn parse_radar_bound(value: &str, name: &str) -> Result<f64, ParseError> {
    value.trim().parse::<f64>().ok().filter(|value| value.is_finite())
        .ok_or_else(|| ParseError::UnexpectedToken(format!("Radar {} must be a finite number: {}", name, value)))
}

fn wardley_name(value: &str) -> String {
    value.trim().trim_matches('"').to_string()
}

fn parse_packet_label(label: &str, statement: &str) -> Result<String, ParseError> {
    label.strip_prefix('"').and_then(|value| value.strip_suffix('"'))
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| ParseError::UnexpectedToken(format!("Packet labels must use non-empty double quotes: {}", statement)))
}

fn parse_venn_named(value: &str, kind: &str) -> Result<(String, String), ParseError> {
    let (id, label) = match value.trim().split_once('[') {
        Some((id, label)) => (id.trim(), label.strip_suffix(']').and_then(|label| label.strip_prefix('"')).and_then(|label| label.strip_suffix('"')).ok_or_else(|| ParseError::UnexpectedToken(format!("Venn {} labels must use id[\"Label\"] syntax: {}", kind, value)))?),
        None => (value.trim(), value.trim()),
    };
    if id.is_empty() || label.trim().is_empty() { return Err(ParseError::UnexpectedToken(format!("Venn {} values cannot be empty: {}", kind, value))); }
    Ok((id.to_string(), label.to_string()))
}

fn parse_swimlane_lane(value: &str) -> Result<(String, String), ParseError> {
    let value = value.trim();
    let (id, label) = match value.split_once('[') { Some((id, label)) => (id.trim(), label.strip_suffix(']').map(str::trim).filter(|label| !label.is_empty()).ok_or_else(|| ParseError::UnexpectedToken(format!("Swimlane labels require id[Label] syntax: {}", value)))?), None => (value, value) };
    if !block_identifier(id) { return Err(ParseError::UnexpectedToken(format!("Swimlane identifiers must be valid: {}", value))); }
    Ok((id.to_string(), label.trim_matches('"').to_string()))
}
fn parse_swimlane_node(value: &str) -> Result<(String, String), ParseError> {
    let (id, label) = value.split_once('[').ok_or_else(|| ParseError::UnexpectedToken(format!("Swimlane nodes require id[Label] syntax: {}", value)))?;
    let label = label.strip_suffix(']').map(str::trim).filter(|label| !label.is_empty()).ok_or_else(|| ParseError::UnexpectedToken(format!("Swimlane nodes require a non-empty label: {}", value)))?;
    if !block_identifier(id.trim()) { return Err(ParseError::UnexpectedToken(format!("Swimlane node identifiers must be valid: {}", value))); }
    Ok((id.trim().to_string(), label.trim_matches('"').to_string()))
}
fn parse_swimlane_edge(value: &str) -> Result<Edge, ParseError> {
    let (from, rest) = value.split_once("-->").ok_or_else(|| ParseError::UnexpectedToken(format!("Swimlane edges require -->: {}", value)))?;
    let (label, to) = match rest.trim().strip_prefix('|') { Some(rest) => { let (label, to) = rest.split_once('|').ok_or_else(|| ParseError::UnexpectedToken(format!("Swimlane edge labels require |label| syntax: {}", value)))?; (Some(label.trim().to_string()).filter(|label| !label.is_empty()), to.trim()) }, None => (None, rest.trim()) };
    if !block_identifier(from.trim()) || !block_identifier(to) { return Err(ParseError::UnexpectedToken(format!("Swimlane edge nodes must be identifiers: {}", value))); }
    Ok(Edge { from: from.trim().to_string(), to: to.to_string(), style: EdgeStyle::Arrow, label, min_length: 1, start_marker: None, end_marker: None })
}

fn parse_block_cell(value: &str) -> Result<(String, String, usize, bool), ParseError> {
    let (token, span) = if let Some((token, span)) = value.rsplit_once(':') {
        let span = span.parse::<usize>().ok().filter(|span| *span > 0)
            .ok_or_else(|| ParseError::UnexpectedToken(format!("Block spans must be positive integers: {}", value)))?;
        (token, span)
    } else {
        (value, 1)
    };
    if token == "space" {
        return Ok((String::new(), String::new(), span, true));
    }
    let (id, label) = if let Some((id, label)) = token.split_once("[\"") {
        let label = label.strip_suffix("\"]").ok_or_else(|| ParseError::UnexpectedToken(format!("Block labels require id[\"Label\"] syntax: {}", value)))?;
        (id, label)
    } else {
        (token, token)
    };
    if !block_identifier(id) || label.is_empty() {
        return Err(ParseError::UnexpectedToken(format!("Block ids must be identifiers and labels non-empty: {}", value)));
    }
    Ok((id.to_string(), label.to_string(), span, false))
}

fn parse_block_relationship(statement: &str) -> Result<BlockRelationship, ParseError> {
    let (from, to, arrow_at_target) = if let Some((from, to)) = statement.split_once("-->") {
        (from, to, true)
    } else if let Some((from, to)) = statement.split_once("--") {
        (from, to, false)
    } else {
        return Err(ParseError::UnexpectedToken(format!("Block relationships require -- or --> syntax: {}", statement)));
    };
    let from = from.trim();
    let to = to.trim();
    if !block_identifier(from) || !block_identifier(to) {
        return Err(ParseError::UnexpectedToken(format!("Block relationships require declared block identifiers: {}", statement)));
    }
    Ok(BlockRelationship { from: from.to_string(), to: to.to_string(), arrow_at_target })
}

fn block_identifier(value: &str) -> bool {
    let mut characters = value.chars();
    matches!(characters.next(), Some(character) if character.is_ascii_alphabetic() || character == '_')
        && characters.all(|character| character.is_ascii_alphanumeric() || character == '_')
}

/// Split a trailing `@{ key: value, ... }` metadata block, returning the
/// ticket id when one is declared. Unknown keys are rejected.
fn split_kanban_metadata(statement: &str) -> Result<(&str, Option<String>), ParseError> {
    let Some(at) = statement.find("@{") else {
        return Ok((statement, None));
    };
    let base = statement[..at].trim_end();
    let body = &statement[at + 2..];
    let body = body.strip_suffix('}').ok_or_else(|| {
        ParseError::UnexpectedToken(format!("Kanban metadata must close its braces: {}", statement))
    })?;
    let mut ticket = None;
    for field in body.split(',') {
        let field = field.trim();
        if field.is_empty() {
            continue;
        }
        let (key, value) = field.split_once(':').ok_or_else(|| {
            ParseError::UnexpectedToken(format!(
                "Kanban metadata requires key: value pairs: {}", field
            ))
        })?;
        let value = value.trim().trim_matches('"');
        match key.trim() {
            "ticket" => ticket = Some(value.to_string()),
            "assigned" => {}
            other => {
                return Err(ParseError::UnexpectedToken(format!(
                    "Unsupported Kanban metadata key: {}", other
                )));
            }
        }
    }
    Ok((base, ticket))
}

fn parse_kanban_item(statement: &str, prefix: &str, index: usize) -> Result<(String, String), ParseError> {
    if let Some(label) = statement.strip_prefix('[').and_then(|value| value.strip_suffix(']')) {
        if label.trim().is_empty() {
            return Err(ParseError::UnexpectedToken(format!("Kanban labels cannot be empty: {}", statement)));
        }
        return Ok((format!("{}-{}", prefix, index), label.trim().to_string()));
    }
    if let Some((id, label)) = statement.split_once('[') {
        let label = label.strip_suffix(']').ok_or_else(|| ParseError::UnexpectedToken(format!("Kanban labels require id[Label] syntax: {}", statement)))?;
        if !block_identifier(id) || label.trim().is_empty() {
            return Err(ParseError::UnexpectedToken(format!("Kanban ids must be identifiers and labels non-empty: {}", statement)));
        }
        return Ok((id.to_string(), label.trim().to_string()));
    }
    if statement.trim().is_empty() {
        return Err(ParseError::UnexpectedToken("Kanban labels cannot be empty.".to_string()));
    }
    Ok((format!("{}-{}", prefix, index), statement.trim().to_string()))
}

pub fn parse_input(input: &str) -> Result<DiagramAst, ParseError> {
    let stripped = crate::accessibility::strip_accessibility(input);
    let mut parser = Parser::new(&stripped);
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
fn parse_sequence_participant(statement: &str) -> Result<Option<SequenceParticipant>, ParseError> {
    let Some((kind, declaration)) = statement.split_once(char::is_whitespace) else {
        return Ok(None);
    };
    let kind = match kind.to_ascii_lowercase().as_str() {
        "participant" => SequenceParticipantKind::Participant,
        "actor" => SequenceParticipantKind::Actor,
        _ => return Ok(None),
    };
    let declaration = declaration.trim();
    let (id, label) = split_sequence_participant_alias(declaration);
    if id.is_empty() || label.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "Invalid sequence participant declaration: {}",
            statement
        )));
    }
    Ok(Some(SequenceParticipant {
        id: id.to_string(),
        label: label.to_string(),
        kind,
    }))
}

fn split_sequence_participant_alias(declaration: &str) -> (&str, &str) {
    let lowercase = declaration.to_ascii_lowercase();
    if let Some(alias_start) = lowercase.find(" as ") {
        let id = declaration[..alias_start].trim();
        let label = declaration[alias_start + 4..].trim();
        let label = label
            .strip_prefix('"')
            .and_then(|rest| rest.strip_suffix('"'))
            .unwrap_or(label);
        return (id, label);
    }
    let declaration = declaration.trim();
    (declaration, declaration)
}

fn upsert_sequence_participant(participants: &mut Vec<SequenceParticipant>, participant: SequenceParticipant) {
    if let Some(existing) = participants.iter_mut().find(|existing| existing.id == participant.id) {
        *existing = participant;
    } else {
        participants.push(participant);
    }
}

fn add_inferred_sequence_participant(participants: &mut Vec<SequenceParticipant>, id: &str) {
    if participants.iter().all(|participant| participant.id != id) {
        participants.push(SequenceParticipant {
            id: id.to_string(),
            label: id.to_string(),
            kind: SequenceParticipantKind::Participant,
        });
    }
}

fn open_sequence_activation(activations: &mut std::collections::HashMap<String, usize>, participant: &str) {
    *activations.entry(participant.to_string()).or_default() += 1;
}

fn close_sequence_activation(
    activations: &mut std::collections::HashMap<String, usize>,
    participant: &str,
    statement: &str,
) -> Result<(), ParseError> {
    let Some(depth) = activations.get_mut(participant) else {
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence deactivation has no open activation: {}",
            statement
        )));
    };
    *depth -= 1;
    if *depth == 0 {
        activations.remove(participant);
    }
    Ok(())
}

struct SequenceNote {
    placement: SequenceNotePlacement,
    participants: Vec<String>,
    text: String,
}

impl SequenceNote {
    fn into_event(self) -> SequenceEvent {
        SequenceEvent::Note {
            placement: self.placement,
            participants: self.participants,
            text: self.text,
        }
    }
}

struct SequenceActivation {
    participant: String,
    active: bool,
}

fn parse_sequence_note(statement: &str) -> Result<Option<SequenceNote>, ParseError> {
    let Some((prefix, text)) = statement.split_once(':') else {
        return if statement.to_ascii_lowercase().starts_with("note ") {
            Err(ParseError::UnexpectedToken(format!(
                "Sequence notes require text: {}",
                statement
            )))
        } else {
            Ok(None)
        };
    };
    let Some(rest) = prefix.trim().strip_prefix("Note ").or_else(|| prefix.trim().strip_prefix("note ")) else {
        return Ok(None);
    };
    let text = text.trim();
    if text.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence notes require text: {}",
            statement
        )));
    }
    let lower = rest.to_ascii_lowercase();
    let (placement, participant_text) = if lower.starts_with("left of ") {
        (SequenceNotePlacement::LeftOf, &rest[8..])
    } else if lower.starts_with("right of ") {
        (SequenceNotePlacement::RightOf, &rest[9..])
    } else if lower.starts_with("over ") {
        (SequenceNotePlacement::Over, &rest[5..])
    } else {
        return Err(ParseError::UnexpectedToken(format!(
            "Invalid sequence note: {}",
            statement
        )));
    };
    let participants = participant_text
        .split(',')
        .map(str::trim)
        .filter(|participant| !participant.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    let expected_count = match placement {
        SequenceNotePlacement::Over => 1..=2,
        SequenceNotePlacement::LeftOf | SequenceNotePlacement::RightOf => 1..=1,
    };
    if !expected_count.contains(&participants.len()) {
        return Err(ParseError::UnexpectedToken(format!(
            "Invalid sequence note target: {}",
            statement
        )));
    }
    Ok(Some(SequenceNote { placement, participants, text: text.to_string() }))
}

fn parse_sequence_activation(statement: &str) -> Result<Option<SequenceActivation>, ParseError> {
    let Some((keyword, participant)) = statement.split_once(char::is_whitespace) else {
        return Ok(None);
    };
    let active = match keyword.to_ascii_lowercase().as_str() {
        "activate" => true,
        "deactivate" => false,
        _ => return Ok(None),
    };
    let participant = participant.trim();
    if participant.is_empty() || participant.contains(char::is_whitespace) {
        return Err(ParseError::UnexpectedToken(format!(
            "Invalid sequence activation statement: {}",
            statement
        )));
    }
    Ok(Some(SequenceActivation { participant: participant.to_string(), active }))
}

fn parse_sequence_control(
    statement: &str,
    blocks: &mut Vec<SequenceBlockKind>,
) -> Result<Option<SequenceEvent>, ParseError> {
    if statement.eq_ignore_ascii_case("end") {
        if blocks.pop().is_none() {
            return Err(ParseError::UnexpectedToken("Sequence end has no open control block".to_string()));
        }
        return Ok(Some(SequenceEvent::BlockEnd));
    }
    if let Some(color) = parse_sequence_rect_color(statement)? {
        blocks.push(SequenceBlockKind::Rect);
        return Ok(Some(SequenceEvent::BlockStart {
            block: SequenceBlockKind::Rect,
            label: String::new(),
            color: Some(color),
        }));
    }
    let Some((keyword, label)) = statement.split_once(char::is_whitespace) else {
        return Ok(None);
    };
    let keyword = keyword.to_ascii_lowercase();
    let label = label.trim().to_string();
    let block = match keyword.as_str() {
        "loop" => Some(SequenceBlockKind::Loop),
        "alt" => Some(SequenceBlockKind::Alt),
        "opt" => Some(SequenceBlockKind::Opt),
        "par" => Some(SequenceBlockKind::Par),
        "critical" => Some(SequenceBlockKind::Critical),
        "break" => Some(SequenceBlockKind::Break),
        _ => None,
    };
    if let Some(block) = block {
        blocks.push(block);
        return Ok(Some(SequenceEvent::BlockStart {
            block,
            label,
            color: None,
        }));
    }
    let divider = match keyword.as_str() {
        "else" if matches!(blocks.last(), Some(SequenceBlockKind::Alt)) => Some(SequenceBlockDividerKind::Else),
        "and" if matches!(blocks.last(), Some(SequenceBlockKind::Par)) => Some(SequenceBlockDividerKind::And),
        "option" if matches!(blocks.last(), Some(SequenceBlockKind::Critical)) => Some(SequenceBlockDividerKind::Option),
        "else" | "and" | "option" => {
            return Err(ParseError::UnexpectedToken(format!(
                "Sequence {} is not valid in the current control block",
                keyword
            )));
        }
        _ => None,
    };
    Ok(divider.map(|divider| SequenceEvent::BlockDivider { divider, label }))
}

fn parse_sequence_rect_color(statement: &str) -> Result<Option<String>, ParseError> {
    let lowercase = statement.to_ascii_lowercase();
    if !lowercase.starts_with("rect") {
        return Ok(None);
    }
    let remainder = statement[4..].trim();
    // `rect #rgb` / `rect #rrggbb` hex fills.
    if let Some(hex) = remainder.strip_prefix('#') {
        if matches!(hex.len(), 3 | 6) && hex.bytes().all(|character| character.is_ascii_hexdigit()) {
            return Ok(Some(format!("#{}", hex.to_ascii_lowercase())));
        }
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence rect hex colors must be three- or six-digit values: {}",
            statement
        )));
    }
    if remainder.is_empty() || !remainder.to_ascii_lowercase().starts_with("rgb(") || !remainder.ends_with(')') {
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence rect requires an rgb(red, green, blue) or hex color: {}",
            statement
        )));
    }
    let channels = remainder[4..remainder.len() - 1]
        .split(',')
        .map(str::trim)
        .map(|channel| channel.parse::<u8>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ParseError::UnexpectedToken(format!(
            "Sequence rect requires RGB values from 0 to 255: {}",
            statement
        )))?;
    let [red, green, blue] = channels.as_slice() else {
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence rect requires exactly three RGB values: {}",
            statement
        )));
    };
    Ok(Some(format!("rgb({}, {}, {})", red, green, blue)))
}

struct SequenceCreate {
    participant: SequenceParticipant,
}

/// Parse `create participant X`, `create actor X as "Label"`, `destroy X`.
fn parse_sequence_create(statement: &str) -> Result<Option<SequenceCreate>, ParseError> {
    let lowercase = statement.to_ascii_lowercase();
    if !lowercase.starts_with("create ") {
        return Ok(None);
    }
    let rest = statement[6..].trim();
    let participant = parse_sequence_participant(rest)?.ok_or_else(|| {
        ParseError::UnexpectedToken(format!(
            "Sequence create requires participant or actor: {}", statement
        ))
    })?;
    Ok(Some(SequenceCreate { participant }))
}

fn parse_sequence_destroy(statement: &str) -> Result<Option<String>, ParseError> {
    let lowercase = statement.to_ascii_lowercase();
    if !lowercase.starts_with("destroy ") {
        return Ok(None);
    }
    let participant = statement[7..].trim();
    if participant.is_empty() || participant.contains(char::is_whitespace) {
        return Err(ParseError::UnexpectedToken(format!(
            "Sequence destroy requires exactly one participant: {}", statement
        )));
    }
    Ok(Some(participant.to_string()))
}

/// Parse `box [color] [label]` opening a participant group.
fn parse_sequence_box_start(statement: &str) -> Result<Option<SequenceBox>, ParseError> {
    let lowercase = statement.to_ascii_lowercase();
    if !(lowercase == "box" || lowercase.starts_with("box ")) {
        return Ok(None);
    }
    let mut rest = statement[3..].trim();
    let mut color = None;
    if let Some(hex) = rest.strip_prefix('#') {
        let hex_end = hex
            .find(char::is_whitespace)
            .unwrap_or(hex.len());
        let hex_value = &hex[..hex_end];
        if !matches!(hex_value.len(), 3 | 6)
            || !hex_value.bytes().all(|character| character.is_ascii_hexdigit())
        {
            return Err(ParseError::UnexpectedToken(format!(
                "Sequence box colors must be three- or six-digit hexadecimal values: {}", statement
            )));
        }
        color = Some(format!("#{}", hex_value.to_ascii_lowercase()));
        rest = rest[hex_end + 1..].trim();
    } else if lowercase[3..].trim_start().starts_with("rgb(") {
        let close = rest.find(')').ok_or_else(|| {
            ParseError::UnexpectedToken(format!("Sequence box rgb colors must close: {}", statement))
        })?;
        let inner = &rest[4..close];
        let channels = inner
            .split(',')
            .map(str::trim)
            .map(|channel| channel.parse::<u8>())
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| {
                ParseError::UnexpectedToken(format!(
                    "Sequence box rgb channels must be 0-255: {}", statement
                ))
            })?;
        let [red, green, blue] = channels.as_slice() else {
            return Err(ParseError::UnexpectedToken(format!(
                "Sequence box rgb requires three channels: {}", statement
            )));
        };
        color = Some(format!("rgb({}, {}, {})", red, green, blue));
        rest = rest[close + 1..].trim();
    }
    let label = rest.trim().trim_matches('"').to_string();
    Ok(Some(SequenceBox { label, color, participants: Vec::new() }))
}

/// Record every declared participant in the most recent open box group.
fn register_box_membership(boxes: &mut [SequenceBox], participants: &[SequenceParticipant]) {
    let Some(box_group) = boxes.last_mut() else {
        return;
    };
    for participant in participants {
        if !box_group.participants.iter().any(|member| member == &participant.id) {
            box_group.participants.push(participant.id.clone());
        }
    }
}

fn parse_sequence_message(statement: &str) -> Result<Option<SequenceMessage>, ParseError> {
    // Bidirectional links: `A<->B: label` / `A<-->B: label`
    let mut bidirectional = false;
    let (from, rest, line_style, end_marker) = if let Some((from, rest)) = statement.split_once("<->") {
        bidirectional = true;
        let rest = rest.strip_prefix('>').unwrap_or(rest);
        (from, rest, SequenceMessageLineStyle::Solid, SequenceMessageEnd::Arrow)
    } else {
        let arrows = [
            ("-->>", SequenceMessageLineStyle::Dashed, SequenceMessageEnd::Arrow),
            ("->>", SequenceMessageLineStyle::Solid, SequenceMessageEnd::Arrow),
            ("--)", SequenceMessageLineStyle::Dashed, SequenceMessageEnd::Open),
            ("-)", SequenceMessageLineStyle::Solid, SequenceMessageEnd::Open),
            ("-->", SequenceMessageLineStyle::Dashed, SequenceMessageEnd::Arrow),
            ("--x", SequenceMessageLineStyle::Dashed, SequenceMessageEnd::Cross),
        ];
        let Some(found) = arrows.iter().find_map(|(arrow, style, end_marker)| {
            statement.split_once(arrow).map(|(from, rest)| (from, rest, *style, *end_marker))
        }) else {
            return Ok(None);
        };
        found
    };
    let (target, label) = rest.split_once(':').ok_or_else(|| {
        ParseError::UnexpectedToken(format!(
            "Sequence messages require a label: {}",
            statement
        ))
    })?;
    let from = from.trim();
    let target = target.trim();
    let label = label.trim();
    let (to, activate_target, deactivate_source) = if let Some(to) = target.strip_prefix('+') {
        (to.trim(), true, false)
    } else if let Some(to) = target.strip_prefix('-') {
        (to.trim(), false, true)
    } else {
        (target, false, false)
    };
    if from.is_empty() || to.is_empty() || label.is_empty() {
        return Err(ParseError::UnexpectedToken(format!(
            "Invalid sequence statement: {}",
            statement
        )));
    }
    Ok(Some(SequenceMessage {
        from: from.to_string(),
        to: to.to_string(),
        label: label.to_string(),
        line_style,
        end_marker,
        activate_target,
        deactivate_source,
        bidirectional,
    }))
}
