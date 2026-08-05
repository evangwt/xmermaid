import { icons as fontAwesomeIcons } from '@iconify-json/fa';

type FontAwesomeIcon = {
  body: string;
  width?: number;
  height?: number;
};

const LEGACY_ALIASES: Record<string, string> = {
  car: 'automobile',
};
const TOKEN_PATTERN = /\bfa:fa-([A-Za-z0-9-]+)\b/;

export interface FontAwesomeLabel {
  name: string;
  icon: FontAwesomeIcon;
  text: string;
}

export function getFontAwesomeIcon(name: string): FontAwesomeIcon | undefined {
  return fontAwesomeIcons.icons[LEGACY_ALIASES[name] ?? name] as FontAwesomeIcon | undefined;
}

export function parseFontAwesomeLabel(label: string): FontAwesomeLabel | undefined {
  const match = TOKEN_PATTERN.exec(label);
  if (!match) return undefined;

  const name = match[1]!;
  const icon = getFontAwesomeIcon(name);
  if (!icon) return undefined;

  return {
    name,
    icon,
    text: `${label.slice(0, match.index)}${label.slice(match.index + match[0].length)}`.trim(),
  };
}
