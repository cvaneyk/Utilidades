// Pure Cron expression parser, validator, Spanish describer, visual builder helper, and next-runs calculator.

export const MONTH_NAMES_EN = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const MONTH_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const DOW_NAMES_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const DOW_NAMES_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];

export const DOW_PLURAL_ES = [
  "domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados",
];

export const DOW_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const CRON_ALIASES = {
  "@yearly": { five: "0 0 1 1 *", six: "0 0 0 1 1 *", description: "Una vez al año (1 de enero a las 00:00)" },
  "@annually": { five: "0 0 1 1 *", six: "0 0 0 1 1 *", description: "Una vez al año (1 de enero a las 00:00)" },
  "@monthly": { five: "0 0 1 * *", six: "0 0 0 1 * *", description: "Una vez al mes (día 1 a las 00:00)" },
  "@weekly": { five: "0 0 * * 0", six: "0 0 0 * * 0", description: "Una vez a la semana (domingo a las 00:00)" },
  "@daily": { five: "0 0 * * *", six: "0 0 0 * * *", description: "Una vez al día a medianoche (00:00)" },
  "@midnight": { five: "0 0 * * *", six: "0 0 0 * * *", description: "Una vez al día a medianoche (00:00)" },
  "@hourly": { five: "0 * * * *", six: "0 0 * * * *", description: "Una vez cada hora en punto" },
  "@reboot": { five: null, six: null, description: "Una vez al iniciar el sistema (sin fechas programadas fijas)" },
};

export const FIELD_DEFS = {
  second: {
    key: "second",
    label: "Segundo",
    shortLabel: "Seg",
    min: 0,
    max: 59,
    maxStep: 59,
    rangeText: "0–59",
    unitSingular: "segundo",
    unitPlural: "segundos",
  },
  minute: {
    key: "minute",
    label: "Minuto",
    shortLabel: "Min",
    min: 0,
    max: 59,
    maxStep: 59,
    rangeText: "0–59",
    unitSingular: "minuto",
    unitPlural: "minutos",
  },
  hour: {
    key: "hour",
    label: "Hora",
    shortLabel: "Hora",
    min: 0,
    max: 23,
    maxStep: 23,
    rangeText: "0–23",
    unitSingular: "hora",
    unitPlural: "horas",
  },
  dayOfMonth: {
    key: "dayOfMonth",
    label: "Día (mes)",
    shortLabel: "Día mes",
    min: 1,
    max: 31,
    maxStep: 31,
    rangeText: "1–31",
    unitSingular: "día",
    unitPlural: "días",
  },
  month: {
    key: "month",
    label: "Mes",
    shortLabel: "Mes",
    min: 1,
    max: 12,
    maxStep: 12,
    rangeText: "1–12 / JAN–DEC",
    names: MONTH_NAMES_EN,
    nameOffset: 1,
    unitSingular: "mes",
    unitPlural: "meses",
  },
  dayOfWeek: {
    key: "dayOfWeek",
    label: "Día (semana)",
    shortLabel: "Día sem",
    min: 0,
    max: 7,
    maxStep: 7,
    rangeText: "0–6 / SUN–SAT",
    names: DOW_NAMES_EN,
    nameOffset: 0,
    isDow: true,
    unitSingular: "día de la semana",
    unitPlural: "días de la semana",
  },
};

export function getFieldOrder(includeSeconds = false) {
  return includeSeconds
    ? ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"]
    : ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];
}

