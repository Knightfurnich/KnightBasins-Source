import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { uploadImageFile } from "../src/admin/imageUploadClient.ts";

const fieldSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/admin/ImageUploadField.tsx"),
  "utf8",
);

describe("admin image upload field", () => {
  it("sends the selected file with the admin session and commits the returned URL", async () => {
    const file = new File([Buffer.from("image-bytes")], "basin.png", {
      type: "image/png",
    });
    let requestUrl = "";
    let requestInit: RequestInit | undefined;

    const uploadedUrl = await uploadImageFile(file, async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(
        JSON.stringify({
          filename: "catalog-mabc-0123456789abcdef.png",
          version: "mabc",
          url: "https://uploads.example.test/catalog/catalog-mabc-0123456789abcdef.png?v=mabc",
        }),
        { headers: { "content-type": "application/json" } },
      );
    });

    assert.equal(requestUrl, "/api/admin/upload");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.credentials, "include");
    assert.ok(requestInit?.body instanceof FormData);
    const uploadedFile = requestInit?.body instanceof FormData
      ? requestInit.body.get("file")
      : null;
    assert.ok(uploadedFile instanceof File);
    assert.equal(uploadedFile?.name, "basin.png");
    assert.equal(uploadedFile?.type, "image/png");
    assert.equal(uploadedUrl, "https://uploads.example.test/catalog/catalog-mabc-0123456789abcdef.png?v=mabc");
  });

  it("surfaces server validation errors instead of accepting a response without a URL", async () => {
    const file = new File([Buffer.from("image-bytes")], "basin.png", {
      type: "image/png",
    });

    await assert.rejects(
      uploadImageFile(file, async () =>
        new Response(JSON.stringify({ message: "Only JPG, PNG, WEBP, and GIF images are allowed" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
      { message: "Only JPG, PNG, WEBP, and GIF images are allowed" },
    );
  });

  it("keeps the preview bound to the current value and the successful upload URL", () => {
    assert.match(fieldSource, /\{previewUrl \? \(/);
    assert.match(fieldSource, /<img src=\{previewUrl\} alt="ตัวอย่างรูปภาพสินค้า"/);
    assert.match(fieldSource, /const uploadedUrl = await uploadImageFile\(file\)/);
    assert.match(fieldSource, /onChange\(uploadedUrl\)/);
    assert.match(fieldSource, /setPreviewUrl\(uploadedUrl\)/);
    assert.match(fieldSource, /type="file"/);
    assert.match(fieldSource, /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/);
  });
});