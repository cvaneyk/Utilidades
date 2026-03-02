import { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Scaling, Upload, Download, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import config from "@/config";

const API = config.API_URL;

export default function ImageResizer() {
    const [files, setFiles] = useState([]);
    const [resizedImages, setResizedImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dragging, setDragging] = useState(false);

    // Resize settings
    const [mode, setMode] = useState("pixel"); // "pixel" | "percentage"
    const [width, setWidth] = useState("");
    const [height, setHeight] = useState("");
    const [percentage, setPercentage] = useState("50");
    const [keepAspect, setKeepAspect] = useState(true);
    const [quality, setQuality] = useState("85");
    const [outputFormat, setOutputFormat] = useState("WEBP");

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (dropped.length + files.length > 10) {
            toast.error("Máximo 10 imágenes");
            return;
        }
        setFiles(prev => [...prev, ...dropped]);
    }, [files.length]);

    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length + files.length > 10) {
            toast.error("Máximo 10 imágenes");
            return;
        }
        setFiles(prev => [...prev, ...selected]);
    };

    const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

    const resize = async () => {
        if (files.length === 0) {
            toast.error("Selecciona al menos una imagen");
            return;
        }
        if (mode === "pixel" && !width && !height) {
            toast.error("Introduce al menos ancho o alto");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            files.forEach(f => formData.append("files", f));
            if (mode === "percentage") {
                formData.append("percentage", percentage);
            } else {
                if (width) formData.append("width", width);
                if (height && !keepAspect) formData.append("height", height);
                else if (height && !width) formData.append("height", height);
            }
            formData.append("quality", quality);
            formData.append("output_format", outputFormat);

            const response = await axios.post(`${API}/images/resize`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            const results = response.data.images;
            setResizedImages(results);

            const ok = results.filter(r => r.success).length;
            const fail = results.filter(r => !r.success).length;
            if (fail > 0) toast.warning(`${ok} redimensionadas, ${fail} errores`);
            else toast.success(`${ok} imagen(es) redimensionada(s)!`);
        } catch (error) {
            toast.error(error.response?.data?.detail || "Error al redimensionar");
        } finally {
            setLoading(false);
        }
    };

    const downloadSingle = (img) => {
        const binary = atob(img.img_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const mimeMap = { WEBP: "image/webp", JPEG: "image/jpeg", PNG: "image/png" };
        const blob = new Blob([bytes], { type: mimeMap[img.format] || "image/webp" });
        saveAs(blob, img.new_name);
    };

    const downloadAll = async () => {
        const successful = resizedImages.filter(img => img.success);
        if (successful.length === 0) return;
        if (successful.length === 1) { downloadSingle(successful[0]); return; }

        const zip = new JSZip();
        const mimeMap = { WEBP: "image/webp", JPEG: "image/jpeg", PNG: "image/png" };
        successful.forEach(img => {
            const binary = atob(img.img_base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            zip.file(img.new_name, new Blob([bytes], { type: mimeMap[img.format] }));
        });
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, "imagenes-redimensionadas.zip");
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    return (
        <div className="animate-in space-y-6">
            <div className="flex items-center gap-3 mb-8 mt-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
                    <Scaling className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Redimensionar Imagen</h1>
                    <p className="text-muted-foreground">Cambia el tamaño de tus imágenes por píxeles o porcentaje</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Settings */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Configuración</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Mode tabs */}
                        <div>
                            <Label className="mb-2 block">Modo de redimensionado</Label>
                            <Tabs value={mode} onValueChange={setMode}>
                                <TabsList className="bg-muted/50">
                                    <TabsTrigger value="pixel">Por píxeles</TabsTrigger>
                                    <TabsTrigger value="percentage">Por porcentaje</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {mode === "pixel" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="width-input">Ancho (px)</Label>
                                    <Input
                                        id="width-input"
                                        type="number"
                                        placeholder="ej. 1920"
                                        value={width}
                                        onChange={e => setWidth(e.target.value)}
                                        className="bg-black/20 border-white/10"
                                        min="1"
                                        max="8000"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="height-input">
                                        Alto (px)
                                        {keepAspect && width && <span className="text-xs text-muted-foreground ml-2">(auto por ratio)</span>}
                                    </Label>
                                    <Input
                                        id="height-input"
                                        type="number"
                                        placeholder="ej. 1080"
                                        value={height}
                                        onChange={e => setHeight(e.target.value)}
                                        className="bg-black/20 border-white/10"
                                        min="1"
                                        max="8000"
                                        disabled={keepAspect && !!width && !height}
                                    />
                                </div>
                                <div className="flex items-center gap-2 col-span-full">
                                    <input
                                        type="checkbox"
                                        id="keep-aspect"
                                        checked={keepAspect}
                                        onChange={e => setKeepAspect(e.target.checked)}
                                        className="rounded"
                                    />
                                    <Label htmlFor="keep-aspect" className="cursor-pointer text-sm">
                                        Mantener proporción (aspect ratio)
                                    </Label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label htmlFor="percentage-input">Porcentaje del tamaño original</Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        id="percentage-input"
                                        type="number"
                                        value={percentage}
                                        onChange={e => setPercentage(e.target.value)}
                                        className="bg-black/20 border-white/10 w-32"
                                        min="1"
                                        max="200"
                                    />
                                    <span className="text-muted-foreground">%</span>
                                    <span className="text-xs text-muted-foreground">
                                        {percentage < 100 ? `Reducción del ${100 - percentage}%` : percentage > 100 ? `Aumento del ${percentage - 100}%` : "Sin cambio"}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div className="space-y-1.5">
                                <Label>Formato de salida</Label>
                                <Select value={outputFormat} onValueChange={setOutputFormat}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEBP">WebP (recomendado)</SelectItem>
                                        <SelectItem value="JPEG">JPEG</SelectItem>
                                        <SelectItem value="PNG">PNG (sin pérdida)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {outputFormat !== "PNG" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="quality-input">Calidad ({quality}%)</Label>
                                    <Input
                                        id="quality-input"
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={quality}
                                        onChange={e => setQuality(e.target.value)}
                                        className="accent-primary h-2 mt-3"
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Upload */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardContent className="pt-6">
                        <div
                            className={`drop-zone text-center cursor-pointer transition-all ${dragging ? "dragging" : ""}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById("image-resizer-input").click()}
                        >
                            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-medium">Arrastra imágenes aquí o haz clic para seleccionar</p>
                            <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WebP, GIF — hasta 10 imágenes, 10MB cada una</p>
                            <input
                                id="image-resizer-input"
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>

                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                        <span className="text-sm truncate flex-1">{file.name}</span>
                                        <span className="text-xs text-muted-foreground mx-3">{formatSize(file.size)}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(i)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    onClick={resize}
                                    disabled={loading}
                                    className="w-full h-11 font-semibold mt-2 glow-accent"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Redimensionando...</>
                                    ) : (
                                        <><Scaling className="w-5 h-5 mr-2" />Redimensionar {files.length} imagen(es)</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                {resizedImages.length > 0 && (
                    <Card className="bg-card/40 backdrop-blur-md border-white/5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Resultados</CardTitle>
                                {resizedImages.some(r => r.success) && (
                                    <Button size="sm" onClick={downloadAll}>
                                        <Download className="w-4 h-4 mr-2" />
                                        Descargar todo
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {resizedImages.map((img, i) => (
                                <div key={i} className={`p-4 rounded-xl border ${img.success ? "bg-muted/30 border-white/5" : "bg-destructive/10 border-destructive/30"}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {img.success
                                                ? <Check className="w-5 h-5 text-primary shrink-0" />
                                                : <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                                            }
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{img.original_name}</p>
                                                {img.success ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        {img.original_size} → <span className="text-primary font-medium">{img.new_size}</span>
                                                        {" · "}{formatSize(img.size_bytes)} · {img.format}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-destructive">{img.error}</p>
                                                )}
                                            </div>
                                        </div>
                                        {img.success && (
                                            <Button variant="ghost" size="icon" onClick={() => downloadSingle(img)} title="Descargar">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