export const CRON_EXAMPLES_5 = [
  {
    label: "Cada minuto",
    expression: "* * * * *",
    category: "Frecuentes",
    note: "Ejecución continua cada 60 segundos",
  },
  {
    label: "Cada 5 minutos",
    expression: "*/5 * * * *",
    category: "Frecuentes",
    note: "Monitoreo y health checks",
  },
  {
    label: "Cada 15 minutos",
    expression: "*/15 * * * *",
    category: "Frecuentes",
    note: "Sincronización de cachés o colas",
  },
  {
    label: "Cada hora en punto",
    expression: "0 * * * *",
    category: "Frecuentes",
    note: "Minuto 0 de cada hora",
  },
  {
    label: "Cada 6 horas",
    expression: "0 */6 * * *",
    category: "Frecuentes",
    note: "00:00, 06:00, 12:00 y 18:00",
  },
  {
    label: "Diario a medianoche",
    expression: "0 0 * * *",
    category: "Diarios",
    note: "Backups y limpieza nocturna",
  },
  {
    label: "Diario a las 09:00",
    expression: "0 9 * * *",
    category: "Diarios",
    note: "Envío de resumen matutino",
  },
  {
    label: "Lunes a viernes a las 09:00",
    expression: "0 9 * * 1-5",
    category: "Laborales",
    note: "Solo días laborables",
  },
  {
    label: "Cada 30 min en horario laboral",
    expression: "*/30 9-17 * * 1-5",
    category: "Laborales",
    note: "De 09:00 a 17:30, lun–vie",
  },
  {
    label: "Fines de semana a las 10:00",
    expression: "0 10 * * 0,6",
    category: "Semanales",
    note: "Sábados y domingos",
  },
  {
    label: "Cada lunes a las 08:00",
    expression: "0 8 * * MON",
    category: "Semanales",
    note: "Reportes semanales (con nombre de día)",
  },
  {
    label: "Día 1 de cada mes",
    expression: "0 0 1 * *",
    category: "Mensuales",
    note: "Facturación o cierre mensual",
  },
  {
    label: "Trimestral (ene, abr, jul, oct)",
    expression: "0 0 1 1,4,7,10 *",
    category: "Mensuales",
    note: "Primer día de cada trimestre",
  },
  {
    label: "Anual (1 de enero)",
    expression: "0 0 1 JAN *",
    category: "Anuales",
    note: "Usando abreviatura de mes",
  },
  {
    label: "Atajo @daily",
    expression: "@daily",
    category: "Atajos",
    note: "Equivalente a 0 0 * * *",
  },
];

