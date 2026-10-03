import { createHash, createHmac } from 'node:crypto'

/**
 * File storage, on any S3-compatible bucket.
 *
 * This is a TypeScript port of the storage client Jesse wrote for the record
 * label site, which has been running a Railway bucket holding a few hundred
 * gigabytes for a while now. It is worth keeping the shape of: requests are
 * signed with AWS Signature V4 using `node:crypto` and nothing else, so there
 * is no SDK to keep up to date and no dependency that can turn into a supply
 * chain problem. Railway, Cloudflare R2, Backblaze and S3 itself all speak
 * this protocol, so the bucket can move without touching a line in here.
 *
 * Two things matter more than the signing, and both are policy rather than
 * mechanics:
 *
 * 1. THE BUCKET IS PRIVATE. Nothing in it is readable by URL. Every read goes
 *    through `signedDownloadUrl`, which mints a link that stops working after
 *    a few minutes. A link that leaks is a link that has already expired.
 *
 * 2. PERMISSION IS CHECKED BEFORE A LINK IS MINTED, NOT AFTER. This file
 *    knows nothing about who is asking. The route that calls it is the one
 *    that proves the person may see the file, which is why there is no
 *    `publicUrl` here to reach for by accident.
 *
 * Uploads go straight from the browser to the bucket with a signed PUT, so a
 * phone sending a two minute video of a bare room does not push it through
 * the application server first. The server only ever handles the metadata.
 */

type Config = {
  bucket: string
  accessKey: string
  secret: string
  endpoint: string
  region: string
}

/**
 * Read from the environment on every call rather than captured once at module
 * load. Railway restarts a service when its variables change, so this makes no
 * practical difference there, but it does mean a test can set a variable and
 * see it take effect, and it means an unconfigured deploy fails at the point
 * of use with a clear message instead of failing to boot at all.
 */
function config(): Config | null {
  const bucket = process.env.S3_BUCKET?.trim()
  const accessKey = process.env.S3_KEY?.trim()
  const secret = process.env.S3_SECRET?.trim()
  const endpoint = process.env.S3_ENDPOINT?.trim().replace(/\/$/, '')

  if (!bucket || !accessKey || !secret || !endpoint) return null

  return { bucket, accessKey, secret, endpoint, region: process.env.S3_REGION?.trim() || 'auto' }
}

/**
 * Whether a bucket is connected.
 *
 * Screens check this and say so plainly rather than offering an upload button
 * that throws. Until the bucket exists, the portal keeps working exactly as it
 * does today: photographs are pasted links, and the Files section explains
 * that sending files is not switched on yet.
 */
export function storageConfigured(): boolean {
  return config() !== null
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'No file storage is connected. Add S3_BUCKET, S3_KEY, S3_SECRET and S3_ENDPOINT in the hosting settings.',
    )
    this.name = 'StorageNotConfiguredError'
  }
}

export class StorageError extends Error {}

function required(): Config {
  const value = config()
  if (!value) throw new StorageNotConfiguredError()
  return value
}

// ---------------------------------------------------------------------------
// Signature V4
// ---------------------------------------------------------------------------

const UNSIGNED = 'UNSIGNED-PAYLOAD'

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

/**
 * S3 wants the stricter encoding than `encodeURIComponent` gives: the handful
 * of characters it leaves alone have to be escaped too, or the signature is
 * computed over a different string than the one the server sees.
 */
