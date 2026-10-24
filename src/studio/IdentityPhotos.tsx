import { useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  UploadIcon,
  ImageIcon,
  CheckIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
export interface IdentityPhoto {
  mime: string;
  data: string;
  name: string;
}
type Side = "front" | "back";
export default function IdentityPhotos({
  type,
  photos,
  onChange,
  onError,
}: {
  type: string;
  photos: { front?: IdentityPhoto; back?: IdentityPhoto };
  onChange: (side: Side, photo?: IdentityPhoto) => void;
  onError: (text: string) => void;
}) {
  const [processing, setProcessing] = useState("");
  const mounted = useRef(true),
    version = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);
  useEffect(() => {
    version.current++;
    setProcessing("");
  }, [type]);
  async function select(side: Side, file?: File) {
    if (!file) return;
    const request = ++version.current;
    setProcessing(side);
    const current = () => mounted.current && request === version.current;
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error("请选择 20 MB 以内的 JPG、PNG 或 WebP 照片");
      const bitmap = await createImageBitmap(file);
      try {
        if (!current()) return;
        const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器无法处理此照片，请换一张重试");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        if (data.length > Math.ceil((2 * 1024 * 1024 * 4) / 3))
          throw new Error("照片处理后仍超过 2 MB，请选择较小的图片");
        if (current()) {
          onChange(side, { mime: "image/jpeg", data, name: file.name });
          onError("");
        }
      } finally {
        bitmap.close();
      }
    } catch (e) {
      if (current())
        onError((e as Error).message || "照片无法读取，请换一张重试");
    } finally {
      if (current()) setProcessing("");
    }
  }
  return (
    <fieldset className="s-id-photos">
      <legend>证件照片 · 正反面均需上传</legend>
      <p>
        请保证证件完整、文字清晰、无反光。更换证件类型后，需要重新选择照片。
      </p>
      <div className="s-id-completeness">
        <span>
          {photos.front ? <CheckIcon /> : <ImageIcon />}正面
          {photos.front ? "已选择" : "待上传"}
        </span>
        <span>
          {photos.back ? <CheckIcon /> : <ImageIcon />}反面
          {photos.back ? "已选择" : "待上传"}
        </span>
      </div>
      {(["front", "back"] as const).map((side) => (
        <PhotoSlot
          key={side}
          label={
            side === "front"
              ? type === "护照"
                ? "资料页（正面）"
                : type === "驾驶证"
                  ? "驾驶证主页（正面）"
                  : "身份证人像面（正面）"
              : type === "护照"
                ? "封面 / 备注页（反面）"
                : type === "驾驶证"
                  ? "驾驶证副页（反面）"
                  : "身份证国徽面（反面）"
          }
          photo={photos[side]}
          busy={!!processing}
          processing={processing === side}
          onFile={(file) => void select(side, file)}
          onRemove={() => onChange(side, undefined)}
        />
      ))}
      <small>
        照片仅供本人及后台审核查看。支持 JPG / PNG /
        WebP；提交前在此浏览器压缩并移除图片元数据，每张保存大小不超过 2 MB。
      </small>
    </fieldset>
  );
}
function PhotoSlot({
  label,
  photo,
  busy,
  processing,
  onFile,
  onRemove,
}: {
  label: string;
  photo?: IdentityPhoto;
  busy: boolean;
  processing: boolean;
  onFile: (file?: File) => void;
  onRemove: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null),
    upload = useRef<HTMLInputElement>(null);
  return (
    <div className="s-id-photo">
      <div className="s-id-photo-heading">
        <b>{label}</b>
        {photo && (
          <button
            type="button"
            disabled={busy}
            aria-label={"移除" + label + "照片"}
            onClick={onRemove}
          >
            <Cross2Icon />
            移除
          </button>
        )}
      </div>
      <div className={"s-id-preview " + (photo ? "has-photo" : "")}>
        {photo ? (
          <img
            src={"data:" + photo.mime + ";base64," + photo.data}
            alt={label + "预览"}
          />
        ) : (
          <>
            <ImageIcon />
            <span>{processing ? "正在处理照片…" : "尚未选择照片"}</span>
          </>
        )}
      </div>
      <div className="s-id-photo-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => camera.current?.click()}
        >
          <CameraIcon />
          {processing ? "处理中…" : "拍照"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => upload.current?.click()}
        >
          <UploadIcon />
          {photo ? "重新上传" : "上传照片"}
        </button>
      </div>
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label={label + "拍照"}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={upload}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label + "上传照片"}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