export const CRON_EXAMPLES_6 = [
  {
    label: "Cada 10 segundos",
    expression: "*/10 * * * * *",
    category: "Frecuentes",
    note: "Sondeo de alta frecuencia",
  },
  {
    label: "Cada 30 segundos",
    expression: "*/30 * * * * *",
    category: "Frecuentes",
    note: "En los segundos 0 y 30",
  },
  {
    label: "Cada minuto exacto",
    expression: "0 * * * * *",
    category: "Frecuentes",
    note: "Segundo 0 de cada minuto",
  },
  {
    label: "Cada 5 minutos",
    expression: "0 */5 * * * *",
    category: "Frecuentes",
    note: "Equivalente con segundos",
  },
  {
    label: "Lunes a viernes a las 09:00:00",
    expression: "0 0 9 * * 1-5",
    category: "Laborales",
    note: "Con precisión de segundo",
  },
  {
    label: "Diario a medianoche",
    expression: "0 0 0 * * *",
    category: "Diarios",
    note: "00:00:00 todos los días",
  },
  {
    label: "Día 1 de cada mes",
    expression: "0 0 0 1 * *",
    category: "Mensuales",
    note: "Inicio de mes a las 00:00:00",
  },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseAtom(raw, field) {
  const str = raw.trim().toUpperCase();
  if (!str) {
    return { error: `Valor vacío en el campo "${field.label}"` };
  }

  if (field.names) {
    const idx = field.names.indexOf(str);
    if (idx !== -1) {
      return { value: idx + field.nameOffset };
    }
  }

  if (!/^\d+$/.test(str)) {
    const hint = field.names
      ? `Usa números (${field.min}–${field.isDow ? 6 : field.max}) o nombres (${field.names[0]}–${field.names[field.names.length - 1]})`
      : `Usa números enteros entre ${field.min} y ${field.max}`;
    return { error: `Valor "${raw}" no reconocido en "${field.label}". ${hint}.` };
  }

  const num = Number.parseInt(str, 10);
  if (num < field.min || num > field.max) {
    return {
      error: `Valor "${num}" fuera de rango en "${field.label}" (permitido: ${field.rangeText}).`,
    };
  }

  return { value: num };
}

export function parseFieldToken(token, fieldKey) {
  const field = FIELD_DEFS[fieldKey];
  if (!field) {
    return { valid: false, error: `Campo desconocido: ${fieldKey}`, values: [] };
  }

  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    return { valid: false, error: `El campo "${field.label}" está vacío.`, values: [] };
  }

  const parts = trimmed.split(",");
  const valueSet = new Set();

  for (const part of parts) {
    if (!part) {
      return {
        valid: false,
        error: `Coma sobrante o elemento vacío en "${field.label}" ("${trimmed}").`,
        values: [],
      };
    }

    const slashSegments = part.split("/");
    if (slashSegments.length > 2) {
      return {
        valid: false,
        error: `Sintaxis de intervalo inválida "${part}" en "${field.label}". Usa un solo "/".`,
        values: [],
      };
    }

    const [rangePart, stepPart] = slashSegments;
    let step = 1;

    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart)) {
        return {
          valid: false,
          error: `Intervalo "/${stepPart}" inválido en "${field.label}". Debe ser un entero positivo.`,
          values: [],
        };
      }
      step = Number.parseInt(stepPart, 10);
      if (step < 1 || step > field.maxStep) {
        return {
          valid: false,
          error: `Intervalo "/${step}" fuera de rango en "${field.label}" (debe estar entre 1 y ${field.maxStep}).`,
          values: [],
        };
      }
    }

    const effectiveMax = field.isDow ? 6 : field.max;

    if (rangePart === "*") {
      for (let v = field.min; v <= effectiveMax; v += step) {
        valueSet.add(v);
      }
      continue;
    }

    if (rangePart.includes("-")) {
      const dashSegments = rangePart.split("-");
      if (dashSegments.length !== 2 || !dashSegments[0] || !dashSegments[1]) {
        return {
          valid: false,
          error: `Rango mal formado "${rangePart}" en "${field.label}". Ejemplo válido: ${field.min}-${Math.min(field.min + 4, effectiveMax)}.`,
          values: [],
        };
      }

      const startRes = parseAtom(dashSegments[0], field);
      if (startRes.error) return { valid: false, error: startRes.error, values: [] };

      const endRes = parseAtom(dashSegments[1], field);
      if (endRes.error) return { valid: false, error: endRes.error, values: [] };

      let start = startRes.value;
      let end = endRes.value;

      // Support FRI-SUN (5-0 -> 5-7) when SUN is written by name at the end of a range
      if (field.isDow && end === 0 && dashSegments[1].trim().toUpperCase() === "SUN" && start > 0) {
        end = 7;
      }

      if (start > end) {
        return {
          valid: false,
          error: `Rango invertido "${rangePart}" en "${field.label}": el inicio (${start}) es mayor que el fin (${end}).`,
          values: [],
        };
      }

      for (let v = start; v <= end; v += step) {
        valueSet.add(field.isDow ? v % 7 : v);
      }
      continue;
    }

    // Single value (possibly with step: e.g. 5/15 means 5..max step 15)
    const atomRes = parseAtom(rangePart, field);
    if (atomRes.error) return { valid: false, error: atomRes.error, values: [] };

    if (stepPart !== undefined) {
      const start = field.isDow && atomRes.value === 7 ? 0 : atomRes.value;
      for (let v = start; v <= effectiveMax; v += step) {
        valueSet.add(field.isDow ? v % 7 : v);
      }
    } else {
      valueSet.add(field.isDow ? atomRes.value % 7 : atomRes.value);
    }
  }

  const sorted = Array.from(valueSet).sort((a, b) => a - b);
  return {
    valid: true,
    error: null,
    values: sorted,
    isWildcard: trimmed === "*",
    raw: trimmed,
  };
}

