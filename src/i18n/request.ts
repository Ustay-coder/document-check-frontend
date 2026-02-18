import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "ko" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    timeZone: "Asia/Seoul",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
