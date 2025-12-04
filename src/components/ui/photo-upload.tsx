"use client";

import { useState } from "react";
import { X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

interface PhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
}

export function PhotoUpload({ value = [], onChange, maxFiles = 10 }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const { startUpload } = useUploadThing("equipmentPhoto", {
    onClientUploadComplete: (res) => {
      if (res) {
        const newUrls = res.map((file) => file.ufsUrl);
        onChange([...value, ...newUrls]);
      }
      setIsUploading(false);
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
      alert("Erreur lors de l'upload: " + error.message);
      setIsUploading(false);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - value.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${maxFiles} photos autorisées`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);
    await startUpload(filesToUpload);

    // Reset input
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  return (
    <div className="space-y-3">
      {/* Photo grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {value.length < maxFiles && (
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${isUploading ? "bg-gray-50 border-gray-200" : "border-gray-300 hover:border-accent hover:bg-accent/5"}`}
          >
            {isUploading ? (
              <>
                <Loader2 size={20} className="animate-spin text-accent" />
                <span className="text-sm text-text-secondary">Upload en cours...</span>
              </>
            ) : (
              <>
                <ImageIcon size={20} className="text-gray-400" />
                <span className="text-sm text-text-secondary">
                  Ajouter des photos ({value.length}/{maxFiles})
                </span>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
