from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response, Form, Header, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
import io
import base64
from PIL import Image
import shortuuid
import string
import secrets
import re
import httpx
import asyncio
import shutil
import tempfile

ROOT_DIR = Path(__file__).parent

# is.gd API helper
async def shorten_with_isgd(url: str) -> dict:
    """Shorten URL using is.gd API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://is.gd/create.php",
                params={"format": "json", "url": url},
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                if "shorturl" in data:
                    return {"success": True, "short_url": data["shorturl"]}
                else:
                    return {"success": False, "error": data.get("errormessage", "Unknown error")}
            return {"success": False, "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
load_dotenv(ROOT_DIR / '.env')

# Video converter config
CONVERT_API_KEY = os.environ.get("CONVERT_API_KEY", "")
MAX_VIDEO_SIZE_MB = int(os.environ.get("MAX_VIDEO_SIZE_MB", "200"))
VIDEO_TIMEOUT_SECONDS = int(os.environ.get("VIDEO_TIMEOUT_SECONDS", "600"))
VIDEO_JOB_TTL_SECONDS = int(os.environ.get("VIDEO_JOB_TTL_SECONDS", "3600"))

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# QR Code Models
class QRCodeItem(BaseModel):
    content: str
    content_type: str = "url"  # url, text, email, phone, wifi

class QRCodeRequest(BaseModel):
    items: List[QRCodeItem]  # Support multiple QR codes
    fg_color: str = "#000000"
    bg_color: str = "#FFFFFF"
    size: int = 300
    use_isgd: bool = True  # Use is.gd for URL shortening

class QRCodeResultItem(BaseModel):
    original_content: str
    final_content: str
    image_base64: str
    success: bool
    error: Optional[str] = None

class QRCodeResponse(BaseModel):
    results: List[QRCodeResultItem]

# Shortlink Models
class ShortlinkCreate(BaseModel):
    urls: List[str]  # Support multiple URLs
    use_isgd: bool = True  # Use is.gd API

class ShortlinkItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    original_url: str
    short_url: str
    short_code: str
    provider: str  # "isgd" or "local"
    clicks: int = 0
    created_at: str

class Shortlink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    original_url: str
    short_code: str
    short_url: Optional[str] = None
    provider: str = "local"
    clicks: int = 0
    created_at: str

# Text to HTML Models
class TextToHTMLRequest(BaseModel):
    text: str
    format_type: str = "basic"  # basic, markdown

class TextToHTMLResponse(BaseModel):
    html: str

# Password Generator Models
class PasswordRequest(BaseModel):
    length: int = 16
    uppercase: bool = True
    lowercase: bool = True
    numbers: bool = True
    symbols: bool = True

class PasswordResponse(BaseModel):
    password: str
    strength: str

# Word Counter Models
class WordCountRequest(BaseModel):
    text: str

class WordCountResponse(BaseModel):
    characters: int
    characters_no_spaces: int
    words: int
    sentences: int
    paragraphs: int
    reading_time_minutes: float

# Base64 Models
class Base64Request(BaseModel):
    text: str
    operation: str = "encode"  # encode or decode

class Base64Response(BaseModel):
    result: str
    success: bool
    error: Optional[str] = None

# Image Resize JSON Model
class ResizeBase64Request(BaseModel):
    image_base64: str
    width: Optional[int] = None
    height: Optional[int] = None
    percentage: Optional[int] = None
    quality: int = 85
    output_format: str = "WEBP"

# ============== ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "E1 Utility Suite API"}

# Status endpoints
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# ============== QR CODE ==============

@api_router.post("/qr/generate", response_model=QRCodeResponse)
async def generate_qr_codes(request: QRCodeRequest):
    results = []
    
    for item in request.items:
        try:
            # Prepare content based on type
            content = item.content
            final_content = content
            
            if item.content_type == "email":
                final_content = f"mailto:{content}"
            elif item.content_type == "phone":
                final_content = f"tel:{content}"
            elif item.content_type == "wifi":
                # Expected format: SSID,password,encryption(WPA/WEP/nopass)
                parts = content.split(",")
                if len(parts) >= 2:
                    ssid = parts[0]
                    password = parts[1] if len(parts) > 1 else ""
                    encryption = parts[2] if len(parts) > 2 else "WPA"
                    final_content = f"WIFI:T:{encryption};S:{ssid};P:{password};;"
            elif item.content_type == "url" and request.use_isgd:
                # Shorten URL with is.gd first
                isgd_result = await shorten_with_isgd(content)
                if isgd_result["success"]:
                    final_content = isgd_result["short_url"]
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=4,
            )
            qr.add_data(final_content)
            qr.make(fit=True)
            
            # Create image with colors
            img = qr.make_image(fill_color=request.fg_color, back_color=request.bg_color)
            
            # Resize to requested size
            img = img.resize((request.size, request.size), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            results.append(QRCodeResultItem(
                original_content=content,
                final_content=final_content,
                image_base64=img_base64,
                success=True
            ))
        except Exception as e:
            results.append(QRCodeResultItem(
                original_content=item.content,
                final_content="",
                image_base64="",
                success=False,
                error=str(e)
            ))
    
    return QRCodeResponse(results=results)

# ============== SHORTLINKS ==============

class ShortlinkCreateResponse(BaseModel):
    results: List[Shortlink]
    success_count: int
    error_count: int

@api_router.post("/shortlinks/create", response_model=ShortlinkCreateResponse)
async def create_shortlinks(request: ShortlinkCreate):
    results = []
    success_count = 0
    error_count = 0
    
    for url in request.urls:
        try:
            # Validate URL
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                if not parsed.scheme or not parsed.netloc:
                    raise ValueError("Invalid URL")
            except:
                error_count += 1
                continue
            
            shortlink_id = str(uuid.uuid4())
            created_at = datetime.now(timezone.utc).isoformat()
            
            if request.use_isgd:
                # Use is.gd API
                isgd_result = await shorten_with_isgd(url)
                if isgd_result["success"]:
                    short_url = isgd_result["short_url"]
                    short_code = short_url.split("/")[-1]
                    provider = "isgd"
                else:
                    # Fallback to local
                    short_code = shortuuid.uuid()[:7]
                    short_url = None
                    provider = "local"
            else:
                # Local shortlink
                short_code = shortuuid.uuid()[:7]
                short_url = None
                provider = "local"
            
            # Save to database
            shortlink_doc = {
                "id": shortlink_id,
                "original_url": url,
                "short_code": short_code,
                "short_url": short_url,
                "provider": provider,
                "clicks": 0,
                "created_at": created_at
            }
            
            await db.shortlinks.insert_one(shortlink_doc)
            
            results.append(Shortlink(
                id=shortlink_id,
                original_url=url,
                short_code=short_code,
                short_url=short_url,
                provider=provider,
                clicks=0,
                created_at=created_at
            ))
            success_count += 1
            
        except Exception as e:
            error_count += 1
            continue
    
    return ShortlinkCreateResponse(
        results=results,
        success_count=success_count,
        error_count=error_count
    )

@api_router.get("/shortlinks", response_model=List[Shortlink])
async def get_shortlinks():
    shortlinks = await db.shortlinks.find({}, {"_id": 0}).to_list(100)
    return [Shortlink(**sl) for sl in shortlinks]

@api_router.get("/shortlinks/{short_code}")
async def redirect_shortlink(short_code: str):
    shortlink = await db.shortlinks.find_one({"short_code": short_code})
    if not shortlink:
        raise HTTPException(status_code=404, detail="Shortlink not found")
    
    # Increment clicks
    await db.shortlinks.update_one(
        {"short_code": short_code},
        {"$inc": {"clicks": 1}}
    )
    
    return {"original_url": shortlink["original_url"]}

@api_router.delete("/shortlinks/{shortlink_id}")
async def delete_shortlink(shortlink_id: str):
    result = await db.shortlinks.delete_one({"id": shortlink_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shortlink not found")
    return {"message": "Shortlink deleted"}

# ============== IMAGE CONVERTER ==============

@api_router.post("/images/convert-to-webp")
async def convert_images_to_webp(files: List[UploadFile] = File(...)):
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed per batch")
    
    converted_images = []
    
    for file in files:
        try:
            # Check file size (10MB limit)
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                converted_images.append({
                    "original_name": file.filename,
                    "success": False,
                    "error": "File exceeds 10MB limit"
                })
                continue
            
            # Open image
            image = Image.open(io.BytesIO(content))
            
            # Preserve transparency: WebP natively supports RGBA/LA
            # Only convert to RGB if there is no alpha channel
            if image.mode == 'P':
                image = image.convert('RGBA')  # palette → RGBA (keeps transparency)
            elif image.mode not in ('RGB', 'RGBA', 'LA'):
                image = image.convert('RGB')
            
            # Save as WebP — RGBA images keep transparent background
            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=75)
            buffer.seek(0)
            
            # Convert to base64
            webp_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            original_name = file.filename or "image"
            new_name = os.path.splitext(original_name)[0] + ".webp"
            
            converted_images.append({
                "original_name": original_name,
                "new_name": new_name,
                "success": True,
                "webp_base64": webp_base64,
                "size_bytes": len(buffer.getvalue())
            })
            
        except Exception as e:
            converted_images.append({
                "original_name": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {"images": converted_images}

# ============== IMAGE RESIZER ==============

def _resize_image_bytes(content: bytes, width, height, percentage, quality, output_format) -> dict:
    image = Image.open(io.BytesIO(content))
    original_width, original_height = image.size

    if percentage:
        new_width = int(original_width * percentage / 100)
        new_height = int(original_height * percentage / 100)
    elif width and height:
        new_width, new_height = width, height
    elif width:
        ratio = width / original_width
        new_width = width
        new_height = int(original_height * ratio)
    else:
        ratio = height / original_height
        new_width = int(original_width * ratio)
        new_height = height

    image = image.resize((new_width, new_height), Image.LANCZOS)

    if output_format == "JPEG" and image.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "P":
            image = image.convert("RGBA")
        background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
        image = background
    elif image.mode == "P":
        image = image.convert("RGBA")

    buffer = io.BytesIO()
    save_kwargs = {"format": output_format}
    if output_format != "PNG":
        save_kwargs["quality"] = quality
    image.save(buffer, **save_kwargs)
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return {
        "img_base64": img_base64,
        "original_size": f"{original_width}x{original_height}",
        "new_size": f"{new_width}x{new_height}",
        "size_bytes": len(buffer.getvalue()),
        "format": output_format,
    }


@api_router.post("/images/resize")
async def resize_images(
    files: List[UploadFile] = File(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    percentage: Optional[int] = Form(None),
    quality: int = Form(85),
    output_format: str = Form("WEBP")
):
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed per batch")
    if output_format not in ("WEBP", "JPEG", "PNG"):
        raise HTTPException(status_code=400, detail="Format must be WEBP, JPEG, or PNG")
    if not (width or height or percentage):
        raise HTTPException(status_code=400, detail="Provide width, height, or percentage")

    resized_images = []

    for file in files:
        try:
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                resized_images.append({
                    "original_name": file.filename,
                    "success": False,
                    "error": "File exceeds 10MB limit"
                })
                continue

            result = _resize_image_bytes(content, width, height, percentage, quality, output_format)
            ext = output_format.lower().replace("jpeg", "jpg")
            original_name = file.filename or "image"
            new_name = os.path.splitext(original_name)[0] + f".{ext}"

            resized_images.append({
                "original_name": original_name,
                "new_name": new_name,
                "success": True,
                **result,
            })

        except Exception as e:
            resized_images.append({
                "original_name": file.filename,
                "success": False,
                "error": str(e)
            })

    return {"images": resized_images}


@api_router.post("/images/resize-base64")
async def resize_image_base64(req: ResizeBase64Request):
    if req.output_format not in ("WEBP", "JPEG", "PNG"):
        raise HTTPException(status_code=400, detail="Format must be WEBP, JPEG, or PNG")
    if not (req.width or req.height or req.percentage):
        raise HTTPException(status_code=400, detail="Provide width, height, or percentage")

    try:
        content = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    try:
        result = _resize_image_bytes(content, req.width, req.height, req.percentage, req.quality, req.output_format)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

# ============== TEXT TO HTML ==============


@api_router.post("/text-to-html", response_model=TextToHTMLResponse)
async def convert_text_to_html(request: TextToHTMLRequest):
    text = request.text
    
    if request.format_type == "markdown":
        # Simple markdown conversion
        html = text
        
        # Headers
        html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        
        # Bold and italic
        html = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', html)
        html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
        html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
        
        # Code blocks
        html = re.sub(r'```(.+?)```', r'<pre><code>\1</code></pre>', html, flags=re.DOTALL)
        html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)
        
        # Links
        html = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', html)
        
        # Lists
        lines = html.split('\n')
        in_list = False
        new_lines = []
        for line in lines:
            if line.strip().startswith('- '):
                if not in_list:
                    new_lines.append('<ul>')
                    in_list = True
                new_lines.append(f'<li>{line.strip()[2:]}</li>')
            else:
                if in_list:
                    new_lines.append('</ul>')
                    in_list = False
                new_lines.append(line)
        if in_list:
            new_lines.append('</ul>')
        html = '\n'.join(new_lines)
        
        # Paragraphs
        paragraphs = html.split('\n\n')
        html = ''.join([f'<p>{p}</p>' if not p.startswith('<') else p for p in paragraphs if p.strip()])
        
    else:
        # Basic conversion - escape HTML and preserve formatting
        html = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        html = html.replace('\n\n', '</p><p>')
        html = html.replace('\n', '<br>')
        html = f'<p>{html}</p>'
    
    return TextToHTMLResponse(html=html)

# ============== PASSWORD GENERATOR ==============

@api_router.post("/password/generate", response_model=PasswordResponse)
async def generate_password(request: PasswordRequest):
    characters = ""
    
    if request.lowercase:
        characters += string.ascii_lowercase
    if request.uppercase:
        characters += string.ascii_uppercase
    if request.numbers:
        characters += string.digits
    if request.symbols:
        characters += "!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    if not characters:
        raise HTTPException(status_code=400, detail="At least one character type must be selected")
    
    length = max(4, min(128, request.length))
    password = ''.join(secrets.choice(characters) for _ in range(length))
    
    # Calculate strength
    strength_score = 0
    if request.lowercase:
        strength_score += 1
    if request.uppercase:
        strength_score += 1
    if request.numbers:
        strength_score += 1
    if request.symbols:
        strength_score += 1
    
    if length >= 16:
        strength_score += 2
    elif length >= 12:
        strength_score += 1
    
    if strength_score >= 5:
        strength = "strong"
    elif strength_score >= 3:
        strength = "medium"
    else:
        strength = "weak"
    
    return PasswordResponse(password=password, strength=strength)

# ============== WORD COUNTER ==============

@api_router.post("/word-counter", response_model=WordCountResponse)
async def count_words(request: WordCountRequest):
    text = request.text
    
    # Characters
    characters = len(text)
    characters_no_spaces = len(text.replace(' ', '').replace('\n', '').replace('\t', ''))
    
    # Words
    words = len(text.split()) if text.strip() else 0
    
    # Sentences (rough estimate)
    sentences = len(re.findall(r'[.!?]+', text)) or (1 if text.strip() else 0)
    
    # Paragraphs
    paragraphs = len([p for p in text.split('\n\n') if p.strip()]) or (1 if text.strip() else 0)
    
    # Reading time (average 200 words per minute)
    reading_time_minutes = round(words / 200, 2)
    
    return WordCountResponse(
        characters=characters,
        characters_no_spaces=characters_no_spaces,
        words=words,
        sentences=sentences,
        paragraphs=paragraphs,
        reading_time_minutes=reading_time_minutes
    )

# ============== BASE64 ==============

@api_router.post("/base64", response_model=Base64Response)
async def process_base64(request: Base64Request):
    try:
        if request.operation == "encode":
            result = base64.b64encode(request.text.encode()).decode()
            return Base64Response(result=result, success=True)
        elif request.operation == "decode":
            result = base64.b64decode(request.text).decode()
            return Base64Response(result=result, success=True)
        else:
            return Base64Response(result="", success=False, error="Invalid operation")
    except Exception as e:
        return Base64Response(result="", success=False, error=str(e))

# ============== VIDEO CONVERTER ==============

VIDEO_ALLOWED_EXTENSIONS = {".mov", ".qt", ".mp4", ".m4v", ".avi", ".mkv", ".webm"}
VIDEO_OUTPUT_FORMATS = {
    "mp4": {
        "ext": ".mp4",
        "media_type": "video/mp4",
        "video_codec": ["-c:v", "libx264"],
        "video_extra": ["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
        "audio_codec": ["-c:a", "aac", "-b:a", "128k"],
        "presets": {
            "fast": ["-preset", "veryfast", "-crf", "26"],
            "balanced": ["-preset", "medium", "-crf", "23"],
            "quality": ["-preset", "slow", "-crf", "20"],
        },
    },
    "webm": {
        "ext": ".webm",
        "media_type": "video/webm",
        "video_codec": ["-c:v", "libvpx-vp9"],
        "video_extra": ["-b:v", "0"],
        "audio_codec": ["-c:a", "libopus", "-b:a", "128k"],
        "presets": {
            "fast": ["-crf", "36", "-deadline", "realtime", "-cpu-used", "5"],
            "balanced": ["-crf", "32", "-deadline", "good", "-cpu-used", "2"],
            "quality": ["-crf", "28", "-deadline", "good", "-cpu-used", "0"],
        },
    },
}

def require_convert_key(x_api_key: Optional[str] = Header(None)):
    if CONVERT_API_KEY:
        if not x_api_key or not secrets.compare_digest(x_api_key, CONVERT_API_KEY):
            raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")

@api_router.get("/video/health")
async def video_health():
    return {
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "auth_required": bool(CONVERT_API_KEY),
        "max_size_mb": MAX_VIDEO_SIZE_MB,
    }

# In-memory job store for async conversions. The backend runs as a single
# uvicorn worker, so a dict is safe here.
VIDEO_JOBS = {}

def _purge_video_jobs():
    now = datetime.now(timezone.utc).timestamp()
    for job_id in list(VIDEO_JOBS.keys()):
        job = VIDEO_JOBS[job_id]
        if now - job["created_at"] > VIDEO_JOB_TTL_SECONDS:
            shutil.rmtree(job["tmpdir"], ignore_errors=True)
            VIDEO_JOBS.pop(job_id, None)

async def _save_video_upload(file: UploadFile, target_format: str):
    """Validate and stream the upload to a temp dir. Returns (tmpdir, in_path, out_name)."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in VIDEO_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(VIDEO_ALLOWED_EXTENSIONS))}"
        )
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=503, detail="ffmpeg is not installed on the server")

    tmpdir = tempfile.mkdtemp(prefix="vidconv_")
    in_path = os.path.join(tmpdir, f"input{ext}")
    max_bytes = MAX_VIDEO_SIZE_MB * 1024 * 1024
    try:
        total = 0
        with open(in_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {MAX_VIDEO_SIZE_MB}MB"
                    )
                f.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="Empty file")
    except Exception:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise

    out_name = os.path.splitext(os.path.basename(file.filename or "video"))[0] + VIDEO_OUTPUT_FORMATS[target_format]["ext"]
    return tmpdir, in_path, out_name

