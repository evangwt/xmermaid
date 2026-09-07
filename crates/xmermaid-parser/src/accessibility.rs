//! Central handling of Mermaid accessibility directives.
//!
//! `accTitle:` / `accDescr:` statements, `accDescr { ... }` blocks, and
//! `---` frontmatter blocks are metadata: they never change the rendered
//! geometry. Every diagram family therefore shares one preprocessing pass
//! that strips them from the input and captures the accessible name and
//! description for the renderer.

use std::cell::RefCell;

#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct AccessibilityMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

thread_local! {
    static LAST_METADATA: RefCell<Option<AccessibilityMetadata>> = const { RefCell::new(None) };
}

/// Extract and strip accessibility metadata from `input`.
///
/// Returns the input with metadata lines removed, ready for the
/// diagram-specific parsers. The captured metadata stays available until the
/// next call via [`take_accessibility_metadata`].
pub fn strip_accessibility(input: &str) -> String {
    let mut metadata = AccessibilityMetadata::default();
    let mut output = String::with_capacity(input.len());
    let mut in_frontmatter = false;
    let mut frontmatter_closed = false;
    let mut in_description_block = false;
    // Front matter is only recognized before the first meaningful line, so a
    // `---` divider inside a diagram body passes through untouched instead of
    // silently swallowing the rest of the source.
    let mut seen_content = false;

    for line in input.lines() {
        let trimmed = line.trim();

        // Leading `---` frontmatter block (Mermaid 10.5+ metadata header).
        if !frontmatter_closed {
            if trimmed == "---" {
                if in_frontmatter {
                    in_frontmatter = false;
                    frontmatter_closed = true;
                } else if seen_content {
                    output.push_str(line);
                    output.push('\n');
                    continue;
                } else {
                    in_frontmatter = true;
                }
                output.push('\n');
                continue;
            }
            if in_frontmatter {
                if let Some(value) = trimmed.strip_prefix("title:") {
                    metadata.title = Some(unquote(value.trim()));
                }
                // Config keys inside frontmatter stay consumed; visual output
                // is theme-driven and remains controlled by the host theme.
                output.push('\n');
                continue;
            }
        }

        if in_description_block {
            if trimmed == "}" {
                in_description_block = false;
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("accTitle:") {
            metadata.title = Some(unquote(value.trim()));
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix("accDescr:") {
            let value = rest.trim();
            if value == "{" {
                in_description_block = true;
            } else {
                metadata.description = Some(unquote(value));
            }
            continue;
        }
        if trimmed == "accDescr {" {
            in_description_block = true;
            continue;
        }

        if !trimmed.is_empty() && !trimmed.starts_with("%%") {
            seen_content = true;
        }
        output.push_str(line);
        output.push('\n');
    }

    // Preserve a trailing newline structure similar to the original input.
    if !input.ends_with('\n') && output.ends_with('\n') {
        output.truncate(output.len() - 1);
    }

    LAST_METADATA.with(|slot| *slot.borrow_mut() = Some(metadata));
    output
}

/// Consume the metadata captured by the most recent [`strip_accessibility`].
pub fn take_accessibility_metadata() -> Option<AccessibilityMetadata> {
    LAST_METADATA.with(|slot| slot.borrow_mut().take())
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    let value = value
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
        .unwrap_or(value);
    value.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_acc_directives_and_captures_metadata() {
        let input = "pie\n  accTitle: My chart\n  accDescr: Shares by team\n  \"A\" : 1\n";
        let stripped = strip_accessibility(input);
        assert_eq!(stripped, "pie\n  \"A\" : 1\n");
        let metadata = take_accessibility_metadata().unwrap();
        assert_eq!(metadata.title.as_deref(), Some("My chart"));
        assert_eq!(metadata.description.as_deref(), Some("Shares by team"));
    }

    #[test]
    fn strips_frontmatter_block() {
        let input = "---\ntitle: T\nconfig:\n  theme: dark\n---\nflowchart TD\n  A-->B\n";
        let stripped = strip_accessibility(input);
        assert!(stripped.contains("flowchart TD"));
        assert!(!stripped.contains("theme: dark"));
        let metadata = take_accessibility_metadata().unwrap();
        assert_eq!(metadata.title.as_deref(), Some("T"));
    }

    #[test]
    fn supports_multiline_description_blocks() {
        let input = "kanban\naccDescr {\n  first line\n  second line\n}\nTodo[Backlog]\n";
        let stripped = strip_accessibility(input);
        assert!(stripped.contains("Todo[Backlog]"));
        assert!(!stripped.contains("second line"));
    }
}
