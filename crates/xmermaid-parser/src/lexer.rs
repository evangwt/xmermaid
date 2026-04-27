use crate::token::{Token, TokenType};
use std::iter::Peekable;
use std::str::Chars;

#[derive(Debug, Clone, PartialEq)]
enum LexerState {
    Normal,
    InLabel(char), // close char: ']', ')', '}'
}

pub struct Lexer<'a> {
    input: Peekable<Chars<'a>>,
    line: usize,
    state: LexerState,
    done: bool,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input: input.chars().peekable(),
            line: 1,
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

    fn skip_comment(&mut self) {
        // Already consumed first %, skip until newline or EOF
        while let Some(&c) = self.peek() {
            self.advance();
            if c == '\n' {
                break;
            }
        }
    }
}

impl<'a> Iterator for Lexer<'a> {
    type Item = Token;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }

        let line = self.line;

        match self.state {
            LexerState::InLabel(close_char) => match self.peek() {
                None => {
                    self.state = LexerState::Normal;
                    self.done = true;
                    return Some(Token {
                        ty: TokenType::Eof,
                        value: String::new(),
                        line,
                    });
                }
                Some(&c) if c == close_char => {
                    self.advance();
                    self.state = LexerState::Normal;
                    let ty = match close_char {
                        ']' => TokenType::BracketClose,
                        ')' => TokenType::ParenClose,
                        '}' => TokenType::BraceClose,
                        _ => TokenType::BracketClose,
                    };
                    return Some(Token {
                        ty,
                        value: c.to_string(),
                        line,
                    });
                }
                Some(_) => {
                    let label = self.read_label_content(close_char);
                    return Some(Token {
                        ty: TokenType::Label,
                        value: label,
                        line,
                    });
                }
            },
            LexerState::Normal => {
                self.skip_whitespace();

                let line = self.line;

                match self.peek() {
                    None => {
                        self.done = true;
                        Some(Token {
                            ty: TokenType::Eof,
                            value: String::new(),
                            line,
                        })
                    }
                    Some(&'\n') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Newline,
                            value: "\n".to_string(),
                            line,
                        })
                    }
                    // Comments: %%
                    Some(&'%') => {
                        self.advance();
                        if let Some(&'%') = self.peek() {
                            self.advance();
                            self.skip_comment();
                            // Return newline so parser sees statement boundary
                            Some(Token {
                                ty: TokenType::Newline,
                                value: "\n".to_string(),
                                line,
                            })
                        } else {
                            Some(Token {
                                ty: TokenType::Unknown,
                                value: "%".to_string(),
                                line,
                            })
                        }
                    }
                    // Semicolons
                    Some(&';') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Semicolon,
                            value: ";".to_string(),
                            line,
                        })
                    }
                    // Pipe for edge labels
                    Some(&'|') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Pipe,
                            value: "|".to_string(),
                            line,
                        })
                    }
                    // Ampersand for node chaining
                    Some(&'&') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Ampersand,
                            value: "&".to_string(),
                            line,
                        })
                    }
                    // Slash for parallelogram [/.../]
                    Some(&'/') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Slash,
                            value: "/".to_string(),
                            line,
                        })
                    }
                    // Backslash for trapezoid [\...\]
                    Some(&'\\') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Backslash,
                            value: "\\".to_string(),
                            line,
                        })
                    }
                    // Square brackets [ — enters InLabel state
                    Some(&'[') => {
                        self.advance();
                        self.state = LexerState::InLabel(']');
                        Some(Token {
                            ty: TokenType::BracketOpen,
                            value: "[".to_string(),
                            line,
                        })
                    }
                    Some(&']') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::BracketClose,
                            value: "]".to_string(),
                            line,
                        })
                    }
                    // Parentheses ( — enters InLabel state
                    Some(&'(') => {
                        self.advance();
                        self.state = LexerState::InLabel(')');
                        Some(Token {
                            ty: TokenType::ParenOpen,
                            value: "(".to_string(),
                            line,
                        })
                    }
                    Some(&')') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::ParenClose,
                            value: ")".to_string(),
                            line,
                        })
                    }
                    // Curly braces { — enters InLabel state for diamond shapes
                    Some(&'{') => {
                        self.advance();
                        self.state = LexerState::InLabel('}');
                        Some(Token {
                            ty: TokenType::BraceOpen,
                            value: "{".to_string(),
                            line,
                        })
                    }
                    Some(&'}') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::BraceClose,
                            value: "}".to_string(),
                            line,
                        })
                    }
                    // Angle brackets for asymmetric shape >...]
                    Some(&'<') => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::AngleOpen,
                            value: "<".to_string(),
                            line,
                        })
                    }
                    Some(&'>') => {
                        // Could be part of arrow; if not, it's AngleClose
                        // But > is always consumed by read_arrow when preceded by -
                        // Standalone > for asymmetric shape: enters InLabel(']')
                        // similar to how [ enters InLabel(']')
                        self.advance();
                        self.state = LexerState::InLabel(']');
                        Some(Token {
                            ty: TokenType::AngleClose,
                            value: ">".to_string(),
                            line,
                        })
                    }
                    // Arrows: starts with -, =, ~, or .
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
                        })
                    }
                    Some(&'.') => {
                        // Could be start of dotted arrow -.-> or just a dot
                        if let Some(&'-') = self.input.peek() {
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
                            })
                        } else {
                            self.advance();
                            Some(Token {
                                ty: TokenType::Unknown,
                                value: ".".to_string(),
                                line,
                            })
                        }
                    }
                    // Words: keywords, directions, node IDs
                    Some(&c) if c.is_alphanumeric() || c == '_' => {
                        let word = self.read_word();
                        let ty = match word.as_str() {
                            "graph" | "flowchart" | "subgraph" | "end"
                            | "classDef" | "class" | "style" | "click"
                            | "direction" => TokenType::Keyword,
                            "TD" | "TB" | "BT" | "LR" | "RL" => TokenType::Direction,
                            _ => TokenType::NodeId,
                        };
                        Some(Token {
                            ty,
                            value: word,
                            line,
                        })
                    }
                    Some(_) => {
                        self.advance();
                        Some(Token {
                            ty: TokenType::Unknown,
                            value: String::new(),
                            line,
                        })
                    }
                }
            }
        }
    }
}
