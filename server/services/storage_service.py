import os
import uuid
import io
from fastapi import UploadFile, HTTPException
from supabase import create_client, Client
from PIL import Image, UnidentifiedImageError

supabase_url = os.environ.get("SUPABASE_URL", "")
supabase_key = os.environ.get("SUPABASE_ANON_KEY", "")

if not supabase_url or not supabase_key:
    raise RuntimeError("Supabase keys missing in .env file..!")

supabase: Client = create_client(supabase_url, supabase_key)

MAX_FILE_SIZE_MB = 5  

async def upload_property_images(files: list[UploadFile], property_id: str) -> list[str]:
    uploaded_urls = []
    
    for file in files:
        file_bytes = await file.read()
        
        if len(file_bytes) > (MAX_FILE_SIZE_MB * 1024 * 1024):
            raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds {MAX_FILE_SIZE_MB}MB limit.")
        
        try:
            img = Image.open(io.BytesIO(file_bytes))
            
            if img.format not in ["JPEG", "PNG", "WEBP"]:
                raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP formats are allowed.")

            
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            img.thumbnail((1280, 1280)) 

            compressed_io = io.BytesIO()
            img.save(compressed_io, format="WEBP", quality=75, optimize=True)
            compressed_bytes = compressed_io.getvalue()
            
        except UnidentifiedImageError:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is corrupted or fake..!")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

        try:
            unique_filename = f"properties/{property_id}/{uuid.uuid4()}.webp"
            
            response = supabase.storage.from_("property-images").upload(
                file=compressed_bytes,
                path=unique_filename,
                file_options={"content-type": "image/webp"}
            )
            
            public_url = supabase.storage.from_("property-images").get_public_url(unique_filename)
            uploaded_urls.append(public_url)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")
            
    return uploaded_urls