function enc(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/** A key is a path, so its slashes stay slashes and each segment is encoded. */
function encodeKey(key: string): string {
  return key.split('/').map(enc).join('/')
}

function queryString(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((name) => `${enc(name)}=${enc(query[name])}`)
    .join('&')
}

function timestamps(): { amz: string; day: string } {
  const amz = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return { amz, day: amz.slice(0, 8) }
}

function signingKey(cfg: Config, day: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${cfg.secret}`, day), cfg.region), 's3'), 'aws4_request')
}

function host(cfg: Config): string {
  return `${cfg.bucket}.${cfg.endpoint.replace(/^https?:\/\//, '')}`
}

function sign(cfg: Config, day: string, amz: string, canonical: string): string {
  const scope = `${day}/${cfg.region}/s3/aws4_request`
  return createHmac('sha256', signingKey(cfg, day))
    .update(['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n'))
    .digest('hex')
}

/** A request signed through the Authorization header. Server side only. */
async function request(
  method: string,
  key = '',
  {
    query = {},
    headers = {},
    body,
    payload = UNSIGNED,
  }: {
    query?: Record<string, string>
    headers?: Record<string, string | number>
    body?: BodyInit
    payload?: string
  } = {},
): Promise<Response> {
  const cfg = required()
  const { amz, day } = timestamps()
  const path = `/${encodeKey(key)}`

  const signed: Record<string, string> = {
    host: host(cfg),
    'x-amz-date': amz,
    'x-amz-content-sha256': payload,
    ...Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)]),
    ),
  }

  const names = Object.keys(signed).sort()
  const signedHeaders = names.join(';')
  const canonical = [
    method,
    path,
    queryString(query),
    names.map((name) => `${name}:${signed[name].trim()}\n`).join(''),
    signedHeaders,
    payload,
  ].join('\n')

  const scope = `${day}/${cfg.region}/s3/aws4_request`
  const signature = sign(cfg, day, amz, canonical)
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  // `host` was signed, but fetch sets it itself from the URL and refuses to
  // have it passed in, so it comes back out before the request is made.
  const send = { ...signed }
  delete send.host

  const search = queryString(query)

  return fetch(`https://${host(cfg)}${path}${search ? `?${search}` : ''}`, {
    method,
    headers: { ...send, Authorization: authorization },
    body,
  })
}

/**
 * A link that carries its own signature, good until it expires.
 *
 * Only `host` is signed, so the browser is free to send whatever other headers
 * it likes. That is what makes a presigned PUT work from a phone: the file
 * picker decides the content type, not us.
 */
function presign(
  method: string,
  key: string,
  { expires, query = {} }: { expires: number; query?: Record<string, string> },
): string {
  const cfg = required()
  const { amz, day } = timestamps()
  const path = `/${encodeKey(key)}`
  const scope = `${day}/${cfg.region}/s3/aws4_request`

  const params: Record<string, string> = {
    ...query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKey}/${scope}`,
    'X-Amz-Date': amz,
    // S3 refuses anything over a week. Clamping here rather than erroring
    // keeps a caller's bad arithmetic from turning into a 403 much later.
    'X-Amz-Expires': String(Math.min(604800, Math.max(1, Math.floor(expires)))),
    'X-Amz-SignedHeaders': 'host',
  }

  const canonical = [
    method,
    path,
    queryString(params),
    `host:${host(cfg)}\n`,
    'host',
    UNSIGNED,
  ].join('\n')

  const signature = sign(cfg, day, amz, canonical)
  return `https://${host(cfg)}${path}?${queryString(params)}&X-Amz-Signature=${signature}`
}

// ---------------------------------------------------------------------------
// What the rest of the application uses
// ---------------------------------------------------------------------------

/**
 * How long a download link lives.
 *
 * Short enough that a link pasted into a group chat is useless by the time
 * anybody clicks it, long enough that a slow phone finishing a large video
 * download does not get cut off part way. The link is handed out by a route
 * that redirects to it, so nobody ever sees or keeps one.
 */
export const DOWNLOAD_LINK_SECONDS = 10 * 60

/** How long a browser has to finish an upload it has been given a link for. */
export const UPLOAD_LINK_SECONDS = 60 * 60

