const names = new Intl.DisplayNames(["zh-CN"], { type: "region" });
export const countryName = (code?: string) =>
  code ? names.of(code) || code : "未识别";
