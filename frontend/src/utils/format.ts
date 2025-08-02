// Number formatting utilities
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (
  number: number,
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions
): string => {
  return new Intl.NumberFormat(locale, options).format(number);
};

export const formatPercentage = (
  value: number,
  locale: string = 'en-US',
  decimals: number = 1
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

export const formatCompactNumber = (
  number: number,
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(number);
};

// Date formatting utilities
export const formatDate = (
  date: string | Date,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
};

export const formatDateTime = (
  date: string | Date,
  locale: string = 'en-US'
): string => {
  return formatDate(date, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (
  date: string | Date,
  locale: string = 'en-US'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
};

// String formatting utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Utility functions for business logic
export const calculateProfitMargin = (revenue: number, cost: number): number => {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
};

export const calculateROI = (profit: number, investment: number): number => {
  if (investment === 0) return 0;
  return (profit / investment) * 100;
};

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    active: 'green',
    inactive: 'gray',
    pending: 'yellow',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    low_stock: 'orange',
    out_of_stock: 'red',
    in_stock: 'green',
  };
  
  return statusColors[status.toLowerCase()] || 'gray';
};

export const getBadgeVariant = (status: string): string => {
  const variants: Record<string, string> = {
    active: 'success',
    inactive: 'secondary',
    pending: 'warning',
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
    low_stock: 'warning',
    out_of_stock: 'error',
    in_stock: 'success',
  };
  
  return variants[status.toLowerCase()] || 'secondary';
};