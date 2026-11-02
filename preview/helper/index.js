function setBaseFontSize(level) {
  let size;
  switch (level) {
    case '500': {
      size = '1.175em';
      break;
    }
    case '400': {
      size = '1.1em';
      break;
    }
    case '300': {
      size = '1.025em';
      break;
    }
    case '200': {
      size = '.95em';
      break;
    }
    default: {
      size = '.875em';
      break;
    }
  }
  return size;
}

// Store the same types as the old <input>: fontSize/logoSize are strings.
export function toConfigValue(name, raw) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (name === 'fontSize' || name === 'logoSize') return String(v);
  return v;
}

// ToggleGroup gives string[]; empty means "no change".
export function firstOrNull(groupValue) {
  return Array.isArray(groupValue) && groupValue.length ? groupValue[0] : null;
}

export { setBaseFontSize };
