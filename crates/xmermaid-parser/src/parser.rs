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
        if self.input.trim_start().starts_with("erDiagram") { return self.parse_er(); }
        if self.input.trim_start().starts_with("gantt") { return self.parse_gantt(); }
        if self.input.trim_start().starts_with("pie") { return self.parse_pie(); }
        if self.input.trim_start().starts_with("journey") { return self.parse_user_journey(); }
        if self.input.trim_start().starts_with("timeline") { return self.parse_timeline(); }
        if self.input.trim_start().starts_with("mindmap") { return self.parse_mindmap(); }
        if self.input.trim_start().starts_with("requirementDiagram") { return self.parse_requirement(); }
        if self.input.trim_start().starts_with("gitGraph") { return self.parse_gitgraph(); }
        if self.input.trim_start().starts_with("C4") { return self.parse_c4(); }
        if self.input.trim_start().starts_with("zenuml") { return self.parse_zenuml(); }
        if self.input.trim_start().starts_with("xychart-beta") { return self.parse_xychart(); }
        if self.input.trim_start().starts_with("sankey") { return self.parse_sankey(); }
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
    fn parse_er(&self) -> Result<DiagramAst, ParseError> {
        let mut entities = Vec::new();
        let mut relationships = Vec::new();

        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
                continue;
            }
            let (from, rest) = statement.split_once("||--o{").ok_or_else(|| {
                ParseError::UnexpectedToken(format!("Invalid ER statement: {}", statement))
            })?;
            let (to, label) = rest
                .split_once(':')
                .map_or((rest, ""), |(to, label)| (to, label));
            let (from, to) = (from.trim(), to.trim());
            if from.is_empty() || to.is_empty() {
                return Err(ParseError::UnexpectedToken(format!(
                    "Invalid ER statement: {}",
                    statement
                )));
            }
            for entity in [from, to] {
                if !entities.iter().any(|item| item == entity) {
                    entities.push(entity.to_string());
                }
            }
            relationships.push(ErRelationship {
                from: from.to_string(),
                to: to.to_string(),
                label: label.trim().to_string(),
            });
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
            if statement.starts_with("title ") || statement.starts_with("dateFormat ") || statement.starts_with("axisFormat ") {
                continue;
            }

            let (label, schedule) = statement.split_once(':').ok_or_else(|| {
                ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement))
            })?;
            let (start, duration) = schedule.trim().split_once(',').ok_or_else(|| {
                ParseError::UnexpectedToken(format!("Gantt tasks require a start date and duration: {}", statement))
            })?;
            let start = start.trim();
            let duration = duration.trim();
            let days = duration.strip_suffix('d').and_then(|value| value.trim().parse::<u32>().ok()).filter(|days| *days > 0).ok_or_else(|| {
                ParseError::UnexpectedToken(format!("Gantt duration must use positive Nd syntax: {}", statement))
            })?;
            if !is_iso_date(start) || label.trim().is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Invalid Gantt task: {}", statement)));
            }
            tasks.push(GanttTask { section: section.clone(), label: label.trim().to_string(), start: start.to_string(), duration_days: days });
        }

        if tasks.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Gantt(GanttAst { tasks }))
    }

    fn parse_pie(&self) -> Result<DiagramAst, ParseError> {
        let mut title = String::new();
        let mut slices = Vec::new();
        for line in self.input.lines() {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("pie title ") { title = value.trim().to_string(); continue; }
            if statement == "pie" { continue; }
            let (label, value) = statement.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Invalid Pie slice: {}", statement)))?;
            let label = label.trim().trim_matches('"');
            let value = value.trim().parse::<f64>().map_err(|_| ParseError::UnexpectedToken(format!("Pie values must be numeric: {}", statement)))?;
            if label.is_empty() || value <= 0.0 { return Err(ParseError::UnexpectedToken(format!("Invalid Pie slice: {}", statement))); }
            slices.push(PieSlice { label: label.to_string(), value });
        }
        if slices.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Pie(PieAst { title, slices }))
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
        let mut title = String::new(); let mut entries: Vec<TimelineEntry> = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("title ") { title = value.trim().to_string(); continue; }
            let (period, event) = statement.split_once(':').ok_or_else(|| ParseError::UnexpectedToken(format!("Timeline entries require period : event syntax: {}", statement)))?;
            let period = period.trim(); let event = event.trim();
            if event.is_empty() { return Err(ParseError::UnexpectedToken(format!("Timeline events cannot be empty: {}", statement))); }
            if period.is_empty() { if let Some(entry) = entries.last_mut() { entry.events.push(event.to_string()); } else { return Err(ParseError::UnexpectedToken(format!("Timeline event has no preceding period: {}", statement))); } } else { entries.push(TimelineEntry { period: period.to_string(), events: vec![event.to_string()] }); }
        }
        if entries.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::Timeline(TimelineAst { title, entries }))
    }
    fn parse_mindmap(&self) -> Result<DiagramAst, ParseError> {
        let mut nodes = Vec::new(); let mut parents: Vec<String> = Vec::new(); let mut base_indent = None;
        for line in self.input.lines().skip(1) { let raw = line.trim_end(); if raw.trim().is_empty() { continue; }
            let depth = raw.len() - raw.trim_start().len(); let base = *base_indent.get_or_insert(depth); let level = (depth.saturating_sub(base)) / 2; let label = raw.trim();
            if level > parents.len() || label.is_empty() { return Err(ParseError::UnexpectedToken(format!("Invalid Mindmap indentation: {}", raw))); }
            if label.contains(['(', ')', '[', ']', '{', '}']) { return Err(ParseError::UnexpectedToken(format!("Mindmap node shapes are not supported: {}", label))); }
            let id = format!("mindmap-{}", nodes.len()); let parent = if level == 0 { None } else { Some(parents[level - 1].clone()) };
            parents.truncate(level); parents.push(id.clone()); nodes.push(MindmapNode { id, label: label.to_string(), parent }); }
        if nodes.is_empty() { return Err(ParseError::EmptyInput); } Ok(DiagramAst::Mindmap(MindmapAst { nodes }))
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
        for line in header {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") { continue; }
            if let Some(value) = statement.strip_prefix("title ") { title = value.trim().to_string(); continue; }
            let (kind, arguments) = split_c4_call(statement)?;
            let values = parse_c4_arguments(arguments)?;
            if kind == "Rel" {
                if values.len() != 3 || values.iter().any(|value| value.is_empty()) { return Err(ParseError::UnexpectedToken(format!("C4 Rel requires from, to, and label: {}", statement))); }
                relationships.push(C4Relationship { from: values[0].clone(), to: values[1].clone(), label: values[2].clone() });
                continue;
            }
            if !matches!(kind, "Person" | "Person_Ext" | "System" | "System_Ext" | "Container" | "Container_Ext" | "SystemDb" | "SystemDb_Ext" | "ContainerDb" | "ContainerDb_Ext" | "Component" | "Component_Ext" | "ComponentDb" | "ComponentDb_Ext") || !(2..=3).contains(&values.len()) || values[0].is_empty() || values[1].is_empty() {
                return Err(ParseError::UnexpectedToken(format!("Unsupported C4 element: {}", statement)));
            }
            if elements.iter().any(|element: &C4Element| element.id == values[0]) { return Err(ParseError::UnexpectedToken(format!("Duplicate C4 element id: {}", values[0]))); }
            elements.push(C4Element { kind: kind.to_string(), id: values[0].clone(), label: values[1].clone(), description: values.get(2).cloned() });
        }
        if elements.is_empty() { return Err(ParseError::EmptyInput); }
        Ok(DiagramAst::C4(C4Ast { diagram_kind: diagram_kind.to_string(), title, elements, relationships }))
    }

    fn parse_zenuml(&self) -> Result<DiagramAst, ParseError> {
        let mut participants = Vec::new();
        let mut messages = Vec::new();
        for line in self.input.lines().skip(1) {
            let statement = line.trim();
            if statement.is_empty() || statement.starts_with("%%") {
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
        if header != "xychart-beta" { return Err(ParseError::UnexpectedToken(format!("Unsupported XY chart declaration: {}", header))); }
        let mut title = String::new(); let mut x_labels = None; let mut y_range = None; let mut series = Vec::new();
        for statement in lines {
            if let Some(value) = statement.strip_prefix("title ") { if !title.is_empty() { return Err(ParseError::UnexpectedToken("XY chart title may only be declared once.".to_string())); } title = parse_xy_quoted(value, "XY chart titles must be quoted")?; continue; }
            if let Some(value) = statement.strip_prefix("x-axis ") { if x_labels.is_some() { return Err(ParseError::UnexpectedToken("XY chart x-axis may only be declared once.".to_string())); } x_labels = Some(parse_xy_labels(value)?); continue; }
            if let Some(value) = statement.strip_prefix("y-axis ") { if y_range.is_some() { return Err(ParseError::UnexpectedToken("XY chart y-axis may only be declared once.".to_string())); } y_range = Some(parse_xy_range(value)?); continue; }
            let (kind, values) = if let Some(value) = statement.strip_prefix("bar ") { (XySeriesKind::Bar, parse_xy_values(value)?) } else if let Some(value) = statement.strip_prefix("line ") { (XySeriesKind::Line, parse_xy_values(value)?) } else { return Err(ParseError::UnexpectedToken(format!("Unsupported XY chart statement: {}", statement))); };
            series.push(XySeries { kind, values });
        }
        let x_labels = x_labels.ok_or_else(|| ParseError::UnexpectedToken("XY charts require a categorical x-axis.".to_string()))?;
        let (y_min, y_max) = y_range.ok_or_else(|| ParseError::UnexpectedToken("XY charts require a numeric y-axis range.".to_string()))?;
        if series.is_empty() { return Err(ParseError::EmptyInput); }
        if series.iter().any(|item| item.values.len() != x_labels.len()) { return Err(ParseError::UnexpectedToken("Each XY chart series must contain one value per x-axis label.".to_string())); }
        Ok(DiagramAst::XyChart(XyChartAst { title, x_labels, y_min, y_max, series }))
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
        Ok(DiagramAst::Sankey(SankeyAst { nodes, links }))
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

fn is_iso_date(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes()[4] == b'-'
        && value.as_bytes()[7] == b'-'
        && value.chars().enumerate().all(|(index, character)| index == 4 || index == 7 || character.is_ascii_digit())
}

fn parse_xy_quoted(value: &str, message: &str) -> Result<String, ParseError> { value.trim().strip_prefix('"').and_then(|text| text.strip_suffix('"')).map(str::trim).filter(|text| !text.is_empty()).map(ToString::to_string).ok_or_else(|| ParseError::UnexpectedToken(message.to_string())) }
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
