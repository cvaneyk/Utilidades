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
    const [targetFormat, setTargetFormat] = useState("mp4");
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

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Flujo asíncrono con jobs: cada petición HTTP es corta, así ningún proxy
    // intermedio (Traefik, Cloudflare...) corta la conexión durante conversiones largas.
    const convert = async () => {
        if (!file) {
            toast.error("Selecciona un vídeo primero");
            return;
        }
        setPhase("uploading");
        setUploadProgress(0);
        const headers = apiKey ? { "X-API-Key": apiKey } : {};
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("quality", quality);
            formData.append("target_format", targetFormat);

            const created = await axios.post(`${API}/video/convert/async`, formData, {
                headers,
                timeout: 0,
                onUploadProgress: (e) => {
                    if (!e.total) return;
                    setUploadProgress(Math.round((e.loaded * 100) / e.total));
                },
            });
            const jobId = created.data.job_id;
            setPhase("converting");

            const startedAt = Date.now();
            const maxWaitMs = 20 * 60 * 1000;
            for (;;) {
                await sleep(3000);
                const { data: job } = await axios.get(`${API}/video/jobs/${jobId}`, { headers });
                if (job.status === "done") break;
                if (job.status === "error") {
                    throw new Error(job.detail || "La conversión falló en el servidor");
                }
                if (Date.now() - startedAt > maxWaitMs) {
                    throw new Error("La conversión tardó demasiado y se canceló la espera");
                }
            }

            const download = await axios.get(`${API}/video/jobs/${jobId}/download`, {
                headers,
                responseType: "blob",
                timeout: 0,
            });
            const outName = file.name.replace(/\.[^.]+$/, "") + "." + targetFormat;
            saveAs(download.data, outName);
            setLastResult({ name: outName, size: download.data.size });
            setPhase("done");
            toast.success(`¡Vídeo convertido a ${targetFormat.toUpperCase()}!`);
        } catch (error) {
            setPhase("idle");
            let detail = error.message || "Error al convertir el vídeo";
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
    const curlSnippet = `# Opción A — síncrono (vídeos cortos; la respuesta es el vídeo convertido):
curl -X POST ${window.location.origin}/api/video/convert \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "file=@video.mov" -F "quality=balanced" -F "target_format=mp4" -o video.mp4

# Opción B — asíncrono (recomendado para vídeos largos):
curl -X POST ${window.location.origin}/api/video/convert/async \\
  -H "X-API-Key: TU_API_KEY" \\
  -F "file=@video.mov" -F "quality=balanced" -F "target_format=webm"
# → {"job_id": "abc123", "status": "processing"}

curl -H "X-API-Key: TU_API_KEY" ${window.location.origin}/api/video/jobs/abc123
# → {"status": "done", ...}  (repetir hasta que sea "done")

curl -H "X-API-Key: TU_API_KEY" \\
  ${window.location.origin}/api/video/jobs/abc123/download -o video.webm

# target_format acepta "mp4" (H.264 + AAC) o "webm" (VP9 + Opus). Por defecto: mp4.`;

    return (
        <div className="animate-in space-y-6">
            <div className="flex items-center gap-3 mb-8 mt-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-400 flex items-center justify-center">
                    <Film className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Conversor de Vídeo</h1>
                    <p className="text-muted-foreground">Convierte entre MOV, MP4, AVI, MKV y WebM</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Settings */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Configuración</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>Formato de salida</Label>
                                <Select value={targetFormat} onValueChange={setTargetFormat}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mp4">MP4 (H.264 + AAC)</SelectItem>
                                        <SelectItem value="webm">WebM (VP9 + Opus)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                            <p className="text-sm text-muted-foreground mt-1">MOV, MP4, AVI, MKV, WebM — hasta {maxSizeMb}MB · salida en MP4 o WebM</p>
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
                                        <><Download className="w-5 h-5 mr-2" />Convertir a {targetFormat.toUpperCase()}</>
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
                            Hay dos modos: <span className="text-foreground">síncrono</span> (la respuesta es directamente el vídeo convertido — solo para vídeos cortos, los proxies suelen cortar peticiones de varios minutos) y <span className="text-foreground">asíncrono</span> (devuelve un <code className="text-primary">job_id</code>, consultas el estado y descargas al terminar — recomendado). El campo <code className="text-primary">target_format</code> (<code className="text-primary">mp4</code> o <code className="text-primary">webm</code>) es opcional, por defecto <code className="text-primary">mp4</code>.
                            {authRequired && " Este servidor requiere el header X-API-Key."}
                        </p>
                        <pre className="p-4 bg-black/30 rounded-lg text-xs overflow-x-auto border border-white/5">
                            <code>{curlSnippet}</code>
                        </pre>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">En n8n (flujo asíncrono recomendado):</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs">
                                <li><strong>HTTP Request 1:</strong> <code>POST {window.location.origin}/api/video/convert/async</code> — header <code>X-API-Key</code>, body <code>Form-Data</code> con campo binario <code>file</code> y campo <code>target_format</code> (<code>mp4</code>/<code>webm</code>) → devuelve <code>job_id</code></li>
                                <li><strong>Wait</strong> (ej. 10s) + <strong>HTTP Request 2:</strong> <code>GET .../api/video/jobs/{"{{job_id}}"}</code> — repite (nodo If en loop) hasta que <code>status</code> sea <code>done</code></li>
                                <li><strong>HTTP Request 3:</strong> <code>GET .../api/video/jobs/{"{{job_id}}"}/download</code> — Response format <code>File</code> → recibes el vídeo convertido</li>
                                <li>Para vídeos cortos puedes usar directamente <code>POST /api/video/convert</code> (síncrono, respuesta = vídeo convertido)</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
