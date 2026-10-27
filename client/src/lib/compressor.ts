export const processAndCompressImage = async (file: File): Promise<File> => {
  const MAX_INPUT_SIZE = 9 * 1024 * 1024; // 9MB limit on raw upload
  const TARGET_MAX_WIDTH = 1200;

  // Guardrail 1: Hard reject oversized raw files to protect client RAM
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error(`File "${file.name}" exceeds 9MB limit. Please choose a smaller photo.`);
  }

  // Guardrail 2: Ensure file is an image type
  if (!file.type.startsWith("image/")) {
    throw new Error(`File "${file.name}" is not a valid image file.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscale dimensions if larger than target width
        if (width > TARGET_MAX_WIDTH) {
          height = Math.round((height * TARGET_MAX_WIDTH) / width);
          width = TARGET_MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Failed to get 2D canvas context"));

        ctx.drawImage(img, 0, 0, width, height);

        // Compress canvas output to WebP at 80% quality
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas compression failed"));
            
            const compressedFile = new File(
              [blob], 
              `${file.name.replace(/\.[^/.]+$/, "")}.webp`, 
              { type: "image/webp", lastModified: Date.now() }
            );

            // Guardrail 3: Final sanity check for backend 2MB limit
            if (compressedFile.size > 2 * 1024 * 1024) {
              return reject(new Error("Compressed image still exceeds 2MB backend limit. Try a smaller image."));
            }

            resolve(compressedFile);
          },
          "image/webp",
          0.8
        );
      };

      img.onerror = () => reject(new Error("Failed to load image file."));
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
  });
};