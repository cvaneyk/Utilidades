import { useState, useMemo, useId, useRef } from "react";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
  CalendarClock,
  Sparkles,
  BookOpen,
  Info,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_DEFS,
  MONTH_SHORT_ES,
  DOW_SHORT_ES,
  CRON_ALIASES,
  CRON_EXAMPLES_5,
  CRON_EXAMPLES_6,
  getFieldOrder,
  validateCron,
  getNextExecutions,
  decomposeFieldForBuilder,
  buildFieldToken,
  formatExecutionDate,
  formatRelativeTime,
} from "@/lib/cronUtils";

function getOptionLabel(fieldKey, val) {
  if (fieldKey === "month") return `${val} - ${MONTH_SHORT_ES[val - 1]}`;
  if (fieldKey === "dayOfWeek") return `${val} - ${DOW_SHORT_ES[val]}`;
  if (fieldKey === "hour" || fieldKey === "minute" || fieldKey === "second") {
    return String(val).padStart(2, "0");
  }
  return String(val);
}

function getChipLabel(fieldKey, val) {
  if (fieldKey === "month") return MONTH_SHORT_ES[val - 1];
  if (fieldKey === "dayOfWeek") return DOW_SHORT_ES[val];
  if (fieldKey === "hour" || fieldKey === "minute" || fieldKey === "second") {
    return String(val).padStart(2, "0");
  }
  return String(val);
}

function getAllValuesForField(fieldKey) {
  const def = FIELD_DEFS[fieldKey];
  const max = def.isDow ? 6 : def.max;
  const arr = [];
  for (let i = def.min; i <= max; i++) arr.push(i);
  return arr;
}

const SYNTAX_OPERATORS = [
  { symbol: "*", meaning: "Cualquier valor", example: "* * * * *" },
  { symbol: ",", meaning: "Lista de valores", example: "0 9,14,18 * * *" },
  { symbol: "-", meaning: "Rango de valores", example: "0 9 * * 1-5" },
  { symbol: "/", meaning: "Intervalo o paso", example: "*/15 * * * *" },
];

