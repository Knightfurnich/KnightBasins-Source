import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { uploadVideoFile } from "../src/admin/imageUploadClient.ts";

const fieldSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/admin/VideoUploadField.tsx"),
  "utf8",
);

describe("admin basin video upload field", () => {
  it("sends the selected video with the admin session and commits the returned URL", async () => {
    const file = new File([Buffer.from("video-bytes")], "basin-tour.mp4", { type: "video/mp4" });
    let requestUrl = "";
    let requestInit: RequestInit | undefined;

    const uploadedUrl = await uploadVideoFile(file, async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({
        filename: "catalog-mabc-0123456789abcdef.mp4",
        version: "mabc",
        url: "https://uploads.example.test/catalog/catalog-mabc-0123456789abcdef.mp4?v=mabc",
      }), { headers: { "content-type": "application/json" } });
    });

    assert.equal(requestUrl, "/api/admin/upload/video");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.credentials, "include");
    assert.ok(requestInit?.body instanceof FormData);
    const uploadedFile = requestInit?.body instanceof FormData ? requestInit.body.get("file") : null;
    assert.ok(uploadedFile instanceof File);
    assert.equal(uploadedFile?.name, "basin-tour.mp4");
    assert.equal(uploadedFile?.type, "video/mp4");
    assert.equal(uploadedUrl, "https://uploads.example.test/catalog/catalog-mabc-0123456789abcdef.mp4?v=mabc");
  });

  it("surfaces server validation errors", async () => {
    const file = new File([Buffer.from("video-bytes")], "basin-tour.mp4", { type: "video/mp4" });
    await assert.rejects(
      uploadVideoFile(file, async () => new Response(
        JSON.stringify({ message: "Only MP4, WEBM, and MOV videos are allowed" }),
        { status: 400, headers: { "content-type": "application/json" } },
      )),
      { message: "Only MP4, WEBM, and MOV videos are allowed" },
    );
  });

  it("renders local and committed previews with supported video types", () => {
    assert.match(fieldSource, /<video src=\{previewUrl\} controls/);
    assert.match(fieldSource, /const localPreview = URL\.createObjectURL\(file\)/);
    assert.match(fieldSource, /setPreviewUrl\(uploadedUrl\)/);
    assert.match(fieldSource, /accept="video\/mp4,video\/webm,video\/quicktime"/);
    assert.match(fieldSource, /กำลังอัปโหลด/);
  });
});