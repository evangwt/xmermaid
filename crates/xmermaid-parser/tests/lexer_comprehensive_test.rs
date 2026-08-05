use xmermaid_parser::lexer::Lexer;
use xmermaid_parser::{Token, TokenType};

// ─── Empty & whitespace ───────────────────────────────────────────

#[test]
fn test_lexer_empty_input() {
    let lexer = Lexer::new("");
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens[0].ty, TokenType::Eof);
}

#[test]
fn test_lexer_whitespace_only() {
    let lexer = Lexer::new("   \t  ");
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens[0].ty, TokenType::Eof);
}

#[test]
fn test_lexer_newlines_only() {
    let lexer = Lexer::new("\n\n\n");
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens.len(), 4);
    for i in 0..3 {
        assert_eq!(tokens[i].ty, TokenType::Newline);
    }
    assert_eq!(tokens[3].ty, TokenType::Eof);
}

// ─── Line tracking ────────────────────────────────────────────────

#[test]
fn test_lexer_line_tracking() {
    let input = "graph\nTD";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].line, 1);
    assert_eq!(tokens[0].value, "graph");
    assert_eq!(tokens[1].line, 1);
    assert_eq!(tokens[1].ty, TokenType::Newline);
    assert_eq!(tokens[2].line, 2);
    assert_eq!(tokens[2].value, "TD");
}

// ─── Keywords ─────────────────────────────────────────────────────

#[test]
fn test_lexer_flowchart_keyword() {
    let input = "flowchart TD";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Keyword);
    assert_eq!(tokens[0].value, "flowchart");
}

#[test]
fn test_lexer_subgraph_keyword() {
    let input = "subgraph";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Keyword);
    assert_eq!(tokens[0].value, "subgraph");
}

#[test]
fn test_lexer_end_keyword() {
    let input = "end";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Keyword);
    assert_eq!(tokens[0].value, "end");
}

#[test]
fn test_lexer_style_keywords() {
    for kw in &["classDef", "class", "style", "click"] {
        let lexer = Lexer::new(kw);
        let tokens: Vec<Token> = lexer.collect();
        assert_eq!(tokens[0].ty, TokenType::Keyword, "Failed for {}", kw);
    }
}

#[test]
fn test_lexer_preserves_class_style_punctuation_and_carriage_return_boundaries() {
    let tokens: Vec<Token> =
        Lexer::new("classDef hot fill:#f00,stroke:#900\rclass A hot").collect();
    let kinds = tokens
        .iter()
        .map(|token| token.ty.clone())
        .collect::<Vec<_>>();

    assert_eq!(
        kinds,
        vec![
            TokenType::Keyword,
            TokenType::NodeId,
            TokenType::NodeId,
            TokenType::Colon,
            TokenType::Hash,
            TokenType::NodeId,
            TokenType::Comma,
            TokenType::NodeId,
            TokenType::Colon,
            TokenType::Hash,
            TokenType::NodeId,
            TokenType::Newline,
            TokenType::Keyword,
            TokenType::NodeId,
            TokenType::NodeId,
            TokenType::Eof,
        ]
    );
    assert_eq!(tokens[11].line, 1);
    assert_eq!(tokens[12].line, 2);
}

// ─── All directions ──────────────────────────────────────────────

#[test]
fn test_lexer_all_directions() {
    for dir in &["TD", "TB", "BT", "LR", "RL"] {
        let lexer = Lexer::new(dir);
        let tokens: Vec<Token> = lexer.collect();
        assert_eq!(tokens[0].ty, TokenType::Direction, "Failed for {}", dir);
        assert_eq!(tokens[0].value, *dir);
    }
}

// ─── Arrow variants ──────────────────────────────────────────────

#[test]
fn test_lexer_arrow_dotted_with_arrow() {
    let input = "A-.->B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "-.->");
}

#[test]
fn test_lexer_arrow_thick() {
    let input = "A==>B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "==>");
}

#[test]
fn test_lexer_arrow_invisible() {
    let input = "A~~~B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "~~~");
}

#[test]
fn test_lexer_arrow_line() {
    let input = "A---B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "---");
}

#[test]
fn test_lexer_single_dash_is_unknown() {
    let input = "-";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Unknown);
}

// ─── Label state machine ─────────────────────────────────────────

#[test]
fn test_lexer_square_bracket_label() {
    let input = "A[Hello World]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Hello World");
    assert_eq!(tokens[3].ty, TokenType::BracketClose);
}

