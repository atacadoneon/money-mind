// i18n stub — structure ready for next-intl integration when package is installed
// Default locale: pt-BR, partial en-US available
// Switch UI: not implemented (structure only as per spec)

export { ptBR } from "./pt-BR";
export { enUS } from "./en-US";
export type { Messages } from "./pt-BR";

export const defaultLocale = "pt-BR";
export const supportedLocales = ["pt-BR", "en-US"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
