use xmermaid_parser::lexer::Lexer;
use xmermaid_parser::{Token, TokenType};

#[test]
fn test_lexer_identifies_keywords() {
    let input = "graph TD";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens.len(), 3);
    assert_eq!(tokens[0].ty, TokenType::Keyword);
    assert_eq!(tokens[0].value, "graph");
    assert_eq!(tokens[1].ty, TokenType::Direction);
    assert_eq!(tokens[1].value, "TD");
    assert_eq!(tokens[2].ty, TokenType::Eof);
}

#[test]
fn test_lexer_identifies_node_ids() {
    let input = "A B1 node2";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens.len(), 4);
    assert_eq!(tokens[0].ty, TokenType::NodeId);
    assert_eq!(tokens[0].value, "A");
    assert_eq!(tokens[1].ty, TokenType::NodeId);
    assert_eq!(tokens[1].value, "B1");
    assert_eq!(tokens[2].ty, TokenType::NodeId);
    assert_eq!(tokens[2].value, "node2");
}

#[test]
fn test_lexer_identifies_arrows() {
    let input = "A-->B A---C A-.-D A==>E";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens[1].ty, TokenType::Arrow);
    assert_eq!(tokens[1].value, "-->");
    assert_eq!(tokens[4].ty, TokenType::Arrow);
    assert_eq!(tokens[4].value, "---");
    assert_eq!(tokens[7].ty, TokenType::Arrow);
    assert_eq!(tokens[7].value, "-.-");
    assert_eq!(tokens[10].ty, TokenType::Arrow);
    assert_eq!(tokens[10].value, "==>");
}

#[test]
fn test_lexer_handles_labels() {
    let input = "A[Label Text] B(Another)";
    let lexer = Lexer::new(input);
    let tokens: Vec<Token> = lexer.collect();

    assert_eq!(tokens[1].ty, TokenType::BracketOpen);
    assert_eq!(tokens[2].ty, TokenType::Label);
    assert_eq!(tokens[2].value, "Label Text");
    assert_eq!(tokens[3].ty, TokenType::BracketClose);
}
