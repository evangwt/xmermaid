use xmermaid_parser::lexer::{Lexer, Token, TokenType};

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
    assert_eq!(tokens.len(), 4); // 3 newlines + EOF
    for i in 0..3 {
        assert_eq!(tokens[i].ty, TokenType::Newline);
    }
    assert_eq!(tokens[3].ty, TokenType::Eof);
}

// ─── Line & column tracking ───────────────────────────────────────

#[test]
fn test_lexer_line_tracking() {
    let input = "graph\nTD";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    // "graph" on line 1, newline, "TD" on line 2
    assert_eq!(tokens[0].line, 1);
    assert_eq!(tokens[0].value, "graph");
    assert_eq!(tokens[1].line, 1);
    assert_eq!(tokens[1].ty, TokenType::Newline);
    assert_eq!(tokens[2].line, 2);
    assert_eq!(tokens[2].value, "TD");
}

#[test]
fn test_lexer_column_tracking() {
    let input = "A B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].column, 1); // A at column 1
    assert_eq!(tokens[1].column, 3); // B at column 3
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
    assert_eq!(tokens[1].value, "[");
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Hello World");
    assert_eq!(tokens[3].ty, TokenType::BracketClose);
}

#[test]
fn test_lexer_round_bracket_label() {
    let input = "A(Hello)";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    assert_eq!(tokens[1].value, "(");
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Hello");
    assert_eq!(tokens[3].ty, TokenType::BracketClose);
}

#[test]
fn test_lexer_empty_label() {
    let input = "A[]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    // Empty label: BracketOpen followed immediately by BracketClose
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
fn test_lexer_unclosed_label_produces_eof() {
    let input = "A[unclosed";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    // Should produce: NodeId, BracketOpen, Label, Eof (no BracketClose)
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[3].ty, TokenType::Eof);
}

// ─── Unknown tokens ──────────────────────────────────────────────

#[test]
fn test_lexer_unknown_characters() {
    let input = "@#$%^&";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    // All should be Unknown, then Eof
    for t in &tokens[..tokens.len() - 1] {
        assert_eq!(t.ty, TokenType::Unknown);
    }
}

#[test]
fn test_lexer_curly_braces_are_unknown() {
    let input = "{diamond}";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    // { is Unknown, "diamond" is NodeId, } is Unknown
    assert_eq!(tokens[0].ty, TokenType::Unknown);
    assert_eq!(tokens[1].ty, TokenType::NodeId);
    assert_eq!(tokens[2].ty, TokenType::Unknown);
}

#[test]
fn test_lexer_pipe_is_unknown() {
    let input = "|label|";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::Unknown);
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
    // Hyphens are arrow characters, not part of node IDs
    let input = "A-B";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[0].value, "A");
    // "-" alone is Unknown (length < 2)
    assert_eq!(tokens[1].ty, TokenType::Unknown);
    assert_eq!(tokens[2].ty, TokenType::NodeId);
}

// ─── Complex token sequences ─────────────────────────────────────

#[test]
fn test_lexer_full_flowchart_line() {
    let input = "graph TD\n  A[Start]-->B[End]";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens[0].ty, TokenType::Keyword);    // graph
    assert_eq!(tokens[1].ty, TokenType::Direction);   // TD
    assert_eq!(tokens[2].ty, TokenType::Newline);     // \n
    assert_eq!(tokens[3].ty, TokenType::NodeId);      // A
    assert_eq!(tokens[4].ty, TokenType::BracketOpen); // [
    assert_eq!(tokens[5].ty, TokenType::Label);       // Start
    assert_eq!(tokens[6].ty, TokenType::BracketClose);// ]
    assert_eq!(tokens[7].ty, TokenType::Arrow);       // -->
    assert_eq!(tokens[8].ty, TokenType::NodeId);      // B
    assert_eq!(tokens[9].ty, TokenType::BracketOpen); // [
    assert_eq!(tokens[10].ty, TokenType::Label);      // End
    assert_eq!(tokens[11].ty, TokenType::BracketClose);// ]
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
