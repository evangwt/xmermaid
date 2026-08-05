#[derive(Debug, Clone, PartialEq)]
pub enum TokenType {
    // Keywords
    Keyword,     // graph, flowchart, subgraph, end, classDef, class, style, click
    Direction,   // TD, TB, BT, LR, RL

    // Identifiers
    NodeId,      // alphanumeric identifiers (A, Node1, my_node)

    // Arrows / edges
    Arrow,       // -->, ---, -.->, -.-, ===>, ~~~, --text-->, etc.

    // Brackets for node shapes
    BracketOpen,   // [
    BracketClose,  // ]
    ParenOpen,     // (
    ParenClose,    // )
    BraceOpen,     // {
    BraceClose,    // }
    AngleOpen,     // <
    AngleClose,    // >

    // Label text inside brackets
    Label,       // text inside [...], (...), {...}, etc.
    UnterminatedLabel,

    // Edge label
    Pipe,        // | used for edge labels: -->|text|-->

    // Punctuation
    Semicolon,   // ;
    Colon,       // : used by safe class style properties
    Comma,       // , used by class style property and node lists
    Hash,        // # used by hexadecimal class colors
    Slash,       // / for parallelogram [/.../]
    Backslash,   // \ for trapezoid [\...\]

    // Special
    Ampersand,   // & for node chaining
    Unknown,     // unrecognized character
    Newline,
    Eof,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub ty: TokenType,
    pub value: String,
    pub line: usize,
}