function formatListEs(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function describeField(token, fieldKey, parsedValues = []) {
  const field = FIELD_DEFS[fieldKey];
  const t = String(token ?? "").trim().toUpperCase();

  if (t === "*") {
    if (fieldKey === "second") return "Cada segundo";
    if (fieldKey === "minute") return "Cada minuto";
    if (fieldKey === "hour") return "Cada hora";
    if (fieldKey === "dayOfMonth") return "Todos los días del mes";
    if (fieldKey === "month") return "Todos los meses";
    if (fieldKey === "dayOfWeek") return "Todos los días de la semana";
  }

  const stepMatch = t.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const n = Number.parseInt(stepMatch[1], 10);
    if (n === 1) return describeField("*", fieldKey, parsedValues);
    if (fieldKey === "dayOfWeek") return `Cada ${n} días de la semana`;
    return `Cada ${n} ${field.unitPlural}`;
  }

  if (fieldKey === "month") {
    const rangeMatch = t.match(/^([A-Z0-9]+)-([A-Z0-9]+)$/);
    if (rangeMatch) {
      const a = parseAtom(rangeMatch[1], field).value;
      const b = parseAtom(rangeMatch[2], field).value;
      if (a != null && b != null) {
        return `De ${MONTH_NAMES_ES[a - 1]} a ${MONTH_NAMES_ES[b - 1]}`;
      }
    }
    if (parsedValues.length > 0 && parsedValues.length <= 6) {
      return `En ${formatListEs(parsedValues.map((m) => MONTH_NAMES_ES[m - 1]))}`;
    }
    return `${parsedValues.length} meses seleccionados`;
  }

  if (fieldKey === "dayOfWeek") {
    if (t === "1-5" || t === "MON-FRI") return "De lunes a viernes";
    if (t === "0,6" || t === "6,0" || t === "SUN,SAT" || t === "SAT,SUN" || t === "6,7") {
      return "Sábados y domingos";
    }
    const rangeMatch = t.match(/^([A-Z0-9]+)-([A-Z0-9]+)$/);
    if (rangeMatch) {
      const a = parseAtom(rangeMatch[1], field).value;
      let b = parseAtom(rangeMatch[2], field).value;
      if (a != null && b != null) {
        if (b === 7) b = 0;
        return `De ${DOW_NAMES_ES[a % 7]} a ${DOW_NAMES_ES[b % 7]}`;
      }
    }
    if (parsedValues.length > 0) {
      return `Los ${formatListEs(parsedValues.map((d) => DOW_PLURAL_ES[d]))}`;
    }
  }

  if (fieldKey === "dayOfMonth") {
    if (parsedValues.length === 1) return `El día ${parsedValues[0]}`;
    const rangeMatch = t.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) return `Del día ${rangeMatch[1]} al ${rangeMatch[2]}`;
    if (parsedValues.length <= 6) return `Los días ${formatListEs(parsedValues.map(String))}`;
    return `${parsedValues.length} días del mes`;
  }

  if (fieldKey === "hour") {
    if (parsedValues.length === 1) return `A las ${pad2(parsedValues[0])}:00`;
    const rangeMatch = t.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) return `Entre las ${pad2(rangeMatch[1])}:00 y las ${pad2(rangeMatch[2])}:59`;
    if (parsedValues.length <= 6) {
      return `A las ${formatListEs(parsedValues.map((h) => `${pad2(h)}h`))}`;
    }
    return `${parsedValues.length} horas seleccionadas`;
  }

  if (fieldKey === "minute") {
    if (parsedValues.length === 1) return `En el minuto ${pad2(parsedValues[0])}`;
    const rangeMatch = t.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) return `Del minuto ${rangeMatch[1]} al ${rangeMatch[2]}`;
    if (parsedValues.length <= 6) {
      return `En los minutos ${formatListEs(parsedValues.map(pad2))}`;
    }
    return `${parsedValues.length} minutos seleccionados`;
  }

  if (fieldKey === "second") {
    if (parsedValues.length === 1) return `En el segundo ${pad2(parsedValues[0])}`;
    const rangeMatch = t.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) return `Del segundo ${rangeMatch[1]} al ${rangeMatch[2]}`;
    if (parsedValues.length <= 6) {
      return `En los segundos ${formatListEs(parsedValues.map(pad2))}`;
    }
    return `${parsedValues.length} segundos seleccionados`;
  }

  return token;
}

