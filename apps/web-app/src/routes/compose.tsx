import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { WebShell } from "@/components/WebShell";
import {
  ArrowLeft,
  ImagePlus,
  Sparkles,
  Send,
  X,
  Upload,
  ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  Link2,
  AlertCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useCategories } from "@/hooks/useApi";
import { requireAuth } from "@/lib/auth";
import { useI18n } from "@/components/providers/I18nProvider";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "New story — Vellbase" },
      { name: "description", content: "Draft and publish a new story on Vellbase." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
  component: ComposePage,
});

// ─── Types ───
interface ImageAttachment {
  id: string;
  file?: File;
  url?: string;
  preview: string;
  name: string;
  size: number;
  type: string;
  isUploading: boolean;
  uploadedUrl?: string;
  error?: string;
}

// ─── Image Upload Component ───
function ImageUploader({
  images,
  onImagesChange,
  maxImages = 5,
  maxSize = 5 * 1024 * 1024, // 5MB
}: {
  images: ImageAttachment[];
  onImagesChange: (images: ImageAttachment[]) => void;
  maxImages?: number;
  maxSize?: number;
}) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [uploadType, setUploadType] = useState<"file" | "url" | "drop" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const uploadCleanups = useRef<Record<string, () => void>>({});
  const pendingUploadTypeRef = useRef<"file" | "drop">("drop");

  // Keep ref in sync with latest images to avoid stale closures
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup blob URLs and intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(uploadCleanups.current).forEach((cleanup) => cleanup());
      imagesRef.current.forEach((img) => {
        if (img.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(img.preview);
        }
      });
    };
  }, []);

  // ─── Simulate upload progress ───
  const simulateUpload = useCallback((id: string, type: "file" | "url" | "drop") => {
    setUploadingIds((prev) => new Set(prev).add(id));
    setUploadType(type);
    setUploadProgress((prev) => ({ ...prev, [id]: 0 }));

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        delete uploadCleanups.current[id];

        setCompletedIds((prev) => new Set(prev).add(id));

        setUploadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          if (next.size === 0) setUploadType(null);
          return next;
        });

        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        // FIX: Use ref to get latest images and preserve order with .map()
        const currentImages = imagesRef.current;
        onImagesChange(
          currentImages.map((img) =>
            img.id === id ? { ...img, isUploading: false } : img
          )
        );
      }
      setUploadProgress((prev) => ({ ...prev, [id]: Math.min(progress, 100) }));
    }, 150);

    uploadCleanups.current[id] = () => clearInterval(interval);
  }, [onImagesChange]);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = maxImages - images.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      const newImages = acceptedFiles
        .slice(0, remaining)
        .map((file) => {
          if (file.size > maxSize) {
            toast.error(`${file.name} exceeds ${maxSize / 1024 / 1024}MB limit`);
            return null;
          }
          if (!file.type.startsWith("image/")) {
            toast.error(`${file.name} is not a valid image`);
            return null;
          }

          const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const newImage: ImageAttachment = {
            id,
            file,
            preview: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
            type: file.type,
            isUploading: true,
          };
          return newImage;
        })
        .filter(Boolean) as ImageAttachment[];

      if (newImages.length === 0) return;

      const updatedImages = [...images, ...newImages];
      onImagesChange(updatedImages);

      // FIX: Distinguish file input vs drag-drop for the label
      const type = pendingUploadTypeRef.current;
      pendingUploadTypeRef.current = "drop"; // reset for next time
      newImages.forEach((img) => simulateUpload(img.id, type));
    },
    [images, maxImages, maxSize, onImagesChange, simulateUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff"],
    },
    maxSize,
    maxFiles: maxImages,
    disabled: images.length >= maxImages,
    noClick: true,
  });

  const handleImageUrlAdd = useCallback(
    (url: string) => {
      if (!url.trim()) {
        toast.error("Please enter a URL");
        return;
      }
      if (images.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      const trimmedUrl = url.trim();

      const isValidImageUrl = (url: string): boolean => {
        const imageExtensions = /\.(jpeg|jpg|png|gif|webp|svg|bmp|tiff|ico)(\?.*)?$/i;
        const imageDomains = [
          "unsplash.com", "plus.unsplash.com", "images.unsplash.com",
          "imgur.com", "cdn", "cloudinary.com", "res.cloudinary.com",
          "drive.google.com", "photos.google.com", "ibb.co", "postimg.cc",
          "tinypic.com", "flickr.com", "live.staticflickr.com",
          "i.ibb.co", "i.imgur.com", "i.redd.it", "preview.redd.it",
          "media.licdn.com", "pbs.twimg.com", "platform-lookaside.fbsbx.com",
          "scontent", "storage.googleapis.com", "amazonaws.com",
          "s3.amazonaws.com", ".githubusercontent.com",
          "dev-to-uploads.s3.amazonaws.com", "hashnode.com",
          "images.ctfassets.net", "images.prismic.io", "cdn.sanity.io",
          "cdn.buttercms.com", "images.contentful.com", "assets.vercel.com",
          "images.pexels.com", "images.unsplash.com",
        ];

        const hasImageDomain = imageDomains.some((domain) =>
          url.toLowerCase().includes(domain.toLowerCase())
        );
        const hasImagePatterns = [
          /imgur\.com\/a\//,
          /photos\.google\.com/,
          /drive\.google\.com\/file\/d\//,
          /images\.unsplash\.com/,
          /plus\.unsplash\.com/,
        ].some((pattern) => pattern.test(url));
        const hasImageExtension = imageExtensions.test(url);
        const hasMimeType = /(image\/|format=)/i.test(url);
        const isUnsplashUrl = /(plus\.unsplash\.com|images\.unsplash\.com)/.test(url);

        return hasImageExtension || hasImageDomain || hasImagePatterns || hasMimeType || isUnsplashUrl;
      };

      if (!isValidImageUrl(trimmedUrl)) {
        toast.error("Please enter a valid image URL. Supported formats: JPG, PNG, GIF, WEBP, SVG, and more.");
        return;
      }

      const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newImage: ImageAttachment = {
        id,
        url: trimmedUrl,
        preview: trimmedUrl,
        name: trimmedUrl.split("/").pop()?.split("?")[0] || "image",
        size: 0,
        type: "url",
        isUploading: true,
      };

      onImagesChange([...images, newImage]);
      simulateUpload(id, "url");

      // FIX: Removed crossOrigin to prevent false negatives on non-CORS hosts
      const validateImageLoad = (url: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
      };

      validateImageLoad(trimmedUrl)
        .then((isValid) => {
          if (isValid) toast.success("Image added from URL");
          else toast.info("Image added from URL. Please verify it displays correctly.");
        })
        .catch(() => {
          toast.info("Image added from URL. Please verify it displays correctly.");
        });
    },
    [images, maxImages, onImagesChange, simulateUpload]
  );

  const removeImage = useCallback(
    (id: string) => {
      // FIX: Clear interval if image is removed mid-upload
      uploadCleanups.current[id]?.();
      delete uploadCleanups.current[id];

      const imageToRemove = images.find((img) => img.id === id);
      if (imageToRemove?.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        if (next.size === 0) setUploadType(null);
        return next;
      });
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onImagesChange(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  const handleUploadClick = () => {
    pendingUploadTypeRef.current = "file";
    fileInputRef.current?.click();
  };

  const getUploadLabel = () => {
    if (uploadType === "drop") return "Uploading via drag & drop...";
    if (uploadType === "url") return "Uploading from URL...";
    if (uploadType === "file") return "Uploading file...";
    return "Uploading...";
  };

  return (
    <div className="space-y-4 mb-4">
      {/* ─── Upload Zone ─── */}
      <div
        {...getRootProps()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all p-8 text-center",
          "w-full aspect-[21/9] border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors group",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 ",
          images.length >= maxImages && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* FIX: Merge refs properly so react-dropzone receives the input ref */}
        <input {...getInputProps({ })} ref={fileInputRef} />
        <div className="flex flex-col items-center gap-3">
          {isDragActive ? (
            <>
              <div className="relative">
                <Upload className="size-12 text-primary animate-bounce" />
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  +
                </span>
              </div>
              <p className="text-sm font-medium text-primary animate-pulse">
                Drop your images here
              </p>
            </>
          ) : uploadingIds.size > 0 ? (
            <>
              <div className="relative">
                <Loader2 className="size-10 text-primary animate-spin" />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {uploadingIds.size}
                </span>
              </div>
              <p className="text-sm font-medium text-primary">
                {getUploadLabel()}
              </p>
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      Object.values(uploadProgress).reduce((a, b) => a + b, 0) /
                        (uploadingIds.size || 1),
                      100
                    )}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <ImagePlus className="size-10 text-muted-foreground/50 transition-transform group-hover:scale-110" />
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  +
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {images.length >= maxImages ? "Maximum images reached" : "Drag & drop images here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or{" "}
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="text-primary hover:underline cursor-pointer font-medium"
                    disabled={images.length >= maxImages}
                  >
                    browse files
                  </button>{" "}
                  or{" "}
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt("Enter image URL:");
                      if (url) handleImageUrlAdd(url);
                    }}
                    className="text-primary hover:underline cursor-pointer font-medium"
                    disabled={images.length >= maxImages}
                  >
                    paste URL
                  </button>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Supported: JPG, PNG, GIF, WEBP, SVG • Max {maxImages} images • Max {maxSize / 1024 / 1024}MB each
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Image Previews ─── */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => {
            // FIX: Use nullish coalescing instead of || to avoid index fallback bug
            const progress = uploadProgress[image.id] ?? 0;
            const isUploading = image.isUploading || uploadingIds.has(image.id);
            const isCompleted = completedIds.has(image.id);

            return (
              // FIX: Stable key using only image.id
              <div
                key={image.id}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border bg-muted/30",
                  isUploading && "ring-2 ring-primary ring-offset-2",
                  isCompleted && !isUploading && "ring-1 ring-emerald-500/50 ring-offset-1"
                )}
              >
                <img
                  src={image.preview}
                  alt={image.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E";
                  }}
                />

                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative">
                      <Loader2 className="size-8 animate-spin text-white" />
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/80 font-medium tabular-nums">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/60">
                      {uploadType === "drop" ? "Processing..." :
                        uploadType === "url" ? "Fetching..." :
                        uploadType === "file" ? "Uploading..." : "Loading..."}
                    </p>
                  </div>
                )}

                {isCompleted && !isUploading && (
                  <div className="absolute top-1 left-1">
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-medium text-white animate-in fade-in slide-in-from-left-2">
                      <Check className="size-2.5" />
                      Done
                    </div>
                  </div>
                )}

                {image.error && (
                  <div className="absolute inset-0 bg-rose-500/90 flex items-center justify-center p-2">
                    <div className="text-center">
                      <AlertCircle className="size-6 text-white mx-auto mb-1" />
                      <p className="text-xs text-white text-center">{image.error}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => removeImage(image.id)}
                  className={cn(
                    "absolute top-1 right-1 p-1 rounded-full transition-all",
                    isUploading
                      ? "bg-white/20 text-white/60 opacity-50 cursor-not-allowed"
                      : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:scale-110"
                  )}
                  disabled={isUploading}
                >
                  <X className="size-3.5" />
                </button>

                {image.url && !isUploading && (
                  <div className="absolute bottom-1 left-1 p-1 rounded bg-black/60 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link2 className="size-3" />
                  </div>
                )}

                {image.size > 0 && !isUploading && (
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(image.size / 1024).toFixed(0)}KB
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploadingIds.size > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            <span>{uploadingIds.size} image{uploadingIds.size > 1 ? "s" : ""} uploading</span>
          </div>
          <span>·</span>
          <span>
            {Math.round(
              Object.values(uploadProgress).reduce((a, b) => a + b, 0) /
                (uploadingIds.size || 1)
            )}% complete
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {uploadType === "drop" ? "📥 Drag & drop" :
              uploadType === "url" ? "🔗 URL" :
              uploadType === "file" ? "📁 File" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── AI Title Suggester ───
function AITitleSuggester({
  title,
  body,
  section,
  images,
  onTitleSelect,
}: {
  title: string;
  body: string;
  section: string;
  images: ImageAttachment[];
  onTitleSelect: (title: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!body.trim() && !title.trim()) {
      toast.error("Write some content first to generate title suggestions");
      return;
    }

    setIsLoading(true);
    setSuggestions([]);
    setShowSuggestions(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const content = body.trim() || title.trim() || "content";
    const suggestionsList = [];

    const keyPhrases = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 20)
      .slice(0, 3)
      .map((s) => s.trim());

    if (keyPhrases.length > 0) {
      suggestionsList.push(keyPhrases[0].slice(0, 60));
      if (keyPhrases.length > 1) {
        suggestionsList.push(keyPhrases[1].slice(0, 60));
      }
    }

    if (section) {
      suggestionsList.push(`The Ultimate Guide to ${section}`);
      suggestionsList.push(`Mastering ${section}: A Complete Overview`);
    }

    if (images.length > 0) {
      suggestionsList.push(`Visual Storytelling: ${images.length} Images That Tell a Story`);
    }

    if (suggestionsList.length < 2) {
      suggestionsList.push(
        "Discover the Power of Content Creation",
        "How to Engage Your Audience Effectively",
        "The Art of Storytelling in the Digital Age"
      );
    }

    const unique = [...new Set(suggestionsList)].slice(0, 5);
    setSuggestions(unique);

    if (unique.length === 0) {
      toast.warning("Couldn't generate suggestions, try adding more content");
    }

    setIsLoading(false);
  }, [body, title, section, images]);

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!showSuggestions) {
            generateSuggestions();
          } else {
            setShowSuggestions(false);
            setSuggestions([]);
          }
        }}
        disabled={isLoading}
        className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80 transition-opacity"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : showSuggestions ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {isLoading ? "Thinking..." : showSuggestions ? "Hide suggestions" : "Suggest a title"}
      </button>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg p-3 z-10 space-y-2 animate-in fade-in slide-in-from-top-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            AI Suggestions
          </p>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => {
                onTitleSelect(suggestion);
                setShowSuggestions(false);
                setSuggestions([]);
                toast.success("Title applied");
              }}
              className="block w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───