export default function CronTool() {
  const [expression, setExpression] = useState("0 9 * * 1-5");
  const [includeSeconds, setIncludeSeconds] = useState(false);
  const [activeField, setActiveField] = useState("minute");
  const [runsCount, setRunsCount] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [nowRef, setNowRef] = useState(() => new Date());
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const inputRef = useRef(null);

  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const secondsSwitchId = useId();

  const fieldOrder = useMemo(() => getFieldOrder(includeSeconds), [includeSeconds]);

  const parsed = useMemo(
    () => validateCron(expression, includeSeconds),
    [expression, includeSeconds]
  );

  const nextRuns = useMemo(
    () => getNextExecutions(parsed, runsCount, nowRef),
    [parsed, runsCount, nowRef]
  );

  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    } catch {
      return "Local";
    }
  }, []);

  const examples = includeSeconds ? CRON_EXAMPLES_6 : CRON_EXAMPLES_5;
  const categories = useMemo(() => {
    const set = new Set(examples.map((e) => e.category));
    return ["Todos", ...Array.from(set)];
  }, [examples]);

  const filteredExamples = useMemo(() => {
    if (selectedCategory === "Todos") return examples;
    return examples.filter((e) => e.category === selectedCategory);
  }, [examples, selectedCategory]);

  // Normalized array of current field tokens for the visual builder
  const currentTokens = useMemo(() => {
    const baseExpr = parsed.expandedExpression || expression.trim();
    const parts = baseExpr ? baseExpr.split(/\s+/) : [];
    return fieldOrder.map((_, idx) => parts[idx] || "*");
  }, [parsed.expandedExpression, expression, fieldOrder]);

  const updateFieldToken = (fieldKey, newToken) => {
    const idx = fieldOrder.indexOf(fieldKey);
    if (idx === -1) return;
    const next = [...currentTokens];
    next[idx] = newToken;
    setExpression(next.join(" "));
    setNowRef(new Date());
    setLiveAnnouncement("");
  };

  const handleModeToggle = (checked) => {
    setIncludeSeconds(checked);
    setSelectedCategory("Todos");
    const trimmed = expression.trim();

    if (trimmed.startsWith("@")) {
      if (!checked && activeField === "second") setActiveField("minute");
      return;
    }

    const parts = trimmed ? trimmed.split(/\s+/) : [];
    if (checked && parts.length === 5) {
      setExpression(`0 ${parts.join(" ")}`);
    } else if (!checked && parts.length === 6) {
      setExpression(parts.slice(1).join(" "));
      if (activeField === "second") setActiveField("minute");
    } else if (!checked && activeField === "second") {
      setActiveField("minute");
    }
    setNowRef(new Date());
  };

  const handleSwitchSuggestedMode = () => {
    if (parsed.suggestedMode === "six") {
      setIncludeSeconds(true);
      setSelectedCategory("Todos");
      toast.info("Cambiado a formato de 6 campos (con segundos)");
    } else if (parsed.suggestedMode === "five") {
      setIncludeSeconds(false);
      setSelectedCategory("Todos");
      if (activeField === "second") setActiveField("minute");
      toast.info("Cambiado a formato estándar de 5 campos");
    }
  };

  const handleExpressionChange = (e) => {
    const val = e.target.value;
    setExpression(val);
    if (liveAnnouncement) setLiveAnnouncement("");
  };

  const handleExpressionBlur = () => {
    if (!parsed.valid && parsed.error) {
      setLiveAnnouncement(`Expresión cron inválida: ${parsed.error}`);
    }
  };

  const handleValidateSubmit = (e) => {
    e.preventDefault();
    setNowRef(new Date());
    if (parsed.valid) {
      setLiveAnnouncement(`Expresión cron válida: ${parsed.description}`);
      toast.success("Expresión cron válida");
    } else {
      setLiveAnnouncement(`Expresión cron inválida: ${parsed.error}`);
      inputRef.current?.focus();
      toast.error("La expresión cron contiene errores");
    }
  };

  const copyExpression = async () => {
    if (!expression.trim()) return;
    try {
      await navigator.clipboard.writeText(expression.trim());
      toast.success("Expresión cron copiada");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const resetExpression = () => {
    setExpression(includeSeconds ? "* * * * * *" : "* * * * *");
    setNowRef(new Date());
    setLiveAnnouncement("");
    toast.info("Expresión restablecida");
  };

  const loadExample = (expr) => {
    setExpression(expr);
    setNowRef(new Date());
    setLiveAnnouncement("");
  };

  const activeFieldKey = fieldOrder.includes(activeField) ? activeField : fieldOrder[0];

  return (
    <div className="animate-in space-y-6 pb-10">
      {/* Polite screen reader live region for validation feedback */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2 mt-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Validador y Generador Cron</h1>
            <p className="text-muted-foreground">
              Valida expresiones cron, entiéndelas en español y genera horarios visualmente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 self-start sm:self-auto">
          <Switch
            id={secondsSwitchId}
            checked={includeSeconds}
            onCheckedChange={handleModeToggle}
            data-testid="cron-seconds-switch"
          />
          <Label htmlFor={secondsSwitchId} className="text-sm cursor-pointer select-none">
            Incluir segundos <span className="text-muted-foreground">(6 campos)</span>
          </Label>
        </div>
      </div>

      {/* Main Expression Validator Card */}
      <Card className="bg-card/40 backdrop-blur-md border-white/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-lg">Expresión Cron</CardTitle>
              <Badge
                variant={parsed.valid ? "default" : "destructive"}
                className="gap-1.5"
                data-testid="cron-status-badge"
              >
                {parsed.valid ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Válida</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Inválida</span>
                  </>
                )}
              </Badge>
              {parsed.alias && (
                <Badge variant="outline" className="font-mono text-xs text-accent border-accent/40">
                  Atajo {parsed.alias}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetExpression}
                data-testid="cron-reset-btn"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Restablecer
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={copyExpression}
                disabled={!expression.trim()}
                data-testid="cron-copy-btn"
              >
                <Copy className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Copiar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={handleValidateSubmit} noValidate className="space-y-2">
            <Label htmlFor={inputId} className="text-sm text-muted-foreground">
              Escribe o pega una expresión cron ({includeSeconds ? "6 campos: seg min hora día mes sem" : "5 campos: min hora día mes sem"} o un atajo como <code className="text-foreground">@daily</code>)
            </Label>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={inputRef}
                id={inputId}
                name="cronExpression"
                value={expression}
                onChange={handleExpressionChange}
                onBlur={handleExpressionBlur}
                placeholder={includeSeconds ? "0 */15 * * * *" : "*/15 * * * *"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                aria-invalid={parsed.valid ? "false" : "true"}
                aria-describedby={parsed.valid ? hintId : `${hintId} ${errorId}`}
                className={`h-14 text-lg md:text-2xl font-mono tracking-wider text-center bg-black/30 ${
                  parsed.valid
                    ? "border-primary/40 focus-visible:ring-primary/40"
                    : "border-destructive/60 focus-visible:ring-destructive/40"
                }`}
                data-testid="cron-input"
              />
              <Button type="submit" variant="secondary" className="h-14 px-6 shrink-0">
                Validar
              </Button>
            </div>

            <p id={hintId} className="text-xs text-muted-foreground">
              Sintaxis soportada: <code>*</code>, listas (<code>1,15</code>), rangos (<code>1-5</code>), pasos (<code>*/5</code>), nombres (<code>JAN-DEC</code>, <code>SUN-SAT</code>) y atajos (<code>@hourly</code>, <code>@daily</code>, <code>@weekly</code>, <code>@monthly</code>, <code>@yearly</code>).
            </p>
          </form>

          {/* Validation Result Banner */}
          {parsed.valid ? (
            <div
              className="p-4 rounded-xl bg-primary/10 border border-primary/25 space-y-2"
              data-testid="cron-description"
            >
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-base md:text-lg font-medium text-foreground">
                    “{parsed.description}”
                  </p>
                  {parsed.alias && parsed.expandedExpression && (
                    <p className="text-xs text-muted-foreground">
                      Equivale a:{" "}
                      <code className="px-1.5 py-0.5 rounded bg-black/30 text-primary font-mono">
                        {parsed.expandedExpression}
                      </code>
                    </p>
                  )}
                </div>
              </div>

              {parsed.bothDayFieldsRestricted && (
                <div className="flex items-start gap-2 pt-2 border-t border-primary/15 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Nota de cron estándar: al especificar tanto <strong>Día (mes)</strong> como{" "}
                    <strong>Día (semana)</strong>, la tarea se ejecutará cuando se cumpla{" "}
                    <strong>cualquiera de las dos</strong> condiciones (operador O).
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div
              id={errorId}
              className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3"
              data-testid="cron-error"
            >
              <div className="flex items-start gap-2.5 text-sm text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold">Error de sintaxis cron</p>
                  <p className="text-destructive/90">{parsed.error}</p>
                  {parsed.errors && parsed.errors.length > 1 && (
                    <ul className="list-disc pl-4 pt-1 space-y-0.5 text-xs">
                      {parsed.errors.slice(1).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {parsed.suggestedMode && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSwitchSuggestedMode}
                  className="border-destructive/40 hover:bg-destructive/20"
                >
                  Cambiar a modo de {parsed.suggestedMode === "six" ? "6 campos (con segundos)" : "5 campos (estándar)"}
                </Button>
              )}
            </div>
          )}

          {/* Field-by-Field Interactive Breakdown */}
          {parsed.fields && parsed.fields.length > 0 && (
            <div
              className={`grid gap-2.5 ${
                parsed.fields.length === 6
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              }`}
              data-testid="cron-fields-breakdown"
            >
              {parsed.fields.map((field) => {
                const isKnownField = fieldOrder.includes(field.key);
                const isSelected = isKnownField && activeFieldKey === field.key;
                return (
                  <button
                    key={field.key}
                    type="button"
                    disabled={!isKnownField}
                    onClick={() => isKnownField && setActiveField(field.key)}
                    className={`text-left p-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      !field.valid
                        ? "bg-destructive/10 border-destructive/40 text-destructive"
                        : isSelected
                        ? "bg-primary/15 border-primary/60"
                        : "bg-black/25 border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </span>
                      {field.valid ? (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <div className="font-mono text-lg font-semibold truncate text-foreground">
                      {field.raw}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {field.valid ? field.description : field.rangeText}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main 2-Column Workspace: Builder + Runs/Examples */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Visual Cron Generator */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" aria-hidden="true" />
                <div>
                  <CardTitle className="text-lg">Generador Visual</CardTitle>
                  <CardDescription>
                    Configura cada campo y la expresión se actualizará automáticamente
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs value={activeFieldKey} onValueChange={setActiveField}>
                <TabsList
                  className={`grid w-full h-auto p-1 bg-black/30 ${
                    includeSeconds ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-5"
                  }`}
                >
                  {fieldOrder.map((key, idx) => {
                    const def = FIELD_DEFS[key];
                    const tok = currentTokens[idx];
                    const isModified = tok !== "*";
                    const hasError = parsed.fieldsMap?.[key]?.valid === false;
                    return (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="relative py-2 text-xs sm:text-sm gap-1.5"
                        data-testid={`cron-tab-${key}`}
                      >
                        <span>{def.shortLabel}</span>
                        {hasError ? (
                          <span className="w-2 h-2 rounded-full bg-destructive" aria-hidden="true" />
                        ) : isModified ? (
                          <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {fieldOrder.map((key, idx) => (
                  <TabsContent key={key} value={key} className="mt-5">
                    <FieldBuilderPanel
                      fieldKey={key}
                      token={currentTokens[idx]}
                      onChange={(newTok) => updateFieldToken(key, newTok)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Syntax Cheat Sheet Card */}
          <Card className="bg-card/40 backdrop-blur-md border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" aria-hidden="true" />
                Guía Rápida de Sintaxis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {SYNTAX_OPERATORS.map((op) => (
                  <div
                    key={op.symbol}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/25 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-md bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0">
                        {op.symbol}
                      </span>
                      <div>
                        <div className="text-sm font-medium">{op.meaning}</div>
                        <code className="text-xs text-muted-foreground">{op.example}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Atajos especiales (haz clic para probar):
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CRON_ALIASES)
                    .filter(([k]) => !["@annually", "@midnight"].includes(k))
                    .map(([alias, info]) => (
                      <Button
                        key={alias}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadExample(alias)}
                        title={info.description}
                        className="font-mono text-xs h-8"
                      >
                        {alias}
                      </Button>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Next Executions & Examples */}
        <div className="lg:col-span-5 space-y-6">
          {/* Next Executions Card */}
          <Card className="bg-card/40 backdrop-blur-md border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-primary" aria-hidden="true" />
                  Próximas Ejecuciones
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {userTimeZone}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setNowRef(new Date())}
                    title="Actualizar hora actual"
                    aria-label="Actualizar hora actual"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {!parsed.valid ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Corrige la expresión cron para calcular las próximas ejecuciones.
                </div>
              ) : parsed.isReboot ? (
                <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  <code>@reboot</code> se ejecuta una única vez al arrancar el sistema, por lo que no
                  tiene fechas futuras programadas.
                </div>
              ) : nextRuns.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                  La sintaxis es válida, pero esta combinación de fecha no ocurre en los próximos 8
                  años (por ejemplo, 31 de febrero).
                </div>
              ) : (
                <>
                  <ol className="space-y-2" data-testid="cron-next-runs">
                    {nextRuns.map((runDate, index) => (
                      <li
                        key={runDate.getTime()}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-black/25 border border-white/5 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                            #{index + 1}
                          </span>
                          <span className="font-mono text-xs sm:text-sm truncate">
                            {formatExecutionDate(runDate, includeSeconds)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[11px] shrink-0 font-normal">
                          {formatRelativeTime(runDate, nowRef)}
                        </Badge>
                      </li>
                    ))}
                  </ol>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setRunsCount((c) => (c === 5 ? 10 : 5))}
                  >
                    {runsCount === 5 ? "Mostrar 10 próximas ejecuciones" : "Mostrar solo 5"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Examples Card */}
          <Card className="bg-card/40 backdrop-blur-md border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ejemplos Comunes</CardTitle>
              <CardDescription>
                Haz clic en cualquier plantilla para cargarla y editarla
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={selectedCategory === cat ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat)}
                    className="h-7 text-xs px-2.5"
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <div
                className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
                data-testid="cron-examples-list"
              >
                {filteredExamples.map((ex) => {
                  const isActive = expression.trim() === ex.expression;
                  return (
                    <button
                      key={`${ex.expression}-${ex.label}`}
                      type="button"
                      onClick={() => loadExample(ex.expression)}
                      className={`w-full text-left p-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-primary/15 border-primary/50"
                          : "bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium">{ex.label}</span>
                        <code className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 text-primary shrink-0">
                          {ex.expression}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground">{ex.note}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldBuilderPanel({ fieldKey, token, onChange }) {
  const def = FIELD_DEFS[fieldKey];
  const allValues = useMemo(() => getAllValuesForField(fieldKey), [fieldKey]);
  const config = useMemo(() => decomposeFieldForBuilder(token, fieldKey), [token, fieldKey]);
  const groupId = useId();

  const applyConfig = (patch) => {
    const next = { ...config, ...patch };
    onChange(buildFieldToken(next, fieldKey));
  };

  const toggleSpecificValue = (val) => {
    const exists = config.specific.includes(val);
    let nextValues;
    if (exists) {
      nextValues = config.specific.filter((v) => v !== val);
      if (nextValues.length === 0) {
        onChange("*");
        return;
      }
    } else {
      nextValues = [...config.specific, val];
    }
    applyConfig({ mode: "specific", specific: nextValues });
  };

  const stepOptions = useMemo(() => {
    const opts = [];
    for (let i = 1; i <= def.maxStep; i++) opts.push(i);
    return opts;
  }, [def.maxStep]);

  return (
    <fieldset className="space-y-4 border-0 p-0 m-0">
      <legend className="text-sm font-medium text-foreground mb-2">
        Configurar {def.label}{" "}
        <span className="text-xs font-normal text-muted-foreground">({def.rangeText})</span>
      </legend>

      <RadioGroup
        value={config.mode}
        onValueChange={(mode) => applyConfig({ mode })}
        className="space-y-3"
      >
        {/* Mode 1: Every (*) */}
        <div
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            config.mode === "every"
              ? "bg-primary/10 border-primary/40"
              : "bg-black/20 border-white/5"
          }`}
        >
          <RadioGroupItem value="every" id={`${groupId}-every`} />
          <Label htmlFor={`${groupId}-every`} className="flex-1 cursor-pointer text-sm">
            Cada {def.unitSingular}{" "}
            <code className="ml-1.5 text-xs text-primary font-mono">*</code>
          </Label>
        </div>

        {/* Mode 2: Step interval */}
        <div
          className={`p-3 rounded-xl border transition-colors space-y-3 ${
            config.mode === "step"
              ? "bg-primary/10 border-primary/40"
              : "bg-black/20 border-white/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem value="step" id={`${groupId}-step`} />
            <Label htmlFor={`${groupId}-step`} className="flex-1 cursor-pointer text-sm">
              Cada intervalo de {def.unitPlural}
            </Label>
          </div>

          {config.mode === "step" && (
            <div className="grid sm:grid-cols-2 gap-3 pl-7">
              <div className="space-y-1.5">
                <Label htmlFor={`${groupId}-step-val`} className="text-xs text-muted-foreground">
                  Repetir cada
                </Label>
                <Select
                  value={String(config.step)}
                  onValueChange={(v) => applyConfig({ mode: "step", step: Number(v) })}
                >
                  <SelectTrigger id={`${groupId}-step-val`} className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {stepOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? def.unitSingular : def.unitPlural}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${groupId}-step-start`} className="text-xs text-muted-foreground">
                  Empezando en
                </Label>
                <Select
                  value={String(config.stepStart)}
                  onValueChange={(v) => applyConfig({ mode: "step", stepStart: Number(v) })}
                >
                  <SelectTrigger id={`${groupId}-step-start`} className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allValues.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {getOptionLabel(fieldKey, v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Mode 3: Range (A-B) */}
        <div
          className={`p-3 rounded-xl border transition-colors space-y-3 ${
            config.mode === "range"
              ? "bg-primary/10 border-primary/40"
              : "bg-black/20 border-white/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem value="range" id={`${groupId}-range`} />
            <Label htmlFor={`${groupId}-range`} className="flex-1 cursor-pointer text-sm">
              Rango específico
            </Label>
          </div>

          {config.mode === "range" && (
            <div className="grid sm:grid-cols-2 gap-3 pl-7">
              <div className="space-y-1.5">
                <Label htmlFor={`${groupId}-range-start`} className="text-xs text-muted-foreground">
                  Desde
                </Label>
                <Select
                  value={String(config.rangeStart)}
                  onValueChange={(v) => applyConfig({ mode: "range", rangeStart: Number(v) })}
                >
                  <SelectTrigger id={`${groupId}-range-start`} className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allValues.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {getOptionLabel(fieldKey, v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${groupId}-range-end`} className="text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Select
                  value={String(config.rangeEnd)}
                  onValueChange={(v) => applyConfig({ mode: "range", rangeEnd: Number(v) })}
                >
                  <SelectTrigger id={`${groupId}-range-end`} className="bg-black/30 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allValues.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {getOptionLabel(fieldKey, v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Mode 4: Specific Values (A,B,C) */}
        <div
          className={`p-3 rounded-xl border transition-colors space-y-3 ${
            config.mode === "specific"
              ? "bg-primary/10 border-primary/40"
              : "bg-black/20 border-white/5"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <RadioGroupItem value="specific" id={`${groupId}-specific`} />
              <Label htmlFor={`${groupId}-specific`} className="cursor-pointer text-sm">
                Valores específicos
              </Label>
            </div>

            {config.mode === "specific" && (
              <div className="flex flex-wrap gap-1.5">
                {fieldKey === "dayOfWeek" && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => onChange("1-5")}
                    >
                      Lun–Vie
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => applyConfig({ mode: "specific", specific: [0, 6] })}
                    >
                      Fin de sem.
                    </Button>
                  </>
                )}
                {(fieldKey === "minute" || fieldKey === "second") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => applyConfig({ mode: "specific", specific: [0, 15, 30, 45] })}
                  >
                    00, 15, 30, 45
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground"
                  onClick={() => onChange("*")}
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>

          {config.mode === "specific" && (
            <div
              className={`grid gap-1.5 pl-1 sm:pl-7 ${
                fieldKey === "dayOfWeek"
                  ? "grid-cols-4 sm:grid-cols-7"
                  : fieldKey === "month"
                  ? "grid-cols-4 sm:grid-cols-6"
                  : fieldKey === "hour"
                  ? "grid-cols-6 sm:grid-cols-8"
                  : fieldKey === "dayOfMonth"
                  ? "grid-cols-7 sm:grid-cols-8"
                  : "grid-cols-6 sm:grid-cols-10"
              }`}
            >
              {allValues.map((val) => {
                const selected = config.specific.includes(val);
                return (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSpecificValue(val)}
                    className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-black/30 text-muted-foreground border-white/10 hover:border-white/30 hover:text-foreground"
                    }`}
                  >
                    {getChipLabel(fieldKey, val)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </RadioGroup>
    </fieldset>
  );
}
