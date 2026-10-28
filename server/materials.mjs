import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "./store.mjs";
export async function receiveMaterial(req, taskId, dataDir, store, actor) {
  store.getTask(taskId);
  const type = String(req.headers["content-type"] || "");
  if (!type.includes("multipart/form-data"))
    throw new AppError("请使用文件表单上传素材", 415);
  const limit = 52 * 1024 * 1024;
  if (Number(req.headers["content-length"] || 0) > limit) {
    req.resume();
    throw new AppError("素材文件不能超过 50 MB", 413);
  }
  const chunks = [];
  let bytes = 0;
  for await (const c of req) {
    bytes += c.length;
    if (bytes > limit) throw new AppError("素材文件不能超过 50 MB", 413);
    chunks.push(c);
  }
  let form;
  try {
    form = await new Request("http://localhost/material", {
      method: "POST",
      headers: { "Content-Type": type },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new AppError("无法读取上传文件");
  }
  const file = form.get("file");
  if (!file || typeof file === "string")
    throw new AppError("请选择需要上传的素材");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > 50 * 1024 * 1024)
    throw new AppError("素材文件必须在 50 MB 以内");
  let mime, extension, kind;
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    mime = "video/mp4";
    extension = ".mp4";
    kind = "video";
  } else if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
  ) {
    mime = "video/webm";
    extension = ".webm";
    kind = "video";
  } else if (
    /\.(txt|srt)$/i.test(file.name) &&
    buffer.length <= 2 * 1024 * 1024
  ) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new AppError("文案文件应使用 UTF-8 编码");
    }
    if (buffer.includes(0)) throw new AppError("文案文件包含无效字符");
    mime = "text/plain; charset=utf-8";
    extension = file.name.toLowerCase().endsWith(".srt") ? ".srt" : ".txt";
    kind = "document";
  } else throw new AppError("支持 MP4、WebM 视频，以及 UTF-8 TXT/SRT 文案");
  const filename = randomUUID() + extension,
    path = "/materials/" + filename;
  await mkdir(join(dataDir, "materials"), { recursive: true });
  const disk = join(dataDir, "materials", filename);
  await writeFile(disk, buffer, { flag: "wx" });
  try {
    const meta = {
      name: file.name.slice(0, 150),
      mime,
      size: buffer.length,
      path,
      kind,
    };
    return actor ? store.audited(actor,"material.upload",taskId,()=>store.addMaterial(taskId,meta),{name:meta.name}) : store.addMaterial(taskId,meta);
  } catch (e) {
    await unlink(disk).catch(() => {});
    throw e;
  }
}
export function parseRange(value, size) {
  if (!value) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2])) throw new AppError("无效的媒体范围", 416);
  let start, end;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (suffix <= 0) throw new AppError("无效的媒体范围", 416);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new AppError("无效的媒体范围", 416);
  return { start, end };
}
