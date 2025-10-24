import { toast } from "sonner";

export const generateSimpleOrderImage = async (
  imageUrl: string,
  variant: string,
  quantity: number
): Promise<void> => {
  try {
    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Load image
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Calculate dimensions: Image area 75%, Text area 25%
    const imageHeight = img.height;
    const textAreaHeight = Math.floor(imageHeight * 0.33); // 33% for text
    const totalHeight = imageHeight + textAreaHeight;
    
    canvas.width = img.width;
    canvas.height = totalHeight;

    // Draw white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image (original size)
    ctx.drawImage(img, 0, 0, img.width, imageHeight);

    // Prepare text
    const text = variant ? `${variant} - ${quantity}` : `${quantity}`;
    
    // Calculate font size to fit width
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let fontSize = 40;
    const maxWidth = canvas.width * 0.9; // 90% of canvas width
    
    ctx.font = `bold ${fontSize}px Arial`;
    while (ctx.measureText(text).width < maxWidth && fontSize < 150) {
      fontSize += 5;
      ctx.font = `bold ${fontSize}px Arial`;
    }
    // Step back one size if we went over
    if (ctx.measureText(text).width > maxWidth) {
      fontSize -= 5;
      ctx.font = `bold ${fontSize}px Arial`;
    }

    // Draw text in red, bold, centered
    ctx.fillStyle = "#ff0000";
    const textY = imageHeight + textAreaHeight / 2;
    ctx.fillText(text, canvas.width / 2, textY);

    // Convert to blob and copy to clipboard
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create blob"));
      }, "image/png");
    });

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);

    toast.success("Đã copy hình order vào clipboard!");
  } catch (error) {
    console.error("Error generating order image:", error);
    toast.error("Không thể tạo hình order. Vui lòng thử lại.");
  }
};