#[test]
fn test_lexer_round_bracket_label() {
    let input = "A(Hello)";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::ParenOpen);
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Hello");
    assert_eq!(tokens[3].ty, TokenType::ParenClose);
}

#[test]
fn test_lexer_curly_brace_label() {
    let input = "A{Decision}";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::BraceOpen);
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Decision");
    assert_eq!(tokens[3].ty, TokenType::BraceClose);
}

#[test]
fn test_lexer_empty_label() {
    let input = "A[]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    assert_eq!(tokens[2].ty, TokenType::BracketClose);
}

#[test]
fn test_lexer_label_with_special_chars() {
    let input = "A[foo: bar=baz]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "foo: bar=baz");
}

#[test]
fn test_lexer_marks_unclosed_labels_before_eof() {
    for (input, expected_closer) in [
        ("A[unclosed", "]"),
        ("A(unclosed", ")"),
        ("A{unclosed", "}"),
        ("A>unclosed", "]"),
        ("|unclosed", "|"),
    ] {
        let tokens: Vec<Token> = Lexer::new(input).collect();
        assert_eq!(tokens[tokens.len() - 2].ty, TokenType::UnterminatedLabel);
        assert_eq!(tokens[tokens.len() - 2].value, expected_closer);
        assert_eq!(tokens.last().unwrap().ty, TokenType::Eof);
    }
}

// ─── New token types ──────────────────────────────────────────────

#[test]
fn test_lexer_pipe_token() {
    let input = "|label|";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Pipe);
    assert_eq!(tokens[1].ty, TokenType::Label);
    assert_eq!(tokens[1].value, "label");
    assert_eq!(tokens[2].ty, TokenType::Pipe);
}

#[test]
fn test_lexer_ampersand_token() {
    let input = "A & B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[1].ty, TokenType::Ampersand);
    assert_eq!(tokens[2].ty, TokenType::NodeId);
}

#[test]
fn test_lexer_semicolon_token() {
    let input = ";";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Semicolon);
}

#[test]
fn test_lexer_slash_token() {
    let input = "/";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Slash);
}

#[test]
fn test_lexer_comment() {
    let input = "graph TD\n%% this is a comment\nA-->B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    // Comment should produce a Newline token
    assert_eq!(tokens[0].ty, TokenType::Keyword); // graph
    assert_eq!(tokens[1].ty, TokenType::Direction); // TD
    assert_eq!(tokens[2].ty, TokenType::Newline); // after TD
    assert_eq!(tokens[3].ty, TokenType::Newline); // comment replaced with newline
}

// ─── Node ID variants ────────────────────────────────────────────

#[test]
fn test_lexer_node_id_with_underscore() {
    let input = "my_node";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[0].value, "my_node");
}

#[test]
fn test_lexer_node_id_with_numbers() {
    let input = "Node123";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[0].value, "Node123");
}

#[test]
fn test_lexer_hyphen_not_in_node_id() {
    let input = "A-B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[0].value, "A");
    assert_eq!(tokens[1].ty, TokenType::Unknown);
    assert_eq!(tokens[2].ty, TokenType::NodeId);
}

// ─── Complex token sequences ─────────────────────────────────────

#[test]
fn test_lexer_full_flowchart_line() {
    let input = "graph TD\n  A[Start]-->B[End]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens[0].ty, TokenType::Keyword);
    assert_eq!(tokens[1].ty, TokenType::Direction);
    assert_eq!(tokens[2].ty, TokenType::Newline);
    assert_eq!(tokens[3].ty, TokenType::NodeId);
    assert_eq!(tokens[4].ty, TokenType::BracketOpen);
    assert_eq!(tokens[5].ty, TokenType::Label);
    assert_eq!(tokens[6].ty, TokenType::BracketClose);
    assert_eq!(tokens[7].ty, TokenType::Arrow);
    assert_eq!(tokens[8].ty, TokenType::NodeId);
    assert_eq!(tokens[9].ty, TokenType::BracketOpen);
    assert_eq!(tokens[10].ty, TokenType::Label);
    assert_eq!(tokens[11].ty, TokenType::BracketClose);
    assert_eq!(tokens[12].ty, TokenType::Eof);
}

#[test]
fn test_lexer_multiple_arrows_same_line() {
    let input = "A-->B-->C";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "-->");
    assert_eq!(tokens[3].ty, TokenType::Arrow);
    assert_eq!(tokens[3].value, "-->");
}
