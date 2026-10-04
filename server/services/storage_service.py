import io
import uuid
import logging
from urllib.parse import unquote, urlsplit

from fastapi import UploadFile, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from supabase import create_client, Client
from config import settings

# load_dotenv()
logger = logging.getLogger(__name__)

# SUPABASE_URL = os.environ.get("SUPABASE_URL")
# SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase credentials missing in .env..!")

supabase: Client = create_client(
    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
)
BUCKET_NAME = "property-images"

MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_IMAGE_SIZE = (1024, 1024)

ALLOWED_EXTENSIONS = {
    "image/jpeg": "JPEG",
     "image/webp": "WEBP", 
     "image/jpg": "JPEG",
}

async def process_and_upload_image(file: UploadFile) -> str:
    content_type = (file.content_type or "").lower().split(";", 1)[0].strip()
    expected_format = ALLOWED_EXTENSIONS.get(content_type)

    if expected_format is None:
        raise HTTPException(status_code=400, detail="Only JPEG and WEBP images are allowed..")

    file_bytes = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Max 2MB allowed per image.")

    return await run_in_threadpool(
        _process_and_upload_image,
        file_bytes,
        expected_format,
    )


def _process_and_upload_image(file_bytes: bytes, expected_format: str) -> str:
    try:
        with Image.open(io.BytesIO(file_bytes)) as opened_image:
            if opened_image.format != expected_format:
                raise HTTPException(
                    status_code=400,
                    detail="Image content does not match its required type.."
                )

            if opened_image.width * opened_image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions are too large.."
                )
            has_transparency = (
                "A" in opened_image.getbands()
                or "transparency" in opened_image.info
            )


            image = ImageOps.exif_transpose(opened_image)
            image.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
            image = image.convert("RGBA" if has_transparency else "RGB")

            output = io.BytesIO()
            image.save(output, format="WEBP", quality=75)

    except HTTPException:
        raise
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported image..",
        ) from exc

    file_name = f"{uuid.uuid4()}.webp"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_name,
            file=output.getvalue(),
            file_options={"content-type": "image/webp"},
        )
        return supabase.storage.from_(BUCKET_NAME).get_public_url(file_name)

    except Exception as exc:
        logger.exception("Image upload to Supabase failed..!")
        raise HTTPException(
            status_code=502,
            detail="Image storage upload failed..!"
        ) from exc

    
    #     # Image Resizing
    #     max_width = 1024
    #     if image.width > max_width:
    #         ratio = max_width / float(image.width)
    #         new_height = int((float(image.height) * float(ratio)))
    #         image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

    #     # Extreme Compression in WebP format
    #     output_io = io.BytesIO()
    #     image.save(output_io, format="WEBP", quality=75, method=6)
    #     output_io.seek(0)
        
    #     file_name = f"{uuid.uuid4()}.webp"
        
    #     supabase.storage.from_(BUCKET_NAME).upload(
    #         path=file_name,
    #         file=output_io.read(),
    #         file_options={"content-type": "image/webp"}
    #     )
        
    #     return supabase.storage.from_(BUCKET_NAME).get_public_url(file_name)

    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")


async def delete_images_from_storage(image_urls: list[str]) -> None:
    if not image_urls:
        return

    await run_in_threadpool(_delete_images_from_storage, image_urls)


def _delete_images_from_storage(image_urls: list[str]) -> None:

    filenames = []

    for image_url in image_urls:
        filename = unquote(urlsplit(image_url).path.rsplit("/", 1)[-1])
        if filename:
            filenames.append(filename)
    
    if not filenames:
        return
    
    try:
        supabase.storage.from_(BUCKET_NAME).remove(filenames)
    except Exception:
            # We print instead of raise so a storage failure doesn't 
            # prevent the DB row from being deleted.
            # print(f"Warning: Failed to delete physical images: {e}")
            logger.exception("Failed to delete images from Supabase Storage..!")