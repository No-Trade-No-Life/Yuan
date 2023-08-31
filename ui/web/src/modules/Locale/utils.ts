export const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const inferLocaleFromTimezone = (timezone: string) => {
  switch (timezone) {
    case 'Asia/Shanghai':
      return 'cn';
    default:
      return 'en';
  }
};

export const userLocale = inferLocaleFromTimezone(userTimezone);