function ComposePage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const wordCount = useMemo(() => body.trim() ? body.trim().split(/\s+/).length : 0, [body]);
  const readMins = useMemo(() => Math.max(1, Math.round(wordCount / 220)), [wordCount]);

  const handleImagesChange = useCallback((newImages: ImageAttachment[]) => {
    setImages(newImages);
    setIsDirty(true);
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      const draft = {
        title,
        body,
        section,
        images: images.map((img) => ({
          id: img.id,
          url: img.url || img.preview,
          name: img.name,
        })),
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem("compose_draft", JSON.stringify(draft));
      } catch {
        // Silently fail
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, body, section, images, isDirty]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("compose_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        const age = Date.now() - draft.timestamp;
        if (age < 3600000) {
          setTitle(draft.title || "");
          setBody(draft.body || "");
          setSection(draft.section || "");
          if (draft.images) {
            setImages(
              draft.images.map((img: any) => ({
                id: img.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                preview: img.url,
                url: img.url,
                name: img.name || "image",
                size: 0,
                type: "url",
                isUploading: false,
              }))
            );
          }
          setIsDirty(true);
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (categories && categories.length > 0 && !section) {
      setSection(categories[0].name);
    }
  }, [categories, section]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please add a title and body to publish");
      return;
    }

    const selectedCategory = categories?.find((c) => c.name === section);
    if (!selectedCategory) {
      toast.error("Please select a valid section");
      return;
    }

    const excerpt = body
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
      .substring(0, 200);

    const imageUrls = images
      .map((img) => img.url || img.uploadedUrl || img.preview)
      .filter(Boolean);

    setIsPublishing(true);
    try {
      await apiClient.createArticle({
        title: title.trim(),
        excerpt,
        body: body.trim().split("\n").filter(Boolean),
        categoryId: selectedCategory.id,
        cover: imageUrls.length > 0 ? imageUrls[0] : undefined,
        readTime: readMins,
        images: imageUrls.map((url) => ({ url, thumbnailUrl: url, width: 0, height: 0 })),
      });

      localStorage.removeItem("compose_draft");
      toast.success("Story published successfully! 🎉");
      nav({ to: "/profile" });
    } catch (err: any) {
      toast.error(err.message || "Failed to publish story");
    } finally {
      setIsPublishing(false);
    }
  };

  const clearDraft = useCallback(() => {
    localStorage.removeItem("compose_draft");
    setTitle("");
    setBody("");
    setSection("");
    setImages([]);
    setIsDirty(false);
    toast.success("Draft cleared");
  }, []);

  return (
    <WebShell>
      <div className="max-w-[860px] mx-auto px-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isDirty && (title || body)) {
                  if (!confirm("You have unsaved changes. Are you sure you want to leave?")) return;
                }
                nav({ to: "/" });
              }}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                            <ArrowLeft className="size-4" />
              {t("common.cancel")}
            </button>
            {isDirty && (
              <button
                onClick={clearDraft}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Clear draft
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {wordCount > 0 ? `${wordCount} words · ${readMins} min read` : "Draft"}
            </div>
            <button
              onClick={publish}
              disabled={isPublishing || categoriesLoading || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="size-3" />
                  {t("compose.publish")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── Editor Card ─── */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-10 space-y-6">
          {/* ─── Image Uploader ─── */}
          <ImageUploader images={images} onImagesChange={handleImagesChange} maxImages={5} />

          {/* ─── Section Picker ─── */}
          <div className="py-4">
            <label className="text-[10px] py-4 font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Section
            </label>
            {categoriesLoading ? (
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSection(s.name);
                      setIsDirty(true);
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest border transition-colors",
                      section === s.name
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Title with AI Suggester ─── */}
          <div className="relative">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder={t("compose.titlePlaceholder")}
              className="w-full font-display italic text-3xl md:text-5xl leading-tight bg-transparent outline-none placeholder:text-muted-foreground/40"
              maxLength={120}
            />
            <div className="absolute right-0 top-0 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">
                {title.length}/120
              </span>
              <AITitleSuggester
                title={title}
                body={body}
                section={section}
                images={images}
                onTitleSelect={(suggestion) => {
                  setTitle(suggestion);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* ─── Body ─── */}
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setCharCount(e.target.value.length);
              setIsDirty(true);
            }}
            name="body"
            placeholder={t("compose.bodyPlaceholder")}
            rows={14}
            className="w-full bg-transparent outline-none resize-none text-base leading-relaxed placeholder:text-muted-foreground/50 border-t border-border pt-6"
            maxLength={50000}
          />

          {/* ─── Footer Bar ─── */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-4">
              <span>{t("compose.wordCount", { count: wordCount })}</span>
              <span>·</span>
              <span>{charCount.toLocaleString()} chars</span>
              {images.length > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="size-3" />
                    {images.length} image{images.length > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-accent hover:opacity-80 transition-opacity"
              >
                {showPreview ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {showPreview ? "Hide preview" : "Preview"}
              </button>
            </div>
          </div>

          {/* ─── Preview ─── */}
          {showPreview && (
            <div className="border-t border-border pt-6 mt-4 animate-in fade-in slide-in-from-top-2">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h1>{title || "Untitled"}</h1>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 my-4">
                    {images.slice(0, 4).map((img) => (
                      <img
                        key={img.id}
                        src={img.preview}
                        alt={img.name}
                        className="rounded-lg w-full h-32 object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {body || "Start writing your story..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WebShell>
  );
}