async def _run_ffmpeg_convert(in_path: str, out_path: str, quality: str, target_format: str):
    """Run ffmpeg. Raises HTTPException on timeout or failure."""
    fmt = VIDEO_OUTPUT_FORMATS[target_format]
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", in_path,
        *fmt["video_codec"], *fmt["presets"][quality], *fmt["video_extra"],
        *fmt["audio_codec"],
        out_path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=VIDEO_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise HTTPException(
            status_code=504,
            detail=f"Conversion timed out after {VIDEO_TIMEOUT_SECONDS}s"
        )
    if proc.returncode != 0:
        raise HTTPException(
            status_code=422,
            detail=f"ffmpeg failed: {stderr.decode(errors='replace')[-500:]}"
        )

async def _run_video_job(job_id: str):
    job = VIDEO_JOBS.get(job_id)
    if not job:
        return
    try:
        await _run_ffmpeg_convert(job["in_path"], job["out_path"], job["quality"], job["target_format"])
        job["status"] = "done"
    except HTTPException as e:
        job["status"] = "error"
        job["detail"] = e.detail
    except Exception as e:
        job["status"] = "error"
        job["detail"] = str(e)

def _validate_video_params(quality: str, target_format: str):
    if target_format not in VIDEO_OUTPUT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Invalid format. Allowed: {', '.join(VIDEO_OUTPUT_FORMATS)}")
    if quality not in VIDEO_OUTPUT_FORMATS[target_format]["presets"]:
        raise HTTPException(status_code=400, detail=f"Invalid quality. Allowed: {', '.join(VIDEO_OUTPUT_FORMATS[target_format]['presets'])}")