export function describeCron(parsed) {
  if (!parsed || !parsed.valid) return "";
  if (parsed.alias === "@reboot") {
    return CRON_ALIASES["@reboot"].description;
  }

  const { fieldsMap, includeSeconds } = parsed;
  const sec = includeSeconds ? fieldsMap.second : null;
  const min = fieldsMap.minute;
  const hour = fieldsMap.hour;
  const dom = fieldsMap.dayOfMonth;
  const month = fieldsMap.month;
  const dow = fieldsMap.dayOfWeek;

  const parts = [];

  // Time description
  const exactSec = includeSeconds ? sec.values.length === 1 : true;
  const exactMin = min.values.length === 1;
  const exactHour = hour.values.length === 1;

  if (includeSeconds && !exactSec) {
    parts.push(describeField(sec.raw, "second", sec.values));
    if (!min.isWildcard) parts.push(describeField(min.raw, "minute", min.values).toLowerCase());
    if (!hour.isWildcard) parts.push(describeField(hour.raw, "hour", hour.values).toLowerCase());
  } else if (exactHour && exactMin) {
    const timeStr = includeSeconds
      ? `${pad2(hour.values[0])}:${pad2(min.values[0])}:${pad2(sec.values[0])}`
      : `${pad2(hour.values[0])}:${pad2(min.values[0])}`;
    parts.push(`A las ${timeStr}`);
  } else if (min.isWildcard && hour.isWildcard) {
    if (includeSeconds && sec.values[0] !== 0) {
      parts.push(`Cada minuto en el segundo ${pad2(sec.values[0])}`);
    } else {
      parts.push("Cada minuto");
    }
  } else if (hour.isWildcard) {
    const minDesc = describeField(min.raw, "minute", min.values);
    if (min.values.length === 1 && min.values[0] === 0) {
      parts.push("Cada hora en punto");
    } else if (/^\*\/\d+$/.test(min.raw)) {
      parts.push(minDesc);
    } else {
      parts.push(`${minDesc} de cada hora`);
    }
    if (includeSeconds && sec.values[0] !== 0) {
      parts.push(`en el segundo ${pad2(sec.values[0])}`);
    }
  } else {
    parts.push(describeField(min.raw, "minute", min.values));
    parts.push(describeField(hour.raw, "hour", hour.values).toLowerCase());
    if (includeSeconds && sec.values[0] !== 0) {
      parts.push(`en el segundo ${pad2(sec.values[0])}`);
    }
  }

  // Date description
  const domRestricted = !dom.isWildcard;
  const dowRestricted = !dow.isWildcard;

  if (domRestricted && dowRestricted) {
    const domText = describeField(dom.raw, "dayOfMonth", dom.values).toLowerCase();
    const dowText = describeField(dow.raw, "dayOfWeek", dow.values).toLowerCase();
    parts.push(`${domText} o ${dowText}`);
  } else if (domRestricted) {
    const domText = describeField(dom.raw, "dayOfMonth", dom.values).toLowerCase();
    parts.push(month.isWildcard ? `${domText} de cada mes` : domText);
  } else if (dowRestricted) {
    parts.push(describeField(dow.raw, "dayOfWeek", dow.values).toLowerCase());
  } else if (exactHour && exactMin && month.isWildcard) {
    parts.push("todos los días");
  }

  if (!month.isWildcard) {
    const monthText = describeField(month.raw, "month", month.values).toLowerCase();
    parts.push(monthText);
  }

  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function validateCron(expression, includeSeconds = false) {
  const raw = String(expression ?? "").trim();
  const fieldOrder = getFieldOrder(includeSeconds);
  const expectedCount = fieldOrder.length;

  if (!raw) {
    return {
      valid: false,
      error: "Introduce una expresión cron para validar.",
      fields: [],
      fieldsMap: {},
      includeSeconds,
      description: "",
      suggestedMode: null,
    };
  }

  // Check aliases (@daily, @hourly, etc.)
  const lower = raw.toLowerCase();
  if (lower.startsWith("@")) {
    const aliasInfo = CRON_ALIASES[lower];
    if (!aliasInfo) {
      const validAliases = Object.keys(CRON_ALIASES).join(", ");
      return {
        valid: false,
        error: `Atajo "${raw}" desconocido. Atajos válidos: ${validAliases}.`,
        fields: [],
        fieldsMap: {},
        includeSeconds,
        description: "",
        suggestedMode: null,
      };
    }

    if (lower === "@reboot") {
      return {
        valid: true,
        error: null,
        alias: "@reboot",
        expandedExpression: null,
        fields: [],
        fieldsMap: {},
        includeSeconds,
        description: aliasInfo.description,
        isReboot: true,
        bothDayFieldsRestricted: false,
        suggestedMode: null,
      };
    }

    const expanded = includeSeconds ? aliasInfo.six : aliasInfo.five;
    const expandedResult = validateCron(expanded, includeSeconds);
    return {
      ...expandedResult,
      alias: lower,
      expandedExpression: expanded,
      description: aliasInfo.description,
    };
  }

  const tokens = raw.split(/\s+/);
  if (tokens.length !== expectedCount) {
    let suggestedMode = null;
    let hint = "";
    if (!includeSeconds && tokens.length === 6) {
      suggestedMode = "six";
      hint = " Parece un cron de 6 campos (con segundos): puedes cambiar al modo de 6 campos.";
    } else if (includeSeconds && tokens.length === 5) {
      suggestedMode = "five";
      hint = " Parece un cron estándar de 5 campos: puedes cambiar al modo de 5 campos.";
    }
    return {
      valid: false,
      error: `Se esperaban ${expectedCount} campos separados por espacios y se encontraron ${tokens.length}.${hint}`,
      fields: tokens.map((tok, idx) => {
        const key = fieldOrder[idx];
        const def = key ? FIELD_DEFS[key] : null;
        return {
          key: key || `extra-${idx}`,
          label: def ? def.label : `Extra #${idx + 1}`,
          rangeText: def ? def.rangeText : "No permitido",
          raw: tok,
          valid: Boolean(def) && parseFieldToken(tok, key).valid,
          error: def ? parseFieldToken(tok, key).error : "Campo sobrante",
          values: def ? parseFieldToken(tok, key).values : [],
          description: "",
        };
      }),
      fieldsMap: {},
      includeSeconds,
      description: "",
      suggestedMode,
    };
  }

  const fields = [];
  const fieldsMap = {};
  const errors = [];

  for (let i = 0; i < fieldOrder.length; i++) {
    const key = fieldOrder[i];
    const def = FIELD_DEFS[key];
    const token = tokens[i];
    const res = parseFieldToken(token, key);

    const fieldObj = {
      key,
      label: def.label,
      shortLabel: def.shortLabel,
      rangeText: def.rangeText,
      raw: token,
      valid: res.valid,
      error: res.error,
      values: res.values,
      isWildcard: res.isWildcard,
      description: res.valid ? describeField(token, key, res.values) : "",
    };

    fields.push(fieldObj);
    fieldsMap[key] = fieldObj;
    if (!res.valid) {
      errors.push(res.error);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors[0],
      errors,
      fields,
      fieldsMap,
      includeSeconds,
      description: "",
      suggestedMode: null,
    };
  }

  const bothDayFieldsRestricted =
    !fieldsMap.dayOfMonth.isWildcard && !fieldsMap.dayOfWeek.isWildcard;

  const result = {
    valid: true,
    error: null,
    errors: [],
    alias: null,
    expandedExpression: raw,
    fields,
    fieldsMap,
    includeSeconds,
    bothDayFieldsRestricted,
    suggestedMode: null,
  };

  result.description = describeCron(result);
  return result;
}

export function getNextExecutions(parsed, count = 5, fromDate = new Date()) {
  if (!parsed || !parsed.valid || parsed.isReboot) {
    return [];
  }

  const { fieldsMap, includeSeconds } = parsed;
  const secondSet = includeSeconds ? new Set(fieldsMap.second.values) : new Set([0]);
  const minuteSet = new Set(fieldsMap.minute.values);
  const hourSet = new Set(fieldsMap.hour.values);
  const domSet = new Set(fieldsMap.dayOfMonth.values);
  const monthSet = new Set(fieldsMap.month.values);
  const dowSet = new Set(fieldsMap.dayOfWeek.values);

  const domRestricted = !fieldsMap.dayOfMonth.isWildcard;
  const dowRestricted = !fieldsMap.dayOfWeek.isWildcard;

  const sortedMonths = fieldsMap.month.values;
  const sortedHours = fieldsMap.hour.values;
  const sortedMinutes = fieldsMap.minute.values;
  const sortedSeconds = includeSeconds ? fieldsMap.second.values : [0];

  const cursor = new Date(fromDate.getTime());
  cursor.setMilliseconds(0);

  if (includeSeconds) {
    cursor.setSeconds(cursor.getSeconds() + 1);
  } else {
    cursor.setSeconds(0);
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  const maxYear = fromDate.getFullYear() + 8;
  const results = [];
  let guard = 0;
  const MAX_ITERATIONS = 20000;

  while (results.length < count && cursor.getFullYear() <= maxYear && guard < MAX_ITERATIONS) {
    guard++;

    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1; // 1..12

    if (!monthSet.has(month)) {
      const nextMonth = sortedMonths.find((m) => m > month);
      if (nextMonth !== undefined) {
        cursor.setFullYear(year, nextMonth - 1, 1);
        cursor.setHours(0, 0, 0, 0);
      } else {
        cursor.setFullYear(year + 1, sortedMonths[0] - 1, 1);
        cursor.setHours(0, 0, 0, 0);
      }
      continue;
    }

    const dom = cursor.getDate();
    const dow = cursor.getDay();
    let dayMatches = true;
    if (domRestricted && dowRestricted) {
      dayMatches = domSet.has(dom) || dowSet.has(dow);
    } else if (domRestricted) {
      dayMatches = domSet.has(dom);
    } else if (dowRestricted) {
      dayMatches = dowSet.has(dow);
    }

    if (!dayMatches) {
      cursor.setFullYear(year, month - 1, dom + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const hour = cursor.getHours();
    if (!hourSet.has(hour)) {
      const nextHour = sortedHours.find((h) => h > hour);
      if (nextHour !== undefined) {
        cursor.setHours(nextHour, 0, 0, 0);
      } else {
        cursor.setFullYear(year, month - 1, dom + 1);
        cursor.setHours(0, 0, 0, 0);
      }
      continue;
    }

    const minute = cursor.getMinutes();
    if (!minuteSet.has(minute)) {
      const nextMinute = sortedMinutes.find((m) => m > minute);
      if (nextMinute !== undefined) {
        cursor.setMinutes(nextMinute, 0, 0);
      } else {
        cursor.setHours(hour + 1, 0, 0, 0);
      }
      continue;
    }

    if (includeSeconds) {
      const second = cursor.getSeconds();
      if (!secondSet.has(second)) {
        const nextSecond = sortedSeconds.find((s) => s > second);
        if (nextSecond !== undefined) {
          cursor.setSeconds(nextSecond, 0);
        } else {
          cursor.setMinutes(minute + 1, 0, 0);
        }
        continue;
      }
    }

    results.push(new Date(cursor.getTime()));

    if (includeSeconds) {
      cursor.setSeconds(cursor.getSeconds() + 1);
    } else {
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
  }

  return results;
}

export function decomposeFieldForBuilder(token, fieldKey) {
  const field = FIELD_DEFS[fieldKey];
  const effectiveMax = field.isDow ? 6 : field.max;
  const trimmed = String(token ?? "*").trim();

  if (trimmed === "*") {
    return {
      mode: "every",
      step: fieldKey === "minute" || fieldKey === "second" ? 5 : 2,
      stepStart: field.min,
      rangeStart: field.min,
      rangeEnd: Math.min(field.min + 4, effectiveMax),
      specific: [field.min],
    };
  }

  const stepMatch = trimmed.match(/^(\*|\d+)\/(\d+)$/);
  if (stepMatch) {
    const startVal = stepMatch[1] === "*" ? field.min : Number.parseInt(stepMatch[1], 10);
    const stepVal = Number.parseInt(stepMatch[2], 10);
    return {
      mode: "step",
      step: Math.max(1, Math.min(stepVal, field.maxStep)),
      stepStart: Math.max(field.min, Math.min(startVal, effectiveMax)),
      rangeStart: field.min,
      rangeEnd: Math.min(field.min + 4, effectiveMax),
      specific: [field.min],
    };
  }

  const rangeMatch = trimmed.match(/^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/);
  if (rangeMatch) {
    const a = parseAtom(rangeMatch[1], field);
    const b = parseAtom(rangeMatch[2], field);
    if (!a.error && !b.error) {
      const s = field.isDow ? a.value % 7 : a.value;
      const e = field.isDow && b.value === 7 ? 0 : b.value;
      if (s <= e) {
        return {
          mode: "range",
          step: fieldKey === "minute" || fieldKey === "second" ? 5 : 2,
          stepStart: field.min,
          rangeStart: s,
          rangeEnd: e,
          specific: [s],
        };
      }
    }
  }

  const parsed = parseFieldToken(trimmed, fieldKey);
  return {
    mode: "specific",
    step: fieldKey === "minute" || fieldKey === "second" ? 5 : 2,
    stepStart: field.min,
    rangeStart: field.min,
    rangeEnd: Math.min(field.min + 4, effectiveMax),
    specific: parsed.valid && parsed.values.length > 0 ? parsed.values : [field.min],
  };
}

export function buildFieldToken(config, fieldKey) {
  const field = FIELD_DEFS[fieldKey];
  if (config.mode === "every") return "*";
  if (config.mode === "step") {
    const step = Math.max(1, Math.min(Number(config.step) || 1, field.maxStep));
    const start = Number(config.stepStart);
    if (Number.isFinite(start) && start > field.min) {
      return `${start}/${step}`;
    }
    return `*/${step}`;
  }
  if (config.mode === "range") {
    const start = Number(config.rangeStart);
    const end = Number(config.rangeEnd);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    return low === high ? String(low) : `${low}-${high}`;
  }
  if (config.mode === "specific") {
    const unique = Array.from(new Set(config.specific || [])).sort((a, b) => a - b);
    return unique.length > 0 ? unique.join(",") : "*";
  }
  return "*";
}

export function formatExecutionDate(date, includeSeconds = false) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(date);
}

export function formatRelativeTime(targetDate, baseDate = new Date()) {
  const diffSec = Math.round((targetDate.getTime() - baseDate.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
}
