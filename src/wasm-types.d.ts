declare module '../pkg/xmermaid_wasm.js' {
  export function parse_dsl(input: string): string;
  export function get_diagram_type(astJson: string): string;
  export function compute_layout(astJson: string): string;
  export function render(input: string): any;
  export function render_with_config(input: string, config_json: string | undefined): any;
  export function default_config(): string;

  const init: () => Promise<void>;
  export default init;
}
