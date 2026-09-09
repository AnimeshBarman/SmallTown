import os
import io
import uuid
from fastapi import UploadFile, HTTPException
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
# SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials missing in .env..!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
BUCKET_NAME = "property-images"

ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE_MB = 2 * 1024 * 1024  

async def process_and_upload_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail="File too large. Max 2MB allowed per image.")

    try:
        image = Image.open(io.BytesIO(file_bytes))
        
        # Convert to RGBA
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        
        # Image Resizing
        max_width = 1024
        if image.width > max_width:
            ratio = max_width / float(image.width)
            new_height = int((float(image.height) * float(ratio)))
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

        # Extreme Compression in WebP format
        output_io = io.BytesIO()
        image.save(output_io, format="WEBP", quality=75, method=6)
        output_io.seek(0)
        
        file_name = f"{uuid.uuid4()}.webp"
        
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_name,
            file=output_io.read(),
            file_options={"content-type": "image/webp"}
        )
        
        return supabase.storage.from_(BUCKET_NAME).get_public_url(file_name)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")


def delete_images_from_storage(image_urls: list[str]):
    if not image_urls:
        return
    
    filenames = []
    for url in image_urls:
        filename = url.split("/")[-1]
        filenames.append(filename)
    
    if filenames:
        try:
            supabase.storage.from_(BUCKET_NAME).remove(filenames)
        except Exception as e:
            # We print instead of raise so a storage failure doesn't 
            # prevent the DB row from being deleted.
            print(f"Warning: Failed to delete physical images: {e}")