function contentDisposition(filename: string): string {
  // Two forms, because old browsers read the plain one and everything else
  // reads the UTF-8 one. Quotes, backslashes and newlines are stripped from
  // the plain form: a filename is user input and this is a header.
  const plain = filename.replace(/["\\\r\n]/g, '').slice(0, 150)
  return `attachment; filename="${plain}"; filename*=UTF-8''${enc(filename)}`
}

/**
 * A short-lived link to read one object.
 *
 * Pass `download` with a filename to make the browser save it under that name
 * rather than showing it. Without it the browser displays what it can, which
 * is what a preview needs.
 */
export function signedDownloadUrl(
  key: string,
  { expires = DOWNLOAD_LINK_SECONDS, download }: { expires?: number; download?: string } = {},
): string {
  return presign('GET', key, {
    expires,
    query: download ? { 'response-content-disposition': contentDisposition(download) } : {},
  })
}

/** A short-lived link the browser can PUT a file to, with no server in between. */
export function signedUploadUrl(key: string, expires = UPLOAD_LINK_SECONDS): string {
  return presign('PUT', key, { expires })
}

async function expectOk(response: Response, what: string): Promise<Response> {
  if (response.ok) return response
  const detail = await response.text().catch(() => '')
  throw new StorageError(`Storage ${what} failed with ${response.status}: ${detail.slice(0, 200)}`)
}

/** Upload from the server. Used by tests and by anything generated server side. */
export async function putObject(
  key: string,
  body: Buffer,
  { contentType = 'application/octet-stream' }: { contentType?: string } = {},
): Promise<string> {
  await expectOk(
    await request('PUT', key, {
      headers: { 'content-type': contentType, 'content-length': body.length },
      body: new Uint8Array(body),
      payload: sha256(body),
    }),
    'upload',
  )
  return key
}

export type ObjectFacts = { size: number; contentType: string | null }

/**
 * What the bucket thinks is at a key, or null when nothing is.
 *
 * This is how an upload is confirmed. The browser uploads directly, so the
 * server never sees the bytes and cannot take the browser's word for the size
 * or the type. It asks the bucket.
 */
export async function headObject(key: string): Promise<ObjectFacts | null> {
  const response = await request('HEAD', key)
  if (response.status === 404) return null
  await expectOk(response, 'head')
  return {
    size: Number(response.headers.get('content-length') ?? 0),
    contentType: response.headers.get('content-type'),
  }
}

export async function deleteObject(key: string): Promise<void> {
  const response = await request('DELETE', key)
  // A delete of something already gone is a success, not a problem.
  if (response.status === 404) return
  await expectOk(response, 'delete')
}

/**
 * Lets browsers on our own site upload directly and read previews.
 *
 * Has to be run once per bucket, and again if the site gains a new domain.
 * It is here rather than in a console because "which origins may upload" is
 * part of how the application works, and a setting nobody can find in code is
 * a setting that gets lost.
 */
export async function allowBrowserUploads(origins: string[]): Promise<void> {
  const rules = origins.map((origin) => `<AllowedOrigin>${origin}</AllowedOrigin>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule>${rules}<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`
  const body = Buffer.from(xml)

  await expectOk(
    await request('PUT', '', {
      query: { cors: '' },
      headers: {
        'content-type': 'application/xml',
        'content-length': body.length,
        // This one endpoint still wants the legacy MD5 of the body.
        'content-md5': createHash('md5').update(body).digest('base64'),
      },
      body: new Uint8Array(body),
      payload: sha256(body),
    }),
    'cors',
  )
}

// ---------------------------------------------------------------------------
// Keys and filenames
// ---------------------------------------------------------------------------

/**
 * A filename safe to put in a storage key and in a Content-Disposition header.
 *
 * Accents are flattened, anything that is not a word character, a dot, a dash
 * or a space is dropped, and the result is capped. The important part is what
 * this removes: slashes, so a filename can never climb out of its folder, and
 * leading dots, so it cannot become a hidden file. Falls back to "file"
 * rather than to an empty string, because a key ending in a slash is a
 * different thing in a bucket.
 */
export function cleanFilename(raw: string): string {
  const cleaned = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120)

  return cleaned || 'file'
}

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Best guess at a type from a filename, for when the browser does not say. */
export function contentTypeFor(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[extension] ?? 'application/octet-stream'
}

/**
 * Where a project's files live.
 *
 * The upload's own id is in the path, which makes every key unique without
 * having to ask the bucket what is already there, and means two people
 * sending `IMG_4821.jpg` on the same afternoon do not overwrite each other.
 * The project id groups them so everything for one house can be listed, moved
 * or handed over together.
 */
export function uploadKey(projectId: string, uploadId: string, filename: string): string {
  return `projects/${projectId}/${uploadId}/${cleanFilename(filename)}`
}
