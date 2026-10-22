import { test, expect } from "@playwright/test";
import { imageRemotePatterns, isExactHostname } from "../../config/image-hosts";

// Next only optimises images from hosts it lists, and each one is a place a
// stranger could aim the optimiser, so the list is short and exact.

const hosts = (env: Record<string, string | undefined>) => imageRemotePatterns(env).map((p) => p.hostname);

test.describe("allowed image hosts", () => {
  test("keeps EYRA's own domain, so the catalogue images still load", () => {
    const list = hosts({});
    expect(list).toContain("eyra.org.in");
    expect(list).toContain("www.eyra.org.in");
  });

  test("allows local Medusa only for its /static folder", () => {
    const local = imageRemotePatterns({}).find((p) => p.hostname === "localhost");
    expect(local).toMatchObject({ protocol: "http", port: "9000", pathname: "/static/**" });
  });

  test("adds exactly the bucket host the owner lists", () => {
    const list = imageRemotePatterns({ MEDUSA_IMAGE_HOSTS: "eyra-media.s3.ap-south-1.amazonaws.com" });
    const bucket = list.find((p) => p.hostname === "eyra-media.s3.ap-south-1.amazonaws.com");
    expect(bucket).toMatchObject({ protocol: "https", pathname: "/**" });
  });

  test("does not allow every S3 bucket, or any other shared host", () => {
    const all = hosts({ MEDUSA_IMAGE_HOSTS: "eyra-media.s3.ap-south-1.amazonaws.com" });
    expect(all.some((host) => host.includes("*"))).toBe(false);
    expect(all).not.toContain("s3.amazonaws.com");
    expect(all).not.toContain("res.cloudinary.com");
    expect(all.some((host) => host.endsWith("medusajs.com"))).toBe(false);
  });

  test("refuses wildcards and malformed entries", () => {
    const list = hosts({ MEDUSA_IMAGE_HOSTS: "*.s3.amazonaws.com, https://evil.example/x, localhost, good.example.com" });
    expect(list).toContain("good.example.com");
    expect(list).not.toContain("*.s3.amazonaws.com");
    expect(list.filter((host) => host.includes("evil"))).toHaveLength(0);
  });

  test("tells exact hostnames from patterns", () => {
    expect(isExactHostname("images.eyra.org.in")).toBe(true);
    expect(isExactHostname("*.eyra.org.in")).toBe(false);
    expect(isExactHostname("eyra.org.in/images")).toBe(false);
    expect(isExactHostname("eyra.org.in:443")).toBe(false);
  });

  test("lists each host once", () => {
    const list = hosts({ MEDUSA_IMAGE_HOSTS: "www.eyra.org.in, www.eyra.org.in, cdn.eyra.org.in" });
    expect(list.filter((host) => host === "www.eyra.org.in")).toHaveLength(1);
  });
});

test.describe("the running image optimiser", () => {
  test("refuses an image from a host that is not listed", async ({ request }) => {
    const res = await request.get(
      `/_next/image?url=${encodeURIComponent("https://some-stranger-bucket.s3.us-east-1.amazonaws.com/a.png")}&w=64&q=75`
    );
    expect(res.status()).toBe(400);
  });

  test("still serves a catalogue image from EYRA's own domain", async ({ request }) => {
    const res = await request.get(
      `/_next/image?url=${encodeURIComponent("https://www.eyra.org.in/images/product-2.jpg")}&w=256&q=75`
    );
    // 200 when the site is reachable; the point is that it is not rejected as a disallowed host.
    expect(res.status()).not.toBe(400);
  });
});