@api_router.post("/video/convert", dependencies=[Depends(require_convert_key)])
async def convert_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: str = Form("balanced"),
    target_format: str = Form("mp4"),
):
    """Synchronous conversion: returns the converted video binary in the same request.
    Best for short videos or clients behind proxies with generous timeouts."""
    _validate_video_params(quality, target_format)
    fmt = VIDEO_OUTPUT_FORMATS[target_format]
    tmpdir, in_path, out_name = await _save_video_upload(file, target_format)
    out_path = os.path.join(tmpdir, f"output{fmt['ext']}")
    try:
        await _run_ffmpeg_convert(in_path, out_path, quality, target_format)
    except Exception:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise
    background_tasks.add_task(shutil.rmtree, tmpdir, ignore_errors=True)
    return FileResponse(out_path, media_type=fmt["media_type"], filename=out_name)

@api_router.post("/video/convert/async", dependencies=[Depends(require_convert_key)])
async def convert_video_async(
    file: UploadFile = File(...),
    quality: str = Form("balanced"),
    target_format: str = Form("mp4"),
):
    """Async conversion: returns a job_id immediately. Poll /video/jobs/{id} and
    download from /video/jobs/{id}/download when done. Each request is short-lived,
    so intermediate proxies (Traefik, Cloudflare) never time out."""
    _validate_video_params(quality, target_format)
    fmt = VIDEO_OUTPUT_FORMATS[target_format]
    _purge_video_jobs()
    tmpdir, in_path, out_name = await _save_video_upload(file, target_format)
    job_id = uuid.uuid4().hex
    VIDEO_JOBS[job_id] = {
        "status": "processing",
        "detail": None,
        "tmpdir": tmpdir,
        "in_path": in_path,
        "out_path": os.path.join(tmpdir, f"output{fmt['ext']}"),
        "out_name": out_name,
        "quality": quality,
        "target_format": target_format,
        "media_type": fmt["media_type"],
        "created_at": datetime.now(timezone.utc).timestamp(),
    }
    asyncio.create_task(_run_video_job(job_id))
    return {"job_id": job_id, "status": "processing"}

@api_router.get("/video/jobs/{job_id}", dependencies=[Depends(require_convert_key)])
async def video_job_status(job_id: str):
    job = VIDEO_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return {"job_id": job_id, "status": job["status"], "detail": job["detail"], "filename": job["out_name"]}

@api_router.get("/video/jobs/{job_id}/download", dependencies=[Depends(require_convert_key)])
async def video_job_download(job_id: str):
    job = VIDEO_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    if job["status"] == "error":
        raise HTTPException(status_code=422, detail=job["detail"] or "Conversion failed")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Conversion still in progress")
    return FileResponse(job["out_path"], media_type=job["media_type"], filename=job["out_name"])

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
