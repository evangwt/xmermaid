use crate::ast::*;
use crate::error::ParseError;
use crate::lexer::{Lexer, Token, TokenType};

pub struct Parser<'a> {
    tokens: Vec<Token>,
    pos: usize,
    _input: &'a str,
}

impl<'a> Parser<'a> {
    pub fn new(input: &'a str) -> Self {
        let lexer = Lexer::new(input);
        let mut tokens: Vec<Token> = lexer.collect();
        if tokens.is_empty() || tokens.last().map(|t| t.ty != TokenType::Eof).unwrap_or(true) {
            tokens.push(Token {
                ty: TokenType::Eof,
                value: String::new(),
                line: 0,
                column: 0,
            });
        }
        Self {
            tokens,
            pos: 0,
            _input: input,
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
        let keyword = self.expect(TokenType::Keyword)?;

        match keyword.as_str() {
            "graph" | "flowchart" => self.parse_flowchart(),
            _ => Err(ParseError::UnsupportedDiagramType(keyword)),
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
        let mut seen_nodes: std::collections::HashSet<String> = std::collections::HashSet::new();

        while self.current().ty != TokenType::Eof {
            self.skip_newlines();
            if self.current().ty == TokenType::Eof {
                break;
            }
            self.parse_flowchart_statement(&mut nodes, &mut edges, &mut seen_nodes)?;
            self.skip_newlines();
        }

        Ok(DiagramAst::Flowchart(FlowchartAst {
            direction,
            nodes,
            edges,
            subgraphs: Vec::new(),
        }))
    }

    fn skip_newlines(&mut self) {
        while self.current().ty == TokenType::Newline {
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
        let mut shape = NodeShape::Rect;
        let mut label: Option<String> = None;

        if self.current().ty == TokenType::BracketOpen {
            let bracket = self.current().value.clone();
            self.advance();

            if self.current().ty == TokenType::Label {
                label = Some(self.current().value.clone());
                self.advance();
            }

            // Check for nested bracket (circle: ((...)))
            if self.current().ty == TokenType::BracketOpen {
                let inner = self.current().value.clone();
                self.advance();
                if inner == "(" && bracket == "(" {
                    shape = NodeShape::Circle;
                }
                if self.current().ty == TokenType::Label {
                    label = Some(self.current().value.clone());
                    self.advance();
                }
                if self.current().ty == TokenType::BracketClose {
                    self.advance();
                }
            }

            if self.current().ty == TokenType::BracketClose {
                self.advance();
            }

            if shape != NodeShape::Circle {
                shape = match bracket.as_str() {
                    "[" => NodeShape::Rect,
                    "(" => NodeShape::Rounded,
                    _ => NodeShape::Rect,
                };
            }
        }

        (shape, label)
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

        // Check for edge
        if self.current().ty == TokenType::Arrow {
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

            let target_id = self.expect(TokenType::NodeId)?;
            let (target_shape, target_label) = self.parse_node_shape_and_label();

            Self::add_node_if_new(nodes, seen_nodes, target_id.clone(), target_label, target_shape);

            edges.push(Edge {
                from: node_id,
                to: target_id,
                style,
                label: None,
                min_length: 1,
            });
        }

        Ok(())
    }
}

pub fn parse_input(input: &str) -> Result<DiagramAst, ParseError> {
    let mut parser = Parser::new(input);
    parser.parse()
}
