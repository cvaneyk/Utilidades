import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Film, Upload, Download, X, Loader2, KeyRound, Terminal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { saveAs } from "file-saver";
import config from "@/config";

const API = config.API_URL;
const MAX_SIZE_MB_DEFAULT = 200;
const ACCEPT_EXTENSIONS = ".mov,.qt,.mp4,.m4v,.avi,.mkv,.webm";

export default function VideoConverter() {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [quality, setQuality] = useState("balanced");
    const [apiKey, setApiKey] = useState(() => localStorage.getItem("convert_api_key") || "");
    const [authRequired, setAuthRequired] = useState(false);
    const [maxSizeMb, setMaxSizeMb] = useState(MAX_SIZE_MB_DEFAULT);
    const [phase, setPhase] = useState("idle"); // idle | uploading | converting | done
    const [uploadProgress, setUploadProgress] = useState(0);
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        axios.get(`${API}/video/health`)
            .then(res => {
                setAuthRequired(!!res.data.auth_required);
                if (res.data.max_size_mb) setMaxSizeMb(res.data.max_size_mb);
                if (!res.data.ffmpeg) toast.warning("El servidor no tiene ffmpeg instalado — la conversión no funcionará");
            })
            .catch(() => {});
    }, []);

    const saveApiKey = (value) => {
        setApiKey(value);
        localStorage.setItem("convert_api_key", value);
    };

    const acceptFile = useCallback((candidate) => {
        if (!candidate) return;
        const ext = "." + (candidate.name.split(".").pop() || "").toLowerCase();
        if (!ACCEPT_EXTENSIONS.split(",").includes(ext)) {
            toast.error(`Formato no soportado. Usa: ${ACCEPT_EXTENSIONS.replaceAll(",", ", ")}`);
            return;
        }
        if (candidate.size > maxSizeMb * 1024 * 1024) {
            toast.error(`El archivo supera el máximo de ${maxSizeMb}MB`);
            return;
        }
        setFile(candidate);
        setLastResult(null);
    }, [maxSizeMb]);

    const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
    const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragging(false); }, []);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        acceptFile(e.dataTransfer.files?.[0]);
    }, [acceptFile]);

    const convert = async () => {
        if (!file) {
            toast.error("Selecciona un vídeo primero");
            return;
        }
        setPhase("uploading");
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("quality", quality);

            const response = await axios.post(`${API}/video/convert`, formData, {
                headers: apiKey ? { "X-API-Key": apiKey } : {},
                responseType: "blob",
                timeout: 0,
                onUploadProgress: (e) => {
                    if (!e.total) return;
                    const pct = Math.round((e.loaded * 100) / e.total);
                    setUploadProgress(pct);
                    if (e.loaded === e.total) setPhase("converting");
                },
            });

            const outName = file.name.replace(/\.[^.]+$/, "") + ".mp4";
            saveAs(response.data, outName);
            setLastResult({ name: outName, size: response.data.size });
            setPhase("done");
            toast.success("¡Vídeo convertido a MP4!");
        } catch (error) {
            setPhase("idle");
            let detail = "Error al convertir el vídeo";
            if (error.response?.data instanceof Blob) {
                try {
                    detail = JSON.parse(await error.response.data.text()).detail || detail;
                } catch { /* body no es JSON */ }
            } else if (error.response?.data?.detail) {
                detail = error.response.data.detail;
            }
            if (error.response?.status === 401) {
                toast.error("API key inválida o no proporcionada");
            } else {
                toast.error(detail);
            }
        }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const busy = phase === "uploading" || phase === "converting";
    const curlSnippet = `curl -X POST ${window.location.origin}/api/video/convert \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "file=@video.mov" \\
  -F "quality=balanced" \\
  -o video.mp4`;

    return (
        <div className="animate-in space-y-6">
            <div className="flex items-center gap-3 mb-8 mt-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-400 flex items-center justify-center">
                    <Film className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">MOV a MP4</h1>
                    <p className="text-muted-foreground">Convierte vídeos QuickTime (.mov) a MP4 compatible con todo</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Settings */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Configuración</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Calidad</Label>
                                <Select value={quality} onValueChange={setQuality}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fast">Rápida (archivo más grande)</SelectItem>
                                        <SelectItem value="balanced">Equilibrada (recomendado)</SelectItem>
                                        <SelectItem value="quality">Máxima calidad (más lenta)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="api-key-input" className="flex items-center gap-1.5">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    API Key
                                    {!authRequired && <span className="text-xs text-muted-foreground ml-1">(no requerida en este servidor)</span>}
                                </Label>
                                <Input
                                    id="api-key-input"
                                    type="password"
                                    placeholder={authRequired ? "Requerida para convertir" : "Opcional"}
                                    value={apiKey}
                                    onChange={e => saveApiKey(e.target.value)}
                                    className="bg-black/20 border-white/10"
                                />
                            </div>
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
                            onClick={() => document.getElementById("video-converter-input").click()}
                        >
                            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="font-medium">Arrastra un vídeo aquí o haz clic para seleccionar</p>
                            <p className="text-sm text-muted-foreground mt-1">MOV, MP4, AVI, MKV, WebM — hasta {maxSizeMb}MB</p>
                            <input
                                id="video-converter-input"
                                type="file"
                                accept={ACCEPT_EXTENSIONS}
                                className="hidden"
                                onChange={e => acceptFile(e.target.files?.[0])}
                            />
                        </div>

                        {file && (
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <span className="text-sm truncate flex-1">{file.name}</span>
                                    <span className="text-xs text-muted-foreground mx-3">{formatSize(file.size)}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => setFile(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>

                                {phase === "uploading" && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Subiendo vídeo...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <Progress value={uploadProgress} className="h-2" />
                                    </div>
                                )}
                                {phase === "converting" && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        Convirtiendo con ffmpeg... esto puede tardar varios minutos según el tamaño
                                    </div>
                                )}
                                {phase === "done" && lastResult && (
                                    <div className="flex items-center gap-2 text-sm p-3 bg-muted/30 rounded-lg border border-primary/20">
                                        <Check className="w-4 h-4 text-primary" />
                                        <span className="truncate flex-1">{lastResult.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatSize(lastResult.size)} · descargado</span>
                                    </div>
                                )}

                                <Button onClick={convert} disabled={busy} className="w-full h-11 font-semibold glow-accent">
                                    {busy ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{phase === "uploading" ? "Subiendo..." : "Convirtiendo..."}</>
                                    ) : (
                                        <><Download className="w-5 h-5 mr-2" />Convertir a MP4</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* API usage */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            Uso desde la API (n8n, curl...)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Endpoint síncrono: envía el vídeo por <code className="text-primary">POST multipart</code> y la respuesta es directamente el archivo MP4.
                            {authRequired && " Este servidor requiere el header X-API-Key."}
                        </p>
                        <pre className="p-4 bg-black/30 rounded-lg text-xs overflow-x-auto border border-white/5">
                            <code>{curlSnippet}</code>
                        </pre>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">En n8n (nodo HTTP Request):</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs">
                                <li>Method: <code>POST</code> — URL: <code>{window.location.origin}/api/video/convert</code></li>
                                <li>Header: <code>X-API-Key</code> con tu clave{!authRequired && " (si está configurada)"}</li>
                                <li>Body: <code>Form-Data</code> → campo <code>file</code> de tipo binario + campo <code>quality</code> (fast / balanced / quality)</li>
                                <li>Response format: <code>File</code> — recibirás el MP4 como binario</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
