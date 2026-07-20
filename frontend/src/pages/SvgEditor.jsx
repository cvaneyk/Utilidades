import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Shapes, Upload, Download, Copy, Sparkles, AlertCircle, Image as ImageIcon } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveAs } from "file-saver";

const EXAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="160" height="160" rx="24" fill="url(#grad)"/>
  <circle cx="100" cy="100" r="45" fill="white" opacity="0.9"/>
  <text x="100" y="112" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="bold" fill="#8b5cf6">SVG</text>
</svg>`;

const CHECKERBOARD_STYLE = {
    backgroundImage:
        "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%), " +
        "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 10px 10px",
};

function parseSvg(code) {
    if (!code.trim()) return { error: "El código está vacío" };
    const doc = new DOMParser().parseFromString(code, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
        return { error: parserError.textContent.split("\n")[0] || "Error de sintaxis XML" };
    }
    if (doc.documentElement.nodeName.toLowerCase() !== "svg") {
        return { error: `El elemento raíz es <${doc.documentElement.nodeName}>, debe ser <svg>` };
    }
    return { doc };
}

function getSvgSize(doc) {
    const root = doc.documentElement;
    const parseLength = (v) => {
        if (!v) return null;
        const n = parseFloat(String(v).replace(/px$/i, ""));
        return Number.isFinite(n) && n > 0 ? n : null;
    };
    let width = parseLength(root.getAttribute("width"));
    let height = parseLength(root.getAttribute("height"));
    if (width && height) return { width, height, source: "atributos" };
    const viewBox = root.getAttribute("viewBox");
    if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: width || parts[2], height: height || parts[3], source: "viewBox" };
        }
    }
    return { width: width || 300, height: height || 150, source: "por defecto" };
}

export default function SvgEditor() {
    const [svgCode, setSvgCode] = useState(EXAMPLE_SVG);
    const [debouncedCode, setDebouncedCode] = useState(EXAMPLE_SVG);
    const [scale, setScale] = useState("2");
    const [customWidth, setCustomWidth] = useState("");
    const [transparent, setTransparent] = useState(true);
    const [exporting, setExporting] = useState(false);
    const fileInputRef = useRef(null);
    const lastGoodUrlRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedCode(svgCode), 300);
        return () => clearTimeout(t);
    }, [svgCode]);

    const parsed = useMemo(() => parseSvg(debouncedCode), [debouncedCode]);
    const svgSize = useMemo(() => (parsed.doc ? getSvgSize(parsed.doc) : null), [parsed]);

    // La preview mantiene la última versión válida cuando el código tiene errores
    const previewUrl = useMemo(() => {
        if (parsed.doc) {
            const url = URL.createObjectURL(new Blob([debouncedCode], { type: "image/svg+xml" }));
            lastGoodUrlRef.current = url;
            return url;
        }
        return lastGoodUrlRef.current;
    }, [parsed, debouncedCode]);

    useEffect(() => () => {
        if (lastGoodUrlRef.current) URL.revokeObjectURL(lastGoodUrlRef.current);
    }, []);
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl !== lastGoodUrlRef.current) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("El archivo supera 5MB");
            return;
        }
        setSvgCode(await file.text());
        toast.success(`${file.name} cargado`);
    };

    const copyCode = async () => {
        await navigator.clipboard.writeText(svgCode);
        toast.success("Código copiado al portapapeles");
    };

    const downloadSvg = () => {
        if (!parsed.doc) {
            toast.error("Corrige los errores del SVG antes de descargar");
            return;
        }
        saveAs(new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" }), "imagen.svg");
    };

    const downloadPng = () => {
        if (!parsed.doc || !svgSize) {
            toast.error("Corrige los errores del SVG antes de exportar");
            return;
        }
        setExporting(true);

        let outWidth, outHeight;
        if (customWidth && parseFloat(customWidth) > 0) {
            outWidth = Math.round(parseFloat(customWidth));
            outHeight = Math.round(outWidth * (svgSize.height / svgSize.width));
        } else {
            const factor = parseFloat(scale);
            outWidth = Math.round(svgSize.width * factor);
            outHeight = Math.round(svgSize.height * factor);
        }
        if (outWidth > 10000 || outHeight > 10000) {
            toast.error("El tamaño de exportación supera 10000px");
            setExporting(false);
            return;
        }

        // Fijar width/height en el clon para que funcione con SVGs que solo tienen viewBox
        const clone = parsed.doc.documentElement.cloneNode(true);
        clone.setAttribute("width", svgSize.width);
        clone.setAttribute("height", svgSize.height);
        if (!clone.getAttribute("viewBox")) {
            clone.setAttribute("viewBox", `0 0 ${svgSize.width} ${svgSize.height}`);
        }
        const serialized = new XMLSerializer().serializeToString(clone);
        const url = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml" }));

        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = outWidth;
                canvas.height = outHeight;
                const ctx = canvas.getContext("2d");
                if (!transparent) {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, outWidth, outHeight);
                }
                ctx.drawImage(img, 0, 0, outWidth, outHeight);
                canvas.toBlob((blob) => {
                    if (blob) {
                        saveAs(blob, "imagen.png");
                        toast.success(`PNG exportado (${outWidth}×${outHeight})`);
                    } else {
                        toast.error("No se pudo generar el PNG");
                    }
                    URL.revokeObjectURL(url);
                    setExporting(false);
                }, "image/png");
            } catch (err) {
                URL.revokeObjectURL(url);
                setExporting(false);
                toast.error("Error al renderizar en canvas: " + err.message);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            setExporting(false);
            toast.error("No se pudo renderizar el SVG como imagen");
        };
        img.src = url;
    };

    return (
        <div className="animate-in space-y-6">
            <div className="flex items-center gap-3 mb-8 mt-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-400 flex items-center justify-center">
                    <Shapes className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Editor SVG</h1>
                    <p className="text-muted-foreground">Edita código SVG con vista previa en vivo y expórtalo como SVG o PNG</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <CardTitle className="text-lg">Código SVG</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="w-4 h-4 mr-1.5" />Subir .svg
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSvgCode(EXAMPLE_SVG)}>
                                    <Sparkles className="w-4 h-4 mr-1.5" />Ejemplo
                                </Button>
                                <Button variant="outline" size="sm" onClick={copyCode}>
                                    <Copy className="w-4 h-4 mr-1.5" />Copiar
                                </Button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".svg,image/svg+xml"
                                className="hidden"
                                onChange={handleUpload}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="rounded-lg overflow-hidden border border-white/10">
                            <CodeMirror
                                value={svgCode}
                                height="480px"
                                theme="dark"
                                extensions={[xml()]}
                                onChange={setSvgCode}
                                basicSetup={{ lineNumbers: true, foldGutter: true }}
                            />
                        </div>
                        {parsed.error && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span className="break-all">{parsed.error}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Preview + export */}
                <div className="space-y-6">
                    <Card className="bg-card/40 backdrop-blur-md border-white/5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Vista previa</CardTitle>
                                {svgSize && (
                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(svgSize.width)}×{Math.round(svgSize.height)} px ({svgSize.source})
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="rounded-lg border border-white/10 min-h-[280px] flex items-center justify-center p-4"
                                style={CHECKERBOARD_STYLE}
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Vista previa del SVG"
                                        className="max-w-full max-h-[400px]"
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground">Introduce código SVG válido para ver la vista previa</p>
                                )}
                            </div>
                            {parsed.error && previewUrl && (
                                <p className="text-xs text-muted-foreground mt-2">Mostrando la última versión válida</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/40 backdrop-blur-md border-white/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Exportar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Escala PNG</Label>
                                    <Select value={scale} onValueChange={setScale} disabled={!!customWidth}>
                                        <SelectTrigger className="bg-black/20 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1x {svgSize ? `(${Math.round(svgSize.width)}px)` : ""}</SelectItem>
                                            <SelectItem value="2">2x {svgSize ? `(${Math.round(svgSize.width * 2)}px)` : ""}</SelectItem>
                                            <SelectItem value="4">4x {svgSize ? `(${Math.round(svgSize.width * 4)}px)` : ""}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="custom-width">Ancho personalizado (px)</Label>
                                    <Input
                                        id="custom-width"
                                        type="number"
                                        placeholder="opcional, ej. 1024"
                                        value={customWidth}
                                        onChange={e => setCustomWidth(e.target.value)}
                                        className="bg-black/20 border-white/10"
                                        min="1"
                                        max="10000"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch id="transparent-bg" checked={transparent} onCheckedChange={setTransparent} />
                                <Label htmlFor="transparent-bg" className="cursor-pointer text-sm">
                                    Fondo transparente (si no, fondo blanco)
                                </Label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                <Button onClick={downloadSvg} variant="outline" className="h-11 font-semibold">
                                    <Download className="w-5 h-5 mr-2" />Descargar SVG
                                </Button>
                                <Button onClick={downloadPng} disabled={exporting} className="h-11 font-semibold glow-accent">
                                    <ImageIcon className="w-5 h-5 mr-2" />
                                    {exporting ? "Exportando..." : "Descargar PNG"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
