export const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const inferLocaleFromTimezone = (timezone: string) => {
  switch (timezone) {
    case 'Asia/Shanghai':
      return 'zh';
    default:
      return 'en';
  }
};

export const userLocale = inferLocaleFromTimezone(userTimezone);
