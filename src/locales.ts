import * as en from 'apexcharts/dist/locales/en.json';

export function getLocales(): Record<string, unknown> {
  return {
    en: en,
  };
}

export function getDefaultLocale(): unknown {
  return en;
}
