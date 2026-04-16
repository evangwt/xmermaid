use std::iter::Peekable;
use std::str::Chars;

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub ty: TokenType,
    pub value: String,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenType {
    Keyword,
    Direction,
    NodeId,
    Arrow,
    Label,
    BracketOpen,
    BracketClose,
    Newline,
    Eof,
    Unknown,
}

#[derive(Debug, Clone, PartialEq)]
enum LexerState {
    Normal,
    InLabel(char),
}

pub struct Lexer<'a> {
    input: Peekable<Chars<'a>>,
    line: usize,
    column: usize,
    state: LexerState,
    done: bool,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input: input.chars().peekable(),
            line: 1,
            column: 1,
            state: LexerState::Normal,
            done: false,
        }
    }

    fn peek(&mut self) -> Option<&char> {
        self.input.peek()
    }

    fn advance(&mut self) -> Option<char> {
        let c = self.input.next();
        if let Some('\n') = c {
            self.line += 1;
            self.column = 1;
        } else {
            self.column += 1;
        }
        c
    }

    fn skip_whitespace(&mut self) {
        while let Some(&c) = self.peek() {
            if c == ' ' || c == '\t' {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn read_word(&mut self) -> String {
        let mut word = String::new();
        while let Some(&c) = self.peek() {
            if c.is_alphanumeric() || c == '_' {
                word.push(self.advance().unwrap());
            } else {
                break;
            }
        }
        word
    }

    fn read_arrow(&mut self) -> String {
        let mut arrow = String::new();
        while let Some(&c) = self.peek() {
            if c == '-' || c == '.' || c == '=' || c == '>' || c == '~' {
                arrow.push(self.advance().unwrap());
            } else {
                break;
            }
        }
        arrow
    }

    fn read_label_content(&mut self, close_char: char) -> String {
        let mut label = String::new();
        while let Some(&c) = self.peek() {
            if c == close_char {
                break;
            }
            label.push(self.advance().unwrap());
        }
        label.trim().to_string()
    }
}

impl<'a> Iterator for Lexer<'a> {
    type Item = Token;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }

        let line = self.line;
        let column = self.column;

        match self.state {
            LexerState::InLabel(close_char) => match self.peek() {
                None => {
                    self.state = LexerState::Normal;
                    self.done = true;
                    return Some(Token {
                        ty: TokenType::Eof,
                        value: String::new(),
                        line,
                        column,
                    });
                }
                Some(&c) if c == close_char => {
                    self.advance();
                    self.state = LexerState::Normal;
                    return Some(Token {
                        ty: TokenType::BracketClose,
                        value: c.to_string(),
                        line,
                        column,
                    });
                }
                Some(_) => {
                    let label = self.read_label_content(close_char);
                    return Some(Token {
                        ty: TokenType::Label,
                        value: label,
                        line,
                        column,
                    });
                }
            },
            LexerState::Normal => {
                self.skip_whitespace();

                let line = self.line;
                let column = self.column;

                match self.peek() {
                    None => {
                        self.done = true;
                        Some(Token {
                            ty: TokenType::Eof,
                            value: String::new(),
                            line,
                            column,
                        })
                    }
                    Some(&'\n') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Newline,
                            value: "\n".to_string(),
                            line,
                            column,
                        })
                    }
                    Some(&c) if c == '[' => {
                        self.advance();
                        self.state = LexerState::InLabel(']');
                        Some(Token {
                            ty: TokenType::BracketOpen,
                            value: c.to_string(),
                            line,
                            column,
                        })
                    }
                    Some(&c) if c == '(' => {
                        self.advance();
                        self.state = LexerState::InLabel(')');
                        Some(Token {
                            ty: TokenType::BracketOpen,
                            value: c.to_string(),
                            line,
                            column,
                        })
                    }
                    Some(&c) if c == ']' || c == ')' => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::BracketClose,
                            value: c.to_string(),
                            line,
                            column,
                        })
                    }
                    Some(&'-') | Some(&'=') | Some(&'~') => {
                        let arrow = self.read_arrow();
                        let ty = if arrow.len() >= 2 {
                            TokenType::Arrow
                        } else {
                            TokenType::Unknown
                        };
                        Some(Token {
                            ty,
                            value: arrow,
                            line,
                            column,
                        })
                    }
                    Some(&c) if c.is_alphanumeric() || c == '_' => {
                        let word = self.read_word();
                        let ty = match word.as_str() {
                            "graph" | "flowchart" | "subgraph" => TokenType::Keyword,
                            "TD" | "TB" | "BT" | "LR" | "RL" => TokenType::Direction,
                            _ => TokenType::NodeId,
                        };
                        Some(Token {
                            ty,
                            value: word,
                            line,
                            column,
                        })
                    }
                    Some(_) => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Unknown,
                            value: String::new(),
                            line,
                            column,
                        })
                    }
                }
            }
        }
    }
}
