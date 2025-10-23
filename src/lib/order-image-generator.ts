import { toast } from "sonner";
import { getVariantName } from "@/lib/variant-utils";

export const generateOrderImage = async (
  imageUrl: string,
  variant: string,
  quantity: number,
  productName: string
): Promise<void> => {
  try {
    // Create a canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Load the image
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Calculate dimensions: image takes 2/3, text takes 1/3
    const finalHeight = Math.floor(img.height * 1.5); // Total height
    const imageAreaHeight = Math.floor(finalHeight * 2 / 3);
    const textAreaHeight = Math.floor(finalHeight / 3);
    
    canvas.width = img.width;
    canvas.height = finalHeight;

    // Fill background with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image (scaled to fit 2/3 area)
    const scale = Math.min(1, imageAreaHeight / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const imageX = (canvas.width - scaledWidth) / 2;
    const imageY = 0;
    ctx.drawImage(img, imageX, imageY, scaledWidth, scaledHeight);

    // Prepare text - extract only variant name (before " - ")
    const variantName = getVariantName(variant);
    const text = variantName 
      ? `${variantName} - ${quantity}` 
      : `${quantity}`;
    
    // Draw text background (1/3 bottom area)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, imageAreaHeight, canvas.width, textAreaHeight);

    // Calculate maximum font size to fill width
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let fontSize = 20;
    const maxWidth = canvas.width * 0.9; // 90% of canvas width
    
    // Increase font size until text fills the width
    ctx.font = `bold ${fontSize}px Arial`;
    while (ctx.measureText(text).width < maxWidth && fontSize < 200) {
      fontSize += 2;
      ctx.font = `bold ${fontSize}px Arial`;
    }
    // Step back one size if we went over
    if (ctx.measureText(text).width > maxWidth) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Arial`;
    }

    // Draw text in red, bold, large
    ctx.fillStyle = "#ff0000";
    const textY = imageAreaHeight + textAreaHeight / 2;
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