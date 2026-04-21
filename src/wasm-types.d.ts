declare module '../pkg/xmermaid_wasm.js' {
  export function parse_dsl(input: string): string;
  export function get_diagram_type(astJson: string): string;
  export function compute_layout(astJson: string): string;
  export function render_pipeline(input: string): string;
  export default function init(): Promise<void>;
}
