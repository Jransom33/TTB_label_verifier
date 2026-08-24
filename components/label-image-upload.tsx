"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";

const ACCEPT = ".png,.jpg,.jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

type LabelImageUploadProps = {
  onFileChange?: (file: File | null) => void;
};

/**
 * Client-side checks that match the verification API's default image contract.
 * Assumption: 10 MB equals the server MAX_IMAGE_BYTES default.
 * Incomplete: magic-byte and decode checks stay on the server.
 */
function validateImage(file: File): string | null {
  const name = file.name.toLowerCase();
  const png = file.type === "image/png" && name.endsWith(".png");
  const jpeg =
    file.type === "image/jpeg" && (name.endsWith(".jpg") || name.endsWith(".jpeg"));
  if (!png && !jpeg) return "Use a PNG or JPEG image.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_BYTES) return "Image must be 10 MB or smaller.";
  return null;
}

export function LabelImageUpload({ onFileChange }: LabelImageUploadProps) {
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke each object URL when it is replaced, cleared, or the component unmounts.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const openPicker = () => inputRef.current?.click();

  const applyFile = (next: File) => {
    const message = validateImage(next);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(next));
    setFile(next);
    onFileChange?.(next);
  };

  const clearFile = () => {
    setError(null);
    setPreview(null);
    setFile(null);
    onFileChange?.(null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCount.current = 0;
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length > 1) {
      setError("Drop only one image.");
      return;
    }
    if (files[0]) applyFile(files[0]);
  };

  const onZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <section className="w-full text-white">
      <h2 className="text-sm font-medium text-white/80">Label image</h2>
      <p className="mt-1 text-xs text-white/50">One PNG or JPEG, up to 10 MB.</p>

      {/* Drop zone: click, Enter/Space, or drag-and-drop opens/accepts a file.
          dragCount ignores dragleave events fired by child elements. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={file ? "Replace label image" : "Upload label image"}
        aria-describedby={error ? errorId : undefined}
        onClick={openPicker}
        onKeyDown={onZoneKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          dragCount.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCount.current -= 1;
          if (dragCount.current <= 0) {
            dragCount.current = 0;
            setDragging(false);
          }
        }}
        onDrop={onDrop}
        className={`mt-2 flex min-h-64 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-black/20 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70 ${
          dragging ? "border-white/50 bg-white/5" : "border-white/15"
        }`}
      >
        {/* Preview of the selected image, or the empty-state hint. */}
        {preview && file ? (
          // Blob previews are local object URLs; next/image is not a fit here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={file.name}
            className="max-h-[32rem] w-full object-contain p-3"
          />
        ) : (
          <p className="px-6 text-center text-sm text-white/45">
            Drop a label image here, or choose a file.
          </p>
        )}
      </div>

      {/* Shows image filename and clear button. Other elements are hidden. */}
      {file ? (
        <div className="mt-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white/60" title={file.name}>
            {file.name}
          </p>
          <button
            type="button"
            onClick={clearFile}
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5"
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Displays image file validation (file type, size, etc.) error message. */}
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {/* Hidden file input; resetting value lets the same file be re-picked. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (next) applyFile(next);
        }}
      />
    </section>
  );
}
